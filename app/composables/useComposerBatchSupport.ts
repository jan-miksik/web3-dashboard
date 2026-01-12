import { onMounted, watch, type Ref } from 'vue'

interface UseComposerBatchSupportOptions {
  address: Ref<string | null>
  targetChainId: Ref<number | null>
  supportsBatching: Ref<boolean | null>
  useBatching: Ref<boolean>
  isCheckingSupport: Ref<boolean>
  checkBatchingSupport: (chainId: number) => Promise<unknown> | unknown
}

export function useComposerBatchSupport(options: UseComposerBatchSupportOptions) {
  const { address, targetChainId, supportsBatching, useBatching, checkBatchingSupport } = options

  onMounted(() => {
    if (address.value && targetChainId.value !== null) {
      checkBatchingSupport(targetChainId.value)
    }
  })

  watch([address, targetChainId], ([addr, cid]) => {
    if (addr && cid !== null) {
      checkBatchingSupport(cid)
    }
  })

  watch(supportsBatching, can => {
    if (can === false) {
      useBatching.value = false
    }
  })
}
