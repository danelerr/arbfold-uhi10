## `_getRemoveLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol (L69-L77)

**Purpose:** Adapts unsigned pro-rata withdrawal outputs into negative signed amounts that select claim-burn/raw-take branches in the custom callback.

---

**Inputs & Assumptions:**
- `params` (`RemoveLiquidityParams memory`): untrusted-origin removal request passed internally (`BaseCustomAccounting.sol:L192-L203`).
- Precondition: derived output amounts fit positive int128; on ordinary bounded-reserve paths, each output is at most current reserve bounded by `MAX_NETWORK_RESERVE` (`ArbFoldHook.sol:L61-L66`, L86-L103, L118-L121, L129-L138). If requested shares exceed supply, this bound is not locally established before cast: **nothing found**.

---

**Outputs & Effects:**
- Calls view `_getAmountOut` for unsigned outputs and shares (L75; `ArbFoldHook.sol:L129-L139`).
- Safe-casts, negates, and ABI-encodes both amounts; returns unchanged shares (L76).
- Reverts on failed division or int128 cast.
- No storage writes, events, or external calls.

---

**Block-by-Block:**

```solidity
// L75-L76
(uint256 amount0, uint256 amount1, uint256 shares) = _getAmountOut(params);
return (abi.encode(-amount0.toInt128(), -amount1.toInt128()), shares);
```
- **What:** Computes pro-rata outputs, bounds them through safe cast, changes their sign, and packages them with requested shares.
- **Why here:** Negative callback amounts select claim burn followed by underlying payout (`BaseCustomCurve.sol:L198-L216`).
- **Assumes:** the requested share ratio yields int128-sized amounts; explicit `shares <= supply` establishment before this point: **nothing found**.
- **Establishes:** any successful result contains two nonpositive int128 amounts and the unchanged share count.
- **Depended on by:** `_modifyLiquidity`, `unlockCallback`, and derived `_burn`.

---

**Cross-Function Dependencies:**
- Caller `BaseCustomAccounting.removeLiquidity` (`BaseCustomAccounting.sol:L202-L209`).
- Callee derived `_getAmountOut` (`ArbFoldHook.sol:L129-L139`) and OZ `Math.mulDiv` (`Math.sol:L197-L275`).
- Callee v4 `SafeCast.toInt128` (`SafeCast.sol:L53-L59`).
- Downstream custom callback removal branches (`BaseCustomCurve.sol:L198-L216`).
- Shared state: reads derived reserves and ERC-20 supply through `_getAmountOut`.
- Invariant coupling: ownership and `shares <= supply` are enforced only later by claim availability/reserve subtraction/ERC-20 burn on a successful outer transaction.

---

**Open Questions:**
- unclear; need intended early-failure behavior for requests exceeding caller balance or total supply.

