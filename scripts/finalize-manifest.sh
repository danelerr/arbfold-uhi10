#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 4 ]]; then
  echo "usage: $0 <manifest> <deploy-broadcast-json> <demo-broadcast-json> <source-verification>" >&2
  exit 64
fi

manifest=$1
deploy_broadcast=$2
demo_broadcast=$3
source_verification=$4

for required_file in "$manifest" "$deploy_broadcast" "$demo_broadcast"; do
  if [[ ! -f "$required_file" ]]; then
    echo "missing required file: $required_file" >&2
    exit 66
  fi
done

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

mv "$temporary_manifest" "$manifest"
jq -e '.researchOnly == true and (.deploymentTransactions | length > 0) and (.canonicalDemoTransaction | startswith("0x"))' "$manifest" >/dev/null
