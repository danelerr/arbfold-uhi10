## `constructor` in contracts/src/ArbFoldHook.sol (L43-L46)

**Purpose:** Binds one custom-curve hook to a PoolManager and immutable
coordinator, while deploying it as the ERC-20 LP share token.

**Inputs & Assumptions:**
- `manager_`: trusted deployment input; passed to `BaseHook`.
- `coordinator_`: trusted deployment input; required nonzero (L44).
- Assumes the CREATE2 address carries all permission bits returned by inherited
  `BaseCustomCurve.getHookPermissions`; `BaseHook` constructor validates this.

**Outputs & Effects:** Writes inherited immutable `poolManager`, immutable
`coordinator`, ERC-20 name/symbol. No event in this body.

**Block-by-Block:**

```solidity
// L43-L45
constructor(...) BaseHook(manager_) ERC20(...) {
    if (coordinator_ == address(0)) revert NotCoordinator();
    coordinator = coordinator_;
}
```
- **What:** Runs base constructors, rejects zero coordinator and freezes it.
- **Why here:** These dependencies cannot be replaced after deployment.
- **Assumes:** manager is the intended manager; this body does not reject zero.
- **Establishes:** nonzero immutable coordinator and permission-compatible hook
  address, subject to base constructor success.
- **Depended on by:** callback gating, claim operator setup, configuration.

**Cross-Function Dependencies:** `BaseHook.constructor` stores manager and calls
`Hooks.validateHookPermissions` (`BaseHook.sol:L49-L52`, L74-L76). Factory
`ArbFoldHookDeployer.deploy` is the ordinary caller.

**Open Questions:** Nonzero manager is not checked in this body; deployment and
coordinator configuration establish the intended link.

