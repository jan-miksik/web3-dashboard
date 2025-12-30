<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDustSweeper } from '~/composables/useDustSweeper'
import { useBatchSweeper, BATCH_SUPPORTED_WALLETS } from '~/composables/useBatchSweeper'
import { useAccount } from '@wagmi/vue'
import { CHAIN_METADATA } from '~/utils/chains'
import { getUSDCAddress, getGasTokenName } from '~/utils/tokenAddresses'
import { handleError } from '~/utils/error-handler'

const { address } = useAccount()

const { selectedDustTokens, getSweepRoute, executeRoute, isSweeping, sweepStatus, refetchTokens } =
  useDustSweeper()
const {
  executeBatchSweep,
  isBatching,
  batchStatus,
  supportsBatching,
  isCheckingSupport,
  checkBatchingSupport,
} = useBatchSweeper()

const selectedChainId = ref(8453) // Base
const selectedTokenSymbol = ref<'ETH' | 'USDC'>('ETH')
const useBatching = ref(true)

// Check batching support on mount and when wallet connects
onMounted(() => {
  if (address.value) {
    checkBatchingSupport(selectedChainId.value)
  }
})

watch(address, newAddress => {
  if (newAddress) {
    checkBatchingSupport(selectedChainId.value)
  }
})

watch(selectedChainId, () => {
  if (address.value) {
    checkBatchingSupport(selectedChainId.value)
  }
})

// Cleanup copy timeout on unmount
onUnmounted(() => {
  if (copyTimeout) {
    clearTimeout(copyTimeout)
    copyTimeout = null
  }
})

// Show info message when batching is not supported
const showBatchingInfo = computed(() => {
  return supportsBatching.value === false && address.value && !isCheckingSupport.value
})

// Use all supported chains from CHAIN_METADATA
const targetChains = CHAIN_METADATA.map(chain => ({
  id: chain.id,
  name: chain.name,
}))

const totalValue = computed(() => {
  return selectedDustTokens.value.reduce((sum, t) => sum + t.usdValue, 0)
})

// Get gas token name for selected chain
const gasTokenName = computed(() => {
  return getGasTokenName(selectedChainId.value)
})

// Get USDC address for selected chain
const usdcAddress = computed(() => {
  return getUSDCAddress(selectedChainId.value)
})

// Shorten address function (same as in tokens table)
function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Copy functionality
const isCopied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

async function copyAddress() {
  if (usdcAddress.value) {
    try {
      await navigator.clipboard.writeText(usdcAddress.value)
      isCopied.value = true

      if (copyTimeout) {
        clearTimeout(copyTimeout)
      }

      copyTimeout = setTimeout(() => {
        isCopied.value = false
      }, 2000)
    } catch (error) {
      handleError(error, {
        message: 'Failed to copy address to clipboard',
        context: { address: usdcAddress.value },
        showNotification: true,
      })
    }
  }
}

const onSweep = async () => {
  if (useBatching.value) {
    try {
      await executeBatchSweep(
        selectedChainId.value,
        selectedDustTokens.value,
        selectedTokenSymbol.value
      )
      // Refetch balances to update UI after successful batch
      await refetchTokens()
    } catch (error) {
      console.error('Batch sweep failed:', error)
      handleError(error, {
        message: error instanceof Error ? error.message : 'Batch transaction failed',
        context: {
          chainId: selectedChainId.value,
          tokenCount: selectedDustTokens.value.length,
        },
        showNotification: true,
      })
    }
    return
  }

  // Basic implementation: Loop through selected tokens and execute one by one (or batch if possible)
  // LiFi supports 'ContractCalls' for batching but usually requires a smart wallet or efficient routing.
  // For MVP with EOA, we will iterate. Ideally we'd group by chain and batch there.
  // "Sweeper" implies batching.
  // CURRENT LIMITATION: EOA requires 1 sign per tx unless using 4337 or similar.
  // We will sequentially execute for now to demonstrate the flow.
  isSweeping.value = true
  console.log('Starting sweep process...')

  try {
    for (const token of selectedDustTokens.value) {
      console.log(`Processing token: ${token.symbol} on chain ${token.chainId}`)
      sweepStatus.value = `Sweeping ${token.symbol}...`

      // Map target address based on chain
      let targetAddress = '0x0000000000000000000000000000000000000000' // ETH
      if (selectedTokenSymbol.value === 'USDC') {
        targetAddress = getUSDCAddress(selectedChainId.value)
      }

      console.log(
        `Requesting route for ${token.symbol} -> ${targetAddress} on chain ${selectedChainId.value}`
      )
      const route = await getSweepRoute(token, selectedChainId.value, targetAddress, address.value!)

      if (route) {
        console.log(`Route found for ${token.symbol}, executing...`)
        await executeRoute(route)
        console.log(`Execution complete for ${token.symbol}`)
      } else {
        console.warn(`No route for ${token.symbol}`)
      }
    }
    sweepStatus.value = 'Sweep Complete!'
    console.log('Sweep process finished successfully')
    // Refetch balances to update UI
    await refetchTokens()
  } catch (e) {
    console.error('Sweep failed with error:', e)
    sweepStatus.value = 'Failed'
  } finally {
    isSweeping.value = false
    console.log('Sweep process ended')
  }
}
</script>

<template>
  <div class="sweep-widget">
    <div class="summary">
      <div class="stat">
        <label>Selected Tokens</label>
        <span class="value">{{ selectedDustTokens.length }}</span>
      </div>
      <div class="stat">
        <label>Total Value</label>
        <span class="value">${{ totalValue.toFixed(2) }}</span>
      </div>
    </div>

    <div class="controls">
      <div class="control-group">
        <label>Target Chain</label>
        <select v-model="selectedChainId">
          <option v-for="c in targetChains" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <div class="control-group target-asset-group">
        <label>Target Asset</label>
        <select v-model="selectedTokenSymbol">
          <option value="ETH">{{ gasTokenName }} (Native token)</option>
          <option value="USDC">USDC</option>
        </select>
        <button
          v-if="
            selectedTokenSymbol === 'USDC' &&
            usdcAddress !== '0x0000000000000000000000000000000000000000'
          "
          class="address-button"
          :class="{ copied: isCopied }"
          :title="isCopied ? 'Copied!' : 'Copy address'"
          @click="copyAddress"
        >
          <span class="address-value">{{ shortenAddress(usdcAddress) }}</span>
          <svg
            v-if="!isCopied"
            class="copy-icon"
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1"
              stroke="currentColor"
              stroke-width="1.25"
              fill="none"
            />
            <path
              d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3.5C2.67157 2 2 2.67157 2 3.5V9C2 9.82843 2.67157 10.5 3.5 10.5H5.5"
              stroke="currentColor"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else
            class="copy-icon check-icon"
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 8L6.5 11.5L13 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <div v-else-if="selectedTokenSymbol === 'ETH'" class="gas-token-note">
          Gas token (no contract address)
        </div>
      </div>

      <div class="control-group">
        <div v-if="isCheckingSupport" class="checking-status">
          <span class="spinner-xs"></span> Checking wallet...
        </div>
        <div v-else-if="supportsBatching" class="checkbox-group">
          <label>
            <input v-model="useBatching" type="checkbox" />
            <span>Batch Transaction</span>
          </label>
        </div>
      </div>

      <div v-if="showBatchingInfo" class="info-message">
        <div class="info-icon">ℹ️</div>
        <div class="info-content">
          <strong>Sequential Sweeping Mode</strong>
          <p>
            Your wallet doesn't support batch transactions. Transactions will be executed one by
            one.
          </p>
          <p class="info-suggestion">
            For faster batch transactions, consider using:
            <span
              v-for="(wallet, index) in BATCH_SUPPORTED_WALLETS"
              :key="wallet.name"
              class="wallet-link"
            >
              <a :href="wallet.url" target="_blank" rel="noopener noreferrer">{{ wallet.name }}</a
              >{{ index < BATCH_SUPPORTED_WALLETS.length - 1 ? ',' : '' }}
            </span>
          </p>
        </div>
      </div>

      <button
        class="sweep-btn"
        :disabled="selectedDustTokens.length === 0 || isSweeping || isBatching || isCheckingSupport"
        @click="onSweep"
      >
        <span v-if="isSweeping || isBatching || isCheckingSupport" class="spinner-sm"></span>
        {{
          isCheckingSupport
            ? 'Checking wallet...'
            : isSweeping
              ? sweepStatus
              : isBatching
                ? batchStatus
                : supportsBatching && useBatching && selectedDustTokens.length >= 2
                  ? 'Batch Sweep'
                  : 'Sweep Dust'
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sweep-widget {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  position: sticky;
  top: 24px;
}

.summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat .value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.target-asset-group {
  margin-bottom: 16px;
}

.control-group label {
  font-size: 14px;
  color: var(--text-secondary);
}

select {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
}

.sweep-btn {
  background: mediumseagreen;
  color: white;
  border: none;
  padding: 8px 32px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(60, 179, 113, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
}

.sweep-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(60, 179, 113, 0.5);
  filter: brightness(1.1);
}

.sweep-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.3);
}

.sweep-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.sequential-mode {
  display: flex;
  align-items: center;
}

.sequential-mode label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: default;
}

.spinner-sm {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
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

.checking-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.info-message {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.info-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-content strong {
  color: var(--text-primary);
  font-weight: 600;
}

.info-content p {
  margin: 0;
  color: var(--text-secondary);
}

.info-suggestion {
  font-size: 12px;
  margin-top: 4px;
}

.wallet-link {
  margin-left: 4px;
}

.wallet-link a {
  color: #3b82f6;
  text-decoration: underline;
  font-weight: 500;
}

.wallet-link a:hover {
  color: #2563eb;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.address-button {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
  min-width: 0;
}

.address-button:hover {
  opacity: 0.8;
}

.address-button.copied {
  color: var(--success);
}

.address-button.copied .address-value {
  color: var(--success);
  font-weight: 600;
}

.address-value {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  min-width: 0;
}

.gas-token-note {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.copy-icon {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.7;
  transition: all 0.2s;
}

.address-button:hover .copy-icon {
  color: var(--text-secondary);
  opacity: 1;
}

.address-button.copied .copy-icon {
  color: var(--success);
  opacity: 1;
}

.check-icon {
  stroke-width: 2;
}
</style>
