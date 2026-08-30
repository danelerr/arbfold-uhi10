## `constructor` in contracts/src/ArbFoldCoordinator.sol (L56-L66)

**Purpose:** Fixes the PoolManager, deployment administrator and three currency
roles for the coordinator's lifetime.

**Inputs & Assumptions:**
- `manager_`: trusted deployment input; required nonzero at L57-L60.
- `tokenA_`, `tokenB_`, `tokenC_`: trusted deployment inputs; each required
  nonzero at L57-L60.
- Implicit `msg.sender`: becomes immutable `admin` (L62).
- Distinctness and currency ordering are not checked here; successful later
  hook configuration relies on initialized pool keys. Direct establishment in
  this function: **nothing found**.

**Outputs & Effects:** Writes four immutables (L61-L65). No external calls or
events.

**Block-by-Block:**

```solidity
// L57-L60
if (address(manager_) == address(0) || ... ) revert InvalidHookConfiguration();
```
- **What:** Rejects a zero manager or zero currency.
- **Why here:** Prevents permanent zero immutable dependencies.
- **Assumes:** `Currency.unwrap` faithfully exposes the underlying address.
- **Establishes:** all four immutable dependency addresses are nonzero.
- **Depended on by:** every coordinator read, quote and claim transfer.

```solidity
// L61-L65
manager = manager_; admin = msg.sender; tokenA = tokenA_; tokenB = tokenB_; tokenC = tokenC_;
```
- **What:** Freezes manager, authority and token roles.
- **Why here:** Constructor-only assignment makes the network non-upgradeable.
- **Assumes:** deployer selected the intended manager and role ordering.
- **Establishes:** these references cannot change after deployment.
- **Depended on by:** `configureHooks`, `_validateHook`, `_applyDirect`.

**Cross-Function Dependencies:** No callees beyond `Currency.unwrap`. Caller is
deployment code. `configureHooks` is the only function that can complete the
network.

**Open Questions:** What source outside this constructor establishes distinct,
sorted A/B/C roles for every deployment?

