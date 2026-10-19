#!/usr/bin/env python3
"""Portable state and evidence manager for the Agentic SDD workflow."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


SCHEMA_VERSION = 1
STAGES = ("draft", "specified", "planned", "implementing", "verifying", "complete")
FILL_MARKER = "<!-- agentic-sdd:fill -->"
AGENTS_START = "<!-- agentic-sdd:start -->"
AGENTS_END = "<!-- agentic-sdd:end -->"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REQ_RE = re.compile(r"\bREQ-\d{3}\b")
TASK_RE = re.compile(r"\bTASK-\d{3}\b")
ACTIVITY_STATUSES = ("started", "completed", "failed")
MAX_WORKFLOW_FILE_BYTES = 2_000_000
MAX_ACTIVITY_FIELD_LENGTH = 500


class WorkflowError(Exception):
    """A user-correctable workflow error."""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="\n", dir=path.parent, delete=False
    ) as handle:
        handle.write(text)
        temporary = Path(handle.name)
    temporary.replace(path)


def write_json(path: Path, value: Any) -> None:
    atomic_write(path, json.dumps(value, indent=2, sort_keys=True) + "\n")


def load_json(path: Path) -> dict[str, Any]:
    try:
        if path.stat().st_size > MAX_WORKFLOW_FILE_BYTES:
            raise WorkflowError(f"Workflow file is too large: {path}")
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise WorkflowError(f"Missing workflow file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise WorkflowError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise WorkflowError(f"Expected a JSON object in {path}")
    return value


def project_root(value: str) -> Path:
    return Path(value).expanduser().resolve()


def managed_path(root: Path, path: Path) -> Path:
    """Reject managed paths that escape the project or traverse a symlink."""
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise WorkflowError(f"Managed path escapes the project: {path}") from exc
    current = root
    for part in path.relative_to(root).parts:
        current /= part
        if current.is_symlink():
            raise WorkflowError(f"Managed path traverses a symbolic link: {current}")
    try:
        path.resolve(strict=False).relative_to(root)
    except ValueError as exc:
        raise WorkflowError(f"Managed path resolves outside the project: {path}") from exc
    return path


def ensure_initialized(root: Path) -> dict[str, Any]:
    project_file = managed_path(root, root / ".sdd" / "project.json")
    project = load_json(project_file)
    if project.get("schema_version") != SCHEMA_VERSION:
        raise WorkflowError(
            f"Unsupported schema version in {project_file}; expected {SCHEMA_VERSION}"
        )
    return project


def normalize_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not slug or not SLUG_RE.fullmatch(slug):
        raise WorkflowError("Feature slug must contain lowercase letters, digits, and hyphens")
    return slug


def validate_slug(value: str) -> str:
    if not SLUG_RE.fullmatch(value):
        raise WorkflowError("Feature slug must contain lowercase letters, digits, and hyphens")
    return value


def feature_dir(root: Path, slug: str) -> Path:
    return managed_path(root, root / "docs" / "sdd" / "features" / validate_slug(slug))


def state_path(root: Path, slug: str) -> Path:
    return managed_path(root, root / ".sdd" / "state" / f"{validate_slug(slug)}.json")


def evidence_path(root: Path, slug: str) -> Path:
    return managed_path(
        root, root / ".sdd" / "evidence" / f"{validate_slug(slug)}.jsonl"
    )


def activity_path(root: Path, slug: str) -> Path:
    return managed_path(
        root, root / ".sdd" / "activity" / f"{validate_slug(slug)}.jsonl"
    )


def feature_state(root: Path, slug: str) -> dict[str, Any]:
    state = load_json(state_path(root, slug))
    if state.get("slug") != slug or state.get("stage") not in STAGES:
        raise WorkflowError(f"Invalid feature state for {slug}")
    return state


def append_line(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(value, sort_keys=True) + "\n")


def append_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def create_if_missing(path: Path, text: str, created: list[Path]) -> None:
    if not path.exists():
        atomic_write(path, text)
        created.append(path)


def agents_section() -> str:
    return f"""{AGENTS_START}
## Agentic SDD workflow

For implementation work, use the repository-local `agentic-sdd-project` skill and
the state manager at `.sdd/bin/agentic_sdd.py`. Requirements, design, plans, code,
tests, documentation, verification evidence, and release status must agree before
claiming completion. The workflow does not authorize deployment, publishing,
external communication, destructive operations, or material product, security,
privacy, cost, or production decisions.
{AGENTS_END}
"""


def local_skill() -> str:
    return """---
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
"""


PROJECT_FILES = {
    "docs/sdd/project/product-brief.md": f"""# Product brief

Status: Draft

{FILL_MARKER}

## Outcome

Describe the user and business outcome this project is authorized to pursue.

## Scope and exclusions

Record what is included, what is excluded, and which unknowns require a human choice.
""",
    "docs/sdd/project/architecture.md": f"""# Project architecture

Status: Draft

{FILL_MARKER}

Document the chosen stack, system boundaries, trust boundaries, data ownership,
runtime dependencies, and compatibility constraints. Do not describe unbuilt
components as implemented.
""",
    "docs/sdd/project/verification-strategy.md": f"""# Verification strategy

Status: Draft

{FILL_MARKER}

Define the project's formatting, static analysis, unit, integration, build, and
end-to-end checks, including which checks are required for each kind of change.
""",
}


def feature_files(title: str) -> dict[str, str]:
    return {
        "00-request.md": f"""# {title}

Status: Draft

{FILL_MARKER}

## Authorized outcome

State the observable outcome requested by the user.

## In scope

## Out of scope

## Constraints and existing evidence
""",
        "01-requirements.md": f"""# Requirements: {title}

Status: Draft

{FILL_MARKER}

Create stable, testable requirements. Use one identifier per requirement:

- `REQ-001`: requirement statement
  - Acceptance: observable pass condition
""",
        "02-design.md": f"""# Design: {title}

Status: Draft

{FILL_MARKER}

## Current system

## Proposed change

## Interfaces, data, and trust boundaries

## Compatibility and migration

## Risks and decisions requiring approval
""",
        "03-plan.md": f"""# Plan: {title}

Status: Draft

{FILL_MARKER}

Use ordered tasks linked to requirements:

- [ ] `TASK-001`: concrete implementation or verification step [`REQ-001`]
""",
        "04-verification.md": f"""# Verification plan: {title}

Status: Draft

{FILL_MARKER}

Map every requirement to a behavioral check, including relevant boundary and failure
cases. State exact commands when they are known.
""",
        "05-change-log.md": f"""# Change log: {title}

No baseline changes recorded.
""",
        "06-release.md": f"""# Release record: {title}

Status: Draft

{FILL_MARKER}

## Observable change

## Requirement and evidence summary

## Compatibility, configuration, security, and migration notes

## Limitations
""",
        "07-retrospective.md": f"""# Retrospective: {title}

{FILL_MARKER}

Capture a concise reusable lesson, or replace the marker with `Not needed` for a
routine change.
""",
    }


def command_init(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    root.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []
    project_file = root / ".sdd" / "project.json"
    destination = root / ".sdd" / "bin" / "agentic_sdd.py"
    local_skill_path = root / ".agents" / "skills" / "agentic-sdd-project" / "SKILL.md"
    agents = root / "AGENTS.md"
    preflight = [
        project_file,
        destination,
        local_skill_path,
        agents,
        *(root / relative for relative in PROJECT_FILES),
        *(root / ".sdd" / relative for relative in ("state", "evidence", "activity", "templates")),
        root / "docs" / "sdd" / "features",
    ]
    for path in preflight:
        managed_path(root, path)
    if project_file.exists():
        project = ensure_initialized(root)
        if args.name and project.get("name") != args.name:
            raise WorkflowError(
                f"Project is already named {project.get('name')!r}; refusing to rename it"
            )
    else:
        write_json(
            project_file,
            {
                "initialized_at": now(),
                "name": args.name or root.name,
                "schema_version": SCHEMA_VERSION,
                "workflow": "agentic-sdd",
            },
        )
        created.append(project_file)

    for relative in ("state", "evidence", "activity", "templates"):
        (root / ".sdd" / relative).mkdir(parents=True, exist_ok=True)
    (root / "docs" / "sdd" / "features").mkdir(parents=True, exist_ok=True)

    destination.parent.mkdir(parents=True, exist_ok=True)
    source = Path(__file__).resolve()
    if not destination.exists() or source != destination.resolve():
        shutil.copyfile(source, destination)
    destination.chmod(destination.stat().st_mode | 0o111)

    create_if_missing(
        local_skill_path,
        local_skill(),
        created,
    )
    for relative, content in PROJECT_FILES.items():
        create_if_missing(root / relative, content, created)

    if agents.exists():
        current = agents.read_text(encoding="utf-8")
        if AGENTS_START not in current:
            separator = "" if current.endswith("\n") else "\n"
            append_text(agents, separator + "\n" + agents_section())
    else:
        atomic_write(agents, "# Repository instructions\n\n" + agents_section())
        created.append(agents)

    print(f"Initialized Agentic SDD in {root}")
    print(f"Created {len(created)} file(s); preserved existing project artifacts")


def command_start(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    ensure_initialized(root)
    slug = validate_slug(args.slug) if args.slug else normalize_slug(args.title)
    directory = feature_dir(root, slug)
    state_file = state_path(root, slug)
    if directory.exists() or state_file.exists():
        raise WorkflowError(f"Feature {slug!r} already exists")
    directory.mkdir(parents=True)
    for name, content in feature_files(args.title).items():
        atomic_write(directory / name, content)
    evidence_path(root, slug).touch()
    activity_file = activity_path(root, slug)
    activity_file.parent.mkdir(parents=True, exist_ok=True)
    activity_file.touch()
    timestamp = now()
    write_json(
        state_file,
        {
            "created_at": timestamp,
            "history": [{"at": timestamp, "from": None, "to": "draft"}],
            "schema_version": SCHEMA_VERSION,
            "slug": slug,
            "stage": "draft",
            "title": args.title,
            "updated_at": timestamp,
        },
    )
    print(f"Started {slug} in stage draft")
    print(directory)


def all_states(root: Path) -> list[dict[str, Any]]:
    state_directory = managed_path(root, root / ".sdd" / "state")
    if not state_directory.is_dir():
        return []
    values = []
    for path in sorted(state_directory.glob("*.json")):
        if len(values) >= 100:
            raise WorkflowError("Project contains more than 100 SDD feature states")
        values.append(load_json(managed_path(root, path)))
    return values


def command_status(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    project = ensure_initialized(root)
    states = all_states(root)
    if args.json:
        details = [status_feature(root, state) for state in states]
        print(
            json.dumps(
                {"project": project, "features": states, "details": details},
                indent=2,
                sort_keys=True,
            )
        )
        return
    print(f"Project: {project.get('name')} ({root})")
    if not states:
        print("Features: none")
        return
    for state in states:
        print(f"{state['slug']}: {state['stage']} — {state['title']}")


def text_for(root: Path, slug: str, name: str) -> str:
    path = managed_path(root, feature_dir(root, slug) / name)
    try:
        if path.stat().st_size > MAX_WORKFLOW_FILE_BYTES:
            raise WorkflowError(f"Workflow artifact is too large: {path}")
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def unique_matches(pattern: re.Pattern[str], text: str) -> list[str]:
    return sorted(set(pattern.findall(text)))


def read_evidence(root: Path, slug: str) -> tuple[list[dict[str, Any]], list[str]]:
    path = evidence_path(root, slug)
    records: list[dict[str, Any]] = []
    issues: list[str] = []
    if not path.exists():
        return records, [f"missing evidence file: {path}"]
    if path.stat().st_size > MAX_WORKFLOW_FILE_BYTES:
        return records, [f"evidence file is too large: {path}"]
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            issues.append(f"invalid evidence JSON on line {number}: {exc}")
            continue
        if not isinstance(record, dict):
            issues.append(f"evidence line {number} is not an object")
            continue
        records.append(record)
    return records, issues


def read_activity(root: Path, slug: str) -> tuple[list[dict[str, Any]], list[str]]:
    path = activity_path(root, slug)
    if not path.exists():
        return [], []
    if path.stat().st_size > MAX_WORKFLOW_FILE_BYTES:
        return [], [f"activity file is too large: {path}"]

    records: list[dict[str, Any]] = []
    issues: list[str] = []
    runs: dict[str, dict[str, Any]] = {}
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            issues.append(f"invalid activity JSON on line {number}: {exc}")
            continue
        if not isinstance(record, dict):
            issues.append(f"activity line {number} is not an object")
            continue
        run_id = record.get("run_id")
        status = record.get("status")
        agent = record.get("agent")
        summary = record.get("summary", "")
        task = record.get("task", "")
        if (
            not isinstance(run_id, str)
            or not run_id.strip()
            or len(run_id) > 100
            or status not in ACTIVITY_STATUSES
            or not isinstance(agent, str)
            or not agent.strip()
            or len(agent) > MAX_ACTIVITY_FIELD_LENGTH
            or not isinstance(summary, str)
            or len(summary) > MAX_ACTIVITY_FIELD_LENGTH
            or not isinstance(task, str)
            or len(task) > MAX_ACTIVITY_FIELD_LENGTH
        ):
            issues.append(f"invalid activity fields on line {number}")
            continue

        previous = runs.get(run_id)
        if status == "started":
            if previous is not None:
                issues.append(f"agent run {run_id} was started more than once")
                continue
            runs[run_id] = {**record, "effective_status": "active"}
        elif previous is None or previous.get("effective_status") != "active":
            issues.append(f"agent run {run_id} has an invalid {status} transition")
            continue
        elif previous.get("agent") != agent:
            issues.append(f"agent run {run_id} changed its label")
            continue
        else:
            runs[run_id] = {
                **record,
                "task": task or previous.get("task", ""),
                "effective_status": status,
                "started_at": previous.get("recorded_at"),
            }
        records.append(record)
    return records, issues


def record_agent_activity(
    root: Path,
    slug: str,
    *,
    run_id: str | None,
    agent: str,
    status: str,
    task: str,
    summary: str,
) -> str:
    feature_state(root, slug)
    if status not in ACTIVITY_STATUSES:
        raise WorkflowError(f"Activity status must be one of: {', '.join(ACTIVITY_STATUSES)}")
    if not agent.strip() or len(agent) > MAX_ACTIVITY_FIELD_LENGTH:
        raise WorkflowError("Agent label must contain 1-500 characters")
    if len(task) > MAX_ACTIVITY_FIELD_LENGTH or len(summary) > MAX_ACTIVITY_FIELD_LENGTH:
        raise WorkflowError("Task and summary must be at most 500 characters")

    events, issues = read_activity(root, slug)
    if issues:
        raise WorkflowError(f"Cannot append to invalid activity log: {issues[0]}")
    effective: dict[str, dict[str, Any]] = {}
    for event in events:
        existing = effective.get(event["run_id"])
        if event["status"] == "started":
            effective[event["run_id"]] = {**event, "effective_status": "active"}
        elif existing:
            effective[event["run_id"]] = {
                **event,
                "task": event.get("task") or existing.get("task", ""),
                "effective_status": event["status"],
            }

    if status == "started":
        run_id = (run_id or str(uuid.uuid4())).strip()
        if not run_id or len(run_id) > 100:
            raise WorkflowError("Run ID must contain 1-100 characters")
        if run_id in effective:
            raise WorkflowError(f"Agent run {run_id} already exists")
    else:
        run_id = run_id.strip() if run_id else None
        if not run_id or run_id not in effective:
            raise WorkflowError(f"Cannot finish unknown agent run {run_id!r}")
        previous = effective[run_id]
        if previous.get("effective_status") != "active":
            raise WorkflowError(f"Agent run {run_id} is already finished")
        if previous.get("agent") != agent:
            raise WorkflowError(f"Agent run {run_id} belongs to {previous.get('agent')!r}")
        task = task or previous.get("task", "")

    record = {
        "agent": agent.strip(),
        "recorded_at": now(),
        "run_id": run_id,
        "status": status,
        "summary": summary.strip(),
        "task": task.strip(),
    }
    path = activity_path(root, slug)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(record, sort_keys=True) + "\n").encode("utf-8")
    descriptor = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o600)
    try:
        written = os.write(descriptor, payload)
    finally:
        os.close(descriptor)
    if written != len(payload):
        raise WorkflowError("Could not append the complete activity event")
    return str(run_id)


def status_feature(root: Path, state: dict[str, Any]) -> dict[str, Any]:
    slug = state.get("slug")
    if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
        raise WorkflowError("Feature state contains an invalid slug")
    state = feature_state(root, slug)
    evidence, evidence_issues = read_evidence(root, slug)
    activity, activity_issues = read_activity(root, slug)
    current_runs: dict[str, dict[str, Any]] = {}
    for event in activity:
        previous = current_runs.get(event["run_id"])
        if event["status"] == "started":
            current_runs[event["run_id"]] = {**event, "effective_status": "active"}
        elif previous:
            current_runs[event["run_id"]] = {
                **event,
                "task": event.get("task") or previous.get("task", ""),
                "effective_status": event["status"],
                "started_at": previous.get("recorded_at"),
            }

    plan = text_for(root, slug, "03-plan.md")
    tasks = []
    for line in plan.splitlines():
        match = re.match(r"^- \[([ xX])\]\s+`?(TASK-\d{3})`?:\s*(.*)$", line)
        if match:
            tasks.append(
                {
                    "id": match.group(2),
                    "title": match.group(3)[:MAX_ACTIVITY_FIELD_LENGTH],
                    "complete": match.group(1).lower() == "x",
                }
            )
    history = state.get("history", [])
    if not isinstance(history, list):
        history = []
    history_summary = []
    for entry in history[-6:][::-1]:
        if isinstance(entry, dict):
            history_summary.append(
                {
                    "at": str(entry.get("at", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                    "from": str(entry.get("from", ""))[:50],
                    "to": str(entry.get("to", ""))[:50],
                    "reason": str(entry.get("reason", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                }
            )
    target = next_stage(state["stage"])
    blockers = validate_target(root, slug, target) if state["stage"] != "complete" else []
    blockers = [
        issue.replace(str(root), "<project root>")[:MAX_ACTIVITY_FIELD_LENGTH]
        for issue in blockers
    ]
    timeline = []
    for entry in history:
        if isinstance(entry, dict):
            timeline.append(
                {
                    "at": str(entry.get("at", "")),
                    "kind": "stage",
                    "label": f"Stage: {entry.get('to', 'unknown')}"[:MAX_ACTIVITY_FIELD_LENGTH],
                }
            )
    for record in evidence:
        timeline.append(
            {
                "at": str(record.get("recorded_at", "")),
                "kind": "check",
                "label": (
                    f"Check {record.get('outcome', 'unknown')}: {record.get('command', '')}"
                )[:MAX_ACTIVITY_FIELD_LENGTH],
            }
        )
    for record in activity:
        timeline.append(
            {
                "at": str(record.get("recorded_at", "")),
                "kind": "agent",
                "label": (
                    f"{record.get('agent', 'Agent')} {record.get('status', 'updated')}: "
                    f"{record.get('task', '') or record.get('summary', '')}"
                )[:MAX_ACTIVITY_FIELD_LENGTH],
            }
        )
    timeline.sort(key=lambda entry: entry["at"], reverse=True)
    recent_runs = []
    for run in sorted(
        current_runs.values(),
        key=lambda item: str(item.get("recorded_at", "")),
        reverse=True,
    )[:8]:
        recent_runs.append(
            {
                "run_id": str(run.get("run_id", ""))[:100],
                "agent": str(run.get("agent", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                "task": str(run.get("task", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                "summary": str(run.get("summary", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                "status": str(run.get("status", ""))[:20],
                "effective_status": str(run.get("effective_status", ""))[:20],
                "recorded_at": str(run.get("recorded_at", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                "started_at": str(run.get("started_at", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
            }
        )
    recent_checks = []
    for event in evidence[-8:][::-1]:
        requirements = event.get("requirements", [])
        if not isinstance(requirements, list):
            requirements = []
        recent_checks.append(
            {
                "recorded_at": str(event.get("recorded_at", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                "command": str(event.get("command", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                "outcome": str(event.get("outcome", "unknown"))[:20],
                "summary": str(event.get("summary", ""))[:MAX_ACTIVITY_FIELD_LENGTH],
                "requirements": [
                    str(item)[:20]
                    for item in requirements[:20]
                    if isinstance(item, str)
                ],
            }
        )
    return {
        "slug": slug,
        "title": str(state.get("title", slug))[:MAX_ACTIVITY_FIELD_LENGTH],
        "stage": state["stage"],
        "updated_at": state.get("updated_at", ""),
        "history": history_summary,
        "history_total": len(history),
        "next_stage": None if state["stage"] == "complete" else target,
        "ready_for_next_stage": state["stage"] == "complete" or not blockers,
        "blockers": blockers[:12],
        "tasks": {
            "total": len(tasks),
            "complete": sum(1 for task in tasks if task["complete"]),
            "items": tasks[-8:],
        },
        "active_agents": [run for run in recent_runs if run.get("effective_status") == "active"],
        "recent_agents": recent_runs,
        "checks_total": len(evidence),
        "recent_checks": recent_checks,
        "timeline": timeline[:12],
        "data_issues": [
            issue.replace(str(root), "<project root>")[:MAX_ACTIVITY_FIELD_LENGTH]
            for issue in (evidence_issues + activity_issues)[:12]
        ],
    }


def workflow_status(root_value: str) -> dict[str, Any]:
    root = project_root(root_value)
    project = ensure_initialized(root)
    features = [status_feature(root, state) for state in all_states(root)]
    return {
        "generated_at": now(),
        "project": {
            "name": str(project.get("name", root.name))[:MAX_ACTIVITY_FIELD_LENGTH],
            "root_label": root.name,
        },
        "features": features,
    }


def required_files_for(target: str) -> tuple[str, ...]:
    if target == "specified":
        return ("00-request.md", "01-requirements.md", "02-design.md")
    if target in ("planned", "implementing"):
        return (
            "00-request.md",
            "01-requirements.md",
            "02-design.md",
            "03-plan.md",
            "04-verification.md",
        )
    if target == "verifying":
        return (
            "00-request.md",
            "01-requirements.md",
            "02-design.md",
            "03-plan.md",
            "04-verification.md",
            "05-change-log.md",
        )
    if target == "complete":
        return tuple(feature_files("feature").keys())
    return ()


def validate_target(root: Path, slug: str, target: str) -> list[str]:
    issues: list[str] = []
    directory = feature_dir(root, slug)
    if not directory.is_dir():
        return [f"missing feature directory: {directory}"]

    for name in required_files_for(target):
        path = managed_path(root, directory / name)
        if not path.is_file():
            issues.append(f"missing artifact: {name}")
            continue
        if path.stat().st_size > MAX_WORKFLOW_FILE_BYTES:
            issues.append(f"artifact is too large: {name}")
            continue
        if FILL_MARKER in path.read_text(encoding="utf-8"):
            issues.append(f"unresolved scaffold marker: {name}")

    requirements = text_for(root, slug, "01-requirements.md")
    requirement_ids = unique_matches(REQ_RE, requirements)
    if target in STAGES[1:] and not requirement_ids:
        issues.append("01-requirements.md has no REQ-### identifiers")

    if target in STAGES[2:]:
        plan = text_for(root, slug, "03-plan.md")
        verification = text_for(root, slug, "04-verification.md")
        if not unique_matches(TASK_RE, plan):
            issues.append("03-plan.md has no TASK-### identifiers")
        for requirement in requirement_ids:
            if requirement not in plan:
                issues.append(f"03-plan.md does not map {requirement}")
            if requirement not in verification:
                issues.append(f"04-verification.md does not map {requirement}")

    records, evidence_issues = read_evidence(root, slug)
    if target in ("verifying", "complete"):
        issues.extend(evidence_issues)
        plan = text_for(root, slug, "03-plan.md")
        if re.search(r"^- \[ \].*TASK-\d{3}", plan, flags=re.MULTILINE):
            issues.append("03-plan.md still has unchecked TASK-### items")
        if not records:
            issues.append("no verification evidence has been recorded")

    if target == "complete":
        latest_by_requirement: dict[str, dict[str, Any]] = {}
        latest_by_command: dict[str, dict[str, Any]] = {}
        for record in records:
            command = record.get("command")
            if isinstance(command, str):
                latest_by_command[command] = record
            for requirement in record.get("requirements", []):
                if isinstance(requirement, str):
                    latest_by_requirement[requirement] = record
        for requirement in requirement_ids:
            record = latest_by_requirement.get(requirement)
            if not record:
                issues.append(f"no evidence maps to {requirement}")
            elif record.get("outcome") != "passed":
                issues.append(f"latest evidence for {requirement} is not passed")
        for command, record in latest_by_command.items():
            if record.get("outcome") == "failed":
                issues.append(f"latest result is failed: {command}")
        release = text_for(root, slug, "06-release.md")
        if not re.search(r"^Status:\s*Ready\s*$", release, flags=re.MULTILINE | re.IGNORECASE):
            issues.append("06-release.md must contain 'Status: Ready'")
    return issues


def next_stage(stage: str) -> str:
    index = STAGES.index(stage)
    return STAGES[min(index + 1, len(STAGES) - 1)]


def command_check(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    ensure_initialized(root)
    state = feature_state(root, args.slug)
    target = args.target or next_stage(state["stage"])
    issues = validate_target(root, args.slug, target)
    payload = {"feature": args.slug, "ready_for": target, "issues": issues}
    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    elif issues:
        print(f"{args.slug} is not ready for {target}:")
        for issue in issues:
            print(f"- {issue}")
    else:
        print(f"{args.slug} is ready for {target}")
    if issues:
        raise WorkflowError(f"{len(issues)} gate issue(s)")


def command_advance(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    ensure_initialized(root)
    state = feature_state(root, args.slug)
    current = state["stage"]
    expected = next_stage(current)
    if current == "complete":
        raise WorkflowError("Completed features cannot advance")
    if args.to != expected:
        raise WorkflowError(f"Expected next stage {expected!r}, not {args.to!r}")
    issues = validate_target(root, args.slug, args.to)
    if issues:
        for issue in issues:
            print(f"- {issue}", file=sys.stderr)
        raise WorkflowError(f"Cannot advance: {len(issues)} gate issue(s)")
    timestamp = now()
    state["stage"] = args.to
    state["updated_at"] = timestamp
    state.setdefault("history", []).append({"at": timestamp, "from": current, "to": args.to})
    write_json(state_path(root, args.slug), state)
    print(f"Advanced {args.slug}: {current} -> {args.to}")


def command_record(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    ensure_initialized(root)
    feature_state(root, args.slug)
    requirements = unique_matches(
        REQ_RE, text_for(root, args.slug, "01-requirements.md")
    )
    supplied = sorted(set(args.requirement or []))
    unknown = [item for item in supplied if item not in requirements]
    if unknown:
        raise WorkflowError(f"Unknown requirement(s): {', '.join(unknown)}")
    record = {
        "artifacts": args.artifact or [],
        "command": args.command,
        "outcome": args.outcome,
        "recorded_at": now(),
        "requirements": supplied,
        "summary": args.summary,
    }
    append_line(evidence_path(root, args.slug), record)
    print(f"Recorded {args.outcome} evidence for {args.slug}")


def command_activity(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    ensure_initialized(root)
    run_id = record_agent_activity(
        root,
        args.slug,
        run_id=args.run_id,
        agent=args.agent,
        status=args.status,
        task=args.task,
        summary=args.summary,
    )
    print(f"Recorded agent {args.status}: {args.agent} (run {run_id})")


def command_revise(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    ensure_initialized(root)
    state = feature_state(root, args.slug)
    current = state["stage"]
    if current in ("draft", "complete"):
        raise WorkflowError(f"Cannot revise a feature in stage {current}")
    timestamp = now()
    state["stage"] = "specified"
    state["updated_at"] = timestamp
    state.setdefault("history", []).append(
        {"at": timestamp, "from": current, "reason": args.reason, "to": "specified"}
    )
    write_json(state_path(root, args.slug), state)
    append_text(
        feature_dir(root, args.slug) / "05-change-log.md",
        f"\n## {timestamp}\n\nReopened from `{current}`: {args.reason}\n",
    )
    print(f"Reopened {args.slug}: {current} -> specified")


def command_doctor(args: argparse.Namespace) -> None:
    root = project_root(args.root)
    project = ensure_initialized(root)
    issues: list[str] = []
    required = (
        "AGENTS.md",
        ".agents/skills/agentic-sdd-project/SKILL.md",
        ".sdd/bin/agentic_sdd.py",
        "docs/sdd/project/product-brief.md",
        "docs/sdd/project/architecture.md",
        "docs/sdd/project/verification-strategy.md",
    )
    for relative in required:
        if not (root / relative).is_file():
            issues.append(f"missing {relative}")
    agents = root / "AGENTS.md"
    if agents.is_file():
        text = agents.read_text(encoding="utf-8")
        if text.count(AGENTS_START) != 1 or text.count(AGENTS_END) != 1:
            issues.append("AGENTS.md does not contain exactly one complete workflow section")
    for state in all_states(root):
        slug = state.get("slug")
        if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
            issues.append("feature state contains an invalid slug")
            continue
        if not feature_dir(root, slug).is_dir():
            issues.append(f"missing feature artifacts for {slug}")
        _, evidence_issues = read_evidence(root, slug)
        issues.extend(f"{slug}: {issue}" for issue in evidence_issues)
    if issues:
        print(f"Agentic SDD doctor found {len(issues)} issue(s):")
        for issue in issues:
            print(f"- {issue}")
        raise WorkflowError("Project structure is invalid")
    print(f"Agentic SDD doctor passed for {project.get('name')}")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        prog="agentic_sdd",
        description="Scaffold and gate a portable spec-driven development workflow.",
    )
    subparsers = result.add_subparsers(dest="subcommand", required=True)

    init = subparsers.add_parser("init", help="Initialize or refresh workflow support")
    init.add_argument("root", help="Project directory")
    init.add_argument("--name", help="Stable project name")
    init.set_defaults(function=command_init)

    start = subparsers.add_parser("start", help="Start a feature lifecycle")
    start.add_argument("root", help="Project directory")
    start.add_argument("--title", required=True, help="Human-readable feature title")
    start.add_argument("--slug", help="Lowercase feature slug; derived from title by default")
    start.set_defaults(function=command_start)

    status = subparsers.add_parser("status", help="Show project feature state")
    status.add_argument("root", help="Project directory")
    status.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    status.set_defaults(function=command_status)

    check = subparsers.add_parser("check", help="Validate readiness for a lifecycle stage")
    check.add_argument("root", help="Project directory")
    check.add_argument("slug", help="Feature slug")
    check.add_argument("--target", choices=STAGES[1:], help="Stage to validate")
    check.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    check.set_defaults(function=command_check)

    advance = subparsers.add_parser("advance", help="Advance through one validated stage")
    advance.add_argument("root", help="Project directory")
    advance.add_argument("slug", help="Feature slug")
    advance.add_argument("--to", required=True, choices=STAGES[1:], help="Next stage")
    advance.set_defaults(function=command_advance)

    record = subparsers.add_parser("record", help="Append observed verification evidence")
    record.add_argument("root", help="Project directory")
    record.add_argument("slug", help="Feature slug")
    record.add_argument("--command", required=True, help="Exact command that ran")
    record.add_argument(
        "--outcome", required=True, choices=("passed", "failed", "skipped"), help="Observed result"
    )
    record.add_argument("--summary", required=True, help="Concise observed result")
    record.add_argument(
        "--requirement", action="append", help="REQ-### verified; may be repeated"
    )
    record.add_argument(
        "--artifact", action="append", help="Evidence artifact path; may be repeated"
    )
    record.set_defaults(function=command_record)

    activity = subparsers.add_parser(
        "activity", help="Append an agent dispatch or completion update"
    )
    activity.add_argument("root", help="Project directory")
    activity.add_argument("slug", help="Feature slug")
    activity.add_argument("--run-id", help="Stable run ID; generated when starting a run")
    activity.add_argument("--agent", required=True, help="Agent role or label")
    activity.add_argument(
        "--status", required=True, choices=ACTIVITY_STATUSES, help="Agent run state"
    )
    activity.add_argument("--task", default="", help="Short task label")
    activity.add_argument("--summary", default="", help="Short completion or failure summary")
    activity.set_defaults(function=command_activity)

    revise = subparsers.add_parser("revise", help="Reopen a baseline after a scoped change")
    revise.add_argument("root", help="Project directory")
    revise.add_argument("slug", help="Feature slug")
    revise.add_argument("--reason", required=True, help="Reason for the baseline change")
    revise.set_defaults(function=command_revise)

    doctor = subparsers.add_parser("doctor", help="Validate scaffold structure and metadata")
    doctor.add_argument("root", help="Project directory")
    doctor.set_defaults(function=command_doctor)
    return result


def main(argv: Iterable[str] | None = None) -> int:
    args = parser().parse_args(list(argv) if argv is not None else None)
    try:
        args.function(args)
    except WorkflowError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
