import { ref, watch, type Ref } from 'vue'
import type { ComposerToken } from '~/composables/useTxComposer'

interface UseComposerAmountDraftsOptions {
  selectedTokens: Ref<ComposerToken[]>
  tokenKey: (t: { chainId: number; address: string }) => string
  getEffectiveAmount: (t: ComposerToken) => string
  setCustomAmount: (t: ComposerToken, rawAmount: string | null) => void
}

export function useComposerAmountDrafts(options: UseComposerAmountDraftsOptions) {
  const { selectedTokens, tokenKey, getEffectiveAmount, setCustomAmount } = options

  // Amount drafts (always-editable inline input)
  const amountDrafts = ref<Record<string, string>>({})

  // Format raw amount (wei-like string) to display amount
  const formatRawAmount = (raw: string, decimals: number): string => {
    try {
      const bigIntVal = BigInt(raw)
      const divisor = 10n ** BigInt(decimals)
      const wholePart = bigIntVal / divisor
      const fractionalPart = bigIntVal % divisor
      if (fractionalPart === 0n) {
        return wholePart.toString()
      }
      const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '')
      return `${wholePart}.${fractionalStr}`
    } catch {
      return '0'
    }
  }

  // Parse display amount to raw amount (wei-like string)
  const parseDisplayToRaw = (display: string, decimals: number): bigint => {
    const parts = display.split('.')
    const whole = parts[0] || '0'
    let frac = parts[1] || ''
    if (frac.length > decimals) {
      frac = frac.slice(0, decimals)
    } else {
      frac = frac.padEnd(decimals, '0')
    }
    return BigInt(whole + frac)
  }

  // Get formatted display amount for a token
  const getDisplayAmount = (t: ComposerToken): string => {
    const effectiveRaw = getEffectiveAmount(t)
    return formatRawAmount(effectiveRaw, t.decimals)
  }

  // Calculate USD value for the effective amount
  const getEffectiveUsdValue = (t: ComposerToken): number => {
    const effectiveRaw = getEffectiveAmount(t)
    const effectiveBigInt = BigInt(effectiveRaw)
    const balanceBigInt = BigInt(t.balance)
    if (balanceBigInt === 0n) return 0
    return (Number(effectiveBigInt) / Number(balanceBigInt)) * t.usdValue
  }

  watch(
    selectedTokens,
    tokens => {
      const next: Record<string, string> = {}
      for (const t of tokens) {
        const k = tokenKey(t)
        next[k] = amountDrafts.value[k] ?? getDisplayAmount(t)
      }
      amountDrafts.value = next
    },
    { immediate: true }
  )

  const commitAmountDraft = (t: ComposerToken) => {
    const k = tokenKey(t)
    const rawDraft = amountDrafts.value[k] ?? ''
    const cleaned = rawDraft.replace(/,/g, '').trim()

    if (!cleaned) {
      setCustomAmount(t, null)
      amountDrafts.value[k] = formatRawAmount(t.balance, t.decimals)
      return
    }

    try {
      if (Number.isNaN(Number(cleaned))) throw new Error('Invalid number')
      const parsedRaw = parseDisplayToRaw(cleaned, t.decimals)
      const maxBalance = BigInt(t.balance)
      const finalAmount = parsedRaw > maxBalance ? maxBalance : parsedRaw
      if (finalAmount.toString() === t.balance) {
        setCustomAmount(t, null) // full balance
      } else {
        setCustomAmount(t, finalAmount.toString())
      }
      amountDrafts.value[k] = formatRawAmount(finalAmount.toString(), t.decimals)
    } catch {
      amountDrafts.value[k] = getDisplayAmount(t)
    }
  }

  const setMaxAmount = (t: ComposerToken) => {
    const k = tokenKey(t)
    setCustomAmount(t, null) // null means full balance
    amountDrafts.value[k] = formatRawAmount(t.balance, t.decimals)
  }

  const onUpdateAmountDraft = (payload: { key: string; value: string }) => {
    amountDrafts.value[payload.key] = payload.value
  }

  const refreshAmountDrafts = () => {
    const next: Record<string, string> = {}
    for (const t of selectedTokens.value) {
      const k = tokenKey(t)
      next[k] = getDisplayAmount(t)
    }
    amountDrafts.value = next
  }

  return {
    amountDrafts,
    commitAmountDraft,
    setMaxAmount,
    onUpdateAmountDraft,
    refreshAmountDrafts,
    formatRawAmount,
    getEffectiveUsdValue,
  }
}
