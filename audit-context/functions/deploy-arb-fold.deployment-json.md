## `deploymentJson` in contracts/script/DeployArbFold.s.sol (L147-L183)

**Purpose:** Serializes initial deployment metadata.

---

**Inputs & Assumptions:** Deployer/deployment struct plus environment metadata. Trust: operator-controlled. Assumes supplied metadata truthfully describes source/network.

---

**Outputs & Effects:** Returns serialized JSON; Foundry serialization cheatcodes mutate only script-side buffers. Records no deployment transactions, canonical tx is `pending`, and source verification defaults `not-available` (L177-L182).

---

**Block-by-Block:**

```solidity
// L148-L182
read metadata; serialize addresses/commits; set empty txs, pending canonical, block, source status, researchOnly=true;
```
- **What:** Creates the pre-finalization manifest.
- **Why here:** Called after deployment addresses exist.
- **Assumes:** `GIT_COMMIT`, official manager and network env values were correctly supplied; not derived onchain here.
- **Establishes:** Schema fields, not receipt/event/codehash verification.
- **Depended on by:** shell finalizer.

---

**Cross-Function Dependencies:** Foundry `vm.envOr/serialize*`; no production-contract state changes.

---

**Open Questions:** Runtime identities are intentionally absent from this initial serializer; `scripts/finalize-manifest.sh:L75-L104` now derives all nine from the deployment RPC. Source/artifact correspondence remains outside both steps.
