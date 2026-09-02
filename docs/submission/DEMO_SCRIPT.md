# ARBFOLD Demo Script

Target length: **3:30–4:15**. Use a real human voice. Do not exceed five minutes.

## 0:00–0:45 — Replay the experiment

> A cyclic arbitrage normally reconciles three inconsistent pools by executing three full swaps. Even if a protocol reinjects the profit, the EVM still pays for that full path. ARBFOLD asks whether cooperating v4 pools can reach the same safe state more efficiently.

The page opens directly on `Don’t replay every leg. Settle the equivalent
state.` Click `Replay
demo`; let both execution paths finish before speaking over the
result.

> At canonical 100k, the iterative reference runs two cycles—six arbitrage
> swaps and two profit reinjections. One ARBFOLD call applies two
> runtime-checked direct settlement rounds. The user output and fixed
> external-recipient reward match, the final reserves are equivalent within
> measured tolerance, and v0.1 uses 31.06% less total gas.

## 0:45–1:20 — Run the deployed code

Click `Open Swap Lab`. Before touching the wallet, show that ARFX, ARFY and ARFZ
are valueless test tokens, identify the three pools, and point to the dynamic
`ARFY → ARFX → ARFZ → ARFY` cycle. The visible quote is read from the deployed
pool state without signing or changing state.

> This is not a pre-rendered animation. The page has checked the public v0.1
> bytecode and token/hook roles. The primary action advances one operation at a
> time: connect, obtain only missing valueless test tokens, approve only this
> swap, then submit the deployed protocol path and produce an explorer receipt.

Open the canonical v0.1 transaction and show its `SwapAndFold`, two
`FoldRound` events and `FoldCompleted` evidence. This immutable receipt is the
published transaction proof; the Swap Lab remains available for an optional
fresh judge-signed testnet transaction.

## 1:20–1:50 — Workload honesty

Close the testnet panel and scroll to `Full benchmark`.

Click 10k, 25k, 50k, 100k and 200k. All five frozen v0.1
actionable rows are cheaper. Then show the report's dense boundary: 1k–4k
execute zero rounds and are more expensive; all 196 actionable rows from
5k–200k are cheaper in the tested canonical path.

## 1:50–2:20 — Same result

Use `Verify everything` to open the canonical Unichain Sepolia transaction and
the committed benchmark report.

> This is not arithmetic changed only in memory. The benchmark uses a real v4
> PoolManager. v0.1 keeps conservation and non-decreasing-invariant checks on
> every round, then compares its cached final state with a fresh network read.
> The live Unichain Sepolia demo executes v0.1. It is exploratory evidence on a
> mutable testnet, while the controlled benchmark starts both paths from the
> same state and is the source of the gas comparison.

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

It executes the 82 current Solidity tests
and prints a compact summary, the canonical
benchmark and the committed public deployment facts. Mention fuzzing, stateful
invariants, unauthorized calls, exact backing, slippage rollback and the
five-size clean-core gas grid.

## 3:25–3:55 — Honest boundary

Show the evidence cards.

> We preregistered a harder claim: 10% more LP net value. It failed. Gas
> savings produced only 0.000287% LP-value improvement in that environment.
> We kept the historical 39.58%, 18.86% and v0 19.12% reports immutable. v0.1
> is a separate optimization result: 31.06% less at canonical 100k and 19.45%
> less at the former 25k regression.

## 3:55–4:15 — Close

> Don’t replay every leg. Settle the equivalent state. One fold call can process
> multiple runtime-checked direct settlement rounds. At canonical 100k, v0.1
> uses 31.06% less total gas than the iterative reference; zero-round workloads
> remain outside the efficiency claim.
