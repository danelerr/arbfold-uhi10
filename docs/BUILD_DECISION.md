# ARBFOLD UHI10 Build Decision

## Canonical status

```text
Economic claim: >=10% more LP net value       KILLED
Frozen decision/report                         PRESERVED
Production or mainnet authorization            NO
Research-grade UHI10 implementation            YES
New mechanism ideation                         STOPPED
```

The frozen report at [`benchmark/arbfold-results/REPORT.md`](../benchmark/arbfold-results/REPORT.md) is not reinterpreted. It answered a product/economic question and correctly rejected the claim that gas savings created at least 10% greater LP net value in the canonical environment.

UHI10 requires a functional, original v4 hook, public code, a demo, tests or frontend, and a clear account of problem, impact, uniqueness and challenges. It does not require production authorization. ARBFOLD is therefore built as an experiment around the result that actually passed.

## Authorized claims

> In the publication validation, the safety-hardened direct transition reaches the same final reserve state as an atomic three-leg backrun plus profit reinjection, with identical user output, identical solver reward, non-decreasing invariants, exact PoolManager backing and 18.86% less canonical total gas.

> The immutable minimal v0 harness measured 39.58% less canonical gas. That historical number must always be labelled as the frozen harness result, not the delivered clean-core result.

The published grid also discloses that the clean direct path used 1.13% more gas at 25k; gas superiority is workload-dependent.

## Prohibited claims

- ARBFOLD produces at least 10% more LP net value.
- ARBFOLD implements the global optimum from the Defensive Rebalancing paper.
- ARBFOLD eliminates all MEV, LVR or arbitrage.
- ARBFOLD attaches to existing v4 pools.
- ARBFOLD is audited, production-safe or ready for mainnet capital.
- ARBFOLD is universally superior to atomic backrunning.
- ARBFOLD is the first implementation ever.

## Scope lock

The submission contains only:

1. three hook-owned 30 bps CPMMs;
2. one fixed-network coordinator;
3. one exact-input router that triggers folding inside the originating unlock;
4. direct backed ERC-6909 claim transfers;
5. onchain invariant and conservation guards;
6. a reproducible Foundry suite and deployment script;
7. a single benchmark dashboard;
8. judge-facing documentation and explicit limitations.

No new fee mechanism, auction, oracle, optimizer, cross-chain component or sponsor integration is authorized before the core submission is complete.
