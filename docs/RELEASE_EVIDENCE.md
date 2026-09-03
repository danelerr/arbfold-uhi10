# ARBFOLD Release Evidence

This is the judge-facing index for the final UHI10 v0.1 release. A pending
human-provided artifact is marked pending rather than inferred or fabricated.

## Identity

| Field | Evidence |
|---|---|
| UHI project ID | `HK-UHI10-1057` |
| Registered name | MATURE |
| Submitted project | ARBFOLD |
| v0.1 deployment source | [`6670e626a836db82a2810497812009c1394b0b20`](https://github.com/danelerr/arbfold-uhi10/commit/6670e626a836db82a2810497812009c1394b0b20) |
| Historical v0 source commit | [`9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b`](https://github.com/danelerr/arbfold-uhi10/commit/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b) |
| Testnet deployment | v0.1 manifest binds the source commit, addresses, 28 deployment transactions and canonical demo transaction |
| Complete submission release | [`uhi10-submission`](https://github.com/danelerr/arbfold-uhi10/tree/uhi10-submission) — one tag for contracts, benchmark, UI and verification tooling |
| Historical pre-submission release | [`uhi10-final`](https://github.com/danelerr/arbfold-uhi10/releases/tag/uhi10-final), source commit [`2abc236665ee8a3de314de70e700497760a841bc`](https://github.com/danelerr/arbfold-uhi10/commit/2abc236665ee8a3de314de70e700497760a841bc) |

## Commit-pinned judge links

- [Hook callback](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/contracts/src/ArbFoldHook.sol#L72)
- [Coordinator direct transition](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/contracts/src/ArbFoldCoordinator.sol#L144)
- [Router unlock settlement](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/contracts/src/ArbFoldRouter.sol#L93)
- [Six-path invariant handler](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/contracts/test/ArbFoldInvariant.t.sol#L17)
- [Deployment script](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/contracts/script/DeployArbFold.s.sol)
- [Post-deployment verifier](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/contracts/script/VerifyArbFoldDeployment.s.sol)
- [Clean-core comparison](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/contracts/test/ArbFoldCleanCoreBenchmark.t.sol)
- [Threat model](https://github.com/danelerr/arbfold-uhi10/blob/uhi10-submission/docs/THREAT_MODEL.md)
- [Public v0.1 deployment manifest](../deployments/unichain-sepolia-1301-v0.1.json)
- [Canonical v0.1 transaction](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022)

## v0.1 measured result

| Workload | Iterative reference | ARBFOLD v0.1 | Exact change |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.55% less |
| 25k | 409,402 | 329,777 | **19.45% less** |
| 50k | 544,219 | 375,171 | 31.06% less |
| **100k** | **544,219** | **375,171** | **31.06% less** |
| 200k | 544,209 | 375,160 | 31.06% less |

- [v0.1 report](../benchmark/optimized-release-candidate-results/REPORT.md)
- [v0.1 raw result](../benchmark/optimized-release-candidate-results/raw.json)
- [v0.1 environment](../benchmark/optimized-release-candidate-results/environment.json)
- [v0.1 source manifest](../benchmark/optimized-release-candidate-results/source-manifest.sha256)

At the canonical workload the iterative reference performs two cyclic rounds:
six swaps and two profit reinjections. One `fold()` call applies two
runtime-checked direct settlement rounds. The measured user output and fixed
external-recipient reward match, and all six final reserves are equivalent
within the measured tolerance.

Steady-state telemetry gas has not been measured with a cross-transaction
harness and is not claimed in this release. The release reports only the valid
first-call grid above.

## Mechanical and security evidence

| Gate | Result | Evidence |
|---|---|---|
| Solidity suite | 82 tests pass in default and release profiles | `forge test --offline`; `FOUNDRY_PROFILE=release forge test --offline` |
| Release fuzz | 10,000 stateless cases per fuzz property | `make test-release-fuzz` |
| Stateful invariants | 8 properties × 20,480 calls; six paths; zero unexpected reverts | [`ArbFoldInvariant.t.sol`](../contracts/test/ArbFoldInvariant.t.sol) |
| Negative paths | 30 explicit tests | [`ArbFoldNegativePaths.t.sol`](../contracts/test/ArbFoldNegativePaths.t.sol) |
| Arithmetic | 50,000 Foundry cases + 50,000 arbitrary-precision differential cases, seed `1057` | [Arithmetic specification](ARITHMETIC_SPEC.md) |
| v0.1 coverage | 98.61% lines; 91.07% branches; 100% functions | [Coverage report](evidence/COVERAGE.md) |
| Slither 0.11.3 | 0 unreviewed High/Medium findings | [Static-analysis review](evidence/STATIC_ANALYSIS.md) |
| Deployment path | Local deploy, canonical swap and read-only verifier pass | `make test-deployment` |
| Published source | 8/8 active ARBFOLD contracts have matching creation and runtime source | `npm run check:sources`; [Sourcify coordinator record](https://repo.sourcify.dev/1301/0x59e52300560ceDb4FC452e6D629c852a9C6fae30) |
| Complete gate | Fail-closed verification command | `make verify-release` |

The historical `uhi10-final` source passed the public verification workflow,
including the generated `lcov.info` and complete Slither JSON artifact:

- [Final-tag verification run 33341073908](https://github.com/danelerr/arbfold-uhi10/actions/runs/33341073908)

## Public evidence — v0.1 deployment

| Artifact | Status |
|---|---|
| Dashboard | [danelerr.github.io/arbfold-uhi10](https://danelerr.github.io/arbfold-uhi10/) |
| Network | Unichain Sepolia, chain ID 1301 — live research deployment |
| PoolManager | Official v4 manager `0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95` |
| Deployment manifest | [`deployments/unichain-sepolia-1301-v0.1.json`](../deployments/unichain-sepolia-1301-v0.1.json) — 28 successful deployment receipts |
| Canonical transaction | [`0x3429…2022`](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022) — 100,000 ARFY→ARFX; two rounds; zero residual |
| Runtime bytecode | Sizes and onchain `keccak256` values for the official PoolManager, coordinator, three hooks, router and three test tokens are recorded in the v0.1 manifest |
| Explorer links | Manager, coordinator, router, three hooks and canonical transaction are encoded in the manifest |
| Source verification | `verified`; Sourcify reports creation and runtime matches for coordinator, three hooks, router and three test tokens |
| Video | [Public 4:45 explainer](https://www.youtube.com/watch?v=8nYDFoqaQ7I) — Daniel's human narration |
| Final submission timestamp | Pending; Daniel submits manually |

The current public deployment is v0.1. The dashboard fails closed unless the
committed v0.1 manifest passes its schema gate and live RPC checks confirm chain
ID, exact deployed-bytecode identities, manager/token/hook bindings, decoded
canonical receipt semantics, historical pre/post snapshots, current counters
and reserves. It does not substitute local values for public evidence.
It also exposes a wallet-free end-to-end `eth_call` and an optional signed
testnet execution path. `npm run check:live` verifies the same public dry-run
prerequisites from the command line. `npm run check:sources` independently
queries Sourcify for all eight active project contracts and requires complete
creation and runtime matches. The transient
[`HookDeployer`](https://repo.sourcify.dev/1301/0xdc7798B015FAA585bef6462828b374079C4e8a22)
also source-matches; it is not one of the eight active runtime roles.

`make submission-preflight` additionally binds the public dashboard bundle,
manifest, served lossless benchmark, repository copy, Project ID, five-point
benchmark and final-form claims into one
fail-closed release check. The public video is linked from the final submission;
its duration, accessibility and human narration remain human-reviewed evidence.

On 2026-08-30, the resolver returned
`0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`; bytecode and chain ID 1301 were
confirmed immediately before broadcast. Twenty-eight deployment transactions,
the three-transaction canonical demo flow and one bounded RPC-simulation
allowance finalized with status `1`; the post-demo verifier
then proved manager/coordinator bindings, six reserve-to-claim equalities on
those external-recipient paths, underlying token backing, positive reserves
and a zero canonical residual.

## Preserved research record

- [Rejected economic-superiority result](../benchmark/arbfold-results/REPORT.md)
- [Historical minimal-harness 39.58% result](../benchmark/arbfold-results/REPORT.md)
- [Earlier clean-core 18.86% result](../benchmark/clean-core-results/REPORT.md)
- [Historical v0 release 19.12% result and 25k regression](../benchmark/release-candidate-results/REPORT.md)
- [Optimized v0.1 result](../benchmark/optimized-release-candidate-results/REPORT.md)
- [v0.1 reassessment](../research/results/arbfold-v0.1-reassessment-2026-08-30.json)

## Known limits

ARBFOLD is a specialized three-CPMM research primitive. It requires new
hook-owned custom-curve pools, does not implement the paper's global optimizer,
does not solve transaction ordering, and is neither audited nor authorized for
production or mainnet deposits. See [Limitations](LIMITATIONS.md) and the
[threat model](THREAT_MODEL.md).
