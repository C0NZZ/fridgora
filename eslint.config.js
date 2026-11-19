import { configApp } from '@adonisjs/eslint-config'

export default [
  ...configApp(),
  {
    files: ['database/schema.ts'],
    rules: {
      'prettier/prettier': 'off',
    },
  },
  {
    files: ['inertia/**/*.{ts,tsx}'],
    rules: {
      '@adonisjs/no-backend-import-in-frontend': ['error', { allowed: ['#shared/money'] }],
    },
  },
]
