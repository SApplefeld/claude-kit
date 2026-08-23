# Active Plans

This folder holds active plans only: specs that are open or in progress. A plan is the single source of truth for one effort's intent and state, and a fresh or post-compaction session resumes from it.

## Rules

- A plan lives here while it is being worked. When it reaches `Status: Complete` or is abandoned, it moves to `../archive/` in the same close-out that finished it. The `curating-docs` skill does the move with `git mv` so history is preserved.
- Naming follows the kit convention: `<project>_<content-type>_v<n>.md` (for example `claude-kit_docs-lifecycle_spec_v1.md`). Increment the version rather than overwriting a prior one.
- The `Status` header drives the lifecycle. `session-start.js` scans this folder: `In Progress` plans are surfaced for resume, and `Complete` plans still sitting here are flagged as unarchived.
- A plan doc's header and structure are a frozen v1 machine contract, not only kit convention: an external engine parses nine shapes out of every plan here, case-sensitively and anchored to the start of a line, and four of them carry a value rule it enforces silently. The `curating-docs` skill holds the table; reword nothing in a header without reading it.
- When a plan relates to or supersedes another, cross-reference it in a `## Related` section so the library stays navigable.

## Current

- **`claude-kit_warden-adoption-candidates_notes_v1.md`** is the candidate bank the adopted specs grew from, header marked Dispositioned 2026-08-22, each candidate carrying its disposition and evidence. It deliberately carries no `## Sections of Work` block and no `Commit Model:` header, so neither plan parser reads it as work in flight.

Completed plans are in `../archive/`. Each entry below states what that plan delivered when it shipped, which is history rather than current behavior: a later plan may have narrowed or removed what an earlier one built, so read `../architecture.md` and the skills for how the kit works now (most recent: `claude-kit_dormant-feature-removal_spec_v1.md`, which removed three dormant features whole and consolidated the test coverage one of them had been hiding. The stop-failure recovery feature is gone: its `StopFailure` hook logger, the scheduled-task watcher that resumed a leashed run whose session died, the doctor installer and report section behind it, and the switch that unregistered it. The doctor's legacy resume-relay cleanup block went with it, and so did the PreCompact version-floor check, leaving the doctor with no destructive action at all: `-Fix` deletes nothing. Both doctor entry points also stopped reporting success on a flag the doctor no longer defines, which they had done by never assigning an exit code at all. And `tools/hook-tests/` is gone, its 47 live tests moved into `test/` where a runner reaches them: no runner had ever globbed that directory, so the only coverage of three guard hooks had existed on paper for as long as it sat there.)
