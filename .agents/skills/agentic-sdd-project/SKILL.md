---
name: agentic-sdd-project
description: Run implementation work in this repository through its local requirements, design, plan, implementation, verification, and evidence gates. Use for feature work, bug fixes, refactors, and other repository changes. Do not use for read-only questions.
---

# Project Agentic SDD loop

The user's request defines scope. Inspect the repository and run
`python .sdd/bin/agentic_sdd.py status .` before editing.

For a new change, run `start`, fill every generated artifact marker with repository
facts, and use `advance` rather than editing state JSON. Requirements use `REQ-###`;
tasks use `TASK-###` and map to requirements. Implement the smallest complete change,
run relevant tests, and use `record` for exact commands and observed outcomes. Use
`revise --reason` when the baseline changes. Review the diff and run
`check --target complete` before completion.

Do not weaken gates or fabricate evidence. Stop for user approval when a missing
choice materially changes scope, public behavior, security, privacy, compatibility,
cost, production, external communication, or irreversible data handling.
