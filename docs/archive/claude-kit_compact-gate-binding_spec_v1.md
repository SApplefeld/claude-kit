# Compaction gate binding: claim the leash before the first compaction, not at the first stop

Status: Complete
Commit Model: Commit-and-Push
Disjoint: yes
Created: 2026-08-18

## Problem

The completion leash and the compaction gate are wired in series, and each one's
success starves the other.

`/kit-goal` arms a goal unbound. The binding is claimed at the arming session's
first stop, by the Stop hook (`kit-goal-stop.js:548-553`, the only production
caller of `bindSession`, `kit-goal-lib.js:423`). The compaction gate
(`kit-compact-gate.js`) engages only for the session the goal is bound to, and
its clause 4 (`kit-compact-gate.js:337`) allows an armed-but-unbound goal
outright.

But `executing-work`'s completion contract forbids stopping with unblocked work
remaining. So a run that behaves correctly never stops, never binds, and is
never gated. Confirmed first-hand: a three-plan run in this repo finished with
`kit-goal.js status` reporting `unbound` after several hours and multiple
auto-compactions. The boundary gate never fired once.

The clause-4 allow sits above every other branch, the interactive deferral
included, so the failure is worse than a lost feature. An armed-but-unbound run
compacts at the machine's native early trigger while an ordinary hands-on
session on the same box is deferred to `SAFETY_CEILING_TOKENS`
(`kit-compact-gate.js:173`). Arming a goal currently makes a run's compaction
placement worse than not arming one.

A second-order effect makes the mechanism inert even if clause 4 were merely
bypassed: `sameSessionId` returns false when either side is missing
(`kit-compact-lib.js:75-78`), so a checkpoint written while unbound records
`boundSession: null` and `checkpointMatches` returns `wrong-session` against a
still-null goal. Both halves stay dead until a first stop happens.

## Approach

Claim the binding at the compaction gate, using the same predicate the Stop hook
already trusts. The PreCompact payload carries `session_id` and
`transcript_path` (operator memory `claude-code-precompact-facts`, probed on
2.1.233), and `userCommandArgsClaimPlan` is a pure function of a transcript and
a plan path. A session that shows the user typing the arming command claims the
leash at the first compaction offer instead of at the first stop.

The predicate's exclusions are the anti-steal set already trusted at Stop
(assistant echoes, `isMeta` harness injections, attachments, tool results,
sidechains, local-command stdout, a dir-qualified path match, and a
`<command-name>` that must be `/kit-goal` or end `:kit-goal`), so the gate adds
no new steal surface.

Ruled by a fable consult, which corrected the framing twice. Both corrections
are recorded here because the reasoning, not just the outcome, is what a later
reader needs.

**Alternatives rejected.**

- *Bind at arming time.* The original rejection ("the arm command receives no
  session id") is false: `CLAUDE_CODE_SESSION_ID` is present in the Bash
  environment, and it matches this session's real id (confirmed by comparing it
  against the session's own transcript basename). Rejected on better grounds:
  whether that variable equals the hook payload's `session_id` field is
  unverified, nothing in the repo reads it, and a wrong bind there is severe in
  a new dimension. The Stop hook would classify the real run as a bystander
  (`kit-goal-stop.js:543-547`) and allow every stop, breaking the leash itself
  rather than only its compaction timing. A gate claim binds only on transcript
  proof and cannot fail that way. A further caveat found in this repo's own
  environment: `CLAUDE_CODE_CHILD_SESSION=1` is set alongside it, so the
  variable's meaning inside a subagent shell is unpinned. Parked as a backlog
  item, not built here.
- *Make `sameSessionId(null, null)` true, or have `checkpointMatches` accept a
  both-null pair.* Tempting as a one-liner, and worse than it looks. Any session
  in the project would then take the boundary path against an unbound goal, and
  a bystander's offer could consume (`kit-compact-gate.js:362`) a null-session
  checkpoint the real run had just opened, burning the run's boundary. It also
  re-opens the crashed-run orphan hole the session leg exists to close, since a
  re-arm resets the binding to null.
- *Gate without binding (treat unbound-and-claimed as bound for the verdict
  only).* Writes nothing, but the checkpoint could still never match, so the run
  would be denied to the ceiling with no boundary placement at all.

**The bystander branch is ruled, not deferred.** When a goal is armed, unbound,
and the predicate says this session did not type the arming command, the gate
falls through to the interactive path rather than allowing outright. This is a
facts question: the only argument for today's allow is the clause-4 comment,
which this defect proves wrong, and a bystander to a *bound* goal already gets
the interactive deferral (`test/kit-compact-gate.test.js:259`). Two treatments
for the same bystander, keyed on state it cannot observe, is drift.

**Writing goal state from a PreCompact hook is acceptable.** The gate already
writes on the consume path (`clearCheckpoint`, line 362), `bindSession`
validates its input and never throws, and `writeState` is the same tmp+rename
path every arm uses. The one new failure mode is a persistently failing bind (a
read-only `.kit/`): the run is then denied to the ceiling and allowed there. Not
a wedge, because the valve holds; and a `.kit/` that rejects the bind also
rejects checkpoint writes, so boundary placement was already unreachable in that
world, making deferral-to-ceiling strictly better than today's early trigger.

## Sections of Work

### 1. Share the claim predicate

Model: sonnet

Move `userCommandArgsInclude` (`kit-goal-stop.js:122`) and
`userCommandArgsClaimPlan` (`kit-goal-stop.js:176`), with their comment blocks,
into `kit-compact-lib.js`. Export `userCommandArgsClaimPlan` only;
`userCommandArgsInclude` stays module-local, matching how
`stripLocalCommandOutput` and `commandArgsSpans` already sit there. No test
imports either helper by name today, so the export surface is a free choice and
the narrower one is correct.

`kit-goal-stop.js` imports `userCommandArgsClaimPlan` from `kit-compact-lib.js`
instead of defining it, and its existing note at lines 104-108 (which already
explains that the capped read and the strip live in the lib) extends to name the
predicate too.

No cycle is introduced: `kit-compact-lib.js` requires `kit-goal-lib.js` (line
30) and `kit-goal-stop.js` already requires both (lines 95, 99). The predicate's
only dependencies, `readTranscriptCapped`, `stripLocalCommandOutput` and
`commandArgsSpans`, are already in `kit-compact-lib.js`.

Behavior must not change. This section is a pure move.

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`,
`plugins/claude-kit/hooks/kit-goal-stop.js`.

Tests: the whole existing suite must stay green with no expectation edits, which
is the section's own gate (`test/kit-goal-stop.test.js` has 77 tests over this
predicate's behavior, including the all-spans pin at line 186). Add one direct
unit test of the exported `userCommandArgsClaimPlan` in the compact-lib's test
file if one exists for it, covering a claiming transcript and a non-claiming one
(an assistant echo of the plan path), so the predicate has coverage at its new
home and not only through the Stop hook.

Acceptance: `node --test test/*.test.js` reports the recorded baseline exactly
(954 pass / 2 fail, the two being `test/memq-shim.test.js` environment cases at
lines 420 and 523); `kit-goal-stop.js` contains no definition of either helper;
`kit-compact-lib.js` exports `userCommandArgsClaimPlan`.

### 2. Claim the binding at the compaction gate

Model: opus

Replace the clause-4 outright allow (`kit-compact-gate.js:337`). The armed goal
now resolves to three states against the compacting session:

1. **Bound to this session** (line 345 today): unchanged. Checkpoint, valve,
   `deny-boundary`.
2. **Unbound**: keep the existing no-session-id allow (line 344) ahead of it,
   since a bind is impossible without an id and ambiguity allows. Otherwise call
   `userCommandArgsClaimPlan(transcriptPath, goal.plan)`. On true, call
   `bindSession(cwd, sessionId, transcriptPath)` best-effort and take the
   boundary path against `sessionId` whether or not the write landed, matching
   `bindSession`'s own documented posture that enforcement never depends on the
   write (`kit-goal-lib.js:413-415`). On false, fall through to the interactive
   path.
3. **Bound to another session**: unchanged, interactive path.

Rewrite the clause-4 header comment (`kit-compact-gate.js:50-58`). Its stated
justification, that an unbound armed goal is "almost always the arming session
moments before its first stop claims the binding", is the false premise this
defect disproves, and leaving it would leave the next reader the same trap.

Invariants no new branch may violate, each already load-bearing:

- No deny at or above `SAFETY_CEILING_TOKENS`, and none on an illegible valve
  reading. Both new fall-throughs inherit the valve (lines 366-369, 381-382).
- Checkpoint consumption stays exclusive to the bound-boundary allow (line 362).
  The new bystander path is the interactive path, which never touches the
  checkpoint.
- Fail-open on every axis. An unreadable transcript reads false and lands on the
  interactive path, where it also yields no valve reading, so the verdict is
  `allow`. A throw out of the predicate would escape `main()` to the entry-point
  wrapper and allow outright rather than reaching the interactive path; both
  routes end in an allow, and the predicate wraps its own body so neither is
  reachable today.
- No new steal surface. The gate calls the same predicate the Stop hook claims
  with, single-sourced rather than copied, so neither hook can drift into a
  weaker rule than the other. The predicate was tightened during the review
  round and the Stop hook inherits that tightening, which is the safe direction
  for an authorization check: it can now refuse a claim it would once have
  granted, never the reverse.

Files in scope: `plugins/claude-kit/hooks/kit-compact-gate.js`,
`test/kit-compact-gate.test.js`.

Tests (a floor, extend as implementation reveals):

- Flip `test/kit-compact-gate.test.js:245` ("goal armed but unbound: allow") and
  rewrite its comment, which currently records the prior spec's deliberate
  decision to leave this case alone and the now-disproven reason for it.
- Unbound plus a claiming transcript yields `deny-boundary`, **and** the goal
  file on disk afterwards carries this session's id in `boundSession`.
- Unbound plus a claiming transcript plus a checkpoint recording
  `boundSession: null` still denies. This is correct rather than a wart: the
  checkpoint is `wrong-session`, the compaction defers one more chapter, and the
  next checkpoint, written bound, opens the gate.
- Unbound plus a non-claiming transcript yields `deny-interactive` below the
  ceiling, and `allow` at or above it.
- Unbound plus no session id in the payload yields `allow`.
- A bind that cannot be written still yields `deny-boundary` for that offer
  (fail-open on the write, not on the verdict).

Acceptance: every test above passes; the full suite matches baseline with only
the intended expectation flip at line 245; a manual read of the gate confirms no
code path can reach a deny at or above the ceiling.

### 3. Contract text and backlog

Model: opus
Locus: inline

Every surface that states when the leash is claimed says "at its first stop", and
each is now false. They are one finding in five places, and the set is what the
"name what still speaks the old contract" check returns for this change:

- `plugins/claude-kit/skills/kit-goal/SKILL.md`, the contract text, in two
  sentences.
- `plugins/claude-kit/hooks/session-start.js`, the unbound-goal notice. This one
  is model-facing: it is injected into every session that opens beside an armed
  unbound goal, so leaving it would tell a model a claim rule the hooks no longer
  follow.
- `docs/security-model.md`, the compaction gate's stated verdict table, which
  says an unclaimed armed goal "deliberately does not reach that path and allows
  outright" and after this change means the opposite. Its goal-state concurrency
  paragraph also reasons from a writer set the gate is now a member of.
- `docs/architecture.md`, which repeats the verdict sentence in its own words.
- `plugins/claude-kit/hooks/kit-compact-checkpoint.js` and
  `plugins/claude-kit/scripts/stop-failure-watcher.ps1`, two comments stating
  the binding is the Stop hook's job.

Add a `docs/backlog.md` item for the arm-time binding supplement: confirm
whether `CLAUDE_CODE_SESSION_ID` equals the hook payload's `session_id` (and
what it holds inside a subagent shell), and if so add arm-time binding as a
supplement that shrinks the unbound window to zero. Never a replacement: the
variable can vanish upstream and the gate claim must remain the fallback.

Files in scope: `plugins/claude-kit/skills/kit-goal/SKILL.md`,
`plugins/claude-kit/hooks/session-start.js`, `docs/security-model.md`,
`docs/architecture.md`, `plugins/claude-kit/hooks/kit-compact-checkpoint.js`,
`plugins/claude-kit/scripts/stop-failure-watcher.ps1`, `docs/backlog.md`.

Tests: `test/session-start-goal.test.js` pins the unbound notice's wording and
its expectation moves with the text. Nothing else here is machine-read.

Acceptance: no surface in the repo states the stop-only claim rule; the backlog
carries the dated item; no em dash characters in any changed file.

## Verification

- Full suite at baseline (954 pass / 2 fail, the two known `memq-shim`
  environment cases) after every section.
- The 165 tests across `test/kit-compact-gate.test.js` and
  `test/kit-goal-stop.test.js` are the invariant surface; only the single
  intended flip at `kit-compact-gate.test.js:245` may change expectation.
- Operator-only: none. Observing the gate actually fire on a live leashed run
  would be the end-to-end proof, but it is reachable from a session rather than
  requiring operator access, and the test suite spawns the real hook file.

## Related

- `claude-kit_goal-continuity_spec_v1.md` established the stop-point claim this
  plan supersedes. It is archived and append-only, so the pointer runs one way;
  read its account of the claim as the history of a rule this plan changed, not
  as current behavior.
- `claude-kit_kit-goal-queue_spec_v1.md` made one binding ride a whole queue,
  which is the property the second claim point has to preserve and does: the
  claim happens once, at whichever point comes first, and the leash then advances
  plan to plan under it.
- `claude-kit_interactive-compact-deferral_spec_v1.md` introduced the interactive
  deferral path and deliberately left the unbound case allowing outright,
  recording that decision in a test comment. This plan reverses that call on
  evidence that its stated premise is false.

## Chapters

### Chapter 1 - 2026-08-18
Completed: 1. Share the claim predicate
Implemented By: implementer-sonnet
Metrics: 0 review rounds (see Decisions); NEEDS_CONTEXT 0; escalations 0; consults 1 (at design time, before the spec was written)
Decisions / Surprises:
- The per-section reviewer pair was skipped, under the executing-work clause that makes it optional for a genuinely trivial self-contained section. This is a pure function move with no logic change, and I verified that claim rather than taking it: of the 90 lines removed from the Stop hook, 83 appear byte-identical among the 90 added to the lib, and I read all 7 that differ. They are the import list (which correctly drops `commandArgsSpans`, now unreferenced in the Stop hook, confirmed by grep) and comment lines that said "this Stop hook" or "kit-compact-lib's linear scanner" from the outside and now read correctly from inside the lib. The predicate is a security boundary, so the section still gets the full Fable finishing pass over the whole changeset.
- The implementer regenerated `plugins/claude-kit/.claude-plugin/build-info.json` via `build.ps1`, because `hook-canary.test.js` checks the hook tree against that stamp and any hook edit false-fails it otherwise. The artifact is gitignored and does not appear in `git status`. Worth knowing for any later effort touching a hook file.
- The implementer correctly identified the four files Section 3 was editing concurrently as not its own and left them alone, staging nothing.
Review Findings: none (no reviewers dispatched; see Decisions)
Stamps: adjudicated 1, stamped 1 (`crlf-per-file-in-windows-checkouts`, which steered Section 3's backlog insert into detecting the file's line endings at the insertion point rather than assuming). Two more were stamped ahead of the first section, `claude-code-precompact-facts` and `claude-code-hook-payload-facts`, which together confirmed the design premise that the PreCompact payload carries `session_id` and `transcript_path` and that a session id survives a compaction.
Next: 2. Claim the binding at the compaction gate
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-18
Completed: 2. Claim the binding at the compaction gate
Implemented By: implementer-opus
Metrics: 1 review round (adversarial + blind at fable, security at its default); NEEDS_CONTEXT 0; escalations 0; consults 0 in this section
Decisions / Surprises:
- The implementer extracted the old clauses 5 and 6 into a `boundaryVerdict` helper because two call sites now need them. That is beyond a minimal edit, so I checked it rather than accepting it: the helper is byte-identical to the original logic, checkpoint consumption still requires a match, and the valve still guards the only deny. The claim path sets the in-memory `boundSession` before calling it, which is what makes a checkpoint written while unbound correctly read `wrong-session` and defer one more chapter instead of being consumed.
- The implementer ran its own red/green probe: it reinstated the old allow line in a scratchpad copy and watched 4 of the 6 new tests go red, restoring from the file copy rather than `git checkout`. The 2 that stayed green are invariant pins (allow at the ceiling, allow with no session id), and the adversarial reviewer independently confirmed both fail against a plausible wrong implementation rather than being vacuous.
- Tree-state bracket: `git status --porcelain` captured before dispatching the review round and again when all three returned. No delta.
Review Findings:
- Two Majors, both the same class and both fixed: a surface still stating the superseded contract. The adversarial and blind reviewers independently found `session-start.js`, which is the worst of the set because the notice is injected into the context of every session that opens beside an armed unbound goal, so it would have taught a model a claim rule the hooks no longer follow. The security reviewer found the other two, `docs/security-model.md` and `docs/architecture.md`, where the published gate verdict table said an unclaimed armed goal "deliberately does not reach that path and allows outright" and now means the opposite. The security model is the audit-facing artifact, so that is a change-management defect rather than a documentation nit. All three reviewers correctly attributed the omission to my spec's Section 3 file scope rather than to the implementer; Section 3 has been rewritten to the as-built set and the finding recorded there.
- Two code Minors fixed, each found independently by two reviewers. A non-string `session_id` was reaching `checkpointMatches` through a `String()` coercion, since only falsiness was checked; the ambiguity-allows guard now checks the shape too, which is one line and consistent with the existing posture. And `goal.boundSession` was being set from the raw payload regardless of whether `bindSession` had accepted the value; the shape check upstream is what closes that, keeping the write-failure path at `deny-boundary` where its test pins it.
- One security Minor fixed as hardening rather than a live hole: the claim predicate filtered tool blocks out of an entry block by block, while its two siblings in the same file discard the whole entry. The reviewer measured the gap as unreachable on today's harness shapes (0 of 17,437 local user entries mixed a `text` and a `tool_result` block) and argued it as a second consumer's problem now. Since the predicate is an authorization decision, the stricter sibling reading is the one that belongs on the deciding side, so `userCommandArgsInclude` now discards any entry carrying a tool block, with a test pinning both directions. The blind reviewer's adjacent finding, that `isCompactSummary` entries are user-type but harness-authored and are already excluded by `automationInEffect` on those grounds, is fixed the same way and pinned.
- Two Minors recorded and deliberately not fixed. The re-arm steal window and the clear-resurrection window are both pre-existing races that this change widens in cadence rather than opening: the gate's claim fires per assistant turn past the compaction trigger, where the stop-point claim fired per stop. Both recover by clearing or arming again, and neither is attacker-reachable. The real fix is a compare-and-swap on `bindSession` mirroring the one `advanceGoal` already carries, which changes that function's contract for its other caller, the Stop hook, and deserves its own round rather than riding a gate change. Both windows are now named in the gate header, and the compare-and-swap is in `docs/backlog.md`.
- One spec-accuracy Minor from the adversarial reviewer, fixed in the spec: my stated invariant said a predicate throw "lands on the interactive path", when it would in fact escape `main()` to the entry-point wrapper and allow outright. Both routes end fail-open and the predicate wraps its own body so neither is reachable, but the spec described the wrong mechanism.
- Harness note: the security reviewer's output was flagged as instruction-shaped and its control tags neutralized. Reading the content, the cause is benign and the flag correct to raise: the reviewer quoted a `<system-reminder>` tag shape as evidence while testing whether tool output could satisfy the claim predicate. No embedded instruction, nothing acted on.
Stamps: adjudicated 0, none surfaced in this section's window.
Next: 3. Contract text and backlog
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-18
Completed: 3. Contract text and backlog
Implemented By: main session
Metrics: 0 additional review rounds (its files rode Chapter 2's round); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- The section shipped at more than twice its planned scope, and the spec was wrong rather than the execution. It named two files; the as-built set is seven. The three additions the reviewers found are `session-start.js`, `docs/security-model.md`, and `docs/architecture.md`, and the two I found while fixing those are the comments in `kit-compact-checkpoint.js` and `stop-failure-watcher.ps1`. The lesson generalizes past this plan: "which surfaces state the rule I am changing" is a question a spec should answer by grepping for the rule's own words, not by listing the files the author happened to remember. Correcting my own record here: I never ran that grep before the finishing reviews. Reviewers found each surface one at a time and I fixed what they named, which is why the set kept growing. The finishing pass then found two more, and only then did I run the repo-wide grep, which returned both of them plus two nobody had flagged, in one command. Every hit is fixed and recorded in Chapter 4.
- Section 3's two original files were deliberately held out of Section 1's commit, because both describe behavior Section 2 had not yet shipped and committing them would have put a doc claiming behavior the code lacked on origin for the length of a section.
- A third failure appeared in the suite after the fix round, at `test/session-start-goal.test.js:129`, and it was mine: that test pins the unbound notice's wording verbatim. The notice output was correct and the expectation was stale, so the fix was the test. Recorded because the delta discipline is what caught it: a 2-to-3 change on a run I would otherwise have read as green.
Review Findings: covered in Chapter 2; every finding against this section's files is recorded there.
Stamps: adjudicated 1, stamped 1 (`crlf-per-file-in-windows-checkouts`, which earned its keep twice: four multi-line anchors in the fix round matched zero times against CRLF hook files, and the diagnosis was immediate rather than a hunt for a bad anchor).
Next: finishing-work
Commit Model: Commit-and-Push

### Chapter 4 - 2026-08-18 (close-out)
Completed: finishing-work over the whole changeset
Implemented By: main session, with a qa-verifier, a fable security reviewer, a fable adversarial reviewer, and a docs-curator
Metrics: 1 finishing review round; NEEDS_CONTEXT 0; escalations 0; consults 1 for the whole effort (at design time)
Gates:
- QA verification: PASS. Build clean, suite 962 pass / 2 fail against a 954 / 2 baseline, the two failures identical by name to the baseline (`test/memq-shim.test.js` at 401 and 512). Every acceptance criterion across all three sections verified with evidence, and the spec's claim of no operator-only criteria confirmed correct: the gate tests spawn the real hook file rather than a mock, so every branch including the claim path is exercised in-process. One item came back UNVERIFIABLE and I overturned it rather than accepting it: the verifier reported that no test calls the moved predicate in-process, while its own grep had already found the import. `test/kit-compact-gate.test.js:32` imports `userCommandArgsClaimPlan` and five assertions across three tests call it directly. The criterion is PASS.
- Security review (fable, high), whole changeset: CLEAR, one Minor, fixed. It re-verified all four section-round fixes against the code, re-diffed Section 1's move independently, and confirmed the structural reason the rejected one-line alternative was dangerous: because `boundaryVerdict`'s callers guarantee a non-empty string binding, a null-session checkpoint can never be consumed, so the bystander-burns-the-real-run's-boundary hazard is unreachable rather than merely unlikely.
- Adversarial review (fable, high), whole changeset: APPROVED_WITH_CONCERNS, one Major and two Minors, all fixed. It attacked the five post-review fixes specifically, on the correct reasoning that they were written after the reviews and so had no independent review at all, and all five held. Its Chapter-claim audit checked every "recorded in the backlog" and "named in the gate header" assertion in Chapters 2 and 3 against the files and found no false records.
- Docs curation: one `deviation`, zero `mistake`, so nothing stopped the run. It swept eight claims by claim rather than by changed file and found the docs already correct on seven, having been fixed mid-effort.
- Tree-state bracket: `git status --porcelain` captured before dispatching QA and again when all three review rounds returned. No delta.
Decisions / Surprises:
- Both finishing reviewers independently found the same Major, and it was the same class the effort had already fixed twice: a surface still stating the superseded rule, this time a test comment mirroring the very PowerShell comment Section 3 had corrected. That is three rounds finding the same class one instance at a time, which is the signal that the method was wrong rather than the execution. The generator was that I fixed what each reviewer named instead of asking what the whole set was. Only at the finishing round did I run the repo-wide grep, and it returned both reviewer findings plus two nobody had flagged (`docs/architecture.md`'s watcher-scope sentence, and a second mention in the watcher script the first fix had not reached) in one command. All four are fixed and the grep now returns only correct text.
- The docs curator's `deviation` corrected a factual claim in my own spec. The Approach section said the gate adds no steal surface because the predicate is "the same one the Stop hook trusts, unmodified", and the review round then modified it, strictly stricter, with the Stop hook inheriting the change. The behavior is safer and Chapter 2 records the adjudication, but the spec sentence a later reviewer would check the code against had become false. The invariant now states the single-sourcing as the property and names the tightening and its direction.
- The curator flagged one pre-existing looseness it declined to fix (`docs/architecture.md` saying the gate "consumes it when it allows", where consumption is exclusive to the checkpoint-driven allow) on the grounds that it predates this effort and the security model states it correctly. I agree with leaving it: it is drift this effort did not cause, and rewriting it here would widen the changeset for no correctness gain. Named rather than silently passed over.
- Cross-references added at the curator's prompting: two archived plans, the one that established the stop-point claim this supersedes and the one that made a single binding ride a queue, were unlinked in both directions. The pointers run one way, since the archive is append-only.
Review Findings: 1 Major (stale test comment, fixed), 3 Minors (an index entry stating the old rule in the present tense, an inaccurate cross-reference in a code comment, and the spec's own "unmodified" claim), all fixed. Zero Criticals across every round of this effort.
Stamps: adjudicated 0, none surfaced in the close-out window.
Operator-pending: none from this plan's work. The plugin cache item the previous efforts parked still governs whether any of this reaches a live session, and stays in the backlog.
Gate at close: build clean, suite 962 pass / 2 fail, unchanged failing set from baseline. Zero em dash characters across every changed file.
Next: none. Plan complete and archived.
Commit Model: Commit-and-Push
