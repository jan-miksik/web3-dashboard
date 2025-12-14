<script setup lang="ts">
import type { Token } from '~/composables/useTokens'
import TokenRow from './TokenRow.vue'

interface Props {
  highValueTokens: Token[]
  lowValueTokens: Token[]
  showLowValueAssets: boolean
  hasLowValueAssets: boolean
  hasHighValueAssets: boolean
  isLoading: boolean
  isRefreshing: boolean
  copiedAddress: string | null
  onCopyAddress: (address: string) => void
  onShortenAddress: (address: string) => string
  onFormatUsdValue: (value: number) => string
  onFormatBalance: (balance: string) => string
  onGetChainIcon: (chainId: number) => string | undefined
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:showLowValueAssets': [value: boolean]
}>()
</script>

<template>
  <div
    class="table-container"
    :class="{ refreshing: isRefreshing }"
    data-testid="token-table-container"
  >
    <table
      class="token-table"
      :class="{ loading: isLoading || isRefreshing, 'show-low-value': showLowValueAssets }"
      data-testid="token-table"
    >
      <tbody>
        <!-- High-value tokens (>= $5) -->
        <TokenRow
          v-for="token in highValueTokens"
          :key="`${token.chainId}-${token.address}`"
          :token="token"
          :copied-address="copiedAddress"
          :on-copy-address="onCopyAddress"
          :on-shorten-address="onShortenAddress"
          :on-format-usd-value="onFormatUsdValue"
          :on-format-balance="onFormatBalance"
          :on-get-chain-icon="onGetChainIcon"
        />

        <!-- Divider row with button (only if there are low-value assets) -->
        <tr v-if="hasLowValueAssets && !showLowValueAssets" class="divider-row">
          <td colspan="2" class="divider-cell">
            <button
              class="show-low-value-btn"
              data-testid="show-low-value-btn"
              @click="emit('update:showLowValueAssets', true)"
            >
              {{ 'Show assets < $5' }}
            </button>
          </td>
        </tr>

        <!-- Low-value tokens (< $5) -->
        <template v-if="showLowValueAssets">
          <tr v-if="hasHighValueAssets" class="divider-row divider-row-animate">
            <td colspan="2" class="divider-cell">
              <button
                class="hide-low-value-btn"
                data-testid="hide-low-value-btn"
                @click="emit('update:showLowValueAssets', false)"
              >
                Hide assets &lt; $5
              </button>
            </td>
          </tr>
          <TokenRow
            v-for="(token, index) in lowValueTokens"
            :key="`${token.chainId}-${token.address}`"
            :token="token"
            :copied-address="copiedAddress"
            :on-copy-address="onCopyAddress"
            :on-shorten-address="onShortenAddress"
            :on-format-usd-value="onFormatUsdValue"
            :on-format-balance="onFormatBalance"
            :on-get-chain-icon="onGetChainIcon"
            :style="{ '--row-index': index }"
          />
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-container {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 20px -20px;
  padding: 0 20px;
  transition: opacity 0.3s ease;
}

.table-container.refreshing {
  opacity: 0.7;
  pointer-events: none;
}

.token-table {
  transition: filter 0.3s ease;
  width: 100%;
  border-collapse: collapse;
}

.token-table.loading {
  filter: blur(1px);
}

.token-table th {
  text-align: left;
  padding: 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
}

.th-value {
  text-align: right;
}

/* Low-value rows animation */
.token-table.show-low-value .low-value-row {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  animation: fadeInSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: calc(var(--row-index, 0) * 0.05s);
}

.token-table.show-low-value .divider-row-animate {
  opacity: 0;
  transform: translateY(-8px);
  animation: fadeInSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes fadeInSlideUp {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  60% {
    transform: translateY(2px) scale(1);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.divider-row {
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.divider-cell {
  padding: 16px 0;
  text-align: center;
}

.show-low-value-btn,
.hide-low-value-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.show-low-value-btn:hover,
.hide-low-value-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
  color: var(--text-primary);
}
</style>
