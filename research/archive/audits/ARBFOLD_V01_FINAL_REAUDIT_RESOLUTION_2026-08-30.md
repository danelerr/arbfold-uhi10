# ARBFOLD v0.1 final re-audit resolution — 2026-08-30

This document resolves the two residual publication-integrity findings in
[`ARBFOLD_V01_FINAL_REMEDIATION_REAUDIT_2026-08-30.md`](ARBFOLD_V01_FINAL_REMEDIATION_REAUDIT_2026-08-30.md).
The independent report was not edited. This remediation did not modify the
Solidity core, the benchmark Solidity harness, the public v0 deployment or any
historical benchmark directory.

## Baseline and scope preservation

- `HEAD` before and after: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`.
- `origin/main` before and after: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`.
- The pre-existing dirty worktree was captured and preserved.
- `contracts/src/ArbFoldCoordinator.sol` remains
  `10f1f260ac72650d3b17f0a69af227e511955f0d27121a8d325e89fb85e54f5d`.
- All seven `contracts/src/*.sol` hashes are unchanged; the complete list is
  recorded below.
- The four historical benchmark directories had no diff before remediation and
  still have no diff after it.
- v0.1 remains a local `not-broadcast` release candidate. No transaction,
  deployment, commit, push, pull request or Pages publication was performed.
- The three human-owned submission fields remain untouched.

## Finding-to-resolution map

| Finding | Root cause | Correction | Regression evidence |
|---|---|---|---|
| Proof/preflight accepted contradictory derived evidence | Consumers checked schema shape and published booleans but did not derive all row arithmetic or publication gates. The shell proof also had a separate, weaker jq validation path. | `validateBenchmarkPayload` is now the JavaScript semantic authority. It checks row types/order, total-gas decomposition, absolute savings, basis points, deterministic six-decimal percentage, exact output/reward pairs, residual/tolerance fields, and recomputes every consumer-verifiable gate. `scripts/validate-benchmark-evidence.mjs` emits the canonical row only after full validation; `video-proof.sh` uses jq only to render it. Preflight imports the same validator. | The real raw passes. False percentage, either total, absolute savings, basis points, missing/null/negative/fractional residual or tolerance, pair mismatch, contradictory gates, legacy schema and missing/additional/reordered rows all fail. Invalid proof runs print no `PASS`; invalid preflight runs print no `STATUS READY`. |
| Decimal “uint256” accepted values above the EVM range | Regex validation established canonical decimal syntax but had no upper bound. | JavaScript, benchmark generation and reassessment define the exact maximum `115792089237316195423570985008687907853269984665640564039457584007913129639935`. Syntax and range are validated losslessly by length and lexicographic comparison; these fields are never converted to JavaScript `Number`. | `0` and `2**256 - 1` pass. `2**256`, very long strings, negative, fractional, exponential, empty and leading-zero forms fail. The four paired fields are exercised on both sides in every frozen row; every `±1 wei` mismatch is detected. |
| `make verify-release` depended on shell PATH | `run-slither.sh` only called `command -v slither`, although the declared repository toolchain already had `.venv/bin/slither`. | Slither resolution now respects an explicit `SLITHER`, then a global executable, then `.venv/bin/slither`. If none exists, it fails with exact environment setup commands. An invalid explicit override fails closed. | Literal `make verify-release` completed with exit code 0 from the original shell and ran the unchanged Slither gate through `.venv/bin/slither`. |

## Semantic-validation boundary

The publication schema remains
`arbfold-v0.1-optimized-release-candidate-v3`; no schema migration was needed.
The four output/reward values remain canonical decimal strings and are checked
losslessly in JavaScript and Python.

The large reserve objects remain JSON numbers in schema v3. JavaScript checks
their required shape and checks that every published equivalence tolerance is
an integer no greater than one wei, but it does not claim to recompute one-wei
reserve deltas through lossy `Number` values. Exact reserve equivalence remains
backed by the source-bound Forge assertions and manifest. Python's lossless
integer parser independently checks the six paired reserves and requires the
published tolerance to equal the measured maximum delta. `video-proof` states
this boundary instead of claiming that all mechanical properties were
consumer-recomputed.

The gas percentage uses deterministic integer round-half-even arithmetic at
six decimal places in JavaScript and Python. Explicit tie cases are covered by
tests, so no binary floating-point rounding determines a published percentage.

## Examples now rejected

- Canonical `gas_reduction_percent = "99.999999"`.
- A 10k direct row made one gas unit more expensive while
  `all_five_cheaper = true`.
- A 25k direct row made one gas unit more expensive while
  `twenty_five_k_cheaper = true`.
- Missing, null, negative or fractional `direct_residual`.
- Missing, null, negative or fractional `equivalence_tolerance_wei`.
- Any missing, false or row-contradictory publication gate.
- A `+1 wei` or `-1 wei` mutation to any output/reward side in any frozen row.
- Decimal `2**256` in any of the four exact paired fields.
- Legacy schema, missing row, additional row or reordered frozen grid.

The dashboard suite additionally sends 22 independently corrupted raw files
through both `video-proof --evidence-only` and submission preflight: 44
negative consumer executions. Every one fails before a success marker.

## Reproduced benchmark

The source-bound generator was rerun. The economic values did not change.

| Input | Iterative reference | ARBFOLD v0.1 | Reduction |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.549365% |
| 25k | 409,402 | 329,777 | 19.449099% |
| 50k | 544,219 | 375,171 | 31.062495% |
| 100k | 544,219 | 375,171 | 31.062495% |
| 200k | 544,209 | 375,160 | 31.063250% |

The dense canonical sweep still contains 200 rows. Workloads 1k–4k execute
zero fold rounds and are more expensive. Every actionable workload from
5k–200k is cheaper in the tested canonical path: 196 / 196. The six-path
matrix remains complete. This is not a universal gas claim. The rejected 10%
LP-net-uplift claim remains rejected.

## Verification results

| Verification | Result |
|---|---|
| `git diff --check` | PASS |
| `forge fmt --check` | PASS |
| Foundry default | 82 / 82 PASS |
| Foundry release, seed `0x1057` | 82 / 82 PASS; 10,000 fuzz runs and 256 × 20,480 calls per invariant property |
| Python ARBFOLD suite | 26 / 26 PASS |
| Dashboard/typecheck suite | 24 / 24 PASS |
| Adversarial semantic matrix | PASS, including all required gas/gate/residual/tolerance/uint256 mutations across all relevant rows |
| Dashboard production build | PASS; dev and build serve the same optimized raw byte for byte; non-blocking 518.51 kB chunk warning remains |
| `make video-proof` | PASS with the real raw; exact pairs printed; no `null` |
| Arithmetic differential | 50,000 samples; zero direction mismatches |
| Solidity arithmetic fuzz | 50,000 runs for each of two fuzz properties; PASS |
| Coverage | 98.6063% lines, 91.0714% branches, 100% functions |
| Slither 0.11.3 | PASS; 25 findings, 9 reviewed Medium, 0 unresolved High/Medium |
| Deployment smoke | PASS |
| Generator and source manifest | PASS |
| Historical v0 reassessment | PASS |
| v0.1 reassessment | PASS |
| Literal `make verify-release` | PASS, exit code 0 from the current shell |
| Local submission preflight | 25 / 25 automated checks PASS; three human fields pending |
| Public submission preflight | Expected 28 / 29; only the unpublished `main` v0 claim fails |
| Live public v0 verifier | PASS on chain 1301; no transaction was sent |
| Historical benchmark diff | Empty before and after |

## Provenance hashes

### Evidence before this remediation

- Optimized raw:
  `0eb71a02f4263b3cd1c8e66364a67b3fece26380603f2cab10937eb69e141d21`
- v0.1 reassessment:
  `493d000f9b16be80d7d9443ad16cec387cc0d9fa112b1c8caa34f6e07ad6df93`
- Source manifest:
  `13d915d18d2d68468f9fc4e6d38a4e96d89799f95bd3bd60844aa34f96d578eb`

### Regenerated evidence

- Optimized raw:
  `4016fe4db7ddc526d6cdc3b07b7e9bff148829d1f05830b2286bcae59023dd09`
- v0.1 reassessment:
  `7b0873f1a7de15aef6f117d7e882f08ea22fc433fe8ab7d5792bb42a0f6c2e05`
- Source manifest file:
  `c0e0f3e06d38700c602887cf8cb5f2d9d001b443b3be95d1414018bda771fb7e`
- Source-tree digest contained in raw/environment:
  `c0e0f3e06d38700c602887cf8cb5f2d9d001b443b3be95d1414018bda771fb7e`
- Environment:
  `eba160273f2f79b1bdd2a5cdbed4db6fcf055b54e12ae3d289cbf5edd0cf69b4`
- Forge output:
  `9fcdf9aef99a4c1a0d806b225cae9ec900c62a2d7fe37993ee6e8dfe604ffccd`
- Report:
  `bfc400b1eb481227a937d1e653624d8791e30187f513e8b8d9dacd02d42cd854`

The raw/reassessment/manifest hashes changed only because the validator,
generator and source-bound provenance changed. All five measured gas pairs,
exact outputs/rewards, dense sweep results and six-path evidence remained
unchanged.

### Solidity core, unchanged

| File | SHA-256 |
|---|---|
| `ArbFoldCoordinator.sol` | `10f1f260ac72650d3b17f0a69af227e511955f0d27121a8d325e89fb85e54f5d` |
| `ArbFoldHook.sol` | `5ebcc6b78eb316348bbe029aa1fcd371f081a255109197622bbf1e1a1ba65a13` |
| `ArbFoldHookDeployer.sol` | `e84907b1b036c4e4ee19d5d601362cd55ba8188fdcf1d0062142ae382ef9f8e2` |
| `ArbFoldRouter.sol` | `6d9b4c8d970ea239e2d54de593b5c9a117352b31eaf02500b26fe0e4b404a5d0` |
| `CycleMath.sol` | `092552ce5bb9e0aa3be3c546a4d11ef52eff5536e5abfae0b23421faf42d981a` |
| `DemoToken.sol` | `1b986f46764a9a890c056943c46ebf7bd606b1f18c7d39ca14736b651dcbde91` |
| `IArbFold.sol` | `2318627484ba45911f929f5d2c7c45abda09299d18893f1971a6585a6c03052f` |

## Release status and remaining limits

- `deployments/unichain-sepolia-1301-v0.1.plan.json` remains `not-broadcast`,
  with `publicationCommit: null`, `broadcastPerformed: false`, no
  transactions and no canonical v0.1 demo transaction.
- The public v0 deployment remains immutable and separate from local v0.1.
- Public preflight will continue to fail its current-claim check until a later,
  explicitly authorized publication.
- The final video URL, cohort email and X handle remain human-owned and pending.
- Steady-state telemetry gas remains unmeasured and unclaimed.
- JavaScript does not independently recompute large-reserve one-wei deltas in
  schema v3; that exact property remains Forge/source-manifest-backed and is
  losslessly checked by the Python reassessment.
- No production readiness or universal execution-efficiency claim is made.
