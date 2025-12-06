import { ref, computed } from 'vue'

// Watched address state - persisted in localStorage
const watchedAddressKey = 'web3-dashboard-watched-address'

const watchedAddress = ref<string | null>(null)

// Initialize from localStorage
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(watchedAddressKey)
  if (stored) {
    watchedAddress.value = stored
  }
}

export function useWatchedAddress() {
  // Set watched address
  function setWatchedAddress(address: string | null) {
    watchedAddress.value = address
    if (typeof window !== 'undefined') {
      if (address) {
        localStorage.setItem(watchedAddressKey, address)
      } else {
        localStorage.removeItem(watchedAddressKey)
      }
    }
  }

  // Clear watched address
  function clearWatchedAddress() {
    setWatchedAddress(null)
  }

  // Validate Ethereum address format
  function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Check if we're in watch mode (has watched address but no connected wallet)
  const isWatchMode = computed(() => !!watchedAddress.value)

  return {
    watchedAddress: computed(() => watchedAddress.value),
    setWatchedAddress,
    clearWatchedAddress,
    isValidAddress,
    isWatchMode,
  }
}

