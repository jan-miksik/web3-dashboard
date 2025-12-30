import { ref, watch } from 'vue'
import {
  useConnectorClient,
  useAccount,
  useConnection,
  useConfig,
  useSwitchChain,
} from '@wagmi/vue'
import { getPublicClient } from '@wagmi/core'
import { encodeFunctionData, type Address, type Hex, zeroAddress } from 'viem'
// EIP-5792 sendCalls for wallet batching (works with browser wallets)
import { sendCalls, getCapabilities } from 'viem/actions'
import { useDustSweeper, type DustToken } from './useDustSweeper'
import { logger } from '~/utils/logger'
import { type Route, getStepTransaction } from '@lifi/sdk'
import { getUSDCAddress } from '~/utils/tokenAddresses'

// Known wallets that support batch transactions
export const BATCH_SUPPORTED_WALLETS = [
  { name: 'MetaMask', url: 'https://metamask.io' },
  // Add more wallets as they add support
] as const

const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const

export function useBatchSweeper() {
  const { getSweepRoute, executeRoute } = useDustSweeper()
  const { data: walletClient } = useConnectorClient()
  const { address } = useAccount()
  const { isConnected } = useConnection()
  const config = useConfig()
  const { switchChain } = useSwitchChain()

  const isBatching = ref(false)
  const batchStatus = ref('')
  const supportsBatching = ref<boolean | null>(null)
  const isCheckingSupport = ref(false)

  const parseCapabilityChainId = (key: string): number | null => {
    // common forms seen in wallets:
    // - "8453"
    // - "0x2105"
    // - "eip155:8453"
    const trimmed = key.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('eip155:')) {
      const raw = trimmed.slice('eip155:'.length)
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }

    if (trimmed.startsWith('0x')) {
      const n = Number.parseInt(trimmed, 16)
      return Number.isFinite(n) ? n : null
    }

    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }

  const getCapabilityForChain = (capabilities: unknown, chainId: number) => {
    if (!capabilities || typeof capabilities !== 'object') return undefined
    const entries = Object.entries(capabilities as Record<string, unknown>)
    for (const [key, cap] of entries) {
      const parsed = parseCapabilityChainId(key)
      if (parsed === chainId) return cap as any
    }
    return undefined
  }

  const isAtomicBatchReady = (cap: any): boolean => {
    const status = String(cap?.atomic?.status ?? '').toLowerCase()
    const atomicStatusOk = status === 'ready' || status === 'supported' || status === 'enabled'
    const atomicBatchOk =
      cap?.atomicBatch?.supported === true ||
      String(cap?.atomicBatch?.status ?? '').toLowerCase() === 'ready' ||
      String(cap?.atomicBatch?.status ?? '').toLowerCase() === 'supported'

    return atomicStatusOk || atomicBatchOk
  }

  const probeSendCallsSupport = async (): Promise<boolean> => {
    if (!walletClient.value || !address.value) return false

    // We intentionally send invalid params to avoid a wallet UI prompt.
    // We only care whether the method exists and understands the version.
    try {
      await walletClient.value.request({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '2.0.0',
            from: address.value,
            calls: [],
          },
        ],
      } as any)
      // If a wallet ever returns success for this, it's definitely supported.
      return true
    } catch (e: any) {
      const msg = String(e?.message ?? '')
      const code = e?.code

      // JSON-RPC "Method not found"
      if (code === -32601 || /method not found/i.test(msg)) return false

      // Any "invalid params"/"missing params"/version parsing indicates the method exists.
      if (
        /invalid params/i.test(msg) ||
        /missing/i.test(msg) ||
        /required/i.test(msg) ||
        /Version not supported/i.test(msg)
      ) {
        return true
      }

      // Unknown error shape — be conservative.
      return false
    }
  }

  // Check if wallet supports EIP-5792 batching (wallet_sendCalls)
  const checkBatchingSupport = async (chainId?: number) => {
    if (!walletClient.value || !address.value) return false

    isCheckingSupport.value = true

    try {
      const capabilities = await getCapabilities(walletClient.value, {
        account: address.value,
      })

      // Log full capabilities for debugging
      logger.info('Wallet capabilities received', { capabilities })
      console.log('Full wallet capabilities:', JSON.stringify(capabilities, null, 2))

      const chainToCheck = chainId ?? walletClient.value.chain?.id

      // Prefer checking the selected chain only (prevents false positives from other chains).
      let capToCheck: any | undefined
      if (chainToCheck) {
        capToCheck = getCapabilityForChain(capabilities, chainToCheck)
      }

      // MetaMask uses "atomic.status" while other wallets may use "atomicBatch"
      let hasAtomicBatch = false
      if (capToCheck) {
        hasAtomicBatch = isAtomicBatchReady(capToCheck)
      } else {
        // fallback: if we couldn't map chain keys, check any chain
        hasAtomicBatch = Object.values(capabilities as any).some((cap: any) =>
          isAtomicBatchReady(cap)
        )
      }

      // Capabilities are not always reliable in MetaMask builds.
      // If capabilities say "not ready" but the RPC method exists, we still treat it as supported,
      // and let sendCalls be the ultimate source of truth.
      if (!hasAtomicBatch) {
        const probed = await probeSendCallsSupport()
        hasAtomicBatch = probed
      }

      // Also log per-chain capability
      Object.entries(capabilities).forEach(([chainId, cap]: [string, any]) => {
        console.log(
          `Chain ${chainId}: atomic.status=${cap.atomic?.status}, atomicBatch.supported=${cap.atomicBatch?.supported}`
        )
      })

      supportsBatching.value = hasAtomicBatch
      console.log('Final batching support result:', hasAtomicBatch)
      return hasAtomicBatch
    } catch (e) {
      // Wallet doesn't support getCapabilities - likely no batching support
      console.error('getCapabilities failed:', e)
      logger.warn('wallet_getCapabilities unsupported or failed; probing wallet_sendCalls', {
        error: e,
      })

      const probed = await probeSendCallsSupport()
      supportsBatching.value = probed
      return probed
    } finally {
      isCheckingSupport.value = false
    }
  }

  // Watch for wallet client changes (happens when user switches wallet)
  watch(walletClient, (newClient, oldClient) => {
    // Re-check when wallet client changes and we have an address
    if (newClient && address.value) {
      // Only reset if this is a different wallet (not initial mount)
      if (oldClient) {
        supportsBatching.value = null
      }
      checkBatchingSupport()
    } else if (!newClient) {
      // Wallet disconnected, reset support
      supportsBatching.value = null
    }
  })

  // Watch for address changes (happens when user connects/switches wallet)
  watch(address, (newAddress, oldAddress) => {
    // When a new address is connected, check batching support
    if (newAddress && walletClient.value && newAddress !== oldAddress) {
      supportsBatching.value = null
      checkBatchingSupport()
    } else if (!newAddress) {
      // Address disconnected, reset support
      supportsBatching.value = null
    }
  })

  // Watch for connection status changes (additional safety check)
  watch(isConnected, connected => {
    if (connected && walletClient.value && address.value) {
      // New wallet connected, check batching support
      supportsBatching.value = null
      checkBatchingSupport()
    } else if (!connected) {
      // Disconnected, reset support
      supportsBatching.value = null
    }
  })

  const executeBatchSweep = async (
    chainId: number,
    tokens: DustToken[],
    targetAsset: 'ETH' | 'USDC'
  ) => {
    if (!walletClient.value) throw new Error('No wallet connected')
    if (!address.value) throw new Error('No address')

    isBatching.value = true
    batchStatus.value = 'Checking wallet capabilities...'

    try {
      // Check if wallet supports batching
      const canBatch = await checkBatchingSupport()

      // 1. Determine Target Token
      let toTokenAddress: Address = zeroAddress // ETH
      if (targetAsset === 'USDC') {
        toTokenAddress = getUSDCAddress(chainId)
      }

      batchStatus.value = 'Fetching routes...'

      // 2. Fetch Routes
      const routePromises = tokens.map(token => {
        return getSweepRoute(token, chainId, toTokenAddress, address.value!)
      })

      const routes = await Promise.all(routePromises)
      const validRoutes = routes.filter(r => r !== null) as Route[]

      if (validRoutes.length === 0) throw new Error('No valid routes found')

      // 4. Execute based on wallet capability
      if (canBatch) {
        // IMPORTANT: EIP-5792 batches calls on a SINGLE CHAIN.
        // LiFi routes can originate from different chains depending on the token.
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

          // Switch to the SOURCE chain for these routes (this fixes your revert-on-estimate issue).
          if (walletClient.value.chain?.id !== fromChainId) {
            batchStatus.value = `Switching to ${fromChain.name}...`
            await switchChain({ chainId: fromChainId })
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
          const publicClient = getPublicClient(config, { chainId: fromChainId })
          if (!publicClient) {
            throw new Error(`No public client available for chain ${fromChainId}`)
          }

          // 3. Build calls (+ approvals) for this source chain
          batchStatus.value = `Preparing ${routesOnChain.length} transactions on ${fromChain.name}...`

          const calls: { to: Address; data: Hex; value?: bigint }[] = []

          for (const route of routesOnChain) {
            const step = route.steps[0]
            if (!step) continue

            batchStatus.value = `Preparing ${step.action?.fromToken?.symbol || 'token'} on ${fromChain.name}...`

            const updatedStep = await getStepTransaction(step)
            if (!updatedStep.transactionRequest) {
              logger.warn('Step has no transactionRequest, skipping', { step: updatedStep })
              continue
            }

            const txRequest = updatedStep.transactionRequest
            const swapCall = {
              to: txRequest.to as Address,
              data: txRequest.data as Hex,
              value: txRequest.value ? BigInt(txRequest.value) : undefined,
            }

            // If the token is ERC20, ensure approval exists for the LiFi executor (swapCall.to).
            // This is a common reason estimateGas reverts (executeRoute handles approvals; batch path must do it).
            const tokenAddr = step.action?.fromToken?.address as Address | undefined
            const fromAmountRaw = (step.action as any)?.fromAmount ?? (route as any)?.fromAmount
            const fromAmount =
              typeof fromAmountRaw === 'string' && fromAmountRaw ? BigInt(fromAmountRaw) : 0n

            if (tokenAddr && tokenAddr !== zeroAddress && fromAmount > 0n) {
              try {
                const allowance = (await publicClient.readContract({
                  address: tokenAddr,
                  abi: ERC20_ABI,
                  functionName: 'allowance',
                  args: [address.value, swapCall.to],
                })) as bigint

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

          if (calls.length === 0) {
            throw new Error(`No valid transactions to send on ${fromChain.name}`)
          }

          // 4. Send batch for this source chain
          batchStatus.value = `Sending batch on ${fromChain.name} (${calls.length} calls)...`

          try {
            const result = await sendCalls(walletClient.value, {
              account: address.value,
              calls,
              chain: fromChain,
              version: '2.0.0',
            })
            results.push(result)
            logger.info('Batch sent via sendCalls', {
              id: result,
              fromChainId,
              count: calls.length,
            })
          } catch (sendError: any) {
            logger.error('sendCalls failed', sendError, {
              fromChainId,
              errorMessage: sendError?.message,
              errorCode: sendError?.code,
              errorName: sendError?.name,
            })

            if (sendError?.message?.includes('user rejected') || sendError?.code === 4001) {
              throw new Error('Transaction rejected by user')
            }
            if (sendError?.message?.includes('insufficient funds')) {
              throw new Error(`Insufficient funds on ${fromChain.name} to execute the batch`)
            }
            throw new Error(
              `Batch transaction failed on ${fromChain.name}: ${sendError?.message || 'Unknown error'}`
            )
          }
        }

        batchStatus.value = 'Batch sent! Waiting for confirmation...'
        return results
      } else {
        // Fallback: Execute sequentially via LiFi executeRoute
        batchStatus.value = `Wallet doesn't support batching. Executing ${validRoutes.length} transactions sequentially...`

        for (let i = 0; i < validRoutes.length; i++) {
          const route = validRoutes[i]
          if (!route) continue
          batchStatus.value = `Executing ${i + 1}/${validRoutes.length}: ${route.steps[0]?.action?.fromToken?.symbol || 'token'}...`
          await executeRoute(route)
        }

        batchStatus.value = 'All transactions complete!'
        logger.info('Sequential sweep complete', { count: validRoutes.length })
        return null
      }
    } catch (e) {
      logger.error('Batch sweep failed', e)
      batchStatus.value = 'Failed'
      throw e
    } finally {
      isBatching.value = false
    }
  }

  return {
    executeBatchSweep,
    isBatching,
    batchStatus,
    supportsBatching,
    isCheckingSupport,
    checkBatchingSupport,
  }
}
