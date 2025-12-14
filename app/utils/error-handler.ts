/**
 * Centralized error handling utility
 *
 * Provides consistent error handling across the application with:
 * - User-friendly error messages
 * - Automatic error notifications
 * - Error logging
 * - Error context tracking
 */

import { logger } from './logger'
import { showNotification as showNotif } from '~/composables/useNotifications'

export interface ErrorHandlerOptions {
  /**
   * User-friendly message to display to the user
   */
  message?: string
  /**
   * Additional context about the error
   */
  context?: Record<string, unknown>
  /**
   * Whether to show a notification to the user (default: true)
   */
  showNotification?: boolean
  /**
   * Whether to log the error (default: true)
   */
  logError?: boolean
  /**
   * Custom error code for tracking
   */
  errorCode?: string
  /**
   * Whether code is running on client side (default: import.meta.client)
   * Can be set to false to test SSR behavior
   */
  isClient?: boolean
}

/**
 * Maps error types to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  NetworkError: 'Network connection failed. Please check your internet connection.',
  FetchError: 'Failed to fetch data. Please try again.',
  TimeoutError: 'Request timed out. Please try again.',

  // API errors
  APIError: 'An error occurred while processing your request.',
  UnauthorizedError: 'You are not authorized to perform this action.',
  NotFoundError: 'The requested resource was not found.',
  ValidationError: 'Invalid input. Please check your data and try again.',

  // Wallet errors
  WalletConnectionError: 'Failed to connect wallet. Please try again.',
  TransactionError: 'Transaction failed. Please try again.',
  InsufficientFundsError: 'Insufficient funds to complete this transaction.',

  // Generic
  UnknownError: 'An unexpected error occurred. Please try again later.',
}

/**
 * Gets a user-friendly error message from an error
 */
function getUserFriendlyMessage(error: unknown, customMessage?: string): string {
  if (customMessage) {
    return customMessage
  }

  if (error instanceof Error) {
    // Check for specific error types
    const errorName = error.constructor.name
    const errorMessageFromType = ERROR_MESSAGES[errorName]
    if (errorMessageFromType) {
      return errorMessageFromType
    }

    // Check error message for common patterns
    const errorMessage = error.message?.toLowerCase() || ''
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return ERROR_MESSAGES.NetworkError!
    }
    if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      return ERROR_MESSAGES.UnauthorizedError!
    }
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return ERROR_MESSAGES.NotFoundError!
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return ERROR_MESSAGES.ValidationError!
    }

    // Return the error message if it's user-friendly
    if (error.message && error.message.length < 100) {
      return error.message
    }
  }

  return ERROR_MESSAGES.UnknownError!
}

/**
 * Shows a notification to the user
 * Uses the centralized notification system
 */
function showNotification(
  message: string,
  type: 'error' | 'warning' | 'info' = 'error',
  isClient: boolean = import.meta.client
): void {
  if (!isClient) {
    return
  }

  try {
    switch (type) {
      case 'error':
        showNotif(message, 'error', 7000) // Show errors for 7 seconds
        break
      case 'warning':
        showNotif(message, 'warning', 6000) // Show warnings for 6 seconds
        break
      case 'info':
        showNotif(message, 'info', 5000) // Show info for 5 seconds
        break
      default:
        showNotif(message, 'error', 7000)
    }
  } catch (error) {
    // Fallback to console if notification system is not available
    // This should not happen in normal operation, but provides a safety net
    if (import.meta.dev) {
      console.warn(`[Notification ${type}]: ${message}`, error)
    }
  }
}

/**
 * Centralized error handler
 *
 * @param error - The error to handle
 * @param options - Error handling options
 *
 * @example
 * ```typescript
 * try {
 *   await fetchData()
 * } catch (error) {
 *   handleError(error, {
 *     message: 'Failed to load wallet data',
 *     context: { walletAddress },
 *     showNotification: true,
 *   })
 * }
 * ```
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}): void {
  const {
    message: customMessage,
    context = {},
    showNotification: shouldShowNotification = true,
    logError: shouldLogError = true,
    errorCode,
    isClient = import.meta.client,
  } = options

  const userMessage = getUserFriendlyMessage(error, customMessage)

  if (shouldLogError) {
    logger.error(customMessage || 'An error occurred', error, {
      ...context,
      errorCode,
      userMessage,
    })
  }

  if (shouldShowNotification && isClient) {
    showNotification(userMessage, 'error', isClient)
  }

  // In production, you might want to send errors to an error tracking service
  // Example: Sentry, LogRocket, etc.
  if (!import.meta.dev && error) {
    // TODO: Integrate with error tracking service
    // trackError(error, { message: customMessage, context, errorCode })
  }
}

/**
 * Creates an error handler with default options
 * Useful for creating domain-specific error handlers
 *
 * @example
 * ```typescript
 * const walletErrorHandler = createErrorHandler({
 *   context: { module: 'wallet' },
 *   errorCode: 'WALLET_ERROR',
 * })
 *
 * try {
 *   await connectWallet()
 * } catch (error) {
 *   walletErrorHandler(error, { message: 'Failed to connect wallet' })
 * }
 * ```
 */
export function createErrorHandler(defaultOptions: ErrorHandlerOptions) {
  return (error: unknown, options: ErrorHandlerOptions = {}) => {
    handleError(error, {
      ...defaultOptions,
      ...options,
      context: {
        ...defaultOptions.context,
        ...options.context,
      },
    })
  }
}
