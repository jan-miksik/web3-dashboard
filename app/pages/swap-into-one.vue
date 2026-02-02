<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { clearBatchCapabilitiesCache } from '~/composables/useBatchTransaction'
import { useTxComposer, clearQuoteCache } from '~/composables/useTxComposer'
import {
  CHAIN_METADATA,
  getChainName,
  sortChainsByValue,
  aggregateUsdByChainId,
} from '~/utils/chains'

useHead({ title: 'Swap into One | Web3 Dashboard' })

const {
  allTokens,
  filteredTokens,
  isLoadingTokens,
  minUsdValue,
  maxUsdValue,
  selectedTokenIds,
  selectedChainIds,
} = useTxComposer()

const showChainFilter = ref(false)

const minInput = computed({
  get: () => (typeof minUsdValue.value === 'number' ? String(minUsdValue.value) : ''),
  set: (v: string | number | null | undefined) => {
    const trimmed = v == null ? '' : String(v).trim()
    if (!trimmed) {
      minUsdValue.value = null
      return
    }
    const n = Number.parseFloat(trimmed)
    minUsdValue.value = Number.isFinite(n) ? n : null
  },
})

const maxInput = computed({
  get: () => (typeof maxUsdValue.value === 'number' ? String(maxUsdValue.value) : ''),
  set: (v: string | number | null | undefined) => {
    const trimmed = v == null ? '' : String(v).trim()
    if (!trimmed) {
      maxUsdValue.value = null
      return
    }
    const n = Number.parseFloat(trimmed)
    maxUsdValue.value = Number.isFinite(n) ? n : null
  },
})

const hasInvalidRange = computed(() => {
  if (typeof minUsdValue.value !== 'number' || typeof maxUsdValue.value !== 'number') return false
  return minUsdValue.value > maxUsdValue.value
})

// Chain filter logic
const selectedChainsDisplay = computed(() => {
  if (selectedChainIds.value.size === 0) {
    return 'All Chains'
  }
  if (selectedChainIds.value.size === 1) {
    const chainId = Array.from(selectedChainIds.value)[0]
    if (chainId !== undefined) {
      return getChainName(chainId)
    }
    return 'Unknown'
  }
  return `${selectedChainIds.value.size} Chains`
})

const chainBalances = computed(() => aggregateUsdByChainId(allTokens.value))

const chainsWithAssets = computed(() => {
  const chainIdsInTokens = new Set(allTokens.value.map(t => t.chainId))
  const available = CHAIN_METADATA.filter(c => chainIdsInTokens.has(c.id))
  return sortChainsByValue(available, chainBalances.value)
})

const chainsWithoutAssets = computed(() => {
  const chainIdsInTokens = new Set(allTokens.value.map(t => t.chainId))
  const unavailable = CHAIN_METADATA.filter(c => !chainIdsInTokens.has(c.id))
  return sortChainsByValue(unavailable, chainBalances.value)
})

const isChainSelected = (chainId: number): boolean => {
  return selectedChainIds.value.has(chainId)
}

const toggleChain = (chainId: number) => {
  const newSet = new Set(selectedChainIds.value)
  if (newSet.has(chainId)) {
    newSet.delete(chainId)
  } else {
    newSet.add(chainId)
  }
  selectedChainIds.value = newSet
}

const onClickAllNetworks = () => {
  selectedChainIds.value = new Set()
  showChainFilter.value = false
}

const isCacheRefreshed = ref(false)
let cacheRefreshTimeout: ReturnType<typeof setTimeout> | null = null

function onRefreshCache() {
  clearBatchCapabilitiesCache()
  clearQuoteCache()
  isCacheRefreshed.value = true
  if (cacheRefreshTimeout) clearTimeout(cacheRefreshTimeout)
  cacheRefreshTimeout = setTimeout(() => {
    isCacheRefreshed.value = false
  }, 2000)
}

onUnmounted(() => {
  if (cacheRefreshTimeout) clearTimeout(cacheRefreshTimeout)
})
</script>

<template>
  <div class="swap-into-one-page">
    <div class="swap-into-one-page__header">
      <NuxtLink to="/" class="swap-into-one-page__back">
        <span class="swap-into-one-page__back-arrow" aria-hidden="true">←</span>
        <span>Dashboard</span>
      </NuxtLink>
      <div class="swap-into-one-page__header-main">
        <div class="swap-into-one-page__header-main-left">
          <h1 class="swap-into-one-page__title">Swap into One</h1>
          <div class="swap-into-one-page__warning-banner">
            <div class="swap-into-one-page__warning-icon">⚠️</div>
            <div class="swap-into-one-page__warning-content">
              <strong>Development & Testing</strong>
              <p>Use with caution. Verify transactions before confirming.</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="swap-into-one-page__refresh-cache-btn"
          :class="{ 'swap-into-one-page__refresh-cache-btn--refreshed': isCacheRefreshed }"
          :title="isCacheRefreshed ? 'Refreshed' : 'Refresh caches (quotes, batching)'"
          aria-label="Refresh caches"
          @click="onRefreshCache"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
      <p class="swap-into-one-page__subtitle">
        Select tokens across chains, swap or bridge them into a single asset.
      </p>
    </div>

    <div class="swap-into-one-page__filters">
      <div class="swap-into-one-page__filters-first-row">
        <div class="swap-into-one-page__filter-group">
          <label>Min value (USD)</label>
          <input v-model="minInput" type="number" min="0" step="0.01" placeholder="Any" />
        </div>
        <div class="swap-into-one-page__filter-group">
          <label>Max value (USD)</label>
          <input v-model="maxInput" type="number" min="0" step="0.01" placeholder="Any" />
        </div>
        <div class="swap-into-one-page__filter-group">
          <label>Chain</label>
          <NetworkFilter
            :chains-with-assets="chainsWithAssets"
            :chains-without-assets="chainsWithoutAssets"
            :selected-chain-ids="selectedChainIds"
            :selected-chains-display="selectedChainsDisplay"
            :show-chain-filter="showChainFilter"
            :is-chain-selected="isChainSelected"
            :on-toggle-chain="toggleChain"
            :on-click-all-networks="onClickAllNetworks"
            :chain-balances="chainBalances"
            @update:show-chain-filter="showChainFilter = $event"
          />
        </div>
      </div>
      <div v-if="hasInvalidRange" class="swap-into-one-page__range-error">
        Min value must be ≤ max value
      </div>
    </div>

    <div v-if="isLoadingTokens" class="swap-into-one-page__loading">
      <div class="swap-into-one-page__spinner"></div>
      Loading assets…
    </div>

    <div v-else class="swap-into-one-page__content-grid">
      <div class="swap-into-one-page__left-col">
        <TxComposerAssetList :tokens="filteredTokens" :selected-ids="selectedTokenIds" />
      </div>
      <div class="swap-into-one-page__right-col">
        <TxComposerComposerWidget />
      </div>
    </div>
  </div>
</template>

<style scoped>
.swap-into-one-page {
  max-width: 1400px;
  margin: 0 auto;
}

.swap-into-one-page__header {
  margin-bottom: 20px;
}

.swap-into-one-page__back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  margin-left: -8px;
  padding-left: 8px;
  border-radius: 8px;
}

.swap-into-one-page__back:hover {
  color: var(--accent-primary);
}

.swap-into-one-page__back-arrow {
  font-size: 16px;
  line-height: 1;
}

.swap-into-one-page__header-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 8px;
}

.swap-into-one-page__header-main-left {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  min-width: 0;
}

.swap-into-one-page__refresh-cache-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.swap-into-one-page__refresh-cache-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.swap-into-one-page__refresh-cache-btn--refreshed {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.swap-into-one-page__warning-banner {
  display: flex;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 12px;
  align-items: center;
}

.swap-into-one-page__warning-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.swap-into-one-page__warning-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.swap-into-one-page__warning-content strong {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}

.swap-into-one-page__warning-content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.swap-into-one-page__title {
  font-size: 32px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, #a78bfa 0%, #60a5fa 70%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.swap-into-one-page__subtitle {
  color: var(--text-secondary);
  font-size: 16px;
}

.swap-into-one-page__filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.swap-into-one-page__filters-first-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.swap-into-one-page__filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.swap-into-one-page__filter-group label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.swap-into-one-page__filter-group input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-primary);
  width: 140px;
}

.swap-into-one-page__filter-group :deep(.network-filter-btn) {
  width: 140px;
}

.swap-into-one-page__range-error {
  color: var(--danger, #ef4444);
  font-size: 13px;
  padding-bottom: 8px;
}

.swap-into-one-page__content-grid {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 32px;
}

.swap-into-one-page__left-col,
.swap-into-one-page__right-col {
  min-width: 0;
}

@media (max-width: 900px) {
  .swap-into-one-page__content-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .swap-into-one-page {
    padding-left: env(safe-area-inset-left, 0);
    padding-right: env(safe-area-inset-right, 0);
  }

  .swap-into-one-page__header-main {
    flex-wrap: wrap;
    gap: 12px;
  }

  .swap-into-one-page__warning-banner {
    flex-wrap: wrap;
    width: 100%;
  }

  .swap-into-one-page__warning-content {
    flex-wrap: wrap;
  }

  .swap-into-one-page__warning-content strong {
    white-space: normal;
  }

  .swap-into-one-page__title {
    font-size: 26px;
  }

  .swap-into-one-page__subtitle {
    font-size: 14px;
  }

  .swap-into-one-page__filters-first-row {
    flex-direction: column;
    gap: 12px;
  }

  .swap-into-one-page__filter-group {
    width: 100%;
  }

  .swap-into-one-page__filter-group input {
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
  }

  .swap-into-one-page__filter-group :deep(.network-filter-btn) {
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
  }
}

.swap-into-one-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 16px;
  color: var(--text-secondary);
}

.swap-into-one-page__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: swap-into-one-page-spin 1s linear infinite;
}

@keyframes swap-into-one-page-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
