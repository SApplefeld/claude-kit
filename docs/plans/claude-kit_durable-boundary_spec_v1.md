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

No new syntax anywhere, and one new state file, which section 2 turned out to need rather than choose: the gate rebuilds its state from a fixed key set on every decision, four keys as it now stands, so a per-session throttle stamp parked beside them is erased by the next gate write, and section 2's own text requires that throttle either way. That file is `.kit/compact-hold-nudge.json`, one entry per held session, and amending this line rather than leaving it to contradict the tree is recorded as approval drift in section 2's Chapter. Section 1 widens who may run the existing boundary verb and makes it stamp the registry record itself. Section 2 gives the existing nudge a floor and a voice for held bystander sessions. Section 3 lands the prose and document sweep. The gate's verdict logic is untouched throughout.

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
   ADDING A CALL FALSIFIES THE CALLEE'S HEADER, and this is the trigger the clause above does not
   catch, named here because it has now recurred in three consecutive rounds of this section. A
   header reading "the single caller" or describing what its one caller's subject is, is not a
   carrier of a claim you CHANGED, so a sweep keyed on what you edited never reaches it; it is a
   carrier falsified by a call you ADDED. So the trigger is the new call site rather than the
   edit: for every function this changeset newly calls, open that function's own header and check
   that it still describes its caller set and its subject truthfully. The instances are
   `logEpisodeNudge`, whose header claimed a single caller running a screen the second caller does
   not run; `intervalElapsed`, whose header says "this episode" where the second caller's subject
   is a per-session hold stamp; and `namesNetworkShare`, whose stated fail-direction argument holds
   only for its first call site. Two of the three sat within twenty lines of the call that
   falsified them.
2. **A reader that answers one in-band value for two different facts is not a predicate, and the
   write side is where it costs most.** Where a helper returns the same value both for "absent or
   empty" and for "could not be read", never branch on that value alone at a site whose two
   directions differ in cost. The conflated value is whatever that reader's own empty answer
   happens to be, `null` and the empty list and the empty string alike, so a list reader answering
   `[]` for a file it could not read is this same defect wearing a different type, and it reads as
   ordinary code at every review. Apply it at every site the mechanism has rather than only at the
   site this amendment was learned from, which is a READ site branching on the value directly. The
   WRITE site is the other one and it costs more: a read-modify-write that rebuilds a whole file
   from that reading, where an uncertain read makes the write destroy exactly the state it set out
   to preserve, while the function's own comment goes on claiming it preserved it. Find the
   positive-absence discriminator (this tree exports `goalStateAbsent` for exactly this, and
   `readGateStateResult` shows the result-object shape a reader can take instead) or add one, so
   the uncertain reading takes the silent direction rather than the acting one. When you repair one
   site of a mechanism under this amendment, enumerate that mechanism's other sites in your
   report and say which direction each of them takes.
3. **A guard you add at a channel is owed by every caller of that channel, including the ones this
   changeset never touched.** The doctrine already states the principle, that a sanitizing or
   clamping guard is a property of the output channel rather than of the producer that first needed
   it. What defeats it in practice is scope: a guard gets added at the call site whose review found
   it, the other callers are pre-existing code the round did not open, and nothing keys a sweep on
   them. So when you establish a guard at a shared read or write, enumerate that channel's other
   callers and either extend the guard to them or state per caller why it does not apply, and
   prefer lifting the guard into the shared helper over repeating it, since a guard repeated four
   times is one a fifth caller will be written without. The instance: `readFileBounded` follows a
   symlink at the final component by design, three of its callers wrap it in an lstat refusal, and
   `nudgeFloor` does not, so the one read this section added a knob for is the one read a planted
   link can redirect or stall.

4. **A property you are tempted to assert about a channel is made STRUCTURAL at that channel, and
   pinned on names rather than on shapes.** Adopted 2026-09-01 from a consult ruling, after this
   section produced a new false cross-file claim in each of three consecutive rounds and the
   controller produced a fourth in a document. The generator is not that the claims are careless
   and not that they live in prose: it is that a claim whose truth-maker is a set of sites the
   comment cannot see was being hand-maintained, at a density this tree measures in the hundreds of
   lines per file, by four agents editing concurrently. At that density the per-round probability of
   falsifying at least one is near certain, so the defect is the expected output of the process
   rather than any round's failure.
   THE REMEDY IS A CHOKE POINT, NOT A SWEEP. Route the channel through one function so a single
   claim replaces twenty, and pin that one claim on IDENTIFIER NAMES, which a source pattern can
   actually read, never on a semantic property like "this expression is a path", which it cannot.
   The controller's own rejected proposal is the worked counter-example and is recorded because it
   looked correct: a source-side sweep asserting every path-valued print goes through the guard
   would have gone GREEN on the very defect it was written to prevent, because the bypassing sites
   emit an error reason rather than anything path-shaped, and its control, drawn from the pattern's
   own literals, would have spoken and proved nothing.
   THE GUARD GOES ON THE CHANNEL, NEVER ON THE PRODUCER, which the doctrine already says and which
   the controller's proposal also got wrong: scrubbing inside the shared library's reason builders
   would have put a channel's guard on producers that feed other channels.
   AND THE STOPPING RULE THAT COMES WITH IT: a fix round is justified only when it removes a
   hand-maintained cross-file claim or a behavioural defect. A round whose whole content is
   correcting the TEXT of such a claim is not run; the claim is deleted instead.

## Sections of Work

### 1. The boundary verb serves a registered seat and stamps the record itself. Model: opus

`hooks/kit-compact-checkpoint.js`'s `boundary` verb already writes the role-boundary marker for the invoking session with no parse step. Two changes. First, when the invoking session has a registry entry (`~/.claude/coordinator/<os.hostname()>/registry/<session-id>.md`), the verb stamps a `Banked: <ISO>` line into that entry, atomically (temp-and-rename, the `seat-stop.js` Heartbeat pattern), tolerant of an absent directory or entry (silent no-op: the marker still opens; the stamp is a record, not a precondition). The line is machine-written only; no prose ever instructs a model to format it. Second, the prose scope: the peer-sessions banking paragraph currently scopes the manual path to "a session the registry does not carry"; it widens to also name a registered seat whose project tree carries work it does not own, with the durability checklist (Goal principle 3) stated at the point of use. The role skill's registry-entry shape gains the `Banked:` line, documented as CLI-stamped beside the hook-stamped `Heartbeat:`, and the directory contract's writer rule for registry files is amended in the same edit (the registering session, the seat-stop `Heartbeat:` stamp, and the boundary verb's `Banked:` stamp). Reviewer brief carries the standing note: skill amendments collide with unchanged neighbours, so reviewers read the whole file, not the diff. Third change, the moment rule (Goal principle 4, decided 2026-08-30 by the operator): the gate's marker-honor leg gains a freshness check scoped by provenance: the boundary verb stamps its marker with a machine-written declaration field (principle 1: the tool writes it, no prose instructs a model to), and the leg honors a declared marker only when no new turn has begun in the marked session since the marker's write, read by comparing the marker's write time against the session transcript's last genuine inbound-message time, user and peer lines only, never harness-injected lines (meta and skill-body injections, compaction summaries, hook outputs), with any read failure on a declared marker treated as stale rather than fresh, so this leg fails toward deferral exactly as the gate's other legs do. A marker without the declaration field is the seat-stop hook's turn-end bank, rewritten at every turn end and outside the moment rule entirely, its semantics byte-unchanged; that is what keeps the Evidence's two live allow (role-boundary) banks green as the control they are, where an unscoped predicate would deny every hook-written marker by construction, a compaction offer only ever arriving inside a later turn than the turn end that banked it. The freshness read joins the marker's session id into a transcript path (charset-gated the way the gate's other transcript reads are), which falsifies docs/security-model.md's accepted-risk claim that the marker session id is never joined to a path; that passage is updated in this same section's changeset, a false security claim never outliving the commit that falsifies it, and Section 3 verifies rather than discovers the fix. Under this scoping the suite's existing marker-release cases (`test/kit-compact-gate.test.js`, the role-boundary tests on `interactiveRepo` fixtures) stay green by construction, their markers carrying no declaration field, and a red among them under this change is a scoping defect rather than a fixture to re-stage; the freshness pair is staged on declared markers with explicit transcript times putting each test on the side of the rule it means to assert, and the read-failure-is-stale direction on declared markers is never relaxed to keep a test green. A stale marker is ignored and left in place for the status verb to report as lapsed; the 4-hour age-out is unchanged and now bounds cleanup rather than validity. Fourth change, the cancel verb: `boundary --cancel` removes the invoking session's own marker and reports whether one was there, serving the operator at a shell and a session retracting a declaration explicitly; per principle 4, nothing depends on it being run. Tests red-first: the verb stamps when an entry exists; leaves the entry byte-identical except the one line; no-ops silently without one; the marker opens in both cases; a declared marker staged before an inbound transcript message is refused by the honor leg and one with no intervening message is honored, both orders staged explicitly; an undeclared marker with an intervening inbound message is still honored (the provenance control); a declared marker followed only by harness-injected lines is still honored (the arrival-class control); `--cancel` removes only the invoking session's marker; existing parity and presence pins stay green (run the full suite, not a filename-derived lane, per testing-discipline).

Acceptance: with a registry entry present, `boundary` opens the marker and the entry gains exactly one machine-stamped `Banked:` line; without one, the marker still opens and nothing else changes; the freshness pair and the cancel test were watched red before the change and green after, beside the stamping tests; whole gate delta reported against a recorded baseline.

### 2. The deferral nudge gains a context floor and a bystander voice. Model: opus

`hooks/compact-deferral-nudge.js`: when the gate is holding offers for a session whose denial reason is the hands-on leg (`deny-interactive`, both `bystander` and `no-goal` shapes), and the episode's journaled consumed figure is at or above the floor, the nudge names the exact command (`node <plugin-root>/hooks/kit-compact-checkpoint.js boundary`, plugin root resolved the way the kit's other nudges resolve it) and the durability question it answers, in one or two lines. Below the floor, the nudge stays silent for those holds. Leashed-run nudging (chapter checkpoints) is unchanged. The floor is `compactNudgeFloor` in `~/.claude/claude-kit.local.json`, read tolerantly; absent or unparseable means the default, 285000. One implementation surprise is named rather than discovered: the gate state holds a single `episode` object, and today's journal shows a second session's denials riding while another session's episode is open, so the implementer resolves from the code whether a bystander hold always owns an episode, and if not, keys the nudge on the hold itself rather than the episode, keeping the interval throttle either way. One bound on the `no-goal` shape is stated here rather than fixed, adopted 2026-08-31 at section 2's review adjudication and recorded as approval drift in that section's Chapter. `gateStateTarget` refuses to create an absent `.kit/` unless a goal is armed, so in a project that has never carried a `.kit/` the gate records no decision, the interactive hold never opens, and the directive never fires for the `no-goal` shape. The repair that would remove that refusal is declined deliberately: it would have the kit create `.kit/` in every unarmed project a held session happens to stand in, which is what the refusal exists to prevent. So the nudge serves the `no-goal` shape only in a project that already carries a `.kit/`, which is every project that has ever armed a goal or run the boundary verb. The bound is invisible to the tests by construction, the fixture creating `.kit/` directly, and that is why it is stated rather than pinned.

Tests red-first: above-floor bystander hold nudges with the command text; below-floor hold is silent; leashed behavior unchanged; floor read from the signpost with the default on absence.

Acceptance: a held bystander session at consumed >= floor receives a nudge naming the boundary command; the same hold below the floor receives none; the leashed chapter-checkpoint nudge is byte-unchanged in its own tests; new tests watched red first; whole gate delta against a recorded baseline.

### 3. The document sweep. Model: sonnet

`docs/architecture.md`'s compaction-gate passage gains the widened boundary path, the `Banked:` stamp, and the nudge floor, in that passage's existing register (state, not journey). Its scope is widened here by section 2's second review round, which routed three further staleness items to this section rather than leaving them to be discovered: the gate state's sentence names only the open deferral episode and must also name the per-session hold list section 2 added, the journal's `event` field carries two values rather than one, and `.kit/compact-hold-nudge.json` is unnamed in a passage that enumerates the subsystem's project-local files. Section 2's second review round routes four more carriers here, each confirmed stale against the shipped code rather than reported: `docs/architecture.md`'s nudge sentence still counts eight guards and still says the hook serves a session holding an armed leash, where the guard set now forks and the hook also serves a session holding none; the root `README.md`'s hook inventory describes `compact-deferral-nudge.js` as speaking to a leashed run alone, naming neither the second directive nor its different release; `docs/plans/README.md` and `docs/README.md` both describe this plan as Ready with three sections, where it is In Progress with four; and `plugins/claude-kit/doctor/doctor.ps1` enumerates the `.kit/` files carrying session data without naming `compact-hold-nudge.json`. The root `README.md` and `doctor.ps1` are outside `docs/` and are named here because no other section sweeps them. Section 2's third review round adds one more: `docs/fleet-integration.md` describes `compact-deferral-nudge.js` as the hook that speaks to a leashed session, the same stale single-directive descriptor already routed here for `README.md` and `docs/architecture.md`, and that file sits in no section's scope, so it is named here for the same reason the two above are. `docs/security-model.md` is checked for whether the registry-entry writer amendment touches any stated claim about the coordinator directory's writer rules, and updated where it does, and its marker-session-id passage is verified as already updated by Section 1's changeset; the boundary verb writing a registry line is a new mechanical writer to a single-writer file and is stated as such. The plans index (`docs/plans/README.md`) already carries this plan from its authoring commit; verify rather than re-add. No Chapter or close-out work rides here; this section is the sweep only.

Acceptance: both documents read current against the shipped code (checked by reading the code fresh, not the spec); no stale writer-rule claim about registry entries survives a tree-wide grep for the old three-writer phrasing; suite green at the recorded baseline.

### 4. The role-boundary marker is scoped per session, so two seats cannot spend each other's declarations. Model: opus

Appended 2026-08-31 during section 2's review adjudication, and recorded there and in section 2's Chapter as the approval drift it is. Section 2's review raised this independently from two lenses: the role-boundary marker is one file per project directory (`roleBoundaryPath(cwd)`, `kit-compact-lib.js`), scoped only by an inner `session` field and written by an unconditional rename, so a second seat's declaration silently unmakes the first's. The first seat is then denied at its next offer, its own hold stamp keeps its nudge quiet for the throttle interval, and it rides to the safety valve believing it declared. The security lens checked the same code and correctly found no breach, `markerMatches` refusing a foreign session so no seat can spend another's compaction; the defect is the destruction of a declaration rather than a cross-session release, and both readings stand.

The collision predates section 2 and is not that section's to fix: `seat-stop.js` renames the same file at every turn end for every registered seat with a fresh status and a clean tree, which is a far higher overwrite rate than the declaration path adds. Section 2 is what makes it reachable by prompting every held seat to declare, which is why the repair is appended here rather than left as a found surface.

The change: the marker becomes one file per session (`compact-role-boundary.<session>.json`, the session component composed through the same charset gate the other session-id path joins take), so a declaration cannot be overwritten by a peer at all. Every reader and writer moves together, `kit-compact-lib.js`'s path resolver and marker read/write pair, the gate's honor leg, `kit-compact-checkpoint.js`'s `boundary`, `--cancel` and `status` verbs, and `seat-stop.js`'s turn-end write. Markers already on disk under the old single name are read once and then ignored rather than migrated, since a marker's own life is bounded by the 4-hour age-out and by the moment rule, so the transition costs at most one lapsed declaration per seat. The scratch-path class sweep in `test/kit-compact-gate.test.js` gains the new resolver so the derived control keeps covering it. With the collision gone, the stderr note section 2 added to `cmdBoundary` has nothing left to report and is removed rather than corrected, which also retires the two review Minors against it (its firing for an already-dead incumbent, and its silence for an unreadable one).

Tests red-first: two seats declaring in sequence both keep their own markers, watched red against the current single-file shape; the gate honors each seat's own marker and refuses the other's; `--cancel` removes only the invoking session's file; a marker at the legacy single name is ignored rather than honored for a session whose own file is absent; the scratch-path class sweep and its control both name the new resolver.

Acceptance: two sessions declaring on one checkout each retain a live marker and each lands its own next offer at its own boundary; no reader or writer of the marker resolves the legacy single path except the ignore leg; the stderr note is gone from `cmdBoundary`; the class sweep's control is derived rather than hand-kept; new tests watched red first; whole gate delta reported against a recorded baseline.

### 5. The nudge floor survives the installers that own its file. Model: sonnet

Appended 2026-08-31 during section 2's second review round, and recorded there and in section 2's Chapter as the approval drift it is. Section 2 put its context floor in `compactNudgeFloor` in `~/.claude/claude-kit.local.json`, which the approved Approach names. The blind lens found that the file has two writers and both rewrite it wholesale from a fixed two-key template rather than merging: `setup.sh` writes it with a single `printf ... > "$SIGNPOST"` redirect on every run, unconditionally, and `doctor.ps1` rewrites it whenever the signpost is absent or its `kitRepoPath` no longer resolves. So an operator who sets a floor and later runs setup, or moves the clone and runs the doctor's fix path, loses the setting silently: the hook reads the default and nothing on any surface says the value went. The floor is the one knob section 2 ships, so a knob that cannot survive an installer run is that section's defect reached from outside its own files.

The change: both writers merge into the existing object rather than replacing it, preserving every key they do not own, and both keep their current behaviour for a signpost that is absent or that cannot be parsed, where a wholesale write is the only thing they can do. The two keys they own (`kitRepoPath`, `machine`) keep being overwritten, which is what those writers exist for. Nothing about the floor's location changes, so section 2's text stands as approved. This section's scope is widened by section 2's fourth review round to cover a second property of the same two writes, found by the security lens and confirmed at both lines: neither writer replaces the file, `setup.sh` using a truncating shell redirect and the doctor an in-place `WriteAllText`, so both FOLLOW a symlink already standing at the signpost path. A link planted there therefore turns the next setup or doctor fix run into a write of installer-composed JSON through the link to wherever it points. Both writers refuse a signpost whose final component is a link, rather than following it, and say so on the surface each already reports through; the refusal is stated as a property of the write rather than of any one caller, since both writers own the same file. Tests red-first alongside the merge cases: a link at the signpost path is refused by each writer and the file it names is left untouched.

Tests red-first: a signpost carrying `compactNudgeFloor` beside the two owned keys keeps the floor across a doctor fix-path rewrite, watched red against the current wholesale write; an absent signpost is still created with the two owned keys; a signpost whose JSON does not parse is still replaced wholesale rather than failing. The shell writer takes the same three cases if the suite can drive it, and where it cannot, the section says so rather than pinning nothing and reporting green.

Acceptance: an operator-set `compactNudgeFloor` survives both writers on a signpost that parses; the absent and unparseable cases are unchanged; new tests watched red first; whole gate delta reported against a recorded baseline.

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

### Interim board 5 - 2026-08-31

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had two implementer fix rounds; the
second round's own review is now adjudicated. It CANNOT close: two Majors are confirmed defects in the
code and go to a third fix round, and one Major is a spec-adjacent defect that became section 5 in this
boundary. Sections 3, 4 and 5 are not started.

WHAT FIX ROUND 2 DELIVERED, VERIFIED RATHER THAN ACCEPTED. Eleven adjudicated items, all dispositioned.
The regression interim board 4 named is repaired at the read site: the nudge now discriminates an absent
goal state from an unreadable one through `goalStateAbsent`, and the unreadable reading takes the silent
direction, pinned in three shapes watched red first. The hold-stamp read regained its symlink refusal
without losing the descriptor-settled kind, the library's gate-record section header was restated across
four paragraphs, a deny-boundary now drops the deciding session's own hold record, the staleness bound
became two-sided, `recordHoldNudge` was narrowed off the gate state's own legs by extracting
`gateScratchTarget`, and two test instruments that could not fail were rebuilt with controls that spoke.
The controller re-ran the lane itself rather than accepting the report: 479 tests / 479 passing / 0
failing / 0 skipped, exit 0 read from the run's own marker, against the recorded 471/471/0/0 on the same
lane, so plus 8 and plus 8 with failures and skips unchanged.

ONE BRIEF INSTRUCTION THE IMPLEMENTER CORRECTLY REFUSED. The brief named `containedRealPath` as the
repair for the symlink finding. The implementer checked it and refused it with the reason: that helper
resolves a path and judges containment, and does not refuse an in-tree link, which is the property the
gate's sibling reads actually have. It used the siblings' own lstat rule instead and edited nothing in
the file that owns the helper. The refusal is correct and the brief was wrong; the security lens
independently judged the shipped composition equal-or-stronger than the siblings it mirrors.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. Workflow parallelism caps at two on this host, so the security reviewer
started as the first finished, which is expected behaviour rather than a never-started dispatch, and the
first-turn reading was taken on every dispatch. The tree-state bracket returned one delta and it was NOT
a reviewer's: a peer session committed `install-memory-sync.ps1` out of the worktree and left a new
untracked plan doc for a different plan behind. Read-only reviewers do not author plan docs, and the
content is recognizably another effort's, so it is recorded as concurrent peer activity rather than
routed as a review incident.

MAJOR, THE AMENDMENT CAUGHT THE SITE IT NAMED AND NOT THE CLASS, which is the round's most useful
finding and the reason section 2 is not closing. Standing Amendment 2 was written after the read-site
defect and delivered in fix round 2's brief. The implementer repaired the read site exactly as directed,
and the adversarial lens then found the SAME defect shape at the write site of the same mechanism, in the
same changeset. `readHoldNudges` answers the empty list for "no stamps", for "the file is absent", and
for "the file is there and could not be read", and `recordHoldNudge` rebuilds the whole file from that
reading and renames it into place, so an uncertain read takes the acting direction and overwrites every
other held session's stamp, collapsing their intervals. The function's own comment claims the
read-modify-write preserves them. Reachability is narrow, the read must fail while the lstat, the
writability test and the rename all succeed, which is why the lens rated its confidence medium and the
defect's reality not at all. Confirmed by the controller at the lines. The lesson is about the
instrument rather than this bug: an amendment phrased at the site it was learned from is obeyed at that
site, so amendment 2's own text is widened in fix round 3's brief to name the write side explicitly.

MAJOR, THE FUTURE-SKEW ALLOWANCE IS NET-HARMFUL AND CONTRADICTS THE IMPLEMENTER'S OWN DECLARED JUDGMENT.
Fix round 2 made the staleness bound two-sided and chose a two-minute forward allowance, declaring the
choice rather than absorbing it, on the reasoning that dropping every future-dated entry would let a
backward clock step collapse every live interval at once. The blind and security lenses independently
found the reasoning half wrong, and the controller confirmed it at the line: `intervalElapsed` returns
true when the elapsed time is negative, so a kept future-dated stamp throttles nothing at all while it
occupies one of the eight capped slots. The allowance therefore buys none of what it was chosen for and
costs exactly the hazard it was meant to avoid. The declared judgment is what made this catchable, which
is the argument for declaring one rather than absorbing it.

MAJOR, AMENDMENT 1'S CLASS RECURRED WITH AMENDMENT 1 IN EFFECT, twice. `logEpisodeNudge`'s header still
says it has a single caller which runs `gateStateTarget` first; the same changeset gave it a second
caller which runs `gateScratchTarget` instead, so both facts in one sentence are now false. And the
Approach line of this very plan still justified the separate stamp file on the gate state rebuilding
from "exactly three keys", which is verbatim one of the six sites the Standing Brief Amendments block
lists in its own text. Both confirmed at the lines. The plan's own carrier is corrected in this
boundary; the library's goes to fix round 3.

MAJOR, MINE RATHER THAN THE IMPLEMENTER'S, FIXED IN THIS BOUNDARY. Interim board 4's own security-model
edit raised a count to four screened write paths and left the enumeration beneath it naming three, which
is precisely the half-fix amendment 1 exists to prevent, committed by the session that wrote the
amendment. Corrected here, and the fourth writer is now named. The same paragraph's sibling claim, that
the gate state steers three things, was falsified by this section's fourth state key and is corrected
here too, with the hold list's own steering and its degradation stated.

ONE REPORTED CARRIER REFUTED RATHER THAN FIXED. Fix round 2 reported `docs/security-model.md`'s "the
gate writes two more ordinary files" as a genuine stale carrier. It is not: that sentence's subject is
the gate, which writes exactly those two, while the hold-stamp file is the deferral nudge's and is
described in the nudge's own paragraph further down. Read against the code the sentence is true as
written and is left unchanged.

MAJOR ROUTED OUT AND MADE A SECTION. The blind lens found that section 2's floor setting lives in
`~/.claude/claude-kit.local.json`, a file whose two writers both rewrite it wholesale from a fixed
two-key template rather than merging, so an operator-set floor is erased silently by any setup run or by
the doctor's fix path. Confirmed at `setup.sh`, whose write is a single unconditional redirect. This is
section 2's own knob failing from outside section 2's files, so it serves this plan's goal and does not
fold: it lands in files no section touches and needs its own acceptance. Appended as section 5 in this
boundary and named to the operator as the approval drift it is.

MINOR ROUTED rather than fixed here: four further stale carriers, each confirmed against the shipped code
rather than reported, widen section 3's scope in this boundary. `docs/architecture.md` still counts eight
guards and still says the hook serves only a leashed run; the root `README.md`'s hook inventory names one
directive where there are two; `docs/plans/README.md` and `docs/README.md` both describe this plan as
Ready with three sections; and `doctor.ps1` enumerates the `.kit/` session-data files without naming the
new one. The last two sit outside `docs/` and are named in section 3 explicitly because nothing else
sweeps them.

NOT ACTED ON, with the reason. The `cmdBoundary` stderr note's Minors stay unfixed on interim board 4's
reasoning, section 4 removing the note outright; the blind lens independently found a third Minor in the
same note and it is retired by the same removal. The nudge floor's dependence on a low auto-compact
trigger is recorded as a reachability note rather than actioned, its fail direction being silence.

CURRENT GATE BASELINE. Targeted lane over the section's files plus the whole-tree pins whose subjects
they are: 479 / 479 / 0 / 0, exit 0, run by the controller with the exit code read from the run's own
marker rather than from a grep over its output. The whole gate is still OWED at the section close, twice
over, for the push to main and for this session's earlier merge.

BOX, NAMED RATHER THAN ASSUMED AWAY. The stale claim interim board 4 recorded, held hours past its
declared bound, has been released by its holder. Fix round 2 and the controller's own lane each polled
the claim file, found it absent, wrote a claim under this session's id and deleted it scoped to that id.
The machine coordinator read one of those claims live and reported its `Started` field as roughly three
hours in the future: confirmed, and the cause is this skill's own dispatch brief, which tells an agent to
write `Started: <ISO now>` and leaves the reading to the agent, which composed a value rather than
reading a clock. The controller's own claim was written from a clock evaluated in the same command. The
coordinator also reports, and this session cannot verify from here, that the claim file is a tracked and
synced artifact which a rebase can overwrite and a replay can resurrect; that finding is another
session's and is routed to the expert seat with the operator's authorization.

LOCAL STATE ALTERED, NAMED because it is not this session's to leave unreported. The build stamp
`plugins/claude-kit/.claude-plugin/build-info.json` and `plugins/claude-kit.zip` were regenerated again
by fix round 2, both gitignored build outputs, after three hook-canary tests correctly reddened on the
stale stamp.

FOREIGN UNCOMMITTED WORK REMAINS IN THIS TREE AND IS NOT THIS SESSION'S TO COMMIT.
`kaizen/notes-SCOTT-CLAUDE.md` carries the live coordinator seat's appended notes, and an untracked plan
doc for the sidecar staleness effort appeared during the review round. Named and left; no commit of this
session carries either path.

NEXT ACTION PER SECTION. Section 2: a third implementer fix round over the two confirmed code Majors and
the test-instrument Minors, with Standing Amendment 2 widened to name the write side, then the whole gate
under a fresh baseline, then Chapter 2 and the commit. Section 3: not started, scope widened twice.
Section 4: not started, the marker-collision repair. Section 5: not started, appended in this boundary.

Commit model in effect: Commit-and-Push. This entry, the new section 5, the corrected Approach line and
section 3's widened scope commit alone, on the precedent interim boards 1 to 4 set in this plan; section
2's code and its `docs/security-model.md` prose stay unstaged until the whole gate has run, since under
this model the section commit goes straight to main.
### Interim board 6 - 2026-08-31

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had three implementer fix rounds; the
third round's own review is now adjudicated. It CANNOT close: two confirmed Majors and a cluster of
comment-and-prose defects go to a fourth round. Sections 3, 4 and 5 are not started. What changed about
this boundary is the diagnosis rather than the finding count: the round named the GENERATOR behind a
class that has now recurred three rounds running, and the amendments block gains a trigger and a whole
new amendment as a result.

WHAT FIX ROUND 3 DELIVERED, VERIFIED RATHER THAN ACCEPTED. All three Majors landed and the controller
confirmed each at the lines rather than from the report. `readHoldNudges` split into
`readHoldNudgesResult`, a result-object reader on `readGateStateResult`'s shape, and `recordHoldNudge`
now returns false and writes nothing on an uncertain reading, so an unreadable stamp file no longer
erases every peer session's stamp. The future-skew allowance is deleted outright and the reader drops
any future-dated entry. `logEpisodeNudge`'s header names both callers and both screens. The controller
re-ran the lane itself: 480 tests / 480 passing / 0 failing / 0 skipped, exit 0 read from the run's own
marker, against the recorded 479/479/0/0, so plus 1 and plus 1 with failures and skips unchanged. The
implementer's own byte-comparison claim was re-checked rather than accepted: `cmp` confirms exactly
three of the six in-scope files changed this round and three are byte-identical to their pre-round
copies.

THE ROUND'S RED-FIRST EVIDENCE IS THE STRONGEST THIS PLAN HAS SEEN, and one leg of it is the reason to
trust the rest. Asked to rebuild a guard-5H control that could not fail, the implementer ran the
PRE-ROUND copy of that test against a deliberately broken guard, in the same process, and watched it
PASS. That is a positive demonstration that the old instrument was blind, rather than an assertion
that it was. Its own first rebuild also passed against the broken guard and was discarded for that
reason before the third attempt spoke.

THE GENERATOR, NAMED, which is this boundary's real output. Amendment 1 has been in effect for three
rounds and its class recurred in all three. The reason is now precise: amendment 1 keys on the claim
you CHANGED, and the recurring defect is a header falsified by a call you ADDED. A header reading "the
single caller", or describing what its one caller's subject is, is not a carrier of anything the
implementer edited, so no sweep keyed on the edit ever reaches it. Three instances, all confirmed at
the lines: `logEpisodeNudge` (fixed this round), `intervalElapsed`, whose header still says "this
episode" where its second caller's subject is a per-session hold stamp, and `namesNetworkShare`, whose
fail-direction argument holds only at its first call site. Two of the three sit within twenty lines of
the call that falsified them. Amendment 1 gains that trigger in this boundary, stated as the new call
site rather than the edit.

THE SECOND GENERATOR, AND A NEW STANDING AMENDMENT 3. The adversarial lens found that `nudgeFloor`
reads the machine-local signpost through `readFileBounded` with no symlink refusal, where three
sibling reads have one, including the one this very section added for exactly that reason. Confirmed
at the line. The doctrine already owns the principle, that a guard is a property of the channel rather
than of the producer that first needed it; what defeats it is scope, since the other callers are
pre-existing code a round never opens. Amendment 3 keys on establishing a guard at a shared channel
and puts that channel's other callers in scope, preferring the guard lifted into the shared helper
over a fourth hand-written copy.

MAJOR, THE ROUND'S OWN AMENDMENT-1 FIX INTRODUCED A FRESH AMENDMENT-1 DEFECT. The restated library
section header now claims the gate state's per-session hold list is "read by the checkpoint CLI's
status report and by the deferral nudge". Confirmed by count: the checkpoint CLI contains ZERO
references to `interactiveHolds` or `holdNudgePath`. Raised by the blind lens, which had no access to
the amendment that generated it.

MAJOR, CONVERGED FROM THREE LENSES INDEPENDENTLY, on the residual of this round's own repair. Refusing
the write on an uncertain reading is correct and stays, but it converts four previously self-healing
readings into PERMANENT silence: an oversized, link-planted or unreadable `compact-hold-nudge.json`
makes `recordHoldNudge` return false forever, with no surface reporting it and no self-heal, where the
unparseable-JSON reading one line away deliberately repairs itself. The security lens adds the reach:
the strict read-only agent class is permitted to write exactly `.kit/`, and unlike a planted marker
this has no age-out. The reader already computes a `reason` at four legs that NO caller reads. The
adjudicated repair takes both halves: self-heal the two legs that are provably not this writer's
output (`bounded`, `kind`) by unlinking before the write, and keep the refusal for `unreadable` and
`lstat`, which may be a transient lock over a real list; then surface the refusal in the status verb,
on `reportGateState`'s existing reason-driven pattern.

A REJECTED FINDING RE-CONFIRMED RATHER THAN RE-LITIGATED. The security lens re-raised the
`gateText(sessionId)`-stored-versus-raw-`sessionId`-compared asymmetry that interim board 3 rejected as
unreachable. The controller re-checked the guard rather than citing the old ruling: guard 5H at
`compact-deferral-nudge.js:581` runs before guard 7H at `:600` and requires
`sameSessionId(gateText(id), id)` to hold before any stamp is read, so the mismatch is still
unreachable, and the lens itself rates it latent. It folds into round 4 as one-line hardening rather
than as a defect, because it is trivial, in scope, and removes a trap a later caller would fall into.

FINDINGS ROUTED TO SECTIONS THAT ALREADY OWN THEM, rather than fixed. The blind lens independently
re-found the installer erasure of `compactNudgeFloor`, which became section 5 in the previous boundary,
and the `cmdBoundary` collision note's silence on non-absent nulls, which section 4 retires by deleting
that note. Both stand as already-routed. The lens also re-raised the no-goal bootstrap bound, adopted
as a stated bound in interim board 3; its refinement is genuine and is carried to round 4, that the
bound is stated in the SPEC and nowhere in the code's own header.

MINOR ROUTED to section 3, whose scope is widened again in this boundary: `docs/fleet-integration.md`
carries the same stale single-directive descriptor already routed here for the root `README.md` and
`docs/architecture.md`, and sat in no section's sweep scope at all.

DOCS CORRECTED IN THIS BOUNDARY BY THE CONTROLLER, since `docs/` is barred to subagents. Four
`docs/security-model.md` items, two of them the controller's own prose from earlier boundaries: an
ordinal calling the hold-stamp writer "the fourth path" while standing second in its own enumeration;
a claim that the signpost is the only steering input outside the project, which the hook's own comment
contradicts for a store-resident seat; an enumeration of the reads a symlinked `.kit` redirects that
omitted the hold-stamp read this section added; and a bound stating that a forged hold "reaches no
marker", which understated it, since the directive's whole purpose is to induce the reader to run the
verb that writes one. That last is a security surface and the correction names the induced chain and
what actually gates it.

CURRENT GATE BASELINE. Targeted lane over the section's files plus the whole-tree pins whose subjects
they are: 480 / 480 / 0 / 0, exit 0, run by the controller with the exit code read from the run's own
marker file. The grep trap fired again and was caught again: node's summary lines carry a multi-byte
prefix, so the anchored pattern returned nothing on a passing run and read exactly like no output. The
whole gate is still OWED at the section close, twice over, for the push to main and for this session's
earlier merge.

BOX, NAMED RATHER THAN ASSUMED AWAY. The peer's long-held claim was released during this stretch, so
the controller's own lane ran under a claim written with the clock read at the write rather than
composed, and released scoped to this session's id at the run's end. Three foreign dotnet or testhost
processes were running under no claim at all at the time of the write, the fourth such observation
recorded on this box, so the claim was taken with that contention named rather than on a clean box.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. The first-turn reading was taken on every dispatch. Workflow parallelism
caps at two on this host, so the security reviewer started as the first finished, which is expected
behaviour rather than a never-started dispatch. The tree-state bracket returned a delta and it was NOT
a reviewer's: authorship was established by READING THE CONTENT rather than by recognizing the path,
and the one-line change to `docs/architecture.md` is about the judgment sidecar's advisory batch
budget, which is the peer session's effort.

FOREIGN UNCOMMITTED WORK REMAINS IN THIS TREE AND IS NOT THIS SESSION'S TO COMMIT.
`kaizen/notes-SCOTT-CLAUDE.md` carries the coordinator seat's notes, and the peer's sidecar effort now
holds ten paths including `docs/architecture.md` and a plan doc of its own. Named and left; no commit
of this session carries any of them.

NEXT ACTION PER SECTION. Section 2: a fourth fix round, whose unit of work is deliberately different
from the three before it. Those rounds repaired named sites and the next round found the same class at
a new site each time, which is the definition of the workflow generating the bug, so round 4 sweeps
each class to exhaustion rather than fixing a list: every function the changeset newly calls, checked
against its own header; every caller of `readFileBounded`, checked for the link refusal; then the
self-heal and the status surface. Then the whole gate under a fresh baseline, then Chapter 2 and the
commit. Section 3: not started, scope widened a third time. Section 4: not started. Section 5: not
started.

Commit model in effect: Commit-and-Push. This entry, the widened Standing Amendment 1, the new Standing
Amendment 3 and section 3's widened scope commit alone, on the precedent interim boards 1 to 5 set in
this plan; section 2's code and its `docs/security-model.md` prose stay unstaged until the whole gate
has run, since under this model the section commit goes straight to main.
### Interim board 7 - 2026-08-31

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had four implementer fix rounds; the
fourth round's own review is now adjudicated. It CANNOT close: one Major converged from all three lenses
and is confirmed at the lines, two further Majors are confirmed, and a cluster of comment and test
defects goes to a fifth round. Sections 3, 4 and 5 are not started. Round 4 was the round that swept by
CLASS rather than by site, and the sweeps themselves came back sound; what defeated it is narrower and
more interesting than a missed site, and is the entry below.

WHAT FIX ROUND 4 DELIVERED, VERIFIED RATHER THAN ACCEPTED. Both class sweeps ran and both are reported
as enumerations with a per-item verdict, which is what the round was for. The added-caller sweep checked
20 kit-defined callees against their own headers, fixed 6, exempted 13 with the rule naming each, and
reported 1 out of scope. The `readFileBounded` sweep enumerated all 9 call sites outside the library
with a per-caller verdict, fixed the one defect, deliberately declined the guard at a second with a
stated reason, and edited none of the 7 out of scope, which the controller confirmed by diffing all five
out-of-scope files against HEAD: every one byte-identical. The guard was lifted into the shared helper as
an OPT-IN (`refuseLink`) defaulting to today's behaviour, which the controller directed for a reason it
records here: an unconditional refusal inside `readFileBounded` would have changed behaviour for seven
callers nobody reviewed, `session-start.js` among them, on every session start. The controller re-ran the
lane itself: 483 tests / 483 passing / 0 failing / 0 skipped, exit 0 read from the run's own marker,
against the recorded 480/480/0/0, so plus 3 and plus 3 with failures and skips unchanged.

THE ROUND'S OWN AMENDMENT RECURRED INSIDE THE ROUND THAT SWEPT FOR IT, and this is the boundary's real
finding. All three lenses converged INDEPENDENTLY on it and the controller confirmed it at the line.
Round 4's self-heal unlinks the hold-stamp file when the reader answers `bounded`, justified on the
ground that this writer's own file "cannot approach the cap". But `readFileBounded` sets `bounded` for
TWO different facts: the ceiling binding (`kit-read-lib.js:185`) and a fill loop ending short
(`:192`), the second meaning the file was truncated under the read or a device stopped answering. The
reader's own comment says so in terms: "It reads no differently to a caller than the ceiling binding, so
it sets the same flag." So a file this writer DID produce reaches the destructive branch, and the unlink
then erases every peer session's live stamp, which is exactly the defect fix round 3 closed. That is
Standing Amendment 2's shape verbatim, one in-band value for two facts branched on at a write site whose
two directions differ in cost, introduced by the round whose brief carried Amendment 2 and whose sweeps
were aimed at Amendment 1 and Amendment 3. The lesson is not that the sweeps failed. They did not. It is
that a round which ADDS a destructive branch owes that branch its own reading of every value it keys on,
and no class sweep keyed on headers or on callers reaches a predicate that is simply wrong.

MAJOR, THE NEW TEST FAILS ON POSIX RATHER THAN SKIPPING, raised by the adversarial and security lenses
independently and confirmed by the controller against the repo's own idiom. The signpost-link pin plants
its link by shimming `fs.lstatSync`, and `readFileBounded` consults lstat only on the branch guarded by
`!fs.constants.O_NOFOLLOW`. That constant is undefined on win32 and defined on Linux and macOS, so off
Windows the shim is never consulted, the real file opens, and the assertion fails rather than skipping.
The repo carries the `{ skip: process.platform !== 'win32' }` idiom at four sites for exactly this shape.
The consequence beyond portability is the one worth recording: the O_NOFOLLOW leg, which is the half that
actually closes the window on every platform that has it, is exercised by nothing, and
`test/kit-read-lib.test.js` gained no pin at all for an option added to the reader it owns.

MAJOR, A FALSE SECURITY CLAIM WAS CAUGHT IN THE WORKING TREE, AND IT WAS THE CONTROLLER'S OWN. The
implementer's code comment and the controller's `docs/security-model.md` prose both justified the new link
refusal on the ground that "the two installers that own this file both rename a regular file into place".
The security lens checked the installers rather than the claim: `setup.sh:34` is a truncating shell
redirect and `doctor.ps1:390` is an in-place `WriteAllText`, so neither renames and BOTH FOLLOW a link
already standing at the path. Confirmed by the controller at both lines. The claim was plausible,
internally consistent between a code comment and a document, and accepted by two parties before anyone
read `setup.sh`, which is the standing lesson that document agreement is not evidence. It never reached a
commit: the prose is corrected in the working tree and the code comment goes to round 5, re-justified on
what the refusal actually does rather than on a property of the file's writers.

THE INSTALLERS' OWN FOLLOW-THROUGH IS A REAL EXPOSURE AND WIDENS SECTION 5 RATHER THAN ROUND 5. Since
both writers follow a link at the signpost, a link planted there makes the next `setup.sh` or doctor fix
run write attacker-influenced JSON through it to wherever it points. Section 5 already owns both writers
and is already changing how they write, so the fold predicate fails for round 5 and the item lands where
the work already is. Section 5's scope is widened in this boundary and named as the approval drift it is.

MAJOR ROUTED TO SECTION 3 rather than fixed. Two `docs/security-model.md` claims about the shared reader
were left byte-unchanged by a changeset that falsified them: "Nothing stats a path before the open", now
false on win32 for an opt-in caller, and "The boundary follows a symlink rather than refusing one",
missing the by-default qualifier. Both are corrected by the controller in this boundary rather than
routed, since `docs/` is barred to subagents and a false security claim never outlives the commit that
falsifies it.

FINDINGS STANDING AS ALREADY-ROUTED, re-found independently and correctly. The blind lens re-found the
marker-collision fan-out (section 4) and the installer erasure of `compactNudgeFloor` (section 5), and
re-raised the replaced-marker note's assertion of harm to an already-lapsed peer, which section 4 retires
by deleting that note outright. All three stand where they are. The up-to-eightfold repeat of the
directive on a hold that has already ended stays a recorded observation rather than an action, on interim
board 4's reasoning.

A FINDING ROUTED OUT OF THIS PLAN. Two out-of-scope callers of the hardened channel,
`memory-recognition-nudge.js:1295` and `session-start.js:708`, read files their own writers create with
no link refusal, which the round enumerated and correctly declined to edit. They serve other hooks'
hardening rather than this plan's goal, so they go to `docs/backlog.md` with the reason rather than into
a section here.

CURRENT GATE BASELINE. Targeted lane over the section's files plus the whole-tree pins whose subjects
they are: 483 / 483 / 0 / 0, exit 0, run by the controller with the exit code read from the run's own
marker file. The whole gate is still OWED at the section close, twice over, for the push to main and for
this session's earlier merge.

BOX, NAMED RATHER THAN ASSUMED AWAY. A peer seat wrote a 300-second claim mid-stretch and was still
holding it 2.5 minutes past its own declared bound. Release is the holder's act, so the controller waited
the full five minutes, then ran its lane under NAMED CONTENTION without writing the claim file, which is
what the protocol permits. Four foreign dotnet processes were running beside it. The fix round's own two
lane runs each found the claims directory empty, wrote a claim with the clock read at the moment of the
write rather than composed, and deleted it scoped to this session's id.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. The first-turn reading was taken on every dispatch that had one; Workflow
parallelism caps at two on this host, so the security reviewer had no transcript at the first-turn window
and started as the first finished, which is expected behaviour rather than a never-started dispatch. The
tree-state bracket returned one delta and it was NOT a reviewer's: authorship was established by READING
THE CONTENT rather than by recognizing the path, and the two added lines in `sidecar/install-daemon-task.ps1`
report the sidecar daemon's own log paths, which is the peer session's effort.

HEAD MOVED UNDER THIS SESSION MID-ROUND. A peer committed 530fcee while the review round was in flight.
Its fourteen files are entirely that session's sidecar effort and none is a section 2 file, confirmed by
diffing the commit's own file list against this section's; this session's uncommitted work is intact and
the review round's base ref was taken as 530fcee rather than the stale one.

FOREIGN UNCOMMITTED WORK REMAINS IN THIS TREE AND IS NOT THIS SESSION'S TO COMMIT.
`kaizen/notes-SCOTT-CLAUDE.md` carries the coordinator seat's notes and the peer's sidecar effort holds
several paths of its own. Named and left; no commit of this session carries any of them.

NEXT ACTION PER SECTION. Section 2: a fifth fix round, narrower than the fourth by design, since the
fourth's sweeps came back sound and what it owes is the destructive branch's own predicate rather than
another sweep. Its items: split the reader's `bounded` into a ceiling leg and a short-fill leg and heal
only the ceiling; give the new pin its platform guard and pin the O_NOFOLLOW leg in the reader's own
suite; re-justify the link refusal's code comment on what the refusal does; and the comment and status
minors. Then the whole gate under a fresh baseline, then Chapter 2 and the commit. Section 3: not
started, and its `docs/security-model.md` items were corrected in this boundary rather than left to it.
Section 4: not started. Section 5: not started, scope widened in this boundary.

Commit model in effect: Commit-and-Push. This entry and section 5's widened scope commit alone, on the
precedent interim boards 1 to 6 set in this plan; section 2's code and its `docs/security-model.md` prose
stay unstaged until the whole gate has run, since under this model the section commit goes straight to
main.
### Interim board 8 - 2026-09-01

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had five implementer fix rounds; the
fifth round's own review is now adjudicated. It CANNOT close: one Major is confirmed at the lines and one
Minor is a real ordering defect, both going to a sixth round alongside a cluster of comment and
enumeration seams. Sections 3, 4 and 5 are not started. Round 5 was deliberately the narrowest round of
the five, aimed at a predicate rather than a class, and on its own terms it succeeded: every one of its
named items landed and the adversarial lens confirmed each independently.

WHAT FIX ROUND 5 DELIVERED, VERIFIED RATHER THAN ACCEPTED. The converged Major from interim board 7 is
repaired at its root. `readFileBounded` now answers `boundedBy`, naming WHICH bound stopped a partial
read (`'ceiling'`, `'short-fill'`, or `null`), with `bounded` left byte-unchanged in meaning for every
caller (`bounded === (boundedBy !== null)`). `readHoldNudgesResult` splits the one `bounded` reason into
`'oversized'` and `'short-fill'`, and `HOLD_NUDGE_HEALABLE` is now `['oversized', 'kind']`, so the
destructive unlink is reachable only by a reading positively named as the ceiling and a short fill takes
the refusing direction with `unreadable` and `lstat`. The controller confirmed the split at the lines and
confirmed its fail direction is safe BY CONSTRUCTION: the reader asks `boundedBy === 'ceiling' ? … : 'short-fill'`,
so any bound it does not positively name as the ceiling refuses, which also means a stale installed copy
of the reader answering `undefined` falls to the refusing side rather than the healing one. The security
lens reached the same conclusion independently and added the arithmetic: this writer's own file, at most
eight entries of two capped fields, cannot reach a 64 KB ceiling at all.

THE CONTROLLER RE-RAN THE LANE ITSELF rather than accepting the report: 502 tests / 501 passing / 0
failing / 1 skipped, exit 0 read from the run's own marker file. The one skip is the POSIX-only
`O_NOFOLLOW` pin, which cannot run on this box. The lane's composition changed this round, since
`test/kit-read-lib.test.js` joined it, so the reading is reported both ways: the six files already in the
recorded 483 baseline stand at 484 / 484 / 0 / 0, and the newly joined file contributes 18 / 17 / 0 / 1.
The multi-byte-prefix grep trap fired a THIRD time on this plan and was caught again by reading the exit
code from the marker rather than from a pattern over the output.

A FINDING RETIRED WITH RECEIPTS RATHER THAN ROUTED. The adversarial lens rated the checkpoint CLI's
LF-only line endings a Minor, correctly observing that every sibling file in the changeset is CRLF and
that this breaks byte-comparison symmetry. The controller checked the base ref rather than the claim:
`git show 64f711f:` of that file reads CR=0 / LF=882, so the file was already LF-only before this round
touched it. Pre-existing, not this changeset's, and recorded here so a later round does not rediscover
and "fix" it into a whole-file diff.

MAJOR, CONFIRMED AT THE LINES, AND IT IS THIS ROUND'S OWN. The status verb hard-codes the two reasons
that self-heal, promising "the next hold directive replaces it" for `'oversized'` and `'kind'` literally,
while the authority on which reasons heal is `HOLD_NUDGE_HEALABLE` in the library. The controller
confirmed the gap by count: that constant is unexported and the checkpoint CLI contains ZERO references
to it. So the writer and the reader filter on the same value with each side tested only against its own
literal, which is the doctrine's named cross-component-pin class, and the CLI's own test stays green
through any divergence because it asserts the message per reason rather than per heal. The finding is
sharpened by where it sits: the SAME changeset built exactly this pin for the sibling case, so the
instrument the round needed was already in its hands.

MINOR RATED, DEFECT CONFIRMED: THE HEAL IS GATED BY A CHECK THAT CANNOT SEE IT. The blind lens found that
`recordHoldNudge` runs `writableOrAbsent(target)` BEFORE the read and before the heal, so a stamp file
that is both oversized and unwritable refuses permanently, where the heal is an unlink that needs
permission on the containing directory rather than on the file and would have succeeded. Confirmed at the
lines. It falsifies the library's own header, which states that neither a link nor an oversized file ever
resolves on its own so a writer that only refused would disable that interval permanently, and it
falsifies the status verb's replacement promise for that same file. Round 5 closed the permanent-silence
class at one leg and left this ordering holding it open at another.

A CONVERGENCE ACROSS TWO LENSES ON THE OUTPUT CHANNEL. The adversarial and security lenses independently
found that the new hold-stamp status report interpolates a home-anchored path into stdout raw, bypassing
both guards the same file defines one hundred and thirty lines above, one of which exists precisely
because the OS account name is in that path and the output is read by a model. The security lens supplied
the honest scoping the fix turns on: the pre-existing gate-state report does the same, so the class
predates this round and the repair belongs at the channel rather than at the new site, which is Standing
Amendment 3's shape exactly. It also named the cost the fix carries, that the CLI's own tests pin the raw
path and must move in the same edit.

FINDINGS STANDING AS ALREADY-ROUTED, re-found independently and correctly. The blind lens rated the
marker collision a Major for the THIRD time across this plan's rounds, reaching it from the directive's
own broadcast rather than from the file naming, and it is section 4's, appended for exactly this. Its
companion Minor, that the collision note cannot tell an absent marker from an unreadable one, is retired
by the same section deleting that note outright. Both stand where they are. Fixing code one section
before deleting it remains throwaway work.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. The first-turn reading was taken on every dispatch. Workflow parallelism caps
at two on this host, so the security reviewer started as the first finished, which is expected behaviour
rather than a never-started dispatch. The tree-state bracket returned NO DELTA at all this round, the
first round of this section where it did, so all three lenses held read-only and no concurrent write
landed inside the window.

A DISPATCH TRAP THE CONTROLLER FELL INTO AND A MEMORY RECORD CAUGHT. The first-turn reading was first
taken at the path the Agent tool's own result returns, which on this install is zero bytes for every
dispatch including completed ones, so it reported zero assistant lines and zero synthetic for a healthy
agent: the never-started shape exactly, which licenses killing a working agent. The real transcript sits
one directory deeper, under the session's own `subagents/`. The project memory record naming this trap
was surfaced and is stamped applied; its standing instruction, that the reading always carries a positive
control against a dispatch known to have completed, was then honoured and the control spoke at 219, 163
and 198 assistant lines.

CURRENT GATE BASELINE. Targeted lane over the section's files plus the whole-tree pins whose subjects
they are, now including `test/kit-read-lib.test.js`: 502 / 501 / 0 / 1, exit 0, run by the controller with
the exit code read from the run's own marker file. The whole gate is still OWED at the section close,
twice over, for the push to main and for this session's earlier merge.

BOX, NAMED RATHER THAN ASSUMED AWAY. A peer seat's claim was live and already past its own declared bound
when the fix round was dispatched, so the claim read was left to the implementer's own spawn moment,
which is where the protocol puts it. By the controller's lane the claims directory was empty and no
dotnet, testhost or vstest process was running; the controller wrote its claim with the clock read at the
moment of the write rather than composed, and deleted it scoped to this session's id. The implementer
reports running its own red probes under named contention beside a foreign live claim and eight dotnet
processes, which is the fifth such observation on this box of suites spawning without reading the claim
file.

DOCS CORRECTED IN THIS BOUNDARY BY THE CONTROLLER, since `docs/` is barred to subagents. One
`docs/security-model.md` paragraph was falsified by this round's own split and is repaired: it enumerated
four readings where there are now five, described the short-fill leg as healing where it now refuses, and
missed that the hold-stamp read takes the same opt-in link refusal the signpost read does. The correction
states why the split exists rather than only its result, since the reason is the transferable part.

FOREIGN UNCOMMITTED WORK REMAINS IN THIS TREE AND IS NOT THIS SESSION'S TO COMMIT.
`kaizen/notes-SCOTT-CLAUDE.md` carries the coordinator seat's notes, and the peer's sidecar effort has
grown again during this stretch, now holding a plan doc, a contract, five sources and three test files.
Named and left; no commit of this session carries any of them.

NEXT ACTION PER SECTION. Section 2: a sixth fix round, narrower again. Its items: export the healable-reason
set and drive the status verb off it with a cross-component pin; move the writability check below the
heal; route the status verb's paths through the eliding display guard at the channel rather than at the
new site, moving the pins that hold the raw form; and the enumeration seams, which are the reader's null
list, the remedy count, the hardlink paragraph the round widened into falsehood, and the residual argument
that describes one of its two callers. Then the whole gate under a fresh baseline, then Chapter 2 and the
commit. Section 3: not started, scope widened three times. Section 4: not started, the marker-collision
repair, now re-found by an independent lens in three separate rounds. Section 5: not started, scope
widened once.

Commit model in effect: Commit-and-Push. This entry commits alone, on the precedent interim boards 1 to 7
set in this plan; section 2's code and its `docs/security-model.md` prose stay unstaged until the whole
gate has run, since under this model the section commit goes straight to main.
### Interim board 9 - 2026-09-01

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had six implementer fix rounds; the
sixth round's own review is now adjudicated. It CANNOT close: three Majors are confirmed at the lines,
one of them a fresh false claim written BY the fix that was dispatched to correct the previous false
claim, and a cluster of comment, test-scope and reader-discrimination Minors goes to a seventh round.
Sections 3, 4 and 5 are not started.

WHAT FIX ROUND 6 DELIVERED, VERIFIED RATHER THAN ACCEPTED. All ten items landed and the controller
confirmed each at the lines rather than from the report. `HOLD_NUDGE_HEALABLE` is exported and the
checkpoint CLI's replacement promise is driven off membership in it, with a cross-component pin built
in three layers (a behavioural table over all five readings, a coverage assertion driven off the
constant so a reason added with no fixture fails loudly, and a source-side net with a control on a
withheld synthetic reason name). `writableOrAbsent` moved below the heal, so an oversized and
unwritable stamp in a writable directory is now healed rather than refused forever. The status verb's
paths route through `displayPath` at the channel. The controller re-ran the lane itself: 505 tests /
504 passing / 0 failing / 1 skipped, exit 0 read from the run's own marker file, against the recorded
502 / 501 / 0 / 1, so plus 3 and plus 3 with failures and skips unchanged. The one skip is still the
POSIX-only `O_NOFOLLOW` pin, confirmed skipped in the log by name rather than made to pass.

TWO ITEMS CAME BACK BETTER THAN THE BRIEF ASKED FOR, and both are worth the record. The hardlink
paragraph's repair enumerated a FIFTH mechanism the controller's own brief had not named, `trimGateLog`
renaming a rebuilt file over the log once it crosses its cap, which orphans a planted link exactly as
the other writers do; so the one path the brief called "writes through" is now correctly stated as
writing through until the next trim. And the item-9 wording fix was reached the long way: the
implementer first built the repair the brief named, watched the lane redden at a pin in a file outside
its own scope, read that pin, and took the brief's second option instead. The controller confirmed the
pin at `test/compact-deferral-nudge.test.js:1880`, which forbids `isFile()` in that reader because its
next act is an OPEN of the same name, and a kind settled on a name it then opens is the swap window the
shared bounded reader exists to close. The brief's first option would have reintroduced it. The
implementer was right and the brief was wrong.

MAJOR, CONFIRMED, AND IT IS THE FIX ITSELF THAT IS FALSE. Round 6 was dispatched to correct a count
saying "the five legs name different remedies". It wrote "the five reasons draw FOUR remedies between
them", explaining one sharing (`unreadable` and `lstat`) and reaching four by five-minus-one. The
controller counted the code the same round wrote: `reportHoldStamps` composes exactly THREE distinct
`remedy` values and FOUR distinct `lead` shapes, because round 6's own item-1 change made `oversized`
and `kind` share a remedy by driving both off `HOLD_NUDGE_HEALABLE`. So the sentence misses the sharing
the round itself created, and the count is wrong for a reason that did not exist before the round
started. This is the sharpest instance this plan has produced of the class it keeps meeting: a
restated count is a claim about code that is moving underneath it, and the round that moves the code is
the round least able to see it.

MAJOR, CONFIRMED, THE GUARD LIFTED TO THE CHANNEL IS UNSOUND FOR THE PATH CLASS IT NEWLY COVERS.
`displayPath` decides the home prefix with a bare `text.startsWith(home)`, no separator boundary and no
case fold. That was sound while its only caller was the transcript path, which is composed FROM
`os.homedir()` and so matches byte-for-byte by construction. Round 6 newly routed cwd-derived paths
(`gateStatePath`, `holdNudgePath`, both resolving through `path.join(cwd, '.kit')`) and the operator's
own `--project` value through it, and both failure directions become reachable. Over-elision: a home of
`C:\Users\Admin` against a project at `C:\Users\Administrator\repo` prints `~istrator\repo\...`, on the
very leg whose remedy tells the operator to remove that file. Under-elision: a cwd differing only in
case fails the test and prints the OS account name raw into a channel a model reads, which is the exact
property `docs/security-model.md` asserts this report has. The library one file away already does it
correctly with `path.relative`, which is boundary-aware and case-insensitive on win32. Amendment 3 got
the guard to the channel and did not get it right at the channel, which is a distinction worth keeping.

MAJOR, CONVERGED FROM THE ADVERSARIAL AND SECURITY LENSES INDEPENDENTLY. The new `displayPath` header
claims "Every path this CLI prints goes through here" and two prints in the same file do not:
`cmdOpen` and `reportCheckpoint` both print a plan path through `sanitize` alone. So Amendment 3's
sweep over the channel's other callers was incomplete and unstated per caller, which is the amendment's
own failure mode rather than a new one. The security lens added the reach the adversarial lens did not:
`cp.plan` is read unvalidated from a user-writable checkpoint file with no per-field cap, so a planted
absolute plan value prints the home prefix into that same model-read channel, and a value past the cap
is shortened with none of the "[path cut to fit]" mark `displayPath`'s own header says it exists to
provide. The leak is pre-existing; what the round introduced is the universal claim that would keep the
next author from adding the guard.

MINORS GOING TO ROUND 7. The `lead` half of the status line still filters on literal reason names while
the `remedy` half rides the exported constant, so a sixth healable reason would print "cannot be read"
beside "the next hold directive replaces it" in one self-contradicting line, and the new pin cannot
catch it because it asserts a fixture per reason rather than a lead per reason. The elision test's name
claims the whole report where its staging reaches two legs, and its fixture creates the repo INSIDE the
fixture home, so every asserted path is home-prefixed by construction and neither failure direction
above can be exercised by it. A neighbouring sentence claiming every writer renames through an O_EXCL
temp is falsified eight lines later by the round's own hardlink paragraph. The generalized resolver
sweep gained a backreference and with it an unstated limit, a resolver rebinding its parameter to a
local escaping the class silently. Two reader-discrimination Minors from the blind lens: the
`goalStateAbsent` stand-down is wider than the uncertain reading it was written for, so a goal state the
gate treats as determinate-unusable leaves the nudge permanently silent on a session the gate is
actively holding; and a future-dated PEER stamp is not merely skipped but DELETED, since the writer
rebuilds the file from the reading, which the header's justification covers only for the reader's own
stamp. And `displayPath`'s cut marker is computed on the pre-sanitize length.

DOCS CORRECTED IN THIS BOUNDARY BY THE CONTROLLER, since `docs/` is barred to subagents. Two
`docs/security-model.md` items, both raised by the security lens and both confirmed at the lines. The
document still said the opt-in link refusal's win32 residue is carried by "that one caller ... because
the read it guards is one whose target is not repository-supplied"; there are two callers now, and the
justification is false for the more hostile of them, since the hold-stamp read's target sits in a
project's own `.kit/` which this same document elsewhere treats as repository-carriable. Restated for
both callers with each one's residue bounded on its own terms. And the residual paragraph enumerated
four redirect targets as READS when the hold-stamp path gained an unlink in round 5, so a redirect
landing at the far end of a symlinked ancestor lands a delete there; the enumeration now says so, scoped
to the ancestor case since `.kit` itself is screened, and bounded to the one fixed filename.

A CONTAMINATION CHANNEL IN THIS PLAN'S OWN REVIEW INSTRUMENT, FOUND BY THE INSTRUMENT AND CONFIRMED
WIDER THAN REPORTED. The blind lens disclosed that a content grep of its own, run for an unrelated
symbol, surfaced this plan's intent narrative out of `.kit/scratch/`, which holds the plan doc, the
dispatch briefs and prior reviewers' reports. The controller checked the reach rather than the anecdote:
227 files under that path carry the plan name, the amendments block or the board entries. The blind
dispatch withholds the spec path, the plan, the section name and the docs hunks, and every one of those
is reachable by grep from inside the tree the reviewer is asked to read. So the blindness on this plan
has been requested rather than enforced, at every round. It does not invalidate this round's blind
findings, which are correctness findings standing on their own lines and which the lens disclosed
honestly, and the plan's other rounds are not re-opened on it. It is a defect in the kit's own dispatch
discipline: the scratch path exists so bulky artifacts stay OUT of the diff, and it puts them INSIDE
the grep. Captured to the kaizen inbox as kit friction rather than repaired here, since the repair is
the kit's dispatch rule and not this plan's code.

FINDINGS STANDING AS ALREADY-ROUTED, re-found independently and correctly. The blind lens rated the
marker collision a Major for the FOURTH time across this plan's rounds, this time reaching it from
`seat-stop.js`'s own turn-end write rather than from the CLI, which is the higher-rate writer and
strengthens section 4's case rather than changing it. It re-found the installer erasure of
`compactNudgeFloor`, which is section 5's. And it rated the `replaced` note's inability to tell a
lapsed marker from a live one a Minor, which section 4 retires by deleting that note outright. All
three stand where they are.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. The first-turn reading was taken, with a positive control that spoke at 198
assistant lines. Workflow parallelism caps at two on this host, so the security reviewer had no
transcript at the first-turn window and started as the first finished, which is expected behaviour
rather than a never-started dispatch. The tree-state bracket returned a delta and it was NOT a
reviewer's: three `sidecar/` files went from modified to clean, which is a peer's commit landing, and
authorship was established by reading the commit's own file list rather than by recognizing the paths.

HEAD MOVED UNDER THIS SESSION TWICE MID-ROUND, and neither commit touched a section 2 file, confirmed
by diffing each commit's own file list against this section's. `9ca7471` and `c67ddd7` landed before the
round was dispatched and `b3dd8d0` during it; all three are the peer's sidecar effort plus the kaizen
inbox. The review round's base ref was taken as `9ca7471` rather than a stale one.

A PEER-ROUTED GATE READING, AND WHAT THIS SESSION OWES IT. The machine coordinator routed a reading it
marked reported rather than confirmed: a peer seat's whole gate at commit `c67ddd7` read 2794 / 2779 / 8
/ 7, exit 1, with six of the failures in exactly three families that are this section's own
(kit-compact-gate 3, hook-canary 3, compact-deferral-nudge 1) and none in the sidecar families its own
diff touched. The coordinator then confirmed first-hand, against the worktree list, that the run was
taken in THIS shared checkout rather than a separate one. That makes the collateral reading the live
hypothesis: three hook-canary reds is the exact signature of a stale build stamp against uncommitted
hook edits, a recorded property of this repo, and the other four sit in the two suites an implementer
was actively rewriting at the time. Neither half is confirmed and this session has not reproduced any
of it. The section's owed whole gate is what answers it, on a comparable whole-gate basis, and
`c67ddd7` is now in this checkout's own history so that run covers it. If those six survive a
stamp-refreshed whole gate they are this section's to own before it closes.

A PEER'S STAGED WINDOW OPENED AND CLOSED ACROSS THIS ROUND. The coordinator warned that a single staged
rename sat in this shared index, so a pathspec-less commit from this session would have carried another
seat's archival under a durable-boundary message. It then verified the window closed at `b3dd8d0` with
the index empty, running its silent check against a control so the empty reading meant something. This
session read `git diff --cached --name-only` itself at the bracket and again before this entry's commit
rather than trusting either message, and will read it again before every later commit, which is the
standing rule rather than this window's remedy.

CURRENT GATE BASELINE. Targeted lane over the section's files plus the whole-tree pins whose subjects
they are: 505 / 504 / 0 / 1, exit 0, run by the controller with the exit code read from the run's own
marker file and the counts read unanchored, since node's summary lines carry a multi-byte prefix that
makes an anchored pattern return nothing on a PASSING run. The whole gate is still OWED at the section
close, now three times over: for the push to main, for this session's earlier merge of eighteen commits,
and now to answer the peer-routed collateral reading above.

BOX, NAMED RATHER THAN ASSUMED AWAY. A live foreign claim from another repo (`AI-OS: Worker`, 600
seconds from 01:21:52Z) stood when the lane was due, with ten heavy foreign processes beside it. This
session waited out its full declared bound on a readiness poll rather than a fixed sleep, then found the
claim still on disk past that bound; release is the holder's act, so the lane ran under NAMED CONTENTION
with the claim file deliberately NOT written, which is what the protocol permits and what keeps a
proceeding session from replacing a live holder's claim with its own. Heavy processes had fallen from
ten to four by the spawn. The fix round's own runs waited out two further foreign claims rather than
contending, and wrote and deleted their own claim scoped to this session's id with the clock read at the
write.

LOCAL STATE ALTERED, NAMED because it is not this session's to leave unreported. The build stamp
`plugins/claude-kit/.claude-plugin/build-info.json` and `plugins/claude-kit.zip` were regenerated again,
by the fix round and once more by the controller before its own lane, both gitignored build outputs.

FOREIGN UNCOMMITTED WORK IN THIS TREE IS NOW LARGELY COMMITTED BY ITS OWNER. The peer's sidecar effort
landed across `c67ddd7`, `9ca7471` and `b3dd8d0` including its own plan's archival, and
`kaizen/notes-SCOTT-CLAUDE.md` was banked by its owner in `9ca7471`. No commit of this session carries
any of those paths, and this session's own kaizen note for the contamination channel above is therefore
appendable at the next pass rather than blocked behind a peer's dirty file.

NEXT ACTION PER SECTION. Section 2: a seventh fix round, narrower again, over items that are all
carriers or instruments rather than mechanism. Its items: make `displayPath` decide containment by
`path.relative` rather than `startsWith` so neither the boundary nor the case direction can fire, and
give the elision pin a fixture that can actually exercise both; drive the status line's lead off the
same membership test its remedy already rides, and extend the cross-component pin to assert a lead per
reason; correct the remedy count to three against the code the last round wrote; either route the two
plan-path prints through the channel guard or bound the header's claim and say per caller why a plan
path is out of scope; the O_EXCL neighbour sentence; the sweep's unstated rebinding limit; the two
reader-discrimination Minors; and the pre-sanitize cut marker. Then the whole gate under a fresh
baseline, then Chapter 2 and the commit. Section 3: not started, scope widened three times. Section 4:
not started, the marker-collision repair, now re-found by an independent lens in FOUR separate rounds.
Section 5: not started, scope widened once.

Commit model in effect: Commit-and-Push. This entry and its two `docs/security-model.md` corrections
commit together, departing from interim boards 1 to 8's doc-only precedent for one stated reason: those
corrections are a false security claim this round's own review confirmed, and a false security claim
does not outlive the commit that falsifies it. Section 2's code stays unstaged until its whole gate has
run, since under this model the section commit goes straight to main.

### Interim board 10 - 2026-09-01

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had SEVEN implementer fix rounds;
the seventh round's review is adjudicated and a consult on it is ruled and adopted. It CANNOT close:
the round shipped a new false universal in the exact header it was dispatched to bound, and the
review found three behavioural defects beneath it in the guard that header describes. Round 8 is
specified by the adopted ruling and is the last round this section gets, by that ruling's own
stopping rule. Sections 3, 4 and 5 are not started.

WHAT ROUND 7 DELIVERED. All ten items landed and the controller confirmed each at the lines. The
remedy count is finally right (five reasons, four leads, three remedies, each with its members
named). `displayPath` decides containment by `path.relative` rather than a text prefix, with both
failure directions watched red first against the old implementation and green after. All seven of
the CLI's path-valued prints route through it. The status line's healable split rides one membership
test on both halves, pinned at exactly two occurrences. The lane ran 394 / 393 / 0 / 1, exit 0 from
its own marker file.

THE ROUND'S IMPLEMENTER REFUSED A LINE OF THE BRIEF AND WAS RIGHT TO. The brief said an empty
relative result means NOT contained; the implementer made it render `~`, on the ground that printing
the home directory itself raw is the exact leak the item exists to stop. That is the second
consecutive round in which the brief was wrong and the implementer caught it, and both refusals were
reported rather than taken silently.

THE CONTROLLER FALSIFIED A SECURITY CLAIM IN THE SAME TURN IT WARNED AGAINST DOING SO. Adjudicating
round 6, the controller widened a `docs/security-model.md` sentence from a true narrow claim to a
universal, roughly an hour after writing a dispatch brief warning the implementer in capitals about
restated claims. Round 7's review confirmed the widening false, and confirmed that the narrow claim
it replaced was false too in its purpose clause. Both are retracted in this boundary: the document
now states the narrow property that is true today and names the two open residuals by name. Nothing
false is committed and nothing false stands in the tree.

THREE BEHAVIOURAL DEFECTS UNDER THE FALSE HEADER, all confirmed at the lines by the controller.
Five error legs print an error reason through the plain sanitizer, and four of the functions that
BUILD those reasons compose them from a Node `fs` error message, which embeds the absolute path, so
the account name reaches a model-read channel on exactly the failure paths a model meets. The guard
does not achieve its stated purpose on its own motivating case either: a transcript path carries a
component that is the whole absolute project path flattened to alphanumerics and dashes, so eliding
the leading prefix leaves the account name in the middle. And the sanitizer silently DELETES
non-ASCII characters while the cut marker compares post-strip lengths, so the two legs that hand an
operator a file to delete can name a path that is not on disk, unmarked.

THE CONSULT RULED AGAINST THE CONTROLLER'S FRAMING AND THE REFUTATION IS CHECKABLE. Recorded as
Standing Brief Amendment 4 above, with the rejected proposal kept as the worked counter-example
because it looked correct. The ruling also resolved one fork the consultant referred upward: it
judged a wide substitution risky on a contended file, not knowing that the peer seat's work had all
landed, so the tree now carries only this section's own dirt and the coordination cost it priced is
not there. Resolved on evidence rather than escalated.

A TREE HAZARD NO BRACKET OF THIS PLAN COULD SEE. The security lens found two stray directories at
the repository root left by an earlier review round's probe scripts, one of them a DIRECTORY named
`package.json` at the root of a project that has no `package.json` file. Both held no files, which is
exactly why every tree-state bracket this plan has run reported no delta: `git status --porcelain`
does not report empty directories. Removed, with the emptiness proved under a control that spoke at
1,275 files. The instrument gap is captured to the kaizen inbox rather than repaired here.

A FINDING ROUTED OUT OF THIS PLAN ENTIRELY. The consultant found that `hook-canary.js` emits the
resolved plugin root into the SessionStart context with no elision, so on an installed kit the
account name reaches a model-read channel today, and that the tree carries three incompatible
spellings of its sanitizer. That serves a different goal from this plan's, so it leaves as its own
spec rather than folding here.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. The consultant was dispatched the same way. First-turn readings were
taken on every dispatch with controls that spoke (29, 34, 35 and 30 user lines). Workflow parallelism
caps at two on this host, so the security lens started as the first finished, which is expected
rather than a never-started dispatch. The tree-state bracket around the round returned NO delta, so
all three lenses held read-only.

CURRENT GATE BASELINE, AND A BASELINE THIS SESSION GOT WRONG. The round's lane is 394 / 393 / 0 / 1,
exit 0, over the four test files the brief named. The controller's brief quoted 505 / 504 / 0 / 1 as
that lane's baseline and the implementer correctly refused it: the 505 figure was measured over a
WIDER file set, which the old log's own `seat-stop` cases prove and whose full membership cannot be
reconstructed from that log. So no delta is claimed across the two, and the honest reading is a fresh
baseline on a named file set. The whole gate is still OWED at the section close, three times over,
and it is what settles this.

NEXT ACTION PER SECTION. Section 2: round 8, specified by the adopted ruling. One emit choke point in
the checkpoint CLI so the home directory and its flattened spelling are elided on the way out of the
channel rather than at each caller, with the component-aware boundary the same trap already caught
once; the cut marker to mark alteration as well as truncation; the false header deleted rather than
restated; the security document widened back only once the code makes it true; and two tests, a
behavioural one driving all five error legs under a home fixture and a source-side pin on the
identifier names. Then the whole gate under a fresh baseline, then Chapter 2 and the commit. By the
adopted stopping rule there is no round 9. Section 3: not started, scope widened three times.
Section 4: not started, the marker-collision repair, re-found by an independent lens in a FIFTH
round. Section 5: not started, scope widened once.

Commit model in effect: Commit-and-Push. This entry, the amendment above and the retraction in
`docs/security-model.md` commit together; section 2's code stays unstaged until its whole gate has
run, since under this model the section commit goes straight to main.

### Interim board 11 - 2026-09-01

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had EIGHT implementer fix rounds.
Round 8's three-lens review is adjudicated and round 9 is dispatched and in flight. Sections 3, 4
and 5 are not started.

THE STOPPING RULE WAS OVER-READ IN BOARD 10, AND THIS ENTRY CORRECTS IT. That entry recorded "by the
adopted stopping rule there is no round 9". The rule as adopted reads that a fix round is justified
only when it removes a hand-maintained cross-file claim or a behavioural defect, and that a round
whose whole content is correcting the TEXT of such a claim is not run. Round 8's review found
behavioural defects, so the rule licenses this round rather than barring it; what the rule bars is a
text-only round, which is why nine of the review's findings are excluded from round 9's brief.
Doctrine settles the same question independently from the other side: a security finding of Major
weight is fixed before the section closes or raised to the operator, never parked.

WHAT ROUND 8 DELIVERED, CONFIRMED BY THE CONTROLLER AT THE LINES. All 46 of the checkpoint CLI's
writes now route through two emitters, and exactly two descriptor writes remain in the file, both
inside them. The false universal "Every path this CLI prints goes through here" is gone from
`plugins/` and `test/`, along with its second carrier, and neither was restated. The sanitizer marks
alteration as well as truncation. The lane ran 396 / 395 / 0 / 1, exit 0 read from its own marker
file, against a 394 / 393 / 0 / 1 baseline: two tests added, none failing.

A COUNT DISPUTE THAT DISSOLVED ON RE-MEASUREMENT. The implementer reported that the brief's recorded
comment-count baseline of 23 did not reproduce, measuring 25. The controller re-ran its own
predicate against the implementer's saved pre-round copy and got exactly 23, so the disagreement was
two different predicates rather than a wrong number, and the count fell under both readings. Recorded
because the last two rounds each turned on a brief figure that was genuinely wrong, and this one was
not.

THE CHOKE POINT DOES NOT HOLD ITS PROPERTY, ON FOUR LIVE ROUTES. Two lenses executed the shipped
code rather than reasoning about it, and the controller confirmed the decisive one by reading.
The sanitizer strips non-ASCII characters and caps the value AT THE COMPOSITION SITE while the
elision patterns are compiled from the RAW home directory, so on any machine whose account name
carries an accent or a CJK character the pattern can never match the text that is actually emitted
and the guard is inert. The literal pattern anchors only its trailing edge, so on POSIX a home
spelling embedded mid-path over-elides into a path that is nowhere on disk. A cut landing exactly at
the home's last character prints the account name WHOLE rather than as a fragment, the appended mark
starting with a space that the trailing boundary class does not admit. And an uncaught throw in
`main` bypasses the emitters entirely, printing Node's own stack trace with the full plugin-cache
module path, which the source-side pin cannot see either; the sibling CLI already carries that guard
and documents why.

THE SECTION ADDED A SECOND UNELIDED PRODUCER IN THE SAME ROUND THAT BUILT THE GUARD. The deferral
nudge emits a home-anchored plugin path into the model's context, its own path grammar admitting the
account name because that grammar screens metacharacters rather than eliding a prefix. It is
Standing Brief Amendment 3's exact shape, a producer one file from the guard reproducing the
protections it could see and dropping the one it could not, and the hook's own header claiming it
reads no path is a carrier under Amendment 1.

AMENDMENT 4'S WORKED COUNTER-EXAMPLE WAS REPRODUCED BY THE ROUND THAT QUOTED IT. Round 8's
source-side pin was required to draw its control from outside the pattern's own literals. The control
it built varied the bypassing write's POSITION, nesting it in an arrow function, while keeping the
identifier the pattern was handed, so it proved the instrument runs and proved nothing about the
identifiers the pattern cannot reach. The predicate is also short of its own channel, admitting the
console family and the descriptor-numbered writes. Both lenses found it independently, and the
controller had accepted the implementer's report of it, which is the adjudication error worth
recording: the report said the control was withheld and the check was whether it actually was.

A TEST WHOSE GREEN IS A PROPERTY OF THIS BOX. Round 8's behavioural case stages its home fixture
under the machine's temp directory, which is seven characters here and leaves about eight characters
of margin under the print cap; on a default Windows temp path the elision assertion goes red. The
trap is that the obvious repair, dropping that assertion, leaves the absence assertion passing
because the cap REMOVED the account name rather than because any guard fired. Round 9 is told to
shorten the fixture and to relax neither assertion.

TWO FINDINGS ROUTED TO SECTIONS RATHER THAN TO A ROUND. The blind lens found that the only operator
knob this section ships is rewritten wholesale by both writers of the file it lives in, which is
section 5's entire subject; and that the role-boundary marker is project-scoped while the directive
that names it is per-session, so two held seats in one checkout unmake each other's declarations,
which is section 4's. The second has now been re-found by an independent lens in a SIXTH round,
which is the strongest evidence yet that section 4 is real work rather than a tidy-up.

ONE FINDING ROUTED OUT OF THIS PLAN. A second command-line tool prints the same library's refusal
reasons through a plain sanitizer, so its channel carries the account name on its failure legs. It is
a second channel of the same shape rather than a second caller of one channel, so its guard belongs
at its own emitters; it is recorded in the output-channel-eliding spec's evidence, together with the
cap-before-elision residual that plan should lift in the corrected order.

THE SECURITY DOCUMENT IS DELIBERATELY NOT TOUCHED THIS BOUNDARY. Its paragraph states both output
residuals as open. Round 8 closed them only partly, and the review shows the property still fails on
the routes above, so the honest text is not yet writable and the current text under-claims rather
than over-claims. It is written once, after round 9 settles the code. The controller widened this
same paragraph falsely one boundary ago, so waiting is the correction rather than an omission.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent tool
cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution and no
compensation notch is owed. First-turn readings were taken on every dispatch with controls that
spoke. Workflow parallelism caps at two on this host, so the security lens started as the first
finished, which is expected rather than a never-started dispatch. The tree-state bracket around the
round returned NO delta, so all three lenses held read-only.

CURRENT GATE BASELINE. 396 / 395 / 0 / 1, exit 0, over the four test files the round's lane names,
read from the run's own marker file. The whole gate is still OWED at the section close, three times
over, and it is what settles the section.

NEXT ACTION PER SECTION. Section 2: adjudicate round 9, whose eleven items are the behavioural
defects above plus the deletion of two headers round 8's own change falsified. Then the whole gate
under a fresh baseline, the security document written once against the settled code, then Chapter 2
and the commit. Section 3: not started, scope widened three times. Section 4: not started, the
marker-collision repair, re-found by an independent lens in a sixth round. Section 5: not started,
and round 8's review supplied it with a confirmed second instance.

Commit model in effect: Commit-and-Push. This entry and the evidence added to the output-channel
spec commit together; section 2's code stays unstaged until its whole gate has run, since under this
model the section commit goes straight to main.

### Interim board 12 - 2026-09-01

IN-FLIGHT SECTION AND ITS STAGE. Section 2 is implemented and has had NINE implementer fix
rounds. Round 9 is verified at the lines, its three-lens review is adjudicated, and round 10 is
dispatched and in flight. Sections 3, 4 and 5 are not started.

ROUND 9 HELD ON EVERY POINT THE CONTROLLER CHECKED. The tree bracket showed no delta. The
sanitizer's ordering defect is fixed: it now strips non-ASCII, then elides, then caps, so the
elision sees the same text the channel does. Exactly two descriptor writes remain in the file,
both inside the emitters, both scrubbed. The lane ran 688 / 685 / 0 / 3 across eight files with
exit 0 read from each file's own marker. And the round added a floor the controller had not
asked for and should have: where no home directory is knowable at all, an empty elision list
would otherwise be indistinguishable from nothing to elide, so the tool now says once, on
whichever descriptor is written first, that nothing below is elided.

ROUND 9 REFUSED TWO INSTRUCTIONS IN ITS BRIEF AND WAS RIGHT BOTH TIMES. The brief prescribed
shortening a test's fixture home to fit under the print cap; the round refused on the ground
that the machine's temporary directory is unbounded, so no fixture choice makes the arithmetic
hold on an arbitrary box, and fixed the sanitizer's ordering instead, which removes the cap
problem rather than dodging it. The brief also offered two spellings for the command the nudge
prints; the round refused both and used a third, on the ground that the clause promises a line
an operator can actually run.

THE GUARD ROUND 9 BUILT LEAKED ON BOTH OF ITS OWN BOUNDARIES. The controller extracted the
shipped pattern-builder's source text and executed it against this box's real home. The leading
and trailing boundaries are ALLOW-LISTS of the surrounding character, so a home path sitting
beside any character they do not name is not elided at all: eight leaking contexts, among them a
path in parentheses, after an equals sign, after a colon, and before a comma. An independent
review lens reached the same finding by the same route. The leading boundary was added in round 9
to fix a real over-elision bug, and the instrument was wrong for it: FOR A PRIVACY GUARD THE TWO
FAILURE DIRECTIONS ARE NOT EQUALLY COSTLY, since over-elision prints a wrong path while
under-elision prints the account name, so the boundary has to be a deny-list of what would make
the match a different token rather than an allow-list of what may surround it.

A REVIEW MAJOR WAS REFUTED BY RUNNING THE THING IT WAS ABOUT. A lens rated as Major that the
command the nudge composes does not run under this platform's Bash tool, with precise evidence:
the shell's own home variable spells a POSIX path that Node cannot resolve on Windows. The
controller ran the real command in both shells and it succeeded in both, printing the correct
Windows path, because the shell layer converts the argument before the child process sees it.
The lens had tested the resolution INSIDE Node, which is one layer off from the real invocation
and bypasses that conversion. Recorded because the finding was confident, specific and wrong, and
because the round's brief now carries the refutation explicitly: a fix round handed an unmarked
false finding repairs working code.

WHAT THE THREE LENSES FOUND THAT SURVIVED. No Critical from any lens. The account name still
reaches the channel on both boundary directions above. On an account name that is wholly
non-ASCII the guard collapses to an ancestor of the home and elides EVERY account's paths into
paths that are nowhere on disk, reproduced by a lens running the shipped tool under a CJK home.
The new catch-all that was added to stop Node printing a home-anchored stack trace does not cover
the module-scope requires, so the one failure it was written for still leaks, and its own comment
claims otherwise; two lenses found this independently. The network-share screen that exists so
this hook can never block on an unreachable share is applied to the project directory and not to
the home-anchored path the coordinator seat's own project resolves to, which is the seat this
section serves. A pin assertion cannot fail, its needle spelled with a different separator than
the text it searches. The collision note reports a replacement for a declaration that had already
lapsed. And future-dated hold stamps are dropped with no skew allowance where every sibling
comparison in the same file allows one, which under a read-modify-write erases every peer's stamp
on a backwards clock step rather than skipping one.

A BOUND IS STATED RATHER THAN FIXED, WHICH IS WHAT THIS SECTION ALREADY DOES ONCE. The blind lens
found that the context floor this section ships is compared against a figure bounded above by the
seat's own context window, so on a seat whose window is smaller than the floor the directive can
never fire at all. Confirmed by reading the summing function. The value is not changing in round
10: it is what the approved Approach names, section 2 already handles a bound of exactly this
shape by stating it rather than repairing it, and making the floor window-relative is a design
change to an approved knob. What changes is the justification comment, which argues the value
against the wrong ceiling. If that call is wrong it is reversible in one line.

TWO REVIEW FINDINGS ARE SECTIONS OF THIS PLAN AND ARE ROUTED THERE, AGAIN. The installers
rewriting this section's only operator knob out of existence is section 5's whole subject, and it
has now been re-found by an independent lens for the second time. Nothing in round 10 touches it.

THE SECURITY DOCUMENT IS STILL DELIBERATELY NOT TOUCHED. A lens raised that its paragraph now
under-claims, which is correct and is the state this plan chose one boundary ago: the property
does not hold yet, so the wider text is not yet writable. It is written once, by the main thread,
after round 10 settles the code, and before the section's commit, so the document does not trail
the code it describes onto the trunk.

THE ROUND. Three reviewers via the Workflow route at model opus and effort max, which the Agent
tool cannot set; all three resolved to claude-opus-5 read from the run record, so no substitution
and no compensation notch is owed. First-turn readings were taken on every dispatch with controls
that spoke. Workflow parallelism caps at two on this host, so the blind lens started as the first
finished, which is expected rather than a never-started dispatch. The tree-state bracket around
the round returned NO delta, so all three lenses held read-only.

CURRENT GATE BASELINE. 688 / 685 / 0 / 3, exit 0, over the eight files the round's lane names,
each file's code read from its own marker. The whole gate is still OWED at the section close,
three times over, and it is what settles the section.

NEXT ACTION PER SECTION. Section 2: adjudicate round 10, whose eleven items are the behavioural
defects above plus three claim corrections that ride along rather than earning a round of their
own. Then the security document written once against the settled code, then the whole gate under
a fresh baseline, then Chapter 2 and the commit. Section 3: not started, scope widened three
times. Section 4: not started, the marker-collision repair. Section 5: not started, and now
carrying two independently confirmed instances.

Commit model in effect: Commit-and-Push. This entry commits alone; section 2's code stays
unstaged until round 10 is adjudicated and its whole gate has run, since under this model the
section commit goes straight to main.
