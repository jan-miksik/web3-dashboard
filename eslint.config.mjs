// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
// @ts-expect-error - vue-eslint-parser types may not be available
import vueParser from 'vue-eslint-parser'

import prettier from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'

export default withNuxt([
  // Main project config for TypeScript/JavaScript files
  {
    files: ['**/*.{ts,tsx,js}'],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },

    plugins: {
      prettier: prettierPlugin,
      // @ts-expect-error - @typescript-eslint/eslint-plugin has configs with parser: null, but ESLint expects string | undefined
      '@typescript-eslint': tseslint,
    },

    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': 'off', // Disable base rule in favor of @typescript-eslint version
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Rules for Vue files with TypeScript support
  {
    files: ['**/*.vue'],

    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },

    plugins: {
      prettier: prettierPlugin,
      // @ts-expect-error - @typescript-eslint/eslint-plugin has configs with parser: null, but ESLint expects string | undefined
      '@typescript-eslint': tseslint,
    },

    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': 'off', // Disable base rule in favor of @typescript-eslint version
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Disable formatting rules conflicting with Prettier
  prettier,
])
