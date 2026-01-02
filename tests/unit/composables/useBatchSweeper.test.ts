import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useBatchSweeper } from '../../../app/composables/useBatchSweeper'

const mockGetCode = vi.fn()

vi.mock('@wagmi/vue', () => ({
  useConnectorClient: vi.fn(),
  useAccount: vi.fn(),
  useConnection: vi.fn(),
  useConfig: vi.fn(),
  useSwitchChain: vi.fn(),
}))

vi.mock('@wagmi/core', () => ({
  getPublicClient: vi.fn(() => ({
    getCode: mockGetCode,
    getTransactionCount: vi.fn().mockResolvedValue(0),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
  })),
  getWalletClient: vi.fn(() =>
    Promise.resolve({
      sendTransaction: vi.fn().mockResolvedValue('0x123'),
      signTypedData: vi.fn().mockResolvedValue('0x' + '00'.repeat(65)),
    })
  ),
}))

vi.mock('viem/actions', () => ({
  getCapabilities: vi.fn(),
  sendCalls: vi.fn(),
}))

vi.mock('~/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('./../../../app/composables/useDustSweeper', () => ({
  useDustSweeper: () => ({
    getSweepRoute: vi.fn(),
    executeRoute: vi.fn(),
  }),
}))

describe('useBatchSweeper - sendCalls version negotiation', () => {
  const mockWalletClientRequest = vi.fn()

  const mockWalletClient = {
    chain: { id: 1 },
    request: mockWalletClientRequest,
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetCode.mockResolvedValue('0x') // Default to EOA

    const wagmi = await import('@wagmi/vue')
    vi.mocked(wagmi.useConnectorClient).mockReturnValue({
      data: ref(mockWalletClient as any),
    } as any)
    vi.mocked(wagmi.useAccount).mockReturnValue({
      address: ref('0x1234567890123456789012345678901234567890'),
      chainId: ref(1),
    } as any)
    vi.mocked(wagmi.useConnection).mockReturnValue({
      isConnected: ref(true),
    } as any)
    vi.mocked(wagmi.useConfig).mockReturnValue({
      chains: [{ id: 1, name: 'Ethereum' }],
    } as any)
    vi.mocked(wagmi.useSwitchChain).mockReturnValue({
      switchChain: vi.fn(),
    } as any)
  })

  it('returns false when wallet_sendCalls method is not found', async () => {
    const { getCapabilities } = await import('viem/actions')
    vi.mocked(getCapabilities).mockRejectedValue(new Error('wallet_getCapabilities not supported'))

    mockWalletClientRequest.mockRejectedValue({ code: -32601, message: 'Method not found' })

    const { checkBatchingSupport, supportsBatching, sendCallsVersion } = useBatchSweeper()
    const caps = await checkBatchingSupport(1)

    // The new API returns capabilities object, not boolean
    expect(caps.supportsEIP5792).toBe(false)
    expect(supportsBatching.value).toBe(false)
    expect(sendCallsVersion.value).toBeNull()
  })

  it('falls back to v1 when v2 is not supported but method exists', async () => {
    const { getCapabilities } = await import('viem/actions')
    vi.mocked(getCapabilities).mockRejectedValue(new Error('wallet_getCapabilities not supported'))

    // v2 rejected as unsupported, v1 returns "invalid params" => method exists + version parsed
    mockWalletClientRequest.mockImplementation(({ params }: any) => {
      const version = params?.[0]?.version
      if (version === '2.0.0') {
        return Promise.reject({ message: 'Version not supported' })
      }
      if (version === '1.0.0') {
        return Promise.reject({ message: 'Invalid params' })
      }
      return Promise.reject({ message: 'Unexpected' })
    })

    const { checkBatchingSupport, supportsBatching, sendCallsVersion } = useBatchSweeper()
    const caps = await checkBatchingSupport(1)

    expect(caps.supportsEIP5792).toBe(true)
    expect(supportsBatching.value).toBe(true)
    expect(sendCallsVersion.value).toBe('1.0.0')
  })

  it('prefers version from capabilities when provided', async () => {
    const { getCapabilities } = await import('viem/actions')
    vi.mocked(getCapabilities).mockResolvedValue({
      // chain key style varies; we accept "1" here
      '1': {
        atomic: { status: 'ready', supportedVersions: ['1.0.0'] },
      },
    } as any)

    const { checkBatchingSupport, supportsBatching, sendCallsVersion } = useBatchSweeper()
    const caps = await checkBatchingSupport(1)

    expect(caps.supportsEIP5792).toBe(true)
    expect(supportsBatching.value).toBe(true)
    expect(sendCallsVersion.value).toBe('1.0.0')
    // Note: with new implementation, request may still be called for EIP-7702 check
    // so we only verify the capability detection worked
  })

  it('detects EOA wallet type correctly', async () => {
    const { getCapabilities } = await import('viem/actions')
    vi.mocked(getCapabilities).mockRejectedValue(new Error('not supported'))
    mockWalletClientRequest.mockRejectedValue({ code: -32601 })
    mockGetCode.mockResolvedValue('0x')

    const { checkBatchingSupport, walletType, isEOA } = useBatchSweeper()
    await checkBatchingSupport(1)

    expect(walletType.value).toBe('eoa')
    expect(isEOA.value).toBe(true)
  })

  it('detects smart contract wallet correctly', async () => {
    const { getCapabilities } = await import('viem/actions')
    vi.mocked(getCapabilities).mockResolvedValue({
      '1': {
        atomic: { status: 'ready', supportedVersions: ['1.0.0'] },
      },
    } as any)
    // Smart wallet has code at address
    mockGetCode.mockResolvedValue('0x608060405234801561001057600080fd5b506...')

    const { checkBatchingSupport, walletType, isSmartWallet } = useBatchSweeper()
    await checkBatchingSupport(1)

    expect(walletType.value).toBe('smart_contract')
    expect(isSmartWallet.value).toBe(true)
  })
})
