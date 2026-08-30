## `_normalize` in contracts/src/CycleMath.sol (L95-L100)

**Purpose:** Bounds the largest coefficient at approximately `1e36` by dividing
all three through a common ceiling scale.

**Inputs & Assumptions:** Nonnegative coefficient triple. Assumes common integer
rescaling preserves the needed ratio with acceptable truncation.

**Outputs & Effects:** Pure. Returns unchanged triple below bound or floor-divided triple.

**Block-by-Block:**

```solidity
// L96-L99
maximum = max(...); if (maximum <= NORMALIZED_MAX) return (...);
scale = ceilDiv(maximum, NORMALIZED_MAX);
return (a/scale, b/scale, c/scale);
```
- **What:** Chooses common scale and truncates coefficients.
- **Why here:** Prevents later `a*b` and composition products from exceeding
  bounded arithmetic domain.
- **Assumes:** scale does not reduce a required nonzero coefficient to zero in
  accepted network range, or zero is handled by caller.
- **Establishes:** each returned coefficient is at most `NORMALIZED_MAX` when scaled.
- **Depended on by:** composition and root calculation.

**Cross-Function Dependencies:** OpenZeppelin `Math.max` and `ceilDiv`.

**Open Questions:** Quantified precision loss is not documented in source.

