## `setReservesFromCoordinator` in contracts/src/ArbFoldHook.sol (L61-L70)

**Purpose:** Commits this pool's two virtual reserves after the coordinator has
moved the corresponding ERC-6909 claims.

**Inputs & Assumptions:**
- `reserve0`, `reserve1`: trusted only from immutable coordinator; bounded by
  constants.
- `msg.sender` must be coordinator (L62).
- Assumes claim transfers matching these values have already succeeded;
  direct check: **nothing found**.

**Outputs & Effects:** Writes both reserve fields and emits `ReservesUpdated`.
No external calls.

**Block-by-Block:**

```solidity
// L62-L66
if (msg.sender != coordinator) revert ...;
if (reserve0 < MIN || reserve1 < MIN || reserve0 > MAX || reserve1 > MAX) revert ...;
```
- **What:** Authorizes caller and bounds live reserves.
- **Why here:** Prevents untrusted or out-of-domain storage writes.
- **Assumes:** fixed constants cover every intended post-fold state.
- **Establishes:** accepted fields are within arithmetic domain.
- **Depended on by:** storage assignment and future quotes.

```solidity
// L67-L69
_reserve0 = reserve0; _reserve1 = reserve1; emit ReservesUpdated(...);
```
- **What:** Commits and announces the virtual state.
- **Why here:** Only after all local validation.
- **Assumes:** coordinator's network-level checks and claim movements were correct.
- **Establishes:** hook virtual state equals coordinator-proposed fields.
- **Depended on by:** swaps, removal and coordinator snapshots.

**Cross-Function Dependencies:** Called only by coordinator `_applyDirect` on
intended paths. Shares reserve storage with three other hook functions.

**Open Questions:** No local balance-of-claims assertion accompanies the write.

