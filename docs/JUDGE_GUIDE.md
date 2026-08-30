# Five-Minute Judge Guide

## 0:00–0:45 — Understand the result

Open the [live dashboard](https://danelerr.github.io/arbfold-uhi10/), or serve the repository locally with:

```bash
npm ci
make serve
```

The one-sentence claim is:

> ARBFOLD lets one `fold()` call process multiple runtime-checked direct
> settlement rounds instead of replaying every cyclic-arbitrage leg. At the
> canonical v0.1 workload it reaches equivalent final reserves within measured
> tolerance with the same user output and fixed external-recipient reward,
> using 31.06% less total gas than the iterative reference.

Click `Replay demo`. The first screen animates the conventional
user swap + three arbitrage swaps + reinjection beside ARBFOLD's user swap +
verification + direct transition, then reveals the measured gas and equivalence
checks. No wallet is required.

Scroll to `Full benchmark`, then change the five workload buttons. v0.1 is
cheaper at all five frozen actionable workloads; the dense sweep separately
shows that 1k–4k execute zero rounds and are more expensive, while all 196
actionable points from 5k–200k are cheaper in the tested canonical path. Then
click `Open Swap Lab`. The lab first explains the three
valueless tokens, three pools, selected swap and checked cycle. Its single
contextual action advances through connect, network switch, exact token deficit,
exact approval and execution. The confirmed receipt links the transaction and
shows output, fold rounds, fixed external-recipient reward, residual arbitrage and gas.

## 0:45–2:00 — Inspect the v4-native path

1. [`ArbFoldHook._beforeSwap`](../contracts/src/ArbFoldHook.sol#L72): the OpenZeppelin curve first computes/books user output, then requests the fold.
2. [`ArbFoldCoordinator._applyDirect`](../contracts/src/ArbFoldCoordinator.sol#L144): real PoolManager ERC-6909 claims move between hooks and to the solver.
3. [`ArbFoldRouter.unlockCallback`](../contracts/src/ArbFoldRouter.sol#L93): the swap and all currency settlement happen in one unlock.
4. [`DeployArbFold._mineAndDeploy`](../contracts/script/DeployArbFold.s.sol#L185): three hook addresses are actually mined and a complete demo network is initialized.

## 2:00–3:15 — Check the evidence

The controlled benchmark and live Swap Lab both use v0.1, but serve different
purposes: the benchmark compares identical snapshots; the mutable public
testnet lets you execute the protocol. Use the compact `Verify everything`
links and inspect the [canonical Unichain Sepolia transaction](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022).
The committed [v0.1 deployment manifest](../deployments/unichain-sepolia-1301-v0.1.json)
records the official PoolManager, 28 deployment transactions, the three hooks,
the demo state transition and its zero residual profit.

The canonical transaction moved 100,000 ARFY through the deployed router,
returned `30.220363129338304386` ARFX, executed two fold rounds in one
`fold()` call and ended with zero residual. The [live-demo guide](LIVE_DEMO_GUIDE.md)
separates the no-wallet `eth_call`, signed testnet execution and controlled
benchmark evidence.

```bash
cd contracts
forge test --offline -q

cd ../benchmark/arbfold-foundry
forge test --offline -q
```

Core properties are in:

- [`ArbFold.t.sol`](../contracts/test/ArbFold.t.sol): output, slippage, authorization, fuzz and canonical state;
- [`ArbFoldInvariant.t.sol`](../contracts/test/ArbFoldInvariant.t.sol): stateful claims, backing, invariant and residual properties;
- [`ArbFoldResearchFindings.t.sol`](../contracts/test/ArbFoldResearchFindings.t.sol): preserves the v0 aliasing finding and proves v0.1 rejects it atomically;
- [`ArbFoldV01.t.sol`](../contracts/test/ArbFoldV01.t.sol): residual getter, cached-state drift, packed telemetry, overflow and forbidden-recipient regressions;
- [`ArbFoldCleanCoreBenchmark.t.sol`](../contracts/test/ArbFoldCleanCoreBenchmark.t.sol): delivered-code execution equivalence and gas grid;
- [`ArbFoldGate.t.sol`](../benchmark/arbfold-foundry/test/ArbFoldGate.t.sol): frozen execution-equivalence and gas comparison.

## 3:15–4:15 — Verify research honesty

Read the [v0.1 report](../benchmark/optimized-release-candidate-results/REPORT.md), the [historical release report](../benchmark/release-candidate-results/REPORT.md), the [earlier clean-core report](../benchmark/clean-core-results/REPORT.md), and the [frozen v0 report](../benchmark/arbfold-results/REPORT.md):

```text
v0.1 canonical gas reduction                    31.06%
v0.1 25k change                                 19.45% less
v0.1 dense actionable rows                      196/196 cheaper
Historical release canonical gas reduction     19.12%
Earlier clean-core canonical reduction          18.86%
Frozen minimal-harness canonical reduction      39.58%
Historical release 25k change                   0.98% more
>=10% LP net-value uplift                       FAIL
```

ARBFOLD is submitted as a gas-efficient execution primitive, not as a production protocol or claim of universal LP-value superiority.

## 4:15–5:00 — Understand uniqueness and limits

- Atomic backrun: three complete AMM swaps, then distribute/reinject profit.
- ARBFOLD: direct backed reserve transition with explicit Pareto checks.
- Same user output and fixed external-recipient reward; equivalent final reserves within measured tolerance in the specialized benchmark.
- Not the global optimizer from the paper.
- Requires three new hook-owned pools.
- Historical v0 permitted the registered-hook reward alias. Public v0.1
  rejects zero, coordinator, manager and hook aliases atomically; production
  authorization still requires an independent audit.
- Not audited or mainnet-ready.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md), [`LIMITATIONS.md`](LIMITATIONS.md) and the [threat model](THREAT_MODEL.md) for the full boundaries.
