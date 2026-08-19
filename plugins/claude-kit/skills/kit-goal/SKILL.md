---
name: kit-goal
description: "Arm or clear a project-scoped completion leash for a plan run or an ordered sequence of them. Use when I type /kit-goal <plan path>... to hold an autonomous run to completion across a session swap, /kit-goal clear to release it, or /kit-goal to see what is armed. The kit-native, deterministic alternative to native /goal for plan-based runs."
---

# Kit Goal

`/kit-goal docs/plans/<plan>.md` arms a plan run in one line: it writes a project-scoped goal state file, and a deterministic kit Stop hook holds the session to completion. The leash lives in the project (`.kit/goal-state.json`), so the arming outlives any session boundary, and native compaction preserves the session id, so an armed run rides its own auto-compactions with the leash intact.

Several plan paths in one invocation arm an ordered queue, and the leash carries the whole sequence: each plan runs to Complete or to a recorded `BLOCKED:`, then the leash advances to the next by itself, under one binding, with no retyped arming between plans. Only the last plan's terminal state releases the session.

This is the one-line arming the executing-work loop expects for a plan run. Native `/goal` remains for goals that are not plan-based, and it is not the way to sequence plans: a queue is what `/kit-goal` itself takes.

## Arm

`/kit-goal <plan path>...`, where each argument is a repo-relative plan path like `docs/plans/foo_spec_v1.md`. Run the CLI, which validates every plan and writes the state atomically:

```
node <plugin-root>/hooks/kit-goal.js arm <plan path>...
```

The CLI lives at `hooks/kit-goal.js` under the plugin root; from this skill's base directory (`<plugin>/skills/kit-goal/`) that is `../../hooks/kit-goal.js`. Report the one-line result. The command refuses, with the reason, a plan that does not exist or is already `Status: Complete`, and refuses a duplicate path; surface that reason and stop rather than retrying.

Arming a queue is all-or-nothing: every path is validated before anything is written, and one bad path refuses the whole arm naming the offender. A partial queue would be the silent-failure shape, a run that looks armed for four plans and is armed for two.

One naming constraint is worth knowing before it costs something, because it binds a surface other than this one. Arming accepts any plan path that is repo-relative and free of control characters, but the stop-failure watcher, which re-arms an unattended run that died, composes its resume prompt as a single command line and accepts only `[A-Za-z0-9_./-]` in a path. A plan named with a space, parentheses, or any other character outside that set arms normally and works normally, and an unattended run that dies on it resumes with the queue truncated at that plan, with the reason recorded in `.kit/stop-failure-events.jsonl`. The kit's own `<project>_<content-type>_v1.md` convention stays inside the set; a plan named outside it is only a risk for runs left unattended.

## What arming requests

Arming is the user's own act (the `/kit-goal` invocation is user-typed), and it carries the user's request for the run: reduce wall-clock time by parallelizing the plan's work, running simultaneously whatever the sections and their gates allow, via subagent dispatch and via Workflows. For this run's parallelization, that is the per-run request an injected `Do not use workflows or deep-research unless the user requested it` line waits on, read the same way the operating-instructions dispatch bullet reads the Agent-tool line: the instruction prohibits unrequested use, and the arming is the request. The authority is the arming act, not this skill's text, so nothing here widens the doctrine's standing grant. The scope is executing the armed plan: deep-research, and any Workflow use beyond parallelizing this run's work, still needs asking. The canonical condition text carries the same request, so it rides with the goal state across a session swap, and the Stop hook's enforcement block restates it at the point of action.

## Clear

`/kit-goal clear` (accept the aliases `stop`, `off`, `reset`, `none`, `cancel`) releases the leash:

```
node <plugin-root>/hooks/kit-goal.js clear
```

## Status

`/kit-goal` with no argument, or `/kit-goal status`, reports what is armed: the current plan and its position in the queue, the plans remaining, the outcome recorded for each plan already finished, and which session currently holds the leash (or that it is unbound):

```
node <plugin-root>/hooks/kit-goal.js status
```

## How the leash holds

The `kit-goal-stop.js` Stop hook (wired in the plugin's `hooks.json`) fires on every stop but is a strict no-op unless a goal is armed in the current project and the stopping session holds the leash. The leash binds to one session at a time: it arms unbound, and the session that armed it claims it at its first stop or its first auto-compaction offer, whichever comes first, the `/kit-goal` invocation's command arguments being the claim signal at both. There are two claim points because a run that obeys the completion contract never stops with work left, so a stop-only claim would leave a well-behaved run unbound for its whole length, and the PreCompact gate that schedules compaction to the boundaries a plan run declares (executing-work owns which) engages only for the session the leash is bound to. Nothing else claims: plain prose mentions, the assistant's own text, injected context, tool output, and the CLI's echoed stdout never do, so arm from the session that should hold the leash. One binding rides the whole queue: the claim happens once, at whichever of those two points the arming session reaches first, and the leash stays with that session as it advances from plan to plan. Once bound, no other session is leashed however often it mentions the plan, so a session spawned to discuss an armed plan is never yanked into working it, and two sessions can never both hold the same leash. A bystander session is told as much at session start: the notice names the leash as another session's, says the plan is not that session's business, and gives the re-arm path for the case where the bound run has died. Native compaction preserves the session id, so the bound session keeps its own leash across auto-compactions. Re-arming with `/kit-goal <plan paths>` resets the binding; that is the recovery move when a bound session died and its work resumes in a new one, and mid-sequence it means arming the remaining plans, since a re-arm replaces the queue rather than resuming it. The stop-failure watcher is the mechanical caller of that same path: when a leashed unattended run dies on a retryable API failure, which reaches the StopFailure event and so never touches this Stop hook, the watcher resumes the session with exactly that arming line as its whole prompt, so the recovery is the one documented here rather than a second mechanism. Nothing trails the plan path there, deliberately: the resumed session already carries its prior conversation and the session-start notice, and trailing prose would be read as part of this command's argument span, where the path is expected to stand alone.

When the stopping session holds the leash, the hook allows the stop only when the queue has reached its last plan and one of these holds of that plan. On any earlier plan the same states are terminal for that plan alone: the hook records the outcome, advances the leash to the next plan, and blocks the stop with a reason naming the finished plan, the new current plan, and the instruction to continue it.

- (a) the plan's `Status` is `Complete`, or the plan file has moved to the archive (the run finished), in which case, on the last plan, it also auto-clears the goal; or
- (b) the last assistant message opens with `BLOCKED:` as its very first characters (a true blocker was surfaced). The match is the literal leading prefix: a `BLOCKED:` line mid-message, or one wrapped in bold or a heading, does not release. Nor does a BLOCKED line whose stated reason is capacity (context, compaction, a fresh session): capacity is never a blocker, and the hook refuses that release, citing the completion contract. A blocker mid-queue is recorded and the queue moves on, because one plan waiting on a decision is not a reason to abandon the plans behind it; or
- (c) the last assistant message opens with `WAITING:` as its very first characters, naming the dispatched background work it awaits. This allows the stop without releasing the leash: the goal stays armed, the completed background task re-invokes the session, and the first stop after the wake re-enters enforcement. The same literal-leading-prefix rule applies, and so does the capacity refusal: waiting for context, compaction, or a fresh session is not background work, and the hook refuses it. A `WAITING:` with nothing actually pending stalls the run rather than releasing it; the armed goal stays visible at session start and to the doctor, and re-arming is the recovery, same as a crashed run.

Otherwise it blocks with a reason naming the plan, so a run cannot quietly stop with sections left. The conditions re-evaluate on every stop attempt, including inside a stop-hook continuation, so the leash holds until one is genuinely met; Claude Code's own consecutive-block cap (eight blocks without progress, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) is the loop backstop that releases a genuinely stuck session with a visible warning. Any error inside the hook allows the stop: the leash never traps a session. The canonical condition text is composed and owned by `hooks/kit-goal-lib.js` (`composeCondition`); this skill does not restate the literal, so the two cannot drift.
