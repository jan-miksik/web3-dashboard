import { computed, reactive, ref, type MaybeRef } from 'vue'
import { logger } from '~/utils/logger'

export type AppTxStatus = 'submitted' | 'pending' | 'success' | 'failed'

/** Per-token leg of a swap (one source token → output) */
export type TxHistorySwapLeg = {
  chainId: number
  fromToken: {
    address: string
    symbol: string
    name?: string
    logoURI?: string
    decimals: number
  }
  fromAmount: string // raw amount (wei/smallest unit)
  fromAmountUsd?: number // USD value at execution
  toAmount?: string // raw output (may be on different chain)
  toAmountUsd?: number
  providers: string[] // e.g. ["Uniswap", "Stargate"]
  routeType?: string // "lifi" | "swap" | "bridge"
}

export type AppTxRecord = {
  hash: string
  chainId: number
  status: AppTxStatus
  timestamp: number
  source: 'app'
  // Top-level summary (always present)
  totalSellUsd?: number // sum of all fromAmountUsd
  totalReceiveUsd?: number // sum of all toAmountUsd
  totalReceiveAmount?: string // raw amount in output token
  outputTokenSymbol?: string
  feeSummary?: string
  explorerUrl?: string
  batchId?: string
  batchCount?: number
  // Legacy short summaries (keep for backward compat)
  inputSummary?: string
  outputSummary?: string
  // NEW: expandable detail
  details?: {
    legs: TxHistorySwapLeg[]
    outputToken: {
      chainId: number
      address: string
      symbol: string
      logoURI?: string
      decimals?: number
    }
  }
}

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const storageKeyFor = (address: string) => `web3-dashboard:tx-history:${address.toLowerCase()}`

/** Shared reactive store - all useTransactionHistory instances read from here so UI updates when any instance adds a tx */
const sharedStore = reactive<Record<string, AppTxRecord[]>>({})

export const clearTransactionHistoryCache = () => {
  for (const key of Object.keys(sharedStore)) delete sharedStore[key]
}

const loadFromStorage = (key: string): AppTxRecord[] => {
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

const persistToStorage = (key: string, records: AppTxRecord[]) => {
  if (!isBrowser()) return
  try {
    localStorage.setItem(key, JSON.stringify(records))
  } catch (error) {
    logger.error('Failed to write transaction history to localStorage', error, { key })
  }
}

const getRecords = (key: string): AppTxRecord[] => {
  if (!(key in sharedStore)) {
    sharedStore[key] = loadFromStorage(key)
  }
  return sharedStore[key]!
}

export const isUserRejectedError = (error: unknown): boolean => {
  const code = (error as any)?.code
  const msg = String((error as any)?.message ?? '').toLowerCase()
  return code === 4001 || msg.includes('user rejected') || msg.includes('user denied')
}

export function useTransactionHistory(address?: MaybeRef<string | null | undefined>) {
  // Normalize address to ensure reactivity - if it's already a ref/computed, use it directly
  // Otherwise wrap it in a ref
  const addressSource =
    address && typeof address === 'object' && 'value' in address ? address : ref(address)

  const currentAddress = computed(() => {
    const val = addressSource.value
    return val ?? null
  })
  const storageKey = computed(() => {
    const addr = currentAddress.value
    return addr ? storageKeyFor(addr) : null
  })

  /** Reads from shared reactive store - UI updates when any instance adds/updates a tx */
  const records = computed(() => {
    const key = storageKey.value
    if (!key) return []
    return getRecords(key)
  })

  const persist = (key: string, records: AppTxRecord[]) => {
    persistToStorage(key, records)
  }

  const addTransaction = (record: AppTxRecord) => {
    if (record.source !== 'app') return
    if (!record.hash || record.chainId === undefined || record.chainId === null || !record.status) {
      logger.warn('addTransaction called with invalid record', { record })
      return
    }
    const key = storageKey.value
    if (!key) return
    const arr = getRecords(key)
    const idx = arr.findIndex(r => r.hash === record.hash && r.chainId === record.chainId)
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...record }
    } else {
      arr.unshift(record)
    }
    persist(key, arr)
  }

  const updateTransaction = (hash: string, chainId: number, patch: Partial<AppTxRecord>) => {
    const key = storageKey.value
    if (!key) return
    const arr = getRecords(key)
    const idx = arr.findIndex(r => r.hash === hash && r.chainId === chainId)
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...patch } as AppTxRecord
    } else {
      arr.unshift({
        hash,
        chainId,
        source: 'app',
        status: 'pending',
        timestamp: Date.now(),
        ...patch,
      })
    }
    persist(key, arr)
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
