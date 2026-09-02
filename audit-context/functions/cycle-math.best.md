## `best` in contracts/src/CycleMath.sol (L52-L57)

**Purpose:** Selects the higher-profit quote between the two directed triangular cycles.

---

**Inputs & Assumptions:** `n` is a six-reserve memory snapshot. It may be untrusted when sourced from hooks; `_validateNetwork` bounds it.

---

**Outputs & Effects:** Pure quote; no writes/events/external calls. Ties select forward (L56).

---

**Block-by-Block:**

```solidity
// L53-L56
_validateNetwork(n);
Quote memory forward = _quoteForward(n);
Quote memory reverse = _quoteReverse(n);
quote = forward.profitA >= reverse.profitA ? forward : reverse;
```
- **What:** Validates once, computes both paths, chooses maximum modeled profit.
- **Why here:** Both private quote paths can rely on the same reserve-domain precondition.
- **Assumes:** Only these two cycles are relevant and profit in token A is the comparison objective.
- **Establishes:** Returned profit is max of the two computed integer quotes, not a formal exhaustive optimum over every integer input.
- **Depended on by:** `quote`, every fold round, residual disclosure.

---

**Cross-Function Dependencies:** `_validateNetwork`, `_quoteForward`, `_quoteReverse`.

---

**Open Questions:** Formal error/optimality bound after `_normalize` integer truncation: nothing found in source.

