# Verification plan: SDD Cycle UX and Evidence Improvements

Status: Executed; SDD completion gate passed

Map every requirement to a behavioral check, including relevant boundary and failure
cases. State exact commands when they are known.

Observed locally on Windows / Node 22.20.0:

- `npm run check`: passed; typecheck, build, and all 56 tests passed (including local Git and symlink fixtures).
- `npm run smoke:pack`: passed; packed 37 files and the consumer CLI initializer/repeat-init checks passed.
- `npm ci`: passed earlier in this implementation; 273 packages installed, 0 vulnerabilities reported.
- `python .sdd/bin/agentic_sdd.py doctor .`: passed; scaffold and feature metadata validated.
- Debian 12 / Node `v22.23.3` on the user-selected VPS: `npm ci`, `npm run check` (56/56 tests), and `npm run smoke:pack` (37 files) passed. The package minimum is Node >=22.14.0; exactly v22.14 was not tested. npm reported 0 vulnerabilities but warned about transitive `node-domexception@1.0.0` and `glob@10.5.0` deprecations under `@opencode/plugin@2.0.32`.
- Local WSL was not available because `wsl.exe -l -q` returned `Wsl/E_ACCESSDENIED`; Debian testing ran over SSH instead.
- OpenCode host smoke: not run because the Debian VPS has no `opencode` executable and the local CLI reports `v2.0.30`, below the required `>=2.0.32 <3` range. No provider calls were made.
- Independent senior-engineer review found and drove a regression fix for research provenance on the review-only retry path; the new focused tests and full suite pass.

- `REQ-001`: Adapter/fake-host tests render current, stale, blocked, and in-progress status; assert blockers, freshness, and suggested next command. Assert `sdd_status` content still serializes JSON state.
- `REQ-002`: CLI/core tests validate deterministic requirement → task → acceptance → check mappings; malformed/incomplete structures fail closed; quality warning codes are stable; approval without acknowledgment fails; acknowledgment is stored with the same artifact digest; warning-free approval succeeds.
- `REQ-003`: Runner tests construct multiple prior sessions and assert aggregate evidence text is at most 20,000 characters, selection order is deterministic and favors current failure then direct dependencies, truncation is marked, contracts are separate, and stdout/stderr are absent.
- `REQ-004`: Engine/runner tests show check/review failure metadata reaches the next worker without raw exception/output text; review transport/protocol failure retries only review when fingerprints match; tree change forces worker repair/failure; valid rejection is not review-only retried; attempts and model indexes remain within existing configured limits.
- `REQ-005`: Engine tests show all ready research tasks finish before a builder starts; stable research input records the fingerprint; mutation during research or after a completed research result prevents dependent task admission; retry attempts never exceed `maxAttempts`.
- `REQ-006`: OpenCode command/tool tests assert explicit refresh interfaces; core tests assert ordinary execute/verify do not call `work` for historical research; refresh reruns only legacy or stale research records and does not replay builders.
- `REQ-007`: v2→v3 migration tests preserve task/session/check/review history and old verification under historical evidence, initialize attempt history safely, omit invented research fingerprints, and require verification before migrated results are current.
- `REQ-008`: Run `npm ci`, `npm run check`, and `npm run smoke:pack`; run provider-denied host smoke only in environments actually available. Windows / Node 22.20 and Debian 12 / Node 22.23.3 package checks passed. Exactly Node 22.14 and OpenCode >=2.0.32 / latest supported v2 host smoke remain unverified and are explicitly recorded as limitations. `python .sdd/bin/agentic_sdd.py doctor .`, requirement-linked evidence records, and `check --target complete` passed.

No network-dependent tests or provider calls are permitted for routine validation. The earlier release feature remains at `verifying`.
