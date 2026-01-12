<script setup lang="ts">
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
}>()

const emit = defineEmits<{
  (e: 'update:use-batching', v: boolean): void
}>()
</script>

<template>
  <div class="composer-batch-settings">
    <div v-if="props.isCheckingSupport" class="composer-batch-settings__checking-status">
      <span class="composer-batch-settings__spinner"></span> Checking wallet…
    </div>
    <div v-else-if="props.supportsBatching" class="composer-batch-settings__settings">
      <div class="composer-batch-settings__checkbox-line">
        <label class="composer-batch-settings__checkbox-label">
          <input
            :checked="props.useBatching"
            type="checkbox"
            class="composer-batch-settings__checkbox"
            @change="emit('update:use-batching', ($event.target as HTMLInputElement).checked)"
          />
          <span>{{
            props.batchMethod === 'eip7702' ? 'One-Click Mode (EIP-7702)' : 'Batch (EIP-5792)'
          }}</span>
        </label>
      </div>

      <div
        v-if="props.useBatching && props.needsMultipleBatches"
        class="composer-batch-settings__batch-info"
      >
        <div class="composer-batch-settings__batch-info-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.25" />
            <path d="M8 7V12" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            <path
              d="M8 5.25H8.01"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="composer-batch-settings__batch-info-content">
          <span class="composer-batch-settings__batch-info-text">
            {{ props.walletProviderDisplayName }} supports max {{ props.maxBatchSize }} calls/batch.
            This will require <strong>{{ props.estimatedBatchCount }} batches</strong> ({{
              props.estimatedCallCount
            }}
            total calls).
          </span>
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

.composer-batch-settings__checking-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.composer-batch-settings__spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-color);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.composer-batch-settings__settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer-batch-settings__checkbox-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.composer-batch-settings__checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  user-select: none;
  padding: 4px 0;
}

.composer-batch-settings__checkbox {
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

.composer-batch-settings__checkbox:focus {
  outline: 2px solid var(--accent-muted, rgba(60, 179, 113, 0.3));
  outline-offset: 2px;
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

.composer-batch-settings__batch-info-icon {
  color: var(--warning, #f59e0b);
  flex-shrink: 0;
  margin-top: 1px;
}

.composer-batch-settings__batch-info-content {
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

.composer-batch-settings__info-text {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
