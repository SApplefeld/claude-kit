# Kaizen Batch: Lessons of the Peer-Messaging Experiment

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-25

## Goal

Apply the 2026-08-25 kaizen pass's apply-now slate in one effort: the amendment-routing gap that wasted a review round, the peer-sessions skill's post-ship amendment, six doctrine amendments, four authoring-and-adjudication lines, the `memq unstamped` false-clean split, the docs-curator counted-claim sweep, and the statusline's load tolerance. Every item traces to a note in `kaizen/notes-SCOTT-CLAUDE.md` (all committed through `ab6022f` and after), and each note's incident is the evidence while the shipped text carries only the lesson. When this is done the inbox is empty, one backlog item (the charter-drift item of 2026-08-18) is retired by §1, and the kit's rules carry what the experiment taught.

## Approach

Execution shape: this plan is dispatched by message to an already-running peer session, whose first acts, before §1 and not as a section, are creating a fresh git worktree from current origin/main and arming this plan there with the kit-goal CLI from the worktree's own cwd (arm where you run). §5 shares `plugins/claude-kit/scripts/memq.js` and `test/memq.test.js` with the memory-anchors plan live in the main checkout, so before §5 pull and rebase the worktree onto origin/main, and at finishing merge origin/main before gating, which is §3(d)'s own rule applied to this plan.

Prose amendments dominate; three sections carry code. The writing-skills skill governs every behavior-shaping wording change (load it before §1-§4; baseline-test wording per its bar). Project memory `skill-amendments-collide-with-neighbours` applies to every skill edit: brief reviewers to read the whole amended file, not the diff.

Surface sweep (design-time, sonnet Explore scout; findings cited inline per section): the `memq unstamped` implementation sits at `plugins/claude-kit/scripts/memq.js` (`unstampedTierHits` ~4818, `cmdUnstamped` ~4905-4990) with its wording pinned by `test/memq.test.js:7059-7101` and described in `memory-system/SKILL.md:26,94,98,150,210`; the reviewer brief fields are enumerated at `executing-work/SKILL.md:175` (prose), `:99-124` (Dispatch Brief template), `:211-224` (Workflow reviewer template), and restated in `agents/adversarial-reviewer.md:14`, `agents/blind-reviewer.md:3,12`, and all four implementer charters; the docs-curator sweep block is `agents/docs-curator.md:34-39` with the `CLAIMS SWEPT` field at `:49-52`; `kit-statusline.js` spawns a second node (`spawnSync` at :27,:37, no timeout of its own) whose widget does sync reads of goal-state and the armed plan doc per refresh, is byte-copied to `~/.claude/bin` by `plugins/claude-kit/doctor/install-memq-shim.ps1:16-17,44,49,140`, documented at `kit-goal/SKILL.md:50,56` and `README.md:91,93`, and has no test of its own (the widget has `test/kit-goal-statusline.test.js`).

Design decisions:

- **Sighted-only amendments line.** The amendments-in-effect line reaches the sighted lenses (adversarial, security, prose reviewers) and never the blind ones (blind-reviewer, blind-reader): their charters take the base ref or documents "and nothing else", and amendments are spec-side facts whose delivery would contaminate exactly the blindness those lenses exist for. The line's absence from a blind brief is by design and the skill text says so.
- **One owner for brief fields.** §1 prunes the charter-side field restatements to pointers at the template rather than adding the new line in seven places, which retires the 2026-08-18 backlog item recording that drift (four implementer charters plus the two reviewer charters' input restatements become pointers with only their agent-specific deltas kept inline).
- **Doctrine lines are amendments to existing bullets, not new bullets**, so no parity pins are owed (the deferral criterion: a content-carrying line fails loud when deleted). Nothing in §3 touches the `KIT-REGISTER-CORE` region or `## Before you send`, so `output-styles/kit.md` is out of scope and `test/output-style-parity.test.js` must stay green untouched.
- **Statusline fix is structural, not a bigger budget.** The measured cost is a second node spawn per refresh; the fix is loading the widget in-process, one mtime-keyed cached read for the goal state, and a stale-but-drawn fallback, with the script gaining its own test.

## Standing Brief Amendments

Binding on every section dispatched or opened after the date each entry carries, per the executing-work skill's recurrence and adoption rules.

- **A1 (2026-08-25, from round 1 over sections 2, 4 and 6).** Verify every supporting factual clause in an added sentence against its own file's neighbouring text and against the codebase before it ships. Three of round 1's seven Majors were motivating clauses whose asserted mechanism the same file's own contract, or a grep of the repo, denied: a notice that "never fires" where the file's contract line has it reporting its own expiry, a claim that an omission "goes unnoticed until finishing reads the Goal" where no such check exists, and a prescribed search key conditioned on a set name the rule's own worked examples do not carry. Where a clause names a downstream check, a timing, a set's contents, or another file's behaviour, cite in your report the file:line you confirmed it at; where you cannot confirm it, drop the clause rather than softening it.
- **A2 (2026-08-25, from round 1 over section 1).** A change that alters the size or membership of an enumerated set, or the field list of a template other documents cite, sweeps every neighbouring document stating a count of it. Before reporting DONE, search the set's or template's name together with number-words and digits across `plugins/claude-kit/`, and name in your report every counted claim you checked and its verdict.

## Sections of Work

### 1. Amendment routing and brief-field ownership
Model: fable

In `plugins/claude-kit/skills/executing-work/SKILL.md`: give the Standing Brief Amendments block a second trigger at the adoption moment, stated on the observable event: any change to what a section's dispatches are built from (an adopted escalation resolved at the source, an operator decision, a spec amendment), once adopted, is written to the block before the next dispatch of any kind. Carry the reason in the rule: the implementer gets the amendment in its brief and looks correct, while a later reviewer holds the unamended spec and reports the difference as a defect, so the cost lands one stage later than the omission and does not look like its own consequence (evidence: four spurious CRITICALs and two MAJORs in one run). Then add a REQUIRED "Amendments in effect:" line to the sighted reviewer dispatch surfaces (the prose enumeration at :175, the Workflow reviewer template at :211-224, and the Document Review Brief for the prose-reviewer only), filled from the block or explicitly "none"; state the sighted-only design decision from the Approach where the line is introduced. Finally, prune the brief-field restatements in `agents/implementer-haiku.md`, `implementer-sonnet.md`, `implementer-opus.md`, `implementer-fable.md`, `adversarial-reviewer.md`, and `blind-reviewer.md` to a pointer at the owning template plus each agent's genuinely agent-specific expectations (the blind-reviewer's "and nothing else" clause is agent-specific and stays).
Acceptance: the adoption trigger and the recurrence trigger both name the block; the REQUIRED line appears on every sighted surface and no blind one; no charter enumerates the general field list any longer; `node --test test/*.test.js` matches the baseline captured before this section's first edit.
Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, the six agent files above, and (folded at round 1) `agents/prose-reviewer.md` and `agents/security-reviewer.md`, the two sighted charters the new line now reaches.
Tests: none exist over these prose surfaces; the gate is the suite baseline plus the whole-file reviewer read.

### 2. peer-sessions post-ship amendment
Model: opus

In `plugins/claude-kit/skills/peer-sessions/SKILL.md`, three additions in the skill's own voice and register: (a) the citation rule's receiver half: when a re-check against your own surface contradicts a peer's cited claim, the first hypothesis is that you hold a different artifact, not that the peer is wrong; (b) the wedge-probe carve-out's reason, extending the existing sentence at :33 ("the probe would be replaced by a subscription that a wedged agent can never trigger") with the mechanism: an agent wedged on an authorization prompt can never go idle, so the subscription can never fire, which is precisely the state the probe exists to detect, and a reviewer proposing the subscription as the tidier spelling is destroying the mechanism rather than slowing it; (c) beside the citation rule's failure-direction evidence, its paired positive: an inference marked as an inference with its prompting evidence named is repaired by a peer at no cost.
Acceptance: all three land; the skill's existing rules and numbering are otherwise untouched; suite matches baseline.
Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`.

### 3. Doctrine amendments, byte-identical in both copies
Model: fable

Six amendments to existing bullets, landed identically in `plugins/claude-kit/skills/operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md`, each a sentence or two inside the bullet it extends: (a) the background-marker bullet gains the liveness rule (a background run's liveness is the process list plus the completion notification, never the output artifact's growth, which block-buffers in coarse jumps) and the worktree exception (inside a worktree-isolated session the harness's own isolation screen, not a kit hook, refuses the marker compound as too complex to verify in-worktree; the fallback is a bare backgrounded redirect plus reading the run's own summary after the completion notification); (b) the tests-independent bullet's wall-clock clause gains contention relativity (capture the contention state beside the wall clock; growth is a finding only against a comparable-contention baseline or a same-conditions trend); (c) the stage-exactly-your-target bullet gains the shared-index rule (the index is a shared mutable surface; the staged-list read is a separate step whose output is read before the commit is issued; `git mv` stages implicitly; the trap is symmetric); (d) the after-each-step gate bullet gains green-on-parents-red-on-union (a clean merge can redden a suite by itself; the untracked build stamp hashing hook bytes is the worked example, so a merge touching `plugins/claude-kit/hooks/` rebuilds before it gates); (e) the probe-restore rule gains restored-versus-retyped (the pre-probe copy is taken before the probe's first mutation, and a restore is verified by diffing the artifacts, never accepted from the report); (f) the mark-every-claim bullet gains the reported state (a claim verbatim from a peer session, well-sourced on the peer's surfaces and unverifiable on yours by construction, is marked reported, neither confirmed nor inferred). Nothing touches the `KIT-REGISTER-CORE` markers or `## Before you send`.
Acceptance: `node --test test/doctrine-parity.test.js` and `test/output-style-parity.test.js` green; a diff of the two doctrine copies is empty; suite matches baseline.
Files in scope: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`.

### 4. Authoring and adjudication lines
Model: opus

Four bounded additions: in `plugins/claude-kit/skills/writing-skills/SKILL.md`, the checkable-surface rule (when two true framings of one fact exist, ship the one the skill's reader can verify from where they sit) and the open-enumeration rule (a fact base drawn from observed instances states its lists as open unless the contract closes them; closure comes from the contract, never from the sample agreeing with itself); in `plugins/claude-kit/skills/brainstorming/SKILL.md` step 10, a goal-coverage question beside the files-in-scope one (every claim in the Goal paragraph is owned by some section's acceptance criteria); in `plugins/claude-kit/skills/responding-to-review/SKILL.md`, cross-lens corroboration as an explicit adjudication signal (two lenses with no contact independently converging on one defect outranks either lens's severity rating; weight it above single-lens findings when ordering fixes).
Acceptance: all four land in their files' existing voice; suite matches baseline.
Files in scope: the three skill files above.

### 5. memq unstamped: distinguish empty from clean
Model: opus

In `plugins/claude-kit/scripts/memq.js` (`unstampedTierHits` ~4818, `cmdUnstamped` ~4905-4990): make the report distinguish "no records read this window" from "records read, none unstamped", so a run whose reads all bypassed the tracker (Read tool or cat instead of `memq get`) no longer produces output byte-identical to a genuinely clean sweep. Keep the per-tier coverage lines; the distinguishing line is per-report. Update the pinned wording test at `test/memq.test.js:7059-7101` red-first (old wording fails, new passes) and re-check the adjacent output pins the sweep listed (`:6796-:7276` band). Update the `memory-system/SKILL.md` descriptions (:26 table row, and the backstop prose at :94/:98/:150/:210) to the new contract, including stating plainly that index-only and tool-file reads never enter the count, which is the blind spot this change makes loud.
Acceptance: red-first shown for the wording change; full suite matches baseline plus the changed pins; the two output states are visibly distinct in a real `memq unstamped` run against an empty-read and a read-but-stamped store state.
Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`, `plugins/claude-kit/skills/memory-system/SKILL.md`.

### 6. docs-curator counted-claim sweep
Model: sonnet

In `plugins/claude-kit/agents/docs-curator.md`: the sweep block (:34-41) already names counts and closes with "Search for the old name, the old number, and the number words around whatever changed", and a live whole-library curation still missed a stale count, because that line keys the search on the change's own vocabulary while a bare count describes the changed set without naming the change. Amend that closing line in place (supersede, do not duplicate): when the changeset alters the size or membership of an enumerated set, the search keys on the set's name (number-words and digits near it across the curated docs), not on the change's vocabulary; ordinals ("the third bullet", "the last section") are the same class. Extend the `CLAIMS SWEPT` field contract (:49-52) so counted-claim sweeps are named as such in the block.
Acceptance: the instruction sits in the existing block's voice and cites the mechanism, not the incident; suite matches baseline.
Files in scope: `plugins/claude-kit/agents/docs-curator.md`.

### 7. Statusline load tolerance
Model: opus

`plugins/claude-kit/scripts/kit-statusline.js` currently `spawnSync`s a second node per refresh (:27,:37, no timeout of its own) and `kit-goal-statusline.js` does sync goal-state and plan-doc reads per invocation; under multi-session saturation the operator sees the segment fail to draw. Changes: load the widget in-process (require it and call its render entry, eliminating the second node spawn; refactor `kit-goal-statusline.js` to export its render alongside its CLI entry so `test/kit-goal-statusline.test.js` keeps passing); give it a file-backed render cache under the project's `.kit/` (the process is born and dies per refresh, so nothing in-memory survives; the cache file carries the last rendered line plus the goal-state mtime it was rendered from; a refresh stats the goal state, and on an unchanged mtime prints the cached line for one stat plus one small read, skipping the plan-doc read); on any internal failure or slow path, render that cached line rather than nothing (stale-but-drawn); and add a test file for `kit-statusline.js` covering the in-process path and the stale-fallback. Do not rename either script: `doctor/install-memq-shim.ps1` byte-copies `kit-statusline.js` by name and `kit-goal/SKILL.md:50,56` documents the wiring.
Acceptance: red-first for the new test file; full suite matches baseline plus the new tests; a manual run of `node plugins/claude-kit/scripts/kit-statusline.js` in this repo renders the same segment content as before the change.
Files in scope: the two scripts, `test/kit-goal-statusline.test.js`, new `test/kit-statusline.test.js`.
Tests: at minimum, lock the stale-but-drawn fallback in both directions (healthy path renders fresh; induced failure renders the cached line, not blank), since a silent blank under load is the reported failure.

### 8. The claim-marking set's enforcement surfaces
Model: opus

Appended 2026-08-25 during section 3's review round, which is approval drift and is recorded as such in that section's Chapter. Section 3(f) adds a third claim-marking state, `reported`, for a claim that is well-sourced on a peer session's surfaces and unverifiable on yours. Both review lenses independently found that the surfaces enforcing the marking rule still state the set as two members, and the one that bites is the send-gate checklist question "Can a reader separate what you confirmed from what you inferred?", because a session executing that question as written has no home for a reported claim and collapses it into inferred, which is exactly the mis-aimed repair 3(f) warns against. Two neighbouring sentences carry the same two-member framing: the register bullet's "legible about confirmed versus inferred" and the journal-layer sentence's "confirmed-versus-inferred marking". All three sit inside the `KIT-REGISTER-CORE` region, so each edit lands byte-identically in three copies: `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, and `plugins/claude-kit/output-styles/kit.md`. Keep the edits minimal and keep the checklist question one line; it is the most-read line in the doctrine.

Deliberately NOT swept, recorded here so the omission reads as a decision: the subagent charters and skill fields that define confirmed-versus-inferred for their own reports (`skills/executing-work/SKILL.md`'s Dispatch Brief field, `agents/consultant.md`, `agents/security-reviewer.md`, and the four implementer charters). A dispatched agent marks claims about code it read itself and never receives a peer session's claim, so two states is the complete set for that audience and a third would be scope creep, not consistency.

Acceptance: all three surfaces name the third state; `node --test test/doctrine-parity.test.js` and `test/output-style-parity.test.js` both green, with the pinned `KIT-REGISTER-CORE` region byte-identical across all three copies; full suite matches baseline.
Files in scope: `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `plugins/claude-kit/output-styles/kit.md`.
Tests: the two parity suites are the mechanical gate and they fail loudly on any byte divergence; no new test is owed.

## Out of Scope

- The kit-goal queue and worktree semantics cluster (replace-only arming, arm-where-you-run, arm-on-receipt, worktree CLI resolution, the session-start shared-worktree warning): promoted to its own future design effort; banked in `docs/backlog.md`.
- The coordination-ledger design (coordination has no durable spine): parked in `docs/backlog.md` with the coordinator brainstorm as its signal.
- Teaching the worktree guard to allow in-worktree read-only compounds: parked with the kit-goal cluster; §3(a) ships the doctrine exception instead.
- `output-styles/kit.md` and the `KIT-REGISTER-CORE` region: untouched by sections 1 through 7 by design. Section 8, appended mid-run, is the one deliberate exception, and it exists because section 3(f)'s third claim-marking state has its enforcement question inside that region.
- The plugin-cache update on each machine (operator action, as always).

## Assumptions

- assumed 2026-08-25 (source: operator's standing directive of 2026-08-25 and the batched forks answered by recommendation): worktree-guard fork resolved as doctrine-exception-now, statusline included in this batch, and the executing session self-arms in a fresh worktree; reversal: one-line edits to §3(a) and §7, and a revised dispatch message to the executing session for the arming shape, before execution starts.
- assumed 2026-08-25 (default): Commit Model Commit-and-Push, the repo norm; reversal: edit the header before execution.
- assumed 2026-08-25 (source: `agents/blind-reviewer.md` "and nothing else"): the amendments-in-effect line is sighted-only; reversal: one clause in §1.
- assumed 2026-08-25 (source: `docs/backlog.md` charter-drift item, 2026-08-18): §1's pointer-pruning is that item's chosen fix and retires it at close-out; reversal: drop the pruning from §1, keep the line-add, leave the item active.

## Operator Verification

- The statusline's operative launcher is the byte copy in `~/.claude/bin`, written by the doctor's installer and NOT refreshed by a plugin update, so §7's verification takes both actions in order: `doctor -Fix` (or the installer) to refresh the bin copy, then the plugin update for the payload. After both: the statusline segment renders under a multi-session load that previously blanked it. A blank segment under saturation reopens §7.

## Open Questions

- None at spec time; the blind read may add entries.

## Chapters

### Interim board 1 - 2026-08-25

In-flight sections and their stage. §1 implemented and in review (fable pair dispatched, both live). §2, §4, §6 implemented, round 1 adjudicated below, fixes not yet dispatched. §3 implementing at fable. §5 and §7 not started; §5 waits on the pull-rebase its Execution shape requires.

Live dispatches and what each was asked. `implementer-fable` on §3, the six doctrine amendments byte-identical across both copies, with the byte-identity proof required mechanically rather than by eye. `adversarial-reviewer` and `blind-reviewer` on §1 at fable, the adversarial one asked to judge the blind side's cleanliness as its central safety property and to rule on the implementer's four declared judgment calls.

Gate baseline. 1456 pass / 1456 tests / 0 fail, exit 0, captured on the clean worktree at 434ccc3 before the first edit. Four implementer runs have each re-run the suite and matched it exactly; wall clock ranged 402s to 487s across those runs, which is contention from concurrent sessions rather than a result.

Rulings adopted since the last boundary, from round 1 over §2, §4 and §6. The round returned no Critical. Seven Majors survive adjudication and are the fix round's content.

- §2, both lenses independently: the added wedge-probe mechanism asserts the idle notice "never fires", which this same file's contract line denies, since the subscription reports its own 12-hour expiry rather than going silent. Adopted; the true objection is timing rather than impossibility, so the fix states that nothing fires while the agent is wedged and the subscription's only output is an expiry report at twelve hours, sixty times the twelve-minute probe window. (The ruling as first recorded here said "three orders of magnitude"; the section 2 implementer refused to transcribe it under amendment A1, checked the arithmetic, and shipped the corrected figure. Corrected here so the record and the shipped text agree.) This is the round's one corroborated finding, and it is the first live instance of the cross-lens rule §4 adds.
- §2, adversarial: both new sentences landed inside `## Etiquette`, which the Scope section explicitly excludes from reaching your own dispatches, so the receiver-half rule does not cover an orchestrator re-checking its own reviewer's cited claim, the highest-traffic case it was written for. Adopted; the receiver half moves to `## Standing of an inbound message`.
- §4, adversarial and blind converging on the same sentence: the goal-coverage addition asserts that an unowned Goal claim "goes unnoticed until finishing reads the Goal against what shipped", and no such downstream check exists (confirmed by grep across finishing-work, executing-work, curating-docs, qa-verifier and adversarial-reviewer). Adopted as a false claim in a shipped document.
- §4, both lenses: the addition offers two dispositions for an unowned Goal claim, and a claim deliverable only by an operator action fits neither, since brainstorming bars writing a section Claude cannot close. Adopted; `## Operator Verification` becomes the third legitimate home, mirroring how the surface check accepts `## Out of Scope`.
- §4, adversarial: the corroboration rule's "they run in parallel" is false for the qa-verifier and the docs-curator, which finishing-work runs serially. Adopted; the claim is scoped to same-round dispatches.
- §4, adversarial: the corroboration rule's independence premise is broken by the kit's own Standing Brief Amendments mechanism, which can point two lenses at one defect class, and the rule's own disqualifier cannot catch it because the kit calls that framing not-contamination. Adopted; shared standing-brief content is named as an independence breaker regardless.
- §6, both lenses: the replacement search key is conditioned on adjacency to the set's name, and the block's own worked examples ("seven bullets", "the third section") carry no set name, so the prescribed key cannot find the very claims the rule exists to catch. Adopted; both keys ship, an unconditional number-word pass and the set-name-anchored pass.

Minors recorded and deferred to the fix round where trivial: the writing-skills addition ships a two-item enumeration with no class close, which that same file forbids seven lines above; its `memq recall` example drops the "bounded" qualifier its owning site keeps; the docs-curator `counted-claim` token has no reader.

Next action per section. §1: await its review pair, then adjudicate. §2, §4, §6: dispatch one fix round carrying the seven adopted Majors. §3: await the implementer. §5, §7: dispatch after §3 closes, §5 behind its pull-rebase.

### Chapter 1 - 2026-08-25
Completed: 1. Amendment routing and brief-field ownership
Implemented By: implementer-fable (initial build and fix round, no escalation)
Metrics: review rounds 1; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the adversarial lens confirmed the section's central safety property by reading rather than by assertion, that no amendment-shaped text reaches either blind lens, and confirmed that pruning six charters to pointers deleted no obligation. The round's sharpest finding was structural rather than textual: adding a fourth, conditional field to the `Reviewer Dispatch` template silently falsified two neighbouring skills that each state the template has three fields. The adopted fix keeps the template at three and states the amendments requirement in the prose beside it, which is better on the merits as well as cheaper, since the three fields are one coherent class (each an anti-downgrade rule never left to inherit) while the amendments line is dispatch content. Both neighbouring claims were re-verified true after the change, by the implementer and again by me. The two lenses disagreed once, over the adoption trigger's incident parenthetical: the adversarial lens rated it an authorized exception, the blind lens rated it change-narrative. The blind lens wins on the plan's own Goal sentence, which says the shipped text carries only the lesson, so the count became a present-tense statement of the failure mode.
Assumptions: none beyond the plan's design-time set.
Review Findings: 0 Critical. 3 Majors addressed (the step 1 fold-the-ruling seam with no pointer to the adoption trigger; the template field count stranding two neighbours; the trigger's breadth sweeping in intake-gap assumptions that belong outside the approval-scoped fingerprint). 1 blind Major addressed (the incident parenthetical). 2 Minors addressed (the Document Review Brief preamble's accuracy, and the haiku charter's missing flag-extension clause). Out-of-scope surfaces folded, both in the same `agents/` directory the section already edits: `prose-reviewer.md` and `security-reviewer.md` gained the receiver-side amendment rule, since the new line now reaches them and neither charter could interpret it.
Stamps: adjudicated 1, stamped 1 (`test-suite-invocation`, which is why the gate ran in its glob form rather than the bare directory form that dies on Node 24).
Next: 2. peer-sessions post-ship amendment
Commit Model: Commit-and-Push (executed as Branch-and-PR first-green commits on the worktree branch; the merge to main happens in finishing-work)

### Chapter 2 - 2026-08-25
Completed: 2. peer-sessions post-ship amendment
Implemented By: implementer-opus (initial build and fix round)
Metrics: review rounds 1; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: this section produced the round's only cross-lens corroboration, and it arrived before the rule describing that signal had shipped from section 4. Both reviewers, with no contact, landed on the same sentence: the wedge-probe amendment claimed the idle notice "never fires", which this file's own contract line denies, since the subscription reports its own expiry. The objection was right and the mechanism wrong, so the argument moved from impossibility to timing. Then the fix round caught an error in my own adjudication: I had recorded the expiry as three orders of magnitude past the probe window, and twelve hours over twelve minutes is sixty times, under two orders. The implementer refused to transcribe the figure under standing amendment A1, checked the arithmetic, and shipped the corrected number. That is the amendment working against the orchestrator on its first outing, which is the direction these guards are hardest to get right. The interim board entry is corrected in place to match.
Assumptions: none beyond the plan's design-time set.
Review Findings: 0 Critical. 2 Majors addressed (the false "never fires" mechanism; both new sentences landing in `## Etiquette`, a section the file's own Scope excludes from reaching a session's own dispatches, which is the highest-traffic case the receiver-half rule was written for). The receiver half moved to `## Standing of an inbound message`; the paired positive stayed with the citation rule it pairs with, which is sender-side advice and correctly governed by Etiquette. 1 concern weighed and kept: a one-clause note explaining why the rule sits where it does, which stops a future editor tidying it back and silently re-breaking the reach.
Stamps: adjudicated 1, stamped 1 (shared with Chapter 1's sweep).
Next: 4. Authoring and adjudication lines
Commit Model: Commit-and-Push (executed as Branch-and-PR first-green commits on the worktree branch)

### Chapter 3 - 2026-08-25
Completed: 4. Authoring and adjudication lines
Implemented By: implementer-opus (initial build and fix round)
Metrics: review rounds 1; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: two of this section's four Majors were the same defect the section itself exists to prevent, which is the strongest argument for the rules it adds. The goal-coverage addition asserted that an unowned Goal claim goes unnoticed "until finishing reads the Goal against what shipped", and no such downstream reader exists anywhere in the kit; the corroboration rule asserted the lenses "run in parallel", which is false for the qa-verifier and the docs-curator. Both were motivating clauses nobody checked, which is precisely amendment A1's class. The independence finding is the subtler one: the kit's own Standing Brief Amendments mechanism can point two lenses at one defect class, and the rule's contamination test cannot catch that, because the kit explicitly rates standing repo properties as neither pre-judging nor contamination. Shared standing-brief content is now named as an independence breaker in its own right. Every factual clause the fix round shipped is cited to a file:line in the implementer's report, and it re-ran the grep behind the first Major itself rather than trusting my brief.
Assumptions: none beyond the plan's design-time set.
Review Findings: 0 Critical. 4 Majors addressed (the false downstream check; the missing third disposition for an operator-only Goal claim, now `## Operator Verification`, mirroring the surface check's allowance for `## Out of Scope`; the false parallelism claim; the broken independence premise). 3 Minors addressed (a two-item enumeration shipped with no class close in the very file that forbids it seven lines above; a dropped "bounded" qualifier; a re-read of both new rules after the edits).
Stamps: adjudicated 1, stamped 1 (shared with Chapter 1's sweep).
Next: 6. docs-curator counted-claim sweep
Commit Model: Commit-and-Push (executed as Branch-and-PR first-green commits on the worktree branch)

### Chapter 4 - 2026-08-25
Completed: 6. docs-curator counted-claim sweep
Implemented By: implementer-sonnet (initial build and fix round)
Metrics: review rounds 1; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the section's own subject matter caught the section. Both lenses found that the replacement search key was anchored on the enumerated set's name, while the sweep block's own worked examples ("seven bullets", "the third section", "the last item") name no set at all, so the prescribed key could not find the very claims the rule exists to catch. Both keys now ship: an unconditional pass over digits, number-words and ordinals across the curated docs, plus the name-anchored pass where a name exists, with neither replacing the other.
Assumptions: none beyond the plan's design-time set.
Review Findings: 0 Critical. 1 Major addressed (the unfindable search key). 1 Minor addressed (the `counted-claim` token had no reader anywhere in the plugin). Deviation from the spec, recorded rather than silently reconciled: the spec asked for the token to be added to the `CLAIMS SWEPT` field contract; the implementer dropped it and instead added a dedicated output-format line for a counted or ordinal claim, naming both search passes. I accepted the deviation because it delivers the spec's intent (a counted-claim sweep is visibly named as such in the block) through a field a reader actually consumes, rather than through a marker token nothing reads. Design intent is unchanged, so this is recorded here rather than raised.
Stamps: adjudicated 1, stamped 1 (shared with Chapter 1's sweep).
Next: 3. Doctrine amendments (its review round is in flight), then the appended section covering the three-state marking surfaces, then 5 and 7
Commit Model: Commit-and-Push (executed as Branch-and-PR first-green commits on the worktree branch)

### Chapter 5 - 2026-08-25
Completed: 3. Doctrine amendments, byte-identical in both copies
Implemented By: implementer-fable (initial build and fix round, no escalation)
Metrics: review rounds 1; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: this round is the one where the two lenses contradicted each other on a checkable fact, and settling it mattered more than either verdict. The adversarial lens rated amendment (d)'s causal clause a Major, holding that no gate in this codebase reads the real build stamp and that the hook canary's tests only ever fabricate a temporary one. The blind lens held the opposite. I read the file rather than counting votes: `test/hook-canary.test.js:22-23` sets `REAL_ROOT` to the repository's own `plugins/claude-kit`, and the test at `:180-185` runs the canary against that real root asserting exit 0 and silence, so a stale in-tree stamp does redden the suite. The adversarial lens had reasoned from the fixture helpers alone and never found that test, which is an absence concluded from a check that never spoke, the failure mode the kit's own make-the-test-earn-its-green rule names. The finding was refuted with the receipt and the implementer was told not to act on it, then re-confirmed the refutation independently. The blind lens's own low-confidence Minor about an unsourced timing figure was refuted the other way, by the adversarial lens citing the kaizen note's 212.7s versus 461s.
  Two findings were corroborated across both lenses with no contact, which under the rule section 4 shipped this same run outranks either lens's severity rating. The stamp "matches neither parent" claim was false: the stamp matches the parent it was built from, and what it no longer matches is the merged tree. And amendment (f) introduced a third claim-marking state into a bullet whose own lead still declared the two-member set exhaustive three sentences earlier.
  The implementer also corrected a project memory of mine with evidence rather than accepting it: the worktree isolation guard does not refuse compound commands as a class, and it confirmed three compound shapes passing the screen in this very session. The memory is rewritten to state the shapes actually observed on each side and to call the boundary unknown, which is what it is.
Assumptions: none beyond the plan's design-time set.
Review Findings: 0 Critical. 2 Majors addressed, both cross-lens corroborated (the false parent-matching claim; the bullet's own lead contradicting the three-state set it introduces). 1 Major refuted with receipts and recorded above. 5 Minors addressed (the liveness prohibition overshooting into the positive reading; an unverifiable superlative about implicit staging; a false exclusivity claim about the byte comparison; "by construction" overstating an unverifiability the same sentence's repair denies, plus the seam it opened with the neighbouring prose-summary rule; and, folded, the readiness-wait bullet colliding with the worktree exception two bullets below it). 1 Minor refuted with receipts. The out-of-file surfaces still stating the two-member set were handed back rather than fixed, and are section 8's subject.
Review Method Note: the round's dash sweep was run with a control, a repo file known to contain the character, so the clean result is a proven silence rather than a broken pattern.
Stamps: adjudicated 0, none surfaced (the boundary sweep returned zero unstamped records in both tiers; the run's one applied record was stamped at the previous boundary). One memory corrected rather than stamped, as recorded above.
Next: 8. The claim-marking set's enforcement surfaces (appended this run under the out-of-scope route), then 7, then 5 behind its pull-rebase
Commit Model: Commit-and-Push (executed as Branch-and-PR first-green commits on the worktree branch)

