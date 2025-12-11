import { describe, it, expect } from 'vitest'
import {
  ZerionQuantitySchema,
  ZerionPriceSchema,
  ZerionValueSchema,
  ZerionIconSchema,
  ZerionFlagsSchema,
  ZerionImplementationSchema,
  ZerionFungibleInfoSchema,
  ZerionRelationshipDataSchema,
  ZerionRelationshipSchema,
  ZerionPositionAttributesSchema,
  ZerionPositionRelationshipsSchema,
  ZerionPositionSchema,
  ZerionIncludedItemSchema,
  ZerionApiResponseSchema,
} from '../../../app/utils/zerion-schema'

describe('zerion-schema', () => {
  describe('ZerionQuantitySchema', () => {
    it('should validate quantity with int', () => {
      const result = ZerionQuantitySchema.safeParse({ int: '1000000000000000000' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.int).toBe('1000000000000000000')
      }
    })

    it('should validate quantity with decimals', () => {
      const result = ZerionQuantitySchema.safeParse({ decimals: 18 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.decimals).toBe(18)
      }
    })

    it('should validate quantity with float', () => {
      const result = ZerionQuantitySchema.safeParse({ float: 1.5 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.float).toBe(1.5)
      }
    })

    it('should validate quantity with numeric', () => {
      const result = ZerionQuantitySchema.safeParse({ numeric: '1.5' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.numeric).toBe('1.5')
      }
    })

    it('should validate quantity with all fields', () => {
      const result = ZerionQuantitySchema.safeParse({
        int: '1000000000000000000',
        decimals: 18,
        float: 1.0,
        numeric: '1.0',
      })
      expect(result.success).toBe(true)
    })

    it('should validate empty quantity object', () => {
      const result = ZerionQuantitySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid quantity types', () => {
      const result = ZerionQuantitySchema.safeParse({ int: 123 })
      expect(result.success).toBe(false)
    })
  })

  describe('ZerionPriceSchema', () => {
    it('should validate price with float', () => {
      const result = ZerionPriceSchema.safeParse({ float: 2000.5 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.float).toBe(2000.5)
      }
    })

    it('should validate empty price object', () => {
      const result = ZerionPriceSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid price types', () => {
      const result = ZerionPriceSchema.safeParse({ float: '2000' })
      expect(result.success).toBe(false)
    })
  })

  describe('ZerionValueSchema', () => {
    it('should validate value with float', () => {
      const result = ZerionValueSchema.safeParse({ float: 5000.25 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.float).toBe(5000.25)
      }
    })

    it('should validate empty value object', () => {
      const result = ZerionValueSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('ZerionIconSchema', () => {
    it('should validate icon with url', () => {
      const result = ZerionIconSchema.safeParse({ url: 'https://example.com/icon.png' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data?.url).toBe('https://example.com/icon.png')
      }
    })

    it('should validate null icon', () => {
      const result = ZerionIconSchema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeNull()
      }
    })

    it('should reject icon without url', () => {
      const result = ZerionIconSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('ZerionFlagsSchema', () => {
    it('should validate flags with verified', () => {
      const result = ZerionFlagsSchema.safeParse({ verified: true })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.verified).toBe(true)
      }
    })

    it('should validate flags with is_native', () => {
      const result = ZerionFlagsSchema.safeParse({ is_native: true })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.is_native).toBe(true)
      }
    })

    it('should validate flags with all fields', () => {
      const result = ZerionFlagsSchema.safeParse({
        verified: true,
        is_native: false,
        displayable: true,
        is_trash: false,
      })
      expect(result.success).toBe(true)
    })

    it('should validate empty flags object', () => {
      const result = ZerionFlagsSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('ZerionImplementationSchema', () => {
    it('should validate implementation with all fields', () => {
      const result = ZerionImplementationSchema.safeParse({
        chain_id: 'ethereum',
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.chain_id).toBe('ethereum')
        expect(result.data.address).toBe('0x1234567890123456789012345678901234567890')
        expect(result.data.decimals).toBe(18)
      }
    })

    it('should validate implementation with null address', () => {
      const result = ZerionImplementationSchema.safeParse({
        chain_id: 'ethereum',
        address: null,
        decimals: 18,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.address).toBeNull()
      }
    })

    it('should reject implementation without required fields', () => {
      const result = ZerionImplementationSchema.safeParse({
        chain_id: 'ethereum',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ZerionFungibleInfoSchema', () => {
    it('should validate fungible info with all fields', () => {
      const result = ZerionFungibleInfoSchema.safeParse({
        name: 'Ethereum',
        symbol: 'ETH',
        icon: { url: 'https://example.com/eth.png' },
        flags: { verified: true },
        implementations: [
          {
            chain_id: 'ethereum',
            address: null,
            decimals: 18,
          },
        ],
        decimals: 18,
      })
      expect(result.success).toBe(true)
    })

    it('should validate fungible info with minimal fields', () => {
      const result = ZerionFungibleInfoSchema.safeParse({
        symbol: 'ETH',
      })
      expect(result.success).toBe(true)
    })

    it('should validate empty fungible info object', () => {
      const result = ZerionFungibleInfoSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('ZerionRelationshipDataSchema', () => {
    it('should validate relationship data', () => {
      const result = ZerionRelationshipDataSchema.safeParse({
        type: 'chains',
        id: 'ethereum',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('chains')
        expect(result.data.id).toBe('ethereum')
      }
    })

    it('should reject relationship data without required fields', () => {
      const result = ZerionRelationshipDataSchema.safeParse({
        type: 'chains',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ZerionRelationshipSchema', () => {
    it('should validate relationship with data', () => {
      const result = ZerionRelationshipSchema.safeParse({
        data: {
          type: 'chains',
          id: 'ethereum',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate relationship with links', () => {
      const result = ZerionRelationshipSchema.safeParse({
        links: {
          related: 'https://api.zerion.io/v1/chains/ethereum',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate relationship with both data and links', () => {
      const result = ZerionRelationshipSchema.safeParse({
        data: {
          type: 'chains',
          id: 'ethereum',
        },
        links: {
          related: 'https://api.zerion.io/v1/chains/ethereum',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate empty relationship object', () => {
      const result = ZerionRelationshipSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('ZerionPositionAttributesSchema', () => {
    it('should validate position attributes with all fields', () => {
      const result = ZerionPositionAttributesSchema.safeParse({
        parent: null,
        protocol: 'ethereum',
        name: 'Ethereum',
        position_type: 'asset',
        quantity: {
          int: '1000000000000000000',
          float: 1.0,
        },
        price: { float: 2000 },
        value: { float: 2000 },
        changes: {
          absolute_1d: 100,
          percent_1d: 5.0,
        },
        fungible_info: {
          symbol: 'ETH',
        },
        flags: { verified: true },
        updated_at: '2024-01-01T00:00:00Z',
        updated_at_block: 12345678,
      })
      expect(result.success).toBe(true)
    })

    it('should validate position attributes with numeric price', () => {
      const result = ZerionPositionAttributesSchema.safeParse({
        price: 2000,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.price).toBe(2000)
      }
    })

    it('should validate position attributes with numeric value', () => {
      const result = ZerionPositionAttributesSchema.safeParse({
        value: 5000,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.value).toBe(5000)
      }
    })

    it('should validate position attributes with null price', () => {
      const result = ZerionPositionAttributesSchema.safeParse({
        price: null,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.price).toBeNull()
      }
    })

    it('should validate empty position attributes object', () => {
      const result = ZerionPositionAttributesSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('ZerionPositionRelationshipsSchema', () => {
    it('should validate position relationships with chain', () => {
      const result = ZerionPositionRelationshipsSchema.safeParse({
        chain: {
          data: {
            type: 'chains',
            id: 'ethereum',
          },
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate position relationships with fungible', () => {
      const result = ZerionPositionRelationshipsSchema.safeParse({
        fungible: {
          data: {
            type: 'fungibles',
            id: 'eth',
          },
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate empty position relationships object', () => {
      const result = ZerionPositionRelationshipsSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('ZerionPositionSchema', () => {
    it('should validate position with all fields', () => {
      const result = ZerionPositionSchema.safeParse({
        type: 'positions',
        id: 'ethereum-0x123',
        attributes: {
          name: 'Ethereum',
        },
        relationships: {
          chain: {
            data: {
              type: 'chains',
              id: 'ethereum',
            },
          },
        },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('positions')
        expect(result.data.id).toBe('ethereum-0x123')
      }
    })

    it('should validate position with minimal fields', () => {
      const result = ZerionPositionSchema.safeParse({
        type: 'positions',
        id: 'ethereum-0x123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject position without required fields', () => {
      const result = ZerionPositionSchema.safeParse({
        type: 'positions',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ZerionIncludedItemSchema', () => {
    it('should validate included item with fungible info attributes', () => {
      const result = ZerionIncludedItemSchema.safeParse({
        type: 'fungibles',
        id: 'eth',
        attributes: {
          symbol: 'ETH',
          name: 'Ethereum',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate included item with record attributes', () => {
      const result = ZerionIncludedItemSchema.safeParse({
        type: 'chains',
        id: 'ethereum',
        attributes: {
          name: 'Ethereum',
          network: 'mainnet',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate included item without attributes', () => {
      const result = ZerionIncludedItemSchema.safeParse({
        type: 'fungibles',
        id: 'eth',
      })
      expect(result.success).toBe(true)
    })

    it('should reject included item without required fields', () => {
      const result = ZerionIncludedItemSchema.safeParse({
        type: 'fungibles',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ZerionApiResponseSchema', () => {
    it('should validate API response with all fields', () => {
      const result = ZerionApiResponseSchema.safeParse({
        data: [
          {
            type: 'positions',
            id: 'ethereum-0x123',
          },
        ],
        included: [
          {
            type: 'fungibles',
            id: 'eth',
          },
        ],
        links: {
          self: 'https://api.zerion.io/v1/positions',
          next: 'https://api.zerion.io/v1/positions?page=2',
        },
        status: 200,
        message: 'Success',
      })
      expect(result.success).toBe(true)
    })

    it('should validate API response with minimal fields', () => {
      const result = ZerionApiResponseSchema.safeParse({
        data: [],
      })
      expect(result.success).toBe(true)
    })

    it('should validate API response with 202 status (portfolio being prepared)', () => {
      const result = ZerionApiResponseSchema.safeParse({
        status: 202,
        message: 'Portfolio is being prepared',
      })
      expect(result.success).toBe(true)
    })

    it('should validate empty API response object', () => {
      const result = ZerionApiResponseSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })
})
