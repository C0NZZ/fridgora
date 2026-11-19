import { test, expect } from '@playwright/test'
import { startOidcProvider, oidcTestPort } from '../utils/oidc_provider.js'
import { loginAs } from './helpers/auth.js'

const E2E_INVITE_TOKEN = 'e2e-customer-invite-token'

function responseLocation(response: { headers(): Record<string, string> }): string {
  return response.headers()['location'] ?? ''
}

test.describe('OpenID Connect with a local administrator @local-admin-oidc', () => {
  let provider: Awaited<ReturnType<typeof startOidcProvider>>

  test.beforeAll(async () => {
    provider = await startOidcProvider(oidcTestPort)
  })

  test.afterAll(async () => {
    await provider.close()
  })

  test('users can sign in and save their profile without email', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('a[href="/register"]')).toHaveCount(0)
    await expect(page.locator('a[href="/forgot-password"]')).toHaveCount(0)

    await page.locator('a[href="/auth/oidc/redirect"]').click()
    await expect(page).toHaveURL(/\/shop$/)
    await page.goto('/profile')
    const contact = page.getByTestId('profile-contact-card')
    await expect(contact.locator('input[type="email"]')).toHaveCount(0)
    const name = contact.locator('input').first()
    await name.fill('OIDC Customer Updated')
    const save = contact.getByTestId('profile-save-button')
    await expect(save).toBeEnabled()
    const profileUpdated = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && new URL(response.url()).pathname === '/profile'
    )
    await save.click()
    const response = await profileUpdated
    expect(response.status()).toBe(303)
    await page.reload()
    await expect(name).toHaveValue('OIDC Customer Updated')
  })

  test('the administrator retains local access', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/admin\/users$/)
  })
})

test.describe('Auth ENV matrix smoke', () => {
  test('single provider (microsoft) redirects and blocks local-only pages @single-provider-microsoft', async ({
    request,
  }) => {
    const login = await request.get('/login', { maxRedirects: 0 })
    expect(login.status()).toBe(302)
    expect(responseLocation(login)).toBe('/auth/microsoft/redirect')

    const register = await request.get('/register', { maxRedirects: 0 })
    expect(register.status()).toBe(302)
    expect(responseLocation(register)).toBe('/login')

    const forgot = await request.get('/forgot-password', { maxRedirects: 0 })
    expect(forgot.status()).toBe(302)
    expect(responseLocation(forgot)).toBe('/login')

    const invite = await request.get(`/register/invite/${E2E_INVITE_TOKEN}`, { maxRedirects: 0 })
    expect(invite.status()).toBe(302)
    expect(responseLocation(invite)).toBe(
      `/auth/microsoft/redirect?intent=invite&token=${encodeURIComponent(E2E_INVITE_TOKEN)}`
    )
  })

  test('multi provider mode renders provider choices and invite provider actions @multi-providers', async ({
    page,
    request,
  }) => {
    const loginResp = await request.get('/login', { maxRedirects: 0 })
    expect(loginResp.status()).toBe(200)

    await page.goto('/login')
    await expect(page.locator('a[href="/auth/microsoft/redirect"]')).toBeVisible()
    await expect(page.locator('a[href="/auth/discord/redirect"]')).toBeVisible()
    await expect(page.locator('#email')).toHaveCount(0)

    const register = await request.get('/register', { maxRedirects: 0 })
    expect(register.status()).toBe(302)
    expect(responseLocation(register)).toBe('/login')

    await page.goto(`/register/invite/${E2E_INVITE_TOKEN}`)
    await expect(
      page.locator(
        `a[href="/auth/microsoft/redirect?intent=invite&token=${encodeURIComponent(E2E_INVITE_TOKEN)}"]`
      )
    ).toBeVisible()
    await expect(
      page.locator(
        `a[href="/auth/discord/redirect?intent=invite&token=${encodeURIComponent(E2E_INVITE_TOKEN)}"]`
      )
    ).toBeVisible()
    await expect(page.locator('#invitePassword')).toHaveCount(0)
  })

  test('hybrid mode keeps local forms and includes provider actions @hybrid-local-microsoft', async ({
    page,
    request,
  }) => {
    const loginResp = await request.get('/login', { maxRedirects: 0 })
    expect(loginResp.status()).toBe(200)

    await page.goto('/login')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('a[href="/auth/microsoft/redirect"]')).toBeVisible()

    const registerResp = await request.get('/register', { maxRedirects: 0 })
    expect(registerResp.status()).toBe(200)
    await page.goto('/register')
    await expect(page.locator('#registerDisplayName')).toBeVisible()

    const forgotResp = await request.get('/forgot-password', { maxRedirects: 0 })
    expect(forgotResp.status()).toBe(200)
    await page.goto('/forgot-password')
    await expect(page.locator('#forgotEmail')).toBeVisible()

    await page.goto(`/register/invite/${E2E_INVITE_TOKEN}`)
    await expect(page.locator('#inviteDisplayName')).toBeVisible()
    await expect(page.locator('#invitePassword')).toBeVisible()
    await expect(
      page.locator(
        `a[href="/auth/microsoft/redirect?intent=invite&token=${encodeURIComponent(E2E_INVITE_TOKEN)}"]`
      )
    ).toBeVisible()
  })
})
