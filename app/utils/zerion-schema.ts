import { z } from 'zod'

// Zerion API Zod Schemas

export const ZerionQuantitySchema = z.object({
  int: z.string().optional(),
  decimals: z.number().optional(),
  float: z.number().optional(),
  numeric: z.string().optional(),
})

export const ZerionPriceSchema = z.object({
  float: z.number().optional(),
})

export const ZerionValueSchema = z.object({
  float: z.number().optional(),
})

export const ZerionIconSchema = z
  .object({
    url: z.string(),
  })
  .nullable()

export const ZerionFlagsSchema = z.object({
  verified: z.boolean().optional(),
  is_native: z.boolean().optional(),
  displayable: z.boolean().optional(),
  is_trash: z.boolean().optional(),
})

export const ZerionImplementationSchema = z.object({
  chain_id: z.string(),
  address: z.string().nullable(),
  decimals: z.number(),
})

export const ZerionFungibleInfoSchema = z.object({
  name: z.string().optional(),
  symbol: z.string().optional(),
  icon: ZerionIconSchema.optional(),
  flags: ZerionFlagsSchema.optional(),
  implementations: z.array(ZerionImplementationSchema).optional(),
  decimals: z.number().optional(),
})

export const ZerionRelationshipDataSchema = z.object({
  type: z.string(),
  id: z.string(),
})

export const ZerionRelationshipSchema = z.object({
  data: ZerionRelationshipDataSchema.optional(),
  links: z
    .object({
      related: z.string(),
    })
    .optional(),
})

export const ZerionPositionAttributesSchema = z.object({
  parent: z.string().nullable().optional(),
  protocol: z.string().nullable().optional(),
  name: z.string().optional(),
  position_type: z.string().optional(),
  quantity: ZerionQuantitySchema.optional(),
  price: z.union([z.number(), ZerionPriceSchema]).nullable().optional(),
  value: z.union([z.number(), ZerionValueSchema]).nullable().optional(),
  changes: z
    .object({
      absolute_1d: z.number().optional(),
      percent_1d: z.number().optional(),
    })
    .nullable()
    .optional(),
  fungible_info: ZerionFungibleInfoSchema.optional(),
  flags: ZerionFlagsSchema.optional(),
  updated_at: z.string().optional(),
  updated_at_block: z.number().optional(),
})

export const ZerionPositionRelationshipsSchema = z.object({
  chain: ZerionRelationshipSchema.optional(),
  fungible: ZerionRelationshipSchema.optional(),
})

export const ZerionPositionSchema = z.object({
  type: z.string(),
  id: z.string(),
  attributes: ZerionPositionAttributesSchema.optional(),
  relationships: ZerionPositionRelationshipsSchema.optional(),
})

export const ZerionIncludedItemSchema = z.object({
  type: z.string(),
  id: z.string(),
  attributes: z.union([ZerionFungibleInfoSchema, z.record(z.string(), z.unknown())]).optional(),
})

export const ZerionApiResponseSchema = z.object({
  data: z.array(ZerionPositionSchema).optional(),
  included: z.array(ZerionIncludedItemSchema).optional(),
  links: z
    .object({
      self: z.string().optional(),
      next: z.string().optional(),
      prev: z.string().optional(),
    })
    .optional(),
  status: z.number().optional(),
  message: z.string().optional(),
})
