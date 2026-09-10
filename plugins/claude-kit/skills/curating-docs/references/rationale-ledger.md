# Rationale ledger: curating-docs

This file is the rationale ledger for the documents the `curating-docs` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed and the baseline-test flag on a behavior-shaping rewrite are recorded in the corpus audit plan's scratch adjudication log (the plan is `claude-kit_corpus-audit_spec_v1.md` under `docs/`), which that plan's rewrite section consumes; this ledger does not carry them.

## plugins/claude-kit/skills/curating-docs/SKILL.md

This document is the kit's rulebook for keeping a project's `docs/` folder a curated library rather than an attic of finished plans. It owns four moments: archiving a plan that has reached Complete or abandoned (the close path), registering and cross-referencing a newly written plan (the create path), pruning and age-checking `docs/backlog.md`, and retrofitting an existing `docs/` tree into the three-zone taxonomy. It also owns the frozen v1 plan-doc header contract, stating the exact line shapes and value rules an external parser reads, and the placement rules for the `## Assumptions` and `## Dispatch Authorization` headings. Its load class is `named-trigger`: its own description says to use it during finishing-work when a plan reaches Complete, when a new plan is written that should be indexed, or when someone asks to tidy, retrofit, or reorganize a project's `docs/` folder.

Extracted at `6bc07fb`: whole document (`skills.curating-docs.SKILL.md`).

### C001
- key: Treat a plan as finished only once it is archived, the backlog is pruned, related plans link each other, and the index matches reality.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:8
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan (docs/archive/claude-kit_docs-lifecycle_spec_v1.md), whose Goal records that plans were closed in place and docs/plans/ drifted into an attic.
- verdict: rewrite
- reason: The definition is the owner's statement of finished and stays; the three sentences of failure narrative around it are the plan's Goal restated and are not needed to obey the definition. The class still recurs (memory plans-authored-elsewhere-never-reach-the-index, 2026-08-30), which is why the definition itself is not up for trimming.

### C002
- key: Keep stable about-the-solution docs and the README index in the `docs/` root, updating them in place as the solution changes.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:16
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's taxonomy (Section 1).
- verdict: keep
- reason: The taxonomy row is the owner's text; the templates.md copy is the skeleton seeded into a project README whose reader never loads the skill, and the docs-curator charter carries the constraint because a dispatched agent starts blank. Neither copy is a reason to thin the row.

### C003
- key: Keep only open or in-progress plans in `docs/plans/`, and move a plan out the moment it is Complete or abandoned.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:17
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan: plans closed in place filled docs/plans/ with finished work.
- verdict: keep
- reason: The owner's row; the hooks (session-start.js:1477, stop-docs-hygiene.js:173) nag on the Complete-but-unmoved shape but perform no move, so the rule is still what a session obeys. finishing-work and the doctrine point here per the ownership map.

### C004
- key: Put finished and abandoned plans with Chapters intact and dated backlog snapshots in `docs/archive/`, and treat it as immutable history.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:18
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's taxonomy.
- verdict: keep
- reason: Immutability is the property the archived-plan carve-out (C016) and the no-edit rule (C060) rest on, and it is what settled the create-path contention (C023) in the archive's favour. Nothing mechanical guards the archive.

### C005
- key: Keep `docs/backlog.md` to active items only, moving completed items out to a dated snapshot as they finish.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:19
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan: the backlog grew without bound because items were struck through in place.
- verdict: keep
- reason: The owner's row; the doctrine states the principle and names this skill as owner. session-start.js reports the backlog's counts but prunes nothing.

### C006
- key: Do not zone or move `docs/coordinator-board.md` during a curating pass; it belongs to the coordinator seat.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:21
- provenance: 33c0bed 2026-08-26, the coordinator plan: without a taxonomy row a curating pass reads the board as a stray, and without the charter line a finishing pass rewrites the seat's state; ebf5ee0 2026-08-28 reworded it when the board moved into the memory store.
- verdict: rewrite
- reason: The act and its seat-state reason stay on both surfaces because the skill reaches the main session and the charter reaches a blank-start curator. The memory-store provenance clause and the "charter says so in the same words" note are history and drop without changing the act.

### C007
- key: Keep the two append disciplines separate: a plan's Chapters are append-only and travel into the archive, while the backlog is pruned live.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:23
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's Approach, which states the two disciplines verbatim and names conflating them as the endless-append cause.
- verdict: rewrite
- reason: The split is stated twice in the document (here and the tail of line 54) and only the second copy carries the backlog's positive scope; one paragraph carries both halves after the merge. The "endless-append" diagnosis is the incident's why and lives here.

### C008
- key: Run the six close-path steps in order as part of close-out.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:27
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan (Section 2, archive-on-complete as part of close-out).
- verdict: keep
- reason: No finding. The order matters because step 2's move precedes the link repoint and the re-add that afc7790 and aeffbb2 added.

### C009
- key: Confirm the plan reads `Status: Complete` (or abandoned) with a final Chapter written; stop if it is not actually done.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:29
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan.
- verdict: keep
- reason: No finding. The doc-closeout-discipline plan (2026-06-28) later made Complete the doc's terminal state at delivery regardless of commit model, which this step's check presupposes.

### C010
- key: Move the plan with `git mv docs/plans/<file> docs/archive/<file>` in a git-tracked repo, or a plain move otherwise.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:30
- provenance: b49a47b 2026-06-19 (the docs-lifecycle plan's "git mv, history preserved"), reworded by aeffbb2 2026-08-09.
- verdict: keep
- reason: The owner's mechanic with its non-git fallback; finishing-work and the templates skeleton restate the `git mv` only. A kaizen note of 2026-09-04 records a project whose archive is nested (`docs/archive/plans/`), which the flat path here does not describe; that is a gap for the rewrite plan to weigh, not a reason to drop the step.

### C011
- key: Re-run `git add` on the moved file whenever it carries unstaged edits, so the finalized content is what commits.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:30
- provenance: aeffbb2 2026-08-09, a close-out that finalized the doc, moved it, and committed the pre-finalization bytes because `git mv` stages index content.
- verdict: keep
- reason: The class recurred after the sentence shipped (operator memory git-mv-stages-the-index-content-not-your-edits, applied x6) and no hook catches it, so the rule and its one-line why stay at the point of action; the why is what keeps the re-add from reading as superstition beside a `git mv` that appears staged.

### C012
- key: Read the `RM` pair against the file in `git status --short` as the sign that the moved file still needs re-adding.
- class: rationale-example
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:30
- provenance: aeffbb2 2026-08-09, same incident as C011.
- verdict: keep
- reason: C011's condition is observable only through this tell, so the rule cannot be obeyed without it. The operator memory names a second tell after the commit (a 100% rename similarity in `git show --name-only` on a file you edited) the rewrite plan may add.

### C013
- key: Repoint the moved plan's relative links by grepping it for `../archive/` and fixing every hit.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:31
- provenance: afc7790 2026-07-25, an archived plan whose `../archive/<file>` links to sibling plans broke once it sat in archive/ itself.
- verdict: rewrite
- reason: The grep, the fix target (`<file>` once archived) and the timing are the rule and stay; the closing "not an edge case" clause argues for the step's existence, which this entry now does.

### C014
- key: Ensure a plan and any plan it built on or superseded link each other via a `## Related` section, and mark a superseded plan in its header.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:32
- provenance: b49a47b 2026-06-19 (cross-reference on close), extended by afc7790 2026-07-25 with the one-way carve-out.
- verdict: rewrite
- reason: Three duties (link both ways with the header mark, act on the curator's gaps, the archived-plan carve-out) share one step and all survive as separate sentences; the carve-out's restated archive rationale is C004's and drops. This step is the single statement the create path (C023) now points at.

### C015
- key: Act on any cross-reference gap the `docs-curator` flagged.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:32
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's Section 3 (finishing-work acts on the curator's cross-ref gaps via this skill).
- verdict: keep
- reason: The owner's duty; finishing-work restates it as the map's pointer surface.

### C016
- key: When the related plan is already archived, add the `## Related` section only to the moving plan and leave the archived one untouched.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:32
- provenance: afc7790 2026-07-25, "the cross-reference runs one way when the other plan is already archived".
- verdict: keep
- reason: The carve-out is the later and more specific rule, consistent with the archive's immutability, and it is the side that wins the create-path contention (C023) and brainstorming's both-directions wording. It is a rule-plus-exception beside C014, not a contradiction.

### C017
- key: Prune the backlog as part of the close path.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:33
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan, reworded by afc7790 2026-07-25.
- verdict: keep
- reason: A five-word step that already points at the prune section; finishing-work names it as the map's pointer.

### C018
- key: Refresh both `docs/README.md` and `docs/plans/README.md` so each drops the plan from its active list and reflects the archive, including any "most recent" pointer.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:34
- provenance: afc7790 2026-07-25, which "names both index files rather than one".
- verdict: keep
- reason: Two indexes move on every archival (memory archiving-a-plan-touches-two-indexes-not-three, applied x10); finishing-work's one-index wording is the surface that gives way, since this skill owns index refresh.

### C019
- key: Move a Complete plan out of `plans/` rather than relying on the status header, because status is not location.
- class: rationale-example
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:40
- provenance: b49a47b 2026-06-19, the excuses table written for the rule "that died last time" (plans closed in place).
- verdict: retire
- reason: The act is C003, and the signal this row invokes (a Complete plan polluting the resume scan) is now raised mechanically by session-start.js:1477 and stop-docs-hygiene.js:173, so the excuse is answered by a hook. The why: a Complete plan left in plans/ is listed as unarchived at every session start and turn end until moved.

### C020
- key: Archive the plan in the same close-out that finished the work, never later or in a batch.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:41
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan: deferring the archive "to later or a batch" is how plans accumulated in docs/plans/.
- verdict: rewrite
- reason: The timing bound is a rule the taxonomy row does not carry and survives as a sentence in the close path; "Later is where this rule died before" is change-narrative and its incident is recorded here and in the archived plan.

### C021
- key: Do not fear losing history when moving a plan; `git mv` preserves history and the Chapters move with the file.
- class: rationale-example
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:42
- provenance: b49a47b 2026-06-19, the excuses table.
- verdict: retire
- reason: Step 2 already states "so history is preserved" and "the Chapters travel with the file untouched" at the point of action, so this row is a second copy of the same reassurance.

### C022
- key: Add a newly written spec to the active-plans list in `docs/README.md` before handing it to `executing-work`.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:48
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's Section 4 (brainstorming registers a new plan in the index).
- verdict: keep
- reason: The owner's create-path step; brainstorming:28 invokes the create path by name and is the pointer surface. Memory plans-authored-elsewhere-never-reach-the-index records that plans skipping this step stay unlisted until their own close-out.

### C023
- key: For a new plan that builds on or supersedes another, add a `## Related` section linking both directions and note the supersession in the older plan's header.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:49
- provenance: b49a47b 2026-06-19, the create path, written before afc7790 2026-07-25 added the archived-plan carve-out to the close path.
- verdict: rewrite
- reason: For an older plan already archived, this step's header note contradicts C004, C016, C060 and the archive README; the carve-out is the later rule and the archive is immutable, so the create path points at the close path's statement rather than restating it without the exception. brainstorming:28 restates the same both-directions wording and gives way on the same trace.

### C024
- key: Add any cross-effort next-steps that surfaced during design to `docs/backlog.md`.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:50
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's Section 4.
- verdict: keep
- reason: No finding. It is the create-path half of the backlog's cross-effort scope.

### C025
- key: Move a done backlog item into the quarter's snapshot at `docs/archive/backlog-YYYY-QN.md`, creating the file if absent and appending within the quarter.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:54
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan (backlog-prune to a dated quarterly snapshot).
- verdict: keep
- reason: The owner's mechanic with path, creation and append rule; finishing-work summarizes it and the templates skeletons carry the filename for project readers.

### C026
- key: Do not strike backlog items through in place.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:54
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan: strikethrough in place is how the backlog grew without bound.
- verdict: rewrite
- reason: The prohibition and the snapshot mechanic are the prune section's own and stay; the paragraph's opening restatement of the taxonomy row and its closing restatement of the Chapters-versus-backlog split drop, the latter merging into line 23. The Antipatterns copy (C058) retires in favour of this line.

### C027
- key: On each prune pass read every active item's parked date and name each item older than 90 days, with its date, for a promote, retire, or keep call.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:56
- provenance: fa5df56 2026-08-09, the backlog-visibility plan (docs/archive/backlog-visibility_spec_v1.md): parked items sat unseen, so the prune pass doubles as a 90-day aging check.
- verdict: rewrite
- reason: The check and its three outcomes with their mechanics all stay; the paragraph is split one sentence per rule and loses only its summary sentence. The tunable-knob sentence stays because the doctrine's craft rule asks for the knob to be named. session-start.js reports the oldest parked date but adjudicates nothing.

### C028
- key: When keeping an aged item, write the fresh adjudication date ahead of the original as `(YYYY-MM-DD, parked YYYY-MM-DD)` with the reason it stays.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:56
- provenance: fa5df56 2026-08-09, the backlog-visibility plan.
- verdict: keep
- reason: The surfacing layer ages an item from the first date on its line (templates.md:85), so the order of the two dates is load-bearing and the form must be stated where the keep call is made.

### C029
- key: Treat an undated active item as past the threshold: give it a parked date from git history or today's marked `backfilled`, and adjudicate it in the same pass.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:56
- provenance: fa5df56 2026-08-09, the backlog-visibility plan (undated backfill).
- verdict: keep
- reason: The templates skeleton's "counted but ageless" describes the hook's reading of the same item and ends in the same act (backfill and adjudicate in the same pass), so the two are one rule seen from two readers, not a conflict.

### C030
- key: Offer the prune pass in one line when the session-start block reports an oldest item past the threshold and no close-out is near.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:56
- provenance: fa5df56 2026-08-09, the backlog-visibility plan ("a standalone trigger").
- verdict: keep
- reason: The session-start block (session-start.js) raises the signal and this sentence is what turns it into an offer; without it the block is a number nobody acts on outside a close-out.

### C031
- key: Start a retrofit with a read-only audit: list every doc, read each plan's `Status` header, and classify each as active plan, completed or abandoned plan, about-the-solution doc, or stray.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:62
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's retrofit mode (read-only proposal first).
- verdict: rewrite
- reason: The trailing "Read before proposing" restates the step's own label and the next step's order; dropping it changes nothing a session does.

### C032
- key: Propose the migration, naming which plans move, what the index and backlog will hold, and which READMEs get seeded, then stop and move nothing until confirmed.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:63
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's retrofit mode ("read-only proposal first, apply on approval").
- verdict: rewrite
- reason: The gate is a blast-radius stop over a library-wide batch of moves, the doctrine's "migrate" case, and stays; the stop is stated twice and collapses to one sentence that carries its reason. No standing grant covers a retrofit, so this is not a loop-maintenance gate.

### C033
- key: On approval, create the zones and READMEs from the templates, `git mv` completed and abandoned plans into the archive, seed the index and backlog, and report what moved.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:64
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's retrofit mode.
- verdict: keep
- reason: The release half of the retrofit gate (class blast-radius, same as C032); the readers' splits keep every word, so there is nothing to compress.

### C034
- key: Never delete a file during a retrofit; relocate it instead.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:64
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan.
- verdict: keep
- reason: Governs a retrofit pass over a whole tree, where the archive README's "nothing is deleted here" governs one folder; neither contains the other.

### C035
- key: Reproduce plan-doc header lines in their exact case and line-start position rather than rewording them, since a reworded line parses as absent.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:68
- provenance: 662e5e3 2026-08-01, fleet S6: the plan declaring the contract violated it twice, and "nothing in the kit told a plan author which lines are load-bearing".
- verdict: keep
- reason: No kit hook validates the rows, so the prose is the only guard, and the silent-default sentence is what makes a session check values rather than key shapes. The engine's name is what C051's coordinated-change rule needs.

### C036
- key: Write the title as the first H1 (`# <Title>`) with a free-form value.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:72
- provenance: 662e5e3 2026-08-01, fleet S6.
- verdict: keep
- reason: No finding; a contract row.

### C037
- key: Write `Status: <value>` above the first `##` heading, and use exactly `Complete` with no trailing text for a plan to read as terminal.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:73
- provenance: 662e5e3 2026-08-01 for the terminality rule; 897d921 2026-08-29, the plan-lifecycle plan, added `Ready` after two finished drafts headed `Draft` went unseen by every recovery surface.
- verdict: keep
- reason: kit-goal-lib.js classifyPlanStatus and session-start.js read the value and nothing writes it, so the exact-value duty is still the author's. The skeleton and brainstorming restate the values by design because 897d921 found "readers and no producer".

### C038
- key: Write `Commit Model: <value>` above the first `##` heading, opening with `Commit-and-Push`, `Branch-and-PR`, or `Review-Only`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:74
- provenance: 662e5e3 2026-08-01 for the row; 3dc5d86 2026-08-03 extended it "for automated execution ... with the kit-goal or the ai-os subsystems".
- verdict: keep
- reason: "Parks the run" is the engine's behavior on a bad value and the doctrine's ask-before-pushing is a kit session's, two consumers rather than a conflict; session-start.js:1203 reports such a value as unknown. The ownership map gives this skill the admissible values.

### C039
- key: Under `Branch-and-PR`, name a pull request per section in the trailing prose to get per-section PRs; anything else takes the draft-per-plan default.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:74
- provenance: 3dc5d86 2026-08-03, the engine's reading of the trailing prose.
- verdict: keep
- reason: No finding on this claim; it states how the engine parses the value. Its default's kit-side meaning is C065's question.

### C040
- key: Write `Disjoint: yes` above the first `##` heading to declare a plan independent of other in-flight work; anything else or an absent header means not disjoint.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:75
- provenance: 3dc5d86 2026-08-03.
- verdict: keep
- reason: No finding; an engine-read row with a safe default.

### C041
- key: Use the literal `## Sections of Work` heading and insert no other `##` heading inside that block, which would silently drop every later `### N.` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:76
- provenance: 662e5e3 2026-08-01, fleet S6.
- verdict: keep
- reason: The row states what bounds the block; the placement rules (C053, C054) rely on that consequence and add nothing to it.

### C042
- key: Write each section heading as `### N. <Title>` (digits, a period, whitespace) inside `## Sections of Work`, with a free-form title.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:77
- provenance: 662e5e3 2026-08-01, fleet S6.
- verdict: keep
- reason: No finding. A kaizen note of 2026-09-08 records that every plan in the tree carries `Model:` on the heading line while the next row says "the first one following a section heading"; that gap in the row's shape statement is the rewrite plan's to weigh with the OS repo, since the shape is frozen.

### C043
- key: Write the section model line as `Model: haiku`, `sonnet`, `opus`, or `fable` as a bare token, since a decorated value silently dispatches at a default sonnet model.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:78
- provenance: 662e5e3 2026-08-01 (the plan's own sections carried a compound value and would have dispatched at sonnet), refined by c2114e9 2026-08-01, which split locus off the line.
- verdict: keep
- reason: The row owns the value rule and brainstorming's template instances it as bare tokens since c2114e9; the silent downgrade has no kit-side reader, so the prose is the guard.

### C044
- key: Put whether a section is dispatched or built in the main thread on its own `Locus:` line, which no consumer parses.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:78
- provenance: c2114e9 2026-08-01: `fable (inline)` on the Model line downgraded the section on the engine side and never delivered Fable on the kit side.
- verdict: keep
- reason: The contract records that Locus is deliberately unparsed so the tier can stay bare; brainstorming carries the authoring rule. Each surface has its own half by c2114e9's design.

### C045
- key: Use the literal `## Chapters` heading and never rename it, since it bounds the Chapters block and stops the approval-scoped fingerprint.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:79
- provenance: 662e5e3 2026-08-01, fleet S6.
- verdict: keep
- reason: The fingerprint detects drift after a rename and repairs nothing, so the literal-heading duty is the author's.

### C046
- key: Write each Chapter heading as `### Chapter N` with N one or more digits, inside `## Chapters`; a trailing date is convention only.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:80
- provenance: 662e5e3 2026-08-01, fleet S6.
- verdict: keep
- reason: The row states what is parsed; executing-work's Chapter template writes the dated form and is the instance 662e5e3 placed "in the skill a session has loaded at the moment it writes the thing".

### C047
- key: Write the Chapter's `Completed:` value starting with the section number followed by a period or space, or equal to the section title exactly.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:81
- provenance: 662e5e3 2026-08-01: every Completed line in the declaring plan read "Section N, <title>" and matched none of the forms.
- verdict: keep
- reason: This row is the only statement of the registering forms the executing-work template's pointer lands on (the template itself writes `Completed: <section name>`), and the kaizen note of 2026-09-03 records the miss recurring; no hook rejects a bad value.

### C048
- key: Check an existing Chapter's `Completed:` line against the three accepted forms before assuming it registers.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:81
- provenance: 662e5e3 2026-08-01, same incident as C047.
- verdict: keep
- reason: The near-miss example is the incident's shape and the class recurred on 2026-09-03, so the example is what a session checks against and stays in the cell.

### C049
- key: Write the Chapter's `Next: <value>` line with a free-form value; the first one in the Chapter is read.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:82
- provenance: 662e5e3 2026-08-01, fleet S6.
- verdict: keep
- reason: The row fixes the shape; the Chapter template gives its conventional values. Same split as C046.

### C050
- key: Check a template-built plan's `Model:` lines against the bare-token rule, since the brainstorming pick-list includes a decorated value that silently downgrades.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:86
- provenance: 662e5e3 2026-08-01, which left the decorated pick-list value "open and unresolved by design"; c2114e9 2026-08-01 then dropped it from the template.
- verdict: retire
- reason: The premise is false at HEAD: brainstorming's pick-list at line 77 reads `haiku | sonnet | opus | fable`, so there is no decorated value to check for. The two instancing sentences around the clause stay, since C051's coordinated-change scope needs them.

### C051
- key: Treat any change to a row's shape or value rule as a coordinated, versioned change with the OS repo, never a drive-by edit to plan-doc prose.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:88
- provenance: 662e5e3 2026-08-01 for the freeze; 897d921 2026-08-29 added the bound that a value the row's rule already decides (`Ready`) is not a contract change.
- verdict: rewrite
- reason: The rule and the bound stay; the opening "This is a frozen v1 contract" restates the table's introduction. The why of the bound: `Ready` is non-terminal under the Status row exactly as every other non-Complete value is, so adding a kit-side meaning to it changes no answer the strict reader gives.

### C052
- key: Add `## Assumptions` or `## Dispatch Authorization` to a plan with no contract version change, since neither appears in any contract row.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:90
- provenance: 2993ac4 2026-08-25 (the dispatch-authority plan added the section as inert to the contract); f75e235 2026-08-26 split the two headings' positions after a fix round over-strengthened the Assumptions rule.
- verdict: rewrite
- reason: The one act stays as one sentence. The why of the two-position split, now here: the spec template already fixes where `## Assumptions` goes (after `## Out of Scope`, below the sections block) and fixes nothing for `## Dispatch Authorization`, so only the second leaves the position to whoever adds it; reading the strict rule onto `## Assumptions` put every plan in this repository in violation.

### C053
- key: Place `## Dispatch Authorization` above `## Sections of Work`, the one position that bounds no block.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:92
- provenance: 2993ac4 2026-08-25, which corrected "a placement rule that permitted a position which silently truncates a later section append".
- verdict: rewrite
- reason: The position and its two failure modes (inside the block drops later sections; after `## Chapters` freezes the Chapters parse) are the rule and stay; the closing argument that naming one position is the whole rule is this entry's job. No template reserves a place for this heading, which is why the position must be stated.

### C054
- key: Place `## Assumptions` outside `## Sections of Work` and above `## Chapters`.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:94
- provenance: f75e235 2026-08-26: a fix round strengthened "outside" to "above" without reading the spec template, and every plan in the repository was then in violation.
- verdict: rewrite
- reason: The position and the template's satisfying placement stay; the four sentences of argument move here. The why: `## Out of Scope` already sits between the last section and `## Chapters` in every template-built plan, so the sections block is bounded there whatever `## Assumptions` does, and strengthening this rule is a cross-file change against the template even when the edit touches one file.

### C055
- key: Add either heading to an approved plan deliberately and name the addition in the Chapter, since it reads as approval drift.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:96
- provenance: 2993ac4 2026-08-25, the dispatch-authority plan.
- verdict: rewrite
- reason: brainstorming:96 owns the general rule for any deliberate amendment above `## Chapters` and executing-work:73 applies it to header normalization; this paragraph becomes the two-heading instance pointing at that rule instead of restating the fingerprint mechanics C045's row already carries.

### C056
- key: Seed README, index, and backlog skeletons from `references/templates.md` rather than inventing a new shape per project.
- class: pointer
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:100
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's Section 2 ("templates are referenced, not inlined into every caller").
- verdict: keep
- reason: No finding; the pointer at the skeleton source.

### C057
- key: Do not close a plan in place by flipping status to Complete and never moving the file.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:104
- provenance: b49a47b 2026-06-19, the Antipatterns list of the docs-lifecycle plan's skill.
- verdict: retire
- reason: The negation of C003 and C020 in the same document, and its exact shape is caught by stop-docs-hygiene.js:173 (holds the turn once, naming the files) and session-start.js:1477, the hooks the docs-lifecycle plan's Sections 6 and 8 installed as the net for this failure.

### C058
- key: Do not let the backlog only grow by striking completed items through instead of moving them to a snapshot.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:105
- provenance: b49a47b 2026-06-19, the Antipatterns list.
- verdict: retire
- reason: A restatement of C026 from the prune section of the same document with no added bound and no hook; the owner line carries it.

### C059
- key: Do not fork a parallel copy of a doc; update it in place.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:106
- provenance: b49a47b 2026-06-19, the Antipatterns list.
- verdict: keep
- reason: The skill's only explicit no-fork statement (C002's row says "updated in place" and names no forking); the docs-curator charter carries the same constraint because a dispatched curator loads no skill.

### C060
- key: Do not edit an archived plan to reflect new work; write a new plan cross-referenced to the one it builds on.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:107
- provenance: b49a47b 2026-06-19, the Antipatterns list, alongside the archive README skeleton's identical rule.
- verdict: keep
- reason: The skill's only statement of the act that C004's immutability implies, and the rule the create path (C023) now defers to for an archived older plan.

### C061
- key: Keep the backlog scoped to cross-effort next-steps only, kept lean, distinct from per-plan Chapter history.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:54
- provenance: b49a47b 2026-06-19, the docs-lifecycle plan's Approach (the backlog is cross-effort next-steps; Chapters are the effort-level history).
- verdict: rewrite
- reason: The scope survives but moves into the line 23 paragraph beside the two-disciplines split it completes; the half-sentence at line 54 goes. The templates skeleton keeps its copy for the project reader.

### C062
- key: When the aging-check call on an item is promote, write its spec now.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:56
- provenance: fa5df56 2026-08-09, the backlog-visibility plan's promote/retire/keep call.
- verdict: keep
- reason: No finding of its own; the promote outcome's mechanic, kept whole by the C027 rewrite.

### C063
- key: When the aging-check call on an item is retire, move it to the backlog snapshot along with the reason for retiring it.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:56
- provenance: fa5df56 2026-08-09, the backlog-visibility plan.
- verdict: keep
- reason: No finding of its own; the retire outcome's mechanic, kept whole by the C027 rewrite.

### C064
- key: When a worker runs under the external engine, do not touch the plan's Status header at all; setting it to In Progress at start is executing-work's own instruction, not this contract's guarantee.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:73
- provenance: 897d921 2026-08-29, the plan-lifecycle plan; the stand-down itself is the external-engine-standdown plan's (2026-07-22), which names executing-work's Run Mode check as the rule's owner.
- verdict: rewrite
- reason: Not a conflict with the close-out flip or the Ready move: an external-engine worker runs its directed section only and never reaches the finishing pass, so those are a kit-native session's acts. The rule is executing-work's (":73: leaves the header to its engine") and this cell keeps a pointer rather than a copy.

### C065
- key: Under the draft-per-plan default, open one draft PR at the first section close, refresh it each section, and flip it ready during the finishing pass.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/SKILL.md:74
- provenance: 3dc5d86 2026-08-03, written "for automated execution ... with the kit-goal or the ai-os subsystems".
- verdict: rewrite
- reason: The sentence describes what the engine does with the trailing prose, but read as a kit instruction it contradicts executing-work:469 ("The PR happens in finishing-work") and finishing-work:89, and the ownership map lists the tension under Unowned or contested. Word it as the engine's value rule and point at finishing-work for the kit's own PR moment; the operator's ruling on the contested row is what closes it.

## plugins/claude-kit/skills/curating-docs/references/templates.md

This document is a set of copy-ready skeletons for a project's `docs/` library: the index README, the active-plans README, the archive README, the living backlog, and the dated quarterly backlog snapshot. It owns the moment when a session seeds a new `docs/` library or retrofits an existing one, deciding what files exist, what headings and placeholder text each carries, where a plan or a backlog item lives at each point in its life, and how each is named. It also fixes the naming shapes (`<project>_<content-type>_v<n>.md`, `backlog-YYYY-QN.md`), the dated backlog item form, and the archive-on-close rule that the skeletons state to their own readers. A session loads it as a `named-trigger` (inferred) reference: it carries no frontmatter and no statement of when it loads, but its content is only usable at the specific act of creating or reorganizing the docs tree, so it is read immediately before that act rather than at session start or on every plan run.

Extracted at `6bc07fb`: whole document (`skills.curating-docs.references.templates.md`).

### C001
- key: Build a new or retrofitted `docs/` library from the skeletons in this document.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:3
- provenance: b49a47b 2026-06-19, the commit that created the curating-docs skill and its templates so a project carries a seamless record of what is open, what was planned and what was done.
- verdict: keep
- reason: this is the file's only self-description, and the file carries no frontmatter and no load condition, so a session opening it needs the line to know the fences below are copy-ready output rather than rules to obey. The SKILL's retrofit step is the call site, not a duplicate.

### C002
- key: Replace every `<project>` placeholder in the skeletons with the project's name.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:3
- provenance: b49a47b 2026-06-19, shipped with the skeletons it governs.
- verdict: keep
- reason: no finding. The placeholder is literal text in three skeletons and nothing else in the corpus says to substitute it.

### C003
- key: Write the seeded docs in the kit style: no em dashes, prose for the why, lists for catalogs.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:3
- provenance: b49a47b 2026-06-19, shipped with the skeletons; the traits it names are owned by doctrine's Style section and the house writing style, both of which predate and outlive this line.
- verdict: rewrite
- reason: this is the one claim in the unit that instructs the session rather than a project's readers, and the session already has doctrine loaded, so a three-trait copy here can only drift from its owners. Replacing it with a pointer at the house style loses nothing and removes the drift surface.

### C004
- key: Title the index file `docs/README.md` with the heading `# <project> Docs`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:10
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding. Fixed skeleton text; the index's path and heading are what the taxonomy's root row refers to.

### C005
- key: Open the index with a line stating the directory is the working library and project history: solution documents, active plans, and archived finished work.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:12
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding. Body text of a generated file, addressed to a project's own contributors.

### C006
- key: Give the index a `## Folder map` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:14
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C007
- key: Keep stable solution documents in the `docs/` root, including architecture, design rationale, and any security model.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:16
- provenance: b49a47b 2026-06-19, the taxonomy's root zone shipped together with the skeleton that states it to a project.
- verdict: keep
- reason: the SKILL's taxonomy table is the rule and this fenced line is the artifact the rule produces, read by contributors who never load the kit. A pointer here would be a dangling reference in every seeded project.

### C008
- key: Keep only open or in-progress plans in `plans/`, and move a plan to `archive/` the moment it is Complete or abandoned.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:17
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: shipped index text, not a second statement of the SKILL's rule; and the index, the plans README and the plans README's Rules list are three different generated files with three different readers. The line's three sentences carry three distinct things, so the proposed compressions each drop one.

### C009
- key: Read `plans/README.md` for the active-plans folder's own rules.
- class: pointer
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:17
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding. This is the in-project pointer a seeded index is supposed to carry, and it points at a sibling in the same tree rather than at a kit skill.

### C010
- key: Keep finished and abandoned plans with their Chapters, plus dated backlog snapshots, in `archive/`, and treat it as immutable history.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:18
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: as C008: shipped index text whose reader has no kit on the shelf. Its relation to C032 and C037 is one rule and, in two other generated files, the move that satisfies it and the act that violates it.

### C011
- key: Read `archive/README.md` for the archive folder's own rules.
- class: pointer
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:18
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding. In-project pointer, as C009.

### C012
- key: Give the index a `## Living documents` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:20
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C013
- key: Keep `backlog.md` as the single living handoff and next-steps doc carrying only active items, and prune completed items to a dated snapshot in `archive/`.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:22
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: shipped index text; it tells a contributor why the backlog is short, where the seeded `backlog.md` itself tells the person about to edit it what to do. Two files, two readers.

### C014
- key: Give the index an `## Active plans` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:24
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C015
- key: List each active plan in `plans/` under the index's Active plans section with a one-line description, and write "None at present." when there are none.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:26
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: the SKILL owns when the list is refreshed and this owns what the seeded section looks like, including its empty form; delete it and a seeded index carries a heading with no instruction. The close path requires both this list and the plans README's to be refreshed, so the pair is duplication between two outputs by design.

### C016
- key: Give the index an `## Archive` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:28
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C017
- key: Fill the index's Archive section with a line directing the reader to `archive/` for completed plans and backlog snapshots.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:30
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C018
- key: Title `docs/plans/README.md` with the heading `# Active Plans`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:38
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C019
- key: Hold only open or in-progress plan specs in the `plans/` folder.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:40
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: the plans README states its own folder's rule to whoever opens that folder, which is not the same reader as the index's. Rule versus its output against the SKILL's taxonomy row.

### C020
- key: Treat a plan as the single source of truth for one effort's intent and state, from which a fresh or post-compaction session resumes.
- class: rationale-example
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:40
- provenance: b49a47b 2026-06-19; the failure it guards is recorded in the SKILL's own excuses table, which says archiving-later is "where this rule died before".
- verdict: keep
- reason: this is rationale the rule cannot be obeyed without: C019 is under-motivated on its own, and a contributor who does not know the plan is the resume surface treats `plans/` as scratch space and leaves finished plans in it. Keep it in the document rather than moving it here.

### C021
- key: Give the plans README a `## Rules` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:42
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C022
- key: Keep a plan in `plans/` while it is being worked, and move it to `../archive/` in the same close-out that reaches `Status: Complete` or abandons it.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:44
- provenance: b49a47b 2026-06-19; the same-close-out timing is the rule the SKILL's excuses table records as having died once already to "I will archive it later, or in a batch."
- verdict: keep
- reason: the seeded Rules list is what a session reads at the moment it is about to defer the move, which is exactly when the rule fails. Deleting it for a pointer removes the sentence from the only place the failure happens.

### C023
- key: Perform the move to the archive with `git mv` so history is preserved.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:44
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: the SKILL and the skeleton are deliberately unequal: the SKILL carries the non-git fallback and the re-add duty because it instructs the session, while the parenthetical here tells a project's reader only that history survives. The skeleton is already the reduced form.

### C024
- key: Name a plan file `<project>_<content-type>_v<n>.md`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:45
- provenance: b49a47b 2026-06-19; the ownership map assigns the plan doc's name to `curating-docs`, of which this file is a reference.
- verdict: keep
- reason: this is the canonical general form, `v<n>`, of which doctrine's `v1` is the instance, so the naming shape rests here by ownership. The name shape and the versioning rule beside it state different things and share one bullet by design.

### C025
- key: Increment the version number for a new plan rather than overwriting a prior one.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:45
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: the rule and its alternative are stated fully here where doctrine carries only a parenthetical; the pointer finding proposes doctrine give way, which is a change to doctrine and not to this line.

### C026
- key: Drive the plan lifecycle from the `Status` header: `Ready` plans surface as authored and parked with no resume push, `In Progress` plans surface for resume, and `Complete` plans still in `plans/` are flagged unarchived.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:46
- provenance: 897d921 2026-08-29, the section that added `Ready` after two finished plans on another machine went invisible to every recovery surface because their authors wrote `Draft`, a value the kit does not define.
- verdict: keep
- reason: no program writes the Status value, so nothing supersedes this; the surfacing layers only read it. The apparent clash with the external-engine stand-down is producer versus consumer, not two instructions: that rule says who may write the header, this says what every reader does with whatever value is there.

### C027
- key: Cross-reference a plan that relates to or supersedes another in a `## Related` section.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:47
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: the SKILL carries the header mark and the archived-plan carve-out because it instructs the session at close-out; the seeded Rules list carries the cross-reference duty because that is what a plan author needs at authoring time.

### C028
- key: Give the plans README a `## Current` section listing the active plans, or "None at present." when empty.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:49
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: the index and the plans README both list active plans by design, and the SKILL's close path requires both to be refreshed, so this is duplication between two generated outputs rather than a rule stated twice.

### C029
- key: Title `docs/archive/README.md` with the heading `# Archive`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:59
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C030
- key: State in the archive README that the folder is immutable history and nothing in it is live or pending.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:61
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding. Body text of a generated file whose reader is standing in the archive.

### C031
- key: Give the archive README a `## Contents` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:63
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C032
- key: Move completed and abandoned plans into the archive from `../plans/` with their Chapters intact.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:65
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: this is the archive README's `## Contents` line, and a contents section that points elsewhere for its contents is not a contents section. Rule versus its output against the taxonomy row.

### C033
- key: Name a backlog snapshot file `backlog-YYYY-QN.md`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:66
- provenance: fa5df56 2026-08-09, the backlog-visibility section that added parked dates, the aging check and the quarterly snapshot cadence.
- verdict: keep
- reason: the archive README names the shape so a reader of `archive/` can tell a snapshot from a plan without consulting the kit; the SKILL keeps the path, the creation rule and the append discipline.

### C034
- key: Move completed and retired backlog items into the quarter's snapshot rather than striking them through in place.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:66
- provenance: fa5df56 2026-08-09.
- verdict: keep
- reason: the archive README tells a reader of `archive/` how items arrive and `backlog.md` tells a reader of the backlog how they leave; neither reader holds the other file. The bar on striking through sits here because this is where the older habit is reached for.

### C035
- key: Give the archive README a `## Rules` section.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:68
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C036
- key: Do not edit an archived plan to reflect new work; write a new plan in `../plans/` cross-referenced to the archived one it builds on or supersedes.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:70
- provenance: b49a47b 2026-06-19, original to the document's archive-immutability discipline.
- verdict: keep
- reason: the apparent clash with the supersession-note rule is already carved out in `curating-docs` itself, whose close path says the pointers run one way when the other plan is archived. It is a real clash with `brainstorming` step 9, which states both directions with no carve-out; history and the ownership map put the archive rule on the right side, so brainstorming is the side that gives way, outside this unit.

### C037
- key: Delete nothing from the archive.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:71
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: the retrofit prohibition governs a pass over a whole tree and this governs the archive folder for all time, so neither states the other's scope and a retrofit can relocate a file this rule never sees. Both cold readers reached the same conclusion independently.

### C038
- key: Title `docs/backlog.md` with the heading `# Backlog`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:79
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding, and the filename is read mechanically by the SessionStart backlog block, so the shape is machine-consumed as well as conventional.

### C039
- key: Carry only active items in the backlog, and move a done item out to a dated snapshot in `archive/` named `backlog-YYYY-QN.md` rather than striking it through in place.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:81
- provenance: b49a47b 2026-06-19, with the snapshot filename added by fa5df56 2026-08-09.
- verdict: keep
- reason: the seeded backlog is the file a contributor edits, so the rule about where done items go has to be in it. Both proposed compressions drop "handoff and next-steps", which is the scoping C040 then builds on, so neither is loss-free.

### C040
- key: Keep per-plan history out of the backlog and let a plan's Chapters travel with the plan into `archive/`; use the backlog only for cross-effort next-steps belonging to no single open plan.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:83
- provenance: b49a47b 2026-06-19; the SKILL names conflating the two append disciplines as what produces the endless-append problem.
- verdict: keep
- reason: this states the split in the file where the conflation actually happens, rather than in the skill a person editing a project backlog is not reading. Its three sentences are the exclusion, where that history goes and when, and the positive scope; both compressions drop the "when it closes" timing.

### C041
- key: Write every active backlog item in the dated shape `- **<item> (YYYY-MM-DD).** <body>`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:85
- provenance: c8e1059 2026-08-09, the finishing pass of the backlog-visibility plan, whose hook parses this exact shape.
- verdict: rewrite
- reason: the rule is unchanged and stays; only the sentence boundaries around it move, when line 85's ninety-word sentence is split. The shape is machine-read by the SessionStart backlog block, and a cross-component pin test feeds this very template block to that hook, so any edit is run against `test/session-start-backlog.test.js` before it ships.

### C042
- key: When keeping an item at the aging check, write the fresh adjudication date first and preserve the original date beside it, as in `(2026-11-07, parked 2026-05-01)`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:85
- provenance: c8e1059 2026-08-09; the ordering exists because the hook installed by fa5df56 2026-08-09 ages an item from the first date on its line.
- verdict: rewrite
- reason: the rule survives verbatim and moves into its own sentence in the line-85 split. Keep the first-date-ages clause beside it: without that reason the order is arbitrary and a session writes the dates the other way round, which silently resets the item's age.

### C043
- key: Backfill the date on an undated backlog item and adjudicate that item in the same prune pass.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:85
- provenance: c8e1059 2026-08-09, which also records the rule's first live exercise, on this repository's own two undated backlog items.
- verdict: rewrite
- reason: the duty is unchanged and becomes the third sentence of the split. The change is safe because it moves no rule across a boundary and drops only the surfacing-layer account beside it, which C044 covers.

### C044
- key: Treat an undated backlog item as counted but ageless: the session-start block reports it only in the undated tally and the aging check cannot age it.
- class: rationale-example
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:85
- provenance: fa5df56 2026-08-09, the section that shipped the SessionStart backlog block reporting the active count, the oldest parked date and the undated tally.
- verdict: rewrite
- reason: the half that says the surfacing ages an item from the first date on its line stays, because C042's ordering depends on it; the undated-tally half is an account of a hook's output that C043 is obeyable without, and its why now lives in this entry. It reads as contradicting the SKILL's "past the threshold by definition" only if the two are taken as speaking to one actor: one describes what the hook can compute from a dateless line, the other the session's duty, and this same sentence ends by stating that duty.

### C045
- key: Give the backlog an `## Active` section holding the active next-steps and handoffs, each in the dated item shape.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:87
- provenance: b49a47b 2026-06-19, with the dated shape added by c8e1059 2026-08-09.
- verdict: keep
- reason: no finding, and the section heading bounds what the SessionStart hook counts, so the shape is pinned by `test/session-start-backlog.test.js`.

### C046
- key: Give the backlog a `## Snapshots` section stating that completed and retired items are archived to `archive/backlog-YYYY-QN.md`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:91
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: this is what tells a contributor reading a short backlog where the rest of its history went; the pointer it would be replaced by is not a document the project holds.

### C047
- key: Title a dated backlog snapshot with the heading `# Backlog Snapshot YYYY QN` and state that it holds the completed and retired cross-effort items moved out of `../backlog.md` during that quarter.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:101
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C048
- key: Treat a quarter's backlog snapshot as append-only within that quarter.
- class: rule
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:103
- provenance: fa5df56 2026-08-09, which set the quarterly snapshot cadence the append rule bounds.
- verdict: keep
- reason: the snapshot states its own discipline to whoever opens it next quarter, the reader least likely to have the kit in hand. Four words inside a generated file are not a pointer candidate.

### C049
- key: Write each snapshot entry as one line in the shape `- YYYY-MM-DD: <item, one line, with the outcome>`.
- class: mechanic
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:105
- provenance: b49a47b 2026-06-19.
- verdict: keep
- reason: no finding.

### C050
- key: Treat the archive as the project's memory, which is why nothing in it is deleted.
- class: rationale-example
- source: plugins/claude-kit/skills/curating-docs/references/templates.md:71
- provenance: b49a47b 2026-06-19, whose stated purpose is a seamless record of what is open, what was planned and what was done.
- verdict: keep
- reason: the rationale-retirement rule governs rationale propping up an instruction to the session; this is body text of a shipped artifact, the archive README's own six-word statement of what the folder is for. Retiring it changes what every seeded project says to its readers and saves six words.
