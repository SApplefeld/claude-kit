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

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`.

Implement body repair and gated delete per the Design section, under the
existing lock, index kept consistent in the same operation. Follow the
existing verb grammar and consent flags; do not invent a new consent style.

Tests, red first: repair replaces a body and the index survives; delete
removes record and index line and a subsequent `get` reports absent; both
refuse without their consent gate; neither touches the other tier's records;
a delete of a nonexistent record is a named refusal, not a crash.

### 3. The skill and the pass close-out

Model: sonnet
Locus: inline

Files in scope:
`plugins/claude-kit/skills/memory-system/SKILL.md`, `docs/`.

Two corrections section 1 leaves for this one, both drift against the
shipped CLI rather than new design: the `add-type` and `add-operator` rows
in the memq reference table name neither `--body-file` nor the success
line's stored-body count, and they state the 65536 cap as a bound on
`--body` when the gate now measures the whole record, heading and
frontmatter included, so a body at exactly the cap is refused. Section 1
added the no-secrets rule in its file-channel form; the rest of the
`--body-file` surface is this section's.

Write the skill additions per the Design section, following the
writing-skills discipline (baseline-test any behavior-shaping wording against
the collision gotcha in project memory: brief reviewers to read the whole
file, not the diff). Curate docs per curating-docs at close-out.

## Out of Scope

- Any change to the project tier's Write-tool authoring path.
- A patch/diff grammar for bodies; repair is whole-body replacement.
- Cross-machine conflict protocols beyond git's ordinary merge behavior.
- The `--update` description channel's own shell hazards, beyond what
  `--body-file` incidentally covers.

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
