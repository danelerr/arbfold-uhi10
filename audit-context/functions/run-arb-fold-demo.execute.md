## `_execute` in contracts/script/RunArbFoldDemo.s.sol (L63-L101)

**Purpose:** Broadcasts a funded exact-input swap/fold and proves selected before/after demo properties.

---

**Inputs & Assumptions:** Validated `DemoConfig`; assumes input currency is permissionless `DemoToken` and broadcaster controls `user`.

---

**Outputs & Effects:** Reads baseline network/claim/rounds, broadcasts mint/approve/swap, reads final values, requires positive new rounds/reward, nondecreasing products and residual under threshold, logs/writes evidence (L64-L100).

---

**Block-by-Block:**

```solidity
// L64-L70
read key/input, network, solver claim, rounds;
```
- **What:** Captures comparison baseline.
- **Why here:** Must precede broadcast.
- **Assumes:** No unrelated transaction changes state between simulation/broadcast reads; script execution/RPC sequencing is operational.
- **Establishes:** Local before snapshot.
- **Depended on by:** postconditions.

```solidity
// L71-L83
startBroadcast; mint; approve exact amount; router.swapExactInput(...); stopBroadcast;
```
- **What:** Prepares input and executes canonical path.
- **Why here:** Mint/allowance must precede router settlement.
- **Assumes:** Input token exposes permissionless DemoToken.mint.
- **Establishes:** Successful transaction sequence or revert.
- **Depended on by:** after reads.

```solidity
// L85-L100
read final; require rounds/reward increase; compute residual; products nondecrease; require residual <= threshold; emit evidence;
```
- **What:** Validates demo-specific outcome.
- **Why here:** Uses committed post-state.
- **Assumes:** Difference in lifetime counters/claim belongs to this execution; no concurrent intervening state.
- **Establishes:** These mechanical properties for this demo only.
- **Depended on by:** finalized manifest evidence.

---

**Cross-Function Dependencies:** DemoToken, router full flow, coordinator views, PoolManager.balanceOf, evidence serialization.

---

**Open Questions:** Correlation of evidence JSON with receipt/events is procedural; `finalize-manifest.sh` selects tx hash and evidence independently.

