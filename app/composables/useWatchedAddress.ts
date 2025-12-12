import { ref, computed } from 'vue'

// Watched address state - persisted in localStorage
const watchedAddressKey = 'web3-dashboard-watched-address'

const watchedAddress = ref<string | null>(null)

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(watchedAddressKey)
  if (stored) {
    watchedAddress.value = stored
  }
}

export function useWatchedAddress() {
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

  function clearWatchedAddress() {
    setWatchedAddress(null)
  }

  function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const isWatchMode = computed(() => !!watchedAddress.value)

  return {
    watchedAddress: computed(() => watchedAddress.value),
    setWatchedAddress,
    clearWatchedAddress,
    isValidAddress,
    isWatchMode,
  }
}
