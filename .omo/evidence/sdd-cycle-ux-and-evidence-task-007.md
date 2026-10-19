# TASK-007 evidence: final local verification and platform limits

- `npm run check`: passed on Windows / Node 22.20.0; typecheck, build, and all 56 tests passed.
- The final regression suite includes a research review-only retry provenance case and asserts all ready research verification completes before builders start.
- `npm run smoke:pack`: passed; package `opencode-v2-sdd-plugin-0.2.0.tgz`, 37 files, packed CLI init passed, repeat init preserved existing files.
- `npm ci`: passed earlier in this implementation; installed 273 packages, reported 0 vulnerabilities.
- Debian 12 / Node v22.23.3 on the selected VPS: `npm ci`, `npm run check` (56/56), and `npm run smoke:pack` (37 files) all passed in an isolated temporary project; details are in `.omo/evidence/sdd-cycle-ux-and-evidence-debian-validation.md`.
- `python .sdd/bin/agentic_sdd.py doctor .`: passed for OpenCode SDD.
- Final gate review: APPROVE; reviewer reproduced the full check, package smoke, doctor, and complete gate, and confirmed the release feature remains at `verifying` (`.omo/evidence/sdd-cycle-ux-and-evidence-gate-review.md`).
- Local WSL still could not be exercised: `wsl.exe -l -q` returned `Wsl/E_ACCESSDENIED`; Debian package validation was completed on the selected VPS instead. Node v22.23.3 was tested, not exactly v22.14.
- Real OpenCode v2 host smoke could not be exercised: the Debian host has no `opencode` executable, and the local CLI reports `v2.0.30`, below the plugin's `>=2.0.32 <3` support range. The unit/fake-host suite does not claim real-host compatibility.
- Provider use remained denied; no live-provider calls, publication, or account changes occurred.
