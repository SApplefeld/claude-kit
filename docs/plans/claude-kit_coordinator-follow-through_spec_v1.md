# Coordinator follow-through: tracked requests, operator steps, source-checked reports and the persona-fleet carve-out

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-10-02

## Goal

The coordinator skill states, as the seat's default, four things it now leaves to habit. An operator request that outlives one reply is a tracked commitment of the seat, with an owner, a next act and what it waits on, and on a fleet under the persona plugin its record is a goal-tree entry. A step only the operator can do goes up as numbered instructions, each with the exact command or act and what to report back. A report naming a pull request or a worker step as open, merged, done or queued reads its source in the same pass, the pull request from the host and the worker's state from its goal tree or plan. And on a fleet under the persona plugin, the seat hands a worker a plan as a queue entry on that worker's goal tree over a coordinator record, so the never-tasks rule's arm-by-`/kit-goal` clause does not apply there and a seat restarted on that plugin reconciles its own goal tree against the pass's sources before its first report. The ownership map names the persona-fleet moment and the rationale ledger carries each new claim. The doctrine and the persona plugin's own coordinator instruction are unchanged.

## Intent

The operator said, through the coordinator persona on 2026-10-02, that the way the steward tracks requests is exactly what they want from the coordinator role, and asked whether doctrine or guidance should change so goal-tracked, task-tracked follow-through is the default. The coordinator read the skill and the doctrine against its own practice and found four gaps, each stated above.

Done needs the four rules in the coordinator skill, in the paragraphs that already own each moment, with a ledger entry per claim and the size cap moved. It needs the ownership map to name the persona-fleet moment with its precedence stated. It needs the two outside summaries of the board's categories to carry the new category, so the backlog's standing item about those restatements does not gain a fourth stale copy.

Done does not need a doctrine edit, a change to the persona plugin's coordinator instruction, a new tool, hook or test harness, a pin over the category set, or any change to the board's two line bars or the warranted-channel list.

Refused alternatives:
- A doctrine edit. The doctrine already carries the general principles (found work is acted on, a summary is re-grounded at use, the operator's steps are listed in order), and the ownership map gives the seat's runbook to the coordinator skill. A doctrine edit lands in three parity-pinned files and reaches every session for a rule only one seat performs.
- A priming change in the persona plugin. The plugin's coordinator instruction already states the steer mechanics and ranks above the skill for a persona under the doctrine's Which Text Governs. The defect is the skill's silence on that case, not the instruction's claim.
- A pin over the category set. The backlog's item of 2026-08-31 asks for one, and this plan touches the restatements by hand as that item's interim repair. The pin is its own effort.

Later rulings: none yet.

Provenance: written by the architect persona on 2026-10-02 in session e57cef63, on the coordinator persona's record ARCHITECT-e07bad48-2f72-460e-99af-d9161193fcb9-1 relaying the operator's ask.

## Approach

Each rule lands in the paragraph of `plugins/claude-kit/skills/coordinator/SKILL.md` that already owns its moment, so no second rule stands beside an existing one.

1. **The tracked request** lands in the Ledger's commitment-categories sentence as a sixth category, closing the set at six: an operator request this seat has taken on that outlives one reply. Its line carries the subject of the request, the owner, the next act and what it waits on, under the board's two line bars, so the operator's words ride as a pointer to the channel and time they arrived. Its carrier on a fleet under the persona plugin is the seat's own goal tree, one entry per request through the plugin's goal tools, and a board line is written only where the seat holds no goal tree. The persona plugin already opens a turn record on each operator message and promotes it to a goal entry only when the turn writes a plan (`hooks/index.ts`, Sections 4 to 6 of the goal-every-turn plan in the `agent_persona` repository), so a request that outlives the reply is the seat's own act to track. The board's readability test, the chassis's admission test and the four-kinds routing are unchanged, and the closed-at-six count replaces no other count.

2. **The operator-step shape** lands in Etiquette beside the decision-ask sentence. A step only the operator can do goes up as a numbered list, each item naming the exact command or act, what to report back, and what outcome reopens the work. The shape is the plan doc's `## Operator Verification` item shape, which `brainstorming` owns, applied to a message. It takes the board's bars at the point of use as every report does.

3. **The source check** lands in the Reconciliation Pass's source list and in the Operator interface bullet. Two sources join the list: the state of each open plan pull request read from the host, through the GitHub CLI's pull request view, in a repository the path screen has placed, and a persona worker's goal tree read from the `.agentic-personas.json` in the working directory its inbox call returns, which the plugin's coordinator instruction already names as the read. One sentence in the Operator interface bullet states that a report naming a pull request or a worker step as open, merged, done or queued reads that source in the same pass, and names the unreachable source as cannot measure rather than carrying the last reading forward. The doctrine's "A summary outlives its source" bullet owns the principle and the sentence points at it rather than restating it.

4. **The persona-fleet carve-out** lands in the Never-Tasks-Directly Rule as its own paragraph after the arm-by-`/kit-goal` sentence. On a fleet under the persona plugin, the seat holds a live persona claim and the plugin labels each record it sends a worker from that claim. A plan reaches a worker as a queue entry on that worker's goal tree, which the seat has the worker add over such a record, and the entry is the queue instruction. No leash is armed and the `/kit-goal` sentence does not apply there, under the operator's ruling of 2026-09-24 that the leash is interactive-only and personas run unleashed. The seat still dispatches nothing: the plan is the artifact and the record asks the worker to queue it. The steer's bounds, what a record may carry and when the seat raises a steer with the operator instead, are the plugin's coordinator instruction's own and this runbook does not restate them. The cold-start order gains one sentence: a seat restarted on that plugin reconciles its own goal tree against the pass's sources before its first report, so the tree is re-derived rather than carried. The board-write sentence `test/doctrine-parity.test.js` pins, "the never-tasks-directly rule's own shape and no second rule beside it: the seat dispatches nothing, it produces artifacts and asks", is left byte-identical.

The ownership map gains one row under Coordination and Seats: the coordinator seat on a fleet under the persona plugin, with the persona plugin's coordinator instruction owning the steer mechanics and the `coordinator` skill's carve-out owning which of the runbook's rules stand there, precedence stated in the row.

Each new claim takes an entry in `plugins/claude-kit/skills/coordinator/references/rationale-ledger.md` under the skill's heading, in that file's entry form, with provenance naming the operator's ask of 2026-10-02 relayed by the coordinator persona and, for the carve-out, the ruling of 2026-09-24. The size cap moves with `node plugins/claude-kit/scripts/kit-size.js sync --repo <repo root>` in the same change, per `writing-skills`.

The scout sweep, run 2026-10-02 at `9e25a54a` with `git grep` over the tree excluding `docs/archive/` and the coordinator ledger: `commitment categories` and `a pending handoff, an open escalation` hit `plugins/claude-kit/skills/coordinator/SKILL.md:95`, `docs/security-model.md:886` and `docs/backlog.md:410`; the arm-by-`/kit-goal` sentence hits `plugins/claude-kit/skills/coordinator/SKILL.md:81` and `docs/architecture.md:341` names the never-tasks rule; `dispatches nothing` hits `test/doctrine-parity.test.js:2991` and `:3263`. The control, `dispatches nothing` over the skill itself, returned 2. `docs/architecture.md:339` states the four functions closed at four, which this plan does not change, and its line 341 deliberately does not restate the source list, so the source additions reach no second surface.

## Sections of Work

### 1. The four rules, their ledger entries, the map row and the outside summaries
Model: opus

The coordinator skill carries the four rules in the paragraphs the Approach names, each stated as a rule then its reason in the skill's register, with no em dash. The rationale ledger carries one entry per new claim. The ownership map carries the persona-fleet row. The two outside summaries of the board's categories carry the sixth category. The size budget is synced.

Acceptance:
- The Ledger's commitment-categories sentence lists six categories and says the set is closed at six, the sixth being an operator request this seat has taken on that outlives one reply, with its line's four fields and its goal-tree carrier on the persona plugin stated in the same paragraph or the one after it.
- Etiquette states the operator-step shape: a numbered list, each item with the exact command or act, what to report back, and what outcome reopens the work, and names the plan doc's `## Operator Verification` item as the shape it takes.
- The Reconciliation Pass's source list names the host's pull request state for each open plan pull request and a persona worker's goal tree file, and the Operator interface bullet states the same-pass source read for a report of open, merged, done or queued, with the unreachable source reported as cannot measure.
- The Never-Tasks-Directly Rule carries the persona-fleet paragraph: the live claim and the plugin's label, the queue entry over a record as how a plan reaches a worker, the `/kit-goal` sentence not applying there under the 2026-09-24 ruling, the seat still dispatching nothing, and the steer bounds left to the plugin's instruction. The cold-start list carries the goal-tree reconciliation sentence.
- `git diff` over the skill shows the board-write sentence the parity test pins unchanged, and `node --test test/doctrine-parity.test.js test/size-ratchet.test.js` exits 0 from the repository root.
- `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md` has one new row under Coordination and Seats naming the persona-fleet moment, the two owning texts and which governs for what.
- `plugins/claude-kit/skills/coordinator/references/rationale-ledger.md` has one entry per new claim under the skill's heading, each with `key`, `class`, `source`, `provenance`, `verdict` and `passage` lines in the file's form.
- `docs/security-model.md`'s board-holdings paragraph near line 876 and `docs/architecture.md`'s seat paragraph at line 339 to 341 name the sixth category where each names the others, and `docs/backlog.md:410` is amended to say the set grew a second time on this plan, with its date.
- `test/size-budget.json` carries the new caps and `node plugins/claude-kit/scripts/kit-size.js check --repo .` exits 0.

Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/coordinator/references/rationale-ledger.md`, `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`, `docs/security-model.md`, `docs/architecture.md`, `docs/backlog.md`, `test/size-budget.json`.

Tests: the existing pins are the gate. `test/doctrine-parity.test.js` holds the board-write sentence, and `test/size-ratchet.test.js` holds the caps. No new test, since the delta is prose and `writing-skills` states that a doctrine-adjacent rule may ship on its point-of-action value.

## Out of Scope

- The doctrine, its home mirror and the output style.
- The persona plugin's coordinator instruction in `bin/supervise-holder.sh` of the `agent_persona` repository, and any plugin code.
- A pin over the board's category set, which `docs/backlog.md:410` tracks.
- The board's two line bars, the warranted-channel list and the four functions.
- Any rule for a worker or expert seat.

## Assumptions

- assumed 2026-10-02 (source: the doctrine's Which Text Governs and the ownership map's coordinator row): the carve-out lands in the coordinator skill rather than the persona plugin's instruction, because the skill owns the seat's runbook and the plugin's instruction already governs a persona above it; reversal: move one paragraph into `bin/supervise-holder.sh` in the `agent_persona` repository and strike the map row, one section of work.
- assumed 2026-10-02 (source: the operator's ruling of 2026-09-24, recorded in this seat's memory as the interactive-only leash ruling): a persona fleet arms no leash, so the queue entry is the whole of the arm; reversal: none needed, the ruling stands in the archived interactive-only plan.
- assumed 2026-10-02 (default): the tracked-request category closes the set at six rather than reopening the set as open, because every outside summary counts the categories; reversal: one sentence.
- assumed 2026-10-02 (default): the two outside summaries are repaired by hand on this plan and the pin stays on the backlog, because the pin is a different goal; reversal: none, the backlog item remains.
- assumed 2026-10-02 (default): Branch-and-PR with one draft pull request, the model every architect plan in this repository has taken; reversal: edit the header before the plan is queued.

## Operator Verification

None. Every criterion is checkable from the repository.

## Open Questions

None.

## Related

- `docs/archive/claude-kit_kit-goal-interactive-only_spec_v1.md`, the ruling the carve-out rests on.
- `docs/archive/claude-kit_fleet-coordinator-seat_spec_v1.md`, which put the steward on the seat under its roster name.
- `docs/backlog.md:410`, the standing item on the three hand-kept restatements of the board's categories.

## Chapters
