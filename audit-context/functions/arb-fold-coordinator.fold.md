## `fold` in contracts/src/ArbFoldCoordinator.sol (L131-L159)

**Purpose:** Repeatedly neutralizes the modeled cyclic profit by moving backed ERC-6909 claims among the three hooks and paying a solver share.

---

**Inputs & Assumptions:**
- `solver`: untrusted reward recipient. Must not be zero, coordinator, manager or any registered hook (L133-L135).
- `msg.sender`: must be a registered hook (L132).
- Assumes each hook's virtual reserves equal at least the claims the transition will debit. Direct equality check: nothing found.
- Assumes configured hooks implement intended setters/getters and granted operator status. Generic enforcement here: nothing found; public deployment verifier checks operator at `contracts/script/VerifyArbFoldDeployment.s.sol:L138-L140`.
- Assumes up to eight rounds is the intended termination budget; it does not assume the residual is always below threshold after round eight.

---

**Outputs & Effects:** Zero to eight `_applyDirect` calls; transfers claims, updates all reserves, accumulates rewards, writes packed telemetry and emits round/completion events. Any downstream revert unwinds the originating swap and all rounds.

---

**Block-by-Block:**

```solidity
// L132-L143
if (!isHook(msg.sender)) revert NotHook();
if (solver == address(0) || ... || isHook(solver)) revert InvalidSolver();
CycleMath.Network memory initialState = network();
CycleMath.Network memory currentState = initialState;
... rounds = 0; rewards;
```
- **What:** Authorizes identities and initializes independent memory state/telemetry.
- **Why here:** No transfers occur before all identity checks and baseline capture.
- **Assumes:** Address membership conveys authority and the first snapshot is coherent.
- **Establishes:** Valid caller/recipient and call-level baseline.
- **Depended on by:** loop and final invariant check.

```solidity
// L144-L151
for (; rounds < MAX_ROUNDS; ++rounds) {
    q = CycleMath.best(currentState);
    if (q.profitA <= RESIDUAL_THRESHOLD) break;
    uint256 reward = q.profitA * SOLVER_SHARE_BPS / BPS;
    currentState = _applyDirect(currentState, q, reward, solver);
    rewards += reward;
    emit FoldRound(...);
}
```
- **What:** Requotes every derived state, stops on threshold, applies one transition and records it.
- **Why here:** Each round consumes the previous round's returned state; the event follows successful transfers and reserve writes.
- **Assumes:** `CycleMath.best` and `_applyDirect` agree on direction/intermediates and reserve units.
- **Establishes:** Every completed round passed product/conservation checks and updated all intended hook reserves.
- **Depended on by:** terminal residual and aggregate counters.

```solidity
// L153-L158
uint256 residualProfit = _terminalResidual(currentState, q, rounds);
CycleMath.Network memory finalState = network();
if (!_sameNetwork(currentState, finalState)) revert StateDrift();
if (rounds != 0 && !_anyInvariantIncreased(...)) revert NoInvariantIncrease();
_recordTelemetry(rounds, rewards);
emit FoldCompleted(...);
```
- **What:** Computes disclosure, reconciles reported virtual state, checks call-level strict increase and commits telemetry/event.
- **Why here:** All rounds must be visible before the reconciliation and counters.
- **Assumes:** Comparing six virtual reserves is sufficient reconciliation; claims/backing are not read.
- **Establishes:** On success, reported reserves equal calculated state; if rounds > 0 at least one product is strictly greater; telemetry is exact within packed bounds.
- **Depended on by:** live consumers and invariant tests.

---

**Cross-Function Dependencies:** `isHook`, `network`, `CycleMath.best`, `_applyDirect`, `_terminalResidual`, `_sameNetwork`, `_anyInvariantIncreased`, `_recordTelemetry`. Called by `ArbFoldHook._beforeSwap` after user swap accounting (`contracts/src/ArbFoldHook.sol:L72-L83`). External calls are manager claim transfers and three hook setters inside `_applyDirect`.

---

**Open Questions:** Is residual ≤ threshold a protocol-wide postcondition? It is not enforced on the `MAX_ROUNDS` branch. Is claim/reserve equality intended to tolerate unsolicited inbound ERC-6909 claims?

