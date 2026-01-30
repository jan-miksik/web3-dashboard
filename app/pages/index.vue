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
              width="30"
              height="24"
              viewBox="0 0 30 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <!-- Three source circles -->
              <circle cx="2.75" cy="3" r="1.75" stroke="currentColor" stroke-width="1.25" />
              <circle cx="2.75" cy="12" r="1.75" stroke="currentColor" stroke-width="1.25" />
              <circle cx="2.75" cy="21" r="1.75" stroke="currentColor" stroke-width="1.25" />
              <!-- Lines from circles to funnel -->
              <path
                d="M4.5 4.5L9.5 9.5"
                stroke="currentColor"
                stroke-width="1.25"
                stroke-linecap="round"
              />
              <path
                d="M4.5 12H9.5"
                stroke="currentColor"
                stroke-width="1.25"
                stroke-linecap="round"
              />
              <path
                d="M4.5 19.5L9.5 14.5"
                stroke="currentColor"
                stroke-width="1.25"
                stroke-linecap="round"
              />
              <!-- Funnel chevron -->
              <path
                d="M9.5 9.5L13 12L9.5 14.5Z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="currentColor"
                fill-opacity="0.1"
              />
              <!-- Output line -->
              <path d="M13 12H22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <!-- Arrowhead -->
              <path
                d="M20 9.5L23 12L20 14.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <!-- Destination circle (outlined) -->
              <circle cx="26.5" cy="12" r="2.75" stroke="currentColor" stroke-width="1.75" />
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
