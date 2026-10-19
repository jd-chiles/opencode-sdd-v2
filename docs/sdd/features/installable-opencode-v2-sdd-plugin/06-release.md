# Release record: OpenCode SDD 0.1.0

Status: Historical MVP complete; superseded by the production-readiness release gate. This is not a production or public-release approval.

## Observable change
Locally installable OpenCode v2 plugin with a portable TypeScript engine, strict contracts/DAG validation, digest-bound approval, parallel read-only research, serial builders in one native workflow worktree, bounded retries, durable native session IDs/state, executable checks, independent acceptance review and explicit recovery. Seven commands, two tools, seven agents and a portable skill/template pack. Safe init/doctor/approve CLI. No commit, merge, publish, deploy, account or legacy configuration changes.

## Verification
- npm run check: TypeScript no-emit/build passed; 28 tests passed, zero failed/skipped. Tests exercise actual local check processes and a fake native host; provider calls are not tested.
- npm run smoke:pack: actual tarball extracted; packaged CLI installs seven agents and repeats without overwriting. Forty package entries at the time of this check; no test code included.
- `npm run smoke:host -- <OpenCode 2.0.32 executable>`: real isolated OpenCode 2.0.32 registered 7 commands, 7 agents and 1 skill, with provider use denied and zero model requests. Its own temporary service was stopped.
- npm pack --dry-run --json: package inventory checked; root index.js subsequently added and verified by smoke:pack/native smoke.
- python .sdd/bin/agentic_sdd.py doctor .: passed.
- git diff --check: passed; initial repository was empty/unborn, so implementation files are new/untracked until the user stages them.

The first sandbox npm test run passed 24 tests but failed creating a temporary junction (EPERM); unchanged tests passed with ordinary filesystem access. Initial native smoke attempts exposed harness authentication/registration mistakes, SQLite cleanup locking, and the missing local index entrypoint. These were corrected before the passing native smoke. An npm-cache OpenCode 2.0.32 was used; the globally installed 2.0.30 was not upgraded.

## Requirement-to-evidence mapping
REQ-001: typecheck/build, pack fixture, real native loading.
REQ-002: CLI tests, junction/cross-drive tests, packed init/repeat fixture.
REQ-003: invalid contracts/config/DAG and digest drift tests.
REQ-004: ordering/concurrency/exhaustion/restart and active-session tests.
REQ-005: fake-host method/permission/model/error tests and native registration smoke.
REQ-006: local executable pass/fail/timeout and independent review rejection tests; permission rejection propagates without retry.
REQ-007: all commands/tools covered by fake-host integration; seven commands register on real host.
REQ-008: README, roadmap, scoped diff review, local SDD evidence and release record.

## Files and purposes
- index.js: native local-directory loading entrypoint.
- package.json / package-lock.json: private local distribution, pinned SDK and reproducible dependencies/scripts.
- tsconfig.json / .gitignore: strict TypeScript build and generated/runtime artifact exclusions.
- packages/core/src/contracts.ts: strict spec/plan/config parsing, DAG/coverage validation and approval digest.
- packages/core/src/engine.ts: scheduler, state/evidence contracts, retry, checkpointing and recovery.
- packages/core/src/index.ts: portable core exports.
- packages/opencode-v2/src/index.ts: Plugin.define, commands/tools, version guard, mutation lock and native storage.
- packages/opencode-v2/src/runner.ts: native sessions/worktree, explicit models, permissions, review and diagnostics.
- packages/opencode-v2/src/checks.ts: shell-free argv execution with bounded process-tree cancellation.
- packages/cli/src/project.ts: path/file safety, project artifact loading, approval and exclusive installation.
- packages/cli/src/index.ts: init/doctor/approve executable and reusable initialization.
- packs/agents/sdd-orchestrator.md: primary workflow guide.
- packs/agents/sdd-research.md: read-only research behavior.
- packs/agents/sdd-architect.md: bounded architecture analysis.
- packs/agents/sdd-planner.md: requirement/task/check planning.
- packs/agents/sdd-implementation.md: scoped worktree builder.
- packs/agents/sdd-review.md: independent criterion review.
- packs/agents/sdd-security.md: source-backed security review profile.
- packs/skills/sdd-workflow/SKILL.md: portable workflow instructions.
- packs/templates/contracts.md: project schemas and configuration example.
- tests/fixtures.ts: isolated project/task fixtures.
- tests/core.test.ts: graph/config/state/concurrency/retry/recovery/permission behavior.
- tests/cli.test.ts: preservation, approval, diagnostics, symlinks and traversal.
- tests/native.test.ts: native API contracts, checks, model choices, commands/tools and version guard.
- scripts/pack-smoke.mjs: tarball extraction and packaged CLI verification.
- scripts/host-smoke.mjs: opt-in authenticated isolated native host loading, without model use.
- README.md / docs/roadmap.md: install/use instructions, observed evidence and deferred releases.
- AGENTS.md / .agents/skills/agentic-sdd-project/SKILL.md: local development governance.
- .sdd/bin/agentic_sdd.py / .sdd/project.json: portable lifecycle runner/project registration.
- .sdd/state / .sdd/evidence / .sdd/activity: lifecycle state and append-only local evidence; no fabricated worker activity.
- docs/sdd/project: product, architecture and verification baseline.
- docs/sdd/features/installable-opencode-v2-sdd-plugin/00-request.md through 07-retrospective.md: authorized scope, requirements, design, completed plan, checks, release and lessons.

## Compatibility and security
OpenCode >=2.0.32 and <3; native loading verified on 2.0.32 only. Node 22+. Existing opencode.json(c) is not rewritten. Models/checks start empty and must be configured before approval. JSON is used instead of YAML to avoid a parser dependency. Native permissions are asserted; workers cannot orchestrate nested workflows. Approval is a local integrity convention, not human identity authentication. Check code executes with host authority; no OS sandbox is claimed. Raw provider exceptions, test output and model text are excluded from plugin state; native host history retains its own evidence. No credentials were accessed or printed.

## Limits
No live provider/worker/tool-call benchmark or free-tier compatibility proof. Text-only preflight is explicitly opt-in and limited. Independent parallel builder branches, automatic merges, dynamic pricing/routing/classification, cross-process leases, migrations from future schemas, metrics, dashboards, nested teams and additional adapters remain roadmap work. One canonical host per project workflow. No remote repository, CI, public license/name decision or publication was performed. Initial source baseline/dependencies must be prepared for native worktrees; generated code is never described as verified from a model response alone.
