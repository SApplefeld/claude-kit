---
name: kit-goal
description: "Arm or clear a project-scoped completion leash for a plan run. Use when I type /kit-goal <plan path> to hold an autonomous run to completion across a session swap, /kit-goal clear to release it, or /kit-goal to see what is armed. The kit-native, deterministic alternative to native /goal for plan-based runs."
---

# Kit Goal

`/kit-goal docs/plans/<plan>.md` arms a plan run in one line: it writes a project-scoped goal state file, and a deterministic kit Stop hook holds the session to completion. The leash lives in the project (`.kit/goal-state.json`), so the arming outlives any session boundary, and native compaction preserves the session id, so an armed run rides its own auto-compactions with the leash intact.

This is the one-line arming the executing-work loop expects for a plan run. Native `/goal` remains for goals that are not plan-based.

## Arm

`/kit-goal <plan path>`, where the argument is a repo-relative plan path like `docs/plans/foo_spec_v1.md`. Run the CLI, which validates the plan and writes the state atomically:

```
node <plugin-root>/hooks/kit-goal.js arm <plan path>
```

The CLI lives at `hooks/kit-goal.js` under the plugin root; from this skill's base directory (`<plugin>/skills/kit-goal/`) that is `../../hooks/kit-goal.js`. Report the one-line result. The command refuses, with the reason, a plan that does not exist or is already `Status: Complete`; surface that reason and stop rather than retrying.

## What arming requests

Arming is the user's own act (the `/kit-goal` invocation is user-typed), and it carries the user's request for the run: reduce wall-clock time by parallelizing the plan's work, running simultaneously whatever the sections and their gates allow, via subagent dispatch and via Workflows. For this run's parallelization, that is the per-run request an injected `Do not use workflows or deep-research unless the user requested it` line waits on, read the same way the operating-instructions dispatch bullet reads the Agent-tool line: the instruction prohibits unrequested use, and the arming is the request. The authority is the arming act, not this skill's text, so nothing here widens the doctrine's standing grant. The scope is executing the armed plan: deep-research, and any Workflow use beyond parallelizing this run's work, still needs asking. The canonical condition text carries the same request, so it rides with the goal state across a session swap, and the Stop hook's enforcement block restates it at the point of action.

## Clear

`/kit-goal clear` (accept the aliases `stop`, `off`, `reset`, `none`, `cancel`) releases the leash:

```
node <plugin-root>/hooks/kit-goal.js clear
```

## Status

`/kit-goal` with no argument, or `/kit-goal status`, reports what is armed, including which session currently holds the leash (or that it is unbound):

```
node <plugin-root>/hooks/kit-goal.js status
```

## How the leash holds

The `kit-goal-stop.js` Stop hook (wired in the plugin's `hooks.json`) fires on every stop but is a strict no-op unless a goal is armed in the current project and the stopping session holds the leash. The leash binds to one session at a time: it arms unbound, and the session that armed it claims it at its first stop, the `/kit-goal` invocation's command arguments being the claim signal. Nothing else claims: plain prose mentions, the assistant's own text, injected context, tool output, and the CLI's echoed stdout never do, so arm from the session that should hold the leash. Once bound, no other session is leashed however often it mentions the plan, so a session spawned to discuss an armed plan is never yanked into working it, and two sessions can never both hold the same leash. Native compaction preserves the session id, so the bound session keeps its own leash across auto-compactions. Re-arming with `/kit-goal <plan path>` resets the binding; that is the recovery move when a bound session died and its work resumes in a new one. The stop-failure watcher is the mechanical caller of that same path: when a leashed unattended run dies on a retryable API failure, which reaches the StopFailure event and so never touches this Stop hook, the watcher resumes the session with exactly that arming line as its whole prompt, so the recovery is the one documented here rather than a second mechanism. Nothing trails the plan path there, deliberately: the resumed session already carries its prior conversation and the session-start notice, and trailing prose would be read as part of this command's argument span, where the path is expected to stand alone.

When the stopping session holds the leash, the hook allows the stop only when:

- (a) the plan's `Status` is `Complete`, or the plan file has moved to the archive (the run finished), in which case it also auto-clears the goal; or
- (b) the last assistant message opens with `BLOCKED:` as its very first characters (a true blocker was surfaced). The match is the literal leading prefix: a `BLOCKED:` line mid-message, or one wrapped in bold or a heading, does not release. Nor does a BLOCKED line whose stated reason is capacity (context, compaction, a fresh session): capacity is never a blocker, and the hook refuses that release, citing the completion contract; or
- (c) the last assistant message opens with `WAITING:` as its very first characters, naming the dispatched background work it awaits. This allows the stop without releasing the leash: the goal stays armed, the completed background task re-invokes the session, and the first stop after the wake re-enters enforcement. The same literal-leading-prefix rule applies, and so does the capacity refusal: waiting for context, compaction, or a fresh session is not background work, and the hook refuses it. A `WAITING:` with nothing actually pending stalls the run rather than releasing it; the armed goal stays visible at session start and to the doctor, and re-arming is the recovery, same as a crashed run.

Otherwise it blocks with a reason naming the plan, so a run cannot quietly stop with sections left. The conditions re-evaluate on every stop attempt, including inside a stop-hook continuation, so the leash holds until one is genuinely met; Claude Code's own consecutive-block cap (eight blocks without progress, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) is the loop backstop that releases a genuinely stuck session with a visible warning. Any error inside the hook allows the stop: the leash never traps a session. The canonical condition text is composed and owned by `hooks/kit-goal-lib.js` (`composeCondition`); this skill does not restate the literal, so the two cannot drift.
