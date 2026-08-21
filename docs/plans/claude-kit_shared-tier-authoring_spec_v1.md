# Shared-tier authoring: a correction path, and a body input that survives shells

Status: Draft
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
a refusal, not a merge. The existing `--body` validation (charset reduction,
the over-cap refusal near `BODY_CAP` at memq.js:234) applies to the file's
content identically, so the two channels cannot drift in what they accept.

A hint for the trap that remains: root-cause the newline failure first
(plausibly the `.cmd` hop through `cmd.exe`, which truncates an argument at
its first newline - the same behavior docs/architecture.md records for the
`claude` shim - but confirm against the sh wrapper the note actually used).
Then, mirroring the existing double-quote hint, print a cause-naming hint when
a failing parse carries the newline signature the root cause defines. The
hint names `--body-file` as the remedy.

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

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`.

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

Files in scope:
`plugins/claude-kit/skills/memory-system/SKILL.md`, `docs/`.

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
