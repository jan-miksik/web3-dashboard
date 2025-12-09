// Chain metadata with icons, L1/L2 types, and Zerion mappings
export interface ChainMetadata {
  id: number
  name: string
  type: 'L1' | 'L2'
  zerionId: string
  icon?: string
  color: string
  bgColor: string
}

// Chain icons from llamao.fi (reliable CDN source)
const CHAIN_ICONS: Record<number, string> = {
  1: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
  137: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
  42161: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
  8453: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
  10: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
  43114: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
  250: 'https://icons.llamao.fi/icons/chains/rsz_fantom.jpg',
  42220: 'https://icons.llamao.fi/icons/chains/rsz_celo.jpg',
  100: 'https://icons.llamao.fi/icons/chains/rsz_gnosis.jpg',
  324: 'https://icons.llamao.fi/icons/chains/rsz_zksync.jpg',
}

// Chain metadata - must match chains-config.ts
export const CHAIN_METADATA: ChainMetadata[] = [
  // L1 Chains
  { 
    id: 1, 
    name: 'Ethereum', 
    type: 'L1',
    zerionId: 'ethereum',
    icon: CHAIN_ICONS[1],
    color: '#627eea',
    bgColor: 'rgba(98, 126, 234, 0.12)',
  },
  { 
    id: 137, 
    name: 'Polygon', 
    type: 'L1',
    zerionId: 'polygon',
    icon: CHAIN_ICONS[137],
    color: '#8247e5',
    bgColor: 'rgba(130, 71, 229, 0.12)',
  },
  { 
    id: 43114, 
    name: 'Avalanche', 
    type: 'L1',
    zerionId: 'avalanche',
    icon: CHAIN_ICONS[43114],
    color: '#e84142',
    bgColor: 'rgba(232, 65, 66, 0.12)',
  },
  { 
    id: 250, 
    name: 'Fantom', 
    type: 'L1',
    zerionId: 'fantom',
    icon: CHAIN_ICONS[250],
    color: '#1969ff',
    bgColor: 'rgba(25, 105, 255, 0.12)',
  },
  { 
    id: 42220, 
    name: 'Celo', 
    type: 'L1',
    zerionId: 'celo',
    icon: CHAIN_ICONS[42220],
    color: '#35d07f',
    bgColor: 'rgba(53, 208, 127, 0.12)',
  },
  { 
    id: 100, 
    name: 'Gnosis', 
    type: 'L1',
    zerionId: 'xdai',
    icon: CHAIN_ICONS[100],
    color: '#04795b',
    bgColor: 'rgba(4, 121, 91, 0.12)',
  },
  
  // L2 Chains
  { 
    id: 8453, 
    name: 'Base', 
    type: 'L2',
    zerionId: 'base',
    icon: CHAIN_ICONS[8453],
    color: '#0052ff',
    bgColor: 'rgba(0, 82, 255, 0.12)',
  },
  { 
    id: 42161, 
    name: 'Arbitrum', 
    type: 'L2',
    zerionId: 'arbitrum',
    icon: CHAIN_ICONS[42161],
    color: '#28a0f0',
    bgColor: 'rgba(40, 160, 240, 0.12)',
  },
  { 
    id: 10, 
    name: 'Optimism', 
    type: 'L2',
    zerionId: 'optimism',
    icon: CHAIN_ICONS[10],
    color: '#ff0420',
    bgColor: 'rgba(255, 4, 32, 0.12)',
  },
  { 
    id: 324, 
    name: 'zkSync Era', 
    type: 'L2',
    zerionId: 'zksync-era',
    icon: CHAIN_ICONS[324],
    color: '#8c8dfc',
    bgColor: 'rgba(140, 141, 252, 0.12)',
  },
]

// Helper functions
export function getChainMetadata(chainId: number): ChainMetadata | undefined {
  return CHAIN_METADATA.find(chain => chain.id === chainId)
}

export function getChainName(chainId: number): string {
  return getChainMetadata(chainId)?.name || `Chain ${chainId}`
}

export function getChainIcon(chainId: number): string | undefined {
  return getChainMetadata(chainId)?.icon
}

export function getChainStyle(chainId: number): { color: string; bgColor: string } {
  const metadata = getChainMetadata(chainId)
  if (metadata) {
    return { color: metadata.color, bgColor: metadata.bgColor }
  }
  return { color: 'var(--text-secondary)', bgColor: 'var(--bg-tertiary)' }
}

// Zerion chain ID to numeric chain ID mapping
export const ZERION_TO_CHAIN_ID: Record<string, number> = {
  'ethereum': 1,
  'polygon': 137,
  'arbitrum': 42161,
  'base': 8453,
  'optimism': 10,
  'avalanche': 43114,
  'fantom': 250,
  'celo': 42220,
  'xdai': 100,
  'gnosis': 100,
  'zksync-era': 324,
}

// Numeric chain ID to Zerion chain ID mapping
export const CHAIN_ID_TO_ZERION: Record<number, string> = Object.fromEntries(
  CHAIN_METADATA.map(chain => [chain.id, chain.zerionId])
)

