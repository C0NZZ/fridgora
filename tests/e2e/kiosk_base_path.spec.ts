import { expect, test } from '@playwright/test'
import { fillLoginForm } from './helpers/auth'
import { KIOSK_MOUNT, KIOSK_URL } from './helpers/mounted_kiosk'

test('signs in, buys a basket and logs out under a nested mount', async ({ page }) => {
  const rootRequests: string[] = []
  const origin = new URL(KIOSK_URL).origin
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (
      url.origin === origin &&
      url.pathname !== KIOSK_MOUNT &&
      !url.pathname.startsWith(`${KIOSK_MOUNT}/`)
    ) {
      rootRequests.push(url.pathname)
    }
  })

  await page.goto(`${KIOSK_URL}/kiosk`)
  await expect(page).toHaveURL(new RegExp(`^${KIOSK_URL}/login(?:\\?|$)`))
  await fillLoginForm(page, 'kiosk@localhost', 'incorrect-password')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(`${KIOSK_URL}/login`)
  await fillLoginForm(page, 'kiosk@localhost', 'kiosk123')
  await expect(page).toHaveURL(`${KIOSK_URL}/kiosk`)

  const cookies = await page.context().cookies()
  const session = cookies.find((cookie) => cookie.name === 'sbf-session')
  expect(session?.path).toBe(`${KIOSK_MOUNT}/`)

  await expect(page.getByRole('button', { name: '8', exact: true })).toBeVisible()
  await page.keyboard.type('89992')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/^Basket$|^Košík$/i)).toBeVisible()
  await expect(page.locator('audio')).toHaveAttribute(
    'src',
    `${KIOSK_MOUNT}/uploads/music/e2e-public.mp3`
  )

  await page.locator('div.grid.grid-cols-3.gap-3 > div').first().click()
  await page.locator('button:has(.pi-shopping-cart)').first().click()
  const reloaded = page.waitForResponse(
    (response) =>
      response.url() === `${KIOSK_URL}/kiosk` &&
      response.request().headers()['x-inertia'] === 'true'
  )
  await page.getByRole('button', { name: /Complete Purchase|Dokončit nákup/i }).click()
  await expect(page.getByText(/Thank you|Díky/i)).toBeVisible()
  const reloadResponse = await reloaded
  const reloadedPage = await reloadResponse.json()
  expect(reloadedPage.url).toBe(`${KIOSK_MOUNT}/kiosk`)

  await page.goto(`${KIOSK_URL}/kiosk/shop?keypadId=89992`)
  await page.getByRole('link', { name: /back|zpět/i }).click()
  await expect(page).toHaveURL(`${KIOSK_URL}/kiosk`)

  await expect(page.getByRole('button', { name: '0', exact: true })).toBeVisible()
  await page.keyboard.type('000000')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`${KIOSK_URL}/`)
  await expect(page.getByRole('link', { name: /sign in|přihlásit/i })).toBeVisible()
  expect(rootRequests).toEqual([])
})
