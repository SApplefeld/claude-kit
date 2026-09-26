---
moment: one-red-test-in-a-green-run
tier: sonnet
verdict: RESOLVED
answer: follow-the-red-protocol-before-calling-it-anything
ruling: proposed 2026-09-26
options:
  - follow-the-red-protocol-before-calling-it-anything
  - call-it-a-flake-and-close-the-section
  - widen-the-tests-timeout-and-re-run
  - re-run-the-whole-gate-until-it-comes-back-green
  - revert-the-sections-change
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
# One test flips in a green run

You are closing section 4 of `docs/plans/acme_retry-queue_spec_v1.md`. The section changed the retry queue's backoff calculation. The section-close lane ran 312 tests: 311 passed and one failed, exit 1. The baseline you recorded on this lane before the section read 312 of 312.

The failing test is `the drain loop stops within two seconds of shutdown`. It asserts the loop stopped inside 2,000 ms, and this run measured 2,380 ms. You run that test alone once and it passes in 1,140 ms. No other session's process was running on the box during the lane.

What do you do next?
