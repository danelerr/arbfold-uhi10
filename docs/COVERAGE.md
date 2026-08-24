# Release coverage

Command:

```bash
make coverage
```

Toolchain: Foundry `v1.5.1`, Solidity `0.8.26`, clean-core dependencies pinned under `contracts/lib/openzeppelin-uniswap-hooks`.

| Scope | Hit / found | Coverage |
|---|---:|---:|
| Lines | 262 / 266 | **98.50%** |
| Statements | 396 / 408 | **97.06%** |
| Branches | 47 / 52 | **90.38%** |
| Functions | 35 / 35 | **100.00%** |

The report includes every project-owned file under `contracts/src` and filters dependency, test and script code from the denominator. `ArbFoldDeploymentTest` is excluded only from the coverage execution because coverage disables the optimizer, causing its deliberate EIP-170 deployed-bytecode assertion to reject the unoptimized hook. The same deployment suite runs under the release compiler settings in `make test-deployment` and the ordinary test suite.

The five uncovered branches are defensive conditions that supported execution cannot synthesize without replacing trusted components:

- `NoInvariantIncrease` after one or more mathematically accepted rounds;
- invalid hook key/currency after one-time deployment validation;
- exact-output fee reporting after the earlier exact-output rejection;
- negative removal deltas after OpenZeppelin callback validation;
- non-positive router output after a successful positive exact-input custom-curve swap.

Invariant decrease and all three token-conservation failure branches are exercised through the dedicated coordinator safety harness. The CI artifact `contracts/lcov.info` contains the machine-readable report, and `scripts/check-lcov.py` fails below 90% line or 85% branch coverage.
