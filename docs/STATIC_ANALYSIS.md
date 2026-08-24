# Slither review

ARBFOLD runs Slither `0.11.3` against project-owned `contracts/src` code with dependencies excluded from the result set.

```bash
make slither
```

Release-candidate result:

| Impact | Count | Unresolved high/medium |
|---|---:|---:|
| High | 0 | 0 |
| Medium | 10 | 0 |
| Low | 16 | n/a |
| Informational | 1 | n/a |

`scripts/check-slither.py` uses a narrow detector/file/operation allowlist. Any other high or medium finding fails CI.

## Reviewed medium findings

### `reentrancy-no-eth` in `ArbFoldCoordinator.fold` (1)

Slither sees calls before accounting counters are written. In the frozen architecture, every call target is fixed during one-time configuration:

- `manager` is immutable;
- `fold` accepts calls only from one of the three configured hooks;
- ERC-6909 `PoolManager.transferFrom` mutates claim balances and emits an event without invoking receiver callbacks;
- each configured hook's `setReservesFromCoordinator` accepts only the coordinator and performs bounded storage writes plus an event;
- none of the counters written after the calls controls authorization or transfer amounts within that round.

The deployment verifier checks the manager/coordinator/key bindings. This is accepted for the fixed research build, not generalized to arbitrary hook registration. A production design would additionally pin implementation code hashes or add a reentrancy guard after measuring its effect on the core claim.

### `unused-return` for ERC-6909 operations (9)

Eight results are `PoolManager.transferFrom`; one is `PoolManager.setOperator`. The pinned v4 interface specifies that these calls return `true` unless they revert, and the pinned `ERC6909` implementation unconditionally returns `true` after its checked state mutation. Ignoring that constant does not mask a soft failure. Reverts still unwind the complete unlock transaction.

## Low/informational results

- Eleven `calls-loop` findings describe the intended, bounded `MAX_ROUNDS = 8` fold loop. Gas and residual behavior are benchmarked.
- Reentrancy-event/benign reports have the same fixed-target basis described above.
- The timestamp comparison is the user's normal swap deadline.
- The costly-loop report describes the cumulative reward counter inside the same eight-round bound.

These acknowledgements are specific to the research deployment and do not constitute an audit or production authorization.
