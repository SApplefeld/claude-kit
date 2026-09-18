# One process per tool-call event: a dispatcher that runs the kit's tool-use hooks as threads

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-09-18

Session model: the KIT: Expert session on SCOTT-CLAUDE, run by that seat in the worktree `.claude/worktrees/hook-dispatcher` on the operator's keyboard word of 2026-09-18 ("Write the spec and immediately implement if possible. Run it yourself in a worktree."). Two sections in order at fable, since section 2 rewires the consumers of the table section 1 introduces. Anchors are named by function; re-locate every hit by content.

## Goal

A tool call costs one kit hook process before it and one after it, where a Bash call today costs nine. Every guard keeps its exact verdict, its exact exit-code meaning and its exact text, because no guard's file changes.

When this plan is done: `hooks.json` wires one command on PreToolUse and one on PostToolUse; that command runs each hook the old wiring would have matched, unmodified, inside its own thread; a differential test proves the merged answer equals what the hooks answer when spawned one by one; and one environment variable returns a machine to child-process behaviour without a reinstall.

## Evidence

Measured on SCOTT-CLAUDE on 2026-09-18 from the installed plugin at `951fde141519`.

- A Bash call matches nine hook commands, six on PreToolUse and three on PostToolUse. A PowerShell call matches seven. All are `node "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.js"`.
- The harness launches each through `bin\bash.exe`, which launches `usr\bin\bash.exe`, which launches node, with a console host beside them: four process creations per hook, about 36 per Bash call.
- One real guard, `readonly-agent-guard.js`, with a realistic payload: 107 ms median through the harness's launch shape, 49 ms as node alone, against 45 ms for a bare `node -e 0`. The guard's own logic is about 4 ms. The cost is the launch.
- With no test runner alive the box read 67.6 percent CPU, 34.3 percent of it kernel, run queue 5.0 on 4 cores, five Claude sessions live.
- All twelve hooks wired on the two tool-use events read their payload as `fs.readFileSync(0, 'utf8')`, write their answer to stdout or stderr, and end through `process.exit` or a natural return. None awaits.
- A prototype ran five stand-in hooks in worker threads in 85 ms inside one process and confirmed each behaviour the design rests on: `process.exit(2)` and `process.exitCode = 2` both surface as the thread's exit code; `require.main === module` holds for a hook loaded as the thread's main module; an uncaught throw surfaces as exit 1 with its stack on stderr; and nothing after `process.exit` runs, inside a `try` included.

## Decisions

Decided 2026-09-18 by the authoring seat on the evidence above.

1. **Threads around unmodified hooks, not imported functions.** The hooks are top-level scripts of up to 2,800 lines that call `process.exit` from inside their logic. Refactoring twelve guards into importable functions is a rewrite of the kit's security surface. A worker thread gives each hook its own `process.exit`, its own uncaught-exception boundary and its own module cache, so a hook's file does not change by one byte and one hook's failure cannot reach another. The threads run concurrently, which is how the harness runs matched hooks today.
2. **The routing table is a file in `hooks.json`'s own shape.** `hooks/dispatch-table.json` holds `{ "hooks": { "PreToolUse": [...], "PostToolUse": [...] } }`, the two arrays moved verbatim. The canary's enumeration function and the wiring tests then read it with the code they already have. The build hashes it beside `hooks.json`, because rewiring a guard out of the table disarms it exactly as rewiring it out of `hooks.json` does.
3. **The matcher is read the way the harness reads it.** Absent, empty or `*` matches every tool; anything else is a regular expression anchored at both ends against `tool_name`.
4. **Merge rules, stated whole.** Any hook exiting 2 makes the dispatcher exit 2 with those hooks' stderr, in table order. Otherwise the dispatcher exits 0 and prints one JSON object when any hook printed one: `permissionDecision` by the precedence deny, then ask, then allow, with the reason of each hook holding the winning value; every `additionalContext` joined in table order by a blank line; `hookEventName` from the payload. A hook that exits with any other non-zero code is a non-blocking failure exactly as today: its stderr goes to the dispatcher's stderr, and it is named in a `systemMessage` when JSON is printed, or the dispatcher exits 1 when nothing else is. A hook that prints something that is not a JSON object has it passed through as plain stdout only when it is the sole hook with output, which is what the harness would have shown.
5. **Every failure of the dispatcher's own machinery falls back to a child process, never to silence.** A thread that ends without writing its result, a result too large for its buffer, a thread that fails to start, and any throw in the dispatcher itself all send the affected hooks through `spawnSync(process.execPath, [hook])` with the payload on stdin, which is the behaviour this plan replaces. A guard therefore never fails open because the dispatcher broke. `KIT_HOOK_DISPATCH=legacy` forces that path for every hook, as the rollback that needs no reinstall.
6. **A hung hook costs itself.** Each thread gets a deadline under the harness's own sixty seconds; past it the thread is terminated and reads as a non-blocking failure, which is what the harness's timeout makes of it today.
7. **One accepted difference.** When a call is blocked by exit 2, the harness ignores stdout, so a recognition nudge's context for that same call is not delivered. Today it is, as a separate hook's answer. A blocked call is the one moment that context is least useful, and converting exit 2 into a JSON denial to keep it would change every guard's delivery channel.
8. **Scope is the two tool-use events.** They are the per-tool-call cost. SessionStart and Stop fire once per session or turn, their hooks spawn and wait on git and the network, and one of them is the goal leash; they stay as they are.

## Sections of Work

### 1. The dispatcher and its differential pin. Model: fable

Add `plugins/claude-kit/hooks/hook-dispatch.js`, its thread bootstrap `hook-dispatch-boot.js`, and `dispatch-table.json`. The dispatcher reads the payload once, selects hooks by event and matcher, runs them per Decisions 1, 5 and 6, merges per Decision 4, and exports its selection and merge functions for the tests.

Tests in `test/hook-dispatch.test.js`. The differential test is the acceptance: for a fixed set of realistic payloads across Bash, PowerShell, Write, Edit, Read and an unmatched tool, on both events, each selected hook is spawned as a child process the old way and the set is merged by the exported merge function; the dispatcher run end to end must produce the same exit code, the same stderr and the same parsed JSON. Each payload set includes one call a guard blocks, so the exit 2 path is compared and not only the quiet one. Further tests: the matcher semantics including the anchoring; every merge rule with stand-in hooks; one throwing stand-in leaves its neighbours' answers intact; a stand-in that overflows its buffer and one whose thread is killed both come back through the child-process path; `KIT_HOOK_DISPATCH=legacy` produces the same answer as the threaded path. Every test owns its temp directory and opens no port.

Files in scope: the three new files; `test/hook-dispatch.test.js`.

Acceptance: the differential test green on every payload; the new file's lane green with its exit code read from the run; a timing line in the Chapter comparing nine child processes against one dispatcher run on this box, stated with the contention it was measured under.

### 2. The rewiring and everything that reads the wiring. Model: fable

`hooks.json` wires `hook-dispatch.js` on matcher `*` for PreToolUse and PostToolUse and keeps every other event as it is. `hook-canary.js` enumerates the dispatch table beside `hooks.json`, so every routed hook keeps its load check and its wiring check, and reports a `hooks.json` that names the dispatcher beside a table that is missing or unparseable. `build.ps1` and `build.sh` hash `dispatch-table.json`. The two wiring tests, in `test/kit-sidecar-capture.test.js` and `test/memory-recognition-nudge.test.js`, read the table for the tool-use events. `test/hook-canary.test.js` gains the table cases. A new pin asserts that every hook file the table names exists and that `hooks.json` names no tool-use hook but the dispatcher, so a guard cannot be wired in one place and silently shadowed by the other. `docs/architecture.md` and `docs/security-model.md` state the dispatcher, the fallback and the rollback variable. `test/size-budget.json` takes whatever entries the ratchet asks for.

Files in scope: `plugins/claude-kit/hooks/hooks.json`; `plugins/claude-kit/hooks/hook-canary.js`; `build.ps1`; `build.sh`; `test/hook-canary.test.js`; `test/kit-sidecar-capture.test.js`; `test/memory-recognition-nudge.test.js`; `test/hook-dispatch.test.js`; `test/size-budget.json`; `docs/architecture.md`; `docs/security-model.md`.

Acceptance: the targeted lane over every test file named above plus the twelve routed hooks' own test files, green, delta stated against a baseline recorded on that same lane before the first edit; the plugin rebuilt and the canary run against the built cache reporting nothing.

## Gate

The whole gate is barred on SCOTT-CLAUDE for now by the operator because of the load this plan addresses. The plan closes on the targeted lane above, and the whole gate runs before the pull request is marked ready only on the operator's word or on another machine.

## Out of Scope

- Any edit to a routed hook's own file.
- SessionStart, Stop, UserPromptSubmit, SubagentStart and PreCompact wiring.
- The shell the harness launches a hook through, which is the harness's choice.
- Windows Defender exclusions and the agent_persona supervisor loops, which are other owners' halves of the same diagnosis.

## Operator Verification

After the pull request merges, `claude plugin update` and a session restart, since the harness reads hook wiring at session start. Run a process-birth trace for thirty seconds with the same sessions live and compare against the 2026-09-18 baseline of 228 births. A Bash call in a session should still be refused a push to a merged pull request's branch, and a read-only reviewer should still be refused a write.

## Chapters

### Chapter 1 - 2026-09-18

Section 1 shipped: `hook-dispatch.js`, `hook-dispatch-boot.js`, `dispatch-table.json` and `test/hook-dispatch.test.js`. No routed hook's file changed.

Decisions and surprises.

- Three routed hooks answer with `fs.writeSync(1, ...)` and two report with `fs.writeSync(2, ...)`, which reach the real descriptor and never touch `process.stdout`. A sweep of the twelve hooks for output paths found them before the first run. The bootstrap collects writes to descriptors 1 and 2 beside the stream writes, and a test pins the string form and the buffer-with-offset form.
- The event rides the command line (`hook-dispatch.js PreToolUse`) rather than the payload, so a payload that does not parse still routes. With no readable tool name every hook for the event runs, since each already fails open on a payload it cannot parse and running too many is the safe direction for guards.
- An unusable routing table is exit 1 with a message that names it, not a block. A session that cannot make a tool call cannot repair its own install, and the canary reports the same break at session start under section 2.
- One assumption was wrong and the test caught it. A throw from a callback does not end a thread before its exit handler: the handler runs and the thread exits 1, exactly as a process does. What differed was the stack, which node prints for a process and hands to the `error` event for a thread. The dispatcher now puts it back on stderr. The fallback for a thread that ends with no answer is pinned with a stand-in that removes its exit listeners.
- `dispatch()` takes a hooks directory, a legacy flag and a deadline as options for the tests. The command line reads none of them from the environment but `KIT_HOOK_DISPATCH=legacy`, so nothing a session can set reroutes a guard to another file.

Lane: `node --test test/hook-dispatch.test.js`, 31 tests, 31 pass, 0 fail, 0 skipped, exit 0, read from the run, 14 s wall. No baseline exists on this lane, the file being new. The first run read 30 tests, 29 pass, 1 fail, exit 1, the one red being the wrong assumption above. Ten of the 31 are the differential pin over the real routing table and the real hooks, one of them the read-only reviewer's `git push`, which blocks with exit 2 and the same text on both sides. Run unclaimed beside a `KIT: Worker` heavy-process claim 686 s old against a declared 600 s, with two of that session's test runners alive, so the wall clock is a loaded box's.

Timing, same box and same contention, one realistic payload per row, second run of each: PreToolUse Bash 138 ms through the dispatcher against 951 ms for the six hooks as child processes run in turn; the blocked reviewer push 109 ms against 950 ms; PostToolUse Bash 140 ms against 760 ms. First runs of the dispatcher read 450 to 620 ms, which is this box's launch scatter and shows on a bare `node -e 0` too. The child-process figure is serial where the harness launches in parallel, so it is the CPU the old wiring spends and not the wall clock a session waited.

Reviews: deferred to one pass over both sections, since section 2 is small and rewires what section 1 introduces. The adversarial, blind and security reviewers run over the whole changeset before the pull request is marked ready.

Next: section 2, the rewiring and the consumers of the wiring. Commit model: Branch-and-PR, committed and pushed on `feat/hook-dispatcher`.
