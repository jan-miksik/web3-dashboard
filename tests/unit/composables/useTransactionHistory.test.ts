import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

import { useTransactionHistory } from '~/composables/useTransactionHistory'
import { logger } from '~/utils/logger'

// Mock logger - hoisted to ensure it's set up before module imports
const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('~/utils/logger', () => ({
  logger: mockLogger,
}))

describe('useTransactionHistory', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores and reads history per address', () => {
    const { addTransaction, allTransactions } = useTransactionHistory('0xabc')
    addTransaction({
      hash: '0x1',
      chainId: 1,
      status: 'submitted',
      timestamp: 1,
      source: 'app',
    })
    expect(allTransactions.value).toHaveLength(1)

    const { allTransactions: other } = useTransactionHistory('0xdef')
    expect(other.value).toHaveLength(0)
  })

  it('updates existing record by chainId + hash', () => {
    const { addTransaction, updateTransaction, allTransactions } = useTransactionHistory('0xabc')
    addTransaction({
      hash: '0x1',
      chainId: 10,
      status: 'submitted',
      timestamp: 1,
      source: 'app',
    })
    updateTransaction('0x1', 10, { status: 'success' })
    expect(allTransactions.value[0]?.status).toBe('success')
  })

  it('filters recentTransactions to 5 items', () => {
    const { addTransaction, recentTransactions } = useTransactionHistory('0xabc')
    for (let i = 0; i < 7; i++) {
      addTransaction({
        hash: `0x${i}`,
        chainId: 1,
        status: 'submitted',
        timestamp: i,
        source: 'app',
      })
    }
    expect(recentTransactions.value).toHaveLength(5)
  })

  it('ignores user-rejected failures', () => {
    const { addTransaction, allTransactions, shouldStoreFailure } = useTransactionHistory('0xabc')
    const err = Object.assign(new Error('User rejected the request'), { code: 4001 })
    expect(shouldStoreFailure(err)).toBe(false)
    addTransaction({
      hash: '0x1',
      chainId: 1,
      status: 'failed',
      timestamp: 1,
      source: 'app',
    })
    expect(allTransactions.value).toHaveLength(1)
  })

  it('shouldStoreFailure returns true for non-user-rejected errors', () => {
    const { shouldStoreFailure } = useTransactionHistory('0xabc')
    const networkError = new Error('Network error')
    const unknownError = { message: 'Something went wrong' }
    expect(shouldStoreFailure(networkError)).toBe(true)
    expect(shouldStoreFailure(unknownError)).toBe(true)
  })

  it('latestSuccess returns most recent success', () => {
    const { addTransaction, latestSuccess } = useTransactionHistory('0xabc')
    addTransaction({
      hash: '0x1',
      chainId: 1,
      status: 'success',
      timestamp: 100,
      source: 'app',
    })
    addTransaction({
      hash: '0x2',
      chainId: 1,
      status: 'failed',
      timestamp: 200,
      source: 'app',
    })
    addTransaction({
      hash: '0x3',
      chainId: 1,
      status: 'success',
      timestamp: 300,
      source: 'app',
    })
    expect(latestSuccess.value?.hash).toBe('0x3')
  })

  it('handles malformed localStorage data gracefully', () => {
    localStorage.setItem('web3-dashboard:tx-history:0xabc', 'not valid json')
    const { allTransactions } = useTransactionHistory('0xabc')
    expect(allTransactions.value).toHaveLength(0)
  })

  it('handles non-array localStorage data gracefully', () => {
    localStorage.setItem('web3-dashboard:tx-history:0xabc', '{"not": "an array"}')
    const { allTransactions } = useTransactionHistory('0xabc')
    expect(allTransactions.value).toHaveLength(0)
  })

  it('logs error when localStorage write fails', () => {
    const { addTransaction } = useTransactionHistory('0xabc')
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    addTransaction({
      hash: '0x1',
      chainId: 1,
      status: 'submitted',
      timestamp: 1,
      source: 'app',
    })
    expect(setItemSpy).toHaveBeenCalled()
    expect(mockLogger.error).toHaveBeenCalled()
    setItemSpy.mockRestore()
  })

  it('validates addTransaction and warns on missing hash', () => {
    const { addTransaction, allTransactions } = useTransactionHistory('0xabc')
    addTransaction({
      hash: '',
      chainId: 1,
      status: 'submitted',
      timestamp: 1,
      source: 'app',
    } as any)
    expect(allTransactions.value).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('validates addTransaction and warns on missing chainId', () => {
    const { addTransaction, allTransactions } = useTransactionHistory('0xabc')
    addTransaction({
      hash: '0x1',
      chainId: undefined as any,
      status: 'submitted',
      timestamp: 1,
      source: 'app',
    })
    expect(allTransactions.value).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('validates addTransaction and warns on missing status', () => {
    const { addTransaction, allTransactions } = useTransactionHistory('0xabc')
    addTransaction({
      hash: '0x1',
      chainId: 1,
      status: undefined as any,
      timestamp: 1,
      source: 'app',
    })
    expect(allTransactions.value).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('updateTransaction creates record when missing', () => {
    const { updateTransaction, allTransactions } = useTransactionHistory('0xabc')
    updateTransaction('0x1', 10, { status: 'success' })
    expect(allTransactions.value).toHaveLength(1)
    expect(allTransactions.value[0]?.hash).toBe('0x1')
    expect(allTransactions.value[0]?.chainId).toBe(10)
    expect(allTransactions.value[0]?.status).toBe('success')
  })
})
