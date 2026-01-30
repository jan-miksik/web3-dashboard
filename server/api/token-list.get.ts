import { CHAIN_METADATA } from '~/utils/chains'

/** Token list item from external list (Uniswap/CoinGecko format) */
interface TokenListItem {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

interface TokenListResponse {
  name?: string
  logoURI?: string
  tokens: TokenListItem[]
}

const SUPPORTED_CHAIN_IDS = new Set(CHAIN_METADATA.map(c => c.id))

/** CoinGecko token list - multi-chain, includes logos */
const TOKEN_LIST_URL = 'https://tokens.coingecko.com/uniswap/all.json'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
let cached: { tokens: TokenListItem[]; timestamp: number } | null = null

export default defineEventHandler(async (): Promise<{ tokens: TokenListItem[] }> => {
  const now = Date.now()
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { tokens: cached.tokens }
  }

  const response = await $fetch<TokenListResponse>(TOKEN_LIST_URL, {
    timeout: 15_000,
  }).catch(() => null)

  if (!response?.tokens || !Array.isArray(response.tokens)) {
    if (cached) return { tokens: cached.tokens }
    return { tokens: [] }
  }

  const filtered = response.tokens.filter(
    t =>
      SUPPORTED_CHAIN_IDS.has(t.chainId) && t.address && t.symbol && typeof t.decimals === 'number'
  )

  cached = { tokens: filtered, timestamp: now }
  return { tokens: cached.tokens }
})
