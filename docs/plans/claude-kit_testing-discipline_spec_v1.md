# Testing discipline becomes kit shape: one skill owns how a test is built and how a suite is run

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-27

Session model: Opus, in a clean session opened in the kit repo. Authored by the KIT: Expert seat from the 2026-08-26 kaizen cluster on suite cost, under the operator's decision of 2026-08-26 (relay thread) that the test discipline becomes kit shape and his 2026-08-27 directive, relayed by the machine coordinator, that this is the standalone first spec of the slate and runs as soon as possible, because gate cadence is slowing all plugin-based work on every VM. Anchors below are as of commit `8d2ecd1`; re-locate by content.

## Goal

The suite's wall clock is spent at the gate cadence, not the test count: one evening on SCOTT-CLAUDE priced a single section's fix rounds at four full-suite runs, with every red of the evening a contention flake, while a grep of every plan and archived plan found ten review-found defects for zero test-caught ones. The guidance that would fix this is scattered across the doctrine's verify bullets, executing-work's gate steps, and the two language style skills, so each effort re-derives it and each dispatch brief restates it.

When this plan is done: a `testing-discipline` skill owns the litmus for writing a test, the cost shapes, the lanes, the red protocol, and the contention rule; the doctrine's gate bullet prices a fix at the targeted lane and reaches the whole gate at four named moments; executing-work and the dispatch brief point at the skill instead of restating it; and the three tests with recorded reliability defects take their recorded fixes, so a main-lane red is a signal rather than a re-run ritual.

## Evidence

- The cadence cost, reported from the 2026-08-26 kaizen notes (coordinator-measured, `kaizen/notes-SCOTT-CLAUDE.md` at this plan's creation): the kit suite at 333 s quiet and 816 s beside a second suite at the same commit; four full runs on one section's fix rounds; every red of the evening a contention flake discriminated solo-then-class; ten review-found defects and no test-caught one in a grep of every plan and archived plan. The operator raised it on the relay thread as "we are writing too many tests."
- Fresh counts, confirmed 2026-08-27 by this authoring session: 34 files match `test/*.test.js` (Glob), and 32 of them contain spawn-class calls at 239 sites (`grep -E "spawnSync|execSync|execFileSync|fork\(|spawn\(" test/`). The 2026-08-26 note counted 29 of 31 files at 195 sites: the suite grew three files in a day, which is the growth-rate half of the evidence and the reason Standing Amendment 1 exists.
- Wording asserts: 1,323 of 6,957 asserts on stderr or stdout wording (reported, 2026-08-26 note; re-measure before acting on the figure).
- The shapes that catch defects, reported from the 2026-08-26 census (a walk of plan archives, 400 commits per repo, five strongest citations re-read by the coordinator seat): eleven regression saves and eleven red-first catches against roughly two hundred review-found defects; the saves were whole-tree reflection pins, derived pins that scan a source file, cross-surface count assertions, region-extraction tests over real code, and fixture self-checks. Single-function behavior mirrors almost never appear among the saves and dominate the intentional-change breakages and the wording-assert population. The review rounds stay: the ten-to-one ratio is theirs.
- The blind spot the shared setup buys: every pre-existing memq network test sets the store pin, which routes around the cwd walk entirely, so the suite went green over a hang every unpinned session hit (the memory-anchors plan's Section 7 Critical; `docs/plans/claude-kit_memq-network-cwd-resolver_spec_v1.md` restates it as its own control).
- The doctrine bullets to amend live in two copies held identical by `test/doctrine-parity.test.js` (the two path constants at :35-:37; the identity and pinned-phrase assertions follow them): `plugins/claude-kit/skills/operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md`. The three bullets: the gate bullet ("After each step, re-run the whole gate and report the delta"), the box-check bullet ("One heavy process at a time is a per-machine budget", which enumerates `testhost`, `dotnet`, or a build, and which a session followed exactly while missing a live `node --test` gate), and the authoring bullet ("Write tests independent by construction, and price what they spawn").
- Suite invocation: `node --test "test/*.test.js"`, the quoted-glob form; the bare directory form fails MODULE_NOT_FOUND on Node 24.19.0 (project memory `test-suite-invocation`; the memory store lives outside the repo and is read with `memq get <name>`, mechanics owned by the memory-system skill).
- The three tests with recorded reliability defects, each root-caused in `docs/backlog.md` with its fix named: the merged-PR push guard's block test (the test inherits the hook's 8-second production `execSync` budget, which a loaded box exceeds, flipping the fail-open hook; entry dated 2026-08-04); the memq stale-lock race (a timing window standing in for a readiness signal, roughly 1 run in 4 red under a full suite, its assertion text never captured; entry dated 2026-08-01); and the memq type-lock contention test (its subject is the machine-global type tier, so a sibling session's memq write is indistinguishable from the rival writer under test; entry dated 2026-08-26). A fourth, an intermittent memq-shim test, has no captured cause (project memory `suite-baseline-is-not-zero-fail`).

## Approach

- **The skill owns; every other surface points.** One owner per rule, per the writing-skills skill. The doctrine keeps the principle and the moments a gate runs; the litmus, the cost shapes, the lane mechanics, the red protocol, and the contention rule live in the skill, and executing-work's brief references them instead of restating them.
- **The lanes price the cadence.** The targeted lane (the changed files' tests) runs after each fix; the whole gate runs at section close, at finishing, and before a push; the whole gate runs after a fix round only when the delta touches a shared module. This is the highest-payoff change in the cluster: it converts the measured four-full-runs evening into one targeted run per fix plus one whole gate at close.
- **The litmus keeps what catches defects and names what to thin.** The invariant-across-the-tree class is kept by name; single-function mirrors and exact-wording asserts are named as the thinning class for new authoring. Nothing retrofits the existing suite here (Out of Scope names the boundary).
- **A red is discriminated by protocol, not by re-running the world.** Solo, then class, then a full re-run with no code change; the exit and the discriminating output come from the run's own marker, never the wrapper's notification.
- **Contention is recorded, not discovered.** A wall-clock figure carries the box's contention state beside it, and growth is a finding only against comparable contention. The suite that varies by 2.5x with a neighbor is the evidence.
- **The skill is kit-wide; per-repo facts stay in memory.** The skill states the discipline; a repo's exact invocation and lane commands live in that project's memory tier, where `test-suite-invocation` already lives for this repo.

## Assumptions

- Skill name and path: `plugins/claude-kit/skills/testing-discipline/SKILL.md` (declared 2026-08-27; no existing skill owns the territory, confirmed against the 22 skills on disk; reversal is a rename before the next plugin update ships it).
- Status set to In Progress at authoring under the operator's relayed 2026-08-27 ASAP directive; arming remains the operator's grant, and this plan carries no `## Dispatch Authorization` section because an authorization section the authoring seat itself wrote is not a warrant (peer-sessions rule). The operator or a session holding his grant arms it. An executing session checks the grant the way any leashed run does: the SessionStart notice names an armed plan, and `/kit-goal` with no arguments reports what is armed (the kit-goal skill owns the mechanics); until one of those names this plan, execution has not been authorized and there is nothing to run here.
- The one-suite-per-box claim file (the 2026-08-26 artifact-first coordination note) is a seat-infrastructure deliverable, not this plan's; the box-check bullet here is written engine-agnostically in a way that composes with it later (declared 2026-08-27).

## Standing Brief Amendments

1. A counted claim about the suite (file counts, call-site counts, assert tallies, wall clocks) is measured by the section that states it, with the measuring command named beside the number, never copied forward from this spec's Evidence, a kaizen note, or a memory. The Evidence figures above were one day stale at authoring; treat them as scale, not fact.
2. Every test this plan adds or edits runs green under the suite's parallel runner and owns its own temp state. A test whose subject is genuinely machine-shared state says so and lives in the contention lane Section 4 defines, never in the main gate.

## Sections of Work

### 1. The testing-discipline skill exists and owns the discipline

Model: fable

Create `plugins/claude-kit/skills/testing-discipline/SKILL.md` per the writing-skills skill: the frontmatter description states the trigger and the symptoms, never the workflow, and is quoted. The body owns, as the single owner every other surface will point at:

- **The litmus for writing a test.** What earns one: an implementer's acceptance criterion; a path no human drives by hand (a hook, a CLI); a cross-surface pin where a writer and a reader share a value; a defect that happened. What never does: an implementation mirror; an exact-wording assert on stderr or stdout text. The defect-catching class by name: an invariant pinned across the whole tree (roster and reflection pins over every member of a family, derived pins that scan a source file, cross-surface count assertions, region-extraction tests over real code, fixture self-checks), with one whole-tree pin per new member of a family preferred over one test per function. Close the enumerations with their class per writing-skills.
- **The shared-setup coverage gap.** When every test in an area shares the setup that avoids a hazard, the area is structurally blind to that hazard; pin it with one test that does not share the setup. The memq store-pin blindness is the evidence to cite.
- **The cost shapes and their cheaper forms.** A spawn per assertion versus a spawn per batch; a fixture built per test versus built once per process and copied; a fixed port or shared mutable state versus an owned temp dir; a real spawn only where a shell, CLI, or cross-process boundary is itself the subject.
- **The lanes, and which gate moment takes each.** Targeted after each fix; whole at section close, at finishing, and before a push; whole after a fix round only when the delta touches a shared module; the contention lane apart from the main gate, run serially at finishing and before a push.
- **The red protocol.** Capture the exit code and the discriminating output from the run's own marker; solo, then class, then a full re-run with no code change; name flake or regression with the reason before moving on.
- **The comparable-contention rule.** Record process count and free memory beside every wall-clock figure; read growth as a finding only against comparable contention or a same-conditions trend.
- **The box check, engine-agnostic.** Before any suite, check for any test runner or build owned by another session, whatever its engine; the named runners are instances, not the boundary.

Baseline discipline per writing-skills: for each behavior-shaping rule, a RED probe where the failure reproduces; where the RED is contaminated because the rule sharpens doctrine a probe subagent already inherits (writing-skills' "Doctrine-adjacent rules have a contaminated RED" paragraph), record the point-of-action rationale instead. The Chapter records which rules stand on which footing.

Tests: the doctrine and output-style parity suites untouched and green (this section edits no doctrine copy); the skill file's frontmatter parses (quoted description). The presence pin for the deferring doctrine bullets is Section 2's deliverable, not this one's.

Files in scope: `plugins/claude-kit/skills/testing-discipline/SKILL.md`.

### 2. The doctrine prices the lanes and stops naming one engine as the box

Model: opus

Amend, byte-identically in both parity copies (`plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`):

- **The gate bullet** ("After each step, re-run the whole gate and report the delta"): after each fix, the targeted lane; the whole gate at section close, at finishing, and before a push; the whole gate after a fix round only when the delta touches a shared module; a pointer at the testing-discipline skill for the lanes' mechanics. The bullet keeps what it alone owns: the delta report against a recorded baseline, the real exit code, green-necessary-not-sufficient, the flake-versus-regression discrimination duty, and the merge-reddens-a-suite warning.
- **The box-check bullet** ("One heavy process at a time is a per-machine budget"): the engine enumeration (`testhost`, `dotnet`, a build) becomes "any test runner or build, whatever its engine," with the old names kept as instances and the class stated, per the closed-enumeration rule; evidence is the session that followed the bullet exactly and missed a live `node --test` gate.
- **The authoring bullet** ("Write tests independent by construction, and price what they spawn"): shrinks to the principle plus a pointer at the skill; the spawn pricing, wall-clock capture, and comparable-contention detail move to the skill as their single owner.

Before editing, grep `test/` for pinned phrases in every line touched (`doctrine-parity.test.js` carries pinned-bullet assertions beyond the identity check). The pin set is stated, not derived: the gate bullet and the authoring bullet defer content and each earns a presence pin; the box-check bullet is reworded in place and earns none, unless the implementer moves its content into the skill, which adds it to the set. A pin follows the pattern the existing pinned bullets use, because a deferring bullet fails by going quiet: prove each pin red against a copy lacking the bullet, then green. Confirm by grep, not assumption, that the register core (`output-style-parity.test.js`) carries none of the three bullets.

Tests: doctrine-parity red at the mid-edit point (one copy edited) and green at the end, which proves the identity check sees the edit; the new presence pins red-then-green as above; full suite delta zero against the Section 4 baseline or, where Section 4 has not yet run, a baseline this section records first.

Files in scope: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, `test/doctrine-parity.test.js`.

### 3. executing-work and the dispatch brief point at the skill

Model: sonnet

- Step 2's settle-the-test-question paragraph gains the pointer: the testing-discipline skill's litmus decides what earns a durable test.
- The Dispatch Brief template's `Tests:` field gains the pointer so a brief stops restating the litmus; the field's floor-not-ceiling contract is unchanged.
- Step 3's dispatch-ahead-of-the-slow-suites line names the lane it overlaps (the whole gate at section close).
- The brainstorming skill's `Tests:` line paragraph gains one pointer clause at the litmus; its intent-never-design constraint is unchanged.

Before editing, grep `test/` for pins matching any phrase in the lines touched (`doctrine-parity.test.js` pins text inside executing-work's deferral lines; those pins must stay green or be re-derived red-then-green).

Tests: full suite delta zero against the recorded baseline; any pin over edited text re-derived red-then-green.

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/brainstorming/SKILL.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 4. The unreliable tests take their recorded fixes, and contention gets a lane

Model: opus

Baseline first: run the whole suite twice on a quiet box and record pass/fail counts, wall clock, and contention state (process count, free memory) in the Chapter, per the skill's comparable-contention rule. Quiet is observable, not a feel: the box check passes, meaning no test runner or build owned by another session is in the process list at either run; record the contention figures beside each run whatever they read.

- **The merged-PR push guard's block test:** the hook's 8-second `execSync` budget becomes injectable (an environment override read by `plugins/claude-kit/hooks/merged-pr-push-guard.js`, production default unchanged); the test injects a budget sized to its own spawn cost. Red proven by injecting a budget small enough to force the timeout path deterministically, which also pins the hook's fail-open direction.
- **The memq stale-lock race:** the timing window becomes a readiness signal per the backlog entry's named fix, and the suite run that proves it writes its output to a file so the assertion text is finally captured.
- **The memq type-lock contention test:** the test points the shared-tier root at an owned temp directory through the store-pin environment the code already honors, so it measures only its own writers. The backlog entry names `KIT_MEMORY_ROOT`; the implementer confirms the variable the type-lock path actually reads before relying on the name. Control: with the pin removed, a deliberate concurrent writer reproduces the false red, which proves the fix addresses the recorded cause rather than hiding it.
- **The intermittent memq-shim test:** reproduce per the skill's red protocol; root-cause and fix, or, where its subject is genuinely machine-shared, move it to the contention lane with the reason recorded.
- **The contention lane:** `test/contention/*.test.js`, excluded from the main gate's quoted glob by construction, run serially at finishing and before a push. Create the directory only when a test actually moves into it; if the fixes leave nothing contention-bound, the Chapter says so and no empty structure ships. The kit repo's lane commands land in this project's memory (updating `suite-baseline-is-not-zero-fail` and `test-suite-invocation` as the close-out's memory work).

Tests: red first per site as named above; suite delta against the recorded baseline; wall clock re-measured with contention state beside it.

Files in scope: `plugins/claude-kit/hooks/merged-pr-push-guard.js`, `test/merged-pr-push-guard.test.js`, `test/memq.test.js`, `test/memq-shim.test.js`, `test/contention/` (conditional).

## Out of Scope

- Retrofitting the existing suite's spawn batching and wording asserts beyond Section 4's named sites. The skill governs authoring from now on; a measured retrofit is its own plan, opened only if the cadence change leaves the wall clock a bottleneck after real use.
- The one-suite-per-box claim file and cross-session slot discovery: the seat-infrastructure spec owns it (2026-08-26 artifact-first note); the box-check wording here composes with it.
- Hardware: the 2026-08-26 memory-pressure reading (3.5 GB free of 16.7 with 44 node processes) is an operator purchase-or-config question, not a kit change; the authoring Expert seat carries it to the operator in the slate's decision ask, and no section of this plan owes anything about it.
- Other repos' suite mechanics: the skill ships in the plugin and reaches every VM by `claude plugin update`; each repo's lane commands are its own memory tier's business.
- The review-cadence amendments from the same kaizen inbox (the fix-round-delta review rule and its cluster): the review-and-record-discipline spec of this slate.

## Related

- `docs/plans/claude-kit_memq-network-cwd-resolver_spec_v1.md`: its unpinned-test control is this plan's shared-setup coverage-gap pattern applied. Both plans touch `test/memq.test.js` (its Section 1, this plan's Section 4), so the two run sequentially on one worker rather than concurrently: this plan first, per the operator's ASAP directive, with the natural shape being one armed queue in that order. A session discovering the sibling plan's state reads its `## Chapters` block, where an empty block means execution has not started.
- `kaizen/notes-SCOTT-CLAUDE.md`, the four 2026-08-26 notes on gate cadence, the missing testing skill, the defect-catching shapes, and the engine-blind box check: the origin, cleared into this spec at authoring.
- `docs/backlog.md`: the three reliability entries Section 4 executes (2026-08-04, 2026-08-01, 2026-08-26).
- The operator decisions of record: 2026-08-26, relay thread, the test discipline becomes kit shape; 2026-08-27, relayed by the machine coordinator, this is the slate's standalone first spec and runs as soon as possible.

## Chapters

### Chapter 1 - 2026-08-27
Completed: 1. The testing-discipline skill exists and owns the discipline
Implemented By: implementer-fable (dispatched with the explicit fable override this Opus session's tier assignment authorizes; first-turn reading 14 assistant lines, all `claude-fable-5`, no substitution and no `<synthetic>`)
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: The recorded baseline had to be established before anything could be gated, and the first attempt was not a result. Baseline run 1 came back exit 1 with 3 failures, all in `test/hook-canary.test.js`, all reporting the build stamp under `plugins/claude-kit/.claude-plugin/` as stale. Root cause confirmed rather than assumed: the stamp is untracked (`git check-ignore` names `.gitignore:16`), was written 07:10, and merge `ee7a336` at 09:49 rewrote files under `plugins/claude-kit/hooks/`. Git merges lines while the stamp hashes bytes, so the mismatch arrived with no conflict. `./build.sh` refuses on this host (it needs `zip`) and still exits 0, so the rebuild ran through `pwsh -File ./build.ps1`. That rebuild is a change to local untracked state, named here and in the close-out. A second correction inside the same read: the run was briefly called summary-less and therefore unusable, on a grep for `^# tests`; node writes `ℹ tests`, so the summary was present all along and the run was a real result with a real cause.
The section's RED-probe requirement could not be met by the implementer, which has no Agent tool, so the work was split (see Assumptions). Three probes ran, and only one reproduced. The never-list rule (no exact-wording stderr asserts) reproduced decisively: the unguided agent wrote sixteen parameterized full-sentence stderr equality assertions. The whole-tree-pin preference reproduced in half: the agent refused to duplicate the family sweep and added a roster control, then wrote eleven per-function mirrors anyway. The shared-setup blind spot did not reproduce at all: the agent independently found that all twelve fixture-sharing tests pin the variable and the walk is never exercised. That RED is contaminated by doctrine's own control rule, so the rule ships on the point-of-action rationale writing-skills prescribes rather than on a demonstrated failure. Footing per rule is recorded in `.kit/scratch/td-s1-probes.md`; the doctrine-adjacent rules (cost shapes, owned temp dir, red protocol, comparable contention, box check, and the cross-surface pin, whose text is in doctrine verbatim) all ship on that same rationale.
Assumptions: The section's baseline discipline is split between the implementer and the orchestrator, the implementer authoring the skill and classifying each rule as doctrine-adjacent or genuinely new, the orchestrator running the RED probes, because an implementer agent holds no Agent tool and cannot dispatch a probe (route (b), low-blast and reversible, declared 2026-08-27, section 1). The probes returned test code as text and wrote nothing, so no tree-mutating probe ran and the exclusivity dance was not needed (route (b), declared 2026-08-27, section 1).
Review Findings: Adversarial APPROVED_WITH_CONCERNS, blind CHANGES_REQUIRED; 3 Major and 5 Minor between them, 6 fixed, 1 rejected with reason, 1 already in hand. Fixed: the contention lane never ran at section close, so a section changing machine-shared state could close green having skipped the only tests covering it (Major); the red protocol had no rung separating a regression you caused from a pre-existing red, which the doctrine copy carries as its clean-tree step (Major); the wall-clock capture instruction and the growth-is-a-finding-to-route stance would have been orphaned entirely once Section 2 shrinks the authoring bullet that owns them today (Major); the marker requirement was unexecutable for a foreground run and for the isolation-screen case (Minor); the plan-doc citation would dangle by this repo's own archival rule (Minor); the per-spawn cost magnitude, which is the argument for batching, had been dropped (Minor); the contention claim asserted "varies widely enough" with no observable edge (Minor); the litmus class did not cleanly contain its own first instance (Minor). Rejected with reason: the blind reviewer's Major that the lane table contradicts doctrine's after-each-step whole-gate rule. It is real and it is this plan's own sequencing, since Section 2 rewrites that bullet to point at this file; a precedence clause would ship dead weight that the next section obsoletes. The blind lens flagged it correctly because it could not see that intent, which is the lens working rather than failing.
Stamps: adjudicated 4, stamped 8. `memq unstamped --since 6h` listed 4 (3 operator, 1 project). The three operator hits were all mine and all applied. The project hit, `a-retired-claim-is-swept-by-meaning-not-by-words`, read 5h ago by another session and not applied here, was skipped. Five further records were stamped that the window did not list because the recall digest rather than a `get` registered their read: `merging-hook-edits-staleness-the-build-stamp` and `claude-kit-hook-edits-need-a-build-stamp-refresh` (they diagnosed the stale stamp), `node-test-count-lines-are-not-tap` (it caught the wrong-prefix grep above), and `test-suite-invocation` and `suite-baseline-is-not-zero-fail` (the quoted-glob invocation and the baseline discipline).
Gate: baseline recorded at section close on a quiet box (no foreign test runner or build in the process list, confirmed by command-line match rather than by a process count; 8 node processes, 17.3 GB free physical memory): 1850 tests, 1849 pass, 0 fail, 1 skipped, 189s, exit 0. The pre-rebuild run showed the same 189s wall clock with its 3 stale-stamp failures, so the two agree on the clock. Section 4 owes its own second quiet-box run, since only one post-rebuild run exists.
Next: 2. The doctrine prices the lanes and stops naming one engine as the box
Commit Model: Commit-and-Push
