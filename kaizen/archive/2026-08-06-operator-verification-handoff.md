# Kaizen brief: operator-verification handoff path

Friction: the finishing workflow assumes a plan reaches Complete and has no path for an effort whose last gate is a verification only the operator can run (a customer window, a production deploy, a real-device check). Observed in a live session: the plan either sat In Progress in docs/plans/ indefinitely, or the operator-only criterion had to be rationalized. Scott endorsed the fix direction 2026-08-06: mark the plan complete when everything Claude can deliver is done, with follow-up items handed to the operator to validate or deploy.

Change:
- `plugins/claude-kit/skills/brainstorming/SKILL.md`: add an optional `## Operator Verification` section to the spec template (after Out of Scope), so an operator-only check is authored as a handoff item and never as a Section of Work Claude cannot close.
- `plugins/claude-kit/skills/finishing-work/SKILL.md` step 1: split UNVERIFIABLE criteria into environment-blocked (fix and re-run) versus operator-only (confirm the reason, carry to the step 5 handoff).
- `plugins/claude-kit/skills/finishing-work/SKILL.md` step 5: operator-pending verifications do not hold the plan open; `Status: Complete` stays the terminal value (frozen machine contract), the final Chapter and `docs/backlog.md` carry the handoff items, the close-out names them as steps that are the operator's, and a failed operator check reopens as a new round. Add the matching excuse-table row.
- `plugins/claude-kit/agents/qa-verifier.md`: UNVERIFIABLE reports name their kind, environment or operator-only, so the orchestrator can route them.

Acceptance: a plan whose last gate is operator-only can flip to `Status: Complete` (exact string, contract-safe), archive cleanly, and leave its pending checks in the Chapter, the backlog, and the close-out board; no skill instructs leaving such a plan In Progress.

Discipline: follow writing-skills; baseline-test any behavior-shaping wording. RED not reproduced by fresh subagent rep (a full finishing pass with an operator-only criterion is the scenario); the change stands on the observed live-session failure relayed 2026-08-06 and on structural-slot form rather than a demonstrated fresh RED.
