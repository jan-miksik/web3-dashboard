import { describe, it, expect } from 'vitest'
import {
  WALLET_BATCH_LIMITS,
  BATCH_EXECUTOR_ADDRESS,
  type WalletProvider,
} from '../../../app/composables/useBatchTransaction'

/**
 * useBatchTransaction.test.ts
 *
 * SECURES: Batch execution constants and limits that drive tx splitting.
 * WHY: Exceeding wallet batch limits causes failed txs. Wrong executor address
 * breaks EIP-7702 swaps. These values are critical and rarely change—tests catch
 * accidental edits.
 */
describe('useBatchTransaction', () => {
  describe('WALLET_BATCH_LIMITS', () => {
    const providers: WalletProvider[] = ['metamask', 'rabby', 'coinbase', 'unknown']

    it('defines limit for each known provider', () => {
      providers.forEach(p => {
        expect(WALLET_BATCH_LIMITS[p]).toBeDefined()
        expect(typeof WALLET_BATCH_LIMITS[p]).toBe('number')
        expect(WALLET_BATCH_LIMITS[p]).toBeGreaterThan(0)
      })
    })

    it('uses conservative limit for unknown (matches strictest wallet)', () => {
      expect(WALLET_BATCH_LIMITS.unknown).toBe(WALLET_BATCH_LIMITS.metamask)
    })

    it('has MetaMask as strictest for compatibility', () => {
      const limits = Object.values(WALLET_BATCH_LIMITS)
      expect(Math.min(...limits)).toBe(10)
    })
  })

  describe('BATCH_EXECUTOR_ADDRESS', () => {
    it('is valid Ethereum address', () => {
      expect(BATCH_EXECUTOR_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })
  })
})
