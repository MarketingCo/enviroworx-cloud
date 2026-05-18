import { test, expect } from '@playwright/test'

test.describe('Office Login Flow', () => {
  test('office login page loads', async ({ page }) => {
    await page.goto('/office/login')

    // Check for the Enviroworx branding
    await expect(page.locator('text=Enviroworx')).toBeVisible()
    await expect(page.locator('text=Office System')).toBeVisible()

    // Check form elements exist
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows error for empty form submission', async ({ page }) => {
    await page.goto('/office/login')

    // Try submitting without entering anything
    await page.click('button[type="submit"]')

    // Should show validation error
    await expect(page.locator('text=Enter your email')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/office/login')

    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Invalid email or password')).toBeVisible()
  })

  test('links to driver app are visible', async ({ page }) => {
    await page.goto('/office/login')

    await expect(page.locator('a[href="/driver"]')).toBeVisible()
    await expect(page.locator('a[href="/portal"]')).toBeVisible()
  })

  test('submit button is disabled while loading', async ({ page }) => {
    await page.goto('/office/login')

    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Check that button shows loading state or is disabled
    const button = page.locator('button[type="submit"]')
    await expect(button).toBeDisabled()
  })
})
