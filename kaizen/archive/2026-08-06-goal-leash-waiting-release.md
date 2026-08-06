# Kaizen brief: a waiting release for the goal leash

Friction: an armed goal leash has no way to park a session that is legitimately blocked on background subagents. The Stop hook's only release valves were plan-Complete and a leading BLOCKED:, so a session waiting on dispatched background work got its stop blocked and was re-invoked instantly, burning up to eight invocations until the harness's consecutive-block cap force-released, and sessions learned to fake a foreground block to wait. The harness guarantees the wake (a completed background task re-invokes the session), so an allowed stop while background work pends is the correct way to wait, not abandonment.

Change:
- `plugins/claude-kit/hooks/kit-goal-stop.js`: clause (b2). A last assistant message leading with the literal `WAITING:` allows the stop without clearing the goal and without an event; the leash re-enters enforcement at the first stop after the wake. The clause-(b) capacity refusal judges WAITING too, so it cannot become the capacity escape hatch, and the enforcement block reason names the new valve.
- `plugins/claude-kit/hooks/kit-goal-lib.js`: composeCondition states the pause.
- `plugins/claude-kit/skills/kit-goal/SKILL.md`: allow clause (c) documented, including the fake-WAITING stall consequence and its re-arm recovery.
- `plugins/claude-kit/skills/executing-work/SKILL.md`: waiting as the third stop shape in the stop contract; no foreground fake-waits.
- Tests: four new cases in `test/kit-goal-stop.test.js` (allow-with-goal-intact-no-event, mid-message does not release, stale earlier WAITING does not release, capacity-shaped WAITING refused naming the prefix); the composeCondition exact pin updated in `test/kit-goal-lib.test.js`.

Acceptance: the two behavior-changing tests fail against the HEAD hook and pass against the new one (proven both directions); the guard-direction tests pass in both worlds; kit-goal suites 83/0; full suite delta vs baseline is zero (the memq-shim pair is a pre-existing machine-environment failure, filed in docs/backlog.md).

Discipline: writing-skills followed; the hook change is code with a red/green regression proof, and the skill wording rides on the enforced mechanism rather than standing alone.
