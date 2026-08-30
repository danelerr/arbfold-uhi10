# ARBFOLD v0.1 remediation re-audit resolution — 2026-08-30

This document resolves the four publication-package findings in
[`ARBFOLD_V01_REMEDIATION_REAUDIT_2026-08-30.md`](ARBFOLD_V01_REMEDIATION_REAUDIT_2026-08-30.md).
It does not revise the independent report. The Solidity core, public v0
deployment and historical benchmark directories were not modified by this
remediation.

## Baseline preserved before remediation

- `HEAD`: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`
- `origin/main`: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`
- The pre-existing dirty worktree was recorded and preserved.
- SHA-256 values for all seven files under `contracts/src/*.sol` were captured.
- The four historical evidence directories had no diff before remediation and
  still have no diff after it.

## Finding-to-resolution map

| Finding | Root cause | Correction | Regression evidence | Remaining boundary |
|---|---|---|---|---|
| `make video-proof` printed `null` and still passed | The shell script queried two removed legacy fields and used a rendering query rather than a fail-closed evidence gate. | Added `scripts/video-proof-evidence.jq`; the script now requires schema v3, exactly one canonical 100k row, complete non-null fields, canonical decimal pairs, exact pair equality and coherent true mechanical gates before printing any PASS line. It displays both exact sides. `--evidence-only` and `ARBFOLD_BENCHMARK_PATH` support isolated mutation tests. | A valid raw passes without the string `null`. Missing, null and `+1 wei` mutations of every paired canonical field fail. A mutated raw also fails submission preflight. | The script validates committed benchmark evidence; it does not independently rerun the benchmark unless the generator command is invoked. |
| Vite dev and built dashboard consumed different artifacts | The Vite middleware pointed at historical v0 while the build copier pointed at optimized v0.1, and the loader accepted a legacy `rows` fallback. | Both paths now import `scripts/evidence-sources.mjs` and consume `benchmark/optimized-release-candidate-results/raw.json`. `loadBenchmark()` requires the reviewed schema and `frozen_grid`; the legacy fallback was removed. | An actual Vite dev endpoint and a production dashboard build return byte-for-byte identical evidence. Their SHA-256 is `0eb71a02f4263b3cd1c8e66364a67b3fece26380603f2cab10937eb69e141d21`; canonical gas is 544,219 / 375,171. Schema v1/v2, absent grids and legacy payloads fail. | The public Pages site remains v0 until publication is separately authorized. |
| JavaScript could lose exact `uint256` evidence | The four paired output/reward values were JSON numbers larger than `Number.MAX_SAFE_INTEGER`. | Schema `arbfold-v0.1-optimized-release-candidate-v3` serializes the four fields as canonical decimal strings. Python and JavaScript validate `^(0|[1-9][0-9]*)$`; JavaScript compares them with `BigInt`. The reassessment schema is `arbfold-v0.1-thesis-reassessment-v3`. | Python and dashboard tests mutate `±1 wei` across all four fields, both sides and all five rows. Empty, negative, fractional, exponential, leading-zero, numeric and null representations fail. Canonical values remain `30220363129338304386` output and `85849039116169484` fixed external-recipient reward. | Other large reserve fields are not consumed by the dashboard equality gates; exact public claims in this release are limited to the four paired fields explicitly migrated. |
| Public copy, counts and subtitles were stale | Active UI/docs and the subtitle file still mixed v0 statistics and prior suite counts with v0.1. | Updated the active count to 82, replaced central reward wording with “fixed external-recipient reward” or “fixed execution reward”, and rewrote the English SRT for v0.1. Added copy/preflight regressions. | Tests reject stale 83/61 counts, “Same solver reward”, a v0 19.12% v0.1 headline and a v0.1 25k regression. The SRT now states both frozen rows, the dense-sweep boundary, one `fold()` call/two rounds, immutable public v0 versus local v0.1 and the rejected 10% economic claim. | Historical documents retain their historical terminology and values by design. |

## Reproduced benchmark

First-call totals were regenerated from the source-bound Foundry harness; no
expected number was copied into the artifact.

| Input | Iterative reference | ARBFOLD v0.1 | Reduction |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.549365% |
| 25k | 409,402 | 329,777 | 19.449099% |
| 50k | 544,219 | 375,171 | 31.062495% |
| 100k | 544,219 | 375,171 | 31.062495% |
| 200k | 544,209 | 375,160 | 31.063250% |

The dense canonical sweep contains 200 rows. Workloads 1k–4k execute zero fold
rounds and cost more. Every actionable workload from 5k–200k was cheaper in
the tested canonical path: 196 / 196. This is not a universal gas claim.

Steady-state telemetry gas has not been measured with a cross-transaction
harness and is not claimed in this release.

## Schemas and provenance

- Raw schema: `arbfold-v0.1-optimized-release-candidate-v3`
- Environment schema: `arbfold-v0.1-environment-v3`
- Reassessment schema: `arbfold-v0.1-thesis-reassessment-v3`
- Source tree digest: `13d915d18d2d68468f9fc4e6d38a4e96d89799f95bd3bd60844aa34f96d578eb`
- Optimized raw SHA-256: `0eb71a02f4263b3cd1c8e66364a67b3fece26380603f2cab10937eb69e141d21`
- Reassessment SHA-256: `493d000f9b16be80d7d9443ad16cec387cc0d9fa112b1c8caa34f6e07ad6df93`

## Verification results

- `git diff --check`: PASS.
- `forge fmt --check`: PASS.
- Default Foundry suite: 82 / 82 PASS.
- Release suite with fuzz seed `0x1057`: 82 / 82 PASS; 10,000 fuzz runs and 256 × 20,480 invariant calls per invariant property.
- Python ARBFOLD suite: 26 / 26 PASS.
- Dashboard/typecheck suite: 22 / 22 PASS.
- Dashboard production build: PASS; optimized raw copied byte-for-byte.
- `make video-proof`: PASS; no `null` output.
- Arithmetic differential: 50,000 samples, zero direction mismatches; Solidity arithmetic fuzz: 50,000 runs per fuzz test.
- Coverage: 98.6063% lines, 91.0714% branches, 100% functions.
- Deployment smoke test: PASS.
- Slither: 25 findings, 9 reviewed Medium, 0 unresolved Medium/High.
- Generator, source manifest and both v0/v0.1 reassessments: PASS.
- Local submission preflight: 25 / 25 automated checks PASS; three human-owned final fields remain.
- Live public v0 verification: PASS.

## Release status

ARBFOLD v0.1 is a local release candidate. No deployment, transaction,
commit, push or pull request was made while resolving this re-audit. The public
Unichain Sepolia deployment remains immutable v0 evidence.
