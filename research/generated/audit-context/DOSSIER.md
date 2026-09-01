# ARBFOLD audit context dossier

## Scope and evidence fingerprint

This dossier is an orientation artifact, not a vulnerability report. It maps the
release source under `contracts/src` as it exists at repository commit
`f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`. No contract, deployment or
benchmark file was changed while producing it.

| Source | SHA-256 |
| --- | --- |
| `ArbFoldCoordinator.sol` | `6b9dcaaa477d7b1cf29bde1bb73150bafad3b53e43e5e3caad243af537ddccf9` |
| `ArbFoldHook.sol` | `5ebcc6b78eb316348bbe029aa1fcd371f081a255109197622bbf1e1a1ba65a13` |
| `ArbFoldHookDeployer.sol` | `e84907b1b036c4e4ee19d5d601362cd55ba8188fdcf1d0062142ae382ef9f8e2` |
| `ArbFoldRouter.sol` | `6d9b4c8d970ea239e2d54de593b5c9a117352b31eaf02500b26fe0e4b404a5d0` |
| `CycleMath.sol` | `092552ce5bb9e0aa3be3c546a4d11ef52eff5536e5abfae0b23421faf42d981a` |
| `DemoToken.sol` | `1b986f46764a9a890c056943c46ebf7bd606b1f18c7d39ca14736b651dcbde91` |
| `IArbFold.sol` | `2318627484ba45911f929f5d2c7c45abda09299d18893f1971a6585a6c03052f` |

Pinned dependencies followed for call continuity:

- OpenZeppelin Uniswap Hooks `12048bb17b93ad9ed683aff9c34b89596280c77d`
  (`BaseCustomCurve`, `BaseCustomAccounting`, `BaseHook`, `CurrencySettler`).
- Uniswap v4 core `d153b048868a60c2403a3ef5b2301bb247884d46`
  (`PoolManager`, `Hooks`, ERC-6909 accounting).
- OpenZeppelin Contracts `fcbae5394ae8ad52d8e580a3477db99814b9d565`.

Reproduction checks run after writing the dossier:

```text
cd contracts && forge test
62 passed; 0 failed; 0 skipped
```

This consists of the 61 frozen release tests plus one post-review regression
that reproduces the registered-hook reward-recipient aliasing case. The run
includes the six origin/direction paths and stateful claims, backing,
product, reward, configuration, residual and transient-delta properties
(`contracts/test/ArbFoldInvariant.t.sol:L125-L192`). Passing tests are evidence
for those exercised properties, not substitutes for the runtime-enforcement
distinctions recorded below.

## What thesis this code actually implements

The release asks whether three cooperating, hook-owned CPMMs can reach the
specialized post-arbitrage state of a three-leg cyclic backrun plus profit
reinjection through a cheaper direct reserve transition. The production source
implements one fixed topology, `A/B`, `B/C`, and `A/C`, with 30 bps CPMM math
(`CycleMath.GAMMA = 997000`, `DENOMINATOR = 1000000`) and an A-denominated
closed-form cyclic quote (`contracts/src/CycleMath.sol:L6-L15`, L19-L40).

`A`, `B`, and `C` in Solidity are internal currency roles, not ticker labels.
In the current Unichain Sepolia deployment, role `A`/manifest `a` is **ARFY**,
role `B`/manifest `b` is **ARFX**, and role `C`/manifest `c` is **ARFZ**
(`app/swap-lab-core.js:L1-L10`). Consequently the deployed `AB`, `BC`, and
`AC` hooks represent ARFY/ARFX, ARFX/ARFZ, and ARFY/ARFZ respectively; the UI
deliberately sorts the visible pair labels rather than renaming Solidity roles
(`app/swap-lab-core.js:L47-L52`).

What the code establishes is mechanical:

1. The originating exact-input user swap is computed and booked first by the
   custom curve (`ArbFoldHook.sol:L72-L83`; inherited implementation at
   `BaseCustomCurve.sol:L86-L149`).
2. If the router supplied valid fold `hookData`, the hook invokes the fixed
   coordinator before returning from that same `beforeSwap` callback
   (`ArbFoldHook.sol:L77-L83`).
3. The coordinator selects the more profitable of the forward and reverse
   A-denominated cycles, moves backed ERC-6909 claims directly between the
   three hooks, pays a 10% solver share, checks conservation and non-decreasing
   CPMM products, then writes the corresponding six virtual reserves
   (`ArbFoldCoordinator.sol:L110-L127`, L144-L183).
4. The router settles the user's two currency deltas before `PoolManager.unlock`
   can relock; v4 rejects an unlock with any nonzero delta
   (`ArbFoldRouter.sol:L93-L116`; `PoolManager.sol:L104-L114`).

The source does **not** implement the defensive-rebalancing paper's global
network optimizer. It implements the specialized state generated from the
closed-form three-swap cycle, while retaining threatened profit in the final
pool except for the solver reward (`CycleMath.sol:L59-L75`;
`ArbFoldCoordinator.sol:L151-L175`). The frozen release report separately
establishes benchmark equivalence and workload-dependent gas results; those are
not runtime guarantees created by these contracts.

## Component and authority map

| Component | Role | Reachability / authority |
| --- | --- | --- |
| `ArbFoldRouter` | Public exact-input entry point and v4 delta settlement | Any caller chooses registered origin hook, direction, amount, minimum output, solver, and deadline (`ArbFoldRouter.sol:L58-L90`). Only the fixed `PoolManager` may enter its callback (L93-L95). |
| Three `ArbFoldHook` instances | One hook-owned CPMM each; ERC-20 LP share token; virtual reserve ledger | `PoolManager` reaches inherited hook callbacks. Anyone may call `authorizeCoordinator`, but it grants authority only to the immutable coordinator (L52-L59). Only that coordinator may overwrite reserves (L61-L69). |
| `ArbFoldCoordinator` | Fixed-network quote, direct claim transfer, safety checks, counters | The deployer is immutable admin and may configure once (L56-L86). After configuration, only one of the three registered hooks may call `fold` (L89-L108). |
| `ArbFoldHookDeployer` | Permission-bit-compatible CREATE2 deployment | Anyone may deploy; the hook constructor inherited from `BaseHook` validates address permission bits. |
| `CycleMath` | Bounded 30 bps CPMM and closed-form three-leg quote | Internal pure library only. |
| `DemoToken` | Permissionless test asset | Anyone may mint any amount; explicitly demo-only (`DemoToken.sol:L6-L12`). |
| `PoolManager` | Underlying custody, ERC-6909 claims and atomic transient-delta ledger | External pinned dependency. It calls hook/router callbacks and rejects unsettled unlocks. |

Autogenerated getters are also public entry points: coordinator constants,
immutables, configured hooks and telemetry; hook `coordinator`, `poolManager`,
ERC-20 state; router immutables; and ERC-6909 state on `PoolManager`. They read
state but do not mutate the ARBFOLD network.

## Persistent state

### Coordinator

- Immutable: `manager`, `admin`, and token roles A/B/C
  (`ArbFoldCoordinator.sol:L30-L35`, L56-L65).
- One-time configuration: `hookAB`, `hookBC`, `hookAC`, `configured` (L36-L39,
  L69-L86).
- Telemetry: `totalFoldCalls`, `totalFoldRounds`, `totalSolverRewards`, and
  `lastResidualProfit` (L40-L43, L118-L127).

### Each hook

- Immutable coordinator and inherited immutable `poolManager`
  (`ArbFoldHook.sol:L34`, L43-L46; `BaseHook.sol:L34`, L49-L51).
- `_reserve0` / `_reserve1`: virtual CPMM reserves used for quotes (L35-L36).
- `_coordinatorAuthorized`: one-time local record that ERC-6909 operator
  approval was requested (L37, L53-L58).
- `_everFunded`: permanently prevents a second liquidity addition (L38,
  L110-L125).
- Inherited single `PoolKey` and ERC-20 LP balances/supply.

### PoolManager

- Underlying ERC-20 custody.
- ERC-6909 claim balances owned by hooks and solver.
- Transient per-unlock currency deltas. These must all return to zero at unlock
  completion (`PoolManager.sol:L104-L114`, L367-L384).

## End-to-end swap + fold call graph

```text
user
  -> ArbFoldRouter.swapExactInput
       -> PoolManager.unlock(Request)
            -> ArbFoldRouter.unlockCallback
                 -> hook.poolKey()
                 -> PoolManager.swap(..., hookData=(FOLD_MODE, solver))
                      -> ArbFoldHook.beforeSwap [inherited BaseHook gate]
                           -> ArbFoldHook._beforeSwap
                                -> BaseCustomCurve._beforeSwap
                                     -> ArbFoldHook._getUnspecifiedAmount
                                          -> CycleMath.swapOut
                                     -> ArbFoldHook._getSwapFeeAmount
                                     -> PoolManager.mint input claims to hook
                                     -> PoolManager.burn output claims from hook
                                -> ArbFoldCoordinator.fold
                                     -> network() [three reserve reads]
                                     -> CycleMath.best
                                     -> _applyDirect
                                          -> PoolManager.transferFrom claims
                                          -> _assertNonDecreasing
                                          -> _assertConservation
                                          -> three setReservesFromCoordinator calls
                 -> _settle(input currency, payer)
                 -> _settle(output currency, payer)
            -> PoolManager verifies zero outstanding deltas and relocks
       -> router validates output/minimum and emits SwapAndFold
```

The output is determined before `fold`: `BaseCustomCurve._beforeSwap` calls
`_getUnspecifiedAmount`, books claim changes and constructs the return delta
before control returns to `ArbFoldHook._beforeSwap`, which then calls the
coordinator (`BaseCustomCurve.sol:L92-L148`; `ArbFoldHook.sol:L77-L83`). Any
later revert unwinds both the user swap and fold because they are nested in the
same transaction and unlock.

The fold itself does not call `PoolManager.swap`, transfer underlying ERC-20s,
or create new transient currency deltas. `PoolManager.transferFrom` is the
inherited ERC-6909 claim transfer: it checks operator/allowance, subtracts the
sender's claim balance and adds the receiver's claim balance
(`ERC6909.sol:L35-L47`). The corresponding six virtual reserve writes happen
only after the coordinator's proposal checks. Underlying assets remain in the
PoolManager; ownership of their claims is reallocated among hooks and solver.

Empty `hookData` is a distinct reachable path: the hook executes the custom
curve swap and does not call `fold` (`ArbFoldHook.sol:L79-L83`). The dedicated
router always supplies nonempty valid fold data (`ArbFoldRouter.sol:L97-L105`).

## Exact direct transition

`CycleMath.best` evaluates both directions and returns the larger A-denominated
profit (`CycleMath.sol:L52-L57`). Each quote carries the A principal `q`, two
intermediate outputs, final A output, and `max(finalA-q, 0)` profit (L59-L75).

### Forward cycle: A -> B -> C -> A (`q.reverse == false`)

Claim movements (`ArbFoldCoordinator.sol:L151-L155`):

```text
hookAC -- q.amountAIn A ------------------> hookAB
hookAC -- reward A ------------------------> solver
hookAB -- q.intermediateFirst B -----------> hookBC
hookBC -- q.intermediateSecond C ----------> hookAC
```

Virtual reserve transition (L157-L162):

```text
AB: (A + q,                 B - first)
BC: (B + first,             C - second)
AC: (A - q - reward,        C + second)
```

The first two pool transitions equal the two ordinary CPMM legs. The final
pool receives the second intermediate amount but releases only principal plus
solver reward, rather than the ordinary final output `q + profit`. Thus
`profit - reward` remains in the final pool.

### Reverse cycle: A -> C -> B -> A (`q.reverse == true`)

Claim movements (L163-L167):

```text
hookAB -- q.amountAIn A ------------------> hookAC
hookAB -- reward A ------------------------> solver
hookAC -- q.intermediateFirst C -----------> hookBC
hookBC -- q.intermediateSecond B ----------> hookAB
```

Virtual reserve transition (L169-L174):

```text
AC: (A + q,                 C - first)
BC: (B - second,            C + first)
AB: (A - q - reward,        B + second)
```

Here AB is the final pool retaining `profit - reward`.

Claim transfers occur before the local safety calls and reserve writes
(`ArbFoldCoordinator.sol:L152-L182`). Reversion of a transfer, check or reserve
write unwinds all preceding changes in the transaction.

## Cross-contract invariants

### Runtime-enforced

1. **Registered topology.** The three hooks must be nonzero, distinct contracts,
   point back to this coordinator and manager, and expose exact A/B, B/C, A/C
   pool keys (`ArbFoldCoordinator.sol:L69-L86`, L130-L142).
2. **Fold caller.** Only one configured hook can invoke a fold; solver is
   nonzero (L89-L108).
3. **Bounded virtual reserves.** Initial funding uses `[MIN_NETWORK_RESERVE,
   MAX_INITIAL_RESERVE]`; swaps and coordinator reserve writes keep live values
   in `[MIN_NETWORK_RESERVE, MAX_NETWORK_RESERVE]`, except an intentional full
   liquidity withdrawal to `(0,0)` (`ArbFoldHook.sol:L61-L69`, L86-L103,
   L110-L127, L148-L170).
4. **Per-round CPMM products do not decrease.** `_assertNonDecreasing` compares
   all three `x*y` products before reserve writes (Coordinator L177-L203).
5. **Token conservation in the virtual ledger.** A after-pool totals plus solver
   reward equal A before-pool totals; B and C pool totals are unchanged
   (L206-L220).
6. **At least one product increases across a nonzero fold call.** Checked from
   the call's initial state to final state (L122-L124, L185-L193).
7. **Bounded execution.** At most eight rounds; each round requires quoted
   profit above `1e12` A units; solver receives 10% of quoted threatened profit
   (L15-L18, L112-L120).
8. **Atomic v4 settlement.** `PoolManager.unlock` reverts when any transient
   currency delta remains (`PoolManager.sol:L104-L114`).
9. **User slippage and deadline.** Router checks deadline before unlock and
   amount received after unlock; a failure reverts the whole call
   (`ArbFoldRouter.sol:L65-L90`).

### Maintained by call continuity, not rechecked inside `fold`

1. **Virtual reserves equal each hook's ERC-6909 claims only on the intended
   non-aliased reward path.** Initial liquidity and each custom swap update
   claims and reserves in matched amounts. A direct transition also does so
   when the reward recipient is external to the three hooks. `fold` reads only
   virtual reserves and never calls `PoolManager.balanceOf` before transferring
   or writing. Runtime establishment at fold entry: **nothing found inside
   `fold`**. In addition, the caller may select a registered hook as `solver`.
   The reward claim is then credited to that hook (or self-transferred) while
   the virtual transition treats it as leaving pool reserves, producing a
   claim/reserve mismatch. The invariant tests assert equality only with their
   fixed external solver (`ArbFoldTestBase.sol:L137-L145`;
   `ArbFoldInvariant.t.sol:L134-L136`).
2. **PoolManager underlying balances back all outstanding claims.** v4's settle,
   mint and burn accounting establishes this along intended paths, but ARBFOLD
   production functions do not sum underlying custody and claims. Runtime
   establishment at fold entry: **nothing found inside ARBFOLD**. The tests
   assert exact backing (`ArbFoldTestBase.sol:L147-L153`;
   `ArbFoldInvariant.t.sol:L138-L147`).
3. **Coordinator is an operator for every hook.** `authorizeCoordinator` calls
   `PoolManager.setOperator` once (`ArbFoldHook.sol:L52-L59`), but
   `configureHooks` does not read operator state. A successful direct transfer
   depends on deployment having called authorization; otherwise the claim
   transfer reverts. Establishment in configuration: **nothing found**; the
   deployment/test setup calls it explicitly (`ArbFoldTestBase.sol:L93-L119`).
4. **Stored pool key remains the one validated at configuration.** Inherited
   `BaseCustomAccounting._beforeInitialize` permits one initialization and then
   rejects another (`BaseCustomAccounting.sol:L318-L325`). The coordinator
   reads and validates that stored key once during configuration
   (`ArbFoldCoordinator.sol:L130-L142`).

## Function-record index

### Coordinator

- [`constructor`](functions/arb-fold-coordinator.constructor.md)
- [`configureHooks`](functions/arb-fold-coordinator.configure-hooks.md)
- [`isHook`](functions/arb-fold-coordinator.is-hook.md)
- [`network`](functions/arb-fold-coordinator.network.md)
- [`quote`](functions/arb-fold-coordinator.quote.md)
- [`fold`](functions/arb-fold-coordinator.fold.md)
- [`_validateHook`](functions/arb-fold-coordinator.validate-hook.md)
- [`_applyDirect`](functions/arb-fold-coordinator.apply-direct.md)
- [`_anyInvariantIncreased`](functions/arb-fold-coordinator.any-invariant-increased.md)
- [`_assertNonDecreasing`](functions/arb-fold-coordinator.assert-non-decreasing.md)
- [`_assertConservation`](functions/arb-fold-coordinator.assert-conservation.md)

### Hook

- [`constructor`](functions/arb-fold-hook.constructor.md)
- [`reserves`](functions/arb-fold-hook.reserves.md)
- [`authorizeCoordinator`](functions/arb-fold-hook.authorize-coordinator.md)
- [`setReservesFromCoordinator`](functions/arb-fold-hook.set-reserves-from-coordinator.md)
- [`_beforeSwap`](functions/arb-fold-hook.before-swap.md)
- [`_getUnspecifiedAmount`](functions/arb-fold-hook.get-unspecified-amount.md)
- [`_getSwapFeeAmount`](functions/arb-fold-hook.get-swap-fee-amount.md)
- [`_getAmountIn`](functions/arb-fold-hook.get-amount-in.md)
- [`_getAmountOut`](functions/arb-fold-hook.get-amount-out.md)
- [`_mint`](functions/arb-fold-hook.mint.md)
- [`_burn`](functions/arb-fold-hook.burn.md)

### Router, factory, math and demo token

- [`ArbFoldRouter.constructor`](functions/arb-fold-router.constructor.md)
- [`swapExactInput`](functions/arb-fold-router.swap-exact-input.md)
- [`unlockCallback`](functions/arb-fold-router.unlock-callback.md)
- [`_settle`](functions/arb-fold-router.settle.md)
- [`ArbFoldHookDeployer.deploy`](functions/arb-fold-hook-deployer.deploy.md)
- [`CycleMath.swapOut`](functions/cycle-math.swap-out.md)
- [`CycleMath.best`](functions/cycle-math.best.md)
- [`CycleMath._quoteForward`](functions/cycle-math.quote-forward.md)
- [`CycleMath._quoteReverse`](functions/cycle-math.quote-reverse.md)
- [`CycleMath._optimalInput`](functions/cycle-math.optimal-input.md)
- [`CycleMath._normalize`](functions/cycle-math.normalize.md)
- [`CycleMath._validateNetwork`](functions/cycle-math.validate-network.md)
- [`DemoToken.constructor`](functions/demo-token.constructor.md)
- [`DemoToken.mint`](functions/demo-token.mint.md)

`IArbFold.sol` contains declarations rather than implementations. Its methods
map to the implementation records above; inherited `poolManager()` and
`poolKey()` map to `BaseHook` and `BaseCustomAccounting` respectively.

## Complexity clusters

1. **Return-delta sequencing:** the user output, ERC-6909 claim mutation, direct
   fold, v4 hook delta accounting and router settlement are split across four
   contracts and two inherited bases.
2. **Three representations of value:** virtual reserves in hooks, ERC-6909
   claim balances in PoolManager, and underlying ERC-20 custody. Runtime guards
   cover virtual-state conservation, while equality among all three is a
   continuity invariant.
3. **Closed-form integer cycle math:** normalization and integer rounding feed
   a loop that may execute up to eight recalculated rounds.
4. **Two notions of success:** contracts enforce safe completion of the
   specialized transition; equivalence to a three-swap reference path and gas
   superiority are benchmark claims outside runtime code.

## Open questions carried forward

These are context gaps, not findings or recommendations.

1. The comments and thesis call the transition “Pareto-safe” using non-decreasing
   `x*y`. Is `x*y` the complete intended liquidity utility for every claim made
   about this specialized network, or only the runtime acceptance proxy?
2. What formal rounding bound connects `_optimalInput` after repeated
   normalization to the exact integer profit maximum? Tests establish local and
   randomized behavior, but no proof is present in `contracts/src`.
3. `RESIDUAL_THRESHOLD` is an absolute `1e12` token-A base units. What token
   decimal/scaling assumption makes this the intended economic no-arbitrage
   band? The core reads no token metadata.
4. Solver reward and all cycle profitability are denominated in token A even
   when the originating swap is on another pool or direction. Is this fixed
   numeraire part of the intended thesis boundary for all deployments?
5. `MAX_ROUNDS == 8` bounds execution. What theorem or empirical domain shows
   eight rounds suffice for every accepted network state? The function records
   state only the actual guarantee: the stored residual is disclosed after the
   eighth round even if it remains above threshold.
6. The coordinator validates hook topology once but does not validate claim
   operator approval. Is deployment-time explicit authorization part of the
   formal configured-state definition?
7. Empty `hookData` permits a custom-curve swap without folding. Is that path an
   intentional protocol surface or only an inherited/research affordance?
8. Full LP withdrawal sets a hook's reserves to zero and `_everFunded` prevents
   refilling it. Tests call this a one-way research shutdown. Is this part of
   the intended lifecycle specification?
9. The direct transition pays claims to the caller-selected nonzero solver but
   does not identify who computed the onchain quote. What precise service is
   the solver reward intended to compensate in this fully onchain v0?
10. Priority against a competing transaction is outside `contracts/src`; the
    fold is atomic once the originating swap enters this router, but the source
    does not establish that swaps must use this router.
11. The public solver/reward address is checked only for nonzero. A registered
    hook can be selected and break claim/reserve continuity because reward
    claims and virtual reserves then classify the same balance differently.
