## `unlockCallback` in contracts/src/ArbFoldRouter.sol (L93-L110)

**Purpose:** Executes the requested pool swap inside the manager lock and settles both resulting currency deltas.

---

**Inputs & Assumptions:** `rawData` is trusted only after `msg.sender == manager`; the manager forwards bytes originally supplied by this router's `swapExactInput` on the intended path. Assumes hook `poolKey()` is stable and corresponds to registered hook.

---

**Outputs & Effects:** Calls hook getter, manager.swap and ERC-20/manager settlement via `_settle`; returns ABI-encoded delta. No router storage/events.

---

**Block-by-Block:**

```solidity
// L94-L96
if (msg.sender != address(manager)) revert NotPoolManager();
Request memory request = abi.decode(rawData, (Request));
PoolKey memory key = request.hook.poolKey();
```
- **What:** Authenticates caller, decodes and reads pool identity.
- **Why here:** Prevents arbitrary callers from supplying payer data to settlement.
- **Assumes:** Configured manager itself invokes with bytes tied to the current unlock; intended PoolManager does at `PoolManager.sol:L103-L110`.
- **Establishes:** Manager-originated callback and a concrete key.
- **Depended on by:** swap/settlement.

```solidity
// L97-L105
BalanceDelta delta = manager.swap(key, SwapParams({...}), abi.encode(FOLD_MODE, request.solver));
```
- **What:** Executes exact-input with extreme price limit and fold hook data.
- **Why here:** Hook updates reserves/output and folds before settlement.
- **Assumes:** `amountIn` fits negative int256; outer entry establishes L67. Assumes `key` is the expected registered pool; outer membership plus intended immutable hook key establishes it.
- **Establishes:** A manager-accounted swap delta and any successful fold effects.
- **Depended on by:** settlement and returned amount.

```solidity
// L107-L109
_settle(key.currency0, request.payer);
_settle(key.currency1, request.payer);
return abi.encode(delta);
```
- **What:** Clears both router deltas and returns the original swap delta.
- **Why here:** Intended manager rejects unlock completion with any outstanding delta.
- **Assumes:** Payer allowance/balance covers debts; CurrencySettler enforces transfer success.
- **Establishes:** Zero deltas for the two pool currencies on successful unlock.
- **Depended on by:** `PoolManager.unlock` nonzero-delta guard.

---

**Cross-Function Dependencies:** Hook `poolKey` external-source-available for public runtime; `PoolManager.swap` and hook callback chain; private `_settle` twice.

---

**Open Questions:** `Request.minAmountOut` is decoded but unused in the callback; atomic outer comparison still enforces it after return.

