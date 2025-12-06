// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Allow TypeScript syntax in Vue files
    '@typescript-eslint/no-unused-vars': 'warn',
  },
})
