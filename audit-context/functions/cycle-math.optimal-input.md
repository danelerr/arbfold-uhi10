## `_optimalInput` in contracts/src/CycleMath.sol (L77-L93)

**Purpose:** Computes an integer approximation of the stationary input for the composed rational three-leg curve.

---

**Inputs & Assumptions:** Three validated `Leg`s. Assumes the algebraic reduction `A*x/(B+C*x)-x` matches sequential `swapOut` fee math before integer rounding (NatSpec L77).

---

**Outputs & Effects:** Pure amount; no calls/writes/events. May return zero when no positive stationary point is represented (L91).

---

**Block-by-Block:**

```solidity
// L79-L87
uint256 a = GAMMA * legs[0].reserveOut;
uint256 b = DENOMINATOR * legs[0].reserveIn;
uint256 c = GAMMA;
for (uint256 i = 1; i < 3; ++i) { ... _normalize(...); }
```
- **What:** Composes rational coefficients and normalizes after each additional leg.
- **Why here:** Bounds coefficient growth before the next composition.
- **Assumes:** Division-based normalization preserves enough precision for intended selection; no error bound is enforced.
- **Establishes:** Coefficients reduced to at most `NORMALIZED_MAX` after each loop body.
- **Depended on by:** square-root step.

```solidity
// L89-L92
(a,b,c) = _normalize(a,b,c);
uint256 root = Math.sqrt(a*b);
if (root <= b || c == 0) return 0;
return (root-b)/c;
```
- **What:** Applies closed-form stationary solution with floor square root/division.
- **Why here:** Final normalization keeps `a*b` bounded to `1e72`, below uint256 maximum.
- **Assumes:** The floored stationary candidate is adequate without checking adjacent integer inputs.
- **Establishes:** Nonnegative candidate; no explicit `MAX_SWAP_INPUT` cap.
- **Depended on by:** both cycle quote paths.

---

**Cross-Function Dependencies:** `_normalize`; OpenZeppelin `Math.sqrt`.

---

**Open Questions:** What is the maximum profit/input error caused by repeated coefficient division and not comparing neighboring integer candidates?

