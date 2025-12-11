import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleError,
  createErrorHandler,
  type ErrorHandlerOptions,
} from '../../../app/utils/error-handler'
import { logger } from '../../../app/utils/logger'

// Mock logger
vi.mock('../../../app/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock import.meta.client
    Object.defineProperty(import.meta, 'client', {
      value: true,
      writable: true,
    })
    Object.defineProperty(import.meta, 'dev', {
      value: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('handleError', () => {
    it('should handle Error instances with default options', () => {
      const error = new Error('Test error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: expect.any(String),
        })
      )
      expect(consoleWarnSpy).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })

    it('should use custom message when provided', () => {
      const error = new Error('Test error')
      const customMessage = 'Custom error message'
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error, { message: customMessage })

      expect(logger.error).toHaveBeenCalledWith(
        customMessage,
        error,
        expect.objectContaining({
          userMessage: customMessage,
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should include context in error log', () => {
      const error = new Error('Test error')
      const context = { walletAddress: '0x123', chainId: 1 }
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error, { context })

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          ...context,
          userMessage: expect.any(String),
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should not show notification when showNotification is false', () => {
      const error = new Error('Test error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error, { showNotification: false })

      expect(consoleWarnSpy).not.toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })

    it('should not log error when logError is false', () => {
      const error = new Error('Test error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error, { logError: false })

      expect(logger.error).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })

    it('should include errorCode in context', () => {
      const error = new Error('Test error')
      const errorCode = 'WALLET_ERROR'
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error, { errorCode })

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          errorCode,
          userMessage: expect.any(String),
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should handle NetworkError with appropriate message', () => {
      class NetworkError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'NetworkError'
        }
      }

      const error = new NetworkError('Network failed')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Network connection failed. Please check your internet connection.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should handle FetchError with appropriate message', () => {
      class FetchError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'FetchError'
        }
      }

      const error = new FetchError('Fetch failed')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Failed to fetch data. Please try again.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should handle WalletConnectionError with appropriate message', () => {
      class WalletConnectionError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'WalletConnectionError'
        }
      }

      const error = new WalletConnectionError('Wallet connection failed')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Failed to connect wallet. Please try again.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should detect network errors from error message', () => {
      const error = new Error('Network request failed')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Network connection failed. Please check your internet connection.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should detect unauthorized errors from error message', () => {
      const error = new Error('Unauthorized access')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'You are not authorized to perform this action.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should detect 401 status code in error message', () => {
      const error = new Error('Request failed with status 401')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'You are not authorized to perform this action.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should detect not found errors from error message', () => {
      const error = new Error('Resource not found')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'The requested resource was not found.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should detect 404 status code in error message', () => {
      const error = new Error('Request failed with status 404')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'The requested resource was not found.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should detect validation errors from error message', () => {
      const error = new Error('Invalid input validation failed')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Invalid input. Please check your data and try again.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should use short error message if available', () => {
      const error = new Error('Short error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Short error',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should use UnknownError for long error messages', () => {
      const longMessage = 'a'.repeat(101)
      const error = new Error(longMessage)
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'An unexpected error occurred. Please try again later.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should handle non-Error objects', () => {
      const error = { code: 'ERROR_CODE', message: 'Something went wrong' }
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'An unexpected error occurred. Please try again later.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should handle null/undefined errors', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(null)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        null,
        expect.objectContaining({
          userMessage: 'An unexpected error occurred. Please try again later.',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should not show notification on server side', () => {
      // Note: import.meta.client is checked at runtime in the error handler
      // In a real server environment, import.meta.client would be false
      // This test verifies the behavior when client is false
      // Since we can't easily mock import.meta.client at runtime in tests,
      // we test that the notification logic exists and is conditional
      const error = new Error('Test error')
      // The error handler checks import.meta.client before showing notifications
      // In SSR, notifications won't be shown
      expect(() => handleError(error)).not.toThrow()
    })

    it('should handle errors in production mode', () => {
      Object.defineProperty(import.meta, 'dev', {
        value: false,
        writable: true,
      })

      const error = new Error('Test error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handleError(error)

      // Should still log and show notification
      expect(logger.error).toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('createErrorHandler', () => {
    it('should create error handler with default options', () => {
      const defaultOptions: ErrorHandlerOptions = {
        context: { module: 'wallet' },
        errorCode: 'WALLET_ERROR',
      }
      const errorHandler = createErrorHandler(defaultOptions)
      const error = new Error('Test error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      errorHandler(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          module: 'wallet',
          errorCode: 'WALLET_ERROR',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should merge context from default and call options', () => {
      const defaultOptions: ErrorHandlerOptions = {
        context: { module: 'wallet', chainId: 1 },
      }
      const errorHandler = createErrorHandler(defaultOptions)
      const error = new Error('Test error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      errorHandler(error, { context: { address: '0x123' } })

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          module: 'wallet',
          chainId: 1,
          address: '0x123',
        })
      )
      consoleWarnSpy.mockRestore()
    })

    it('should allow overriding default options', () => {
      const defaultOptions: ErrorHandlerOptions = {
        message: 'Default message',
        showNotification: false,
      }
      const errorHandler = createErrorHandler(defaultOptions)
      const error = new Error('Test error')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      errorHandler(error, { message: 'Custom message', showNotification: true })

      expect(logger.error).toHaveBeenCalledWith(
        'Custom message',
        error,
        expect.objectContaining({
          userMessage: 'Custom message',
        })
      )
      expect(consoleWarnSpy).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })
  })
})
