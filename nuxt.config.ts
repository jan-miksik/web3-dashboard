// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false }, // Disable devtools to avoid the conflict
  modules: ['@nuxt/eslint', '@nuxt/image'],

  // App configuration
  app: {
    head: {
      title: 'Web3 Dashboard',
      meta: [
        { name: 'description', content: 'Web3 Wallet Dashboard' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  // Global CSS
  css: ['~/assets/css/main.css'],

  // SSR must be false for wagmi/web3 to work properly
  ssr: false,

  // Runtime config for environment variables
  runtimeConfig: {
    // Server-side only (not exposed to client)
    zerionApiKey: process.env.NUXT_ZERION_API_KEY || '',

    // Public (exposed to client)
    public: {
      reownProjectId: process.env.NUXT_REOWN_PROJECT_ID || '',
      appUrl: process.env.NUXT_APP_URL || process.env.APP_URL || '',
    },
  },

  // Vite configuration
  vite: {
    define: {
      'process.env': {},
    },
    /**
     * Some web3 deps (e.g. `rpc-websockets`) pull in CJS `eventemitter3/index.js`.
     * If Vite doesn't prebundle it, Nuxt dev can end up serving that CJS file
     * directly to the browser via `@fs`, which then fails with:
     * "does not provide an export named 'default'".
     */
    optimizeDeps: {
      include: ['rpc-websockets', 'eventemitter3'],
    },
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('appkit-'),
        },
      },
    },
  },

  // TypeScript
  typescript: {
    strict: true,
    typeCheck: false,
  },
})
