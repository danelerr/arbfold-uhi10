## `_getUnspecifiedAmount` in contracts/src/ArbFoldHook.sol (L86-L103)

**Purpose:** Implements exact-input 30 bps CPMM output and mutates the origin
pool's virtual reserves.

**Inputs & Assumptions:**
- `params`: supplied through PoolManager callback.
- Requires negative `amountSpecified` (exact input), amount at most
  `MAX_SWAP_INPUT`, and post-swap reserves within bounds.
- Assumes current virtual reserves are within CycleMath domain and match claims.

**Outputs & Effects:** Returns `amountOut`; adds full input to input reserve and
subtracts output from output reserve. `CycleMath.swapOut` applies the fee via
effective input, so the fee remains in reserves.

**Block-by-Block:**

```solidity
// L87-L89
if (params.amountSpecified >= 0) revert ExactInputOnly();
uint256 amountIn = uint256(-params.amountSpecified);
if (amountIn > MAX_SWAP_INPUT) revert UnsupportedAmount();
```
- **What:** Restricts swap type and size.
- **Why here:** Negation/cast and arithmetic depend on exact-input sign/domain.
- **Assumes:** caller never supplies `int256.min`; negating it reverts before
  cast under Solidity checked arithmetic.
- **Establishes:** positive, bounded input for directional branches.
- **Depended on by:** both reserve update paths.

```solidity
// L90-L95
if (params.zeroForOne) { bound; amountOut = swapOut(...); bound; update; }
```
- **What:** Quotes reserve0 input to reserve1 output and commits deltas.
- **Why here:** Direction selects reserve roles.
- **Assumes:** `swapOut` returns no more than output reserve; post-min check
  verifies retained bound.
- **Establishes:** updated zero-for-one virtual reserves.
- **Depended on by:** superclass claim booking and later fold.

```solidity
// L96-L102
else { ... }
```
- **What:** Mirrors the operation for reserve1 input to reserve0 output.
- **Why here:** Completes exact-input direction coverage.
- **Assumes/Establishes:** same properties with roles reversed.
- **Depended on by:** superclass and fold.

**Cross-Function Dependencies:** `CycleMath.swapOut`. Caller is inherited
`BaseCustomCurve._beforeSwap`, which then mints input claims and burns output
claims in exactly `amountIn`/`amountOut` amounts (`BaseCustomCurve.sol:L99-L115`).

**Open Questions:** Virtual reserve/claim equality is assumed on entry and
restored by call continuity rather than asserted locally.

