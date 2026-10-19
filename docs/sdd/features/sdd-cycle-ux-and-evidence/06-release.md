# Release record: SDD Cycle UX and Evidence Improvements

Status: Ready

This status means this feature's scoped implementation and SDD completion gate are ready. It does not indicate package publication or production readiness; those remain governed by `production-readiness-public-release`, which stays at `verifying`.

## Observable change

Implemented: improve status, approval quality visibility, bounded repair retries, research stability/provenance, and prior-session evidence budgeting. This feature authorizes no release or publication.

## Requirement and evidence summary

Requirements `REQ-001` through `REQ-008` have passing linked evidence records. Windows / Node 22.20.0 and Debian 12 / Node 22.23.3 `npm run check` passed (56 tests); package smoke passed on both systems (37 packed files, CLI init and repeat-init verified); `npm ci` and SDD doctor passed. `check --target complete` passed. No external release or publication occurred.

## Compatibility, configuration, security, and migration notes

v1 and v2 workflow records remain loadable. v2 migrates to v3 without losing sessions, check/review history, task phases, or old verification evidence; old verification is retained as historical and must be rechecked. Research results with missing or changed input fingerprints remain historical until explicitly refreshed. Existing retry ceiling, model allowlists, host permission flow, and provider-denied validation remain in force. Public release gates owned by `production-readiness-public-release` remain open.

## Limitations

The Debian 12 VPS package checks passed on Node 22.23.3; exactly Node 22.14 remains untested. Local WSL returned `Wsl/E_ACCESSDENIED`. The Debian host has no OpenCode executable, and the local CLI reports v2.0.30, below the plugin's >=2.0.32 minimum, so real-host smoke for v2.0.32/latest supported v2 was not run. The fake-host suite and package smoke passed; they do not substitute for supported real-host smoke. No live provider canary, publication, or account changes are included.
