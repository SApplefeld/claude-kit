# claude-kit: Compaction Automation Unwind

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: spec authorship only (Opus-led execution; no fable-tier sections)
Created: 2026-07-24
Goal: Remove the kit's compaction/resume automation (resume relay, context tripwire, chain mode, kit-goal clause (c)) while keeping manual compact-session, the kit-goal leash, and plan-doc recovery fully intact.

## Why

Unattended runs that compacted at a section boundary and wrote a relay handoff have been stranding on a manual `/resume` when the AHK relay failed, costing hours to days of active work per miss. Decided 2026-07-24: return to the pre-automation model. Sessions run until the harness force-compacts natively; recovery is the SessionStart plan-doc re-read (which fires on the `compact` matcher and stays); `compact-session` remains a manual, on-request skill. The automation is removed, not fixed, and must stop being suggested anywhere in the kit.

Decisions recorded (all decided 2026-07-24):

- **Relay, context-tripwire, and chain mode are all removed.** Chain mode included: Scott has almost never used it, and it is the other half of the engineered-continuation apparatus. Condition verified before inclusion: sapplefeld-ai-os has zero dependency on chain mode, the relay, or the compaction engine (confirmed: `src/Spine.Core/Harness/WorkerSpawner.cs:307-308` sets `KIT_EXTERNAL_ENGINE=1` on every child; `src/Spine.Kernel/DispatchPump.cs:1145` directs workers to never compact/chain/relay; grep for `compact-cli|magic-compact` across that repo returns zero; Reach threads resume native session ids only).
- **`compact-session` stays, manual-interactive only.** The engine, `--check`, retrieval, and housekeeping are untouched.
- **The kit-goal leash stays, minus clause (c).** Clauses (a) Complete/archived and (b) `BLOCKED:` remain. The genealogy-ledger rebind (`ledgerChainReaches`) stays: the engine appends to `~/.claude/magic-compact/ledger.jsonl` on every compaction, manual included, and that walk is what carries the leash across a manual compaction swap.
- **The external-engine stand-down survives in prose.** ai-os depends on the contract that a `KIT_EXTERNAL_ENGINE`-marked worker executes exactly its directed section and never self-compacts. executing-work keeps that carve-out; the env marker becomes skill-facing only once the tripwire (its sole code reader) is deleted, which is intentional. Spine's directive sentence naming chain/relay/Compaction-line stays harmless post-unwind (a worker has nothing to stand down from); trimming it is an ai-os follow-up, not this effort.
- **The Chapter template drops its Compaction line.** The Metrics line stays. Swap-back if missed: restore the one template line plus its explanatory sentence in executing-work.
- **The doctor gains a legacy-relay cleanup** and this machine is disarmed during execution (consent already given). AutoHotkey the program stays installed.

## Ground rules for every section

- The removal map below came from a verified sweep. Re-locate content by the quoted anchor phrases, not line numbers, before editing.
- **Do NOT remove** (same-word, different thing):
  - `ledgerChainReaches()` in `hooks/kit-goal-stop.js` and its three genealogy tests in `test/kit-goal-stop.test.js` ("a two-hop chain", "corrupt ledger line", "forward-only leash").
  - `assertSingleParentChain` and every "parent chain" / "regression tripwire" mention in `engine/compact.ts`, `docs/compaction-engine.md`, `tools/engine-tests/plan-segmentation.test.ts` (transcript-integrity sense).
  - "in-flight debugging chain" and "execution main chain" in the doctrine (both copies): ordinary English.
  - "permission relay (v2.1.81+)" in `docs/backlog.md`: a native Claude Code feature, not the kit relay.
- `docs/archive/` is append-only history: never edited. `kaizen/archive/` likewise.
- The doctrine is duplicated verbatim: `home/claude-kit-doctrine.md` is `plugins/claude-kit/skills/operating-instructions/SKILL.md` minus the 5-line frontmatter. Every doctrine edit lands in both, and the acceptance diff proves they still match.
- The INSTALLED context-tripwire hook (plugin cache) keeps firing until the kit updates on this machine, and its Compaction-line validator false-positives on this spec's own prose about the template line. Its nudges during this effort are advisory noise: ignore them, never "satisfy" them by running the probes they name.
- Baseline before section 1: run the full test gate and record counts. Current known state: 140 pass / 0 fail across the nine `test/*.test.js` files (2026-07-24, pre-unwind).
- Test gate command (explicit files; bare `node --test test/` misfires on Node 24). After section 1 the three deleted test files drop out of the list:
  `node --test test/branch-reaper-nudge.test.js test/capture-window.test.js test/context-tripwire.test.js test/docs-write-guard.test.js test/kit-goal-lib.test.js test/kit-goal-stop.test.js test/merged-pr-push-guard.test.js test/relay-ready.test.js test/stop-docs-hygiene.test.js`

## Sections of Work

### 1. Hooks unwind. Model: opus

Files: `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/hooks/session-start.js`; delete `plugins/claude-kit/hooks/relay-ready.js`, `plugins/claude-kit/hooks/relay-refresh.js`, `plugins/claude-kit/hooks/context-tripwire.js`, `test/relay-ready.test.js`, `test/capture-window.test.js`, `test/context-tripwire.test.js`.

- Delete the three hook files and their three test files. No manifest enumerates test files by name; the gate command list is the only thing to shrink.
- `hooks.json`: remove the two SessionStart matcher objects running `relay-refresh.js` and `relay-ready.js`, and the PostToolUse matcher object running `context-tripwire.js`. Whole objects, valid JSON after (watch trailing commas: two of the removed objects are the last element of their array).
- `session-start.js`: remove `countRecentRelayFailures()` in full, its call-site guard block, the `relayFailures` term in the emit-nothing early return, and the "resume-relay request(s) failed" block push. In the armed-goal nudge text, reword the allow-conditions clause "allowing a stop only on plan Complete, a leading 'BLOCKED:', or a section-boundary relay handoff" to name only Complete and `BLOCKED:`. Plan recovery, kaizen count, completed-unarchived, and goal surfacing all stay.

Tests: gate green with the six remaining test files; `node -e "require('./plugins/claude-kit/hooks/session-start.js')"` style load-check unaffected (the file guards on `require.main`); `node -e "JSON.parse(require('fs').readFileSync('plugins/claude-kit/hooks/hooks.json'))"` passes; grep `relay|tripwire` over `plugins/claude-kit/hooks/` returns only `kit-goal-stop.js` hits (section 2 removes those) and no `hooks.json` hits.

### 2. kit-goal clause (c) removal. Model: opus

Files: `plugins/claude-kit/hooks/kit-goal-stop.js`, `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/skills/kit-goal/SKILL.md`, `test/kit-goal-stop.test.js`, `test/kit-goal-lib.test.js`.

- `kit-goal-stop.js`: delete `RELAY_WINDOW_MS`, `PROCESSED_SCAN_LIMIT`, `readRelayHeadOrThrow()`, `matchRelayBody()`, `resolveRelayDestination()`, `recentRelayHandoffForPlan()`, and the clause-(c) invocation block in `main()`. Update the header comment (drop the clause-(c) prose, the "fresh relay request" fail-open example, and the "resumed relay successor" asides; the fail-open-on-indeterminate principle itself stays) and the block-reason string (drop "and no section-boundary relay handoff was just written"; keep Complete, `BLOCKED:`, `/kit-goal clear` as the ways out). `ledgerChainReaches()` and the identity-scoping logic stay byte-identical.
- `kit-goal-lib.js`: rewrite `composeCondition()` to two clauses, (a) every section complete and closed out, (b) BLOCKED on a decision only Scott can make. Reword the `bindSession` length-cap comment to justify the cap without the relay-file framing (an oversized id from any caller is still rejected).
- `kit-goal/SKILL.md`: frontmatter and body keep the "survives compaction because state lives in the project" claim, reworded without "relayed"; the leash-holding section drops the relay-handoff successor-recognition clause (the compaction-ledger clause stays); delete the clause-(c) bullet from the allow list.
- `test/kit-goal-stop.test.js`: delete the ten clause-(c) tests (six under the win32 relay-probe skip: fresh request allow, own-spawning-handoff, processed-archive allow, different-plan masking, stale entry, newest-first; four rebind tests: destination rebind, rebind-write-failure, basename rejected, full-path accepted). Keep the three genealogy tests. Retitle the core block test so "no relay" leaves the title, and prune relay-dir setup helpers the deleted tests used. `test/kit-goal-lib.test.js`: keep the oversized-id `bindSession` test, reword its relay-framed comment.

Tests: gate green; the kit-goal test files' remaining tests all pass; grep `relay` over `plugins/claude-kit/hooks/` and `test/` returns nothing.

### 3. compact-session skill, manual-only. Model: opus

Files: `plugins/claude-kit/skills/compact-session/SKILL.md`; delete the directory `plugins/claude-kit/skills/compact-session/relay/` (4 files: `resume-relay.ahk`, `arm-resume-relay.ps1`, `capture-window.ps1`, `preflight.ps1`). The `engine/` directory is untouched.

- Frontmatter description: drop "and the continuation chain for autonomous runs", "when chaining a worker session through a multi-section plan", and the "continuation chain" trigger. Keep the manual triggers including "when offering a compaction point".
- "When to compact": keep the numeric guidance and placement rules; drop the relay-armed placement bullet ("In an attended interactive run without the resume relay armed...") and reword the external-worker bullet to point at executing-work's stand-down without naming the deleted Run Mode check by that title if section 4 renames it.
- Replace "The two modes" with a single interactive-mode section: compact at the boundary or on request, hand Scott the `/resume <destinationSessionId>` line (CLI-only; the Desktop caveat stays), and note that mid-plan the compaction defers to the turn's true end rather than halting a run. Delete the Relay mode paragraph and the Chain mode subsection entirely; reword the "recovery spine in both modes" closer to the single remaining mode.
- Delete "Hard rules for headless spawns" (all four rules existed for chain-mode worker spawns; the summarizer's own API-key scrub and model pin are already stated in Invocation and stay there). The billing-contingency paragraph goes with it.
- Prerequisites, Invocation, Retrieving omitted content, Housekeeping: unchanged.

Tests: no JS tests touch this skill; acceptance is the section-6 grep gate plus a read-through confirming the skill still fully describes a manual compaction end to end (check, run, resume line, retrieve).

### 4. executing-work and brainstorming. Model: opus

Files: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/brainstorming/SKILL.md`.

- Completion contract: the external-worker sentence ("the directed section is the whole goal") stays. The goal-template paragraph drops clause (c) from the condition list (now: (a) complete and closed out, (b) BLOCKED), matching section 2's `composeCondition`. Replace the clause-(c) explanation paragraph with the property it was really carrying: the kit leash's state lives in the project (`.kit/`), so it survives native harness compaction and a manual compact-session swap (the genealogy rebind), with no re-arm.
- Rewrite the "Run Mode check" paragraph as an external-engine stand-down check only: when the driving directive states an external engine owns continuation by spawning a fresh worker per section, or `KIT_EXTERNAL_ENGINE` is set, execute the directed section only and never compact the session. No chain mode, no attendance fork, no `Run Mode` header semantics. Keep the paragraph title stable or update the one cross-reference in the completion contract to match.
- Delete step 8 (Compaction point) in full: both observations, the fork, and the "Then continue" line it owns (keep a closing "continue to the next section" for the loop). Step 8 is the loop's last step, so no renumbering. Add one sentence where step 8 stood or in the loop preamble: compaction is manual and Scott's to request (compact-session skill); context pressure never stops or pauses a run (the completion contract already says this; do not restate it at length).
- Chapter format: delete the `Compaction:` template line and the paragraph sentences explaining its evidence rule and the context-tripwire enforcement. Metrics line and the rest stay.
- Advisor section: drop the "chain-mode workers carry it too" clause; the persists-in-settings fact stays.
- `brainstorming/SKILL.md`: delete the step-10 "Record the **Run Mode**" paragraph and the `Run Mode: chain | interactive` line from the spec-format template.

Tests: section-6 grep gate; a read-through of executing-work confirming no dangling references to step 8, the Run Mode header, chain mode, or the relay; existing plan docs elsewhere carrying `Run Mode:` headers parse as inert prose (nothing in the kit reads them; confirmed for ai-os, `PlanDocParser.cs:80-93` has no RunMode pattern).

### 5. Doctor: excise relay checks, add legacy cleanup. Model: opus

Files: `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/skills/kit-doctor/SKILL.md`.

- Remove the whole relay block (the "Resume relay" + "Relay attended path" + "Resume relay failures" section: `$relayDir`/`$armScript` setup, the `RelayWinVisibility` P/Invoke class, `Get-RelayFailureReason`, `Invoke-RelayDryrunProbe`, `Update-RelayFactsAfterRearm`, the armed/not-armed report branches, dry-run probe, failures WARN; it sits self-contained between the kaizen-signpost check and the kit-goal continuity check). Remove `$relaySourceDir`. Trim the header feature summary, `-Fix` and `-NoProbe` flag descriptions, the execution-policy remediation's "relay arm path" clause, and the login probe's "chain-mode workers" phrasing (the login probe itself stays: the summarizer needs it).
- Add a **Legacy resume relay** check in the removed block's place: detect any of (a) `%LOCALAPPDATA%\claude-kit\resume-relay\` existing, (b) the Startup shortcut `claude-resume-relay.lnk`, (c) a running `AutoHotkey64.exe` whose command line contains `resume-relay.ahk`. Report WARN naming what was found, stating the relay was removed from the kit. Under `-Fix`, consent-gated: stop the watcher process, delete the shortcut, then delete the relay directory, but first print the first three lines of each `failed\*.txt` (minus `[doctor-dryrun]` probes) so a stalled session's resume pointer is surfaced before its record is deleted. Never uninstall AutoHotkey. PASS silently when none of the three exist (the eventual steady state everywhere).
- `kit-doctor/SKILL.md`: frontmatter drops "resume relay" from the misbehaving-capability list; `-Fix` bullet swaps "consent-gated relay re-arm or watcher refresh" for the legacy cleanup; `-NoProbe` drops the relay round-trip clause; the Interpret section's relay bullet group is replaced by two lines on the legacy check (what WARN means, what `-Fix` does); "chain-mode workers" phrasing goes.

Tests: `powershell -NoProfile -Command "& { $ErrorActionPreference='Stop'; [scriptblock]::Create((Get-Content -Raw plugins/claude-kit/doctor/doctor.ps1)) | Out-Null; 'parses' }"` (or equivalent parse check) passes; a `doctor -NoProbe` run on the armed dev machine reports the legacy WARN and nothing relay-green; gate unaffected.

### 6. Doctrine, README, docs. Model: inline (docs/ writes are main-thread per docs-write-guard)

Files: `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `README.md`, `docs/architecture.md`, `docs/compaction-engine.md`, `docs/README.md`, `docs/backlog.md`, plus a grep of `plugins/claude-kit/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` for automation phrasing.

- Doctrine (both copies, identically): rewrite the "Chain mode buys unattended survival..." closing sentence of the split-is-measured bullet to state the current model: unattended stretches ride native harness compaction and plan-doc recovery; attended execution compacts manually at boundaries when asked. "Keep resting context under the compact-session trigger" stays (it is the manual lever).
- `README.md`: drop "headless continuation chain" phrasing (top summary and the compact-session structure line), delete the `context-tripwire.js` and `relay-ready.js / relay-refresh.js` structure entries, trim the doctor line's relay clause and the "Verify the machine" relay sentences, reword the kit-goal allow-conditions clause.
- `docs/architecture.md`: SessionStart bullet drops the two relay hooks and their matcher notes; the PostToolUse tripwire bullet is deleted (leaving `format-on-edit.js` as the PostToolUse story); the Stop bullet's "and relay" goes; the engine paragraph's "three modes (interactive, relay, chain)" becomes the single manual mode; the AutoHotkey external-integration bullet is deleted.
- `docs/compaction-engine.md`: rewrite the segment-fallback paragraph's premise sentence ("Both target workflows deliver that human row...") to the remaining workflow: the resume prompt Scott types (or a fresh directive) is the human row that makes a compacted session compactable again. `assertSingleParentChain` prose untouched.
- `docs/README.md`: the archive index entries stay (they describe completed plans, journey by design), but any present-tense claim that a removed feature currently operates is reworded to plan-scoped past fact.
- `docs/backlog.md`: retire with receipts. Delete the wholly-relay bullets (relay-hardening freeze, request-queue collision, no-context-ceiling) and the relay/chain fragments of the mixed bullets (200k gate data point, ASR config part 2, overnight-chain clause, dogfooding part 1), keeping each mixed bullet's unrelated remainder. Move the retired items to a dated snapshot in `docs/archive/` (curating-docs owns the mechanics) with a one-line retirement reason: superseded by this unwind. Leave the "permission relay" item untouched.
- Update `tools/engine-tests/plan-segmentation.test.ts`'s one comment naming "the relay types a continue prompt and chain mode pipes one through -p" to the remaining workflow (comment only; assertions unchanged).

Tests: the acceptance greps below; `diff <(tail -n +6 plugins/claude-kit/skills/operating-instructions/SKILL.md) home/claude-kit-doctrine.md` returns identical.

### 7. Machine disarm, memory, close-out. Model: inline

- Run the section-5 legacy cleanup against this machine (SCOTT-DESKTOP): stop the watcher, remove the Startup shortcut, delete `%LOCALAPPDATA%\claude-kit\resume-relay\`. Consent was given 2026-07-24. Before deletion, surface the stalled-session pointer already found: session `e0b0ff10-decf-4fa3-9a1d-1c45d7a18a90` in `D:\personal\sapplefeld-ai-os`, plan `ai-os-conversation-writes_spec_v1.md`, resume with `claude --resume e0b0ff10-decf-4fa3-9a1d-1c45d7a18a90` there if not already handled. Name the machine-state change in the close-out.
- Memory updates (auto-memory at `~/.claude/projects/D--personal-sapplefeld-claude-kit/memory/`): delete `relay-frozen-attended-only.md` and `relay-dryrun-repro-technique.md` (the subject no longer exists); rewrite `external-engine-standdown-contract.md` to the post-unwind contract (the env marker and directive sentence remain the skill-facing stand-down; the machinery they stood down from is gone); update `MEMORY.md` index lines to match.
- Finishing pass per finishing-work: full gate with the post-unwind file list, the acceptance greps, reviews per the roster, flip this plan to Complete, archive via curating-docs.

## Acceptance (whole effort)

1. Full test gate green with the six remaining `test/*.test.js` files plus `tools/engine-tests` untouched-and-green, diffed against the recorded baseline (expected delta: exactly the deleted files' tests).
2. Grep gates over the tree excluding `docs/archive/`, `kaizen/archive/`, and `docs/plans/claude-kit_compaction-unwind_spec_v1.md` itself:
   - `resume-relay|relay-ready|relay-refresh|arm-resume-relay|capture-window|preflight\.ps1|AutoHotkey|\bahk\b` → only the doctor's Legacy resume relay cleanup check (which must name these to remove them) and `docs/backlog.md`'s "permission relay" non-match.
   - `context-tripwire|KIT_TRIPWIRE` → zero.
   - `chain mode|chain-mode|continuation chain|Run Mode` → zero (the parent-chain/debugging-chain/main-chain senses documented above do not match these patterns; verify, not assume).
   - `KIT_EXTERNAL_ENGINE` → executing-work's stand-down paragraph and the doctor/docs only if deliberately retained there; zero code readers.
3. `hooks.json` parses; every hook it names exists; no hook file in `plugins/claude-kit/hooks/` is unreferenced by `hooks.json` except libraries (`kit-goal-lib.js`, `kit-goal.js`).
4. Doctrine copies identical (frontmatter-offset diff).
5. On this machine: no `resume-relay` directory, no Startup shortcut, no watcher process; `doctor -NoProbe` reports the legacy check PASS-silent.
6. A fresh read of compact-session and executing-work describes a coherent world: manual compaction only, no step referencing a deleted mechanism.

## Chapters

(none yet: execution has not begun)
