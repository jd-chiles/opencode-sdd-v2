# SDD project contracts (version 1)

Files live in .opencode-sdd/. All unknown keys are rejected. JSON only.

spec.json:
```json
{"version":1,"id":"feature-001","title":"Concrete feature","requirements":[{"id":"REQ-001","text":"Observable requirement"}]}
```

plan.json:
```json
{"version":1,"specID":"feature-001","tasks":[{"id":"TASK-001","title":"Implement feature","kind":"implementation","dependencies":[],"requirements":["REQ-001"],"acceptance":["A concrete observable behavior passes"],"checks":["test"]}]}
```

Task kinds: research (read-only) or implementation. Every requirement needs a task. Dependencies must exist; cycles and duplicates fail. Each task needs nonempty acceptance and requirement arrays. Every implementation task requires executable checks. Research may specify checks too. Named checks must exist in config.json. All tasks receive independent review. Do not use placeholder acceptance criteria in an approved project.

config.json:
```json
{"version":1,"execution":{"maxParallelResearch":4,"maxAttempts":2,"sessionTimeoutMs":600000,"checkTimeoutMs":120000},"models":{"research":[{"providerID":"your-provider","id":"your-model"}],"implementation":[{"providerID":"your-provider","id":"your-model"}],"review":[{"providerID":"your-provider","id":"your-model"}]},"checks":{"test":["node","--test"]}}
```

Model arrays are ordered authorized choices. Attempt 1 uses the first available tool-capable model; subsequent attempts use the next configured choice, bounded by maxAttempts. No price-based inference, discovery of unapproved alternatives or credential changes. Configure actual executable argv; no shell syntax, environment interpolation or shell builtins. On Windows use executable paths or Node script entrypoints instead of npm.cmd. Checks are arbitrary local code and require normal host permission; review them before approval.

Pre-approval: run `opencode-sdd validate` to inspect the deterministic requirement → task → acceptance → configured-check report. Structural errors block approval. Review any quality warnings; when warnings are present, a human must explicitly run `opencode-sdd approve --accept-warnings`. The approval file binds the normalized SHA256 artifact digest and the acknowledged warning codes. Agents must never create approval. Use a new spec id for a new baseline after execution has started.
