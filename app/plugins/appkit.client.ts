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
  const projectId = useRuntimeConfig().public.reownProjectId

  const metadata = {
    name: 'web3 dashboard',
    description: 'web3 dashboard',
    url: 'https://web3-dashboard.com',
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

