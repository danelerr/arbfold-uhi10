## `mint` in contracts/src/DemoToken.sol (L10-L12)

**Purpose:** Permissionlessly creates demo token balance for any recipient.

**Inputs & Assumptions:** `to` and `amount` are fully untrusted. Inherited ERC20
rejects zero recipient. There is no supply cap or authorization by design.

**Outputs & Effects:** Increases total supply and recipient balance; emits ERC20
Transfer from zero address.

**Block-by-Block:**

```solidity
// L11
_mint(to, amount);
```
- **What:** Delegates unrestricted mint to ERC20.
- **Why here:** Faucet behavior is the entire demo token surface.
- **Assumes:** token has no economic value and is used only locally/testnet.
- **Establishes:** recipient owns newly created amount.
- **Depended on by:** deployment funding and interactive demo.

**Cross-Function Dependencies:** OpenZeppelin ERC20 `_mint`.

**Open Questions:** None within the explicit demo-only scope.

