---
name: design-council
description: "Convene a read-only, multi-lens design council to pressure-test competing approaches at a genuine architecture fork. Offered by the brainstorming skill when a decision is material and hard to reverse - architecture, schema/data-model, build-vs-buy, a migration direction - and directly invocable when I ask to 'convene the council', 'pressure-test this approach', or 'get multiple angles on this design' before building. Not for reviewing written code (use adversarial-reviewer), non-code judgment calls, or a session stuck mid-execution (use the consult: one seat with a ruling mandate, convened by the session itself, where the council is multi-lens, sits at design time, and never runs without me present to adjudicate)."
---

# Design Council

Lenses argue a design fork through a neutral facilitator. Evidence settles each disagreement, never capitulation, or the disagreement reaches me as a clean choice.

## Roles

- **Orchestrator** - the main session running this skill. It frames the fork, dispatches agents, carries text between rounds, and presents the result to me. The orchestrator does not judge convergence and is not a council member.
- **Council members** - read-only `council-member` agents, one per lens. They research the real repo and data, take positions, and engage each other across rounds.
- **Facilitator** - one read-only `design-facilitator` agent, neutral, separate from the orchestrator.

## 0. Opt-in Check

Before dispatching anything, confirm I opted in, via the brainstorming offer or a direct request.

## 1. Frame

State the decision as an **outcome**, what is true when done, plus the 2–N candidate approaches. "Profile reads return under 50ms and skip the DB when cached" lets the council weigh caching against query optimization, while "add a Redis cache" pre-commits the argument. The default lenses are performance, maintainability/architecture, and risk-security, which reads `docs/security-model.md` if present. Swap a lens to fit the fork, such as a data-model lens on a schema decision, or an opposite-approach steelman when one option is the obvious favorite. Name the cost to me as seats × round cap, and proceed on my yes.

## 2. Blind First Round

Dispatch each member separately and in parallel. Each brief carries verbatim the outcome, the approaches, that member's lens, the repo paths and data worth reading, and the read-only constraint. Members inherit nothing else, and they must not see each other's briefs or outputs this round. Each returns a position grounded in evidence it actually read, plus its strongest objection to each alternative. An ungrounded assertion carries no weight.

## 3. Facilitator Pass

Hand the facilitator all member positions. It returns the agreement map, the attributed live disagreements, each one's crux as the factual or value question that would settle it, and a status: CONVERGED, ANOTHER_ROUND with a targeted question per member, or DEADLOCK. It classes each resolved point as evidence-resolved or capitulation. It flags a member that caved without citing why as soft convergence rather than agreement. Treat a CONVERGED after one round as suspect, and check it is not just correlated models agreeing.

## 4. Cross-examination Rounds

On ANOTHER_ROUND, re-dispatch the named members. A re-dispatched member is a fresh agent handed the full transcript. Its brief carries its own prior position, the other positions, and the facilitator's question for it. It must engage the strongest objection aimed at it by conceding, rebutting with evidence, or revising, and report what it conceded versus held. Then run another facilitator pass. Stop on CONVERGED, on DEADLOCK, or at the round cap, default three.

## 5. Synthesis and Decision

Present the facilitator's synthesis: any converged recommendation with its evidence and trade-offs, and prominently any unresolved fork, as my decision with what each option optimizes for. If the council deadlocked or hit the cap, return "unresolved - standing positions follow" and show them; do not paper over it or force a consensus. Record my decision and its rationale in the plan doc, per the doctrine's Surface decisions in batches bullet. The council informs the call; it never makes it.

## Cost Envelope

I can cut the roster, cap rounds, or decline at any point.

## Provenance

The blind-then-converge protocol is adapted from the *Converge* concept in DheerG/swarms (MIT), with no code copied. It runs on stable Claude Code without the experimental agent-teams harness.
