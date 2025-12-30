import { computed, ref } from 'vue'
import { useTokens, type Token } from './useTokens'
import {
  type Route,
  type RoutesRequest,
  createConfig,
  executeRoute as executeLifiRoute,
  getRoutes,
  EVM,
} from '@lifi/sdk'
import { useConnectorClient, useSwitchChain, useConfig } from '@wagmi/vue'
import { getWalletClient } from '@wagmi/core'
import { logger } from '~/utils/logger'

// Initialize LiFi SDK
let isLifiConfigured = false

export interface DustToken extends Token {
  selected: boolean
}

export interface SweepQuote {
  route: Route
  fromToken: DustToken
  toTokenAddress: string
  toChainId: number
}

// Global Shared State
const dustThreshold = ref(5) // USD
const selectedTokenIds = ref<Set<string>>(new Set())
const isSweeping = ref(false)
const sweepStatus = ref<string>('')

export function useDustSweeper() {
  const { allTokens, isLoading: isLoadingTokens, refetch: refetchTokens } = useTokens()
  const { data: walletClient } = useConnectorClient()
  const { switchChain } = useSwitchChain()
  const config = useConfig()

  if (!isLifiConfigured) {
    createConfig({
      integrator: 'web3-dust-sweeper',
      providers: [
        EVM({
          getWalletClient: () => getWalletClient(config),
        }),
      ],
    })
    isLifiConfigured = true
  }

  const dustTokens = computed(() => {
    return allTokens.value
      .filter(t => t.usdValue > 0 && t.usdValue < dustThreshold.value)
      .map(t => ({
        ...t,
        selected: selectedTokenIds.value.has(`${t.chainId}-${t.address}`),
      }))
  })

  const toggleToken = (token: Token) => {
    const id = `${token.chainId}-${token.address}`
    const newSet = new Set(selectedTokenIds.value)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    selectedTokenIds.value = newSet
  }

  const selectTokens = (tokens: Token[]) => {
    const newSet = new Set(selectedTokenIds.value)
    tokens.forEach(t => newSet.add(`${t.chainId}-${t.address}`))
    selectedTokenIds.value = newSet
  }

  const deselectTokens = (tokens: Token[]) => {
    const newSet = new Set(selectedTokenIds.value)
    tokens.forEach(t => newSet.delete(`${t.chainId}-${t.address}`))
    selectedTokenIds.value = newSet
  }

  const toggleAll = (tokens: Token[], selected: boolean) => {
    if (selected) {
      selectTokens(tokens)
    } else {
      deselectTokens(tokens)
    }
  }

  const selectedDustTokens = computed(() => {
    return dustTokens.value.filter(t => selectedTokenIds.value.has(`${t.chainId}-${t.address}`))
  })

  // getSweepRoute remains the same
  const getSweepRoute = async (
    fromToken: Token,
    toChainId: number,
    toTokenAddress: string,
    recipientAddress: string
  ): Promise<Route | null> => {
    try {
      console.log('getSweepRoute called', { fromToken, toChainId, toTokenAddress })
      const routesRequest: RoutesRequest = {
        fromChainId: fromToken.chainId,
        fromAmount: fromToken.balance, // wei amount
        fromTokenAddress: fromToken.address,
        toChainId,
        toTokenAddress,
        fromAddress: recipientAddress,
        toAddress: recipientAddress,
        options: {
          integrator: 'web3-dust-sweeper',
          order: 'RECOMMENDED',
        },
      }

      console.log('Fetching routes from LiFi...', routesRequest)
      const response = await getRoutes(routesRequest)
      console.log('LiFi response:', response)
      return response.routes[0] || null
    } catch (e) {
      logger.error('LiFi Route Error', e)
      console.error('Detailed LiFi Error:', e)
      return null
    }
  }

  const executeRoute = async (route: Route) => {
    if (!walletClient.value) {
      console.error('No wallet client found during execution')
      throw new Error('No wallet client')
    }

    isSweeping.value = true
    sweepStatus.value = 'Preparing transaction...'

    try {
      console.log('Switching chain if needed...')
      // Switch chain if needed
      if (walletClient.value.chain.id !== route.fromChainId) {
        sweepStatus.value = `Switching to chain ${route.fromChainId}...`
        console.log(`Switching from ${walletClient.value.chain.id} to ${route.fromChainId}`)
        await switchChain({ chainId: route.fromChainId })
      }

      sweepStatus.value = 'Executing route...'
      console.log('Executing LiFi route...')
      // Execute via LiFi
      await executeLifiRoute(route, {
        updateRouteHook: updatedRoute => {
          logger.info('Route updated', { route: updatedRoute })
          const executionStatus = updatedRoute.steps[0]?.execution?.status
          console.log('Route status update:', executionStatus)

          // Update status based on execution state
          if (executionStatus) {
            const statusMap: Record<string, string> = {
              PENDING: 'Transaction pending...',
              ACTION_REQUIRED: 'Action required in wallet...',
              CHAIN_SWITCH_REQUIRED: 'Chain switch required...',
              DONE: 'Transaction complete!',
              FAILED: 'Transaction failed',
            }
            sweepStatus.value = statusMap[executionStatus] || `Status: ${executionStatus}`
          }
        },
      })
      sweepStatus.value = 'Transaction complete!'
      console.log('Route execution finished')
    } catch (error) {
      logger.error('Route execution failed', error)
      sweepStatus.value = 'Transaction failed'
      throw error
    } finally {
      isSweeping.value = false
    }
  }

  return {
    dustTokens,
    isLoadingTokens,
    dustThreshold,
    selectedTokenIds,
    toggleToken,
    toggleAll,
    selectTokens,
    deselectTokens,
    selectedDustTokens,
    getSweepRoute,
    executeRoute,
    isSweeping,
    sweepStatus,
    refetchTokens,
  }
}
