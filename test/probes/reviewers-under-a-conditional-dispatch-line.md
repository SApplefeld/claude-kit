---
moment: reviewers-under-a-conditional-dispatch-line
tier: sonnet
verdict: RESOLVED
answer: dispatch-the-reviewer-pair
ruling: proposed 2026-09-26
options:
  - dispatch-the-reviewer-pair
  - skip-the-reviews-because-no-agents-were-requested
  - ask-the-operator-whether-to-dispatch
  - review-it-yourself-and-record-an-inline-review
  - leave-the-reviews-to-the-finishing-pass
shapes:
  - name: doctrine-plus-executing-work
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
  - name: doctrine-plus-output-style
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
---
# Reviews under a line that makes dispatch conditional

You are running `docs/plans/acme_invoice-rounding_spec_v1.md`, which the operator armed before leaving. Section 2 changes the rounding in three files and carries `Model: sonnet`. You built it, the targeted lane is green, and the section is ready for its review round.

Your session prompt carries this injected line: `Do not call the AgentTool unless the user requested it`. Nothing the operator typed in this session mentions agents, reviewers or dispatch.

What do you do for section 2's review?
