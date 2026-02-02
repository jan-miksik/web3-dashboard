<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AppTxRecord } from '~/composables/useTransactionHistory'
import { getChainName } from '~/utils/chains'

const props = defineProps<{
  latestSuccess: AppTxRecord | null
  transactions: AppTxRecord[]
}>()

const showAll = ref(false)

const displayedTransactions = computed(() => {
  if (showAll.value) return props.transactions
  return props.transactions.slice(0, 5)
})

const hasMore = computed(() => props.transactions.length > 5)

function getExplorerUrl(tx: AppTxRecord): string {
  if (tx.explorerUrl) return tx.explorerUrl

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

  const baseUrl = explorerMap[tx.chainId] || `https://explorer.chain${tx.chainId}.io`
  return `${baseUrl}/tx/${tx.hash}`
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
</script>

<template>
  <div class="composer-transaction-recap">
    <div class="composer-transaction-recap__header">Transaction Recap</div>

    <div v-if="props.latestSuccess" class="composer-transaction-recap__success-row">
      <div class="composer-transaction-recap__success-header">
        <span
          class="composer-transaction-recap__status-pill composer-transaction-recap__status-pill--success"
        >
          Success
        </span>
        <span class="composer-transaction-recap__timestamp">{{
          formatTimestamp(props.latestSuccess.timestamp)
        }}</span>
        <span class="composer-transaction-recap__chain">{{
          getChainName(props.latestSuccess.chainId)
        }}</span>
        <a
          :href="getExplorerUrl(props.latestSuccess)"
          target="_blank"
          rel="noopener noreferrer"
          class="composer-transaction-recap__explorer-link"
        >
          View on Explorer
        </a>
      </div>
      <div
        v-if="props.latestSuccess.outputSummary"
        class="composer-transaction-recap__output-summary"
      >
        {{ props.latestSuccess.outputSummary }}
      </div>
      <div class="composer-transaction-recap__details-grid">
        <div
          v-if="props.latestSuccess.inputSummary"
          class="composer-transaction-recap__detail-item"
        >
          <span class="composer-transaction-recap__detail-label">Input</span>
          <span class="composer-transaction-recap__detail-value">{{
            props.latestSuccess.inputSummary
          }}</span>
        </div>
        <div
          v-if="props.latestSuccess.outputSummary"
          class="composer-transaction-recap__detail-item"
        >
          <span class="composer-transaction-recap__detail-label">Output</span>
          <span class="composer-transaction-recap__detail-value">{{
            props.latestSuccess.outputSummary
          }}</span>
        </div>
        <div v-if="props.latestSuccess.feeSummary" class="composer-transaction-recap__detail-item">
          <span class="composer-transaction-recap__detail-label">Fees</span>
          <span class="composer-transaction-recap__detail-value">{{
            props.latestSuccess.feeSummary
          }}</span>
        </div>
        <div v-if="props.latestSuccess.batchCount" class="composer-transaction-recap__detail-item">
          <span class="composer-transaction-recap__detail-label">Batch</span>
          <span class="composer-transaction-recap__detail-value"
            >{{ props.latestSuccess.batchCount }} calls</span
          >
        </div>
        <div class="composer-transaction-recap__detail-item">
          <span class="composer-transaction-recap__detail-label">Hash</span>
          <span class="composer-transaction-recap__detail-value"
            >{{ props.latestSuccess.hash.slice(0, 10) }}...</span
          >
        </div>
      </div>
    </div>

    <div v-if="displayedTransactions.length > 0" class="composer-transaction-recap__recent-list">
      <div
        v-for="tx in displayedTransactions"
        :key="`${tx.hash}-${tx.chainId}`"
        data-test="tx-row"
        class="composer-transaction-recap__tx-row"
      >
        <span class="composer-transaction-recap__tx-hash">{{ tx.hash.slice(0, 10) }}...</span>
        <span class="composer-transaction-recap__tx-chain">{{ getChainName(tx.chainId) }}</span>
        <span class="composer-transaction-recap__tx-time">{{ formatTimestamp(tx.timestamp) }}</span>
      </div>
    </div>

    <button
      v-if="hasMore && !showAll"
      data-test="show-more"
      class="composer-transaction-recap__show-more"
      @click="showAll = true"
    >
      Show more
    </button>
  </div>
</template>

<style scoped>
.composer-transaction-recap {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.composer-transaction-recap__header {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.composer-transaction-recap__success-row {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.composer-transaction-recap__success-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.composer-transaction-recap__status-pill {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.composer-transaction-recap__status-pill--success {
  background: rgba(60, 179, 113, 0.15);
  color: mediumseagreen;
}

.composer-transaction-recap__timestamp {
  font-size: 12px;
  color: var(--text-secondary);
}

.composer-transaction-recap__chain {
  font-size: 12px;
  color: var(--text-secondary);
}

.composer-transaction-recap__explorer-link {
  font-size: 12px;
  color: var(--text-primary);
  text-decoration: none;
  margin-left: auto;
}

.composer-transaction-recap__explorer-link:hover {
  text-decoration: underline;
}

.composer-transaction-recap__output-summary {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.composer-transaction-recap__details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.composer-transaction-recap__detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.composer-transaction-recap__detail-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.composer-transaction-recap__detail-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.composer-transaction-recap__recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer-transaction-recap__tx-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 13px;
}

.composer-transaction-recap__tx-hash {
  font-family: monospace;
  color: var(--text-primary);
}

.composer-transaction-recap__tx-chain {
  color: var(--text-secondary);
}

.composer-transaction-recap__tx-time {
  color: var(--text-secondary);
  margin-left: auto;
}

.composer-transaction-recap__show-more {
  margin-top: 12px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
}

.composer-transaction-recap__show-more:hover {
  background: var(--bg-secondary);
}
</style>
