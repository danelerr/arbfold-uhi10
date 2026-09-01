## `_quoteForward` in contracts/src/CycleMath.sol (L59-L66)

**Purpose:** Quotes A -> B -> C -> A with fixed pool ordering.

**Inputs & Assumptions:** Validated network from `best` on intended call path.
Assumes reserve fields map to AB(A,B), BC(B,C), and AC(A,C).

**Outputs & Effects:** Pure quote carrying principal, intermediates, final A and
nonnegative profit.

**Block-by-Block:**

```solidity
// L60-L61
Leg[3] memory legs = [Leg(n.abA,n.abB), Leg(n.bcB,n.bcC), Leg(n.acC,n.acA)];
uint256 q = _optimalInput(legs);
```
- **What:** Orders forward input/output reserves and computes principal.
- **Why here:** Closed-form composition depends on leg order.
- **Assumes:** `_optimalInput` approximation is suitable for integer quote.
- **Establishes:** candidate A input.
- **Depended on by:** sequential swaps.

```solidity
// L62-L65
tokenB = swapOut(...); tokenC = swapOut(...); tokenA = swapOut(...);
quote = Quote(false, q, tokenB, tokenC, tokenA, tokenA > q ? tokenA-q : 0);
```
- **What:** Evaluates actual integer leg outputs and clamps profit at zero.
- **Why here:** Final quote uses executable floor-rounded values, not only closed form.
- **Assumes:** each intermediate remains in `swapOut` amount domain.
- **Establishes:** internally consistent forward transfer quantities.
- **Depended on by:** direct forward transition.

**Cross-Function Dependencies:** `_optimalInput`, three `swapOut` calls.

**Open Questions:** Formal error bound between normalized optimum and exact
integer profit maximum is not in source.

