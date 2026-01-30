<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useConnection } from '@wagmi/vue'
import { useWatchedAddress } from '~/composables/useWatchedAddress'
import { useTokens } from '~/composables/useTokens'
import { clearBatchCapabilitiesCache } from '~/composables/useBatchTransaction'
import { handleError } from '~/utils/error-handler'

const { address, isConnected } = useConnection()
const { watchedAddress } = useWatchedAddress()

const effectiveAddress = computed(() => {
  if (address.value) {
    return address.value
  }
  return watchedAddress.value
})

const shortAddress = computed(() => {
  if (!effectiveAddress.value) return ''
  return `${effectiveAddress.value.slice(0, 6)}...${effectiveAddress.value.slice(-4)}`
})

// Only watch mode if no address exists but a watched address is set
const isWatchMode = computed(() => !address.value && !!watchedAddress.value)

// Show connected state if address exists or is connected
const showConnected = computed(() => !!address.value || isConnected.value)

// Tokens / Net worth (independent of selection in the token table)
const { totalUsdValue, isLoading: isTokensLoading } = useTokens()

const hasNetWorth = computed(() => !isTokensLoading.value && totalUsdValue.value > 0)

function formatTotalValue(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const isCopied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

async function copyAddress() {
  if (effectiveAddress.value) {
    try {
      await navigator.clipboard.writeText(effectiveAddress.value)
      isCopied.value = true

      if (copyTimeout) {
        clearTimeout(copyTimeout)
      }

      copyTimeout = setTimeout(() => {
        isCopied.value = false
      }, 2000)
    } catch (error) {
      handleError(error, {
        message: 'Failed to copy address to clipboard',
        context: { address: effectiveAddress.value },
        showNotification: true,
      })
    }
  }
}

const isBatchCacheCleared = ref(false)
let batchCacheClearTimeout: ReturnType<typeof setTimeout> | null = null

function onClearBatchingCache() {
  clearBatchCapabilitiesCache()
  isBatchCacheCleared.value = true

  if (batchCacheClearTimeout) {
    clearTimeout(batchCacheClearTimeout)
  }

  batchCacheClearTimeout = setTimeout(() => {
    isBatchCacheCleared.value = false
  }, 2000)
}

onUnmounted(() => {
  if (copyTimeout) clearTimeout(copyTimeout)
  if (batchCacheClearTimeout) clearTimeout(batchCacheClearTimeout)
})
</script>

<template>
  <div class="card wallet-info">
    <div class="card-header">
      <div class="wallet-header-left">
        <h3 class="card-title">Wallet</h3>
      </div>
      <span
        class="status-badge"
        data-testid="status-badge"
        :class="showConnected ? 'connected' : isWatchMode ? 'watch-mode' : 'disconnected'"
      >
        {{ showConnected ? 'Connected' : isWatchMode ? 'Watch Mode' : 'Disconnected' }}
      </span>
    </div>

    <div v-if="showConnected || isWatchMode" class="wallet-details" data-testid="wallet-details">
      <div class="detail-row">
        <div class="address-container">
          <span class="detail-value font-mono address-full" data-testid="address-full">{{
            effectiveAddress
          }}</span>
          <span class="detail-value font-mono address-short" data-testid="address-short">{{
            shortAddress
          }}</span>
          <button
            class="copy-btn"
            data-testid="copy-address-btn"
            :class="{ copied: isCopied }"
            :title="isCopied ? 'Copied!' : 'Copy address'"
            @click="copyAddress"
          >
            <span class="address-short-display address-display-full">{{ effectiveAddress }}</span>
            <span class="address-short-display address-display-short">{{ shortAddress }}</span>
            <svg
              v-if="!isCopied"
              class="copy-icon"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="5.5"
                y="5.5"
                width="8"
                height="8"
                rx="1"
                stroke="currentColor"
                stroke-width="1.25"
                fill="none"
              />
              <path
                d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3.5C2.67157 2 2 2.67157 2 3.5V9C2 9.82843 2.67157 10.5 3.5 10.5H5.5"
                stroke="currentColor"
                stroke-width="1.25"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <svg
              v-else
              class="copy-icon check-icon"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8L6.5 11.5L13 5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div v-if="hasNetWorth" class="detail-row net-worth-row">
        <span class="detail-label">Net Worth</span>
        <span class="detail-value net-worth-value">
          {{ formatTotalValue(totalUsdValue) }}
        </span>
      </div>

      <div class="detail-row wallet-info__cache-row">
        <span class="detail-label">Batching cache</span>
        <button
          class="wallet-info__cache-clear-btn"
          type="button"
          :class="{ 'wallet-info__cache-clear-btn--cleared': isBatchCacheCleared }"
          :title="isBatchCacheCleared ? 'Cleared' : 'Clear cached wallet batching capabilities'"
          @click="onClearBatchingCache"
        >
          {{ isBatchCacheCleared ? 'Cleared' : 'Clear' }}
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
  min-height: 120px;
}

.wallet-header-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
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

.wallet-info__cache-row {
  margin-top: 4px;
}

.wallet-info__cache-clear-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.wallet-info__cache-clear-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
  color: var(--text-primary);
}

.wallet-info__cache-clear-btn--cleared {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
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

.address-full,
.address-short {
  display: none;
}

.address-display-full {
  display: none;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.address-display-short {
  display: inline-block;
}

@media (min-width: 768px) {
  .address-display-full {
    display: inline-block;
  }

  .address-display-short {
    display: none;
  }
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-family: var(--font-mono);
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

.address-short-display {
  font-size: 15px;
  color: var(--text-secondary);
  font-weight: 500;
}

.copy-btn.copied .address-short-display {
  color: var(--success);
  font-weight: 600;
}

.copy-icon {
  width: 12px;
  height: 12px;
  display: block;
  transition: all 0.2s ease;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.7;
}

.copy-btn:hover .copy-icon {
  color: var(--text-secondary);
  opacity: 1;
}

.copy-btn.copied .copy-icon {
  color: var(--success);
  opacity: 1;
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

@media (max-width: 767px) {
  .copy-btn {
    min-height: 44px;
    padding: 10px 14px;
    -webkit-tap-highlight-color: transparent;
  }
}
</style>
