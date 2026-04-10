import globals from 'globals'
import { config as baseConfig } from '@repo/eslint-config/base'

export default [
  ...baseConfig,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
]
