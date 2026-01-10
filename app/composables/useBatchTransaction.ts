import { ref, watch, computed } from 'vue'
import { useConnectorClient, useAccount, useConfig } from '@wagmi/vue'
import { getPublicClient, getWalletClient } from '@wagmi/core'
import { encodeFunctionData, type Address, type Hex, type Chain } from 'viem'
import { sendCalls, getCapabilities } from 'viem/actions'
import { logger } from '~/utils/logger'

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

export interface BatchCapabilities {
  walletType: WalletType
  supportsEIP7702: boolean
  supportsEIP5792: boolean
  preferredMethod: BatchMethod
  sendCallsVersion: string | null
}

export interface BatchTransactionResult {
  success: boolean
  method: BatchMethod
  txHash?: Hex
  batchId?: string
  error?: Error
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
  const { address, chainId } = useAccount()
  const config = useConfig()

  // #region agent log
  const __agentLog = (
    hypothesisId: string,
    location: string,
    message: string,
    data: Record<string, unknown>
  ) => {
    const addr = address.value
    const addrSuffix = typeof addr === 'string' && addr.length >= 6 ? addr.slice(-6) : null
    const p = fetch('http://127.0.0.1:7242/ingest/a8fe3ba7-9e8e-4e50-a07f-d2b5a0c733d9', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId,
        location,
        message,
        data: { ...data, addrSuffix },
        timestamp: Date.now(),
      }),
    })
    // Some test environments stub `fetch` to a non-Promise return; guard to avoid throwing.
    ;(p as any)?.catch?.(() => {})
  }
  // #endregion agent log

  // State
  const isDetecting = ref(false)
  const walletType = ref<WalletType>('unknown')
  const capabilities = ref<BatchCapabilities | null>(null)
  const isPending = ref(false)
  const status = ref('')
  const error = ref<Error | null>(null)

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
      // #region agent log
      const codeHex = typeof code === 'string' ? code : ''
      const codeNo0x = codeHex.startsWith('0x') ? codeHex.slice(2) : codeHex
      const codePrefix = codeHex.slice(0, 12)
      const codeLen = codeHex.length
      // EIP-7702 delegation designator is expected to start with 0xef0100 (then 20-byte address)
      const looksLike7702Delegation = codeNo0x.toLowerCase().startsWith('ef0100')
      __agentLog('A', 'useBatchTransaction.ts:detectWalletType', 'getCode result', {
        chainId: chainId.value ?? null,
        codePrefix,
        codeLen,
        looksLike7702Delegation,
      })
      // #endregion agent log

      // If no code, it's a pure EOA
      if (!code || code === '0x') {
        return 'eoa'
      }

      // IMPORTANT: EIP-7702 adds a delegation designator as the account "code".
      // This is still an EOA and must be treated as such for batching logic.
      if (looksLike7702Delegation) {
        // #region agent log
        __agentLog(
          'A',
          'useBatchTransaction.ts:detectWalletType',
          'classified as EOA due to EIP-7702 delegation designator',
          { chainId: chainId.value ?? null }
        )
        // #endregion agent log
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
      // #region agent log
      __agentLog('B', 'useBatchTransaction.ts:detectWalletType', 'getCode threw', {
        chainId: chainId.value ?? null,
        errorName: (e as any)?.name ?? null,
        errorMessage: String((e as any)?.message ?? ''),
      })
      // #endregion agent log
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
        console.log('Full wallet capabilities:', JSON.stringify(caps, null, 2))

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
        // #region agent log
        __agentLog(
          'D',
          'useBatchTransaction.ts:checkEIP7702Support',
          'wallet_getCapabilities failed',
          {
            errorName: (capError as any)?.name ?? null,
            errorCode: (capError as any)?.code ?? null,
            errorMessage: String((capError as any)?.message ?? ''),
          }
        )
        // #endregion agent log
      }

      // Method 4: Try to call wallet_signAuthorization to probe support
      try {
        // Send an intentionally invalid request to see if the method exists
        await walletClient.value.request({
          method: 'wallet_signAuthorization' as any,
          params: [],
        })
        // If we get here without "method not found", method exists
        // #region agent log
        __agentLog(
          'C',
          'useBatchTransaction.ts:checkEIP7702Support',
          'wallet_signAuthorization probe: method exists',
          {}
        )
        // #endregion agent log
        return true
      } catch (probeError: any) {
        const code = probeError?.code
        const msg = String(probeError?.message ?? '').toLowerCase()

        // -32601 = method not found
        if (code === -32601 || msg.includes('method not found') || msg.includes('not supported')) {
          logger.info('wallet_signAuthorization not available')
          // #region agent log
          __agentLog(
            'C',
            'useBatchTransaction.ts:checkEIP7702Support',
            'wallet_signAuthorization probe: not available',
            { errorCode: code ?? null, errorMessage: String(probeError?.message ?? '') }
          )
          // #endregion agent log
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
          // #region agent log
          __agentLog(
            'C',
            'useBatchTransaction.ts:checkEIP7702Support',
            'wallet_signAuthorization probe: params-invalid => exists',
            { errorCode: code ?? null, errorMessage: String(probeError?.message ?? '') }
          )
          // #endregion agent log
          return true
        }
      }

      return false
    } catch (e) {
      logger.warn('Failed to check EIP-7702 support', { error: e })
      // #region agent log
      __agentLog('D', 'useBatchTransaction.ts:checkEIP7702Support', 'unexpected error', {
        errorName: (e as any)?.name ?? null,
        errorMessage: String((e as any)?.message ?? ''),
      })
      // #endregion agent log
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
      console.log('[BatchTransaction] EIP-5792 check: No wallet client or address')
      return { supported: false, version: null }
    }

    try {
      console.log('[BatchTransaction] Calling getCapabilities for EIP-5792...')
      const caps = await getCapabilities(walletClient.value, {
        account: address.value,
      })

      console.log(
        '[BatchTransaction] EIP-5792 capabilities received:',
        JSON.stringify(caps, null, 2)
      )
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
      console.log('[BatchTransaction] No chain capability found, probing sendCalls versions...')
      const probedVersion = await probeSendCallsVersion()
      console.log('[BatchTransaction] Probed sendCalls version:', probedVersion)
      return {
        supported: !!probedVersion,
        version: probedVersion,
      }
    } catch (err) {
      // Wallet doesn't support getCapabilities, try probing
      console.log('[BatchTransaction] getCapabilities failed, probing sendCalls versions...', err)
      // #region agent log
      __agentLog('B', 'useBatchTransaction.ts:checkEIP5792Support', 'getCapabilities failed', {
        errorName: (err as any)?.name ?? null,
        errorCode: (err as any)?.code ?? null,
        errorMessage: String((err as any)?.message ?? ''),
      })
      // #endregion agent log
      const probedVersion = await probeSendCallsVersion()
      console.log('[BatchTransaction] Probed sendCalls version:', probedVersion)
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

    console.log('[BatchTransaction] Starting capability detection...', {
      address: address.value,
      chainId: chainId.value,
      targetChainId,
      hasWalletClient: !!walletClient.value,
    })
    // #region agent log
    __agentLog('B', 'useBatchTransaction.ts:detectCapabilities', 'entry', {
      chainId: chainId.value ?? null,
      targetChainId: targetChainId ?? null,
      hasWalletClient: !!walletClient.value,
    })
    // #endregion agent log

    try {
      // Detect wallet type first
      const type = await detectWalletType()
      walletType.value = type
      console.log('[BatchTransaction] Wallet type detected:', type)

      // Check EIP-7702 support (for EOAs and unknown types)
      // We check for unknown too in case getCode failed but wallet still supports 7702
      const eip7702 = type === 'eoa' || type === 'unknown' ? await checkEIP7702Support() : false
      console.log('[BatchTransaction] EIP-7702 support:', eip7702)

      // Check EIP-5792 support (for SCWs and fallback)
      const eip5792 = await checkEIP5792Support(targetChainId)
      console.log('[BatchTransaction] EIP-5792 support:', eip5792)

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

      const caps: BatchCapabilities = {
        walletType: type,
        supportsEIP7702: eip7702,
        supportsEIP5792: eip5792.supported,
        preferredMethod,
        sendCallsVersion: eip5792.version,
      }

      capabilities.value = caps

      console.log('[BatchTransaction] Final capabilities:', caps)
      logger.info('Batch capabilities detected', { ...caps })

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

      // 4. Wait for receipt
      const pc = getPublicClient(config, { chainId: chain.id })
      if (pc) {
        await pc.waitForTransactionReceipt({ hash })
      }

      status.value = 'Batch complete!'

      return {
        success: true,
        method: 'eip7702',
        txHash: hash,
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

      return {
        success: true,
        method: 'eip5792',
        batchId: String(result),
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

      // Wait for confirmation before next tx
      if (pc) {
        await pc.waitForTransactionReceipt({ hash })
      }
    }

    status.value = 'All transactions complete!'

    return {
      success: true,
      method: 'sequential',
      txHash: hashes[hashes.length - 1],
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
      detectCapabilities()
    } else {
      capabilities.value = null
      walletType.value = 'unknown'
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

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isDetecting,
    walletType,
    capabilities,
    isPending,
    status,
    error,

    // Computed
    supportsBatching,
    batchMethod,
    isEOA,
    isSmartWallet,

    // Methods
    detectCapabilities,
    detectWalletType,
    executeBatch,
    executeWithEIP7702,
    executeWithEIP5792,
    executeSequentially,
    signEIP7702Authorization,
  }
}
