# Verification strategy
Status: Baseline
Required: npm run typecheck; npm test; npm pack --dry-run; packed CLI fixture; python .sdd/bin/agentic_sdd.py doctor .; completion gates; git diff --check. Tests use isolated directories and fake host sessions with no network. Exercise contract validation, approval invalidation, concurrency, retry exhaustion, blocked dependencies, check/review failures, restart recovery, native calls and initializer preservation/symlink refusal. Live OpenCode/provider smoke remains opt-in and separately reported.
