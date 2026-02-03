<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useConnection } from '@wagmi/vue'
import { clearBatchCapabilitiesCache } from '~/composables/useBatchTransaction'
import { useTxComposer, clearQuoteCache } from '~/composables/useTxComposer'
import { useTransactionHistory } from '~/composables/useTransactionHistory'
import { useWatchedAddress } from '~/composables/useWatchedAddress'
import {
  CHAIN_METADATA,
  getChainName,
  sortChainsByValue,
  aggregateUsdByChainId,
} from '~/utils/chains'

useHead({ title: 'Swap into One | Web3 Dashboard' })

const { address } = useConnection()
const { watchedAddress } = useWatchedAddress()
const effectiveAddress = computed<string | null>(() => {
  if (address.value) return String(address.value)
  return watchedAddress.value
})
const { allTransactions } = useTransactionHistory(effectiveAddress)
const showTransactionHistory = computed(() => allTransactions.value.length > 0)
const showHistoryOpen = ref(false)

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
const showFilters = ref(false)

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

    <div v-if="isLoadingTokens" class="swap-into-one-page__loading">
      <div class="swap-into-one-page__spinner"></div>
      Loading assets…
    </div>

    <div v-else class="swap-into-one-page__content-grid">
      <div class="swap-into-one-page__left-col">
        <div class="swap-into-one-page__filters">
          <div class="swap-into-one-page__filters-toggle-row">
            <button
              type="button"
              class="swap-into-one-page__filter-toggle"
              :class="{ 'swap-into-one-page__filter-toggle--open': showFilters }"
              :aria-expanded="showFilters"
              aria-label="Toggle filters"
              @click="showFilters = !showFilters"
            >
              <svg
                class="swap-into-one-page__filter-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span class="swap-into-one-page__filter-toggle-label">Filters</span>
            </button>
          </div>
          <Transition name="filters-slide">
            <div v-show="showFilters" class="swap-into-one-page__filters-inputs-row">
              <div class="swap-into-one-page__filter-group">
                <label>Min value $</label>
                <input v-model="minInput" type="number" min="0" step="0.01" placeholder="Any" />
              </div>
              <div class="swap-into-one-page__filter-group">
                <label>Max value $</label>
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
          </Transition>
          <div v-if="showFilters && hasInvalidRange" class="swap-into-one-page__range-error">
            Min value must be ≤ max value
          </div>
        </div>
        <div class="swap-into-one-page__assets-list-wrap">
          <TxComposerAssetList :tokens="filteredTokens" :selected-ids="selectedTokenIds" />
        </div>
      </div>
      <div class="swap-into-one-page__right-col">
        <TxComposerComposerWidget />
        <section
          v-if="showTransactionHistory"
          class="swap-into-one-page__history-box"
          aria-labelledby="tx-history-heading"
        >
          <div class="swap-into-one-page__history-box-header">
            <h2 id="tx-history-heading" class="swap-into-one-page__history-box-title">
              Transaction History
            </h2>
            <button
              type="button"
              class="swap-into-one-page__history-toggle"
              :aria-expanded="showHistoryOpen"
              aria-controls="tx-history-list"
              @click="showHistoryOpen = !showHistoryOpen"
            >
              <span>{{ showHistoryOpen ? 'Hide' : 'Show' }} transaction history</span>
              <svg
                class="swap-into-one-page__history-toggle-icon"
                :class="{ 'swap-into-one-page__history-toggle-icon--open': showHistoryOpen }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          <Transition name="history-slide">
            <div
              v-show="showHistoryOpen"
              id="tx-history-list"
              class="swap-into-one-page__history-list"
              role="region"
            >
              <TransactionHistoryBox :transactions="allTransactions" no-heading />
            </div>
          </Transition>
        </section>
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

.swap-into-one-page__left-col {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.swap-into-one-page__filters {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.swap-into-one-page__filters-toggle-row {
  margin-bottom: 12px;
}

.swap-into-one-page__filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.swap-into-one-page__filter-toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.swap-into-one-page__filter-toggle--open {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.swap-into-one-page__filter-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.swap-into-one-page__filters-inputs-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
}

.swap-into-one-page__filters-inputs-row .swap-into-one-page__filter-group {
  flex: 1 1 0;
  min-width: 0;
}

/* Transition: filter row height + opacity so assets list slides smoothly */
.filters-slide-enter-active,
.filters-slide-leave-active {
  transition:
    max-height 0.24s ease-out,
    opacity 0.2s ease-out,
    margin-bottom 0.24s ease-out;
}

.filters-slide-enter-from,
.filters-slide-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  overflow: hidden;
}

.filters-slide-enter-to,
.filters-slide-leave-from {
  max-height: 120px;
  opacity: 1;
  margin-bottom: 12px;
  overflow: visible;
}

.swap-into-one-page__assets-list-wrap {
  flex: 1 1 auto;
  min-height: 0;
  transition: transform 0.22s ease-out;
}

.swap-into-one-page__filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 0;
  min-width: 0;
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
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.swap-into-one-page__filter-group :deep(.network-filter-btn) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  align-items: start;
}

.swap-into-one-page__right-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 48px;
  position: sticky;
  top: 0px;
  align-self: start;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

/* Same big box as Transaction preview (composer widget) */
.swap-into-one-page__history-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.swap-into-one-page__history-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.swap-into-one-page__history-box-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.swap-into-one-page__history-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.swap-into-one-page__history-toggle:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.swap-into-one-page__history-toggle-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.swap-into-one-page__history-toggle-icon--open {
  transform: rotate(180deg);
}

.swap-into-one-page__history-list {
  margin-top: 16px;
  min-height: 0;
  overflow-y: auto;
  max-height: min(60vh, 480px);
}

.swap-into-one-page__history-list .transaction-history-box {
  padding: 0;
}

.history-slide-enter-active,
.history-slide-leave-active {
  transition:
    max-height 0.25s ease-out,
    opacity 0.2s ease-out;
  overflow: hidden;
}

.history-slide-enter-from,
.history-slide-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}

.history-slide-enter-to,
.history-slide-leave-from {
  max-height: min(60vh, 480px);
  opacity: 1;
  margin-top: 16px;
}

@media (max-width: 900px) {
  .swap-into-one-page__content-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .swap-into-one-page__right-col {
    position: relative;
    top: 0;
    max-height: none;
  }

  .swap-into-one-page__history-box {
    padding: 16px;
    border-radius: 14px;
  }

  .swap-into-one-page__history-list {
    max-height: 400px;
  }

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

  .swap-into-one-page__filters-inputs-row {
    flex-wrap: wrap;
    flex-direction: column;
  }

  .swap-into-one-page__filters-inputs-row .swap-into-one-page__filter-group {
    width: 100%;
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
