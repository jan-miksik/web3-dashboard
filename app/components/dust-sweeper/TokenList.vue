<script setup lang="ts">
import { computed } from 'vue'
import { type DustToken, useDustSweeper } from '~/composables/useDustSweeper'

const props = defineProps<{
  tokens: DustToken[]
  selectedIds: Set<string>
}>()

const { toggleToken, selectTokens, deselectTokens } = useDustSweeper()

const emit = defineEmits<{
  (e: 'toggle', token: DustToken): void
}>()

const onToggle = (token: DustToken) => {
  toggleToken(token)
}

const groupedTokens = computed(() => {
  const groups: Record<string, DustToken[]> = {}
  props.tokens.forEach(token => {
    if (!groups[token.chainName]) {
      groups[token.chainName] = []
    }
    groups[token.chainName]!.push(token)
  })
  return groups
})

const isAllSelected = computed(() => {
  if (props.tokens.length === 0) return false
  return props.tokens.every(t => props.selectedIds.has(`${t.chainId}-${t.address}`))
})

const toggleGlobalSelection = () => {
  if (isAllSelected.value) {
    deselectTokens(props.tokens)
  } else {
    selectTokens(props.tokens)
  }
}

const isChainSelected = (chainTokens: DustToken[]) => {
  if (chainTokens.length === 0) return false
  return chainTokens.every(t => props.selectedIds.has(`${t.chainId}-${t.address}`))
}

const toggleChainSelection = (chainTokens: DustToken[]) => {
  if (isChainSelected(chainTokens)) {
    deselectTokens(chainTokens)
  } else {
    selectTokens(chainTokens)
  }
}
</script>

<template>
  <div class="dust-token-list">
    <div v-if="tokens.length === 0" class="empty-state">
      <p>No dust found below the threshold.</p>
    </div>

    <div v-else class="list-wrapper">
      <div class="list-header">
        <div class="select-all-control" @click="toggleGlobalSelection">
          <div class="checkbox" :class="{ checked: isAllSelected }">
            <svg v-if="isAllSelected" viewBox="0 0 24 24" class="checkmark">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <span>Select All Assets</span>
        </div>
      </div>

      <div v-for="(chainTokens, chainName) in groupedTokens" :key="chainName" class="chain-group">
        <div class="chain-header">
          <div class="chain-title-wrapper" @click="toggleChainSelection(chainTokens)">
            <div class="checkbox" :class="{ checked: isChainSelected(chainTokens) }">
              <svg v-if="isChainSelected(chainTokens)" viewBox="0 0 24 24" class="checkmark">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            <h3 class="chain-title">{{ chainName }}</h3>
          </div>
        </div>
        <div class="tokens-grid">
          <div
            v-for="token in chainTokens"
            :key="`${token.chainId}-${token.address}`"
            class="token-card"
            :class="{
              selected: selectedIds.has(`${token.chainId}-${token.address}`),
              native: token.tokenType === 'native',
            }"
            @click="onToggle(token)"
          >
            <div class="token-header">
              <img v-if="token.logoURI" :src="token.logoURI" class="token-logo" alt="" />
              <div v-else class="token-logo-placeholder">{{ token.symbol[0] }}</div>
              <div class="token-info">
                <span class="token-symbol">
                  {{ token.symbol }}
                  <span v-if="token.tokenType === 'native'" class="native-badge">GAS</span>
                </span>
                <span class="token-balance">{{ token.formattedBalance }}</span>
              </div>
            </div>
            <div class="token-value">${{ token.usdValue.toFixed(2) }}</div>
            <div class="selection-indicator">
              <div
                class="checkbox"
                :class="{ checked: selectedIds.has(`${token.chainId}-${token.address}`) }"
              >
                <svg
                  v-if="selectedIds.has(`${token.chainId}-${token.address}`)"
                  viewBox="0 0 24 24"
                  class="checkmark"
                >
                  <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dust-token-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 12px;
}

.list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.list-header {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.select-all-control {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  user-select: none;
}

.chain-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chain-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.chain-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.chain-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.tokens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.token-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.token-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.token-card.selected {
  background: rgba(var(--primary-rgb), 0.1);
  border-color: var(--primary-color);
}

/* Native Token Styling */
.token-card.native {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(var(--primary-rgb), 0.05) 100%);
  border-style: dashed;
}

.token-card.native.selected {
  background: rgba(var(--primary-rgb), 0.15);
  border-style: solid;
}

.native-badge {
  font-size: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 2px 4px;
  border-radius: 4px;
  margin-left: 4px;
  vertical-align: middle;
  font-weight: 700;
}

.token-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.token-logo,
.token-logo-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.token-logo-placeholder {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.token-info {
  display: flex;
  flex-direction: column;
}

.token-symbol {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}

.token-balance {
  font-size: 10px;
  color: var(--text-secondary);
}

.token-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.selection-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
}

.checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.checkbox.checked {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.checkmark {
  width: 14px;
  height: 14px;
  color: white;
}
</style>
