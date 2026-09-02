## `run` in contracts/script/RunArbFoldDemo.s.sol (L42-L61)

**Purpose:** Loads one demo swap configuration and delegates its execution/evidence checks.

---

**Inputs & Assumptions:** Private key and all addresses/amounts/direction/solver from environment. Trust: operator-controlled. Assumes router manager also matches coordinator; only router coordinator is checked here (L54-L58).

---

**Outputs & Effects:** Reads config, rejects zero/out-of-int amount, zero solver, unregistered hook or wrong router coordinator; calls `_execute` which broadcasts.

---

**Block-by-Block:**

```solidity
// L43-L60
load env config; validate amount/solver/membership/router coordinator; amountOut = _execute(config);
```
- **What:** Establishes minimum demo configuration.
- **Why here:** Prevents broadcast under obvious mismatches.
- **Assumes:** Manager binding, token/runtime and system-address solver exclusions are established elsewhere; coordinator fold supplies final solver checks.
- **Establishes:** Inputs accepted for demo path.
- **Depended on by:** `_execute`.

---

**Cross-Function Dependencies:** Coordinator/router/hook getters and private `_execute`.

---

**Open Questions:** None if the separate deployment verifier is run immediately before, as public shell does at `scripts/deploy-unichain-sepolia.sh:L172-L210`.

