# Change log: SDD Cycle UX and Evidence Improvements

## Implemented — Sprints 1–3

- Add status projection, deterministic pre-approval quality reporting, bounded repair-aware execution, research input provenance/explicit refresh, and aggregate evidence budgeting.

## Implemented — Sprint 1

- `/sdd-status` now summarizes task progress, evidence freshness, blockers, and a next command; `sdd_status` remains JSON.
- Added a deterministic requirement/task/acceptance/check report and CLI `validate`. Structural errors block approval; warning codes require `approve --accept-warnings` and are stored with the bundle digest.
- Focused adapter and CLI tests pass; integrated `npm run check` passed all 45 tests after allowing temporary Git/symlink fixtures.
- `Engine` now records safe, bounded failure summaries, retries review alone only for unchanged-tree protocol/transport failures, and enforces state-v3 migration without presenting old verification as current.
- Research runs in waves before builders, records stable input fingerprints, and cannot unlock dependents after mutation or a later input-tree edit. Explicit `/sdd-refresh-research` and `sdd_run` `refresh-research` re-run only stale/legacy research.
- Worker and reviewer prompts use a deterministic aggregate 20,000-character prior-session evidence packet, with the approved contract outside the cap and no raw check stdout/stderr.
- Final `npm run check` passed typecheck/build and all 56 tests; `npm run smoke:pack` passed for the 37-file package. Debian/WSL and supported v2 real-host smoke were unavailable in this Windows environment; details are in the release record.
