## `validateManifest` in app/live-core.js (L19-L96)

**Purpose:** Fail-closed schema and identity gate before the UI/live checker consumes the sole v0.1 deployment manifest.

---

**Inputs & Assumptions:** `manifest` is untrusted parsed JSON. Formats and a frozen PoolManager address are checked here; semantic correspondence of receipts, bytecode and snapshots is delegated to the live checker.

---

**Outputs & Effects:** Throws on any rejected field; otherwise returns the same object. No calls or writes.

---

**Block-by-Block:**

```javascript
// L19-L48
require researchOnly, chain 1301, demo, ten address strings, positive canonical block and tx hash;
require poolManager == officialPoolManager == frozen official address;
```
- **What:** Establishes target network and address syntax, including an exact official-manager binding.
- **Why here:** All later RPC calls depend on a single, known topology.
- **Assumes:** The constant itself is the intended publication authority.
- **Establishes:** A substituted manager address cannot pass this gate.
- **Depended on by:** UI and `check-live-demo.mjs`.

```javascript
// L49-L75
validate optional interactive evidence and required canonical demo fields/snapshots;
```
- **What:** Requires numeric event fields, six and only six reserve keys, user/hook/solver addresses and a boolean direction.
- **Why here:** Enables exact downstream comparisons rather than permissive coercion.
- **Assumes:** Optional `interactiveDemo` absence is supported; canonical `demo` is mandatory.
- **Establishes:** Both canonical snapshots are lossless decimal strings with no extra/missing reserve field.
- **Depended on by:** event and historical-state validation.

```javascript
// L76-L94
require rpcSimulation metadata and exactly nine runtimeBytecode records with positive byte counts and keccak hashes;
```
- **What:** Makes account, allowance receipt/block, maximum input and PoolManager-plus-eight runtime identities mandatory.
- **Why here:** The checker dereferences all of them unconditionally.
- **Assumes:** Published hashes are evidence to be checked on-chain, not proof of source provenance.
- **Establishes:** Missing/extra runtime keys and malformed values fail before RPC reads.
- **Depended on by:** `runtimeBytecodeTargets` and checker receipt/capacity gates.

---

**Cross-Function Dependencies:** Pure JS checks; exact key list is `RUNTIME_BYTECODE_KEYS` (`L7-L17`). Runtime values are consumed by `runtimeBytecodeTargets`/`assertRuntimeBytecodeIdentity` (`L98-L127`) and the live checker (`scripts/check-live-demo.mjs:L65-L87`).

---

**Open Questions:** Nothing here connects a runtime hash to a compiler/source artifact; the independent artifact comparison is separate evidence.

