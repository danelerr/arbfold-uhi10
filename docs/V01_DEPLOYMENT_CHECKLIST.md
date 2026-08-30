# ARBFOLD v0.1 Deployment Checklist

Status: **prepared, not broadcast**. The immutable v0 manifest and transactions
remain under `deployments/unichain-sepolia-1301.json`.

## Evidence already completed

- Default Foundry suite: 82/82 pass.
- Release Foundry suite: 82/82 pass with 10,000 fuzz runs and 256 invariant
  runs at depth 80 (20,480 calls per invariant property).
- Local deployment script simulation: pass on chain ID 31337, gas
  `331,863,967`.
- Read-only Unichain Sepolia check: chain ID 1301; official PoolManager
  `0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`; runtime bytecode present
  (`24,009` bytes).
- Versioned deployment plan:
  `deployments/unichain-sepolia-1301-v0.1.plan.json`.

## Before any broadcast

1. Commit and publish the exact v0.1 source being deployed.
2. Regenerate `benchmark/optimized-release-candidate-results/` and confirm the
   published commit matches its source manifest.
3. Confirm the worktree is clean and local `main` equals `origin/main`.
4. Re-resolve the official PoolManager and check chain ID and bytecode.
5. Select the dedicated testnet signer and record its current nonce privately.
6. Run the funded-signer preflight. Do not paste or print a private key.
7. Simulate again at the selected signer nonce and record expected CREATE and
   CREATE2 addresses.
8. Obtain explicit authorization for broadcast.

## Exact commands

Read-only network check:

```bash
ARBFOLD_MANIFEST_PATH=deployments/unichain-sepolia-1301-v0.1.json \
  scripts/deploy-unichain-sepolia.sh --network-check
```

Funded signer check without broadcast:

```bash
ARBFOLD_MANIFEST_PATH=deployments/unichain-sepolia-1301-v0.1.json \
  scripts/deploy-unichain-sepolia.sh --preflight
```

Only after explicit authorization:

```bash
ARBFOLD_MANIFEST_PATH=deployments/unichain-sepolia-1301-v0.1.json \
  scripts/deploy-unichain-sepolia.sh
```

The executor refuses to overwrite an existing manifest. After deployment,
verify every receipt, run the read-only deployment verifier, execute a new
canonical transaction, finalize the v0.1 manifest, compare deployed bytecode
with the source manifest, update the app to that manifest, rebuild Pages, and
run `npm run check:live` before publication.
