# Kaizen Batch: Lessons of the Peer-Messaging Experiment

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-25

## Goal

Apply the 2026-08-25 kaizen pass's apply-now slate in one effort: the amendment-routing gap that wasted a review round, the peer-sessions skill's post-ship amendment, six doctrine amendments, four authoring-and-adjudication lines, the `memq unstamped` false-clean split, the docs-curator counted-claim sweep, and the statusline's load tolerance. Every item traces to a note in `kaizen/notes-SCOTT-CLAUDE.md` (all committed through `ab6022f` and after), and each note's incident is the evidence while the shipped text carries only the lesson. When this is done the inbox is empty, one backlog item (the charter-drift item of 2026-08-18) is retired by §1, and the kit's rules carry what the experiment taught.

## Approach

Prose amendments dominate; three sections carry code. The writing-skills skill governs every behavior-shaping wording change (load it before §1-§4; baseline-test wording per its bar). Project memory `skill-amendments-collide-with-neighbours` applies to every skill edit: brief reviewers to read the whole amended file, not the diff.

Surface sweep (design-time, sonnet Explore scout; findings cited inline per section): the `memq unstamped` implementation sits at `plugins/claude-kit/scripts/memq.js` (`unstampedTierHits` ~4818, `cmdUnstamped` ~4905-4990) with its wording pinned by `test/memq.test.js:7059-7101` and described in `memory-system/SKILL.md:26,94,98,150,210`; the reviewer brief fields are enumerated at `executing-work/SKILL.md:175` (prose), `:99-124` (Dispatch Brief template), `:211-224` (Workflow reviewer template), and restated in `agents/adversarial-reviewer.md:14`, `agents/blind-reviewer.md:3,12`, and all four implementer charters; the docs-curator sweep block is `agents/docs-curator.md:34-39` with the `CLAIMS SWEPT` field at `:49-52`; `kit-statusline.js` spawns a second node (`spawnSync` at :27,:37, no timeout of its own) whose widget does sync reads of goal-state and the armed plan doc per refresh, is byte-copied to `~/.claude/bin` by `doctor/install-memq-shim.ps1:16-17,44,49,140`, documented at `kit-goal/SKILL.md:50,56` and `README.md:91,93`, and has no test of its own (the widget has `test/kit-goal-statusline.test.js`).

Design decisions:

- **Sighted-only amendments line.** The amendments-in-effect line reaches the sighted lenses (adversarial, security, prose reviewers) and never the blind ones (blind-reviewer, blind-reader): their charters take the base ref or documents "and nothing else", and amendments are spec-side facts whose delivery would contaminate exactly the blindness those lenses exist for. The line's absence from a blind brief is by design and the skill text says so.
- **One owner for brief fields.** §1 prunes the charter-side field restatements to pointers at the template rather than adding the new line in seven places, which retires the 2026-08-18 backlog item recording that drift (four implementer charters plus the two reviewer charters' input restatements become pointers with only their agent-specific deltas kept inline).
- **Doctrine lines are amendments to existing bullets, not new bullets**, so no parity pins are owed (the deferral criterion: a content-carrying line fails loud when deleted). Nothing in §3 touches the `KIT-REGISTER-CORE` region or `## Before you send`, so `output-styles/kit.md` is out of scope and `test/output-style-parity.test.js` must stay green untouched.
- **Statusline fix is structural, not a bigger budget.** The measured cost is a second node spawn per refresh; the fix is loading the widget in-process, one mtime-keyed cached read for the goal state, and a stale-but-drawn fallback, with the script gaining its own test.

## Sections of Work

### 1. Amendment routing and brief-field ownership
Model: fable

In `plugins/claude-kit/skills/executing-work/SKILL.md`: give the Standing Brief Amendments block a second trigger at the adoption moment, stated on the observable event: any change to what a section's dispatches are built from (an adopted escalation resolved at the source, an operator decision, a spec amendment), once adopted, is written to the block before the next dispatch of any kind. Carry the reason in the rule: the implementer gets the amendment in its brief and looks correct, while a later reviewer holds the unamended spec and reports the difference as a defect, so the cost lands one stage later than the omission and does not look like its own consequence (evidence: four spurious CRITICALs and two MAJORs in one run). Then add a REQUIRED "Amendments in effect:" line to the sighted reviewer dispatch surfaces (the prose enumeration at :175, the Workflow reviewer template at :211-224, and the Document Review Brief for the prose-reviewer only), filled from the block or explicitly "none"; state the sighted-only design decision from the Approach where the line is introduced. Finally, prune the brief-field restatements in `agents/implementer-haiku.md`, `implementer-sonnet.md`, `implementer-opus.md`, `implementer-fable.md`, `adversarial-reviewer.md`, and `blind-reviewer.md` to a pointer at the owning template plus each agent's genuinely agent-specific expectations (the blind-reviewer's "and nothing else" clause is agent-specific and stays).
Acceptance: the adoption trigger and the recurrence trigger both name the block; the REQUIRED line appears on every sighted surface and no blind one; no charter enumerates the general field list any longer; `node --test test/*.test.js` matches the baseline captured before this section's first edit.
Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, the six agent files above.
Tests: none exist over these prose surfaces; the gate is the suite baseline plus the whole-file reviewer read.

### 2. peer-sessions post-ship amendment
Model: opus

In `plugins/claude-kit/skills/peer-sessions/SKILL.md`, three additions in the skill's own voice and register: (a) the citation rule's receiver half: when a re-check against your own surface contradicts a peer's cited claim, the first hypothesis is that you hold a different artifact, not that the peer is wrong; (b) the wedge-probe carve-out's reason, in the text where the carve-out lives: a notify_when_idle subscription can never fire for an agent wedged on an authorization prompt, which is precisely the state the probe exists to detect, so replacing the probe with the subscription destroys the mechanism rather than tidying it; (c) beside the citation rule's failure-direction evidence, its paired positive: an inference marked as an inference with its prompting evidence named is repaired by a peer at no cost.
Acceptance: all three land; the skill's existing rules and numbering are otherwise untouched; suite matches baseline.
Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`.

### 3. Doctrine amendments, byte-identical in both copies
Model: fable

Six amendments to existing bullets, landed identically in `plugins/claude-kit/skills/operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md`, each a sentence or two inside the bullet it extends: (a) the background-marker bullet gains the liveness rule (a background run's liveness is the process list plus the completion notification, never the output artifact's growth, which block-buffers in coarse jumps) and the worktree exception (the marker compound is refused inside a worktree-isolated session; the fallback is a bare backgrounded redirect plus reading the run's own summary after the completion notification); (b) the tests-independent bullet's wall-clock clause gains contention relativity (capture the contention state beside the wall clock; growth is a finding only against a comparable-contention baseline or a same-conditions trend); (c) the stage-exactly-your-target bullet gains the shared-index rule (the index is a shared mutable surface; the staged-list read is a separate step whose output is read before the commit is issued; `git mv` stages implicitly; the trap is symmetric); (d) the after-each-step gate bullet gains green-on-parents-red-on-union (a clean merge can redden a suite by itself; the untracked build stamp hashing hook bytes is the worked example, so a merge touching `plugins/claude-kit/hooks/` rebuilds before it gates); (e) the probe-restore rule gains restored-versus-retyped (the pre-probe copy is taken before the probe's first mutation, and a restore is verified by diffing the artifacts, never accepted from the report); (f) the mark-every-claim bullet gains the reported state (a claim verbatim from a peer session, well-sourced on the peer's surfaces and unverifiable on yours by construction, is marked reported, neither confirmed nor inferred). Nothing touches the `KIT-REGISTER-CORE` markers or `## Before you send`.
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

In `plugins/claude-kit/agents/docs-curator.md`: beside the sweep-by-claim block (:34-39), add the counted-claim sweep: when the changeset alters the size or membership of an enumerated set, additionally sweep the curated docs for number-words and digits near the set's name, because a bare count shares no vocabulary with the change that falsifies it and the claim-keyed sweep is structurally blind to it (ordinals are the same class). Extend the `CLAIMS SWEPT` field contract (:49-52) so counted-claim sweeps are named as such in the block.
Acceptance: the instruction sits in the existing block's voice and cites the mechanism, not the incident; suite matches baseline.
Files in scope: `plugins/claude-kit/agents/docs-curator.md`.

### 7. Statusline load tolerance
Model: opus

`plugins/claude-kit/scripts/kit-statusline.js` currently `spawnSync`s a second node per refresh (:27,:37, no timeout of its own) and `kit-goal-statusline.js` does sync goal-state and plan-doc reads per invocation; under multi-session saturation the operator sees the segment fail to draw. Changes: load the widget in-process (require it and call its render entry, eliminating the second node spawn; refactor `kit-goal-statusline.js` to export its render alongside its CLI entry so `test/kit-goal-statusline.test.js` keeps passing); cache the goal-state read keyed on the file's mtime so an unchanged state costs one stat; on any internal failure or slow path, render the last successfully rendered line rather than nothing (stale-but-drawn), with a bounded in-memory/last-line file cache under the project's `.kit/`; and add a test file for `kit-statusline.js` covering the in-process path and the stale-fallback. Do not rename either script: `doctor/install-memq-shim.ps1` byte-copies `kit-statusline.js` by name and `kit-goal/SKILL.md:50,56` documents the wiring.
Acceptance: red-first for the new test file; full suite matches baseline plus the new tests; a manual run of `node plugins/claude-kit/scripts/kit-statusline.js` in this repo renders the same segment content as before the change.
Files in scope: the two scripts, `test/kit-goal-statusline.test.js`, new `test/kit-statusline.test.js`.
Tests: at minimum, lock the stale-but-drawn fallback in both directions (healthy path renders fresh; induced failure renders the cached line, not blank), since a silent blank under load is the reported failure.

## Out of Scope

- The kit-goal queue and worktree semantics cluster (replace-only arming, arm-where-you-run, arm-on-receipt, worktree CLI resolution, the session-start shared-worktree warning): promoted to its own future design effort; banked in `docs/backlog.md`.
- The coordination-ledger design (coordination has no durable spine): parked in `docs/backlog.md` with the coordinator brainstorm as its signal.
- Teaching the worktree guard to allow in-worktree read-only compounds: parked with the kit-goal cluster; §3(a) ships the doctrine exception instead.
- `output-styles/kit.md` and the `KIT-REGISTER-CORE` region: untouched by design.
- The plugin-cache update on each machine (operator action, as always).

## Assumptions

- assumed 2026-08-25 (source: operator's standing directive of 2026-08-25 and the batched forks answered by recommendation): worktree-guard fork resolved as doctrine-exception-now, statusline included in this batch, and the executing session self-arms in a fresh worktree; reversal: one-line edits to §3(a)/§7/the handoff before execution.
- assumed 2026-08-25 (default): Commit Model Commit-and-Push, the repo norm; reversal: edit the header before execution.
- assumed 2026-08-25 (source: `agents/blind-reviewer.md` "and nothing else"): the amendments-in-effect line is sighted-only; reversal: one clause in §1.
- assumed 2026-08-25 (source: `docs/backlog.md` charter-drift item, 2026-08-18): §1's pointer-pruning is that item's chosen fix and retires it at close-out; reversal: drop the pruning from §1, keep the line-add, leave the item active.

## Operator Verification

- After the plugin update lands on a machine: the statusline segment renders under a multi-session load that previously blanked it. A blank segment under saturation reopens §7.

## Open Questions

- None at spec time; the blind read may add entries.

## Chapters

