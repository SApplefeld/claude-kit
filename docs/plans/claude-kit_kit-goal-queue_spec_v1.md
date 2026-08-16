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

