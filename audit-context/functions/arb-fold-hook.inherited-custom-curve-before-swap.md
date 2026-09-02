## `_beforeSwap` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol (L86-L149)

**Purpose:** Implements the inherited custom curve: delegates output/fee math to `ArbFoldHook`, exchanges ERC-6909 claims with the manager, emits `HookSwap`, and returns a hook delta that removes the full swap amount from v4 core execution.

---

**Inputs & Assumptions:**
- `sender` (`address`): original `PoolManager.swap` caller. Trust: **untrusted**; event field only (L126-L146).
- `key` (`PoolKey calldata`): manager-supplied currencies/hook configuration. Trust: **semi-trusted**; no comparison with stored `poolKey()` occurs at L86-L149.
- `params` (`SwapParams calldata`): untrusted signed amount/direction/price limit (`PoolOperation.sol:L18-L25`).
- Fourth unnamed `bytes calldata`: ignored by this implementation (L86-L90); `ArbFoldHook._beforeSwap` uses the same data after this call (`ArbFoldHook.sol:L78-L83`).
- Implicit: manager unlock state, hook reserve state, hook ERC-6909 balances, and gas.
- Precondition: manager is unlocked for `mint` and `burn`; checked-in `PoolManager.swap` requires unlock (`PoolManager.sol:L187-L190`) and those operations also require it (`PoolManager.sol:L322-L335`). Runtime manager identity is **nothing found** in the hook.

---

**Outputs & Effects:**
- Derives exact-input mode and currency roles (L92-L100).
- Calls local `_getUnspecifiedAmount`, which on success restricts this hook to exact input and updates virtual reserves (L102-L103; `ArbFoldHook.sol:L86-L103`).
- Calls local `_getSwapFeeAmount` for event metadata (L105-L106; `ArbFoldHook.sol:L105-L108`).
- Exact-input success calls manager `mint` for specified input claims and manager `burn` for unspecified output claims via `CurrencySettler` (L108-L115).
- The exact-output branch exists at L116-L124 but is unreachable after the current `ArbFoldHook._getUnspecifiedAmount` returns successfully because nonnegative amounts revert there (`ArbFoldHook.sol:L87`).
- Emits `HookSwap` with ordered amounts and input-side fee (L126-L146).
- Returns `this.beforeSwap.selector`, the packed delta, and fee override zero (L148).

---

**Block-by-Block:**

```solidity
// L92-L106
bool exactInput = params.amountSpecified < 0;
(Currency specified, Currency unspecified) =
    (params.zeroForOne == exactInput) ? (key.currency0, key.currency1) : (key.currency1, key.currency0);
uint256 specifiedAmount = exactInput ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);
uint256 unspecifiedAmount = _getUnspecifiedAmount(params);
uint256 swapFeeAmount = _getSwapFeeAmount(params, unspecifiedAmount);
```
- **What:** Determines currency roles, normalizes the signed amount, obtains output, and computes event fee metadata.
- **Why here:** Claims and deltas below require positive amounts and selected currencies.
- **Assumes:** negating a negative amount is representable; `int256.min` reverts at L100 before the local pricing callee.
- **Establishes:** on the current derived hook's successful path, `exactInput == true`, the input is bounded by `ArbFoldHook.sol:L87-L89`, and reserves are already updated by the time L106 completes.
- **Depended on by:** exact-input claim movement and delta construction.

```solidity
// L108-L115
if (exactInput) {
    specified.take(poolManager, address(this), specifiedAmount, true);
    unspecified.settle(poolManager, address(this), unspecifiedAmount, true);
    returnDelta = toBeforeSwapDelta(specifiedAmount.toInt128(), -unspecifiedAmount.toInt128());
}
```
- **What:** Mints input claims to the hook, burns output claims from it, and encodes `(+input,-output)` in specified/unspecified order.
- **Why here:** Claim movements occur after virtual reserve calculation and before the hook delta is returned to the manager.
- **Assumes:** the hook has at least `unspecifiedAmount` output claims; local balance check: **nothing found**. The checked-in manager burn subtracts the claim balance and reverts if insufficient (`PoolManager.sol:L332-L335`, `ERC6909Claims.sol:L13-L22`, `ERC6909.sol:L85-L89`).
- **Establishes:** under the checked-in manager, input claims increased and output claims decreased by exactly the reserve deltas; it preserves rather than proves an entry equality.
- **Depended on by:** v4 `Hooks.beforeSwap/afterSwap` delta consumption (`Hooks.sol:L247-L315`).

```solidity
// L126-L148
if (specified == key.currency0) {
    emit HookSwap(...);
} else {
    emit HookSwap(...);
}
return (this.beforeSwap.selector, returnDelta, 0);
```
- **What:** Orders the event fields by currency0/currency1 and returns the required callback selector, custom delta, and no LP fee override.
- **Why here:** Emission follows successful claim changes; return occurs only after the event.
- **Assumes:** casts to int128/uint128 fit; established by hook input/reserve caps (`ArbFoldHook.sol:L87-L101`, `CycleMath.sol:L11-L14`) and v4 `SafeCast.sol:L21-L27`, L53-L59.
- **Establishes:** successful callback return is 96-byte ABI data accepted by `Hooks.beforeSwap` and includes the exact full specified delta (`Hooks.sol:L255-L267`).
- **Depended on by:** `PoolManager.swap` and `ArbFoldHook._beforeSwap`'s subsequent optional fold.

---

**Cross-Function Dependencies:**
- Caller `ArbFoldHook._beforeSwap` (internal, `ArbFoldHook.sol:L72-L84`), reached through `BaseHook.beforeSwap` (`BaseHook.sol:L225-L231`).
- Callees `_getUnspecifiedAmount` and `_getSwapFeeAmount` (derived internal, `ArbFoldHook.sol:L86-L108`).
- Callees `CurrencySettler.take/settle` (internal/source-available, `CurrencySettler.sol:L32-L69`), detailed in companion records.
- Downstream `Hooks.beforeSwap` adds the positive specified delta to the negative input, producing zero core amount (`Hooks.sol:L247-L280`); `Pool.swap` returns zero delta at `Pool.sol:L318-L320`; `Hooks.afterSwap` maps the stored hook delta to currencies and subtracts it from the swap caller (`Hooks.sol:L284-L315`).
- Downstream `PoolManager.swap` accounts hook and caller deltas at `PoolManager.sol:L220-L226`; manager `mint`/`burn` already created the opposite hook transient deltas at `PoolManager.sol:L322-L335`, so checked-in unlock accounting nets them.
- Shared state: calls the derived reserve writer before any external manager claim call.
- Invariant coupling: a successful checked-in transaction requires all transient manager deltas to return to zero at unlock exit (`PoolManager.sol:L104-L114`).

---

**Open Questions:**
- unclear; need deployment evidence to bind `poolManager` to the implementation whose delta semantics establish the described continuity.

