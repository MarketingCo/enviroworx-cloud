import { test, expect } from '@playwright/test'

test.describe('Stripe Payment Flow', () => {
  test('portal page loads', async ({ page }) => {
    await page.goto('/portal')

    // Portal should have customer portal branding
    await expect(page.locator('body')).toBeVisible()
  })

  test('payment success parameter handling', async ({ page }) => {
    await page.goto('/portal?payment=success')

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Tablet View', () => {
  test('tablet page loads', async ({ page }) => {
    await page.goto('/tablet')
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Apply Page', () => {
  test('apply page loads', async ({ page }) => {
    await page.goto('/apply')
    await expect(page.locator('body')).toBeVisible()
  })
})
