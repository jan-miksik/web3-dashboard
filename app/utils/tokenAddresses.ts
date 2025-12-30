import type { Address } from 'viem'
import { zeroAddress } from 'viem'

/**
 * USDC token addresses per chain
 * Note: Some chains may not have USDC or may have bridged versions
 * Returns zeroAddress if USDC is not available on the chain
 */
export const USDC_ADDRESSES: Record<number, Address> = {
  // Mainnet
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum Mainnet USDC
  // L2s
  10: '0x0b2C639c533813f4Aa9D7837CAf992cA34CAC01', // Optimism USDC
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum USDC
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon Native USDC
  // Other chains
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // Avalanche USDC
  250: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', // Fantom USDC
  42220: '0xceba9300f2b948710d2653dd7b07f33a8b32118c', // Celo USDC
  100: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83', // Gnosis USDC
  324: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', // zkSync Era USDC
}

/**
 * Get USDC address for a given chain ID
 * Returns zeroAddress if USDC is not available on the chain
 */
export function getUSDCAddress(chainId: number): Address {
  return USDC_ADDRESSES[chainId] || zeroAddress
}

/**
 * Check if USDC is available on a given chain
 */
export function hasUSDC(chainId: number): boolean {
  return chainId in USDC_ADDRESSES
}

/**
 * Gas token names per chain
 * These are the native tokens used for gas on each chain
 */
export const GAS_TOKEN_NAMES: Record<number, string> = {
  1: 'ETH', // Ethereum
  137: 'POL', // Polygon
  42161: 'ETH', // Arbitrum
  8453: 'ETH', // Base
  10: 'ETH', // Optimism
  43114: 'AVAX', // Avalanche
  250: 'FTM', // Fantom
  42220: 'CELO', // Celo
  100: 'xDAI', // Gnosis
  324: 'ETH', // zkSync Era
}

/**
 * Get gas token name for a given chain ID
 * Returns 'ETH' as default if chain is not found
 */
export function getGasTokenName(chainId: number): string {
  return GAS_TOKEN_NAMES[chainId] || 'ETH'
}
