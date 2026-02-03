<script setup lang="ts">
import { computed } from 'vue'
import { formatUsdValueParts } from '~/utils/format'

const props = defineProps<{
  selectedCount: number
  totalValueIn: number
  totalValueOut: number
  formattedTotalOutput: string
  outputTokenSymbol: string
  outputTokenLogoUrl?: string
  hasOutQuotes: boolean
}>()

const totalValueInParts = computed(() => formatUsdValueParts(props.totalValueIn))
const totalValueOutParts = computed(() => formatUsdValueParts(props.totalValueOut))
</script>

<template>
  <div class="composer-summary">
    <div class="composer-summary__scroll">
      <div class="composer-summary__stat">
        <label class="composer-summary__label">Selected</label>
        <span class="composer-summary__value">{{ props.selectedCount }}</span>
      </div>
      <div class="composer-summary__stat composer-summary__stat--row">
        <label class="composer-summary__label">Total Sent</label>
        <div class="composer-summary__value composer-summary__value--row">
          <span class="composer-summary__usd-value">{{ totalValueInParts.main }}</span>
          <span v-if="totalValueInParts.extra" class="composer-summary__usd-sub-decimals">
            {{ totalValueInParts.extra }}
          </span>
        </div>
      </div>
      <div class="composer-summary__stat composer-summary__stat--row">
        <label class="composer-summary__label">Total Receive</label>
        <div class="composer-summary__value composer-summary__value--row">
          <span>{{ props.formattedTotalOutput }}</span>
          <img
            v-if="props.outputTokenLogoUrl"
            :src="props.outputTokenLogoUrl"
            :alt="props.outputTokenSymbol"
            class="composer-summary__token-icon"
          />
          <span
            v-if="props.outputTokenSymbol && props.outputTokenSymbol !== 'Select target'"
            class="composer-summary__muted-symbol"
          >
            {{ props.outputTokenSymbol }}
          </span>
          <span v-if="props.hasOutQuotes" class="composer-summary__usd-value-inline">
            ({{ totalValueOutParts.main }}{{ totalValueOutParts.extra }})
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-summary {
  margin-bottom: 12px;
  padding-bottom: 12px;
  margin-top: 24px;
  border-bottom: 1px solid var(--border-color);
}

.composer-summary__scroll {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
}

.composer-summary__stat {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.composer-summary__label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 2px;
  letter-spacing: 0.05em;
}

.composer-summary__value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}

.composer-summary__token-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  vertical-align: middle;
}

.composer-summary__muted-symbol {
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 600;
}

.composer-summary__usd-value {
  color: mediumseagreen;
}

.composer-summary__usd-value-inline {
  font-size: 16px;
  color: mediumseagreen;
  font-weight: 600;
  margin-left: 2px;
}

.composer-summary__usd-sub-decimals {
  font-size: 16px;
  color: var(--text-muted);
  opacity: 0.85;
  font-weight: 600;
}

.composer-summary__stat--row .composer-summary__value {
  flex-wrap: wrap;
}

.composer-summary__value--row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
