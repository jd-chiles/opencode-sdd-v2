# Current Debian 12 validation

Date: 2026-10-19  
Host: Debian 12 VPS  
Runtime: Node v22.23.3, npm 10.9.9

## Scope

Transferred a narrow source archive containing the package manifests, source, tests, package assets, scripts, documentation, and GitHub workflows to a new temporary directory on the VPS. The archive excluded Git metadata, credentials, workspace settings, local dependency caches, and unrelated state. `npm ci`, full package checks, and package smoke were run against that copy. The remote directory and archive were removed by an exit trap after execution; the local transfer archive was also removed.

## Results

- `npm ci`: passed; 273 packages added, 274 audited, 0 vulnerabilities. npm emitted deprecation notices for `node-domexception@1.0.0` and `glob@10.5.0`.
- `npm audit --audit-level=moderate`: passed; 0 vulnerabilities.
- `npm run check`: passed; typecheck and build succeeded, 58 tests passed, 0 failed, 0 skipped. This includes the executable-mode fingerprint test and the CI/release workflow-contract test.
- `npm audit --omit=dev --audit-level=moderate`: passed; 0 production dependency vulnerabilities.
- `npm run smoke:pack`: passed; 37 package files, packed CLI initialization passed, repeat initialization preserved edits.

This verifies the current source snapshot on Debian 12. It does not represent a GitHub Actions run, tagged release, provider canary, or publication.
