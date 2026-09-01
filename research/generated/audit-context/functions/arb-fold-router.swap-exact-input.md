## `swapExactInput` in contracts/src/ArbFoldRouter.sol (L58-L91)

**Purpose:** Public entry point for one exact-input custom-curve swap with an
atomic fold request and post-settlement slippage check.

**Inputs & Assumptions:**
- `hook`: untrusted; must pass coordinator membership (L69).
- `zeroForOne`: untrusted direction.
- `amountIn`: untrusted; nonzero and at most `int256.max` here (L67), then hook
  applies the stricter `MAX_SWAP_INPUT`.
- `minAmountOut`: untrusted slippage floor.
- `solver`: untrusted reward recipient; nonzero (L68).
- `deadline`: untrusted timestamp; checked against `block.timestamp` (L66).
- Implicit `msg.sender` becomes payer.

**Outputs & Effects:** Calls PoolManager unlock, which performs swap/fold and
settlement. Returns positive output and emits `SwapAndFold`. Slippage failure
after unlock reverts the entire nested transaction.

**Block-by-Block:**

```solidity
// L66-L69
if (block.timestamp > deadline) ...; ... coordinator.isHook(...)
```
- **What:** Checks timing, representable amount, solver and fixed hook membership.
- **Why here:** Rejects malformed requests before unlock/external state work.
- **Assumes:** coordinator membership was configured correctly.
- **Establishes:** request can be encoded as negative int256 and targets a fixed hook.
- **Depended on by:** unlock request construction.

```solidity
// L71-L85
BalanceDelta delta = abi.decode(manager.unlock(abi.encode(Request({...}))), ...);
```
- **What:** Starts a PoolManager unlock and delegates all swap/fold/settlement
  work to the router callback.
- **Why here:** v4 requires all delta-accounting actions within one unlock.
- **Assumes:** manager calls this router's `unlockCallback` and returns encoded
  `BalanceDelta`; pinned manager does so (`PoolManager.sol:L104-L114`).
- **Establishes:** successful return means PoolManager observed zero unsettled deltas.
- **Depended on by:** output extraction and slippage check.

```solidity
// L86-L90
int128 outputDelta = ...; if (outputDelta <= 0) ...; amountOut = ...;
if (amountOut < minAmountOut) ...; emit ...;
```
- **What:** Selects the output side, validates positivity/minimum and reports it.
- **Why here:** Uses final callback delta but still remains in same EVM transaction.
- **Assumes:** delta orientation follows PoolKey currency ordering and direction.
- **Establishes:** successful caller receives at least requested minimum.
- **Depended on by:** user/UI and benchmark output equivalence.

**Cross-Function Dependencies:** `coordinator.isHook`; external
`PoolManager.unlock`; callback `unlockCallback`. PoolManager's nonzero-delta
check is the atomic settlement gate.

**Open Questions:** The router does not validate that `solver` differs from the
payer or any system address; only nonzero identity is part of current semantics.

