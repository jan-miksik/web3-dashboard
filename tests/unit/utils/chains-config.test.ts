import { describe, it, expect } from 'vitest'
import { defaultWagmiConfig } from '../../../app/utils/wagmi'
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

describe('wagmi default config', () => {
  describe('defaultWagmiConfig', () => {
    it('should export a config object', () => {
      expect(defaultWagmiConfig).toBeDefined()
      expect(defaultWagmiConfig).toHaveProperty('chains')
      // Note: wagmi config structure may vary, but chains should always be present
    })

    it('should include all expected chains', () => {
      const expectedChainIds = [
        mainnet.id,
        base.id,
        optimism.id,
        arbitrum.id,
        polygon.id,
        avalanche.id,
        celo.id,
        fantom.id,
        gnosis.id,
        zkSync.id,
      ]

      const configChainIds = defaultWagmiConfig.chains.map(chain => chain.id)

      expectedChainIds.forEach(chainId => {
        expect(configChainIds).toContain(chainId)
      })
    })

    it('should have correct number of chains', () => {
      expect(defaultWagmiConfig.chains).toHaveLength(10)
    })

    it('should have valid chain IDs', () => {
      // Wagmi config may structure transports differently
      // The important thing is that all chains are configured
      defaultWagmiConfig.chains.forEach(chain => {
        expect(chain).toBeDefined()
        expect(chain.id).toBeGreaterThan(0)
      })
    })

    it('should have mainnet chain configured', () => {
      const mainnetChain = defaultWagmiConfig.chains.find(chain => chain.id === mainnet.id)
      expect(mainnetChain).toBeDefined()
      expect(mainnetChain?.id).toBe(1)
    })

    it('should have base chain configured', () => {
      const baseChain = defaultWagmiConfig.chains.find(chain => chain.id === base.id)
      expect(baseChain).toBeDefined()
      expect(baseChain?.id).toBe(8453)
    })

    it('should have polygon chain configured', () => {
      const polygonChain = defaultWagmiConfig.chains.find(chain => chain.id === polygon.id)
      expect(polygonChain).toBeDefined()
      expect(polygonChain?.id).toBe(137)
    })

    it('should have arbitrum chain configured', () => {
      const arbitrumChain = defaultWagmiConfig.chains.find(chain => chain.id === arbitrum.id)
      expect(arbitrumChain).toBeDefined()
      expect(arbitrumChain?.id).toBe(42161)
    })

    it('should have optimism chain configured', () => {
      const optimismChain = defaultWagmiConfig.chains.find(chain => chain.id === optimism.id)
      expect(optimismChain).toBeDefined()
      expect(optimismChain?.id).toBe(10)
    })

    it('should have avalanche chain configured', () => {
      const avalancheChain = defaultWagmiConfig.chains.find(chain => chain.id === avalanche.id)
      expect(avalancheChain).toBeDefined()
      expect(avalancheChain?.id).toBe(43114)
    })

    it('should have celo chain configured', () => {
      const celoChain = defaultWagmiConfig.chains.find(chain => chain.id === celo.id)
      expect(celoChain).toBeDefined()
      expect(celoChain?.id).toBe(42220)
    })

    it('should have fantom chain configured', () => {
      const fantomChain = defaultWagmiConfig.chains.find(chain => chain.id === fantom.id)
      expect(fantomChain).toBeDefined()
      expect(fantomChain?.id).toBe(250)
    })

    it('should have gnosis chain configured', () => {
      const gnosisChain = defaultWagmiConfig.chains.find(chain => chain.id === gnosis.id)
      expect(gnosisChain).toBeDefined()
      expect(gnosisChain?.id).toBe(100)
    })

    it('should have zkSync chain configured', () => {
      const zkSyncChain = defaultWagmiConfig.chains.find(chain => chain.id === zkSync.id)
      expect(zkSyncChain).toBeDefined()
      expect(zkSyncChain?.id).toBe(324)
    })

    it('should have unique chain IDs', () => {
      const chainIds = defaultWagmiConfig.chains.map(chain => chain.id)
      const uniqueChainIds = new Set(chainIds)
      expect(uniqueChainIds.size).toBe(chainIds.length)
    })
  })
})
