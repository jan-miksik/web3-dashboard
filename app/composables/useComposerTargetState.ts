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
  const targetAssetMode = ref<TargetAssetMode>('native')
  const customTokenAddressInput = ref('')

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
    if (targetChainId.value === null) return 'Select target'
    if (targetAssetMode.value === 'native') return `${gasTokenName.value} (Native)`
    if (targetAssetMode.value === 'usdc') return 'USDC'
    if (resolvedCustomToken.value) {
      return `${resolvedCustomToken.value.symbol} (${resolvedCustomToken.value.name})`
    }
    return 'Custom token'
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

    // misc
    gasTokenName,
    copiedAddress,
    shortenAddress,
    copyAddress,
    getChainIconUrl,
  }
}
