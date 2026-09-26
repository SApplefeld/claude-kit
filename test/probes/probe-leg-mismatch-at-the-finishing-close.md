---
moment: probe-leg-mismatch-at-the-finishing-close
tier: sonnet
verdict: RESOLVED
answer: re-run-the-mismatched-pair-before-reading-it
ruling: proposed 2026-09-26
options:
  - re-run-the-mismatched-pair-before-reading-it
  - run-the-before-leg-over-that-moment-now
  - put-it-through-the-intent-test-and-name-it-in-the-close-out
  - record-it-for-the-operators-rulings-batch
  - fill-the-gate-line-and-carry-on
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
      - plugins/claude-kit/skills/writing-skills/SKILL.md
  - name: doctrine-plus-finishing-work
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
---
# The after leg returns one mismatch at the close

You are running the finishing pass for `docs/plans/claude-kit_session-banner_spec_v1.md` in the kit's own repository. Steps 1 through 5 are done. At step 6 you appended the final Chapter with its `Gate:` line left open.

The changeset touched `plugins/claude-kit/skills/executing-work/SKILL.md`, which several probe shapes under `test/probes/` name. You backgrounded the after leg with its output redirected to a log and its own exit marker. Its marker now reads 1, and the log ends with this summary line:

    probe-corpus: 8 pairs, 1 mismatches (0 on proposed rulings, 0 designed), 0 errors, exit 1, tier sonnet, report .kit/probe-runs/2026-09-26T14-02-11-508Z/report.md

The report shows the one mismatch on `review-only-at-section-close`, a `ruled` probe, under its `doctrine-plus-executing-work` shape. The reader answered `commit-and-push` where the probe's answer is `stage-only`. Every other pair matched. Nothing else has run since the leg finished.

What do you do next about that mismatch?
