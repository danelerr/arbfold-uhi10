## `_beforeSwap` in contracts/src/ArbFoldHook.sol (L72-L84)

**Purpose:** Executes the custom-curve user quote/accounting first, then
optionally triggers the fixed fold inside the same PoolManager swap callback.

**Inputs & Assumptions:**
- `sender`, `key`, `params`: supplied by pinned PoolManager through inherited
  external `beforeSwap`; semi-trusted protocol inputs.
- `hookData`: arbitrary bytes from swap caller. Empty means no fold; nonempty
  must ABI-decode as `(bytes4,address)` and match fixed mode/nonzero solver.
- Assumes superclass return-delta semantics and this hook's fee/output math are
  aligned.

**Outputs & Effects:** Returns selector, return delta and fee override from
superclass. Superclass mutates virtual reserves through `_getUnspecifiedAmount`
and mints/burns claims. Nonempty valid data calls coordinator `fold`, which may
change all three pools and pay solver.

**Block-by-Block:**

```solidity
// L77-L78
(selector, returnDelta, feeOverride) = super._beforeSwap(...);
```
- **What:** Computes output, updates origin reserves, books hook claims and
  constructs user return delta.
- **Why here:** The user output is fixed before any network fold.
- **Assumes:** inherited `BaseCustomCurve` correctly consumes the specified
  amount through return delta.
- **Establishes:** origin swap state and output are known for this transaction.
- **Depended on by:** fold's post-user network snapshot and eventual router output.

```solidity
// L79-L83
if (hookData.length != 0) { decode; validate; coordinator.fold(solver); }
```
- **What:** Selects optional fold path and validates its two fields.
- **Why here:** Fold sees the post-user-swap reserves and cannot alter the
  already computed return delta.
- **Assumes:** immutable coordinator implements `IArbFoldCoordinator`.
- **Establishes:** valid nonempty fold data causes a coordinator attempt before
  callback return.
- **Depended on by:** ARBFOLD router's atomic swap+fold semantics.

**Cross-Function Dependencies:** Superclass calls `_getUnspecifiedAmount`,
`_getSwapFeeAmount`, `CurrencySettler.take/settle`, then returns delta
(`BaseCustomCurve.sol:L86-L149`). External coordinator `fold` follows. Inherited
`BaseHook.beforeSwap` restricts entry to PoolManager (`BaseHook.sol:L225-L231`).

**Open Questions:** Is the reachable empty-hookData swap path an intended public
protocol mode or research affordance?

