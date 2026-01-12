<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useConnection, useConfig } from '@wagmi/vue'
import { getPublicClient } from '@wagmi/core'
import { isAddress, parseAbi, zeroAddress, type Address } from 'viem'
import { CHAIN_METADATA } from '~/utils/chains'
import type { ChainMetadata } from '~/utils/chains'
import { getGasTokenName, getUSDCAddress } from '~/utils/tokenAddresses'
import { handleError } from '~/utils/error-handler'
import { formatUsdValueParts } from '~/utils/format'
import NetworkFilter from '~/components/NetworkFilter.vue'
import { useTxComposer, type ComposerToken } from '~/composables/useTxComposer'
import { useBatchComposer } from '~/composables/useBatchComposer'
import type { Route } from '@lifi/sdk'

type TargetAssetMode = 'native' | 'usdc' | 'custom'

const { address } = useConnection()
const config = useConfig()

const {
  allTokens,
  selectedTokens,
  getRouteQuote,
  isExecuting,
  executionStatus,
  refetchTokens,
  clearSelection,
  customAmounts,
  setCustomAmount,
  getEffectiveAmount,
  toggleToken,
} = useTxComposer()

const {
  executeComposer,
  isBatching,
  batchStatus,
  supportsBatching,
  isCheckingSupport,
  checkBatchingSupport,
  batchMethod,
  walletProvider,
  maxBatchSize,
  calculateBatchCount,
} = useBatchComposer()

const targetChainId = ref<number | null>(null)
const targetAssetMode = ref<TargetAssetMode>('native')
const customTokenAddressInput = ref('')
const useBatching = ref(true)
const showRouteDetails = ref(false)

// Chain selector UI (reuse the same design as the table selector)
const showTargetChainFilter = ref(false)
const selectedTargetChainIds = computed<Set<number>>(() => {
  if (targetChainId.value === null) return new Set()
  return new Set([targetChainId.value])
})
const selectedTargetChainDisplay = computed(() => {
  if (targetChainId.value === null) return 'Select chain'
  return CHAIN_METADATA.find(c => c.id === targetChainId.value)?.name ?? 'Unknown'
})
const isTargetChainSelected = (chainId: number): boolean => targetChainId.value === chainId
const onToggleTargetChain = (chainId: number) => {
  targetChainId.value = chainId
  showTargetChainFilter.value = false
}
const onClearTargetChain = () => {
  targetChainId.value = null
  showTargetChainFilter.value = false
}

const sortChainsByValue = (
  chains: ChainMetadata[],
  balances: Record<number, number>
): ChainMetadata[] => {
  return [...chains].sort((a, b) => {
    const diff = (balances[b.id] ?? 0) - (balances[a.id] ?? 0)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}

const chainBalances = computed(() => {
  const balances: Record<number, number> = {}
  allTokens.value.forEach(t => {
    balances[t.chainId] = (balances[t.chainId] || 0) + t.usdValue
  })
  return balances
})

const chainsByBalance = computed(() => sortChainsByValue(CHAIN_METADATA, chainBalances.value))

const totalValueIn = computed(() => {
  return selectedTokens.value.reduce((sum, t) => {
    return sum + getEffectiveUsdValue(t)
  }, 0)
})

const totalValueOut = computed(() => {
  return selectedTokens.value.reduce((sum, t) => {
    const quote = quotes.value[tokenKey(t)]
    if (quote?.status === 'ok') {
      const toAmountUSD = (quote as { route: Route }).route.toAmountUSD
      if (toAmountUSD) {
        return sum + Number(toAmountUSD)
      }
    }
    return sum
  }, 0)
})

const hasOutQuotes = computed(() =>
  selectedTokens.value.some(t => quotes.value[tokenKey(t)]?.status === 'ok')
)

const totalFees = computed(() => {
  return selectedTokens.value.reduce((sum, t) => {
    const quote = quotes.value[tokenKey(t)]
    if (quote?.status === 'ok') {
      const route = (quote as { route: Route }).route
      // Calculate fees: gasCostUSD from steps
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

const formatUsdValue = (value: number) => formatUsdValueParts(value)

// Aggregate output (what you should receive in total)
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

// Auto-set target chain based on first selected token if unset
watch(selectedTokens, (newTokens, oldTokens) => {
  if (
    targetChainId.value === null &&
    newTokens.length === 1 &&
    (oldTokens?.length ?? 0) === 0 &&
    newTokens[0]
  ) {
    targetChainId.value = newTokens[0].chainId
  }
})

const gasTokenName = computed(() => {
  if (targetChainId.value === null) return 'ETH'
  return getGasTokenName(targetChainId.value)
})

const usdcAddress = computed(() => {
  if (targetChainId.value === null) return zeroAddress
  return getUSDCAddress(targetChainId.value)
})

const recipientAddress = computed<Address>(() => {
  return (address.value ?? zeroAddress) as Address
})

interface ResolvedToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

const resolvedCustomToken = ref<ResolvedToken | null>(null)
const isResolvingCustomToken = ref(false)
const customTokenError = ref<string | null>(null)

const ERC20_META_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
])

async function resolveCustomToken() {
  resolvedCustomToken.value = null
  customTokenError.value = null

  if (targetChainId.value === null) {
    customTokenError.value = 'Select a target chain first'
    return
  }

  const addr = customTokenAddressInput.value.trim()
  if (!isAddress(addr)) {
    customTokenError.value = 'Enter a valid token address'
    return
  }

  isResolvingCustomToken.value = true
  try {
    const pc = getPublicClient(config, { chainId: targetChainId.value })
    if (!pc) throw new Error('No public client')

    const [symbol, name, decimals] = await Promise.all([
      pc.readContract({ address: addr as Address, abi: ERC20_META_ABI, functionName: 'symbol' }),
      pc.readContract({ address: addr as Address, abi: ERC20_META_ABI, functionName: 'name' }),
      pc.readContract({ address: addr as Address, abi: ERC20_META_ABI, functionName: 'decimals' }),
    ])

    resolvedCustomToken.value = {
      address: addr as Address,
      symbol: String(symbol),
      name: String(name),
      decimals: Number(decimals),
    }
  } catch (e: any) {
    customTokenError.value = e?.message ? String(e.message) : 'Failed to resolve token metadata'
  } finally {
    isResolvingCustomToken.value = false
  }
}

const targetTokenAddress = computed<Address | null>(() => {
  if (targetChainId.value === null) return null
  if (targetAssetMode.value === 'native') return zeroAddress
  if (targetAssetMode.value === 'usdc') return usdcAddress.value as Address
  return resolvedCustomToken.value?.address ?? null
})

const targetTokenLabel = computed(() => {
  if (targetChainId.value === null) return 'Select target'
  if (targetAssetMode.value === 'native') return `${gasTokenName.value} (Native)`
  if (targetAssetMode.value === 'usdc') return 'USDC'
  if (resolvedCustomToken.value) {
    return `${resolvedCustomToken.value.symbol} (${resolvedCustomToken.value.name})`
  }
  return 'Custom token'
})

const isSameAsDestination = (t: { chainId: number; address: string }) => {
  if (targetChainId.value === null || !targetTokenAddress.value) return false
  return (
    t.chainId === targetChainId.value &&
    t.address.toLowerCase() === targetTokenAddress.value.toLowerCase()
  )
}

const skippedSameTokenSymbols = computed(() => {
  if (targetChainId.value === null || !targetTokenAddress.value) return []
  return selectedTokens.value.filter(isSameAsDestination).map(t => t.symbol)
})

// Address copy for target token
const copiedAddress = ref<string | null>(null)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

function shortenAddress(addr: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

async function copyAddress(addr: string) {
  try {
    await navigator.clipboard.writeText(addr)
    copiedAddress.value = addr
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copiedAddress.value = null
    }, 2000)
  } catch (error) {
    handleError(error, {
      message: 'Failed to copy address to clipboard',
      context: { address: addr },
      showNotification: true,
    })
  }
}

onUnmounted(() => {
  if (copyTimeout) clearTimeout(copyTimeout)
})

// Batch support checks
onMounted(() => {
  if (address.value && targetChainId.value !== null) {
    checkBatchingSupport(targetChainId.value)
  }
})

watch([address, targetChainId], ([addr, cid]) => {
  if (addr && cid !== null) {
    checkBatchingSupport(cid)
  }
})

watch(supportsBatching, can => {
  // If wallet doesn't support batching, force-disable the toggle
  if (can === false) {
    useBatching.value = false
  }
})

// Quote preview
type QuoteState =
  | { status: 'idle' }
  | { status: 'loading'; paramsKey?: string }
  | { status: 'ok'; route: Route; cached: boolean; paramsKey: string }
  | { status: 'error'; message: string; paramsKey: string }

const quotes = ref<Record<string, QuoteState>>({})
const quotesError = ref<string | null>(null)
const loadingStartTimes = ref<Record<string, number>>({})
const loadingTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({})
const MIN_ROUTE_LOADING_MS = 1000

let quoteTimer: ReturnType<typeof setTimeout> | null = null
let quoteRequestId = 0

function tokenKey(t: { chainId: number; address: string }) {
  return `${t.chainId}-${t.address}`
}

function buildTokenParamsKey(t: ComposerToken) {
  return [
    targetChainId.value,
    targetTokenAddress.value,
    address.value,
    recipientAddress.value,
    getEffectiveAmount(t),
  ].join(':')
}

const quoteDependencies = computed(() => ({
  selected: selectedTokens.value.map(t => tokenKey(t)),
  targetChainId: targetChainId.value,
  targetTokenAddress: targetTokenAddress.value,
  fromAddress: address.value ?? null,
  recipient: recipientAddress.value,
  // Include custom amounts in dependencies to trigger re-fetch
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

  if (!address.value) {
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

  // Only mark as loading the ones that actually changed params
  const currentQuotes = { ...quotes.value }
  const tokensToFetch: ComposerToken[] = []

  for (const t of selectedTokens.value) {
    const k = tokenKey(t)
    const paramsKey = buildTokenParamsKey(t)
    const existing = currentQuotes[k]

    if (existing && 'paramsKey' in existing && existing.paramsKey === paramsKey) {
      // Keep existing quote/error if params are the same
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

  // Remove quotes for tokens no longer selected
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
          fromAddress: address.value!,
          toAddress: recipientAddress.value,
          customAmount,
        })
        return { k, q, sameToken: false, paramsKey }
      })
    )

    if (currentId !== quoteRequestId) return

    for (const { k, q, sameToken, paramsKey } of results as any[]) {
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
        const merged = { ...quotes.value, [k]: nextState }
        quotes.value = merged
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
  } catch (e: any) {
    if (currentId !== quoteRequestId) return
    quotesError.value = e?.message ? String(e.message) : 'Failed to fetch quotes'
  } finally {
    // keep hook for future cleanup if needed
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

// Get chain icon for a token
const getChainIconUrl = (chainId: number): string | undefined => {
  return CHAIN_METADATA.find(c => c.id === chainId)?.icon
}

// Target asset options with logos
const targetAssetOptions = computed(() => {
  const options = [
    {
      id: 'native',
      label: `${gasTokenName.value} (Native)`,
      icon: getChainIconUrl(targetChainId.value ?? 0),
    },
    {
      id: 'usdc',
      label: 'USDC',
      icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    },
    {
      id: 'custom',
      label: 'Custom token address',
      icon: undefined,
    },
  ]
  return options
})

const showTargetAssetDropdown = ref(false)
const targetAssetDropdownRef = ref<HTMLElement | null>(null)

const selectTargetAsset = (mode: TargetAssetMode) => {
  targetAssetMode.value = mode
  showTargetAssetDropdown.value = false
}

// Close dropdown on click outside
const handleClickOutsideDropdown = (event: MouseEvent) => {
  if (
    targetAssetDropdownRef.value &&
    !targetAssetDropdownRef.value.contains(event.target as Node)
  ) {
    showTargetAssetDropdown.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutsideDropdown)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutsideDropdown)
})

// Estimate total calls (each non-native token needs approval + swap, native only needs swap)
const estimatedCallCount = computed(() => {
  let count = 0
  for (const t of selectedTokens.value) {
    // Skip if same as destination
    if (isSameAsDestination(t)) continue
    // Native tokens don't need approval
    const isNative = t.address.toLowerCase() === '0x0000000000000000000000000000000000000000'
    count += isNative ? 1 : 2 // 1 for swap, 1 for approval if ERC20
  }
  return count
})

// Calculate estimated number of batches needed
const estimatedBatchCount = computed(() => {
  if (!supportsBatching.value || !useBatching.value) return 1
  return calculateBatchCount(estimatedCallCount.value, maxBatchSize.value)
})

// Check if we need multiple batches
const needsMultipleBatches = computed(() => estimatedBatchCount.value > 1)

// Get wallet provider display name
const walletProviderDisplayName = computed(() => {
  const provider = walletProvider.value
  const names: Record<string, string> = {
    metamask: 'MetaMask',
    rabby: 'Rabby',
    coinbase: 'Coinbase',
    unknown: 'Wallet',
  }
  return names[provider] ?? 'Wallet'
})

const executeButtonText = computed(() => {
  if (isCheckingSupport.value) return 'Checking wallet...'
  if (isExecuting.value) return executionStatus.value || 'Executing...'
  if (isBatching.value) return batchStatus.value || 'Executing...'

  if (supportsBatching.value && useBatching.value && selectedTokens.value.length >= 2) {
    const batchCount = estimatedBatchCount.value
    if (batchCount > 1) {
      return `Execute (${batchCount} batches)`
    }
    return batchMethod.value === 'eip7702' ? '⚡ One-Click Execute' : 'Batch Execute'
  }
  return 'Execute'
})

const canExecute = computed(() => {
  if (!address.value) return false
  if (selectedTokens.value.length === 0) return false
  if (targetChainId.value === null) return false
  if (!targetTokenAddress.value) return false
  if (isExecuting.value || isBatching.value || isCheckingSupport.value) return false
  return true
})

const onExecute = async () => {
  if (!address.value) {
    handleError(new Error('Please connect your wallet'), {
      message: 'Wallet connection required',
      showNotification: true,
    })
    return
  }
  if (targetChainId.value === null) {
    handleError(new Error('Please select a target chain'), {
      message: 'Target chain is required',
      showNotification: true,
    })
    return
  }
  if (!targetTokenAddress.value) {
    handleError(new Error('Please select a target token'), {
      message: 'Target token is required',
      showNotification: true,
    })
    return
  }

  try {
    const tokensToExecute = selectedTokens.value.filter(t => !isSameAsDestination(t))
    if (tokensToExecute.length === 0) {
      handleError(new Error('All selected tokens are already the destination token'), {
        message: 'Nothing to execute',
        showNotification: true,
      })
      return
    }

    await executeComposer({
      targetChainId: targetChainId.value,
      targetTokenAddress: targetTokenAddress.value,
      tokens: tokensToExecute,
      sendOutput: false,
      recipientAddress: undefined,
      useBatching: useBatching.value,
      customAmounts: customAmounts.value,
    })

    await refetchTokens()
    clearSelection()
  } catch (error) {
    handleError(error, {
      message: error instanceof Error ? error.message : 'Transaction failed',
      context: {
        targetChainId: targetChainId.value,
        tokenCount: selectedTokens.value.length,
      },
      showNotification: true,
    })
  }
}

const poweredByText = computed(() => {
  return 'Powered by LiFi (DEX + bridge aggregation)'
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
  // Some SDK typings use string-literal unions here; avoid an incompatible type predicate.
  return typeof rawType === 'string' && rawType.trim().length > 0 ? rawType : null
}

// Amount drafts (always-editable inline input)
const amountDrafts = ref<Record<string, string>>({})

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
    // If user typed something malformed, revert back to the effective amount
    amountDrafts.value[k] = getDisplayAmount(t)
  }
}

const setMaxAmount = (t: ComposerToken) => {
  const k = tokenKey(t)
  setCustomAmount(t, null) // null means full balance
  amountDrafts.value[k] = formatRawAmount(t.balance, t.decimals)
}

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
  // Proportional calculation
  return (Number(effectiveBigInt) / Number(balanceBigInt)) * t.usdValue
}

// Get output token amount from quote
const getOutputAmount = (t: { chainId: number; address: string }): string | null => {
  const s = quotes.value[tokenKey(t)]
  if (!s || s.status !== 'ok') return null
  const route = s.route
  return route.toAmount ?? null
}

// Get output token symbol from quote
const getOutputSymbol = (t: { chainId: number; address: string }): string => {
  const s = quotes.value[tokenKey(t)]
  if (!s || s.status !== 'ok') return targetTokenLabel.value
  return s.route.toToken?.symbol ?? targetTokenLabel.value
}

// Get output token decimals from quote
const getOutputDecimals = (t: { chainId: number; address: string }): number => {
  const s = quotes.value[tokenKey(t)]
  if (!s || s.status !== 'ok') return 18
  return s.route.toToken?.decimals ?? 18
}

// Format output amount from quote
const getFormattedOutputAmount = (t: { chainId: number; address: string }): string => {
  const raw = getOutputAmount(t)
  if (!raw) return '—'
  const decimals = getOutputDecimals(t)
  return formatRawAmount(raw, decimals)
}

const getOutputLogo = (t: { chainId: number; address: string }): string | undefined => {
  const s = quotes.value[tokenKey(t)]
  if (s?.status === 'ok') return s.route.toToken?.logoURI
  if (targetAssetMode.value === 'native') return getChainIconUrl(targetChainId.value ?? 0)
  if (targetAssetMode.value === 'usdc')
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'
  if (resolvedCustomToken.value) return undefined // could add generic logo
  return undefined
}

const getTargetChainName = () => {
  if (targetChainId.value === null) return ''
  return CHAIN_METADATA.find(c => c.id === targetChainId.value)?.name ?? ''
}
</script>

<template>
  <div class="composer-widget">
    <div class="summary">
      <div class="summary-scrollable">
        <div class="stat">
          <label>Selected</label>
          <span class="value">{{ selectedTokens.length }}</span>
        </div>
        <div class="stat">
          <label>Total Sell</label>
          <div class="value">
            <span>{{ formatUsdValue(totalValueIn).main }}</span>
            <span v-if="formatUsdValue(totalValueIn).extra" class="usd-sub-decimals">
              {{ formatUsdValue(totalValueIn).extra }}
            </span>
          </div>
        </div>
        <div class="stat">
          <label>Total Receive</label>
          <div class="value">
            <span>{{ formattedTotalOutput }}</span>
            <span v-if="hasOutQuotes" class="muted-symbol">{{ outputTokenSymbol }}</span>
            <span v-if="hasOutQuotes" class="usd-value-inline">
              ({{ formatUsdValue(totalValueOut).main }}{{ formatUsdValue(totalValueOut).extra }})
            </span>
          </div>
        </div>
        <div class="stat">
          <label>Est. Fees</label>
          <div class="value">
            <span v-if="hasOutQuotes && totalFees > 0">
              {{ formatUsdValue(totalFees).main }}
            </span>
            <span v-else>—</span>
            <span
              v-if="hasOutQuotes && totalFees > 0 && formatUsdValue(totalFees).extra"
              class="usd-sub-decimals"
            >
              {{ formatUsdValue(totalFees).extra }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="control-row">
        <div class="control-group chain-group">
          <label>to chain</label>
          <NetworkFilter
            :chains-with-assets="chainsByBalance"
            :chains-without-assets="[]"
            :selected-chain-ids="selectedTargetChainIds"
            :selected-chains-display="selectedTargetChainDisplay"
            :show-chain-filter="showTargetChainFilter"
            :is-chain-selected="isTargetChainSelected"
            :on-toggle-chain="onToggleTargetChain"
            :on-click-all-networks="onClearTargetChain"
            :chain-balances="chainBalances"
            all-networks-label="Select chain"
            @update:show-chain-filter="showTargetChainFilter = $event"
          />
        </div>

        <div class="control-group asset-group">
          <div class="label-with-address">
            <label>to Asset</label>
            <div v-if="targetAssetMode === 'usdc' && targetTokenAddress" class="inline-address">
              <button
                class="token-address-btn mini"
                :class="{ copied: copiedAddress === targetTokenAddress }"
                :title="copiedAddress === targetTokenAddress ? 'Copied!' : 'Copy contract address'"
                @click="copyAddress(targetTokenAddress)"
              >
                <span class="token-address">{{ shortenAddress(targetTokenAddress) }}</span>
                <svg
                  v-if="copiedAddress === targetTokenAddress"
                  width="10"
                  height="10"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 8L6.5 11.5L13 5"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <rect
                    x="5.5"
                    y="5.5"
                    width="8"
                    height="8"
                    rx="1"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <path
                    d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3.5C2.67157 2 2 2.67157 2 3.5V9C2 9.82843 2.67157 10.5 3.5 10.5H5.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div ref="targetAssetDropdownRef" class="custom-dropdown">
            <button
              class="dropdown-trigger"
              :disabled="targetChainId === null"
              @click.stop="showTargetAssetDropdown = !showTargetAssetDropdown"
            >
              <div class="trigger-content">
                <img
                  v-if="targetAssetOptions.find(o => o.id === targetAssetMode)?.icon"
                  :src="targetAssetOptions.find(o => o.id === targetAssetMode)?.icon"
                  class="option-icon"
                />
                <span class="trigger-label">{{
                  targetAssetOptions.find(o => o.id === targetAssetMode)?.label
                }}</span>
              </div>
              <span class="filter-arrow" :class="{ rotated: showTargetAssetDropdown }">▼</span>
            </button>

            <div v-if="showTargetAssetDropdown" class="dropdown-menu">
              <button
                v-for="option in targetAssetOptions"
                :key="option.id"
                class="dropdown-option"
                :class="{ selected: targetAssetMode === option.id }"
                @click="selectTargetAsset(option.id as TargetAssetMode)"
              >
                <img v-if="option.icon" :src="option.icon" class="option-icon" />
                <div v-else-if="option.id === 'custom'" class="option-icon-placeholder">?</div>
                <span class="option-label">{{ option.label }}</span>
                <span v-if="targetAssetMode === option.id" class="checkmark">✓</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="targetAssetMode === 'custom'" class="custom-token-box">
        <input
          v-model="customTokenAddressInput"
          type="text"
          placeholder="0x… token address"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          class="compact-input"
        />
        <button
          class="secondary-btn"
          :disabled="isResolvingCustomToken || targetChainId === null"
          @click="resolveCustomToken"
        >
          {{ isResolvingCustomToken ? 'Resolving…' : 'Resolve' }}
        </button>

        <div v-if="resolvedCustomToken" class="resolved-token">
          <div class="resolved-header">
            <span class="resolved-title">{{ targetTokenLabel }}</span>
            <button
              class="token-address-btn mini"
              :class="{ copied: copiedAddress === resolvedCustomToken.address }"
              @click="copyAddress(resolvedCustomToken.address)"
            >
              <span class="token-address">{{ shortenAddress(resolvedCustomToken.address) }}</span>
              <svg
                v-if="copiedAddress === resolvedCustomToken.address"
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M3 8L6.5 11.5L13 5"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg v-else width="10" height="10" viewBox="0 0 16 16" fill="none">
                <rect
                  x="5.5"
                  y="5.5"
                  width="8"
                  height="8"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <path
                  d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3.5C2.67157 2 2 2.67157 2 3.5V9C2 9.82843 2.67157 10.5 3.5 10.5H5.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
        <div v-else-if="customTokenError" class="error-text">{{ customTokenError }}</div>
      </div>

      <div class="control-group">
        <div v-if="isCheckingSupport" class="checking-status">
          <span class="spinner-xs"></span> Checking wallet…
        </div>
        <div v-else-if="supportsBatching" class="batch-settings">
          <div class="checkbox-line">
            <label>
              <input v-model="useBatching" type="checkbox" />
              <span>{{
                batchMethod === 'eip7702' ? 'One-Click Mode (EIP-7702)' : 'Batch (EIP-5792)'
              }}</span>
            </label>
          </div>
          <!-- Batch info when multiple batches needed -->
          <div v-if="useBatching && needsMultipleBatches" class="batch-info">
            <div class="batch-info-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.25" />
                <path
                  d="M8 7V12"
                  stroke="currentColor"
                  stroke-width="1.25"
                  stroke-linecap="round"
                />
                <path
                  d="M8 5.25H8.01"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div class="batch-info-content">
              <span class="batch-info-text">
                {{ walletProviderDisplayName }} supports max {{ maxBatchSize }} calls/batch. This
                will require <strong>{{ estimatedBatchCount }} batches</strong> ({{
                  estimatedCallCount
                }}
                total calls).
              </span>
            </div>
          </div>
        </div>
        <div v-else-if="supportsBatching === false" class="info-text">
          Wallet does not support batching; will execute sequentially.
        </div>
      </div>

      <div class="preview-section">
        <div class="preview-header">
          <div class="preview-title">Transaction Preview</div>
          <div class="preview-header-right">
            <div class="preview-subtitle">{{ poweredByText }}</div>
            <label class="details-toggle">
              <input v-model="showRouteDetails" type="checkbox" />
              <span>Show details</span>
            </label>
          </div>
        </div>

        <div v-if="quotesError" class="error-text">{{ quotesError }}</div>

        <div v-if="skippedSameTokenSymbols.length > 0" class="info-text skipped-notice">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.25" />
            <path d="M8 7V12" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            <path
              d="M8 5.25H8.01"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
            />
          </svg>
          Some assets were skipped because they are already the destination token ({{
            skippedSameTokenSymbols.join(', ')
          }}).
        </div>

        <div v-if="selectedTokens.length === 0" class="preview-empty">
          <div class="preview-empty-icon">📋</div>
          <div class="preview-empty-text">Select assets to preview routes</div>
        </div>
        <div v-else-if="targetChainId === null" class="preview-empty">
          <div class="preview-empty-icon">🔗</div>
          <div class="preview-empty-text">Select a target chain</div>
        </div>
        <div v-else-if="!targetTokenAddress" class="preview-empty">
          <div class="preview-empty-icon">🪙</div>
          <div class="preview-empty-text">Select a target token</div>
        </div>
        <div v-else class="preview-list">
          <!-- Table Header -->
          <div class="preview-table-header">
            <div class="preview-header-col">You Send</div>
            <div class="preview-header-col">You Receive</div>
          </div>

          <div
            v-for="t in selectedTokens"
            :key="`${t.chainId}-${t.address}`"
            class="preview-card"
            :class="{ loading: quotes[`${t.chainId}-${t.address}`]?.status === 'loading' }"
          >
            <button
              class="preview-cancel-btn"
              type="button"
              :title="'Remove ' + t.symbol"
              @click="toggleToken(t)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <div class="preview-columns">
              <!-- Send Column -->
              <div class="preview-column">
                <div class="preview-token-row">
                  <img v-if="t.logoURI" :src="t.logoURI" class="preview-token-logo" alt="" />
                  <div v-else class="preview-token-logo-placeholder">{{ t.symbol[0] }}</div>
                  <div class="preview-token-info">
                    <div class="preview-token-topline">
                      <span class="preview-token-symbol">{{ t.symbol }}</span>
                      <div class="preview-inline-amount">
                        <input
                          v-model="amountDrafts[`${t.chainId}-${t.address}`]"
                          class="preview-inline-amount-input"
                          type="text"
                          inputmode="decimal"
                          placeholder="0.00"
                          @blur="commitAmountDraft(t)"
                          @keydown.enter.prevent="commitAmountDraft(t)"
                        />
                        <button
                          class="preview-inline-max-btn"
                          type="button"
                          @click="setMaxAmount(t)"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                    <div class="preview-token-meta">
                      <div class="preview-token-name-group">
                        <span class="preview-token-name">{{ t.name }}</span>
                        <div class="preview-chain-badge">
                          <img
                            v-if="getChainIconUrl(t.chainId)"
                            :src="getChainIconUrl(t.chainId)"
                            class="preview-chain-icon"
                            alt=""
                          />
                          <span class="preview-chain-text">{{ t.chainName }}</span>
                        </div>
                      </div>
                      <div class="preview-token-meta-right">
                        <div class="preview-usd-value">
                          <span>{{ formatUsdValue(getEffectiveUsdValue(t)).main }}</span>
                          <span
                            v-if="formatUsdValue(getEffectiveUsdValue(t)).extra"
                            class="usd-sub-decimals"
                          >
                            {{ formatUsdValue(getEffectiveUsdValue(t)).extra }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Receive Column -->
              <div class="preview-column receive">
                <template v-if="quotes[`${t.chainId}-${t.address}`]?.status === 'loading'">
                  <div class="route-search-indicator compact">
                    <div class="search-dots">
                      <span class="dot"></span>
                      <span class="dot"></span>
                      <span class="dot"></span>
                    </div>
                    <span class="search-text">Finding best route</span>
                  </div>
                </template>
                <template v-else-if="quotes[`${t.chainId}-${t.address}`]?.status === 'error'">
                  <div class="preview-error">
                    {{ (quotes[`${t.chainId}-${t.address}`] as any).message }}
                  </div>
                </template>
                <template v-else-if="quotes[`${t.chainId}-${t.address}`]?.status === 'ok'">
                  <div class="preview-token-row">
                    <img
                      v-if="getOutputLogo(t)"
                      :src="getOutputLogo(t)"
                      class="preview-token-logo"
                      alt=""
                    />
                    <div v-else class="preview-token-logo-placeholder">
                      {{ getOutputSymbol(t)[0] }}
                    </div>
                    <div class="preview-token-info">
                      <div class="preview-token-topline">
                        <span class="preview-token-symbol">{{ getOutputSymbol(t) }}</span>
                        <div class="preview-output-amount">
                          <span class="preview-amount-value large">
                            {{ getFormattedOutputAmount(t) }}
                          </span>
                          <span class="preview-amount-symbol">{{ getOutputSymbol(t) }}</span>
                        </div>
                      </div>
                      <div class="preview-token-meta">
                        <div class="preview-token-name-group">
                          <span class="preview-token-name">{{ getOutputSymbol(t) }}</span>
                          <div class="preview-chain-badge">
                            <img
                              v-if="getChainIconUrl(targetChainId!)"
                              :src="getChainIconUrl(targetChainId!)"
                              class="preview-chain-icon"
                              alt=""
                            />
                            <span class="preview-chain-text">{{ getTargetChainName() }}</span>
                          </div>
                        </div>
                        <div class="preview-token-meta-right">
                          <div class="preview-usd-value">
                            <span>{{
                              formatUsdValue(
                                Number(
                                  (quotes[`${t.chainId}-${t.address}`] as any).route.toAmountUSD ??
                                    0
                                )
                              ).main
                            }}</span>
                            <span
                              v-if="
                                formatUsdValue(
                                  Number(
                                    (quotes[`${t.chainId}-${t.address}`] as any).route
                                      .toAmountUSD ?? 0
                                  )
                                ).extra
                              "
                              class="usd-sub-decimals"
                            >
                              {{
                                formatUsdValue(
                                  Number(
                                    (quotes[`${t.chainId}-${t.address}`] as any).route
                                      .toAmountUSD ?? 0
                                  )
                                ).extra
                              }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="showRouteDetails" class="preview-receive-footer">
                    <div class="preview-route-info-inline">
                      <span v-if="routeTypeForToken(t)" class="tech-pill mini">
                        {{ routeTypeForToken(t) }}
                      </span>
                      <span
                        v-for="tool in routeToolsForToken(t)"
                        :key="tool"
                        class="tech-pill mini"
                      >
                        {{ tool }}
                      </span>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="route-search-indicator compact">
                    <div class="search-dots">
                      <span class="dot"></span>
                      <span class="dot"></span>
                      <span class="dot"></span>
                    </div>
                    <span class="search-text">Finding best route</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button class="execute-btn" :disabled="!canExecute" @click="onExecute">
        <span v-if="isExecuting || isBatching || isCheckingSupport" class="spinner-sm"></span>
        {{ executeButtonText }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer-widget {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 20px;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  overflow: visible; /* Changed from hidden to allow dropdowns */
  display: flex;
  flex-direction: column;
}

.summary {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.summary-scrollable {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
}

.stat {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.stat label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 2px;
  letter-spacing: 0.05em;
}

.stat .value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}

.muted-symbol {
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 600;
}

.usd-value-inline {
  font-size: 16px;
  color: mediumseagreen;
  font-weight: 600;
  margin-left: 2px;
}

.stat .usd-sub-decimals {
  font-size: 16px;
  color: var(--text-muted);
  opacity: 0.85;
  font-weight: 600;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.control-row {
  display: grid;
  grid-template-columns: 180px 1fr; /* Wider first column, narrower second */
  gap: 12px;
  align-items: start;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label-with-address {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}

.inline-address {
  display: flex;
  align-items: center;
  gap: 4px;
}

.contract-label {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 600;
}

.control-group label {
  font-size: 12px;
  color: var(--text-secondary);
}

select,
input {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
}

.compact-input {
  padding: 8px 10px;
}

/* Custom Dropdown Styles */
.custom-dropdown {
  position: relative;
  width: 100%;
}

.dropdown-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s;
}

.dropdown-trigger:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.dropdown-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trigger-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.trigger-label {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 110;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
  text-align: left;
  transition: all 0.2s;
}

.dropdown-option:hover {
  background: var(--bg-hover);
}

.dropdown-option.selected {
  background: var(--accent-muted);
}

.option-icon,
.option-icon-placeholder {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.option-icon-placeholder {
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.option-label {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
}

.filter-arrow {
  font-size: 10px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.filter-arrow.rotated {
  transform: rotate(180deg);
}

.custom-token-box {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.secondary-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.resolved-token {
  grid-column: 1 / -1;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.resolved-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.resolved-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.token-address-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid transparent;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-mono);
  width: fit-content;
}

.token-address-btn.mini {
  padding: 1px 4px;
}

.token-address-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.token-address-btn.copied {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.token-address {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
}

.token-address-btn.copied .token-address {
  color: var(--success);
  font-weight: 600;
}

.preview-section {
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: hidden; /* Only the list should scroll */
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.details-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-secondary);
  user-select: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.details-toggle:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.details-toggle input {
  margin: 0;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.preview-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-primary);
}

.preview-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px 16px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  border: 1px dashed var(--border-color);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding-right: 2px;
}

.preview-table-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  padding: 0 10px;
}

.preview-header-col {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px;
  padding-right: 32px; /* Added padding to prevent cancel button overlap */
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s ease;
  position: relative;
}

.preview-card:hover {
  border-color: var(--primary-color);
}

.preview-cancel-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px; /* Slightly smaller */
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  z-index: 10;
  padding: 0;
  flex-shrink: 0;
}

.preview-cancel-btn:hover {
  background: var(--bg-hover);
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
  transform: scale(1.1);
}

.preview-cancel-btn:active {
  transform: scale(0.95);
}

.preview-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: start;
}

.preview-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-column.receive {
  border-left: 1px solid var(--border-color);
  padding-left: 10px;
  position: relative;
}

.preview-token-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.preview-token-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.preview-token-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.preview-token-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
}

.preview-token-symbol {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.preview-output-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-inline-amount {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 60%;
}

.preview-inline-amount-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-mono);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  text-align: right;
  min-width: 0;
}

.preview-inline-max-btn {
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}

.preview-token-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}

.preview-token-name-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.preview-token-name {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.preview-token-meta-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.preview-chain-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--accent-muted);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.preview-chain-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  object-fit: contain;
}

.preview-chain-text {
  font-size: 9px;
  color: var(--accent-primary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.preview-usd-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
  color: mediumseagreen;
  white-space: nowrap;
}

.preview-amount-value.large {
  font-size: 16px;
}

.preview-amount-symbol {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-left: 2px;
}

.preview-receive-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: auto;
  gap: 8px;
}

.preview-route-info-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tech-pill.mini {
  font-size: 9px;
  padding: 1px 6px;
}

.preview-output-amount {
  display: flex;
  align-items: baseline;
  gap: 2px;
  justify-content: flex-end;
}

.checkmark {
  color: mediumseagreen;
  font-weight: 700;
}

/* Batch settings and info */
.batch-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-line label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  user-select: none;
  padding: 4px 0;
}

.checkbox-line input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin: 0;
  accent-color: var(--accent-primary, mediumseagreen);
  border-radius: 4px;
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  flex-shrink: 0;
  transition: all 0.2s;
}

.checkbox-line input[type='checkbox']:checked {
  background: var(--accent-primary, mediumseagreen);
  border-color: var(--accent-primary, mediumseagreen);
}

.checkbox-line input[type='checkbox']:hover {
  border-color: var(--accent-primary, mediumseagreen);
}

.checkbox-line input[type='checkbox']:focus {
  outline: 2px solid var(--accent-muted, rgba(60, 179, 113, 0.3));
  outline-offset: 2px;
}

.batch-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  border-left: 3px solid var(--warning, #f59e0b);
}

.batch-info-icon {
  color: var(--warning, #f59e0b);
  flex-shrink: 0;
  margin-top: 1px;
}

.batch-info-content {
  flex: 1;
}

.batch-info-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.batch-info-text strong {
  color: var(--text-primary);
  font-weight: 600;
}

.checking-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.info-text {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 0;
}

.info-text.skipped-notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.execute-btn {
  background: mediumseagreen;
  color: white;
  border: none;
  padding: 8px 32px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(60, 179, 113, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 100%;
  min-height: 48px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.execute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .control-row {
    grid-template-columns: 1fr;
  }
  .preview-columns {
    grid-template-columns: 1fr;
  }
  .preview-column.receive {
    border-left: none;
    padding-left: 0;
    border-top: 1px solid var(--border-color);
    padding-top: 8px;
  }
}

/* Route loading indicator */
.route-search-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
}

.route-search-indicator.compact {
  padding: 4px 10px;
}

.search-dots {
  display: flex;
  gap: 4px;
}

.search-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary, mediumseagreen);
  animation: bounce 1.4s ease-in-out infinite;
}

.search-dots .dot:nth-child(1) {
  animation-delay: 0s;
}

.search-dots .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.search-dots .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.search-text {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Loading card state */
.preview-card.loading {
  border-color: var(--accent-primary, mediumseagreen);
  box-shadow: 0 0 0 1px var(--accent-muted, rgba(60, 179, 113, 0.2));
}

.spinner-xs {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-color);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinner-sm {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.muted {
  color: var(--text-secondary);
  font-size: 12px;
}
.error-text {
  color: var(--danger, #ef4444);
  font-size: 12px;
}
.usd-sub-decimals {
  font-size: 0.9em;
  opacity: 0.8;
}
.tech-pill {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 3px 8px;
  border-radius: 999px;
  font-family: var(--font-mono);
}
.cache-pill {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  padding: 2px 8px;
  border-radius: 999px;
  font-family: var(--font-mono);
}
</style>
