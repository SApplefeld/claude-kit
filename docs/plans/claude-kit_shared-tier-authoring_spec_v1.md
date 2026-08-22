# Shared-tier authoring: a correction path, and a body input that survives shells

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-21

## Goal

Two kaizen notes from 2026-08-21, both about the memq shared-tier authoring
path, both captured while banking an effort's learnings on SCOTT-CLAUDE:

1. **A shared-tier memory is final at creation.** `memq add-operator` and
   `add-type` can write a record and `--update` can replace its index
   description, but nothing repairs a body and nothing deletes. The only
   removal is `decay-prune --archive-operator`, which retires rather than
   removes, so a record created by mistake survives forever in the archive
   with its mistake intact, and the memory-system skill bars the hand edit
   that would fix it. The asymmetry pushes a session toward composing
   shared-tier text under pressure not to get it wrong, exactly when it is
   least able to check.

2. **A multi-line `--body` fails argument passing through the Git Bash
   wrapper, and fails deceptively.** The CLI reports parsing zero positional
   arguments and prints the usage banner naming arguments the caller supplied
   correctly, so the error accuses the caller of the one thing they did
   right. The skill documents two adjacent argument hazards (embedded double
   quotes; Windows PowerShell 5.1 native-process quoting) and the CLI prints
   a hint for the double-quote signature; the newline case has neither. The
   session's workaround was invoking `memq-shim.js` with a programmatic argv
   from node, which no session should have to discover mid-close-out.

One spec because the two share a surface: `plugins/claude-kit/scripts/memq.js`
(5,767 lines, 304 tests in `test/memq.test.js`), the memory-system skill, and
the shared tiers' sync semantics.

## Design

### A body input that sidesteps the shell entirely

The robust fix for note 2 is not a third documented trap plus a fourth hint:
it is an input channel no shell layer can mangle. Add `--body-file <path>` to
every body-accepting write (`add-type`, `add-operator`), reading the body as
UTF-8 from the named file. `--body` and `--body-file` together on one call is
a refusal, not a merge. Whatever `--body` is held to, `--body-file` is held to
identically, so the two channels cannot drift in what they accept. As built,
that is the cap gate and a blank refusal and nothing else: `--body` takes no
charset reduction (the drafting note that said otherwise was wrong about the
code), and a body is written raw by design, because it is a document whose
newlines and punctuation are content and the fence `get` puts around it is the
control. The file channel adds only the normalizations argv could never need
(encoding refusals, byte order marks, line endings), which bring a file back to
what argv can express rather than judging it differently.

A hint for the trap that remains. As built, the root cause is `cmd.exe`
truncating a command line at its first newline, reached only through the
`memq.cmd` wrapper; the sh and `memq.ps1` wrappers both pass a multi-line
argument byte-exact. The newline therefore never reaches argv, so the hint
cannot key on it: it keys on the residue truncation leaves, a trailing
free-text flag value with the positional count short, and it is worded as a
hypothesis rather than a verdict because that same shape is what a forgotten
argument leaves. The hint names `--body-file` as the remedy, except under the
engine store signals, where that flag is refused and the remedy is `--body`.

### A correction path under the same gates the writes take

Two verbs, mirroring the grammar the shared tiers already use:

- **Body repair:** extend the existing `--update` surface (or a sibling flag,
  whichever reads most like the current verb set) so a shared-tier record's
  body can be replaced under the same lock and the same `--confirm-shared`
  style gating the tier's writes already take. Repair replaces the body
  whole; there is no patch grammar.
- **Delete:** a true removal for both shared tiers, gated at least as heavily
  as retirement (`--confirm-shared` or a stronger named consent), removing
  the record file and its index line in one locked operation. Deletion is for
  the mistaken record; `decay-prune` archival remains the path for the record
  that was once right. The skill states that distinction so the two paths do
  not blur.

Sync semantics need no new machinery: the shared tiers travel as files in the
git-synced store, so a repair is a content change and a delete is a file
removal plus its index line, propagating exactly as an add does. The section
must confirm the index stays consistent in the same locked write, and that a
delete of a record another machine has since modified behaves sanely (git's
ordinary merge semantics are acceptable; inventing a conflict protocol is not
in scope).

### The skill states the surface

The memory-system skill gains: the `--body-file` channel and when to prefer
it (any body composed with newlines, any body not hand-typed), the repair and
delete verbs with their gates, and one plain statement of the composition
bar: what a shared-tier write no longer is, is one-way.

## Assumptions

- The two notes' text in `kaizen/notes-SCOTT-CLAUDE.md` (cleared by the pass
  that wrote this spec; recoverable from git history at commit `8857aae`) is
  the full evidence base; the failing invocations themselves were not
  preserved. The root-cause step in Section 1 re-derives the newline failure
  rather than trusting a remembered mechanism (declared 2026-08-21).
- Line references were read at base commit `8857aae`.

## Sections of Work

### 1. `--body-file` and the newline hint

Model: opus

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`,
`docs/security-model.md`,
`plugins/claude-kit/skills/memory-system/SKILL.md` (the no-secrets rule in
its file-channel form only; the rest of the skill's surface is section 3).

Root-cause the multi-line `--body` failure across the three invocation paths
(Git Bash sh wrapper, `memq.cmd`, `memq.ps1`) before writing the hint, so the
hint's trigger matches the real signature. Implement `--body-file` for
`add-type` and `add-operator`, sharing the `--body` validation path. Update
the usage banner (memq.js:13-14, 1753-1755 at base).

Tests, red first: a multi-line body lands byte-identical via `--body-file`
through a real wrapper invocation (the wrapper spawn pattern in
`test/memq-shim.test.js` is the sibling); `--body` plus `--body-file` refuses;
an over-cap file refuses with the same message as over-cap `--body`; the hint
fires on the rooted signature and stays silent on an ordinary usage error.

### 2. Repair and delete for the shared tiers

Model: opus

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`,
`docs/security-model.md` (the shared tiers stop being write-once, which
makes three of that document's stated invariants false),
`docs/architecture.md` (its lock-free-appenders paragraph calls `--update` a
description repair and says every locked rewrite leaves a backup; the widened
repair and the delete verbs make both halves false),
`plugins/claude-kit/skills/memory-system/SKILL.md` (four sentences state the
shared tiers cannot be repaired or removed, which a security review rated
Major once the code shipped the verbs; doctrine bars parking a security Major
into a later section, so the skill's destructive-verb surface lands here and
section 3 keeps the section-1 drift and the close-out),
`plugins/claude-kit/hooks/memq-grant.js` and `test/memq-grant.test.js`
(round 4's security review rated
Major that the CLI-side refusal of the destructive verbs keys on the child's
environment, which the granted principal controls; the hook is the only
enforcement point that sees an argv the child cannot forge, and a security
Major is never parked into a later section).

Implement body repair and gated delete per the Design section, under the
existing lock, index kept consistent in the same operation. Follow the
existing verb grammar and consent flags; do not invent a new consent style.

Delete reaches the archive as well as the live record, which the Design
section left implicit and round 2 of review made explicit. A name's live
record and an archived record of the same name coexist legally, because the
create path's duplicate check reads the live file only, so a delete that
stopped at the live copy would leave `get` serving the archived shadow and
falsify this section's own "a subsequent `get` reports absent". Under
`--confirm-shared` a delete therefore removes the name from the tier
entirely, archive copy and archive index line included, and an archive-only
name is deletable rather than refused. `decay-prune` still owns archival;
what changes is that the archive stops being a place a mistake cannot be
reached, which is the case the Goal names.

Tests, red first: repair replaces a body and the index survives; delete
removes record and index line and a subsequent `get` reports absent; both
refuse without their consent gate; neither touches the other tier's records;
a delete of a nonexistent record is a named refusal, not a crash; a
live-plus-archived pair leaves neither; an archive-only name deletes under
consent and is a named refusal without it, naming `--confirm-shared` rather
than `decay-prune`.

### 3. The skill and the pass close-out

Model: sonnet
Locus: inline

Files in scope:
`plugins/claude-kit/skills/memory-system/SKILL.md`, `docs/`.

Sections 1 and 2 between them left this section less than it was written
for, and the reason is worth stating rather than quietly shrinking the
brief. Section 1's drift items were the `add-type` and `add-operator` rows
naming neither `--body-file` nor the stored-body count and stating the 65536
cap as a bound on `--body` rather than on the whole record. Those live in the
same two table rows that section 2 had to rewrite for its security Major, and
splitting one table row across two sections would have shipped a row that was
half true, so section 2 rewrote them whole.

The skill's destructive-verb surface is no longer this section's. Four
sentences stating that the shared tiers cannot be repaired or removed became
false the moment section 2's code landed, a security review rated that Major,
and doctrine bars parking a security Major into a later section, so section 2
carries all of it: the `delete-type` and `delete-operator` rows, the widened
`--update` with its `--confirm-shared` gate and its continued refusal of
`--tag` and `--machine`, the delete-versus-archive distinction, the refusal of
all three destructive verbs under the engine store signals, and the
composition bar the Design section asks for, which is now literally true of
the code. What is left here is the section-1 drift above, plus reading the
whole skill once against the shipped CLI so the two passes did not leave a
seam.

What is genuinely left is a whole-file pass, and it is the part neither
earlier section could do: two sections wrote into one skill under pressure to
close a security finding, each seeing its own passages rather than the
document. Read `memory-system/SKILL.md` end to end against the shipped CLI
and fix what the two passes left: a claim in one section contradicted by a
table row in another, a verb documented twice in different words, a pointer
to a heading that moved. Follow the writing-skills discipline, and
baseline-test any behavior-shaping wording against the collision gotcha in
project memory: brief the reviewer to read the whole file, never the diff,
because a diff review is exactly the lens that cannot see a seam between two
passes. Then curate docs per curating-docs at close-out.

## Out of Scope

- Any change to the project tier's Write-tool authoring path.
- A patch/diff grammar for bodies; repair is whole-body replacement.
- Cross-machine conflict protocols beyond git's ordinary merge behavior.
- The `--update` description channel's own shell hazards, beyond what
  `--body-file` incidentally covers.

## Standing Brief Amendments

Added mid-run, and so approval drift by construction; recorded as such in the
Chapter of the section whose review earned each entry. Every later dispatch
brief carries these verbatim.

- **Compose a message about what an operation did from state that operation
  recorded as it went, never from a filesystem probe taken afterward.** A
  `fs.existsSync` or a `stat` in a catch block cannot tell an artifact this
  run produced from one that was already there, and cannot tell a step that
  finished from a step that never ran, so a message built on one asserts a
  history it did not observe. Set a flag or accumulate a counter at each step
  as it lands, and let the message read those. This entry replaces an earlier
  one that asked for the same accuracy as a check rather than as a mechanism:
  rounds 2 and 3 produced eleven findings of the class, and round 4 produced
  two more inside the very code written to satisfy the check, which is what
  says the guard was the wrong shape. The mechanical form is also the
  reviewable one, since a stat inside a failure path is greppable and
  "did you check every path" is not.

- **Decide a per-file safety behavior at the call site that knows the file,
  never by a default the next caller inherits silently.** `rewriteWithBackup`'s
  tail copy was reasoned about as a property of the file being rewritten, but
  the same two index files are rewritten by writers in different tiers with
  opposite requirements, so the property belongs to the call. Where a helper
  takes an option whose wrong value is a silent corruption rather than an
  error, the option is required, so a new call site cannot acquire the unsafe
  behavior by omission.

- **Before changing a shared predicate or a shared guard, enumerate everything
  that relies on it and say what each one now sees.** Three rulings in section
  2 were faithful to their brief and wrong in the same way: the tail-copy
  revert did not check the other tiers reaching the same helper, the switch of
  the record-existence predicate to `lstat` did not check that every reader
  still used `stat`, and the grant hook's argv screen did not check what its
  own tokenizer could be made to miss. Each shipped a defect the next review
  round found. The check is not "is this change correct" but "who else shares
  this, and is it still correct for them", and it belongs to whoever writes the
  ruling as much as to whoever implements it. A change to a predicate, a
  regular expression standing as a gate, or a helper's default is the shape
  that earns it.

- **Verify a claim on the axis the code depends on, never on the axis the
  argument was made on.** The grant hook's tilde omission was argued on word
  count (tilde expansion produces exactly one word, so it cannot carry an
  argument past the screen) and both the implementer and the orchestrator
  verified exactly that, correctly. The screen it protects is a content test,
  and tilde expansion substitutes caller-controlled content into the word it
  produces, so the true claim and the safe claim were different claims. When
  accepting or writing a justification for a guard, restate what the guard
  actually tests, then verify against that restatement rather than against the
  sentence offered. This entry is distinct from the one above it: that one asks
  who else shares the thing being changed, this one asks whether the evidence
  offered for a change bears on the property that makes it safe.

## Chapters

### Interim board 1 - 2026-08-21

**In-flight sections.** Section 1 only; sections 2 and 3 are unstarted and
run in order after it. Section 1 is in its third implementation round, after
two review rounds. Sections 2 and 3 both touch files section 1 holds
(`memq.js` for section 2, the skill for section 3), so nothing runs
concurrently with it.

**Live dispatches.** One: `implementer-opus`, resumed twice on the same
agent so it keeps its context. Round 1 built `--body-file` plus the
truncation hint. Round 2 was asked for one Critical and seven Major fixes.
Round 3, dispatched now, was asked for three Majors (a path-text guard before
the open, a fatal UTF-8 decode, and writer/reader cap consistency) and nine
Minors, with two Major findings explicitly rejected and the reasons given.

**Gate baseline.** Pre-effort baseline is 1084 pass / 0 fail, exit 0,
captured on this machine and diffed at every round since. Round 1 reached
1090/0, round 2 reached 1096/0, both confirmed by the orchestrator running
`node --test test/*.test.js` itself rather than from the implementer's
report. Wall clock runs 200 to 340 seconds depending on contention from a
foreign .NET suite on the same box.

**Rulings adopted since the plan was approved.**

- The root cause of the multi-line `--body` failure is `cmd.exe` truncating
  a command line at its first newline, reached only through the `memq.cmd`
  wrapper. The sh wrapper and the `memq.ps1` wrapper both pass a multi-line
  argument byte-exact, measured on Windows PowerShell 5.1.26100.9168 and on
  pwsh 7.6.5. The newline therefore never survives into argv, so the hint
  keys on the residue truncation leaves (a trailing free-text flag value
  with the positional count short) and is worded as a hypothesis rather than
  a verdict, because that shape also matches an ordinary forgotten argument.
- The dangerous half of the cause is undetectable: with the body flag last,
  truncation yields a correct positional count and a silently shortened
  body at exit 0. The write side answers it by reporting the stored body
  length on the success line.
- `--body-file` is refused whenever `storeSignalsPresent()` is true. Under
  those signals `memq-grant` emits a prompt-free allow for any memq argv,
  and a caller-named path read would make the store-not-machine bound in
  `docs/security-model.md` false. A granted worker invokes the script
  directly and crosses no wrapper, so it meets no truncation and loses
  nothing to the refusal.
- Body content stays charset-ungated on both channels. `printMemoryBody`
  states the design: the fence `get` puts around another writer's body is
  the control, not the charset. Gating control bytes on the file channel
  alone would be the channel drift this section exists to prevent.
- The fleet refusal stays in the CLI rather than moving into
  `memq-grant.js`. The hook governs only the Bash-tool grant, so a hook-only
  refusal is strictly weaker than an unconditional one, and the security
  reviewer verified the CLI placement uses the hook's own exported
  predicate and cannot be reached around.

**Next action per section.** Section 1: await round 3, re-verify the gate,
run a targeted re-review of the changed guard, then close with a Chapter and
the Commit-and-Push commit. Section 2: dispatch at `opus` once section 1
releases `memq.js`; its repair verb is also the tool for correcting the
stale operator memory `pwsh-absent-on-scott-claude`, which this run found
contradicted by evidence (pwsh 7.6.5 is installed and runs). Section 3:
inline in the main thread, since it writes under `docs/`.

### Interim board 2 - 2026-08-22

Written on the closure-drought trigger: three review-round adjudications on
section 2 with no section closing.

**In-flight sections.** Section 2 only. It is in its fourth implementation
round after three full review rounds. Section 3 is unstarted and runs after
it; both touch `memory-system/SKILL.md`, so nothing runs concurrently.

**Live dispatches.** One: `implementer-opus`, the same agent resumed
throughout so it keeps its context. Round 1 built repair and delete. Round 2
was asked for the two Criticals plus thirteen minors. Round 3 was asked for
three rulings (delete reaching the archived shadow, the post-commit unwind,
the tail copy) plus thirteen minors. Round 4, dispatched now, was asked for
three rulings (the landed-repair message, reverting two widenings, one false
comment) plus fourteen minors, one of which is record-only.

**Gate baseline.** 1129 pass / 0 fail / 0 skipped, exit 0, confirmed by the
orchestrator running `node --test test/*.test.js` itself rather than from the
implementer's report. The progression across this effort is 1084 (pre-effort)
to 1099 (section 1 shipped) to 1108 to 1118 to 1129, with 0 fail at every
point. Wall clock is roughly 200 seconds.

**Rulings adopted since Chapter 1.**

- Delete reaches the archived shadow. A name's live record and an archived
  record of the same name coexist legally, because the create path's
  duplicate check reads the live file only, so a delete stopping at the live
  copy would leave `get` serving the archived one and falsify this section's
  own acceptance criterion. Under `--confirm-shared` a delete now removes the
  name from the tier entirely, and an archive-only name is a target rather
  than a refusal.
- The tail copy in `rewriteWithBackup` belongs to files with lawful lock-free
  appenders and to nothing a sync pull replaces whole, so it is off for the
  three shared-tier index writes and stays on for the journal and the usage
  sidecars. Round 3 bounded this further: it stays on for `archiveStep` and
  `carryArchiveIndex`, which also run for the project tier, whose `MEMORY.md`
  does have a lawful lock-free writer in the Write tool.
- The skill's destructive-verb surface moved into this section rather than
  section 3, because a security review rated the four false sentences Major
  and doctrine bars parking a security Major into a later section. Section
  1's own drift items rode along, since they live in the same two table rows.
- The pre-consent no-live-record check runs only without `--confirm-shared`,
  so the locked check stays the only one under consent and its sweep stays
  reachable. Accepted cost: a confirmed typo pays the projects-root scan.
- An empty description is refused on the create path when a body flag is
  present, which is a contract change this section was not asked for, taken
  deliberately so the two channels cannot drift.

**Standing Brief Amendment earned here.** Message-and-comment accuracy
against every path that can reach them. Round 2 produced five findings of
that class and round 3 produced six more, several created by round 2's own
fixes. The amendment is recorded in its own section above.

**Next action per section.** Section 2: await round 4, re-run the gate,
decide whether a fourth review round is warranted, correct the known-false
operator memory `pwsh-absent-on-scott-claude` as the section's dogfood test
(deferred until the delete verb has been reviewed, since dogfooding runs it
against the real remote-synced store), then close with Chapter 2 and the
Commit-and-Push commit. Section 3: a whole-file consistency read of
`memory-system/SKILL.md`, inline in the main thread, then curating-docs.

**Not yet reviewed.** `docs/architecture.md` and
`plugins/claude-kit/skills/memory-system/SKILL.md` were written by the
orchestrator concurrently with round 3 and were not in that round's
changed-file list, so no reviewer has read them. Section 3's whole-file pass
covers the skill; the finishing docs pass covers architecture.md.

### Interim board 3 - 2026-08-22

Written on the closure-drought trigger: review rounds 5 and 6 on section 2 both
adjudicated with no section closing.

**In-flight sections.** Section 2 only, in its ninth implementation round after
six full review rounds. Section 3 is unstarted and runs after it; both touch
`memory-system/SKILL.md`, so nothing runs concurrently.

**Live dispatches.** One: `implementer-opus`, the same agent resumed
throughout so it keeps its context. Round 7 was asked for one Critical, four
Majors and eleven minors. Round 8 was one ruling, R27. Round 9, dispatched now,
was asked for four Majors and nine minors, one finding recorded rather than
fixed.

**Gate baseline.** 1162 pass / 0 fail / 0 skipped, exit 0, confirmed by the
orchestrator running `node --test test/*.test.js` itself rather than from the
implementer's report. The progression across this effort, every figure the
orchestrator's own run: 1084 (pre-effort), 1099 (section 1 shipped), 1108,
1118, 1129, 1136, 1144, 1153, 1162, with 0 fail and 0 skipped at every point.
Wall clock runs 230 to 400 seconds depending on contention.

**Rulings adopted since Interim board 2.**

- The grant hook's argv screen is a content test, so what protects it is the
  guarantee that the words the hook reads are the words the child receives. A
  caller-controlled shell expansion breaks that guarantee rather than bypassing
  the screen, which is why an unquoted brace, glob, or leading tilde refuses
  the grant outright instead of being screened. The refusal lives in the
  splitter rather than in the screen, because the splitter already knows which
  characters arrived from inside a quoted span.
- Where an expansion is refused is part of its rule. Bash performs none of
  these expansions inside quotes, so the ban is scoped to unquoted spans;
  quoted braces, globs and brackets are ordinary free text, which is what a
  summary naming a test glob or a description carrying a bracketed note is made
  of. The tilde takes that span rule with a position rule on top, since only a
  leading tilde expands, and the mid-word case is not a concession but the case
  that matters most here: a Windows 8.3 short path carries its tilde mid-word
  and is an ordinary spelling of the script path this hook exists to grant.
- The delete's steps are ordered copies, both index lines, stamps, record
  files, so that every state a stop can leave is one a re-run of the same
  command completes. Round 9 corrects the one place that promise was not kept:
  the copy sweep's listing now leads its own named unlink, so the first step is
  genuinely all-or-nothing.
- `rewriteWithBackup`'s tail copy tests the wrong thing, and the fix is the
  test rather than the per-call value. It fires on the replacement being longer
  and infers an append, but a sync rebase replaces a store file wholesale and a
  replaced file can also be longer, so the splice grafts a byte-offset fragment
  of a different document. A head-identity check makes the copy honest for
  every tier at once; switching one call site would have treated the instance
  and left the class, since the whole store syncs.
- A security finding inside the grant hook is fixed in this section whatever
  its provenance. The caller-named embedder root reaching `require` through a
  granted `find` predates the section, but it sits inside the guard this
  section reopened, and doctrine bars parking a security Major.

**Standing Brief Amendment earned here.** Verify a claim on the axis the code
depends on, never on the axis the argument was made on. Recorded in its own
section above. It was earned by the orchestrator's own ratification of the
tilde omission, which was verified on word count while the screen it protects
is a content test, and it has since caught two further findings including one
inside the round-7 work.

**Next action per section.** Section 2: await round 9, re-run the gate, rewrite
the tail-copy passages in `docs/architecture.md` and `docs/security-model.md`
that R30 makes false, decide whether a seventh review round is warranted,
correct the known-false operator memory `pwsh-absent-on-scott-claude` as the
section's dogfood test, then close with Chapter 2 and the Commit-and-Push
commit. Section 3: a whole-file consistency read of `memory-system/SKILL.md`,
inline in the main thread, then curating-docs.

**Not yet reviewed.** `docs/architecture.md` remains unread by any reviewer;
the finishing docs pass covers it. `docs/security-model.md` was read this
round by the security reviewer, which rated two of its sentences Major and both
are now rewritten.

### Chapter 1 - 2026-08-21
Completed: 1. `--body-file` and the newline hint
Implemented By: implementer-opus, one agent resumed across four rounds so it
kept its context; no escalation
Metrics: 2 full review rounds (three lenses each: adversarial, blind,
security, all at opus/`max` via the Workflow route) plus 2 orchestrator-driven
fix rounds; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: The root cause is `cmd.exe` truncating a command line
at its first newline, reached only through the `memq.cmd` wrapper. The sh and
`memq.ps1` wrappers both pass a multi-line argument byte-exact, measured on
Windows PowerShell 5.1.26100.9168 and pwsh 7.6.5. The newline never survives
into argv, so the hint keys on the residue truncation leaves (a trailing
free-text flag value with the positional count short) and is worded as a
hypothesis, since that shape also matches a forgotten argument. The dangerous
half is undetectable: with the body flag last, truncation yields a correct
count and a silently shortened body at exit 0, which is why the success line
now reports the stored body's length and why the file channel, not a fourth
hint, is the fix. Three reviewer findings were rejected with reasons recorded
in Interim board 1 and in the round briefs: gating C0 control bytes (the
design at memq.js:2775-2777 is explicit that the fence, not the charset, is
the control), relayering the fleet refusal into `memq-grant.js` (hook-side
alone is strictly weaker), and relabelling the success line's body count
(`stored` is literally the record's body whatever channel supplied it). One
reviewer finding was rejected on evidence by the implementer rather than by
me: Windows reserved device names (`C:\tmp\COM1`) do not reach a device
through Node, which opens via the extended-length form and so disables
Win32 device-name mapping; it answers ENOENT like any missing file, so no
reserved-name rule was added and none is needed.
Deviations from the spec: three, all deliberate and none changing design
intent. (1) The spec's Design section said `--body` already gets "charset
reduction"; reading the code showed `--body` gets only the cap check and is
written raw, so `--body-file` was held to exactly that rather than to the
richer validation the spec imagined, since adding charset reduction on one
channel alone would be the drift the section exists to prevent. (2) The cap
gate now measures the whole record rather than the body alone, because
`printMemoryBody` (memq.js:2818, 2829) reads and caps the whole file, so the
old writer/reader split could lawfully write a record `get` could never print
whole. (3) Files in scope widened twice: `docs/security-model.md`, because
the flag made that document's store-not-machine bound false until the fleet
refusal and the corrected wording landed; and
`plugins/claude-kit/skills/memory-system/SKILL.md`, in its no-secrets rule
only, because a security review rated the gap Major and doctrine forbids
parking a security Major into a later section. The rest of the skill's
surface stays section 3's, and section 3's brief in this doc now carries the
two drift items it must fix.
Assumptions: The two kaizen notes' text is the full evidence base and the
failing invocations were not preserved, so the root cause was re-derived by
live probe rather than trusted from the note's "Git Bash wrapper" framing,
which the probe disproved (declared 2026-08-21, section 1).
Review Findings: Round 1: one Critical (the flag made `docs/security-model.md`
false) fixed by refusing `--body-file` under `storeSignalsPresent()`, plus
seven Majors. Round 2: three Majors (a path-text guard before the open, a
fatal UTF-8 decode, writer/reader cap consistency) and nine Minors. Round 3:
no Criticals; four Majors and eight Minors, eleven fixed, three rejected
above and one (F8) rejected on the implementer's own probe. Two guards ship
unpinned and are named rather than implied: the short-read guard's
grow-during-read leg (forcing a size change between two fstats needs a racing
writer that cannot be made deterministic) and the symlink leg of the
UNC/device guard (`fs.symlinkSync` throws EPERM on this box without Developer
Mode, and a junction cannot target a UNC path). Both are covered by the
neuter probe's sensitivity check rather than by a test.
Stamps: adjudicated 3, stamped 2 (`windows-path-shim-wrappers`, whose
three-wrapper matrix and confirmed `.cmd` `%*` breakout is the root cause this
section chased; `charset-gate-must-bar-a-leading-dash`, which is why both new
flags refuse a value starting with `--`). Skipped
`context-as-event-sourced-projection`, no bearing on this work.
Known-false memory, correction scheduled: `pwsh-absent-on-scott-claude` is
contradicted by evidence gathered here. `pwsh` resolves to a real install and
answers 7.6.5, and this section's suite now runs it. It is not corrected in
this section because the tooling that would correct it whole is section 2's
repair verb (`--update` today replaces the index description only, so
correcting the line while the body still said the opposite would leave a
record contradicting itself). Section 2 fixes it as its own dogfood test.
Gate: baseline 1084 pass / 0 fail, exit 0. Rounds landed 1090/0, 1096/0,
1099/0, and 1099/0 with 0 skipped, each confirmed by the orchestrator running
`node --test test/*.test.js` itself rather than from the implementer's report.
Next: 2. Repair and delete for the shared tiers
Commit Model: Commit-and-Push
