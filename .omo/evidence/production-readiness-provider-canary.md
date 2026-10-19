# Production readiness provider canary

Date: 2026-10-19  
Host: Windows, OpenCode `2.0.30` executable for the successful attempt
Authorized model: `opencode-go/deepseek-v4.1-flash`  
Spend boundary: included OpenCode Go quota only; no Zen Balance or top-ups

## Scope and isolation

The owner authorized bounded canary attempts using the selected model and included Go quota only. The CLI reported a stored OpenCode Go integration through `opencode auth list`; no credentials were displayed or exported. The successful canary used an isolated temporary disposable project with an attached README containing a single test value. Its `sdd-canary` agent denied every tool permission and the prompt requested only an exact text response. After the attempt, no files remained in the project directory. Windows reported that the empty directory was still held open and refused deletion; no process was terminated, and temporary-directory cleanup remains outstanding.

## Observed result

The first attempt was:

```text
opencode run --standalone --model opencode-go/deepseek-v4.1-flash --format json --title "SDD included-quota provider canary" --file README.md "Return the exact Canary value from the attached README text, and nothing else. Do not call tools or modify files."
```

OpenCode `2.0.32` returned:

```text
provider.no-route: Model unavailable: opencode-go/deepseek-v4.1-flash
```

At 2026-10-19 17:56 UTC, the public OpenCode status page reported the Go Models service as operational, while listing several earlier Go incidents that day. This does not identify whether the failed route was model-specific, account-specific, or transient; no cause is confirmed. See the [OpenCode status page](https://status.opencode.ai/).

A later read-only check under the same isolated OpenCode config still listed `opencode-go/deepseek-v4.1-flash`, and `opencode auth list` still showed the OpenCode Go integration as stored. This rules out a missing local model-catalog entry or missing stored Go credential as the obvious cause, but does not validate subscription entitlement or upstream routing. No provider call was made during this diagnosis.

The first attempt produced no model response. The CLI did not report token usage or billing. A later authorized retry had an initial startup failure (`EPERM` opening OpenCode's default log file); its next invocation returned no visible output or exit status, so that attempt remains indeterminate.

The owner then authorized one new attempt on the same model, limited to included Go quota with no balance or top-ups. OpenCode `2.0.30` completed this exact command once against the disposable project:

```text
opencode --log-level error run --standalone --model opencode-go/deepseek-v4.1-flash --agent sdd-canary --format json --title "SDD included-quota provider canary 2026-10-19" --file README.md "Return the exact Canary value from the attached README text, and nothing else. Do not call tools or modify files."
```

Observed result: exit code `0`, response `cedar-742-bridge` exactly matched the fixture, and the JSON event stream contained zero tool events. The OpenCode Go console showed its “Use credit” switch off before and after the request; the displayed rolling-use percentage moved from 20% to 21% (weekly remained 42%, monthly 21%). This is consistent with the request using included Go quota while balance use was disabled. The CLI reported no token count or cost, so exact billing is unreported. No account setting was changed. This single newly authorized attempt passed the bounded model-response/tool-isolation canary. That authorization is consumed; no further provider request will be made without new authorization.
