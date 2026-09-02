## `_validateHook` in contracts/src/ArbFoldCoordinator.sol (L161-L173)

**Purpose:** Checks the minimum interface bindings a candidate must report before permanent registration.

---

**Inputs & Assumptions:**
- `hook`: semi-trusted external contract chosen by admin.
- `expected0/expected1`: trusted immutables chosen by the caller.
- Assumes successful return values are truthful and stable. Runtime/codehash pinning: nothing found.

---

**Outputs & Effects:** Reverts on no code, wrong coordinator/manager, wrong hook address or currencies. No state writes/events.

---

**Block-by-Block:**

```solidity
// L162-L166
if (address(hook).code.length == 0) revert ...;
if (hook.coordinator() != address(this) || address(hook.poolManager()) != address(manager)) revert ...;
PoolKey memory key = hook.poolKey();
```
- **What:** Requires code and queries three external getters.
- **Why here:** Rejects incompatible bindings before inspecting key fields.
- **Assumes:** External getters neither mutate/reenter nor later change; `view` at the interface does not prove code identity.
- **Establishes:** Code exists and reported core bindings match at this call.
- **Depended on by:** L167-L171 and `configureHooks`.

```solidity
// L167-L172
if (address(key.hooks) != address(hook) || key.currency0 != expected0 || key.currency1 != expected1) revert ...;
```
- **What:** Confirms three `PoolKey` fields.
- **Why here:** Assigns the AB/BC/AC semantic role.
- **Assumes:** Fee, tick spacing, initialization and hook permission flags need not be checked. Nothing here establishes them.
- **Establishes:** Reported key points at the candidate and expected ordered currencies.
- **Depended on by:** cycle reserve interpretation.

---

**Cross-Function Dependencies:** External-source-available for the intended `ArbFoldHook` getters; external-black-box for any other accepted implementation. Public verifier adds fee, tick, permissions and operator checks at `contracts/script/VerifyArbFoldDeployment.s.sol:L120-L140`.

---

**Open Questions:** Is accepting behavioral interface compatibility intentional, or should the configured set mean the exact `ArbFoldHook` runtime?

