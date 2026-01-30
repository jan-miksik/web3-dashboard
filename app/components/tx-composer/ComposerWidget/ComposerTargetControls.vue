<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
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
  selectTargetAsset: (mode: TargetAssetMode) => void

  // Contract address + copy
  targetTokenAddress: string | null
  copiedAddress: string | null
  shortenAddress: (addr: string) => string
  copyAddress: (addr: string) => Promise<void>

  // Custom token resolver
  customTokenAddressInput: string
  resolvedCustomToken: ResolvedToken | null
  isResolvingCustomToken: boolean
  customTokenError: string | null
  resolveCustomToken: () => Promise<void>
  targetTokenLabel: string

  // Batch settings
  isCheckingSupport: boolean
  supportsBatching: boolean | null
  useBatching: boolean
  batchMethod: string
}>()

const emit = defineEmits<{
  (e: 'update:show-target-chain-filter', v: boolean): void
  (e: 'update:custom-token-address-input', v: string): void
  (e: 'update:use-batching', v: boolean): void
}>()

const showTargetAssetDropdown = ref(false)
const targetAssetDropdownRef = ref<HTMLElement | null>(null)

const handleClickOutsideDropdown = (event: MouseEvent) => {
  if (
    targetAssetDropdownRef.value &&
    !targetAssetDropdownRef.value.contains(event.target as Node)
  ) {
    showTargetAssetDropdown.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutsideDropdown)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutsideDropdown)
})
</script>

<template>
  <div class="composer-target-controls">
    <div class="composer-target-controls__row">
      <div class="composer-target-controls__group composer-target-controls__group--chain">
        <label class="composer-target-controls__label">to chain</label>
        <NetworkFilter
          :chains-with-assets="props.chainsByBalance"
          :chains-without-assets="[]"
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

      <div
        class="composer-target-controls__group composer-target-controls__group--asset composer-target-controls__asset-row"
      >
        <div class="composer-target-controls__label-with-address">
          <label class="composer-target-controls__label">to asset</label>
          <div
            v-if="props.targetAssetMode === 'usdc' && props.targetTokenAddress"
            class="composer-target-controls__inline-address"
          >
            <button
              class="composer-target-controls__token-address-btn composer-target-controls__token-address-btn--mini"
              :class="{
                'composer-target-controls__token-address-btn--copied':
                  props.copiedAddress === props.targetTokenAddress,
              }"
              :title="
                props.copiedAddress === props.targetTokenAddress
                  ? 'Copied!'
                  : 'Copy contract address'
              "
              @click="props.copyAddress(props.targetTokenAddress)"
            >
              <span class="composer-target-controls__token-address">
                {{ props.shortenAddress(props.targetTokenAddress) }}
              </span>
              <svg
                v-if="props.copiedAddress === props.targetTokenAddress"
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
        </div>

        <div class="composer-target-controls__asset-and-batch">
          <div
            ref="targetAssetDropdownRef"
            class="composer-target-controls__dropdown composer-target-controls__asset-selector"
          >
            <button
              class="composer-target-controls__dropdown-trigger"
              :disabled="props.targetChainId === null"
              @click.stop="showTargetAssetDropdown = !showTargetAssetDropdown"
            >
              <div class="composer-target-controls__trigger-content">
                <img
                  v-if="props.targetAssetOptions.find(o => o.id === props.targetAssetMode)?.icon"
                  :src="props.targetAssetOptions.find(o => o.id === props.targetAssetMode)?.icon"
                  class="composer-target-controls__option-icon"
                />
                <span class="composer-target-controls__trigger-label">{{
                  props.targetAssetOptions.find(o => o.id === props.targetAssetMode)?.label
                }}</span>
              </div>
              <span
                class="composer-target-controls__filter-arrow"
                :class="{
                  'composer-target-controls__filter-arrow--rotated': showTargetAssetDropdown,
                }"
              >
                ▼
              </span>
            </button>

            <div v-if="showTargetAssetDropdown" class="composer-target-controls__dropdown-menu">
              <button
                v-for="option in props.targetAssetOptions"
                :key="option.id"
                class="composer-target-controls__dropdown-option"
                :class="{
                  'composer-target-controls__dropdown-option--selected':
                    props.targetAssetMode === option.id,
                }"
                @click="props.selectTargetAsset(option.id as TargetAssetMode)"
              >
                <img
                  v-if="option.icon"
                  :src="option.icon"
                  class="composer-target-controls__option-icon"
                />
                <div
                  v-else-if="option.id === 'custom'"
                  class="composer-target-controls__option-icon-placeholder"
                >
                  ?
                </div>
                <span class="composer-target-controls__option-label">{{ option.label }}</span>
                <span
                  v-if="props.targetAssetMode === option.id"
                  class="composer-target-controls__checkmark"
                  >✓</span
                >
              </button>
            </div>
          </div>

          <div v-if="props.isCheckingSupport" class="composer-target-controls__checking-status">
            <span class="composer-target-controls__checking-spinner"></span>
            Checking wallet…
          </div>
          <label
            v-else-if="props.supportsBatching"
            class="composer-target-controls__checkbox-label"
          >
            <input
              :checked="props.useBatching"
              type="checkbox"
              class="composer-target-controls__checkbox"
              @change="emit('update:use-batching', ($event.target as HTMLInputElement).checked)"
            />
            <span>{{
              props.batchMethod === 'eip7702' ? 'One-Click Mode (EIP-7702)' : 'Batch (EIP-5792)'
            }}</span>
          </label>
        </div>
      </div>
    </div>

    <div
      v-if="props.targetAssetMode === 'custom'"
      class="composer-target-controls__custom-token-box"
    >
      <input
        :value="props.customTokenAddressInput"
        type="text"
        placeholder="0x… token address"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        class="composer-target-controls__compact-input"
        @input="
          emit('update:custom-token-address-input', ($event.target as HTMLInputElement).value)
        "
      />
      <button
        class="composer-target-controls__secondary-btn"
        :disabled="props.isResolvingCustomToken || props.targetChainId === null"
        @click="props.resolveCustomToken"
      >
        {{ props.isResolvingCustomToken ? 'Resolving…' : 'Resolve' }}
      </button>

      <div v-if="props.resolvedCustomToken" class="composer-target-controls__resolved-token">
        <div class="composer-target-controls__resolved-header">
          <span class="composer-target-controls__resolved-title">{{ props.targetTokenLabel }}</span>
          <button
            class="composer-target-controls__token-address-btn composer-target-controls__token-address-btn--mini"
            :class="{
              'composer-target-controls__token-address-btn--copied':
                props.copiedAddress === props.resolvedCustomToken.address,
            }"
            @click="props.copyAddress(props.resolvedCustomToken.address)"
          >
            <span class="composer-target-controls__token-address">
              {{ props.shortenAddress(props.resolvedCustomToken.address) }}
            </span>
            <svg
              v-if="props.copiedAddress === props.resolvedCustomToken.address"
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
      </div>
      <div v-else-if="props.customTokenError" class="composer-target-controls__error-text">
        {{ props.customTokenError }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-target-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.composer-target-controls__row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  align-items: start;
}

.composer-target-controls__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.composer-target-controls__label {
  font-size: 12px;
  color: var(--text-secondary);
}

.composer-target-controls__label-with-address {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}

.composer-target-controls__inline-address {
  display: flex;
  align-items: center;
  gap: 4px;
}

.composer-target-controls__dropdown {
  position: relative;
  width: 100%;
}

.composer-target-controls__dropdown-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s;
}

.composer-target-controls__dropdown-trigger:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.composer-target-controls__dropdown-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.composer-target-controls__trigger-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.composer-target-controls__trigger-label {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-target-controls__dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 110;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.composer-target-controls__dropdown-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
  text-align: left;
  transition: all 0.2s;
}

.composer-target-controls__dropdown-option:hover {
  background: var(--bg-hover);
}

.composer-target-controls__dropdown-option--selected {
  background: var(--accent-muted);
}

.composer-target-controls__option-icon,
.composer-target-controls__option-icon-placeholder {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.composer-target-controls__option-icon-placeholder {
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.composer-target-controls__option-label {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
}

.composer-target-controls__checkmark {
  color: mediumseagreen;
  font-weight: 700;
}

.composer-target-controls__filter-arrow {
  font-size: 10px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.composer-target-controls__filter-arrow--rotated {
  transform: rotate(180deg);
}

.composer-target-controls__custom-token-box {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.composer-target-controls__compact-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
}

.composer-target-controls__secondary-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.composer-target-controls__resolved-token {
  grid-column: 1 / -1;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.composer-target-controls__resolved-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.composer-target-controls__resolved-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
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
}

.composer-target-controls__token-address-btn--mini {
  padding: 1px 4px;
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
  color: var(--text-secondary);
  font-weight: 500;
}

.composer-target-controls__token-address-btn--copied .composer-target-controls__token-address {
  color: var(--success);
  font-weight: 600;
}

.composer-target-controls__error-text {
  color: var(--danger, #ef4444);
  font-size: 12px;
  grid-column: 1 / -1;
}

@media (max-width: 520px) {
  .composer-target-controls__row {
    grid-template-columns: 1fr;
  }

  .composer-target-controls__asset-and-batch {
    flex-direction: column;
    align-items: stretch;
  }

  .composer-target-controls__asset-selector {
    width: 100%;
  }
}

.composer-target-controls__asset-row {
  min-width: 0;
}

.composer-target-controls__asset-and-batch {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.composer-target-controls__asset-selector {
  width: 260px;
  min-width: 0;
}

.composer-target-controls__checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  user-select: none;
  padding: 4px 0;
  white-space: nowrap;
}

.composer-target-controls__checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin: 0;
  accent-color: var(--accent-primary, mediumseagreen);
  border-radius: 4px;
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  flex-shrink: 0;
  transition: all 0.2s;
}

.composer-target-controls__checkbox:focus {
  outline: 2px solid var(--accent-muted, rgba(60, 179, 113, 0.3));
  outline-offset: 2px;
}

.composer-target-controls__checking-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 0;
  white-space: nowrap;
}

.composer-target-controls__checking-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-color);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: composer-target-controls-spin 1s linear infinite;
}

@keyframes composer-target-controls-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
