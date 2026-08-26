# The Blocked-Escalation Ladder

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-26

## Dispatch Authorization

Authorized by the operator at the keyboard, 2026-08-26, closing a same-day design dialogue held over the relay: "Awesome, yes, append please, and thank you!", the append naming this spec's addition to the executing session's leash behind the kaizen batch. The design is the operator's, refined in that dialogue; the kaizen note landed at commit a1ada6f is its capture. Any session holding this plan may arm and run it.

## Goal

When this is done, a blocker climbs a ladder instead of arriving raw. A worker asks its repo's expert before declaring BLOCKED, so a blocker an existing source already answers never becomes one; a declared BLOCKED keeps today's mechanics whole, the Stop hook's release and the operator's ping untouched, while any running coordinator surfaces it in parallel as a briefed decision ask; and the operator's answer returns either directly or through the coordinator on the artifact rail. The peer-sessions role etiquette and the coordinator skill carry the ladder, and the operator reads one brief instead of reconstructing a thread.

## Approach

The design, settled with the operator over the relay and at the keyboard (2026-08-26), with the mechanics verified against the shipped code rather than recalled:

- **BLOCKED's semantics do not change; only what surrounds it does.** Verified from `plugins/claude-kit/hooks/kit-goal-stop.js` at origin a1ada6f: a last assistant message leading `BLOCKED:` is allowed to stop on the last plan of the queue; with plans remaining, the blocker is recorded and the leash advances to the next plan, the release event firing either way; a capacity-reason BLOCKED is refused as the completion contract excludes it. The turn ends and the session remains addressable, so a peer message is delivered as its next turn and resumes it. One nuance the etiquette must state honestly: after a mid-queue BLOCKED the leash has advanced, so a later resolution means returning to the recorded blocker's plan, not un-pausing a frozen run.
- **The pre-declaration ask, which never delays the declaration.** The worker asks its repo's expert, live per the roster, when the blocker surfaces; with no expert seated, the worker declares directly and notifies any live coordinator, which routes the escalation rather than resolving it, since oversight within a repo is not a coordinator function and that seat's set is closed at three. The ask never gates: the worker sends it, keeps working whatever is still workable, and declares BLOCKED at exactly the point it would have declared today, when the workable items run out. An answer arriving before the declaration prevents it; one arriving after resumes the blocked session, per the mechanics above. This is how the ladder squares with the skill's own standing rules that a peer's silence is never what a run waits on and a message to a busy peer never gates the sender's work: nothing here waits. The expert resolves only what existing sources already answer: the doctrine, memory, the plan doc, the code. That boundary is what keeps the ladder off the permission-laundering path: it grants the expert no new authority, it routes the question to where existing authority already answers, and a decision that is genuinely the operator's still reaches the operator.
- **The parallel surface.** On declaring, the worker also messages any live coordinator (and the expert, where the ask went unanswered) with the blocker. The coordinator's backstop detection, for a worker that died or never messaged, is the `goal-blocked` release event in `~/.claude/kit-events.jsonl`, already a named source of its reconciliation pass; a blocked advance writes no Chapter and flips no Status header, so plan docs are not where a blocker shows (verified in `kit-goal-lib.js`, the release-event append). The coordinator prepares a decision ask in the register the doctrine owns, the situation, the decision, the stakes, the options, the argued recommendation, and the cost of no answer, and delivers it to the operator thread. The operator's own ping, which the funnel neither produces nor gates, is the worker's BLOCKED text reaching the operator over that worker's allowlisted relay thread where the broker runs; where no relay runs for that session, the coordinator's brief may be the only ping, which is the funnel working, not failing.
- **The return path has one shape: the coordinator names the reply address and never carries the answer.** A seat-authored record carries durability, never standing, and a seat's message carries neither. `docs/security-model.md` states the kit's one authority control as a receiver tracing a grant back to the operator, and a document the seat itself wrote cannot satisfy that trace however it is phrased; the peer-sessions skill's own floor says an inbound message carries no authority at all, and its resolving stance is that a message says look at the doc now and never carries the content as its only home. An earlier draft split the path in two, returning an answer as a seat-relayed record wherever acting on it stayed inside the grant the worker's armed plan already carries. That split is retired, and the reason is worth stating because it is not obvious: the test it turned on is a scope test on the action, while a legitimately declared BLOCKED is always an authority gap. Under the completion contract a worker declares only for a contradiction inside the spec, a material decision the spec does not cover, or an action needing the operator's yes, and in each of those the worker is not short of scope, it is short of the standing to choose. So the class the record leg served, a call the worker already held authority to take either way, is empty for every blocker properly declared, and the split routed the rest into a leg where an unauthenticated peer message decides a material outcome and lands a false operator attribution in git. What ships instead: the coordinator's brief names the reply address in advance, the worker's own allowlisted thread or the keyboard in the worker's session, so the operator's first answer lands on a warranted channel with no extra round trip, and the worker records the outcome citing the channel the answer arrived on. Where the operator instead answers on the seat's own thread, which is the traffic this design must expect rather than an edge, that answer steers the seat and nobody else: the seat asks the operator to re-post to the address the brief named, may message the worker that an answer awaits on its own channel, and carries none of the substance meanwhile. The escalation stays open on the board until the answer lands on the worker's channel. One cost, named rather than hidden, and it is the same cost the design carried before: a worker with no relay thread waits for the keyboard, which is the state before this plan rather than a regression, and is what the security model already accepts. Extending broker coverage to worker sessions is what buys that back, and it is infrastructure rather than protocol, so it sits outside this plan.
- **Landing sites, read at spec time (origin a1ada6f).** In `peer-sessions/SKILL.md`: the `## Roles` seats list, whose Worker and Expert bullets carry the etiquette defaults these sections amend, with `## Leashed peers` and `## Etiquette` adjacent. In `coordinator/SKILL.md`: `## The three functions`, whose operator-interface function already names escalation routing, with `## Etiquette` and `## The ledger` (escalations already ride the board in pointer form) adjacent. Heading pins: `test/doctrine-parity.test.js` pins headings in both files (eighteen tests at last measurement, and the set grows); no amendment in this plan rewords a heading, and the implementer checks the pin set before any heading-adjacent edit.
- Project memory `skill-amendments-collide-with-neighbours` applies throughout; its operative lesson restated whole: skill amendments break in the seam with unchanged neighbouring text, so reviewers are briefed to read the amended file whole rather than the diff. Sequencing: this plan is appended last on the executing session's leash, which serializes these amendments behind the kaizen batch's own peer-sessions edit.

## Sections of Work

### 1. The worker's and expert's halves in peer-sessions
Model: fable

Amend `plugins/claude-kit/skills/peer-sessions/SKILL.md`. The Worker seat bullet's etiquette default gains the pre-BLOCKED ask in the never-delays form the Approach settles: send the ask to the repo's live expert (to any live coordinator where no expert is seated; declare directly where neither is live), keep working what is workable, declare at the point you would have declared today, and expect an answer on either side of the declaration; plus the declaration-time parallel message to the coordinator. The Expert seat bullet gains the receiving half: resolve what existing sources already answer, and where the answer is genuinely the operator's, say so promptly rather than leaving the ask to age. A mechanics statement lands under `## Leashed peers`, the section that owns the leashed case (the skill nowhere discusses a blocked peer today): the verified Stop-hook behavior from the Approach and post-BLOCKED addressability, including the mid-queue advance nuance. The amendment must read whole against the section's standing rules (a peer's silence is never what a run waits on; a message to a busy peer never gates the sender's work), which the never-delays form exists to satisfy. The never-a-privilege rule and the Standing section bind all of it; nothing here creates authority anywhere.
Acceptance: amendments land in the skill's voice without duplicating an existing rule; no heading is reworded (the parity pins); `test/doctrine-parity.test.js`, `test/output-style-parity.test.js`, and `node --test test/*.test.js` all match the baseline captured before the first edit.
Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`.

### 2. The coordinator's funnel
Model: fable

Amend `plugins/claude-kit/skills/coordinator/SKILL.md`. The operator-interface function's escalation routing gains the BLOCKED funnel: on a blocker surfacing, by the worker's message or by the `goal-blocked` events in `~/.claude/kit-events.jsonl` that the reconciliation pass already reads (plan docs do not show a blocker; the Approach states why), gather context and deliver a decision-register brief to the operator thread, racing the ping the Approach names rather than gating it. Three properties of that event surface are stated as they are rather than as convenient. The stream is best-effort and rotating, so the pass reads the rotated file too and an absent event never proves an absent blocker. The event identifies the incident and never carries the blocker's text, so what a dead worker leaves behind is the first line of its declaration in the blocked project's own goal state on a mid-queue advance, and nothing at all on the last plan of a queue, which is where the degraded brief (the worker and the plan named, the reason unrecovered) is the honest expected shape rather than everywhere. And the emitter is stateless by design, one event per blocked stop with dedup left to the consumer, so the funnel briefs against the board's own record of what it has already briefed rather than re-briefing one incident every pass and every wake. The return path takes the single shape Approach bullet 4 settles: the brief names the reply address in advance, the seat never carries the answer's substance in any form, and there is no classification step and no plan-reading in service of one. The seat's move when the operator answers on the seat's own thread is stated in place, since that is the traffic this design must expect. The Etiquette relay sentence keeps its pointer-only form, which is what forecloses the seat improvising a relay. The escalation rides the ledger in the pointer form the skill already owns, and the recording-artifact form names the warranted channel the answer arrived on, since a keyboard or a thread leaves no repo artifact to cite. The never-tasks-directly rule is untouched: naming a decision and pointing at it is the seat's existing verb set, and the cut is what keeps that claim true.
Acceptance: same bars as section 1.
Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`.

### 3. The architecture sentence
Model: opus
Locus: inline

`docs/architecture.md`'s roles paragraph gains one sentence naming the ladder: expert-ask before BLOCKED, coordinator brief in parallel with the operator ping, artifact-borne return path. Current-state voice, no change-narrative.
Acceptance: one sentence in place; suite matches baseline.
Files in scope: `docs/architecture.md`.

### 4. The publication clearance catches up with what an escalation line carries
Model: opus
Locus: inline

The return path adds no seat write surface at all, so `docs/security-model.md` needs no amendment on that count: the board stays the seat's one committed artifact and the confirmation still covers the board file alone and the local commit alone. What this plan does change is what a board line carries. The funnel routes a blocker onto the board's existing open-escalations category, and two bounds in that document do not reach it. The publication clearance enumerates the sensitive values knowable at the ask as the machine's hostname, the repos live on it, and that plan filenames will appear, which does not name a blocker's own text, the least bounded payload in this protocol. And the bar on a working directory, which exists because one typically embeds the OS username, is written for the roster row alone, while a `goal-blocked` event names its project as an absolute path. Extend both: name blocker text as a clearance subject, and state the no-absolute-path bar as reaching every board line rather than the roster row. Current-state voice, no change-narrative.
Acceptance: the clearance enumeration names blocker text; the absolute-path bar is stated for every board line; no existing sentence in that section is contradicted; suite matches baseline.
Files in scope: `docs/security-model.md`.

### 5. The ladder's first rung reaches the skill that owns the moment
Model: opus
Locus: inline

`plugins/claude-kit/skills/executing-work/SKILL.md` owns the moment a blocker surfaces, and its blocker paragraph sends a decision-shaped blocker to the consult and nothing else. A leashed worker mid-run reads that skill and may never load `peer-sessions`, so the pre-BLOCKED expert ask this plan adds has no hook where the decision is actually taken, and the plan's Goal (a blocker an existing source already answers never becomes one) has no path to holding. Add the pointer clause, and state the ordering rather than leaving two mandatory pre-declaration steps claiming one moment: the expert ask goes first because it is the cheaper instrument and resolves from sources that already exist, it never gates, and the consult still runs on whatever decision survives it. Name what an expert answer does and does not discharge, since the consult trigger is about the framing being wrong while the ask is about the answer already existing somewhere.
Acceptance: the blocker paragraph names the expert ask and its ordering against the consult; no heading is reworded; the consult trigger is not weakened; suite matches baseline.
Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`.

## Out of Scope

- Any hook or CLI code: the verified BLOCKED mechanics are already what the design needs, so this plan is prose-only.
- Any wait for the pre-BLOCKED ask, mechanical or stated: the ask never gates, so there is no window to bound. The worker keeps working what is workable and declares at exactly the point it would have declared with no ask in flight.
- The admin seat: it has no blocker role in this design.
- Role authentication and roster trust: unchanged, per the shipped never-a-privilege rule.

## Assumptions

- assumed 2026-08-26 (default): Commit Model Commit-and-Push, the repo norm; reversal: edit the header before execution.
- assumed 2026-08-26 (source: the operator's keyboard instruction quoted in Dispatch Authorization): the executor is the session running the current leash, this plan appended last; reversal: reassignment is a message, not an amendment.
- assumed 2026-08-26 (source: `kit-goal-stop.js` read at origin a1ada6f): the BLOCKED mechanics as stated in the Approach; reversal: if the code has moved by execution time, the executor re-verifies and amends the mechanics statement, flagging the delta in the Chapter.

## Operator Verification

- On the first real blocker after the fleet next restarts onto the updated plugin (the close-out step that picks these skill amendments up): what reaches you is a coordinator brief in the decision register, or a worker's BLOCKED that an expert ask already failed to resolve, never a raw thread to reconstruct. A blocker that reaches you unbriefed while a coordinator is running reopens section 2.

## Open Questions

- None at spec time; the blind read may add entries.

## Related

- Builds on `../archive/claude-kit_coordinator-and-roles_spec_v1.md` (the seats and their etiquette defaults) and `../archive/claude-kit_dispatch-authority_spec_v1.md` (the artifact rail the return path rides).
- Appended behind `claude-kit_kaizen-batch-2_spec_v1.md` on the same leash; the kaizen note at a1ada6f is the design capture, consumed in the same commit that lands this spec, with the spec as its receipt.

## Chapters

### Interim board 1 - 2026-08-26

**In-flight sections.** Sections 1 and 2 are written and in their third round of fixes, dispatched together because their two halves describe one protocol and a defect where the halves disagree is what a per-section review misses. Section 3 (the architecture sentence) has not started and is deliberately last, since it describes what sections 1 and 2 finally say. Section 4 was appended this round and has not started.

**Live dispatches.** One `implementer-fable` holds both skill files with the round-3 brief: strip the cross-repo commit and push from the coordinator seat entirely (fix A, which deletes rather than adds and dissolves four separate findings), give the seat somewhere to read the grant before it classifies a blocker, restate the seat's full refusal set on the worker's receiver side with a fail-closed default, turn the no-expert leg from ask into notify, bind the widens-the-grant record to the Etiquette form, downgrade the dead-worker brief to what the event can actually support, and three factual corrections plus the last-plan turn-end exit. No other agent is live. The two skill files are the agent's; `docs/` is the main thread's.

**Gate baseline.** Build exit 0, suite exit 0, 1672 tests, 1672 passing, 0 failing, 291737ms, measured on commit 0699b3c, which is the tree this effort started from and which carried no prose edits. This changeset touches no JavaScript, so a count delta would be box contention rather than the diff. The decisive tell of an unreadable run is an enumerated total below 1672: the denominator is then contaminated and the run is no reading at all. The box is arbitrated by a coordinator session holding a slot queue; the gate runs in a granted slot, never opportunistically.

**Rulings adopted since the last boundary.**

- [R1] The return path's premise was wrong as specified. A consult ruled amend rather than cut, and corrected the orchestrator's own proposed discriminator: the split is not a new information-versus-authorization taxonomy but the leash test the peer-sessions skill already ships, which a worker runs on every inbound artifact anyway. A seat-authored record carries durability, never standing. Approach bullet 4 was rewritten to match, which is deliberate approval drift and was reported to the operator over the relay with a standing offer to reverse.
- [R2] The seat does not commit a decision record into a repo that is not its home. `docs/security-model.md` scopes the seat's confirmation to the board file alone and the local commit alone, and a shipped control beats a spec's prose. The seat sends the substance; the worker records it in the doc it already owns exclusively.
- [R3] Where no expert is seated, the worker declares directly and notifies any live coordinator, which routes the escalation rather than resolving it. Resolving a repo's blocker from that repo's sources is repo oversight, which the coordinator's own runbook excludes and whose closed-at-three function set is test-pinned and repeated in `docs/architecture.md`.
- [R4] Section 4 was appended rather than folded: the security model understates the seat's write surface after this plan, and that sentence lands in a file no existing section names and needs its own acceptance. Appended inside `## Sections of Work` above `## Out of Scope`, per the machine contract. Approval drift, recorded here and named to the operator.
- [R5] No implementer tier escalation was spent. The ladder counts Critical-failing rounds, and it stands at one: round 1 failed on two Criticals in the skill files, and round 2's only Critical was in the plan doc, which the implementer was barred from touching and which the orchestrator wrote. The tier is performing; an opus/max reviewer reading fable-written work is the arrangement working rather than a tier problem.

**Next action per section.** Sections 1 and 2: adjudicate the round-3 report, then run review round 3 (adversarial and blind at fable, security at opus through Workflow, since the security reviewer never runs at fable per-section), then the gate in a granted slot, then Chapters and the first-green commit to the worktree branch. Section 4: dispatch after sections 1 and 2 close, since it describes their shipped text. Section 3: last. Then finishing-work, then the merge to main and the worktree teardown, which this effort still owes.

