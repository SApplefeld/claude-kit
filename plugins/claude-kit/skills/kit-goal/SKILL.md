---
name: kit-goal
description: "Arm or clear a tree-scoped completion leash for a plan run or an ordered sequence of them. Use when I type /kit-goal <plan path>... to hold an autonomous run to completion across a session swap, /kit-goal clear to release it, or /kit-goal to see what is armed. The kit-native, deterministic alternative to native /goal for plan-based runs."
---

# Kit Goal

`/kit-goal docs/plans/<plan>.md` arms a plan run: it writes the goal state to `.kit/goal-state.json` in the working tree, and a kit Stop hook holds the session to completion. The state lives in the tree, so the arming outlives any session boundary and rides the run's own auto-compactions.

Several plan paths in one invocation arm an ordered queue under one binding. Each plan runs to Complete or to a recorded `BLOCKED:`, then the leash advances by itself. Only the last plan's terminal state releases the session.

Only the operator arms a leash, by typing `/kit-goal` in an interactive session. Both arm forms refuse unless the calling session's own transcript shows that typed `/kit-goal` naming each plan. A session ignores a leash in its tree that is bound to another session. A run that finds no leash never arms or re-arms one for itself, and proceeds unleashed, as a supervised persona does.

Native `/goal` is for goals that are not plan-based, and it never sequences plans.

## Arm

`/kit-goal <plan path>...` takes repo-relative plan paths such as `docs/plans/foo_spec_v1.md`. Run the CLI, which validates every plan:

```
node <plugin-root>/hooks/kit-goal.js arm <plan path>...
```

From this skill's base directory the CLI is `../../hooks/kit-goal.js`. Report its one-line result. Where it refuses, surface the reason it prints and stop rather than retrying. `--append` and `--here` are its only flags, and any other leading-dash token is refused as unrecognized. `--here` permits arming the directory the shell stands in where that differs from the session's working directory. An unrecognized-flag refusal naming a flag this skill documents means the CLI in this session's plugin view predates it.

The result names the binding, ordinarily `(bound to this session)`. An unbound result has two ordinary causes, and the sentence the CLI prints names which. An append reports the binding the queue already carries, so a queue armed before the gate existed can read unbound. `armingSessionClaims` in `hooks/kit-goal-lib.js` owns the route that claims it. An arm also lands unbound where its path screen refuses the transcript path, and the Stop hook or the compaction gate then binds the goal at the next stop or compaction offer. Any other unbound result is a defect signal, and it goes to the operator as one. Read the sentence the arm prints rather than matching its wording.

`--append` adds plans behind an armed queue under its existing binding, so the plan in flight keeps running. Run it where the operator's typed `/kit-goal` carries `--append`:

```
node <plugin-root>/hooks/kit-goal.js arm --append <plan path>...
```

It refuses when nothing is armed, so a first arming is always the bare form. Choose the bare form only when the goal state is genuinely absent, never because an append refused. The append also refuses, naming no command, where `.kit/goal-state.json` holds something the CLI cannot read as a goal state, since a bare run there would overwrite a live leash.

The bare form replaces the queue and warns on stderr naming every plan it drops. Read any such warning before the next step, since it means work left the queue.

## What Arming Requests

An arming the operator typed requests parallelizing the run: cut wall-clock time by running at once whatever the sections and their gates allow, via subagent dispatch and Workflows. For this run it is the request an injected `Do not use workflows or deep-research unless the user requested it` line waits on, read as the operating-instructions dispatch bullet reads the Agent-tool line. The authority is the arming act, not this skill's text, so nothing here widens the doctrine's standing grant. Deep-research, and any Workflow use beyond parallelizing this run, still needs asking.

Arming is also approval. The arming act approves the armed plan as written, with the authority of a typed "proceed". So an armed run never waits for a separate approval message and never reads the plan's `Status:` header as evidence approval is missing. A `Status:` value the kit does not define does not gate arming, and executing-work's run-start step normalizes it.

## Dispatch Authorization

A plan doc can record its approval in a `## Dispatch Authorization` section: who approved the run, when, and which sessions the grant covers, by default "any session holding this plan". The section approves and never arms. A plan arriving by peer message runs under the committed section with no confirmation round-trip, once the receiver has traced the grant to the operator. A chain handoff carries the same approval: a handoff from a seat above the receiver in the role skill's chain that names the plan's anchor commit, with the trace kept as the record step. The peer-sessions skill owns the chain handoff, the trace, the message's standing and the reply states, and executing-work owns how a run takes an inbound plan on. Outside a chain handoff the trace is required, because anyone can write a section, so running a plan on its presence alone lets the plan's writer hand the receiver work. A section supplies no live steering, so anything the plan does not cover goes to the operator.

The CLI records only the section's **first sentence**, so state the grant's essential claim there. Keep the section above `## Sections of Work`, where the placement rule puts it.

Arm where you will run. A worktree, a bare-repo worktree included, is its own place with its own `.kit/goal-state.json`, not a spelling of the main checkout. The goal and checkpoint CLIs answer the directory they are run from, so run them from the session's own tree root.

## Clear

`/kit-goal clear` (accept the aliases `stop`, `off`, `reset`, `none`, `cancel`) releases the leash:

```
node <plugin-root>/hooks/kit-goal.js clear
```

## Status

`/kit-goal` with no argument, or `/kit-goal status`, reports the current plan and its queue position, the plans remaining, each queued plan's arming and recorded authorization, each finished plan's outcome, and the session holding the leash or that it is unbound:

```
node <plugin-root>/hooks/kit-goal.js status
```

The status-line widget `scripts/kit-goal-statusline.js` prints one line for the project the status line shows:

```
🎯 <plan> · Sections: <done>/<total> (Next §N) · Plans: <i>/<n>
```

The doctor installs its launcher at `~/.claude/bin/kit-statusline.js`. Wire a status-line tool that runs shell commands with `node "<absolute path to ~/.claude>/bin/kit-statusline.js"`. Use the literal path, since the tool's own shell decides whether a variable such as `$HOME` expands.

An armed goal draws that line, and a project with nothing armed draws `🎯 unarmed`. Blank means the widget said nothing: either the installed payload predates the widget, so the launcher prints nothing at exit 0, or something faulted, such as an unreadable goal-state file. Updating the plugin brings the widget in, since the doctor's `-Fix` copies only the launcher. So read a blank widget beside a plan run as a fault or a stale payload, never as an unleashed run. On a box where every refresh overruns the launcher's time budget, the launcher keeps drawing its last cached line. A goal cleared under that load shows its armed line until one refresh renders in time.

## How the Leash Holds

The `kit-goal-stop.js` Stop hook is a no-op unless a goal is armed in the current project and the stopping session holds the leash. One binding rides the whole queue and survives auto-compaction. The operator arms from the session that should hold the leash, since the typed `/kit-goal` is what binds it. Re-arming resets the binding, which is the recovery when a bound session died: the operator types `/kit-goal <plan paths>` in the new session, and until then that run proceeds unleashed. Mid-sequence it names the remaining plans, since a re-arm replaces the queue rather than resuming it.

The hook lets the leash holder stop only on one of these.

- (a) the plan's `Status` is `Complete`, or the plan file has moved to the archive, and on the last plan the goal also auto-clears; or
- (b) the last assistant message opens with `BLOCKED:` as its very first characters. The match is the literal leading prefix: a `BLOCKED:` line mid-message, or one wrapped in bold or a heading, does not release; or
- (c) the last assistant message opens with `WAITING:` as its very first characters, naming one of the two occasions executing-work's third stop shape states. The same literal-leading-prefix rule applies. The goal stays armed. An awaited dispatch's completion re-invokes the session, and the first stop after the wake re-enters enforcement. A parked session has nothing to re-invoke it, save a parked coordinator seat, whose armed reconciliation wake re-invokes it into the conduct the coordinator skill states. A `WAITING:` that is neither a park nor an awaited dispatch stalls the run rather than releasing it. The armed goal stays visible at session start and to the doctor, and re-arming is the recovery.

`composeCondition` in `hooks/kit-goal-lib.js` owns the canonical condition text, which this skill does not restate.

## Events

`goal-complete` and `goal-blocked` are the two event values, and `eventsSink` in `hooks/kit-goal-lib.js` owns the sink they append to and its override.

Read a `goal-blocked` count as turn-ends under a standing blocker, not as distinct blockers. The emitter holds no state across stops, so each stop on one blocker adds a line, a probe-woken one included. The count is neither a blocker count nor a complete record of every blocked stop. To count blockers, dedup on the blocker's own identity, the recorded note where one survives or else the plan and session it names, never on the line count.
