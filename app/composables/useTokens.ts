import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useConnection, useChainId } from '@wagmi/vue'
import { config } from '~/chains-config'
import { useWatchedAddress } from './useWatchedAddress'
import { ZERION_TO_CHAIN_ID, getChainName } from '~/utils/chains'
import { logger } from '~/utils/logger'
import { handleError } from '~/utils/error-handler'
import type {
  ZerionApiResponse,
  ZerionPosition,
  ZerionIncludedItem,
  ZerionFungibleInfo,
  ZerionImplementation,
} from '~/types/zerion'

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

// Fetch function for TanStack Query
// Now calls our server API endpoint which securely handles the Zerion API key
async function fetchTokenBalances(walletAddress: string): Promise<Token[]> {
  // Get supported chain IDs from our config
  const supportedChainIds = config.chains.map(chain => chain.id)

  // Build query parameters for our server API
  const params = new URLSearchParams({
    address: walletAddress,
  })
  
  // Add chain IDs as query parameters
  supportedChainIds.forEach(chainId => {
    params.append('chainIds', String(chainId))
  })

  // Call our server API endpoint
  const response = await $fetch<ZerionApiResponse>(`/api/zerion/positions?${params.toString()}`, {
    method: 'GET',
  })

  // Handle 202 status (portfolio being prepared)
  if (response.status === 202) {
    return []
  }

  const data = response

  // Debug: Log the response structure (only in development)
  logger.debug('Zerion API Response', {
    data: JSON.stringify(data, null, 2),
    keys: Object.keys(data),
  })

  // Handle Zerion API response structure
  // Response format: { data: [...], included: [...] }
  // Check multiple possible response structures
  let positions: ZerionPosition[] = []
  
  // Try standard JSON:API format
  if (Array.isArray(data.data)) {
    positions = data.data
  }
  
  if (!Array.isArray(positions) || positions.length === 0) {
    logger.debug('Zerion API: No positions found in response', { data })
    return []
  }

  logger.debug('Zerion API: Found positions to process', {
    count: positions.length,
    samplePosition: positions.length > 0 ? positions[0] : undefined,
  })

  // Cache included array for lookups
  const included: ZerionIncludedItem[] = Array.isArray(data.included) ? data.included : []

  // Transform Zerion response to our Token format
  const fetchedTokens: Token[] = positions
    .map((position: ZerionPosition): Token | null => {
      try {
        const attributes = position.attributes || {}
        const quantity = attributes.quantity || {}
        const price = attributes.price
        const value = attributes.value
        
        // Get chain ID from relationships (JSON:API format: relationships.chain.data.id)
        const chainId = position.relationships?.chain?.data?.id
        if (!chainId) {
          logger.warn('Zerion API: Position missing chain ID', { position })
          return null
        }
        
        const numericChainId = ZERION_TO_CHAIN_ID[chainId]
        if (!numericChainId) {
          logger.warn('Zerion API: Unknown chain ID', { chainId })
          return null
        }
        
        // Get fungible info from relationships or attributes
        // Fungible info might be in relationships.fungible.data or included array
        let fungibleInfo: ZerionFungibleInfo = attributes.fungible_info || {}
        
        // If fungible is in relationships, we might need to look it up from included array
        const fungibleRelationship = position.relationships?.fungible
        if (fungibleRelationship?.data) {
          // Try to find fungible info from included array if available
          const fungibleData = included.find((item: ZerionIncludedItem) => 
            item.type === 'fungibles' && 
            item.id === fungibleRelationship.data?.id
          )
          if (fungibleData?.attributes && 'symbol' in fungibleData.attributes) {
            fungibleInfo = fungibleData.attributes as ZerionFungibleInfo
          }
        }
        
        // Extract token information
        const symbol = fungibleInfo.symbol || attributes.name || 'UNKNOWN'
        const name = fungibleInfo.name || attributes.name || symbol
        const decimals = quantity.decimals ?? fungibleInfo.decimals ?? 18
        
        // Handle different quantity formats
        let balanceFloat = 0
        let balanceInt = '0'
        
        if (quantity.float !== undefined && quantity.float !== null) {
          balanceFloat = quantity.float
        } else if (quantity.numeric !== undefined && quantity.numeric !== null) {
          const parsed = parseFloat(quantity.numeric)
          balanceFloat = Number.isNaN(parsed) ? 0 : parsed
        }
        
        if (quantity.int !== undefined && quantity.int !== null) {
          balanceInt = quantity.int
        } else if (quantity.numeric !== undefined && quantity.numeric !== null) {
          balanceInt = quantity.numeric
        }
        
        // Handle price and value
        // Price and value can be direct numbers or objects with float property
        let usdPrice = 0
        if (typeof price === 'number') {
          usdPrice = price
        } else if (price && typeof price === 'object' && 'float' in price && price.float !== undefined && price.float !== null) {
          usdPrice = price.float
        }
        
        let usdValue = 0
        if (typeof value === 'number') {
          usdValue = value
        } else if (value && typeof value === 'object' && 'float' in value && value.float !== undefined && value.float !== null) {
          usdValue = value.float
        } else {
          // Fallback: calculate from balance and price
          usdValue = balanceFloat * usdPrice
        }
        
        // Filter out positions with zero or very small balances
        if (balanceFloat <= 0.000001) {
          return null
        }
        
        // Get token address from implementations or fungible relationship
        // Zerion stores token implementations with chain_id and address
        let address = ''
        
        // Try to get address from implementations
        const implementations: ZerionImplementation[] = fungibleInfo.implementations || []
        const implementation = implementations.find((impl: ZerionImplementation) => impl.chain_id === chainId)
        if (implementation) {
          // Address can be null for native tokens
          address = implementation.address || ''
        }
        
        // If not found, try to extract from fungible relationship
        if (!address && fungibleRelationship?.data) {
          const fungibleData = included.find((item: ZerionIncludedItem) => 
            item.type === 'fungibles' && 
            item.id === fungibleRelationship.data?.id
          )
          if (fungibleData?.attributes && 'implementations' in fungibleData.attributes) {
            const impls = fungibleData.attributes.implementations as ZerionImplementation[]
            if (Array.isArray(impls)) {
              const impl = impls.find((impl: ZerionImplementation) => impl.chain_id === chainId)
              if (impl?.address) {
                address = impl.address
              }
            }
          }
        }
        
        // Check if it's a native token
        // Native tokens have address: null in implementations (like ETH, MATIC, etc.)
        const isNative = !address || 
                        address === '0x0000000000000000000000000000000000000000' || 
                        implementation?.address === null ||
                        fungibleInfo.flags?.is_native === true ||
                        // Native tokens often have position IDs like "base-ethereum-asset-asset" or "base-base-asset-asset"
                        (position.id?.includes('-asset-asset') && !position.id?.match(/^0x[a-fA-F0-9]{40}/))
        
        // Set default address for native tokens
        if (isNative && !address) {
          address = '0x0000000000000000000000000000000000000000'
        }
        
        // Get logo URL from icon (check both fungibleInfo and included fungible data)
        let logoURI: string | undefined = fungibleInfo.icon?.url
        if (!logoURI && fungibleRelationship?.data) {
          const fungibleData = included.find((item: ZerionIncludedItem) => 
            item.type === 'fungibles' && 
            item.id === fungibleRelationship.data?.id
          )
          if (fungibleData?.attributes && 'icon' in fungibleData.attributes) {
            const icon = fungibleData.attributes.icon as { url?: string }
            if (icon?.url) {
              logoURI = icon.url
            }
          }
        }

        return {
          symbol,
          name,
          address,
          decimals,
          balance: balanceInt,
          formattedBalance: balanceFloat.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          }),
          logoURI,
        chainId: numericChainId,
        chainName: getChainName(numericChainId),
          usdPrice,
          usdValue,
          tokenType: isNative ? 'native' : 'erc20',
        } as Token
      } catch (error) {
        logger.error('Error transforming Zerion position', error, { position })
        return null
      }
    })
    .filter((token): token is Token => token !== null)

  logger.debug('Zerion API: Transformed tokens', {
    tokenCount: fetchedTokens.length,
    positionCount: positions.length,
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
    queryFn: async () => {
      if (!effectiveAddress.value) {
        const error = new Error('Wallet address is required')
        handleError(error, {
          message: 'Wallet address is required to fetch token balances',
          context: { effectiveAddress: effectiveAddress.value },
          showNotification: false, // Don't show notification for query errors
        })
        throw error
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
    return getChainName(currentChainId.value)
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
