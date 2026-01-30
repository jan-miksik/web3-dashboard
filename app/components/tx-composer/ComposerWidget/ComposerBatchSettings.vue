<script setup lang="ts">
interface BatchBreakdown {
  totalCalls: number
  batchCount: number
  maxSize: number
  batches: Array<{ batchNumber: number; callCount: number }>
  isMetaMask: boolean
}

const props = defineProps<{
  isCheckingSupport: boolean
  supportsBatching: boolean | null
  useBatching: boolean
  batchMethod: string
  needsMultipleBatches: boolean
  walletProviderDisplayName: string
  maxBatchSize: number
  estimatedBatchCount: number
  estimatedCallCount: number
  batchBreakdown?: BatchBreakdown | null
}>()
</script>

<template>
  <div class="composer-batch-settings">
    <div
      v-if="
        !props.isCheckingSupport &&
        props.supportsBatching &&
        props.useBatching &&
        props.needsMultipleBatches
      "
      :class="[
        'composer-batch-settings__batch-info',
        {
          'composer-batch-settings__batch-info--metamask': props.batchBreakdown?.isMetaMask,
        },
      ]"
    >
      <div class="composer-batch-settings__batch-info-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.25" />
          <path d="M8 7V12" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
          <path d="M8 5.25H8.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
        </svg>
      </div>
      <div class="composer-batch-settings__batch-info-content">
        <div class="composer-batch-settings__batch-info-header">
          <span class="composer-batch-settings__batch-info-text">
            <strong>{{ props.walletProviderDisplayName }}</strong> supports max
            <strong>{{ props.maxBatchSize }} calls/batch</strong>.
            <template v-if="props.batchBreakdown">
              This will require <strong>{{ props.estimatedBatchCount }} batches</strong> ({{
                props.estimatedCallCount
              }}
              total calls).
            </template>
            <template v-else>
              This will require <strong>{{ props.estimatedBatchCount }} batches</strong> ({{
                props.estimatedCallCount
              }}
              total calls).
            </template>
          </span>
        </div>
        <div
          v-if="props.batchBreakdown && props.batchBreakdown.batches.length > 0"
          class="composer-batch-settings__batch-breakdown"
        >
          <div class="composer-batch-settings__batch-breakdown-title">Batch breakdown:</div>
          <div class="composer-batch-settings__batch-breakdown-list">
            <div
              v-for="batch in props.batchBreakdown.batches"
              :key="batch.batchNumber"
              class="composer-batch-settings__batch-item"
            >
              <span class="composer-batch-settings__batch-item-number"
                >Batch {{ batch.batchNumber }}:</span
              >
              <span class="composer-batch-settings__batch-item-count"
                >{{ batch.callCount }} call{{ batch.callCount !== 1 ? 's' : '' }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="props.supportsBatching === false" class="composer-batch-settings__info-text">
      Wallet does not support batching; will execute sequentially.
    </div>
  </div>
</template>

<style scoped>
.composer-batch-settings {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.composer-batch-settings__batch-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  border-left: 3px solid var(--warning, #f59e0b);
}

.composer-batch-settings__batch-info--metamask {
  background: rgba(255, 193, 7, 0.08);
  border-color: rgba(255, 193, 7, 0.3);
  border-left-color: #ffc107;
}

.composer-batch-settings__batch-info-icon {
  color: var(--warning, #f59e0b);
  flex-shrink: 0;
  margin-top: 1px;
}

.composer-batch-settings__batch-info--metamask .composer-batch-settings__batch-info-icon {
  color: #ffc107;
}

.composer-batch-settings__batch-info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer-batch-settings__batch-info-header {
  flex: 1;
}

.composer-batch-settings__batch-info-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.composer-batch-settings__batch-info-text strong {
  color: var(--text-primary);
  font-weight: 600;
}

.composer-batch-settings__batch-breakdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
}

.composer-batch-settings__batch-breakdown-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.composer-batch-settings__batch-breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.composer-batch-settings__batch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.composer-batch-settings__batch-item-number {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 60px;
}

.composer-batch-settings__batch-item-count {
  color: var(--text-secondary);
}

.composer-batch-settings__info-text {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 0;
}
</style>
