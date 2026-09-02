#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 6 ]]; then
  echo "usage: $0 <manifest> <deploy-broadcast-json> <demo-broadcast-json> <source-verification> <demo-evidence-json> <rpc-url>" >&2
  exit 64
fi

manifest=$1
deploy_broadcast=$2
demo_broadcast=$3
source_verification=$4
demo_evidence=$5
rpc_url=$6

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

runtime_json='{}'
while IFS='|' read -r key address_path; do
    address=$(jq -er "$address_path" "$temporary_manifest")
    code=$(cast code "$address" --rpc-url "$rpc_url")
    if [[ -z "$code" || "$code" == "0x" ]]; then
      echo "missing runtime bytecode for $key at $address" >&2
      exit 65
    fi
    bytes=$(( (${#code} - 2) / 2 ))
    code_hash=$(cast keccak "$code")
    runtime_json=$(jq -cn \
      --argjson current "$runtime_json" \
      --arg key "$key" \
      --argjson bytes "$bytes" \
      --arg hash "$code_hash" \
      '$current + {($key): {bytes: $bytes, keccak256: $hash}}')
done <<'EOF'
poolManager|.poolManager
coordinator|.coordinator
hookAB|.hooks.ab
hookBC|.hooks.bc
hookAC|.hooks.ac
router|.router
tokenA|.tokens.a
tokenB|.tokens.b
tokenC|.tokens.c
EOF
runtime_manifest="${manifest}.runtime.tmp"
jq --argjson runtime "$runtime_json" '.runtimeBytecode = $runtime' "$temporary_manifest" > "$runtime_manifest"
mv "$runtime_manifest" "$temporary_manifest"

mv "$temporary_manifest" "$manifest"
jq -e '
  .researchOnly == true
  and (.deploymentTransactions | length > 0)
  and (.canonicalDemoTransaction | startswith("0x"))
  and ((.runtimeBytecode // {}) | length == 9)
  and ((has("demo") | not) or (.demo.chainId == .chainId and .demo.foldRounds > 0))
' "$manifest" >/dev/null
