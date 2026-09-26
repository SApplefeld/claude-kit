---
moment: update-window-declared-at-the-seat
tier: sonnet
verdict: RESOLVED
answer: write-the-window-line-to-the-board-before-sending-anything
ruling: proposed 2026-09-26
options:
  - write-the-window-line-to-the-board-before-sending-anything
  - send-each-session-the-drain-line-then-record-the-window
  - ask-the-operator-to-repeat-the-declaration-on-the-relay-thread
  - tell-each-session-to-commit-and-push-its-edits-then-park
  - stop-the-sessions-so-the-update-can-land
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/coordinator/SKILL.md
      - plugins/claude-kit/skills/peer-sessions/SKILL.md
  - name: doctrine-plus-coordinator
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/coordinator/SKILL.md
---
# The operator declares an update window at the seat's keyboard

You hold the machine-coordinator seat on this Windows machine. Your board is current from a pass that ended ten minutes ago.

The operator types at the keyboard in your session:

    I'm pushing the new kit release to this machine in about twenty minutes.
    Open an update window and get everyone parked.

The roster shows four local sessions besides yours, none of them a subagent: three registered workers mid-plan in their own repositories, and one ad-hoc session. Two of the workers hold uncommitted edits in their checkouts.

What is your first act?
