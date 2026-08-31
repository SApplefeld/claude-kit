# A seat that judges its context durable can say so with a command, and the gate hears it

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-30

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from a design dialog with the operator, 2026-08-30. Anchors are authoring-time; re-locate every hit by content, since the judgment-sidecar plan runs first and may move lines.

## Dispatch Authorization

Authorized 2026-08-30 by the operator at the keyboard in the expert seat's design dialog: the durability-declaration model for compaction boundaries (the boundary CLI as the declaration act for registered seats on shared trees, the machine-stamped registry record, and the context-floored deferral nudge), queued for execution immediately after the judgment-sidecar plan by the operator's direct instruction, for any session holding this plan; re-ordered 2026-08-31 by the operator, finally by splitting the six sidecar-disjoint plans to a parallel worktree queue, which leaves this plan directly after the sidecar again with the fleet update still at that boundary. The queue insertion into the armed goal state was itself operator-instructed in the same dialog.

## Goal

A seat whose project tree carries another session's in-flight work can never bank a compaction boundary today: `seat-stop.js` opens the role-boundary marker only when the whole tree is clean, and the dirt is not the seat's to clear. Its compaction offers are deferred until the safety valve, which lands the compaction at the worst point rather than a declared one. This plan gives such a seat a deliberate, mechanical way to declare "everything I hold is durable" and have the next offer land there, without introducing any model-authored syntax that a parser must match.

Three principles, settled in the design dialog and binding on every section:

1. **The model decides; only the machine writes parsed syntax.** Model-authored sentinel lines fail chronically (the operator's measured observation of `BLOCKED:`/`WAITING:`, which land only because a stop hook bounces the turn until the syntax is right). A hand-written declaration line would fail silently. So the declaration act is a CLI verb with no parse step, and every record of it is stamped by the tool, on the `Heartbeat:` precedent.
2. **The floor is on the nudge's voice, never the gate's verdict.** The gate keeps silently deferring any unmarked offer at any count; deferral is free. The nudge speaks only at or above the context floor, so below it there is no prompt and no checkpoint traffic.
3. **The declaration is a judgment, not a reflex.** The seat answers, at a turn end: my own worktree edits are none or handed to a named owner; every decision this stretch is on disk; messages owed are sent. All yes is the only yes.
4. **A declaration is about a moment, not a window.** A marker outlives its lull the instant new work arrives, so the gate honors one only while no new turn has begun in the marked session since it was written; a stale marker lapses silently and the nudge invites a fresh declaration at the next real boundary. Retraction never depends on the model remembering to retract, which is principle 1's logic applied to cancellation; the manual cancel verb exists for explicit retraction, and nothing depends on it being run. The rule's subject is the declaration: a marker the seat-stop hook banks at a turn end is not one, is rewritten at every turn end anyway, and keeps its existing window semantics with the 4-hour age-out; the moment rule binds only a marker whose record carries the boundary verb's own machine-written declaration field.

## Evidence

All measured 2026-08-30 on SCOTT-CLAUDE; the full graded thread is kaizen inbox note 16 with four continuations (`kaizen/notes-SCOTT-CLAUDE.md`).

- The expert seat pushed five registry statuses at declared moments; none opened the marker because the shared checkout carried the worker's uncommitted section. Gate journal: repeated `deny-interactive (bystander)` at 295K-299K consumed, safety valve the only exit.
- The live control: the coordinator seat, project directory not a git checkout, banked end to end twice the same day (`allow (role-boundary)` at 15:47Z and 16:43Z, read at its gate state directly). So the defect is the clean-tree predicate's scope, and any fix has a red case and a green control on this box.
- A second denial path exists: the predecessor coordinator was held `deny-interactive (no-goal)` at 406K. A fix scoped to the clean-tree predicate would not touch it; the CLI declaration is indifferent to why the automatic path failed.
- The consumed-token figure is already computed per decision (`kit-compact-gate.js`, `consumedFromUsage`) and journaled; the safety valve is already a consumed-token ceiling. The deferral nudge is already episode-scoped and interval-throttled (`compact-deferral-nudge.js`, `intervalElapsed` over the episode's `nudgedAt`; one observed nudge across eight denials).
- During a held episode the harness re-offers every few tens of seconds (observed offers at 15:59:10, :31, :57), so a marker written on a nudge is consumed almost immediately.
- The moment-versus-window failure, observed live 2026-08-30 in the expert seat with the operator watching: a marker declared at a genuine turn-end lull was consumed mid-turn twice, once during an adjudication begun by a queued peer message that arrived immediately after the declaration; the operator cancelled both compactions by hand and named the pattern. The same episode's journal showed 72 offers held over 42 minutes, roughly one per 35 seconds, so a marker that outlives its moment is spent at whatever the session happens to be doing next. Decided 2026-08-30 by the operator: automatic invalidation is the load-bearing fix and the manual verb a convenience beside it.

## Approach

No new state files and no new syntax. Section 1 widens who may run the existing boundary verb and makes it stamp the registry record itself. Section 2 gives the existing nudge a floor and a voice for held bystander sessions. Section 3 lands the prose and document sweep. The gate's verdict logic is untouched throughout.

## Sections of Work

### 1. The boundary verb serves a registered seat and stamps the record itself. Model: opus

`hooks/kit-compact-checkpoint.js`'s `boundary` verb already writes the role-boundary marker for the invoking session with no parse step. Two changes. First, when the invoking session has a registry entry (`~/.claude/coordinator/<os.hostname()>/registry/<session-id>.md`), the verb stamps a `Banked: <ISO>` line into that entry, atomically (temp-and-rename, the `seat-stop.js` Heartbeat pattern), tolerant of an absent directory or entry (silent no-op: the marker still opens; the stamp is a record, not a precondition). The line is machine-written only; no prose ever instructs a model to format it. Second, the prose scope: the peer-sessions banking paragraph currently scopes the manual path to "a session the registry does not carry"; it widens to also name a registered seat whose project tree carries work it does not own, with the durability checklist (Goal principle 3) stated at the point of use. The role skill's registry-entry shape gains the `Banked:` line, documented as CLI-stamped beside the hook-stamped `Heartbeat:`, and the directory contract's writer rule for registry files is amended in the same edit (the registering session, the seat-stop `Heartbeat:` stamp, and the boundary verb's `Banked:` stamp). Reviewer brief carries the standing note: skill amendments collide with unchanged neighbours, so reviewers read the whole file, not the diff. Third change, the moment rule (Goal principle 4, decided 2026-08-30 by the operator): the gate's marker-honor leg gains a freshness check scoped by provenance: the boundary verb stamps its marker with a machine-written declaration field (principle 1: the tool writes it, no prose instructs a model to), and the leg honors a declared marker only when no new turn has begun in the marked session since the marker's write, read by comparing the marker's write time against the session transcript's last genuine inbound-message time, user and peer lines only, never harness-injected lines (meta and skill-body injections, compaction summaries, hook outputs), with any read failure on a declared marker treated as stale rather than fresh, so this leg fails toward deferral exactly as the gate's other legs do. A marker without the declaration field is the seat-stop hook's turn-end bank, rewritten at every turn end and outside the moment rule entirely, its semantics byte-unchanged; that is what keeps the Evidence's two live allow (role-boundary) banks green as the control they are, where an unscoped predicate would deny every hook-written marker by construction, a compaction offer only ever arriving inside a later turn than the turn end that banked it. The freshness read joins the marker's session id into a transcript path (charset-gated the way the gate's other transcript reads are), which falsifies docs/security-model.md's accepted-risk claim that the marker session id is never joined to a path; that passage is updated in this same section's changeset, a false security claim never outliving the commit that falsifies it, and Section 3 verifies rather than discovers the fix. Under this scoping the suite's existing marker-release cases (`test/kit-compact-gate.test.js`, the role-boundary tests on `interactiveRepo` fixtures) stay green by construction, their markers carrying no declaration field, and a red among them under this change is a scoping defect rather than a fixture to re-stage; the freshness pair is staged on declared markers with explicit transcript times putting each test on the side of the rule it means to assert, and the read-failure-is-stale direction on declared markers is never relaxed to keep a test green. A stale marker is ignored and left in place for the status verb to report as lapsed; the 4-hour age-out is unchanged and now bounds cleanup rather than validity. Fourth change, the cancel verb: `boundary --cancel` removes the invoking session's own marker and reports whether one was there, serving the operator at a shell and a session retracting a declaration explicitly; per principle 4, nothing depends on it being run. Tests red-first: the verb stamps when an entry exists; leaves the entry byte-identical except the one line; no-ops silently without one; the marker opens in both cases; a declared marker staged before an inbound transcript message is refused by the honor leg and one with no intervening message is honored, both orders staged explicitly; an undeclared marker with an intervening inbound message is still honored (the provenance control); a declared marker followed only by harness-injected lines is still honored (the arrival-class control); `--cancel` removes only the invoking session's marker; existing parity and presence pins stay green (run the full suite, not a filename-derived lane, per testing-discipline).

Acceptance: with a registry entry present, `boundary` opens the marker and the entry gains exactly one machine-stamped `Banked:` line; without one, the marker still opens and nothing else changes; the freshness pair and the cancel test were watched red before the change and green after, beside the stamping tests; whole gate delta reported against a recorded baseline.

### 2. The deferral nudge gains a context floor and a bystander voice. Model: opus

`hooks/compact-deferral-nudge.js`: when the gate is holding offers for a session whose denial reason is the hands-on leg (`deny-interactive`, both `bystander` and `no-goal` shapes), and the episode's journaled consumed figure is at or above the floor, the nudge names the exact command (`node <plugin-root>/hooks/kit-compact-checkpoint.js boundary`, plugin root resolved the way the kit's other nudges resolve it) and the durability question it answers, in one or two lines. Below the floor, the nudge stays silent for those holds. Leashed-run nudging (chapter checkpoints) is unchanged. The floor is `compactNudgeFloor` in `~/.claude/claude-kit.local.json`, read tolerantly; absent or unparseable means the default, 285000. One implementation surprise is named rather than discovered: the gate state holds a single `episode` object, and today's journal shows a second session's denials riding while another session's episode is open, so the implementer resolves from the code whether a bystander hold always owns an episode, and if not, keys the nudge on the hold itself rather than the episode, keeping the interval throttle either way. Tests red-first: above-floor bystander hold nudges with the command text; below-floor hold is silent; leashed behavior unchanged; floor read from the signpost with the default on absence.

Acceptance: a held bystander session at consumed >= floor receives a nudge naming the boundary command; the same hold below the floor receives none; the leashed chapter-checkpoint nudge is byte-unchanged in its own tests; new tests watched red first; whole gate delta against a recorded baseline.

### 3. The document sweep. Model: sonnet

`docs/architecture.md`'s compaction-gate passage gains the widened boundary path, the `Banked:` stamp, and the nudge floor, in that passage's existing register (state, not journey). `docs/security-model.md` is checked for whether the registry-entry writer amendment touches any stated claim about the coordinator directory's writer rules, and updated where it does, and its marker-session-id passage is verified as already updated by Section 1's changeset; the boundary verb writing a registry line is a new mechanical writer to a single-writer file and is stated as such. The plans index (`docs/plans/README.md`) already carries this plan from its authoring commit; verify rather than re-add. No Chapter or close-out work rides here; this section is the sweep only.

Acceptance: both documents read current against the shipped code (checked by reading the code fresh, not the spec); no stale writer-rule claim about registry entries survives a tree-wide grep for the old three-writer phrasing; suite green at the recorded baseline.

## Out of Scope

- Any change to the gate's verdict logic beyond the marker-honor leg's freshness check that section 1 adds, the safety valve, or the leashed chapter-checkpoint path.
- Automatic durability detection (attributing tree dirt to sessions): rejected in the design dialog as unimplementable; the seat's judgment is the mechanism.
- A quiet-seat detector (waking an idle high-context seat between turns): routed to the machine coordinator as a machine-level item, recorded in kaizen note 16's first continuation.
- The `WAITING:`/`BLOCKED:` sentinel robustness problem itself: evidence here, fix elsewhere; a kaizen-pass candidate.

## Related

- `docs/archive/claude-kit_seat-infrastructure_spec_v1.md`: the registry entry shape and directory contract this plan amends.
- `kaizen/notes-SCOTT-CLAUDE.md` note 16 and its four continuations: the graded evidence and design thread this spec is distilled from.
- `docs/plans/claude-kit_judgment-sidecar_spec_v1.md`: runs first in the armed queue, immediately before this plan; the 2026-08-31 split moved the gate-cadence plan to a parallel worktree queue.

## Chapters
### Interim board 1 - 2026-08-31

IN-FLIGHT SECTION AND ITS STAGE. Section 1 is implemented and its review round is adjudicated.
It CANNOT close: the round returned a confirmed Critical that contradicts this plan's own Goal
principle 4, so the section is held pending a ruling on the spec rather than on the code.
Sections 2 and 3 are not started.

LIVE DISPATCHES AND WHAT EACH WAS ASKED. None running. Closed this stretch: one
implementer-opus on section 1 (returned DONE_WITH_CONCERNS, five concerns); one review round of
three read-only reviewers dispatched via the Workflow route at model opus and effort max, which
the Agent tool cannot set (adversarial, blind, security). All three resolved to claude-opus-5,
read from the run record, so no substitution and no compensation notch is owed. Workflow
parallelism caps at two on this host, so the security reviewer started only as the first
finished; that is expected behaviour rather than a never-started dispatch.

THE CRITICAL, CONFIRMED BY THE CONTROLLER RATHER THAN TAKEN FROM THE REPORTS. The moment rule
refuses every marker seat-stop.js can produce, and seat-stop.js is the marker's ordinary writer.
The mechanism: the hook writes the marker at a turn END, while a PreCompact offer only exists
while the session is issuing a request, which is inside a LATER turn that by construction began
with a NEWER inbound line. So an inbound always postdates the marker by the time any offer
arrives. Two reviewers reached this independently from different artifacts, the adversarial from
the coordinator seat's gate journal and the blind from this repo's. The controller then verified
it directly: the coordinator journal holds exactly 13 allow role-boundary decisions, all session
7c02285b, and on three sampled decisions the newest inbound preceding each sits 0.7s, 152.4s and
296.5s before it, so a marker written at the prior turn's end is older than that inbound in
every case and lapses.

WHY IT IS A SPEC CONTRADICTION RATHER THAN AN IMPLEMENTATION DEFECT. The implementer built
principle 4 faithfully. This plan's own Evidence section names those same coordinator banks as
the live green control proving the defect is scoped to the clean-tree predicate. The plan's
control and the plan's fix therefore refuse each other, which is a contradiction inside the spec
and sits in the completion contract's blocker set.

THE CONTROLLER'S OWN EARLIER READING WAS WRONG AND IS RECORDED AS SUCH. Before dispatching the
round the controller traced the implementer's first concern and concluded the seat-stop path was
unharmed, reasoning that the marker is written after its own turn's inbound so the moment holds.
That is right about the write and wrong about the read: it assumed the offer arrives in that same
gap. The measurement above is what corrected it.

RULINGS ADOPTED SINCE THE LAST BOUNDARY. One, at intake, and it is load-bearing. The spec says
the freshness check reads "the last inbound-message time, user and peer messages alike" and stops
there. Measured against a real 47 MB transcript: 416 of 438 type:user lines in the last 4000 are
TOOL RESULTS, so a check reading the last user line reads the boundary command's own tool result
and marks every marker stale on arrival. And a peer message lands under two types, 14 as user and
79 as queue-operation, the second being the shape of this plan's own founding incident. Ruled and
declared: the inbound set is non-tool-result user lines PLUS queue-operation lines. Route (b),
rulable from fact rather than from preference.

OTHER FINDINGS STANDING, none of which depend on the Critical's repair. Security MAJOR: the new
registry stamp writes through a predictable temp name with a non-exclusive write and an
unconditional unlink, missing all three defences atomicTmpPath in the same file exists to provide
and documents one function away. Security MAJOR: docs/security-model.md states the marker session
id is "never joined to a path", which this change makes false; section 3's sweep is scoped to
coordinator writer rules only, so that false claim would ship on a public surface unless section
3 widens. Adversarial and security MAJOR, one defect: the inbound classifier counts harness
injections as arrivals (310 isMeta and 153 isCompactSummary lines across 25 transcripts), so a
seat that declares a boundary and then loads a skill lapses its own declaration. MAJOR: the 512
KB tail cap converts a long working stretch into a silent lapse, and the failure correlates with
exactly the sessions the feature serves. MAJOR: the status verb derives the transcript path from
cwd while the gate uses the payload's path, and the two disagree for real seats. MAJOR: the
re-staged seat-stop fixture certifies an ordering that cannot occur in production, which is why
the suite went green over the Critical.

CURRENT GATE BASELINE. 2687 tests / 2680 passing / 1 failing / 6 skipped, exit 1, reported by the
implementer against the recorded 2677 / 2670 / 1 / 6 from commit 9d6a800; plus 10 and plus 10
with failures and skips unchanged. The single red is this machine's permanent path-length failure
at test/memory-session.test.js:854. That figure is the implementer's reading and the controller
has not re-run the whole gate since, so it is reported rather than confirmed, and the section
close owes its own whole-gate run.

NEXT ACTION PER SECTION. Section 1: the expert ask is already out to the seat that authored this
plan, asking whether the design dialog already settled that the moment rule governs the CLI
declaration path only, leaving the hook path on window semantics, which is the repair both
reviewers independently proposed. A consult follows on whatever survives, and only a genuine
preference fork goes to the operator, with the ruling attached. The independent findings above
are fixed in the same round once the repair is known, since they touch the same files. Sections 2
and 3: not started, unblocked, but held behind section 1 because section 3's sweep must state
whatever principle 4 finally says.

BOX. The controller released the machine heavy-process claim at this boundary rather than at
section 1's gate, because the section is blocked on a ruling rather than on the box, and a peer
seat was blocked on one whole-gate run.

Commit model in effect: Commit-and-Push. This entry is committed alone; the section's code stays
unstaged and uncommitted while the Critical stands.
