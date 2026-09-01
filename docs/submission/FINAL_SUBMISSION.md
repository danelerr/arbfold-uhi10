# ARBFOLD — Final Submission Copy

This is the copy-ready source of truth for the UHI10 final form. Personal
identity fields and the final video URL remain for Daniel to enter manually.
Project ID `HK-UHI10-1057` was originally registered as MATURE; the
evidence-driven pivot to ARBFOLD is documented in the repository.

## Core fields

| Field | Answer |
|---|---|
| Project ID | `HK-UHI10-1057` |
| Project title | `ARBFOLD — Direct State Settlement for Cyclic Arbitrage` |
| Cohort | `UHI7` |
| Submission type | `Hook Incubator (UHI)` |
| Team | `No — solo project by Daniel` |
| Theme | `Yes` |
| Tags | `CFMM`, `MEV`, `DEX`, `Security` |
| Partner | `Unichain` |
| Public repository | `https://github.com/danelerr/arbfold-uhi10` |
| Frontend | `https://danelerr.github.io/arbfold-uhi10/` |
| Thumbnail | [`assets/arbfold-uhi10-thumbnail.png`](../../assets/arbfold-uhi10-thumbnail.png) |
| Demo video | `[DANIEL: paste final public video URL]` |
| Email | `[DANIEL: enter cohort email]` |
| X handle | `[DANIEL: enter X handle]` |

## One-to-two sentence description

ARBFOLD is a Uniswap v4 custom-accounting experiment in which one `fold()` call
can process multiple runtime-checked direct settlement rounds across three
cooperating CPMMs. At canonical 100k, it reaches equivalent final reserves
within measured tolerance with the same user output and fixed
external-recipient reward while using 31.06% less total gas than the iterative
reference; zero-round workloads remain outside the efficiency claim.

## Partner integration

ARBFOLD v0.1 is publicly deployed on Unichain Sepolia (chain 1301) against the
official Uniswap v4 `PoolManager` at
`0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`. The deployment comprises three
hook-owned CPMM pools, a coordinator and a router. The deployment and canonical
demo transactions finalized successfully, and the
post-deployment verifier confirmed reserve-to-ERC-6909-claim equality for its
external reward recipient, underlying backing and zero canonical residual
profit. The public canonical
transaction is
`0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022`.
It executes the canonical internal B→A path—ARFY→ARFX in this deployment—and
emits two `FoldRound` events followed by `FoldCompleted` with zero residual.
The Swap Lab uses these same v0.1 contracts and lets a judge submit a fresh
testnet transaction; the controlled Foundry benchmark remains the only
apples-to-apples comparison between the reference and direct paths.

## Problem and background

When three AMM pools contain a cyclic arbitrage opportunity, the conventional
atomic path executes the originating user swap, three additional AMM swaps and
then reinjects the retained profit. That path is general, but cooperating
hook-owned pools already have enough information to runtime-check the desired
post-arbitrage state. ARBFOLD asks a narrower systems question: can Uniswap v4
custom accounting reach that same Pareto-safe state directly, without replaying
every swap leg?

The project is inspired by *Defensive Rebalancing for Automated Market Makers*
by Sam Devorsetz and Maurice Herlihy. It does not implement the paper's global
optimizer. It implements and measures a specialized three-CPMM transition.

## Impact and uniqueness

ARBFOLD demonstrates a v4-native settlement primitive rather than another fee
policy or sidecar application. It keeps the user's output and fixed
external-recipient reward unchanged, transfers fully backed ERC-6909 claims directly between three
custom-curve hooks, and checks token conservation, reserve bounds and
non-decreasing pool invariants on every accepted round. The frozen release
scenarios additionally require final residual arbitrage below the published
threshold.

The comparison uses two end-to-end paths on a real Uniswap v4 `PoolManager`.
At canonical 100k, the iterative reference executes two cyclic rounds—six
swaps and two profit reinjections—and consumes 544,219 total gas. One ARBFOLD
call applies two direct settlement rounds and consumes 375,171: 31.06% less.
At 25k, the former v0 regression is removed: 409,402 versus 329,777, or 19.45%
less. All five frozen actionable rows are cheaper, and all 196 actionable rows
from 5k–200k are cheaper in the dense canonical sweep. The 1k–4k rows execute
zero folds and remain more expensive. User output and the fixed
external-recipient reward match; final reserves are equivalent within measured
tolerance, backing remains exact and canonical residual profit is zero.

The v0.1 release includes 82 passing Solidity tests in both default and release
profiles. The evidence also
includes all-six-path stateful invariants, 10,000-case release fuzzing,
50,000-case arithmetic fuzz and differential verification, 98.61% project line
coverage, a reviewed Slither gate, public Unichain Sepolia transactions, live
RPC verification, a no-wallet contract dry-run and an optional signed testnet
execution dashboard.

## Challenges

The hardest part was keeping three representations of value aligned during one
v4 unlock: each hook's virtual CPMM reserves, its ERC-6909 claim balances and
the PoolManager's underlying token backing. Return-delta swaps, hook permission
bits, six possible cycle origins and directions, integer rounding, fixed reward
caps and complete currency settlement all had to remain consistent under fuzzed
and adversarial sequences.

The second challenge was designing an honest comparison. An early minimal
harness measured 39.58% lower gas, while the v0 release measured 19.12%
canonically and lost by 0.98% at 25k. v0.1 now measures 31.06% canonically and
19.45% less at 25k. Every historical raw result remains unchanged instead of
being overwritten. We also preregistered a stronger
claim of 10% greater LP net value; it failed, so ARBFOLD is presented only as a
gas-efficient specialized transition—not as universally superior economics,
an audited protocol or a production deployment.

A later claim-by-claim audit found that v0 allowed the public reward address to
alias a registered hook and break claim/reserve continuity. The finding remains
preserved in the [historical thesis reassessment](../../research/archive/decisions/THESIS_REASSESSMENT_2026-08-29.md).
v0.1 rejects zero, coordinator, PoolManager and hook aliases atomically and
measures that hardening as a new release rather than silently changing v0.

## Continue after graduation

`Yes.` The next research steps are to measure broader reserve distributions and
real opportunity sizes, formalize a cheap solver certificate, study ordering
and competing-searcher assumptions, and determine whether the primitive remains
useful beyond a three-CPMM network. Any production path would require an
independent audit and a separate authorization decision.

## Public proof links

- Dashboard: https://danelerr.github.io/arbfold-uhi10/
- Repository: https://github.com/danelerr/arbfold-uhi10
- Canonical v0.1 transaction: https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022
- Deployment manifest: https://danelerr.github.io/arbfold-uhi10/deployments/unichain-sepolia-1301-v0.1.json
- v0.1 benchmark: https://github.com/danelerr/arbfold-uhi10/blob/uhi10-final/benchmark/optimized-release-candidate-results/REPORT.md
- Historical v0 release benchmark: https://github.com/danelerr/arbfold-uhi10/blob/main/benchmark/release-candidate-results/REPORT.md
- Hook: https://github.com/danelerr/arbfold-uhi10/blob/uhi10-final/contracts/src/ArbFoldHook.sol#L72
- Coordinator: https://github.com/danelerr/arbfold-uhi10/blob/uhi10-final/contracts/src/ArbFoldCoordinator.sol#L144
- Router: https://github.com/danelerr/arbfold-uhi10/blob/uhi10-final/contracts/src/ArbFoldRouter.sol#L93
- Invariant suite: https://github.com/danelerr/arbfold-uhi10/blob/uhi10-final/contracts/test/ArbFoldInvariant.t.sol#L17

## Claims boundary

Use the canonical wording:

> Don’t replay every leg. Settle the equivalent state. At canonical 100k, one
> `fold()` call applies two runtime-checked direct settlement rounds and uses
> 31.06% less total gas than the iterative reference.

Always pair it with:

> The execution-gas advantage holds in the tested actionable workloads: all
> five frozen rows and all 196 actionable dense-sweep rows. Calls at 1k–4k
> execute zero rounds and are more expensive.

Do not claim universal MEV protection, global optimality, production safety,
compatibility with existing pools, universal gas savings or 10% greater LP
value.

## Personal fields

Daniel must choose the UHI rating and write the program feedback in his own
voice. Those answers are intentionally not fabricated here.
