import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { getPublicClient } from '@wagmi/core'
import { useConfig, type Config } from '@wagmi/vue'
import { isAddress, parseAbi, zeroAddress, type Address } from 'viem'
import { CHAIN_METADATA, type ChainMetadata } from '~/utils/chains'
import { handleError } from '~/utils/error-handler'
import { getGasTokenName, getUSDCAddress } from '~/utils/tokenAddresses'
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

  const getChainIconUrl = (chainId: number): string | undefined => {
    return CHAIN_METADATA.find(c => c.id === chainId)?.icon
  }

  const targetAssetOptions = computed(() => {
    return [
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
  })

  const selectTargetAsset = (mode: TargetAssetMode) => {
    targetAssetMode.value = mode
  }

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
    selectTargetAsset,

    // misc
    gasTokenName,
    copiedAddress,
    shortenAddress,
    copyAddress,
    getChainIconUrl,
  }
}
