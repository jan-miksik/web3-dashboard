<script setup lang="ts">
import type { ComposerToken } from '~/composables/useTxComposer'
import type { QuoteState } from './types'
import { formatUsdValueParts } from '~/utils/format'

const props = defineProps<{
  selectedTokens: ComposerToken[]
  quotes: Record<string, QuoteState>
  quotesError: string | null
  skippedSameTokenSymbols: string[]
  poweredByText: string
  showRouteDetails: boolean
  targetChainId: number | null
  targetTokenAddress: string | null

  amountDrafts: Record<string, string>

  defaultSelectionPercent: number
  setDefaultSelectionPercent: (pct: number) => void
  applyDefaultPercentToAllSelected: () => void

  tokenKey: (t: { chainId: number; address: string }) => string
  toggleToken: (t: ComposerToken) => void
  commitAmountDraft: (t: ComposerToken) => void
  setMaxAmount: (t: ComposerToken) => void

  getChainIconUrl: (chainId: number) => string | undefined
  getEffectiveUsdValue: (t: ComposerToken) => number
  getOutputLogo: (t: { chainId: number; address: string }) => string | undefined
  getOutputSymbol: (t: { chainId: number; address: string }) => string
  getFormattedOutputAmount: (t: { chainId: number; address: string }) => string
  getTargetChainName: () => string
  routeTypeForToken: (t: { chainId: number; address: string }) => string | null
  routeToolsForToken: (t: { chainId: number; address: string }) => string[]
}>()

const emit = defineEmits<{
  (e: 'update:show-route-details', v: boolean): void
  (e: 'update:amount-draft', v: { key: string; value: string }): void
}>()

const formatUsdValue = (value: number) => formatUsdValueParts(value)

function onSendDefaultInput(e: Event) {
  const input = e.target as HTMLInputElement
  // Allow digits and at most one decimal point (e.g. 0.01, 50.5, 100), max 6 chars
  let v = input.value.replace(/[^\d.]/g, '')
  const dots = v.match(/\./g)
  if (dots && dots.length > 1) {
    const firstDot = v.indexOf('.')
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
  }
  v = v.slice(0, 6)
  input.value = v
  const num = Number.parseFloat(v)
  const clamped = Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : 0
  props.setDefaultSelectionPercent(clamped)
  // Sync display when value is a complete number (avoids "0.0" → "0" while typing)
  if (v !== '' && v !== '.' && String(clamped) === v) {
    input.value = clamped === 100 ? '100' : String(clamped)
  }
}

function onSendDefaultMax() {
  props.setDefaultSelectionPercent(100)
}

function onApplyDefaultPercentToAllSelected() {
  props.applyDefaultPercentToAllSelected()
}
</script>

<template>
  <div class="composer-preview">
    <div class="composer-preview__header">
      <div class="composer-preview__title">Transaction Preview</div>
      <div class="composer-preview__header-right">
        <div class="composer-preview__subtitle">{{ props.poweredByText }}</div>
        <label class="composer-preview__details-toggle">
          <input
            :checked="props.showRouteDetails"
            type="checkbox"
            class="composer-preview__details-toggle-input"
            @change="emit('update:show-route-details', ($event.target as HTMLInputElement).checked)"
          />
          <span>Show details</span>
        </label>
      </div>
    </div>

    <div v-if="props.quotesError" class="composer-preview__error-text">{{ props.quotesError }}</div>

    <div
      v-if="props.skippedSameTokenSymbols.length > 0"
      class="composer-preview__info-text composer-preview__info-text--skipped-notice"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.25" />
        <path d="M8 7V12" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
        <path d="M8 5.25H8.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
      </svg>
      Some assets were skipped because they are already the destination token ({{
        props.skippedSameTokenSymbols.join(', ')
      }}).
    </div>

    <div class="composer-preview__table-header">
      <div class="composer-preview__header-col composer-preview__header-col--send">
        <span class="composer-preview__header-label">You Send</span>
        <span class="composer-preview__send-default-label">by default</span>
        <input
          :value="props.defaultSelectionPercent"
          type="text"
          inputmode="decimal"
          maxlength="6"
          class="composer-preview__send-default-input"
          aria-label="Send by default percent"
          @input="onSendDefaultInput"
        />
        <span class="composer-preview__send-default-suffix">%</span>
        <button
          type="button"
          class="composer-preview__send-default-max-btn"
          @click="onSendDefaultMax"
        >
          MAX
        </button>
        <button
          type="button"
          class="composer-preview__send-default-refresh-btn"
          title="Apply target % to all selected tokens"
          aria-label="Apply target percent to all selected tokens"
          @click="onApplyDefaultPercentToAllSelected"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
      <div
        class="composer-preview__header-col composer-preview__header-col--arrow"
        aria-hidden="true"
      >
        <span class="composer-preview__arrow" title="Swap to">→</span>
      </div>
      <div class="composer-preview__header-col">You Receive</div>
    </div>

    <div v-if="props.selectedTokens.length === 0" class="composer-preview__empty">
      <div class="composer-preview__empty-icon">📋</div>
      <div class="composer-preview__empty-text">Select assets to preview routes</div>
    </div>
    <div v-else-if="props.targetChainId === null" class="composer-preview__empty">
      <div class="composer-preview__empty-icon">🔗</div>
      <div class="composer-preview__empty-text">Select a target chain</div>
    </div>
    <div v-else-if="!props.targetTokenAddress" class="composer-preview__empty">
      <div class="composer-preview__empty-icon">🪙</div>
      <div class="composer-preview__empty-text">Select a target token</div>
    </div>
    <div v-else class="composer-preview__list">
      <div
        v-for="t in props.selectedTokens"
        :key="props.tokenKey(t)"
        class="composer-preview__card"
        :class="{
          'composer-preview__card--loading': props.quotes[props.tokenKey(t)]?.status === 'loading',
        }"
      >
        <button
          class="composer-preview__cancel-btn"
          type="button"
          :title="'Remove ' + t.symbol"
          @click="props.toggleToken(t)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 4L4 12M4 4L12 12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div class="composer-preview__columns">
          <div class="composer-preview__column composer-preview__column--send">
            <div class="composer-preview__token-row">
              <img v-if="t.logoURI" :src="t.logoURI" class="composer-preview__token-logo" alt="" />
              <div v-else class="composer-preview__token-logo-placeholder">{{ t.symbol[0] }}</div>
              <div class="composer-preview__token-info">
                <div class="composer-preview__token-topline">
                  <span class="composer-preview__token-symbol">{{ t.symbol }}</span>
                  <div class="composer-preview__inline-amount">
                    <input
                      :value="props.amountDrafts[props.tokenKey(t)] ?? ''"
                      class="composer-preview__inline-amount-input"
                      type="text"
                      inputmode="decimal"
                      placeholder="0.00"
                      @input="
                        emit('update:amount-draft', {
                          key: props.tokenKey(t),
                          value: ($event.target as HTMLInputElement).value,
                        })
                      "
                      @blur="props.commitAmountDraft(t)"
                      @keydown.enter.prevent="props.commitAmountDraft(t)"
                    />
                    <button
                      class="composer-preview__inline-max-btn"
                      type="button"
                      @click="props.setMaxAmount(t)"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div class="composer-preview__token-meta">
                  <div class="composer-preview__token-name-group">
                    <span class="composer-preview__token-name">{{ t.name }}</span>
                    <div class="composer-preview__chain-badge">
                      <img
                        v-if="props.getChainIconUrl(t.chainId)"
                        :src="props.getChainIconUrl(t.chainId)"
                        class="composer-preview__chain-icon"
                        alt=""
                      />
                      <span class="composer-preview__chain-text">{{ t.chainName }}</span>
                    </div>
                  </div>
                  <div class="composer-preview__token-meta-right">
                    <div class="composer-preview__usd-value">
                      <span>{{ formatUsdValue(props.getEffectiveUsdValue(t)).main }}</span>
                      <span
                        v-if="formatUsdValue(props.getEffectiveUsdValue(t)).extra"
                        class="composer-preview__usd-sub-decimals"
                      >
                        {{ formatUsdValue(props.getEffectiveUsdValue(t)).extra }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="composer-preview__column composer-preview__column--arrow" aria-hidden="true">
            <span class="composer-preview__arrow composer-preview__arrow--row" title="Swap to"
              >→</span
            >
          </div>

          <div class="composer-preview__column composer-preview__column--receive">
            <template v-if="props.quotes[props.tokenKey(t)]?.status === 'loading'">
              <div
                class="composer-preview__route-search-indicator composer-preview__route-search-indicator--compact"
              >
                <div class="composer-preview__search-dots">
                  <span class="composer-preview__dot"></span>
                  <span class="composer-preview__dot"></span>
                  <span class="composer-preview__dot"></span>
                </div>
                <span class="composer-preview__search-text">Finding best route</span>
              </div>
            </template>
            <template v-else-if="props.quotes[props.tokenKey(t)]?.status === 'error'">
              <div class="composer-preview__error">
                {{ (props.quotes[props.tokenKey(t)] as any).message }}
              </div>
            </template>
            <template v-else-if="props.quotes[props.tokenKey(t)]?.status === 'ok'">
              <div class="composer-preview__token-row">
                <img
                  v-if="props.getOutputLogo(t)"
                  :src="props.getOutputLogo(t)"
                  class="composer-preview__token-logo"
                  alt=""
                />
                <div v-else class="composer-preview__token-logo-placeholder">
                  {{ props.getOutputSymbol(t)[0] }}
                </div>
                <div class="composer-preview__token-info">
                  <div class="composer-preview__token-topline">
                    <span class="composer-preview__token-symbol">{{
                      props.getOutputSymbol(t)
                    }}</span>
                    <div class="composer-preview__output-amount">
                      <span
                        class="composer-preview__amount-value composer-preview__amount-value--large"
                      >
                        {{ props.getFormattedOutputAmount(t) }}
                      </span>
                      <span class="composer-preview__amount-symbol">{{
                        props.getOutputSymbol(t)
                      }}</span>
                    </div>
                  </div>
                  <div class="composer-preview__token-meta">
                    <div class="composer-preview__token-name-group">
                      <span class="composer-preview__token-name">{{
                        props.getOutputSymbol(t)
                      }}</span>
                      <div class="composer-preview__chain-badge">
                        <img
                          v-if="
                            props.targetChainId !== null &&
                            props.getChainIconUrl(props.targetChainId)
                          "
                          :src="props.getChainIconUrl(props.targetChainId!)"
                          class="composer-preview__chain-icon"
                          alt=""
                        />
                        <span class="composer-preview__chain-text">{{
                          props.getTargetChainName()
                        }}</span>
                      </div>
                    </div>
                    <div class="composer-preview__token-meta-right">
                      <div class="composer-preview__usd-value">
                        <span>{{
                          formatUsdValue(
                            Number((props.quotes[props.tokenKey(t)] as any).route.toAmountUSD ?? 0)
                          ).main
                        }}</span>
                        <span
                          v-if="
                            formatUsdValue(
                              Number(
                                (props.quotes[props.tokenKey(t)] as any).route.toAmountUSD ?? 0
                              )
                            ).extra
                          "
                          class="composer-preview__usd-sub-decimals"
                        >
                          {{
                            formatUsdValue(
                              Number(
                                (props.quotes[props.tokenKey(t)] as any).route.toAmountUSD ?? 0
                              )
                            ).extra
                          }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="props.showRouteDetails" class="composer-preview__receive-footer">
                <div class="composer-preview__route-info-inline">
                  <span
                    v-if="props.routeTypeForToken(t)"
                    class="composer-preview__tech-pill composer-preview__tech-pill--mini"
                  >
                    {{ props.routeTypeForToken(t) }}
                  </span>
                  <span
                    v-for="tool in props.routeToolsForToken(t)"
                    :key="tool"
                    class="composer-preview__tech-pill composer-preview__tech-pill--mini"
                  >
                    {{ tool }}
                  </span>
                </div>
              </div>
            </template>
            <template v-else>
              <div
                class="composer-preview__route-search-indicator composer-preview__route-search-indicator--compact"
              >
                <div class="composer-preview__search-dots">
                  <span class="composer-preview__dot"></span>
                  <span class="composer-preview__dot"></span>
                  <span class="composer-preview__dot"></span>
                </div>
                <span class="composer-preview__search-text">Finding best route</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-preview {
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.composer-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 24px;
  margin-top: 10px;
}

.composer-preview__header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.composer-preview__details-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-secondary);
  user-select: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.composer-preview__details-toggle:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.composer-preview__details-toggle-input {
  margin: 0;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.composer-preview__title {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-primary);
}

.composer-preview__subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}

.composer-preview__error-text {
  color: var(--danger, #ef4444);
  font-size: 12px;
}

.composer-preview__info-text {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 0;
}

.composer-preview__info-text--skipped-notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.composer-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px 16px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  border: 1px dashed var(--border-color);
}

.composer-preview__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding-right: 2px;
}

.composer-preview__table-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px 16px;
  padding: 0 10px;
  align-items: center;
}

.composer-preview__header-col {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.composer-preview__header-col--send {
  display: flex;
  align-items: center;
  gap: 8px 12px;
  flex-wrap: wrap;
}

.composer-preview__header-label {
  flex-shrink: 0;
}

.composer-preview__send-default-label {
  font-size: 10px;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  opacity: 0.85;
}

.composer-preview__send-default-input {
  width: 3.5em;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

.composer-preview__send-default-suffix {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 700;
}

.composer-preview__send-default-max-btn {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.composer-preview__send-default-max-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.composer-preview__send-default-refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.composer-preview__send-default-refresh-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.composer-preview__header-col--arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.composer-preview__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-muted, #888);
  line-height: 1;
}

.composer-preview__arrow--row {
  font-size: 20px;
  color: var(--accent-primary, mediumseagreen);
}

.composer-preview__card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px;
  padding-right: 32px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s ease;
  position: relative;
}

.composer-preview__card:hover {
  border-color: var(--primary-color);
}

.composer-preview__card--loading {
  border-color: var(--accent-primary, mediumseagreen);
  box-shadow: 0 0 0 1px var(--accent-muted, rgba(60, 179, 113, 0.2));
}

.composer-preview__cancel-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  z-index: 10;
  padding: 0;
  flex-shrink: 0;
}

.composer-preview__cancel-btn:hover {
  background: var(--bg-hover);
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
  transform: scale(1.1);
}

.composer-preview__cancel-btn:active {
  transform: scale(0.95);
}

.composer-preview__columns {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px 16px;
  align-items: start;
}

.composer-preview__column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer-preview__column--arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  margin: auto;
}

.composer-preview__column--receive {
  padding-left: 0;
  position: relative;
}

.composer-preview__token-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.composer-preview__token-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.composer-preview__token-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.composer-preview__token-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
}

.composer-preview__token-symbol {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.composer-preview__inline-amount {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 60%;
}

.composer-preview__inline-amount-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-mono);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  text-align: right;
  min-width: 0;
}

.composer-preview__inline-max-btn {
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}

.composer-preview__token-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}

.composer-preview__token-name-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.composer-preview__token-name {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.composer-preview__token-meta-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.composer-preview__chain-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--accent-muted);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.composer-preview__chain-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  object-fit: contain;
}

.composer-preview__chain-text {
  font-size: 9px;
  color: var(--accent-primary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.composer-preview__usd-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
  color: mediumseagreen;
  white-space: nowrap;
}

.composer-preview__usd-sub-decimals {
  font-size: 0.9em;
  opacity: 0.8;
}

.composer-preview__output-amount {
  display: flex;
  align-items: baseline;
  gap: 2px;
  justify-content: flex-end;
}

.composer-preview__amount-value--large {
  font-size: 16px;
}

.composer-preview__amount-symbol {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-left: 2px;
}

.composer-preview__receive-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: auto;
  gap: 8px;
}

.composer-preview__route-info-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.composer-preview__tech-pill {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 3px 8px;
  border-radius: 999px;
  font-family: var(--font-mono);
}

.composer-preview__tech-pill--mini {
  font-size: 9px;
  padding: 1px 6px;
}

.composer-preview__route-search-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
}

.composer-preview__route-search-indicator--compact {
  padding: 4px 10px;
}

.composer-preview__search-dots {
  display: flex;
  gap: 4px;
}

.composer-preview__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary, mediumseagreen);
  animation: bounce 1.4s ease-in-out infinite;
}

.composer-preview__dot:nth-child(1) {
  animation-delay: 0s;
}

.composer-preview__dot:nth-child(2) {
  animation-delay: 0.2s;
}

.composer-preview__dot:nth-child(3) {
  animation-delay: 0.4s;
}

.composer-preview__search-text {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.composer-preview__error {
  color: var(--danger, #ef4444);
  font-size: 12px;
}

@keyframes bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

@media (max-width: 520px) {
  .composer-preview__table-header {
    grid-template-columns: 1fr auto 1fr;
    gap: 8px;
  }
  .composer-preview__columns {
    grid-template-columns: 1fr auto 1fr;
    gap: 8px;
  }
  .composer-preview__column--receive {
    border-top: none;
    padding-top: 0;
  }
}
</style>
