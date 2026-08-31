# The leash follows the execution tree: goal state becomes per-worktree

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-31

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from the operator's design question, 2026-08-31. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-08-31 by the operator at the keyboard in the expert seat's session ("Shouldn't it reflect the worktree you're currently working in?", ruled yes in the same dialog), for any session holding this plan. Authored parked, in no queue; it arms when the operator queues it. Per the trace rule, this section is a warrant only for a citing session that did not author it.

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

`goalRoot` returns the working directory's own root for a linked worktree as it already does for an ordinary checkout; `worktreeMainRoot` stays exported for memq's unchanged use. The `acceptedWorktreeMain` orphan note is removed with the resolution that made it true; if a transitional note is warranted (a main-checkout leash recorded while the old resolution governed, now invisible from the worktree that expected it), the implementer states it from the code's real migration surface rather than inventing one, and the migration surface is read before ruling: what today's fleet holds is main-checkout leashes only, which keep resolving identically, so the expected answer is that no live state moves and no migration is needed, stated in the chapter with the reasoning. The three both-trees cross-checks (`planDisplayRoot`, `queueEntryState`, the Stop hook's "gone" check) are re-derived against co-located state and docs: each either collapses to a single-tree read or states in a comment why two trees still matter for it. Every goal-state consumer (`kit-goal.js`, `kit-goal-stop.js`, `kit-compact-gate.js`, `session-start.js`, `hook-canary.js`) inherits through `goalPath` and is checked rather than assumed: grep for any second spelling of the resolution. `test/kit-goal-worktree.test.js` fixtures flip red-first: the worktree-resolves-to-main assertions become worktree-resolves-to-itself, and a new pin holds memq's store resolution unchanged in the same fixture so the two subjects cannot drift together.

Acceptance: a leash armed in a worktree binds and gates in that worktree (compaction gate reads the leash there, chapter checkpoints honored); the main checkout's leash is untouched by a worktree arm; memq resolution pinned unchanged; the flipped tests watched red first; whole-suite delta against a recorded baseline.

### 2. Session start reports sibling leashes. Model: sonnet

`session-start.js`: where the repo has linked worktrees (`git worktree list --porcelain`, read tolerantly, absent git or no worktrees meaning silence), the goal reporting adds one hint line per sibling tree with an armed leash: the tree's name, the plan it holds, and its bound-session liveness in the same hint-not-verdict register the existing sibling-session hint uses. No path disclosure beyond what the local machine already shows; the line is local-session context, not a registry artifact. Tests: a fixture repo with a leashed sibling worktree produces the hint; no worktrees produces no line; an unreadable worktree list degrades to silence.

Acceptance: the hint present with a leashed sibling and absent otherwise, tests red-first, suite delta against the baseline.

### 3. The document sweep. Model: sonnet

The kit-goal skill's resolution passage, the peer-sessions or role text where it describes the leash as repository-scoped, and `docs/architecture.md`'s goal-state description are updated to the tree-scoped rule with the subject principle stated once (memory is about the repository; a leash is about an execution tree). Sweep pattern: `leash is the repository` and `main checkout's goal state`, controls run against the pre-change resolver comment first; the `worktree batch queue` phrasing in the plans indexes stays, being history. The Skills Worker's kaizen note is dispositioned by pointer in the chapter, not edited.

Acceptance: sweep clean on live documents with controls spoken; skill text states the tree-scoped rule; suite delta against the baseline.

## Out of Scope

- memq's worktree-to-main store resolution: correct by the subject principle, pinned unchanged by section 1.
- Multi-leash coordination beyond visibility (cross-tree claim arbitration, shared-queue forms): the claim protocol and registry already govern machine contention.
- The unleashed batch running tonight: it finishes as arranged; this plan serves the next split.

## Related

- `kaizen/notes-SCOTT-CLAUDE.md`, the 2026-08-31 per-repository-leash note by the KIT: Skills Worker seat: the finding this plan dispositions.
- `plugins/claude-kit/hooks/kit-goal-lib.js`: the resolver and cross-checks this plan changes.
- `docs/plans/claude-kit_durable-boundary_spec_v1.md`: edits `kit-compact-gate.js`'s marker leg in the main queue; this plan touches the gate only through the resolution it inherits, and whichever lands second re-anchors by content.

## Chapters
