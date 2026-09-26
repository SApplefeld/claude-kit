---
name: branch-hygiene
description: "Use to clean up local branches and worktrees left over after Branch-and-PR efforts, or when the SessionStart nudge flags reapable OR stranded branches. Triggers: branch cleanup, reap or prune merged branches, recover stranded post-merge commits, leftover or stale local branches, worktree cleanup, too many local branches sitting around."
---

# Branch Hygiene

This sweeps local branches and worktrees whose work has already landed, under the conditions Safe Set and Hard Rules state, and leaves everything else alone.

The SessionStart nudge flags **reapable** branches, merged and safe to sweep, and **stranded** ones. Stranded branches take priority: recover them before sweeping anything.

## Safe Set

A local branch is auto-reaped only if it is **verified merged into the integration branch**. The integration branch is `origin/develop` if it exists, else `origin/main`, else `origin/master`. A worktree is reaped only if it lives under `.claude/worktrees/`, sits on a reapable branch, and has a clean working tree.

Protected, never touched: `develop`, `main`, `master`, the current branch, the repo's default branch, and a worktree outside `.claude/worktrees/`.

## Procedure

1. `git fetch --prune` to refresh the integration and remote-tracking refs. If it fails or no integration ref resolves, stop and report without deleting.
2. Resolve the integration ref in the order Safe Set gives.
3. Compute the merged set: `git branch --merged <integration-ref>`, minus the protected names and the current branch (the `*` line).
4. For each merged branch, record its tip SHA first (`git rev-parse <name>`). If it has a worktree the safe set admits and that tree is clean (`git -C <path> status --porcelain` is empty), `git worktree remove <path>` without `--force`. Then `git branch -D <name>`.
5. Report in two parts:
   - **Reaped:** each branch and worktree removed, with `restore: git branch <name> <sha>`.
   - **Left for you, with the reason:** a branch with its upstream gone but unmerged; a branch ahead of the integration ref whose PR merged, likely stranded (see Stranded Branch Recovery); any other unmerged branch; any dirty worktree; any reapable-looking worktree outside `.claude/worktrees/`. List them and delete none.

## Stranded Branch Recovery

A stranded branch holds commits the merged PR never carried to the trunk. Recover them before deleting:

1. Confirm the stranded commits: `git log --oneline <integration-ref>..<branch>`.
2. Branch fresh from the current integration ref: `git switch -c <branch>-recover <integration-ref>` (or cherry-pick onto a new branch off it). Never reuse the merged branch, which is frozen.
3. Bring the commits over: `git cherry-pick <sha>...` for each, or `git cherry-pick <integration-ref>..<branch>` for the range.
4. Push the recovery branch and open a new PR against the integration branch.
5. Delete the stranded original only under Hard rule 1's exception: the recovery branch pushed and `git cherry <recovery> <stranded>` printing no `+` line.

## Hard Rules

- The only auto-delete trigger is membership in `git branch --merged <integration-ref>`. Never `git branch -D` a branch outside that set, with one licensed exception: a stranded original once `git rev-parse --verify origin/<recovery>` prints the same hash as `git rev-parse <recovery>` and `git cherry <recovery> <stranded>` prints no `+` line. One condition missing is a report, not a delete. The branch must also be checked out in no worktree, per `git worktree list`, and git's refusal otherwise is a report too. "Upstream gone" alone is a report, not a delete.
- Never `git worktree remove --force`. A dirty worktree is reported, never removed.
- Never touch anything on the protected list under Safe Set.

## Remote Branch Cleanup

The operator can turn on "auto-delete head branch on merge" in the repo settings, a one-time choice that keeps the remote side tidy. It is optional here (regular merges make `--merged` reliable on its own), but it removes the merged remote branches and gives the SessionStart nudge a second signal.
