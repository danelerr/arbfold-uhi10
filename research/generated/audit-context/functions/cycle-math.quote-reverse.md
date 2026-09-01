## `_quoteReverse` in contracts/src/CycleMath.sol (L68-L75)

**Purpose:** Quotes reverse A -> C -> B -> A.

**Inputs & Assumptions:** Validated canonical network. Assumes AC, BC and AB
fields are ordered as named.

**Outputs & Effects:** Pure reverse quote with nonnegative profit.

**Block-by-Block:**

```solidity
// L69-L70
Leg[3] memory legs = [Leg(n.acA,n.acC), Leg(n.bcC,n.bcB), Leg(n.abB,n.abA)];
uint256 q = _optimalInput(legs);
```
- **What:** Orders reverse cycle legs and computes principal.
- **Why here:** Establishes A -> C -> B -> A composition.
- **Assumes:** same normalized optimum semantics as forward.
- **Establishes:** reverse candidate input.
- **Depended on by:** sequential quote.

```solidity
// L71-L74
tokenC = swapOut(...); tokenB = swapOut(...); tokenA = swapOut(...);
quote = Quote(true, q, tokenC, tokenB, tokenA, tokenA > q ? tokenA-q : 0);
```
- **What:** Evaluates floor-rounded outputs and labels reverse.
- **Why here:** Supplies exact transfer quantities to coordinator.
- **Assumes:** intermediates remain within domain.
- **Establishes:** consistent reverse quote.
- **Depended on by:** direct reverse transition.

**Cross-Function Dependencies:** `_optimalInput`, `swapOut` three times.

**Open Questions:** Same rounding/optimality proof question as forward path.

