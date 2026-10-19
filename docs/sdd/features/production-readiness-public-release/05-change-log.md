# Change log: Production readiness and public release

2026-10-19: Added content-derived Git worktree fingerprints, task and final verification currency, v1-to-v2 history-preserving migration, deterministic regression tests, MIT/npm release metadata, Debian/Windows CI and guarded OIDC publication workflow. User clarified Debian Linux is the primary workspace target; requirements, CI, and readiness report updated accordingly. Public names and provider canary remain gated.
2026-10-19: Tightened native host CI to install and load the generated tarball from a clean consumer fixture instead of loading only the source checkout; validated the packed package locally on OpenCode 2.0.32 with provider use denied.
2026-10-19: Debian 12 Node 22.23.3 passed the 56-test suite, package smoke, and provider-denied host smoke on pinned/latest OpenCode 2.0.32. Fixed CI's Linux executable path and bypassed npm's argument re-escaping for host-smoke paths by invoking the harness directly with Node.
2026-10-19: Added capability-aware regression coverage proving executable-mode changes alter worktree fingerprints on platforms that preserve permission bits.
2026-10-19: Recorded the authorized same-model provider retry as indeterminate because the isolated invocation returned no observable result; the canary gate remains open.
2026-10-19: Corrected tagged-release host smoke to use OpenCode's installed executable path and direct Node invocation, matching the Debian-validated CI harness.
2026-10-19: Added SDD verification gates to cross-platform CI and a complete-readiness gate before tagged publication.
2026-10-19: Added scheduled dependency audits, a production-only release audit, and weekly Dependabot updates.
2026-10-19: Added a signed release-checklist template and clarified the difference between documented release controls and externally configured account protections.
2026-10-19: Removed local usernames, executable-cache paths, VPS identifiers, and temporary directory names from public docs and durable evidence while retaining validation results.

## 2026-10-19T17:38:39Z

Reopened from `verifying`: Debian 12 release validation uncovered a CI host-smoke path defect: @opencode/cli exposes bin/opencode.exe as an ELF executable on Linux, while CI invokes bin/opencode. Correct the path and record Debian 12 full-suite, package, and real-host evidence.

## 2026-10-19T18:00:21Z

Reopened from `verifying`: Add regression evidence for the executable-mode bit already included in the worktree fingerprint, as identified by the production-readiness report before launch.

## 2026-10-19T18:07:38Z

Reopened from `verifying`: Release workflow still invokes the obsolete Linux OpenCode path and npm wrapper; align the tagged-release host smoke with the validated Debian CI invocation.

## 2026-10-19T18:10:23Z

Reopened from `verifying`: Add automated Agentic SDD gates to CI and tagged release so requirements, tasks, verification evidence, and release status are checked before launch.

## 2026-10-19T18:13:59Z

Reopened from `verifying`: Add recurring dependency vulnerability checks and automated npm/GitHub Actions update proposals as the next low-effort launch-hardening improvement.

## 2026-10-19T18:17:02Z

Reopened from `verifying`: Make the public-release sign-off auditable and align readiness recommendations with support and migration boundaries already documented for users.

## 2026-10-19T18:20:15Z

Reopened from `verifying`: Sanitize local usernames, executable cache paths, VPS identity/IP, and temporary directory names from public docs and durable test evidence before the first source push.
