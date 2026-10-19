# Production readiness Debian 12 validation

Date: 2026-10-19  
Host: Debian GNU/Linux 12 (bookworm) VPS  
Runtime: Node `v22.23.3`, npm `10.9.9`  
Package: `opencode-v2-sdd-plugin@0.2.0`  
Tarball SHA-256: `0393CE8C1B791975B673908D237C0F514BBF3F9E660F0409E613E1ED4057566F`

## Isolation and scope

Validation ran under `/tmp/opencode-sdd-release-smoke-20261019-a1c47f`. The VPS received an allowlisted source archive and the built package tarball. The archive excluded `.git`, `.aws`, `.sdd`, `.omo`, local dependencies, and prior build output. Package dependencies were installed in temporary prefixes. The host-smoke harness created isolated OpenCode config/data/state/cache directories, denied `provider.use` globally and in its fixture project, and reported zero model requests. No installed plugin, provider configuration, credentials, or account state was changed.

## Commands and observed results

The Debian source-check commands ran from `/tmp/opencode-sdd-release-smoke-20261019-a1c47f/project`:

```sh
npm ci
npm run check
npm run smoke:pack
npm install --prefix /tmp/opencode-sdd-release-smoke-20261019-a1c47f/consumer /tmp/opencode-v2-sdd-plugin-0.2.0.tgz
npm install --prefix /tmp/opencode-sdd-release-smoke-20261019-a1c47f/opencode-2.0.32 @opencode/cli@2.0.32
npm run smoke:host -- /tmp/opencode-sdd-release-smoke-20261019-a1c47f/opencode-2.0.32/node_modules/@opencode/cli/bin/opencode.exe /tmp/opencode-sdd-release-smoke-20261019-a1c47f/consumer/node_modules/opencode-v2-sdd-plugin
npm install --prefix /tmp/opencode-sdd-release-smoke-20261019-a1c47f/opencode-latest @opencode/cli@2
npm run smoke:host -- /tmp/opencode-sdd-release-smoke-20261019-a1c47f/opencode-latest/node_modules/@opencode/cli/bin/opencode.exe /tmp/opencode-sdd-release-smoke-20261019-a1c47f/consumer/node_modules/opencode-v2-sdd-plugin
```

- `npm ci`: passed; 273 packages added, 274 audited, 0 vulnerabilities. npm emitted deprecation warnings for transitive `node-domexception@1.0.0` and `glob@10.5.0` from `@opencode/plugin@2.0.32` dependencies.
- `npm run check`: passed; typecheck/build passed and all 56 tests passed, 0 failed, 0 skipped.
- `npm run smoke:pack`: passed; 36 extracted package entries, packaged CLI initialization passed, repeat initialization preserved existing files.
- Built tarball `opencode-v2-sdd-plugin-0.2.0.tgz`: 37 files, 31,184 bytes; installed into a clean consumer prefix.
- OpenCode `@opencode/cli@2.0.32`: provider-denied host smoke passed; server `2.0.32`, 8 commands, 7 agents, 1 skill, `modelRequests: 0`.
- OpenCode `@opencode/cli@2`: npm resolved this alias to `2.0.32`; provider-denied host smoke passed with the same registration counts and zero model requests.

The first host-smoke invocation used the CI-configured Linux path `bin/opencode` and failed with `ENOENT`. Inspection of `@opencode/cli@2.0.32` showed its declared executable is `bin/opencode.exe`; `file` confirmed that path is an executable x86-64 ELF binary on Debian. The smoke passed when invoked with that actual path. `.github/workflows/ci.yml` now invokes the harness directly with Node on Debian and Windows to avoid npm script-shell path re-escaping. The GitHub Actions workflow has not yet run.

This proves Debian 12 package, test, and real-host registration behavior on Node `v22.23.3` for OpenCode `2.0.32`. It does not prove a CI run, a future release-freeze latest-v2 version, provider execution, package/repository ownership, trusted publishing, or publication readiness.
