# OpenCode SDD

A local OpenCode v2 plugin for development driven by approved specifications and observable verification evidence. This repository implements the hybrid architecture in the supplied proposal: a portable TypeScript core, native OpenCode adapter, declarative agents/skills, and an initialization CLI.

Implemented: dependency validation and scheduling, parallel read-only research, serial builders in one isolated native worktree, explicit model allowlists, bounded retry, durable task/session evidence, executable checks, independent review, and interruption recovery. No package has been published.

## Install

The planned stable registry installation is version-pinned:

```sh
opencode plugin add opencode-v2-sdd-plugin@1.0.0
npm exec --yes --package=opencode-v2-sdd-plugin@1.0.0 -- opencode-sdd init /path/to/your-project
```

The first command registers the native OpenCode plugin. The second is a separate project-bootstrap CLI that installs agents, the workflow skill, templates, and `.opencode-sdd/{config,spec,plan}.json` into the target directory. The target directory must already exist. It leaves existing OpenCode settings untouched, preserves edited project artifacts, and refuses conflicting agent files or symlink destinations. Review the generated files before approval. These 1.0.0 commands are the intended release instructions; this checkout has not been published, so do not expect the package to resolve until the public release gates pass. See [OpenCode v2 plugin installation](https://opencode.ai/v2/docs/plugins).

For development or local testing, use Node 22.14+, npm, Git and OpenCode >=2.0.32 and <3. Earlier v2 releases are rejected to align with the SDK baseline. The SDK dependency is pinned to 2.0.32. On Debian, Windows, or WSL, install dependencies and build in this checkout:

```powershell
npm ci --ignore-scripts
npm run build
node dist/packages/cli/src/index.js init C:/path/to/your-project
```

The target directory must already exist. Init installs seven Markdown agents, a portable skill, contract templates, and `.opencode-sdd/{config,spec,plan}.json`. It leaves your OpenCode settings untouched, preserves edited project artifacts, and refuses conflicting agent files or symlink destinations.

For local source testing before publication, add the absolute path to **this built package directory** to the target project's existing `plugins` array in `opencode.json(c)`:

```json
{
  "plugins": ["C:/path/to/opencode-v2-sdd-plugin"]
}
```

Keep any existing plugin entries/settings. Restart OpenCode after initialization. Use a Git project with an initial commit; native worktree creation needs a valid starting checkout. Uncommitted source files and installed dependencies are not automatically copied into a new worktree. Prepare the source baseline before execution and ensure configured checks can run there. The plugin copies its own agent pack into the workflow worktree.

For a transferable local tarball:

```powershell
npm pack
# In another local directory, npm install /path/to/opencode-v2-sdd-plugin-0.2.0.tgz
# Then register that installed package directory and run its opencode-sdd CLI.
```

The npm package and GitHub repository names remain release candidates until availability and publishing-account ownership are confirmed. No provider/account changes are needed for local testing.

## Use

1. Run `/sdd-specify <requested outcome>` to write the specification, then `/sdd-plan` to write the task DAG. These commands prompt the current primary session using the installed skill/templates.
2. Edit `.opencode-sdd/config.json`: supply actual provider/model IDs for research, implementation and review, and named check argv. Defaults intentionally contain no models or checks. See the [contract](packs/templates/contracts.md).
3. Inspect the spec, plan and configuration. Run the deterministic pre-approval report, resolve structural blockers, and review any quality warnings:

```powershell
node dist/packages/cli/src/index.js validate C:/path/to/your-project
node dist/packages/cli/src/index.js approve C:/path/to/your-project --accept-warnings
node dist/packages/cli/src/index.js doctor C:/path/to/your-project
```

Omit `--accept-warnings` when the report has no warnings. When warnings are present, inspect the stable warning codes and only acknowledge them if you accept them. Structural validation errors cannot be acknowledged away. This report is deterministic and does not ask a model to approve the artifacts.

4. Run `/sdd-execute`. Inspect `/sdd-status` for a concise progress summary, evidence freshness, blockers, and the suggested next command. The `sdd_status` tool continues to return machine-readable JSON.
5. Run `/sdd-verify` to repeat checks and independent review of verified tasks against the final worktree. Status reports whether every task's evidence matches one current final-tree fingerprint; any later edit makes that full-worktree record stale. Inspect the retained worktree and integrate under your normal Git policy. Verification never commits or merges code.

Approval is a SHA256 binding of the normalized spec, plan and config. Any semantic edit requires renewed approval; a changed baseline after execution starts needs a new spec ID. Approval is a local trust convention: an agent with unrestricted shell access can invoke the CLI too. Agents are instructed not to self-approve; the digest is integrity checking, not authentication of a human identity.

| Command | Behavior |
| --- | --- |
| `/sdd-specify` | Prompt the primary agent to research/write spec.json |
| `/sdd-plan` | Prompt the primary agent to write plan.json |
| `/sdd-execute` | Dispatch approved ready tasks, checks and reviews |
| `/sdd-status` | Read durable progress without launching workers |
| `/sdd-verify` | Repeat checks/reviews for verified tasks; does not build pending tasks |
| `/sdd-refresh-research` | Explicitly rerun verified research whose input fingerprint is missing or stale; never replays builders |
| `/sdd-resume` | Check old sessions are idle, reset eligible blockers, continue within retry budget |
| `/sdd-preflight` | Explicit live, text-only child-session compatibility probes |

The primary agent can also use `sdd_status` and `sdd_run` tools; `sdd_run` supports explicit `refresh-research`. Child sessions cannot invoke orchestration. The researcher, architect, planner, builder, reviewer, security specialist and primary orchestrator are installed as Markdown; the scheduler dispatches research/implementation/review roles. Architecture/planning/security profiles remain available for explicit use in planning.

## Execution and verification contracts

- Task states are pending → running → review → verified, with failed/blocked recovery paths. Dependencies unlock only after verification. There is no fictitious merged state.
- Ready research runs before any ready builder, up to `maxParallelResearch`; research input fingerprints are recorded and a worktree mutation during research prevents that result from unlocking dependencies. Builders run one at a time in a shared workflow worktree so dependencies see earlier code. Independent parallel builder branches need an explicit integration strategy and are deferred.
- Configured model arrays are ordered approved alternatives, not price policies. The first available tool-capable model handles attempt 1; subsequent attempts select the next available configured choice within `maxAttempts`. Failed checks and review outcomes provide bounded safe repair metadata to the next builder. A review protocol/transport failure may retry review alone only if the worktree is unchanged, within the same attempt ceiling. Exhausted tasks stay failed. No hidden alternative, provider workaround, automatic attempt, or permission relaxation is applied.
- Every task receives independent review with every acceptance criterion covered. Implementation tasks also require named executable checks. Checks execute actual argv without a shell, in the workflow worktree, after native `shell` permission assertion. On Windows use an executable or Node script rather than `.cmd` wrappers. Test/check commands are arbitrary trusted project code, not sandboxed by this plugin.
- Check timeouts/cancellation terminate the spawned process tree using taskkill on Windows or a process group on POSIX. Detached descendants or external services started by checks remain the check author's responsibility.
- Native session IDs are persisted before prompting. Provider/transport failure cannot pass a task. Raw exception/check output and model response text remain out of plugin state; inspect native session history and rerun commands locally for details. Native host history may still contain sensitive content according to normal host policies.
- State uses native plugin storage keyed by project ID and feature ID. Schema v3 stores worktree fingerprints beside verification evidence, bounded attempt summaries, and research input fingerprints. v1/v2 task/session/check/review history is preserved; old verification is retained as historical and requires `/sdd-verify`. Research results with missing or changed input fingerprints remain historical until `/sdd-refresh-research` explicitly reruns those research tasks. Normal execute/verify do not launch surprise research calls, and refresh never replays builders. Prior-session text sent to any one agent is capped at 20,000 characters total with a truncation marker; contracts are separate, and raw command output is not captured. A crashed running/review task becomes blocked. Inspect/interrupt old sessions in OpenCode before `/sdd-resume`. Never replay a worker whose session may still be active.
- One plugin instance serializes mutations. Use one canonical OpenCode host instance per project workflow. Native storage has no cross-process compare-and-swap lease; separate host instances are not a supported distributed scheduler.
- The plugin asserts native `subagent`, `shell`, `sdd-execute` and `sdd-preflight` permissions and adds deny rules for nested delegation. Read-only workers deny edit/shell. Host permissions remain the authority; this is not an OS filesystem sandbox.

Doctor validates local artifacts/packs/models/approval offline. It does not claim provider availability. `/sdd-preflight` makes actual model requests only when explicitly invoked; ordinary provider usage/spend policies still apply. Its text-only `SDD_OK` probe does **not** establish tool-call or free-tier delegation compatibility. Failures include native session IDs for investigation and never silently downgrade permissions.

## Verification and roadmap

```powershell
npm run typecheck
npm test
npm pack --dry-run
npm run smoke:pack
python .sdd/bin/agentic_sdd.py doctor .
```

Tests exercise a fake OpenCode host and real local subprocess checks. They prove local scheduler/adapter/installer behavior, not successful live provider work. See [the implementation plan](docs/sdd/features/installable-opencode-v2-sdd-plugin/03-plan.md), [verification record](docs/sdd/features/installable-opencode-v2-sdd-plugin/06-release.md), and [roadmap](docs/roadmap.md).

`npm run smoke:pack` builds/extracts a tarball and exercises its CLI in a temporary fixture. For the optional provider-free native loading check, run `npm run smoke:host -- C:/path/to/opencode.exe [C:/path/to/installed-plugin-package]` (use the actual executable, not a shell wrapper). CI installs the generated tarball into a clean consumer fixture and passes that installed package path. The smoke uses isolated config/data, native authenticated service discovery, denied provider use, and stops its own temporary service. OpenCode 2.0.32 registered seven commands, seven agents and one skill, with zero model requests. A root `index.js` supports OpenCode's direct local-directory entrypoint probing; npm exports alone do not cover that path.

The native adapter follows the [OpenCode v2 plugin API](https://opencode.ai/v2/docs/build/plugins/) and [v2 agent format](https://opencode.ai/v2/docs/agents/), checked against installed SDK declarations. The docs and SDK can differ; the pinned declarations govern compilation.
