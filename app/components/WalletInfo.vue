<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConnection } from '@wagmi/vue'
import { config } from '~/chains-config'
import { useWatchedAddress } from '~/composables/useWatchedAddress'

const { address, isConnected } = useConnection({ config })
const { watchedAddress, clearWatchedAddress } = useWatchedAddress()

// Use watched address if in watch mode, otherwise use connected address
const effectiveAddress = computed(() => {
  if (isConnected.value && address.value) {
    return address.value
  }
  return watchedAddress.value
})

const shortAddress = computed(() => {
  if (!effectiveAddress.value) return ''
  return `${effectiveAddress.value.slice(0, 6)}...${effectiveAddress.value.slice(-4)}`
})

const isWatchMode = computed(() => !isConnected.value && !!watchedAddress.value)

const isCopied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

async function copyAddress() {
  if (effectiveAddress.value) {
    try {
      await navigator.clipboard.writeText(effectiveAddress.value)
      isCopied.value = true
      
      // Clear any existing timeout
      if (copyTimeout) {
        clearTimeout(copyTimeout)
      }
      
      // Reset after 2 seconds
      copyTimeout = setTimeout(() => {
        isCopied.value = false
      }, 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
    }
  }
}
</script>

<template>
  <div class="card wallet-info">
    <div class="card-header">
      <h3 class="card-title">Wallet</h3>
      <span 
        class="status-badge" 
        :class="isConnected ? 'connected' : isWatchMode ? 'watch-mode' : 'disconnected'"
      >
        {{ isConnected ? 'Connected' : isWatchMode ? 'Watch Mode' : 'Disconnected' }}
      </span>
    </div>

    <div v-if="isConnected || isWatchMode" class="wallet-details">
      <div class="detail-row">
        <span class="detail-label">Address</span>
        <div class="address-container">
          <span class="detail-value font-mono address-full">{{ effectiveAddress }}</span>
          <span class="detail-value font-mono address-short">{{ shortAddress }}</span>
          <button 
            class="copy-btn" 
            :class="{ copied: isCopied }"
            :title="isCopied ? 'Copied!' : 'Copy address'" 
            @click="copyAddress"
          >
            <svg v-if="!isCopied" class="copy-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="8" height="8" stroke="currentColor" stroke-width="1.25" fill="none"/>
              <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.25" fill="none"/>
            </svg>
            <svg v-else class="copy-icon check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="copied-text" :class="{ visible: isCopied }">Copied!</span>
          </button>
        </div>
      </div>

      <div v-if="isWatchMode" class="watch-mode-actions">
        <button class="clear-watch-btn" @click="clearWatchedAddress">
          Stop Watching
        </button>
      </div>
    </div>

    <div v-else class="wallet-disconnected">
      <p class="disconnect-text">Connect your wallet to view balances</p>
      <ConnectButton />
    </div>
  </div>
</template>

<style scoped>
.wallet-info {
  min-height: 160px;
}

.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}

.status-badge.connected {
  background: var(--success-muted);
  color: var(--success);
}

.status-badge.disconnected {
  background: var(--error-muted);
  color: var(--error);
}

.status-badge.watch-mode {
  background: var(--warning-muted);
  color: var(--warning);
}

.wallet-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: var(--text-secondary);
  font-size: 14px;
}

.detail-value {
  color: var(--text-primary);
  font-weight: 500;
}

.address-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 100%;
  min-width: 0; /* Allows flex items to shrink */
}

.address-full {
  display: none;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.address-short {
  display: inline-block;
}

/* Show full address on desktop, hide short */
@media (min-width: 768px) {
  .address-full {
    display: inline-block;
  }
  
  .address-short {
    display: none;
  }
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border-color);
  cursor: pointer;
  padding: 6px;
  min-width: 32px;
  height: 32px;
  border-radius: 6px;
  transition: all 0.2s ease;
  position: relative;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.copy-btn.copied {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.copy-icon {
  width: 16px;
  height: 16px;
  display: block;
  transition: all 0.2s ease;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.copy-btn:hover .copy-icon {
  color: var(--text-primary);
}

.copy-btn.copied .copy-icon {
  color: var(--success);
}

.check-icon {
  animation: checkmark 0.3s ease;
}

@keyframes checkmark {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.copied-text {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--success);
  background: var(--success-muted);
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-8px) scale(0.9);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.copied-text.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  animation: copiedPulse 0.6s ease;
}

@keyframes copiedPulse {
  0% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(0) scale(1.05);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

.wallet-disconnected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0;
}

.disconnect-text {
  color: var(--text-secondary);
  font-size: 14px;
}

.watch-mode-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.clear-watch-btn {
  width: 100%;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-watch-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}
</style>
