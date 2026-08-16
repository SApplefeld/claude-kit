# Stop-failure recovery: self-resume unattended runs after a session-limit death

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-16

## Related

- `docs/backlog.md`, item "Explore channels for unattended interactive runs (research preview) (2026-07-08)": a different instrument for the same operating mode. A channel injects events into a live session; it cannot answer the session-limit modal or start a session, so it does not cover this plan's failure and stays parked on its own terms.
- `claude-kit_interactive-compact-deferral_spec_v1.md`: its Chapter 1 settles this plan's Section 1(c) in advance. A slash command passed to `claude -p` does not execute, arriving as prose and writing no command markup, so this plan's resume prompt cannot arm the leash with `/kit-goal` and must instruct the arm CLI instead. (One-way pointer: that plan needs nothing from this one.)
- External reference: `github.com/softcane/cc-session-recover` (MIT, read 2026-08-16, not installed). Its contribution to this design is the discovery that the `StopFailure` hook event exists and carries the failure metadata; its handoff-notebook and watcher components are re-implemented kit-natively here because the kit already owns stronger versions of the state half (plan docs, `.kit/goal-state.json`, Chapters) and the watcher half is small.

## Context

Decided 2026-08-16 with Scott, after an overnight incident on the ASR VM: two sessions hit the five-hour session limit mid-run ("Agent terminated early due to an API error: You've hit your session limit · resets 6:20am"), the console showed a stop-and-wait/use-credits modal invisible to the Discord relay, and the run stranded roughly eight hours until the operator reached the console.

Harness facts this design stands on (doc-researched 2026-08-16 via the claude-code-guide agent against current hooks.md/errors.md/settings.md; Section 1 live-verifies the ones marked probe):

- **`StopFailure` is a real hook event**: it fires when a turn ends due to an API error. It cannot block (exit code 2 is ignored), so it is an observer, which is exactly why the kit-goal Stop-hook leash never held these sessions: an API-error turn end routes to StopFailure, not Stop, and the leash lives on Stop. (Payload shape beyond the common fields is undocumented; probe.)
- **The session-limit modal cannot be suppressed, pre-answered, or dismissed by any setting, flag, env var, or hook.** Hooks cannot answer UI prompts. Auto-resume at limit reset does not exist natively. The modal is a hard blocker in unattended operation; this plan routes around it rather than fighting it.
- **`CLAUDE_CODE_RETRY_WATCHDOG=1` retries 429/529 indefinitely** and raises transient-error retry depth (documented for unattended/CI use). The operator is setting it on the ASR VM outside this plan. It covers transient errors, not the session-limit class; this plan covers the remainder. Whether it changes the interactive modal behavior at the five-hour limit is unknown and rides in Operator Verification.
- The reference repo's observed StopFailure fields: `session_id`, `error` (a classification such as `rate_limit`, `overloaded`, `server_error`), and for rate limits a `rate_limit_state` object carrying `five_hour_resets_at` and `cached_at` epoch timestamps. Third-party-observed, not documented; the logger is built shape-agnostic and Section 1 captures what this install actually sends.

Kit facts:

- `.kit/goal-state.json` records the armed plan and the leash-bound session id (`kit-goal-lib.js` owns it). The kit-goal leash binds one session; re-arming is the documented recovery when a bound session dies, and the claim signal is the `/kit-goal` invocation's command arguments in the transcript, never CLI stdout (per `skills/kit-goal/SKILL.md`).
- The plan doc plus Chapters is the handoff state; a resumed session re-grounds from it via the existing SessionStart recovery. Nothing in this plan invents a parallel notebook.

## Goal

When an unattended, kit-goal-armed run dies on a retryable API failure (the session limit above all), the failure is recorded durably the moment it happens, and a watcher on the machine resumes the run after the limit resets, re-arms the leash, and continues the plan, so an overnight limit hit costs the reset wait instead of stranding until the operator reaches a console. Failures the kit cannot retry (auth, billing, invalid request) are recorded and left alone. Every piece fails toward "do nothing and leave the record", never toward acting on bad data.

## Approach

**Split policy from observation: a dumb logger hook, a deciding watcher.** The `StopFailure` hook cannot know whether resuming is safe, and its payload shape is not fully documented, so the hook records and nothing else. The watcher, running outside any session, owns every decision: retryability, timing, scoping, and the resume itself.

**The logger.** A new hook `plugins/claude-kit/hooks/stop-failure-log.js`, wired in `hooks.json` under `StopFailure`: it reads stdin, appends one JSON line (full payload plus an ISO timestamp) to `.kit/stop-failure-events.jsonl`, and atomically writes the same record to `.kit/stop-failure-latest.json` (tmp-plus-rename, the `kit-compact-lib.js` pattern). Fail-open on every path: any error exits 0 silently; no payload content ever reaches stderr (untrusted data, same posture as the compact gate). The hook does not classify, does not read the goal state, and does not act.

**The watcher.** `plugins/claude-kit/scripts/stop-failure-watcher.ps1` (PowerShell, per house default), designed to run as a Windows scheduled task and equally runnable by hand. Each pass:

1. Read `.kit/stop-failure-latest.json`. Absent or unparseable: exit quietly.
2. Scope guard: `.kit/goal-state.json` must hold an armed plan whose `boundSession` matches the marker's `session_id` (opaque case-insensitive compare, the `sameSessionId` convention). No match: exit, leaving the record. This is the deliberate v1 scope: only leashed unattended runs auto-resume. An interactive session that dies on an API error is the operator's to resume, and this guard is also the main fork-risk mitigation, since the stranded-console case is precisely the armed-run case.
3. Retryability: the marker's error classification must be in the configured retryable set (default `rate_limit`, `overloaded`; `server_error` off by default since the retry watchdog owns transient retries in-session). Not retryable, or unclassifiable: exit, leaving the record.
4. Timing: if the marker carries a legible rate-limit reset timestamp that is fresh (recorded within the last six hours) and still future, the wake time is reset plus a buffer (default 900 seconds); otherwise a fallback delay (default 1,200 seconds from the marker's timestamp). Not yet due: exit; the next scheduled pass re-checks.
5. Attempt cap: at most 3 resume attempts per incident (tracked in the marker or a sibling `.kit/stop-failure-attempts.json`); at the cap, append an exhausted note to the events log and stop touching the incident.
6. Resume: validate the session id against a strict grammar (hex, dashes, bounded length; refuse anything else outright, since the marker is user-writable and this value reaches a command line) and run `claude -p --resume <session_id> "<resume prompt>"` from the project directory. The resume prompt is fixed text shipped in the repo, never composed from marker content: it names the armed plan path read from the goal state (validated through `normalizePlanArg`), instructs the session to re-arm with `/kit-goal <plan path>` and continue executing per the plan doc, and states that it was resumed by the stop-failure watcher after a retryable failure.
7. Record: write `.kit/stop-failure-resumed.json` (when, old session id, exit code of the resume invocation) and append to the events log. Clear the latest-marker only when the resume invocation exited 0; on a nonzero exit, increment the attempt count and leave the marker so the next scheduled pass retries, up to the cap. A resumed run that later dies again produces a fresh marker from the logger and counts as a new incident.

**The doctor owns installation.** A new `plugins/claude-kit/doctor/install-stop-failure-watcher.ps1` (one installer per repair, the house convention) registers the scheduled task behind an explicit `-Fix` consent, and the doctor's check mode reports the task's presence and the watcher script's reachability (INFO when absent; installing is opt-in, since only unattended machines want it). The task interval is the watcher's fallback granularity; default 15 minutes.

**The fork risk, mitigated and then named.** The dangerous sequence: the watcher resumes headlessly while the dead session's console still shows the modal, and the operator later answers the modal, producing two continuations sharing one worktree. Mitigations in order: the scope guard (only armed runs resume, and re-arming rebinds the leash to the resumed session, so the old console session is no longer leashed even if continued); the `.kit/stop-failure-resumed.json` sentinel; and the operational rule, which ships in the watcher's header comment and the security model: **before answering a stale limit modal on a console, check `.kit/stop-failure-resumed.json`; if the incident was resumed, exit that console session instead of continuing it.** The residual (an operator continuing anyway) is accepted and documented; nothing mechanical can stop a human at a console.

**What Section 1 must settle before the watcher is finalized.** Whether `claude -p --resume <id>` continues the same session id or forks a new one (affects how re-arming binds and how a repeat failure of the resumed run is tracked); whether a `/kit-goal` slash command inside a `-p` prompt executes as a command (if not, the resume prompt instructs the session to run the arm CLI and the leash claim rides on the next real `/kit-goal`, or the prompt is adjusted to whatever the probe shows works); and the real StopFailure payload of this install. The Approach is amendable on those results, delta flagged in the Chapter.

## Sections of Work

### 1. Probe: StopFailure payload and resume semantics, kill-or-confirm
Model: opus
Locus: inline
Reuse the probe pattern the operator memories record (`claude-code-hook-payload-facts`, `probe-scripts-scratchpad-and-controls`): a `--settings` file registering a dump-to-scratchpad hook on `StopFailure`, cheap model, artifacts under the scratchpad or gitignored `.kit/`, never `docs/`. Establish, with captured payloads and transcripts as evidence:

- (a) StopFailure fires on this install when a turn dies of an API error. Force the error cheaply: point `ANTHROPIC_BASE_URL` at a dead local port, or use an invalid model id, inside a throwaway headless session. Capture the full payload for at least one failure. This is the kill-or-confirm criterion: if StopFailure never fires here, stop per the blocker clause and record the installed version.
- (b) The payload's field names for the error classification, and whether anything rate-limit-shaped rides in it for a forced error (the real session-limit payload cannot be forced; the shipped logger captures it on the next genuine occurrence, which is why the logger is shape-agnostic).
- (c) Resume semantics: create a short session, end it, then `claude -p --resume <id> "<prompt>"`. Record whether the resumed run reports the same session id (SessionStart payloads or transcript), whether the transcript continues the same file, and whether a `/kit-goal status` slash command in the prompt executes as a command or arrives as prose.
- (d) That a StopFailure registration in a plugin's `hooks.json` fires (the probe registers via `--settings`; wire a scratch plugin-shaped registration only if the harness treats the two differently per its own docs; otherwise note the equivalence assumption for Section 2's live check).

Acceptance: a probe report in the Chapter with (a)-(d) each confirmed, failed, or narrowed, evidence paths named; Approach amendments applied inline for anything contradicted, the resume-prompt mechanics above all.

### 2. The logger: StopFailure hook and tests
Model: opus
`plugins/claude-kit/hooks/stop-failure-log.js` plus its `hooks.json` block, behavior exactly per the Approach: append to `.kit/stop-failure-events.jsonl`, atomic-write `.kit/stop-failure-latest.json`, exit 0 on every path, no payload content on stderr, no classification, no goal-state read. Payload handled as untrusted data throughout; the record written is the parsed payload re-serialized plus the timestamp, never raw stdin echoed (a malformed payload is recorded as a note naming only its length). Cap the events log's growth (skip the append past a named byte ceiling, latest-marker still written) so a pathological loop cannot fill a disk.

Tests: mirror the existing hook test patterns (`test/kit-compact-gate.test.js` fixtures style): a well-formed payload lands in both files with the marker atomic; a malformed payload still exits 0 and writes the length-only note; a write failure exits 0; the log-cap path skips the append and still writes the marker; nothing is written outside `.kit/`.

Acceptance: `./build.ps1` before the suite (the integrity manifest must restamp; the manifest covers every shipped hook file, this one included); suite green against the baseline captured at section start, standing exceptions named, delta exactly the new tests. Live check: one forced-error session (Section 1's method) with the real wired hook shows the marker and the log line appear.

### 3. The watcher, the doctor installer, and docs
Model: fable
`plugins/claude-kit/scripts/stop-failure-watcher.ps1` per the Approach's seven steps, with the config knobs (retryable set, buffer, fallback delay, attempt cap, task interval) as named variables at the top of the script. Security posture is the section's spine, because a user-writable marker feeds a command execution: the session id grammar check before interpolation, the plan path validated through the same rule the goal state enforces, the resume prompt fixed repo text, and every guard failing toward exit-without-acting. `plugins/claude-kit/doctor/install-stop-failure-watcher.ps1` registers the scheduled task behind `-Fix` consent and verifies the registration, following `install-compact-window.ps1`'s consent-then-verify shape (no settings file is touched here). Unregistering is a dedicated destructive switch on the doctor, following the `-RemoveLegacyRelay` precedent (a named switch on top of `-Fix`), not a side effect of any repair. Doctor check-mode reports task presence and script reachability, INFO when absent.

Tests: `test/stop-failure-watcher.test.js` (or a `.ps1`-driving Node test per the `compact-window-install.test.js` pattern) with a fake `claude` shim on PATH that records its argv: resume fires with exactly the validated id and the fixed prompt when all guards pass; each guard blocks it in isolation (no marker, unarmed goal, session mismatch, non-retryable error, not-yet-due timing via an injectable clock, attempt cap reached, malformed session id); the sentinel and log records land; the marker clears only after a resume attempt. Both directions on every guard: the silent bypass is the expensive failure.

Docs, same section: `docs/architecture.md` gains the logger and watcher (what fires when, what decides, what the operator installs); `docs/security-model.md` gains the pair's row (the marker as user-writable input to a command execution, each mitigation, the accepted operator-at-the-modal residual and the sentinel rule); root `README.md` inventory surfaces if the hook or doctor-installer lists appear there. `skills/kit-goal/SKILL.md` gains one sentence in the recovery prose: the stop-failure watcher is the mechanical caller of the existing re-arm path after a retryable death.

Acceptance: watcher suite green both directions per above; doctor check-mode run completes on this machine showing the new check; greps for the new names hit the wired surfaces only; the security model's new row present.

### 4. Close-out (finishing-work)
Finishing pass: qa-verifier, security review (a command-executing watcher fed by a user-writable file: emphatically not prose-waivable), final adversarial review, docs-curator, then curating-docs archival. Memory: write the probed StopFailure and resume facts to the operator tier (harness facts, machine-wide, `claude-code-hook-payload-facts` family); log the effort outcome; run the unstamped adjudication and decay checks per finishing-work. Add the live-fire backlog item below if Section 1 or 2 did not already.

## Out of Scope

- Suppressing, pre-answering, or dismissing the session-limit modal (established impossible; the design routes around it).
- Transient-error retries (`CLAUDE_CODE_RETRY_WATCHDOG` owns those; the operator sets it outside this plan).
- Resuming unarmed or interactive sessions (the scope guard is deliberate v1 policy, not a limitation to engineer past).
- Discord notification of limit events or resumes. The channels broker can read `.kit/stop-failure-latest.json` and `.kit/stop-failure-resumed.json` if that project wants a card line; that is `D:\sapplefeld-channels` work, noted here only so the file contract is known to have a potential second reader.
- Installing or vendoring `cc-session-recover`.
- A Linux/WSL watcher sibling (follows the standing `doctor.sh` backlog posture).

## Operator Verification

- The end-to-end that no session can force: on the next genuine session-limit hit on an armed run, the events log holds the real payload, the watcher resumes after the reset, the resumed session re-arms and the plan progresses. A watcher resume whose session does not re-arm or does not continue the plan reopens Section 3 (prompt or resume semantics); a genuine limit hit that writes no marker reopens Section 2 (the event or payload differs from the probe).
- The modal rule: when you reach a console showing a stale limit modal, check `.kit/stop-failure-resumed.json` first; if the incident shows resumed, exit that console session rather than continuing it. Continuing anyway and observing damage is the accepted-residual bet losing; report it.
- With `CLAUDE_CODE_RETRY_WATCHDOG=1` set on the ASR VM: next time a session limit approaches in an interactive session, note whether the modal behavior changes at all. Expected no; a yes shrinks the class this plan covers and is worth a line in the backlog.

## Open Questions

- The real session-limit StopFailure payload (as opposed to a forced generic API error): unobtainable on demand; the shipped shape-agnostic logger captures it at the next genuine occurrence, and the retryable-set config is the adaptation point if its classification string differs from the reference repo's `rate_limit`.
- Whether a `-p --resume` session loads the plugin stack and the relay MCP (affects whether a resumed run is visible on Discord, not whether it works): observe on first real resume; Section 1 records what the probe shows.

## Chapters

