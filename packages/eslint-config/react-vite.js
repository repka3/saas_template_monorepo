import reactRefresh from 'eslint-plugin-react-refresh'
import { config as reactInternalConfig } from './react-internal.js'

/**
 * A shared ESLint configuration for Vite React applications.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...reactInternalConfig,
  {
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: ['useSidebar'],
        },
      ],
    },
  },
]
