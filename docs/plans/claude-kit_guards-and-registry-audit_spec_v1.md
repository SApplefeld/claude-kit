# Two payload guards read the shared type list, and the registry audit becomes an honest instrument

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-09-23

Session model: the kit worker persona, on the steward's handoff by name; three sections at sonnet. Authored by the architect persona on ASR-CLAUDE from the kit worker's backlog round of 2026-09-23.

## Dispatch Authorization

The kit worker persona sent five ranked backlog candidates to the steward on 2026-09-23, each checked against the code on main. The operator approved all five and the steward relayed the ruling to the architect as coordinator record `ARCHITECT-8d67c288-dd78-478d-a565-e390d50027b0-18`: "all five approved, go ahead and plan them", with the plan shape left to the architect. This plan carries the worker's items 1 and 2, bundled as the worker recommended. The implementer is the kit worker persona, a session that runs this plan under the kit's executing-work skill; the steward is the session that hands it the plan, and the architect is the session that wrote it.

The steward hands this plan to the kit worker persona by name, and that handoff is the assignment. It runs on `origin/main` as it stands and waits on no other plan. It shares `plugins/claude-kit/hooks/kit-compact-lib.js` with the scratch self-ignore plan, in different functions, so whichever of the two lands second rebases on the first.

## Goal

The docs-write guard and the read-only agent guard read a tool call's agent type through the shared agent-identity library, so a payload naming its type under any of the library's five spellings is judged by both guards, where today the bare `type` spelling passes both. The registry stamp audit exits with a code that separates a refusal to scan from a clean scan and from a scan with findings, never re-stamps `Started:` over a takeover the stamper itself already wrote, never reports its own clock read as suspicious, and reads a board-location record through the same capped reader every other artifact it opens takes.

## Intent

The operator's frame, in the kit worker's words he approved: the two guards close a silent pass-through, and the coordinator seats get an honest instrument while one intermittent test failure goes away.

Done means both guards obtain the agent type from one exported reader over `AGENT_TYPE_KEYS`, and a test for each plants the type under `type` alone and sees the guard act. Done means `kit-registry-stamp.js audit` exits 0 on a clean scan, 1 on a scan with findings and 2 on a refusal, with each pinned; a second `push --takeover` leaves a `Started:` the stamper wrote as the first wrote it and says so, while a hand-typed `Started:` is still repaired from the clock as today; the stamper never writes a `.000` millisecond read; and `boardLocation` reads each candidate through `readRegistryEntryText` and reports an over-cap record as unread.

Done does not need a change to which agent types are strict or gate, a new audit reading, a change to the audit's scope resolution, or any change to what a takeover means. It does not touch the two PostToolUse nudges, which already read the shared library.

Alternatives refused:

- Adding the fifth spelling to each guard's own chain. Refused, because the hand-copied chain is the defect: the next spelling the library gains would be missed the same way.
- Keeping exit 1 for a refusal, as the module header documents. Refused by the item as approved, since a scripted caller cannot tell never-checked from dirty, the shape the audit exists to remove.
- Letting the test tolerate a whole-second stamp. Refused, because the audit's reading is right for a hand-typed stamp and the stamper is the one writer that can avoid the collision.

Rulings after the spec shipped: none yet.

Provenance: distilled by the architect persona, session `30d6d808-ccad-45e4-a606-c868636ee4e4`, from the kit worker's backlog round and one reconnaissance sweep over the checkout at `8005c9b5`.

## Evidence

Read at `8005c9b5` on 2026-09-23.

- `plugins/claude-kit/hooks/kit-agent-identity-lib.js:75` holds `AGENT_TYPE_KEYS = ['subagent_type', 'subagentType', 'agent_type', 'agentType', 'type']`, exported at 130. `docs-write-guard.js:45-48` and `readonly-agent-guard.js:88-91` each hold a local `subagentType(p)` reading four of the five, without `type`. The read-only guard requires the library at 1786 for `reviewAgentClass` only. `compact-deferral-nudge.js:630` and `chapter-boundary-nudge.js:244` read the library's `agentIdentity` and `carriesAgentKey`.
- `test/readonly-agent-guard.test.js:764-770` plants `agentType`, `subagent_type` and `subagentType`; `test/docs-write-guard.test.js:32-35` plants `agent_type` only. Neither plants `type`.
- `kit-registry-stamp.js` `cmdAudit` at 775-830 sets exit code 1 at 782, 788, 795 and 803 (refusals) and at 829 (findings), 0 at 811. The header comment at 78-79 documents the conflation. `test/registry-stamp.test.js:294-296` pins dirty as 1 and 363-364, 373-374, 413-423 and 425-435 pin refusals as 1.
- `test/kit-sidecar-capture.test.js:2234-2246` scans hook files for hand-copied agent-type keys and exempts the two guards under `ROUTED` with a comment describing their four-spelling chains.
- `stampRegistryStatus` at `kit-registry-stamp.js:329-332` passes `['Started', 'Status-updated']` on a takeover to `stampRegistryFields` in `kit-compact-lib.js:3967-3978`, which rewrites any existing line without reading its value. `test/registry-stamp.test.js:498-520` plants a composed whole-second `Started:` at 504, asserts the takeover re-stamps it from the clock, and never issues a second takeover.
- `test/size-budget.json` caps every tracked file under `test/` by line count and `test/size-ratchet.test.js` reds a file past its cap, so a suite that grows takes a cap line in the same change.
- `stampRegistryEntry` writes `new Date().toISOString()` at `kit-compact-lib.js:3928`; `roundSecondStamps` at `kit-registry-stamp.js:217-231` flags `at % 1000 === 0`. The test's `measured()` helper at `test/registry-stamp.test.js:54-57` nudges a `.000` fixture value by one millisecond; the stamper does not.
- `boardLocation` at `kit-registry-stamp.js:495-542` reads each candidate with a bare `fs.readFileSync` at 520. `readRegistryEntryText(full, maxBytes)` at `kit-compact-lib.js:3814-3826` is the capped reader, default `REGISTRY_ENTRY_MAX_BYTES` 64 KB at 3795; the audit already calls it for entries at 590 and for the board at 663.

## Decisions

1. The shared reader is one exported function beside `AGENT_TYPE_KEYS`, returning the trimmed non-empty string under the first spelling present or null, and both guards call it. The library already states the reason a spelling list must have one home.
2. The refusal code is 2 for the `audit` verb's four refusal sites alone. Clean stays 0 and findings stay 1, so no caller reading "non-zero means look" changes behavior, and only a caller that branches on 2 learns something new. The other verbs' exit sites (`push` and `now`, at 692, 708, 716, 722 and 735) keep their codes. The module header states the audit's three codes.
3. A takeover onto an entry whose `Started:` holds a stamp of the stamper's own precision, an ISO moment with a non-zero millisecond part, is refused for that field and stamps `Status-updated` alone, with the refusal named on stdout. Every other value, `none`, an absent line, a whole-second or otherwise hand-typed moment and a value `stampMs` cannot read, is stamped from the clock as today, so the repair the existing case at `test/registry-stamp.test.js:504-510` pins stays. The rule lives in `stampRegistryFields` as a per-field option the takeover caller passes, so the library owns it beside the write. What a takeover means does not change: the design question the backlog raised, whether a same-session second takeover is ever legitimate, stays open, and this plan only stops the second push from erasing the moment the first push recorded.
4. The stamper nudges a read landing on a whole second forward by one millisecond, the same repair the test's own helper makes. The nudge is one exported pure function over a `Date` in `kit-compact-lib.js`, which `stampRegistryEntry` calls, so the test drives the function with a whole-second input and no clock seam is added to the CLI. A stamp is a moment and one millisecond of drift is inside any reading's tolerance.
5. An over-cap board-location record is reported as unread in the audit's own finding form, the `{ file, reason }` shape `auditDir` returns and `cmdAudit` prints one line per, and is never opened, so a large record in the synced operator tier costs one `lstat` in a hand-run CLI. It counts as a finding, so the audit exits 1 on it.

## Approach

**Coverage sweep.** One sweep ran on 2026-09-23 over `8005c9b5` for `agent_type`, `agentType`, `subagent_type`, `subagentType`, `AGENT_TYPE_KEYS`, `exitCode`, `stampRegistryFields`, `stampRegistryEntry`, `roundSecondStamps`, `boardLocation` and `readRegistryEntryText` over `plugins/claude-kit/hooks/` and `test/`. Surfaces found are the ones the Evidence lists; every one is placed in a section below or under Out of Scope. `hook-canary.js` carries literal `agent_type:` fields in its own synthetic fixtures and is not a guard.

**The guards.** Section 1 adds the reader to the library, replaces each guard's local function with a call to it, and plants the fifth spelling in each guard's test. The read-only guard keeps its `reviewAgentClass` call on the string the reader returns.

**The audit.** Section 2 changes the four refusal sites to exit 2, rewrites the header comment, and guards the takeover stamp. Section 3 nudges the stamper and routes `boardLocation` through the capped reader. Each behavior has a red-first case.

**Build.** A change under `plugins/claude-kit/hooks/` is hashed into the build stamp, so each section's gate runs `build.ps1` at the repository root (`build.sh` on POSIX) before the suite, the step the kit's executing-work skill names for a hooks change.

## Sections of Work

### 1. Both guards read the agent type through the shared library
Model: sonnet

Add one exported reader over `AGENT_TYPE_KEYS` to `kit-agent-identity-lib.js`, beside the constant, returning the trimmed string under the first spelling present or null for a non-object or an absent or empty value. Replace the local `subagentType` function in `docs-write-guard.js` and in `readonly-agent-guard.js` with a call to it, made after a guarded require under each guard's fail-open catch: in `readonly-agent-guard.js` the reader joins `AGENT_LIB_SYMBOLS` at 1761 so the skew case at `test/readonly-agent-guard.test.js:1806-1829` still allows out loud, and `docs-write-guard.js`, which requires no library today at 36-37, gains the same guarded require and screen. In `test/kit-sidecar-capture.test.js` the `ROUTED` exemption at 2238-2246 that keeps the single-source pin off the two guards is removed, so the per-key scan runs over both. Sonnet because the reader has an exact sibling in `agentIdentity` and the guards' tests show the fixture shape.

Tests: lock, for each guard, that a payload naming an agent type the guard acts on under `type` alone is refused, watched red against the unchanged guard, using a type the guard's existing cases already refuse (`claude-kit:blind-reviewer` for the read-only guard, and for the docs-write guard any type its cases refuse on a `docs/` write, since that guard refuses every type but the curator and a background main); that each of the other four spellings still resolves; and that the reader returns null for a non-object payload, for a value that is not a string, and for a string empty after trimming, with an empty earlier spelling falling through to a later one.

Acceptance:
- `kit-agent-identity-lib.js` exports the reader, neither guard file contains its own spelling chain, and the per-key scan in `test/kit-sidecar-capture.test.js` runs green over both guards with no exemption.
- The skew case at `test/readonly-agent-guard.test.js:1806-1829` still passes, and a sibling skew case for `docs-write-guard.js` reads the same out-loud allow.
- `test/docs-write-guard.test.js` and `test/readonly-agent-guard.test.js` each carry a case planting the type under `type` alone that reads red at `8005c9b5` and green after, and the Chapter quotes each red run's failing line and exit code.
- `node --test test/*.test.js` exits 0 after the build, with the baseline recorded first.

Files in scope: `plugins/claude-kit/hooks/kit-agent-identity-lib.js`, `plugins/claude-kit/hooks/docs-write-guard.js`, `plugins/claude-kit/hooks/readonly-agent-guard.js`, `test/docs-write-guard.test.js`, `test/readonly-agent-guard.test.js`, `test/kit-sidecar-capture.test.js`, `plugins/claude-kit/hooks/hook-canary.js` and `test/hook-canary.test.js` (folded at round 1: the canary's shared-library export list and the two library tests whose expected report now names the docs-write guard's deny probe), `test/size-budget.json` where a suite's cap moves.

### 2. The audit's exit codes and the takeover stamp
Model: sonnet

In `kit-registry-stamp.js`, the four refusal sites in `cmdAudit` set exit code 2, and the header comment at 78-79 states the three codes and what each means. In `kit-compact-lib.js`, `stampRegistryFields` takes a per-field option that keeps a field whose value is a stamp of the stamper's own precision, and `stampRegistryStatus` passes it for `Started:` on a takeover: where the line holds such a stamp it is left as written, `Status-updated` is stamped alone, and stdout names the refusal in one line; every other value is stamped as today. The existing takeover case at `test/registry-stamp.test.js:498-520` stands unchanged. Sonnet because both edits sit at named lines with pinned siblings.

Tests: lock the three exit codes in both directions, each refusal path at 2, a planted dirty scan at 1 and a clean scan at 0; and lock that a second `push --takeover` after a first leaves `Started:` byte-identical to the first and names the refusal, watched red against the unchanged stamper, while a takeover onto `none` and onto a composed whole-second stamp still stamps it.

Acceptance:
- `kit-registry-stamp.js audit` exits 2 at each of the four refusal sites, 1 on findings, 0 clean, and the module header names all three.
- A second takeover leaves `Started:` unchanged and prints one line naming it; `Status-updated` moves.
- The existing refusal cases at `test/registry-stamp.test.js:363-364`, `373-374`, `413-423` (the empty `--dir`) and `425-435` (the not-a-directory refusal) read 2, and the Chapter quotes each new case's red run.
- `node --test test/*.test.js` exits 0 after the build.

Files in scope: `plugins/claude-kit/hooks/kit-registry-stamp.js`, `plugins/claude-kit/hooks/kit-compact-lib.js`, `test/registry-stamp.test.js`, `test/kit-output-channel.test.js` (folded at round 1: its library-load case now pins the audit's exit 2 on that leg), `test/size-budget.json` where a suite's cap moves.

### 3. The stamper avoids the whole second, and the location record is read capped
Model: sonnet

Decision 4's exported nudge function in `kit-compact-lib.js`, called by `stampRegistryEntry` on its clock read. In `boardLocation`, each candidate is read through `readRegistryEntryText` at `REGISTRY_ENTRY_MAX_BYTES`, and a candidate the reader refuses is reported as a finding carrying the file and the reader's reason as returned, never parsed. Sonnet because both are one-site changes with the sibling call at `kit-registry-stamp.js:590`.

Tests: lock that the nudge function returns a value one millisecond past a whole-second input and returns any other input unchanged, and that `stampRegistryEntry` writes through it, red against the unchanged stamper; and that a board-location candidate one byte over the cap is named as a finding and its `board:` key is never followed, while one under the cap is followed as today.

Acceptance:
- No `stampRegistryEntry` write ends in `.000Z`, pinned by the nudge case, and `test/registry-stamp.test.js:498-520` passes on every run.
- `boardLocation` contains no bare `readFileSync`, and an over-cap candidate appears as one finding naming the file and the reader's reason.
- `node --test test/*.test.js` exits 0 after the build, and the Chapter records the delta against the baseline.

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`, `plugins/claude-kit/hooks/kit-registry-stamp.js`, `test/registry-stamp.test.js`, `test/size-budget.json` where the suite's cap moves.

### 4. The architecture document states the audit's codes, the takeover keep rule and the capped location read
Model: sonnet
Locus: inline

Appended at section 2's round 1, which found `docs/architecture.md`'s paragraph on `kit-registry-stamp.js` stating that nothing in the CLI refuses a second takeover over an already-stamped `Started:` and that "the exit code carries the reading" without naming the codes. Sections 2 and 3 change what that paragraph describes, and the file sits in no section's Files in scope. Restate that paragraph's takeover sentence as the keep rule, name the audit's three exit codes, and state the stamper's whole-second nudge and the capped board-location read, each as the code does after section 3. Section 3's round 1 security lens found `docs/security-model.md`'s sentence on the location record (about line 68) still stating it is read whole with no byte cap and pointing at a backlog entry since archived; restate it as the capped, lstat-screened read, with a refused record reported unread and its `board:` never followed.

Acceptance:
- The paragraph states no behavior the code does not have, read against `kit-registry-stamp.js` and `kit-compact-lib.js` at the section's commit.
- `docs/security-model.md` states the location record's read as the code does, with no pointer to a backlog entry that no longer exists.

Files in scope: `docs/architecture.md`, `docs/security-model.md` (folded at section 3's round 1).

## Out of Scope

The surfaces this plan changes are closed at the sections' Files in scope. Named exclusions:

- `compact-deferral-nudge.js`, `chapter-boundary-nudge.js`, `memory-recognition-nudge.js` and `kit-sidecar-capture.js`, which read the shared library already.
- `AGENT_KEYS` and the identity readers over it.
- The audit's scope resolution, its `now` verb, and the seat-side reading of the board path the backlog entry of 2026-09-22 on the coordinator seat describes.
- The audit's `status`-report shape and the 24-hour rules around the board.
- `hook-canary.js`, whose `agent_type:` literals are its own synthetic fixtures rather than a guard's reading.
- The exit codes of the `push` and `now` verbs.

## Assumptions

- assumed 2026-09-23 (source: the repository's plans): the commit model is Branch-and-PR; reversal: one header line.
- assumed 2026-09-23 (the architect): the worker runs under the kit, whose executing-work skill owns the red-then-green rule, the reviewer pair, the hooks build step and the Chapter.
- assumed 2026-09-23 (default): the refusal code is 2, a value no caller reads today; reversal: one constant and its pins.

## Operator Verification

- After the pull request merges and the plugin update is installed, run `node <plugin root>/hooks/kit-registry-stamp.js audit` on a machine whose coordinator directory exists and read exit 0 or 1, never 2.

## Related

- `docs/backlog.md` entries retired by this plan at its finalize, now in `docs/archive/backlog-2026-Q3.md`: the two guards' four-spelling chains (2026-09-01), the four-file key list (2026-08-24, narrowed to the guards since the nudges already share), the audit's exit code (2026-09-01), the takeover re-stamp (2026-09-01), the whole-second stamp (2026-09-22) and the uncapped location record (2026-09-22).
- `claude-kit_kit-scratch-self-ignore_spec_v1.md`: shares `kit-compact-lib.js`.

## Chapters

### Interim board 1 - 2026-09-23

- Section 1 (both guards read the agent type through the shared library): implemented by implementer-sonnet and verified; first-green commit 5df444ed pushed. Round 1 review is in flight: adversarial, blind, security and performance lenses at opus, effort high, through Workflow run wf_84886618-b34. Its findings are not yet adjudicated.
- Sections 2 and 3: not started. Both touch kit-registry-stamp.js and kit-compact-lib.js, so they run in order after section 1 closes.
- Live dispatches: the Workflow run above only. The same run also reviews a separate operator-ruled change on branch fix/jev-full-situation (the Jev judge reads its situation whole; the search takes its first 4,000 characters), which is outside this plan.
- Gate baseline: the whole gate at 9a8cbaa8 on a clean worktree, 2026-09-23 on this machine with no foreign runner found: 3967 tests, 3958 pass, 1 fail, 8 skipped, exit 1, 484 s. The one fail is the standing linked-worktree red in test/kit-sidecar-memory-index.test.js ("loadIndex answers a status, never a throw").
- Section 1 targeted lane after the build, at 5df444ed: docs-write-guard, readonly-agent-guard, kit-sidecar-capture and size-ratchet suites, 340 tests, 338 pass, 0 fail, 2 skipped, exit 0.
- Rulings adopted since the start: none. Declared at intake for section 1: the reader takes AGENT_TYPE_KEYS order, so a payload carrying two different spellings resolves to subagent_type before agent_type, where the old local chains took agent_type first (Decision 1).
- Next action: adjudicate section 1's round 1 findings, fix, run the section close gate, write Chapter 1, then open section 2.

### Chapter 1 - 2026-09-23
Completed: 1. Both guards read the agent type through the shared library
Implemented By: implementer-sonnet; the round 1 and close-pass fixes by the main session
Metrics: review rounds 2, closed major-closed; provenance 3 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 0 findings, 0 fixed, 0 deferred, 0 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: Section open: the reader adds one exported function over AGENT_TYPE_KEYS; serves the Goal's one-reader sentence and Decision 1; adds no mechanism a clause does not name; about 15 library lines and two guard swaps; not building it leaves the bare `type` spelling passing both guards. Round 1 Critical: the fix changes test/hook-canary.test.js's expected report and hook-canary.js's shared-library export list; serves the acceptance bullet that the suite exits 0; adds no mechanism, one more name in an existing export list; +16/-10 lines over two files; not building it leaves the canary suite red and a skewed library reported without the missing export's name. Surprise: moving the docs-write guard onto the library changed what the session-start canary reports for a broken library, which section 1's own targeted lane never ran; the canary suite is in the close lane from here on. Both guards now load the library before their no-type early return, so every main-session call through either guard pays one module load (about 2 ms, one cold-require sample on SCOTT-CLAUDE) and a skewed cache logs one line per guard per call; this is the order Decision 1's design requires and is kept.
Assumptions: The reader takes AGENT_TYPE_KEYS order, so a payload carrying two different spellings resolves to subagent_type before agent_type, where the old local chains took agent_type first (declared 2026-09-23, section 1; source: Decision 1's "first spelling present" over the library's list; the harness puts only agent_type on a tool call's top level, docs/harness-assumptions.md Hooks section, so the two-spelling case is not reached today).
Review Findings: `review: adversarial, blind, security, performance at opus, Workflow` in both rounds, round 2 re-raised to round 1's roster by round 1's Critical. Critical fixed: two hook-canary tests red after the docs-write guard moved onto the library (adversarial r1, confirmed by `node --test test/hook-canary.test.js`, 63 tests, 61 pass, 2 fail, exit 1), fixed in 05772cc3 with the two canary files folded into Files in scope. Majors justified: (1) blind r1 and r2, adversarial r2: the guards read the bare top-level `type` as the caller's type, so a harness that added a generic `type` to main-session tool payloads would deny docs/ writes; not fixed, orchestrator-made trace to the Goal sentence ordering that any of the library's five spellings is judged by both guards, and no documented tool-call payload carries a top-level `type`, so the risk is a loud false deny on a harness change rather than a bypass. (2) adversarial r2: acceptance bullet 4 (the whole suite exits 0) cannot read exit 0 from a linked worktree, where test/kit-sidecar-memory-index.test.js holds its standing red; finishing reads the whole gate against the recorded baseline and runs that one file from the primary checkout. Minors: 7 fixed across 05772cc3 and the close pass (the canary's export list, a skew case for the type reader watched red with empty stderr, a precedence pin with neutral values, the library's readings list, count and scope sentences, the require-reach list gaining both guards, comment reflows), 0 upgraded, 1 downgraded (adversarial r2 rated Interim board 1's gate pins, which name no machine or contention reading, a Major with no trace; it states no failure scenario, so it is a claim finding and rates Minor), 4 left with the reason: the board pins, since the board is append-only history and this Chapter's pins carry both; the library's load before the no-type return (Decisions above); docs-write-guard's silent allow when the library cannot load at all, which mirrors the read-only guard's own absent-library path and which the canary's deny probe reports at session start; and the canary not exempting a library-caused deny-probe failure from its integrity diagnosis, a pre-existing path for the read-only guard where the warning still fires.
Stamps: adjudicated 14, stamped 2 (suite-baseline-is-not-zero-fail, fan-out-runs-through-workflow-under-a-session-wide-cap); the other 12 were read by reviewers, the sidecar or the Jev work in the same window and changed nothing built here.
Gate: targeted lane (docs-write-guard, readonly-agent-guard, kit-sidecar-capture, hook-canary and size-ratchet suites) at 05772cc3 plus the close pass, clean worktree otherwise, 2026-09-23 on SCOTT-CLAUDE with no foreign runner (only the sidecar daemon, relay and broker node processes): 404 tests, 402 pass, 0 fail, 2 skipped, exit 0, 110 s. The first lane at 5df444ed (340 tests, 338 pass, exit 0) did not carry hook-canary, which is why the Critical reached review. No baseline on this exact lane before the section; the whole-gate baseline at 9a8cbaa8 is 3967 tests, 3958 pass, 1 fail (the standing linked-worktree red), 8 skipped, exit 1, 484 s. Tests added 6: docs-write-guard `type`-only deny (pins the Goal's five-spelling reading for that guard), docs-write-guard library-skew allow-with-stderr (pins the new screen), readonly-agent-guard `type`-only deny (the Goal for that guard), readonly-agent-guard type-reader-missing skew (pins the agentTypeOf screen entry), kit-sidecar-capture agentTypeOf unit asserts and precedence pin (Decision 1). Edited to stay green on this change: two hook-canary library tests now expect the docs-write guard's deny probe (the canary names every guard a broken library silences). Retired 0. Spawning tests added 3 (the two guard cases and the skew case each spawn one node process). Red runs at the pre-change commit: docs-write-guard.test.js:75 `0 !== 2` and :93 `2 !== 0`, readonly-agent-guard.test.js:126 `0 !== 2`, kit-sidecar-capture.test.js:2246 per-key scan, each exit 1.
Next: 2. The audit's exit codes and the takeover stamp
Commit Model: Branch-and-PR
Delta: measured 2026-09-23 on SCOTT-CLAUDE, guards worktree against HEAD 05772cc3
```
repository: guards-and-registry-audit
test/kit-sidecar-capture.test.js: 2551 lines, cap 2551, +2; tests 86, +0
words: 938101 of cap 938164 across 88 curated files
test lines: 132136 of cap 132136 across 73 test files
tests: 3812
changed paths under no measured root: 2 (2 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

### Interim board 2 - 2026-09-23

- Section 2 (the audit's exit codes and the takeover stamp): implemented by implementer-sonnet; first-green commit 87bfd16c pushed. Round 1 (adversarial, blind, security at opus, effort high, Workflow wf_1ba0bc10-faf) returned no Critical and has been adjudicated. The round 1 fixes sit unstaged in the worktree: kit-registry-stamp.js (a failedRunCode helper so the audit's library-load and catch-all exits take 2, the synopsis, the header's three codes, the kept line worded by shape), kit-compact-lib.js (the recognizer comment states shape, not provenance), test/registry-stamp.test.js (the kept line pinned on tokens, the malformed --dir case run under a fixture home), test/kit-output-channel.test.js (folded: the audit load-failure leg pinned at 2, watched red at 87bfd16c: `1 !== 2`, exit 1), and size caps. Build done; the section's lane is not yet run on them.
- Adjudicated so far: Major fix-now, the load-failure and catch-all audit exits read 1 with nothing scanned (adversarial and blind, spec-traceable to the Goal's refusal sentence). Major fix-now, a test pinned the kept line's sentence (adversarial). Major justified-not-fixed here, a first takeover stamping `.000Z` (about once in a thousand) is not recognized, so a second takeover rewrites it and the two new second-takeover tests fail that often; section 3's nudge closes it in this same pull request, and section 3's close re-reads those two tests. Minors fixed: the recognizer's provenance comment (blind, security), the synopsis, the malformed --dir fixture. Minor left: a second seat that skips the role skill's `Started: none` reset keeps the prior seat's Started, which the contract already forbids (blind, low). Routed: docs/architecture.md's paragraph on the stamp CLI, outside every section's scope, became appended section 4 (inline).
- Live dispatches: none. A separate background shell runs the whole gate of the operator-ruled caps change on branch fix/jev-full-situation (commit f1c20571), outside this plan; section 2's lane waits for it so the two runs do not share the box.
- Gate baseline: section 2's lane (registry-stamp and size-ratchet) at 3d1419f2, 133 tests, 133 pass, exit 0, 34 s; at 87bfd16c with kit-output-channel added, 153 tests, 153 pass, exit 0, 38 s, 2026-09-23 on this machine with only the resident sidecar, relay and broker processes.
- Rulings adopted since the last boundary: none.
- Next action: run section 2's lane on the fixes, commit them, run round 2 (one adversarial lens at sonnet, effort high), then the close pass, Chapter 2, and section 3.

### Chapter 2 - 2026-09-23
Completed: 2. The audit's exit codes and the takeover stamp
Implemented By: implementer-sonnet; the round 1 and round 2 fixes by the main session
Metrics: review rounds 2, closed major-closed; provenance 2 spec-traceable, 1 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 2 findings (security r1, both Minor), 1 fixed, 1 covered by an adversarial fix, 0 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: Section open: the audit's four refusal sites move to exit 2, and stampRegistryFields gains a per-field keep option that leaves a stamper-precision Started as written on a takeover; serves the Goal's "exits with a code that separates a refusal to scan from a clean scan and from a scan with findings" and "never re-stamps Started over a takeover the stamper itself already wrote", and Decisions 2 and 3; adds no mechanism a clause does not name (Decision 3 names the per-field option and its home in the library); about four exit-code lines, one option branch with a recognizer, one stdout line and the header sentence; not building it leaves a scripted caller unable to tell never-checked from dirty, and a second takeover erasing the moment the first recorded. A surprise from round 1: the audit's two exits that run before any verb reports, the kit library failing to load and the catch-all around main, read 1 with nothing scanned. That made a failed run look like a run with findings. A hoisted failedRunCode helper gives both 2 for the audit and keeps 1 for every other verb. The keep rule reads the value's shape, never who wrote it: a Started holding a clock read in the stamper's own format is kept on any takeover, whoever wrote it, and the code comments, the synopsis and the kept line all say so. A first takeover that happens to stamp a .000Z moment, about one in a thousand, is not recognized, so the two new second-takeover tests fail that often until section 3's whole-second nudge lands in this same pull request; section 3's close re-reads those two tests.
Assumptions: none declared this section.
Review Findings: `review: adversarial, blind, security at opus, effort high, Workflow wf_1ba0bc10-faf` in round 1; `review: adversarial at sonnet, effort high, Workflow wf_efc699cc-4d9` in round 2, one lens at the writer's tier since round 1 raised no correctness Critical. Majors fixed: (1) adversarial and blind r1, spec-traceable to the Goal's refusal sentence: the audit's library-load and catch-all exits read 1 with nothing scanned; fixed in 3ae94aa4 and pinned by kit-output-channel.test.js, watched red at 87bfd16c with `1 !== 2`, exit 1. (2) adversarial r1: a test pinned the kept line's whole sentence; fixed in 3ae94aa4 with two token pins. (3) adversarial r2, fix-introduced: the `: 1` side of failedRunCode had no test, so an inverted ternary would flip every push and now caller silently; fixed in this close with a push leg on the same load-failure loop, watched red with the ternary forced to 2 (`2 !== 1`, exit 1), the probe restored from a pre-probe copy and verified byte-identical with cmp. Major justified: adversarial r1, the .000Z first takeover (Decisions above), closed by section 3. Minors: 3 fixed in 3ae94aa4 (the recognizer's provenance comment, blind and security r1; the synopsis; the malformed --dir case now run under a fixture home). 2 left with the reason: a second seat that skips the role skill's `Started: none` reset keeps the prior seat's Started, which that contract already forbids (blind r1); and a throw inside cmdAudit after its scan line printed would exit 2 beside partial output (adversarial r2, low confidence), which only the pure formatting functions over validated data could raise and no input reaches. Routed: docs/architecture.md's paragraph on the stamp CLI became appended section 4.
Stamps: adjudicated 9, stamped 1 (a-gate-marker-can-outlive-the-session-that-launched-it, operator tier: the caps run's result was read from its exit marker); the other 8 were read for the Jev and caps work in the same window and changed nothing built here.
Gate: targeted lane (registry-stamp, size-ratchet and kit-output-channel suites) at 3ae94aa4 plus the round 2 test, 2026-09-23 on this machine with no foreign runner (only the resident sidecar daemon, relay and broker node processes): 153 tests, 153 pass, 0 fail, exit 0, about 36 s. Baseline on the same lane at 87bfd16c: 153 tests, 153 pass, exit 0, 38 s; at 3d1419f2 without kit-output-channel, 133 of 133, exit 0, 34 s. Tests added 7: six in registry-stamp.test.js at 87bfd16c (a malformed --dir is refused before any scope resolves; an absent coordinator directory under the default scope is refused; a second takeover leaves the first one's Started byte-identical and names why; a takeover onto `Started: none` still stamps it; a stamp carrying trailing text is not recognized; a second takeover over a CRLF entry keeps Started and stays uniformly CRLF) and the push leg in kit-output-channel.test.js. Edited to stay green on this change: six refusal asserts moved from 1 to 2, the kept-line pin moved to tokens, the malformed --dir case moved under a fixture home. Retired 0. Spawning tests added 7 (each spawns the stamper CLI once or twice).
Next: 3. The stamper avoids the whole second, and the location record is read capped
Commit Model: Branch-and-PR
Delta: measured 2026-09-23 on this machine, guards worktree against HEAD 3ae94aa4
```
repository: guards-and-registry-audit
test/kit-output-channel.test.js: 706 lines, cap 706, +3; tests 14, +0
words: 938101 of cap 938164 across 88 curated files
test lines: 132270 of cap 132270 across 73 test files
tests: 3818
changed paths under no measured root: none; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```
