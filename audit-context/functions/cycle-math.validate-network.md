## `_validateNetwork` in contracts/src/CycleMath.sol (L102-L109)

**Purpose:** Defines the supported arithmetic reserve domain.

---

**Inputs & Assumptions:** Six untrusted/derived reserve values. Constants are expressed in 18-decimal-style `ether` units.

---

**Outputs & Effects:** Pure; reverts if any field is below 1 ether or above 3,000,000 ether. No calls/writes/events.

---

**Block-by-Block:**

```solidity
// L103-L108
if (any reserve < MIN_NETWORK_RESERVE || any reserve > MAX_NETWORK_RESERVE) revert ArithmeticDomain();
```
- **What:** Applies identical absolute bounds to all six values.
- **Why here:** `best` calls it before coefficient construction.
- **Assumes:** A/B/C quantities use compatible scale; token decimals are not queried.
- **Establishes:** Arithmetic magnitude bounds for every downstream quote operation.
- **Depended on by:** safe coefficient/products and public quote/fold availability.

---

**Cross-Function Dependencies:** No callees. Only `best` calls it.

---

**Open Questions:** Whether the absolute unit bounds are part of protocol economics or solely arithmetic guardrails.
