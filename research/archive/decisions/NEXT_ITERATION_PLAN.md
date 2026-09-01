# ARBFOLD — Absolute Improvement Plan

> **Archived execution plan.** The public Unichain Sepolia deployment, proof
> panel and Progress Update 1 are complete. Historical pending language and
> earlier 18.86% planning numbers below are retained only as a dated work
> record. The current sources of truth are [`RELEASE_EVIDENCE.md`](../../../docs/RELEASE_EVIDENCE.md),
> [`FINAL_SUBMISSION.md`](../../../docs/submission/FINAL_SUBMISSION.md) and the root README. No further
> Progress Update 1 action is required.

**Project ID:** `HK-UHI10-1057`  
**Registered project:** MATURE  
**Current project:** ARBFOLD  
**Plan date:** 2026-08-24  
**Final Hookathon deadline:** 2026-09-03 23:59 PDT  
**Baseline repository commit:** `0d37646`  
**Decision:** improve and present ARBFOLD; do not reopen ideation.

> **Execution update — 2026-08-24:** Workstreams C, D and G are complete on
> release source commit `9cbc16e`. The delivered benchmark is now **19.12%
> less gas at 100k**, with a **0.98% regression at 25k**. The local deployment,
> canonical demo, enriched manifest and verifier pass; the current official
> Unichain Sepolia manager path also simulates successfully. The 23-step public
> CI run `32694495752` passed. Public broadcast, explorer links, video and
> manual submission remain pending.

## Executive decision

ARBFOLD already satisfies the threshold for submitting Progress Update 1:

- public repository;
- functional Uniswap v4 hook;
- real `PoolManager` integration in Foundry;
- custom accounting and ERC-6909 claim settlement;
- reproducible tests and CI;
- published dashboard;
- a clean-core benchmark with an honest, workload-dependent result.

The progress update should be submitted **now**, after Daniel's final review. A public testnet deployment is not required to justify that progress update and must not delay it.

The next iteration is not a new mechanism. It is a **submission release candidate** whose objective is:

> Turn the current research result into a public, end-to-end and immediately understandable UHI10 demonstration, while closing the highest-risk custom-accounting test gaps.

The order of work is deliberate:

1. preserve the current research record;
2. submit Progress Update 1;
3. prove the delivered contracts on a public testnet;
4. expand security and integration evidence;
5. connect the dashboard to public evidence;
6. freeze, record and submit.

No optimizer, auction, oracle, new fee mechanism, arbitrary cycle network or sponsor integration belongs in this iteration.

## Canonical product statement

### One sentence

> ARBFOLD lets three cooperating Uniswap v4 custom-curve pools reach the same specialized post-arbitrage state as a three-leg atomic backrun plus profit reinjection by applying a verified direct transition to their PoolManager-backed reserves.

### Public headline

> **Same outcome. Same user output. Same solver reward. 18.86% less gas at the canonical 100k benchmark.**

This must always be followed by the workload qualifier:

> **The result is workload-dependent: 4.21% less gas at 10k, 1.13% more at 25k, and 18.86% less from 50k through 200k in the fixed publication grid.**

### Claims that remain allowed

- Specialized direct reserve transition for three hook-owned CPMMs.
- Originating user output is unchanged in the frozen comparison.
- Solver reward is equal in both comparison paths.
- Final reserve states match within the preregistered one-wei tolerance.
- PoolManager backing is exact in the tested implementation.
- No participating invariant decreases in accepted transitions.
- Residual cyclic profit is zero in the canonical published case.
- Published clean-core gas is 18.86% lower at the canonical 100k workload.
- The direct path is cheaper in four of the five fixed workload points and more expensive at 25k.
- This is a research-grade UHI10 execution primitive.

### Claims that remain prohibited

- ARBFOLD is always cheaper.
- ARBFOLD creates at least 10% more LP value.
- ARBFOLD is economically superior by construction.
- ARBFOLD implements the paper's global convex optimum.
- ARBFOLD solves all MEV, LVR, arbitrage or ordering.
- ARBFOLD attaches to existing v4 pools.
- ARBFOLD is audited, production-ready or authorized for mainnet deposits.
- The historical 39.58% minimal-harness result describes the delivered clean core.

## Baseline evidence and remaining gaps

| Area | Evidence today | Remaining gap |
|---|---|---|
| Functional core | `ArbFoldHook`, coordinator and router execute against a real local `PoolManager`. | No public-chain transaction proves the complete delivered path. |
| Mechanical equivalence | Five fixed workloads compare direct execution with atomic backrun plus reinjection. | Fixed reserves and a narrow originating path dominate the comparison. |
| Accounting | Claims equal virtual reserves; aggregate underlying backing is checked. | The stateful handler only exercises one hook in one direction. |
| Fuzzing | 512 fuzz cases and 4,096 calls per invariant property in the default profile. | It does not cover all three origin pools, both directions or broad reserve distributions. |
| Access control | Fixed coordinator, one-time network binding and caller checks exist. | Several negative configuration and callback cases are not explicit tests. |
| Arithmetic | Checked Solidity arithmetic, `mulDiv`, normalization and differential comparison exist. | Accepted numeric domains and precision loss are not specified or exhaustively tested. |
| CI | Build, formatting, core tests, frozen benchmark, research integrity and high-severity Forge lint run. | No deployment smoke test, coverage artifact, Slither job or extended fuzz profile. |
| Deployment | `DeployArbFold.s.sol` deploys a full demo network and succeeds in local simulation after a clean build. | CI does not execute it; it deploys a fresh manager by default and emits no machine-readable manifest. |
| Dashboard | Public, fast and honest about the 25k regression. | It visualizes static benchmark JSON; it does not show public onchain evidence. |
| Submission | README, judge guide, limitations, threat model and demo script exist. | Video, testnet proof, release tag and final form remain pending. |

## Evidence-based maturity scorecard

This is a research-build assessment, not a mainnet audit. Ratings use the Trail of Bits-style four-level maturity scale.

| Category | Rating | Evidence and reason |
|---|---:|---|
| Arithmetic | 2/4 | Checked arithmetic and fuzzing exist, but `CycleMath` has large intermediate products, the reserve domain is implicit and precision is not compared across broad states. |
| Auditing and monitoring | 2/4 | Critical configuration, fold and reserve events exist; there is no monitoring schema, alerting or incident runbook. |
| Authentication and access control | 2/4 | PoolManager callback checks, fixed coordinator and one-time configuration are sound for the research scope; negative-path coverage and role documentation are incomplete. |
| Complexity management | 3/4 | The network is intentionally fixed and functions are reasonably scoped; custom accounting, claim transfers and two benchmark paths remain intrinsically complex. |
| Decentralization | 3/4 | There is no proxy or mutable fee/reward governance; the only admin action is one-time configuration. Deployment ownership and LP exit/liveness still need clearer treatment. |
| Documentation | 3/4 | README, architecture, limitations, threat model, judge guide and immutable failed claims are strong. A testnet manifest, arithmetic domain specification and exact operational runbook are missing. |
| Transaction ordering | 2/4 | Atomic execution, deadline and slippage protection exist. Priority against competing searchers is explicitly unresolved and has no ordering simulation. |
| Low-level manipulation | 4/4 | Project code avoids assembly and uses established v4/OpenZeppelin abstractions; the direct path is differentially checked against a high-level reference path. |
| Testing and verification | 2/4 | CI, fuzzing, invariants and differential tests are meaningful. Coverage currently cannot be generated, deployment is absent from CI, and path coverage is incomplete. |

**Current overall maturity: 2.6/4.0 — moderate to satisfactory for a research Hookathon build, not production maturity.**

The fastest route to a stronger submission is not to force every category to 4/4. It is to raise **testing, deployment evidence and judge accessibility** without changing the mechanism.

## Critical findings that drive the plan

### P0-01 — No public end-to-end proof

The local implementation is real, but a judge cannot currently open an explorer and verify:

- deployed hook permission bits;
- network configuration;
- an originating swap;
- `FoldRound` and `FoldCompleted` events;
- resulting reserve and ERC-6909 claim state.

This is the largest presentation gap and the closest analogue to the Justito lesson: strong internal evidence is not enough when the visible product does not expose it.

### P0-02 — Deployment is not a release-tested artifact

`DeployArbFold.s.sol` successfully simulated a full network after `forge clean && forge build`, but:

- the deployment script is not run in CI;
- no post-deployment assertion script exists;
- no deployment JSON is produced;
- no demo transaction script exists;
- no explorer verification procedure is automated;
- a stale build artifact initially produced `No contract bytecode`, which a clean compile corrected.

The deployment path must become reproducible evidence, not a README promise.

### P0-03 — Stateful testing covers one of six swap paths

The current invariant handler repeatedly calls only:

```text
hookAB
zeroForOne = false
```

The fixed network exposes six origin/direction combinations:

```text
AB 0→1
AB 1→0
BC 0→1
BC 1→0
AC 0→1
AC 1→0
```

Claims of network-level backing and residual control need a handler that explores all six.

### P0-04 — Coverage is unknown, not merely unpublished

`forge coverage` currently compiles but fails during Solar analysis because core imports are borrowed through the nested frozen-benchmark submodule and relative imports are not resolved by the coverage analyzer. Therefore:

- no percentage should be claimed;
- the form's conservative 50–80% answer remains the honest choice today;
- dependency layout or the coverage toolchain must be fixed before adding a badge.

### P0-05 — No independent static analysis

CI runs only `forge lint --severity high`. Slither, a second static analyzer and mutation testing are absent. This matters because `beforeSwapReturnDelta`, hook-owned liquidity and ERC-6909 operator transfers are high-consequence surfaces.

### P0-06 — Numeric domain is implicit

The main unresolved arithmetic questions are:

- overflow in `amountIn * GAMMA` and reserve products;
- overflow before `_normalize` in the closed-form composition;
- `sqrt(a * b)` domain;
- one-wei rounding equivalence beyond the frozen reserve configuration;
- behavior near zero reserves, the residual threshold and `MAX_ROUNDS`;
- proportional full withdrawal and a zero-reserve network.

Checked arithmetic prevents silent corruption, but a revert boundary is not yet a documented supported domain.

### P0-07 — Dashboard is a benchmark viewer, not a protocol demo

The current site is useful and visually strong, but it cannot show a public transaction or live state. The final site needs a minimal “Onchain proof” layer without becoming a full trading application.

### Resolved — Focused repository surface

On 2026-08-24, abandoned local project artifacts were removed and the useful ARBFOLD documents were consolidated under `docs/`. The root now contains only the project entry files and active ARBFOLD directories. Frozen ARBFOLD reports and benchmark evidence remain unchanged.

## Change-control rules

These rules apply from this plan onward.

1. Preserve commit `6dd7946`, the frozen v0 report and the clean-core report unchanged.
2. Perform submission hardening on a dedicated branch, for example `release/uhi10-rc1`.
3. No change to `contracts/src` is “documentation-only” for benchmark purposes.
4. After any `contracts/src` change, rerun the full clean-core grid and write a **new** release-candidate report. Never overwrite an earlier report.
5. Publish the delivered commit's number, even if gas performance falls.
6. Show the full five-point grid, including regressions.
7. Do not tune a threshold after observing a release-candidate result.
8. Tag the final reviewed commit; the video, dashboard, manifest and submission must all point to that tag.
9. Do not add an external integration merely to qualify for another prize.
10. Testnet tokens must remain obviously named and documented as valueless demo assets.

## Workstream A — Progress Update 1 completed

**Status:** complete; no further action required.

### Actions

1. Use Project ID `HK-UHI10-1057`.
2. Keep the registered-name history explicit:

   ```text
   Registered as MATURE; pivoted through preregistered experiments to ARBFOLD.
   ```

3. Link directly to:

   - public repository;
   - live dashboard;
   - `ArbFoldHook.sol`;
   - `ArbFoldCoordinator.sol`;
   - `ArbFoldCleanCoreBenchmark.t.sol`;
   - clean-core report;
   - green CI run.

4. State the canonical 18.86% result and the 25k regression in the same answer.
5. Do not wait for testnet deployment or video.

### Gate A

- [x] Completed and removed from the active release path.

## Workstream B — Make deployment a tested product path

**Priority:** P0  
**Target:** 2026-08-25 to 2026-08-26  
**Estimated focused effort:** 6–10 hours

### B1. Separate local and public deployment modes

Refactor the deployment tooling, not the mechanism:

```text
LocalDemo
→ deploy a fresh PoolManager
→ deploy demo tokens, coordinator, hooks and router
→ seed the network

PublicTestnet
→ use an explicitly supplied PoolManager
→ deploy demo tokens, coordinator, hooks and router
→ seed the network
```

The public deployment should first target **Unichain Sepolia (chain ID 1301)** and the official v4 `PoolManager` address published by Uniswap. The address must be read again from the official deployments page at execution time, not copied blindly from this plan.

Official source: <https://developers.uniswap.org/docs/protocols/v4/deployments>

### B2. Add three scripts

#### `DeployArbFold.s.sol`

- accepts `POOL_MANAGER` and `USE_EXISTING_MANAGER`;
- refuses a zero or code-less external manager;
- logs chain ID, deployer, dependency commit and every address;
- validates each mined hook permission mask;
- configures and authorizes all hooks;
- seeds liquidity;
- writes or emits enough information to build a manifest.

#### `VerifyArbFoldDeployment.s.sol`

Read-only assertions:

- coordinator points to the expected manager and tokens;
- all three pool keys have the correct currencies and hooks;
- hook flags match declared permissions;
- hooks point to the fixed coordinator;
- coordinator recognizes exactly the three hooks;
- each virtual reserve equals the hook's ERC-6909 claim balance;
- PoolManager underlying balances back total claims;
- all reserves are positive;
- `quote()` succeeds;
- no unexpected operator or mutable configuration is present.

#### `RunArbFoldDemo.s.sol`

- mints or funds a test user;
- approves the router;
- records pre-state;
- executes one canonical exact-input swap;
- records output, solver reward, fold rounds, final reserves and residual;
- re-runs backing and invariant assertions;
- prints the transaction hash and explorer-ready evidence.

### B3. Produce a deployment manifest

Store a versioned file such as:

```text
deployments/unichain-sepolia-1301.json
```

Required fields:

```json
{
  "chainId": 1301,
  "network": "unichain-sepolia",
  "gitCommit": "...",
  "dependencyCommit": "12048bb...",
  "officialPoolManager": "0x...",
  "deployer": "0x...",
  "coordinator": "0x...",
  "router": "0x...",
  "hooks": { "ab": "0x...", "bc": "0x...", "ac": "0x..." },
  "tokens": { "a": "0x...", "b": "0x...", "c": "0x..." },
  "deploymentTransactions": ["0x..."],
  "canonicalDemoTransaction": "0x...",
  "blockNumber": 0,
  "explorerBaseUrl": "https://sepolia.uniscan.xyz",
  "sourceVerification": "verified|partial|not-available",
  "researchOnly": true
}
```

No private key, RPC credential or secret belongs in this file.

### B4. CI deployment smoke test

CI must run the local deployment script from a clean build and then run the verifier. This closes the gap where unit tests pass but the public deployment artifact is broken.

### Gate B

- [x] A clean checkout can simulate the full deployment.
- [x] The deployment smoke test runs in CI.
- [x] The official Unichain Sepolia manager path is attempted first.
- [ ] At least one public canonical swap transaction exists.
- [ ] Every address and transaction is in the manifest.
- [x] Post-deployment checks prove reserve/claim/backing equality locally.
- [ ] Source verification status is honestly disclosed.
- [x] The current official manager path is compatible in simulation; fallback remains documented.

### Strict fallback

Timebox official-manager compatibility work to four focused hours.

If the pinned OpenZeppelin/v4 dependencies are incompatible with the current official manager:

1. do not upgrade core dependencies impulsively;
2. deploy the pinned fresh `PoolManager` on Unichain Sepolia;
3. label it everywhere as an **isolated research PoolManager**, not the official Uniswap deployment;
4. preserve explorer evidence and post-deployment backing checks;
5. open a post-Hookathon issue for official-manager compatibility.

The fallback still demonstrates a public EVM execution, but the official-manager path is materially stronger and remains the target.

## Workstream C — Close the custom-accounting security gaps

**Priority:** P0  
**Target:** 2026-08-26 to 2026-08-29  
**Estimated focused effort:** 10–16 hours

### C1. Unit-test every external state-changing entry point

Add explicit tests for:

#### Router

- zero input;
- input above signed-int domain;
- zero solver;
- expired deadline;
- unregistered hook;
- slippage revert and full rollback;
- direct unauthorized `unlockCallback`;
- malformed unlock payload;
- output sign invariant;
- no currency delta after success and after expected failure.

#### Hook

- exact-output rejection;
- malformed non-empty `hookData`;
- wrong fold mode;
- zero solver in hook data;
- swap with empty hook data;
- unauthorized `setReservesFromCoordinator`;
- zero reserve update rejection;
- idempotent coordinator authorization;
- direct PoolManager liquidity modification rejection;
- second initial funding rejection;
- zero-sided funding rejection;
- partial and full withdrawal behavior;
- unsupported zero-reserve lifecycle documented or guarded.

#### Coordinator

- non-admin configuration;
- double configuration;
- zero, duplicate and code-less hooks;
- wrong coordinator, manager, currency order or pool key;
- unauthorized fold;
- zero solver;
- zero-op/no-arbitrage fold;
- forward and reverse quote selection;
- solver reward cap and exact transfer;
- conservation failure path in a dedicated harness;
- invariant decrease rejection in a dedicated harness;
- `MAX_ROUNDS` behavior and residual disclosure.

#### Deployment

- all three addresses validate permission bits;
- all initial reserves equal claims;
- coordinator operators are active;
- code sizes remain below EIP-170 limits;
- local deployment and verification scripts execute from a clean build.

### C2. Expand fuzzing across the network

Create a six-path stateful handler that chooses:

```text
origin ∈ {AB, BC, AC}
direction ∈ {0→1, 1→0}
amount ∈ supported domain
solver ∈ bounded nonzero actors
```

The handler must provision and approve the correct input token for each path.

Required invariant properties:

1. every virtual reserve equals its corresponding ERC-6909 claim;
2. PoolManager underlying balances exactly cover aggregate claims plus solver claims;
3. token totals are conserved modulo explicitly transferred solver reward;
4. no accepted fold transition decreases any participating invariant;
5. every successful unlock ends with zero currency deltas;
6. total solver rewards equal observed solver claim increases;
7. configuration never changes after initialization;
8. the router cannot spend a payer's tokens beyond the exact swap settlement;
9. a reverted swap leaves reserves, claims and counters unchanged;
10. residual behavior is reported consistently when the round cap is reached.

Profiles:

| Profile | Purpose | Minimum |
|---|---|---:|
| PR | Fast feedback | current 512 fuzz; 128 × 32 invariant |
| Nightly/release | Broad domain | 10,000 stateless fuzz cases; at least 20,000 aggregate stateful calls |
| Arithmetic-only | Reserve/rounding domain | 50,000 pure `CycleMath` cases |

### C3. Specify the arithmetic domain

Add `docs/ARITHMETIC_SPEC.md` that defines:

- supported token decimals for the research build;
- maximum initial reserve and swap input;
- units of every `Network`, `Quote` and reward field;
- exact fee rounding direction;
- exact solver reward rounding direction;
- why every cast is safe or where it reverts;
- overflow bounds for every pre-normalization multiplication;
- acceptable one-wei differential tolerance;
- residual threshold units and rationale;
- full-withdrawal and zero-reserve semantics.

Then enforce the chosen domain through explicit guards or prove the current casts/products cannot leave it. A documented bound without code or tests is insufficient.

### C4. Differential math testing

Implement a high-precision reference in Python or Foundry using larger/rational arithmetic and compare:

- `swapOut`;
- optimal input;
- forward and reverse quotes;
- intermediate transfers;
- final reserves;
- solver reward;
- residual profit.

Record maximum absolute and relative rounding error over the frozen domain.

### Gate C

- [x] All six origin/direction paths are exercised.
- [x] Release fuzz profile passes with saved seed `0x1057`.
- [x] Every public state-changing entry point has positive and negative tests.
- [x] Arithmetic domain and units are documented.
- [x] Differential rounding results are published.
- [x] No accepted transition causes backing or conservation drift.
- [x] Core changes have a new release report and deterministic source manifest.

## Workstream D — Add independent verification tooling

**Priority:** P0/P1  
**Target:** 2026-08-28 to 2026-08-29  
**Estimated focused effort:** 4–8 hours

### D1. Fix coverage reproducibility

The coverage failure is caused by analyzing core imports through the nested frozen-benchmark submodule. The preferred fix is to give `contracts/` its own pinned dependency path at the same OpenZeppelin commit, so the clean core no longer imports production dependencies through `../benchmark/...`.

Constraints:

- keep the frozen benchmark submodule and hashes untouched;
- pin the clean-core dependency to the same reviewed commit initially;
- do not change compiler, optimizer or EVM settings for the published gas comparison;
- use a separate coverage profile if the coverage engine requires different compilation settings.

Coverage acceptance target for project-owned `contracts/src` code:

- at least 90% reachable line coverage;
- at least 85% reachable branch coverage;
- every uncovered branch listed and justified;
- report uploaded as a CI artifact.

These are release-quality targets, not claims to be made before the report exists.

### D2. Run Slither

Add a pinned Slither job scoped to project-owned code with dependency paths filtered from the report.

Gate:

- zero unacknowledged high-severity findings;
- zero unacknowledged medium-severity findings in reserve, claim, callback or authorization logic;
- false positives documented with file/line and rationale;
- analyzer version pinned in CI.

### D3. Promote relevant Forge warnings

Current high-severity lint passes, but lower-severity warnings include integer casts. For every cast in project-owned source:

- replace it with a checked helper where useful; or
- add a local assertion/guard; or
- document why the preceding condition makes it safe.

Do not silence warnings without a proof comment and test.

### D4. Optional mutation test

Only after P0 gates pass, run a narrowly scoped mutation campaign against:

- conservation checks;
- invariant monotonicity;
- caller authentication;
- solver reward calculation;
- backing assertions.

This is optional before submission. It must not delay testnet evidence or the video.

### Gate D

- [x] Coverage command works from the independent pinned dependency path.
- [x] Coverage report is configured as a required CI artifact.
- [x] Slither has no unresolved high/medium issue on critical accounting.
- [x] Every project-owned unsafe cast is proved, guarded or changed.

## Workstream E — Turn the dashboard into an end-to-end demo

**Priority:** P0  
**Target:** 2026-08-27 to 2026-08-30  
**Estimated focused effort:** 8–12 hours

The current benchmark dashboard remains the first screen. Add one compact section, not a separate product.

### E1. “Public onchain proof” panel

It must load without a wallet and show:

- network and chain ID;
- official or isolated PoolManager label;
- deployed coordinator/router/hooks;
- canonical demo transaction;
- transaction status and block;
- `SwapAndFold`, `FoldRound` and `FoldCompleted` summary;
- pre/post reserves;
- solver reward;
- residual profit;
- links to explorer and source commit;
- a prominent `Research deployment — no real assets` notice.

Judges must get value without acquiring testnet ETH.

### E2. Optional “Run it” interaction

If reliable within the timebox:

1. connect wallet;
2. switch to Unichain Sepolia;
3. mint valueless demo input token;
4. approve the router;
5. execute an exact-input swap;
6. show the transaction and refreshed state.

Use a pinned app dependency and committed lockfile if `viem` or another client library is introduced. The UI must never handle or request a private key.

### E3. Demo fallback

If wallet execution is not stable by 2026-08-30:

- keep the read-only public proof panel;
- show the already mined canonical transaction;
- retain the local `forge script` reproduction command;
- record the video from the stable path.

A reliable read-only public proof is better than a flaky wallet button.

### Gate E

- [x] Site was inspected locally on desktop and a 390×844 mobile viewport.
- [ ] Public evidence loads without a wallet.
- [ ] Every explorer link is correct.
- [x] The 25k regression remains visible and interactive.
- [x] Historical 39.58%, earlier 18.86% and delivered 19.12% remain separated.
- [x] The dashboard has no write path and labels all demo assets valueless.
- [x] The first 30 seconds explain problem, two paths and measured result.

## Workstream F — Make the repository judge-first

**Priority:** P1  
**Target:** 2026-08-29 to 2026-08-31  
**Estimated focused effort:** 3–6 hours

### F1. Put evidence above research history

The first README viewport should contain, in this order:

1. one-sentence problem;
2. canonical result plus workload qualifier;
3. live demo;
4. public transaction;
5. exact hook/coordinator/router links;
6. one-command verification.

The research integrity section remains, but it must not make a judge read three dead mechanisms before seeing ARBFOLD work.

### F2. Add commit-pinned permalinks

Final submission links must point to the final tag or commit, not mutable `main`, for:

- hook callback;
- coordinator direct transition;
- router unlock settlement;
- six-path invariant handler;
- deployment script;
- post-deployment verifier;
- clean-core benchmark;
- threat model;
- deployment manifest.

### F3. Keep the repository ARBFOLD-only

- keep the root limited to `README.md`, `LICENSE`, `Makefile` and active project directories;
- do not reintroduce abandoned simulations or unrelated research bundles;
- preserve the immutable ARBFOLD freeze reports and benchmark evidence;
- keep generated build outputs ignored and regenerate them through documented commands.

### F4. Add a release evidence index

Create `docs/RELEASE_EVIDENCE.md` containing:

- final commit and tag;
- CI URL;
- dashboard URL;
- video URL;
- testnet manifest;
- canonical transaction;
- test counts and exact profiles;
- coverage report;
- Slither report;
- clean-core report/hash;
- known limitations;
- submission timestamp.

### Gate F

- [ ] A judge can reach all critical evidence in two clicks or fewer.
- [ ] All code links are commit-pinned.
- [ ] Root presentation is unmistakably ARBFOLD.
- [ ] Archived research remains transparent but secondary.
- [ ] No broken relative or public links.

## Workstream G — Re-freeze the delivered release candidate

**Priority:** P0  
**Target:** 2026-08-30  
**Estimated focused effort:** 3–5 hours

Any safety hardening that changes `contracts/src` invalidates the assumption that 18.86% still describes the delivered code.

### Release freeze inputs

- exact final `contracts/src` tree hash;
- compiler `0.8.26`;
- Foundry `1.5.1` for benchmark continuity;
- Cancun EVM;
- optimizer enabled, 200 runs;
- same five workloads;
- same initial states;
- same user output and solver reward model;
- same total-gas accounting;
- same one-wei state tolerance;
- full warm/cold-state methodology documented.

### Required outputs

```text
benchmark/release-candidate-results/
├── REPORT.md
├── raw.json
├── forge-test.txt
├── gas-snapshot.txt
├── source-manifest.sha256
└── environment.json
```

### Gate G

- [x] Mechanical equivalence passes at all five workloads.
- [x] Full gas grid is published, including the 25k regression.
- [x] Claims/reserves/backing are exact.
- [x] User output and solver reward remain equal.
- [x] Headline uses source commit `9cbc16e` and its 19.12% result.
- [x] Earlier reports remain immutable and linked.

There is no preregistered requirement that the final hardening must preserve 18.86%. If it becomes 16%, publish 16%. If 25k becomes worse, publish that too.

## Workstream H — Video and final submission

**Priority:** P0  
**Target:** record by 2026-08-31; submit by 2026-09-02  
**Estimated focused effort:** 6–10 hours including rehearsals

### Video structure: 3:30–4:15

```text
0:00–0:20  The problem in plain language
0:20–0:55  Conventional backrun versus fold
0:55–1:35  Public testnet transaction and events
1:35–2:15  Exact v4 code: hook, claims, coordinator, unlock
2:15–2:50  Tests, backing and invariant evidence
2:50–3:25  Full gas grid, including 25k regression
3:25–3:50  What failed and what is not claimed
3:50–4:05  Close with the canonical delivered result
```

### Presentation rules learned from Justito

- Use a real human voice.
- Show the working artifact before the threat model.
- Explain “three swaps versus one verified transition” before using `ERC-6909` terminology.
- Put the public transaction on screen.
- Make the output, reward, reserves and gas comparison visible together.
- Do not spend the first minute on preregistration history.
- Mention the failed economic claim once, clearly, after the core result is understood.
- End with a specific takeaway, not a list of security properties.

### Final-form evidence

Use Project ID `HK-UHI10-1057` consistently in both progress updates and final submission. Explain the name pivot once rather than pretending the original MATURE description never existed.

The final form should link directly to:

- repository tag;
- hook source;
- coordinator source;
- router source;
- tests/invariants;
- deployment manifest;
- explorer transaction;
- dashboard;
- video;
- limitations/threat model.

### Gate H

- [ ] Video is under five minutes.
- [ ] Audio is clear and human-recorded.
- [ ] Video shows a real public transaction or the stable public proof panel.
- [ ] Every number matches the final release report.
- [ ] No prohibited claim appears in narration, captions or form.
- [ ] Final form is reviewed once from a judge's perspective.
- [ ] Submit by 2026-09-02, leaving September 3 as emergency buffer only.

## Calendar

| Date | Non-negotiable outcome |
|---|---|
| **Aug 24** | Review and submit Progress Update 1; tag current progress state. |
| **Aug 25** | Deployment modes, manifest schema and clean deployment smoke test. |
| **Aug 26** | Attempt official Unichain Sepolia manager; obtain first public deployment/transaction or invoke documented fallback. |
| **Aug 27** | Public proof panel reads deployment manifest and explorer evidence. |
| **Aug 28** | Six-path fuzz/invariant handler and entry-point negative tests. |
| **Aug 29** | Arithmetic spec, coverage fix and Slither report. |
| **Aug 30** | Release-candidate freeze and complete rerun of benchmark/evidence. |
| **Aug 31** | Video rehearsal, record and first full submission dry run. |
| **Sep 1** | Independent link/content review; fix only release blockers. |
| **Sep 2** | Final submission. |
| **Sep 3** | Emergency buffer; no planned feature work. |

If work slips, cut in this order:

1. mutation testing;
2. interactive wallet execution, while retaining read-only public proof;
3. repository archive reorganization;
4. cosmetic dashboard changes.

Never cut:

- progress update submission;
- public transaction evidence;
- all-six-path accounting tests;
- release benchmark rerun after core changes;
- honest workload qualifier;
- video and final submission buffer.

## Release command

Create a single command before the release freeze, for example:

```bash
make verify-release
```

It should run, from a clean checkout:

```text
format check
clean build
unit tests
all-path fuzz tests
stateful invariants
clean-core equivalence grid
frozen historical benchmark integrity
Python research-integrity checks
deployment simulation
post-deployment assertions
high-severity lint
Slither
coverage generation
source manifest hashing
```

The command must fail closed. A missing analyzer, missing submodule or missing report is a failure, not a skipped green check.

## Absolute definition of done

ARBFOLD is ready for final submission only when all of the following are true:

### Mechanism integrity

- [x] No new economic mechanism was added.
- [x] User output and solver reward match the reference path.
- [x] Final reserves match the reference within the frozen tolerance.
- [x] Every accepted transition preserves token totals and non-decreasing invariants.
- [x] Every PoolManager unlock finishes with zero deltas.

### Security evidence

- [x] All six swap origin/direction paths are fuzzed.
- [x] Critical external entry points have negative tests.
- [x] Release fuzz/invariant profile passes.
- [x] Arithmetic domain and rounding error are documented.
- [x] Coverage is measured and published.
- [x] Slither has no unresolved critical accounting issue.

### Public proof

- [x] Testnet deployment manifest exists.
- [x] At least one canonical public transaction is final.
- [x] Explorer links and source verification status are public.
- [x] Post-deployment reserve/claim/backing verification passes.
- [x] Dashboard exposes the proof without requiring a wallet.

### Research integrity

- [x] The 10% LP-value hypothesis remains marked killed.
- [x] Historical 39.58% and delivered-core numbers remain separated.
- [x] The complete workload grid is visible.
- [x] No result was overwritten after observation.

### Submission quality

- [x] Root README gives the result, demo and code in the first viewport.
- [ ] Critical links are pinned to the final commit.
- [ ] Video is under five minutes and understandable in 30 seconds.
- [x] Project ID is `HK-UHI10-1057` in the submission evidence.
- [ ] Final submission is sent no later than September 2.

## Explicit post-Hookathon backlog

These are legitimate research directions, but they are forbidden before the UHI10 final submission unless a P0 gate exposes a direct dependency:

- global optimizer from the defensive-rebalancing paper;
- arbitrary cycle lengths or dynamic pool registration;
- solver auction or competitive reward discovery;
- private ordering, PBS or builder integration;
- historical frequency/profitability study on real pool networks;
- production token adapters and nonstandard-token support;
- governance, upgradeability or cross-chain coordination;
- mainnet deployment;
- formal verification and independent audit;
- economic claims beyond the fixed specialized comparison.

## Source alignment

This plan was checked against the following current public sources on 2026-08-24:

- Atrium describes UHI10 as **Sustainable Liquidity & MEV Protection**, focused on value leakage and protocol-native MEV recapture: <https://blog.atrium.academy/uniswap-hook-incubator-2025-wrapped>
- The public 2026 schedule places UHI10 from August 17 through September 3, with Demo Day September 11: <https://atrium.academy/sponsors>
- Atrium describes the capstone as a custom hook presented to investors, researchers and builders: <https://atrium.academy/uniswap>
- Uniswap publishes current v4 deployment addresses, including Unichain Sepolia: <https://developers.uniswap.org/docs/protocols/v4/deployments>
- OpenZeppelin documents that `BaseCustomAccounting` uses hook-owned liquidity and that the hook is responsible for its accounting: <https://docs.openzeppelin.com/uniswap-hooks/base>
- OpenZeppelin labels `BaseCustomCurve` experimental and states that swaps use return deltas backed by liquidity held through the custom-accounting path: <https://docs.openzeppelin.com/uniswap-hooks/api/base>

## Final prioritization

```text
SUBMIT PROGRESS NOW
        ↓
PUBLIC TESTNET PROOF
        ↓
ALL-PATH ACCOUNTING TESTS
        ↓
STATIC + COVERAGE EVIDENCE
        ↓
CONNECTED/READ-ONLY DEMO
        ↓
RE-FREEZE DELIVERED CORE
        ↓
HUMAN VIDEO
        ↓
SUBMIT WITH 24H BUFFER
```

The project does not need another idea. It needs the strongest possible proof that the idea already implemented is real, reproducible, honestly bounded and easy for a judge to understand.
