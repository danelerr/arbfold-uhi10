# ARBFOLD

[![ARBFOLD verification](https://github.com/danelerr/mature-uhi10/actions/workflows/ci.yml/badge.svg)](https://github.com/danelerr/mature-uhi10/actions/workflows/ci.yml)

### Gas-efficient defensive rebalancing for Uniswap v4

> **Can cooperating AMM pools reach the same Pareto-safe post-arbitrage state more efficiently through direct reserve transitions?**

ARBFOLD is a research-grade Uniswap v4 custom-accounting experiment. Three hook-owned CPMMs—A/B, B/C and A/C—can fold a cyclic arbitrage opportunity directly into their PoolManager-backed ERC-6909 reserves inside the transaction that created it.

The user receives the same output. The solver receives the same capped reward. Every participating invariant must remain non-decreasing. The difference is execution: the safety-hardened code published under `contracts/src` measured **436,430 gas for ARBFOLD versus 537,896 gas for a three-leg atomic backrun plus profit reinjection**, an **18.86% reduction** at the canonical size.

## See it in 30 seconds

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/app/](http://localhost:8080/app/). The dashboard is dependency-free and uses the five publication measurements from [`raw_v1.json`](benchmark/clean-core-results/raw_v1.json).

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
git clone --recurse-submodules https://github.com/danelerr/mature-uhi10.git
cd mature-uhi10
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
- 512-case fuzzing and 4,096 calls per stateful invariant property.

### Published clean-core comparison

```bash
cd contracts
forge test --offline --match-contract ArbFoldCleanCoreBenchmarkTest -vv
```

Both paths start from the same deployed state snapshot. The direct path uses the published hook, coordinator and router; the reference executes three real `PoolManager.swap` calls and reinjects the same retained profit.

| Origin input | Atomic backrun | Published ARBFOLD | Exact change |
|---:|---:|---:|---:|
| 10k | 403,614 | 386,610 | 4.21% less |
| 25k | 405,309 | 409,899 | **1.13% more** |
| 50k | 537,895 | 436,429 | 18.86% less |
| **100k** | **537,896** | **436,430** | **18.86% less** |
| 200k | 537,886 | 436,419 | 18.86% less |

The advantage is workload-dependent. It is material for the two-round opportunities in this fixed grid, small at 10k and negative at 25k. See the [clean-core report](benchmark/clean-core-results/REPORT.md).

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

That decision remains preserved in the [frozen v0 report](benchmark/arbfold-results/REPORT.md), while the separate [clean-core report](benchmark/clean-core-results/REPORT.md) records the delivered code's lower 18.86% canonical reduction and its 25k regression:

```text
Economic-superiority thesis   KILLED
Production deployment         NOT AUTHORIZED
Research-grade UHI10 build    IMPLEMENTED
```

The project therefore claims an **execution primitive**, not universal economic superiority.

## Exact integration map

| Integration | Exact location | What it does |
|---|---|---|
| Uniswap v4 `PoolManager` | [`ArbFoldRouter.unlockCallback`](contracts/src/ArbFoldRouter.sol#L81) | Executes and atomically settles the originating swap. |
| Uniswap v4 ERC-6909 claims | [`ArbFoldCoordinator._applyDirect`](contracts/src/ArbFoldCoordinator.sol#L144) | Transfers backed reserves directly among participating hooks. |
| OpenZeppelin `BaseCustomCurve` | [`ArbFoldHook._beforeSwap`](contracts/src/ArbFoldHook.sol#L66) | Implements hook-owned constant-product liquidity and return-delta swaps. |
| v4 `HookMiner` | [`ArbFoldTestBase._mineAndDeploy`](contracts/test/ArbFoldTestBase.sol#L75) and [`DeployArbFold._mineAndDeploy`](contracts/script/DeployArbFold.s.sol#L110) | Mines and deploys addresses with the exact hook permission bits. |

No Chainlink, Reactive Network or other sponsor integration is claimed.

## Repository map

| Path | Purpose |
|---|---|
| [`contracts/src/`](contracts/src/) | Clean ARBFOLD hook, coordinator, router and cycle math. |
| [`contracts/test/`](contracts/test/) | Unit, fuzz, invariant, deployment and gas tests. |
| [`contracts/script/`](contracts/script/) | Reproducible full demo deployment. |
| [`app/`](app/) | One-screen benchmark dashboard. |
| [`benchmark/arbfold-foundry/`](benchmark/arbfold-foundry/) | Frozen end-to-end comparison harness. |
| [`benchmark/arbfold-results/`](benchmark/arbfold-results/) | Immutable raw results and the failed economic gate. |
| [`benchmark/clean-core-results/`](benchmark/clean-core-results/) | Publication validation against the safety-hardened delivered code. |
| [`docs/`](docs/) | Architecture, limits, judge guide and demo script. |
| [`Makefile`](Makefile) | One-command test, formatting, lint, snapshot and dashboard entry points. |

## Deploy the demo network

The script deploys a fresh PoolManager, three demo ERC-20s, three mined hooks, the coordinator, seeded liquidity and the router. It is for a local chain or testnet demonstration—not mainnet.

```bash
cd contracts
export PRIVATE_KEY=<testnet-key>
forge script script/DeployArbFold.s.sol:DeployArbFold \
  --rpc-url <rpc-url> \
  --broadcast
```

## Explicit limitations

- This is not an implementation of the paper’s global convex optimizer; it is a specialized three-CPMM construction.
- It requires new hook-owned custom-curve pools and does not attach to existing v4 pools.
- OpenZeppelin’s custom-accounting bases are experimental.
- It assumes standard 18-decimal ERC-20 behavior in the benchmark.
- It does not solve block-ordering priority against a competing searcher.
- Return-delta hooks require special routing support and careful reserve/claim accounting.
- Contracts are not audited and are not authorized for production deposits.

See [Limitations](docs/LIMITATIONS.md) and the [threat model](mature-uhi10-threat-model.md).

## Credits

ARBFOLD is inspired by Sam Devorsetz and Maurice Herlihy’s 2026 paper, [*Defensive Rebalancing for Automated Market Makers*](https://arxiv.org/abs/2601.19950). The general paper is broader than this implementation.

The core uses [Uniswap v4](https://github.com/Uniswap/v4-core) and [OpenZeppelin Uniswap Hooks](https://github.com/OpenZeppelin/uniswap-hooks). Closest execution comparator: [MEV-X Homelander](https://github.com/mev-x-project/MEV-X-Homelander).

## Judge path

If you have five minutes, follow [`docs/JUDGE_GUIDE.md`](docs/JUDGE_GUIDE.md). It starts with the delivered core's 18.86% canonical result, points to the exact v4 code and shows both the 25k regression and rejected economic claim.
