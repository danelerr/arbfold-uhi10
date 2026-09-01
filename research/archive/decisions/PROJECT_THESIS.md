# ARBFOLD — Direct State Settlement for Cyclic Arbitrage

> **Don’t replay every leg. Settle the equivalent state.**

> **2026-08-29 evidence note:** The deeper claim-by-claim audit in
> [`THESIS_REASSESSMENT_2026-08-29.md`](THESIS_REASSESSMENT_2026-08-29.md) is
> authoritative where this earlier narrative is less precise. Direct execution
> does not create additional gross surplus, the fixed reward does not pass gas
> savings to LPs, fold mode is opt-in, and the residual threshold is tested but
> is not a final runtime postcondition after eight rounds. A registered hook
> must also not be used as the caller-selected reward address; that aliasing
> case breaks claim/reserve continuity in the frozen v0 research core. v0.1
> rejects that alias and preserves the historical finding unchanged.

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
See the [frozen v0 report](../../../benchmark/arbfold-results/REPORT.md) and the
[clean-core report](../../../benchmark/clean-core-results/REPORT.md).

ARBFOLD v0.1 is a new conservative optimization release. It preserves the
events and public telemetry getters, computes residual on demand, caches the
network state between runtime-checked rounds, compares the cached result with a
fresh final network read, packs telemetry, and rejects aliased reward
recipients. Its five-point benchmark and dense sweep are versioned under
[`benchmark/optimized-release-candidate-results/`](../../../benchmark/optimized-release-candidate-results/).

## Canonical question

> **Can cooperating AMM pools settle an equivalent post-arbitrage state more efficiently without replaying every arbitrage leg?**

Short version:

> **One `fold()` call can process multiple runtime-checked direct settlement
> rounds; gross profit minus the fixed external-recipient reward remains in the
> cooperating pool network.**

## Source of value

ARBFOLD does not manufacture a Pareto improvement by changing fees, charging benign traders, or introducing a subsidy. Its source of value already exists:

```text
inconsistent prices across a pool cycle
                    ↓
         executable cyclic arbitrage
                    ↓
Vanilla, if it wins ordering: searcher removes the profit
ARBFOLD fold path, if it executes first: pools reallocate reserves directly
                                      and retain profit minus the fixed reward
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

Each accepted round verifies the following:

1. every reserve remains positive;
2. token totals are conserved except for the fixed external-recipient reward;
3. every pool invariant is non-decreasing;
4. at least one invariant increases materially;
5. the fixed external-recipient reward is no larger than its frozen share of the threatened cyclic profit.

The release benchmark additionally requires final residual profit below the
frozen threshold. The coordinator stops after at most eight rounds and emits
the exact terminal residual in `FoldCompleted`; `lastResidualProfit()` computes
the current residual from live reserves rather than persisting it. The contract
does not independently revert merely because a post-eighth-round residual
exceeds that threshold. Fold mode is opt-in: empty `hookData` executes a plain
custom-curve swap.

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

The derivation is implemented in [`arbfold_sim/mechanism.py`](../../../arbfold_sim/mechanism.py). This is an exploratory property screen, not a pre-registered economic simulation.

The current tests establish:

- the closed-form optimum is locally maximal against neighboring inputs;
- the paper's three-pool example converges into the fee-adjusted no-arbitrage band;
- 10,000 randomized reserve configurations preserve or increase every pool invariant;
- B and C totals remain exactly conserved;
- the only A leaving the network is the fixed external-recipient reward;
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

The frozen benchmark proved lower execution gas, but not material additional
LP net value. v0.1 shows an execution-gas advantage across the tested
actionable workloads, while its 1k–4k zero-round region remains more expensive.
The UHI10 contribution is therefore the specialized settlement path and its
runtime checks—not an assertion that Homelander-style execution is economically
obsolete.

## v4-native implementation path

- Solidity `0.8.26` and Foundry.
- Uniswap `v4-core` / `v4-periphery` pinned commits.
- OpenZeppelin Uniswap Hooks `BaseCustomCurve` or the smallest equivalent custom-accounting base.
- One fixed coordinator and three CREATE2-mined hooks for exactly three registered pool keys.
- Hook-owned liquidity and internal non-transferable reserve ledger for the MVP.
- Closed-form solver in Solidity with `FullMath` and conservative rounding.
- Minimal router-provided fold mode and solver address in `hookData`; cycle computation and validation remain onchain.
- No oracle, proxy, arbitrary callback target, or upgrade path in the MVP.
- React + TypeScript benchmark and Swap Lab backed by versioned result artifacts.

## Frozen gate result

The preregistered comparison used identical state and flow for:

1. Homelander-style atomic backrun with retained-profit reinjection.
2. ARBFOLD direct reserve rebalancing.

Observed decision:

```text
Mechanical equivalence       PASS
Frozen harness gas reduction PASS (39.58%)
Release canonical result     19.12% less (25k: 0.98% more)
v0.1 canonical result        31.06% less (25k: 19.45% less)
v0.1 dense actionable rows   196/196 cheaper (1k–4k: zero-round regressions)
Earlier clean-core result    18.86% less (25k: 1.13% more)
10% LP net-value uplift      FAIL (0.000287%)
Production authorization     NO
UHI10 research build         YES, around the gas result only
```

The historical opportunity gate was not reached under the preregistered sequence and is not claimed as passed.

## Recommended UHI10 narrative

> ARBFOLD is a Uniswap v4 custom-accounting experiment for a fixed network of
> three cooperating CPMMs. Instead of replaying each leg of an actionable
> cyclic backrun, one `fold()` call can apply multiple runtime-checked direct
> settlement rounds. The user output and fixed external-recipient reward match
> the reference, and final reserves are equivalent within measured tolerance.

This is a research-grade claim. The demo must show numbers, not say that all MEV or LVR is eliminated.
