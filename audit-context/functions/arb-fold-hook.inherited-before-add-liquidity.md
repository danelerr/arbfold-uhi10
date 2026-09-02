## `_beforeAddLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol (L331-L338)

**Purpose:** Rejects direct v4 core liquidity additions so assets enter this hook-owned curve only through public `addLiquidity`.

---

**Inputs & Assumptions:**
- All callback parameters are ignored (L331-L335).
- Implicit: caller already passed `BaseHook.beforeAddLiquidity`'s `onlyPoolManager` gate (`BaseHook.sol:L119-L126`).
- Precondition for checked-in manager to invoke this callback: positive `liquidityDelta` and the address permission bit enabled (`Hooks.sol:L194-L205`; `BaseCustomCurve.sol:L293-L309`).

---

**Outputs & Effects:**
- Always reverts with `LiquidityOnlyViaHook` (L337).
- No writes, events, external calls, or successful return.

---

**Block-by-Block:**

```solidity
// L331-L337
function _beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
    internal
    virtual
    override
    returns (bytes4)
{
    revert LiquidityOnlyViaHook();
}
```
- **What:** Rejects every dispatched direct-add callback.
- **Why here:** `PoolManager.modifyLiquidity` invokes the hook before core state modification (`PoolManager.sol:L145-L168`).
- **Assumes:** manager honors the callback permission bits; checked-in implementation establishes this at `Hooks.sol:L194-L205`, runtime identity is **nothing found**.
- **Establishes:** no checked-in external caller can complete a direct positive-liquidity core modification using this hook.
- **Depended on by:** hook-owned-liquidity-only architecture.

---

**Cross-Function Dependencies:**
- Caller wrapper `BaseHook.beforeAddLiquidity` (`BaseHook.sol:L119-L126`) and checked-in `Hooks.beforeModifyLiquidity` (`Hooks.sol:L194-L205`).
- No callees.
- No shared-state writes.
- Invariant coupling: custom `addLiquidity` does not call core `modifyLiquidity`; it settles/mints claims through custom callback instead (`BaseCustomCurve.sol:L218-L241`).

---

**Open Questions:**
- None within the checked-in manager call path.

