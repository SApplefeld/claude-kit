---
name: kit-goal
description: "Arm or clear a tree-scoped completion leash for a plan run or an ordered sequence of them. Use when I type /kit-goal <plan path>... to hold an autonomous run to completion across a session swap, /kit-goal clear to release it, or /kit-goal to see what is armed. The kit-native, deterministic alternative to native /goal for plan-based runs."
---

# Kit Goal

`/kit-goal docs/plans/<plan>.md` arms a plan run: it writes the goal state to `.kit/goal-state.json` in the working tree, and a kit Stop hook holds the session to completion. The state lives in the tree, so the arming outlives any session boundary and rides the run's own auto-compactions.

Several plan paths in one invocation arm an ordered queue under one binding. Each plan runs to Complete or to a recorded `BLOCKED:`, then the leash advances by itself. Only the last plan's terminal state releases the session.

Only the operator arms a leash, by typing `/kit-goal` in an interactive session. Both arm forms refuse unless the calling session's own transcript shows that typed `/kit-goal` naming each plan. A session ignores a leash in its tree that is bound to another session. A run that finds no leash never arms or re-arms one for itself, and proceeds unleashed, as a supervised persona does.

## Arm

`/kit-goal <plan path>...` takes repo-relative plan paths such as `docs/plans/foo_spec_v1.md`. Run:

```
node <plugin-root>/hooks/kit-goal.js arm <plan path>...
```

From this skill's base directory the CLI is `../../hooks/kit-goal.js`. Report its one-line result. Where it refuses, surface the reason it prints and stop rather than retrying. `--append` and `--here` are its only flags. `--here` arms the directory the shell stands in where it differs from the session's working directory. An unrecognized-flag refusal naming a flag this skill documents means the CLI in this session's plugin view predates it.

The result names the binding, ordinarily `(bound to this session)`. An unbound result's printed sentence names which of two ordinary causes it has. Any other unbound result is a defect signal for the operator. Read the sentence the arm prints rather than matching its wording.

Arm where you will run. A worktree, a bare-repo worktree included, has its own `.kit/goal-state.json`, not the main checkout's. The goal and checkpoint CLIs answer the directory they run from, so run them from the session's own tree root.

`--append` adds plans behind an armed queue under its existing binding, so the plan in flight keeps running. Run it where the operator's typed `/kit-goal` carries `--append`:

```
node <plugin-root>/hooks/kit-goal.js arm --append <plan path>...
```

It refuses when nothing is armed, so a first arming is always the bare form. Choose the bare form only when the goal state is genuinely absent, never because an append refused. Over a `.kit/goal-state.json` the CLI cannot read, a bare run would overwrite a live leash.

The bare form replaces the queue and warns on stderr naming every plan it drops, so read any such warning before the next step.

## What Arming Requests

An arming the operator typed requests parallelizing the run through subagent dispatch and Workflows, wherever the sections and their gates allow. For this run it is the request an injected `Do not use workflows or deep-research unless the user requested it` line waits on. Deep-research, and any other Workflow use, still needs asking.

Arming is also approval. The arming act approves the armed plan as written, with the authority of a typed "proceed". So an armed run never waits for a separate approval message and never reads the plan's `Status:` header as missing approval. A `Status:` value the kit does not define gates nothing, and executing-work's run-start step normalizes it.

## Dispatch Authorization

A plan doc can record its approval in a `## Dispatch Authorization` section: who approved the run, when, and which sessions the grant covers, by default "any session holding this plan". The section approves and never arms. A plan arriving by peer message runs under it once the grant stands as the peer-sessions skill states, by a trace to the operator or a chain handoff. The peer-sessions skill owns the trace, the chain handoff, the message's standing and the reply states. A section supplies no live steering, so anything the plan does not cover goes to the operator.

The CLI records only the section's **first sentence**, so state the grant's essential claim there. The curating-docs skill places the section.

## Clear

`/kit-goal clear` (accept the aliases `stop`, `off`, `reset`, `none`, `cancel`) releases the leash:

```
node <plugin-root>/hooks/kit-goal.js clear
```

## Status

`/kit-goal` with no argument, or `/kit-goal status`, reports what is armed and the session holding the leash:

```
node <plugin-root>/hooks/kit-goal.js status
```

The status-line widget `scripts/kit-goal-statusline.js` prints one line for the project the status line shows:

```
🎯 <plan> · Sections: <done>/<total> (Next §N) · Plans: <i>/<n>
```

An armed goal draws that line, and a project with nothing armed draws `🎯 unarmed`. So read a blank widget beside a plan run as a fault or a stale payload, never as an unleashed run. The doctor installs the widget's launcher at `~/.claude/bin/kit-statusline.js`. Wire it with the literal path, `node "<absolute path to ~/.claude>/bin/kit-statusline.js"`, since the tool's shell decides whether `$HOME` expands.

## How the Leash Holds

The `kit-goal-stop.js` Stop hook acts only where a goal is armed in the current project and the stopping session holds the leash. The operator arms from the session that should hold the leash, since the typed `/kit-goal` binds it. Re-arming resets the binding, which recovers a run whose bound session died: the operator types `/kit-goal <plan paths>` in the new session, and until then the run proceeds unleashed. Mid-sequence the re-arm names the remaining plans, since it replaces the queue rather than resuming it.

The hook lets the leash holder stop only on one of these.

- (a) the plan's `Status` is `Complete`, or the plan file has moved to the archive, and on the last plan the goal also auto-clears; or
- (b) the last assistant message opens with `BLOCKED:` as its very first characters. The match is the literal leading prefix: a `BLOCKED:` line mid-message, or one wrapped in bold or a heading, does not release; or
- (c) the last assistant message opens with `WAITING:` as its very first characters, naming one of the two occasions executing-work's third stop shape states: an awaited background dispatch, or a park at a safe boundary taken on a request. The same literal-leading-prefix rule applies. The goal stays armed. A `WAITING:` that is neither a park nor an awaited dispatch stalls the run rather than releasing it, and re-arming is the recovery. The coordinator skill states what wakes a parked coordinator seat.

## Events

`goal-complete` and `goal-blocked` are the two event values. A `goal-blocked` count is turn-ends under a standing blocker, so dedup on the blocker's own identity to count blockers.
