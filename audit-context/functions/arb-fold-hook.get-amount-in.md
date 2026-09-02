## `_getAmountIn` in contracts/src/ArbFoldHook.sol (L110-L127)

**Purpose:** Defines the hook's only successful liquidity addition: exact bounded initial reserves and floor-square-root LP shares.

---

**Inputs & Assumptions:**
- `params` (`BaseCustomAccounting.AddLiquidityParams memory`): user-supplied desired amounts and other fields forwarded by inherited `addLiquidity`. Trust: **untrusted** (`BaseCustomAccounting.sol:L76-L85`, L137-L155).
- Implicit: `_everFunded`, both reserve slots, and Solidity checked arithmetic.
- Precondition: `_everFunded == false`; checked at L115.
- Precondition that existing virtual reserves and claim balances are zero before first funding: establishment is **nothing found**; this function tests only `_everFunded` and overwrites reserves (L115-L124).

---

**Outputs & Effects:**
- Reverts if any previous successful call set `_everFunded` (L115, L124).
- Returns the exact desired amounts after requiring each to be between `MIN_NETWORK_RESERVE` and `MAX_INITIAL_RESERVE` inclusive (L116-L121).
- Writes both reserves and permanently sets `_everFunded = true` before the inherited external settlement begins (L122-L124; caller order `BaseCustomAccounting.sol:L154-L161`).
- Returns `floor(sqrt(amount0 * amount1))` shares (L125; `Math.sol:L485-L595`).
- Emits `ReservesUpdated(amount0, amount1)` (L126).
- No external calls in this function; a later failure in the outer transaction rolls all writes and the event back.

---

**Block-by-Block:**

```solidity
// L115-L121
if (_everFunded) revert AlreadyFunded();
amount0 = params.amount0Desired;
amount1 = params.amount1Desired;
if (
    amount0 < CycleMath.MIN_NETWORK_RESERVE || amount1 < CycleMath.MIN_NETWORK_RESERVE
        || amount0 > CycleMath.MAX_INITIAL_RESERVE || amount1 > CycleMath.MAX_INITIAL_RESERVE
) revert InvalidReserves();
```
- **What:** Enforces the one-shot gate and validates both desired reserve amounts.
- **Why here:** No persistent reserve or lifecycle write precedes these checks.
- **Assumes:** `_everFunded == false` means no prior reserve/claim state needs preserving; equivalence is established by **nothing found**, because the coordinator setter can write reserves without touching `_everFunded` (L61-L69).
- **Establishes:** both amounts are positive and at most `1_000_000 ether` (`CycleMath.sol:L11-L12`).
- **Depended on by:** product arithmetic, int128 conversion in `_getAddLiquidity`, settlement, and share mint.

```solidity
// L122-L126
_reserve0 = amount0;
_reserve1 = amount1;
_everFunded = true;
shares = Math.sqrt(amount0 * amount1);
emit ReservesUpdated(amount0, amount1);
```
- **What:** Commits proposed initial reserves/lifecycle, computes geometric-mean shares, and emits the reserve event.
- **Why here:** The inherited caller needs the returned amounts before it can transfer assets and mint claims (`BaseCustomCurve.sol:L55-L63`, L159-L169).
- **Assumes:** the later inherited settlement succeeds for exactly these amounts; established on the checked-in success path by `BaseCustomCurve.unlockCallback` and `PoolManager.unlock` (`BaseCustomCurve.sol:L218-L241`, `PoolManager.sol:L104-L114`).
- **Establishes:** the proposed reserves and LP share amount; with the configured bounds, `amount0 * amount1 <= 10^48`, below `uint256` maximum.
- **Depended on by:** `_mint` (L141-L146), future swap math, removals, and the permanent `AlreadyFunded` gate.

---

**Cross-Function Dependencies:**
- Caller `BaseCustomCurve._getAddLiquidity` (internal/base-source-available, `BaseCustomCurve.sol:L55-L63`): safe-casts both returned amounts to int128 and encodes them with `shares`.
- Upstream `BaseCustomAccounting.addLiquidity` (public/base-source-available, `BaseCustomAccounting.sol:L137-L181`): checks deadline/initialization, calls this through `_getAddLiquidity`, settles assets/claims, mints LP shares, then checks slippage and native refund.
- Callee `Math.sqrt` (internal/OZ-source-available, `Math.sol:L485-L595`): returns the integer square root rounded toward zero.
- Shared state: `_everFunded` is written only here and never cleared; reserves have three other writer paths (L67-L68, L94-L101, L166-L167).
- Invariant coupling: successful checked-in settlement mints claims equal to the returned amounts, but this function itself neither moves assets nor reads claims.

---

**Open Questions:**
- unclear; need the lifecycle specification to establish whether pre-funding coordinator reserve writes are intended.
- unclear; need the lifecycle specification to establish whether full withdrawal is intentionally terminal because `_everFunded` is never cleared.

