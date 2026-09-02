## `unlockCallback` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol (L179-L242)

**Purpose:** During hook-owned liquidity changes, converts each signed requested amount into paired manager operations: claims versus raw assets, then returns matching signed deltas with zero fees.

---

**Inputs & Assumptions:**
- `rawData` (`bytes calldata`): expected ABI encoding of `CallbackDataCustom { sender, amount0, amount1 }`. Trust: **semi-trusted**; caller address must equal stored manager at L183, while checked-in manager forwards the hook's own encoding (`BaseCustomCurve.sol:L165-L168`, `PoolManager.sol:L104-L110`). Runtime manager identity remains **nothing found**.
- Implicit: `msg.sender`, stored `poolKey`, hook claim balances, manager custody/transient deltas, external token/native code, and gas.
- Precondition: manager is unlocked; established by checked-in `PoolManager.unlock` before callback (`PoolManager.sol:L104-L110`).
- Precondition: stored pool key was initialized and its currencies are intended; `poolKey()` merely returns storage (`BaseCustomAccounting.sol:L120-L122`), and single-key establishment depends on `_beforeInitialize` continuity.

---

**Outputs & Effects:**
- `onlyPoolManager` rejects other caller addresses (`BaseHook.sol:L57-L60`, L183).
- Decodes callback data and loads stored key (L186-L196).
- Negative amount per currency: burns that amount of hook ERC-6909 claims, then transfers raw currency from manager to `data.sender`, recording a positive returned amount (L198-L216).
- Positive amount per currency: transfers raw currency from `data.sender` to manager, then mints that amount of claims to the hook, recording a negative returned amount (L218-L236).
- Zero amount skips both operations and leaves that returned component zero (L188-L235).
- Emits `HookModifyLiquidity` (L238).
- Returns encoded `BalanceDelta(amount0,amount1)` and `ZERO_DELTA` fees (L240-L241).

---

**Block-by-Block:**

```solidity
// L179-L196
function unlockCallback(bytes calldata rawData)
    public
    virtual
    override
    onlyPoolManager
    returns (bytes memory returnData)
{
    CallbackDataCustom memory data = abi.decode(rawData, (CallbackDataCustom));
    int128 amount0;
    int128 amount1;
    PoolKey memory key = poolKey();
```
- **What:** Authenticates by manager address, decodes the recorded liquidity caller/amounts, initializes zero return components, and loads the stored key.
- **Why here:** All subsequent asset/claim branches depend on authenticated signed inputs and currencies.
- **Assumes:** address-authenticated manager supplied data created by `_modifyLiquidity`; under arbitrary code at that address, unchanged-data provenance is established by **nothing found**.
- **Establishes:** decoded signed amounts and the currencies used for every branch.
- **Depended on by:** all four sign branches and event/return encoding.

```solidity
// L198-L216
if (data.amount0 < 0) {
    key.currency0.settle(poolManager, address(this), uint256(int256(-data.amount0)), true);
    key.currency0.take(poolManager, data.sender, uint256(int256(-data.amount0)), false);
    amount0 = -data.amount0;
}
if (data.amount1 < 0) {
    key.currency1.settle(poolManager, address(this), uint256(int256(-data.amount1)), true);
    key.currency1.take(poolManager, data.sender, uint256(int256(-data.amount1)), false);
    amount1 = -data.amount1;
}
```
- **What:** For removal components, burns hook claims first, transfers underlying second, and returns the positive amount.
- **Why here:** Manager burn credits the hook transient delta; manager take debits the same amount, so checked-in accounting nets the component to zero (`PoolManager.sol:L291-L296`, L332-L335).
- **Assumes:** hook owns sufficient claims and manager owns/transfers sufficient raw currency; local checks are **nothing found**. Checked-in claim/raw balance operations revert on failure (`ERC6909.sol:L85-L89`, `Currency.sol:L40-L88`).
- **Establishes:** after both checked-in operations succeed, hook claims fell and `data.sender` received an attempted raw transfer of the same nominal amount; return component is positive.
- **Depended on by:** derived `_burn` and removal slippage checks.

```solidity
// L218-L236
if (data.amount0 > 0) {
    key.currency0.settle(poolManager, data.sender, uint256(int256(data.amount0)), false);
    key.currency0.take(poolManager, address(this), uint256(int256(data.amount0)), true);
    amount0 = -data.amount0;
}
if (data.amount1 > 0) {
    key.currency1.settle(poolManager, data.sender, uint256(int256(data.amount1)), false);
    key.currency1.take(poolManager, address(this), uint256(int256(data.amount1)), true);
    amount1 = -data.amount1;
}
```
- **What:** For addition components, settles raw currency from the recorded payer first, mints equal claims to the hook second, and returns the negative amount.
- **Why here:** Checked-in settlement credits the hook transient delta and claim mint debits it by the same nominal amount (`PoolManager.sol:L300-L301`, L322-L328, L348-L365).
- **Assumes:** token/native payment produces the nominal settled amount; exact establishment before mint is **nothing found**. If checked-in manager measures less, the unlock's nonzero-delta check prevents successful completion (`PoolManager.sol:L104-L114`).
- **Establishes:** on successful checked-in unlock completion, raw custody increased and hook claims increased by the nominal amount; return component is negative.
- **Depended on by:** derived `_mint` and addition slippage checks.

```solidity
// L238-L241
emit HookModifyLiquidity(PoolId.unwrap(key.toId()), data.sender, amount0, amount1);
return abi.encode(toBalanceDelta(amount0, amount1), BalanceDeltaLibrary.ZERO_DELTA);
```
- **What:** Emits signed caller deltas and returns those deltas with no accrued fees.
- **Why here:** Only completed branches are reported.
- **Assumes:** amount packing fits int128; components are int128 variables by construction (L189-L191).
- **Establishes:** checked-in liquidity entry points receive exact decoded nominal deltas and zero fees.
- **Depended on by:** `BaseCustomAccounting.addLiquidity/removeLiquidity` and derived `_mint/_burn`.

---

**Cross-Function Dependencies:**
- Caller `PoolManager.unlock` (external-source-available/identity-unproven, `PoolManager.sol:L104-L114`) after hook `_modifyLiquidity` calls it (`BaseCustomCurve.sol:L159-L169`).
- Modifier `BaseHook.onlyPoolManager` (internal/base-source-available, `BaseHook.sol:L57-L60`).
- Callees `CurrencySettler.settle/take` (internal/source-available, `CurrencySettler.sol:L32-L69`) with all burn/native/ERC-20/claim branches followed in companion records.
- Callees checked-in manager `burn`, `take`, `settle`, `mint` (`PoolManager.sol:L291-L335`, L348-L365) and ERC-6909 claim storage (`ERC6909Claims.sol:L13-L22`, `ERC6909.sol:L79-L89`).
- External black boxes: ERC-20 token code during `safeTransferFrom`/raw `transfer`, and native recipient code during raw transfer (`SafeERC20.sol:L212-L244`, `Currency.sol:L40-L88`); each may revert or re-enter before callback return.
- Shared state: manager custody, ERC-6909 balances, transient currency deltas; no local reserves or LP supply are written in this callback.
- Invariant coupling: the callback's amount continuity is source-enforced; equality of pre-existing claims to virtual reserves is not checked and equal deltas preserve any difference.

---

**Open Questions:**
- unclear; need deployment evidence for the manager and currency implementations.

