# Limitations and Future Work

## What ARBFOLD v0.1 does not solve

### Not the global defensive-rebalancing optimizer

The academic paper studies a general convex program over networks of log-concave CFMMs. ARBFOLD v0.1 implements only a specialized three-CPMM cycle derived from a conventional optimal arbitrage followed by retained-profit reinjection.

### No demonstrated material LP-value uplift

The preregistered 10% LP net-value gate failed. At 0.01 gwei, the frozen benchmark measured only 0.000287% improvement because gas cost was tiny relative to the chosen gross surplus. The supported result is lower execution gas for an equivalent state—not universal economic superiority.

The delivered fixed 10% reward is identical in the backrun and direct paths.
Consequently the gas saving accrues to the gas payer/reward recipient; passing
it through to LPs would require a different recipient-pricing mechanism that v0.1
does not implement.

### New custom pools only

Hooks are fixed in a v4 `PoolKey`. ARBFOLD requires new `BaseCustomCurve` pools with hook-owned liquidity and cannot be attached to existing concentrated-liquidity pools.

### Ordering remains an external constraint

The transition is atomic when the originating transaction requests it. ARBFOLD does not guarantee that this transaction wins ordering against other searchers, builders or private order-flow systems.

Fold mode is not mandatory at the hook level. Empty `hookData` executes a plain
custom-curve swap, so protocol-level internalization depends on routing and
order-flow adoption.

### Residual threshold is not a universal runtime postcondition

The coordinator stops early below `1e12` units and caps execution at eight
rounds. It emits the terminal residual and computes the current value on demand
through `lastResidualProfit()`, but does not revert solely because the
residual remains above threshold after round eight. Fixed-grid tests and the
deterministic 50,000-network valid-fold sample stayed below the threshold; that
is empirical evidence rather than a formal guarantee.

### Restricted asset and swap model

The benchmark assumes standard 18-decimal ERC-20s, no transfer fees, no rebasing, no callbacks and exact-input execution. Native currency, exact-output, fee-on-transfer and rebasing assets are out of scope.

### Experimental dependencies

OpenZeppelin marks the custom-accounting and custom-curve hook bases as experimental. ARBFOLD inherits their assumptions and has not been audited independently.

### Fixed external-recipient reward

The 10% fixed external-recipient reward exists only to hold the frozen comparison constant. It is not claimed to be an optimal production reward policy.

### Steady-state telemetry gas is not measured

Steady-state telemetry gas has not been measured with a cross-transaction
harness and is not claimed in this release. A valid follow-up would establish
nonzero telemetry in an earlier Anvil transaction or equivalent RPC prestate
before starting the measured transaction.

The immutable v0 deployment allowed a caller to choose a registered hook as the
reward recipient, which could diverge claims from recorded reserves. v0.1
rejects `address(0)`, the coordinator, PoolManager and all three registered
hooks, while allowing other contract recipients such as smart accounts or
vaults. The historical v0 counterexample remains preserved; the new guard is
not presented as a retroactive fix to that release.

### Zero-round calls are avoidable overhead

In the v0.1 canonical dense sweep, 1k–4k calls execute no direct settlement
rounds and cost more than the reference path. From 5k–200k, all 196 actionable
rows are cheaper in that tested path. ARBFOLD does not yet include a universal
route-selection service; callers should avoid requesting folding when no
actionable cycle exists.

### Router compatibility

The hook uses `beforeSwapReturnDelta`, so general routing requires explicit support/allowlisting. The included router is intentionally minimal and exact-input only.

## Research-grade future work

The following belong to the V1 roadmap and are deliberately absent from v0.1:

1. historical opportunity-frequency analysis on relevant v4 pool networks;
2. net settlement of all rounds into one aggregate transfer plan;
3. optional removal or offchain replacement of onchain telemetry;
4. a `RewardVault`, solver auction or enforceable reward floor;
5. a new factory and support for arbitrary networks or cycle lengths;
6. new LP reward redistribution or other economic mechanisms;
7. any generalized claim/reserve invariant that changes current semantics;
8. mandatory residual reverts or mandatory folding;
9. token-behavior adapters, decimal normalization and cheap certificates;
10. formal verification, an explicit competition/orderflow model and an
    independent security review before any production discussion.

None of these are implied to exist in v0.1.
