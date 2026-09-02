## `addLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol (L137-L181)

**Purpose:** Publicly executes the hook's one-time funding flow, settling both assets into the manager, minting ERC-6909 claims to the hook, issuing LP shares, enforcing minima, and refunding excess native currency when applicable.

---

**Inputs & Assumptions:**
- `params` (`AddLiquidityParams calldata`): desired amounts, minima, deadline, ticks, and salt from the external caller. Trust: **untrusted** (L76-L85, L137).
- `msg.value`: untrusted native value (L137-L152, L172-L180).
- Implicit: `block.timestamp`, `msg.sender`, stored `poolKey`, manager slot layout/state, hook reserves/lifecycle, token allowances and token behavior.
- Precondition: `params.deadline >= block.timestamp`; enforced by `ensure` at L112-L115 and attached at L141.
- Precondition: stored pool key identifies an initialized pool in the manager; checked through `getSlot0` and nonzero price at L144-L148, assuming the checked-in manager storage layout (`StateLibrary.sol:L40-L62`). Runtime identity/layout is **nothing found** in the hook.
- Precondition for ERC-20 funding: caller allowance/balance and token transfer behavior permit exact payment; direct establishment before external calls: **nothing found**. Checked-in unlock rejects nonzero residual deltas (`PoolManager.sol:L104-L114`).

---

**Outputs & Effects:**
- Returns principal `BalanceDelta` after subtracting zero custom fees on this derived path (L163-L164; `BaseCustomCurve.sol:L240-L241`).
- External view call to manager `extsload` through `getSlot0` (L146; `StateLibrary.sol:L40-L62`).
- Calls derived `_getAmountIn`, which writes reserves, `_everFunded`, and emits `ReservesUpdated` before settlement (`ArbFoldHook.sol:L110-L127`).
- Calls inherited `_modifyLiquidity`, which invokes manager `unlock` and the hook callback (L157-L158; `BaseCustomCurve.sol:L159-L169`).
- Calls derived `_mint`, increasing LP supply/balance and emitting ERC-20 `Transfer` (L160-L161; `ArbFoldHook.sol:L141-L146`).
- Enforces amount minima after mint (L163-L170); revert rolls back all prior effects.
- If currency0 is native, checks `msg.value` coverage and externally transfers any excess to `msg.sender` (L172-L180; `Currency.sol:L40-L53`).

---

**Block-by-Block:**

```solidity
// L141-L152
ensure(params.deadline)
...
PoolKey memory key = poolKey();
(uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
if (sqrtPriceX96 == 0) revert PoolNotInitialized();
bool isNative = key.currency0.isAddressZero();
if (!isNative && msg.value > 0) revert InvalidNativeValue();
```
- **What:** Enforces time, reads the stored pool's initialization state, identifies native currency0, and rejects native value for an ERC-20 pair.
- **Why here:** No funding/reserve state changes occur before these gates.
- **Assumes:** `getSlot0` reads the expected manager storage layout; checked-in helper hardcodes `POOLS_SLOT = 6` (`StateLibrary.sol:L10-L12`, L40-L62), runtime layout identity is **nothing found**.
- **Establishes:** successful continuation is before deadline, observes nonzero sqrt price, and has compatible `msg.value` mode.
- **Depended on by:** funding calculation and settlement.

```solidity
// L154-L161
(bytes memory modifyParams, uint256 shares) = _getAddLiquidity(sqrtPriceX96, params);
(BalanceDelta callerDelta, BalanceDelta feesAccrued) = _modifyLiquidity(modifyParams);
_mint(params, callerDelta, feesAccrued, shares);
```
- **What:** Calculates exact funding/shares, executes the unlock/callback asset-claim movement, then issues LP shares.
- **Why here:** LP issuance follows successful manager settlement, while all remain in one reversible transaction.
- **Assumes:** manager callback/return data follows checked-in semantics; runtime implementation identity is **nothing found**.
- **Establishes:** on the checked-in path, the hook holds claims equal to newly funded amounts and the caller holds the calculated LP shares (`BaseCustomCurve.sol:L218-L241`, `ArbFoldHook.sol:L141-L146`).
- **Depended on by:** principal delta and slippage checks.

```solidity
// L163-L180
delta = callerDelta - feesAccrued;
uint128 amount0 = uint128(-delta.amount0());
if (amount0 < params.amount0Min || uint128(-delta.amount1()) < params.amount1Min) revert TooMuchSlippage();
if (isNative) {
    if (msg.value < amount0) revert InvalidNativeValue();
    key.currency0.transfer(msg.sender, msg.value - amount0);
}
```
- **What:** Derives principal, enforces caller minima, and refunds excess native input.
- **Why here:** Checks use actual callback deltas; failures revert settlement and share issuance.
- **Assumes:** addition deltas are nonpositive so unary negation/casts have the intended meaning; checked-in custom callback returns negative input amounts and zero fees (`BaseCustomCurve.sol:L218-L241`).
- **Establishes:** returned amounts meet both minima; native funding was covered by `msg.value` before any refund (L167-L180).
- **Depended on by:** the external caller's LP receipt and native balance result.

---

**Cross-Function Dependencies:**
- Callee `poolKey` (internal/base-source-available, L120-L122): returns the single stored key.
- Callee `StateLibrary.getSlot0` (internal/v4-source-available, `StateLibrary.sol:L40-L62`): external `extsload` read of manager state.
- Callee `BaseCustomCurve._getAddLiquidity` (internal/base-source-available, `BaseCustomCurve.sol:L55-L63`), then derived `_getAmountIn` (`ArbFoldHook.sol:L110-L127`).
- Callee `BaseCustomCurve._modifyLiquidity` (internal/base-source-available, `BaseCustomCurve.sol:L159-L169`) and `unlockCallback` (`BaseCustomCurve.sol:L179-L242`).
- Callee derived `_mint` and OZ ERC-20 `_mint` (`ArbFoldHook.sol:L141-L146`, `ERC20.sol:L214-L219`).
- Callee `CurrencyLibrary.transfer` on native refund (internal/v4-source-available, `Currency.sol:L40-L88`): external recipient/token code may revert or re-enter before return.
- Shared state: initial reserve/lifecycle writes, manager claims, raw manager custody, LP supply/balance.
- Invariant coupling: transaction success under checked-in manager requires exact transient delta settlement (`PoolManager.sol:L104-L114`); fee-on-transfer or otherwise short payment leaves a nonzero delta and causes unlock failure.

---

**Open Questions:**
- unclear; need deployment evidence for manager layout/code and token implementations.
- unclear; need the protocol specification to state whether native-currency support inherited here is in the deployed ARBFOLD topology.

