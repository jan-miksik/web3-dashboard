// Zerion API Type Definitions

export interface ZerionQuantity {
  int?: string
  decimals?: number
  float?: number
  numeric?: string
}

export interface ZerionPrice {
  float?: number
}

export interface ZerionValue {
  float?: number
}

export interface ZerionIcon {
  url: string
}

export interface ZerionFlags {
  verified?: boolean
  is_native?: boolean
  displayable?: boolean
  is_trash?: boolean
}

export interface ZerionImplementation {
  chain_id: string
  address: string | null
  decimals: number
}

export interface ZerionFungibleInfo {
  name?: string
  symbol?: string
  icon?: ZerionIcon | null
  flags?: ZerionFlags
  implementations?: ZerionImplementation[]
  decimals?: number
}

export interface ZerionRelationshipData {
  type: string
  id: string
}

export interface ZerionRelationship {
  data?: ZerionRelationshipData
  links?: {
    related: string
  }
}

export interface ZerionPositionAttributes {
  parent?: string | null
  protocol?: string | null
  name?: string
  position_type?: string
  quantity?: ZerionQuantity
  price?: number | ZerionPrice | null
  value?: number | ZerionValue | null
  changes?: {
    absolute_1d?: number
    percent_1d?: number
  } | null
  fungible_info?: ZerionFungibleInfo
  flags?: ZerionFlags
  updated_at?: string
  updated_at_block?: number
}

export interface ZerionPositionRelationships {
  chain?: ZerionRelationship
  fungible?: ZerionRelationship
}

export interface ZerionPosition {
  type: string
  id: string
  attributes?: ZerionPositionAttributes
  relationships?: ZerionPositionRelationships
}

export interface ZerionIncludedItem {
  type: string
  id: string
  attributes?: ZerionFungibleInfo | Record<string, unknown>
}

export interface ZerionApiResponse {
  data?: ZerionPosition[]
  included?: ZerionIncludedItem[]
  links?: {
    self?: string
    next?: string
    prev?: string
  }
  status?: number
  message?: string
}

