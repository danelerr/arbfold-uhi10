# ARBFOLD — Video Recording Runbook

The final video should be **3:45–4:15**, use Daniel's real voice and remain
below the five-minute limit. This runbook turns [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
into a repeatable recording sequence; it does not add claims or features.

An import-ready English subtitle template is available at
[`assets/arbfold-demo-en.srt`](../assets/arbfold-demo-en.srt). Its current
timeline runs to 4:12 and matches the planned sequence. After recording, retime
it to the actual human narration rather than speeding up or cutting the
required disclosures.

## 1. One-time preflight

Use a 1920×1080 or 2560×1440 desktop, disable notifications and close every
wallet, password manager and terminal that could expose secrets. Use the
no-wallet live dry-run during recording; a signed transaction is already linked
as evidence, so no wallet extension needs to appear on screen.

From the repository root, run:

```bash
make video-proof
```

The command takes roughly five seconds on the development machine. It executes
the 61-test default core suite and leaves a compact test table, the canonical
release benchmark and the public Unichain manifest facts on screen. It never
loads a private key or calls the deployment wallet.

Do one ten-second microphone test. Listen back for clipping, fan noise and low
volume before recording the actual take.

## 2. Open these tabs in this order

1. Dashboard hero: https://danelerr.github.io/arbfold-uhi10/
2. Signed-path validation transaction: https://sepolia.uniscan.xyz/tx/0x87a940bc58558886fe7debc34373c9ccec5ce1db6143695b8b5c7063e75deceb
3. Hook callback: https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldHook.sol#L72
4. Direct transition: https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldCoordinator.sol#L144
5. Atomic settlement: https://github.com/danelerr/arbfold-uhi10/blob/9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b/contracts/src/ArbFoldRouter.sol#L93
6. Release report: https://github.com/danelerr/arbfold-uhi10/blob/main/benchmark/release-candidate-results/REPORT.md

Set the browser zoom so the complete benchmark cards fit without horizontal
scrolling. Keep one terminal window ready with the completed `make video-proof`
output.

## 3. Recording sequence

| Time | Screen | Action | Message |
|---:|---|---|---|
| 0:00–0:45 | Interactive benchmark | The page opens on the experiment. Click `Replay demo` and let both lanes complete. | Conventional execution performs three arbitrage swaps plus reinjection; ARBFOLD applies one verified direct transition to the equivalent state. |
| 0:45–1:20 | Deployed-code test | Click `Run on testnet`, show the three signed steps, then expand `Simulate deployed contracts` and run the no-wallet path. | The RPC executes the deployed router path now without a wallet; `Connect → Prepare → Execute` submits the same deployed path as a real testnet transaction. |
| 1:20–1:50 | Workload controls | Close the panel, scroll to `Full benchmark`, then click 10k, 25k, 50k, 100k and 200k slowly. Stop at 25k, then return to 100k. | Same user swap, output and reward. The canonical result is 19.12% less gas, but 25k is 0.98% more expensive, so the claim is workload-dependent. |
| 1:50–2:20 | Public proof | Use `Verify everything` to open the canonical transaction and benchmark report. | Official Unichain Sepolia PoolManager, exact claims/backing and zero canonical residual profit. |
| 2:20–3:00 | Commit-pinned code tabs | Show the highlighted hook, coordinator and router functions. Do not scroll through whole files. | BaseCustomCurve computes the user output; the fixed coordinator transfers backed claims under conservation/invariant guards; the router settles every delta in one unlock. |
| 3:00–3:25 | Terminal | Show the already completed `make video-proof` output and its final PASS line. | 61 core tests, all-six-path stateful invariants, exact backing, negative paths and the frozen five-size benchmark. |
| 3:25–3:55 | Report | Show the rejected economic gate in the repository report and the complete workload grid in the demo. | The 10% LP-value thesis failed. The historical 39.58%, earlier 18.86% and delivered 19.12% results remain separate rather than cherry-picked. |
| 3:55–4:15 | Interactive benchmark | Return to the first-screen result. | Three swaps become one verified transition; same user output, same solver reward and equivalent final reserves; 19.12% less gas at the canonical 100k workload. |

Use the exact narration in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). The shorter
phrases above are visual cues, not replacement claims.

## 4. Recording rules

- Record one clean continuous take if possible; simple cuts are acceptable.
- Keep the cursor slow and intentional.
- Do not show a wallet, keystore path, RPC credential or shell history.
- Do not say ARBFOLD is always cheaper, production-ready or a universal MEV
  solution.
- Say “equivalent final reserve state” rather than “identical transaction.”
- Say “19.12% less at the canonical 100k benchmark,” never “19.12% less” without
  the workload qualifier.
- Show the 25k regression before the closing claim.
- Keep the explorer visit brief; the dashboard already summarizes the event.
- Do not spend recording time installing dependencies or waiting for CI.

## 5. Export and publication gate

Export at 1080p or higher with readable text. Before using the URL in the final
form, verify all of the following:

- duration is no more than five minutes;
- Daniel's voice is clear in the first ten seconds and throughout;
- no secret, email notification or wallet balance is visible;
- the canonical result is 19.12%, not 18.86% or 39.58%;
- the 0.98% 25k regression and failed 10% LP-value claim are audible;
- the public transaction and actual v4 code appear on screen;
- the uploaded video opens in a private browser window without authentication;
- the subtitle track has been retimed against the final human narration;
- the title and description identify it as a research-grade UHI10 build.

Recommended title:

> ARBFOLD — Folding Cyclic Arbitrage with Uniswap v4 Custom Accounting

Recommended description:

> ARBFOLD is a research-grade Uniswap v4 experiment that reaches the equivalent
> post-arbitrage reserve state through a verified direct transition. This demo
> shows the real PoolManager integration, public Unichain Sepolia proof and the
> workload-dependent Foundry benchmark: 19.12% less gas at the canonical 100k
> workload, with a disclosed 0.98% regression at 25k.

Once the upload passes this gate, place its public URL in
[`FINAL_SUBMISSION.md`](FINAL_SUBMISSION.md) and the final Hookathon form.
