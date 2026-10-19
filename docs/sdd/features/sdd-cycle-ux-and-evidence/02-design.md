# Design: SDD Cycle UX and Evidence Improvements

Status: Implemented

## Current system

The original baseline parsed approved spec/plan/config contracts and ran durable state transitions. State was v2; status rendered JSON in the slash command; research could overlap a ready builder; prior-session summaries had per-session rather than aggregate truncation; and approval had no quality report. Verification already used a worktree digest for final currency, but an external edit between task execution checkpoints did not prevent a pending dependent from being admitted.

## Proposed change

1. Add a pure core quality-report function. First parse the bundle with existing structural validation; surface structural errors as blockers, then produce stable requirement/task/check mappings and deterministic warning codes. `validate` displays the report before approval. `approve` requires exact warning acknowledgments through `--accept-warnings`, stores the codes with the canonical bundle digest, and keeps current runtime approval digest behavior.
2. Add an adapter-only status renderer for human slash output. It consumes `Engine.status()` and derives progress/blocker/freshness/next-command text without changing JSON tool state.
3. Move all prior-session evidence assembly into one aggregate packet builder. Rank current task failure evidence first, then direct dependency session summaries, with deterministic tie-breaking. Bound selected text to 20,000 characters and mark truncation. Keep trusted contract fields in a separate prompt section; never include check stdout/stderr.
4. Extend durable state to v3 with safe attempt summaries, historical verification preservation, and research input fingerprints. Store the last stable execution fingerprint so an out-of-band edit before resume stops dependent admission. Track each research attempt’s before/after worktree fingerprints and require input provenance to still match before dependent work starts. Schedule ready research to completion before admitting a builder. Retry review alone only for classified protocol/transport errors, only if the worktree did not change, and only while consuming no more than the task’s existing attempt ceiling/model choices.
5. Add explicit research-refresh behavior for verified research whose input fingerprint is missing or stale. Refresh re-runs only those research tasks, records stable input provenance and review evidence, and does not execute implementations. Normal execute/verify leave stale research untouched and status identifies it as historical.
6. Add tests at core, CLI, and fake-host adapter boundaries, update onboarding/help/status docs, and record real checks. Keep provider use denied in host smoke.

## Interfaces, data, and trust boundaries

- CLI adds `opencode-sdd validate [project-directory]`; `approve` accepts optional `--accept-warnings` and only acknowledges the warning codes emitted for the exact current digest. A report is deterministic and includes blockers, warnings, and mapping rows.
- State version is 3. Task fields include bounded `attemptHistory`, preserved `historicalVerification`, and `researchInputFingerprint`; state records `executionFingerprint` as its last stable checkpoint. Existing v2 sessions/check/review history is retained, old verification moves to historical evidence, and absent fields initialize safely rather than fabricating provenance.
- OpenCode adds `/sdd-refresh-research` and extends `sdd_run`’s action enum with `refresh-research`. `sdd_status` remains a JSON projection with no schema removal.
- Prior session contents and model-authored text are untrusted. Evidence packet uses text only from native session records, prioritizes deterministic IDs, caps aggregate text at 20,000 chars per prompt, marks truncation, and never incorporates raw check output. Credentials/provider config remain outside contracts and packets.
- Failure classification persists sanitized category/check name/exit code/timeout/review session ID; raw exception text and stdout/stderr are excluded from durable state and retry prompts.

## Compatibility and migration

v1 and v2 workflow records remain loadable. v2 migrates to v3 without losing sessions, check/review history, task phases, or existing verification evidence; old verification is retained under `historicalVerification` and requires explicit `/sdd-verify`. New attempt arrays initialize empty. Research tasks with missing or changed input fingerprints are historical and cannot count as fresh provenance until explicit refresh. Existing config/model allowlists and `maxAttempts` semantics remain unchanged. The existing status tool keeps machine-readable data; only the human slash output becomes summarized. The package continues to require the same OpenCode v2 API baseline.

## Risks and decisions requiring approval

- Warning heuristics can flag vague requirement/acceptance text but cannot establish semantic correctness; warnings are advisory, stable-code findings and require a human to acknowledge. Structural completeness remains the deterministic blocker.
- Review-only retry must classify failures narrowly. A valid review rejection is a task failure requiring worker repair, not a transport retry. Any observed worktree mutation disables review-only retry.
- Research may read the shared worktree only while builders are paused. If a researcher mutates files, the result is failed/stale and dependents remain blocked.
- The specified 20,000-character budget applies to all prior-session text sent to each agent; trusted contract data is separate. The prompt assembly must not accidentally duplicate session text outside this budget.
- No additional user decision is required for this authorized local implementation. Live provider calls and publication remain out of scope.
