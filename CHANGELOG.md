# Changelog

## Unreleased

### Added

- Actionable `/sdd-status`, deterministic pre-approval quality reports, bounded repair evidence, research input provenance/refresh, and a 20,000-character aggregate agent evidence budget.
- State-v3 migration that retains old verification as historical and requires re-verification; external tree changes stop dependent scheduling until evidence is refreshed.

## 0.2.0 - 2026-10-19

### Fixed

- Verification evidence is now bound to a deterministic Git worktree-content fingerprint. Changes made during checks/review fail verification, and a later edit makes the final verification stale.
- Migrated schema-v1 workflows retain session and task history while requiring an explicit check/review pass before old verified results can be current again.

### Added

- Regression coverage for same-length dirty edits, staged edits, nested untracked content, deletion/rename, symlink targets where supported, commit-only changes, state migration, and mutations around verification.
- Debian-first Linux and Windows CI, release packaging metadata, MIT licensing, and guarded trusted-publishing automation.
- CI installs the generated tarball in a clean consumer fixture and performs native host registration from the installed package directory.

This is a production-readiness development release. It is not the planned stable 1.0.0 release; public account ownership, provider canary approval, latest-host validation, and publication gates remain open.
