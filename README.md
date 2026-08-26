# ARBFOLD

[![ARBFOLD verification](https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml/badge.svg)](https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml)
[![Interactive demo](https://img.shields.io/badge/interactive-demo-c9ff5b?style=flat&labelColor=111319)](https://danelerr.github.io/arbfold-uhi10/)

### 3 swaps → 1 verified transition

> **Why replay a three-swap arbitrage cycle when cooperating pools can verify and apply the equivalent final state directly?**

ARBFOLD is a research-grade Uniswap v4 custom-accounting experiment. After a user swap creates an arbitrage cycle across three new hook-owned pools, ARBFOLD replaces three follow-up swaps plus profit reinjection with one verified, PoolManager-backed reserve transition inside the same transaction.

> **Same user output. Same solver reward. Equivalent final reserves. 19.12% less gas at the canonical 100k benchmark.**

The release-candidate code under `contracts/src` measured **440,128 gas for ARBFOLD versus 544,187 gas for a three-leg atomic backrun plus profit reinjection** at 100k. Every participating invariant must remain non-decreasing.

**The advantage is workload-dependent:** 4.41% less gas at 10k, **0.98% more at 25k**, and 19.12% less from 50k through 200k in the fixed publication grid.

## See it run in 30 seconds

[Open the ARBFOLD interactive benchmark](https://danelerr.github.io/arbfold-uhi10/).

The page opens directly on the experiment—there is no marketing flow to finish
before the demo:

1. **Replay the comparison:** click `Replay demo` to see the conventional three-leg backrun and ARBFOLD direct transition run side by side. The comparison loads immediately from the frozen equivalent-state Foundry benchmark while the public Unichain Sepolia deployment is verified independently in parallel.
2. **Execute it yourself:** click `Run on testnet` and follow one visible step at a time: connect a wallet, prepare valueless ARFX, then submit one atomic `ARFX → ARFY swap + fold`. ARFX, ARFY and ARFZ form the three-pool demo cycle. The receipt links the new transaction and reports output, fold rounds, residual arbitrage and gas.
3. **Use the no-wallet fallback:** inside the testnet panel, expand `Preview without a wallet` to execute the complete deployed router call through RPC, return the real output and estimate gas without changing state.

The visual comparison remains usable if the public RPC is slow or unavailable.
The testnet controls still fail closed: they only enable after checking chain
ID 1301, both public receipts, deployed bytecode, current fold counters and all
six reserves. The Foundry
comparison comes from [`raw.json`](benchmark/release-candidate-results/raw.json)
and is explicitly labeled as benchmark evidence—not as one public transaction
that somehow executes both alternative histories.

For a local copy:

```bash
npm ci
npm run dev
```

Then open the URL printed by Vite. The dashboard is a small React + Vite +
TypeScript application; `npm run typecheck` validates the UI and wallet flow,
while `npm run build:dashboard` creates the GitHub Pages artifact in `dist/`.
See the exact
[live-demo walkthrough](docs/LIVE_DEMO_GUIDE.md).

**Judge proof:** [public canonical transaction](https://sepolia.uniscan.xyz/tx/0x6220b30fd09267c2d4f716ace816c4ebae4b9d5b9970cbe73cb3ccd665cfbf7c) · [deployment manifest](deployments/unichain-sepolia-1301.json) · [hook](contracts/src/ArbFoldHook.sol) · [coordinator](contracts/src/ArbFoldCoordinator.sol) · [router](contracts/src/ArbFoldRouter.sol) · [six-path invariants](contracts/test/ArbFoldInvariant.t.sol) · [release evidence](docs/RELEASE_EVIDENCE.md). Run the complete fail-closed gate with `make verify-release`.

**Public-chain status:** the research network and canonical demo are live on **Unichain Sepolia (chain 1301)** using the official v4 `PoolManager`. The latest browser-executed signed-path validation is [`0x87a940…5deceb`](https://sepolia.uniscan.xyz/tx/0x87a940bc58558886fe7debc34373c9ccec5ce1db6143695b8b5c7063e75deceb): 1,000 ARFX entered, 0.290519 ARFY reached the user, one fold round ran and residual cyclic profit was zero. ARFX and ARFY are freely mintable test assets with no value.

## What happens in one transaction

```text
User exact-input swap
        ↓
PoolManager.swap
        ↓
ArbFoldHook computes and books the user's output
        ↓
ArbFoldCoordinator quotes the three-pool cycle
        ↓
Backed ERC-6909 claims move directly between hooks
        ↓
Onchain conservation + invariant checks
        ↓
Router settles every currency delta
```

The clean core is under [`contracts/`](contracts/). The immutable preregistered comparison remains under [`benchmark/arbfold-foundry/`](benchmark/arbfold-foundry/); it is intentionally separate so the measured experiment is not rewritten after the result.

## Reproduce it

Clone the pinned OpenZeppelin dependency and its Uniswap/Foundry submodules:

```bash
git clone --recurse-submodules https://github.com/danelerr/arbfold-uhi10.git
cd arbfold-uhi10
```

If the repository was already cloned, run `git submodule update --init --recursive` once. The root submodule is pinned to OpenZeppelin Uniswap Hooks commit `12048bb17b93ad9ed683aff9c34b89596280c77d`.

Run every local verification with one command:

```bash
make test
```

### Clean core

```bash
cd contracts
forge test --offline
forge snapshot --offline
```

The suite covers:

- real Uniswap v4 `PoolManager` execution;
- mined hook addresses with the required permission flags;
- exact-input output preservation;
- ERC-6909 claims equal to all six virtual reserves;
- exact underlying token backing;
- per-transition conservation;
- invariant monotonicity;
- bounded residual arbitrage;
- unauthorized coordinator calls;
- atomic slippage reverts;
- all six origin/direction paths;
- 10,000-case release fuzzing and 20,480 calls per stateful invariant property;
- 50,000-case arithmetic differential/fuzz verification;
- 98.50% project line coverage and 90.38% branch coverage;
- a pinned Slither gate with zero unreviewed High/Medium findings.

### Delivered release-candidate comparison

```bash
cd contracts
forge test --offline --match-contract ArbFoldCleanCoreBenchmarkTest -vv
```

Both paths start from the same deployed state snapshot. The direct path uses the published hook, coordinator and router; the reference executes three real `PoolManager.swap` calls and reinjects the same retained profit.

The delivered source was fixed at commit [`9cbc16e`](https://github.com/danelerr/arbfold-uhi10/commit/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b) and the comparison was rerun from that clean commit. Its deterministic `contracts/src` tree hash is `53db6012988f770c06f784b6f0ad152ac844ae1a0dc8058e1f1dfd002b85c3f3`.

| Origin input | Atomic backrun | Published ARBFOLD | Exact change |
|---:|---:|---:|---:|
| 10k | 407,272 | 389,292 | 4.41% less |
| 25k | 409,381 | 413,409 | **0.98% more** |
| 50k | 544,186 | 440,127 | 19.12% less |
| **100k** | **544,187** | **440,128** | **19.12% less** |
| 200k | 544,177 | 440,117 | 19.12% less |

The advantage is workload-dependent. It is material for the two-round opportunities in this fixed grid, small at 10k and negative at 25k. See the [release-candidate report](benchmark/release-candidate-results/REPORT.md), [raw data](benchmark/release-candidate-results/raw.json) and [environment freeze](benchmark/release-candidate-results/environment.json).

The earlier safety-hardened clean-core validation remains immutable at **18.86% less gas** canonically. It is historical evidence, not the delivered headline.

### Historical frozen v0 benchmark

```bash
cd benchmark/arbfold-foundry
forge test --offline -q
```

The frozen specification hash is:

```text
8f6dc062d3897693eed8fa5af9cf5d6b6ce62f7c32af07719cf5d588e203aaf0
```

The raw measurement hash is:

```text
81e9ee474809b9a9e2852e4573383dea9ccc8d40092ceab81cb91d3f550cb00e
```

| Origin input | Atomic backrun | ARBFOLD direct | Reduction |
|---:|---:|---:|---:|
| 10k | 387,527 | 273,244 | 29.50% |
| 25k | 389,233 | 274,950 | 29.37% |
| 50k | 519,042 | 313,610 | 39.58% |
| **100k** | **519,042** | **313,610** | **39.58%** |
| 200k | 519,031 | 313,599 | 39.58% |

The 39.58% result belongs to the smaller frozen harness—not to the safety-hardened published router. It remains immutable for research traceability and is not the headline measurement of the delivered core.

## Research integrity

ARBFOLD was originally subjected to a harder economic authorization gate. The mechanics and gas gates passed, but the preregistered requirement of **10% greater LP net value** failed: the measured improvement was only **0.000287%** under the frozen gas-price assumption.

That decision remains preserved in the [frozen v0 report](benchmark/arbfold-results/REPORT.md). The [earlier clean-core report](benchmark/clean-core-results/REPORT.md) records 18.86%; the [release report](benchmark/release-candidate-results/REPORT.md) records the delivered source's 19.12% canonical reduction and 25k regression:

```text
Economic-superiority thesis   KILLED
Production deployment         NOT AUTHORIZED
Research-grade UHI10 build    IMPLEMENTED
```

The project therefore claims an **execution primitive**, not universal economic superiority.

## Exact integration map

| Integration | Exact location | What it does |
|---|---|---|
| Uniswap v4 `PoolManager` | [`ArbFoldRouter.unlockCallback`](contracts/src/ArbFoldRouter.sol#L93) | Executes and atomically settles the originating swap. |
| Uniswap v4 ERC-6909 claims | [`ArbFoldCoordinator._applyDirect`](contracts/src/ArbFoldCoordinator.sol#L144) | Transfers backed reserves directly among participating hooks. |
| OpenZeppelin `BaseCustomCurve` | [`ArbFoldHook._beforeSwap`](contracts/src/ArbFoldHook.sol#L72) | Implements hook-owned constant-product liquidity and return-delta swaps. |
| v4 `HookMiner` | [`ArbFoldTestBase._mineAndDeploy`](contracts/test/ArbFoldTestBase.sol#L75) and [`DeployArbFold._mineAndDeploy`](contracts/script/DeployArbFold.s.sol#L185) | Mines and deploys addresses with the exact hook permission bits. |

The only Hookathon partner integration claimed is **Unichain**: ARBFOLD has a
public research deployment on Unichain Sepolia using the official v4
`PoolManager`. No Chainlink, Reactive Network or other sponsor integration is
claimed.

## Repository map

| Path | Purpose |
|---|---|
| [`contracts/src/`](contracts/src/) | Clean ARBFOLD hook, coordinator, router and cycle math. |
| [`contracts/test/`](contracts/test/) | Unit, fuzz, invariant, deployment and gas tests. |
| [`contracts/script/`](contracts/script/) | Reproducible full demo deployment. |
| [`app/src/`](app/src/) | React + TypeScript UI, live RPC verification, wallet execution and benchmark demo. |
| [`benchmark/arbfold-foundry/`](benchmark/arbfold-foundry/) | Frozen end-to-end comparison harness. |
| [`benchmark/arbfold-results/`](benchmark/arbfold-results/) | Immutable raw results and the failed economic gate. |
| [`benchmark/clean-core-results/`](benchmark/clean-core-results/) | Immutable earlier clean-core validation. |
| [`benchmark/release-candidate-results/`](benchmark/release-candidate-results/) | Delivered-source report, raw grid, environment and source manifest. |
| [`docs/`](docs/) | Architecture, limits, judge guide and demo script. |
| [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md) | Official-manager resolution, deployment, demo, verification and manifest finalization. |
| [`docs/NEXT_ITERATION_PLAN.md`](docs/NEXT_ITERATION_PLAN.md) | Archived execution plan; current evidence lives in the release evidence and final-submission copy. |
| [`docs/FINAL_SUBMISSION.md`](docs/FINAL_SUBMISSION.md) | Copy-ready final form answers, public proof links and claim boundaries. |
| [`docs/VIDEO_RECORDING_RUNBOOK.md`](docs/VIDEO_RECORDING_RUNBOOK.md) | Four-minute recording sequence, preflight and publication gate. |
| [`docs/LIVE_DEMO_GUIDE.md`](docs/LIVE_DEMO_GUIDE.md) | Exact no-wallet and signed testnet walkthrough. |
| [`assets/arbfold-demo-en.srt`](assets/arbfold-demo-en.srt) | Retimable English subtitle template for the human-narrated demo. |
| [`assets/arbfold-uhi10-thumbnail.png`](assets/arbfold-uhi10-thumbnail.png) | Final submission thumbnail. |
| [`Makefile`](Makefile) | One-command test, formatting, lint, snapshot and dashboard entry points. |

## Deploy the demo network

The tested local path deploys a fresh PoolManager, three demo ERC-20s, three mined hooks, the coordinator, seeded liquidity and the router; then it executes a canonical swap, finalizes a machine-readable manifest and runs the read-only verifier:

```bash
make test-deployment
```

For the research-only Unichain Sepolia path, follow the fail-closed [deployment runbook](docs/DEPLOYMENT_RUNBOOK.md). It resolves the current official v4 PoolManager from Uniswap's deployment feed instead of embedding a potentially stale address. Never place a testnet key or RPC credential in the repository.

The canonical public deployment is recorded in [`deployments/unichain-sepolia-1301.json`](deployments/unichain-sepolia-1301.json). Its source commit is `1c7d7edff2c52fea060beee3e3791a086bcdc044`; explorer source verification is explicitly reported as `not-available`, so the repository, manifest and onchain state remain the reproducible evidence.

## Explicit limitations

- This is not an implementation of the paper’s global convex optimizer; it is a specialized three-CPMM construction.
- It requires new hook-owned custom-curve pools and does not attach to existing v4 pools.
- OpenZeppelin’s custom-accounting bases are experimental.
- It assumes standard 18-decimal ERC-20 behavior in the benchmark.
- It does not solve block-ordering priority against a competing searcher.
- Return-delta hooks require special routing support and careful reserve/claim accounting.
- Contracts are not audited and are not authorized for production deposits.

See [Limitations](docs/LIMITATIONS.md) and the [threat model](docs/THREAT_MODEL.md).

## Credits

ARBFOLD is inspired by Sam Devorsetz and Maurice Herlihy’s 2026 paper, [*Defensive Rebalancing for Automated Market Makers*](https://arxiv.org/abs/2601.19950). The general paper is broader than this implementation.

The core uses [Uniswap v4](https://github.com/Uniswap/v4-core) and [OpenZeppelin Uniswap Hooks](https://github.com/OpenZeppelin/uniswap-hooks). Closest execution comparator: [MEV-X Homelander](https://github.com/mev-x-project/MEV-X-Homelander).

## Judge path

If you have five minutes, follow [`docs/JUDGE_GUIDE.md`](docs/JUDGE_GUIDE.md). It starts with the delivered core's 19.12% canonical result, points to the exact v4 code and shows both the 25k regression and rejected economic claim.
