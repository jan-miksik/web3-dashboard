import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chain metadata used by the handler at module-eval time
vi.mock('~/utils/chains', () => ({
  CHAIN_METADATA: [
    { id: 1, name: 'Ethereum', zerionId: 'ethereum', color: '#000', bgColor: '#000' },
    { id: 8453, name: 'Base', zerionId: 'base', color: '#000', bgColor: '#000' },
  ],
}))

// Mock defineEventHandler (Nuxt auto-import)
global.defineEventHandler = vi.fn(<T extends (...args: any[]) => any>(handler: T): T => handler)

// Mock $fetch (Nuxt auto-import)
const mockFetchFn = vi.fn()
const mockFetch = Object.assign(mockFetchFn, {
  raw: vi.fn(),
  create: vi.fn(),
})
vi.stubGlobal('$fetch', mockFetch)

describe('server/api/token-list.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('merges per-chain CoinGecko lists (including Base tokens with logoURI)', async () => {
    const { handleTokenListRequest } = await import('../../../../server/api/token-list.get')

    vi.mocked(mockFetchFn).mockImplementation(async (url: string) => {
      if (url.includes('/ethereum/all.json')) {
        return {
          tokens: [
            {
              chainId: 1,
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 6,
              logoURI: 'https://example.com/usdc.png',
            },
          ],
        }
      }
      if (url.includes('/base/all.json')) {
        return {
          tokens: [
            {
              chainId: 8453,
              address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
              symbol: 'cbBTC',
              name: 'Coinbase Wrapped BTC',
              decimals: 8,
              logoURI: 'https://example.com/cbbtc.png',
            },
          ],
        }
      }
      throw new Error(`Unexpected URL in test: ${url}`)
    })

    const res = await handleTokenListRequest(mockFetch as any, { bypassCache: true })
    expect(res.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chainId: 1,
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          logoURI: 'https://example.com/usdc.png',
        }),
        expect.objectContaining({
          chainId: 8453,
          address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
          symbol: 'cbBTC',
          name: 'Coinbase Wrapped BTC',
          decimals: 8,
          logoURI: 'https://example.com/cbbtc.png',
        }),
      ])
    )

    // Called once per supported chain
    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/ethereum/all.json'),
      expect.any(Object)
    )
    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/base/all.json'),
      expect.any(Object)
    )
  })

  it('returns partial results if one chain list fetch fails', async () => {
    const { handleTokenListRequest } = await import('../../../../server/api/token-list.get')

    vi.mocked(mockFetchFn).mockImplementation(async (url: string) => {
      if (url.includes('/ethereum/all.json')) {
        return {
          tokens: [
            {
              chainId: 1,
              address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              symbol: 'WETH',
              name: 'Wrapped Ether',
              decimals: 18,
              logoURI: 'https://example.com/weth.png',
            },
          ],
        }
      }
      if (url.includes('/base/all.json')) {
        throw new Error('network down')
      }
      throw new Error(`Unexpected URL in test: ${url}`)
    })

    const res = await handleTokenListRequest(mockFetch as any, { bypassCache: true })
    expect(res.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chainId: 1,
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          symbol: 'WETH',
        }),
      ])
    )
  })
})
