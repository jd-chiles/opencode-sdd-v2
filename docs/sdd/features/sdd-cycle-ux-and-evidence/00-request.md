# SDD Cycle UX and Evidence Improvements

Status: Implemented

## Authorized outcome

Implement the five reviewed SDD-cycle improvements in this repository: actionable human status, pre-approval quality reporting, repair-oriented bounded retries, stable research provenance, and bounded prior-session evidence. Keep the existing `production-readiness-public-release` feature at `verifying` and do not close its release gates.

## In scope

- A concise `/sdd-status` projection showing task progress, blockers, evidence freshness, and the next useful command while leaving the `sdd_status` tool response machine-readable JSON.
- A deterministic pre-approval validation report mapping requirements to tasks, acceptance criteria, and configured checks. Structural defects block approval; quality warnings require an explicit `opencode-sdd approve --accept-warnings` acknowledgment recorded with the artifact digest. No model is an approval authority.
- Safe, bounded attempt summaries and failure metadata supplied to the next eligible attempt. Retry review alone after review protocol/transport failure only when the worktree is unchanged. Preserve configured `maxAttempts` and model allowlists; do not include raw command output.
- Run ready read-only research before builders, fingerprint around research, and prevent research with changed inputs from unlocking dependents. Respect the existing attempt ceiling.
- Cap all prior-session text supplied to one agent at 20,000 characters, prioritized deterministically for the current task’s failure evidence and direct dependencies. Keep contract data separate, indicate truncation, and exclude raw stdout/stderr.
- Migrate workflow state to v3, preserving v2 sessions and evidence while safely initializing attempt history; retain old verification as historical and require explicit verification before it can be current.
- Add `/sdd-refresh-research` and `sdd_run` action `refresh-research`. Refresh is explicit, targets verified research with missing or stale input fingerprints, never occurs as a side effect of normal execute/verify, and does not replay builders.
- Complete the three-sprint package, regression tests, user-facing documentation, and recorded verification evidence.

## Out of scope

- Publishing the package, creating or changing external repositories/accounts, live-provider canaries, or changing provider/model configuration.
- Raising retry/model budgets, adding automatic attempts, parallel builder execution, adding an LLM approval gate, or capturing raw command output.
- Closing or advancing `production-readiness-public-release`.

## Constraints and existing evidence

- The repository-local Agentic SDD feature package is authoritative; requirements use `REQ-###`, tasks use `TASK-###`, and evidence is recorded through `.sdd/bin/agentic_sdd.py`.
- Existing boundaries: core is host-independent; OpenCode integration is in `packages/opencode-v2`; CLI/project validation is in `packages/cli`; builders are serialized, research may currently overlap builders, and durable state is v2 (`packages/core/src/engine.ts`).
- `Engine.status()` already exposes `currentVerification`; the slash command currently prints raw state, while `sdd_status` returns JSON.
- `NativeRunner.evidence()` truncates each session separately at 20,000 characters but does not enforce the requested aggregate per-agent cap. Check runner intentionally does not persist stdout/stderr.
- Current verification is local fake-host/unit-test evidence. The requested Debian 12 / Node 22.14 and Windows host-smoke matrix must be reported only if actually run; provider calls remain denied.
- Windows validation ran on Node 22.20.0. Debian 12 / Node 22.23.3 package validation ran on the user-selected VPS; local WSL returned `Wsl/E_ACCESSDENIED`. The VPS has no OpenCode executable and the local CLI is v2.0.30, below this plugin's supported v2 minimum of 2.0.32.
- Preserve existing `maxAttempts`, model allowlists, permissions, and plugin APIs except for the explicitly requested new CLI/command/tool action.
