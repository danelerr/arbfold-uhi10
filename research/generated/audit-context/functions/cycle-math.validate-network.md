## `_validateNetwork` in contracts/src/CycleMath.sol (L102-L109)

**Purpose:** Restricts every live reserve to the arithmetic/network domain.

**Inputs & Assumptions:** Canonical six-field network.

**Outputs & Effects:** Pure; reverts if any field is below `1 ether` or above
`3,000,000 ether`.

**Block-by-Block:**

```solidity
// L103-L108
if (any reserve < MIN_NETWORK_RESERVE || any reserve > MAX_NETWORK_RESERVE) revert ArithmeticDomain();
```
- **What:** Applies symmetric bounds to six reserves.
- **Why here:** Called before quote composition and product arithmetic.
- **Assumes:** all intended token units use compatible 18-decimal-style scale.
- **Establishes:** bounded quote operands.
- **Depended on by:** every `best` result.

**Cross-Function Dependencies:** Called only by `best`; no callees.

**Open Questions:** Core does not read token decimals, so unit compatibility is
a deployment assumption.

