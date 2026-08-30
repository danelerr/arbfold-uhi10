# ARBFOLD — Progress Update 2

Project ID: `HK-UHI10-1057`  
Registered idea: MATURE  
Final project: **ARBFOLD — Direct State Settlement for Cyclic Arbitrage**

## Update

ARBFOLD v0.1 is now the single version used by the public demo, dashboard,
benchmark and final-submission materials. It is deployed on Unichain Sepolia
against the official Uniswap v4 `PoolManager` with three hook-owned CPMM pools,
a coordinator and a router.

The canonical controlled Foundry benchmark starts both paths from identical
snapshots. At the 100k workload, the iterative reference executes two cyclic
rounds—six swaps and two profit reinjections—while one ARBFOLD `fold()` call
applies two runtime-checked direct settlement rounds:

```text
Iterative reference   544,219 total gas
ARBFOLD v0.1          375,171 total gas
Measured reduction    31.062495%
```

User output and the fixed external-recipient reward are exactly equal, final
reserves are equivalent within the measured tolerance, and canonical residual
arbitrage is zero. The complete frozen grid is cheaper for ARBFOLD at 10k,
25k, 50k, 100k and 200k. The dense sweep discloses the boundary: 1k–4k execute
zero fold rounds and cost more; all 196 actionable workloads from 5k–200k are
cheaper in the tested canonical path. This is not a universal gas claim.

The public v0.1 canonical transaction executes the same internal B→A path,
which is ARFY→ARFX in the deployed token mapping. It completed two fold rounds
inside one transaction and ended with zero residual. The Swap Lab lets judges
inspect the three valueless test tokens and execute a fresh v0.1 testnet swap.
Live transactions are exploratory; they are not used as the apples-to-apples
gas benchmark.

## Verification completed

- 82 Solidity tests pass in default and release profiles.
- Release fuzzing uses 10,000 cases and stateful invariants cover all six paths.
- The differential arithmetic check uses 50,000 samples.
- PoolManager backing, claims, reserves and persistent deltas are checked.
- Slither has zero unreviewed High/Medium findings.
- The versioned benchmark includes raw data, a dense sweep, six-path matrix,
  compiler matrix, source manifest and fail-closed JS/Python consumers.
- The rejected 10% LP-net-value hypothesis remains preserved as research
  history; ARBFOLD claims execution efficiency, not universal economic
  superiority or production readiness.

## Links

- Dashboard: https://danelerr.github.io/arbfold-uhi10/
- Repository: https://github.com/danelerr/arbfold-uhi10
- Final source tag: https://github.com/danelerr/arbfold-uhi10/tree/uhi10-final
- v0.1 benchmark: https://github.com/danelerr/arbfold-uhi10/blob/uhi10-final/benchmark/optimized-release-candidate-results/REPORT.md
- v0.1 deployment manifest: https://danelerr.github.io/arbfold-uhi10/deployments/unichain-sepolia-1301-v0.1.json
- Canonical transaction: https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022

## Remaining work

No new mechanism or feature work. The remaining manual tasks are recording the
human-narrated video and submitting the same v0.1 links in the final UHI10
form.
