## `_getUnspecifiedAmount` in contracts/src/ArbFoldHook.sol (L86-L103)

**Purpose:** Calculates a bounded 30 bps exact-input CPMM output and commits the corresponding virtual-reserve change for either swap direction.

---

**Inputs & Assumptions:**
- `params` (`SwapParams calldata`): direction and signed amount from the manager callback. Trust: **untrusted** (`PoolOperation.sol:L18-L25`).
- Implicit: `_reserve0`, `_reserve1` (L35-L36) and checked arithmetic under Solidity 0.8.26 (L2).
- Precondition for reaching this function through `BaseCustomCurve`: `uint256(-params.amountSpecified)` at `BaseCustomCurve.sol:L99-L100` has already succeeded; therefore `int256.min` cannot reach this callee through that caller.
- Precondition for reserve/claim equality: exact equality on entry is established by **nothing found** in this function; it does not read manager balances.

---

**Outputs & Effects:**
- Reverts for exact-output or zero signed amounts at L87.
- Reverts when input exceeds `MAX_SWAP_INPUT` at L89 (`CycleMath.sol:L13`).
- Returns `amountOut` from `CycleMath.swapOut` (L92 or L98).
- On `zeroForOne`, adds full input to `_reserve0` and subtracts output from `_reserve1` (L94-L95).
- Otherwise adds full input to `_reserve1` and subtracts output from `_reserve0` (L100-L101).
- No external calls and no event in this function; the caller later changes claims and emits `HookSwap` (`BaseCustomCurve.sol:L108-L146`).

---

**Block-by-Block:**

```solidity
// L87-L89
if (params.amountSpecified >= 0) revert ExactInputOnly();
uint256 amountIn = uint256(-params.amountSpecified);
if (amountIn > CycleMath.MAX_SWAP_INPUT) revert UnsupportedAmount();
```
- **What:** Restricts the function to negative exact-input amounts and caps their magnitude.
- **Why here:** Both directional branches require a positive bounded input before additions and quote math.
- **Assumes:** negation is representable; established on the only caller path by the earlier identical negation at `BaseCustomCurve.sol:L99-L100`.
- **Establishes:** successful continuation has `1 <= amountIn <= MAX_SWAP_INPUT` (L87-L89).
- **Depended on by:** the pre-addition checks and `CycleMath.swapOut` calls in both branches.

```solidity
// L90-L95
if (params.zeroForOne) {
    if (_reserve0 > CycleMath.MAX_NETWORK_RESERVE - amountIn) revert UnsupportedAmount();
    amountOut = CycleMath.swapOut(amountIn, _reserve0, _reserve1);
    if (_reserve1 - amountOut < CycleMath.MIN_NETWORK_RESERVE) revert UnsupportedAmount();
    _reserve0 += amountIn;
    _reserve1 -= amountOut;
}
```
- **What:** Quotes currency1 output for currency0 input and commits the zero-for-one virtual reserve deltas.
- **Why here:** The input-side cap precedes addition; the output-side floor precedes storage writes.
- **Assumes:** no reserve/claim equality; establishment is **nothing found** here.
- **Establishes:** `CycleMath.swapOut` checks both entry reserves are within `[MIN_NETWORK_RESERVE, MAX_NETWORK_RESERVE]` (`CycleMath.sol:L42-L49`); the precheck keeps reserve0 at or below the maximum, and L93 keeps reserve1 at or above the minimum.
- **Depended on by:** superclass claim mint/burn and returned hook delta (`BaseCustomCurve.sol:L108-L115`).

```solidity
// L96-L102
else {
    if (_reserve1 > CycleMath.MAX_NETWORK_RESERVE - amountIn) revert UnsupportedAmount();
    amountOut = CycleMath.swapOut(amountIn, _reserve1, _reserve0);
    if (_reserve0 - amountOut < CycleMath.MIN_NETWORK_RESERVE) revert UnsupportedAmount();
    _reserve1 += amountIn;
    _reserve0 -= amountOut;
}
```
- **What:** Mirrors the calculation and state change for currency1 input and currency0 output.
- **Why here:** Direction selects which reserve receives full input and which supplies output.
- **Assumes:** no additional assumption beyond the same runtime dependency and unverified claim equality.
- **Establishes:** the same successful post-bounds with currency roles reversed (L97-L101; `CycleMath.sol:L42-L49`).
- **Depended on by:** the same superclass accounting path.

---

**Cross-Function Dependencies:**
- Caller `BaseCustomCurve._beforeSwap` (internal/base-source-available, `BaseCustomCurve.sol:L86-L149`): computes `specifiedAmount` first, calls this function at L103, then mints/burns claims by the exact input/output values at L108-L115.
- Callee `CycleMath.swapOut` (internal/source-available, `CycleMath.sol:L42-L50`): returns zero only for zero input; otherwise checks amount/reserve domain and computes floor `effectiveIn * reserveOut / (reserveIn * DENOMINATOR + effectiveIn)`.
- Callee `Math.mulDiv` (internal/OZ-source-available, `Math.sol:L197-L275`): performs full-precision floor division and rejects a zero denominator or overflowing result.
- Shared state: both reserves are also written by initial funding, coordinator writes, and removal (L122-L124, L67-L68, L166-L167).
- Invariant coupling: later manager mint/burn applies the same deltas, so it preserves an entry reserve/claim difference rather than proving that difference was zero (`BaseCustomCurve.sol:L108-L115`, `PoolManager.sol:L322-L335`).

---

**Open Questions:**
- unclear; need an explicit invariant source for the reserve-to-claim relationship at function entry; local establishment is **nothing found**.

