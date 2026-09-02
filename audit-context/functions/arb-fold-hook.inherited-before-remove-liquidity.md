## `_beforeRemoveLiquidity` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol (L343-L350)

**Purpose:** Rejects direct v4 core liquidity removals so withdrawals occur only through public `removeLiquidity` and LP-share accounting.

---

**Inputs & Assumptions:**
- All callback parameters are ignored (L343-L347).
- Implicit: caller already passed `BaseHook.beforeRemoveLiquidity`'s `onlyPoolManager` gate (`BaseHook.sol:L143-L150`).
- Precondition for checked-in manager to invoke this callback: nonpositive `liquidityDelta` and enabled address permission bit (`Hooks.sol:L194-L205`; `BaseCustomCurve.sol:L293-L309`).

---

**Outputs & Effects:**
- Always reverts with `LiquidityOnlyViaHook` (L349).
- No writes, events, external calls, or successful return.

---

**Block-by-Block:**

```solidity
// L343-L349
function _beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
    internal
    virtual
    override
    returns (bytes4)
{
    revert LiquidityOnlyViaHook();
}
```
- **What:** Rejects every dispatched direct-remove callback, including zero liquidity delta under checked-in dispatch.
- **Why here:** It runs before checked-in core liquidity modification (`PoolManager.sol:L145-L168`).
- **Assumes:** manager honors callback permission bits; checked-in source establishes that, runtime identity is **nothing found**.
- **Establishes:** no checked-in external caller can complete a direct nonpositive core liquidity modification using this hook.
- **Depended on by:** LP-share-mediated removal architecture.

---

**Cross-Function Dependencies:**
- Caller wrapper `BaseHook.beforeRemoveLiquidity` (`BaseHook.sol:L143-L150`) and checked-in `Hooks.beforeModifyLiquidity` (`Hooks.sol:L194-L205`).
- No callees or shared-state writes.
- Invariant coupling: custom `removeLiquidity` burns hook claims and takes raw assets without core liquidity positions (`BaseCustomCurve.sol:L198-L216`).

---

**Open Questions:**
- None within the checked-in manager call path.

