# ARBFOLD thesis reassessment

**Date:** 2026-08-29  
**Repository state reviewed:** `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
**Delivered Solidity tree:** `53db6012988f770c06f784b6f0ad152ac844ae1a0dc8058e1f1dfd002b85c3f3`  
**Scope:** the frozen v0 gate, delivered release benchmark, Solidity source,
test suite, arithmetic differential, public deployment evidence and primary
external sources available on the review date.

This is a thesis and evidence audit, not a production security audit. The
per-function code-context record is maintained separately in
[`research/generated/audit-context/DOSSIER.md`](../../generated/audit-context/DOSSIER.md).

## Executive verdict

ARBFOLD has one strong, defensible result:

> **For the frozen three-pool, 30 bps CPMM construction, a direct backed-claim
> transition can reproduce the specialized final state of an atomic three-leg
> backrun plus identical profit reinjection, while using less EVM gas in four
> of five release workloads and 19.12% less at the preregistered 100k
> workload.**

That result is real, reproducible and relevant to Uniswap v4 custom accounting.
It is also narrower than several phrases used during the project's ideation.

ARBFOLD has **not** demonstrated:

- greater gross economic surplus than an equivalent backrun;
- greater onchain pool retention under the delivered fixed-reward policy;
- material LP-value improvement at plausible values in the frozen sensitivity;
- universal gas savings;
- historical frequency of economically relevant three-pool opportunities;
- forced capture when swaps bypass the dedicated router;
- a permissionless solver market;
- claim/reserve continuity for every caller-selected reward address;
- compatibility with existing v4 pools;
- the global optimizer from the defensive-rebalancing paper; or
- production safety or adoption viability.

The project is therefore best understood as a **research-grade execution
compression primitive**, not yet as a proven liquidity product.

### Canonical thesis after reassessment

> **Can three cooperating, hook-owned CPMMs replace a specific atomic cyclic
> backrun plus profit reinjection with a mechanically equivalent, verified
> reserve transition that costs less to execute?**

The frozen evidence answers:

```text
Mechanical equivalence in the fixed grid          YES
Canonical release EVM-gas reduction               YES: 19.12%
Cheaper in every release workload                  NO: 25k is 0.98% more
Different gross post-arbitrage economics           NO
More pool retention under the fixed reward         NO: identical by construction
At least 10% counterfactual LP-net uplift           NO
Historically frequent/economically material        NOT TESTED
General defensive-rebalancing optimizer            NOT IMPLEMENTED
Production-ready protocol                          NOT ESTABLISHED
```

This conclusion preserves `KILL_ARBFOLD` for the original 10% LP-net thesis.
It does not reinterpret that gate. It identifies a separate systems result
that survived.

## 1. Claim ledger

The following table is the shortest reliable guide to what may and may not be
said about ARBFOLD.

| Claim | Status | Evidence and boundary |
| --- | --- | --- |
| The user output is the same in both frozen paths | **Supported** | Exact equality across five fixed workloads in the release benchmark. It means the two custom-pool paths agree; it does not mean equality with a standard concentrated-liquidity pool or the best market quote. |
| The solver reward is the same | **Supported** | Exact equality under the fixed 10% reward rule. The current “solver” is a caller-selected reward recipient; no solver auction or proof market exists. |
| The final six reserves are equivalent | **Supported** | Within one wei in the fixed release grid. This is expected from the algebraic construction and verified on real `PoolManager` calls. |
| Each participating CPMM product does not decrease | **Runtime-enforced for accepted rounds** | The coordinator checks `x*y` before writing each round. This is a liquidity-function statement, not a proof that every LP's mark-to-market wealth is non-decreasing under an external price. |
| ERC-6909 claims always equal recorded hook reserves | **False for an adversarial reward recipient** | Equality holds in the frozen external-recipient paths. A caller can instead select a registered hook as reward recipient; the claim transfer and virtual reserve write then classify the reward differently and continuity breaks. This is a production blocker, not a benchmark invalidation. |
| ARBFOLD eliminates the tested cycle | **Supported for tested/sampled states** | Canonical residual is zero; fixed workloads are below `1e12` units; 50,000 sampled valid delivered folds also ended below the threshold. The contract has no final revert condition if eight rounds end above it. |
| ARBFOLD is always cheaper | **Falsified** | At 25k, release ARBFOLD costs 413,409 gas versus 409,381, a 0.98% regression. |
| ARBFOLD uses 19.12% less gas | **Supported only at the canonical release workload** | 544,187 versus 440,128 total benchmark gas at 100k. It is EVM/intrinsic/calldata gas under the frozen Foundry method, not a complete Unichain transaction-fee measurement. |
| ARBFOLD produces more gross LP value than reinjected backrunning | **Falsified by equivalence** | With the same reward and reinjection policy, both paths reach the same state and retain the same amount. |
| ARBFOLD gives LPs 10% more net value | **Falsified** | Frozen v0 measured only 0.000287%; the delivered release gas grid implies 0.000145% in the analogous total-gas sensitivity at 0.01 gwei. |
| LPs receive the gas savings today | **Not implemented** | The fixed 10% reward is the same in both paths. The gas payer keeps the execution-cost saving unless a separate competitive reward mechanism passes it through. |
| The pools “execute their own arbitrage” | **Useful intuition, technically imprecise** | The direct path does not replay swaps. It computes the specialized cycle and transfers backed claims/reserves to the equivalent state. |
| ARBFOLD preserves price discovery | **Only internally scoped** | It removes a profitable cycle inside this three-pool model. It has no external reference and cannot prove alignment with the wider market. |
| Every swap internalizes the cycle | **False for the current surface** | Empty `hookData` executes a plain custom-curve swap without folding. Capture depends on routing through fold mode. |
| The mechanism wins transaction priority | **Partially supported** | Once an originating swap enters fold mode, the transition is atomic inside that transaction. ARBFOLD does not force order flow into that route or solve priority for pre-existing opportunities. |
| ARBFOLD implements Defensive Rebalancing | **Supported only as a specialized construction** | It implements the paper's constructive “mimic a cycle, repay principal, distribute profit” idea for three CPMMs, not the paper's general network optimization. |
| ARBFOLD is novel | **Plausible, not proven** | A pinned UHI-directory keyword scan found no exact public match, but negative keyword search cannot establish first-ever novelty. |

## 2. What the mechanism actually does

### 2.1 Fixed network

The delivered mechanism coordinates exactly three hook-owned constant-product
pools:

```text
Pool AB       A / B
Pool BC       B / C
Pool AC       A / C
```

All cycle profits and rewards are denominated in token `A`. Each pool charges a
fixed 30 bps fee (`gamma = 0.997`). The router supports exact-input swaps. The
core assumes bounded reserves and standard 18-decimal-like integer behavior;
it does not inspect token metadata.

In the public demo deployment the internal roles map to:

```text
A = ARFY
B = ARFX
C = ARFZ
```

Those tickers are valueless demo tokens. They should not be interpreted as an
economic deployment.

### 2.2 Cycle quote

For one CPMM leg with fee multiplier `gamma`, the integer implementation uses
the usual exact-input form:

```text
out(x) = floor(gamma * reserveOut * x /
               (reserveIn * denominator + gamma * x))
```

Ignoring integer floors for the derivation, one leg is fractional-linear:

```text
f(x) = a*x / (b + c*x)
```

Three composed legs retain that form. The continuous stationary input is:

```text
x* = max((sqrt(A*B) - B) / C, 0)
```

[`CycleMath.sol`](../../../contracts/src/CycleMath.sol) evaluates forward and reverse
cycles, selects the larger A-denominated quoted profit, and applies bounded
integer normalization so the coefficient arithmetic fits in `uint256`.

This is not a generic convex solver and is not an exact proof of the global
integer optimum over arbitrary network states. It is a specialized closed-form
quote with floor rounding and empirically bounded error in the tested domain.

### 2.3 Why the direct state equals backrun plus reinjection

Let a forward cycle begin with `q` units of A and return `aOut`. Its gross
profit is:

```text
P = aOut - q
```

Let the fixed solver reward be `R`. In an ordinary final swap, the last pool
releases `aOut`, so its A reserve becomes:

```text
x' = x - aOut
```

If `P - R` is then reinjected into that pool:

```text
x'' = x - aOut + (P - R)
    = x - aOut + (aOut - q - R)
    = x - q - R
```

That is exactly the A-side reserve written by ARBFOLD's direct transition. The
first two pool deltas match the first two ordinary cycle legs, and the final
pool receives the same intermediate token amount. Therefore, provided both
paths use the same quote, rounding, reward and starting state, equality is a
property of the construction—not a newly created source of gross value.

This matches the constructive proof in the
[Defensive Rebalancing paper](https://arxiv.org/html/2601.19950v2): mimic an
arbitrage sequence, return the initial capital and distribute the remaining
profit to a pool. The paper's broader result optimizes over feasible network
transfers; ARBFOLD v0 does not solve that program.

### 2.4 Onchain transition

For the forward `A -> B -> C -> A` cycle, the coordinator moves `PoolManager`
ERC-6909 claims as follows:

```text
AC -> AB       q A
AC -> solver   R A
AB -> BC       first B
BC -> AC       second C
```

and writes:

```text
AB: (A + q,          B - first)
BC: (B + first,      C - second)
AC: (A - q - R,      C + second)
```

The reverse path is symmetric. Underlying assets stay in `PoolManager`; claim
ownership and each hook's virtual reserve ledger move together along the
intended call path.

The user output is computed and booked by `BaseCustomCurve` before the hook
calls `fold`. The router then settles all transient deltas inside the same
`PoolManager.unlock`. A revert unwinds both swap and fold.

## 3. Relationship to the paper

The [paper](https://arxiv.org/html/2601.19950v2) establishes a broader research
object than ARBFOLD v0:

```text
maximize     sum_i log F_i(x_i')
subject to   token conservation
             F_i(x_i') >= F_i(x_i) for every pool
```

For log-concave CFMM liquidity functions, that formulation yields a unique
solution for the paper's objective. The paper also describes the simpler
constructive transition that imitates an arbitrage path and returns its profit
to the participating liquidity domain.

ARBFOLD implements the latter, specialized to:

- three pools and three assets;
- constant-product curves;
- fixed 30 bps fees;
- one fixed A numeraire;
- a closed-form three-leg input;
- a fixed 10% reward; and
- at most eight repeated rounds.

It does **not** establish that its final state maximizes `sum log F_i`, that no
other feasible transfer would retain more value, or that the reward is the
minimum required for execution.

The paper itself leaves two practical problems open that remain relevant here:

1. a successful rebalance must obtain priority before competing arbitrage; and
2. cheap onchain verification of a global optimum may be difficult.

ARBFOLD avoids the second problem by solving a narrower construction. It only
partly addresses the first: atomicity protects a swap that already entered the
fold path, but not order-flow acquisition or bypass routes.

## 4. Evidence hierarchy

Evidence is strongest when claims stay within the layer that produced it.

| Layer | What it proves | What it does not prove |
| --- | --- | --- |
| Algebra | Direct transition equals cycle plus reinjection under identical inputs | Gas, priority, adoption or global optimality |
| Frozen v0 Foundry gate | Minimal harness equivalence, 39.58% canonical gas saving, failed 10% LP gate | Delivered-source gas or production value |
| Clean-core/release benchmark | Delivered logic path and a real v4 `PoolManager` reproduce the state; release gas grid | Universal gas savings or actual Homelander performance |
| Unit/fuzz/invariant suite | Exercised safety/accounting properties over bounded generated sequences; the post-review regression reproduces reward-address aliasing | Formal correctness for all states or adversarial token behavior |
| Arithmetic differential | Normalized Solidity-like math closely tracks an arbitrary-precision reference over sampled inputs | Global integer optimality or all boundary transitions |
| Public testnet deployment | Contracts deploy and a real transaction can execute on Unichain Sepolia | Apples-to-apples gas comparison or natural opportunity frequency |
| External novelty scan | No exact keyword match in one pinned directory snapshot | First-ever novelty |

The public testnet and the Foundry benchmark must never be conflated. Testnet
state is mutable, so two sequential live transactions do not share the same
starting state. Only the snapshot-controlled Foundry test supports the
comparative gas claim.

## 5. Reproduction and artifact integrity

### 5.1 Immutable artifacts

| Artifact | SHA-256 |
| --- | --- |
| v0 freeze | `8f6dc062d3897693eed8fa5af9cf5d6b6ce62f7c32af07719cf5d588e203aaf0` |
| v0 raw results | `81e9ee474809b9a9e2852e4573383dea9ccc8d40092ceab81cb91d3f550cb00e` |
| v0 decision | `9e349450d504ed5c34f29e9e532bc26dd3da10f180166a759d74376472264061` |
| release raw results | `222a5adaeefa510b489708883488bc232c7f5d3b40d328e05fa39b4a1e9c420d` |
| release source manifest | `20afdcea444547df5a115983cbe82674452ab8d532fa4259153379a2466af969` |
| arithmetic differential | `4a1c95a3fd5a1049b38ba4f23665d131a3a477a78828d6e980db9d951ea5cee6` |
| reassessment output | `713af874ab1f5d3733e273cdf3cb527d56dccd4c4cdcaafe5fc589a8667523a6` |
| pinned UHI scan output | `1c6b08c65a26df190d68a74d83402b787f2e10272d030d7bfeb556d20d132709` |

The v0 raw file points to the freeze digest; the v0 decision points to both the
freeze and raw-result digests. The release raw file points to source tree
`53db...c3f3`, and the current `contracts/src` reproduces that exact manifest.

### 5.2 Commands rerun on 2026-08-29

```bash
# Verify delivered Solidity source identity
python3 scripts/source-manifest.py \
  --check benchmark/release-candidate-results/source-manifest.sha256

# Verify that later UI/documentation commits did not change benchmark scope
git diff --exit-code \
  9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b..HEAD -- \
  contracts/src \
  contracts/test/ArbFoldCleanCoreBenchmark.t.sol \
  contracts/test/CleanCoreBenchmarkHarnesses.sol \
  contracts/foundry.toml

# Reproduce the killed v0 decision
python3 benchmark/analyze_arbfold_gate.py

# Reproduce the release grid and canonical state
cd contracts
forge test --offline --match-contract ArbFoldCleanCoreBenchmarkTest -vv

# Full contract suite
forge test --offline

# Post-review EVM counterexample; documents but does not repair the frozen core
forge test --offline --match-contract ArbFoldResearchFindingsTest -vv

# Release fuzz and stateful invariant profile
cd ..
make test-release-fuzz

# 50,000-sample arbitrary-precision differential and 50,000-run math fuzz
make arithmetic

# Python model tests
python3 -m unittest discover -s tests -p 'test_arbfold*.py' -v

# Deterministic reassessment and pinned novelty scan
python3 research/reassess_arbfold.py \
  --check research/results/arbfold-thesis-reassessment-2026-08-29.json
python3 research/scan_uhi_directory.py \
  --check research/results/uhi-directory-keyword-scan-2026-08-29.json

# Read-only verification of the public Unichain Sepolia deployment
npm run check:live
```

Fresh results:

```text
Current Solidity suite                 62 passed, 0 failed
Frozen release tests                   61
Post-review aliasing regression         1 passed
Release fuzz properties                10,000 runs per fuzz test
Six route/direction execution fuzz      10,000 runs
Stateful invariant profile              256 runs x 80 calls; 0 reverts
Arithmetic Solidity fuzz                50,000 runs per fuzz test
Python model/submission/reassessment     17 passed
Delivered/source manifest               exact match
Benchmark-scoped diff from tested commit empty
Frozen decision                         KILL_ARBFOLD reproduced
Public deployment at chain 1301         verified at block 61,208,983
Canonical public transaction            status and bytecode checks passed
```

Machine-readable recalculation is in
[`research/results/arbfold-thesis-reassessment-2026-08-29.json`](../../results/arbfold-thesis-reassessment-2026-08-29.json).

## 6. Benchmark audit

### 6.1 What is fair about the comparison

The release benchmark does several important things correctly:

- both paths start from a snapshot of the same deployed state;
- the snapshot is reverted between paths;
- the originating input, custom pools, fee, output rule and solver are shared;
- both paths use a real Uniswap v4 `PoolManager`;
- the reference performs three actual `PoolManager.swap` calls;
- the direct path moves actual ERC-6909 claims, not only in-memory numbers;
- the reference reinjects retained profit and uses the same 10% reward;
- final reserves, claims, backing, products and residual are checked; and
- both external calls share the same function signature and include measured
  execution, intrinsic gas and calldata byte gas.

This is a controlled systems comparison. It is much stronger than comparing
two sequential public transactions.

### 6.2 Release grid

| Origin input | Backrun total gas | Direct total gas | Difference | Direct result |
| ---: | ---: | ---: | ---: | ---: |
| 10k | 407,272 | 389,292 | -17,980 | 4.41% less |
| 25k | 409,381 | 413,409 | +4,028 | **0.98% more** |
| 50k | 544,186 | 440,127 | -104,059 | 19.12% less |
| **100k** | **544,187** | **440,128** | **-104,059** | **19.12% less** |
| 200k | 544,177 | 440,117 | -104,060 | 19.12% less |

The 100k size was fixed before the original result, so using it as canonical is
not post-hoc cherry-picking. It still must be qualified by the complete grid.

The result clusters by execution path, not smoothly by notional. In the frozen
same-state telemetry, 10k and 25k require one round; 50k, 100k and 200k require
two. The 25k case also stores a small nonzero residual while 10k stores zero.
It is therefore plausible that an extra persistent zero-to-nonzero storage
write contributes to the 25k regression. This is an inference from the raw
telemetry and coordinator storage behavior, not a measured opcode attribution.

### 6.3 What the baseline is—and is not

The reference is a bespoke **best-case, Homelander-style atomic backrun
harness**. It is not the deployed or audited MEV-X Homelander implementation.
It performs the three swaps, reinjection and reward in one unlock with a compact
test router.

The actual
[MEV-X Homelander repository](https://github.com/mev-x-project/MEV-X-Homelander/tree/36ace1f3ae13548c4159796b74ba91c766bbe4f8)
describes a post-swap plugin connected to a route store, executor and profit
distributor. Its public repository contains only the hook-facing component and
interfaces, not the full stack. Therefore ARBFOLD may claim superiority over
the frozen three-swap reference, but not “19.12% cheaper than Homelander.”

The compact reference is conservative in one sense: it omits some production
Homelander orchestration. It may be generous in another: it shares ARBFOLD's
closed-form quote and custom-pool implementation, so it is not an independent
competitor implementation.

### 6.4 Shared-code dependence

Both paths share:

- `CycleMath`;
- the same custom CPMM hook;
- the same reserve model;
- the same reward rule; and
- a test-only coordinator subclass.

Actual `PoolManager.swap` calls independently exercise the reference state
transition, and the arbitrary-precision differential checks the core math, but
a shared modeling mistake could still make both paths agree incorrectly.

The direct path calls inherited production `fold` logic, but the benchmark
deploys `CleanCoreReferenceCoordinator`, a test subclass with extra reference
functions, for both branches. Consequently the direct logic is the published
logic while the exact coordinator bytecode is not identical to the public
base-coordinator deployment. This is disclosed in the freeze and is a small but
real boundary on interpreting the precise gas number as deployed-bytecode gas.

### 6.5 What gas is included

The frozen release measure includes:

```text
21,000 intrinsic gas
+ calldata zero/nonzero byte gas
+ originating swap
+ PoolManager unlock and callbacks
+ custom-curve accounting
+ direct claim movement or three reference swaps
+ reward/reinjection
+ storage and final settlement
```

It excludes:

- deployment;
- CREATE2 hook-address mining;
- pool initialization and liquidity seeding;
- route discovery and offchain operating infrastructure;
- audits and ongoing operational cost;
- historical failed/reverted attempts; and
- a full L2 fee decomposition.

Unichain is an OP Stack rollup. Official
[OP Stack fee documentation](https://docs.optimism.io/op-stack/transactions/fees)
separates execution gas, L1 data fee and, where enabled, operator fee. The
Foundry number measures execution-oriented EVM gas plus Ethereum-style
intrinsic/calldata gas; it does not measure the actual L1 data or operator fee
of a signed Unichain transaction. Since the two public calls have the same
shape, data fees may be similar, but that was not measured and must not be
assumed exactly equal.

### 6.6 Generalization boundary

The gas grid varies only user input size. It holds constant:

- one initial reserve configuration;
- one originating pool and direction;
- one fee;
- one three-pool topology;
- one compiler/optimizer/EVM configuration;
- one reward policy; and
- one custom accounting implementation.

The broader fuzz suite provides strong mechanical coverage over routes and
states, but it does not collect comparative gas distributions. Therefore the
supported gas claim is workload-specific. A population-level claim would need
a preregistered matrix over reserve skew, all six origin directions, number of
fold rounds, residual storage behavior and opportunity size.

## 7. Economic audit

### 7.1 Gross economics are identical by construction

At the canonical 100k scenario:

```text
Gross cyclic surplus                 0.858490391161694849 A
Fixed reward                         0.085849039116169484 A
Retained in pool network             0.772641352045525365 A
```

The one-wei-scale difference from an exact 10% share comes from integer floor
rounding. Both paths pay the same reward and reach equivalent reserves. Their
onchain pool retention is therefore the same:

```text
PoolRetention_backrun = P - R
PoolRetention_direct  = P - R
Difference            = 0
```

ARBFOLD's direct transition does not create additional gross surplus. Its
validated advantage is that it reaches this state with fewer EVM operations in
four fixed workloads.

### 7.2 Who receives the gas saving?

The delivered contract fixes the reward at 10% of threatened profit. It does
not compute the executor's minimum cost, solicit bids or refund unused reward.
The caller also chooses the nonzero `solver` address, while cycle computation
occurs deterministically onchain.

As implemented:

```text
same fixed reward + lower direct execution cost
                         ↓
lower expense for the transaction gas payer
```

If the gas payer and reward recipient are the same actor, that actor's margin
is larger. If they differ, the reward recipient receives the same amount while
the transaction sender receives the execution saving.

It does **not** automatically imply:

```text
larger LP retention
```

For LPs to receive the cost saving, another mechanism would need to make the
reward competitive or gas-indexed. That mechanism is outside v0. Accordingly,
“solver reward” should be understood as a fixed execution incentive in this
prototype, not evidence of a functioning solver market.

### 7.3 Gas-indexed reward sensitivity

For continuity with the frozen gate, consider the counterfactual:

```text
minimumReward = totalGas * gasPrice * 1.20
LPNet         = grossSurplus - minimumReward
```

Using total release gas is favorable to detecting an effect because it charges
the entire common originating transaction against surplus; release incremental
mechanism gas was not separately captured. It assumes token A has gas-token
value parity and omits L1 data/operator fees.

| Gas price | Backrun cost | Direct cost | Direct LP-net uplift |
| ---: | ---: | ---: | ---: |
| 0.001 gwei | 0.0000006530 A | 0.0000005282 A | 0.0000145% |
| **0.01 gwei** | **0.0000065302 A** | **0.0000052815 A** | **0.0001455%** |
| 0.1 gwei | 0.0000653024 A | 0.0000528154 A | 0.00145% |
| 1 gwei | 0.0006530244 A | 0.0005281536 A | 0.0146% |
| 10 gwei | 0.0065302440 A | 0.0052815360 A | 0.1466% |
| 100 gwei | 0.0653024400 A | 0.0528153600 A | 1.5743% |
| 300 gwei | 0.1959073200 A | 0.1584460800 A | 5.6538% |

The release paths reach a 1.10 LP-net ratio only around **451.43 gwei** under
these assumptions. Equivalently, the backrun execution cost must consume about
**34.34% of gross surplus** before a 19.12% gas reduction creates a 10% LP-net
ratio.

The original v0 report's 0.000287% result used its larger 39.58% gas saving and
incremental-gas measurement. The release sensitivity is smaller because the
delivered saving is 19.12%. Both are orders of magnitude below the frozen 10%
gate throughout its 0.001–10 gwei sensitivity range.

### 7.4 Reward calibration

At 0.01 gwei and a 20% operating multiplier, the fixed canonical reward is
approximately:

```text
13,146x the modeled backrun total-gas cost
16,255x the modeled direct total-gas cost
```

This does not prove a production reward should equal gas alone—latency,
infrastructure, capital and risk may matter—but it shows that the fixed 10%
parameter is not an economically calibrated minimum in the frozen setting.

### 7.5 Distribution among pools

“LPs keep the surplus” is too broad without qualification. In a forward fold:

- the first two pools experience the same fee-bearing reserve deltas as the
  first two cycle swaps;
- the final pool retains `profit - reward`; and
- every pool's `x*y` must be non-decreasing.

The surplus is not distributed pro rata across all LPs. Benefits are
path-dependent, and `x*y` monotonicity is not identical to USD PnL under an
external reference price. The precise supported statement is:

> **The accepted transition keeps all three CPMM products non-decreasing and
> retains each round's gross cyclic profit minus its fixed reward within that
> round's final pool, under the specialized liquidity metric.**

### 7.6 Opportunity frequency remains unknown

The preregistered experiment required historical opportunity analysis only if
all earlier gates passed. The LP-net gate failed, so that phase was never
reached. There is no audited evidence yet for:

- how often relevant three-pool cycles arise;
- their surplus distribution after real fees;
- how many fold rounds they require;
- what share falls into the 25k-like gas-regression region;
- how often ARBFOLD would obtain the order flow; or
- whether total savings amortize new-pool and operational costs.

The public testnet transaction uses deliberately configured demo state. It
proves execution, not natural opportunity frequency.

## 8. Runtime-guarantee audit

The distinction between a contract postcondition and a tested property matters
for every claim.

| Property | Contract enforcement | Test/benchmark evidence | Remaining boundary |
| --- | --- | --- | --- |
| Atomic swap + fold | `PoolManager.unlock` must settle deltas; nested revert unwinds all | Unit and deployment tests | Only when the swap enters fold mode |
| Registered fixed topology | One-time coordinator validation | Configuration/negative tests | Does not verify operator approval during configuration |
| Reserve positivity/bounds | Hook reserve writes enforce domain | Boundary and fuzz tests | Specialized bounded domain only |
| Per-pool `x*y` non-decrease | Checked every accepted fold round | Unit, fuzz and invariant tests | Not external-price LP wealth |
| A/B/C virtual conservation | Checked every round including reward | Unit/fuzz tests | Depends on fixed A numeraire/reward model |
| At least one product increases | Checked after nonzero fold | Unit/fuzz tests | “Materially” is not quantified beyond integer increase |
| Claims equal virtual reserves | Maintained only along non-aliased intended calls | Stateful invariants use an external solver | `fold()` does not re-read claims, and a hook chosen as reward recipient breaks the equality |
| Underlying backs claims | Enforced by intended v4 accounting flow | Exact-backing assertions | ARBFOLD does not independently sum custody at fold entry |
| Residual below threshold | Loop stops early when quote is below threshold | Fixed grid and 50k valid sampled folds | No final runtime revert after round eight |
| User output unchanged by fold | Output booked before fold | Exact benchmark comparison | Does not compare against another AMM/market quote |
| Solver reward bounded | Fixed 10% of each quoted profit | Reward/claim tests | No proof of minimum necessary reward or beneficiary work |
| Capture cannot be bypassed | **Not enforced** | Empty-hook-data plain swap is explicitly tested | Router/order-flow integration required |

### 8.1 Residual finding

`fold()` executes at most eight rounds. It stops early when quoted profit is at
most `1e12` A base units, then records a final residual. If the eighth round is
used and residual remains above the threshold, the function records it but does
not revert solely for that reason.

A deterministic 50,000-network delivered-math sample found:

```text
Valid fold pairs                 42,338
Rejected transition domain       7,662 (15.324%)
Valid results above threshold         0
Maximum valid delivered residual 999,206,326,100 wei A
Threshold                         1,000,000,000,000 wei A
```

This is strong empirical evidence for the sampled distribution, but not a
universal postcondition. Existing stateful invariants verify that stored
residual telemetry matches current `CycleMath.best`; they do not assert the
threshold for every generated sequence.

### 8.2 Opt-in capture

The hook calls the coordinator only when nonempty valid fold data is present.
With empty `hookData`, it executes a plain custom CPMM swap. The included router
always supplies fold data, but another compatible route can omit it.

Consequences:

- an originating transaction using the ARBFOLD router folds atomically before
  an external transaction can interleave;
- generic order flow is not automatically internalized;
- a searcher can use plain paths where available; and
- distribution/routing is part of the mechanism's viability, not merely UX.

The [Unichain whitepaper](https://docs.unichain.org/whitepaper.pdf) describes an
environment intended to support application-level MEV internalization, but
ARBFOLD v0 does not integrate a sequencing commitment, private order-flow
channel or auction.

### 8.3 Solver semantics

The user supplies an arbitrary nonzero reward address. The coordinator itself
computes the cycle; no offchain proposal, certificate, bid or route is supplied
by that address. A caller can name itself.

Therefore the current role is more accurately:

```text
reward recipient / execution incentive beneficiary
```

than a demonstrated specialized solver. This does not break the benchmark,
which holds the recipient constant. It does limit production narratives about
permissionless solver competition.

### 8.4 Reward-address aliasing counterexample

The router and coordinator reject only `solver == address(0)`. A public caller
may select `hookAB`, `hookBC` or `hookAC` as the reward recipient.

That creates a source-level counterexample to the general claim that hook
claims always equal virtual reserves:

1. `_applyDirect` transfers the A reward from the round's final hook to the
   caller-selected address.
2. v4 ERC-6909 `transferFrom` subtracts from the sender balance and adds to the
   receiver balance. A transfer to the same hook is a net claim no-op; a
   transfer to another registered hook credits that hook.
3. The virtual transition always treats the reward as leaving pool reserves:
   it subtracts the reward from the final pool and adds it to no other pool.
4. No claim/reserve equality check runs before or after the write.

Therefore a successful call with a registered hook as recipient leaves extra A
claims at a hook relative to its virtual reserves. Underlying `PoolManager`
custody is not made insolvent by this aliasing, but the accounting
representation diverges and later LP withdrawal can strand the unrecorded
claims.

The fixed benchmark, stateful tests and public demo use a separate external
solver address, so this does **not** invalidate their measured equivalence or
gas grid. It does invalidate any assertion that claim/reserve equality is a
runtime guarantee for every valid public input. This is an explicit production
blocker for the frozen core, not a reason to rewrite the already measured
benchmark silently.

The one-test Foundry reproduction is
[`ArbFoldResearchFindings.t.sol`](../../../contracts/test/ArbFoldResearchFindings.t.sol).
It executes a profitable canonical fold with `hookAB` as the reward recipient,
shows that the hook's token-A claim exceeds its recorded reserve by exactly the
cumulative reward, and separately confirms that `PoolManager` custody still
backs the outstanding claims.

## 9. Arithmetic audit

The deterministic differential compares:

1. a delivered path mirroring Solidity's bounded coefficient normalization;
2. an arbitrary-precision Python composition with no coefficient normalization;
3. the same integer floor behavior for swaps, rewards and transitions.

At seed 1057 and 50,000 network samples:

```text
Direction mismatches                       0
Valid fold pairs                      42,338
Rejected transition-domain cases       7,662
Max quote-profit relative error      8.16e-13
Max final-reserve relative error      1.67e-13
Max solver-reward relative error      1.17e-12
Max residual absolute error            736,086 wei A
Max residual relative error             58.4%
```

The high residual relative error occurs because the expected residual is tiny;
the absolute error is far below the `1e12` stopping threshold. However, the
existing `passes()` gate does not include the residual metric or explicitly
count threshold-decision mismatches. That omission is now recorded rather than
silently treated as a proven bound.

The 7,662 rejected cases are networks where a quoted transition would leave the
supported reserve domain. They are excluded from final-state error aggregation.
This is consistent with a deliberately bounded prototype, but it means the
headline “50,000 configurations” should be decomposed into quote comparisons
and 42,338 valid fold comparisons.

There is also no formal source proof for:

- normalization's worst-case optimal-input error;
- eight-round sufficiency over the entire accepted state space; or
- the economic meaning of an absolute `1e12` threshold for tokens with
  different decimals or prices.

## 10. Price discovery and MEV interpretation

ARBFOLD does not need an external oracle. That is both a strength and a limit.

It can answer:

> Is there a profitable fee-adjusted cycle inside these three pools, and can we
> apply the corresponding state transition?

It cannot answer:

> Are these pools correctly priced relative to Coinbase, another DEX or a
> fundamental reference?

All three pools can be mutually cycle-consistent and jointly wrong relative to
the outside market. Thus “remaining arbitrage: zero” means no profitable cycle
above the internal threshold in the modeled triangle, not global price
discovery and not elimination of all MEV or LVR.

Against ordinary external arbitrage, ARBFOLD can retain 90% of the threatened
cycle if its path executes first. Against an atomic internalization mechanism
that already reinjects the same profit with the same reward, ARBFOLD's gross
economic state is identical and only execution efficiency differs.

That distinction is central:

```text
External arbitrage comparison     changes who keeps profit
Reinjected backrun comparison     isolates how the same state is reached
```

The second is the scientifically fair baseline for ARBFOLD's unique direct
transition.

## 11. Comparative landscape

| Mechanism | Core action | User quote | Value destination | Priority model | ARBFOLD distinction |
| --- | --- | --- | --- | --- | --- |
| External cyclic arbitrage | Three market swaps | Origin swap already executed | Searcher keeps profit | Public/private ordering race | ARBFOLD retains most threatened profit if it executes atomically first |
| Frozen atomic reference | Three v4 swaps + reinjection | Identical | Same fixed reward and retained pool value | Same transaction | Same final state; direct path changes only execution form |
| MEV-X Homelander | Post-swap route validation, executor swaps, profit distribution | Origin swap remains | Configured distributor | Atomic `afterSwap` path | ARBFOLD directly moves claims instead of executing route swaps; no actual Homelander gas benchmark exists |
| KNOT | Federates same-pair reserves and clips overly favorable quotes | Can modify taker quote | Federated LP domain | Hook quote policy | Different topology and intervention point; KNOT is qualitative only because its repo was not pin-verifiable in this review |
| General Defensive Rebalancing | Optimize feasible transfers across a CFMM network | Model-dependent | Pareto-efficient pool state | Assumes execution priority | ARBFOLD implements one constructive three-CPMM case, not the general optimizer |

OpenZeppelin's official
[`BaseCustomCurve` documentation](https://docs.openzeppelin.com/uniswap-hooks/api/base)
confirms that custom curves can replace the default concentrated-liquidity math
and require hook-owned liquidity. It also labels the library experimental and
provided as-is. ARBFOLD therefore cannot be attached to existing v4 pools: the
hook address is fixed in the pool key, and this mechanism requires new custom
pools under a coordinated architecture.

## 12. Bounded novelty search

The official Atrium UHI directory was pinned at commit
`3660c054f9d7e9a0cfbf5c27cc2845f55852df05`; the 2,354,898-byte snapshot has
SHA-256 `3fd9...5848`. The reproducible scan is
[`research/scan_uhi_directory.py`](../../scan_uhi_directory.py).

| Exact/bounded pattern | Matches |
| --- | ---: |
| `defensive rebalanc` | 0 |
| `cyclic arbitrage` | 0 |
| `atomic backrun` | 0 |
| `profit reinjection` | 0 |
| `same final state` | 0 |
| `reserve transfer` | 0 |
| `direct reserve` | 1 |
| `custom accounting` | 13 |
| `MEV internalization` | 1 |
| `internaliz* ... arbitrage` within 80 characters | 3 |

The defensible conclusion is:

> **No equivalent public UHI description was found through this pinned,
> bounded keyword protocol.**

The indefensible conclusion is:

> **ARBFOLD is the first implementation ever.**

Descriptions can use different terminology; private, unpublished, deleted or
non-UHI work is outside the dataset. The recent paper is evidence that the
research direction is current, not proof of implementation priority.

## 13. UHI10 relevance

Atrium's official 2026 program description defines UHI10 as
“Sustainable Liquidity & MEV Protection” and explicitly includes mechanisms in
which LPs recapture extracted value. ARBFOLD is aligned with that question:

- it targets a concrete cyclic arbitrage leak;
- it uses v4 custom accounting in an essential way;
- it preserves the originating output inside the compared custom-pool paths;
- it retains profit minus reward in the participating network; and
- it produces a measurable execution result on a real `PoolManager`.

Its UHI value is experimental, not product-market proof. The technically honest
submission thesis is compelling precisely because it distinguishes:

```text
what was hypothesized     material LP-net superiority
what failed               the 10% LP-net gate
what survived             mechanically equivalent execution compression
what remains unknown      frequency, routing, reward market and adoption
```

## 14. Recommended canonical positioning

### One-line description

> **ARBFOLD compresses a specialized three-pool cyclic backrun plus profit
> reinjection into one verified, PoolManager-backed reserve transition.**

### Quantitative result

> **In the fixed release benchmark, ARBFOLD reaches equivalent final reserves
> with identical user output and reward, using 19.12% less gas at the
> preregistered 100k workload; it is cheaper in four of five tested sizes and
> 0.98% more expensive at 25k.**

### Why v4 matters

> **Uniswap v4's singleton, flash accounting, hook callbacks and ERC-6909 claim
> ownership make it possible to verify and settle a direct multi-pool state
> transition inside one unlock.**

The [v4 whitepaper](https://raw.githubusercontent.com/Uniswap/v4-core/d153b048868a60c2403a3ef5b2301bb247884d46/docs/whitepaper/whitepaper-v4.pdf)
supports the underlying architecture: singleton pool management, flash
accounting and custom accounting allow hook-defined deltas and custom curves.

### Claims to use

- specialized three-CPMM defensive rebalancing;
- same user output and fixed reward in the frozen comparison;
- equivalent final reserve state within one wei;
- exact PoolManager backing in the tested release paths;
- non-decreasing CPMM products for accepted transitions;
- atomic fold when the origin swap enters fold mode;
- workload-dependent gas savings;
- 19.12% less release gas at canonical 100k;
- four of five fixed workloads cheaper; and
- research-grade, not production-authorized.

### Claims to avoid

- “10% more value for LPs”;
- “LPs automatically receive the gas saving”;
- “always cheaper”;
- “eliminates arbitrage/MEV/LVR”;
- “preserves global price discovery”;
- “implements the paper's optimum”;
- “beats Homelander by 19.12%”;
- “works with existing Uniswap pools”;
- “permissionless solver market”;
- “audited” or “mainnet ready”; and
- “first ever.”

The shortest accurate headline remains:

> **Three arbitrage swaps, compressed into one verified transition.**

It should always be paired with the fixed-workload qualifier for the gas
number.

## 15. Falsifiers and next research

The current UHI build should not be expanded before submission. These are
post-Hookathon experiments required to determine whether ARBFOLD is more than a
strong systems demonstration.

### Experiment 1 — gas external validity

Preregister a matrix over:

- all six origin routes;
- multiple reserve skews and liquidity scales;
- one through eight fold rounds;
- zero and nonzero residual storage transitions;
- opportunity sizes near the profitability threshold; and
- current compiler/OP Stack fee regimes.

**Falsifier:** direct execution is not cheaper on a majority of economically
weighted opportunities, or savings disappear after complete L2 fee accounting.

### Experiment 2 — actual internalization baseline

Integrate a complete, pinned atomic internalization implementation or specify a
minimal production-faithful reference that includes route validation,
execution and distribution. Keep output, reward and starting state identical.

**Falsifier:** a conventional atomic executor reaches the same state with
similar or lower total cost and much less adoption complexity.

### Experiment 3 — opportunity-frequency study

Define candidate three-pool networks, reconstruct synchronized historical
states, include fees and transaction costs, and measure opportunity duration,
size, rounds and routing availability.

**Falsifier:** capturable surplus is too infrequent or small to amortize new
pool deployment and coordination.

### Experiment 4 — routing and priority

Model fold-enabled versus bypass flow, generic routers, private order flow and
competing searchers. Measure the fraction of opportunities captured atomically.

**Falsifier:** users/searchers systematically bypass fold-enabled paths or the
mechanism cannot attract originating flow without returning most surplus.

### Experiment 5 — reward market

Replace the descriptive “solver” assumption with a preregistered mechanism:
auction, quoted execution fee, protocol operator or user rebate. Measure who
pays gas, who receives savings and how much reaches each pool.

**Falsifier:** competitive execution requires a reward that consumes the
retained advantage, or fixed topology prevents credible competition.

### Experiment 6 — formal/safety boundary

Prove or enforce:

- a residual postcondition after the final round;
- claim/reserve and backing preconditions at fold entry;
- rejection or explicit accounting of reward recipients that alias registered
  hooks;
- normalization and rounding error bounds;
- supported token decimals and units; and
- lifecycle behavior after full LP withdrawal.

These changes would create a new contract/benchmark version. They must not be
silently folded into the current release result.

## 16. Final assessment

ARBFOLD is not a useless project, and it is not a validated production
protocol. Its contribution is more specific and more credible than either
extreme:

> **It demonstrates that Uniswap v4 custom accounting can compress one
> specialized, Pareto-checked cyclic backrun state transition into direct
> PoolManager-backed claim movement, with a material canonical EVM-gas saving
> in the frozen release benchmark.**

The main scientific weakness is not mechanical correctness. It is external
validity: only one reserve state has comparative gas measurements, historical
opportunity frequency was never tested, routing can bypass folding, and the
fixed reward does not pass gas savings to LPs.

For UHI10, the correct thesis is therefore a systems thesis:

```text
Can v4 execute this defensive state transition more efficiently?
```

not an economic thesis:

```text
Does ARBFOLD already make LPs materially richer in production?
```

The first has a strong measured answer. The second remains unproven and, under
the original 10% gate, was correctly rejected.

## Appendix A — auditable files

- [Frozen v0 specification](BENCHMARK_FREEZE_V0.md)
- [Frozen v0 raw results](../../../benchmark/arbfold-results/raw_v0.json)
- [Frozen v0 decision](../../../benchmark/arbfold-results/decision_v0.json)
- [Release report](../../../benchmark/release-candidate-results/REPORT.md)
- [Release raw results](../../../benchmark/release-candidate-results/raw.json)
- [Release source manifest](../../../benchmark/release-candidate-results/source-manifest.sha256)
- [Arithmetic differential](../../../benchmark/arithmetic-differential-v1.json)
- [Deterministic reassessment script](../../reassess_arbfold.py)
- [Deterministic reassessment output](../../results/arbfold-thesis-reassessment-2026-08-29.json)
- [Reassessment regression tests](../../../tests/test_arbfold_reassessment.py)
- [Reward-address aliasing EVM regression](../../../contracts/test/ArbFoldResearchFindings.t.sol)
- [Pinned UHI scan script](../../scan_uhi_directory.py)
- [Pinned UHI scan output](../../results/uhi-directory-keyword-scan-2026-08-29.json)
- [External-source manifest](../../external-sources-2026-08-29.json)
- [Research artifact checksums](../../CHECKSUMS.sha256)
- [Contract context dossier](../../generated/audit-context/DOSSIER.md)
- [36 per-function context records](../../generated/audit-context/functions)

## Appendix B — primary external sources

- Devorsetz and Herlihy,
  [Defensive Rebalancing for Automated Market Makers, v2](https://arxiv.org/html/2601.19950v2)
- Uniswap,
  [Uniswap v4 Core whitepaper](https://raw.githubusercontent.com/Uniswap/v4-core/d153b048868a60c2403a3ef5b2301bb247884d46/docs/whitepaper/whitepaper-v4.pdf)
- OpenZeppelin,
  [`BaseCustomCurve` and `BaseCustomAccounting`](https://docs.openzeppelin.com/uniswap-hooks/api/base)
- MEV-X,
  [Homelander at reviewed commit](https://github.com/mev-x-project/MEV-X-Homelander/tree/36ace1f3ae13548c4159796b74ba91c766bbe4f8)
- Unichain,
  [whitepaper](https://docs.unichain.org/whitepaper.pdf)
- Optimism,
  [OP Stack transaction fees](https://docs.optimism.io/op-stack/transactions/fees)
- Atrium Academy,
  [UHI10 theme](https://blog.atrium.academy/uniswap-hook-incubator-2025-wrapped)
- Atrium Academy,
  [pinned UHI Hook Directory snapshot](https://raw.githubusercontent.com/AtriumAcademy/UHI-Hook-Data/3660c054f9d7e9a0cfbf5c27cc2845f55852df05/hook_directory.md)

External source versions and retrieval boundaries are recorded in
[`research/external-sources-2026-08-29.json`](../../external-sources-2026-08-29.json).
