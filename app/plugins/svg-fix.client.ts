import { defineNuxtPlugin } from '#app'
import { logger } from '~/utils/logger'

/**
 * SVG Fix Plugin
 *
 * Patches SVGElement.prototype.setAttribute to prevent empty width/height attributes
 * that can cause browser errors. This is particularly useful for AppKit components
 * that use CSS-based sizing.
 *
 * Cleanup: The plugin stores the original setAttribute method and restores it
 * when the close() hook is called. However, note that Nuxt client plugins don't
 * have a guaranteed cleanup lifecycle hook - the close() method is only called
 * when the app is explicitly torn down (e.g., during HMR or app destruction).
 * In a typical SPA scenario, the patch will persist for the lifetime of the page.
 *
 * To manually cleanup, you can access the cleanup function via:
 * const { $cleanupSvgFix } = useNuxtApp()
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  // Store the original setAttribute method before patching
  // This allows us to restore it during cleanup
  const originalSetAttribute = SVGElement.prototype.setAttribute
  const originalDescriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'setAttribute')

  // Patch SVGElement.setAttribute to prevent empty width/height attributes
  // This prevents the browser error without interfering with AppKit's CSS-based sizing
  SVGElement.prototype.setAttribute = function (name: string, value: string) {
    // Intercept empty width/height attributes - just remove them instead of setting to empty
    if ((name === 'width' || name === 'height') && (!value || value === '')) {
      // Remove the attribute instead of setting it to empty
      // This prevents the error while allowing CSS to control the size
      this.removeAttribute(name)
      return
    }
    return originalSetAttribute.call(this, name, value)
  }

  // Function to clean up any existing empty width/height attributes
  function fixSvgAttributes(svgElement: SVGElement) {
    const widthAttr = svgElement.getAttribute('width')
    const heightAttr = svgElement.getAttribute('height')

    // Remove empty or invalid width attributes
    if (!widthAttr || widthAttr === '' || widthAttr === 'undefined' || widthAttr === 'null') {
      svgElement.removeAttribute('width')
    }

    // Remove empty or invalid height attributes
    if (!heightAttr || heightAttr === '' || heightAttr === 'undefined' || heightAttr === 'null') {
      svgElement.removeAttribute('height')
    }
  }

  // Function to fix all SVG elements
  function fixAllSvgAttributes() {
    const svgElements = document.querySelectorAll('svg')
    svgElements.forEach(svg => {
      fixSvgAttributes(svg as SVGElement)
    })
  }

  // Track if we added the DOMContentLoaded listener for cleanup
  let domContentLoadedListenerAdded = false

  // Run immediately after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixAllSvgAttributes)
    domContentLoadedListenerAdded = true
  } else {
    fixAllSvgAttributes()
  }

  // Observe DOM changes (for dynamically added SVGs from AppKit)
  const domObserver = new MutationObserver(mutations => {
    let hasSvg = false
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (element.tagName === 'SVG' || element.querySelector('svg')) {
              hasSvg = true
              break
            }
          }
        }
      }
      if (hasSvg) break
    }
    if (hasSvg) {
      // Use requestAnimationFrame to fix after render
      requestAnimationFrame(() => {
        fixAllSvgAttributes()
      })
    }
  })

  if (document.body) {
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  // Cleanup function to disconnect observer and restore original setAttribute
  function cleanupSvgFix() {
    // Remove DOMContentLoaded listener if it was added
    if (domContentLoadedListenerAdded) {
      document.removeEventListener('DOMContentLoaded', fixAllSvgAttributes)
    }

    // Disconnect the MutationObserver
    domObserver.disconnect()

    // Restore the original setAttribute method
    // Try to restore using the original descriptor first (preserves property attributes)
    // If that fails or descriptor doesn't exist, fall back to direct assignment
    try {
      if (originalDescriptor) {
        Object.defineProperty(SVGElement.prototype, 'setAttribute', originalDescriptor)
      } else {
        SVGElement.prototype.setAttribute = originalSetAttribute
      }
    } catch (error) {
      // If defineProperty fails (e.g., property is not configurable), try direct assignment
      logger.warn('Failed to restore setAttribute via descriptor, using direct assignment', {
        error,
      })
      SVGElement.prototype.setAttribute = originalSetAttribute
    }
  }

  // Cleanup on unmount - Nuxt will call close() automatically when the app is torn down
  // Note: In typical SPA scenarios, this may not be called until page unload
  return {
    provide: {
      fixSvgAttributes: fixAllSvgAttributes,
      cleanupSvgFix,
      $cleanupSvgFix: cleanupSvgFix, // Expose with $ prefix for consistency with Nuxt conventions
    },
    close() {
      cleanupSvgFix()
    },
  }
})
