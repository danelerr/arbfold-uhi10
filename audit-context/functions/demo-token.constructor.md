## `constructor` in contracts/src/DemoToken.sol (L8)

**Purpose:** Initializes ERC-20 name and symbol for a research token.

---

**Inputs & Assumptions:** `name_`, `symbol_` are trusted deployment metadata. Decimals inherit OpenZeppelin default 18.

---

**Outputs & Effects:** Calls source-available OpenZeppelin ERC20 constructor; writes metadata. No custom events.

---

**Block-by-Block:**

```solidity
// L8
constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
```
- **What:** Delegates all initialization.
- **Why here:** No additional token policy exists.
- **Assumes:** Vendored OpenZeppelin ERC20 behavior.
- **Establishes:** Standard ERC-20 storage with zero initial supply.
- **Depended on by:** deployment mint/funding and router settlement.

---

**Cross-Function Dependencies:** OpenZeppelin ERC20 constructor (external-source-available).

---

**Open Questions:** None for demo scope.

