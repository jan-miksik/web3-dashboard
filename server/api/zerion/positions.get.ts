import type { ZerionApiResponse, ZerionPosition, ZerionIncludedItem } from '~/types/zerion'
import { CHAIN_ID_TO_ZERION } from '~/utils/chains'
import { ZerionApiResponseSchema } from '~/utils/zerion-schema'

import type { H3Event } from 'h3'

const ZERION_API_BASE = 'https://api.zerion.io/v1'

// HTTP Basic Auth: base64(apiKey:)
function getAuthHeader(apiKey: string): string {
  const credentials = Buffer.from(`${apiKey}:`).toString('base64')
  return `Basic ${credentials}`
}

// Allow dependency injection for testing
function getRuntimeConfig() {
  return useRuntimeConfig()
}

export default defineEventHandler(async (event): Promise<ZerionApiResponse> => {
  return handlePositionsRequest(event, getRuntimeConfig)
})

export async function handlePositionsRequest(
  event: H3Event,
  getConfig: () => ReturnType<typeof useRuntimeConfig> = getRuntimeConfig
): Promise<ZerionApiResponse> {
  const query = getQuery(event)
  const walletAddress = query.address as string

  if (!walletAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Wallet address is required',
    })
  }

  const config = getConfig()
  const apiKey = config.zerionApiKey as string

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Zerion API key is not configured',
    })
  }

  const chainIds = query.chainIds
    ? (Array.isArray(query.chainIds) ? query.chainIds : [query.chainIds]).map(String)
    : Object.keys(CHAIN_ID_TO_ZERION).map(String)

  const zerionChainIds = chainIds
    .map(id => CHAIN_ID_TO_ZERION[Number(id)])
    .filter(Boolean) as string[]

  const apiUrl = `${ZERION_API_BASE}/wallets/${walletAddress}/positions/`

  const baseParams = new URLSearchParams()

  if (zerionChainIds.length > 0) {
    zerionChainIds.forEach(chainId => {
      baseParams.append('filter[chain_ids]', chainId)
    })
  }

  // Filter for fungible assets only (tokens, not NFTs or protocol positions)
  baseParams.append('filter[asset_types]', 'fungible')

  baseParams.append('page[size]', '100')

  async function fetchPage(url: string): Promise<ZerionApiResponse> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(apiKey),
        Accept: 'application/json',
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

    let jsonData: unknown
    try {
      jsonData = await response.json()
    } catch (_parseError) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Failed to parse Zerion API response as JSON',
      })
    }

    // Validate response structure with Zod
    const validationResult = ZerionApiResponseSchema.safeParse(jsonData)

    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ')
      throw createError({
        statusCode: 502,
        statusMessage: `Invalid Zerion API response structure: ${errorDetails}`,
      })
    }

    return validationResult.data
  }

  try {
    const allData: ZerionPosition[] = []
    const allIncluded: ZerionIncludedItem[] = []
    let nextPageUrl: string | null = null
    let currentUrl = `${apiUrl}?${baseParams.toString()}`
    let pageCount = 0
    const maxPages = 100 // Safety limit to prevent infinite loops

    do {
      const pageResponse = await fetchPage(currentUrl)

      if (pageResponse.status === 202) {
        return {
          data: [],
          status: 202,
          message: 'Portfolio is being prepared',
        }
      }

      if (pageResponse.data) {
        allData.push(...pageResponse.data)
      }
      if (pageResponse.included) {
        allIncluded.push(...pageResponse.included)
      }

      nextPageUrl = pageResponse.links?.next || null
      if (nextPageUrl) {
        currentUrl = nextPageUrl
        pageCount++

        // Safety check to prevent infinite loops
        if (pageCount >= maxPages) {
          // Note: Using console.warn for server-side logging in this API route

          console.warn(`Reached maximum page limit (${maxPages}) for wallet ${walletAddress}`)
          break
        }

        // Small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } while (nextPageUrl)

    return {
      data: allData,
      included: allIncluded,
      links: {
        self: `${apiUrl}?${baseParams.toString()}`,
      },
    }
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
}
