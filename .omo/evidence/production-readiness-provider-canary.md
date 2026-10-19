# Production readiness provider canary

Date: 2026-10-19  
Host: Windows workspace, OpenCode `2.0.32` executable  
Authorized model: `opencode-go/deepseek-v4.1-flash`  
Spend boundary: included OpenCode Go quota only; no Zen Balance or top-ups

## Scope and isolation

The owner authorized one bounded canary using the selected model and included Go quota only. The CLI reported a stored OpenCode Go integration through `opencode auth list`; no credentials were displayed or exported. The canary used a temporary disposable directory under the workspace with an attached README containing a single test value. The command denied all tool permissions and requested only an exact text response. The temporary directory was removed after the attempt.

## Observed result

The only attempt was:

```text
opencode run --standalone --model opencode-go/deepseek-v4.1-flash --format json --title "SDD included-quota provider canary" --file README.md "Return the exact Canary value from the attached README text, and nothing else. Do not call tools or modify files."
```

OpenCode `2.0.32` returned:

```text
provider.no-route: Model unavailable: opencode-go/deepseek-v4.1-flash
```

At 2026-10-19 17:56 UTC, the public OpenCode status page reported the Go Models service as operational, while listing several earlier Go incidents that day. This does not identify whether the failed route was model-specific, account-specific, or transient; no cause is confirmed. See the [OpenCode status page](https://status.opencode.ai/).

A later read-only check under the same isolated OpenCode config still listed `opencode-go/deepseek-v4.1-flash`, and `opencode auth list` still showed the OpenCode Go integration as stored. This rules out a missing local model-catalog entry or missing stored Go credential as the obvious cause, but does not validate subscription entitlement or upstream routing. No provider call was made during this diagnosis.

No model response was produced by the first attempt. The CLI did not report token usage or billing, so this record makes no claim about whether it was billed. The owner later authorized one same-model retry, still limited to included Go quota with no balance or top-ups. Its first local startup failed before the provider because OpenCode could not open its default log file (`EPERM`). A second invocation outside the sandbox returned no visible stdout/stderr or exit status. Provider acceptance, model response, and billing outcome are indeterminate. The authorization is consumed; no further provider request will be made. The disposable project was removed and account settings were not changed. The canary gate remains open and this retry does not count as a pass.
