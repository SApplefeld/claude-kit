# The board goes back to being the board: durable lessons route to the store at the moment of writing

Status: Ready
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
