# Docs Write Guard

Status: In Progress
Commit Model: Review-Only
Created: 2026-06-19

## Goal

A deterministic guard keeps subagent reports and other scratch out of `docs/`, enforcing the curated-library invariant mechanically instead of by wording alone. When this is done, a non-curator subagent that tries to write under `docs/` is denied at the tool boundary and told to use `.kit/`, and a Stop-time scan catches any scratch file that slipped through an exotic write path before it can be committed. This complements the `executing-work` routing wording already shipped: the wording steers the common case, the guard is the deterministic backstop.

## Approach

The kit's access model already names exactly two writers that curate `docs/`: the main session and the `docs-curator` agent. Reviewers, qa, and implementers have no business writing there. The guard encodes that invariant rather than matching report filenames, so it does not play whack-a-mole as the orchestrator invents new scratch paths (it improvised both `docs/reviews/` and `docs/plans/_impl_reports/` in the observed failure).

Mechanism: a `PreToolUse` hook. Plugin `PreToolUse` and `PostToolUse` hooks fire for tool calls made inside subagents, and the payload carries the subagent identity, so the guard can key on it. The rule: if the call comes from a subagent that is not `docs-curator`, and it targets a path under `docs/`, deny it with a reason pointing at `.kit/`.

Coverage and its limit: a `Write`, `Edit`, or `MultiEdit` call is matched exactly by `file_path`. The reviewers and qa have no Write tool, so they create a file with a shell redirect; that is matched by inspecting the `Bash` command for a write into `docs/` (`>`, `>>`, `tee`, a heredoc), which is heuristic and will miss exotic writes (a python one-liner, `sed -i`). The Stop-scan backstop covers those: extend the existing `stop-docs-hygiene.js` to also flag scratch-signature files found in `docs/` before commit.

Safety is non-negotiable for a blocking hook: the guard fails OPEN. Any parse error, unexpected payload shape, or internal exception exits 0 (allow), so a guard bug can never block legitimate work. The exact payload field for subagent identity is confirmed against a real invocation during execution and parsed defensively, the way the existing hooks already handle their inputs.

## Sections of Work

### 1. PreToolUse role guard
Model: fable
New `hooks/docs-write-guard.js`, registered in `hooks.json` under `PreToolUse` for `Write|Edit|MultiEdit` and for `Bash`. Deny (exit code 2 with a reason naming `.kit/`) when the caller is a subagent other than `docs-curator` and the target is under `docs/`. Write/Edit: resolve `file_path`. Bash: match a write-redirect into `docs/` in the command. Allow everything else. Fail open on any error.
Acceptance: a simulated reviewer write into `docs/` (via Write, and via a `cat > docs/...` Bash command) is denied with a `.kit/` reason; a `docs-curator` write into `docs/` is allowed; a main-session write into `docs/` is allowed; a write outside `docs/` is allowed; a malformed payload exits 0.

### 2. Stop-scan backstop
Model: fable
Extend `stop-docs-hygiene.js` to also scan `docs/` for scratch-signature files (for example a `docs/reviews/` directory, any `_impl_reports/` directory, and report names like `*_adversarial.md`, `*_security.md`, `*_qa.md`, `_rev_*`). If any are present, add a block reason to relocate them to `.kit/` or remove them before commit. Keep the existing completed-plan check, the loop guard, and fail-open.
Acceptance: a planted `docs/reviews/x.md` produces a block reason; a clean tree stays silent; the loop guard (`stop_hook_active`) still suppresses a second block.

### 3. Verification
Model: fable
`node --check` both hooks; run the Section 1 fixtures (reviewer / curator / main / outside / malformed) confirming exit codes and the deny reason; run the Section 2 fixtures; confirm `hooks.json` parses with the new matchers. Confirm fail-open with a malformed payload and a missing-field payload.
Acceptance: every fixture behaves as specified and both hooks exit 0 on bad input.

## Out of Scope
- Catching every exotic Bash write (python, `sed -i`); the Stop-scan is the backstop, not a completeness guarantee.
- Rewriting git history of reports already committed in other projects (Scott's call; declined).
- Re-editing the `executing-work` wording; it is already shipped and is the routing layer this guard enforces.

## Open Questions
- The exact `PreToolUse` payload field for subagent identity (expected `agent_type`, with main-session calls lacking it). Confirmed against a real invocation in Section 1 before the deny logic is trusted; until confirmed, the guard fails open.

## Related
Complements `claude-kit_docs-lifecycle_spec_v1.md`. That effort made `docs/` a curated library, added the `.kit/` scratch convention and `.gitignore`, and shipped the `executing-work` routing wording. This guard enforces that invariant mechanically.

## Chapters

### Chapter 1 - 2026-06-19
Completed: Section 1, the PreToolUse role guard.
Implemented By: main session (fable).
Decisions / Surprises: Keyed on the writer's role (a subagent whose type is not docs-curator) rather than on filenames, per the spec. Deny uses exit code 2 with a stderr reason (the reliable mechanism for built-in tools), and the guard fails open on any parse error or unidentifiable caller, so it can only ever block a positively-identified non-curator subagent. The agent-identity field is read defensively across `agent_type`/`subagent_type` variants; the docs confirm `agent_type`, but I could not trigger a live PreToolUse invocation in this environment, so the fail-open posture is what makes that safe. Registered under PreToolUse with matcher `Write|Edit|MultiEdit|Bash`.
Review Findings: Low-blast hook change, verified directly rather than via subagent review. Eleven fixtures pass.
Next: Section 2.
Commit Model: Review-Only.

### Chapter 2 - 2026-06-19
Completed: Section 2, the Stop-scan backstop.
Implemented By: main session (fable).
Decisions / Surprises: Extended `stop-docs-hygiene.js` with `findDocsScratch`, a bounded recursive walk of docs/ that flags scratch directories (reviews, _impl_reports) and report-named files (_adversarial, _security, _qa, _rev_). Patterns are deliberately conservative: verified that `docs/security-model.md` is NOT flagged (no leading underscore), so legitimate curated docs are safe. Kept the completed-plan check, the loop guard, and fail-open.
Review Findings: scratch / clean / completed / loop-guard fixtures all behave correctly.
Next: Section 3.
Commit Model: Review-Only.

### Chapter 3 - 2026-06-19
Completed: Section 3, verification.
Implemented By: main session (fable).
Decisions / Surprises: `node --check` on both hooks; 11 guard fixtures and 4 Stop fixtures pass; `hooks.json` confirmed valid with PreToolUse registered (authoritative file-tool read, since the shell mount lags on edited files). The guard ran against the real new file from the mount; the Stop hook was tested via an exact copy because the mount serves a stale copy of edited files.
Review Findings: All green.
Next: Scott reviews and commits. Status stays In Progress until he accepts; close-out then archives this plan.
Commit Model: Review-Only.

## Open after execution
- The live PreToolUse payload field for subagent identity is confirmed from the docs, not from a real invocation. The guard fails open until a real call confirms it, so the safe outcome if the field name differs is that the guard is inert (never a false block). Confirm on a real run, then trust the deny.
