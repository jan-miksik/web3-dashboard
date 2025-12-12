import { defineNuxtPlugin } from '#app'
import { createAppKit } from '@reown/appkit/vue'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'

import { mainnet, base, optimism, arbitrum, polygon } from '@reown/appkit/networks'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const projectId = config.public.reownProjectId

  // Get app URL from runtime config, with fallback to localhost for development
  const getAppUrl = (): string => {
    const rawUrl = config.public.appUrl
    const configuredUrl = typeof rawUrl === 'string' ? rawUrl : undefined

    if (!configuredUrl) {
      return 'http://localhost:3000'
    }

    try {
      const urlString = configuredUrl.includes('://') ? configuredUrl : `https://${configuredUrl}`

      const url = new URL(urlString)

      // In production (non-localhost), ensure HTTPS is used
      if (
        url.hostname !== 'localhost' &&
        url.hostname !== '127.0.0.1' &&
        url.protocol !== 'https:'
      ) {
        url.protocol = 'https:'
      }

      return url.toString()
    } catch (error: unknown) {
      console.warn('Invalid APP_URL configured, falling back to localhost:', error)
      return 'http://localhost:3000'
    }
  }

  const metadata = {
    name: 'web3 dashboard',
    description: 'web3 dashboard',
    url: getAppUrl(),
    icons: ['/favicon.ico'],
  }

  const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, base, optimism, arbitrum, polygon]

  const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
  })

  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0ea5e9',
      '--w3m-border-radius-master': '2px',
    },
  })
})
