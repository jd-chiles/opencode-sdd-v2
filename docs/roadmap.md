# Delivery roadmap

## Production readiness and public 1.0.0 release

The active release-readiness feature is tracked in [the production-readiness plan](sdd/features/production-readiness-public-release/03-plan.md) and [the readiness report](production-readiness.md). The initial production workspace is Debian Linux, with Windows CI and Ubuntu/WSL compatibility also targeted. Current code is a 0.2.0 development release; public GitHub/npm publication is blocked on authenticated npm name ownership, trusted-publisher and protected-environment configuration, release-freeze latest-v2 host checks, and final complete-gate verification. The owner-approved bounded DeepSeek Go canary passed; see the readiness report for its scope and cost-reporting limitation.

## Local MVP (this repository)

Portable contracts and scheduler; native v2 adapter; safe init/doctor/approve; seven agents; portable skill/templates; specify/plan/execute/status/verify/resume/preflight; permission-preserving session dispatch; real local check processes; independent acceptance review; durable recovery. Includes parallel research and one shared isolated worktree, with serial builders to preserve dependencies.

## v0.2 follow-up

Independent parallel builder worktrees require a concrete Git integration contract, conflict ownership, rollback/reverification semantics and authorization. Add real opt-in provider tool-call probes with budgets and a live end-to-end host fixture. Validate supported OpenCode version range beyond the pinned SDK. Define artifact migration/version policy before adding migrate; there is currently only schema version 1 and no legacy schema to migrate.

## v0.3 follow-up

Dynamic price/capability policies need explicit provider authorization and budgets. Add structured provider-error classification, selective reroute and regression fixtures, review-specific retry strategy, cross-process leases and throughput metrics. Preserve exact provider errors only in an explicitly redacted diagnostic pipeline. No claims that alternative session creation bypasses free-tier provider restrictions.

## Later / decisions open

Nested teams, dashboards, Codex/Hermes adapters, public npm scope/name/license, remote GitHub repository, CI and publication. These are not implemented or externally provisioned. Do not read local package verification as a release/deployment approval.
