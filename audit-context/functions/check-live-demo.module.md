## top-level module in scripts/check-live-demo.mjs (L1-L261)

**Purpose:** Read-only identity, canonical-evidence and current-callability check for the v0.1 public deployment.

---

**Inputs & Assumptions:** Versioned manifest plus optional RPC URL. Trust boundary: repository evidence and one RPC provider. Assumes the prepared account keeps balance/allowance at least `maximumInput`; this mutable prerequisite currently holds at exactly 25.000 B allowance.

---

**Outputs & Effects:** Reads receipts, bytecode and state; runs two `eth_call` simulations and one gas estimate; prints PASS/metrics. It sends no transaction and writes no file.

---

**Block-by-Block:**

```javascript
// L1-L49
validate manifest; construct client and minimal coordinator/token/router ABIs;
```
- **What:** Selects chain 1301 and the functions/events needed below.
- **Why here:** Manifest validation precedes external calls.
- **Assumes:** The frozen RPC URL or override provides honest archival/current responses.
- **Establishes:** Typed inputs for all later reads.
- **Depended on by:** entire module.

```javascript
// L50-L94
fetch canonical/optional interactive/allowance receipts and nine code blobs; verify statuses, runtime identities and allowance receipt metadata;
```
- **What:** Hash-pins PoolManager and all eight project/token targets and binds the allowance receipt to account, token and block.
- **Why here:** Rejects wrong code/evidence before interpreting state.
- **Assumes:** The allowance receipt calldata need not be decoded because current allowance is read later. Independent revalidation decoded it as `approve(router, 25000e18)`.
- **Establishes:** Exact manifest/runtime identity and successful listed receipts.
- **Depended on by:** semantic and simulation gates.

```javascript
// L95-L151
decode canonical ARBFOLD events and require exact receipt/event semantics; optionally do the same for interactiveDemo;
```
- **What:** Checks one canonical swap, exact round count, one completion, sender/router/block and every published swap/fold/reward value.
- **Why here:** A successful receipt alone would not identify the claimed execution.
- **Assumes:** Matching ABI logs in this pinned transaction represent the intended contracts; log emitter addresses are not separately filtered.
- **Establishes:** Canonical event topology and values match the manifest.
- **Depended on by:** PASS claim.

```javascript
// L153-L200
read current metrics, nine coordinator/router bindings and historical pre/post networks; compare bindings and snapshots exactly;
```
- **What:** Separates mutable live state from canonical block evidence.
- **Why here:** Historical reads correlate the manifest to state transition, while getters catch topology drift.
- **Assumes:** Archival RPC access to blocks 61277492/61277493.
- **Establishes:** Basic manager/token/hook/router bindings and lossless six-field snapshots.
- **Depended on by:** current simulation/reporting.

```javascript
// L202-L254
read B balance/allowance; simulate 1,000 B with zero and 99.5% minimum; estimate and buffer gas;
```
- **What:** Requires balance and allowance ≥25.000 B, but executes only a 1.000 B point simulation.
- **Why here:** Tests a conservative prepared-account capacity plus the UI-style signed path.
- **Assumes:** State remains sufficiently stable across sequential calls.
- **Establishes:** Point-in-time callability for the simulated size and positive/buffered gas behavior; not callability at the full maximum.
- **Depended on by:** output at `L256-L261`.

---

**Cross-Function Dependencies:** `validateManifest`, `runtimeBytecodeTargets`, `assertRuntimeBytecodeIdentity`, `assertNetworkSnapshot`, `normalizeNetwork`, `bufferedGasLimit`; viem/RPC; coordinator/router/token ABIs. It does not invoke `VerifyArbFoldDeployment`.

---

**Open Questions:** Pool keys, hook manager/coordinator storage, operator approval, claim/reserve equality, backing, deployment receipts and source provenance remain outside this command. Current residual is reported but not compared with `RESIDUAL_THRESHOLD`.

