// Tests for plugins/claude-kit/hooks/hook-dispatch.js, the one process
// hooks.json wires on PreToolUse and PostToolUse, and for its thread bootstrap
// hook-dispatch-boot.js.
//
// Node's built-in test runner, no framework. Three layers:
//   - the pure functions (matcher reading, selection, merge) called in-process;
//   - dispatch() called in-process over stand-in hooks written to a temp
//     directory, which is where the thread behaviours are pinned: an exit code
//     survives, a throw costs one hook, an oversize or killed thread comes back
//     through a child process;
//   - the differential pin, which runs the real dispatcher end to end against
//     the real routing table and compares it with the same hooks spawned one by
//     one as child processes, the behaviour the dispatcher replaces.
//
// Every case owns a temp directory and opens no port. The differential cases
// redirect HOME and USERPROFILE to a fresh fixture per side, because several
// routed hooks keep per-session state and a second run over the same state is
// allowed to answer differently.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN = path.join(__dirname, '..', 'plugins', 'claude-kit');
const HOOKS = path.join(PLUGIN, 'hooks');
const DISPATCH = path.join(HOOKS, 'hook-dispatch.js');
const d = require(DISPATCH);

function mkTmp(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmrf(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* best effort */ }
}

// Writes stand-in hooks into a temp directory and returns it.
function standIns(files) {
    const dir = mkTmp('hook-dispatch-standin-');
    for (const name of Object.keys(files)) fs.writeFileSync(path.join(dir, name), files[name]);
    return dir;
}

const READ = "const p = JSON.parse(require('fs').readFileSync(0, 'utf8'));";
const ctx = (text) => READ + "console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: '" + text + "' } }));";
const decide = (decision, reason) => READ + "console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: '" + decision + "', permissionDecisionReason: '" + reason + "' } }));";

const PAYLOAD = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } });

// ---------------------------------------------------------------------------
// Matcher and selection
// ---------------------------------------------------------------------------

test('a matcher that is absent, empty or a star reaches every tool', () => {
    for (const m of [undefined, null, '', '*']) {
        assert.strictEqual(d.matches(m, 'Bash'), true);
        assert.strictEqual(d.matches(m, 'mcp__anything__at_all'), true);
    }
});

test('an alternation matcher is anchored at both ends', () => {
    assert.strictEqual(d.matches('Bash|PowerShell', 'Bash'), true);
    assert.strictEqual(d.matches('Bash|PowerShell', 'PowerShell'), true);
    // The unanchored reading would admit all three of these.
    assert.strictEqual(d.matches('Bash|PowerShell', 'BashOutput'), false);
    assert.strictEqual(d.matches('Bash|PowerShell', 'KillBash'), false);
    assert.strictEqual(d.matches('Edit', 'MultiEdit'), false);
});

test('a matcher that does not compile matches nothing rather than throwing', () => {
    assert.strictEqual(d.matches('Bash(', 'Bash'), false);
});

test('selection keeps table order, runs a hook once, and runs everything for an unreadable payload', () => {
    const entries = [
        { matcher: 'Write|Bash', names: ['a.js'] },
        { matcher: 'Write', names: ['b.js'] },
        { matcher: 'Bash', names: ['c.js', 'a.js'] },
        { matcher: '*', names: ['z.js'] }
    ];
    assert.deepStrictEqual(d.selectHooks(entries, 'Bash'), ['a.js', 'c.js', 'z.js']);
    assert.deepStrictEqual(d.selectHooks(entries, 'Glob'), ['z.js']);
    assert.deepStrictEqual(d.selectHooks(entries, undefined), ['a.js', 'b.js', 'c.js', 'z.js']);
});

test('the routing table reads in hooks.json shape and refuses a malformed one', () => {
    const dir = mkTmp('hook-dispatch-table-');
    try {
        const good = path.join(dir, 'good.json');
        fs.writeFileSync(good, '﻿' + JSON.stringify({ hooks: { PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/x-guard.js"' }] }
        ] } }));
        assert.deepStrictEqual(d.readTable(good, 'PreToolUse'), [{ matcher: 'Bash', names: ['x-guard.js'] }]);
        assert.deepStrictEqual(d.readTable(good, 'PostToolUse'), []);

        const noFile = path.join(dir, 'bad.json');
        fs.writeFileSync(noFile, JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'echo hi' }] }] } }));
        assert.throws(() => d.readTable(noFile, 'PreToolUse'), /names no hook file/);
        assert.throws(() => d.readTable(path.join(dir, 'absent.json'), 'PreToolUse'));
    } finally {
        rmrf(dir);
    }
});

// ---------------------------------------------------------------------------
// Merge rules
// ---------------------------------------------------------------------------

const r = (name, code, stdout, stderr) => ({ name, code, stdout: stdout || '', stderr: stderr || '' });
const hso = (fields) => JSON.stringify({ hookSpecificOutput: Object.assign({ hookEventName: 'PreToolUse' }, fields) });

test('any blocking hook makes the answer a block carrying only the blockers\' text, in table order', () => {
    const m = d.merge('PreToolUse', [
        r('grant.js', 0, hso({ permissionDecision: 'allow' })),
        r('first.js', 2, '', 'Blocked: first\n'),
        r('broken.js', 1, '', 'stack trace\n'),
        r('second.js', 2, '', 'Blocked: second\n')
    ]);
    assert.deepStrictEqual(m, { exitCode: 2, stdout: '', stderr: 'Blocked: first\nBlocked: second\n' });
});

test('one hook speaking alone is passed through byte for byte', () => {
    const raw = '{ "hookSpecificOutput" : { "hookEventName":"PreToolUse","additionalContext":"x" } }\n';
    const m = d.merge('PreToolUse', [r('quiet.js', 0, ''), r('nudge.js', 0, raw)]);
    assert.deepStrictEqual(m, { exitCode: 0, stdout: raw, stderr: '' });
});

test('decisions merge by deny, then ask, then allow, and contexts join in table order', () => {
    const m = d.merge('PreToolUse', [
        r('grant.js', 0, hso({ permissionDecision: 'allow', permissionDecisionReason: 'granted' })),
        r('nudge.js', 0, hso({ additionalContext: 'first context' })),
        r('guard.js', 0, hso({ permissionDecision: 'deny', permissionDecisionReason: 'refused', additionalContext: 'second context' }))
    ]);
    assert.strictEqual(m.exitCode, 0);
    assert.deepStrictEqual(JSON.parse(m.stdout), { hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'refused',
        additionalContext: 'first context\n\nsecond context'
    } });

    const ask = d.merge('PreToolUse', [
        r('a.js', 0, hso({ permissionDecision: 'allow', permissionDecisionReason: 'a' })),
        r('b.js', 0, hso({ permissionDecision: 'ask', permissionDecisionReason: 'b' }))
    ]);
    assert.strictEqual(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('a non-blocking failure is named beside the answer, and is exit 1 when it is the only thing to say', () => {
    const beside = d.merge('PostToolUse', [
        r('a.js', 0, hso({ additionalContext: 'one' })),
        r('b.js', 0, hso({ additionalContext: 'two' })),
        r('broken.js', 1, '', 'boom\n')
    ]);
    assert.strictEqual(beside.exitCode, 0);
    assert.strictEqual(beside.stderr, 'boom\n');
    assert.match(JSON.parse(beside.stdout).systemMessage, /broken\.js \(exit 1\)/);
    assert.strictEqual(JSON.parse(beside.stdout).hookSpecificOutput.hookEventName, 'PostToolUse');

    const alone = d.merge('PostToolUse', [r('quiet.js', 0, ''), r('broken.js', 1, '', 'boom\n')]);
    assert.deepStrictEqual(alone, { exitCode: 1, stdout: '', stderr: 'boom\n' });
});

test('nothing to say is a silent exit 0', () => {
    assert.deepStrictEqual(d.merge('PreToolUse', [r('a.js', 0, ''), r('b.js', 0, '  \n')]), { exitCode: 0, stdout: '', stderr: '' });
    assert.deepStrictEqual(d.merge('PreToolUse', []), { exitCode: 0, stdout: '', stderr: '' });
});

// ---------------------------------------------------------------------------
// Threads, over stand-in hooks
// ---------------------------------------------------------------------------

test('a threaded hook keeps its exit code, its stderr, its payload and its place as the main module', async () => {
    const dir = standIns({
        'block.js': READ + "if (require.main !== module) { console.log('NOT MAIN'); process.exit(0); }"
            + "process.stderr.write('Blocked: ' + p.tool_name + ' from ' + require('path').basename(process.argv[1]) + '\\n'); process.exit(2);"
    });
    try {
        const m = await d.dispatch('PreToolUse', ['block.js'], PAYLOAD, { hooksDir: dir });
        assert.deepStrictEqual(m, { exitCode: 2, stdout: '', stderr: 'Blocked: Bash from block.js\n' });
    } finally {
        rmrf(dir);
    }
});

test('process.exitCode, fs.writeSync to descriptors 1 and 2, and a buffer argument all reach the answer', async () => {
    const dir = standIns({
        'viafd.js': "const fs = require('fs'); fs.readFileSync(0, 'utf8');"
            + "fs.writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 'by descriptor' } }));"
            + "fs.writeSync(2, Buffer.from('xxnote\\n'), 2);",
        'code.js': "require('fs').readFileSync(0, 'utf8'); process.stderr.write('Blocked: by exitCode\\n'); process.exitCode = 2;"
    });
    try {
        const quiet = await d.dispatch('PreToolUse', ['viafd.js'], PAYLOAD, { hooksDir: dir });
        assert.strictEqual(quiet.exitCode, 0);
        assert.strictEqual(JSON.parse(quiet.stdout).hookSpecificOutput.additionalContext, 'by descriptor');

        const blocked = await d.dispatch('PreToolUse', ['viafd.js', 'code.js'], PAYLOAD, { hooksDir: dir });
        assert.deepStrictEqual(blocked, { exitCode: 2, stdout: '', stderr: 'Blocked: by exitCode\n' });
    } finally {
        rmrf(dir);
    }
});

test('nothing after process.exit runs, inside a try included', async () => {
    const dir = standIns({
        'swallow.js': "require('fs').readFileSync(0, 'utf8'); try { process.stdout.write('before'); process.exit(0); } catch (e) { process.stdout.write('SWALLOWED'); } process.stdout.write('AFTER');"
    });
    try {
        const m = await d.dispatch('PreToolUse', ['swallow.js'], PAYLOAD, { hooksDir: dir });
        assert.deepStrictEqual(m, { exitCode: 0, stdout: 'before', stderr: '' });
    } finally {
        rmrf(dir);
    }
});

test('one hook throwing costs that hook alone: its neighbours\' answers and a neighbour\'s block both survive', async () => {
    const dir = standIns({
        'one.js': ctx('one'),
        'throws.js': READ + "throw new Error('boom inside a hook');",
        'two.js': ctx('two'),
        'block.js': READ + "process.stderr.write('Blocked: still here\\n'); process.exit(2);"
    });
    try {
        const m = await d.dispatch('PreToolUse', ['one.js', 'throws.js', 'two.js'], PAYLOAD, { hooksDir: dir });
        assert.strictEqual(m.exitCode, 0);
        const out = JSON.parse(m.stdout);
        assert.strictEqual(out.hookSpecificOutput.additionalContext, 'one\n\ntwo');
        assert.match(out.systemMessage, /throws\.js \(exit 1\)/);
        assert.match(m.stderr, /boom inside a hook/);

        const blocked = await d.dispatch('PreToolUse', ['throws.js', 'block.js'], PAYLOAD, { hooksDir: dir });
        assert.deepStrictEqual(blocked, { exitCode: 2, stdout: '', stderr: 'Blocked: still here\n' });
    } finally {
        rmrf(dir);
    }
});

test('an answer too large for the thread\'s buffer comes back whole through a child process', async () => {
    const dir = standIns({
        'big.js': READ + "process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 'x'.repeat(1200000) } }));"
    });
    try {
        assert.strictEqual(await d.runThreaded(path.join(dir, 'big.js'), PAYLOAD, 20000), null);
        const m = await d.dispatch('PreToolUse', ['big.js'], PAYLOAD, { hooksDir: dir });
        assert.strictEqual(m.exitCode, 0);
        assert.strictEqual(JSON.parse(m.stdout).hookSpecificOutput.additionalContext.length, 1200000);
    } finally {
        rmrf(dir);
    }
});

test('a throw from a callback ends a threaded hook as it ends a child: same exit code, and the stack still reaches stderr', async () => {
    const dir = standIns({
        'async-throw.js': READ + "process.stderr.write('said before dying\\n'); process.exitCode = 2; setImmediate(() => { throw new Error('late'); });"
    });
    try {
        const threaded = await d.runThreaded(path.join(dir, 'async-throw.js'), PAYLOAD, 20000);
        const child = d.runChild(path.join(dir, 'async-throw.js'), PAYLOAD);
        assert.notStrictEqual(threaded, null);
        // Node overrides the hook's own exitCode with 1 on an uncaught throw, in
        // a process and in a thread alike, so the two agree on the verdict.
        assert.strictEqual(child.code, 1);
        assert.strictEqual(threaded.code, child.code);
        assert.match(threaded.stderr, /^said before dying\n/);
        assert.match(threaded.stderr, /Error: late/);
        assert.match(child.stderr, /Error: late/);
    } finally {
        rmrf(dir);
    }
});

test('a thread that ends without writing its answer falls back, so a guard\'s block is not lost', async () => {
    // Removing the exit listeners is the stand-in for any way a thread can end
    // with its state word still 0. The child process path then answers.
    const dir = standIns({
        'no-answer.js': READ + "process.removeAllListeners('exit'); process.stderr.write('Blocked: from the fallback\\n'); process.exit(2);"
    });
    try {
        assert.strictEqual(await d.runThreaded(path.join(dir, 'no-answer.js'), PAYLOAD, 20000), null);
        const m = await d.dispatch('PreToolUse', ['no-answer.js'], PAYLOAD, { hooksDir: dir });
        assert.deepStrictEqual(m, { exitCode: 2, stdout: '', stderr: 'Blocked: from the fallback\n' });
    } finally {
        rmrf(dir);
    }
});

test('a hook that never answers is cut off at the deadline and costs only itself', async () => {
    const dir = standIns({
        'hang.js': "require('fs').readFileSync(0, 'utf8'); setInterval(() => {}, 1000);",
        'one.js': ctx('still delivered')
    });
    try {
        const m = await d.dispatch('PreToolUse', ['hang.js', 'one.js'], PAYLOAD, { hooksDir: dir, deadlineMs: 1500 });
        assert.strictEqual(m.exitCode, 0);
        const out = JSON.parse(m.stdout);
        assert.strictEqual(out.hookSpecificOutput.additionalContext, 'still delivered');
        assert.match(out.systemMessage, /hang\.js \(exit 1\)/);
        assert.match(m.stderr, /no answer within 1500 ms/);
    } finally {
        rmrf(dir);
    }
});

test('the legacy path gives the same answer as the threaded one', async () => {
    const dir = standIns({
        'grant.js': decide('allow', 'granted'),
        'one.js': ctx('one'),
        'fails.js': READ + "process.stderr.write('soft failure\\n'); process.exit(3);"
    });
    try {
        const names = ['grant.js', 'one.js', 'fails.js'];
        const threaded = await d.dispatch('PreToolUse', names, PAYLOAD, { hooksDir: dir });
        const legacy = await d.dispatch('PreToolUse', names, PAYLOAD, { hooksDir: dir, legacy: true });
        assert.deepStrictEqual(threaded, legacy);
        assert.strictEqual(JSON.parse(threaded.stdout).hookSpecificOutput.permissionDecision, 'allow');
    } finally {
        rmrf(dir);
    }
});

// ---------------------------------------------------------------------------
// The differential pin: the real dispatcher against the real hooks
// ---------------------------------------------------------------------------

// A fresh HOME and project per side, so per-session hook state cannot make the
// second run answer differently from the first.
function fixture() {
    const root = mkTmp('hook-dispatch-diff-');
    const home = path.join(root, 'home');
    const proj = path.join(root, 'proj');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, CLAUDE_PLUGIN_ROOT: PLUGIN });
    delete env.KIT_HOOK_DISPATCH;
    return { root, proj, env };
}

function payloadFor(event, proj, toolName, toolInput, extra) {
    const p = Object.assign({
        session_id: 'hook-dispatch-differential',
        hook_event_name: event,
        tool_name: toolName,
        tool_input: toolInput,
        cwd: proj
    }, extra || {});
    if (event === 'PostToolUse') p.tool_response = { stdout: 'ok', stderr: '' };
    return p;
}

const CASES = [
    { label: 'Bash, quiet', event: 'PreToolUse', tool: 'Bash', input: { command: 'git status' } },
    { label: 'Bash, a read-only reviewer pushing, which is blocked', event: 'PreToolUse', tool: 'Bash',
        input: { command: 'git push origin main' }, extra: { agent_type: 'claude-kit:blind-reviewer' }, expectExit: 2 },
    { label: 'Bash, a memq call the grant hook reads', event: 'PreToolUse', tool: 'Bash', input: { command: 'memq find dispatcher' } },
    { label: 'PowerShell, quiet', event: 'PreToolUse', tool: 'PowerShell', input: { command: 'git status' } },
    { label: 'Write', event: 'PreToolUse', tool: 'Write', input: { file_path: 'notes.txt', content: 'x' } },
    { label: 'Read', event: 'PreToolUse', tool: 'Read', input: { file_path: 'notes.txt' } },
    { label: 'a tool only the wildcard reaches', event: 'PreToolUse', tool: 'Glob', input: { pattern: '*.md' } },
    { label: 'Bash', event: 'PostToolUse', tool: 'Bash', input: { command: 'git status' } },
    { label: 'Write', event: 'PostToolUse', tool: 'Write', input: { file_path: 'notes.txt', content: 'x' } },
    { label: 'Read', event: 'PostToolUse', tool: 'Read', input: { file_path: 'notes.txt' } }
];

for (const c of CASES) {
    test('differential, ' + c.event + ' ' + c.label + ': the dispatcher answers as the hooks do one by one', () => {
        const a = fixture();
        const b = fixture();
        try {
            // Side A: the dispatcher, end to end, as the harness launches it.
            const payloadA = JSON.stringify(payloadFor(c.event, a.proj, c.tool, c.input, c.extra));
            const run = spawnSync(process.execPath, [DISPATCH, c.event], {
                input: payloadA, cwd: a.proj, env: a.env, encoding: 'utf8', timeout: 60000
            });
            assert.strictEqual(run.error, undefined);

            // Side B: each selected hook as its own child process, which is what
            // hooks.json wired before, merged by the same rules.
            const payloadB = JSON.stringify(payloadFor(c.event, b.proj, c.tool, c.input, c.extra));
            const names = d.selectHooks(d.readTable(d.TABLE_PATH, c.event), c.tool);
            assert.ok(names.length > 0, 'the table routes at least the wildcard hook to every tool');
            const results = names.map((name) => {
                const one = spawnSync(process.execPath, [path.join(HOOKS, name)], {
                    input: payloadB, cwd: b.proj, env: b.env, encoding: 'utf8', timeout: 60000
                });
                return { name, code: one.status, stdout: one.stdout || '', stderr: one.stderr || '' };
            });
            const expected = d.merge(c.event, results);

            // The two sides differ only in their fixture paths.
            const norm = (s, f) => String(s || '').split(f.root).join('<ROOT>').split(f.root.replace(/\\/g, '\\\\')).join('<ROOT>');
            assert.strictEqual(run.status, expected.exitCode);
            assert.strictEqual(norm(run.stderr, a), norm(expected.stderr, b));
            assert.strictEqual(norm(run.stdout, a), norm(expected.stdout, b));
            if (c.expectExit !== undefined) assert.strictEqual(run.status, c.expectExit);
        } finally {
            rmrf(a.root);
            rmrf(b.root);
        }
    });
}

test('the dispatcher reports an unusable routing table loudly and does not block', () => {
    // Run a copy of the dispatcher from a directory that holds no table.
    const dir = mkTmp('hook-dispatch-notable-');
    try {
        fs.copyFileSync(DISPATCH, path.join(dir, 'hook-dispatch.js'));
        const run = spawnSync(process.execPath, [path.join(dir, 'hook-dispatch.js'), 'PreToolUse'], {
            input: PAYLOAD, encoding: 'utf8', timeout: 20000
        });
        assert.strictEqual(run.status, 1);
        assert.match(run.stderr, /routing table .* is unusable/);
        assert.match(run.stderr, /no kit tool-use hook ran/);
    } finally {
        rmrf(dir);
    }
});

test('KIT_HOOK_DISPATCH=legacy still blocks what the threaded path blocks', () => {
    const f = fixture();
    try {
        const payload = JSON.stringify(payloadFor('PreToolUse', f.proj, 'Bash',
            { command: 'git push origin main' }, { agent_type: 'claude-kit:blind-reviewer' }));
        const env = Object.assign({}, f.env, { KIT_HOOK_DISPATCH: 'legacy' });
        const run = spawnSync(process.execPath, [DISPATCH, 'PreToolUse'], {
            input: payload, cwd: f.proj, env, encoding: 'utf8', timeout: 60000
        });
        assert.strictEqual(run.status, 2);
        assert.match(run.stderr, /^Blocked:/);
    } finally {
        rmrf(f.root);
    }
});
