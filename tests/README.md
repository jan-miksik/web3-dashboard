# Testing Guide

This project uses **Vitest** for unit tests and **Cypress** for E2E tests.

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


## E2E Tests (Cypress)

### Running E2E Tests

```bash
# Run E2E tests headlessly
pnpm test:e2e

# Open Cypress Test Runner
pnpm test:e2e:open
```

### Vitest Issues

- Ensure `nuxt prepare` has been run: `pnpm postinstall`
- Clear `.nuxt` directory if tests fail to find modules
- Check that all dependencies are installed: `pnpm install`

### Cypress Issues

- Ensure the dev server is running on `http://localhost:3000` before running E2E tests
- Check browser compatibility if tests fail
- Use `cypress open` to debug tests interactively
