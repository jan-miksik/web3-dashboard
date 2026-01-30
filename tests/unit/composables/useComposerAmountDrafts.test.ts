import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useComposerAmountDrafts } from '../../../app/composables/useComposerAmountDrafts'
import type { ComposerToken } from '../../../app/composables/useTxComposer'

/**
 * useComposerAmountDrafts.test.ts
 *
 * SECURES: Amount input/parsing for multi-token swaps.
 * WHY: Incorrect amount parsing can cause over-spending, failed txs, or dust left behind.
 * BigInt/decimals handling is error-prone; tests guard against overflow and rounding bugs.
 */
const makeToken = (overrides: Partial<ComposerToken> = {}): ComposerToken =>
  ({
    chainId: 1,
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    balance: '1000000000000000000', // 1 ETH
    usdValue: 2000,
    tokenType: 'native',
    ...overrides,
  }) as ComposerToken

describe('useComposerAmountDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('formatRawAmount converts wei to display and getEffectiveUsdValue scales by amount', () => {
    const token = makeToken()
    const selectedTokens = ref<ComposerToken[]>([token])
    const customAmounts = ref<Record<string, string | null>>({})
    const tokenKey = (t: ComposerToken) => `${t.chainId}:${t.address}`

    const { formatRawAmount, getEffectiveUsdValue } = useComposerAmountDrafts({
      selectedTokens,
      tokenKey,
      getEffectiveAmount: t => customAmounts.value[tokenKey(t)] ?? t.balance,
      setCustomAmount: (t, raw) => {
        customAmounts.value[tokenKey(t)] = raw
      },
    })

    expect(formatRawAmount('1000000000000000000', 18)).toBe('1')
    expect(formatRawAmount('500000000000000000', 18)).toBe('0.5')
    expect(formatRawAmount('0', 18)).toBe('0')

    expect(getEffectiveUsdValue(token)).toBe(2000)
  })

  it('setMaxAmount sets full balance and clears custom amount', () => {
    const token = makeToken()
    const selectedTokens = ref<ComposerToken[]>([token])
    const customAmounts = ref<Record<string, string | null>>({})
    const tokenKey = (t: ComposerToken) => `${t.chainId}:${t.address}`

    const { setMaxAmount, amountDrafts } = useComposerAmountDrafts({
      selectedTokens,
      tokenKey,
      getEffectiveAmount: t => customAmounts.value[tokenKey(t)] ?? t.balance,
      setCustomAmount: (t, raw) => {
        customAmounts.value[tokenKey(t)] = raw
      },
    })

    setMaxAmount(token)
    expect(customAmounts.value[tokenKey(token)]).toBeNull()
    expect(amountDrafts.value[tokenKey(token)]).toBe('1')
  })

  it('commitAmountDraft clamps to max balance and formats result', () => {
    const token = makeToken({ balance: '500000000000000000' }) // 0.5 ETH
    const selectedTokens = ref<ComposerToken[]>([token])
    const customAmounts = ref<Record<string, string | null>>({})
    const tokenKey = (t: ComposerToken) => `${t.chainId}:${t.address}`

    const { commitAmountDraft, amountDrafts, onUpdateAmountDraft } = useComposerAmountDrafts({
      selectedTokens,
      tokenKey,
      getEffectiveAmount: t => customAmounts.value[tokenKey(token)] ?? t.balance,
      setCustomAmount: (t, raw) => {
        customAmounts.value[tokenKey(t)] = raw
      },
    })

    const k = tokenKey(token)
    onUpdateAmountDraft({ key: k, value: '10' }) // User types 10 (over balance)
    commitAmountDraft(token)
    // Should clamp to 0.5 and show that
    expect(amountDrafts.value[k]).toBe('0.5')
  })

  it('commitAmountDraft with empty input resets to balance', () => {
    const token = makeToken()
    const selectedTokens = ref<ComposerToken[]>([token])
    const customAmounts = ref<Record<string, string | null>>({})
    const tokenKey = (t: ComposerToken) => `${t.chainId}:${t.address}`

    const { commitAmountDraft, amountDrafts, onUpdateAmountDraft } = useComposerAmountDrafts({
      selectedTokens,
      tokenKey,
      getEffectiveAmount: t => customAmounts.value[tokenKey(t)] ?? t.balance,
      setCustomAmount: (t, raw) => {
        customAmounts.value[tokenKey(t)] = raw
      },
    })

    const k = tokenKey(token)
    onUpdateAmountDraft({ key: k, value: '' })
    commitAmountDraft(token)
    expect(amountDrafts.value[k]).toBe('1')
  })
})
