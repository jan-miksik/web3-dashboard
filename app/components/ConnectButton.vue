<script setup lang="ts">
import { computed } from 'vue'
import { useConnection } from '@wagmi/vue'
import { useAppKit } from '@reown/appkit/vue'
import { shortenAddress } from '~/utils/format'

const { isConnected, address } = useConnection()
const appKit = useAppKit()

const isWalletConnected = computed(() => address.value || isConnected.value)

const shortAddress = computed(() => (address.value ? shortenAddress(address.value) : ''))

function handleConnectClick() {
  appKit.open()
}
</script>

<template>
  <div class="connect-button-wrapper" data-testid="connect-button-wrapper">
    <button
      :class="['connect-button', { connected: isWalletConnected }]"
      data-testid="connect-button"
      @click="handleConnectClick"
    >
      <template v-if="isWalletConnected">
        <span class="connect-button__address" data-testid="connect-button-address">{{
          shortAddress
        }}</span>
      </template>
      <template v-else>
        <span data-testid="connect-button-text">Connect Wallet</span>
      </template>
    </button>
  </div>
</template>

<style scoped>
.connect-button-wrapper {
  width: auto;
}

.connect-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  min-height: 40px;
  background: var(--accent-primary);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.connect-button.connected {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.connect-button:hover {
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
}

.connect-button.connected:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
  box-shadow: none;
}

.connect-button:active {
  transform: translateY(1px);
}

.connect-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.connect-button__address {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
</style>
