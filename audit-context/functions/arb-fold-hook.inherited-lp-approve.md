## `approve` in contracts/lib/openzeppelin-uniswap-hooks/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol (L120-L124)

**Purpose:** Delegates transfer authority over ArbFoldHook LP shares.

---

**Inputs & Assumptions:** Untrusted `spender/value`; caller is LP owner. Standard approval replacement semantics apply.

---

**Outputs & Effects:** Writes allowance, emits Approval, returns true; no external calls and no direct reserve/claim effect.

---

**Block-by-Block:**

```solidity
// L120-L124
address owner = _msgSender();
_approve(owner, spender, value);
return true;
```
- **What:** Sets spender allowance.
- **Why here:** Enables inherited `transferFrom`.
- **Assumes:** LP owner intentionally delegates the economic withdrawal authority embodied by shares.
- **Establishes:** Spender can move up to allowance.
- **Depended on by:** `transferFrom`.

---

**Cross-Function Dependencies:** ERC20 `_approve`; source available.

---

**Open Questions:** None.

