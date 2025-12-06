<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useConnection, useChainId, useSwitchChain } from '@wagmi/vue'
import type { Chain } from '@wagmi/vue/chains'
import { config } from '~/chains-config'

const { isConnected } = useConnection({ config })
const chainId = useChainId({ config })
const { switchChain, isPending: isSwitching } = useSwitchChain({ config })

const showNetworkMenu = ref(false)
const networkSelectorRef = ref<HTMLElement | null>(null)

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  11155111: 'Sepolia',
  137: 'Polygon',
  80002: 'Polygon Amoy',
  42161: 'Arbitrum One',
  421614: 'Arbitrum Sepolia',
  8453: 'Base',
  84532: 'Base Sepolia',
}

const networkStyles: Record<number, { color: string; bgColor: string }> = {
  1: { color: '#627eea', bgColor: 'rgba(98, 126, 234, 0.12)' },
  11155111: { color: '#627eea', bgColor: 'rgba(98, 126, 234, 0.12)' },
  137: { color: '#8247e5', bgColor: 'rgba(130, 71, 229, 0.12)' },
  80002: { color: '#8247e5', bgColor: 'rgba(130, 71, 229, 0.12)' },
  42161: { color: '#28a0f0', bgColor: 'rgba(40, 160, 240, 0.12)' },
  421614: { color: '#28a0f0', bgColor: 'rgba(40, 160, 240, 0.12)' },
  8453: { color: '#0052ff', bgColor: 'rgba(0, 82, 255, 0.12)' },
  84532: { color: '#0052ff', bgColor: 'rgba(0, 82, 255, 0.12)' },
}

const networkName = computed(() => {
  if (!chainId.value) return 'Unknown'
  return CHAIN_NAMES[chainId.value] || `Chain ${chainId.value}`
})

function getNetworkStyle(id: number | undefined) {
  if (!id) return { color: 'var(--text-secondary)', bgColor: 'var(--bg-tertiary)' }
  return networkStyles[id] || { color: 'var(--text-secondary)', bgColor: 'var(--bg-tertiary)' }
}

// Get available networks from the config
const availableNetworks = computed(() => config.chains as readonly Chain[])

async function handleSwitchChain(targetChainId: number) {
  if (targetChainId === chainId.value) {
    showNetworkMenu.value = false
    return
  }
  
  // try {
  //   await switchChain({ chainId: targetChainId })
  //   showNetworkMenu.value = false
  // } catch (error) {
  //   console.error('Failed to switch chain:', error)
  // }
}

function toggleNetworkMenu() {
  showNetworkMenu.value = !showNetworkMenu.value
}

// Close menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (networkSelectorRef.value && !networkSelectorRef.value.contains(target)) {
    showNetworkMenu.value = false
  }
}

// Listen for clicks outside
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div ref="networkSelectorRef" class="card network-selector">
    <div class="card-header">
      <h3 class="card-title">Network</h3>
    </div>

    <div v-if="isConnected" class="network-content">
      <div 
        class="current-network"
        :style="{ 
          background: getNetworkStyle(chainId).bgColor,
          borderColor: getNetworkStyle(chainId).color 
        }"
      >
        <span 
          class="network-dot" 
          :style="{ background: getNetworkStyle(chainId).color }"
        ></span>
        <span class="network-name">{{ networkName }}</span>
        <span v-if="chainId" class="chain-id">Chain ID: {{ chainId }}</span>
      </div>

      <div class="network-switcher">
        <button 
          class="switch-network-btn"
          :disabled="isSwitching"
          @click="toggleNetworkMenu"
        >
          <span v-if="isSwitching">Switching...</span>
          <span v-else>Switch Network</span>
        </button>

        <Transition name="dropdown">
          <div v-if="showNetworkMenu" class="network-menu">
            <button
              v-for="network in availableNetworks"
              :key="network.id"
              class="network-option"
              :class="{ active: network.id === chainId }"
              :disabled="network.id === chainId || isSwitching"
              @click="handleSwitchChain(network.id)"
            >
              <span 
                class="network-option-dot"
                :style="{ background: getNetworkStyle(network.id).color }"
              ></span>
              <span class="network-option-name">
                {{ CHAIN_NAMES[network.id] || network.name || `Chain ${network.id}` }}
              </span>
              <span v-if="network.id === chainId" class="network-option-check">✓</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <div v-else class="network-disconnected">
      <p class="text-secondary">Connect wallet to switch networks</p>
    </div>
  </div>
</template>

<style scoped>
.network-selector {
  min-height: 140px;
}

.network-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.current-network {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid;
}

.network-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.network-name {
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.chain-id {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.network-disconnected {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 0;
}

.network-switcher {
  position: relative;
}

.switch-network-btn {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.switch-network-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.switch-network-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.network-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.network-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.network-option:hover:not(:disabled) {
  background: var(--bg-hover);
}

.network-option.active {
  background: var(--accent-muted);
  color: var(--accent-primary);
}

.network-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.network-option-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.network-option-name {
  flex: 1;
  font-weight: 500;
}

.network-option-check {
  color: var(--accent-primary);
  font-weight: 600;
}

/* Dropdown transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
