# TASK-006 evidence: explicit research refresh interface

- Command: `npm run check`
- Outcome: passed; the final full suite reports 56 tests, 0 failures.
- Core tests show ordinary execute and verify do not make surprise research calls for legacy records; explicit refresh updates missing provenance without replaying implementations.
- Native adapter tests confirm `/sdd-refresh-research` and the `sdd_run` `refresh-research` action register and return without launching research when no stale research exists.
