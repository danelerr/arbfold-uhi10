## `_quoteForward` in contracts/src/CycleMath.sol (L59-L66)

**Purpose:** Quotes A→B on AB, B→C on BC, C→A on AC.

---

**Inputs & Assumptions:** Validated network from `best`. Assumes all three reserve pairs share coherent asset identities and fee.

---

**Outputs & Effects:** Pure `Quote(false, ...)`; three `swapOut` calls and one `_optimalInput`.

---

**Block-by-Block:**

```solidity
// L60-L65
Leg[3] memory legs = [Leg(n.abA,n.abB), Leg(n.bcB,n.bcC), Leg(n.acC,n.acA)];
uint256 q = _optimalInput(legs);
uint256 tokenB = swapOut(q,...); uint256 tokenC = swapOut(tokenB,...); uint256 tokenA = swapOut(tokenC,...);
quote = Quote(false, q, tokenB, tokenC, tokenA, tokenA > q ? tokenA - q : 0);
```
- **What:** Constructs path, chooses input, simulates all outputs and floors negative profit to zero.
- **Why here:** Later legs consume exact integer output from the previous leg.
- **Assumes:** `_optimalInput` approximation yields an admissible input; `swapOut` enforces magnitude.
- **Establishes:** Internally consistent forward intermediates and nonnegative profit.
- **Depended on by:** `best` and forward `_applyDirect` branch.

---

**Cross-Function Dependencies:** `_optimalInput`, `swapOut`.

---

**Open Questions:** None beyond normalization error bound.

