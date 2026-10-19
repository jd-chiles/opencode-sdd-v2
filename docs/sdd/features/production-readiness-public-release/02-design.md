# Design

## Evidence model

Add a Node-side worktree fingerprint primitive to the portable core. Git enumerates tracked paths (including deleted entries) and non-ignored untracked paths using NUL-delimited output. Hash a canonical sequence of normalized relative paths, entry kind/mode, and file bytes or symlink target bytes. A missing tracked path has an explicit absence marker. `.git`, commit identity, index metadata, and ignored files are excluded. The algorithm must be deterministic across supported operating systems and must fail closed on enumeration/read errors. The current MVP has no fingerprint cache; do not introduce one without measured need and a proof-safe key.

The native runner fingerprints before and after each executable check and around independent review; the engine additionally brackets the verification operation. It stores the digest with task evidence. The engine records a final verification only when every task has passed against one identical final digest. Status recomputes the current digest and derives current/stale state. Starting or resuming builder work clears the final record. Historical task phase and current-tree currency remain separate concepts.

## Migration and recovery

The initial release-readiness implementation migrated schema v1 to v2; the follow-on cycle-UX feature advanced the current schema to v3. Preserve v1 sessions/history and v2 task evidence, attempt counts, native session IDs, checks and review records. Verification records without a content fingerprint remain historical and require explicit `/sdd-verify`, which never dispatches builders. Research records without an input fingerprint remain historical until explicit `/sdd-refresh-research`; normal execution and verification must not add surprise research calls. Convert interrupted running/review states to blocked so no session is replayed.

The fingerprint includes whether regular files have any executable permission bits. Regression coverage must demonstrate that toggling this bit changes the digest on platforms that preserve executable bits, while reporting a capability-based skip on platforms that do not.

## Distribution

Prepare package metadata and documentation for MIT/npm/OpenCode package installation and the independent `opencode-sdd` bootstrap CLI. Add Debian-first Linux and Windows CI (plus Ubuntu/WSL coverage where practical), provider-denied native registration smoke, and least-privilege GitHub release automation with npm trusted publishing. Keep registry/repository availability, latest supported host version, and publishing-account ownership as explicit release gates. Never perform provider canary or external publication from this change without the specified approval and passed gates.

Resolve the OpenCode executable from the installed `@opencode/cli` package layout. In the observed v2.0.32 package, both Windows and Linux use `bin/opencode.exe`; the Linux file is an ELF binary. Invoke the host-smoke script directly with Node in validation and tagged-release workflows so npm script wrappers do not rewrite paths containing spaces. Do not infer the executable filename from its suffix or operating system, and revalidate the package layout at release freeze.

Run the repository's SDD `doctor` and `check --target verifying` commands in Linux and Windows CI. Before tagged publication, run `check --target complete` so unresolved requirements, failed evidence, or a non-ready release record stop publication. The release check is an additional guard and does not replace the repository environment's protected approval or account checks.

Run a weekly full dependency audit in CI and configure Dependabot for npm and GitHub Actions. Tagged releases also run `npm audit --omit=dev --audit-level=moderate` so production dependency advisories block publication.

Keep a version-controlled release checklist that requires direct evidence links for each release gate, an accountable maintainer sign-off, and an audit-logged approval through the protected `npm-production` environment. Setting `RELEASE_GATES_PASSED=true` is permitted only after the checklist is complete; documentation of a control is not evidence that the external account setting has been configured.

Before any public source push, redact private usernames, local absolute paths, VPS hostnames/IPs, and temporary workspace identifiers from docs and durable evidence while retaining reproducible test outcomes and runtime versions.

## Risks

Concurrent writes can race hashing; before/after verification catches persistent changes and per-entry stat checks should fail on observed mid-read changes. Git submodules and unusual filesystem entries require an explicit deterministic policy. Cross-platform symlink creation may be unavailable in constrained Windows CI, so tests must report skips only for the platform capability and CI still covers regular-file behavior. No current environment can prove public account ownership or npm trusted-publisher setup without access to those accounts.
