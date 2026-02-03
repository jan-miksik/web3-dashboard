import { describe, it, expect } from 'vitest'
import {
  shortenAddress,
  formatUsdValueParts,
  formatUsdValueString,
  formatWeiAsEth,
} from '../../../app/utils/format'

/**
 * format.test.ts
 *
 * SECURES: Correct USD display across the app (token list, tx composer, portfolio totals).
 * WHY: Wrong formatting misleads users about portfolio value; edge cases (dust, large values)
 * must render correctly. Regressions here directly affect user trust.
 */
describe('format', () => {
  describe('shortenAddress', () => {
    it('shortens address to 6...4 by default', () => {
      expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678')
    })

    it('returns empty string for empty input', () => {
      expect(shortenAddress('')).toBe('')
    })

    it('returns full string when shorter than start+end', () => {
      expect(shortenAddress('0x1234')).toBe('0x1234')
    })
  })

  describe('formatUsdValueParts', () => {
    it('returns $0.00 for zero or non-finite values', () => {
      expect(formatUsdValueParts(0)).toEqual({ main: '$0.00', extra: null })
      expect(formatUsdValueParts(-1)).toEqual({ main: '$0.00', extra: null })
      expect(formatUsdValueParts(NaN)).toEqual({ main: '$0.00', extra: null })
      expect(formatUsdValueParts(Infinity)).toEqual({ main: '$0.00', extra: null })
    })

    it('formats standard values >= $0.01 with 2 decimals', () => {
      expect(formatUsdValueParts(1)).toEqual({ main: '$1.00', extra: null })
      expect(formatUsdValueParts(0.01)).toEqual({ main: '$0.01', extra: null })
      expect(formatUsdValueParts(1234.56)).toEqual({ main: '$1,234.56', extra: null })
    })

    it('formats dust (< $0.01) with extra decimals to reveal non-zero', () => {
      const result = formatUsdValueParts(0.001234)
      expect(result.main).toMatch(/\$0\.00/)
      expect(result.extra).not.toBeNull()
      expect(result.extra).toMatch(/1|2|3|4/)
    })

    it('handles exact dust boundary', () => {
      expect(formatUsdValueParts(0.01)).toEqual({ main: '$0.01', extra: null })
      const below = formatUsdValueParts(0.009)
      expect(below.main).toMatch(/\$0\.00/)
      expect(below.extra).not.toBeNull()
    })

    it('handles sub-micro values (all-zero decimals branch)', () => {
      const r = formatUsdValueParts(0.0000001)
      expect(r.main).toMatch(/\$0\.00/)
    })
  })

  describe('formatWeiAsEth', () => {
    it('formats wei as ETH', () => {
      expect(formatWeiAsEth(1_000_000_000_000_000_000n)).toBe('1.0000 ETH')
      expect(formatWeiAsEth(500_000_000_000_000n)).toBe('0.000500 ETH')
      expect(formatWeiAsEth(123_456_789_000_000_000n)).toBe('0.123457 ETH')
    })

    it('returns 0 ETH for zero or negative', () => {
      expect(formatWeiAsEth(0n)).toBe('0 ETH')
      expect(formatWeiAsEth(-1n)).toBe('0 ETH')
    })
  })

  describe('formatUsdValueString', () => {
    it('combines main and extra into a single string', () => {
      expect(formatUsdValueString(100)).toBe('$100.00')
      const dust = formatUsdValueString(0.001)
      expect(dust).toContain('$0.00')
      expect(dust.length).toBeGreaterThan(5)
    })
  })
})
