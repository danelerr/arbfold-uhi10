## `swapOut` in contracts/src/CycleMath.sol (L42-L50)

**Purpose:** Computes floor-rounded exact-input output for one 30 bps CPMM leg.

**Inputs & Assumptions:** `amountIn`, `reserveIn`, `reserveOut` are internal
values. Zero input returns zero. Nonzero input and both reserves must be within
fixed domain; amount is capped at `MAX_NETWORK_RESERVE` (L44-L47).

**Outputs & Effects:** Pure output
`floor(amountIn*GAMMA*reserveOut / (reserveIn*DENOMINATOR + amountIn*GAMMA))`.

**Block-by-Block:**

```solidity
// L43-L47
if (amountIn == 0) return 0; if (...bounds...) revert ArithmeticDomain();
```
- **What:** Handles zero and bounds every nonzero operand.
- **Why here:** Prevents downstream arithmetic outside fixed domain.
- **Assumes:** constants encode intended token scale.
- **Establishes:** bounded positive operands.
- **Depended on by:** multiplication and `Math.mulDiv`.

```solidity
// L48-L49
uint256 effectiveIn = amountIn * GAMMA;
return Math.mulDiv(effectiveIn, reserveOut, reserveIn * DENOMINATOR + effectiveIn);
```
- **What:** Applies fee multiplier and full-precision floor division.
- **Why here:** Implements CPMM leg.
- **Assumes:** denominator nonzero, established by positive reserve.
- **Establishes:** output strictly below reserveOut for positive domain.
- **Depended on by:** user swaps and both cycle quote directions.

**Cross-Function Dependencies:** OpenZeppelin `Math.mulDiv`. Callers are hook
swap and quote helpers.

**Open Questions:** Token decimal normalization is outside this function.

