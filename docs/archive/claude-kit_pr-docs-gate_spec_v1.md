# PR Docs Gate

Status: Complete
Commit Model: Review-Only
Created: 2026-06-23

## Goal

In Branch-and-PR and Commit-and-Push efforts, the documentation work (drift curation, plan archival, backlog prune, index refresh) ships in the same PR as the code, never as a follow-up. `finishing-work` commits the docs work into the branch before the PR is opened, and a deterministic guard refuses to create the PR while `docs/` changes are uncommitted. Material drift that looks like a mistake stops for adjudication before the PR; benign doc-only reconciliation commits without a stop, so long autonomous `/goal` runs flow through clean efforts uninterrupted and pause only on genuine problems.

## Approach

Root cause: `finishing-work` orders docs curation (step 4) and plan archival (step 5) before the PR (step 6), but step 6 never commits those changes into the branch. The section commits land during `executing-work`, so the branch looks done from the code side; the curator's edits, the `git mv` archival, the backlog prune, and the index refresh strand as uncommitted changes, and the push ships code without docs. NEO's deployment control (neither author releases their own PR) makes a follow-up docs PR a governance dead-end, so the docs must ride in the one authored PR.

The fix is two layers, matching the docs-write-guard pattern.

The routing layer, in `finishing-work`: after curation and archival, commit the docs work to the branch as a dedicated commit, then open the PR. The PR is gated on "plan archived (left `docs/plans/`) and `docs/` changes committed," written as a conditional plus a short prohibition and red-flags ("open the PR, clean docs after"; "docs as a follow-up PR"), because this is a knows-the-rule-skips-it-under-shipping-pressure failure. The archival summary and the drift report go into the PR description. The same commit-before-push discipline applies to Commit-and-Push.

The drift fast-path: most efforts have no material drift, and benign drift is just the docs now reflecting a deliberate as-built choice. That commits without a stop and is noted in the PR for awareness. A drift item that looks like a mistake (the code may be wrong) is a true blocker per the autonomy contract: stop, present it, take the decision, fold in the edits and any code fix, then continue to the PR. To make this mechanical rather than a prose judgment, the `docs-curator` drift report tags each item `Class: mistake | deviation`, and `finishing-work` stops before the PR only on `mistake` items.

The teeth, a `PreToolUse` guard: block the PR-creation command (`gh pr create`, `az repos pr create`) when `git status` shows uncommitted changes under `docs/`. Fail open on any error.

## Sections of Work

### 1. finishing-work sequencing, gate, and drift fast-path
Model: fable
Restructure close-out so the docs work is committed into the branch before the PR. After curate + archive, commit the docs work (a dedicated docs commit) for Branch-and-PR and Commit-and-Push. Gate the PR / final push: do not proceed until the plan has left `docs/plans/` and `git` shows no uncommitted `docs/` changes; state it as a conditional with a prohibition and red-flags. Implement the fast-path: benign `deviation` drift commits and is noted in the PR description; a `mistake` drift item stops for adjudication before the PR, then continues. Put the archival summary and drift report into the PR description. Also update `docs-curator` to tag each drift item `Class: mistake | deviation` so the gate is mechanical.
Acceptance: the skill makes committing-docs-into-the-branch an explicit precondition of the PR; a `deviation`-only effort does not stop; a `mistake` item stops before the PR; the SoD rationale and the fast-path are stated; the docs-curator report carries the per-item class.

### 2. PreToolUse PR guard
Model: fable
New `hooks/pr-docs-guard.js`, registered under `PreToolUse` for `Bash`. When the command creates a PR (`gh pr create`, `az repos pr create`), run `git status --porcelain -- docs` in `payload.cwd`; if it shows any uncommitted or untracked `docs/` change, deny (exit code 2) with a reason to commit the docs work into the branch first. Allow every non-PR command and every clean case. Fail open on any error (no cwd, git missing, not a repo, timeout, parse failure). Kept separate from `docs-write-guard.js`: that guard scopes to non-curator subagents writing `docs/`; this one applies to anyone running the PR command, a different subject and mechanism.
Acceptance: `gh pr create` with dirty `docs/` denies; with clean `docs/` allows; `az repos pr create` behaves the same; a non-PR Bash command allows; a malformed payload or a git failure exits 0.

### 3. Verification
Model: fable
`node --check` the guard; fixtures (PR command + dirty docs deny / clean docs allow / non-PR command allow / not-a-git-repo allow / malformed allow); confirm the `finishing-work` and `docs-curator` text changes via authoritative read; confirm `hooks.json` parses with the second `PreToolUse` entry.
Acceptance: every fixture behaves; the guard fails open on bad input; `hooks.json` is valid.

## Out of Scope
- The merge/release itself. Scott releases; the kit never merges. The separation-of-duties is a constraint we design around, not something the kit enforces.
- Review-Only efforts. There is no PR; the staged diff is the review surface, and the existing close-out already curates docs there.
- Blocking the branch push. The push is frequent and low-stakes; the gate is on PR creation, the deliverable boundary. The no-CLI URL-fallback path has no command to intercept, so the `finishing-work` gate covers it.

## Open Questions
- None outstanding. Decided with Scott on 2026-06-23: adjudicate material drift before the PR with a benign-drift fast-path (clean and `deviation`-only efforts proceed without a stop), enforced by wording plus the `PreToolUse` guard.

## Related
Complements `claude-kit_docs-lifecycle_spec_v1.md` (the library lifecycle this enforces at the PR boundary) and `claude-kit_docs-write-guard_spec_v1.md` (the same `PreToolUse`-guard pattern, a different command and subject).

## Chapters

### Chapter 1 - 2026-06-23
Completed: Section 1, finishing-work sequencing/gate/fast-path plus docs-curator classification.
Implemented By: main session (fable).
Decisions / Surprises: `finishing-work` step 6 now makes "commit the docs work before any push or PR" explicit, gated on plan-archived plus clean `docs/`, with a prohibition and red-flags against stranding docs and the separation-of-duties rationale named inline. Step 4 implements the fast-path: `docs-curator` tags each drift item `Class: mistake | deviation`; only a `mistake` stops the run before the PR, a `deviation` rides into the PR for awareness. The PR description carries the archival summary and the deviation drift. `docs-curator`'s output format gained the `Class` field, and its prose makes the class load-bearing rather than cosmetic.
Review Findings: text changes confirmed via authoritative read.
Next: Section 2.
Commit Model: Review-Only.

### Chapter 2 - 2026-06-23
Completed: Section 2, the PreToolUse PR guard.
Implemented By: main session (fable).
Decisions / Surprises: New `pr-docs-guard.js`, kept separate from `docs-write-guard.js` because the subject differs (anyone running the PR command, versus non-curator subagents writing `docs/`). It detects `gh`/`az pr create`, runs `git status --porcelain -- docs` in `payload.cwd`, denies (exit 2) on uncommitted `docs/` changes, and fails open on any error (not a repo, git missing, timeout, parse failure). Registered as a second `PreToolUse` entry with matcher `Bash`.
Review Findings: verification in Chapter 3.
Next: Section 3.
Commit Model: Review-Only.

### Chapter 3 - 2026-06-23
Completed: Section 3, verification.
Implemented By: main session (fable).
Decisions / Surprises: `node --check` clean. Against a real git fixture the guard denies `gh` and `az pr create` on both modified and untracked `docs/` changes, allows the clean and the committed-again cases, allows a non-PR command, and fails open for a non-repo cwd and for malformed and empty payloads. `hooks.json` confirmed valid with both `PreToolUse` entries; `finishing-work` step 6 and the `docs-curator` changes confirmed by authoritative read.
Next: Scott reviews and commits. Status stays In Progress until he accepts; the close-out then archives this plan and, fittingly, ships its own docs in the PR under the new gate.
Commit Model: Review-Only.
