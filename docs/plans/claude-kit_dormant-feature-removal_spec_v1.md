# Dormant-feature removal: stop-failure recovery, the legacy relay cleanup, and the version floor come out

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-22

## Goal

The kit stays lean: only actively maintained, actually used capabilities ship. Three features are dormant by evidence and come out whole (decided 2026-08-22): the stop-failure recovery feature, superseded by the harness's native retry watchdog before it ever ran end to end; the doctor's legacy resume-relay cleanup block, transitional hygiene for a feature removed 2026-07-24 whose known-armed machine was already disarmed; and the doctor's PreCompact version-floor check, whose WARN branch no fleet machine can reach. Alongside the removals, the orphan test harness at `tools/hook-tests/guards.test.js` is consolidated into `test/` before it can be deleted, because it holds the only coverage of the live `pr-docs-guard.js` hook.

## Approach

A dormancy scout enumerated every candidate's footprint with file:line evidence on 2026-08-22, and the load-bearing claims were spot-verified the same session (the hooks.json block, the absence of `test/pr-docs-guard.test.js`, the doctor block anchors, and `Get-ScheduledTask` returning no kit task on NEO-CLAUDE). Line anchors are as of commit 872089b; re-locate by content.

**Acceptance-check discipline for this plan's absence gates** (adopted 2026-08-23 from the Unlazy evaluation): every acceptance grep in this plan that proves absence passes identically when its pattern is wrong, so each one runs once against the pre-removal tree as its positive control, confirming it returns the hits about to be removed, before its post-removal silence is trusted. Record both runs in the section's Chapter: the control's hit count, then the clean run. A pattern that never matched anything proves nothing.

**Why stop-failure recovery is dormant.** The feature auto-resumed a kit-goal-armed run whose session died on a retryable API failure. Its own archived spec records the supersession: with `CLAUDE_CODE_RETRY_WATCHDOG=1` the client sleeps to the reset instant itself, no `StopFailure` fires, and the watcher never engages (`docs/archive/claude-kit_stop-failure-recovery_spec_v1.md:187`). The end-to-end path has never run: the backlog's live-fire item (retired by this plan) records both prerequisite machine actions as never done, and no scheduled task exists on this machine (verified 2026-08-22). Removal order matters twice, stated in the sections.

**Why the relay cleanup block comes out.** The resume relay was removed by the compaction unwind (2026-07-24); the cleanup block detects and removes three machine leftovers (a state directory, a Startup shortcut, a resident AutoHotkey watcher). It is ~320 lines, roughly 15 percent of the doctor, carries zero test coverage, and this machine verified clean (all three probes negative, 2026-08-22). It is also the only remover, so the preflight below runs before the section that deletes it.

**Why the version floor comes out.** The check warns when `claude --version` is below 2.1.208, the first release with PreCompact support; the same file records behavior confirmed on 2.1.233, and no fleet machine plausibly runs below the floor. What still fires is an INFO noise line on hosts without `claude` on PATH.

**Kept, with the decision recorded so it is not re-litigated:** the Haiku implementer band (kept 2026-08-22 on the operator's call; its backlog item carries the July 25 usage receipt), the external-engine seam (Spine is active and this kit is its guidebook, operator statement 2026-08-22), the embedder stack (opt-in and actively maintained), and the four prose sites documenting the advisor decommission (they carry live design reasoning, not dead machinery).

## Sections of Work

### 1. Remove the stop-failure recovery feature

Model: opus

Delete outright: `plugins/claude-kit/hooks/stop-failure-log.js`, `plugins/claude-kit/scripts/stop-failure-watcher.ps1`, `plugins/claude-kit/doctor/install-stop-failure-watcher.ps1`, `test/stop-failure-log.test.js`, `test/stop-failure-watcher.test.js`. Remove the `"StopFailure"` block from `plugins/claude-kit/hooks/hooks.json` (:159-168; it is the last key, so the preceding block's trailing comma moves). Doctor surgery in `plugins/claude-kit/doctor/doctor.ps1`: the header's stop-failure clause (:10), both usage blocks (:31-40), the two StopFailure switch tokens on the wrapper usage line (:43 only; the wrapper documentation for `-Fix`/`-Yes` on that line and the `-RemoveLegacyRelay` line at :42 stay, the latter being section 2's), the two param switches (:46-47), the dot-source of the installer (:160-165), and the whole `Stop-failure watcher` report section (:1716-1837). Remove the usage-comment mentions in the root `doctor.ps1`/`doctor.cmd` and `plugins/claude-kit/doctor/doctor.cmd` (line 5 in each; they are pass-through forwarders, no argument plumbing changes). Remove the explanatory comments naming the watcher at `plugins/claude-kit/hooks/kit-goal-lib.js:333`, `test/kit-goal-stop.test.js:1939`, and `test/kit-goal-lib.test.js:498` (comments only; the assertions around them stand). The build manifest needs no hand edit: `build.ps1` globs `hooks/*.js`, so the rebuilt manifest simply stops naming the logger.

Dependency check before deleting (re-verify, do not trust this spec): nothing else reads the four `.kit/` marker files (`stop-failure-latest.json`, `stop-failure-events.jsonl`, `stop-failure-attempts.json`, `stop-failure-resumed.json`); the scout found no in-repo reader beyond the watcher itself, and the one potential out-of-repo reader is covered by Operator Verification.

Acceptance: `node --test test/*.test.js` green with the count delta named in the Chapter (the two deleted test files lower the 1244 baseline; record the new figure); `./build.ps1` builds clean and the manifest no longer names the logger; a full doctor run on this machine completes with no missing-file FAIL and no `Stop-failure watcher` section; `git grep -i "stop-failure\|StopFailure\|RETRY_WATCHDOG"` (tracked files only, so a machine's untracked `.kit/` markers cannot fail it) returns hits only under `docs/archive/`, archive snapshots, and this plan.

Files in scope: the deletions above, `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/doctor/doctor.cmd`, `doctor.ps1`, `doctor.cmd`, `plugins/claude-kit/hooks/kit-goal-lib.js`, `test/kit-goal-stop.test.js`, `test/kit-goal-lib.test.js`.

### 2. Doctor surgery: the legacy relay cleanup and the version floor

Model: opus

Runs only after the relay preflight in Operator Verification confirms every fleet machine clean; a dirty machine runs `doctor -Fix -RemoveLegacyRelay` there first, while the remover still exists. Sections run in numbered order; this one additionally waits on that preflight. Then remove from `plugins/claude-kit/doctor/doctor.ps1`: the header sentence's relay clause (:11), the whole legacy-relay block (:458-777, including `Get-LegacyRelayWatcher`, `Get-LegacyRecordHead`, the record scan, and the consent/kill/delete path), the `$RemoveLegacyRelay` switch (:46) and its usage blocks (:24-30) and wrapper usage line (:42); and the PreCompact version-floor check (the constant and comment at :1878-1882, the probe and both report branches at :1899-1929; `$installedVersion` is used only here, so it goes too). Remove the flag mentions from the root and plugin `doctor.cmd`/`doctor.ps1` usage comments (line 4 in each). Reword `plugins/claude-kit/skills/kit-doctor/SKILL.md:27`, whose parenthetical names `-UnregisterStopFailureWatcher` as "the other" destructive action: after sections 1 and 2 the doctor has no destructive actions left, so the sentence changes shape rather than swapping a name.

Acceptance: the doctor runs end to end on this machine with no relay section, no version-floor line, and exit 0; `grep -i "RemoveLegacyRelay\|LegacyRelay\|resume-relay\|installedVersion"` over `plugins/` and the root doctor files returns nothing; the suite stays green at section 1's recorded figure.

Files in scope: `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/doctor/doctor.cmd`, `doctor.ps1`, `doctor.cmd`, `plugins/claude-kit/skills/kit-doctor/SKILL.md` (the :27 parenthetical only; the rest of that skill is section 4's).

### 3. Consolidate pr-docs-guard coverage, then retire the orphan harness

Model: sonnet

`tools/hook-tests/guards.test.js` is an undocumented second harness, off the suite's baseline (no runner invokes `tools/`), and it holds the only tests of `plugins/claude-kit/hooks/pr-docs-guard.js`: six tests, opening at :355, :371, :402, :420, :435, and :455, the last being the default-branch-parking behavior. The authoritative count is the file itself, read before moving, never this spec. Move all of them into a new `test/pr-docs-guard.test.js` on the `test/` directory's own harness conventions (mirror a sibling guard test file's structure; `test/docs-write-guard.test.js` is the nearest shape). Then verify the rest of `guards.test.js` duplicates coverage that already lives in `test/` (its docs-write-guard and merged-pr-push-guard tests against their `test/` twins), and delete `tools/hook-tests/` whole. Any non-duplicated assertion found anywhere in the file moves too rather than being deleted, named in the Chapter.

Tests: the moved file must run inside `node --test test/*.test.js` and its count lands in the suite figure (the gate is self-surfacing: a harness-porting mistake reads as a red or a missing count). At minimum, every pr-docs-guard behavior the source file tests stays locked, the smoke path, the multi-checkout paths, and the default-branch-parking behavior included, in both directions where the originals test both.

Acceptance: `test/pr-docs-guard.test.js` exists and its tests pass inside the full suite; `tools/hook-tests/` is gone; the suite figure equals section 1's figure plus the moved tests, recorded in the Chapter; `docs/architecture.md:14`'s `tools/` inventory sentence still describes what `tools/` holds.

Files in scope: `tools/hook-tests/guards.test.js` (read then delete), `test/pr-docs-guard.test.js` (new), `docs/architecture.md` (:14 only if the inventory sentence changes).

### 4. Docs and backlog sweep

Model: sonnet
Locus: inline

Update every prose surface the removals falsify. Stop-failure: `plugins/claude-kit/skills/kit-goal/SKILL.md` (:28 whole paragraph, and at :54 both watcher sentences, the mechanical-caller sentence and the nothing-trails-the-path rationale sentence that leans on it), `plugins/claude-kit/skills/kit-doctor/SKILL.md` (:38 bullet), `docs/architecture.md` (:9 doctor bullet, :77 goal-state readers clause, :79-85 the four StopFailure paragraphs), `docs/security-model.md` (:206 the reader count and its following sentence, :238-263 the whole logger-and-watcher section), `docs/fleet-integration.md` (:5 fired-hooks list, :22 the logger passage), `README.md` (:66-68, :89-92, :97-100, :107-111). Relay: `README.md` (:109, :154), `docs/architecture.md` (:9), and `plugins/claude-kit/skills/kit-doctor/SKILL.md`'s whole relay passage (:35-:37, the `-RemoveLegacyRelay` bullet and the resume-records sentence between the cited lines; sweep the passage whole, not the two line numbers). Version floor: `README.md` (:107) is its only prose surface; `kit-doctor/SKILL.md` carries no version-floor or PreCompact mention (verified absent 2026-08-22 by the blind read, correcting the scout's claim that it did). Index annotations, not deletions: `docs/README.md` (:15, :16 document summaries; :33 the archive entry for the stop-failure spec gains a removed-by note naming this plan) and `docs/plans/README.md` (:17 same treatment). Backlog: retire the live-fire item (2026-08-16) to the Q3 snapshot naming this plan as the retirer; drop `stop-failure-log.js` from the `.kit/` creators item (four becomes three, adjust its arithmetic); drop the "modeled on stop-failure-log.js" clause from the compaction-events candidate; re-size the integrity-manifest item, whose sizing case was the watcher as "the kit's only unattended executor" (after removal the kit has no unattended executor, which shrinks that item's scope and the sentence saying so). The architecture and security-model paragraphs describing what the kit no longer has are removed, not rewritten as history: the archive keeps the history.

Acceptance: `git grep -i "stop-failure\|StopFailure"` over `plugins/`, `docs/` (excluding `docs/archive/`), and `README.md` returns only this plan and the backlog snapshot; `git grep -i "RemoveLegacyRelay\|LegacyRelay\|resume-relay\|relay\.log\|resume records"` over the same scope returns nothing (the terms beyond the flag names exist to catch descriptive relay prose that names no flag, the class the blind read found at kit-doctor:36; bare "relay" is deliberately not a term, the channel relay being live); the version-floor wording is gone from `README.md:107`; the docs indexes' annotations name this plan; the backlog holds no item this plan retired.

Files in scope: as enumerated above, plus `docs/backlog.md` and `docs/archive/backlog-2026-Q3.md`.

## Out of Scope

- The Haiku implementer band (kept, decided 2026-08-22; its backlog item stays).
- The external-engine seam and everything under `KIT_EXTERNAL_ENGINE` (Spine is active; operator statement 2026-08-22).
- The embedder stack and semantic find (opt-in, actively maintained).
- The four prose sites documenting the advisor decommission (live reasoning, no machinery).
- Any change to `CLAUDE_CODE_RETRY_WATCHDOG` machine state (the kit never set it; nothing to unset).

## Assumptions

- assumed 2026-08-22 (source: the dormancy scout, spot-verified): the enumerated footprint is complete; reversal: a missed surface found during execution is adjudicated the same round per executing-work's out-of-scope-surface rule.
- assumed 2026-08-22 (default): archive-index entries are annotated rather than deleted, per `docs/README.md:33`'s own framing; reversal: delete the entries instead, one edit per index.
- assumed 2026-08-22 (default): no section waits on the broker check; the broker reads stop-failure marker files, and section 1 removes only the kit-side writer of those files, which leaves any broker reader reading absent files, its ordinary state on a machine that never logged a failure; reversal: hold section 1 on the broker check.

## Operator Verification

- **The relay preflight gating section 2: SATISFIED, operator confirmation 2026-08-23.** The operator confirmed every fleet machine has run `doctor -Fix -RemoveLegacyRelay` and all are clean (NEO-CLAUDE additionally verified clean by this session's own three probes, 2026-08-22: the `$env:LOCALAPPDATA\claude-kit\resume-relay` directory, the `claude-resume-relay.lnk` Startup shortcut, and a running `AutoHotkey64` with `resume-relay.ahk`, all negative). Section 2 is unblocked; nothing further holds it.
- **On every fleet machine** (the same roster as the relay bullet; registration was opt-in per project directory and no record identifies registrants, so the check runs everywhere, one command each): `Get-ScheduledTask claude-kit-stop-failure-watcher`; if present, unregister via `doctor -Fix -UnregisterStopFailureWatcher` before updating the plugin there (after the update the flag no longer exists and a surviving task would call a missing script every 15 minutes). NEO-CLAUDE verified absent 2026-08-22.
- **One-line check in the channels broker repo** (`sapplefeld-channels`): grep it for `stop-failure-latest.json` and `stop-failure-resumed.json` (the archived spec named the broker as a potential second reader of those marker files, for a status line on the Discord card it posts). No reader found: done. A reader found: confirm it tolerates the files being absent, which is already its steady state on any machine that never logged a failure, or remove that reader on the broker's side; nothing in this plan blocks on it.
- **After the plan completes**: update the installed plugin on each machine promptly. An installed cache whose manifest still names `stop-failure-log.js` reports the file missing until the reinstall (the canary reads the cache's own manifest), so the update is the step that quiets it.

## Open Questions

None.

## Related

- `../archive/claude-kit_stop-failure-recovery_spec_v1.md` (what shipped; its :187 records the supersession this plan acts on).
- `../archive/claude-kit_compaction-unwind_spec_v1.md` (removed the relay; the cleanup block this plan removes was its transitional hygiene).
- `../archive/claude-kit_compact-session-removal_spec_v1.md` (the kit's removal-effort precedent; verified orphan-free 2026-08-22).

## Chapters
