# ARBFOLD research audit artifacts

This directory contains reproducible evidence used by
[`docs/THESIS_REASSESSMENT_2026-08-29.md`](../docs/THESIS_REASSESSMENT_2026-08-29.md).

## Deterministic local reassessment

```bash
python3 research/reassess_arbfold.py \
  --check research/results/arbfold-thesis-reassessment-2026-08-29.json
```

The script verifies the frozen artifact hash chain and delivered Solidity
manifest, recalculates the release gas grid, separates fixed-reward pool
retention from a gas-indexed counterfactual, and reruns the deterministic
50,000-network residual sample.

It does not query a chain or change any benchmark input.

Regression assertions for the claim ledger are in
[`tests/test_arbfold_reassessment.py`](../tests/test_arbfold_reassessment.py).

The historical post-review EVM counterexample is preserved under
[`research/historical-v0/`](historical-v0/). Its active v0.1 regression in
[`contracts/test/ArbFoldResearchFindings.t.sol`](../contracts/test/ArbFoldResearchFindings.t.sol)
proves that the registered-hook reward-recipient alias now reverts atomically.

## Optimized v0.1 reassessment

```bash
python3 research/reassess_arbfold_v01.py \
  --check research/results/arbfold-v0.1-reassessment-2026-08-30.json
```

This check binds the optimized source-and-test manifest to the frozen
five-point grid, the 1k–200k dense sweep, the six-route sample and the preserved
v0 raw evidence. Regression assertions are in
[`tests/test_arbfold_v01_reassessment.py`](../tests/test_arbfold_v01_reassessment.py).

## Pinned UHI directory scan

```bash
python3 research/scan_uhi_directory.py \
  --check research/results/uhi-directory-keyword-scan-2026-08-29.json
```

This fetches one commit-pinned official directory snapshot, verifies its
SHA-256 digest, and executes a disclosed keyword protocol. Negative results are
bounded search evidence, not proof of novelty.

## External sources

[`external-sources-2026-08-29.json`](external-sources-2026-08-29.json) records
the primary sources, versions, commits and limitations used in the review.

[`CHECKSUMS.sha256`](CHECKSUMS.sha256) fingerprints the reassessment report,
scripts, generated JSON outputs, regression test, source manifest and contract
context dossier. Run `shasum -a 256 -c research/CHECKSUMS.sha256` from the
repository root to verify them.

No file in this directory modifies contract behavior, the frozen benchmark or
the public deployment.
