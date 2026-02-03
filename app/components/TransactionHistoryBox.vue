<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AppTxRecord, TxHistorySwapLeg } from '~/composables/useTransactionHistory'
import { getChainName, getChainIcon } from '~/utils/chains'
import { shortenAddress, formatUsdValueString } from '~/utils/format'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Provider name → homepage URL for explorer links */
const PROVIDER_URLS: Record<string, string> = {
  Uniswap: 'https://app.uniswap.org',
  '1inch': 'https://app.1inch.io',
  Paraswap: 'https://app.paraswap.io',
  Stargate: 'https://stargate.finance',
  Across: 'https://across.to',
  Hop: 'https://hop.exchange',
  Socket: 'https://socket.tech',
  LI: 'https://li.fi',
}

const props = withDefaults(
  defineProps<{
    transactions: AppTxRecord[]
    /** When true, do not render the internal "Transaction History" heading (e.g. when page provides its own) */
    noHeading?: boolean
  }>(),
  { noHeading: false }
)

const showAll = ref(false)
const listExpanded = ref(true)
const expandedTx = ref<string | null>(null)
const copiedKey = ref<string | null>(null)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

function toggleList() {
  listExpanded.value = !listExpanded.value
}

function isNativeToken(address: string): boolean {
  return !address || address.toLowerCase() === ZERO_ADDRESS
}

function getProviderUrl(name: string): string | undefined {
  return (
    PROVIDER_URLS[name] ??
    Object.entries(PROVIDER_URLS).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1]
  )
}

async function copyAddress(address: string, key: string) {
  try {
    await navigator.clipboard.writeText(address)
    copiedKey.value = key
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copiedKey.value = null
      copyTimeout = null
    }, 2000)
  } catch {
    copiedKey.value = null
  }
}

/** Unique legs by fromToken (chainId:address) for Total Sent tooltip */
function getSentTokensSummary(tx: AppTxRecord): TxHistorySwapLeg[] {
  if (!tx.details?.legs?.length) return []
  const seen = new Set<string>()
  const result: TxHistorySwapLeg[] = []
  for (const leg of tx.details.legs) {
    const key = `${leg.chainId}:${leg.fromToken.address}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(leg)
  }
  return result
}

const displayedTransactions = computed(() => {
  if (showAll.value) return props.transactions
  return props.transactions.slice(0, 5)
})

const hasMore = computed(() => props.transactions.length > 5)

function getExplorerUrl(tx: AppTxRecord): string {
  if (tx.explorerUrl) return tx.explorerUrl
  const hash = tx.hash?.trim()
  if (hash && /^0x[0-9a-fA-F]{64}$/.test(hash) && tx.chainId != null) {
    const explorerMap: Record<number, string> = {
      1: 'https://etherscan.io',
      8453: 'https://basescan.org',
      42161: 'https://arbiscan.io',
      10: 'https://optimistic.etherscan.io',
      137: 'https://polygonscan.com',
      43114: 'https://snowtrace.io',
      250: 'https://ftmscan.com',
      42220: 'https://celoscan.io',
      100: 'https://gnosisscan.io',
      324: 'https://explorer.zksync.io',
    }
    const base = explorerMap[tx.chainId] ?? `https://explorer.chain${tx.chainId}.io`
    return `${base}/tx/${hash}`
  }
  return ''
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

function formatAmount(rawAmount: string, decimals: number): string {
  if (!rawAmount || rawAmount === '0') return '0'
  try {
    const amount = BigInt(rawAmount)
    const divisor = BigInt(10 ** decimals)
    const whole = amount / divisor
    const remainder = amount % divisor
    if (remainder === 0n) return whole.toString()
    const decimalsStr = remainder.toString().padStart(decimals, '0')
    const trimmed = decimalsStr.replace(/0+$/, '')
    return `${whole}.${trimmed}`
  } catch {
    return rawAmount
  }
}

function toggleDetails(txKey: string) {
  if (expandedTx.value === txKey) {
    expandedTx.value = null
  } else {
    expandedTx.value = txKey
  }
}

const txKey = (tx: AppTxRecord) => `${tx.hash}-${tx.chainId}`
</script>

<template>
  <div class="transaction-history-box">
    <button
      v-if="!props.noHeading"
      type="button"
      class="transaction-history-box__header-btn"
      @click="toggleList"
    >
      <span class="transaction-history-box__header-title">Transaction History</span>
      <svg
        class="transaction-history-box__header-chevron"
        :class="{ 'transaction-history-box__header-chevron--expanded': listExpanded }"
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

    <template v-if="listExpanded">
      <div v-if="displayedTransactions.length === 0" class="transaction-history-box__empty">
        No transactions yet
      </div>

      <div v-else class="transaction-history-box__list">
        <div
          v-for="tx in displayedTransactions"
          :key="txKey(tx)"
          class="transaction-history-box__item"
        >
          <div class="transaction-history-box__item-header">
            <div class="transaction-history-box__item-main">
              <span
                class="transaction-history-box__status-pill"
                :class="{
                  'transaction-history-box__status-pill--success': tx.status === 'success',
                  'transaction-history-box__status-pill--failed': tx.status === 'failed',
                  'transaction-history-box__status-pill--pending': tx.status === 'pending',
                }"
              >
                {{
                  tx.status === 'success'
                    ? 'Success'
                    : tx.status === 'failed'
                      ? 'Failed'
                      : 'Pending'
                }}
              </span>
              <span class="transaction-history-box__timestamp">{{
                formatTimestamp(tx.timestamp)
              }}</span>
              <span class="transaction-history-box__chain">
                <img
                  v-if="getChainIcon(tx.chainId)"
                  :src="getChainIcon(tx.chainId)!"
                  :alt="getChainName(tx.chainId)"
                  class="transaction-history-box__chain-icon"
                />
                {{ getChainName(tx.chainId) }}
              </span>
            </div>
            <a
              v-if="getExplorerUrl(tx)"
              :href="getExplorerUrl(tx)"
              target="_blank"
              rel="noopener noreferrer"
              class="transaction-history-box__explorer-link"
              aria-label="View on block explorer"
            >
              <svg
                class="transaction-history-box__explorer-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Explorer
            </a>
          </div>

          <div v-if="tx.status === 'success'" class="transaction-history-box__summary">
            <!-- Sent: label + token images, then $ amount -->
            <div class="transaction-history-box__summary-block">
              <div class="transaction-history-box__summary-row">
                <span class="transaction-history-box__summary-label">Sent</span>
                <div
                  v-if="tx.details?.legs?.length"
                  class="transaction-history-box__sent-tokens-wrap"
                >
                  <div class="transaction-history-box__sent-tokens">
                    <img
                      v-for="(leg, i) in getSentTokensSummary(tx).slice(0, 4)"
                      v-show="leg.fromToken.logoURI"
                      :key="`${leg.chainId}-${leg.fromToken.address}-${i}`"
                      :src="leg.fromToken.logoURI"
                      :alt="leg.fromToken.symbol"
                      class="transaction-history-box__sent-token-img"
                    />
                    <span
                      v-if="getSentTokensSummary(tx).length > 4"
                      class="transaction-history-box__sent-token-more"
                    >
                      +{{ getSentTokensSummary(tx).length - 4 }}
                    </span>
                  </div>
                  <div class="transaction-history-box__sent-tooltip">
                    <div
                      v-for="(leg, i) in getSentTokensSummary(tx)"
                      :key="i"
                      class="transaction-history-box__sent-tooltip-row"
                    >
                      {{ formatAmount(leg.fromAmount, leg.fromToken.decimals) }}
                      {{ leg.fromToken.symbol }}
                      <span
                        v-if="leg.fromAmountUsd !== undefined"
                        class="transaction-history-box__sent-tooltip-usd"
                      >
                        ({{ formatUsdValueString(leg.fromAmountUsd) }})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <span
                class="transaction-history-box__summary-usd transaction-history-box__summary-usd--sent"
              >
                <template v-if="tx.totalSellUsd !== undefined">
                  {{ formatUsdValueString(tx.totalSellUsd) }}
                </template>
                <template v-else-if="tx.inputSummary">{{ tx.inputSummary }}</template>
                <template v-else>—</template>
              </span>
            </div>

            <!-- Receive: label, then token amount + $ amount -->
            <div class="transaction-history-box__summary-block">
              <span class="transaction-history-box__summary-label">Receive</span>
              <div class="transaction-history-box__receive-block">
                <template v-if="tx.details && tx.details.outputToken">
                  <span v-if="tx.totalReceiveAmount" class="transaction-history-box__output-amount">
                    {{ formatAmount(tx.totalReceiveAmount, tx.details.outputToken.decimals ?? 18) }}
                    {{ tx.details.outputToken.symbol }}
                  </span>
                  <img
                    v-if="tx.details.outputToken.logoURI"
                    :src="tx.details.outputToken.logoURI"
                    :alt="tx.details.outputToken.symbol"
                    class="transaction-history-box__output-token-logo"
                  />
                  <span
                    v-if="tx.totalReceiveUsd !== undefined"
                    class="transaction-history-box__summary-usd"
                  >
                    {{ formatUsdValueString(tx.totalReceiveUsd) }}
                  </span>
                  <span
                    v-if="isNativeToken(tx.details.outputToken.address)"
                    class="transaction-history-box__native-badge"
                  >
                    Native
                  </span>
                  <button
                    v-else-if="tx.details.outputToken.address"
                    type="button"
                    class="transaction-history-box__address-btn"
                    :class="{
                      'transaction-history-box__address-btn--copied':
                        copiedKey === `${txKey(tx)}-output`,
                    }"
                    :title="
                      copiedKey === `${txKey(tx)}-output` ? 'Copied!' : 'Copy contract address'
                    "
                    @click="copyAddress(tx.details!.outputToken.address, `${txKey(tx)}-output`)"
                  >
                    <span class="transaction-history-box__address-text">{{
                      shortenAddress(tx.details.outputToken.address)
                    }}</span>
                    <svg
                      v-if="copiedKey === `${txKey(tx)}-output`"
                      class="transaction-history-box__copy-icon"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M3 8L6.5 11.5L13 5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <svg
                      v-else
                      class="transaction-history-box__copy-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </template>
                <template v-else>
                  <span class="transaction-history-box__summary-usd">
                    <template v-if="tx.totalReceiveUsd !== undefined && tx.outputTokenSymbol">
                      {{ formatUsdValueString(tx.totalReceiveUsd) }}
                    </template>
                    <template v-else-if="tx.outputSummary">{{ tx.outputSummary }}</template>
                    <template v-else>—</template>
                  </span>
                </template>
              </div>
            </div>

            <!-- Fees -->
            <div
              class="transaction-history-box__summary-block transaction-history-box__summary-block--fees"
            >
              <span class="transaction-history-box__summary-label">Fees</span>
              <span class="transaction-history-box__summary-fees-value">
                {{ tx.feeSummary || '—' }}
              </span>
            </div>
          </div>

          <div
            v-if="tx.details && tx.details.legs.length > 0"
            class="transaction-history-box__details"
          >
            <button
              type="button"
              class="transaction-history-box__details-toggle"
              @click="toggleDetails(txKey(tx))"
            >
              <span>{{ expandedTx === txKey(tx) ? 'Hide' : 'Show' }} Details</span>
              <svg
                class="transaction-history-box__details-icon"
                :class="{
                  'transaction-history-box__details-icon--expanded': expandedTx === txKey(tx),
                }"
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
            <Transition name="details-slide">
              <div v-if="expandedTx === txKey(tx)" class="transaction-history-box__details-content">
                <div
                  v-for="(leg, legIdx) in tx.details.legs"
                  :key="legIdx"
                  class="transaction-history-box__leg"
                >
                  <div class="transaction-history-box__leg-header">
                    <div class="transaction-history-box__leg-token">
                      <img
                        v-if="leg.fromToken.logoURI"
                        :src="leg.fromToken.logoURI"
                        :alt="leg.fromToken.symbol"
                        class="transaction-history-box__token-logo"
                      />
                      <div class="transaction-history-box__token-info">
                        <div class="transaction-history-box__token-symbol-row">
                          <span class="transaction-history-box__token-symbol-name">{{
                            leg.fromToken.symbol
                          }}</span>
                          <button
                            v-if="!isNativeToken(leg.fromToken.address)"
                            type="button"
                            class="transaction-history-box__address-btn transaction-history-box__address-btn--small"
                            :class="{
                              'transaction-history-box__address-btn--copied':
                                copiedKey === `${txKey(tx)}-leg-${legIdx}-from`,
                            }"
                            :title="
                              copiedKey === `${txKey(tx)}-leg-${legIdx}-from`
                                ? 'Copied!'
                                : 'Copy contract address'
                            "
                            @click="
                              copyAddress(leg.fromToken.address, `${txKey(tx)}-leg-${legIdx}-from`)
                            "
                          >
                            <span class="transaction-history-box__address-text">{{
                              shortenAddress(leg.fromToken.address)
                            }}</span>
                            <svg
                              v-if="copiedKey === `${txKey(tx)}-leg-${legIdx}-from`"
                              class="transaction-history-box__copy-icon"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path
                                d="M3 8L6.5 11.5L13 5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                            <svg
                              v-else
                              class="transaction-history-box__copy-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <span v-else class="transaction-history-box__native-badge--small"
                            >Native</span
                          >
                        </div>
                        <div v-if="leg.fromToken.name" class="transaction-history-box__token-name">
                          {{ leg.fromToken.name }}
                        </div>
                      </div>
                    </div>
                    <div class="transaction-history-box__leg-amounts">
                      <div class="transaction-history-box__leg-amount">
                        <span class="transaction-history-box__leg-amount-value">{{
                          formatAmount(leg.fromAmount, leg.fromToken.decimals)
                        }}</span>
                        <span class="transaction-history-box__leg-amount-usd">
                          {{
                            leg.fromAmountUsd !== undefined
                              ? formatUsdValueString(leg.fromAmountUsd)
                              : '—'
                          }}
                        </span>
                      </div>
                      <div class="transaction-history-box__leg-arrow">→</div>
                      <div
                        class="transaction-history-box__leg-amount transaction-history-box__leg-amount--to"
                      >
                        <div class="transaction-history-box__leg-to-token">
                          <img
                            v-if="tx.details.outputToken.logoURI"
                            :src="tx.details.outputToken.logoURI"
                            :alt="tx.details.outputToken.symbol"
                            class="transaction-history-box__token-logo transaction-history-box__token-logo--sm"
                          />
                          <span
                            v-if="leg.toAmount"
                            class="transaction-history-box__leg-amount-value"
                          >
                            {{
                              formatAmount(
                                leg.toAmount,
                                tx.details.outputToken.decimals ??
                                  (tx.details.outputToken.symbol === leg.fromToken.symbol
                                    ? leg.fromToken.decimals
                                    : 18)
                              )
                            }}
                            {{ tx.details.outputToken.symbol }}
                          </span>
                          <span
                            v-else
                            class="transaction-history-box__leg-amount-value transaction-history-box__leg-amount-value--pending"
                          >
                            Pending
                          </span>
                          <template v-if="isNativeToken(tx.details.outputToken.address)">
                            <span class="transaction-history-box__native-badge--small">Native</span>
                          </template>
                          <button
                            v-else-if="tx.details.outputToken.address"
                            type="button"
                            class="transaction-history-box__address-btn transaction-history-box__address-btn--small"
                            :class="{
                              'transaction-history-box__address-btn--copied':
                                copiedKey === `${txKey(tx)}-leg-${legIdx}-to`,
                            }"
                            :title="
                              copiedKey === `${txKey(tx)}-leg-${legIdx}-to`
                                ? 'Copied!'
                                : 'Copy contract address'
                            "
                            @click="
                              copyAddress(
                                tx.details!.outputToken.address,
                                `${txKey(tx)}-leg-${legIdx}-to`
                              )
                            "
                          >
                            <span class="transaction-history-box__address-text">{{
                              shortenAddress(tx.details.outputToken.address)
                            }}</span>
                            <svg
                              v-if="copiedKey === `${txKey(tx)}-leg-${legIdx}-to`"
                              class="transaction-history-box__copy-icon"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path
                                d="M3 8L6.5 11.5L13 5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                            <svg
                              v-else
                              class="transaction-history-box__copy-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                        <span class="transaction-history-box__leg-amount-usd">
                          {{
                            leg.toAmountUsd !== undefined
                              ? formatUsdValueString(leg.toAmountUsd)
                              : '—'
                          }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="leg.providers.length > 0"
                    class="transaction-history-box__leg-providers"
                  >
                    <span class="transaction-history-box__leg-providers-label">Providers:</span>
                    <span class="transaction-history-box__leg-providers-list">
                      <template v-for="(provider, pIdx) in leg.providers" :key="provider">
                        <a
                          v-if="getProviderUrl(provider)"
                          :href="getProviderUrl(provider)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="transaction-history-box__provider-link"
                        >
                          {{ provider }}
                        </a>
                        <span v-else>{{ provider }}</span>
                        <span v-if="pIdx < leg.providers.length - 1">, </span>
                      </template>
                    </span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <button
        v-if="hasMore && !showAll"
        class="transaction-history-box__show-more"
        @click="showAll = true"
      >
        Show more
      </button>
    </template>
  </div>
</template>

<style scoped>
.transaction-history-box {
  /* When inside composer widget, inherit background; standalone has its own */
  padding: 0;
}

.transaction-history-box__header-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 0 0 20px;
  margin: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.transaction-history-box__header-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.transaction-history-box__header-chevron {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.transaction-history-box__header-chevron--expanded {
  transform: rotate(180deg);
}

.transaction-history-box__header-btn:hover .transaction-history-box__header-chevron {
  color: var(--text-primary);
}

.transaction-history-box__empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 14px;
}

.transaction-history-box__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.transaction-history-box__item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
}

.transaction-history-box__item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.transaction-history-box__item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.transaction-history-box__status-pill {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.transaction-history-box__status-pill--success {
  background: rgba(60, 179, 113, 0.15);
  color: mediumseagreen;
}

.transaction-history-box__status-pill--failed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.transaction-history-box__status-pill--pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.transaction-history-box__timestamp {
  font-size: 13px;
  color: var(--text-secondary);
}

.transaction-history-box__chain {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.transaction-history-box__chain-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
}

.transaction-history-box__explorer-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--accent-primary);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.transaction-history-box__explorer-link:hover {
  text-decoration: underline;
}

.transaction-history-box__explorer-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.transaction-history-box__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 20px;
  margin-bottom: 12px;
}

.transaction-history-box__summary-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transaction-history-box__summary-block--fees {
  flex: 0 0 auto;
}

.transaction-history-box__summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.transaction-history-box__summary-usd {
  font-size: 14px;
  font-weight: 600;
  color: var(--success);
}

.transaction-history-box__summary-usd--sent {
  margin-top: 2px;
}

.transaction-history-box__summary-fees-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.transaction-history-box__receive-block {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
}

@media (max-width: 480px) {
  .transaction-history-box__summary {
    flex-direction: column;
    gap: 12px;
  }
}

.transaction-history-box__details-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  width: 100%;
  text-align: left;
}

.transaction-history-box__details-toggle:hover {
  color: var(--text-primary);
}

.transaction-history-box__details-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

.transaction-history-box__details-icon--expanded {
  transform: rotate(180deg);
}

.transaction-history-box__summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.transaction-history-box__summary-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.transaction-history-box__sent-tokens-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.transaction-history-box__sent-tokens {
  display: flex;
  align-items: center;
  gap: 2px;
}

.transaction-history-box__sent-token-img {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  margin-left: -5px;
}

.transaction-history-box__sent-token-img:first-child {
  margin-left: 0;
}

.transaction-history-box__sent-token-more {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: 2px;
}

.transaction-history-box__sent-tooltip {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 6px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.15s,
    visibility 0.15s;
  z-index: 20;
  min-width: 180px;
  pointer-events: none;
}

.transaction-history-box__sent-tokens-wrap:hover .transaction-history-box__sent-tooltip {
  opacity: 1;
  visibility: visible;
}

.transaction-history-box__sent-tooltip-row {
  padding: 2px 0;
}

.transaction-history-box__sent-tooltip-usd {
  color: var(--text-secondary);
  font-size: 11px;
  margin-left: 4px;
}

.transaction-history-box__receive-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.transaction-history-box__native-badge {
  font-size: 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.transaction-history-box__native-badge--small {
  font-size: 9px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 2px 4px;
  border-radius: 4px;
  font-weight: 600;
}

.transaction-history-box__address-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--text-secondary);
  -webkit-tap-highlight-color: transparent;
}

.transaction-history-box__address-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.transaction-history-box__address-btn--copied {
  background: var(--success-muted, rgba(60, 179, 113, 0.15));
  color: var(--success, mediumseagreen);
}

.transaction-history-box__address-btn--small {
  padding: 2px 4px;
  font-size: 10px;
}

.transaction-history-box__address-text {
  font-weight: 500;
}

.transaction-history-box__copy-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.transaction-history-box__provider-link {
  color: var(--accent-primary);
  text-decoration: none;
}

.transaction-history-box__provider-link:hover {
  text-decoration: underline;
}

.transaction-history-box__output-token-logo {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.transaction-history-box__output-amount {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.transaction-history-box__token-address {
  font-size: 12px;
  font-family: monospace;
  color: inherit;
}

.transaction-history-box__token-symbol {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
  margin-left: 4px;
}

.transaction-history-box__details {
  margin-top: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.transaction-history-box__details-content {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.transaction-history-box__leg {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}

.transaction-history-box__leg-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.transaction-history-box__leg-token {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.transaction-history-box__token-logo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.transaction-history-box__token-info {
  min-width: 0;
  flex: 1;
}

.transaction-history-box__token-symbol-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.transaction-history-box__token-symbol-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.transaction-history-box__token-address {
  font-size: 12px;
  font-family: monospace;
  color: var(--text-secondary);
}

.transaction-history-box__token-name {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.transaction-history-box__leg-amounts {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.transaction-history-box__leg-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.transaction-history-box__leg-amount-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.transaction-history-box__leg-amount-value--pending {
  color: var(--text-secondary);
  font-weight: 400;
}

.transaction-history-box__leg-amount-usd {
  font-size: 12px;
  color: var(--text-secondary);
}

.transaction-history-box__leg-amount--to {
  align-items: flex-end;
}

.transaction-history-box__leg-to-token {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.transaction-history-box__token-logo--sm {
  width: 20px;
  height: 20px;
}

.transaction-history-box__leg-arrow {
  font-size: 18px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.transaction-history-box__leg-providers {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.transaction-history-box__leg-providers-label {
  font-weight: 500;
}

.transaction-history-box__leg-providers-list {
  color: var(--text-primary);
}

.transaction-history-box__show-more {
  margin-top: 16px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  transition: background 0.2s ease;
}

.transaction-history-box__show-more:hover {
  background: var(--bg-tertiary);
}

.details-slide-enter-active,
.details-slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.details-slide-enter-from,
.details-slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.details-slide-enter-to,
.details-slide-leave-from {
  opacity: 1;
  max-height: 1000px;
  margin-top: 12px;
}
</style>
