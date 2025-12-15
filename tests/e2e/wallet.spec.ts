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
    // Wait for page to load completely
    await page.waitForLoadState('networkidle')

    // Modal is auto-shown when not connected (showModal = !isConnected && !watchedAddress)
    // Check if modal is visible, if not click header button to open it
    const modalOverlay = page.getByTestId('modal-overlay')
    const modalVisible = await modalOverlay.isVisible({ timeout: 3000 }).catch(() => false)

    if (!modalVisible) {
      // Modal not visible, click header button to open it
      const headerButton = page.getByRole('banner').getByTestId('connect-button')
      await headerButton.click({ force: true }) // Use force to bypass pointer event blocking
      // Wait for modal to appear
      await expect(modalOverlay).toBeVisible({ timeout: 5000 })
    }

    // Ensure modal is visible before proceeding
    await expect(modalOverlay).toBeVisible({ timeout: 5000 })

    // The internal modal should have a connect button
    const modalConnectButton = page.getByTestId('modal-overlay').getByTestId('connect-button')
    await expect(modalConnectButton).toBeVisible({ timeout: 5000 })
    await modalConnectButton.click()

    // After clicking the connect button, verify the expected outcome:
    // 1. AppKit wallet connection modal should open (if wallet provider is available)
    // 2. Or verify the click was handled gracefully without errors

    // Check for AppKit modal (common selectors: w3m- prefix classes or data attributes)
    const appKitModal = page.locator('[class*="w3m"], [id*="w3m"], [data-w3m]').first()

    // Wait a moment for AppKit modal to potentially appear, then check if it's visible
    try {
      // Try to wait for AppKit modal to appear
      await expect(appKitModal).toBeVisible({ timeout: 2000 })

      // AppKit modal opened - verify it shows connection UI
      // Check for wallet connection content (text like "Connect Wallet" or wallet provider names)
      const walletContent = page.getByText(/connect|wallet|metamask|coinbase/i).first()
      await expect(walletContent).toBeVisible({ timeout: 2000 })
    } catch {
      // No AppKit modal detected (test environment may not have wallet provider)
      // Verify the click was handled gracefully: modal button should still be visible/functional
      // and no error state should appear
      await expect(modalConnectButton).toBeVisible({ timeout: 1000 })
      // Ensure no error messages appeared after the click
      const errorMessage = page.getByTestId('modal-overlay').getByTestId('address-error')
      await expect(errorMessage).not.toBeVisible({ timeout: 500 })
    }
  })

  // Note: Actual wallet connection tests would require:
  // 1. Mocking wallet providers (MetaMask, WalletConnect, etc.)
  // 2. Using Playwright Web3 helpers for Web3 interactions
  // 3. Setting up test wallets with known addresses

  test('should show wallet modal when disconnected', async ({ page }) => {
    // Test that the modal appears when wallet is disconnected
    // Since we can't actually connect/disconnect in E2E without mocking,
    // we test that the modal shows when not connected (which is the default state)
    await expect(page.getByTestId('modal-overlay')).toBeVisible()

    // Test that the modal has the expected elements
    const modal = page.getByTestId('modal-overlay')
    await expect(modal.getByTestId('connect-button')).toBeVisible()
    await expect(modal.getByTestId('address-input')).toBeVisible()
  })

  test('should allow watching an address via modal', async ({ page }) => {
    // Ensure the modal is visible in the disconnected state
    const modal = page.getByTestId('modal-overlay')
    await expect(modal).toBeVisible()

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

    // Wallet info card should now be in watch mode and display the watched address
    const statusBadge = page.getByTestId('status-badge')
    await expect(statusBadge).toHaveText(/watch mode/i)

    const walletDetails = page.getByTestId('wallet-details')
    await expect(walletDetails).toBeVisible()
    await expect(walletDetails.getByTestId('address-short')).toContainText('0x1234')
  })
})
