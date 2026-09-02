## `_quoteReverse` in contracts/src/CycleMath.sol (L68-L75)

**Purpose:** Quotes A→C on AC, C→B on BC, B→A on AB.

---

**Inputs & Assumptions:** Validated network from `best`; same asset/unit/fee assumptions as forward.

---

**Outputs & Effects:** Pure `Quote(true, ...)`; no external calls/writes/events.

---

**Block-by-Block:**

```solidity
// L69-L74
Leg[3] memory legs = [Leg(n.acA,n.acC), Leg(n.bcC,n.bcB), Leg(n.abB,n.abA)];
uint256 q = _optimalInput(legs);
... three swapOut calls ...
quote = Quote(true, q, tokenC, tokenB, tokenA, tokenA > q ? tokenA - q : 0);
```
- **What:** Simulates the opposite path with integer carry-through.
- **Why here:** Mirrors field order consumed by `_applyDirect` reverse branch.
- **Assumes:** Same curve/fee in all hooks.
- **Establishes:** Internally consistent reverse intermediates and nonnegative profit.
- **Depended on by:** `best` and reverse transition.

---

**Cross-Function Dependencies:** `_optimalInput`, `swapOut`.

---

**Open Questions:** None beyond normalization error bound.

