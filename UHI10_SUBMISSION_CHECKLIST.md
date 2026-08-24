# UHI10 Submission Checklist

This matrix separates completed repository work from manual publication tasks. It must not mark an external artifact complete before it exists.

| Requirement | Status | Evidence / next action |
|---|---|---|
| Functional Uniswap v4 hook | Complete | [`contracts/src/ArbFoldHook.sol`](contracts/src/ArbFoldHook.sol) |
| New Hookathon code | Complete locally | Clean core under [`contracts/`](contracts/); commit history still needs publication. |
| Tests or frontend | Both complete | [`contracts/test/`](contracts/test/) and [`app/`](app/) |
| Public GitHub repository | Public shell verified; source push pending | `https://github.com/danelerr/mature-uhi10` returns publicly; commit and push the local source, then verify it in incognito. |
| Demo/explainer video ≤5 minutes | Pending recording | Use [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md); human voice only. |
| Problem/background | Drafted | Root [`README.md`](README.md) and [`docs/JUDGE_GUIDE.md`](docs/JUDGE_GUIDE.md) |
| Impact and uniqueness | Drafted | Same-state execution comparison in README and dashboard; clean-core 18.86% result is separated from frozen v0's 39.58%. |
| Challenges | Drafted | [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) and [`mature-uhi10-threat-model.md`](mature-uhi10-threat-model.md) |
| Future plans | Drafted | [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) |
| Partner integrations with exact locations | Complete | Integration table in [`README.md`](README.md); no unsupported sponsor claims. |
| Originality and credits | Complete | Paper, Uniswap, OpenZeppelin and Homelander credited in README. |
| Returning cohort declaration | Manual form step | Select **UHI7** in the final submission form. |
| Submission deadline | Manual form step | Submit before **2026-09-03 23:59 PDT**. |

## Final manual gate

Do not submit until all are true:

- repository opens in an incognito browser;
- demo URL opens without authentication;
- video uses a real human voice and is at most five minutes;
- README links resolve from GitHub;
- the first minute shows the problem, both paths and the clean-core 18.86% canonical result;
- the video labels 39.58% only as the historical minimal-harness result and discloses the 25k regression;
- the video explicitly says the 10% LP-value claim failed;
- the final form links directly to the hook, coordinator, tests and dashboard.
