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
      exclude: ['node_modules/', 'tests/', '.nuxt/', 'dist/', '**/*.config.*', '**/types/**'],
      // Include source files
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
    },
    include: ['tests/unit/**/*.test.ts'],
  },
})
