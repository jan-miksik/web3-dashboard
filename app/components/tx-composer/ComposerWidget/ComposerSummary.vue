<script setup lang="ts">
import { formatUsdValueParts } from '~/utils/format'

const props = defineProps<{
  selectedCount: number
  totalValueIn: number
  totalValueOut: number
  formattedTotalOutput: string
  outputTokenSymbol: string
  hasOutQuotes: boolean
}>()

const formatUsdValue = (value: number) => formatUsdValueParts(value)
</script>

<template>
  <div class="composer-summary">
    <div class="composer-summary__scroll">
      <div class="composer-summary__stat">
        <label class="composer-summary__label">Selected</label>
        <span class="composer-summary__value">{{ props.selectedCount }}</span>
      </div>
      <div class="composer-summary__stat">
        <label class="composer-summary__label">Total Sell</label>
        <div class="composer-summary__value">
          <span>{{ formatUsdValue(props.totalValueIn).main }}</span>
          <span
            v-if="formatUsdValue(props.totalValueIn).extra"
            class="composer-summary__usd-sub-decimals"
          >
            {{ formatUsdValue(props.totalValueIn).extra }}
          </span>
        </div>
      </div>
      <div class="composer-summary__stat">
        <label class="composer-summary__label">Total Receive</label>
        <div class="composer-summary__value">
          <span>{{ props.formattedTotalOutput }}</span>
          <span v-if="props.hasOutQuotes" class="composer-summary__muted-symbol">
            {{ props.outputTokenSymbol }}
          </span>
          <span v-if="props.hasOutQuotes" class="composer-summary__usd-value-inline">
            ({{ formatUsdValue(props.totalValueOut).main
            }}{{ formatUsdValue(props.totalValueOut).extra }})
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

.composer-summary__muted-symbol {
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 600;
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
</style>
