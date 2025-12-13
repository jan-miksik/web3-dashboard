<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useConnection } from '@wagmi/vue'
import { useWatchedAddress } from '~/composables/useWatchedAddress'

// Constants
const ERROR_MESSAGES = {
  INVALID_ADDRESS: 'Invalid Ethereum address format',
  EMPTY_ADDRESS: 'Please enter an address',
} as const

const SUCCESS_MESSAGES = {
  ADDRESS_ADDED: 'Address successfully added!',
} as const

const UI_TEXT = {
  MODAL_TITLE: 'Connect Wallet or Watch Address',
  WATCH_ADDRESS_LABEL: 'Watch Address',
  WATCHING_LABEL: 'Watching:',
  CLEAR_BUTTON: 'Clear',
  DIVIDER_TEXT: 'OR',
  PLACEHOLDER: '0x...',
} as const

const VALIDATION = {
  ETHEREUM_ADDRESS_LENGTH: 42,
  DEBOUNCE_DELAY_MS: 500,
  SUCCESS_MESSAGE_DURATION_MS: 3000,
} as const

const { isConnected, address } = useConnection()
const { watchedAddress, setWatchedAddress, clearWatchedAddress, isValidAddress } =
  useWatchedAddress()

const addressInput = ref('')
const addressError = ref('')
const addressSuccess = ref(false)
const modalContentRef = ref<HTMLElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let focusTrapHandler: ((e: KeyboardEvent) => void) | null = null

// Only show modal when no address is set (neither connected nor watching)
const showModal = computed(() => !address.value && !watchedAddress.value && !isConnected.value)

// Watch for connection changes and sync state
watch(
  isConnected,
  connected => {
    if (connected) {
      clearWatchedAddress()
    }
  },
  { immediate: true }
)

// Focus trap: Watch for modal visibility and manage focus
watch(
  showModal,
  async isVisible => {
    if (isVisible) {
      await nextTick()
      focusFirstElement()
      setupFocusTrap()
    } else {
      removeFocusTrap()
    }
  },
  { immediate: true }
)

function focusFirstElement() {
  if (!modalContentRef.value) return

  // Find first focusable element in modal
  const focusableSelectors =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  const firstFocusable = modalContentRef.value.querySelector(
    focusableSelectors
  ) as HTMLElement | null

  if (firstFocusable) {
    firstFocusable.focus()
  }
}

function setupFocusTrap() {
  focusTrapHandler = (e: KeyboardEvent) => {
    if (!showModal.value || !modalContentRef.value) return

    // Handle Tab key for focus trapping
    if (e.key === 'Tab') {
      const focusableSelectors =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      const focusableElements = Array.from(
        modalContentRef.value.querySelectorAll<HTMLElement>(focusableSelectors)
      )

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (!firstElement || !lastElement) return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }
  }

  document.addEventListener('keydown', focusTrapHandler)
}

function removeFocusTrap() {
  if (focusTrapHandler) {
    document.removeEventListener('keydown', focusTrapHandler)
  }
}

function clearError() {
  addressError.value = ''
}

function showSuccess() {
  addressSuccess.value = true
  setTimeout(() => {
    addressSuccess.value = false
  }, VALIDATION.SUCCESS_MESSAGE_DURATION_MS)
}

function validateAndSetAddress(address: string, autoWatch = false): boolean {
  const trimmed = address.trim()

  if (!trimmed) {
    if (!autoWatch) {
      addressError.value = ERROR_MESSAGES.EMPTY_ADDRESS
    }
    return false
  }

  if (!isValidAddress(trimmed)) {
    addressError.value = ERROR_MESSAGES.INVALID_ADDRESS
    return false
  }

  setWatchedAddress(trimmed.toLowerCase())
  addressInput.value = ''
  clearError()
  showSuccess()
  return true
}

function handleCloseModal() {
  // Clear watched address if one is set, which will close the modal
  if (watchedAddress.value) {
    clearWatchedAddress()
    addressInput.value = ''
    clearError()
    addressSuccess.value = false
  }
}

function handleEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleCloseModal()
  }
}

function handleInputEvent(e: Event) {
  const target = e.target as HTMLInputElement
  handleAddressInput(target.value)
}

function handleAddressInput(value: string) {
  addressInput.value = value
  clearError()
  addressSuccess.value = false

  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  const trimmed = value.trim()

  // Only validate and auto-watch if address is complete and valid
  if (trimmed && trimmed.length >= VALIDATION.ETHEREUM_ADDRESS_LENGTH) {
    // Debounce auto-watch
    debounceTimer = setTimeout(() => {
      validateAndSetAddress(trimmed, true)
    }, VALIDATION.DEBOUNCE_DELAY_MS)
  } else if (trimmed && trimmed.length > 0) {
    // Show error immediately for incomplete addresses
    if (!isValidAddress(trimmed)) {
      addressError.value = ERROR_MESSAGES.INVALID_ADDRESS
    }
  }
}

function handleBlur() {
  // Validate on blur without auto-watching
  const trimmed = addressInput.value.trim()

  if (!trimmed) {
    // Don't show error on blur if field is empty
    return
  }

  if (!isValidAddress(trimmed)) {
    addressError.value = ERROR_MESSAGES.INVALID_ADDRESS
  } else {
    clearError()
  }
}

function handleWatchAddress() {
  validateAndSetAddress(addressInput.value, false)
}

function handleClearWatch() {
  clearWatchedAddress()
  addressInput.value = ''
  clearError()
  addressSuccess.value = false
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

onUnmounted(() => {
  removeFocusTrap()
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showModal"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-testid="modal-overlay"
        @click.self="handleCloseModal"
        @keydown.esc="handleEscapeKey"
      >
        <div ref="modalContentRef" class="modal-content">
          <div class="modal-body">
            <h2 id="modal-title" class="sr-only">{{ UI_TEXT.MODAL_TITLE }}</h2>
            <!-- Connect Wallet Section -->
            <div class="connect-section">
              <div class="connect-button-wrapper">
                <ConnectButton />
              </div>
            </div>

            <!-- Divider -->
            <div class="divider">
              <span class="divider-text">{{ UI_TEXT.DIVIDER_TEXT }}</span>
            </div>

            <!-- Watch Address Section -->
            <div class="watch-section">
              <label class="input-label">{{ UI_TEXT.WATCH_ADDRESS_LABEL }}</label>

              <div
                v-if="watchedAddress"
                class="watched-address-display"
                data-testid="watched-address-display"
              >
                <div class="watched-info">
                  <span class="watched-label">{{ UI_TEXT.WATCHING_LABEL }}</span>
                  <span class="watched-address font-mono">{{ watchedAddress }}</span>
                </div>
                <button class="clear-btn" data-testid="clear-watch-btn" @click="handleClearWatch">
                  {{ UI_TEXT.CLEAR_BUTTON }}
                </button>
              </div>

              <div v-else class="address-input-wrapper">
                <input
                  v-model="addressInput"
                  type="text"
                  :placeholder="UI_TEXT.PLACEHOLDER"
                  class="address-input"
                  data-testid="address-input"
                  :class="{ error: addressError, success: addressSuccess }"
                  @input="handleInputEvent"
                  @blur="handleBlur"
                  @keyup.enter="handleWatchAddress"
                />
                <Transition name="message">
                  <p v-if="addressError" class="error-message" data-testid="address-error">
                    {{ addressError }}
                  </p>
                </Transition>
                <Transition name="message">
                  <p v-if="addressSuccess" class="success-message" data-testid="address-success">
                    {{ SUCCESS_MESSAGES.ADDRESS_ADDED }}
                  </p>
                </Transition>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.modal-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.watch-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.connect-section {
  display: flex;
  flex-direction: column;
}

.connect-button-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
}

.divider {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-color);
}

.divider-text {
  position: relative;
  background: var(--bg-card);
  padding: 0 16px;
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.watched-address-display {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.watched-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.watched-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.watched-address {
  font-size: 14px;
  color: var(--text-primary);
  word-break: break-all;
}

.clear-btn {
  align-self: flex-start;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.address-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.address-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  transition: all 0.2s;
}

.address-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: var(--bg-tertiary);
}

.address-input.error {
  border-color: var(--error);
}

.address-input.success {
  border-color: var(--success, #10b981);
}

.address-input::placeholder {
  color: var(--text-muted);
}

.error-message {
  color: var(--error);
  font-size: 12px;
  margin-top: -8px;
}

.success-message {
  color: var(--success, #10b981);
  font-size: 12px;
  margin-top: -8px;
}

.message-enter-active,
.message-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.message-enter-from,
.message-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
  opacity: 0;
}

@media (max-width: 640px) {
  .modal-content {
    max-width: 100%;
    margin: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }
}
</style>
