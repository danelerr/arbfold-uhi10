# ARBFOLD Demo Script

Target length: **3:30–4:15**. Use a real human voice. Do not exceed five minutes.

## 0:00–0:25 — Problem

> A cyclic arbitrage normally reconciles three inconsistent pools by executing three full swaps. Even if a protocol reinjects the profit, the EVM still pays for that full path. ARBFOLD asks whether cooperating v4 pools can reach the same safe state more efficiently.

Show the `3 swaps → 1 verified transition` hero, its two execution lanes and the canonical −19.12% badge.

## 0:25–1:05 — Run the deployed product

Scroll to `Try the real deployment`, point out that no wallet is required, then
click `Run read-only test`. Show the returned Demo USD-1 → Demo ETH quote and gas estimate before opening the live contract state.

> This is not a pre-rendered animation. The page has verified the deployed
> bytecode and is now executing the complete router call against current
> Unichain Sepolia state. The dry-run needs no wallet and changes no state. A
> signed run uses the adjacent wallet flow and produces its own explorer receipt.

Open the latest interactive validation transaction and show its `SwapAndFold`,
`FoldRound` and `FoldCompleted` evidence.

## 1:05–1:40 — Two measured paths

Scroll to the benchmark comparison.

> Path A performs the user swap, three arbitrage swaps and profit reinjection. Path B performs the same user swap, computes the same cycle, and moves backed ERC-6909 reserves directly between three hook-owned pools. Against the delivered release candidate, the 100k result is 544,187 gas versus 440,128—19.12% less.

Click 10k, 25k, 50k, 100k and 200k. Explicitly show that the direct path costs 0.98% more at 25k: the advantage is workload-dependent, not universal.

## 1:40–2:10 — Same result

Show the public-proof panel, open the canonical Unichain Sepolia transaction,
then show the before/after reserve section.

> This is not three numbers changed in memory. The public demo uses the official v4 PoolManager on Unichain Sepolia. All 28 deployment transactions and all three demo transactions finalized, and the post-deployment verifier passed. Each virtual reserve must exactly equal its ERC-6909 claim balance. Token totals are conserved except for the same capped solver reward, no invariant may decrease, and residual cyclic profit is zero in the canonical case.

## 2:10–2:50 — Code

Open these exact symbols:

1. `ArbFoldHook._beforeSwap`;
2. `ArbFoldCoordinator._applyDirect`;
3. `ArbFoldRouter.unlockCallback`;
4. `DeployArbFold._mineAndDeploy`.

> The user output is computed first by OpenZeppelin BaseCustomCurve. The hook then calls the fixed coordinator inside the same PoolManager unlock. The coordinator transfers claims and applies independent conservation and invariant guards. The router settles the swap atomically.

## 2:50–3:20 — Tests

Run the recording-safe proof command:

```bash
make video-proof
```

It executes the 61-test core suite and prints a compact summary, the canonical
benchmark and the committed public deployment facts. Mention fuzzing, stateful
invariants, unauthorized calls, exact backing, slippage rollback and the
five-size clean-core gas grid.

## 3:20–3:50 — Honest boundary

Show the evidence cards.

> We preregistered a harder claim: 10% more LP net value. It failed. Gas savings produced only 0.000287% LP-value improvement in that environment. The minimal frozen harness measured 39.58% lower gas, the earlier clean core measured 18.86%, and the delivered release candidate measures 19.12%, including a 25k case where direct execution is 0.98% more expensive. We preserved every result instead of selecting the flattering one.

## 3:50–4:10 — Close

> Three swaps become one verified transition. Same user output, same solver reward and equivalent final reserves. At the canonical 100k benchmark, 19.12% less gas in the delivered core. The advantage is workload-dependent.
