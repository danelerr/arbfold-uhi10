# ARBFOLD v0.1 — Final publication-integrity remediation

Date: 2026-08-30  
Git baseline: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Scope: off-chain schema, validators, publication consumers, tests and v0.1 provenance only  
Release state: local release candidate, `not-broadcast`

This document resolves the residual findings in
[`ARBFOLD_V01_POST_RESOLUTION_INSPECTION_2026-08-30.md`](ARBFOLD_V01_POST_RESOLUTION_INSPECTION_2026-08-30.md).
The independent inspection and all earlier audit reports remain unchanged.

## Finding-to-resolution map

| Finding | Root cause | Correction | Regression evidence |
|---|---|---|---|
| Medium: proof and preflight accepted evidence that contradicted the published workload, round topology, dense sweep or six-path matrix | The shared JavaScript validator covered frozen-row gas arithmetic and paired values, but treated the auxiliary evidence and several mechanical fields as trusted copy inputs. Python also trusted the published dense summary and matrix length. | Schema v4 makes the complete payload mandatory and semantically validates workload identity, path identity, round topology, residual policy, all 200 dense rows, the summary derived from those rows and the six unique canonical paths. Video proof and preflight now consume only this validated payload. Python independently applies the same rules. | `tests/dashboard/benchmark-evidence.test.mjs` sends 81 invalid fixtures through `validateBenchmarkPayload`, `video-proof --evidence-only` and submission preflight. Every fixture exits nonzero in both consumers, video prints no `PASS`, and preflight prints no ready status. `tests/test_arbfold_v01_reassessment.py` independently mutates the same semantic boundaries in Python. |
| Low: gas mutation coverage was not exhaustive across the five frozen rows | The earlier committed tests mutated the five derived gas fields only on the canonical 100k row even though the resolution described broader coverage. | JavaScript and Python now mutate percentage, both totals, absolute saving and basis points on every frozen row. | All 25 row/field gas mutations are rejected in both languages. The JavaScript consumer matrix also routes those 25 mutations through video proof and preflight. |

## Files changed by this remediation

- Semantic authority and app types: `app/benchmark-core.js`,
  `app/src/types.ts`.
- Evidence generation and consumers: `scripts/generate-v01-benchmark.py`,
  `scripts/validate-benchmark-evidence.mjs`, `scripts/video-proof.sh`,
  `scripts/submission-preflight.mjs`.
- Independent reassessment: `research/reassess_arbfold_v01.py`,
  `research/results/arbfold-v0.1-reassessment-2026-08-30.json`.
- Regression suites: `tests/dashboard/benchmark-evidence.test.mjs`,
  `tests/test_arbfold_v01_reassessment.py`,
  `tests/test_arbfold_submission.py`.
- Regenerated v0.1 evidence only:
  `benchmark/optimized-release-candidate-results/{raw.json,REPORT.md,environment.json,forge-output.log,source-manifest.sha256}`.
- Provenance and resolution: `research/CHECKSUMS.sha256` and this document.
- The dashboard production build was regenerated in `dist/`; it remains a
  build artifact rather than a new protocol surface.

## Schema v4 and semantic authority

The optimized raw schema is now
`arbfold-v0.1-optimized-release-candidate-v4`; the independent reassessment is
`arbfold-v0.1-thesis-reassessment-v4`.

`app/benchmark-core.js` is the semantic authority shared by the dashboard,
`validate-benchmark-evidence.mjs`, video proof and submission preflight. It
fails before a consumer can emit `PASS` or a ready status unless all of these
rules hold:

- `input_wei` is a canonical decimal `uint256` string in `frozen_grid`,
  `dense_sweep` and `six_path_matrix`, and equals
  `input_tokens * 10**18` exactly;
- the frozen inputs are exactly `10k`, `25k`, `50k`, `100k`, `200k`, on path
  `1`, labelled `ARFX -> ARFY (internal B -> A)`;
- reference swaps equal three times reference rounds, reinjections equal
  reference rounds, direct rounds equal reference rounds, and each direct row
  has one `fold()` call;
- the canonical 100k row is exactly `2 rounds / 6 swaps / 2 reinjections`
  versus `2 direct rounds / 1 fold() call`;
- reference and direct totals decompose into intrinsic, execution and calldata
  gas; absolute saving, basis points and six-decimal round-half-even percentage
  are derived from those totals;
- output and fixed external-recipient reward pairs are canonical uint256
  strings and exactly equal;
- reference and direct residuals are equal, non-negative, at most
  `1,000,000,000,000` wei of internal A, and the 100k residual is zero;
- the six publication gates are recomputed rather than trusted;
- `dense_sweep` has exactly 200 ordered rows from 1k through 200k in 1k steps;
  every row has exact workload identity and derived gas arithmetic; its summary
  is re-derived and must deeply equal the published summary;
- `six_path_matrix` has exactly the ordered, unique paths `0..5`, canonical
  labels and configured input for each route, with full mechanics, gas, pairs,
  residual and tolerance fields.

Python mirrors those rules and additionally performs the exact reserve-delta
comparison against the published tolerance. Large reserve arrays remain JSON
numbers in this release; JavaScript validates their required structure and the
published tolerance but does not claim lossless reserve recomputation. Exact
reserve equivalence remains bounded by Forge, the source manifest and Python.

## Evidence that is now derived

The dense summary is never accepted on assertion alone. Recalculation from the
200 rows produces:

- 196 actionable rows;
- 196 cheaper actionable rows on the tested canonical path;
- first actionable workload: 5k;
- zero-round and regression region: 1k–4k;
- round regions: zero rounds at 1k–4k, one round at 5k–36k and two rounds at
  37k–200k.

The route matrix is accepted only as the six ordered and unique paths `0..5`.
Six copies of path zero, a missing path or a fabricated label fail validation.

## Reproduced bypasses

The bypasses reported by the independent inspection were replayed against the
same three publication surfaces. Every row below now fails the shared
validator, exits nonzero in video proof without printing `PASS`, and exits
nonzero in preflight without printing `STATUS READY_FOR_MANUAL_FINISH` or
`STATUS READY_TO_SUBMIT`.

| Mutation | Validator | Video proof | Preflight |
|---|---|---|---|
| `reference_rounds = 999` | Rejected | exit 1, no `PASS` | exit 1, no ready status |
| `input_wei = "0"` | Rejected | exit 1, no `PASS` | exit 1, no ready status |
| fabricated frozen path label | Rejected | exit 1, no `PASS` | exit 1, no ready status |
| reference/direct residual mismatch | Rejected | exit 1, no `PASS` | exit 1, no ready status |
| missing dense sweep | Rejected | exit 1, no `PASS` | exit 1, no ready status |
| false dense summary | Rejected | exit 1, no `PASS` | exit 1, no ready status |
| missing six-path matrix | Rejected | exit 1, no `PASS` | exit 1, no ready status |
| six duplicated path-zero rows | Rejected | exit 1, no `PASS` | exit 1, no ready status |

The complete consumer matrix contains 81 invalid fixtures. It includes 25 gas
mutations across all five frozen rows; malformed, missing, overflowing and
contradictory workloads; every round relationship; residual policy; all dense
shape/arithmetic/summary boundaries; all route-matrix boundaries; uint256
overflow; and missing, false or contradictory publication gates.

## Reproduced measurements

No measured economic value changed.

| Input | Reference total gas | ARBFOLD v0.1 total gas | Reduction |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.549365% |
| 25k | 409,402 | 329,777 | 19.449099% |
| 50k | 544,219 | 375,171 | 31.062495% |
| 100k | 544,219 | 375,171 | 31.062495% |
| 200k | 544,209 | 375,160 | 31.063250% |

The canonical output remains `30220363129338304386`; the canonical fixed
external-recipient reward remains `85849039116169484`; its residual is zero.
The dense sweep remains 200 rows with 196/196 actionable points cheaper on the
tested canonical path, and the supplemental matrix remains six routes.

## Verification results

| Verification | Result |
|---|---|
| `git diff --check` | PASS |
| Foundry default | 82/82 tests PASS |
| Foundry release, seed `0x1057` | 82/82 tests PASS |
| Release fuzz | 10,000 runs; invariants 256 runs × 20,480 calls, zero reverts |
| Solidity arithmetic properties | 50,000 runs for each of two fuzz properties |
| Python arithmetic differential | 50,000 samples; zero direction mismatches |
| Python ARBFOLD tests | 26/26 PASS |
| Dashboard/typecheck tests | 27/27 PASS |
| Publication consumer mutation matrix | 81/81 rejected by validator, video and preflight |
| Dashboard production build | PASS; non-blocking Vite chunk-size warning |
| Deployment smoke | PASS |
| Coverage | 98.6063% lines; 91.0714% branches; 100% functions |
| Slither 0.11.3 | PASS; 25 findings, 9 reviewed Medium, 0 unresolved High/Medium |
| Generator, source manifest and v0.1 reassessment | PASS |
| Historical v0 reassessment and research checksums | PASS |
| Local submission preflight | 25/25 automated checks PASS; three human fields pending |
| Public submission preflight | 28/29; only the current-v0 public repository claim fails, as expected before publication |
| Public v0 live verification | PASS on chain 1301; read-only check at block 61,267,342 |
| `make video-proof` | PASS on the real v4 payload; no `null` |
| Literal `make verify-release` | PASS, exit code 0 |

## Provenance hashes

### Before this remediation

| Artifact | SHA-256 |
|---|---|
| Optimized raw v3 | `4016fe4db7ddc526d6cdc3b07b7e9bff148829d1f05830b2286bcae59023dd09` |
| v0.1 reassessment v3 | `7b0873f1a7de15aef6f117d7e882f08ea22fc433fe8ab7d5792bb42a0f6c2e05` |
| Source manifest | `c0e0f3e06d38700c602887cf8cb5f2d9d001b443b3be95d1414018bda771fb7e` |
| Environment | `eba160273f2f79b1bdd2a5cdbed4db6fcf055b54e12ae3d289cbf5edd0cf69b4` |
| Report | `bfc400b1eb481227a937d1e653624d8791e30187f513e8b8d9dacd02d42cd854` |

### After this remediation

| Artifact | SHA-256 |
|---|---|
| Optimized raw v4 | `37da310879312dcaf133d9fd3751f566c7c91d2570a428af0f9ca7a0e32e6c3e` |
| v0.1 reassessment v4 | `78edcc94a7784a27b31fd75ca41d7428eebd149d88265756113a716123ed0224` |
| Source manifest | `0d5e034b3ab5b63b05cea22ba08e0b43cd29415e9a0e505dba00e93ed431af2c` |
| Environment | `ce13cdfd011bfeffc0ffc7a517fc0245779b3e180c5fc541e709d3123ccea9ea` |
| Report | `9af3d3f331b8d1e3300779d8961f0cc4fbfb6372178cb81bdf5db6c57f26216b` |
| Forge output | `9fcdf9aef99a4c1a0d806b225cae9ec900c62a2d7fe37993ee6e8dfe604ffccd` |

The artifact hashes changed because the schema, validator, generator and
source-bound provenance changed. Gas, output, reward, rounds, reserves,
residual, dense-sweep measurements and six-path measurements did not.

## Preserved scope and remaining limits

- Every `contracts/src/*.sol` SHA-256 remains identical to the captured
  pre-remediation values. In particular, `ArbFoldCoordinator.sol` remains
  `10f1f260ac72650d3b17f0a69af227e511955f0d27121a8d325e89fb85e54f5d`.
- `contracts/test/ArbFoldCleanCoreBenchmark.t.sol`, the four historical
  benchmark directories and `deployments/unichain-sepolia-1301.json` were not
  changed by this remediation.
- The v0.1 plan remains `not-broadcast`; no deployment, transaction, commit,
  push, pull request or Pages publication was performed.
- The public repository and deployed demo remain v0. Local v0.1 evidence must
  not be described as publicly deployed until a separately authorized release.
- The final video URL, cohort email and X handle remain intentionally pending.
- JavaScript does not claim lossless recomputation of large reserve arrays;
  reserve equivalence is still established through Forge, Python and
  source-manifest provenance.
- Steady-state telemetry gas remains unmeasured with a cross-transaction
  harness and is not claimed.
- The result remains limited to the fixed three-CPMM network and tested paths;
  zero-round workloads are more expensive and no universal gas, LP-net-value,
  MEV-capture, ordering or production-readiness claim is made.
