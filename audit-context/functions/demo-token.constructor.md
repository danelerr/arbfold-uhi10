## `constructor` in contracts/src/DemoToken.sol (L8)

**Purpose:** Sets display name and symbol for a demo-only ERC-20.

**Inputs & Assumptions:** Arbitrary deployment strings. No validation.

**Outputs & Effects:** Passes values to OpenZeppelin ERC20 constructor. Default
decimals remain inherited 18.

**Block-by-Block:**

```solidity
// L8
constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
```
- **What:** Initializes token metadata.
- **Why here:** Constructor-only metadata.
- **Assumes:** deployment chooses understandable labels.
- **Establishes:** ERC-20 name/symbol.
- **Depended on by:** demo UI/deployment only.

**Cross-Function Dependencies:** OpenZeppelin ERC20 constructor.

**Open Questions:** None; token is explicitly non-production demo infrastructure.

