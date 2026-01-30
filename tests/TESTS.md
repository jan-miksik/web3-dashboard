# Unit Test Rationale

This document explains **why** each test file exists and **what** it secures. Tests are kept minimal—we avoid "tests for tests" and focus on behavior that would cause real user impact if broken.

**Coverage target:** 80% lines, 78% statements on in-scope files. Some files are excluded (see below).

## What We Test

| File                                | Secures                                      | Why It Matters                                                                                                       |
| ----------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **format.test.ts**                  | USD display logic                            | Wrong formatting misleads users about portfolio value. Dust amounts (<$0.01) and large values must render correctly. |
| **tokenAddresses.test.ts**          | Token/chain metadata                         | Wrong addresses cause failed txs, wrong chains, or lost funds. Used by tx composer for target selection.             |
| **zerion-schema.test.ts**           | Zerion API response validation               | Malformed API data crashes the app or shows wrong balances. Schemas are the contract for `positions.get`.            |
| **error-handler.test.ts**           | Error→user message mapping                   | Users see friendly messages instead of raw errors. Type detection (network, auth, etc.) must work.                   |
| **logger.test.ts**                  | Log format structure                         | Logger output feeds dev tools and error tracking. Format changes break parsing.                                      |
| **chains.test.ts**                  | Chain metadata and Zerion↔chainId mapping    | Wrong chain IDs break API calls and display. Used everywhere tokens are shown.                                       |
| **useTokens.test.ts**               | Address resolution (connected vs watched)    | Ensures correct wallet is used for balance fetch. Watch mode must work when disconnected.                            |
| **useWatchedAddress.test.ts**       | localStorage persistence, address validation | Watch mode is a key feature; invalid addresses must be rejected.                                                     |
| **useNotifications.test.ts**        | Add/remove/clear notifications               | Users must see errors and success feedback. Broken notifications = silent failures.                                  |
| **useComposerAmountDrafts.test.ts** | Amount parsing, clamping, BigInt handling    | Incorrect parsing can over-spend or leave dust. Critical for fund safety.                                            |
| **useBatchTransaction.test.ts**     | Wallet batch limits, executor address        | Exceeding limits causes failed txs. Wrong executor breaks EIP-7702.                                                  |
| **positions.get.test.ts**           | Server API: validation, pagination, errors   | API proxy must validate input, handle Zerion responses, return correct shape.                                        |
| **Component tests**                 | Render, props, user flows                    | Basic sanity that UI doesn’t crash and key interactions work.                                                        |

## Excluded from Coverage (vitest.config.ts)

These files are excluded from the coverage report because they require a full runtime (wallet, LI.FI SDK) or are thin UI wrappers better exercised by E2E:

- **app/plugins/** — Bootstrap and external lib setup
- **app/pages/** — Routing wrappers
- **app/composables/** (useBatchTransaction, useTxComposer, useComposerQuotes, useComposerBatchSupport, useComposerTargetState, useComposerBatchingUi, useBatchComposer, useTokenList, useTokens) — Wagmi/LI.FI integration
- **app/utils/wagmi.ts** — Config singleton
- **app/components/NetworkFilter.vue, ConnectWalletModal.vue** — Complex wallet/chain UI

We still **run** unit tests that import these composables (e.g. `useTokens.test.ts`, `useBatchTransaction.test.ts`) for testable logic such as constants, parsing, and validation; they are excluded from coverage because they include untestable runtime dependencies (Wagmi, LI.FI). So: tests run, coverage is excluded for those files.

## What We Don’t Test

- **Plugins** (appkit, wagmi): Integration points with external libs; better covered by E2E.
- **LI.FI / swap execution**: Requires live SDK; E2E or integration tests are more appropriate.
- **Every optional schema field**: Zerion schemas have many optional fields; we test the critical paths (required fields, invalid types, API response shape).
- **Literal constant assertions**: We do not assert specific constant values (e.g. `WALLET_BATCH_LIMITS.metamask === 10`) for their own sake. Instead we test the **structure and enforcement** of wallet batch limits: that the batch composition logic in `useBatchTransaction` applies limits from `WALLET_BATCH_LIMITS` when forming batches (see `useBatchTransaction.test.ts`). Readers should understand we are testing behavior and invariants, not literal constant values.

## Running Tests

```bash
pnpm test:run        # Run once
pnpm test:coverage   # With coverage report
pnpm test            # Watch mode
```
