# Debian validation evidence: SDD Cycle UX and Evidence Improvements

Target: Debian GNU/Linux 12 (bookworm) VPS, Node `v22.23.3`, npm `10.9.9`.

Validation ran in an isolated temporary directory on the VPS. The transferred archive contained only package metadata, source, tests, build/package scripts, packs, license, changelog, README, and `docs/roadmap.md`; it excluded Git metadata, local SDD state/evidence, credentials, installed dependencies, and build output. No installed plugin, provider configuration, or account state was changed.

- `npm ci`: passed; 273 packages added, 274 audited, 0 vulnerabilities. npm emitted deprecation warnings for transitive `node-domexception@1.0.0` and `glob@10.5.0` from `@opencode/plugin@2.0.32` dependencies; `npm ls glob node-domexception --all` confirmed their dependency paths.
- `npm run check`: passed; typecheck and build passed, 56 tests passed, 0 failed, 0 skipped.
- `npm run smoke:pack`: passed; `opencode-v2-sdd-plugin-0.2.0.tgz` contained 37 files, packaged CLI initialization passed, repeat initialization preserved existing files.
- OpenCode real-host smoke was not run: the Debian host has no `opencode` executable (`bash: line 1: opencode: command not found`). Provider calls remained disabled.

This validates the package and test suite on Debian 12 with a Node version above the package minimum. It does not establish OpenCode host compatibility or provider execution on Debian.
