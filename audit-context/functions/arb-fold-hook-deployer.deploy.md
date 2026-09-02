## `deploy` in contracts/src/ArbFoldHookDeployer.sol (L11-L14)

**Purpose:** Permissionless CREATE2 factory used to realize hook addresses with required low-bit permissions.

---

**Inputs & Assumptions:** `manager`, `coordinator`, `salt` are untrusted caller inputs. Constructor validation belongs to `ArbFoldHook`; factory does not bind a caller or record deployments.

---

**Outputs & Effects:** Deploys a new hook with CREATE2, emits address/salt, returns hook. Reverts on address collision or constructor failure.

---

**Block-by-Block:**

```solidity
// L11-L14
hook = new ArbFoldHook{salt: salt}(manager, coordinator);
emit HookDeployed(address(hook), salt);
```
- **What:** Deterministically creates and records a hook.
- **Why here:** Event follows successful construction.
- **Assumes:** Caller precomputed a salt whose address flags match permissions; `BaseHook` constructor validates flags (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L49-L52`, `L74-L76`).
- **Establishes:** Deployed code at returned address with supplied immutable bindings.
- **Depended on by:** deployment script's expected-address equality check (`contracts/script/DeployArbFold.s.sol:L185-L196`).

---

**Cross-Function Dependencies:** `ArbFoldHook` and inherited `BaseHook` constructors, source available.

---

**Open Questions:** None; public access permits unrelated deployments but grants no authority over registered coordinator hooks.

