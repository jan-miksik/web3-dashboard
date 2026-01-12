import { computed, ref, watch, onUnmounted } from 'vue'
import { useConnection } from '@wagmi/vue'
import { useTokens } from '~/composables/useTokens'
import { useWatchedAddress } from '~/composables/useWatchedAddress'
import { CHAIN_METADATA, getChainMetadata, getChainIcon } from '~/utils/chains'
import type { ChainMetadata } from '~/utils/chains'
import { handleError } from '~/utils/error-handler'
import { formatUsdValueParts, formatUsdValueString } from '~/utils/format'

const getAvailableChains = (chainIds: Set<number>): ChainMetadata[] => {
  return CHAIN_METADATA.filter(chain => chainIds.has(chain.id))
}

const sortChainsByValue = (
  chains: ChainMetadata[],
  balances: Record<number, number>
): ChainMetadata[] => {
  return [...chains].sort((a, b) => {
    const diff = (balances[b.id] ?? 0) - (balances[a.id] ?? 0)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}

export function useTokenList() {
  const { tokens, isLoading, error, refetch, isConnected } = useTokens()
  const { watchedAddress } = useWatchedAddress()
  const { address } = useConnection()

  // Show tokens if address exists, is connected, or watching an address
  const hasAddress = computed(() => !!address.value || isConnected.value || !!watchedAddress.value)

  // State
  const showLowValueAssets = ref(false)
  const selectedChainIds = ref<Set<number>>(new Set()) // Empty set = all chains
  const showChainFilter = ref(false)
  const isRefreshing = ref(false)
  const copiedAddress = ref<string | null>(null)
  let copyTimeout: ReturnType<typeof setTimeout> | null = null

  // Utility functions
  function shortenAddress(address: string): string {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  async function copyTokenAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address)
      copiedAddress.value = address

      if (copyTimeout) {
        clearTimeout(copyTimeout)
      }

      copyTimeout = setTimeout(() => {
        copiedAddress.value = null
      }, 2000)
    } catch (error) {
      handleError(error, {
        message: 'Failed to copy address to clipboard',
        context: { address },
        showNotification: true,
      })
    }
  }

  async function handleRefresh() {
    isRefreshing.value = true
    try {
      await refetch()
      await new Promise(resolve => setTimeout(resolve, 500))
    } finally {
      isRefreshing.value = false
    }
  }

  // Computed properties for chains
  const chainBalances = computed<Record<number, number>>(() => {
    const balances: Record<number, number> = {}
    tokens.value.forEach(token => {
      balances[token.chainId] = (balances[token.chainId] || 0) + token.usdValue
    })
    return balances
  })

  const chainsWithAssets = computed(() => {
    const chainIds = new Set(tokens.value.map(t => t.chainId))
    const availableChains = getAvailableChains(chainIds)
    return sortChainsByValue(availableChains, chainBalances.value)
  })

  const chainsWithoutAssets = computed(() => {
    const chainsWithAssetsIds = new Set(tokens.value.map(t => t.chainId))
    const chains = CHAIN_METADATA.filter(chain => !chainsWithAssetsIds.has(chain.id))
    return sortChainsByValue(chains, chainBalances.value)
  })

  // Computed properties for token filtering
  const highValueTokens = computed(() => {
    let result = tokens.value

    if (selectedChainIds.value.size > 0) {
      result = result.filter(token => selectedChainIds.value.has(token.chainId))
    }

    return result.filter(token => token.usdValue >= 5)
  })

  const lowValueTokens = computed(() => {
    let result = tokens.value

    if (selectedChainIds.value.size > 0) {
      result = result.filter(token => selectedChainIds.value.has(token.chainId))
    }

    return result.filter(token => token.usdValue > 0 && token.usdValue < 5)
  })

  const filteredTokens = computed(() => {
    const result = [...highValueTokens.value]

    if (showLowValueAssets.value) {
      result.push(...lowValueTokens.value)
    }

    return result
  })

  const filteredTotalUsdValue = computed(() => {
    return filteredTokens.value.reduce((sum, token) => sum + token.usdValue, 0)
  })

  const hasLowValueAssets = computed(() => {
    return lowValueTokens.value.length > 0
  })

  const hasHighValueAssets = computed(() => {
    return highValueTokens.value.length > 0
  })

  // Auto-show low-value assets if high-value tokens are empty
  watch(
    [tokens, selectedChainIds],
    () => {
      const hasHighValue = tokens.value.some(token => {
        const matchesChain =
          selectedChainIds.value.size === 0 || selectedChainIds.value.has(token.chainId)
        return matchesChain && token.usdValue >= 5
      })
      const hasLowValue = tokens.value.some(token => {
        const matchesChain =
          selectedChainIds.value.size === 0 || selectedChainIds.value.has(token.chainId)
        return matchesChain && token.usdValue > 0 && token.usdValue < 5
      })

      if (!hasHighValue && hasLowValue && !showLowValueAssets.value) {
        showLowValueAssets.value = true
      }
    },
    { immediate: true, deep: true }
  )

  // Chain filter functions
  const selectedChainsDisplay = computed(() => {
    if (selectedChainIds.value.size === 0) {
      return 'All Networks'
    }
    if (selectedChainIds.value.size === 1) {
      const chainId = Array.from(selectedChainIds.value)[0]
      if (chainId !== undefined) {
        return getChainInfo(chainId)?.name || 'Unknown'
      }
      return 'Unknown'
    }
    return `${selectedChainIds.value.size} Networks`
  })

  function toggleChain(chainId: number) {
    if (selectedChainIds.value.has(chainId)) {
      selectedChainIds.value.delete(chainId)
    } else {
      selectedChainIds.value.add(chainId)
    }
    selectedChainIds.value = new Set(selectedChainIds.value)
  }

  function isChainSelected(chainId: number): boolean {
    return selectedChainIds.value.has(chainId)
  }

  function getChainInfo(chainId: number): ChainMetadata | undefined {
    return getChainMetadata(chainId)
  }

  function handleClickAllNetworks() {
    selectedChainIds.value = new Set()
    showChainFilter.value = false
  }

  onUnmounted(() => {
    if (copyTimeout) {
      clearTimeout(copyTimeout)
    }
  })

  // Formatting functions
  function formatBalance(balance: string): string {
    const num = parseFloat(balance.replace(/,/g, ''))
    if (num === 0) return '0'
    return balance
  }

  function formatUsdValue(value: number): string {
    return formatUsdValueString(value)
  }

  function formatUsdValueExpanded(value: number) {
    return formatUsdValueParts(value)
  }

  function formatTotalValue(value: number): string {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return {
    // Data
    tokens,
    isLoading,
    error,
    hasAddress,
    showLowValueAssets,
    selectedChainIds,
    showChainFilter,
    isRefreshing,
    copiedAddress,
    chainBalances,
    chainsWithAssets,
    chainsWithoutAssets,
    highValueTokens,
    lowValueTokens,
    filteredTokens,
    filteredTotalUsdValue,
    hasLowValueAssets,
    hasHighValueAssets,
    selectedChainsDisplay,

    // Actions
    refetch,
    handleRefresh,
    copyTokenAddress,
    toggleChain,
    isChainSelected,
    getChainInfo,
    getChainIcon,
    handleClickAllNetworks,
    shortenAddress,

    // Formatting
    formatBalance,
    formatUsdValue,
    formatUsdValueExpanded,
    formatTotalValue,
  }
}
