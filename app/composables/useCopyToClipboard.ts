import { ref, onUnmounted } from 'vue'
import { handleError } from '~/utils/error-handler'

export interface UseCopyToClipboardOptions {
  /** Reset copiedValue after this many ms (default 2000). */
  clearAfterMs?: number
}

/**
 * Shared clipboard copy with optional timeout reset and error handling.
 * Use in useComposerTargetState and useTokenList instead of duplicating logic.
 */
export function useCopyToClipboard(options: UseCopyToClipboardOptions = {}) {
  const { clearAfterMs = 2000 } = options
  const copiedValue = ref<string | null>(null)
  let clearTimeoutId: ReturnType<typeof setTimeout> | null = null

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      copiedValue.value = value
      if (clearTimeoutId) clearTimeout(clearTimeoutId)
      if (clearAfterMs > 0) {
        clearTimeoutId = setTimeout(() => {
          copiedValue.value = null
          clearTimeoutId = null
        }, clearAfterMs)
      }
    } catch (error) {
      handleError(error, {
        message: 'Failed to copy to clipboard',
        context: { value },
        showNotification: true,
      })
    }
  }

  onUnmounted(() => {
    if (clearTimeoutId) clearTimeout(clearTimeoutId)
  })

  return { copy, copiedValue }
}
