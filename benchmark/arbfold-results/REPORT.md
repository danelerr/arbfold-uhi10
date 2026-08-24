# ARBFOLD v0 — Frozen Foundry Gate Report

## Decision

```text
Mechanical gate       PASS
Gas gate              PASS
LP net-value gate     FAIL
Historical gate       NOT REACHED BY PREREGISTERED RULE
Final decision        KILL_ARBFOLD
Next project          DEPTHMARKET
```

The result is bound to freeze hash:

```text
8f6dc062d3897693eed8fa5af9cf5d6b6ce62f7c32af07719cf5d588e203aaf0
```

Raw result hash:

```text
81e9ee474809b9a9e2852e4573383dea9ccc8d40092ceab81cb91d3f550cb00e
```

## What was implemented

The comparison uses an actual Uniswap v4 `PoolManager` and three
OpenZeppelin `BaseCustomCurve`-derived CPMMs per environment.

The atomic-backrun harness performs every cyclic leg through
`PoolManager.swap`, mints the solver reward as an ERC-6909 claim and reinjects
the remainder into the final pool. The direct harness moves real ERC-6909
claims between hook-owned pools and updates persistent reserve ledgers inside
the originating transaction. Neither mechanism is represented as an in-memory
accounting shortcut.

## Mechanical result

Across all five frozen originating sizes:

- user outputs matched exactly;
- solver rewards matched exactly;
- all six final reserves matched exactly;
- every reserve matched the hook's ERC-6909 claim balance;
- PoolManager token backing was exact;
- all three invariants were non-decreasing from the post-user state;
- residual cyclic profit stayed below the frozen threshold;
- unauthorized direct transitions reverted;
- no unsettled PoolManager delta survived transaction completion.

This independently confirms the predicted equivalence:

```text
ARBFOLD v0 state
    ==
atomic cyclic backrun + retained-profit reinjection
```

## Gas result

| Origin input | Backrun total | Direct total | Direct / backrun | Direct reduction |
|---:|---:|---:|---:|---:|
| 10k | 387,527 | 273,244 | 70.50% | 29.50% |
| 25k | 389,233 | 274,950 | 70.63% | 29.37% |
| 50k | 519,042 | 313,610 | 60.42% | 39.58% |
| **100k canonical** | **519,042** | **313,610** | **60.42%** | **39.58%** |
| 200k | 519,031 | 313,599 | 60.42% | 39.58% |

ARBFOLD passed both frozen gas conditions: at the canonical size it used less
than 80% of the backrun's total gas, and it was cheaper at every frozen size.

## LP net-value result

Canonical gross cyclic surplus:

```text
0.858490391161694849 WETH
```

At the frozen `0.01 gwei` gas price and 20% solver operating margin:

```text
Backrun minimum reward   0.000004499976000000 WETH
Direct minimum reward    0.000002034792000000 WETH

Backrun LP net value     0.858485891185694849 WETH
Direct LP net value      0.858488356369694849 WETH
```

Therefore:

```text
Direct / backrun LP net value
= 1.0000028715486478
= 0.000287% improvement
```

The preregistered requirement was `>= 1.10`, or at least a 10% improvement.
ARBFOLD misses it by several orders of magnitude.

Given the measured incremental gas difference, the gas price required to make
the direct path reach a 1.10 LP-net ratio in the canonical scenario is
approximately:

```text
294.49 gwei
```

That is not the frozen canonical environment and may not be substituted after
seeing the result.

## Why the historical gate was not run

The freeze states that historical opportunity frequency is evaluated only if
all mechanical, gas and LP-net gates pass. Because the LP-net hard gate failed,
searching for a favorable historical subset would not change the decision and
would violate the experiment's sequence.

## Final interpretation

Direct reserve transitions are substantially cheaper in EVM gas than three
complete custom-curve swaps. Nevertheless, gas is too small relative to the
captured cyclic surplus for that saving to improve LP net value materially in
the canonical environment.

ARBFOLD v0 would therefore add three custom pools, hook-owned liquidity,
critical return-delta accounting and additional security surface to obtain the
same economic state with only a negligible LP-value improvement.

Per the frozen conjunctive decision rule:

```text
KILL_ARBFOLD
NEXT_PROJECT = DEPTHMARKET
```

