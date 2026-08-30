## `_anyInvariantIncreased` in contracts/src/ArbFoldCoordinator.sol (L185-L193)

**Purpose:** Determines whether at least one pool's CPMM product strictly
increased across a complete nonzero fold call.

**Inputs & Assumptions:** Two bounded `Network` snapshots supplied by `fold`.
Products fit checked `uint256` because each live reserve is bounded by
`MAX_NETWORK_RESERVE` on intended paths.

**Outputs & Effects:** Pure boolean; no effects.

**Block-by-Block:**

```solidity
// L190-L192
return afterState.abA * afterState.abB > ... || ...;
```
- **What:** ORs strict product increases for AB, BC and AC.
- **Why here:** Entire function is the call-level material-improvement predicate.
- **Assumes:** `x*y` is the intended liquidity proxy.
- **Establishes:** true means at least one strict product gain.
- **Depended on by:** `fold`'s `NoInvariantIncrease` guard.

**Cross-Function Dependencies:** No callees. Complements per-round
`_assertNonDecreasing`.

**Open Questions:** Whether strict one-wei product increase is the intended
meaning of “material” is not parameterized in source.

