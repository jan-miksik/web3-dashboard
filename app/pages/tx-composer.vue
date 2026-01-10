<script setup lang="ts">
import { computed, ref } from 'vue'
import AssetList from '~/components/tx-composer/AssetList.vue'
import ComposerWidget from '~/components/tx-composer/ComposerWidget.vue'
import NetworkFilter from '~/components/NetworkFilter.vue'
import { useTxComposer } from '~/composables/useTxComposer'
import { CHAIN_METADATA } from '~/utils/chains'

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
      return CHAIN_METADATA.find(c => c.id === chainId)?.name || 'Unknown'
    }
    return 'Unknown'
  }
  return `${selectedChainIds.value.size} Chains`
})

const chainBalances = computed(() => {
  const balances: Record<number, number> = {}
  allTokens.value.forEach(t => {
    balances[t.chainId] = (balances[t.chainId] || 0) + t.usdValue
  })
  return balances
})

const chainsWithAssets = computed(() => {
  const chainIdsInTokens = new Set(allTokens.value.map(t => t.chainId))
  return CHAIN_METADATA.filter(c => chainIdsInTokens.has(c.id))
})

const chainsWithoutAssets = computed(() => {
  const chainIdsInTokens = new Set(allTokens.value.map(t => t.chainId))
  return CHAIN_METADATA.filter(c => !chainIdsInTokens.has(c.id))
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
</script>

<template>
  <div class="tx-composer-page">
    <div class="page-header">
      <div class="header-main">
        <h1 class="title">TxComposer</h1>
        <div class="warning-banner-inline">
          <div class="warning-icon">⚠️</div>
          <div class="warning-content">
            <strong>Development & Testing</strong>
            <p>Use with caution. Verify transactions before confirming.</p>
          </div>
        </div>
      </div>
      <p class="subtitle">
        Compose swap/bridge transactions and optionally send output to a recipient.
      </p>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>Min value (USD)</label>
        <input v-model="minInput" type="number" min="0" step="0.01" placeholder="Any" />
      </div>
      <div class="filter-group">
        <label>Max value (USD)</label>
        <input v-model="maxInput" type="number" min="0" step="0.01" placeholder="Any" />
      </div>
      <div class="filter-group">
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
      <div v-if="hasInvalidRange" class="range-error">Min value must be ≤ max value</div>
    </div>

    <div v-if="isLoadingTokens" class="loading">
      <div class="spinner"></div>
      Loading assets…
    </div>

    <div v-else class="content-grid">
      <div class="left-col">
        <AssetList :tokens="filteredTokens" :selected-ids="selectedTokenIds" />
      </div>
      <div class="right-col">
        <ComposerWidget />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tx-composer-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 8px;
}

.warning-banner-inline {
  display: flex;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 12px;
  align-items: center;
}

.warning-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.warning-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.warning-content strong {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}

.warning-content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.title {
  font-size: 32px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, #a78bfa 0%, #60a5fa 70%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 16px;
}

.filters {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-group input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-primary);
  width: 140px;
}

.filter-group :deep(.network-filter-btn) {
  width: 140px;
}

.range-error {
  color: var(--danger, #ef4444);
  font-size: 13px;
  padding-bottom: 8px;
}

.content-grid {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 32px;
}

.left-col,
.right-col {
  min-width: 0;
}

@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 16px;
  color: var(--text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
