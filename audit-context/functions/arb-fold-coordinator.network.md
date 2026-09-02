## `network` in contracts/src/ArbFoldCoordinator.sol (L101-L106)

**Purpose:** Builds the six-reserve snapshot consumed by all cycle math.

---

**Inputs & Assumptions:** No explicit input. Requires `configured` (L102). Assumes each hook reports the intended pair and that the three reads form a meaningful snapshot.

---

**Outputs & Effects:** Returns a `CycleMath.Network`; performs three external view calls; no writes/events. It does not validate reserve range or claim equality.

---

**Block-by-Block:**

```solidity
// L102-L105
if (!configured) revert NotConfigured();
(n.abA, n.abB) = hookAB.reserves(); ...
```
- **What:** Guards unbound slots and reads AB, BC, AC sequentially.
- **Why here:** The configuration guard prevents calls to zero interfaces.
- **Assumes:** No state changes between reads and getters are honest. For intended hooks, getters only read storage (`contracts/src/ArbFoldHook.sol:L48-L50`).
- **Establishes:** A memory snapshot of reported reserves, nothing about ERC-6909 balances.
- **Depended on by:** `quote`, `fold`, `lastResidualProfit` and verification scripts.

---

**Cross-Function Dependencies:** Three external-source-available calls for deployed `ArbFoldHook`; black-box for any alternate interface implementation.

---

**Open Questions:** Whether snapshot atomicity must be guaranteed for nonstandard configured hooks; intended hook getters make no external calls.

