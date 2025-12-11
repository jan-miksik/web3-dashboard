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
        'cypress/',
        '**/*.config.*',
        '**/types/**',
      ],
    },
    include: ['tests/unit/**/*.test.ts'],
  },
})

