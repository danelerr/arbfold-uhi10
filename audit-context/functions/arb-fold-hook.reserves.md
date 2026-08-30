## `reserves` in contracts/src/ArbFoldHook.sol (L48-L50)

**Purpose:** Exposes this CPMM's two virtual reserve fields.

**Inputs & Assumptions:** No inputs. Reads `_reserve0`, `_reserve1`.

**Outputs & Effects:** Returns both values; no effects or external calls.

**Block-by-Block:**

```solidity
// L49
return (_reserve0, _reserve1);
```
- **What:** Copies storage values to return data.
- **Why here:** Entire getter.
- **Assumes:** writers maintained alignment with claim balances.
- **Establishes:** nothing beyond a virtual-state snapshot.
- **Depended on by:** coordinator `network`, UI and tests.

**Cross-Function Dependencies:** Writers are `_getAmountIn`,
`_getUnspecifiedAmount`, `_burn`, and `setReservesFromCoordinator`.

**Open Questions:** This getter does not expose or verify claim backing.

