## `constructor` in contracts/src/ArbFoldRouter.sol (L53-L56)

**Purpose:** Freezes the PoolManager and coordinator used by every routed swap.

**Inputs & Assumptions:** `manager_` and `coordinator_` are trusted deployment
inputs. This function performs no nonzero or cross-link validation: **nothing
found**. Successful swaps depend on the coordinator using the same manager.

**Outputs & Effects:** Writes two immutables. No calls or events.

**Block-by-Block:**

```solidity
// L54-L55
manager = manager_;
coordinator = coordinator_;
```
- **What:** Stores fixed dependencies.
- **Why here:** Router has no upgrade/configuration path.
- **Assumes:** deployment supplied the paired contracts.
- **Establishes:** references cannot change.
- **Depended on by:** all router functions.

**Cross-Function Dependencies:** Deployed after coordinator configuration in
the intended setup. No callees.

**Open Questions:** What deployment gate proves manager/coordinator pairing
outside tests and the manifest?

