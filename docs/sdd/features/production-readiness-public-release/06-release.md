# Release record: Production readiness and public release

Status: Not ready for production publication; Debian and Windows local validation passed, external release gates remain open

## Observable change
This feature upgrades the local OpenCode SDD MVP toward stable 1.0.0 with content-bound verification, schema migration, Debian-primary and Windows CI, and public package/release preparation. Current package version is 0.2.0; no repository or npm publication has occurred.

## Requirement and evidence summary
Evidence is tracked in `04-verification.md`, `.omo/evidence/production-readiness-debian-current-validation.md`, `.omo/evidence/production-readiness-debian-host-smoke.md`, `.omo/evidence/production-readiness-provider-canary.md`, and `docs/production-readiness.md`. Current source passed full tests and package smoke on Debian 12 and Windows; executable-mode fingerprint coverage passed on Debian and capability-skipped on Windows. Provider-denied host smoke passed on both platforms for OpenCode 2.0.32. Public GitHub Actions runs passed on Windows and Debian 12, including the corrected workflow paths. CI validates SDD state, scheduled audits are configured, and the tagged release audits production dependencies and runs the complete SDD gate before publishing. The signed evidence-linked release checklist is ready for the eventual release commit. The bounded provider canary passed on OpenCode 2.0.30 with zero tool events; exact cost was not reported. External npm/GitHub protections remain unconfigured. Mark a gate complete only from its actual command or authenticated platform result. The production report is the canonical list of unresolved gates.

## Compatibility, configuration, security, and migration notes
Current durable state is v3. Migrations preserve v1 history/session identifiers and v2 task evidence; verification without fingerprints remains historical until `/sdd-verify`, and legacy research without input provenance remains stale until `/sdd-refresh-research`. Initial target is Debian Linux, with Windows and Ubuntu/WSL intended; macOS is not claimed. Checks execute with host authority. A bounded canary on `opencode-go/deepseek-v4.1-flash` returned the expected value with zero tool events on OpenCode 2.0.30; the Go balance-use switch remained off. Exact usage cost was not reported. Any additional provider call requires renewed authorization. npm publishing identity and trusted-publisher provisioning remain unconfirmed.

## Limitations
The successful provider canary does not establish provider support on Debian or Windows or on OpenCode 2.0.32. No release-freeze recheck, npm account-ownership check, trusted-publisher provisioning, public package publication, provenance, or post-publication installation is claimed here.
