## `network` in contracts/src/ArbFoldCoordinator.sol (L94-L99)

**Purpose:** Materializes the six current virtual reserves in canonical
A/B-B/C-A/C layout.

**Inputs & Assumptions:** No explicit inputs. Requires configured hooks (L95).
Assumes each hook's `reserves()` corresponds to its validated pool key and that
the three external view calls observe one transactionally consistent EVM state.

**Outputs & Effects:** Returns `CycleMath.Network`; performs three external view
calls and no writes.

**Block-by-Block:**

```solidity
// L95-L98
if (!configured) revert NotConfigured();
(n.abA, n.abB) = hookAB.reserves(); ...
```
- **What:** Gates and reads all six reserve fields.
- **Why here:** No partial network is returned before full configuration.
- **Assumes:** validated hooks remain fixed and source-compatible.
- **Establishes:** a memory snapshot of the virtual ledger at this call point.
- **Depended on by:** `quote`, every fold round, final safety telemetry.

**Cross-Function Dependencies:** Callees `reserves` on all hooks simply return
stored reserve fields. `setReservesFromCoordinator`, swaps and liquidity paths
are their writers.

**Open Questions:** The function does not pair reads with ERC-6909 claim
balances; that equality is established by continuity, not this snapshot.

