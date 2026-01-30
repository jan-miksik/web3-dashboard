<script setup lang="ts">
import { computed } from 'vue'
import type { Token } from '~/composables/useTokens'
import type { UsdDisplay } from '~/utils/format'

interface Props {
  token: Token
  copiedAddress: string | null
  onCopyAddress: (address: string) => void
  onShortenAddress: (address: string) => string
  onFormatUsdValueExpanded: (value: number) => UsdDisplay
  onFormatBalance: (balance: string) => string
  onGetChainIcon: (chainId: number) => string | undefined
}

const props = defineProps<Props>()

const usdDisplay = computed(() => props.onFormatUsdValueExpanded(props.token.usdValue))
</script>

<template>
  <tr
    class="token-row"
    :class="{
      'low-value-row': token.usdValue < 5,
      'native-token-row': token.tokenType === 'native',
    }"
    data-testid="token-row"
  >
    <td class="td-token">
      <div class="token-info">
        <div class="token-logo">
          <img
            v-if="token.logoURI"
            :src="token.logoURI"
            :alt="token.symbol"
            @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <span v-else class="token-placeholder">{{ token.symbol.charAt(0) }}</span>
        </div>
        <div class="token-details">
          <div class="token-symbol-row">
            <span class="token-symbol">
              {{ token.symbol }}
              <span
                v-if="token.tokenType === 'native'"
                class="native-badge token-row__native-badge--tooltip"
                data-tooltip="Native token does not have a contract address"
              >
                NATIVE
              </span>
            </span>
            <button
              v-if="token.address && token.address !== '0x0000000000000000000000000000000000000000'"
              class="token-address-btn"
              data-testid="copy-token-address-btn"
              :class="{ copied: copiedAddress === token.address }"
              :title="copiedAddress === token.address ? 'Copied!' : 'Copy contract address'"
              @click="onCopyAddress(token.address)"
            >
              <span class="token-address">{{ onShortenAddress(token.address) }}</span>
              <svg
                v-if="copiedAddress === token.address"
                class="copy-icon"
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 8L6.5 11.5L13 5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg
                v-else
                class="copy-icon"
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="5.5"
                  y="5.5"
                  width="8"
                  height="8"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="1.25"
                  fill="none"
                />
                <path
                  d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3.5C2.67157 2 2 2.67157 2 3.5V9C2 9.82843 2.67157 10.5 3.5 10.5H5.5"
                  stroke="currentColor"
                  stroke-width="1.25"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
          <span class="token-meta">
            <span class="token-name">{{ token.name }}</span>
            <span class="chain-badge-wrapper">
              <img
                v-if="onGetChainIcon(token.chainId)"
                :src="onGetChainIcon(token.chainId)"
                :alt="token.chainName"
                class="chain-badge-icon"
                @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <span class="chain-badge">{{ token.chainName }}</span>
            </span>
          </span>
        </div>
      </div>
    </td>
    <td class="td-value">
      <div class="value-container">
        <span class="token-value usd-value" :class="{ 'has-value': token.usdValue > 0 }">
          {{ usdDisplay.main }}
          <span v-if="usdDisplay.extra" class="usd-sub-decimals">{{ usdDisplay.extra }}</span>
        </span>
        <span class="balance-value">{{ onFormatBalance(token.formattedBalance) }}</span>
      </div>
    </td>
  </tr>
</template>

<style scoped>
.token-row {
  transition: background 0.2s;
}

.token-row:hover {
  background: var(--bg-hover);
}

.token-row td {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
}

.token-row:last-child td {
  border-bottom: none;
}

.td-token {
  width: 60%;
}

.td-value {
  text-align: right;
  vertical-align: middle;
}

.value-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.token-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.token-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.token-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-placeholder {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
}

.token-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.token-symbol-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.token-symbol {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.native-badge {
  font-size: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 2px 4px;
  border-radius: 4px;
  font-weight: 700;
}

.token-row__native-badge--tooltip {
  position: relative;
  cursor: help;
}

.token-row__native-badge--tooltip:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 6px 8px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.3;
  max-width: 400px;
  width: 210px;
  white-space: normal;
  text-align: center;
  z-index: 50;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.token-address-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-mono);
}

.token-address-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.token-address-btn.copied {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.token-address {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.token-address-btn.copied .token-address {
  color: var(--success);
  font-weight: 600;
}

.token-address-btn .copy-icon {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.7;
}

.token-address-btn:hover .copy-icon {
  color: var(--text-secondary);
  opacity: 1;
}

.token-address-btn.copied .copy-icon {
  color: var(--success);
  opacity: 1;
}

.token-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.token-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.chain-badge-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chain-badge-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: contain;
}

.chain-badge {
  font-size: 10px;
  color: var(--accent-primary);
  background: var(--accent-muted);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.usd-value {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.2;
}

.usd-value.has-value {
  color: var(--success);
}

.usd-sub-decimals {
  color: var(--text-muted);
  opacity: 0.8;
  font-size: 0.9em;
}

.balance-value {
  font-weight: 500;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.2;
}

@media (max-width: 640px) {
  .token-name {
    display: none;
  }

  .token-logo {
    width: 32px;
    height: 32px;
  }
}
</style>
