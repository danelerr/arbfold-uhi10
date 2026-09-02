## `_requireExternalManager` in contracts/script/DeployArbFold.s.sol (L269-L272)

**Purpose:** Minimum preflight for an externally supplied PoolManager address.

---

**Inputs & Assumptions:** `managerAddress` is environment/feed supplied and semi-trusted.

---

**Outputs & Effects:** View-only; rejects zero or empty code. Does not call an interface or compare codehash.

---

**Block-by-Block:**

```solidity
// L269-L272
if (managerAddress == address(0)) revert ...;
if (managerAddress.code.length == 0) revert ...;
```
- **What:** Confirms a contract-shaped target.
- **Why here:** Prevents obvious invalid broadcast target.
- **Assumes:** Address resolution supplied the intended official v4 manager; established outside this function.
- **Establishes:** Nonzero code presence only.
- **Depended on by:** public-manager deployment branch.

---

**Cross-Function Dependencies:** No callees.

---

**Open Questions:** Manager code identity/ownership is outside the gate.
