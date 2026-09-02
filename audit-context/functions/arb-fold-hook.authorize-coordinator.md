## `authorizeCoordinator` in contracts/src/ArbFoldHook.sol (L53-L59)

**Purpose:** Requests a one-way ERC-6909 operator approval from the hook to its immutable coordinator and suppresses repeated requests locally.

---

**Inputs & Assumptions:**
- No explicit inputs; any address may call this function (L53).
- Implicit: `_coordinatorAuthorized` (L37), immutable `coordinator` (L34), immutable `poolManager` (`BaseHook.sol:L34`), `msg.sender`, and gas.
- Precondition: the manager must implement `setOperator` with the expected owner/operator semantics; checked-in implementation at `ERC6909.sol:L58-L63`, runtime identity established by **nothing found** in the hook.
- Precondition for later coordinator transfers: all relevant hooks must have completed this call successfully; configuration does not establish that (`ArbFoldCoordinator.sol:L75-L94`).

---

**Outputs & Effects:**
- First successful path writes `_coordinatorAuthorized = true` (L55), calls `poolManager.setOperator(coordinator, true)` (L56), and emits `CoordinatorAuthorized` (L57).
- Later calls return without writes, events, or external calls when the flag is already true (L54-L58).
- A revert from the external manager call rolls back the preceding flag write under transaction atomicity.
- The returned `bool` from `setOperator` is not inspected at L56.

---

**Block-by-Block:**

```solidity
// L54-L58
if (!_coordinatorAuthorized) {
    _coordinatorAuthorized = true;
    poolManager.setOperator(coordinator, true);
    emit CoordinatorAuthorized(coordinator);
}
```
- **What:** Marks the local request, asks the manager to approve the coordinator for all ERC-6909 ids, then emits the local event.
- **Why here:** Setting the flag before the external call makes a re-entered invocation take the no-op branch; a revert rolls the flag back.
- **Assumes:** successful return means the manager recorded `isOperator[address(this)][coordinator] = true`; established by checked-in `ERC6909.sol:L58-L63`, but runtime implementation identity is **nothing found**.
- **Establishes:** under that implementation, the coordinator may call `transferFrom` for this hook's claims without per-id allowance (`ERC6909.sol:L35-L47`).
- **Depended on by:** checked-in coordinator `_applyDirect`, which transfers claims from hook addresses (`ArbFoldCoordinator.sol:L175-L213`).

---

**Cross-Function Dependencies:**
- Callee `IPoolManager.setOperator` (external-source-available/identity-unproven, `IERC6909Claims.sol:L61-L65`; implementation `ERC6909.sol:L58-L63`): expected to set operator state for `msg.sender`, which is the hook.
- External-call outcomes not excluded by the hook: revert, success with behavior differing from the checked-in implementation, or re-entry before L57; code identity is **nothing found**.
- Callers: unrestricted; caller identity does not affect the approved owner or operator (L53-L56).
- Shared state: `_coordinatorAuthorized` is written only here (L37, L55) and has no public getter.
- Invariant coupling: local flag truth and manager operator truth coincide only under the expected manager behavior; no post-call `isOperator` read occurs.

---

**Open Questions:**
- unclear; need deployment/configuration procedure to establish that every hook was authorized before a fold requiring claim transfers.

