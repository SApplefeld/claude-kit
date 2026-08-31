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
- The silent-declaration failure, measured 2026-08-31 on the coordinator seat and diagnosed by the expert seat: two seats appended a "(clock read)" provenance suffix to the registry entry's Status-updated field, seat-stop.js reads that field with Date.parse under a deliberate unparseable-is-not-fresh rule, and for 13+ hours every declared boundary was silently ignored, the push succeeding, the marker never opening, and nothing reporting the gap; the writers are corrected, and the incident is this plan's live demonstration that a fail-closed parse over a session-composed stamp turns contract drift into silence on exactly the side that would care, which bears on Section 1's freshness reads and on what Section 2's nudge could say about a declaration that produced no marker. The kaizen inbox carries the general lesson dated 2026-08-31.

## Approach

No new syntax anywhere, and one new state file, which section 2 turned out to need rather than choose: the gate rebuilds its state from exactly three keys on every decision, so a per-session throttle stamp parked there is erased by the next gate write, and section 2's own text requires that throttle either way. That file is `.kit/compact-hold-nudge.json`, one entry per held session, and amending this line rather than leaving it to contradict the tree is recorded as approval drift in section 2's Chapter. Section 1 widens who may run the existing boundary verb and makes it stamp the registry record itself. Section 2 gives the existing nudge a floor and a voice for held bystander sessions. Section 3 lands the prose and document sweep. The gate's verdict logic is untouched throughout.

## Standing Brief Amendments

Every dispatch from this point carries these, and the orchestrator holds them on an inline section too.

1. **An amendment lands at every carrier of the claim it changes, not only at the site it edits.** A
   change to a mechanism restates the authoritative header, enumeration, count, and prose paragraph
   that describe that mechanism, wherever they sit in the file or the tree. This repo's own memory
   records the class (skill amendments collide with unchanged neighbours), and section 2's second
   review round found six instances in one changeset: a library section header still naming two
   state files and two log writers where the code now has three of each, a security-model
   enumeration still counting three screened write paths where there are four, a paragraph
   justifying a design on "exactly three keys" that the same changeset made four, and a test comment
   claiming real-world provenance for a value that had been replaced with a synthetic one. So after
   any mechanism change, grep the file and the tree for the counts, the enumerations, and the header
   paragraphs that describe it, and restate each. Reviewers read whole files rather than diffs,
   because the defect lives in the seam between the amended sentence and its unchanged neighbour.
2. **A reader that answers null for two different reasons is not a predicate.** Where a helper
   returns null both for "absent" and for "could not be read", never branch on that null alone at a
   site whose two directions differ in cost. Find the positive-absence discriminator (this tree
   exports `goalStateAbsent` for exactly this) or add one, so the uncertain reading takes the silent
   direction rather than the acting one.

## Sections of Work

### 1. The boundary verb serves a registered seat and stamps the record itself. Model: opus

`hooks/kit-compact-checkpoint.js`'s `boundary` verb already writes the role-boundary marker for the invoking session with no parse step. Two changes. First, when the invoking session has a registry entry (`~/.claude/coordinator/<os.hostname()>/registry/<session-id>.md`), the verb stamps a `Banked: <ISO>` line into that entry, atomically (temp-and-rename, the `seat-stop.js` Heartbeat pattern), tolerant of an absent directory or entry (silent no-op: the marker still opens; the stamp is a record, not a precondition). The line is machine-written only; no prose ever instructs a model to format it. Second, the prose scope: the peer-sessions banking paragraph currently scopes the manual path to "a session the registry does not carry"; it widens to also name a registered seat whose project tree carries work it does not own, with the durability checklist (Goal principle 3) stated at the point of use. The role skill's registry-entry shape gains the `Banked:` line, documented as CLI-stamped beside the hook-stamped `Heartbeat:`, and the directory contract's writer rule for registry files is amended in the same edit (the registering session, the seat-stop `Heartbeat:` stamp, and the boundary verb's `Banked:` stamp). Reviewer brief carries the standing note: skill amendments collide with unchanged neighbours, so reviewers read the whole file, not the diff. Third change, the moment rule (Goal principle 4, decided 2026-08-30 by the operator): the gate's marker-honor leg gains a freshness check scoped by provenance: the boundary verb stamps its marker with a machine-written declaration field (principle 1: the tool writes it, no prose instructs a model to), and the leg honors a declared marker only when no new turn has begun in the marked session since the marker's write, read by comparing the marker's write time against the session transcript's last genuine inbound-message time, user and peer lines only, never harness-injected lines (meta and skill-body injections, compaction summaries, hook outputs), with any read failure on a declared marker treated as stale rather than fresh, so this leg fails toward deferral exactly as the gate's other legs do. A marker without the declaration field is the seat-stop hook's turn-end bank, rewritten at every turn end and outside the moment rule entirely, its semantics byte-unchanged; that is what keeps the Evidence's two live allow (role-boundary) banks green as the control they are, where an unscoped predicate would deny every hook-written marker by construction, a compaction offer only ever arriving inside a later turn than the turn end that banked it. The freshness read joins the marker's session id into a transcript path (charset-gated the way the gate's other transcript reads are), which falsifies docs/security-model.md's accepted-risk claim that the marker session id is never joined to a path; that passage is updated in this same section's changeset, a false security claim never outliving the commit that falsifies it, and Section 3 verifies rather than discovers the fix. Under this scoping the suite's existing marker-release cases (`test/kit-compact-gate.test.js`, the role-boundary tests on `interactiveRepo` fixtures) stay green by construction, their markers carrying no declaration field, and a red among them under this change is a scoping defect rather than a fixture to re-stage; the freshness pair is staged on declared markers with explicit transcript times putting each test on the side of the rule it means to assert, and the read-failure-is-stale direction on declared markers is never relaxed to keep a test green. A stale marker is ignored and left in place for the status verb to report as lapsed; the 4-hour age-out is unchanged and now bounds cleanup rather than validity. Fourth change, the cancel verb: `boundary --cancel` removes the invoking session's own marker and reports whether one was there, serving the operator at a shell and a session retracting a declaration explicitly; per principle 4, nothing depends on it being run. Tests red-first: the verb stamps when an entry exists; leaves the entry byte-identical except the one line; no-ops silently without one; the marker opens in both cases; a declared marker staged before an inbound transcript message is refused by the honor leg and one with no intervening message is honored, both orders staged explicitly; an undeclared marker with an intervening inbound message is still honored (the provenance control); a declared marker followed only by harness-injected lines is still honored (the arrival-class control); `--cancel` removes only the invoking session's marker; existing parity and presence pins stay green (run the full suite, not a filename-derived lane, per testing-discipline).

Acceptance: with a registry entry present, `boundary` opens the marker and the entry gains exactly one machine-stamped `Banked:` line; without one, the marker still opens and nothing else changes; the freshness pair and the cancel test were watched red before the change and green after, beside the stamping tests; whole gate delta reported against a recorded baseline.

### 2. The deferral nudge gains a context floor and a bystander voice. Model: opus

`hooks/compact-deferral-nudge.js`: when the gate is holding offers for a session whose denial reason is the hands-on leg (`deny-interactive`, both `bystander` and `no-goal` shapes), and the episode's journaled consumed figure is at or above the floor, the nudge names the exact command (`node <plugin-root>/hooks/kit-compact-checkpoint.js boundary`, plugin root resolved the way the kit's other nudges resolve it) and the durability question it answers, in one or two lines. Below the floor, the nudge stays silent for those holds. Leashed-run nudging (chapter checkpoints) is unchanged. The floor is `compactNudgeFloor` in `~/.claude/claude-kit.local.json`, read tolerantly; absent or unparseable means the default, 285000. One implementation surprise is named rather than discovered: the gate state holds a single `episode` object, and today's journal shows a second session's denials riding while another session's episode is open, so the implementer resolves from the code whether a bystander hold always owns an episode, and if not, keys the nudge on the hold itself rather than the episode, keeping the interval throttle either way. One bound on the `no-goal` shape is stated here rather than fixed, adopted 2026-08-31 at section 2's review adjudication and recorded as approval drift in that section's Chapter. `gateStateTarget` refuses to create an absent `.kit/` unless a goal is armed, so in a project that has never carried a `.kit/` the gate records no decision, the interactive hold never opens, and the directive never fires for the `no-goal` shape. The repair that would remove that refusal is declined deliberately: it would have the kit create `.kit/` in every unarmed project a held session happens to stand in, which is what the refusal exists to prevent. So the nudge serves the `no-goal` shape only in a project that already carries a `.kit/`, which is every project that has ever armed a goal or run the boundary verb. The bound is invisible to the tests by construction, the fixture creating `.kit/` directly, and that is why it is stated rather than pinned.

Tests red-first: above-floor bystander hold nudges with the command text; below-floor hold is silent; leashed behavior unchanged; floor read from the signpost with the default on absence.

Acceptance: a held bystander session at consumed >= floor receives a nudge naming the boundary command; the same hold below the floor receives none; the leashed chapter-checkpoint nudge is byte-unchanged in its own tests; new tests watched red first; whole gate delta against a recorded baseline.

### 3. The document sweep. Model: sonnet

`docs/architecture.md`'s compaction-gate passage gains the widened boundary path, the `Banked:` stamp, and the nudge floor, in that passage's existing register (state, not journey). Its scope is widened here by section 2's second review round, which routed three further staleness items to this section rather than leaving them to be discovered: the gate state's sentence names only the open deferral episode and must also name the per-session hold list section 2 added, the journal's `event` field carries two values rather than one, and `.kit/compact-hold-nudge.json` is unnamed in a passage that enumerates the subsystem's project-local files. `docs/security-model.md` is checked for whether the registry-entry writer amendment touches any stated claim about the coordinator directory's writer rules, and updated where it does, and its marker-session-id passage is verified as already updated by Section 1's changeset; the boundary verb writing a registry line is a new mechanical writer to a single-writer file and is stated as such. The plans index (`docs/plans/README.md`) already carries this plan from its authoring commit; verify rather than re-add. No Chapter or close-out work rides here; this section is the sweep only.

Acceptance: both documents read current against the shipped code (checked by reading the code fresh, not the spec); no stale writer-rule claim about registry entries survives a tree-wide grep for the old three-writer phrasing; suite green at the recorded baseline.

### 4. The role-boundary marker is scoped per session, so two seats cannot spend each other's declarations. Model: opus

Appended 2026-08-31 during section 2's review adjudication, and recorded there and in section 2's Chapter as the approval drift it is. Section 2's review raised this independently from two lenses: the role-boundary marker is one file per project directory (`roleBoundaryPath(cwd)`, `kit-compact-lib.js`), scoped only by an inner `session` field and written by an unconditional rename, so a second seat's declaration silently unmakes the first's. The first seat is then denied at its next offer, its own hold stamp keeps its nudge quiet for the throttle interval, and it rides to the safety valve believing it declared. The security lens checked the same code and correctly found no breach, `markerMatches` refusing a foreign session so no seat can spend another's compaction; the defect is the destruction of a declaration rather than a cross-session release, and both readings stand.

The collision predates section 2 and is not that section's to fix: `seat-stop.js` renames the same file at every turn end for every registered seat with a fresh status and a clean tree, which is a far higher overwrite rate than the declaration path adds. Section 2 is what makes it reachable by prompting every held seat to declare, which is why the repair is appended here rather than left as a found surface.

The change: the marker becomes one file per session (`compact-role-boundary.<session>.json`, the session component composed through the same charset gate the other session-id path joins take), so a declaration cannot be overwritten by a peer at all. Every reader and writer moves together, `kit-compact-lib.js`'s path resolver and marker read/write pair, the gate's honor leg, `kit-compact-checkpoint.js`'s `boundary`, `--cancel` and `status` verbs, and `seat-stop.js`'s turn-end write. Markers already on disk under the old single name are read once and then ignored rather than migrated, since a marker's own life is bounded by the 4-hour age-out and by the moment rule, so the transition costs at most one lapsed declaration per seat. The scratch-path class sweep in `test/kit-compact-gate.test.js` gains the new resolver so the derived control keeps covering it. With the collision gone, the stderr note section 2 added to `cmdBoundary` has nothing left to report and is removed rather than corrected, which also retires the two review Minors against it (its firing for an already-dead incumbent, and its silence for an unreadable one).

Tests red-first: two seats declaring in sequence both keep their own markers, watched red against the current single-file shape; the gate honors each seat's own marker and refuses the other's; `--cancel` removes only the invoking session's file; a marker at the legacy single name is ignored rather than honored for a session whose own file is absent; the scratch-path class sweep and its control both name the new resolver.

Acceptance: two sessions declaring on one checkout each retain a live marker and each lands its own next offer at its own boundary; no reader or writer of the marker resolves the legacy single path except the ignore leg; the stderr note is gone from `cmdBoundary`; the class sweep's control is derived rather than hand-kept; new tests watched red first; whole gate delta reported against a recorded baseline.

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
it directly: the coordinator journal holds exactly 13 allow role-boundary decisions, all from one
session, and on three sampled decisions the newest inbound preceding each sits 0.7s, 152.4s and
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
### Interim board 2 - 2026-08-31

IN-FLIGHT SECTION AND ITS STAGE. Section 1 is implemented, reworked against the amended spec, and
its review round is adjudicated with every finding either fixed or routed. It CANNOT close for one
reason only: the section owes its own whole-gate run and the machine heavy-process claim is held by
a peer seat through roughly 12:00Z. That is a wait on the box rather than an open question, so no
ruling is pending on this section. Sections 2 and 3 are not started.

THE RULING THAT UNBLOCKED THE CRITICAL, AND ITS PROVENANCE. Interim board 1 recorded the section
held on a contradiction between Goal principle 4 and this plan's own live control. That is resolved.
The seat that authored this plan amended the spec at commit 3dff830 to scope the moment rule BY
PROVENANCE: it binds only a marker carrying the boundary verb's machine-written declaration field,
while a marker the seat-stop hook banks at a turn end keeps window semantics and the 4-hour age-out.
The controller verified this on its own surfaces rather than accepting it: the three sources the
author named (the Evidence sentence, principles 1/3/4 taking the declaration as their noun, and the
goal state's authorizations entry reading "the boundary CLI as the declaration act") all check out,
and the controller's own earlier measurement of 13 hook-written banks is exactly what the scoping
preserves. Three independent derivations agree: the author's dialog trace, two reviewers from
different artifacts, and the controller's measurement.

APPROVAL DRIFT, NAMED RATHER THAN ABSORBED. That amendment changed an approved plan mid-run. It is
a faithful record of what the operator decided in the design dialog, which mitigates it and does not
unmake it. Both seats are surfacing it to the operator independently.

THE SHARED-INDEX INCIDENT. Interim board 1 was written and staged by this session and swept into
3dff830 by the authoring seat's whole-file add. The content is intact and durable on origin; the
casualty is the record, since this session's written rationale for the entry never reached git. The
authoring seat logged its own half. Recorded here because a commit message that does not name what
it carries is invisible to every later reader.

LIVE DISPATCHES AND WHAT EACH WAS ASKED. None running. Closed this stretch: one implementer-opus
rework of section 1 against the amended spec, eleven items (DONE_WITH_CONCERNS, two concerns); the
same agent continued for one fold; one review round of three read-only reviewers via the Workflow
route at model opus and effort max, which the Agent tool cannot set (adversarial, blind, security),
all three resolved to claude-opus-5 read from the run record, so no substitution and no compensation
notch is owed; one implementer-opus fix round over the round's findings (DONE_WITH_CONCERNS, four
concerns). Workflow parallelism caps at two on this host, so the third reviewer started as the first
finished; expected behaviour rather than a never-started dispatch.

THE ROUND'S CRITICAL, CONFIRMED BY THE CONTROLLER BY MEASUREMENT. The truncated-tail coverage
inference was unsound and failed OPEN on a declared marker, the one direction the spec forbids. It
treated "some line in the tail predates the write" as proof the read reaches back past the marker,
which holds only if transcript lines are append-ordered by timestamp. They are not. Measured across
the five largest real transcripts in this project: 10,015 timestamp inversions over 66,944 timed
lines, worst backward jump 602 seconds. So an inbound sitting just before the tail boundary could be
masked by an out-of-order line inside it, and the gate would spend a marker whose moment had passed,
landing the compaction mid-turn: the exact incident this section exists to prevent.

The repair is positional rather than temporal, because position is monotonic where timestamps are
not. The declaration records where the transcript ended (a byte offset at the end of the last
complete line, plus a sha256 anchor over the preceding 4 KB) and the rule reads forward from there.
markerMomentHolds now reads no timestamp at all, confirmed by the controller against the function.
Every edge case fails toward deferral by name: replaced, unreadable, no-position, too-long, torn.

HOW THAT CRITICAL WAS FOUND IS ITSELF THE LESSON. The implementer raised the truncation leg as a
design judgment it had made beyond the spec. The controller declined to rate it and sent it to the
adversarial reviewer as an open question, explicitly unrated in both directions. The reviewer found
the defect the controller had not seen. Pre-rating it either way would have buried it.

A SECURITY MAJOR WAS FOLDED RATHER THAN PARKED. The implementer hardened one atomic write and left
the identical predictable-temp, non-exclusive-write, unconditional-unlink shape in the sibling
stamper one file away, calling it out of scope. It is not: a security Major is never parked, and two
instances of one class means the class is the finding. The fix moved the guard to the channel rather
than duplicating it, which is the standing rule that an atomic-write guard is a property of the
output channel and not of the producer that first needed it. seat-stop.js now owns no write at all.

A REVIEWER MAJOR WAS REFUTED, AND A CLAIMED EDIT DID NOT LAND. The blind reviewer rated the
coordinator runbook's every-pass paragraph a MAJOR on the ground that it rests on a marker surviving
a paced wake. The controller read the whole paragraph: it already carries the correction two
sentences on, naming the wake as an arrival and bounding the CLI fallback's marker at it. Refuted,
no change made, and the file is unmodified. Separately, the fix round reported editing that file and
had not; it described the existing state as its own edit. Caught by re-reading the tree rather than
the report, which is why a subagent's done is re-checked.

THE PRIVACY GATE WAS VIOLATED, INCLUDING BY THIS SESSION, AND IS ONLY PARTLY REMEDIABLE HERE. The
security reviewer swept the whole tree, as the standing rule requires when a privacy gate is
involved, and found a real session id in a tracked file. The controller's own wider sweep found more.
Disposition by class. Two hits were this session's own committed prose (one in this plan doc, one in
the archived judgment-sidecar plan) and are redacted in this changeset. A third, two private store
commit hashes in that same archived plan, is likewise redacted. All three are already on origin, so
the redaction cleans the working tree and does NOT remove the values from published history; that
removal is a rewrite only the operator can authorize. One hit sits in another session's uncommitted
work and was reported to that seat rather than edited. Two archived plans carry real session ids from
another project, committed long ago, and one of them records a DELIBERATE past decision to retain
them because the source records were deleted; overturning a recorded decision inside an append-only
archive is the operator's call and both are routed there untouched.

The sweep is reported against its predicate and scope rather than as a verdict. Predicate: full-UUID
shape OR a literal alternation over the five known values. Scope: tracked files. A live control on a
synthetic id withheld from the literal list matched on shape, so the instrument speaks. The limit is
stated rather than left implicit: a 7-hex commit hash has no structural form that would not also
match ordinary prose, so the named values are swept and that class is not.

RULINGS ADOPTED SINCE THE LAST BOUNDARY. One, and it is the operator's to overturn rather than the
controller's to make: the archived plans' retained session ids stay as they are pending the operator,
on the ground that an append-only archive recording a deliberate decision is not a seat's to rewrite.

CURRENT GATE BASELINE. Targeted lane plus the two whole-tree pins whose subjects these files are
(kit-compact-gate, seat-stop, hook-canary, doctrine-parity): 355 tests / 355 passing / 0 failing / 0
skipped, exit 0, run by the controller itself with the exit code read from the run rather than from a
grep. The whole-gate figure recorded in Interim board 1 (2687 / 2680 / 1 / 6) was the first
implementer's reading and is now stale by two rounds; it is superseded rather than carried. The
section close owes a whole-gate run against the recorded 2677 / 2670 / 1 / 6 from commit 9d6a800, and
that run is what the box claim is blocking.

BOX. A peer seat holds the machine heavy-process claim, extended through roughly 12:00Z, and intends
to keep it through its own finishing pass. This session did not write the claim file, ran targeted
lanes only, and named the contention on every run. One observation worth carrying: that peer reports
a foreign .NET testhost starting 51 minutes into its claim, so something on this box spawns suites
without reading the claim file, which means a clean claim read is not a clean box.

NEXT ACTION PER SECTION. Section 1: wait out the box claim, run the whole gate, report the delta
against 2677 / 2670 / 1 / 6, then Chapter 1 and the commit. Nothing else is outstanding on it.
Section 2 (the deferral nudge's context floor and bystander voice): not started, unblocked. Section 3
(the document sweep): not started; it inherits two carry-forwards this round confirmed rather than
discovered, docs/architecture.md's Heartbeat-only writer sentence and docs/security-model.md's
coordinator writer-class enumeration, and it should also add Banked: to the registry field pin.

Commit model in effect: Commit-and-Push. This entry and the privacy redactions commit alone.
Section 1's code stays unstaged until its whole gate has run: under this model the section commit
goes straight to main, and that gate is the last piece of the section's acceptance outstanding.
### Interim board 3 - 2026-08-31

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented (by a session that has since died), green
on the targeted lane, and its review round is adjudicated. It CANNOT close yet: the round returned
four Majors, of which two are fixed in this section, one is stated as a known bound, and one becomes
a new section. Section 3 is not started. This session (KIT: Worker f9ce7952) took the seat at 17:27Z
and the operator re-armed the queue onto it at 17:31Z; the predecessor left section 2 in the
worktree with no record of it anywhere, so this entry is the first record that section 2 was begun.

RECOVERY THIS SESSION PERFORMED BEFORE ANY REVIEW, because the tree was not where the plan said.
The checkout sat at 384298f, ahead 1 and behind 18 of origin/main, with the two histories reading as
parted at session start. The ahead-1 was a DUPLICATE of origin's own SIDECAR commit, verified
byte-identical on both of its files, so the parting was a double-commit rather than divergent work.
The operator directed a pull. Section 2's uncommitted work was preserved across it by byte copies
plus a captured patch under the gitignored scratch path, the three colliding files restored to HEAD
before the merge, and the two section-2 prose lines transplanted back afterwards, each onto a line
first confirmed untouched by origin. Merge 4a6ab09, clean, no conflicts.

RED-FIRST WAS PROVEN RETROACTIVELY RATHER THAN ASSUMED. No record said section 2's tests were
watched red, and a green written by a dead session proves nothing on its own. With the three hook
files reverted to HEAD and the new tests left in place, 18 of 66 failed; implementation restored
from pre-probe byte copies, restore verified by cmp on all three files and by a porcelain diff
against the pre-probe capture. Both were identical.

LIVE DISPATCHES AND WHAT EACH WAS ASKED. None running. Closed this stretch: one review round of
three read-only reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set (adversarial, blind, security). All three resolved to claude-opus-5 read from the run
record, so no substitution and no compensation notch is owed. Workflow parallelism caps at two on
this host, so the security reviewer started only as the first finished; expected behaviour rather
than a never-started dispatch, and the first-turn reading was taken on all three (assistant lines
53/52/50, synthetic 0).

THE ROUND'S FINDINGS AND THEIR ADJUDICATION.

Major, marker collision, raised INDEPENDENTLY by adversarial and blind from different angles and
cleared by security on a different question. The role-boundary marker is one file per project,
scoped by an inner session field and renamed unconditionally, while this section broadcasts the
declaration directive to every held seat: seat B's declaration silently unmakes seat A's, and the
new stderr note reaches only the overwriter. Security checked the same code and correctly found no
breach, because markerMatches refuses a foreign session, so B cannot spend A's compaction; the
defect is destruction of A's declaration, not cross-session release. Both readings stand. NOT
section 2's to fix: seat-stop.js already renames that same file at every turn end for every
registered seat, so the collision predates this section and runs at a far higher rate than anything
the section adds. The fold predicate fails, the fix being a file-naming contract across five files
plus the migration of markers already on disk, so it becomes section 4, appended this boundary.

Major, the no-goal half is bootstrap-unreachable, ADOPTED AS A STATED BOUND rather than fixed.
gateStateTarget refuses an absent .kit/ unless a goal is armed, so in a project that has never had a
.kit/ the gate writes no decision, the hold never opens, and the directive never fires for the
no-goal shape the section names. The reviewer offered two repairs and the cheaper-looking one is
refused deliberately: letting the interactive leg create .kit/ would have the kit litter that
directory into every unarmed project a held session happens to stand in, which is precisely what
that refusal exists to prevent. The bound is stated in the section text instead. The test fixture
masked it by creating .kit/ directly, which is recorded here as the reason no test caught it.

Major, guard 5H keys on a single shared slot, FIXED IN THIS SECTION. state.lastDecision is one slot
per project that every gate process overwrites for every verdict, so on the shared checkout this
plan exists for, a leashed peer's decisions displace the bystander's own and the directive is
refused for a reason unrelated to its hold. The spec's own words ask for the nudge to be keyed on
the hold itself, so this is a miss against the section's own text rather than a reviewer preference.

Major, the spec was self-amended mid-run with its approval record missing, RAISED TO THE OPERATOR.
The predecessor rewrote the approved Approach line to license .kit/compact-hold-nudge.json, with the
justification forward-referencing a section 2 Chapter that did not exist. The engineering case
checks out and both the adversarial and security reviewers independently confirmed it: nextGateState
rebuilds from exactly three keys, so a throttle stamp parked in the gate state is erased by the next
gate write. The drift is real regardless and is named here, in the Chapter, and in the close-out.

Minors fixed in this section: the replaced note firing against an already-dead incumbent marker and
going silent for an unreadable one; the inverted rationale for the floor-read ordering; the
NUDGE_EVENTS comment claiming a journal reader that does not exist; the security-model sentence
stating an eviction bound the code does not hold unconditionally; the fixture leak on the
storeHomeFixture created outside its try; the class-sweep control still a hand-kept list missing
holdNudgePath; and the new hold-stamp read taking lstat-then-open where the shared bounded reader
settles the kind on the descriptor, which is the standing hostile-boundary reuse rule.

Minors considered and REJECTED, with the reason. The gateText asymmetric-sanitize lead (blind, low
confidence) is unreachable: guard 5H establishes sameSessionId(gateText(id), id) before the stamp is
ever read and gateText is idempotent, so an id that would break the match never reaches that path.
That is security's own reasoning, checked here against the guard rather than taken from the report.

Minors ROUTED rather than fixed here: the stale doctor.ps1 enumeration of .kit/ files carrying
session ids goes to section 3's sweep, which is where that file already belongs; and the unexplained
agent_id fixture substitution, whose sweep is incomplete against an archived plan, is carried to the
section 2 fix round for either completion with its predicate and scope stated or reversion.

CURRENT GATE BASELINE. Targeted lane over the section's files plus the whole-tree pins whose
subjects they are (compact-deferral-nudge, kit-compact-gate, chapter-boundary-nudge, seat-stop,
hook-canary, doctrine-parity): 463 tests / 463 passing / 0 failing / 0 skipped, exit 0, read from
the run's own exit marker rather than from the completion notification, which reports the wrapper.
The whole gate is OWED at the section close and has not run in this session; Chapter 1 recorded
2695 / 2688 / 1 / 6 against the 2677 / 2670 / 1 / 6 baseline from commit 9d6a800, and this session
has added a merge of 18 commits since, so that figure is stale by a merge and is carried as
superseded rather than as a baseline. A merge takes the whole gate on its own account, which is a
second reason the close owes one.

BOX, NAMED RATHER THAN ASSUMED AWAY. The machine heavy-process claim is held by AI-OS: Worker,
started 14:40:00Z for 10800 seconds, so its declared bound expired at 17:40:00Z and the claim was
still on disk at 17:47Z, past its own declaration. The release is the coordinator's act and not this
session's, so this session waited ten minutes on it, then proceeded under NAMED CONTENTION without
writing the claim file, which is what the protocol permits. A process poll at that point showed no
dotnet, testhost, vstest or MSBuild at all and 14 node processes, so the slot was held by a
declaration rather than by live work.

A FOREIGN UNCOMMITTED FILE IS IN THIS TREE AND IS NOT THIS SESSION'S TO COMMIT.
kaizen/notes-SCOTT-CLAUDE.md carries six appended notes written by the live coordinator seat, on the
registry prune name-collision it adjudicated this afternoon. It is named and left; no commit of this
session carries that path.

NEXT ACTION PER SECTION. Section 2: one implementer fix round over the adjudicated fixes above, then
the whole gate under a fresh baseline, then Chapter 2 and the commit. Section 3: not started, and it
now inherits the doctor.ps1 enumeration item above on top of its existing carry-forwards. Section 4
(appended this boundary): not started, and it is the marker-collision repair.

Commit model in effect: Commit-and-Push. This entry commits alone, on the precedent Interim boards 1
and 2 set in this plan for a doc-only boundary entry; the section 2 code stays unstaged and
uncommitted until its whole gate has run, since under this model the section commit goes straight to
main.
### Chapter 1 - 2026-08-31
Completed: 1. The boundary verb serves a registered seat and stamps the record itself
Implemented By: implementer-opus (initial build), the same agent continued for one fold, then
implementer-opus again for the fix round over the review findings; no tier escalation.
Metrics: review rounds 2; NEEDS_CONTEXT 0; escalations 0; consults 0.
Decisions / Surprises: The moment rule is scoped BY PROVENANCE, per the spec amendment at 3dff830:
it binds only a marker carrying the boundary verb's machine-written declaration field, while a
marker seat-stop.js banks at a turn end keeps window semantics and the 4-hour age-out. That
amendment changed an approved plan mid-run and is named as approval drift, faithful to the
operator's recorded design decision but not unmade by that. The round's Critical was the
truncated-tail coverage inference, which failed OPEN on a declared marker: it held only if
transcript lines were append-ordered by timestamp, and measurement across the five largest real
transcripts found 10,015 inversions over 66,944 timed lines, worst backward jump 602s. Repaired
positionally, position being monotonic where timestamps are not; markerMomentHolds and its whole
call closure now read no timestamp at all, re-confirmed here against the functions with a control
proving the absence-grep can speak. A security Major was folded rather than parked: the same
predictable-temp, non-exclusive-write, unconditional-unlink shape sat in the sibling stamper one
file away, so the guard moved to the shared channel and seat-stop.js now owns no write at all.
Assumptions: The freshness read's inbound set is non-tool-result user lines PLUS queue-operation
lines (declared 2026-08-31, section 1; route (b), rulable from fact): 416 of 438 type:user lines
in a real transcript tail are tool results, so a check reading the last user line would mark every
marker stale on arrival, and a peer message lands under two types of which queue-operation is the
shape of this plan's own founding incident.
Review Findings: One Critical (the unsound truncated-tail inference) fixed. Security Majors fixed,
including the folded sibling. Majors fixed: the harness-injection classifier, the tail cap, the
status-verb transcript path, and the re-staged seat-stop fixture. One blind-reviewer MAJOR on the
coordinator runbook was REFUTED against the whole paragraph, which already carries the correction
two sentences on; the file is unmodified. The fix round separately reported an edit to that file
that never landed, caught by re-reading the tree rather than the report.
Stamps: adjudicated 13 (1 project tier, 12 operator tier), stamped 0 from the list. None steered
this section: the project-tier record is product direction on memory forks, four operator records
are another machine's facts, and the two read within the hour belong to the two peer sessions
executing the plans those records are named for. Two were stamped by name earlier in the stretch,
test-suite-invocation and suite-baseline-is-not-zero-fail, which decided the gate command and how
its delta is read.
Next: 2. The deferral nudge gains a context floor and a bystander voice
Commit Model: Commit-and-Push

GATE. Whole suite, node --test "test/*.test.js": 2695 tests / 2688 passing / 1 failing / 6 skipped,
exit 1, read from the run's own exit marker rather than from the completion notification, which
reports the wrapper. Against the recorded baseline 2677 / 2670 / 1 / 6 from commit 9d6a800: plus 18
tests, plus 18 passing, failing unchanged at 1 and skipped unchanged at 6. No regressions. The one
failure is the known permanent red on this box, test/memory-session.test.js:854, whose fixture pads
a path expecting the host temp prefix to carry it past PATH_EMIT_CAP = 260; this machine's TEMP is
seven characters, so the fixture lands at 254 and never reaches the guard. That is the guard going
unexercised rather than broken, and the defect is the test's. The delta is NOT this section's
alone: four peer commits landed between the baseline and this run (3dff830, 3074425, 78ae004,
db87ce2) plus this session's own 6b9e6cd, so the added tests are shared and only the unchanged
failure count is attributable as a no-regression reading.

BOX, NAMED RATHER THAN ASSUMED AWAY. The run was taken under declared contention, which the claim
protocol permits so long as the contention is named and the claim file is not written. A peer seat
held the machine heavy-process claim and extended it mid-wait from 6300 to 11700 seconds, moving
its release an hour out; this session waited 25 minutes on the claim, then proceeded rather than
leave reviewed work living only in the worktree for another hour. Beside that declared hold the box
carried 6 to 9 foreign dotnet processes and a live testhost from another project's session, running
under no claim at all, which is the second observation of something on this box spawning suites
without reading the claim file. The reading survived it: the run completed whole in 19.9 minutes
with no partial death, and the known memq-shim intermittent did not fire. This session did not
write the claim file at any point.
### Interim board 4 - 2026-08-31

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented, has had one fix round over interim board
3's adjudication, and that fix round's own review round is now adjudicated. It CANNOT close: the
round returned one Major that is a genuine regression this section introduced, a second Major in the
library's own section header, and a security finding, all going to a second fix round. Sections 3 and
4 are not started.

WHAT THE FIX ROUND DELIVERED, VERIFIED RATHER THAN ACCEPTED. Guard 5H no longer reads the shared
`lastDecision` slot. The gate state gained a fourth key, `interactiveHolds`, a bounded newest-first
list holding at most one deny-interactive record per session, upserted by `nextGateState` and rebuilt
validatingly on read; a state file predating the key rebuilds empty and answers no hold, which is the
fail-closed direction and is pinned. Seven tests were watched red first with their failure text
reported. The hold-stamp read moved to `kit-read-lib`'s shared bounded reader, which this section
already used one function away. The controller re-ran the lane itself rather than accepting the
report: 471 tests / 471 passing / 0 failing / 0 skipped, exit 0 read from the run's own marker,
against the recorded 463/463/0/0 on the same lane, so plus 8 and plus 8 with failures and skips
unchanged.

THE ONE DEVIATION FROM THE BRIEF, RATIFIED WITH ITS REASONING. The brief said every branch but the
interactive deny carries the hold list through unchanged. The implementer made the allow branch drop
the allower's own record and flagged it rather than absorbing it. That is correct and the literal
brief was wrong: an allow lands this session's compaction, so its hold has ended by definition, and
the shipped shared-slot design got that ceiling for free because the allow overwrote the slot. A
naive per-session list silently removes it, leaving an allowed seat reading as held for the full
four-hour idle bound and re-nudged every thirty minutes to declare a boundary it no longer needs,
about eight false directives. The filter restores a documented property and mirrors the episode
branch one line above it. The security lens checked the same branch independently and cleared it.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. The first-turn reading was taken on all three, and the tree-state bracket
compared byte-identical before dispatch and at return, so all three held read-only. Workflow
parallelism caps at two on this host, so the security reviewer started as the first finished, which
is expected behaviour rather than a never-started dispatch.

MAJOR, THE SECTION INTRODUCED A REGRESSION, raised by the blind lens and confirmed by the controller
against the code. `readGoal` answers null both for a goal state that is absent and for one it could
not read, and the nudge's fork guards its armed-but-unbound stand-down on `goal &&`, so an unreadable
goal state falls through to the hold path. A transient lock on `.kit/goal-state.json` therefore
speaks the bystander directive AT THE LEASH HOLDER, telling it it holds no leash and pointing it at a
marker the gate's boundary leg never reads, so the declaration is spent on nothing and the chapter
checkpoint it should have opened is displaced. Before this section the same transient produced
silence, which is what makes it a regression rather than a pre-existing gap, and the file's own
comment states this path is allowed to fail only in the silent direction. `kit-goal-lib.js` already
exports `goalStateAbsent` as the positive-absence discriminator, written for exactly this.

MAJOR, the library's gate-record section header describes the pre-change contract, raised by the
adversarial lens: two project-local files where there are three, two writers per file where the log
has three, three screened paths where there are four. This is the repo's own named standing defect
class and it recurred across six sites in one changeset, so the recurrence rule fires and it is
written into a new `Standing Brief Amendments` block rather than only fixed. That block is approval
drift by construction and is named as such here and in the Chapter.

MAJOR, the agent_id substitution, RESOLVED IN THIS BOUNDARY rather than routed on again. Interim
board 3 carried it for completion with its predicate and scope stated, or reversion, and the sweep
settles it in a direction neither option anticipated. The value `ae3954fd9fc0deefa` is a real agent
identifier, and `docs/security-model.md` does name a real agent identifier among the values redacted
before commit, but that bar's scope is a HARVESTED FIXTURE screened at the freezing step, which the
two test payloads are and an archived plan's Chapter is not. Archived Chapters record real agent ids
as evidence anchors deliberately and at scale, thirteen across four archived plans, one of which uses
agent transcript filenames as the lookup keys its findings are verified through. So the fixture
substitution stands and the archive is not an incomplete sweep. The controller redacted the archived
instance before finding this and reverted it in the same turn; that file is byte-identical to HEAD.
Predicate: the literal, the structural pattern `agent_id: [0-9a-f]{16,}`, and a bare 17-hex-token
shape. Scope: tracked files. Control: a synthetic 17-hex value withheld from the literal, matched on
shape, which spoke. Result: no tracked hit outside the archived Chapters the bar does not reach. The
gate's own procedure asks for the redaction to be stated in the case's own note, so the second fix
round states it at the fixture.

SECURITY, three findings, none a breach, and one a partial undo of a fix this round made. Routing the
hold-stamp read through the shared bounded reader bought the descriptor-settled kind the
lstat-then-open preamble could not give, and cost the symlink refusal that preamble did give, since
that reader follows a link at the final component by design. The read now follows a link where its
own writer refuses one, so a link planted at that path silences the directive, and a link pointing at
a dead network mount stalls a hook that runs after every covered tool return, which is the hazard the
payload-cwd network screen exists to prevent and cannot see from there. A security finding is never
parked, so it goes to the second fix round with the repair the lens named. The other two are claims
in `docs/security-model.md`, one of which the code fix restores rather than the prose.

MINORS going to the second fix round: a deny-boundary carrying the deciding session's own hold record
through, so the state asserts one session is both held and holding the leash; the hold-stamp reader
bounding staleness in one direction only, so a future-dated entry occupies a capped slot nothing can
age out, which falsifies the eviction bound this plan states in two places; `recordHoldNudge` gating
on write access to a file it never writes; a class-sweep control that cannot fail, comparing two
paths that differ by construction; a derived sweep whose predicate matches export NAMES rather than
the class it guards; and two comments the same changeset falsified.

MINOR REVIVED after the fix round refuted it, and the revival is the stronger argument. The fix round
was asked to confirm or refute the 7H-before-6H ordering rationale, explicitly unrated in both
directions, and refuted it on the case where a stamp exists. The blind lens found the case that
dominates a hold's life: below the floor no stamp is ever written, so the interval check passes on
every covered tool return and the home-directory read the ordering claims to save happens every time,
throughout exactly the suppression window the floor exists to create. Sending an open question to a
reviewer unrated in both directions is what surfaced it, the same instrument that found interim board
2's Critical.

MINOR ROUTED rather than fixed here: `docs/architecture.md`'s gate passage is stale in three further
ways, and section 3's scope is widened in this boundary to name them.

NOT ACTED ON, with the reason. The `cmdBoundary` stderr note's two Minors stay unfixed: section 4
removes that note entirely and retires them, so fixing code one section before deleting it is
throwaway work. The no-goal bootstrap bound stays a stated bound. One reviewer observation, that a
hold ending without the gate recording anything newer draws the directive about eight times over four
hours, is recorded as a bare observation rather than actioned.

CURRENT GATE BASELINE. Targeted lane over the section's files plus the whole-tree pins whose subjects
they are: 471 / 471 / 0 / 0, exit 0, run by the controller with the exit code read from the run's own
marker rather than from a grep over its output. The grep trap fired once and was caught: node's
summary lines carry a multi-byte prefix, so a byte-oriented `^.` pattern returns nothing on a passing
run and reads exactly like no output. The whole gate is still OWED at the section close, twice over,
for the push to main and for this session's merge of eighteen commits.

BOX, NAMED RATHER THAN ASSUMED AWAY. The machine heavy-process claim is still held by AI-OS: Worker,
started 14:40:00Z for 10800 seconds, so its declared bound expired at 17:40:00Z and the claim was
still on disk hours past it. Release is the holder's act and not this session's, so every run this
stretch was taken under NAMED CONTENTION with the claim file never written. A foreign `node --test`
covering an overlapping file was observed running under no claim at all during one lane run, the
third observation of something on this box spawning suites without reading the claim file.

LOCAL STATE ALTERED, NAMED because it is not this session's to leave unreported. The build stamp
`plugins/claude-kit/.claude-plugin/build-info.json` and `plugins/claude-kit.zip` were regenerated by
the fix round, both gitignored build outputs, because editing the hooks made the stamp disagree with
them and three hook-canary tests correctly reddened on it.

A FOREIGN UNCOMMITTED FILE REMAINS IN THIS TREE AND IS NOT THIS SESSION'S TO COMMIT.
`kaizen/notes-SCOTT-CLAUDE.md` carries the live coordinator seat's appended notes. Named and left; no
commit of this session carries that path.

NEXT ACTION PER SECTION. Section 2: a second implementer fix round over the findings above, then the
whole gate under a fresh baseline, then Chapter 2 and the commit. Section 3: not started, scope
widened in this boundary. Section 4: not started, the marker-collision repair.

Commit model in effect: Commit-and-Push. This entry and the new Standing Brief Amendments block
commit alone, on the precedent interim boards 1 to 3 set in this plan; section 2's code and its
`docs/security-model.md` prose stay unstaged until the whole gate has run, since under this model the
section commit goes straight to main.
