## `_assertConservation` in contracts/src/ArbFoldCoordinator.sol (L206-L220)

**Purpose:** Checks token totals in the proposed virtual transition, treating
solver reward as the only A that leaves hook reserves.

**Inputs & Assumptions:** Independent before/after network snapshots and the
round reward. Assumes no other owner is part of the network accounting.

**Outputs & Effects:** Pure; returns normally or reverts with token index and
before/after totals.

**Block-by-Block:**

```solidity
// L211-L213
beforeTotal = beforeState.abA + beforeState.acA;
afterTotal = afterState.abA + afterState.acA + reward;
```
- **What:** Conserves A including explicit solver outflow.
- **Why here:** A is the cycle numeraire and only rewarded token.
- **Assumes:** solver receives exactly `reward` claims in `_applyDirect`.
- **Establishes:** accepted virtual A outflow equals reward.
- **Depended on by:** direct reserve commit.

```solidity
// L214-L219
... B totals ...; ... C totals ...;
```
- **What:** Requires exact B and C conservation between their two pools.
- **Why here:** Neither token has an external recipient.
- **Assumes:** all network-owned B/C appear in these four fields.
- **Establishes:** no virtual B/C enters or leaves an accepted round.
- **Depended on by:** direct reserve commit.

**Cross-Function Dependencies:** Called only by `_applyDirect`; no callees.

**Open Questions:** It checks the virtual ledger, not ERC-6909 balances or
underlying PoolManager custody.

