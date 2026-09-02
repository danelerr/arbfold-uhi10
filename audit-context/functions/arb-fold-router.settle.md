## `_settle` in contracts/src/ArbFoldRouter.sol (L112-L116)

**Purpose:** Clears this router's transient debt or credit for one currency.

---

**Inputs & Assumptions:** `currency` comes from registered hook key; `payer` is original external caller. Assumes execution is inside active manager unlock.

---

**Outputs & Effects:** Reads transient `currencyDelta`; on debt transfers payer ERC-20/native funds through `CurrencySettler`; on credit calls manager take to payer; zero does nothing.

---

**Block-by-Block:**

```solidity
// L113-L115
int256 delta = manager.currencyDelta(address(this), currency);
if (delta < 0) currency.settle(manager, payer, SafeCast.toUint256(-delta), false);
else if (delta > 0) currency.take(manager, payer, SafeCast.toUint256(delta), false);
```
- **What:** Branches on router debt/credit and pays or withdraws exact nominal amount.
- **Why here:** Called after swap has fully accounted hook deltas.
- **Assumes:** Negating delta is representable; v4 deltas are bounded by int128 components on this path. Assumes token transfer semantics accepted by `CurrencySettler`.
- **Establishes:** This currency's transient router delta becomes zero in intended manager.
- **Depended on by:** unlock's global nonzero-delta guard.

---

**Cross-Function Dependencies:** `TransientStateLibrary.currencyDelta`; `CurrencySettler.settle/take` external-source-available, with ERC-20 call treated as generic external token for non-demo deployments.

---

**Open Questions:** None for public DemoToken deployment.
