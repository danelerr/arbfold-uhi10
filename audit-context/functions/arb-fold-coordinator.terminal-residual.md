## `_terminalResidual` in contracts/src/ArbFoldCoordinator.sol (L238-L244)

**Purpose:** Returns the profit corresponding to the actual terminal state without an unnecessary ninth quote on normal exits.

---

**Inputs & Assumptions:** `currentState`, last `q`, and `rounds` come from the `fold` loop. Assumes that when `rounds < MAX_ROUNDS`, `q` is the quote that triggered the break; the loop structure at L144-L151 establishes this.

---

**Outputs & Effects:** Pure return. Recomputes `CycleMath.best` only at exactly eight rounds. No writes/events.

---

**Block-by-Block:**

```solidity
// L243
return rounds == MAX_ROUNDS ? CycleMath.best(currentState).profitA : q.profitA;
```
- **What:** Selects recomputed or cached residual.
- **Why here:** After max-round execution, cached `q` describes the pre-round state; on threshold/zero-round exit it already describes terminal state.
- **Assumes:** Only `fold` supplies loop-consistent arguments.
- **Establishes:** Event residual corresponds to terminal library quote.
- **Depended on by:** `FoldCompleted` disclosure.

---

**Cross-Function Dependencies:** `CycleMath.best` on the max-round branch. Internal-only caller `fold`.

---

**Open Questions:** None about cache continuity; threshold compliance remains a separate policy question.

