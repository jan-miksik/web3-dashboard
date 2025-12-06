import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useConnection, useChainId } from '@wagmi/vue'
import { config } from '~/chains-config'
import { useWatchedAddress } from './useWatchedAddress'

// Token type definition
export interface Token {
  symbol: string
  name: string
  address: string
  decimals: number
  balance: string
  formattedBalance: string
  logoURI?: string
  chainId: number
  chainName: string
  usdPrice: number
  usdValue: number
  tokenType: 'native' | 'erc20'
}

// Chain ID to Ankr blockchain name mapping
const CHAIN_TO_ANKR: Record<number, string> = {
  1: 'eth',
  137: 'polygon',
  42161: 'arbitrum',
  8453: 'base',
  10: 'optimism',
  43114: 'avalanche',
  56: 'bsc',
  250: 'fantom',
}

// Chain names for display
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  10: 'Optimism',
  43114: 'Avalanche',
  56: 'BSC',
  250: 'Fantom',
  11155111: 'Sepolia',
  80002: 'Polygon Amoy',
  421614: 'Arbitrum Sepolia',
  84532: 'Base Sepolia',
}

// Ankr blockchain name to chain ID mapping
const ANKR_TO_CHAIN_ID: Record<string, number> = {
  'eth': 1,
  'polygon': 137,
  'arbitrum': 42161,
  'base': 8453,
  'optimism': 10,
  'avalanche': 43114,
  'bsc': 56,
  'fantom': 250,
}

// Ankr API for multi-chain token balances
// Get your free API key at https://www.ankr.com/rpc/
const getAnkrApiUrl = () => {
  const runtimeConfig = useRuntimeConfig()
  const apiKey = runtimeConfig.public.ankrApiKey as string
  if (apiKey) {
    return `https://rpc.ankr.com/multichain/${apiKey}`
  }
  // Fallback to public endpoint (limited functionality)
  return 'https://rpc.ankr.com/multichain'
}

// Fetch function for TanStack Query
async function fetchTokenBalances(walletAddress: string): Promise<Token[]> {
  // Get supported blockchains for the API call
  const blockchains = Object.values(CHAIN_TO_ANKR)
  const apiUrl = getAnkrApiUrl()

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'ankr_getAccountBalance',
      params: {
        walletAddress,
        blockchain: blockchains,
        onlyWhitelisted: false,
        pageSize: 100,
      },
      id: 1,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch token balances')
  }

  if (!data.result?.assets || !Array.isArray(data.result.assets)) {
    return []
  }

  // Transform Ankr response to our Token format
  const fetchedTokens: Token[] = data.result.assets
    .filter((asset: any) => {
      // Filter out tokens with zero or very small balances
      const balance = parseFloat(asset.balance || '0')
      return balance > 0
    })
    .map((asset: any) => {
      const chainId = ANKR_TO_CHAIN_ID[asset.blockchain] || 1
      const balanceNum = parseFloat(asset.balance || '0')
      const usdPrice = parseFloat(asset.tokenPrice || '0')
      const usdValue = parseFloat(asset.balanceUsd || '0')

      return {
        symbol: asset.tokenSymbol || 'UNKNOWN',
        name: asset.tokenName || asset.tokenSymbol || 'Unknown Token',
        address: asset.contractAddress || '0x0000000000000000000000000000000000000000',
        decimals: asset.tokenDecimals || 18,
        balance: asset.balanceRawInteger || '0',
        formattedBalance: balanceNum.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 6,
        }),
        logoURI: asset.thumbnail || undefined,
        chainId,
        chainName: CHAIN_NAMES[chainId] || asset.blockchain,
        usdPrice,
        usdValue,
        tokenType: asset.tokenType === 'NATIVE' ? 'native' : 'erc20',
      } as Token
    })

  return fetchedTokens
}

export function useTokens() {
  const { address, isConnected } = useConnection({ config })
  const currentChainId = useChainId({ config })
  const { watchedAddress } = useWatchedAddress()
  
  // Use watched address if available, otherwise use connected wallet address
  const effectiveAddress = computed(() => {
    if (isConnected.value && address.value) {
      return address.value
    }
    return watchedAddress.value
  })
  
  // Use TanStack Query for fetching and caching
  const {
    data: tokensData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['tokenBalances', effectiveAddress],
    queryFn: () => {
      if (!effectiveAddress.value) {
        throw new Error('Wallet address is required')
      }
      return fetchTokenBalances(effectiveAddress.value)
    },
    enabled: computed(() => !!effectiveAddress.value),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  })

  const tokens = computed(() => (tokensData.value as Token[]) || [])

  const networkName = computed(() => {
    if (!currentChainId.value) return 'Unknown'
    return CHAIN_NAMES[currentChainId.value] || `Chain ${currentChainId.value}`
  })

  // Sorted tokens by USD value (descending), with connected chain tokens first for same value
  const sortedTokens = computed(() => {
    const connectedChain = currentChainId.value
    return [...tokens.value].sort((a, b) => {
      // First sort by USD value (descending)
      if (b.usdValue !== a.usdValue) {
        return b.usdValue - a.usdValue
      }
      // If same value, prioritize connected chain
      if (a.chainId === connectedChain && b.chainId !== connectedChain) return -1
      if (b.chainId === connectedChain && a.chainId !== connectedChain) return 1
      return 0
    })
  })

  // Total portfolio value
  const totalUsdValue = computed(() => {
    return tokens.value.reduce((sum: number, token: Token) => sum + token.usdValue, 0)
  })

  // Tokens grouped by chain
  const tokensByChain = computed(() => {
    const grouped: Record<number, Token[]> = {}
    for (const token of tokens.value) {
      if (!grouped[token.chainId]) {
        grouped[token.chainId] = []
      }
      grouped[token.chainId]!.push(token)
    }
    return grouped
  })

  // Transform query error to string
  const error = computed(() => {
    if (!queryError.value) return null
    if (queryError.value instanceof Error) {
      return queryError.value.message
    }
    return 'Failed to fetch token balances'
  })

  return {
    tokens: sortedTokens,
    allTokens: tokens,
    tokensByChain,
    isLoading,
    error,
    refetch,
    networkName,
    isConnected,
    totalUsdValue,
    currentChainId,
  }
}
