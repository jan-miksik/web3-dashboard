<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChainMetadata } from '~/utils/chains'
import type { TargetAssetMode, ResolvedToken } from './types'

const props = defineProps<{
  // Chain selection
  chainsByBalance: ChainMetadata[]
  chainBalances: Record<number, number>
  selectedTargetChainIds: Set<number>
  selectedTargetChainDisplay: string
  showTargetChainFilter: boolean
  isTargetChainSelected: (chainId: number) => boolean
  onToggleTargetChain: (chainId: number) => void
  onClearTargetChain: () => void

  // Target asset selection
  targetChainId: number | null
  targetAssetMode: TargetAssetMode
  targetAssetOptions: Array<{ id: string; label: string; icon?: string }>
  selectedTargetOptionId: string
  selectTargetAsset: (modeOrAddress: string) => void
  selectCustomToken: (token: ResolvedToken) => void
  ownedTokens: ResolvedToken[]
  /** When native gas token is ETH, pass ETH icon URL so we show ETH symbol/icon instead of chain icon */
  nativeTokenLogoUrl?: string | null
  /** When true, auto-open token picker (e.g. after chain change couldn't map token). */
  needsTargetTokenSelection?: boolean
  /** Called after auto-opening the modal so the flag can be reset. */
  dismissTargetTokenSelectionPrompt?: () => void

  // Contract address + copy
  targetTokenAddress: string | null
  copiedAddress: string | null
  shortenAddress: (addr: string) => string
  copyAddress: (addr: string) => Promise<void>

  // Resolved custom token (from dropdown preset or modal)
  resolvedCustomToken: ResolvedToken | null
  targetTokenLabel: string
}>()

const emit = defineEmits<{
  (e: 'update:show-target-chain-filter', v: boolean): void
}>()

const chainsWithAssets = computed(() => props.chainsByBalance)
const chainsWithoutAssets = computed(() => [] as ChainMetadata[])

const showTokenSelectModal = ref(false)

watch(
  () => props.needsTargetTokenSelection,
  needs => {
    if (!needs) return
    showTokenSelectModal.value = true
    props.dismissTargetTokenSelectionPrompt?.()
  }
)

const selectedChain = computed(() => {
  if (props.targetChainId === null) return null
  return props.chainsByBalance.find(c => c.id === props.targetChainId) ?? null
})

const hasSelectedToken = computed(() => {
  if (props.targetChainId === null) return false
  if (props.targetAssetMode === 'native' || props.targetAssetMode === 'usdc') return true
  return props.resolvedCustomToken !== null
})

const selectedTokenForUi = computed(() => {
  if (props.targetChainId === null) return null

  if (props.targetAssetMode === 'native') {
    const symbol = props.targetTokenLabel.split(' ')[0] || 'Native'
    return {
      logoURI: props.nativeTokenLogoUrl ?? selectedChain.value?.icon,
      symbol,
      name: 'Native',
      address: null as string | null,
    }
  }

  if (props.targetAssetMode === 'usdc') {
    return {
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
      symbol: 'USDC',
      name: 'USD Coin',
      address: props.targetTokenAddress,
    }
  }

  if (props.resolvedCustomToken) {
    return {
      logoURI: props.resolvedCustomToken.logoURI,
      symbol: props.resolvedCustomToken.symbol,
      name: props.resolvedCustomToken.name,
      address: props.resolvedCustomToken.address,
    }
  }

  return null
})

function onSelectTokenFromModal(token: ResolvedToken) {
  props.selectCustomToken(token)
  showTokenSelectModal.value = false
}

function onSelectModeFromModal(mode: 'native' | 'usdc') {
  props.selectTargetAsset(mode)
  showTokenSelectModal.value = false
}

function onSelectChainFromModal(chainId: number | null) {
  if (chainId === null) {
    props.onClearTargetChain()
    return
  }
  props.onToggleTargetChain(chainId)
}
</script>

<template>
  <div class="composer-target-controls">
    <div class="composer-target-controls__group">
      <div class="composer-target-controls__label-row">
        <label class="composer-target-controls__label">To</label>
        <button
          v-if="selectedTokenForUi?.address"
          type="button"
          class="composer-target-controls__token-address-btn"
          :class="{
            'composer-target-controls__token-address-btn--copied':
              props.copiedAddress === selectedTokenForUi.address,
          }"
          :title="
            props.copiedAddress === selectedTokenForUi.address ? 'Copied!' : 'Copy contract address'
          "
          @click.stop="props.copyAddress(selectedTokenForUi.address)"
        >
          <span class="composer-target-controls__token-address">{{
            props.shortenAddress(selectedTokenForUi.address)
          }}</span>
          <svg
            v-if="props.copiedAddress === selectedTokenForUi.address"
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M3 8L6.5 11.5L13 5"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 16 16" fill="none">
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3.5C2.67157 2 2 2.67157 2 3.5V9C2 9.82843 2.67157 10.5 3.5 10.5H5.5"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </button>
      </div>

      <div class="composer-target-controls__destination-row">
        <button
          type="button"
          class="composer-target-controls__destination-btn"
          :class="{
            'composer-target-controls__destination-btn--empty': !hasSelectedToken,
            'composer-target-controls__destination-btn--selected': hasSelectedToken,
          }"
          @click="showTokenSelectModal = true"
        >
          <template v-if="selectedTokenForUi">
            <div class="composer-target-controls__destination-left">
              <img
                v-if="selectedTokenForUi.logoURI"
                :src="selectedTokenForUi.logoURI"
                class="composer-target-controls__token-logo"
                alt=""
              />
              <div v-else class="composer-target-controls__token-logo-placeholder">
                {{ selectedTokenForUi.symbol.slice(0, 1) }}
              </div>
              <div class="composer-target-controls__token-text">
                <span class="composer-target-controls__token-symbol">{{
                  selectedTokenForUi.symbol
                }}</span>
                <span class="composer-target-controls__token-name">{{
                  selectedTokenForUi.name
                }}</span>
              </div>
            </div>
          </template>
          <template v-else>
            <span class="composer-target-controls__select-token">Select Token</span>
          </template>
        </button>

        <div v-if="hasSelectedToken" class="composer-target-controls__chain-wrap">
          <NetworkFilter
            :chains-with-assets="chainsWithAssets"
            :chains-without-assets="chainsWithoutAssets"
            :selected-chain-ids="props.selectedTargetChainIds"
            :selected-chains-display="props.selectedTargetChainDisplay"
            :show-chain-filter="props.showTargetChainFilter"
            :is-chain-selected="props.isTargetChainSelected"
            :on-toggle-chain="props.onToggleTargetChain"
            :on-click-all-networks="props.onClearTargetChain"
            :chain-balances="props.chainBalances"
            all-networks-label="Select chain"
            @update:show-chain-filter="emit('update:show-target-chain-filter', $event)"
          />
        </div>
      </div>
    </div>

    <TxComposerTokenSelectModal
      :open="showTokenSelectModal"
      :chain-id="props.targetChainId"
      :current-token-address="props.targetTokenAddress"
      :owned-tokens="props.ownedTokens"
      :chains-by-balance="props.chainsByBalance"
      :chain-balances="props.chainBalances"
      @select="onSelectTokenFromModal"
      @select-mode="onSelectModeFromModal"
      @select-chain="onSelectChainFromModal"
      @close="showTokenSelectModal = false"
    />
  </div>
</template>

<style scoped>
.composer-target-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer-target-controls__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.composer-target-controls__label-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.composer-target-controls__label {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-primary);
}

.composer-target-controls__destination-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: stretch;
}

.composer-target-controls__destination-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s;
  height: 48px;
  box-sizing: border-box;
  flex: 0 1 auto;
  min-width: 0;
}

.composer-target-controls__destination-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.composer-target-controls__destination-btn--empty {
  /* Same padding as base (6px 10px) so button size matches selected state */
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  min-width: 160px;
  width: 320px;
  justify-content: center;
}

.composer-target-controls__destination-btn--empty:hover {
  border-color: var(--accent-primary);
  background: var(--accent-muted);
}

.composer-target-controls__destination-btn--selected {
  /* Prevent the selected token pill from growing too wide */
  flex: 0 1 320px;
  min-width: 0;
  max-width: 320px;
}

.composer-target-controls__select-token {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.composer-target-controls__chain-wrap {
  flex: 0 1 auto;
  min-width: 140px;
  max-width: 200px;
}

.composer-target-controls__chain-wrap :deep(.network-filter-btn) {
  min-height: 48px;
  height: 48px;
  box-sizing: border-box;
}

.composer-target-controls__destination-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.composer-target-controls__token-logo,
.composer-target-controls__token-logo-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.composer-target-controls__token-logo-placeholder {
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: var(--text-secondary);
}

.composer-target-controls__token-text {
  display: flex;
  align-items: baseline;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.composer-target-controls__token-symbol {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.composer-target-controls__token-name {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-target-controls__token-address-btn {
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
  width: fit-content;
  color: var(--text-secondary);
}

.composer-target-controls__token-address-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.composer-target-controls__token-address-btn--copied {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.composer-target-controls__token-address {
  font-size: 10px;
  color: inherit;
  font-weight: 500;
}

.composer-target-controls__token-address-btn--copied .composer-target-controls__token-address {
  color: inherit;
  font-weight: 600;
}

.composer-target-controls__error-text {
  color: var(--danger, #ef4444);
  font-size: 12px;
}

@media (max-width: 520px) {
  .composer-target-controls__chain-wrap {
    flex: 1 1 100%;
  }

  .composer-target-controls__destination-btn--selected {
    flex: 1 1 100%;
    max-width: 100%;
  }
}
</style>
