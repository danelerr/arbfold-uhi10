## `verify` in contracts/script/VerifyArbFoldDeployment.s.sol (L56-L118)

**Purpose:** Read-only structural/ledger verifier for a supplied deployment tuple.

---

**Inputs & Assumptions:** Ten addresses are operator/environment supplied. Trust: semi-trusted evidence targets. `solver` may be zero or one designated reward holder. Assumes that modeling backing with at most that one external token-A claim holder is valid at the verification point.

---

**Outputs & Effects:** Performs external view calls only; reverts on failed checks, returns nothing on success. Checks code, bindings, hooks, positive reserves, exact six hook claim balances, backing sums, quote and selected runtime sizes (L57-L117).

---

**Block-by-Block:**

```solidity
// L57-L86
_hasCode(all nine contracts); check manager/router/coordinator/token/hook bindings; _verifyHook three times;
```
- **What:** Establishes surface identity and configuration relationships.
- **Why here:** Ledger reads below rely on correct currencies/hooks.
- **Assumes:** Behavioral interfaces describe intended code; no runtime codehash comparison occurs.
- **Establishes:** Strong binding state at the read block.
- **Depended on by:** reserve/claim/backing checks.

```solidity
// L88-L112
read network; require positives; compare six hook claims; compare manager ERC20 backing to modeled sums;
```
- **What:** Reconciles virtual reserves, claims and underlying for deployment topology.
- **Why here:** After identities/currencies are established.
- **Assumes:** Only zero/one supplied solver holds token-A claims and no other claim holders matter to backing sum.
- **Establishes:** Exact modeled ledger equalities at the read block, or revert.
- **Depended on by:** deployment shell PASS.

```solidity
// L114-L117
coordinator.quote(); _runtimeSize(coordinator,hookAB,router);
```
- **What:** Exercises in-domain quote and EIP-170 limits.
- **Why here:** Final operability/size gate.
- **Assumes:** One hook size represents all three same-runtime hooks.
- **Establishes:** Quote callable and selected code sizes ≤24,576.
- **Depended on by:** verifier result.

---

**Cross-Function Dependencies:** `_verifyHook`, `_hasCode`, `_runtimeSize`; all production getters; external PoolManager/ERC20 state. `run` supplies env tuple at L39-L54.

---

**Open Questions:** After arbitrary solvers or ERC-6909 transfers, the single-solver backing equation need not model global claims even when underlying remains globally backed.

