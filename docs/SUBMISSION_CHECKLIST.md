# UHI10 Submission Checklist

This matrix separates completed repository work from manual publication tasks. It must not mark an external artifact complete before it exists.

| Requirement | Status | Evidence / next action |
|---|---|---|
| Functional Uniswap v4 hook | Complete | [`contracts/src/ArbFoldHook.sol`](../contracts/src/ArbFoldHook.sol) |
| New Hookathon code | Complete and public | Clean core under [`contracts/`](../contracts/) with reproducible history and CI. |
| Tests or frontend | Both complete | [`contracts/test/`](../contracts/test/) and [`app/`](../app/) |
| Public GitHub repository | Complete | [github.com/danelerr/arbfold-uhi10](https://github.com/danelerr/arbfold-uhi10) |
| Public dashboard | Complete locally; publish updated build | Live RPC reads, no-wallet deployed-contract dry-run, signed testnet flow and interactive benchmark under [`app/`](../app/). |
| Project thumbnail | Complete | [`assets/arbfold-uhi10-thumbnail.png`](../assets/arbfold-uhi10-thumbnail.png) |
| Demo/explainer video ≤5 minutes | Pending recording | Use [`VIDEO_RECORDING_RUNBOOK.md`](VIDEO_RECORDING_RUNBOOK.md) and [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md); human voice only. |
| Problem/background | Drafted | Root [`README.md`](../README.md) and [`JUDGE_GUIDE.md`](JUDGE_GUIDE.md) |
| Impact and uniqueness | Drafted | Same-state execution comparison in README and dashboard; release 19.12%, earlier clean-core 18.86% and frozen v0 39.58% remain separated. |
| Challenges | Drafted | [`LIMITATIONS.md`](LIMITATIONS.md) and [`THREAT_MODEL.md`](THREAT_MODEL.md) |
| Future plans | Drafted | [`LIMITATIONS.md`](LIMITATIONS.md) |
| Partner integrations with exact locations | Complete | Unichain Sepolia deployment and official v4 `PoolManager` are documented in [`README.md`](../README.md) and the public manifest; no unsupported partner claims. |
| Final form copy | Complete | [`FINAL_SUBMISSION.md`](FINAL_SUBMISSION.md) contains copy-ready answers and leaves personal fields to Daniel. |
| Originality and credits | Complete | Paper, Uniswap, OpenZeppelin and Homelander credited in README. |
| Returning cohort declaration | Manual form step | Select **UHI7** in the final submission form. |
| Submission deadline | Manual form step | Submit before **2026-09-03 23:59 PDT**. |

## Final manual gate

Do not submit until all are true:

- repository opens in an incognito browser;
- demo URL opens without authentication;
- live RPC status becomes green and the no-wallet dry-run returns `PASS`;
- video uses a real human voice and is at most five minutes;
- README links resolve from GitHub;
- the first minute shows the problem, both paths and the delivered 19.12% canonical result;
- the video labels 39.58% only as the historical minimal-harness result and discloses the 0.98% 25k regression;
- the video explicitly says the 10% LP-value claim failed;
- the final form links directly to the hook, coordinator, tests and dashboard.
