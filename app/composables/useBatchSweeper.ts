import { computed } from 'vue'
import { useConnectorClient, useAccount, useConfig, useSwitchChain } from '@wagmi/vue'
import { getPublicClient } from '@wagmi/core'
import { encodeFunctionData, type Address, type Hex, zeroAddress, parseAbi } from 'viem'
import { useDustSweeper, type DustToken } from './useDustSweeper'
import { useBatchTransaction, type BatchCall } from './useBatchTransaction'
import { logger } from '~/utils/logger'
import { type Route, getStepTransaction } from '@lifi/sdk'
import { getUSDCAddress } from '~/utils/tokenAddresses'

// Known wallets that support batch transactions
export const BATCH_SUPPORTED_WALLETS = [
  { name: 'MetaMask', url: 'https://metamask.io' },
  // Add more wallets as they add support
] as const

const ERC20_APPROVE_SELECTOR = '0x095ea7b3'

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

export function useBatchSweeper() {
  const { getSweepRoute, executeRoute } = useDustSweeper()
  const { data: walletClient } = useConnectorClient()
  const { address } = useAccount()
  const config = useConfig()
  const { switchChain } = useSwitchChain()

  // Use the new batch transaction composable
  const {
    detectCapabilities,
    executeBatch,
    capabilities,
    isDetecting: isCheckingSupport,
    isPending: isBatching,
    status: batchStatus,
    walletType,
    batchMethod,
    isEOA,
    isSmartWallet,
  } = useBatchTransaction()

  // Computed values from capabilities
  const supportsBatching = computed(() => {
    if (!capabilities.value) return null
    return capabilities.value.supportsEIP7702 || capabilities.value.supportsEIP5792
  })

  const sendCallsVersion = computed(() => capabilities.value?.sendCallsVersion ?? null)

  // ============================================================================
  // Logging Helpers
  // ============================================================================

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
      data,
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

    console.groupCollapsed(
      `[batch] ${meta.fromChainName} (${meta.fromChainId}) | routes=${meta.routeCount} calls=${meta.calls.length} approvals=${approvals} value=${totalValue.toString()} method=${meta.method}`
    )
    console.table(
      summarized.map((c, i) => ({
        i,
        kind: c.kind,
        to: c.to,
        value: c.value,
        selector: c.selector,
        dataLen: c.dataLen,
      }))
    )
    console.log('calls (full):', summarized)
    console.groupEnd()
  }

  // ============================================================================
  // Batching Support Check
  // ============================================================================

  const checkBatchingSupport = async (chainId?: number) => {
    return detectCapabilities(chainId)
  }

  // Watch for wallet/address changes (delegate to useBatchTransaction's internal watchers)
  // The useBatchTransaction composable handles this internally

  // ============================================================================
  // Build Batch Calls from Routes
  // ============================================================================

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

      // Check and add approval if needed
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

            logger.info('Added approval call', {
              token: step.action?.fromToken?.symbol,
              tokenAddress: tokenAddr,
              spender: swapCall.to,
              fromAmount: fromAmount.toString(),
              allowance: allowance.toString(),
            })
          }
        } catch (e) {
          logger.warn('Failed to read allowance; proceeding without explicit approval', {
            token: step.action?.fromToken?.symbol,
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

  // ============================================================================
  // Execute Batch Sweep
  // ============================================================================

  const executeBatchSweep = async (
    chainId: number,
    tokens: DustToken[],
    targetAsset: 'ETH' | 'USDC'
  ) => {
    if (!walletClient.value) throw new Error('No wallet connected')
    if (!address.value) throw new Error('No address')

    try {
      // 1. Check capabilities
      batchStatus.value = 'Checking wallet capabilities...'
      const caps = await detectCapabilities(chainId)
      const canBatch = caps.supportsEIP7702 || caps.supportsEIP5792

      // 2. Determine target token
      let toTokenAddress: Address = zeroAddress // ETH
      if (targetAsset === 'USDC') {
        toTokenAddress = getUSDCAddress(chainId)
      }

      batchStatus.value = 'Fetching routes...'

      // 3. Fetch routes for all tokens
      const routePromises = tokens.map(token => {
        return getSweepRoute(token, chainId, toTokenAddress, address.value!)
      })

      const routes = await Promise.all(routePromises)
      const validRoutes = routes.filter(r => r !== null) as Route[]

      if (validRoutes.length === 0) throw new Error('No valid routes found')

      // 4. Group routes by source chain
      const routesByFromChain = new Map<number, Route[]>()
      for (const route of validRoutes) {
        const fromId = route.fromChainId
        const existing = routesByFromChain.get(fromId) ?? []
        existing.push(route)
        routesByFromChain.set(fromId, existing)
      }

      const results: unknown[] = []

      // 5. Execute batch for each source chain
      for (const [fromChainId, routesOnChain] of routesByFromChain.entries()) {
        const fromChain = config.chains.find(c => c.id === fromChainId)
        if (!fromChain) {
          throw new Error(`Source chain ${fromChainId} not found in wagmi config`)
        }

        // Switch chain if needed
        if (walletClient.value.chain?.id !== fromChainId) {
          batchStatus.value = `Switching to ${fromChain.name}...`
          await switchChain({ chainId: fromChainId })
          await new Promise(resolve => setTimeout(resolve, 1500))
        }

        // Build calls
        batchStatus.value = `Preparing ${routesOnChain.length} transactions on ${fromChain.name}...`
        const calls = await buildCallsFromRoutes(routesOnChain, fromChainId)

        if (calls.length === 0) {
          throw new Error(`No valid transactions to send on ${fromChain.name}`)
        }

        // Log batch info
        logBatchCalls({
          fromChainId,
          fromChainName: fromChain.name,
          routeCount: routesOnChain.length,
          calls,
          method: caps.preferredMethod,
        })

        // Execute based on capabilities
        if (canBatch) {
          batchStatus.value = caps.supportsEIP7702
            ? `Signing batch with EIP-7702 on ${fromChain.name}...`
            : `Sending batch on ${fromChain.name} (${calls.length} calls)...`

          try {
            const result = await executeBatch(calls, fromChain)
            results.push(result)

            logger.info('Batch executed', {
              method: result.method,
              txHash: result.txHash,
              batchId: result.batchId,
              fromChainId,
              callCount: calls.length,
            })
          } catch (batchError: any) {
            logger.error('Batch execution failed', batchError, {
              fromChainId,
              method: caps.preferredMethod,
            })

            if (batchError?.message?.includes('user rejected') || batchError?.code === 4001) {
              throw new Error('Transaction rejected by user')
            }
            if (batchError?.message?.includes('insufficient funds')) {
              throw new Error(`Insufficient funds on ${fromChain.name} to execute the batch`)
            }
            throw new Error(
              `Batch transaction failed on ${fromChain.name}: ${batchError?.message || 'Unknown error'}`
            )
          }
        } else {
          // Fallback: Execute sequentially via LiFi executeRoute
          batchStatus.value = `Wallet doesn't support batching. Executing ${routesOnChain.length} transactions sequentially...`

          for (let i = 0; i < routesOnChain.length; i++) {
            const route = routesOnChain[i]
            if (!route) continue
            batchStatus.value = `Executing ${i + 1}/${routesOnChain.length}: ${route.steps[0]?.action?.fromToken?.symbol || 'token'}...`
            await executeRoute(route)
          }
        }
      }

      batchStatus.value = canBatch ? 'Batch complete!' : 'All transactions complete!'
      return results
    } catch (e) {
      logger.error('Batch sweep failed', e)
      batchStatus.value = 'Failed'
      throw e
    }
  }

  return {
    // Sweep functionality
    executeBatchSweep,

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
    batchMethod,
    isEOA,
    isSmartWallet,
    capabilities,
  }
}
