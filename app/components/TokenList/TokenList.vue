<script setup lang="ts">
import { useTokenList } from '~/composables/useTokenList'
import TokenTable from './TokenTable.vue'

const {
  // Data
  tokens,
  isLoading,
  error,
  hasAddress,
  showLowValueAssets,
  selectedChainIds,
  showChainFilter,
  isRefreshing,
  copiedAddress,
  chainsWithAssets,
  chainsWithoutAssets,
  highValueTokens,
  lowValueTokens,
  filteredTokens,
  filteredTotalUsdValue,
  hasLowValueAssets,
  hasHighValueAssets,
  selectedChainsDisplay,

  // Actions
  refetch,
  handleRefresh,
  copyTokenAddress,
  toggleChain,
  isChainSelected,
  getChainIcon,
  handleClickAllNetworks,
  shortenAddress,

  // Formatting
  formatBalance,
  formatUsdValue,
  formatUsdValueExpanded,
  formatTotalValue,
} = useTokenList()
</script>

<template>
  <div class="card token-list" data-testid="token-list">
    <TokenListHeader
      :filtered-total-usd-value="filteredTotalUsdValue"
      :has-address="hasAddress"
      :chains-with-assets="chainsWithAssets"
      :chains-without-assets="chainsWithoutAssets"
      :selected-chain-ids="selectedChainIds"
      :selected-chains-display="selectedChainsDisplay"
      :show-chain-filter="showChainFilter"
      :is-loading="isLoading"
      :is-refreshing="isRefreshing"
      :is-chain-selected="isChainSelected"
      :on-format-total-value="formatTotalValue"
      :on-toggle-chain="toggleChain"
      :on-click-all-networks="handleClickAllNetworks"
      :on-refresh="handleRefresh"
      @update:show-chain-filter="showChainFilter = $event"
    />

    <TokenListStates
      :has-address="hasAddress"
      :error="error"
      :is-loading="isLoading"
      :tokens-length="tokens.length"
      :filtered-tokens-length="filteredTokens.length"
      :show-low-value-assets="showLowValueAssets"
      :selected-chain-ids-size="selectedChainIds.size"
      @retry="refetch"
    />

    <TokenTable
      v-if="hasAddress && !error && !isLoading && filteredTokens.length > 0"
      :high-value-tokens="highValueTokens"
      :low-value-tokens="lowValueTokens"
      :show-low-value-assets="showLowValueAssets"
      :has-low-value-assets="hasLowValueAssets"
      :has-high-value-assets="hasHighValueAssets"
      :is-loading="isLoading"
      :is-refreshing="isRefreshing"
      :copied-address="copiedAddress"
      :on-copy-address="copyTokenAddress"
      :on-shorten-address="shortenAddress"
      :on-format-usd-value-expanded="formatUsdValueExpanded"
      :on-format-balance="formatBalance"
      :on-get-chain-icon="getChainIcon"
      @update:show-low-value-assets="showLowValueAssets = $event"
    />
  </div>
</template>

<style scoped>
.token-list {
  min-height: 300px;
}
</style>
