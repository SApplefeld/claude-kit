# Dispatch Authority and the Goal Queue

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-25

## Dispatch Authorization

Authorized by the operator, 2026-08-25, in the main kit session ("build a spec out of the backlog items to tackle this scenario, and then queue that up for the Opus KIT: Shared Messages session to run when complete, exactly as my standing authorization should grant"). Any session holding this plan may arm and run it; the peer message that delivers it carries a pointer, not the authority. This section is the format §1 defines, modeled by the first plan to carry it.

## Goal

Codify the planner/executor pattern the 2026-08-25 peer-messaging experiment proved: authority travels with the file and the kit goal by default, the goal queue can grow without replacing itself, arming is durable at the moment a plan arrives, and the worktree rules that made concurrent runs safe stop being folklore. When this is done: a plan doc can carry a Dispatch Authorization section that a receiving session arms on without a live confirmation round-trip; `/kit-goal` appends; the arm-where-you-run rule and the shared-checkout warning are code and skill text rather than experiment memory; and the promoted backlog item of 2026-08-25 is retired with this spec as its record.

## Approach

Execution shape: dispatched by message to "KIT: Shared Messages", which is mid-run on `docs/plans/claude-kit_kaizen-batch_spec_v1.md` in the worktree `D:\claude-kit\.claude\worktrees\kaizen-batch`. On receipt (arm-on-receipt, under the operator's standing grant recorded in that session), it re-arms its queue from the worktree cwd as the kaizen batch followed by this plan; that re-list form (the bare replace invocation naming the full queue again, live plan included, because append does not exist yet) is exactly the fragility §2 fixes. This plan runs in the same worktree after the batch completes, and the queue advance is the gate: the leash moves to this plan only when the batch reaches its terminal state, so an implementer beginning this plan's §1 already has the batch's skill amendments (notably executing-work §1) committed beneath it. Where this plan is ever run outside that queue, the manual check is the batch plan doc reading `Status: Complete`. The outstanding cross-effort merge risk is the verification-artifacts plan (uncommitted edits to executing-work and finishing-work sit in the main checkout); the finishing merge, run after pulling origin per the batch's own §3(d) rule, is where any collision surfaces.

Design decisions, each argued from the experiment's record:

- **Authority is artifact-borne by default, channel-borne for live steering.** A peer message is never operator steering (the shipped peer-sessions rule stands); a committed plan doc carrying a Dispatch Authorization section is the durable grant, so the message pointing at it needs no standing of its own. This mirrors a working precedent rather than inventing one: the AI-OS engine already dispatches on the plan header alone (a parseable Commit Model line is its go state). AI-OS is the sibling project at `D:\ai-os`; its `docs/architecture.md` and `docs/security-model.md` are the sources for the precedent and the ceiling quoted below, and both are rationale for this design rather than inputs to any section, so execution never requires opening them.
- **The mark is provenance, not credential.** On a single-principal machine an authorization section "narrows an honest writer without authenticating one" (the AI-OS security model's own ceiling, adopted verbatim as this design's). Git history is its provenance trail; nothing here claims to stop a malicious local writer, exactly as no kit guard does.
- **The section is inert to the machine contract.** The plan-doc header and nine parsed shapes are a frozen v1 contract with the external engine; `## Dispatch Authorization` is a section heading outside all of them (the `## Assumptions` precedent), placed above `## Sections of Work` and never inside it. No contract version change is needed; §1 records this placement rule where the contract is documented.
- **Queue semantics grow, never mutate.** `--append` is added; the bare replace form is unchanged for compatibility but warns when it drops a non-empty queue, naming what it drops. The goal-state file gains an authorization-provenance field at arm time; the section requiring it also requires enumerating every goal-state reader against the new field, because the store's history shows readers get written against one shape and taught the others later (project memory: memq-two-tier-reader-symmetry). The reader list is single-sourced in `docs/security-model.md` (the goal state file's seven readers); that list is the checklist and this sweep's answer.
- **Worktree stance: cwd-scoping is the design, not the bug.** The 2026-08-25 ai-os note proposed kit CLIs follow worktree pointers the way memq does; the experiment's evidence points the other way, since arm-in-worktree isolation is what let two leashed runs coexist, and it works precisely because the goal family is cwd-scoped while memq alone reaches the shared store. Adjudication: the CLIs stay cwd-scoped, the rule becomes text (arm where you will run, never across the boundary, never invoking goal or checkpoint CLIs from the other side mid-run), and the checkpoint CLI's no-goal-armed refusal gains one hint line naming the worktree case, which converts the 686c7fd confusion into a self-explaining error.
- **A handoff converts to durable state on the receiver's tree, not the sender's push.** A worktree is pinned to the commit it was cut from, so a plan committed after the cut is unreachable to the receiving CLI however real it is at origin, and the gap is invisible from the sender's side, where the arm looks trivially possible. Arm-on-receipt therefore means the earliest boundary where the receiving tree holds the plan, a worktree cut before the plan's commit deferring to its next safe tree advance; and the protocol keys on the receiver's armed acknowledgment, never the sender's assumption, with the sender holding a dispatched plan as pending until that ack arrives and the receiver naming its gate when it defers. The receiver's half completes it: a session holding a dispatched-but-pending plan compares its tree against the handoff's named anchor at each boundary it already takes (a section close, a pull it owes anyway, an arm attempt, whose refusal of an unseen path is itself the drift surfacing, not an error to route around), because a receiver's tree has no reason to fetch between boundaries and the drift is otherwise invisible from both sides. Evidence: this plan's own dispatch arrived at a worktree cut before the spec existed, the receiving session's deferral surfaced the sender half, and its accidental-boundary discovery of a moved anchor surfaced the receiver half.
- **Shared-checkout detection reads what already exists.** A session's transcripts live under the flattened project directory (`~/.claude/projects/<flattened-cwd>/`), so another live session in the same checkout is visible as a foreign `*.jsonl` with a recent mtime beside this session's own. SessionStart emits one advisory line when it sees one (fail-open, advisory only, same register as the existing goal-state hints). This is the mechanism candidate; the implementer verifies it against a real concurrent session before trusting it, and escalates if the transcript layout contradicts it.

## Sections of Work

### 1. The authorization rules in prose
Model: fable

Three surfaces, one design. In `plugins/claude-kit/skills/peer-sessions/SKILL.md`: the standing rule gains its artifact leg, stated as the resolution of the arm-on-receipt versus peer-standing collision (authority rides the channel for live steering or the artifact for planned dispatch; a peer message pointing at a plan whose Dispatch Authorization section covers the receiving session carries no authority load and needs none; absent that section, the receiving session converts the handoff to a pending record and routes confirmation to the operator, and the reply protocol gains one new state between armed and silent, named received-verified-holding-for-authority). In `plugins/claude-kit/skills/kit-goal/SKILL.md`: a Dispatch Authorization section documenting the format (who authorized, when, which sessions it covers, with "any session holding this plan" as the default scope), the arm-on-receipt rule (a plan handed to a running session is armed at the earliest moment the receiving tree holds it: immediately where the checkout already contains the plan's commit, or at the next safe tree advance where a worktree was cut before it, via `--append` once §2 lands; the handoff stays pending on the sender's side until the receiver's armed acknowledgment, which is the conversion signal, and the pending receiver re-checks its tree against the handoff's named anchor at each boundary it already takes), and the worktree rules (arm where you will run; the cwd-scoping adjudication from the Approach, stated as design). In `plugins/claude-kit/skills/curating-docs/SKILL.md`: one paragraph beside the machine-contract table recording that `## Dispatch Authorization` (like `## Assumptions`) sits outside the parsed shapes and must stay outside `## Sections of Work`.
Acceptance: all three land in their files' voice; the peer-sessions rule quotes the provenance-not-credential ceiling; `node --test test/*.test.js` matches the baseline captured before this section's first edit.
Files in scope: the three skill files.

### 2. kit-goal append, replace warning, and authorization provenance
Model: opus

In `plugins/claude-kit/hooks/kit-goal.js` and `kit-goal-lib.js`: add `--append` (appends plans to the armed queue under the existing binding, refusing a duplicate plan path); make the bare replace form warn on stderr when it drops a non-empty queue, naming the dropped plan paths; record authorization provenance in the goal state at arm time, derived from the artifact rather than asserted by the caller: the CLI parses each armed plan for a `## Dispatch Authorization` heading (no caller flag exists), and the per-plan field records either none-recorded or the section's first sentence quoted verbatim; asserted-not-authenticated in the sense that the file's content is taken at its word, for the audit trail the statusline and doctor can surface. `--append` refuses atomically: any duplicate among the appended paths refuses the whole invocation with the duplicate named and the queue unchanged, never a partial append. Add one hint line to `kit-compact-checkpoint.js`'s no-goal-armed refusal: the goal may be armed in another checkout, since the goal family resolves from cwd; arm where you run. The hint's test lands beside the existing checkpoint-CLI coverage, which is in `test/kit-compact-gate.test.js` unless the implementer finds it elsewhere and says so (no `kit-compact-checkpoint.test.js` exists). Enumerate every goal-state reader against the new field using the seven-reader list in `docs/security-model.md` as the checklist, verifying each tolerates or surfaces it; name each reader and its disposition in the section report.
Acceptance: red-first tests for `--append` (append grows the queue under the same binding; duplicate refused), the replace warning (fires on non-empty, silent on empty), and the provenance field (written at arm, read back by `status`); the reader enumeration is complete against the security-model list; full suite matches baseline plus the new tests. The security-reviewer is dispatched on this section (goal-state is shared state the leash and gate trust).
Files in scope: `plugins/claude-kit/hooks/kit-goal.js`, `kit-goal-lib.js`, `kit-compact-checkpoint.js`, their tests.
Tests: at minimum, lock both directions of append-versus-replace (an append never drops a queue entry; a replace warning names exactly what it drops), since a silently dropped armed plan is the expensive failure this whole section exists to close.

### 3. Arm-on-receipt in the workflow skills
Model: opus

In `plugins/claude-kit/skills/executing-work/SKILL.md`: receiving a new plan mid-run is itself the trigger to re-arm the queue at the earliest boundary the run's tree allows (`--append` from the run's own cwd; a tree predating the plan's commit fires the trigger at the next safe tree advance instead, and the arm is acknowledged to the sender either way), stated with the reason (the kit-goal queue is project-scoped state while the handoff message lives in conversation context, and a chapter boundary, where the kit deliberately lands compactions, is exactly where a queued intention dies silently, the loss invisible until nobody can tell it was ever there). One pointer from the completion contract to the peer-sessions authority rules for the case where the plan arrived by peer message.
Acceptance: the rule lands beside the completion contract in the file's voice; suite matches baseline.
Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`.

### 4. Shared-checkout detection at session start
Model: opus

In `plugins/claude-kit/hooks/session-start.js`: emit one advisory line when another session's transcript in this project's flattened directory has an mtime inside a ten-minute recency window (a named constant; ten minutes is the seeded default, tuned later on evidence like the store's other constants), excluding this session's own id, naming the count and the most recent age, in the existing hint register ("As a hint and not a verdict..."). Fail-open on every path; no line when the directory is unreadable or the layout does not match. Verify the mechanism against a real concurrent session before trusting it; where none happens to be live at verification time, start a second session in the checkout for the observation (it costs a session start), and where that is not possible, record the control as not-run and the real-run acceptance as pending in the Chapter, per the unproven-is-not-clean rule. If the transcript layout contradicts the Approach's candidate, escalate rather than substitute a different detector.
Acceptance: red-first test with a fixture transcript directory (foreign recent file yields the line; own-id-only yields none; stale foreign yields none); one real-run observation recorded in the section report (the line appearing in a session started beside a live sibling, or the escalation); suite matches baseline plus the new tests.
Files in scope: `plugins/claude-kit/hooks/session-start.js`, its tests.

### 5. The authority model in the library docs
Model: opus
Locus: inline

`docs/architecture.md` gains the dispatch-authority paragraph (artifact-borne authorization, the inert section, the goal-state provenance field, append semantics) where the goal leash is described, and `docs/security-model.md` gains the asserted-not-authenticated statement beside the goal-state section, plus the seven-reader list updated if §2's enumeration found it stale. Inline because the docs-write-guard denies non-curator subagents writes under `docs/`, so the executing session's main thread places this prose, taking §2's report as the fact source (the routing precedent is `docs/archive/claude-kit_fleet-integration_spec_v1.md`, which routed a guard-table docs write the same way).
Acceptance: both documents state the model in present-tense current-state voice with no change-narrative; suite matches baseline.
Files in scope: `docs/architecture.md`, `docs/security-model.md`.

## Out of Scope

- The coordination ledger (durable home for counterparty facts, offers, standing grants): parked in `docs/backlog.md`, signal unchanged (the first coordinator brainstorm consumes it). The Dispatch Authorization section covers only the arming grant.
- Teaching the worktree isolation screen to allow in-worktree compounds: retired rather than transferred, since the refusing mechanism is the harness's own isolation, not a kit hook; the doctrine exception shipping in the kaizen batch's §3(a) is the kit's whole remedy.
- Any change to the frozen v1 plan-header contract or the engine's parsed shapes; the new section is deliberately outside them.
- The Fable-coordinator-on-/loop design itself; this plan builds the authority rail it will use.
- Cross-machine or cloud-session authority; the design's scope is this machine's single-principal boundary.

## Assumptions

- assumed 2026-08-25 (source: the operator's dispatch directive in the main kit session, and the standing grant he recorded in the executing session): this handoff arms on receipt without a fresh confirmation round-trip; reversal: the executor holds and asks, which costs one round-trip and nothing else.
- assumed 2026-08-25 (default): Commit Model Commit-and-Push, the repo norm; reversal: edit the header before execution.
- assumed 2026-08-25 (source: `docs/security-model.md`'s goal-state reader enumeration): the seven-reader list is current enough to serve as §2's checklist, with §2 instructed to surface staleness rather than trust it; reversal: none needed, the instruction self-corrects.
- assumed 2026-08-25 (source: observed transcript layout, this machine, this day): flattened per-checkout project directories are where session transcripts live, making §4's detector feasible; reversal: §4's escalation clause.

## Operator Verification

- After the plugin update: arm a two-plan queue, `--append` a third from the same session, and confirm the statusline and `/kit-goal` status report all three under one binding. A dropped or duplicated entry reopens §2.
- Start a second session in a checkout where one is already live and confirm the session-start advisory line names it. Silence in that state reopens §4.

## Open Questions

- None at spec time; the blind read may add entries.

## Chapters

