# ARBFOLD release-candidate validation v1

## Result

The release-candidate core at commit
`9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b` reaches the same specialized
post-arbitrage state as the atomic three-leg backrun plus profit reinjection.
The user output and solver reward are identical, all six final reserves match
within one wei, PoolManager backing is exact, no invariant decreases and the
canonical residual cyclic profit is zero.

At the canonical 100k input:

```text
Atomic three-leg backrun + reinjection   544,187 gas
ARBFOLD direct transition                440,128 gas
Reduction                                  19.12%
```

The release result supersedes the earlier 18.86% clean-core number only for the
delivered release candidate. It does not overwrite either historical report.

## Complete fixed grid

| Origin input | Atomic backrun | ARBFOLD | Exact change |
|---:|---:|---:|---:|
| 10k | 407,272 | 389,292 | 4.41% less |
| 25k | 409,381 | 413,409 | **0.98% more** |
| 50k | 544,186 | 440,127 | 19.12% less |
| **100k** | **544,187** | **440,128** | **19.12% less** |
| 200k | 544,177 | 440,117 | 19.12% less |

The advantage remains workload-dependent. ARBFOLD is cheaper in four of the
five fixed workloads and is more expensive at 25k.

## Measurement method

- Both paths start from the same deployed-state snapshot.
- The originating swap input, user output, solver and solver reward model are
  identical.
- Hook address mining and network setup are excluded from both runtime paths.
- The PoolManager, coordinator, three hooks, route, three tokens, payer and
  solver are explicitly cooled before each measured call.
- Total gas is intrinsic transaction gas plus calldata gas plus measured EVM
  execution gas.
- The reference executes three real `PoolManager.swap` calls and reinjects the
  retained profit; ARBFOLD executes the verified direct claim transition.
- Compiler, optimizer, EVM and dependency versions are frozen in
  [`environment.json`](environment.json).

## Mechanical result

- User output: `30220363129338304386` wei A in both paths.
- Solver reward: `85849039116169484` wei A in both paths.
- Six final reserves: equal within one wei.
- Claims equal virtual reserves: pass.
- Underlying PoolManager backing: exact.
- Participating invariants: non-decreasing.
- Canonical residual cyclic profit: zero.
- Persistent currency deltas after unlock: zero.

The raw values are in [`raw.json`](raw.json), the concise captured run is in
[`forge-test.txt`](forge-test.txt), and the exact delivered-source manifest is
[`source-manifest.sha256`](source-manifest.sha256).

## Research boundary

```text
Economic-superiority hypothesis       KILLED
Historical minimal-harness result      39.58% less at 100k
Earlier clean-core result              18.86% less at 100k
Release-candidate result               19.12% less at 100k
Production deployment                  NOT AUTHORIZED
Research-grade UHI10 primitive         IMPLEMENTED
```

This report supports a specialized execution-efficiency claim. It does not
claim universal gas savings, 10% greater LP net value, the paper's global
optimizer, compatibility with existing v4 pools or production safety.
