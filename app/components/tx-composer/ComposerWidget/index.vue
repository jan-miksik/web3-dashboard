<script setup lang="ts">
import { computed, ref } from 'vue'
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

const tokenKey = (t: { chainId: number; address: string }) => `${t.chainId}-${t.address}`

const {
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
} = useTxComposer()

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
  customTokenAddressInput,
  resolvedCustomToken,
  isResolvingCustomToken,
  customTokenError,
  resolveCustomToken,
  targetTokenAddress,
  targetTokenLabel,
  targetAssetOptions,
  selectTargetAsset,
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

const recipientAddress = computed<string>(() => String(address.value ?? zeroAddress))

const {
  quotes,
  quotesError,
  hasOutQuotes,
  totalValueOut,
  totalFees,
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
  if (isExecuting.value || isBatching.value || isCheckingSupport.value) return false
  return true
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
      :total-fees="totalFees"
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
        :select-target-asset="selectTargetAsset"
        :target-token-address="targetTokenAddress"
        :copied-address="copiedAddress"
        :shorten-address="shortenAddress"
        :copy-address="copyAddress"
        :custom-token-address-input="customTokenAddressInput"
        :resolved-custom-token="resolvedCustomToken"
        :is-resolving-custom-token="isResolvingCustomToken"
        :custom-token-error="customTokenError"
        :resolve-custom-token="resolveCustomToken"
        :target-token-label="targetTokenLabel"
        @update:show-target-chain-filter="showTargetChainFilter = $event"
        @update:custom-token-address-input="customTokenAddressInput = $event"
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
        @update:use-batching="useBatching = $event"
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

      <button class="composer-widget__execute-btn" :disabled="!canExecute" @click="onExecute">
        <span
          v-if="isExecuting || isBatching || isCheckingSupport"
          class="composer-widget__spinner"
        ></span>
        {{ executeButtonText }}
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
}

.composer-widget__execute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
