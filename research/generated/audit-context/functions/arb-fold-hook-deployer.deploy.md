## `deploy` in contracts/src/ArbFoldHookDeployer.sol (L11-L14)

**Purpose:** CREATE2-deploys an ArbFoldHook at a permission-bit-compatible
address using an externally mined salt.

**Inputs & Assumptions:** `manager`, `coordinator`, `salt` are untrusted/public.
Assumes caller selected a salt whose derived address satisfies hook permission
bits; otherwise inherited hook constructor reverts.

**Outputs & Effects:** Creates a new hook, returns it and emits `HookDeployed`.

**Block-by-Block:**

```solidity
// L12-L13
hook = new ArbFoldHook{salt: salt}(manager, coordinator);
emit HookDeployed(address(hook), salt);
```
- **What:** Deterministically deploys and reports the hook.
- **Why here:** Factory address + salt + creation code control required low bits.
- **Assumes:** CREATE2 address not already occupied.
- **Establishes:** successful hook passed constructor/base permission validation.
- **Depended on by:** deployment scripts and test setup.

**Cross-Function Dependencies:** `ArbFoldHook.constructor`, inherited
`BaseHook._validateHookAddress`. Anyone may call factory; deployment alone does
not register the hook.

**Open Questions:** None; trust begins only when coordinator admin later validates
and configures selected instances.

