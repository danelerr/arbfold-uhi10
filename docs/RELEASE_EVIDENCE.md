# ARBFOLD Release Evidence

This is the judge-facing index for the UHI10 release candidate. A pending
external artifact is marked pending rather than inferred or fabricated.

## Identity

| Field | Evidence |
|---|---|
| UHI project ID | `HK-UHI10-1057` |
| Registered name | MATURE |
| Submitted project | ARBFOLD |
| Delivered source commit | [`9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b`](https://github.com/danelerr/arbfold-uhi10/commit/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b) |
| Testnet deployment source | [`1c7d7edff2c52fea060beee3e3791a086bcdc044`](https://github.com/danelerr/arbfold-uhi10/commit/1c7d7edff2c52fea060beee3e3791a086bcdc044) |
| Final release tag | Pending final review |

## Commit-pinned judge links

- [Hook callback](https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldHook.sol#L72)
- [Coordinator direct transition](https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldCoordinator.sol#L144)
- [Router unlock settlement](https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldRouter.sol#L93)
- [Six-path invariant handler](https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/test/ArbFoldInvariant.t.sol#L17)
- [Deployment script](https://github.com/danelerr/arbfold-uhi10/blob/67ca1283b236e03775005b0ba3bf7451fec1ad34/contracts/script/DeployArbFold.s.sol)
- [Post-deployment verifier](https://github.com/danelerr/arbfold-uhi10/blob/67ca1283b236e03775005b0ba3bf7451fec1ad34/contracts/script/VerifyArbFoldDeployment.s.sol)
- [Clean-core comparison](https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/test/ArbFoldCleanCoreBenchmark.t.sol)
- [Threat model](https://github.com/danelerr/arbfold-uhi10/blob/67ca1283b236e03775005b0ba3bf7451fec1ad34/docs/THREAT_MODEL.md)
- [Public Unichain Sepolia deployment manifest](../deployments/unichain-sepolia-1301.json)
- [Canonical public transaction](https://sepolia.uniscan.xyz/tx/0x6220b30fd09267c2d4f716ace816c4ebae4b9d5b9970cbe73cb3ccd665cfbf7c)
- [Independent interactive-path transaction](https://sepolia.uniscan.xyz/tx/0x78f32562596101d0ea3ca35dd3bf9c4fc0054bd788c2bfa1b96886c7bfce7927)

## Result

| Workload | Atomic backrun | ARBFOLD | Exact change |
|---:|---:|---:|---:|
| 10k | 407,272 | 389,292 | 4.41% less |
| 25k | 409,381 | 413,409 | **0.98% more** |
| 50k | 544,186 | 440,127 | 19.12% less |
| **100k** | **544,187** | **440,128** | **19.12% less** |
| 200k | 544,177 | 440,117 | 19.12% less |

- [Release-candidate report](../benchmark/release-candidate-results/REPORT.md)
- [Raw result](../benchmark/release-candidate-results/raw.json)
- [Environment freeze](../benchmark/release-candidate-results/environment.json)
- [Delivered-source manifest](../benchmark/release-candidate-results/source-manifest.sha256)
- Source tree SHA-256: `53db6012988f770c06f784b6f0ad152ac844ae1a0dc8058e1f1dfd002b85c3f3`

## Mechanical and security evidence

| Gate | Result | Evidence |
|---|---|---|
| Core test suites | 61/61 pass in default profile | `make test-core` |
| Release fuzz | 10,000 stateless cases per fuzz property | `make test-release-fuzz` |
| Stateful invariants | 8 properties × 20,480 calls; six paths; zero unexpected reverts | [`ArbFoldInvariant.t.sol`](../contracts/test/ArbFoldInvariant.t.sol) |
| Negative paths | 30 explicit tests | [`ArbFoldNegativePaths.t.sol`](../contracts/test/ArbFoldNegativePaths.t.sol) |
| Arithmetic | 50,000 Foundry cases + 50,000 arbitrary-precision differential cases, seed `1057` | [Arithmetic specification](ARITHMETIC_SPEC.md) |
| Coverage | 98.50% lines; 90.38% branches; 100% functions | [Coverage report](COVERAGE.md) |
| Slither 0.11.3 | 0 unreviewed High/Medium findings | [Static-analysis review](STATIC_ANALYSIS.md) |
| Deployment path | Local deploy, canonical swap and read-only verifier pass | `make test-deployment` |
| Complete gate | Fail-closed verification command | `make verify-release` |

The public release workflow passed all 23 steps for head `1c7d7ed`, including
the generated `lcov.info` and complete Slither JSON artifact:

- [Successful ARBFOLD verification run 32815343056](https://github.com/danelerr/arbfold-uhi10/actions/runs/32815343056)

## Public evidence

| Artifact | Status |
|---|---|
| Dashboard | [danelerr.github.io/arbfold-uhi10](https://danelerr.github.io/arbfold-uhi10/) |
| Network | Unichain Sepolia, chain ID 1301 — live research deployment |
| PoolManager | Official v4 manager `0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95` |
| Deployment manifest | [`deployments/unichain-sepolia-1301.json`](../deployments/unichain-sepolia-1301.json) — 28 successful deployment receipts |
| Canonical transaction | [`0x6220…bf7c`](https://sepolia.uniscan.xyz/tx/0x6220b30fd09267c2d4f716ace816c4ebae4b9d5b9970cbe73cb3ccd665cfbf7c) — final |
| Interactive-path validation | [`0x78f325…e7927`](https://sepolia.uniscan.xyz/tx/0x78f32562596101d0ea3ca35dd3bf9c4fc0054bd788c2bfa1b96886c7bfce7927) — 1,000 Demo B, one fold round, zero residual |
| Explorer links | Manager, coordinator, router, three hooks and canonical transaction are encoded in the manifest |
| Source verification | `not-available`; no explorer-verification claim is made |
| Video | Pending recording |
| Final submission timestamp | Pending; Daniel submits manually |

The dashboard fails closed unless the committed manifest passes its schema gate
and live RPC checks confirm chain ID, both receipts, deployed bytecode, current
counters and reserves. It does not substitute local values for public evidence.
It also exposes a wallet-free end-to-end `eth_call` and an optional signed
testnet execution path. `npm run check:live` verifies the same public dry-run
prerequisites from the command line.

On 2026-08-25, the resolver returned
`0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`; bytecode and chain ID 1301 were
confirmed immediately before broadcast. Twenty-eight deployment transactions
and three demo transactions finalized with status `1`; the post-demo verifier
then proved manager/coordinator bindings, six reserve-to-claim equalities,
underlying token backing, positive reserves and a zero canonical residual.

## Preserved research record

- [Rejected economic-superiority result](../benchmark/arbfold-results/REPORT.md)
- [Historical minimal-harness 39.58% result](../benchmark/arbfold-results/REPORT.md)
- [Earlier clean-core 18.86% result](../benchmark/clean-core-results/REPORT.md)
- [Current release 19.12% result](../benchmark/release-candidate-results/REPORT.md)

## Known limits

ARBFOLD is a specialized three-CPMM research primitive. It requires new
hook-owned custom-curve pools, does not implement the paper's global optimizer,
does not solve transaction ordering, and is neither audited nor authorized for
production or mainnet deposits. See [Limitations](LIMITATIONS.md) and the
[threat model](THREAT_MODEL.md).
