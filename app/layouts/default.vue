<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRuntimeConfig } from '#app'
import { useRoute } from 'vue-router'

const runtimeConfig = useRuntimeConfig()
const hasProjectId = !!runtimeConfig.public.reownProjectId
const route = useRoute()

const sidebarItems = [
  { icon: '📊', label: 'Dashboard', path: '/' },
  { icon: '🔄', label: 'Swap into One', path: '/swap-into-one' },
]

const isNavItemActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

// Calculate and reserve scrollbar width to prevent layout shift
const scrollbarWidth = ref(0)
const wrapperRef = ref<HTMLElement | null>(null)

function calculateScrollbarWidth(): number {
  if (typeof window === 'undefined') return 0

  // Create a temporary element to measure scrollbar width
  const outer = document.createElement('div')
  outer.style.visibility = 'hidden'
  outer.style.overflow = 'scroll'
  outer.style.width = '100px'
  outer.style.position = 'absolute'
  outer.style.top = '-9999px'
  document.body.appendChild(outer)

  const inner = document.createElement('div')
  inner.style.width = '100%'
  outer.appendChild(inner)

  const width = outer.offsetWidth - inner.offsetWidth
  outer.parentNode?.removeChild(outer)

  return width
}

let resizeHandler: (() => void) | null = null

onMounted(() => {
  scrollbarWidth.value = calculateScrollbarWidth()

  // Update on resize (in case zoom level changes scrollbar width)
  resizeHandler = () => {
    scrollbarWidth.value = calculateScrollbarWidth()
  }
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
})
</script>

<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <NuxtLink to="/" class="logo">
          <span class="logo-text">Web3 Dashboard</span>
        </NuxtLink>
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
      <div class="main-content-outer">
        <div
          ref="wrapperRef"
          class="main-content-wrapper"
          :style="{ '--scrollbar-width': `${scrollbarWidth}px` }"
        >
          <main class="main-content">
            <slot />
          </main>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation (Mobile) -->
    <nav class="bottom-nav">
      <NuxtLink
        v-for="item in sidebarItems"
        :key="item.path"
        :to="item.path"
        class="bottom-nav-item"
        :class="{ active: isNavItemActive(item.path) }"
      >
        <span class="bottom-nav-icon">{{ item.icon }}</span>
        <span class="bottom-nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <NotificationContainer />
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
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
  text-decoration: none;
  transition: color 0.2s ease;
}

.logo:hover {
  color: var(--accent-primary);
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
  overflow: hidden; /* Prevent body scroll */
  min-height: 0; /* Allow flex item to shrink */
}

/* Main Content Outer - reserves space for scrollbar */
.main-content-outer {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding-right: var(--scrollbar-width, 0px);
  box-sizing: border-box;
  min-height: 0; /* Allow flex item to shrink */
}

/* Main Content Wrapper */
.main-content-wrapper {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable; /* Reserve space for scrollbar (modern browsers) */
  box-sizing: border-box;
  width: 100%;
  min-height: 0; /* Allow flex item to shrink and enable scrolling */
}

/* Main Content */
.main-content {
  padding: 24px;
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
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

/* Bottom Navigation (Mobile) */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 8px 12px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  z-index: 100;
  /* Safe area for notched devices */
  padding-left: calc(12px + env(safe-area-inset-left, 0px));
  padding-right: calc(12px + env(safe-area-inset-right, 0px));
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 16px;
  min-height: 56px;
  min-width: 64px;
  border-radius: 12px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav-item.active {
  color: var(--accent-primary);
  background: var(--accent-muted);
}

.bottom-nav-icon {
  font-size: 22px;
  line-height: 1;
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
    align-items: stretch;
  }

  .main-content {
    padding: 16px;
    padding-left: calc(16px + env(safe-area-inset-left, 0px));
    padding-right: calc(16px + env(safe-area-inset-right, 0px));
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    min-height: calc(100vh - 56px - 88px);
  }

  .header {
    padding: 0 16px;
    padding-left: calc(16px + env(safe-area-inset-left, 0px));
    padding-right: calc(16px + env(safe-area-inset-right, 0px));
    height: 56px;
    min-height: 56px;
  }

  .logo-text {
    display: none;
  }

  .setup-text {
    display: none;
  }
}
</style>
