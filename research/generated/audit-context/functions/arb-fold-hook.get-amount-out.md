## `_getAmountOut` in contracts/src/ArbFoldHook.sol (L129-L139)

**Purpose:** Calculates pro-rata underlying output for an LP-share removal.

**Inputs & Assumptions:** `params.liquidity` is caller-selected. Reads current
reserves and total LP supply. Successful division assumes `totalSupply() > 0`;
establishment in this function: **nothing found**. Subsequent burn enforces the
caller's share ownership.

**Outputs & Effects:** View; returns requested shares and floor-rounded pro-rata
amounts via `Math.mulDiv`. No writes or external calls beyond inherited supply read.

**Block-by-Block:**

```solidity
// L135-L138
shares = params.liquidity;
uint256 supply = totalSupply();
amount0 = Math.mulDiv(_reserve0, shares, supply);
amount1 = Math.mulDiv(_reserve1, shares, supply);
```
- **What:** Computes proportional reserve claims.
- **Why here:** Supplies encoded withdrawal amounts to inherited accounting.
- **Assumes:** nonzero supply and coherent reserve/share state.
- **Establishes:** deterministic floor-rounded output amounts.
- **Depended on by:** inherited removal settlement and `_burn`.

**Cross-Function Dependencies:** Called by inherited `_getRemoveLiquidity`; its
outputs are encoded negative and processed by BaseCustomCurve claim burn/token
take (`BaseCustomCurve.sol:L69-L77`, L179-L242).

**Open Questions:** What user-facing behavior is intended for removal attempts
after full supply has been burned?

