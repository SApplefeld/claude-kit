# Interactive compaction deferral: hold auto-compaction to the ceiling in hands-on sessions

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-16

## Related

- `../archive/claude-kit_boundary-gated-compaction_spec_v1.md` (archived): built the PreCompact gate this plan extends. Its probe evidence is load-bearing here: a deny is exit code 2 alone (the JSON form is inert), a denied auto attempt is re-offered once per assistant turn indefinitely, the payload carries `session_id`, `transcript_path`, `cwd`, `trigger`, and no usage field, and the effective trigger is the configured `autoCompactWindow` minus roughly 35,000 tokens. (One-way pointer; that plan is archived and immutable.)
- `../archive/claude-kit_compaction-window-retune_spec_v1.md` (archived): re-sized the gate's constants for the roughly 1,000,000-token window plan sessions run on: window 300,000, safety ceiling 800,000, checkpoint bound 10 minutes. This plan changes the window value again (to 285,000) and reuses the 800,000 ceiling unchanged as the interactive deferral bound. (One-way pointer.)
- `docs/backlog.md`, item "Turn boundary-gated compaction on, then judge it on a real run (2026-08-15)": an operator-only item whose doctor offer this plan re-tunes. Section 3 updates the value that item names; the item itself stays active, since its real-run judgment is still pending.

## Context

Decided 2026-08-16 with Scott. The boundary-gated compaction feature works as designed on leashed plan runs: the low `autoCompactWindow` makes the harness offer compaction early, and the gate schedules the offers onto chapter boundaries. The pain is the side effect on every other session: the window is machine-global, so an interactive brainstorming session inherits the same early trigger, the gate stands aside (no goal armed is an unconditional allow today), and compaction lands mid-discussion near 265,000 consumed.

The agreed shape: a session where the operator is interacting directly (no kit-goal, no native `/goal`, no `/loop`) defers auto-compaction until the existing 800,000-token safety ceiling. A session driven by any of those three automation instruments keeps the early trigger, which Section 3 moves to roughly 250,000 consumed (window 285,000). Decisions recorded from that conversation:

- **One ceiling, not two (decided 2026-08-16).** The interactive deferral bound is the existing `SAFETY_CEILING_TOKENS` at 800,000, unchanged. A 935,000 ceiling was proposed and withdrawn: the roughly 35,000-token reserve belongs to the harness's window setting, not to the gate's ceiling comparison (the gate compares a raw consumed-token reading), and the gate's margin arithmetic (a one-turn-stale reading, re-evaluated once per turn, so two turns of growth between a deny and the hard limit) was sized for roughly 200,000 tokens of headroom. 935,000 leaves about 65,000, which two heavy tool-result turns can consume, and the failure there is the session dying on "Prompt is too long", the one outcome the valve exists to prevent.
- **The automation set is kit-goal, native `/goal`, and `/loop` (decided 2026-08-16).** If none is in effect, the operator is interacting with the session directly and mid-discussion compaction is the harm; if any is, the session should compact early and regularly.
- **The trigger for automated sessions moves to about 250,000 consumed (decided 2026-08-16):** `autoCompactWindow` 300,000 becomes 285,000, using the measured window-minus-35,000 mapping. That mapping is the kit's own measurement, not a documented contract (official docs name no reserve; a doc-research pass on 2026-08-16 found only a Sonnet 5 default implying roughly 33,000), so the offer point is an estimate that can drift a few thousand tokens with a harness update.

Detection facts this design stands on:

- Native `/goal` persists no documented on-disk state (doc-researched 2026-08-16 against goal.md: resumption is described, the mechanism is private), but it writes its own state into the transcript. Section 1 pinned a `goal_status` attachment entry carrying `met`, `condition`, and optionally `sentinel`, `reason`, and completion metrics; it is written at arming and at every stop evaluation, and `met` is the field that classifies. That surface is better than the command line the plan was designed around, because it distinguishes a goal that finished from one still running. The command line remains the second surface, read the way the channels broker reads it (`D:\sapplefeld-channels\broker\tail.ts`, the `GOAL_COMMAND` reader): `<command-name>/goal</command-name>` beside `<command-args>…</command-args>`, first tag wins, non-greedy, `clear` being the observable end. Both markup shapes are undocumented-but-observed, the same class as the gate's other version-pinned facts.
- `/loop` and ScheduleWakeup: the scheduled-task list is documented as living in the project's `.claude` directory, format undocumented. ScheduleWakeup is a tool the model calls, so its invocations should appear in the transcript as ordinary tool_use entries (likely, not doc-confirmed); a dynamic loop ends via a ScheduleWakeup call carrying `stop: true`. Section 1 pins the real shapes.
- The PreCompact payload carries `transcript_path`, and the gate already reads that file at fire time (the valve's usage read). The detection scan is pure subprocess work: no model call, no token spend, and it runs only when a compaction is offered, which below the trigger is never.

## Goal

An interactive session (no kit-goal armed and bound, no native `/goal` in effect, no `/loop` in effect) is not compacted at the early trigger: the gate defers auto-compaction until consumption reaches the existing 800,000-token safety ceiling, so a brainstorm runs roughly 3x longer before compaction touches it. Automated sessions keep the early trigger, now at about 250,000 consumed. Manual `/compact` is never gated, armed-run boundary scheduling is unchanged, and every error path still allows, so no session can be wedged by this change.

## Approach

**The gate gains a third verdict path, and its fail direction is allow.** Today the gate is: deny only in one precisely legible armed-run state, allow everything else. It becomes a three-state classifier evaluated per offer, cheapest check first:

1. Non-auto trigger, or `KIT_EXTERNAL_ENGINE=1`: allow, unchanged.
2. Kit-goal armed and this session bound: the existing boundary-gated path, unchanged (checkpoint clauses, then the valve).
3. Otherwise (no goal armed, or armed for another session): scan the transcript at `transcript_path` for automation evidence. Native `/goal` in effect, or `/loop` in effect: allow (the native trigger governs, compaction lands near 250,000). Neither in effect: deny while the valve reading is legible and strictly below `SAFETY_CEILING_TOKENS`; allow at or above it, and allow on an illegible reading.

Any read error, parse error, oversized transcript, or ambiguity anywhere in the new path: allow. The failure direction of every defect is "compaction lands at the early trigger", which is today's behavior, never a wedged session. This is the same posture as the existing clauses and it is what makes the change safe to ship: the deny is the new behavior, so every error must fall back to allow.

**Detection semantics: newest evidence wins.** Section 1 pinned the transcript shapes; these are the amended rules it produced. A single ordered pass over the scanned text takes the last matching evidence of each kind.

For `/goal`, two evidence surfaces, newest of either wins:

- A **`goal_status` attachment** (a `type: "attachment"` entry whose `attachment.type` is `"goal_status"`), which the goal system writes itself. `met: false` means in effect; `met: true` means the goal was satisfied and auto-cleared, so it is not. The `sentinel` and `reason` fields are carried but decide nothing: only `met` classifies.
- A **`/goal` command line**, read exactly as the leash's own `userCommandArgsInclude` reads one: `<command-args>` trimmed and case-folded to `clear` means not in effect, any other argument means in effect.

For `/loop`: a `<command-name>/loop</command-name>` command line means in effect; a ScheduleWakeup tool_use carrying `input.stop === true`, newer than that line, means not. Every iteration of a dynamic loop re-writes its own `/loop` command line, so the evidence refreshes continuously and the terminal `{"stop": true}` reliably lands after the last of them.

Two shapes in that evidence are traps, both observed in real loop transcripts:

- **Tag order is not fixed.** A `/loop` line writes `<command-message>` *before* `<command-name>`, where a `/goal` line writes `<command-name>` first. Each tag must be matched by its own independent regex, the way the broker and `userCommandArgsInclude` already do; a positional or single-pass parse breaks on one of the two.
- **A continuing ScheduleWakeup carries the loop's prompt verbatim**, so its `input.prompt` contains the literal text `/loop …`. That is why the command-line test matches the full `<command-name>/loop</command-name>` tag and never a bare `/loop` substring, which would read every wakeup as a fresh invocation.

**One residual accepted, and one the probe retired.** A `/loop` that simply stops being continued (no `stop: true` ever written) classifies as automated indefinitely: safe, since it only keeps today's early trigger. The residual this plan expected to accept alongside it is gone: a native goal that completes naturally *is* distinguishable, because the goal system writes a `met: true` `goal_status` record when it clears. A session whose goal finished therefore reclassifies as interactive and earns the deferral, which is strictly better than the behavior this plan set out to ship.

**Scan cost and the read shape.** The scan runs only when an offer arrives (never below the trigger) and is subprocess file I/O: a line-level string prefilter before any JSON.parse, so a multi-megabyte transcript costs milliseconds and zero tokens.

The read is head-plus-tail, reusing `kit-goal-stop.js`'s existing `readTranscriptCapped` rather than the gate's own tail-only reader, because the two evidence classes sit at opposite ends of a long session: a `/loop` invocation is the first user line of its session (the harness's own loop detector reads exactly that position), while `goal_status` records are written at every stop and so land in the tail. A tail-only read would miss `/loop` entirely on any session past the cap. Bounded memory comes free with that reader's caps, and an unreadable or non-regular file returns empty, which classifies as no evidence.

Prefilter strings must be chosen structurally, not by name. `ScheduleWakeup` as a bare substring is a trap: it appears in the tool listing that rides in system-prompt-shaped entries, so it hit nine transcript files on this machine against zero real invocations. The tool_use check is `entry.type === 'assistant'` with a content block whose `type` is `tool_use` and whose `name` is `ScheduleWakeup`.

If measurement during Section 2 shows the scan slow enough to matter, the sanctioned optimization is a scan cursor persisted in `.kit/` (byte offset plus verdict, keyed by session id), making later fires incremental; do not build it speculatively.

**The deny is legible as itself.** The interactive deferral writes its own fixed stderr string, distinct from the boundary-deferral note, carrying no data from any input, so a transcript reader can tell which deferral fired.

**Behavior this deliberately flips.** The existing tests lock "no goal armed" and "bystander session" as unconditional allows; both become deny-below-ceiling states (absent automation evidence). This is the point of the plan, not drift: update those expectations and say so in the Chapter.

## Sections of Work

### 1. Probe: /goal and /loop transcript shapes, pin or narrow
Model: opus
Locus: inline
Reuse the probe pattern the operator memories record (`claude-code-hook-payload-facts`, `probe-scripts-scratchpad-and-controls`): cheap headless or short interactive sessions, artifacts under the session scratchpad or gitignored `.kit/`, never `docs/`. Establish, with captured transcript excerpts as evidence:

- (a) The `/goal` command markup shape: a `/goal <condition>` and a `/goal clear` typed in a session produce user lines matching the broker's readers (`<command-name>/goal</command-name>`, `<command-args>`, first-tag-wins). Capture the exact lines. Also capture what a `/goal` session's evaluator verdicts look like in the transcript, and record whether natural completion is distinguishable (expected: it is not; confirm and move on).
- (b) The `/loop` shapes: what a `/loop` invocation writes as a user line, what a ScheduleWakeup tool_use entry looks like (field names, where `stop: true` rides), and what an ended loop leaves as the newest evidence. This is the kill-or-narrow criterion: if `/loop` leaves no legible transcript evidence, narrow the automation set to kit-goal plus `/goal`, record the gap as a backlog item (loops would defer to the ceiling: safe, suboptimal), and proceed.
- (c) That the scan's prefilter strings appear only on the lines the rules want (false-positive check: the model *mentioning* `/goal` in prose, or this plan's own text being read into a session, must not classify; the command markup is what distinguishes typed commands from quoted text, per the broker's precedent).

Acceptance: a probe report in the Chapter with (a)-(c) each pinned or narrowed, evidence paths named, and the Approach's detection rules amended inline where the shapes differ.

### 2. The gate: interactive deferral clause and tests
Model: fable
Extend `plugins/claude-kit/hooks/kit-compact-gate.js` with the three-state verdict per the Approach, and extend `test/kit-compact-gate.test.js`. The armed-bound path and its clauses are untouched; the new code replaces today's unconditional allows for the no-goal and bystander states. Detection helpers may live in the gate or in `kit-compact-lib.js` if shared with tests; keep the fail-open wrapper the single exit path. The ceiling constant is reused, not duplicated; the interactive deny writes its own fixed stderr string.

Tests: at minimum, lock both directions of every new condition, because a silent wrong-way gate is the expensive failure in each: interactive deny below the ceiling and allow at it; allow on `/goal` in effect and deny after `/goal clear`; allow on an active loop and deny after its stop evidence; allow on unreadable, empty, and oversized transcripts; allow on non-auto trigger and under the external-engine marker; the armed-bound path's existing expectations unchanged; and the two flipped expectations (no-goal, bystander) updated with a comment naming this plan. Fixtures build real transcript lines from Section 1's captured shapes, not hand-invented approximations.

Live validation, because a green suite proves the hook's exit code and not the harness's behavior: one throwaway session with a scratch copy of the gate whose ceiling constant is patched low (the probe pattern with `--settings`), driving real context past the trigger: denials observed each turn with the interactive note, then an allow and a landed compaction at the first reading past the patched ceiling; and one session with `/goal` set observing the offer allowed at the native trigger. Do not drive a real session to 800,000 to prove the constant; the patched-constant run proves the mechanism and the constant is proven by inspection plus the suite.

Acceptance: `./build.ps1` run before the suite (hook edits fail two hook-canary cases until the integrity manifest restamps); full suite green against the baseline captured at section start, this machine's standing exceptions named, delta exactly the new and updated tests; the live validation observations recorded in the Chapter.

### 3. Window retune, doctor, and docs
Model: opus
- `plugins/claude-kit/doctor/doctor.ps1`: `$recommendedWindow` 300000 becomes 285000. Every displayed number derives from it already; confirm the derivation renders sensibly (trigger 250,000, band to the 800,000 ceiling).
- `plugins/claude-kit/doctor/install-compact-window.ps1` and `test/compact-window-install.test.js`: update any restatement of the value; the installer must offer 285,000.
- Grep the tree for `300000`, `300,000`, `265,000`, and `265000` outside `docs/archive/` and update current-state surfaces: `docs/backlog.md`'s boundary-gated operator item (the offered value it names), and any `architecture.md` / `security-model.md` restatements.
- `docs/architecture.md` and `docs/security-model.md`: the gate's description changes from "denies in exactly one state" to the three-state shape: boundary-gated when armed and bound, deferred-to-ceiling when interactive, native-trigger when `/goal` or `/loop` automation is detected; the detection reads undocumented-but-observed transcript shapes and every misread degrades to the early-trigger status quo; the one not-fail-open direction (the ceiling's window assumption) is unchanged and its disclosure stands.
- A machine that already applied 300,000 needs a doctor `-Fix` re-run to move to 285,000; the doctor already reports a mismatch between configured and recommended, so no new check is needed. Confirm that mismatch report actually fires for 300,000-vs-285,000 and fix it if it only fires on absence.

Tests: the doctor value change gets a check-mode run on this machine; the installer test covers the new value both directions (offers 285,000; does not report an applied 300,000 as current).

Acceptance: doctor check-mode run completes showing the new recommendation; greps for the old values hit only `docs/archive/` and Chapters; the two docs describe the three-state gate.

### 4. Close-out (finishing-work)
Finishing pass: qa-verifier, security review (an enforcement-hook change: not prose-waivable), final adversarial review, docs-curator, then curating-docs archival. Memory: write the pinned `/goal` and `/loop` transcript shapes to the operator tier (harness facts, machine-wide, same family as `claude-code-hook-payload-facts`); log the effort outcome; run the unstamped adjudication and decay checks per finishing-work.

## Out of Scope

- Gating manual `/compact`, or changing the armed-run boundary scheduling in any way.
- A second ceiling constant or per-mode ceilings (decided 2026-08-16: one shared 800,000).
- The scan-cursor optimization, unless Section 2's measurement demands it.
- Detecting native `/goal` natural completion, or a loop that ends without stop evidence (accepted residuals, named in the Approach).
- Reading the undocumented `.claude` scheduled-task file (the transcript is the detection surface; the file is a fallback only if Section 1 narrows).
- Session-limit recovery (its own plan: `claude-kit_stop-failure-recovery_spec_v1.md`).

## Operator Verification

- A long hands-on brainstorm passes 265,000 consumed without a compaction and keeps its full context; if one ever runs to the ceiling, the compaction lands near 800,000. A mid-discussion compaction at the early trigger in a session with no goal and no loop reopens Section 2.
- An armed plan run still compacts at chapter boundaries, now offered from about 250,000. Mid-chapter compactions returning reopens Section 3 (the window value) or Section 2 (a regression in the armed path).
- A `/goal`- or `/loop`-driven session compacts near 250,000 rather than deferring. One that visibly defers to the ceiling means detection missed it: capture the transcript and reopen Section 2.

## Open Questions

- Whether `/loop` leaves legible transcript evidence in both its forms (interval and dynamic): Section 1's kill-or-narrow criterion, resolved there.
- Whether the doctor's configured-vs-recommended report fires on a value mismatch or only on absence: checked and fixed if needed in Section 3.

## Chapters

### Chapter 1 - 2026-08-16
Completed: 1. Probe: /goal and /loop transcript shapes, pin or narrow
Implemented By: main session (inline, per the section's Locus)
Metrics: review rounds 0 (probe section, no code changed); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: (a), (b), and (c) all pinned; nothing narrowed, and the kill-or-narrow criterion on `/loop` passed outright. Three results changed the design, all recorded inline in Context and Approach above.

**(a) `/goal`.** The command markup is confirmed live from this session's own transcript (line 16): a `type: "user"` entry, `message.content` a plain string, carrying `<command-name>/goal</command-name>`, `<command-message>`, and `<command-args>`, matching the channels broker's readers exactly. The surprise is a better surface the plan did not know existed: the goal system writes its own **`goal_status` attachment** (`type: "attachment"`, `attachment.type === "goal_status"`), 39 of them across 9 real sessions in three shapes: `{met: false, sentinel: true, condition}` at arming, `{met: false, reason, condition}` at each stop evaluation, and `{met: true, reason, condition, iterations, durationMs, tokens}` when the goal is satisfied and auto-clears. **This retires an accepted residual: natural completion IS distinguishable**, against the plan's stated expectation that it would not be, so a session whose native goal finished now reclassifies as interactive and earns the deferral. `sentinel` was checked and decides nothing (one real record carries `met: true, sentinel: true`, written at a stop); `met` classifies alone.

`/goal clear` has never been typed on this machine (0 instances across 1,262 local transcripts), so its `<command-args>clear</command-args>` shape stays **inferred** from the invariant markup rather than confirmed. It fails safe: an unrecognized clear leaves the newest evidence at `met: false`, the session stays classified automated, and the outcome is today's early trigger.

**(b) `/loop`.** Confirmed twice over. First from the harness itself: `claude.exe` contains its own `/loop` transcript detector (the function computing `isLoopSession`), which keys on the literal `<command-name>/loop</command-name>` and ships these exclusions, all adopted here: skip a line containing `"tool_result"`, skip `isMeta === true`, skip `isCompactSummary === true`, skip array content holding a tool_result block, prefilter on `"type":"user"` tolerating `"type": "user"`. Then from real runs in the NEO VM corpus the operator supplied mid-section (`\\tsclient\S\Transcripts`), which this machine could not have produced: 0 real ScheduleWakeup invocations existed locally. One babysitter session (`bf62f5c5`, ai-os) carries 23 `/loop` command lines and 24 ScheduleWakeup tool_use blocks, confirming `{type: "tool_use", name: "ScheduleWakeup", input: {delaySeconds, noop, prompt, reason}}` while continuing and exactly one terminal `{"stop": true}`. **The newest-wins rule is confirmed against the real end-of-loop sequence**: the last `/loop` line is at 1148, the `stop: true` at 1154, and the session then continues as ordinary interactive work to line 1292, which is precisely the case the rule must classify correctly.

Two traps that corpus exposed, both now written into the Approach: `/loop` emits `<command-message>` *before* `<command-name>` where `/goal` emits them the other way (so each tag needs its own regex), and a continuing ScheduleWakeup carries the loop prompt verbatim, so `input.prompt` contains a literal `/loop` that a bare-substring test would misread as a fresh invocation.

**(c) False positives.** Confirmed live and genuinely dangerous. **This plan doc itself contains `<command-name>/goal</command-name>` in its Context section**, so reading it planted the literal in a tool_result line of this very transcript (line 21); the broker source planted a second (line 98). Every false positive observed was either `type: "assistant"` or a user line carrying `toolUseResult` with array content holding a tool_result block, so the harness's own exclusions above are sufficient. A second prefilter trap: bare `"ScheduleWakeup"` matched 9 local files against 0 real invocations, because the tool listing rides in system-prompt-shaped entries, so the test must be structural (`type: "assistant"` plus a `tool_use` block named `ScheduleWakeup`) and never a substring. Residual accepted: an operator pasting the markup as a plain typed prompt classifies as automated, which is today's early trigger.

**Bonus finding, load-bearing for the next plan.** A slash command passed to `claude -p` does **not** execute: probed directly, `-p "/goal clear"` arrived as prose (the transcript's user line reads `C:/Program Files/Git/goal clear`, Git-Bash path mangling included) and wrote no command markup. That settles `claude-kit_stop-failure-recovery_spec_v1.md` Section 1(c) in advance: its resume prompt cannot rely on a `/kit-goal` slash command and must instruct the arm CLI instead. Also observed: a queued slash command lands first as a `type: "queue-operation"` entry carrying raw `content` with no markup, which a markup-keyed reader correctly ignores.

**Approach amendments applied inline:** the Context bullet on `/goal` detection, the whole "Detection semantics" block, the residuals paragraph, and the scan-cost bullet (now specifying head-plus-tail via `kit-goal-stop.js`'s existing `readTranscriptCapped`, because `/loop` evidence starts at the head while `goal_status` lands in the tail, and the gate's own reader is tail-only).

**Design note carried into Section 2:** `kit-goal-stop.js` already owns `readTranscriptCapped`, `stripLocalCommandOutput`, and `userCommandArgsInclude`, which are most of what the new detection needs. Local-command stripping is not optional here: this session's line 17 is a `<local-command-stdout>` echo of the goal condition, exactly the shape that reader exists to neutralize. Section 2 extracts those helpers into `kit-compact-lib.js` and has both hooks import them rather than growing a second, subtly different copy, which is this repo's named characteristic defect.
Review Findings: none (no code changed; the section's output is evidence and spec amendments)
Stamps: adjudicated 3, stamped 2 (`probe-scripts-scratchpad-and-controls` for the scratchpad-path and controls discipline this probe followed, `claude-code-hook-payload-facts` for the `--settings` probe pattern and transcript-location facts); skipped `hook-edits-require-rebuild` (no hook file was edited this section)
Next: 2. The gate: interactive deferral clause and tests
Commit Model: Commit-and-Push

