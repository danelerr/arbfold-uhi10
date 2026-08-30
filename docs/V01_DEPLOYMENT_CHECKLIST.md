# ARBFOLD v0.1 Deployment Checklist

Status: **deployed and verified on 2026-08-30**. The v0.1 manifest is
`deployments/unichain-sepolia-1301-v0.1.json`; v0 remains research history under
`deployments/unichain-sepolia-1301.json`.

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

## Completed broadcast gate

1. Completed: committed and published the exact v0.1 source deployed at
   `6670e626a836db82a2810497812009c1394b0b20`.
2. Completed: regenerated `benchmark/optimized-release-candidate-results/` and confirmed the
   published commit matches its source manifest.
3. Completed: confirmed the worktree was clean and local `main` equalled `origin/main` before broadcast.
4. Completed: re-resolved the official PoolManager and checked chain ID and bytecode.
5. Completed: selected the dedicated testnet signer and recorded its nonce privately.
6. Completed: ran the funded-signer preflight without exposing its private key.
7. Completed: simulated again at the selected signer nonce and recorded expected CREATE and
   CREATE2 addresses.
8. Completed: Daniel explicitly authorized broadcast.

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
