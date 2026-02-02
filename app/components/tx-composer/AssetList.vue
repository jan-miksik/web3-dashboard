<script setup lang="ts">
import { computed } from 'vue'
import { type ComposerToken, useTxComposer } from '~/composables/useTxComposer'
import { getTokenKey } from '~/utils/tokenKey'
import { shortenAddress, formatUsdValueParts } from '~/utils/format'
import { useCopyToClipboard } from '~/composables/useCopyToClipboard'

const props = defineProps<{
  tokens: ComposerToken[]
  selectedIds: Set<string>
}>()

const { toggleToken, selectTokens, deselectTokens } = useTxComposer()

const groupedTokens = computed(() => {
  const groups: Record<string, ComposerToken[]> = {}
  props.tokens.forEach(token => {
    if (!groups[token.chainName]) groups[token.chainName] = []
    groups[token.chainName]!.push(token)
  })
  return groups
})

const isChainSelected = (chainTokens: ComposerToken[]) => {
  if (chainTokens.length === 0) return false
  return chainTokens.every(t => props.selectedIds.has(getTokenKey(t)))
}

const toggleChainSelection = (chainTokens: ComposerToken[]) => {
  if (isChainSelected(chainTokens)) {
    deselectTokens(chainTokens)
  } else {
    selectTokens(chainTokens)
  }
}

const { copy: copyTokenAddress, copiedValue: copiedAddress } = useCopyToClipboard({
  clearAfterMs: 2000,
})
</script>

<template>
  <div class="asset-list">
    <div v-if="tokens.length === 0" class="empty-state">
      <p>No assets found in the selected USD range.</p>
    </div>

    <div v-else class="list-wrapper">
      <div v-for="(chainTokens, chainName) in groupedTokens" :key="chainName" class="chain-group">
        <div class="chain-header">
          <div
            class="chain-title-wrapper"
            role="checkbox"
            tabindex="0"
            :aria-checked="isChainSelected(chainTokens)"
            :aria-label="`Select all assets on ${chainName}`"
            @click="toggleChainSelection(chainTokens)"
            @keydown.enter.prevent="toggleChainSelection(chainTokens)"
            @keydown.space.prevent="toggleChainSelection(chainTokens)"
          >
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
            @click="toggleToken(token)"
          >
            <div class="token-header">
              <img v-if="token.logoURI" :src="token.logoURI" class="token-logo" alt="" />
              <div v-else class="token-logo-placeholder">{{ token.symbol[0] }}</div>
              <div class="token-info">
                <span class="token-symbol">
                  {{ token.symbol }}
                  <span
                    v-if="token.tokenType === 'native'"
                    class="native-badge tooltip"
                    data-tooltip="Native token does not have a contract address"
                  >
                    NATIVE
                  </span>
                </span>
                <span class="token-balance">{{ token.formattedBalance }}</span>
              </div>
            </div>

            <div class="token-value">
              <span>{{ formatUsdValueParts(token.usdValue).main }}</span>
              <span v-if="formatUsdValueParts(token.usdValue).extra" class="usd-sub-decimals">
                {{ formatUsdValueParts(token.usdValue).extra }}
              </span>
            </div>

            <div class="token-address-row">
              <button
                v-if="
                  token.tokenType !== 'native' &&
                  token.address &&
                  token.address !== '0x0000000000000000000000000000000000000000'
                "
                class="token-address-btn"
                :class="{ copied: copiedAddress === token.address }"
                :title="copiedAddress === token.address ? 'Copied!' : 'Copy contract address'"
                @click.stop="copyTokenAddress(token.address)"
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
              <button
                v-else
                type="button"
                class="native-info-btn tooltip"
                data-tooltip="Native token does not have a contract address"
                aria-label="Native token info"
                @click.stop="() => {}"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.25" />
                  <path
                    d="M8 7V12"
                    stroke="currentColor"
                    stroke-width="1.25"
                    stroke-linecap="round"
                  />
                  <path
                    d="M8 5.25H8.01"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>

            <div
              class="selection-indicator"
              role="checkbox"
              tabindex="0"
              :aria-checked="selectedIds.has(`${token.chainId}-${token.address}`)"
              :aria-label="`Select ${token.symbol} on ${chainName}`"
              @click.stop="toggleToken(token)"
              @keydown.enter.stop.prevent="toggleToken(token)"
              @keydown.space.stop.prevent="toggleToken(token)"
            >
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
.asset-list {
  --native-token-rgb: 14, 165, 233;
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

.chain-title-wrapper:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 3px;
  border-radius: 8px;
}

.chain-title-wrapper:focus-visible .checkbox,
.selection-indicator:focus-visible .checkbox {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.25);
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
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

@media (max-width: 768px) {
  .tokens-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .token-card {
    padding: 14px;
    min-height: 72px;
  }

  .chain-title-wrapper {
    min-height: 44px;
    padding: 4px 0;
    -webkit-tap-highlight-color: transparent;
  }

  .selection-indicator {
    min-width: 40px;
    min-height: 40px;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .token-address-btn,
  .native-info-btn {
    min-height: 36px;
    padding: 8px 10px;
  }
}

.token-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

.token-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.token-card.selected {
  background: rgba(var(--primary-rgb), 0.1);
  border-color: var(--primary-color);
}

.token-card.native {
  background: linear-gradient(
    135deg,
    rgba(var(--native-token-rgb), 0.12) 0%,
    rgba(var(--native-token-rgb), 0.06) 100%
  );
  border: 2px solid rgba(var(--native-token-rgb), 0.25);
  box-shadow:
    0 0 0 1px rgba(var(--native-token-rgb), 0.05),
    0 2px 8px rgba(var(--native-token-rgb), 0.08);
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

.token-balance {
  font-size: 10px;
  color: var(--text-secondary);
}

.token-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.usd-sub-decimals {
  color: var(--text-muted);
  opacity: 0.85;
  font-size: 0.9em;
}

.token-address-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.token-address-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid transparent;
  padding: 2px 6px;
  border-radius: 6px;
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

.copy-icon {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.8;
}

.token-address-btn.copied .copy-icon {
  color: var(--success);
  opacity: 1;
}

.native-info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: default;
  color: var(--text-secondary);
}

.native-info-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
  color: var(--text-primary);
}

.tooltip {
  position: relative;
}

.tooltip:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 6px 8px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.3;
  max-width: 400px;
  width: 210px;
  white-space: normal;
  text-align: center;
  z-index: 50;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.selection-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  border-radius: 6px;
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
