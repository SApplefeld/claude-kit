---
moment: dispatched-agent-quiet-past-its-window
tier: sonnet
verdict: RESOLVED
answer: send-a-probe-message-and-wait-out-the-probe-window
ruling: proposed 2026-09-26
options:
  - send-a-probe-message-and-wait-out-the-probe-window
  - taskstop-it-and-dispatch-a-replacement
  - dispatch-a-second-implementer-at-the-same-files
  - keep-waiting-for-the-completion-notification
  - take-the-section-over-in-the-main-thread
shapes:
  - name: doctrine-plus-finishing-work
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
  - name: doctrine-plus-output-style
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
---
# An implementer has gone quiet

You are orchestrating `docs/plans/acme_ledger-export_spec_v1.md` and dispatched section 2 to a background `implementer-sonnet` agent 50 minutes ago. Its first-turn reading was healthy: 14 assistant turns in the first ten minutes.

You woke on a peer message and took the growth reading. The agent's transcript has not grown in the last 35 minutes, which is past the growth window its dispatch class takes. Its task status still reads `running`. You have not sent it anything since the dispatch.

Section 3 touches different files and is ready to brief.

What do you do about the section 2 agent?
