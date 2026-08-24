#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 4 || "$#" -gt 5 ]]; then
  echo "usage: $0 <manifest> <deploy-broadcast-json> <demo-broadcast-json> <source-verification> [demo-evidence-json]" >&2
  exit 64
fi

manifest=$1
deploy_broadcast=$2
demo_broadcast=$3
source_verification=$4
demo_evidence=${5:-}

for required_file in "$manifest" "$deploy_broadcast" "$demo_broadcast"; do
  if [[ ! -f "$required_file" ]]; then
    echo "missing required file: $required_file" >&2
    exit 66
  fi
done
if [[ -n "$demo_evidence" && ! -f "$demo_evidence" ]]; then
  echo "missing demo evidence file: $demo_evidence" >&2
  exit 66
fi

case "$source_verification" in
  verified|partial|not-available) ;;
  *)
    echo "invalid source verification status: $source_verification" >&2
    exit 64
    ;;
esac

canonical_transaction=$(jq -er '.transactions[-1].hash' "$demo_broadcast")
canonical_receipt=$(jq -er --arg transaction "$canonical_transaction" '.receipts[] | select(.transactionHash == $transaction)' "$demo_broadcast")
block_hex=$(jq -er '.blockNumber' <<< "$canonical_receipt")
block_number=$((block_hex))
git_commit=$(git rev-parse HEAD)
temporary_manifest="${manifest}.tmp"

if [[ -n "$demo_evidence" ]]; then
  jq \
    --arg canonical "$canonical_transaction" \
    --arg commit "$git_commit" \
    --arg verification "$source_verification" \
    --argjson block "$block_number" \
    --slurpfile deploy "$deploy_broadcast" \
    --slurpfile demo "$demo_evidence" \
    '.deploymentTransactions = ($deploy[0].transactions | map(.hash))
     | .canonicalDemoTransaction = $canonical
     | .blockNumber = $block
     | .gitCommit = $commit
     | .sourceVerification = $verification
     | .demo = ($demo[0]
         | .preReserves = {abA: .preAbA, abB: .preAbB, bcB: .preBcB, bcC: .preBcC, acA: .preAcA, acC: .preAcC}
         | .postReserves = {abA: .postAbA, abB: .postAbB, bcB: .postBcB, bcC: .postBcC, acA: .postAcA, acC: .postAcC}
         | del(.preAbA, .preAbB, .preBcB, .preBcC, .preAcA, .preAcC, .postAbA, .postAbB, .postBcB, .postBcC, .postAcA, .postAcC))' \
    "$manifest" > "$temporary_manifest"
else
  jq \
    --arg canonical "$canonical_transaction" \
    --arg commit "$git_commit" \
    --arg verification "$source_verification" \
    --argjson block "$block_number" \
    --slurpfile deploy "$deploy_broadcast" \
    '.deploymentTransactions = ($deploy[0].transactions | map(.hash))
     | .canonicalDemoTransaction = $canonical
     | .blockNumber = $block
     | .gitCommit = $commit
     | .sourceVerification = $verification' \
    "$manifest" > "$temporary_manifest"
fi

mv "$temporary_manifest" "$manifest"
jq -e '
  .researchOnly == true
  and (.deploymentTransactions | length > 0)
  and (.canonicalDemoTransaction | startswith("0x"))
  and ((has("demo") | not) or (.demo.chainId == .chainId and .demo.foldRounds > 0))
' "$manifest" >/dev/null
