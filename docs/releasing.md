# Release procedure

This repository is prepared for a stable **1.0.0** release, but the workflow must not be triggered until every release gate in [`production-readiness.md`](production-readiness.md) is satisfied and the version-controlled [`release-checklist.md`](release-checklist.md) is completed and signed for the exact release commit.

## Before the first public release

1. Confirm `jd-chiles/opencode-sdd-v2` is public and controlled by the publishing owner. The separate public repository now contains the initial source commit; do not reuse or modify the earlier private repository.
2. Confirm npm package `opencode-v2-sdd-plugin` is available and owned by the same publishing account. If either candidate name is unavailable, stop and choose a replacement before changing package identity.
3. Configure npm Trusted Publishing for the exact GitHub owner/repository and `.github/workflows/release.yml` workflow. Configure GitHub environment `npm-production` with required human reviewers and restrict tag/release permissions. Do not add a long-lived npm token. Attach evidence to [`release-checklist.md`](release-checklist.md); documentation alone does not prove account settings are active.
4. Verify the full CI matrix has passed on Debian and Windows, including provider-denied OpenCode 2.0.32 and latest supported v2 host smoke. The first matrix passed for `ef0af14`; repeat on the exact release commit and record the exact current v2 version exercised at release freeze.
5. Obtain explicit approval for a provider canary model and spend cap. Use a disposable project, record the bounded model/tool-call result, and clean up the fixture. A failed or unavailable model does not satisfy the gate; diagnose it and obtain renewed approval before another attempt.
6. Review public source and `npm pack --dry-run --json` inventory. Confirm MIT license and release notes. Ensure the latest full-worktree SDD verification is current and all checks pass on the final release tree.

## Publish and verify

After all gates pass and the checklist is signed, update `package.json`, lockfile, changelog and release evidence to 1.0.0, then create tag `v1.0.0`. Only then set `RELEASE_GATES_PASSED=true`. The release workflow checks that variable, exact stable version/tag, dependency audit, full test and package checks, host smoke, and complete SDD gate before `npm publish --provenance --access public`. The `npm-production` environment must require reviewer approval. The npm account must already have trusted publishing configured for this repository/workflow; GitHub Actions uses the OIDC identity rather than a stored publish token.

After publication, verify the GitHub tag/release, npm version, provenance/signature, and installation with:

```sh
opencode plugin add opencode-v2-sdd-plugin@1.0.0
npm exec --yes --package=opencode-v2-sdd-plugin@1.0.0 -- opencode-sdd init /path/to/your-project
```

Record actual output and supported platform versions. A successful publish job alone does not prove installation or provider compatibility.
