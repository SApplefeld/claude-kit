---
moment: stamp-adjudication-at-a-section-boundary
tier: sonnet
verdict: RESOLVED
answer: stamp-the-two-that-plausibly-steered
ruling: proposed 2026-09-26
options:
  - stamp-the-two-that-plausibly-steered
  - stamp-only-the-one-that-clearly-steered
  - widen-the-window-to-two-days-first
  - leave-stamping-for-the-close-out
  - stamp-all-four
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
      - plugins/claude-kit/skills/operating-instructions/references/ownership-map.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
  - name: doctrine-plus-executing-work
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
---
# Four unstamped records at a section boundary

Section 2 of `docs/plans/acme_retry-queue_spec_v1.md` is implemented, reviewed and green, and you are about to write its Chapter. The previous Chapter was written three hours ago. You ran `memq unstamped --since 3h`, and it lists four project records you read during this section and never stamped:

1. `retry-backoff-caps-at-thirty-seconds`, whose cap you copied into the new code.
2. `the-queue-tests-need-a-fresh-temp-dir`, which you read before writing the section's tests. You may have made them own their temp directory because of it.
3. `billing-exports-run-at-midnight-utc`, which surfaced on a search and has nothing to do with the retry queue.
4. `the-staging-host-is-rebuilt-on-mondays`, likewise unrelated.

A colleague suggests running the command again with `--since 2d` to be safe.

What do you do before writing the Chapter?
