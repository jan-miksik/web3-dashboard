<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useConnection } from '@wagmi/vue'
import { zeroAddress, type Address } from 'viem'
import { CHAIN_METADATA } from '~/utils/chains'
import { handleError } from '~/utils/error-handler'
import { useTxComposer } from '~/composables/useTxComposer'
import { useBatchComposer } from '~/composables/useBatchComposer'
import { useComposerTargetState } from '~/composables/useComposerTargetState'
import { useComposerAmountDrafts } from '~/composables/useComposerAmountDrafts'
import { useComposerQuotes } from '~/composables/useComposerQuotes'
import { useComposerBatchSupport } from '~/composables/useComposerBatchSupport'
import { useComposerBatchingUi } from '~/composables/useComposerBatchingUi'

const { address } = useConnection()
const useBatching = ref(true)
const showRouteDetails = ref(false)
const isExecuteUiPending = ref(false)

const {
  getTokenKey,
  allTokens,
  selectedTokens,
  getRouteQuote,
  isExecuting,
  executionStatus,
  refetchTokens,
  clearSelection,
  customAmounts,
  setCustomAmount,
  getEffectiveAmount,
  toggleToken,
  defaultSelectionPercent,
  setDefaultSelectionPercent,
  applyDefaultPercentToAllSelected,
} = useTxComposer()

const tokenKey = getTokenKey

const {
  executeComposer,
  isBatching,
  batchStatus,
  supportsBatching,
  isCheckingSupport,
  checkBatchingSupport,
  batchMethod,
  walletProvider,
  maxBatchSize,
  calculateBatchCount,
} = useBatchComposer()

const {
  chainBalances,
  chainsByBalance,
  showTargetChainFilter,
  selectedTargetChainIds,
  selectedTargetChainDisplay,
  isTargetChainSelected,
  onToggleTargetChain,
  onClearTargetChain,
  targetChainId,
  targetAssetMode,
  resolvedCustomToken,
  targetTokenAddress,
  targetTokenLabel,
  targetAssetOptions,
  selectedTargetOptionId,
  selectTargetAsset,
  selectCustomToken,
  copiedAddress,
  shortenAddress,
  copyAddress,
  getChainIconUrl,
} = useComposerTargetState({ allTokens, selectedTokens })

const isSameAsDestination = (t: { chainId: number; address: string }) => {
  if (targetChainId.value === null || !targetTokenAddress.value) return false
  return (
    t.chainId === targetChainId.value &&
    t.address.toLowerCase() === targetTokenAddress.value.toLowerCase()
  )
}

const skippedSameTokenSymbols = computed(() => {
  if (targetChainId.value === null || !targetTokenAddress.value) return []
  return selectedTokens.value.filter(isSameAsDestination).map(t => t.symbol)
})

const connectedAddress = computed<string | null>(() => {
  return address.value ? String(address.value) : null
})

useComposerBatchSupport({
  address: connectedAddress,
  targetChainId,
  supportsBatching,
  useBatching,
  isCheckingSupport,
  checkBatchingSupport,
})

const {
  amountDrafts,
  commitAmountDraft,
  setMaxAmount,
  onUpdateAmountDraft,
  refreshAmountDrafts,
  formatRawAmount,
  getEffectiveUsdValue,
} = useComposerAmountDrafts({
  selectedTokens,
  tokenKey,
  getEffectiveAmount,
  setCustomAmount,
})

const totalValueIn = computed(() => {
  return selectedTokens.value.reduce((sum, t) => sum + getEffectiveUsdValue(t), 0)
})

const onApplyDefaultPercentToAllSelected = async () => {
  applyDefaultPercentToAllSelected()
  await nextTick()
  refreshAmountDrafts()
}

const recipientAddress = computed<string>(() => String(address.value ?? zeroAddress))

const {
  quotes,
  quotesError,
  hasOutQuotes,
  totalValueOut,
  outputTokenSymbol,
  formattedTotalOutput,
  routeToolsForToken,
  routeTypeForToken,
  getOutputSymbol,
  getFormattedOutputAmount,
} = useComposerQuotes({
  selectedTokens,
  fromAddress: connectedAddress,
  recipientAddress,
  targetChainId,
  targetTokenAddress: computed(() =>
    targetTokenAddress.value ? String(targetTokenAddress.value) : null
  ),
  targetTokenLabel,
  tokenKey,
  getEffectiveAmount,
  isSameAsDestination,
  formatRawAmount,
  getRouteQuote: async args => {
    return await getRouteQuote({
      fromToken: args.fromToken,
      toChainId: args.toChainId,
      toTokenAddress: args.toTokenAddress as Address,
      fromAddress: args.fromAddress as Address,
      toAddress: args.toAddress as Address,
      customAmount: args.customAmount,
    })
  },
})

// Estimate total calls (each non-native token needs approval + swap, native only needs swap)
const {
  estimatedCallCount,
  estimatedBatchCount,
  needsMultipleBatches,
  walletProviderDisplayName,
  executeButtonText,
  batchBreakdown,
} = useComposerBatchingUi({
  selectedTokens,
  isCheckingSupport,
  isExecuting,
  executionStatus,
  isBatching,
  batchStatus,
  supportsBatching,
  useBatching,
  batchMethod,
  walletProvider,
  maxBatchSize,
  calculateBatchCount,
  isSameAsDestination,
})

const canExecute = computed(() => {
  if (!address.value) return false
  if (selectedTokens.value.length === 0) return false
  if (targetChainId.value === null) return false
  if (!targetTokenAddress.value) return false
  if (isExecuteUiPending.value || isExecuting.value || isBatching.value || isCheckingSupport.value)
    return false
  return true
})

const showExecuteSpinner = computed(() => {
  return (
    isExecuteUiPending.value || isExecuting.value || isBatching.value || isCheckingSupport.value
  )
})

const executeButtonTextUi = computed(() => {
  // Immediate feedback after click, before downstream composables flip their flags.
  if (
    isExecuteUiPending.value &&
    !isExecuting.value &&
    !isBatching.value &&
    !isCheckingSupport.value
  ) {
    return 'Starting...'
  }
  return executeButtonText.value
})

const onExecute = async () => {
  if (!address.value) {
    handleError(new Error('Please connect your wallet'), {
      message: 'Wallet connection required',
      showNotification: true,
    })
    return
  }
  if (targetChainId.value === null) {
    handleError(new Error('Please select a target chain'), {
      message: 'Target chain is required',
      showNotification: true,
    })
    return
  }
  if (!targetTokenAddress.value) {
    handleError(new Error('Please select a target token'), {
      message: 'Target token is required',
      showNotification: true,
    })
    return
  }

  try {
    const tokensToExecute = selectedTokens.value.filter(t => !isSameAsDestination(t))
    if (tokensToExecute.length === 0) {
      handleError(new Error('All selected tokens are already the destination token'), {
        message: 'Nothing to execute',
        showNotification: true,
      })
      return
    }

    // Flip UI state synchronously so the button reacts immediately on click.
    // Then yield to allow the browser to paint the spinner/pressed styles
    // before any heavier async preparation begins.
    isExecuteUiPending.value = true
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    await executeComposer({
      targetChainId: targetChainId.value,
      targetTokenAddress: targetTokenAddress.value,
      tokens: tokensToExecute,
      sendOutput: false,
      recipientAddress: undefined,
      useBatching: useBatching.value,
      customAmounts: customAmounts.value,
    })

    await refetchTokens()
    clearSelection()
  } catch (error) {
    handleError(error, {
      message: error instanceof Error ? error.message : 'Transaction failed',
      context: {
        targetChainId: targetChainId.value,
        tokenCount: selectedTokens.value.length,
      },
      showNotification: true,
    })
  } finally {
    isExecuteUiPending.value = false
  }
}

const poweredByText = computed(() => {
  return 'Powered by LiFi (DEX + bridge aggregation)'
})

const getOutputLogo = (t: { chainId: number; address: string }): string | undefined => {
  const s = quotes.value[tokenKey(t)]
  if (s?.status === 'ok') return s.route.toToken?.logoURI
  if (targetAssetMode.value === 'native') return getChainIconUrl(targetChainId.value ?? 0)
  if (targetAssetMode.value === 'usdc')
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'
  if (resolvedCustomToken.value) return undefined // could add generic logo
  return undefined
}

const getTargetChainName = () => {
  if (targetChainId.value === null) return ''
  return CHAIN_METADATA.find(c => c.id === targetChainId.value)?.name ?? ''
}
</script>

<template>
  <div class="composer-widget">
    <TxComposerComposerWidgetComposerSummary
      :selected-count="selectedTokens.length"
      :total-value-in="totalValueIn"
      :total-value-out="totalValueOut"
      :formatted-total-output="formattedTotalOutput"
      :output-token-symbol="outputTokenSymbol"
      :has-out-quotes="hasOutQuotes"
    />

    <div class="composer-widget__controls">
      <TxComposerComposerWidgetComposerTargetControls
        :chains-by-balance="chainsByBalance"
        :chain-balances="chainBalances"
        :selected-target-chain-ids="selectedTargetChainIds"
        :selected-target-chain-display="selectedTargetChainDisplay"
        :show-target-chain-filter="showTargetChainFilter"
        :is-target-chain-selected="isTargetChainSelected"
        :on-toggle-target-chain="onToggleTargetChain"
        :on-clear-target-chain="onClearTargetChain"
        :target-chain-id="targetChainId"
        :target-asset-mode="targetAssetMode"
        :target-asset-options="targetAssetOptions"
        :selected-target-option-id="selectedTargetOptionId"
        :select-target-asset="selectTargetAsset"
        :select-custom-token="selectCustomToken"
        :target-token-address="targetTokenAddress"
        :copied-address="copiedAddress"
        :shorten-address="shortenAddress"
        :copy-address="copyAddress"
        :resolved-custom-token="resolvedCustomToken"
        :target-token-label="targetTokenLabel"
        :is-checking-support="isCheckingSupport"
        :supports-batching="supportsBatching"
        :use-batching="useBatching"
        :batch-method="batchMethod"
        @update:show-target-chain-filter="showTargetChainFilter = $event"
        @update:use-batching="useBatching = $event"
      />

      <TxComposerComposerWidgetComposerBatchSettings
        :is-checking-support="isCheckingSupport"
        :supports-batching="supportsBatching"
        :use-batching="useBatching"
        :batch-method="batchMethod"
        :needs-multiple-batches="needsMultipleBatches"
        :wallet-provider-display-name="walletProviderDisplayName"
        :max-batch-size="maxBatchSize"
        :estimated-batch-count="estimatedBatchCount"
        :estimated-call-count="estimatedCallCount"
        :batch-breakdown="batchBreakdown"
      />

      <TxComposerComposerWidgetComposerPreview
        :selected-tokens="selectedTokens"
        :quotes="quotes"
        :quotes-error="quotesError"
        :skipped-same-token-symbols="skippedSameTokenSymbols"
        :powered-by-text="poweredByText"
        :show-route-details="showRouteDetails"
        :target-chain-id="targetChainId"
        :target-token-address="targetTokenAddress"
        :amount-drafts="amountDrafts"
        :token-key="tokenKey"
        :toggle-token="toggleToken"
        :commit-amount-draft="commitAmountDraft"
        :set-max-amount="setMaxAmount"
        :default-selection-percent="defaultSelectionPercent"
        :set-default-selection-percent="setDefaultSelectionPercent"
        :apply-default-percent-to-all-selected="onApplyDefaultPercentToAllSelected"
        :get-chain-icon-url="getChainIconUrl"
        :get-effective-usd-value="getEffectiveUsdValue"
        :get-output-logo="getOutputLogo"
        :get-output-symbol="getOutputSymbol"
        :get-formatted-output-amount="getFormattedOutputAmount"
        :get-target-chain-name="getTargetChainName"
        :route-type-for-token="routeTypeForToken"
        :route-tools-for-token="routeToolsForToken"
        @update:show-route-details="showRouteDetails = $event"
        @update:amount-draft="onUpdateAmountDraft"
      />

      <button
        class="composer-widget__execute-btn"
        :disabled="!canExecute"
        :aria-busy="showExecuteSpinner"
        :data-loading="showExecuteSpinner ? 'true' : 'false'"
        @click="onExecute"
      >
        <span v-if="showExecuteSpinner" class="composer-widget__spinner"></span>
        {{ executeButtonTextUi }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer-widget {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 20px;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  overflow: visible; /* Changed from hidden to allow dropdowns */
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .composer-widget {
    position: relative;
    top: 0;
    max-height: none;
    padding: 16px;
    border-radius: 14px;
  }

  .composer-widget__controls {
    gap: 12px;
  }

  .composer-widget__execute-btn {
    min-height: 52px;
    padding: 14px 24px;
    font-size: 16px;
    margin-top: 12px;
    border-radius: 14px;
    -webkit-tap-highlight-color: transparent;
  }
}

.composer-widget__controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.composer-widget__execute-btn {
  background: mediumseagreen;
  color: white;
  border: none;
  padding: 8px 32px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(60, 179, 113, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 100%;
  min-height: 48px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 120ms ease,
    box-shadow 160ms ease,
    filter 160ms ease,
    opacity 160ms ease;
  will-change: transform;
}

.composer-widget__execute-btn:not(:disabled):hover {
  filter: brightness(1.05) saturate(1.05);
  box-shadow: 0 6px 18px rgba(60, 179, 113, 0.36);
  transform: translateY(-1px);
}

.composer-widget__execute-btn:not(:disabled):active {
  filter: brightness(0.98);
  box-shadow: 0 3px 10px rgba(60, 179, 113, 0.28);
  transform: translateY(0px);
}

.composer-widget__execute-btn:focus-visible {
  outline: 3px solid rgba(60, 179, 113, 0.45);
  outline-offset: 3px;
}

.composer-widget__execute-btn[data-loading='true'] {
  cursor: progress;
}

.composer-widget__execute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.composer-widget__spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
