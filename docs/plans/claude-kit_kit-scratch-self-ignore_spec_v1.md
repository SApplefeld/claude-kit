# The kit's scratch folder keeps itself out of git wherever the kit creates it

Status: In Progress
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
- `claude-kit_guards-and-registry-audit_spec_v1.md` and `claude-kit_leash-status-truth_spec_v1.md`: share a library file each.

## Chapters

### Interim board 1 - 2026-09-23

- State: section 1 dispatched to implementer-sonnet on the brief at .kit/scratch/scratch-ignore/brief-s1.md, asked to write the helper, route the five sites through it, write the section's tests red-first, and return the security-model paragraph for the main thread to place (the docs-write guard refuses an implementer's docs/ write).
- Status header set from Ready to In Progress at the start of this run; the leash is armed for this plan as the run's own arming.
- Gate baseline (section lane: kit-compact-gate, kit-goal-lib, memory-recognition-nudge, hook-canary and size-ratchet suites, after build.ps1), 2026-09-23 on this machine, clean worktree at 65ba77fc, no foreign test runner: 758 tests, 758 pass, 0 fail, exit 0, 101 s.
- Declared default for the brief: where the helper finds the created .kit/ is not a directory under lstat, the four creators other than the nudge skip the marker and write as they do today; the nudge keeps its existing early return.
- memq recall was not run: the operator's standing constraint for this run bars memq against the real ~/.claude.
- Next: adjudicate the implementer's report, verify, then the review pair.
