# ARBFOLD documentation

This directory is the compact entry point for the current v0.1 release.
Historical decisions, reviews and remediation records live under
[`research/archive/`](../research/archive/); generated audit context lives
under [`research/generated/`](../research/generated/).

## Judge-facing documentation

| Document | Purpose |
|---|---|
| [JUDGE_GUIDE.md](JUDGE_GUIDE.md) | Fastest evaluation path and claims to verify. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Contracts, trust boundaries and transaction flow. |
| [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md) | Current v0.1 benchmark, tests, hashes and deployment evidence. |
| [LIVE_DEMO_GUIDE.md](LIVE_DEMO_GUIDE.md) | Controlled replay and live Swap Lab walkthrough. |
| [LIMITATIONS.md](LIMITATIONS.md) | Explicit scope and claims ARBFOLD does not make. |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Assets, adversaries, failure modes and mitigations. |
| [ARITHMETIC_SPEC.md](ARITHMETIC_SPEC.md) | State transition and rounding specification. |
| [deployment/DEPLOYMENT_RUNBOOK.md](deployment/DEPLOYMENT_RUNBOOK.md) | Reproduce and verify the v0.1 deployment. |

## Supporting material

- [`submission/`](submission/) contains the form copy, video script and final checklist.
- [`evidence/`](evidence/) contains coverage and static-analysis summaries.

## Research and review archive

Preregistration decisions and validation freezes remain under
[`research/archive/decisions/`](../research/archive/decisions/) with their links
updated for the new location. Independent review and re-audit records remain
byte-preserved under [`research/archive/audits/`](../research/archive/audits/).
They are retained for auditability and are not required to understand the
current release.

Use [the research index](../research/README.md) for the experiment history and
[the benchmark index](../benchmark/README.md) to distinguish the v0.1 package
from earlier measurements. Historical documents never override the current
v0.1 evidence in `benchmark/optimized-release-candidate-results/`.
