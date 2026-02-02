# Transaction Success Overview + History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a transaction success overview + local-only history list under Transaction Preview, storing app-initiated txs (excluding user-rejected) across all chains.

**Architecture:** A new `useTransactionHistory()` composable stores tx records in localStorage per wallet address. Composer execution writes submitted/success/failed entries and the new recap component reads + displays a compact summary and recent history list.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Vitest, @vue/test-utils, wagmi/viem, LI.FI SDK.

---

### Task 1: Add transaction history composable (tests first)

**Files:**

- Create: `app/composables/useTransactionHistory.ts`
- Test: `tests/unit/composables/useTransactionHistory.test.ts`

**Step 1: Write the failing test**
Create `tests/unit/composables/useTransactionHistory.test.ts` with tests:

```ts
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
```

**Step 2: Run test to verify it fails**
Run: `pnpm test tests/unit/composables/useTransactionHistory.test.ts`  
Expected: FAIL (module not found / functions undefined)

**Step 3: Write minimal implementation**
Create `app/composables/useTransactionHistory.ts`:

```ts
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
```

**Step 4: Run test to verify it passes**
Run: `pnpm test tests/unit/composables/useTransactionHistory.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add app/composables/useTransactionHistory.ts tests/unit/composables/useTransactionHistory.test.ts
git commit -m "feat: add local transaction history composable"
```

---

### Task 2: Wire history into composer execution (tests first where possible)

**Files:**

- Modify: `app/composables/useBatchComposer.ts`
- Modify: `app/composables/useTxComposer.ts`
- (Optional) Test: `tests/unit/composables/useBatchComposer.test.ts` (add if exists)

**Step 1: Write failing test (if feasible)**
If no existing tests, skip and proceed to implementation per scope. Otherwise add a test to
validate history update when executeComposer returns success.

**Step 2: Run test to verify it fails**
Run: `pnpm test tests/unit/composables/useBatchComposer.test.ts`

**Step 3: Write minimal implementation**

- In `useBatchComposer.ts`:
  - Accept injected helpers from `useTransactionHistory` (via new composable call inside).
  - After `executeBatch` returns, add/update history entry with:
    - hash (if `txHash`)
    - status `success`
    - batchCount
    - chainId
    - output/input summary strings (passed via `executeComposer` args)
  - On error:
    - if user rejected, do not store.
    - otherwise store `failed`.
- In `useTxComposer.ts` `executeRoute`:
  - Track hash from LiFi `updateRouteHook` if present
  - Return `{ hash?: string }` from `executeRoute`

**Step 4: Run tests**
Run relevant unit tests; at minimum re-run the composable tests from Task 1 to ensure no regressions.

**Step 5: Commit**

```bash
git add app/composables/useBatchComposer.ts app/composables/useTxComposer.ts
git commit -m "feat: record composer transactions in history"
```

---

### Task 3: Add recap component (tests first)

**Files:**

- Create: `app/components/tx-composer/ComposerWidget/ComposerTransactionRecap.vue`
- Test: `tests/unit/components/ComposerTransactionRecap.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ComposerTransactionRecap from '~/components/tx-composer/ComposerWidget/ComposerTransactionRecap.vue'

describe('ComposerTransactionRecap', () => {
  it('renders success overview and 5 items by default', () => {
    const wrapper = mount(ComposerTransactionRecap, {
      props: {
        latestSuccess: {
          hash: '0x1',
          chainId: 1,
          status: 'success',
          timestamp: Date.now(),
          source: 'app',
          outputSummary: '120 OP',
        },
        transactions: Array.from({ length: 7 }, (_, i) => ({
          hash: `0x${i}`,
          chainId: 1,
          status: 'success',
          timestamp: Date.now() - i * 1000,
          source: 'app',
          outputSummary: '1 ETH',
        })),
      },
    })
    expect(wrapper.text()).toContain('Success')
    expect(wrapper.findAll('[data-test="tx-row"]')).toHaveLength(5)
  })

  it('expands on show more', async () => {
    const wrapper = mount(ComposerTransactionRecap, {
      props: {
        latestSuccess: null,
        transactions: Array.from({ length: 7 }, (_, i) => ({
          hash: `0x${i}`,
          chainId: 1,
          status: 'success',
          timestamp: Date.now() - i * 1000,
          source: 'app',
        })),
      },
    })
    await wrapper.get('[data-test="show-more"]').trigger('click')
    expect(wrapper.findAll('[data-test="tx-row"]')).toHaveLength(7)
  })
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm test tests/unit/components/ComposerTransactionRecap.test.ts`  
Expected: FAIL (component missing)

**Step 3: Write minimal implementation**
Create `ComposerTransactionRecap.vue`:

- Props: `latestSuccess`, `transactions`
- Local `showAll` state
- Render:
  - Header “Transaction Recap”
  - Success row with status pill, timestamp, chain, output summary, explorer link
  - Secondary grid: input/output/fees/batch/hash
  - Recent list with 5 items and “Show more” button
- BEM classes and `<style scoped>`

**Step 4: Run test to verify it passes**
Run: `pnpm test tests/unit/components/ComposerTransactionRecap.test.ts`

**Step 5: Commit**

```bash
git add app/components/tx-composer/ComposerWidget/ComposerTransactionRecap.vue tests/unit/components/ComposerTransactionRecap.test.ts
git commit -m "feat: add composer transaction recap component"
```

---

### Task 4: Integrate recap into ComposerWidget

**Files:**

- Modify: `app/components/tx-composer/ComposerWidget/index.vue`

**Step 1: Write failing test (optional)**
If no component integration tests exist, skip.

**Step 2: Implement**

- Import `useTransactionHistory` and connect it to `address`.
- Pass `latestSuccess` + `allTransactions` to `ComposerTransactionRecap`.
- Render the new component under `<ComposerPreview />` and above the execute button.
- Only show if `latestSuccess` exists or history length > 0.

**Step 3: Run tests**
Run unit tests for recap and history composable.

**Step 4: Commit**

```bash
git add app/components/tx-composer/ComposerWidget/index.vue
git commit -m "feat: show transaction recap under preview"
```

---

### Task 5: Final verification

**Step 1: Run all unit tests**
Run: `pnpm test:run`

**Step 2: Fix any regressions**

**Step 3: Final commit if needed**
