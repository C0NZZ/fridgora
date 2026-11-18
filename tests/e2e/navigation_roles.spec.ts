import { test, expect } from '@playwright/test'
import { fillLoginForm, loginAs } from './helpers/auth'
import { APP_MOUNT, MOUNTED_APP_URL } from './helpers/mounted_app'

test.describe('Role-aware app bar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 })
  })

  test('customer sees only customer navigation (no supplier/admin groups)', async ({ page }) => {
    await loginAs(page, 'customer2')

    const nav = page.locator('.sbf-nav')
    await expect(nav.getByText('Obchod', { exact: true })).toBeVisible()
    await expect(nav.getByText('Objednávky', { exact: true })).toBeVisible()
    await expect(nav.getByText('Faktury', { exact: true })).toBeVisible()

    await expect(nav.getByText('Dodavatel', { exact: true })).toHaveCount(0)
    await expect(nav.getByText('Admin', { exact: true })).toHaveCount(0)
  })

  test('supplier sees supplier group but not admin group', async ({ page }) => {
    await loginAs(page, 'supplier')

    await expect(page.locator('.sbf-nav').getByText('Dodavatel', { exact: true })).toBeVisible()
    await expect(page.locator('.sbf-nav').getByText('Admin', { exact: true })).toHaveCount(0)
  })

  test('admin sees both supplier and admin groups', async ({ page }) => {
    await loginAs(page, 'admin')

    await expect(page.locator('.sbf-nav').getByText('Dodavatel', { exact: true })).toBeVisible()
    await expect(page.locator('.sbf-nav').getByText('Admin', { exact: true })).toBeVisible()
  })

  test('logout control is always available in the app bar', async ({ page }) => {
    await loginAs(page, 'supplier')
    await expect(page.locator('button[aria-label="Odhlásit se"]')).toBeVisible()
  })

  test('english locale renders app bar labels in english', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await loginAs(page, 'admin')

    const nav = page.locator('.sbf-nav')
    await expect(nav.getByText('Shop', { exact: true })).toBeVisible()
    await expect(nav.getByText('Orders', { exact: true }).first()).toBeVisible()
    await expect(nav.getByText('Invoices', { exact: true }).first()).toBeVisible()
    await expect(nav.getByText('Activity', { exact: true })).toBeVisible()
    await expect(nav.getByText('Supplier', { exact: true })).toBeVisible()
    await expect(nav.getByText('Admin', { exact: true })).toBeVisible()
    await expect(page.locator('button[aria-label="Sign out"]')).toBeVisible()
  })

  test('mounted navigation, supplier upload, and redirects stay under the mount', async ({
    page,
  }) => {
    const outsideMount: string[] = []
    const origin = new URL(MOUNTED_APP_URL).origin
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (request.url().startsWith(`${origin}/`) && !url.pathname.startsWith(`${APP_MOUNT}/`)) {
        outsideMount.push(url.pathname)
      }
    })

    await page.goto(`${MOUNTED_APP_URL}/login`)
    await fillLoginForm(page, 'admin@localhost', 'admin123')
    await expect(page).toHaveURL(`${MOUNTED_APP_URL}/shop`)
    const nav = page.locator('.sbf-nav')
    await expect(nav.locator('.sbf-brand-link')).toHaveAttribute('href', `${APP_MOUNT}/shop`)
    await expect(nav.locator(`a[href="${APP_MOUNT}/profile"]`)).toBeVisible()

    await nav.getByText('Admin', { exact: true }).click()
    await nav.getByText('Dashboard', { exact: true }).click()
    await expect(page).toHaveURL(`${MOUNTED_APP_URL}/admin/dashboard`)

    await nav.getByText('Dodavatel', { exact: true }).click()
    await nav.locator(`a[href="${APP_MOUNT}/supplier/stock"]`).click()
    await expect(page).toHaveURL(`${MOUNTED_APP_URL}/supplier/stock`)
    await page.locator(`a[href="${APP_MOUNT}/supplier/products/new"]`).click()
    await expect(page).toHaveURL(`${MOUNTED_APP_URL}/supplier/products/new`)

    const name = `Mounted product ${Date.now()}`
    const submit = page.getByRole('button', { name: 'Vytvořit produkt' })
    await expect(submit).toBeDisabled()
    await page.locator('#product-name').fill(name)
    await page.locator('#product-description').fill('Mounted supplier test')
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'Nealko' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'mounted-product.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAYAAADkOT91AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVR4nGM4IafxHxkz0EIAAMbhMTmfCC9yAAAAAElFTkSuQmCC',
        'base64'
      ),
    })
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(page).toHaveURL((url) => {
      return url.pathname === `${APP_MOUNT}/supplier/stock` && url.searchParams.has('preselect')
    })
    await expect(page.getByRole('combobox').first()).toContainText(name)

    const stockUrl = page.url()
    await page.getByPlaceholder('ks').fill('3')
    await page.getByPlaceholder('ks').press('Enter')
    await page.getByPlaceholder('Kč').fill('49')
    const [delivery] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url() === `${MOUNTED_APP_URL}/supplier/deliveries` &&
          response.request().method() === 'POST'
      ),
      page.getByPlaceholder('Kč').press('Enter'),
    ])
    expect(new URL(delivery.headers().location, origin).href).toBe(stockUrl)

    await nav.getByText('Dodavatel', { exact: true }).click()
    await nav.getByText('Produkty', { exact: true }).click()
    await expect(page).toHaveURL(`${MOUNTED_APP_URL}/supplier/products`)
    const productImage = page.getByRole('row').filter({ hasText: name }).getByRole('img')
    await expect(productImage).toHaveAttribute('src', new RegExp(`^${APP_MOUNT}/uploads/`))
    await expect
      .poll(() => productImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)

    await nav.getByRole('button', { name: 'Odhlásit se' }).click()
    await expect(page).toHaveURL(`${MOUNTED_APP_URL}/`)
    expect(outsideMount).toEqual([])
  })
})
