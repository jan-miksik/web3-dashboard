import type { Address } from 'viem'
import { zeroAddress } from 'viem'

/** Token metadata for common tokens (used in token selector) */
export interface CommonToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

/**
 * Most-used ERC20 tokens per chain (WETH, USDT, DAI, WBTC).
 * Used in target asset dropdown and token select modal.
 * USDC is handled separately as a dedicated option.
 */
export const COMMON_TOKENS_BY_CHAIN: Record<number, CommonToken[]> = {
  1: [
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
    },
  ],
  10: [
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
    },
    {
      address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
    },
  ],
  100: [
    {
      address: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
      symbol: 'WXDAI',
      name: 'Wrapped xDAI',
      decimals: 18,
    },
  ],
  137: [
    {
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
    },
    {
      address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BdD6',
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
    },
  ],
  250: [
    {
      address: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
      symbol: 'WFTM',
      name: 'Wrapped FTM',
      decimals: 18,
    },
    {
      address: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0x8D11eC38a3EB5E95605205251047D7eA92127343',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
    },
  ],
  324: [
    {
      address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0x493257fD37EDB34451f62EDf8D2A0C418852bA4C',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
  ],
  42220: [
    {
      address: '0x122013fd7dF61Cb636ceDd02939d5723037C9b94',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0x617f3112bf5397D0467D315cC709EF968D9ba546',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0xEadf4A7168A82D30Ba0619e64d5BCF5B30B2098B',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
    },
  ],
  43114: [
    {
      address: '0x49D5c2BdFfac6CE2BFB664304f494ee94e083d7d',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0xd586E7F844cEa2F87f50152665bcbc2C279D8d70',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
    },
    {
      address: '0x50b7545627a5162F82A992c33b87aDc75187B218',
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
    },
  ],
  8453: [
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
    },
    {
      address: '0x1ceA84203673764244E05693e42E6Ace62bE9BA5',
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
    },
  ],
  42161: [
    {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0xFd086bC7CD5C481DCC9C85ebe478A1C0b69Fcbb9',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
    },
    {
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0AefC5B0f',
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      decimals: 8,
    },
  ],
}

/**
 * USDC token addresses per chain
 * Note: Some chains may not have USDC or may have bridged versions
 * Returns zeroAddress if USDC is not available on the chain
 */
export const USDC_ADDRESSES: Record<number, Address> = {
  // Mainnet
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum Mainnet USDC
  // L2s
  10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // Optimism USDC
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
 * Get common tokens (WETH, USDT, DAI, WBTC) for a given chain.
 * Used in target asset dropdown and token select modal.
 */
export function getCommonTokens(chainId: number): CommonToken[] {
  return COMMON_TOKENS_BY_CHAIN[chainId] ?? []
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
