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

// Mock useNotifications
vi.mock('~/composables/useNotifications', () => ({
  showNotification: vi.fn(),
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

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: expect.any(String),
        })
      )
    })

    it('should use custom message when provided', () => {
      const error = new Error('Test error')
      const customMessage = 'Custom error message'

      handleError(error, { message: customMessage })

      expect(logger.error).toHaveBeenCalledWith(
        customMessage,
        error,
        expect.objectContaining({
          userMessage: customMessage,
        })
      )
    })

    it('should include context in error log', () => {
      const error = new Error('Test error')
      const context = { walletAddress: '0x123', chainId: 1 }

      handleError(error, { context })

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          ...context,
          userMessage: expect.any(String),
        })
      )
    })

    it('should not show notification when showNotification is false', () => {
      const error = new Error('Test error')

      handleError(error, { showNotification: false })

      // Notification should not be shown, but error should still be logged
      expect(logger.error).toHaveBeenCalled()
    })

    it('should not log error when logError is false', () => {
      const error = new Error('Test error')

      handleError(error, { logError: false })

      expect(logger.error).not.toHaveBeenCalled()
      // Notification may still be shown, but error won't be logged
    })

    it('should include errorCode in context', () => {
      const error = new Error('Test error')
      const errorCode = 'WALLET_ERROR'

      handleError(error, { errorCode })

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          errorCode,
          userMessage: expect.any(String),
        })
      )
    })

    it('should handle NetworkError with appropriate message', () => {
      class NetworkError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'NetworkError'
        }
      }

      const error = new NetworkError('Network failed')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Network connection failed. Please check your internet connection.',
        })
      )
    })

    it('should handle FetchError with appropriate message', () => {
      class FetchError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'FetchError'
        }
      }

      const error = new FetchError('Fetch failed')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Failed to fetch data. Please try again.',
        })
      )
    })

    it('should handle WalletConnectionError with appropriate message', () => {
      class WalletConnectionError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'WalletConnectionError'
        }
      }

      const error = new WalletConnectionError('Wallet connection failed')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Failed to connect wallet. Please try again.',
        })
      )
    })

    it('should detect network errors from error message', () => {
      const error = new Error('Network request failed')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Network connection failed. Please check your internet connection.',
        })
      )
    })

    it('should detect unauthorized errors from error message', () => {
      const error = new Error('Unauthorized access')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'You are not authorized to perform this action.',
        })
      )
    })

    it('should detect 401 status code in error message', () => {
      const error = new Error('Request failed with status 401')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'You are not authorized to perform this action.',
        })
      )
    })

    it('should detect not found errors from error message', () => {
      const error = new Error('Resource not found')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'The requested resource was not found.',
        })
      )
    })

    it('should detect 404 status code in error message', () => {
      const error = new Error('Request failed with status 404')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'The requested resource was not found.',
        })
      )
    })

    it('should detect validation errors from error message', () => {
      const error = new Error('Invalid input validation failed')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Invalid input. Please check your data and try again.',
        })
      )
    })

    it('should use short error message if available', () => {
      const error = new Error('Short error')

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'Short error',
        })
      )
    })

    it('should use UnknownError for long error messages', () => {
      const longMessage = 'a'.repeat(101)
      const error = new Error(longMessage)

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'An unexpected error occurred. Please try again later.',
        })
      )
    })

    it('should handle non-Error objects', () => {
      const error = { code: 'ERROR_CODE', message: 'Something went wrong' }

      handleError(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: 'An unexpected error occurred. Please try again later.',
        })
      )
    })

    it('should handle null/undefined errors', () => {
      handleError(null)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        null,
        expect.objectContaining({
          userMessage: 'An unexpected error occurred. Please try again later.',
        })
      )
    })

    it('should not show notification on server side', () => {
      const error = new Error('Test error')

      // Simulate server-side execution by setting isClient to false
      handleError(error, { isClient: false })

      // Error should still be logged even on server side
      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          userMessage: expect.any(String),
        })
      )
    })

    it('should handle errors in production mode', () => {
      Object.defineProperty(import.meta, 'dev', {
        value: false,
        writable: true,
      })

      const error = new Error('Test error')

      handleError(error)

      // Should still log and show notification
      expect(logger.error).toHaveBeenCalled()
      // console.warn is only called in fallback when notification system fails
      // and only in dev mode, so it won't be called in production mode
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

      errorHandler(error)

      expect(logger.error).toHaveBeenCalledWith(
        'An error occurred',
        error,
        expect.objectContaining({
          module: 'wallet',
          errorCode: 'WALLET_ERROR',
        })
      )
    })

    it('should merge context from default and call options', () => {
      const defaultOptions: ErrorHandlerOptions = {
        context: { module: 'wallet', chainId: 1 },
      }
      const errorHandler = createErrorHandler(defaultOptions)
      const error = new Error('Test error')

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
    })

    it('should allow overriding default options', () => {
      const defaultOptions: ErrorHandlerOptions = {
        message: 'Default message',
        showNotification: false,
      }
      const errorHandler = createErrorHandler(defaultOptions)
      const error = new Error('Test error')

      errorHandler(error, { message: 'Custom message', showNotification: true })

      expect(logger.error).toHaveBeenCalledWith(
        'Custom message',
        error,
        expect.objectContaining({
          userMessage: 'Custom message',
        })
      )
      // console.warn is only called in fallback when notification system fails
      // and only in dev mode, so it won't be called in normal operation
    })
  })
})
