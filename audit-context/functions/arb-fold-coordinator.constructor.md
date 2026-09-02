## `constructor` in contracts/src/ArbFoldCoordinator.sol (L63-L73)

**Purpose:** Fija manager, administrador y las tres monedas para toda la vida del coordinador.

---

**Inputs & Assumptions:**
- `manager_`, `tokenA_`, `tokenB_`, `tokenC_`: semi-trusted deployment inputs; sólo se exige que no sean cero (L64-L67).
- Implicit: `msg.sender` becomes `admin` (L69).
- Preconditions not enforced here: manager has the expected v4 code; tokens have code, are distinct and ordered, use compatible ERC-20 behavior and comparable units. Established by nothing in this function. The public deployer sorts three concrete `DemoToken`s at `contracts/script/DeployArbFold.s.sol:L233-L242`.

---

**Outputs & Effects:** Writes five immutables (L68-L72). No external calls or events.

---

**Block-by-Block:**

```solidity
// L64-L72
if (address(manager_) == address(0) || ... ) revert InvalidHookConfiguration();
manager = manager_; admin = msg.sender; tokenA = tokenA_; tokenB = tokenB_; tokenC = tokenC_;
```
- **What:** Rejects zero addresses and stores every binding.
- **Why here:** These values cannot be repaired later.
- **Assumes:** Nonzero identities are the intended identities; nothing in the constructor establishes type or pair semantics.
- **Establishes:** Stable references and sole future configurator.
- **Depended on by:** every configuration, quote and fold path.

---

**Cross-Function Dependencies:** No callees. `configureHooks` relies on these values. Public deployment constructs it at `contracts/script/DeployArbFold.s.sol:L96-L102`.

---

**Open Questions:** Is generic deployment meant to support arbitrary ERC-20s, or only the three runtime-identical demo tokens?

