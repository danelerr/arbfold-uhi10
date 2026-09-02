## `totalFoldCalls` in contracts/src/ArbFoldCoordinator.sol (L112-L114)

**Purpose:** Exposes the lifetime count of successful `fold` calls.

---

**Inputs & Assumptions:** No input; reads `_telemetry.foldCalls`, written only by `_recordTelemetry`.

---

**Outputs & Effects:** Zero-extends `uint64` to `uint256`. No calls, writes or events.

---

**Block-by-Block:**

```solidity
// L112-L114
return uint256(_telemetry.foldCalls);
```
- **What:** Returns the packed counter.
- **Why here:** Preserves a `uint256` external ABI.
- **Assumes:** `_recordTelemetry` did not truncate; enforced at L216-L226.
- **Establishes:** Read-only lifetime disclosure.
- **Depended on by:** live monitoring.

---

**Cross-Function Dependencies:** Shared state with `_recordTelemetry`; no callees.

---

**Open Questions:** None.

