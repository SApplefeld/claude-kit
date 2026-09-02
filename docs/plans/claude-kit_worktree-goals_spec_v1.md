# The leash follows the execution tree: goal state becomes per-worktree

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-31

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from the operator's design question, 2026-08-31. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-08-31 by the operator at the keyboard in the expert seat's session ("Shouldn't it reflect the worktree you're currently working in?", ruled yes in the same dialog), for any session holding this plan. Queued the same day by the operator's instruction ("append it to whatever is the best fit", the expert seat's fit ruling being the worktree batch): seventh and last in the worktree batch, after the instruments-not-prose plan, run by the KIT: Skills Worker seat under the same unleashed arrangement as the rest of that batch. The operator confirmed the ruling a second time 2026-08-31 at the expert seat's keyboard, directing that seat to relay the confirmation to the KIT: Skills Worker so this plan joins that seat's batch. Per the trace rule, this section is a warrant only for a citing session that did not author it; where the receiving seat's trace still cannot establish the grant, the settling act is the operator's own word in that seat's session.

## Goal

`kit-goal-lib.js` resolves goal state from a linked worktree to the main checkout on purpose: its comments state "the leash is the repository's," a worktree-local file would be "a second, unread `.kit/goal-state.json`," and a standing stderr note tells the operator to hand-clear one. That premise, one execution stream per repository, failed live on 2026-08-31: the operator split six sidecar-disjoint plans to a worktree worker, and the new seat correctly refused to arm them, because from its worktree both `/kit-goal` forms reached the main checkout's live leash, the bare form replacing a mid-section binding and `--append` leashing the batch to the wrong session behind the queue it was split to escape. The batch ran unleashed as the workaround, paying the leash's absences: no auto-advance, no re-arm recovery, and the compaction gate holding the session on `no-goal` denials rather than chapter checkpoints.

The ruling this plan executes: resolution follows the subject. A memory is about the repository, so memq's worktree-to-main resolution is right and untouched. A leash is about an execution stream, and git defines an execution stream as a working tree (HEAD, index, and branch are per-worktree), so goal state resolves to the tree the session runs in. The code already half-holds this line: plan docs resolve against the worktree's own branch ("the live plan doc belongs to the execution tree") while the state file crosses to the main checkout, a split paid for by three both-trees cross-checks. Co-locating state with docs collapses that machinery.

## Evidence

- The deliberate design and its stated premise: `plugins/claude-kit/hooks/kit-goal-lib.js`, the resolver comments (authoring-time lines 29-48), `acceptedWorktreeMain`'s orphan note (lines 262-286), and `goalRoot`/`goalPath` (lines 288-315), all read at authoring. Every consumer inherits the resolution through `goalPath`, which is what makes the fix one function rather than a sweep of readers.
- The live failure, confirmed by the worktree seat's own status run and re-verified in this session's dialog: `kit-goal.js status` from the worktree `claude-kit-skills` returned the main checkout's state (judgment-sidecar, bound to another session), and no safe arm form existed. The seat's kaizen note in `kaizen/notes-SCOTT-CLAUDE.md` (2026-08-31) records the constraint; this plan is its disposition.
- The split-resolution cost already in the code: `planDisplayRoot`, `queueEntryState`, and the Stop hook's "gone" cross-check each exist to reconcile state in one tree with docs in another, acting only where both trees agree.
- The unleashed workaround's cost is the compaction gate's `no-goal` hold shape (observed on this box at 406K consumed in a prior session), mitigated tonight by manual boundary declarations; this plan removes the need for the workaround.

## Approach

One resolver change with its consequences, then visibility, then the document sweep. The memq store resolution is explicitly out of scope: memory stays repository-scoped.

## Decisions

- Decided 2026-08-31 (operator's ruling in the design dialog): goal state is per-worktree; the leash names an execution stream, not a repository.
- Decided at authoring (expert seat): the bystander-visibility value the old resolution bought, a session anywhere in the repo learning that a leash is live somewhere, is preserved by enumeration rather than by shared state: session-start reports sibling worktrees' leashes as hints. Losing that visibility silently would recreate tonight's near-collision in the other direction.
- Decided at authoring: the orphan stderr note inverts rather than survives. Under the new resolution a worktree's own goal-state file is the real one; the note that calls it unread would be false the day this ships.

## Sections of Work

### 1. The resolver follows the tree, and the split-resolution machinery collapses. Model: opus

`goalRoot` returns the working directory's own root for a linked worktree as it already does for an ordinary checkout; memq's own worktree-to-main resolution is untouched and pinned as untouched by a drift test; `worktreeMainRoot` is not exported from `kit-goal-lib.js` and memq carries an independent copy of the resolution, so the two subjects are coupled by that pin rather than by an import. The `acceptedWorktreeMain` orphan note is removed with the resolution that made it true; if a transitional note is warranted (a main-checkout leash recorded while the old resolution governed, now invisible from the worktree that expected it), the implementer states it from the code's real migration surface rather than inventing one, and the migration surface is read before ruling: what today's fleet holds is main-checkout leashes only, which keep resolving identically, so the expected answer is that no live state moves and no migration is needed, stated in the chapter with the reasoning. The three both-trees cross-checks (`planDisplayRoot`, `queueEntryState`, the Stop hook's "gone" check) are re-derived against co-located state and docs: each either collapses to a single-tree read or states in a comment why two trees still matter for it. Every goal-state consumer (`kit-goal.js`, `kit-goal-stop.js`, `kit-compact-gate.js`, `session-start.js`, `hook-canary.js`) inherits through `goalPath` and is checked rather than assumed: grep for any second spelling of the resolution. `test/kit-goal-worktree.test.js` fixtures flip red-first: the worktree-resolves-to-main assertions become worktree-resolves-to-itself, and a new pin holds memq's store resolution unchanged in the same fixture so the two subjects cannot drift together.

Acceptance: a leash armed in a worktree binds and gates in that worktree (compaction gate reads the leash there, chapter checkpoints honored); the main checkout's leash is untouched by a worktree arm; memq resolution pinned unchanged; the flipped tests watched red first; whole-suite delta against a recorded baseline.

### 2. Session start reports sibling leashes. Model: sonnet

`session-start.js`: where the repo has linked worktrees (`git worktree list --porcelain`, read tolerantly, absent git or no worktrees meaning silence), the goal reporting adds one hint line per sibling tree with an armed leash: the tree's name, the plan it holds, and its bound-session liveness in the same hint-not-verdict register the existing sibling-session hint uses. No path disclosure beyond what the local machine already shows; the line is local-session context, not a registry artifact. Tests: a fixture repo with a leashed sibling worktree produces the hint; no worktrees produces no line; an unreadable worktree list degrades to silence.

Acceptance: the hint present with a leashed sibling and absent otherwise, tests red-first, suite delta against the baseline.

### 3. The document sweep. Model: sonnet

The four shipped skill texts asserting a repository-scoped leash are updated to the tree-scoped rule with the subject principle stated once (memory is about the repository; a leash is about an execution tree): `kit-goal/SKILL.md` (the resolution passage), `park/SKILL.md`, `recap/SKILL.md`, and `coordinator/SKILL.md` (the BLOCKED funnel's parenthetical on where the seat's status call resolves). `docs/architecture.md` and `docs/security-model.md` are swept by section 1 under the re-opened-document rule, so this section verifies them rather than rewriting them. The sweep runs a structural pattern over the claim's shape rather than a list of remembered sentences, `resolves a worktree to its main checkout|worktree resolves its main checkout|One repository has one leash`, because the patterns this plan was authored with (`leash is the repository`, `main checkout's goal state`) match none of the four live sites; a sweep keyed on remembered wording is the shape that comes back clean for the wrong reason. One hit is correct and stays: `executing-work/SKILL.md`'s memq paragraph describes the memory store, which resolves to the main checkout by design, so the sweep reports it as reached and exempt rather than as no hit at all. The control is run against a state known to hold the claim before the sweep's silence is trusted. The `worktree batch queue` phrasing in the plans indexes stays, being history. The Skills Worker's kaizen note is dispositioned by pointer in the chapter, not edited.

Acceptance: the four named sites state the tree-scoped rule; the structural sweep returns no unexempted hit, with its control spoken and the memq exemption reported by name rather than passed over in silence; the subject principle stated once in skill text; suite delta against the baseline.

### 4. The executionTree display-trust chain is retired. Model: opus

Under co-located goal state the chain has no reachable producer: `recordExecutionTree` writes the field only where `goalRoot(cwd) !== cwd`, which co-location makes impossible, so `planDisplayRoot` always falls back to cwd and the status line's root election has one possible input. Retire it: `validExecutionTree`, `planDisplayRoot`, `recordExecutionTree` and the field's handling in `normalizeState` and `advanceGoal`; the call and its comment in `kit-compact-checkpoint.js`; the Sections root election and the render-cache key rule in `kit-goal-statusline.js`, including its comment block; and whatever `kit-goal-statusline.test.js` and `kit-statusline.test.js` pin on it. Section 1 leaves the chain standing and inert with its comments restated honestly, which is why this section exists: the status line's render-cache key ships a silently stale line when it is wrong, it is a separately owned surface, and section 1's acceptance criteria never named it, so retiring it there would have been an ungated rewrite riding a resolver change.

Acceptance: no reference to the executionTree field remains on a shipped surface, swept with a control that speaks; the two status-line suites green against a baseline recorded per file; whole-gate delta against the recorded baseline.

## Out of Scope

- memq's worktree-to-main store resolution: correct by the subject principle, pinned unchanged by section 1.
- Multi-leash coordination beyond visibility (cross-tree claim arbitration, shared-queue forms): the claim protocol and registry already govern machine contention.
- The unleashed batch running tonight: it finishes as arranged; this plan serves the next split.

## Related

- `kaizen/notes-SCOTT-CLAUDE.md`, the 2026-08-31 per-repository-leash note by the KIT: Skills Worker seat: the finding this plan dispositions.
- `plugins/claude-kit/hooks/kit-goal-lib.js`: the resolver and cross-checks this plan changes.
- `docs/plans/claude-kit_durable-boundary_spec_v1.md`: edits `kit-compact-gate.js`'s marker leg in the main queue; this plan touches the gate only through the resolution it inherits, and whichever lands second re-anchors by content.

## Chapters

### Chapter 1 - 2026-09-01

Completed: 1. The resolver follows the tree, and the split-resolution machinery collapses.

Commit Model: Commit-and-Push, per this plan's header.

What shipped. `goalRoot` is now the identity function on the caller's working directory, so a linked worktree resolves its leash to its own `.kit/goal-state.json` rather than crossing to the main checkout, and `goalPath` carries that answer to every consumer without a second spelling of the resolution anywhere in the tree (grepped; the only surviving worktree-to-main handshake in the goal family is `worktreeMainRoot`, which now serves `planDisplayRoot` alone). The `acceptedWorktreeMain` orphan note went with the resolution that made it true. The three both-trees cross-checks were re-derived rather than assumed: `queueEntryState` and the Stop hook's "gone" check collapse to single-tree reads, since the state and the plan docs now belong to one tree and there is no second copy to arbitrate; `planDisplayRoot` alone still reads two trees, and its comment now says why in the present tense. `kit-compact-lib.js`'s scratch-directory comment was rewritten for the same reason: it justified creating `.kit/` on the premise that a leashed worktree run arrives with no local `.kit/` at all, which co-located state falsifies, and the live branch it reaches is the store-backed one instead. `docs/architecture.md` and `docs/security-model.md` were swept under the re-opened-document rule, six passages and five respectively.

The subject principle, stated once and now the reason the two resolutions differ on purpose: a leash names an execution stream, and git makes a working tree the unit of one, since HEAD, the index and the branch are all per-worktree; a memory is about the repository, so memq's worktree-to-main store resolution is right and is pinned unchanged by a fixture in `test/kit-goal-worktree.test.js` that holds both answers in one tree at once.

The migration ruling, read from the surface rather than invented: what the fleet holds today is main-checkout leashes, which resolve identically before and after this change because a main checkout's `goalRoot` was already itself. No live state moves and no migration is needed, so no transitional note ships. A worktree session that was leashed through the main checkout's file is the one loser, and it loses the leash silently; that is dispositioned by Section 2's sibling-leash hints rather than by a note here.

The defect three reviewers converged on, confirmed at the code before it was fixed. `normalizeState` dropped `executionTree` below its own early return, so a state carrying an `executionTree` and no `plan` key survived the read intact, and `planDisplayRoot` never checks `goal.plan`. The path is live rather than theoretical: `kit-statusline.js:239` calls `planKeyMtime` with two arguments, so `state` and `root` arrive undefined and `planDisplayRoot` performs its own read. A hand-edited state file naming a genuine linked worktree of the reading checkout would have been followed onto that tree for the status line's plan-doc display. The drop now sits at the top of `normalizeState` behind its own object guard, above every shape test, and three pins hold it. Two reviewers contradicted each other on reachability and the code settled it: the adversarial reviewer cited `readGoalState`, a different function that does filter on `plan`, and mistook it for `planDisplayRoot`'s caller.

Review findings dispositioned. Accepted and fixed: the convergent Major above; the missing coverage on `planDisplayRoot`'s trust legs, now a seven-case refusal table with a withheld positive control; four stale comments restated against the code. Accepted and left, each with the reason recorded here rather than acted on: `goalRoot` is now a speculative exported identity function, and `recordExecutionTree` no longer scrubs a planted value, both of which Section 4 retires outright, so fixing them here would be work Section 4 undoes. Routed rather than fixed: a worktree session leashed through the main checkout's file loses its leash silently (Section 2's hints), and `kit-goal.js status` from a worktree says nothing about a leash next door (Section 2 territory, or the backlog if Section 2's shape does not reach it).

Surprises. Node's `--test` default reporter is spec format rather than TAP, and its count markers are multibyte, so a grep pattern opening with `.` matches a byte and returns nothing; the counts below were read with `grep -oE '(tests|pass|fail) [0-9]+'` and every exit code was read from the run's own status rather than from a grep over its output. The `doctrine-parity` suite is a tree walker reachable by no filename-derived lane, so it was added to the lane by hand.

The red was watched, twice and independently. The implementer reported its own red before applying the fix; this session then re-ran the control itself, removing the guard line from the tree, watching `node --test test/kit-goal-worktree.test.js` exit 1 with 3 of 16 failing (the three planted-executionTree pins by name), restoring from a pre-probe file copy, and verifying the restore byte-identical by diff against that copy rather than accepting it from a report.

Lane and counts, all seven run in this session, foreground and single-file because a live foreign claim held the box for a peer session, every exit code read from the run itself. `kit-goal-worktree` 11/11/0 baseline to 16/16/0 (+5, all new and all passing), `kit-goal-lib` 163/163/0 unchanged, `kit-goal-stop` 117/117/0 unchanged, `kit-goal-statusline` 43/43/0 unchanged, `kit-compact-gate` 252/252/0 unchanged, `kit-statusline` 18/18/0 and `doctrine-parity` 60/60/0 with no prior baseline recorded, all exit 0.

The acceptance gap, named rather than papered over. This section's acceptance asks for a whole-suite delta against a recorded baseline, and no whole-gate run exists: the box carried a live foreign heavy-process claim for its whole length, and the whole gate takes roughly seven minutes of exclusive box. The seven single-file lanes above are what ran. The whole gate is owed at the finishing pass, where it runs anyway, and the baseline it diffs against has to be captured there rather than inferred from these lanes, since a targeted run's counts say nothing about a whole gate's.

Approval drift, three edits above the `## Chapters` line, each made deliberately and named here because the fingerprint that scopes approval covers everything above it. Section 4 was appended: the `executionTree` display-trust chain has no reachable producer under co-located state, and retiring it inside this section would have been an ungated rewrite of the status line's render-cache key, a separately owned surface this section's acceptance never named. Section 1's own text carried a false sentence saying `worktreeMainRoot` is not exported from `kit-goal-lib.js`; it is not exported, but the sentence went on to claim memq carries an independent copy of the resolution as the coupling, which is the pin's job, so the sentence was corrected to say what the pin actually does. Section 3's sweep was widened: the patterns the plan was authored with (`leash is the repository`, `main checkout's goal state`) match none of the four live sites, so the section would have swept clean for the wrong reason; it now names the four confirmed sites, carries a structural pattern over the claim's shape, and names `executing-work/SKILL.md`'s memq paragraph as reached-and-exempt rather than as no hit.

Next: 2. Session start reports sibling leashes.
