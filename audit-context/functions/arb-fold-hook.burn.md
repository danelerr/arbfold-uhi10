## `_burn` in contracts/src/ArbFoldHook.sol (L148-L170)

**Purpose:** Validates liquidity-removal deltas, synchronizes virtual reserves,
and burns the caller's LP shares after inherited claim/token movement.

**Inputs & Assumptions:**
- `callerDelta`: supplied by inherited custom accounting; expected nonnegative
  outputs to LP.
- `shares`: requested/calculated removal amount.
- Assumes claim and underlying transfers encoded by the inherited callback match
  the deltas.

**Outputs & Effects:** Rejects negative deltas; subtracts amounts from both
reserves; allows either both zero (full withdrawal) or requires both above
minimum; burns caller shares and emits reserve event.

**Block-by-Block:**

```solidity
// L154-L160
int128 delta0 = callerDelta.amount0(); ... if (delta0 < 0 || delta1 < 0) revert;
... reserve0After = _reserve0 - amount0; ...
```
- **What:** Validates signs, casts and computes checked post-reserves.
- **Why here:** Bounds/lifecycle checks need concrete after-state.
- **Assumes:** callerDelta reports the inherited movement faithfully.
- **Establishes:** proposed reserves are arithmetically subtractable.
- **Depended on by:** shutdown/minimum-reserve branch.

```solidity
// L161-L165
bool fullWithdrawal = reserve0After == 0 && reserve1After == 0;
if (!fullWithdrawal && (...below minimum...)) revert;
```
- **What:** Allows complete `(0,0)` exit or a still-operational bounded pool.
- **Why here:** Prevents partial dust state.
- **Assumes:** zero/zero is intended terminal state.
- **Establishes:** accepted post-state is terminal or in domain.
- **Depended on by:** storage writes.

```solidity
// L166-L169
_reserve0 = reserve0After; _reserve1 = reserve1After;
_burn(msg.sender, shares); emit ...;
```
- **What:** Commits virtual state and burns LP ownership.
- **Why here:** After validation; any ERC20 burn failure reverts writes.
- **Assumes:** caller owns enough shares; inherited ERC20 enforces this.
- **Establishes:** reserve/share state reflects successful removal.
- **Depended on by:** future swaps, quotes and supply calculations.

**Cross-Function Dependencies:** Called after inherited BaseCustomCurve
unlock/claim/token processing; OpenZeppelin ERC20 `_burn` checks balance.

**Open Questions:** Full withdrawal is irreversible because `_everFunded` is
not cleared; is this terminal lifecycle part of the formal protocol spec?

