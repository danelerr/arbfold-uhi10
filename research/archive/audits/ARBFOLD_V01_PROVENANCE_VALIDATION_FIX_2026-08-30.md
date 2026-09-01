# ARBFOLD v0.1 — Provenance and compiler-evidence validation fix

Date: 2026-08-30  
Git baseline: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Scope: off-chain schema, validators, publication consumers, tests and derived v0.1 provenance  
Release state: local release candidate, `not-broadcast`

This document resolves the Low and Informational findings in
[`ARBFOLD_V01_POST_FIX_REAUDIT_2026-08-30.md`](ARBFOLD_V01_POST_FIX_REAUDIT_2026-08-30.md).
The independent audit report remains unchanged.

## Finding-to-resolution map

| Finding | Root cause | Correction | Regression evidence |
|---|---|---|---|
| Low: `source_tree_sha256` and `compiler_matrix` could be omitted or fabricated while video proof and preflight still emitted success | The shared semantic validator covered claim-bearing mechanics but did not include provenance or compiler evidence in the exact v4 contract. Node consumers also did not bind the raw digest to the versioned manifest, environment and current worktree. | The portable validator now requires the exact nine-field payload, validates the digest format, the ordered four-row compiler experiment, all status-specific fields, gas derivation, bytecode sizes and the selected 100k row. A shared Node provenance layer additionally binds the raw and environment digests to the exact manifest bytes, checks the manifest's exact optimized-v0.1 path set and every current worktree file, checks the selected environment configuration and recomputes the compile-failure error digest. Video proof and preflight both consume that layer before printing success. Python performs an independent equivalent check. | The dashboard suite sends 98 raw mutations through the portable validator where applicable, video proof and preflight, plus a separate incompatible-environment fixture. All publication consumers fail closed. The four exact audit reproductions now exit nonzero without `PASS` or a ready status. Python independently rejects the same provenance/compiler boundaries. |
| Informational: the prior resolution said five publication gates | The document count was stale; the schema has six recomputed gates. | Corrected `five publication gates` to `six publication gates`. | Text search and the unchanged six-gate constants/tests agree. |

## Exact schema v4 contract

The raw artifact must contain exactly these nine top-level keys and no unknown
keys:

1. `schema`
2. `source_tree_sha256`
3. `residual_threshold_wei_a`
4. `frozen_grid`
5. `dense_sweep`
6. `dense_sweep_summary`
7. `six_path_matrix`
8. `compiler_matrix`
9. `mechanical_gates`

`source_tree_sha256` is a lowercase 64-character hexadecimal digest. The
portable validator checks its form; publication consumers additionally require
it to equal the SHA-256 of the exact bytes of
`source-manifest.sha256`. The same digest must appear in `environment.json`.
Every manifest entry is checked against the worktree, and the path list must be
exactly the deterministic `optimized-v01` scope used by
`scripts/source-manifest.py`.

## Compiler matrix rules

The matrix is ordered and contains exactly:

1. `no-ir-runs-200` — measured, `via_ir=false`, 200 runs;
2. `no-ir-runs-1000` — measured, `via_ir=false`, 1,000 runs;
3. `via-ir-runs-200` — measured, `via_ir=true`, 200 runs;
4. `via-ir-runs-1000` — compile-failed, `via_ir=true`, 1,000 runs.

Measured rows have an exact status-specific field set. Gas values are positive
safe integers, the percentage is derived using the same six-decimal
round-half-even rule as the benchmark, and the four positive runtime bytecode
sizes must remain below the 24,576-byte EIP-170 boundary. Because this is a
frozen compiler experiment rather than an arbitrary matrix, the three measured
rows and bytecode measurements are bound to the reproduced values. The first
row must also equal the canonical 100k frozen-grid row and the configuration
selected in `environment.json`.

The failed row has a non-empty error and lowercase SHA-256. Node and Python
recompute the hash from the UTF-8 error text; both the text and digest are bound
to the reproduced compile failure.

## Reproduced audit bypasses

| Mutation | Portable validator | Video proof | Preflight | Python |
|---|---|---|---|---|
| remove `source_tree_sha256` | rejected | exit nonzero, no `PASS` | exit nonzero, no ready status | rejected cleanly |
| replace digest with 64 zeros | format-valid; rejected by filesystem provenance | exit nonzero, no `PASS` | exit nonzero, no ready status | provenance rejection |
| remove `compiler_matrix` | rejected | exit nonzero, no `PASS` | exit nonzero, no ready status | rejected cleanly |
| replace matrix with one fictional row | rejected | exit nonzero, no `PASS` | exit nonzero, no ready status | rejected cleanly |

Additional mutations cover malformed digests, unknown top-level fields,
reordered and duplicated compiler configurations, contradictory `via_ir` and
optimizer runs, invalid status, invalid gas and percentage, missing/zero/
negative bytecode fields, false compile-error hashes and an environment whose
selected configuration contradicts the matrix. The published fixture count is
derived by the test from the mutation array: 98 raw fixtures, preserving the
81 prior fixtures, plus the independent environment mismatch.

## Measurements preserved

| Input | Reference gas | ARBFOLD v0.1 gas | Reduction |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.549365% |
| 25k | 409,402 | 329,777 | 19.449099% |
| 50k | 544,219 | 375,171 | 31.062495% |
| 100k | 544,219 | 375,171 | 31.062495% |
| 200k | 544,209 | 375,160 | 31.063250% |

Canonical output remains `30220363129338304386`; canonical fixed
external-recipient reward remains `85849039116169484`; canonical residual
remains `0`. The dense sweep remains 200 rows, 196/196 actionable workloads
cheaper on the tested canonical path, first actionable 5k and zero-round/
regression range 1k–4k. The supplemental matrix remains paths `0,1,2,3,4,5`.

## Verification results

| Command or gate | Result |
|---|---|
| `git diff --check` | PASS |
| `shasum -a 256 -c research/CHECKSUMS.sha256` | PASS after final checksum regeneration |
| `npm run test:dashboard` | PASS: 28/28; publication matrix reports 98 raw fixtures rejected |
| Python ARBFOLD discovery | PASS: 27/27 |
| Generator and source-manifest checks | PASS |
| v0.1 reassessment check | PASS |
| `make video-proof` | PASS on authentic evidence; corrupt evidence emits no `PASS` |
| Local submission preflight | PASS automated checks; `READY_FOR_MANUAL_FINISH` with exactly three human fields pending |
| `make verify-release` | PASS, exit 0 |
| Release Foundry seed `0x1057` | PASS: 82/82 |
| `npm run check:live` | PASS read-only against the immutable public v0 deployment |

## Provenance hashes

### Before this micro-remediation

| Artifact | SHA-256 |
|---|---|
| Optimized raw v4 | `37da310879312dcaf133d9fd3751f566c7c91d2570a428af0f9ca7a0e32e6c3e` |
| Environment | `ce13cdfd011bfeffc0ffc7a517fc0245779b3e180c5fc541e709d3123ccea9ea` |
| Source manifest | `0d5e034b3ab5b63b05cea22ba08e0b43cd29415e9a0e505dba00e93ed431af2c` |
| v0.1 reassessment | `78edcc94a7784a27b31fd75ca41d7428eebd149d88265756113a716123ed0224` |
| Research checksums | `1dc5032835dfff661a0d817e3f387041fbb54b6f7d47be8ab1c3a95e2c1589cf` |

### After this micro-remediation

| Artifact | SHA-256 |
|---|---|
| Optimized raw v4 | `1c184e301a07f80116f9e79d8cfeeee2a83cea4215d291213c0c4dbe19a74860` |
| Environment | `e2c953b2d89b6959fcc90037b039e85dbe48ae8ca4cf433a7db99bd995e3b7be` |
| Source manifest / source-tree digest | `d41622745ff2b64fc807bc8ee5070981bbe029813b1debfc889301dc9a836618` |
| Report | `9af3d3f331b8d1e3300779d8961f0cc4fbfb6372178cb81bdf5db6c57f26216b` |
| Forge output | `9fcdf9aef99a4c1a0d806b225cae9ec900c62a2d7fe37993ee6e8dfe604ffccd` |
| v0.1 reassessment | `139df7f4f831fef7541964a8a71437641ea4a2932d103c0c4408f89b9389d829` |

## Preserved scope and remaining limits

- No file under `contracts/src`, the frozen benchmark harness, historical
  benchmark directory or public v0 deployment was changed by this
  micro-remediation.
- `ArbFoldCoordinator.sol` remains
  `10f1f260ac72650d3b17f0a69af227e511955f0d27121a8d325e89fb85e54f5d`.
- v0.1 remains local and `not-broadcast`. No commit, push, pull request, Pages
  publication, deployment, broadcast or external transaction was performed.
- The final video URL, cohort email and X handle remain pending.
- Large reserve arrays remain losslessly checked by Forge and Python rather
  than converted to JavaScript `Number`; the Node provenance check binds those
  results to the current source manifest.
- The public repository and onchain demo remain v0. Local v0.1 evidence must
  not be described as deployed until a separately authorized release.
- Steady-state telemetry gas remains unmeasured with a cross-transaction
  harness, and no universal gas, LP-net-value, MEV-capture, ordering or
  production-readiness claim is made.
