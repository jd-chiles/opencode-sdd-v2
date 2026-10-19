# Plan
Status: In progress

- [x] TASK-001: Implement canonical worktree fingerprint and stable-tree regression suite [REQ-001] [REQ-004]
- [x] TASK-002: Bind check/review results and final workflow status to fingerprint [REQ-001] [REQ-003]
- [x] TASK-003: Migrate v1 durable state and gate stale evidence [REQ-002]
- [x] TASK-004: Add migration, mutation, deletion, rename, symlink, and commit-stability tests [REQ-002] [REQ-004]
- [x] TASK-005: Add Debian-first Linux, Ubuntu/WSL where practical, and Windows CI with provider-denied host-smoke matrix [REQ-005]
- [x] TASK-006: Prepare MIT/public npm metadata, changelog, onboarding and roadmap [REQ-006]
- [x] TASK-007: Add least-privilege validation/release workflow and trusted-publishing instructions [REQ-007]
- [x] TASK-008: Write evidence-based production readiness report and exercise local release gates [REQ-008]
- [x] TASK-009: Align validation and tagged-release host smoke with the installed OpenCode executable path and direct Node invocation; add workflow regression coverage and record Debian 12 evidence [REQ-005] [REQ-007] [REQ-008]
- [x] TASK-010: Add platform-aware regression coverage for executable-mode fingerprint changes [REQ-004]
- [x] TASK-011: Run the SDD verifying gate in cross-platform CI and the complete gate before tagged publication [REQ-007] [REQ-008]
- [x] TASK-012: Add recurring dependency update proposals, CI audit, and production dependency audit before publishing [REQ-007] [REQ-008]
- [x] TASK-013: Add a signed, evidence-linked release checklist and distinguish documented controls from unconfigured account settings [REQ-007] [REQ-008]
- [x] TASK-014: Remove personal machine paths and VPS identifiers from public source evidence before the initial push [REQ-006] [REQ-008]

Release gates outside this implementation: verify candidate name ownership and availability; provision the separate public GitHub repository and npm trusted publisher; recheck the exact latest v2 host at release freeze; obtain model and spend cap approval and run bounded disposable-project canary; then publish 1.0.0 and verify provenance/install. No gate may be marked complete without observed evidence.
