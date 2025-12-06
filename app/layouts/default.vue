<script setup lang="ts">
const hasProjectId = import.meta.env.NUXT_REOWN_PROJECT_ID !== ''

const sidebarItems = [
  { icon: '📊', label: 'Dashboard', path: '/', active: true },
]
</script>

<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-text">Web3 Dashboard</span>
        </div>
      </div>
      
      <div class="header-right">
        <!-- Show AppKit button when Project ID is configured -->
        <template v-if="hasProjectId">
          <ConnectButton />
        </template>
        
        <!-- Show setup message when no Project ID -->
        <div v-else class="setup-message">
          <span class="setup-icon">⚙️</span>
          <span class="setup-text">Add NUXT_REOWN_PROJECT_ID to .env</span>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <div class="main-container">
      <!-- Main Content -->
      <main class="main-content">
        <slot />
      </main>
    </div>

    <!-- Bottom Navigation (Mobile) -->
    <nav class="bottom-nav">
      <NuxtLink 
        v-for="item in sidebarItems" 
        :key="item.path"
        :to="item.path"
        class="bottom-nav-item"
        :class="{ active: item.active }"
      >
        <span class="bottom-nav-icon">{{ item.icon }}</span>
        <span class="bottom-nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

/* Header */
.header {
  height: 64px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 18px;
  color: var(--text-primary);
}

.logo-icon {
  font-size: 24px;
  color: var(--accent-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setup-message {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--warning-muted);
  color: var(--warning);
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
}

.setup-icon {
  font-size: 14px;
}

.setup-text {
  font-family: var(--font-mono);
}

/* Main Container */
.main-container {
  display: flex;
  flex: 1;
}

/* Sidebar */
.sidebar {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.sidebar-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-item.active {
  background: var(--accent-muted);
  color: var(--accent-primary);
}

.sidebar-icon {
  font-size: 18px;
}

.sidebar-label {
  font-size: 14px;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  min-height: calc(100vh - 64px);
}

/* Bottom Navigation (Mobile) */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 8px 16px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  z-index: 100;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 10px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  transition: all 0.2s ease;
}

.bottom-nav-item.active {
  color: var(--accent-primary);
}

.bottom-nav-icon {
  font-size: 20px;
}

.bottom-nav-label {
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .bottom-nav {
    display: flex;
    justify-content: space-around;
  }

  .main-content {
    padding: 16px;
    padding-bottom: 100px;
    min-height: calc(100vh - 64px - 80px);
  }

  .header {
    padding: 0 16px;
  }

  .logo-text {
    display: none;
  }

  .setup-text {
    display: none;
  }
}
</style>
