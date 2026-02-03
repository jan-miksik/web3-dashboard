import { computed } from 'vue'
import { useConnectorClient, useConnection, useConfig, useSwitchChain } from '@wagmi/vue'
import { getPublicClient } from '@wagmi/core'
import { encodeFunctionData, type Address, type Hex, zeroAddress, parseAbi } from 'viem'
import { formatWeiAsEth } from '~/utils/format'
import { type Route, getStepTransaction } from '@lifi/sdk'
import type { Token } from './useTokens'
import { useTxComposer } from './useTxComposer'
import { useBatchTransaction, type BatchCall } from './useBatchTransaction'
import { useTransactionHistory, type TxHistorySwapLeg } from './useTransactionHistory'
import { logger } from '~/utils/logger'

const ERC20_APPROVE_SELECTOR = '0x095ea7b3'

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

/**
 * APPROVAL OPTIMIZATION NOTES:
 *
 * Current state: Each ERC20 token swap requires approval + swap call (2 calls per token).
 * Native tokens (ETH, etc.) only need swap call (1 call per token).
 *
 * Why we can't easily reduce approvals:
 * - Each swap may route through a DIFFERENT DEX/bridge contract
 * - Each spender (DEX router) needs its own approval
 * - LiFi aggregates many DEXs, so spenders vary per route
 *
 * Current optimizations already in place:
 * 1. EIP-7702: All approvals + swaps in ONE atomic transaction (best UX)
 * 2. EIP-5792: Wallet batches all calls together (MetaMask, etc.)
 * 3. We check existing allowances to skip unnecessary approvals
 *
 * Future optimization possibilities:
 * 1. Permit2 (Uniswap's universal approval):
 *    - One-time approval to Permit2 contract
 *    - Signature-based permits for each swap
 *    - Requires LiFi SDK support + token compatibility
 *
 * 2. EIP-2612 Permit:
 *    - Gasless approvals via signed permits
 *    - Limited token support
 *
 * 3. Approval aggregator contract:
 *    - User approves one contract that handles all DEX interactions
 *    - Essentially what EIP-7702 batch executor already does
 */

export function useBatchComposer() {
  const { getRouteQuote, executeRoute } = useTxComposer()
  const { data: walletClient } = useConnectorClient()
  const { address } = useConnection()
  const config = useConfig()
  const { switchChain } = useSwitchChain()
  const { addTransaction, updateTransaction, shouldStoreFailure } = useTransactionHistory(address)

  /** Fetch on-chain fee for a tx and update the history record (fire-and-forget). */
  function fetchFeeAndUpdate(txHash: string, chainId: number) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return
    const pc = getPublicClient(config, { chainId })
    if (!pc) return
    pc.getTransactionReceipt({ hash: txHash as Hex })
      .then(receipt => {
        if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) return
        const fee = receipt.gasUsed * receipt.effectiveGasPrice
        const feeSummary = formatWeiAsEth(fee)
        updateTransaction(txHash, chainId, { feeSummary })
      })
      .catch(() => {})
  }

  const {
    detectCapabilities,
    executeBatch,
    capabilities,
    isDetecting: isCheckingSupport,
    isPending: isBatching,
    status: batchStatus,
    walletType,
    walletProvider,
    batchMethod,
    maxBatchSize,
    isEOA,
    isSmartWallet,
  } = useBatchTransaction()

  const supportsBatching = computed(() => {
    if (!capabilities.value) return null
    return capabilities.value.supportsEIP7702 || capabilities.value.supportsEIP5792
  })

  const sendCallsVersion = computed(() => capabilities.value?.sendCallsVersion ?? null)

  /**
   * Splits an array of calls into chunks based on max batch size.
   * Returns an array of call batches.
   */
  const splitIntoBatches = (calls: BatchCall[], maxSize: number): BatchCall[][] => {
    if (calls.length <= maxSize) {
      return [calls]
    }

    const batches: BatchCall[][] = []
    for (let i = 0; i < calls.length; i += maxSize) {
      batches.push(calls.slice(i, i + maxSize))
    }
    return batches
  }

  /**
   * Calculates the number of batches needed for a given number of calls.
   */
  const calculateBatchCount = (callCount: number, maxSize: number): number => {
    return Math.ceil(callCount / maxSize)
  }

  const summarizeCall = (call: BatchCall) => {
    const data = call.data ?? '0x'
    const selector = typeof data === 'string' ? data.slice(0, 10) : ''
    const kind = selector === ERC20_APPROVE_SELECTOR ? 'erc20.approve' : 'unknown'
    return {
      to: call.to,
      value: call.value?.toString() ?? '0',
      selector,
      dataLen: typeof data === 'string' ? data.length : 0,
      kind,
    }
  }

  const logBatchCalls = (meta: {
    fromChainId: number
    fromChainName: string
    routeCount: number
    calls: BatchCall[]
    method: string
  }) => {
    const summarized = meta.calls.map(summarizeCall)
    const approvals = summarized.filter(c => c.kind === 'erc20.approve').length
    const values = meta.calls.map(c => c.value ?? 0n)
    const totalValue = values.reduce((a, b) => a + b, 0n)

    logger.info('Prepared batch calls', {
      fromChainId: meta.fromChainId,
      fromChainName: meta.fromChainName,
      routeCount: meta.routeCount,
      callCount: meta.calls.length,
      approvals,
      totalValue: totalValue.toString(),
      method: meta.method,
      calls: summarized,
    })
  }

  const buildCallsFromRoutes = async (routes: Route[], chainId: number): Promise<BatchCall[]> => {
    const publicClient = getPublicClient(config, { chainId })
    if (!publicClient || !address.value) {
      throw new Error('No public client or address')
    }

    const calls: BatchCall[] = []

    for (const route of routes) {
      const step = route.steps[0]
      if (!step) continue

      const updatedStep = await getStepTransaction(step)
      if (!updatedStep.transactionRequest) {
        logger.warn('Step has no transactionRequest, skipping', { step: updatedStep })
        continue
      }

      const txRequest = updatedStep.transactionRequest
      const swapCall: BatchCall = {
        to: txRequest.to as Address,
        data: txRequest.data as Hex,
        value: txRequest.value ? BigInt(txRequest.value) : undefined,
      }

      // Approval insertion (if ERC20)
      const tokenAddr = step.action?.fromToken?.address as Address | undefined
      const fromAmountRaw = (step.action as any)?.fromAmount ?? (route as any)?.fromAmount
      const fromAmount =
        typeof fromAmountRaw === 'string' && fromAmountRaw ? BigInt(fromAmountRaw) : 0n

      if (tokenAddr && tokenAddr !== zeroAddress && fromAmount > 0n) {
        try {
          const allowance = await publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address.value, swapCall.to],
          })

          if (allowance < fromAmount) {
            const approveData = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [swapCall.to, fromAmount],
            })

            calls.push({
              to: tokenAddr,
              data: approveData,
            })
          }
        } catch (e) {
          logger.warn('Failed to read allowance; proceeding without explicit approval', {
            tokenAddress: tokenAddr,
            spender: swapCall.to,
            error: e,
          })
        }
      }

      calls.push(swapCall)
    }

    return calls
  }

  const checkBatchingSupport = async (chainId?: number) => {
    return detectCapabilities(chainId)
  }

  /**
   * Creates input summary: which tokens were swapped (e.g. "ETH, USDC → USDC")
   */
  const createInputSummary = (
    tokens: Token[],
    _targetChainId: number,
    _targetTokenAddress: Address,
    routes: Route[]
  ): string => {
    if (tokens.length === 0) return 'No tokens'
    const inputSymbols = [...new Set(tokens.map(t => t.symbol || 'token'))]
    const toToken = routes[0]?.toToken as { symbol?: string } | undefined
    const outputSymbol = toToken?.symbol ?? 'token'
    if (inputSymbols.length === 1) {
      return `Swap ${inputSymbols[0]} → ${outputSymbol}`
    }
    return `Swap ${inputSymbols.join(', ')} → ${outputSymbol}`
  }

  /**
   * Creates output summary: what was received (e.g. "USDC on Base")
   */
  const createOutputSummary = (
    targetChainId: number,
    _targetTokenAddress: Address,
    routes: Route[]
  ): string => {
    const toToken = routes[0]?.toToken as { symbol?: string } | undefined
    const symbol = toToken?.symbol ?? 'token'
    const chainName =
      config.chains.find(c => c.id === targetChainId)?.name ?? `chain ${targetChainId}`
    return `Receive ${symbol} on ${chainName}`
  }

  /**
   * Builds detailed swap leg data from tokens and routes for transaction history
   * Routes are matched to tokens by fromToken address and chainId
   */
  const buildSwapLegs = (tokens: Token[], routes: Route[]): TxHistorySwapLeg[] => {
    const legs: TxHistorySwapLeg[] = []

    // Create a map of routes by fromToken address for quick lookup
    const routeMap = new Map<string, Route>()
    for (const route of routes) {
      const fromToken = route.fromToken as { address?: string } | undefined
      if (fromToken?.address) {
        const key = `${route.fromChainId}-${fromToken.address.toLowerCase()}`
        routeMap.set(key, route)
      }
    }

    for (const token of tokens) {
      const routeKey = `${token.chainId}-${token.address.toLowerCase()}`
      const route = routeMap.get(routeKey)
      if (!route) continue

      const action = route.steps[0]?.action as
        | { fromAmount?: string; toAmount?: string }
        | undefined

      // Extract providers from route steps - always include LIFI as the aggregator
      const providers = route.steps
        .map(step => step.toolDetails?.name)
        .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      const uniqueProviders = ['LIFI', ...new Set(providers)]

      // Get USD values - prefer route's USD values, fallback to token's usdValue
      const fromAmountUsdRaw = route.fromAmountUSD ?? token.usdValue
      const fromAmountUsd =
        typeof fromAmountUsdRaw === 'number'
          ? fromAmountUsdRaw
          : typeof fromAmountUsdRaw === 'string'
            ? Number.parseFloat(fromAmountUsdRaw) || undefined
            : undefined
      const toAmountUsdRaw = route.toAmountUSD
      const toAmountUsd =
        typeof toAmountUsdRaw === 'number'
          ? toAmountUsdRaw
          : typeof toAmountUsdRaw === 'string'
            ? Number.parseFloat(toAmountUsdRaw) || undefined
            : undefined

      legs.push({
        chainId: token.chainId,
        fromToken: {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          logoURI: token.logoURI,
          decimals: token.decimals,
        },
        fromAmount: action?.fromAmount ?? route.fromAmount ?? '0',
        fromAmountUsd,
        toAmount: action?.toAmount ?? route.toAmount,
        toAmountUsd,
        providers: uniqueProviders,
        routeType: route.steps[0]?.type ?? 'lifi',
      })
    }

    return legs
  }

  const executeComposer = async (args: {
    targetChainId: number
    targetTokenAddress: Address
    tokens: Token[]
    sendOutput: boolean
    recipientAddress?: Address
    useBatching: boolean
    customAmounts?: Map<string, string>
  }) => {
    if (!walletClient.value) throw new Error('No wallet connected')
    if (!address.value) throw new Error('No address')
    if (args.tokens.length === 0) throw new Error('No tokens selected')

    const toAddress = args.sendOutput ? (args.recipientAddress ?? address.value) : address.value

    batchStatus.value = 'Checking wallet capabilities...'
    const caps = await detectCapabilities(args.targetChainId)
    const canBatch = args.useBatching && (caps.supportsEIP7702 || caps.supportsEIP5792)

    batchStatus.value = 'Fetching routes...'
    const getTokenKey = (t: Token) => `${t.chainId}-${t.address}`
    const routePromises = args.tokens.map(t => {
      const customAmount = args.customAmounts?.get(getTokenKey(t))
      return getRouteQuote({
        fromToken: t,
        toChainId: args.targetChainId,
        toTokenAddress: args.targetTokenAddress,
        fromAddress: address.value!,
        toAddress,
        customAmount,
      })
    })

    const quoteResults = await Promise.all(routePromises)
    const validRoutes = quoteResults.map(r => r?.route ?? null).filter(Boolean) as Route[]

    if (validRoutes.length === 0) throw new Error('No valid routes found')

    // Group routes by source chain
    const routesByFromChain = new Map<number, Route[]>()
    for (const route of validRoutes) {
      const fromId = route.fromChainId
      const existing = routesByFromChain.get(fromId) ?? []
      existing.push(route)
      routesByFromChain.set(fromId, existing)
    }

    const results: unknown[] = []

    for (const [fromChainId, routesOnChain] of routesByFromChain.entries()) {
      const fromChain = config.chains.find(c => c.id === fromChainId)
      if (!fromChain) {
        throw new Error(`Source chain ${fromChainId} not found in wagmi config`)
      }

      if (walletClient.value.chain?.id !== fromChainId) {
        batchStatus.value = `Switching to ${fromChain.name}...`
        await switchChain({ chainId: fromChainId })
        await new Promise(resolve => setTimeout(resolve, 1200))
      }

      if (canBatch) {
        batchStatus.value = `Preparing ${routesOnChain.length} transaction(s) on ${fromChain.name}...`
        const calls = await buildCallsFromRoutes(routesOnChain, fromChainId)
        if (calls.length === 0) {
          throw new Error(`No valid transactions to send on ${fromChain.name}`)
        }

        // Split into batches based on wallet's max batch size
        const currentMaxBatchSize = caps.maxBatchSize
        const batches = splitIntoBatches(calls, currentMaxBatchSize)
        const totalBatches = batches.length

        logger.info('Batch splitting', {
          totalCalls: calls.length,
          maxBatchSize: currentMaxBatchSize,
          batchCount: totalBatches,
          walletProvider: caps.walletProvider,
        })

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batchCalls = batches[batchIndex]!
          const batchNum = batchIndex + 1

          logBatchCalls({
            fromChainId,
            fromChainName: fromChain.name,
            routeCount: routesOnChain.length,
            calls: batchCalls,
            method: caps.preferredMethod,
          })

          // Update status with batch progress
          const batchProgress = totalBatches > 1 ? ` (batch ${batchNum}/${totalBatches})` : ''

          batchStatus.value = caps.supportsEIP7702
            ? `Signing batch with EIP-7702 on ${fromChain.name}${batchProgress}...`
            : `Sending batch on ${fromChain.name} (${batchCalls.length} calls)${batchProgress}...`

          try {
            const result = await executeBatch(batchCalls, fromChain)
            results.push(result)

            // Record successful transaction in history
            const txHash = result.txHash ? String(result.txHash) : null
            const batchId = result.batchId ? String(result.batchId) : null
            if (result.success && (txHash || batchId)) {
              const inputSummary = createInputSummary(
                args.tokens,
                args.targetChainId,
                args.targetTokenAddress,
                routesOnChain
              )
              const outputSummary = createOutputSummary(
                args.targetChainId,
                args.targetTokenAddress,
                routesOnChain
              )

              // Build detailed swap legs
              const legs = buildSwapLegs(args.tokens, routesOnChain)

              // Calculate totals
              const totalSellUsd = legs.reduce((sum, leg) => sum + (leg.fromAmountUsd ?? 0), 0)
              const totalReceiveUsd = legs.reduce((sum, leg) => sum + (leg.toAmountUsd ?? 0), 0)
              const toToken = routesOnChain[0]?.toToken as
                | { symbol?: string; address?: string; logoURI?: string; decimals?: number }
                | undefined

              // Build explorer URL
              const explorerMap: Record<number, string> = {
                1: 'https://etherscan.io',
                8453: 'https://basescan.org',
                42161: 'https://arbiscan.io',
                10: 'https://optimistic.etherscan.io',
                137: 'https://polygonscan.com',
                43114: 'https://snowtrace.io',
                250: 'https://ftmscan.com',
                42220: 'https://celoscan.io',
                100: 'https://gnosisscan.io',
                324: 'https://explorer.zksync.io',
              }
              const explorerBase =
                explorerMap[fromChainId] || `https://explorer.chain${fromChainId}.io`
              const explorerUrl =
                txHash && /^0x[0-9a-fA-F]{64}$/.test(txHash)
                  ? `${explorerBase}/tx/${txHash}`
                  : undefined

              addTransaction({
                hash: txHash ?? batchId ?? '',
                chainId: fromChainId,
                status: 'success',
                timestamp: Date.now(),
                source: 'app',
                inputSummary,
                outputSummary,
                totalSellUsd,
                totalReceiveUsd,
                totalReceiveAmount: routesOnChain[0]?.toAmount,
                outputTokenSymbol: toToken?.symbol,
                feeSummary: result.feeSummary,
                explorerUrl,
                batchCount: totalBatches,
                batchId: batchId ?? undefined,
                details: {
                  legs,
                  outputToken: {
                    chainId: args.targetChainId,
                    address: args.targetTokenAddress,
                    symbol: toToken?.symbol ?? 'token',
                    logoURI: toToken?.logoURI,
                    decimals: toToken?.decimals,
                  },
                },
              })
              if (txHash && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
                fetchFeeAndUpdate(txHash, fromChainId)
              }
            }

            // Brief pause between batches to avoid overwhelming the wallet
            if (batchIndex < batches.length - 1) {
              batchStatus.value = `Batch ${batchNum}/${totalBatches} complete. Preparing next batch...`
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          } catch (error) {
            // Only store failure if it's not a user rejection
            if (shouldStoreFailure(error)) {
              const inputSummary = createInputSummary(
                args.tokens,
                args.targetChainId,
                args.targetTokenAddress,
                routesOnChain
              )
              addTransaction({
                hash: `failed-${Date.now()}-${batchIndex}`, // Generate a unique hash for failed transactions
                chainId: fromChainId,
                status: 'failed',
                timestamp: Date.now(),
                source: 'app',
                inputSummary,
                batchCount: totalBatches,
              })
            }
            throw error
          }
        }
      } else {
        batchStatus.value = `Executing ${routesOnChain.length} transaction(s) sequentially on ${fromChain.name}...`
        for (let i = 0; i < routesOnChain.length; i++) {
          const route = routesOnChain[i]
          if (!route) continue
          batchStatus.value = `Executing ${i + 1}/${routesOnChain.length}...`
          try {
            const routeResult = await executeRoute(route)
            // Record successful sequential transaction
            if (routeResult?.hash) {
              const inputSummary = createInputSummary(
                args.tokens,
                args.targetChainId,
                args.targetTokenAddress,
                routesOnChain
              )
              const outputSummary = createOutputSummary(
                args.targetChainId,
                args.targetTokenAddress,
                routesOnChain
              )

              // Build detailed swap legs
              const legs = buildSwapLegs(args.tokens, routesOnChain)

              // Calculate totals
              const totalSellUsd = legs.reduce((sum, leg) => sum + (leg.fromAmountUsd ?? 0), 0)
              const totalReceiveUsd = legs.reduce((sum, leg) => sum + (leg.toAmountUsd ?? 0), 0)
              const toToken = routesOnChain[0]?.toToken as
                | { symbol?: string; address?: string; logoURI?: string; decimals?: number }
                | undefined

              // Build explorer URL
              const explorerMap: Record<number, string> = {
                1: 'https://etherscan.io',
                8453: 'https://basescan.org',
                42161: 'https://arbiscan.io',
                10: 'https://optimistic.etherscan.io',
                137: 'https://polygonscan.com',
                43114: 'https://snowtrace.io',
                250: 'https://ftmscan.com',
                42220: 'https://celoscan.io',
                100: 'https://gnosisscan.io',
                324: 'https://explorer.zksync.io',
              }
              const explorerBase =
                explorerMap[fromChainId] || `https://explorer.chain${fromChainId}.io`
              const explorerUrl = /^0x[0-9a-fA-F]{64}$/.test(String(routeResult.hash))
                ? `${explorerBase}/tx/${routeResult.hash}`
                : undefined

              addTransaction({
                hash: String(routeResult.hash),
                chainId: fromChainId,
                status: 'success',
                timestamp: Date.now(),
                source: 'app',
                inputSummary,
                outputSummary,
                totalSellUsd,
                totalReceiveUsd,
                totalReceiveAmount: routesOnChain[0]?.toAmount,
                outputTokenSymbol: toToken?.symbol,
                explorerUrl,
                details: {
                  legs,
                  outputToken: {
                    chainId: args.targetChainId,
                    address: args.targetTokenAddress,
                    symbol: toToken?.symbol ?? 'token',
                    logoURI: toToken?.logoURI,
                    decimals: toToken?.decimals,
                  },
                },
              })
              fetchFeeAndUpdate(String(routeResult.hash), fromChainId)
            }
          } catch (error) {
            // Only store failure if it's not a user rejection
            if (shouldStoreFailure(error)) {
              const inputSummary = createInputSummary(
                args.tokens,
                args.targetChainId,
                args.targetTokenAddress,
                routesOnChain
              )
              addTransaction({
                hash: `failed-${Date.now()}-${i}`,
                chainId: fromChainId,
                status: 'failed',
                timestamp: Date.now(),
                source: 'app',
                inputSummary,
              })
            }
            throw error
          }
        }
      }
    }

    batchStatus.value = canBatch ? 'All batches complete!' : 'All transactions complete!'
    return results
  }

  return {
    executeComposer,

    // Status
    isBatching,
    batchStatus,

    // Capabilities
    supportsBatching,
    isCheckingSupport,
    checkBatchingSupport,
    sendCallsVersion,

    // Wallet type info
    walletType,
    walletProvider,
    batchMethod,
    maxBatchSize,
    isEOA,
    isSmartWallet,
    capabilities,

    // Helpers
    calculateBatchCount,
  }
}
