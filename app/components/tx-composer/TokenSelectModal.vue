<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { getPublicClient } from '@wagmi/core'
import { useConfig, type Config } from '@wagmi/vue'
import { isAddress, parseAbi, type Address } from 'viem'
import { CHAIN_METADATA, getChainName } from '~/utils/chains'
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
  (e: 'select-chain', chainId: number | null): void
  (e: 'close'): void
}>()

const config = useConfig() as unknown as Config

const modalRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const showChainFilter = ref(false)
const resolvedToken = ref<ResolvedToken | null>(null)
const isResolving = ref(false)
const resolveError = ref<string | null>(null)

const ERC20_META_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
])

const chainName = computed(() =>
  props.chainId !== null ? getChainName(props.chainId) : 'Select chain'
)
const selectedChainIds = computed(() =>
  props.chainId !== null ? new Set([props.chainId]) : new Set<number>()
)
function isChainSelected(chainId: number) {
  return props.chainId === chainId
}
function onToggleChain(chainId: number) {
  emit('select-chain', chainId)
}
function onClearChain() {
  emit('select-chain', null)
}
function setShowChainFilter(value: boolean) {
  showChainFilter.value = value
}

const commonTokens = computed(() => {
  if (props.chainId === null) return []
  return getCommonTokens(props.chainId)
})

const { tokens: verifiedTokens, isLoading: isVerifiedListLoading } = useVerifiedTokenList({
  chainId: computed(() => props.chainId),
})

/** Common tokens first, then verified list tokens (not in common) sorted by symbol so known/popular order is stable. */
const listTokens = computed((): Array<ResolvedToken & { logoURI?: string }> => {
  const common = commonTokens.value
  const verified = verifiedTokens.value
  const commonAddrs = new Set(common.map(t => t.address.toLowerCase()))
  const extra = verified
    .filter(t => !commonAddrs.has(t.address.toLowerCase()))
    .slice()
    .sort((a, b) =>
      (a.symbol ?? '').localeCompare(b.symbol ?? '', undefined, { sensitivity: 'base' })
    )
  return [...common, ...extra]
})

const filteredTokens = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = listTokens.value
  if (!q) return list
  const qNo0x = q.startsWith('0x') ? q.slice(2) : q
  return list.filter(t => {
    const symbol = t.symbol?.toLowerCase?.() ?? ''
    const name = t.name?.toLowerCase?.() ?? ''
    const addr = t.address?.toLowerCase?.() ?? ''
    const addrNo0x = addr.startsWith('0x') ? addr.slice(2) : addr
    return (
      symbol.includes(q) ||
      name.includes(q) ||
      addr.includes(q) ||
      (qNo0x.length >= 4 && addrNo0x.includes(qNo0x))
    )
  })
})

async function resolveCustomToken() {
  resolvedToken.value = null
  resolveError.value = null

  if (props.chainId === null) {
    resolveError.value = 'Select a chain first'
    return
  }

  const addr = searchQuery.value.trim()
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

    const fromList = listTokens.value.find(
      t => t.address.toLowerCase() === (addr as Address).toLowerCase()
    )

    resolvedToken.value = {
      address: addr as Address,
      symbol: String(symbol),
      name: String(name),
      decimals: Number(decimals),
      logoURI: fromList?.logoURI,
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
  resolvedToken.value = null
  resolveError.value = null
  emit('close')
}

/** Shown when user typed a valid address that is not in the verified list — validate, warn, offer "Use this address". */
const showUnknownAddressUi = computed(() => {
  if (props.chainId === null) return false
  const q = searchQuery.value.trim()
  if (!q || !isAddress(q)) return false
  const inList = listTokens.value.some(t => t.address.toLowerCase() === q.toLowerCase())
  return !inList
})

function onTokenImageError(e: Event) {
  ;(e.target as HTMLImageElement).style.display = 'none'
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
      resolvedToken.value = null
      resolveError.value = null
    } else {
      await nextTick()
      modalRef.value?.focus()
    }
  }
)

watch(searchQuery, () => {
  resolvedToken.value = null
  resolveError.value = null
})

watch(
  () => props.chainId,
  async () => {
    searchQuery.value = ''
    resolvedToken.value = null
    resolveError.value = null
    await nextTick()
    listRef.value?.scrollTo?.({ top: 0 })
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
            <div class="token-select-modal__chain">
              <NetworkFilter
                :chains-with-assets="CHAIN_METADATA"
                :chains-without-assets="[]"
                :selected-chain-ids="selectedChainIds"
                :selected-chains-display="chainName"
                :show-chain-filter="showChainFilter"
                :is-chain-selected="isChainSelected"
                :on-toggle-chain="onToggleChain"
                :on-click-all-networks="onClearChain"
                all-networks-label="Select chain"
                @update:show-chain-filter="setShowChainFilter($event)"
              />
            </div>
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
              placeholder="Search by symbol, name, or address"
              autocomplete="off"
              aria-label="Search tokens by symbol, name, or address"
            />
          </div>

          <div v-if="chainId === null" class="token-select-modal__empty">
            Select a target chain first.
          </div>

          <template v-else>
            <div
              ref="listRef"
              class="token-select-modal__list"
              role="listbox"
              aria-label="Token list"
            >
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
                    @error="onTokenImageError"
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

            <div v-if="showUnknownAddressUi" class="token-select-modal__unknown-address">
              <p class="token-select-modal__unknown-warning">
                This address is not in the verified list. Use at your own risk.
              </p>
              <button
                type="button"
                class="token-select-modal__use-address-btn"
                :disabled="isResolving"
                @click="resolveCustomToken"
              >
                {{ isResolving ? 'Resolving…' : 'Use this address' }}
              </button>
              <p v-if="resolveError" class="token-select-modal__error">
                {{ resolveError }}
              </p>
              <div v-if="resolvedToken" class="token-select-modal__resolved">
                <button
                  type="button"
                  class="token-select-modal__item"
                  @click="selectToken(resolvedToken)"
                >
                  <img
                    v-if="resolvedToken.logoURI"
                    :src="resolvedToken.logoURI"
                    :alt="resolvedToken.symbol"
                    class="token-select-modal__icon"
                    @error="onTokenImageError"
                  />
                  <div v-else class="token-select-modal__icon-placeholder">
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  min-width: 0;
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

.token-select-modal__unknown-address {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.token-select-modal__unknown-warning {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 10px;
}

.token-select-modal__use-address-btn {
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

.token-select-modal__use-address-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.token-select-modal__use-address-btn:disabled {
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
