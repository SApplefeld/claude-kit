// Tests for plugins/claude-kit/hooks/hook-dispatch.js, the one process
// hooks.json wires on PreToolUse and PostToolUse, and for its thread bootstrap
// hook-dispatch-boot.js.
//
// Node's built-in test runner, no framework. Three layers:
//   - the pure functions (matcher reading, selection, merge) called in-process;
//   - dispatch() called in-process over stand-in hooks written to a temp
//     directory, which is where the thread behaviours are pinned: an exit code
//     survives, a throw costs one hook, a thread that leaves no answer comes
//     back through a child process, an oversize answer is dropped without a
//     second run, and a synchronous child call cannot hold the process past
//     the deadline;
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
    assert.strictEqual(d.matches('.*', 'Anything'), true);
    assert.strictEqual(d.matches('Notebook.*', 'NotebookEdit'), true);
});

test('every matcher the routing table holds is a wildcard or a plain list of tool names', () => {
    // A plain list has one reading: the tool is one of the names. How the
    // harness anchors a true regular expression is not something this repo has
    // established, so the table is held to the matchers where that question
    // cannot decide whether a guard runs.
    for (const event of ['PreToolUse', 'PostToolUse']) {
        for (const entry of d.readTable(d.TABLE_PATH, event)) {
            // matchesAll is the dispatcher's own reading of a wildcard, absent
            // and null included; a regex test alone would read an absent
            // matcher as the string "undefined".
            assert.ok(d.matchesAll(entry.matcher) || d.SIMPLE_MATCHER.test(entry.matcher),
                event + ' matcher ' + JSON.stringify(entry.matcher) + ' is a wildcard or a plain list');
        }
    }
});

test('the dispatcher\'s own copy of the routing equals the table file', () => {
    // The copy routes a call when the file cannot be read, so drift between
    // them would route a broken-table call differently from a healthy one.
    for (const event of ['PreToolUse', 'PostToolUse']) {
        assert.deepStrictEqual(d.fallbackEntries(event), d.readTable(d.TABLE_PATH, event));
    }
    assert.deepStrictEqual(d.fallbackEntries('Stop'), []);
});

// The idiom every file loaded into a hook's thread must keep, each as the
// reason it is banned and the pattern that finds it. The bootstrap collects
// the stream writes and fs.writeSync to descriptors 1 and 2, so a file that
// read process.stdin would be handed nothing, one that wrote with
// fs.writeFileSync(1) or let a child inherit stdio would write into the
// dispatcher's own answer, and one that registered an exit handler would
// write after the bootstrap had reported. The threads share the process's
// working directory and its real environment object, so the environment
// patterns cover the named shapes of a write: plain, compound and logical
// assignment, ++ and --, delete, Object.assign into it, the bracket spelling
// of the object, and an alias taken of it by assignment or by destructuring,
// through which a later write would not spell process.env at all. A spread
// or Object.assign copy out of it is a read and passes. What the shapes do
// not reach, and the sweep therefore does not claim: process.env handed to a
// function as an argument, and a write through Object.defineProperty or
// Reflect.set. The named shapes are swept; the class is not.
const IDIOM_BANS = [
    ['reads stdin as a stream', /process\.stdin/],
    ['writes a descriptor with writeFileSync', /writeFileSync\(\s*[12]\s*,/],
    ['lets a child inherit the dispatcher\'s stdio', /stdio:\s*'inherit'/],
    ['registers an exit handler', /process\.(on|once|prependListener)\(\s*'(exit|beforeExit)'/],
    ['changes the shared working directory', /process\.chdir\(/],
    ['assigns to the shared environment', /process\.env(\.\w+|\[[^\]]+\])?\s*(?:[-+*/%&|^]|\*\*|<<|>>>?|\?\?|&&|\|\|)?=(?!=)/],
    ['steps a shared environment value', /(\+\+|--)\s*process\.env(\.\w+|\[)|process\.env(\.\w+|\[[^\]]+\])\s*(\+\+|--)/],
    ['deletes from the shared environment', /delete\s+process\.env/],
    ['copies into the shared environment', /Object\.assign\(\s*process\.env\b/],
    ['aliases the shared environment', /[^\s=!<>}]\s*=\s*process\.env(?![.\[\w])/],
    ['aliases the shared environment by destructuring', /\{\s*env\s*(?::\s*\w+\s*)?\}\s*=\s*process\b/],
    ['reaches the shared environment by its bracket spelling', /process\[\s*['"]env['"]\s*\]/]
];

const SCRIPTS = path.join(PLUGIN, 'scripts');

function inside(file, root) {
    const rel = path.relative(root, file);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// The .js file a require target names, by node's own order: the path as
// written, then with .js added, then index.js under it. Null for none.
function resolveJs(target) {
    for (const candidate of [target, target + '.js', path.join(target, 'index.js')]) {
        try {
            if (candidate.endsWith('.js') && fs.statSync(candidate).isFile()) return candidate;
        } catch { /* not this spelling */ }
    }
    return null;
}

// Every file under the roots that the given files load, transitively and each
// once, as a Map of absolute path to text. Two spellings are followed: a
// string-literal relative require, and a path.join(__dirname, ...) of string
// literals, which is how the memq callers name scripts/memq.js. A target
// outside the roots is not followed, so a built-in or a node_modules module
// never enters the closure.
function requireClosure(files, roots) {
    const seen = new Map();
    const queue = files.slice();
    while (queue.length > 0) {
        const file = path.resolve(queue.shift());
        if (seen.has(file)) continue;
        const text = fs.readFileSync(file, 'utf8');
        seen.set(file, text);
        const dir = path.dirname(file);
        const targets = [];
        for (const m of text.matchAll(/require\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g)) targets.push(path.resolve(dir, m[2]));
        for (const m of text.matchAll(/path\.join\(\s*__dirname\s*((?:,\s*'[^']+'\s*)+)\)/g)) {
            const parts = Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
            targets.push(path.resolve(dir, ...parts));
        }
        for (const target of targets) {
            const resolved = resolveJs(target);
            if (resolved !== null && roots.some((root) => inside(resolved, root))) queue.push(resolved);
        }
    }
    return seen;
}

// Each banned idiom found in the closure, as 'file:line reason (match)'.
function idiomFaults(closure) {
    const faults = [];
    for (const [file, text] of closure) {
        for (const [reason, pattern] of IDIOM_BANS) {
            const m = pattern.exec(text);
            if (m === null) continue;
            const line = text.slice(0, m.index).split('\n').length;
            faults.push(path.basename(file) + ':' + line + ' ' + reason + ' (' + m[0].trim() + ')');
        }
    }
    return faults;
}

test('every routed hook, and every file it loads into its thread, keeps the idiom the thread bootstrap serves', () => {
    // The hook file is not the whole of what runs in the thread: the shared
    // libraries and scripts/memq.js are loaded into the same thread, share the
    // same environment object and descriptors, and would break the bootstrap's
    // contract exactly as the hook itself would.
    const routed = new Set();
    for (const event of ['PreToolUse', 'PostToolUse']) {
        for (const name of d.selectHooks(d.readTable(d.TABLE_PATH, event), undefined)) routed.add(name);
    }
    assert.ok(routed.size >= 12);
    for (const name of routed) {
        const text = fs.readFileSync(path.join(HOOKS, name), 'utf8');
        assert.match(text, /fs\.readFileSync\(0, 'utf8'\)/, name + ' reads its payload from descriptor 0');
    }
    const closure = requireClosure(Array.from(routed, (name) => path.join(HOOKS, name)), [HOOKS, SCRIPTS]);
    // The walker's reach, pinned on the libraries the routed hooks load: a
    // walker that stopped following would leave the closure at the twelve
    // and the sweep below would pass over nothing. kit-git-lib.js is not
    // among them: only the SessionStart and Stop hooks load it.
    for (const expected of ['hooks/kit-read-lib.js', 'hooks/kit-compact-lib.js', 'hooks/kit-goal-lib.js',
        'hooks/kit-network-lib.js', 'hooks/kit-agent-identity-lib.js', 'hooks/kit-tool-payload-lib.js', 'scripts/memq.js']) {
        assert.ok(closure.has(path.join(PLUGIN, expected)), expected + ' is in the closure');
    }
    assert.deepStrictEqual(idiomFaults(closure), []);
});

test('the idiom sweep speaks on a planted write, an alias and a chained require, and follows nothing outside its roots', () => {
    // The control for the sweep above, whose acceptance is an absence: each
    // banned spelling planted where its literal never names it, two requires
    // deep, with a file of legitimate reads beside them that must pass and a
    // file outside the roots that must not be followed.
    const outside = standIns({ 'outside.js': "process.chdir('/'); module.exports = {};" });
    const dir = standIns({});
    const toOutside = path.relative(dir, path.join(outside, 'outside.js')).replace(/\\/g, '/');
    fs.writeFileSync(path.join(dir, 'planted.js'), "const path = require('path');\n" + READ
        + " process.env['KIT_PLANTED'] += p.tool_name;"
        + " require('./deeper.js'); require('./clean.js'); require('" + toOutside + "');"
        + " require(path.join(__dirname, 'sub', 'joined.js'));");
    fs.writeFileSync(path.join(dir, 'deeper.js'), "const held = process.env\nconst { env } = process;\nmodule.exports = require('./end');");
    fs.writeFileSync(path.join(dir, 'end.js'), "process.chdir(require('os').tmpdir()); process['env'].KIT_END = '1'; module.exports = {};");
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'joined.js'), "module.exports = { reached: true };");
    fs.writeFileSync(path.join(dir, 'clean.js'), "const copy = { ...process.env };\n"
        + "const merged = Object.assign({}, process.env, { X: '1' });\n"
        + "const { HOME } = process.env;\n"
        + "const same = process.env.KIT_X === 'a' && process.env['KIT_Y'] !== 'b';\n"
        + "module.exports = { copy, merged, HOME, same, env: process.env };");
    try {
        const closure = requireClosure([path.join(dir, 'planted.js')], [dir]);
        assert.deepStrictEqual(Array.from(closure.keys(), (f) => path.basename(f)).sort(),
            ['clean.js', 'deeper.js', 'end.js', 'joined.js', 'planted.js'],
            'the walker follows relative requires and the path.join(__dirname, ...) spelling, and nothing outside its roots');
        const faults = idiomFaults(closure);
        assert.ok(faults.some((f) => /^planted\.js:\d+ assigns to the shared environment/.test(f)), faults.join('\n'));
        assert.ok(faults.some((f) => /^deeper\.js:\d+ aliases the shared environment \(/.test(f)), faults.join('\n'));
        assert.ok(faults.some((f) => /^deeper\.js:\d+ aliases the shared environment by destructuring/.test(f)), faults.join('\n'));
        assert.ok(faults.some((f) => /^end\.js:\d+ changes the shared working directory/.test(f)), faults.join('\n'));
        assert.ok(faults.some((f) => /^end\.js:\d+ reaches the shared environment by its bracket spelling/.test(f)), faults.join('\n'));
        assert.strictEqual(faults.length, 5, 'the legitimate reads in clean.js pass:\n' + faults.join('\n'));
    } finally {
        rmrf(dir);
        rmrf(outside);
    }
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

        // A matcher that does not compile would match nothing and unroute its
        // guard in silence, so the table is refused whole and the copy routes.
        const badMatcher = path.join(dir, 'matcher.json');
        fs.writeFileSync(badMatcher, JSON.stringify({ hooks: { PreToolUse: [
            { matcher: 'Bash(', hooks: [{ command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/x-guard.js"' }] }
        ] } }));
        assert.throws(() => d.readTable(badMatcher, 'PreToolUse'));
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

test('a failure beside plain text is still named, and text fields from several hooks join rather than drop', () => {
    const plain = d.merge('PostToolUse', [r('talks.js', 0, 'just some text\n'), r('broken.js', 1, '', 'boom\n')]);
    assert.strictEqual(plain.exitCode, 0);
    assert.match(JSON.parse(plain.stdout).systemMessage, /broken\.js \(exit 1\)/);

    const joined = d.merge('PostToolUse', [
        r('a.js', 0, JSON.stringify({ systemMessage: 'from a', decision: 'block', reason: 'reason a' })),
        r('b.js', 0, JSON.stringify({ systemMessage: 'from b', decision: 'block', reason: 'reason b' }))
    ]);
    const out = JSON.parse(joined.stdout);
    assert.strictEqual(out.systemMessage, 'from a\nfrom b');
    assert.strictEqual(out.reason, 'reason a\nreason b');
    assert.strictEqual(out.decision, 'block');
    // No hook supplied a hookSpecificOutput, so none is invented.
    assert.strictEqual('hookSpecificOutput' in out, false);
});

test('nothing to say is a silent exit 0', () => {
    assert.deepStrictEqual(d.merge('PreToolUse', [r('a.js', 0, ''), r('b.js', 0, '  \n')]), { exitCode: 0, stdout: '', stderr: '' });
    assert.deepStrictEqual(d.merge('PreToolUse', []), { exitCode: 0, stdout: '', stderr: '' });
});

test('an exit-0 hook\'s stderr is kept in table order beside a failure\'s, and a block still carries only the blockers\'', () => {
    const quiet = d.merge('PostToolUse', [
        r('a.js', 0, '', 'a notes\n'),
        r('broken.js', 3, '', 'boom\n'),
        r('c.js', 0, hso({ additionalContext: 'c' }), 'c notes\n')
    ]);
    assert.strictEqual(quiet.exitCode, 0);
    assert.strictEqual(quiet.stderr, 'a notes\nboom\nc notes\n');
    assert.deepStrictEqual(d.merge('PostToolUse', [r('a.js', 0, '', 'a notes\n')]), { exitCode: 0, stdout: '', stderr: 'a notes\n' });

    const blocked = d.merge('PreToolUse', [r('a.js', 0, '', 'a notes\n'), r('guard.js', 2, '', 'Blocked: no\n')]);
    assert.deepStrictEqual(blocked, { exitCode: 2, stdout: '', stderr: 'Blocked: no\n' });
});

test('a top-level decision merges with block winning over any other value, whichever hook said it', () => {
    const approveFirst = d.merge('PostToolUse', [
        r('a.js', 0, JSON.stringify({ decision: 'approve', reason: 'fine by a' })),
        r('b.js', 0, JSON.stringify({ decision: 'block', reason: 'not by b' }))
    ]);
    assert.strictEqual(JSON.parse(approveFirst.stdout).decision, 'block');
    assert.strictEqual(JSON.parse(approveFirst.stdout).reason, 'fine by a\nnot by b');

    const blockFirst = d.merge('PostToolUse', [
        r('a.js', 0, JSON.stringify({ decision: 'block' })),
        r('b.js', 0, JSON.stringify({ decision: 'approve' }))
    ]);
    assert.strictEqual(JSON.parse(blockFirst.stdout).decision, 'block');

    const noBlock = d.merge('PostToolUse', [
        r('a.js', 0, JSON.stringify({ decision: 'approve' })),
        r('b.js', 0, JSON.stringify({ decision: 'defer' }))
    ]);
    assert.strictEqual(JSON.parse(noBlock.stdout).decision, 'approve', 'without a block the first value stands');
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

test('a threaded hook reads the environment as a child does, whatever case a variable is spelled in', async () => {
    // Windows spells the variable Path, and the process's environment object
    // answers to PATH all the same. A thread handed a plain copy would not.
    const dir = standIns({
        'env.js': READ + "process.stdout.write(JSON.stringify({ upper: typeof process.env.PATH, lower: typeof process.env.path === typeof process.env.PATH }));"
    });
    try {
        const threaded = await d.runThreaded(path.join(dir, 'env.js'), PAYLOAD, 20000);
        const child = await d.runChild(path.join(dir, 'env.js'), PAYLOAD, 20000);
        assert.strictEqual(JSON.parse(threaded.stdout).upper, 'string', 'PATH is readable from a thread');
        assert.strictEqual(threaded.stdout, child.stdout);
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

test('an answer too large for the thread\'s buffer is dropped and named, the hook is not run twice, and a block survives it', async () => {
    // The hook has run by the time its answer is found too large, so running it
    // again as a child would land its side effects twice. The counter file is
    // the side effect: one line per run.
    const dir = standIns({});
    const counter = path.join(dir, 'runs.txt').replace(/\\/g, '/');
    const big = "require('fs').appendFileSync('" + counter + "', 'ran\\n'); process.stdout.write('x'.repeat(1200000));";
    fs.writeFileSync(path.join(dir, 'big.js'), READ + big);
    fs.writeFileSync(path.join(dir, 'big-block.js'), READ + big + " process.stderr.write('Blocked: and oversize\\n'); process.exit(2);");
    try {
        const quiet = await d.dispatch('PreToolUse', ['big.js'], PAYLOAD, { hooksDir: dir });
        assert.strictEqual(quiet.exitCode, 1, 'an answer that could not be delivered is a failure, not a silent success');
        assert.strictEqual(quiet.stdout, '');
        assert.match(quiet.stderr, /big\.js: its answer was larger than \d+ bytes and was dropped/);
        assert.strictEqual(fs.readFileSync(counter, 'utf8'), 'ran\n', 'the hook ran once');

        const blocked = await d.dispatch('PreToolUse', ['big-block.js'], PAYLOAD, { hooksDir: dir });
        assert.strictEqual(blocked.exitCode, 2, 'the exit code is what carries a block, and it is kept');
        assert.match(blocked.stderr, /^Blocked: and oversize\n/);
        assert.strictEqual(fs.readFileSync(counter, 'utf8'), 'ran\nran\n');
    } finally {
        rmrf(dir);
    }
});

test('the process ends with its verdict on time when a hook\'s synchronous child call would outlast the deadline', () => {
    // A thread inside spawnSync cannot be interrupted: worker.terminate() and
    // process.exit() in the parent both wait for the child to return. A process
    // held that way outlives the harness's timeout, which the harness reads as
    // a hook that did not block, so a neighbour's block would be lost. The
    // bootstrap holds the synchronous spawns to the deadline, and this is that
    // cap observed: the child asks for 20 s and the process is gone long before.
    // The driver is a process of its own because its exit is what is asserted.
    const dir = standIns({
        'stuck.js': READ + "require('child_process').spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 20000)']);",
        'block.js': READ + "process.stderr.write('Blocked: on time\\n'); process.exit(2);",
        'driver.js': "const d = require(" + JSON.stringify(DISPATCH) + ");"
            + "d.dispatch('PreToolUse', ['stuck.js', 'block.js'], " + JSON.stringify(PAYLOAD) + ", { hooksDir: __dirname, deadlineMs: 1500 }).then(d.answer);"
    });
    try {
        const started = Date.now();
        const run = spawnSync(process.execPath, [path.join(dir, 'driver.js')], { encoding: 'utf8', timeout: 18000 });
        const elapsed = Date.now() - started;
        assert.strictEqual(run.error, undefined, 'the driver exited by itself rather than being killed at the test\'s timeout');
        assert.strictEqual(run.status, 2);
        assert.strictEqual(run.stderr, 'Blocked: on time\n');
        assert.ok(elapsed < 12000, 'exited in ' + elapsed + ' ms, well inside the stuck child\'s 20000');
    } finally {
        rmrf(dir);
    }
});

test('a hook\'s second synchronous child call gets only what is left of the deadline, so two calls cannot add up past it', () => {
    // The cap is taken per call from what remains. Held to the whole deadline
    // each, a 4100 ms call followed by a 10000 ms one would hold an 8000 ms
    // dispatch for about 12100 ms; held to what remains, the second is cut at
    // about 3900. Each child writes its own heartbeat to the log, which is
    // the sharp reading: the second child's lifetime is the cap it ran under,
    // read from evidence the child left rather than from the thread, which
    // the dispatcher may terminate before it could write anything after the
    // call. Both calls ask for timeout: 0, the uncapped spelling. The driver
    // is a process of its own because its exit is the coarse reading. The
    // figures leave the second child close to four seconds, so its own start
    // beats the cap even at the launch scatter this box shows under load.
    const dir = standIns({});
    const log = path.join(dir, 'beats.txt').replace(/\\/g, '/');
    const beat = (id, ms) => "const fs = require('fs'); const end = Date.now() + " + ms + ";"
        + "(function tick() { fs.appendFileSync('" + log + "', '" + id + " ' + Date.now() + '\\n'); if (Date.now() < end) setTimeout(tick, 100); })();";
    fs.writeFileSync(path.join(dir, 'twice.js'), READ
        + "const cp = require('child_process');"
        + "cp.spawnSync(process.execPath, ['-e', " + JSON.stringify(beat('first', 4100)) + "], { timeout: 0 });"
        + "cp.spawnSync(process.execPath, ['-e', " + JSON.stringify(beat('second', 10000)) + "], { timeout: 0 });");
    fs.writeFileSync(path.join(dir, 'driver.js'), "const d = require(" + JSON.stringify(DISPATCH) + ");"
        + "d.dispatch('PreToolUse', ['twice.js'], " + JSON.stringify(PAYLOAD) + ", { hooksDir: __dirname, deadlineMs: 8000 }).then(d.answer);");
    try {
        const started = Date.now();
        const run = spawnSync(process.execPath, [path.join(dir, 'driver.js')], { encoding: 'utf8', timeout: 40000 });
        const elapsed = Date.now() - started;
        assert.strictEqual(run.error, undefined, 'the driver exited by itself');
        const beats = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => l.split(' '));
        const span = (id) => {
            const times = beats.filter((b) => b[0] === id).map((b) => Number(b[1]));
            return times.length > 0 ? Math.max(...times) - Math.min(...times) : -1;
        };
        assert.ok(span('first') >= 3900, 'the first call ran to its own end: ' + span('first') + ' ms');
        assert.ok(span('second') >= 0 && span('second') < 6000,
            'the second call was cut at what remained rather than at the whole deadline: ' + span('second') + ' ms');
        assert.ok(elapsed < 8000 + 3000, 'exited in ' + elapsed + ' ms, inside the deadline plus a margin');
    } finally {
        rmrf(dir);
    }
});

test('a synchronous child call made without an args list keeps its options, in both legal spellings', async () => {
    // spawnSync(file, undefined, options) and execFileSync(file, null, options)
    // are node's own spellings for no arguments. A wrapper that read the
    // missing list as "the options are in its place" would drop the caller's
    // options, and the program on stdin with them: node reads its script from
    // stdin here, so an answer of "kept" is the options arriving whole.
    const dir = standIns({
        'noargs.js': READ + "const cp = require('child_process');"
            + "const a = cp.spawnSync(process.execPath, undefined, { input: 'process.stdout.write(\"kept\")', encoding: 'utf8', timeout: 5000 });"
            + "const b = cp.execFileSync(process.execPath, null, { input: 'process.stdout.write(\"kept too\")', encoding: 'utf8', timeout: 5000 });"
            + "process.stdout.write(JSON.stringify({ a: String(a.stdout), b: String(b) }));"
    });
    try {
        const m = await d.dispatch('PreToolUse', ['noargs.js'], PAYLOAD, { hooksDir: dir });
        assert.strictEqual(m.exitCode, 0, m.stderr);
        assert.deepStrictEqual(JSON.parse(m.stdout), { a: 'kept', b: 'kept too' });
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
        const child = await d.runChild(path.join(dir, 'async-throw.js'), PAYLOAD, 20000);
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

test('a thread that ends late without an answer hands its fallback only what is left of the deadline', async () => {
    // The stand-in sleeps 3500 ms on the thread, drops its exit listeners and
    // ends with its state word still 0, which sends it through a child. The
    // child runs the same file and sleeps the same 3500 ms, and is given the
    // 5000 ms deadline less what the thread spent, so it is cut off inside
    // the deadline with a budget under 1500 ms named. A fresh deadline would
    // let it answer at about 7000 ms as exit 0. The thread has 1500 ms of
    // slack to boot before the parent's timer would answer first.
    const dir = standIns({
        'late.js': READ + "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);"
            + "process.removeAllListeners('exit'); process.stdout.write('answered'); process.exit(0);"
    });
    try {
        const started = Date.now();
        const m = await d.dispatch('PreToolUse', ['late.js'], PAYLOAD, { hooksDir: dir, deadlineMs: 5000 });
        const elapsed = Date.now() - started;
        assert.strictEqual(m.exitCode, 1, 'the fallback was cut off: ' + JSON.stringify(m));
        assert.strictEqual(m.stdout, '');
        const budget = /late\.js: no answer within (\d+) ms/.exec(m.stderr);
        assert.ok(budget !== null, 'the fallback names the budget it ran under: ' + JSON.stringify(m.stderr));
        assert.ok(Number(budget[1]) > 0 && Number(budget[1]) < 1500, 'the budget is what remained: ' + budget[1] + ' ms');
        assert.ok(elapsed < 5000 + 1500, 'ended in ' + elapsed + ' ms, inside the deadline plus a margin');
    } finally {
        rmrf(dir);
    }
});

test('an exit-0 hook\'s stderr reaches the dispatcher\'s stderr from a thread as from a child', async () => {
    const dir = standIns({
        'notes.js': READ + "process.stderr.write('a note on exit 0\\n');",
        'one.js': ctx('one')
    });
    try {
        const threaded = await d.dispatch('PreToolUse', ['notes.js', 'one.js'], PAYLOAD, { hooksDir: dir });
        assert.strictEqual(threaded.exitCode, 0);
        assert.strictEqual(threaded.stderr, 'a note on exit 0\n');
        assert.strictEqual(JSON.parse(threaded.stdout).hookSpecificOutput.additionalContext, 'one');
        const legacy = await d.dispatch('PreToolUse', ['notes.js', 'one.js'], PAYLOAD, { hooksDir: dir, legacy: true });
        assert.deepStrictEqual(legacy, threaded);
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
    // A C# file the format-on-edit hook will find on disk, so its formatter
    // spawn runs, and whatever formatter is or is not installed answers the
    // same on both sides.
    fs.writeFileSync(path.join(proj, 'Probe.cs'), 'class Probe { }\n');
    // The store pair is what the grant hook reads as the fleet signals, under
    // which it allows its one memq invocation, and what the frontmatter guard
    // resolves the store through. The root names nothing real and is never
    // created, so a project-tier record under it is one the store does not
    // hold. The empty project pin keeps an ambient pin from taking the
    // project root away from the guard.
    const env = Object.assign({}, process.env, {
        HOME: home,
        USERPROFILE: home,
        CLAUDE_PLUGIN_ROOT: PLUGIN,
        KIT_MEMORY_ROOT: path.join(root, 'store'),
        KIT_MEMORY_ROOT_ALLOW_DATA: '1',
        KIT_MEMORY_PROJECT: ''
    });
    delete env.KIT_HOOK_DISPATCH;
    return { root, proj, env };
}

// A project-tier memory record under the fixture's store root, which is the
// tier the frontmatter guard checks at the write.
const memoryRecord = (f) => path.join(f.root, 'store', 'projects', 'hook-dispatch-probe', 'memory', 'probe.md');

const MEMQ = path.join(PLUGIN, 'scripts', 'memq.js');

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
    { label: 'Bash, a memq call the grant hook withholds', event: 'PreToolUse', tool: 'Bash', input: { command: 'memq find dispatcher' } },
    { label: 'Bash, the one memq call the grant hook allows', event: 'PreToolUse', tool: 'Bash',
        input: { command: 'node "' + MEMQ + '" recall' }, expectDecision: 'allow' },
    { label: 'PowerShell, quiet', event: 'PreToolUse', tool: 'PowerShell', input: { command: 'git status' } },
    { label: 'PowerShell, a read-only reviewer committing, which is blocked', event: 'PreToolUse', tool: 'PowerShell',
        input: { command: 'git commit -m x' }, extra: { agent_type: 'claude-kit:adversarial-reviewer' }, expectExit: 2 },
    { label: 'Write', event: 'PreToolUse', tool: 'Write', input: { file_path: 'notes.txt', content: 'x' } },
    { label: 'Write, a governed subagent writing a docs path, which is blocked', event: 'PreToolUse', tool: 'Write',
        input: { file_path: 'docs/plans/hook-dispatch-probe.md', content: 'x' },
        extra: { agent_type: 'claude-kit:adversarial-reviewer' }, expectExit: 2 },
    // The frontmatter guard's two answers: a deny on exit 2 through its stderr
    // write to descriptor 2, and the not-checked allow on exit 0 through its
    // JSON write to descriptor 1, which never touches process.stdout. The
    // record is not on disk, so the Edit cannot be applied and the guard says
    // so; the Write carries a pointer at a record the store does not hold.
    { label: 'Write, a project-tier memory record with a dangling supersedes, which the frontmatter guard blocks', event: 'PreToolUse', tool: 'Write',
        input: (f) => ({ file_path: memoryRecord(f), content: '---\nsupersedes: hook-dispatch-absent-record\n---\n\n# probe\n' }), expectExit: 2 },
    { label: 'Edit, a project-tier memory record not on disk, which the frontmatter guard allows unchecked and says so', event: 'PreToolUse', tool: 'Edit',
        input: (f) => ({ file_path: memoryRecord(f), old_string: 'x', new_string: 'y' }), expectContext: /^Not checked: / },
    { label: 'Edit, a C# file', event: 'PreToolUse', tool: 'Edit',
        input: (f) => ({ file_path: path.join(f.proj, 'Probe.cs'), old_string: 'Probe', new_string: 'Probed' }) },
    { label: 'Read', event: 'PreToolUse', tool: 'Read', input: { file_path: 'notes.txt' } },
    { label: 'a tool only the wildcard reaches', event: 'PreToolUse', tool: 'Glob', input: { pattern: '*.md' } },
    { label: 'Bash', event: 'PostToolUse', tool: 'Bash', input: { command: 'git status' } },
    { label: 'PowerShell', event: 'PostToolUse', tool: 'PowerShell', input: { command: 'git status' } },
    { label: 'Write', event: 'PostToolUse', tool: 'Write', input: { file_path: 'notes.txt', content: 'x' } },
    // The file is on disk, so the format-on-edit hook reaches its formatter
    // spawn, which is the capped synchronous call the bootstrap serves.
    { label: 'Edit, a C# file the formatter hook runs its spawn on', event: 'PostToolUse', tool: 'Edit',
        input: (f) => ({ file_path: path.join(f.proj, 'Probe.cs'), old_string: 'Probe', new_string: 'Probed' }) },
    { label: 'Read', event: 'PostToolUse', tool: 'Read', input: { file_path: 'notes.txt' } },
    { label: 'a tool only the wildcard reaches', event: 'PostToolUse', tool: 'Glob', input: { pattern: '*.md' } }
];

for (const c of CASES) {
    test('differential, ' + c.event + ' ' + c.label + ': the dispatcher answers as the hooks do one by one', () => {
        const a = fixture();
        const b = fixture();
        // An input that names a path is built per side, under that side's own
        // fixture, so neither side touches anything the other owns.
        const inputFor = (f) => (typeof c.input === 'function' ? c.input(f) : c.input);
        try {
            // Side A: the dispatcher, end to end, as the harness launches it.
            const payloadA = JSON.stringify(payloadFor(c.event, a.proj, c.tool, inputFor(a), c.extra));
            const run = spawnSync(process.execPath, [DISPATCH, c.event], {
                input: payloadA, cwd: a.proj, env: a.env, encoding: 'utf8', timeout: 60000
            });
            assert.strictEqual(run.error, undefined);

            // Side B: each selected hook as its own child process, which is what
            // hooks.json wired before, merged by the same rules.
            const payloadB = JSON.stringify(payloadFor(c.event, b.proj, c.tool, inputFor(b), c.extra));
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
            if (c.expectDecision !== undefined) {
                // The real grant, carried through the real merge: a case where a
                // routed hook has something to say, so equality above is not the
                // equality of two silences.
                assert.strictEqual(JSON.parse(run.stdout).hookSpecificOutput.permissionDecision, c.expectDecision);
            }
            if (c.expectContext !== undefined) {
                // A routed hook that answers through fs.writeSync(1): the text
                // is read back from the dispatcher's stdout, so equality above
                // is of an answer and not of two silences.
                assert.match(JSON.parse(run.stdout).hookSpecificOutput.additionalContext, c.expectContext);
            }
        } finally {
            rmrf(a.root);
            rmrf(b.root);
        }
    });
}

// ---------------------------------------------------------------------------
// The wiring, pinned across the two files that now hold it
// ---------------------------------------------------------------------------

test('hooks.json wires the dispatcher alone on both tool-use events, and the table names only hooks that exist', () => {
    const wiring = JSON.parse(fs.readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8'));
    for (const event of ['PreToolUse', 'PostToolUse']) {
        // A guard wired here beside the dispatcher would run twice where the
        // table also routes it, and would escape the table's pins where it does
        // not. One entry, one command, the event on the command line.
        const entries = wiring.hooks[event];
        assert.strictEqual(entries.length, 1, event + ' holds one entry');
        assert.ok(['*', '.*', '', undefined].includes(entries[0].matcher), event + ' reaches every tool');
        assert.strictEqual(entries[0].hooks.length, 1);
        assert.strictEqual(entries[0].hooks[0].command,
            'node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-dispatch.js" ' + event);

        const routed = d.selectHooks(d.readTable(d.TABLE_PATH, event), undefined);
        assert.ok(routed.length > 0, event + ' routes at least one hook');
        for (const name of routed) {
            assert.ok(fs.existsSync(path.join(HOOKS, name)), name + ' is named by the table and exists');
            assert.notStrictEqual(name, 'hook-dispatch.js', 'the dispatcher never routes to itself');
        }
    }
    // The table speaks for the two tool-use events and no other: an event
    // added to it would be routed by nothing, since hooks.json wires the
    // dispatcher on these two alone.
    const table = JSON.parse(fs.readFileSync(d.TABLE_PATH, 'utf8'));
    assert.deepStrictEqual(Object.keys(table.hooks).sort(), ['PostToolUse', 'PreToolUse']);
});

test('every real hook a Bash call routes to answers from its thread, not from the fallback', async () => {
    // The differential cases above compare two merged answers and would stay
    // green if every real hook fell back to a child process, which is the very
    // cost the dispatcher exists to remove. A null here is that fallback.
    const f = fixture();
    const saved = {};
    for (const key of ['HOME', 'USERPROFILE', 'CLAUDE_PLUGIN_ROOT', 'KIT_MEMORY_ROOT', 'KIT_MEMORY_ROOT_ALLOW_DATA']) {
        saved[key] = process.env[key];
        process.env[key] = f.env[key];
    }
    try {
        for (const event of ['PreToolUse', 'PostToolUse']) {
            const payload = JSON.stringify(payloadFor(event, f.proj, 'Bash', { command: 'git status' }));
            for (const name of d.selectHooks(d.readTable(d.TABLE_PATH, event), 'Bash')) {
                const result = await d.runThreaded(path.join(HOOKS, name), payload, 30000);
                assert.notStrictEqual(result, null, event + ' ' + name + ' answered from its thread');
                assert.strictEqual(result.code, 0, event + ' ' + name + ' exits 0 on a quiet call: ' + result.stderr);
            }
        }
    } finally {
        for (const key of Object.keys(saved)) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
        rmrf(f.root);
    }
});

test('an unusable routing table is named on stderr and the call is routed on the dispatcher\'s own copy, so a block still lands', () => {
    // The table is re-read on every call, so it can break under a running
    // session, where hooks.json is read once at session start. A copy of the
    // whole hooks directory, with the table broken three ways.
    const breaks = [
        (file) => fs.unlinkSync(file),
        (file) => fs.writeFileSync(file, '{ not json', 'utf8'),
        (file) => fs.writeFileSync(file, JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash(', hooks: [] }] } }), 'utf8')
    ];
    for (const breakIt of breaks) {
        const f = fixture();
        const copy = path.join(f.root, 'hooks');
        try {
            fs.cpSync(HOOKS, copy, { recursive: true });
            breakIt(path.join(copy, 'dispatch-table.json'));
            const payload = JSON.stringify(payloadFor('PreToolUse', f.proj, 'Bash',
                { command: 'git push origin main' }, { agent_type: 'claude-kit:blind-reviewer' }));
            const run = spawnSync(process.execPath, [path.join(copy, 'hook-dispatch.js'), 'PreToolUse'], {
                input: payload, cwd: f.proj, env: f.env, encoding: 'utf8', timeout: 60000
            });
            assert.strictEqual(run.status, 2, 'the read-only guard still blocks');
            assert.match(run.stderr, /routing table .* is unusable/);
            assert.match(run.stderr, /Blocked:/);
        } finally {
            rmrf(f.root);
        }
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
