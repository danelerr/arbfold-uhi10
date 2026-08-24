# ARBFOLD — Progress Update 1

## One-line thesis

**Can cooperating Uniswap v4 pools reach the same Pareto-safe post-arbitrage outcome more efficiently through a verified direct reserve transition?**

## What is already working

ARBFOLD is now a functional research-grade v4 prototype, not only a simulation:

- three hook-owned CPMMs running against a real Uniswap v4 `PoolManager`;
- OpenZeppelin `BaseCustomCurve` custom accounting;
- an atomic direct transition using fully backed ERC-6909 claims;
- exact-input user output and a capped solver reward;
- onchain conservation, backing, authorization and non-decreasing-invariant checks;
- unit, fuzz and stateful invariant tests;
- a reproducible Foundry comparison against a three-leg atomic backrun plus profit reinjection;
- a public interactive benchmark dashboard.

## Measured result

> **Same outcome. Same user output. Same solver reward. 18.86% less gas at the canonical 100k benchmark.**

At 100k, the published safety-hardened core measured:

```text
Atomic backrun + reinjection   537,896 gas
ARBFOLD direct transition     436,430 gas
Reduction                     18.86%
```

The result is workload-dependent, and we disclose the complete fixed grid:

```text
10k      4.21% less
25k      1.13% more
50k     18.86% less
100k    18.86% less
200k    18.86% less
```

Across the clean-core gate, the user output and solver reward are identical, the six final reserves agree within 1 wei, PoolManager backing is exact and canonical residual cyclic profit is zero.

## Research integrity

Our original preregistered economic claim required at least 10% more LP net value. It failed: the measured improvement under the frozen gas-price assumption was only 0.000287%. We preserved that `KILL_ARBFOLD` decision and narrowed the project to the systems result the evidence supports.

```text
Economic-superiority thesis   KILLED
Production deployment         NOT AUTHORIZED
Research-grade UHI10 build    IMPLEMENTED
```

ARBFOLD does not claim universal economic superiority, production readiness or implementation of the paper's global optimizer.

## Links

- Repository: https://github.com/danelerr/arbfold-uhi10
- Live dashboard: https://danelerr.github.io/arbfold-uhi10/
- Clean-core report: https://github.com/danelerr/arbfold-uhi10/blob/main/benchmark/clean-core-results/REPORT.md
- CI: https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml

## Next checkpoint

No new mechanism or sponsor integration. The remaining work is presentation: verify the hosted dashboard, record a human-narrated demo under five minutes, and submit direct links to the hook, coordinator, tests and evidence.
