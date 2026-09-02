## `_verifyHook` in contracts/script/VerifyArbFoldDeployment.s.sol (L120-L141)

**Purpose:** Confirms one hook's intended public bindings, pool parameters, permissions, operator and membership.

---

**Inputs & Assumptions:** Deployment struct, hook, expected currency pair and check label are operator-supplied but previously code-checked.

---

**Outputs & Effects:** External view calls; reverts via `_fail`, no writes/events.

---

**Block-by-Block:**

```solidity
// L127-L137
check coordinator/manager; read key; check currencies, hook, dynamic fee and tickSpacing 60;
```
- **What:** Validates immutable/reported topology.
- **Why here:** Permission/operator checks only make sense for correct hook/key.
- **Assumes:** Getters are truthful; runtime codehash is not checked here.
- **Establishes:** Reported bindings and full key parameters.
- **Depended on by:** L138-L140.

```solidity
// L138-L140
Hooks.validateHookPermissions(...);
if (!manager.isOperator(hook,coordinator)) fail;
if (!coordinator.isHook(hook)) fail;
```
- **What:** Confirms low-bit flags, ERC6909 authority and membership.
- **Why here:** Completes operational prerequisites for fold.
- **Assumes:** Manager implements standard operator getter.
- **Establishes:** Required authority exists at read block.
- **Depended on by:** `verify` PASS.

---

**Cross-Function Dependencies:** Hook/coordinator/manager external views; vendored `Hooks.validateHookPermissions`.

---

**Open Questions:** Runtime identity is complementary manifest evidence, not part of this function.

