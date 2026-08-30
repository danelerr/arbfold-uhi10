#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
summary_file="$(mktemp)"
canonical_file="$(mktemp)"
trap 'rm -f "$summary_file" "$canonical_file"' EXIT

benchmark_file="${ARBFOLD_BENCHMARK_PATH:-$repo_dir/benchmark/optimized-release-candidate-results/raw.json}"
evidence_only=false

case "${1:-}" in
  "") ;;
  --evidence-only) evidence_only=true ;;
  *) printf 'Unknown argument: %s\n' "$1" >&2; exit 64 ;;
esac

if [[ ! -f "$benchmark_file" ]]; then
  printf 'Benchmark evidence not found: %s\n' "$benchmark_file" >&2
  exit 1
fi

# JavaScript consumers, submission preflight and this proof share one semantic
# validator. jq below only renders the already validated canonical row.
node "$repo_dir/scripts/validate-benchmark-evidence.mjs" "$benchmark_file" > "$canonical_file"

printf '\nCANONICAL V0.1 OPTIMIZED BENCHMARK\n\n'
jq -er '
  "Input:             \(.canonical.input_tokens) tokens (\(.canonical.input_wei) wei)",
  "Path:              \(.canonical.path_label)",
  "Reference rounds:  \(.canonical.reference_rounds) (\(.canonical.reference_arbitrage_swaps) swaps + \(.canonical.reference_reinjections) reinjections)",
  "Direct rounds:     \(.canonical.direct_rounds) in \(.canonical.direct_fold_calls) fold() call",
  "Atomic reference:  \(.canonical.reference_total_gas) gas",
  "ARBFOLD direct:    \(.canonical.direct_total_gas) gas",
  "Exact reduction:   \(.canonical.gas_reduction_percent)%",
  "Reference output:  \(.canonical.reference_user_output) wei internal A",
  "Direct output:     \(.canonical.direct_user_output) wei internal A",
  "Reference fixed external-recipient reward: \(.canonical.reference_external_recipient_reward) wei internal A",
  "Direct fixed external-recipient reward:    \(.canonical.direct_external_recipient_reward) wei internal A",
  "Residual profit:   \(.canonical.direct_residual) wei internal A (threshold \(.residual_threshold_wei_a))",
  "State tolerance:   \(.canonical.equivalence_tolerance_wei) wei",
  "Dense sweep:       \(.facts.dense_sweep.cheaper_actionable_rows)/\(.facts.dense_sweep.actionable_rows) actionable rows cheaper",
  "Validated paths:   \(.facts.unique_paths | join(","))"
' "$canonical_file"

if [[ "$evidence_only" == true ]]; then
  printf '\nPASS — full v4 evidence validated: release provenance, compiler matrix, workload identity, round topology, residual policy, dense sweep, six unique paths, exact pairs, gas arithmetic and consumer-recomputable gates.\n'
  exit 0
fi

cd "$repo_dir/contracts"
forge test --offline --summary > "$summary_file"

printf '\nARBFOLD CORE TEST SUMMARY\n\n'
tail -n 20 "$summary_file"

printf '\nPUBLIC ARBFOLD V0.1 UNICHAIN SEPOLIA EVIDENCE\n\n'
jq -r '
  "Chain ID:         \(.chainId)",
  "PoolManager:      \(.poolManager)",
  "Canonical tx:     \(.canonicalDemoTransaction)",
  "Canonical swap:   \(.demo.amountIn) B wei -> \(.demo.amountOut) A wei",
  "Canonical rounds: \(.demo.foldRounds)",
  "Fold rounds:      \(.demo.foldRounds)",
  "Residual profit:  \(.demo.residualProfit)",
  "Research only:    \(.researchOnly)"
' "$repo_dir/deployments/unichain-sepolia-1301-v0.1.json"

printf '\nPASS — v0.1 schema v4 evidence, release provenance, compiler matrix and consumer-recomputable claims validated; exact reserve equivalence remains Forge/source-manifest/Python-backed, and the public onchain evidence is the v0.1 deployment.\n'
