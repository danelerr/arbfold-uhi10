# ARBFOLD clean-core publication validation v1

## Result

The safety-hardened code under `contracts/src/` reproduces the reference
backrun's user output, solver reward and six final reserves while preserving
claim/reserve equality, exact underlying backing, non-decreasing invariants and
a residual cycle below the fixed threshold.

At the canonical 100k input:

```text
Atomic three-leg backrun + reinjection   537,896 gas
Published ARBFOLD direct path            436,430 gas
Reduction                                18.86%
```

This does **not** reproduce the frozen harness's 39.58% percentage. That older
number remains valid only for v0's minimal direct harness. The clean core adds
independent pre/post snapshots, conservation checks, configuration checks,
events, counters, slippage/deadline validation and the published router path.

## Full grid

| Origin input | Atomic backrun | Clean ARBFOLD | Exact change |
|---:|---:|---:|---:|
| 10k | 403,614 | 386,610 | 4.21% less |
| 25k | 405,309 | 409,899 | **1.13% more** |
| 50k | 537,895 | 436,429 | 18.86% less |
| **100k** | **537,896** | **436,430** | **18.86% less** |
| 200k | 537,886 | 436,419 | 18.86% less |

The execution advantage is therefore workload-dependent, not universal. It is
material for the two-round opportunities in this fixed grid, small at 10k and
negative at 25k.

## Mechanical result

- User output: identical.
- Solver reward: identical.
- Six final reserves: equal within one wei.
- Claims equal virtual reserves: pass.
- Underlying PoolManager backing: exact.
- Invariants non-decreasing: pass.
- Canonical residual cyclic profit: zero.
- Unsettled deltas: none; both unlocks complete.

Canonical user output is `30220363129338304386` wei A and solver reward is
`85849039116169484` wei A. The complete reserve vector and raw grid are in
[`raw_v1.json`](raw_v1.json).

## Relationship to frozen v0

This validation neither changes nor reinterprets the immutable v0 decision:

```text
Economic-superiority hypothesis   KILLED
Frozen minimal-harness gas result  39.58% less at 100k
Published clean-core gas result    18.86% less at 100k
Production deployment              NOT AUTHORIZED
Research-grade UHI10 primitive      BUILD
```

The v1 freeze hash is
`294c5c5afeaea39134e62f36e922b537cc0d7974f3b206e4133472bf443d2153`.
The tested source-tree hash is
`097c5b5bb745c322bb7941d56b8f7dcf540a7e0291b2babbe38044d21a7df857`.
A Git commit will be recorded after these publication artifacts are added, then
the benchmark will be rerun from that clean commit before push.

