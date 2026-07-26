# Hook Canary and Goal Release Events

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: n/a (Fable-led session)
Created: 2026-07-25

## Goal

Two additions to the kit's hook layer. First, a session that starts with dead, stale, or corrupt enforcement hooks says so loudly at session start instead of silently running unguarded: every kit hook fails open by design, so today a broken Node spawn, a stale plugin cache, or a corrupt hook file removes the guards with zero signal. Second, a kit-goal leash release (the run is genuinely done, or genuinely blocked) leaves a machine-readable event in a well-known global file, so the AI OS layer can watch one path and turn releases into notifications (Discord transport is the AI OS's job, not the kit's).

## Approach

**Canary.** A new SessionStart hook, `hook-canary.js`, probes the installed plugin cache (`CLAUDE_PLUGIN_ROOT`), which is the copy live sessions actually execute, not the repo. Two probe classes:

- **Load checks** for every hook wired in `hooks.json`: the file exists in the cache and `node --check` accepts it. Enumerating `hooks.json` means future hooks are auto-covered.
- **Known-answer behavior probes**, both directions (a known-deny and a known-allow, so a broken probe cannot read as a pass), for the guards whose deny path is deterministic with a fabricated payload and no repo, git, or network state:
  - `docs-write-guard.js`: a governed agent type writing a `docs/` path denies (exit 2); the same payload with no agent type allows (exit 0). The guard is pure pattern-matching on the payload (`docs-write-guard.js:83-107`), no filesystem dependency.
  - `readonly-agent-guard.js`: a strict agent type running `git commit` denies (exit 2); the same agent running `git diff` allows (exit 0). The state-change branch (`readonly-agent-guard.js:804-810`) runs before any cwd or repo logic, so the deny is deterministic with no `cwd` in the payload.
  - `kit-goal-stop.js`: a temp-dir fixture (armed goal bound to a fabricated session id, an In Progress plan file, a transcript whose last assistant text does not lead with `BLOCKED:`) must produce `{"decision":"block"}` on stdout; an empty temp dir (no goal armed) must produce no output. `KIT_GOAL_STOP_RETRY_MS=0` disables the re-read delays. Fixture shapes mirror `test/kit-goal-stop.test.js`; the fixture lives under the OS temp dir and is removed after the probe. No real project or goal state is touched.
- **Plumbing probes only** for `merged-pr-push-guard.js` and `pr-docs-guard.js` (benign payload, expect exit 0): their deny paths require confirmed external state (a MERGED PR via the host CLI; a dirty git checkout on a non-default branch), so behavior coverage for those stays in the repo test suite. This limitation is accepted and documented in the canary's header comment.

Silence on all-pass. On any failure, the canary writes a short loud warning to stdout (SessionStart stdout is injected as session context) naming each failed probe (hook, expected, got) and pointing at kit-doctor and a kit reinstall. The canary always exits 0. The loud/silent boundary is: anything the canary can positively observe about the cache being broken is loud (a failed probe, a missing hook file, a missing or unparseable `hooks.json`, a plugin root that does not exist), while an unexpected exception inside the canary's own code stays silent through the outer fail-open catch, since a canary bug must never spam every session. Residual blind spot, accepted: if Node itself is missing, the canary cannot run either; the harness surfaces the hook command failure.

Probes run serially via `spawnSync` with a per-child timeout (5s) so a hung probe cannot hang session start; a healthy sweep is about twenty local spawns (a load check per wired hook plus the behavior probes), measured under a second, every `startup|resume` (not `compact`: the cache cannot change mid-session), unthrottled. The probe-set hooks (the four `EXIT_PROBES` guards plus `kit-goal-stop.js`) ship in the same cache snapshot as `hooks.json`, so a parseable `hooks.json` that no longer wires one of them is itself reported as a wiring failure rather than silently skipping the probe.

**Goal release events.** `kit-goal-stop.js` has exactly three genuine release points, and only those three emit (every other early return is a bystander or transient allow, not a release):

- Plan Status is Complete (`kit-goal-stop.js:431`): event `goal-complete`, detail `plan-complete`.
- Plan file gone, ENOENT (`kit-goal-stop.js:440`): event `goal-complete`, detail `plan-archived`.
- Last assistant message leads with `BLOCKED:` (`kit-goal-stop.js:450`): event `goal-blocked`.

A new `emitGoalEvent` helper in `kit-goal-lib.js` appends one JSON line to `~/.claude/kit-events.jsonl`. Schema per line: `{ts, event, project, plan, session, detail}` where `ts` is ISO 8601, `project` is the absolute cwd, `plan` is the repo-relative plan path, `session` is the session id or null, `detail` present only on `goal-complete`. Field content is normalized to short printable ASCII at the boundary (`plan` and `session` capped at 120, `project` at 260): the values originate in repo-territory data (`.kit/goal-state.json`), and the consumer treats the stream as kit-authored. The helper never throws, skips a sink that exists but is not a regular file (the FIFO-hang guard the hook's transcript reads also apply), and its failure never alters the stop decision. Rotation is best-effort and single-writer-typical: past 1 MB the file is renamed to `kit-events.jsonl.old` (replacing any prior `.old`); a persistently failing rename degrades to unbounded growth, never data loss.

The `goal-complete` emits are gated on the goal-state clear actually succeeding, so a persistently failing clear re-arms the next stop without re-reporting a release that did not happen. `goal-blocked` can re-emit on repeated blocked stops; the hook stays stateless by design and dedup is the consumer's transport policy. Two release paths deliberately emit nothing: the harness's own consecutive-block-cap override (the hook never sees it) and a manual `/kit-goal clear` (the user is present; the CLI does not call the emitter).

The consumer contract, for the AI OS side: the canonical sink is `~/.claude/kit-events.jsonl` and a consumer must not itself honor an ambient `KIT_EVENTS_PATH` (that env var is a producer-side redirect used by tests and the canary's isolation pin); field values are sanitized display data, not commands; `project` is an absolute local path that typically embeds the OS username, a PII call the consumer makes before forwarding anywhere external; and `goal-blocked` dedup is load-bearing against notification spam.

The Discord/transport side is the AI OS's, out of scope here; this plan's deliverable ends at the JSONL contract above.

## Sections of Work

### 1. hook-canary.js plus wiring and tests
Model: opus

New file `plugins/claude-kit/hooks/hook-canary.js` implementing the canary described in Approach, plus a `SessionStart` entry in `plugins/claude-kit/hooks/hooks.json` with matcher `startup|resume`. House conventions from the sibling hooks apply: Node core modules only, `'use strict'`, header comment stating behavior and the fail-open safety posture, `try { main(); } catch { /* fail open */ }`. One deliberate departure from the siblings' tail: the canary ends with `process.exitCode = 0` rather than `process.exit(0)`, because an immediate exit after `process.stdout.write` can drop a pending pipe write on Windows, and the warning write is the hook's entire value. Resolve the plugin root as `CLAUDE_PLUGIN_ROOT` falling back to `path.join(__dirname, '..')` (the `doctrine-refresh.js` convention). Hook script paths are extracted from the `hooks.json` command strings and resolved against the cache root; a `hooks.json` that is missing or unparseable is itself a canary failure (loud), since sessions would be running with no kit hooks at all.

New file `test/hook-canary.test.js`, Node built-in test runner, following `test/docs-write-guard.test.js` conventions (spawn the real child, assert exit code and output). Cases, at minimum:
- Against the real `plugins/claude-kit` as `CLAUDE_PLUGIN_ROOT`: exit 0, no output (the healthy install is silent).
- Against a fixture cache (hooks copied to a temp dir) with one guard replaced by an always-exit-0 stub: warning names that guard's deny probe.
- Against a fixture cache with one hook file syntax-broken: warning names the load check.
- Against a fixture cache with a hook file deleted: warning names the missing file.
- `CLAUDE_PLUGIN_ROOT` pointing at a nonexistent dir (no `hooks.json` reachable): exits 0 and warns; a cache the canary cannot find is a positive observation of a broken install, not an internal error.

Acceptance: `node --test test/hook-canary.test.js` green (name the file explicitly; bare `test/` misfires on Node 24); the full existing suite still green against its recorded baseline; a manual run of the canary against the real installed cache (`~/.claude/plugins/cache/...`, via `CLAUDE_PLUGIN_ROOT`) is silent.

Tests: lock both directions of every behavior probe (a guard that wrongly allows must fail the canary, and a healthy guard must not), and lock the canary's own silence on a healthy cache; the expensive failure is a canary that cries wolf every session start or one that stays silent over a dead guard.

### 2. Goal release events from kit-goal-stop.js
Model: opus

`emitGoalEvent` in `plugins/claude-kit/hooks/kit-goal-lib.js` and calls at the three release points in `plugins/claude-kit/hooks/kit-goal-stop.js`, exactly as specified in Approach. The emit happens only when the release is affirmative: after the Complete check passes, after `planFileIsGone` confirms ENOENT, after the BLOCKED read returns true. No other code path in the hook changes; in particular the emit must not move, wrap, or reorder the existing allow/block logic, and an emit failure (unwritable home dir, full disk) must leave the hook's stdout and exit code exactly as today.

Tests extend the existing suites (`test/kit-goal-lib.test.js` for the helper: append shape, rotation at the 1 MB threshold, never-throws on an unwritable path; `test/kit-goal-stop.test.js` for the call sites, using `KIT_EVENTS_PATH` into a temp file). Cases, at minimum: complete emits exactly one `goal-complete`/`plan-complete` line with the full schema; archived emits `plan-archived`; blocked emits `goal-blocked`; a bystander allow (unbound session, other-session bound goal) emits nothing; the enforcement block path emits nothing; an emit pointed at an unwritable path leaves the stop decision and output unchanged.

Acceptance: `node --test test/kit-goal-lib.test.js test/kit-goal-stop.test.js` green; full suite green against baseline.

Tests: lock both directions at every release point (release emits, non-release does not) and lock decision-invariance under emit failure; the expensive failures are a leash whose semantics shifted (a block turned into an allow by an emit bug) and a spam stream from bystander allows.

### 3. Doctor wiring check for the canary
Model: haiku

Clone the kit-goal-stop wiring check in `plugins/claude-kit/doctor/doctor.ps1` (lines 896-921: hook file present, wired in `hooks.json`'s array) with substitutions: `hook-canary.js`, the `SessionStart` array, label "Hook canary". Mirror the sibling's PASS/FAIL wording shape exactly. Only the plugin copy is edited: the repo-root `doctor.ps1` is a thin forwarder to it, not a mirror.

Acceptance: running the doctor on this machine shows the new check as PASS once Section 1 has landed and the plugin cache has the canary; the check FAILs against a cache without it (verifiable by pointing the check logic at a fixture, or by reading the cloned logic against the sibling).

## Out of Scope

- Discord or any notification transport, and event-consumer dedup: the AI OS layer owns everything past the JSONL contract.
- Behavior probes for `merged-pr-push-guard.js` and `pr-docs-guard.js` deny paths (external-state-dependent; repo suite owns them).
- A `goal-armed` event, and events from any hook other than kit-goal-stop.
- Throttling or scheduling machinery for the canary.
- `docs/architecture.md` hook-wiring updates ride the finishing-work docs pass, not a section.

## Open Questions

None. Sink location (`~/.claude/kit-events.jsonl`) and commit model (Commit-and-Push) decided 2026-07-25 with Scott; blocked-event dedup deliberately lives with the consumer.

## Related

- Builds on `../archive/claude-kit_goal-continuity_spec_v1.md`: the `/kit-goal` leash whose three release points the events half instruments.
- Builds on `../archive/claude-kit_readonly-agent-guard_spec_v1.md` and `../archive/claude-kit_docs-write-guard_spec_v1.md`: the guards whose deterministic deny paths the canary probes.

## Chapters

### Chapter 1 - 2026-07-25
Completed: 1. hook-canary.js plus wiring and tests
Implemented By: implementer-opus (initial build), implementer-opus (review-fix batch); no escalations
Metrics: 1 review round (adversarial + blind + security); NEEDS_CONTEXT 0; escalations 0; advisor opus
Decisions / Surprises: The blind reviewer confirmed by execution a Major the other two lenses missed: an unguarded structure walk in `wiredHooks` let a valid-JSON wrong-shape hooks.json throw into the fail-open catch, silencing the canary on a positively broken cache; fixed with level-by-level shape checks routing to the loud wiring failure, red/green proven. Two deliberate deviations amended into the spec: the canary tail is `process.exitCode = 0` instead of the siblings' `process.exit(0)` (a pending stdout pipe write can be dropped by an immediate exit on Windows, and the warning write is the hook's value; the siblings' shared exposure is a backlog item), and an unwired probe-set hook in a parseable hooks.json is now a loud wiring failure rather than a silent skip (the probe set ships in the same cache snapshot as hooks.json, so it cannot false-alarm on a coherent cache). The security reviewer's `KIT_EVENTS_PATH` pin went into the goal probe's env ahead of Section 2, so probe paths mechanically cannot write the real event stream even if the emitter misplaces a call. Healthy sweep measured at ~20 spawns, 0.76-0.95s.
Review Findings: 1 Major fixed (wiredHooks silence, blind). Minors fixed: probe-set wiring gap (blind + adversarial convergence), partial-fixture temp-dir leak (blind + security), exit-after-write hazard (blind), KIT_EVENTS_PATH pin (security), tmpdir-race flake in the cleanup test (adversarial). Minor noted, not fixed: no aggregate probe deadline (per-child 5s only); a hang-direction cache could outlast the harness hook timeout before report(), but that requires an adversary already running code in every session, and the harness surfaces the killed command. Security verdict CLEAR; injection surface bounded by sanitize() (printable ASCII, 200-char cap, no newlines).
Gate: full suite 163/163 pass (baseline 147/147, +16 canary tests, 0 regressions); healthy-cache manual run silent, exit 0.
Next: 2. Goal release events from kit-goal-stop.js
Commit Model: Commit-and-Push

### Chapter 2 - 2026-07-25
Completed: 2. Goal release events from kit-goal-stop.js
Implemented By: implementer-opus (initial build), implementer-opus (review-fix batch); no escalations
Metrics: 1 review round (adversarial + blind + security); NEEDS_CONTEXT 0; escalations 0; advisor opus
Decisions / Surprises: The implementer found that two pre-existing tests spawning the hook at release points would have appended to the real `~/.claude/kit-events.jsonl` on every suite run; every spawn site in the stop-hook test file now pins `KIT_EVENTS_PATH` into a temp fixture, and that pin is stated as a contract in the test file's header. Forcing a clearGoal failure on Windows required a `NODE_OPTIONS --require` preload (chmod does not block unlink under libuv, an open handle does not either, and an icacls deny-delete ACE blocks the read too); the preload path must be forward-slashed or NODE_OPTIONS parsing kills the child. The emit gate uses `clearGoal(cwd).ok`, not `.cleared`: already-gone-at-clear-time is a genuine release per the lib's own contract. Amended into the spec after review: event fields are sanitized to short printable ASCII at the emit boundary, goal-complete emits gate on the clear succeeding, the sink gets the non-regular-file guard, rotation is stated best-effort, and a consumer-contract paragraph (canonical sink, display-data fields, project PII call, load-bearing dedup) was added for the AI OS side.
Review Findings: 1 Major fixed (security: plan/session/project entered the notification-bound stream raw while the hook sanitizes the same plan value for its block-reason channel; now sanitized in emitGoalEvent, red/green proven). Minors fixed: goal-complete re-emit under a persistently failing clear (adversarial + blind convergence; gated on `.ok`, red/green proven), missing non-regular-file sink guard (adversarial + security convergence), shared never-cleaned tmp fallback in the test helpers (adversarial + blind), rotation comment overclaiming "bounds" (blind), lib header overclaiming stream coverage (blind; a manual /kit-goal clear releases without emitting, deliberately). Minors noted, not fixed: rotation is not atomic across concurrent emitters (best-effort posture, comment now says so); the sanitize rule for plan exists as two per-channel literals (lib emit boundary and the hook's block-reason site), accepted as different channels with different caps; the KIT_EVENTS_PATH override is production-honored by design with the consumer told not to honor it ambiently. The archived-emit placement inside the planFileIsGone guard is pinned by reading, not by a test: no portable Node-core lever forces a non-ENOENT plan open failure (two probes confirmed), accepted.
Gate: full suite 176/176 pass (Chapter 1 baseline 163/163, +13 event tests across both batches, 0 regressions); real spawned-hook run emitted goal-blocked then goal-complete/plan-complete against a temp fixture with exit 0 and empty stdout both times; real `~/.claude/kit-events.jsonl` confirmed absent before and after the suite.
Next: 3. Doctor wiring check for the canary
Commit Model: Commit-and-Push

