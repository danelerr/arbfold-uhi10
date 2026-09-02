## `isHook` in contracts/src/ArbFoldCoordinator.sol (L96-L99)

**Purpose:** Membership predicate shared by coordinator and router.

---

**Inputs & Assumptions:** `candidate` is untrusted. Reads `configured` and three hook slots.

---

**Outputs & Effects:** Returns true only after configuration and exact address equality. No writes, calls or events.

---

**Block-by-Block:**

```solidity
// L96-L99
return configured && (candidate == address(hookAB) || ...);
```
- **What:** Tests fixed-set membership.
- **Why here:** Single expression prevents zero-valued preconfiguration slots from counting.
- **Assumes:** `configureHooks` registered the intended implementations.
- **Establishes:** Address membership only, not current code or operational state.
- **Depended on by:** `fold` L132-L135 and router L69.

---

**Cross-Function Dependencies:** No callees. Shared state is written only by `configureHooks`.

---

**Open Questions:** None for address membership; behavioral identity is outside this predicate.

