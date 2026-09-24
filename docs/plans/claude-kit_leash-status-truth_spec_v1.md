# The leash reports only a binding it holds, lists every queued plan, and names its checkpoint CLI by path

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-09-23

Session model: the kit worker persona, on the steward's handoff by name; three sections at sonnet. Authored by the architect persona on ASR-CLAUDE from the kit worker's backlog round of 2026-09-23.

## Dispatch Authorization

The kit worker persona sent five ranked backlog candidates to the steward on 2026-09-23. The operator approved all five and the steward relayed the ruling to the architect as coordinator record `ARCHITECT-8d67c288-dd78-478d-a565-e390d50027b0-18`. This plan carries the worker's item 4. The implementer is the kit worker persona, a session that runs this plan under the kit's executing-work skill; the steward is the session that hands it the plan, and the architect is the session that wrote it.

The steward hands this plan to the kit worker persona by name, and that handoff is the assignment. It runs on `origin/main` as it stands and waits on no other plan. It shares `plugins/claude-kit/hooks/kit-goal-lib.js` and `kit-compact-lib.js` with the scratch self-ignore plan and the guards-and-audit plan, in different functions, so whichever lands later rebases on what merged; a plan already merged when this one starts is simply in the trunk it cuts from.

## Goal

The goal library repairs `boundSession` on every read to a value its own bind function would accept or to null, so the goal command's status report, which prints any truthy value as a binding, prints only a binding a session can hold. The session-start armed-goal notice names every queued plan path up to the same line bound the goal command uses and counts only the rest. The Stop hook's boundary directive, its queue-advance reason and the chapter boundary nudge name the checkpoint CLI in the runnable clause the deferral nudge already renders, whose path resolves from any directory, the command itself running from the project directory as the deferral nudge already says.

## Intent

The operator's frame, in the kit worker's words he approved: every leashed run stops showing a false state, and the instruction the model receives actually runs.

Done means a `boundSession` the bind function would refuse, a non-string, an empty string, one carrying a control character or one past the bind function's length bound, reads as null after `normalizeState`, so the comment in `kit-goal.js` at 423-425 becomes true of the shape the writer enforces; the session-start notice lists paths as the goal command's status does; and each model-facing mention of `kit-compact-checkpoint.js`, the `open` and the `status` forms both, is the clause `compact-deferral-nudge.js` renders at 459, `node "<path>" <verb>`, with the path composed from `__dirname` and its home prefix written as `$HOME/` where the file sits under the home directory, as that nudge does.

Done does not need a change to what the status line draws, since it never reads the binding; a change to `sessionHoldsLeash` or the Stop hook's leash test, which already refuse a malformed value; or a session-scoped deferral report, which the backlog keeps as a reporting decision.

Alternatives refused:

- Repairing `boundSession` at each reader. Refused, because the sibling fields are repaired in the normalizer and a reader-side guard is the guard-at-some-sites-only shape the backlog names.
- Raising the session-start fold from five to a larger count of its own. Refused, because a second fold drifts from the goal command's; the shared constant decision 2 exports is the one bound both surfaces read.
- Repairing `boundSession` with `isSessionIdShaped`, the UUID rule `armingSession` takes. Refused at the plan review, because `bindSession` accepts any control-free string up to 128 bytes and seven suites bind ids of that looser shape, so the UUID rule would null every one of them and every real binding the writer accepted.
- Editing the finishing-work skill's boundary paragraph in this plan. Refused, because that paragraph is read by a session that resolves the plugin root by the executing-work ladder, not by a model told to run a command, and a skill edit takes the rationale ledger this plan does not otherwise touch.

Rulings after the spec shipped: none yet.

Provenance: distilled by the architect persona, session `30d6d808-ccad-45e4-a606-c868636ee4e4`, from the kit worker's backlog round and one reconnaissance sweep over the checkout at `8005c9b5`.

## Evidence

Read at `8005c9b5` on 2026-09-23.

- `normalizeState` at `plugins/claude-kit/hooks/kit-goal-lib.js:256-290` repairs `boundTranscript` at 274 and `armingSession` at 280 through `isSessionIdShaped`, the UUID rule at 158-166, and never touches `boundSession`. `bindSession` at 2349-2353 writes any control-free string up to 128 bytes, and the suites bind ids such as `sess-A` and `ses-11112222-aaaa-bbbb-cccc-333344445555` that the UUID rule refuses, across `test/session-start-goal.test.js`, `test/kit-goal-stop.test.js`, `test/kit-compact-gate.test.js`, `test/compact-deferral-nudge.test.js`, `test/chapter-boundary-nudge.test.js`, `test/kit-goal-worktree.test.js` and `test/kit-goal-lib.test.js`. `kit-goal.js:423-427` prints `bound to session <value>` for any truthy `boundSession`, under a comment saying the normalizer guarantees its shape. `session-start.js:494` treats a non-string as unbound. `kit-goal-statusline.js` never reads the field. `kit-goal-stop.js:728-733` and `sessionHoldsLeash` at `kit-goal-lib.js:237` refuse a value that does not match the session. `test/kit-goal-lib.test.js:2814-2815` plants `boundSession: 42` only against `sessionHoldsLeash`.
- `session-start.js:413-416` builds the notice from `remaining.slice(0, 5)` and `, and N more`. `kit-goal.js` lists paths to `QUEUE_LINE_BOUND = 50` at 239, opening at most `QUEUE_OPEN_FILE_BOUND = 5` at 380, at its status render (482-484, 539-543) and at `unauthorizedWarning` (252-261). `test/session-start-goal.test.js:390-403` pins the fold.
- `BOUNDARY_DIRECTIVE` at `kit-goal-stop.js:142-153` names `kit-compact-checkpoint.js open` and `status` bare; the queue-advance reason at 685-686 and `chapter-boundary-nudge.js:119` do the same. `compact-deferral-nudge.js:374` builds `CHECKPOINT_CLI` from `__dirname`, rewrites the home prefix and screens it in `commandClausePath` at 424-446, rendering `node "<path>" open` at 459 through `buildReminder`, which takes the path as an argument so `test/compact-deferral-nudge.test.js:984-997` can inject one; where the screen refuses the path, `buildReminder` names the file bare in prose. `chapter-boundary-nudge.js:100-105` defers its kit library requires into the guard so a damaged library exits 0 silently, and its `REMINDER` at 116 is a module-level constant. `kit-compact-gate.js:744-753` composes its own `CHECKPOINT_CLI` and `GOAL_CLI` for an operator-facing stderr note. `test/kit-goal-stop.test.js` pins the bare substring at 221, 234, 2016 and 2446 and its absence at 2905; `test/chapter-boundary-nudge.test.js` pins it at 178 and 181. `docs/security-model.md:831` enumerates three sites that print a home-anchored path into a model-read channel and names the deferral nudge as the one that elides to `$HOME` for a line meant to be run.

## Decisions

1. `boundSession` is repaired by the bind function's own acceptance rule, exported from the library as one predicate `bindSession` and `normalizeState` both call: a non-string, an empty string, a string carrying a control character or one past the length bound becomes null. Writer and reader share one rule, so no binding is written that the next read would drop, and a hand edit outside that rule reads as unbound everywhere.
2. The line bound moves to `kit-goal-lib.js` as one exported constant both `kit-goal.js` and `session-start.js` read, so the two surfaces cannot drift.
3. The path composition and its screen move from `compact-deferral-nudge.js:374-459` to one exported helper in `kit-compact-lib.js`, which the Stop hook already requires at 124 and the deferral nudge at 833, so the Stop hook, the chapter nudge and the deferral nudge render the same `node "<path>" <verb>` clause. Each of the three texts becomes a function of the CLI path, as `buildReminder` is, exported beside its hook's `require.main` guard so a test calls it in-process with an injected path, while the subprocess cases pin the fragments `node "` and `" open` only, as the deferral suite's `assertHoldDirective` does, since a checkout outside `SAFE_CLI_PATH` legitimately drops the clause; `BOUNDARY_DIRECTIVE` stops being a module-level constant. The helper renders both the runnable clause and the prose fallback the deferral nudge uses for a refused path at 460-461, so each caller carries neither text of its own. In `chapter-boundary-nudge.js` the helper is required inside the guard that emits the reminder, on that file's deferred-require posture, and the file's comments at 31 and 111 calling the reminder a fixed string interpolating nothing are rewritten. A model-facing text "names the CLI bare" where `kit-compact-checkpoint.js` appears outside what the helper rendered; the test predicate is that removing whichever text the helper rendered, clause or fallback, leaves no occurrence. `docs/security-model.md`'s enumeration at 831 is rewritten to name the four sites and the one helper, and its sentence at 855 calling the chapter nudge's output a single fixed string is rewritten to name the one composed value, the CLI path, and the screen it passes.

## Approach

**Coverage sweep.** One sweep ran on 2026-09-23 over `8005c9b5` for `boundSession`, `normalizeState`, `isSessionIdShaped`, `remaining.slice`, `QUEUE_LINE_BOUND`, `kit-compact-checkpoint.js`, `CHECKPOINT_CLI` and `commandClausePath` over `plugins/claude-kit/hooks/`, `plugins/claude-kit/scripts/` and `test/`. Surfaces found are the ones the Evidence lists; every one is placed in a section below or under Out of Scope.

**Build.** A change under `plugins/claude-kit/hooks/` is hashed into the build stamp, so each section's gate runs `build.ps1` at the repository root (`build.sh` on POSIX) before the suite, the step the kit's executing-work skill names for a hooks change.

## Standing Brief Amendments

- **Refused: a payload budget of the notice's own (section 2, review round 1).** The session-start notice takes no character or byte budget beside `QUEUE_LINE_BOUND`. The Intent's refusal of a second fold covers it, because a bound only the notice reads drifts from the goal command's whether it counts rows or characters. Ruled by the scope adjudicator on 2026-09-23 and recorded as drift in Chapter 2.

## Sections of Work

### 1. The normalizer repairs the binding
Model: sonnet

Decision 1: the acceptance predicate lifted out of `bindSession` at 2349-2353 into one exported function, called there and in `normalizeState` beside the `armingSession` line, with the `kit-goal.js` comment at 423-425 reworded to name the bind rule rather than a session-id shape. Sonnet because the sibling line is at 280 and the predicate is the bind function's existing test.

Tests: lock that a state holding a number, an object, an empty string, a string with a control character and a string past the length bound under `boundSession` reads null after `normalizeState`, red against the unchanged normalizer, and that every id the suites bind today, `sess-A` and the `ses-` constant among them, is kept; that `bindSession` and `normalizeState` agree on each of those inputs; and that the goal command's status over a state with `boundSession: 42` prints no binding, in `test/kit-goal-lib.test.js`, which already drives `kit-goal.js status` as a subprocess at 432. No reader function for `boundSession` is added beside `armingSession()` at 180, since every reader takes the field off the normalized state.

Acceptance:
- `bindSession` and `normalizeState` call one exported predicate, the five refused cases read null, and every id the seven suites bind still reads back bound, with `node --test test/*.test.js` green as the proof.
- `kit-goal.js status` over a state with `boundSession: 42` prints no `bound to session` line.
- `node --test test/*.test.js` exits 0 after the build, with the baseline recorded first.

Files in scope: `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/hooks/kit-goal.js` (the comment at 423-425), `test/kit-goal-lib.test.js`, `test/size-budget.json` where the suite's cap moves.

### 2. The session-start notice lists every queued path
Model: sonnet

Decision 2: the constant exported from the library, read at `kit-goal.js:239` and at `session-start.js:413`, where the notice names every remaining path up to it and counts only the rest, opening no document. Sonnet because the shape is the goal command's at 539-543.

Tests: lock that a queue of seven remaining plans names all seven in the notice and counts nothing, red against the unchanged notice by rewriting the existing case at `test/session-start-goal.test.js:390-403`; and that a queue whose remaining tail after the current plan holds fifty-one paths, none opened, names fifty and counts one.

Acceptance:
- `session-start.js` contains no `slice(0, 5)` over the remaining queue, and both files read the one constant.
- The rewritten case's red run is quoted in the Chapter.
- `node --test test/*.test.js` exits 0 after the build.

Files in scope: `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/hooks/kit-goal.js`, `plugins/claude-kit/hooks/session-start.js`, `test/session-start-goal.test.js`, `test/size-budget.json` where the suite's cap moves.

### 3. The checkpoint CLI is named by path where a model is told to run it
Model: sonnet

Decision 3 at the three sites: `BOUNDARY_DIRECTIVE`, whose `open` mention at 147-148 and `status` mention at 149-150 both take the clause, the queue-advance reason at 685-686, and `chapter-boundary-nudge.js:119`, each a function of the CLI path rendering the clause the shared helper composes. The deferral nudge calls the same helper. Each hook exports its render function beside its `require.main` guard; the in-process cases inject a path through it as `test/compact-deferral-nudge.test.js:984-997` does, and the subprocess cases at the pinned lines are rewritten to pin the fragments `node "` and `" open`. The security model's paragraphs at 831 and 855 and the nudge's comments at 31 and 111 are rewritten. Sonnet because `compact-deferral-nudge.js:374-459` is the sibling.

Tests: lock that each of the three texts, rendered in-process with an injected path, contains the helper's clause for its verb and, with whatever the helper rendered removed, no `kit-compact-checkpoint.js`, red against the unchanged text; that with a path the screen refuses the text carries the prose fallback and no clause; that the subprocess-driven hooks emit the two fragments; and that `chapter-boundary-nudge.js` with a damaged library still exits 0 silently.

Acceptance:
- A search over `kit-goal-stop.js` and `chapter-boundary-nudge.js` for the literal `kit-compact-checkpoint.js` finds nothing, since the helper renders it.
- `test/kit-goal-stop.test.js` cases at 221, 234, 2016, 2446 and 2905 and `test/chapter-boundary-nudge.test.js` cases at 178 and 181 read the clause form.
- `docs/security-model.md`'s paragraph at 831 names the four model-facing sites and the one helper that composes their line, and its sentence at 855 names the CLI path as the chapter nudge's one composed value and the screen it passes.
- `node --test test/*.test.js` exits 0 after the build.

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`, `plugins/claude-kit/hooks/kit-goal-stop.js`, `plugins/claude-kit/hooks/chapter-boundary-nudge.js`, `plugins/claude-kit/hooks/compact-deferral-nudge.js`, `docs/security-model.md`, `docs/architecture.md` (folded from section 2's review: its list of the queue line bound's readers), `test/kit-goal-stop.test.js`, `test/chapter-boundary-nudge.test.js`, `test/compact-deferral-nudge.test.js` where its cases pin the clause, `test/size-budget.json` where a suite's cap moves.

## Out of Scope

The surfaces this plan changes are closed at the sections' Files in scope. Named exclusions:

- The status line, which never reads the binding.
- `sessionHoldsLeash` and the Stop hook's leash test.
- The doctor, which reads the raw state file by design; the doctor honesty plan owns its goal step.
- `kit-compact-checkpoint.js status`'s session-unscoped deferral report, kept in the backlog as a reporting decision.
- The finishing-work skill's boundary paragraph.
- `kit-compact-gate.js`'s own `CHECKPOINT_CLI` and `GOAL_CLI` at 744-753, which compose an operator-facing stderr note rather than a model-facing line.
- The UUID rule `isSessionIdShaped` and the fields that take it.

## Assumptions

- assumed 2026-09-23 (source: the repository's plans): the commit model is Branch-and-PR; reversal: one header line.
- assumed 2026-09-23 (the architect): the worker runs under the kit, whose executing-work skill owns the red-then-green rule, the reviewer pair, the hooks build step and the Chapter.
- assumed 2026-09-23 (default): the shared clause helper lives in `kit-compact-lib.js`, which the three callers already require; reversal: a small module of its own.

## Operator Verification

- After the pull request merges and the plugin update is installed, arm a goal in a checkout and read `kit-goal.js status` and the session-start notice: the notice names every queued path, and no binding prints for a session that is not leashed.

## Related

- `docs/backlog.md` entries retired by this plan at its finalize, now in `docs/archive/backlog-2026-Q3.md`: the unchecked `boundSession` (2026-08-29) and the session-start fold (2026-09-22). The Stop hook entry of 2026-08-25 is narrowed to its second half, the session-unscoped report.
- `docs/security-model.md` is shared with `claude-kit_doctor-honesty_spec_v1.md`, `claude-kit_capacity-gate_spec_v1.md` and `claude-kit_jev-recollection-judge_spec_v1.md`, in different paragraphs.
- `claude-kit_kit-scratch-self-ignore_spec_v1.md`: shares `kit-goal-lib.js` and `kit-compact-lib.js`.
- `claude-kit_guards-and-registry-audit_spec_v1.md`: shares `kit-compact-lib.js`.
- `claude-kit_doctor-honesty_spec_v1.md`: owns the doctor's goal step.

## Chapters

### Interim board 1 - 2026-09-23

- State: run started by the plugin supervisor seat, the last of the five paused plans the operator asked it to run. Worktree .claude/worktrees/leash-status-truth on feat/leash-status-truth, cut from origin/main at ca2e574e; the leash is armed for this plan as the run's own arming. Status set from Ready to In Progress.
- The scratch self-ignore plan (PR #104, open, auto-merge held on the operator's ratification of three scope widenings) also changes kit-goal-lib.js and kit-compact-lib.js; whichever lands second merges the other.
- Baseline: a whole gate over ca2e574e from this linked worktree is running before any change; its counts land on the next board. The known baseline fail from a linked worktree is test/kit-sidecar-memory-index.test.js ("loadIndex answers a status, never a throw, for a cwd the store refuses to name").
- memq recall was not run: the operator's standing constraint for this run bars memq against the real ~/.claude.
- Next: record the baseline, dispatch section 1 to implementer-sonnet.

### Interim board 2 - 2026-09-24

- State: the scratch self-ignore plan's PR #104 merged to main at 023ff994, the operator having ratified its three scope widenings on the relay. This branch lands second, so origin/main was merged in at db4e74ee before any section work; the merge was clean.
- Baseline, recorded on the whole-gate lane over the merged tree db4e74ee from this linked worktree, clean tree, no foreign test runner at start, 2026-09-24: 4106 tests, 4097 pass, 1 fail, 8 skipped, exit 1, 507 s. The one fail is the known linked-worktree case in test/kit-sidecar-memory-index.test.js. The pre-merge baseline over ca2e574e read 4087 tests, 4078 pass, 1 fail (the same), 8 skipped, exit 1, 496 s.
- Next: dispatch section 1 to implementer-sonnet.

### Chapter 1 - 2026-09-24
Completed: 1. The normalizer repairs the binding
Implemented By: implementer-sonnet, the close pass in the main session
Metrics: review rounds 1, closed claim-exit; provenance 0 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 0 findings, 0 fixed, 0 deferred, 0 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- section 1 open: changes bindSession's inline refusal test into one exported predicate that normalizeState also calls on boundSession; serves Goal sentence 1 and Decision 1; adds no mechanism a clause does not name (the predicate is the bind function's existing test, the repair is the one Decision 1 orders); size about 10 lines of library code plus one comment; not building it leaves kit-goal.js status printing any truthy boundSession as a binding.
- The predicate is `isBindableSessionId`, lifted unchanged. Its length test is `.length <= 128`, which counts UTF-16 code units rather than the "128 bytes" the plan's Evidence and Decision 1 say; Decision 1 orders the bind function's existing rule, so the rule was kept and this line records the wording gap.
- The repair changes who may claim a damaged binding. Before it, a hand-edited `boundSession` outside the rule (a number, or an id with a trailing newline) held the leash for nobody and no claim point would take it. Now it reads as unbound, so the arming-session and transcript routes claim it as they claim any unbound goal. Decision 1 orders exactly this ("a hand edit outside that rule reads as unbound everywhere"); the two comments that stated the old behavior were rewritten.
- The implementer found every reader treats an absent `boundSession` and a null one alike (`session-start.js:494`, `kit-goal-stop.js:728`, `compact-deferral-nudge.js:899`, and `kit-compact-checkpoint.js:846`, which ORs the two), so normalizing an absent field to null changes no reader.
- The implementer's first whole-gate run read 4077 tests with 3 fails over 721 s and a count short of baseline; a clean rerun on an idle box read baseline plus its three tests. The first run is recorded as contention.
- The section's lane named a suite that does not exist, `test/size-budget.test.js`; `node --test` given several paths skipped it without failing. The caps suite is `test/size-ratchet.test.js`, run separately at the close.
Assumptions: none
Review Findings: review: adversarial, blind, security and performance at opus, Workflow (effort high). The blind lens rated one finding Major: the repair lets the arming or transcript route claim a damaged binding that no route could claim before. Downgraded at adjudication to a Minor claim finding, orchestrator-traced to Decision 1 and Goal sentence 1, which order that a hand edit outside the rule reads as unbound everywhere; what remained was two comments stating the old behavior. No Critical. Advisory lenses returned no Critical or Major. Minors: 6 fixed in the close pass (the `sessionHoldsLeash` comment, the `damaged` test's comment, the agreement test's refused direction now planting the value on disk, watched red with the repair line removed ("a number is also nulled on read") and green restored, a stale line reference, a wrong suite count, `boundSession` added to `normalizeState`'s header list), 0 upgraded, 3 left: pairing a repaired `boundSession` with a nulled `boundTranscript` (no reader observes the difference, and it would add a repair no clause names); `storableCheckpointOwner` in `kit-compact-lib.js` restating the bind rule by hand (outside this section's files and about another field; routed to `docs/backlog.md`); two status spawns in the new CLI test (the acceptance bullet names the CLI's output). The close pass took an author re-read, not a round.
Stamps: not run; the operator's standing constraint for this run bars memq against the real ~/.claude, so no applied stamps were adjudicated.
Gate: targeted lane at section close over the merged tree plus this section, worktree leash-status-truth, 0 foreign test runners at start, 2026-09-24T01:26Z: `node --test` over kit-goal-lib, memq-grant, hook-canary, session-start-goal, kit-goal-stop, kit-compact-gate, compact-deferral-nudge, chapter-boundary-nudge, kit-goal-worktree and archive-chain read 909 tests, 909 pass, 0 fail, exit 0, 101 s; `test/size-ratchet.test.js` read 98 tests, 98 pass, exit 0. No baseline was recorded on this exact lane; the whole-gate baseline is 4106 tests, 4097 pass, 1 fail (the known linked-worktree case). The implementer's whole gate over this section read 4109 tests, 4100 pass, 1 fail (the same), 8 skipped, exit 1: baseline plus three tests. Tests added: 3, none retired, none edited to stay green. "readGoal repairs a boundSession the bind function cannot support, and passes an accepted one through" pins Acceptance 2 (five refused shapes and a state predating the field read null; three accepted read back). "bindSession and normalizeState agree on every shape the acceptance rule judges" pins Decision 1's one-rule claim in both directions. "CLI status prints no binding for a boundSession the acceptance rule refuses" pins Acceptance 2's status bullet, with a bound control that prints the line. One added test spawns processes: the CLI test, two `kit-goal.js status` spawns. The `damaged` case in the `sessionHoldsLeash` test was kept with its comment rewritten.
Next: 2. The session-start notice lists every queued path
Commit Model: Branch-and-PR
Delta: worktree leash-status-truth over HEAD df220426, 2026-09-24T01:26Z, no foreign runner.
```
repository: leash-status-truth
test/kit-goal-lib.test.js: 5138 lines, cap 5138, +3; tests 158, +0
words: 939634 of cap 939697 across 88 curated files
test lines: 137106 of cap 137103 across 77 test files
tests: 3949
changed paths under no measured root: 2 (2 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: none
```

### Interim board 3 - 2026-09-24

- Section 2: first green committed at 859db690; review round 1 (adversarial, blind and security at opus, Workflow, effort high) adjudicated. The adversarial Major on the fold row (the notice lists fifty paths after the current plan, while `kit-goal.js status` counts the current plan as one of its fifty rows, so the two differ by one past fifty) is spec-traceable to the Intent; it is fixed by making the four comments state what each surface counts and adding a test that renders both surfaces over one state and pins the one-row relationship. Declared call: the Tests line's numbers (fifty-one remaining names fifty and counts one) are kept; the swap is slicing at `QUEUE_LINE_BOUND - 1` and amending that line. One Major is held as new-requirement: a fifty-path notice can reach about 6 KB inside one session-start payload, and the harness replaces a hook context past its cap with a preview; it waits on the scope adjudicator. Seven Minors are queued for the close pass. `docs/architecture.md`'s list of the bound's readers and an optional security-model sentence on the notice's volume are folded into section 3, which already writes under `docs/`; section 3's Files in scope names `docs/architecture.md`.
- Section 3: dispatched to implementer-sonnet, building the shared checkpoint-command helper in kit-compact-lib.js and the four callers; its files are disjoint from section 2's. Section 2's fixes wait for it to return, since both edit hooks the build hashes.
- Baseline: whole-gate lane after section 2's first green, per the section 2 implementer's run from this worktree at 859db690's tree, 2026-09-24: 4110 tests, 4101 pass, 1 fail (the known linked-worktree case), 8 skipped, exit 1.
- Next: read the judge's ruling and the section 3 report; then section 2's fix pass, its close gate and Chapter 2; then section 3's review.

### Chapter 2 - 2026-09-24
Completed: 2. The session-start notice lists every queued path
Implemented By: implementer-sonnet, the close pass in the main session
Metrics: review rounds 1, closed claim-exit; provenance 1 spec-traceable, 0 fix-introduced, 1 new-requirement, rulings (1 refused, 0 declared, 0 asked); advisory: 1 finding, 1 fixed, 0 deferred, 0 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- section 2 open: moves QUEUE_LINE_BOUND (50) from kit-goal.js to an export of kit-goal-lib.js, read by kit-goal.js and by session-start.js, whose notice then names every remaining path up to it and counts only the rest; serves Goal sentence 2 and Decision 2; adds no mechanism a clause does not name; size about 5 lines of code; not building it leaves the notice naming five paths where the status names fifty.
- One constant does not make the surfaces end their lists at the same row. The goal command's status render counts the current plan as one of its fifty rows. The notice lists the plans remaining after the current one. So past fifty the notice names one more path than the status render. The first green's comments claimed the three surfaces could not report a queue's length three ways; they now state what each surface counts.
- Declared call: the Tests line's numbers (fifty-one remaining names fifty and counts one) are kept, and the one-row difference is pinned rather than removed. The swap is slicing the notice at `QUEUE_LINE_BOUND - 1` and amending that line.
- Drift: section 3's Files in scope gained `docs/architecture.md`, folded from this section's review, since section 3 already wrote under `docs/`. A `## Standing Brief Amendments` block was added above `## Sections of Work` to record the scope adjudicator's refusal below.
Assumptions: none
Review Findings: review: adversarial, blind and security at opus, Workflow (effort high); the performance lens's trigger was not met. Two Majors. The adversarial fold-row Major is spec-traceable to Goal sentence 2 and fixed as above, with a new test that renders both surfaces over one sixty-plan state. The adversarial and blind lenses both raised a Major that a fifty-path notice can reach about 6 KB inside one session-start payload, which the harness replaces with a preview past its cap. It is new-requirement. The scope adjudicator ruled REFUSE on the Intent's "Alternatives refused" clause: a size budget only the notice reads is a second bound that drifts from the goal command's, whether it counts rows or characters. The refusal stands as the amendment above. No Critical. Minors: 7 fixed in the close pass (the `QUEUE_LINE_BOUND` comment in kit-goal-lib.js; an orphan comment and a stale "above" pointer in kit-goal.js; the notice's comment in session-start.js; the two queue tests now scoped with `goalNotice()`, creating the current plan doc so the healthy branch runs, and ending the seven-plan list on its last path; the false "opens no document" comment), 0 upgraded, 1 folded into section 3 (`docs/architecture.md`'s list of the bound's readers). The security lens's advisory Minor, a sentence stating the notice's path volume, was written into `docs/security-model.md` under section 3. The close pass took an author re-read, not a round.
Stamps: not run; the operator's standing constraint for this run bars memq against the real ~/.claude, so no applied stamps were adjudicated.
Gate: targeted lane at section close, worktree leash-status-truth, 0 foreign test runners at start, 2026-09-24T02:30Z, after `build.ps1`: `node --test` over archive-chain, hook-canary, kit-compact-gate, kit-goal-lib, kit-goal-statusline, kit-goal-worktree, kit-output-channel, memq-grant, the nine session-start suites and size-ratchet read 938 tests, 938 pass, 0 fail, exit 0. No baseline was recorded on this exact lane; the whole-gate baseline after the first green is 4110 tests, 4101 pass, 1 fail (the known linked-worktree case), 8 skipped. Tests added: 3, none retired, 2 edited in the close pass. "a queue of seven remaining plans names all seven and counts nothing" pins Decision 2 below the bound. "a queue whose remaining tail holds fifty-one plans names fifty and counts one" pins the fold. "over one state the notice lists one more remaining path than the status render" pins the one-row relationship; it spawns `kit-goal.js status` and the hook once each. Red, quoted: with the notice sliced at `QUEUE_LINE_BOUND - 1`, "✖ a queue whose remaining tail holds fifty-one plans names fifty and counts one" and "✖ over one state the notice lists one more remaining path than the status render", 0 pass, 2 fail; the file was restored from its pre-probe copy and verified with `cmp`.
Next: 3. The checkpoint CLI is named by path where a model is told to run it
Commit Model: Branch-and-PR
Delta: worktree leash-status-truth over HEAD 16e69b69, 2026-09-24T02:36Z, no foreign runner.
```
repository: leash-status-truth
test/session-start-goal.test.js: 1288 lines, cap 1288, +29; tests 52, +1
words: 939634 of cap 939697 across 88 curated files
test lines: 137319 of cap 137319 across 77 test files
tests: 3957
changed paths under no measured root: 4 (4 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

### Chapter 3 - 2026-09-24
Completed: 3. The checkpoint CLI is named by path where a model is told to run it
Implemented By: implementer-sonnet (first green and fix round 1), the round 2 fixes and docs placement in the main session
Metrics: review rounds 2, closed claim-exit; provenance 5 spec-traceable, 1 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 4 findings, 3 fixed, 0 deferred, 1 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- section 3 open: lifts CHECKPOINT_CLI, the path screen and elision (commandClausePath, safeCommandPath, SAFE_CLI_PATH) from compact-deferral-nudge.js into one exported helper in kit-compact-lib.js that renders node "<path>" <verb> or the prose fallback, and makes the Stop hook's boundary directive and queue-advance reason, the chapter nudge's reminder and the deferral nudge's reminder functions of the CLI path calling it; serves Goal sentence 3 and Decision 3; adds no mechanism a clause does not name (the helper is the deferral nudge's existing composition, moved); size about 80 lines moved plus four render functions; not building it leaves three model-facing texts naming the CLI bare, which does not run from the project directory.
- The helper is `checkpointCliClause(verb, cliPath)`, returning `{ clause, runnable }`; callers compose their own sentence around `clause`. Only it is exported. The four moved names stay internal to kit-compact-lib.js, since nothing outside reads them.
- A full path runs from any directory, while the checkpoint CLI resolves its project from the directory it runs in. So every runnable instruction now says to run it from the project directory, as the Goal's last sentence orders and the deferral nudge always said. The first green omitted it at three sites; round 1 caught it.
- The Stop hook's status mention became its own sentence, "Running <clause> from the project directory reports any open episode ...", so the prose fallback no longer opens a sentence in lowercase.
- kit-goal-lib.js already loads kit-compact-lib.js lazily from `sessionHoldsLeash`, guard 6 of the chapter nudge. So refusing the library everywhere is caught there and never reaches `reminderText`. The damaged-library test therefore scopes its refusal to requires issued by chapter-boundary-nudge.js itself.
- Checked against the project memory on emitted text naming a runnable path, which says such text can route a session around a gate its skill holds. Opening a checkpoint carries no trace in any skill, and each text naming the command first tells the session to load executing-work and finish its boundary steps. The runnable form is what the Goal orders and what the deferral nudge already emitted.
- The Evidence's line numbers for docs/security-model.md (831 and 855) had drifted to 838 and 864 by this section; the paragraphs were found by content.
Assumptions: none
Review Findings: review: round 1 adversarial, blind, security and performance at opus, Workflow (effort high); the performance lens ran on its trigger, since the chapter nudge is a PostToolUse hook and its delta moves a require. Round 2 adversarial and blind at opus over the fix delta. No Critical. Round 1: four adversarial Majors, all spec-traceable and fixed in fix round 1 (b6b400d6): the queue-advance reason became the exported `queueAdvanceCatchUp(safeNext, safeFinished, cliPath)` with in-process tests both ways; "from the project directory" at every runnable instruction; a test that the default clause names a real file; the deferral nudge's duplicate fallback wording removed, its catch being unreachable once guard 5 has loaded the library. Round 2: one fix-introduced Major from both lenses, the default-path test asserting a runnable clause where Decision 3 calls a dropped clause legitimate, fixed by asserting the fallback and skipping in that case; one spec-traceable Major, the project-directory pin missing the chapter nudge and unable to catch the status sentence losing the phrase, fixed by pinning the phrase after each rendered clause, per verb. Minors fixed: stale comments on the guard that first loads the library, in the hook and in two test comments; the "rendered once" comment and a test message naming a removed constant; a deferral nudge comment claiming one require site; four extra moved names exported where one was asked, which also let `test/kit-compact-gate.test.js` return to its pre-section content; verb-anchored test helpers; strip-then-check on every fallback case; the lowercase fallback sentence; the architecture.md sentence that split "does too" from its subject. 0 upgraded. Left, with reasons: the chapter nudge stays silent rather than falling back to prose on a damaged library, because the Tests line specifies silence; a stale sibling library missing `checkpointCliClause` makes the Stop hook's held path throw and allow, and the deferral nudge's builders throw after the rate-limit stamp lands, the same class the Stop hook already carries for every function it reads from that library, which ships in the same directory in one install. The advisory security lens returned three Minors: the duplicate fallback and a bare-name absence check on the spent-hold path, both fixed; the clause printing an absolute home path through a junction, subst drive or 8.3 spelling, refused as a pre-existing residual of the renderer that docs/security-model.md already names by class. The performance lens returned one comment Minor, fixed. Round 2 closed on an author re-read of the test and comment fixes, each new pin watched red.
Stamps: not run; the operator's standing constraint for this run bars memq against the real ~/.claude, so no applied stamps were adjudicated.
Gate: targeted lane at section close, worktree leash-status-truth, 0 foreign test runners at start, 2026-09-24T02:58Z, after `build.ps1`: `node --test` over kit-goal-stop, chapter-boundary-nudge, compact-deferral-nudge, kit-compact-gate, hook-canary, memq-grant, size-ratchet, doctrine-parity and memory-session read 964 tests, 964 pass, 0 fail, 0 skipped, exit 0. The first green's lane over the same files less memory-session read 856 of 856, exit 0, and the implementer's whole gate over it read 4116 tests, 4107 pass, 1 fail (the known linked-worktree case), 8 skipped: baseline 4110/4101/1/8 plus six passing tests. Acceptance bullet 4 asks the whole gate to exit 0; it cannot while that standing case fails from a linked worktree, which the finishing whole gate records. Tests added: 8 (boundaryDirective runnable and fallback; reminderText runnable and fallback; the chapter nudge's scoped damaged-library case; queueAdvanceCatchUp runnable and fallback; the default clause naming a real file), none retired; the five kit-goal-stop subprocess pins and the chapter nudge's pinned-fragment case were rewritten to the clause form, and the generic damaged-library loop dropped kit-compact-lib.js for the scoped case. Red, quoted: with " from the project directory" deleted from `reminderText` and the status sentence, "✖ boundaryDirective renders the runnable clause for a conventional path, both verbs" and "✖ reminderText renders the runnable clause for a conventional path", 0 pass, 2 fail, both files restored from pre-probe copies and verified with `cmp`; from the implementer's fix round, with `CHECKPOINT_CLI` pointed at a missing file, "✖ checkpointCliClause('open') with no path argument renders this checkout's own installed CLI", and with `queueAdvanceCatchUp` un-exported, both of its cases red.
Next: finishing-work
Commit Model: Branch-and-PR
Delta: worktree leash-status-truth over HEAD b6b400d6, 2026-09-24T03:00Z, no foreign runner.
```
repository: leash-status-truth
test/chapter-boundary-nudge.test.js: 702 lines, cap 702, +3; tests 32, +0
test/kit-goal-stop.test.js: 3839 lines, cap 3839, +12; tests 122, +0
words: 939634 of cap 939697 across 88 curated files
test lines: 137403 of cap 137403 across 77 test files
tests: 3960
changed paths under no measured root: 2 (2 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```
