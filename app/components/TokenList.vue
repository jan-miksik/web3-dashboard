<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useTokens } from '~/composables/useTokens'
import { useWatchedAddress } from '~/composables/useWatchedAddress'
import { CHAIN_METADATA, getChainMetadata, getChainIcon } from '~/utils/chains'
import type { ChainMetadata } from '~/utils/chains'
import { handleError } from '~/utils/error-handler'

const getAvailableChains = (chainIds: Set<number>): ChainMetadata[] => {
  return CHAIN_METADATA.filter(chain => chainIds.has(chain.id))
}

const { tokens, isLoading, error, refetch, isConnected } = useTokens()
const { watchedAddress } = useWatchedAddress()
const hasAddress = computed(() => isConnected.value || !!watchedAddress.value)
const showLowValueAssets = ref(false)
const selectedChainIds = ref<Set<number>>(new Set()) // Empty set = all chains
const showChainFilter = ref(false)
const chainFilterRef = ref<HTMLElement | null>(null)
const isRefreshing = ref(false)
const copiedAddress = ref<string | null>(null)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

async function copyTokenAddress(address: string) {
  try {
    await navigator.clipboard.writeText(address)
    copiedAddress.value = address

    if (copyTimeout) {
      clearTimeout(copyTimeout)
    }

    copyTimeout = setTimeout(() => {
      copiedAddress.value = null
    }, 2000)
  } catch (error) {
    handleError(error, {
      message: 'Failed to copy address to clipboard',
      context: { address },
      showNotification: true,
    })
  }
}

async function handleRefresh() {
  isRefreshing.value = true
  try {
    await refetch()
    await new Promise(resolve => setTimeout(resolve, 500))
  } finally {
    isRefreshing.value = false
  }
}

// Get chains with assets
const chainsWithAssets = computed(() => {
  const chainIds = new Set(tokens.value.map(t => t.chainId))
  return getAvailableChains(chainIds)
})

// Get chains without assets
const chainsWithoutAssets = computed(() => {
  const chainsWithAssetsIds = new Set(tokens.value.map(t => t.chainId))
  return CHAIN_METADATA.filter(chain => !chainsWithAssetsIds.has(chain.id))
})

const highValueTokens = computed(() => {
  let result = tokens.value

  if (selectedChainIds.value.size > 0) {
    result = result.filter(token => selectedChainIds.value.has(token.chainId))
  }

  return result.filter(token => token.usdValue >= 5)
})

const lowValueTokens = computed(() => {
  let result = tokens.value

  if (selectedChainIds.value.size > 0) {
    result = result.filter(token => selectedChainIds.value.has(token.chainId))
  }

  return result.filter(token => token.usdValue > 0 && token.usdValue < 5)
})

const filteredTokens = computed(() => {
  const result = [...highValueTokens.value]

  if (showLowValueAssets.value) {
    result.push(...lowValueTokens.value)
  }

  return result
})

const filteredTotalUsdValue = computed(() => {
  return filteredTokens.value.reduce((sum, token) => sum + token.usdValue, 0)
})

const hasLowValueAssets = computed(() => {
  return lowValueTokens.value.length > 0
})

const hasHighValueAssets = computed(() => {
  return highValueTokens.value.length > 0
})

// Auto-show low-value assets if high-value tokens are empty (button would not be visible)
watch(
  [tokens, selectedChainIds],
  () => {
    const hasHighValue = tokens.value.some(token => {
      const matchesChain =
        selectedChainIds.value.size === 0 || selectedChainIds.value.has(token.chainId)
      return matchesChain && token.usdValue >= 5
    })
    const hasLowValue = tokens.value.some(token => {
      const matchesChain =
        selectedChainIds.value.size === 0 || selectedChainIds.value.has(token.chainId)
      return matchesChain && token.usdValue > 0 && token.usdValue < 5
    })

    if (!hasHighValue && hasLowValue && !showLowValueAssets.value) {
      showLowValueAssets.value = true
    }
  },
  { immediate: true, deep: true }
)

const selectedChainsDisplay = computed(() => {
  if (selectedChainIds.value.size === 0) {
    return 'All Networks'
  }
  if (selectedChainIds.value.size === 1) {
    const chainId = Array.from(selectedChainIds.value)[0]
    if (chainId !== undefined) {
      return getChainInfo(chainId)?.name || 'Unknown'
    }
    return 'Unknown'
  }
  return `${selectedChainIds.value.size} Networks`
})

function toggleChain(chainId: number) {
  if (selectedChainIds.value.has(chainId)) {
    selectedChainIds.value.delete(chainId)
  } else {
    selectedChainIds.value.add(chainId)
  }
  selectedChainIds.value = new Set(selectedChainIds.value)
}

function isChainSelected(chainId: number): boolean {
  return selectedChainIds.value.has(chainId)
}

function getChainInfo(chainId: number): ChainMetadata | undefined {
  return getChainMetadata(chainId)
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (chainFilterRef.value && !chainFilterRef.value.contains(target)) {
    showChainFilter.value = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})

function formatBalance(balance: string): string {
  const num = parseFloat(balance.replace(/,/g, ''))
  if (num === 0) return '0'
  return balance
}

function formatUsdValue(value: number): string {
  if (value === 0) return '$0.00'
  if (value < 0.01) return '<$0.01'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatTotalValue(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function handleClickAllNetworks() {
  selectedChainIds.value = new Set()
  showChainFilter.value = false
}
</script>

<template>
  <div class="card token-list" data-testid="token-list">
    <div class="card-header">
      <div class="header-title-section">
        <h3 class="card-title">Net Worth</h3>
        <span v-if="hasAddress && filteredTotalUsdValue > 0" class="total-value">
          {{ formatTotalValue(filteredTotalUsdValue) }}
        </span>
      </div>
      <div class="header-actions">
        <div v-if="hasAddress" ref="chainFilterRef" class="network-filter-container">
          <button
            class="network-filter-btn"
            data-testid="network-filter-btn"
            :class="{ active: selectedChainIds.size > 0 }"
            @click="showChainFilter = !showChainFilter"
          >
            <span class="filter-value">{{ selectedChainsDisplay }}</span>
            <span class="filter-arrow" :class="{ rotated: showChainFilter }">▼</span>
          </button>
          <Transition name="dropdown">
            <div
              v-if="showChainFilter"
              class="network-filter-dropdown"
              data-testid="network-filter-dropdown"
            >
              <button
                class="filter-option"
                :class="{ selected: selectedChainIds.size === 0 }"
                @click="handleClickAllNetworks"
              >
                <span class="option-name">All Networks</span>
                <span v-if="selectedChainIds.size === 0" class="checkmark">✓</span>
              </button>
              <!-- Chains with assets -->
              <button
                v-for="chain in chainsWithAssets"
                :key="chain.id"
                class="filter-option"
                data-testid="network-filter-option"
                :class="{ selected: isChainSelected(chain.id) }"
                @click="toggleChain(chain.id)"
              >
                <div class="option-left">
                  <img
                    v-if="chain.icon"
                    :src="chain.icon"
                    :alt="chain.name"
                    class="chain-icon"
                    @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                  />
                  <span class="option-name">{{ chain.name }}</span>
                </div>
                <div class="option-right">
                  <span v-if="isChainSelected(chain.id)" class="checkmark">✓</span>
                </div>
              </button>
              <!-- Chains without assets (with lower opacity) -->
              <button
                v-for="chain in chainsWithoutAssets"
                :key="chain.id"
                class="filter-option filter-option-no-assets"
                data-testid="network-filter-option"
                :class="{ selected: isChainSelected(chain.id) }"
                @click="toggleChain(chain.id)"
              >
                <div class="option-left">
                  <img
                    v-if="chain.icon"
                    :src="chain.icon"
                    :alt="chain.name"
                    class="chain-icon"
                    @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                  />
                  <span class="option-name">{{ chain.name }}</span>
                </div>
                <div class="option-right">
                  <span v-if="isChainSelected(chain.id)" class="checkmark">✓</span>
                </div>
              </button>
            </div>
          </Transition>
        </div>
        <button
          v-if="hasAddress"
          class="refresh-btn"
          data-testid="refresh-btn"
          :disabled="isLoading || isRefreshing"
          title="Refresh balances"
          @click="handleRefresh"
        >
          <span class="refresh-icon" :class="{ spinning: isLoading || isRefreshing }"> ↻ </span>
        </button>
      </div>
    </div>

    <!-- Not Connected State -->
    <div v-if="!hasAddress" class="empty-state">
      <div class="empty-icon">💰</div>
      <p>Connect your wallet or enter an address to view token balances</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state" data-testid="error-state">
      <p class="error-text">{{ error }}</p>
      <button class="retry-btn" data-testid="retry-button" @click="() => refetch()">Retry</button>
    </div>

    <!-- Loading State -->
    <div
      v-else-if="isLoading && tokens.length === 0"
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
    <div v-else-if="filteredTokens.length === 0" class="empty-state" data-testid="empty-state">
      <div class="empty-icon">📭</div>
      <p v-if="!showLowValueAssets && tokens.length > 0">No tokens with value ≥ $5.</p>
      <p v-else-if="selectedChainIds.size > 0">No tokens found for selected networks</p>
      <p v-else>No tokens found across networks</p>
    </div>

    <!-- Token Table -->
    <div
      v-else
      class="table-container"
      :class="{ refreshing: isRefreshing }"
      data-testid="token-table-container"
    >
      <table
        class="token-table"
        :class="{ loading: isLoading || isRefreshing, 'show-low-value': showLowValueAssets }"
        data-testid="token-table"
      >
        <tbody>
          <!-- High-value tokens (>= $5) -->
          <tr
            v-for="token in highValueTokens"
            :key="`${token.chainId}-${token.address}`"
            class="token-row"
            data-testid="token-row"
          >
            <td class="td-token">
              <div class="token-info">
                <div class="token-logo">
                  <img
                    v-if="token.logoURI"
                    :src="token.logoURI"
                    :alt="token.symbol"
                    @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                  />
                  <span v-else class="token-placeholder">{{ token.symbol.charAt(0) }}</span>
                </div>
                <div class="token-details">
                  <div class="token-symbol-row">
                    <span class="token-symbol">{{ token.symbol }}</span>
                    <button
                      v-if="
                        token.address &&
                        token.address !== '0x0000000000000000000000000000000000000000'
                      "
                      class="token-address-btn"
                      data-testid="copy-token-address-btn"
                      :class="{ copied: copiedAddress === token.address }"
                      :title="copiedAddress === token.address ? 'Copied!' : 'Copy contract address'"
                      @click="copyTokenAddress(token.address)"
                    >
                      <span class="token-address">{{ shortenAddress(token.address) }}</span>
                      <svg
                        v-if="copiedAddress === token.address"
                        class="copy-icon"
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
                      <svg
                        v-else
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
                    </button>
                  </div>
                  <span class="token-meta">
                    <span class="token-name">{{ token.name }}</span>
                    <span class="chain-badge-wrapper">
                      <img
                        v-if="getChainIcon(token.chainId)"
                        :src="getChainIcon(token.chainId)"
                        :alt="token.chainName"
                        class="chain-badge-icon"
                        @error="
                          (e: Event) => ((e.target as HTMLImageElement).style.display = 'none')
                        "
                      />
                      <span class="chain-badge">{{ token.chainName }}</span>
                    </span>
                  </span>
                </div>
              </div>
            </td>
            <td class="td-value">
              <div class="value-container">
                <span class="token-value usd-value" :class="{ 'has-value': token.usdValue > 0 }">
                  {{ formatUsdValue(token.usdValue) }}
                </span>
                <span class="balance-value">{{ formatBalance(token.formattedBalance) }}</span>
              </div>
            </td>
          </tr>

          <!-- Divider row with button (only if there are low-value assets) -->
          <tr v-if="hasLowValueAssets && !showLowValueAssets" class="divider-row">
            <td colspan="2" class="divider-cell">
              <button
                class="show-low-value-btn"
                data-testid="show-low-value-btn"
                @click="showLowValueAssets = true"
              >
                {{ 'Show assets < $5' }}
              </button>
            </td>
          </tr>

          <!-- Low-value tokens (< $5) -->
          <template v-if="showLowValueAssets">
            <tr v-if="hasHighValueAssets" class="divider-row divider-row-animate">
              <td colspan="2" class="divider-cell">
                <button
                  class="hide-low-value-btn"
                  data-testid="hide-low-value-btn"
                  @click="showLowValueAssets = false"
                >
                  Hide assets &lt; $5
                </button>
              </td>
            </tr>
            <tr
              v-for="(token, index) in lowValueTokens"
              :key="`${token.chainId}-${token.address}`"
              class="token-row low-value-row"
              :style="{ '--row-index': index }"
              data-testid="token-row"
            >
              <td class="td-token">
                <div class="token-info">
                  <div class="token-logo">
                    <img
                      v-if="token.logoURI"
                      :src="token.logoURI"
                      :alt="token.symbol"
                      @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                    />
                    <span v-else class="token-placeholder">{{ token.symbol.charAt(0) }}</span>
                  </div>
                  <div class="token-details">
                    <div class="token-symbol-row">
                      <span class="token-symbol">{{ token.symbol }}</span>
                      <button
                        v-if="
                          token.address &&
                          token.address !== '0x0000000000000000000000000000000000000000'
                        "
                        class="token-address-btn"
                        :class="{ copied: copiedAddress === token.address }"
                        :title="
                          copiedAddress === token.address ? 'Copied!' : 'Copy contract address'
                        "
                        @click="copyTokenAddress(token.address)"
                      >
                        <span class="token-address">{{ shortenAddress(token.address) }}</span>
                        <svg
                          v-if="copiedAddress === token.address"
                          class="copy-icon"
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
                        <svg
                          v-else
                          class="copy-icon"
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect
                            x="6"
                            y="6"
                            width="8"
                            height="8"
                            stroke="currentColor"
                            stroke-width="1.25"
                            fill="none"
                          />
                          <rect
                            x="2"
                            y="2"
                            width="8"
                            height="8"
                            stroke="currentColor"
                            stroke-width="1.25"
                            fill="none"
                          />
                        </svg>
                      </button>
                    </div>
                    <span class="token-meta">
                      <span class="token-name">{{ token.name }}</span>
                      <span class="chain-badge-wrapper">
                        <img
                          v-if="getChainIcon(token.chainId)"
                          :src="getChainIcon(token.chainId)"
                          :alt="token.chainName"
                          class="chain-badge-icon"
                          @error="
                            (e: Event) => ((e.target as HTMLImageElement).style.display = 'none')
                          "
                        />
                        <span class="chain-badge">{{ token.chainName }}</span>
                      </span>
                    </span>
                  </div>
                </div>
              </td>
              <td class="td-value">
                <div class="value-container">
                  <span class="token-value usd-value" :class="{ 'has-value': token.usdValue > 0 }">
                    {{ formatUsdValue(token.usdValue) }}
                  </span>
                  <span class="balance-value">{{ formatBalance(token.formattedBalance) }}</span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.token-list {
  min-height: 300px;
}

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
}

.refresh-icon {
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

/* Empty States */
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

.skeleton-balance {
  width: 100px;
  height: 24px;
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

/* Network Filter */
.network-filter-container {
  position: relative;
}

.network-filter-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.network-filter-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.network-filter-btn.active {
  border-color: var(--accent-primary);
  background: var(--accent-muted);
}

.filter-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.filter-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.filter-arrow {
  font-size: 10px;
  color: var(--text-secondary);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.filter-arrow.rotated {
  transform: rotate(180deg);
}

.network-filter-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-width: 200px;
}

@media (min-width: 1024px) {
  .network-filter-dropdown {
    max-height: 600px;
  }
}

.filter-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.filter-option:hover {
  background: var(--bg-hover);
}

.filter-option.selected {
  background: var(--accent-muted);
}

.option-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.filter-option.selected .option-name {
  color: var(--accent-primary);
  font-weight: 600;
}

.filter-option-no-assets {
  opacity: 0.6;
}

.filter-option-no-assets:hover {
  opacity: 0.8;
}

.filter-option-no-assets.selected {
  opacity: 0.9;
}

.option-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkmark {
  color: var(--accent-primary);
  font-weight: 700;
  font-size: 14px;
}

.option-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.chain-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: contain;
}

.chain-type {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  opacity: 0.6;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.chain-type.l1 {
  opacity: 0.5;
}

.chain-type.l2 {
  opacity: 0.5;
}

/* Dropdown transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Token Table */
.table-container {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 20px -20px;
  padding: 0 20px;
  transition: opacity 0.3s ease;
}

.table-container.refreshing {
  opacity: 0.7;
  pointer-events: none;
}

.token-table {
  transition: filter 0.3s ease;
}

.token-table.loading {
  filter: blur(1px);
}

.token-table {
  width: 100%;
  border-collapse: collapse;
}

.token-table th {
  text-align: left;
  padding: 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
}

.th-value {
  text-align: right;
}

.token-row {
  transition: background 0.2s;
}

.token-row:hover {
  background: var(--bg-hover);
}

/* Low-value rows animation */
.token-table.show-low-value .low-value-row {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  animation: fadeInSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: calc(var(--row-index, 0) * 0.05s);
}

.token-table.show-low-value .divider-row-animate {
  opacity: 0;
  transform: translateY(-8px);
  animation: fadeInSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes fadeInSlideUp {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  60% {
    transform: translateY(2px) scale(1);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.token-row td {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
}

.token-row:last-child td {
  border-bottom: none;
}

.td-token {
  width: 60%;
}

.td-value {
  text-align: right;
  vertical-align: middle;
}

.value-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.token-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.token-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.token-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-placeholder {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
}

.token-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.token-symbol-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.token-symbol {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 15px;
}

.token-address-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-mono);
}

.token-address-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.token-address-btn.copied {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.token-address {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.token-address-btn.copied .token-address {
  color: var(--success);
  font-weight: 600;
}

.token-address-btn .copy-icon {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.7;
}

.token-address-btn:hover .copy-icon {
  color: var(--text-secondary);
  opacity: 1;
}

.token-address-btn.copied .copy-icon {
  color: var(--success);
  opacity: 1;
}

.token-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.token-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.chain-badge-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chain-badge-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: contain;
}

.chain-badge {
  font-size: 10px;
  color: var(--accent-primary);
  background: var(--accent-muted);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.usd-value {
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.2;
}

.usd-value.has-value {
  color: var(--success);
}

.balance-value {
  font-weight: 500;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.2;
}

.divider-row {
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.divider-cell {
  padding: 16px 0;
  text-align: center;
}

.show-low-value-btn,
.hide-low-value-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.show-low-value-btn:hover,
.hide-low-value-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
  color: var(--text-primary);
}

/* Responsive */
@media (max-width: 640px) {
  .token-name {
    display: none;
  }

  .token-logo {
    width: 32px;
    height: 32px;
  }

  .total-value {
    font-size: 14px;
  }
}
</style>
