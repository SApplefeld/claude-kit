# The whole gate moves to the handoff, and every other moment takes the targeted lane

Status: In Progress
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

Prose end to end; no enforcement mechanics change. Section 1 lands the doctrine sentence in its two parity-pinned copies, verbatim from this spec. Section 2 amends the testing-discipline skill, the owning contract for lane mechanics. Section 3 sweeps everything else that states the old moments. The lanes themselves, the red protocol, the baseline discipline, and the contention lane's section-close clause are all unchanged.

## Decisions

- Decided 2026-08-30 (operator): the whole gate is saved for the plan's handoff; targeted wherever possible until then. Late discovery is accepted with its price named: a collateral red from an early section surfaces at finishing after later sections built on it, and is fixed late, which the operator priced as strictly better than 250-plus added minutes on a ten-chapter NEO plan.
- Decided 2026-08-30 (operator): the finishing gate stays local even where CI gates the merge, because the plan hands off clean on our own evidence.
- Decided 2026-08-30 (operator direction, work queued separately): claude-kit gets branch protections rather than a testing-rule exemption, so it follows the recognizable pattern; the backlog item carries the phasing. Principle 2 above is written so that change needs no edit here.
- Decided 2026-08-30 (operator): queue position is immaterial, since fleet sessions run installed rules and installs wait on an agent-down update cycle. Slotted third, after the durable-boundary plan, keeping the compaction fix next in line; the expert seat's placement, swappable on a word. Re-decided 2026-08-31 (operator, on new evidence): promoted to run immediately after the judgment-sidecar plan, and the operator pauses the queue at that boundary to update and restart the fleet, so the cadence is in force everywhere before any later plan runs. The new fact: observed gate spinning at the old cadence, an eight-round fix on NEO past eight hours of wall clock, plus cross-repo waiting between this box's claude-kit and ai-os sessions, which converts the deferred install saving into a live cost. Superseded the same day: the operator split the six sidecar-disjoint plans to a parallel worktree queue, this plan first in it, so it lands even before the sidecar finishes; the fleet update stays at the sidecar boundary and ships whatever the batch has landed.

## Sections of Work

### 1. The doctrine bullet, in its two parity copies. Model: sonnet

In the doctrine bullet led **After each step, run the lane the moment calls for, and report the delta.**, replace exactly these two sentences:

> The whole gate at section close, at finishing, and before a push, with the contention lane run beside it at finishing, before a push, and at section close whenever the section's delta touched machine-shared state. The whole gate after a fix round only when that round's delta touches a shared module.

with exactly this text, verbatim, no redrafting:

> The whole gate at finishing, before the plan's handoff, and before a push only where that push lands on a trunk consumers install from directly with no CI gating the merge; it runs at finishing even where downstream CI exists, because the plan hands off clean on our own evidence rather than on a gate someone else runs later. Section close and fix rounds take the targeted lane, whatever the delta touched, and the Chapter that closes a section names the lane that ran. The contention lane runs beside the whole gate wherever the whole gate runs, and at section close whenever the section's delta touched machine-shared state. A trunk can therefore carry a collateral red mid-plan at the changed families, so a peer whose baseline reddens there suspects the in-flight plan before its own change.

Every other sentence of the bullet is untouched. The bullet has two repo copies: `plugins/claude-kit/skills/operating-instructions/SKILL.md` (the source) and `home/claude-kit-doctrine.md` (the mirror the machine install is built from). `test/doctrine-parity.test.js` pins that pair, comparing the skill's body after its frontmatter against the mirror's whole content with line endings normalized, and it is the self-surfacing gate. The installed copy at `~/.claude/claude-kit-doctrine.md` is downstream of the mirror, is refreshed by a plugin update rather than edited by hand, and is deliberately left to lag until the queue's fleet-update boundary; the parity pin does not read it. No `plugins/claude-kit/claude-kit-doctrine.md` exists. Tests red-first per testing-discipline: edit one copy, watch the parity pin go red, land the other, watch it green.

Acceptance: the replacement present byte-identically in both repo copies with the parity pin green; no other sentence of the bullet changed (diff shows exactly the one replacement per file); suite delta against a recorded baseline. This plan's own gate moments are read from the rule in force when the section runs, which until installs catch up is the old rule; either way the final push of the plan takes a whole gate under both rules, old (before a push) and new (claude-kit's trunk is an install surface).

### 2. The testing-discipline skill, the owning contract. Model: opus

`plugins/claude-kit/skills/testing-discipline/SKILL.md`, the whole-gate moments bullet (authoring-time line 45) and its closing default line (line 48): restate the new moments in the skill's own register, carrying all of: the whole gate at finishing before the plan's handoff; at a push only where the push lands on a directly-installed trunk with no CI gating the merge; finishing gated locally even where CI exists, with the hands-off-clean reason; section close and fix rounds on the targeted lane whatever the delta touched; the Chapter naming the lane that ran; the contention lane beside the whole gate wherever it runs plus the unchanged section-close machine-shared clause; and the mid-plan-red peer note (a trunk under this cadence can carry a collateral red at the changed families, so a peer whose baseline reddens there suspects the in-flight plan first). The closed-by-default line stays, with the moments list it closes now the new one. The skill's frontmatter description mentions "a fix round tempting a full-suite re-run"; check it still reads true and amend only if the cadence change falsified it. Nothing else in the skill changes: lane construction, red protocol, wall-clock capture, and independence rules are out of this section's reach. Whole-file review per the recorded amendment defect mode (the seam collides with unchanged neighbors).

Acceptance: every element listed above present in the skill's moments passage; the old moments absent from the skill; existing pins over the skill green; suite delta against a recorded baseline.

### 3. The document sweep. Model: sonnet

Tree-wide sweep for the old moments' phrasing, then repair of every live-document hit. Patterns, each with a control run first against the pre-change doctrine copy so the instrument is proven before its silence is trusted: `at section close, at finishing, and before a push` and `touches a shared module`. Expected hits beyond section 1 and 2's own targets: `docs/architecture.md` where it describes the gate cadence, and any skill or doc restating the moments (`executing-work/SKILL.md` matched neither phrase at authoring, checked 2026-08-30; re-verify rather than trust). Append-only surfaces (Chapters, archives, kaizen notes, this spec's own quotations of the old text) are journey and stay; live documents state the new cadence in their own register. The sweep is by those two patterns plus a shape pass over grep hits for `whole gate` in `docs/` and `plugins/claude-kit/skills/`, since the class "restates the moments" is wider than two literals; where the shape pass can be given no control, the chapter names the silence unproven rather than clean.

Acceptance: both pattern sweeps return no live-document hits, each instrument's control having spoken first; the `whole gate` shape pass dispositioned hit by hit in the chapter; suite delta against a recorded baseline.

### 4. Re-pin the parity assertions to the new cadence. Model: opus

`test/doctrine-parity.test.js` asserts the old cadence as fact, so the cadence change cannot go green until the pins state the new rule. This section runs after sections 1 and 2, since one of its pins is a three-way check spanning both their files. Three sites, each re-pinned rather than deleted or weakened, because the pinned facts changed and a pin dropped to clear a red is a guard removed:

- The phrase list in the gate-bullet routing test carries `[/shared module/, 'state the shared-module condition, which is the only thing that pulls a fix round up to the whole gate']`. The new cadence removes that condition outright, so the entry goes and the bullet's own new invariant takes its place: a fix round takes the targeted lane whatever the delta touched.
- The same list carries `[/section close/, 'name section close as a whole-gate moment']`. Under the new cadence section close is a targeted-lane moment, so the pattern still matches while its stated reason is false. The reason is corrected, since a pin passing for a reason that no longer holds is worse than one that fails: it reads as coverage while asserting nothing true.
- The lane-text-agrees test pins `'at finishing, before a push, and at section close whenever'` as the contention lane's schedule across both the doctrine copy and the testing-discipline skill. That schedule is now "beside the whole gate wherever the whole gate runs, and at section close whenever the section's delta touched machine-shared state", so the pinned phrase is replaced on both surfaces the test compares.

The new whole-gate moments earn pins of their own in the phrase list, so the moments the change introduces are guarded as tightly as the ones it retires: the handoff moment, and the install-surface condition on a pre-push gate.

Acceptance: `node --test test/doctrine-parity.test.js` exits 0, read from the run's own exit code; no assertion deleted without its replacement named in the chapter; each surviving pin's reason string true of the new cadence; whole gate against a recorded baseline.

### 5. Give the new duties their carriers in executing-work. Model: opus

The cadence change adds a standing obligation and invalidates a live premise, and neither lands anywhere that carries it. Two sites, both in `plugins/claude-kit/skills/executing-work/SKILL.md`:

- The doctrine now reads "the Chapter that closes a section names the lane that ran", and no surface that defines a Chapter carries it: the Chapter template's field list runs Completed, Implemented By, Metrics, Decisions / Surprises, Assumptions, Review Findings, Stamps, Next, Commit Model, with no gate or lane among them, and the doctrine's own Chapter bullet omits it too. Every Chapter written from the template therefore satisfies the template and violates the doctrine, with nothing to redden. It matters more under this cadence than the old one, because a section's green no longer covers the tree and the mid-plan-red diagnosis this change introduces is unreadable without knowing which lane produced each Chapter's green. Add the lane to the Chapter template and name it in the doctrine's Chapter bullet, in both parity copies.
- Step 3 dispatches the reviewers "ahead of the slow suites the close gate runs, so the reviews work that idle time", deferring its timing to the doctrine's gate bullet. That bullet now makes section close the targeted lane, so the slow-suite framing and the idle time it justifies are stale. `test/doctrine-parity.test.js` pins that exact phrase, so the stale sentence stays green: the pin moves with the text. Restate the sentence for a targeted-lane close and keep the single-shared-resource exits below it, which are unaffected.

Acceptance: the lane recorded in the Chapter template and named in the doctrine's Chapter bullet in both parity copies; step 3's close-gate sentence restated with its pin updated in the same change, the pin watched red against the old phrase first; `node --test test/doctrine-parity.test.js` exits 0, read from the run's own exit code.

### 6. Close the two moments the change orphaned. Model: opus

Two moments lost their lane and neither is named in the new list, so the bullet's own closing default demotes both to the targeted lane, which cannot do what either was for:

- The bullet still ends with "a clean merge can redden a suite by itself, with both parents green and no conflict, so the post-merge gate is not ceremony". Post-merge is not a named moment, so it now takes the targeted lane derived from the merge's own diff, which by that sentence's own premise (redness in files neither parent changed) cannot observe what it warns about. Under the old rule the unconditional pre-push whole gate covered it. Name the post-merge gate's lane explicitly in both parity copies.
- `plugins/claude-kit/skills/finishing-work/SKILL.md` names no gate at the handoff: its only whole-suite run is the qa-verifier dispatch at step 1, while the handoff itself is steps 5 and 6. Resolve the ambiguity in the direction this spec's own Goal sets, which is that finishing and the handoff are one moment rather than two: the Goal reads "the whole gate runs where the plan hands off" and Principle 1 reads "a plan hands off clean on our own evidence", so the finishing gate is the handoff gate and "before the plan's handoff" glosses when finishing's gate runs rather than naming a second one. Make that reading explicit wherever the two are listed as though they were separate, and leave finishing-work's existing qa-verifier gate as the gate that implements it.

Acceptance: the post-merge gate's lane stated in both parity copies; the finishing-equals-handoff reading explicit on every surface that lists the whole-gate moments, with the parity pins agreeing rather than pinning them as two; `node --test test/doctrine-parity.test.js` exits 0, read from the run's own exit code; whole gate against a recorded baseline.

## Out of Scope

- Branch protections, CI workflows, and kit release versioning for claude-kit: operator direction, queued in `docs/backlog.md` with its phasing, wakes when the armed queue drains.
- Any change to lane construction, the red protocol, baseline discipline, test independence, or the contention lane's definition.
- The review cadence itself (two reviewers per section, re-review of contested rounds): the larger throughput lever the design dialog named, deliberately untouched here.

## Related

- `plugins/claude-kit/skills/testing-discipline/SKILL.md`: the owning contract this plan amends.
- `docs/backlog.md`, the branch-protections item: the direction that dissolves the pre-push clause's claude-kit match.
- `docs/plans/claude-kit_judgment-sidecar_spec_v1.md`: the plan whose section-6 gate logs are this plan's observed-cost evidence.

## Chapters

### Chapter 1 - 2026-08-31
Completed: 1. The doctrine bullet, in its two parity copies
Implemented By: implementer-sonnet (returned NEEDS_CONTEXT with its edits in place; the question was answered from the spec and the edits stood), then implementer-opus in the fix round
Metrics: review rounds 1 (shared with sections 2 through 4); NEEDS_CONTEXT 1; escalations 0; consults 0
Decisions / Surprises: the spec was factually wrong about its own subject and was corrected before dispatch. It named three parity copies including `plugins/claude-kit/claude-kit-doctrine.md`, which does not exist in this worktree, and called the installed machine copy the source. The two real repo copies are the skill and the mirror, confirmed by reading `test/doctrine-parity.test.js`'s own path constants. Recorded as approval drift. The `KIT: Expert` seat later reported the same wrong list in the standing-grants spec, fixed at 6c957cf, and reported that the plugins-root file is untracked build output on its checkout, which reconciles the divergence; that reconciliation is reported from that seat and unverified here. Second surprise, from the blind review: the operator-approved verbatim text pointed the collateral red the wrong way, saying it lands "at the changed families" when the targeted lane is defined to cover exactly those, so what escapes is the untouched consumers of a changed shared module and the peer heuristic exonerated the in-flight plan for the reds it causes. Corrected in both copies and flagged to the operator on the relay as a change to approved wording.
Assumptions: none (declared 2026-08-31, section 1)
Review Findings: Critical 0. Majors addressed: the escaping-red direction. Minors noted and addressed in the fix round. The adversarial reviewer confirmed the verbatim landing byte-identically in both copies and that no other sentence changed, by reconstructing the base bullet with the spec's substitution.
Stamps: adjudicated 4, stamped 3 (`kit-state-keyed-on-project-directory-follows-the-shell-cwd`, `scott-claude-standing-delegation-granted`, `kit-project-memory-does-not-resolve-from-current-checkout`); skipped `memory-store-pushes-need-no-permission`, which did not steer this stretch since nothing was pushed
Gate: targeted lane, the eight test files naming the changed subjects, 425 tests / 425 pass / 0 fail, exit 0 read from the run's own exit code. Run contended: the primary `KIT: Worker` held the machine's heavy-process slot from 02:35:35Z for 1500s, named rather than waited out because this is a targeted lane and not a whole gate. No prior baseline exists on this eight-file lane; the run is fully green, which is a stronger claim than a delta.
Next: section 2
Commit Model: Commit-and-Push, taken as Branch-and-PR first-green commits on `batch/skill-fixes` per the worktree clause

### Chapter 2 - 2026-08-31
Completed: 2. The testing-discipline skill, the owning contract
Implemented By: implementer-opus (DONE_WITH_CONCERNS), then implementer-opus in the fix round
Metrics: review rounds 1 (shared); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the implementer declined to amend the skill's frontmatter description, arguing the "a fix round tempting a full-suite re-run" trigger reads more true under the new cadence rather than less. Adjudicated correct and seconded by the adversarial reviewer: a fix round is now never a whole-gate moment, so the phrase names exactly the temptation the skill resolves, where under the old rule a shared-module fix round genuinely required the suite. The implementer also made a seam repair at line 68 inside a bullet its brief marked out of scope; accepted, but it is section 3's hit rather than section 2's, since section 3's shape pass covers `whole gate` grep hits under `plugins/claude-kit/skills/`, and it is dispositioned there.
Assumptions: none (declared 2026-08-31, section 2)
Review Findings: one Critical, from the blind reviewer, addressed. The skill claimed that under this cadence "nothing between the sections reads the rest of the tree", which is false for this repo: Commit-and-Push pushes to main at every section close (`executing-work/SKILL.md:390`), main is the trunk consumers install from, and the repo runs no CI, so the amended pre-push condition fires at that push. Read together with the moments bullet's "no property of the delta pulls either moment up", it licensed a targeted-lane push to the install surface. Rewritten. Majors addressed: a wrong ordinal ("That second moment") pointing at the handoff while describing the pre-push condition; the escaping-red direction restated to match the doctrine. One fold taken: the fix round added a clause at line 44 naming a push that follows a section close as a moment of its own, beyond the eight listed fixes. Accepted, because the Critical is not closed without it and it sits inside the same passage; the section's `Files in scope:` is unchanged, the file already being listed.
Stamps: adjudicated with section 1's sweep, which covered this section's span
Gate: as Chapter 1, one lane run covering sections 1 through 4
Next: section 3
Commit Model: Commit-and-Push, taken as Branch-and-PR first-green commits on `batch/skill-fixes`

### Chapter 3 - 2026-08-31
Completed: 3. The document sweep
Implemented By: main session (Locus: inline; the routing override, since the repair lands under `docs/`)
Metrics: review rounds 1 (shared); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: **the shape pass's silence is unproven rather than clean, and the spec anticipated exactly this.** Both pattern sweeps ran controls first against the pre-change doctrine copy at HEAD, each matching once, so both instruments were proven to speak before their silence was trusted; both return no live-document hits now. But the control was an instance the patterns' own literals name, so it proves the instrument functions and says nothing about the wider "restates the moments" class, and the adversarial review then found a live member of that class the sweep could not reach: `executing-work/SKILL.md:298` describes section close as running "the slow suites", where neither literal appears and the phrase is "the close gate" rather than "whole gate". The class is therefore demonstrably unswept rather than swept, and it is routed to appended section 5 rather than reported as clean. Sweep dispositions: `docs/architecture.md:37` repaired, twice (the moments parenthetical, then a second finding that the same paragraph's "Two rules are deliberately stated in full on both surfaces" count and its cross-surface-pin claim went stale, now three rules with the handoff named as the scoped exception); `.kit/old-oi.md` gitignored scratch, left; `docs/archive/` and this spec's own quotations journey by the spec's exemption, left; `testing-discipline/SKILL.md:68` repaired as section 2's out-of-reach seam and dispositioned here. Other plan docs' acceptance lines demanding a whole gate at their section closes were ruled out of scope: they set a plan's own acceptance bar rather than restating the cadence rule, doctrine setting when a gate is owed rather than a ceiling on what a plan may require, and three of the four are live docs in the primary worker's armed queue, which the disjoint-files rule puts out of reach.
Assumptions: the four other plans' whole-gate acceptance lines are their authors' bar rather than a restatement of the retired moments, so they stay (declared 2026-08-31, section 3)
Review Findings: one Minor addressed (the stale count in the same paragraph the sweep edited).
Stamps: adjudicated with section 1's sweep
Gate: as Chapter 1
Next: section 4
Commit Model: Commit-and-Push, taken as Branch-and-PR first-green commits on `batch/skill-fixes`

### Chapter 4 - 2026-08-31
Completed: 4. Re-pin the parity assertions to the new cadence
Implemented By: implementer-opus (DONE_WITH_CONCERNS), then implementer-opus in the fix round
Metrics: review rounds 1 (shared); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: **this section did not exist at approval and was appended mid-run, recorded as approval drift.** The spec's Approach claimed "prose end to end; no enforcement mechanics change", which was false: `test/doctrine-parity.test.js` asserted the old cadence as fact at three sites, so the change could not go green without re-pinning them, and one site (`[/section close/, 'name section close as a whole-gate moment']`) still matched under the new text while its stated reason was false, which is worse than a red because it reads as coverage while asserting nothing true. Two further surprises came out of the review. First, the section's own first implementer weakened the cross-surface contention pin it was sent to protect, replacing a phrase covering both clauses of the schedule with one covering only the first, when a compliant longer phrase existed in all three surfaces; the adversarial reviewer caught it against the section's own no-weakening preamble and the fix round extended it. Second, and the deeper finding: the pins are presence-only, so re-adding "The whole gate at section close" or the shared-module condition *alongside* the new sentences passed every assertion, even though those two removals are the entire content of this change. Absence assertions were added and watched failing against the genuine pre-change bullet read via `git show`, rather than against a reconstruction. A residual limitation is recorded rather than papered over: the handoff moment is pinned by a scoped assertion on each surface instead of the three-way loop, because the doctrine says "before the plan's handoff" and the skill says "before the plan hands off", so a future rewording of either drifts undetected between them; unifying the wording is appended section 6's work.
Assumptions: none (declared 2026-08-31, section 4)
Review Findings: Critical 0. Majors addressed: the weakened cross-surface pin. Minors addressed: a pin discriminating only by letter case, now pinned on the operative phrase; a reason string dropping the section-close half; an assertion message shipping change-narrative ("the retired ... now fall to"), against the house rule that artifacts state current fact.
Stamps: adjudicated with section 1's sweep
Gate: `node --test test/doctrine-parity.test.js` exits 0 at 41 tests / 41 pass / 0 fail, read from the run's own exit code and re-run by the controlling session rather than taken from the implementer's report. Baseline on this same lane before the fix round: 41 / 40 / 1, the one red being the pin this section exists to repair.
Next: section 5
Commit Model: Commit-and-Push, taken as Branch-and-PR first-green commits on `batch/skill-fixes`
