import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import WalletInfo from '../../../app/components/WalletInfo.vue'
import { useConnection } from '@wagmi/vue'
import type { useWatchedAddress as _useWatchedAddress } from '../../../app/composables/useWatchedAddress'
import type { useTokens as _useTokens } from '../../../app/composables/useTokens'

// Mock @wagmi/vue (hoisted to avoid initialization errors)
const { mockUseConnection, mockUseChainId, mockUseConfig, mockUseBytecode } = vi.hoisted(() => ({
  mockUseConnection: vi.fn(),
  mockUseChainId: vi.fn(),
  mockUseConfig: vi.fn(),
  mockUseBytecode: vi.fn(),
}))

vi.mock('@wagmi/vue', () => {
  // Minimal mock implementation to satisfy usages in `utils/wagmi.ts`
  const createConfig = vi.fn((config: unknown) => config)
  const http = vi.fn()

  return {
    useConnection: mockUseConnection,
    useChainId: mockUseChainId,
    useConfig: mockUseConfig,
    useBytecode: mockUseBytecode,
    createConfig,
    http,
  }
})

// Mock @reown/appkit/vue
const { mockUseAppKit } = vi.hoisted(() => ({
  mockUseAppKit: vi.fn(),
}))
vi.mock('@reown/appkit/vue', () => ({
  useAppKit: mockUseAppKit,
}))

// Mock useTokens to avoid requiring VueQueryPlugin / queryClient in this unit test
const { mockUseTokens } = vi.hoisted(() => ({
  mockUseTokens: vi.fn(),
}))

vi.mock('../../../app/composables/useTokens', () => ({
  useTokens: mockUseTokens as unknown as typeof _useTokens,
}))

// Mock useWatchedAddress
const mockClearWatchedAddress = vi.fn()
const mockWatchedAddress = ref<string | null>(null)

vi.mock('../../../app/composables/useWatchedAddress', () => ({
  useWatchedAddress: vi.fn(() => ({
    watchedAddress: computed(() => mockWatchedAddress.value),
    clearWatchedAddress: mockClearWatchedAddress,
  })),
}))

// Mock error-handler
vi.mock('../../../app/utils/error-handler', () => ({
  handleError: vi.fn(),
}))

describe('WalletInfo', () => {
  const mountWalletInfo = () =>
    mount(WalletInfo, {
      global: {
        stubs: {
          // Avoid requiring AppKit initialization in unit tests.
          ConnectButton: { template: '<div data-testid="connect-button-stub" />' },
        },
      },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockWatchedAddress.value = null

    mockUseChainId.mockReturnValue(ref(1))
    mockUseConfig.mockReturnValue({} as unknown)
    mockUseBytecode.mockReturnValue({
      data: ref('0x'),
      isLoading: ref(false),
      isError: ref(false),
    })
    mockUseTokens.mockReturnValue({
      totalUsdValue: ref(0),
      isLoading: ref(false),
    } as unknown as ReturnType<typeof _useTokens>)
    // Mock AppKit - no embeddedWalletInfo by default (will fallback to bytecode check)
    mockUseAppKit.mockReturnValue({
      embeddedWalletInfo: ref(null),
    })

    // Mock clipboard API
    vi.stubGlobal('navigator', navigator)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
    })
  })

  it('should render disconnected state when no wallet connected and no watched address', () => {
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountWalletInfo()

    expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('Disconnected')
    expect(wrapper.find('[data-testid="wallet-details"]').exists()).toBe(false)
  })

  it('should render connected state with address', async () => {
    const address = '0x1234567890123456789012345678901234567890'
    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref(address),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountWalletInfo()
    await flushPromises()

    expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('Connected')
    expect(wrapper.find('[data-testid="wallet-details"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="address-full"]').text()).toBe(address)
    expect(wrapper.find('[data-testid="address-short"]').text()).toContain('0x1234')
  })

  it('should render watch mode when watched address is set', async () => {
    const watchedAddr = '0x9876543210987654321098765432109876543210'
    mockWatchedAddress.value = watchedAddr
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountWalletInfo()
    await flushPromises()

    expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('Watch Mode')
    expect(wrapper.find('[data-testid="wallet-details"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="address-full"]').text()).toBe(watchedAddr)
  })

  it('should copy address to clipboard when copy button is clicked', async () => {
    const address = '0x1234567890123456789012345678901234567890'
    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref(address),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountWalletInfo()
    await flushPromises()

    const copyButton = wrapper.find('[data-testid="copy-address-btn"]')
    await copyButton.trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address)
    expect(wrapper.find('.copy-btn.copied').exists()).toBe(true)
  })

  it('should handle copy error gracefully', async () => {
    const address = '0x1234567890123456789012345678901234567890'
    const copyError = new Error('Clipboard write failed')
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(copyError)

    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref(address),
    } as unknown as ReturnType<typeof useConnection>)

    const { handleError } = await import('../../../app/utils/error-handler')
    const wrapper = mountWalletInfo()
    await flushPromises()

    const copyButton = wrapper.find('[data-testid="copy-address-btn"]')
    await copyButton.trigger('click')

    expect(handleError).toHaveBeenCalled()
  })

  it('should show short address format correctly', async () => {
    const address = '0x1234567890123456789012345678901234567890'
    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref(address),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountWalletInfo()
    await flushPromises()

    const shortAddress = wrapper.find('[data-testid="address-short"]').text()
    expect(shortAddress).toBe('0x1234...7890')
  })
})
