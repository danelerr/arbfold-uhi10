## `isHook` in contracts/src/ArbFoldCoordinator.sol (L89-L92)

**Purpose:** Membership test for the fixed three-hook network.

**Inputs & Assumptions:** `candidate` is untrusted. Reads `configured` and the
three stored hook addresses.

**Outputs & Effects:** Returns true only after configuration and exact address
match. No writes, events or external calls.

**Block-by-Block:**

```solidity
// L90-L91
return configured && (candidate == address(hookAB) || ...);
```
- **What:** Performs the membership test.
- **Why here:** Entire function is one predicate.
- **Assumes:** one-time configuration preserved valid hooks.
- **Establishes:** a true result identifies one configured hook address.
- **Depended on by:** `fold` caller authorization and router hook validation.

**Cross-Function Dependencies:** Written state comes only from `configureHooks`.
Callers include `fold` and `ArbFoldRouter.swapExactInput`.

**Open Questions:** None within the fixed-address membership semantics.

