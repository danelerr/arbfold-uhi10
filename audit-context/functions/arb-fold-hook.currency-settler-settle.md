## `settle` in contracts/lib/openzeppelin-uniswap-hooks/src/utils/CurrencySettler.sol (L32-L52)

**Purpose:** Pays a manager currency delta either by burning ERC-6909 claims, sending native currency, or transferring ERC-20 tokens after synchronizing manager reserves.

---

**Inputs & Assumptions:**
- `currency` (`Currency`): currency selected from the callback-supplied or stored `PoolKey`. Trust: **semi-trusted** (`BaseCustomCurve.sol:L95-L97`, L196).
- `poolManager` (`IPoolManager`): immutable external dependency. Trust: **trusted by deployment**; runtime code identity is **nothing found** in the hook.
- `payer` (`address`): hook for claim burns, or recorded liquidity caller/hook for raw settlement. Trust: **semi-trusted** from the calling flow.
- `amount` (`uint256`): nominal settlement amount. Trust: **bounded internal** on normal hook paths.
- `burn` (`bool`): selects claim burn versus raw payment. Trust: **internal constant at call sites**.
- Implicit: token/native balances, allowances, token code, manager lock/sync state, `address(this)` of the calling hook, and gas.

---

**Outputs & Effects:**
- Zero amount returns without any call (L33-L34).
- `burn == true`: calls manager `burn(payer, currencyId, amount)` (L38-L39).
- Raw native path: calls manager `sync(currency)` then payable `settle{value: amount}` (L40-L42).
- Raw ERC-20 external-payer path: syncs, calls token `transferFrom(payer, manager, amount)`, then manager `settle` (L43-L50).
- Raw ERC-20 self-payer path: syncs, calls token `transfer(manager, amount)`, then manager `settle` (L43-L50).
- No return value or event from this library itself.

---

**Block-by-Block:**

```solidity
// L33-L39
if (amount == 0) return;
if (burn) {
    poolManager.burn(payer, currency.toId(), amount);
}
```
- **What:** Avoids zero-value token behavior and settles via ERC-6909 claim burn when selected.
- **Why here:** Claim burn does not require raw-token synchronization (`IPoolManager.sol:L165-L171`, L204-L210).
- **Assumes:** payer owns claims or authorized allowance/operator permits the burn; checked-in `_burnFrom` establishes/rejects this (`ERC6909Claims.sol:L13-L22`). Runtime manager identity is **nothing found**.
- **Establishes:** under checked-in manager, claim balance falls by `amount` and the caller's transient delta is credited by `amount` (`PoolManager.sol:L332-L335`).
- **Depended on by:** custom swap output settlement and liquidity-removal claim burn.

```solidity
// L40-L42
else if (currency.isAddressZero()) {
    poolManager.sync(currency);
    poolManager.settle{value: amount}();
}
```
- **What:** Selects native currency, resets/synchronizes manager currency state, and sends the nominal amount with settle.
- **Why here:** Checked-in manager measures native payment from `msg.value` (`PoolManager.sol:L348-L365`).
- **Assumes:** the calling hook holds `amount` native currency; balance check is **nothing found** here and EVM call value transfer enforces/reverts it.
- **Establishes:** under checked-in manager, recipient transient delta is credited by sent `msg.value`.
- **Depended on by:** inherited native add-liquidity flow.

```solidity
// L43-L50
else {
    poolManager.sync(currency);
    if (payer != address(this)) {
        IERC20(Currency.unwrap(currency)).safeTransferFrom(payer, address(poolManager), amount);
    } else {
        IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), amount);
    }
    poolManager.settle();
}
```
- **What:** Snapshots manager ERC-20 balance, transfers from the external payer or hook, then asks manager to measure and credit the balance increase.
- **Why here:** `sync` must precede the transfer for checked-in `_settle` to calculate `reservesNow - reservesBefore` (`PoolManager.sol:L348-L364`).
- **Assumes:** token behavior results in the expected balance increase; exact nominal payment is established by **nothing found** in this library. Checked-in outer unlock rejects residual deltas if less is credited (`PoolManager.sol:L104-L114`).
- **Establishes:** only the actual measured manager balance increase is credited by the checked-in manager (`PoolManager.sol:L357-L364`).
- **Depended on by:** add-liquidity transient-delta closure.

---

**Cross-Function Dependencies:**
- Callers `BaseCustomCurve._beforeSwap` and `unlockCallback` (internal/base-source-available, `BaseCustomCurve.sol:L108-L121`, L198-L236).
- Callees checked-in manager `burn`, `sync`, and `settle` (`PoolManager.sol:L278-L287`, L299-L301, L331-L365).
- Callees `SafeERC20.safeTransferFrom/safeTransfer` (internal/OZ-source-available, `SafeERC20.sol:L30-L47`, L176-L244): external token code may revert, return false/malformed data, or re-enter before settlement.
- Shared state: manager synced reserve transient state, currency deltas, raw custody, and ERC-6909 balances.
- Invariant coupling: nominal claim mint/burn amounts close only when measured raw settlement matches; checked-in `PoolManager.unlock` is the final zero-delta gate (`PoolManager.sol:L104-L114`).

---

**Open Questions:**
- unclear; need runtime token semantics and manager bytecode to establish the external branches beyond nominal call intent.

