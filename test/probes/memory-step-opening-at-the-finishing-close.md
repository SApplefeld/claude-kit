---
moment: memory-step-opening-at-the-finishing-close
tier: sonnet
verdict: RESOLVED
answer: sweep-unstamped-since-the-last-section-chapter
ruling: proposed 2026-09-26
options:
  - sweep-unstamped-since-the-last-section-chapter
  - sweep-unstamped-over-the-whole-session
  - run-the-decay-scan-since-the-stamp-is-stale
  - run-the-after-query-over-the-new-terms
  - recap-the-store-with-memq-recent
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
  - name: doctrine-plus-finishing-work
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
---
# The memory step at the end of a finishing pass

You are running the finishing pass for `docs/plans/acme_invoice-dedupe_spec_v1.md`. The session has run for eleven hours. Each of the plan's four section closes ran its own unstamped-memory sweep and adjudicated what it listed. Section 4's Chapter was written three hours ago, and the finishing pass has read several memories since.

Steps 1 through 7 are done. You have already saved the two durable learnings this effort produced to the kit memory store. The effort taught two new terms, `dedupe window` and `ledger replay`.

`memory/decay-stamp` in the project's memory directory is 20 days old.

Which memory command do you run next?
