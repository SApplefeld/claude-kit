# The kit's scratch folder keeps itself out of git wherever the kit creates it

Status: Complete
Commit Model: Branch-and-PR
Created: 2026-09-23

Session model: the kit worker persona, on the steward's handoff by name; one section at sonnet. Authored by the architect persona on ASR-CLAUDE from the kit worker's backlog round of 2026-09-23.

## Dispatch Authorization

The kit worker persona sent five ranked backlog candidates to the steward on 2026-09-23. The operator approved all five and the steward relayed the ruling to the architect as coordinator record `ARCHITECT-8d67c288-dd78-478d-a565-e390d50027b0-18`. This plan carries the worker's item 5. The implementer is the kit worker persona, a session that runs this plan under the kit's executing-work skill; the steward is the session that hands it the plan, and the architect is the session that wrote it.

The steward hands this plan to the kit worker persona by name, and that handoff is the assignment. It runs on `origin/main` as it stands and waits on no other plan. It shares `kit-compact-lib.js` with the guards-and-audit plan and the leash-status plan, and `kit-goal-lib.js` with the leash-status plan, in different functions, so whichever lands later rebases on what merged; a plan already merged when this one starts is simply in the trunk it cuts from.

## Goal

Every site in the kit that creates a `.kit/` scratch folder inside a project creates it through one exported helper that also writes `.kit/.gitignore` containing `*`, and writes that marker into a `.kit/` that already exists without one, so a project that installs the kit and never added `.kit/` to its own ignore list cannot commit the goal state's plan paths, the checkpoint or the gate's journal with its session id on the next `git add -A`, whether the folder is new or predates the update.

## Intent

The operator's frame, in the kit worker's words he approved: a guard that already works in one place reaches the other five.

Done means the five creation sites that write into a project call the helper, the helper attempts the exclusive marker create on every call so an existing unmarked `.kit/` gains the marker on its next write through any site, an existing marker is never overwritten, and a test drives each public entry that creates the folder and finds the marker beside what it wrote.

Done does not need a change to the root `.gitignore` of any repository, a doctor change, or a marker under the canary's own fixture, which sits under a temporary directory the probe deletes and which no repository can commit. It does not remove the doctor's after-the-fact exposure check.

Alternatives refused:

- Adding the marker write beside each `mkdirSync`. Refused, because six inline copies is the shape that left five of them without it.
- Relying on the consuming repository's `.gitignore`. Refused by the item as approved: nothing enforces it, and the payload under `.kit/` carries plan paths and a session id.

Rulings after the spec shipped: none yet.

Provenance: distilled by the architect persona, session `30d6d808-ccad-45e4-a606-c868636ee4e4`, from the kit worker's backlog round and one reconnaissance sweep over the checkout at `8005c9b5`.

## Evidence

Read at `8005c9b5` on 2026-09-23, all under `plugins/claude-kit/hooks/`.

- `kit-compact-lib.js:518` (`putCheckpoint`), `1759` (`gateScratchTarget`) and `2977` (`writeMarkerFile`, reached from `writeRoleBoundary` and `writeConsent`) each call `fs.mkdirSync` on a path under `kitScratchDir(cwd)` and write no marker. `kitScratchDir` returns `<cwd>/.kit` or a home-anchored path when `cwd` sits inside the memory store.
- `kit-goal-lib.js:880` (`writeState`) creates the parent of `goalPath(cwd)`, which is `<cwd>/.kit/goal-state.json` at 90, and writes no marker.
- `memory-recognition-nudge.js:2258` (`appendNudgeLog`) creates `<root>/.kit` and calls `ensureKitIgnored` at 2266, defined at 2213-2217, which writes `.kit/.gitignore` with content `*\n` under the `wx` flag.
- `hook-canary.js:434` (`makeGoalFixture`) creates `.kit` under an `fs.mkdtempSync` directory the probe deletes at 467-470, for the canary's own goal-stop probe, and writes no marker. That file requires no kit library at 60-64 and probes shared libraries in a child so a broken one is reported; a library required inside `makeGoalFixture` would turn a load failure into a silently skipped probe at 473.
- `memory-recognition-nudge.js:2263-2265` re-screens the created path against a symlinked `.kit/` between the create at 2258 and the marker write at 2266, since a recursive create walks through a link.
- Other `mkdirSync` calls in the four hook files create paths outside `.kit/`: `memory-recognition-nudge.js:1166` (a state directory under the temp directory), `kit-goal-lib.js:2715` (the events sink `KIT_EVENTS_PATH` names, default under the home directory) and `hook-canary.js:431` and `457` (fixture directories).
- `docs/security-model.md:839` credits the nudge as the one creator that writes a self-ignoring rule, because it runs on every tool call, and catalogs which `.kit/` writes screen the `.kit` component.
- Each of the six sites creates `.kit/` itself or the parent of a direct child of it: `checkpointPath` at 87, `roleBoundaryPath` at 2604 and `consentPath` at 2611 in `kit-compact-lib.js` and `goalPath` at `kit-goal-lib.js:90` all name a file directly under the scratch directory, so `path.dirname` of each is the scratch directory. The `mkdirSync` at `kit-goal-lib.js:2715` creates the parent of the events sink, a path `KIT_EVENTS_PATH` names outside the scratch directory, and is not a creation site.
- No shared helper exists. `kit-goal-lib.js` requires `kit-compact-lib.js` lazily inside functions at 201 and 235, and `kit-compact-lib.js` requires `kit-goal-lib.js` at module top at 42, so a helper in `kit-compact-lib.js` is reachable from every creator by a lazy require. `memory-recognition-nudge.js` already requires it lazily at 2689; `hook-canary.js` takes the same lazy form.
- `test/kit-compact-gate.test.js:5700-5728` pins that the gate creates no `.kit/` for an ungoverned project. No test names `.gitignore` under `.kit/`. The doctor's exposure step at `doctor.ps1:1516-1556` detects an unignored `.kit/` after the fact.

## Decisions

1. The helper lives in `kit-compact-lib.js` beside `kitScratchDir`, exported, taking the scratch directory path. It creates the directory recursively, re-screens the created path against a symlink as the nudge does at 2263-2265, and then attempts the marker with an exclusive create on every call, ignoring an existing file. `memory-recognition-nudge.js`'s `ensureKitIgnored` and its re-screen retire into it.
2. The five sites that write into a project call it: `putCheckpoint`, `gateScratchTarget`, `writeMarkerFile`, `writeState` and `appendNudgeLog`. The canary's fixture keeps its own `mkdirSync`, since its `.kit/` lives under a temporary directory the probe deletes and routing it through a kit library would let a load failure silently skip the probe. The check is a plain search over the four in-scope hook files for `mkdirSync`: the hits outside the helper are exactly `memory-recognition-nudge.js:1166`, `kit-goal-lib.js:2715` and `hook-canary.js:431`, `434` and `457`, each creating a path the Evidence names as outside a project's `.kit/`. Each site passes the scratch directory itself, `kitScratchDir(cwd)` or `path.dirname` of a direct child, never a subfolder.
3. The marker is attempted wherever the helper is called, the home-anchored store path included. A marker under a folder no repository holds costs one file and guards the day a repository appears there. `docs/security-model.md`'s paragraph at 839 is rewritten to credit the helper and to catalog the marker write beside the other `.kit/` writes.

## Approach

**Coverage sweep.** One sweep ran on 2026-09-23 over `8005c9b5` for `.kit`, `mkdirSync`, `kitScratchDir`, `ensureKit` and `gitignore` over `plugins/claude-kit/hooks/`, `plugins/claude-kit/scripts/`, `plugins/claude-kit/doctor/` and `test/`. The six sites the Evidence lists are the whole set; the doctor creates nothing.

**Build.** A change under `plugins/claude-kit/hooks/` is hashed into the build stamp, so each section's gate runs `build.ps1` at the repository root (`build.sh` on POSIX) before the suite, the step the kit's executing-work skill names for a hooks change.

## Sections of Work

### 1. One helper creates the folder and its marker at all six sites
Model: sonnet

Decisions 1 to 3. Sonnet because the helper is the existing `ensureKitIgnored` and its re-screen plus a `mkdirSync`, and each site is a one-line replacement.

Tests: lock that `writeState`, `putCheckpoint`, `gateScratchTarget` on a project with an armed goal and no `.kit/` yet (the one branch at `kit-compact-lib.js:1756-1759` that creates it), `writeRoleBoundary` (which covers `writeConsent`, the same `writeMarkerFile` site) and `appendNudgeLog` each leave `.kit/.gitignore` containing `*` beside what they wrote, red against the unchanged sites for the four that write none today; that a `.kit/` created unmarked before the change gains the marker on the next `writeState`, red against the unchanged site; that an existing marker with other content is left as it was, a green-only case since the exclusive create already behaves so at the one site; that a symlinked `.kit/` takes no marker through the link; and that the ungoverned-project case at `test/kit-compact-gate.test.js:5700-5728` still creates nothing.

Acceptance:
- A plain search over the four in-scope hook files for `mkdirSync` finds the helper's own call and the five hits decision 2 names outside `.kit/`, and nothing else; the five former sites call the helper.
- `ensureKitIgnored` no longer exists in `memory-recognition-nudge.js`, and the symlink re-screen lives in the helper.
- `docs/security-model.md`'s paragraph at 839 credits the helper and catalogs the marker write.
- Each red run is quoted in the Chapter, and `node --test test/*.test.js` exits 0 after the build, with the baseline recorded first.

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`, `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/hooks/memory-recognition-nudge.js`, `docs/security-model.md`, `test/kit-compact-gate.test.js`, `test/kit-goal-lib.test.js`, `test/memory-recognition-nudge.test.js`, `test/size-budget.json` where a suite's cap moves.

## Out of Scope

The surfaces this plan changes are closed at the section's Files in scope. Named exclusions:

- The doctor's `.kit/` exposure step.
- The root `.gitignore` of this repository and of any consuming one.
- What each creator writes under the folder.
- The events sink at `kit-goal-lib.js:2715`, which writes where `KIT_EVENTS_PATH` points.
- `hook-canary.js`, whose fixture `.kit/` lives under a temporary directory the probe deletes.

## Assumptions

- assumed 2026-09-23 (source: the repository's plans): the commit model is Branch-and-PR; reversal: one header line.
- assumed 2026-09-23 (the architect): the worker runs under the kit, whose executing-work skill owns the red-then-green rule, the reviewer pair, the hooks build step and the Chapter.
- assumed 2026-09-23 (default): the helper takes the directory path rather than a `cwd`, since two creators pass a parent computed from a file path; reversal: one signature.

## Operator Verification

- After the pull request merges and the plugin update is installed, arm a goal in a repository whose `.gitignore` does not name `.kit/` and run `git status`: the folder does not appear.

## Related

- `docs/backlog.md` entry retired by this plan at its finalize, now in `docs/archive/backlog-2026-Q3.md`: make `.kit/` self-ignoring (2026-08-16).
- `claude-kit_guards-and-registry-audit_spec_v1.md` (archived) and `../plans/claude-kit_leash-status-truth_spec_v1.md`: share a library file each.
- `claude-kit_doctor-honesty_spec_v1.md` (archived): left the doctor's `.kit/` exposure step as it stands, since this plan makes it less necessary; this plan then corrected the question that step asks git, so a self-marked folder reads as ignored.

## Chapters

### Interim board 1 - 2026-09-23

- State: section 1 dispatched to implementer-sonnet on the brief at .kit/scratch/scratch-ignore/brief-s1.md, asked to write the helper, route the five sites through it, write the section's tests red-first, and return the security-model paragraph for the main thread to place (the docs-write guard refuses an implementer's docs/ write).
- Status header set from Ready to In Progress at the start of this run; the leash is armed for this plan as the run's own arming.
- Gate baseline (section lane: kit-compact-gate, kit-goal-lib, memory-recognition-nudge, hook-canary and size-ratchet suites, after build.ps1), 2026-09-23 on this machine, clean worktree at 65ba77fc, no foreign test runner: 758 tests, 758 pass, 0 fail, exit 0, 101 s.
- Declared default for the brief: where the helper finds the created .kit/ is not a directory under lstat, the four creators other than the nudge skip the marker and write as they do today; the nudge keeps its existing early return.
- memq recall was not run: the operator's standing constraint for this run bars memq against the real ~/.claude.
- Next: adjudicate the implementer's report, verify, then the review pair.

### Interim board 2 - 2026-09-23

- State: section 1 first-green at 6b2bac51 (section lane 769/769, exit 0, 97 s after build.ps1, against the 758/758 baseline). The review pair (adversarial and blind, opus, effort high) found a seventh creator, jev-judge.js appendShown, and the gate's existing-folder leg unmarked; the fix round is 4203ded1 and a fresh adversarial re-review of that delta is running.
- Scope widened, declared: plugins/claude-kit/scripts/jev-judge.js and test/jev-judge.test.js join Files in scope, because the Goal names every site in the kit and that file landed after the plan's coverage sweep at 8005c9b5.
- Operator ruling received on the relay, decided 2026-09-23: the doctor honesty plan's signpost refusal under -Fix is accepted as declared drift, and the unrelated controller-tick goal is not added to this queue.
- A whole-gate run on the unmerged tree was stopped by choice: PR #103 merged at 23:34Z, so origin/main is merged in first and the whole gate runs once over the merged tree.
- Next: adjudicate the re-review, merge origin/main, build, whole gate, Chapter 1, finishing-work.
- Re-review of the fix round (adversarial, opus, effort high): all eight prior findings closed. Two further fixes landed: a test for the failed-marker-write cleanup, and the doctor's exposure step, which asked git about .kit itself and so read every self-marked folder as exposed. Scope widened again, declared: plugins/claude-kit/doctor/doctor.ps1 and test/doctor-kit-exposure.test.js. Out of Scope named the doctor's exposure step to keep the check; the change keeps it and corrects what it asks.

### Chapter 1 - 2026-09-23

Completed: 1. One helper creates the folder and its marker at all six sites

- What shipped: `ensureScratchDirIgnored(dir)` in `kit-compact-lib.js`, exported beside `kitScratchDir`. It creates the folder, re-screens its final component by lstat, and attempts an exclusive create of `.gitignore` containing `*` on every call, removing the file if the write after the create fails. Callers: `putCheckpoint`, `gateScratchTarget` (both legs), `writeMarkerFile` (role boundary and consent), `writeState`, `appendNudgeLog` and `jev-judge.js`'s `appendShown`. `ensureKitIgnored` and the nudge's inline re-screen are gone. The doctor's exposure step now asks git about `.kit/goal-state.json` rather than `.kit`. `docs/security-model.md` carries the marker catalog in its own paragraph.
- Commits: 6b2bac51 (first green, implementer-sonnet), 4203ded1 (review fix round), f7b669c6 (re-review fix round and doctor), 372598c7 (merge of origin/main at ca2e574e, carrying doctor honesty #103).
- Scope widened twice, declared: `plugins/claude-kit/scripts/jev-judge.js` and `test/jev-judge.test.js`, because the Goal names every site in the kit and that creator landed after the 8005c9b5 coverage sweep; `plugins/claude-kit/doctor/doctor.ps1` and the new `test/doctor-kit-exposure.test.js`, because the exposure step asked git about the folder itself and would have warned, untruly, on every folder this plan marks. Out of Scope named the doctor's exposure step so the check would stay; the change keeps it and corrects what it asks.
- Assumptions: where the helper finds the created `.kit` is not a directory under lstat, only the nudge refuses its write; the other callers write as their own screens decide (declared default, interim board 1). The `gateScratchTarget` create-branch test runs on the store-backed scratch path, since in an ordinary project arming a goal already creates `.kit/`.
- Red runs:
  - Implementer (reported from its run against the 65ba77fc sources): `node --test --test-name-pattern="gitignore|ensureScratchDirIgnored|gateScratchTarget creates|writeState \(through|gains the marker"` over the three suites read 10 tests, 2 pass, 8 fail: `ensureScratchDirIgnored is not a function` (two unit tests) and `ENOENT ... .kit\.gitignore` (six integration tests). The two that stayed green are the existing-marker case (green-only by the plan's own Tests line) and the nudge's marker, which the nudge already wrote.
  - Fix round, confirmed: `gate: a gate record written into an existing unmarked .kit gains the marker there` failed with `ENOENT ... .kit\.gitignore`; `appendShown leaves .kit/.gitignore containing star` failed with `ENOENT ... .kit\.gitignore`.
  - Re-review round, confirmed: `a .kit/ that carries its own ignore-everything marker reads as ignored` failed with `actual: 'WARN'` ("neither tracked nor ignored"), its two controls green; `a marker write that fails after the create leaves no empty marker` failed with `a failed write leaves no marker behind` against the 6b2bac51 helper, restored by copy and verified by cmp.
- Reviews: pair at opus, effort high (adversarial CHANGES_REQUIRED, blind APPROVED_WITH_CONCERNS). Both found the jev-judge creator; the adversarial found the gate's existing-folder leg; the blind found the empty-marker residue. All fixed, with the comment corrections, the duplicate test removed and the symlink test unpinned from the documented follow-through residual. Adversarial re-review of 4203ded1 at opus, effort high: APPROVED_WITH_CONCERNS, all eight closed; its test-gap and doctor findings are fixed in f7b669c6.
- Declined, with reasons: a `.kit` deleted between the gate's lstat and the helper's create is recreated without re-checking the goal (a window of two syscalls on a folder that existed a moment before); the symlink test no longer proves the helper was reached (the helper's own unit test pins the refusal directly); memq's lock helper can recreate `.kit` unmarked if the folder is deleted between `updateShown`'s existence check and its lock (the same narrow window); the gate now marks a tracked `.kit/` another tool owns (the Goal asks for exactly this, and the nudge already did it).
- Tests: 16 net (11 by the implementer, one of those removed as a duplicate, six in the fix rounds: two in `kit-compact-gate`, one in `jev-judge` and three in the new `doctor-kit-exposure`), plus one pin entry in `memq-grant`.
- Lane: section lane (kit-compact-gate, kit-goal-lib, memory-recognition-nudge, hook-canary, size-ratchet) after build.ps1 at 6b2bac51: 769 tests, 769 pass, exit 0 from the marker, 97 s, against the 758/758 baseline. Widened lane with jev-judge at 4203ded1: 810 tests, 809 pass, the one fail the exclusive-open spy counting the marker's create; after narrowing the spy, jev-judge plus size-ratchet 139/139, exit 0.
- Gate: whole gate `node --test test/*.test.js` over the merged tree at 372598c7 after build.ps1, no foreign test runner: 4103 tests, 4093 pass, 2 fail, 8 skipped, exit 1 from the marker, 490 s. One fail was mine: `test/memq-grant.test.js` pins every require in the libraries memq loads and did not know `writeState`'s new lazy load of kit-compact-lib.js, which the section lane never ran; the pin gained that entry and the suite reads 153/153 with size-ratchet, exit 0. The other is the standing linked-worktree fail in `test/kit-sidecar-memory-index.test.js` ("loadIndex answers a status, never a throw, for a cwd the store refuses to name"), which passes from the primary checkout.
- Commit Model: Branch-and-PR.
- Next: finishing-work.

### Chapter 2 - 2026-09-23

Completed: finishing-work

- QA (qa-verifier, opus): every behavior criterion passed with evidence. That covered the mkdirSync grep with a control at 65ba77fc, the six helper callers, a targeted lane of 806/806 (exit 0), and an end-to-end arm in a fresh repository. That repository had no root .gitignore and its HOME was redirected. After the arm, `git status --porcelain --untracked-files=all` listed nothing under `.kit/`. In the control run, with the marker removed, it listed `.kit/goal-state.json`. QA failed two record items, and this Chapter closes both: no whole gate exiting clean against a whole-gate baseline, and the added tests not named with their requirements.
- Final review (adversarial at fable, effort high, with the performance and security lenses folded in): APPROVED_WITH_CONCERNS. One Major [security]: my previous doctor fix asked git about the single name `.kit/goal-state.json`, so a root `*.json` rule read PASS while `.kit/compact-gate.jsonl` stayed exposed. Fixed in b3670b13. The step now requires both that `git ls-files --others --exclude-standard -- .kit` lists nothing and that the extensionless probe `.kit/kit-exposure-probe` is ignored. Two new cases each pin one of those questions, and both failed with `actual: 'PASS'` before the fix. The security-model sentence claiming every writer uses the helper now names the memq lock-helper route. Declined:
  - Batching the doctor test's spawns. The trade: `test/doctor-kit-exposure.test.js` spawns one Windows PowerShell per case (five), each about 0.35 s. That buys an independent real repository and a fresh doctor section per case.
  - The [performance] syscall count. On an existing folder the gate's scratch leg goes from 2 to 7 syscalls, and it is reached on gate decisions and fired hold directives, never per tool call. The one trim is to let the helper return its lstat. It is left, as a gain under a millisecond on a path that is not hot.
- Goal read (scope-adjudicator, opus). The first brief carried the plan's Decisions section; the adjudicator refused it, and it was re-sent without that section. Rulings:
  - REFUSE, on precedence under Out of Scope, for the doctor exposure step, jev-judge.js and the memq-grant pin. The adjudicator noted that deleting any of them defeats the Goal or reddens acceptance bullet 4. So they go to the operator as one ask, sent on the relay with a recommendation to ratify.
  - ACCEPT-AND-DECLARE for the helper's cleanup of a half-written marker.
  - Promised but unbuilt, part 1: a test driving `recordHoldNudge`, the hold-stamp entry that creates the folder through the gate scratch leg. It is added now, red with ENOENT on the marker against the 6b2bac51 library and green after. The library was restored by copy, verified by cmp and matched against HEAD.
  - Promised but unbuilt, part 2: memq's lock helper, which can recreate `.kit/` unmarked in a narrow window. It stays a documented residual outside the plan's files and goes to the backlog.
- Whole-gate baseline: `test/kit-sidecar-memory-index.test.js` ("loadIndex answers a status, never a throw, for a cwd the store refuses to name") fails the same way at origin/main ca2e574e, run in a temporary detached linked worktree that was then removed. That makes it a baseline fail, not one this branch introduced.
- Tests added, each with the requirement it pins (19):
  - kit-compact-gate:
    - "ensureScratchDirIgnored creates the directory and marks it, and is idempotent" (create, mark, never overwrite)
    - "ensureScratchDirIgnored refuses a symlinked directory" (a final-component link earns no marker)
    - "putCheckpoint leaves .kit/.gitignore" (putCheckpoint site)
    - "writeRoleBoundary and writeConsent leave .kit/.gitignore" (writeMarkerFile site)
    - "a marker write never overwrites an existing .kit/.gitignore" (existing marker untouched)
    - "putCheckpoint attempts no marker through a symlinked .kit" (link refusal through a site)
    - "gateScratchTarget creates the store-backed scratch directory marked" (gate create leg)
    - "a gate record written into an existing unmarked .kit gains the marker there" (gate existing leg)
    - "a marker write that fails after the create leaves no empty marker" (failed-write cleanup)
    - "recordHoldNudge leaves .kit/.gitignore" (hold-stamp entry)
  - kit-goal-lib:
    - "writeState (through armGoal) leaves .kit/.gitignore" (writeState site)
    - "a .kit created unmarked before this update gains the marker on the next writeState" (retrofit)
  - memory-recognition-nudge: "appendNudgeLog leaves .kit/.gitignore" (nudge site)
  - jev-judge: "appendShown leaves .kit/.gitignore" (shown-file site)
  - doctor-kit-exposure:
    - "a .kit/ that carries its own ignore-everything marker reads as ignored" (self-marker reads PASS)
    - "a .kit/ ignored by the root .gitignore reads as ignored" (root rule reads PASS)
    - "a .kit/ nothing ignores still warns" (open folder WARN)
    - "a root rule that matches only some file names warns" (probe question)
    - "a folder rule with a negation that re-exposes a present file warns" (present-files question)
  - Also one pin entry in memq-grant for writeState's lazy load.
- Gate: whole gate `node --test test/*.test.js` at b3670b13 after build.ps1, with the process poll reading 0 foreign runners: 4105 tests, 4096 pass, 1 fail, 8 skipped, exit 1 from the marker, 510 s. The one fail is the baseline linked-worktree case above, so this is clean against baseline. After that run only the hold-stamp test was added, and its suite plus size-ratchet read 433/433, exit 0. After the close edits (two source comments and the docs), build.ps1 then archive-chain, size-ratchet, hook-canary, doctor-kit-exposure and doctrine-parity read 251/251, exit 0.
- Docs: the docs curator updated `docs/security-model.md` (the goal-state paragraph, which still credited the nudge alone, and the marker paragraph), `docs/architecture.md` (the doctor exposure passage and the nudge log passage) and `docs/README.md`. Drift D1, D2, D4 and D5 accepted as documented. D6 fixed at this close: two source comments this plan made untrue, the doctor exposure header ("not one the kit can impose") and `projectGateEpisode`'s header ("computed without writing anything"; the shared scratch leg can now write the marker). D3: Chapter 1's line that the doctor asks about `.kit/goal-state.json` is superseded by b3670b13, where the step asks the two questions above. H1 (the stale plans index entry) and H2 (the Related line naming an archived plan as live) fixed at this close.
- Commit Model: Branch-and-PR. The pull request opens ready. Auto-merge waits on the operator's ratification of the three scope widenings.
- Next: none. Plan complete and archived.
