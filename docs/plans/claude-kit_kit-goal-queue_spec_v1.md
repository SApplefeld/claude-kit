# Kit-goal queue: one arming for a plan sequence, and bystander-aware goal framing

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-16

## Related

- `../archive/claude-kit_goal-continuity_spec_v1.md` (archived): built `/kit-goal`, the goal state, and the Stop-hook leash this plan extends. (One-way pointer; archived and immutable.)
- `../archive/claude-kit_interactive-compact-deferral_spec_v1.md` and `../archive/claude-kit_stop-failure-recovery_spec_v1.md` (archived): both read `.kit/goal-state.json` (the compact gate reads `plan` and `boundSession`; the stop-failure watcher reads the same pair), and the recovery plan added a sentence to the kit-goal skill. This plan's state changes are additive precisely so those readers keep working unmodified, and it ran after both to avoid shared-file tangles in `kit-goal-stop.js` and the skill. (One-way pointers; both archived and immutable.)
- `docs/backlog.md`, item "AI OS: consume `~/.claude/kit-events.jsonl` for notifications (2026-07-25)": the goal-event consumer contract lives in `architecture.md` and this plan touches emission cadence (per-plan releases within one armed queue). Changes are additive (existing event names, fields, and detail values unchanged; a queue emits one `goal-complete` per finished plan), and the contract prose is updated in the same section that changes the behavior.

## Context

Decided 2026-08-16 with Scott. Two frictions, one surgery:

**Multi-plan runs are armed by a workaround that silently loses the leash.** To run several plans in sequence, the operator wraps them in a native `/goal` prompt that tells the session to arm `/kit-goal` per plan. Observed live on 2026-08-16: the session runs the arm CLI via Bash, which arms the goal unbound, and nothing ever claims it, because the claim signal is the user-typed `/kit-goal` invocation's `<command-args>` markup in the transcript and CLI stdout never claims (`kit-goal-stop.js`, `userCommandArgsClaimPlan`; the skill states the rule). The run is then held only by native `/goal`'s per-turn LLM evaluator, and the boundary-gated compaction gate never engages (its clause 4 requires the leash-bound session), so compactions land mid-section. Native queue support fixes this at the root: one user-typed invocation naming every plan both binds the leash and carries the sequence.

**A sibling discussion session gets confused by the armed goal.** The SessionStart armed-goal notice (`session-start.js`, the `goalArmed` block) is deliberately project-wide, because visibility is the crash-recovery mechanism, but it is undifferentiated: a discussion session started beside a working run is told "a kit goal is armed" with nothing saying whose it is, and can conclude the plan is its business. The enforcement side is already session-scoped (a bystander is never leashed); the framing is what lacks the session dimension.

Decisions recorded from the design conversation:

- **`BLOCKED:` mid-queue records and advances (decided 2026-08-16).** This matches the operator's existing manual pattern: run each plan to Complete or BLOCKED, then continue to the next; the final summary names every plan's outcome. Halt-everything remains available as the degenerate case of arming one plan.
- **Bystander framing, not suppression (decided 2026-08-16).** A non-bound session must still be told a goal is armed (a crashed run's rescue depends on it); it must also be told the leash belongs to another session and the plan is not its business.
- **One binding rides the whole queue.** The queue advance preserves `boundSession`, so the session that claimed the arming stays leashed across every plan in the sequence without re-arming.

Code facts this design stands on (all read 2026-08-16 from the working tree):

- Goal state today: `{ plan, condition, armedAt, boundSession }`, written atomically by `armGoal` / `bindSession` in `kit-goal-lib.js`; `composeCondition(planRel)` is the single source of the condition text; `emitGoalEvent` sanitizes and appends to the event stream.
- The Stop hook's allow order (`kit-goal-stop.js`): no-goal hot path; session scoping with the unbound-claim via `userCommandArgsClaimPlan` (which scans every `<command-args>` span of `/kit-goal` invocations for the current plan path with `includes`, so an invocation carrying several paths already satisfies the claim for any of them); clause (a) Complete-or-archived with clear-then-emit exactly-once keyed on `clearGoal().cleared`; clause (b) `BLOCKED:` with the capacity refusal; clause (b2) `WAITING:`; else block.
- The concurrency posture is single-writer through the one bound session (bystanders return before any write), the same assumption the compact gate's checkpoint consume documents.
- Two other readers of the state file exist or are specced: `kit-compact-gate.js` (clauses 3-4 read `plan` and `boundSession`; the checkpoint match compares `cp.plan === goal.plan`, so a queue advance correctly retires an open checkpoint as `wrong-plan` at the plan boundary) and the stop-failure watcher (armed plan plus `boundSession`). Keeping those two fields' meanings intact is a hard compatibility constraint.
- The CLI (`kit-goal.js`) parses `const [cmd, arg] = process.argv.slice(2)`: `arm` takes exactly one positional today.
- SessionStart hook payloads carry `session_id` (probed operator-tier fact), so the notice can compare the starting session against `boundSession`.

## Goal

`/kit-goal <plan1> <plan2> ...` arms an ordered queue in one typed invocation: the leash binds once and holds the session through every plan in sequence, advancing on each plan's terminal state (Complete auto-advances; `BLOCKED:` records the blocker and advances; the last plan's terminal state releases as today), with per-plan outcomes recorded in the state and one `goal-complete` event per finished plan. The native `/goal` wrapper becomes unnecessary for plan sequences. Separately, the SessionStart armed-goal notice becomes bound-session-aware: the bound session is reminded the leash is its own, a bystander is told plainly the leash belongs to another session and the plan is not its business, and an unbound arming keeps today's claimable framing, with a liveness hint from the bound transcript's mtime so a dead run reads differently from a working sibling.

## Approach

**State shape: additive, `plan` stays "the current plan".** The state gains `queue` (the ordered array of repo-relative plan paths, as armed), `queueIndex` (the current position), `history` (one entry per finished plan: path, outcome `complete` | `archived` | `blocked`, ISO timestamp), and `boundTranscript` (set at claim time; see framing below). `plan` continues to hold the current plan and `boundSession` the leash holder, so the compact gate, the stop-failure watcher, and any older code read the queue-armed state correctly with no changes. A legacy state file without `queue` is read as a queue of one. `composeCondition` stays the single source of the condition text and gains the queue context (the remaining sequence, and that each plan runs to Complete or a recorded `BLOCKED:` before the next).

**CLI: variadic arm, queue-aware status.** `arm` accepts one or more plan paths: each is validated exactly as today (normalize, exists, not already Complete), duplicates are refused, and the whole arm is refused if any path fails, with the reason naming the offender (no partial queues). `clear` is unchanged. `status` reports the current plan, the remaining queue, per-plan `Status` heads, recorded history outcomes, and the binding: which session holds the leash or that it is unbound, plus the liveness hint when `boundTranscript` is readable.

**Stop hook: terminal states advance; only the last releases.** The enforcement clauses keep their exact order and semantics per plan; what changes is what a terminal state does when plans remain:

- Clause (a), current plan Complete or archived, plans remaining: append the history entry, advance (`queueIndex` plus one, `plan` to the next, fresh `condition`, `boundSession` and `boundTranscript` preserved) in one atomic state rewrite, emit `goal-complete` for the finished plan (existing `detail` values `plan-complete` / `plan-archived`), then **block** the stop with an advance reason: the finished plan by name, the new current plan by name, and the instruction to continue it per executing-work. On the last plan: today's clear-then-emit-then-allow, with the history riding into nothing (the state file is removed, as today; the session's own closing summary is the operator-facing record, per the skill).
- Clause (b), `BLOCKED:` lead, plans remaining: emit `goal-blocked` (as today), append the history entry with outcome `blocked` and the first line of the block reason (sanitized, capped) for the final summary, advance the same way, and **block** the stop with a reason naming the recorded blocker and the new current plan. On the last plan: today's allow-without-clearing. The capacity refusal is unchanged and runs before any of this, per plan.
- Clause (b2) `WAITING:` and the else-block are unchanged.

Exactly-once for the advance path cannot key on `clearGoal().cleared` (nothing is cleared mid-queue); it keys on the single-writer reality instead: only the bound session's stops reach these clauses, its stops are serial, and the advance is one atomic rewrite, so a duplicate emit requires a concurrent writer that the binding already excludes. State that assumption in a comment beside the advance, matching the checkpoint-consume precedent. A failed advance write degrades to re-running the same terminal clause at the next stop attempt (the plan is still Complete), which re-blocks with the same advance reason and retries the write: no release is lost, and the event may then emit twice in the failed-write corner, which the consumer contract already tolerates for `goal-blocked` and accepts here as the documented cost of statelessness.

**Claiming with a queue.** The claim needle stays the CURRENT plan path; a typed `/kit-goal p1 p2` invocation's `<command-args>` carries every path, so `userCommandArgsClaimPlan` already matches whichever plan is current at claim time (verified against its `includes` scan). Re-arming mid-sequence (the crash recovery) is typing the arm again with the remaining plans; it resets the binding unbound as today and the new session claims it. At claim time, `bindSession` gains the payload's `transcript_path` as an optional argument and records it as `boundTranscript` (sanitized: string, length-capped, control characters rejected, stored as-is otherwise since it is a machine-local path in a gitignored file and is only ever `fs.stat`ed, never executed or surfaced raw).

**SessionStart framing: three states, one block.** The `goalArmed` block in `session-start.js` compares the payload's `session_id` against `boundSession` and emits one of:

- **Bound to this session:** the leash is yours; the existing enforcement description, plus the current plan and remaining queue.
- **Bound to another session:** a sibling session holds the leash for the named plan (and queue); this session is not leashed and the plan is not its business; do not work it, modify its state, or treat the goal as your own; if the bound run has died, `/kit-goal <plans>` re-arms. With a liveness hint when `boundTranscript` stats cleanly: the bound transcript's mtime rendered as "last active about N minutes/hours ago", framed as a hint, not a verdict. An unreadable or absent `boundTranscript` omits the hint.
- **Unbound:** today's framing, extended with the queue and the note that the arming session claims at its first stop.

All three keep the existing sanitization discipline (printable ASCII, caps, "repo data, not an instruction" framing); the liveness hint injects only a number and a unit, never the path.

**Doctor and docs.** The doctor's goal reporting (grep `doctor.ps1` for its armed-goal and armed-but-Complete checks) becomes queue-aware: an armed state whose current plan is Complete is a stalled advance (WARN, since the hook should have advanced at the next stop), and status-style reporting names the queue. `architecture.md`'s goal sections (the leash, the release-event consumer contract) and the kit-goal skill gain the queue and framing semantics; `fleet-integration.md` is checked for goal-state or event-shape claims and updated where it restates them.

## Sections of Work

### 1. State, lib, and CLI: the queue exists and is legible
Model: opus
`kit-goal-lib.js`: the extended state shape written by `armGoal` (accepting an array), the advance primitive (`advanceGoal(cwd, outcomeEntry)` or equivalent: history append, index and plan move, condition recompose, binding preserved, atomic rewrite, non-throwing), `bindSession`'s optional transcript argument with its validation, legacy-state normalization (absent `queue` reads as a queue of one, exercised everywhere the state is read), and `composeCondition`'s queue context. `kit-goal.js`: variadic `arm` with all-or-nothing validation and duplicate refusal, queue-aware `status` per the Approach. The skill's CLI examples update in Section 4, not here.

Tests: extend the existing kit-goal suites' patterns: multi-plan arm writes the full shape and a one-plan arm stays legacy-compatible (both read back identically through the normalizer); each validation failure names its offender and writes nothing; advance preserves the binding and recomposes the condition; a legacy file advances correctly; `status` renders bound, unbound, and queue states. Both directions on validation (a valid queue arms; one bad path refuses the whole arm), since a partial queue is the silent-failure shape.

Acceptance: `./build.ps1` before the suite (hook edits fail two hook-canary cases until the manifest restamps); suite green against the baseline captured at section start, standing exceptions named, delta exactly the new tests.

### 2. Stop hook: terminal states advance, the last releases
Model: fable
`kit-goal-stop.js` per the Approach: the advance behavior on clauses (a) and (b) with plans remaining, the last-plan behavior unchanged, the capacity refusal untouched and per-plan, the advance-reason block texts (finished plan, recorded blocker where applicable, new current plan, the executing-work instruction, the sanitize-before-print discipline), the exactly-once comment beside the advance, and the failed-write degradation (re-block, retry next stop). Claim path: pass `transcript_path` into `bindSession`.

Tests: both directions of every new behavior, because a silent wrong-way leash is the expensive failure: mid-queue Complete advances, emits once, and blocks with the advance reason; last-plan Complete clears, emits, allows; mid-queue `BLOCKED:` records the entry, emits `goal-blocked`, advances, blocks; last-plan `BLOCKED:` allows without clearing; capacity-shaped `BLOCKED:` still refuses on every queue position; `WAITING:` still allows with the state untouched at every position; a bystander session is untouched by all of it; a legacy single-plan state behaves exactly as the pre-change suite expects (the existing tests keep passing unmodified, which is itself the compatibility gate); a failed advance write re-blocks rather than releasing. Mirror the existing `test/kit-goal-stop.test.js` fixture patterns.

Live validation, because a green suite proves exit codes and JSON, not harness behavior: a throwaway repo with two scratch plans armed as a queue, the binding established the way the existing live probes do it, driving a real cheap session: flip plan 1 to Complete and observe the advance block naming plan 2 with the session continuing, then flip plan 2 and observe the clear, the allow, and both `goal-complete` events in the (test-gated `KIT_EVENTS_PATH`) sink. Record observations in the Chapter.

Acceptance: build restamp, suite green against baseline with the delta exactly the new tests, live observations recorded.

### 3. SessionStart framing: bound, bystander, unbound
Model: opus
`session-start.js`: the three-state `goalArmed` block per the Approach, the liveness hint from `boundTranscript`'s mtime (stat wrapped, absent on any error), queue rendering (current plan plus a count or short list within the existing caps), sanitization discipline unchanged. The block remains additive: any error in the new logic degrades to the current generic notice or to silence, never to a broken SessionStart.

Tests: the hook's existing test patterns: each of the three framings renders from a fixture state and a matching or mismatched payload `session_id`; the bystander text names the not-yours instruction and the re-arm path; the liveness hint appears with a fresh mtime, ages correctly, and is absent when the transcript path is missing or unreadable; a legacy state (no queue, no `boundTranscript`) renders the unbound and bound framings without error; injection discipline: a hostile plan path or session id in the state file reaches the output only through the existing sanitizers.

Acceptance: build restamp, suite green against baseline, delta exactly the new tests.

### 4. Skill, doctor, and docs
Model: opus
- `skills/kit-goal/SKILL.md`: the variadic arm syntax and queue semantics (advance on Complete and on `BLOCKED:`, last-plan release, one binding for the sequence, re-arm with the remaining plans as the recovery), the bystander framing in the "How the leash holds" prose, and the note that the native `/goal` wrapper is unnecessary for plan sequences. The canonical condition text remains owned by `composeCondition`; the skill keeps not restating it.
- `doctor.ps1`: the armed-goal reporting becomes queue-aware and the stalled-advance WARN is added per the Approach (locate the existing armed-goal checks by grep; follow their reporting shape).
- `docs/architecture.md`: the goal leash and goal-release-event sections gain the queue (per-plan `goal-complete`, advance blocks, history), stated as additive to the consumer contract; `docs/fleet-integration.md` checked for restatements and updated where found; `docs/security-model.md` checked for goal-state claims (the new fields are the same provenance and the same guards; say so where the state file is described).
- `docs/backlog.md`: the AI OS events-consumer item gains one sentence noting the per-plan emission cadence under a queue, so the consumer owner sees it.

Tests: the doctor change gets a check-mode run on this machine; docs changes ride the finishing reviews.

Acceptance: doctor check-mode run completes showing the queue-aware reporting; greps for the new state fields (`queue`, `queueIndex`, `history`, `boundTranscript`) hit the intended surfaces only; the skill's examples match the shipped CLI exactly.

### 5. Close-out (finishing-work)
Finishing pass: qa-verifier, security review (enforcement-hook and state-shape surgery: not prose-waivable), final adversarial review, docs-curator, then curating-docs archival. Memory: log the effort outcome; stamp any applied memories; write nothing speculative to the operator tier (this effort rests on kit-owned code, not new harness facts) unless the live validation surfaced one; run the unstamped adjudication and decay checks per finishing-work.

## Out of Scope

- Parallel plan execution (the queue is strictly sequential; parallelism lives inside a plan run, per the arming request).
- Changing the native `/goal` feature or the relay's inability to execute slash commands (the queue removes the need; it does not touch either).
- Suppressing the armed-goal notice for bystanders (framing, not suppression, was the decision).
- Event-stream shape changes beyond the additive cadence (no new event names or fields; the AI OS consumer is coordinated through the backlog note, not this plan).
- Cross-directory queues (every plan in a queue belongs to the arming project).
- Queue editing commands (append, reorder, skip): re-arm with the desired remainder is the mechanism; build editing only if real use demands it.

## Operator Verification

- Arm a real two-plan sequence with one typed `/kit-goal <p1> <p2>` and let it run: the session advances from plan 1 to plan 2 without any retyped arming, the closing summary names both outcomes, and `/kit-goal status` mid-run shows the queue with the leash bound to that session. A run that stalls at a Complete plan 1 without advancing reopens Section 2.
- Start a discussion session beside a bound run: its session-start notice names the leash as another session's with the not-yours framing and a plausible liveness figure, and the discussion session does not adopt the plan. A bystander session still treating the plan as its own reopens Section 3's framing text.

## Open Questions

- Whether the advance-reason block text alone reliably redirects a session into the next plan's executing-work loop, or whether the condition text needs strengthening: judged on the first real queue run (the operator-verification item above); wording, not mechanism, is the expected knob.

## Chapters

### Chapter 1: Section 1, state, lib, and CLI (2026-08-16)

Completed: 1. State, lib, and CLI: the queue exists and is legible
Commit Model: Commit-and-Push

**The compatibility constraint shaped the whole design, and it held.** Two readers outside this plan depend on `plan` meaning "the current plan" and `boundSession` meaning "the leash holder": `kit-compact-gate.js` and the stop-failure watcher shipped earlier today. Both were opened and confirmed to read only that pair (`kit-compact-gate.js:335-345`, `stop-failure-watcher.ps1:262-266`), and neither was touched, because the queue fields are strictly additive and `plan` still names the current plan at every position.

**Normalization went into `readGoal` rather than into call sites**, which is the decision Sections 2 and 3 inherit for free: every read yields `queue`, `queueIndex`, `history`, and `boundTranscript` with the invariant `queue[queueIndex] === plan`, and a pre-queue file normalizes to a queue of one. A queue that disagrees with `plan`, a non-array `history`, and a control-character `boundTranscript` all normalize the same way rather than propagating a malformed shape.

**`composeCondition` appends the queue tail only while plans remain**, so a solo arm and the last plan of a queue produce byte-identical text to what shipped before. That is why the suite's one verbatim condition pin passes unmodified rather than needing an update, which is the better outcome: a pin that has to change with every edit stops being a pin.

**One existing test was changed, deliberately and named:** the schema pin asserting `Object.keys(state).sort()` equals the four-key shape. The spec widens that shape on purpose, so the pin was extended to the eight keys and given assertions that a one-plan arm reads back as a queue of one. Every other existing test is untouched, which is itself the compatibility gate.

**Two design calls made on spec silence, recorded rather than reconciled.** `advanceGoal` writes nothing on the last plan and reports `advanced: false`, leaving the clear-then-emit-then-allow to Section 2 rather than persisting a final history entry into a file about to be deleted. And `bindSession` upgrades a legacy state file to the normalized shape on first bind, which is additive since nothing reads the file expecting those keys to be absent.

**Gate:** 866 tests, 864 pass, 2 fail, against the 851/849/2 baseline. Delta exactly +15 new tests, same two standing `memq-shim` exceptions by name. Re-run by the orchestrator after the implementer reported, not taken on report. Red/green probes on the two load-bearing tests (legacy compatibility, all-or-nothing validation), restored from pre-probe copies verified by md5 `fa2fb584dce9ecf6f4dbb08e881dfa6b`.

**Next:** Sections 2 and 3 in parallel. They touch disjoint files (`kit-goal-stop.js` and `session-start.js`) and both consume Section 1 through the normalizer rather than reaching into it, so they can build simultaneously. Each runs only its own test file during red/green probes so neither sees the other's mid-probe tree; the orchestrator runs the full suite once both land. Their reviews batch into one pair over Sections 1 to 3 as a single changeset, since serializing per-section reviews would cost exactly the wall-clock the parallel build buys, and the three sections are one state-shape surgery whose seams read best together.

### Chapter 2: Section 2, the Stop hook advance (2026-08-16)

Completed: 2. Stop hook: terminal states advance, the last releases
Commit Model: Commit-and-Push

**Built in parallel with Section 3.** The two sections own disjoint files and both reach Section 1 only through `readGoal`'s normalizer, so they ran simultaneously with each implementer scoped to its own test file. That scoping is the load-bearing part: a red/green probe mutates the tree, so two implementers running full-suite probes in one worktree would each have poisoned the other's green. The full-suite run was reserved for the orchestrator once both landed.

**The advance is one helper, and its exactly-once assumption is written down.** `advanceAndHold` records the outcome through `advanceGoal`, emits the finished plan's `goal-complete` where the clause has one, and writes the advance block. The comment above it mirrors the checkpoint-consume comment at `kit-compact-gate.js:354-359`: single-writer today, and a future concurrent writer breaks it. The failed-write path degrades to re-blocking rather than releasing, so a write that does not land costs a retry on the next stop instead of a silently unleashed session.

**The capacity refusal and the `WAITING:` clause were left strictly alone and are now tested at every queue position.** They run before any advance logic, which is the ordering the spec wanted: a capacity-shaped `BLOCKED:` must not become a way to skip a plan, and a wait must leave the state untouched wherever the queue stands.

**Live validation ran against a real driven session, and it surfaced a finding the suite could not.** The rig needed an isolated `CLAUDE_CONFIG_DIR`, because the installed plugin cache carries the pre-queue Stop hook: an ordinary session on this machine would have run the old hook alongside the worktree one and raced a `clearGoal` against the advance. Under isolation, a two-plan scratch queue behaved exactly as specified: an unbound goal allowed the stop untouched, the bound session advanced on plan 1's Complete with one `goal-complete`, blocked with the advance reason, and **the model obeyed it**, reading plan 2 on its next turn; plan 2's Complete cleared the state, emitted, and allowed. The sink held exactly two events, one per finished plan. One incidental confirmation: the harness records a block reason as an `isMeta` user entry plus an attachment, both already excluded by the claim predicate, so an advance reason naming plan paths cannot self-claim a bystander.

**Gate:** `kit-goal-stop.test.js` 53 to 64, exactly +11, all 53 pre-existing tests passing unmodified, which is the compatibility gate. Red/green both directions: forcing `plansRemain` false (the pre-change behavior) failed exactly the five advance tests and left capacity, `WAITING:`, bystander, legacy, and all 53 originals green; making the capacity refusal advance failed exactly the capacity test. Restored from pre-probe copies verified by md5, never `git checkout`.

**Next:** Chapter 3 covers Section 3, built in the same window.

### Chapter 3: Section 3, the SessionStart framing (2026-08-16)

Completed: 3. SessionStart framing: bound, bystander, unbound
Commit Model: Commit-and-Push

**The block now answers "is this mine?" before it answers "what is armed?"** A bound session gets the queue and its position; a bystander gets the leash named as another session's, with an explicit not-yours instruction (do not work it, do not modify its goal state) and the re-arm path for the case where the bound run has died; an unbound goal reads as before. The liveness hint is derived from `boundTranscript`'s mtime and emits only a number and a unit, never the path, so a hostile path in the state file cannot ride out through the hint.

**Everything degrades toward the old notice rather than toward silence or an error.** The stat is wrapped and absent on any failure, the queue clause caps its list at five plans plus a counted remainder, and every interpolation goes through the existing sanitizer.

**One path was resolved on spec silence, and it is the concern worth naming:** an armed-and-bound goal beside a payload carrying no `session_id`. There is no way to tell "mine" from "another's" there, so it degrades to the undifferentiated notice, mirroring the absent-session-id handling already documented at `docs/security-model.md:162`. The alternative, defaulting to the bystander framing, would tell a session it is not leashed when it may well be, which is the more expensive wrong answer.

**The kit-goal skill pointer was deliberately omitted from the bystander block.** A bystander is being told to leave the plan alone; pointing it at the skill that arms plans works against that.

**Gate:** new `test/session-start-goal.test.js`, 18 tests, sibling to the existing `session-start-kaizen` / `-backlog` / `-external-engine` files, which stayed at 4/16/4 pass and unmodified. Red/green probes on the bystander framing and on the liveness fail-soft, md5 `b9554ae201eef28c32684ec6a9b504bd` before and after each restore.

**Full suite across Sections 2 and 3:** 895 tests, 893 pass, 2 fail, against the 866/864/2 baseline. Delta exactly +29 (Section 2's +11, Section 3's +18), same two standing `memq-shim` exceptions by name. Run by the orchestrator after both implementers reported, not taken on report.

**Next:** the batched adversarial and blind reviewer pair over Sections 1 to 3 as one changeset (base `e138399`), then Section 4, the skill, doctor, and docs surfaces.

### Chapter 4: Section 4, the skill, doctor, and docs (2026-08-16)

Completed: 4. Skill, doctor, and docs
Commit Model: Commit-and-Push

**Built in the main thread while the Sections 1 to 3 reviewers read the committed diff.** Its surfaces are disjoint from what they review (a skill file, the doctor, four docs), so the two ran in parallel rather than in sequence.

**The doctor gained the queue and a stalled-advance WARN, and it reads the state file defensively rather than trusting the normalizer.** `readGoal` guarantees `queue[queueIndex] === plan` on every read, but the doctor reads the raw file, and a hand edit is exactly the case it exists to catch, so a queue that disagrees with `plan` is discarded in favour of the legacy single-plan reading. That also means a pre-queue state file needs no special case: it takes the same path.

The WARN split is the substantive change. A terminal current plan used to be one thing, a stale goal to clear. Under a queue it is two, and they want opposite advice: with plans remaining it is a stalled advance, which is *normal* mid-turn (the hook advances at the bound session's next stop) and means a dead run otherwise, so the advice is to re-arm with the remainder; on the last plan it is the old stale goal, and the advice is still to clear it.

**All four branches were verified by running the real doctor, not by reading the code.** Against this repo (check mode, exit 0) the live legacy arming renders `Armed for ... (active)` with no queue lines, which is the compatibility case. Against a scratch clone under the scratchpad, carrying a synthetic three-plan queue: position and remainder render; a Complete plan at index 0 draws the stalled-advance WARN naming two remaining plans; the same plan at the last index draws the stale-goal WARN with the clear advice; a legacy state and a corrupt state whose queue disagrees with `plan` both fall back to the single-plan reading. The scratch tree was deleted afterward, and this repo's live `.kit/goal-state.json` was never written.

**The event contract's exactly-once claim needed a real correction, not an addition.** `architecture.md` said a `goal-complete` is exactly-once because the emit is gated on the clear that removed the state. Mid-queue there is nothing to clear, so that sentence was simply false under a queue. It now states both positions and names the one accepted exception: an advance whose write fails re-runs the clause at the next stop and may emit twice, accepted because the alternative is a lost release.

**The security model had no goal-state section at all, and `boundTranscript` is the field that earned one.** It is the only field naming a path outside the project. The section states what bounds it: recorded sanitized at claim time, only ever `fs.stat`ed, and reaching the model as a number and a unit rather than as the path, so the FIFO-hang concern governing transcript reads elsewhere does not arise because the path is stated rather than opened. It also names what the atomic advance does not have, a lock, and that the single-writer guarantee is the session binding.

**Acceptance:** greps for `queueIndex` and `boundTranscript` outside `test/` hit exactly seven files, all intended: the lib, the CLI, the Stop hook, SessionStart, the doctor, `security-model.md`, and this plan doc. `architecture.md` is not among them and describes the same behavior without naming the fields, which is the right split for a document read as an overview. The skill's `arm <plan path>...` example matches the arity and the variadic marker of the CLI's own usage string at `kit-goal.js:25`, which spells the placeholder `<planPath>...`; the two agree on the contract and differ in the placeholder's casing, and the skill keeps prose spacing because it is read as prose. Suite 895 tests, 893 pass, 2 fail, unchanged from Chapter 3 as expected for a section that adds no tests, same two standing `memq-shim` exceptions.

**Next:** Section 5, the finishing pass, once the Sections 1 to 3 reviewer findings are triaged.

### Chapter 5: Review remediation over Sections 1 to 4 (2026-08-16)

Commit Model: Commit-and-Push

No section closes in this Chapter. It records the batched adversarial and blind review over Sections 1 to 3 (base `e138399`) and the remediation it earned, which reached Section 4's surfaces too.

**Fourteen findings, and the two that mattered were the same defect seen from opposite ends.** Both reviewers, independently and without sight of each other, landed on `kit-goal-stop.js`'s clause (b). The adversarial one drove it to a repro in an isolated scratch repo: a three-plan queue, a bound session, and one unchanging transcript whose last assistant turn led with `BLOCKED:`. Stop 1 advanced plan 1 to plan 2 and recorded plan 1 blocked. Stop 2 advanced plan 2 to plan 3 and recorded plan 2 blocked. Stop 3 allowed the stop. The whole armed queue consumed off one blocker, two plans marked blocked that were never opened.

**The defect's own confession was sitting in the file.** `kit-goal-stop.js:282-284` already said a lead "can come from a stale snapshot whose previous turn led with a release prefix, a residual race with no cheap read-side fix, accepted because it fails open," and the retry-schedule comment at 249-254 records that racing append as observed live. That acceptance was sound while a `BLOCKED:` lead ENDED the session: there was no following turn to misread. Section 2 made the same read perform a destructive state transition and then block the stop, which guarantees a following turn. The premise under the comment was removed and the comment was left standing, which is the general lesson worth carrying: when a read's consequences change, every justification written against the old consequences has to be re-read, not just the code.

The fix keys the advance to the transcript entry that produced it. The lead now carries an identity (`uuid:` when the entry has a usable one, `text:` plus a digest when it does not), the advance persists it as `blockedAdvanceKey`, and a lead whose key is already spent falls through to the ordinary hold: it never advances, never emits, and never releases. Clause (a) was checked and needs no key, because the plan file's `Status` is re-read fresh at every stop and is itself the guard.

**The second finding is one this effort would not have caught by looking at its own diff.** The stop-failure watcher shipped earlier the same day builds its resume prompt from the goal state's `plan` alone, and `armGoal` replaces the whole state with a fresh queue of one. So an unattended queued run that died on a retryable API error would have been auto-resumed armed for its current plan only, finishing it, releasing, and losing plans 2 through N with no signal anywhere. Chapter 1's compatibility claim was true and was checked only against the watcher's READ path; the defect lives in its WRITE path, which nobody thought to look at because the watcher does not appear to write goal state at all. It re-arms, and re-arming is a write. The prompt now carries the queue's remainder, every path validated and required to exist exactly as the single path was, truncating at the first failure rather than stepping over it (a prefix of an ordered queue is still a sequence that was armed; a gapped one is not), and bounded at 1024 characters, below the `cmd.exe` argument limit a `.cmd` shim would impose.

**Nine smaller fixes, each with a regression test:** a compare-and-swap on the advance, since the CLI is a writer the session binding does not exclude and a re-arm landing inside the hook's retry sleep would otherwise advance state the caller never saw; `status` no longer dies with a stack trace on a state file that parses but carries no usable plan; session identity in the SessionStart notice routes through the shared `sameSessionId` rather than a fourth private rule, which was one case difference away from telling the leash holder that its own plan was not its business; the bound notice states the queue's hold rule instead of the pre-queue release rule; `validTranscript` refuses a network-shaped path, so an `fs.stat` on a dead mount cannot hang a hook that runs at every session start; the liveness phrase is single-sourced, having been implemented twice with different rounding and different crossovers so the CLI and the notice answered the same mtime differently; the advance block reason asserts an advance only when one actually recorded; the duplicate-plan refusal compares case-insensitively on Windows; and `writeState` unlinks its tmp file on a failed rename, mirroring the sibling writer that already did.

**One finding was fixed by choosing between two candidate fixes.** A queue advance changed `plan` out from under an open compaction checkpoint, which is matched against the goal's current plan, and a plan's own close-out opens one immediately before the stop that advances. So the compaction the checkpoint existed to admit was denied at the single largest boundary in the run. The fix rewrites the checkpoint in the Stop hook rather than in the goal library, because the compaction library already requires the goal library and teaching `advanceGoal` about checkpoints would have created a require cycle; the hook imports both and owns the moment.

**Three findings were ruled rather than fixed, and the rulings are the record.** `goal-blocked` is still emitted on a stop the hook then blocks: the event says a plan hit a blocker, which is exactly what an operator wants notified, and the doc's claim that it meant a release is what was actually wrong. The accumulated `history` still dies with the state file at the final release, so mid-queue blocker text survives only in the session's closing summary; closing that needs a new event field or a new sidecar, both of which this plan deliberately scoped out, so it is a documented limitation with a backlog item rather than a silent gap. And a follow-up the remediation surfaced was taken rather than deferred: the unbound and undifferentiated notice branches still stated the pre-queue release rule, so all three branches now compose their hold rule from one shared source that cannot drift.

**Gate:** 923 tests, 921 pass, 2 fail, against the 895/893/2 baseline at Chapter 4. Delta exactly +28 (watcher 10, goal library 8, Stop hook 6, SessionStart 1 from the agents, plus 3 from the shared-hold-rule follow-up), same two standing `memq-shim` exceptions by name. Every gate re-run by the orchestrator rather than taken on report. Red/green in both directions throughout, restored from pre-probe copies verified by md5, never `git checkout`.

**Next:** Section 5, the finishing pass.

### Chapter 6: The finishing pass, and the remediation it earned (2026-08-16)

Commit Model: Commit-and-Push

No section closes in this Chapter. It records Section 5's finishing pass (QA, security, adversarial, docs curation, run as one three-phase workflow) and the second remediation round its findings earned.

**QA passed independently and found the thing that matters operationally.** It reconciled the arithmetic rather than trusting the Chapters (851 plus 72 equals 923) and drove the shipped CLI live against every acceptance criterion. Its one substantive note was outside the diff entirely: no installed plugin cache carries this work, so nothing here is live on any machine until the plugin updates. Verified harder here than reported: `queueIndex` appears zero times in the `kit-goal-lib.js` of all fifteen cached builds, and the session that wrote this Chapter was itself running from a cache three commits behind. That makes updating the plugin the first close-out step rather than a footnote, because a two-plan `/kit-goal` typed against an un-updated cache arms one plan and says nothing.

**The adversarial reviewer found the queue-loss failure again, through a door Chapter 5 did not check.** Chapter 5 taught the stop-failure watcher to re-arm the whole remainder instead of truncating to one plan. The prompt still LED with the current plan unconditionally, and `armGoal` refuses a `Status: Complete` plan all-or-nothing, so the entire remainder is lost. The state that triggers it is the single most likely one for an unattended run to die in: a stalled advance, where the current plan has just been marked Complete and the advance never recorded. The doctor in this same changeset has a dedicated WARN branch for exactly that state, so it is a known-reachable condition rather than a hypothetical. The prompt is now built from candidates: the first plan at or after `queueIndex` whose Status is not Complete, then the remainder, and when nothing survives it composes no prompt at all and records why.

That fix forced a rule the round-one principle did not cover. Chapter 5 established "an ordered prefix, never a gapped list" for a path that fails validation, on the reasoning that stepping over an uncertain entry produces a sequence nobody armed. A Complete plan mid-remainder is the opposite case: it is known-finished work, carrying it would make arming refuse the whole list, and truncating there would drop the genuinely unfinished plans after it for no safety gain. So the rule splits on certainty rather than on position: doubt truncates, proof-of-done skips. The cost is a principle with two cases instead of one, paid down by stating both at the branch.

**The other MAJOR was a block reason that contradicted its own transcript and prescribed the action that defeated the fix.** Chapter 5's spent-lead path fell through to the generic enforcement reason, which reads "the last message did not lead with 'BLOCKED:'" on the one path where it demonstrably did, and then offers restating a blocker as the way out. A model complying writes a NEW entry, with a NEW uuid, which keys differently, is not spent, and advances. The leash's own instruction regenerated the advance the key exists to suppress, one stop later. The spent path now has its own reason: it names the blocker already recorded and the new current plan, tells the session to work that plan, and invites no restatement. Reason-text accuracy is load-bearing here for the same reason Chapter 5 fixed the advance reason: the text is the mechanism's only interface to the thing it steers.

A related prose fix, no mechanism: a cross-cutting blocker ("I need credentials") is true of every plan in the queue, and each restatement is a genuinely new entry the idempotency key cannot slow. The advance reason now tells the session to test whether the recorded blocker actually blocks the new plan before restating it.

**The security review's best finding was about a claim rather than about code.** The new goal-state section grounded the file's whole posture on its being "gitignored and machine-local," and nothing in the kit enforced that a consuming project ignores `.kit/`; the same document already says a repository is a distribution channel across accounts. The queue is what made it worth acting on, taking the payload every session's start notice reads back from roughly 120 characters to roughly 720. The correct mechanism is a nested `.kit/.gitignore` holding `*`, which self-enforces regardless of the root ignore file, and it was not taken: four independent call sites create that directory across three files, which wants one shared helper and a sweep rather than a fourth inline `mkdirSync`, and two other writers held those files. What shipped is a doctor check reporting the state file tracked, untracked-and-unignored, or ignored, each with its fixing command, and the docs now say plainly that the check is the mechanism and the sentence above it is not. Prevention is backlogged with that reasoning.

**Seven smaller fixes, each with a regression test.** The compare-and-swap now compares the arming timestamp as well as the plan, because a re-arm putting the same plan back at the head is the ordinary crash-recovery spelling and passed the plan-only compare. The advance reason names the plan the state actually moved to rather than the pre-advance snapshot's prediction. `advanceGoal` refuses a non-string `plan` instead of throwing, honoring its documented never-throws contract. A clause-(a) advance clears a standing `blockedAdvanceKey` instead of leaving the previous plan's key live. The `/kit-goal` CLI's `status` caps its queue and history rendering at five with counted remainders, matching its two sibling renderers, since the skill echoes that stdout into the session. Every read now re-validates the stored plan and queue entries by round-tripping the normalizer, so no reader can hand an unvalidated path to an `openSync`, which matters because a FIFO would block one and the Stop hook is among the readers. And the shared hold rule is capitalized by a helper rather than by splicing off a hardcoded article.

Two honesty fixes where the right answer was to state the residual rather than close it. `validTranscript` refuses the UNC and `//server` forms and cannot refuse a mapped drive letter, which is indistinguishable from a local disk without the syscall the guard exists to avoid; the comment and the security model now say so. And the round-trip read validation is stricter than the write path in one direction: normalization is platform-dependent, so a state file carried between operating systems reads as malformed. It fails safe, and it is consistent with the file being machine-local to begin with.

**One bonus fix, flagged as such.** `stop-failure-watcher.ps1` launched `powershell.exe` by bare name, resolving through `PATH`, while the sibling `taskkill` call in the same script was already spelled absolutely. Pre-existing rather than introduced here, rated low-exploitability by the reviewer, one line. Reversal: drop the `$powershell = Join-Path ...` line and restore `-FilePath "powershell.exe"`.

**A silent failure the round created, caught and closed.** With a grammar check added beside the existing existence check, an unattended resume gained a second way to drop a queue's tail with no record anywhere, in the one feature whose entire purpose is running when nobody is watching. Every truncation now writes one `queue-truncated` event naming the failing plan, which of the five checks refused it, and how many candidates were dropped. Truncation behavior is byte-for-byte unchanged; only the record is new, proven by a probe that suppressed the emission and reddened exactly the new test while every behavior test stayed green.

**Gate:** 943 tests, 941 pass, 2 fail, against the 923/921/2 baseline at Chapter 5. Delta exactly +20 (goal library 6, Stop hook 4, SessionStart 1, watcher 9), same two standing `memq-shim` exceptions confirmed by name. Every gate re-run by the orchestrator after a clean rebuild rather than taken on report, since two agents built concurrently and the integrity manifest is a shared write. Red/green in both directions throughout, restored from pre-probe copies verified by md5, never `git checkout`.

**Next:** a scoped adversarial review over this round's diff, then close-out.
