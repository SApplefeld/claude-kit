---
name: standing-watch
description: "Use when a session watches a live system it does not own on a repeating loop, waking on a timer or an operator message, checking, intervening, and sleeping again. Triggers: a watch or babysitter session, a loop armed with /loop or a self-authored wake prompt, a runbook to follow each pass, a ledger to carry the board between passes, an operator asking you to keep an eye on a running system."
---

# Standing Watch

A watch is a loop whose state outlives the context that wrote it. Every pass wakes with less than the last one had, acts on what it can read, and hands the next pass whatever it wrote down. That is the whole difficulty: a note written when it was true is read as fact when it is not, and the loop's own reasoning is the thing most likely to go stale unnoticed. Everything here follows from that.

## The two artifacts

A watch runs on exactly two written surfaces, and they differ in what they hold, not in how they are formatted.

- **The runbook** is the procedure: what a pass checks, in what order, with which commands, and what each result means. It is project-specific, committed, and changes only when the procedure changes.
- **The ledger** is the state: what is true of the watched system right now and what the loop has learned about it. It is gitignored, lives under `.kit/`, and is rewritten in place rather than appended to.

Nothing the loop needs lives only in a session's context. The order at the end of every pass is fixed: finish the tick, write the ledger, then arm the wake. A pass that ends by arming before it writes loses the pass when the write does not happen. A watch arms for two different reasons, and the class is closed at two. The safety arm is the standing heartbeat, a repeating timer whose only job is to guarantee that some wake exists: a session that died mid-pass left no timer behind at all, so a restart puts the heartbeat up before it checks anything. The paced arm is a one-shot that sets when the next pass runs, and it is what the end of a completed pass decides. The tick order below opens with the first and closes with the second, and both steps read as ensure rather than add: a heartbeat already standing needs no second one, and a static board takes no one-shot at all. Anything else a tick produces (a ping, a commit, an intervention on the watched system) is an output of that tick rather than a loop artifact; those two artifacts are the loop's entire memory, and the class is closed.

## The ledger's shape

Two kinds of content, in separate sections, never interleaved:

- **Standing**: prohibitions, mechanisms confirmed in the system's source, and do-not-reopen traps. What stays true without re-measurement.
- **Situational**: the board as of the last pass, open interventions, recent pings, the length of the quiet streak. Everything a later pass must re-derive before acting on.

A line you cannot confidently place is situational, which settles the boundary for any content the two names do not obviously cover.

Every situational sentence carries two things: the time of the evidence behind it, and the command that re-derives it. A sentence with neither is a rumor with a good reputation.

**Supersede in place.** When a fact changes, rewrite the line that held it. Never stack a new baseline under an old one and leave both readable, because the next pass reads whichever it reaches first and has no way to tell which was current.

A **read protocol** sits at the top of the ledger, stating what a constrained pass reads and in what order, so a pass that cannot read the whole file still reads the parts that stop it doing damage.

**Prune on a quiet tick**, never on a busy one. Move superseded history to a dated archive byte-identical to what it replaced, and verify the hash at the destination rather than at the source. Keep the do-not-reopen traps live in the ledger however old they are: their whole value is that they outlast the reasoning that produced them. Re-derive any section offsets or line pointers after the last edit of the pass, not before, because an offset computed mid-edit points at the wrong section for every pass that follows.

## The tick order

The order is fixed. What a tick does inside the act step is the runbook's business and varies per system; the sequence around it does not vary.

1. **Ensure the heartbeat is armed first**, before any check, on any restart. This is the safety arm rather than the paced one step 4 sets, and its cadence is the runbook's to state: session-only timers die with the session, so a loop that checks first and arms later is one crash away from silence nobody notices. A heartbeat already running satisfies this step; the move is to look, not to add a second.
2. **Re-derive the board** from the watched system's own source of truth. Never from the ledger, the handoff, or any situation text the wake prompt carries (a self-authored prompt carries none, by the rule under Wake mechanics; an operator-authored one may): each of those is a hint with a timestamp, written by a pass that could not see this one.
3. **Re-measure before obeying.** For every standing DO or DO-NOT that cites a condition, measure the condition now, and re-read the governing document behind it. A plan doc outranks the ledger for that plan's gate: the ledger line was true when it was written and the plan changed under it.
4. **Act**, then **write the ledger**, then **ensure the next wake is armed**, then **sleep.** On a static board the heartbeat is that wake and nothing more is armed.

## Wake mechanics

A self-authored wake prompt carries the standing prohibitions and a pointer to the ledger, and nothing else. It never carries a situation report. Prohibitions age well; a situation does not, and a stale armed instruction is worse than no instruction at all, because it will be followed by a pass with nothing to contradict it.

Check the timer list against the clock before assuming pacing is covered. A one-shot whose time elapsed during a long pass is stale rather than pending, and it fires the instant the pass ends, which reads as a wake the loop did not schedule. Timers fire only while the session is idle, so a long attended turn defers the heartbeat; that is expected behavior, not a broken timer.

Pacing follows the board: a static board gets the heartbeat only, an active one gets a one-shot 15 to 60 minutes out. A board is active when something on it is expected to change before the heartbeat comes round again, and a board you cannot confidently place is active, because the cost of the two errors is not symmetric: an unnecessary one-shot spends a pass, and a missing one spends the window the loop existed to watch.

## The ping template

A ping is what the loop sends the operator. Its parts, in order:

1. **Corrections to earlier claims, first.** Labeled as a correction, and sent at all only when the correction changes the shape of the operator's decision.
2. **The ask or the report**, in the client-briefing register, which the doctrine owns.
3. **The evidence line.** Every figure or state in the message names its source (the row, the column, the scan cycle it came from) and names its subject. A true number reported against the wrong subject is a wrong number.

Carry a **dedup key per condition**: one ping per condition, and never a re-send of an ask already pending. A loop that re-asks reads as escalation and gets the operator's attention for a question they already answered.

Two rules that govern a ping are owned outside this skill and are not restated here: when to escalate at all (the doctrine's "Pause only for a true blocker" bullet, under How we work, which owns the blocker set a ping may interrupt on), and what a measurement reads when the source that would answer is down (the doctrine's "cannot measure" line, under Verify before you claim).

## The one-way-door preflight

Before any closure, dismissal, delete, or resume on the watched system, name in one sentence what will act on the thing afterward. If the answer is "the mechanism this closure removes", do not close it. Those four are instances of the class: any action that removes the thing that would have brought the item back.

Killing a dispatched agent is that same door. The doctrine carries the habit (probe it with a message before any stall-signal kill, under Environment and tooling discipline), and `finishing-work`'s unavailability rule owns everything the habit needs to fire: the wedge hallmark that authorizes a quiet-kill, the cadence that earns a probe, the windows for the classes it lists, and the rule for deriving one for a class it does not. That rule fires on a re-block, and a watch re-blocks on nothing, so the check is written into the tick order rather than triggered: every pass with a dispatch in flight evaluates the hallmark, and reads those paragraphs first, at `skills/finishing-work/SKILL.md` under the plugin root (`CLAUDE_PLUGIN_ROOT` where the harness supplies it, else this skill's own base directory's grandparent), from the bold lead **Unavailability is the gate failing to run at full strength**. Derive a window from that rule; never invent one this skill does not own. The watch-specific part is that a loop staring at a quiet directory will manufacture the stall signal for itself, because quiet is most of what a watch ever looks at.

## What done looks like

A watch ends when the quiet streak runs long enough that the operator retires the loop. What it hands over then is a distilled list of what the interventions taught, split two ways: what the watched system should do for itself, and what the kit should stop the agent doing. The ledger is the raw material for that list, so write every pass in a form that survives distillation: the condition, what was done about it, and what it turned out to mean.
