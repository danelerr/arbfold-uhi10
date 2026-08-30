# ARBFOLD — Direct State Settlement for Cyclic Arbitrage

[![ARBFOLD verification](https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml/badge.svg)](https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml)
[![Interactive demo](https://img.shields.io/badge/interactive-demo-c9ff5b?style=flat&labelColor=111319)](https://danelerr.github.io/arbfold-uhi10/)

### Don’t replay every leg. Settle the equivalent state.

> **Why replay each cyclic-arbitrage leg when cooperating pools can runtime-check and settle the equivalent state directly?**

ARBFOLD is a research-grade Uniswap v4 custom-accounting experiment. After a
user swap creates an actionable cycle across three new hook-owned pools, one
`fold()` call can process multiple runtime-checked direct settlement rounds
inside the originating transaction.

> **Same user output. Same fixed external-recipient reward. Equivalent final reserves within measured tolerance. 31.06% less gas at the canonical 100k v0.1 benchmark.**

The v0.1 code under `contracts/src` measured **375,171 total gas for ARBFOLD
versus 544,219 for the iterative reference** at 100k. The reference executes
two cyclic rounds—six arbitrage swaps and two profit reinjections—while one
ARBFOLD call applies two direct settlement rounds. Every round retains the
conservation and non-decreasing-invariant checks, and the final cached state is
compared exactly with a fresh onchain read.

**The claim remains bounded:** v0.1 has an execution-gas advantage at all five
frozen actionable workloads and all 196 actionable points in the 1k–200k dense
sweep. Calls from 1k–4k execute zero rounds and remain more expensive than the
reference, so folding should be selected only when an opportunity is actionable.

Steady-state telemetry gas has not been measured with a cross-transaction
harness and is not claimed in this release. That measurement remains future
work using two real transactions or equivalent pre-transaction state.

## See it run in 30 seconds

[Open the ARBFOLD interactive benchmark](https://danelerr.github.io/arbfold-uhi10/).

The page opens directly on the experiment—there is no marketing flow to finish
before the demo:

1. **Replay the comparison:** click `Replay demo` to see the iterative backrun and ARBFOLD direct settlement run side by side. The comparison loads from the versioned v0.1 Foundry evidence while the public v0.1 deployment is checked independently in parallel.
2. **Execute it yourself:** click `Open Swap Lab`. Before connecting, the lab identifies ARFX, ARFY and ARFZ as valueless test assets, shows the three pools and explains the cycle checked after the swap. One contextual action then connects the wallet, switches network if needed, mints only a token deficit, approves only the selected amount and submits one atomic `ARFY → ARFX swap + fold`.
3. **Inspect the confirmed result:** the transaction receipt—not a later RPC refresh—drives the displayed output, fold rounds, fixed external-recipient reward, residual arbitrage and gas. The default 10,000 ARFY route follows the same internal B→A path used by the canonical benchmark and deployment transaction, while zero-fold receipts remain valid results on mutable public testnet state.

The visual comparison remains usable if the public RPC is slow or unavailable.
The testnet controls still fail closed: they only enable after checking chain
ID 1301, both public receipts, deployed bytecode, coordinator token/hook roles,
onchain token symbols and the current three-pool state. The Foundry
comparison comes from [`raw.json`](benchmark/optimized-release-candidate-results/raw.json)
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

**Judge proof:** [public v0.1 canonical transaction](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022) · [v0.1 deployment manifest](deployments/unichain-sepolia-1301-v0.1.json) · [hook](contracts/src/ArbFoldHook.sol) · [coordinator](contracts/src/ArbFoldCoordinator.sol) · [router](contracts/src/ArbFoldRouter.sol) · [six-path invariants](contracts/test/ArbFoldInvariant.t.sol) · [release evidence](docs/RELEASE_EVIDENCE.md). Run the complete fail-closed gate with `make verify-release`.

**Public-chain status:** **v0.1** is live on Unichain Sepolia (chain 1301)
using the official v4 `PoolManager`. Its canonical two-round transaction is
[`0x3429…2022`](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022).
ARFX, ARFY and ARFZ are freely mintable test assets with no value. The original
v0 deployment remains only as historical research evidence; the dashboard,
README, video and submission use v0.1 exclusively.

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
- ERC-6909 claims equal to all six virtual reserves along the tested
  external-reward-address paths;
- exact underlying token backing;
- per-transition conservation;
- invariant monotonicity;
- bounded residual arbitrage;
- unauthorized coordinator calls;
- atomic slippage reverts;
- all six origin/direction paths;
- 10,000-case release fuzzing and the configured stateful invariant depth without reductions;
- 50,000-case arithmetic differential/fuzz verification;
- 98.61% project line coverage and 91.07% branch coverage;
- a pinned Slither gate with zero unreviewed High/Medium findings.

### Optimized v0.1 release-candidate comparison

```bash
cd contracts
forge test --offline --match-contract ArbFoldCleanCoreBenchmarkTest -vv
```

Both paths start from the same deployed state snapshot. The direct path uses
the published hook, coordinator and router; in each round the reference
executes three real `PoolManager.swap` calls and reinjects the same retained
profit.

The generator records the base commit, dirty-state declaration, exact source
and test hashes, compiler settings, raw Forge output and reproduction commands.
Both paths use identical snapshots and compiler settings.

| Origin input | Iterative reference | ARBFOLD v0.1 | Exact change |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.55% less |
| 25k | 409,402 | 329,777 | **19.45% less** |
| 50k | 544,219 | 375,171 | 31.06% less |
| **100k** | **544,219** | **375,171** | **31.06% less** |
| 200k | 544,209 | 375,160 | 31.06% less |

See the [v0.1 report](benchmark/optimized-release-candidate-results/REPORT.md),
[raw data](benchmark/optimized-release-candidate-results/raw.json),
[environment](benchmark/optimized-release-candidate-results/environment.json)
and [source manifest](benchmark/optimized-release-candidate-results/source-manifest.sha256).
The dense sweep finds zero-round regressions at 1k–4k, then an execution-gas
advantage at every actionable point from 5k–200k in the tested canonical path.

### Historical v0 release candidate

The immutable v0 release grid remains below. It is not overwritten by v0.1:

| Origin input | Atomic backrun | ARBFOLD v0 | Exact change |
|---:|---:|---:|---:|
| 10k | 407,272 | 389,292 | 4.41% less |
| 25k | 409,381 | 413,409 | **0.98% more** |
| 50k | 544,186 | 440,127 | 19.12% less |
| **100k** | **544,187** | **440,128** | **19.12% less** |
| 200k | 544,177 | 440,117 | 19.12% less |

See the [historical v0 report](benchmark/release-candidate-results/REPORT.md).

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

That decision remains preserved in the [frozen v0 report](benchmark/arbfold-results/REPORT.md). The [earlier clean-core report](benchmark/clean-core-results/REPORT.md) records 18.86%; the [v0 release report](benchmark/release-candidate-results/REPORT.md) records 19.12% canonically and the 25k regression; the [v0.1 report](benchmark/optimized-release-candidate-results/REPORT.md) records the optimization without rewriting those histories:

```text
Economic-superiority thesis   KILLED
Production deployment         NOT AUTHORIZED
Research-grade UHI10 build    IMPLEMENTED
```

The project therefore claims an **execution primitive**, not universal economic superiority.

The 2026-08-29 [historical thesis reassessment](docs/THESIS_REASSESSMENT_2026-08-29.md)
records the v0 reward-recipient aliasing case. v0.1 rejects the zero address,
the coordinator, PoolManager and all three registered hooks, and its tests
require the complete transaction to revert atomically for every forbidden
alias. This hardening does not make the contracts production-ready.

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
| [`benchmark/optimized-release-candidate-results/`](benchmark/optimized-release-candidate-results/) | New v0.1 report, raw grid, dense sweep, compiler matrix, environment and source manifest. |
| [`docs/`](docs/) | Architecture, limits, judge guide and demo script. |
| [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md) | Official-manager resolution, deployment, demo, verification and manifest finalization. |
| [`docs/NEXT_ITERATION_PLAN.md`](docs/NEXT_ITERATION_PLAN.md) | Archived execution plan; current evidence lives in the release evidence and final-submission copy. |
| [`docs/FINAL_SUBMISSION.md`](docs/FINAL_SUBMISSION.md) | Copy-ready final form answers, public proof links and claim boundaries. |
| [`docs/PROGRESS_UPDATE_2.md`](docs/PROGRESS_UPDATE_2.md) | Copy-ready second progress update bound to the public v0.1 release. |
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

The public v0.1 deployment is recorded in
[`deployments/unichain-sepolia-1301-v0.1.json`](deployments/unichain-sepolia-1301-v0.1.json).
The immutable v0 manifest remains in
[`deployments/unichain-sepolia-1301.json`](deployments/unichain-sepolia-1301.json)
only as research history; it is not a primary demo or submission link.

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

If you have five minutes, follow [`docs/JUDGE_GUIDE.md`](docs/JUDGE_GUIDE.md).
It starts with the v0.1 measured result, distinguishes the controlled benchmark
from the exploratory v0.1 live demo, and keeps the rejected economic claim visible.
