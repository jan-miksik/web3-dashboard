<script setup lang="ts">
import type { ChainMetadata } from '~/utils/chains'

interface Props {
  filteredTotalUsdValue: number
  hasAddress: boolean
  chainsWithAssets: ChainMetadata[]
  chainsWithoutAssets: ChainMetadata[]
  selectedChainIds: Set<number>
  selectedChainsDisplay: string
  showChainFilter: boolean
  isLoading: boolean
  isRefreshing: boolean
  chainBalances?: Record<number, number>
  isChainSelected: (chainId: number) => boolean
  onToggleChain: (chainId: number) => void
  onClickAllNetworks: () => void
  onRefresh: () => void
  onFormatTotalValue: (value: number) => string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:showChainFilter': [value: boolean]
}>()
</script>

<template>
  <div class="card-header">
    <div class="header-title-section">
      <h3 class="card-title">Worth in Selection</h3>
      <span v-if="hasAddress && filteredTotalUsdValue > 0" class="total-value">
        {{ onFormatTotalValue(filteredTotalUsdValue) }}
      </span>
    </div>
    <div class="header-actions">
      <NetworkFilter
        v-if="hasAddress"
        :chains-with-assets="chainsWithAssets"
        :chains-without-assets="chainsWithoutAssets"
        :selected-chain-ids="selectedChainIds"
        :selected-chains-display="selectedChainsDisplay"
        :show-chain-filter="showChainFilter"
        :chain-balances="chainBalances"
        :is-chain-selected="isChainSelected"
        @toggle-chain="onToggleChain"
        @click-all-networks="onClickAllNetworks"
        @update:show-chain-filter="emit('update:showChainFilter', $event)"
      />
      <button
        v-if="hasAddress"
        class="refresh-btn"
        data-testid="refresh-btn"
        type="button"
        aria-label="Refresh token balances"
        :disabled="isLoading || isRefreshing"
        title="Refresh balances"
        @click="onRefresh"
      >
        <span class="refresh-icon" :class="{ spinning: isLoading || isRefreshing }"> ↻ </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-section {
  display: flex;
  flex-direction: column;
}

.total-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-primary);
  font-family: var(--font-mono);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
  color: var(--text-secondary);
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-light);
  color: var(--text-primary);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-icon {
  width: 19px;
  height: 19px;
  color: currentColor;
  transition: transform 0.2s ease;
}

.refresh-btn:not(:disabled):hover .refresh-icon {
  transform: rotate(90deg);
}

.refresh-icon.spinning {
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .total-value {
    font-size: 14px;
  }
}
</style>
