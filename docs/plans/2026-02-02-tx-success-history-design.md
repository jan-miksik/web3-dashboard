# Transaction Success Overview + History

## Summary

Add a new “Transaction Recap” unit under the Transaction Preview box in the composer.
It shows a success overview for the latest app-initiated success and a local-only
history list (5 items with “Show more” for all). History excludes user-rejected
transactions.

## Placement

- Render as an independent card directly under the Transaction Preview box.
- Only visible when:
  - a latest successful app-initiated transaction exists, or
  - history has at least one entry.

## Success Overview (top of card)

Primary row (left-to-right):

- Status pill: Success
- Timestamp (relative, e.g., “2m ago”)
- Chain label + icon
- Output summary (token received + amount)
- Explorer link for final hash

Secondary grid (compact, 2–3 columns depending on width):

- Total input (sum of source tokens)
- Total output (destination token)
- Fees (if available)
- Batch count (if available)
- Hash (shortened, copyable)

## Recent Transactions (bottom of card)

- Show latest 5 app-initiated transactions by default.
- “Show more” expands to full list for the address.
- Each row includes:
  - chain icon + chain name
  - output token amount (or placeholder when unknown)
  - short hash + explorer link
  - status pill (success, pending, failed)
  - timestamp

## Data Model

Local-only record keyed by `chainId + hash`.

```
type AppTxRecord = {
  hash: string;
  chainId: number;
  status: 'submitted' | 'pending' | 'success' | 'failed';
  timestamp: number; // ms
  source: 'app';
  inputSummary?: string;  // e.g. "0.5 ETH + 200 USDC"
  outputSummary?: string; // e.g. "640 OP"
  feeSummary?: string;
  batchCount?: number;
  explorerUrl?: string;
};
```

## Storage

- LocalStorage key includes wallet address (or watched address):
  `web3-dashboard:tx-history:<address>`.
- If localStorage fails, fall back to in-memory list for the session.
- Only show items with `source: 'app'`.
- Do not store user-rejected transactions.

## Update Rules

- On submit: create record with status `submitted` and known metadata.
- On receipt: update status to `success` and fill output/fee/batch details.
- On error: if error is user-rejection, do nothing. Otherwise store `failed`.
- Out-of-order updates should insert when missing.

## User-Rejected Detection (assumption)

Treat user rejection as:

- EIP-1193 error code `4001`
- Error messages containing “user rejected” or “User denied”
  These are excluded from history.

## Composable API

Create `useTransactionHistory()`:

- `recentTransactions` (latest 5)
- `allTransactions`
- `latestSuccess`
- `addTransaction(record)`
- `updateTransaction(hash, chainId, patch)`
- `clearHistory()` (optional for future)

## Component Structure

New component under `components/tx-composer/ComposerWidget/`:

- `ComposerTransactionRecap.vue`
- Props: latest summary + history list
- Emits: none (local toggle for “Show more”)

Integrate into `ComposerWidget/index.vue` directly under Transaction Preview.

## Error Handling

- Placeholder dashes when output/fee unknown.
- If no recent items and no latest success, hide card.
- LocalStorage read/write failures log to console and continue with in-memory list.

## Testing Plan

- Composable unit tests:
  - add/update works
  - filters by address
  - excludes user-rejected
  - show more slicing
- Component unit tests:
  - renders success overview for latest success
  - shows 5 items by default
  - show more expands
  - excludes when no data
