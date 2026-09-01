# The store learns to speak up: triggers reach the shared tiers, resolution obeys one contract, and recognition meets the moment

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-30

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from a design dialog with the operator, 2026-08-30. Anchors are authoring-time; re-locate every hit by content, since the judgment-sidecar and durable-boundary plans run first and both touch neighboring surfaces.

## Dispatch Authorization

Authorized 2026-08-30 by the operator at the keyboard in the expert seat's session: shared-tier trigger authoring with the widened recognition reading surface, the single resolution contract, and lifecycle recognition surfacing, inserted into the armed queue third (after the judgment-sidecar and durable-boundary plans) by the operator's ordering ruling that memory and semantic work is critical to everything else in flight. This section was authored by the KIT: Expert seat; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's approval and ordering ruling in the expert session's transcript, and the plan entered the queue by the expert's splice under that same instruction.

## Goal

The store's write side has machinery and its read side has almost none. Writing has a trigger, the moment a lesson is learned; reading has no moment of its own, so nothing volunteers a relevant record while a session works. Three gaps compose into that asymmetry. A trigger cannot be authored on a shared-tier record, and the recognition surface reads the project tier alone, so the cross-machine lessons the board-routing plan will home into shared tiers are structurally incapable of ever nudging anyone. The project tier memq resolves can differ from the tier SessionStart names, so a seat following the session's own instruction can write records where nothing will ever read them. And the only forced read in the kit is SessionStart's index injection, when the session knows least about what it will need. When this plan is done: a trigger authors on any tier and recognition reads every tier it can match; one stated resolution contract governs every resolver; and recognition fires at the moments a session is processing something new, the prompt arriving and the subagent dispatching, in the same pointer-not-body discipline the kit already proves works.

## Evidence

- Shared-tier trigger refusal, confirmed twice over: the memory-system skill's own `triggers` contract states the project tier only, with `--type` and `--operator` refused "because recognition reads the project tier alone", and the machine coordinator measured the refusal live 2026-08-30 with a positive control that spoke (a project-tier `cmd:` trigger fired its nudge into PreToolUse context; the same authoring against a shared-tier record was refused by name).
- Recognition's reading surface, confirmed in code: `plugins/claude-kit/hooks/memory-recognition-nudge.js:1163` (authoring-time) resolves a single project root from cwd via memq's own resolver; no shared tier is consulted.
- The resolution split, reported 2026-08-30 by the machine coordinator from a two-way experiment on its own machine-scoped seat: a record written to the SessionStart-named tier was invisible to `memq get`, and a record in the cwd-resolved tier was found, two tiers under one seat with memq reading only one. Independently confirmed on this box: `~/.claude/projects/undefined/memory/drive-probe.md` exists, a record stranded under a directory whose name is a JavaScript `undefined` interpolated into a path, which is the same resolution family misfiring in a second way.
- The read-side asymmetry, reported from the same seat's own day: roughly eleven shared-tier records banked against about one query issued, and the cause is structural rather than discipline, no skill tick order containing a recall step and no machinery volunteering records outside the project-tier tool-use nudge.
- The lifecycle surface, verified 2026-08-30 against harness v2.1.251 (installed, version read from the CLI) via a docs pass: `UserPromptSubmit` injects `additionalContext` the model sees before processing; `SubagentStart` is a dedicated dispatch-time event carrying both `additionalContext` and `updatedInput`; `Notification` and `MessageDisplay` discard hook output and cannot surface anything. One cell of that docs pass was contradicted by live behavior and the live behavior governs: the pass claimed the tool-use events inject nothing, while the kit's own recognition nudge demonstrably injects context on both `PreToolUse` and `PostToolUse` on this machine. The lesson rides as the probe rule in section 3: no event's injection mechanics are trusted from a table, each is proven by a watched firing before code builds on it.
- The backup-shadow symptom, reported 2026-08-30 by the machine coordinator from its own experiment (kaizen note at `75914b9`): a `<name>.md.bak` with no `<name>.md` beside it answered `memq get` by name, stopped answering only when the `.bak` itself was deleted, and six such files sit in one project tier on that box. Untested there: whether a `.bak` shadows or loses to a live `.md` beside it, the serious case. The version question is settled by the coordinator's follow-up measurement: the installed plugin's memq and HEAD's are byte-identical (sha256 match after line-ending normalization), so the experiment exercised exactly the code that ships, and the comment claiming no reader opens a `.bak` or a `.tmp` exists only in the sidecar plan's uncommitted working-copy edit, absent from HEAD, an unlanded stated rule rather than a contradicting observation. The store's sync allowlist refuses `*.bak` and `*.tmp.*` as transient while the shipped reader answered one by name, so reader and sync disagree about what a record is, at HEAD, today.
- memq's pull path needs nothing: its semantic block already ranks every store and archive on the machine, shared tiers included, confirmed in this seat's own queries. The gap is push, not pull.

## Approach

Section 1 is store-and-hook code extending an existing proven mechanism to more tiers. Section 2 is a root-cause investigation with a fix, the only section whose shape depends on what it finds. Section 3 is new hook surface in the kit's established nudge idiom. The board-routing plan runs after this one by the operator's ordering ruling, so homed shared-tier records are trigger-capable before the first homing round; that interaction is the reason for this plan's queue position and is recorded in Decisions.

## Decisions

- Decided 2026-08-30 (operator): this plan runs third, after the judgment-sidecar and durable-boundary plans and ahead of everything else queued, because memory and semantic work is critical to everything currently in flight. The coordinator's ordering argument (homing with no residue before shared-tier recognition exists would produce boards that correctly forget what nothing will ever volunteer) is satisfied by the same ruling and was adjudicated correct by this seat.
- Decided 2026-08-30 (operator): recognition surfacing over recall enforcement. The operator weighed hook-enforced recall and chose machinery that surfaces relevant records at processing moments instead; no gate holds a turn hostage to a recall verb. The operator's candidate moments were named off the cuff and mapped by this seat to the real event surface: `UserPromptSubmit` and `SubagentStart` adopted; `TaskCreated` excluded (no context injection); `Notification` and `MessageDisplay` excluded (output discarded, confirmed by the docs pass).
- Decided 2026-08-30 (expert seat, within the delegated design): anchors stay project-only. An anchor is a file hash, repo-scoped by construction; portability belongs to triggers, whose patterns (commands, error shapes, skill names) are machine-portable. A reviewer proposing shared-tier anchors argues against this entry.
- Context: this plan instantiates the operator's product direction in the project memory `memory-evolution-is-the-kits-cornerstone`; a proposal that narrows the store's reach argues against that record.

## Standing Brief Amendments

These bind every section of this plan opened or re-dispatched after the date on each entry, dispatched
or inline. They exist because the finding class each one names surfaced twice, which means the workflow
is generating the defect rather than one implementer having missed it.

- 2026-09-01, from section 2's second review round. **When a change falsifies a claim, sweep every
  carrier of that claim before the section closes, and report the sweep by predicate and scope rather
  than as a clean grep.** A claim lives in more places than the one the change touched: source comments
  in the file itself and in its siblings, skill bodies under `plugins/claude-kit/skills/`, `docs/`
  prose, test names and test comments. Two of them are the ones actually read at the moment the claim
  matters, so missing them is not cosmetic: a skill body is what an executing session reads at recall
  time, and a function header asserting parity with a rule is a load-bearing invariant that goes silent
  when the rule moves. Sweep on the claim's shape rather than on a list of file names, since a sweep by
  named list reports the same clean result whether the unnamed carrier is absent or merely unnamed, and
  name in the report the predicate you swept with, the scope you swept over, and every site the sweep
  reached and deliberately left unchanged with the rule that exempts it. A carrier sitting outside the
  section's `Files in scope:` is an out-of-scope surface and takes the executing-work skill's route for
  one rather than an in-place edit the scope check never sees.

- 2026-09-01, from section 2's second review round. **When a change alters a shared contract, audit
  every committed caller of it, including callers outside the section's file list, and pin the ones the
  change reaches.** The two shapes this plan has produced are a function gaining a refusal where it
  previously always answered, and a resolution rule moving in one resolver while its siblings keep the
  old derivation. Both read as correct hardening at the site and both fail at a distance: a new throw
  escapes into a caller whose own header documents it as faultless, and a moved rule leaves two
  resolvers answering different questions about the same directory, which is precisely the divergence
  such a change is usually made to close. Enumerate the callers with a tree-wide grep on the symbol
  before the fix is written rather than after, treat a caller's own documented contract (its header, its
  status enumeration) as the standard the change must not break, and where a reached caller lies outside
  the section's scope, route it rather than leaving it named only in a report.

## Sections of Work

### 1. Triggers author on shared tiers and recognition reads them. Model: opus

Two halves of one reach extension. `memq triggers` gains `--type` and `--operator`, with the same grammar, the same merge and refusal behavior, and the same 32-entry cap the project tier has; the memory-system skill's `triggers` row is amended in the same change, including removing its stated reason for the old refusal, which section makes false. The recognition reading surface widens to match: `memory-recognition-nudge.js` loads the operator and type tiers' trigger-carrying records beside the project tier's, with the shared tiers' reads tolerant of absence exactly as the store's other readers are, and per-session dedup unchanged so a record still points at most once per session. The sidecar daemon's recognition (shipped by the judgment-sidecar plan before this section runs) is checked against what actually landed and widened the same way where its index loader is tier-scoped; that check is against the shipped code, not the sidecar spec. Engine-store-signal sessions keep their existing grants: this section widens what recognition reads, not what a fleet worker may author. Tests red-first: authoring on each shared tier lands the frontmatter line and refuses the same bad shapes the project tier refuses; a shared-tier record with a matching trigger nudges in a session whose project tier holds no match (the cross-tier case the old surface could never produce); the project-tier path is byte-unchanged in its own tests.

Acceptance: a trigger authored on an operator-tier record fires a watched nudge from a project whose own tier is empty of matches; the memory-system skill's row reads true against the new code; existing recognition and memq suites green; whole gate delta against a recorded baseline.

### 2. One resolution contract, and the stranded tier dispositioned. Model: opus

Root-cause first, from the real state: reproduce the coordinator's split on a machine-scoped seat (SessionStart names one tier, memq resolves another from the shell's cwd) and establish where `~/.claude/projects/undefined/` came from, which is a second symptom of the same resolution family until shown otherwise. Then state the contract once, where the resolvers can share it: which input names the project tier (the session's working directory as the harness reports it, not whichever cwd a shell has drifted to), and every resolver honors it, SessionStart, memq, the recognition hook, and any sidecar component found reading the same family. The fix's shape depends on the finding and is not prescribed here; what is prescribed is the invariant, that a record written where SessionStart said to write is readable by the memq the same session runs, and the disposition of the stranded directory (rehome its record and remove the directory, or record why it stays, never silence). The contract has a third symptom at the record level rather than the tier level: what counts as a record file. The sync allowlist refuses transient-shaped names (`*.bak`, `*.tmp.*`) while a reader answered a bare `.md.bak` by name in the coordinator's experiment (Evidence), so the correcting edit that doctrine requires is also the act that leaves a shadow of the wrong version answerable. Root-cause this against the real artifacts, naming which reading rung answered: the baseline is HEAD's measured behavior, red by the coordinator's experiment on bytes identical to the installed plugin, so reproduce the `.bak`-only case first, then test the case nobody has run, a `.bak` beside a live `.md`, whose outcome decides severity. One interaction is named now so its green cannot arrive unexplained: the sidecar plan runs before this one and its in-flight memq edit touches the same reader path (its working copy carries the unlanded no-reader-opens-a-bak claim), so if the repro is green when this section runs, the green is attributed to the specific landed sidecar commit and the regression pin is kept, never recorded as a clean that nobody caused; and an unlanded comment is a stated rule, not a sited guard (project memory `a-stated-rule-is-not-a-sited-guard`), so whether the code beside it enforces the claim is established by the test, not the comment. The fix direction is constrained by the store's own design: the sibling `.bak` is the documented recovery artifact for a rewrite that did not land, so removing backups is not on the table; the repair belongs at the reader (transient-shaped names excluded from resolution, the same predicate the sync already applies), with the decay pass's copy-moving behavior left as is, and the six stranded files get their disposition either way.

Tests red-first: a fixture reproducing the tier split fails before the fix and passes after; the `undefined` shape is pinned against recurrence at whatever layer the root cause names; the `.bak`-only and `.bak`-beside-live cases both pinned, whichever way the second one resolves.

Acceptance: the coordinator's two-way experiment re-run on a machine-scoped seat finds one tier, written and read by the same name; the invariant test watched red first; the stranded directory dispositioned with its record named; no transient-shaped name resolvable by any reading verb, proven against a fixture that holds one (the withheld-control bar: the fixture's `.bak` is the state known to hold the thing); whole gate delta against the baseline.

### 3. Recognition meets the moment: the prompt and the dispatch. Model: opus

Two new hook registrations in the kit's established nudge idiom, both dormant-tolerant and fail-open like every kit nudge. On `UserPromptSubmit`: the prompt text is matched against the recognition surface (all tiers, per section 1), and hits inject as `additionalContext` in pointer-not-body discipline, the record name, one clause of why, and the `memq get` spelling, capped (at most 3 pointers, bounded bytes, the sidecar valve's caps are the precedent) and deduplicated per session with the existing nudge's dedup. On `SubagentStart`: the dispatch's input is matched the same way and hits inject as `additionalContext` so the orchestrator's brief gains what the store knows; `updatedInput` is not used, a suggestion being this machinery's whole authority, and that restraint is stated in the hook's header. Semantic matching rides only where the machine's endpoint config exists, degrading to trigger-and-lexical matching exactly as the sidecar contract degrades, never erroring. The probe rule from Evidence binds the section: before building on either event, a trivial probe hook is registered and its injection watched to arrive in a real session, because the docs pass that mapped this surface was wrong about events the kit already uses; the probe result for each event is recorded in the chapter. Version reality is handled by construction: a machine whose harness lacks an event never fires it, and the hooks must load without error on such a machine. Tests red-first: a prompt carrying a known trigger's text yields the capped pointer block; a dispatch input carrying one yields the same at `SubagentStart`; a session with no matches injects nothing and no bytes; caps hold under a fixture with many matches.

Acceptance: both probes watched firing before implementation and recorded; a live session demonstrates a prompt-time pointer from a shared-tier record end to end (the full read-side path this plan exists for); no-match sessions inject zero bytes; whole gate delta against the baseline.

## Out of Scope

- Recall enforcement of any kind: no gate, no Stop-hook compliance check; the operator chose surfacing (Decisions).
- Shared-tier anchors (Decisions) and any change to memq's pull path, which already reaches every store on the machine.
- `TaskCreated`, `Notification`, and `MessageDisplay` surfacing (no injection capability; Decisions).
- The sidecar's judgment lane and delivery valve: this plan touches its recognition index loader only where section 1 finds it tier-scoped.
- Skill tick-order recall prose: the board pass's store read arrives with the board-routing plan's section 4; duplicating it here would create the two-surface drift the kit's single-sourcing rule exists to prevent.

## Related

- `docs/plans/claude-kit_board-routing-and-homing_spec_v1.md`: runs after this plan by the operator's ordering ruling; its homing writes become trigger-capable because this plan ran first.
- `docs/plans/claude-kit_judgment-sidecar_spec_v1.md`: ships the recognition daemon this plan's section 1 checks and may widen.
- Kaizen notes at commits `0aca442` and `1d8fe09`, and the coordinator's cwd-split note filed 2026-08-30: the findings this plan dispositions.
- Project memories `memory-evolution-is-the-kits-cornerstone` and `an-unchallenged-claim-drifts-because-nothing-exercises-it`: the direction and the mechanism.

## Chapters

### Interim board 1 - 2026-09-01

Section 1 is the only section open. It is past implementation and past its review round, with a fix
round dispatched and in flight; no section has closed yet, so this entry is the boundary rather than
a Chapter.

Stage. Section 1 ("Triggers author on shared tiers and recognition reads them", Model: opus) was
implemented by a dispatched implementer-opus, verified by the orchestrator's own build and lane, and
reviewed by three fresh-context lenses. All three returned changes-required. Their findings are
adjudicated and a fix round is dispatched at the same tier.

Live dispatches. One implementer-opus fix round, asked for eight fixes over `plugins/claude-kit/scripts/memq.js`,
`plugins/claude-kit/hooks/memory-recognition-nudge.js`, `plugins/claude-kit/hooks/memq-grant.js`,
`plugins/claude-kit/skills/memory-system/SKILL.md` and the two test files. The review round itself is
complete: adversarial, blind and security, each dispatched at opus and effort max through the Workflow
route, since an opus-tier section gives its reviewers no tier headroom and effort is the only strength
left to add. Each resolved at `claude-opus-5` across every assistant turn, with no substitution and no
synthetic placeholder.

Files in scope widened. `plugins/claude-kit/hooks/memq-grant.js` joins section 1's file set for a
comment-only correction: it carries the same stale sentence about the trigger verb rewriting a
project-tier record, and a claim corrected in one carrier and left standing in another is the defect
this repository keeps producing. The widening is approval drift and is recorded here as deliberate.
Two further carriers, `docs/security-model.md` and `docs/architecture.md`, are the orchestrator's own
writes and are not in any dispatched brief, since a dispatched implementer is denied writes under
`docs/`.

Gate baseline. The orchestrator's own targeted lane over the section's files plus the whole-tree pins
whose subject they are (`memq`, `memory-recognition-nudge`, `hook-canary`, `memq-shim`, `memq-grant`,
`memory-frontmatter-guard`, `memory-usage-stamp`) read 891 tests, 889 passing, 0 failing, 2 skipped,
exit 0 taken from the run's own marker, after a build that exited 0 at 93 files and 1205.3 KB. That is
the baseline the fix round reports its delta against. The box was polled before the run: three `dotnet`
processes carrying `/nodemode:1 /nodeReuse:true` burned 0.000 seconds of CPU over a six-second sample,
which makes them parked MSBuild worker nodes rather than a live build. The claim was written for the
run and released after it, its `Session:` line read before the delete.

Rulings adopted since the last boundary.

The nudge's own pointer is fixed by giving `memq get` the two tier flags rather than by suppressing the
hit or emitting a path. `cmdGet` refuses any argument starting with a double dash and stops at the first
tier holding a name, so on exactly the cross-tier name collision this section was built to support, the
nudge named one record and pointed at another, and the read stamp landed on the wrong tier's decay clock.
Suppression would silence a real fact precisely when it matters, and a full path would put a
home-prefixed absolute path into model context, which is the surface a parked plan exists to eliminate.
The flags fix the stamp defect independently and mirror `touch`'s shape, so the store gains no new idiom.

Shared-tier `glob:` triggers are gated to the project tier at both doors, the reading one and the
authoring one. The plan's own Decisions entry justifies trigger portability by naming commands, error
shapes and skill names, and excludes anchors as repo-scoped by construction; a path glob is repo-scoped
by that same construction, so the plan's stated reasoning decides this rather than the executing
session's preference. Gating only the reader would mint authorable triggers nothing ever reads.

The sidecar finding is a record rather than a code change. Section 1's text asks that the sidecar
daemon's recognition be checked and widened where its index loader is tier-scoped. The check was made
and the answer is that `sidecar/memory-index.js` composes a project index path and reads that file's
roster lines; no module under `sidecar/` reads the `triggers:` field at all. It is a different feature,
model-judged recognition over an index roster, that is project-scoped for its own stated reason, so
there is nothing here to widen the same way. The security lens independently agreed that leaving it
project-scoped is the safe direction, since widening it would need its own re-pricing of a cleartext
egress paragraph. What the section owed was the disposition, and this is it.

Two further findings are records rather than fixes. The dedup key gained the tier, so a session live
across the plugin update re-nudges each already-fired project-tier trigger once; the old keys are dead
and each trigger mints a fresh one. It self-clears at session end and the markers age out, so it is
named here rather than worked around. And `memq triggers` on a shared tier takes no `--confirm-shared`
token where the shared-tier body rewrites do. The exemption is deliberate: the token guards replacing a
shared fact, and this verb splices one frontmatter line while leaving the body promise intact, so the
fact another project relies on is exactly what does not change.

Next action. Await the fix round, verify its delta against the baseline above, then make the two
documentation corrections that are the orchestrator's own: `docs/security-model.md`, whose statement
that the operator tier "enters context only through a command a session chose to run" and whose two
enumerations of the recognition nudge's reach as the project tier alone are all falsified by this
section, and `docs/architecture.md`, which states the same reach and an outdated nudge-log line shape.
Those are a security-weight correction and are fixed in this changeset rather than parked. Then the
section's close gate, Chapter 1, and the commit.

### Chapter 1 - Triggers author on shared tiers and recognition reads them - 2026-09-01

Completed: section 1.

What shipped. `memq triggers` now authors on the type and operator tiers on `touch`'s flag shape, with the
project tier's grammar, merge behavior, refusals and 32-entry cap unchanged, and the recognition nudge reads
all three tiers rather than the project tier alone. Two fields deliberately do not travel: file anchors stay
project-scoped because an anchor is a file hash and repo-scoped by construction, and `glob:` triggers are
gated to the project tier at both the reading and the authoring door, on the plan's own Decisions reasoning
that trigger portability is justified by commands, error shapes and skill names rather than by paths. Gating
only the reader would have minted authorable triggers nothing ever reads. `memq get` gained the same two tier
flags, because without them the nudge's own pointer resolved to the wrong record on exactly the cross-tier
name collision this section exists to support, and stamped the read on the wrong tier's decay clock.
Shared-tier trigger lines now print indented under the provenance fence, and the nudge line carries the tier
and, where a record scopes itself to one box, that machine label.

Decisions and surprises. Three times a dispatched agent disagreed with my brief on evidence and was right,
which is the record worth keeping from this section. The trigger-listing indent is keyed on the fence rather
than on the tier: memq's own design keys trust framing on the fence value, so a pinned project tier is written
by another of this instance's workers, its body is fenced, and its trigger lines must indent too. My brief
said to key on the tier, which would have reintroduced the defect for pinned project tiers. Second, the
shared-tier repair route for a bad or over-cap triggers line is delete-and-replace rather than the update
route I briefed, because recordFrontmatter returns a closed frontmatter block verbatim, so a body repair
copies the bad line across and fixes nothing; only the unclosed case drops and replaces the block, which is
why the original route is right there and wrong for its two siblings. Third, one briefed comment correction in
memq-grant.js would have made a true statement false, that paragraph being about `anchor`, which is genuinely
project-only; what was actually stale there was an enumeration predating the trigger verb, and correcting that
is what brought the file's two accounts into agreement.

The sidecar disposition is a record rather than a code change. Section 1 asks that the sidecar daemon's
recognition be checked and widened where its index loader is tier-scoped. It was checked: sidecar/memory-index.js
composes a project index path and reads that file's roster lines, and no module under sidecar/ reads the
triggers field at all. It is a different feature, model-judged recognition over an index roster, project-scoped
for its own stated reason, so there is nothing to widen the same way. The security lens agreed independently
that widening it would need its own re-pricing of a cleartext egress paragraph.

Two behaviors are named rather than worked around. The dedup key gained the tier, so a session live across the
plugin update re-nudges each already-fired project-tier trigger once; the old keys are dead and each trigger
mints a fresh one, and it self-clears at session end. And `memq triggers` on a shared tier takes no
--confirm-shared token where the shared-tier body rewrites do: the token guards replacing a shared fact, and
this verb splices one frontmatter line while leaving the body promise intact.

Review findings addressed. A three-lens round at opus and effort max returned changes-required on all three
lenses, and a fresh-context verification pass over the first fix round returned changes-required again. Two
findings from that pass were worth the whole round. Two new shared-tier err tests would have failed outright,
because callFailed treats a bare stderr as a non-failure so the pattern would never have been reached; worse,
the withheld control beside them passed while being unable to speak, since the matcher never ran at all. Both
were given real failure shapes and the control was then proven in both directions. The pass also caught that
the adopted fence keying shipped with no test able to tell it from the keying it replaced, both existing
assertions being on shared tiers where the two agree; the discriminating case, a pinned project tier, is now
pinned and was probed red against the rejected keying. The second fix round additionally found and fixed a red
the first round had introduced in a source-inspection pin over the network-share stand-down.

Files in scope widened, all recorded as deliberate approval drift. plugins/claude-kit/hooks/memq-grant.js and
test/memq-grant.test.js for comment-only corrections, both carrying the same stale claim about the trigger
verb rewriting a project-tier record; a claim corrected in one carrier and left standing in another is this
repository's recurring defect. docs/security-model.md and docs/architecture.md are the orchestrator's own
writes, a dispatched implementer being denied writes under docs/. Nine prose carriers were corrected across
those two documents, five found by a structural sweep and four by the verification pass; a sweep by the named
list alone would have missed four and would have wrongly rewritten two true statements, one about the decay
pass and one about the project-scoped stamp-rate reading.

The gate. Build exit 0, 93 files, 1208.4 KB. Whole gate 2858 tests, 2848 passing, 1 failing, 9 skipped, exit 1,
read from the run's own marker rather than from the harness's completion notification, which reported exit 0
for the same run because it reports the launcher's exit and not the command's. Against the recorded whole-gate
baseline of 2842 / 2832 / 1 / 9 at exit 1, the failing count is unchanged and the one failure is the same named
permanent red this box produces, memory-session.test.js's pinned-directory path-length case, which the project
memory suite-baseline-is-not-zero-fail documents as failing here on every run because this machine's
seven-character TEMP lands the fixture under the guard the test means to exercise. So the red means the guard
was not exercised rather than that it broke, and there are no regressions. The box was claimed for the build
and the gate under this session's own id and released immediately after, its Session line read before the
delete; the run overran its declared Expected-seconds and two peer sessions waited behind it, both of which
were told when it freed.

Next: section 2, one resolution contract and the stranded tier dispositioned. Commit model in effect:
Commit-and-Push.

### Interim board 2 - 2026-09-01

Section 2 is the only section open. Its root-cause investigation is complete and its implementation is
dispatched and in flight, so no section has closed since Chapter 1 and this entry is the boundary
rather than a Chapter.

Stage. Section 2 ("One resolution contract, and the stranded tier dispositioned", Model: opus) had its
root cause established inline by the orchestrator, because the section's own text makes the finding the
thing that decides the fix's shape. The finding is below. Implementation is dispatched to an
implementer-opus at the section's tier. Nothing has been reviewed or gated yet.

The root cause, and it is one defect wearing three faces rather than three symptoms. The store's
project tier is named by `sanitizeProjectPath` at `plugins/claude-kit/scripts/memq.js:519`, which is
`String(cwd).replace(/[^A-Za-z0-9]/g, '-')`. That function is total: it accepts any input whatsoever
and always returns a plausible directory name, and it never refuses. `sanitizeProjectPath(undefined)`
returns the literal string "undefined", which then survives the sanitizer untouched because it is all
letters, and that is the whole provenance of the stranded `~/.claude/projects/undefined/` tier the
Evidence section names. The same missing refusal produces the tier split: `projectSegment(cwd)` at
`:891` resolves pin, then `worktreeMainRoot(cwd)`, then the sanitized cwd, so a shell that has drifted
into a subdirectory silently resolves a different, real, writable, empty store rather than failing.
Measured live on this box: `D:\claude-kit` resolves the store holding 52 records and
`D:\claude-kit\test` resolves a separate `D--claude-kit-test` store. The two surfaces then feed that
one resolver from two different inputs and nothing reconciles them, which is the split the coordinator
reported: the SessionStart hook uses the harness-reported session cwd
(`hooks/memory-session.js:1270`, `payload.cwd` with a `process.cwd()` fallback) while the memq CLI
always uses `process.cwd()`.

The defect has a measured footprint rather than a theoretical one, which is what decided fixing it over
documenting it. The store on this box holds 8 records in directories nothing reads, and a family of
empty splinter tiers beside them. The splinters that correspond to subdirectories of a live repository
are all empty; the worktree-shaped ones are all empty too, which is independent evidence that the
worktree handshake is working correctly and must not be disturbed.

The third symptom is not a defect, and the plan's own instruction not to record an unexplained clean is
honored here. No transient-shaped name is resolvable by any reading verb at HEAD. `isMemoryFilename` at
`:965` requires a name whose last three characters are `.md`, and both reading rungs pass through it:
the name-constructing rung builds `target + '.md'` at `:6303`, and every directory-enumerating rung
filters by it (`:4043`, `:7228`, `:3711`, `:11051`). A home-redirected fixture holding an indexed orphan
`orphan.md.bak` beside a live `shadowed.md` with a differing `shadowed.md.bak` was probed across get,
recall, recent, find, unstamped and touch: no verb returned a backup's body, `memq get orphan` answered
that nothing was named orphan, and `memq get shadowed` returned the live body, which is the withheld
control proving the instrument could speak. The attribution the section demands is that this green is
caused by nothing recent: the name-to-file construction has been memq's only one since commit
`f270e9c` on 2026-07-31 and is present in all four of the 2026-08-30 commits, so `get` could never have
answered from a backup. The reader and the sync allowlist already agree about what a record is, where
the section's text expected them to disagree. The regression pin is kept regardless, per the section's
instruction.

The correction to the plan's own evidence base is worth stating plainly, since a later reader will
otherwise trust the Evidence section over this one. The Evidence entry describes the serious case, a
backup beside a live record, as the case nobody has run. It is in fact the only case present on this
box: all 30 record backups here have a live sibling and every one of them differs from it in content,
and there are no orphans at all. The serious case is green.

Live dispatches. One implementer-opus, asked for three deliverables over
`plugins/claude-kit/scripts/memq.js`, `plugins/claude-kit/hooks/session-start.js`,
`plugins/claude-kit/skills/memory-system/SKILL.md` and `test/memq.test.js`: one new leg in
`projectSegment`, a refusing `sanitizeProjectPath`, and the skill's resolution paragraph amended. Its
first-turn reading was taken after the window closed and read 45 assistant lines all resolving
`claude-opus-5`, with no synthetic placeholder, so it is neither the never-started shape nor a
substitution.

Gate baseline. None recorded for section 2 yet. The section's targeted lane has not run, because the
box has been under a foreign heavy-process claim for the whole of this section's implementation so far.

Rulings adopted since the last boundary.

The resolution contract is the harness's own answer rather than an inference. The new leg asks which
project directory the harness filed this session's transcript in, and a correct implementation of that
lookup already exists in the tree at `ownTranscriptDir` in `hooks/session-start.js`, with a simpler
second one at `findTranscript` in `hooks/kit-goal.js`. The instruction is to single-source it into memq
and have session-start delegate to it, rather than write a third copy, because a claim corrected in one
carrier and left standing in another is this repository's recurring defect and three copies of one scan
is that defect authored in advance.

The worktree leg stays ahead of the new leg, and this ordering is load-bearing rather than incidental.
The harness files a worktree session's transcript under the worktree's own project directory, while
memq deliberately maps a worktree's memories to the main checkout's directory; the doc block at
`memq.js:507` calls a per-worktree store split the defect that resolution exists to close. Putting the
session leg first would silently undo the worktree fix, so the brief requires a comment saying so at
the site, and a regression pin proving the ordering both directions.

The repo-root walk was considered and rejected on measurement rather than on taste. Resolving the
segment from the enclosing git repository root would have been the smaller change, and it fails on a
real case: `~/.claude` is itself a git repository, so a coordinator seat running under
`~/.claude/coordinator/SCOTT-CLAUDE` would have been redirected into `~/.claude` and every session
anywhere beneath it would have collapsed into one tier. It also assumes a session's working directory
is its repository root, which nothing guarantees. The chosen design has zero measured casualties, which
was checked against every record-holding store on this box rather than against a sample.

Leaving the code alone and fixing the instruction was also rejected. The memory-system skill already
documents the subdirectory behavior, and documentation has not prevented the 8 stranded records, so the
section's prescribed invariant needs a mechanism rather than a warning.

The stranded tier is dispositioned. `~/.claude/projects/undefined/` held one record, `drive-probe.md`,
whose body is fixture prose, with no index beside it and no committed code anywhere in the repository
naming it. It was backed up to `.kit/scratch/stranded-undefined-backup/` and the directory removed. The
plan's Evidence entry describing it is deliberately left as authored, because Evidence is the journal
layer recording what was found rather than a statement of current state. One further splinter was
created and removed during the investigation: running memq from inside that directory minted
`projects/C--Users-LocalAdmin--claude-projects-undefined`, which is the defect reproducing on contact,
and it was removed too.

Shared tree. This checkout carries another session's uncommitted work: `sidecar/CONTRACT.md`,
`sidecar/batteries/README.md`, `sidecar/battery.js`, `sidecar/daemon.js`, `sidecar/judge.js`,
`test/kit-sidecar-battery.test.js`, `test/kit-sidecar-daemon.test.js` and an untracked
`sidecar/prompts/judgment-v3.js`. None of it is this section's and none of it will be staged here.

Box contention. The heavy-process claim has been held by a foreign session for this whole stretch and
was re-taken at 15:13Z on a 1800-second window after a brief release. This session yielded its place in
the queue to a third session holding a one-minute lane. No claim was written by this session while a
foreign one stood, and none was deleted that this session did not own.

Next action. Await the implementer, verify its delta, recover the red-first evidence by probe where the
box contention prevented the implementer from watching a test fail, then the review round, the section
close gate, Chapter 2 and the commit.

### Interim board 3 - 2026-09-01

Section 2 is still the only section open. Two review rounds have been adjudicated since the last
boundary and neither closed it, which is what earns this entry rather than a Chapter.

Stage. Section 2's implementation is complete and has been through one review round, one fix round and
the orchestrator's own verification; a second review round is dispatched and in flight. Nothing is
staged and nothing is committed.

Round 1's verdicts and what they found. Three reviewers at opus, effort max, over the changeset:
adversarial CHANGES_REQUIRED with one Critical, blind CHANGES_REQUIRED, security CONCERNS. All three
converged independently on one root cause rather than on separate defects: the session-transcript leg
was unscoped. It fired whenever the working directory was this process's own, which captured an
unrelated checkout the session stepped into, reopened the per-worktree split for a worktree session
whose working directory sat outside the worktree, and routed around the empty-string refusal the
section had just added, since `path.resolve('')` is `process.cwd()`. The orchestrator confirmed that
last one live before acting on it: `sanitizeProjectPath('')` threw while `projectMemoryDir('')` returned
a real store.

The ruling that shaped the fix, and it is one predicate rather than seven patches. The leg is honored
only where the working directory is this process's own AND some ancestor of it, counting itself,
derives the segment the transcript names. That single gate closes the cross-checkout capture, since an
unrelated checkout's ancestry never derives this session's segment, and closes the worktree-outside case
for the same reason, while leaving the subdirectory fix working. A second ruling settled where the scan
reads: the harness's own `~/.claude/projects` rather than memq's store root, because transcripts are
written by the harness and a store redirect does not move them. That one retired a finding rather than
fixing it twice, since `hooks/kit-goal.js` composes the harness root too and the two spellings now agree
again.

What the fix round delivered, all of it pinned red-first against isolated copies under `.kit/scratch/`
rather than against the tree: the ancestor gate, the harness root, validation moved ahead of every leg,
an ambiguous transcript match answering null instead of taking the first readdir hit, a once-per-process
stderr note when the session leg redirects away from a store that exists, no memoization of a truncated
or thrown listing, link-resolved spelling comparison, one exported resolver so the recognition nudge's
log root and memory tier cannot be derived by two rules, the grant pin's source scan extended over all
three allowlisted siblings with a planted-source control, and per-verb positive assertions so the
transient-name loop cannot pass vacuously.

Two defects the orchestrator found after that round, both fixed inline and both watched red first. A
relative working directory was still flattened into a junk segment: `memq.projectMemoryDir('test')`
resolved a store literally named `test` and `'..'` resolved one named `--`, which is the section's
founding defect wearing another spelling, so an absolute path is now required and the refusal reads the
same wherever it is called from. And `test/hook-canary.test.js` was failing, inherited from this
section's own first round rather than caused by the fixes: memq's new static require of
`kit-goal-lib.js` means deleting that module now breaks every hook that loads memq, four flagged probes
where the test expected two. The canary was correct and the expectation was wrong, so the expectation
was widened with the reason recorded at the test.

The accepted trade behind that canary change, recorded because it is a deliberate deviation rather than
a fix. memq now loads `kit-goal-lib.js` on every invocation, for one session-id predicate, and two more
files can now render memq unloadable. The require is static rather than lazy because the grant pin
requires memq's loads to sit in one contiguous literal block, a lazy one being exactly the dynamic load
that pin exists to forbid. The fail-open direction the canary prints is a pre-existing property of an
unloadable memq rather than anything this dependency introduced; what grew is the number of files whose
absence produces it. Reversal is cheap if the startup cost ever bites: move the one predicate into a
smaller shared module.

Gate baseline, and a correction to the one this plan has been carrying. The fix round's targeted lane
over the section's files plus the whole-tree pins whose subject they are ran 1600 tests, 1596 pass, 2
fail, 2 skipped, exit 1 read from the run's own marker file. The two failures were the documented
permanent red on this box (`a pinned directory too long to name faithfully stands the session down`,
`test/memory-session.test.js:854`, a 254-character fixture path against a 260 cap because TEMP is
`D:\Temp`) and the inherited hook-canary red described above. So the honest baseline for this section is
that its post-round-1 state carried 2 failing, not the 1 the plan's earlier entry implied, and the
canary fix returns it to 1. The whole gate has not run yet; it runs before the push, because this plan
is Commit-and-Push straight to a trunk consumers install from.

Live dispatches. One Workflow round of three read-only reviewers, all `claude-kit`-scoped agent types at
model opus and effort max, over the eight changed files: adversarial and security sighted with the
first round's findings and their dispositions, blind with the changed-file list and nothing describing
the change. The reviewer tier is opus with no headroom over an opus-tier section, which is what puts the
effort at max and the dispatch on the Workflow route rather than the Agent tool.

Rulings adopted since the last boundary, beyond the two above.

The relative-path refusal is a refusal rather than a resolution. Resolving a relative spelling would
answer a different question than the caller asked, since a relative path means "here" only for whichever
process reads it, and every caller in the repository already holds an absolute directory. So a relative
value reaching the resolver means the caller lost track of what it was holding, and the failure belongs
at that call.

The sidecar keeps the cwd derivation, and this is the recorded disposition the section's text requires
rather than an omission. `sidecar/memory-index.js` composes its own segment and never reaches the
session leg, so a session working from a subdirectory writes records the daemon's recognition pass will
not find. The spec places that file out of scope, the divergence is fail-quiet rather than fail-wrong,
and closing it means giving a long-lived daemon process a resolver whose answer depends on a session
environment variable it does not carry. It is named here so a later reader finds a decision rather than
an oversight.

Docs carriers corrected, since a claim fixed in one carrier and left standing in another is this
repository's recurring defect and it recurred inside this very section. `docs/architecture.md` carried
the old resolution claim in three places; the orchestrator corrected one, the review round caught the
other two, and all three now state the four legs, the two-part gate, the harness root and the ambiguity
refusal. The memory-system skill's resolution paragraph and its stamp-rate paragraph were corrected in
the same round.

One correction is agreed and deliberately not yet made. `docs/security-model.md` carries a Critical: it
enumerates the readers of `CLAUDE_CODE_SESSION_ID` as two and this section adds a third, and what that
third one steers is which project's memory tier reaches the model at SessionStart; its line 21 also
still gives the project tier's name as the sanitized working directory with the worktree link as the
one deliberate divergence. That file is held uncommitted by another session mid-effort, and git cannot
split a mixed file, so committing it would publish their unrelated paragraph under this section's
message. The agreed sequence, reached on the peer channel and recorded here because nothing agreed over
messaging is real until it lands in the plan doc: that session commits its paragraph and sends the hash,
this session then makes both edits on top and commits only its own. The fallback, if this section is
ready first, is that whichever session commits names both contributions with the other's explicit
recorded agreement. The Critical is fixed before the section closes either way; what is waiting is the
commit of one file, not the fix.

Shared tree. This checkout carries another session's uncommitted work: `sidecar/CONTRACT.md`,
`sidecar/batteries/README.md`, `sidecar/battery.js`, `sidecar/daemon.js`, `sidecar/judge.js`,
`test/kit-sidecar-battery.test.js`, `test/kit-sidecar-daemon.test.js`, `docs/security-model.md`,
`docs/plans/claude-kit_judge-partial-input_spec_v1.md` and an untracked `sidecar/prompts/judgment-v3.js`.
None of it is this section's and none of it will be staged here. A peer commit advanced this checkout's
HEAD from `5a13a3e` to `3f93518` mid-round; it carried only that session's own plan doc and doc indexes,
and no file of this section was swept into it.

Files in scope, widened twice during execution and named here because the section's staging and its
close both read that list: `plugins/claude-kit/hooks/memory-recognition-nudge.js` was folded in when the
review found its log root and its memory tier resolving by two different rules, and
`test/hook-canary.test.js` was folded in for the inherited red this section caused.
`docs/architecture.md` and `docs/security-model.md` are carriers this section's changes falsified.

Box. The fix-round implementer held the heavy-process claim under this session's substituted id and
released it. The orchestrator wrote and released its own claim around the two red-green probes, scoped
the delete by the `Session:` line, and left a foreign claim untouched when one stood. A peer session
negotiating for the slot read this session's agent-written claim as hand-written, which is a real gap:
the claim file's identifying fields cannot distinguish a dispatching session from its delegate, so a
waiter addresses a session that cannot release it. Captured to the kaizen inbox.

Next action. Await the second review round, adjudicate it, run the whole gate with the contention lane
beside it because the push lands on an install-surface trunk, take the security-model.md handoff from
the peer, then Chapter 2, the commit and the push.

### Interim board 4 - 2026-09-01

Section 2 is still the only section open. A third review round has been adjudicated and did not close it,
which is what earns this entry rather than a Chapter.

Stage. Section 2's implementation is complete and has been through two review rounds, two fix rounds and
the orchestrator's own verification. The second review round returned worse verdicts than the first, and a
third fix round is dispatched and in flight at an escalated tier. Nothing is staged and nothing is
committed beyond the interim board entries themselves.

Round 2's verdicts. Three reviewers over the eight changed files, all at opus and effort max through the
Workflow route: adversarial CHANGES_REQUIRED with two Criticals, blind CHANGES_REQUIRED, security BLOCK
with two Majors. All three resolved at `claude-opus-5` across every assistant turn, 548,280 subagent tokens
and 170 tool calls over 29 minutes, with no substitution and no synthetic placeholder.

The finding that matters most, and it is the security lens's alone: the ancestor walk the first round's fix
introduced crosses repository boundaries, so a session standing inside a nested independent checkout reads
and writes the enclosing project's memory tier. The orchestrator reproduced it independently rather than
taking the report: a directory created under `.kit/scratch/` holding its own `.git`, and therefore an
independent repository, resolved `C:\Users\LocalAdmin\.claude\projects\D--claude-kit\memory`, which holds
52 records belonging to the enclosing repository, with `projectTreeRoot` answering `D:\claude-kit`. Both
directions are live harm: the enclosing project's records enter session context while the session works in
a different repository, and a memory written there lands where that repository's own sessions will never
read it, which is the split this section exists to close, reproduced one level down. It is security weight
and heading onto a trunk consumers install from directly, so it is fixed before the section closes rather
than parked.

The second Critical is the same class one site over. A subdirectory of a linked worktree reopens the
per-worktree store split the session leg was deliberately ordered behind, because `worktreeMainRoot`
consults only `<cwd>/.git` and never walks up, so a directory one level inside a worktree falls through to
the session leg and lands on the worktree's own segment while the worktree root folds to the main
checkout's. The remaining blocking findings are that `anchorRoot` was never brought onto the new contract,
so a real record's anchors resolve against the wrong tree and every anchored file reports drift, and that
the section's new refusal escapes into `sidecar/memory-index.js`, whose own header states that nothing
there throws at its caller, along a path reachable from a spool line any local process can append, which
stops a daemon a scheduled task runs perpetually per VM.

The escalation, and the comparison that earned it. The section is opus tier and its two prior rounds both
failed with Criticals, so the ladder required a comparison of the two rounds' surviving Criticals before
any tier bump. Round 1's root cause was that the session leg answered where it must not, capturing an
unrelated checkout and reopening the per-worktree split for a cwd outside the worktree. Two of round 2's
four blocking findings are that same class at new sites: the leg crosses a repository boundary, and it
reopens the per-worktree split for a cwd inside the worktree. A finding class therefore repeats, which
means the implementer is missing something and the tier is the lever rather than the spec's premise being
the generator, so the bump is spent rather than a consult convened. The session runs below fable and the
section is tiered opus, so the ladder's answer is one re-dispatch to `implementer-fable` carrying the
explicit fable model override. Its first-turn reading was taken at the window's close and read 45 assistant
lines all resolving `claude-fable-5` with zero synthetic placeholders, so the override took and the round is
genuinely running at the escalated tier.

Standing Brief Amendments written, which is the section's real structural output. Two finding classes have
now surfaced twice each, and two instances means the workflow is generating the defect rather than one
implementer having missed it, so the generator is fixed rather than the output. The block sits above
`## Sections of Work` and binds every section opened or re-dispatched after today. The first entry requires
that a change falsifying a claim sweeps every carrier of it, on the claim's shape rather than on a list of
file names, and reports the sweep by predicate and scope including the sites it deliberately left
unchanged. The second requires that a change altering a shared contract enumerates every committed caller
with a tree-wide grep before the fix is written, treats each caller's own documented contract as the
standard the change must not break, and routes any reached caller outside scope rather than leaving it
named only in a report. Writing the block is approval drift by construction, since it sits inside the
approval-scoped region, and it is recorded here as deliberate.

Files in scope widened again, to `plugins/claude-kit/hooks/kit-goal.js`,
`plugins/claude-kit/skills/executing-work/SKILL.md` and `sidecar/memory-index.js`. The first is the third
copy of the transcript scan this section's own ruling said should be single-sourced, and it gained neither
guard the shared scan acquired. The second carries the falsified resolution claim in the copy an executing
session actually reads at recall time, which is the amendment's own first instance. The third is where the
new refusal escapes into a faultless-by-contract caller, and it is a security Major this section caused,
which is never parked whatever its scope. The recorded sidecar disposition is unchanged and explicitly
covers the divergence rather than the throw.

Gate baseline. Unchanged from Interim board 3 and not re-measured this round, since no code moved between
the round 2 dispatch and now: the fix round's targeted lane read 1600 tests, 1596 pass, 2 fail, 2 skipped,
exit 1 from the run's own marker, the two failures being this box's documented permanent red and the
inherited hook-canary red the canary fix has since returned to 1. The whole gate has not run for section 2
and runs before the push, because this plan is Commit-and-Push straight to a trunk consumers install from.

The security-model.md handoff is resolved, and the resolution is recorded here because nothing agreed over
messaging is real until it lands in the plan doc. The KIT: Expert session holds that file uncommitted and
reports its own commit is hours out behind a model endpoint whose generation lane is saturated. It gave
explicit recorded agreement on the peer channel for the fallback: whichever session commits the file first
wins, and if that is this one, this session commits both contributions in one commit naming the expert
session's paragraph as its work landed by agreement. Two conditions were set and accepted: commit the file
at the natural section close rather than earlier, so this section's corrections land in the same changeset
as the code that falsified them, and touch no other file of theirs. That session subsequently reported its
paragraph shrank from fifteen lines to six as its own review round moved work to a later section, so
whatever the file holds at close is what lands, and no snapshot of the older text is held anywhere here.
The security lens raised the bar on what those edits owe: beyond the reader enumeration and the line-21
derivation sentence, the harm sentence at line 453 is falsified too, since it prices a weak gate on the
worst case being a compaction's timing, and a third reader now steers which project's memory tier reaches
the model; the honest replacement states the new leg's own corroboration as the bound. The collision
blindness of the sanitized-name comparison also wants naming beside the existing residual, and the tier
boundary wants fixing rather than documenting, which is what the escalated round is doing.

One review-process defect of the orchestrator's own, recorded because it bears on how much the round's
independence is worth. The blind reviewer reported that its brief was mildly contaminated: two phrases in
it, naming a new refusal and naming delete semantics, do not read identically for every diff in this
repository, which is the property test a blind brief must pass. It states that it disregarded the framing,
opened no spec, plan or docs path, and reviewed the diff and the touched files alone, and its findings
converge independently with the adversarial lens's on the two shared Criticals, so the round's value stands.
The defect is the orchestrator's brief-writing rather than the reviewer's reading.

Shared tree. This checkout still carries the other session's uncommitted work: the sidecar sources and
their two test files, `docs/security-model.md`, `docs/plans/claude-kit_judge-partial-input_spec_v1.md` and
an untracked `sidecar/prompts/judgment-v3.js`. None of it is this section's and none will be staged here,
with the single exception of `docs/security-model.md` under the recorded agreement above.

Box. No claim was held by this session during round 2, which ran three read-only reviewers that build and
run nothing. The escalated fix round carries the claim protocol in its brief under this session's
substituted identity. Two scratch git repositories exist under `.kit/scratch/`, one pre-existing from
2026-08-29 and one this session created to reproduce the crossing; both are gitignored and neither is
tracked.

Next action. Await the escalated fix round, verify its delta and re-read its red-first evidence, then a
third review round over the fix delta, which is owed rather than optional because the delta reaches a
resolution rule, adds a module the section did not have, and touches a daemon's fault path. Then the two
documentation corrections that are the orchestrator's own, the whole gate with the contention lane beside
it because the push lands on an install-surface trunk, then Chapter 2, the commit and the push.

### Interim board 5 - 2026-09-01

Section 2 is still the only section open. A third review round has been adjudicated and a fourth fix round
is in flight, which is what earns this entry rather than a Chapter.

Stage. Section 2's implementation is complete and has been through three review rounds, three fix rounds
and the orchestrator's own verification twice. The third review round is the first that returned no
blocking finding. Nothing is staged and nothing is committed beyond the interim board entries.

Round 3's verdicts, and the direction of travel is the point. Adversarial APPROVED_WITH_CONCERNS, security
CONCERNS where round 2 was BLOCK, blind CHANGES_REQUIRED on three Majors. No Critical survived
adjudication anywhere in the round, so this was not a failed round under the tier ladder and no further
escalation arose. The code pair ran at fable, which is the escalated writer tier and so the tier the
reviewers take one step from under the cap; the security lens never runs at fable per-section, so it ran at
opus and effort max through the Workflow route. All three resolved fully at their assigned models, 45, 43
and 35 assistant turns at `claude-fable-5`, `claude-fable-5` and `claude-opus-5` respectively, with zero
synthetic placeholders.

All four of round 2's blocking findings were independently confirmed closed, each with a discriminating
pin: the repository-root ceiling with the match test correctly ahead of the ceiling test so a filed project
that is itself a repository root still matches at zero steps, the worktree fold that makes the tier and the
tree root come out of one derivation, `anchorRoot` delegating to `projectTreeRoot`, and the sidecar's
faultless-by-contract call path with no unwrapped memq call left reachable from a spool line. The security
lens walked that call graph in full rather than sampling it.

The finding worth the round, and it belongs to the blind lens alone. `sidecar/memory-index.js` carries a
header asserting that the derivation lives in memq and is reached through its exports, and that a second
spelling in that file would send the daemon looking in a directory the store is not using, silently. That
is now the shipped state, because memq's resolution gained the session leg and the sidecar's did not. The
recorded disposition permitting that divergence stands and the resolution is not being changed; what is
being corrected is the header, which forbids the very divergence the disposition permits. The sighted lens
did not find it, and the reason is instructive rather than incidental: the brief disclosed the recorded
disposition, so the sighted reviewer read that file as settled, while the blind lens read its header cold.
That is the blind pair earning its cost on a section where the sighted brief was accurate and complete.

The general lesson is recorded because it outlives this section: a decision to accept a divergence still
owes a sweep of every carrier claiming the divergence cannot happen. That is Standing Brief Amendment 1
firing on the section that generated it, one round after it was written.

Two further carriers were caught in the same class. `harnessProjectsRoot`'s header claims to be the kit's
one spelling of the harness projects root, and `kit-compact-lib.js` independently spells it; the previous
round corrected that same comment for a different consumer by making `kit-goal.js` delegate, and a third
consumer existed. And two skill bodies claim unconditionally that a worktree resolves the main checkout's
store from its subdirectories too, which holds only where the transcript is filed under the worktree's own
segment. That last one is explicitly not a regression, since the pre-session-leg code answered the same
way, so the claims are being conditioned rather than the code changed; the alternative the reviewer floated,
folding at the ceiling, is a behavior change beyond this section and was declined.

Deliberate acceptances, recorded so they read as decisions rather than omissions. The `kit-goal.js`
narrowing, where a session id filed in two project directories now arms unbound instead of binding on the
first directory listing hit, is accepted with its trade. Two lenses flagged it and the security lens
affirmatively cleared it, finding that the arming session is still recorded, the claim points still bind,
every failure degrades to the unbound arm rather than to a wrong bind, and the goal state file now holds one
fewer home-prefixed absolute path. What it costs is that a session resumed from a different directory arms
unbound where it previously armed bound. And `sessionTranscriptDir` memoizing a null for an unbounded
zero-match listing for the life of the process is pinned as intended and harmless for the per-invocation
processes that exist today, named here as a latent trap for the first resident consumer that carries a
session id.

The orchestrator's own verification, taken rather than accepted from the report. The cross-repository
crossing was reproduced before the fix and re-probed after it: a scratch directory holding its own `.git`
resolved the enclosing project's 52-record store before and resolves its own segment now, while
`D:\claude-kit\test` still resolves the enclosing project's store, which is the behavior the section exists
to add and the control that would have caught a fix that closed the hole by disabling the feature. One
implementer claim did not survive checking and is recorded because it bears on how much a report is worth: a
changed assertion in `test/memq.test.js` was described as a stale control predating the round, and the
string it names appears nowhere in the base ref's copy of that file, so the assertion was authored by this
section's own earlier round. The change is right on its merits and the description was wrong.

Gate. The orchestrator ran the targeted lane itself over ten files: 1168 tests, 1165 pass, 1 fail, 2
skipped, exit 1 read from the run's own marker, the single failure being this box's documented permanent
red. That matches the implementer's reported figures exactly, so its gate claim holds. Build exit 0 at 93
files and 1216.9 KB, taken on the same PowerShell host as the implementer's so the figure is comparable,
which the project memory `build-size-differs-by-powershell-host` is what prompted and which was stamped
applied for it. One lane before that was lost to a self-inflicted red worth recording: a one-word comment
fix to a hook landed after the build, and because the build stamp hashes hook bytes the canary's integrity
check correctly reported the installed file was not the one the build packaged. The rule that a hook edit
owes a rebuild before the gate is the same rule the doctrine states for a merge, arriving by a different
route.

An earlier lane in the same stretch was read wrongly and is recorded as a process defect rather than a
result: it was launched with the harness backgrounding a shell that itself backgrounded the run, so the
child died with its parent, the completion notification reported exit 0, and the log was empty with no
marker written. The notification reports the launcher's exit and not the command's, which is exactly why
the marker is the reading, and here the marker's absence is what caught it.

Live dispatches. One implementer at fable, resumed with its own context rather than re-briefed, carrying
ten items: the one real bypass, six carrier corrections, and three guards. The bypass is the repository-root
ceiling being evaluated per spelling with the lexical spelling walked first, so a symlink or junction inside
the filed project pointing at a subdirectory of another repository crosses the ceiling and reproduces round
2's harm class through a spelling rather than a path. It was filed as a Minor and is being worked at the
weight of the Major whose harm it reproduces.

The security-model.md edits are now specified rather than sketched, which matters because that file carries
this section's one security-weight correction and is committed under the peer agreement recorded in
Interim board 4. Six edits are owed: the line-21 derivation sentence restated as four legs plus the refusal
that retired the stranded tier; the reader enumeration moved from two to three with what the third steers,
which is which project's memory tier reaches the model at SessionStart; the harm sentence pricing the weak
gate on a compaction's timing, which that third reader falsifies; the honest bound on the new leg's
corroboration now that the climb is ceilinged, which is that a wrong or hostile session id cannot name a
store and can only select, among directories that already exist, one satisfying all four of a single
transcript of that id under the harness projects root, the working directory being this process's own, an
ancestor of it deriving that same name, and no repository boundary in between, with the two honest limits
that the corroboration is a filename's existence rather than its content and that the variable is settable
by any process running as the operator; a narrowing rather than a deletion of the goal-state residual
sentence, since the first-of-several case is closed while a single match lying in another project's
directory still stores that path; and the sanitized-name equivalence class stated as a widening rather than
as blindness, because an ancestor's projection can now collide where only the cwd's could before. Two
residuals are named alongside them: a stray `.git` written between the working directory and the filed
project root silently disables the session leg, fail-safe but third-party-triggerable, and the link-spelling
bypass if the in-flight fix does not fully close it.

Shared tree and the peer agreement, unchanged from Interim board 4 and restated because this is the entry a
resuming session reads first. The other session's uncommitted work stays unstaged, with the single
exception of `docs/security-model.md` under its explicit recorded agreement that whichever session commits
first carries both contributions named. It has since reported its paragraph shrank from fifteen lines to
six, so whatever the file holds at close is what lands and no snapshot of the older text is held here.

Box. The claim was written under this session's own id for the build and the two lanes and released after
them, its `Session:` line read before the delete. A claim the previous fix round wrote under this session's
substituted identity was found already absent at that round's completion, removed by something else on the
machine, which is the delegated-claim-identity gap already captured to the kaizen inbox. Two scratch git
repositories sit under `.kit/scratch/`, one pre-existing and one this session created to reproduce the
crossing; both are gitignored.

Next action. Await the fourth fix round, verify its delta and its rebuild, then judge whether the delta owes
a fourth review round under the owed-round triggers. Then the `docs/security-model.md` and
`docs/architecture.md` corrections that are the orchestrator's own, the whole gate with the contention lane
beside it because the push lands on an install-surface trunk, then Chapter 2, the commit and the push.
