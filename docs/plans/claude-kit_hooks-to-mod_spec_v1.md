# The kit's per-tool-call hooks answer from inside Claude Code, so a tool call spawns no process

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-10-01

## Dispatch Authorization

`Status: Ready` is the parked value the plan-doc contract gives an authored plan; this paragraph decides arming. The plan arms only after the operator rules on the two forks under `## Open Questions`, recorded as dated rulings under `## Intent`, the plan review runs once more over the rulings, and the coordinator then queues it for the kit's worker. Every section runs on a machine whose Claude Code is 2.1.287 or later, the first build that loads a hooks module with no flag.

## Goal

A tool call in a session with the kit installed starts no process for the kit's hooks. Today every tool call starts two, one before and one after, each a Node process the harness launches through a shell to run `hooks/hook-dispatch.js`, which then runs the kit's thirteen routed hooks in worker threads. Every prompt and every subagent start launch a third, the recognition nudge. On this machine a dispatcher launch costs about 105 ms of wall clock before the harness's own shell chain, so a session of three hundred tool calls spends over a minute launching processes whose own work takes milliseconds. When this ships, the kit's `hooks/hooks.json` names a hooks module that Claude Code 2.1.287 and later loads as a mod. The module starts one resident Node process per session that holds the twelve moved hook files loaded, hands it each event's payload over a loopback channel, and returns the answer in-process, so the hook files, their decisions and their tests do not change. The command hooks for the moved events leave `hooks.json` in the same section that the mod takes each event over, since any command hook still wired launches whatever the mod does, and the kit names 2.1.287 as its minimum build. The hooks that cannot move, because the mods API cannot hold a turn or block a stop, stay command hooks and the plan says which. Where the built-in guard refuses the mod, the canary line at session start says so, and a healthy session's canary stays silent as it does today.

## Intent

The operator's ask, relayed by the ASSISTANT persona on 2026-10-01: "list the hooks by how often they fire and what each spawn costs. Pick the ones worth moving first, the per-tool-call ones above all, and design the move." With four points to settle: (a) keep a command-hook fallback or name a minimum version; (b) how the kit's tests carry over and whether `claude plugin test` fits the gate; (c) how the kit behaves where the built-in guard or `allowManagedHooksOnly` refuses the mod; (d) a rollout a few hooks at a time.

What done needs to do. The fifteen command hooks are listed by fire frequency with a measured launch cost. The twelve whose logic runs on a tool call, a prompt or a subagent start move, as files unchanged with their decisions and their contract tests unchanged, in an order that moves the most frequent first. For the pre-call event the mod rebuilds the classic payload the guards read, the calling agent's type included. The moved events' command hooks leave the hooks file as each is taken over, so no event fires twice. The canary stays silent on a healthy session and speaks when the mod is absent or refused on a 2.1.287 build. The kit's gate gains a lane that drives the mod in-process.

What done does not need to do. It does not move the three Stop hooks, the SessionEnd hook, the PreCompact gate or the six SessionStart hooks, for reasons the Approach states per hook. It does not change what any hook decides. It does not rewrite any hook or shared library for the mod runtime. It does not touch the judgment sidecar's daemon, only its capture hook. It does not change the plugin's name. It does not adopt `$.tool.register`, `$.prompt.submit` or any mods API surface beyond what the resident channel and the moved events need.

Alternatives refused.
- Porting each hook's logic into a runtime-neutral core the mod runs in-process: refused. The twelve hooks run on six shared Node libraries and on `scripts/memq.js`, 21,075 lines requiring `child_process`; the core would rewrite most of the kit's hook code, and two copies of a guard drift.
- Running the dispatcher one-shot per event through `$.process.run`: refused as the design, since it halves the cost and keeps one bare Node start before and after every tool call. It stands as fork 1's option C.
- Keeping the moved events' command hooks wired as a fallback: refused pending fork 2, because the declarations put every hooks module above the other settings hooks in one chain, so a wired command hook launches whatever the mod returns, and the gain would wait on the fallback's removal.
- Moving all fifteen hooks: refused, since `turn.complete` returns text only and cannot hold a turn, every `session.end` hook shares one 1.5-second bound, and SessionStart fires once per session.
- Answering `classic.PreToolUse` from the mod: refused, since that event's mod-side input is the tool envelope with no session or agent fields. The pre-call half registers on `tool.call` and rebuilds the payload.

Rulings after the spec shipped, each appended dated. None yet.

Provenance: distilled by the ARCHITECT persona on 2026-10-01 from the ASSISTANT persona's relayed request, the kit tree at `3551ed71`, the installed hooks file, the 2.1.287 type declarations written by that build on this machine, the built-in guard's source at tag v2.1.287, timings taken on this machine the same day, and two plan reviews and a blind read of earlier drafts, whose findings reshaped the design.

## Approach

**What a mod is, in one paragraph.** A Claude Code plugin whose `hooks/hooks.json` names a JavaScript module becomes a mod from 2.1.287: Claude Code loads the module inside its own process and calls the module's `register(on)` once. Each `on(event, hook)` call registers a handler that receives the mods API as `$`, the event as `e`, and `next`, which passes the event on to the handlers beneath and to Claude Code's own behavior. A handler runs in a runtime with no Node and no DOM, reaches files, processes and the network only through `$`, has ten seconds of its own time per event not counting time inside a `$` call, and is skipped if it throws or overruns, with the chain beneath it running in its place. Every settings-hook event also fires as `classic.<Event>`, with `e` as the hook's whole stdin JSON for every event but PreToolUse, and the chain for such an event is managed settings hooks, then every hooks module, then the other settings hooks as core, so a module that answers without calling `next` silences every other plugin's settings hooks for that event. The declarations 2.1.287 writes are the reference.

**The premise, corrected.** The installed hooks file holds fifteen command hooks, not thirty, read from `~/.claude/plugins/cache/applefeld/claude-kit/ff34f6190627/hooks/hooks.json` and the tree's copy at `plugins/claude-kit/hooks/hooks.json` at `3551ed71`, which agree. Thirteen more hooks sit in `hooks/dispatch-table.json`, which the dispatcher routes in-process behind two of the fifteen. So the per-tool-call cost is already two launches, not fifteen, and the move takes those two to zero.

**The hooks by fire frequency, with the launch cost.** Measured on this machine on 2026-10-01 with Python driving the installed files directly, seven runs each, median wall clock: a bare `node -e ''` 46 ms, `hook-dispatch.js PreToolUse` 105 ms, `hook-dispatch.js PostToolUse` 107 ms, `memory-recognition-nudge.js` 80 ms. The harness's own launch adds a shell, a second shell and a console host that the dispatcher's header names and this measurement omits, so the real cost per launch is higher.

| Event | Fires | Launches today | Hooks behind the launch | Moves |
| :- | :- | :- | :- | :- |
| PreToolUse `*` | every tool call | 1, 105 ms | `docs-write-guard`, `memory-frontmatter-guard`, `pr-docs-guard`, `merged-pr-push-guard`, `readonly-agent-guard`, `memq-grant`, `memory-recognition-nudge`, each by matcher | yes, section 3 |
| PostToolUse `*` | every tool call | 1, 107 ms | `format-on-edit`, `chapter-boundary-nudge`, `compact-deferral-nudge`, `kit-sidecar-capture`, `memory-usage-stamp`, `memory-recognition-nudge`, each by matcher | yes, section 2 |
| UserPromptSubmit | every prompt | 1, 80 ms | `memory-recognition-nudge` | yes, section 2 |
| SubagentStart | every subagent | 1, 80 ms | `memory-recognition-nudge` | yes, section 2 |
| Stop | every turn end | 3 | `stop-docs-hygiene`, `kit-goal-stop`, `seat-stop` | no: two must block the stop, and `turn.complete` returns `{ text }` only |
| SessionStart | once, and on resume and compact | 6 | `session-start`, `branch-reaper-nudge`, `kit-version-nudge`, `doctrine-refresh`, `hook-canary`, `memory-session` | no: too rare to earn it |
| PreCompact `auto` | each compaction | 1 | `kit-compact-gate` | no: too rare |
| SessionEnd | once | 1 | `jev-session-end` | no: one 1.5-second bound shared by every `session.end` hook |

The two tool-call launches are the whole target: a session of three hundred tool calls spends about 63 seconds in them by this measurement, before the shell chain.

**Why the hook files cannot run inside the mod.** The mod runtime has no Node. The twelve moved hooks require `fs`, `path`, `os`, `crypto` and `child_process`, and six shared libraries under `hooks/` that do the same; `memory-usage-stamp.js` requires `scripts/memq.js` outright, and the recognition nudge calls its frontmatter parsers. Running them in-process means rewriting them against `$.fs`, `$.env` and `$.process`, which is most of the kit's hook code. So the hook logic stays in Node, in one process per session rather than two per tool call.

**The resident dispatcher.** `hook-dispatch.js` gains a serve mode beside its one-shot mode. In serve mode it binds an HTTP listener on `127.0.0.1` on a port the operating system assigns, prints that port and a random per-session token on its first stdout line, and then answers each request whose body is one classic payload and whose header carries the token with the merged result the one-shot mode would print, routed through the same table and the same worker threads. It exits when its stdin closes or its parent dies. The mod starts it from its `classic.SessionStart` hook through `$.process.spawn`, in a loop that runs on after the hook returns, the shape the declarations give for a child for the session's life, reads the port and token off the first chunk, and keeps them in module scope. The declarations say leaving that loop, the module unloading, or `next.signal` kills the child, and nothing else does, so the resident ends with the session or with a plugin reload and never outlives either. `classic.SessionStart` rather than `session.start`, because the chain passage places a hooks module above the kit's own SessionStart command hooks, and the canary is one of those.

**The channel, and the stop if it is refused.** Each moved event's mod hook posts the payload to the resident with `$.http.fetch` and returns the answer. The fetch is to the loopback address alone, with the token, and never carries the payload anywhere else. Section 2 probes first, on this machine, that `$.http.fetch` from a mod hook reaches a loopback listener a spawned child opened; the declarations say a refused network policy refuses `$.http.fetch`, and whether loopback counts is not written. A failed probe is a `BLOCKED:` stop at section 2, not a shipped slower channel: the Goal says no process, and the operator then rules between fork 1's options A and C.

**The pre-call adapter.** For PreToolUse the mod registers on `tool.call`, not on `classic.PreToolUse`, because the classic event's `e` is the tool envelope alone and `tool.call`'s input adds `agentId`. The mod builds the classic payload the guards read: `hook_event_name: "PreToolUse"`, `tool_name` from `e.tool`, `tool_input` from the envelope's fields with `tool`, `tool_use_id`, `consent` and `agentId` removed, `tool_use_id`, `session_id` from `$.session.id()`, `cwd` from `$.session.cwd()`, and in a subagent's call both `agent_id` from `e.agentId` and `agent_type` from the `type` of the `$.agent.list()` entry whose `id` equals it, since `kit-agent-identity-lib.js` reads the type under `agent_type` and `docs-write-guard.js` and `readonly-agent-guard.js` decide through it. The field sweep of 2026-10-01 over the twelve hook files and the two payload libraries found those fields and `tool_response`, `prompt`, `source` and `is_error`, and no `transcript_path`, `permission_mode` or `prompt_id`. A deny in the merged result returns `{ deny: reason }` from the hook; a context returns through `next` with the result's context appended; anything else passes `next(e)` through. For PostToolUse, UserPromptSubmit and SubagentStart the mod registers on the classic event, whose `e` is the stdin JSON whole, and returns the merged result as that event's classic result, which the declarations type per event.

**The command hooks leave as each event is taken over.** Section 2 removes the PostToolUse, UserPromptSubmit and SubagentStart command hooks in the same change that has the mod answer them; section 3 removes the PreToolUse command hook with the adapter. No section ships an event handled twice. The eleven other command hooks stay. Section 4 then names 2.1.287 as the kit's minimum build: the doctor reads `claude --version` and reports a build below it as a failed check, and the README states it. On a build below the minimum the `modules` key is ignored and the moved hooks do not run; the doctor is the signal. Fork 2's other option replaces this with a kept fallback and is stated there.

**The guard and the managed keys.** The built-in guard `sec-default@builtin` loads ahead of every user mod on a machine with managed settings or a Team or Enterprise sign-in, and the operator's machines carry a managed settings file. Read from the guard's source at v2.1.287: it refuses a user mod at load only under `allowManagedModsOnly` in managed settings; it refuses a user-tier `$.tool.register` only under an `allowedMcpServers` list, which this mod never calls; and it holds a managed deny rule over a user mod's allow, which this mod never issues. `allowManagedHooksOnly` blocks the mod and the kit's command hooks alike. So where the mod is refused, the kit has no per-call guards on that machine, and the canary says "mod: refused" at every session start with the reason the debug log gives. That is the operator's own managed file, so the ruling is theirs per machine.

**The canary keeps its contract.** `hook-canary.js` speaks only when something is positively broken, which `docs/architecture.md:131` states and `test/hook-canary.test.js:185` pins as exit 0 with no output on a healthy install. The mod's marker, written from `classic.SessionStart` into the temp directory keyed by the session id the way `kit-version-nudge.js` keys its own, is read by the canary: on a 2.1.287 build with the marker present the canary stays silent; with it absent the canary says "mod: absent", and "mod: refused" where the debug log names the guard. From section 2 the canary runs its deny and allow probes through the resident rather than the one-shot dispatcher, and its healthy run stays silent.

**The tests.** Every moved hook file keeps its `main(payload)` export and its contract test in `test/`, since the file does not change. `test/hook-dispatch.test.js` gains the serve mode: a test starts the dispatcher in serve mode, posts a payload, reads the answer, and checks it equals the one-shot answer for the same payload. New tests under `plugins/claude-kit/tests/*.test.ts` raise the mod's events in-process with `claude-code/testing`, with `$.process.spawn`, `$.http.fetch` and `$.agent.list` stubbed to a fake resident, and pin the pre-call adapter field by field, naming every key the recorded harness payload carries that the adapter drops. `claude plugin test` runs them in the plugin directory with no session or sign-in. It joins the targeted lane for any section that touches the mod and the whole gate at finishing, as a step whose exit code is read; on a build below 2.1.287 the step is a kit script that prints one SKIP line naming the version and exits 0, and the Chapter's lane record names it skipped rather than passed. The size ratchet in `test/size-ratchet.test.js` roots on `test/`; section 1 widens its roots to `plugins/claude-kit/tests/` and adds the budget entries. The build scripts need no change: the `hooks/*.js` glob at `build.ps1:70` and `build.sh:69` already hashes `mod.js`, and the tests directory is not hashed.

**The rollout order.** Section 1 is the scaffold: the module loads, the canary reads the marker, the lane lands, the harness assumptions are corrected. Section 2 is the resident, its channel probe, and the post-call, prompt and subagent events, which take the stdin payload whole, with their command hooks removed. Section 3 is the pre-call adapter with the six guards and the nudge's pre-call half, last because the guards deny and take the fail-closed shape and the security review, with the PreToolUse command hook removed. Section 4 names the minimum build and settles the docs. Each section leaves the kit shippable with no event handled twice.

## Sections of Work

### 1. The hooks module loads, the canary reads its marker, and the test lane lands

Model: opus

`hooks/hooks.json` gains `"modules": ["./mod.js"]` beside its `hooks`. `hooks/mod.js` registers `classic.SessionStart`, writes the per-session marker, and nothing else yet. `hook-canary.js` reads the marker and speaks only on absent or refused. `docs/harness-assumptions.md` replaces its five function-hooks entries, written against the 2.1.261 prototype, with what 2.1.287 declares. The `claude plugin test` lane lands with one test on `classic.SessionStart` and its skip script. The size ratchet's roots widen.

Acceptance:
- On a 2.1.287 build, a session with the kit installed shows the hooks module loaded in the debug log at tier user, and the canary's healthy run stays exit 0 with no output, the pin at `test/hook-canary.test.js:185` unchanged. With `--safe-mode` the canary prints "mod: absent". The refused word is pinned by a unit test on a planted debug line, since no managed restriction is set on this machine.
- `claude plugin validate --strict --json` on the plugin directory reports the module's hooks and calls and no error; the Chapter records its warnings.
- `claude plugin test` in the plugin directory runs one test and exits 0. The skip script, run with a planted version below 2.1.287, prints its SKIP line and exits 0, and the Chapter's lane record carries the word skipped.
- `docs/harness-assumptions.md` states the `$.fs` reach as the engine's own, the no-flag load from 2.1.287, the ten-second hook bound, the skip-on-throw rule, the `turn.complete` text-only result, the classic chain order and the `classic.PreToolUse` envelope, each with the 2.1.287 declarations as source.
- The existing suite is unchanged in count and verdict against its recorded baseline, with the size-budget entries added.

Files in scope: `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/hooks/mod.js`, `plugins/claude-kit/hooks/hook-canary.js`, `plugins/claude-kit/tests/session-start.test.ts`, `plugins/claude-kit/scripts/plugin-test-lane.js`, `docs/harness-assumptions.md`, `test/size-ratchet.test.js`, `test/size-budget.json`, `test/hook-canary.test.js`.
Tests: the canary's silence and its two words; the lane both ways; the ratchet's new root.

### 2. The resident dispatcher answers the post-call, prompt and subagent events, and their command hooks leave

Model: opus

The loopback probe runs first: a scratch mod spawns a Node listener on `127.0.0.1` and fetches it from a hook; the Chapter records the status, and a refusal is a `BLOCKED:` stop. Then `hook-dispatch.js` gains serve mode. `mod.js` starts it at `classic.SessionStart` in a background loop, reads the port and token, and registers `classic.PostToolUse`, `classic.UserPromptSubmit` and `classic.SubagentStart`, each posting `e` to the resident and returning the merged result as the classic result. `hooks.json` drops those three events' command hooks in the same change. The canary's probes move to the resident.

Acceptance:
- The Chapter records the loopback probe with the fetch's status from a mod hook on this machine.
- `test/hook-dispatch.test.js` starts serve mode, posts the fixtures the one-shot tests use, and reads answers equal to the one-shot answers, including a blocking one; a request without the token is refused.
- In a live session of twenty tool calls on 2.1.287 that edits a file, runs a Bash command, reads a file and names a stored memory in a prompt: the formatter ran once per edit, the sidecar spool gained exactly one capture per Bash call, the usage stamp landed once, and the recognition nudge reached the transcript once per boundary; the debug log shows each event answered by the mod and no command-hook launch for PostToolUse, UserPromptSubmit or SubagentStart.
- The resident ends with the session: after the session exits, no `hook-dispatch.js` process remains, read from the process list.
- `tests/resident.test.ts` raises the three events against a stub resident and reads the answers back.
- The canary's healthy run stays silent with its probes running through the resident.
- The twelve contract tests pass unchanged.

Files in scope: `plugins/claude-kit/hooks/hook-dispatch.js`, `plugins/claude-kit/hooks/hook-dispatch-boot.js` if the serve loop needs it, `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/hooks/mod.js`, `plugins/claude-kit/hooks/hook-canary.js`, `plugins/claude-kit/tests/resident.test.ts`, `test/hook-dispatch.test.js`, `test/hook-canary.test.js`, `test/memory-recognition-nudge.test.js` where it pins the hooks file's wiring, `test/kit-sidecar-capture.test.js` where it names the dispatcher, `test/size-budget.json`, `docs/security-model.md` where it states the resident's loopback listener, its token and what leaves the machine, which is nothing.
Tests: as stated.

### 3. The pre-call adapter feeds the six guards and the nudge's pre-call half, a failed guard denies, and the last command hook leaves

Model: opus

`mod.js` registers `tool.call`, builds the classic PreToolUse payload per the adapter, posts it to the resident, and returns `{ deny }` on a block, `next` with the context on a context, and `next(e)` otherwise. The registration carries a `.catch` handler that returns a deny naming the failure, so a thrown or overrun hook blocks rather than passes. `hooks.json` drops the PreToolUse command hook. The security reviewer runs over this section's delta.

Acceptance:
- `tests/pre-call-adapter.test.ts` pins every field the adapter builds, for a Bash call, an Edit call, an MCP tool call and a subagent's call carrying `agentId` with `$.agent.list` stubbed to return its type, against the payload the harness writes for the same call, read from a recorded fixture; every key the recorded payload carries that the adapter does not build is named in the test as dropped.
- For each of the six guards, a denied fixture and an allowed fixture read the same verdict through the mod and through the one-shot command path; the denied fixtures for `readonly-agent-guard` and `docs-write-guard` are a subagent's call carrying a governed agent type.
- A test plants a throw in the resident's answer path and reads a deny from the mod.
- In a live session on 2.1.287, a write under `docs/` that the docs guard refuses today is refused with the same message, and the debug log shows the mod's deny and no PreToolUse command-hook launch; an allowed write passes.
- The six contract tests pass unchanged.

Files in scope: `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/hooks/mod.js`, `plugins/claude-kit/tests/pre-call-adapter.test.ts`, `plugins/claude-kit/tests/guards.test.ts`, `test/memory-recognition-nudge.test.js` where it pins the PreToolUse wiring, `test/size-budget.json`, `docs/security-model.md` where it states that a guard's mod path fails closed.
Tests: as stated.

### 4. The kit names its minimum build and the docs describe the resident

Model: sonnet

Under fork 2's ruling. The doctor gains the minimum-build check. The README, `docs/architecture.md`, `docs/security-model.md`, `docs/fleet-integration.md` and `docs/harness-assumptions.md:102` describe the resident in the dispatcher's place. `hook-dispatch.js`'s one-shot mode stays for the tests and the canary's unit probes. The Chapter appends the stale header comment at `memory-recognition-nudge.js:100-116`, which describes four hooks.json registrations that no longer exist, to the backlog item at `docs/backlog.md:87` rather than editing the file.

Acceptance:
- `hooks.json` holds the `modules` key and exactly the eleven command hooks of the Stop, SessionStart, PreCompact and SessionEnd events.
- The doctor on this machine passes the minimum-build check; with a planted version below 2.1.287 it fails the check and names the build.
- The canary's healthy run on this machine stays exit 0 with no output, the pin unchanged.
- Every test passes; the size budget carries no entry for a removed file.

Files in scope: `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/skills/kit-doctor/SKILL.md`, `test/doctor-payload.test.js`, `README.md`, `docs/architecture.md`, `docs/security-model.md`, `docs/fleet-integration.md`, `docs/harness-assumptions.md`, `docs/backlog.md`, `test/size-budget.json`.
Tests: the hooks-file pin; the doctor both ways; the canary's silence.

## Out of Scope

- The three Stop hooks, the SessionEnd hook, the PreCompact gate and the six SessionStart hooks, for the reasons the Approach states.
- The judgment sidecar daemon and its modules under `sidecar/`.
- Any rewrite of a hook file or shared library for the mod runtime.
- Any new capability on the mods API: no registered tool, no command, no pane, no prompt submission.
- The plugin's name.
- The persona plugin in the `agent_persona` repository, which is already a mod.

## Assumptions

- assumed 2026-10-01 (source: the 2.1.287 declarations, `$.process.spawn` passage): a child the mod spawns in a loop that runs on after its hook returns lives for the session and dies with the module; reversal: the resident watches its parent and exits on its own, in section 2.
- assumed 2026-10-01 (inferred, probed first in section 2): `$.http.fetch` from a mod hook reaches a listener on `127.0.0.1`; reversal: a `BLOCKED:` stop and the operator's ruling between fork 1's other options.
- assumed 2026-10-01 (source: the field sweep of 2026-10-01 over the twelve hook files and the two payload libraries): no moved hook reads `transcript_path`, `permission_mode` or `prompt_id`; reversal: a hook that does keeps its command path and is named in the Chapter.
- assumed 2026-10-01 (source: the 2.1.287 declarations, `ClassicResultOf`): a hook on `classic.PostToolUse`, `classic.UserPromptSubmit` or `classic.SubagentStart` returns that event's classic result; reversal: none needed.
- assumed 2026-10-01 (source: the 2.1.287 declarations, chain passage): a hooks module's `classic.SessionStart` hook runs before the kit's own SessionStart command hooks, so the marker is on disk when the canary reads it; reversal: the canary reads the marker on the next SessionStart and section 1 says so.
- assumed 2026-10-01 (source: the 2.1.287 declarations, `$.agent.list()` entry shape with `id` and `type`): the calling subagent's type is read from that list by `agentId`; reversal: the guards that read a type keep their command path.
- assumed 2026-10-01 (default): the mod's file is `hooks/mod.js`; reversal: rename.

## Operator Verification

- After section 2 merges and the plugin is reinstalled, start a session on a 2.1.287 machine and read the session start: the canary prints nothing. Type a prompt naming a stored memory and read the recognition nudge in the transcript.
- After section 3 merges, attempt a write the docs guard refuses and read the refusal.
- After section 4 merges, run the doctor on each machine the kit is installed on. A machine below 2.1.287 fails the minimum-build check and has no per-call guards until it upgrades.

## Open Questions

Two forks for the operator, each with a recommendation. The plan arms on both rulings.

1. **Fork 1, how an event reaches the hook logic.** The hook files need Node, and the mod runtime has none. Option B, recommended: one resident Node process per session, started by the mod, holding the hook files loaded, answering each event over a loopback HTTP call with a per-session token; the hook files and their tests do not change, a tool call spawns nothing, and the cost is one listener on the loopback address per session and a probe that the mods API's fetch reaches it, which stops the run if it fails. Option C: the mod runs the dispatcher one-shot per event through the mods API's process call, with no shell; smallest change, halves the cost, keeps one bare Node start before and after every tool call. Option A: port the hook logic into a runtime-neutral core the mod runs in-process; zero spawns and no listener, at the cost of rewriting most of the kit's hook code and its six shared libraries, with every guard reviewed again. The sections above are written for B.
2. **Fork 2, the command hooks for the moved events.** Option 1, recommended: remove each as the mod takes its event over, in sections 2 and 3, and name 2.1.287 as the kit's minimum build, enforced by the doctor in section 4; the gain lands as each section merges, and a machine below the minimum has no per-call guards until it upgrades, which the doctor reports. Option 2: keep them wired as a fallback with the dispatcher exiting early on the marker where the mod is live; every machine keeps its guards on any build, and every tool call keeps two Node launches plus the shell chain until a later section removes the fallback, so the gain waits on the fleet. The sections above are written for option 1; option 2 keeps the command hooks in sections 2 and 3, adds the marker read to the dispatcher, and parks a removal section on the fleet's builds.

## Chapters
