<script setup lang="ts">
interface Props {
  hasAddress: boolean
  error: string | null
  isLoading: boolean
  tokensLength: number
  filteredTokensLength: number
  showLowValueAssets: boolean
  selectedChainIdsSize: number
  onRetry: () => void
}

const props = defineProps<Props>()
</script>

<template>
  <!-- Not Connected State -->
  <div v-if="!hasAddress" class="empty-state">
    <div class="empty-icon">💰</div>
    <p>Connect your wallet or enter an address to view token balances</p>
  </div>

  <!-- Error State -->
  <div v-else-if="error" class="error-state" data-testid="error-state">
    <p class="error-text">{{ error }}</p>
    <button class="retry-btn" data-testid="retry-button" @click="onRetry">Retry</button>
  </div>

  <!-- Loading State -->
  <div
    v-else-if="isLoading && tokensLength === 0"
    class="loading-state"
    data-testid="loading-state"
  >
    <div class="skeleton-table">
      <div v-for="i in 5" :key="i" class="skeleton-row">
        <div class="skeleton skeleton-token"></div>
        <div class="skeleton skeleton-usd"></div>
      </div>
    </div>
  </div>

  <!-- Empty Tokens State -->
  <div v-else-if="filteredTokensLength === 0" class="empty-state" data-testid="empty-state">
    <div class="empty-icon">📭</div>
    <p v-if="!showLowValueAssets && tokensLength > 0">No tokens with value ≥ $5.</p>
    <p v-else-if="selectedChainIdsSize > 0">No tokens found for selected networks</p>
    <p v-else>No tokens found across networks</p>
  </div>
</template>

<style scoped>
.empty-state,
.error-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.error-text {
  color: var(--error);
  margin-bottom: 12px;
}

.retry-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.retry-btn:hover {
  background: var(--bg-hover);
}

/* Skeleton Loading */
.skeleton-table {
  width: 100%;
}

.skeleton-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}

.skeleton-row:last-child {
  border-bottom: none;
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    var(--bg-hover) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

.skeleton-token {
  width: 160px;
  height: 36px;
}

.skeleton-usd {
  width: 80px;
  height: 24px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
