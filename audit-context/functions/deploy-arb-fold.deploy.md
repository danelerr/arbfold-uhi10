## `_deploy` in contracts/script/DeployArbFold.s.sol (L84-L145)

**Purpose:** Constructs and initializes the fixed three-pool topology.

---

**Inputs & Assumptions:** Liquidity provider, manager mode and optional manager are operator-controlled. Assumes enough gas/funds and that external manager supports the v4 interface.

---

**Outputs & Effects:** Deploys manager or adopts supplied one, three DemoTokens, coordinator, factory, three mined hooks and router; mints tokens; initializes/funds/authorizes pools; configures coordinator (L88-L145).

---

**Block-by-Block:**

```solidity
// L88-L107
select manager; deploy sorted tokens/coordinator/factory; mine and deploy three hooks;
```
- **What:** Creates all identities and immutable bindings.
- **Why here:** Hook CREATE2 args require coordinator/manager first.
- **Assumes:** Hook mining completes within operational resources; excluded from measured runtime gas by `foundry.toml:L13-L14`.
- **Establishes:** Three exact hook runtimes with matching low-bit permissions.
- **Depended on by:** initialization.

```solidity
// L109-L144
mint; _initialize three pairs; configureHooks; deploy router;
```
- **What:** Funds each hook, grants operator, freezes hook set and creates the public entry point.
- **Why here:** Funding/authorization precede the one-shot coordinator configuration.
- **Assumes:** All external manager/token operations execute per vendored implementations.
- **Establishes:** Intended deployment is operational at return.
- **Depended on by:** verifier and demo.

---

**Cross-Function Dependencies:** `_deploySortedTokens`, `_mineAndDeploy`, `_initialize`, coordinator configuration and constructors, all source available; external manager is runtime black box on public path.

---

**Open Questions:** None for ordering; identity of external manager is procedural rather than contract-enforced.

