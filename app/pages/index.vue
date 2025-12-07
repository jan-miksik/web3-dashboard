<script setup lang="ts">
// Dashboard page
</script>

<template>
  <div class="dashboard">
    <!-- Connect Wallet Modal -->
    <ConnectWalletModal />

    <div class="dashboard-grid">
      <!-- Top Row: Wallet Info -->
      <div class="grid-row info-row">
        <WalletInfo />
      </div>

      <!-- Main Row: Token List -->
      <div class="grid-row tokens-row">
        <TokenList />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.dashboard-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 455px;
  margin: auto;
}

.grid-row {
  display: grid;
  gap: 20px;
}

.info-row {
  grid-template-columns: 1fr;
}

.tokens-row {
  grid-template-columns: 1fr;
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-header {
    margin-bottom: 24px;
  }

  .page-title {
    font-size: 24px;
  }

  .info-row {
    grid-template-columns: 1fr;
  }
}
</style>

