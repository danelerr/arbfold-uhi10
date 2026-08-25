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
- a public interactive benchmark dashboard;
- a research deployment and canonical transaction on Unichain Sepolia using the official v4 `PoolManager`.

## Measured result

> **Same outcome. Same user output. Same solver reward. 19.12% less gas at the canonical 100k benchmark.**

At 100k, the delivered release-candidate core measured:

```text
Atomic backrun + reinjection   544,187 gas
ARBFOLD direct transition     440,128 gas
Reduction                     19.12%
```

The result is workload-dependent, and we disclose the complete fixed grid:

```text
10k      4.41% less
25k      0.98% more
50k     19.12% less
100k    19.12% less
200k    19.12% less
```

Across the release gate, the user output and solver reward are identical, the six final reserves agree within 1 wei, PoolManager backing is exact and canonical residual cyclic profit is zero. The public demo separately completed two fold rounds with zero residual profit and passed the post-deployment reserve/claim/backing verifier.

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
- Release report: https://github.com/danelerr/arbfold-uhi10/blob/main/benchmark/release-candidate-results/REPORT.md
- Public transaction: https://sepolia.uniscan.xyz/tx/0x6220b30fd09267c2d4f716ace816c4ebae4b9d5b9970cbe73cb3ccd665cfbf7c
- Deployment manifest: https://github.com/danelerr/arbfold-uhi10/blob/main/deployments/unichain-sepolia-1301.json
- CI: https://github.com/danelerr/arbfold-uhi10/actions/workflows/ci.yml

## Next checkpoint

No new mechanism or sponsor integration. The remaining work is presentation: record a human-narrated demo under five minutes and submit direct links to the hook, coordinator, tests and evidence.
