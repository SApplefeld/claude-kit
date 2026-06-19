---
name: curating-docs
description: "Use during finishing-work when a plan reaches Complete, when a new plan is written that should be indexed and cross-referenced, or when asked to tidy, retrofit, or reorganize a project's docs/ folder. Symptoms: completed plans piling up in docs/plans/, a backlog doc that only grows, plans that never reference each other, a docs/ tree with no index."
---

# Curating Docs

A project's `docs/` is a curated library and working backlog, not an attic where finished plans pile up. The failure this skill exists to stop: a plan is closed in place, `docs/plans/` fills with completed work, the backlog grows without bound, and the library stops being navigable. Closing a plan is not finishing it. A plan is finished when it has moved to the archive, the backlog is pruned, related plans point at each other, and the index reflects reality.

## The taxonomy

Three zones, each with one job, plus one living doc.

| Location | Holds | Discipline |
|---|---|---|
| `docs/` root | Stable about-the-solution docs (architecture, security model) and the README index | Updated in place as the solution changes |
| `docs/plans/` | Active plans only (open or in progress) | A plan leaves the moment it is Complete or abandoned |
| `docs/archive/` | Finished and abandoned plans (Chapters intact) and dated backlog snapshots | Immutable history; nothing here is live |
| `docs/backlog.md` | The living handoff and next-steps doc, active items only | Pruned-live: completed items move to a dated snapshot |

Two append disciplines stay separate. A plan's Chapters are append-only history and travel with the plan into the archive. The backlog is pruned-live. Conflating them is what produces the endless-append problem.

## Archive a completed plan (the close path)

Run this as part of close-out, in order:

1. Confirm `Status: Complete` (or abandoned) and that a final Chapter is written. If it is not actually done, stop; this is not the step.
2. Move the file. `git mv docs/plans/<file> docs/archive/<file>` when the repo is git-tracked, so history is preserved; a plain move otherwise. The Chapters travel with the file untouched.
3. Cross-reference. If the plan built on or superseded another, ensure both link each other (a `## Related` section), and mark a superseded plan in its header. Act on any cross-ref gap `docs-curator` flagged.
4. Prune the backlog (see below).
5. Refresh the index. `docs/README.md` drops the plan from its active list; the archive is reflected.

This is the rule that died last time, so it is stated as a prohibition with the excuses that defeat it:

| The excuse | Why it is wrong |
|---|---|
| "It is Complete, the status says so, that is enough." | Status is not location. A Complete plan left in `plans/` still pollutes the active set and the resume scan's signal. Move it. |
| "I will archive it later, or in a batch." | Later is where this rule died before. Archive in the same close-out that finished the work. |
| "Moving it loses the history." | `git mv` preserves history, and the Chapters move with the file. Nothing is lost. |

## Register and cross-reference a new plan (the create path)

When `brainstorming` writes a new spec, before handing it to `executing-work`:

1. Add it to the active-plans list in `docs/README.md`.
2. If it builds on or supersedes another plan, add a `## Related` section that links both directions, and note the supersession in the older plan's header.
3. If cross-effort next-steps surfaced during design, add them to `docs/backlog.md`.

## Prune the backlog

`docs/backlog.md` carries active items only. When an item is done, move it into the quarter's snapshot at `docs/archive/backlog-YYYY-QN.md` (create it if absent; append within the quarter). Do not strike items through in place. Per-plan Chapters are the effort-level history; the backlog is cross-effort next-steps kept lean.

## Retrofit an existing tree

When asked to tidy or retrofit a `docs/` that predates this structure:

1. **Audit, read-only.** List every doc, read each plan's `Status` header, and classify each: active plan, completed or abandoned plan, about-the-solution doc, or stray. Read before proposing.
2. **Propose the migration.** State which plans move to the archive, what the index and backlog will contain, and which READMEs get seeded. Present it and stop. Move nothing yet; this is a destructive-enough batch to earn a confirmation.
3. **Apply on approval.** Create the zones and READMEs from the templates, `git mv` the completed and abandoned plans into the archive, seed the index and backlog, and report what moved. Never delete a file; relocate it.

## Templates

The README, index, and backlog skeletons live in `references/templates.md`. Seed from there rather than inventing a new shape per project, so every project's library reads the same way.

## Antipatterns

- Closing a plan in place: status flipped to Complete, file never moved.
- A backlog that only grows because completed items are struck through instead of moved to a snapshot.
- Forking a parallel copy of a doc instead of updating it in place.
- Editing an archived plan to reflect new work. New work gets a new plan, cross-referenced to the one it builds on.
