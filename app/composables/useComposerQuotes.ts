import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import type { Route } from '@lifi/sdk'
import type { ComposerToken } from '~/composables/useTxComposer'
import type { QuoteState } from '~/components/tx-composer/ComposerWidget/types'

interface UseComposerQuotesOptions {
  selectedTokens: Ref<ComposerToken[]>
  fromAddress: Ref<string | null>
  recipientAddress: Ref<string>
  targetChainId: Ref<number | null>
  targetTokenAddress: Ref<string | null>
  targetTokenLabel: Ref<string>
  tokenKey: (t: { chainId: number; address: string }) => string
  getEffectiveAmount: (t: ComposerToken) => string
  isSameAsDestination: (t: { chainId: number; address: string }) => boolean
  formatRawAmount: (raw: string, decimals: number) => string
  getRouteQuote: (args: {
    fromToken: ComposerToken
    toChainId: number
    toTokenAddress: string
    fromAddress: string
    toAddress: string
    customAmount: string
  }) => Promise<{ route: Route; cached: boolean } | null>
}

export function useComposerQuotes(options: UseComposerQuotesOptions) {
  const {
    selectedTokens,
    fromAddress,
    recipientAddress,
    targetChainId,
    targetTokenAddress,
    targetTokenLabel,
    tokenKey,
    getEffectiveAmount,
    isSameAsDestination,
    formatRawAmount,
    getRouteQuote,
  } = options

  const quotes = ref<Record<string, QuoteState>>({})
  const quotesError = ref<string | null>(null)
  const loadingStartTimes = ref<Record<string, number>>({})
  const loadingTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({})
  const MIN_ROUTE_LOADING_MS = 1000

  let quoteTimer: ReturnType<typeof setTimeout> | null = null
  let quoteRequestId = 0

  function buildTokenParamsKey(t: ComposerToken) {
    return [
      targetChainId.value,
      targetTokenAddress.value,
      fromAddress.value,
      recipientAddress.value,
      getEffectiveAmount(t),
    ].join(':')
  }

  const quoteDependencies = computed(() => ({
    selected: selectedTokens.value.map(t => tokenKey(t)),
    targetChainId: targetChainId.value,
    targetTokenAddress: targetTokenAddress.value,
    fromAddress: fromAddress.value ?? null,
    recipient: recipientAddress.value,
    customAmounts: selectedTokens.value.map(t => ({
      key: tokenKey(t),
      amount: getEffectiveAmount(t),
    })),
  }))

  async function refreshQuotesDebounced() {
    if (quoteTimer) clearTimeout(quoteTimer)
    quoteTimer = setTimeout(async () => {
      await refreshQuotes()
    }, 350)
  }

  async function refreshQuotes() {
    quotesError.value = null

    if (!fromAddress.value) {
      quotes.value = {}
      return
    }
    if (targetChainId.value === null || !targetTokenAddress.value) {
      quotes.value = {}
      return
    }
    if (selectedTokens.value.length === 0) {
      quotes.value = {}
      return
    }

    const currentId = ++quoteRequestId

    const currentQuotes = { ...quotes.value }
    const tokensToFetch: ComposerToken[] = []

    for (const t of selectedTokens.value) {
      const k = tokenKey(t)
      const paramsKey = buildTokenParamsKey(t)
      const existing = currentQuotes[k]

      if (existing && 'paramsKey' in existing && existing.paramsKey === paramsKey) {
        continue
      }

      currentQuotes[k] = { status: 'loading', paramsKey }
      if (!loadingStartTimes.value[k]) {
        loadingStartTimes.value[k] = Date.now()
      }
      if (loadingTimers.value[k]) {
        clearTimeout(loadingTimers.value[k])
        delete loadingTimers.value[k]
      }
      tokensToFetch.push(t)
    }

    const selectedKeys = new Set(selectedTokens.value.map(tokenKey))
    for (const k in currentQuotes) {
      if (!selectedKeys.has(k)) {
        delete currentQuotes[k]
        delete loadingStartTimes.value[k]
        if (loadingTimers.value[k]) {
          clearTimeout(loadingTimers.value[k])
          delete loadingTimers.value[k]
        }
      }
    }

    quotes.value = currentQuotes

    if (tokensToFetch.length === 0) {
      return
    }

    try {
      const results = await Promise.all(
        tokensToFetch.map(async t => {
          const k = tokenKey(t)
          const paramsKey = buildTokenParamsKey(t)
          if (isSameAsDestination(t)) {
            return { k, q: null, sameToken: true, paramsKey }
          }
          const customAmount = getEffectiveAmount(t)
          const q = await getRouteQuote({
            fromToken: t,
            toChainId: targetChainId.value!,
            toTokenAddress: targetTokenAddress.value!,
            fromAddress: fromAddress.value!,
            toAddress: recipientAddress.value,
            customAmount,
          })
          return { k, q, sameToken: false, paramsKey }
        })
      )

      if (currentId !== quoteRequestId) return

      for (const { k, q, sameToken, paramsKey } of results as Array<{
        k: string
        q: { route: Route; cached: boolean } | null
        sameToken: boolean
        paramsKey: string
      }>) {
        const nextState: QuoteState = sameToken
          ? { status: 'error', message: 'Already the destination token', paramsKey }
          : !q
            ? { status: 'error', message: 'No route found', paramsKey }
            : { status: 'ok', route: q.route, cached: q.cached, paramsKey }

        const startedAt = loadingStartTimes.value[k] ?? Date.now()
        const elapsed = Date.now() - startedAt
        const remaining = Math.max(MIN_ROUTE_LOADING_MS - elapsed, 0)

        const applyState = () => {
          if (currentId !== quoteRequestId) return
          quotes.value = { ...quotes.value, [k]: nextState }
          delete loadingStartTimes.value[k]
          if (loadingTimers.value[k]) {
            delete loadingTimers.value[k]
          }
        }

        if (loadingTimers.value[k]) {
          clearTimeout(loadingTimers.value[k])
          delete loadingTimers.value[k]
        }

        if (remaining > 0) {
          loadingTimers.value[k] = setTimeout(applyState, remaining)
        } else {
          applyState()
        }
      }
    } catch (e: unknown) {
      if (currentId !== quoteRequestId) return
      quotesError.value = e instanceof Error ? e.message : 'Failed to fetch quotes'
    }
  }

  watch(quoteDependencies, () => {
    refreshQuotesDebounced()
  })

  onUnmounted(() => {
    if (quoteTimer) clearTimeout(quoteTimer)
    for (const key in loadingTimers.value) {
      clearTimeout(loadingTimers.value[key])
    }
  })

  const hasOutQuotes = computed(() =>
    selectedTokens.value.some(t => quotes.value[tokenKey(t)]?.status === 'ok')
  )

  const totalValueOut = computed(() => {
    return selectedTokens.value.reduce((sum, t) => {
      const quote = quotes.value[tokenKey(t)]
      if (quote?.status === 'ok') {
        const toAmountUSD = quote.route.toAmountUSD
        if (toAmountUSD) return sum + Number(toAmountUSD)
      }
      return sum
    }, 0)
  })

  const totalFees = computed(() => {
    return selectedTokens.value.reduce((sum, t) => {
      const quote = quotes.value[tokenKey(t)]
      if (quote?.status === 'ok') {
        const route = quote.route
        const gasCostUSD = route.steps.reduce((stepSum, step) => {
          const gasCost =
            step.estimate?.gasCosts?.reduce((gasSum, gas) => {
              return gasSum + Number(gas.amountUSD || 0)
            }, 0) || 0
          return stepSum + gasCost
        }, 0)
        return sum + gasCostUSD
      }
      return sum
    }, 0)
  })

  const outputTokenSymbol = computed(() => {
    for (const t of selectedTokens.value) {
      const s = quotes.value[tokenKey(t)]
      if (s?.status === 'ok') return s.route.toToken?.symbol ?? targetTokenLabel.value
    }
    return targetTokenLabel.value
  })

  const outputTokenDecimals = computed(() => {
    for (const t of selectedTokens.value) {
      const s = quotes.value[tokenKey(t)]
      if (s?.status === 'ok') return s.route.toToken?.decimals ?? 18
    }
    return 18
  })

  const totalOutputRaw = computed(() => {
    let sum = 0n
    for (const t of selectedTokens.value) {
      const s = quotes.value[tokenKey(t)]
      if (s?.status === 'ok' && s.route.toAmount) {
        try {
          sum += BigInt(s.route.toAmount)
        } catch {
          // ignore malformed SDK output
        }
      }
    }
    return sum
  })

  const formattedTotalOutput = computed(() => {
    if (!hasOutQuotes.value) return '—'
    if (totalOutputRaw.value === 0n) return '—'
    return formatRawAmount(totalOutputRaw.value.toString(), outputTokenDecimals.value)
  })

  const routeToolsForToken = (t: { chainId: number; address: string }): string[] => {
    const s = quotes.value[tokenKey(t)]
    if (!s || s.status !== 'ok') return []
    const toolNames = s.route.steps
      .map(step => step.toolDetails?.name)
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    return Array.from(new Set(toolNames))
  }

  const routeTypeForToken = (t: { chainId: number; address: string }): string | null => {
    const s = quotes.value[tokenKey(t)]
    if (!s || s.status !== 'ok') return null
    const rawType = s.route.steps[0]?.type
    return typeof rawType === 'string' && rawType.trim().length > 0 ? rawType : null
  }

  const getOutputAmount = (t: { chainId: number; address: string }): string | null => {
    const s = quotes.value[tokenKey(t)]
    if (!s || s.status !== 'ok') return null
    return s.route.toAmount ?? null
  }

  const getOutputSymbol = (t: { chainId: number; address: string }): string => {
    const s = quotes.value[tokenKey(t)]
    if (!s || s.status !== 'ok') return targetTokenLabel.value
    return s.route.toToken?.symbol ?? targetTokenLabel.value
  }

  const getOutputDecimals = (t: { chainId: number; address: string }): number => {
    const s = quotes.value[tokenKey(t)]
    if (!s || s.status !== 'ok') return 18
    return s.route.toToken?.decimals ?? 18
  }

  const getFormattedOutputAmount = (t: { chainId: number; address: string }): string => {
    const raw = getOutputAmount(t)
    if (!raw) return '—'
    return formatRawAmount(raw, getOutputDecimals(t))
  }

  return {
    quotes,
    quotesError,
    refreshQuotes,
    hasOutQuotes,
    totalValueOut,
    totalFees,
    outputTokenSymbol,
    outputTokenDecimals,
    totalOutputRaw,
    formattedTotalOutput,
    routeToolsForToken,
    routeTypeForToken,
    getOutputSymbol,
    getFormattedOutputAmount,
  }
}
