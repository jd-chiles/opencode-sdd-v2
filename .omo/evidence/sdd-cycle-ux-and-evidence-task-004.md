# TASK-004 evidence: repair-aware retries and v3 migration

- Command: `npm run check`
- Outcome: passed; full suite reports 56 tests, 0 failures.
- Engine tests confirm safe failed-check metadata reaches the next builder, history stays within the existing retry ceiling, unchanged-tree review protocol failure retries review without rerunning the builder, changed-tree review retry is refused, and old v2 verification is preserved as historical until explicit verification.
- A corrupt attempt-summary fixture containing an extra `stdout` field is rejected as corrupt durable state.
