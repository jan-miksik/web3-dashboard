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

// Initialize LiFi SDK (module singleton)
let isLifiConfigured = false

export interface ComposerToken extends Token {
  selected: boolean
}

export interface QuoteResult {
  route: Route
  cacheKey: string
  cached: boolean
}

// Global Shared State (so page + components stay in sync)
const minUsdValue = ref<number | null>(null)
const maxUsdValue = ref<number | null>(null)
const selectedChainIds = ref<Set<number>>(new Set()) // Empty set = all chains
const selectedTokenIds = ref<Set<string>>(new Set())

// Custom amounts per token (key: chainId-address, value: custom amount string)
// If not set, uses full balance
const customAmounts = ref<Map<string, string>>(new Map())

// Default percentage of balance to select when user clicks an asset (0–100)
const defaultSelectionPercent = ref(100)

const isExecuting = ref(false)
const executionStatus = ref<string>('')

type QuoteKeyParams = {
  fromChainId: number
  fromTokenAddress: string
  fromAmount: string
  toChainId: number
  toTokenAddress: string
  fromAddress: string
  toAddress: string
}

const quoteCache = new Map<
  string,
  {
    route: Route
    cachedAtMs: number
  }
>()

const QUOTE_CACHE_TTL_MS = 1000 * 60 * 2 // 2 minutes

function buildQuoteCacheKey(p: QuoteKeyParams): string {
  return [
    p.fromChainId,
    p.fromTokenAddress.toLowerCase(),
    p.fromAmount,
    p.toChainId,
    p.toTokenAddress.toLowerCase(),
    p.fromAddress.toLowerCase(),
    p.toAddress.toLowerCase(),
  ].join(':')
}

export function useTxComposer() {
  const { allTokens, isLoading: isLoadingTokens, refetch: refetchTokens } = useTokens()
  const { data: walletClient } = useConnectorClient()
  const { switchChain } = useSwitchChain()
  const config = useConfig()

  if (!isLifiConfigured) {
    createConfig({
      integrator: 'web3-tx-composer',
      providers: [
        EVM({
          getWalletClient: () => getWalletClient(config),
        }),
      ],
    })
    isLifiConfigured = true
  }

  const filteredTokens = computed<ComposerToken[]>(() => {
    const min = typeof minUsdValue.value === 'number' ? minUsdValue.value : -Infinity
    const max = typeof maxUsdValue.value === 'number' ? maxUsdValue.value : Infinity

    // If min > max, return empty to avoid surprising results.
    if (min > max) return []

    return allTokens.value
      .filter(t => t.usdValue > 0)
      .filter(t => t.usdValue >= min)
      .filter(t => t.usdValue <= max)
      .filter(t => {
        // If no chains selected (empty set), show all chains
        if (selectedChainIds.value.size === 0) return true
        return selectedChainIds.value.has(t.chainId)
      })
      .map(t => ({
        ...t,
        selected: selectedTokenIds.value.has(`${t.chainId}-${t.address}`),
      }))
  })

  const selectedTokens = computed<ComposerToken[]>(() => {
    return filteredTokens.value.filter(t => selectedTokenIds.value.has(`${t.chainId}-${t.address}`))
  })

  const applyDefaultPercentToToken = (token: Token) => {
    const pct = Math.min(100, Math.max(0, defaultSelectionPercent.value))
    if (pct >= 100) {
      setCustomAmount(token, null)
      return
    }
    const balance = BigInt(token.balance)
    // Support 2 decimal places (e.g. 0.01, 50.5): (balance * pct*100) / 10000
    const amount = (balance * BigInt(Math.round(pct * 100))) / 10000n
    setCustomAmount(token, amount === balance ? null : amount.toString())
  }

  const applyDefaultPercentToAllSelected = () => {
    for (const token of filteredTokens.value) {
      if (selectedTokenIds.value.has(`${token.chainId}-${token.address}`)) {
        applyDefaultPercentToToken(token)
      }
    }
  }

  const toggleToken = (token: Token) => {
    const id = `${token.chainId}-${token.address}`
    const newSet = new Set(selectedTokenIds.value)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
      selectedTokenIds.value = newSet
      applyDefaultPercentToToken(token)
      return
    }
    selectedTokenIds.value = newSet
  }

  const selectTokens = (tokens: Token[]) => {
    const prev = selectedTokenIds.value
    const newSet = new Set(selectedTokenIds.value)
    tokens.forEach(t => {
      const id = `${t.chainId}-${t.address}`
      const isNew = !prev.has(id)
      newSet.add(id)
      if (isNew) applyDefaultPercentToToken(t)
    })
    selectedTokenIds.value = newSet
  }

  const deselectTokens = (tokens: Token[]) => {
    const newSet = new Set(selectedTokenIds.value)
    tokens.forEach(t => newSet.delete(`${t.chainId}-${t.address}`))
    selectedTokenIds.value = newSet
  }

  const clearSelection = () => {
    selectedTokenIds.value = new Set()
    customAmounts.value = new Map()
  }

  const getTokenKey = (token: { chainId: number; address: string }) =>
    `${token.chainId}-${token.address}`

  const getCustomAmount = (token: Token): string | null => {
    return customAmounts.value.get(getTokenKey(token)) ?? null
  }

  const setCustomAmount = (token: Token, amount: string | null) => {
    const key = getTokenKey(token)
    const newMap = new Map(customAmounts.value)
    if (amount === null || amount === '' || amount === token.balance) {
      newMap.delete(key)
    } else {
      newMap.set(key, amount)
    }
    customAmounts.value = newMap
  }

  const getEffectiveAmount = (token: Token): string => {
    return customAmounts.value.get(getTokenKey(token)) ?? token.balance
  }

  const getRouteQuote = async (args: {
    fromToken: Token
    toChainId: number
    toTokenAddress: string
    fromAddress: string
    toAddress: string
    customAmount?: string
    forceRefresh?: boolean
  }): Promise<QuoteResult | null> => {
    try {
      // Avoid no-op routes (same token on same chain).
      if (
        args.fromToken.chainId === args.toChainId &&
        args.fromToken.address.toLowerCase() === args.toTokenAddress.toLowerCase()
      ) {
        return null
      }

      const fromAmount = args.customAmount ?? args.fromToken.balance

      const cacheKey = buildQuoteCacheKey({
        fromChainId: args.fromToken.chainId,
        fromTokenAddress: args.fromToken.address,
        fromAmount,
        toChainId: args.toChainId,
        toTokenAddress: args.toTokenAddress,
        fromAddress: args.fromAddress,
        toAddress: args.toAddress,
      })

      if (!args.forceRefresh) {
        const cached = quoteCache.get(cacheKey)
        if (cached && Date.now() - cached.cachedAtMs < QUOTE_CACHE_TTL_MS) {
          return { route: cached.route, cacheKey, cached: true }
        }
      }

      const routesRequest: RoutesRequest = {
        fromChainId: args.fromToken.chainId,
        fromAmount,
        fromTokenAddress: args.fromToken.address,
        toChainId: args.toChainId,
        toTokenAddress: args.toTokenAddress,
        fromAddress: args.fromAddress,
        toAddress: args.toAddress,
        options: {
          integrator: 'web3-tx-composer',
          order: 'RECOMMENDED',
        },
      }

      const response = await getRoutes(routesRequest)
      const route = response.routes[0] || null
      if (!route) return null

      quoteCache.set(cacheKey, { route, cachedAtMs: Date.now() })
      return { route, cacheKey, cached: false }
    } catch (e) {
      logger.error('LiFi Route Error', e)
      return null
    }
  }

  const executeRoute = async (route: Route) => {
    if (!walletClient.value) {
      throw new Error('No wallet client')
    }

    isExecuting.value = true
    executionStatus.value = 'Preparing transaction...'

    try {
      if (walletClient.value.chain.id !== route.fromChainId) {
        executionStatus.value = `Switching to chain ${route.fromChainId}...`
        await switchChain({ chainId: route.fromChainId })
      }

      executionStatus.value = 'Executing route...'

      await executeLifiRoute(route, {
        updateRouteHook: updatedRoute => {
          const execution = updatedRoute.steps[0]?.execution
          const status = execution?.status
          if (!status) return

          const statusMap: Record<string, string> = {
            PENDING: 'Transaction pending...',
            ACTION_REQUIRED: 'Action required in wallet...',
            CHAIN_SWITCH_REQUIRED: 'Chain switch required...',
            DONE: 'Transaction complete!',
            FAILED: 'Transaction failed',
          }
          executionStatus.value = statusMap[status] || `Status: ${status}`
        },
      })

      executionStatus.value = 'Transaction complete!'
    } catch (e) {
      logger.error('Route execution failed', e)
      executionStatus.value = 'Transaction failed'
      throw e
    } finally {
      isExecuting.value = false
    }
  }

  return {
    // Data
    allTokens,
    filteredTokens,
    selectedTokens,
    isLoadingTokens,
    refetchTokens,

    // Filters
    minUsdValue,
    maxUsdValue,
    selectedChainIds,

    // Selection
    selectedTokenIds,
    toggleToken,
    selectTokens,
    deselectTokens,
    clearSelection,

    // Custom amounts
    customAmounts,
    getCustomAmount,
    setCustomAmount,
    getEffectiveAmount,

    // Default selection percentage (0–100) when clicking an asset
    defaultSelectionPercent,
    setDefaultSelectionPercent: (pct: number) => {
      const clamped = Math.min(100, Math.max(0, pct))
      defaultSelectionPercent.value = Number.isFinite(clamped) ? clamped : 100
    },
    applyDefaultPercentToAllSelected,

    // Quotes + execution
    getRouteQuote,
    executeRoute,
    isExecuting,
    executionStatus,
  }
}
