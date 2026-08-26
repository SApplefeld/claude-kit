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
- **The pre-declaration ask, which never delays the declaration.** The worker asks its repo's expert, live per the roster, when the blocker surfaces; with no expert seated, the ask goes to any live coordinator, which may resolve from the same sources; with neither live, the worker declares directly. The ask never gates: the worker sends it, keeps working whatever is still workable, and declares BLOCKED at exactly the point it would have declared today, when the workable items run out. An answer arriving before the declaration prevents it; one arriving after resumes the blocked session, per the mechanics above. This is how the ladder squares with the skill's own standing rules that a peer's silence is never what a run waits on and a message to a busy peer never gates the sender's work: nothing here waits. The expert resolves only what existing sources already answer: the doctrine, memory, the plan doc, the code. That boundary is what keeps the ladder off the permission-laundering path: it grants the expert no new authority, it routes the question to where existing authority already answers, and a decision that is genuinely the operator's still reaches the operator.
- **The parallel surface.** On declaring, the worker also messages any live coordinator (and the expert, where the ask went unanswered) with the blocker. The coordinator's backstop detection, for a worker that died or never messaged, is the `goal-blocked` release event in `~/.claude/kit-events.jsonl`, already a named source of its reconciliation pass; a blocked advance writes no Chapter and flips no Status header, so plan docs are not where a blocker shows (verified in `kit-goal-lib.js`, the release-event append). The coordinator prepares a decision ask in the register the doctrine owns, the situation, the decision, the stakes, the options, the argued recommendation, and the cost of no answer, and delivers it to the operator thread. The operator's own ping, which the funnel neither produces nor gates, is the worker's BLOCKED text reaching the operator over that worker's allowlisted relay thread where the broker runs; where no relay runs for that session, the coordinator's brief may be the only ping, which is the funnel working, not failing.
- **The return path rides standing or the artifact, never a relay's word.** The operator answers directly (the keyboard, or the worker's own allowlisted thread, both carrying channel standing), or through the coordinator: the coordinator records the decision in the blocked plan's doc in the form the coordinator skill's own Etiquette already imposes on a recording artifact, stating the decision's substance in the recorder's words, dated, naming the artifact holding the operator's words rather than quoting them, then messages the worker a pointer. A peer relay of the operator's words carries no operator standing, per the peer-sessions Standing rule, which is why the artifact carries it. The recording commit's license is the operator's answer itself: answering through the coordinator is the instruction to carry that answer to the worker on the rail, and the commit it takes is scoped to the decision record alone, on the owning repo's current branch per that repo's commit norm, pushed where pushing is that norm so every checkout sees it.
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

Amend `plugins/claude-kit/skills/coordinator/SKILL.md`. The operator-interface function's escalation routing gains the BLOCKED funnel: on a blocker surfacing, by the worker's message or by the `goal-blocked` events in `~/.claude/kit-events.jsonl` that the reconciliation pass already reads (plan docs do not show a blocker; the Approach states why), gather context and deliver a decision-register brief to the operator thread, racing the ping the Approach names rather than gating it. The return path per the Approach: a decision the operator answers on the coordinator's channel is recorded in the blocked plan's doc in the recording-artifact form the skill's own Etiquette imposes, substance in the recorder's words, dated, naming the artifact holding the operator's words rather than quoting them; committed under the license the Approach states, scoped to the decision record, per the owning repo's commit norm; then a pointer message to the worker. The reason stated in place is that a peer relay of operator words carries no operator standing and the artifact does. The escalation rides the ledger in the pointer form the skill already owns. The never-tasks-directly rule is untouched: recording a decision in an artifact and pointing at it is the seat's existing verb set.
Acceptance: same bars as section 1.
Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`.

### 3. The architecture sentence
Model: opus
Locus: inline

`docs/architecture.md`'s roles paragraph gains one sentence naming the ladder: expert-ask before BLOCKED, coordinator brief in parallel with the operator ping, artifact-borne return path. Current-state voice, no change-narrative.
Acceptance: one sentence in place; suite matches baseline.
Files in scope: `docs/architecture.md`.

## Out of Scope

- Any hook or CLI code: the verified BLOCKED mechanics are already what the design needs, so this plan is prose-only.
- A mechanical timeout for the bounded wait: the etiquette states one boundary-scale window and leaves the number to the worker's judgment, since enforcing it would take code this plan deliberately does not touch.
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

