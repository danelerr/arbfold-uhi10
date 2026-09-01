# UHI10 Submission Checklist

This matrix separates completed repository work from manual publication tasks. It must not mark an external artifact complete before it exists.

| Requirement | Status | Evidence / next action |
|---|---|---|
| Functional Uniswap v4 hook | Complete | [`contracts/src/ArbFoldHook.sol`](../../contracts/src/ArbFoldHook.sol) |
| New Hookathon code | Complete and public | Clean core under [`contracts/`](../../contracts/) with reproducible history and CI. |
| Tests or frontend | Both complete | [`contracts/test/`](../../contracts/test/) and [`app/`](../../app/) |
| Public GitHub repository | Complete | [github.com/danelerr/arbfold-uhi10](https://github.com/danelerr/arbfold-uhi10) |
| Public dashboard | Complete and public | Live RPC reads, no-wallet deployed-contract dry-run, signed testnet flow and interactive benchmark at [danelerr.github.io/arbfold-uhi10](https://danelerr.github.io/arbfold-uhi10/). |
| Public v0.1 deployment | Complete | [`unichain-sepolia-1301-v0.1.json`](../../deployments/unichain-sepolia-1301-v0.1.json) records the official PoolManager, coordinator, router, three hooks and 28 deployment receipts. |
| Canonical v0.1 transaction | Complete | [`0x3429…2022`](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022): one `fold()` call, two direct rounds and zero residual. |
| Swap Lab uses v0.1 | Complete | The app, Vite development server, Pages build and live checker all consume the v0.1 manifest. |
| Frozen source and release | Complete | [`uhi10-final`](https://github.com/danelerr/arbfold-uhi10/releases/tag/uhi10-final) points to source commit `2abc236`; active judge links are tag-pinned. |
| Release evidence | Complete except human artifacts | [`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md) binds source, benchmark, deployment, transaction, CI and known limits. |
| Project thumbnail | Complete | [`assets/arbfold-uhi10-thumbnail.png`](../../assets/arbfold-uhi10-thumbnail.png) |
| Demo/explainer video ≤5 minutes | Pending recording | Use [`VIDEO_RECORDING_RUNBOOK.md`](VIDEO_RECORDING_RUNBOOK.md) and [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md); human voice only. |
| Problem/background | Complete | Root [`README.md`](../../README.md) and [`JUDGE_GUIDE.md`](../JUDGE_GUIDE.md) |
| Impact and uniqueness | Complete | v0.1 execution comparison in README and dashboard; optimized 31.06%, historical release 19.12%, earlier clean-core 18.86% and frozen v0 39.58% remain separated. |
| Challenges | Complete | [`LIMITATIONS.md`](../LIMITATIONS.md) and [`THREAT_MODEL.md`](../THREAT_MODEL.md) |
| Future plans | Complete | [`LIMITATIONS.md`](../LIMITATIONS.md) |
| Partner integrations with exact locations | Complete | Unichain Sepolia deployment and official v4 `PoolManager` are documented in [`README.md`](../../README.md) and the public manifest; no unsupported partner claims. |
| Final form copy | Ready for manual submission | [`FINAL_SUBMISSION.md`](FINAL_SUBMISSION.md) contains copy-ready answers and leaves personal fields to Daniel. |
| Progress Update 2 copy | Ready for manual submission | [`PROGRESS_UPDATE_2.md`](../../research/archive/submission/PROGRESS_UPDATE_2.md) is bound to the public v0.1 deployment, benchmark and canonical transaction. |
| Originality and credits | Complete | Paper, Uniswap, OpenZeppelin and Homelander credited in README. |
| Returning cohort declaration | Manual form step | Select **UHI7** in the final submission form. |
| Submission deadline | Manual form step | Submit before **2026-09-03 23:59 PDT**. |

## Final manual gate

Run the automated preflight first:

```bash
make submission-preflight
```

It verifies the current public dashboard, manifest, RPC deployment, canonical
benchmark values, Project ID, links and claim boundaries. It reports the final
video URL, cohort email and X handle separately as manual pending fields. Run
`node scripts/submission-preflight.mjs --public --strict` only after those
placeholders have been replaced; strict mode fails while any remain.

Do not submit until all are true:

- repository opens in an incognito browser;
- demo URL opens without authentication;
- live RPC status becomes green and the no-wallet dry-run returns `PASS`;
- video uses a real human voice and is at most five minutes;
- README links resolve from GitHub;
- the first minute shows the problem, both paths and the v0.1 31.06% canonical result;
- the video labels 39.58% only as the historical minimal-harness result, preserves the historical 0.98% 25k regression, and shows that v0.1 removes it;
- the video explicitly says the 10% LP-value claim failed;
- the final form links directly to the hook, coordinator, tests and dashboard.
