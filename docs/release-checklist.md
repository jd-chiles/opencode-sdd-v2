# Stable release checklist

Complete this file in the release commit before setting `RELEASE_GATES_PASSED=true`. Link exact run IDs, logs, registry metadata, and release artifacts; do not use planned workflow configuration as evidence of an executed check. Redact secrets from linked evidence. Preserve this signed record with the tag.

## Release identity

- Package/version: `opencode-v2-sdd-plugin@1.0.0`
- GitHub repository: `jd-chiles/opencode-sdd-v2`
- Release tag and commit: TBD
- Checklist status: **Not completed**

## Ownership and account controls

- [ ] Confirm the repository is public, owned by the publishing account, and separate from the earlier private plugin repository.
- [ ] Confirm the npm package name is available and owned by the same publishing account.
- [ ] Configure npm Trusted Publishing for the exact repository and `.github/workflows/release.yml`; verify no long-lived npm publish token is used.
- [ ] Configure GitHub environment `npm-production` with required human reviewers and tag/release restrictions; verify the approval is audit-logged.
- [ ] Review the `RELEASE_GATES_PASSED` repository variable owner and process; leave it unset until this checklist is signed.
- Initial public-source CI (not release-commit evidence): [run 39302133628](https://github.com/jd-chiles/opencode-sdd-v2/actions/runs/39302133628), also recorded in `.omo/evidence/production-readiness-github-ci.md`.
- Release-commit evidence links: TBD

## Source, tests, and compatibility

- [ ] Review the final public source and `npm pack --dry-run --json`; confirm only intended files are included, with MIT license and release notes.
- [ ] Record `npm ci`, `npm audit --audit-level=moderate`, `npm run check`, `npm run smoke:pack`, and clean-consumer install results.
- [ ] Record successful Debian 12 and Windows GitHub Actions jobs on Node >=22.14.
- [ ] Record provider-denied host smoke for OpenCode 2.0.32 and the exact latest supported v2 version on Debian 12 and Windows.
- [ ] Record the release-freeze OpenCode version resolution and package executable layout.
- Evidence links: TBD

## Verification and provider gate

- [ ] Run `python .sdd/bin/agentic_sdd.py doctor .` and `python .sdd/bin/agentic_sdd.py check . production-readiness-public-release --target complete` on the exact release commit; confirm full-worktree evidence is current.
- [x] Complete the owner-approved disposable-project provider canary. Record exact model, included-quota/spend boundary, tool permissions, observed response, and usage/billing if reported. Evidence: `.omo/evidence/production-readiness-provider-canary.md` (DeepSeek Flash returned the exact fixture value on OpenCode 2.0.30 with zero tool events; balance use was off; exact cost was not reported).
- [ ] Review outstanding vulnerabilities, deprecated packages, and Dependabot changes; document accepted risks and remediation.
- Evidence links: TBD

## Maintainer approval

I confirm the evidence above refers to the exact tag and commit, every required gate passed, and the `npm-production` protection is active. I authorize enabling `RELEASE_GATES_PASSED=true` for this release.

- Maintainer identity: TBD
- Approval date/time (UTC): TBD
- Tag and commit SHA: TBD
- Approval/evidence link: TBD

## Post-publication verification

- [ ] Confirm the GitHub release/tag points to the approved commit.
- [ ] Confirm npm lists exactly `opencode-v2-sdd-plugin@1.0.0` and provenance/signature links to the expected workflow and repository.
- [ ] Install using the documented OpenCode plugin command and exercise project bootstrap in a disposable consumer project.
- [ ] Record results and restore `RELEASE_GATES_PASSED` to its default unset state if the release process requires it.
- Evidence links: TBD
