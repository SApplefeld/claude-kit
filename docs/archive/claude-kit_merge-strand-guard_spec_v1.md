# Merge Strand Guard

Status: Complete
Commit Model: Review-Only
Created: 2026-06-23

## Goal

In Branch-and-PR, durable records (Chapters, decision records, the register, the close-out) never strand off the integration branch. Records ride the change into the same merge; the branch is treated as frozen the moment it is up for merge; anything decided after that goes in a separate doc PR against the current integration branch; a merged-gated strand-check catches anything that slips; and a `PreToolUse` guard blocks a push to a branch whose PR is already merged, so "pushed" can never be mistaken for "landed."

## Approach

Root cause (Scott's analysis): the agent conflates "pushed to the branch" with "landed on the trunk." In Branch-and-PR it keeps committing and pushing to one feature branch as work and decisions evolve, but once the human merges the PR (often a fast bot merge), every later push lands on a branch that no longer feeds the integration branch, with no signal to the agent. Documentation is the systematic victim because the kit's own rituals generate the late writes: per-section Chapters, the close-out, the standing "record every decision in the plan doc" rule, and decisions the human answers after the PR is open. It is structural: one branch carries two opposite lifecycles, a change that wants to freeze and merge fast and a record that keeps updating through close-out, so one branch plus a fast merge is a guaranteed race.

The fix is five moves, the first four as hard gates (per writing-skills, prose advice loses under "high autonomy, finish it now"; only a gate changes behavior) and the fifth as a deterministic backstop.

1. Land the record with the change. The merge request is the last action of the effort: every section Chapter and every close-out record is committed before the branch goes up, so it rides the same merge. Extends pr-docs-gate (docs before the PR) to the records.
2. Freeze at merge-request, decouple late records. A PR branch is frozen the moment it is up for merge. Anything decided afterward (post-review decisions, a late close-out) is never pushed to that branch; it goes in a separate doc PR opened last against the current integration branch. Under the separation-of-duties rule the agent authors that PR and Scott releases it, so Part 1 must front-load aggressively to keep the late doc PR rare.
3. Merged-gated strand-check. After a merge, `git fetch` then `git log origin/<integration>..origin/<branch>`; any commit there is stranded post-merge work, recovered via a new doc PR, never by reopening the merged branch. Keyed on the merge having happened, because the diff is non-empty for a normal in-progress branch too.
4. A turn-end verify gate. Before ending a turn in a Branch-and-PR effort, verify by diff that every record written this turn is on the integration branch (or in an open doc PR against it). A record that lives only on a frozen branch is stranded and must be recovered before the turn ends.
5. A `PreToolUse` push-guard. On `git push`, ask the host whether the target branch's PR is `MERGED`; if so, block. The only thing that does not depend on the agent remembering.

## Sections of Work

### 1. Land records with the change; freeze the branch at merge-request
Model: fable
`executing-work`: on a feature branch, a section's Chapter is committed in the same commit series as the section, before moving on. `finishing-work`: all close-out records (final Chapter, register, drift adjudications) are committed before the merge is requested, and the merge request is the effort's last action. State the principle as a hard rule with red-flags ("pushed is not merged"; "I'll commit the Chapter after the PR"; "just one more doc push to the branch"). Anything decided after the PR is up goes in a separate doc PR against the current integration branch, never pushed to the up or merged branch. Add the turn-end verify gate from Approach Part 4.
Acceptance: `executing-work` commits the Chapter with its section; `finishing-work` commits all records before requesting merge and routes post-merge-request records to a separate doc PR; the freeze rule and the turn-end diff gate read as gates, not advice.

### 2. Merged-gated strand-check
Model: fable
`finishing-work`: after a merge in a Branch-and-PR effort (in-session, or on the next session when the merge is detected), run `git fetch` then `git log origin/<integration>..origin/<branch>`; recover any commits found via a new doc PR against the integration branch. `branch-hygiene`: in the report, a branch that is ahead of the integration ref AND whose PR has merged is flagged "likely stranded post-merge commits, recover before deleting," keyed on merged-state so an in-progress branch is not false-flagged.
Acceptance: a branch with post-merge commits is caught by the diff and reported; an in-progress (ahead but unmerged) branch is not flagged as stranded.

### 3. PreToolUse merged-branch push-guard
Model: fable
New `hooks/merged-pr-push-guard.js`, registered under `PreToolUse` for `Bash`. On a `git push`: determine the target branch (explicit in the command, else the current branch); skip the integration and default branches; ask the host whether that branch's PR is `MERGED` (`gh pr view <branch> --json state` for GitHub, `az repos pr list --source-branch <branch> --status completed` for Azure DevOps, host detected from the remote URL or CLI availability). If `MERGED`, deny (exit code 2) with "this PR is merged; the branch is frozen, open a doc PR against the integration branch instead." Allow open, none, or unknown. Fail-open on any error (no CLI, not authenticated, timeout, parse failure), with `GIT_TERMINAL_PROMPT=0` and a bounded timeout.
Acceptance: a push to a branch with a `MERGED` PR is denied with the reason; a push to an open-PR or brand-new branch is allowed; a push to the integration/default branch is allowed; missing CLI, a failed query, or a malformed payload exits 0 (allow).

### 4. Verification
Model: fable
`node --check` the guard. Test its branch-parsing and decision against a stubbed host CLI (a `gh`/`az` shim on PATH returning canned states, since the real CLIs are not in the sandbox): merged denies, open allows, none allows, query-fails allows, integration branch allows, malformed allows. Exercise the strand-check `git log origin/<integration>..origin/<branch>` against a git fixture (a merged branch plus a post-merge commit is non-empty; a cleanly-merged branch is empty). Confirm `hooks.json` parses with the new entry.
Acceptance: every guard fixture behaves; the strand-check detects post-merge commits and not in-progress ones; fail-open holds; `hooks.json` is valid.

## Out of Scope
- Auto-recovering stranded commits. The fix detects them and routes to a doc PR; Scott releases it.
- Commit-and-Push, where pushes land on the trunk directly and there is no frozen-branch race.
- Squash-merge repos for the ancestry side of the strand-check (the diff would false-positive). NEO uses regular merges.

## Open Questions
- The exact PR-state query for NEO's host (GitHub `gh` vs Azure DevOps `az`). The guard detects and handles both and fails open; confirm the `az` invocation against the real host at review.
- Per-push latency of the host query. If it proves heavy, scope the query to feature-branch pushes only and cache the merged-state per session. Decided at build only if the simple per-push query is too slow.

## Related
Builds on `claude-kit_pr-docs-gate_spec_v1.md` (docs committed before the PR) and `claude-kit_branch-hygiene_spec_v1.md` (the integration-branch reasoning and the reaper report). Those kept docs landing in the PR and swept merged branches; this closes the remaining "pushed is not merged" gap, where records written after the branch froze never reach the trunk.

## Chapters

### Chapter 1 - 2026-06-23
Completed: Section 1, the ordering, freeze, and late-record gates.
Implemented By: main session (fable).
Decisions / Surprises: Put the core principle and the turn-end verify gate in `home/CLAUDE.md` (always loaded), because the failure can happen in any post-PR turn, not only during finishing-work. `executing-work` now commits a section's Chapter with the section. `finishing-work`'s commit-model step extends the docs-before-PR gate to all durable records: the merge request is the effort's last action, the branch is frozen at merge-request, and late records go to a separate doc PR against the integration branch (under the separation-of-duties rule, Claude authors and Scott releases). Phrased as gates with red-flags, per writing-skills.
Review Findings: gate text confirmed via authoritative read.
Next: Section 2.
Commit Model: Review-Only.

### Chapter 2 - 2026-06-23
Completed: Section 2, the merged-gated strand-check.
Implemented By: main session (fable).
Decisions / Surprises: `finishing-work` runs `git fetch` then `git log origin/<integration>..origin/<branch>` after any merge and recovers stranded commits via a new doc PR. `branch-hygiene`'s report flags an ahead-and-merged branch as a likely strand. Keyed on merged-state so an in-progress branch is not false-flagged.
Review Findings: the strand-check command verified against a git fixture (0 right after merge, 1 after a post-merge push).
Next: Section 3.
Commit Model: Review-Only.

### Chapter 3 - 2026-06-23
Completed: Section 3, the PreToolUse push-guard.
Implemented By: main session (fable).
Decisions / Surprises: New `merged-pr-push-guard.js`: it parses the target branch from a `git push` (segment-start detection so a quoted mention is ignored), skips integration branches, asks the host (gh for GitHub, az for Azure DevOps) whether the branch's PR is MERGED, and denies (exit 2) if so. Fails open on anything it cannot confirm (no CLI, not authenticated, no PR, error, timeout). Registered as a third `PreToolUse` Bash entry.
Review Findings: in Chapter 4.
Next: Section 4.
Commit Model: Review-Only.

### Chapter 4 - 2026-06-23
Completed: Section 4, verification.
Implemented By: main session (fable).
Decisions / Surprises: Tested the guard with stub gh/az CLIs on PATH: a merged PR blocks (exit 2) on both hosts; open, no-PR, integration-branch, non-push, and quoted-mention cases all allow; a no-arg push resolves the current branch; fail-open holds when the CLI is absent and on a malformed payload. The strand-check fixture showed 0 stranded right after a merge and 1 after a post-merge push. `hooks.json` confirmed valid with the third `PreToolUse` entry; the `finishing-work` freeze gate confirmed by read.
Review Findings: all green.
Next: Scott reviews the diff and pushes to origin. Open follow-up in the backlog: confirm the `az` invocation on the real host (best-effort, fails open if wrong) and watch per-push latency.
Commit Model: Review-Only.
