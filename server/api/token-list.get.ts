import { getQuery } from 'h3'
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

/**
 * CoinGecko token lists (public CDN).
 * Format: https://tokens.coingecko.com/{asset_platform_id}/all.json
 *
 * NOTE: This is NOT the CoinGecko Pro API; it doesn't require an API key.
 */
const COINGECKO_TOKEN_LIST_ID_BY_CHAIN_ID: Record<number, string> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  137: 'polygon-pos',
  250: 'fantom',
  324: 'zksync-era',
  8453: 'base',
  42161: 'arbitrum-one',
  42220: 'celo',
  43114: 'avalanche',
  100: 'xdai',
}

function getTokenListUrl(chainId: number): string | null {
  const id = COINGECKO_TOKEN_LIST_ID_BY_CHAIN_ID[chainId]
  if (!id) return null
  return `https://tokens.coingecko.com/${id}/all.json`
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const cache = new Map<string, { tokens: TokenListItem[]; timestamp: number }>()

function getCacheKey(chainId: number | null | undefined): string {
  return chainId == null ? 'all' : String(chainId)
}

function isValidTokenListItem(t: unknown): t is TokenListItem {
  if (typeof t !== 'object' || t === null) return false
  const rec = t as Record<string, unknown>
  return (
    typeof rec.chainId === 'number' &&
    typeof rec.address === 'string' &&
    typeof rec.symbol === 'string' &&
    typeof rec.decimals === 'number'
  )
}

function normalizeToken(t: TokenListItem): TokenListItem {
  return {
    chainId: t.chainId,
    address: t.address.toLowerCase(),
    symbol: t.symbol,
    name: t.name || t.symbol,
    decimals: t.decimals,
    logoURI: t.logoURI,
  }
}

export async function handleTokenListRequest(
  fetcher: typeof $fetch = $fetch,
  options: { bypassCache?: boolean; chainId?: number | null } = {}
): Promise<{ tokens: TokenListItem[] }> {
  const now = Date.now()
  const requestedChainId = options.chainId ?? null
  const key = getCacheKey(requestedChainId)

  const cached = cache.get(key)
  if (!options.bypassCache && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { tokens: cached.tokens }
  }

  const chainIds =
    requestedChainId != null
      ? [requestedChainId].filter(id => SUPPORTED_CHAIN_IDS.has(id))
      : [...SUPPORTED_CHAIN_IDS]

  if (requestedChainId != null && chainIds.length === 0) {
    return { tokens: [] }
  }

  const urls = chainIds
    .map(chainId => ({ chainId, url: getTokenListUrl(chainId) }))
    .filter((x): x is { chainId: number; url: string } => x.url !== null)

  const settled = await Promise.allSettled(
    urls.map(async ({ chainId, url }) => {
      const response = await fetcher<TokenListResponse>(url, { timeout: 15_000 })
      const tokens = Array.isArray(response?.tokens) ? response.tokens : []
      return { chainId, tokens }
    })
  )

  const dedupe = new Set<string>()
  const merged: TokenListItem[] = []

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue
    const { chainId, tokens } = res.value

    for (const raw of tokens) {
      if (!isValidTokenListItem(raw)) continue
      if (!SUPPORTED_CHAIN_IDS.has(raw.chainId)) continue
      // Some lists may include other chainIds; only keep items for this list's chain.
      if (raw.chainId !== chainId) continue

      const normalized = normalizeToken(raw)
      const key = `${normalized.chainId}:${normalized.address}`
      if (dedupe.has(key)) continue
      dedupe.add(key)
      merged.push(normalized)
    }
  }

  cache.set(key, { tokens: merged, timestamp: now })
  return { tokens: merged }
}

export default defineEventHandler(async event => {
  const q = getQuery(event)
  const chainIdRaw = q.chainId
  const chainId = typeof chainIdRaw === 'string' && chainIdRaw.trim() ? Number(chainIdRaw) : null

  return await handleTokenListRequest($fetch, {
    chainId: Number.isFinite(chainId) ? chainId : null,
  })
})
