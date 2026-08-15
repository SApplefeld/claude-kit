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

Native facts this design stands on (from the claude-code-guide research pass against hooks.md, env-vars.md, context-window.md at v2.1.232+, to be re-verified by Section 1's live probe before anything ships):

- Nothing can start a compaction on demand: not the model, not a hook, not the SDK. `/compact` and `/clear` are user-only. The only native lever is the PreCompact hook's power to veto a pending compaction (exit 2 or JSON `decision: "deny"`), with separate `auto` and `manual` matchers.
- The auto-compact trigger point is configurable: `autoCompactWindow` in settings.json (documented range 100,000-1,000,000, auto-tuned per model by default), `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, and `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (a percentage that can only lower the trigger, never raise it).
- The kit's post-compaction recovery already ships: session-start.js has a `source === 'compact'` branch that re-grounds a session from the plan doc, and the summarizer natively keeps recent exchanges and recently read files.
- Probed on this machine (operator memory `claude-code-hook-payload-facts`): every hook payload carries `session_id` and `transcript_path`; SessionStart must be wired as a `command` hook (the `http` transport silently never delivers it); Claude Code here is 2.1.233, above the reported v2.1.208 PreCompact minimum.

## Goal

On unattended plan runs, native auto-compaction lands at chapter boundaries instead of at an arbitrary late point mid-work. A veto plus a low threshold is a scheduler: the auto-compact window is lowered so the harness volunteers to compact early and often, and a kit PreCompact hook denies auto-compaction mid-chapter and stands aside once a chapter has closed, so the compaction lands on the first attempt after the boundary. Multi-day runs stop spending hours in the degraded high-context regime, and each chapter starts from a freshly re-grounded context at lower cost per call.

## Approach

**The gate is a strict no-op except in one precisely legible state.** It denies an `auto` compaction only when all of the following hold: a kit-goal is armed in the project, the compacting session is the leash-bound session (payload `session_id` equals the binding in `.kit/goal-state.json`), no boundary checkpoint is open, the session is not under `KIT_EXTERNAL_ENGINE` (Spine workers are fresh-per-section and never need the gate), and the latest usage read from the transcript tail is legible and below the safety-valve ceiling. Any other state, any read error, any ambiguity: allow. Manual `/compact` is never gated. This is the same fail-open posture as kit-goal-stop: the gate must never trap a session against the context limit, and a forgotten checkpoint degrades to "compaction lands late mid-chapter" (the status quo), never to a wedged run.

**The checkpoint is the boundary signal.** The executing-work chapter-close ritual writes it via a small CLI (same shape as `kit-goal.js`), recording the armed plan path. The PreCompact hook consumes (deletes) the checkpoint at the moment it allows, so the next mid-chapter attempt is denied again. A checkpoint naming a different plan than the armed one is treated as absent, so a stale file from a prior run cannot open the gate.

**The safety valve caps the failure mode nothing else can.** Sustained denial with a chapter that never closes would otherwise climb to the hard limit ("prompt is too long" failures exist there per the v2.1.229 changelog). The hook reads the most recent usage row from the transcript at `transcript_path`; at or above a named ceiling constant it allows compaction regardless of the checkpoint. If usage cannot be read, the gate allows rather than denying blind.

**The kit summarizes nothing.** The native summarizer runs unmodified (it is not customizable), and re-grounding after the compaction is the existing plan-doc recovery. The whole build is one hook, one small CLI, one settings value, and prose.

**The load-bearing unknown, named:** the design assumes a denied auto-compaction re-attempts promptly and repeatedly afterward. If Section 1's probe shows the harness tries once per threshold-crossing and gives up, the veto is not a scheduler and the gate design is dead. That finding is a true blocker, not capacity: stop after Section 1 and bring the finding and the fallback options (threshold-only, or threshold plus a PreCompact-informed nudge) to Scott before touching Sections 2-3.

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
New hook `plugins/claude-kit/hooks/kit-compact-gate.js` wired in `hooks.json` as PreCompact with matcher `auto`, plus the checkpoint CLI `plugins/claude-kit/hooks/kit-compact-checkpoint.js`, following the kit-goal precedent of a separate CLI and hook (a shared lib beside `kit-goal-lib.js` is fine if it earns itself). Behavior exactly per the Approach: the single deny state, checkpoint consume-on-allow, plan-path match, `KIT_EXTERNAL_ENGINE` stand-down, usage valve with a named ceiling constant, fail-open on every error path. Checkpoint file: `.kit/compact-checkpoint.json` (project-scoped, gitignored territory). Deny mechanism and valve signal as Section 1 confirmed them.

Tests: at minimum, lock both directions of every gate condition, because a silent wrong-way gate is the expensive failure in each case: deny in the armed-bound-no-checkpoint state and allow in each single-condition negation (no goal, bystander session, checkpoint open, external-engine marker, usage at ceiling, unreadable transcript, unreadable goal state); checkpoint consumption is single-shot (second attempt after an allow is denied again); a checkpoint naming the wrong plan reads as absent; manual trigger never gated. Mirror `test/kit-goal-stop.test.js` fixture patterns.

Acceptance: `./build.ps1` run before the suite (hook edits fail two hook-canary cases until the integrity manifest restamps; the manifest covers every shipped hook file, the new ones included); full suite green against the baseline captured at section start, with this machine's standing exceptions named (two memq-shim env failures on SCOTT-CLAUDE per the backlog, plus the two known flakes) and the delta exactly the new tests.

### 3. Threshold, doctor, and skill wiring
Model: opus
- The lowered trigger ships as `autoCompactWindow` in user settings.json, applied via a doctor `-Fix` offer (the doctor already owns gated machine-state repairs); value informed by Section 1, starting instinct 500000. Record the chosen value and mechanism in the Chapter.
- Doctor check: reports the configured window (INFO when absent), and WARNs when the installed Claude Code predates PreCompact support (reported v2.1.208).
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

- Denied-auto retry cadence: the kill-or-confirm unknown; Section 1 owns it.
- Valve ceiling value and signal: Section 1 informs; the constant is named in code either way.
- Whether `autoCompactWindow` is clamped per model in a way that changes the chosen value.

## Chapters

(Appended by executing-work as sections complete.)
