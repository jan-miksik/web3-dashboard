import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useTokens } from '../../../app/composables/useTokens'
import { useQuery } from '@tanstack/vue-query'
import { useConnection } from '@wagmi/vue'
import { useWatchedAddress } from '../../../app/composables/useWatchedAddress'

// Mock dependencies
vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@wagmi/vue', () => ({
  useConnection: vi.fn(() => ({
    address: { value: null },
    isConnected: { value: false },
  })),
  useChainId: vi.fn(() => ({ value: 1 })),
}))

vi.mock('../../../app/chains-config', () => ({
  config: {
    chains: [{ id: 1 }, { id: 137 }],
  },
}))

vi.mock('../../../app/composables/useWatchedAddress', () => ({
  useWatchedAddress: vi.fn(() => ({
    watchedAddress: { value: null },
  })),
}))

vi.mock('../../../app/utils/chains', () => ({
  ZERION_TO_CHAIN_ID: {
    ethereum: 1,
    polygon: 137,
  },
  getChainName: vi.fn((chainId: number) => {
    const names: Record<number, string> = {
      1: 'Ethereum',
      137: 'Polygon',
    }
    return names[chainId] || `Chain ${chainId}`
  }),
}))

// Mock $fetch - Nuxt auto-import that needs to be mocked for tests
// Use vi.stubGlobal to avoid circular type reference issues
const mockFetchFn = vi.fn()
const mockFetch = Object.assign(mockFetchFn, {
  raw: vi.fn(),
  create: vi.fn(),
})
vi.stubGlobal('$fetch', mockFetch)

describe('useTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return default values when no address is available', () => {
    vi.mocked(useConnection).mockReturnValue({
      address: ref(null),
      isConnected: ref(false),
    } as unknown as ReturnType<typeof useConnection>)

    vi.mocked(useWatchedAddress).mockReturnValue({
      watchedAddress: computed(() => null),
      setWatchedAddress: vi.fn(),
      clearWatchedAddress: vi.fn(),
      isValidAddress: vi.fn(),
      isWatchMode: computed(() => false),
    } as unknown as ReturnType<typeof useWatchedAddress>)

    vi.mocked(useQuery).mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const result = useTokens()

    expect(result.tokens.value).toEqual([])
    expect(result.isLoading.value).toBe(false)
    expect(result.isConnected.value).toBe(false)
    expect(result.totalUsdValue.value).toBe(0)
  })

  it('should use connected wallet address when available', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890'

    vi.mocked(useConnection).mockReturnValue({
      address: ref(walletAddress),
      isConnected: ref(true),
    } as unknown as ReturnType<typeof useConnection>)

    vi.mocked(useWatchedAddress).mockReturnValue({
      watchedAddress: computed(() => null),
      setWatchedAddress: vi.fn(),
      clearWatchedAddress: vi.fn(),
      isValidAddress: vi.fn(),
      isWatchMode: computed(() => false),
    } as unknown as ReturnType<typeof useWatchedAddress>)

    vi.mocked(useQuery).mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const result = useTokens()

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['tokenBalances', expect.any(Object)],
        enabled: expect.any(Object),
      })
    )
    expect(result.isConnected.value).toBe(true)
  })

  it('should use watched address when wallet is not connected', () => {
    const watchedAddress = '0x9876543210987654321098765432109876543210'

    vi.mocked(useConnection).mockReturnValue({
      address: ref(null),
      isConnected: ref(false),
    } as unknown as ReturnType<typeof useConnection>)

    vi.mocked(useWatchedAddress).mockReturnValue({
      watchedAddress: computed(() => watchedAddress),
      setWatchedAddress: vi.fn(),
      clearWatchedAddress: vi.fn(),
      isValidAddress: vi.fn(),
      isWatchMode: computed(() => true),
    } as unknown as ReturnType<typeof useWatchedAddress>)

    vi.mocked(useQuery).mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    useTokens()

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['tokenBalances', expect.any(Object)],
        enabled: expect.any(Object),
      })
    )
  })

  it('should calculate total USD value correctly', () => {
    const mockTokens = [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        balance: '1000000000000000000',
        formattedBalance: '1',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 2000,
        usdValue: 2000,
        tokenType: 'native' as const,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
        balance: '5000000',
        formattedBalance: '5',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 1,
        usdValue: 5,
        tokenType: 'erc20' as const,
      },
    ]

    vi.mocked(useConnection).mockReturnValue({
      address: ref('0x1234567890123456789012345678901234567890'),
      isConnected: ref(true),
    } as unknown as ReturnType<typeof useConnection>)

    vi.mocked(useWatchedAddress).mockReturnValue({
      watchedAddress: computed(() => null),
      setWatchedAddress: vi.fn(),
      clearWatchedAddress: vi.fn(),
      isValidAddress: vi.fn(),
      isWatchMode: computed(() => false),
    } as unknown as ReturnType<typeof useWatchedAddress>)

    vi.mocked(useQuery).mockReturnValue({
      data: ref(mockTokens),
      isLoading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const result = useTokens()

    expect(result.totalUsdValue.value).toBe(2005)
    expect(result.tokens.value).toHaveLength(2)
  })

  it('should handle errors correctly', () => {
    const errorMessage = 'Failed to fetch token balances'

    vi.mocked(useConnection).mockReturnValue({
      address: ref('0x1234567890123456789012345678901234567890'),
      isConnected: ref(true),
    } as unknown as ReturnType<typeof useConnection>)

    vi.mocked(useWatchedAddress).mockReturnValue({
      watchedAddress: computed(() => null),
      setWatchedAddress: vi.fn(),
      clearWatchedAddress: vi.fn(),
      isValidAddress: vi.fn(),
      isWatchMode: computed(() => false),
    } as unknown as ReturnType<typeof useWatchedAddress>)

    vi.mocked(useQuery).mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      error: ref(new Error(errorMessage)),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>)

    const result = useTokens()

    expect(result.error.value).toBe(errorMessage)
  })
})
