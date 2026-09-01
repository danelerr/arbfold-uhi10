# ARBFOLD Deployment Runbook

This runbook creates a **research-only** ARBFOLD network and one canonical demo
transaction. Demo tokens are permissionlessly mintable and have no value.
Never use a production key or real assets.

## Target

- Network: Unichain Sepolia
- Chain ID: `1301`
- RPC: `https://sepolia.unichain.org`
- Explorer: `https://sepolia.uniscan.xyz`
- PoolManager source of truth:
  `https://developers.uniswap.org/deployments.json`

Do not copy a PoolManager address from this document. Resolve the single active
Unichain Sepolia v4 record immediately before deployment:

```bash
scripts/resolve-unichain-pool-manager.sh
```

On 2026-08-24 the unified Uniswap deployment feed returned
`0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`. Both its address and bytecode
must be checked again at execution time. This dynamic lookup is deliberate:
older protocol-specific pages may retain an earlier deployment.

## Prerequisites

1. Complete `make verify-release` locally.
2. Use a dedicated testnet-only deployer with enough Unichain Sepolia ETH.
3. Keep the RPC URL and private key out of Git, shell history, manifests and
   screenshots.
4. Confirm the working tree and exact commit intended for publication.

The commands below use placeholders. Enter secrets in a private local shell;
the dashboard and repository never request a private key.

### Recommended protected credential handoff

The repository includes a fail-closed executor that performs the complete
deploy → verify → demo → verify → finalize sequence without committing or
pushing anything. Keep the dedicated testnet key outside the repository:

```bash
mkdir -p ~/.config/arbfold
chmod 700 ~/.config/arbfold
${EDITOR:-nano} ~/.config/arbfold/unichain-sepolia.env
chmod 600 ~/.config/arbfold/unichain-sepolia.env
```

The file contains exactly:

```text
ARBFOLD_TESTNET_PRIVATE_KEY=0x...
```

Never paste that value into chat. Once its derived address has Unichain
Sepolia ETH, validate each boundary without broadcasting:

```bash
scripts/deploy-unichain-sepolia.sh --network-check
scripts/deploy-unichain-sepolia.sh --preflight
```

Only after both pass, run the broadcast explicitly:

```bash
scripts/deploy-unichain-sepolia.sh
```

The executor refuses a group/world-readable credential file, a dirty or stale
`main`, a wrong chain, an empty official PoolManager, a zero balance or an
existing public manifest. It leaves the finalized manifest for human review;
publication remains a separate explicit action.

## 1. Resolve and validate the official manager

```bash
pool_manager_address=$(scripts/resolve-unichain-pool-manager.sh)
cast chain-id --rpc-url "$ARBFOLD_UNICHAIN_RPC"
cast code "$pool_manager_address" --rpc-url "$ARBFOLD_UNICHAIN_RPC"
```

The chain ID must be `1301`, and `cast code` must return non-empty bytecode.

## 2. Select a versioned manifest

The immutable v0 manifest is
`deployments/unichain-sepolia-1301.json`. v0.1 must use:

```bash
export ARBFOLD_MANIFEST_PATH=deployments/unichain-sepolia-1301-v0.1.json
```

The executor refuses to overwrite either file. Do not point a v0.1 deployment
at the v0 path.

## 3. Deploy and write the initial manifest

```bash
cd contracts

PRIVATE_KEY="$ARBFOLD_TESTNET_PRIVATE_KEY" \
USE_EXISTING_MANAGER=true \
POOL_MANAGER="$pool_manager_address" \
OFFICIAL_POOL_MANAGER="$pool_manager_address" \
EXPECTED_CHAIN_ID=1301 \
WRITE_MANIFEST=true \
MANIFEST_PATH="$PWD/../deployments/unichain-sepolia-1301-v0.1.json" \
NETWORK_NAME=unichain-sepolia \
GIT_COMMIT=$(git rev-parse HEAD) \
EXPLORER_BASE_URL=https://sepolia.uniscan.xyz \
forge script script/DeployArbFold.s.sol:DeployArbFold \
  --rpc-url "$ARBFOLD_UNICHAIN_RPC" \
  --broadcast
```

Read every address back from the manifest. Do not retype addresses.

## 4. Verify the deployed network before trading

Set the public addresses from the manifest and run:

```bash
POOL_MANAGER="$pool_manager_address" \
COORDINATOR="$coordinator_address" \
HOOK_AB="$hook_ab_address" \
HOOK_BC="$hook_bc_address" \
HOOK_AC="$hook_ac_address" \
ROUTER="$router_address" \
TOKEN_A="$token_a_address" \
TOKEN_B="$token_b_address" \
TOKEN_C="$token_c_address" \
forge script script/VerifyArbFoldDeployment.s.sol:VerifyArbFoldDeployment \
  --rpc-url "$ARBFOLD_UNICHAIN_RPC"
```

This read-only verifier checks hook flags, fixed bindings, positive reserves,
reserve/claim equality, underlying backing, coordinator operators, quote
liveness and EIP-170 runtime sizes.

## 5. Execute the canonical demo

```bash
PRIVATE_KEY="$ARBFOLD_TESTNET_PRIVATE_KEY" \
ROUTER="$router_address" \
COORDINATOR="$coordinator_address" \
ORIGIN_HOOK="$hook_ab_address" \
SOLVER="$deployer_address" \
ZERO_FOR_ONE=false \
AMOUNT_IN=100000000000000000000000 \
WRITE_DEMO_EVIDENCE=true \
DEMO_EVIDENCE_PATH=../deployments/unichain-sepolia-1301-demo.json \
forge script script/RunArbFoldDemo.s.sol:RunArbFoldDemo \
  --rpc-url "$ARBFOLD_UNICHAIN_RPC" \
  --broadcast
```

Run the verifier again with `SOLVER="$deployer_address"` so token-A backing
includes the solver's ERC-6909 claim.

## 6. Finalize the public manifest

```bash
scripts/finalize-manifest.sh \
  deployments/unichain-sepolia-1301-v0.1.json \
  contracts/broadcast/DeployArbFold.s.sol/1301/run-latest.json \
  contracts/broadcast/RunArbFoldDemo.s.sol/1301/run-latest.json \
  not-available \
  deployments/unichain-sepolia-1301-demo.json
```

Replace `not-available` with `partial` or `verified` only after explorer source
verification actually succeeds. Remove the intermediate `*-demo.json` after
the finalized manifest contains its `demo` object.

## 7. Publication checks

- Open every transaction and address link in an incognito browser.
- Confirm `researchOnly: true`, chain `1301`, current official manager, source
  commit, canonical transaction and demo evidence.
- Confirm the dashboard changes from pending to verified without a wallet.
- Never commit broadcast files, RPC credentials or a private key.
- Commit only the finalized public manifest.

If the official manager rejects the pinned core after four focused hours, use
the isolated-manager fallback described in
[`NEXT_ITERATION_PLAN.md`](../../research/archive/decisions/NEXT_ITERATION_PLAN.md), and label it prominently.
