# Reinforce the chapter-close boundary ritual against a skill-skipping session

Status: Complete
Commit Model: Review-Only
Created: 2026-08-21

## Goal

A leashed run that never loads the executing-work skill never opens a boundary
checkpoint, so the compaction gate correctly denies every auto-compaction offer
and the session runs out its life in the quality-degradation band with no
signal to anyone who could fix it. A live session did exactly this for about
nine hours on 2026-08-20: eight Chapters closed by hand from the doctrine
alone, zero checkpoints, every offer denied. When this plan is done, the
mismatch has a feedback loop: a kit-shipped PostToolUse hook detects a Chapter
append on a leashed run and puts the boundary steps in front of the model, the Stop hook's
hold reason (the one surface a misbehaving leashed session re-reads) names the
ritual, the doctrine's chapter-close bullet carries the fact a
doctrine-only session was missing, and the gate's user-facing deferral note
tells the operator what a long denial streak means.

This plan delivers `docs/backlog.md`'s item "Mechanize the chapter-boundary
checkpoint so it does not depend on skill text surviving in context"
(2026-08-17) and its item "Refresh the compaction gate's user-visible boundary
note when the hook next changes" (2026-08-19); both are retired at close-out.
The mechanization is delivered as detector-plus-directive rather than as an
auto-opened checkpoint, deliberately: the checkpoint belongs after the
section's commit model has been honored, so a hook that auto-opened it at the
Chapter append would admit a compaction between the Chapter write and its
commit, which is a mid-boundary landing of the kind the gate exists to
prevent. A reminder can misfire at zero cost; an auto-open cannot.

## Approach

The defect class, stated once: the checkpoint system has a mechanical consumer
(the PreCompact gate) and a prose producer (executing-work's per-section step
8), and no feedback loop between them. Every visible artifact of the
chapter-close ritual (Chapters, commits, reviews) is reproducible from the
doctrine by a conscientious session; the checkpoint is the one invisible step
that exists only in the skill text. And the gate's deny note cannot heal it:
PreCompact exit-2 stderr is shown to the user only, never fed to the model
(hooks documentation, confirmed 2026-08-21), so the only party who sees the
denial is not the party who can write the checkpoint.

The reinforcement therefore rides channels the model provably receives:

- **PostToolUse** fires on every Edit/Write, including a plan-doc Chapter
  append, and its JSON `additionalContext` is documented as "added to Claude's
  context for the next model call". That documentation claim is the one
  load-bearing fact this plan takes from the docs rather than a live probe,
  and this kit has already caught the hooks docs wrong once on this exact hook
  family (the PreCompact JSON deny form is documented and inert; see the
  `claude-code-precompact-facts` operator memory). So Section 1 is a
  kill-or-confirm probe, and Section 2 is built only on what the probe
  confirms. PostToolUse also fires for subagent tool calls (payload carries
  `agent_id`/`agent_type`), so the hook must stand down for those: the
  reminder belongs to the main session, and subagent doc writes are blocked by
  the docs-write-guard anyway.
- **The Stop hook's block reason** is fed to the model, fires on every held
  stop of a leashed session, and in the observed incident fired all day. The
  hook's own header already calls it "the one surface a leashed session
  re-reads on every held stop".
- **The doctrine** is loaded into every session, and the incident session ran
  "from the doctrine and the plan docs"; the chapter-close bullet is where the
  missing fact belongs.

Scope sweep (run 2026-08-21, base commit `04277e1`): the surfaces that speak
the chapter-close/checkpoint contract are `kit-compact-gate.js`,
`kit-compact-checkpoint.js`, `kit-compact-lib.js`, `kit-goal-stop.js` (which
already rewrites checkpoints on queue advance), `session-start.js`,
`doctor.ps1` and `install-compact-window.ps1`, `executing-work/SKILL.md`
(steps 0 and 8), `kit-goal/SKILL.md`, `docs/architecture.md`,
`docs/security-model.md` (the compaction-gate section), `docs/README.md`,
`test/kit-compact-gate.test.js`, `test/kit-goal-stop.test.js`,
`test/compact-window-install.test.js`, and `test/session-start-goal.test.js`.
The doctrine's chapter-close bullet lives at
`plugins/claude-kit/skills/operating-instructions/SKILL.md:66`, byte-parity
mirrored to `home/claude-kit-doctrine.md:61` by `test/doctrine-parity.test.js`
(whole-body comparison); the bullet is absent from
`plugins/claude-kit/output-styles/kit.md`, so the output-style parity gate is
untouched by this plan. Surfaces from the sweep that no section touches are
listed under Out of Scope with the reason.

A cold reader's starting surfaces for the vocabulary this spec speaks: the
leash and binding live in `plugins/claude-kit/hooks/kit-goal-lib.js` and the
kit-goal skill; the gate, checkpoint, and their match rule in
`kit-compact-gate.js`, `kit-compact-checkpoint.js`, and `kit-compact-lib.js`
(each carries a full design header); the boundary ritual in
`executing-work/SKILL.md` steps 0 and 8; the Chapter shape in the
curating-docs machine-contract table; and the whole gate's invariant in
`docs/security-model.md`'s compaction-gate section.

Execution notes that bind every section: any edit under
`plugins/claude-kit/hooks/` requires a `build.ps1` run before a suite result
is trusted (the build-stamp manifest, per the
`claude-kit-hook-edits-need-a-build-stamp-refresh` operator memory); the suite
runs as `node --test test/*.test.js` and its baseline is not zero-fail (2 to 3
environment-driven failures, one intermittent), so record the baseline before
the first change and report deltas against it. Reviewer briefs for the prose
sections (3, 4, 5) must direct the reviewer to read the whole file rather than
the diff: skill and doctrine amendments collide in the seam with unchanged
neighbours (project memory `skill-amendments-collide-with-neighbours`).

New model-visible strings in Sections 2 and 3 follow the established injection
posture: fixed strings only, carrying no payload, transcript, or repo data
(the same rule the gate's deny notes and the checkpoint CLI's sanitized output
already follow, stated in `docs/security-model.md`). One reason class is the
standing exception rather than a widening of the rule: the Stop hook's
queue-advance reason already interpolates the finished and next plan paths
through the file's own `safeForReason` sanitizer, and the boundary guidance
Section 3 adds to that reason names the same two values rather than
introducing new ones.

## Standing Brief Amendments

Every dispatch brief from here on carries these, folded in by the executing-work
section loop.

- **No string this plan ships may claim the compaction hold is permanent.** The
  gate's hold is bounded in two ways, both in `boundaryVerdict` at
  `plugins/claude-kit/hooks/kit-compact-gate.js`: it returns `allow` once
  consumption reaches `SAFETY_CEILING_TOKENS` (800,000), and it returns `allow`
  when the transcript reading is illegible. So "held for the rest of the
  session" is false, and `executing-work/SKILL.md` and
  `docs/security-model.md` already state the bounded truth. Any reminder, hold
  reason, deferral note, doctrine sentence, or comment this plan writes states
  the hold as running until the safety valve fires near the context limit, and
  names the real cost as a compaction landing at the worst point in the section
  rather than as a permanent hold. This amendment exists because the approved
  spec dictated the false wording into three separate sections, so it is a
  generator fix rather than three separate corrections.

## Sections of Work

### 1. Probe: which PostToolUse output forms reach the model

Model: opus

Files in scope: none shipped; probe scripts live in the session scratchpad and
the report lands in this plan's Chapter 1.

Establish, against the installed Claude Code on this machine, which of these a
PostToolUse hook can use to put text in front of the model. The method is the
settings-file probe recipe recorded in the `claude-code-hook-payload-facts`
operator memory (`memq get claude-code-hook-payload-facts`); its essentials,
inlined in case retrieval fails: write a settings JSON registering the
candidate PostToolUse hook, run one `claude -p "<probe prompt>"` headless turn
with `--settings <path>` from a scratch directory, have the hook dump its
stdin and emit the candidate form, and read the turn's reply and orphan
transcript for the result. The pass criterion is behavioral, not structural:
the injected text instructs the model to echo a distinctive marker, and the
marker appearing in the turn's reply is the evidence the form reached the
model. Probe:

- (a) JSON on stdout at exit 0 with top-level `additionalContext` (the shape
  the current hooks documentation shows).
- (b) JSON on stdout at exit 0 with `hookSpecificOutput.additionalContext`
  (the shape older documentation showed; probe both because the two readings
  circulate and only one need work).
- (c) exit 2 with stderr (documented as "shows stderr to Claude"), noting how
  it is framed to the model (an error framing makes it a fallback, not a
  first choice).
- (d) that a PostToolUse payload fired by a subagent's tool call carries
  `agent_id`, and one fired by a main-thread call does not (the stand-down
  discriminator Section 2 relies on). Procedure: the probe prompt asks the
  turn to perform one Edit itself and to dispatch one general-purpose
  subagent that performs another Edit, and the two dumped payloads are
  diffed on the field. If the headless environment cannot dispatch a
  subagent, mark (d) unestablished and keep Section 2's guard anyway: an
  absent field leaves the guard inert at zero cost, and the docs-write-guard
  blocks subagent plan-doc writes regardless.

Acceptance: a probe report in Chapter 1 marking each of (a) through (d)
confirmed or failed with the evidence path (the probe transcript or output
file), and Section 2's channel choice amended inline to the confirmed form
by the orchestrator, as a spec amendment recorded in the Chapter per
executing-work's deviation rule, before Section 2 is dispatched. The
buildable outcomes are (a) or (b): a silent-on-success JSON channel. If both
fail, stop and surface `BLOCKED:` per the executing-work blocker set, even
where (c) works: exit-2 stderr frames the reminder as an error on every
routine Chapter append, and whether to accept an error-framed channel or
fall back to Stop-hook-only reinforcement is the operator's design call, put
to him with the probe evidence and a recommendation.

### 2. The chapter-boundary nudge hook

Model: fable

Files in scope: `plugins/claude-kit/hooks/chapter-boundary-nudge.js` (new),
`plugins/claude-kit/hooks/hooks.json`, `test/chapter-boundary-nudge.test.js`
(new), `README.md` (the repo root README is where the hooks file-tree list
lives; this spec originally named `docs/README.md`, which carries no such
list), `docs/architecture.md` (hook inventory), `docs/security-model.md` (the
compaction-gate section gains the new hook's posture), plus the `build.ps1`
stamp refresh. The root README also carries a note telling a reader how to
remove the format-on-edit hook, which described that hook's PostToolUse group
as holding one command; adding a second command to the group falsifies it, so
the note is corrected in the same change.

A PostToolUse hook, wired in `hooks.json` as a second object in the `hooks`
array of the existing `"Edit|MultiEdit|Write"` matcher group (the group that
carries `format-on-edit.js`; one matcher group, two command objects), that
detects a Chapter being appended to a plan doc on a
leashed run and emits a fixed reminder of the boundary steps through the
channel Section 1 confirmed: JSON on stdout at exit 0 whose
`hookSpecificOutput` object carries `hookEventName` set to `PostToolUse` and
`additionalContext` set to the reminder. A top-level `additionalContext` is
inert on this harness (Section 1 probed it alone and it reached nothing), so
the hook must not emit one, and the nested form is the only channel it uses.
Guards, in order, every one failing toward silent exit 0:

1. Payload parses; `tool_name` is `Edit`, `MultiEdit`, or `Write` (in-code
   check mirroring the gate's clause 1, so a matcher edit cannot silently
   widen the hook).
2. `KIT_EXTERNAL_ENGINE` is not `'1'` (external-engine workers stand down,
   same marker as the sibling hooks).
3. The payload carries no `agent_id`/`agent_type` (a subagent's tool call;
   the reminder is for the main session). This guard is load-bearing on its
   own: Section 1 confirmed a subagent's payload carries the parent session's
   own `session_id`, so guard 6 passes for a subagent and never stands one
   down.
4. `tool_input.file_path` is a `.md` file under a `docs/plans/` directory
   (both path separators accepted) AND it is the armed goal's own plan: after
   normalizing separators, the path equals or ends with `'/' + goal.plan`,
   compared case-insensitively. An unusable `goal.plan` stands the hook down
   like any other failed guard. This is the reversal the plan's `## Assumptions`
   section named, taken during execution: the assumption's premise was that a
   nudge on a sibling plan doc is harmless, and it is not, because the reminder
   opens by asserting that a Chapter was appended and a boundary reached, which
   on a sibling doc is a false statement written into the model's context. This
   repository routinely carries two plan docs at once, so the case is live.
5. A kit goal is armed (`readGoal` from `kit-goal-lib.js`, the same read the
   gate uses).
6. The goal's `boundSession` equals the payload's `session_id`
   (`sameSessionId` from `kit-compact-lib.js`). Bound sessions only:
   claiming a binding stays the business of the gate and the Stop hook.
7. The write adds a Chapter heading, per the curating-docs machine contract
   shape `### Chapter N`: regex `/^###[ \t]+Chapter[ \t]+(\d+)/mg` (the
   horizontal-whitespace classes rather than `\s`, which matches a newline and
   so would fire on an empty `###` followed by prose beginning with the word
   Chapter). The rule compares Chapter NUMBERS, not mere heading presence: for
   an Edit, fire when `new_string` carries a Chapter number that `old_string`
   does not; for a MultiEdit, when any element satisfies that same rule; for a
   Write, when `content` carries any Chapter heading (a full-file Write has no
   pre-image to diff against, and a repeat reminder is harmless).

   The number comparison replaces the absent-from-`old_string` rule this plan
   was approved with, which carried a confirmed false negative on the exact
   shape the hook exists to catch. A real Chapter append anchors its
   `old_string` on the tail of the document, and on any plan doc that already
   has Chapters that tail contains a `### Chapter N` heading, so the
   presence-based rule silenced the append. That is the delivers-nothing
   direction, so it is corrected here rather than carried.

On all guards passing, emit one fixed string (no interpolated data) that:
names itself, states that a Chapter boundary was reached on a leashed run,
directs the session to complete the boundary steps from the executing-work
skill once the section's commit model has been honored (the memory sweep,
then `kit-compact-checkpoint.js open`), states why (the compaction gate
defers auto-compaction until the checkpoint exists), and directs a session
that does not have executing-work loaded to load it before the next section.
Exact wording is the implementer's, within the fixed-string posture.

The hook never exits 2 (the tool already ran; an error-framed reminder on
every plan-doc edit is noise), and any internal error exits 0 silently,
matching the gate's fail-open posture: a missed nudge degrades to the
pre-plan status quo, never to a broken edit loop.

Tests (a floor): mirror `test/kit-compact-gate.test.js` conventions
(spawn the real file with a JSON payload on stdin against temp-dir fixtures
carrying their own `.kit/goal-state.json`). At minimum: fires on an Edit
appending `### Chapter 2` to `docs/plans/x_spec_v1.md` when armed and bound
(asserting the confirmed output form and the reminder's presence); silent
when the payload carries `agent_id`; silent when the goal is unbound or bound
to another session; silent on a non-plan path; silent on an edit whose
`old_string` already contains the heading; silent under
`KIT_EXTERNAL_ENGINE=1`; exit 0 and silent on a malformed payload. Plus the
cross-component pin: the heading regex accepts the contract's canonical
`### Chapter 12` and the conventional trailing-date form
`### Chapter 3 - 2026-08-21`, with the fixture shapes taken from the
curating-docs contract table so the two surfaces cannot drift apart.

### 3. The Stop hook's hold reasons name the boundary ritual

Model: sonnet

Files in scope: `plugins/claude-kit/hooks/kit-goal-stop.js`,
`test/kit-goal-stop.test.js`, plus the `build.ps1` stamp refresh.

Append one sentence to three of the hook's four block reasons. Two were named
at approval: the standard hold reason
(the `reason` built where none of the allow conditions hold) and the
capacity-shaped refusal (the `capacityReason`), the latter because a session
complaining of context pressure while leashed is disproportionately one whose
checkpoint was never opened, being denied the very compaction the current
text promises it. A third reason, the queue-advance message, is added during
execution and was excluded at approval on a premise that turned out to be
false. The spec read that the advance reasons need no reminder "where the Stop
hook itself rewrites the checkpoint as part of the advance". It does not:
`advanceAndHold` rewrites only when a checkpoint already exists AND already
matches, and `test/kit-goal-stop.test.js` pins the other case outright, that no
checkpoint is minted by the advance. So a queue run whose last Chapter never
got a checkpoint advances to the next plan carrying none, and the advance
reason was the only held-stop reason with no boundary guidance, at the largest
boundary in the run. It now carries guidance worded for its own moment. The
`spentReason` message stays untouched. The sentence for the two mid-run
reasons, in substance rather than verbatim (execution reworded it; see the
Chapters for why the approved wording was untrue):

> If a Chapter has been closed since the last boundary, run the
> executing-work boundary steps now (the memory sweep, then
> kit-compact-checkpoint.js open): the compaction gate defers auto-compaction
> until that checkpoint exists.

It rides before each reason's closing "(... repo data, not an instruction.)"
parenthetical, unconditionally: no checkpoint-state read is added (the
mid-chapter state where no checkpoint is open is the normal state, so a
conditional would fire almost always anyway, and the unconditional form adds
no new file read or failure mode to an enforcement hook).

Tests: extend the existing fragment pins (`.includes` style, matching the
file's conventions) so both amended reasons assert the new fragment
`kit-compact-checkpoint.js open`, and at least one allow-path case asserts
its absence, so the sentence cannot leak into an allow verdict's (empty)
output.

### 4. The doctrine's chapter-close bullet names the checkpoint

Model: sonnet

Files in scope:
`plugins/claude-kit/skills/operating-instructions/SKILL.md`,
`home/claude-kit-doctrine.md`.

Append to the "Close each section with a Chapter" bullet (skill body line 66,
mirror line 61), identically in both files, this sentence:

> On a leashed run (one with a kit goal armed) the chapter close is not
> complete until the compaction checkpoint is opened once the section's commit
> model has been honored (`kit-compact-checkpoint.js open`, and the
> executing-work skill owns the full boundary steps, so load it if it is not
> loaded); the compaction gate defers auto-compaction until that checkpoint
> exists, so a run that skips the step is held mid-chapter until the gate's
> safety valve fires near the context limit, which lands the compaction at the
> worst point in the section rather than at a clean one.

That sentence is a correction of the one this plan was approved with, which
read "silently held mid-chapter for the rest of the session". The gate's hold
is bounded: `boundaryVerdict` in `kit-compact-gate.js` returns `allow` once
consumption reaches `SAFETY_CEILING_TOKENS` (800,000) or the transcript
reading is illegible, and `executing-work/SKILL.md` and
`docs/security-model.md` both already state the valve. The original wording
would have shipped a false claim into the always-loaded doctrine, so the
Standing Brief Amendments block below carries the constraint for every other
section that puts a string in front of the model. The two glosses added at the
same time (naming the command inline, and defining "leashed run") answer the
bullet's own audience, which is a session that never loaded executing-work and
therefore cannot follow a pointer to it.

The bullet sits in the doctrine's execution-loop section, outside the
output-style register core, so `plugins/claude-kit/output-styles/kit.md` and
`test/output-style-parity.test.js` are untouched (confirmed by the scope
sweep). Acceptance: `test/doctrine-parity.test.js` green (the whole-body
comparison is the gate that catches a one-sided edit), and a grep for a
distinctive fragment of the new sentence hitting exactly the two files.

### 5. The gate's deferral notes refresh, and the boundary note gains the diagnostic

Model: sonnet

Files in scope: `plugins/claude-kit/hooks/kit-compact-gate.js`,
`test/kit-compact-gate.test.js` (the pinned note-lead constants update with
the string, in the same change), plus the `build.ps1` stamp refresh.

Two changes to `BOUNDARY_NOTE`, delivering the backlog item "Refresh the
compaction gate's user-visible boundary note when the hook next changes"
(2026-08-19). First, the refresh that item names: the note reads "deferred to
the next chapter boundary", which speaks the superseded one-boundary-kind
contract; since the boundary-cadence effort, a boundary is either a chapter
close or an interim board entry during a closure drought, and the new wording
must name the boundary generically or name both kinds. Second, this plan's
own addition: an operator-facing diagnostic naming the state that means the run
has likely skipped its chapter-close checkpoint, with the remedy.

The condition is NOT a turn count, which is how this spec first put it and
which is false against the gate's own file: the header there records that a
denied attempt is re-tried once per assistant turn indefinitely, and records
19 consecutive denials followed by a clean checkpointed landing as the healthy
observed case. Repetition across many turns is therefore the designed
mid-section normal, and a diagnostic keyed to it would accuse every long
section of a fault while inviting the operator to open a checkpoint
mid-section, which `executing-work/SKILL.md` forbids in as many words. The
condition is the note still repeating AFTER a Chapter has been closed. The
remedy is written in operator register, because this note reaches the operator
and never the model: it names `kit-compact-checkpoint.js status` as the
non-mutating check before `open` as the remedy, gives a form that actually
runs rather than a bare filename the shell cannot resolve, and qualifies the
open with "at a true boundary" so it cannot read as a mid-section directive.
`INTERACTIVE_NOTE` is re-read against current behavior in the same pass and
refreshed only if stale. The test-pinned lead constants in
`test/kit-compact-gate.test.js` are updated to the new strings in the same
change: the pins exist to catch accidental drift, and a deliberate reword
moves them deliberately. Both notes remain fixed strings carrying no input
data, and the two leads must remain distinct from each other (a transcript
reader tells the deferral kinds apart by them). These notes are read by the
operator only (PreCompact stderr never reaches the model), so they are
written for a human watching a terminal, not for the model.

### 6. Pin the doctrine's checkpoint sentence against a symmetric deletion

Model: sonnet

Locus: inline

Files in scope: `test/doctrine-parity.test.js`.

Appended during execution, from Section 4's review. `test/doctrine-parity.test.js`
compares the two doctrine copies whole, which catches a one-sided edit and
nothing else: deleting the checkpoint sentence from BOTH copies leaves the
bodies identical and the suite green. The file already answers this for two
other load-bearing bullets, with its own stated reasoning that whole-body
identity would still pass with the bullet deleted from both copies, so the
shape to mirror is present in the file. Section 4's acceptance asked only for
parity plus a grep, which is the gap.

Add a presence pin in that file's existing style: assert the
`Close each section with a Chapter` bullet carries a distinctive fragment of
the checkpoint sentence, in both copies. It is load-bearing on the same terms
as the two bullets already pinned, because Sections 2, 3 and 5 each ship a
surface that reinforces the fact this sentence states, and a doctrine that
dropped it would leave three mechanical reminders pointing at a rule the
always-loaded layer no longer carries.

Acceptance: `node --test test/doctrine-parity.test.js` green, and the new
assertion goes red when the sentence is removed from both copies (proved by a
red check in the scratchpad, never against the real tree).

## Out of Scope

- Auto-opening the checkpoint from the nudge hook (rejected in the Goal: it
  would land compactions between the Chapter append and the commit).
- A compaction boundary for the finishing pass (`docs/backlog.md`,
  2026-08-19 item; a different boundary, not touched here).
- The leash bind compare-and-swap (`docs/backlog.md`, 2026-08-18 item).
- Recording compaction offers as events, and the compact-source SessionStart
  state slice (`docs/backlog.md`, both 2026-08-18; adjacent but separate).
- Sweep surfaces this plan reads but does not change: `kit-compact-lib.js`
  and `kit-compact-checkpoint.js` (the contract they implement is unchanged),
  `session-start.js` (its resume instruction already names executing-work),
  `executing-work/SKILL.md` and `kit-goal/SKILL.md` (steps 0 and 8 already
  state the ritual correctly), `doctor.ps1` and `install-compact-window.ps1`
  and `test/compact-window-install.test.js` and
  `test/session-start-goal.test.js` (window/trigger surfaces, not ritual
  surfaces).
- Any change to the gate's verdict logic, ceiling, or checkpoint match rule.

## Assumptions

- assumed 2026-08-21 (default): the Stop-hook reminder is unconditional text
  with no checkpoint-state read; reversal: condition it on `readCheckpoint`
  in a later change.
- assumed 2026-08-21 (default): the nudge fires on a Chapter append to any
  `docs/plans/*.md` while armed and bound, not only the armed plan's own
  file; a nudge on a sibling plan doc is harmless and path comparison is
  fiddly across relative/absolute forms; reversal: add an armed-plan path
  comparison to guard 4.
- assumed 2026-08-21 (source: hooks documentation read 2026-08-21, gated by
  Section 1's probe): PostToolUse `additionalContext` reaches the model;
  Section 2 does not build until the probe confirms a form.
- assumed 2026-08-21 (default): Review-Only commit model, matching the
  sibling in-flight plan in this repo.
- assumed 2026-08-21 (source: scope sweep 2026-08-21): the doctrine edit
  lands in the skill body and the home mirror only; the output style does
  not carry the bullet.
- assumed 2026-08-21 (default): the backlog's "mechanize the checkpoint"
  item is retired by this plan as delivered detector-plus-directive, with
  the auto-open rejection recorded as the rationale.

## Related

- `claude-kit_boundary-gated-compaction_spec_v1.md` built the gate
  and checkpoint this plan reinforces (deny mechanics, safety valve, probe
  precedent this plan's Section 1 mirrors).
- `claude-kit_compact-gate-binding_spec_v1.md` made the gate
  reachable by claiming the binding at the compaction offer; this plan closes
  the remaining silent state (bound, denied, no checkpoint ever written).
- `claude-kit_boundary-cadence-and-spec-scope_spec_v1.md` fixed
  the boundary drought inside skill-driven runs; this plan covers the run
  that never entered the skill at all.
- `claude-kit_sync-state-writer-and-push-pair_spec_v1.md` ran
  immediately before this plan in the same armed queue: no file overlap in
  code, and both close-outs edit `docs/backlog.md`, which is why they ran
  serially.

## Open Questions

None at approval.

## Chapters

### Chapter 1 - 2026-08-21
Completed: 1. Probe: which PostToolUse output forms reach the model
Implemented By: main session (inline; the section's only shipped output is this Chapter, which lives under `docs/`)
Metrics: 0 review rounds (probe section, nothing shipped); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: all four probe items are settled against Claude Code 2.1.238 on this machine, and the headline is that the hooks documentation is wrong again on this hook family, exactly as the Approach section wagered. (a) FAILED: a PostToolUse hook emitting top-level `additionalContext` at exit 0 puts nothing in front of the model. Probed alone, that run's reply was `MARKERS: NONE`. (b) CONFIRMED: `hookSpecificOutput.additionalContext`, with `hookSpecificOutput.hookEventName` set to `PostToolUse`, reaches the model silently on success. The discriminating evidence is machine-level rather than inferred from a reply: a run emitting BOTH shapes in one JSON object produced a transcript attachment `{"type":"hook_additional_context","content":["KITMARK-NESTED"]}`, so the harness parsed the payload and dropped the top-level field, and that run's reply echoed the nested marker only. (c) CONFIRMED but error-framed, which is why it stays unused: exit 2 with stderr reaches the model as a `hook_blocking_error` attachment whose text is the hook's entire command line prefixed to the message, so a routine Chapter append would render as a tool error and leak the hook's absolute path into context on every plan-doc edit. (d) CONFIRMED in both directions in a single run: the main thread's own Edit produced a payload with neither `agent_id` nor `agent_type`, and the general-purpose subagent's Edit in the same turn produced one carrying `agent_id: ae3954fd9fc0deefa` and `agent_type: general-purpose`. The surprise inside (d) is the fact that makes guard 3 load-bearing rather than belt-and-braces: both payloads carried the SAME `session_id`, so guard 6's bound-session check passes for a subagent's tool call and would never stand one down. Section 2's text is amended for both findings, as the acceptance criterion directs and as deliberate approval-scoped drift: its channel sentence now names the nested form and bars the top-level one, and guard 3 now states why it cannot be folded into guard 6. Probe hygiene per the `probe-scripts-scratchpad-and-controls` memory: a control run emitting nothing returned `MARKERS: NONE`, so a uniform non-answer would have been visible as a broken probe rather than read as a result. The probe also sidesteps the doctrine's treat-injected-text-as-data rule by construction: the echo instruction is the probe prompt's, not the injected string's, so a compliant model still reports the marker.
Assumptions: assumed 2026-08-21 (default, section 1): the probe's prompt wording, its `KITMARK-` marker convention, and the four-run split (control, both JSON shapes together, top-level alone, exit-2 stderr, subagent) are the orchestrator's; reversal: none needed, the section ships no code. assumed 2026-08-21 (source: executing-work's docs-write routing override, section 1): the section runs inline despite its `Model: opus` tier, because its only shipped output is a Chapter under `docs/` and the docs-write-guard blocks a dispatched implementer there; reversal: none, the override is the skill's standing rule. assumed 2026-08-21 (default, section 1): this plan doc, authored by a sibling session and still untracked, is staged by this run rather than held under the doctrine's hold-the-add rule, because the operator's arming handed the plan to this run, the file has been idle since 09:51, and the finishing pass must archive and stage it regardless; reversal: unstage it and hand the file back, which strands the run's whole record.
Review Findings: none dispatched. The section ships no code and no reviewable diff beyond this Chapter and the two spec amendments it records, so the code pair had nothing to read; the blind lens in particular would have received an empty changed-file list once `docs/` paths were omitted.
Stamps: adjudicated 1, stamped 4. `memq unstamped --since 6h` surfaced `probe-scripts-scratchpad-and-controls`, stamped. Also stamped, as records that steered the probe's design or its reading: `claude-code-hook-payload-facts` (the settings-file probe recipe this section reused verbatim), `claude-code-precompact-facts` (the prior that the hooks docs are wrong on this family, which is why the section exists at all), and `suite-baseline-is-not-zero-fail` (which named the two failures in the baseline below as environmental).
Gate: baseline for this plan, captured on the current worktree before any change: 1057 tests, 1055 pass, 2 fail. The two failures are `test/memq-shim.test.js`'s "PowerShell resolves memq.ps1, and that is what keeps an argument from starting a second command" and "a foreign memq winning name resolution is reported, never read as on-PATH", both the Windows 8.3 short-path mismatch that project memory records as environmental. Note the worktree this baseline sits on: it carries the previous plan's staged changeset, which is the correct base, since this plan's changes land on top of it under one shared Review-Only review surface.
Next: 2. The chapter-boundary nudge hook
Commit Model: Review-Only

### Chapter 2 - 2026-08-21
Completed: 4. The doctrine's chapter-close bullet names the checkpoint
Implemented By: implementer-sonnet, reviewed by an adversarial and a blind reviewer both at opus/xhigh
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the section shipped the spec's dictated sentence byte-exactly into both doctrine copies, and both reviewers independently found that the dictated sentence is false. Its closing clause, "a run that skips the step is silently held mid-chapter for the rest of the session", is contradicted by the gate's own code: `boundaryVerdict` at `plugins/claude-kit/hooks/kit-compact-gate.js:363-364` returns `allow` once consumption reaches `SAFETY_CEILING_TOKENS` (800,000, defined at :196) and returns `allow` again when the transcript reading is illegible, so the hold is bounded twice over. Two shipped surfaces already stated the bounded truth, `executing-work/SKILL.md:266` and `docs/security-model.md:190`. I confirmed all of it against the code before acting. This is an honesty-gate violation landing in the always-loaded artifact, which the doctrine bars outright and requires be swept tree-wide rather than fixed only in the diff, so the sweep ran: four live sites carried the claim, the two doctrine copies plus the nudge hook's header comment and its model-visible REMINDER constant, all four corrected. Because the approved spec had dictated the same false wording into three separate sections, the fix went to the generator rather than the output: the plan doc gained a `## Standing Brief Amendments` block stating the bounded truth with its file references, and Sections 3 and 5 were dispatched carrying it, so Section 5's implementer, writing a fresh operator-facing diagnostic, never had the chance to reintroduce it. Two of the round's Minors were taken in the same edit because they answer the bullet's own audience, which is a session that never loaded executing-work: the sentence now names `kit-compact-checkpoint.js open` inline rather than pointing at a skill that session does not have, and glosses "leashed run" as one with a kit goal armed, a term appearing nowhere else in either doctrine copy. Two Minors needed no action: the stale packaged doctrine artifact regenerates from `build.ps1`, which ran, and the seam with the capacity bullet is defused by the bounded wording itself. One Minor could not be folded and became Section 6.
Assumptions: assumed 2026-08-21 (default, section 4): correcting the spec's dictated sentence rather than shipping it verbatim and raising a BLOCKED, on the ground that the correction changes no design intent (the bullet still tells a leashed session the checkpoint is owed and why) and that shipping a claim known to be false is barred by a standing rule rather than open as a preference; reversal: revert both copies and the spec to the approved wording, which reinstates the false claim.
Review Findings: adversarial at opus/xhigh, CHANGES_REQUIRED: one Major (the false permanence claim) and five Minors. Blind at opus/xhigh, independently: the same claim as its own leading Major, plus a second Major reading the same defect from the other side, that the real consequence, a mistimed mid-section compaction against an 800k context, is never named. Both fixed. Two reviewers reaching the same finding from a sighted and a blind brief is the strongest signal this round produced, since neither could have inherited it from the other. Minors: executable step and vocabulary gloss both fixed; build artifact and capacity seam both resolved without action; the missing parity pin routed to Section 6.
Stamps: adjudicated 0 surfaced, stamped 6. `memq unstamped --since 3h` returned zero records in both tiers, so the six were stamped on recognition rather than off the machine's list: `skill-amendments-collide-with-neighbours` (which is why both reviewer briefs directed a whole-file read rather than a diff read, and so is why the seam findings were reachable at all), `test-suite-invocation`, `claude-kit-hook-edits-need-a-build-stamp-refresh`, `js-replace-dollar-sequences-corrupt-the-document`, `edit-script-prose-belongs-in-its-own-file`, and `git-bash-sed-i-strips-cr`.
Gate: `node --test test/doctrine-parity.test.js` 3 pass 0 fail at the section's close, and `test/output-style-parity.test.js` 11 pass 0 fail, confirming the output style is untouched as the scope sweep predicted. The whole-suite figure rides in Chapter 4 with Section 2's, since the two sections were corrected and gated together.
Next: 6. Pin the doctrine's checkpoint sentence against a symmetric deletion
Commit Model: Review-Only

### Chapter 3 - 2026-08-21
Completed: 6. Pin the doctrine's checkpoint sentence against a symmetric deletion
Implemented By: main session (inline; a single test assertion, too small to be worth a brief)
Metrics: 0 review rounds (one assertion, no logic, proved in both directions); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: this section did not exist at approval. It was appended during execution out of Section 4's review, which is approval-scoped drift by construction and is named here as the scope change it is. The finding: `test/doctrine-parity.test.js` compares the two doctrine copies whole, which catches a one-sided edit and nothing else, so deleting the checkpoint sentence from both copies leaves the bodies identical and the suite green. The file already answers exactly this for two other bullets and states the reasoning in its own comments, so the shape to mirror was sitting in the file. It could not be folded into Section 4: the fold predicate requires the file to sit in the same directory as one the section changed, and `test/` is neither `plugins/claude-kit/skills/operating-instructions/` nor `home/`. So it took the append route rather than a quiet widening of Section 4. The pin asserts the chapter-close bullet in each copy carries both the checkpoint clause and the command name, the second of which is load-bearing for the same reason the sentence names the command at all. One surprise in the writing rather than the design: the append script's newline escape collapsed through a shell heredoc layer and produced a literal line break inside a string, breaking the whole test file into a single load failure. That is the same class as the `js-replace-dollar-sequences-corrupt-the-document` memory, an escape surviving one layer fewer than expected, and it is why the targeted test ran immediately after the append rather than at the section's end.
Assumptions: assumed 2026-08-21 (default, section 6): the section runs inline rather than at the `sonnet` tier its heading records, because it is one assertion and the brief would cost more than the work; reversal: none needed, the work is done and gated.
Review Findings: no reviewers dispatched. The section is a single assertion with no logic, which is the trivial-and-self-contained case the executing-work section loop makes the reviewer pair optional for, and the finishing pass still covers it. Recorded as a decision rather than an omission.
Stamps: adjudicated 0, none surfaced beyond the six stamped at this same boundary and recorded in Chapter 2.
Gate: `node --test test/doctrine-parity.test.js` 4 tests, 4 pass, 0 fail. Proved in both directions rather than on green alone: a scratchpad red check ran the new assertion against the real body (passes, the control) and against a copy with the sentence stripped exactly as a symmetric deletion would strip it (fails on the checkpoint clause, as required). The strip is itself asserted to have matched something, so a broken probe cannot report a green control and a red variant for the wrong reason. The probe never touched the tree, which was required rather than merely careful: two agents were in flight at the time and a tree-mutating probe is exclusive.
Next: 3. The Stop hook's hold reasons name the boundary ritual
Commit Model: Review-Only

### Chapter 4 - 2026-08-21
Completed: 2. The chapter-boundary nudge hook
Implemented By: implementer-fable, two rounds; reviewed by an adversarial and a blind reviewer at fable/high and a security reviewer at opus/max
Metrics: 1 review round (six fixes, no re-review needed: every fix was a named finding with a named test); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the hook shipped correct on everything the spec could specify and wrong on two things the spec had guessed at, and the round is worth reading for which reviewer caught what. The blind reviewer, holding only a changed-file list, found that guard 3 defends two agent-key spellings while this repository's own two sibling subagent detectors defend four: `readonly-agent-guard.js:59` and `docs-write-guard.js:46` both read `agent_type || agentType || subagent_type || subagentType`. I confirmed both lines. That is a defect in my brief rather than in the implementer's work, and it mattered more than a normal breadth nit because Section 1's probe had already established that guard 6 cannot tell a subagent apart at all, so guard 3 is the only stand-down there is. The same reviewer found that guard 4 never tied the edited path to the armed plan. The spec's `## Assumptions` section had approved that looseness on the premise that a nudge on a sibling plan doc is harmless, and named the reversal; the premise is false on this plan's own honesty standard, because the reminder opens by asserting that a Chapter was appended and a boundary reached, which on a sibling doc is a false statement written into the model's context, and this repository carries two plan docs at once as a matter of course. The reversal was taken. The adversarial reviewer found the one that would have made the whole plan deliver nothing: guard 7's rule, as the spec dictated it, required the Chapter heading to be ABSENT from the Edit's `old_string`, and a real Chapter append anchors its `old_string` on the document's tail, which on any plan doc past its first boundary already contains the previous Chapter's heading. So the hook would have gone silent on exactly the shape it exists to detect. The rule is now a comparison of Chapter NUMBERS present in `new_string` and absent from `old_string`, and the test for it was confirmed discriminating: the old rule evaluated against the new fixture returns false. Two more from the same reviewer: the heading pattern's `\s+` matched newlines, so an empty `###` followed by prose beginning with the word Chapter fired the hook, now `[ \t]+`; and the two kit-library requires sat outside every catch, so a damaged plugin cache would have exited 1 with a stack trace after every edit in every session, contradicting the file's own absolute. The requires moved behind the guard that uses them rather than the claim being softened, because a hook firing on every edit is where an absolute is worth keeping. The security reviewer probed the injection surface empirically rather than reading it, feeding a hostile filename and hostile edit text and getting stdout byte-identical to a benign payload, and found the one availability defect: the hook passed `payload.cwd` into a `readFileSync` with no network-path guard, and a UNC cwd hung it until SIGTERM at 20 seconds. Fixed with the same two-leading-separator rejection `kit-goal-lib.js` already applies to its own stat paths. That is the one failure this hook's header promises it never causes, so the promise now holds where it can: a project on a mapped network drive letter is indistinguishable from local disk without a syscall, and that residual is stated in `docs/security-model.md` rather than papered over.
Assumptions: assumed 2026-08-21 (source: the plan's own `## Assumptions` reversal clause, section 2): guard 4 now compares the edited path against the armed plan, reversing the approved looseness; reversal: drop the comparison, which reinstates false boundary assertions on sibling plan docs. assumed 2026-08-21 (default, section 2): the armed-plan comparison is case-insensitive on win32 and exact elsewhere; reversal: make it exact everywhere, which would break on a payload whose drive letter or path casing differs from the goal state's. assumed 2026-08-21 (source: executing-work's docs-write routing override, section 2): the three documentation files in this section's scope were written by the main session from the implementer's drafted prose, because the docs-write-guard blocks a dispatched implementer under `docs/`; reversal: none, the override is the skill's standing rule.
Review Findings: three MAJORs, all fixed: the agent-key breadth and the armed-plan comparison from the blind reviewer, and the guard-7 false negative from the adversarial. MINORs fixed: the newline-matching heading pattern, the require-time crash path, the network-share hang, and a test comment that claimed to exercise guard 1 while actually pinning behavior the name dispatch already delivers. No Critical from any reviewer. Three surfaces were correctly out of this section's scope and are routed to `docs/backlog.md` rather than left in a report: `sameSessionId`'s `String()` coercion, which lets a non-string session id compare equal and is shared with the gate's verdict and the leash binding; `hook-canary.js`'s integrity probe iterating manifest keys only, so a cache file absent from the manifest is silently uncovered; and `kit-compact-checkpoint.js` opening a checkpoint with no check on who invoked it, which is the defence-in-depth behind guard 3. The security reviewer also confirmed the build manifest covers the new hook with matching hashes. Two spec corrections ride with this section: Section 2's file list named `docs/README.md` for the hooks file tree, which carries no such list (it lives in the repo root README), and the root README's note on removing the format-on-edit hook described its PostToolUse group as holding one command, which this change falsifies, so the note is corrected in the same edit.
Stamps: adjudicated 0 surfaced, stamped 0 new. `memq unstamped` was swept at this boundary and returned no records in either tier beyond the six stamped at the previous boundary and recorded in Chapter 2.
Gate: 1084 tests, 1082 pass, 2 fail, against the 1057 / 1055 / 2 baseline in Chapter 1, after `pwsh -File ./build.ps1` refreshed the build-stamp manifest (mandatory for any edit under `hooks/`, and the run confirmed pwsh is present on this machine). Net +27 tests, +27 passing, zero new failures, and the failure SET is identical by name in both runs, the two `test/memq-shim.test.js` short-path cases. That figure covers Sections 2, 4 and 6 together, which were corrected and gated as one.
Next: 3. The Stop hook's hold reasons name the boundary ritual (its review round is adjudicated and its fixes are in flight; Section 5's likewise)
Commit Model: Review-Only

### Interim board 1 - 2026-08-21

In-flight sections and their stage. Section 3 (the Stop hook's hold reasons) and Section 5 (the gate's deferral notes) are both built, both verified by me against their diffs, and both have had their review round adjudicated; each is now in a fixes-in-flight state with its original implementer resumed. Sections 1, 2, 4 and 6 are closed with Chapters 1 through 4. Nothing else is open.

Live dispatches and what each was asked. Two, both resumed implementer-sonnet agents carrying their own original context. The Section 3 agent has four fixes: state the gate's deferral bound truthfully (a MATCHING checkpoint, or the safety valve near the context limit, since checkpoint existence alone is insufficient once `checkpointMatches` rejects wrong-plan, wrong-session, expired and future); carry the commit-model precondition that every sibling statement of the ritual carries, because "run the boundary steps now" would otherwise land a compaction between a Chapter write and its commit under Branch-and-PR or Commit-and-Push; add the load-executing-work gloss its audience needs; and carry boundary guidance into the queue-advance reason, reversing an exclusion the spec justified on a premise I confirmed false. The Section 5 agent has five: replace the turn-count diagnostic condition, which the gate's own header falsifies by recording 19 consecutive denials as the healthy case, with the note still repeating after a Chapter has closed; name the safety valve as the deferral's bound per the Standing Brief Amendments block; rewrite the remedy in operator register with a runnable command form, `status` named before the mutating `open`, and an at-a-true-boundary qualifier; add regression cover, since deleting both new sentences currently leaves the suite green; and settle two stale header claims in the same file, the hedge about the note's audience and the description of a single checkpoint producer where there are two.

Current gate baseline. 1084 tests, 1082 pass, 2 fail, taken after `pwsh -File ./build.ps1`, against this plan's own baseline of 1057 / 1055 / 2 recorded in Chapter 1. The two failures are the same two `test/memq-shim.test.js` short-path cases by name in every run of this effort, environmental per project memory. Sections 3 and 5 were both barred from running the build and the full suite, so their fixes are covered by targeted runs only until the controller re-runs both.

Rulings adopted since the last boundary. Four, all recorded in the spec body as well as here. The dictated doctrine sentence was corrected rather than shipped, because it claimed a permanent hold the gate's safety valve refutes; that correction became a `## Standing Brief Amendments` block so the same false wording could not reach Sections 3 and 5 through their briefs. Guard 4 took the reversal its own `## Assumptions` entry named, tying the nudge to the armed plan. Guard 7 moved from heading presence to Chapter-number comparison, correcting a false negative that would have silenced the hook on the exact shape it exists to detect. Section 6 was appended for a parity pin that failed the fold predicate. Three security surfaces correctly outside this plan were routed to `docs/backlog.md` rather than left in a report.

Next action per section. Sections 3 and 5: await each agent's fix report in-turn, verify the diffs myself rather than on the report, re-run `build.ps1` and the full suite once, then Chapters and staging. After that the whole plan reaches the finishing pass, which owes a QA verification, a whole-changeset security and adversarial pair at fable, a docs curation pass, the retirement of the two backlog items this plan delivers, and the index refresh that also settles the two README files still held unstaged.

### Chapter 5 - 2026-08-21
Completed: 3. The Stop hook's hold reasons name the boundary ritual
Implemented By: implementer-sonnet, two rounds; reviewed by an adversarial and a blind reviewer at opus/xhigh
Metrics: 1 review round (four Majors and one Minor, all fixed, no re-review needed); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the section was scoped at approval as a two-string append and the review found the approved wording untrue and the approved scope short by one reason. The wording: the dictated sentence said the gate "defers auto-compaction until that checkpoint exists", and checkpoint existence is not the predicate. `checkpointMatches` in `kit-compact-lib.js` rejects a checkpoint bound to the wrong plan, the wrong session, an expired one, and a future-dated one, so a session that opened a checkpoint for the previous plan and read the reason literally would conclude it was done. All three amended reasons now say a MATCHING checkpoint, and both bounds ride together, the match requirement and the safety valve, per the Standing Brief Amendments block. The scope: the spec excluded the queue-advance reason on the stated premise that the Stop hook "itself rewrites the checkpoint as part of the advance", and the premise is false. I confirmed it in the code rather than on the reviewer's word: `advanceAndHold` rewrites only under `if (cp && checkpointMatches(cp, goal).ok)`, so it rewrites a checkpoint that already exists and already matches and mints nothing otherwise, and `test/kit-goal-stop.test.js:2532` pins that outright, that no checkpoint is minted by the advance. So a queue run whose last Chapter never opened a checkpoint crosses into the next plan carrying none, at the largest boundary the run has, and the advance reason was the one held-stop reason with no boundary guidance at all. It now carries guidance worded for its own moment, naming the finished plan rather than the newly current one, which is its own test pin. Two further corrections the round earned: the reasons now carry the commit-model precondition every sibling statement of the ritual carries, because "run the boundary steps now" would otherwise invite a compaction to land between a Chapter write and its commit under Branch-and-PR or Commit-and-Push, which is the exact mid-boundary landing the gate exists to prevent; and they name loading the executing-work skill, since a session that never loaded it is this reason's whole audience. The `spentReason` was ruled out of scope with reasoning rather than by omission: it fires only while the last assistant turn is still an already-consumed transcript entry, so no new Chapter can have closed since, and the implementer added a discriminating absence pin there and proved it can go red by temporarily injecting the fragment.
Assumptions: assumed 2026-08-21 (default, section 3): the amended reasons stay unconditional, adding no checkpoint-state read to an enforcement hook, so the sentence rides on every held stop rather than only when a checkpoint is absent; reversal: gate the sentence on a `checkpointMatches` read, which adds a file read and a failure mode to the hook that holds the leash.
Review Findings: four Majors, all fixed: the false existence-versus-match predicate, the missing commit-model precondition, the missing skill-load gloss, and the queue-advance omission. One Minor fixed (a parenthetical naming `kit-compact-checkpoint.js status` as the non-mutating way to check). One Minor deliberately not taken (restructuring the sentence for post-compaction predicate evaluability), the minimal parenthetical answering it instead. One vacuous test assertion deleted: a `!includes` check sitting under an assertion that the string was empty, which could never observe a failure.
Stamps: adjudicated 0 surfaced (`memq unstamped --since 4h` returned zero records in both tiers), stamped 1: `suite-baseline-is-not-zero-fail`, which is what let this boundary read a 2-fail suite as the environment rather than as a regression.
Gate: `node --test test/kit-goal-stop.test.js` 91 tests, 91 pass, 0 fail. The whole-suite figure rides in Chapter 6, which covers both sections after one `build.ps1` run.
Next: 5. The gate's deferral notes refresh, and the boundary note gains the diagnostic
Commit Model: Review-Only

### Chapter 6 - 2026-08-21
Completed: 5. The gate's deferral notes refresh, and the boundary note gains the diagnostic
Implemented By: implementer-sonnet, two rounds; reviewed by an adversarial and a blind reviewer at opus/xhigh; one defect found and fixed by the main session after the round
Metrics: 1 review round (five fixes) plus one main-session fix; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the spec's own diagnostic condition was false against the file it was written about, and the review caught it. The spec keyed the operator diagnostic to a turn count, and `kit-compact-gate.js`'s header records the opposite: a denied attempt is re-tried once per assistant turn indefinitely, and it records 19 consecutive denials followed by a clean checkpointed landing as the healthy observed case. A diagnostic keyed to repetition would therefore accuse every long section of a fault and invite the operator to open a checkpoint mid-section, which `executing-work/SKILL.md` forbids in as many words. The condition is now the note still firing AFTER a Chapter has closed, and the remedy carries an at-a-true-boundary qualifier so it cannot read as a mid-section directive. The main-session fix is the one this Chapter is worth reading for, because it is the shape a section-local gate cannot see: the implementer resolved "give a form that actually runs" as a repo-relative command path, `node plugins/claude-kit/hooks/kit-compact-checkpoint.js status`, and flagged the judgment call in its report. That path resolves only where the kit is dogfooded in its own checkout. The gate ships as a plugin and runs in every project on the machine, invoked through `${CLAUDE_PLUGIN_ROOT}` per `hooks.json`, so for every operator reading this note in a project other than claude-kit the command it hands them is a file-not-found, and the section's own acceptance criterion is the thing it fails. The note now composes the path from `__dirname`, the hook's own installed location, with backslashes swapped for forward slashes so a pasted path survives a shell; that is the module's own path rather than a payload, transcript, or repo value, so the fixed-string injection posture is unchanged and the header comment now states the one composed value rather than claiming the notes are wholly fixed. A test pin was added inside `assertDeny`, which every boundary-deny case runs through, asserting the note names the CLI by the absolute path the test resolves independently; it was proved discriminating rather than trusted green, returning false against the pre-fix note text verbatim. `INTERACTIVE_NOTE` was re-read against current behavior and ruled not stale, which is a decision rather than an omission. Two stale header claims were settled in the same pass: the single-checkpoint-producer phrasing now names both producers, matching `docs/architecture.md:70`, and the hedge about whether the model sees this stderr is now the confirmed present-tense fact that PreCompact stderr reaches the operator only.
Assumptions: assumed 2026-08-21 (source: `hooks.json`'s own `${CLAUDE_PLUGIN_ROOT}` invocation of every kit hook, section 5): the checkpoint command in the operator note is composed from `__dirname` rather than written as a literal, because the gate runs in every project and no literal is correct in more than one; reversal: hardcode a path, which is correct in at most the dogfooding checkout.
Review Findings: five fixes taken: the false turn-count condition replaced, the safety valve named as the deferral's bound, the remedy rewritten in operator register with `status` named before the mutating `open`, regression cover added (deleting both new sentences had left the suite green), and the two stale header claims settled. One module-level test assertion deleted as unable to fail: it compared two test-file literals rather than the child process's actual stderr, which `assertDeny` and `assertInteractiveDeny` already pin against each other. One defect found by the main session after the round and fixed here: the repo-relative command path described above.
Stamps: adjudicated 0 surfaced, stamped 0 new beyond the one recorded in Chapter 5 at this same boundary.
Gate: `pwsh -File ./build.ps1` refreshed the build-stamp manifest (mandatory for any edit under `hooks/`), then `node --test test/*.test.js` gave 1084 tests, 1082 pass, 2 fail, against this plan's 1057 / 1055 / 2 baseline in Chapter 1. Net +27 tests and +27 passing across the whole plan, zero new failures, and the failure set is identical by name in both runs, the two `test/memq-shim.test.js` Windows short-path cases that project memory `suite-baseline-is-not-zero-fail` records as environmental. Targeted before the whole-suite run: `node --test test/kit-compact-gate.test.js` 106 tests, 106 pass, 0 fail.
Next: finishing-work
Commit Model: Review-Only

### Chapter 7 - 2026-08-21
Completed: finishing-work (the whole effort)
Implemented By: main session, with a qa-verifier, a security-reviewer at fable/high, an adversarial-reviewer at fable/high, and a docs-curator
Metrics: 1 finishing round (both whole-changeset reviewers dispatched in parallel under one tree bracket); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the finishing gates ran at full strength, fable reachable, no compensation and no fallback. QA returned PASS on every section's acceptance criteria, verifying the nudge by running the shipped hook against real payloads rather than by trusting its suite: the fire case emitted the exact nested JSON, and the subagent, unbound, sibling-plan, and external-engine cases each exited 0 silent. The two whole-changeset reviewers independently found the same lead concern, which is the strongest signal this round produced because neither could have inherited it: predicate drift across the four statements of one ritual. Chapter 5 had corrected all three Stop-hook reasons from "until that checkpoint exists" to "until a matching checkpoint", because `checkpointMatches` rejects a wrong-plan, wrong-session, expired, or future checkpoint, and the nudge's REMINDER and both doctrine copies, written earlier in the same changeset, still carried the superseded predicate with a test pin locking it. Corrected in all four places as a double-edit with the pin. This is the shape a per-section review structurally cannot catch: each surface was correct against its own section's brief, and only a reader holding all four at once sees that they disagree. The adversarial reviewer also caught that the gate's operator remedy hands an absolute script path while the checkpoint CLI resolves its state from the cwd, so an operator running it from anywhere else gets a confident wrong answer; the remedy now names the project directory. Two header claims went stale in the same direction and were aligned: the gate's top-of-file header still called the deny notes wholly fixed strings after the `__dirname` composition landed, and the security model said the same. The docs-curator's claim sweep reached four docs the changeset never opened, all four falsified by one new wired hook: the canary's spawn budget (27 to 28, 17 load checks to 18), the external-engine stand-down roster in two documents, and the goal-state reader count. I re-counted the wired hooks myself rather than taking the number: `hooks.json` names 18 distinct hook files. Every drift item classified `deviation`, none a `mistake`, so nothing stopped the run.
Assumptions: assumed 2026-08-21 (default, finishing): `docs/README.md` and `docs/plans/README.md` are settled by hand at the index refresh rather than staged wholesale, because they carry a concurrent session's uncommitted registration lines for this plan alongside this run's archive edits; reversal: stage them whole, which commits another session's unreviewed work.
Review Findings: security review VERDICT CONCERNS, no Critical and no Major: three Minors, two fixed (the predicate drift, and the security model's stale "fixed string" claim) and one answered in code (the pasteable command's missing charset gate, which the doctor applies to its own interpolants; a comment now states why `__dirname` is exempt, since the value is module state and an actor controlling it already runs this file). Adversarial review VERDICT APPROVED_WITH_CONCERNS: one Major, which was the close-out obligations not yet being in the staged set, discharged by this pass; five Minors, four fixed (the predicate drift, the two docs understating guard 4 and the agent-key breadth, the gate's stale top header, the cwd caveat in the remedy) and one amended in the spec (the Approach's "fixed strings only" posture, which the queue-advance reason's sanitized plan paths are the standing exception to). One Minor considered and deliberately not acted on: the reminders order the catch-up as commit-model-honored, then memory sweep, then checkpoint open, while the skill's own loop runs the sweep before the Chapter append. For the reminders' audience, a session already past the append, the shipped order is the only one available, and all three surfaces agree with each other; the residual is a `Stamps:` field written before its adjudication, worth a line only if it ever bites. One edge routed to no destination and recorded here instead: `namesArmedPlan`'s suffix match lets an edit to a different checkout's identically-named plan doc fire one false reminder while leashed in this one, which costs a fixed string and no wrong action.
Stamps: adjudicated 0 surfaced, stamped 1 across the whole finishing pass (`suite-baseline-is-not-zero-fail`, recorded in Chapter 5). The close-out sweep is reported in the closing status.
Gate: `pwsh -File ./build.ps1` then `node --test test/*.test.js` after the fix pass: 1084 tests, 1082 pass, 2 fail, against this plan's 1057 / 1055 / 2 baseline in Chapter 1. Net +27 tests and +27 passing, zero new failures, failure set identical by name in both runs. The qa-verifier ran the same build and suite independently and reached the same figures. Tree-state brackets were captured before the QA dispatch and before the parallel review round and compared on return: no delta either time.
Drift adjudications: five items, all `deviation`, all documented as-built. The canary spawn budget (28 serial spawns, 18 load checks) in `docs/architecture.md`; the external-engine stand-down roster in `docs/security-model.md` (five to six) and `docs/fleet-integration.md` (six to seven, with the blanket claim about PostToolUse hooks narrowed to the two the marker leaves live); the goal-state reader count in `docs/security-model.md` (seven to eight); and this spec's own Section 3 lead sentence, which still said "exactly two block reasons" two sentences before recording the third, now corrected to three of four.
Operator-pending: one, carried to `docs/backlog.md` as an active item. The effort's whole premise is a failure only a live multi-hour leashed run produces, and no session can verify that the reminder changes what a session does.
Next: none; the effort is complete and archived.
Commit Model: Review-Only
