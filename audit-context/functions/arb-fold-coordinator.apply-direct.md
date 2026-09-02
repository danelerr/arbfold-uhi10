## `_applyDirect` in contracts/src/ArbFoldCoordinator.sol (L175-L214)

**Purpose:** Executes one quoted three-leg transition in ERC-6909 claims and mirrors it into all six virtual reserves.

---

**Inputs & Assumptions:**
- `n`, `q`, `reward`: trusted internal values produced by `fold`/`CycleMath.best`.
- `solver`: already filtered by `fold`.
- Assumes hooks have sufficient claims and coordinator is their operator. The v4 callee enforces debit balance/authorization by checked subtraction/operator state (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/ERC6909.sol:L35-L47`).
- Assumes hook reserve setters implement exact persistent assignment. Intended code does at `contracts/src/ArbFoldHook.sol:L61-L69`; alternate configured code remains an external black box.

---

**Outputs & Effects:** Returns the derived network; makes four manager transfers and three hook setter calls; no own storage or event writes.

---

**Block-by-Block:**

```solidity
// L179-L181
afterState = CycleMath.Network({abA: n.abA, ... acC: n.acC});
```
- **What:** Copies all scalar fields into an independent struct.
- **Why here:** Avoids memory aliasing between before/after snapshots.
- **Assumes:** All relevant state is represented by these six fields.
- **Establishes:** Later mutations cannot alter `n` used by checks.
- **Depended on by:** L188-L209.

```solidity
// L182-L206
if (!q.reverse) { manager.transferFrom(...); ... update six fields; }
else { manager.transferFrom(...); ... update six fields; }
```
- **What:** Moves A/B/C claims along the quoted direction, pays A reward, and applies the same signed changes in memory.
- **Why here:** Claim debits occur before virtual reserve writes; any insufficient claim reverts before setters. Entire transaction is atomic.
- **Assumes:** Manager is the expected non-callback ERC-6909 implementation; receiver transfers do not notify solver/hooks (`ERC6909.sol:L35-L47`).
- **Establishes:** If all transfers return, manager claim ledger reflects the modeled transition for moved amounts.
- **Depended on by:** mathematical checks and reserve setters.

```solidity
// L208-L213
_assertNonDecreasing(n, afterState);
_assertConservation(n, afterState, reward);
hookAB.setReservesFromCoordinator(...); ...
```
- **What:** Validates model properties then persists each pair.
- **Why here:** No hook virtual reserve is written until both checks pass.
- **Assumes:** Sequential setters all succeed and report stored values later; final `fold` reconciliation checks the reports.
- **Establishes:** Intended hooks hold the derived virtual reserves; product/conservation passed for the round.
- **Depended on by:** next round and final state check.

---

**Cross-Function Dependencies:** Manager `transferFrom` is external-source-available through vendored v4 for intended deployment; three setter calls are external-source-available for exact public runtimes, otherwise black boxes. Internal `_assertNonDecreasing`, `_assertConservation`.

---

**Open Questions:** Nothing in this function distinguishes surplus inbound hook claims from the modeled reserve; only insufficient debits affect execution.

