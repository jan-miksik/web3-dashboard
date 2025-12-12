<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useConnection } from '@wagmi/vue'
import { config } from '~/chains-config'
import { useWatchedAddress } from '~/composables/useWatchedAddress'

const { isConnected } = useConnection({ config })
const { watchedAddress, setWatchedAddress, clearWatchedAddress, isValidAddress } =
  useWatchedAddress()

const addressInput = ref('')
const addressError = ref('')

const showModal = computed(() => !isConnected.value && !watchedAddress.value)

watch(isConnected, connected => {
  if (connected) {
    clearWatchedAddress()
  }
})

function handleAddressInput(value: string) {
  addressInput.value = value
  addressError.value = ''

  const trimmed = value.trim()

  if (trimmed && isValidAddress(trimmed)) {
    setWatchedAddress(trimmed.toLowerCase())
    addressInput.value = ''
    addressError.value = ''
  } else if (trimmed && !isValidAddress(trimmed)) {
    addressError.value = 'Invalid Ethereum address format'
  }
}

function handleWatchAddress() {
  const trimmed = addressInput.value.trim()

  if (!trimmed) {
    addressError.value = 'Please enter an address'
    return
  }

  if (!isValidAddress(trimmed)) {
    addressError.value = 'Invalid Ethereum address format'
    return
  }

  setWatchedAddress(trimmed.toLowerCase())
  addressInput.value = ''
  addressError.value = ''
}

function handleClearWatch() {
  clearWatchedAddress()
  addressInput.value = ''
  addressError.value = ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" data-testid="modal-overlay">
        <div class="modal-content">
          <div class="modal-body">
            <!-- Connect Wallet Section -->
            <div class="connect-section">
              <div class="connect-button-wrapper">
                <ConnectButton />
              </div>
            </div>

            <!-- Divider -->
            <div class="divider">
              <span class="divider-text">OR</span>
            </div>

            <!-- Watch Address Section -->
            <div class="watch-section">
              <label class="input-label">Watch Address</label>

              <div
                v-if="watchedAddress"
                class="watched-address-display"
                data-testid="watched-address-display"
              >
                <div class="watched-info">
                  <span class="watched-label">Watching:</span>
                  <span class="watched-address font-mono">{{ watchedAddress }}</span>
                </div>
                <button class="clear-btn" data-testid="clear-watch-btn" @click="handleClearWatch">
                  Clear
                </button>
              </div>

              <div v-else class="address-input-wrapper">
                <input
                  v-model="addressInput"
                  type="text"
                  placeholder="0x..."
                  class="address-input"
                  data-testid="address-input"
                  :class="{ error: addressError }"
                  @input="(e: Event) => handleAddressInput((e.target as HTMLInputElement).value)"
                  @blur="handleAddressInput(addressInput)"
                  @keyup.enter="() => handleWatchAddress()"
                />
                <p v-if="addressError" class="error-message" data-testid="address-error">
                  {{ addressError }}
                </p>
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

.watch-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.address-input::placeholder {
  color: var(--text-muted);
}

.error-message {
  color: var(--error);
  font-size: 12px;
  margin-top: -8px;
}

.help-text {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: -8px;
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
