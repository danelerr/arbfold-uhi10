#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
contracts_root="$repository_root/contracts"
rpc_url=${ARBFOLD_SMOKE_RPC_URL:-http://127.0.0.1:8545}
anvil_port=${ARBFOLD_SMOKE_PORT:-8545}
anvil_key=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
anvil_account=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
manifest="$repository_root/deployments/local-ci.json"
demo_evidence="$repository_root/deployments/local-ci-demo.json"
temporary_directory=$(mktemp -d)
anvil_pid=""

cleanup() {
  if [[ -n "$anvil_pid" ]]; then
    kill "$anvil_pid" 2>/dev/null || true
    wait "$anvil_pid" 2>/dev/null || true
  fi
  rm -f "$manifest"
  rm -f "$demo_evidence"
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

anvil --silent --host 127.0.0.1 --port "$anvil_port" >"$temporary_directory/anvil.log" 2>&1 &
anvil_pid=$!

for _ in {1..30}; do
  if cast chain-id --rpc-url "$rpc_url" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done
cast chain-id --rpc-url "$rpc_url" >/dev/null

(
  cd "$contracts_root"
  PRIVATE_KEY="$anvil_key" \
  USE_EXISTING_MANAGER=false \
  WRITE_MANIFEST=true \
  MANIFEST_PATH=../deployments/local-ci.json \
  NETWORK_NAME=local-ci \
  GIT_COMMIT=$(git rev-parse HEAD) \
    forge script script/DeployArbFold.s.sol:DeployArbFold --rpc-url "$rpc_url" --broadcast -q
)

pool_manager=$(jq -er '.poolManager' "$manifest")
coordinator=$(jq -er '.coordinator' "$manifest")
hook_ab=$(jq -er '.hooks.ab' "$manifest")
hook_bc=$(jq -er '.hooks.bc' "$manifest")
hook_ac=$(jq -er '.hooks.ac' "$manifest")
router=$(jq -er '.router' "$manifest")
token_a=$(jq -er '.tokens.a' "$manifest")
token_b=$(jq -er '.tokens.b' "$manifest")
token_c=$(jq -er '.tokens.c' "$manifest")

verify_deployment() {
  local solver=${1:-0x0000000000000000000000000000000000000000}
  (
    cd "$contracts_root"
    POOL_MANAGER="$pool_manager" \
    COORDINATOR="$coordinator" \
    HOOK_AB="$hook_ab" \
    HOOK_BC="$hook_bc" \
    HOOK_AC="$hook_ac" \
    ROUTER="$router" \
    TOKEN_A="$token_a" \
    TOKEN_B="$token_b" \
    TOKEN_C="$token_c" \
    SOLVER="$solver" \
      forge script script/VerifyArbFoldDeployment.s.sol:VerifyArbFoldDeployment --rpc-url "$rpc_url" -q
  )
}

verify_deployment

(
  cd "$contracts_root"
  PRIVATE_KEY="$anvil_key" \
  ROUTER="$router" \
  COORDINATOR="$coordinator" \
  ORIGIN_HOOK="$hook_ab" \
  SOLVER="$anvil_account" \
  ZERO_FOR_ONE=false \
  AMOUNT_IN=100000000000000000000000 \
  WRITE_DEMO_EVIDENCE=true \
  DEMO_EVIDENCE_PATH=../deployments/local-ci-demo.json \
    forge script script/RunArbFoldDemo.s.sol:RunArbFoldDemo --rpc-url "$rpc_url" --broadcast -q
)

verify_deployment "$anvil_account"

deploy_broadcast="$contracts_root/broadcast/DeployArbFold.s.sol/31337/run-latest.json"
demo_broadcast="$contracts_root/broadcast/RunArbFoldDemo.s.sol/31337/run-latest.json"
"$repository_root/scripts/finalize-manifest.sh" \
  "$manifest" \
  "$deploy_broadcast" \
  "$demo_broadcast" \
  not-available \
  "$demo_evidence" \
  "$rpc_url"

jq -e '
  .chainId == 31337
  and .network == "local-ci"
  and .researchOnly == true
  and .usesExistingManager == false
  and (.deploymentTransactions | length >= 20)
  and (.canonicalDemoTransaction | startswith("0x"))
  and (.demo.amountIn | tonumber) == 100000000000000000000000
  and (.demo.amountOut | tonumber) > 0
  and (.demo.solverReward | tonumber) > 0
  and .demo.foldRounds > 0
  and (.demo.residualProfit | tonumber) <= 1000000000000
' "$manifest" >/dev/null

echo "ARBFOLD deployment smoke test PASS"
