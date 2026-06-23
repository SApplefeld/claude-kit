# Backlog

The living handoff and next-steps doc for the kit. It carries active items only. When an item is done, it moves out to a dated snapshot in `archive/` (`backlog-YYYY-QN.md`) rather than being struck through in place, so this file stays lean and readable.

Per-plan history does not live here. A plan's Chapters are its own append-only record and travel with the plan into `archive/` when it closes. This file is for cross-effort next-steps that do not belong to any single open plan.

## Active

- **Baseline-test the backstop wording.** The "completed plan unarchived" reminder text now lives in two hooks: the SessionStart nudge in `session-start.js` and the block reason in `stop-docs-hygiene.js`. Both are behavior-shaping text. Run the writing-skills RED/GREEN check on them before fully trusting them to trigger the archive pass.
- **Extract a shared plan-status helper if the predicate grows.** The "Status: Complete in docs/plans/" scan is duplicated in `session-start.js` and `stop-docs-hygiene.js`. The duplication was a deliberate blast-radius call (not touching the resume-critical hook for a ten-line scan). If the predicate gains nuance later (for example treating an explicit Abandoned status as archivable), single-source it into a `hooks/lib/` helper both require, rather than editing two files.
- **Baseline-test the report-hygiene wording (RED/GREEN).** The revised `executing-work` dispatch guidance is behavior-shaping. RED case observed in the NEO close-out session: the orchestrator wrote dispatch lines like `Write full findings to docs/reviews/_rev_sp4_s4_adversarial.md and return ONLY: one-line verdict + counts + the highest-severity finding inline`, and routed QA reports to `docs/plans/_impl_reports/sp<n>_qa.md`. Confirm the new wording stops a fresh orchestrator from routing any subagent report into `docs/`.
- **Confirm the docs-write-guard's live payload field.** The PreToolUse guard keys on the subagent-identity field (expected `agent_type`), read defensively and failing open until confirmed. On a real Claude Code run, confirm a reviewer writing into `docs/` is actually denied; if the field name differs, the guard is inert (no false blocks) until the field is corrected.
- **Confirm the pr-docs-guard fires on a real PR command.** On a real Branch-and-PR run, confirm `gh`/`az pr create` is blocked when `docs/` has uncommitted changes and passes once the docs commit lands. Standard PreToolUse behavior, verified against a git fixture, but worth one live check.
- **Confirm the merged-pr-push-guard on the real host.** The push-guard's `gh` path is tested against a stub; confirm the `az repos pr list --source-branch --status completed` invocation against the real Azure DevOps host (it fails open, so a wrong form leaves it inert for ADO rather than blocking). Watch per-push host-query latency; if heavy, scope the query to feature-branch pushes and cache merged-state per session.

## Snapshots

Completed items are archived to `archive/backlog-YYYY-QN.md`.

- `archive/backlog-2026-Q2.md`
