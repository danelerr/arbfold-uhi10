# ARBFOLD Demo Script

Target length: **3:30–4:15**. Use a real human voice. Do not exceed five minutes.

## 0:00–0:45 — Replay the experiment

> A cyclic arbitrage normally reconciles three inconsistent pools by executing three full swaps. Even if a protocol reinjects the profit, the EVM still pays for that full path. ARBFOLD asks whether cooperating v4 pools can reach the same safe state more efficiently.

The page opens directly on `3 swaps → 1 verified transition`. Click `Replay
demo`; let both execution paths finish before speaking over the
result.

> The left side executes the conventional user swap, three-leg backrun and
> reinjection. The right side verifies the same cycle and applies one direct,
> PoolManager-backed reserve transition. Same user output, same solver reward,
> equivalent final reserves—19.12% less gas at the canonical 100k workload.

## 0:45–1:20 — Run the deployed code

Click `Run on testnet` and show the three-step signed flow. For a recording that
must not expose a wallet, expand `Preview without a wallet`, click `Preview
transaction`, then show the returned ARFX → ARFY quote and gas estimate.

> This is not a pre-rendered animation. The page has verified the deployed
> bytecode and is now executing the complete router call against current
> Unichain Sepolia state. The dry-run needs no wallet and changes no state.
> The primary wallet flow makes the deployed protocol directly executable and
> produces its own explorer receipt.

Open the latest interactive validation transaction and show its `SwapAndFold`,
`FoldRound` and `FoldCompleted` evidence.

## 1:20–1:50 — Workload honesty

Close the testnet panel and scroll to `Full benchmark`.

Click 10k, 25k, 50k, 100k and 200k. Explicitly show that the direct path costs 0.98% more at 25k: the advantage is workload-dependent, not universal.

## 1:50–2:20 — Same result

Use `Verify everything` to open the canonical Unichain Sepolia transaction and
the committed benchmark report.

> This is not three numbers changed in memory. The public demo uses the official v4 PoolManager on Unichain Sepolia. All 28 deployment transactions and all three demo transactions finalized, and the post-deployment verifier passed. Each virtual reserve must exactly equal its ERC-6909 claim balance. Token totals are conserved except for the same capped solver reward, no invariant may decrease, and residual cyclic profit is zero in the canonical case.

## 2:20–3:00 — Code

Open these exact symbols:

1. `ArbFoldHook._beforeSwap`;
2. `ArbFoldCoordinator._applyDirect`;
3. `ArbFoldRouter.unlockCallback`;
4. `DeployArbFold._mineAndDeploy`.

> The user output is computed first by OpenZeppelin BaseCustomCurve. The hook then calls the fixed coordinator inside the same PoolManager unlock. The coordinator transfers claims and applies independent conservation and invariant guards. The router settles the swap atomically.

## 3:00–3:25 — Tests

Run the recording-safe proof command:

```bash
make video-proof
```

It executes the 61-test core suite and prints a compact summary, the canonical
benchmark and the committed public deployment facts. Mention fuzzing, stateful
invariants, unauthorized calls, exact backing, slippage rollback and the
five-size clean-core gas grid.

## 3:25–3:55 — Honest boundary

Show the evidence cards.

> We preregistered a harder claim: 10% more LP net value. It failed. Gas savings produced only 0.000287% LP-value improvement in that environment. The minimal frozen harness measured 39.58% lower gas, the earlier clean core measured 18.86%, and the delivered release candidate measures 19.12%, including a 25k case where direct execution is 0.98% more expensive. We preserved every result instead of selecting the flattering one.

## 3:55–4:15 — Close

> Three swaps become one verified transition. Same user output, same solver reward and equivalent final reserves. At the canonical 100k benchmark, 19.12% less gas in the delivered core. The advantage is workload-dependent.
