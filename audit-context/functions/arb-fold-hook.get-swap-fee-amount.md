## `_getSwapFeeAmount` in contracts/src/ArbFoldHook.sol (L105-L108)

**Purpose:** Reports the input-side 30 bps fee amount to inherited custom-curve
event accounting.

**Inputs & Assumptions:** `params` from PoolManager; second inherited argument is
unused. Assumes `CycleMath.GAMMA` encodes the same fee used in `swapOut`.

**Outputs & Effects:** Pure. Returns zero for non-exact-input params; otherwise
`input * (DENOMINATOR-GAMMA)/DENOMINATOR`.

**Block-by-Block:**

```solidity
// L106-L107
if (params.amountSpecified >= 0) return 0;
return uint256(-params.amountSpecified) * (...) / DENOMINATOR;
```
- **What:** Computes fee on exact input.
- **Why here:** Mirrors the only supported swap mode.
- **Assumes:** amount has already passed `_getUnspecifiedAmount` sign/domain
  checks in the superclass call order.
- **Establishes:** inherited `HookSwap` event receives fixed-fee metadata.
- **Depended on by:** `BaseCustomCurve._beforeSwap` event emission.

**Cross-Function Dependencies:** Called after `_getUnspecifiedAmount` by
superclass (`BaseCustomCurve.sol:L102-L107`). No external calls.

**Open Questions:** None within event-fee calculation; fee retention itself is
embedded in `swapOut` and reserve deltas.

