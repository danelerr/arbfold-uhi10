## `totalFoldRounds` in contracts/src/ArbFoldCoordinator.sol (L116-L118)

**Purpose:** Exposes the lifetime total of completed direct rounds.

---

**Inputs & Assumptions:** No input; reads `_telemetry.foldRounds`.

---

**Outputs & Effects:** Zero-extends `uint64` to `uint256`; no calls/writes/events.

---

**Block-by-Block:**

```solidity
// L116-L118
return uint256(_telemetry.foldRounds);
```
- **What:** Returns the packed aggregate.
- **Why here:** Independent getter for monitoring.
- **Assumes:** Only completed successful folds reach `_recordTelemetry`.
- **Establishes:** Read-only lifetime disclosure, not per-call rounds.
- **Depended on by:** demo and live checker.

---

**Cross-Function Dependencies:** Shared state with `_recordTelemetry`; no callees.

---

**Open Questions:** None.

