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
| Release evidence commit | Pending final evidence commit |
| Final release tag | Pending final review |

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

The CI artifact stores the generated `lcov.info` and complete Slither JSON.
The public CI URL will be pinned after this branch is pushed and the workflow
finishes successfully.

## Public evidence

| Artifact | Status |
|---|---|
| Dashboard | [danelerr.github.io/arbfold-uhi10](https://danelerr.github.io/arbfold-uhi10/) — update pending branch merge |
| Network | Unichain Sepolia, chain ID 1301 — deployment pending |
| PoolManager | Current official address resolved from Uniswap's unified feed; full non-broadcast deployment simulation passes; public broadcast pending |
| Deployment manifest | `deployments/unichain-sepolia-1301.json` — pending |
| Canonical transaction | Pending |
| Explorer links | Pending |
| Source verification | Pending |
| Video | Pending recording |
| Final submission timestamp | Pending; Daniel submits manually |

The dashboard deliberately remains in a visible “Public deployment pending”
state until the committed manifest exists and passes its client-side schema
gate. It does not substitute local values for public evidence.

On 2026-08-24, the resolver returned
`0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`; bytecode and chain ID 1301 were
confirmed, and the complete deployment script simulated successfully against
that manager. The address is still resolved again at broadcast time.

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
