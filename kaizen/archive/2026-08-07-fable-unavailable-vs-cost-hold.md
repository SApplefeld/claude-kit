# Kaizen brief: fable unavailable is not fable held on a cost hold

Friction: finishing-work runs the security review and the final adversarial review at fable by default, and named exactly one thing that lowers them to the session model: a recorded `Fable Spend: none (cost hold)`. It said nothing about fable being unreachable in the environment. The two states produce the same dispatch and different obligations, so a session that hit an unavailable fable had no path but to conflate it with a cost hold and close out silently, which reports a downgrade nobody chose as an agreed one.

Change:
- `plugins/claude-kit/skills/finishing-work/SKILL.md`: the fable-default paragraph gains the discriminator. A cost hold is a recorded spend decision, so the session model is the agreed oversight and nothing further is owed. Unavailability is the gate failing to run at full strength with no decision behind it, so it must be confirmed from an actual dispatch failure rather than an expectation, then recorded in the final Chapter as reduced oversight with the verbatim error and named again in the close-out status, so the operator can decide whether to re-run the gate where fable is reachable.

Acceptance: the paragraph states the discriminator in general terms rather than by example, requires an attempted dispatch before either conclusion, and routes the unavailable case to both the Chapter and the close-out; a cost hold still closes out with no extra mention.

Discipline: follow writing-skills. Kept to finishing-work, which is where the friction was met; executing-work's reviewer bump has a structurally similar gap and is its own note rather than this one's scope.
