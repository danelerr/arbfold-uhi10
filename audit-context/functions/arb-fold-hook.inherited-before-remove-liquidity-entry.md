## `beforeRemoveLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol (L143-L150)

**Purpose:** Exposes the manager-facing pre-remove callback, authenticates the caller by manager address, and dispatches to the inherited function that rejects direct core liquidity removal.

---

**Inputs & Assumptions:**
- `sender` (`address`), `key` (`PoolKey calldata`), `params` (`ModifyLiquidityParams calldata`), and `hookData` (`bytes calldata`): manager-forwarded callback data. Trust: **semi-trusted** after address authentication; the current override ignores every field (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L343-L349`).
- Implicit: `msg.sender` and immutable `poolManager` (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L34`, L57-L60).
- Precondition: caller address equals `poolManager`; enforced by `onlyPoolManager` at L148 and `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`. Runtime code identity is **nothing found**.

---

**Outputs & Effects:**
- Different caller address reverts with `NotPoolManager` before dispatch (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`, L148).
- For the current override, every authenticated call reverts with `LiquidityOnlyViaHook` (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L343-L349`).
- No successful return, storage write, event, or direct external call occurs on this inherited path.

---

**Block-by-Block:**

```solidity
// L143-L150
function beforeRemoveLiquidity(
    address sender,
    PoolKey calldata key,
    ModifyLiquidityParams calldata params,
    bytes calldata hookData
) external onlyPoolManager returns (bytes4) {
    return _beforeRemoveLiquidity(sender, key, params, hookData);
}
```
- **What:** Gates the external callback and dispatches its arguments to the active internal override.
- **Why here:** Authentication precedes the unconditional downstream rejection.
- **Assumes:** address equality is sufficient caller authentication; runtime code identity behind that address is established by **nothing found**.
- **Establishes:** callers other than the immutable manager address cannot reach `_beforeRemoveLiquidity` through this entry point (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`, L143-L150).
- **Depended on by:** the hook-owned-withdrawal boundary enforced by the downstream revert (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L343-L349`).

---

**Cross-Function Dependencies:**
- Upstream checked-in `Hooks.beforeModifyLiquidity` (external-source-available, `contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/libraries/Hooks.sol:L194-L205`): invokes this callback for nonpositive core `liquidityDelta` when the permission bit is enabled.
- Callee modifier `onlyPoolManager` (internal/base-source-available, `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`).
- Callee `_beforeRemoveLiquidity` (internal/base-source-available, `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L343-L349`): always reverts.
- No shared-state writes on this path.
- Invariant coupling: public hook-owned `removeLiquidity` follows a separate unlock/claim path (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L192-L218`; `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol:L159-L242`).

---

**Open Questions:**
- None after following the checked-in manager path; runtime manager bytecode binding remains **nothing found**.

