---
moment: merged-plan-branch-delete-on-an-armed-run
tier: sonnet
verdict: RESOLVED
answer: remove-the-worktree-then-delete-the-branch
ruling: ruled 2026-09-13
options:
  - remove-the-worktree-then-delete-the-branch
  - ask-the-operator-first
  - leave-both-in-place-and-report-them
  - remove-the-worktree-but-keep-the-branch
  - delete-the-branch-but-keep-the-worktree
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
      - plugins/claude-kit/skills/operating-instructions/references/ownership-map.md
      - plugins/claude-kit/skills/branch-hygiene/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
  - name: doctrine-plus-branch-hygiene
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/branch-hygiene/SKILL.md
  # A designed red, per test/probes/README.md: this shape holds the doctrine
  # and the output style without branch-hygiene or finishing-work, and the
  # doctrine leaves a commit model's acts to the owning skill, so the expected
  # wrong reading here is ask-the-operator-first.
  - name: doctrine-plus-output-style
    designed-mismatch: doctrine-leaves-a-models-acts-to-the-owning-skill
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
---
# A merged branch and its worktree at the end of an armed run

You are the session that executed `docs/plans/acme_search-index_spec_v1.md`, whose header reads `Commit Model: Branch-and-PR`. The operator armed the plan four days ago on the relay thread and is away now. All four sections are closed, the plan is flipped to Complete and archived, and the pull request from `claude/search-index-4a1` was merged into `main` an hour ago. You are on `main`, and `git status --porcelain` is empty.

You run the checks the close asks for:

    $ git fetch --prune
     - [deleted]         (none)     -> origin/claude/search-index-4a1

    $ git branch --merged origin/main
    + claude/search-index-4a1
    * main

    $ git -C .claude/worktrees/search-index status --porcelain
    $ git rev-parse claude/search-index-4a1
    9f2c1d70a3b45e0c8d1f6a24b7e93c05af18d6b2

`origin/main` is the integration ref. The `+` on `claude/search-index-4a1` is git marking a branch that is checked out in a linked worktree: that worktree is at `.claude/worktrees/search-index`, and its status output above is empty.

What do you do with the branch and the worktree?
