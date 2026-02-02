import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Run callback when a click occurs outside the given element.
 * Use in NetworkFilter and ComposerTargetControls instead of duplicating add/removeEventListener.
 */
export function useClickOutside(
  elementRef: Ref<HTMLElement | null>,
  callback: (event: MouseEvent) => void
) {
  function handleClick(event: MouseEvent) {
    const target = event.target as Node
    if (elementRef.value && !elementRef.value.contains(target)) {
      callback(event)
    }
  }

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('click', handleClick)
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', handleClick)
    }
  })
}
