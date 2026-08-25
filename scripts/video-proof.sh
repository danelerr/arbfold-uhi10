#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
summary_file="$(mktemp)"
trap 'rm -f "$summary_file"' EXIT

cd "$repo_dir/contracts"
forge test --offline --summary > "$summary_file"

printf '\nARBFOLD CORE TEST SUMMARY\n\n'
tail -n 16 "$summary_file"

printf '\nCANONICAL DELIVERED-SOURCE BENCHMARK\n\n'
jq -r '
  .canonical |
  "Input:            \(.origin_input_wei) wei (100k USDC18)",
  "Atomic backrun:   \(.backrun_total_gas) gas",
  "ARBFOLD direct:   \(.direct_total_gas) gas",
  "Exact reduction:  \(.exact_gas_reduction_percent * 100 | round / 100 | tostring)%",
  "User output:      \(.user_output_a) wei A",
  "Solver reward:    \(.solver_reward_a) wei A",
  "Residual profit:  \(.residual_a) wei A"
' "$repo_dir/benchmark/release-candidate-results/raw.json"

printf '\nPUBLIC UNICHAIN SEPOLIA EVIDENCE\n\n'
jq -r '
  "Chain ID:         \(.chainId)",
  "PoolManager:      \(.poolManager)",
  "Canonical tx:     \(.canonicalDemoTransaction)",
  "Interactive tx:   \(.interactiveDemo.transaction)",
  "Interactive swap: \(.interactiveDemo.amountIn) B wei -> \(.interactiveDemo.amountOut) A wei",
  "Live demo rounds: \(.interactiveDemo.foldRounds)",
  "Fold rounds:      \(.demo.foldRounds)",
  "Residual profit:  \(.demo.residualProfit)",
  "Research only:    \(.researchOnly)"
' "$repo_dir/deployments/unichain-sepolia-1301.json"

printf '\nPASS — tests, benchmark evidence and public manifest loaded from the committed repository.\n'
