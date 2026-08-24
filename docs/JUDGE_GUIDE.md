# Five-Minute Judge Guide

## 0:00–0:45 — Understand the result

Open the [live dashboard](https://danelerr.github.io/arbfold-uhi10/), or serve the repository locally with:

```bash
python3 -m http.server 8080
```

The one-sentence claim is:

> Same outcome. Same user output. Same solver reward. ARBFOLD uses 19.12% less gas at the canonical 100k benchmark.

Change the five trade-size buttons. The result is workload-dependent: ARBFOLD is 19.12% cheaper at 50k–200k, 4.41% cheaper at 10k and 0.98% more expensive at 25k.

## 0:45–2:00 — Inspect the v4-native path

1. [`ArbFoldHook._beforeSwap`](../contracts/src/ArbFoldHook.sol#L72): the OpenZeppelin curve first computes/books user output, then requests the fold.
2. [`ArbFoldCoordinator._applyDirect`](../contracts/src/ArbFoldCoordinator.sol#L144): real PoolManager ERC-6909 claims move between hooks and to the solver.
3. [`ArbFoldRouter.unlockCallback`](../contracts/src/ArbFoldRouter.sol#L93): the swap and all currency settlement happen in one unlock.
4. [`DeployArbFold._mineAndDeploy`](../contracts/script/DeployArbFold.s.sol#L185): three hook addresses are actually mined and a complete demo network is initialized.

## 2:00–3:15 — Check the evidence

```bash
cd contracts
forge test --offline -q

cd ../benchmark/arbfold-foundry
forge test --offline -q
```

Core properties are in:

- [`ArbFold.t.sol`](../contracts/test/ArbFold.t.sol): output, slippage, authorization, fuzz and canonical state;
- [`ArbFoldInvariant.t.sol`](../contracts/test/ArbFoldInvariant.t.sol): stateful claims, backing, invariant and residual properties;
- [`ArbFoldCleanCoreBenchmark.t.sol`](../contracts/test/ArbFoldCleanCoreBenchmark.t.sol): delivered-code execution equivalence and gas grid;
- [`ArbFoldGate.t.sol`](../benchmark/arbfold-foundry/test/ArbFoldGate.t.sol): frozen execution-equivalence and gas comparison.

## 3:15–4:15 — Verify research honesty

Read the [release-candidate report](../benchmark/release-candidate-results/REPORT.md), the [earlier clean-core report](../benchmark/clean-core-results/REPORT.md), and then the [frozen v0 report](../benchmark/arbfold-results/REPORT.md):

```text
Release-candidate canonical gas reduction       19.12%
Earlier clean-core canonical reduction          18.86%
Frozen minimal-harness canonical reduction      39.58%
Release-candidate 25k change                     0.98% more
>=10% LP net-value uplift                       FAIL
```

ARBFOLD is submitted as a gas-efficient execution primitive, not as a production protocol or claim of universal LP-value superiority.

## 4:15–5:00 — Understand uniqueness and limits

- Atomic backrun: three complete AMM swaps, then distribute/reinject profit.
- ARBFOLD: direct backed reserve transition with explicit Pareto checks.
- Same user output, solver reward and final state in the specialized benchmark.
- Not the global optimizer from the paper.
- Requires three new hook-owned pools.
- Not audited or mainnet-ready.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md), [`LIMITATIONS.md`](LIMITATIONS.md) and the [threat model](THREAT_MODEL.md) for the full boundaries.
