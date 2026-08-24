# ARBFOLD arithmetic specification

Status: release-candidate specification for the UHI10 research build. It is not a production-token compatibility claim.

## Numeric domain

ARBFOLD v0 supports only the three deployment-owned `DemoToken` assets. Every token uses 18 decimals and every amount below is a raw token-unit integer.

| Quantity | Accepted bound |
|---|---:|
| Initial reserve, each side | `1e18 <= reserve <= 1_000_000e18` |
| Exact-input swap | `1 <= amountIn <= 200_000e18` |
| Live reserve used by `CycleMath` | `1e18 <= reserve <= 3_000_000e18` |
| CPMM fee denominator | `1_000_000` |
| CPMM fee multiplier `gamma` | `997_000` (30 bps) |
| Solver share | `floor(profitA * 1_000 / 10_000)` |
| Fold rounds | at most 8 |
| Residual threshold | `1e12` raw token-A units (`0.000001 A`) |

`ArbFoldHook` rejects initial funding, swaps, partial withdrawals and coordinator reserve updates that would leave the live domain. A full withdrawal is the sole exception: it produces `(0, 0)` as a terminal shutdown state. The hook records that it has been funded and cannot be funded again after shutdown.

The quote function accepts only networks whose six reserves are inside the live range. A proposed fold can still be rejected atomically if its post-transition reserve distribution leaves that range. This is intentional bounded behavior, not saturation or clipping.

## Units

`CycleMath.Network` fields use the raw units of the token named by each suffix:

| Field | Pool | Unit |
|---|---|---|
| `abA` | A/B | token A |
| `abB` | A/B | token B |
| `bcB` | B/C | token B |
| `bcC` | B/C | token C |
| `acA` | A/C | token A |
| `acC` | A/C | token C |

All `Quote` values are raw integers. `amountAIn`, `amountAOut` and `profitA` are in token A. `intermediateFirst` and `intermediateSecond` follow the selected direction: B then C for the forward cycle; C then B for the reverse cycle. Solver rewards and `RESIDUAL_THRESHOLD` are token-A units.

## Rounding rules

For one CPMM leg:

```text
effectiveIn = amountIn * 997000
amountOut   = floor(effectiveIn * reserveOut /
                    (reserveIn * 1000000 + effectiveIn))
```

`Math.mulDiv` performs the numerator multiplication with 512-bit intermediate precision and rounds down. The hook reports its fee as `floor(amountIn * 3000 / 1000000)`. No value is rounded up against a pool.

The closed-form cycle is represented as `a*x/(b+c*x)`. After each composition, all three coefficients are divided by the same ceiling scale whenever their maximum exceeds `1e36`. Each division rounds down. The optimum then uses a floor integer square root and floor division:

```text
q = floor((floor(sqrt(a*b)) - b) / c)
```

when the numerator is positive; otherwise `q = 0`. Forward wins an exact profit tie. Solver reward rounds down, so the remainder stays in the participating pool network.

The one-wei tolerance in the clean-core benchmark applies to the final-state equivalence between direct folding and the atomic-backrun reference, both of which use the delivered integer quote. It is distinct from the normalization error measured against an arbitrary-precision, unnormalized mathematical reference.

## Cast safety

- The router rejects zero input and values above signed `int256` before negation.
- The hook further restricts input to `200_000e18`, far below `int128.max` (approximately `1.70e38`).
- Every swap output is strictly below its output reserve and therefore below `3_000_000e18`, also far below `int128.max`.
- Positive callback deltas are checked for sign before conversion from `int128` to `uint128` and then `uint256`.
- `BalanceDelta` construction and all remaining narrowing conversions occur in the pinned v4/OpenZeppelin libraries and revert on an out-of-range cast.

## Overflow proof

Let `R = 3e24`, `D = 1e6`, `G < 1e6`, and `N = 1e36`.

- `amountIn * G <= 3e30`.
- `reserveIn * D + amountIn * G <= 6e30`.
- Initial fractional-linear coefficients satisfy `a,b <= 3e30`.
- The first pre-normalization coefficient product is at most `9e60`.
- After normalization each coefficient is at most `N`; the next coefficient product is at most `3e66`, and the additive `G*a` term is at most `1e42`.
- After the final normalization, `a*b <= 1e72`, below `uint256.max` (approximately `1.16e77`).
- A live pool invariant is at most `R^2 = 9e48`.
- Before a post-transition domain check, conservation and a three-pool transfer can place at most the sum of two same-token reserves in one pool side (`6e24`); its checked invariant product remains many orders below `uint256.max`.
- Initial LP share multiplication is at most `(1e24)^2 = 1e48`.

Solidity checked arithmetic remains enabled. Any unexpected underflow or overflow reverts the complete `PoolManager.unlock` transaction.

## Differential result

The reproducible command is:

```bash
python3 -m arbfold_sim.arithmetic_differential --samples 50000 --seed 1057 --check
```

It compares the delivered normalized algorithm with a Python arbitrary-precision composition over 50,000 deterministic log-distributed networks plus boundary fixtures.

| Metric | Maximum absolute error | Maximum relative error |
|---|---:|---:|
| Optimal A input | 1,144,401,276,046 wei | `2.895e-12` |
| First intermediate | 1,512,662,060,817 wei | `2.855e-12` |
| Second intermediate | 1,399,716,355,141 wei | `2.703e-12` |
| A output | 1,144,401,472,670 wei | `1.628e-12` |
| A profit | 1,436,981 wei | `8.164e-13` |
| Final reserve | 261,301,970,890 wei | `1.673e-13` |
| Solver reward | 344,886,215,349 wei | `1.167e-12` |
| Residual profit | 736,086 wei | not meaningful near zero |

There were zero direction mismatches. Of 50,000 valid quote-domain states, 42,338 produced fold trajectories that remained inside the stricter post-transition reserve domain in both implementations. The other 7,662 are rejected atomically rather than clipped. Residual relative error can look large when the exact residual is only a few wei; its observed maximum absolute difference was 736,086 wei (`7.36e-13 A`), below the `1e12`-wei stopping threshold.

The Foundry arithmetic profile separately runs 50,000 fuzz cases for rational-floor swap output and quote self-consistency:

```bash
FOUNDRY_PROFILE=arithmetic forge test --match-contract CycleMathTest
```
