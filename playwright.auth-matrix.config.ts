import { defineConfig, devices } from '@playwright/test'
import { getTestRuntimeEnv } from './tests/utils/test_db.js'
import { oidcClientId, oidcClientSecret, oidcTestPort } from './tests/utils/oidc_provider.js'

function profile(port: string, authProviders: string, overrides: Record<string, string> = {}) {
  const baseURL = `http://localhost:${port}`

  return {
    baseURL,
    webServer: {
      command: 'cd build && node bin/server.js',
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: getTestRuntimeEnv({
        PORT: port,
        APP_URL: baseURL,
        AUTH_PROVIDERS: authProviders,
        AUTH_AUTO_REGISTER_PROVIDERS: '',
        AUTH_REGISTRATION_MODE: 'open',
        AUTH_REGISTRATION_ALLOWED_DOMAINS: '',
        ...overrides,
      }),
    },
  }
}

const singleMicrosoft = profile('3346', 'microsoft')
const multiProviders = profile('3347', 'microsoft,discord')
const hybridMicrosoft = profile('3348', 'local,microsoft')
const localAdminOidc = profile('3350', 'local,oidc', {
  AUTH_LOCAL_ADMIN_ONLY: 'true',
  AUTH_AUTO_REGISTER_PROVIDERS: 'oidc',
  AUTH_PROVIDER_OIDC_ISSUER: `http://127.0.0.1:${oidcTestPort}`,
  AUTH_PROVIDER_OIDC_CLIENT_ID: oidcClientId,
  AUTH_PROVIDER_OIDC_CLIENT_SECRET: oidcClientSecret,
  MAIL_ENABLED: 'false',
})

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['auth_env_matrix.spec.ts'],
  globalSetup: './tests/e2e/global_setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['junit', { outputFile: 'test-results/junit-e2e-auth-matrix.xml' }]],
  outputDir: 'playwright-artifacts',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'cs-CZ',
  },

  webServer: [
    singleMicrosoft.webServer,
    multiProviders.webServer,
    hybridMicrosoft.webServer,
    localAdminOidc.webServer,
  ],

  projects: [
    {
      name: 'auth-local-admin-oidc',
      use: { ...devices['Desktop Chrome'], baseURL: localAdminOidc.baseURL },
      grep: /@local-admin-oidc/,
    },
    {
      name: 'auth-single-microsoft',
      use: { ...devices['Desktop Chrome'], baseURL: singleMicrosoft.baseURL },
      grep: /@single-provider-microsoft/,
    },
    {
      name: 'auth-multi-providers',
      use: { ...devices['Desktop Chrome'], baseURL: multiProviders.baseURL },
      grep: /@multi-providers/,
    },
    {
      name: 'auth-hybrid-local-microsoft',
      use: { ...devices['Desktop Chrome'], baseURL: hybridMicrosoft.baseURL },
      grep: /@hybrid-local-microsoft/,
    },
  ],
})
