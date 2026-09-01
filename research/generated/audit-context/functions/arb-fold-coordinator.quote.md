## `quote` in contracts/src/ArbFoldCoordinator.sol (L101-L103)

**Purpose:** Exposes the currently best A-denominated forward/reverse cycle
quote without applying it.

**Inputs & Assumptions:** No explicit inputs. Requires a configured and
arithmetically bounded network through its callees.

**Outputs & Effects:** Returns a `CycleMath.Quote`. No writes or events; performs
the three hook reserve reads inside `network()`.

**Block-by-Block:**

```solidity
// L102
return CycleMath.best(network());
```
- **What:** Snapshots and quotes the network.
- **Why here:** Single-expression view adapter.
- **Assumes:** `CycleMath.best`'s fixed fee and numeraire match the hooks.
- **Establishes:** returned quote is the larger of the two library-computed cycles.
- **Depended on by:** offchain/UI callers; `fold` recomputes rather than trusts it.

**Cross-Function Dependencies:** `network`; `CycleMath.best` and all its private
math callees.

**Open Questions:** A quote can become stale before another transaction applies
a swap; no caller in core uses this external quote as authorization.

