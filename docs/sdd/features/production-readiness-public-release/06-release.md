# Release record: Production readiness and public release

Status: Not ready for production publication; Debian and Windows local validation passed, external release gates remain open

## Observable change
This feature upgrades the local OpenCode SDD MVP toward stable 1.0.0 with content-bound verification, schema migration, Debian-primary and Windows CI, and public package/release preparation. Current package version is 0.2.0; no repository or npm publication has occurred.

## Requirement and evidence summary
Evidence is tracked in `04-verification.md`, `.omo/evidence/production-readiness-debian-current-validation.md`, `.omo/evidence/production-readiness-debian-host-smoke.md`, and `docs/production-readiness.md`. Current source passed full tests and package smoke on Debian 12 and Windows; executable-mode fingerprint coverage passed on Debian and capability-skipped on Windows. Provider-denied host smoke passed on both platforms for OpenCode 2.0.32. CI now validates SDD state, scheduled audits are configured, and the tagged release audits production dependencies and runs the complete SDD gate before publishing. The signed evidence-linked release checklist is ready for the eventual release commit. Corrected workflows have not run in GitHub Actions, and the external npm/GitHub protections remain unconfigured. The provider canary remains indeterminate after the one authorized retry. Mark a gate complete only from its actual command or authenticated platform result. The production report is the canonical list of unresolved gates.

## Compatibility, configuration, security, and migration notes
Current durable state is v3. Migrations preserve v1 history/session identifiers and v2 task evidence; verification without fingerprints remains historical until `/sdd-verify`, and legacy research without input provenance remains stale until `/sdd-refresh-research`. Initial target is Debian Linux, with Windows and Ubuntu/WSL intended; macOS is not claimed. Checks execute with host authority. The owner authorized one canary on `opencode-go/deepseek-v4.1-flash`, limited to included Go quota with no Zen Balance or top-ups; OpenCode returned `provider.no-route` and no model response. General provider execution remains disabled and the canary gate remains open. npm publishing identity and trusted-publisher provisioning remain unconfirmed.

## Limitations
No successful live-provider completion, GitHub Actions run after the Linux path correction, release-freeze recheck, account-ownership check, trusted-publisher provisioning, public repository, or package publication is claimed here.
