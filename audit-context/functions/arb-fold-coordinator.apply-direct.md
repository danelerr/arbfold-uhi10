## `_applyDirect` in contracts/src/ArbFoldCoordinator.sol (L144-L183)

**Purpose:** Applies one quote as direct ERC-6909 claim movements, checks the
proposed virtual transition, then synchronizes all six hook reserves.

**Inputs & Assumptions:**
- `n`: trusted only as a fresh `network()` snapshot supplied by `fold`.
- `q`: trusted only as `CycleMath.best(n)` supplied by `fold`.
- `reward`: supplied as `q.profitA * 1000 / 10000` by `fold`.
- `solver`: previously checked nonzero.
- Assumes each hook's claims equal the corresponding fields of `n`: **nothing
  found in this function verifies balances**.
- Assumes coordinator operator approval exists for each hook.

**Outputs & Effects:** Four claim transfers per direction, three safety checks
(non-decrease plus three-token conservation), and three external reserve writes.
No return or event here. Any failed call reverts all earlier effects.

**Block-by-Block:**

```solidity
// L147-L150
CycleMath.Network memory afterState = CycleMath.Network({...});
```
- **What:** Copies all six fields rather than aliasing memory.
- **Why here:** Preserves independent before/after snapshots for later checks.
- **Assumes:** all relevant network state is captured by these six fields.
- **Establishes:** mutating `afterState` cannot mutate `n`.
- **Depended on by:** both directional transitions and safety comparisons.

```solidity
// L151-L162
if (!q.reverse) { manager.transferFrom(...); ... afterState...; }
```
- **What:** Moves A AC->AB plus A reward AC->solver, B AB->BC and C BC->AC;
  applies matching forward reserve deltas.
- **Why here:** Claim movement precedes virtual ledger writes.
- **Assumes:** source claim balances cover every transfer and quote values match
  the fresh state.
- **Establishes:** proposed forward after-state conserves B/C and accounts A
  reward if arithmetic succeeds.
- **Depended on by:** safety checks and reserve writes.

```solidity
// L163-L175
else { manager.transferFrom(...); ... afterState...; }
```
- **What:** Moves A AB->AC plus reward AB->solver, C AC->BC and B BC->AB;
  applies matching reverse reserve deltas.
- **Why here:** Direction mirrors the selected quote.
- **Assumes:** same claim/quote continuity as forward path.
- **Establishes:** proposed reverse after-state.
- **Depended on by:** safety checks and reserve writes.

```solidity
// L177-L182
_assertNonDecreasing(...); _assertConservation(...);
hookAB.setReservesFromCoordinator(...); ...
```
- **What:** Validates the proposal then commits all virtual reserves.
- **Why here:** Invalid proposals revert before any virtual ledger write; EVM
  atomicity also rolls back preceding claim transfers.
- **Assumes:** each hook accepts only this coordinator and applies exact fields.
- **Establishes:** stored reserves correspond to the intended post-transfer
  claim allocation along normal source paths.
- **Depended on by:** next fold round and all subsequent swaps.

**Cross-Function Dependencies:** `PoolManager.transferFrom` uses ERC-6909
operator/allowance checks then checked balance subtraction
(`ERC6909.sol:L35-L47`). `_assertNonDecreasing`, `_assertConservation`, and each
hook's `setReservesFromCoordinator` must all succeed.

**Open Questions:** Runtime equality of virtual reserves, claims and underlying
backing is assumed rather than recomputed here.

