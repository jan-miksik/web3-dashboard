import { computed, ref, watch, type Ref } from 'vue'
import { getPublicClient } from '@wagmi/core'
import { useConfig, type Config } from '@wagmi/vue'
import { isAddress, parseAbi, zeroAddress, type Address } from 'viem'
import {
  CHAIN_METADATA,
  getChainName,
  getChainIcon,
  sortChainsByValue,
  aggregateUsdByChainId,
} from '~/utils/chains'
import { shortenAddress as shortenAddressUtil } from '~/utils/format'
import { useCopyToClipboard } from '~/composables/useCopyToClipboard'
import {
  getCommonTokens,
  getGasTokenName,
  getUSDCAddress,
  ETH_ICON_URL,
} from '~/utils/tokenAddresses'
import type { ResolvedToken, TargetAssetMode } from '~/components/tx-composer/ComposerWidget/types'

type TokenWithChainAndUsd = { chainId: number; usdValue: number }

interface UseComposerTargetStateOptions {
  allTokens: Ref<TokenWithChainAndUsd[]>
  selectedTokens: Ref<Array<{ chainId: number }>>
}

export function useComposerTargetState(options: UseComposerTargetStateOptions) {
  const { allTokens, selectedTokens } = options

  const config = useConfig() as unknown as Config

  const targetChainId = ref<number | null>(null)
  // Start with no destination token selected; user must choose.
  const targetAssetMode = ref<TargetAssetMode>('custom')
  const customTokenAddressInput = ref('')
  const needsTargetTokenSelection = ref(false)

  const dismissTargetTokenSelectionPrompt = () => {
    needsTargetTokenSelection.value = false
  }

  // Chain selector UI
  const showTargetChainFilter = ref(false)
  const selectedTargetChainIds = computed<Set<number>>(() => {
    if (targetChainId.value === null) return new Set()
    return new Set([targetChainId.value])
  })
  const selectedTargetChainDisplay = computed(() => {
    if (targetChainId.value === null) return 'Select chain'
    return getChainName(targetChainId.value)
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

  // Auto-set target chain and native token when user selects first token from the left (no destination yet)
  watch(selectedTokens, (newTokens, oldTokens) => {
    if (
      targetChainId.value === null &&
      newTokens.length === 1 &&
      (oldTokens?.length ?? 0) === 0 &&
      newTokens[0]
    ) {
      targetChainId.value = newTokens[0].chainId
      if (targetAssetMode.value === 'custom' && !resolvedCustomToken.value) {
        targetAssetMode.value = 'native'
      }
    }
  })

  // When chain changes, try to keep the same destination asset (by symbol) on the new chain.
  // If we can't find a match, we clear selection and prompt the user to select a valid token.
  watch(targetChainId, (newChainId, oldChainId) => {
    if (newChainId === null || oldChainId === null || newChainId === oldChainId) return

    // Reset prompt; we'll enable it if we can't map the token.
    needsTargetTokenSelection.value = false

    // Native token always exists.
    if (targetAssetMode.value === 'native') return

    // USDC is chain-specific.
    if (targetAssetMode.value === 'usdc') {
      if (getUSDCAddress(newChainId) === zeroAddress) {
        targetAssetMode.value = 'custom'
        resolvedCustomToken.value = null
        needsTargetTokenSelection.value = true
      }
      return
    }

    if (targetAssetMode.value !== 'custom') return
    if (!resolvedCustomToken.value) return

    const prevSymbol = (resolvedCustomToken.value.symbol ?? '').toUpperCase()

    // If the "custom" token was actually USDC, keep USDC mode if available.
    if (prevSymbol === 'USDC' && getUSDCAddress(newChainId) !== zeroAddress) {
      resolvedCustomToken.value = null
      targetAssetMode.value = 'usdc'
      return
    }

    // If the symbol matches the new chain's gas token, switch to native.
    const newGasSymbol = getGasTokenName(newChainId).toUpperCase()
    if (prevSymbol && prevSymbol === newGasSymbol) {
      resolvedCustomToken.value = null
      targetAssetMode.value = 'native'
      return
    }

    // Try to reselect a well-known token on the new chain (DAI -> DAI, WETH -> WETH, etc.).
    const common = getCommonTokens(newChainId)
    const match = common.find(t => (t.symbol ?? '').toUpperCase() === prevSymbol)
    if (match) {
      resolvedCustomToken.value = {
        address: match.address,
        symbol: match.symbol,
        name: match.name,
        decimals: match.decimals,
        logoURI: match.logoURI,
      }
      return
    }

    // Could not map token to new chain → clear and prompt.
    resolvedCustomToken.value = null
    targetAssetMode.value = 'custom'
    needsTargetTokenSelection.value = true
  })

  const chainBalances = computed(() => aggregateUsdByChainId(allTokens.value))

  const chainsByBalance = computed(() => sortChainsByValue(CHAIN_METADATA, chainBalances.value))

  const gasTokenName = computed(() => {
    if (targetChainId.value === null) return 'ETH'
    return getGasTokenName(targetChainId.value)
  })

  const usdcAddress = computed(() => {
    if (targetChainId.value === null) return zeroAddress
    return getUSDCAddress(targetChainId.value)
  })

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
        pc.readContract({
          address: addr as Address,
          abi: ERC20_META_ABI,
          functionName: 'decimals',
        }),
      ])

      resolvedCustomToken.value = {
        address: addr as Address,
        symbol: String(symbol),
        name: String(name),
        decimals: Number(decimals),
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to resolve token metadata'
      customTokenError.value = message
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
    if (targetChainId.value === null) return 'Select token'
    if (targetAssetMode.value === 'native') return `${gasTokenName.value} (Native)`
    if (targetAssetMode.value === 'usdc') return 'USDC'
    if (resolvedCustomToken.value) {
      return `${resolvedCustomToken.value.symbol} (${resolvedCustomToken.value.name})`
    }
    return 'Select token'
  })

  const getChainIconUrl = (chainId: number): string | undefined => getChainIcon(chainId)

  const targetAssetOptions = computed(() => {
    const nativeIcon =
      gasTokenName.value === 'ETH' ? ETH_ICON_URL : getChainIconUrl(targetChainId.value ?? 0)
    const options: Array<{ id: string; label: string; icon?: string }> = [
      {
        id: 'native',
        label: `${gasTokenName.value} (Native)`,
        icon: nativeIcon,
      },
      {
        id: 'usdc',
        label: 'USDC',
        icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
      },
    ]
    const common = targetChainId.value !== null ? getCommonTokens(targetChainId.value) : []
    common.forEach(t => {
      options.push({
        id: t.address,
        label: t.symbol,
        icon: t.logoURI,
      })
    })
    options.push({
      id: 'custom',
      label: 'Search',
      icon: undefined,
    })
    return options
  })

  /** Id of the currently selected dropdown option (native | usdc | address | custom) */
  const selectedTargetOptionId = computed(() => {
    if (targetAssetMode.value === 'native') return 'native'
    if (targetAssetMode.value === 'usdc') return 'usdc'
    if (targetAssetMode.value === 'custom' && resolvedCustomToken.value)
      return resolvedCustomToken.value.address
    return 'custom'
  })

  const selectTargetAsset = (modeOrAddress: string) => {
    needsTargetTokenSelection.value = false
    if (modeOrAddress === 'native' || modeOrAddress === 'usdc') {
      targetAssetMode.value = modeOrAddress
      return
    }
    if (modeOrAddress === 'custom') {
      targetAssetMode.value = 'custom'
      resolvedCustomToken.value = null
      return
    }
    const chainId = targetChainId.value
    if (chainId === null) return
    const common = getCommonTokens(chainId)
    const token = common.find(t => t.address.toLowerCase() === modeOrAddress.toLowerCase())
    if (token) {
      targetAssetMode.value = 'custom'
      resolvedCustomToken.value = {
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
      }
    }
  }

  const selectCustomToken = (token: ResolvedToken) => {
    needsTargetTokenSelection.value = false
    targetAssetMode.value = 'custom'
    resolvedCustomToken.value = token
  }

  const { copy: copyAddress, copiedValue: copiedAddress } = useCopyToClipboard({
    clearAfterMs: 2000,
  })
  const shortenAddress = shortenAddressUtil

  return {
    // chains
    chainBalances,
    chainsByBalance,
    showTargetChainFilter,
    selectedTargetChainIds,
    selectedTargetChainDisplay,
    isTargetChainSelected,
    onToggleTargetChain,
    onClearTargetChain,

    // target
    targetChainId,
    targetAssetMode,
    customTokenAddressInput,
    resolvedCustomToken,
    isResolvingCustomToken,
    customTokenError,
    resolveCustomToken,
    targetTokenAddress,
    targetTokenLabel,
    targetAssetOptions,
    selectedTargetOptionId,
    selectTargetAsset,
    selectCustomToken,
    needsTargetTokenSelection,
    dismissTargetTokenSelectionPrompt,

    // misc
    gasTokenName,
    copiedAddress,
    shortenAddress,
    copyAddress,
    getChainIconUrl,
  }
}
