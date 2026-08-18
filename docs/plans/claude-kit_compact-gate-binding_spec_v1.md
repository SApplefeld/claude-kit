# Compaction gate binding: claim the leash before the first compaction, not at the first stop

Status: Approved
Commit Model: Commit-and-Push
Disjoint: yes
Created: 2026-08-18

## Problem

The completion leash and the compaction gate are wired in series, and each one's
success starves the other.

`/kit-goal` arms a goal unbound. The binding is claimed at the arming session's
first stop, by the Stop hook (`kit-goal-stop.js:548-553`, the only production
caller of `bindSession`, `kit-goal-lib.js:423`). The compaction gate
(`kit-compact-gate.js`) engages only for the session the goal is bound to, and
its clause 4 (`kit-compact-gate.js:337`) allows an armed-but-unbound goal
outright.

But `executing-work`'s completion contract forbids stopping with unblocked work
remaining. So a run that behaves correctly never stops, never binds, and is
never gated. Confirmed first-hand: a three-plan run in this repo finished with
`kit-goal.js status` reporting `unbound` after several hours and multiple
auto-compactions. The boundary gate never fired once.

The clause-4 allow sits above every other branch, the interactive deferral
included, so the failure is worse than a lost feature. An armed-but-unbound run
compacts at the machine's native early trigger while an ordinary hands-on
session on the same box is deferred to `SAFETY_CEILING_TOKENS`
(`kit-compact-gate.js:173`). Arming a goal currently makes a run's compaction
placement worse than not arming one.

A second-order effect makes the mechanism inert even if clause 4 were merely
bypassed: `sameSessionId` returns false when either side is missing
(`kit-compact-lib.js:75-78`), so a checkpoint written while unbound records
`boundSession: null` and `checkpointMatches` returns `wrong-session` against a
still-null goal. Both halves stay dead until a first stop happens.

## Approach

Claim the binding at the compaction gate, using the same predicate the Stop hook
already trusts. The PreCompact payload carries `session_id` and
`transcript_path` (operator memory `claude-code-precompact-facts`, probed on
2.1.233), and `userCommandArgsClaimPlan` is a pure function of a transcript and
a plan path. A session that shows the user typing the arming command claims the
leash at the first compaction offer instead of at the first stop.

The predicate's exclusions are the anti-steal set already trusted at Stop
(assistant echoes, `isMeta` harness injections, attachments, tool results,
sidechains, local-command stdout, a dir-qualified path match, and a
`<command-name>` that must be `/kit-goal` or end `:kit-goal`), so the gate adds
no new steal surface.

Ruled by a fable consult, which corrected the framing twice. Both corrections
are recorded here because the reasoning, not just the outcome, is what a later
reader needs.

**Alternatives rejected.**

- *Bind at arming time.* The original rejection ("the arm command receives no
  session id") is false: `CLAUDE_CODE_SESSION_ID` is present in the Bash
  environment, and it matches this session's real id (confirmed by comparing it
  against the session's own transcript basename). Rejected on better grounds:
  whether that variable equals the hook payload's `session_id` field is
  unverified, nothing in the repo reads it, and a wrong bind there is severe in
  a new dimension. The Stop hook would classify the real run as a bystander
  (`kit-goal-stop.js:543-547`) and allow every stop, breaking the leash itself
  rather than only its compaction timing. A gate claim binds only on transcript
  proof and cannot fail that way. A further caveat found in this repo's own
  environment: `CLAUDE_CODE_CHILD_SESSION=1` is set alongside it, so the
  variable's meaning inside a subagent shell is unpinned. Parked as a backlog
  item, not built here.
- *Make `sameSessionId(null, null)` true, or have `checkpointMatches` accept a
  both-null pair.* Tempting as a one-liner, and worse than it looks. Any session
  in the project would then take the boundary path against an unbound goal, and
  a bystander's offer could consume (`kit-compact-gate.js:362`) a null-session
  checkpoint the real run had just opened, burning the run's boundary. It also
  re-opens the crashed-run orphan hole the session leg exists to close, since a
  re-arm resets the binding to null.
- *Gate without binding (treat unbound-and-claimed as bound for the verdict
  only).* Writes nothing, but the checkpoint could still never match, so the run
  would be denied to the ceiling with no boundary placement at all.

**The bystander branch is ruled, not deferred.** When a goal is armed, unbound,
and the predicate says this session did not type the arming command, the gate
falls through to the interactive path rather than allowing outright. This is a
facts question: the only argument for today's allow is the clause-4 comment,
which this defect proves wrong, and a bystander to a *bound* goal already gets
the interactive deferral (`test/kit-compact-gate.test.js:259`). Two treatments
for the same bystander, keyed on state it cannot observe, is drift.

**Writing goal state from a PreCompact hook is acceptable.** The gate already
writes on the consume path (`clearCheckpoint`, line 362), `bindSession`
validates its input and never throws, and `writeState` is the same tmp+rename
path every arm uses. The one new failure mode is a persistently failing bind (a
read-only `.kit/`): the run is then denied to the ceiling and allowed there. Not
a wedge, because the valve holds; and a `.kit/` that rejects the bind also
rejects checkpoint writes, so boundary placement was already unreachable in that
world, making deferral-to-ceiling strictly better than today's early trigger.

## Sections of Work

### 1. Share the claim predicate

Model: sonnet

Move `userCommandArgsInclude` (`kit-goal-stop.js:122`) and
`userCommandArgsClaimPlan` (`kit-goal-stop.js:176`), with their comment blocks,
into `kit-compact-lib.js`. Export `userCommandArgsClaimPlan` only;
`userCommandArgsInclude` stays module-local, matching how
`stripLocalCommandOutput` and `commandArgsSpans` already sit there. No test
imports either helper by name today, so the export surface is a free choice and
the narrower one is correct.

`kit-goal-stop.js` imports `userCommandArgsClaimPlan` from `kit-compact-lib.js`
instead of defining it, and its existing note at lines 104-108 (which already
explains that the capped read and the strip live in the lib) extends to name the
predicate too.

No cycle is introduced: `kit-compact-lib.js` requires `kit-goal-lib.js` (line
30) and `kit-goal-stop.js` already requires both (lines 95, 99). The predicate's
only dependencies, `readTranscriptCapped`, `stripLocalCommandOutput` and
`commandArgsSpans`, are already in `kit-compact-lib.js`.

Behavior must not change. This section is a pure move.

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`,
`plugins/claude-kit/hooks/kit-goal-stop.js`.

Tests: the whole existing suite must stay green with no expectation edits, which
is the section's own gate (`test/kit-goal-stop.test.js` has 77 tests over this
predicate's behavior, including the all-spans pin at line 186). Add one direct
unit test of the exported `userCommandArgsClaimPlan` in the compact-lib's test
file if one exists for it, covering a claiming transcript and a non-claiming one
(an assistant echo of the plan path), so the predicate has coverage at its new
home and not only through the Stop hook.

Acceptance: `node --test test/*.test.js` reports the recorded baseline exactly
(954 pass / 2 fail, the two being `test/memq-shim.test.js` environment cases at
lines 420 and 523); `kit-goal-stop.js` contains no definition of either helper;
`kit-compact-lib.js` exports `userCommandArgsClaimPlan`.

### 2. Claim the binding at the compaction gate

Model: opus

Replace the clause-4 outright allow (`kit-compact-gate.js:337`). The armed goal
now resolves to three states against the compacting session:

1. **Bound to this session** (line 345 today): unchanged. Checkpoint, valve,
   `deny-boundary`.
2. **Unbound**: keep the existing no-session-id allow (line 344) ahead of it,
   since a bind is impossible without an id and ambiguity allows. Otherwise call
   `userCommandArgsClaimPlan(transcriptPath, goal.plan)`. On true, call
   `bindSession(cwd, sessionId, transcriptPath)` best-effort and take the
   boundary path against `sessionId` whether or not the write landed, matching
   `bindSession`'s own documented posture that enforcement never depends on the
   write (`kit-goal-lib.js:413-415`). On false, fall through to the interactive
   path.
3. **Bound to another session**: unchanged, interactive path.

Rewrite the clause-4 header comment (`kit-compact-gate.js:50-58`). Its stated
justification, that an unbound armed goal is "almost always the arming session
moments before its first stop claims the binding", is the false premise this
defect disproves, and leaving it would leave the next reader the same trap.

Invariants no new branch may violate, each already load-bearing:

- No deny at or above `SAFETY_CEILING_TOKENS`, and none on an illegible valve
  reading. Both new fall-throughs inherit the valve (lines 366-369, 381-382).
- Checkpoint consumption stays exclusive to the bound-boundary allow (line 362).
  The new bystander path is the interactive path, which never touches the
  checkpoint.
- Fail-open on every axis. A predicate throw or an unreadable transcript reads
  false and lands on the interactive path, where an unreadable transcript also
  yields no valve reading, so the verdict is `allow`.
- No new steal surface: the predicate is the same one the Stop hook trusts,
  unmodified.

Files in scope: `plugins/claude-kit/hooks/kit-compact-gate.js`,
`test/kit-compact-gate.test.js`.

Tests (a floor, extend as implementation reveals):

- Flip `test/kit-compact-gate.test.js:245` ("goal armed but unbound: allow") and
  rewrite its comment, which currently records the prior spec's deliberate
  decision to leave this case alone and the now-disproven reason for it.
- Unbound plus a claiming transcript yields `deny-boundary`, **and** the goal
  file on disk afterwards carries this session's id in `boundSession`.
- Unbound plus a claiming transcript plus a checkpoint recording
  `boundSession: null` still denies. This is correct rather than a wart: the
  checkpoint is `wrong-session`, the compaction defers one more chapter, and the
  next checkpoint, written bound, opens the gate.
- Unbound plus a non-claiming transcript yields `deny-interactive` below the
  ceiling, and `allow` at or above it.
- Unbound plus no session id in the payload yields `allow`.
- A bind that cannot be written still yields `deny-boundary` for that offer
  (fail-open on the write, not on the verdict).

Acceptance: every test above passes; the full suite matches baseline with only
the intended expectation flip at line 245; a manual read of the gate confirms no
code path can reach a deny at or above the ceiling.

### 3. Contract text and backlog

Model: opus
Locus: inline

`plugins/claude-kit/skills/kit-goal/SKILL.md:50` documents the binding as
claimed "at its first stop". That sentence becomes first stop or first
auto-compaction offer, whichever comes first, without disturbing the
bystander-isolation rationale around it, which the change preserves exactly.

Add a `docs/backlog.md` item for the arm-time binding supplement: confirm
whether `CLAUDE_CODE_SESSION_ID` equals the hook payload's `session_id` (and
what it holds inside a subagent shell), and if so add arm-time binding as a
supplement that shrinks the unbound window to zero. Never a replacement: the
variable can vanish upstream and the gate claim must remain the fallback.

Files in scope: `plugins/claude-kit/skills/kit-goal/SKILL.md`,
`docs/backlog.md`.

Tests: none warranted. Prose and a backlog line, both covered by the finishing
docs curation.

Acceptance: the SKILL.md sentence names both claim points; the backlog carries
the dated item; no em dash characters in either file.

## Verification

- Full suite at baseline (954 pass / 2 fail, the two known `memq-shim`
  environment cases) after every section.
- The 165 tests across `test/kit-compact-gate.test.js` and
  `test/kit-goal-stop.test.js` are the invariant surface; only the single
  intended flip at `kit-compact-gate.test.js:245` may change expectation.
- Operator-only: none. Observing the gate actually fire on a live leashed run
  would be the end-to-end proof, but it is reachable from a session rather than
  requiring operator access, and the test suite spawns the real hook file.

## Related

- `../archive/claude-kit_interactive-compact-deferral_spec_v1.md` introduced the
  interactive deferral path and deliberately left the unbound case allowing
  outright, recording that decision in the test comment at
  `test/kit-compact-gate.test.js:245`. This plan reverses that call on evidence
  that its stated premise is false.

## Chapters

### Chapter 1 - 2026-08-18
Completed: 1. Share the claim predicate
Implemented By: implementer-sonnet
Metrics: 0 review rounds (see Decisions); NEEDS_CONTEXT 0; escalations 0; consults 1 (at design time, before the spec was written)
Decisions / Surprises:
- The per-section reviewer pair was skipped, under the executing-work clause that makes it optional for a genuinely trivial self-contained section. This is a pure function move with no logic change, and I verified that claim rather than taking it: of the 90 lines removed from the Stop hook, 83 appear byte-identical among the 90 added to the lib, and I read all 7 that differ. They are the import list (which correctly drops `commandArgsSpans`, now unreferenced in the Stop hook, confirmed by grep) and comment lines that said "this Stop hook" or "kit-compact-lib's linear scanner" from the outside and now read correctly from inside the lib. The predicate is a security boundary, so the section still gets the full Fable finishing pass over the whole changeset.
- The implementer regenerated `plugins/claude-kit/.claude-plugin/build-info.json` via `build.ps1`, because `hook-canary.test.js` checks the hook tree against that stamp and any hook edit false-fails it otherwise. The artifact is gitignored and does not appear in `git status`. Worth knowing for any later effort touching a hook file.
- The implementer correctly identified the four files Section 3 was editing concurrently as not its own and left them alone, staging nothing.
Review Findings: none (no reviewers dispatched; see Decisions)
Stamps: adjudicated 1, stamped 1 (`crlf-per-file-in-windows-checkouts`, which steered Section 3's backlog insert into detecting the file's line endings at the insertion point rather than assuming). Two more were stamped ahead of the first section, `claude-code-precompact-facts` and `claude-code-hook-payload-facts`, which together confirmed the design premise that the PreCompact payload carries `session_id` and `transcript_path` and that a session id survives a compaction.
Next: 2. Claim the binding at the compaction gate
Commit Model: Commit-and-Push
