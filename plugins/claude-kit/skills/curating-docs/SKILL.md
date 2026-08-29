---
name: curating-docs
description: "Use during finishing-work when a plan reaches Complete, when a new plan is written that should be indexed and cross-referenced, or when asked to tidy, retrofit, or reorganize a project's docs/ folder. Symptoms: completed plans piling up in docs/plans/, a backlog doc that only grows, plans that never reference each other, a docs/ tree with no index."
---

# Curating Docs

A project's `docs/` is a curated library and working backlog, not an attic where finished plans pile up. The failure this skill exists to stop: a plan is closed in place, `docs/plans/` fills with completed work, the backlog grows without bound, and the library stops being navigable. Closing a plan is not finishing it. A plan is finished when it has moved to the archive, the backlog is pruned, related plans point at each other, and the index reflects reality.

## The taxonomy

Three zones, each with one job, plus one living document: the backlog.

| Location | Holds | Discipline |
|---|---|---|
| `docs/` root | Stable about-the-solution docs (architecture, security model) and the README index | Updated in place as the solution changes |
| `docs/plans/` | Active plans only (open or in progress) | A plan leaves the moment it is Complete or abandoned |
| `docs/archive/` | Finished and abandoned plans (Chapters intact) and dated backlog snapshots | Immutable history; nothing here is live |
| `docs/backlog.md` | The living handoff and next-steps doc, active items only | Pruned-live: completed items move to a dated snapshot |

One file is deliberately outside the taxonomy rather than missing from it. A `docs/coordinator-board.md` in a project's `docs/` is the machine coordinator's own state, retired to the memory store but not necessarily deleted where it used to live, and a curating pass neither zones it nor moves it: it belongs to the seat, and the `docs-curator` charter says so in the same words.

Two append disciplines stay separate. A plan's Chapters are append-only history and travel with the plan into the archive. The backlog is pruned-live. Conflating them is what produces the endless-append problem.

## Archive a completed plan (the close path)

Run this as part of close-out, in order:

1. Confirm `Status: Complete` (or abandoned) and that a final Chapter is written. If it is not actually done, stop; this is not the step.
2. Move the file. `git mv docs/plans/<file> docs/archive/<file>` when the repo is git-tracked, so history is preserved; a plain move otherwise. The Chapters travel with the file untouched. Then `git add` the moved file again whenever it carries unstaged edits: `git mv` records the rename at the index content, not the worktree content, so a doc finalized and then moved commits pre-finalization unless re-added. The `RM` pair against the file in `git status --short` is the tell.
3. Repoint the plan's own relative links, before or right after the move. A plan written in `plans/` reaches a sibling archived plan as `../archive/<file>`, and that path is wrong the moment the plan is itself in `archive/`, where the sibling is just `<file>`. Grep the moved file for `../archive/` and fix every hit; a plan that cites its predecessors is the normal case, so this is not an edge case.
4. Cross-reference. If the plan built on or superseded another, ensure both link each other (a `## Related` section), and mark a superseded plan in its header. Act on any cross-ref gap `docs-curator` flagged. The pointers run one way when the other plan is already archived: `docs/archive/` is append-only, so the moving plan gets the `## Related` section and the archived one is left alone.
5. Prune the backlog (see below).
6. Refresh the index. `docs/README.md` and `docs/plans/README.md` both drop the plan from their active list, and both reflect the archive, including a "most recent" pointer if either carries one.

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

The prune pass is also the aging check. Read each active item's parked date and name every one older than 90 days, with its date, for a promote/retire/keep call: promote it (spec it now), retire it (move to the snapshot with the reason), or keep it (write the fresh adjudication date ahead of the original, `(YYYY-MM-DD, parked YYYY-MM-DD)`, with the reason it stays, so it ages from the adjudication). An undated active item is past the threshold by definition: give it its parked date (from git history, or today's marked `backfilled`) and adjudicate it in the same pass. The check also runs without a close-out: when the session-start block reports an oldest item older than the threshold and no close-out is near, offer the prune pass in one line. An item never sits silently past the threshold; 90 days is the tunable knob, aligned with the quarterly snapshot cadence.

## Retrofit an existing tree

When asked to tidy or retrofit a `docs/` that predates this structure:

1. **Audit, read-only.** List every doc, read each plan's `Status` header, and classify each: active plan, completed or abandoned plan, about-the-solution doc, or stray. Read before proposing.
2. **Propose the migration.** State which plans move to the archive, what the index and backlog will contain, and which READMEs get seeded. Present it and stop. Move nothing yet; this is a destructive-enough batch to earn a confirmation.
3. **Apply on approval.** Create the zones and READMEs from the templates, `git mv` the completed and abandoned plans into the archive, seed the index and backlog, and report what moved. Never delete a file; relocate it.

## The header is a machine contract

A plan doc's header and structure are not just kit convention. An external engine (the AI OS Spine) parses every plan doc to drive its own fleet, and its parser is case-sensitive and anchored to the start of the line, so a reasonable-looking rewording parses as absent rather than as a variant. Several rows also carry a load-bearing value shape, not just a key shape: a line with the right key and a value the engine does not recognize is worse than a missing line, because it silently substitutes a default rather than failing loud. This is the frozen v1 contract:

| Line or heading | Exact shape | Value rule |
|---|---|---|
| Title | `# <Title>` (first H1) | free-form |
| Status header | `Status: <value>`; the first occurrence above the first `##` heading is the one read | must equal `Complete` exactly (whole string, case-insensitive) for the plan to read as terminal; `Complete (archived)` or any other trailing text does not terminate. Three values carry a kit-side meaning beyond that: `In Progress`, `Complete`, and `Ready`, which marks a plan authored and parked before any run starts. `Ready` is non-terminal under this row's rule exactly as every other non-`Complete` value is, so it is a v1 value rather than a v1 change. It is a pre-arm value under the kit's own rule: a kit-driven run sets the header to `In Progress` as part of starting, which is `executing-work`'s instruction to that run and not a guarantee this contract establishes, and that same skill stands a worker under an external engine down from touching the header at all |
| Commit Model header | `Commit Model: <value>`; the first occurrence above the first `##` heading is the one read (a Chapter's own `Commit Model:` line, required by `executing-work`'s template, is a later occurrence and is ignored) | must open with `Commit-and-Push`, `Branch-and-PR`, or `Review-Only` (case-insensitive, trailing prose tolerated); any other leading token, or an absent header, parks the run without dispatching, and `Review-Only` itself never dispatches. Under `Branch-and-PR` the trailing prose is also load-bearing: prose naming a pull request per section (`per-section PR`, `one PR per section`, either order, `pull request` spelled out or not) opens each section's pull request ready for review, and every other reading, absent prose included, is the draft-per-plan default (one draft opened at the first section close, refreshed each section, flipped ready by the finishing pass). Prose about commits rather than pull requests, such as `one commit per section`, does not name the cadence and leaves the default in force |
| Disjoint header | `Disjoint: <value>`; the first occurrence above the first `##` heading is the one read | `yes` (case-insensitive) declares the plan independent of whatever else is in flight; anything else, an absent header included, means not disjoint, which is the safe default. It is read only to decide whether the engine may start this plan beside another that is blocked on something outside its control, so a wrong `yes` surfaces as a merge conflict at the pull-request gate rather than as an engine error |
| `## Sections of Work` heading | the literal text `Sections of Work` on a `##` line | bounds the block; any other `##` heading inserted inside it ends the block early, silently dropping every later `### N.` section |
| Section heading | `### N. <Title>` (one or more digits, a period, whitespace) inside `## Sections of Work` | free-form title |
| Section model line | `Model: <value>`, the first one following a section heading | must be exactly `haiku`, `sonnet`, `opus`, or `fable` (trimmed, case-insensitive); anything else, including a decorated value like `fable (inline)` or a trailing rationale, silently dispatches at a default sonnet model with no error. Whether a section is dispatched or built in the main thread rides on its own `Locus:` line, which no consumer parses, precisely so the tier value can stay a bare token |
| `## Chapters` heading | the literal text `Chapters` on a `##` line | bounds the block, and also marks where the approval-scoped fingerprint stops; renaming it makes that fingerprint cover the whole document, so every ordinary Chapter append then reads as approval drift |
| Chapter heading | `### Chapter N` (only the word and the number are parsed; a trailing ` - <date>` is convention, not contract) inside `## Chapters` | N is one or more digits |
| Chapter completed line | `Completed: <value>`, the first one in the Chapter | must start with the section number followed by a period or a space, or equal the section title exactly (case-sensitive, never a substring); anything else leaves the section permanently open. Check an existing Chapter against these three forms before assuming it registers: a phrasing like `Completed: Section 1, <title>` matches none of them |
| Chapter next line | `Next: <value>`, the first one in the Chapter | free-form |

Two consumers read this shape, at different strictness, and the difference is per-row rather than uniform. The OS repo's `PlanDocParser` is the strict reader for every row above; it is what this contract protects. The kit's own `hooks/session-start.js` plan-recovery push reads only the Status and Commit Model rows, from the first 2048 bytes of the file, case-insensitively, with a BOM strip, and reports an unrecognized Commit Model value as `unknown` rather than erroring; every other row has no kit-side reader at all. That push and the Stop hook's docs-hygiene check share one local Status reading, and it is deliberately looser than this row's terminality rule, differing from it on exactly one point: trailing text. Locally, any value opening with `Complete` reads complete, so a plan headed `Complete (archived)` and still sitting in `docs/plans/` draws the unarchived nag at session start and at every turn end, even though the row above says that same header does not terminate. On the other two values the local reading is the vocabulary above: an `In Progress` plan is listed for resume, and a `Ready` plan is listed as parked with no resume push, `Ready` alone or followed by a parenthetical (`Ready (parked pending the design round)`), while a continuation like `Ready for review` names something other than parked work and reads as unrecognized. So a malformed Status or Commit Model line does surface locally, since the plan drops out of the recovery inventory; a malformed row anywhere else in the table gives no local signal at all, and only the engine notices, silently, later.

The Title, Status, Commit Model, `## Sections of Work`, section heading, and section model rows are normatively instanced in the brainstorming skill's spec format (`skills/brainstorming/SKILL.md`, Spec format), though its own `Model:` pick-list includes a decorated value that silently downgrades per the row above, so a plan built from the template still needs its `Model:` lines checked against the bare-token rule. The `## Chapters`, Chapter heading, Completed, and Next rows are normatively instanced in `executing-work/SKILL.md`'s Chapter format.

This is a frozen v1 contract. Changing the shape or value rule of any row is a coordinated, versioned change with the OS repo, never a drive-by edit to plan-doc prose. A value a row's existing rule already decides, `Ready` under the Status row, is not such a change: it adds a kit-side meaning to an answer the strict reader was already giving, and the row's rule is untouched.

`## Assumptions` and `## Dispatch Authorization` are the two headings this placement rule is written for, and it holds them to different positions. Neither appears in any row above, so a plan gains either with no contract version change. Being unparsed is not what distinguishes them, since every heading the table does not name sits outside the rows too, `## Goal` and `## Approach` among them. What separates the two from each other is that the spec template already fixes where `## Assumptions` goes and fixes nothing for `## Dispatch Authorization`, so only the second leaves the position to whoever adds it.

`## Dispatch Authorization` goes **above** `## Sections of Work`, which is stricter than outside it, because two blocks here are bounded by the next `##` heading of any kind and a heading dropped in the wrong place truncates one with no error. Inside `## Sections of Work` it ends that block, dropping every later `### N.` section from the parse. After `## Chapters` it ends the Chapters block the same way, so every Chapter below it stops registering its `Completed:` line and the section count and `Next` pointer freeze. Above `## Sections of Work` is the one position that bounds nothing, and naming that single position is the whole rule, since no template reserves a place for this heading and a writer adding it has nothing else to go on.

`## Assumptions` takes the weaker rule, outside `## Sections of Work` and above `## Chapters`, because the spec template already places it: `skills/brainstorming/SKILL.md` puts it after `## Out of Scope`, which is below the sections block and above `## Chapters`. That position is safe for a reason the strict rule would otherwise talk past. `## Out of Scope` already sits between the last section and `## Chapters` in every plan built from the template, so the sections block is bounded there whatever `## Assumptions` does, and a section added mid-run is typed inside that block rather than after it. Reading the strict rule onto `## Assumptions` would put every plan in this repository in violation of a rule this file states, which is how one question ends up with two surfaces answering it differently.

Adding either heading to an approved plan is still a change worth recording. The approval-scoped fingerprint covers everything above `## Chapters`, and the only safe placement is inside that region, so a plan that gains one mid-run reads as approval drift to the engine: make the addition deliberately and name it in the Chapter, exactly as for any other edit above that line.

## Templates

The README, index, and backlog skeletons live in `references/templates.md`. Seed from there rather than inventing a new shape per project, so every project's library reads the same way.

## Antipatterns

- Closing a plan in place: status flipped to Complete, file never moved.
- A backlog that only grows because completed items are struck through instead of moved to a snapshot.
- Forking a parallel copy of a doc instead of updating it in place.
- Editing an archived plan to reflect new work. New work gets a new plan, cross-referenced to the one it builds on.
