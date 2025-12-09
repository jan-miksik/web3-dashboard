import type { ZerionApiResponse } from '~/types/zerion'
import { CHAIN_ID_TO_ZERION } from '~/utils/chains'

// Zerion API base URL
const ZERION_API_BASE = 'https://api.zerion.io/v1'

// Create HTTP Basic Auth header
function getAuthHeader(apiKey: string): string {
  // HTTP Basic Auth: base64(apiKey:)
  const credentials = Buffer.from(`${apiKey}:`).toString('base64')
  return `Basic ${credentials}`
}

export default defineEventHandler(async (event): Promise<ZerionApiResponse> => {
  const query = getQuery(event)
  const walletAddress = query.address as string

  if (!walletAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Wallet address is required',
    })
  }

  const config = useRuntimeConfig()
  const apiKey = config.zerionApiKey as string

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Zerion API key is not configured',
    })
  }

  // Get supported chain IDs from query or use default
  const chainIds = query.chainIds 
    ? (Array.isArray(query.chainIds) ? query.chainIds : [query.chainIds]).map(String)
    : Object.keys(CHAIN_ID_TO_ZERION).map(String)

  // Convert numeric chain IDs to Zerion chain IDs
  const zerionChainIds = chainIds
    .map(id => CHAIN_ID_TO_ZERION[Number(id)])
    .filter(Boolean) as string[]

  // Zerion API endpoint for wallet positions
  const apiUrl = `${ZERION_API_BASE}/wallets/${walletAddress}/positions/`

  // Build query parameters
  const params = new URLSearchParams()
  
  // Add chain filter if we have supported chains
  if (zerionChainIds.length > 0) {
    zerionChainIds.forEach(chainId => {
      params.append('filter[chain_ids]', chainId)
    })
  }
  
  // Filter for fungible assets only (tokens, not NFTs or protocol positions)
  params.append('filter[asset_types]', 'fungible')
  
  // Pagination
  params.append('page[size]', '100')

  try {
    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(apiKey),
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 202) {
        // 202 means portfolio is being prepared
        return {
          data: [],
          status: 202,
          message: 'Portfolio is being prepared',
        }
      }
      
      const errorText = await response.text()
      throw createError({
        statusCode: response.status,
        statusMessage: `Zerion API error: ${errorText}`,
      })
    }

    const data = await response.json() as ZerionApiResponse
    return data
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch token balances: ${errorMessage}`,
    })
  }
})

