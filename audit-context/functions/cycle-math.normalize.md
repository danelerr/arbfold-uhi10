## `_normalize` in contracts/src/CycleMath.sol (L95-L100)

**Purpose:** Scales three coefficients together to cap their magnitude before later products.

---

**Inputs & Assumptions:** Internal nonnegative coefficients. Assumes common integer division is an acceptable approximation to scale invariance.

---

**Outputs & Effects:** Pure triple; no calls/writes/events.

---

**Block-by-Block:**

```solidity
// L96-L99
uint256 maximum = Math.max(Math.max(a,b),c);
if (maximum <= NORMALIZED_MAX) return (a,b,c);
uint256 scale = Math.ceilDiv(maximum,NORMALIZED_MAX);
return (a/scale,b/scale,c/scale);
```
- **What:** Leaves bounded values unchanged; otherwise divides all by a common ceiling scale.
- **Why here:** Prevents later coefficient multiplication/square root input from reaching unsupported magnitude.
- **Assumes:** Truncating small coefficients, possibly to zero, is acceptable; nothing restores lost ratios.
- **Establishes:** Every returned component is at most `1e36` on scaled path.
- **Depended on by:** `_optimalInput` composition and root.

---

**Cross-Function Dependencies:** OpenZeppelin `Math.max/ceilDiv`.

---

**Open Questions:** Formal approximation bound: nothing found.

