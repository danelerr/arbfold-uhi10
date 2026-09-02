## `_getAmountOut` in contracts/src/ArbFoldHook.sol (L129-L139)

**Purpose:** Computes floor-rounded pro-rata reserve amounts for a requested LP-share removal.

---

**Inputs & Assumptions:**
- `params` (`BaseCustomAccounting.RemoveLiquidityParams memory`): contains caller-selected `liquidity`. Trust: **untrusted** (`BaseCustomAccounting.sol:L87-L95`, L192-L203).
- Implicit: current `_reserve0`, `_reserve1`, and inherited ERC-20 `totalSupply()` (L135-L138; `ERC20.sol:L82-L84`).
- Precondition: `totalSupply() != 0`; explicit establishment in this function: **nothing found**. `Math.mulDiv` reverts for denominator zero (`Math.sol:L197-L218`).
- Precondition for the requested shares to be owned by the caller: not checked here; later ERC-20 `_burn` enforces balance if execution reaches L168 (`ERC20.sol:L176-L203`, L229-L234).
- Precondition that virtual reserves describe the assets attributable to LP shares: establishment is **nothing found** in this function.

---

**Outputs & Effects:**
- Returns `shares = params.liquidity` (L135).
- Returns `floor(_reserve0 * shares / supply)` and `floor(_reserve1 * shares / supply)` (L136-L138).
- View function: no storage writes, events, or external calls; `totalSupply()` is an inherited local read (`ERC20.sol:L82-L84`).
- Reverts through `Math.mulDiv` when supply is zero or a full-precision result cannot fit in `uint256` (`Math.sol:L197-L275`).

---

**Block-by-Block:**

```solidity
// L135-L138
shares = params.liquidity;
uint256 supply = totalSupply();
amount0 = Math.mulDiv(_reserve0, shares, supply);
amount1 = Math.mulDiv(_reserve1, shares, supply);
```
- **What:** Copies the requested LP amount and computes each proportional reserve output with floor rounding.
- **Why here:** The inherited caller encodes these amounts as negative int128 values for claim burn and asset withdrawal (`BaseCustomCurve.sol:L69-L77`).
- **Assumes:** supply is nonzero and reserve/share state has the intended meaning; nonzero supply is enforced only by successful division, while semantic coherence is established by **nothing found** here.
- **Establishes:** deterministic pro-rata amounts for the observed reserve/supply snapshot (L135-L138).
- **Depended on by:** `_getRemoveLiquidity`, `unlockCallback`, and local `_burn` reserve updates.

---

**Cross-Function Dependencies:**
- Caller `BaseCustomCurve._getRemoveLiquidity` (internal/base-source-available, `BaseCustomCurve.sol:L69-L77`): safe-casts outputs to int128, negates them, and preserves the requested share count.
- Callee `ERC20.totalSupply` (internal/OZ-source-available, `ERC20.sol:L82-L84`): returns current LP supply.
- Callee `Math.mulDiv` (internal/OZ-source-available, `Math.sol:L197-L275`): performs floor full-precision division and rejects zero denominator/overflow.
- Downstream `BaseCustomCurve.unlockCallback` (public manager callback/source-available, `BaseCustomCurve.sol:L198-L216`): burns claims and transfers the same decoded amounts to the recorded sender.
- Downstream `_burn` (internal, L148-L170): checks returned delta signs, subtractability/minimum reserves, then ERC-20 share ownership.
- Shared state: reserve fields and ERC-20 supply can change in other transactions; all reads in this call occur before the external unlock at `BaseCustomCurve.sol:L159-L169`.
- Invariant coupling: no explicit `shares <= supply` check occurs before external accounting; successful outer completion later requires the caller's ERC-20 burn to succeed (`ERC20.sol:L181-L195`, L229-L234), and any failure reverts the transaction.

---

**Open Questions:**
- unclear; need the specified user-facing behavior for removal calls when supply is zero.

