# ARBFOLD benchmark index

The repository preserves every benchmark generation. Only one package is the
current UHI10 submission benchmark.

## Current submission benchmark

[`optimized-release-candidate-results/`](optimized-release-candidate-results/)
is the authoritative ARBFOLD v0.1 package. It contains:

- the five frozen workloads;
- the 1k–200k dense sweep;
- the six pool/direction paths;
- paired user outputs and fixed external-recipient rewards;
- compiler and environment evidence;
- raw Forge output and the source manifest.

Canonical result:

```text
100k iterative reference   544,219 total gas
100k ARBFOLD v0.1          375,171 total gas
                            31.062495% less
```

The boundary matters: 1k–4k execute zero fold rounds and cost more. Every one
of the 196 actionable points from 5k–200k was cheaper only in the tested
canonical path. Read the [current report](optimized-release-candidate-results/REPORT.md)
before citing any result.

## Historical evidence

| Directory | Meaning |
|---|---|
| [`release-candidate-results/`](release-candidate-results/) | Published v0 release grid: 19.12% canonical reduction and a 25k regression. |
| [`clean-core-results/`](clean-core-results/) | Earlier safety-hardened clean-core validation: 18.86% canonical reduction. |
| [`arbfold-results/`](arbfold-results/) | Preregistered economic gate and rejected 10% LP-net-value hypothesis. |
| [`arbfold-foundry/`](arbfold-foundry/) | Smaller frozen research harness with the historical 39.58% result. |

These directories remain immutable for traceability. They are not alternative
headline measurements for v0.1.
