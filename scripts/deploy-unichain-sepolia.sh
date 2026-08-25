#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
contracts_root="$repository_root/contracts"
manifest="$repository_root/deployments/unichain-sepolia-1301.json"
rpc_url=${ARBFOLD_UNICHAIN_RPC:-https://sepolia.unichain.org}
credential_file=${ARBFOLD_CREDENTIAL_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/arbfold/unichain-sepolia.env}
source_verification=${ARBFOLD_SOURCE_VERIFICATION:-not-available}

usage() {
  cat <<'EOF'
usage: scripts/deploy-unichain-sepolia.sh

Deploys the research-only ARBFOLD network and canonical demo to Unichain
Sepolia, verifies the resulting state and writes one finalized public manifest.

Credential input (in precedence order):
  1. ARBFOLD_TESTNET_PRIVATE_KEY already exported in the process environment.
  2. ARBFOLD_CREDENTIAL_FILE, defaulting to:
     ~/.config/arbfold/unichain-sepolia.env

The credential file must be mode 600 and contain:
  ARBFOLD_TESTNET_PRIVATE_KEY=0x...

Optional:
  ARBFOLD_UNICHAIN_RPC=https://sepolia.unichain.org
  ARBFOLD_SOURCE_VERIFICATION=not-available|partial|verified

The script never commits, pushes or prints the private key.
EOF
}

fail() {
  printf 'ARBFOLD deployment preflight failed: %s\n' "$1" >&2
  exit 1
}

file_mode() {
  stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
if [[ "$#" -ne 0 ]]; then
  usage >&2
  exit 64
fi

if [[ -z "${ARBFOLD_TESTNET_PRIVATE_KEY:-}" && -f "$credential_file" ]]; then
  mode=$(file_mode "$credential_file")
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] || fail "cannot determine safe permissions for $credential_file"
  permission_tail=${mode: -2}
  [[ "$permission_tail" == "00" ]] || fail "$credential_file must not be readable or writable by group/others (run chmod 600)"
  set -a
  # shellcheck disable=SC1090
  source "$credential_file"
  set +a
fi

private_key=${ARBFOLD_TESTNET_PRIVATE_KEY:-}
[[ "$private_key" =~ ^0x[0-9a-fA-F]{64}$ ]] || fail "set a dedicated testnet key in the protected credential file; never paste it into chat"

for command in cast curl forge git jq; do
  command -v "$command" >/dev/null || fail "missing required command: $command"
done

case "$source_verification" in
  verified|partial|not-available) ;;
  *) fail "ARBFOLD_SOURCE_VERIFICATION must be verified, partial or not-available" ;;
esac

cd "$repository_root"
[[ "$(git branch --show-current)" == "main" ]] || fail "checkout main before public deployment"
[[ -z "$(git status --porcelain)" ]] || fail "working tree must be clean before public deployment"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || fail "local main must equal origin/main"
[[ ! -e "$manifest" ]] || fail "$manifest already exists; inspect it instead of overwriting public evidence"

pool_manager=$("$repository_root/scripts/resolve-unichain-pool-manager.sh")
chain_id=$(cast chain-id --rpc-url "$rpc_url")
[[ "$chain_id" == "1301" ]] || fail "RPC returned chain $chain_id instead of Unichain Sepolia 1301"
manager_code=$(cast code "$pool_manager" --rpc-url "$rpc_url")
[[ "$manager_code" != "0x" && -n "$manager_code" ]] || fail "official PoolManager has no bytecode"

deployer_address=$(cast wallet address --private-key "$private_key")
balance_wei=$(cast balance "$deployer_address" --rpc-url "$rpc_url")
[[ "$balance_wei" =~ ^[0-9]+$ && "$balance_wei" != "0" ]] || fail "deployer $deployer_address has no Unichain Sepolia ETH"

temporary_directory=$(mktemp -d)
demo_evidence="$temporary_directory/unichain-sepolia-1301-demo.json"
cleanup() {
  unset private_key ARBFOLD_TESTNET_PRIVATE_KEY PRIVATE_KEY
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

git_commit=$(git rev-parse HEAD)
printf 'ARBFOLD deployer: %s\n' "$deployer_address"
printf 'ARBFOLD balance (wei): %s\n' "$balance_wei"
printf 'ARBFOLD official PoolManager: %s\n' "$pool_manager"

(
  cd "$contracts_root"
  PRIVATE_KEY="$private_key" \
  USE_EXISTING_MANAGER=true \
  POOL_MANAGER="$pool_manager" \
  OFFICIAL_POOL_MANAGER="$pool_manager" \
  EXPECTED_CHAIN_ID=1301 \
  WRITE_MANIFEST=true \
  MANIFEST_PATH=../deployments/unichain-sepolia-1301.json \
  NETWORK_NAME=unichain-sepolia \
  GIT_COMMIT="$git_commit" \
  EXPLORER_BASE_URL=https://sepolia.uniscan.xyz \
    forge script script/DeployArbFold.s.sol:DeployArbFold \
      --rpc-url "$rpc_url" \
      --slow \
      --broadcast
)

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
      forge script script/VerifyArbFoldDeployment.s.sol:VerifyArbFoldDeployment \
        --rpc-url "$rpc_url"
  )
}

verify_deployment

(
  cd "$contracts_root"
  PRIVATE_KEY="$private_key" \
  ROUTER="$router" \
  COORDINATOR="$coordinator" \
  ORIGIN_HOOK="$hook_ab" \
  SOLVER="$deployer_address" \
  ZERO_FOR_ONE=false \
  AMOUNT_IN=100000000000000000000000 \
  WRITE_DEMO_EVIDENCE=true \
  DEMO_EVIDENCE_PATH="$demo_evidence" \
    forge script script/RunArbFoldDemo.s.sol:RunArbFoldDemo \
      --rpc-url "$rpc_url" \
      --slow \
      --broadcast
)

verify_deployment "$deployer_address"

deploy_broadcast="$contracts_root/broadcast/DeployArbFold.s.sol/1301/run-latest.json"
demo_broadcast="$contracts_root/broadcast/RunArbFoldDemo.s.sol/1301/run-latest.json"
"$repository_root/scripts/finalize-manifest.sh" \
  "$manifest" \
  "$deploy_broadcast" \
  "$demo_broadcast" \
  "$source_verification" \
  "$demo_evidence"

pool_manager_lower=$(printf '%s' "$pool_manager" | tr '[:upper:]' '[:lower:]')
deployer_address_lower=$(printf '%s' "$deployer_address" | tr '[:upper:]' '[:lower:]')

jq -e \
  --arg manager "$pool_manager_lower" \
  --arg deployer "$deployer_address_lower" \
  --arg commit "$git_commit" \
  '.chainId == 1301
   and .network == "unichain-sepolia"
   and .researchOnly == true
   and .usesExistingManager == true
   and ((.officialPoolManager | ascii_downcase) == $manager)
   and ((.poolManager | ascii_downcase) == $manager)
   and ((.deployer | ascii_downcase) == $deployer)
   and .gitCommit == $commit
   and (.deploymentTransactions | length > 0)
   and (.canonicalDemoTransaction | startswith("0x"))
   and .demo.chainId == 1301
   and .demo.foldRounds > 0
   and ((.demo.residualProfit | tonumber) <= 1000000000000)' \
  "$manifest" >/dev/null

canonical_transaction=$(jq -er '.canonicalDemoTransaction' "$manifest")
printf 'ARBFOLD public deployment PASS\n'
printf 'Manifest: %s\n' "$manifest"
printf 'Canonical transaction: https://sepolia.uniscan.xyz/tx/%s\n' "$canonical_transaction"
