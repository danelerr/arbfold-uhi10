## `_assertConservation` in contracts/src/ArbFoldCoordinator.sol (L267-L281)

**Purpose:** Enforces token-wise conservation across hook virtual reserves, treating solver reward as token A leaving the hook set.

---

**Inputs & Assumptions:** Before/after networks and reward are trusted internal values. Assumes token identities are distinct semantic units.

---

**Outputs & Effects:** Pure; reverts with token index and totals on mismatch. No calls/writes/events.

---

**Block-by-Block:**

```solidity
// L272-L280
beforeTotal = before.abA + before.acA;
afterTotal = after.abA + after.acA + reward;
... repeat for B and C ...
```
- **What:** Compares aggregate A (including reward), B and C.
- **Why here:** Called after all per-field arithmetic but before setters.
- **Assumes:** No other holder/ledger quantity belongs to this modeled conservation equation.
- **Establishes:** Exact virtual conservation for each token in one round.
- **Depended on by:** `_applyDirect` success.

---

**Cross-Function Dependencies:** No callees. Only `_applyDirect` calls it.

---

**Open Questions:** If constructor permits equal token addresses, the three token-index equations cease to represent distinct assets; distinctness is established by the public deployer, not this contract.
