## `_mint` in contracts/src/ArbFoldHook.sol (L141-L146)

**Purpose:** Mints calculated LP ERC-20 shares to the liquidity caller after
inherited asset/claim accounting succeeds.

**Inputs & Assumptions:** `shares` comes from `_getAmountIn`; ignored params and
deltas were produced by inherited flow. `msg.sender` remains the external
`addLiquidity` caller because internal calls preserve it.

**Outputs & Effects:** Increases ERC-20 total supply and caller balance through
inherited ERC20 `_mint`; emits standard Transfer. No external calls.

**Block-by-Block:**

```solidity
// L145
_mint(msg.sender, shares);
```
- **What:** Issues LP shares.
- **Why here:** BaseCustomAccounting invokes it after `_modifyLiquidity` returns.
- **Assumes:** settled amounts match the reserves used to calculate shares.
- **Establishes:** caller owns the one-shot pool's LP shares.
- **Depended on by:** `_getAmountOut` pro-rata supply and `_burn` authorization.

**Cross-Function Dependencies:** OpenZeppelin ERC20 `_mint`; inherited
`addLiquidity` caller (`BaseCustomAccounting.sol:L137-L169`).

**Open Questions:** None specific to this wrapper.

