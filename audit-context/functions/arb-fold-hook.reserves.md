## `reserves` in contracts/src/ArbFoldHook.sol (L48-L50)

**Purpose:** Exposes the two virtual CPMM reserve fields consumed by local swap/removal math and by the coordinator's network snapshot.

---

**Inputs & Assumptions:**
- No explicit inputs.
- Implicit: reads `_reserve0` and `_reserve1` declared at L35-L36.
- Precondition for merely returning the values: none.
- Any caller interpreting the values as exact ERC-6909 claim balances assumes an equality checked by **nothing found** in this getter or in `setReservesFromCoordinator` (L61-L69).

---

**Outputs & Effects:**
- Returns the current `_reserve0` and `_reserve1` values (L49).
- No storage writes, events, or external calls.
- Before any successful writer, both storage fields have Solidity's default value zero (L35-L36).

---

**Block-by-Block:**

```solidity
// L48-L50
function reserves() external view returns (uint256 reserve0, uint256 reserve1) {
    return (_reserve0, _reserve1);
}
```
- **What:** Copies both virtual reserve slots into return data.
- **Why here:** This is the read boundary used by the coordinator without exposing the private slots directly (`ArbFoldCoordinator.sol:L101-L106`).
- **Assumes:** no assumption is needed to report the stored values; economic meaning beyond those values is established elsewhere or by **nothing found**.
- **Establishes:** a snapshot only; it does not establish backing or freshness (L49).
- **Depended on by:** coordinator `network` (`ArbFoldCoordinator.sol:L101-L106`), local observers, and tests outside this record.

---

**Cross-Function Dependencies:**
- No callees beyond storage reads.
- Callers: unrestricted external callers (L48); checked-in coordinator `network` reads all three hooks (`ArbFoldCoordinator.sol:L101-L106`).
- Shared state writers: `_getAmountIn` (L122-L124), `_getUnspecifiedAmount` (L94-L101), `_burn` (L166-L167), and `setReservesFromCoordinator` (L67-L68).
- Invariant coupling: equal reserve and claim deltas preserve any pre-existing difference; this getter never compares reserves to `IPoolManager.balanceOf`.

---

**Open Questions:**
- unclear; need the protocol specification to determine whether consumers require exact claim equality, sufficient backing, or only the virtual ledger values.

