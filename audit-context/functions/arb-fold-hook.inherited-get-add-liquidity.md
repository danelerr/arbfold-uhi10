## `_getAddLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol (L55-L63)

**Purpose:** Adapts the derived hook's unsigned initial amounts/shares into the signed two-amount encoding consumed by custom unlock accounting.

---

**Inputs & Assumptions:**
- First unnamed `uint160`: pool sqrt price supplied by `addLiquidity`; ignored at L55.
- `params` (`AddLiquidityParams memory`): untrusted-origin user parameters passed internally (`BaseCustomAccounting.sol:L137-L155`).
- Precondition: derived `_getAmountIn` returns values that fit positive int128; established by its `MAX_INITIAL_RESERVE` checks (`ArbFoldHook.sol:L118-L121`, `CycleMath.sol:L12`) and v4 `SafeCast.toInt128` rejects otherwise (`SafeCast.sol:L53-L59`).

---

**Outputs & Effects:**
- Calls derived `_getAmountIn`, inheriting its reserve/lifecycle writes and `ReservesUpdated` event (L61; `ArbFoldHook.sol:L110-L127`).
- Returns `abi.encode(int128(amount0), int128(amount1))` and unchanged `shares` (L62).
- No external calls.

---

**Block-by-Block:**

```solidity
// L61-L62
(uint256 amount0, uint256 amount1, uint256 shares) = _getAmountIn(params);
return (abi.encode(amount0.toInt128(), amount1.toInt128()), shares);
```
- **What:** Obtains bounded derived values, safe-casts both positive amounts, and encodes them for callback sign dispatch.
- **Why here:** Positive signs cause the callback's raw-settle/claim-mint branches (`BaseCustomCurve.sol:L218-L236`).
- **Assumes:** no assumption beyond derived bounds for casts; established at `ArbFoldHook.sol:L118-L121`.
- **Establishes:** callback data contains two positive int128 amounts and the exact share count returned by `_getAmountIn`.
- **Depended on by:** `_modifyLiquidity` and `_mint` in `addLiquidity` (`BaseCustomAccounting.sol:L154-L161`).

---

**Cross-Function Dependencies:**
- Caller `BaseCustomAccounting.addLiquidity` (internal dispatch/source-available, `BaseCustomAccounting.sol:L154-L161`).
- Callee derived `_getAmountIn` (`ArbFoldHook.sol:L110-L127`).
- Callee v4 `SafeCast.toInt128` (`SafeCast.sol:L53-L59`).
- Downstream `_modifyLiquidity`/`unlockCallback` (`BaseCustomCurve.sol:L159-L242`).
- Shared state: only through the derived callee.
- Invariant coupling: amounts and shares remain coupled by direct tuple propagation; asset settlement happens later.

---

**Open Questions:**
- None after following the derived bounds and callback decoder.

