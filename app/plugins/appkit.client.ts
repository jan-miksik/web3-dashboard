import { defineNuxtPlugin } from '#app'
import { createAppKit } from '@reown/appkit/vue'
import { appKitNetworks, getWagmiAdapter } from '~/utils/wagmi'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const projectId = config.public.reownProjectId

  // Guard against multiple AppKit initializations (HMR / repeated plugin runs)
  // This can cause auth/wagmi state to flap (connect → disconnect) during social login flows.
  const globalKey = '__web3_dashboard_appkit_initialized__'
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>)[globalKey]) {
    return
  }
  if (typeof globalThis !== 'undefined') {
    ;(globalThis as Record<string, unknown>)[globalKey] = true
  }

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

  if (!projectId) {
    return
  }

  const wagmiAdapter = getWagmiAdapter(projectId)

  createAppKit({
    adapters: [wagmiAdapter],
    networks: appKitNetworks,
    projectId,
    metadata,
    features: {
      connectMethodsOrder: ['social', 'email', 'wallet'],
      analytics: false,
      email: true,
      socials: ['google', 'github', 'apple', 'facebook', 'x', 'discord', 'farcaster'],
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0ea5e9',
      '--w3m-border-radius-master': '2px',
    },
  })
})
