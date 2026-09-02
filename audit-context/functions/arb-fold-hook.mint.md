## `_mint` in contracts/src/ArbFoldHook.sol (L141-L146)

**Purpose:** Issues the LP ERC-20 shares computed during the one-time funding flow to the external `addLiquidity` caller.

---

**Inputs & Assumptions:**
- First three unnamed parameters: add-liquidity params, caller delta, and fee delta from inherited accounting. Trust: **semi-trusted source values**; deliberately ignored at L141-L145.
- `shares` (`uint256`): value returned by `_getAmountIn`. Trust: **internal** on the checked-in call path (`BaseCustomAccounting.sol:L154-L161`, `BaseCustomCurve.sol:L55-L63`).
- Implicit: `msg.sender` and inherited ERC-20 balances/supply.
- Precondition: inherited asset/claim movement completed successfully before this call; established by call order at `BaseCustomAccounting.sol:L154-L161` under the checked-in manager implementation.
- Precondition that returned deltas match `_getAmountIn` amounts is established by the checked-in custom callback at `BaseCustomCurve.sol:L218-L241`; under an arbitrary manager address, establishment is **nothing found**.

---

**Outputs & Effects:**
- Calls inherited ERC-20 `_mint(msg.sender, shares)` (L145).
- Increases total LP supply and caller LP balance and emits `Transfer(address(0), msg.sender, shares)` (`ERC20.sol:L176-L203`, L214-L219).
- No external calls in this wrapper.
- A later slippage/native-refund failure in `addLiquidity` rolls back this mint (`BaseCustomAccounting.sol:L163-L180`).

---

**Block-by-Block:**

```solidity
// L141-L145
function _mint(BaseCustomAccounting.AddLiquidityParams memory, BalanceDelta, BalanceDelta, uint256 shares)
    internal
    override
{
    _mint(msg.sender, shares);
}
```
- **What:** Resolves the overloaded call to OpenZeppelin ERC-20 `_mint(address,uint256)` and credits the current caller.
- **Why here:** `BaseCustomAccounting.addLiquidity` invokes this only after `_modifyLiquidity` returns (`BaseCustomAccounting.sol:L157-L161`).
- **Assumes:** `msg.sender` is still the top-level add-liquidity caller; internal dispatch preserves it from `addLiquidity` through this call (`BaseCustomAccounting.sol:L137-L161`).
- **Establishes:** caller balance and total supply each increase by `shares` if the outer transaction succeeds (`ERC20.sol:L176-L203`).
- **Depended on by:** LP transfers and later `_getAmountOut`/`_burn` accounting.

---

**Cross-Function Dependencies:**
- Caller `BaseCustomAccounting.addLiquidity` (internal dispatch/source-available, `BaseCustomAccounting.sol:L137-L181`).
- Callee `ERC20._mint` (internal/OZ-source-available, `ERC20.sol:L214-L219`) and `_update` (`ERC20.sol:L176-L203`): reject a zero receiver, update supply/balance, emit `Transfer`.
- Shared state: ERC-20 supply is read by `_getAmountOut` (L136); LP balances are transferable through inherited `transfer`/`transferFrom` (`ERC20.sol:L99-L147`).
- Invariant coupling: this wrapper does not inspect the ignored deltas; continuity with settled amounts comes from the inherited caller/callback, not from L141-L145 itself.

---

**Open Questions:**
- None specific to this wrapper after following the checked-in inherited call path.

