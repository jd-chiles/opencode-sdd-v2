# Retrospective: Production readiness and public release

The prior task phase alone was not sufficient to describe evidence currency: durable verification must include the exact content state examined, and status must recompute that state before describing evidence as current. Release preparation also needs to separate locally provable readiness from account, provider, and publication gates that require later owner action.

The Debian 12 release run demonstrated why host compatibility must execute the actual installed package, not rely on workflow configuration. `@opencode/cli@2.0.32` exposes an ELF binary under the filename `bin/opencode.exe` on Linux, and the Windows npm script wrapper altered a path containing spaces. Direct Node invocation with the declared package path worked on both platforms. The release docs now distinguish the observed local matrix from the still-unrun GitHub Actions workflow and account-specific gates.
