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
- The lifecycle surface, verified 2026-08-30 against harness v2.1.251 (installed, version read from the CLI) via a docs pass: `UserPromptSubmit` injects `additionalContext` the model sees before processing; `SubagentStart` is a dedicated dispatch-time event carrying `additionalContext`; the same docs pass claimed an `updatedInput` channel there, and the installed CLI contradicts it, its SubagentStart path reading `additionalContext` and nothing else, so that cell is governed by the measurement rather than by the pass; `Notification` and `MessageDisplay` discard hook output and cannot surface anything. One cell of that docs pass was contradicted by live behavior and the live behavior governs: the pass claimed the tool-use events inject nothing, while the kit's own recognition nudge demonstrably injects context on both `PreToolUse` and `PostToolUse` on this machine. The lesson rides as the probe rule in section 3: no event's injection mechanics are trusted from a table, each is proven by a watched firing before code builds on it.
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

- 2026-09-01, from section 2's fifth review round. **A fixture that stands in for a broken state proves
  nothing unless it reports that it engaged, so give every shim a fired marker and assert it.** The two
  instances are a regression test that could not fail off Windows, because the probe resolved its
  working directory through a call that canonicalizes the link the test depended on, and a preload shim
  that strips a module export only when the require string matches, with nothing asserting the match
  occurred. Both produce output byte-identical to an ordinary passing run, so the case reads green
  whether the condition under test was created or silently skipped, and the guard the test protects can
  be deleted without the suite noticing. The shape generalizes past preloads: any fixture whose job is
  to put the system into a state the code must handle owes evidence that the state was actually
  reached, because the failure is indistinguishable from success at the assertion. Write the marker from
  inside the branch that performs the substitution, assert its existence in the case, and where the
  fixture cannot report from inside, assert instead on something only the substituted state can produce.
  A control that asserts the same outcome as the ordinary run is not a control, since it withholds
  nothing and would pass with the fixture removed entirely.

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

Two new hook registrations in the kit's established nudge idiom, both dormant-tolerant and fail-open like every kit nudge. On `UserPromptSubmit`: the prompt text is matched against the project tier alone, and against no tier at all while a store pin is in effect, and hits inject as `additionalContext` in pointer-not-body discipline, the record name, one clause of why, and the `memq get` spelling, capped (at most 3 pointers, bounded bytes, the sidecar valve's caps are the precedent) and deduplicated per recipient per session, the dispatch boundary keying on the dispatched agent's own id so that a parent's earlier nudge on the same record cannot spend it. On `SubagentStart`: the payload carries no dispatch prompt text at all, so what is matched is the dispatched agent's type against `agent:` triggers, and hits inject as `additionalContext` into the subagent being started rather than into the orchestrator that dispatched it, which is the better half of the deviation, a subagent inheriting no memory context by any other route; the event offers no `updatedInput` channel at all, so the restraint stated in the hook's header is that this machinery does not rewrite a dispatcher's brief on the channel the event does give, a suggestion being its whole authority. Matching at both boundaries is trigger-and-lexical, with no model in the loop and no network call. Semantic matching against the store's embeddings is Tier 2, which decision 2 of the memory-recognition plan (`docs/archive/claude-kit_memory-recognition_spec_v1.md:29`) defers until the stamp-rate reading shows nudges are acted on at all, and that gate has not been read. This sentence replaces one written at authoring time that gated semantic matching on the machine's endpoint config; that gate named the judged channel's switch rather than the semantic channel's, and it reopened a decision the operator had already closed. The probe rule from Evidence binds the section: before building on either event, a trivial probe hook is registered and its injection watched to arrive in a real session, because the docs pass that mapped this surface was wrong about events the kit already uses; the probe result for each event is recorded in the chapter. Version reality is handled by construction: a machine whose harness lacks an event never fires it, and the hooks must load without error on such a machine. Tests red-first: a prompt carrying a known trigger's text yields the capped pointer block; a dispatch input carrying one yields the same at `SubagentStart`; a session with no matches injects nothing and no bytes; caps hold under a fixture with many matches.

Acceptance: both probes watched firing before implementation and recorded; a live session demonstrates a prompt-time pointer from a project-tier record and a shared-tier pointer at a tool boundary, which together are the read-side path this plan exists for, the prompt leg having been confined to the project tier by the security finding Chapter 3 records; no-match sessions inject zero bytes; whole gate delta against the baseline.

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

### Interim board 6 - 2026-09-01

Section 2 is still the only section open. A fourth review round has been adjudicated and a fifth fix round
is in flight, which is what earns this entry rather than a Chapter.

Stage. Section 2's implementation has now been through four review rounds and four fix rounds, with the
orchestrator's own verification at each. Nothing is staged and nothing is committed beyond the interim
board entries and one documentation correction described below, which is deliberately held uncommitted.

Round 4's fix, verified rather than accepted. The implementer reported DONE on ten items. The orchestrator
read the gate from the runs' own marker files rather than from the report: build exit 0, and a targeted lane
over eleven files at 1468 tests, 1465 pass, 1 fail, 2 skipped, exit 1. The failing test's identity was pulled
from the log rather than taken from the summary, and it is this box's documented permanent red at
`test/memory-session.test.js:873`. The lane grew by 300 tests because a twelfth file joined it when
`kit-compact-lib.js` came into scope, and all 300 pass, so the failure set is unchanged against the recorded
baseline. The stale-stamp trap that cost a lane earlier in this section was checked directly rather than
assumed: the packaged archive is stamped later than the newest shipped source, so the lane ran against the
bytes the build packaged.

Round 4's verdicts, and the convergence is the point. Adversarial APPROVED_WITH_CONCERNS with one Major and
four Minors, blind APPROVED_WITH_CONCERNS with two Minors, security CONCERNS with one Major and five Minors.
No Critical anywhere, so the round did not fail under the tier ladder and the fix round stays at the writer
tier rather than escalating. All three model overrides took, read from each dispatch's own transcript turns:
11 turns at `claude-fable-5`, 9 at `claude-fable-5`, 12 at `claude-opus-5`, no substitution and no synthetic
placeholder. The reviewers were given a 459-line diff of round 4's work alone, generated against the round's
own pre-state snapshot, rather than the accumulated changeset, so their budget went on the new logic.

The finding all three lenses found independently, which is what settles it. The ceiling screen that round 4
added to close the symlink bypass fails open on its own error path. The helper it leans on swallows a failed
path resolution and returns its input, so a resolution that failed is indistinguishable from a path that
holds no link, and the screen disarms itself in both directions: an unresolvable starting path collapses the
two spellings to one and skips the check entirely, and a mid-climb step where both sides fail to resolve
compares two values that are equal by construction and passes vacuously. The guard is therefore silently
inert exactly on the error paths, which is the pre-fix state the round existed to leave. The orchestrator
reproduced the mechanism by reading the helper rather than accepting any lens's account. Filed Minor by one
lens and Major by two; it is being fixed at the weight of the hole it reopens.

A withheld-control failure in round 4's own regression test, worth recording because the section keeps
generating this class. The test that pins the symlink fix cannot fail off Windows: the probe resolves the
working directory through a call that POSIX canonicalizes, so on macOS and Linux the child never sees the
link spelling, the screen is never exercised, and the case passes with the guard deleted. The hook path on
those platforms is genuinely exposed, because hooks pass the harness's payload directory rather than the
process's own. A second defect sits beside it: the fixture swallows a refusal to create the link, so a
filesystem that cannot make one produces a pass indistinguishable from a real run. Both are in the fix batch.

Standing Brief Amendment 1 firing on the round that was applying it. Round 4 corrected several carriers of
claims its own code had falsified. It also wrote a new one that a comment in the same changeset contradicts:
the sidecar component's header says the omitted resolution leg costs an undercount rather than a
misdirection, because the daemon finds no index for a subdirectory, while the resolver's own comment states
that stranded per-subdirectory store directories exist on every box that had the split, the common case
rather than the exotic one. Where one exists the daemon lands on the orphan and recognizes against records
the store no longer serves, which is misdirection. The orchestrator confirmed both texts by reading them. The
general lesson stands as the amendment already states it, and this instance is evidence the defect is
generated by the work's shape rather than by any one implementer.

Deliberate non-changes this round, recorded so they read as decisions. The timing window between the
repository-root check and the path resolutions is accepted: it needs local write access inside the tree plus
a race against a short-lived process, and the security model already states the store is not a boundary
between projects. The bind-mount and volume-mount-point case is accepted as a scope statement rather than a
vector, since a cloned repository can carry a symlink but cannot carry a mount; only the comment claiming
more than the code checks is being narrowed. And one lens asked for a symbol-presence guard on the new
cross-module call that the security lens affirmatively cleared after analysis, finding it already fail-closed
because the missing export throws inside an existing guard and yields a value the caller treats as a refusal;
the guard is declined there and taken at a sibling site where its absence would tell every session something
false about its own working directory.

Documentation the orchestrator owns. Three sentences in `docs/architecture.md` claimed unconditionally that a
worktree's subdirectories resolve the main checkout's store; that holds only where the harness filed the
session under that worktree, and a session filed under the main checkout standing inside a nested linked
worktree stops at that worktree's boundary and takes the plain derivation. All three anchors were confirmed
unique before replacement and a pre-edit copy is in scratch. The file is deliberately left uncommitted: it
describes resolver behavior that lives only in the working tree, so committing the prose ahead of the code
would put a claim in the trunk that the trunk's own code does not honor.

The `docs/security-model.md` corrections were re-grounded and the earlier specification is superseded. The
six edits sketched in Interim board 5 were written against an older state of that file and two of them were
wrong: the reader enumeration they proposed to correct is already correct in the committed file, and three
corrections placed at separate anchors in fact all live inside one paragraph. The re-derived specification is
at `.kit/scratch/secmodel-edits-v2.md` and is what a later session applies. The lesson is the standing one
about re-grounding a source at the moment of use rather than at the moment of planning, and it was caught
cheaply, by grepping the committed file for the exact claim the edit intended to fix and finding it already
true.

Gate. Unchanged from the round-4 figures above and not re-measured since, because no code moved between that
lane and the fifth fix round's dispatch. The whole gate has still not run for section 2 and runs before the
push, with the contention lane beside it, because this plan is Commit-and-Push straight to a trunk consumers
install from.

Box. No claim was held during the review round, which ran three read-only lenses that build and run nothing.
The fifth fix round carries the claim protocol in its brief under this session's substituted identity. A
sidecar advisory this turn reported that a read of three documentation anchors had returned only one; the
orchestrator checked its own tool output, found all three present and all three edited, and recorded the
advisory as incorrect rather than acting on it.

Next action. Await the fifth fix round, verify its delta and its rebuild, then judge whether the delta owes a
fifth review round under the owed-round triggers. The Major it closes is a security-weight boundary check, so
the presumption is that it does. Then the `docs/security-model.md` corrections per the re-grounded
specification and under the peer agreement, the whole gate with the contention lane beside it, then Chapter
2, the commit and the push.

### Interim board 7 - 2026-09-01

Section 2 is still the only section open. A fifth review round has been adjudicated and a sixth fix round
is in flight, which is what earns this entry rather than a Chapter.

Stage. Section 2's implementation has now been through five review rounds and five fix rounds, with the
orchestrator's own verification at each. Nothing is staged. What is committed beyond the interim board
entries is nothing of this section's code; two documentation corrections sit uncommitted in the worktree
and are described below.

Round 5's fix, verified rather than accepted. The implementer reported DONE_WITH_CONCERNS on seven items.
The orchestrator read the gate from the runs' own markers rather than from the report: build exit 0, and a
targeted lane at 1470 tests, 1467 pass, 1 fail, 2 skipped, exit 1 from `.kit/scratch/r5-lane.exit`. Against
the recorded baseline of 1468/1465/1/2 the delta is exactly the round's two new tests, both passing, with
the failure set unchanged and the single failure this box's documented permanent red. The red-first
evidence was read at the logs rather than taken on report, and it is genuinely discriminating: the
pre-fix run shows the junction control passing while both new pins fail, and the disarm run, with the
screen forced off, shows all three red. A test that can fail in both directions is what the round owed.

The Major closed, confirmed by reading the code rather than the account of it. The previous round's
boundary screen failed open on its own error path because the path-resolution helper swallowed failures
and returned its input. The fix splits the helper: the failing form now answers null, so an unresolvable
start arms the screen instead of disarming it and the climb refuses its first step, leaving only the
zero-step match, while a mid-climb step whose either side cannot be resolved breaks rather than comparing
two values equal by construction. The orchestrator traced all three failure sites in the source. The one
caller of the unchanged forgiving form is `namesOwnCwd`, whose comparison is undisturbed because that form
still returns its input on failure.

Round 5's verdicts. Adversarial APPROVED_WITH_CONCERNS with one Major and three Minors, blind
APPROVED_WITH_CONCERNS with five Minors, security CONCERNS with one Major and six Minors. No Critical
anywhere, so the round did not fail under the tier ladder and the fix round stays at the escalated writer
tier rather than climbing again. All three overrides took, read from each dispatch's own transcript turns:
45 assistant lines at `claude-fable-5`, 42 at `claude-fable-5`, 41 at `claude-opus-5`, no substitution and
no synthetic placeholder. The reviewers were given a 481-line diff of this round's work alone; the blind
lens was given the changed-file list and the base ref instead, per its own input contract, and reported its
brief carried no contamination.

The convergent Major, and it lands on the orchestrator's own work. Two lenses independently found that the
preload fixture written in this round has no engagement marker: it strips a module export only when the
require string matches, nothing asserts the match occurred, and a run in which the shim never engages
produces output byte-identical to an ordinary run. So both assertions pass while pinning nothing, and the
guard they protect could be deleted with the suite still green. The case's stated control made it worse by
asserting the same outcome as the ordinary run, which withholds nothing and would pass with the fixture
removed entirely. The sibling fixture in the very same delta gets this right and says so in its own comment.
The orchestrator wrote the defective one, which is worth recording plainly: the fold that introduced it was
written to close a different lens's concern about a guard with no durable test.

Security's own Major, and it is the house defect again, again in the round applying the rule against it.
`docs/architecture.md` still carried the claim that a mapped drive rides the resolution walk at the same
cost, which this round's own skill-body edit declared false and rewrote. The orchestrator confirmed the
finding by reading the file and confirmed the aggravating fact too: this section's diff edits that very
paragraph, changing "A fourth answer" to "A fifth answer", so the falsified clause was read past rather
than unreached. That is Standing Brief Amendment 1 failing at the hand of the session that wrote it. The
correction is made, and deliberately does not copy the skill body's wording, because two lenses flagged an
unverifiable absolute inside it; the architecture sentence states the cost conditionally instead.

Standing Brief Amendment 3 written, which is this round's structural output. A finding class has now
surfaced twice: round 4's regression test that could not fail off Windows, and round 5's shim with no
engagement marker. Both produce output identical to an ordinary passing run, so the case reads green
whether the condition under test was created or silently skipped. Two instances means the workflow
generates the defect, so the amendment requires that any fixture standing in for a broken state report
that it engaged, with the marker written from inside the branch performing the substitution, and states
that a control asserting the same outcome as the ordinary run is not a control. Writing the block is
approval drift by construction and is recorded here as deliberate.

Deliberate non-fixes this round, recorded so they read as decisions. Two unmemoized hot paths in the new
leg are accepted: neither changes an answer, per-invocation processes bound the cost, and the shape is
already recorded as a latent trap for the first resident consumer. The absence of a stderr note when the
leg declines after a resolution failure is accepted because the reporting lens explicitly demanded no code
change and the fail-closed direction is the right one; it is named here so a later reader finds a weighed
trade rather than an unseen path.

Live dispatch. One implementer at the escalated fable tier carrying nine items: the convergent Major, two
comment-accuracy defects on claims this section falsified, two skill-body corrections including softening
an absolute nobody here can verify, a fail-open in the ceiling's own repository detector that reproduces
round 2's harm class with no link involved, a defensive guard on a spelling that could throw out of the
resolver, a test-fixture prefix boundary, and test hermeticity where a hook harness still inherits the real
session id and home directory.

Documentation the orchestrator owns. `docs/architecture.md` now carries four corrected sentences, three
from earlier rounds conditioning an unconditional worktree claim and one from this round on the mapped-drive
cost. It stays deliberately uncommitted, because it describes resolver behavior that lives only in the
working tree and committing the prose ahead of the code would put a claim in the trunk the trunk's own code
does not honor. The `docs/security-model.md` corrections are now seven rather than six: the security lens
found the file carries no coverage at all of the store resolver as a cross-project data-separation boundary,
with its three residuals living only in a code comment and a skill body.

The shared checkout, and the co-held file is resolved. The peer session committed and pushed while this
round ran, moving this checkout's HEAD to `b66584e`. It committed `docs/security-model.md` with its own
content alone, at this session's suggestion, which dissolves the co-held-file arrangement rather than
managing it: the corrections owed here now land as this session's own delta on top of a committed file,
with no attribution to negotiate and no snapshot to hold. The orchestrator verified by name that the peer's
two commits swept none of this section's files, that nothing of this session's is staged, and that the
checkout is level with origin. The peer's next implementer was checked against this section's file set
before it dispatched and is disjoint.

Gate. Unchanged from the round-5 figures above and not re-measured since, because the sixth fix round's
delta has not landed. The whole gate has still not run for section 2 and runs before the push, with the
contention lane beside it, because this plan is Commit-and-Push straight to a trunk consumers install from.

Box. No claim was held during the review round, which ran three read-only lenses that build and run nothing.
The orchestrator held no claim for its own red-green probe either, which was three tests of a few seconds;
that is the same judgment the previous round's implementer flagged as its one procedural liberty, and it is
named here rather than left implicit. The sixth fix round carries the claim protocol in its brief under this
session's substituted identity, and its brief names the peer's concurrent gate as workspace contention it
cannot see from the tree.

One cross-session false-red is named in advance, because this section has already lost a lane to the same
mechanism from its own hand. The peer's implementer edits a hook and runs the build to refresh the machine
-local stamp before its own gates. The stamp hashes hook bytes, so a `test/hook-canary.test.js` run landing
between that hook edit and that rebuild reports an integrity failure on files nobody broke. That file is in
this section's lane, so a canary red arriving in this stretch is checked against the peer implementer's
activity timestamps before it is read as a regression of this section's own. This is reported from the peer
and unverifiable from here beyond the mechanism, which this section confirmed independently when it cost a
lane earlier.

Next action. Await the sixth fix round, verify its delta and its rebuild, then judge whether that delta owes
a sixth review round. Two of its items change failure behavior at the boundary this section exists to
protect, so the presumption is that it does. Then the `docs/security-model.md` corrections, now seven,
re-grounded against the committed copy before any edit since the file moved twice while this round ran,
then the whole gate with the contention lane beside it, then Chapter 2, the commit and the push.

### Interim board 8 - 2026-09-01

Section 2 is still the only section open. A sixth review round has been adjudicated and a seventh fix
round is in flight, which is what earns this entry rather than a Chapter. The compaction gate began
holding offers during the adjudication, so this boundary is taken at the gate's own signal as well as
at the drought count.

Stage. Section 2 has now been through six review rounds and six fix rounds, with the orchestrator's own
verification at each. Nothing of this section's code is staged. Two documentation writes of the
orchestrator's own sit uncommitted and are described below.

Round 6's fix, verified rather than accepted. The implementer reported DONE on nine items. The
orchestrator read the gate from the runs' own markers rather than from the report: build exit 0, and a
targeted lane at 1476 tests, 1473 pass, 1 fail, 2 skipped, exit 1 from `.kit/scratch/r6-lane2.exit`.
Against the recorded baseline of 1470/1467/1/2 the delta is +6 tests, all passing, with the failure set
unchanged and the single failure this box's documented permanent red, confirmed by name from the log.
The round added five tests, so the sixth was reconciled rather than assumed: a name-level diff of the
two lane logs, run only after a control proved the extraction pattern speaks, showed the six extra names
are the round's own five plus round 5's export-stripping test, which the baseline capture predated. The
reverse diff is empty, so nothing was removed. The first extraction pattern this check used returned
zero names on both sides, which would have read as two identical sets; the control is what caught it.

The caller audit, run independently rather than read. The round added a refusal to a path validator
reachable from the exported sanitizer, which is the shared-contract shape the third standing amendment
names. A tree-wide grep over every tracked file type found three real callers outside memq itself, and
each was confirmed at its own source rather than from the report: the compaction library both wraps the
call and feeds it resolved output the refusal cannot match, the sidecar index wraps it under a header
stating that nothing there throws at its caller, and the hook pre-decides through its own guard. The
security lens then ran the same audit with a wider predicate and reached two callers the brief never
named, which is the withheld instance that makes its sweep coverage evidence rather than an instrument
check.

Round 6's verdicts, and the first round of this section with no blocking finding anywhere. Adversarial
APPROVED_WITH_CONCERNS with four Minors, blind APPROVED_WITH_CONCERNS with three Minors, security
CONCERNS with five Minors. No Critical and no Major from any lens, so the round did not fail under the
tier ladder and the writer tier stays where the fourth round escalated it. All three overrides took,
read from each dispatch's own transcript turns: 57 assistant lines at `claude-fable-5`, 40 at
`claude-fable-5`, 52 at `claude-opus-5`, no substitution and no synthetic placeholder anywhere. The
blind lens was given the changed-file list and the base ref per its own input contract and reported its
brief carried no contamination.

The one real defect the round introduced, confirmed by the orchestrator's own measurement. The new
refusal for a rooted-but-driveless working directory is spelled as a negative lookahead on a single
backslash, and it also refuses a mixed-separator network-share root, a spelling the platform calls
absolute and the kit's own single-sourced share predicate classifies as a share. The consequence is
narrow and real: a pinned session on that spelling skips the network branch, fails the hook's
resolvability guard, and loses every working-directory-derived block it had before this section. Two
comments shipped in the same round assert the opposite. The security lens found it; the orchestrator
confirmed it by running the three predicates side by side, and the first attempt at that probe proved
nothing because the shell ate its own backslashes, which the probe's control caught by reporting a
platform-absolute spelling as not absolute. Re-run from a file, the table is unambiguous. The reviewer
rated it Minor and the orchestrator raised it to Major on adjudication, because it breaks a legitimate
spelling rather than merely reading oddly.

The recurring class again, and again found by two independent lenses. A claim that the store pin is
honored before the working directory is consulted is false, and it is false in three carriers at once:
a hook comment, a test comment, and the memory-system skill body, whose resolver paragraph also claims
completeness while omitting the refusal entirely. The code validates the working directory's spelling
before it consults the pin, which is exactly why the hook grew a pinned refused-cwd branch in the
previous round. A sibling comment written in that same round states the order correctly, so the fix is
to make the others agree with it rather than to invent new wording. This is the first standing
amendment's own class, holding as a detector while the workflow keeps producing instances.

Deliberate non-fixes this round, recorded so they read as decisions. The security lens proposed
refusing a posix-rooted spelling on Windows, which carries a real segment-collision class where two
projects on different drives entered by the same slash-spelled path collapse into one store segment.
The orchestrator declined the code change and took the documentation route instead, because a committed
test pins that spelling with a comment stating the cross-platform contract the rule exists to hold, and
refusing it would break the property that lets a Windows literal sanitize identically on a POSIX host.
The collision class is now an owed entry in the security model rather than an unrecorded residual. An
unverifiable illustrative example in a code comment is also left as written, on the reporting lens's own
judgment that the guard depends on the class rather than on the example.

Routed out of the plan, and the routing is stated in the tense that is true. The security lens found
that the kit's two other ancestor-climbing repository detectors keep the fail-open test that this
section just closed in the store resolver, which is the third amendment's named class arriving in
siblings the section's file list never reached. It is not reachable today, because both guards derive
their root from a working directory that already holds the repository marker, so the climb ends at its
first step. It is in `docs/backlog.md` at line 371, verified at that file with a control grep proving
the instrument speaks, on the memory record that says a routing claim is an intention until the target
holds it. That record was read at the moment of the write and is stamped applied.

Live dispatch. One implementer at the escalated tier carrying six items: the mixed-separator refusal
with its two false comments and a red-first pin, the pin-order claim across its three carriers plus the
skill body's completeness and own-cwd omissions, a remedy sentence that tells an operator to do what
they already did, an unguarded home-directory call whose throw would defeat the very guard the previous
round added, a case-folding rule to single-source across six test fixtures, and one comment that
over-claims what its code checks.

Documentation the orchestrator owns. `docs/architecture.md` carries four corrected sentences and stays
deliberately uncommitted, because it describes resolver behavior that lives only in the working tree.
The `docs/security-model.md` corrections are now eight rather than seven, and this round changed one of
them materially: the ordered-contract sentence must name two refusals at two different positions rather
than one, since the working-directory spelling refusal fires in front of the pin while the network-share
refusal sits behind it. The eighth is the collision class named above. The re-grounded anchors and this
round's amendments are recorded at `.kit/scratch/secmodel-edits-v2.md` so a fresh session can write them
without re-deriving the round.

Gate. The figures above are round 6's and have not been re-measured since, because round 7's delta has
not landed. The whole gate has still not run for section 2 and runs before the push, with the contention
lane beside it, because this plan is Commit-and-Push straight to a trunk consumers install from. The
whole-gate baseline to diff against is Chapter 1's own recorded run, 2858 tests, 2848 passing, 1 failing,
9 skipped, exit 1.

Box. The review round held no claim, running three read-only lenses that build and run nothing, and the
machine's claim file was read and found empty before they went out. The seventh fix round carries the
claim protocol in its brief under this session's substituted identity. A peer session sharing this
checkout reported a stale claim of its own standing from about 21:25Z to 21:36Z after a tool timeout
killed its gate script before the release step; that window is reported rather than confirmed from here,
and it plausibly explains part of the sixth round's wall clock.

The shared checkout. The review round's tree-state bracket showed exactly one delta, a one-line change
to the sidecar daemon's spool-cap message. The orchestrator adjudicated it by reading its content rather
than its path: it is the peer session's own judge-partial-input work, a subject none of the three
read-only lenses was pointed at and none could write to under the read-only guard. Not an incident. The
peer also reported its implementer's scope widening to three further sidecar files, still disjoint from
everything this section holds.

One methodological note worth keeping. The bracket script printed an exit code that was meaningless,
having captured the exit of the echo inside its own else branch rather than the comparison's. The
verdict came from the branch taken and from reading the delta, so nothing rests on that number, but it
is the exact trap the doctrine names about reading a status after a pipeline, produced here by a
session that had just quoted the rule.

Next action. Verify the seventh fix round's delta and its rebuild, then judge whether that delta owes a
seventh review round; its one behavior change is a predicate correction with a red-first pin and a
withheld control, so the presumption is weaker than last round's but not zero. Then the eight
`docs/security-model.md` corrections, then the whole gate with the contention lane beside it, then
Chapter 2, the commit and the push.

### Interim board 9 - 2026-09-01

Not a Chapter: section 3 is still open. Written at the compaction gate's signal, which had held
thirteen offers over thirty-five minutes, with section 3's first review round adjudicated and its
consult ruled.

Section 3, "Recognition meets the moment", stage: implemented, independently re-gated, reviewed by
three lenses, one consult ruled, fix round not yet dispatched.

The probe rule is discharged, and both of its results are recorded here because the section's own
spec requires it. Both events were watched firing in real sessions on harness v2.1.252, by
registering a probe hook and reading its marker rather than by trusting any table.
`UserPromptSubmit` fires and its `additionalContext` reaches the orchestrator's own context,
carrying `session_id, transcript_path, cwd, prompt_id, permission_mode, hook_event_name, prompt`.
`SubagentStart` fires once per dispatch and its `additionalContext` reaches the subagent's context
rather than the orchestrator's, carrying `session_id, transcript_path, cwd, prompt_id, agent_id,
agent_type, hook_event_name` and no dispatch prompt text at all. The probe cost two wasted readings
first: a mid-session edit to hooks.json is inert because the harness snapshots its hook
registrations at session start, so the first silence measured the instrument rather than the events.
A control armed on `PreToolUse`, which the kit demonstrably uses, stayed silent too and is what
disambiguated it. The working route is a headless `claude -p` run, which starts a genuine session
that reads the current install's registrations.

Two spec deviations follow from those measurements and are settled rather than open. The dispatch
boundary matches `agent:` triggers against `agent_type`, the payload carrying no dispatch input for
the spec's stated matching to run against. And the dispatch injection reaches the subagent, which is
better rather than worse than the spec's stated intent, since a subagent inherits no memory context
by any other route.

Live dispatches, all returned: one `implementer-opus` on the section's code; a three-lens round at
opus and `max` effort through the Workflow route, being the adversarial, blind and security
reviewers, dispatched together under one tree-state bracket; and one consultant at the same tier on
the semantic-matching question. No dispatch is in flight as this is written.

Rulings adopted since the last boundary. The round's single Critical, that spec-required semantic
matching was refused, is rejected with receipts: decision 2 of the memory-recognition plan
(`docs/archive/claude-kit_memory-recognition_spec_v1.md:29`, a plan whose Status is Complete, carried
into the shipped skill at `plugins/claude-kit/skills/memory-system/SKILL.md:233`) defers Tier 2
semantic matching until the stamp-rate gate is read. The implementation complies with that standing
operator decision and the spec's own sentence was the deviation, so the sentence is amended above
rather than the code. The orchestrator's stated reasoning for the refusal was nonetheless wrong and
is not what the record now rests on: it priced "semantic matching" at the sidecar's endpoint call
when this repo's architecture separates the semantic channel, a local in-process embedder, from the
judged channel, the endpoint. That false equation shipped into the hook's header and the fix round
corrects it.

Gate baseline for the section, on the targeted lane and read from the run's own exit code:
`node --test test/memory-recognition-nudge.test.js test/hook-canary.test.js` at 146 tests, 146
passing, 0 failing, exit 0, run by the orchestrator rather than accepted from the implementer's
report. The whole-gate baseline this section will be measured against remains Chapter 2's, 2932 /
2922 / 1 / 9 at exit 1.

Next action: one fix round covering the surviving findings, whose generator is single. The dedup key
omits the boundary and the nudge window is one shared counter, both correct while the two tool
boundaries partitioned the trigger vocabulary and both wrong now that the new boundaries deliberately
overlap it. Confirmed at the code by the orchestrator: `agent` sits in both `PRE_TYPES` and
`DISPATCH_TYPES`, `dedupKey` hashes tier, name, type and pattern with no boundary, and the marker is
keyed on a session id a subagent shares with its parent, so the parent's own pre-boundary nudge on an
Agent dispatch spends the key before `SubagentStart` can use it and the new boundary is dead on its
primary path.

One acceptance risk is named now so its resolution cannot arrive unexplained: the section's
acceptance asks for a live prompt-time pointer from a shared-tier record, and no shared-tier record
on this machine carries a trigger at all. Seven records store-wide carry one and all seven belong to
two other projects. Authoring a shared-tier trigger is therefore part of the section rather than a
fixture.

One question is batched for the operator at the section close rather than raised as a blocker, since
the work proceeds either way: whether decision 2 was reopened in the design dialog that authored this
plan, or whether the sentence amended above was a slip.

Commit model in effect: Commit-and-Push.

### Chapter 2 - One resolution contract, and the stranded tier dispositioned - 2026-09-01

Completed: section 2.

What shipped. Every resolver in the kit that decides which project's memory tier a session reads now
reaches one derivation instead of keeping its own. The store's segment is derived by an ordered contract
with four legs and two refusals, and the refusals sit at different positions rather than together: the
working directory's spelling is validated ahead of every leg, so a pinned session can be refused on
working-directory grounds, and the network-share stand-down sits behind the pin and ahead of the rest.
The legs are the honored pin, the worktree's main checkout, the session-transcript filing, and the plain
working directory. `session-start.js`, `kit-goal.js`, `kit-compact-lib.js`, `memory-recognition-nudge.js`,
`memory-frontmatter-guard.js` and the sidecar's memory index now delegate to memq's own
`harnessProjectsRoot`, `sanitizeProjectPath`, `sessionTranscriptDir` and `projectTreeRoot` rather than
restating any of them, which is what makes the contract one contract rather than six agreeing copies.
The sidecar index is the one deliberate partial adopter and says so in its own header: it takes the
worktree and flattening rules and refuses the session-transcript leg, because a session id in the
daemon's environment never names the session whose captured call it is resolving.

The three symptoms the section was opened on are all root-caused rather than patched. The tier split is
the missing spelling refusal: a working directory the harness reports and a cwd a shell has drifted to
derive different segments, and nothing refused the second. The stranded `~/.claude/projects/undefined/`
tier is `sanitizeProjectPath(undefined)` returning the literal string "undefined", which survives the
flattener untouched because it is all letters; it is dispositioned, its one record `drive-probe.md` named
and backed up to `.kit/scratch/stranded-undefined-backup/`, and the directory removed. The backup-shadow
symptom is closed at the reader: no transient-shaped name resolves through any reading verb, pinned
against a fixture that holds a `.bak` beside a live `.md` with differing content, which is the case
nobody had run before this section.

Rounds, and what the count is worth reading for. Seven review rounds and eight fix rounds, every round
verified by the orchestrator at the runs' own markers rather than accepted from a report. The writer tier
escalated once, at round 4, and held at fable through every round after. The escalation earned itself
under the ladder's own test: the finding classes repeated across two rounds, which is the signal that the
implementer rather than the spec is the generator. No round after that failed, no Critical survived
adjudication in any round, and rounds 6 and 7 both returned three verdicts with no blocking finding
anywhere.

The seventh review round is the one worth recording in detail, because it justified being run. The fix
round before it corrected a predicate, which is a security-reviewer trigger surface, so the round was owed
rather than optional, and the presumption looked weak going in. Three lenses converged on one Major the
round-7 fix had introduced by omission: a guard placed on one `os.homedir` reach while the identical reach
one call downstream stayed open, with a comment claiming the closure was end to end. The security lens
alone found two more, an unguarded `process.cwd()` one line below the call that had just been guarded, and
a false sentence in the security model's own prose that the orchestrator had written an hour earlier,
describing a network-share root as refused where the code admits it. The adversarial lens alone found that
the corrected predicate re-derived the share class as a second literal in a file that already imports the
single-sourced predicate, against a rule `kit-network-lib.js` states in terms.

That last one produced the round's best instrument. The fix is behaviorally identical, so a plain red-first
reading could not exist: a change that alters no behavior cannot make its own pin fail. The implementer
planted the exact drift two separate literals permit, watched the new cross-predicate pin go red, reverted,
and verified the restore byte-identical against a pre-probe copy. That is the withheld control done
properly, and it is the shape any behavior-preserving refactor's pin should take here.

Deliberate non-fixes, recorded as decisions rather than left as findings. Four test shims carry no fired
marker, which the second standing amendment mandates; their cases assert broken-state-only outcomes that
cannot pass with the shim unengaged, which is the amendment's own stated alternative, so they are an
accepted residual rather than an omission. The posix-rooted `/foo` admission on win32 stays admitted at the
code, because a committed test pins the cross-platform property the dual-flavor absoluteness rule exists to
hold; it is recorded in the security model as a named collision class instead. A remedy sentence's rationale
is narrower than the branch it serves, which is over-specificity rather than falsehood.

Routed out of the plan. memq's `memoryRoot` reaches `os.homedir()` unguarded, so an unresolvable home
directory still silences the whole SessionStart hook one call past the guard this section added. It routes
rather than folding because the fix reaches every verb's contract, and it carries the more useful half of
its own finding: the suite cannot see it by construction, since every test child pins the store override
that short-circuits the call. The entry is written and verified at `docs/backlog.md:375` against a control
that speaks. It is not in this commit, for the reason the shared-files paragraph below gives.

Assumptions: none. The section's gaps were answered from the code rather than defaulted.

Review Findings: across seven rounds, no Critical survived adjudication in any round. Round 7's surviving
set was three Majors and eight Minors: all three Majors fixed in round 8 and verified at the code by the
orchestrator, the Minors either fixed as trivial in-scope corrections or recorded above as decisions. One
finding was adjudicated upward from a lens's Minor to Major in round 6 and one downward in round 7's
adjudication, both named in the boards with their reasons.

Metrics: 7 review rounds; 8 fix rounds; 0 NEEDS_CONTEXT; 1 tier escalation (round 4, opus to fable, held
thereafter); 0 consults.

Stamps: adjudicated 7, stamped 3. `backlog-items-are-read-one-line-at-a-time` steered the routed entry's
shape, `chapter-completed-line-is-machine-read` steered this Chapter's own `Completed:` line, and the
operator record on commit approval including push steered this close. Four were read in the window and did
not steer anything here: the doctor-committer record (no doctor was run), the two memory-store sync records,
and the local endpoint record. Separately and outside the sweep,
`a-control-is-blind-to-its-shared-derivation-path` was surfaced by the recognition nudge mid-round and
stamped: its named remedy, an instrument you did not build, is exactly what the three review lenses were,
and the security lens finding a carrier the implementer's own sweep had reported clean is that record's
claim reproduced live.

Gate. The whole gate ran here rather than only at finishing, because this plan is Commit-and-Push and its
push lands on a trunk consumers install from with no CI gating the merge, which makes the push itself the
install surface. Whole gate: 2932 tests, 2922 passing, 1 failing, 9 skipped, exit 1, every figure read from
the run's own log and its own exit marker. Against Chapter 1's recorded whole-gate baseline of 2858 / 2848 /
1 / 9 at exit 1 that is +74 tests, all passing, with the failure set unchanged and the single failure the
same named permanent red this box produces, memory-session.test.js's pinned-directory path-length case. The
+74 is not all this section's: a peer session has been adding tests to this same checkout throughout, so the
honest reading of the delta is no regressions rather than a count of what section 2 added. The targeted lane
at section close read 1481 / 1478 / 1 / 2 at exit 1 against its own 1479 / 1476 / 1 / 2 baseline, +2, both
the round's own. The contention lane did not run, and the reason is worth stating rather than leaving as a
silence: this repository defines no such lane. The predicate run was the self-declaring text the testing
skill says such tests carry, over `test/`, and its one hit is `doctrine-parity.test.js` quoting the doctrine
verbatim rather than declaring membership; the control spoke against the skill body. That is a swept list of
phrasings and not a swept class, since prose-declared membership has no structural shape, and no lane command
is recorded in this project's memory tier where the skill says a repo records one. The box was claimed under
this session's own id before the gate and released after its Session line was read; the process poll before
claiming found no foreign test runner, which licenses nothing on its own.

The shared checkout, and what this commit deliberately does not carry. Two documents this section owes
corrections to are co-held with the peer session running the judge-partial-input plan, and by a recorded
bilateral agreement that session carries both. `docs/security-model.md` holds three regions of this
section's: the line-21 derivation restated as the ordered contract with both refusals at their own
positions, a new subsection stating the resolver as a cross-project data-separation boundary with its four
residuals, and the session-id paragraph's third reader with an honest harm bound and one residual narrowed.
`docs/backlog.md` holds the routed entry above. Both are written, verified in place, and left uncommitted in
the peer's care with this section's contributions named in that session's commit body. `docs/architecture.md`
was held back through every earlier round because it described behavior that lived only in the working tree;
that behavior lands with this commit, so it rides here.

Next: section 3, recognition meets the moment, the prompt and the dispatch. Commit model in effect:
Commit-and-Push.

### Interim board 10 - 2026-09-01

Not a Chapter: section 3 is still open. Written at the compaction gate's signal, which had held
twelve offers over thirty-one minutes, with the section's second review round adjudicated and its
second fix round dispatched.

Section 3, "Recognition meets the moment", stage: implemented, one fix round landed and independently
gated, a second three-lens round adjudicated, a second fix round in flight, and the documentation
carriers corrected by the orchestrator.

The acceptance risk board 9 named is half discharged. The store now holds its first shared-tier
trigger: `cmd:hooks.json` and `cmd:claude -p` on the operator-tier record
`harness-snapshots-hook-config-at-session-start`, which is the cross-machine class this plan exists to
surface. Authoring it surfaced the other half. The `memq` on this machine's PATH refused the write in
section 1's own words, that recognition reads the project tier alone, because the shim runs the
installed plugin and this machine's install trails the checkout: section 1's widening is committed
here and not installed. The checkout's own memq accepted it. That places the section's last acceptance
leg outside this session's reach, since a live end-to-end pointer fires from the installed hooks rather
than from the tree, and the install moves only when the operator runs the plugin update. Every other
acceptance leg is met and the code work proceeds; the live demonstration is named for the operator
rather than claimed.

Live dispatches. One `implementer-opus` fix round on the section's code, asked for fourteen fixes,
in flight as this is written. Returned since the last boundary: one `implementer-opus` fix round that
landed the first ten, and a three-lens round at opus and `max` effort through the Workflow route,
adversarial, blind and security together under one tree-state bracket that came back clean. Each lens
resolved at `claude-opus-5` across every assistant turn, with no substitution and no synthetic
placeholder.

Files in scope widened twice, both recorded here as the approval drift they are.
`plugins/claude-kit/skills/memory-system/SKILL.md` joined for prose the change falsified, and this
round adds `plugins/claude-kit/hooks/kit-agent-identity-lib.js` with the single-source pin in
`test/kit-sidecar-capture.test.js`, for the reason the rulings below give.

Rulings adopted since the last boundary.

The round returned no Critical, eight Majors and twenty Minors, and the generator of the two largest
was the orchestrator's own brief rather than the implementer. That brief said to put the recipient in
the dedup key and to split the nudge window tool-versus-lifecycle. Each instruction fixed one axis of a
two-axis problem. The recipient closes `SubagentStart` starvation and leaves a prompt matching a `cmd:`
trigger by containment free to spend that trigger before the real command runs, since a prompt fire and
a pre-tool fire both pass an empty recipient and mint the same key. The tool-versus-lifecycle split
closes prompt-robs-tool and reproduces prompt-robs-dispatch one level in, both new boundaries sharing
one lifecycle counter on a marker keyed by a session id a subagent carries from its parent. All three
confirmed at the code by the orchestrator. The second fix round therefore specifies the whole identity,
recipient and boundary class together, and takes `SubagentStart` out of the rolling window rather than
giving it a third counter, because a burst window exists to stop flooding one context and a dispatch
delivers into a fresh context that receives exactly one such event.

No tier escalation is owed and the comparison is recorded rather than assumed. The ladder keys on a
Critical surviving adjudication in two rounds; neither round produced one. The finding class does
repeat across the two rounds, which is the signal that something upstream of the implementer is
generating it, and the paragraph above names what: the brief. A stronger implementer cannot fix a
brief that is itself half a design, so the lever spent here is the brief and not the tier.

The token rule is fixed at the pin as well as at the predicate. Making identifier types match a prompt
on a whole token readmitted the class it was added to close, because `-`, `.` and `/` remained
boundaries and `tool:Read` therefore still fires on "read-only", a phrase this repository's own prose
uses constantly. The pin could not catch it: its negative list was exactly the literals the hook header
enumerated, which are strings the pattern was handed, and under the withheld-control bar that proves
the instrument functions and says nothing about coverage. The replacement pin is built on instances
withheld from those literals and chosen by the class's shape.

A green pin asserting a false invariant is why the shared identity module was folded in rather than
routed. `test/kit-sidecar-capture.test.js` enforces single-sourcing of the agent-key set by matching
literal spellings, and the new readings in the nudge spell neither, so the pin stayed green while what
it asserts stopped being true. Routing that would have left a committed instrument lying.

One finding is answered rather than fixed: the blind lens read the dispatch boundary as resting on
harness claims no test can observe. It is right about the suite and did not know the observation exists,
both events having been watched firing in real sessions on harness v2.1.252 with their payload key sets
and delivery targets measured. Board 9 records it.

Gate baseline. The orchestrator's own targeted lane over the changed files and the whole-tree pins whose
subject they are, `memory-recognition-nudge`, `hook-canary`, `memq`, `kit-goal-lib`, `doctrine-parity`,
`output-style-parity`, `memq-grant`, `memory-frontmatter-guard`, `memq-shim` and `memory-usage-stamp`,
read 1183 tests, 1181 passing, 0 failing, 2 skipped, exit 0 taken from the run itself, after a build that
exited 0 at 93 files and 1241.9 KB. The section's narrower pair had read 152 / 152 / 0 at exit 0 against
the 146 / 146 / 0 recorded in board 9. The whole-gate baseline this section will be measured against
remains Chapter 2's, 2932 / 2922 / 1 / 9 at exit 1. The box was claimed under this session's own id for
the build and the lane and released after its `Session:` line was read; the process poll before claiming
found no live foreign runner, which licenses nothing on its own.

The memory store sync is deliberately not run, and the reason is worth recording rather than leaving as
a silence. The operator record authorizing that sync without asking states its mechanics against a store
root on another machine and carries no machine scope, so its procedure is reported rather than confirmed
for this box, and two records that would settle this box's own arrangement are retired and contradict
each other. The operator-tier trigger authored above is therefore written locally and unsynced, and the
record's machine-scope defect is routed rather than repaired mid-round.

Next action: verify the second fix round's delta at the runs' own markers, then the section's close gate,
Chapter 3, the whole gate that this plan's push to main owes, and the commit.

The question batched for the operator at board 9 still stands and is still not a blocker: whether
decision 2 of the memory-recognition plan was reopened in the 2026-08-30 design dialog, or whether the
spec sentence amended in board 9 was a slip.

Commit model in effect: Commit-and-Push.

### Interim board 11 - 2026-09-01

Not a Chapter: section 3 is still open. Written at the closure-drought trigger, a second review round
adjudicated with no section closing, with the compaction gate holding offers behind it.

Section 3, "Recognition meets the moment", stage: implemented, two fix rounds landed and independently
gated, three review rounds run, the third adjudicated, and one consult in flight on the single design
fork the third round opened.

The second fix round returned fourteen fixes with red-first failure text quoted per fix, and its gate was
re-run by the orchestrator rather than accepted: build exit 0 at 93 files, then a targeted lane over the
changed files and the whole-tree pins whose subject they are reading 1380 tests, 1376 passing, 0 failing,
4 skipped, exit 0 taken from the run itself. That reconciles against the previous 1183 / 1181 / 0 / 2
exactly: the three files added to the lane contribute 191 and the round added 6 cases, and the two new
skips are kit-sidecar-capture's own. Both axes of the dedup identity are in place, confirmed at the code:
`dedupKey` folds recipient and boundary class, and `windowFields` returns null for `SubagentStart`, taking
the dispatch boundary out of the rolling window rather than giving it a third counter.

A third review round was owed rather than optional. The fix delta changes the format of state persisted
outside the repository tree, the dedup marker gaining a second bounded key set and the nudge log line a
`boundary` field, which is the shape a suite routes around because every test plants its own marker. The
three triggers were checked at the code rather than by feel: the four consumers of the widened identity
library emit `additionalContext` rather than permission decisions, and the two deny-emitting guards import
that library zero times, so the security-reviewer surface did not fire on that ground; the library was
already a dependency, so no new module fired it; the outward-write trigger is what fired.

Round 3 returned three changes-required verdicts, no Critical anywhere, five Majors and roughly eighteen
Minors, each lens resolved at `claude-opus-5` across every assistant turn with no substitution and no
synthetic placeholder. Every Major was confirmed by the orchestrator at the code before adjudication.

The security lens found the round's most serious defect, and the orchestrator generated half of it. At the
prompt boundary the two fragment types match by bare containment against prose, while the three identifier
types were given a whole-token rule. The only authoring-side specificity screen is memq's four-character
floor and its common-token set, and that set enumerates shell verbs, which is a property of the old subject
rather than of ordinary English. The lens proved it by running memq's own gate, and the orchestrator
reproduced the probe: `cmd:that`, `err:this`, `cmd:with`, `err:from` and `cmd:when` are all admitted while
the control pair `cmd:node` and `cmd:git` is refused, so the instrument works and simply does not cover the
new subject. One operator-tier record carrying such a pattern would fire on essentially every prompt in
every project on the machine, and each false fire spends that record's prompt-class dedup key and a slot of
the prompt window besides. The orchestrator's own half is that three carriers were edited in this changeset
to assert the bars cover prompt matching while the predicate was left unchanged, so a guard now documents
coverage it does not have.

The adversarial lens found two more. The boundary class the second fix round added lets one record's pointer
land twice in the same context in one turn for the three identifier types, since a prompt naming an agent
and the tool call that carries it are the same fact matched twice, and the rationale written into the dedup
key covers only the fragment case; the trade is neither recorded nor pinned in either direction. And
`SubagentStart` delivers store-authored text into every dispatched agent's context with no stand-down, the
kit's own blind reviewers included, which is a contamination channel in the review machinery this plan
itself relies on. The lens confirmed the delivery target at the installed CLI rather than from a document.
It is latent rather than live, no `agent:` trigger on a reviewer type existing in any store.

The blind lens found the remaining two. The token predicate treats every code point above ASCII as a word
character, which the comment justifies for accented and CJK letters but which also swallows curly quotes,
non-breaking space, dashes and ellipsis, so one smart quote from autocorrected prose silently refuses a true
match. And the fix round applied the narrow agent-id reading to the prompt boundary while leaving the two
tool boundaries on the wide reading the same comment argues is dead in any --agent session, so the delta
documents a defect and declines to fix it one line away.

One finding is answered rather than fixed, as its equivalent was in round 1: both the blind and the
adversarial lens noted that nothing in the tree pins the harness contract for the two new events. They are
right about the suite and did not know the observation exists; board 9 records both events watched firing on
harness v2.1.252 with their payload key sets and delivery targets measured.

The consult in flight is on the one fork the orchestrator will not rule alone. Its own brief has now been
the generator of the largest finding in two consecutive rounds, and the fragment-trigger repair has a real
design fork: whole-token matching does not close it, since a common English word is already a whole token,
and a reader-side repair protects records that already exist where an authoring screen gates only new ones.
The consultant is asked to attack the framing rather than ratify it.

Routed out of the plan since the last boundary. The two payload-reading guards each hand-copy a four-spelling
agent-type chain omitting the fifth spelling the shared module carries, at `docs-write-guard.js:46` and
`readonly-agent-guard.js:88`. It is not a live bypass, the bare `type` arm being defensive breadth rather
than a measured spelling and the one payload measured on this harness spelling `agent_type`, so it parks
rather than blocking; it leaves the plan because closing it serves guard hardening rather than this plan's
goal. The entry is written and verified at `docs/backlog.md:379`, and the section's own widened single-source
pin names both files as routed exemptions rather than skipping them silently. Two lenses independently raised
the same pair, and both asked that the exemption be narrowed to the per-key scan rather than dropping the
whole-key-set assertion; that narrowing rides the next fix round.

Gate baseline. The targeted lane above, 1380 / 1376 / 0 / 4 at exit 0, is the baseline the next fix round
reports its delta against. The whole-gate baseline this section will be measured against remains Chapter 2's,
2932 / 2922 / 1 / 9 at exit 1. The box was claimed under this session's own id for the build and the lane and
released after its `Session:` line was read; the poll before claiming found no foreign test runner and one
unrelated long-running process, which licenses nothing on its own.

The round's tree-state bracket came back clean but for one path, `docs/backlog.md`, which is the
orchestrator's own routed entry written mid-round and recognised by its content rather than by its path.

No tier escalation is owed and the comparison is recorded rather than assumed. The ladder keys on a Critical
surviving adjudication in two rounds, and no round of this section has produced one. The finding classes do
not repeat across rounds 2 and 3 either: round 2's Majors were the dedup identity, and round 3's are the
token predicate, the boundary-class trade and the injection surface, which is new ground reached because the
previous round's fixes held. That is the branch where the brief rather than the implementer is the generator,
and the consult is the lever spent instead of the tier.

Next action: adopt the consult's ruling, then one fix round covering all five Majors and the in-scope Minors,
then the section's close gate, Chapter 3, the whole gate this plan's push to main owes, and the commit.

Two items still stand for the operator and neither is a blocker. Section 3's live end-to-end acceptance needs
`claude plugin update`, since the nudge that fires in a live session is the installed one and this machine's
install trails the checkout. And the question batched at board 9 is unanswered: whether decision 2 of the
memory-recognition plan was reopened in the 2026-08-30 design dialog, or whether the spec sentence amended
there was a slip.

Commit model in effect: Commit-and-Push.

### Chapter 3 - Recognition meets the moment: the prompt and the dispatch - 2026-09-02

Completed: 3

What shipped. The recognition nudge now rides four boundaries rather than two. A prompt arriving is
matched against the memory store's declared triggers, and a subagent being dispatched is matched on the
type of agent starting, with the pointer landing in that subagent's own context rather than in the
orchestrator's, which is the one delivery in this hook that crosses into a context inheriting nothing by
any other route. Both registrations are dormant-tolerant and fail open like every kit nudge, and matching
stays trigger-and-lexical with no model in the loop and no network call.

The section took four fix rounds and four review rounds, and the generator of the largest finding was the
design input rather than the implementer in three of them. That is the section's real story and it is worth
stating plainly rather than burying in the round log.

The design fault, and the two attempts it took to close it. Widening the matcher to read prompts moved the
trigger types onto a subject none of them was designed for. A tool call carries an identifier in a field, so
matching it is a statement about the call; a prompt carries prose, so matching anything against it is a guess
about what words mean. The store's only authoring screen is memq's specificity bars, which ask whether a
pattern is a bare command name, the right property for the old subject and silent about English. Round 3's
security lens proved it by running that screen: `cmd:that`, `err:this`, `cmd:with` and `err:from` are all
patterns the store admits. On a shared tier, which syncs to every machine and every person sharing the kit,
one such record is a pointer injected into the opening prompt of every session in every project, aimed by an
author who can see none of them.

A consult was convened rather than ruled alone, because the orchestrator's own brief had generated the
largest finding in two consecutive rounds and the obvious repair does not work: whole-token matching does
not close the hole, since a common English word is already a whole token. The consultant refused the framing
and was right to. Every option on the table was a predicate over the pattern, which is an attempt to answer
"does this string occur in ordinary English" without a word list, and no such predicate exists: a length
floor admitting `ENOENT` admits "should", and a punctuation rule admits every prose bigram. The variable
nobody had varied was reach. The precedent was one line above the code about to be edited, where `glob:`
triggers are already confined to the project tier because a glob names a place and the same path under a
shared tier names a different file in every project.

The consult's ruling was adopted and was itself half a fix, which round 4 caught. It gated the two fragment
types and left the three identifier types matching prose from every tier, and those are the types memq
screens least: the bare-common-token bar reaches fragments alone, so `tool:edit`, `agent:when` and
`skill:from` pass on the four-character floor and whole-token-match ordinary English. Two lenses found it
independently. Confirmed at the code before adjudication: `matchesToken('edit', 'please edit the file')` is
true, with `matchesToken('read', 'readme and threading')` false as the control that says the matcher is fine
and the reach is the problem. The final rule is simpler than either attempt and is one condition with no
type list at all: at the prompt boundary, the project tier alone, and no tier while a store pin is in effect.
Nothing true was lost, because each shared-tier trigger keeps the channel where its match is a statement
rather than a guess.

The pin half is the project's own standard applied, not a new idea. Keying the gate on the tier's name fails
under a store pin, where one directory serves every repository the instance works in while still resolving as
the project tier. `docs/security-model.md` states the rule already: the decision is keyed on whether a pin is
in effect, never on the tier's name, because the name is precisely what stops being a reliable signal.

The contamination channel, found by the adversarial lens and fixed rather than parked. The dispatch boundary
delivered store-authored text into every dispatched agent, the kit's own blind reviewers among them, which is
a channel into the review machinery this plan relies on. It now stands down entirely for the read-only
judgment seats. The classifier that names those seats moved out of the write guard into the shared identity
library, because a second consumer is what turns a private predicate into a shared one, and it is now pinned
against its own source of truth: a test derives the read-only set from each agent definition's `tools:`
frontmatter, so a reviewer added later cannot silently receive store text and silently gain write access at
the same time. That move had a cost the orchestrator accepted deliberately and recorded here: it put the
shared library on a deny-emitting guard's path for the first time, which is what made a fourth review round
owed rather than optional. Round 4's security lens then found the fault that move introduced, a require with
no export-contract screen, so a library present but skewed made the guard allow every read-only seat's
tree-mutating command with nothing on stderr. The fix keeps the guard's fail-open contract and removes the
silence, and the session-start canary now probes the library's export shape.

Two deviations from the section as specified, both deliberate, both recorded here with their reversal cost,
and the spec text above amended to state what shipped.

The first is the one that matters. The section specified the prompt boundary matching "the recognition
surface (all tiers, per section 1)", and its acceptance named a live prompt-time pointer from a shared-tier
record as the full read-side path this plan exists for. That is what the security finding closed. The plan's
goal is still delivered, since shared-tier triggers do reach recognition and section 1 is what made them
author at all: they fire at the two tool boundaries and at the dispatch, where the match is a field
comparison rather than a reading of prose. What is given up is the prompt leg for shared-tier records
specifically, which means an operator-tier memory about a machine-wide failure signature no longer surfaces
when the operator describes or pastes that error in a prompt, and still surfaces when the session itself
produces the failing call. Reversal is one condition in `collectHits` and the tests that pin it, so this is
cheap to revisit if the semantic tier later gives the prompt boundary a subject it can match honestly.

The second is the read-only seat stand-down at the dispatch boundary, which the section did not contemplate
because the contamination channel was not seen at authoring. Reversal is one condition and one test.

Gates, read from the runs' own exit codes. The build exits 0 at 93 files and 1253.3 KB. The section's
targeted lane over thirteen test files, the changed files plus the whole-tree pins whose subject they are,
reads 1437 tests, 1433 passing, 0 failing, 4 skipped, exit 0, against 1430 / 1426 / 0 / 4 on the identical
lane definition after fix round 3, so the round is +7 and +7 with nothing failing on either side. The whole
gate this plan's push to main owes reads 2970 tests, 2960 passing, 1 failing, 9 skipped, exit 1, against
Chapter 2's baseline of 2932 / 2922 / 1 / 9 at exit 1: +38 tests, +38 passing, the same single red and the
same nine skips. That red is identified rather than assumed. It is
`test/memory-session.test.js` > "a pinned directory too long to name faithfully stands the session down",
the permanent failure the project memory record `suite-baseline-is-not-zero-fail` describes and explains
mechanically: the test pads a fixture path and relies on the host temp prefix to carry it past a 260-character
guard, and this box's `D:\Temp` lands it at 254, so the guard is never exercised. It is in a file this
section never touched, confirmed by the changed-file list carrying no match for it. The box was claimed under
this session's own id for each build and each lane and released after its `Session:` line was read.

Every fix in both rounds was watched red first, with the failure text quoted per fix, and the two rounds that
needed a tree-mutating probe took one against a pre-probe file copy and verified the restore by byte
comparison against that copy rather than accepting it from a report. The two probe files round 4 planted to
earn a silent check's silence, a read-only agent definition and a second key-set definition, were removed and
their absence confirmed.

Both review rounds ran three lenses at `claude-opus-5` with `max` effort through the Workflow route, and the
resolved model was read from each transcript's own assistant lines rather than assumed: 54 of 54 for the
consult, and every lens of round 4 resolved at `claude-opus-5` with no synthetic placeholder anywhere. No
round of this section produced a Critical, so no tier escalation is owed; the finding class did repeat across
rounds, and what repeated was the brief and the ruling rather than the implementation, which is why the lever
spent was a consult and then a fourth review round rather than a stronger implementer.

Files in scope widened twice more since the last boundary, both recorded as the approval drift they are:
`plugins/claude-kit/hooks/readonly-agent-guard.js` for the classifier move, and
`plugins/claude-kit/hooks/hook-canary.js` for the export-shape probe, each with its own test file.

Next: the whole-effort finishing pass, this being the plan's last section. QA verification first, then the
finishing reviews and docs curation, then the plan's terminal state.

Two items stand for the operator and neither is a blocker. Section 3's live end-to-end acceptance needs
`claude plugin update`, since the nudge that fires in a live session is the installed one and this machine's
install trails the checkout. And the question batched at board 9 is still unanswered: whether decision 2 of
the memory-recognition plan was reopened in the 2026-08-30 design dialog, or whether the spec sentence
amended there was a slip.

Commit model in effect: Commit-and-Push.

### Interim board 12 - 2026-09-02

All three sections are closed and the whole-effort finishing pass is under way. This entry is the
boundary the compaction gate is holding for, taken between finishing steps rather than at a section
close, since no section closes during finishing.

Stage. Section 3 shipped and pushed at 653faed. The finishing pass has run its opening move and its
first step, and steps 2 and 3 are in flight.

The base ref, established before step 1 as the pass requires. This effort's changeset is defined
against 2ec35f70d8fc42b8ee22200ffbf75da873e016c8, derived by the commit model's own rule: the earliest
commit whose diff against this plan doc added a Chapter line is 72ddd3e, and the base is its parent,
resolved to a sha rather than left as a caret expression. The check that follows the derivation found
the expected surfacing rather than a wrong base. A second session committed into this same working tree
inside the window, so the raw listing runs to 52 files while this plan's own work is 31 of them,
attributed by walking the window's commits and taking the file lists of the MEMORY-READ-SIDE ones. The
other session's sidecar tree, its kaizen note and its four sidecar test files are named out of scope in
every dispatch this pass makes, because a reviewer handed the raw listing would spend its budget judging
work this plan never did.

Step 1, QA verification, returned PASS. The build exits 0 at 93 files and 1253.3 KB. The whole gate reads
2970 tests, 2960 passing, 1 failing, 9 skipped at exit 1, a delta of exactly zero against the baseline
Chapter 3 recorded, with the single failure identified by name and by mechanism as the permanent
box-local red in a file this effort never touched. The repository defines no contention lane, and the
dispatch was told so in terms rather than left to answer NONE DEFINED, since that answer reads the same
whether a lane is absent or merely unfound; the basis is that the only test-tree matches for the phrase
are prose assertions in the doctrine-parity suite, no test declares itself a lane member, and the repo
has no package.json and no lane script. One acceptance leg is classified UNVERIFIABLE and operator-only:
a live session cannot demonstrate the new prompt-time pointer while this machine's plugin install trails
the checkout, and only the operator can run the update that closes that gap.

Live dispatches. The security review and the final adversarial review are both in flight over the whole
changeset, dispatched through the Agent tool at the fable override with the reviewers' own frontmatter
effort, which is the finishing pass's default for a session running below fable. Both carry the
per-section coverage in their briefs, so they spend their budget on cross-section cohesion and on what
only becomes visible now that all three sections have landed, rather than re-reviewing code the
per-section rounds already cleared. Their first-turn readings were taken at the five-minute window, which
a dispatch carrying a model override earns whatever its re-block shape: both controls speak, both hold
zero synthetic placeholder lines, and every assistant turn in both resolved at claude-fable-5, so neither
round is running below the tier it was assigned. That reading is diagnostic rather than the recorded
figure, both runs being still in flight when it was taken.

The box. The pass opened by finding the heavy-process claim held by another session on this machine, with
its whole gate live, and waited it out rather than contending; a second gate of that session's started
while the wait ran and was waited out too. The claim was taken under this session's own id only once the
peer released it, held for the QA build and gate, and released after its Session line was read. The
review round that follows runs read-only and holds no claim.

Next action. Adjudicate both reviews against the tree bracket, fix what they find, then step 4's docs
curation with its pre-change reads, then step 5: the plan's terminal state, the archive, the backlog
prune, the index refresh, and the handoff whole gate that fills the final Chapter's open Gate line.

Commit model in effect: Commit-and-Push.
