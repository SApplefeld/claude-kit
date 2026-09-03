# A definition that gates a bounded artifact states what it excludes

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-31

Session model: any executor session in the kit repo; two sections, tiers per section. Authored by the KIT: Expert seat 2026-08-31 from design material the machine coordinator relayed and the operator then confirmed first-hand on the allowlisted relay thread, directing this seat to refine it into a plan a worker implements. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-08-31 by the operator, first-hand on the allowlisted relay thread: review and refine the coordinator-relayed material on gating definitions and the blind-reader litmus, and build out this plan to be given to a worker to implement. Ruled the same day on the same thread, approving this seat's recommendation: sixth and last in the main armed queue, behind capacity-gate, run by the queue's bound worker; the goal state carries the arming. Per the trace rule, this section is a warrant only for a citing session that did not author it.

## Goal

The coordination-ledger incident had a layer under the rule that fixed it: the wording that produced the 201-kilobyte board was not ambiguous in any way a review could see. The author wrote "everything a later pass must re-derive before acting on" describing the state of the watched work; the seat read the same clause as a membership test, is-this-re-derivable-elsewhere; and both readings paraphrase identically, so any review that asks what the line says passes it clean. Two structural features did the damage, and both generalize. An enumeration followed by a trailing general clause reads as a definition whose clause is the rule and whose examples are illustrations, and nothing in the form says whether the clause summarizes the examples or extends past them. And the neighboring default was one-directional: a line you cannot confidently place goes in, and nothing pushes anything out, which on a loop that never terminates guarantees drift rather than risks it.

This plan gives the kit an authoring-time check for exactly that class of text, and flips the one inward default the incident found. Scope is deliberately narrow: the check binds only gating definitions, phrases that decide what goes in or out of a bounded artifact (the shape is a category name, a colon, a list, and a trailing clause). They are rare and easy to spot, and applying the check any wider would train authors to skim it.

Three principles, from the design dialog the material records:

1. **Test a gating definition by its exclusions, never its paraphrase.** Both readings of the incident line restate identically; the author's and the reader's answers to "name three things this rule excludes" were fully disjoint (lessons, corrections, narrative against prohibitions, runbook, confirmed mechanisms), and that divergence is visible in one sentence. Where exclusion lists differ at the edges rather than disjointly, the backstop question is what-changes: what would you do differently if this line were deleted; a definition that changes no behavior is decoration, and one that changes behavior the author did not intend is this bug.
2. **The return leg is performed by a reader who never held the intent.** A round trip (intent to spec to plain terms) closes clean through the performer's own misreading when the same reader runs both legs. The kit already ships the intent-free reader: the blind-reader dispatch that runs on a spec before it leaves brainstorming, given the documents and nothing about their intent.
3. **A membership default faces the cheap direction.** A line wrongly excluded from a bounded artifact costs one re-derivation; a line wrongly included accrues forever. Doubt therefore falls out, not in.

## Evidence

- The incident, reported from the machine coordinator's account (its board archive and its operator-tier record `a-coordination-ledger-holds-current-state-not-its-own-journey` are the verifiable artifacts): board at 201,158 bytes against a stated 35,000 ceiling, fourteen prunes landing net-zero or worse because each cut narrative and added narrative in the same edit, 6,215 bytes after rewriting to current-state-only, ninety-seven percent journey. The prior layer (the re-derivability-only test and the zero-hit grep for any necessity form) was verified first-hand by this seat before commit 3074425 fixed it.
- The closed-set idiom exists in the kit: "the set is closed at" / "closed list of" appear in the coordinator, peer-sessions, and role skills (grep-confirmed at authoring; count per file re-derived at implementation).
- The intent-free dispatch exists: `docs/architecture.md`'s review-pair passage records the blind-reader running once on a spec before it leaves brainstorming, with the documents and nothing about their intent.
- The known weakness of the exclusion test, stated by its own proposer and accepted: it worked here because the lists were disjoint; edge-differing lists produce a subtler disagreement, which is why the what-changes question rides beside it rather than the test standing alone.

## Approach

Two sections. The first lands the authoring-time check where specs are authored and reviewed: the brainstorming skill's spec pass and the pre-spec blind-reader charge. The second flips the standing-watch chassis's inward default, integrating with the admission test commit 3074425 added. Doctrine is untouched: gating definitions are rare, and the skills own authoring mechanics.

## Sections of Work

### 1. The authoring check and the blind reader's gating question. Model: opus

The brainstorming skill's spec-writing pass gains the gating-definition rule: a definition that decides membership in a bounded artifact either closes its set in the kit's existing idiom or states its exclusions in place, three named exclusions as the floor, and an enumeration with a trailing general clause says which the clause is, summary or extension. The pre-spec blind-reader dispatch charge gains the litmus: for every gating definition in the document, name three things it excludes, answered from the text alone; the dispatching orchestrator compares the reader's list against the author's own, divergence is a finding graded by how far the lists sit apart, and where they differ only at the edges the orchestrator asks the what-changes question of both lists' disputed members. The charge lands where the blind-reader's charge is single-sourced (the agent definition and the dispatching skill's brief text; `docs/architecture.md`'s review-pair passage is updated to describe it, not to carry it), and the implementer confirms where that single source is from the code rather than assuming. Tests: the kit's skill-prose gates (doctrine-parity and shape suites) green at baseline; em-dash sweep with its positive control.

Acceptance: the brainstorming skill states the rule with its three-exclusion floor; the blind-reader charge carries the litmus question verbatim in its single source and architecture.md describes it; a gating definition authored without exclusions or a closed set is refusable by the review with the skill text as the citation; whole gate delta against a recorded baseline.

### 2. The chassis default flips outward. Model: opus

`plugins/claude-kit/skills/standing-watch/SKILL.md`: the placement default "A line you cannot confidently place is situational" inverts to face the cheap direction and integrate with the admission test above it: a line the keeper cannot confidently place is not placed on the ledger; it takes the destination rule (the plan's Chapters, the memory store) where durable, and is otherwise dropped, with the asymmetry stated as the reason (a wrong exclusion costs one re-derivation, a wrong inclusion accrues until a rewrite). The coordinator skill is checked for any restatement of the inward default and amended in step; the reviewer brief carries the standing note that skill amendments collide with unchanged neighbours, so reviewers read the whole file. Tests: as section 1.

Acceptance: no text in either skill sends an unplaceable line inward; the admission test, destination rule, and flipped default read as one mechanism in the chassis; whole gate delta against a recorded baseline.

## Out of Scope

- Doctrine text: the check is an authoring mechanic, and gating definitions in the doctrine itself are the operator's prose to amend.
- Applying the litmus to non-gating prose or to every definition; the scope bound is the point.
- Repairing the exclusion test's edge-divergence weakness beyond the what-changes backstop; untested territory, named rather than designed around.

## Related

- Commit 3074425: the layer below (admission test, write-time lesson routing); this plan is the process that would have caught that wording at authoring.
- The machine coordinator's operator-tier record `a-coordination-ledger-holds-current-state-not-its-own-journey`: the durable statement of the incident's principle.
- `docs/archive/` holds the plans this pattern's review pair grew up in; the pre-spec blind-reader dispatch this plan widens is recorded in `docs/architecture.md`.

## Chapters

### Interim board 1 - 2026-09-03

Section 1 is written and twice reviewed and is not closed; section 2 has had its approach read and no edits. The boundary is a closure drought: two review-round adjudications with no section closing, and the compaction gate holding an offer.

Section 1, stage: the prose is in the worktree unstaged across `plugins/claude-kit/skills/brainstorming/SKILL.md` (steps 9 and 10), `plugins/claude-kit/agents/blind-reader.md` (frontmatter description, the reach section's bound count, and a fifth output part), `docs/architecture.md` (two passages), and both doc indexes' status for this plan. Round 1 returned CHANGES_REQUIRED from both lenses on six convergent Majors and the prose was rewritten whole rather than patched. Round 2 returned CHANGES_REQUIRED from both lenses again, on new ground rather than on round 1's classes.

Live dispatches: none. Four have completed, all at `claude-opus-5` confirmed on their own transcripts, all at effort max via the Workflow route because the Agent tool sets no effort. Round 1 asked `adversarial-reviewer` for spec compliance then quality over the four changed files read whole, and asked `blind-reviewer` for correctness over the two payload files with every `docs/` path withheld. Round 2 asked the same pair the same way over the rewritten text, with the sighted brief additionally asking whether the new rule passes its own test, and with round 1's findings deliberately not enumerated to either lens so both judged the final wording fresh.

Gate baseline: 3035 tests, 3025 passing, 1 failing, 0 cancelled, 9 skipped, exit code 1, on SCOTT-CLAUDE at HEAD 4bbe459, the run completing 2026-09-03T15:24Z and recorded in the preceding plan's closing Chapter. The single failure is the box-local `a pinned directory too long to name faithfully stands the session down` at `test/memory-session.test.js`. A second whole run this session, 15:42Z to 15:52Z, returned those same five counts and the same exit code, but this section's edits landed while it was running, so its tree state is indeterminate and it is recorded as consistent with zero delta rather than as a reading. The targeted lane over the changed files' test subjects, `doctrine-parity`, `readonly-agent-guard`, `memory-recognition-nudge` and `kit-sidecar-capture`, ran green at 383 tests, 381 passing, 0 failing, 2 skipped, exit code 0, after the round 1 fixes. The whole gate section 1 owes runs at its close.

Rulings adopted since the last boundary, all three from round findings verified at the file rather than accepted from the report. The litmus is not carried as a dispatch field: three surfaces declare the blind-reader dispatch closed to anything past the document paths and the `Reader:` line, and the agent charter already produces the part standing, so the dispatch copy bought nothing and risked being returned as a contamination note. The reader derives a definition's exclusions from what its rule does rather than copying an exclusion list printed beside it, because the neighbouring authoring rule requires that list to be printed and a reader reading it back would make agreement automatic. And the author writes its own list before the dispatch goes out rather than after the report returns.

The open question, and it is the section's blocker rather than a finding: both round 2 lenses independently hold that a disjoint pair of exclusion lists is not evidence of divergent readings at all, because what a definition excludes is the unbounded complement of what it admits, so two readers who agree perfectly still draw disjoint three-item samples from it. The plan's founding incident is one sample where disjointness coincided with real divergence. That objection is aimed at this plan's own premise rather than at the prose, so the section takes the consult the executing-work fix-the-generator rule prescribes rather than a third implementation attempt.

Next action, section 1: convene the consult on the premise, then implement its ruling, re-review, and close. Next action, section 2: unblocked and independent of that ruling, its target confirmed as `plugins/claude-kit/skills/standing-watch/SKILL.md` line 26. Two findings from its approach read are recorded now because they correct the spec. The plan places the admission test above the placement default and the file has it below, so the flipped default is written to follow the test rather than to integrate with something above it. And the coordinator carries no restatement of the inward default to amend: its own override already states the outward rule, so the chassis is the surface lagging behind its consumer rather than the two disagreeing. The sibling at line 53 of the same file uses the same unplaceable phrasing for board pacing with the opposite and correct resolution, and is deliberately not flipped.
