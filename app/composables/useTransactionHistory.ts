import { computed, ref } from 'vue'

export type AppTxStatus = 'submitted' | 'pending' | 'success' | 'failed'

export type AppTxRecord = {
  hash: string
  chainId: number
  status: AppTxStatus
  timestamp: number
  source: 'app'
  inputSummary?: string
  outputSummary?: string
  feeSummary?: string
  batchCount?: number
  explorerUrl?: string
  batchId?: string
}

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const storageKeyFor = (address: string) => `web3-dashboard:tx-history:${address.toLowerCase()}`

const readStore = (key: string): AppTxRecord[] => {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as AppTxRecord[]) : []
  } catch {
    return []
  }
}

const writeStore = (key: string, records: AppTxRecord[]) => {
  if (!isBrowser()) return
  try {
    localStorage.setItem(key, JSON.stringify(records))
  } catch {
    // ignore quota errors
  }
}

export const isUserRejectedError = (error: unknown): boolean => {
  const code = (error as any)?.code
  const msg = String((error as any)?.message ?? '').toLowerCase()
  return code === 4001 || msg.includes('user rejected') || msg.includes('user denied')
}

export function useTransactionHistory(address?: string | null) {
  const storageKey = address ? storageKeyFor(address) : null
  const records = ref<AppTxRecord[]>(storageKey ? readStore(storageKey) : [])

  const persist = () => {
    if (!storageKey) return
    writeStore(storageKey, records.value)
  }

  const addTransaction = (record: AppTxRecord) => {
    if (record.source !== 'app') return
    const idx = records.value.findIndex(r => r.hash === record.hash && r.chainId === record.chainId)
    if (idx >= 0) {
      records.value[idx] = { ...records.value[idx], ...record }
    } else {
      records.value = [record, ...records.value]
    }
    persist()
  }

  const updateTransaction = (hash: string, chainId: number, patch: Partial<AppTxRecord>) => {
    const idx = records.value.findIndex(r => r.hash === hash && r.chainId === chainId)
    if (idx >= 0) {
      records.value[idx] = { ...records.value[idx], ...patch }
    } else {
      records.value = [
        { hash, chainId, source: 'app', status: 'pending', timestamp: Date.now(), ...patch },
        ...records.value,
      ]
    }
    persist()
  }

  const shouldStoreFailure = (error: unknown) => !isUserRejectedError(error)

  const allTransactions = computed(() => records.value.filter(r => r.source === 'app'))
  const recentTransactions = computed(() => allTransactions.value.slice(0, 5))
  const latestSuccess = computed(
    () => allTransactions.value.find(r => r.status === 'success') ?? null
  )

  return {
    allTransactions,
    recentTransactions,
    latestSuccess,
    addTransaction,
    updateTransaction,
    shouldStoreFailure,
  }
}
