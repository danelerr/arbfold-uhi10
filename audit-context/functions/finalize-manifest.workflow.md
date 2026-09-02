## shell workflow in scripts/finalize-manifest.sh (L1-L113)

**Purpose:** Merge Foundry broadcast/demo evidence into a deployment manifest and freeze all nine live runtime identities.

---

**Inputs & Assumptions:** Manifest, deployment and demo broadcast JSON, source-verification status, optional demo evidence and RPC URL; operator-controlled. Assumes all files and the RPC refer to the same intended deployment/run.

---

**Outputs & Effects:** Rewrites the manifest through temporary files, performs RPC `eth_getCode` reads via `cast`, and applies a final jq predicate. It sends no transaction.

---

**Block-by-Block:**

```bash
# L4-L40
validate six arguments/files/status; select last demo tx, receipt block and current git commit;
```
- **What:** Derives canonical metadata from the supplied broadcast.
- **Why here:** All values feed the merge.
- **Assumes:** The last demo transaction is the intended canonical swap and its receipt belongs to the same deployment.
- **Establishes:** Required inputs and a receipt-backed canonical block/hash exist in supplied files.
- **Depended on by:** jq merge.

```bash
# L42-L73
merge deployment hashes, canonical tx/block/commit/status and optional normalized six-field demo snapshots;
```
- **What:** Produces a temporary consolidated manifest.
- **Why here:** Runtime addresses come from that merged object.
- **Assumes:** Demo evidence values correspond semantically to the selected receipt; this shell does not decode events.
- **Establishes:** Publication fields and optional canonical state evidence.
- **Depended on by:** runtime loop.

```bash
# L75-L104
for PoolManager plus eight targets: fetch code, reject empty, compute bytes/keccak, write runtimeBytecode;
```
- **What:** Generates all nine runtime records directly from the provided RPC.
- **Why here:** It freezes post-deployment identity after addresses are known.
- **Assumes:** One RPC response is authoritative and observed bytecode is the intended code; no compiler artifact is compared.
- **Establishes:** Nonempty code plus exact observed size/hash for each named address.
- **Depended on by:** live-core/checker identity gates.

```bash
# L106-L113
replace manifest; require research flag, txs, canonical hash prefix, nine runtime entries and positive demo rounds;
```
- **What:** Makes the temporary result public then applies a shallow final predicate.
- **Why here:** Terminal workflow gate.
- **Assumes:** Later validation will enforce exact runtime keys/formats and semantic receipt/snapshot correspondence.
- **Establishes:** Listed predicates only; because the move precedes jq, a final predicate failure can leave the rejected file at the target path.
- **Depended on by:** deployment shell and publication tooling.

---

**Cross-Function Dependencies:** `jq`, `git`, `cast`, one RPC and supplied Foundry/evidence files. `deploy-unichain-sepolia.sh:L214-L222` passes the RPC; `app/live-core.js:L85-L94` later applies the exact runtime schema.

---

**Open Questions:** Runtime pinning proves consistency with the observation, not source/build provenance; that comparison remains a separate release step.

