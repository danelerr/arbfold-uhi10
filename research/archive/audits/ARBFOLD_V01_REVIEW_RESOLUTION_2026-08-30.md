# ARBFOLD v0.1 — Independent review resolution

Resolution date: 2026-08-30  
Review: [ARBFOLD v0.1 differential implementation review](ARBFOLD_V01_IMPLEMENTATION_REVIEW_2026-08-30.md)  
Baseline: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Release state: local release candidate; not committed, pushed or deployed

## Resolution summary

All three publication-blocking findings are resolved without changing the
approved coordinator mechanism, reward economics, public v0 deployment or any
historical benchmark directory.

| Review finding | Root cause | Resolution | Evidence |
|---|---|---|---|
| Invalid steady-state benchmark | `vm.store` initialized telemetry inside the same Foundry transaction, producing a dirty-slot write rather than a genuine later-transaction nonzero-to-nonzero transition. | Removed the test branch, log fields, raw storage matrix, report table and percentage claim. No replacement estimate is made. | [`ArbFoldCleanCoreBenchmark.t.sol`](../contracts/test/ArbFoldCleanCoreBenchmark.t.sol), [`raw.json`](../benchmark/optimized-release-candidate-results/raw.json), [`REPORT.md`](../benchmark/optimized-release-candidate-results/REPORT.md) |
| Dashboard terminology and workload boundary | The public UI used “Solver reward” and omitted the measured zero-round regression region next to the grid. | Active components now use “Fixed execution reward” and state that 1k–4k execute zero rounds and cost more, while every actionable point from 5k–200k was cheaper only in the tested canonical path. | [`BenchmarkDemo.tsx`](../app/src/components/BenchmarkDemo.tsx), [`SwapResult.tsx`](../app/src/components/SwapResult.tsx), [`live-ui.test.mjs`](../tests/dashboard/live-ui.test.mjs) |
| Output/reward gates were not self-auditable | Output equality reused reserve tolerance and reward equality was hardcoded. | Every frozen row now records reference/direct output and reference/direct fixed external-recipient reward. Schema v2 derives both gates exclusively from those pairs. Mutation tests prove that changing any paired value fails the corresponding recomputation. | [`generate-v01-benchmark.py`](../scripts/generate-v01-benchmark.py), [`reassess_arbfold_v01.py`](../research/reassess_arbfold_v01.py), [`test_arbfold_v01_reassessment.py`](../tests/test_arbfold_v01_reassessment.py) |

## Benchmark claims before and after review

| Claim | Before resolution | After resolution |
|---|---|---|
| First-call 100k | 544,219 reference vs 375,171 direct; 31.062495% less | Retained and independently regenerated unchanged |
| First-call 25k | 409,402 reference vs 329,777 direct; 19.449099% less | Retained and independently regenerated unchanged |
| Steady-state 100k | 352,769 direct; 35.178853% less | Removed; unsupported by the original harness |
| Steady-state boundary | Implied later-transaction measurement | “Steady-state telemetry gas has not been measured with a cross-transaction harness and is not claimed in this release.” |
| Reward terminology | Solver reward | Fixed execution reward in the UI; fixed external-recipient reward in evidence |
| Dense sweep | Scope was not visible beside the dashboard grid | 1k–4k: zero rounds and more expensive; 5k–200k: 196/196 actionable points cheaper in the tested canonical path only |
| Output gate | Derived from reserve tolerance | Derived from five reference/direct output pairs |
| Reward gate | Hardcoded `True` | Derived from five reference/direct reward pairs |

## Regenerated first-call grid

| Input | Iterative reference | ARBFOLD v0.1 | Gas saved | Reduction | Direct rounds | Reserve tolerance |
|---:|---:|---:|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 79,623 | 19.549365% | 1 | 0 wei |
| 25k | 409,402 | 329,777 | 79,625 | 19.449099% | 1 | 0 wei |
| 50k | 544,219 | 375,171 | 169,048 | 31.062495% | 2 | 0 wei |
| 100k | 544,219 | 375,171 | 169,048 | 31.062495% | 2 | 0 wei |
| 200k | 544,209 | 375,160 | 169,049 | 31.063250% | 2 | 0 wei |

There was no deviation from the five expected first-call measurements. Each
row has exact paired output equality, exact paired fixed external-recipient
reward equality and exact final-reserve equality in this run.

## Schema and evidence changes

- Optimized raw schema: `arbfold-v0.1-optimized-release-candidate-v2`.
- Reassessment schema: `arbfold-v0.1-thesis-reassessment-v2`.
- `storage_transition_matrix` is absent.
- The source manifest contains 19 current source/test/configuration entries.
- `raw.json` and the reassessment independently recompute both paired gates.
- The dashboard loader and submission preflight reject a mismatched schema or
  paired gate.
- Historical v0 artifact directories remain byte-for-byte untouched by this
  resolution.

## Verification results

| Verification | Measured result |
|---|---|
| `git diff --check` | PASS |
| `forge fmt --check` | PASS |
| Default Foundry suite | 82/82 PASS; 0 failed |
| Release Foundry suite | 82/82 PASS; 10,000 fuzz runs; 256 invariant runs × 80 depth; 0 failed |
| Python ARBFOLD tests | 25/25 PASS, including paired-value mutation cases |
| Dashboard tests | 17/17 PASS; TypeScript typecheck PASS |
| Arithmetic differential | 50,000 samples, seed 1057; 0 direction mismatches |
| Foundry arithmetic fuzz | 50,000 runs for each of two fuzz properties; PASS |
| Coverage | 98.6063% lines; 91.0714% branches; 100% functions |
| Slither 0.11.3 gate | PASS; 25 findings total, 9 reviewed Medium, 0 unresolved High/Medium |
| Historical v0 reassessment | PASS |
| v0.1 reassessment | PASS; all 13 artifact/promotion checks true |
| Optimized source manifest | PASS |
| Historical benchmark diff gate | PASS; no diff in all four protected directories |
| Local submission preflight | 22/22 automated checks PASS; 3 Daniel-owned fields pending |
| Public submission preflight | 25/26; expected failure because public `main` does not yet serve this uncommitted v0.1 claim |
| Immutable v0 live verifier | PASS on chain 1301 at block 61,255,148 |

The removal of the invalid benchmark test changes the Foundry suite count from
83 to 82. This is expected: the missing test is the unsupported steady-state
measurement, not a removed mechanism or safety test.

## Files changed for this resolution

Mechanism evidence and generation:

- `contracts/test/ArbFoldCleanCoreBenchmark.t.sol`
- `scripts/generate-v01-benchmark.py`
- `benchmark/optimized-release-candidate-results/{REPORT.md,raw.json,environment.json,forge-output.log,source-manifest.sha256}`
- `research/reassess_arbfold_v01.py`
- `research/results/arbfold-v0.1-reassessment-2026-08-30.json`
- `research/CHECKSUMS.sha256`

Public copy and consumers:

- `app/src/components/BenchmarkDemo.tsx`
- `app/src/components/SwapResult.tsx`
- `app/src/lib/arbfold.ts`
- `app/src/types.ts`
- `README.md`
- `docs/LIMITATIONS.md`
- `docs/RELEASE_EVIDENCE.md`
- `docs/THREAT_MODEL.md`
- `docs/V01_DEPLOYMENT_CHECKLIST.md`
- `docs/VIDEO_RECORDING_RUNBOOK.md`
- `scripts/submission-preflight.mjs`

Regression tests:

- `tests/dashboard/live-ui.test.mjs`
- `tests/test_arbfold_submission.py`
- `tests/test_arbfold_v01_reassessment.py`

## Remaining boundary

Steady-state telemetry gas remains future research. A valid measurement must
establish nonzero telemetry before the measured transaction begins, such as
two real Anvil transactions or RPC prestate applied before transaction start.
No steady-state estimate or percentage is part of v0.1.

The public chain still runs immutable v0. The local v0.1 release candidate has
not been broadcast. No commit, push, pull request or deployment was performed
as part of this resolution.
