## `_getSwapFeeAmount` in contracts/src/ArbFoldHook.sol (L105-L108)

**Purpose:** Computes input-side fee metadata for the inherited `HookSwap` event using the same gamma constants as the output formula.

---

**Inputs & Assumptions:**
- `params` (`SwapParams calldata`): signed amount from the manager callback. Trust: **untrusted** (`PoolOperation.sol:L18-L25`).
- Second unnamed `uint256`: inherited unspecified amount; ignored at L105.
- Precondition on the successful exact-input caller path: `_getUnspecifiedAmount` has already returned and bounded the input because the superclass calls it before this function (`BaseCustomCurve.sol:L102-L106`).
- If called with `int256.min` outside that caller continuity, negation at L107 reverts; no other caller was found.

---

**Outputs & Effects:**
- Returns zero when `amountSpecified >= 0` (L106).
- Otherwise returns floor `input * (1_000_000 - 997_000) / 1_000_000` (L107; constants `CycleMath.sol:L9-L10`).
- Pure function: no state writes, events, or external calls.
- The result is consumed only as `HookSwap` fee metadata in the inherited path (`BaseCustomCurve.sol:L105-L106`, L126-L146); the fee override returned to v4 is zero (`BaseCustomCurve.sol:L148`).

---

**Block-by-Block:**

```solidity
// L106-L107
if (params.amountSpecified >= 0) return 0;
return uint256(-params.amountSpecified) * (CycleMath.DENOMINATOR - CycleMath.GAMMA) / CycleMath.DENOMINATOR;
```
- **What:** Returns no fee metadata for non-exact-input values and a floor-rounded 30 bps amount for negative exact input.
- **Why here:** It mirrors the mode supported by `_getUnspecifiedAmount` and supplies the event emitted next by the superclass.
- **Assumes:** exact-input magnitude is already bounded; established by superclass call order and L87-L89.
- **Establishes:** event fee metadata uses exactly the same `GAMMA` and `DENOMINATOR` constants used by `CycleMath.swapOut` (`CycleMath.sol:L9-L10`, L48-L49).
- **Depended on by:** inherited `HookSwap` construction (`BaseCustomCurve.sol:L126-L146`).

---

**Cross-Function Dependencies:**
- Caller `BaseCustomCurve._beforeSwap` (internal/base-source-available, `BaseCustomCurve.sol:L102-L106`): calls this only after output math succeeds.
- Shared constants: `CycleMath.DENOMINATOR` and `CycleMath.GAMMA` (`CycleMath.sol:L9-L10`).
- No external calls.
- Invariant coupling: full input is added to reserves while output uses gamma-adjusted input (L94-L101; `CycleMath.sol:L48-L49`); this function reports the difference but does not move it separately.

---

**Open Questions:**
- None within this function; its result is event metadata on the only successful caller path.

