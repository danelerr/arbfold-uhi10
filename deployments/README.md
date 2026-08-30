# ARBFOLD deployments

Public research deployments are recorded here as versioned JSON manifests. A manifest contains only public addresses, transaction hashes, source/version metadata and an explicit `researchOnly` flag. It must never contain a private key or RPC credential. The existing `unichain-sepolia-1301.json` file is immutable v0 evidence; v0.1 must use `unichain-sepolia-1301-v0.1.json` and may only be created after an explicitly authorized broadcast.

Local smoke-test manifests are generated as `local-*.json` and intentionally ignored. The canonical public target is Unichain Sepolia (`chainId` 1301); its manifest will be committed only after the deployment, canonical transaction and post-deployment verifier all pass. Resolve the current official manager from Uniswap's unified `deployments.json` feed by following [`docs/DEPLOYMENT_RUNBOOK.md`](../docs/DEPLOYMENT_RUNBOOK.md); do not rely on a copied address.
