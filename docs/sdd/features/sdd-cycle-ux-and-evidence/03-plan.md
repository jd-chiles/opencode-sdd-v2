# Plan: SDD Cycle UX and Evidence Improvements

Status: Implemented

Use ordered tasks linked to requirements and retain the requested three-sprint sequencing:

### Sprint 1 — Planning and status UX

- [x] `TASK-001`: Add the human-readable status projection and tests for current, stale, blocked, and in-progress states; preserve machine-readable `sdd_status` [`REQ-001`].
- [x] `TASK-002`: Add deterministic pre-approval validation report, CLI `validate`, `approve --accept-warnings`, digest-bound acknowledgments, and tests for structural blockers, warnings, acknowledgment, and clean approval [`REQ-002`].

These tasks have disjoint ownership and may be implemented in parallel.

### Sprint 2 — Efficient, repairable execution

- [x] `TASK-003`: Build the aggregate prior-session evidence packet with the 20,000-character cap, deterministic priority, truncation marker, and tests [`REQ-003`].
- [x] `TASK-004`: Add safe failure classification, actionable repair metadata, unchanged-tree review-only retry, existing retry/model ceilings, state v3 migration, and related tests [`REQ-004`] [`REQ-007`].

Keep these changes sequential because they share runner and retry-state boundaries.

### Sprint 3 — Research provenance and integration

- [x] `TASK-005`: Add research input fingerprints, research-before-builder scheduling, mutation detection, stale-result/dependency blocking (including edits after a completed research task), and tests [`REQ-005`].
- [x] `TASK-006`: Add explicit `/sdd-refresh-research` and `sdd_run` refresh action for legacy or stale research provenance; prove normal execute/verify add no research calls and refresh does not replay builders [`REQ-006`] [`REQ-007`].
- [x] `TASK-007`: Run available cross-platform/package verification, update workflow docs, record evidence and limitations, and pass repository SDD completion gates [`REQ-008`].
