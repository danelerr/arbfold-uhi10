## `removeLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol (L192-L218)

**Purpose:** Publicly converts caller-selected LP shares into pro-rata assets by burning hook claims, transferring underlying from the manager, updating virtual reserves, burning shares, and checking minima atomically.

---

**Inputs & Assumptions:**
- `params` (`RemoveLiquidityParams calldata`): share amount, minima, deadline, ticks, and salt from external caller. Trust: **untrusted** (L87-L95, L192).
- Implicit: `block.timestamp`, `msg.sender`, stored pool key, manager state/layout, reserves, hook claim balances, LP balances/supply, token behavior.
- Precondition: deadline not expired; enforced by `ensure` at L112-L115 and L195.
- Precondition: manager slot0 for stored key is initialized; checked at L198-L200 under the expected `StateLibrary` layout.
- Precondition: `totalSupply() != 0`; `_getAmountOut` has no explicit guard and `Math.mulDiv` rejects zero denominator (`ArbFoldHook.sol:L129-L139`, `Math.sol:L197-L218`).

---

**Outputs & Effects:**
- External manager storage read through `getSlot0` (L198).
- Calls `_getRemoveLiquidity`, which computes and encodes pro-rata reserve outputs (L202-L203; `BaseCustomCurve.sol:L69-L77`).
- Calls `_modifyLiquidity`; checked-in callback burns hook claims and asks manager to transfer underlying to `msg.sender` before returning (L205-L206; `BaseCustomCurve.sol:L198-L216`).
- Calls derived `_burn`, which validates/updates reserves and burns caller LP shares (L208-L209; `ArbFoldHook.sol:L148-L170`).
- Returns principal delta after fee subtraction and enforces both minima last (L211-L217).
- Any failure after transfers, reserve writes, or share burn reverts the complete transaction.

---

**Block-by-Block:**

```solidity
// L195-L203
ensure(params.deadline)
...
(uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey().toId());
if (sqrtPriceX96 == 0) revert PoolNotInitialized();
(bytes memory modifyParams, uint256 shares) = _getRemoveLiquidity(params);
```
- **What:** Enforces time/initialization and computes encoded withdrawal amounts plus shares.
- **Why here:** It avoids asset movement before basic availability and quote calculation succeed.
- **Assumes:** the manager external read corresponds to the checked-in pool layout; runtime establishment is **nothing found**.
- **Establishes:** a nonzero observed pool price and deterministic withdrawal proposal for the current reserve/supply snapshot.
- **Depended on by:** unlock settlement.

```solidity
// L205-L209
(BalanceDelta callerDelta, BalanceDelta feesAccrued) = _modifyLiquidity(modifyParams);
_burn(params, callerDelta, feesAccrued, shares);
```
- **What:** Executes claim/underlying withdrawal in an unlock, then commits reserve/share state.
- **Why here:** The derived burn sees the amounts actually returned by the callback; an eventual burn failure rolls prior transfers back.
- **Assumes:** the manager invokes/returns from the checked-in callback and enforces atomic delta closure; runtime identity is **nothing found**.
- **Establishes:** after successful `_burn`, reserves and LP supply reflect the transferred amounts (`ArbFoldHook.sol:L154-L169`).
- **Depended on by:** final delta/minimum checks.

```solidity
// L211-L217
delta = callerDelta - feesAccrued;
if (uint128(delta.amount0()) < params.amount0Min || uint128(delta.amount1()) < params.amount1Min) {
    revert TooMuchSlippage();
}
```
- **What:** Derives principal output and checks both user minima.
- **Why here:** Uses callback results, and a failure still reverts all earlier effects.
- **Assumes:** principal deltas are nonnegative; checked-in callback and derived `_burn` establish/reject that (`BaseCustomCurve.sol:L198-L241`, `ArbFoldHook.sol:L154-L156`).
- **Establishes:** successful return meets both minima (L214-L217).
- **Depended on by:** external caller interpretation of the returned delta.

---

**Cross-Function Dependencies:**
- Callees `poolKey` and `StateLibrary.getSlot0` (base/v4-source-available, L120-L122; `StateLibrary.sol:L40-L62`).
- Callee `BaseCustomCurve._getRemoveLiquidity` (internal/base-source-available, `BaseCustomCurve.sol:L69-L77`) and derived `_getAmountOut` (`ArbFoldHook.sol:L129-L139`).
- Callee `BaseCustomCurve._modifyLiquidity` and `unlockCallback` (`BaseCustomCurve.sol:L159-L242`): burn claims, then `PoolManager.take` underlying to the recorded sender.
- Callee derived `_burn` and OZ ERC-20 `_burn` (`ArbFoldHook.sol:L148-L170`, `ERC20.sol:L229-L234`).
- External token/native transfer occurs inside checked-in `PoolManager.take` at `PoolManager.sol:L291-L296` through `Currency.sol:L40-L88`; recipient/token code may revert or re-enter before outer reserve/share commit.
- Shared state: hook claim balances and manager custody change before local reserve and LP supply writes, but transaction reversion is atomic.
- Invariant coupling: equal withdrawal deltas preserve any entry difference between virtual reserves and claims; no equality assertion occurs in this flow.

---

**Open Questions:**
- unclear; need deployment evidence for the runtime manager and currency implementations.
- unclear; need lifecycle specification for removal after all LP supply has been burned.

