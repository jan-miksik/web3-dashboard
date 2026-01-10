import { test, expect, Page } from '@playwright/test'

/**
 * Helper function to fill address in modal and wait for it to close.
 * The @input handler will auto-validate and close modal if valid.
 * @param page - Playwright page object
 * @param address - Address to fill (defaults to common test address)
 */
async function fillAddressAndWaitForModalClose(
  page: Page,
  address: string = '0x1234567890123456789012345678901234567890'
) {
  const modal = page.getByTestId('modal-overlay')
  const addressInput = modal.getByTestId('address-input')

  // Fill the address - the @input handler will auto-validate and close modal if valid
  await addressInput.fill(address)
  // Don't blur - the input handler already processes it, and modal may close immediately
  // Just wait for modal to close (it closes automatically when valid address is set)
  await expect(page.getByTestId('modal-overlay')).not.toBeVisible({ timeout: 5000 })
}

test.describe('Token Display E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display token information correctly', async ({ page }) => {
    // Watch an address
    await fillAddressAndWaitForModalClose(page)

    // Wait for token list to load
    await page.waitForTimeout(2000)

    // If tokens exist, check their structure
    const tokenRows = page.getByTestId('token-row')
    const count = await tokenRows.count()

    if (count > 0) {
      // Check first token row has expected structure
      const firstRow = tokenRows.first()
      await expect(firstRow).toBeVisible()

      // Verify token information is displayed
      await expect(firstRow.locator('.token-symbol')).toBeVisible()
      await expect(firstRow.locator('.token-value')).toBeVisible()
      await expect(firstRow.locator('.chain-badge')).toBeVisible()
    }
  })

  test('should handle empty token list', async ({ page }) => {
    // Watch an address that might have no tokens
    await fillAddressAndWaitForModalClose(page, '0x0000000000000000000000000000000000000001')

    // Wait for loading to complete
    await page.waitForTimeout(3000)

    // Token list component should be visible
    await expect(page.getByTestId('token-list')).toBeVisible()

    const emptyState = page.getByTestId('empty-state')
    const loadingState = page.getByTestId('loading-state')

    const emptyVisible = await emptyState.isVisible().catch(() => false)
    const loadingVisible = await loadingState.isVisible().catch(() => false)

    // Should show empty state or still be loading (not token table)
    expect(emptyVisible || loadingVisible).toBeTruthy()

    // Verify no tokens are displayed
    const tokenRows = await page.getByTestId('token-row').count()
    expect(tokenRows).toBe(0)
  })

  test('should filter tokens by chain', async ({ page }) => {
    // Watch an address
    await fillAddressAndWaitForModalClose(page)

    // Wait for tokens to load
    await page.waitForTimeout(3000)

    // Check if network filter button exists (only shows if there are tokens with multiple chains)
    const networkFilterBtn = page.getByTestId('network-filter-btn')
    const filterExists = await networkFilterBtn.isVisible().catch(() => false)

    if (filterExists) {
      // Click to open filter dropdown
      await networkFilterBtn.click()

      // Check that dropdown is visible
      await expect(page.getByTestId('network-filter-dropdown')).toBeVisible()

      // Check that filter options exist
      const filterOptions = page.getByTestId('network-filter-option')
      const optionCount = await filterOptions.count()

      if (optionCount > 0) {
        // Click first option to filter
        await filterOptions.first().click()

        // Wait for filter to apply
        await page.waitForTimeout(1000)

        // Filter should be active
        await expect(networkFilterBtn).toHaveClass(/active/)
      }
    }
  })

  test('should sort tokens by value', async ({ page }) => {
    // Watch an address
    await fillAddressAndWaitForModalClose(page)

    // Wait for tokens to load
    await page.waitForTimeout(3000)

    // Check if token table exists
    const tokenTable = page.getByTestId('token-table')
    const tableExists = await tokenTable.isVisible().catch(() => false)

    if (tableExists) {
      // Get all token rows
      const tokenRows = page.getByTestId('token-row')
      const count = await tokenRows.count()

      // Ensure we have more than one token to verify sorting
      expect(count).toBeGreaterThan(1)

      // Extract USD values from each token row
      const usdValues: number[] = []

      for (let i = 0; i < count; i++) {
        const row = tokenRows.nth(i)
        const usdValueElement = row.locator('.usd-value')
        await expect(usdValueElement).toBeVisible()

        const usdValueText = await usdValueElement.textContent()
        expect(usdValueText).toBeTruthy()

        // Parse USD value text to numeric value (supports extended decimals like "$0.000123")
        const numericValue = usdValueText
          ? parseFloat(usdValueText.replace(/[^0-9.]/g, '')) || 0
          : 0

        usdValues.push(numericValue)
      }

      // Assert that values are in non-increasing order (descending)
      // Each value should be >= the next value
      for (let i = 0; i < usdValues.length - 1; i++) {
        const currentValue = usdValues[i]
        const nextValue = usdValues[i + 1]
        // Test will fail here if sorting is incorrect
        if (currentValue < nextValue) {
          throw new Error(
            `Tokens are not sorted correctly: token at index ${i} has value $${currentValue.toFixed(2)} which is less than token at index ${i + 1} with value $${nextValue.toFixed(2)}`
          )
        }
        expect(currentValue).toBeGreaterThanOrEqual(nextValue)
      }
    }
  })
  test('should handle loading states', async ({ page }) => {
    // Intercept API requests to control loading state
    await page.route('**/api/zerion/positions**', async route => {
      // Use Promise-based delay instead of deprecated waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })

    // Watch an address
    await fillAddressAndWaitForModalClose(page)

    // Check for loading state while request is delayed
    const loadingState = page.getByTestId('loading-state')
    await expect(loadingState).toBeVisible()

    // After loading completes, should show token list
    const tokenList = page.getByTestId('token-list')
    await expect(tokenList).toBeVisible()

    // Clean up route handler before test ends
    await page.unroute('**/api/zerion/positions**')
  })

  test('should handle error states', async ({ page }) => {
    // Intercept API requests and simulate failure
    await page.route('**/api/zerion/positions**', route => {
      route.abort('failed')
    })

    // Watch an address
    await fillAddressAndWaitForModalClose(page)

    // Verify error state is displayed
    const errorState = page.getByTestId('error-state')
    await expect(errorState).toBeVisible()

    // Verify retry button is present
    const retryButton = page.getByTestId('retry-button')
    await expect(retryButton).toBeVisible()

    const tokenList = page.getByTestId('token-list')
    await expect(tokenList).toBeVisible()

    // Clean up route handler before test ends
    await page.unroute('**/api/zerion/positions**')
  })
})
