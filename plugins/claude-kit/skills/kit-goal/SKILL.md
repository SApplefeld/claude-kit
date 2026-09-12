---
name: kit-goal
description: "Arm or clear a tree-scoped completion leash for a plan run or an ordered sequence of them. Use when I type /kit-goal <plan path>... to hold an autonomous run to completion across a session swap, /kit-goal clear to release it, or /kit-goal to see what is armed. The kit-native, deterministic alternative to native /goal for plan-based runs."
---

# Kit Goal

`/kit-goal docs/plans/<plan>.md` arms a plan run in one line: it writes a goal state file in the working tree, and a deterministic kit Stop hook holds the session to completion. The leash lives in the working tree (`.kit/goal-state.json`), so the arming outlives any session boundary, and native compaction preserves the session id, so an armed run rides its own auto-compactions with the leash intact.

Several plan paths in one invocation arm an ordered queue, and the leash carries the whole sequence: each plan runs to Complete or to a recorded `BLOCKED:`, then the leash advances to the next by itself, under one binding, with no retyped arming between plans. Only the last plan's terminal state releases the session.

This is the one-line arming the executing-work loop expects for a plan run. Native `/goal` remains for goals that are not plan-based, and it is not the way to sequence plans: a queue is what `/kit-goal` itself takes.

## Arm

`/kit-goal <plan path>...`, where each argument is a repo-relative plan path like `docs/plans/foo_spec_v1.md`. Run the CLI, which validates every plan:

```
node <plugin-root>/hooks/kit-goal.js arm <plan path>...
```

The CLI lives at `hooks/kit-goal.js` under the plugin root; from this skill's base directory (`<plugin>/skills/kit-goal/`) that is `../../hooks/kit-goal.js`. Report the one-line result. The command refuses, with the reason, a plan that does not exist or is already `Status: Complete`, and refuses a duplicate path, a path carrying a control character, a path that resolves outside the project, and any leading-dash token other than `--append` and `--self-armed`, which it names as an unrecognized flag beside its own build identity rather than reading as a plan path; surface that reason and stop rather than retrying. An unrecognized-flag refusal naming a flag this skill documents means the CLI in this session's plugin view predates it.

The result names the binding. An arm run inside the session that should hold the leash normally reports `(bound to this session)`: the CLI reads the harness's session id from its own shell and binds only after corroborating it against a transcript on disk. An arm reporting an unbound result is not an error: the sentence it prints names the route that claims the leash, and `armingSessionClaims` in `hooks/kit-goal-lib.js` owns that claim. Read the sentence the arm prints rather than matching its wording, which is free to improve.

`--append` grows an armed queue instead of replacing it:

```
node <plugin-root>/hooks/kit-goal.js arm --append <plan path>...
```

The named plans join the queue behind whatever is already in it, under the existing binding, so the leash does not move and the plan in flight keeps running. It refuses when nothing is armed at all, since there is then no queue to append to, so a first arming is always the bare form.

`--self-armed` records that the arming invocation is the run's own rather than the operator's:

```
node <plugin-root>/hooks/kit-goal.js arm --self-armed <plan path>...
```

Use it where a session runs the CLI for itself, the arming the section below governs, and leave it off where the operator typed the invocation. A session running the CLI on a relayed operator instruction is the run's own invocation and takes the flag. The CLI infers nothing from the session id, the transcript or the arguments, which are the same either way, so the flag is the only thing that tells the two apart. It records one fact and no other: who ran this invocation, as this invocation claimed it. What authorizes any plan to be leashed is a separate fact with its own record, the `## Dispatch Authorization` sentence the CLI reads out of each plan doc.

The arming is recorded per plan rather than per queue, so `--append --self-armed` is the spelling for a plan a run arms itself onto a queue the operator typed, and an append without the flag joins a self-armed queue as an operator's arming. Entries already queued keep the arming they were armed with.

The bare form replaces the queue, which is what a re-arm is for, and it warns on stderr when the replacement drops a non-empty queue, naming every plan path it dropped. A replace that drops nothing says nothing, so a warning always means work left the queue and is worth reading before the next step.

## What arming requests

An arming the operator typed is the user's own act, and it carries the user's request for the run: reduce wall-clock time by parallelizing the plan's work, running simultaneously whatever the sections and their gates allow, via subagent dispatch and via Workflows. For this run's parallelization, that is the per-run request an injected `Do not use workflows or deep-research unless the user requested it` line waits on, read the same way the operating-instructions dispatch bullet reads the Agent-tool line: the instruction prohibits unrequested use, and the arming is the request. The authority is the arming act, not this skill's text, so nothing here widens the doctrine's standing grant. The scope is executing the armed plan: deep-research, and any Workflow use beyond parallelizing this run's work, still needs asking.

A run that armed a plan for itself (`--self-armed`) has no typed invocation to carry a request, and its condition text asserts none. What such a run holds is what the doctrine gives every session standing, its request for subagent dispatch, which is why it may parallelize the plan's work through subagents without asking. It does not gain the Workflow half from the arming, and it does not gain it here either: the doctrine's standing Workflow grant covers one narrow purpose, dispatching a read-only agent at an effort the Agent tool cannot set, and any other Workflow use still needs asking, exactly as it does for an unleashed run.

Arming is also approval. An armed plan is approved as written by the arming act itself: where the operator typed the invocation it carries the same authority as a typed "proceed", and where a run armed the plan for itself the committed `## Dispatch Authorization` grant it traced stands in that invocation's place (the section below owns the trace). Either way a run under an armed leash never waits for a separate approval message and never reads the plan's `Status:` header as evidence approval is missing. A `Status:` value the kit does not define does not gate arming; executing-work owns the run-start step that normalizes it.

## Dispatch Authorization

A plan doc can carry its arming authority in a `## Dispatch Authorization` section: who authorized the run, when, and which sessions the grant covers, with "any session holding this plan" as the default scope. The committed section is the durable grant, so a plan that arrives by peer message arms under it with no confirmation round-trip, once the receiver has traced the grant to the operator. The peer-sessions skill owns that trace, the standing of the message itself, and the reply states, and it is not optional: a section is prose a writer supplies, so a receiver that arms on its presence alone lets whoever wrote the plan widen its leash.

Write the section so the CLI can record it: it stores the section's **first sentence** only, so put the grant's essential claim in that first sentence rather than spreading it over three. Keep the section above `## Sections of Work` where the placement rule already puts it.

An arm made on a section carries its authority from the artifact rather than from the keystroke, and the two paragraphs above say what that reaches. Approval it does supply: the operator's committed authorization stands in the typed invocation's place, so an appended plan is approved as written. The parallelization license it does not supply and does not need to, since a self-armed run already holds the doctrine's standing subagent-dispatch request, with Workflow use beyond doctrine's one narrow purpose still needing to be asked for. What a section cannot supply at all is live steering: anything the plan does not cover still goes to the operator. Such an arm takes `--self-armed`, under the flag rule above.

A plan handed to a running session is armed at the earliest moment the receiving tree holds it: immediately, by `--append` from the run's own cwd, where the checkout already contains the plan's commit, or at the next safe tree advance where the worktree was cut before that commit. A worktree is pinned to the commit it was cut from, so a plan committed after the cut is unreachable to the receiving CLI however real it is at origin, and the gap is invisible from the sender's side, where the arm looks trivially possible. The handoff therefore stays unconverted on the sender's side until the receiver's armed acknowledgment, which is the conversion signal, and a receiver that has to wait replies `received-authorized-deferred` naming the gate it waits on, so the sender can tell a deferred arm from a held one and from nothing delivered. Answered and converted are two states rather than one: any of the three replies answers the handoff and ends the sender's re-sending, and only the armed acknowledgment converts it, so a handoff answered by either held state is still the sender's to carry until the arm lands.

Two things make that wait workable and both are the sender's, the anchor and the re-send, which the peer-sessions skill owns. The deferred receiver re-checks its tree against that anchor at each boundary it already takes: a section close, a pull it owes anyway, or an arm attempt, whose refusal of an unseen path is itself the drift surfacing rather than an error to route around. `--append` is the spelling only once a queue is armed; a session running unleashed takes the bare `arm` form instead, since there is no queue for an append to extend. The bare form replaces the queue rather than adding to it, so an unleashed session arming an inbound plan names every plan that is to be held, its own in-flight plan first and the inbound one after: `arm --self-armed <plan in flight> <inbound plan>`. The flag rides on both entries and is right for both, because it records who ran the invocation, which is this run for the whole of it, and says nothing about either plan's authorization. Naming the inbound plan alone leashes it and leaves the run's own in-flight work unheld, invisible to the position walk, to the status line and to a blocked event's plan attribution, with no dropped-plan warning to say so, since nothing was armed to drop. Key the bare form on the goal state being genuinely absent rather than on the append having refused: the append also refuses where something is at `.kit/goal-state.json` that the CLI cannot read as a goal state, and there it names no command at all, because a replacement run over that state would overwrite a live leash, its queue, its history and its binding.

Arm where you will run, and a worktree of the repository is its own place for this purpose rather than a spelling of the main checkout. A session working a worktree reads and writes that tree's own `.kit/goal-state.json`, a bare-repo worktree included. The goal and checkpoint CLIs answer the directory they are run from, so run them from the session's own tree root.

## Clear

`/kit-goal clear` (accept the aliases `stop`, `off`, `reset`, `none`, `cancel`) releases the leash:

```
node <plugin-root>/hooks/kit-goal.js clear
```

## Status

`/kit-goal` with no argument, or `/kit-goal status`, reports what is armed: the current plan and its position in the queue, the plans remaining, the arming and the authorization recorded for each queued plan (the sentence, or that none was recorded), the outcome recorded for each plan already finished, and which session currently holds the leash (or that it is unbound):

```
node <plugin-root>/hooks/kit-goal.js status
```

The same state feeds a status-line widget, `scripts/kit-goal-statusline.js`, which prints one line for the project the status line is showing:

```
🎯 <plan> · Sections: <done>/<total> (Next §N) · Plans: <i>/<n>
```

The doctor installs its launcher at `~/.claude/bin/kit-statusline.js`; a status-line tool that runs shell commands (ccstatusline's Custom Command widget, for one) is wired with `node "<absolute path to ~/.claude>/bin/kit-statusline.js"` (the literal path, since the tool's own shell decides whether a variable such as `%USERPROFILE%` or `$HOME` expands) and receives a line on every status-line refresh.

The widget draws three readings, and blank is only one of them. An armed goal draws the line above. A project with nothing armed draws `🎯 unarmed`, an affirmative statement that the widget ran, read the goal state and found no goal there. Blank means the widget said nothing: either the installed payload predates the widget, so the launcher prints nothing at exit 0, or something faulted, a goal-state file sitting at its path unreadable among the causes. Updating the plugin is what brings the widget in, since the doctor's `-Fix` copies only the launcher. So a blank widget beside a plan run is worth reading as a fault or a stale payload rather than as an unleashed run, and an unleashed run shows as `🎯 unarmed` on any refresh that renders. A fourth reading sits outside the three, a retired line: only a render reaches the launcher's render cache, so on a box saturated enough that every refresh overruns the launcher's time budget it keeps drawing the last line it cached, and a goal cleared under that load still shows its armed line until one refresh comes in under the budget.

## How the leash holds

The `kit-goal-stop.js` Stop hook is a no-op unless a goal is armed in the current project and the stopping session holds the leash. One binding rides the whole queue and survives auto-compaction. Arm from the session that should hold the leash. Re-arming resets the binding, which is the recovery when a bound session died and its work resumes in a new one: a typed `/kit-goal <plan paths>` is the operator's re-arm and `arm --self-armed <plan paths>` is a run re-arming for itself. Mid-sequence it names the remaining plans, since a re-arm replaces the queue rather than resuming it.

When the stopping session holds the leash, the hook reads the stop against the conditions below.

- (a) the plan's `Status` is `Complete`, or the plan file has moved to the archive (the run finished), in which case, on the last plan, it also auto-clears the goal; or
- (b) the last assistant message opens with `BLOCKED:` as its very first characters (a true blocker was surfaced). The match is the literal leading prefix: a `BLOCKED:` line mid-message, or one wrapped in bold or a heading, does not release; or
- (c) the last assistant message opens with `WAITING:` as its very first characters, naming what is pending, which is the dispatched background work it awaits or a park at a safe boundary per the park skill, taken on a request rather than on the run's own judgment of its own work, the operator-declared update window being the occasion that ordinarily produces one. This allows the stop without releasing the leash: the goal stays armed, a completed background task re-invokes the session where a dispatch is what was pending, and the first stop after the wake re-enters enforcement. The same literal-leading-prefix rule applies. A parked session has nothing that will re-invoke it, save a parked coordinator seat, which its own armed reconciliation wake re-invokes into restating that it is parked and taking no new work, and that is the park working rather than a stall; a `WAITING:` that is neither a park nor an awaited dispatch stalls the run rather than releasing it. Either way the armed goal stays visible at session start and to the doctor, and re-arming is the recovery, same as a crashed run.

The canonical condition text is composed and owned by `hooks/kit-goal-lib.js` (`composeCondition`); this skill does not restate the literal, so the two cannot drift.

## Events

`goal-complete` and `goal-blocked` are the two event values, and `eventsSink` in `hooks/kit-goal-lib.js` owns the sink they append to and its override.

Read `goal-blocked`'s count as turn-ends under a standing blocker, not as distinct blockers: the emitter holds no state across stops, so a session held on one blocker across several stops, or woken by a probe message into stopping blocked again, adds one more line each time, and none of those lines is a new blocker. A count over a span reads that inflation, a probe to the blocked session among the things that produce it, rather than the number of blockers raised. So the count is neither a blocker count nor a complete record of every blocked stop, and a consumer that wants the blocker count dedups on the blocker's own identity, the recorded note where one survives or the plan and session it names, never on how many lines the stream holds.
