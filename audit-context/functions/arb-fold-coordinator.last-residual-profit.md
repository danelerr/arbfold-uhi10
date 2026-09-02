## `lastResidualProfit` in contracts/src/ArbFoldCoordinator.sol (L124-L128)

**Purpose:** Discloses cyclic profit in the current state, despite the legacy-style `last` name.

---

**Inputs & Assumptions:** No explicit input. Requires configured, in-domain reserves through its callees.

---

**Outputs & Effects:** Returns `CycleMath.best(network()).profitA`; performs three external reads; no stored telemetry or events.

---

**Block-by-Block:**

```solidity
// L124-L128
function lastResidualProfit() public view returns (uint256) {
    return CycleMath.best(network()).profitA;
}
```
- **What:** Recomputes rather than reading a residual slot.
- **Why here:** Always reflects plain swaps or other reserve changes after a fold.
- **Assumes:** Current network is inside CycleMath bounds; a full withdrawal makes this revert.
- **Establishes:** Exact output of current library math, not historical last-fold residual.
- **Depended on by:** demo residual assertion and live checker.

---

**Cross-Function Dependencies:** `network`, `CycleMath.best`.

---

**Open Questions:** Whether downstream consumers interpret the name as historical telemetry; the NatSpec explicitly says current state (L124-L126).
