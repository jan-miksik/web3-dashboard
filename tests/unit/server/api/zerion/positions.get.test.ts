import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RuntimeConfig } from 'nuxt/schema'
import type { ZerionPosition } from '../../../../../app/types/zerion.d'

// Type for config that only includes what we need for testing
type MockRuntimeConfig = Pick<RuntimeConfig, 'zerionApiKey'> &
  Partial<Omit<RuntimeConfig, 'zerionApiKey'>>

// Types for mock functions
interface CreateErrorOptions {
  statusCode: number
  statusMessage?: string
}

interface MockH3Error extends Error {
  statusCode: number
}

// Type for H3Event - simplified for testing
interface H3Event {
  node?: {
    req?: unknown
    res?: unknown
  }
  context?: Record<string, unknown>
  [key: string]: unknown
}

// Hoist mocks to ensure they're available before module imports
const { getQuery, createError, createEvent } = vi.hoisted(() => ({
  getQuery: vi.fn<(event: H3Event) => Record<string, unknown>>(),
  createError: vi.fn((options: CreateErrorOptions): MockH3Error => {
    const error = new Error(options.statusMessage || 'Error') as MockH3Error
    error.statusCode = options.statusCode
    return error
  }),
  createEvent: vi.fn((options: Partial<H3Event>): H3Event => options as H3Event),
}))

// Note: We no longer need to mock useRuntimeConfig globally
// because we're using dependency injection in the handler function

// Mock Nuxt server utilities
vi.mock('h3', () => ({
  getQuery,
  createError,
  createEvent,
}))

// Mock defineEventHandler (Nuxt auto-import) - make it available globally
global.defineEventHandler = vi.fn(<T extends (event: H3Event) => unknown>(handler: T): T => handler)

// Make getQuery, createError available globally for auto-imports
global.getQuery = getQuery
global.createError = createError

// Note: We no longer need to mock #app or useRuntimeConfig
// because the handler function accepts getConfig as a parameter (dependency injection)

vi.mock('../../../../../app/utils/chains', () => ({
  CHAIN_ID_TO_ZERION: {
    1: 'ethereum',
    137: 'polygon',
    8453: 'base',
  },
}))

vi.mock('../../../../../app/utils/zerion-schema', () => ({
  ZerionApiResponseSchema: {
    safeParse: vi.fn(<T>(data: T) => ({
      success: true as const,
      data,
    })),
  },
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('server/api/zerion/positions.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocks to default values
    getQuery.mockReturnValue({})
  })

  it('should return error when wallet address is missing', async () => {
    const { handlePositionsRequest } =
      await import('../../../../../server/api/zerion/positions.get')

    getQuery.mockReturnValue({})

    // Use dependency injection
    const getConfig = vi.fn(
      (): MockRuntimeConfig => ({
        zerionApiKey: 'test-api-key',
      })
    )

    const event = createEvent({})

    await expect(handlePositionsRequest(event, getConfig)).rejects.toThrow()
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        statusMessage: 'Wallet address is required',
      })
    )
  })

  it('should return error when API key is missing', async () => {
    const { handlePositionsRequest } =
      await import('../../../../../server/api/zerion/positions.get')

    getQuery.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
    })

    // Use dependency injection with empty API key
    const getConfig = vi.fn(
      (): MockRuntimeConfig => ({
        zerionApiKey: '',
      })
    )

    const event = createEvent({})

    await expect(handlePositionsRequest(event, getConfig)).rejects.toThrow()
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        statusMessage: 'Zerion API key is not configured',
      })
    )
  })

  it('should fetch positions from Zerion API', async () => {
    const { ZerionApiResponseSchema } = await import('../../../../../app/utils/zerion-schema')
    const { handlePositionsRequest } =
      await import('../../../../../server/api/zerion/positions.get')

    const walletAddress = '0x1234567890123456789012345678901234567890'
    const apiKey = 'test-api-key'

    const mockResponse = {
      data: [
        {
          id: 'test-position',
          type: 'positions',
          attributes: {
            quantity: { float: 1.5, int: '1500000000000000000', decimals: 18 },
            price: { float: 2000 },
            value: { float: 3000 },
          },
          relationships: {
            chain: { data: { type: 'chains', id: 'ethereum' } },
            fungible: { data: { type: 'fungibles', id: 'eth' } },
          },
        } as ZerionPosition,
      ],
      included: [],
    }

    // Set up mocks
    getQuery.mockReturnValue({
      address: walletAddress,
      chainIds: ['1', '137'],
    })

    // Use dependency injection - pass a function that returns our mock config
    const getConfig = vi.fn(
      (): MockRuntimeConfig => ({
        zerionApiKey: apiKey,
      })
    )

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    vi.mocked(ZerionApiResponseSchema.safeParse).mockReturnValue({
      success: true as const,
      data: mockResponse,
    })

    const event = createEvent({})

    // Call the handler function directly with dependency injection
    const result = await handlePositionsRequest(event, getConfig)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/wallets/${walletAddress}/positions/`),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic'),
        }),
      })
    )

    expect(result.data).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
    expect(getConfig).toHaveBeenCalled()
  })

  it('should handle 202 status (portfolio being prepared)', async () => {
    const { handlePositionsRequest } =
      await import('../../../../../server/api/zerion/positions.get')

    const walletAddress = '0x1234567890123456789012345678901234567890'
    const apiKey = 'test-api-key'

    getQuery.mockReturnValue({
      address: walletAddress,
    })

    // Use dependency injection
    const getConfig = vi.fn(
      (): MockRuntimeConfig => ({
        zerionApiKey: apiKey,
      })
    )

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 202,
    } as Response)

    const event = createEvent({})

    // Call the handler function directly with dependency injection
    const result = await handlePositionsRequest(event, getConfig)

    expect(result.status).toBe(202)
    expect(result.data).toEqual([])
    expect(result.message).toBe('Portfolio is being prepared')
    expect(getConfig).toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    const { handlePositionsRequest } =
      await import('../../../../../server/api/zerion/positions.get')

    const walletAddress = '0x1234567890123456789012345678901234567890'
    const apiKey = 'test-api-key'

    getQuery.mockReturnValue({
      address: walletAddress,
    })

    // Use dependency injection
    const getConfig = vi.fn(
      (): MockRuntimeConfig => ({
        zerionApiKey: apiKey,
      })
    )

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response)

    const event = createEvent({})

    // Call the handler function directly with dependency injection
    await expect(handlePositionsRequest(event, getConfig)).rejects.toThrow()
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
      })
    )
    expect(getConfig).toHaveBeenCalled()
  })

  it('should filter by chain IDs when provided', async () => {
    const { ZerionApiResponseSchema } = await import('../../../../../app/utils/zerion-schema')
    const { handlePositionsRequest } =
      await import('../../../../../server/api/zerion/positions.get')

    const walletAddress = '0x1234567890123456789012345678901234567890'
    const apiKey = 'test-api-key'

    const mockResponse = {
      data: [],
      included: [],
    }

    getQuery.mockReturnValue({
      address: walletAddress,
      chainIds: ['1', '137', '8453'],
    })

    // Use dependency injection
    const getConfig = vi.fn(
      (): MockRuntimeConfig => ({
        zerionApiKey: apiKey,
      })
    )

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    vi.mocked(ZerionApiResponseSchema.safeParse).mockReturnValue({
      success: true as const,
      data: mockResponse,
    })

    const event = createEvent({})

    // Call the handler function directly with dependency injection
    await handlePositionsRequest(event, getConfig)

    // URL is encoded, so check for the encoded version or the decoded parameter name
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/filter\[chain_ids\]|filter%5Bchain_ids%5D/),
      expect.any(Object)
    )
    expect(getConfig).toHaveBeenCalled()
  })
})
