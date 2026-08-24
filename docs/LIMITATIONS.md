# Limitations and Future Work

## What ARBFOLD v0 does not solve

### Not the global defensive-rebalancing optimizer

The academic paper studies a general convex program over networks of log-concave CFMMs. ARBFOLD v0 implements only a specialized three-CPMM cycle derived from a conventional optimal arbitrage followed by retained-profit reinjection.

### No demonstrated material LP-value uplift

The preregistered 10% LP net-value gate failed. At 0.01 gwei, the frozen benchmark measured only 0.000287% improvement because gas cost was tiny relative to the chosen gross surplus. The supported result is lower execution gas for an equivalent state—not universal economic superiority.

### New custom pools only

Hooks are fixed in a v4 `PoolKey`. ARBFOLD requires new `BaseCustomCurve` pools with hook-owned liquidity and cannot be attached to existing concentrated-liquidity pools.

### Ordering remains an external constraint

The transition is atomic when the originating transaction requests it. ARBFOLD does not guarantee that this transaction wins ordering against other searchers, builders or private order-flow systems.

### Restricted asset and swap model

The benchmark assumes standard 18-decimal ERC-20s, no transfer fees, no rebasing, no callbacks and exact-input execution. Native currency, exact-output, fee-on-transfer and rebasing assets are out of scope.

### Experimental dependencies

OpenZeppelin marks the custom-accounting and custom-curve hook bases as experimental. ARBFOLD inherits their assumptions and has not been audited independently.

### Fixed solver reward

The 10% reward exists only to hold the frozen comparison constant. It is not claimed to be an optimal or production-ready solver market.

### Router compatibility

The hook uses `beforeSwapReturnDelta`, so general routing requires explicit support/allowlisting. The included router is intentionally minimal and exact-input only.

## Research-grade future work

Only after the Hookathon core is complete:

1. historical opportunity-frequency analysis on relevant v4 pool networks;
2. comparison of new safety guards against the frozen gas harness;
3. arbitrary cycle length with cheap onchain certificates;
4. a solver auction or enforceable reward floor;
5. explicit competition/orderflow model;
6. token-behavior adapters and decimal normalization;
7. formal verification of conservation and monotonicity;
8. independent security review before any production discussion.

None of these are implied to exist in v0.

