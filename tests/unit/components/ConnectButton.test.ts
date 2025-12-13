import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ConnectButton from '../../../app/components/ConnectButton.vue'
import { useAppKit } from '@reown/appkit/vue'

// Mock @wagmi/vue - use hoisted mock to avoid initialization issues
const { mockUseConnection } = vi.hoisted(() => ({
  mockUseConnection: vi.fn(),
}))

vi.mock('@wagmi/vue', () => ({
  useConnection: mockUseConnection,
}))

// Mock @reown/appkit/vue
vi.mock('@reown/appkit/vue', () => ({
  useAppKit: vi.fn(() => ({
    open: vi.fn(),
  })),
}))

describe('ConnectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set default mock return value - use Vue refs so Vue can properly unwrap them
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as Parameters<typeof mockUseConnection.mockReturnValue>[0])
  })

  it('should render connect button when not connected', async () => {
    // Use Vue refs so the component can properly unwrap them
    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as Parameters<typeof mockUseConnection.mockReturnValue>[0])

    const wrapper = mount(ConnectButton)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="connect-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="connect-button-text"]').text()).toContain('Connect Wallet')
    // Check that connected class is not present
    const button = wrapper.find('[data-testid="connect-button"]')
    expect(button.classes()).not.toContain('connected')
  })

  it('should render wallet menu button when connected', async () => {
    mockUseConnection.mockReturnValue({
      isConnected: ref(true),
      address: ref('0x1234567890123456789012345678901234567890'),
    } as unknown as Parameters<typeof mockUseConnection.mockReturnValue>[0])

    const wrapper = mount(ConnectButton)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="connect-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="connect-button-text"]').text()).toContain('Wallet Menu')
    expect(wrapper.find('[data-testid="connect-button"]').classes()).toContain('connected')
  })

  it('should call useAppKit().open() when clicked', async () => {
    const mockOpen = vi.fn()
    vi.mocked(useAppKit).mockReturnValue({
      open: mockOpen,
      close: vi.fn(),
    } as unknown as ReturnType<typeof useAppKit>)

    mockUseConnection.mockReturnValue({
      isConnected: ref(false),
      address: ref(null),
    } as unknown as Parameters<typeof mockUseConnection.mockReturnValue>[0])

    const wrapper = mount(ConnectButton)

    await wrapper.find('[data-testid="connect-button"]').trigger('click')

    expect(mockOpen).toHaveBeenCalled()
  })
})
