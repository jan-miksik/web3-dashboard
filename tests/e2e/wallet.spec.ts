import { test, expect } from '@playwright/test'

test.describe('Wallet Functionality E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display wallet connection UI', async ({ page }) => {
    // Use header button to avoid strict mode violation
    const headerButton = page.getByRole('banner').getByTestId('connect-button')
    await expect(headerButton).toBeVisible()
  })

  test('should open wallet modal when connect button is clicked', async ({ page }) => {
    // Click the header connect button to open the modal
    const headerButton = page.getByRole('banner').getByTestId('connect-button')
    await headerButton.click()

    // The modal should now be visible
    await expect(page.getByTestId('modal-overlay')).toBeVisible({ timeout: 5000 })

    // The internal modal should have a connect button
    await page.getByTestId('modal-overlay').getByTestId('connect-button').click()
  })

  // Note: Actual wallet connection tests would require:
  // 1. Mocking wallet providers (MetaMask, WalletConnect, etc.)
  // 2. Using Playwright Web3 helpers for Web3 interactions
  // 3. Setting up test wallets with known addresses

  test('should handle wallet disconnection gracefully', async ({ page }) => {
    // Test that the modal appears when wallet is disconnected
    // Since we can't actually connect/disconnect in E2E without mocking,
    // we test that the modal shows when not connected (which is the default state)
    await expect(page.getByTestId('modal-overlay')).toBeVisible()

    // Test that the modal has the expected elements
    const modal = page.getByTestId('modal-overlay')
    await expect(modal.getByTestId('connect-button')).toBeVisible()
    await expect(modal.getByTestId('address-input')).toBeVisible()

    // Test that we can watch an address (which simulates having an address without connecting)
    // Use a known valid test address (42 chars: 0x + 40 hex)
    const testAddress = '0x1234567890123456789012345678901234567890'
    const addressInput = modal.getByTestId('address-input')
    await addressInput.fill(testAddress)
    await addressInput.blur()

    // Wait for address validation and modal to close
    await page.waitForTimeout(1000)

    // After entering a valid address, the modal should close (address is watched)
    await expect(page.getByTestId('modal-overlay')).not.toBeVisible({ timeout: 2000 })

    // Test clearing the watched address brings back the modal
    await expect(page.getByTestId('clear-watch-btn')).toBeVisible()
    await page.getByTestId('clear-watch-btn').click()
    await expect(page.getByTestId('modal-overlay')).toBeVisible({ timeout: 2000 })
    await expect(page.getByTestId('modal-overlay')).toBeVisible({ timeout: 2000 })
  })
})
