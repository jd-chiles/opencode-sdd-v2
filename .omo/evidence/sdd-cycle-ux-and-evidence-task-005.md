# TASK-005 evidence: stable research provenance and scheduling

- Command: `npm run check`
- Outcome: passed; full suite reports 56 tests, 0 failures.
- Engine tests confirm all ready research verification finishes before builders, mutation during research exhausts only the configured attempts and blocks dependents, stable input fingerprints survive review-only retries, and a later input-tree edit blocks dependent work until research is explicitly refreshed.
- The stale-input test confirms refresh updates only research provenance and then allows the pending dependent to proceed; the builder is not replayed by refresh itself.
