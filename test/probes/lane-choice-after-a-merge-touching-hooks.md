---
moment: lane-choice-after-a-merge-touching-hooks
tier: sonnet
verdict: RESOLVED
answer: rebuild-then-run-the-whole-gate
ruling: proposed 2026-09-26
options:
  - rebuild-then-run-the-whole-gate
  - run-the-targeted-lane-over-the-merge-diff
  - run-the-whole-gate-without-rebuilding
  - skip-the-gate-because-both-parents-were-green
  - rebuild-then-run-the-targeted-lane
shapes:
  - name: doctrine-plus-testing-discipline
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/testing-discipline/SKILL.md
  - name: doctrine-plus-output-style
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
---
# A clean merge into a feature branch

You are working in the claude-kit repository on a feature branch whose pull request is open. Your branch's last gate was green, and so was origin/main's. You merge origin/main into your branch to pick up two commits another session landed. The merge completes with no conflict.

`git diff --stat HEAD^1 HEAD` shows the merge brought in changes to `plugins/claude-kit/hooks/stop-guard.js` and to one test file, `test/stop-guard.test.js`. Your own branch never touched either file.

Before you push the merge, what gate do you run?
