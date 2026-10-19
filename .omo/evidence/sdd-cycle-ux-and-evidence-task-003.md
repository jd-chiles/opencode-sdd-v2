# TASK-003 evidence: bounded aggregate prior-session packet

- Command: `npm run check`
- Outcome: passed; full suite reports 56 tests, 0 failures. Test `worker prompt keeps the contract separate and sends only the bounded evidence packet` passed.
- The runner test reads the prompt actually sent to the worker and confirms current-task evidence is prioritized, dependency text fills only the remaining budget, total prior-session text is exactly 20,000 characters, truncation is marked, the contract is separate, and stdout/stderr are absent.
- The pure packet test confirms deterministic ordering and cap behavior for reversed input order.
