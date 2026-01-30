<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { getPublicClient } from '@wagmi/core'
import { useConfig, type Config } from '@wagmi/vue'
import { isAddress, parseAbi, type Address } from 'viem'
import { getChainName } from '~/utils/chains'
import { getCommonTokens } from '~/utils/tokenAddresses'
import { useVerifiedTokenList } from '~/composables/useVerifiedTokenList'
import type { ResolvedToken } from '~/components/tx-composer/ComposerWidget/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    chainId: number | null
    /** Current selected token address (for checkmark); string for template binding */
    currentTokenAddress: string | null
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'select', token: ResolvedToken): void
  (e: 'close'): void
}>()

const config = useConfig() as unknown as Config

const modalRef = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const customAddressInput = ref('')
const resolvedToken = ref<ResolvedToken | null>(null)
const isResolving = ref(false)
const resolveError = ref<string | null>(null)

const ERC20_META_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
])

const chainName = computed(() => (props.chainId !== null ? getChainName(props.chainId) : 'Unknown'))

const commonTokens = computed(() => {
  if (props.chainId === null) return []
  return getCommonTokens(props.chainId)
})

const { tokens: verifiedTokens, isLoading: isVerifiedListLoading } = useVerifiedTokenList({
  chainId: computed(() => props.chainId),
})

/** Common tokens first, then verified list tokens not already in common (by address). All have logoURI when available. */
const listTokens = computed((): Array<ResolvedToken & { logoURI?: string }> => {
  const common = commonTokens.value
  const verified = verifiedTokens.value
  const commonAddrs = new Set(common.map(t => t.address.toLowerCase()))
  const extra = verified.filter(t => !commonAddrs.has(t.address.toLowerCase()))
  return [...common, ...extra]
})

const filteredTokens = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = listTokens.value
  if (!q) return list
  return list.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
})

async function resolveCustomToken() {
  resolvedToken.value = null
  resolveError.value = null

  if (props.chainId === null) {
    resolveError.value = 'Select a chain first'
    return
  }

  const addr = customAddressInput.value.trim()
  if (!isAddress(addr)) {
    resolveError.value = 'Enter a valid token address'
    return
  }

  isResolving.value = true
  try {
    const pc = getPublicClient(config, { chainId: props.chainId })
    if (!pc) throw new Error('No public client')

    const [symbol, name, decimals] = await Promise.all([
      pc.readContract({ address: addr as Address, abi: ERC20_META_ABI, functionName: 'symbol' }),
      pc.readContract({ address: addr as Address, abi: ERC20_META_ABI, functionName: 'name' }),
      pc.readContract({
        address: addr as Address,
        abi: ERC20_META_ABI,
        functionName: 'decimals',
      }),
    ])

    resolvedToken.value = {
      address: addr as Address,
      symbol: String(symbol),
      name: String(name),
      decimals: Number(decimals),
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to resolve token'
    resolveError.value = message
  } finally {
    isResolving.value = false
  }
}

function selectToken(token: ResolvedToken) {
  emit('select', token)
  emit('close')
}

function handleClose() {
  searchQuery.value = ''
  customAddressInput.value = ''
  resolvedToken.value = null
  resolveError.value = null
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') handleClose()
}

function isSelected(address: string): boolean {
  return props.currentTokenAddress?.toLowerCase() === address.toLowerCase()
}

watch(
  () => props.open,
  async open => {
    if (!open) {
      searchQuery.value = ''
      customAddressInput.value = ''
      resolvedToken.value = null
      resolveError.value = null
    } else {
      await nextTick()
      modalRef.value?.focus()
    }
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="token-select-modal">
      <div
        v-if="open"
        ref="modalRef"
        tabindex="-1"
        class="token-select-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-select-modal-title"
        @keydown="handleKeydown"
      >
        <div class="token-select-modal__backdrop" @click="handleClose" />
        <div class="token-select-modal__content">
          <div class="token-select-modal__header">
            <h2 id="token-select-modal-title" class="token-select-modal__title">Select token</h2>
            <p v-if="chainId !== null" class="token-select-modal__chain">
              {{ chainName }}
            </p>
            <button
              type="button"
              class="token-select-modal__close"
              aria-label="Close"
              @click="handleClose"
            >
              ×
            </button>
          </div>

          <div class="token-select-modal__search">
            <input
              v-model="searchQuery"
              type="text"
              class="token-select-modal__search-input"
              placeholder="Search"
              autocomplete="off"
              aria-label="Search tokens by symbol or name"
            />
          </div>

          <div v-if="chainId === null" class="token-select-modal__empty">
            Select a target chain first.
          </div>

          <template v-else>
            <div class="token-select-modal__list" role="listbox" aria-label="Token list">
              <p
                v-if="isVerifiedListLoading && listTokens.length === 0"
                class="token-select-modal__loading"
              >
                Loading tokens…
              </p>
              <template v-else>
                <button
                  v-for="token in filteredTokens"
                  :key="token.address"
                  type="button"
                  class="token-select-modal__item"
                  :class="{
                    'token-select-modal__item--selected': isSelected(token.address),
                  }"
                  role="option"
                  :aria-selected="isSelected(token.address)"
                  @click="selectToken(token)"
                >
                  <img
                    v-if="token.logoURI"
                    :src="token.logoURI"
                    :alt="token.symbol"
                    class="token-select-modal__icon"
                  />
                  <div v-else class="token-select-modal__icon-placeholder">
                    {{ token.symbol.slice(0, 1) }}
                  </div>
                  <div class="token-select-modal__item-info">
                    <span class="token-select-modal__symbol">{{ token.symbol }}</span>
                    <span class="token-select-modal__name">{{ token.name }}</span>
                  </div>
                  <span v-if="isSelected(token.address)" class="token-select-modal__check">
                    ✓
                  </span>
                </button>
                <p v-if="filteredTokens.length === 0" class="token-select-modal__no-results">
                  {{
                    searchQuery.trim() ? 'No tokens match your search.' : 'No tokens on this chain.'
                  }}
                </p>
              </template>
            </div>

            <div class="token-select-modal__custom">
              <label class="token-select-modal__custom-label"> Or paste token address </label>
              <div class="token-select-modal__custom-row">
                <input
                  v-model="customAddressInput"
                  type="text"
                  class="token-select-modal__custom-input"
                  placeholder="0x…"
                  spellcheck="false"
                  autocomplete="off"
                  @keydown.enter="resolveCustomToken"
                />
                <button
                  type="button"
                  class="token-select-modal__custom-btn"
                  :disabled="isResolving || !customAddressInput.trim()"
                  @click="resolveCustomToken"
                >
                  {{ isResolving ? 'Resolving…' : 'Add' }}
                </button>
              </div>
              <p v-if="resolveError" class="token-select-modal__error">
                {{ resolveError }}
              </p>
              <div v-if="resolvedToken" class="token-select-modal__resolved">
                <button
                  type="button"
                  class="token-select-modal__item"
                  @click="selectToken(resolvedToken)"
                >
                  <div class="token-select-modal__icon-placeholder">
                    {{ resolvedToken.symbol.slice(0, 1) }}
                  </div>
                  <div class="token-select-modal__item-info">
                    <span class="token-select-modal__symbol">{{ resolvedToken.symbol }}</span>
                    <span class="token-select-modal__name">{{ resolvedToken.name }}</span>
                  </div>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.token-select-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.token-select-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

.token-select-modal__content {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: 85vh;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.token-select-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.token-select-modal__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.token-select-modal__chain {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  flex: 1;
}

.token-select-modal__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.token-select-modal__close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.token-select-modal__search {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
}

.token-select-modal__search-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.token-select-modal__search-input::placeholder {
  color: var(--text-muted);
}

.token-select-modal__search-input:focus {
  border-color: var(--accent-primary);
}

.token-select-modal__list {
  overflow-y: auto;
  padding: 8px;
  min-height: 120px;
  max-height: 280px;
}

.token-select-modal__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}

.token-select-modal__item:hover {
  background: var(--bg-hover);
}

.token-select-modal__item--selected {
  background: var(--accent-muted);
}

.token-select-modal__icon,
.token-select-modal__icon-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.token-select-modal__icon-placeholder {
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.token-select-modal__item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.token-select-modal__symbol {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.token-select-modal__name {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.token-select-modal__check {
  color: var(--success);
  font-weight: 700;
  font-size: 14px;
}

.token-select-modal__no-results,
.token-select-modal__loading {
  padding: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin: 0;
}

.token-select-modal__empty {
  padding: 24px 20px;
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}

.token-select-modal__custom {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.token-select-modal__custom-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.token-select-modal__custom-row {
  display: flex;
  gap: 8px;
}

.token-select-modal__custom-input {
  flex: 1;
  padding: 10px 14px;
  font-size: 14px;
  font-family: var(--font-mono);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
}

.token-select-modal__custom-input:focus {
  border-color: var(--accent-primary);
}

.token-select-modal__custom-btn {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.token-select-modal__custom-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.token-select-modal__custom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-select-modal__error {
  font-size: 12px;
  color: var(--error, #ef4444);
  margin: 8px 0 0;
}

.token-select-modal__resolved {
  margin-top: 12px;
}

.token-select-modal-enter-active,
.token-select-modal-leave-active {
  transition: opacity 0.2s ease;
}

.token-select-modal-enter-active .token-select-modal__content,
.token-select-modal-leave-active .token-select-modal__content {
  transition: transform 0.2s ease;
}

.token-select-modal-enter-from,
.token-select-modal-leave-to {
  opacity: 0;
}

.token-select-modal-enter-from .token-select-modal__content,
.token-select-modal-leave-to .token-select-modal__content {
  transform: scale(0.96);
}
</style>
