## `_anyInvariantIncreased` in contracts/src/ArbFoldCoordinator.sol (L246-L254)

**Purpose:** Requires at least one strict CPMM product increase across a nonzero-round fold.

---

**Inputs & Assumptions:** Before/after memory networks already within CycleMath reserve bounds on the successful path.

---

**Outputs & Effects:** Pure boolean; no calls/writes/events.

---

**Block-by-Block:**

```solidity
// L251-L253
return after.abA * after.abB > before.abA * before.abB || ...;
```
- **What:** ORs strict product comparisons for AB, BC, AC.
- **Why here:** Fold applies it after all rounds, while per-round nondecrease is checked separately.
- **Assumes:** Multiplication fits; max reserve `3_000_000 ether` from `CycleMath.sol:L14` bounds each product below `uint256` maximum.
- **Establishes:** At least one modeled product increased.
- **Depended on by:** `fold` L156.

---

**Cross-Function Dependencies:** No callees; coupled with `_assertNonDecreasing`.

---

**Open Questions:** None.

