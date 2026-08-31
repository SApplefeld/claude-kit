# The whole gate moves to the handoff, and every other moment takes the targeted lane

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-30

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from a design dialog with the operator, 2026-08-30. Anchors are authoring-time; re-locate every hit by content, since earlier plans in the queue edit neighboring prose.

## Dispatch Authorization

Authorized 2026-08-30 by the operator at the keyboard in the expert seat's design dialog: the gate-cadence change end to end (the whole suite reserved for the plan's handoff and for a push that is itself an install surface, every other moment targeted), for any session holding this plan. The queue insertion was itself operator-covered in the same dialog, position ruled immaterial because installed rules lag agent restarts.

## Goal

The current rule runs the whole suite at section close, before every push, and after any fix round whose delta touches a shared module. In the kit repo the shared-module clause fires on essentially every fix round, because hooks and `memq` are imported by test families across the tree; on larger repos the same rule prices each of those moments at a full gate. The operator's sizing is not this repo's four minutes but the 25-plus-minute whole gates on the NEO box, where a ten-chapter plan pays over 250 added minutes of wall clock under the rule as written. The change: the whole gate runs where the plan hands off, and at a push only where that push is itself the deploy surface; everything else takes the targeted lane, which stays defined as the changed files' tests plus their family pins.

Two principles, settled in the design dialog and binding on every section:

1. **The finishing gate is ours even where CI exists.** A plan hands off clean on our own evidence, never on a gate someone else runs later; downstream CI is a backstop, not a substitute.
2. **The pre-push clause keys on the surface, never on a repo name.** A push earns the whole gate only where it lands on a trunk consumers install from directly with no CI gating the merge. That clause covers claude-kit today, whose trunk is its install channel through the version-check nudge, and stops matching it the day the repo gains branch protections (a queued direction, `docs/backlog.md`), with no rule edit.

## Evidence

- The observed cost, read 2026-08-30 from the worker's own gate logs (`.kit/s6-gate.log`, `s6-gate2.log`, `s6-gate3.log`): three whole gates inside one section of the judgment-sidecar plan, 235 to 247 seconds each at 2,544 to 2,554 tests, one section-close gate plus one per fix round because the section's deltas touched hooks, which the shared-module clause reads as always-on in this repo. Roughly twelve minutes of a roughly three-hour section: affordable here, and the shape that costs 75-plus minutes per contested section at NEO's gate price.
- The NEO figure, 25-plus minutes per whole gate, is the operator's own report of that box, unverifiable from this repo and the sizing anchor for this plan.
- The operator's hit-rate self-analysis, reported: the adversarial and blind reviews find most fresh defects in a changeset; the suite's catches are mostly flakes and assumption corrections in the tests themselves, plus the rare cross-tree collateral regression. That rare category is exactly what the retained finishing and install gates exist for, since a reviewer reads the diff and only the suite reads the rest of the tree.
- claude-kit has no CI and no `.github` directory at all (confirmed by direct read 2026-08-30), and its trunk is installed directly: the SessionStart version check nudges `claude plugin update` whenever an install trails the checkout's HEAD, mid-plan included.
- Duration figures on this box carry a wide contention band (operator-tier record `box-duration-figures-need-a-co-measured-control`); the counts above are the evidence, the durations a datum with a contention row.

## Approach

Prose end to end; no enforcement mechanics change. Section 1 lands the doctrine sentence in its three parity-pinned copies, verbatim from this spec. Section 2 amends the testing-discipline skill, the owning contract for lane mechanics. Section 3 sweeps everything else that states the old moments. The lanes themselves, the red protocol, the baseline discipline, and the contention lane's section-close clause are all unchanged.

## Decisions

- Decided 2026-08-30 (operator): the whole gate is saved for the plan's handoff; targeted wherever possible until then. Late discovery is accepted with its price named: a collateral red from an early section surfaces at finishing after later sections built on it, and is fixed late, which the operator priced as strictly better than 250-plus added minutes on a ten-chapter NEO plan.
- Decided 2026-08-30 (operator): the finishing gate stays local even where CI gates the merge, because the plan hands off clean on our own evidence.
- Decided 2026-08-30 (operator direction, work queued separately): claude-kit gets branch protections rather than a testing-rule exemption, so it follows the recognizable pattern; the backlog item carries the phasing. Principle 2 above is written so that change needs no edit here.
- Decided 2026-08-30 (operator): queue position is immaterial, since fleet sessions run installed rules and installs wait on an agent-down update cycle. Slotted third, after the durable-boundary plan, keeping the compaction fix next in line; the expert seat's placement, swappable on a word. Re-decided 2026-08-31 (operator, on new evidence): promoted to run immediately after the judgment-sidecar plan, and the operator pauses the queue at that boundary to update and restart the fleet, so the cadence is in force everywhere before any later plan runs. The new fact: observed gate spinning at the old cadence, an eight-round fix on NEO past eight hours of wall clock, plus cross-repo waiting between this box's claude-kit and ai-os sessions, which converts the deferred install saving into a live cost. Superseded the same day: the operator split the six sidecar-disjoint plans to a parallel worktree queue, this plan first in it, so it lands even before the sidecar finishes; the fleet update stays at the sidecar boundary and ships whatever the batch has landed.

## Sections of Work

### 1. The doctrine bullet, in its three parity copies. Model: sonnet

In the doctrine bullet led **After each step, run the lane the moment calls for, and report the delta.**, replace exactly these two sentences:

> The whole gate at section close, at finishing, and before a push, with the contention lane run beside it at finishing, before a push, and at section close whenever the section's delta touched machine-shared state. The whole gate after a fix round only when that round's delta touches a shared module.

with exactly this text, verbatim, no redrafting:

> The whole gate at finishing, before the plan's handoff, and before a push only where that push lands on a trunk consumers install from directly with no CI gating the merge; it runs at finishing even where downstream CI exists, because the plan hands off clean on our own evidence rather than on a gate someone else runs later. Section close and fix rounds take the targeted lane, whatever the delta touched, and the Chapter that closes a section names the lane that ran. The contention lane runs beside the whole gate wherever the whole gate runs, and at section close whenever the section's delta touched machine-shared state. A trunk can therefore carry a collateral red mid-plan at the changed families, so a peer whose baseline reddens there suspects the in-flight plan before its own change.

Every other sentence of the bullet is untouched. The three copies are `~/.claude/claude-kit-doctrine.md` (the source), `plugins/claude-kit/claude-kit-doctrine.md` (build staging), and `plugins/claude-kit/skills/operating-instructions/SKILL.md`; `test/doctrine-parity.test.js` pins them byte-identical and is the self-surfacing gate. Tests red-first per testing-discipline: edit one copy, watch the parity pin go red, land the other two, watch it green.

Acceptance: the replacement present byte-identically in all three copies with the parity pin green; no other sentence of the bullet changed (diff shows exactly the one replacement per file); suite delta against a recorded baseline. This plan's own gate moments are read from the rule in force when the section runs, which until installs catch up is the old rule; either way the final push of the plan takes a whole gate under both rules, old (before a push) and new (claude-kit's trunk is an install surface).

### 2. The testing-discipline skill, the owning contract. Model: opus

`plugins/claude-kit/skills/testing-discipline/SKILL.md`, the whole-gate moments bullet (authoring-time line 45) and its closing default line (line 48): restate the new moments in the skill's own register, carrying all of: the whole gate at finishing before the plan's handoff; at a push only where the push lands on a directly-installed trunk with no CI gating the merge; finishing gated locally even where CI exists, with the hands-off-clean reason; section close and fix rounds on the targeted lane whatever the delta touched; the Chapter naming the lane that ran; the contention lane beside the whole gate wherever it runs plus the unchanged section-close machine-shared clause; and the mid-plan-red peer note (a trunk under this cadence can carry a collateral red at the changed families, so a peer whose baseline reddens there suspects the in-flight plan first). The closed-by-default line stays, with the moments list it closes now the new one. The skill's frontmatter description mentions "a fix round tempting a full-suite re-run"; check it still reads true and amend only if the cadence change falsified it. Nothing else in the skill changes: lane construction, red protocol, wall-clock capture, and independence rules are out of this section's reach. Whole-file review per the recorded amendment defect mode (the seam collides with unchanged neighbors).

Acceptance: every element listed above present in the skill's moments passage; the old moments absent from the skill; existing pins over the skill green; suite delta against a recorded baseline.

### 3. The document sweep. Model: sonnet

Tree-wide sweep for the old moments' phrasing, then repair of every live-document hit. Patterns, each with a control run first against the pre-change doctrine copy so the instrument is proven before its silence is trusted: `at section close, at finishing, and before a push` and `touches a shared module`. Expected hits beyond section 1 and 2's own targets: `docs/architecture.md` where it describes the gate cadence, and any skill or doc restating the moments (`executing-work/SKILL.md` matched neither phrase at authoring, checked 2026-08-30; re-verify rather than trust). Append-only surfaces (Chapters, archives, kaizen notes, this spec's own quotations of the old text) are journey and stay; live documents state the new cadence in their own register. The sweep is by those two patterns plus a shape pass over grep hits for `whole gate` in `docs/` and `plugins/claude-kit/skills/`, since the class "restates the moments" is wider than two literals; where the shape pass can be given no control, the chapter names the silence unproven rather than clean.

Acceptance: both pattern sweeps return no live-document hits, each instrument's control having spoken first; the `whole gate` shape pass dispositioned hit by hit in the chapter; suite delta against a recorded baseline.

## Out of Scope

- Branch protections, CI workflows, and kit release versioning for claude-kit: operator direction, queued in `docs/backlog.md` with its phasing, wakes when the armed queue drains.
- Any change to lane construction, the red protocol, baseline discipline, test independence, or the contention lane's definition.
- The review cadence itself (two reviewers per section, re-review of contested rounds): the larger throughput lever the design dialog named, deliberately untouched here.

## Related

- `plugins/claude-kit/skills/testing-discipline/SKILL.md`: the owning contract this plan amends.
- `docs/backlog.md`, the branch-protections item: the direction that dissolves the pre-push clause's claude-kit match.
- `docs/plans/claude-kit_judgment-sidecar_spec_v1.md`: the plan whose section-6 gate logs are this plan's observed-cost evidence.

## Chapters
