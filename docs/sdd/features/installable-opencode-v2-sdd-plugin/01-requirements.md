# Requirements
Status: Baseline
- REQ-001: Installable TypeScript package exports native plugin, core, CLI and packs. Acceptance: SDK typecheck/build and packed fixture pass.
- REQ-002: Init/doctor safely provision artifacts. Acceptance: repeat init preserves files; conflicts and symlinks fail; doctor reports invalid config/models offline.
- REQ-003: Validate specs, contracts, DAGs/config. Acceptance: reject duplicate IDs, cycles, unknown dependencies, absent criteria/checks/models; approval digest detects any artifact drift.
- REQ-004: Deterministic durable scheduler. Acceptance: research bounded, builders serial, verified dependencies unlock, retries bounded, failed dependencies blocked, restart never auto-replays.
- REQ-005: Native session/worktree execution and explicit model preflight. Acceptance: unavailable models fail closed, only configured alternatives tried, IDs persisted before prompt, delegation denied and provider failures visible.
- REQ-006: Verification requires executable checks and separate reviewer. Acceptance: process/review failures block success, shell disabled, reviewer maps every acceptance criterion.
- REQ-007: Register specify/plan/execute/status/verify/resume/preflight and deterministic tools. Acceptance: fake-host integration exercises commands, reload and explicit recovery.
- REQ-008: Actionable docs, roadmap and evidence. Acceptance: local installation and exact limitations documented; no unsupported publication/live-host/model success claims.
