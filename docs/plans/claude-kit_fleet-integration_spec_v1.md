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

Test harness: Node's built-in runner, no framework, Node v24. Run `node --test test` from the repo root; it must be green before and after every section.

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
- Read paths (`recall`, `find`, `get`) span the main tier plus the caller's own `pending/<KIT_RUN_ID>/` only. Another run's pending directory is never read, listed, or counted. `recall` presents pending records under a labeled coverage line (the same explicit-surface pattern the digest already uses).
- `KIT_RUN_ID` unset: behavior byte-identical to today, existing tests as the pin.

Run-id values are sanitized before path use (the id becomes a directory name; refuse separators, dots-only names, and anything outside a conservative token grammar, loudly).

Files: `plugins/claude-kit/scripts/memq.js`, `plugins/claude-kit/hooks/memory-session.js`, tests in `test/`.
Acceptance: `node --test test` green; a child spawned with the three env vars writes to and recalls its own pending dir; a second run id's pending memory never surfaces in the first's recall, find, or get.
Tests: both directions (env set routes and scopes; env unset is byte-identical), cross-run isolation, hostile run-id values refused, and the write-shape invariant (no new shared-file rewrite outside the lock).

### 3. PreToolUse grant hook for memq under gated vectors
Model: fable

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
Model: sonnet

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
