## `_sameNetwork` in contracts/src/ArbFoldCoordinator.sol (L229-L236)

**Purpose:** Exact equality predicate for calculated versus reported virtual reserves.

---

**Inputs & Assumptions:** Two trusted memory structs. Assumes all relevant virtual state is captured by six fields.

---

**Outputs & Effects:** Pure boolean; no calls, writes or events.

---

**Block-by-Block:**

```solidity
// L234-L235
return expected.abA == actual.abA && ... && expected.acC == actual.acC;
```
- **What:** Compares all six reserve scalars.
- **Why here:** Single predicate used by `fold` final reconciliation.
- **Assumes:** Claim balances, LP supply, operator status and backing need not be part of this equality; they are not read.
- **Establishes:** Exact six-field equality only.
- **Depended on by:** `fold` L155.

---

**Cross-Function Dependencies:** No callees. Only caller is `fold`.

---

**Open Questions:** Whether claim/reserve equality belongs in the intended state-drift definition.

