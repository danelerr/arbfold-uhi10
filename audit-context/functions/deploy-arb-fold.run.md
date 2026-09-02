## `run` in contracts/script/DeployArbFold.s.sol (L56-L81)

**Purpose:** Environment-driven deployment/broadcast entry point and initial manifest writer.

---

**Inputs & Assumptions:** Private key, manager mode/address, expected chain and optional output metadata come from environment (L57-L61, L73-L78). Trust: operator-controlled. Assumes environment and RPC describe the intended network.

---

**Outputs & Effects:** May broadcast the entire deployment, log addresses and write a JSON manifest. Checks expected chain and, for external manager, only nonzero/code before broadcast (L63-L68).

---

**Block-by-Block:**

```solidity
// L57-L70
read env; check chain/external manager; startBroadcast; _deploy(...); stopBroadcast; _validateDeployment(...);
```
- **What:** Loads authority/configuration, emits transactions, then performs local postconditions.
- **Why here:** Chain/manager preflight precedes irreversible broadcast; validation follows constructed state.
- **Assumes:** Code at supplied manager is the intended official manager; type identity is not established by `_requireExternalManager`.
- **Establishes:** `_deploy` and limited post-deployment validation completed without revert.
- **Depended on by:** manifest generation and shell workflow.

```solidity
// L73-L80
string memory manifest = deploymentJson(...);
if (WRITE_MANIFEST) vm.writeJson(...);
```
- **What:** Produces/writes initial evidence.
- **Why here:** Only after deployment validation.
- **Assumes:** Subsequent finalizer will add transaction/demo evidence.
- **Establishes:** Initial addresses/metadata, not final receipt provenance.
- **Depended on by:** `finalize-manifest.sh`.

---

**Cross-Function Dependencies:** `_requireExternalManager`, `_deploy`, `_validateDeployment`, `deploymentJson`; Foundry cheatcodes/RPC are operational black boxes.

---

**Open Questions:** Source verification and runtime hashes are not produced by this function.

