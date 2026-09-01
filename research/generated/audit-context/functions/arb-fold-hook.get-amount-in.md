## `_getAmountIn` in contracts/src/ArbFoldHook.sol (L110-L127)

**Purpose:** Defines the hook's single initial funding amounts and LP shares.

**Inputs & Assumptions:** Add-liquidity params from inherited public function.
Requires `_everFunded == false` and each desired amount within initial bounds.
Assumes desired amounts fit signed int128 conversion later in superclass; the
configured max is below that limit.

**Outputs & Effects:** Returns exact desired amounts and `sqrt(amount0*amount1)`
shares; writes both virtual reserves and permanently sets `_everFunded`; emits
`ReservesUpdated`.

**Block-by-Block:**

```solidity
// L115-L121
if (_everFunded) revert AlreadyFunded(); ... bounds ...
```
- **What:** Enforces one-time, bounded funding.
- **Why here:** No reserve state changes happen first.
- **Assumes:** a one-shot LP lifecycle is intended.
- **Establishes:** valid initial arithmetic domain.
- **Depended on by:** reserve writes and share math.

```solidity
// L122-L126
_reserve0 = amount0; _reserve1 = amount1; _everFunded = true;
shares = Math.sqrt(amount0 * amount1); emit ...;
```
- **What:** Initializes virtual ledger and geometric-mean shares.
- **Why here:** Superclass later settles underlying and mints claims; any failure
  reverts these writes atomically.
- **Assumes:** inherited liquidity flow will transfer matching assets/claims.
- **Establishes:** proposed initial reserve/share state.
- **Depended on by:** `_mint`, future swaps, no-refunding gate.

**Cross-Function Dependencies:** Called by inherited `_getAddLiquidity`, then
`_modifyLiquidity` settles assets and mints claims before this hook's `_mint`
(`BaseCustomCurve.sol:L55-L63`, L159-L169, L179-L242).

**Open Questions:** Full withdrawal cannot be followed by funding because
`_everFunded` remains true; intended lifecycle is documented only in tests.

