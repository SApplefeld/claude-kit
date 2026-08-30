# Arm-time leash binding and the typed-lead claim

Status: Complete
Commit model: Commit-and-Push
Date: 2026-08-20

## Goal

A `/kit-goal` arming that the harness does not parse as a slash command (a
multi-line invocation with one plan path per line, or a prose arming request)
currently arms the goal but can never bind it: the claim predicate requires the
plan path inside a `<command-args>` span, and the harness writes that markup
only when the command and its arguments share the first line of the message.
The armed-but-unbound state is silent and permanent: the Stop hook never
leashes the session, the compaction gate treats it as a hands-on session and
defers to the 800K safety ceiling instead of chapter boundaries, and every
chapter checkpoint the run writes records `boundSession: null`, which never
matches. Observed live on 2026-08-20 in the ai-os Warden Expand run (12 hours
armed-unbound; transcript
`C:\Users\<account>\.claude\projects\D--ai-os\<session-id>.jsonl`,
line 17 is the prose-shaped arm, line 2052 the single-line re-arm that
recovered it).

Two mechanisms close the gap, and the multi-line one-plan-per-line invocation
becomes a first-class arming shape:

1. **Arm-time binding.** The arm CLI runs inside the arming session's shell,
   which carries `CLAUDE_CODE_SESSION_ID`. When that value is UUID-shaped, the
   arm writes it as `boundSession` in the same atomic write that arms. Every
   in-session arming then binds immediately, whatever the invocation shape.
2. **Typed-lead claim fallback.** The transcript claim predicate accepts a
   second shape: a genuine user-typed entry whose text, after the existing
   stripping and exclusions, leads with the `/kit-goal` command token and
   carries the armed plan path anywhere after it. This keeps multi-line arming
   bindable if the environment variable vanishes upstream.

The existing claim points (first stop, first auto-compaction offer) remain as
fallbacks. This delivers `docs/backlog.md`'s arm-time-binding item (dated
2026-08-18), whose two unpinned facts are now pinned: the variable's value
equals the session id hook payloads carry (triangulated: the ai-os bind wrote
the payload's `session_id` and it equals the transcript basename, and the
variable equals the transcript basename on this machine in two sessions), and
a dispatched subagent's shell carries the parent session's id (probed live
2026-08-20 on SCOTT-CLAUDE, general-purpose agent, identical value).

## Design

**Arm-time binding.** `armGoal(cwd, planArgs, bind)` gains an optional third
parameter `{ sessionId, transcriptPath }`. The bind is two-key: it is written
only when `sessionId` matches a strict UUID shape
(`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) AND
`transcriptPath` passes `validTranscript`; then `boundSession` and
`boundTranscript` are written together, in the existing single atomic write,
so a bound goal always carries its transcript and no second read-modify-write
is added (the bind-CAS backlog item's race is not widened). Either key failing
arms unbound exactly as an arm with no bind. The shape gate alone cannot
authenticate the id (any UUID-shaped stale or planted value passes it, and a
wrong bind is the worst direction: the Stop hook reads the real run as a
bystander, and both fallback claim points gate on an unbound goal, so nothing
ever rebinds); the transcript requirement is the corroboration, because the
CLI supplies the path only from an existence-checked scan of this machine's
transcript store, so an id with no matching local transcript arms unbound and
the ordinary claim points still protect the real run. The accepted residual is
a stale id that names a real local transcript.

`kit-goal.js cmdArm` reads `process.env.CLAUDE_CODE_SESSION_ID` and locates
the transcript by scanning the harness's project directories
(`~/.claude/projects/*/<sessionId>.jsonl`, first existing hit, wrapped so any
filesystem error yields null): no path-munging assumptions, fail-soft to a
null hint. The arm output states the binding, because the silent
armed-unbound state is what cost 12 hours: `kit goal armed for <plan> ...
(bound to this session)` or `(unbound; the leash binds at the arming
session's first stop or auto-compaction offer)`.

`CLAUDE_CODE_SESSION_ID` is an undocumented harness variable that can change
or vanish upstream without notice; the fallback claim points are what make
that survivable, and the code comment states that status as a property of the
fact. Operator memory `claude-code-session-id-in-shell-env` carries the
pinned evidence.

**Typed-lead claim.** In `userCommandArgsInclude` (kit-compact-lib.js), after
the existing markup path fails to match, evaluate the lead shape on the
stripped, UN-normalized text (backslash-to-slash normalization applies only to
the needle comparison, never to the command token, so a literal `\kit-goal`
lead does not claim): `trimStart()` of the whole typed message must match
`^\/(?:[\w-]+:)*kit-goal(?=\s|$)` (case-insensitive; the lookahead is the
token boundary, so `/kit-goal-notes.md` never matches; the repeated namespace
segment matches the markup path's endsWith-':kit-goal' acceptance), and the
needle must appear inside the argument block: the text from just after the
matched token up to the first line that is empty, or whose first
non-whitespace character is a backtick or `<`. The block boundary is the
analogue of the markup shape's `<command-args>` span: a blank line ends a
typed argument list, and a fence or tag line opens quoted or injected
material, which must never supply the needle, so a bystander message that
leads with the command for one plan and mentions another only behind one of
those boundaries cannot steal the other plan's binding (a contiguous prose
line inside the block is the accepted residual, documented in
security-model.md). Every existing exclusion runs
unchanged before this shape is ever evaluated: user-type entries only, no
isMeta / sidechain / compact-summary, any tool block discards the whole
entry, local-command output stripped first. A message that leads with prose
or a code fence never claims; the only claiming shape is a message whose
first non-whitespace characters are the bare command token, which is arming
intent in any reasonable reading.

## Assumptions

- The transcript is located by scanning `~/.claude/projects/*/<sid>.jsonl`
  rather than reproducing the harness's directory-name munging (declared
  2026-08-20; reversal: swap the scan for a munge helper if the scan ever
  proves slow, it reads one directory listing plus one existence check per
  entry).
- Commit model Commit-and-Push on main, matching this repo's recent history
  (declared 2026-08-20 to Scott in-session, no objection).
- The typed-lead match is case-insensitive even though the markup path's
  command-name comparison is case-sensitive: the lead shape matches hand-typed
  text, where case variance is plausible and harmless (declared 2026-08-20).

## Sections of Work

### 1. Arm-time binding

Model: opus

Files in scope: `plugins/claude-kit/hooks/kit-goal-lib.js`,
`plugins/claude-kit/hooks/kit-goal.js`, `test/kit-goal-lib.test.js`.

`armGoal` gains the optional `bind` parameter per the Design section, with the
two-key gate (UUID shape plus `validTranscript`-accepted transcript); the
state shape and every existing caller (`bindSession`, the hooks) are
untouched. The shape check is single-sourced in the lib and exported, and the
CLI runs it before any filesystem work, so arbitrary environment content
never drives the transcript scan. `kit-goal.js cmdArm` reads
the environment, locates the transcript, passes both, and renders the binding
state in the arm output. Header comments in both files gain the arm-time
bind: kit-goal-lib.js's `boundSession` field comment (currently "arms
unbound") and the CLI's subcommand block. The never-throws contract of every
exported lib function is preserved.

Trap, confirmed: the suite runs inside a Claude Code session shell, so
`CLAUDE_CODE_SESSION_ID` is present during test runs and would bind arms that
existing tests assert unbound. `test/kit-goal-lib.test.js` already scrubs
run-scoped variables for the file's whole run (the block at line 39, KIT_RUN_ID
et al.); extend that scrub to `CLAUDE_CODE_SESSION_ID`, and have CLI-spawn
tests pass explicit env.

Tests (a floor): lib level - a valid UUID sessionId arms bound with the id in
the written file; transcriptPath stored when valid, null when invalid or
absent, without failing the bind; absent/empty/non-UUID sessionId arms
unbound; re-arm with a bind replaces a previous binding. CLI level (spawned
with explicit env, existing spawn pattern in the same file) - env var set to a
UUID arms bound and the output says so; env var absent arms unbound and the
output says so; transcript located when a fake
`<home>/.claude/projects/<any>/<sid>.jsonl` exists (point the spawned child's
home at a temp dir via USERPROFILE on Windows / HOME elsewhere, matching how
`os.homedir()` resolves).

### 2. Typed-lead claim fallback

Model: fable

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`,
`test/kit-goal-stop.test.js`, `test/kit-compact-gate.test.js`.

`userCommandArgsInclude` gains the typed-lead shape per the Design section:
markup path first and unchanged, lead shape evaluated only when markup did not
match, all entry-level exclusions untouched. The predicate's comment block
(the "Deliberate exclusions" list above `userCommandArgsClaimPlan`) gains the
lead rule and why the lead anchor is the anti-steal boundary. No change to
`userCommandArgsClaimPlan`'s entry filtering or to either consumer hook.

Tests (a floor), in both consumers' test files since both pin claim behavior:
a multi-line typed arm (`/kit-goal\n<path>` as a plain user entry, no markup)
claims; a namespaced lead (`/claude-kit:kit-goal ...`) claims; a message
leading with prose then the command does not; a message leading with a code
fence containing the command does not; `/kit-goal-notes.md <path>` does not
(token boundary); a plain mention of the path mid-message does not (existing);
an entry with a tool block whose text leads with the command does not (the
whole-entry discard governs the new shape too); an assistant entry leading
with the command does not.

### 3. Docs and skill surfaces

Model: fable
Locus: inline

Files in scope: `plugins/claude-kit/skills/kit-goal/SKILL.md`,
`docs/architecture.md`, `docs/security-model.md`, `docs/backlog.md`,
`plugins/claude-kit/scripts/stop-failure-watcher.ps1` (comment only).

SKILL.md: the Arm section notes the CLI binds the arming session at arm time
and reports the binding in its output, and that multi-line and prose arming
are first-class; "How the leash holds" reorders the claim account (arm-time
bind is the normal path; the stop and compaction-offer claims are the
fallback, now with two accepted shapes) without restating literals the hooks
own. `docs/architecture.md`: update the goal-binding account to match,
including the watcher paragraph's arming description. `docs/security-model.md`:
record `CLAUDE_CODE_SESSION_ID` in the environment-overrides account with the
two-key gate and its accepted residuals (a stale id naming a real local
transcript; a cross-project transcript path stored in `.kit/goal-state.json`;
an `os.homedir()`-composed transcript path as a second `boundTranscript`
provenance), and extend the anti-steal claim account with the typed-lead
shape and its argument-block boundary.
`plugins/claude-kit/scripts/stop-failure-watcher.ps1`: the scope-guard comment
("Arming writes boundSession = null...") is updated to the conditional truth;
the guard's code is correct as-is (an arm-time-bound run that dies matches on
`boundSession` directly, and the sentinel branch still serves the no-env
fallback). `docs/backlog.md`: the arm-time-binding item is delivered by this
plan; retire it to the quarterly archive snapshot in the close-out per
curating-docs. Prose only; no behavior claims that the code does not have.

## Related

- `claude-kit_compact-gate-binding_spec_v1.md`: added the compaction-offer
  claim point this plan demotes to a fallback, and parked the arm-time-binding
  idea with its two then-unpinned facts.
- `claude-kit_goal-continuity_spec_v1.md`: the original leash.
- `claude-kit_stop-failure-recovery_spec_v1.md`: the watcher whose scope
  guard's unbound-accept branch now serves only the uncorroborated-arm
  fallback.

## Out of Scope

- The bind compare-and-swap (`docs/backlog.md` item dated 2026-08-18): its
  contract change for the Stop hook deserves its own round, and arm-time
  binding writes through `armGoal`'s single write, not `bindSession`.
- Broadening the markup claim path or the automation-detection shapes.
- Any change to checkpoint matching, `sameSessionId`, or the gate's verdict
  ladder.

## Chapters

### Chapter 1 - 2026-08-20
Completed: 1. Arm-time binding
Implemented By: implementer-opus
Metrics: review rounds 2 (initial + fix); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: The review round (adversarial, blind, security, all opus/max) converged on the shape-only UUID gate being unauthenticatable: a stale or planted UUID-shaped value would bind a leash no session enforces, unrecoverable because both fallback claim points act only on an unbound goal. Adjudicated fix, applied: the two-key bind (UUID shape plus a validTranscript-accepted transcript path), the CLI supplying the path only from an existence-checked scan of the harness transcript store; this also dissolved the second Major (boundTranscript stranded null for a bound goal's whole life) by construction, since the no-transcript world now arms unbound and the claim points record the payload's transcript as before. armGoal returns boundSession so the CLI reports what was actually written. Declined with reason: printing the bound id in the arm output (status names it), and constraining the scan to the cwd's own project directory (needs the harness's path-munging convention; the cross-project residual is accepted and documented in security-model.md). Harness facts pinned this effort: CLAUDE_CODE_SESSION_ID equals the hook payload's session_id equals the transcript basename (triangulated via the ai-os Warden bind plus two sessions' shells), and a dispatched subagent's shell carries the parent session's id (probed live on SCOTT-CLAUDE).
Assumptions: transcript located by scanning ~/.claude/projects/*/<sid>.jsonl rather than reproducing the harness's directory-name munging (declared 2026-08-20, section 1; reversal: swap the scan for a munge helper).
Review Findings: two Majors fixed with red-proof; Minors fixed (header env claim narrowed, stale test comments reworded, raw-file assertions replacing readGoal reads, shape-test-before-filesystem ordering, separator-id CLI case). The blind reviewer's third Major (stop-failure watcher's unbound-accept branch breaks) was REFUTED against the watcher code: an arm-time-bound run that dies matches on boundSession directly at the scope guard, the sentinel branch serves the no-env fallback, and arm-time binding closes the previously uncovered died-before-first-claim recovery hole; the stale comment it flagged is fixed in section 3.
Stamps: adjudicated 0 pending; claude-code-session-id-in-shell-env, test-suite-invocation, suite-baseline-is-not-zero-fail, claude-kit-hook-edits-need-a-build-stamp-refresh stamped applied in-flight.
Next: 2. Typed-lead claim fallback
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-20
Completed: 2. Typed-lead claim fallback
Implemented By: implementer-fable
Metrics: review rounds 2 (initial + fix); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: The blind and security reviewers converged on the needle-anywhere-after-token Major: a bystander's genuine lead-token message for one plan could steal another armed plan's binding via a body mention, quoted paste, or an appended text block in the same entry. Adjudicated fix, applied: the argument block (from the token to the first blank line or line opening with a backtick or '<') is the typed-lead analogue of the markup shape's command-args span. Also fixed: the lead anchor runs on stripped un-normalized text so a literal \kit-goal lead no longer claims, namespace parity ((?:[\w-]+:)* matching the markup path's ':kit-goal' suffix rule), and comment honesty (the "exactly as strict as the harness" overstatement replaced with the actual boundary and its two declared loosenings). The strip-then-anchor ordering is pinned as claiming, because text outside local-command wrappers in a user entry is typed text by design.
Assumptions: case-insensitive lead match (declared in this spec's Assumptions).
Review Findings: Major fixed with red-proof (four steal shapes flip claim-to-refuse across the fix, four genuine shapes stay claiming); Minors fixed; round-1 adversarial verdict was APPROVED with the same backslash-normalization Minor the fix round closed.
Stamps: none surfaced (adjudicated at Chapter 1).
Next: 3. Docs and skill surfaces
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-20
Completed: 3. Docs and skill surfaces
Implemented By: main session
Metrics: review rounds 0 per-section (prose-only; the finishing pass reviews the full changeset); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: Scope was widened during execution per the security reviewers, recorded in the section's file list: docs/security-model.md (CLAUDE_CODE_SESSION_ID recorded as the second deliberately ungated behavior-steering variable, with the two-key corroboration, its residuals, boundTranscript's second provenance, and the typed-lead shape added to the anti-steal account) and the stop-failure watcher's scope-guard comment (code verified correct as-is). SKILL.md's Arm section now reports the binding and names multi-line and prose arming first-class; "How the leash holds" leads with the arm-time bind and states both fallback claim shapes. The backlog's arm-time-binding item retires at the close-out.
Assumptions: none.
Review Findings: n/a per-section; finishing reviewers are briefed to read whole files rather than diffs (the skill-amendments-collide-with-neighbours memory).
Stamps: skill-amendments-collide-with-neighbours stamped applied.
Next: finishing-work
Commit Model: Commit-and-Push

### Chapter 4 - 2026-08-20 (close-out)
Completed: finishing pass; effort Complete
Implemented By: main session (gates dispatched: qa-verifier, security-reviewer at fable, adversarial-reviewer at fable, docs-curator)
Metrics: review rounds 1 finishing (plus the 2 per-section rounds recorded above); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: QA verdict PASS with every acceptance criterion exercised by execution (suite 1041/1039/2, the documented memq-shim environment pair only; live arm bound and unbound cases both proven against the real CLI). Finishing security verdict CLEAR; finishing adversarial APPROVED_WITH_CONCERNS. Post-gate minors applied: the contiguous-prose-line residual of the typed-lead argument block is now named in security-model.md's claim paragraph and in this spec's Design; findTranscript corroborates with statSync().isFile() rather than existsSync so code and control document state the same fact; the boundSession field comment's crash-re-arm example and the userCommandArgsClaimPlan header's "anywhere after a typed lead" wording (the curator's one mistake-class drift, a stale pre-fix comment over verified-correct code) were corrected; the watcher comment rewrapped. Declined with reason: hardening armGoal's lib boundary with a basename(transcriptPath)-equals-sessionId check (the lib contract is deliberately shape-only, pinned by its own test; the CLI is the only caller and carries the existence corroboration; re-opening reviewed code post-gate costs more than the note). Drift Report: one mistake (the comment above, resolved in this pass with the review evidence), three deviations (fleet-integration.md's leash-claim account, docs/README.md's security summary, architecture.md's gate-claim justification), all updated by the curator to as-built and recorded here.
Assumptions: none new this pass.
Review Findings: finishing security CLEAR (3 minors: 2 fixed, 1 declined as above); finishing adversarial APPROVED_WITH_CONCERNS (3 minors, all fixed).
Stamps: clean sweep (memq unstamped listed nothing pending; 5 stamped in-flight across the effort).
Next: none; archived
Commit Model: Commit-and-Push
