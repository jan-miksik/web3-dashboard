import { computed, type Ref } from 'vue'
import type { ComposerToken } from '~/composables/useTxComposer'

interface UseComposerBatchingUiOptions {
  selectedTokens: Ref<ComposerToken[]>
  isCheckingSupport: Ref<boolean>
  isExecuting: Ref<boolean>
  executionStatus: Ref<string | null>
  isBatching: Ref<boolean>
  batchStatus: Ref<string | null>
  supportsBatching: Ref<boolean | null>
  useBatching: Ref<boolean>
  batchMethod: Ref<string>
  walletProvider: Ref<string>
  maxBatchSize: Ref<number>
  calculateBatchCount: (callCount: number, maxBatchSize: number) => number
  isSameAsDestination: (t: { chainId: number; address: string }) => boolean
}

export function useComposerBatchingUi(options: UseComposerBatchingUiOptions) {
  const {
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
  } = options

  const estimatedCallCount = computed(() => {
    let count = 0
    for (const t of selectedTokens.value) {
      if (isSameAsDestination(t)) continue
      const isNative = t.address.toLowerCase() === '0x0000000000000000000000000000000000000000'
      count += isNative ? 1 : 2
    }
    return count
  })

  const estimatedBatchCount = computed(() => {
    if (!supportsBatching.value || !useBatching.value) return 1
    return calculateBatchCount(estimatedCallCount.value, maxBatchSize.value)
  })

  const needsMultipleBatches = computed(() => estimatedBatchCount.value > 1)

  const walletProviderDisplayName = computed(() => {
    const provider = walletProvider.value
    const names: Record<string, string> = {
      metamask: 'MetaMask',
      rabby: 'Rabby',
      coinbase: 'Coinbase',
      unknown: 'Wallet',
    }
    return names[provider] ?? 'Wallet'
  })

  const executeButtonText = computed(() => {
    if (isCheckingSupport.value) return 'Checking wallet...'
    if (isExecuting.value) return executionStatus.value || 'Executing...'
    if (isBatching.value) return batchStatus.value || 'Executing...'

    if (supportsBatching.value && useBatching.value && selectedTokens.value.length >= 2) {
      const batchCount = estimatedBatchCount.value
      if (batchCount > 1) return `Execute (${batchCount} batches)`
      return batchMethod.value === 'eip7702' ? '⚡ One-Click Execute' : 'Batch Execute'
    }
    return 'Execute'
  })

  return {
    estimatedCallCount,
    estimatedBatchCount,
    needsMultipleBatches,
    walletProviderDisplayName,
    executeButtonText,
  }
}
