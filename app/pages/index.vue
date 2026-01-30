<script setup lang="ts"></script>

<template>
  <div class="dashboard">
    <ConnectWalletModal />

    <div class="dashboard__wrap">
      <div class="dashboard__spacer" aria-hidden="true" />
      <div class="dashboard-grid">
        <div class="grid-row info-row">
          <WalletInfo />
        </div>
        <div class="grid-row tokens-row">
          <TokenList />
        </div>
      </div>
      <aside class="dashboard__side">
        <NuxtLink to="/swap-into-one" class="dashboard__swap-cta">
          <span class="dashboard__swap-cta-icon" aria-hidden="true">
            <svg
              width="26"
              height="20"
              viewBox="0 0 26 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <!-- Many: three dots -->
              <circle cx="4" cy="4" r="1.5" fill="currentColor" />
              <circle cx="4" cy="10" r="1.5" fill="currentColor" />
              <circle cx="4" cy="16" r="1.5" fill="currentColor" />
              <!-- Lines converging into one -->
              <path
                d="M5.5 5L12 10M5.5 10H12M5.5 15L12 10"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M12 10h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <!-- One -->
              <circle cx="22" cy="10" r="2" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </span>
          <span class="dashboard__swap-cta-label">Swap into one</span>
          <span class="dashboard__swap-cta-desc">Merge tokens</span>
          <span class="dashboard__swap-cta-arrow" aria-hidden="true">→</span>
        </NuxtLink>
      </aside>
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

.dashboard__wrap {
  display: flex;
  flex-direction: row;
  gap: 32px;
  align-items: flex-start;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard__spacer {
  flex: 1 1 0;
  min-width: 0;
}

.dashboard-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 0 0 auto;
  max-width: 455px;
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

.dashboard__side {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-self: flex-start;
}

.dashboard__swap-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  min-width: 120px;
  min-height: 44px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  text-decoration: none;
  text-align: center;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.dashboard__swap-cta:hover {
  border-color: var(--accent-primary);
  background: var(--accent-muted);
  box-shadow: var(--shadow-sm);
}

.dashboard__swap-cta:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

.dashboard__swap-cta-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  background: var(--accent-muted);
  color: var(--accent-primary);
  border-radius: var(--radius-sm);
  font-size: 18px;
  flex-shrink: 0;
}

.dashboard__swap-cta-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}

.dashboard__swap-cta-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.2;
}

.dashboard__swap-cta-arrow {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 14px;
  transition:
    transform 0.2s ease,
    color 0.2s ease;
}

.dashboard__swap-cta:hover .dashboard__swap-cta-arrow {
  color: var(--accent-primary);
  transform: translateY(2px);
}

@media (max-width: 768px) {
  .dashboard {
    padding-left: env(safe-area-inset-left, 0);
    padding-right: env(safe-area-inset-right, 0);
  }

  .dashboard-header {
    margin-bottom: 24px;
  }

  .page-title {
    font-size: 24px;
  }

  .dashboard__wrap {
    flex-direction: column;
    gap: 24px;
  }

  .dashboard__spacer {
    display: none;
  }

  .dashboard-grid {
    max-width: none;
  }

  .dashboard__side {
    width: 100%;
    justify-content: stretch;
  }

  .dashboard__swap-cta {
    flex-direction: row;
    min-width: unset;
    width: 100%;
    min-height: 56px;
    padding: 16px 20px;
    justify-content: center;
    gap: 10px;
  }

  .dashboard__swap-cta-desc {
    display: none;
  }

  .dashboard__swap-cta-arrow {
    margin-top: 0;
    margin-left: auto;
  }
}
</style>
