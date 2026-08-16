# Kit-goal queue: one arming for a plan sequence, and bystander-aware goal framing

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-16

## Related

- `../archive/claude-kit_goal-continuity_spec_v1.md` (archived): built `/kit-goal`, the goal state, and the Stop-hook leash this plan extends. (One-way pointer; archived and immutable.)
- `docs/plans/claude-kit_interactive-compact-deferral_spec_v1.md` and `docs/plans/claude-kit_stop-failure-recovery_spec_v1.md` (active): both read `.kit/goal-state.json` (the compact gate reads `plan` and `boundSession`; the stop-failure watcher will read the same pair), and the recovery plan adds a sentence to the kit-goal skill. This plan's state changes are additive precisely so those readers keep working unmodified, and it runs after both to avoid shared-file tangles in `kit-goal-stop.js` and the skill.
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
