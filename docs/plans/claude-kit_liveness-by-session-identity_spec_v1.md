# Liveness is decided by the session, never by the seat name it wears

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-02

Session model: any executor session in the kit repo; four sections, tiers per section. Authored by the KIT: Expert seat from the 2026-09-02 kaizen pass, which dispositioned four inbox notes from two machines and one operator-tier memory record into this one design. Anchors are authoring-time; re-locate every hit by content. Section 2 edits the coordinator skill, which the board-routing-and-homing plan is rewriting ahead of this one in the same queue, so its anchors are re-derived at dispatch rather than trusted from here.

## Dispatch Authorization

Authorized 2026-09-02 by the operator, first-hand on the allowlisted relay thread, to be appended to the kit worker's armed queue: the four sections rekeying the registry prune and the heavy-slot release on session identity as designed here, ninth in the queue. The operator's word was the answer to a decision batch the KIT: Expert seat put on the relay, choosing the recommended option of appending the pass's four code-and-design specs to the worker's queue in the order code batch, liveness, claim writer, provenance; that seat recorded it here and ran the append. Per the peer-sessions trace rule this section is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's message on the Expert session's relay thread, and the plan arms only by the operator's word or the Expert seat's append under it.

## Goal

Two kit mechanisms decide whether the writer of a coordination artifact is still alive, and both decide it by joining the artifact's self-chosen `Name:` against the live roster. The kit's own naming convention makes that name stable across re-seats: a successor taking the Expert seat is `KIT: Expert` exactly as its dead predecessor was, and the operator's habit after every fleet restart is to bring seats back under the names they held, because the names say what a seat is responsible for. So on every machine that follows the convention, a dead predecessor's registry entry joins to its live successor and reads present forever, and a dead predecessor's heavy-process claim is probed at an address its live successor answers, which forecloses the release exactly when the slot is most needed. Neither failure produces a wrong answer anywhere a reader would notice: the registry accretes and the slot reads held, both in the fail-closed direction, both silently.

When this plan is done: the operator keeps the naming habit unchanged; the registry prune and the claim release decide liveness on the session identifier the artifact already carries, corroborated by an instrument no agent writes, the harness transcript's own modification time; a name match on the roster establishes presence of the name and nothing about the entry's session, so it never vetoes a verdict the other readings establish; a probe answer that disclaims a claim has its own disposition instead of counting as an answer that forecloses release; and the coordinator runbook carries five amendments the inbox has owed it since 2026-08-30, all on the same reconciliation surfaces.

## Evidence

- The role skill's directory contract states the prune's exited verdict on two readings of the entry itself, the roster resolution keying on the entry's `Name:` and the staleness test on its `Heartbeat:`, and says in its own words that no artifact on this machine independently attests that a session id is dead (`plugins/claude-kit/skills/role/SKILL.md`, the paragraph opening "Exactly one act deletes a foreign registry file"). The claim protocol addresses the probe by the claim's `Name:` while scoping the delete by `Session:`, and names the collision as a residual rather than a defect (same file, the claim-file section and the probe paragraph).
- The coordinator runbook runs the roster read as a diff against the registry keyed on the name join and states the heartbeat leg as what tells an off-roster entry apart from a dead one (`plugins/claude-kit/skills/coordinator/SKILL.md:43-47` at HEAD `d09d099`; re-locate by content, the board-routing plan is rewriting this file).
- Four kaizen notes, two per machine, describe the same join failing in both mechanisms: `kaizen/notes-NEO-CLAUDE.md` 2026-08-31 (two notes, the registry instance and its general form, with the live NEO-CLAUDE case of three dead seats shielded by three successors), and `kaizen/notes-SCOTT-CLAUDE.md` 2026-08-31 (the reusable-label note, measured as six predecessor entries against four returning seats with three immediately unprunable, and the silence-gated release note). All four sit in the store's history at the kaizen capture commit this pass made.
- The operator-tier memory `a-self-stamped-liveness-field-cannot-establish-exit` records the coordinator seat's 2026-09-02 measurement: four entries satisfied both contract legs while two of their sessions had committed within the hour, heartbeat lag of 11.2 and 13.8 hours, and the transcript modification time discriminated the two live ones from the two dead ones. Reported by that seat; this plan's section 3 makes the reading an instrument rather than a hand check.
- The transcript's location is already a kit resolution: `kit-goal.js` corroborates a binding against `<sessionId>.jsonl` under the harness's projects directory through memq's `sessionTranscriptDir` (`plugins/claude-kit/hooks/kit-goal.js:109-131`).

## Decisions

Decided 2026-09-02 by the Expert seat under standing adjudication; each is reversible at arming and the operator may overrule any of them there.

1. **The naming convention stands.** Seats keep their function-named addresses across re-seats. The peer-sessions skill already states that names collide by construction, so the fix lands in the mechanisms that assumed otherwise, never in the operator's habit.
2. **The roster leg becomes refusal-only.** The harness roster prints a name and a `[ref]` and never a session id, so a name match can establish only that some session wears the name. A matching row therefore blocks nothing and licenses nothing; a name matching no row remains a candidate reading as today. The verdict's evidence moves to the two readings that are about the entry's own session: its `Heartbeat:` staleness, and the transcript reading below.
3. **The transcript modification time is the corroborating leg, and it is required.** An entry is exited only where its heartbeat reads stale past the bound the coordinator runbook states AND the transcript at `<projects>/<project>/<Session>.jsonl` is either absent or stale past the same bound. A fresh transcript reads live whatever the heartbeat says, because a session can stop stamping while it keeps working, and the error of the self-stamped field runs only toward looking dead. Alternative weighed: keying the roster join on the `[ref]` the runbook points at for collisions, declined because nothing documented maps a `[ref]` to a session id and a join on an undocumented mapping is a join on a guess.
4. **A disclaiming probe answer is a third reading, and it licenses release only with the transcript leg beside it.** Today an answer of any content forecloses the release. Under this plan the probe names the claim's `Session:` and asks the answerer whether that id is its own; an answer stating it is not is a disclaim. A disclaim alone stays what it is today, an untracked hold reported to the operator, because it is an unauthenticated assertion any peer can make. A disclaim plus a transcript reading that the claim's session is absent or stale past the claim bound licenses the release, on the record and with the notification the protocol already requires, since two independent readings then agree and one of them is machine-written. Alternative weighed: honouring a disclaim alone, declined for the reason the NEO note itself weighs, that a confused or hostile peer could free a slot in use.
5. **The clearance is a third act and it is named.** The doctrine's one-heavy-process bullet governs a session's own spawn, start, and re-run on a clean poll and says nothing about telling another session the box is clear. This plan states the coordinator's half (section 2); the doctrine's half rides the kaizen prose batch plan, cross-referenced under Related, so the two land in the same wording.

## Sections of Work

### 1. The prune reads the session, and a name match vetoes nothing. Model: opus

Amend the role skill's directory contract so the exited verdict is stated on the three readings decision 2 and decision 3 name: the roster leg as refusal-only, the heartbeat leg unchanged, and the transcript leg with its location rule (the harness projects directory, the entry's own `Session:` as the filename, the same resolution `kit-goal.js` uses) and its two dispositions (absent, or stale past the runbook's bound). State the fail-closed reading for the case where the projects directory cannot be read: unknown, never exited. Amend the claim protocol's probe paragraph so the probe carries the claim's `Session:` and asks for it, and add the disclaim disposition of decision 4 beside the existing answered and unanswered ones. Remove the sentence claiming no artifact independently attests that a session is dead, replacing it with the transcript leg's own limit: the transcript attests activity, and an idle live session and a dead one read alike until the bound passes. Whole-file review by the reviewers, because the skill's amendments collide with unchanged neighbours (project memory `skill-amendments-collide-with-neighbours`).

Acceptance: the three readings stated with their dispositions; the disclaim disposition present; no sentence left that lets a matched name veto an exit; a parity check that every copy of the prune rule in the coordinator skill points at this contract rather than restating it; targeted lane green with its delta named against a recorded baseline; no em dashes.

### 2. The coordinator runbook takes the same readings and five owed amendments. Model: opus

Re-derive anchors at dispatch: this file is rewritten by the board-routing-and-homing plan earlier in the queue. Amend the roster-diff and heartbeat paragraphs to the three-reading verdict of section 1, pointing at the role skill for the rule and stating only the coordinator's own procedure and bound. Add the probe's `Session:` ask and the disclaim disposition to the claim adjudication paragraph. Then the five amendments the inbox owed this runbook: the store-durability test gains the `kit-sync-attempt` marker as a third leg with both readings spelled (marker advanced while the state file is stale means the spawn chain is broken; both stale means no spawn was attempted); the machine-state sentence a seat sends outward names the poll it rests on and its age, or says "not polled this turn", and an arbitration answer and a machine-state answer are separate sentences; the incident funnel, on a `goal-blocked` event whose `docs/plans/` path no longer resolves, tries the same filename under the project's archive home before ruling the event unresolvable; the board-read step and every other path-naming lookup in the runbook name the operator memory tier as the layer that can override the path before the not-found branch is taken; and the BLOCKED funnel paragraph states that the sentinel-repair loop is leash machinery too, so an unleashed worker's declaration reaches the seat only if it was well-formed on the first try.

Acceptance: each amendment present and pointing at its owner where an owner exists; the runbook restates no rule the role skill owns, per the ownership map; whole-file review; targeted lane green with delta named; no em dashes.

### 3. The stamp audit gains the transcript reading. Model: opus

Extend `plugins/claude-kit/hooks/kit-registry-stamp.js audit` with one reading per registry entry: locate the entry's transcript by its `Session:` through the same resolution `kit-goal.js` uses, report its modification-time age beside the entry's heartbeat age, and flag the two disagreements that matter, a heartbeat lagging the transcript by more than the seat-stop throttle window (the session is alive and not stamping) and an absent transcript (no session by that id on this machine). The reading is a report and never a verdict, exactly as the existing findings are. State on the report what it scanned and what it could not read, so a projects directory it could not open reads as unscanned rather than as every transcript absent. Tests over fixture directories: a fresh transcript against a stale heartbeat flags, an absent transcript flags, an unreadable projects root reports unscanned, and a clean pair prints no finding.

Acceptance: the four fixture cases green, watched red first against the pre-section code; the audit's coverage line names the transcript scan; `node --test test/kit-registry-stamp*.test.js` green with delta named against a recorded baseline.

### 4. The dispatch brief and the reviewers' charters see nothing new here, and the security model names the transcript read. Model: sonnet

`docs/security-model.md` prices the coordinator seat's reads; add the transcript modification-time read to its enumeration, stating what it discloses (that a session by that id was active at a time) and that the read never opens the transcript's content. Confirm by reading them that the executing-work brief clause and the reviewer charters need no change, and record that confirmation in the Chapter rather than editing them.

Acceptance: the security model's coordinator read-surface enumeration carries the read; the Chapter records the two no-change confirmations with the lines read; targeted lane green.

## Out of Scope

- Authenticating any field. Every reading here narrows an honest writer without authenticating one, and the transcript leg is corroboration, never proof.
- Changing the naming convention or the `[ref]` mechanism the harness prints.
- The claim's write side, its waiter rule and its release tombstone, which `claude-kit_claim-protocol-writer-side_spec_v1.md` owns.
- The doctrine's own clearance clause, which the kaizen prose batch plan carries.

## Related

- `claude-kit_claim-protocol-writer-side_spec_v1.md`: the same protocol's other half.
- `claude-kit_kaizen-prose-batch_spec_v1.md`: carries the doctrine half of decision 5.
- `../archive/claude-kit_board-routing-and-homing_spec_v1.md`: rewrites the coordinator skill ahead of section 2; anchors re-derive.
- Operator memory `a-self-stamped-liveness-field-cannot-establish-exit`: the measurement and the general rule.
- Kaizen triage record `kaizen/archive/2026-09-02-pass-triage.md`: the notes this plan dispositions.
