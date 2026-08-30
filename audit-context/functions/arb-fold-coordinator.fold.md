## `fold` in contracts/src/ArbFoldCoordinator.sol (L106-L128)

**Purpose:** Repeatedly applies the specialized direct three-pool transition
until quoted A profit is at most the residual threshold or eight rounds run.

**Inputs & Assumptions:**
- `solver`: untrusted reward recipient; must be nonzero (L108).
- `msg.sender`: must be one configured hook (L107).
- Assumes virtual reserves equal transferable hook claim balances on entry;
  direct runtime check: **nothing found**.
- Assumes all hooks previously authorized this coordinator as ERC-6909 operator;
  direct runtime check: **nothing found**.
- Assumes fixed token-A denomination is appropriate for profit, threshold and
  reward.

**Outputs & Effects:** May transfer ERC-6909 claims and overwrite all six hook
reserves through `_applyDirect`; increments reward and call/round telemetry;
writes residual; emits one event per round and one completion event. Returns no
value. Any revert unwinds the complete originating transaction.

**Block-by-Block:**

```solidity
// L107-L110
if (!isHook(msg.sender)) revert NotHook();
if (solver == address(0)) revert InvalidSolver();
CycleMath.Network memory initialState = network();
```
- **What:** Authorizes hook and solver, then captures call-level baseline.
- **Why here:** No state-changing round can happen first.
- **Assumes:** configured membership conveys authority to initiate folding.
- **Establishes:** valid identities and invariant-comparison baseline.
- **Depended on by:** loop and final `NoInvariantIncrease` check.

```solidity
// L112-L120
for (; rounds < MAX_ROUNDS; ++rounds) { ... }
```
- **What:** Re-snapshots, recomputes the best cycle, stops at threshold, pays a
  10% integer-truncated reward, applies the transition and records it.
- **Why here:** Recalculation makes each round depend on the state written by
  the preceding round.
- **Assumes:** `_applyDirect` preserves cross-ledger alignment and `best`
  computes the intended candidate.
- **Establishes:** each completed round passed per-pool product and conservation
  checks before reserve writes.
- **Depended on by:** final residual and aggregate counters.

```solidity
// L122-L127
CycleMath.Network memory finalState = network(); ... emit FoldCompleted(...);
```
- **What:** Requires a net product increase if rounds occurred, records current
  residual, call count and total rounds.
- **Why here:** Uses final state across all rounds.
- **Assumes:** `CycleMath.best(finalState)` is the desired residual disclosure.
- **Establishes:** telemetry describes the successfully committed final state.
- **Depended on by:** UI, events and invariant tests.

**Cross-Function Dependencies:** `isHook`, `network`, `CycleMath.best`,
`_applyDirect`, `_anyInvariantIncreased`. `fold` is called by
`ArbFoldHook._beforeSwap` only when nonempty valid hook data is present; a raw
configured hook address can also call it through its own code paths only.

**Open Questions:** What establishes sufficiency of eight rounds? What economic
scale underlies absolute `1e12` residual? What service does the caller-selected
solver supply in this onchain-computed v0?

