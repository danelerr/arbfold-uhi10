## `_validateHook` in contracts/src/ArbFoldCoordinator.sol (L130-L142)

**Purpose:** Confirms a candidate hook belongs to this coordinator, uses the
same manager and owns the expected single pool key.

**Inputs & Assumptions:** Candidate hook and expected currencies come from
`configureHooks`. Candidate is semi-trusted until checks complete. External
getter calls may revert or return arbitrary data.

**Outputs & Effects:** Returns normally on a match; otherwise reverts. No writes
or events; four external view calls (`coordinator`, `poolManager`, `poolKey`, and
implicitly code length inspection).

**Block-by-Block:**

```solidity
// L131-L134
if (address(hook).code.length == 0) ...
if (hook.coordinator() != address(this) || address(hook.poolManager()) != address(manager)) ...
```
- **What:** Requires deployed code and matching immutable links.
- **Why here:** Rejects identity mismatch before pool-key use.
- **Assumes:** getter semantics truthfully represent operational dependencies.
- **Establishes:** current coordinator and manager match.
- **Depended on by:** pool-key topology check and all future calls.

```solidity
// L135-L141
PoolKey memory key = hook.poolKey();
if (address(key.hooks) != address(hook) || ... ) revert ...;
```
- **What:** Requires self-owned hook key and exact ordered expected currencies.
- **Why here:** Completes topology validation after identity checks.
- **Assumes:** inherited pool key is single-initialization durable.
- **Establishes:** hook currently represents exactly the assigned pair.
- **Depended on by:** `network` field interpretation and claim currency IDs.

**Cross-Function Dependencies:** Callees are hook getters; `poolKey` is inherited
from BaseCustomAccounting and set once in `_beforeInitialize`.

**Open Questions:** ERC-6909 operator status and reserve/claim equality are not
part of this validation.

