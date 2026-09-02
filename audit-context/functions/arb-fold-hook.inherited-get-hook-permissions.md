## `getHookPermissions` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol (L293-L310)

**Purpose:** Declares exactly which v4 callbacks and return-delta capabilities the hook address must encode and the checked-in manager may invoke.

---

**Inputs & Assumptions:**
- No explicit or implicit mutable inputs; pure function (L293).
- Assumes v4 interprets low-order hook address bits using checked-in `Hooks` constants (`Hooks.sol:L27-L47`); runtime manager implementation identity is **nothing found** in the hook.

---

**Outputs & Effects:**
- Returns true for `beforeInitialize`, `beforeAddLiquidity`, `beforeRemoveLiquidity`, `beforeSwap`, and `beforeSwapReturnDelta` (L294-L305).
- Returns false for all other permissions (L296, L299-L308).
- No writes, events, or external calls.

---

**Block-by-Block:**

```solidity
// L293-L309
return Hooks.Permissions({
    beforeInitialize: true,
    afterInitialize: false,
    beforeAddLiquidity: true,
    beforeRemoveLiquidity: true,
    afterAddLiquidity: false,
    afterRemoveLiquidity: false,
    beforeSwap: true,
    afterSwap: false,
    beforeDonate: false,
    afterDonate: false,
    beforeSwapReturnDelta: true,
    afterSwapReturnDelta: false,
    afterAddLiquidityReturnDelta: false,
    afterRemoveLiquidityReturnDelta: false
});
```
- **What:** Constructs the complete permission bitmap description.
- **Why here:** Base constructor validation consumes it before deployment completes (`BaseHook.sol:L49-L51`, L74-L76).
- **Assumes:** low-order address bits control checked-in manager dispatch; established by `Hooks.sol:L27-L47`, L177-L205, L247-L315 for that implementation.
- **Establishes:** successful BaseHook construction means this contract address carries exactly these bits (`Hooks.sol:L83-L103`).
- **Depended on by:** initialization, direct-liquidity blockers, custom swap invocation, and custom return-delta consumption.

---

**Cross-Function Dependencies:**
- Caller `BaseHook._validateHookAddress` during construction (`BaseHook.sol:L49-L51`, L74-L76).
- Checked-in manager dispatch via `Hooks.beforeInitialize`, `beforeModifyLiquidity`, and `beforeSwap` (`Hooks.sol:L177-L205`, L247-L282).
- No callees beyond struct construction.
- No shared mutable state.
- Invariant coupling: `beforeSwapReturnDelta` is paired with `beforeSwap`, satisfying `Hooks.isValidHookAddress`'s relation (`Hooks.sol:L109-L126`).

---

**Open Questions:**
- None for the declared bitmap; runtime manager identity remains a deployment assumption recorded elsewhere.

