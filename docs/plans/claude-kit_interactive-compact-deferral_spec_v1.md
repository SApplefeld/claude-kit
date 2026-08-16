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

- Native `/goal` persists no documented on-disk state (doc-researched 2026-08-16 against goal.md: resumption is described, the mechanism is private). The working detection precedent is the channels broker (`D:\sapplefeld-channels\broker\tail.ts`, the `GOAL_COMMAND` reader): a slash command the operator types lands in the transcript as a user line carrying `<command-name>/goal</command-name>` beside `<command-args>…</command-args>`, first tag wins, non-greedy, and `/goal clear` is the observable end. That markup is itself an undocumented-but-observed harness shape, the same class as the gate's other version-pinned facts.
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

**Detection semantics: newest evidence wins.** For `/goal`: the newest user line carrying the `/goal` command markup decides; arguments other than `clear` mean in effect, `clear` means not. For `/loop`: the newest loop-relevant evidence decides; a `/loop` command or a ScheduleWakeup tool_use without `stop: true` means in effect, a ScheduleWakeup with `stop: true` newer than both means not. Section 1 pins the exact transcript shapes these rules read; the rules themselves are the contract, amendable on probe contact with the delta flagged in the Chapter.

**Two accepted residuals, named rather than hidden.** First, a native goal that completes naturally leaves no command line, so a session whose goal finished still classifies as automated and keeps the early trigger; that is today's behavior for every session and costs nothing new. Second, a `/loop` that simply stops being continued (no `stop: true` ever written) classifies as automated indefinitely; same residual, same cost.

**Scan cost and the sanctioned optimization.** The scan runs only when an offer arrives (never below the trigger) and is subprocess file I/O: a line-level string prefilter (`<command-name>`, `ScheduleWakeup`) before any JSON.parse, so a multi-megabyte transcript costs milliseconds and zero tokens. Requirements: bounded memory (stream or chunk the read; do not load an unbounded file into one string without a size guard), and a size guard that treats a transcript above a named cap as illegible (allow). If measurement during Section 2 shows the full scan slow enough to matter, the sanctioned optimization is a scan cursor persisted in `.kit/` (byte offset plus verdict, keyed by session id), making later fires incremental; do not build it speculatively.

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

