import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks to ensure they're available before module imports
const { getQuery, createError, createEvent } = vi.hoisted(() => ({
  getQuery: vi.fn(),
  createError: vi.fn((options: any) => {
    const error = new Error(options.statusMessage || 'Error')
    ;(error as any).statusCode = options.statusCode
    return error
  }),
  createEvent: vi.fn((options: any) => options),
}))

const { useRuntimeConfig } = vi.hoisted(() => ({
  useRuntimeConfig: vi.fn(),
}))

// Mock Nuxt server utilities
vi.mock('h3', () => ({
  getQuery,
  createError,
  createEvent,
}))

// Mock defineEventHandler (Nuxt auto-import) - make it available globally
global.defineEventHandler = vi.fn((handler: any) => handler)

// Make getQuery, createError, and useRuntimeConfig available globally for auto-imports
global.getQuery = getQuery
global.createError = createError
global.useRuntimeConfig = useRuntimeConfig

// Mock Nuxt utilities - also make it available as auto-import
vi.mock('#app', () => ({
  useRuntimeConfig,
}))

vi.mock('../../../../app/utils/chains', () => ({
  CHAIN_ID_TO_ZERION: {
    1: 'ethereum',
    137: 'polygon',
    8453: 'base',
  },
}))

vi.mock('../../../../app/utils/zerion-schema', () => ({
  ZerionApiResponseSchema: {
    safeParse: vi.fn((data: any) => ({
      success: true,
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
    useRuntimeConfig.mockReturnValue({
      zerionApiKey: 'test-api-key',
    } as any)
  })

  it('should return error when wallet address is missing', async () => {
    getQuery.mockReturnValue({})
    useRuntimeConfig.mockReturnValue({
      zerionApiKey: 'test-api-key',
    } as any)

    const event = createEvent({} as any)
    
    // Dynamically import the handler using relative path
    const handler = await import('../../../../server/api/zerion/positions.get')
    
    await expect(handler.default(event)).rejects.toThrow()
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        statusMessage: 'Wallet address is required',
      })
    )
  })

  it('should return error when API key is missing', async () => {
    getQuery.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
    })
    useRuntimeConfig.mockReturnValue({
      zerionApiKey: '',
    } as any)

    const event = createEvent({} as any)
    
    const handler = await import('../../../../server/api/zerion/positions.get')
    
    await expect(handler.default(event)).rejects.toThrow()
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        statusMessage: 'Zerion API key is not configured',
      })
    )
  })

  it('should fetch positions from Zerion API', async () => {
    const { ZerionApiResponseSchema } = await import('../../../../app/utils/zerion-schema')
    
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
            chain: { data: { id: 'ethereum' } },
            fungible: { data: { id: 'eth' } },
          },
        },
      ],
      included: [],
    }

    getQuery.mockReturnValue({
      address: walletAddress,
      chainIds: ['1', '137'],
    })
    useRuntimeConfig.mockReturnValue({
      zerionApiKey: apiKey,
    } as any)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    vi.mocked(ZerionApiResponseSchema.safeParse).mockReturnValue({
      success: true,
      data: mockResponse,
    } as any)

    const event = createEvent({} as any)
    const handler = await import('../../../../server/api/zerion/positions.get')
    
    const result = await handler.default(event)

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
  })

  it('should handle 202 status (portfolio being prepared)', async () => {
    const walletAddress = '0x1234567890123456789012345678901234567890'
    const apiKey = 'test-api-key'

    getQuery.mockReturnValue({
      address: walletAddress,
    })
    useRuntimeConfig.mockReturnValue({
      zerionApiKey: apiKey,
    } as any)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 202,
    } as Response)

    const event = createEvent({} as any)
    const handler = await import('../../../../server/api/zerion/positions.get')
    
    const result = await handler.default(event)

    expect(result.status).toBe(202)
    expect(result.data).toEqual([])
    expect(result.message).toBe('Portfolio is being prepared')
  })

  it('should handle API errors', async () => {
    const walletAddress = '0x1234567890123456789012345678901234567890'
    const apiKey = 'test-api-key'

    getQuery.mockReturnValue({
      address: walletAddress,
    })
    useRuntimeConfig.mockReturnValue({
      zerionApiKey: apiKey,
    } as any)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response)

    const event = createEvent({} as any)
    const handler = await import('../../../../server/api/zerion/positions.get')
    
    await expect(handler.default(event)).rejects.toThrow()
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
      })
    )
  })

  it('should filter by chain IDs when provided', async () => {
    const { ZerionApiResponseSchema } = await import('../../../../app/utils/zerion-schema')
    
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
    useRuntimeConfig.mockReturnValue({
      zerionApiKey: apiKey,
    } as any)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    vi.mocked(ZerionApiResponseSchema.safeParse).mockReturnValue({
      success: true,
      data: mockResponse,
    } as any)

    const event = createEvent({} as any)
    const handler = await import('../../../../server/api/zerion/positions.get')
    
    await handler.default(event)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('filter[chain_ids]'),
      expect.any(Object)
    )
  })
})

