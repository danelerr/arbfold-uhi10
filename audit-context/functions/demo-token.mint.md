## `mint` in contracts/src/DemoToken.sol (L10-L12)

**Purpose:** Permissionless testnet/local supply creation for demo funding and swap preparation.

---

**Inputs & Assumptions:** `to`, `amount` are fully untrusted; any caller is authorized by design. OpenZeppelin `_mint` rejects zero recipient.

---

**Outputs & Effects:** Increases total supply and recipient balance; emits standard `Transfer(address(0),to,amount)`. No external calls.

---

**Block-by-Block:**

```solidity
// L10-L12
function mint(address to, uint256 amount) external { _mint(to, amount); }
```
- **What:** Delegates unrestricted minting.
- **Why here:** Token is explicitly marked local/testnet demonstration only at L6.
- **Assumes:** No scarcity/value invariant is attributed to these tokens.
- **Establishes:** Recipient balance/supply increase or atomic revert.
- **Depended on by:** deployment initial liquidity and demo input provisioning (`DeployArbFold.s.sol:L109-L111`, `RunArbFoldDemo.s.sol:L71-L74`).

---

**Cross-Function Dependencies:** OpenZeppelin ERC20 `_mint` (source available). Arbitrary external callers.

---

**Open Questions:** None within `researchOnly` deployment; incompatible with a scarcity claim by construction.
