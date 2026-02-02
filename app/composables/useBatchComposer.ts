import { computed } from 'vue'
import { useConnectorClient, useConnection, useConfig, useSwitchChain } from '@wagmi/vue'
import { getPublicClient } from '@wagmi/core'
import { encodeFunctionData, type Address, type Hex, zeroAddress, parseAbi } from 'viem'
import { type Route, getStepTransaction } from '@lifi/sdk'
import type { Token } from './useTokens'
import { useTxComposer } from './useTxComposer'
import { useBatchTransaction, type BatchCall } from './useBatchTransaction'
import { useTransactionHistory } from './useTransactionHistory'
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
  const { addTransaction, shouldStoreFailure } = useTransactionHistory(address)

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
   * Creates input summary string from tokens and target info
   */
  const createInputSummary = (
    tokens: Token[],
    targetChainId: number,
    targetTokenAddress: Address
  ): string => {
    const tokenCount = tokens.length
    if (tokenCount === 0) return 'No tokens'
    if (tokenCount === 1) {
      const token = tokens[0]!
      return `Swap ${token.symbol || 'token'} on chain ${token.chainId}`
    }
    return `Swap ${tokenCount} tokens → chain ${targetChainId}`
  }

  /**
   * Creates output summary string from target info
   */
  const createOutputSummary = (targetChainId: number, targetTokenAddress: Address): string => {
    return `Receive on chain ${targetChainId}`
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
            if (result.success && result.txHash) {
              const inputSummary = createInputSummary(
                args.tokens,
                args.targetChainId,
                args.targetTokenAddress
              )
              const outputSummary = createOutputSummary(args.targetChainId, args.targetTokenAddress)

              addTransaction({
                hash: result.txHash,
                chainId: fromChainId,
                status: 'success',
                timestamp: Date.now(),
                source: 'app',
                inputSummary,
                outputSummary,
                batchCount: totalBatches,
              })
            } else if (result.success && result.batchId) {
              // EIP-5792 returns batchId instead of txHash
              // Store with batchId for tracking
              const inputSummary = createInputSummary(
                args.tokens,
                args.targetChainId,
                args.targetTokenAddress
              )
              const outputSummary = createOutputSummary(args.targetChainId, args.targetTokenAddress)

              addTransaction({
                hash: result.batchId, // Use batchId as hash for EIP-5792
                chainId: fromChainId,
                status: 'success',
                timestamp: Date.now(),
                source: 'app',
                inputSummary,
                outputSummary,
                batchCount: totalBatches,
                batchId: result.batchId,
              })
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
                args.targetTokenAddress
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
                args.targetTokenAddress
              )
              const outputSummary = createOutputSummary(args.targetChainId, args.targetTokenAddress)

              addTransaction({
                hash: routeResult.hash,
                chainId: fromChainId,
                status: 'success',
                timestamp: Date.now(),
                source: 'app',
                inputSummary,
                outputSummary,
              })
            }
          } catch (error) {
            // Only store failure if it's not a user rejection
            if (shouldStoreFailure(error)) {
              const inputSummary = createInputSummary(
                args.tokens,
                args.targetChainId,
                args.targetTokenAddress
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
