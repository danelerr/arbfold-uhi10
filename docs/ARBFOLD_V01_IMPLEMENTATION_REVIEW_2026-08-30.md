# ARBFOLD v0.1 — Differential implementation review

Review date: 2026-08-30  
Baseline: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Compared state: uncommitted working tree  
Reviewer posture: security-focused differential and specification-compliance review

## Executive summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 2 |

**Overall risk:** Low for the optimized contract; medium for publishing the complete evidence package without correction.  
**Recommendation:** **Conditional approval.** Approve the v0.1 contract optimization and the frozen first-call benchmark. Correct or remove the secondary steady-state result, clean up the dashboard terminology/boundary, and make the raw mechanical gates data-derived before publication.

Key results:

- No critical or high-severity security regression was identified in the optimized coordinator.
- The canonical first-call result independently reproduced: `544,219` reference gas versus `375,171` direct gas, or `31.062495%` less.
- The former 25k regression independently reproduced as removed: `409,402` versus `329,777`, or `19.449099%` less.
- Default Foundry: 83/83 tests pass.
- Release Foundry: 83/83 tests pass, including 10,000 fuzz runs and 256 invariant runs at depth 80.
- Coverage: 98.61% lines, 91.07% branches, 100% functions.
- Slither 0.11.3 gate: 0 unresolved High/Medium findings; the nine Medium reports are explicitly reviewed by the repository allowlist.
- Historical v0 benchmark directories have no Git diff.
- The immutable public v0 deployment passes the live verifier. v0.1 has correctly not been broadcast.

## What changed

**Range:** `f9d46e8..working-tree`  
**Commits in range:** 0; the implementation is not committed yet.  
**Tracked diff:** 37 files, 988 additions, 291 deletions.  
**New material:** 60 untracked files, including v0.1 tests, benchmark evidence, reassessments, audit context and deployment plan.

| Area | Representative files | Risk | Result |
|---|---|---:|---|
| Contract core | `contracts/src/ArbFoldCoordinator.sol` | High blast radius | Reviewed; no High/Critical regression found |
| Solidity verification | `contracts/test/ArbFoldV01.t.sol`, benchmark tests | High | Strong coverage; one benchmark-method defect |
| Evidence pipeline | generator, raw JSON, manifest, reassessment | Medium | Reproducible; raw gates need stronger derivation |
| Dashboard and claims | `README.md`, `app/src`, judge docs | Medium | Mostly corrected; two public-copy gaps remain |
| Deployment | v0.1 plan and deployment guardrails | High operational impact | Correctly prepared and not broadcast |

The optimized coordinator:

1. keeps the six-reserve state in memory across rounds;
2. preserves per-round claim transfers, reserve writes, conservation checks and invariant checks;
3. performs a fresh final `network()` read and exact `StateDrift` comparison;
4. replaces four telemetry slots with one packed slot and explicit `uint256` getters;
5. computes `lastResidualProfit()` on demand without changing its ABI selector;
6. rejects zero, coordinator, PoolManager and registered-hook reward-recipient aliases;
7. keeps the v0 deployment and historical evidence untouched.

## Findings

### Medium — The reported “steady” gas is not a real subsequent-transaction measurement

**Files:**

- `contracts/test/ArbFoldCleanCoreBenchmark.t.sol:392`
- `benchmark/optimized-release-candidate-results/REPORT.md:57`

**Blast radius:** Secondary benchmark table only. The frozen first-call grid and its 31.06% canonical result are unaffected.  
**Test coverage:** A test exists, but its setup models the wrong EVM storage transition.

The steady branch writes telemetry slot 3 with `vm.store` and then invokes the measured swap in the same Foundry test transaction:

```solidity
if (steady) vm.store(address(env.coordinator), TELEMETRY_SLOT, bytes32(uint256(1)));
```

That makes the later telemetry `SSTORE` a dirty-slot write relative to the test transaction's original zero value. It is not the nonzero-to-nonzero write that a genuine later blockchain transaction would execute. The verbose trace confirms the characteristic discrepancy: the measured `fold` call falls from `214,084` to `194,184` gas, a `19,900` reduction attributable to the dirty-slot treatment.

Consequently, the published steady row—`352,769` gas and `35.178853%` less—is over-optimistic and not established by this experiment. This does **not** invalidate:

- the first-call 100k result of `375,171` gas and `31.062495%` less;
- the first-call 25k result of `329,777` gas and `19.449099%` less;
- the state/output/reward equivalence assertions.

**Recommendation:** Remeasure steady state with the storage slot nonzero before the measured transaction begins, preferably through two actual Anvil transactions or an RPC-level pre-state override. Then regenerate the versioned artifacts. If that cannot be completed before submission, remove the steady table and make no steady-state percentage claim.

### Low — The dashboard does not fully implement the agreed public terminology and workload boundary

**Files:**

- `app/src/components/BenchmarkDemo.tsx:124`
- `app/src/components/BenchmarkDemo.tsx:140`
- `app/src/components/SwapResult.tsx:60`

The public UI still says `Solver reward`, although the mechanism is a caller-selected fixed external-recipient reward and has no solver market, auction or competition. The UI also says “ARBFOLD is not always cheaper” while showing only the five positive rows; it does not state on the page that 1k–4k are zero-round regressions. The README and judge documents do state the correct boundary, so this is a dashboard/specification gap rather than a false repository-wide claim.

**Recommendation:** Rename the metric to `Fixed external-recipient reward` (or a short UI equivalent such as `Fixed execution reward`) and place `1k–4k: zero rounds, more expensive` beside the five-point grid. Add dashboard tests for both strings.

### Low — Two machine-readable mechanical gates are asserted rather than derived from raw paired values

**File:** `scripts/generate-v01-benchmark.py:627`

The generator sets:

```python
"all_frozen_outputs_equal": all(row["equivalence_tolerance_wei"] <= 1 for row in frozen),
"all_frozen_rewards_equal": True,
```

Reserve tolerance is not an output-equality calculation, and reward equality is hardcoded. The Forge scenario does assert both equalities and a failed assertion would fail generation, so the underlying result is supported. However, a consumer of `raw.json` cannot independently recompute those two named gates from paired raw values.

**Recommendation:** Log and store reference/direct user output and reference/direct reward separately for every frozen row, then derive both booleans from those fields. Keep the Solidity assertions as a second layer.

## Specification compliance

| Requirement | Status | Evidence |
|---|---|---|
| Preserve v0 and avoid V1 net-settlement redesign | Pass | Historical directories unchanged; `_applyDirect` remains per round |
| Cache network state between rounds | Pass | `ArbFoldCoordinator.fold` uses `currentState` |
| Fresh exact final-state comparison | Pass | `network()` plus `StateDrift` |
| Remove persisted residual while preserving getter ABI | Pass | On-demand `lastResidualProfit()` |
| One packed telemetry write with overflow guards | Pass | `Telemetry` plus `TelemetryOverflow`; storage layout confirms slot 3 |
| Reject accounting-boundary reward aliases | Pass | Six atomic negative-path tests |
| Preserve output, reward and final-state equivalence | Pass for frozen grid | Runtime assertions and tolerance 0 in the reproduced rows |
| Fix the 25k regression | Pass | 19.449099% less in the reproduced first-call benchmark |
| Dense 1k–200k sweep | Pass with stated scope | 200 rows; 196 actionable rows cheaper; 1k–4k zero-round regressions |
| Six path/direction sample | Pass | Six actionable samples, explicitly non-universal |
| First-call versus steady-state experiment | Partial | First-call valid; steady setup invalid as a later transaction |
| Compiler matrix | Pass | Three measured configurations and one recorded compile failure |
| Truthful README/judge narrative | Pass | Correct two-round framing, limits and v0/v0.1 separation |
| Truthful dashboard terminology/boundary | Partial | Finding above |
| Do not broadcast without authorization | Pass | Plan says `not-broadcast`; public v0 remains live |

## Test coverage analysis

Verification executed during this review:

| Command | Result |
|---|---|
| `forge fmt --check` | Pass |
| `forge test --offline` | 83/83 pass |
| `FOUNDRY_PROFILE=release forge test --offline` | 83/83 pass |
| Frozen/report benchmark replay | Exact five-point first-call figures reproduced |
| `make arithmetic` | Pass; 50,000 differential samples and 50,000 Forge fuzz runs |
| `make coverage` | 98.61% lines, 91.07% branches, 100% functions |
| Slither via `.venv/bin/slither` | Gate pass; 0 unresolved High/Medium |
| Python research tests | 21/21 pass |
| Dashboard tests | 17/17 pass |
| Deployment smoke test | Pass |
| Checksums/manifests/reassessments | Pass |
| `npm run check:live` | Public v0 deployment verified on chain 1301 |

Remaining test gaps relevant to this diff:

| Gap | Risk | Impact |
|---|---:|---|
| Genuine cross-transaction steady telemetry measurement | Medium | Secondary gas percentage is unsupported |
| Dashboard assertion for reward terminology and 1k–4k boundary | Low | Judge-facing copy can drift |
| Raw paired output/reward fields | Low | Artifact consumers must trust Forge assertions |

## Blast radius analysis

| Changed function/area | Direct consumers | Risk | Assessment |
|---|---:|---:|---|
| `ArbFoldCoordinator.fold` | Origin hook plus test/reference harnesses | High | Core path tested across six directions and stateful invariants |
| Telemetry getters | App, deployment/demo scripts, tests and docs | Medium | ABI preserved; semantics of residual intentionally changed and tested |
| Reward-recipient validation | Router-driven fold calls | Medium | Tightening only; forbidden recipients now revert atomically |
| Benchmark generator/data | Dashboard and submission claims | High reputational | First-call data valid; secondary steady row needs correction |
| Deployment script/plan | Future v0.1 deployment | High operational | Fails closed; no broadcast performed |

The optimized source is not used by the immutable public v0 deployment. Therefore the onchain blast radius is currently zero; publishing or broadcasting v0.1 would change that.

## Historical context

The four original telemetry slots and the round-by-round network reads were introduced with the clean-core prototype in commit `6dd7946`. `fold(address)` was later touched by release hardening in `9cbc16e`. The current optimization is an uncommitted working-tree change against `f9d46e8`.

No historical benchmark was rewritten:

- `benchmark/arbfold-results/`
- `benchmark/clean-core-results/`
- `benchmark/release-candidate-results/`
- `benchmark/arbfold-foundry/`

The new result is correctly isolated under `benchmark/optimized-release-candidate-results/`.

## Release and publication state

The local submission preflight passes 17/17 automated checks. The public preflight currently passes 20/21 and fails only because GitHub `main` does not yet serve the uncommitted v0.1 claim. Three human-owned fields also remain pending: video URL, cohort email and X handle.

This is expected for a prepared local release, but it means the work is **not yet a finished public submission**. Publishing must occur only after the findings above are addressed, the exact tree is committed, evidence is regenerated against that commit, and the public preflight passes.

## Recommendations

### Immediate before publication

- [ ] Replace or remove the invalid steady-state gas row.
- [ ] Correct the dashboard reward terminology.
- [ ] Show the 1k–4k zero-round regression boundary directly in the dashboard.
- [ ] Make output/reward gates derive from paired raw fields.
- [ ] Regenerate evidence and reassessment after those changes.

### Release operations

- [ ] Commit and publish the exact reviewed source/evidence tree.
- [ ] Rerun `make verify-release` in the declared toolchain.
- [ ] Confirm `npm run preflight:submission` passes against public GitHub/Pages.
- [ ] Fill the three human-owned submission fields.
- [ ] Keep v0.1 unbroadcast unless Daniel explicitly authorizes a new testnet deployment.

### Post-Hookathon / production track

- [ ] Independent baseline implementation and broader historical opportunity study.
- [ ] Runtime claim-versus-reserve checks and explicit surplus accounting.
- [ ] Residual postcondition or explicit incomplete-fold state.
- [ ] Atomic factory/funding lifecycle and full production audit.
- [ ] Net-settlement V1 only as a separately specified and rebenchmarked design.

## Analysis methodology

**Strategy:** Focused differential review with deep treatment of the only changed production contract and the benchmark/evidence pipeline.

Techniques applied:

- working-tree diff and Git-history/blame analysis;
- function assumption/guarantee/dependency reconstruction;
- Uniswap v4 custom-accounting and claim-flow review;
- state-transition, overflow, atomicity and recipient-alias adversarial checks;
- specification-to-code compliance mapping;
- independent execution of default/release tests, invariants, arithmetic differential checks, coverage, Slither, deployment smoke test and live verifier;
- exact replay of the benchmark log rows;
- trace-level inspection of the first/steady storage experiment;
- repository-wide claim and terminology search.

Limitations:

- This is not an independent production audit or formal verification.
- External dependencies were pinned and exercised but not re-audited line by line.
- The dense sweep proves gas behavior over the stated canonical path; it does not independently prove mechanical equivalence at all 200 points.
- No v0.1 transaction exists on a public chain, by design.

**Confidence:** High for the changed coordinator and frozen first-call grid; medium for general economic applicability; no production-readiness conclusion.
