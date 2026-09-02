## `_modifyLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol (L159-L170)

**Purpose:** Bridges hook-owned add/remove calculations into a `PoolManager.unlock` callback and returns the callback's packed principal/fee deltas to the public liquidity entry point.

---

**Inputs & Assumptions:**
- `params` (`bytes memory`): ABI encoding of `(int128 amount0, int128 amount1)` created by `_getAddLiquidity` or `_getRemoveLiquidity` (`BaseCustomCurve.sol:L55-L77`). Trust: **internal** on the checked-in caller paths.
- Implicit: `msg.sender` is the external `addLiquidity` or `removeLiquidity` caller, immutable `poolManager`, manager lock/transient-delta state, and gas.
- Precondition: `params` decodes as two int128 values; established by both checked-in encoders at L62 and L76.
- Precondition: manager is locked before this call. Checked-in `PoolManager.unlock` rejects an already unlocked state (`PoolManager.sol:L104-L105`); no local precheck occurs.

---

**Outputs & Effects:**
- Decodes the two signed amounts (L165).
- Externally calls `poolManager.unlock` with `CallbackDataCustom(msg.sender, amount0, amount1)` (L166-L168).
- Under the checked-in manager, unlock sets the unlocked state, calls this hook's `unlockCallback`, requires all transient deltas zero, and relocks (`PoolManager.sol:L104-L114`).
- ABI-decodes manager return data as `(BalanceDelta callerDelta, BalanceDelta feesAccrued)` (L166-L169).
- No direct local storage write or event; the callback changes claims/custody and emits `HookModifyLiquidity`.

---

**Block-by-Block:**

```solidity
// L165-L169
(int128 amount0, int128 amount1) = abi.decode(params, (int128, int128));
(callerDelta, feesAccrued) = abi.decode(
    poolManager.unlock(abi.encode(CallbackDataCustom(msg.sender, amount0, amount1))),
    (BalanceDelta, BalanceDelta)
);
```
- **What:** Recovers signed requested amounts, records the current liquidity caller in callback data, runs the manager unlock/callback, and decodes its result.
- **Why here:** All manager operations that create transient currency deltas occur inside one unlock that must close them before return.
- **Assumes:** the manager calls `unlockCallback` on this hook with unchanged data and returns its bytes; checked-in implementation establishes that at `PoolManager.sol:L104-L114`, runtime identity is **nothing found**.
- **Establishes:** under checked-in manager semantics, a successful return means the callback returned two deltas and no manager transient currency delta remains (`PoolManager.sol:L110-L113`).
- **Depended on by:** `addLiquidity` and `removeLiquidity` share/reserve mutation and slippage checks (`BaseCustomAccounting.sol:L157-L180`, L205-L217).

---

**Cross-Function Dependencies:**
- Callers `BaseCustomAccounting.addLiquidity/removeLiquidity` (internal dispatch/source-available, `BaseCustomAccounting.sol:L154-L161`, L202-L209).
- Upstream encoders `_getAddLiquidity/_getRemoveLiquidity` (internal/base-source-available, `BaseCustomCurve.sol:L55-L77`).
- Callee `IPoolManager.unlock` (external-source-available/identity-unproven, interface `IPoolManager.sol:L109-L114`; implementation `PoolManager.sol:L104-L114`): may revert, return malformed bytes, or invoke behavior other than the checked-in callback flow when runtime identity differs.
- Callback `BaseCustomCurve.unlockCallback` (external entry/base-source-available, `BaseCustomCurve.sol:L179-L242`), authenticated by `onlyPoolManager`.
- Shared state: no direct local state; callback changes manager custody, claims, and transient deltas.
- Invariant coupling: successful checked-in unlock establishes zero transient-delta count, not equality between hook virtual reserves and claim balances.

---

**Open Questions:**
- unclear; need runtime bytecode evidence for `poolManager`.

