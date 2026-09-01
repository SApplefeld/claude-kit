// Tests for plugins/claude-kit/hooks/memory-recognition-nudge.js (the
// PreToolUse and PostToolUse memory recognition nudge).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a tool-event payload on stdin, and asserted on by
// its EXIT CODE (always 0; this hook has no deny path) and its stdout: a fire
// emits exactly the nested hookSpecificOutput form carrying the boundary's own
// hookEventName, and every silent path emits the empty string, because a
// weaker "no nudge substring" check would pass on a crashed hook.
//
// Every trigger class is pinned in both directions, a fixture that must nudge
// beside a named control that must not, since a matcher that fires on
// everything is as wrong as one that fires on nothing.
//
// Each case owns three temp directories and shares none of them: a store root
// the child is pointed at with KIT_MEMORY_ROOT plus its second signal
// KIT_MEMORY_ROOT_ALLOW_DATA=1, a working directory the project tier is
// resolved from, and a TEMP the child's own state directory is created under.
// The third is what keeps one case's dedup marker and index cache out of
// another's and out of the machine's real temp directory, and it is what lets
// the cases below plant things at the paths the hook writes to. KIT_MEMORY_PROJECT
// is emptied so an ambient store pin cannot take the project tier away.
//
// One rule the fixtures answer to, learned from a case that was green only on
// a machine with a short TEMP: a store PIN is a store path segment, capped at
// 40 characters by memq and refused past it, so a pin is never derived from a
// temp path. makeStore asserts the pin it hands out against memq's own reader.
//
// The matcher and the payload readers are exercised in-process rather than
// through a spawn: they are pure functions, and the pathological-pattern
// timing bound cannot be read through a process spawn's own variance.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync, spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'memory-recognition-nudge.js');
const hook = require('../plugins/claude-kit/hooks/memory-recognition-nudge.js');
const memq = require('../plugins/claude-kit/scripts/memq.js');

// A sha shaped like a git blob name. The sha is never consulted at match
// time, which one of the anchor cases below pins directly.
const SHA = 'a'.repeat(40);

// The pin the network case uses. Fixed and short: memq caps a store path
// segment at 40 characters and pinnedProjectSegment throws past it, so a pin
// derived from a temp path passes on a machine whose TEMP is short and reds
// everywhere else.
const PIN_SEGMENT = 'recognition-network-fixture';

let sessions = 0;
function nextSession() {
    sessions += 1;
    return 'ses-recognition-' + process.pid + '-' + sessions;
}

// A fresh store root, a project working directory, a private TEMP, and the
// memory directory memq resolves for that working directory. The working
// directory holds no .git, so memq's project segment is the sanitized path of
// the directory itself and this join lands on the same directory the child
// will resolve.
function makeStore() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-root-'));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-repo-'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-tmp-'));
    const memDir = path.join(root, 'projects', memq.sanitizeProjectPath(cwd), 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    return { root, cwd, tmp, memDir, session: nextSession() };
}

function rmStore(store) {
    for (const target of [store.root, store.cwd, store.tmp]) {
        try { fs.rmSync(target, { recursive: true, force: true }); } catch { /* best effort */ }
    }
}

// The child's own state directory, and the two files it keeps there, named
// through the hook's own naming functions so a rename of either cannot leave
// these cases asserting about paths nothing writes.
function stateDir(store) {
    return path.join(store.tmp, 'claude-kit-recognition');
}
function cachePath(store) {
    return hook.cacheFile(stateDir(store), store.memDir);
}
function markerPath(store, session) {
    return hook.markerFile(stateDir(store), session || store.session);
}

// A memory record with the frontmatter fields a case needs. The body carries a
// distinctive token so the pointer-only rule can be pinned: a nudge that
// quoted the record would carry it.
const BODY_TOKEN = 'body-text-that-must-never-be-quoted';

function writeRecord(store, name, fields) {
    writeRecordIn(store.memDir, name, fields);
}

function writeRecordIn(dir, name, fields) {
    const lines = ['---'];
    if (fields.triggers) lines.push('triggers: ' + fields.triggers);
    if (fields.anchors) lines.push('anchors: ' + fields.anchors);
    if (fields.machine) lines.push('machine: ' + fields.machine);
    lines.push('---', '', '# ' + name, '', BODY_TOKEN, '');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), lines.join('\n'), 'utf8');
}

// Drop the external-engine marker from a child's environment, matched
// case-insensitively (Windows environment blocks preserve arbitrary key
// casing). Without the scrub, running this suite inside a fleet worker would
// turn every fire case into a stand-down silence.
function scrubEngineEnv(env) {
    for (const k of Object.keys(env)) {
        if (/^KIT_EXTERNAL_ENGINE$/i.test(k)) delete env[k];
    }
    return env;
}

// The child's environment: the store signals, an emptied pin, and the private
// TEMP under all three names os.tmpdir reads (TMPDIR off win32, TEMP and TMP
// on it), so the child's state directory is this case's own.
function childEnv(store, extraEnv) {
    return {
        ...scrubEngineEnv({ ...process.env }),
        KIT_MEMORY_ROOT: store.root,
        KIT_MEMORY_ROOT_ALLOW_DATA: '1',
        KIT_MEMORY_PROJECT: '',
        TMPDIR: store.tmp,
        TEMP: store.tmp,
        TMP: store.tmp,
        ...(extraEnv || {})
    };
}

function runHook(store, payload, extraEnv) {
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        env: childEnv(store, extraEnv),
        encoding: 'utf8'
    });
}

// The same run, not blocking, for the cases that need several copies of the
// hook in flight at once.
function runHookAsync(store, payload, extraEnv) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [HOOK], { env: childEnv(store, extraEnv) });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });
        child.on('close', (status) => resolve({ status, stdout, stderr }));
        child.stdin.end(JSON.stringify(payload));
    });
}

function prePayload(store, overrides) {
    return {
        session_id: store.session,
        cwd: store.cwd,
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'echo nothing-in-particular' },
        ...overrides
    };
}

function postPayload(store, overrides) {
    return {
        session_id: store.session,
        cwd: store.cwd,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: path.join(store.cwd, 'src', 'untouched.txt') },
        tool_response: {},
        ...overrides
    };
}

function assertSilent(res, label) {
    assert.strictEqual(res.status, 0, label + ': exit code must be 0');
    assert.strictEqual(res.stderr, '', label + ': stderr must be empty');
    assert.strictEqual(res.stdout, '', label + ': stdout must be empty');
}

// A fire: exit 0, nothing on stderr, and stdout that is exactly the nested
// form with the boundary's own event name. Returns the injected text.
function assertNudge(res, boundary, label) {
    assert.strictEqual(res.status, 0, label + ': exit code must be 0');
    assert.strictEqual(res.stderr, '', label + ': stderr must be empty');
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(res.stdout); },
        label + ': stdout must be JSON, got: ' + JSON.stringify(res.stdout.slice(0, 300)));
    assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput'],
        label + ': a top-level additionalContext key is inert on this harness and must not be emitted');
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, boundary,
        label + ': the event name must be the boundary the payload arrived on');
    const text = parsed.hookSpecificOutput.additionalContext;
    assert.strictEqual(typeof text, 'string', label + ': additionalContext must be a string');
    return text;
}

// A fire that names one record and one trigger, and carries none of the
// record's body.
function assertNames(text, record, trigger, label) {
    assert.ok(text.includes(record), label + ': the nudge names the record, got: ' + text);
    assert.ok(text.includes(trigger), label + ': the nudge names the trigger, got: ' + text);
    assert.ok(text.includes('memq get ' + record.slice(0, -3)),
        label + ': the nudge carries the memq get spelling, got: ' + text);
    assert.ok(!text.includes(BODY_TOKEN), label + ': a nudge never carries the record body');
}

// --- The six trigger types, each with its named control.

test('a cmd: trigger fires at PreToolUse on the command it names, and not on a sibling command', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const fired = runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        }));
        assertNames(assertNudge(fired, 'PreToolUse', 'cmd fire'), 'test-suite-invocation.md',
            'cmd:node --test', 'cmd fire');
        const control = makeStore();
        try {
            writeRecord(control, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
            assertSilent(runHook(control, prePayload(control, {
                tool_input: { command: 'node --version' }
            })), 'cmd control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('a cmd: trigger matches case-insensitively', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'pwsh-invocation.md', { triggers: 'cmd:Get-ChildItem' });
        const res = runHook(store, prePayload(store, {
            tool_name: 'PowerShell',
            tool_input: { command: 'get-childitem -Recurse' }
        }));
        assertNames(assertNudge(res, 'PreToolUse', 'cmd casing'), 'pwsh-invocation.md',
            'cmd:Get-ChildItem', 'cmd casing');
    } finally { rmStore(store); }
});

test('a cmd: trigger is not read off a non-shell tool that happens to carry a command key', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        assertSilent(runHook(store, prePayload(store, {
            tool_name: 'Skill',
            tool_input: { command: 'node --test' }
        })), 'cmd on a non-shell tool');
    } finally { rmStore(store); }
});

test('a skill: trigger fires on the skill invoked, and not on a skill whose name merely contains it', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'memory-store-rules.md', { triggers: 'skill:memory-system' });
        const fired = runHook(store, prePayload(store, {
            tool_name: 'Skill',
            tool_input: { command: 'claude-kit:memory-system' }
        }));
        assertNames(assertNudge(fired, 'PreToolUse', 'skill fire'), 'memory-store-rules.md',
            'skill:memory-system', 'skill fire');
        const control = makeStore();
        try {
            writeRecord(control, 'memory-store-rules.md', { triggers: 'skill:memory' });
            assertSilent(runHook(control, prePayload(control, {
                tool_name: 'Skill',
                tool_input: { command: 'claude-kit:memory-system' }
            })), 'skill control (an identifier type matches whole, never by containment)');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('an agent: trigger fires on the agent type dispatched, and not on a different type', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'first-turn-reading-path.md', { triggers: 'agent:implementer' });
        const fired = runHook(store, prePayload(store, {
            tool_name: 'Agent',
            tool_input: { subagent_type: 'claude-kit:implementer', prompt: 'go' }
        }));
        assertNames(assertNudge(fired, 'PreToolUse', 'agent fire'), 'first-turn-reading-path.md',
            'agent:implementer', 'agent fire');
        const control = makeStore();
        try {
            writeRecord(control, 'first-turn-reading-path.md', { triggers: 'agent:implementer' });
            assertSilent(runHook(control, prePayload(control, {
                tool_name: 'Agent',
                tool_input: { subagent_type: 'claude-kit:adversarial-reviewer', prompt: 'go' }
            })), 'agent control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('a tool: trigger fires on the tool named, and not on a tool whose name extends it', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'worktree-guard-refuses-compounds.md', { triggers: 'tool:Bash' });
        const fired = runHook(store, prePayload(store, { tool_name: 'Bash' }));
        assertNames(assertNudge(fired, 'PreToolUse', 'tool fire'), 'worktree-guard-refuses-compounds.md',
            'tool:Bash', 'tool fire');
        const control = makeStore();
        try {
            writeRecord(control, 'worktree-guard-refuses-compounds.md', { triggers: 'tool:Bash' });
            assertSilent(runHook(control, prePayload(control, {
                tool_name: 'BashOutput',
                tool_input: {}
            })), 'tool control (BashOutput is not Bash)');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('an err: trigger fires at PostToolUse on a failed call\'s output, and not on a clean call', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'err:Cannot find module' });
        const fired = runHook(store, postPayload(store, {
            tool_name: 'Bash',
            tool_input: { command: 'node --test test' },
            tool_response: { stdout: '', stderr: 'Error: Cannot find module \'test\'', exit_code: 1 }
        }));
        assertNames(assertNudge(fired, 'PostToolUse', 'err fire'), 'test-suite-invocation.md',
            'err:Cannot find module', 'err fire');
        const control = makeStore();
        try {
            writeRecord(control, 'test-suite-invocation.md', { triggers: 'err:Cannot find module' });
            assertSilent(runHook(control, postPayload(control, {
                tool_name: 'Bash',
                tool_input: { command: 'echo x' },
                tool_response: { stdout: 'Cannot find module was printed, not raised', stderr: '', exit_code: 0 }
            })), 'err control (a successful call\'s stdout is not failure output)');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

// The control the type most needs: a successful command that writes progress
// to stderr. Reading stderr as failure output whatever the call's outcome
// fires an err: trigger on every clean `git` or `npm` call that mentions the
// pattern, which is the same noise the stdout rule above exists to prevent.
test('an err: trigger does not fire on stderr from a call that did not fail', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'err:Cannot find module' });
        assertSilent(runHook(store, postPayload(store, {
            tool_name: 'Bash',
            tool_input: { command: 'git fetch' },
            tool_response: { stdout: 'done', stderr: 'note: Cannot find module is only a warning here' }
        })), 'unflagged stderr is not failure output');
    } finally { rmStore(store); }
});

test('an err: trigger reads the failure shapes a tool answers with', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'err:Cannot find module' });
        const shapes = [
            ['a flagged string response', { is_error: true, tool_response: 'Cannot find module x' }],
            ['an array of content blocks', {
                is_error: true,
                tool_response: [{ type: 'text', text: 'Cannot find module x' }]
            }],
            ['an error field', { tool_response: { error: 'Cannot find module x' } }],
            ['a nested error message', { tool_response: { error: { message: 'Cannot find module x' } } }],
            ['a non-zero exit code beside stderr', {
                tool_response: { exitCode: 2, stderr: 'Cannot find module x' }
            }],
            ['an interrupted call', {
                tool_response: { interrupted: true, stdout: 'Cannot find module x' }
            }]
        ];
        for (const [label, overrides] of shapes) {
            const one = makeStore();
            try {
                writeRecord(one, 'test-suite-invocation.md', { triggers: 'err:Cannot find module' });
                assertNames(assertNudge(runHook(one, postPayload(one, {
                    tool_name: 'Bash',
                    tool_input: { command: 'x' },
                    ...overrides
                })), 'PostToolUse', label), 'test-suite-invocation.md', 'err:Cannot find module', label);
            } finally { rmStore(one); }
        }
    } finally { rmStore(store); }
});

test('a glob: trigger fires at PostToolUse on a path the call touched, and not on a path outside it', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'merging-hook-edits-staleness.md', { triggers: 'glob:plugins/claude-kit/hooks/*.js' });
        const fired = runHook(store, postPayload(store, {
            tool_input: { file_path: path.join(store.cwd, 'plugins', 'claude-kit', 'hooks', 'x.js') }
        }));
        assertNames(assertNudge(fired, 'PostToolUse', 'glob fire'), 'merging-hook-edits-staleness.md',
            'glob:plugins/claude-kit/hooks/*.js', 'glob fire');
        const control = makeStore();
        try {
            writeRecord(control, 'merging-hook-edits-staleness.md', { triggers: 'glob:plugins/claude-kit/hooks/*.js' });
            assertSilent(runHook(control, postPayload(control, {
                tool_input: { file_path: path.join(control.cwd, 'plugins', 'claude-kit', 'scripts', 'x.js') }
            })), 'glob control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

// --- File anchors: matched on the path, with the sha ignored.

test('a file anchor fires at PostToolUse on its path, whatever sha it carries', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'anchored-record.md', { anchors: 'plugins/claude-kit/scripts/memq.js@' + SHA });
        const fired = runHook(store, postPayload(store, {
            tool_input: { file_path: path.join(store.cwd, 'plugins', 'claude-kit', 'scripts', 'memq.js') }
        }));
        const text = assertNudge(fired, 'PostToolUse', 'anchor fire');
        assertNames(text, 'anchored-record.md', 'anchor:plugins/claude-kit/scripts/memq.js', 'anchor fire');
        const control = makeStore();
        try {
            writeRecord(control, 'anchored-record.md', { anchors: 'plugins/claude-kit/scripts/memq.js@' + SHA });
            assertSilent(runHook(control, postPayload(control, {
                tool_input: { file_path: path.join(control.cwd, 'plugins', 'claude-kit', 'scripts', 'other.js') }
            })), 'anchor control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

// --- The boundary split: nothing is matched on both boundaries.

test('a cmd: trigger does not fire at PostToolUse and an err: trigger does not fire at PreToolUse', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'both-types.md', { triggers: 'cmd:node --test, err:Cannot find module' });
        assertSilent(runHook(store, postPayload(store, {
            tool_name: 'Bash',
            tool_input: { command: 'node --test "test/*.test.js"' },
            tool_response: { stdout: '', stderr: '', exit_code: 0 }
        })), 'cmd at the post boundary');
        const control = makeStore();
        try {
            writeRecord(control, 'both-types.md', { triggers: 'cmd:node --test, err:Cannot find module' });
            assertSilent(runHook(control, prePayload(control, {
                tool_name: 'Bash',
                tool_input: { command: 'echo Cannot find module' }
            })), 'err at the pre boundary');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

// --- Dedup and the per-turn cap.

test('a trigger nudges once per session: the second identical call is silent', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertNudge(runHook(store, payload), 'PreToolUse', 'first call');
        assertSilent(runHook(store, payload), 'second identical call');
    } finally { rmStore(store); }
});

test('a second session is nudged by the same trigger the first has already spent', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertNudge(runHook(store, payload), 'PreToolUse', 'first session');
        assertNudge(runHook(store, { ...payload, session_id: nextSession() }),
            'PreToolUse', 'second session');
    } finally { rmStore(store); }
});

test('the per-turn cap holds a call that would over-fire to NUDGE_CAP_PER_TURN records', () => {
    const store = makeStore();
    const names = ['over-fire-one.md', 'over-fire-two.md', 'over-fire-three.md', 'over-fire-four.md'];
    try {
        for (const n of names) writeRecord(store, n, { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        const text = assertNudge(runHook(store, payload), 'PreToolUse', 'over-firing call');
        const named = names.filter((n) => text.includes(n));
        assert.strictEqual(named.length, hook.NUDGE_CAP_PER_TURN,
            'the cap is ' + hook.NUDGE_CAP_PER_TURN + ' nudges, got ' + named.length + ': ' + text);
        assertSilent(runHook(store, payload), 'a further call inside the same window');
    } finally { rmStore(store); }
});

// One record with two triggers firing on one call spends the whole allowance
// naming itself twice while every other record starves.
test('one record contributes at most one nudge to an emission', () => {
    const store = makeStore();
    try {
        // The two-trigger record sorts FIRST, so a walk that let one record
        // spend both slots would starve the other one and this would see it.
        // Sorted the other way the cap is filled before the second trigger is
        // reached and the case passes whatever the rule is.
        writeRecord(store, 'aa-two-triggers.md', { triggers: 'cmd:node --test, tool:Bash' });
        writeRecord(store, 'zz-other-record.md', { triggers: 'cmd:node --test' });
        const text = assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'two triggers on one record');
        const clauses = text.split('aa-two-triggers.md carries').length - 1;
        assert.strictEqual(clauses, 1,
            'the record contributes one clause, not one per trigger it declares: ' + text);
        assert.ok(text.includes('zz-other-record.md'),
            'the second nudge goes to a different record: ' + text);
    } finally { rmStore(store); }
});

test('the cap counts the window, so a marker whose window has expired nudges again', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'over-fire-one.md', { triggers: 'cmd:node --test' });
        writeRecord(store, 'over-fire-two.md', { triggers: 'cmd:node --test' });
        writeRecord(store, 'over-fire-three.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertNudge(runHook(store, payload), 'PreToolUse', 'first window');
        assertSilent(runHook(store, payload), 'still inside the first window');
        const marker = markerPath(store);
        const state = JSON.parse(fs.readFileSync(marker, 'utf8'));
        state.windowStart = Date.now() - (hook.TURN_WINDOW_MS + 1000);
        fs.writeFileSync(marker, JSON.stringify(state), 'utf8');
        assertNudge(runHook(store, payload), 'PreToolUse', 'the next window');
    } finally { rmStore(store); }
});

// The cap and the dedup are state several copies of this hook write at once,
// because the harness issues tool calls in parallel, and the emission decision
// is taken inside memq's lockfile for that reason. This is the discriminating
// case for the lock: with the lock held from here, a copy of the hook must
// emit nothing, because the decision it would otherwise take is exactly the
// read-modify-write the lock is around. A racing batch cannot do this job on
// its own, since the critical section is short and two spawned copies are not
// reliably inside it at the same moment.
test('a copy that cannot take the marker lock emits nothing, and emits once it can', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        fs.mkdirSync(stateDir(store), { recursive: true });
        const held = memq.acquireLock(markerPath(store) + '.lock', { waitMs: 0, staleMs: 60000 });
        assert.strictEqual(held.ok, true, 'test setup: the fixture takes the lock first');
        try {
            assertSilent(runHook(store, payload), 'a copy that cannot take the lock');
        } finally {
            held.release();
        }
        assertNames(assertNudge(runHook(store, payload), 'PreToolUse', 'the lock released'),
            'test-suite-invocation.md', 'cmd:node --test', 'the lock released');
    } finally { rmStore(store); }
});

// Beside the deterministic case above, a real batch: several copies in flight
// at once must not crash, must not duplicate a record, and must not exceed the
// window cap. Whether any two of them meet inside the critical section is up
// to the machine, so this is a smoke check over the whole mechanism rather
// than the proof that the lock is there.
test('a batch of parallel copies neither duplicates a record nor exceeds the cap', async () => {
    const store = makeStore();
    const names = [];
    for (let i = 0; i < 8; i += 1) names.push('parallel-' + i + '.md');
    try {
        for (const n of names) writeRecord(store, n, { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        const results = await Promise.all(names.map(() => runHookAsync(store, payload)));
        let emitted = 0;
        const seen = new Set();
        for (const res of results) {
            assert.strictEqual(res.status, 0, 'every copy exits 0');
            assert.strictEqual(res.stderr, '', 'every copy keeps stderr empty');
            if (res.stdout === '') continue;
            const text = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
            for (const n of names) {
                if (!text.includes(n)) continue;
                emitted += 1;
                assert.ok(!seen.has(n), 'no record is nudged twice across the batch: ' + n);
                seen.add(n);
            }
        }
        assert.ok(emitted > 0, 'the batch nudges at least once, so the bound below is about a real emission');
        assert.ok(emitted <= hook.NUDGE_CAP_PER_TURN,
            'the window cap is ' + hook.NUDGE_CAP_PER_TURN + ', the batch emitted ' + emitted);
    } finally { rmStore(store); }
});

// --- The per-call work bound: the matcher is linear per pair, and this is
// what bounds their product.

test('one call spends at most MATCH_OPS_MAX trigger comparisons across the whole index', () => {
    const store = makeStore();
    try {
        // Enough filler triggers to exhaust the budget before the walk reaches
        // the record that would match, in sorted name order.
        const perRecord = 32;
        const fillers = Math.ceil((hook.MATCH_OPS_MAX + perRecord) / perRecord);
        for (let r = 0; r < fillers; r += 1) {
            const entries = [];
            for (let i = 0; i < perRecord; i += 1) entries.push('cmd:filler-' + r + '-' + i + ' pattern');
            writeRecord(store, 'aa-filler-' + String(r).padStart(4, '0') + '.md',
                { triggers: entries.join(', ') });
        }
        writeRecord(store, 'zz-would-match.md', { triggers: 'cmd:node --test' });
        assertSilent(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'the budget is exhausted before the matching trigger is reached');
        // The control: the same matching record with no filler ahead of it.
        const control = makeStore();
        try {
            writeRecord(control, 'zz-would-match.md', { triggers: 'cmd:node --test' });
            assertNudge(runHook(control, prePayload(control, {
                tool_input: { command: 'node --test "test/*.test.js"' }
            })), 'PreToolUse', 'control: the same record fires with no filler ahead of it');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

// --- Fail-open: every failure is silence, exit 0, nothing on either channel.

test('an absent memory directory is silence, not an error', () => {
    const store = makeStore();
    try {
        fs.rmSync(store.memDir, { recursive: true, force: true });
        assertSilent(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'absent memory directory');
    } finally { rmStore(store); }
});

test('an unreadable store root is silence, not an error', () => {
    const store = makeStore();
    try {
        // The memory directory's place is taken by a regular file, so every
        // listing of it fails the way an unreadable store does.
        fs.rmSync(store.memDir, { recursive: true, force: true });
        fs.writeFileSync(store.memDir, 'not a directory', 'utf8');
        assertSilent(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'unreadable store');
    } finally { rmStore(store); }
});

test('a malformed record costs itself and not the tier: its sibling still nudges', () => {
    const store = makeStore();
    try {
        // A frontmatter block that never closes is a record memq reads no
        // field of at all.
        fs.writeFileSync(path.join(store.memDir, 'unclosed-record.md'),
            '---\ntriggers: cmd:node --test\n\n# no closing fence\n', 'utf8');
        writeRecord(store, 'sound-record.md', { triggers: 'cmd:node --test' });
        const text = assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'malformed sibling');
        assert.ok(text.includes('sound-record.md'), 'the readable record still nudges: ' + text);
        assert.ok(!text.includes('unclosed-record.md'), 'the unreadable record contributes nothing');
    } finally { rmStore(store); }
});

test('a payload that does not parse is silence', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        assertSilent(runHook(store, '{ not json'), 'unparseable payload');
        assertSilent(runHook(store, '[]'), 'a payload that is not an object');
    } finally { rmStore(store); }
});

test('a payload with no session id is silence, because there is no marker to cap against', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        delete payload.session_id;
        assertSilent(runHook(store, payload), 'no session id');
    } finally { rmStore(store); }
});

test('a network-shaped working directory stands the hook down before the store is resolved', () => {
    const store = makeStore();
    const shares = ['\\\\unreachable-host\\share\\checkout', '//unreachable-host/share/checkout'];
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        // The store is stocked for the project segment each share-shaped path
        // resolves to, so the silence below can only be the stand-down: a hook
        // that resolved the directory would find a matching record there and
        // nudge. Without this the case would pass on an empty segment and say
        // nothing about the gate.
        for (const share of shares) {
            writeRecordIn(path.join(store.root, 'projects', memq.sanitizeProjectPath(share), 'memory'),
                'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        }
        for (const share of shares) {
            assertSilent(runHook(store, prePayload(store, {
                cwd: share,
                tool_input: { command: 'node --test "test/*.test.js"' }
            })), 'share-shaped working directory ' + share);
        }
    } finally { rmStore(store); }
});

// The positive control for the case above: the same network-shaped working
// directory, with a store pin in effect, reaches the store and nudges. Without
// it, the silence above is equally well explained by a project segment that
// holds no records, and the stand-down would be untested.
//
// The pin is a fixed short segment rather than one derived from the fixture's
// own temp path, and the fixture asserts memq accepts it: memq caps a store
// path segment at 40 characters and throws past it, which this hook's entry
// catch would turn into the same silence the case is trying to tell apart.
test('a pinned store still nudges under a network-shaped working directory', () => {
    const store = makeStore();
    // memq reads a pin only alongside the two store signals, so the self-check
    // sets the same three variables the child is given.
    const before = {
        KIT_MEMORY_PROJECT: process.env.KIT_MEMORY_PROJECT,
        KIT_MEMORY_ROOT: process.env.KIT_MEMORY_ROOT,
        KIT_MEMORY_ROOT_ALLOW_DATA: process.env.KIT_MEMORY_ROOT_ALLOW_DATA
    };
    try {
        process.env.KIT_MEMORY_PROJECT = PIN_SEGMENT;
        process.env.KIT_MEMORY_ROOT = store.root;
        process.env.KIT_MEMORY_ROOT_ALLOW_DATA = '1';
        assert.strictEqual(memq.pinnedProjectSegment(), PIN_SEGMENT,
            'test setup: the pin segment must be one memq accepts, whatever this machine\'s TEMP is');
    } finally {
        for (const [key, value] of Object.entries(before)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
    try {
        writeRecordIn(path.join(store.root, 'projects', PIN_SEGMENT, 'memory'),
            'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const res = runHook(store, prePayload(store, {
            cwd: '\\\\unreachable-host\\share\\checkout',
            tool_input: { command: 'node --test "test/*.test.js"' }
        }), { KIT_MEMORY_PROJECT: PIN_SEGMENT });
        assertNames(assertNudge(res, 'PreToolUse', 'pinned network cwd'),
            'test-suite-invocation.md', 'cmd:node --test', 'pinned network cwd');
    } finally { rmStore(store); }
});

// The store root is the second path this hook walks, and no pin takes its
// shape away: it is listed and every record in it stat'd on every call.
//
// The share-shaped root here names the fixture's own store, reached through a
// spelling the predicate reads as a share: the Win32 extended-length prefix,
// and the doubled leading slash off it. Both resolve to the same real local
// directory the control below uses, so the store behind the two runs is the
// same store holding the same record and the only difference is the shape of
// the path. A root that merely pointed at an unreachable host would be silent
// for the ordinary reason that nothing is there, and would say nothing about
// the gate.
test('a network-shaped store root stands the hook down', () => {
    const store = makeStore();
    const shareRoot = process.platform === 'win32' ? '\\\\?\\' + store.root : '/' + store.root;
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertSilent(runHook(store, payload, { KIT_MEMORY_ROOT: shareRoot }), 'share-shaped store root');
        assertNames(assertNudge(runHook(store, payload), 'PreToolUse', 'control: the same store, named plainly'),
            'test-suite-invocation.md', 'cmd:node --test', 'control: the same store, named plainly');
    } finally { rmStore(store); }
});

test('a subagent\'s call is silence, so it cannot spend the parent session\'s dedup budget', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        for (const key of ['agent_id', 'agent_type', 'agentType', 'subagent_type', 'subagentType']) {
            const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
            payload[key] = 'claude-kit:implementer';
            assertSilent(runHook(store, payload), 'a subagent payload carrying ' + key);
        }
    } finally { rmStore(store); }
});

test('the external-engine marker stands the hook down', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        assertSilent(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        }), { KIT_EXTERNAL_ENGINE: '1' }), 'external engine');
    } finally { rmStore(store); }
});

test('a payload from a boundary this hook is not wired on is silence', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        assertSilent(runHook(store, prePayload(store, {
            hook_event_name: 'SessionStart',
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'a SessionStart payload');
    } finally { rmStore(store); }
});

// memq notes an ignored KIT_MEMORY_ROOT on stderr once per process, and this
// hook runs at both boundaries of every tool call. Nothing loaded here may
// reach either channel: a note on stderr repeats on every call, and a byte on
// stdout turns the JSON answer into no answer at all.
test('an ignored store override reaches neither channel and costs no answer', () => {
    const store = makeStore();
    try {
        // Without its second signal the override is ignored and memq resolves
        // the store under the home directory, so the fixture puts one there
        // and points the child's home at it.
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-home-'));
        try {
            writeRecordIn(path.join(home, '.claude', 'projects',
                memq.sanitizeProjectPath(store.cwd), 'memory'),
            'test-suite-invocation.md', { triggers: 'cmd:node --test' });
            const env = {
                KIT_MEMORY_ROOT: store.root,
                KIT_MEMORY_ROOT_ALLOW_DATA: undefined,
                USERPROFILE: home,
                HOME: home
            };
            const res = spawnSync(process.execPath, [HOOK], {
                input: JSON.stringify(prePayload(store, {
                    tool_input: { command: 'node --test "test/*.test.js"' }
                })),
                env: (() => {
                    const built = childEnv(store, env);
                    delete built.KIT_MEMORY_ROOT_ALLOW_DATA;
                    return built;
                })(),
                encoding: 'utf8'
            });
            assertNames(assertNudge(res, 'PreToolUse', 'ignored override'),
                'test-suite-invocation.md', 'cmd:node --test', 'ignored override');
        } finally {
            try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ }
        }
    } finally { rmStore(store); }
});

// --- The state directory, its screens, and its writes.

test('the state directory is created under the temp directory and holds both files', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'first call');
        const dir = stateDir(store);
        assert.ok(fs.lstatSync(dir).isDirectory(), 'the state directory is a directory');
        assert.ok(fs.existsSync(cachePath(store)), 'the index cache lands there');
        assert.ok(fs.existsSync(markerPath(store)), 'the session marker lands there');
        const names = fs.readdirSync(dir).filter((n) => n.includes('.tmp.'));
        assert.deepStrictEqual(names, [], 'no temporary file is left behind');
    } finally { rmStore(store); }
});

test('a foreign object at the state directory name stands the hook down', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        fs.writeFileSync(stateDir(store), 'not a directory', 'utf8');
        assertSilent(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'a file standing where the state directory belongs');
    } finally { rmStore(store); }
});

// The screen itself, asked of the resolver directly. The spawned case above
// pins the behaviour, which more than one mechanism produces; this pins the
// kind check that refuses a name something else is standing at, which is what
// keeps this hook from writing its state through whatever a fixed name in a
// shared temp directory has been pointed at.
test('the state directory resolver refuses a name something else stands at', () => {
    const planted = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-planted-'));
    const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-clean-'));
    const before = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
    try {
        fs.writeFileSync(path.join(planted, 'claude-kit-recognition'), 'not a directory', 'utf8');
        process.env.TMPDIR = planted;
        process.env.TEMP = planted;
        process.env.TMP = planted;
        assert.strictEqual(hook.stateDir(), null, 'a file at the name is refused');
        process.env.TMPDIR = clean;
        process.env.TEMP = clean;
        process.env.TMP = clean;
        assert.strictEqual(hook.stateDir(), path.join(clean, 'claude-kit-recognition'),
            'control: a clean temp directory answers with the state directory');
    } finally {
        for (const [key, value] of Object.entries(before)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        for (const dir of [planted, clean]) {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
        }
    }
});

// The write discipline, observed rather than argued: with an exclusive create
// at an unpredictable name and a rename over the target, a foreign object at
// the cache's own path costs the cache and nothing else. A plain write at the
// fixed name follows what is there, or throws on what it cannot follow, and
// takes the answer with it.
test('a foreign object at the cache path costs the cache and not the nudge', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        fs.mkdirSync(stateDir(store), { recursive: true });
        fs.mkdirSync(cachePath(store), { recursive: true });
        assertNames(assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'blocked cache'), 'test-suite-invocation.md', 'cmd:node --test', 'blocked cache');
        assert.ok(fs.lstatSync(cachePath(store)).isDirectory(),
            'the planted object is left alone rather than written through');
    } finally { rmStore(store); }
});

test('state older than its time to live is swept', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const dir = stateDir(store);
        fs.mkdirSync(dir, { recursive: true });
        const stale = path.join(dir, 'session-ancient.json');
        fs.writeFileSync(stale, '{}', 'utf8');
        const old = Date.now() - (30 * 24 * 60 * 60 * 1000);
        fs.utimesSync(stale, old / 1000, old / 1000);
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'a call that sweeps');
        assert.ok(!fs.existsSync(stale), 'the stale marker is gone');
        assert.ok(fs.existsSync(markerPath(store)), 'this session\'s own marker is kept');
    } finally { rmStore(store); }
});

// --- The index cache.

test('the index cache is written once and rebuilt when a record changes', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'first call builds the index');
        const first = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        assert.strictEqual(first.records.length, 1, 'the index holds the one record');

        // The record's triggers change, which never moves the directory's own
        // mtime: a stamp read off the directory alone would serve the stale
        // index here.
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:pwsh -NoProfile -File build.ps1' });
        assertNudge(runHook(store, {
            ...prePayload(store, { tool_input: { command: 'pwsh -NoProfile -File build.ps1' } }),
            session_id: nextSession()
        }), 'PreToolUse', 'the rebuilt index carries the new trigger');
        const second = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        assert.notStrictEqual(second.stamp, first.stamp, 'the stamp moves when a record changes');
        assert.strictEqual(second.records[0].triggers[0].pattern, 'pwsh -NoProfile -File build.ps1',
            'the rebuilt index carries the record as it now reads');
    } finally { rmStore(store); }
});

test('a cache naming a record the store does not hold never reaches a session', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertNudge(runHook(store, payload), 'PreToolUse', 'the index is built');
        const state = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        state.records.unshift({
            name: 'planted-record.md',
            triggers: [{ type: 'cmd', pattern: 'node --test' }],
            anchors: []
        });
        fs.writeFileSync(cachePath(store), JSON.stringify(state), 'utf8');
        const text = assertNudge(runHook(store, { ...payload, session_id: nextSession() }),
            'PreToolUse', 'the planted name is not emitted');
        assert.ok(!text.includes('planted-record.md'),
            'a record name the store does not hold never reaches a session: ' + text);
        assert.ok(text.includes('test-suite-invocation.md'), 'the real record still nudges: ' + text);
    } finally { rmStore(store); }
});

// The other half of the same rule: the trigger text on the line is the
// store's, not the cache's, so a stamp-matching cache cannot attribute a
// pattern to a real record.
test('a cache carrying a trigger the record does not declare never reaches a session', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertNudge(runHook(store, payload), 'PreToolUse', 'the index is built');
        const state = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        state.records[0].triggers = [{ type: 'cmd', pattern: 'node --test invented-by-the-cache' }];
        fs.writeFileSync(cachePath(store), JSON.stringify(state), 'utf8');
        assertSilent(runHook(store, {
            ...payload,
            session_id: nextSession(),
            tool_input: { command: 'node --test invented-by-the-cache' }
        }), 'the invented trigger is refused at the store');
    } finally { rmStore(store); }
});

test('a cache carrying an entry outside memq\'s grammar is rebuilt rather than trusted', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertNudge(runHook(store, payload), 'PreToolUse', 'the index is built');
        const state = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        state.records[0].triggers.push({ type: 'cmd', pattern: 'git' });
        fs.writeFileSync(cachePath(store), JSON.stringify(state), 'utf8');
        assertNudge(runHook(store, { ...payload, session_id: nextSession() }), 'PreToolUse',
            'the rebuilt index still carries the record');
        const rebuilt = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        assert.strictEqual(rebuilt.records[0].triggers.length, 1,
            'the entry outside the grammar is gone, because the cache was rebuilt from the store');
    } finally { rmStore(store); }
});

test('a cache carrying more triggers than a record may declare is rebuilt rather than trusted', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        assertNudge(runHook(store, payload), 'PreToolUse', 'the index is built');
        const state = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        const many = [];
        for (let i = 0; i <= memq.TRIGGER_ENTRIES_MAX; i += 1) {
            many.push({ type: 'cmd', pattern: 'padding-' + i + ' pattern' });
        }
        state.records[0].triggers = many;
        fs.writeFileSync(cachePath(store), JSON.stringify(state), 'utf8');
        assertNudge(runHook(store, { ...payload, session_id: nextSession() }), 'PreToolUse',
            'the rebuilt index still carries the record');
        const rebuilt = JSON.parse(fs.readFileSync(cachePath(store), 'utf8'));
        assert.ok(rebuilt.records[0].triggers.length <= memq.TRIGGER_ENTRIES_MAX,
            'the record count is back inside the store\'s own bound');
    } finally { rmStore(store); }
});

// The reader's ceiling and the index's own bound are one figure. Two would
// let a tier produce a cache that reads as bounded on every call, rebuilds on
// every call, and writes itself again on every call, forever.
test('the index is built against the same ceiling the cache is read at', () => {
    assert.strictEqual(hook.INDEX_SERIALIZED_CAP, hook.CACHE_READ_CAP,
        'the build bound and the read bound are one figure');
});

// --- A planted marker cannot take the cap off.

test('a marker carrying a non-finite count is read as spent, not as unlimited', () => {
    const store = makeStore();
    const names = ['inf-one.md', 'inf-two.md', 'inf-three.md', 'inf-four.md'];
    try {
        for (const n of names) writeRecord(store, n, { triggers: 'cmd:node --test' });
        fs.mkdirSync(stateDir(store), { recursive: true });
        // JSON admits -Infinity as -1e999, which typeof reports as a number.
        fs.writeFileSync(markerPath(store),
            '{"fired":{},"windowStart":' + Date.now() + ',"windowCount":-1e999}', 'utf8');
        const text = assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'planted marker');
        const named = names.filter((n) => text.includes(n));
        assert.strictEqual(named.length, hook.NUDGE_CAP_PER_TURN,
            'the cap still binds, got ' + named.length + ': ' + text);
    } finally { rmStore(store); }
});

// --- The glob matcher itself, and the bound the standing amendment requires.

test('the glob matcher answers the shapes a path glob is written in', () => {
    const cases = [
        ['plugins/claude-kit/hooks/*.js', 'D:/repo/plugins/claude-kit/hooks/x.js', true],
        ['plugins/claude-kit/hooks/*.js', 'D:/repo/plugins/claude-kit/hooks/x.md', false],
        ['plugins/claude-kit/hooks/*.js', 'D:\\repo\\plugins\\claude-kit\\hooks\\x.js', true],
        ['plugins/claude-kit/hooks/*', 'D:/repo/plugins/claude-kit/hooks/sub/x.js', false],
        ['plugins/**/x.js', 'D:/repo/plugins/claude-kit/hooks/x.js', true],
        ['docs/plans/*_spec_v?.md', 'D:/repo/docs/plans/a_spec_v1.md', true],
        ['docs/plans/*_spec_v?.md', 'D:/repo/docs/plans/a_spec_v11.md', false],
        ['docs/plans/*.md', 'D:/repo/other/docs/plans/a.md', true],
        ['docs/plans/*.md', 'D:/repo/docs/plans/a.md/deeper.txt', false]
    ];
    for (const [pattern, target, expected] of cases) {
        assert.strictEqual(hook.globMatchesPath(pattern, target), expected,
            pattern + ' against ' + target);
    }
});

// A wildcard in the pattern is answered before a literal comparison, or a
// star standing in the text is consumed as the pattern's own star.
test('a wildcard matches a subject that carries a wildcard character of its own', () => {
    assert.strictEqual(hook.matchWithin('*', '*x'), true);
    assert.strictEqual(hook.matchWithin('*x', '*x'), true);
    assert.strictEqual(hook.matchWithin('a*', 'a*b'), true);
    assert.strictEqual(hook.matchWithin('?', '*'), true);
    assert.strictEqual(hook.matchSegments(['**'], ['*', 'x']), true);
    assert.strictEqual(hook.globMatchesPath('docs/*', 'D:/repo/docs/*weird*.md'), true);
});

test('an anchor path matches on a segment boundary and never mid-segment', () => {
    assert.strictEqual(hook.anchorMatchesPath('hooks/memq.js', 'D:/repo/hooks/memq.js'), true);
    assert.strictEqual(hook.anchorMatchesPath('hooks/memq.js', 'D:/repo/other-hooks/memq.js'), false);
    assert.strictEqual(hook.anchorMatchesPath('hooks/memq.js', 'D:/repo/hooks/memq.js.bak'), false);
});

test('a pathological glob pattern is answered inside a wall-clock bound (the linear matcher)', () => {
    // The grammar admits unbounded '*' inside a 256-character pattern, so this
    // is a value a record may legally carry. Compiled to a regular expression
    // this input backtracks catastrophically; the two-pointer walk answers in
    // the product of the two lengths.
    const pattern = 'a*'.repeat(60) + 'b';
    assert.ok(memq.isTriggerEntry('glob:' + pattern),
        'the pathological pattern is one the store admits, so the bound is a real requirement');
    const target = 'D:/repo/' + 'a'.repeat(400);
    const started = Date.now();
    let answer = true;
    for (let i = 0; i < 200; i += 1) answer = hook.globMatchesPath(pattern, target);
    const elapsed = Date.now() - started;
    assert.strictEqual(answer, false, 'the pattern does not match');
    assert.ok(elapsed < 2000, '200 matches of the pathological pattern took ' + elapsed + 'ms');
});

test('a record carrying the pathological glob does not stall the hook', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'pathological-glob.md', { triggers: 'glob:' + 'a*'.repeat(60) + 'b' });
        const started = Date.now();
        const res = runHook(store, postPayload(store, {
            tool_input: { file_path: 'D:/repo/' + 'a'.repeat(400) }
        }));
        const elapsed = Date.now() - started;
        assertSilent(res, 'the pathological pattern matches nothing here');
        assert.ok(elapsed < 15000, 'the hook returned in ' + elapsed + 'ms');
    } finally { rmStore(store); }
});

// --- Subject reading, in-process where the shapes are the subject.

test('a long failure stream is matched as its head and its tail, and the seam spells nothing', () => {
    // Built so the head ENDS with 'seam' and the tail STARTS with 'token':
    // joined without a separator the two ends spell 'seamtoken', a token
    // neither end carries, and the trigger would fire on a stream that never
    // said it. The head is the first half of the cap and the tail the last
    // half, so the two markers sit exactly at the seam. The pattern is one
    // memq admits: a bare common token would be refused at the store and both
    // legs of this case would go silent for that reason instead.
    const half = 32768;
    const head = 'x'.repeat(half - 4) + 'seam';
    const tail = 'token' + 'x'.repeat(half - 5);
    const payload = { is_error: true, tool_response: { error: head + 'y'.repeat(50000) + tail } };
    const store = makeStore();
    try {
        assert.ok(memq.isTriggerEntry('err:seamtoken'),
            'test setup: the seam pattern must be one the store admits');
        writeRecord(store, 'seam-record.md', { triggers: 'err:seamtoken' });
        assertSilent(runHook(store, postPayload(store, {
            tool_name: 'Bash',
            tool_input: { command: 'x' },
            ...payload
        })), 'the head and tail seam does not spell a match');
        // The control: the same token spelled for real inside the head is
        // matched, so the silence above is the seam and not a stream this
        // hook simply never read.
        const control = makeStore();
        try {
            writeRecord(control, 'seam-record.md', { triggers: 'err:seamtoken' });
            assertNames(assertNudge(runHook(control, postPayload(control, {
                tool_name: 'Bash',
                tool_input: { command: 'x' },
                is_error: true,
                tool_response: { error: 'seamtoken' + head + 'y'.repeat(50000) + tail }
            })), 'PostToolUse', 'seam control'), 'seam-record.md', 'err:seamtoken', 'seam control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

// The failure predicate itself is pinned branch by branch in
// test/kit-tool-payload-lib.test.js, on the module that defines it: this hook
// and hooks/kit-sidecar-capture.js both read that one answer, and a pin taken
// through either of them would keep passing on a re-export that had stopped
// delegating. What is this file's own is the gate above failureOutput.
test('a call that did not fail has no failure output at all', () => {
    assert.strictEqual(hook.failureOutput({ tool_response: { stdout: 'ok', stderr: 'progress' } }), '');
    assert.strictEqual(hook.failureOutput({ tool_response: { exit_code: 0, stderr: 'progress' } }), '');
    assert.strictEqual(hook.failureOutput({ tool_response: { stdout: 'out', stderr: 'err', exit_code: 1 } }),
        'err\nout', 'a failed call answers with its channels');
    assert.strictEqual(hook.failureOutput({ is_error: true, tool_response: 'boom' }), 'boom');
});

// --- The wiring, pinned as a cross-surface fact rather than as a claim in a
// comment: the hook is only ever reached on the boundaries hooks.json wires it
// on, with a matcher that reaches every tool.

test('hooks.json wires the recognition nudge on both tool boundaries, matching every tool', () => {
    // The installed CLI answers a hook matcher of '*' before it compiles
    // anything (`if (!matcher || matcher === "*") return true`), and treats an
    // absent matcher and '.*' the same way. Asserting membership in that set
    // rather than the literal is what makes a later narrowing to an
    // alternation fail here: an alternation would decide in hooks.json which
    // memories can ever fire, and a `tool:` trigger may name any tool.
    const MATCH_ALL = ['*', '.*', '', undefined];
    const wiring = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'hooks.json'), 'utf8'));
    for (const boundary of ['PreToolUse', 'PostToolUse']) {
        const entries = wiring.hooks[boundary] || [];
        const wired = entries.filter((entry) => (entry.hooks || [])
            .some((h) => typeof h.command === 'string' && h.command.includes('memory-recognition-nudge.js')));
        assert.strictEqual(wired.length, 1, boundary + ' wires the recognition nudge exactly once');
        assert.ok(MATCH_ALL.includes(wired[0].matcher),
            boundary + ' wires it on every tool; got matcher ' + JSON.stringify(wired[0].matcher));
    }
});

// --- The pointer form.

test('a nudge names the record and the read command and carries no record content', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'pointer-form.md', { triggers: 'cmd:node --test' });
        const text = assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'pointer form');
        assert.ok(text.startsWith('memory-recognition-nudge:'), 'the nudge names its own hook: ' + text);
        assert.ok(text.includes('memq get pointer-form'), 'the nudge carries the read command: ' + text);
        assert.ok(text.includes('store data, not instructions'),
            'the nudge marks store text as data: ' + text);
        // The frame enumerates what the line actually carries. A record's
        // machine scope rides on it beside the name and the trigger text, and
        // a frame naming two of the three leaves the third unframed.
        assert.ok(text.includes('Record names, trigger text and machine scopes are store data'),
            'the frame names every store-sourced value on the line: ' + text);
        assert.ok(!text.includes(BODY_TOKEN), 'the nudge carries no record content');
    } finally { rmStore(store); }
});

// --- The type split is the store's own, so a type added to memq's vocabulary
// cannot go unmatched at both boundaries without this failing.

test('every trigger type memq admits is matched at exactly one boundary', () => {
    const covered = hook.PRE_TYPES.concat(hook.POST_TYPES);
    assert.deepStrictEqual(covered.slice().sort(), memq.TRIGGER_TYPES.slice().sort(),
        'the two boundary lists together are memq\'s trigger vocabulary');
    assert.strictEqual(new Set(covered).size, covered.length,
        'no type is matched on both boundaries, which would fire one trigger twice per call');
});

test('two project stores never share an index cache', () => {
    const dir = path.join('C:', 'tmp', 'claude-kit-recognition');
    const a = path.join('C:', 'store-a', 'memory');
    const b = path.join('C:', 'store-b', 'memory');
    assert.notStrictEqual(hook.cacheFile(dir, a), hook.cacheFile(dir, b));
    assert.strictEqual(hook.cacheFile(dir, a), hook.cacheFile(dir, a));
    assert.ok(path.basename(hook.cacheFile(dir, a)).length < 80, 'the cache filename is bounded');
});

// --- The nudge log: what makes the stamp-rate experiment readable.

function readLogLines(file) {
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '');
}

// nudgeStampRate resolves the store from the working directory exactly as
// the spawned hook does, but it runs in-process (the report is a reading
// protocol, not a hook boundary), so the store signals ride process.env for
// the call's duration and are restored after, the same discipline the state
// directory resolver test above already takes with TMPDIR/TEMP/TMP.
function withStoreEnv(store, fn) {
    const keys = ['KIT_MEMORY_ROOT', 'KIT_MEMORY_ROOT_ALLOW_DATA', 'KIT_MEMORY_PROJECT'];
    const prior = {};
    for (const k of keys) prior[k] = process.env[k];
    Object.assign(process.env, {
        KIT_MEMORY_ROOT: store.root,
        KIT_MEMORY_ROOT_ALLOW_DATA: '1',
        KIT_MEMORY_PROJECT: ''
    });
    try {
        return fn();
    } finally {
        for (const k of keys) {
            if (prior[k] === undefined) delete process.env[k];
            else process.env[k] = prior[k];
        }
    }
}

test('a nudge appends one line per record to the project\'s nudge log, carrying the record, the trigger and the moment', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        const before = Date.now();
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'a call that nudges');
        const logFile = hook.nudgeLogPath(store.cwd);
        const lines = readLogLines(logFile);
        assert.strictEqual(lines.length, 1, 'one nudge appends exactly one line');
        const entry = JSON.parse(lines[0]);
        // `tier` rides beside the record's name because the name alone is
        // unique inside a tier and not across them, and the stamp-rate report
        // that reads this log joins against one tier's applied stamps.
        assert.deepStrictEqual(Object.keys(entry).sort(),
            ['name', 'pattern', 'tier', 'ts', 'type']);
        assert.strictEqual(entry.name, 'test-suite-invocation.md');
        assert.strictEqual(entry.tier, 'project');
        assert.strictEqual(entry.type, 'cmd');
        assert.strictEqual(entry.pattern, 'node --test');
        const ms = Date.parse(entry.ts);
        assert.ok(Number.isFinite(ms) && ms >= before - 1000 && ms <= Date.now() + 1000,
            'ts is the moment the nudge fired');
    } finally { rmStore(store); }
});

test('a claimed emission of two hits appends two log lines, one per record', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'first-of-two.md', { triggers: 'cmd:node --test' });
        writeRecord(store, 'second-of-two.md', { triggers: 'cmd:--test' });
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'a call two records match');
        const lines = readLogLines(hook.nudgeLogPath(store.cwd)).map((l) => JSON.parse(l));
        assert.strictEqual(lines.length, 2, 'both claimed hits are logged');
        assert.deepStrictEqual(lines.map((l) => l.name).sort(), ['first-of-two.md', 'second-of-two.md']);
    } finally { rmStore(store); }
});

test('a call that does not nudge appends nothing to the log', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'test-suite-invocation.md', { triggers: 'cmd:node --test' });
        assertSilent(runHook(store, prePayload(store, {
            tool_input: { command: 'echo nothing-in-particular' }
        })), 'a call nothing matches');
        assert.ok(!fs.existsSync(hook.nudgeLogPath(store.cwd)), 'no nudge fired, so no log file exists');
    } finally { rmStore(store); }
});

test('the nudge log rotates only past 1 MB, and a rotation replaces the prior .old', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'rot-record.md', { triggers: 'cmd:node --test' });
        const logFile = hook.nudgeLogPath(store.cwd);
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        const MB = 1024 * 1024;
        // Exactly 1 MB is not "past 1 MB": the append lands in place, keeping
        // the boundary off the rotation side, the same convention
        // emitGoalEvent's own event stream takes.
        const filler = 'a'.repeat(MB - 1) + '\n';
        fs.writeFileSync(logFile, filler, 'utf8');
        assert.strictEqual(fs.statSync(logFile).size, MB, 'setup: the sink sits exactly on the threshold');
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'a nudge at the threshold');
        assert.ok(!fs.existsSync(logFile + '.old'), 'a sink of exactly 1 MB is not rotated');
        const grown = fs.readFileSync(logFile, 'utf8');
        assert.ok(grown.startsWith(filler), 'the existing content is kept');
        assert.strictEqual(readLogLines(logFile).length, 2, 'the new nudge is appended below the existing content');

        // The sink now exceeds 1 MB, so the next nudge rotates it away and
        // starts a fresh file.
        writeRecord(store, 'rot-record-2.md', { triggers: 'cmd:pwsh -NoProfile' });
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'pwsh -NoProfile -File build.ps1' }
        })), 'PreToolUse', 'a nudge past the threshold');
        assert.ok(fs.existsSync(logFile + '.old'), 'a sink past 1 MB is rotated');
        assert.strictEqual(fs.readFileSync(logFile + '.old', 'utf8'), grown, 'the rotated file holds the prior stream');
        const fresh = readLogLines(logFile).map((l) => JSON.parse(l));
        assert.strictEqual(fresh.length, 1, 'the fresh sink holds only the newest nudge');
        assert.strictEqual(fresh[0].name, 'rot-record-2.md');
    } finally { rmStore(store); }
});

test('a second rotation replaces the prior .old rather than failing on an occupied destination', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'rot-a.md', { triggers: 'cmd:node --test' });
        const logFile = hook.nudgeLogPath(store.cwd);
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        const MB = 1024 * 1024;
        fs.writeFileSync(logFile, 'b'.repeat(MB + 1), 'utf8');
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'a nudge that rotates an already-oversized sink');
        assert.strictEqual(fs.readFileSync(logFile + '.old', 'utf8'), 'b'.repeat(MB + 1),
            'the prior .old is replaced, not left in place');
        const fresh = readLogLines(logFile).map((l) => JSON.parse(l));
        assert.strictEqual(fresh.length, 1);
        assert.strictEqual(fresh[0].name, 'rot-a.md');
    } finally { rmStore(store); }
});

test('an absent nudge log reads as no nudges yet, not as an error', () => {
    const store = makeStore();
    try {
        // Carries a trigger so it is nudgeable (report.unnudged is restricted to
        // records the index would ever nudge; a bare record with no declared
        // trigger or anchor could never earn a nudge and is not a fair control).
        writeRecord(store, 'lonely.md', { triggers: 'cmd:node --test' });
        assert.ok(!fs.existsSync(hook.nudgeLogPath(store.cwd)), 'setup: no log file exists');
        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, Date.now() - 60000));
        assert.strictEqual(report.error, undefined, 'an absent log is not a report error: ' + JSON.stringify(report));
        assert.strictEqual(report.nudged.total, 0, 'nothing has been nudged yet');
        assert.strictEqual(report.nudged.stamped, 0);
        assert.strictEqual(report.nudged.rate, null, 'a rate over zero records is null rather than NaN');
        assert.strictEqual(report.unnudged.total, 1, 'the one live record is unnudged by default');
    } finally { rmStore(store); }
});

test('nudgeStampRate joins the nudge log against the applied stamps: a nudged-and-stamped, a '
    + 'nudged-unstamped, and an unnudged-stamped record each read as what they prove', () => {
    const store = makeStore();
    try {
        // Three live records, each carrying a trigger so each is nudgeable (the
        // restriction unnudged.total honors), each proving a different cell of
        // the join.
        writeRecord(store, 'nudged-stamped.md', { triggers: 'cmd:node --test' }); // proves: nudged AND stamped counts toward nudged.stamped
        writeRecord(store, 'nudged-unstamped.md', { triggers: 'cmd:pwsh -NoProfile' }); // proves: nudged but unstamped counts toward nudged.total alone
        writeRecord(store, 'unnudged-stamped.md', { triggers: 'cmd:git status' }); // proves: a stamp on a record the log never named still
        // reaches unnudged.stamped, so the join reads applied evidence
        // independent of whether this hook ever nudged that record.

        const since = Date.now() - 60 * 60 * 1000;
        const insideWindow = new Date(since + 60000).toISOString();
        const logFile = hook.nudgeLogPath(store.cwd);
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.writeFileSync(logFile, [
            JSON.stringify({ ts: insideWindow, name: 'nudged-stamped.md', type: 'cmd', pattern: 'node --test' }),
            JSON.stringify({ ts: insideWindow, name: 'nudged-unstamped.md', type: 'cmd', pattern: 'node --test' })
        ].join('\n') + '\n', 'utf8');
        fs.writeFileSync(path.join(store.memDir, memq.USAGE_FILE), [
            JSON.stringify({ kind: 'applied', file: 'nudged-stamped.md', ts: insideWindow }),
            JSON.stringify({ kind: 'applied', file: 'unnudged-stamped.md', ts: insideWindow })
        ].join('\n') + '\n', 'utf8');

        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, since));
        assert.strictEqual(report.error, undefined, 'the report resolves cleanly: ' + JSON.stringify(report));
        assert.strictEqual(report.nudged.total, 2, 'two records were named in the log within the window');
        assert.strictEqual(report.nudged.stamped, 1,
            'only nudged-stamped.md carries an applied stamp; nudged-unstamped.md does not');
        assert.strictEqual(report.nudged.rate, 0.5);
        assert.strictEqual(report.unnudged.total, 1, 'unnudged-stamped.md is the only record the log never names');
        assert.strictEqual(report.unnudged.stamped, 1,
            'its applied stamp still counts, proving the join reads stamps independent of nudging');
        assert.strictEqual(report.unnudged.rate, 1);
    } finally { rmStore(store); }
});

// --- The fix round: worktree/pin siting, a stale memq, an unreadable usage
// sidecar, the log-append's atomicity with the marker claim, the anchor cap
// branch, and the PostToolUse boundary.

// Whether a real git binary is on PATH. This is the acceptance case for the
// worktree split: two `git worktree add` checkouts of one repository, so the
// fixture is git's own wiring rather than this suite's reading of it.
const GIT_ON_PATH = (() => {
    try { return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0; } catch { return false; }
})();

function git(args, cwd) {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

test('the nudge log and its stamp-rate report resolve to the main checkout root, so every '
    + 'worktree of one repository shares one log rather than splitting it per checkout', {
    skip: GIT_ON_PATH ? false : 'git is not on PATH'
}, () => {
    const store = makeStore();
    const main = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-wt-main-'));
    const treeParent = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-wt-parent-'));
    const tree = path.join(treeParent, 'wt');
    try {
        assert.strictEqual(git(['init', '-q'], main).status, 0, 'setup: git init');
        fs.writeFileSync(path.join(main, 'seed.txt'), 'seed');
        assert.strictEqual(git(['add', '.'], main).status, 0, 'setup: git add');
        const committed = git(['-c', 'user.email=kit@test.invalid', '-c', 'user.name=kit',
            'commit', '-q', '-m', 'seed'], main);
        assert.strictEqual(committed.status, 0, 'setup: git commit: ' + committed.stderr);
        const added = git(['worktree', 'add', '--detach', '-q', tree], main);
        assert.strictEqual(added.status, 0, 'setup: git worktree add: ' + added.stderr);

        // memq's own projectMemoryDir folds a linked worktree to its main
        // checkout's root exactly as nudgeProjectRoot does (both bottom out in
        // memq's worktreeMainRoot), so the record lives at the segment both
        // cwd=main and cwd=tree resolve to.
        const mainMemDir = path.join(store.root, 'projects', memq.sanitizeProjectPath(main), 'memory');
        writeRecordIn(mainMemDir, 'wt-record.md', { triggers: 'cmd:node --test' });

        const fromMain = { ...store, cwd: main, session: nextSession() };
        assertNudge(runHook(fromMain, prePayload(fromMain, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'a call from the main checkout');

        const fromTree = { ...store, cwd: tree, session: nextSession() };
        assertNudge(runHook(fromTree, prePayload(fromTree, {
            tool_input: { command: 'node --test "test/*.test.js"' }
        })), 'PreToolUse', 'a call from the linked worktree');

        const mainLog = hook.nudgeLogPath(hook.nudgeProjectRoot(memq, main));
        const treeLog = hook.nudgeLogPath(hook.nudgeProjectRoot(memq, tree));
        assert.strictEqual(mainLog, treeLog,
            'the main checkout and its linked worktree resolve to the same nudge log path');
        assert.strictEqual(readLogLines(mainLog).length, 2,
            'both calls appended to the one shared log rather than one apiece under separate .kit/ trees');
        assert.ok(!fs.existsSync(path.join(tree, '.kit', 'memory-recognition-nudges.jsonl')),
            'no second log was ever created under the worktree\'s own .kit/');
    } finally {
        rmStore(store);
        try { fs.rmSync(main, { recursive: true, force: true }); } catch { /* best effort */ }
        try { fs.rmSync(treeParent, { recursive: true, force: true }); } catch { /* best effort */ }
    }
});

test('nudgeStampRate refuses rather than silently succeeds against a memq missing a symbol '
    + 'this report needs', () => {
    const store = makeStore();
    const memqPath = require.resolve('../plugins/claude-kit/scripts/memq.js');
    const real = require(memqPath);
    try {
        writeRecord(store, 'skewed.md', { triggers: 'cmd:node --test' });
        const skewed = { ...real };
        delete skewed.appliedTally;
        require.cache[memqPath].exports = skewed;
        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, Date.now() - 60000));
        assert.strictEqual(typeof report.error, 'string',
            'a memq missing a required symbol is refused, not silently trusted: ' + JSON.stringify(report));
    } finally {
        require.cache[memqPath].exports = real;
        rmStore(store);
    }
});

test('an unreadable usage sidecar refuses the report rather than reading as zero stamps, and a '
    + 'malformed line among valid ones is skipped rather than trusted or thrown on', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'malformed-usage.md', { triggers: 'cmd:node --test' });
        const since = Date.now() - 60 * 60 * 1000;
        const insideWindow = new Date(since + 60000).toISOString();

        // A malformed line (unparseable JSON) beside one well-formed, valid
        // stamp: the read must skip the first without throwing and without
        // letting it contribute evidence, while still counting the second.
        fs.writeFileSync(path.join(store.memDir, memq.USAGE_FILE), [
            '{not valid json',
            JSON.stringify({ kind: 'applied', file: 'malformed-usage.md', ts: insideWindow })
        ].join('\n') + '\n', 'utf8');
        const okReport = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, since));
        assert.strictEqual(okReport.error, undefined,
            'a malformed line beside a valid one does not refuse the whole report: ' + JSON.stringify(okReport));
        assert.strictEqual(okReport.unnudged.total, 1);
        assert.strictEqual(okReport.unnudged.stamped, 1, 'the one well-formed stamp still counts');

        // A directory sitting at the sidecar's own path: existing (so this is
        // not the ordinary "never written" absence) but unreadable as a file.
        // The old collapse of ENOENT and every other error into one empty
        // list would report this identically to "nothing has ever been
        // applied"; the fix must tell them apart.
        fs.rmSync(path.join(store.memDir, memq.USAGE_FILE), { force: true });
        fs.mkdirSync(path.join(store.memDir, memq.USAGE_FILE));
        const badReport = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, since));
        assert.strictEqual(typeof badReport.error, 'string',
            'an unreadable (as opposed to absent) sidecar refuses rather than reporting a false zero: '
                + JSON.stringify(badReport));
    } finally { rmStore(store); }
});

test('a concurrent batch that forces a rotation loses no claimed nudge, and every surviving '
    + 'line still parses, because the log append shares the marker\'s own lock', async () => {
    const store = makeStore();
    const names = [];
    for (let i = 0; i < 6; i += 1) names.push('lock-batch-' + i + '.md');
    try {
        for (const n of names) writeRecord(store, n, { triggers: 'cmd:node --test' });
        const logFile = hook.nudgeLogPath(store.cwd);
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        // Seeded one byte under the rotation threshold, so whichever call in
        // the batch appends first is the one that crosses it and triggers a
        // rotation while the rest of the batch is still in flight.
        fs.writeFileSync(logFile, 'a'.repeat(hook.NUDGE_LOG_MAX_BYTES - 1) + '\n', 'utf8');
        const payload = prePayload(store, { tool_input: { command: 'node --test "test/*.test.js"' } });
        const results = await Promise.all(names.map(() => runHookAsync(store, payload)));
        let emitted = 0;
        const seen = new Set();
        for (const res of results) {
            assert.strictEqual(res.status, 0, 'every copy exits 0');
            assert.strictEqual(res.stderr, '', 'every copy keeps stderr empty');
            if (res.stdout === '') continue;
            const text = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
            for (const n of names) {
                if (!text.includes(n)) continue;
                emitted += 1;
                assert.ok(!seen.has(n), 'no record is nudged twice across the batch: ' + n);
                seen.add(n);
            }
        }
        assert.ok(emitted > 0, 'the batch nudges at least once, so the check below is about a real emission');

        const liveLines = fs.existsSync(logFile) ? readLogLines(logFile) : [];
        const oldLines = fs.existsSync(logFile + '.old') ? readLogLines(logFile + '.old') : [];
        // The seed line itself (not JSON) is expected in whichever file
        // received it; only the JSON-shaped lines this batch wrote are
        // counted against `emitted`.
        const parsedNames = new Set();
        for (const line of [...liveLines, ...oldLines]) {
            let parsed;
            try { parsed = JSON.parse(line); } catch { continue; }
            if (parsed && typeof parsed.name === 'string') parsedNames.add(parsed.name);
        }
        assert.strictEqual(parsedNames.size, emitted,
            'every claimed nudge\'s line survives somewhere across the live and rotated file, none lost: '
                + 'emitted=' + emitted + ' found=' + JSON.stringify([...parsedNames]));
        for (const n of seen) {
            assert.ok(parsedNames.has(n), 'claimed record ' + n + ' has a surviving log line');
        }
    } finally { rmStore(store); }
});

test('an anchor hit\'s logged pattern is capped and sanitized through ANCHOR_PATH_CAP, not '
    + 'TRIGGER_PATTERN_CAP', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'anchor-hit.md', { anchors: 'src/anchor-target.txt@' + SHA });
        assertNudge(runHook(store, postPayload(store, {
            tool_input: { file_path: path.join(store.cwd, 'src', 'anchor-target.txt') }
        })), 'PostToolUse', 'a call whose touched path matches the anchor');
        const lines = readLogLines(hook.nudgeLogPath(store.cwd)).map((l) => JSON.parse(l));
        assert.strictEqual(lines.length, 1);
        assert.strictEqual(lines[0].type, 'anchor');
        assert.strictEqual(lines[0].pattern, 'src/anchor-target.txt',
            'the anchor path is logged in full, under its own cap rather than the trigger cap');
    } finally { rmStore(store); }
});

test('a PostToolUse-boundary nudge appends to the log exactly as a PreToolUse one does', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'post-boundary.md', { triggers: 'err:permission denied' });
        assertNudge(runHook(store, postPayload(store, {
            tool_name: 'Bash',
            tool_input: { command: 'rm /root/secret' },
            tool_response: { stdout: '', stderr: 'bash: permission denied', exit_code: 1 }
        })), 'PostToolUse', 'a call whose failure output carries the err: trigger');
        const lines = readLogLines(hook.nudgeLogPath(store.cwd)).map((l) => JSON.parse(l));
        assert.strictEqual(lines.length, 1);
        assert.strictEqual(lines[0].name, 'post-boundary.md');
        assert.strictEqual(lines[0].type, 'err');
    } finally { rmStore(store); }
});

// --- The stamp-rate report's own guards: the floor a stamp is measured
// against, the nudgeable gate on both arms, and the three refusals that stand
// the report down rather than let a bound shrink one arm of the comparison.

test('a stamp that lands before the record\'s own first nudge is not counted as a nudged '
    + 'success, so the rate reads applications the nudge could have caused', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'stamped-before-nudge.md', { triggers: 'cmd:node --test' });
        const since = Date.now() - 60 * 60 * 1000;
        // Both moments sit inside the window; only their order is the subject.
        const stampedAt = new Date(since + 10 * 60 * 1000).toISOString();
        const nudgedAt = new Date(since + 30 * 60 * 1000).toISOString();
        const logFile = hook.nudgeLogPath(store.cwd);
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.writeFileSync(logFile, JSON.stringify({
            ts: nudgedAt, name: 'stamped-before-nudge.md', type: 'cmd', pattern: 'node --test'
        }) + '\n', 'utf8');
        fs.writeFileSync(path.join(store.memDir, memq.USAGE_FILE), JSON.stringify({
            kind: 'applied', file: 'stamped-before-nudge.md', ts: stampedAt
        }) + '\n', 'utf8');

        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, since));
        assert.strictEqual(report.error, undefined, 'the report resolves cleanly: ' + JSON.stringify(report));
        assert.strictEqual(report.nudged.total, 1, 'the record is in the nudged arm');
        assert.strictEqual(report.nudged.stamped, 0,
            'its only applied evidence predates its first nudge, so it is not a nudged success');
        assert.strictEqual(report.nudged.rate, 0);
    } finally { rmStore(store); }
});

test('a record carrying neither trigger nor anchor is excluded from the control arm, which no '
    + 'nudge could ever have reached', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'declares-a-trigger.md', { triggers: 'cmd:node --test' });
        writeRecord(store, 'declares-nothing.md', {});
        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, Date.now() - 60000));
        assert.strictEqual(report.error, undefined, 'the report resolves cleanly: ' + JSON.stringify(report));
        assert.strictEqual(report.unnudged.total, 1,
            'only the record the index would ever consider nudging is a fair control');
        assert.strictEqual(report.nudged.total, 0, 'nothing was nudged');
    } finally { rmStore(store); }
});

test('a record the log names that declares neither trigger nor anchor is in neither arm, so a '
    + 'record whose triggers were removed cannot inflate the nudged rate', () => {
    const store = makeStore();
    try {
        // The log names it and the tier still holds it, but it declares
        // nothing the matcher could fire on today: it is not nudgeable now,
        // and the split is over nudgeable records on both sides.
        writeRecord(store, 'nudged-then-stripped.md', {});
        writeRecord(store, 'still-declares.md', { triggers: 'cmd:node --test' });
        const since = Date.now() - 60 * 60 * 1000;
        const insideWindow = new Date(since + 60000).toISOString();
        const logFile = hook.nudgeLogPath(store.cwd);
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.writeFileSync(logFile, JSON.stringify({
            ts: insideWindow, name: 'nudged-then-stripped.md', type: 'cmd', pattern: 'node --test'
        }) + '\n', 'utf8');
        fs.writeFileSync(path.join(store.memDir, memq.USAGE_FILE), JSON.stringify({
            kind: 'applied', file: 'nudged-then-stripped.md', ts: insideWindow
        }) + '\n', 'utf8');

        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, since));
        assert.strictEqual(report.error, undefined, 'the report resolves cleanly: ' + JSON.stringify(report));
        assert.strictEqual(report.nudged.total, 0,
            'a record that declares nothing today is not in the nudged arm, even though the log names it');
        assert.strictEqual(report.nudged.stamped, 0, 'so its applied stamp cannot inflate the nudged rate');
        assert.strictEqual(report.unnudged.total, 1,
            'and it is not in the control arm either: still-declares.md is the whole of it');
    } finally { rmStore(store); }
});

test('a tier listing cut short by this hook\'s own per-call cap refuses the report rather than '
    + 'understating the population', () => {
    const store = makeStore();
    try {
        // One record past the listing cap, so the walk stops with names left
        // unread and every one of them would have been a control.
        for (let i = 0; i <= 512; i += 1) {
            const name = 'bulk-listing-' + String(i).padStart(4, '0') + '.md';
            fs.writeFileSync(path.join(store.memDir, name),
                '---\ntriggers: cmd:node --test\n---\n\nbulk\n', 'utf8');
        }
        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, Date.now() - 60000));
        assert.strictEqual(report.nudged, undefined, 'a truncated listing yields no numbers at all');
        assert.match(report.error, /listing was truncated/,
            'the refusal names the truncation: ' + JSON.stringify(report));
    } finally { rmStore(store); }
});

test('a tier index cut short by this hook\'s own byte budget refuses the report rather than '
    + 'dropping the trailing records out of the control arm alone', () => {
    const store = makeStore();
    try {
        // Each record fills the per-record read cap, so the index's byte
        // budget is spent before the last name is reached: at the budget's own
        // record count the walk ends honestly, and one record past it it stops
        // early with names left unindexed.
        const pad = 'x'.repeat(hook.RECORD_READ_CAP);
        for (let i = 0; i <= 64; i += 1) {
            const name = 'bulk-bytes-' + String(i).padStart(4, '0') + '.md';
            fs.writeFileSync(path.join(store.memDir, name),
                '---\ntriggers: cmd:node --test\n---\n\n' + pad + '\n', 'utf8');
        }
        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, Date.now() - 60000));
        assert.strictEqual(report.nudged, undefined, 'a truncated index yields no numbers at all');
        assert.match(report.error, /index was truncated/,
            'the refusal names the truncation: ' + JSON.stringify(report));
    } finally { rmStore(store); }
});

test('a nudge log past this read\'s own bound refuses the report rather than reading its '
    + 'surviving head as the whole log', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'past-the-bound.md', { triggers: 'cmd:node --test' });
        const since = Date.now() - 60 * 60 * 1000;
        const insideWindow = new Date(since + 60000).toISOString();
        const logFile = hook.nudgeLogPath(store.cwd);
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        // The bound reads from the front, so what a cut drops is the newest
        // lines: the very nudges a window is most likely to be asked about.
        const line = JSON.stringify({
            ts: insideWindow, name: 'past-the-bound.md', type: 'cmd', pattern: 'node --test'
        }) + '\n';
        const handle = fs.openSync(logFile, 'w');
        try {
            let written = 0;
            const target = hook.NUDGE_LOG_MAX_BYTES * 2 + line.length;
            while (written < target) written += fs.writeSync(handle, line);
        } finally { fs.closeSync(handle); }
        assert.ok(fs.statSync(logFile).size > hook.NUDGE_LOG_MAX_BYTES * 2,
            'setup: the sink sits past the read bound');

        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, since));
        assert.strictEqual(report.nudged, undefined, 'a truncated log yields no numbers at all');
        assert.match(report.error, /nudge log/,
            'the refusal names the log: ' + JSON.stringify(report));
    } finally { rmStore(store); }
});

// --- The shared tiers: the reach the project-tier-only index could not have.

// The type and operator tiers of a fixture store, spelled literally rather
// than through memq's own path helpers: those read the store root out of this
// process's environment, and these directories belong to a fixture the child
// is pointed at.
function typeTierDir(store, type) {
    return path.join(store.root, 'memory-types', type);
}
function operatorTierDir(store) {
    return path.join(store.root, 'memory-operator');
}

// Give a fixture store a declared project type, which is what makes its type
// tier resolvable at all: memq reads the Project-Type line out of the project
// tier's own index.
function declareProjectType(store, type) {
    fs.writeFileSync(path.join(store.memDir, 'MEMORY.md'), 'Project-Type: ' + type + '\n', 'utf8');
}

test('an operator-tier trigger nudges from a project whose own tier holds no match, and the same fixture without it says nothing', () => {
    const store = makeStore();
    try {
        // The project tier is not empty, it simply holds nothing that matches:
        // a store with no project-tier records at all would leave a silent
        // control ambiguous between "the shared tier was not read" and
        // "nothing was read".
        writeRecord(store, 'unrelated-project-record.md', { triggers: 'cmd:zpool status' });
        writeRecordIn(operatorTierDir(store), 'operator-wide-lesson.md',
            { triggers: 'cmd:git stash' });
        const fired = runHook(store, prePayload(store, {
            tool_input: { command: 'git stash push -m wip' }
        }));
        const text = assertNudge(fired, 'PreToolUse', 'operator fire');
        assertNames(text, 'operator-wide-lesson.md', 'cmd:git stash', 'operator fire');
        // A hit outside the project tier names its tier, because `memq get`
        // resolves a bare name by precedence and would answer for a nearer
        // record of that name.
        assert.ok(text.includes('operator-wide-lesson.md in the operator tier carries'),
            'the nudge names the tier the record came from, got: ' + text);

        // The withheld control, on a fixture built the same way with the one
        // record removed: the instrument speaks when the thing is there and is
        // silent when it is not, so the silence below is the absence of that
        // record rather than a matcher that never ran.
        const control = makeStore();
        try {
            writeRecord(control, 'unrelated-project-record.md', { triggers: 'cmd:zpool status' });
            fs.mkdirSync(operatorTierDir(control), { recursive: true });
            assertSilent(runHook(control, prePayload(control, {
                tool_input: { command: 'git stash push -m wip' }
            })), 'operator control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('a type-tier trigger nudges through the project declared type, and a project declaring none is silent', () => {
    const store = makeStore();
    try {
        declareProjectType(store, 'webapp');
        writeRecordIn(typeTierDir(store, 'webapp'), 'type-wide-lesson.md',
            { triggers: 'cmd:git stash' });
        const fired = runHook(store, prePayload(store, {
            tool_input: { command: 'git stash push -m wip' }
        }));
        const text = assertNudge(fired, 'PreToolUse', 'type fire');
        assertNames(text, 'type-wide-lesson.md', 'cmd:git stash', 'type fire');
        assert.ok(text.includes('type-wide-lesson.md in the type tier carries'),
            'the nudge names the tier the record came from, got: ' + text);

        // The control: the same tier directory, the same record, and no
        // Project-Type line, so nothing declares the project into that type.
        // What this pins is that the type tier is reached through the
        // project's own declaration rather than by scanning the store.
        const control = makeStore();
        try {
            writeRecordIn(typeTierDir(control, 'webapp'), 'type-wide-lesson.md',
                { triggers: 'cmd:git stash' });
            assertSilent(runHook(control, prePayload(control, {
                tool_input: { command: 'git stash push -m wip' }
            })), 'type control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('a store with neither shared tier still nudges from the project tier', () => {
    const store = makeStore();
    try {
        // Neither shared tier exists on disk, which is the ordinary state of a
        // fresh store and never an error: the resolvers answer null and the
        // project tier's own index is the whole of the match.
        assert.ok(!fs.existsSync(operatorTierDir(store)), 'setup: no operator tier');
        assert.ok(!fs.existsSync(path.join(store.root, 'memory-types')), 'setup: no type tier');
        writeRecord(store, 'project-only.md', { triggers: 'cmd:git stash' });
        const text = assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'git stash push -m wip' }
        })), 'PreToolUse', 'absent tiers');
        assertNames(text, 'project-only.md', 'cmd:git stash', 'absent tiers');
        // The project tier's own line is unchanged by the widening: a tier
        // clause here would say what the reader already assumed.
        assert.ok(text.includes('project-only.md carries cmd:git stash'),
            'the project tier names no tier, got: ' + text);
    } finally { rmStore(store); }
});

test('two tiers holding a record of one name are two nudges rather than one masking the other', () => {
    const store = makeStore();
    try {
        // The same name, a different trigger, and a different fact behind each.
        // A dedup key without the tier in it would let whichever matched first
        // silence the other for the rest of the session.
        writeRecord(store, 'same-name.md', { triggers: 'cmd:git stash' });
        writeRecordIn(operatorTierDir(store), 'same-name.md', { triggers: 'tool:Bash' });
        const text = assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'git stash push -m wip' }
        })), 'PreToolUse', 'same name');
        assert.ok(text.includes('same-name.md carries cmd:git stash'),
            'the project-tier record is named, got: ' + text);
        assert.ok(text.includes('same-name.md in the operator tier carries tool:Bash'),
            'the operator-tier record is named too, got: ' + text);
        // And the command each line hands over resolves the record that line
        // is about. A bare `memq get same-name` walks precedence and answers
        // with the project record, so the operator line's pointer has to carry
        // the flag that pins its tier; without it the reader opens the wrong
        // record and the read stamp lands on the wrong decay clock.
        assert.ok(text.includes('read it with: memq get same-name --operator.'),
            'the shared-tier pointer spells the flag that reaches it, got: ' + text);
        assert.ok(text.includes('read it with: memq get same-name.'),
            'the project-tier pointer is the bare form, got: ' + text);
    } finally { rmStore(store); }
});

test('an err: trigger on a shared tier fires at PostToolUse, the boundary its type belongs to', () => {
    const store = makeStore();
    try {
        // The two boundaries carry different type sets, and the shared tiers
        // were only ever exercised on the pre-boundary ones. A regression that
        // dropped the post-boundary types for a non-project tier would leave
        // every cmd: and tool: case green.
        writeRecordIn(operatorTierDir(store), 'operator-failure-shape.md',
            { triggers: 'err:ENOENT no such file' });
        const text = assertNudge(runHook(store, postPayload(store, {
            tool_response: { stderr: 'Error: ENOENT no such file or directory', exit_code: 1 }
        })), 'PostToolUse', 'operator err');
        assertNames(text, 'operator-failure-shape.md', 'err:ENOENT no such file', 'operator err');
        assert.ok(text.includes('operator-failure-shape.md in the operator tier carries'),
            'the tier is named, got: ' + text);

        // The withheld control, matched on shape rather than on the literal
        // above: the same fixture and the same boundary, and a call that
        // failed exactly as the firing one did, carrying error text the
        // pattern does not name. It is silent because the pattern misses
        // rather than because the call reads as a success, which is the only
        // reading that makes the fire above the pattern meeting the output.
        const control = makeStore();
        try {
            writeRecordIn(operatorTierDir(control), 'operator-failure-shape.md',
                { triggers: 'err:ENOENT no such file' });
            assertSilent(runHook(control, postPayload(control, {
                tool_response: { stderr: 'Error: EACCES permission denied', exit_code: 1 }
            })), 'operator err control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('a glob on a shared tier never fires, because a glob is a path and the tier has no project root', () => {
    const store = makeStore();
    try {
        // The identical entry on both tiers, and only the project tier's
        // fires. A shared-tier glob would match against whatever project the
        // matching session happens to be in, firing one project's record on
        // another project's files, which is the failure the shared-tier anchor
        // exclusion already exists to prevent.
        const touched = path.join(store.cwd, 'src', 'app.js');
        writeRecordIn(operatorTierDir(store), 'operator-globbed.md',
            { triggers: 'glob:src/*.js' });
        assertSilent(runHook(store, postPayload(store, {
            tool_input: { file_path: touched }
        })), 'a shared-tier glob');

        // The control: the same glob on the project tier, matched against the
        // same payload, so the silence above is the tier rather than a payload
        // that never carried a matching path.
        const control = makeStore();
        try {
            writeRecord(control, 'project-globbed.md', { triggers: 'glob:src/*.js' });
            assertNames(assertNudge(runHook(control, postPayload(control, {
                tool_input: { file_path: path.join(control.cwd, 'src', 'app.js') }
            })), 'PostToolUse', 'glob control'), 'project-globbed.md', 'glob:src/*.js',
            'glob control');
        } finally { rmStore(control); }

        // And the exclusion is the glob type alone rather than the tier going
        // quiet at this boundary: an err: trigger on the same operator-tier
        // store still fires on the same call.
        writeRecordIn(operatorTierDir(store), 'operator-still-heard.md',
            { triggers: 'err:ENOENT no such file' });
        const fresh = { ...store, session: nextSession() };
        assertNames(assertNudge(runHook(fresh, postPayload(fresh, {
            tool_input: { file_path: touched },
            tool_response: { stderr: 'Error: ENOENT no such file or directory', exit_code: 1 }
        })), 'PostToolUse', 'tier still heard'), 'operator-still-heard.md',
        'err:ENOENT no such file', 'tier still heard');
    } finally { rmStore(store); }
});

test('an operator-tier record scoped to another machine says so on the nudge line', () => {
    const store = makeStore();
    try {
        // The operator tier syncs between boxes, so a record written with
        // `add-operator --machine` arrives here scoped to a machine this
        // session is not on. It is labelled rather than filtered, which is
        // `find`'s own ruling: no filter anywhere reads this field, so
        // introducing one here would be a new semantics rather than a reading.
        writeRecordIn(operatorTierDir(store), 'nas-box-lesson.md',
            { triggers: 'cmd:git stash', machine: 'nas-box' });
        const text = assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'git stash push -m wip' }
        })), 'PreToolUse', 'foreign machine');
        assertNames(text, 'nas-box-lesson.md', 'cmd:git stash', 'foreign machine');
        assert.ok(text.includes('(recorded for machine:nas-box)'),
            'the nudge says which box the fact is about, got: ' + text);

        // Two controls, because the label has two ways to be wrong. A record
        // scoped to this box is a local fact and takes no label, and a value
        // the writer's own gate would have refused takes none either, since
        // the label asserts where a fact came from and a value nobody could
        // validate supports no such assertion.
        const local = makeStore();
        try {
            writeRecordIn(operatorTierDir(local), 'local-lesson.md',
                { triggers: 'cmd:git stash', machine: os.hostname() });
            const localText = assertNudge(runHook(local, prePayload(local, {
                tool_input: { command: 'git stash push -m wip' }
            })), 'PreToolUse', 'local machine');
            assert.ok(!localText.includes('recorded for machine:'),
                'this box is not labelled as somewhere else, got: ' + localText);
        } finally { rmStore(local); }

        const ungated = makeStore();
        try {
            fs.writeFileSync(path.join(ungated.memDir, 'hand-written.md'),
                '---\ntriggers: cmd:git stash\nmachine: not a machine name\n---\n\n' + BODY_TOKEN + '\n',
                'utf8');
            const ungatedText = assertNudge(runHook(ungated, prePayload(ungated, {
                tool_input: { command: 'git stash push -m wip' }
            })), 'PreToolUse', 'ungated machine value');
            assert.ok(!ungatedText.includes('recorded for machine:'),
                'a value the writer would have refused carries no label, got: ' + ungatedText);
        } finally { rmStore(ungated); }
    } finally { rmStore(store); }
});

test('each tier gets its own index cache, and a shared-tier hit is confirmed against its own tier before it is emitted', () => {
    const store = makeStore();
    try {
        writeRecordIn(operatorTierDir(store), 'operator-cached.md', { triggers: 'cmd:git stash' });
        const payload = () => prePayload(store, { tool_input: { command: 'git stash push -m wip' } });
        assertNudge(runHook(store, payload()), 'PreToolUse', 'first call');
        // One cache file per tier, which cacheFile's keying on the memory
        // directory already gives: the project tier's and the operator tier's
        // are two files, so neither tier's stamp can invalidate the other's.
        const projectCache = hook.cacheFile(stateDir(store), store.memDir);
        const operatorCache = hook.cacheFile(stateDir(store), operatorTierDir(store));
        assert.notStrictEqual(projectCache, operatorCache, 'the two tiers key different caches');
        assert.ok(fs.existsSync(operatorCache), 'the operator tier cached its own index');

        // The cache is never the last word, and the confirmation is what makes
        // that true rather than the cache noticing. The record's declaration is
        // changed with its size and its mtime held exactly where they were, so
        // the stamp the cache is keyed on still matches and the cached index is
        // used: the hit is built from a trigger the record no longer carries,
        // and the only thing left that can catch it is the re-read of the
        // record in the tier the hit came from. Rewriting the record any other
        // way moves the stamp, and the run would go silent at the rebuild with
        // the confirmation never reached.
        const record = path.join(operatorTierDir(store), 'operator-cached.md');
        const was = fs.statSync(record);
        const before = fs.readFileSync(record, 'utf8');
        const after = before.replace('cmd:git stash', 'cmd:git stack');
        assert.notStrictEqual(after, before, 'the fixture carries the trigger this rewrites');
        assert.strictEqual(after.length, before.length, 'the rewrite holds the record\'s size');
        fs.writeFileSync(record, after, 'utf8');
        fs.utimesSync(record, was.atime, was.mtime);
        const now = fs.statSync(record);
        assert.strictEqual(now.size, was.size, 'the size the cache is stamped on is unmoved');
        assert.strictEqual(Math.round(now.mtimeMs), Math.round(was.mtimeMs),
            'and so is the mtime, which is the rest of that stamp');
        const fresh = { ...store, session: nextSession() };
        assertSilent(runHook(fresh, prePayload(fresh, {
            tool_input: { command: 'git stash push -m wip' }
        })), 'declaration withdrawn');
        // And the control the silence rests on: the same call against the same
        // cache with the record still declaring what the cache says it does.
        // Without it, a hook broken into silence on every shared-tier read
        // would pass the assertion above.
        fs.writeFileSync(record, before, 'utf8');
        fs.utimesSync(record, was.atime, was.mtime);
        const again = { ...store, session: nextSession() };
        assertNudge(runHook(again, prePayload(again, {
            tool_input: { command: 'git stash push -m wip' }
        })), 'PreToolUse', 'declaration restored');
    } finally { rmStore(store); }
});

test('a shared-tier anchor never fires, because an anchor path resolves against a project root the tier has none of', () => {
    const store = makeStore();
    try {
        const touched = path.join('src', 'app.js');
        // The identical anchor on both tiers, and only the project tier's
        // fires: the control is the project-tier copy, which proves the
        // payload really does carry a path this anchor matches.
        writeRecordIn(operatorTierDir(store), 'operator-anchored.md',
            { anchors: 'src/app.js@' + SHA });
        const shared = runHook(store, postPayload(store, {
            tool_input: { file_path: path.join(store.cwd, touched) }
        }));
        assertSilent(shared, 'a shared-tier anchor');

        const control = makeStore();
        try {
            writeRecord(control, 'project-anchored.md', { anchors: 'src/app.js@' + SHA });
            assertNames(assertNudge(runHook(control, postPayload(control, {
                tool_input: { file_path: path.join(control.cwd, touched) }
            })), 'PostToolUse', 'anchor control'), 'project-anchored.md', 'src/app.js',
            'anchor control');
        } finally { rmStore(control); }
    } finally { rmStore(store); }
});

test('the nudge log names the tier, and the stamp-rate report counts project-tier lines alone', () => {
    const store = makeStore();
    try {
        writeRecord(store, 'project-nudged.md', { triggers: 'cmd:git stash' });
        writeRecordIn(operatorTierDir(store), 'operator-nudged.md', { triggers: 'tool:Bash' });
        assertNudge(runHook(store, prePayload(store, {
            tool_input: { command: 'git stash push -m wip' }
        })), 'PreToolUse', 'both tiers');
        const lines = fs.readFileSync(hook.nudgeLogPath(store.cwd), 'utf8')
            .split('\n').filter((l) => l !== '').map((l) => JSON.parse(l));
        const byName = new Map(lines.map((l) => [l.name, l]));
        assert.strictEqual(byName.get('project-nudged.md').tier, 'project',
            'the project tier says so on its own line');
        assert.strictEqual(byName.get('operator-nudged.md').tier, 'operator',
            'the shared tier is named rather than left to be guessed');

        // A shared-tier line contributes to neither arm. Here the operator
        // tier holds a record whose name the project tier also holds, which is
        // the only way a shared-tier line could reach the report at all: with
        // the tier read, that project-tier record stays in the control arm
        // where it belongs, having never been nudged.
        writeRecord(store, 'operator-nudged.md', { triggers: 'cmd:zpool status' });
        const since = Date.now() - 60 * 60 * 1000;
        const report = withStoreEnv(store, () => hook.nudgeStampRate(store.cwd, since));
        assert.strictEqual(report.error, undefined, JSON.stringify(report));
        assert.strictEqual(report.nudged.total, 1,
            'only the project-tier record this session nudged: ' + JSON.stringify(report));
        assert.strictEqual(report.unnudged.total, 1,
            'the same-named project-tier record stays a control: ' + JSON.stringify(report));
    } finally { rmStore(store); }
});
