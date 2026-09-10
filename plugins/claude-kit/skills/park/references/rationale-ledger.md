# Rationale ledger: park

This file is the rationale ledger for the documents the `park` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/park/SKILL.md

This document is the kit's park protocol: it tells a session how to stop at its next safe boundary with everything durable on disk and the resume path left where the next session will look, the occasion being a kit payload update that kills every running session. It owns the moments of routing a session to its class (leashed worker, coordinator, other `/role` seat, ad-hoc), running the ordered drain steps (take no new work, settle dispatched agents, bank an interim board entry, honour the commit model, rewrite and stamp the registry entry, write the ad-hoc handoff file, reply to a relayed requester, end on the exact resume command), composing the `WAITING:` lead a leashed park needs to pass the Stop hook, staying parked and being lifted from a park, and the shape, naming and pruning of the ad-hoc handoff file. It does not own deciding whether a session is safe to park (recap), the stop shapes a run already owes on a blocker or on dispatched work (executing-work), or the close-with-the-state every substantive turn ends on. Load class: `named-trigger` - it is loaded before the specific act of parking, when the operator invokes `/park`, says "park yourself" or "stop at a safe point", when a machine update window is declared, or when a coordinator relays an operator-declared drain window pointing at this skill.

Extracted at `6bc07fb`: whole document (`skills.park.SKILL.md`).

### C001
- key: Load and follow this skill when the operator invokes /park or a coordinator relays a drain window asking this session to park.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:3
- provenance: b9b5d22 2026-08-31, the park-and-quiesce plan's Section 1 shipped the skill for the kit-update kill of every running session.
- verdict: keep
- reason: The description is the load trigger and its three exclusions name their owning skills so a session that loaded park for a recap, a blocker or a turn-end status is routed on; compressing away the owner names loses the routing.

### C002
- key: Resolve paths spelled `skills/` or `hooks/` under the kit plugin root, and `docs/plans/` and `.kit/` under the project.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:14
- provenance: b9b5d22 2026-08-31, shipped with the skill.
- verdict: keep
- reason: No finding.

### C003
- key: Identify which routing-table row this session is, and take the drain steps through that row.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:18
- provenance: b9b5d22 2026-08-31, shipped with the skill; the plan's approach decision was one skill with a routing table rather than five mechanisms.
- verdict: keep
- reason: No finding.

### C004
- key: For a leashed worker, treat the durable state as its plan doc with Chapters plus the armed goal read via `node <plugin-root>/hooks/kit-goal.js status`.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:22
- provenance: e22cff5 2026-09-02, the worktree-goals plan moved the leash to the working tree and corrected this row to say the status call answers the directory it is run from.
- verdict: keep
- reason: kit-goal owns the CLI and the resolution rule; park's cell names the command and the run-from-the-tree-root bound only, which is the pointer form the worktree-goals plan deliberately left here.

### C005
- key: Treat a leashed worker's resume as the SessionStart recovery block plus re-arming with `/kit-goal <the remaining plan paths>`.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:22
- provenance: e22cff5 2026-09-02, same correction as C004; the resume shape itself is b9b5d22's.
- verdict: keep
- reason: The re-arm is a typed act no hook performs, so the cell is not superseded; kit-goal keeps the re-arm semantics and park names only the command.

### C006
- key: For the coordinator, treat the durable state as its board at `coordinator/<machine>/board.md` in the memory store.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:23
- provenance: 5b7dba3 2026-09-02 last touched the row; the row is 10518d6 2026-08-31's, the plan's second decision making each class's existing surface its resume artifact.
- verdict: keep
- reason: The coordinator runbook owns the path with its hostname bound; park names the surface without the derivation, and "commitments nothing re-derives" is the bound on what the seat must have boarded before parking.

### C007
- key: Treat the coordinator's banked pass as the park and its resume as the `/role` takeover ritual, whose board and store read precedes any announcement.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:23
- provenance: 5b7dba3 2026-09-02, the recognition-reach plan gave the takeover ritual a memory-store read and repaired this row as collateral.
- verdict: keep
- reason: The cell points at the role skill's fourth step, whose number the parity suite pins; the pointer is the maintained form.

### C008
- key: For any other `/role` seat, treat the durable state as `registry/<session-id>.md` in the machine's coordinator directory plus the repo's durable artifacts.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:24
- provenance: 10518d6 2026-08-31, Section 3 of the park-and-quiesce plan.
- verdict: keep
- reason: No finding.

### C009
- key: Treat a seat's resume as `/role <Seat>`, reading the seat's own surfaces before announcing.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:24
- provenance: 10518d6 2026-08-31, Section 3.
- verdict: keep
- reason: Twelve words naming "the same ritual"; the coordinator and role skills keep the read-before-announce rule whole.

### C010
- key: Treat an ad-hoc session as holding no durable surface, with the handoff file as its only resume path.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:25
- provenance: b9b5d22 2026-08-31, the plan's second decision: only the session class with no surface writes a handoff.
- verdict: keep
- reason: The routing cell, the tie and step 6 are three moments (surface, misroute case, act); cited only under other claims' findings.

### C011
- key: Decide your row by asking the test's questions in order and stopping at the first yes, never by self-description.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:27
- provenance: b9b5d22 2026-08-31 fix round, after a blind reader found the table "names four classes without giving any test for which one a session is, on rows that are not disjoint"; 1b5e143 2026-09-01 last reworded the line.
- verdict: keep
- reason: The tie paragraph is a settled exception sequenced after the test, not a contradiction of it; the proposed compression drops the questions, which are the test.

### C012
- key: Ask first whether this session is driving a plan doc under an armed goal, corroborating with `node <plugin-root>/hooks/kit-goal.js status` from the project directory.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:27
- provenance: b9b5d22 2026-08-31 fix round; e22cff5 2026-09-02 added the from-the-project-directory bound.
- verdict: keep
- reason: No finding.

### C013
- key: Read the binding the status call prints as corroboration only, never as the test itself.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:27
- provenance: e22cff5 2026-09-02, two reviewers settled that a session can drive a plan while the leash sits unbound or bound elsewhere.
- verdict: keep
- reason: A deliberate correction that the test does not turn on the binding; survives the compress finding ruled under C011.

### C014
- key: Ask next whether this session claimed a seat with `/role`; take the coordinator row where that seat is Coordinator and the seat row otherwise.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:27
- provenance: b9b5d22 2026-08-31 fix round.
- verdict: keep
- reason: The seat question is skipped for the primary row only; the tie paragraph names the second pass a leashed seat takes, so there is no execution-time conflict.

### C015
- key: Treat the session as ad-hoc where neither question answered yes.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:27
- provenance: b9b5d22 2026-08-31 fix round.
- verdict: keep
- reason: The tie for a plan doc with no leash is an instance the session most plausibly misroutes, and it adds what that handoff must name; not a duplicate of this question.

### C016
- key: A seat that is also driving a leashed plan takes both rows, running the leashed row's steps first.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:29
- provenance: b9b5d22 2026-08-31 fix round, settling the non-disjoint rows.
- verdict: keep
- reason: The ordering's reason is a bound: the seat's own drain is a registry write over state the plan's drain already settled, which is what its second pass consists of.

### C017
- key: A session holding a plan doc with no goal armed and no seat routes ad-hoc: write the handoff file and name the plan doc as where the work lives.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:29
- provenance: b9b5d22 2026-08-31 fix round.
- verdict: keep
- reason: Adds what the handoff must name (the plan doc), which step 6 does not state; deleting it as a duplicate of the third question loses that.

### C018
- key: A park taken mid-queue names the plans that remain, never the one already finished.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:31
- provenance: e22cff5 2026-09-02, the worktree-goals plan's tree-scoped leash, whose re-arm replaces the queue.
- verdict: rewrite
- reason: The rule and its asymmetry sentence stay; the ten sentences walking what session start says in each of three binding cases leave for this ledger (see C019), since the parking session's act is the same in all three.
- proposed: Keep the asymmetry sentence and the mid-queue consequence; move the three-binding-case walk to this ledger under C019, leaving one sentence that the park leaves an armed goal with a stale binding and that the typed re-arm is the resume in every case.
- baseline-test: yes

### C019
- key: Expect a park to leave an armed goal with a stale binding rather than an unleashed plan, with the typed re-arm as the resume in every binding case.
- class: rationale-example
- source: plugins/claude-kit/skills/park/SKILL.md:31
- provenance: e22cff5 2026-09-02.
- verdict: retire
- reason: Rationale a session can obey C018 and C070 without. The record it held: a park leaves the goal armed with its old binding; session start inventories the in-progress plan and, where the leash was bound to the parked session, says a goal is armed and bound to another session with a liveness hint; where unbound, that no session holds the leash, with no hint; where bound to a third session, the hint describes that session's clock, not the parked one's; the in-progress-plan-beside-no-goal notice never fires because it is gated on the goal-state file being absent; the typed re-arm is the resume in all three.
- proposed: Retire the three-case walk to this ledger's C019 entry, keeping one sentence in the document per A021.
- baseline-test: yes

### C020
- key: Make the coordinator's last pass before a park the last pass, arming the wake the chassis requires and declaring the park after that arm.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:33
- provenance: b9b5d22 2026-08-31 Chapter 1 ruling (take no new work on the wake rather than disarm it, since the chassis mandates arming every pass); ff59e19 2026-09-01 last touched the line.
- verdict: rewrite
- reason: The rule and the declare-after-arm order stay; the argument for why the arm is still required (a seat that armed nothing leaves the machine unwatched if the park is cancelled) and how far a wake can reach (only the interval between the park and the kill, since it dies with the session) move here.
- proposed: State the last-pass rule with the declare-after-arm order, point the woken-seat conduct at the parked-state rule below and at the coordinator runbook, and keep the board-write-is-not-a-publication disclosure with its sync bound; move the wake-reach and why-arm-anyway argument to this ledger.
- baseline-test: yes

### C021
- key: A parked seat woken by its own timer takes no new work, re-derives nothing, and answers by restating that it is parked and what its board and registry entry say.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:33
- provenance: 10518d6 2026-08-31 ruling N scoped the no-timer claim for the parked coordinator seat; ff59e19 2026-09-01 last touched the line.
- verdict: rewrite
- reason: Becomes a pointer at the general parked-state rule (C079) and the coordinator runbook, which carries the woken-seat conduct clause for clause plus arm-the-next-wake; the instance exists because the seat's wake is the only thing in the kit that re-invokes a parked session on a timer.
- proposed: (via A027) Replace C021's three clauses with a pointer that a seat its own timer wakes answers as any parked session does per the parked-state rule below, arming the next wake per the coordinator runbook.
- baseline-test: yes

### C022
- key: A parking seat states outright that its board write may not have left the machine rather than assuming a peer can see it.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:33
- provenance: ff59e19 2026-09-01, the standing-grants plan retired the coordinator's git prohibition and restated how the store's sync publishes a board.
- verdict: keep
- reason: A board write is not a publication; the disclosure survives the line-33 compression whole, and the sync mechanics are memory-system's to keep current.

### C023
- key: Run the drain steps in the stated order.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:39
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: Each step's record is the next step's input; step 6's placement clause is one step's own content, not a restatement.

### C024
- key: Take no new work from the moment the park is accepted: start no section, dispatch no agent, open no fresh line of investigation.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:41
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: Step 1 binds at acceptance and C079 continues it across the parked interval (a lift "lifts step 1"); the eighty-word step carries the in-flight versus not-yet-begun bound.

### C025
- key: Finish or explicitly stop every dispatched agent, and never park over a live fan-out.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:42
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: Park owns this rule; executing-work:59 points at park's steps for it. The five restated kill rules that follow it in the step leave (C026 to C030) and its closing restatement retires (C031).

### C026
- key: Wait on a still-working agent in-turn through the completion contract's blocking `TaskOutput` loop rather than by ending the turn.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:42
- provenance: b9b5d22 2026-08-31, restating executing-work's completion contract.
- verdict: rewrite
- reason: executing-work:25 owns the in-turn wait and its mechanism, and :59 orders the park's drain before any `WAITING:`; park's step 2 says "the kill rules are executing-work's" and should point rather than copy.
- proposed: (via A037) Keep C025 whole and replace C026 to C030 with one pointer at executing-work's pre-park hold and kill rules, naming that a dispatch with a pending first-turn reading defers the park and a dispatch past its window owes its probe first.
- baseline-test: yes

### C027
- key: Stop an agent that has to go explicitly with TaskStop before anything replaces it, and never race a second agent at the same files.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:42
- provenance: b9b5d22 2026-08-31, restating executing-work:357.
- verdict: rewrite
- reason: Folds into the one pointer at executing-work's kill rules; the TaskStop-first and no-race conditions live there with their exceptions.
- proposed: (via A037) Keep C025 whole and replace C026 to C030 with one pointer at executing-work's pre-park hold and kill rules, naming that a dispatch with a pending first-turn reading defers the park and a dispatch past its window owes its probe first.
- baseline-test: yes

### C028
- key: Do not treat an agent's silence as license either to leave it running or to kill it.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:42
- provenance: b9b5d22 2026-08-31, restating executing-work:357 and finishing-work's wedge hallmark.
- verdict: rewrite
- reason: Folds into the pointer; executing-work's "treat a quiet agent as working" and this sentence agree, since "leave it running" here means parking over it.
- proposed: (via A037) Keep C025 whole and replace C026 to C030 with one pointer at executing-work's pre-park hold and kill rules, naming that a dispatch with a pending first-turn reading defers the park and a dispatch past its window owes its probe first.
- baseline-test: yes

### C029
- key: Defer the park while any dispatch's first-turn reading is pending, holding the turn in-turn until every in-flight dispatch's reading is taken and resolved on the pair it returns.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:42
- provenance: 10518d6 2026-08-31 wrote the pre-park hold into executing-work:59 (Standing Amendment 3); park's copy rode the same changeset.
- verdict: rewrite
- reason: executing-work:59 states the hold word for word with the capped `TaskOutput` mechanism park omits; the pointer names that a pending first-turn reading defers the park.
- proposed: (via A037) Keep C025 whole and replace C026 to C030 with one pointer at executing-work's pre-park hold and kill rules, naming that a dispatch with a pending first-turn reading defers the park and a dispatch past its window owes its probe first.
- baseline-test: yes

### C030
- key: For a dispatch past its window, take the readings that rule names, its probe among them, before writing the park.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:42
- provenance: 10518d6 2026-08-31, as C029.
- verdict: rewrite
- reason: executing-work:59 states the past-window probe and the synthetic-only TaskStop route; the pointer names that a dispatch past its window owes its probe first.
- proposed: (via A037) Keep C025 whole and replace C026 to C030 with one pointer at executing-work's pre-park hold and kill rules, naming that a dispatch with a pending first-turn reading defers the park and a dispatch past its window owes its probe first.
- baseline-test: yes

### C031
- key: Leave behind only finished agents or stopped ones, nothing in between.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:42
- provenance: b9b5d22 2026-08-31.
- verdict: retire
- reason: Restates C025's opening sentence at the step's close; executing-work:59 carries the same phrase. C025 keeps it.

### C032
- key: Where a section is mid-flight, bank an interim board entry to the plan doc.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:43
- provenance: 10518d6 2026-08-31, Section 3, with the closure-drought form already executing-work's.
- verdict: rewrite
- reason: The park trigger, the stopped-agent reason and the deferred checkpoint (C034) stay; the copied heading, counting rule and content list (C033, C035) become a pointer at executing-work:479.
- proposed: (via A053) Keep C032 and C034 with their bounds and the stopped-agent sentence; replace C033 and C035 with a pointer at executing-work's closure-drought entry form.
- baseline-test: yes

### C033
- key: Write the entry as `### Interim board N - YYYY-MM-DD` below `## Chapters`, N counting interim entries, carrying each in-flight section's stage, the live dispatches and their asks, the gate baseline, rulings since the last boundary, and the next action per section.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:43
- provenance: 10518d6 2026-08-31, copied from executing-work:479.
- verdict: rewrite
- reason: Verbatim from the owner, and park says the form is "unchanged"; a pointer keeps the two from drifting.
- proposed: (via A053) Keep C032 and C034 with their bounds and the stopped-agent sentence; replace C033 and C035 with a pointer at executing-work's closure-drought entry form.
- baseline-test: yes

### C034
- key: Once step 4 has honoured the commit model, open the compaction checkpoint with the same CLI call executing-work's step 8 names.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:43
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: Park's own placement of the owner's call: after step 4, because a cancelled window resumes this very session and an unopened checkpoint holds the compaction gate mid-chapter until its safety valve fires.

### C035
- key: Give the interim entry no `Completed:` line and do not call it a Chapter; a section that did close still gets its Chapter as usual.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:43
- provenance: 10518d6 2026-08-31, copied from executing-work:479.
- verdict: rewrite
- reason: The no-`Completed:`-line rule and its Chapter machine-contract reason are executing-work's; folds into the pointer with C033.
- proposed: (via A053) Keep C032 and C034 with their bounds and the stopped-agent sentence; replace C033 and C035 with a pointer at executing-work's closure-drought entry form.
- baseline-test: yes

### C036
- key: Commit and push per the plan's recorded commit model.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: ebd12d2 2026-09-02, the standing-grants plan made commit and push the default and reshaped this step; 10518d6 2026-08-31 had already keyed it on the models' own push rules.
- verdict: rewrite
- reason: Every rule and bound in the step stays; two rationale sentences ("Committing it to feel safe destroys the review surface to protect state that was never at risk"; "a drain records state rather than taking new decisions") move here, and the claim protocol copy becomes a pointer (C043).
- proposed: Keep C036 to C042 with their bounds; move the two rationale sentences to this ledger; replace the three-way shape with a pointer at the role skill's claim protocol, keeping the drain's own reason for naming it (the whole fleet stopping at once is the worst moment to spawn unclaimed).
- baseline-test: yes

### C037
- key: Run the targeted lane over the delta and report it as a delta against a baseline recorded on that same lane.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: ebd12d2 2026-09-02.
- verdict: keep
- reason: Doctrine assigns each moment its lane; park names the lane its own moment takes, which every moment-owning skill does.

### C038
- key: Where the model's push rule calls for the whole gate, read that condition in executing-work's and finishing-work's commit-model bullets rather than here.
- class: pointer
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: ebd12d2 2026-09-02, which assigned what each model performs to the owning skill.
- verdict: keep
- reason: No finding; already the pointer form.

### C039
- key: Under Review-Only, stop with the index exactly as it stands and name in the final output that the surface is staged and unreviewed.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: ebd12d2 2026-09-02; the carve-out is b9b5d22's.
- verdict: keep
- reason: The drain-time application of Review-Only, stated because a drain reads as pressure to bank; the gate it carries holds the commit that would destroy the review surface.

### C040
- key: With no plan doc, or a plan doc recording no commit model the kit defines, commit nothing, leave the worktree and index as they stand, and name what is uncommitted and why.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: ebd12d2 2026-09-02, mirroring doctrine's rule that an absent or unrecognised header "takes the ask too".
- verdict: keep
- reason: A drain cannot ask, so it defers the commit to the session that can; the gate holds an act doctrine itself gates.

### C041
- key: Push only where the plan's recorded model carries a push of its own; otherwise take the park exactly as far as the model goes and name how far in the final output.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: 10518d6 2026-08-31 adjacent fix ("park's push step keyed on the Commit-and-Push header alone, where the models' own push rules are what decide it"); ebd12d2 2026-09-02 reshaped it.
- verdict: keep
- reason: The bound on C036's push half, adding the worktree-branch routing and the how-far disclosure; not a duplicate.

### C042
- key: Treat a park request as authorizing no push the session did not already hold, whoever relayed it and whatever window it names.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: b9b5d22 2026-08-31 fix round, after a reviewer found a peer's drain request could have caused a push the safety argument did not cover; ebd12d2 2026-09-02 last touched it.
- verdict: rewrite
- reason: The rule is stated three times in the document (step 4, the bounds, the authority bound); the bounds (C094, C098) own it and step 4 becomes a pointer, which keeps the blast-radius gate reachable from the drain.
- proposed: (via A072) Keep C094 and C098 whole in the bounds; reduce C042 in step 4 to a pointer at that bound; drop C096's re-argument of the push case to a pointer as well.
- baseline-test: yes

### C043
- key: Take the claim protocol's three-way shape before running the lane: read the live claim file, wait or run unclaimed naming contention where a claim stands, else write the claim with its full field set and run claimed.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:44
- provenance: 10518d6 2026-08-31 ruling I restated the handoff claim as the claim protocol's three-way shape; ebd12d2 2026-09-02 last touched the line.
- verdict: rewrite
- reason: The role skill owns the claim protocol (ownership map row 43) and park copies its three limbs; the pointer keeps the drain's own reason (the whole fleet stopping at once is the worst moment on the box to spawn unclaimed) and repairs the omitted process poll the owner carries.
- proposed: (via A076) Replace the three-way shape with a pointer at the role skill's claim protocol, keeping the fleet-stopping-at-once reason.
- baseline-test: yes

### C044
- key: Rewrite the registry entry's `Status:` line to parked with the resume verb beside it.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:45
- provenance: 1b5e143 2026-09-01, the instruments-not-prose plan's Section 5 made the drain point at the stamp rule rather than restate it.
- verdict: keep
- reason: Park owns step 5 and test/doctrine-parity.test.js:2600 pins its text (it must name "push moment" and point at the role skill's writer rule); the compress finding would drop sentences that are bounds.

### C045
- key: Rewrite the `Remaining:` line with the `Status:` line, then run `node <plugin-root>/hooks/kit-registry-stamp.js push` to stamp `Status-updated:`.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:45
- provenance: 1b5e143 2026-09-01.
- verdict: keep
- reason: The CLI writes one field; the prose edit is the session's act and nothing performs or checks it, so the rule is not superseded.

### C046
- key: Read the entry's shape, its writer rule, that class, and the stamp's invocation, flags and place in the order from the role skill rather than from this step.
- class: pointer
- source: plugins/claude-kit/skills/park/SKILL.md:45
- provenance: 1b5e143 2026-09-01.
- verdict: keep
- reason: No finding; the pinned pointer.

### C047
- key: Let the parked `Status:` line carry only what a public board could carry: the state and the verb, no absolute path and none of the operator's words.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:45
- provenance: 1b5e143 2026-09-01.
- verdict: keep
- reason: One public-board bar applied at three payloads park composes at three steps; executing-work:57 keeps the bar and itself restates it where a run actually reads.

### C048
- key: Treat the prose edit and the stamp as one act and skip both together where the session cannot name its own entry.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:45
- provenance: 1b5e143 2026-09-01, a review finding: the stamp alone would freshen a moment beside a pre-park status line and read to the coordinator as a seat that just pushed.
- verdict: keep
- reason: Incident-born and unenforced; the false reading it prevents is the reason stated in the step.

### C049
- key: Where the stamp refuses, name the refusal in the final output and take the manual boundary path the role skill's takeover step points at.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:45
- provenance: 1b5e143 2026-09-01, which removed a false claim that the stamp's success line verifies both halves reached one file; the refusal is what establishes agreement.
- verdict: keep
- reason: A park is ordinarily the last write, so no later push repairs a refusal; the disclosure is the only record of it.

### C050
- key: Where the routing test put this session on the ad-hoc row, write the handoff file to the shape the ad-hoc handoff section states; every other row writes none.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:46
- provenance: b9b5d22 2026-08-31 fix round (no step told the ad-hoc session to write the file whose path a later step emitted); 10518d6 2026-08-31 ruling K added the plant.
- verdict: rewrite
- reason: The rules and bounds stay; two clauses leave as journey: "The case that motivated the wider condition is then met by reading rather than by writing" narrates Chapter 2's round-four repair, and "exactly what the bounds below forbid" restates the bounds.
- proposed: Keep C050 to C053 with the never-replace bound and the gap disclosure; drop the motivating-case narration and the restated-bounds clause to this ledger.
- baseline-test: yes

### C051
- key: As part of creating the directory, plant a nested `.gitignore` holding the single line `*` at `.kit/.gitignore`, only where no such file is there.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:46
- provenance: 10518d6 2026-08-31 ruling K; the never-replace bound was added after a round-four edit had turned the plant into an overwrite of a host file.
- verdict: keep
- reason: The create-only fallback for a host repo whose root ignore does not cover `.kit/`, the same `flag: 'wx'` shape memory-recognition-nudge.js uses on its own first write; executing-work's "keep the project's `.gitignore` covering `.kit/`" is a standing state for this repo, not a competing instruction.

### C052
- key: Where an ignore file is already there and its rules do not cover the directory's contents, name that gap in the final output instead of asserting coverage.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:46
- provenance: 10518d6 2026-08-31 Chapter 2, the same repair.
- verdict: keep
- reason: A handoff written under a host ignore that does not cover it is tracked; the step established no non-tracking and must say so.

### C053
- key: Write the handoff after the earlier steps, recording what was committed, what was left uncommitted, which agents were stopped and how far each got, and what the next session picks up.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:46
- provenance: b9b5d22 2026-08-31.
- verdict: rewrite
- reason: The placement rule stays; the content list merges into the handoff section's ordered list (C089), whose "where things stand" item gains the committed-versus-uncommitted and stopped-agents detail, so one list owns the file's contents.
- proposed: (via A091) Fold step 6's content list into the section's "where things stand" item (naming what was committed, what was left uncommitted, and which agents were stopped and how far each got), leaving step 6 with the placement rule and a pointer at the section.
- baseline-test: yes

### C054
- key: Where the park arrived on a relayed drain request, reply to the sender in one line.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:47
- provenance: 10518d6 2026-08-31, Section 3's drain round; ruling J had the reply name the project as the placement base.
- verdict: rewrite
- reason: The rules and bounds stay; the why sentences move here: without the reply a correctly parked ad-hoc session, which has no registry entry the sender can read, reads to the sender as one that never answered for the whole window, and the project-plus-relative-path pair is what the window's resume checklist is assembled from.
- proposed: Keep the reply rule, the ad-hoc project-plus-relative-path pair with the placement-base bound, the public-board bar, the ask-nothing-back bar, and the directory-and-write-time fallback; move the why sentences to this ledger.
- baseline-test: yes

### C055
- key: Have the reply name the parked state and nothing more; on the ad-hoc row also name the session's project and the handoff file path spelled relative to that project.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:47
- provenance: 10518d6 2026-08-31 ruling J.
- verdict: keep
- reason: The named project is the placement base a reader resolves the relative path against; no other surface on the machine records the pair.

### C056
- key: Keep the reply to what a public board could carry, with no absolute path and none of the operator's words, and ask for nothing back.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:47
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: The public-board bar applied at the reply; see C047.

### C057
- key: Where a handoff already on disk carries a name that would not meet that bar, name the `.kit/parked/` directory and the write time in the reply instead.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:47
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: The session-start reader reports the path and write time anyway, so the checklist still finds the file without republishing a name that fails the bar.

### C058
- key: End the parking message with the exact resume command as the final line, with nothing below it.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:48
- provenance: b9b5d22 2026-08-31; 1b5e143 2026-09-01 opened the disclosure list.
- verdict: keep
- reason: Three rules in 200 words with one reason sentence that is the bound making "exact" mean verbatim; not bloat.

### C059
- key: Use `/kit-goal <the remaining plan paths>` for a leashed worker, `/role <Seat>` for a seat, and the handoff file's path for an ad-hoc session.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:48
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: The three commands a parking session emits verbatim; the routing table names what resuming is, step 8 fixes the line.

### C060
- key: Put the protocol's disclosures above the resume command, composing them by walking the steps you actually ran rather than from the examples given.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:48
- provenance: 1b5e143 2026-09-01, which found the closed list of two dropped two disclosures other steps already routed there.
- verdict: keep
- reason: Incident-born; an open list composed by walking the steps is the disposition that survives a new step routing a disclosure.

### C061
- key: A leashed worker leads the parking message with `WAITING:` as its very first characters, naming the park and the ground it stands on.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:50
- provenance: b9b5d22 2026-08-31 fix round (the Stop hook bounces an ordinary turn end while the leash is armed); 10518d6 2026-08-31 Standing Amendment 3 made the park an occasion the shape covers.
- verdict: rewrite
- reason: The rule, the function pointer and the three example lines stay; the consequence narration moves here: a refused lead is a blocked turn whose reason says capacity is never a blocker and to continue the remaining sections, which is the parking session pushed back into the work, and a restated word list rots the day the function moves.
- proposed: Keep C061 to C066 including both compliant lines and the failing line; move the bounced-turn consequence and the why-not-a-word-list argument to this ledger.
- baseline-test: yes

### C062
- key: State as the ground the declared window where one was declared, the operator's own instruction where they asked directly, and otherwise the request itself named as the request it was.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:50
- provenance: 10518d6 2026-08-31 ruling G, after ruling A's "on the operator's own word" predicate was found to be one the receiver cannot evaluate (memory a-receiver-cannot-be-conditioned-on-a-senders-fact).
- verdict: rewrite
- reason: The passage agrees with executing-work:59 that a relayed park states the request, but "the declared window where one was declared" does not say declared to whom, and the first compliant example is the line a relayed session would copy; the clause becomes "where the operator declared it to this session directly".
- proposed: Make the first clause read "the window where the operator declared it to this session directly", so a relayed park cannot read the window as its ground.
- baseline-test: yes

### C063
- key: Compose the first line subtractively: name the fact of parking and its ground and nothing else, saying nothing about capacity, context, tokens, compaction under any spelling, a handoff, or a session swap.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:50
- provenance: b9b5d22 2026-08-31 fix round, verified by running `capacityShapedBlockReason` against the compliant and the natural line.
- verdict: keep
- reason: The screen is a pairing match over the first line alone and the natural parking vocabulary is exactly what it refuses; park owns the composition, kit-goal and executing-work own the refusal.

### C064
- key: Judge a doubtful first line by reading or running the `capacityShapedBlockReason` function in `hooks/kit-goal-stop.js` under the kit plugin root, never against a restated word list.
- class: pointer
- source: plugins/claude-kit/skills/park/SKILL.md:50
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: No finding; the function is at kit-goal-stop.js:329.

### C065
- key: Model the lead on `WAITING: parked at the operator's declared update window.` or `WAITING: parked at a safe boundary on the operator's own instruction.`, and not on a line mentioning the handoff, resume, or fresh session.
- class: rationale-example
- source: plugins/claude-kit/skills/park/SKILL.md:50
- provenance: b9b5d22 2026-08-31; the compliant example returns false from the shipped function and the natural line returns true, the control proving the check speaks.
- verdict: keep
- reason: The rule cannot be safely obeyed without the instances, since the screen matches pairings and a writer cannot see the boundary from the subject list alone.

### C066
- key: Put everything the park has to say about the handoff, the resume and the fresh session below that first line.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:50
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: One clause completing C063 by saying where the excluded subjects go; the screen never reads below the first line.

### C067
- key: Where a restatement of the `WAITING:` shape differs from its owning contract in executing-work, follow the owning contract.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:52
- provenance: 10518d6 2026-08-31 Standing Amendment 3, which owed "a disposition that survives the next surface being found, rather than an enumeration that rots" after its own count of disagreeing surfaces was found wrong.
- verdict: rewrite
- reason: The five rules and their bounds stay; the surface-by-surface account (what the hook screens, what the contract names, what the capacity refusal says in passing) moves here, since the amendment itself said an enumeration rots.
- proposed: Keep C067 to C070 with their bounds; move the surface-by-surface account to this ledger; drop C071 as a duplicate of C063.
- baseline-test: yes

### C068
- key: Where a park meets the hook's capacity refusal, fix the first line; never edit the refusal.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:52
- provenance: 10518d6 2026-08-31 Standing Amendment 3: the widening "must not touch the capacity refusal, which is load-bearing on both leads".
- verdict: keep
- reason: The refusal fires only past the screen, so a line composed per C063 never meets it; meeting it is a first-line defect.

### C069
- key: Never lead a park with `BLOCKED:`.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:52
- provenance: 10518d6 2026-08-31 ruling L reserved "park" for the `/park` act; kit-goal:103 states the mid-queue advance.
- verdict: keep
- reason: A mid-queue `BLOCKED:` records a blocker and advances the leash, a false outcome; one sentence applying kit-goal's mechanic.

### C070
- key: Never clear the goal to make a clean stop; leave it armed and let the fresh session re-arm.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:52
- provenance: 10518d6 2026-08-31; executing-work:25 bars clearing the leash generally.
- verdict: keep
- reason: The armed goal is what keeps a parked run visible at session start and to the doctor; park adds the recovery.

### C071
- key: Have the reason line name the park's ground and never capacity.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:52
- provenance: 10518d6 2026-08-31.
- verdict: retire
- reason: C063 already bars capacity from the first line and C069 bars the `BLOCKED:` lead, so "on either lead" adds nothing for a park; a duplicate within the document.
- proposed: (via A113) Retire the closing sentence of line 52; C063 carries the ban.
- baseline-test: yes

### C072
- key: Do not read the completion contract's prohibition on stopping as barring a park; stopping at a clean boundary with the record written, the leash armed and the resume named takes nothing that contract withholds.
- class: rationale-example
- source: plugins/claude-kit/skills/park/SKILL.md:54
- provenance: b9b5d22 2026-08-31; its "provenance does not enter" sentence was the evidence that overturned 10518d6's ruling A.
- verdict: retire
- reason: Since Standing Amendment 3 the contract's own text at executing-work:59 names the park as an occasion it covers, so the tension is resolved at the owner. The record it held: the contract binds the run's judgment of its own work (a clean boundary, a long gate, context pressure are not reasons to stop); a park is none of those and is safe for any session at any time; provenance does not enter, because a park reaches a session relayed as readily as typed and a distinction resting on which would collapse in the case the relay exists to serve.
- proposed: (via A115) Retire the paragraph to this ledger; C096's "for a reason specific to parking rather than to who asked" keeps the provenance-does-not-enter point in the bounds.
- baseline-test: yes

### C073
- key: Treat the ordinary end of a park as the kill it exists to make safe, with resuming performed by the fresh session per this session's routing-table row.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: Cited only by the lift gates, which hold.

### C074
- key: Lift a park only on the operator's own word over a warranted channel, or, for a relayed park, on one line from the relaying sender naming the window closed.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31 ruling H made the lift a floor rather than an exact match of what opened it.
- verdict: rewrite
- reason: The eight rules of the paragraph stay; three why sentences move here: parking on a request is safe whoever asked since the act costs only time, while resuming on a request is the act the window exists to prevent; a committed authorization records that a window existed rather than the operator ending one now; the unleashed rows' re-lead is what tells a reader the session is parked rather than idle. The gate is operator-decision class: the window is the operator's to open and close by the plan's first recorded decision.
- proposed: Keep C073 to C081 with their bounds (self-chosen names, the two channels, name the sender, lift only step 1, re-lead every turn); move the three why sentences to this ledger.
- baseline-test: yes

### C075
- key: Weigh a closing line as an ordinary peer message and hold parked until the operator's own word where you would rather not risk resuming into a kill.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31 ruling H; coordinator:37 says a session that stays parked has declined nothing it owed.
- verdict: keep
- reason: Park owns the receiver's weighing and the hold option; a name is self-chosen and a send lands with whichever session wears it.

### C076
- key: Take a lift only on the two routes the coordinator skill's closed list allows: the operator's keyboard in this session's conversation, or the account-allowlisted relay, never the artifact route.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31; coordinator:37 takes the same two channels for the declaration and the cancel.
- verdict: keep
- reason: Not in conflict with the coordinator's list of three: the coordinator itself excludes the artifact channel for declaration and cancel, and park names the exclusion so a record of a past window is not read as a live close.

### C077
- key: Name the sender in the turn you resume on where you resumed on a closing line rather than the operator's word, and name your requester where you parked on a relayed request.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: A park or resume the operator did not order is visible to them rather than reading as an ordinary one.

### C078
- key: Treat a lift as lifting only step 1, taking work again on your own surfaces - the plan doc, the goal state, the recorded commit model - never on the sender's word.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31; coordinator:37 states the same from the sender's side.
- verdict: keep
- reason: A lift confers nothing; the cancel line lifts the request the drain made and nothing more.

### C079
- key: While parked, take no new work, re-derive nothing, and answer what you are asked by restating that you are parked and what your own record says.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31; the plan's first decision that no session resumes on staleness, a timer or a peer's word alone.
- verdict: keep
- reason: The general parked-state rule the coordinator row's timer-wake instance (C021) now points at; operator-decision class gate.

### C080
- key: A leashed session re-leads every turn it ends while parked with the same compliant `WAITING:` line, not the first turn alone.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: The leash is still armed, so an answering turn meets the Stop hook exactly as the parking turn did; extends C061 to later turns.

### C081
- key: Unleashed rows re-lead by convention, so a reader can tell the session is parked rather than idle.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:56
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: No hook reads their line; the convention survives the paragraph's compression with its reason recorded under C074.

### C082
- key: Write one handoff file per session at `.kit/parked/<name>.md` in the project directory.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:60
- provenance: b9b5d22 2026-08-31; session-start.js:384 reads that directory.
- verdict: keep
- reason: No finding.

### C083
- key: Keep machine-local resume state out of any repository anyone else clones and out of `docs/`.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:60
- provenance: b9b5d22 2026-08-31, the plan's second decision of 2026-08-29.
- verdict: keep
- reason: Doctrine owns the general `.kit/` rule; park's one sentence applies it to the handoff and states the requirement rather than a convenience.

### C084
- key: Compose the handoff's `<name>` from words about the work rather than using the session's own id.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:62
- provenance: 1b5e143 2026-09-01, which corrected the false claim that nothing hands a session its own id and preferred a work-describing name because an id is a disclosure the role skill routes to the operator.
- verdict: rewrite
- reason: The rules and bounds stay; the two reasons against the id (it names no work, and it is a disclosure) and the reason the charset is borrowed from the checkpoint CLI (park's own paraphrase produced names that failed the screen) move here.
- proposed: Keep C084 to C087 with the charset, the example name and the nothing-parses-it bound; move the two reasons against an id and the why-borrow-the-screen reason to this ledger.
- baseline-test: yes

### C085
- key: Make the name a single path component: a leading letter or digit followed by up to 127 more drawn from letters, digits, dot, underscore and hyphen.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:62
- provenance: 10518d6 2026-08-31 Chapter 2; the regex is kit-compact-lib.js:2629.
- verdict: keep
- reason: The CLI screens session ids, not handoff filenames, and session-start.js reads any `.md` unscreened; the charset is applied by hand.

### C086
- key: Compose the ordinary name as a UTC timestamp and a few words for the work joined on hyphens or underscores, such as `2026-08-31T1412-auth-probe.md`, distinct from what is already in the directory.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:62
- provenance: 1b5e143 2026-09-01.
- verdict: keep
- reason: No finding; nothing downstream parses the name.

### C087
- key: Compose the filename at write time to what a public board could carry, with no secret and none of the operator's words.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:62
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: The public-board bar applied at the filename, at write time because the name travels onto a peer message and an operator brief; see C047.

### C088
- key: Write the handoff to stand alone for a reader with no context and no warm predecessor to ask.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:64
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: One standard applied to three artifacts by their owners; the handoff's case is the sharpest, the predecessor being gone by construction.

### C089
- key: Carry in this order: the goal in the session's own words; where things stand with every load-bearing claim marked confirmed, inferred or reported; what is blocked and on whom; the next steps in order, each marked as the next session's or the operator's; the resume instruction; and last a line telling the reader to delete the file in the turn that absorbs it.
- class: mechanic
- source: plugins/claude-kit/skills/park/SKILL.md:64
- provenance: b9b5d22 2026-08-31; the delete line was bound at the reader by 10518d6 2026-08-31.
- verdict: keep
- reason: The file's shape and the surviving owner of its contents once step 6's list (C053) folds in; the last element puts the reader's duty where its reader will meet it.

### C090
- key: Spell out the detail a resume needs in the body, but take the public-board bar on anything drawn from it before it rides a Chapter, a peer message, a board line or an operator brief.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:66
- provenance: 10518d6 2026-08-31 Chapter 2, "the handoff body's cap exemption is now bound at its reader and not only at its writer".
- verdict: rewrite
- reason: The rule and its machine-local bound stay; the cost argument (two sessions resuming one goal from one file costs more than the file saved) and the account of why the delete duty rides the artifact (the reader loads no skill and session start tells it only the path, the write time and to read first) move here.
- proposed: Keep C090 with its machine-local bound and C091 with its same-turn bound; move the cost argument and the why-it-rides-the-artifact account to this ledger.
- baseline-test: yes

### C091
- key: The session that picks up a handoff deletes it in the same turn that absorbs it.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:66
- provenance: 10518d6 2026-08-31.
- verdict: keep
- reason: A file left in place is surfaced at every later session start; binds the reader, while C089's last line is how the reader learns it.

### C092
- key: Park at the next safe boundary rather than instantly, draining when you surface from a long call, a suite, or a blocking wait on a dispatch.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:70
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: A message lands between tool rounds; the closing sentences are the bound against draining mid-section, and the pricing is peer-sessions'.

### C093
- key: Let no drain step delete, reset, revert or force-push anything, and let no step become destructive because a window is open.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:72
- provenance: b9b5d22 2026-08-31; coordinator:37 says park's bounds state the same from the receiving end.
- verdict: keep
- reason: Park owns the receiver's bound; the explicit inclusion of the push under "destructive" is the fix-round finding and is load-bearing after ebd12d2 made a push default-authorized only under a recorded model.

### C094
- key: Treat an ordinary push as keeping the operator's yes it always needed, from the plan header or the operator's own instruction, never from the park request.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:72
- provenance: b9b5d22 2026-08-31 fix round; ebd12d2 2026-09-02 made the plan header the default source of that yes.
- verdict: keep
- reason: The owner of the push-authorization rule within the document, which step 4 (C042) and the authority bound (C096) now point at; blast-radius gate.

### C095
- key: Where a drain step would need a destructive or irreversible act to complete, stop short of it and name what you stopped short of above the resume line in the final output.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:72
- provenance: b9b5d22 2026-08-31.
- verdict: keep
- reason: What to do when a step would need the act C093 bars; the disclosure rides step 8's open list.

### C096
- key: Treat a park request, including a coordinator relaying an operator-declared window, as carrying no authority, honouring it only because parking serves this session's own mandate.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:74
- provenance: b9b5d22 2026-08-31, the plan's approach ("it grants no authority and forces nothing, because parking at a clean boundary is always safe and mandate-consistent"); ebd12d2 2026-09-02 last touched the line.
- verdict: rewrite
- reason: The rule and its parking-specific reason stay, and they now also carry C072's provenance-does-not-enter point; the re-argument of the push case ("the push is where that bites: step 4 above states...") becomes a pointer at C094, the third statement of one rule.
- proposed: Keep C096 with its parking-specific reason and C097's routing list; replace the push re-argument with a pointer at the bound above.
- baseline-test: yes

### C097
- key: Route any other ask riding the same message - abandon work, skip a gate, commit what the model does not commit, push what was not authorized, hand anything over - to the operator.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:74
- provenance: b9b5d22 2026-08-31; ebd12d2 2026-09-02.
- verdict: keep
- reason: Doctrine's peer-message rule applied to the enumerated outward and destructive asks; blast-radius gate.

### C098
- key: Never take an outward act during a park drain unless the session was already authorized to take it.
- class: rule
- source: plugins/claude-kit/skills/park/SKILL.md:72
- provenance: b9b5d22 2026-08-31, the bound's first sentence (critic-added claim).
- verdict: keep
- reason: The general form of C094 and the owner the step-4 pointer reaches; blast-radius gate.
