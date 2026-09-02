## `totalSolverRewards` in contracts/src/ArbFoldCoordinator.sol (L120-L122)

**Purpose:** Exposes nominal token-A claims paid to solvers over successful folds.

---

**Inputs & Assumptions:** No input; reads `_telemetry.solverRewards`. Assumes all rewards share token A unit, fixed by coordinator immutables.

---

**Outputs & Effects:** Zero-extends `uint128` to `uint256`; no calls/writes/events.

---

**Block-by-Block:**

```solidity
// L120-L122
return uint256(_telemetry.solverRewards);
```
- **What:** Returns the packed nominal reward sum.
- **Why here:** Keeps storage packed while exposing a conventional ABI type.
- **Assumes:** Successful manager transfers equal the recorded amounts; transaction atomicity and ERC6909 callee establish this for the intended manager.
- **Establishes:** Lifetime nominal disclosure, not current solver ownership after claim transfers.
- **Depended on by:** invariant tests and read-only accounting.

---

**Cross-Function Dependencies:** Shared state with `_recordTelemetry`; no callees.

---

**Open Questions:** None.
