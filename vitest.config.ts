import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  // any custom vitest config you require
  test: {
    environment: 'nuxt',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '.nuxt/',
        'dist/',
        '**/*.config.*',
        '**/types/**',
        'app/plugins/**',
        'app/pages/**',
        'app/app.vue',
        'app/layouts/**',
        // Wagmi/LI.FI integration composables—require full wallet/SDK env
        'app/composables/useBatchTransaction.ts',
        'app/composables/useTxComposer.ts',
        'app/composables/useComposerQuotes.ts',
        'app/composables/useComposerBatchSupport.ts',
        'app/composables/useComposerTargetState.ts',
        'app/composables/useComposerBatchingUi.ts',
        'app/composables/useBatchComposer.ts',
        'app/composables/useTokenList.ts',
        'app/composables/useTokens.ts', // API integration
        'app/utils/wagmi.ts', // Config singleton
        // Complex UI with wallet/modals—E2E covers
        'app/components/NetworkFilter.vue',
        'app/components/ConnectWalletModal.vue',
      ],
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
      thresholds: {
        lines: 80,
        statements: 78,
      },
    },
    include: ['tests/unit/**/*.test.ts'],
  },
})
