## `configureHooks` in contracts/src/ArbFoldCoordinator.sol (L76-L94)

**Purpose:** One-time binding of the AB, BC and AC hook identities.

---

**Inputs & Assumptions:**
- Three hook interfaces: semi-trusted admin inputs; must be nonzero and pairwise distinct (L79-L83).
- `msg.sender`: must equal immutable `admin` (L77).
- Assumes each accepted interface continues reporting honest reserves and implements the expected curve/setter. Bytecode identity is established by nothing here.
- Assumes pools are initialized/funded and coordinator is an ERC-6909 operator. Established by nothing here; the public deployment performs those actions first at `contracts/script/DeployArbFold.s.sol:L113-L143`.

---

**Outputs & Effects:** Calls each candidate via `_validateHook`; writes three hook slots and `configured=true`; emits `HooksConfigured` (L85-L93). Configuration cannot be changed (L78).

---

**Block-by-Block:**

```solidity
// L77-L87
if (msg.sender != admin) revert NotAdmin();
if (configured) revert AlreadyConfigured();
... _validateHook(...);
```
- **What:** Authorizes, enforces one-shot use and validates surface bindings.
- **Why here:** All reverts occur before persistent configuration.
- **Assumes:** `_validateHook` proves all properties needed later; it proves only those listed in its own record.
- **Establishes:** unique candidates with matching reported manager/coordinator/currencies.
- **Depended on by:** writes at L89-L92.

```solidity
// L89-L93
hookAB = hookAB_; hookBC = hookBC_; hookAC = hookAC_; configured = true;
emit HooksConfigured(...);
```
- **What:** Commits immutable-by-interface membership.
- **Why here:** Only after all three validations pass.
- **Assumes:** No accepted hook later changes the behavior behind its interface.
- **Establishes:** `isHook` membership and availability of `network()`.
- **Depended on by:** router membership checks, hook authorization of `fold`, all reserve reads.

---

**Cross-Function Dependencies:** `_validateHook` (internal) makes external view calls to candidate hooks. Caller is only the deployment admin; public deployer calls at `contracts/script/DeployArbFold.s.sol:L138-L143`.

---

**Open Questions:** Whether code identity, fee/tick, funding and operator approval are intended configuration invariants; none is checked here.

