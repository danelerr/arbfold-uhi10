# ARBFOLD clean-core publication validation — Freeze v1

## Purpose

This is a publication-integrity check, not a new economic hypothesis or a
replacement for the immutable v0 report. It asks whether the safety-hardened
contracts under `contracts/src/` reproduce the same mechanical result and
execution advantage as the frozen harness after fixing the independent-state
snapshot used by the coordinator's onchain guards.

No v0 parameter, threshold or decision is reopened. The v0 economic-superiority
claim remains killed.

## Code and environment

- Solidity `0.8.26`, Cancun EVM, optimizer enabled with 200 runs, no IR.
- The exact published `ArbFoldHook`, `ArbFoldCoordinator`, `ArbFoldRouter` and
  `CycleMath` are used by the direct path.
- Both paths start from snapshots of the same deployed environment and the same
  test-only coordinator subclass. The subclass changes no inherited direct-fold
  behavior and only exposes the reserve-credit method needed after the
  reference path's real three swaps.
- Hook addresses are mined and deployed through the published
  `ArbFoldHookDeployer`; no `vm.etch` or memory-only pools are allowed.
- Both paths use real `PoolManager` instances, OpenZeppelin `BaseCustomCurve`
  pools and PoolManager-backed ERC-6909 claims.

## Fixed market and calls

- Pools: A/B, B/C and A/C.
- Initial reserves: `333.333333333333333333 A / 1,000,000 quote` in AB and AC;
  `1,000,000 / 1,000,000` in BC.
- Fixed 30 bps CPMM fee.
- Originating exact-input B→A sizes: 10k, 25k, 50k, 100k and 200k.
- Canonical size: 100k.
- Maximum 8 fold/backrun rounds, residual threshold `1e12` wei A.
- Solver receives exactly 10% of threatened cyclic profit each round.

## End-to-end paths

Reference path:

```text
public router call → PoolManager.unlock → user swap → 3 real PoolManager swaps
→ solver mint + retained-profit claim reinjection → settlement
```

Direct path:

```text
published ArbFoldRouter call → PoolManager.unlock → published hook user swap
→ published coordinator direct claim transition → settlement
```

Total gas includes measured external execution, 21,000 intrinsic gas and the
actual calldata byte cost for each same-signature public call. Deployment,
address mining and liquidity initialization are excluded.

## Required checks

For every size:

1. identical user output;
2. identical solver reward;
3. all six final reserves equal within one wei;
4. claims equal virtual reserves;
5. exact underlying PoolManager backing;
6. no pool invariant decreases from the post-user state;
7. residual cyclic profit is at most `1e12` wei A;
8. no unsettled delta survives either unlock.

The resulting gas grid and canonical reserves will be published even if the
clean-core percentage differs from 39.58%. The frozen 39.58% result remains
labelled as v0 and will not be silently substituted.
