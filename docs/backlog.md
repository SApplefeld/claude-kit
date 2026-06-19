# Backlog

The living handoff and next-steps doc for the kit. It carries active items only. When an item is done, it moves out to a dated snapshot in `archive/` (`backlog-YYYY-QN.md`) rather than being struck through in place, so this file stays lean and readable.

Per-plan history does not live here. A plan's Chapters are its own append-only record and travel with the plan into `archive/` when it closes. This file is for cross-effort next-steps that do not belong to any single open plan.

## Active

- **Baseline-test the backstop wording.** The "completed plan unarchived" reminder text now lives in two hooks: the SessionStart nudge in `session-start.js` and the block reason in `stop-docs-hygiene.js`. Both are behavior-shaping text. Run the writing-skills RED/GREEN check on them before fully trusting them to trigger the archive pass.
- **Extract a shared plan-status helper if the predicate grows.** The "Status: Complete in docs/plans/" scan is duplicated in `session-start.js` and `stop-docs-hygiene.js`. The duplication was a deliberate blast-radius call (not touching the resume-critical hook for a ten-line scan). If the predicate gains nuance later (for example treating an explicit Abandoned status as archivable), single-source it into a `hooks/lib/` helper both require, rather than editing two files.

## Snapshots

Completed items are archived to `archive/backlog-YYYY-QN.md`.

- `archive/backlog-2026-Q2.md`
