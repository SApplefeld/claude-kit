---
name: branch-hygiene
description: "Use to clean up local branches and worktrees left over after Branch-and-PR efforts, or when the SessionStart nudge flags reapable OR stranded branches. Triggers: branch cleanup, reap or prune merged branches, recover stranded post-merge commits, leftover or stale local branches, worktree cleanup, too many local branches sitting around."
---

# Branch Hygiene

Local branches and worktrees from finished Branch-and-PR efforts pile up, because the merge lands on the platform after the session ends, so finishing-work never reaches its teardown. This sweeps the ones whose work has already landed and leaves everything else alone. It auto-removes only what it can verify is merged, and never force-deletes an unmerged branch or a dirty worktree.

Two conditions bring you here, and the SessionStart nudge flags both: **reapable** branches (merged in, safe to sweep) and **stranded** branches (the remote is gone because the PR merged, but the branch still holds commits that never reached the trunk). Stranded branches are a data-loss risk and take priority: recover them before sweeping anything.

## The safe set

A local branch is auto-reaped only if it is **verified merged into the integration branch**. The integration branch is `origin/develop` if it exists, else `origin/main`, else `origin/master` (regular merges mean a landed branch's tip is reachable from it). A worktree is reaped only if it lives under `.claude/worktrees/` (Claude Code's managed worktrees), sits on a reapable branch, and has a clean working tree.

Protected, never touched no matter what: `develop`, `main`, `master`, the current branch, and the repo's default branch.

## Procedure

1. `git fetch --prune` so the integration ref and the remote-tracking refs are current. If the fetch fails or no integration ref resolves, stop and report; never delete on stale information.
2. Resolve the integration ref: the first of `origin/develop`, `origin/main`, `origin/master` that exists.
3. Compute the merged set: `git branch --merged <integration-ref>`, then drop the protected names and the current branch (the `*` line). What remains is verified merged.
4. For each merged branch, record its tip SHA first (`git rev-parse <name>`), so the report can offer the restore command. If it has a worktree under `.claude/worktrees/` and that tree is clean (`git -C <path> status --porcelain` is empty), `git worktree remove <path>` without `--force`. Then `git branch -D <name>` (safe here, because it is verified merged into the integration ref).
5. Report in two parts:
   - **Reaped:** each branch and worktree removed, with `restore: git branch <name> <sha>`.
   - **Left for you, with the reason:** a branch whose upstream is gone but is not merged into the integration ref (possibly squash-merged elsewhere or abandoned, your call); a branch that is ahead of the integration ref and whose PR has already merged (likely stranded post-merge commits: `git log origin/<integration>..origin/<branch>` shows them; recover via a new doc PR before deleting); any unmerged branch; any dirty worktree; any reapable-looking worktree outside `.claude/worktrees/`. List them, do not delete them.

## Recovering a stranded branch

A stranded branch holds commits that the merged PR never carried to the trunk - exactly the post-merge doc updates the kit keeps writing late. Recover before deleting:

1. Confirm the stranded commits: `git log --oneline <integration-ref>..<branch>`. These are the ones at risk.
2. Branch fresh from the current integration ref: `git switch <integration-ref> && git switch -c <branch>-recover` (or cherry-pick onto a new branch off it). Never reuse the merged branch - it is frozen.
3. Bring the commits over: `git cherry-pick <sha>...` for each, or `git cherry-pick <integration-ref>..<branch>` for the range.
4. Push the recovery branch and open a new PR against the integration branch. The push guard allows this (the recovery branch has no merged PR); it would have blocked re-pushing to the original.
5. Only once the commits are safely on the recovery branch (and ideally merged), delete the stranded original. The delete itself can't strand anything, so it is allowed.

## Hard rules

- The only auto-delete trigger is membership in `git branch --merged <integration-ref>`. Never `git branch -D` a branch that is not in that set. "Upstream gone" alone is a report, not a delete.
- Never `git worktree remove --force`. A dirty worktree is reported, never removed.
- Never touch `develop`, `main`, `master`, the current branch, or a worktree outside `.claude/worktrees/`.
- A reaped branch's commits are already in the integration branch, so every removal is recoverable; always print the restore SHA.

## Companion

To keep the remote side tidy too, enable "auto-delete head branch on merge" in the repo settings. It is optional here (regular merges make `--merged` reliable on its own), but it removes the merged remote branches and gives the SessionStart nudge a second signal.
