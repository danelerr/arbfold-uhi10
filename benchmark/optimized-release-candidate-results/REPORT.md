# ARBFOLD v0.1 optimized release-candidate benchmark

Generated from the v0.1 source manifest in this directory. Historical v0 evidence remains unchanged.

## Promotion gate

- Frozen mechanical equivalence: **PASS** (all six final reserves match within the measured tolerance).
- Paired user-output equality: **PASS**.
- Paired fixed external-recipient reward equality: **PASS**.
- Reference/direct residual equality and threshold (`<= 1000000000000` wei internal A): **PASS**.
- 25k regression removed: **PASS**.
- All five frozen workloads cheaper than the recompiled reference: **PASS**.
- Claims/reserves/backing and persistent-delta checks: enforced by the benchmark and release suite.

Canonical paired values are serialized as canonical decimal strings so every
JavaScript consumer can preserve exact uint256 precision. At 100k, user output
is `30220363129338304386`
and the fixed external-recipient reward is
`85849039116169484`.
Schema v4 also serializes every `input_wei` in the frozen grid, dense sweep and
six-path matrix as a canonical decimal string and checks it against the token
workload without crossing JavaScript's safe-integer boundary.

## Frozen grid — first call

| Input | Reference total | ARBFOLD v0.1 total | Gas saved | Reduction | Rounds | Tolerance (wei) |
|---:|---:|---:|---:|---:|---:|---:|
| 10000 | 407292 | 327669 | 79623 | 19.549365 | 1 | 0 |
| 25000 | 409402 | 329777 | 79625 | 19.449099 | 1 | 0 |
| 50000 | 544219 | 375171 | 169048 | 31.062495 | 2 | 0 |
| 100000 | 544219 | 375171 | 169048 | 31.062495 | 2 | 0 |
| 200000 | 544209 | 375160 | 169049 | 31.063250 | 2 | 0 |

Percentages in the `Reduction` column are percentage values. Total gas is intrinsic + calldata + measured EVM execution.

## v0 direct path vs v0.1 direct path

| Input | v0 direct | v0.1 direct | v0.1 - v0 |
|---:|---:|---:|---:|
| 10000 | 389292 | 327669 | -61623 |
| 25000 | 413409 | 329777 | -83632 |
| 50000 | 440127 | 375171 | -64956 |
| 100000 | 440128 | 375171 | -64957 |
| 200000 | 440117 | 375160 | -64957 |

## Dense canonical sweep

- Range: 1k–200k, step 1k, identical snapshots.
- First actionable workload: **5000 tokens**.
- Zero-round range(s): **1k–4k**.
- Regression range(s): **1k–4k**.
- Cheaper actionable rows: **196 / 196**.

Zero-round calls are not settlement failures. They show that calling `fold()` without an actionable cycle is avoidable work; route preselection remains a separate optimization.

## Six path/direction sample

The matrix uses path-specific actionable inputs that keep every reference leg inside the published swap domain. It is supplementary evidence, not a universal gas claim.

| Path | Input | Rounds | Reference | Direct | Reduction |
|---:|---:|---:|---:|---:|---:|
| ARFY -> ARFX (internal A -> B) | 2 | 1 | 405033 | 325524 | 19.630252% |
| ARFX -> ARFY (internal B -> A) | 5000 | 1 | 405208 | 325587 | 19.649415% |
| ARFX -> ARFZ (internal B -> C) | 5000 | 1 | 405217 | 325846 | 19.587283% |
| ARFZ -> ARFX (internal C -> B) | 5000 | 1 | 405369 | 325884 | 19.608061% |
| ARFY -> ARFZ (internal A -> C) | 2 | 1 | 405472 | 326126 | 19.568799% |
| ARFZ -> ARFY (internal C -> A) | 5000 | 1 | 405409 | 326176 | 19.543967% |

## Steady-state telemetry boundary

Steady-state telemetry gas has not been measured with a cross-transaction harness and is not claimed in this release. A future measurement must establish nonzero telemetry state before the measured transaction begins, for example with two real Anvil transactions or RPC prestate applied before measurement.

## Compiler experiment

| Configuration | Status | Reference @100k | Direct @100k | Coordinator bytes |
|---:|---:|---:|---:|---:|
| no-ir-runs-200 | measured | 544219 | 375171 | 10058 |
| no-ir-runs-1000 | measured | 539032 | 373059 | 10703 |
| via-ir-runs-200 | measured | 523349 | 373253 | 8686 |
| via-ir-runs-1000 | compile failed | — | — | — |

The release keeps `no-ir-runs-200`: it preserves the validated compiler pipeline, stays below the EIP-170 runtime limit, and does not choose settings merely to maximize a relative percentage.

## Interpretation boundary

One `fold()` call can process multiple direct settlement rounds. At the canonical workload, the iterative reference executes two cyclic arbitrage rounds: six swaps and two profit reinjections. One ARBFOLD call applies two runtime-checked direct settlement rounds and reaches equivalent final reserves within measured tolerance while paying a fixed external-recipient reward.

This establishes an execution-gas advantage in the tested actionable workloads. It does not establish universal arbitrage detection, material LP-net uplift, ordering priority, a global defensive-rebalancing optimum, or production readiness.

## Reproduce

```bash
cd /Users/daniel/Desktop/mature-uhi10
python3 scripts/generate-v01-benchmark.py --check

cd contracts
forge fmt --check
forge test --offline
FOUNDRY_PROFILE=release forge test --offline
```
