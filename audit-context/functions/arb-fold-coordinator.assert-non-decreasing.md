## `_assertNonDecreasing` in contracts/src/ArbFoldCoordinator.sol (L195-L204)

**Purpose:** Rejects a direct round that lowers any participating CPMM product.

**Inputs & Assumptions:** Independent bounded before/after snapshots. Assumes
`x*y` is the complete runtime acceptance metric for each pool.

**Outputs & Effects:** Pure; returns normally or reverts `InvariantDecreased`.

**Block-by-Block:**

```solidity
// L199-L203
if (afterAB < beforeAB || afterBC < beforeBC || afterAC < beforeAC) revert ...;
```
- **What:** Compares all three products.
- **Why here:** Called after proposed state arithmetic and before reserve writes.
- **Assumes:** snapshots do not alias; `_applyDirect` explicitly field-copies.
- **Establishes:** every accepted round is non-decreasing under this metric.
- **Depended on by:** reserve commit and thesis-level Pareto proxy.

**Cross-Function Dependencies:** Called only by `_applyDirect`; no callees.

**Open Questions:** The source contains no alternative pool utility or valuation
metric beyond product monotonicity.

