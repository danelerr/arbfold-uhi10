## `_assertNonDecreasing` in contracts/src/ArbFoldCoordinator.sol (L256-L265)

**Purpose:** Enforces per-round nondecrease of every virtual CPMM product.

---

**Inputs & Assumptions:** Before/after states derived inside `_applyDirect`; values remain within declared network bounds on successful setter paths.

---

**Outputs & Effects:** Pure; reverts `InvariantDecreased` if any product falls. No calls/writes/events.

---

**Block-by-Block:**

```solidity
// L260-L264
if (after.abA * after.abB < before.abA * before.abB || ...) revert InvariantDecreased();
```
- **What:** Three product comparisons joined by OR.
- **Why here:** Called before any reserve setter in `_applyDirect` L208-L213.
- **Assumes:** Virtual reserves represent the intended liquidity quantities; claim balances are outside this calculation.
- **Establishes:** No modeled pool product decreased for the round.
- **Depended on by:** safety characterization and final strict-increase check.

---

**Cross-Function Dependencies:** No callees. Only `_applyDirect` calls it.

---

**Open Questions:** None within the virtual-reserve model.

