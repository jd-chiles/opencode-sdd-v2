---
name: sdd-workflow
description: Specify, plan, execute and verify human-approved development with the OpenCode SDD engine
---

1. Inspect repository instructions, status, architecture and tests.
2. Write .opencode-sdd/spec.json with stable requirements. Use the contracts template.
3. Write .opencode-sdd/plan.json with a covered, acyclic dependency graph. Every implementation task requires at least one configured executable check and concrete acceptance criteria.
4. Help the human configure explicit provider/model allowlists and check argv in config.json. Do not change credentials, provider settings or permissions.
5. Run `opencode-sdd validate` and present the deterministic requirement/task/acceptance/check mapping. Resolve every structural blocker. A human must review and explicitly acknowledge any quality warning with `opencode-sdd approve --accept-warnings`; never approve your own plan. Any artifact edit invalidates approval.
6. Use `/sdd-execute` or sdd_run. The engine owns scheduling and native child sessions. Do not delegate independently. Workers are one level deep.
7. Use `/sdd-status` to inspect concise progress, blockers, evidence freshness and the suggested next command. The `sdd_status` tool remains machine-readable. Never equate recorded activity with successful execution.
8. Interrupted work remains blocked. Inspect or interrupt remaining native sessions, then explicitly run `/sdd-resume`. Retry budget is finite; revise the plan with a new feature id when exhausted.
9. `/sdd-verify` repeats configured checks and independent review for verified tasks. `/sdd-refresh-research` explicitly reruns verified research whose input fingerprint is missing or no longer matches the worktree; it never replays builders. Verified does not mean merged. Inspect the retained worktree and integrate manually under repository Git policy.

Never publish, deploy, spend, alter accounts or expose secrets without explicit human authorization. Live preflight is text-only and does not prove tool-call compatibility.
