# The board goes back to being the board: durable lessons route to the store at the moment of writing

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-30

Session model: any executor session in the kit repo; four sections, tiers per section. Authored by the KIT: Expert seat from a design dialog with the operator, 2026-08-30. Anchors are authoring-time; re-locate every hit by content, since the standing-lines plan edits the same skill earlier in the queue.

## Dispatch Authorization

Authorized 2026-08-30 by the operator at the keyboard in the expert seat's session: the four-way routing test, the homing operation with no board residue, the readability instrument, and the read-side fold, authored now and appended to the armed queue by the operator's direct instruction (appended seventh; ordered last the same day when the operator ruled the memory-read-side plan runs earlier, so shared-tier triggers exist before the first homing round). This section was authored by the KIT: Expert seat; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's instruction in the expert session's transcript, and the plan entered the armed queue by the expert's append under that same instruction.

## Goal

The coordinator skill closes what the board may carry (roster, efforts, handoffs, resource claims, open escalations, the seat's own commitments) and correctly rules that the board has no standing section, but it never says where a durable fact goes instead, and its maintenance guidance describes only pruning. The growth a mature board actually accumulates is live durable content in the wrong place: pruning it would destroy it, a conscientious seat correctly refuses, and the board grows without bound while following the rules as written. The operator's original design intent, ruled in the authoring dialog, is that the surfaces already exist and were always sufficient: the board holds in-process state to resume from, the memory store holds what is learned, and the kaizen inbox holds what should improve the kit. This plan writes that intent into the skill as mechanism: a routing test at the moment of writing, a homing operation for boards that already grew, a readability instrument in place of the byte ceiling, and the store made visible to the reconciliation pass, so the fix ships with the plugin to every machine on the fleet.

## Evidence

- The design gap, confirmed by this seat's own reads at authoring: the coordinator skill's board-content and no-standing-section rules at `plugins/claude-kit/skills/coordinator/SKILL.md:35`, `:63`, and `:71` (authoring-time), and a whole-file sweep finding zero routing or store-write guidance anywhere in the skill - no `memq` authoring verb, no tier named as a write destination - with the sweep's positive control speaking (the pattern set matches "memory store" at its two known sites). The sweep's patterns are a hand-authored list, so the class "routing guidance" is swept by those names rather than by a shape; the section-1 implementer re-verifies against the file it edits.
- The incident, reported 2026-08-30 by the machine coordinator from its own board restructuring and unverifiable from this repo: a 168 KB board, roughly seventy percent lesson-and-narrative by bytes across four standing sections the skill's list does not admit, and a recorded conclusion after two failed prunes that the ceiling was unreachable by pruning alone because the remaining bulk had nowhere else to live. The ratio is one unusually verbose board's measurement; the mechanism is the finding. The operator reports the other sandboxes complain of the same growth, which is what makes the fix fleet-wide.
- The homing pilot, reported from the same seat: nine records homed to the operator tier in two operations cut 16.4 KB from two of fourteen sections and made the findings readable by every machine on the store rather than one.
- The mechanism under the fix, from the project memory `an-unchallenged-claim-drifts-because-nothing-exercises-it`: a lesson filed where no consumer reads it does not merely go unread, it rots unchallenged, while store records are exercised by recall, recognition, and decay. Homing is therefore not tidiness; it moves claims to the surface where the system pushes back on them.
- The full finding is the kaizen note landed at commit `475207d` (`kaizen/notes-SCOTT-CLAUDE.md`); this plan is its disposition.

## Approach

All four sections are prose contract; nothing here changes enforcement mechanics or ships code. The coordinator skill is the only skill edited, and it points at the memory-system skill for tier mechanics rather than restating them, per the owning-contract pattern. Skill amendments are reviewed whole-file per the recorded amendment defect mode. The standing-lines plan edits the same skill earlier in the queue, so every anchor is re-located by content at implementation.

## Decisions

- Decided 2026-08-30 (operator, in the authoring dialog): the routing test is four-way, not the note's three-way. The note's "durable" bucket hid two destinations with different adjudication paths: a learned fact is self-serve memory authorship, while kit friction is a kaizen note that gets dispositioned. Splitting them is the operator's own surface model (board / memory / kaizen) and removes the residual fork a seat would stall on.
- Decided 2026-08-30 (operator): homing leaves nothing behind on the board - no pointer, no tombstone. Rationale: pointers would themselves accrete, and the board returns to what it was designed to be; the record of the move is a journal entry, which is where journey belongs. The coordinator note proposed board-keeps-pointer and is overruled on this point by the operator's ruling.
- Decided 2026-08-30 (operator): this plan appends to the armed queue rather than parking, so the fix reaches the fleet with the plugin at queue completion.
- Context for future rounds: the operator ruled the same day that memory evolution is the kit's cornerstone (project memory `memory-evolution-is-the-kits-cornerstone`); this plan is an instance of that direction, and a reviewer proposing to weaken the store's role in favor of board-local records argues against that record.

## Standing Brief Amendments

Written 2026-09-02 from section 1's consult ruling and its two review rounds. Every entry binds each later section and rides in every dispatch brief. Approval drift by construction: this block sits inside the approval-scoped region.

- **This plan's Evidence and Goal are stale at HEAD, and each section re-establishes its own gap before building.** The plan was authored 2026-08-30. Commit `3074425` on 2026-08-31 landed destination guidance into the very sentence section 1 edits, so the Evidence bullet's claim of a whole-file sweep finding zero routing guidance no longer holds. Read the current file and confirm the gap the section names still exists before writing to close it.
- **Point at what the file already carries; never re-derive it.** Section 1 collided twice, across two review rounds, on text that restated rules already committed twenty words from the insertion point. A pointer to an existing clause is free and cannot drift; a restatement is a second copy of a contract.
- **Never enumerate the board's line bars.** The file has one idiom and uses it at four sites (`:22`, `:25`, `:57`, `:90`): the path bar and the operator's-words bar the ledger rules state, with `above` or `below` per position. A hand-written enumeration dropped the operator's-words bar in section 1 and was caught as a Critical by three independent lenses. Do not export the roster rows' working-directory ban into any other passage.
- **Do not assert an enumeration over this file's board content is exhaustive or mutually exclusive.** Both claims failed against the file's existing vocabulary in section 1. State destinations as permissions and refusals, where a refusal wins over a permission and the chassis admission test decides the residual, which is how section 1 now reads.
- **This file is CRLF and the Git Bash `sed -i` silently strips every CR from it, invisibly to `git diff` under autocrlf.** Use the Edit tool or `perl -pi -e`, and verify with `tr -cd '\r' < <path> | wc -c` equal to `wc -l < <path>`.
- **A negative grep proves nothing until its own predicate has matched something.** Section 2 concluded the kaizen skill states no public-board cap, on a grep for `public board`; the skill spells it `public-board cap` at its line 21, so the zero was the predicate's spelling rather than the file's content. That false absence rode into a shipped citation and into this block as a binding instruction before the next review round caught it. Before any absence is reported or acted on, run the predicate against text known to hold the thing and watch it speak; where the term could be spelled more than one way, the predicate covers the variants or the check is not evidence.
- **Section 3 folds rather than adds.** The homing passage states the one-read readability property inline as its trigger. Section 3 lands that property as a named test, so it folds the homing passage's statement into a pointer at that test rather than leaving two statements of one rule standing.
- **A new requirement is something the next round finds defects in; a pointer is not.** Three of section 2's five review rounds produced a Critical inside a requirement the previous repair had just written, each one a clause restating or narrowing a rule the file's line 72 already carries. The consult that ended the cascade ruled the repair is deletion rather than qualification. Before adding any requirement to this file, find the committed sentence that already decides the case and point at it; write a new one only where no committed sentence reaches the case at all.
- **Do not describe another skill's mechanism you have not read this turn.** Section 2 shipped a claim that the store's shared tiers surface into a session at its start, which the memory-system skill's line 141 says is false of the operator tier by design, and a confirmation rule keyed on a tier pin for a tier that has no CLI write verb at all and is authored with the Write tool. Both read as right and were wrong. Where a passage's reasoning depends on how another skill's surface behaves, read that skill's own sentence in the same turn or drop the clause.

## Sections of Work

### 1. The routing test lands in the coordinator skill. Model: opus

The skill's board-content rule gains its missing half, stated at the moment of writing rather than as a cleanup duty: every candidate board line is exactly one of four things. Situational, re-derivable next pass: a board line. A commitment, irreproducible, the board its only record: a board line. A learned fact, true past this pass: a memory-store record, authored per the memory-system skill's tier rules (the operator tier for machine or operator truths through its CLI, the project tier for repo truths), and never a board line. Kit friction, something the kit should do better: a kaizen note under the kaizen skill's standing authorization, and never a board line. A line that is none of the four is not written. The no-standing-section rule stays; the test is why it is satisfiable. Tier selection and authoring mechanics are pointed at the memory-system skill, not restated. The board's existing line bars (no operator verbatim, no absolute paths) are unchanged and apply to routed content on each destination's own terms. Whole-file review per the amendment defect mode; grep for pins over the edited passages before editing.

Acceptance: the four-way test present in the skill at the board-writing moment with each destination named and the memory-system pointer in place; no tier mechanics restated; existing pins green; whole gate delta against a recorded baseline.

### 2. Homing is a named operation, and it leaves no residue. Model: opus

For a board that already grew: the skill gains the homing operation, distinct from pruning and named as such. Each standing or narrative line routes through the section-1 test; learned facts are written to the store on the destination tier's own rules, kit friction to the kaizen inbox, and the homed content is then removed from the board outright, no pointer left (Decisions). Superseded history remains pruning's business, unchanged. The audit of a homing round is a project-journal entry (`memq log`, one entry per round naming the record names written and the sections cut), so the move is countable without the board carrying it. The trigger wording: a pass that finds the board failing the section-3 readability test runs a homing round rather than a prune.

Acceptance: the operation present in the skill with the no-residue rule explicit, the journal entry named as the audit record, and the prune-versus-home distinction stated; the readability failure named as the trigger; whole-file review; whole gate delta against the baseline.

### 3. The readability instrument replaces the byte ceiling. Model: sonnet

The property the board must keep is that a cold successor takes the seat from one read: the board renders within a single default read window. That is the test a pass checks and acts on; a byte figure is a proxy that gets recorded and ignored (the reporting seat carried one through twelve prunes without behavior change). Wherever the skill or its chassis-override passage states a size ceiling for the board, the readability test replaces it, and the action a failure earns is a section-2 homing round. If no ceiling prose exists in the skill (the reported ceiling may live only in the one board's own runbook), the test lands as the new health rule and the chapter says so rather than inventing a removal.

Acceptance: the readability test present with its one-read operationalization and its failure action; no byte ceiling remaining in the skill's board guidance, confirmed by a sweep whose control is the passage the test replaced or, absent one, a stated no-ceiling-found; whole gate delta against the baseline.

### 4. The reconciliation pass reads the store as a source. Model: sonnet

The read-side fold: the skill's reconciliation source list gains the operator memory tier, so the seat can see the records homing produces, closing the gap's other direction (a seat able to produce records it cannot see, or see records it cannot produce, is the same invisibility twice). Scope follows the already-filed kaizen note on the source-list omission; where that note names surfaces beyond the operator tier, the implementer follows the note, and where it conflicts with this section, the note wins and the chapter records the difference.

Acceptance: the operator tier present in the source list with its read stated on the pass's own terms; the kaizen note's scope honored; whole-file review; whole gate delta against the baseline.

### 5. The routing contract gets an instrument, and the security model catches up. Model: opus
Locus: inline

Appended 2026-09-02 during section 1's execution, and approval drift by construction: it sits inside the approval-scoped region. Two surfaces this plan's own work reached and its section list did not name, neither of which folds into a section whose files are the coordinator skill alone.

The instrument. Sections 1 through 4 ship counted, drift-prone claims into one prose file with nothing exercising them: the four destinations of the routing test, homing's no-residue rule, the readability test standing where a byte ceiling would, and the operator tier's presence in the reconciliation source list. The repo already pins exactly this class over exactly this file, the four-functions claim in `test/doctrine-parity.test.js`, which is the sibling to mirror. The reason is the mechanism project memory `an-unchallenged-claim-drifts-because-nothing-exercises-it` records: a claim nothing reads is a claim nothing contradicts, so it rots while keeping its authoritative tone. A later editor dropping the kaizen destination or the memory-system pointer reddens nothing today. The pin lands after section 4 so it is cut once against settled prose rather than re-cut three times.

The security model. `docs/security-model.md` is this system's audit artifact. It enumerates the coordinator seat's write surfaces and prices the operator tier's prompt-free grant on a note that the pricing was set when that tier carried other content. This plan makes a per-pass store write a standing part of the seat's loop, which is a flow that document does not currently describe. Recording it is this plan's own work rather than a curator's sweep, since the flow is what this plan creates.

Acceptance: one pin covering each counted claim sections 1 through 4 ship, mirroring the existing four-functions pin's shape and its failure-mode breadth, watched failing against a copy of the pre-section prose before it is trusted; the security model naming the seat's store write and its kaizen-inbox write in its coordinator write-surface enumeration and from the operator-tier pricing note; targeted lane green with its delta named; no em dashes.

## Out of Scope

- The standing-watch chassis itself: the evidence is coordinator boards, so the amendment lands in the coordinator skill's override layer. Reopen if a non-coordinator ledger shows the same growth shape.
- Any code or enforcement mechanics: the changeset is prose contract end to end.
- Homing the fleet's existing boards from this plan: each seat homes its own board on the shipped guidance; this plan ships the guidance.
- The board's line bars and the store-readership precondition: both stand unchanged; routing changes where content goes, not what any surface may carry.

## Related

- Kaizen note at commit `475207d` (`kaizen/notes-SCOTT-CLAUDE.md`): the finding this plan dispositions, including the three-way test this plan's Decisions amend to four.
- `docs/plans/claude-kit_standing-lines-and-honest-reports_spec_v1.md`: its Section 4 edits the same skill earlier in the queue; anchors re-locate by content.
- Project memory `memory-evolution-is-the-kits-cornerstone`: the product direction this plan instantiates.
- Project memory `an-unchallenged-claim-drifts-because-nothing-exercises-it`: the mechanism under homing.

## Chapters

### Chapter 1 - 2026-09-02
Completed: 1. The routing test lands in the coordinator skill.
Implemented By: implementer-opus for the first draft, then three orchestrator fix rounds in the main thread, with one consult that overturned the framing.
Metrics: review rounds 4; NEEDS_CONTEXT 0; escalations 0; consults 1.
Decisions / Surprises: The plan's own premise was stale and the consult is what found it. Commit `3074425` on 2026-08-31, one day after this plan was authored, landed the admission test, the situational-or-commitment split and the memory destination into the very sentence this section edits, so the Evidence bullet's claim of a sweep finding zero routing guidance no longer held. Two review rounds were spent re-deriving text already committed twenty words from the insertion point, which is what generated every collision. Header normalized from `Ready` to `In Progress` at the run's start. The deliberate deviation: the section's approved text says every candidate is "exactly one of four things" and that a line matching none "is not written", and the shipped passage drops both sentences while naming all four destinations. Two review rounds failed on those two claims specifically, the file already carries a stronger refusal in the chassis admission test, and the operator's recorded rationale in the Decisions block argues only for splitting the durable bucket, which the shipped text preserves whole. Exclusivity is replaced by structure: the two board kinds are permissions and the two off-board ones refusals, so a refusal wins and no tiebreak is needed. The adversarial reviewer endorsed the deviation on its final pass. It is reversible in one edit and is named to the operator in the close-out. One file is held out of this commit rather than carried: `kaizen/notes-SCOTT-CLAUDE.md` gained a note of this session's own about an agent charter that should name the hook guard its deliverable lands behind, but the file already carried a peer session's uncommitted work, so it is not this session's to commit even though this session also changed it. It stays dirty in the worktree, named here and in the close-out, and the peer's commit will carry it.
Assumptions: (2026-09-02, section 1) The four-way test amends the file's existing partial destination sentence in place rather than standing beside it, since two surfaces stating one rule is the drift this repo's doctrine bars. (2026-09-02, section 1) The section's own edit site was chosen by content rather than from the plan's authoring-time anchors, which the plan header itself directs.
Review Findings: Four rounds, all three lenses each round, all at opus/max. Round 1: four Majors and a Critical-rated exhaustiveness defect, all confirmed at the file before action. Round 2: a Critical of my own making, three lenses converging, my repair having silently redefined the file's defined term "the two line bars" as the path bar plus the roster rows' working-directory ban, dropping the operator's-words bar at the moment content leaves the board for a cross-machine tier; fixed, and confirmed closed in round 3. Round 3 returned no Critical and one security Major, that the readership reduction did not travel with routed content; fixed. Round 4 returned security CLEAR, the security lens honestly downgrading its own prior concrete case after finding the kaizen inbox filename discloses the hostname structurally anyway. Round 4's two remaining Majors were both my own round-3 over-corrections, an over-narrowed durable-lesson kind and a messages-rule deferral that handed message-arrived content back to the board, and both were repaired to the reviewers' prescriptions. Minors carried rather than fixed, and worth a later pass: the reduction that travels is not pinned to the stub form specifically; the board-write paragraph at `:78` carries no pointer to the routing test at `:72`; and the paragraph has grown to roughly 5,700 characters, which section 3's readability instrument may want to split. The final delta after round 4 took an author re-read of the whole paragraph rather than a fifth round, on the ground that the edits are the reviewers' own prescriptions restoring breadth the text at HEAD already had and that security had returned CLEAR on the surface they touch; that leg has no independence in it, which is why it is named here and in the close-out rather than counted as a round.
Stamps: adjudicated 7 operator-tier records surfaced by `memq unstamped --since 4h` plus 2 surfaced in-session, stamped 4: `git-bash-sed-i-strips-cr` (caught a live CRLF strip I had already caused), `an-unchallenged-claim-drifts-because-nothing-exercises-it` (settled the appended section 5), `scott-commit-approval-includes-push`, `kaizen-standing-grant`. The rest were hook-surfaced reads that did not steer this section. Project tier reported zero unstamped against a non-zero read count.
Gate: the whole gate ran before the push, since this push lands on main, which is an install surface with no CI gating it, and step 4's targeted lane over the section's files ran at each of the three fix rounds, green at 683 tests, 683 passing, 0 failing, exit 0 every time. The whole gate reads 2972 tests, 2962 passing, 1 failing, 9 skipped, at exit 1 read from the run's own exit code. Against the 2972 / 2962 / 1 / 9 baseline the memory-read-side plan's Chapter 4 recorded on this same lane, the delta is exactly zero, and the single failure is identified by name as the permanent box-local red, `test/memory-session.test.js:993`, in a file this section never touched. The repository defines no contention lane. Contention carried: the second fix round's targeted lane ran while a peer session held the machine's heavy-process claim for its own whole gate; that lane was green regardless, and the claim protocol worked as written, this session neither writing nor deleting the peer's claim.
Next: 2. Homing is a named operation, and it leaves no residue.
Commit Model: Commit-and-Push
### Interim board 1 - 2026-09-02
Section 2 is in fix rounds and no section has closed since Chapter 1, which is the closure drought the executing-work skill names; this entry is that boundary.

Stage: section 2 implemented by implementer-opus (DONE, first draft accepted), then three review rounds and three orchestrator fix rounds in the main thread. Sections 3, 4 and 5 have not started. No dispatch is live: every round returned before this entry was written.

Rounds so far, all three lenses each round, all dispatched at opus/max through the Workflow route because the Agent tool cannot set effort. Round 1: no Critical, seven Majors, all confirmed at the files before action. Round 2: one Critical and several Majors; all seven of round 1's Majors confirmed closed by all three lenses. Round 3: one Critical, converged on by all three lenses independently, and it was the round-2 repair's own doing.

Rulings adopted since Chapter 1:
- The residual cut is abolished rather than gated. Round 2 gated a destination-less cut on the store's sync-state read; the durability override at the skill's line 74 says categorically that read gates no write and no release, and the seat cannot tell whether the line it would cut ever reached history. Round 3's repair replaces the gate with one invariant, that a round cuts only a line whose content it confirmed landed somewhere else, so a line no destination will take stays on the board and becomes a finding for the operator.
- The audit is two journal entries per round rather than one, the first before the board rewrite and the second after it, because the rewrite is the irreversible step and a single pre-cut entry asserts a cut that has not happened on the only surface a round leaves behind.
- The seat's-own-statement requirement covers every destination outside this store rather than the kaizen inbox alone, and its test is the content rather than the wording, since a paraphrase discloses what a quotation would.
- A round logs from one project per machine, the checkout the kaizen signpost names, because the journal is project-scoped and rounds scattered across stores are countable by nobody.

A correction of my own, recorded because it shipped before it was caught: round 1 concluded the kaizen skill states no public-board cap, on a grep for "public board" where the skill spells it "public-board cap". That false absence moved a correct citation onto a restatement and was written into this plan's Standing Brief Amendments as binding on later sections. Round 2's security lens caught it and withdrew its own round-1 finding. The citation is reverted and amendment 6 now states the general rule instead.

Gate baseline: targeted lane over the section's files, `node --test test/doctrine-parity.test.js test/output-style-parity.test.js`, green at 64 tests, 64 passing, 0 failing, exit 0, at every fix round. The whole-gate baseline this plan reads against remains 2972 tests, 2962 passing, 1 failing, 9 skipped, exit 1, recorded on Chapter 1.

Next action: round 4 over the third repair, then the section's close gate, Chapter 2, and section 3.
Commit Model: Commit-and-Push

### Interim board 2 - 2026-09-02
Section 2 has now run six review rounds and a consult, and no section has closed since Chapter 1. This entry is that boundary.

Stage: section 2 implemented by implementer-opus (DONE, first draft accepted), then six review rounds with three independent lenses each, one consult, and five orchestrator repair rounds in the main thread. Sections 3, 4 and 5 have not started. No dispatch is live; round 6 returned before this entry was written and round 7 has not been dispatched.

The consult is the event that matters here. Rounds 3, 4 and 5 each returned a Critical, and each time the Critical was inside a requirement the previous repair had just written. Under the tier-escalation rule the discriminator is whether a finding class repeats: round 4's three Criticals were confirmed closed by round 5's own lenses and round 5's two landed on new ground, so no class repeated, which reads as the spec generating the defects rather than the writer being too weak. That rules out spending a tier bump and calls for a consult on the premise, which is what ran.

The consult ruled the premise holds and that every standing Critical was a drafting defect whose repair is deletion rather than qualification. It located the generator exactly: the passage kept writing new requirements where the file's line 72 already decided the case, and each new requirement handed the next round something to find a defect in. It also overturned half my own framing, showing that the project tier has no CLI write verb at all and is authored with the Write tool, so the tier-pin unsatisfiability I had accepted as a Critical rested on a mechanism the destination does not use.

Rulings adopted since Interim board 1:
- The seat's-own-statement rule is not re-keyed onto content provenance. That widening was mine, it generated the sourcing dilemma, and line 72's travel rule already reaches every destination because its bars are on what a line carries rather than on where it lands.
- The confirmation rule names no CLI flag. It states what a confirming read must establish and defers how to the memory-system skill, exactly as line 72 defers tier selection.
- The journal's first moment now precedes the destination writes rather than following them, so a round that dies partway leaves a record of what it was doing rather than content on a wider surface that nothing accounts for.
- An entry's key names the machine and the round rather than the machine alone, since the journal folds entries into per-key rollups that keep the tally and discard the prose.
- The commit that confirms a repository-landing leg is not this seat's to make, the seat's verb set closing at the artifact it produces, so the line stays until that commit lands.

Two amendments were added to the Standing Brief Amendments block from the consult, numbered 8 and 9, binding sections 3 through 5: that a new requirement is something the next round finds defects in where a pointer is not, and that a mechanism belonging to another skill is not described from memory.

Gate baseline: targeted lane over the section's files, `node --test test/doctrine-parity.test.js test/output-style-parity.test.js`, green at 64 tests, 64 passing, 0 failing, 0 skipped, exit 0 read from the run itself, at every repair round including the latest. The whole-gate baseline this plan reads against remains 2972 tests, 2962 passing, 1 failing, 9 skipped, exit 1, recorded on Chapter 1.

Next action: round 7 over the round-6 repair, which is owed because the delta touches the security lens's surfaces, then the section's close gate, Chapter 2, and section 3.
Commit Model: Commit-and-Push

### Resume note - 2026-09-02 (written by a merge session, not the leash holder)

While this plan was between rounds, a separate session merged `batch/skill-fixes` and the doctrine precedence-and-ownership branch into main and pushed. The tree this plan resumes in is that merged trunk, and this note is what changed under the in-flight work.

- The base moved from acde802 to 286ed41 (origin/main, pushed). The three homing paragraphs section 2 added to `plugins/claude-kit/skills/coordinator/SKILL.md` are intact in the working tree, unstaged, byte-identical to before the merge, sitting on the merged text; nothing is left to merge. The kaizen appends and the untracked `test/kit-sidecar-memory-index.test.js` are likewise untouched.
- One sentence of the coordinator skill's board-write override was reworded by the merge's seam fix: "the bars are on what a line carries" became "the limits are on what a line carries", because the skills batch shipped a sweep (`test/doctrine-parity.test.js`, the seat-git-prohibition pin) that reads "bars ... the board" as a git prohibition. The same sweep runs over every shipped skill markdown, so a homing paragraph that says the seat bars, forbids, or never commits anything near "the board" or "the store" reds it; the three paragraphs as they stand are clean under it (swept by hand at the merge).
- The ownership map now exists at `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`, and a pin requires every shipped skill to own a row in it. Section 5's security-model work should read it: it names `coordinator` as owner of the board and of the seat's git standing.
- Both plan indexes (`docs/README.md`, `docs/plans/README.md`) list this plan as Ready and describe an armed queue whose first two entries are archived; the header says In Progress. Left for this plan's close-out or docs curation.
- Whole-gate baseline on the merged trunk, measured at 286ed41 by the merge session: 2994 tests, 2984 passing, 1 failing (the memory-session path-length test this box makes permanent), 9 skipped, exit 1 read from the run itself. The Chapter 1 baseline of 2972 tests predates the merge and is no longer the comparator. The targeted lane `node --test test/doctrine-parity.test.js` alone runs 62 tests on the merged trunk.

Next action is unchanged: round 7 over the round-6 repair, then the section's close gate, Chapter 2, and section 3.

### Interim board 3 - 2026-09-02

Round 7 ran and was adjudicated, its repair is in the worktree, and section 2 still has not closed. This entry is that boundary; the compaction gate was holding two offers when it was written.

Stage: section 2 implemented by implementer-opus (DONE, first draft accepted), then seven review rounds with three independent lenses each, one consult, and six orchestrator repair rounds in the main thread. Sections 3, 4 and 5 have not started. No dispatch is live; round 7 returned before this entry was written and round 8 has not been dispatched.

This session is a new leash holder. The operator re-armed the queue at 14:02Z after the predecessor binding (f9ce7952) died; the arm named five plans, the first of which (memory-read-side) is Complete and archived, so the all-or-nothing CLI refused it and the queue was re-armed on the four that exist. Section 2's work was inherited from the dead session as uncommitted edits, confirmed untouched by the live KIT: Expert on its own reading.

Round 7's returns, all three lenses at opus/max through the Workflow route: adversarial CHANGES_REQUIRED (4 Majors, 5 Minors), blind CHANGES_REQUIRED (7 Majors, 6 Minors), security BLOCK (1 Critical, 6 Majors, 2 Minors). No finding was accepted on report; every mechanism one turned on was read at its own source before the repair.

The adjudication that matters: round 7's findings are the class the consult already ruled on, arriving at new sites, rather than new ground. The consult located the generator as the passage asserting a requirement where an owning surface already decides the case, and ruled the repair is deletion rather than qualification. Each convergent finding fits that shape, so no second consult was spent and no tier bump was taken. What the repair did instead was apply the existing ruling properly: eight surgical cuts, every one replacing an assertion with a pointer.

Findings confirmed at source rather than from the reports:
- `memq log <key> pass|fail "<summary>"` requires a verdict (`plugins/claude-kit/scripts/memq.js:6`), so a pre-write intent entry had no honest one. The repair names the verdict as the entry's own landing rather than a verdict on the round.
- An over-cap journal entry lands truncated, announces the cut on its success line, and exits 0 (`memq.js:283`, `:4992`). The shipped claim that exit status confirms a landing was wrong; the repair confirms on the success line too and points at the memory-system skill's re-log.
- The seat-git bar ("this seat does not make that commit") contradicted this file's own durability override, the ownership map, and the kaizen skill's capture rule, and three lenses converged on it independently. Deleted; who commits is left to whatever governs the seat in that repository.

Rulings adopted at this round:
- The security Critical is repaired by a pointer, not a requirement: the round's routing now carries the pass rule's own disposition of what a source carries, so board content of unknown authorship is a claim rather than the seat's own and is not laundered into the store or the kaizen inbox by being homed.
- The hold on an unhomeable line is stated in the operation's own words, because the displacement rule it pointed at is scoped to what the ledger's list admits and a refused standing line is by construction not on it.
- The journal is no longer called the cut's only record, that claim being false against the decay pass's 30-day rollup; retention joins the caps and verbs deferred to the memory-system skill.
- A round is reported to the operator through the Etiquette report already below, rather than through a new gate this operation invents.

Routed rather than fixed here: the blind lens's Major that no reader in this file ever looks at the round's journal (it is in neither the pass source list nor the cold-start read). That is section 4's own subject, the reconciliation pass reading the store as a source, so it belongs to that section rather than to a fold here, and section 4 is charged with it.

Gate: targeted lane over the section's files, `node --test test/doctrine-parity.test.js test/output-style-parity.test.js`, green at 73 tests, 73 passing, 0 failing, 0 skipped, exit 0 read from the run itself, measured at 14:31Z on this session's own tree. Baseline for this session recorded first-hand on the same lane before any edit, also 73/73/0 exit 0, so the delta is exactly zero. That 73 supersedes the 64 recorded on Interim boards 1 and 2 and the 62 in the Resume note: the trunk merge added tests to this lane, so the older figures are not comparators. Whole-gate baseline on the merged trunk remains 2994/2984/1/9 exit 1, which is the merge session's reported figure and not verified from here; the permanent box-local red is `test/memory-session.test.js`. Amendment 5 verified after the edit: 103 CR against 103 lines. Em-dash sweep zero with a control that spoke.

Machine state: the heavy-process slot was claimed and released by session-scoped delete for each lane run. A peer held it 14:08Z to roughly 14:38Z for an ai-os job; no lane of this session's overlapped it.

Next action: round 8 over the round-7 repair, which is owed under the fix-delta rule because the delta reaches the security lens's surfaces, then the section's close gate, the whole gate before the push to main, Chapter 2, and section 3.
Commit Model: Commit-and-Push
