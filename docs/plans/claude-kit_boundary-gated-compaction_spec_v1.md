# Boundary-gated compaction: land native auto-compaction at chapter boundaries

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: S2 (implementer-fable); per-section reviewer pairs above opus writers ride at fable; finishing reviews at fable
Created: 2026-08-15

## Related

- `archive/claude-kit_compact-session-removal_spec_v1.md` (archived): removed the kit's own compaction engine; its Context records the standing default this plan amends (ride native auto-compaction, recover from the plan doc). This plan does not revive any removed machinery: the kit never summarizes anything itself; it only schedules when the harness's own compaction is allowed to land. (Pointer runs one way; that plan is archived and immutable.)
- `archive/claude-kit_compaction-unwind_spec_v1.md` (archived): removed the old context-tripwire and resume relay. The old tripwire nudged the model to run a kit compaction; this plan's gate is the inverse shape, a deterministic hook vetoing the harness's compaction until the right moment, with no model behavior in the loop at fire time. (One-way pointer, same ground.)

## Context

Decided 2026-08-15 with Scott. The observed failure on multi-day unattended plan runs: quality degrades as context climbs (stuck loops, circling, self-inflicted issues), then recovers after auto-compaction. Compaction is the medicine arriving late, so the goal is timely placement, not avoidance. Scott declined an interim threshold-only change ("leave it as is until we solve a better working model"); the threshold change ships only as part of this design. A probe budget was authorized: filling a cheap headless session's context to trigger auto-compaction costs real tokens.

Native facts this design stands on (from the claude-code-guide research pass against hooks.md, env-vars.md, context-window.md at v2.1.232+, as amended by Section 1's live probe on Claude Code 2.1.233; the probe's evidence is Chapter 1):

- Nothing can start a compaction on demand: not the model, not a hook, not the SDK. `/compact` and `/clear` are user-only. The only native lever is the PreCompact hook's power to veto a pending compaction, with separate `auto` and `manual` matchers.
- **A PreCompact deny is exit 2 only.** A hook writing JSON `{"decision": "deny"}` and exiting 0 does not deny: the compaction proceeds as if the hook had allowed it, with no error anywhere. Exit 2 denies reliably. Anything the gate builds on the JSON form would be a silent no-op.
- The auto-compact trigger point is configurable through `autoCompactWindow` in settings.json (documented range 100,000-1,000,000, auto-tuned per model by default). **The effective trigger is the configured window minus a roughly 35,000-token reserve**, not a percentage of it: a configured 100,000 fires at about 64,000 and a configured 150,000 fires at about 116,400. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` produced no observable effect at a value of 20 with context at 81 percent of the model window, so no part of this design relies on it.
- The kit's post-compaction recovery already ships: session-start.js has a `source === 'compact'` branch that re-grounds a session from the plan doc, and the summarizer natively keeps recent exchanges and recently read files.
- Probed on this machine (operator memory `claude-code-hook-payload-facts`): every hook payload carries `session_id` and `transcript_path`; SessionStart must be wired as a `command` hook (the `http` transport silently never delivers it); Claude Code here is 2.1.233, above the reported v2.1.208 PreCompact minimum.

## Goal

On unattended plan runs, native auto-compaction lands at chapter boundaries instead of at an arbitrary late point mid-work. A veto plus a low threshold is a scheduler: the auto-compact window is lowered so the harness volunteers to compact early and often, and a kit PreCompact hook denies auto-compaction mid-chapter and stands aside once a chapter has closed, so the compaction lands on the first attempt after the boundary. Multi-day runs stop spending hours in the degraded high-context regime, and each chapter starts from a freshly re-grounded context at lower cost per call.

## Approach

**The gate is a strict no-op except in one precisely legible state.** It denies an `auto` compaction only when all of the following hold: a kit-goal is armed in the project, the compacting session is the leash-bound session (payload `session_id` equals the binding in `.kit/goal-state.json`), no boundary checkpoint is open, the session is not under `KIT_EXTERNAL_ENGINE` (Spine workers are fresh-per-section and never need the gate), and the latest usage read from the transcript tail is legible and below the safety-valve ceiling. Any other state, any read error, any ambiguity: allow. Manual `/compact` is never gated. This is the same fail-open posture as kit-goal-stop: the gate must never trap a session against the context limit, and a forgotten checkpoint degrades to "compaction lands late mid-chapter" (the status quo), never to a wedged run.

**The checkpoint is the boundary signal.** The executing-work chapter-close ritual writes it via a small CLI (same shape as `kit-goal.js`), recording the armed plan path. The PreCompact hook consumes (deletes) the checkpoint at the moment it allows, so the next mid-chapter attempt is denied again. A checkpoint naming a different plan than the armed one is treated as absent, so a stale file from a prior run cannot open the gate.

**The safety valve caps the failure mode nothing else can.** Sustained denial with a chapter that never closes would otherwise climb to the hard limit ("prompt is too long" failures exist there per the v2.1.229 changelog). The hook reads the most recent usage row from the transcript at `transcript_path`; at or above a named ceiling constant it allows compaction regardless of the checkpoint. If usage cannot be read, the gate allows rather than denying blind.

**The kit summarizes nothing.** The native summarizer runs unmodified (it is not customizable), and re-grounding after the compaction is the existing plan-doc recovery. The whole build is one hook, one small CLI, one settings value, and prose.

**The load-bearing unknown, resolved by Section 1's probe: the veto is a scheduler.** A denied auto-compaction re-attempts once per turn, indefinitely, with no give-up: 15 consecutive denials fired one per assistant turn, ending only when the session hit the model's hard context limit and died with "Prompt is too long". The blocker clause did not fire, so Sections 2-3 proceed. The same run is the evidence that the safety valve is mandatory rather than defensive: sustained denial with no valve wedges a real session against the hard limit.

## Sections of Work

### 1. Probe: PreCompact and threshold semantics, kill-or-confirm
Model: opus
Locus: inline
Reuse the probe pattern the operator memories record (`claude-code-hook-payload-facts`, `probe-scripts-scratchpad-and-controls`): a settings JSON passed via `claude -p ... --settings <path>` registering hooks whose command dumps stdin to a scratchpad file; probe scripts and captures live under the session scratchpad or gitignored `.kit/`, never `docs/`. Run against a cheap model. Drive context past a deliberately lowered trigger (try `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` at a low percentage first, since a near-floor trigger makes the probe cost pennies; fall back to `autoCompactWindow` at its 100k floor plus bulk context if the override disappoints).

Establish, with captured payloads and transcripts as evidence:
- (a) PreCompact fires on the auto trigger; full payload shape captured (fields, `trigger` value, whether anything usage-shaped rides in it).
- (b) Deny semantics: which mechanism works (exit 2, JSON `decision: "deny"`, or both), and the retry cadence after a deny: does the harness re-attempt on later turns/tool calls, and does it keep re-attempting indefinitely? This is the kill-or-confirm criterion.
- (c) After denials, an allow lets the compaction complete, and SessionStart fires with `source: "compact"` as a command hook (the existing recovery path engages).
- (d) Threshold controls behave as documented: the pct override lowers the trigger; `autoCompactWindow` in settings is honored; note any per-model clamping observed.
- (e) The most recent transcript usage row is readable and usable as the valve signal (field names, position, staleness).

Acceptance: a probe report in the Chapter with each of (a)-(e) marked confirmed or failed, evidence paths named; spec amendments applied inline for anything the probe contradicts (deny mechanism, retry cadence, valve signal). If (b) fails, stop per the Approach's blocker clause.

### 2. The gate: PreCompact hook, checkpoint CLI, tests
Model: fable
New hook `plugins/claude-kit/hooks/kit-compact-gate.js` wired in `hooks.json` as PreCompact with matcher `auto`, plus the checkpoint CLI `plugins/claude-kit/hooks/kit-compact-checkpoint.js`, following the kit-goal precedent of a separate CLI and hook (a shared lib beside `kit-goal-lib.js` is fine if it earns itself). Behavior exactly per the Approach: the single deny state, checkpoint consume-on-allow, plan-path match, `KIT_EXTERNAL_ENGINE` stand-down, usage valve with a named ceiling constant, fail-open on every error path. Checkpoint file: `.kit/compact-checkpoint.json` (project-scoped, gitignored territory).

Deny mechanism and valve signal, as Section 1's probe confirmed them:

- **Deny is exit code 2, never JSON.** The JSON `decision: "deny"` form is inert here; a gate written on it allows every compaction while appearing to work. (The hook sets `process.exitCode = 2` rather than calling `process.exit(2)`, so its stderr note drains before the process ends.)
- **The valve signal is the newest assistant `usage` row in the transcript at the payload's `transcript_path`**, read at fire time. The PreCompact payload itself carries no usage field: its keys are `session_id`, `transcript_path`, `cwd`, `prompt_id`, `hook_event_name`, `trigger`, `custom_instructions`. The consumed figure is `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` off that row, which sits 4 to 6 lines from the transcript's end and is monotonic across a session (32 consecutive samples, zero decreases), so a rising-signal ceiling check is sound. A transcript with no readable usage row means allow, per the fail-open posture.

Tests: at minimum, lock both directions of every gate condition, because a silent wrong-way gate is the expensive failure in each case: deny in the armed-bound-no-checkpoint state and allow in each single-condition negation (no goal, bystander session, checkpoint open, external-engine marker, usage at ceiling, unreadable transcript, unreadable goal state); checkpoint consumption is single-shot (second attempt after an allow is denied again); a checkpoint naming the wrong plan reads as absent; manual trigger never gated. Mirror `test/kit-goal-stop.test.js` fixture patterns.

Acceptance: `./build.ps1` run before the suite (hook edits fail two hook-canary cases until the integrity manifest restamps; the manifest covers every shipped hook file, the new ones included); full suite green against the baseline captured at section start, with this machine's standing exceptions named (two memq-shim env failures on SCOTT-CLAUDE per the backlog, plus the two known flakes) and the delta exactly the new tests.

### 3. Threshold, doctor, and skill wiring
Model: opus
- The lowered trigger ships as `autoCompactWindow` in user settings.json, applied via a doctor `-Fix` offer (the doctor already owns gated machine-state repairs). **The 500000 starting instinct is withdrawn: Section 1 showed the effective trigger is the configured value minus about 35,000, so a configured window larger than the model's real context window pushes the trigger past a point the session can never reach, and auto-compaction simply never fires.** That would leave the gate with nothing to schedule and the whole feature inert. Size the value against the model's real window instead: pick the context level at which compaction should be offered, then add about 35,000.

**The value must also leave a usable denial band.** The gate can only defer a compaction between the trigger (where the harness first offers) and the safety ceiling Section 2 shipped at 140,000 consumed (where the valve stops deferring). Too narrow a band and a chapter cannot close before the valve fires, so the compaction lands mid-chapter anyway and the feature does nothing. On a 200,000-token window, a trigger near 100,000 leaves roughly 40,000 tokens of runway, which is `autoCompactWindow` near **135,000**. Record the chosen value and the arithmetic in the Chapter.
- Doctor check: reports the configured window (INFO when absent), and WARNs when the installed Claude Code predates PreCompact support (reported v2.1.208). It also WARNs when the configured window would put the gate's 140,000-token safety ceiling out of reach, because the ceiling is an absolute count assuming a 200,000-token model window and the hook cannot derive the real one (the PreCompact payload carries no `model` field; only SessionStart does). That is the single direction of this design that is not fail-open: on a smaller window the valve never fires and the gate becomes an unconditional session-killer for the bound session, so the doctor is where it gets caught.
- `skills/executing-work/SKILL.md`: the chapter-close ritual gains the checkpoint CLI line (write the checkpoint after the Chapter is appended and the section's commit model has been honored), and the native-compaction prose gains the boundary-gating sentence: on a gated run, compaction lands at chapter boundaries by design, and mid-chapter denial is the gate working, never a reason to act.
- Docs: `architecture.md` hook wiring section gains the gate; `security-model.md` gains the gate's row (invariant enforced, the accepted risk that a user-writable checkpoint file steers compaction timing, worst case a compaction landing earlier or later than intended, compensating valve, fail-open posture); root `README.md` tree/summary if the hook list appears there.

Tests: the executing-work wording change is behavior-shaping prose; the finishing reviews cover it, and the doctor check gets a check-mode run on this machine as its gate.

Acceptance: doctor check-mode run completes on this machine showing the new check; the skill line names the CLI path exactly; docs greps for the new hook name hit the wired surfaces only.

### 4. Close-out (finishing-work)
Finishing pass: qa-verifier, security review (an enforcement hook plus doctor surgery: not prose-waivable), final adversarial review, docs-curator, then curating-docs archival. Memory: write the probed PreCompact facts to the operator tier (they are harness facts, true machine-wide, same family as `claude-code-hook-payload-facts`); log the effort outcome; run the unstamped adjudication and decay checks per finishing-work.

## Out of Scope

- Reviving the compaction engine, the resume relay, chain mode, or any removed machinery.
- Customizing the native summarizer (not possible) or steering summary content beyond the existing SessionStart recovery.
- An attended `/clear` ritual or boundary nudge for keyboard-present runs (the pain is unattended; revisit only if attended runs start hurting).
- AI OS / Spine engine-side changes (its Dispatch layer is already fresh-per-section; the gate stands down under its marker).
- Gating manual compaction, or gating anything in sessions with no armed kit-goal.

## Operator Verification

- On the next multi-day unattended plan run with the gate live: the scrollback/transcript shows compactions landing immediately after Chapter commits rather than mid-section, and the stuck/circling stretches you observed shorten. A run that wedges near the context limit with compaction denied reopens Section 2 (the valve failed its one job).

## Open Questions

- ~~Denied-auto retry cadence~~ Resolved by Section 1: once per turn, indefinitely, no give-up.
- ~~Valve signal~~ Resolved by Section 1: the newest assistant `usage` row in the transcript, read at fire time. The ceiling **value** remains Section 2's to name in code, sized so a single turn's growth cannot leap the gap to the hard limit (observed turn deltas ranged from about 850 to about 8,300 tokens, and a large tool result can exceed both).
- Whether `autoCompactWindow` is clamped to the model's window above it: **unresolved, and deliberately so.** The probe could not settle it, because context growth in this harness is not a controllable input (two runs with byte-identical reads peaked at 161,618 and 95,534). The question is moot under Section 3's amended sizing rule: a value below the model window is correct whether or not clamping happens, and the risk is asymmetric, since clamping would be harmless while its absence would disable auto-compaction entirely. Do not spend another probe on it.

## Standing Brief Amendments

Folded into every later dispatch brief for this effort.

- **A comment may only name a control that exists.** Section 2's review caught the gate's header claiming a "kit-doctor load-check" covered it when no such check exists (the canary's pass is syntax-only `node --check`). A documented-but-nonexistent control is worse than an undocumented one, because it stops anyone from adding the real thing. Before writing that a check, guard, or test covers something, open the checker and confirm it does.

## Chapters

### Chapter 1 - 2026-08-15
Completed: 1. Probe: PreCompact and threshold semantics, kill-or-confirm
Implemented By: main session (Locus: inline)
Metrics: 0 review rounds (probe section, no code shipped); 0 NEEDS_CONTEXT; 0 escalations; advisor opus (2 consultations, both changed the probe design)
Decisions / Surprises: see the probe report below.
Review Findings: none (no code changed; the deliverable is evidence plus spec amendments)
Stamps: adjudicated 1 surfaced, stamped 2 (`probe-scripts-scratchpad-and-controls` for the scratchpad-path and both-directions-controls discipline the probe ran on, `claude-code-hook-payload-facts` for the `--settings` probe pattern and the command-hook requirement for SessionStart)
Next: 2. The gate: PreCompact hook, checkpoint CLI, tests
Commit Model: Commit-and-Push

**Probe report.** Six headless runs on Claude Code 2.1.233, model haiku, from a scratch cwd (no armed goal there, so the kit's own Stop hook stayed a bystander). Apparatus: a settings JSON passed via `claude -p --settings`, registering one dump-and-decide hook on PreCompact (`auto` and `manual` matchers), PostToolUse, and SessionStart; context driven by reading uniform ~5,000-token filler files one per turn. The PostToolUse registration was the known-fires control: it proved the settings file loaded, so an absent PreCompact would have been a real absence rather than a broken probe.

- **(a) CONFIRMED.** PreCompact fires on the auto trigger. Payload keys: `session_id`, `transcript_path`, `cwd`, `prompt_id`, `hook_event_name`, `trigger` (value `"auto"`), `custom_instructions` (null). Nothing usage-shaped rides in it, which is why the valve has to read the transcript.
- **(b) CONFIRMED, and this is the kill-or-confirm criterion passing.** `process.exit(2)` denies. The harness then re-attempts once per assistant turn, indefinitely, with no give-up: 15 consecutive denials, hook sequence 6 through 34 alternating one-for-one with PostToolUse, ending only when the session hit the model's hard limit and the run died with `Prompt is too long` (exit 1) at a last-read consumption of 176,653 tokens. The veto is a scheduler. The same run is the live proof that the safety valve is mandatory.
- **(b') KILLED, and it contradicts the researched fact.** A hook writing `{"decision": "deny"}` and exiting 0 does **not** deny. That run fired PreCompact once and then SessionStart with `source: "compact"`, the allow signature, at 64,016 consumed. The hook's own dump records `mode: "jsondeny"`, so it did emit the JSON and the harness ignored it. Section 2 must deny by exit code only; a gate built on the JSON form would allow every compaction while reading as correct.
- **(c) CONFIRMED.** After an allow, the compaction completes and SessionStart fires as a command hook with `source: "compact"`, carrying an added `model` field. The `session_id` is **unchanged** across the compaction, which is the property the kit-goal leash binding depends on.
- **(d) CONFIRMED with an amendment.** `autoCompactWindow` in the settings file is honored. The effective trigger is the configured value minus a roughly 35,000-token reserve rather than a percentage of it: configured 100,000 fired at 63,869 and 64,016 across two runs, configured 150,000 fired at 116,429. Slope is about 1.0 and the reserve is about 33,600 to 36,100. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=20` produced no observable effect: a run carrying it climbed to 161,618 consumed, roughly 81 percent of the model window, with no fire. Per-model clamping above the window went unresolved and is closed by avoidance in Open Questions.
- **(e) CONFIRMED.** The valve signal is readable from inside the hook at fire time. The newest assistant `usage` row sits 4 to 6 lines from the transcript's end; consumption is `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. Across 32 consecutive samples in one session it never decreased, so a rising-signal ceiling check is the right shape. Per-turn growth was not uniform, ranging from about 835 to about 8,300 tokens, so Section 2's ceiling needs headroom for a turn far larger than the average.

Queued for Section 4's operator-tier memory write (harness facts, machine-wide, same family as `claude-code-hook-payload-facts`): PreCompact denies by exit 2 only; the JSON form is inert; the trigger equals the configured window minus about 35,000; `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` does not work here; `session_id` survives a compaction.

Carried into Section 3: the archived `claude-kit_compaction-tuning_spec_v1.md` predates this effort and may already have settled a window value or deliberately removed one. Read it before choosing the number, so this plan is not a silent move back across an earlier decision.

### Chapter 2 - 2026-08-15
Completed: 2. The gate: PreCompact hook, checkpoint CLI, tests
Implemented By: implementer-fable (dispatched with the fable model override from this Opus-led session, per the plan's `Fable Spend` header), one review round plus one fix round
Metrics: 1 review round (adversarial + blind + security, the pair at fable per the reviewer-tier rule, security at its default); 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises: see below.
Review Findings: 1 Major addressed (the safety ceiling), 10 Minors addressed, 3 Minors declined with reasons, 1 Minor recorded unfixed. Detail below.
Stamps: adjudicated 0 surfaced by `memq unstamped`, stamped 1 (`hook-edits-require-rebuild`, which put the `./build.ps1`-before-the-suite step into the dispatch brief and saved a wasted full pass)
Next: 3. Threshold, doctor, and skill wiring
Commit Model: Commit-and-Push

**What shipped.** `kit-compact-gate.js` (the PreCompact hook), `kit-compact-lib.js` (checkpoint path and read/write/clear, single-sourced so the writer and reader cannot drift), `kit-compact-checkpoint.js` (the CLI, subcommands `open | clear | status`), the `PreCompact` block in `hooks.json` with matcher `auto`, and `test/kit-compact-gate.test.js`. `kit-goal-lib.js` changed by exactly one line, adding `normalizePlanArg` to its exports so the checkpoint writer can validate through the sibling's rule rather than its own.

**Gate: 730 tests, 728 pass, 2 fail**, against a baseline of 694/692/2 captured on this tree immediately before dispatch. The 2 failures are identical in both runs: the standing `test/memq-shim.test.js` short-path failures on this machine. Delta is exactly the 36 new tests, all passing. Run independently by the orchestrator, not taken from the implementer's report.

**The live gate, which the suite cannot reach.** A green unit suite proves the hook's own exit code, never that the harness honors it. Four throwaway headless sessions on Claude Code 2.1.233, driving real context growth against the real hook file:

- Armed, bound, no checkpoint: **19 consecutive real auto-compaction attempts denied, zero compactions landed.**
- Checkpoint opened mid-session by the real CLI: the **first** attempt allowed, the compaction landed (SessionStart fired with `source: "compact"`), and the checkpoint was consumed. Session id identical either side of the compaction, which is the property the leash binding depends on.
- Orphan checkpoint (right plan, wrong session): denied throughout and never consumed, confirming the session-binding fix.
- **The safety valve firing, observed live**: 20 denials climbing from 56,058 to 139,827 consumed, then an allow at 141,314, the first reading past the 140,000 ceiling. The run ended on `Reached max turns`, not a context death, which is the whole difference from Section 1's valve-less probe that died at the hard limit.

**Decisions / Surprises.**

- **The safety ceiling moved 160,000 to 140,000**, the round's one Major. The original number was sized against average turn growth, but two mechanics compound against that: the valve reads a one-turn-stale figure (the newest assistant usage row reflects the previous turn's request), and a denied attempt is only re-evaluated once per turn, so the real margin from a deny decision to death is two turns. Independently confirmed from Section 1's data, where the harness fired its trigger while the newest usage row still read 63,869 against a threshold near 65,000, so the harness's view of context runs ahead of the last row. Arithmetic now in the constant's comment: 185,000 observed death, minus two 20,000-token large turns, is 145,000, rounded down.
- **Checkpoints are session-bound.** Both reviewers found that a checkpoint naming the same plan, orphaned by a crash, would open the gate for the resumed session. The checkpoint now records the goal's `boundSession` at write time and the gate requires it to match, so a re-bind retires the orphan. A checkpoint with no such field reads as absent, which handles any older file.
- **Deliberate deviation from the spec's wording, kept:** the spec said `process.exit(2)`; the code sets `process.exitCode = 2` so the stderr note drains before the process ends (`process.exit` can truncate an async pipe write). Functionally identical for the verdict and better on the note. The spec's Context bullet now states the contract as "exit code 2" rather than naming the API call.
- **The one direction of this design that is not fail-open, now named in code:** the ceiling is an absolute token count assuming a 200,000-token model window, and the PreCompact payload carries no `model` field to derive the real one. On a smaller window the valve would never fire and the gate would become an unconditional session-killer. Stated as an explicit assumption beside the constant, and routed to Section 3 as a doctor WARN.
- **A false coverage claim, caught by two reviewers independently:** the gate's header claimed a "kit-doctor load-check" verified its dependencies resolve. No such check exists (the canary's pass is syntax-only `node --check`, and the gate is not in its behavior-probe list). Corrected, and generalized into the Standing Brief Amendments block above.

**Minors declined, with reasons.** The checkpoint CLI has no `require.main` guard: it matches the existing `kit-goal.js` convention and nothing requires it, so consistency wins over a hypothetical future load-check. The clause-5 read-then-delete is not atomic: unreachable while the writer and the gate serialize through one session, so it carries a comment naming that assumption instead of a lock. A directory junction planted at `.kit` could redirect the checkpoint delete: bounded to that one filename and requires tree write access that already breaks the goal state.

**Minor recorded unfixed.** The CLI's `status` flags a checkpoint the gate would ignore only when the *plan* mismatches, not when the *session* does, so a crash-orphaned checkpoint reports as open. Display only; the gate itself is correct and tested both directions. The drift-free fix is a shared match predicate in `kit-compact-lib.js` used by both the gate and the CLI, which is a refactor of freshly reviewed matching logic and disproportionate to a status-line gap. Carry it to finishing-work as a candidate.
