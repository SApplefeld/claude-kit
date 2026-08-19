# Boundary Cadence and Spec Scope

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-19

## Goal

A parallelized plan run produces compaction boundaries and durable commits at regular intervals instead of one long drought that ends at the safety valve, and a spec's "Files in scope" lists are derived from the tree rather than authored from memory, with a named route back into the plan for the out-of-scope surfaces execution finds anyway. Every change is skill prose; no hook, gate, or CLI code changes.

## Approach

Two intakes drive this spec, both with evidence.

**Intake 1: the lockstep-parallelism incident (2026-08-19, a live parallel run relayed by the operator).** Four sections advanced in lockstep through repeated review rounds. No section closed for hours, so step 8 of the executing-work section loop (the only place the kit opens a compaction checkpoint) never ran; the PreCompact gate correctly deferred every auto-compaction offer as mid-chapter, and three sections of finished work sat uncommitted with the worktree as their only copy. The diagnosis is confirmed against `plugins/claude-kit/hooks/kit-compact-gate.js` and `plugins/claude-kit/skills/executing-work/SKILL.md`: the gate held exactly as designed, and the defect is that lockstep advancement starves the run of the boundaries the design schedules around. The more expensive half of the incident was the commit exposure, not the compaction: a crash would have cost the finished sections outright, where a mistimed compaction costs only a plan-doc re-read.

**Intake 2: the spec-scope kaizen note (2026-08-18, SCOTT-CLAUDE, probed rather than assumed).** A spec section's "Files in scope" is authored from what the spec writer remembers, and nothing downstream re-derives it, so a contract change touching seven surfaces ships a section scoped to two and the rest surface one review round at a time. The probes localize the gap: a session handed the bare change finds every surface unprompted (17 of 18 across six runs), and a session handed a two-file scope finds them all and correctly reports them as out of scope (3 of 3). So execution behaves; the fix sites are spec authoring, and the missing route by which a correctly-reported out-of-scope finding re-enters the plan. The compact-gate-binding close-out records the same lesson from the other end: three review rounds each found one more surface still stating a superseded rule, and the repo-wide grep that would have returned all of them at once ran only at the end.

**Design decisions, argued:**

- **Stagger, never cap.** The fix for lockstep is phase offset, not fewer sections in flight and not a bound on review depth. Review rounds stay unbounded by policy: the incident run's own rounds 3 and 4 surfaced Criticals shipping to a live VM, which is exactly what a round cap would have shipped.
- **An interim boundary, not a new board-state artifact.** The compaction checkpoint has always been an attestation, not a verification: the gate checks that an armed, bound, fresh checkpoint exists, and `kit-compact-checkpoint.js open` has no precondition beyond an armed goal (confirmed from the CLI source). A separate running board-state file would carry the same self-attested trust at the cost of new machinery and a second staleness surface. Instead, the moment of attestation becomes movable: externalize the board into the plan doc (already the recovery spine the post-compaction SessionStart re-read covers), commit it, open the checkpoint.
- **First-green commits, scoped to branches.** On a feature branch every commit is a durable recovery point and the merge is still gated by review, the finishing pass, and the PR. Direct-to-main Commit-and-Push keeps close-only commits, because main must never carry an unreviewed section state.

**Execution constraints.** Sections 1 and 2 edit the same file (`plugins/claude-kit/skills/executing-work/SKILL.md`) and run sequentially, never in parallel; section 3 touches a disjoint file and may run in parallel with either; section 4 runs last, since its acceptance is consistency with the amended skills. Before dispatching any section, confirm its in-scope files carry no foreign uncommitted edits (`git status` on the paths): another session's mid-edit state is name-and-leave, and the dispatch waits for it to clear. Every section's edits are behavior-shaping skill prose: the implementer makes the writing-skills call (RED/GREEN probe, or a waiver argued from the failure mode) and records it in the Chapter.

## Sections of Work

### 1. Boundary cadence amendments to executing-work
Model: fable
Three amendments to `plugins/claude-kit/skills/executing-work/SKILL.md`.

(a) **Stagger rule**, in "Delegating to subagents" beside the parallelize-only-on-disjoint-files rule: when several sections run concurrently, advance them offset (one being briefed, one implementing, one in review) rather than in lockstep, and run steps 4 through 8 for a section the moment it individually clears adjudication, never batched with siblings. Name lockstep as the anti-pattern: starting sections together and marching them through rounds together is the one arrangement that yields zero boundaries at identical parallelism and wall-clock.

(b) **Interim boundary**, beside step 8 and the "compaction lands at chapter boundaries" paragraph: during a closure drought, append an interim board entry to the plan doc below `## Chapters`, honor the commit model for the doc, then open the checkpoint with the same CLI call step 8 names. The recognizable floor for a drought is the crisp count: two consecutive review-round adjudications with no section closing. Alongside the floor, carry a general license in judgment language (a run that can see a drought forming may write the entry early), rather than a second counted rule. Under Review-Only the entry is written and staged like everything else and the checkpoint still opens: the recovery a boundary protects is the post-compaction plan-doc re-read, which reads the worktree, so the ritual loses nothing to that model; crash durability is Review-Only's own standing trade-off, out of this rule's reach. The entry carries each in-flight section's stage, the live dispatches and what each was asked, the current gate baseline, rulings adopted since the last boundary, and the next action per section. State plainly that this supplements step 8 and never replaces it, and that the entry is not a Chapter and carries no `Completed:` line. The heading form must not be parseable as a Chapter: recommended `### Interim board - YYYY-MM-DD`, verified against the curating-docs machine-contract section before adoption.

(c) **First-green branch commits**, in step 7's Branch-and-PR bullet and the worktree-branch clause of Commit-and-Push: when a section has passed step 2 verification but review rounds will delay its closure, commit the verified state to the feature branch then, with review fixes layered as follow-up commits. The staging discipline is unchanged: the controller stages exactly the section's files, implementers still never commit or stage, and direct-to-main Commit-and-Push keeps close-only commits. Review-Only is untouched by this amendment: it commits nothing by definition.

Acceptance: all three amendments present, each stated exactly once, with the stagger rule owned solely by executing-work (grep the kit-goal skill and every doctrine surface: the operating-instructions skill body, `home/claude-kit-doctrine.md`, and the output style, i.e. the set the parity tests hold identical); step 0's checkpoint clear and step 8's open still read correctly against the interim ritual; the writing-skills call recorded in the Chapter.
Tests: the not-a-Chapter property has no kit-side parser to lock (the strict Chapter reader lives in the external OS repo; the curating-docs machine-contract table states the heading row has no kit-side reader), so verify it by reading that table's Chapter-heading row against the chosen heading form and record the verification in the Chapter as an argued waiver; a mechanical pin belongs to the OS repo and is out of scope here. A behavior probe for the prose itself is likely waived with argument, since the failure being fixed is absent guidance rather than ignored guidance. Make and record both calls.

### 2. Out-of-scope findings route back into the plan
Model: opus
Edits to `plugins/claude-kit/skills/executing-work/SKILL.md`, after section 1 lands. In step 4 (Address findings) and step 1's DONE_WITH_CONCERNS handling: a surface an implementer or reviewer correctly reports as out of scope is adjudicated the same turn into exactly one of three destinations: folded into the current section where trivial and within the section's spirit; added to the plan as a new section (a deliberate spec amendment above the Chapters boundary, recorded in the Chapter as the drift it is); or parked in `docs/backlog.md` with the reason. Never left only in the agent's report. Step 4 owns the rule; step 1's DONE_WITH_CONCERNS handling carries the pointer.
Acceptance: the route reachable from both handling sites, stated once in step 4; the writing-skills call recorded in the Chapter.

### 3. Scope derivation at spec-authoring time
Model: opus
Edit `plugins/claude-kit/skills/brainstorming/SKILL.md`: where a spec's sections change a contract or shared surface (a schema, an event shape, a rule stated on several surfaces, a shared vocabulary), the "Files in scope" lists are derived from a discovery-banded scout sweep for every surface that speaks the contract, run before the plan sketch, with the sweep's result cited in the spec so review can check scope against it. Authoring scope from memory is the named anti-pattern, with the incident's shape as the evidence pattern (a contract change shipping scoped to a fraction of its surfaces). Placement: step 1 or a short standalone rule ahead of the step 7 sketch. Point at executing-work's scout-banding rule (open discovery at the sonnet override) rather than restating it.
Acceptance: the rule present once; a pointer, not a duplicate, of the banding rule; the writing-skills call recorded in the Chapter.

### 4. Docs alignment
Model: opus
Locus: inline
`docs/architecture.md`: the compaction-gate passage gains the interim-boundary fact (the checkpoint may open at an interim board commit during a closure drought, not only at a chapter close), and the parallelization-request clause gains the stagger expectation only if that passage states how parallel work advances (a pointer, not a second owner). Written as current state, never as change narrative.
Acceptance: `architecture.md` consistent with the amended skills; no journey phrasing.

## Out of Scope

- Hook, gate, or CLI code changes. Mechanizing the checkpoint open is the parked backlog item dated 2026-08-17 with its own wait-for-signal protocol; the compaction event log (2026-08-18) and the SessionStart computed state slice (2026-08-18) likewise stay parked on their own signals.
- Doctrine edits: orchestration mechanics live in the skills, per the doctrine's own pointer rule.
- The kit-goal skill's arming-request text: compatible as written; the stagger rule keeps one owner.
- Any cap on review rounds: rejected by design on the incident's own evidence of late-round Criticals.

## Assumptions

- assumed 2026-08-19 (default): both kaizen intakes ride one batch spec rather than two; reversal: split before arming, a copy and a rename.
- assumed 2026-08-19 (backlog, the mechanize-the-checkpoint item of 2026-08-17): boundary cadence is fixed in skill prose alone, no hook changes; reversal: that item's own signal promotes mechanization if prose fails on a real run.
- assumed 2026-08-19 (code read, `kit-compact-checkpoint.js`): the checkpoint CLI opens at any moment a goal is armed, so the interim boundary needs no gate change; reversal: none, confirmed from the CLI's own precondition.
- assumed 2026-08-19 (default): first-green commits are scoped to feature branches; direct-to-main Commit-and-Push keeps close-only commits; reversal: one wording change in section 1c.
- assumed 2026-08-19 (kaizen skill, promote route): the SCOTT-CLAUDE spec-scope note is cleared from the inbox in the spec-creation commit as promoted; reversal: re-add the line.
- assumed 2026-08-19 (one-owner rule): the kit-goal skill stays untouched; reversal: one pointer sentence there.

## Operator Verification

- The next real parallelized overnight run: compactions land at boundaries (chapter or interim) rather than at the safety valve, and no finished section sits uncommitted on a feature branch for hours. Either observation failing reopens section 1.

## Open Questions

- The interim entry's exact heading form: recommended `### Interim board - YYYY-MM-DD`; the section 1 implementer verifies it against the curating-docs machine-contract section and records the choice. Owner: section 1 implementer.

## Related

- Builds on the archived `claude-kit_boundary-gated-compaction_spec_v1.md`, `claude-kit_compaction-window-retune_spec_v1.md`, and `claude-kit_compact-gate-binding_spec_v1.md`: this spec schedules the boundaries that gate is built to land on.
- Serves the verification protocol of the backlog item "Turn boundary-gated compaction on, then judge it on a real run" (2026-08-15): boundaries must exist before compactions can land on them.
- Intakes: the 2026-08-18 SCOTT-CLAUDE kaizen note (spec scope), cleared from the inbox at this spec's creation, and the 2026-08-19 lockstep-parallelism incident relayed by the operator.

## Chapters
