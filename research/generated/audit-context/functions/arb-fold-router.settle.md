## `_settle` in contracts/src/ArbFoldRouter.sol (L112-L116)

**Purpose:** Nets this router's current PoolManager delta in one currency
against the payer.

**Inputs & Assumptions:** `currency` comes from a validated hook PoolKey;
`payer` is originating caller. Reads transient delta for `address(this)`.
Assumes payer approved input ERC-20 and PoolManager can transfer output.

**Outputs & Effects:** For negative delta, transfers exact debt from payer into
PoolManager and settles it. For positive delta, takes exact credit from manager
to payer. Zero is a no-op.

**Block-by-Block:**

```solidity
// L113-L115
int256 delta = manager.currencyDelta(address(this), currency);
if (delta < 0) currency.settle(...);
else if (delta > 0) currency.take(...);
```
- **What:** Branches on debt/credit sign and nets exact magnitude.
- **Why here:** Must clear both deltas before unlock returns.
- **Assumes:** magnitude fits uint256; negation of returned int256 delta is
  representable on intended v4 int128-based paths.
- **Establishes:** this router's selected currency delta becomes zero after
  successful helper call.
- **Depended on by:** PoolManager nonzero-delta gate.

**Cross-Function Dependencies:** `TransientStateLibrary.currencyDelta` reads
PoolManager transient storage (L35-L43). `CurrencySettler.settle` syncs and
transfers ERC-20 then calls manager settle; `take` calls manager take
(`CurrencySettler.sol:L32-L69`).

**Open Questions:** None within standard ERC-20/test-token assumptions.

