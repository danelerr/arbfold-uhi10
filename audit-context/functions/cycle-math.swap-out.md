## `swapOut` in contracts/src/CycleMath.sol (L42-L50)

**Purpose:** Computes integer-floor output for one 30 bps constant-product leg.

---

**Inputs & Assumptions:** `amountIn`, `reserveIn`, `reserveOut` are internal quote/reserve values. Trust is contextual. Nonzero inputs/reserves must be within 1–3,000,000 `ether` bounds (L44-L47). Zero input returns zero before reserve validation (L43).

---

**Outputs & Effects:** Pure output `floor(amountIn*997000*reserveOut / (reserveIn*1e6 + amountIn*997000))`; no writes/calls/events apart from vendored `Math.mulDiv` library code.

---

**Block-by-Block:**

```solidity
// L43-L47
if (amountIn == 0) return 0;
if (amountIn > MAX_NETWORK_RESERVE || reserveIn < MIN... || reserveOut > MAX...) revert ArithmeticDomain();
```
- **What:** Handles zero and bounds the nonzero arithmetic domain.
- **Why here:** Prevents unsupported magnitude before multiplication.
- **Assumes:** Zero output is valid regardless of reserve values for direct callers.
- **Establishes:** Nonzero path operands fit declared domain.
- **Depended on by:** arithmetic at L48-L49.

```solidity
// L48-L49
uint256 effectiveIn = amountIn * GAMMA;
return Math.mulDiv(effectiveIn, reserveOut, reserveIn * DENOMINATOR + effectiveIn);
```
- **What:** Applies fee and exact full-precision division.
- **Why here:** After nonzero/domain checks.
- **Assumes:** All quantities use compatible token units; nothing in the library establishes decimals/economic comparability.
- **Establishes:** Output is strictly below `reserveOut` for positive inputs/reserves.
- **Depended on by:** forward/reverse quotes and hook swap output.

---

**Cross-Function Dependencies:** OpenZeppelin `Math.mulDiv` (external-source-available). Called by hook swaps and cycle quote legs.

---

**Open Questions:** None for integer formula; token-unit interpretation is a deployment assumption.

