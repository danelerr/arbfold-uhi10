## `transfer` in contracts/lib/openzeppelin-uniswap-hooks/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol (L99-L103)

**Purpose:** Transfers ArbFoldHook LP shares, thereby transferring pro-rata withdrawal authority.

---

**Inputs & Assumptions:** `to` and `value` are untrusted LP-holder inputs; caller must own enough shares. Assumes ERC20 `_update` is not overridden by ArbFoldHook; it is not.

---

**Outputs & Effects:** Moves LP balance, emits `Transfer`, returns true; no external calls. Does not change reserves, claims or total supply.

---

**Block-by-Block:**

```solidity
// L99-L103
address owner = _msgSender();
_transfer(owner, to, value);
return true;
```
- **What:** Delegates checked LP balance movement.
- **Why here:** Standard inherited ERC-20 entry point.
- **Assumes:** Recipient understands shares confer access to public `removeLiquidity`.
- **Establishes:** Recipient owns the transferred pro-rata withdrawal claim.
- **Depended on by:** future `removeLiquidity`, whose `_burn` burns `msg.sender` shares (`contracts/src/ArbFoldHook.sol:L148-L169`).

---

**Cross-Function Dependencies:** ERC20 `_transfer/_update` L159-L203; inherited `removeLiquidity` uses resulting balance.

---

**Open Questions:** No holder registry/governance exists; current distribution must be read onchain.

