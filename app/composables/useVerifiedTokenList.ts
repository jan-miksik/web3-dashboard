import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { Address } from 'viem'

/** Token from verified list (Uniswap/CoinGecko token list format) */
export interface VerifiedTokenListItem {
  chainId: number
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export interface UseVerifiedTokenListOptions {
  /** If set, only tokens for this chain are returned (can be ref/computed) */
  chainId?: MaybeRefOrGetter<number | null | undefined>
}

async function fetchVerifiedTokenList(): Promise<VerifiedTokenListItem[]> {
  const response = await $fetch<{ tokens: Array<Record<string, unknown>> }>('/api/token-list', {
    method: 'GET',
  })
  if (!response?.tokens || !Array.isArray(response.tokens)) {
    return []
  }
  return response.tokens
    .filter(
      t =>
        typeof t.chainId === 'number' &&
        typeof t.address === 'string' &&
        typeof t.symbol === 'string' &&
        typeof t.decimals === 'number'
    )
    .map(t => ({
      chainId: t.chainId as number,
      address: (t.address as string).toLowerCase() as Address,
      symbol: String(t.symbol),
      name: String(t.name ?? t.symbol),
      decimals: Number(t.decimals),
      logoURI: typeof t.logoURI === 'string' ? t.logoURI : undefined,
    }))
}

/**
 * Fetches the verified token list (CoinGecko/Uniswap token list) with logos.
 * Use for token selector and anywhere you need a curated list of tokens with images.
 */
export function useVerifiedTokenList(options: UseVerifiedTokenListOptions = {}) {
  const chainIdGetter = options.chainId

  const {
    data: allTokens,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['verifiedTokenList'],
    queryFn: fetchVerifiedTokenList,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 60 * 60 * 1000 * 2, // 2 hours
  })

  const tokens = computed(() => {
    const list = allTokens.value ?? []
    const chain = chainIdGetter != null ? toValue(chainIdGetter) : undefined
    if (chain != null) {
      return list.filter(t => t.chainId === chain)
    }
    return list
  })

  return {
    tokens,
    isLoading,
    error,
    refetch,
  }
}
