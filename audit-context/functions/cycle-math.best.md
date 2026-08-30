## `best` in contracts/src/CycleMath.sol (L52-L57)

**Purpose:** Returns the greater-profit A-denominated quote among the two cycle
directions.

**Inputs & Assumptions:** Six-reserve network. Every value must satisfy bounds.

**Outputs & Effects:** Pure quote. Ties choose forward because comparison is
`>=` (L56).

**Block-by-Block:**

```solidity
// L53-L56
_validateNetwork(n);
Quote memory forward = _quoteForward(n);
Quote memory reverse = _quoteReverse(n);
quote = forward.profitA >= reverse.profitA ? forward : reverse;
```
- **What:** Validates, evaluates both cycles, selects larger profit.
- **Why here:** No direction is assumed from origin swap.
- **Assumes:** both quote helpers use the same fee and A numeraire.
- **Establishes:** result has maximum of the two computed profits.
- **Depended on by:** coordinator quote, fold loop and residual disclosure.

**Cross-Function Dependencies:** `_validateNetwork`, `_quoteForward`,
`_quoteReverse` and their math callees.

**Open Questions:** “Best” is limited to these two specialized closed-form
candidates, not a global multi-pool optimizer.

