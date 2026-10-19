# Public GitHub CI evidence

Date: 2026-10-19
Repository: https://github.com/jd-chiles/opencode-sdd-v2
Commit: `ef0af149e5e2f24cd905a154cbe8277ea523cc9c`
Workflow run: https://github.com/jd-chiles/opencode-sdd-v2/actions/runs/39302133628

The first CI run for the public source commit completed successfully on both matrix jobs:

- Windows / Node 22.14: job `118229773066`, conclusion `success`.
- Debian 12 / Node 22.14: job `118229773216`, conclusion `success`; container image `node:22.14-bookworm`, Node `22.14.0`.

Both jobs completed dependency installation, `npm run check` (58 tests), package smoke, Agentic SDD `doctor` and `check --target verifying`, clean-consumer installation, and provider-denied host smoke for the minimum and latest `@opencode/cli` v2 aliases. Debian audit passed with no moderate-or-higher findings. Package smoke reported 37 files with init and repeat-init checks passing. Both host aliases resolved to OpenCode `2.0.32`; each smoke registered 8 commands, 7 agents and 1 skill, and made zero model requests.

This verifies the CI matrix and smoke workflows for commit `ef0af14`. It does not verify a live provider route, npm identity/name ownership, npm trusted publishing, protected environment reviewers, an npm release, provenance, or a post-publication installation.

The readiness-report update was also validated on commit `c74b80ffe036a49a37cb5712e98158a93288ef30` by [workflow run 39302877661](https://github.com/jd-chiles/opencode-sdd-v2/actions/runs/39302877661). Its Debian 12 and Windows jobs both completed successfully, including all 58 tests, package smoke, the SDD verifying gate, clean-consumer install, and provider-denied minimum/latest v2 host smoke. This second run validates the updated documentation/evidence tree; it does not close the external release gates listed above.
