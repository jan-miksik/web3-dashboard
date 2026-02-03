import { ref, watch, computed } from 'vue'
import { useConnectorClient, useConnection, useConfig } from '@wagmi/vue'
import { getPublicClient, getWalletClient } from '@wagmi/core'
import { encodeFunctionData, type Address, type Hex, type Chain } from 'viem'
import { sendCalls, getCapabilities } from 'viem/actions'
import { logger } from '~/utils/logger'
import { formatWeiAsEth } from '~/utils/format'

// EIP-7702 Authorization type (compatible with viem's SignedAuthorization)
interface Authorization {
  chainId: number
  address: Address
  nonce: number
  r: Hex
  s: Hex
  yParity: number
}

// ============================================================================
// EIP-7702 Batch Executor Contract
// ============================================================================

/**
 * A canonical Batch Executor contract that can be delegated to via EIP-7702.
 * This contract allows EOAs to execute multiple calls atomically in a single tx.
 *
 */

// ERC-7821 Minimal Batch Executor (deployed via CREATE2 at same address on all chains)
export const BATCH_EXECUTOR_ADDRESS = '0x00000000000009F66F6BCb8B4F27AD39cE5E2c2b' as const

// Batch Executor ABI - simple multicall interface
// Using explicit ABI format since parseAbi doesn't support inline tuple syntax
const BATCH_EXECUTOR_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'payable',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
    ],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
] as const

// ============================================================================
// Types
// ============================================================================

export interface BatchCall {
  to: Address
  data: Hex
  value?: bigint
}

export type WalletType = 'eoa' | 'smart_contract' | 'unknown'

export type BatchMethod = 'eip7702' | 'eip5792' | 'sequential' | 'none'

export type WalletProvider = 'metamask' | 'rabby' | 'coinbase' | 'unknown'

// Wallet-specific batch limits (max transactions per batch)
export const WALLET_BATCH_LIMITS: Record<WalletProvider, number> = {
  metamask: 10, // MetaMask has a hard limit of 10 calls per batch
  rabby: 100, // Rabby has a higher limit
  coinbase: 50, // Coinbase Smart Wallet
  unknown: 10, // Safe default matching strictest limit (MetaMask)
}

export interface BatchCapabilities {
  walletType: WalletType
  walletProvider: WalletProvider
  supportsEIP7702: boolean
  supportsEIP5792: boolean
  preferredMethod: BatchMethod
  sendCallsVersion: string | null
  maxBatchSize: number
}

export interface BatchTransactionResult {
  success: boolean
  method: BatchMethod
  txHash?: Hex
  batchId?: string
  feeSummary?: string
  error?: Error
}

// ============================================================================
// Capabilities Cache (localStorage)
// ============================================================================

const BATCH_CAPABILITIES_CACHE_STORAGE_KEY = 'web3_dashboard_batch_caps_cache_v1'
const BATCH_CAPABILITIES_CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 1 day

type BatchCapabilitiesCacheEntry = {
  cachedAt: number
  caps: BatchCapabilities
}

type BatchCapabilitiesCacheStore = Record<string, BatchCapabilitiesCacheEntry>

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const cacheKeyFor = (provider: WalletProvider, addr: Address, cid: number) =>
  `${provider}:${addr.toLowerCase()}:eip155:${cid}`

const readCapsCache = (): BatchCapabilitiesCacheStore => {
  if (!isBrowser()) return {}
  try {
    const raw = localStorage.getItem(BATCH_CAPABILITIES_CACHE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as BatchCapabilitiesCacheStore
  } catch {
    return {}
  }
}

const writeCapsCache = (store: BatchCapabilitiesCacheStore) => {
  if (!isBrowser()) return
  try {
    localStorage.setItem(BATCH_CAPABILITIES_CACHE_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota / serialization errors
  }
}

const getCachedCaps = (
  provider: WalletProvider,
  addr: Address,
  cid: number
): BatchCapabilities | null => {
  const store = readCapsCache()
  const key = cacheKeyFor(provider, addr, cid)
  const entry = store[key]
  if (!entry) return null

  const age = Date.now() - Number(entry.cachedAt ?? 0)
  if (!Number.isFinite(age) || age > BATCH_CAPABILITIES_CACHE_TTL_MS) {
    delete store[key]
    writeCapsCache(store)
    return null
  }

  return entry.caps ?? null
}

const setCachedCaps = (
  provider: WalletProvider,
  addr: Address,
  cid: number,
  caps: BatchCapabilities
) => {
  const store = readCapsCache()
  const key = cacheKeyFor(provider, addr, cid)
  store[key] = { cachedAt: Date.now(), caps }
  writeCapsCache(store)
}

export const clearBatchCapabilitiesCache = () => {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(BATCH_CAPABILITIES_CACHE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

// ============================================================================
// EIP-5792 Version Detection
// ============================================================================

const PREFERRED_SEND_CALLS_VERSIONS = ['2.0.0', '1.0.0', '1.0'] as const

// ============================================================================
// Composable
// ============================================================================

export function useBatchTransaction() {
  const { data: walletClient } = useConnectorClient()
  const { address, chainId } = useConnection()
  const config = useConfig()

  // State
  const isDetecting = ref(false)
  const walletType = ref<WalletType>('unknown')
  const walletProvider = ref<WalletProvider>('unknown')
  const capabilities = ref<BatchCapabilities | null>(null)
  const isPending = ref(false)
  const status = ref('')
  const error = ref<Error | null>(null)

  // ============================================================================
  // Wallet Provider Detection
  // ============================================================================

  /**
   * Detects the wallet provider (MetaMask, Rabby, etc.)
   * This is important for knowing batch size limits.
   */
  const detectWalletProvider = (): WalletProvider => {
    if (!walletClient.value) return 'unknown'

    try {
      // Check connector info first (most reliable)
      const connector = (walletClient.value as any).connector
      const connectorName = String(connector?.name ?? '').toLowerCase()
      const connectorId = String(connector?.id ?? '').toLowerCase()

      // Try to get provider from walletClient (more reliable than window.ethereum)
      const provider = (walletClient.value as any).transport?.value?.provider
      const providerIsMetaMask = provider?.isMetaMask === true
      const providerIsRabby = provider?.isRabby === true
      const providerIsCoinbase = provider?.isCoinbaseWallet === true

      // Also check window.ethereum flags
      const win = typeof window !== 'undefined' ? (window as any) : null
      const windowIsMetaMask = win?.ethereum?.isMetaMask === true
      const windowIsRabby = win?.ethereum?.isRabby === true
      const windowIsCoinbase = win?.ethereum?.isCoinbaseWallet === true

      logger.info('Wallet provider detection', {
        connectorName,
        connectorId,
        providerIsMetaMask,
        providerIsRabby,
        providerIsCoinbase,
        windowIsMetaMask,
        windowIsRabby,
        windowIsCoinbase,
      })

      // MetaMask detection - check multiple sources
      if (
        connectorName.includes('metamask') ||
        connectorId.includes('metamask') ||
        connectorId === 'io.metamask' ||
        providerIsMetaMask
      ) {
        return 'metamask'
      }

      // For 'injected' connector, check window.ethereum
      // Note: Only use window.ethereum if provider check didn't work
      if (connectorId === 'injected' && windowIsMetaMask && !windowIsRabby) {
        return 'metamask'
      }

      // Rabby detection
      if (
        connectorName.includes('rabby') ||
        connectorId.includes('rabby') ||
        connectorId === 'io.rabby' ||
        providerIsRabby ||
        windowIsRabby
      ) {
        return 'rabby'
      }

      // Coinbase Wallet detection
      if (
        connectorName.includes('coinbase') ||
        connectorId.includes('coinbase') ||
        providerIsCoinbase ||
        windowIsCoinbase
      ) {
        return 'coinbase'
      }

      // If still unknown but using injected connector, default to conservative limit
      // Better to split more than fail
      if (connectorId === 'injected') {
        logger.warn('Unknown injected wallet, using conservative batch limit')
        return 'unknown'
      }

      return 'unknown'
    } catch (e) {
      logger.warn('Failed to detect wallet provider', { error: e })
      return 'unknown'
    }
  }

  // ============================================================================
  // Wallet Type Detection
  // ============================================================================

  /**
   * Detects if the connected wallet is an EOA or a Smart Contract Wallet.
   * Uses getCode to check if there's bytecode at the address.
   *
   * Note: With EIP-7702, an EOA can have temporary delegation code,
   * so we also check for specific patterns that indicate a permanent SCW.
   */
  const detectWalletType = async (): Promise<WalletType> => {
    const pc = chainId.value ? getPublicClient(config, { chainId: chainId.value }) : null
    if (!address.value || !pc) return 'unknown'

    try {
      const code = await pc.getCode({ address: address.value })
      // EIP-7702 delegation designator is expected to start with 0xef0100 (then 20-byte address)
      const codeHex = typeof code === 'string' ? code : ''
      const codeNo0x = codeHex.startsWith('0x') ? codeHex.slice(2) : codeHex
      const looksLike7702Delegation = codeNo0x.toLowerCase().startsWith('ef0100')

      // If no code, it's a pure EOA
      if (!code || code === '0x') {
        return 'eoa'
      }

      // IMPORTANT: EIP-7702 adds a delegation designator as the account "code".
      // This is still an EOA and must be treated as such for batching logic.
      if (looksLike7702Delegation) {
        return 'eoa'
      }

      // Check for known SCW patterns (Safe, etc.)
      // Safe proxy has a specific masterCopy pattern
      // ERC-1967 proxy pattern: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
      const isSafe = code.toLowerCase().includes('a619486e') // Safe's masterCopy selector
      const isProxy = code.length > 100 // Proxies typically have more bytecode

      if (isSafe || isProxy) {
        return 'smart_contract'
      }

      // If there's code but we can't identify it, assume smart contract
      // This is safer as SCWs should use their native batching
      return 'smart_contract'
    } catch (e) {
      logger.warn('Failed to detect wallet type', { error: e })
      return 'unknown'
    }
  }

  // ============================================================================
  // EIP-7702 Support Detection
  // ============================================================================

  /**
   * Checks if the wallet supports EIP-7702 authorization signing.
   * Rabby and modern wallets expose this via wallet_getCapabilities.
   */
  const checkEIP7702Support = async (): Promise<boolean> => {
    if (!walletClient.value || !address.value) return false

    try {
      // Method 1: Check if the wallet exposes signAuthorization method directly
      const hasSignAuth = typeof (walletClient.value as any).signAuthorization === 'function'
      if (hasSignAuth) {
        logger.info('Wallet supports EIP-7702 signAuthorization (direct method)')
        return true
      }

      // Method 2: Check via experimental_signAuthorization (older API)
      const hasExpSignAuth =
        typeof (walletClient.value as any).experimental_signAuthorization === 'function'
      if (hasExpSignAuth) {
        logger.info('Wallet supports experimental EIP-7702 signAuthorization')
        return true
      }

      // Method 3: Check capabilities for EIP-7702 support (Rabby uses this)
      try {
        const caps = await walletClient.value.request({
          method: 'wallet_getCapabilities' as any,
          params: [address.value],
        })

        logger.info('Wallet capabilities for EIP-7702 check', { capabilities: caps })

        if (caps && typeof caps === 'object') {
          // Check all chains for EIP-7702/delegation support
          for (const [chainKey, chainCaps] of Object.entries(caps as Record<string, any>)) {
            // Rabby may expose 7702 as "delegation" or "eip7702" capability
            const has7702 =
              chainCaps?.eip7702?.supported === true ||
              chainCaps?.delegation?.supported === true ||
              chainCaps?.['7702']?.supported === true ||
              String(chainCaps?.eip7702?.status ?? '').toLowerCase() === 'ready' ||
              String(chainCaps?.delegation?.status ?? '').toLowerCase() === 'ready'

            if (has7702) {
              logger.info('EIP-7702 supported via capabilities', { chainKey, chainCaps })
              return true
            }
          }
        }
      } catch (capError) {
        logger.warn('wallet_getCapabilities failed for EIP-7702 check', { error: capError })
      }

      // Method 4: Try to call wallet_signAuthorization to probe support
      try {
        // Send an intentionally invalid request to see if the method exists
        await walletClient.value.request({
          method: 'wallet_signAuthorization' as any,
          params: [],
        })
        // If we get here without "method not found", method exists
        return true
      } catch (probeError: any) {
        const code = probeError?.code
        const msg = String(probeError?.message ?? '').toLowerCase()

        // -32601 = method not found
        if (code === -32601 || msg.includes('method not found') || msg.includes('not supported')) {
          logger.info('wallet_signAuthorization not available')
          return false
        }

        // Other errors (invalid params, etc.) mean the method exists
        if (
          msg.includes('invalid') ||
          msg.includes('missing') ||
          msg.includes('required') ||
          msg.includes('params')
        ) {
          logger.info('EIP-7702 supported (wallet_signAuthorization method exists)')
          return true
        }
      }

      return false
    } catch (e) {
      logger.warn('Failed to check EIP-7702 support', { error: e })
      return false
    }
  }

  // ============================================================================
  // EIP-5792 Support Detection
  // ============================================================================

  /**
   * Checks if wallet supports EIP-5792 batching (wallet_sendCalls).
   * Probes `wallet_getCapabilities` first, then falls back to `wallet_sendCalls` version probing.
   */
  const checkEIP5792Support = async (
    targetChainId?: number
  ): Promise<{ supported: boolean; version: string | null }> => {
    if (!walletClient.value || !address.value) {
      return { supported: false, version: null }
    }

    try {
      const caps = await getCapabilities(walletClient.value, {
        account: address.value,
      })

      logger.info('EIP-5792 capabilities', { capabilities: caps })

      const chainToCheck = targetChainId ?? chainId.value
      const chainCap = chainToCheck ? getCapabilityForChain(caps, chainToCheck) : null

      if (chainCap) {
        const atomicReady = isAtomicBatchReady(chainCap)
        const version = extractSendCallsVersion(chainCap)

        if (atomicReady && version) {
          return { supported: true, version }
        }
      }

      // Fallback: probe for sendCalls support
      const probedVersion = await probeSendCallsVersion()
      return {
        supported: !!probedVersion,
        version: probedVersion,
      }
    } catch (_err) {
      // Wallet doesn't support getCapabilities, try probing
      const probedVersion = await probeSendCallsVersion()
      return {
        supported: !!probedVersion,
        version: probedVersion,
      }
    }
  }

  // Helper functions for EIP-5792 detection
  const parseCapabilityChainId = (key: string): number | null => {
    const trimmed = key.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('eip155:')) {
      const raw = trimmed.slice('eip155:'.length)
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }

    if (trimmed.startsWith('0x')) {
      const n = Number.parseInt(trimmed, 16)
      return Number.isFinite(n) ? n : null
    }

    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }

  const getCapabilityForChain = (capabilities: unknown, cid: number) => {
    if (!capabilities || typeof capabilities !== 'object') return undefined
    const entries = Object.entries(capabilities as Record<string, unknown>)
    for (const [key, cap] of entries) {
      const parsed = parseCapabilityChainId(key)
      if (parsed === cid) return cap as any
    }
    return undefined
  }

  const isAtomicBatchReady = (cap: any): boolean => {
    const status = String(cap?.atomic?.status ?? '').toLowerCase()
    const atomicStatusOk = status === 'ready' || status === 'supported' || status === 'enabled'
    const atomicBatchOk =
      cap?.atomicBatch?.supported === true ||
      String(cap?.atomicBatch?.status ?? '').toLowerCase() === 'ready' ||
      String(cap?.atomicBatch?.status ?? '').toLowerCase() === 'supported'
    return atomicStatusOk || atomicBatchOk
  }

  const extractSendCallsVersion = (cap: any): string | null => {
    const buckets = [cap?.atomic, cap?.atomicBatch, cap]
    for (const b of buckets) {
      if (!b || typeof b !== 'object') continue
      for (const key of ['supportedVersions', 'versions', 'version', 'supportedVersion']) {
        const v = (b as any)[key]
        if (Array.isArray(v) && v[0]) return String(v[0])
        if (typeof v === 'string') return v
      }
    }
    return null
  }

  const probeSendCallsVersion = async (): Promise<string | null> => {
    if (!walletClient.value || !address.value) return null

    for (const version of PREFERRED_SEND_CALLS_VERSIONS) {
      try {
        await walletClient.value.request({
          method: 'wallet_sendCalls',
          params: [{ version, from: address.value, calls: [] }],
        } as any)
        return version
      } catch (e: any) {
        if (e?.code === -32601) return null // Method not found
        if (/version not supported/i.test(e?.message ?? '')) continue
        if (/invalid params|missing|required/i.test(e?.message ?? '')) return version
      }
    }
    return null
  }

  // ============================================================================
  // Full Capability Detection
  // ============================================================================

  const detectCapabilities = async (targetChainId?: number): Promise<BatchCapabilities> => {
    isDetecting.value = true

    try {
      // Detect wallet provider first (for batch limits)
      const provider = detectWalletProvider()
      walletProvider.value = provider

      // Capabilities can be chain-dependent (EIP-5792), so cache per (provider, address, chainId)
      const addr = address.value
      const cid = targetChainId ?? chainId.value
      if (addr && cid) {
        const cached = getCachedCaps(provider, addr, cid)
        if (cached) {
          capabilities.value = cached
          walletType.value = cached.walletType
          walletProvider.value = cached.walletProvider
          logger.info('Batch capabilities cache hit', { provider, chainId: cid })
          return cached
        }
      }

      // Detect wallet type
      const type = await detectWalletType()
      walletType.value = type

      // Check EIP-7702 support (for EOAs and unknown types)
      // We check for unknown too in case getCode failed but wallet still supports 7702
      const eip7702 = type === 'eoa' || type === 'unknown' ? await checkEIP7702Support() : false

      // Check EIP-5792 support (for SCWs and fallback)
      const eip5792 = await checkEIP5792Support(targetChainId)

      // Determine preferred method
      let preferredMethod: BatchMethod = 'none'

      if ((type === 'eoa' || type === 'unknown') && eip7702) {
        // EOA with EIP-7702 support - best experience
        preferredMethod = 'eip7702'
      } else if (eip5792.supported) {
        // Wallet supports sendCalls - use it
        preferredMethod = 'eip5792'
      } else if (type === 'eoa' || type === 'unknown') {
        // EOA without batch support - will need sequential txs
        preferredMethod = 'sequential'
      } else {
        // SCW without sendCalls - might have native batching
        preferredMethod = 'sequential'
      }

      // Get max batch size based on wallet provider
      const maxBatchSize = WALLET_BATCH_LIMITS[provider]

      const caps: BatchCapabilities = {
        walletType: type,
        walletProvider: provider,
        supportsEIP7702: eip7702,
        supportsEIP5792: eip5792.supported,
        preferredMethod,
        sendCallsVersion: eip5792.version,
        maxBatchSize,
      }

      capabilities.value = caps

      logger.info('Batch capabilities detected', { ...caps })

      if (addr && cid) {
        setCachedCaps(provider, addr, cid, caps)
      }

      return caps
    } finally {
      isDetecting.value = false
    }
  }

  // ============================================================================
  // EIP-7702 Batch Execution
  // ============================================================================

  /**
   * Executes a batch of calls using EIP-7702 authorization.
   *
   * This signs an authorization delegating the EOA to the Batch Executor contract,
   * then sends a transaction that invokes the executor with all calls.
   *
   * The key benefit: msg.sender in all calls is the user's EOA address,
   * allowing approve + transfer in a single atomic transaction.
   */
  const executeWithEIP7702 = async (
    calls: BatchCall[],
    chain: Chain
  ): Promise<BatchTransactionResult> => {
    if (!walletClient.value || !address.value) {
      throw new Error('No wallet connected')
    }

    status.value = 'Preparing EIP-7702 authorization...'

    try {
      // 1. Sign authorization for delegation to Batch Executor
      const authorization = await signEIP7702Authorization(BATCH_EXECUTOR_ADDRESS)

      status.value = 'Encoding batch calls...'

      // 2. Encode the calls for the batch executor
      const batchData = encodeFunctionData({
        abi: BATCH_EXECUTOR_ABI,
        functionName: 'execute',
        args: [
          calls.map(c => ({
            to: c.to,
            value: c.value ?? 0n,
            data: c.data,
          })),
        ],
      })

      // Calculate total value needed
      const totalValue = calls.reduce((sum, c) => sum + (c.value ?? 0n), 0n)

      status.value = 'Sending batch transaction...'

      // 3. Get a properly typed wallet client
      const wc = await getWalletClient(config, { chainId: chain.id })
      if (!wc) {
        throw new Error('Failed to get wallet client')
      }

      // 4. Send the transaction with authorizationList
      const hash = await wc.sendTransaction({
        account: address.value,
        chain,
        to: address.value, // Send to self - the authorization makes us act as the executor
        data: batchData,
        value: totalValue,
        authorizationList: [authorization],
      })

      status.value = 'Waiting for confirmation...'

      // 4. Wait for receipt and compute fee
      let feeSummary: string | undefined
      const pc = getPublicClient(config, { chainId: chain.id })
      if (pc) {
        const receipt = await pc.waitForTransactionReceipt({ hash })
        const fee =
          receipt.gasUsed && receipt.effectiveGasPrice
            ? receipt.gasUsed * receipt.effectiveGasPrice
            : 0n
        feeSummary = formatWeiAsEth(fee)
      }

      status.value = 'Batch complete!'

      return {
        success: true,
        method: 'eip7702',
        txHash: hash,
        feeSummary,
      }
    } catch (e: any) {
      logger.error('EIP-7702 batch failed', e)
      throw e
    }
  }

  /**
   * Signs an EIP-7702 authorization for delegation.
   */
  const signEIP7702Authorization = async (contractAddress: Address): Promise<Authorization> => {
    if (!walletClient.value || !address.value || !chainId.value) {
      throw new Error('No wallet connected')
    }

    // Get a properly typed wallet client
    const wc = await getWalletClient(config, { chainId: chainId.value })
    if (!wc) {
      throw new Error('Failed to get wallet client')
    }

    // Try the standard signAuthorization method (viem 2.x+)
    if (typeof (wc as any).signAuthorization === 'function') {
      return await (wc as any).signAuthorization({
        account: address.value,
        contractAddress,
      })
    }

    // Try experimental method
    if (typeof (wc as any).experimental_signAuthorization === 'function') {
      return await (wc as any).experimental_signAuthorization({
        account: address.value,
        contractAddress,
      })
    }

    // Fallback: manually construct and sign the authorization
    // This requires the wallet to support eth_signTypedData_v4
    const chainIdValue = chainId.value
    const pc = getPublicClient(config, { chainId: chainIdValue })
    const nonce = pc ? await pc.getTransactionCount({ address: address.value }) : 0

    const authorizationData = {
      chainId: BigInt(chainIdValue),
      address: contractAddress,
      nonce: BigInt(nonce),
    }

    // Sign using EIP-712 typed data (authorization tuple signature)
    const signature = await wc.signTypedData({
      account: address.value,
      domain: {
        name: 'Authorization',
        version: '1',
        chainId: authorizationData.chainId,
      },
      types: {
        Authorization: [
          { name: 'chainId', type: 'uint256' },
          { name: 'address', type: 'address' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      primaryType: 'Authorization',
      message: {
        chainId: authorizationData.chainId,
        address: authorizationData.address,
        nonce: authorizationData.nonce,
      },
    })

    // Parse signature components
    const r = signature.slice(0, 66) as Hex
    const s = `0x${signature.slice(66, 130)}` as Hex
    const v = parseInt(signature.slice(130, 132), 16)
    // Normalize v to yParity: handle both legacy (27/28) and modern (0/1) signatures
    const yParity = v === 0 || v === 1 ? v : v === 27 ? 0 : 1

    return {
      chainId: Number(authorizationData.chainId),
      address: contractAddress,
      nonce: Number(authorizationData.nonce),
      r,
      s,
      yParity,
    }
  }

  // ============================================================================
  // EIP-5792 Batch Execution
  // ============================================================================

  /**
   * Executes a batch of calls using EIP-5792 sendCalls.
   * This is the standard for Smart Contract Wallets like Safe.
   */
  const executeWithEIP5792 = async (
    calls: BatchCall[],
    chain: Chain
  ): Promise<BatchTransactionResult> => {
    if (!walletClient.value || !address.value) {
      throw new Error('No wallet connected')
    }

    const version = capabilities.value?.sendCallsVersion ?? PREFERRED_SEND_CALLS_VERSIONS[0]

    status.value = 'Sending batch via wallet...'

    try {
      const result = await sendCalls(walletClient.value, {
        account: address.value,
        calls,
        chain,
        version,
      })

      status.value = 'Batch submitted!'

      const batchId =
        typeof result === 'object' && result != null && 'id' in result
          ? String((result as { id: string }).id)
          : typeof result === 'string'
            ? result
            : ''

      return {
        success: true,
        method: 'eip5792',
        batchId: batchId || undefined,
      }
    } catch (e: any) {
      if (e?.message?.includes('user rejected') || e?.code === 4001) {
        throw new Error('Transaction rejected by user')
      }
      throw e
    }
  }

  // ============================================================================
  // Sequential Execution (Fallback)
  // ============================================================================

  /**
   * Executes calls sequentially when batching is not supported.
   */
  const executeSequentially = async (
    calls: BatchCall[],
    chain: Chain,
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchTransactionResult> => {
    if (!walletClient.value || !address.value) {
      throw new Error('No wallet connected')
    }

    // Get properly typed clients
    const wc = await getWalletClient(config, { chainId: chain.id })
    if (!wc) {
      throw new Error('Failed to get wallet client')
    }
    const pc = getPublicClient(config, { chainId: chain.id })
    const hashes: Hex[] = []
    let totalFee = 0n

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]!
      status.value = `Executing ${i + 1}/${calls.length}...`
      onProgress?.(i + 1, calls.length)

      const hash = await wc.sendTransaction({
        account: address.value,
        chain,
        to: call.to,
        data: call.data,
        value: call.value,
      })

      hashes.push(hash)

      if (pc) {
        const receipt = await pc.waitForTransactionReceipt({ hash })
        if (receipt.gasUsed && receipt.effectiveGasPrice) {
          totalFee += receipt.gasUsed * receipt.effectiveGasPrice
        }
      }
    }

    status.value = 'All transactions complete!'

    return {
      success: true,
      method: 'sequential',
      txHash: hashes[hashes.length - 1],
      feeSummary: totalFee > 0n ? formatWeiAsEth(totalFee) : undefined,
    }
  }

  // ============================================================================
  // Main Execution Function
  // ============================================================================

  /**
   * Executes a batch of transactions using the best available method.
   *
   * Priority:
   * 1. EIP-7702 for EOAs (single signature, atomic execution)
   * 2. EIP-5792 for SCWs (wallet-native batching)
   * 3. Sequential execution (fallback)
   */
  const executeBatch = async (
    calls: BatchCall[],
    chain: Chain,
    options?: {
      forceMethod?: BatchMethod
      onProgress?: (current: number, total: number) => void
    }
  ): Promise<BatchTransactionResult> => {
    if (!walletClient.value || !address.value) {
      throw new Error('No wallet connected')
    }

    if (calls.length === 0) {
      throw new Error('No calls to execute')
    }

    isPending.value = true
    error.value = null

    try {
      // Ensure capabilities are detected
      if (!capabilities.value) {
        await detectCapabilities(chain.id)
      }

      const method = options?.forceMethod ?? capabilities.value?.preferredMethod ?? 'sequential'

      logger.info('Executing batch', {
        method,
        callCount: calls.length,
        chainId: chain.id,
      })

      let result: BatchTransactionResult

      switch (method) {
        case 'eip7702':
          result = await executeWithEIP7702(calls, chain)
          break
        case 'eip5792':
          result = await executeWithEIP5792(calls, chain)
          break
        case 'sequential':
        default:
          result = await executeSequentially(calls, chain, options?.onProgress)
          break
      }

      return result
    } catch (e: any) {
      error.value = e
      status.value = 'Failed'
      logger.error('Batch execution failed', e)
      throw e
    } finally {
      isPending.value = false
    }
  }

  // ============================================================================
  // Watchers
  // ============================================================================

  // Re-detect capabilities when wallet/address changes
  watch([walletClient, address], ([newClient, newAddress]) => {
    if (newClient && newAddress) {
      capabilities.value = null
      walletType.value = 'unknown'
      walletProvider.value = 'unknown'
      detectCapabilities()
    } else {
      capabilities.value = null
      walletType.value = 'unknown'
      walletProvider.value = 'unknown'
    }
  })

  // ============================================================================
  // Computed
  // ============================================================================

  const supportsBatching = computed(() => {
    if (!capabilities.value) return null
    return capabilities.value.supportsEIP7702 || capabilities.value.supportsEIP5792
  })

  const batchMethod = computed(() => capabilities.value?.preferredMethod ?? 'none')

  const isEOA = computed(() => walletType.value === 'eoa')
  const isSmartWallet = computed(() => walletType.value === 'smart_contract')

  const maxBatchSize = computed(
    () => capabilities.value?.maxBatchSize ?? WALLET_BATCH_LIMITS.unknown
  )

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isDetecting,
    walletType,
    walletProvider,
    capabilities,
    isPending,
    status,
    error,

    // Computed
    supportsBatching,
    batchMethod,
    maxBatchSize,
    isEOA,
    isSmartWallet,

    // Methods
    clearBatchCapabilitiesCache,
    detectCapabilities,
    detectWalletType,
    detectWalletProvider,
    executeBatch,
    executeWithEIP7702,
    executeWithEIP5792,
    executeSequentially,
    signEIP7702Authorization,
  }
}
