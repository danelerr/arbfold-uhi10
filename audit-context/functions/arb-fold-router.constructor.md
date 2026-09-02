## `constructor` in contracts/src/ArbFoldRouter.sol (L53-L56)

**Purpose:** Permanently pairs one router with a PoolManager and coordinator.

---

**Inputs & Assumptions:** `manager_` and `coordinator_` are trusted deployment inputs. No nonzero, code or mutual-binding checks are performed.

---

**Outputs & Effects:** Writes two immutables. No external calls/events.

---

**Block-by-Block:**

```solidity
// L53-L56
manager = manager_;
coordinator = coordinator_;
```
- **What:** Stores both references unconditionally.
- **Why here:** Constructor makes the pairing permanent.
- **Assumes:** Coordinator uses the same manager and is the intended runtime; established by nothing here.
- **Establishes:** Stable callback authority and membership oracle.
- **Depended on by:** both public entry points.

---

**Cross-Function Dependencies:** Public deployer constructs the pair at `contracts/script/DeployArbFold.s.sol:L144`; verifier enforces pairing at `contracts/script/VerifyArbFoldDeployment.s.sol:L67-L76`.

---

**Open Questions:** Whether generic deployments outside the script are supported.

