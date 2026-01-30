import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../../../app/utils/logger'

/**
 * logger.test.ts
 *
 * SECURES: Centralized logging used by error-handler, API, and batch execution.
 * WHY: Logger output is consumed by dev tools and error tracking. Format changes
 * (timestamp, level, context) can break log parsing. Tests ensure structure is stable.
 */
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

  it('warn logs message with ISO timestamp and [WARN] level', () => {
    logger.warn('Warning message')
    const out = consoleWarnSpy.mock.calls[0][0] as string
    expect(out).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
    expect(out).toContain('[WARN]')
    expect(out).toContain('Warning message')
  })

  it('warn includes context when provided', () => {
    logger.warn('Msg', { errorCode: 'ERR' })
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Context:'))
  })

  it('error logs message, Error details, and stack', () => {
    const err = new Error('Test error')
    logger.error('Error message', err)
    const out = consoleErrorSpy.mock.calls[0][0] as string
    expect(out).toContain('[ERROR]')
    expect(out).toContain('Error message')
    expect(out).toContain('Error: Test error')
    expect(out).toContain('Stack:')
  })

  it('error handles message-only and null error', () => {
    logger.error('Msg')
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Msg'))
    logger.error('Msg', null)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
  })

  it('error includes context when provided, omits when empty', () => {
    logger.error('Msg', new Error('E'), { module: 'wallet' })
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"module": "wallet"'))
    consoleErrorSpy.mockClear()
    logger.error('Msg', new Error('E'), {})
    expect(consoleErrorSpy.mock.calls[0][0] as string).not.toContain('Context:')
  })

  it('error handles Error without stack', () => {
    const err = new Error('E')
    delete (err as { stack?: string }).stack
    logger.error('Msg', err)
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: E'))
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Stack:'))
  })

  it('debug and info methods exist and accept (message, context)', () => {
    expect(() => logger.debug('d', { x: 1 })).not.toThrow()
    expect(() => logger.info('i', { x: 1 })).not.toThrow()
  })
})
