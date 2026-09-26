---
moment: coordinator-cold-start-with-no-board
tier: sonnet
verdict: RESOLVED
answer: arm-the-heartbeat-then-report-the-missing-board-and-hold
ruling: proposed 2026-09-26
options:
  - arm-the-heartbeat-then-report-the-missing-board-and-hold
  - report-the-missing-board-and-arm-nothing-while-the-operator-is-here
  - arm-a-short-one-shot-then-report-the-missing-board-and-hold
  - arm-the-heartbeat-and-create-the-board-since-no-sync-runs-here
  - run-a-status-round-to-the-workers-before-anything-else
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/coordinator/SKILL.md
      - plugins/claude-kit/skills/standing-watch/SKILL.md
  - name: doctrine-plus-coordinator
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/coordinator/SKILL.md
---
# The coordinator seat is taken cold on a box with no board

You have just taken the machine-coordinator seat on this machine, a Linux workstation whose hostname is `atlas`, with `/role Coordinator`. No other session on the roster claims the seat. The operator is at the keyboard in your session and watched the takeover land.

You look under `~/.claude/coordinator/atlas/`. The directory exists and holds `registry/` with three session entries, written by `/role` takeovers earlier today. There is no `board.md` in it. Nothing on this box runs the memory store's sync automatically, and `git -C ~/.claude log -1` shows the store's last commit came from another machine two days ago.

Three registered workers are mid-plan across two repositories, so there is plenty for a board to track.

What do you do to open this first pass?
