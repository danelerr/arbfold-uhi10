## `unlockCallback` in contracts/src/ArbFoldRouter.sol (L93-L110)

**Purpose:** During the manager unlock, executes the exact-input origin swap
with fold hook data and settles both resulting router currency deltas to payer.

**Inputs & Assumptions:**
- `rawData`: trusted only because caller must equal immutable manager (L94); it
  decodes to router-created `Request`.
- Assumes configured hook's `poolKey` still matches its coordinator-validated key.
- Assumes extreme sqrt price limits are acceptable because custom curve consumes
  the specified amount through return delta.

**Outputs & Effects:** Calls hook getter, PoolManager `swap`, then settles/takes
both currencies. Returns encoded `BalanceDelta` to `PoolManager.unlock`.

**Block-by-Block:**

```solidity
// L94-L96
if (msg.sender != address(manager)) revert NotPoolManager();
Request memory request = abi.decode(rawData, (Request));
PoolKey memory key = request.hook.poolKey();
```
- **What:** Gates callback, decodes and resolves fixed pool key.
- **Why here:** Only manager-provided callback context may trigger unlocked actions.
- **Assumes:** manager invoked with data encoded by `swapExactInput`.
- **Establishes:** callback has a concrete key/request.
- **Depended on by:** manager swap and settlement.

```solidity
// L97-L105
BalanceDelta delta = manager.swap(key, SwapParams({...}), abi.encode(FOLD_MODE, request.solver));
```
- **What:** Performs exact-input swap and supplies mode/solver to hook.
- **Why here:** Origin swap must precede settlement and fold occurs inside its
  beforeSwap callback.
- **Assumes:** hook enforces exact-input/domain and validates hookData.
- **Establishes:** user swap plus any fold has executed, with router deltas booked.
- **Depended on by:** `_settle` and returned delta.

```solidity
// L107-L109
_settle(key.currency0, request.payer);
_settle(key.currency1, request.payer);
return abi.encode(delta);
```
- **What:** Pays negative router deltas from payer and sends positive deltas to
  payer for both currencies.
- **Why here:** PoolManager refuses to relock while deltas remain.
- **Assumes:** payer approved required ERC-20 input to this router.
- **Establishes:** router's two pool-currency deltas are zero on success.
- **Depended on by:** PoolManager unlock completion and router output check.

**Cross-Function Dependencies:** Inherited hook `poolKey`; `PoolManager.swap`;
hook `_beforeSwap`; `_settle`; `CurrencySettler`. `manager.swap` books returned
hook/caller deltas before control returns (`PoolManager.sol:L187-L227`).

**Open Questions:** None on callback origin; settlement behavior for unusual
ERC-20 semantics remains delegated to SafeERC20/pinned dependencies.

