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

The CLI lives at `hooks/kit-goal.js` under the plugin root; from this skill's base directory (`<plugin>/skills/kit-goal/`) that is `../../hooks/kit-goal.js`. Report the one-line result. The command refuses, with the reason, a plan that does not exist or is already `Status: Complete`, and refuses a duplicate path, a path carrying a control character, and a path that resolves outside the project; surface that reason and stop rather than retrying.

The result names the binding. An arm run inside the session that should hold the leash normally reports `(bound to this session)`: the CLI reads the harness's session id from its own shell and binds only after corroborating it against a transcript on disk. An arm reporting `(unbound; ...)` is not an error; the leash then binds at the arming session's first stop or first auto-compaction offer. The invocation's shape does not matter: a multi-line `/kit-goal` with one plan path per line, or a prose request to arm, binds the same way as the single-line form, because the binding comes from the CLI run itself rather than from how the harness parsed the message.

Arming a queue is all-or-nothing: every path is validated before anything is written, and one bad path refuses the whole arm naming the offender. A partial queue would be the silent-failure shape, a run that looks armed for four plans and is armed for two.

## What arming requests

Arming is the user's own act (the `/kit-goal` invocation is user-typed), and it carries the user's request for the run: reduce wall-clock time by parallelizing the plan's work, running simultaneously whatever the sections and their gates allow, via subagent dispatch and via Workflows. For this run's parallelization, that is the per-run request an injected `Do not use workflows or deep-research unless the user requested it` line waits on, read the same way the operating-instructions dispatch bullet reads the Agent-tool line: the instruction prohibits unrequested use, and the arming is the request. The authority is the arming act, not this skill's text, so nothing here widens the doctrine's standing grant. The scope is executing the armed plan: deep-research, and any Workflow use beyond parallelizing this run's work, still needs asking. The canonical condition text carries the same request, so it rides with the goal state across a session swap, and the Stop hook's enforcement block restates it at the point of action.

Arming is also approval. An armed plan is approved as written by the arming act itself: the invocation is user-typed, so it carries the same authority as a typed "proceed", and a run under an armed leash never waits for a separate approval message and never reads the plan's `Status:` header as evidence approval is missing. A `Status:` value the kit does not define does not gate arming; executing-work owns the run-start step that normalizes it.

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

The `kit-goal-stop.js` Stop hook (wired in the plugin's `hooks.json`) fires on every stop but is a strict no-op unless a goal is armed in the current project and the stopping session holds the leash. The leash binds to one session at a time. An arm run from inside a session binds that session at arm time: the CLI reads the harness's session id from its shell environment and binds only when a transcript for that id exists on this machine, so a stale or planted id with no local transcript arms unbound rather than binding a session that never stops. An arm the CLI could not corroborate (or one run outside any session) arms unbound, and the session that armed it claims it at its first stop or its first auto-compaction offer, whichever comes first; the claim signal at both points is the user's own arming text, in either of two shapes: the `/kit-goal` invocation's command arguments, or a typed message leading with the `/kit-goal` token whose argument block (the lines from the token to the first blank, fence, or tag line) names the plan. There are two claim points because a run that obeys the completion contract never stops with work left, so a stop-only claim would leave a well-behaved run unbound for its whole length, and the PreCompact gate that schedules compaction to the boundaries a plan run declares (executing-work owns which) engages only for the session the leash is bound to. Nothing else claims: plain prose mentions, the assistant's own text, injected context, tool output, and the CLI's echoed stdout never do, so arm from the session that should hold the leash. One binding rides the whole queue: the claim happens once, at whichever of those two points the arming session reaches first, and the leash stays with that session as it advances from plan to plan. Once bound, no other session is leashed however often it mentions the plan, so a session spawned to discuss an armed plan is never yanked into working it, and two sessions can never both hold the same leash. A bystander session is told as much at session start: the notice names the leash as another session's, says the plan is not that session's business, and gives the re-arm path for the case where the bound run has died. Native compaction preserves the session id, so the bound session keeps its own leash across auto-compactions. Re-arming with `/kit-goal <plan paths>` resets the binding; that is the recovery move when a bound session died and its work resumes in a new one, and mid-sequence it means arming the remaining plans, since a re-arm replaces the queue rather than resuming it.

When the stopping session holds the leash, the hook allows the stop only when the queue has reached its last plan and one of these holds of that plan. On any earlier plan the same states are terminal for that plan alone: the hook records the outcome, advances the leash to the next plan, and blocks the stop with a reason naming the finished plan, the new current plan, and the instruction to continue it.

- (a) the plan's `Status` is `Complete`, or the plan file has moved to the archive (the run finished), in which case, on the last plan, it also auto-clears the goal; or
- (b) the last assistant message opens with `BLOCKED:` as its very first characters (a true blocker was surfaced). The match is the literal leading prefix: a `BLOCKED:` line mid-message, or one wrapped in bold or a heading, does not release. Nor does a BLOCKED line whose stated reason is capacity (context, compaction, a fresh session): capacity is never a blocker, and the hook refuses that release, citing the completion contract. A blocker mid-queue is recorded and the queue moves on, because one plan waiting on a decision is not a reason to abandon the plans behind it; or
- (c) the last assistant message opens with `WAITING:` as its very first characters, naming the dispatched background work it awaits. This allows the stop without releasing the leash: the goal stays armed, the completed background task re-invokes the session, and the first stop after the wake re-enters enforcement. The same literal-leading-prefix rule applies, and so does the capacity refusal: waiting for context, compaction, or a fresh session is not background work, and the hook refuses it. A `WAITING:` with nothing actually pending stalls the run rather than releasing it; the armed goal stays visible at session start and to the doctor, and re-arming is the recovery, same as a crashed run.

Otherwise it blocks with a reason naming the plan, so a run cannot quietly stop with sections left. The conditions re-evaluate on every stop attempt, including inside a stop-hook continuation, so the leash holds until one is genuinely met; Claude Code's own consecutive-block cap (eight blocks without progress, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) is the loop backstop that releases a genuinely stuck session with a visible warning. Any error inside the hook allows the stop: the leash never traps a session. The canonical condition text is composed and owned by `hooks/kit-goal-lib.js` (`composeCondition`); this skill does not restate the literal, so the two cannot drift.
