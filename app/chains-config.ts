import { http, createConfig } from '@wagmi/vue'
import {
  mainnet,
  base,
  optimism,
  arbitrum,
  polygon,
  avalanche,
  celo,
  fantom,
  gnosis,
  zkSync,
} from '@wagmi/vue/chains'

export const config = createConfig({
  chains: [mainnet, base, optimism, arbitrum, polygon, avalanche, celo, fantom, gnosis, zkSync],

  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [avalanche.id]: http(),
    [celo.id]: http(),
    [fantom.id]: http(),
    [gnosis.id]: http(),
    [zkSync.id]: http(),
  },
})
