import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import WalletInfo from '../../../app/components/WalletInfo.vue'
import { useConnection } from '@wagmi/vue'
import { useWatchedAddress } from '../../../app/composables/useWatchedAddress'

// Mock @wagmi/vue (hoisted to avoid initialization errors)
const { mockUseConnection } = vi.hoisted(() => ({
  mockUseConnection: vi.fn(),
}))
vi.mock('@wagmi/vue', () => ({
  useConnection: mockUseConnection,
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

// Mock chains-config
vi.mock('../../../app/chains-config', () => ({
  config: {
    chains: [],
  },
}))

// Mock error-handler
vi.mock('../../../app/utils/error-handler', () => ({
  handleError: vi.fn(),
}))

describe('WalletInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWatchedAddress.value = null
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

    const wrapper = mount(WalletInfo)
    
    expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('Disconnected')
    expect(wrapper.find('[data-testid="wallet-details"]').exists()).toBe(false)
  })

  it('should render connected state with address', async () => {
    const address = '0x1234567890123456789012345678901234567890'
    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref(address),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mount(WalletInfo)
    await wrapper.vm.$nextTick()
    
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

    const wrapper = mount(WalletInfo)
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('Watch Mode')
    expect(wrapper.find('[data-testid="wallet-details"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="address-full"]').text()).toBe(watchedAddr)
    expect(wrapper.find('[data-testid="watch-mode-actions"]').exists()).toBe(true)
  })

  it('should copy address to clipboard when copy button is clicked', async () => {
    const address = '0x1234567890123456789012345678901234567890'
    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref(address),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mount(WalletInfo)
    await wrapper.vm.$nextTick()
    
    const copyButton = wrapper.find('[data-testid="copy-address-btn"]')
    await copyButton.trigger('click')
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address)
    expect(wrapper.find('.copy-btn.copied').exists()).toBe(true)
  })

  it('should clear watched address when stop watching is clicked', async () => {
    mockWatchedAddress.value = '0x9876543210987654321098765432109876543210'
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mount(WalletInfo)
    await wrapper.vm.$nextTick()
    
    const clearButton = wrapper.find('[data-testid="clear-watch-btn"]')
    await clearButton.trigger('click')
    
    expect(mockClearWatchedAddress).toHaveBeenCalled()
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
    const wrapper = mount(WalletInfo)
    await wrapper.vm.$nextTick()
    
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

    const wrapper = mount(WalletInfo)
    await wrapper.vm.$nextTick()
    
    const shortAddress = wrapper.find('[data-testid="address-short"]').text()
    expect(shortAddress).toBe('0x1234...7890')
  })
})

