## `constructor` in contracts/src/ArbFoldHook.sol (L43-L46)

**Purpose:** Binds the hook permanently to one `IPoolManager` address and one coordinator address, initializes the LP ERC-20 metadata, and rejects deployments whose address bits do not match the hook permissions.

---

**Inputs & Assumptions:**
- `manager_` (`IPoolManager`): deployment-supplied external dependency. Trust: **trusted by deployment**; this body does not reject zero, check code, or identify a particular `PoolManager` implementation (L43).
- `coordinator_` (`address`): deployment-supplied fold authority. Trust: **trusted by deployment**; nonzero is enforced at L44, while code presence and interface behavior are established by **nothing found** in this constructor.
- Implicit: the deploying address must give the new hook the low-order permission bits returned by `BaseCustomCurve.getHookPermissions`; `BaseHook` checks those bits during construction (`BaseHook.sol:L49-L51`, `Hooks.sol:L83-L103`).

---

**Outputs & Effects:**
- Writes inherited immutable `poolManager` in `BaseHook.sol:L49-L50`.
- Writes immutable `coordinator` at L45.
- Writes inherited ERC-20 name and symbol through `ERC20.sol:L44-L47`.
- Reverts at L44 for a zero coordinator or in the base constructor when the deployed address bits do not match permissions (`Hooks.sol:L83-L103`).
- No event is emitted by this constructor.

---

**Block-by-Block:**

```solidity
// L43-L45
constructor(IPoolManager manager_, address coordinator_) BaseHook(manager_) ERC20("ARBFOLD Research LP", "ARB-LP") {
    if (coordinator_ == address(0)) revert NotCoordinator();
    coordinator = coordinator_;
}
```
- **What:** Runs both base constructors, rejects a zero coordinator, and freezes the coordinator address.
- **Why here:** All callback authorization and fold delegation use these immutable addresses after deployment (L34, `BaseHook.sol:L34`).
- **Assumes:** `manager_` implements the checked-in `PoolManager` semantics and `coordinator_` implements `IArbFoldCoordinator`; establishment in this constructor: **nothing found**.
- **Establishes:** the coordinator is nonzero and immutable (L44-L45); the hook address permission bits match `getHookPermissions` if construction succeeds (`BaseHook.sol:L49-L51`, `Hooks.sol:L83-L103`).
- **Depended on by:** `onlyPoolManager` (`BaseHook.sol:L57-L60`), `authorizeCoordinator` (L53-L58), `setReservesFromCoordinator` (L61-L69), and `_beforeSwap` (L72-L83).

---

**Cross-Function Dependencies:**
- Callee `BaseHook.constructor` (internal/base-source-available, `BaseHook.sol:L49-L52`): stores `manager_` and validates this hook's address bits; it does not validate the manager address.
- Callee `Hooks.validateHookPermissions` (internal/source-available, `Hooks.sol:L83-L103`): compares every advertised permission to the corresponding address bit.
- Callee `ERC20.constructor` (internal/base-source-available, `ERC20.sol:L44-L47`): stores the fixed LP name and symbol.
- Callers: deployment code; caller restrictions are **nothing found** in this constructor.
- Shared state: the two immutable dependencies are read throughout the inherited and local entry points (`ArbFoldHook.sol:L34`, `BaseHook.sol:L34`).
- Invariant coupling: authorization by address is meaningful only if the deployed addresses contain the intended code; runtime code identity is established by **nothing found** here.

---

**Open Questions:**
- unclear; need deployment evidence to establish the runtime bytecode identities behind `manager_` and `coordinator_`.

