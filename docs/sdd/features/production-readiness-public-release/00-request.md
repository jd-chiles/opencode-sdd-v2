# Request: Production readiness and public release

Upgrade the local OpenCode SDD plugin MVP into a release candidate with evidence-bound verification, safe durable-state migration, comprehensive deterministic regression coverage, Linux and Windows CI, public package metadata, MIT licensing, onboarding documentation, and hardened release automation. Publication is the eventual goal, but no public repository or package is to be created or published until all release gates pass.

Release candidates: npm `opencode-v2-sdd-plugin`, GitHub `jd-chiles/opencode-sdd-v2`. Keep the earlier private plugin repository untouched. Stable target: 1.0.0. Initial production workspace and primary Linux target: Debian Linux; CI must exercise Debian. Ubuntu/WSL and Windows are additional intended compatibility targets; macOS is out of scope. Provider execution remains disabled until the owner separately approves a model and spend cap.
