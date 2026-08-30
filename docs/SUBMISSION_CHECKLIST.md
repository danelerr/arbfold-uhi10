# UHI10 Submission Checklist

This matrix separates completed repository work from manual publication tasks. It must not mark an external artifact complete before it exists.

| Requirement | Status | Evidence / next action |
|---|---|---|
| Functional Uniswap v4 hook | Complete | [`contracts/src/ArbFoldHook.sol`](../contracts/src/ArbFoldHook.sol) |
| New Hookathon code | Complete and public | Clean core under [`contracts/`](../contracts/) with reproducible history and CI. |
| Tests or frontend | Both complete | [`contracts/test/`](../contracts/test/) and [`app/`](../app/) |
| Public GitHub repository | Complete | [github.com/danelerr/arbfold-uhi10](https://github.com/danelerr/arbfold-uhi10) |
| Public dashboard | Complete and public | Live RPC reads, no-wallet deployed-contract dry-run, signed testnet flow and interactive benchmark at [danelerr.github.io/arbfold-uhi10](https://danelerr.github.io/arbfold-uhi10/). |
| Project thumbnail | Complete | [`assets/arbfold-uhi10-thumbnail.png`](../assets/arbfold-uhi10-thumbnail.png) |
| Demo/explainer video ≤5 minutes | Pending recording | Use [`VIDEO_RECORDING_RUNBOOK.md`](VIDEO_RECORDING_RUNBOOK.md) and [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md); human voice only. |
| Problem/background | Drafted | Root [`README.md`](../README.md) and [`JUDGE_GUIDE.md`](JUDGE_GUIDE.md) |
| Impact and uniqueness | Drafted | v0.1 execution comparison in README and dashboard; optimized 31.06%, historical release 19.12%, earlier clean-core 18.86% and frozen v0 39.58% remain separated. |
| Challenges | Drafted | [`LIMITATIONS.md`](LIMITATIONS.md) and [`THREAT_MODEL.md`](THREAT_MODEL.md) |
| Future plans | Drafted | [`LIMITATIONS.md`](LIMITATIONS.md) |
| Partner integrations with exact locations | Complete | Unichain Sepolia deployment and official v4 `PoolManager` are documented in [`README.md`](../README.md) and the public manifest; no unsupported partner claims. |
| Final form copy | Complete | [`FINAL_SUBMISSION.md`](FINAL_SUBMISSION.md) contains copy-ready answers and leaves personal fields to Daniel. |
| Progress Update 2 copy | Complete | [`PROGRESS_UPDATE_2.md`](PROGRESS_UPDATE_2.md) is bound to the public v0.1 deployment, benchmark and canonical transaction. |
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
