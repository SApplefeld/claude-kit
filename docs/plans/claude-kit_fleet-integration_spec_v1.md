# Claude-Kit Fleet Integration

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: S3, finishing reviews
Created: 2026-07-31

## Goal

The kit behaves as a well-mannered passenger when an external engine (the AI OS Spine) delivers it into spawned sessions: hooks stand down from continuation-driving under the external-engine marker, memory writes are run-scoped with provenance so an adjudicator can review them later, the memq CLI is reachable under the engine's write-gated vector, dispatch briefs cite skill paths that resolve under any delivery mechanism, the event-sink env override carries the same gate discipline as the other path overrides, and the plan-doc header the engine parses is declared a frozen contract. The companion OS spec (`sapplefeld-ai-os` repo, `docs/plans/ai-os-kit-integration_spec_v1.md`) consumes every seam this spec creates; its sections 1 through 4 depend on this spec landing first.

## Approach

The engine delivers the kit per spawn with `--plugin-dir <enginePayload>` and sets `KIT_EXTERNAL_ENGINE=1` on every worker it spawns (OS repo `src/Spine.Core/Harness/WorkerSpawner.cs:462-466`). The fleet-pinned CLI (2.1.217/218) accepts `--plugin-dir`, fires a plugin's SessionStart and Stop hooks when loaded through it, and resolves `CLAUDE_PLUGIN_ROOT` to the plugin directory, including under `--setting-sources project` (probed live against 2.1.217 via the versioned npm package, which shares the dev account's auth). So the kit's hooks WILL run inside fleet workers, and the marker is the only signal separating a fleet worker from an attended session.

Today the marker has zero code readers. The only surface honoring it is prose (`plugins/claude-kit/skills/executing-work/SKILL.md:62`), so every ambient hook fires identically in a fleet worker: the session-start plan-recovery push tells a one-section worker to drive all remaining sections to completion (the recorded candidate cause of workers barreling past one-section directives), and the canary burns 22 serial node spawns per spawn. Section 1 makes the hooks honor the marker.

The memory design (ratified 2026-07-31, from the brainstorm handoff brief archived in the OS repo at `docs/archive/ai-os-kit-integration_brainstorm-handoff_v1.md`): one store per instance entity, quarantine is a scope rather than a jail. A run's writes land in `pending/<run-id>/` and are recallable by that run immediately (a run is already a shared-fate trust domain via its commits and Chapters); the main tier is entered only by an adjudication verdict applied by the engine's kernel. The kit side of that model is memq's tier-aware read and write behavior (section 2); the lifecycle (promotion, rejection, adjudication episodes) is engine code and lives in the OS spec.

memq's write discipline is already multi-process safe and this spec adds no locking: bounded single-line appends are atomic and lock-free (`plugins/claude-kit/scripts/memq.js:19-28`, cross-process test `test/memq.test.js:254`), and every shared-file rewrite runs under the lockfile helper (`memq.js:436`, contention test `test/memq.test.js:852`). The pending tier preserves the shape by construction: each writer creates files only in its own run directory, and the one contended surface (the main tier and its `MEMORY.md`) is written only by the engine's serial kernel and by attended sessions. Every new write path in this spec must keep that discipline: appends and run-private creates lock-free, shared rewrites under the lock.

Test harness: Node's built-in runner, no framework, Node v24. The gate is `node --test "test/*.test.js"` from the repo root; it must be green before and after every section. The quotes are load-bearing and the bare directory forms (`node --test test`, `node --test test/`) do not work: the runner resolves the directory as a single module, discovers no files, and exits 1 with one synthetic failure, a false red.

Editing any hook or `hooks.json` invalidates the build stamp that `test/hook-canary.test.js` asserts against (the build hashes every hook file, `hooks.json` included), so `./build.ps1` runs before the gate after any such edit. Sections 1, 3, and 5 all touch hooks.

Baseline at the plan commit, after a `./build.ps1` to refresh a stale local stamp: 353 tests, 353 pass, 0 fail.

## Standing Brief Amendments

Folded into every dispatch brief for this plan:

- The gate is `node --test "test/*.test.js"`, quoted. Never the bare directory form.
- After editing any hook or `hooks.json`, run `./build.ps1` before the gate, or `hook-canary.test.js` reports two failures the edit did not cause.
- Never write under `docs/`: the docs-write-guard denies a non-curator subagent that write (`plugins/claude-kit/hooks/docs-write-guard.js:87-106`). Return doc prose in the final message for the main thread to place.

## Sections of Work

### 1. Hooks stand down under KIT_EXTERNAL_ENGINE
Model: opus

When `process.env.KIT_EXTERNAL_ENGINE === '1'`:

- `hooks/session-start.js` omits the drive-to-completion push (the resume-instruction block emitted around `session-start.js:169-173`, the text ordering "driving the remaining sections to completion" plus its model-tier routing). It still emits the plan-doc inventory (each In Progress plan's path and status) as plain information, followed by one line stating that the external engine's directive owns scope and continuation. Everything else the hook emits (memory index, kaizen notes) is unchanged.
- `hooks/hook-canary.js` exits 0 before spawning anything (the sweep is 22 serial node spawns; fleet payload integrity is the deploy's concern, and the canary's alert channel targets an attended operator, not a headless worker).
- `hooks/branch-reaper-nudge.js` and `hooks/kit-version-nudge.js` emit nothing (both nudges ask for an attended operator's action a fleet worker cannot take).
- `hooks/stop-docs-hygiene.js`: read its current behavior first; any outcome that blocks or retries the Stop becomes advisory-only text under the marker. If it is already advisory-only, record that in the Chapter and change nothing.
- `hooks/doctrine-refresh.js`, `hooks/memory-session.js`, the PreToolUse guards, and the PostToolUse hooks stay live under the marker: guards and memory wiring are wanted inside workers.

Without the marker, behavior is byte-identical to today; the existing test suite is that pin.

Files: the five hooks named above; new/extended tests in `test/`.
Acceptance: `node --test test` green. With the marker set, session-start's output contains no drive-to-completion text and still lists In Progress plan paths; the canary spawns zero children; the two nudges emit nothing. Without the marker, existing tests pass unmodified.
Tests: lock both directions for every hook touched: marker set locks the stand-down shape, marker absent locks today's output. The expensive failure is a silent stand-down in attended use, so the marker-absent direction is not optional.

### 2. memq run-scoped pending tier with provenance
Model: opus

When `KIT_RUN_ID` is set (it arrives only alongside the existing `KIT_MEMORY_ROOT` + `KIT_MEMORY_ROOT_ALLOW_DATA=1` pair; the engine sets all three):

- New memory files route to `<store>/pending/<KIT_RUN_ID>/` instead of the store root. The `memory-session.js` session-start emission tells the session to write memory files there (and not to touch `MEMORY.md`: pending memories carry no index line; the index is written at promotion, by the engine).
- Written pending memories carry provenance frontmatter: `run:` from `KIT_RUN_ID`, plus `vector:` and `section:` when `KIT_SPAWN_VECTOR` / `KIT_RUN_SECTION` are present, and a `written:` date. memq stamps these on any file it writes; for files the session writes directly, `memory-session.js`'s emitted instructions name the required fields.
- Journal entries (`memq log`) gain a `run` field from `KIT_RUN_ID`. Append shape unchanged: one bounded line, lock-free.
- Read paths (`recall`, `find`, `get`) span the main tier plus the caller's own `pending/<KIT_RUN_ID>/` only. A process resolves the one directory its own run id names and enumerates no others, so no other run's pending directory is read, listed, or counted. That is a resolution rule, not an enforced boundary: a session holding Bash can set a different id, which is the limit the security model already states for every tier. The trust boundary remains the store.
- `recall` presents pending records under a labeled coverage line (the same explicit-surface pattern the digest already uses).
- `KIT_RUN_ID` unset: behavior byte-identical to today, existing tests as the pin.

The three read paths named above are a floor, not the list. memq's readers have a documented failure mode: the mutation helpers take a tier directory and so serve every tier equally, while each reader tends to be written against one tier and only later taught the others, leaving an absence that no green suite and no coverage count notices (it has surfaced three times). So enumerate every command in `memq.js` that resolves a tier directory and state, per command, whether the pending tier applies and why. `touch --applied` needs an explicit answer: `tierDirFor` deliberately resolves nothing under a tier's `archive/`, so a sidecar destination derived from a hit path is null there and a fail-open write swallows the miss silently. Any user-facing pointer ("the full list is X") is a claim that must hold with pending in play, not just for the common case.

Run-id values are sanitized before path use (the id becomes a directory name; refuse separators, dots-only names, and anything outside a conservative token grammar, loudly).

`KIT_RUN_ID` is honored only alongside the `KIT_MEMORY_ROOT` pair, the same two-signal discipline section 5 generalizes. It carries no separate signal of its own because it selects a subdirectory within an already-gated store.

Files: `plugins/claude-kit/scripts/memq.js`, `plugins/claude-kit/hooks/memory-session.js`, tests in `test/`, and `docs/security-model.md` (main-thread write, per the routing override sections 3 and 5 also carry).
Acceptance: `node --test test` green; a child spawned with the three env vars writes to and recalls its own pending dir; a second run id's pending memory never surfaces in the first's recall, find, or get.
Tests: both directions (env set routes and scopes; env unset is byte-identical), cross-run isolation, hostile run-id values refused, and the write-shape invariant (no new shared-file rewrite outside the lock).

### 3. PreToolUse grant hook for memq under gated vectors
Model: fable (code) + inline (docs)

Routing override, visible up front: the `docs/security-model.md` bullet is a main-thread write. The docs-write-guard denies any non-curator subagent a write under `docs/` (`plugins/claude-kit/hooks/docs-write-guard.js:87-106`), so the dispatched implementer takes the hook, the wiring, and the tests, with the docs path out of its files-in-scope, and returns the guard-table prose in its final message for the main thread to place.

Under the engine's write-gated vector (`--permission-mode` gated with path allows), Bash `node <script>` is refused for both read-only and writing memq invocations (probed live; Write/Edit file tools inside allowed roots succeed). Fleet workers on that vector need the memq CLI for recall and logging, so the kit ships a narrowly-scoped PreToolUse hook that grants exactly that and nothing else.

- New hook `plugins/claude-kit/hooks/memq-grant.js`, wired for the Bash tool in `hooks/hooks.json`.
- It emits an allow decision only when ALL hold: the environment carries the fleet-store signals (`KIT_MEMORY_ROOT` set and `KIT_MEMORY_ROOT_ALLOW_DATA === '1'`); the command is exactly one `node` invocation of this plugin's own `scripts/memq.js` (path equality against the hook's own `CLAUDE_PLUGIN_ROOT` after normalization, never a regex over the path); and the full command line is metacharacter-hostile-clean (no `;`, `&`, `|`, `<`, `>`, backtick, `$`, `(`, `)`, newline, or carriage return anywhere, including inside quoted arguments).
- On any other input it emits no decision at all: fall through to the normal permission flow. The hook never denies; absence of grant is the safe default, and denying would fight the engine's own permission design.
- `docs/security-model.md` gains the new guard in the guard table: the invariant it enforces, the accepted risk, the compensating controls, and the gap it cannot see, in the table's existing shape.

Files: `plugins/claude-kit/hooks/memq-grant.js`, `plugins/claude-kit/hooks/hooks.json`, `test/memq-grant.test.js`, `docs/security-model.md`.
Acceptance: `node --test test` green; the exact invocation is granted under the env signals; everything in the hostile inventory falls through.
Tests: a hostile inventory at minimum: each banned metacharacter; a second command after the script path; `node -e`; `npx`; a different script at a lookalike path; path traversal reaching another script; quote-parity tricks aimed at the cmd.exe wrapper; the exact invocation with the env signals absent (no grant). Both directions: the one allowed shape allows, every probe falls through. A silent over-grant is the expensive failure; this section is why the spec's Fable Spend names S3.

### 4. Style-skill paths resolve from the loaded plugin
Model: sonnet

Dispatch briefs currently cite style skills by the marketplace-clone literal (`plugins/claude-kit/skills/executing-work/SKILL.md:107-112`), which has failed to resolve twice in fleet use (OS repo `docs/archive/ai-os-adjudicator_spec_v1.md:303`, `docs/archive/ai-os-seat-economics_spec_v1.md:240`). The rule becomes: the orchestrating session resolves style-skill paths from its own loaded kit root (the root this skill itself loaded from, `CLAUDE_PLUGIN_ROOT`) at brief-writing time, and writes those absolute paths into the brief. That root is stable for the session's lifetime under every delivery mechanism: marketplace install, and the engine's `--plugin-dir` payload.

- Rewrite the brief-contents bullet in `skills/executing-work/SKILL.md:107-112` to the resolve-from-own-root rule. Drop the marketplace-clone literal.
- Grep-sweep every skill and agent definition for the literal path shapes (`plugins/marketplaces/` and `plugins/cache/`) and re-point any other instruction that tells a session to cite kit files by literal path.

Files: `plugins/claude-kit/skills/executing-work/SKILL.md`, plus whatever the sweep finds.
Acceptance: `grep -rn "plugins/marketplaces/" plugins/claude-kit/skills plugins/claude-kit/agents` returns no path-citation instructions (historical prose in `docs/` is exempt), and the rewritten bullet names `CLAUDE_PLUGIN_ROOT` as the source of the root.

### 5. Gate KIT_EVENTS_PATH to parity
Model: sonnet (code) + inline (docs)

Routing override, visible up front: the `docs/architecture.md` and `docs/security-model.md` updates are main-thread writes, for the same docs-write-guard reason section 3 records. The implementer takes `kit-goal-lib.js`, `hook-canary.js`, and the tests, and returns the doc prose in its final message.

`KIT_EVENTS_PATH` redirects the goal-event sink and is honored ungated (`plugins/claude-kit/hooks/kit-goal-lib.js:265-266`), while the memory and plugins roots take two-signal gates (`memq.js:174`, `memq-shim.js:82`). `docs/architecture.md:72` records the asymmetry as deliberate (a producer-side lever). Decided 2026-07-31 with the ratified brief: uniformity wins, because one auditable rule ("every kit env override that redirects a path carries a second signal") beats a per-override argument, and the engine, the only legitimate ambient setter, can set two variables as easily as one.

- `kit-goal-lib.js`: honor `KIT_EVENTS_PATH` only when `KIT_EVENTS_PATH_ALLOW === '1'` accompanies it; on an ungated override, fall back to the homedir default with a loud stderr note (the same pattern as `memq.js:177-178`).
- `hooks/hook-canary.js:293` (the canary's own probe-isolation use) sets the gate variable alongside the path.
- Emitted events gain a `run` field from `KIT_RUN_ID` when it is present (the OS-side consumer correlates events to runs by it); absent, the event shape is unchanged.
- `docs/architecture.md:72` and the security model's env-override section update to describe three gated overrides.
- `KIT_GOAL_LEDGER_PATH`, which the design dialogue also named, no longer exists in the tree (the ledger route was removed 2026-07-31); nothing to do.

Files: `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/hooks/hook-canary.js`, `docs/architecture.md`, `docs/security-model.md`, tests in `test/`.
Acceptance: `node --test test` green.
Tests: both directions: gated override honored, ungated override falls back loudly, no override untouched; the `run` field present with `KIT_RUN_ID` and absent without. The canary's probe still isolates its sink.

### 6. Plan-doc header machine contract
Model: sonnet

The engine's `PlanDocParser` consumes the plan-doc header case-sensitively: `^Status:\s*(.+)$` and `^Commit Model:\s*(.+)$` (OS repo `src/Spine.Core/Harvesting/PlanDocParser.cs:88,91`). The kit's own plan-recovery hook matches `Status:` case-insensitively (`hooks/session-start.js:114`), which is fine for a reader but means nothing in the kit currently tells a plan author the exact spelling is load-bearing.

- `skills/writing-skills` or `skills/curating-docs` (implementer's call on which owns it; cross-link from the other) gains a short "machine contract" statement: `Status:` and `Commit Model:` are a frozen v1 contract consumed by external machinery, exact key spelling and case, at line start, one of each, above the first `##` heading; the brainstorming skill's spec template is the normative instance; changing the shape is a coordinated versioned contract change with the OS repo, never a drive-by edit.
- The tolerant kit-side reader stays tolerant (a strict writer contract and a tolerant reader are compatible).

Files: one of `plugins/claude-kit/skills/curating-docs/SKILL.md` / `plugins/claude-kit/skills/writing-skills/SKILL.md`, cross-link in the other.
Acceptance: the contract text names both keys, the exact-case rule, the consumers (OS `PlanDocParser`, kit `session-start.js`), and the change rule.

## Out of Scope

- The delivery mechanism itself: appending `--plugin-dir`, the engine-owned payload, deploy versioning, provisioning. All engine code, in the OS spec.
- Per-account plugin installs: unchanged, still supported, still the NEO sandbox's status quo and the fallback delivery path.
- memq locking work: already present by write-shape discipline (receipts in Approach); nothing to add.
- Promotion, rejection, and adjudication mechanics: engine lifecycle, OS spec sections 2 and 3. The kit's contract ends at tier-aware reads and writes.
- Doctrine-include automation for fleet identities: a runbook provisioning touch on the OS side, with `--append-system-prompt-file` as the engine's fallback for unprovisionable identities.

## Open Questions

None. The ratified brief and the 2026-07-31 probe results settled the design forks; anything an implementer hits beyond section text escalates per executing-work.

## Related

- Consumes/consumed by: `sapplefeld-ai-os` repo `docs/plans/ai-os-kit-integration_spec_v1.md` (the OS-side workstream; its sections 1-4 depend on this spec).
- Origin: the brainstorm handoff brief, archived in the OS repo at `docs/archive/ai-os-kit-integration_brainstorm-handoff_v1.md` (Section 7 there records the rejected approaches; do not re-litigate absent new facts).
- Builds on: `../archive/claude-kit_external-engine-standdown_spec_v1.md` (the marker and directive contract this spec gives code readers), `../archive/claude-kit_hook-canary-and-goal-events_spec_v1.md` (the event stream section 5 gates), `../archive/claude-kit_memory-extension_spec_v1.md` and `../archive/claude-kit_memory-recall-and-reinforcement_spec_v1.md` (the store sections 2 extends).

## Chapters

### Chapter 1 - 2026-08-01
Completed: Section 1, Hooks stand down under KIT_EXTERNAL_ENGINE
Implemented By: implementer-opus (no escalation); the stdin-drain fix and the spec amendments are the main session's
Metrics: 1 review round (adversarial + blind, both at fable, one tier above the opus writer); 0 NEEDS_CONTEXT; 0 escalations; advisor opus. Security-reviewer not dispatched: the section changes hook output shape and adds no input handling, auth, SQL, secrets, or external boundary.
Gate: baseline 353 pass / 0 fail at `5412086`; section close 370 pass / 0 fail, +17 added, none lost.

Decisions / Surprises:
- The spec's own gate command was wrong. It read `node --test test`, which on Node 24 resolves the directory as a single module, discovers no files, and exits 1 with one synthetic failure: a false red handed to every implementer this plan dispatches. Corrected in Approach to the quoted `node --test "test/*.test.js"`, and added a Standing Brief Amendments block so the correction rides in every later brief.
- The build stamp is the other repeat trap: `./build.ps1` hashes every hook and `hooks.json` into an untracked `build-info.json` that `hook-canary.test.js` asserts against, so any hook edit costs two unrelated failures until a rebuild. The local stamp was already stale at the plan commit, which is what made the pre-work baseline read 351/2 rather than 353/0. Recorded in Approach and in the standing amendments; it bites sections 3 and 5 too.
- Sections 3 and 5 were re-routed before dispatch. Both list files under `docs/`, and the docs-write-guard denies a non-curator subagent that write with exit 2 (`plugins/claude-kit/hooks/docs-write-guard.js:87-106`, read this turn), which would kill an implementer mid-section. Their model lines now read `<tier> (code) + inline (docs)`: the implementer takes the code and returns the doc prose in its final message for the main thread to place.
- Section 2's brief gains a reader-enumeration requirement, from the `memq-two-tier-reader-symmetry` memory: memq's mutation helpers are tier-agnostic while its readers get written against one tier and taught the others later, an absence no green suite notices, and it has surfaced three times. The spec named three read paths; the amended text requires enumerating every command that resolves a tier directory, with `touch --applied` called out by name.
- `stop-docs-hygiene.js` did block (`:139`), so the advisory conversion was needed rather than a no-op. The advisory shape is `{ systemMessage: text }` with no `decision` field. The reasoning, so it is not re-litigated: the absence of `decision` is what allows the stop, so if `systemMessage` is unsupported the outcome degrades to silence, which is exactly what a stderr fallback would give. Strictly no worse, with an upside. The tests pin the invariant (exit 0, no `decision` in stdout), not the channel.
- Both reviewers flagged, in opposite directions, whether an armed kit goal can leash a fleet worker. Resolved from the code, not from either report: `kit-goal-stop.js:192` claims an unbound goal only when the plan path appears inside a `<command-args>` span of a genuinely typed user entry, with assistant, meta, attachment, tool_result, and sidechain entries all excluded (`:165-191`). An engine directive is prose, not command arguments, so a spawned worker cannot claim the leash. The gap is inert; no change made to `kit-goal-stop.js`. The adversarial reviewer had this right and the blind reviewer had it wrong.

Review Findings: No Critical, no Major. Both reviewers APPROVED (blind: APPROVED_WITH_CONCERNS). Minors addressed: the two nudges returned before draining stdin while the canary deliberately drains first, an unexamined asymmetry that could EPIPE the harness's payload write; both now drain first and stand down before the fetch and the stamp read, where the cost actually is. Minors noted and deliberately not fixed: `session-start.js` still emits its goal-armed, completed-unarchived, and kaizen blocks under the marker (the section text says everything else the hook emits is unchanged, and the goal-armed case is inert per the claim-predicate finding above); the `systemMessage` channel reaches no model and may reach nobody at all in a headless worker, which is the accepted floor of the decision above. `docs/architecture.md` is now stale on the marker, since this section gives it its first code readers; section 5 already edits that file, so the update lands there.

Next: Section 2, memq run-scoped pending tier with provenance (opus, dispatched)
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-01
Completed: Section 2, memq run-scoped pending tier with provenance
Implemented By: implementer-opus (no tier escalation); the `docs/security-model.md` write and the spec corrections are the main session's, per the docs routing override
Metrics: 1 review round plus 2 fix rounds on the same implementer via SendMessage; reviewers adversarial + blind at fable and security-reviewer at default; 0 NEEDS_CONTEXT; 0 escalations; advisor opus. Security-reviewer dispatched because the section builds filesystem paths from environment variables and emits environment-derived text into a trusted context channel.
Gate: 370 pass / 0 fail at section start; 390 pass / 0 fail at close, +20 added, none lost. Also run green with `KIT_RUN_ID`, `KIT_SPAWN_VECTOR`, and `KIT_RUN_SECTION` set in the shell, which is the environment a fleet worker runs the suite in.

Decisions / Surprises:
- The section shipped a Critical of exactly the kind section 5 exists to prevent, and the security reviewer caught it without having read section 5. `runIdOrNull` honored `KIT_RUN_ID` with no allow-signal at all, so `KIT_RUN_ID=x` alone against a developer's real `~/.claude` store rerouted that session's memory writes and reads. A committed `.vscode/settings.json` terminal env is enough to set it, which is the precise threat the `KIT_MEMORY_ROOT` gate exists to stop (`docs/security-model.md`, environment overrides). Now gated on the full trio, with the ungated case ignored loudly on stderr in `memoryRoot()`'s own shape. The lesson generalizes past this section: a new path-redirecting override defaults to gated, and the spec's stated precondition is not the same thing as an enforced one.
- The hook failed open where the CLI failed loud, and the first fix over-corrected. Because memory files are written by the session's Write tool rather than by memq, `memory-session.js` emitting nothing meant the session wrote into the shared project tier and added `MEMORY.md` index lines, the exact unadjudicated-shared-write the CLI's refusal prevents. The first fix stood the session down for any unusable id, which contradicted the decision one fix earlier to merely ignore an ungated override. Settled on the store signals as the deciding question: signals present with an unusable id stands down (a real spawn asked for quarantine and the kit cannot deliver it), signals absent is silent whatever the id says (it was never a spawn, and a stray leftover variable must not cost an attended developer their memory writes).
- The hook was handing the session a destination it had passed through `sanitize(path, 260)`, a bare slice that also strips non-ASCII. Every other sanitize call in that hook is display-only; this one was actionable, so a deep store path (the store flattens a whole cwd into one segment) or a non-ASCII homedir would have produced a confidently wrong directory the session creates and writes into, where no reader and no adjudicator ever look. Paths are now emitted verbatim or not at all.
- The test spawn helpers inherited `KIT_RUN_*` from the parent environment, which would have turned the suite wholesale red inside a fleet worker, for no product defect, in the one environment this feature creates. Scrubbed in the shared helpers. This found a real pre-existing red on the verification run.
- `isRunId` was not a safe Windows directory-name grammar: `...` passed (and was pinned as accepted), trailing-dot ids alias onto their stem so two run ids would share one pending directory, reserved device stems passed, and it was the one identifier gate in the file not using the platform-fold helper its siblings use. All closed, with the fold applied through the file's existing helper rather than a new one.
- Two reviewers disagreed and the code settled it, again. The claim that no run ever reads another's pending directory is not enforceable: the only thing selecting the directory is the process's own `KIT_RUN_ID`. Reworded in the code comments, in this spec, and in the security model to the truthful version, that a process resolves the one directory its id names. Nothing untrue ships, comments included.

Ratified, no change: `add-type` inside a run still writes the shared type tier directly rather than to pending. `typeDir` resolves under `memoryRoot()` (`memq.js:367-369`, `191-201`, read this turn), so under the engine's per-instance store the reach is that instance, not the machine, and the write is provenance-stamped and therefore attributable. Recorded in the security model's Not claimed section as a bounded, unadjudicated surface, which is the seam the OS-side adjudicator should know about. Also ratified: `get` precedence puts pending above the project tier, derived from the file's own closest-tier-shadows rule.

Review Findings: 1 Critical, 7 Major, 5 Minor across three reviewers. Critical fixed (the ungated run id). All Majors fixed: hook fail-open into the shared record, the truncated actionable path, the test env inheritance, the Windows run-id grammar, and the security model going unupdated. Minors fixed: empty-string id treated as unset, the indented-frontmatter and `written:`-date clauses, and two stale invariant comments. Minors declined: a nested ternary flagged as cosmetic. Both new security behaviors were red/green probed rather than asserted, and the probes were reverted and confirmed absent by grep with the gate re-run after restore.

Next: Section 3, PreToolUse grant hook for memq under gated vectors (fable for the code, main thread for the docs bullet)
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-01
Completed: Section 3, PreToolUse grant hook for memq under gated vectors
Implemented By: implementer-fable (the Fable Spend header names this section); the `docs/security-model.md` writes are the main session's, per the routing override
Metrics: 1 review round plus 1 fix round via SendMessage; reviewers adversarial + blind at fable and security-reviewer at default; 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Gate: 390 pass / 0 fail at section start; 424 pass / 0 fail at close, +34 added, none lost.

Decisions / Surprises:
- The Critical the fable tier was spent on: the grant validated the script and never the interpreter. `node` is a PATH-resolved bare name, and the granted child honors `NODE_OPTIONS`, both confirmed by the security reviewer's own probes (with `NODE_OPTIONS` pointing at a loadable module the hook still emitted the allow). The shape of the miss is worth carrying: the hook had already closed *inline* env assignment (`X=1 node ...`), which makes *inherited* env the exact complement, so environment was considered and one half was covered. Severity was Critical rather than Major because the hook only fires on the vector that otherwise denies `node <script>` outright, so an over-grant there does not remove a prompt, it converts a deny-by-default into execution with no human in the loop. Now pinned two ways: the hook walks the same PATH the child gets and grants only when the first `node` candidate realpath-equals its own `process.execPath` (wrapper spellings checked ahead of the binary, so a planted `node.cmd` beside the real `node.exe` also refuses), and any of `NODE_OPTIONS`, `NODE_PATH`, or `NODE_REPL_EXTERNAL_MODULE` being set at all refuses outright.
- The relative-path branch was removed rather than repaired. It resolved against the payload cwd while the command runs in the Bash tool's persistent shell, whose working directory can drift via a `cd` in a prior call (a lone `cd` is an ungoverned read; the one-line form is already blocked by the metacharacter ban, but two calls are not). Nothing in the hook or anywhere checkable pins the payload-cwd-equals-shell-cwd contract the branch rested on, and it bought convenience rather than capability.
- A contract the OS side must know: if the engine ever sets `NODE_OPTIONS` ambiently on its spawns (a benign `--max-old-space-size` would do it), this grant goes dark and workers fall back to the vector's deny. That is the deliberate direction (over-refusing is correct on a grant surface) but it is a real coupling between the engine's spawn environment and whether fleet workers keep memq.
- The hook is the kit's first that grants rather than denies, so its failure direction is the inverse of every sibling: for a guard, failing open means allowing; here the safe failure is emitting nothing. The security model's blanket "every guard fails open" sentence was true and is now incomplete, so it names both directions explicitly.
- The allow output shape was confirmed rather than assumed: the implementer extracted the schema and dispatch code from the fleet-pinned CLI binary (2.1.218), which validates `hookSpecificOutput.permissionDecision` against allow/deny/ask/defer and maps `allow` to an allow behavior. One link in the chain stays inferred and is worth flagging: how the host resolves this allow against a *deny* from another Bash PreToolUse hook on the same call.
- The target is anchored to `__dirname` rather than the `CLAUDE_PLUGIN_ROOT` the section text names. Deviation from spec text, deliberate, and both reviewers who examined it called it a tightening: `hooks.json` invokes the hook through that variable, so it resolves to the same file without trusting an env var a worker's environment carries, which is the same class of trust the Chapter 2 Critical turned on.
- The canary gained both-direction probes for the grant. A grant hook stuck at always-silent, or worse always-allow, is precisely the failure the canary exists to surface, and unlike a dead deny-guard it never announces itself in use: fleet workers would just quietly lose memq.
- Test-harness finding, recorded because it will mislead someone later: a *deleted* PATH is not probeable through `spawnSync` on Windows, because libuv re-injects the required variables from the parent when they are absent, so the child runs against the real PATH. The empty-string form is the strongest deliverable "no PATH" and is what the test pins.

Review Findings: 1 Critical, 4 Major, 12 Minor across three reviewers. Critical fixed (the unpinned interpreter). Majors fixed: the relative-path branch, the interpreter gap as the adversarial reviewer framed it, and the security-model updates. Minors fixed: the whitespace class narrowed to space and tab with the rest banned outright, rootless and drive-relative Windows spellings refused, `process.exit(0)` replaced with the `exitCode` pattern the repo already documents for exactly this truncation hazard, the vacuous junction-probe pass made a visible skip, and the missing hostile probes added (a node flag before the script path being the highest-value near-miss). Minor accepted as stated risk rather than code: the grant is agent-blind, because `readonly-agent-guard`'s classifier cannot be shared without restructuring that hook (it is a script whose `require()` would execute `main()` and hit a top-level `process.exit`), and copying a security-relevant list into a second file is the drift this plan's section 5 exists to prevent. Recorded in the security model with its compensating control: under the only environment where the grant fires, memq's writes land in section 2's pending tier, so such a write is quarantined and attributable. Minor noted, no change: lexical versus physical `..` resolution through a symlink inside the plugin tree, which requires write access the security model already places outside every control.

Next: Section 4, Style-skill paths resolve from the loaded plugin (sonnet)
Commit Model: Commit-and-Push
