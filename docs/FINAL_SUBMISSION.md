# ARBFOLD — Final Submission Copy

This is the copy-ready source of truth for the UHI10 final form. Personal
identity fields and the final video URL remain for Daniel to enter manually.
Project ID `HK-UHI10-1057` was originally registered as MATURE; the
evidence-driven pivot to ARBFOLD is documented in the repository.

## Core fields

| Field | Answer |
|---|---|
| Project ID | `HK-UHI10-1057` |
| Project title | `ARBFOLD — Gas-Efficient Defensive Rebalancing for Uniswap v4` |
| Cohort | `UHI7` |
| Submission type | `Hook Incubator (UHI)` |
| Team | `No — solo project by Daniel` |
| Theme | `Yes` |
| Tags | `CFMM`, `MEV`, `DEX`, `Security` |
| Partner | `Unichain` |
| Public repository | `https://github.com/danelerr/arbfold-uhi10` |
| Frontend | `https://danelerr.github.io/arbfold-uhi10/` |
| Thumbnail | [`assets/arbfold-uhi10-thumbnail.png`](../assets/arbfold-uhi10-thumbnail.png) |
| Demo video | `[DANIEL: paste final public video URL]` |
| Email | `[DANIEL: enter cohort email]` |
| X handle | `[DANIEL: enter X handle]` |

## One-to-two sentence description

ARBFOLD is a Uniswap v4 custom-accounting experiment that lets three
cooperating CPMM pools fold a cyclic arbitrage opportunity directly into their
PoolManager-backed ERC-6909 reserves. In the canonical 100k Foundry benchmark,
it reaches the equivalent post-arbitrage state with unchanged user output and
solver reward while using 19.12% less gas; the advantage is workload-dependent
and the complete five-point grid is public.

## Partner integration

ARBFOLD is publicly deployed on Unichain Sepolia (chain 1301) against the
official Uniswap v4 `PoolManager` at
`0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`. The deployment comprises three
hook-owned CPMM pools, a coordinator and a router. All 28 deployment
transactions and three demo transactions finalized successfully, and the
post-deployment verifier confirmed reserve-to-ERC-6909-claim equality,
underlying backing and zero canonical residual profit. The public canonical
transaction is
`0x6220b30fd09267c2d4f716ace816c4ebae4b9d5b9970cbe73cb3ccd665cfbf7c`.

## Problem and background

When three AMM pools contain a cyclic arbitrage opportunity, the conventional
atomic path executes the originating user swap, three additional AMM swaps and
then reinjects the retained profit. That path is general, but cooperating
hook-owned pools already have enough information to verify the desired
post-arbitrage state. ARBFOLD asks a narrower systems question: can Uniswap v4
custom accounting reach that same Pareto-safe state directly, without replaying
every swap leg?

The project is inspired by *Defensive Rebalancing for Automated Market Makers*
by Sam Devorsetz and Maurice Herlihy. It does not implement the paper's global
optimizer. It implements and measures a specialized three-CPMM transition.

## Impact and uniqueness

ARBFOLD demonstrates a v4-native execution primitive rather than another fee
policy or sidecar application. It keeps the user's output and capped solver
reward unchanged, transfers fully backed ERC-6909 claims directly between three
custom-curve hooks, and accepts a fold only when token conservation, positive
reserves, non-decreasing pool invariants and bounded residual arbitrage all
hold.

The comparison uses two end-to-end paths on a real Uniswap v4 `PoolManager`.
At the canonical 100k workload, the atomic backrun plus reinjection consumes
544,187 gas and the delivered ARBFOLD path consumes 440,128 gas: 19.12% less.
The result is deliberately disclosed as workload-dependent: ARBFOLD is 4.41%
cheaper at 10k, 0.98% more expensive at 25k, and 19.12% cheaper from 50k through
200k in the frozen grid. The six final reserves agree within one wei, user
output and solver reward are identical, backing is exact and canonical residual
cyclic profit is zero.

The public build includes 61 passing core tests, all-six-path stateful
invariants, 10,000-case release fuzzing, 50,000-case arithmetic fuzz and
differential verification, 98.50% project line coverage, a reviewed Slither
gate, a public Unichain Sepolia transaction and a wallet-free dashboard.

## Challenges

The hardest part was keeping three representations of value aligned during one
v4 unlock: each hook's virtual CPMM reserves, its ERC-6909 claim balances and
the PoolManager's underlying token backing. Return-delta swaps, hook permission
bits, six possible cycle origins and directions, integer rounding, solver reward
caps and complete currency settlement all had to remain consistent under fuzzed
and adversarial sequences.

The second challenge was designing an honest comparison. An early minimal
harness measured 39.58% lower gas, but the safety-hardened delivered code
measures 19.12% canonically and loses by 0.98% at 25k. We preserved every result
instead of selecting only the flattering one. We also preregistered a stronger
claim of 10% greater LP net value; it failed, so ARBFOLD is presented only as a
gas-efficient specialized transition—not as universally superior economics,
an audited protocol or a production deployment.

## Continue after graduation

`Yes.` The next research steps are to measure broader reserve distributions and
real opportunity sizes, formalize a cheap solver certificate, study ordering
and competing-searcher assumptions, and determine whether the primitive remains
useful beyond a three-CPMM network. Any production path would require an
independent audit and a separate authorization decision.

## Public proof links

- Dashboard: https://danelerr.github.io/arbfold-uhi10/
- Repository: https://github.com/danelerr/arbfold-uhi10
- Canonical transaction: https://sepolia.uniscan.xyz/tx/0x6220b30fd09267c2d4f716ace816c4ebae4b9d5b9970cbe73cb3ccd665cfbf7c
- Deployment manifest: https://danelerr.github.io/arbfold-uhi10/deployments/unichain-sepolia-1301.json
- Release benchmark: https://github.com/danelerr/arbfold-uhi10/blob/main/benchmark/release-candidate-results/REPORT.md
- Hook: https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldHook.sol#L72
- Coordinator: https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldCoordinator.sol#L144
- Router: https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldRouter.sol#L93
- Invariant suite: https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/test/ArbFoldInvariant.t.sol#L17

## Claims boundary

Use the canonical wording:

> Same outcome. Same user output. Same solver reward. 19.12% less gas at the
> canonical 100k benchmark.

Always pair it with:

> The advantage is workload-dependent: 4.41% less gas at 10k, 0.98% more at
> 25k, and 19.12% less from 50k through 200k in the fixed publication grid.

Do not claim universal MEV protection, global optimality, production safety,
compatibility with existing pools, universal gas savings or 10% greater LP
value.

## Personal fields

Daniel must choose the UHI rating and write the program feedback in his own
voice. Those answers are intentionally not fabricated here.
