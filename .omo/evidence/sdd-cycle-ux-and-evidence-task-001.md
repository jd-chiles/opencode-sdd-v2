# TASK-001 status projection evidence

Scenario: invoke the fake OpenCode host's `/sdd-status` command for current,
stale, and blocked durable workflow states, and render an in-progress state.
Observable: output contains progress, evidence freshness, blockers when present,
and a suggested next command; `sdd_status` content remains JSON with task state.

Commands and observed results:

- `npm run typecheck` — passed.
- `npm run build` — passed.
- `node --test dist/tests/native.test.js` — passed: 12 tests, 0 failures.

The test runner needed the approved sandbox escape only to create its isolated
temporary Git worktrees; the source and test changes remain inside the repository.
