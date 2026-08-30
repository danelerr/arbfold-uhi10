# ARBFOLD — Direct State Settlement for Cyclic Arbitrage

[![ARBFOLD verification](https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml/badge.svg)](https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml)
[![Interactive demo](https://img.shields.io/badge/interactive-demo-c9ff5b?style=flat&labelColor=111319)](https://danelerr.github.io/arbfold-uhi10/)

### Don’t replay every leg. Settle the equivalent state.

ARBFOLD is a Uniswap v4 custom-accounting experiment for a fixed network of
three cooperating CPMM pools. When cyclic arbitrage requires multiple rounds,
one `fold()` call can apply the equivalent runtime-checked direct settlement
rounds without replaying every arbitrage swap and profit reinjection.

> **Same user output. Same fixed external-recipient reward. Equivalent final reserves within measured tolerance. 31.06% less gas at the canonical 100k v0.1 benchmark.**

[Open the demo](https://danelerr.github.io/arbfold-uhi10/) ·
[View the canonical transaction](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022) ·
[Read the judge guide](docs/JUDGE_GUIDE.md)

## What changes

At the canonical 100k workload, both paths start from the same snapshot and
reach the equivalent measured destination:

```text
Iterative reference                  ARBFOLD v0.1

Round 1: 3 swaps + reinjection       Direct settlement round 1
Round 2: 3 swaps + reinjection       Direct settlement round 2
                                      ─────────────────────────
6 swaps + 2 reinjections             1 fold() call, 2 rounds
```

The comparison keeps the user output and fixed external-recipient reward
equal. It checks conservation and non-decreasing pool invariants during every
direct round, then compares the cached result with a fresh onchain state read.

ARBFOLD is not a universal arbitrage detector or a claim that all MEV is
captured. It studies whether cooperating v4 pools can settle a known cyclic
state transition with less execution.

## Current v0.1 result

| Origin input | Iterative reference | ARBFOLD v0.1 | Exact change |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.55% less |
| 25k | 409,402 | 329,777 | 19.45% less |
| 50k | 544,219 | 375,171 | 31.06% less |
| **100k** | **544,219** | **375,171** | **31.06% less** |
| 200k | 544,209 | 375,160 | 31.06% less |

The boundary is explicit:

- **1k–4k:** zero fold rounds; invoking ARBFOLD costs more than the reference.
- **5k–200k:** all **196 actionable** points were cheaper in the tested canonical path.
- Steady-state telemetry gas has not been measured with a cross-transaction harness and is not claimed in this release.

The authoritative package is
[`benchmark/optimized-release-candidate-results/`](benchmark/optimized-release-candidate-results/).
It contains the raw v4 evidence, environment, Forge output, compiler matrix,
dense sweep, six-path matrix and source manifest. See the
[benchmark index](benchmark/README.md) for the separation between current and
historical results.

## Try ARBFOLD

The public page deliberately separates two different purposes:

### Controlled Foundry benchmark

This is the scientific comparison. The iterative reference and ARBFOLD start
from identical snapshots, use the same user output and reward, and record the
complete before/after state. Use **Replay demo** to see both paths.

### Live Swap Lab

This is the executable testnet experience. It introduces three valueless test
tokens—ARFX, ARFY and ARFZ—and three Uniswap v4 pools:

```text
ARFX / ARFY
ARFX / ARFZ
ARFY / ARFZ
```

The default route swaps `ARFY → ARFX`, checks the corresponding three-pool
cycle, and applies any profitable direct settlement rounds in the same
transaction. The confirmed receipt is the authority for output, rounds,
fixed execution reward, residual arbitrage and gas.

The public testnet is mutable. Live transactions are exploratory and are not
used as an apples-to-apples gas benchmark.

## Public evidence

- **Network:** Unichain Sepolia, chain ID 1301.
- **PoolManager:** official Uniswap v4 deployment at [`0x00B036B58a818B1BC34d502D3fE730Db729e62AC`](https://sepolia.uniscan.xyz/address/0x00B036B58a818B1BC34d502D3fE730Db729e62AC).
- **Coordinator:** [`0x59e52300560ceDb4FC452e6D629c852a9C6fae30`](https://sepolia.uniscan.xyz/address/0x59e52300560ceDb4FC452e6D629c852a9C6fae30).
- **Router:** [`0xe817DFB3d1F7cd07f165cb5FDa83CD63179996aE`](https://sepolia.uniscan.xyz/address/0xe817DFB3d1F7cd07f165cb5FDa83CD63179996aE).
- **Canonical transaction:** [`0x3429…2022`](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022), one `fold()` call, two direct rounds, final residual zero.
- **Deployment manifest:** [`deployments/unichain-sepolia-1301-v0.1.json`](deployments/unichain-sepolia-1301-v0.1.json).

The original v0 deployment remains historical evidence. The dashboard,
README, video and submission use v0.1.

## How it works

```text
User exact-input swap
        ↓
PoolManager.swap
        ↓
ArbFoldHook books the user output
        ↓
ArbFoldCoordinator quotes the fixed three-pool cycle
        ↓
PoolManager-backed ERC-6909 claims move between hooks
        ↓
Runtime conservation and invariant checks
        ↓
Router settles every currency delta
```

The contracts use OpenZeppelin `BaseCustomCurve`, real Uniswap v4 hook
permissions and hook-owned liquidity. Read the
[architecture](docs/ARCHITECTURE.md) and
[arithmetic specification](docs/ARITHMETIC_SPEC.md) for the exact state model.

## Verify it

Clone the pinned dependencies and run the fail-closed release gate:

```bash
git clone --recurse-submodules https://github.com/danelerr/arbfold-uhi10.git
cd arbfold-uhi10
make verify-release
```

The release evidence covers:

- 82 Solidity tests, including all six pool/direction paths;
- 10,000-case release fuzzing and stateful invariants;
- 50,000-case differential arithmetic verification;
- exact PoolManager backing and zero persistent currency deltas;
- 98.61% project line coverage and 91.07% branch coverage;
- Slither with no unreviewed High or Medium findings;
- fail-closed benchmark, provenance, video-proof and submission preflight checks.

Focused commands:

```bash
npm ci
npm run test:dashboard
npm run build:dashboard
make video-proof
```

The release source is frozen at tag [`uhi10-final`](https://github.com/danelerr/arbfold-uhi10/releases/tag/uhi10-final).
The UHI10 project ID is `HK-UHI10-1057`.

## Evidence and documentation

Start with the [documentation index](docs/README.md). The shortest judge path is:

1. [Judge Guide](docs/JUDGE_GUIDE.md)
2. [Release Evidence](docs/RELEASE_EVIDENCE.md)
3. [Live Demo Guide](docs/LIVE_DEMO_GUIDE.md)
4. [Threat Model](docs/THREAT_MODEL.md)
5. [Limitations](docs/LIMITATIONS.md)

All dated reviews, remediation reports, frozen decisions and rejected branches
remain in the repository for auditability. They are research history, not the
current evaluation path.

## Research integrity

The original hypothesis required at least 10% greater LP net value. It failed:
the measured uplift was only **0.000287%** under the frozen gas-price
assumption. That claim remains rejected.

What survived is narrower and measured: an execution-gas advantage in the
tested actionable workloads while preserving the paired user output, fixed
external-recipient reward and equivalent final reserves within tolerance.

Historical 39.58%, 18.86% and 19.12% results remain immutable in their original
benchmark packages, but they are not the v0.1 headline. The
[research index](research/README.md) explains the experiment history without
mixing it into the current release claim.

## Limits

- Fixed network of three CPMMs, not a global optimizer.
- New hook-owned pools; ARBFOLD cannot be attached to existing pools.
- Folding is opt-in through the routed call and hook data.
- No ordering guarantee against competing searchers.
- No material LP-net-value uplift demonstrated.
- OpenZeppelin custom-curve primitives remain experimental.
- Research deployment only; not audited or authorized for production funds.

## Credits

Inspired by *Defensive Rebalancing for Automated Market Makers*. Built for the
Uniswap Hook Incubator UHI10 theme **Sustainable Liquidity & MEV Protection**.

License: [MIT](LICENSE).
