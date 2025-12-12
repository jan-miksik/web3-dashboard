import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWatchedAddress } from '../../../app/composables/useWatchedAddress'

describe('useWatchedAddress', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should initialize with null watched address', () => {
    const { watchedAddress } = useWatchedAddress()
    expect(watchedAddress.value).toBeNull()
  })

  it('should set watched address', () => {
    const { setWatchedAddress, watchedAddress } = useWatchedAddress()
    const testAddress = '0x1234567890123456789012345678901234567890'

    setWatchedAddress(testAddress)

    expect(watchedAddress.value).toBe(testAddress)
    expect(localStorage.setItem).toHaveBeenCalledWith('web3-dashboard-watched-address', testAddress)
  })

  it('should clear watched address', () => {
    const { setWatchedAddress, clearWatchedAddress, watchedAddress } = useWatchedAddress()
    const testAddress = '0x1234567890123456789012345678901234567890'

    setWatchedAddress(testAddress)
    expect(watchedAddress.value).toBe(testAddress)

    clearWatchedAddress()
    expect(watchedAddress.value).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalledWith('web3-dashboard-watched-address')
  })

  it('should validate Ethereum address format correctly', () => {
    const { isValidAddress } = useWatchedAddress()

    // Valid addresses
    expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true)
    expect(isValidAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')).toBe(true)
    expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true)

    // Invalid addresses
    expect(isValidAddress('0x123')).toBe(false) // Too short
    expect(isValidAddress('1234567890123456789012345678901234567890')).toBe(false) // Missing 0x
    expect(isValidAddress('0x123456789012345678901234567890123456789g')).toBe(false) // Invalid character
    expect(isValidAddress('')).toBe(false) // Empty
    expect(isValidAddress('0x12345678901234567890123456789012345678901')).toBe(false) // Too long
  })

  it('should detect watch mode correctly', () => {
    const { setWatchedAddress, isWatchMode } = useWatchedAddress()

    expect(isWatchMode.value).toBe(false)

    setWatchedAddress('0x1234567890123456789012345678901234567890')
    expect(isWatchMode.value).toBe(true)

    setWatchedAddress(null)
    expect(isWatchMode.value).toBe(false)
  })

  it('should persist address to localStorage when set', () => {
    const { setWatchedAddress } = useWatchedAddress()
    const testAddress = '0x9876543210987654321098765432109876543210'

    // Clear any previous calls
    vi.clearAllMocks()

    setWatchedAddress(testAddress)

    // Verify localStorage.setItem was called with correct values
    expect(localStorage.setItem).toHaveBeenCalledWith('web3-dashboard-watched-address', testAddress)
  })
})
