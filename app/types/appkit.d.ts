// Type declarations for Reown AppKit web components
// These components are globally registered by createAppKit()

import 'vue'

declare module 'vue' {
  export interface GlobalComponents {
    /**
     * The AppKit button web component - handles connect/disconnect UI
     * Registered globally by AppKit initialization
     */
    'appkit-button': {
      /** Optional: Custom balance display */
      balance?: 'show' | 'hide'
      /** Optional: Size variant */
      size?: 'sm' | 'md'
      /** Optional: Custom label */
      label?: string
      /** Optional: Loading state indicator */
      loadingLabel?: string
      /** Optional: Disabled state */
      disabled?: boolean
    }
    
    /**
     * AppKit network button - shows current network with switch option
     */
    'appkit-network-button': {
      /** Optional: Disabled state */
      disabled?: boolean
    }

    /**
     * AppKit account button - shows account info when connected
     */
    'appkit-account-button': {
      /** Optional: Disabled state */
      disabled?: boolean
      /** Optional: Balance display */
      balance?: 'show' | 'hide'
    }
  }
}

export {}

