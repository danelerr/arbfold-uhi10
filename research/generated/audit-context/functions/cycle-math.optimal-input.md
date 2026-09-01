## `_optimalInput` in contracts/src/CycleMath.sol (L78-L93)

**Purpose:** Computes the closed-form positive maximizer of the composed
fractional-linear three-leg cycle after bounded normalization.

**Inputs & Assumptions:** Exactly three legs from a validated network. Assumes
composition can be represented as `a*x/(b+c*x)` under fixed fee multiplier.

**Outputs & Effects:** Pure A principal. Returns zero if derivative condition is
not profitable or `c == 0`.

**Block-by-Block:**

```solidity
// L79-L81
uint256 a = GAMMA * legs[0].reserveOut;
uint256 b = DENOMINATOR * legs[0].reserveIn;
uint256 c = GAMMA;
```
- **What:** Initializes fractional-linear coefficients for first leg.
- **Why here:** Seed for composition loop.
- **Assumes:** reserves are bounded by prior validation.
- **Establishes:** first-leg coefficient triple.
- **Depended on by:** loop.

```solidity
// L83-L87
for (uint256 i = 1; i < 3; ++i) { ... _normalize(...); }
```
- **What:** Composes two remaining legs and rescales coefficients each time.
- **Why here:** Keeps coefficient magnitudes bounded while preserving ratios
  approximately under integer division.
- **Assumes:** truncating all coefficients by common scale preserves enough
  precision for intended quote.
- **Establishes:** normalized three-leg coefficients.
- **Depended on by:** root calculation.

```solidity
// L89-L92
(a,b,c)=_normalize(...); root=Math.sqrt(a*b);
if (root <= b || c == 0) return 0;
return (root-b)/c;
```
- **What:** Applies `max((sqrt(a*b)-b)/c,0)` with floor rounding.
- **Why here:** Closed-form stationary point for profit `f(x)-x`.
- **Assumes:** normalized coefficient products retain the intended domain.
- **Establishes:** nonnegative integer candidate.
- **Depended on by:** both direction quotes.

**Cross-Function Dependencies:** `_normalize`, OpenZeppelin `Math.sqrt`.

**Open Questions:** No formal bound is cited for cumulative normalization and
integer square-root truncation relative to the true discrete optimum.

