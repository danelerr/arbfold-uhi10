# ARBFOLD v0 — Foundry Gate Freeze

## Status

```text
Freeze version        0
Measurements observed NO
Product Solidity      NOT AUTHORIZED
Decision              PENDING
```

This document preregisters the only implementation gate granted to ARBFOLD v0.
The accompanying machine-readable freeze is
[`benchmark/arbfold_freeze_v0.json`](../../../benchmark/arbfold_freeze_v0.json). Its
SHA-256 digest is stored separately and must not change after any gas result is
observed. A changed specification is a different experiment and may not be
reported as v0.

## Question

> Can the exact ARBFOLD v0 state transition be executed materially more
> efficiently than an atomic three-swap cyclic backrun followed by profit
> reinjection?

This gate does **not** test the general convex program from the Defensive
Rebalancing paper. It tests only the specialized three-CPMM construction in
`arbfold_sim/mechanism.py`.

## Fixed implementation environment

| Item | Frozen value |
|---|---|
| Foundry | `1.5.1-stable` |
| Solidity | `0.8.26` |
| EVM | Cancun |
| Optimizer | enabled, 200 runs, no IR |
| OpenZeppelin Uniswap Hooks | `v1.2.1`, commit `12048bb17b93ad9ed683aff9c34b89596280c77d` |
| Uniswap v4-core | commit `d153b048868a60c2403a3ef5b2301bb247884d46` |
| Uniswap v4-periphery | commit `7ebd04b161745b75ed0c24ba2df3bc7c25f65606` |
| forge-std | commit `a6d71da563bbb8d6eef8fbec3a16c61c603d2764` |
| OpenZeppelin Contracts | commit `fcbae5394ae8ad52d8e580a3477db99814b9d565` |

No compiler, optimizer, dependency, EVM or test-input change is permitted after
measurement without creating a new freeze.

## Common architecture

Both mechanisms use the same real Uniswap v4 `PoolManager`, the same mock ERC-20
implementations and the same three OpenZeppelin `BaseCustomCurve`-derived,
hook-owned CPMMs:

```text
Pool AB       WETH / USDC18
Pool BC       USDC18 / DAI18
Pool AC       WETH / DAI18
```

The 18-decimal quote tokens remove decimal-scaling noise from the execution
comparison. This is a benchmark restriction, not a production-token claim.

Each pool owns ERC-6909 claims in `PoolManager`; its recorded virtual reserves
must equal its claim balances after setup and after execution. Both mechanisms
use exact-input swaps and a fixed 30 bps fee (`gamma = 0.997`). There are no
oracles, proxies, upgrades or external callbacks.

Initial value-equivalent reserves are:

```text
AB: 333.333333333333333333 WETH / 1,000,000 USDC18
BC: 1,000,000 USDC18 / 1,000,000 DAI18
AC: 333.333333333333333333 WETH / 1,000,000 DAI18
```

The originating user swap is exact-input `USDC18 -> WETH` in AB. Frozen input
sizes are `10k`, `25k`, `50k`, `100k` and `200k` USDC18. The canonical hard-gate
scenario is `100k`.

## Harness A — atomic backrun plus reinjection

One `PoolManager.unlock` transaction performs:

1. the originating user swap;
2. the optimal `WETH -> USDC18 -> DAI18 -> WETH` cycle;
3. up to eight deterministic rounds if reinjection creates residual cyclic
   profit;
4. a 10% solver reward in WETH claims;
5. reinjection of the remaining cyclic profit into the final pool;
6. settlement of every currency delta.

Every cycle leg must call the actual `PoolManager.swap`; it may not directly
edit pool reserves.

## Harness B — direct ARBFOLD transition

One `PoolManager.unlock` transaction performs:

1. the identical originating user swap;
2. the same closed-form optimal cycle computation;
3. the equivalent direct transfer of ERC-6909 claims among the three hooks;
4. the same reserve-ledger transition and 10% solver reward;
5. up to eight deterministic rounds under the same stopping rule;
6. settlement of every currency delta.

It may not represent reserve movement solely with in-memory numbers. Claim
ownership and persistent reserve storage must both move consistently.

## Frozen arithmetic and stopping rules

- All swap and cycle arithmetic uses integer floor rounding.
- `DENOMINATOR = 1_000_000` and `gamma = 997_000`.
- The three-leg fractional-linear composition and closed-form optimum are shared
  by both harnesses.
- Both directions are evaluated; the more profitable positive cycle is selected.
- Maximum rounds: `8`.
- Stop when threatened profit is at most `1e12` wei of WETH.
- Residual arbitrage is material if it exceeds either `1e12` wei WETH or 1 bp
  of the first-round gross surplus.
- A result that reaches eight rounds while residual profit is material fails.

## Equality and safety requirements

For every frozen size:

1. user input and output must match exactly between mechanisms;
2. solver reward must match exactly;
3. every final virtual reserve must match within one wei;
4. every hook claim balance must equal its corresponding virtual reserve;
5. total token conservation must hold, except for claims explicitly owned by
   the solver or user;
6. every pool invariant must be non-decreasing from the post-user-swap state;
7. no unsettled `PoolManager` delta may remain;
8. execution must be atomic inside the originating transaction;
9. neither path may use a public follow-up transaction;
10. no unauthorized address may apply a reserve transition.

Any violation is an immediate hard kill independent of gas.

## Gas measurement

Each scenario starts from freshly deployed, identical state. The measured
external `execute` call includes:

```text
originating swap
+ PoolManager unlock/callbacks
+ custom-curve accounting
+ cycle swaps or direct transition
+ claim movement
+ reinjection/reward
+ persistent storage
+ final ERC-20 settlement
```

Deployment and initial liquidity provisioning are excluded. EVM execution gas
is measured around the external call. Reported total gas adds the 21,000
transaction intrinsic cost and calldata byte cost (4 gas per zero byte, 16 per
nonzero byte). An origin-only control records incremental mechanism gas.

The primary gas gate is:

```text
ARBFOLD total gas at 100k <= 0.80 * backrun total gas at 100k
```

ARBFOLD must also use less total gas at every other frozen size.

## Rational solver analysis

Gross cyclic surplus is denominated in WETH. Minimum solver compensation is:

```text
minimumReward = incrementalGas * gasPrice * 1.20
```

where `1.20` is a frozen 20% operating/risk margin. Gas-price sensitivities are
`0.001`, `0.01`, `0.1`, `1` and `10` gwei. L1 data cost is equal for the two
fixed-shape outer calls and is reported separately if observed calldata differs.

For each mechanism:

```text
LPNetValue = GrossCyclicSurplus - MinimumSolverReward
```

The primary LP gate is evaluated at the canonical 100k scenario and `0.01 gwei`:

```text
LPNetValue_ARBFOLD >= 1.10 * LPNetValue_Backrun
```

Both the 20% gas gate and 10% LP-net gate are conjunctive. The experiment does
not assume that one mathematically implies the other.

## Opportunity gate

Historical opportunity frequency is evaluated only if all mechanical, gas and
LP-net gates pass. It must use documented public Uniswap/Unichain data and show
that positive post-gas opportunities exist at economically material frequency.
Failure to obtain adequate data is not reported as a pass.

## Decision rule

ARBFOLD v0 passes only if every safety requirement holds and both quantitative
primary gates pass. Otherwise:

```text
KILL_ARBFOLD
NEXT_PROJECT = DEPTHMARKET
```

There is no ARBFOLD v1/v2 parameter rescue after failure. DEPTHMARKET then moves
directly to its own preregistered simulation freeze before product Solidity.
