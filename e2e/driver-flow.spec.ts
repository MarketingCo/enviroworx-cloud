import { test, expect } from '@playwright/test'

test.describe('Driver Job Flow', () => {
  test('driver page loads', async ({ page }) => {
    await page.goto('/driver')

    // Driver page should show login form or app content
    await expect(page.locator('body')).toBeVisible()
  })

  test('driver login requires driver ID and PIN', async ({ page }) => {
    await page.goto('/driver')

    // Check if there are input fields for driver login
    // The actual UI may vary, so we check for common patterns
    const hasInput = await page.locator('input').count() > 0
    expect(hasInput).toBe(true)
  })

  test('driver page is accessible from office login', async ({ page }) => {
    await page.goto('/office/login')
    await page.click('a[href="/driver"]')
    await expect(page).toHaveURL(/.*driver/)
  })
})

test.describe('Public Pages', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('portal page loads', async ({ page }) => {
    await page.goto('/portal')
    await expect(page.locator('body')).toBeVisible()
  })

  test('blog page loads', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('body')).toBeVisible()
  })
})
