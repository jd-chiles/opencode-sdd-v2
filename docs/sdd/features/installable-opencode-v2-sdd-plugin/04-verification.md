# Verification
Status: Baseline
REQ-001: npm run typecheck; npm run build; npm pack --dry-run and packed CLI fixture.
REQ-002: CLI tests cover repeat init, conflict preservation, symlink rejection and offline diagnostics.
REQ-003: Core tests cover invalid graph/config/contracts, cycles and digest drift.
REQ-004: Core tests cover dependency order, concurrency, serial builders, exhaustion, reload and blockers.
REQ-005: Adapter tests inspect native calls, permissions, fallback and provider failure.
REQ-006: Adapter tests execute local argv fixtures for pass/fail/timeout and validate review acceptance mapping.
REQ-007: Fake-host integration covers all command registrations, tools, preflight and recovery.
REQ-008: Review README/roadmap, git diff/status and SDD completion gate.
