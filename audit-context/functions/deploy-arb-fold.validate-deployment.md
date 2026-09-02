## `_validateDeployment` in contracts/script/DeployArbFold.s.sol (L244-L253)

**Purpose:** Lightweight in-script post-deployment gate.

---

**Inputs & Assumptions:** Deployment struct returned by `_deploy`; trusted internal references.

---

**Outputs & Effects:** Pure/view checks of hook permission bits and coordinator membership/configuration; no writes/events.

---

**Block-by-Block:**

```solidity
// L245-L252
validate permissions for three hooks;
if (!configured || !isHook(AB/BC/AC)) revert ...;
```
- **What:** Confirms low-bit permission declarations and registered addresses.
- **Why here:** Runs after broadcast construction, before manifest emission.
- **Assumes:** These checks are sufficient for the script stage.
- **Establishes:** Membership/permission flags only; manager binding, pool key details, operator, claims/backing are checked by the separate verifier, not here.
- **Depended on by:** `run` success.

---

**Cross-Function Dependencies:** `_validateHookPermissions`, coordinator view methods.

---

**Open Questions:** None; scope is narrower than `VerifyArbFoldDeployment.verify`.

