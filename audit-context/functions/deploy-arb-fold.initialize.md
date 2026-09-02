## `_initialize` in contracts/script/DeployArbFold.s.sol (L198-L231)

**Purpose:** Initializes one dynamic-fee pool, funds its hook-owned liquidity and grants coordinator operator status.

---

**Inputs & Assumptions:** Manager, hook, ordered currencies and reserve values generated internally. Assumes currency contracts are DemoToken and deployer has minted balances.

---

**Outputs & Effects:** Calls manager.initialize at 1:1, approves hook for both tokens, adds full-range liquidity with exact minima and calls `authorizeCoordinator` (L206-L230).

---

**Block-by-Block:**

```solidity
// L206-L215
manager.initialize(PoolKey({fee:DYNAMIC_FEE,tickSpacing:60,hooks:hook}), SQRT_PRICE_1_1);
```
- **What:** Creates the pool identity/state.
- **Why here:** BaseCustomAccounting refuses liquidity before initialization.
- **Assumes:** Manager implements intended v4 checks/callbacks.
- **Establishes:** Stored hook poolKey through inherited beforeInitialize and initialized manager pool.
- **Depended on by:** liquidity add.

```solidity
// L216-L230
approve both; hook.addLiquidity(exact desired/min); hook.authorizeCoordinator();
```
- **What:** Deposits assets/creates claims then grants operator.
- **Why here:** Claims exist before fold authority is needed.
- **Assumes:** Public caller remains liquidity provider and approvals succeed.
- **Establishes:** Initial reserve/claim equality and manager operator state under intended code.
- **Depended on by:** coordinator configuration/fold.

---

**Cross-Function Dependencies:** PoolManager, DemoToken, inherited hook accounting and hook authorization; all source available locally, public manager runtime separately verified.

---

**Open Questions:** None for scripted deployment.

