<script setup lang="ts">
import { computed } from 'vue'
import { useConnection } from '@wagmi/vue'
import { useAppKit } from '@reown/appkit/vue'
import { config } from '~/chains-config'

const { isConnected } = useConnection({ config })


const buttonText = computed(() => {
  if (isConnected.value) return 'Wallet Menu'
  return 'Connect Wallet'
})
</script>

<template>
  <div class="connect-button-wrapper" data-testid="connect-button-wrapper">
    <!-- Custom styled button -->
    <button 
      class="connect-button" 
      :class="{ connected: isConnected }"
      data-testid="connect-button"
      @click="useAppKit().open()"
    >
      <span data-testid="connect-button-text">{{ buttonText }}</span>
    </button>
  </div>
</template>

<style scoped>
.connect-button-wrapper {
  width: 100%;
}

.connect-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 24px;
  background: var(--accent-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.connect-button:hover {
  background: var(--accent-hover);
  /* transform: translateY(-1px); */
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
}

.connect-button:active {
  transform: translateY(0);
}

.connect-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.connect-button.connected {
  background: #21c661;
}

.connect-button.connected:hover {
  background: #21c661;
}

.connect-button.loading {
  opacity: 0.8;
}

.connect-icon {
  font-size: 16px;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

