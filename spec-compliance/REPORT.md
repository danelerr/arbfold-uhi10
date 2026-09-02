# ARBFOLD — final spec-to-code compliance

**Technical release before the source-verification addendum:** `8f323fcbc2c4e50642a0b61503f5565614e51ffa`
**Publication binding:** `scripts/submission-preflight.mjs` requires the public
Pages bundle, manifest, README and benchmark to match the reviewed local
release, and requires the peeled `uhi10-submission` tag to equal public `main`.
**Specifications:** `README.md`, `docs/JUDGE_GUIDE.md`,
`docs/RELEASE_EVIDENCE.md`, `docs/LIVE_DEMO_GUIDE.md`, `docs/submission/*`.

## Executive verdict

The central proof-of-concept result is real and reproducible. I could not
refute the controlled first-call benchmark: canonical 100k measures `544219`
versus `375171` total gas (`31.062495%`), with the same user output, same fixed
external-recipient reward, zero residual and equivalent six-reserve final
state. The original >=10% LP-net-value thesis remains rejected, steady-state
telemetry gas remains explicitly unmeasured, and neither production safety nor
universal gas savings is claimed.

The public Unichain Sepolia deployment is also real. `npm run check:live`
passed against chain 1301 and exercised nine exact runtime size/hash identities,
official PoolManager binding, coordinator/router/token/hook bindings, decoded
canonical events, historical pre/post reserve snapshots, current state and a
fresh end-to-end dry-run. Uniswap's primary deployment feed independently lists
the same active manager.

Source provenance is now independently public: `npm run check:sources`
requires Sourcify creation and runtime matches for the coordinator, three
hooks, router and three tokens. The manifest binds each role to its address,
contract identifier, creation transaction and Sourcify repository URL.

All previously reproduced technical gaps are closed: lossless reserve
strings/`BigInt`, reserve-side mutation rejection, served benchmark hashing,
public bundle/manifest/README alignment, manager and nine runtime identities,
canonical receipt semantics and snapshots, both Forge profiles in
`video-proof`, active submission-tag links and the 4:15 runbook/SRT timeline.

The frozen `uhi10-submission` tag is part of the final release gate: the public
preflight resolves the remote tag directly, peels annotated tags and requires
its commit to equal public `main`. The remaining external artifact is the
human-recorded video and public URL; strict mode correctly blocks on that
placeholder.

## Verdict summary

| Verdict | Count | Requirements |
|---|---:|---|
| `implemented` | 12 | REQ-01–10, REQ-12–13 |
| `absent` | 1 | REQ-11 |
| `partial` | 0 | — |
| `contradicted` | 0 | — |
| `stronger-than-spec` | 0 | — |
| `undecidable` | 0 | — |

## Findings by severity

### Medium — final human video pending (`absent`)

`docs/submission/FINAL_SUBMISSION.md:L23` contains
`[DANIEL: paste final public video URL]`; no public video URL or video file was
found. Release evidence and the checklist honestly mark it pending. Local
strict preflight exits 2 with `STATUS BLOCKED_BY_MANUAL_FIELDS`.

No Critical, High or additional Medium/Low divergence survived refutation.

## Corrections independently confirmed

| Earlier gap | Current enforcement | Verdict |
|---|---|---|
| Imprecise reserve numbers/trusted tolerance | canonical decimals and `BigInt` delta at `app/benchmark-core.js:L213-L236,L391-L399,L495-L511` | corrected |
| Reserve mutation passed publication consumers | prior `10^12`-wei mutation is rejected by validator, video proof and preflight; 100 mutation fixtures pass | corrected |
| Served benchmark not fetched | schema validation and exact SHA at `scripts/submission-preflight.mjs:L167-L191` | corrected |
| Public artifacts stale | public/local manifest, benchmark and README hashes are identical | corrected |
| PoolManager checked only for code | frozen official-address gate plus live coordinator/router manager reads | corrected |
| Manager omitted from runtime identities | nine targets at `app/live-core.js:L5-L17,L85-L125` | corrected |
| Canonical receipt checked only for status | exact sender/router/block/event/value checks at `scripts/check-live-demo.mjs:L95-L121` | corrected |
| Canonical snapshots absent | lossless block `N-1`/`N` comparisons at `scripts/check-live-demo.mjs:L153-L200` | corrected |
| `video-proof` used one profile | default and release profiles at `scripts/video-proof.sh:L52-L59` | corrected |
| Runbook/SRT timing drift | both use the 4:15 sequence | corrected |
| Active dashboard used historical links | active links use the frozen `uhi10-submission` release | corrected |

## Claims that survived attempted refutation

| Claim | Verdict | Evidence |
|---|---|---|
| One routed swap can invoke one fold containing multiple direct rounds | `implemented` | `ArbFoldHook.sol:L72-L83`; `ArbFoldCoordinator.sol:L130-L159`; `ArbFoldRouter.sol:L58-L115` |
| Canonical 31.06% paired benchmark | `implemented` | v5 raw canonical row; generator `--check` PASS |
| Exact output/reward and reserve equivalence | `implemented` | Forge assertions plus lossless JS/Python validators |
| 1k–4k regression and 196/196 actionable boundary | `implemented` | raw dense sweep, report and consumer-derived summary |
| No steady-state telemetry claim | `implemented` | explicit unmeasured disclosure; legacy matrix rejected |
| 82 tests in both profiles | `implemented` | `make video-proof`: 82/82 default and 82/82 release |
| Public deployment and canonical semantics | `implemented` | `check:live` PASS and immutable receipt reconstruction |
| Published project source | `implemented` | Sourcify creation/runtime match for 8/8 active ARBFOLD contracts |
| Official PoolManager | `implemented` | frozen binding plus current Uniswap primary feed |
| Technical Unichain integration | `implemented` | chain-1301 deployment/dry-run; no endorsement claim |
| Rejected economic thesis remains rejected | `implemented` | README research-integrity section and reassessment |

## Reproduced checks

| Check | Result |
|---|---|
| Benchmark generator `--check` | PASS; six gates true |
| `npm run test:dashboard` | PASS, 34/34; 100 mutation fixtures |
| Prior reserve-tampering fixture | rejected by all three publication consumers |
| `make video-proof` | PASS; 82/82 in both profiles |
| Research checksums | all OK |
| `npm run check:live` | PASS; nine runtimes, bindings, receipt, snapshots and dry-run |
| `npm run check:sources` | PASS; 8/8 active project contracts match creation and runtime source on Sourcify |
| Public manifest SHA-256 | exact local/public equality enforced by public preflight |
| Public benchmark SHA-256 | local/public `47cc0aa7edf2f662204af262344e51c6122d6ffaea398cbf2309ed1e6feaf3c1` |
| Public README SHA-256 | exact local/public equality enforced by public preflight |
| Pages and GitHub verification | required to pass on the complete submission commit before final form submission |
| Public submission tag gate | resolves remote `main` and the peeled `uhi10-submission` ref with `git ls-remote`; requires exact commit equality without REST rate-limit dependence |
| Local strict preflight | expected exit 2: missing video URL |

The mutable current state observed during the live check was `foldCalls=6`,
`foldRounds=11`, residual `480566246567`; it is deliberately distinct from the
immutable canonical snapshot and controlled benchmark.

## Deliberate documented limits

- Gas evidence is a controlled Foundry first-call benchmark, not a live-chain
  fee comparison; its reference uses a test-only harness.
- The testnet is mutable; current counters/reserves need not equal the canonical
  snapshot.
- The official manager is frozen to the deployment-time address; this audit
  separately confirmed Uniswap still lists it active.
- Sourcify source verification covers all eight active ARBFOLD contracts; the
  official third-party PoolManager is still established by its frozen official
  address/runtime rather than claimed as project-owned verified source.
- The SRT is a template that must be retimed to the final human narration.
- The project is research-only, unaudited and not production-authorized.

## Coverage limits

This was spec-to-code/evidence verification, not a fresh general vulnerability
audit, an economic proof outside the published domain, or validation of the
human video that does not yet exist. UHI eligibility and novelty were not
independently adjudicated. No scoped specification was unreadable.
