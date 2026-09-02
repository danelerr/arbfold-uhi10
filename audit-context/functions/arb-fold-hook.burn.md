## `_burn` in contracts/src/ArbFoldHook.sol (L148-L170)

**Purpose:** Validates the liquidity-removal delta, commits the post-withdrawal virtual reserves, and burns the requested LP shares from the caller.

---

**Inputs & Assumptions:**
- First unnamed parameter: original removal params. Trust: **untrusted origin**, ignored here (L148-L153).
- `callerDelta` (`BalanceDelta`): returned by inherited custom callback. Trust: **semi-trusted**; on the checked-in path it is constructed from the same encoded withdrawal amounts at `BaseCustomCurve.sol:L198-L241`.
- Third unnamed `BalanceDelta`: zero fees on the checked-in custom callback path (`BaseCustomCurve.sol:L240-L241`); ignored here.
- `shares` (`uint256`): caller-selected `params.liquidity` propagated unchanged through `_getAmountOut` and `_getRemoveLiquidity` (L135; `BaseCustomCurve.sol:L69-L77`). Trust: **untrusted origin**.
- Implicit: reserve slots, `msg.sender`, inherited LP balance and total supply.
- Precondition: claim burns and underlying transfers have already returned successfully; established by outer call order at `BaseCustomAccounting.sol:L202-L209` and callback order at `BaseCustomCurve.sol:L198-L216` under the checked-in manager.

---

**Outputs & Effects:**
- Reverts if either returned delta is negative (L154-L156).
- Converts both nonnegative int128 deltas to uint256 (L157-L158; `SafeCast.sol:L567-L579`).
- Checked subtraction reverts if either amount exceeds its virtual reserve (L159-L160).
- Allows `(0,0)` as a full-withdrawal state; otherwise requires both remaining reserves at least `MIN_NETWORK_RESERVE` (L161-L165).
- Writes both reserve slots (L166-L167), burns caller LP shares (L168), and emits `ReservesUpdated` (L169).
- No direct external call; prior underlying transfers occurred in `unlockCallback` and any later revert rolls them back.

---

**Block-by-Block:**

```solidity
// L154-L160
int128 delta0 = callerDelta.amount0();
int128 delta1 = callerDelta.amount1();
if (delta0 < 0 || delta1 < 0) revert InvalidReserves();
uint256 amount0 = SafeCast.toUint256(delta0);
uint256 amount1 = SafeCast.toUint256(delta1);
uint256 reserve0After = _reserve0 - amount0;
uint256 reserve1After = _reserve1 - amount1;
```
- **What:** Extracts signed outputs, rejects debts, converts them, and computes checked post-reserves.
- **Why here:** Lifecycle and minimum checks require concrete nonnegative post-state values.
- **Assumes:** `callerDelta` represents the prior claim/asset movement; checked-in callback establishes exact decoded values (`BaseCustomCurve.sol:L198-L241`), while runtime manager identity remains **nothing found**.
- **Establishes:** both candidate post-reserves are arithmetically subtractable and nonnegative (L156-L160).
- **Depended on by:** the full-versus-partial withdrawal branch.

```solidity
// L161-L165
bool fullWithdrawal = reserve0After == 0 && reserve1After == 0;
if (
    !fullWithdrawal
        && (reserve0After < CycleMath.MIN_NETWORK_RESERVE || reserve1After < CycleMath.MIN_NETWORK_RESERVE)
) revert InvalidReserves();
```
- **What:** Accepts either simultaneous exhaustion or a pair that both remain above the network minimum.
- **Why here:** It rejects storage commitment to a one-sided zero or below-minimum continuing state.
- **Assumes:** simultaneous zero is an intended terminal state; formal establishment: **nothing found** in this function.
- **Establishes:** successful post-state is `(0,0)` or has each reserve at least `MIN_NETWORK_RESERVE` (L161-L165).
- **Depended on by:** reserve storage writes and subsequent pool usability.

```solidity
// L166-L169
_reserve0 = reserve0After;
_reserve1 = reserve1After;
_burn(msg.sender, shares);
emit ReservesUpdated(_reserve0, _reserve1);
```
- **What:** Commits virtual reserves, destroys caller LP shares, and emits the new pair.
- **Why here:** All local reserve checks precede writes; an ERC-20 burn failure reverts those writes atomically.
- **Assumes:** caller owns at least `shares`; OpenZeppelin enforces this at `ERC20.sol:L181-L195`, L229-L234.
- **Establishes:** after successful outer completion, LP supply/balance fall by `shares` and reserves reflect `callerDelta` (L166-L169; `ERC20.sol:L176-L203`).
- **Depended on by:** future pro-rata removals and reserve reads.

---

**Cross-Function Dependencies:**
- Caller `BaseCustomAccounting.removeLiquidity` (internal dispatch/source-available, `BaseCustomAccounting.sol:L192-L218`): invokes this after `_modifyLiquidity` and before slippage checks.
- Upstream `BaseCustomCurve._getRemoveLiquidity` and `unlockCallback` (base-source-available, `BaseCustomCurve.sol:L69-L77`, L198-L241): encode negative calculated outputs, burn claims, take underlying, and return corresponding positive deltas with zero fees.
- Callee `BalanceDeltaLibrary.amount0/amount1` (internal/v4-source-available, `BalanceDelta.sol:L56-L71`).
- Callee OpenZeppelin `SafeCast.toUint256` (internal/OZ-source-available, `SafeCast.sol:L567-L579`).
- Callee `ERC20._burn` (internal/OZ-source-available, `ERC20.sol:L229-L234`) and `_update` (`ERC20.sol:L176-L203`): enforce caller balance and reduce supply.
- Shared state: reserves and LP supply couple this function to `_getAmountOut` (L129-L139) and the one-shot funding lifecycle (L110-L127).
- Invariant coupling: the checked-in callback applies equal withdrawal amounts to claims and returned deltas, preserving any reserve/claim difference that existed before removal; entry equality is established by **nothing found** locally.

---

**Open Questions:**
- unclear; need the lifecycle specification to establish whether successful full withdrawal is intended to be irreversible while `_everFunded` remains true (L115, L124).

