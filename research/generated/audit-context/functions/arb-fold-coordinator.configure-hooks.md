## `configureHooks` in contracts/src/ArbFoldCoordinator.sol (L69-L87)

**Purpose:** One-time binding of exactly three hook instances to the fixed A/B,
B/C and A/C topology.

**Inputs & Assumptions:**
- Three hook addresses: semi-trusted deployment inputs.
- `msg.sender` must equal immutable admin (L70).
- Coordinator must not already be configured (L71).
- Each hook must expose source-compatible interface methods; external calls may
  revert.
- Successful future folds assume each hook has authorized the coordinator as
  ERC-6909 operator. This function does not check that state: **nothing found**.

**Outputs & Effects:** Writes `hookAB`, `hookBC`, `hookAC`, then `configured`
(L82-L85); emits `HooksConfigured` (L86). External view calls occur through
`_validateHook`.

**Block-by-Block:**

```solidity
// L70-L76
if (msg.sender != admin) revert NotAdmin(); ...
```
- **What:** Enforces admin, one-time execution, nonzero and pairwise-distinct hooks.
- **Why here:** Rejects invalid identities before any external inspection.
- **Assumes:** immutable `admin` is the intended configurator.
- **Establishes:** candidate identities are locally well-formed.
- **Depended on by:** `_validateHook` and final assignments.

```solidity
// L78-L80
_validateHook(hookAB_, tokenA, tokenB); ...
```
- **What:** Checks code, coordinator, manager and pool-key topology.
- **Why here:** Prevents persisting candidates before their cross-contract
  configuration is known.
- **Assumes:** each hook's getters reflect durable state.
- **Establishes:** each candidate currently matches its assigned pair.
- **Depended on by:** `isHook`, `network`, and direct claim transfers.

```solidity
// L82-L86
hookAB = hookAB_; ... configured = true; emit HooksConfigured(...);
```
- **What:** Commits the topology and marks it usable.
- **Why here:** `configured` is written after all identities.
- **Assumes:** validated hook keys cannot later change; inherited single-init
  pool key supplies this property.
- **Establishes:** `network` and `fold` can reach all three hooks.
- **Depended on by:** every operational coordinator function.

**Cross-Function Dependencies:** `_validateHook` (private) must validate all
four links. Callers: immutable admin only. Shared state is written nowhere else.

**Open Questions:** Is ERC-6909 operator authorization formally part of
“configured,” despite not being inspected here?

