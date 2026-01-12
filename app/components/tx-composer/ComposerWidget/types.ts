import type { Route } from '@lifi/sdk'
import type { Address } from 'viem'

export type TargetAssetMode = 'native' | 'usdc' | 'custom'

export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading'; paramsKey?: string }
  | { status: 'ok'; route: Route; cached: boolean; paramsKey: string }
  | { status: 'error'; message: string; paramsKey: string }

export interface ResolvedToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}
