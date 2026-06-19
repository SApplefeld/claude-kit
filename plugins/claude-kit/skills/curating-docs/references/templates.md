# Docs Library Templates

Seed a new or retrofitted `docs/` library from these skeletons. Replace `<project>` with the project name. Keep the kit's style: no em dashes, prose for the why, lists for catalogs.

---

## `docs/README.md` (the index)

```markdown
# <project> Docs

This directory is the working library and project history for <project>: the documents about the solution, the active plans, and the archived record of finished work.

## Folder map

- **Root (`docs/`)** holds the stable documents about the solution and this index. Architecture, design rationale, and any security model live here.
- **`plans/`** holds active plans only: specs that are open or in progress. A plan moves to `archive/` the moment it is Complete or abandoned. See `plans/README.md`.
- **`archive/`** holds finished and abandoned plans (Chapters intact) and dated backlog snapshots. It is immutable history. See `archive/README.md`.

## Living documents

- **`backlog.md`** is the single living handoff and next-steps doc. It carries only active items; completed items are pruned to a dated snapshot in `archive/`.

## Active plans

(List each active plan in `plans/` with a one-line description. "None at present." when empty.)

## Archive

See `archive/` for completed plans and backlog snapshots.
```

---

## `docs/plans/README.md`

```markdown
# Active Plans

This folder holds active plans only: specs that are open or in progress. A plan is the single source of truth for one effort's intent and state, and a fresh or post-compaction session resumes from it.

## Rules

- A plan lives here while it is being worked. When it reaches `Status: Complete` or is abandoned, it moves to `../archive/` in the same close-out that finished it (via `git mv`, so history is preserved).
- Naming: `<project>_<content-type>_v<n>.md`. Increment the version rather than overwriting a prior one.
- The `Status` header drives the lifecycle. `In Progress` plans are surfaced for resume; `Complete` plans still sitting here are flagged as unarchived.
- When a plan relates to or supersedes another, cross-reference it in a `## Related` section.

## Current

(List active plans, or "None at present.")
```

---

## `docs/archive/README.md`

```markdown
# Archive

This folder is immutable history. Nothing here is live or pending.

## Contents

- **Completed and abandoned plans**, moved here from `../plans/` with their Chapters intact.
- **Backlog snapshots** (`backlog-YYYY-QN.md`). Completed backlog items are moved into the quarter's snapshot rather than struck through in place.

## Rules

- Do not edit archived plans to reflect new work. A new effort gets a new plan in `../plans/`, cross-referenced to the archived one it builds on or supersedes.
- Nothing is deleted here. The archive is the project's memory.
```

---

## `docs/backlog.md`

```markdown
# Backlog

The living handoff and next-steps doc. It carries active items only. When an item is done, it moves out to a dated snapshot in `archive/` (`backlog-YYYY-QN.md`) rather than being struck through in place.

Per-plan history does not live here. A plan's Chapters travel with the plan into `archive/` when it closes. This file is for cross-effort next-steps that do not belong to any single open plan.

## Active

- (Active next-steps and handoffs.)

## Snapshots

Completed items are archived to `archive/backlog-YYYY-QN.md`.
```

---

## Dated backlog snapshot (`docs/archive/backlog-YYYY-QN.md`)

```markdown
# Backlog Snapshot YYYY QN

Completed cross-effort items moved out of `../backlog.md` during this quarter. Append-only within the quarter.

- YYYY-MM-DD: <item, one line, with the outcome>
```
