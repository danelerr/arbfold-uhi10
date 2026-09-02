## `_recordTelemetry` in contracts/src/ArbFoldCoordinator.sol (L216-L227)

**Purpose:** Atomically advances packed lifetime counters without truncation.

---

**Inputs & Assumptions:** `rounds` and `rewards` are trusted per-call aggregates. Reads `_telemetry`.

---

**Outputs & Effects:** Reverts on any field overflow; otherwise overwrites the packed struct. No external calls/events.

---

**Block-by-Block:**

```solidity
// L217-L220
Telemetry memory telemetry = _telemetry;
if (telemetry.foldCalls == type(uint64).max) revert ...;
if (rounds > type(uint64).max - telemetry.foldRounds) revert ...;
if (rewards > type(uint128).max - telemetry.solverRewards) revert ...;
```
- **What:** Snapshots and checks every lifetime bound.
- **Why here:** Prevents partial/truncated packed writes.
- **Assumes:** Solidity checked subtraction/addition; enforced by 0.8.26.
- **Establishes:** All additions/casts fit their target types.
- **Depended on by:** L222-L226.

```solidity
// L222-L226
_telemetry = Telemetry({foldCalls: telemetry.foldCalls + 1, ...});
```
- **What:** Commits all counters in one storage assignment.
- **Why here:** After all three checks.
- **Assumes:** `SafeCast` follows checked semantics; OpenZeppelin source is vendored.
- **Establishes:** Exact cumulative counters, or no state on revert.
- **Depended on by:** telemetry getters.

---

**Cross-Function Dependencies:** OpenZeppelin `SafeCast` (external-source-available library). Only caller is `fold`.

---

**Open Questions:** Lifetime exhaustion policy is not defined; at the bound, future folds revert.

