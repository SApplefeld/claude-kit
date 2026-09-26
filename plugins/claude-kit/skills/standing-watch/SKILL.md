---
name: standing-watch
description: "Use when a session watches a live system it does not own on a repeating loop, waking on a timer or an operator message, checking, intervening, and sleeping again. Triggers: a watch or babysitter session, a loop armed with /loop or a self-authored wake prompt, a runbook to follow each pass, a ledger to carry the board between passes, an operator asking you to keep an eye on a running system."
---

# Standing Watch

A watch is a loop whose state outlives the context that wrote it. Each pass wakes knowing less than the last, acts on what it can read, and hands on what it wrote down. A note written when it was true is read as fact when it is not. The loop's own reasoning is what goes stale most quietly, and everything here follows from that.

## Two Artifacts

A watch runs on exactly two written surfaces, which differ in what they hold rather than in format.

- **The runbook** is the procedure: what a pass checks, in what order, with which commands, and what each result means. It is project-specific, committed, and changes only when the procedure changes.
- **The ledger** is the state: what is true of the watched system now and what the loop has learned about it. It is gitignored, lives under `.kit/`, and is rewritten in place rather than appended to.

Nothing the loop needs lives only in a session's context. Anything else a tick produces, such as a ping, a commit or an intervention on the watched system, is an output of that tick rather than a loop artifact. The class is closed at those two.

The order a pass ends on is fixed by the tick order below, at step 4. A pass that arms before it writes loses the pass when the write does not happen. A watch arms for two reasons only. The safety arm is the standing heartbeat, a repeating timer whose only job is to guarantee that some wake exists. The paced arm is a one-shot that sets when the next pass runs. The tick order opens with the first and closes with the second, and states when each is armed. Both steps read as ensure rather than add.

## Ledger Shape

Two kinds of content, in separate sections, never interleaved:

- **Standing**: prohibitions, mechanisms confirmed in the system's source, and do-not-reopen traps. What stays true without re-measurement.
- **Situational**: the board as of the last pass, open interventions, recent pings, the length of the quiet streak. Everything a later pass must re-derive before acting on.

A line belongs on the ledger only if a successor with no context needs it to resume the watch. Being true, hard-won, or dressed with an evidence time and a re-derive command does not qualify it. A withdrawn reading, a correction, and the story of a broken instrument can carry all of that and serve no resumption. Two tells mark a failing line: it argues rather than states, or its subject is the keeper's own reasoning rather than the watched system. What such a line carries, where durable, goes where the destination rule at the end of this file sends it, and otherwise it is dropped.

**Doubt falls to the cheap side, at both forks.** The first fork is whether a line belongs, and the second is which kind it is. At the first, a line the keeper cannot confidently say a successor needs stays off. That default is the admission test's tie-break for doubt, and it answers only where the keeper cannot call the test. Kept off wrongly, a line the watched system reproduces costs a re-derivation under the tick order. A durable line with a home under the destination rule costs one read of that home. Any other line is lost, and that loss is accepted. What the default exists to keep off, a keeper's reasoning and an episode's narrative, is recorded nowhere else, so sparing the irreplaceable would spare all of it. Kept on wrongly, a line survives every rewrite this file performs, since none asks again whether a line belongs. Supersede, under its own rule below, fires only on a changed fact. The prune, under its own rule below, moves only what supersede has retired. The per-pass write rewrites current a line the re-derivation refreshes. A line it neither confirms nor contradicts is left standing as found. What the default keeps off leaves by the same route as a line that fails the test.

**The admission default is residual.** It decides only what no rule has already placed. A rule places a class by naming it as ledger content, which settles that a successor needs the class. This file places the two kinds' members, the read protocol, and the pass record the destination rule names. A consuming skill's rules place what they name the same way. Placement exempts nothing from the admission test. The test still refuses a line that is not the member it presents as, the way a withdrawn reading can pose as one. It also refuses a member whose particular line no successor needs. That refusal is asked of the line, so the keeper can doubt it. Such doubt is the default's, and the line stays off and leaves by the admission test's route. The default lives only in that doubt branch, in three shapes. One is a line outside every named class whose need the keeper cannot call. One is a line the keeper cannot recognise as a member. One is a recognised member whose particular line the keeper cannot say a successor needs. The third shape does not reach two of the standing kind's members, because a rule of this file already answers their need. A prohibition is needed exactly while it binds. Where it cites a condition, the re-measure step measures it every pass. A false reading means the line does not bind this pass, never that it is retired. Where it cites none, it binds until the operator's word retires it. A do-not-reopen trap is needed however old it is, by the prune rule. So a recognised prohibition or trap takes the standing list and leaves only when its source retires it, the one changed fact supersede fires on for these two. The third shape does reach a mechanism confirmed in the system's source, whose loss is priced above as a re-derivation. What earns those two members their exemption is the property rather than their names: no probe of the watched system reproduces them, and their loss licenses the act they exist to close off. A consuming skill naming a member with that property states that the member takes this exemption. Having no other record neither admits a line nor rescues one. A one-record line no rule places stays off under the default's doubt. So a skill built on this chassis names by rule every class its ledger is the one record of, since an unnamed one is exactly what the default loses. What the test refuses in a withdrawal, a correction or a broken instrument's story is the narrative, and what each leaves behind has its own rule. The reading a withdrawal replaced is rewritten in place under supersede, whether the watched thing moved or the instrument was wrong. A correction that earned a ping is a recent ping on the situational list. The trap a broken instrument taught goes on the standing list, and the reasoning behind it goes to the memory store.

**The kind fork is decided on the cost of the misfiling, never on the kinds' names.** Doubt about which kind an admitted line is falls to the kind whose misfiling is cheaper. Standing is acted on without re-measuring, and the re-measure step reaches only a condition a standing line cites. Situational is re-derived before acting, by probing the watched system, never by reading another record, whatever the line's provenance. That definition governs doubt only, not a member the two-kinds rule places by name, such as a recent ping. A line filed standing wrongly is acted on stale, the failure this file exists to prevent. A line filed situational wrongly costs one extra probe per pass. So doubt falls to situational, with one carve-out asked first. Doubt about whether a line is a prohibition or a do-not-reopen trap falls to standing, since no probe reproduces either and filing it situational saves no measurement. The error on that branch is the cheaper one. A DO-NOT filed standing wrongly forgoes an act a later pass or the operator's word can still take. A trap filed situational commands the re-opening it forbids, since re-deriving it is that re-opening. A prohibition filed situational can never be re-derived. It drops out of the wake prompt under Wake mechanics and stops binding before any pass reads the ledger. The carve-out reaches only the doubt, and never a mechanism confirmed in source, whose confirmation is itself a probe. A skill that replaces these two kinds states its own fork beside its override, on the same cost.

Every situational sentence carries two things: the time of the evidence behind it, and the command that re-derives it. A sentence with neither is a claim no later pass can check.

**Supersede in place.** When a fact changes, rewrite the line that held it. Never stack a new baseline under an old one and leave both readable.

A **read protocol** sits at the top of the ledger, stating what a constrained pass reads and in what order. A pass that cannot read the whole file still reads the parts that stop it doing damage.

**Prune on a quiet tick**, never on a busy one. Move superseded history to a dated archive byte-identical to what it replaced, and verify the hash at the destination rather than at the source. Keep the do-not-reopen traps live in the ledger however old they are: their whole value is that they outlast the reasoning that produced them. Re-derive any section offsets or line pointers after the last edit of the pass, not before.

## Tick Order

The order is fixed. What a tick does inside the act step is the runbook's business, and the sequence around it does not vary.

1. **Ensure the heartbeat is armed first**, before any check, on any restart. This is the safety arm, and its cadence is the runbook's to state. Session-only timers die with the session, so a loop that checks first and arms later is one crash away from silence nobody notices. A heartbeat already running satisfies this step; the move is to look, not to add a second.
2. **Re-derive the board** from the watched system's own source of truth. Never from the ledger, the handoff, or any situation text a wake prompt carries. Each of those is a hint with a timestamp, written by a pass that could not see this one.
3. **Re-measure before obeying.** For every standing DO or DO-NOT that cites a condition, measure the condition now, and re-read the governing document behind it. A plan doc outranks the ledger for that plan's gate: the ledger line was true when it was written and the plan changed under it.
4. **Act**, then **write the ledger**, then **ensure the next wake is armed**, then **sleep.** On a static board the heartbeat is that wake and nothing more is armed.

## Wake mechanics

A self-authored wake prompt carries the standing prohibitions and a pointer to the ledger, and nothing else. It never carries a situation report. Prohibitions age well and a situation does not. A stale armed instruction is worse than none, because a pass with nothing to contradict it follows it.

Check the timer list against the clock before assuming pacing is covered. A one-shot whose time elapsed during a long pass is stale rather than pending. It fires the instant the pass ends, which reads as a wake the loop did not schedule. Timers fire only while the session is idle, so a long attended turn defers the heartbeat. That is expected behavior, not a broken timer.

Pacing follows the board: a static board gets the heartbeat only, an active one gets a one-shot 15 to 60 minutes out. A board is active when something on it is expected to change before the heartbeat comes round again. A board you cannot confidently place is active, because an unnecessary one-shot spends a pass and a missing one spends the window the loop existed to watch.

## Ping Template

A ping is what the loop sends the operator. Its parts, in order:

1. **Corrections to earlier claims, first.** Labeled as a correction, and sent at all only when the correction changes the shape of the operator's decision.
2. **The ask or the report**, in the client-briefing register, which the doctrine owns.
3. **The evidence line.** Every figure or state in the message names its source (the row, the column, the scan cycle it came from) and names its subject. A true number reported against the wrong subject is a wrong number.

Carry a **dedup key per condition**: one ping per condition, and never a re-send of an ask already pending. A loop that re-asks reads as escalation and spends the operator's attention on a question they already answered.

When to escalate at all is the doctrine's "Pause only for a true blocker" bullet, under How we work, which points at the executing-work skill for the closed blocker set. What a measurement reads when its source is down is the doctrine's "cannot measure" line, under Verify before you claim.

## One-Way-Door Preflight

Before any closure, dismissal, delete, or resume on the watched system, name in one sentence what will act on the thing afterward. If the answer is "the mechanism this closure removes", do not close it. Those four are instances of the class: any action that removes the thing that would have brought the item back.

Killing a dispatched agent is that same door. The doctrine carries the habit of probing it with a message before any stall-signal kill, under Environment and tooling discipline. `finishing-work`'s unavailability rule owns the wedge hallmark, the probe cadence and the windows, and a watch's tick is none of the wakes it fires at. So every pass with a dispatch in flight evaluates the hallmark. That pass first reads `skills/finishing-work/SKILL.md` under the plugin root (`CLAUDE_PLUGIN_ROOT` where the harness supplies it, else this skill's own base directory's grandparent), from the bold lead **Unavailability is the gate failing to run at full strength**. Derive any window from that rule and never invent one. A loop staring at a quiet directory will manufacture the stall signal for itself, because quiet is most of what a watch ever looks at.

## Ending a Watch

A watch ends when the quiet streak runs long enough that the operator retires the loop. It then hands over a distilled list of what the interventions taught, split two ways: what the watched system should do for itself, and what the kit should stop the agent doing. So write every pass in a form that survives distillation: the condition, what was done about it, and what it turned out to mean. That last is the fact of the watched system the pass established, never the keeper's reasoning, which the admission test's second tell refuses.

The destination rule names three homes, reachable during the run. A decision about a plan goes to that plan's Chapters. A durable lesson about the watch's own instruments goes to the memory store in the pass that produced it. The ledger keeps the pass record above and the current state, and nothing is written to the ledger twice. The current state is the ledger's own definition under Two Artifacts, which the two-kinds rule already divides into the members it places. On a watch with no scheduled end, a standing seat, that write-time routing is the whole mechanism: distil-at-retirement never fires on a seat that does not retire.
