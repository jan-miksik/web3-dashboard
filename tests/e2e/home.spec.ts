import { test, expect } from '@playwright/test'

test.describe('Home Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Visit the home page before each test
    await page.goto('/')
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
    // Wait for main content to be visible
    await page.waitForSelector('main, [role="main"]', { state: 'visible' })
  })

  test('should display the home page', async ({ page }) => {
    // Check that header/banner exists (logo text is hidden on mobile, so check header instead)
    await expect(page.getByRole('banner')).toBeVisible()
    // Also check that main content area exists
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('should show connect wallet button when not connected', async ({ page }) => {
    // Use header button to avoid strict mode violation (button appears in header, main, and modal)
    const headerButton = page.getByRole('banner').getByTestId('connect-button')
    await expect(headerButton).toBeVisible()
    await expect(headerButton.getByTestId('connect-button-text')).toContainText('Connect Wallet')
  })

  test('should be responsive', async ({ page }) => {
    // Use header button to avoid strict mode violation
    const headerButton = page.getByRole('banner').getByTestId('connect-button')

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(headerButton).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(headerButton).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(headerButton).toBeVisible()
  })
})
