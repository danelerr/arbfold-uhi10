## `take` in contracts/lib/openzeppelin-uniswap-hooks/src/utils/CurrencySettler.sol (L62-L69)

**Purpose:** Receives value from the manager either as newly minted ERC-6909 claims or as a raw currency transfer.

---

**Inputs & Assumptions:**
- `currency` (`Currency`): selected from supplied/stored pool key. Trust: **semi-trusted**.
- `poolManager` (`IPoolManager`): immutable external dependency. Trust: **trusted by deployment**; runtime identity is **nothing found** in the hook.
- `recipient` (`address`): hook for claim mint, or liquidity caller for raw withdrawal. Trust: **semi-trusted**.
- `amount` (`uint256`): nominal amount from swap/removal/addition math. Trust: **bounded internal** on checked-in hook paths.
- `claims` (`bool`): internal branch selector fixed at call sites.
- Implicit: manager lock, custody, claim/transient-delta state, recipient/token code, and gas.

---

**Outputs & Effects:**
- Zero amount returns without calls (L65-L66).
- `claims == true`: calls manager `mint(recipient, currencyId, amount)` (L68).
- `claims == false`: calls manager `take(currency, recipient, amount)` (L68).
- No return value or event from this library itself; checked-in manager emits ERC-6909 `Transfer` on mint (`ERC6909.sol:L79-L83`).

---

**Block-by-Block:**

```solidity
// L65-L68
if (amount == 0) return;
claims ? poolManager.mint(recipient, currency.toId(), amount) : poolManager.take(currency, recipient, amount);
```
- **What:** Avoids zero-value calls and selects claim mint or raw manager withdrawal.
- **Why here:** Custom swap and addition retain custody inside the manager as claims; removal releases raw currency.
- **Assumes:** manager has the expected mint/take accounting and enough raw balance on take; runtime identity/balance establishment is **nothing found** in this library.
- **Establishes:** under checked-in manager, mint debits the caller transient delta and credits recipient claims (`PoolManager.sol:L322-L328`); take debits the caller delta and attempts raw transfer to recipient (`PoolManager.sol:L291-L296`).
- **Depended on by:** custom swap input claim mint, add-liquidity claim mint, and remove-liquidity raw payout.

---

**Cross-Function Dependencies:**
- Callers `BaseCustomCurve._beforeSwap` and `unlockCallback` (`BaseCustomCurve.sol:L108-L123`, L198-L236).
- Callee checked-in `PoolManager.mint` (external-source-available, `PoolManager.sol:L322-L328`) and `ERC6909._mint` (`ERC6909.sol:L79-L83`).
- Callee checked-in `PoolManager.take` (external-source-available, `PoolManager.sol:L291-L296`) and `CurrencyLibrary.transfer` (`Currency.sol:L40-L88`): external token/native recipient code may revert or re-enter.
- Shared state: manager currency deltas, raw custody, and ERC-6909 claims.
- Invariant coupling: mint/take each create an opposite transient delta that must be paired elsewhere before checked-in unlock exit (`PoolManager.sol:L104-L114`).

---

**Open Questions:**
- unclear; need runtime manager and currency bytecode to establish external behavior.

