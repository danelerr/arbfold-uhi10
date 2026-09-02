## `quote` in contracts/src/ArbFoldCoordinator.sol (L108-L110)

**Purpose:** Exposes the currently best of the two modeled cycles.

---

**Inputs & Assumptions:** No explicit input. Assumes `network()` yields an in-domain coherent state.

---

**Outputs & Effects:** Returns `CycleMath.Quote`; three hook reads through `network`; no writes/events.

---

**Block-by-Block:**

```solidity
// L108-L110
return CycleMath.best(network());
```
- **What:** Snapshots then applies closed-form math.
- **Why here:** Keeps public quoting identical to fold selection.
- **Assumes:** `CycleMath.best` represents the intended optimum within normalization precision.
- **Establishes:** A quote for the read block/state only; no execution guarantee against later state.
- **Depended on by:** UI/scripts and deployment verifier.

---

**Cross-Function Dependencies:** `network` and `CycleMath.best`, both read in full.

---

**Open Questions:** Formal approximation/error bound for normalized `_optimalInput`: nothing found in source.

