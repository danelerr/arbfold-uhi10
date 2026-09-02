## `transferFrom` in contracts/lib/openzeppelin-uniswap-hooks/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol (L142-L147)

**Purpose:** Moves ArbFoldHook LP shares using owner allowance.

---

**Inputs & Assumptions:** `from`, `to`, `value` are untrusted; caller needs sufficient allowance unless max approval semantics apply.

---

**Outputs & Effects:** Spends allowance, moves LP balance, emits Transfer and returns true. No external calls; reserves unchanged.

---

**Block-by-Block:**

```solidity
// L142-L147
address spender = _msgSender();
_spendAllowance(from, spender, value);
_transfer(from, to, value);
return true;
```
- **What:** Enforces delegated authority then transfers shares.
- **Why here:** Allowance is consumed before balance movement; any later revert is atomic.
- **Assumes:** Standard source-available ERC20 allowance semantics.
- **Establishes:** `to` gains pro-rata removal authority and `from` loses it.
- **Depended on by:** public `removeLiquidity` for future holder.

---

**Cross-Function Dependencies:** ERC20 `_spendAllowance`, `_transfer`, `_update`.

---

**Open Questions:** None.
