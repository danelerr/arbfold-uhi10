## `poolKey` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol (L120-L122)

**Purpose:** Returns the single stored pool key used by liquidity accounting and coordinator configuration.

---

**Inputs & Assumptions:**
- No explicit inputs.
- Implicit: private `_poolKey` at L105.
- Precondition for a configured value: successful `_beforeInitialize`; not checked in this getter.

---

**Outputs & Effects:**
- Returns `_poolKey` (L121).
- Before initialization, all fields have zero/default values (L105).
- No writes, events, or external calls.

---

**Block-by-Block:**

```solidity
// L120-L122
function poolKey() public view returns (PoolKey memory) {
    return _poolKey;
}
```
- **What:** Copies the stored key to memory and returns it.
- **Why here:** All hook-owned liquidity paths use one persistent key rather than caller-provided keys.
- **Assumes:** none for returning storage; consumers assuming initialization rely on upstream checks or **nothing found**.
- **Establishes:** a snapshot only.
- **Depended on by:** `addLiquidity`, `removeLiquidity`, custom `unlockCallback`, and coordinator `_validateHook` (`BaseCustomAccounting.sol:L144-L148`, L198-L200; `BaseCustomCurve.sol:L196`; `ArbFoldCoordinator.sol:L161-L173`).

---

**Cross-Function Dependencies:**
- No callees.
- Writer `_beforeInitialize` (internal/base-source-available, `BaseCustomAccounting.sol:L318-L325`).
- Callers are unrestricted for this public view function (L120).
- Shared state: `_poolKey` has one intended writer.
- Invariant coupling: one-pool behavior depends on the sentinel/write logic in `_beforeInitialize`, not on this getter.

---

**Open Questions:**
- None for the getter; initialization provenance is covered in the companion record.

