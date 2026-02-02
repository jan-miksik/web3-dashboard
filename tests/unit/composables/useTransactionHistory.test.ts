import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactionHistory } from '~/composables/useTransactionHistory'

describe('useTransactionHistory', () => {
  beforeEach(() => {
    localStorage.clear()
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
})
