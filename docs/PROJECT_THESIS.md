# ARBFOLD — Gas-Efficient Defensive Rebalancing for Uniswap v4

## Decision status

```text
Economic-superiority thesis   KILLED AFTER FROZEN GATE
Production deployment         NOT AUTHORIZED
Research-grade UHI10 build    AUTHORIZED
```

ARBFOLD v0 is the specialized research direction selected for UHI10. Its
preregistered minimal harness confirmed
mechanical equivalence and a 39.58% canonical gas reduction, but only a 0.000287%
LP net-value improvement against the required 10%. A separate publication check
against the delivered release candidate measured 19.12% less canonical gas
and one 25k case with 0.98% more gas. It remains unauthorized for production.
See the [frozen v0 report](../benchmark/arbfold-results/REPORT.md) and the
[clean-core report](../benchmark/clean-core-results/REPORT.md).

## Canonical question

> **Can cooperating AMM pools reach the same Pareto-safe post-arbitrage state more efficiently through direct reserve transitions?**

Short version:

> **The pools execute their own arbitrage. LPs keep the surplus.**

## Source of value

ARBFOLD does not manufacture a Pareto improvement by changing fees, charging benign traders, or introducing a subsidy. Its source of value already exists:

```text
inconsistent prices across a pool cycle
                    ↓
         executable cyclic arbitrage
                    ↓
Vanilla: searcher removes the profit
ARBFOLD: pools reallocate reserves directly
         and retain most of the threatened profit
```

The mechanism is based on the 2026 defensive-rebalancing result of Sam Devorsetz and Maurice Herlihy: an arbitrage-prone network of log-concave CFMMs admits a direct pool-to-pool rebalancing that makes at least one pool more liquid without reducing the others' liquidity. Their paper explicitly identifies both missing pieces that v4 can address: existing AMMs do not expose direct reserve transfers, and a practical system must obtain priority before competing arbitrage.

## Narrow MVP

Three hook-owned full-range CPMMs:

```text
Pool 1       A / B
Pool 2       B / C
Pool 3       C / A
```

Three hooks and one fixed coordinator maintain virtual reserves for the pool network. A normal user swap keeps its computed output unchanged. The dedicated router passes a fold mode through `hookData`; after the custom curve books the output in `beforeSwap`, the hook asks the coordinator to compute and apply the deterministic transition inside the same unlock.

The hook accepts a proposal only if it verifies all of the following:

1. every reserve remains positive;
2. token totals are conserved except for an explicitly capped solver reward;
3. every pool invariant is non-decreasing;
4. at least one invariant increases materially;
5. the profitable cycle is reduced into the fee-adjusted no-arbitrage band;
6. the solver reward is no larger than its frozen share of the threatened cyclic profit.

If a fold check fails, the ARBFOLD transaction reverts atomically. The user or router may submit a separate normal swap with empty `hookData`; the current implementation does not silently skip a failed fold.

## Closed-form three-pool cycle

For one CPMM leg with fee multiplier `gamma`:

```text
out(x) = gamma * reserveOut * x / (reserveIn + gamma*x)
```

This has the fractional-linear form:

```text
f(x) = a*x / (b + c*x)
```

The composition of three legs has the same form:

```text
F(x) = A*x / (B + C*x)
```

Therefore the profit-maximizing cycle input is available in closed form:

```text
x* = max((sqrt(A*B) - B) / C, 0)
```

No generic convex solver is required for the MVP. The first two reserve transitions match ordinary CPMM legs. On the final leg, principal plus a capped solver share leaves the pool; the remaining threatened profit stays in pool reserves.

## Exploratory mechanical evidence

The derivation is implemented in [`arbfold_sim/mechanism.py`](../arbfold_sim/mechanism.py). This is an exploratory property screen, not a pre-registered economic simulation.

The current tests establish:

- the closed-form optimum is locally maximal against neighboring inputs;
- the paper's three-pool example converges into the fee-adjusted no-arbitrage band;
- 10,000 randomized reserve configurations preserve or increase every pool invariant;
- B and C totals remain exactly conserved;
- the only A leaving the network is the explicit solver reward;
- the solver never receives more than the threatened arbitrage profit.

## Why this is not KNOT

| KNOT | ARBFOLD |
|---|---|
| Same-pair reserve federation | Multi-pair cyclic network |
| Clamps a local user quote to an aggregate quote | Does not alter the user's quote |
| Captures a clipped wedge | Reallocates reserves directly |
| Can tax the price-correcting trade | Makes the correction internally |
| Separate pool quote policy | Pareto-checked network state transition |

KNOT is the closest public UHI10 competitor, not an irrelevant comparison. ARBFOLD must demonstrate this distinction in code and benchmarks.

## Why this is not MEV-X Homelander or Angstrom

Homelander performs an atomic backrun through an external router/executor and distributes extracted profit. Angstrom internalizes MEV through auctions and an offchain consensus network.

ARBFOLD's differentiator is narrower:

> It does not execute an ordinary arbitrage trade and then redistribute proceeds. Cooperative hook-owned pools directly change their reserve allocation under onchain Pareto-safety checks.

The frozen benchmark proved lower execution gas, but not material additional LP net value. The clean-core validation further shows that the advantage depends on workload. The UHI10 contribution is therefore the specialized transition, its measurable large-cycle efficiency and explicit safety checks—not an assertion that Homelander-style execution is economically obsolete.

## v4-native implementation path

- Solidity `0.8.26` and Foundry.
- Uniswap `v4-core` / `v4-periphery` pinned commits.
- OpenZeppelin Uniswap Hooks `BaseCustomCurve` or the smallest equivalent custom-accounting base.
- One fixed coordinator and three CREATE2-mined hooks for exactly three registered pool keys.
- Hook-owned liquidity and internal non-transferable reserve ledger for the MVP.
- Closed-form solver in Solidity with `FullMath` and conservative rounding.
- Minimal router-provided fold mode and solver address in `hookData`; cycle computation and validation remain onchain.
- No oracle, proxy, arbitrary callback target, or upgrade path in the MVP.
- Dependency-free benchmark dashboard backed by the frozen result artifact.

## Frozen gate result

The preregistered comparison used identical state and flow for:

1. Homelander-style atomic backrun with retained-profit reinjection.
2. ARBFOLD direct reserve rebalancing.

Observed decision:

```text
Mechanical equivalence       PASS
Frozen harness gas reduction PASS (39.58%)
Release canonical result     19.12% less (25k: 0.98% more)
Earlier clean-core result    18.86% less (25k: 1.13% more)
10% LP net-value uplift      FAIL (0.000287%)
Production authorization     NO
UHI10 research build         YES, around the gas result only
```

The historical opportunity gate was not reached under the preregistered sequence and is not claimed as passed.

## Recommended UHI10 narrative

> AMMs currently pay external searchers to reconcile prices that their own pool network already makes observable. ARBFOLD is a Uniswap v4 custom-accounting experiment that lets three cooperating pools atomically fold a cyclic arbitrage opportunity into a Pareto-safe reserve reallocation. Every participating pool's invariant must remain non-decreasing, the user swap is unchanged, and only a capped fraction of the threatened profit is paid to the solver.

This is a research-grade claim. The demo must show numbers, not say that all MEV or LVR is eliminated.
