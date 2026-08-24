# ARBFOLD deployments

Public research deployments are recorded here as versioned JSON manifests. A manifest contains only public addresses, transaction hashes, source/version metadata and an explicit `researchOnly` flag. It must never contain a private key or RPC credential.

Local smoke-test manifests are generated as `local-*.json` and intentionally ignored. The canonical public target is Unichain Sepolia (`chainId` 1301); its manifest will be committed only after the deployment and post-deployment verifier both pass.
