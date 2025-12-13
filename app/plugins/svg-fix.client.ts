import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  // Patch SVGElement.setAttribute to prevent empty width/height attributes
  // This prevents the browser error without interfering with AppKit's CSS-based sizing
  const originalSetAttribute = SVGElement.prototype.setAttribute
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

  // Run immediately after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixAllSvgAttributes)
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

  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Cleanup on unmount
  return {
    provide: {
      fixSvgAttributes: fixAllSvgAttributes,
    },
  }
})
