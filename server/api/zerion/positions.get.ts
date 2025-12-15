import type { ZerionApiResponse, ZerionPosition, ZerionIncludedItem } from '~/types/zerion'
import { CHAIN_ID_TO_ZERION } from '~/utils/chains'
import { ZerionApiResponseSchema } from '~/utils/zerion-schema'
import { logger } from '~/utils/logger'

import type { H3Event } from 'h3'
import { isAddress } from 'viem'

const ZERION_API_BASE = 'https://api.zerion.io/v1'

// HTTP Basic Auth: base64(apiKey:)
function getAuthHeader(apiKey: string): string {
  const credentials = Buffer.from(`${apiKey}:`).toString('base64')
  return `Basic ${credentials}`
}

function isValidZerionApiKey(apiKey: unknown): apiKey is string {
  if (typeof apiKey !== 'string') return false

  const trimmed = apiKey.trim()
  // Basic hardening: non-empty, reasonable length, and restricted charset
  if (trimmed.length < 20 || trimmed.length > 256) return false

  // Hyphen doesn't need escaping when placed at the end of the character class
  return /^[A-Za-z0-9_-]+$/.test(trimmed)
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
  const walletAddressRaw = (query.address as string | undefined)?.trim()

  if (!walletAddressRaw) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Wallet address is required',
    })
  }

  // Basic wallet address validation & normalization
  const walletAddress = walletAddressRaw.toLowerCase()

  if (!isAddress(walletAddress)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid wallet address',
    })
  }

  const config = getConfig()
  const apiKeyRaw = config.zerionApiKey

  if (!isValidZerionApiKey(apiKeyRaw)) {
    logger.error('Invalid Zerion API key configuration detected', undefined, {
      apiKeyConfigured: Boolean(apiKeyRaw),
    })

    throw createError({
      statusCode: 500,
      statusMessage: 'Zerion API key is misconfigured',
    })
  }

  const apiKey = apiKeyRaw.trim()

  const chainIds: string[] = query.chainIds
    ? (Array.isArray(query.chainIds) ? query.chainIds : [query.chainIds]).map(String)
    : Object.keys(CHAIN_ID_TO_ZERION).map(String)

  // Sanitize and validate requested chain IDs
  const zerionChainIds = chainIds
    .map(id => id.trim())
    .filter(id => id !== '')
    .map(id => CHAIN_ID_TO_ZERION[Number(id)])
    .filter(Boolean) as string[]

  if (query.chainIds && zerionChainIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No valid chain IDs provided',
    })
  }

  logger.info('Fetching Zerion wallet positions', {
    walletAddress,
    hasCustomChainFilter: Boolean(query.chainIds),
    chainCount: zerionChainIds.length,
  })

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
    const controller = new AbortController()
    const timeoutMs = 15000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: getAuthHeader(apiKey),
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Zerion API request aborted due to timeout', {
          url,
          timeoutMs,
          walletAddress,
        })
        throw createError({
          statusCode: 504,
          statusMessage: 'Upstream Zerion API request timed out',
        })
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }

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

      logger.error('Zerion API returned non-OK response', undefined, {
        status: response.status,
        url,
        walletAddress,
        bodySnippet: errorText.slice(0, 500),
      })

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
          logger.warn('Reached maximum Zerion page limit when fetching positions', {
            walletAddress,
            maxPages,
          })
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
