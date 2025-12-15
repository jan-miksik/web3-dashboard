import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import ConnectWalletModal from '../../../app/components/ConnectWalletModal.vue'
import { useConnection } from '@wagmi/vue'
import type { useWatchedAddress as _useWatchedAddress } from '../../../app/composables/useWatchedAddress'

// Mock @wagmi/vue (hoisted to avoid initialization errors)
const { mockUseConnection } = vi.hoisted(() => ({
  mockUseConnection: vi.fn(),
}))
vi.mock('@wagmi/vue', () => ({
  useConnection: mockUseConnection,
}))

// Mock useWatchedAddress
const mockSetWatchedAddress = vi.fn()
const mockClearWatchedAddress = vi.fn()
const mockIsValidAddress = vi.fn()
const mockWatchedAddress = ref<string | null>(null)

vi.mock('../../../app/composables/useWatchedAddress', () => ({
  useWatchedAddress: vi.fn(() => ({
    watchedAddress: computed(() => mockWatchedAddress.value),
    setWatchedAddress: mockSetWatchedAddress,
    clearWatchedAddress: mockClearWatchedAddress,
    isValidAddress: mockIsValidAddress,
  })),
}))

// Mock ConnectButton component
vi.mock('../../../app/components/ConnectButton.vue', () => ({
  default: {
    name: 'ConnectButton',
    template: '<button data-testid="connect-button">Connect Wallet</button>',
  },
}))

const mountModal = () =>
  mount(ConnectWalletModal, {
    global: {
      stubs: {
        Teleport: true,
      },
    },
  })

describe('ConnectWalletModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWatchedAddress.value = null
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as ReturnType<typeof useConnection>)
    mockIsValidAddress.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllTimers()
  })

  it('should show modal when wallet is not connected and no watched address', () => {
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="modal-overlay"]').exists()).toBe(true)
  })

  it('should hide modal when wallet is connected', () => {
    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref('0x1234567890123456789012345678901234567890'),
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="modal-overlay"]').exists()).toBe(false)
  })

  it('should hide modal when watched address is set', () => {
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as ReturnType<typeof useConnection>)
    mockWatchedAddress.value = '0x1234567890123456789012345678901234567890'

    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="modal-overlay"]').exists()).toBe(false)
  })

  it('should clear watched address when wallet connects', async () => {
    const isConnectedRef = ref(false)
    const addressRef = ref<string | null>(null)
    mockUseConnection.mockReturnValue({
      isConnected: isConnectedRef,
      address: addressRef,
    } as unknown as ReturnType<typeof useConnection>)

    const wrapper = mountModal()

    // Simulate wallet connection
    isConnectedRef.value = true
    await wrapper.vm.$nextTick()

    expect(mockClearWatchedAddress).toHaveBeenCalled()
  })

  it('should handle address input and auto-watch valid address', async () => {
    vi.useFakeTimers()
    mockIsValidAddress.mockReturnValue(true)

    const wrapper = mountModal()
    const input = wrapper.find('[data-testid="address-input"]')

    await input.setValue('0x1234567890123456789012345678901234567890')
    await input.trigger('input')

    // Advance timers to trigger debounced auto-watch (500ms delay)
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()

    expect(mockSetWatchedAddress).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890')
  })

  it('should show error for invalid address input', async () => {
    mockIsValidAddress.mockReturnValue(false)

    const wrapper = mountModal()
    const input = wrapper.find('[data-testid="address-input"]')

    await input.setValue('invalid-address')
    await input.trigger('input')

    expect(wrapper.find('[data-testid="address-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="address-error"]').text()).toContain(
      'Invalid Ethereum address format'
    )
  })

  it('should handle watch address submission', async () => {
    mockIsValidAddress.mockReturnValue(true)

    const wrapper = mountModal()
    const input = wrapper.find('[data-testid="address-input"]')

    await input.setValue('0x1234567890123456789012345678901234567890')
    await input.trigger('keyup.enter')

    expect(mockSetWatchedAddress).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890')
  })

  it('should show error when submitting empty address', async () => {
    const wrapper = mountModal()
    await (wrapper.vm as any).handleWatchAddress()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="address-error"]').exists()).toBe(true)
  })
})
