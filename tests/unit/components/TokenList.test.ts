import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import TokenList from '../../../app/components/TokenList.vue'

const mockTokens = ref<any[]>([])
const mockIsLoading = ref(false)
const mockError = ref<unknown>(null)
const mockIsConnected = ref(true)
const mockTotalUsdValue = ref(0)
const mockRefetch = vi.fn()

vi.mock('../../../app/composables/useTokens', () => ({
  useTokens: vi.fn(() => ({
    tokens: computed(() => mockTokens.value),
    allTokens: computed(() => mockTokens.value),
    tokensByChain: computed(() => ({})),
    isLoading: mockIsLoading,
    error: mockError,
    refetch: mockRefetch,
    networkName: ref('Ethereum'),
    isConnected: mockIsConnected,
    totalUsdValue: mockTotalUsdValue,
    currentChainId: ref(1),
  })),
}))

vi.mock('../../../app/composables/useWatchedAddress', () => ({
  useWatchedAddress: vi.fn(() => ({
    watchedAddress: ref(null),
  })),
}))

vi.mock('../../../app/utils/chains', () => ({
  CHAIN_METADATA: [
    { id: 1, name: 'Ethereum' },
    { id: 137, name: 'Polygon' },
  ],
  getChainMetadata: (id: number) => {
    const map: Record<number, { id: number; name: string; icon?: string }> = {
      1: { id: 1, name: 'Ethereum' },
      137: { id: 137, name: 'Polygon' },
    }
    return map[id]
  },
  getChainIcon: vi.fn(() => null),
  getChainName: vi.fn((id: number) => (id === 1 ? 'Ethereum' : 'Polygon')),
}))

describe('TokenList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTokens.value = []
    mockIsLoading.value = false
    mockError.value = null
    mockIsConnected.value = true
    mockTotalUsdValue.value = 0
    vi.stubGlobal('navigator', navigator)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders loading state when fetching tokens', () => {
    mockIsLoading.value = true
    mockTokens.value = []

    const wrapper = mount(TokenList)
    expect(wrapper.find('[data-testid="loading-state"]').exists()).toBe(true)
  })

  it('renders empty state when no tokens are available', () => {
    mockIsLoading.value = false
    mockTokens.value = []

    const wrapper = mount(TokenList)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('renders token rows and copies address', async () => {
    const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    mockTokens.value = [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: tokenAddress,
        decimals: 6,
        formattedBalance: '5.00',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 1,
        usdValue: 5,
        tokenType: 'erc20',
        logoURI: null,
      },
    ]
    mockTotalUsdValue.value = 5

    const wrapper = mount(TokenList)
    expect(wrapper.findAll('[data-testid="token-row"]').length).toBe(1)

    const copyBtn = wrapper.find('[data-testid="copy-token-address-btn"]')
    await copyBtn.trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(tokenAddress)
    expect(copyBtn.classes()).toContain('copied')
  })

  it('shows and hides low-value assets when toggled', async () => {
    mockTokens.value = [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        formattedBalance: '1',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 2000,
        usdValue: 2000,
        tokenType: 'native',
        logoURI: null,
      },
      {
        symbol: 'DUST',
        name: 'Dust',
        address: '0x1111111111111111111111111111111111111111',
        decimals: 18,
        formattedBalance: '0.5',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 1,
        usdValue: 0.5,
        tokenType: 'erc20',
        logoURI: null,
      },
    ]

    const wrapper = mount(TokenList)

    expect(wrapper.find('[data-testid="show-low-value-btn"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="token-row"]').length).toBe(1) // only high-value visible

    await wrapper.find('[data-testid="show-low-value-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="hide-low-value-btn"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="token-row"]').length).toBe(2)

    await wrapper.find('[data-testid="hide-low-value-btn"]').trigger('click')
    expect(wrapper.findAll('[data-testid="token-row"]').length).toBe(1)
  })

  it('calls refetch when refresh is clicked and respects loading disabled state', async () => {
    const wrapper = mount(TokenList)

    const refreshBtn = wrapper.find('[data-testid="refresh-btn"]')
    expect(refreshBtn.attributes('disabled')).toBeUndefined()

    await refreshBtn.trigger('click')
    expect(mockRefetch).toHaveBeenCalled()

    mockIsLoading.value = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="refresh-btn"]').attributes('disabled')).toBeDefined()
  })

  it('does not show hide button when there are no high-value assets', async () => {
    // Only low-value assets (no assets >= $5)
    mockTokens.value = [
      {
        symbol: 'DUST1',
        name: 'Dust Token 1',
        address: '0x1111111111111111111111111111111111111111',
        decimals: 18,
        formattedBalance: '1',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 1,
        usdValue: 1,
        tokenType: 'erc20',
        logoURI: null,
      },
      {
        symbol: 'DUST2',
        name: 'Dust Token 2',
        address: '0x2222222222222222222222222222222222222222',
        decimals: 18,
        formattedBalance: '2',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 1,
        usdValue: 2,
        tokenType: 'erc20',
        logoURI: null,
      },
    ]

    const wrapper = mount(TokenList)

    // Low-value assets should be auto-shown (no high-value assets)
    // But hide button should NOT be visible since there are no high-value assets
    expect(wrapper.find('[data-testid="hide-low-value-btn"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="token-row"]').length).toBe(2) // both low-value tokens visible
  })

  it('shows hide button only when there are high-value assets', async () => {
    // Mix of high-value and low-value assets
    mockTokens.value = [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        formattedBalance: '1',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 2000,
        usdValue: 2000,
        tokenType: 'native',
        logoURI: null,
      },
      {
        symbol: 'DUST',
        name: 'Dust',
        address: '0x1111111111111111111111111111111111111111',
        decimals: 18,
        formattedBalance: '0.5',
        chainId: 1,
        chainName: 'Ethereum',
        usdPrice: 1,
        usdValue: 0.5,
        tokenType: 'erc20',
        logoURI: null,
      },
    ]

    const wrapper = mount(TokenList)

    // Show low-value assets
    await wrapper.find('[data-testid="show-low-value-btn"]').trigger('click')

    // Hide button should be visible because there are high-value assets
    expect(wrapper.find('[data-testid="hide-low-value-btn"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="token-row"]').length).toBe(2)
  })
})
