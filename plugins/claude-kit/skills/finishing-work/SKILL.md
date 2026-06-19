---
name: finishing-work
description: "Completion pass for a finished effort. Use when all sections of a plan in docs/plans/ are implemented, or Scott says wrap up, finish, close out, or hand off."
---

# Finishing Work

An effort is not done when the last section compiles. It is done when behavior is verified, security is reviewed, documentation matches reality, and the plan doc is closed. Run these steps in order; steps 2 to 4 may be dispatched in parallel after step 1 passes.

When per-section reviews already cleared parts of the changeset, tell the finishing reviewers what those passes covered and what has changed since, so they spend their budget on cross-section cohesion and on deltas rather than re-deep-reviewing unchanged, already-cleared code. Eliminate true duplication, not coverage. For a small effort that had no meaningful per-section reviews (a few files, one short pass), a single combined adversarial and security pass is enough; do not manufacture separate passes for a handful of files.

## Steps

1. **QA verification.** Dispatch the `qa-verifier` agent with the spec path: full build, full test suite, and every acceptance criterion checked with evidence. Any FAIL: fix and re-run before proceeding. Do not rationalize a failing criterion as "close enough".

2. **Security review.** Dispatch the `security-reviewer` agent over the whole changeset (not just the last section). Critical findings block completion. Major findings: fix or present to Scott with the tradeoff.

3. **Final adversarial review.** Dispatch the `adversarial-reviewer` agent over the entire changeset against the spec. Per-section reviews catch local issues; this pass catches cross-section cohesion problems, leftover debris (dead code, stale TODOs, orphaned files), and spec items that fell through the cracks.

4. **Documentation curation.** Dispatch the `docs-curator` agent with the spec path. It updates the project's docs/ from the as-built code and returns a Drift Report. **Present every drift item to Scott for adjudication; never silently reconcile.** Drift is signal: either the docs were wrong, the spec was wrong, or the implementation diverged from his mental model. He decides which.

5. **Close and archive the plan doc.** Set `Status: Complete` and append a final Chapter summarizing the effort, the review outcomes, and the drift adjudications. Then invoke the `curating-docs` skill to finish the lifecycle: `git mv` the plan from `docs/plans/` into `docs/archive/` (history preserved, Chapters intact), act on any cross-reference gaps the docs-curator flagged, prune `docs/backlog.md` of items this effort completed into the quarter's archive snapshot, and refresh the `docs/README.md` index. A plan is not closed until it has left `docs/plans/`.

6. **Apply the commit model:**
   - **Review-Only:** present a consolidated walkthrough, every changed file, what changed and why, organized by section, with a diff summary (the staged changes are the review surface). Then stop; Scott reviews before anything is committed.
   - **Branch-and-PR:** verify the branch builds and tests green, update from origin and surface any sibling-session conflicts for resolution, push the branch, and open the pull request via host detection (GitHub `gh pr create`, Azure DevOps Git `az repos pr create`, or, when no CLI or auth is present, push and surface the "create a pull request" URL the host prints). Title, a by-section summary, and the test evidence go in the PR. Then present the options: merge, keep the branch for iteration, or discard. Never merge without Scott's explicit choice; on his merge, offer the teardown below.
   - **Commit-and-Push:** if the session ran directly in the main checkout, the section commits already landed, so confirm pushed. If concurrency put the session in a worktree on a feature branch: update from origin (surfacing conflicts rather than failing), merge to main, push, then **tear down: remove this session's worktree and delete its branch local and remote**. Teardown touches only the branch and worktree this session created, is reversible (the commits are already in main), and is named in the close-out.

7. **Bank the learnings.** Anything durable discovered during the effort (build quirks, conventions, gotchas, environmental facts) belongs in auto memory, not the plan doc. Save it now, while it is fresh.

8. **Kaizen check.** First make sure any kit friction from this effort (captured along the way, or a Chapter Surprise that traced to the kit) is in the kaizen inbox. Then offer a kaizen pass in one line only if the inbox has pending items; on a clean effort the inbox is empty and you say nothing. The predicate, not your read of the session, gates the offer.
