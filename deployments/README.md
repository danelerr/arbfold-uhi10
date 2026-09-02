# ARBFOLD deployments

Public research deployments are recorded here as versioned JSON manifests. A manifest contains only public addresses, transaction hashes, source/version metadata and an explicit `researchOnly` flag. It must never contain a private key or RPC credential. `unichain-sepolia-1301-v0.1.json` is the sole public demo manifest. The existing `unichain-sepolia-1301.json` file remains immutable v0 research history and is not a primary submission artifact.

Local smoke-test manifests are generated as `local-*.json` and intentionally ignored. The canonical public target is Unichain Sepolia (`chainId` 1301); its manifest will be committed only after the deployment, canonical transaction and post-deployment verifier all pass. Resolve the current official manager from Uniswap's unified `deployments.json` feed by following [`docs/deployment/DEPLOYMENT_RUNBOOK.md`](../docs/deployment/DEPLOYMENT_RUNBOOK.md); do not rely on a copied address.

The v0.1 manifest also records Sourcify creation/runtime matches for every
active ARBFOLD contract. Recheck those public records with
`npm run check:sources`; the official third-party PoolManager is intentionally
outside the eight project-owned source targets.
