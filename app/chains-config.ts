import { http, createConfig } from '@wagmi/vue'
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
} from '@wagmi/vue/chains'

export const config = createConfig({
  chains: [
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
  ],
  
  transports: {
    // mainnets
    [mainnet.id]: http(), 
    [base.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    
    // testnets
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [polygonAmoy.id]: http(),
  },
})
