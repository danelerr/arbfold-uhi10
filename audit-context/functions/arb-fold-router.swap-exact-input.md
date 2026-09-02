## `swapExactInput` in contracts/src/ArbFoldRouter.sol (L58-L91)

**Purpose:** Public exact-input entry point that atomically swaps, triggers folding and applies a nominal minimum-output constraint.

---

**Inputs & Assumptions:**
- `hook`, direction, amount, minimum, solver, deadline: untrusted caller inputs.
- `msg.sender` becomes payer.
- Assumes coordinator and manager immutables are correctly paired; constructor does not establish this.
- Assumes manager-returned delta corresponds to actual recipient amount for token behavior in use. Actual recipient balance delta is not read.

---

**Outputs & Effects:** Calls `manager.unlock`, causing callback/swap/settlement/fold; returns nominal `amountOut`; emits `SwapAndFold`. Any post-unlock revert rolls back the complete transaction.

---

**Block-by-Block:**

```solidity
// L66-L69
if (block.timestamp > deadline) revert ...;
if (amountIn == 0 || amountIn > uint256(type(int256).max)) revert ...;
if (solver == address(0)) revert ...;
if (!coordinator.isHook(address(hook))) revert ...;
```
- **What:** Validates time, signed encoding domain, nonzero solver and address membership.
- **Why here:** Rejects before opening the manager lock.
- **Assumes:** `isHook` belongs to the same coordinator/manager pairing.
- **Establishes:** Inputs safe for request encoding; registered origin.
- **Depended on by:** callback.

```solidity
// L71-L85
BalanceDelta delta = abi.decode(manager.unlock(abi.encode(Request({...}))), (BalanceDelta));
```
- **What:** Opens v4 lock and serializes payer/action data.
- **Why here:** PoolManager swap only operates while unlocked.
- **Assumes:** Only the configured manager invokes the callback and returns ABI-encoded `BalanceDelta`; callback guard and v4 source enforce this on intended runtime.
- **Establishes:** All transient deltas were settled, because intended PoolManager checks at `PoolManager.sol:L112`.
- **Depended on by:** output checks.

```solidity
// L86-L90
int128 outputDelta = zeroForOne ? delta.amount1() : delta.amount0();
if (outputDelta <= 0) revert ...;
amountOut = SafeCast.toUint256(outputDelta);
if (amountOut < minAmountOut) revert ...;
emit SwapAndFold(...);
```
- **What:** Selects nominal output, checks positivity/minimum and records success.
- **Why here:** Manager result is only available after callback completes; revert remains atomic.
- **Assumes:** Positive delta equals amount transferred to payer; standard public DemoToken satisfies the transfer model.
- **Establishes:** Returned/event amount meets caller's nominal minimum.
- **Depended on by:** UI/demo evidence.

---

**Cross-Function Dependencies:** External `coordinator.isHook`; external-black-box `manager.unlock` but intended v4 source read; internal callback reentry; `SafeCast`. Callers are arbitrary accounts/scripts/UI.

---

**Open Questions:** Whether minimum output is specified as nominal manager delta or actual ERC-20 balance received for generic tokens.

