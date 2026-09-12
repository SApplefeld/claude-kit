---
name: curating-docs
description: "Use during finishing-work when a plan reaches Complete, when a new plan is written that should be indexed and cross-referenced, or when asked to tidy, retrofit, or reorganize a project's docs/ folder. Symptoms: completed plans piling up in docs/plans/, a backlog doc that only grows, plans that never reference each other, a docs/ tree with no index."
---

# Curating Docs

A plan is finished when it has moved to the archive, the backlog is pruned, related plans point at each other, and the index reflects reality. Closing a plan is not finishing it.

## The taxonomy

Three zones, each with one job, plus one living document: the backlog.

| Location | Holds | Discipline |
|---|---|---|
| `docs/` root | Stable about-the-solution docs (architecture, security model) and the README index | Updated in place as the solution changes |
| `docs/plans/` | Active plans only (open or in progress) | A plan leaves the moment it is Complete or abandoned |
| `docs/archive/` | Finished and abandoned plans (Chapters intact) and dated backlog snapshots | Immutable history; nothing here is live |
| `docs/backlog.md` | The living handoff and next-steps doc, active items only | Pruned-live: completed items move to a dated snapshot |

A curating pass neither zones nor moves a `docs/coordinator-board.md` in a project's `docs/`: that file is the machine coordinator's own state and belongs to the seat.

Two append disciplines stay separate. A plan's Chapters are append-only history and travel with the plan into the archive. The backlog is pruned-live and holds cross-effort next-steps only.

## Archive a completed plan (the close path)

Run this as part of close-out, in order:

1. Confirm `Status: Complete` (or abandoned) and that a final Chapter is written. If it is not actually done, stop; this is not the step.
2. Move the file. `git mv docs/plans/<file> docs/archive/<file>` when the repo is git-tracked, so history is preserved; a plain move otherwise. The Chapters travel with the file untouched. Then `git add` the moved file again whenever it carries unstaged edits: `git mv` records the rename at the index content, not the worktree content, so a doc finalized and then moved commits pre-finalization unless re-added. The `RM` pair against the file in `git status --short` is the tell.
3. Repoint the plan's own relative links, before or right after the move. A plan written in `plans/` reaches a sibling archived plan as `../archive/<file>`, and that path is wrong the moment the plan is itself in `archive/`, where the sibling is just `<file>`. Grep the moved file for `../archive/` and fix every hit.
4. Cross-reference. If the plan built on or superseded another, ensure both link each other (a `## Related` section), and mark a superseded plan in its header. Act on any cross-ref gap `docs-curator` flagged. The pointers run one way when the other plan is already archived: the moving plan gets the `## Related` section and the archived one is left alone.
5. Prune the backlog (see below).
6. Refresh the index. `docs/README.md` and `docs/plans/README.md` both drop the plan from their active list, and both reflect the archive, including a "most recent" pointer if either carries one.

Archive in the same close-out that finished the work, never later or in a batch.

## Register and cross-reference a new plan (the create path)

When `brainstorming` writes a new spec, before handing it to `executing-work`:

1. Add it to the active-plans list in `docs/README.md`.
2. If it builds on or supersedes another plan, cross-reference it per the close path's step 4 above, the new plan taking the moving plan's part there, the archived-plan carve-out included.
3. If cross-effort next-steps surfaced during design, add them to `docs/backlog.md`.

## Prune the backlog

When an item is done, move it into the quarter's snapshot at `docs/archive/backlog-YYYY-QN.md` (create it if absent; append within the quarter). Do not strike items through in place.

The prune pass is also the aging check. Read each active item's parked date and name every one older than 90 days, with its date, for a promote/retire/keep call. Promote it: spec it now. Retire it: move to the snapshot with the reason. Keep it: write the fresh adjudication date ahead of the original, `(YYYY-MM-DD, parked YYYY-MM-DD)`, with the reason it stays, so it ages from the adjudication. An undated active item is past the threshold by definition: give it its parked date (from git history, or today's marked `backfilled`) and adjudicate it in the same pass. The check also runs without a close-out: when the session-start block reports an oldest item older than the threshold and no close-out is near, offer the prune pass in one line. 90 days is the tunable knob, aligned with the quarterly snapshot cadence.

## Retrofit an existing tree

When asked to tidy or retrofit a `docs/` that predates this structure:

1. **Audit, read-only.** List every doc, read each plan's `Status` header, and classify each: active plan, completed or abandoned plan, about-the-solution doc, or stray.
2. **Propose the migration.** State which plans move to the archive, what the index and backlog will contain, and which READMEs get seeded. Move nothing until it is confirmed; this is a destructive-enough batch to earn the confirmation.
3. **Apply on approval.** Create the zones and READMEs from the templates, `git mv` the completed and abandoned plans into the archive, seed the index and backlog, and report what moved. Never delete a file; relocate it.

## The header is a machine contract

A plan doc's header and structure are not just kit convention. An external engine (the AI OS Spine) parses every plan doc to drive its own fleet, and its parser is case-sensitive and anchored to the start of the line, so a reasonable-looking rewording parses as absent rather than as a variant. Several rows also carry a load-bearing value shape, not just a key shape: a line with the right key and a value the engine does not recognize is worse than a missing line, because it silently substitutes a default rather than failing loud. This is the frozen v1 contract:

| Line or heading | Exact shape | Value rule |
|---|---|---|
| Title | `# <Title>` (first H1) | free-form |
| Status header | `Status: <value>`; the first occurrence above the first `##` heading is the one read | must equal `Complete` exactly (whole string, case-insensitive) for the plan to read as terminal; `Complete (archived)` or any other trailing text does not terminate. Three values carry a kit-side meaning beyond that: `In Progress`, `Complete`, and `Ready`, which marks a plan authored and parked before any run starts. `Ready` is non-terminal under this row's rule exactly as every other non-`Complete` value is, so it is a v1 value rather than a v1 change. It is a pre-arm value under the kit's own rule: a kit-driven run sets the header to `In Progress` as part of starting, which is `executing-work`'s instruction to that run and not a guarantee this contract establishes, and a worker under an external engine leaves the header to its engine, per that skill's arming-is-approval paragraph, which points at its External-engine stand-down |
| Commit Model header | `Commit Model: <value>`; the first occurrence above the first `##` heading is the one read (a Chapter's own `Commit Model:` line, required by `executing-work`'s template, is a later occurrence and is ignored) | must open with `Commit-and-Push`, `Branch-and-PR`, or `Review-Only` (case-insensitive, trailing prose tolerated); any other leading token, or an absent header, parks the run without dispatching, and `Review-Only` itself never dispatches. Under `Branch-and-PR` the trailing prose is also load-bearing: prose naming a pull request per section (`per-section PR`, `one PR per section`, either order, `pull request` spelled out or not) opens each section's pull request ready for review, and every other reading, absent prose included, is the draft-per-plan default, under which the engine opens one draft pull request at the first section close, refreshes it each section, and flips it ready at the finishing pass. A kit session opens its own pull request at `finishing-work`'s close, per that skill's Apply the commit model step. Prose about commits rather than pull requests, such as `one commit per section`, does not name the cadence and leaves the default in force |
| Disjoint header | `Disjoint: <value>`; the first occurrence above the first `##` heading is the one read | `yes` (case-insensitive) declares the plan independent of whatever else is in flight; anything else, an absent header included, means not disjoint, which is the safe default. It is read only to decide whether the engine may start this plan beside another that is blocked on something outside its control, so a wrong `yes` surfaces as a merge conflict at the pull-request gate rather than as an engine error |
| `## Sections of Work` heading | the literal text `Sections of Work` on a `##` line | bounds the block; any other `##` heading inserted inside it ends the block early, silently dropping every later `### N.` section |
| Section heading | `### N. <Title>` (one or more digits, a period, whitespace) inside `## Sections of Work` | free-form title |
| Section model line | `Model: <value>`, the first one following a section heading | must be exactly `haiku`, `sonnet`, `opus`, or `fable` (trimmed, case-insensitive); anything else, including a decorated value like `fable (inline)` or a trailing rationale, silently dispatches at a default sonnet model with no error. Whether a section is dispatched or built in the main thread rides on its own `Locus:` line, which no consumer parses, precisely so the tier value can stay a bare token |
| `## Chapters` heading | the literal text `Chapters` on a `##` line | bounds the block, and also marks where the approval-scoped fingerprint stops; renaming it makes that fingerprint cover the whole document, so every ordinary Chapter append then reads as approval drift |
| Chapter heading | `### Chapter N` (only the word and the number are parsed; a trailing ` - <date>` is convention, not contract) inside `## Chapters` | N is one or more digits |
| Chapter completed line | `Completed: <value>`, the first one in the Chapter | must start with the section number followed by a period or a space, or equal the section title exactly (case-sensitive, never a substring); anything else leaves the section permanently open. Check an existing Chapter against these three forms before assuming it registers: a phrasing like `Completed: Section 1, <title>` matches none of them |
| Chapter next line | `Next: <value>`, the first one in the Chapter | free-form |

Two consumers read this shape, at different strictness, and the difference is per-row rather than uniform. The OS repo's `PlanDocParser` is the strict reader for every row above; it is what this contract protects. The kit's own `hooks/session-start.js` plan-recovery push reads only the Status and Commit Model rows, from the first 2048 bytes of the file, case-insensitively, with a BOM strip, and reports an unrecognized Commit Model value as `unknown` rather than erroring; every other row has no kit-side reader at all. That push and the Stop hook's docs-hygiene check share one local Status reading, and it is deliberately looser than this row's terminality rule, differing from it on exactly one point: trailing text. Locally, any value opening with `Complete` reads complete, so a plan headed `Complete (archived)` and still sitting in `docs/plans/` draws the unarchived nag at session start and at every turn end, even though the row above says that same header does not terminate. On the other two values the local reading is the vocabulary above: an `In Progress` plan is listed for resume, and a `Ready` plan is listed as parked with no resume push, `Ready` alone or followed by a parenthetical (`Ready (parked pending the design round)`), while a continuation like `Ready for review` names something other than parked work and reads as unrecognized. So a malformed Status or Commit Model line does surface locally, since the plan drops out of the recovery inventory; a malformed row anywhere else in the table gives no local signal at all, and only the engine notices, silently, later.

The Title, Status, Commit Model, `## Sections of Work`, section heading, and section model rows are normatively instanced in the brainstorming skill's spec format (`skills/brainstorming/SKILL.md`, Spec format). The `## Chapters`, Chapter heading, Completed, and Next rows are normatively instanced in `executing-work/SKILL.md`'s Chapter format.

Changing the shape or value rule of any row is a coordinated, versioned change with the OS repo, never a drive-by edit to plan-doc prose. A value a row's existing rule already decides, `Ready` under the Status row, is not such a change.

Neither `## Assumptions` nor `## Dispatch Authorization` appears in any row above, so a plan gains either with no contract version change.

`## Dispatch Authorization` goes **above** `## Sections of Work`, the one position that bounds nothing, which is stricter than outside it. Two blocks here are bounded by the next `##` heading of any kind, so a heading dropped in the wrong place truncates one with no error. Inside `## Sections of Work` it ends that block, dropping every later `### N.` section from the parse. After `## Chapters` it ends the Chapters block the same way, so every Chapter below it stops registering its `Completed:` line and the section count and `Next` pointer freeze.

`## Assumptions` takes the weaker rule, outside `## Sections of Work` and above `## Chapters`. The spec template's own placement already satisfies it: `skills/brainstorming/SKILL.md` puts the heading after `## Out of Scope`, which is below the sections block and above `## Chapters`.

Adding either heading to an approved plan mid-run is an edit above `## Chapters`: make it deliberately and record it in the Chapter, per the approval-drift rule in `skills/brainstorming/SKILL.md`'s spec format.

## Templates

The README, index, and backlog skeletons live in `references/templates.md`. Seed from there rather than inventing a new shape per project, so every project's library reads the same way.

## Antipatterns

- Forking a parallel copy of a doc instead of updating it in place.
- Editing an archived plan to reflect new work. New work gets a new plan, cross-referenced to the one it builds on.
