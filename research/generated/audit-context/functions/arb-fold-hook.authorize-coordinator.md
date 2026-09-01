## `authorizeCoordinator` in contracts/src/ArbFoldHook.sol (L53-L59)

**Purpose:** Grants the immutable coordinator ERC-6909 operator authority over
this hook's PoolManager claims exactly once from the hook's local perspective.

**Inputs & Assumptions:** No explicit input. Callable by anyone. Assumes the
immutable coordinator was correctly selected at construction.

**Outputs & Effects:** On first call, writes `_coordinatorAuthorized`, calls
`poolManager.setOperator(coordinator, true)`, emits `CoordinatorAuthorized`.
Later calls do nothing.

**Block-by-Block:**

```solidity
// L54-L58
if (!_coordinatorAuthorized) {
    _coordinatorAuthorized = true;
    poolManager.setOperator(coordinator, true);
    emit CoordinatorAuthorized(coordinator);
}
```
- **What:** Idempotently grants claim-transfer authority.
- **Why here:** Local flag suppresses repeated manager writes/events.
- **Assumes:** `setOperator` either succeeds fully or reverts; v4 writes
  `isOperator[msg.sender][operator]` (`ERC6909.sol:L58-L63`).
- **Establishes:** after successful first call, manager records coordinator as
  operator for this hook.
- **Depended on by:** coordinator `_applyDirect` claim transfers.

**Cross-Function Dependencies:** External-source-available
`PoolManager.setOperator`. Called during deployment/test initialization, but
not required by `configureHooks`.

**Open Questions:** Is authorization intended to be a formal prerequisite of
configuration or a separate deployment invariant?

