## `_beforeSwap` in contracts/src/ArbFoldHook.sol (L72-L84)

**Purpose:** Executes the inherited custom-curve swap accounting and then optionally asks the immutable coordinator to fold the post-swap three-pool state before returning the already computed hook delta.

---

**Inputs & Assumptions:**
- `sender` (`address`): original caller of `PoolManager.swap` under the checked-in v4 call path (`Hooks.sol:L255-L256`). Trust: **untrusted**; used by the superclass event only (`BaseCustomCurve.sol:L126-L146`).
- `key` (`PoolKey calldata`): pool key supplied by the manager callback. Trust: **semi-trusted**; the external wrapper authenticates only the manager address (`BaseHook.sol:L225-L231`) and does not compare this key with stored `poolKey()`.
- `params` (`SwapParams calldata`): direction, signed amount, and price limit originating from the swap caller (`PoolOperation.sol:L18-L25`). Trust: **untrusted**; exact-output values are rejected by `_getUnspecifiedAmount` (L86-L89).
- `hookData` (`bytes calldata`): arbitrary swap metadata. Trust: **untrusted**; empty selects no fold, while nonempty data must ABI-decode as `(bytes4,address)` and pass L81.
- Implicit: virtual reserves, hook ERC-6909 claim balances, manager transient deltas, immutable coordinator, `msg.sender`, and gas.
- Precondition: callback entry came from the intended checked-in manager. Address equality is enforced by `BaseHook.sol:L225-L231`; runtime code identity is **nothing found** in the hook.

---

**Outputs & Effects:**
- Returns the selector, `BeforeSwapDelta`, and zero fee override produced by `BaseCustomCurve._beforeSwap` (`BaseCustomCurve.sol:L86-L149`).
- Through `_getUnspecifiedAmount`, writes the input/output virtual reserves before the optional coordinator call (L78, L86-L103).
- Through `CurrencySettler`, asks the manager to mint input claims to the hook and burn output claims from the hook (`BaseCustomCurve.sol:L108-L115`, `CurrencySettler.sol:L32-L39`, L62-L68).
- Emits inherited `HookSwap` before returning from `super._beforeSwap` (`BaseCustomCurve.sol:L126-L146`).
- Empty `hookData` makes no coordinator call (L79-L83).
- Valid nonempty data calls `IArbFoldCoordinator(coordinator).fold(solver)` (L80-L82); invalid ABI encoding can revert during decode, and invalid fields revert at L81.
- Any later revert rolls back the superclass reserve, claim, and event effects in the same transaction.

---

**Block-by-Block:**

```solidity
// L77-L78
// BaseCustomCurve first computes and books the user's exact output. Folding therefore cannot change it.
(selector, returnDelta, feeOverride) = super._beforeSwap(sender, key, params, hookData);
```
- **What:** Delegates quote calculation, reserve mutation, claim mint/burn, event emission, and hook-delta construction to the custom-curve base.
- **Why here:** The local `returnDelta` is computed before external coordinator execution at L82.
- **Assumes:** the supplied `key` identifies the stored one-pool configuration and the manager consumes the return delta with the checked-in v4 semantics; under runtime addresses, establishment is **nothing found** in this function.
- **Establishes:** on return from the superclass, the exact-input specified amount and calculated output are fixed in local return data (`BaseCustomCurve.sol:L99-L115`), and the virtual reserves have already changed (L86-L103).
- **Depended on by:** the optional coordinator snapshot and the manager's later `Hooks.afterSwap` accounting (`Hooks.sol:L284-L315`).

```solidity
// L79-L83
if (hookData.length != 0) {
    (bytes4 mode, address solver) = abi.decode(hookData, (bytes4, address));
    if (mode != FOLD_MODE || solver == address(0)) revert InvalidHookData();
    IArbFoldCoordinator(coordinator).fold(solver);
}
```
- **What:** Distinguishes the no-fold path from a decoded fold request, validates the local mode/nonzero fields, then calls the coordinator.
- **Why here:** The checked-in coordinator reads all hook reserves at fold entry (`ArbFoldCoordinator.sol:L137-L145`), so it observes the origin hook after the user reserve change.
- **Assumes:** the coordinator address executes the checked-in source and returns with network state consistent with its transitions; address-code binding is established by **nothing found** in the hook.
- **Establishes:** empty data cannot cause a fold; nonempty successful data caused a call with a nonzero solver and the fixed mode (L79-L82).
- **Depended on by:** the caller's expectation of optional atomic swap-plus-fold behavior.

---

**Cross-Function Dependencies:**
- Caller `BaseHook.beforeSwap` (external entry/source-available, `BaseHook.sol:L225-L231`): enforces only `msg.sender == poolManager` before dispatch.
- Callee `BaseCustomCurve._beforeSwap` (internal/base-source-available, `BaseCustomCurve.sol:L86-L149`): classifies currencies, calls the two local pricing functions, changes claims, emits `HookSwap`, and returns `BeforeSwapDelta(+specified,-unspecified)` for the exact-input path.
- Callee `_getUnspecifiedAmount` (internal, L86-L103): rejects nonnegative amounts, bounds and updates reserves, and returns output.
- Callee `_getSwapFeeAmount` (internal, L105-L108): returns fee metadata used only in `HookSwap`; the superclass returns fee override zero at `BaseCustomCurve.sol:L148`.
- Callees `CurrencySettler.take/settle` (internal/source-available, `CurrencySettler.sol:L32-L69`): exact-input uses manager `mint` for input claims and manager `burn` for output claims.
- Callee `IArbFoldCoordinator.fold` (external-source-available/identity-unproven, interface `IArbFold.sol:L16-L18`; checked-in implementation `ArbFoldCoordinator.sol:L130-L159`): may revert or re-enter before returning; the hook performs no post-call state check.
- Downstream `Hooks.beforeSwap/afterSwap` (external-source-available, `Hooks.sol:L247-L315`): the positive specified delta cancels the original negative exact-input amount before core swap, and the returned deltas are mapped to hook and swap caller.
- Downstream `Pool.swap` (internal/source-available, `Pool.sol:L318-L320`): returns zero core delta when the adjusted amount is zero.
- Shared state: reserve fields are written here through `_getUnspecifiedAmount`; the coordinator call may write all registered hooks through their setters (`ArbFoldCoordinator.sol:L211-L213`).
- Invariant coupling: matching claim/reserve deltas preserve a pre-existing equality or difference; equality on entry is established by **nothing found** locally.

---

**Open Questions:**
- unclear; need the protocol specification to determine whether empty `hookData` is an intended operating mode.
- unclear; need deployment evidence to bind both external addresses to the checked-in `PoolManager` and coordinator implementations.

