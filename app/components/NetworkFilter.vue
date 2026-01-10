<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { ChainMetadata } from '~/utils/chains'
import { formatUsdValueParts } from '~/utils/format'

interface Props {
  chainsWithAssets: ChainMetadata[]
  chainsWithoutAssets: ChainMetadata[]
  selectedChainIds: Set<number>
  selectedChainsDisplay: string
  showChainFilter: boolean
  isChainSelected: (chainId: number) => boolean
  onToggleChain: (chainId: number) => void
  onClickAllNetworks: () => void
  allNetworksLabel?: string
  chainBalances?: Record<number, number>
}

const props = defineProps<Props>()

const chainFilterRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  'update:showChainFilter': [value: boolean]
}>()

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (chainFilterRef.value && !chainFilterRef.value.contains(target)) {
    emit('update:showChainFilter', false)
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

const formatBalance = (val: number | undefined) => {
  if (val === undefined || val === 0) return ''
  const parts = formatUsdValueParts(val)
  return `${parts.main}${parts.extra || ''}`
}
</script>

<template>
  <div ref="chainFilterRef" class="network-filter-container">
    <button
      class="network-filter-btn"
      data-testid="network-filter-btn"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="showChainFilter ? 'true' : 'false'"
      aria-label="Filter tokens by network"
      :class="{ active: selectedChainIds.size > 0 }"
      @click="$emit('update:showChainFilter', !showChainFilter)"
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
          @click="onClickAllNetworks"
        >
          <span class="option-name">{{ allNetworksLabel ?? 'All Networks' }}</span>
          <span v-if="selectedChainIds.size === 0" class="checkmark">✓</span>
        </button>
        <!-- Chains with assets -->
        <button
          v-for="chain in chainsWithAssets"
          :key="chain.id"
          class="filter-option"
          data-testid="network-filter-option"
          :class="{ selected: isChainSelected(chain.id) }"
          @click="onToggleChain(chain.id)"
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
            <span v-if="chainBalances?.[chain.id]" class="chain-balance">
              {{ formatBalance(chainBalances[chain.id]) }}
            </span>
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
          @click="onToggleChain(chain.id)"
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
</template>

<style scoped>
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
  width: 100%;
  justify-content: space-between;
}

.network-filter-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.network-filter-btn.active {
  border-color: var(--accent-primary);
  background: var(--accent-muted);
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
  min-width: 220px;
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

.chain-balance {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  font-family: var(--font-mono);
}

.filter-option.selected .chain-balance {
  color: var(--accent-primary);
  opacity: 0.8;
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
</style>
