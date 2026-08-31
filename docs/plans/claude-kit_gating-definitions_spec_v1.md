# A definition that gates a bounded artifact states what it excludes

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-31

Session model: any executor session in the kit repo; two sections, tiers per section. Authored by the KIT: Expert seat 2026-08-31 from design material the machine coordinator relayed and the operator then confirmed first-hand on the allowlisted relay thread, directing this seat to refine it into a plan a worker implements. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-08-31 by the operator, first-hand on the allowlisted relay thread: review and refine the coordinator-relayed material on gating definitions and the blind-reader litmus, and build out this plan to be given to a worker to implement. Queue position and the executing seat are not yet ruled; the operator assigns both. Per the trace rule, this section is a warrant only for a citing session that did not author it.

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
