import { describe, it, expect } from 'vitest'
import {
  ZerionQuantitySchema,
  ZerionPriceSchema,
  ZerionImplementationSchema,
  ZerionFungibleInfoSchema,
  ZerionRelationshipDataSchema,
  ZerionPositionSchema,
  ZerionIncludedItemSchema,
  ZerionApiResponseSchema,
} from '../../../app/utils/zerion-schema'

/**
 * zerion-schema.test.ts
 *
 * SECURES: Zerion API response validation used by positions.get server endpoint.
 * WHY: Malformed API data can crash the app or produce wrong token balances. These schemas
 * are the contract between Zerion and our token list—regressions break portfolio display.
 */
describe('zerion-schema', () => {
  describe('ZerionQuantitySchema', () => {
    it('accepts valid quantity shapes and rejects wrong types', () => {
      expect(ZerionQuantitySchema.safeParse({ int: '1000000000000000000' }).success).toBe(true)
      expect(ZerionQuantitySchema.safeParse({ decimals: 18, float: 1 }).success).toBe(true)
      expect(ZerionQuantitySchema.safeParse({}).success).toBe(true)
      expect(ZerionQuantitySchema.safeParse({ int: 123 }).success).toBe(false) // int must be string
    })
  })

  describe('ZerionPriceSchema', () => {
    it('accepts float and rejects wrong types', () => {
      expect(ZerionPriceSchema.safeParse({ float: 2000 }).success).toBe(true)
      expect(ZerionPriceSchema.safeParse({ float: '2000' }).success).toBe(false)
    })
  })

  describe('ZerionImplementationSchema', () => {
    it('requires chain_id, address (or null), decimals', () => {
      expect(
        ZerionImplementationSchema.safeParse({
          chain_id: 'ethereum',
          address: null,
          decimals: 18,
        }).success
      ).toBe(true)
      expect(ZerionImplementationSchema.safeParse({ chain_id: 'ethereum' }).success).toBe(false)
    })
  })

  describe('ZerionFungibleInfoSchema', () => {
    it('accepts minimal and full fungible info', () => {
      expect(ZerionFungibleInfoSchema.safeParse({ symbol: 'ETH' }).success).toBe(true)
      expect(
        ZerionFungibleInfoSchema.safeParse({
          name: 'Ethereum',
          symbol: 'ETH',
          icon: { url: 'https://example.com/eth.png' },
          implementations: [{ chain_id: 'ethereum', address: null, decimals: 18 }],
        }).success
      ).toBe(true)
    })
  })

  describe('ZerionRelationshipDataSchema', () => {
    it('requires type and id', () => {
      expect(
        ZerionRelationshipDataSchema.safeParse({ type: 'chains', id: 'ethereum' }).success
      ).toBe(true)
      expect(ZerionRelationshipDataSchema.safeParse({ type: 'chains' }).success).toBe(false)
    })
  })

  describe('ZerionPositionSchema', () => {
    it('requires type and id, accepts optional attributes/relationships', () => {
      expect(
        ZerionPositionSchema.safeParse({
          type: 'positions',
          id: 'ethereum-0x123',
          attributes: { name: 'Ethereum', quantity: { int: '1000000000000000000' } },
          relationships: { chain: { data: { type: 'chains', id: 'ethereum' } } },
        }).success
      ).toBe(true)
      expect(ZerionPositionSchema.safeParse({ type: 'positions', id: 'x' }).success).toBe(true)
      expect(ZerionPositionSchema.safeParse({ type: 'positions' }).success).toBe(false)
    })
  })

  describe('ZerionIncludedItemSchema', () => {
    it('requires type and id', () => {
      expect(
        ZerionIncludedItemSchema.safeParse({
          type: 'fungibles',
          id: 'eth',
          attributes: { symbol: 'ETH' },
        }).success
      ).toBe(true)
      expect(ZerionIncludedItemSchema.safeParse({ type: 'fungibles' }).success).toBe(false)
    })
  })

  describe('ZerionApiResponseSchema', () => {
    it('accepts full API response, minimal data, and 202 preparing status', () => {
      expect(
        ZerionApiResponseSchema.safeParse({
          data: [{ type: 'positions', id: 'ethereum-0x123' }],
          included: [{ type: 'fungibles', id: 'eth' }],
          links: { self: 'https://...', next: 'https://...' },
          status: 200,
        }).success
      ).toBe(true)
      expect(ZerionApiResponseSchema.safeParse({ data: [] }).success).toBe(true)
      expect(
        ZerionApiResponseSchema.safeParse({ status: 202, message: 'Portfolio is being prepared' })
          .success
      ).toBe(true)
    })
  })
})
