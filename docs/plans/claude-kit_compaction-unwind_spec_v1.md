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
- Baseline before section 1: run the full test gate and record counts. Pre-unwind state, per file, is the diff target acceptance 1 measures against: branch-reaper-nudge 4, capture-window 8, context-tripwire 29, docs-write-guard 9, kit-goal-lib 24, kit-goal-stop 47, merged-pr-push-guard 4, relay-ready 8, stop-docs-hygiene 7, totalling 140 pass / 0 fail across the nine `test/*.test.js` files. `bun test tools/engine-tests/` is a separate suite at 79 pass / 0 fail and must stay there: section 6 touches only a comment in it. Expected post-unwind `test/` total is 85 (140 minus the 45 tests in the three files section 1 deletes, minus the 10 clause-(c) tests section 2 deletes).
- Acceptance greps run over tracked content only. `plugins/claude-kit.zip` is a gitignored local build artifact carrying copies of the deleted hooks, so a plain `grep -r` reports a spurious binary match: use `git grep`, or exclude `*.zip`.
- Test gate command (explicit files; bare `node --test test/` misfires on Node 24). After section 1 the three deleted test files drop out of the list:
  `node --test test/branch-reaper-nudge.test.js test/capture-window.test.js test/context-tripwire.test.js test/docs-write-guard.test.js test/kit-goal-lib.test.js test/kit-goal-stop.test.js test/merged-pr-push-guard.test.js test/relay-ready.test.js test/stop-docs-hygiene.test.js`

## Standing Brief Amendments

Folded into every later dispatch brief.

- **Sweep the residue, not just the code.** A removal is not done when the mechanism's code is gone: the same pass must clear what still describes it in the files the section owns. That means comments and doc-comments above surviving symbols, test titles and test-file header comments, setup scaffolding and helper parameters that only the deleted path needed, and list grammar left dangling by a deleted bullet (a "; or" with nothing following it, a colon introducing a one-item list). Report any residue found in a file the section does not own instead of reaching for it.
- **Report a spec sentence the section's own gate contradicts.** Two sections in, the spec has twice asserted something its own acceptance gate forbids (a grep expected to return only one file when two matched; a function required to stay byte-identical while carrying a phrase the grep gate bans). Treat a conflict between the spec's prose and the spec's gate as a spec defect to surface, not a puzzle to resolve silently, and say which reading you implemented.
- **Prefer an exact pin to an absence check.** When a test guards text that nothing parses (a canonical string, a template line, a user-facing message), assert the whole expected value rather than the absence of one token. An absence check passes a reworded or re-added clause. Where two tests would carry the same literal, pin the literal once and assert equality against its producer in the other.

## Sections of Work

### 1. Hooks unwind. Model: opus

Files: `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/hooks/session-start.js`; delete `plugins/claude-kit/hooks/relay-ready.js`, `plugins/claude-kit/hooks/relay-refresh.js`, `plugins/claude-kit/hooks/context-tripwire.js`, `test/relay-ready.test.js`, `test/capture-window.test.js`, `test/context-tripwire.test.js`.

- Delete the three hook files and their three test files. No manifest enumerates test files by name; the gate command list is the only thing to shrink.
- `hooks.json`: remove the two SessionStart matcher objects running `relay-refresh.js` and `relay-ready.js`, and the PostToolUse matcher object running `context-tripwire.js`. Whole objects, valid JSON after (watch trailing commas: two of the removed objects are the last element of their array).
- `session-start.js`: remove `countRecentRelayFailures()` in full, its call-site guard block, the `relayFailures` term in the emit-nothing early return, and the "resume-relay request(s) failed" block push. In the armed-goal nudge text, reword the allow-conditions clause "allowing a stop only on plan Complete, a leading 'BLOCKED:', or a section-boundary relay handoff" to name only Complete and `BLOCKED:`. Plan recovery, kaizen count, completed-unarchived, and goal surfacing all stay.

Tests: gate green with the six remaining test files; `node -e "require('./plugins/claude-kit/hooks/session-start.js')"` load-check exits 0 without crashing (the file has no `require.main` guard: it calls `main()` at load inside a try/catch, so the check exercises a real run against empty stdin); `node -e "JSON.parse(require('fs').readFileSync('plugins/claude-kit/hooks/hooks.json'))"` passes; grep `relay|tripwire` over `plugins/claude-kit/hooks/` returns only `kit-goal-stop.js` and `kit-goal-lib.js` hits (section 2 removes those) and no `hooks.json` hits.

### 2. kit-goal clause (c) removal. Model: opus

Files: `plugins/claude-kit/hooks/kit-goal-stop.js`, `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/skills/kit-goal/SKILL.md`, `test/kit-goal-stop.test.js`, `test/kit-goal-lib.test.js`.

- `kit-goal-stop.js`: delete `RELAY_WINDOW_MS`, `PROCESSED_SCAN_LIMIT`, `readRelayHeadOrThrow()`, `matchRelayBody()`, `resolveRelayDestination()`, `recentRelayHandoffForPlan()`, and the clause-(c) invocation block in `main()`. Update the header comment (drop the clause-(c) prose, the "fresh relay request" fail-open example, and the "resumed relay successor" asides; the fail-open-on-indeterminate principle itself stays) and the block-reason string (drop "and no section-boundary relay handoff was just written"; keep Complete, `BLOCKED:`, `/kit-goal clear` as the ways out). `ledgerChainReaches()` and the identity-scoping logic keep byte-identical bodies; their comments are reworded only where the section's own `relay`-returns-nothing gate demands it (both carried a passing relay mention).
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

### Chapter 1 - 2026-07-24
Completed: 1. Hooks unwind
Implemented By: implementer-opus (no escalation)
Metrics: 1 review round; 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises: Baseline recorded per file rather than as one aggregate, because acceptance 1 measures a delta and an aggregate cannot attribute it; `bun test tools/engine-tests/` had no recorded baseline at all and is now pinned at 79 pass / 0 fail. Two spec inaccuracies found and corrected in place: `session-start.js` has no `require.main` guard (it calls `main()` at load inside a try/catch, so the load-check exercises a real run), and section 1's grep sentence named only `kit-goal-stop.js` when `kit-goal-lib.js` carries three relay mentions that section 2 owns. `plugins/claude-kit.zip` is a gitignored local build artifact holding copies of the deleted hooks, so the acceptance greps must run over tracked content only; recorded as a ground rule. Bonus cleanup: the dead `const os = require('os')` in `session-start.js`, unused since before this effort, removed while the file was open (undo: restore that one line). Deleting `test/capture-window.test.js` here while `capture-window.ps1` ships until section 3 leaves that script unpinned for two sections, accepted as ordering.
Review Findings: Adversarial APPROVED_WITH_CONCERNS, two Minors, both addressed: the unmeetable grep sentence (spec corrected) and the dead `os` require (removed). Blind returned CHANGES_REQUIRED with 2 Criticals and 6 Majors, every one of them the same class: the tree is mid-unwind, so a deleted producer still has shipping consumers. Each maps to a later section of this effort (clause (c) and its ten tests to section 2; the relay directory, `capture-window.ps1`, and the compact-session relay procedure to section 3; the executing-work tripwire reference to section 4; the doctor's blind dry-run PASS and the relay-refresh claims to section 5; README and docs to section 6), so none is a shipping defect and none was actioned now. Blind's Critical 1 is kept as a binding constraint rather than dismissed: with `relay-ready.js` gone from the repo the ready handshake can never be satisfied, while clause (c) would still release the leash to a successor that never receives its continue prompt, so no relay handoff is written at any boundary in this effort. Blind's warning is not live on this machine: the running hooks load from the plugin cache pinned at `4470f8e` (an ancestor of HEAD) which still carries all three deleted hooks, confirmed by listing that directory.
Compaction: check not run: relay removal in flight, no handoff written at any boundary of this effort (section 7 disarms this machine); action none.
Next: 2. kit-goal clause (c) removal
Commit Model: Commit-and-Push

### Chapter 2 - 2026-07-24
Completed: 2. kit-goal clause (c) removal
Implemented By: implementer-opus; review findings addressed in the main session
Metrics: 1 review round; 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises: The dispatch brief was wrong on two points the implementer caught and resolved. It said `test/kit-goal-lib.test.js` needed no assertion changes, but two surviving tests asserted the condition string contains `(c)` and would have gone red; they are now pinned positively instead. It also asked for the header comment's "three ways out" to become two, conflating two different counts: the allow conditions drop to two, while the reason string still names three imperatives (finish, surface a blocker, `/kit-goal clear`), so "three ways out" is correct and stays. `composeCondition`'s literal is split across source lines as `you are BLOCKED ' + 'on a decision`, which silently no-op'd a first mutation probe whose search string spanned the break; the probe was redone against a real substring. The `relay`-returns-nothing gate reached further than the spec's file list: `ledgerChainReaches` and `sameSessionId` each carried a passing relay mention in a doc comment, so their comments were reworded while their bodies stayed byte-identical, and the spec sentence asserting byte-identity was corrected to say so. Deliberate non-fix: `runHook`'s `localAppData` parameter in `test/kit-goal-stop.test.js` is now vestigial in the sense that no hook code reads `LOCALAPPDATA`, but it still pins the variable away from the real user profile, so it is retained and documented as isolation rather than removed across 33 positional call sites where a dropped argument would silently shift into `extraEnv`.
Review Findings: Adversarial APPROVED_WITH_CONCERNS, four Minors. Blind CHANGES_REQUIRED, one Critical, two Majors, three Minors. Both reviewers independently flagged the same two Minors, and both are fixed. First, the inverted `(c)`-absence assertions under-delivered on their own titles: `composeCondition` is now pinned by exact-string compare (proven both directions, 23 pass / 1 fail with a re-added clause, 24 / 0 restored), and the `armGoal` test asserts equality against `composeCondition` so the literal lives in one place. Second, test hermeticity: two tests built their env by hand without `KIT_GOAL_LEDGER_PATH` and would have fallen back to the real `~/.claude/magic-compact/ledger.jsonl` once their goal bound, a latent cross-machine flake now closed, along with the dead `LOCALAPPDATA` in the bind-write-failure helper and its single call site. Also fixed: two prose artifacts in `kit-goal/SKILL.md` (a colon introducing a one-item list, and an inheritance claim that credited same-repo residence when the actual route is the ledger chain). Blind's Critical and both its Majors are the mid-unwind sequencing class again, every one landing in a file a later section owns: the executing-work clause-(c) boundary-stop instruction (section 4), the compact-session relay procedure (section 3), and README's allow-condition list (section 6). None was actioned here; each is now a section-4, section-3, and section-6 acceptance item respectively.
Recurrence: the same finding class has now appeared in both sections, residue left behind by a removal (stale comments, dead scaffolding, dangling list grammar, and a spec sentence its own gate contradicts). A `Standing Brief Amendments` block is added above the Sections of Work and folds into every later dispatch brief.
Compaction: check not run: relay removal in flight, no handoff written at any boundary of this effort (section 7 disarms this machine); action none.
Next: 3. compact-session skill, manual-only
Commit Model: Commit-and-Push
