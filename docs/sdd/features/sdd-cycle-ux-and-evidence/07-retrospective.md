# Retrospective: SDD Cycle UX and Evidence Improvements

The most important behavior found during implementation was that research provenance must be checked again when work resumes, not only immediately after the research session. A persisted execution checkpoint and a current-tree comparison now prevent stale research from admitting dependent work. Regression tests also caught that re-verification must be allowed after a task's previous verification failed, without replaying its builder.

The aggregate packet test confirms the 20,000-character bound applies across task and dependency sessions, while the approved contract remains separate. The package and full local suite pass, but Debian and supported OpenCode v2 host runs remain launch evidence gaps because this machine cannot start WSL and only has OpenCode v2.0.30.

Independent review caught an edge path where research provenance was not persisted before a review-only retry. Persisting it as soon as the worktree is confirmed stable lets the retry retain the original input identity; a regression test proves the research task remains current and its dependent can proceed. The scheduler test now checks that all research verification finishes before the first builder starts.
