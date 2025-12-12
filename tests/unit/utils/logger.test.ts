import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The logger checks import.meta.dev at module initialization
// Since it's already loaded, we'll test its actual behavior
import { logger } from '../../../app/utils/logger'

describe('logger', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('debug', () => {
    it('should have debug method that can be called', () => {
      // Debug may or may not log depending on import.meta.dev at module load
      // Test that the method exists and can be called without errors
      expect(() => logger.debug('Debug message')).not.toThrow()
      expect(typeof logger.debug).toBe('function')
    })

    it('should handle context in debug messages', () => {
      const context = { walletAddress: '0x123', chainId: 1 }
      // Method should be callable with context
      expect(() => logger.debug('Debug message', context)).not.toThrow()
    })

    // Removed redundant test - method existence is already tested above
  })

  describe('info', () => {
    it('should handle context in info messages', () => {
      const context = { action: 'connect', wallet: 'MetaMask' }
      // Method should be callable with context
      expect(() => logger.info('Info message', context)).not.toThrow()
    })

    // Removed placeholder test - this behavior should be tested in integration tests
  })

  describe('warn', () => {
    it('should log warn messages in production mode', () => {
      // Warn messages should log in both dev and production
      logger.warn('Warning message')

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'))
    })

    it('should include context in warn messages', () => {
      const context = { errorCode: 'WALLET_ERROR' }
      logger.warn('Warning message', context)

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'))
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Context:'))
    })
  })

  describe('error', () => {
    it('should log error messages with Error instance', () => {
      const error = new Error('Test error')
      logger.error('Error message', error)

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Stack:'))
    })

    it('should log error messages without Error instance', () => {
      logger.error('Error message')

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'))
    })

    it('should log error messages with non-Error objects', () => {
      const errorObj = { code: 'ERROR_CODE', message: 'Something went wrong' }
      logger.error('Error message', errorObj)

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'))
    })

    it('should include context in error messages', () => {
      const error = new Error('Test error')
      const context = { module: 'wallet', action: 'connect' }

      logger.error('Error message', error, context)

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Context:'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"module": "wallet"'))
    })

    it('should handle errors without stack trace', () => {
      const error = new Error('Test error')
      delete (error as { stack?: string }).stack

      logger.error('Error message', error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'))
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Stack:'))
    })

    it('should format error with all components', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.js:1:1'
      const context = { key: 'value' }

      logger.error('Error message', error, context)

      const callArgs = consoleErrorSpy.mock.calls[0][0] as string
      expect(callArgs).toContain('[ERROR]')
      expect(callArgs).toContain('Error message')
      expect(callArgs).toContain('Context:')
      expect(callArgs).toContain('Error: Test error')
      expect(callArgs).toContain('Stack:')
    })

    it('should handle empty context object', () => {
      const error = new Error('Test error')
      logger.error('Error message', error, {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'))
      // Should not include "Context:" when context is empty
      const callArgs = consoleErrorSpy.mock.calls[0][0] as string
      expect(callArgs).not.toContain('Context:')
    })

    it('should handle null/undefined error', () => {
      logger.error('Error message', null)

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'))
    })
  })

  describe('formatting', () => {
    it('should format warn messages with ISO timestamp', () => {
      logger.warn('Test message')

      const callArgs = consoleWarnSpy.mock.calls[0][0] as string
      expect(callArgs).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
    })

    it('should format messages with uppercase log level', () => {
      logger.warn('Test')
      logger.error('Test')

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'))
    })
  })
})
