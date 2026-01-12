# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build

pnpm test         # Run unit tests in watch mode
pnpm test:run     # Run unit tests once
pnpm test:ui      # Run tests with Vitest UI
pnpm test:coverage # Run tests with coverage

pnpm test:e2e     # Run Playwright E2E tests
pnpm test:e2e:ui  # Run E2E tests with Playwright UI
pnpm test:e2e:headed # Run E2E tests in headed browser

pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm format       # Format with Prettier
```

## Architecture Overview

This is a **Nuxt 4 + Vue 3** web3 dashboard with **SSR disabled** (required for wallet interactions).

### Core Web3 Stack

- **Reown AppKit**: Wallet connection UI (social logins, hardware wallets, browser wallets)
- **Wagmi/Viem**: Blockchain interactions and transaction building
- **LI.FI SDK**: Cross-chain route discovery and swap execution
- **Zerion API**: Token balance and portfolio data (proxied via server API)

### Key Directories

```
/app
  /components       # Vue components
  /composables      # State management (Vue composables, not Pinia)
  /pages            # Nuxt pages
  /plugins          # Client-only web3 initialization
  /utils            # Utilities (chain mappings, error handling, formatting)
  /types            # TypeScript definitions

/server/api/zerion  # Server-side Zerion API proxy
/tests/unit         # Vitest unit tests
/tests/e2e          # Playwright E2E tests
```

### State Management Pattern

**Server state** uses Vue Query (`@tanstack/vue-query`):

- `useTokens()` - fetches wallet positions via `/api/zerion/positions`
- Auto-refetches on page visibility, 5-minute intervals

**Client state** uses composables with global refs:

- `useTxComposer()` - multi-token swap composition with quote caching
- `useBatchComposer()` - EIP-7702/EIP-5792 batch transaction execution
- `useWatchedAddress()` - localStorage-persisted watch mode
- `useTokenList()` - UI state (filters, sorting, chain selection)

### Web3 Initialization

Two client-only plugins handle initialization:

- `appkit.client.ts` - Reown AppKit with HMR guard to prevent re-init flapping
- `wagmi.client.ts` - WagmiAdapter singleton + Vue Query provider

The HMR guard uses a global flag (`__web3_dashboard_appkit_initialized__`) to prevent connect/disconnect cycles during hot reload.

### Multi-Chain Support

10 supported chains: Ethereum, Base, Optimism, Arbitrum, Polygon, Avalanche, Fantom, Celo, Gnosis, zkSync Era

Chain utilities in `utils/chains.ts`:

- `CHAIN_METADATA` - canonical chain info source
- `ZERION_TO_CHAIN_ID` / `CHAIN_ID_TO_ZERION` - API mapping tables
- Chain icons from LlamaAI CDN

### Transaction Composer System

The tx-composer feature (`/components/tx-composer/`, `composables/useTxComposer.ts`) enables:

- Multi-token → single destination swaps via LI.FI
- Quote caching (2min TTL) to reduce API calls
- Custom amount overrides per token
- Automatic chain switching during execution

### Batch Transaction Support

`useBatchComposer()` handles three execution strategies:

1. **EIP-7702** - Delegate wallet execution to batch executor contract (best UX)
2. **EIP-5792** - Native wallet batch call requests (MetaMask, etc.)
3. **Sequential fallback** - Individual transactions when batching unsupported

Batch executor contract: `0x00000000000009F66F6BCb8B4F27AD39cE5E2c2b` (CREATE2 canonical)

**Wallet Batch Limits** (`useBatchTransaction.ts`):

- MetaMask: 10 calls max per batch
- Rabby: 100 calls max
- Coinbase: 50 calls max
- Unknown: 10 calls (safe default, matches strictest limit)

When calls exceed the limit, the system automatically splits into multiple batches executed sequentially.

**Transaction Count per Token**:

- Native tokens (ETH, etc.): 1 call (swap only)
- ERC20 tokens: 2 calls (approval + swap)

Note: Each swap may route through different DEXs, requiring separate approvals per spender. See `useBatchComposer.ts` for optimization notes on Permit2 and other potential improvements.

### Server API

`/server/api/zerion/positions.get.ts`:

- Validates addresses with viem
- Handles Zerion pagination (up to 100 pages)
- Returns 202 if portfolio still preparing
- Validates responses with Zod schemas

### Error Handling

Centralized in `utils/error-handler.ts`:

- Maps error types to user-friendly messages
- Integrates with `useNotifications()` for user feedback
- Conditional logging based on environment

## Environment Variables

Required in `.env`:

```
NUXT_PUBLIC_REOWN_PROJECT_ID=your_project_id
NUXT_ZERION_API_KEY=your_zerion_key
NUXT_PUBLIC_APP_URL=http://localhost:3000
```

## Important Patterns

1. **All web3 code is client-only** - never import wagmi/viem/appkit in server code
2. **Token IDs are composite** - format: `{chainId}:{address}` for uniqueness
3. **Watch mode** - users can view any wallet without connecting via `useWatchedAddress()`
4. **Quote caching** - LI.FI quotes are cached 2min to prevent excessive API calls
5. **Page visibility polling** - token fetching pauses when tab is hidden
