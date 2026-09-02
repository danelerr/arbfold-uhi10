## shell workflow in scripts/deploy-unichain-sepolia.sh (L80-L249)

**Purpose:** Fail-closed Unichain Sepolia orchestration: repository/network preflight, deployment, two Solidity verifications, canonical demo and finalized manifest.

---

**Inputs & Assumptions:** Protected testnet key, RPC, source-verification label and versioned manifest path; operator-controlled. Manager comes from `resolve-unichain-pool-manager.sh` and its external official-address source. Assumes `origin/main` is the publication authority.

---

**Outputs & Effects:** In deploy mode broadcasts deployment/demo transactions and creates a manifest. Network-check/preflight stop without broadcasts (`L115-L134`). Cleanup removes temporary evidence and key variables/files (`L136-L143`).

---

**Block-by-Block:**

```bash
# L86-L134
validate key/tools/status; require clean main == origin/main; resolve manager; require chain 1301, manager code and funded signer;
```
- **What:** Establishes source/network/operator prerequisites; only deploy mode rejects a pre-existing manifest (`L105-L107`).
- **Why here:** Checks precede broadcasts.
- **Assumes:** Resolver/feed returned the official manager; at this stage manager validation is address source plus nonempty code.
- **Establishes:** Clean source snapshot, expected chain, contract-shaped manager and funded signer.
- **Depended on by:** deployment.

```bash
# L145-L193
record git commit; broadcast DeployArbFold; read addresses; run VerifyArbFoldDeployment;
```
- **What:** Deploys and verifies initialized topology before demo mutation.
- **Why here:** Catches bindings/pool/operator/ledger failures before creating canonical evidence.
- **Assumes:** Broadcast logs and RPC describe the same transactions.
- **Establishes:** Verifier PASS for initialized deployment.
- **Depended on by:** canonical demo.

```bash
# L195-L222
broadcast demo; verify again including deployer solver claim; finalize manifest with RPC;
```
- **What:** Produces execution evidence, rechecks post-demo backing and generates nine runtime identities.
- **Why here:** Solver claim exists only after the fold; bytecode addresses are final.
- **Assumes:** The designated solver models all non-hook A claims created by this controlled sequence.
- **Establishes:** Demo-specific properties, post-demo verifier PASS and observed runtime hashes.
- **Depended on by:** final publication gate.

```bash
# L224-L249
require chain/network/official manager/deployer/source commit/tx/demo and canonical residual <= 1e12; print URL;
```
- **What:** Checks finalized top-level facts and the demo-specific residual bound.
- **Why here:** Terminal local gate after manifest finalization.
- **Assumes:** `finalize-manifest.sh` already enforced runtime count; later live checks perform bytecode and semantic correlation.
- **Establishes:** Listed JSON predicates only.
- **Depended on by:** operator-facing PASS.

---

**Cross-Function Dependencies:** Manager resolver/feed and RPC remain external black boxes; calls `DeployArbFold`, `RunArbFoldDemo`, `VerifyArbFoldDeployment` and `finalize-manifest.sh`.

---

**Open Questions:** `sourceVerification=not-available` is explicitly permitted (`L96-L99`), so successful orchestration need not include explorer source verification. Generated runtime hashes identify observed code but do not themselves prove a compiler/source mapping.
