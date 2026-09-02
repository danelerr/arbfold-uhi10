## `beforeInitialize` in contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol (L81-L87)

**Purpose:** Exposes the manager-facing initialization callback, authenticates the caller by the immutable manager address, and dispatches the supplied pool key to the inherited single-pool initializer.

---

**Inputs & Assumptions:**
- `sender` (`address`): original initializer forwarded by the manager. Trust: **untrusted**; the downstream implementation ignores it (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L318-L325`).
- `key` (`PoolKey calldata`): pool configuration forwarded by the caller at the manager address. Trust: **semi-trusted**; this wrapper does not validate its fields (L81-L87).
- `sqrtPriceX96` (`uint160`): requested initial price. Trust: **untrusted**; the downstream implementation ignores it (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L318-L325`).
- Implicit: `msg.sender` and immutable `poolManager` (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L34`, L57-L60).
- Precondition: `msg.sender == address(poolManager)`; enforced by `onlyPoolManager` at L83 and `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`. Runtime manager code identity is **nothing found** in the hook.

---

**Outputs & Effects:**
- Reverts with `NotPoolManager` before internal dispatch when caller address differs from `poolManager` (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`, L83).
- Otherwise returns the selector produced by `_beforeInitialize` (L86).
- Through the current override, writes the first supplied `PoolKey` or reverts if the stored hook-address sentinel is nonzero (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L318-L325`).
- No event or direct external call occurs in this wrapper.

---

**Block-by-Block:**

```solidity
// L81-L87
function beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96)
    external
    onlyPoolManager
    returns (bytes4)
{
    return _beforeInitialize(sender, key, sqrtPriceX96);
}
```
- **What:** Applies the manager-address gate and internally dispatches all callback arguments.
- **Why here:** Caller authentication precedes the only storage write in the downstream initializer.
- **Assumes:** address equality identifies the checked-in manager and its hook-dispatch semantics; runtime bytecode identity is established by **nothing found** in this wrapper.
- **Establishes:** every successful call originated from the immutable manager address, not that the forwarded fields were produced by the checked-in manager (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`, L81-L87).
- **Depended on by:** `_beforeInitialize`, which treats the first forwarded key as the hook's persistent single-pool key (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L318-L325`).

---

**Cross-Function Dependencies:**
- Upstream checked-in `PoolManager.initialize` and `Hooks.beforeInitialize` (external-source-available, `contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/PoolManager.sol:L117-L141`; `contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/libraries/Hooks.sol:L177-L181`): call `key.hooks.beforeInitialize` before pool initialization.
- Callee modifier `onlyPoolManager` (internal/base-source-available, `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseHook.sol:L57-L60`): enforces only caller-address equality.
- Callee `_beforeInitialize` (internal/base-source-available, `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L318-L325`): checks the sentinel, stores the key, and returns this entry point's selector.
- Shared state: reads immutable `poolManager`; downstream writes `_poolKey`.
- Invariant coupling: under checked-in dispatch, `key.hooks` equals this called contract because the manager calls through that field (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/libraries/Hooks.sol:L177-L181`); under other code at the manager address, field provenance is **nothing found**.

---

**Open Questions:**
- unclear; need deployment bytecode evidence to bind the immutable manager address to the checked-in dispatcher.

