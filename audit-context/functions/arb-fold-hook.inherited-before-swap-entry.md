## `beforeSwap` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol (L225-L231)

**Purpose:** Exposes the manager-facing swap callback, authenticates the caller by the immutable manager address, and dispatches all swap data into `ArbFoldHook`'s active custom-curve path.

---

**Inputs & Assumptions:**
- `sender` (`address`): original swap caller forwarded by the manager. Trust: **untrusted**; used as event data downstream (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol:L126-L146`).
- `key` (`PoolKey calldata`): manager-forwarded pool configuration. Trust: **semi-trusted**; this wrapper authenticates the caller address but does not compare `key` with the hook's stored pool key (L225-L231).
- `params` (`SwapParams calldata`): signed amount, direction, and price limit forwarded from the swap request. Trust: **untrusted** (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/types/PoolOperation.sol:L18-L25`).
- `hookData` (`bytes calldata`): arbitrary metadata forwarded without local validation; the active override interprets it at `contracts/src/ArbFoldHook.sol:L79-L83`.
- Implicit: `msg.sender` and immutable `poolManager` (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L34`, L57-L60).
- Precondition: caller address equals `poolManager`; enforced by `onlyPoolManager` at L227 and `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`. Runtime manager code identity is **nothing found**.

---

**Outputs & Effects:**
- Different caller address reverts with `NotPoolManager` before dispatch (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`, L227).
- Otherwise returns the selector, `BeforeSwapDelta`, and fee override returned by the active `_beforeSwap` implementation (L230).
- Through downstream calls, may update virtual reserves, mint/burn manager claims, emit `HookSwap`, and optionally call the coordinator (`contracts/src/ArbFoldHook.sol:L72-L103`; `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol:L86-L149`).
- No storage write, event, or direct external call occurs in this wrapper itself.

---

**Block-by-Block:**

```solidity
// L225-L231
function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
    external
    onlyPoolManager
    returns (bytes4, BeforeSwapDelta, uint24)
{
    return _beforeSwap(sender, key, params, hookData);
}
```
- **What:** Applies the manager-address gate, then forwards all inputs and return values through internal virtual dispatch.
- **Why here:** It prevents direct external callers from reaching reserve and claim mutation before the intended manager entry.
- **Assumes:** address equality identifies the checked-in manager's swap/unlock context and field provenance; runtime bytecode identity is established by **nothing found**.
- **Establishes:** a successful internal dispatch originated from the immutable manager address, but not that `key`, `params`, or `hookData` match locally stored state (L225-L231).
- **Depended on by:** `ArbFoldHook._beforeSwap` and its inherited `BaseCustomCurve._beforeSwap` implementation (`contracts/src/ArbFoldHook.sol:L72-L84`; `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol:L86-L149`).

---

**Cross-Function Dependencies:**
- Upstream checked-in `Hooks.beforeSwap` (external-source-available, `contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/libraries/Hooks.sol:L247-L282`): invokes this entry, checks its returned selector, and processes the returned delta only when the encoded permission bits allow it.
- Callee modifier `onlyPoolManager` (internal/base-source-available, `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`).
- Callee `ArbFoldHook._beforeSwap` (internal/derived-source-available, `contracts/src/ArbFoldHook.sol:L72-L84`), which calls `BaseCustomCurve._beforeSwap` before optional fold execution.
- Shared state is unchanged by the wrapper itself; downstream reserve, claim, and coordinator state interactions are described in the two `_beforeSwap` records.
- Invariant coupling: downstream checked-in delta accounting depends on entry during an unlocked manager swap (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/PoolManager.sol:L187-L226`); that execution context is established from address equality alone by **nothing found** in this wrapper.

---

**Open Questions:**
- unclear; need deployment bytecode evidence to bind `poolManager` to the checked-in v4 implementation and its unlock/delta semantics.
