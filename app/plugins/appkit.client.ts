import { defineNuxtPlugin } from '#app'
import { createAppKit } from '@reown/appkit/vue'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'

import { 
  // mainnets
  mainnet, 
  base, 
  optimism,
  arbitrum,
  polygon,

  // testnets
  sepolia, 
  baseSepolia, 
  optimismSepolia,
  arbitrumSepolia, 
  polygonAmoy
} from '@reown/appkit/networks'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const projectId = config.public.reownProjectId
  
  // Get app URL from runtime config, with fallback to localhost for development
  const getAppUrl = (): string => {
    const rawUrl = config.public.appUrl
    const configuredUrl = typeof rawUrl === 'string' ? rawUrl : undefined
    
    // If no URL is configured, use localhost for development
    if (!configuredUrl) {
      return 'http://localhost:3000'
    }
    
    try {
      // Ensure URL has a protocol (default to https if missing)
      const urlString = configuredUrl.includes('://') 
        ? configuredUrl 
        : `https://${configuredUrl}`
      
      const url = new URL(urlString)
      
      // In production (non-localhost), ensure HTTPS is used
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.protocol !== 'https:') {
        url.protocol = 'https:'
      }
      
      return url.toString()
    } catch (error: unknown) {
      // If URL parsing fails, fall back to localhost
      console.warn('Invalid APP_URL configured, falling back to localhost:', error)
      return 'http://localhost:3000'
    }
  }

  const metadata = {
    name: 'web3 dashboard',
    description: 'web3 dashboard',
    url: getAppUrl(),
    icons: ['/favicon.ico']
  }

  const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
    // mainnets
    mainnet, 
    base, 
    optimism,
    arbitrum,
    polygon,

    // testnets
    sepolia, 
    baseSepolia, 
    optimismSepolia,
    arbitrumSepolia, 
    polygonAmoy
  ]

  const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks
  })

  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    features: {
      analytics: false,
      email: false,
      socials: false
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0ea5e9',
      '--w3m-border-radius-master': '2px'
    }
  })
})

