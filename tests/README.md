# Testing Guide

This project uses **Vitest** for unit tests and **Playwright** for E2E tests.

## Unit Tests (Vitest)

### Running Unit Tests

```bash
# Run tests in watch mode
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests once
pnpm test:run

# Run tests with coverage
pnpm test:coverage
```

## E2E Tests (Playwright)

### Running E2E Tests

```bash
# Run E2E tests headlessly
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Run E2E tests in headed mode (see browser)
pnpm test:e2e:headed
```

### Initial Setup

On first run, you need to install Playwright browsers:

```bash
npx playwright install
```

### Vitest Issues

- Ensure `nuxt prepare` has been run: `pnpm postinstall`
- Clear `.nuxt` directory if tests fail to find modules
- Check that all dependencies are installed: `pnpm install`

### Playwright Issues

- The dev server will start automatically before running tests (configured in `playwright.config.ts`)
- If tests fail, check the HTML report: `npx playwright show-report`
- Use `test:e2e:headed` to debug tests visually
- Ensure browsers are installed: `npx playwright install`
