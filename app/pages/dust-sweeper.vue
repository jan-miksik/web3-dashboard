<script setup lang="ts">
import { useDustSweeper } from '~/composables/useDustSweeper'
import TokenList from '~/components/dust-sweeper/TokenList.vue'
import SweepWidget from '~/components/dust-sweeper/SweepWidget.vue'

const { dustTokens, isLoadingTokens, dustThreshold, selectedTokenIds, toggleToken } =
  useDustSweeper()
</script>

<template>
  <div class="dust-sweeper-page">
    <div class="warning-banner">
      <div class="warning-icon">⚠️</div>
      <div class="warning-content">
        <strong>Development & Testing</strong>
        <p>
          This tool is still under active development and testing. Please use with caution and only
          with amounts you're comfortable with. Always verify transactions before confirming.
        </p>
      </div>
    </div>

    <div class="page-header">
      <h1 class="title">Dust Sweeper</h1>
      <p class="subtitle">
        Sweep your crypto dust into clean assets. Minimally invasive, maximally efficient.
      </p>
    </div>

    <div class="threshold-control">
      <label>Dust Threshold:</label>
      <input v-model="dustThreshold" type="number" min="1" max="100" />
      <span>USD</span>
    </div>

    <div v-if="isLoadingTokens" class="loading">
      <div class="spinner"></div>
      Loading dust...
    </div>

    <div v-else class="content-grid">
      <div class="left-col">
        <TokenList :tokens="dustTokens" :selected-ids="selectedTokenIds" @toggle="toggleToken" />
      </div>
      <div class="right-col">
        <SweepWidget />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dust-sweeper-page {
  max-width: 1200px;
  margin: 0 auto;
}

.warning-banner {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 12px;
  margin-bottom: 24px;
  align-items: flex-start;
}

.warning-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.warning-content strong {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
}

.warning-content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.page-header {
  margin-bottom: 32px;
}

.title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(90deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 16px;
}

.threshold-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.threshold-control input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-primary);
  width: 80px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 32px;
}

@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 16px;
  color: var(--text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
