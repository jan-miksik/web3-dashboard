import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { arbitrum, base, mainnet, optimism, polygon } from '@reown/appkit/networks'
import { http, createConfig } from '@wagmi/vue'
import { avalanche, celo, fantom, gnosis, zksync } from '@wagmi/vue/chains'

/**
 * Default wagmi config used when Reown `projectId` is not available.
 * Also used as a shared source of truth for "supportedChainIds" elsewhere in the app.
 */
export const defaultWagmiConfig = createConfig({
  chains: [mainnet, base, optimism, arbitrum, polygon, avalanche, celo, fantom, gnosis, zksync],

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
    [zksync.id]: http(),
  },
})

export const appKitNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  base,
  optimism,
  arbitrum,
  polygon,
  avalanche,
  celo,
  fantom,
  gnosis,
  zksync,
]

const globalKey = '__web3_dashboard_wagmi_adapter__'
const globalPidKey = '__web3_dashboard_wagmi_project_id__'

function getGlobal() {
  return typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : null
}

/**
 * Singleton WagmiAdapter to prevent HMR/re-init flapping (connect → disconnect)
 * during social login flows.
 */
export function getWagmiAdapter(projectId: string) {
  const g = getGlobal()
  const currentPid = (g?.[globalPidKey] as string | undefined) ?? null
  let adapter = (g?.[globalKey] as WagmiAdapter | undefined) ?? null

  if (adapter && currentPid && currentPid !== projectId) {
    adapter = null
  }

  if (!adapter) {
    adapter = new WagmiAdapter({
      projectId,
      networks: appKitNetworks,
    })
    if (g) {
      g[globalKey] = adapter
      g[globalPidKey] = projectId
    }
  }

  return adapter
}
