import { describe, it, expect } from 'vitest'
import {
  getChainMetadata,
  getChainName,
  getChainIcon,
  getChainStyle,
  ZERION_TO_CHAIN_ID,
  CHAIN_ID_TO_ZERION,
  CHAIN_METADATA,
} from '../../../app/utils/chains'

describe('chains utils', () => {
  describe('getChainMetadata', () => {
    it('should return chain metadata for valid chain IDs', () => {
      const ethereum = getChainMetadata(1)
      expect(ethereum).toBeDefined()
      expect(ethereum?.id).toBe(1)
      expect(ethereum?.name).toBe('Ethereum')
      expect(ethereum?.type).toBe('L1')
      expect(ethereum?.zerionId).toBe('ethereum')
    })

    it('should return undefined for invalid chain IDs', () => {
      const invalid = getChainMetadata(99999)
      expect(invalid).toBeUndefined()
    })

    it('should return metadata for all supported chains', () => {
      const supportedChains = [1, 137, 8453, 42161, 10, 43114, 250, 42220, 100, 324]

      supportedChains.forEach(chainId => {
        const metadata = getChainMetadata(chainId)
        expect(metadata).toBeDefined()
        expect(metadata?.id).toBe(chainId)
      })
    })
  })

  describe('getChainName', () => {
    it('should return chain name for valid chain ID', () => {
      expect(getChainName(1)).toBe('Ethereum')
      expect(getChainName(137)).toBe('Polygon')
      expect(getChainName(8453)).toBe('Base')
    })

    it('should return fallback name for invalid chain ID', () => {
      expect(getChainName(99999)).toBe('Chain 99999')
    })
  })

  describe('getChainIcon', () => {
    it('should return icon URL for valid chain ID', () => {
      const icon = getChainIcon(1)
      expect(icon).toBeDefined()
      expect(icon).toContain('llamao.fi')
    })

    it('should return undefined for invalid chain ID', () => {
      const icon = getChainIcon(99999)
      expect(icon).toBeUndefined()
    })
  })

  describe('getChainStyle', () => {
    it('should return color and bgColor for valid chain ID', () => {
      const style = getChainStyle(1)
      expect(style).toBeDefined()
      expect(style.color).toBeDefined()
      expect(style.bgColor).toBeDefined()
      expect(style.color).toBe('#627eea')
    })

    it('should return fallback styles for invalid chain ID', () => {
      const style = getChainStyle(99999)
      expect(style).toBeDefined()
      expect(style.color).toBe('var(--text-secondary)')
      expect(style.bgColor).toBe('var(--bg-tertiary)')
    })
  })

  describe('ZERION_TO_CHAIN_ID mapping', () => {
    it('should map Zerion chain IDs to numeric chain IDs', () => {
      expect(ZERION_TO_CHAIN_ID['ethereum']).toBe(1)
      expect(ZERION_TO_CHAIN_ID['polygon']).toBe(137)
      expect(ZERION_TO_CHAIN_ID['base']).toBe(8453)
      expect(ZERION_TO_CHAIN_ID['arbitrum']).toBe(42161)
      expect(ZERION_TO_CHAIN_ID['optimism']).toBe(10)
    })

    it('should handle both xdai and gnosis for chain ID 100', () => {
      expect(ZERION_TO_CHAIN_ID['xdai']).toBe(100)
      expect(ZERION_TO_CHAIN_ID['gnosis']).toBe(100)
    })
  })

  describe('CHAIN_ID_TO_ZERION mapping', () => {
    it('should map numeric chain IDs to Zerion chain IDs', () => {
      expect(CHAIN_ID_TO_ZERION[1]).toBe('ethereum')
      expect(CHAIN_ID_TO_ZERION[137]).toBe('polygon')
      expect(CHAIN_ID_TO_ZERION[8453]).toBe('base')
    })

    it('should have consistent mappings with ZERION_TO_CHAIN_ID', () => {
      Object.entries(CHAIN_ID_TO_ZERION).forEach(([chainId, zerionId]) => {
        expect(ZERION_TO_CHAIN_ID[zerionId]).toBe(Number(chainId))
      })
    })
  })

  describe('CHAIN_METADATA', () => {
    it('should have all required fields for each chain', () => {
      CHAIN_METADATA.forEach(chain => {
        expect(chain.id).toBeDefined()
        expect(chain.name).toBeDefined()
        expect(chain.type).toBeDefined()
        expect(['L1', 'L2']).toContain(chain.type)
        expect(chain.zerionId).toBeDefined()
        expect(chain.color).toBeDefined()
        expect(chain.bgColor).toBeDefined()
      })
    })

    it('should have unique chain IDs', () => {
      const chainIds = CHAIN_METADATA.map(chain => chain.id)
      const uniqueChainIds = new Set(chainIds)
      expect(uniqueChainIds.size).toBe(chainIds.length)
    })
  })
})
