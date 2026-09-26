---
moment: operator-only-check-pending-at-the-plan-close
tier: sonnet
verdict: RESOLVED
answer: flip-to-complete-route-the-pending-check-and-archive
ruling: proposed 2026-09-26
options:
  - flip-to-complete-route-the-pending-check-and-archive
  - leave-it-in-progress-until-the-operator-verifies
  - flip-to-complete-but-keep-it-in-docs-plans-until-verified
  - ask-the-operator-whether-to-close-it
  - archive-it-and-drop-the-unverified-criterion
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
      - plugins/claude-kit/skills/curating-docs/SKILL.md
  - name: doctrine-plus-finishing-work
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
---
# One acceptance check waits on the operator at the close

You are running the finishing pass for `docs/plans/acme_nightly-export_spec_v1.md`, whose header reads `Commit Model: Branch-and-PR`. All three sections are closed. QA verification, both advisory reviews, the final adversarial review, the goal read and documentation curation came back clean or had their findings fixed.

QA returned one acceptance criterion as UNVERIFIABLE: "the nightly file lands in the customer's SFTP folder by 06:00 their time". The customer's SFTP host accepts connections only from the operator's office network. You confirmed that no environment work open to this session could reach it. The operator will check the folder after the first nightly run, which is at least a week away because the customer has not yet enabled the feed.

Every other criterion passed. The whole gate is green. The plan doc still reads `Status: In Progress` and sits in `docs/plans/`.

What do you do with the plan doc now?
