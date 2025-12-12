/**
 * Centralized logging utility
 *
 * Provides consistent logging across the application with:
 * - Log levels (debug, info, warn, error)
 * - Environment-aware logging (debug/info in dev only, warn/error in all environments)
 * - Structured logging with context
 * - Automatic formatting
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, error?: Error | unknown, context?: LogContext) => void
}

class LoggerImpl implements Logger {
  private isProduction = !import.meta.dev

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error | unknown
  ): string {
    const timestamp = new Date().toISOString()
    const parts = [`[${timestamp}]`, `[${level.toUpperCase()}]`, message]

    if (context && Object.keys(context).length > 0) {
      parts.push(`\nContext: ${JSON.stringify(context, null, 2)}`)
    }

    if (error) {
      if (error instanceof Error) {
        parts.push(`\nError: ${error.message}`)
        if (error.stack) {
          parts.push(`\nStack: ${error.stack}`)
        }
      } else {
        parts.push(`\nError: ${JSON.stringify(error, null, 2)}`)
      }
    }

    return parts.join(' ')
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log warnings and errors
    if (this.isProduction) {
      return level === 'warn' || level === 'error'
    }
    // In development, log everything
    return true
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return

    const formatted = this.formatMessage('debug', message, context)

    console.debug(formatted)
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return

    const formatted = this.formatMessage('info', message, context)

    console.info(formatted)
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return

    const formatted = this.formatMessage('warn', message, context)

    console.warn(formatted)
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return

    const formatted = this.formatMessage('error', message, context, error)

    console.error(formatted)

    // In production, you might want to send errors to an error tracking service
    // Example: Sentry, LogRocket, etc.
    if (this.isProduction && error) {
      // TODO: Integrate with error tracking service
      // trackError(error, { message, context })
    }
  }
}

// Export singleton instance
export const logger = new LoggerImpl()
