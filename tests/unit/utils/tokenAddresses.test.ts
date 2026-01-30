import { describe, it, expect } from 'vitest'
import {
  getCommonTokens,
  getUSDCAddress,
  hasUSDC,
  getGasTokenName,
  COMMON_TOKENS_BY_CHAIN,
  USDC_ADDRESSES,
  GAS_TOKEN_NAMES,
} from '../../../app/utils/tokenAddresses'
import { zeroAddress } from 'viem'

/**
 * tokenAddresses.test.ts
 *
 * SECURES: Token/chain metadata used for swaps and target selection.
 * WHY: Wrong addresses or gas token names cause failed transactions, wrong chains, or lost funds.
 * These maps are the source of truth for token selection across the tx composer.
 */
describe('tokenAddresses', () => {
  describe('getCommonTokens', () => {
    it('returns tokens for known chains', () => {
      const eth = getCommonTokens(1)
      expect(eth.length).toBeGreaterThan(0)
      expect(eth[0]).toMatchObject({
        address: expect.any(String),
        symbol: expect.any(String),
        name: expect.any(String),
        decimals: expect.any(Number),
      })
    })

    it('returns empty array for unknown chain', () => {
      expect(getCommonTokens(99999)).toEqual([])
    })
  })

  describe('getUSDCAddress', () => {
    it('returns USDC address for supported chains', () => {
      expect(getUSDCAddress(1)).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(getUSDCAddress(8453)).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('returns zeroAddress for unsupported chain', () => {
      expect(getUSDCAddress(99999)).toBe(zeroAddress)
    })
  })

  describe('hasUSDC', () => {
    it('returns true for chains with USDC', () => {
      expect(hasUSDC(1)).toBe(true)
      expect(hasUSDC(137)).toBe(true)
    })

    it('returns false for unknown chain', () => {
      expect(hasUSDC(99999)).toBe(false)
    })
  })

  describe('getGasTokenName', () => {
    it('returns correct gas token per chain', () => {
      expect(getGasTokenName(1)).toBe('ETH')
      expect(getGasTokenName(137)).toBe('POL')
      expect(getGasTokenName(43114)).toBe('AVAX')
      expect(getGasTokenName(250)).toBe('FTM')
      expect(getGasTokenName(100)).toBe('xDAI')
    })

    it('defaults to ETH for unknown chain', () => {
      expect(getGasTokenName(99999)).toBe('ETH')
    })
  })

  describe('COMMON_TOKENS_BY_CHAIN', () => {
    it('has expected structure for each chain', () => {
      Object.values(COMMON_TOKENS_BY_CHAIN).forEach(tokens => {
        tokens.forEach(t => {
          expect(t).toMatchObject({
            address: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
            symbol: expect.any(String),
            name: expect.any(String),
            decimals: expect.any(Number),
          })
        })
      })
    })
  })

  describe('USDC_ADDRESSES', () => {
    it('has valid addresses for all entries', () => {
      Object.values(USDC_ADDRESSES).forEach(addr => {
        expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })
  })

  describe('GAS_TOKEN_NAMES', () => {
    it('covers all supported chains in COMMON_TOKENS_BY_CHAIN', () => {
      const chainIds = Object.keys(COMMON_TOKENS_BY_CHAIN).map(Number)
      chainIds.forEach(id => {
        expect(GAS_TOKEN_NAMES[id]).toBeDefined()
        expect(typeof GAS_TOKEN_NAMES[id]).toBe('string')
      })
    })
  })
})
