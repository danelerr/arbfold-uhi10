## `setReservesFromCoordinator` in contracts/src/ArbFoldHook.sol (L61-L70)

**Purpose:** Replaces both virtual reserves with a bounded pair proposed by the immutable coordinator after a direct network transition.

---

**Inputs & Assumptions:**
- `reserve0` (`uint256`): proposed currency0 virtual reserve. Trust: **semi-trusted**; caller address is restricted at L62 and numeric bounds are checked at L63-L66.
- `reserve1` (`uint256`): proposed currency1 virtual reserve. Trust: **semi-trusted** under the same checks.
- Implicit: `msg.sender`, immutable `coordinator`, current claim balances, `_everFunded`, and LP supply.
- Precondition: matching ERC-6909 claim movements already occurred. Establishment in this function: **nothing found**; no manager balance is read at L61-L70.
- Precondition: the immutable coordinator contains the checked-in coordinator code. Establishment in the hook: **nothing found**; constructor checks nonzero only (L43-L45).

---

**Outputs & Effects:**
- Reverts unless `msg.sender == coordinator` (L62).
- Reverts unless both values lie in `[MIN_NETWORK_RESERVE, MAX_NETWORK_RESERVE]` (L63-L66; constants `CycleMath.sol:L11-L14`).
- Writes `_reserve0` and `_reserve1` (L67-L68).
- Emits `ReservesUpdated(reserve0, reserve1)` (L69).
- No external calls.

---

**Block-by-Block:**

```solidity
// L62-L66
if (msg.sender != coordinator) revert NotCoordinator();
if (
    reserve0 < CycleMath.MIN_NETWORK_RESERVE || reserve1 < CycleMath.MIN_NETWORK_RESERVE
        || reserve0 > CycleMath.MAX_NETWORK_RESERVE || reserve1 > CycleMath.MAX_NETWORK_RESERVE
) revert InvalidReserves();
```
- **What:** Restricts the writer by exact address and validates the arithmetic domain of both proposed values.
- **Why here:** No reserve storage changes occur before authorization and bounds succeed.
- **Assumes:** address equality identifies the intended coordinator behavior; code identity is established by **nothing found** in this contract.
- **Establishes:** any successfully written value is within the network reserve bounds (L63-L66).
- **Depended on by:** the storage assignment and all subsequent quote/removal calculations.

```solidity
// L67-L69
_reserve0 = reserve0;
_reserve1 = reserve1;
emit ReservesUpdated(reserve0, reserve1);
```
- **What:** Commits both virtual reserve values and announces them.
- **Why here:** The pair becomes visible only after both local checks pass.
- **Assumes:** the pair corresponds to claim balances and an intended network transition; local establishment: **nothing found**.
- **Establishes:** `reserves()` returns exactly this pair until another writer runs (L48-L50).
- **Depended on by:** `_getUnspecifiedAmount` (L86-L103), `_getAmountOut` (L129-L139), and coordinator `network` (`ArbFoldCoordinator.sol:L101-L106`).

---

**Cross-Function Dependencies:**
- No callees.
- Expected caller `_applyDirect` (external-source-available, `ArbFoldCoordinator.sol:L175-L213`): checked-in code transfers claims at L183-L198, computes reserve changes at L188-L205, checks products/conservation at L208-L209, then calls all three setters at L211-L213.
- The checked-in `fold` also excludes zero, coordinator, manager, and registered-hook solver addresses (`ArbFoldCoordinator.sol:L131-L135`) and later compares computed and reread network state (`ArbFoldCoordinator.sol:L153-L156`). These are coordinator properties, not local setter checks.
- Shared state: the same reserve slots are written by initial funding, swaps, and removals (L122-L124, L94-L101, L166-L167).
- Invariant coupling: reserve/claim equality is neither read nor asserted here; equal intended deltas can preserve equality, but this setter can only attest to bounds and caller address.

---

**Open Questions:**
- unclear; need deployment bytecode evidence to bind the immutable coordinator address to the source at `ArbFoldCoordinator.sol`.
- unclear; need the protocol specification to state whether this setter may run before initial funding or after LP supply reaches zero; neither condition is read at L61-L70.

