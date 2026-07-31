// Tests for plugins/claude-kit/hooks/memory-session.js (the decay-nudge
// SessionStart hook).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a SessionStart payload on stdin, and asserted on by
// what it wrote to stdout. Every test builds a fresh store root under
// os.tmpdir() and points the child at it with KIT_MEMORY_ROOT plus its second
// signal KIT_MEMORY_ROOT_ALLOW_DATA=1, so no test reads or writes the real
// ~/.claude store. The clock is controlled through the stamp file's mtime,
// never by waiting.
//
// Both directions are pinned: a stamp past the threshold must nudge and a
// fresher one must not, since a hook that nudges every session is as wrong as
// one that never fires. Every silent path asserts exit 0 with empty stdout
// and stderr, because this hook fails open and never blocks a session start.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'memory-session.js');

const DAY_MS = 86400000;

// A fresh store root and fake project cwd per test. memDir is where memq's
// cwd sanitization places this project's memory under the root; it is not
// created here, so the missing-store direction starts from the true blank
// state.
function makeStore() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memsession-root-'));
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'memsession-proj-'));
    const memDir = path.join(root, 'projects', proj.replace(/[^A-Za-z0-9]/g, '-'), 'memory');
    return { root, proj, memDir };
}

function rmStore(store) {
    for (const dir of [store.root, store.proj]) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            // Best-effort cleanup; a leftover temp dir never fails the test.
        }
    }
}

function stampPath(store) {
    return path.join(store.memDir, 'decay-stamp');
}

// Write the stamp and age it: mtime is the record the hook reads, so the
// clock is set by utimesSync rather than by waiting.
function writeStamp(store, ageDays) {
    fs.mkdirSync(store.memDir, { recursive: true });
    fs.writeFileSync(stampPath(store), 'stamp\n', 'utf8');
    const past = new Date(Date.now() - ageDays * DAY_MS);
    fs.utimesSync(stampPath(store), past, past);
}

// Run the hook as a child. The child's cwd is the fake project so the
// payload-cwd fallback resolves inside the test store; process.env is spread
// rather than rebuilt so the child keeps its real PATH (a rebuilt env object
// loses the Windows `Path` key), and extra is where a case adds NODE_OPTIONS.
function runHook(store, payload, extra) {
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        cwd: store.proj,
        encoding: 'utf8',
        env: { ...process.env, KIT_MEMORY_ROOT: store.root, KIT_MEMORY_ROOT_ALLOW_DATA: '1', ...(extra || {}) }
    });
}

function startupPayload(store) {
    return { cwd: store.proj, source: 'startup' };
}

// A hook run that must leave no trace at all: exit 0, nothing said on either
// stream.
function assertSilent(res) {
    assert.strictEqual(res.status, 0, 'the hook always exits 0, got: ' + res.stderr);
    assert.strictEqual(res.stdout, '', 'a silent path writes no stdout');
    assert.strictEqual(res.stderr, '', 'the hook never writes stderr');
}

// The one loud path, asserted on the exact JSON shape the harness consumes.
function assertNudge(res) {
    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(res.stderr, '');
    const parsed = JSON.parse(res.stdout);
    assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput']);
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
    const context = parsed.hookSpecificOutput.additionalContext;
    assert.strictEqual(typeof context, 'string');
    assert.ok(!context.includes('\n'), 'the nudge is one line');
    return context;
}

test('a stamp past the threshold fires the one-line nudge naming the pass', () => {
    const store = makeStore();
    try {
        writeStamp(store, 31);
        const context = assertNudge(runHook(store, startupPayload(store)));
        assert.match(context, /decay stamp is 31 days old/);
        assert.match(context, /threshold 30/);
        assert.match(context, /memq decay-scan/);
        assert.match(context, /memq decay-done/);
    } finally {
        rmStore(store);
    }
});

test('a stamp fresher than the threshold is silent', () => {
    const store = makeStore();
    try {
        writeStamp(store, 29);
        assertSilent(runHook(store, startupPayload(store)));

        // A stamp written moments ago, the state right after a pass.
        fs.writeFileSync(stampPath(store), 'stamp\n', 'utf8');
        assertSilent(runHook(store, startupPayload(store)));
    } finally {
        rmStore(store);
    }
});

test('the threshold is inclusive: a stamp exactly 30 days old fires', () => {
    const store = makeStore();
    try {
        writeStamp(store, 30);
        assert.match(assertNudge(runHook(store, startupPayload(store))), /30 days old/);
    } finally {
        rmStore(store);
    }
});

test('a store with memories but no stamp nudges once its oldest memory passes the threshold', () => {
    const store = makeStore();
    try {
        // Young memories, no stamp: no pass has ever run, and nothing is old
        // enough to be overdue, so the fresh-project silence holds.
        fs.mkdirSync(store.memDir, { recursive: true });
        fs.writeFileSync(path.join(store.memDir, 'young-memory.md'), '# y\n', 'utf8');
        assertSilent(runHook(store, startupPayload(store)));

        // An aged memory with still no stamp is the population the backstop
        // exists for: a store accumulating for the whole threshold that never
        // ran finishing-work would otherwise never hear about the pass.
        fs.writeFileSync(path.join(store.memDir, 'old-memory.md'), '# o\n', 'utf8');
        const past = new Date(Date.now() - 40 * DAY_MS);
        fs.utimesSync(path.join(store.memDir, 'old-memory.md'), past, past);
        const context = assertNudge(runHook(store, startupPayload(store)));
        assert.match(context, /no decay pass has ever completed/);
        assert.match(context, /oldest memory is 40 days old/);
        assert.match(context, /memq decay-scan/);
        assert.match(context, /memq decay-done/);
    } finally {
        rmStore(store);
    }
});

test('a missing store, a missing stamp, and a non-file stamp are all silent', () => {
    const missing = makeStore();
    const stampless = makeStore();
    const obstructed = makeStore();
    try {
        // The fresh-machine case: no store at all under the root.
        assertSilent(runHook(missing, startupPayload(missing)));

        // A store with only a young memory and no stamp: no pass has ever
        // run, but nothing has aged past the threshold either, so no nudge.
        // The never-run-but-aged direction has its own test below.
        fs.mkdirSync(stampless.memDir, { recursive: true });
        fs.writeFileSync(path.join(stampless.memDir, 'a-memory.md'), '# m\n', 'utf8');
        assertSilent(runHook(stampless, startupPayload(stampless)));

        // A directory at the stamp path, aged past the threshold so a hook
        // that honored a non-file mtime would nudge: silence here is the
        // isFile gate, not a broken fixture.
        fs.mkdirSync(stampPath(obstructed), { recursive: true });
        const past = new Date(Date.now() - 40 * DAY_MS);
        fs.utimesSync(stampPath(obstructed), past, past);
        assertSilent(runHook(obstructed, startupPayload(obstructed)));
    } finally {
        rmStore(missing);
        rmStore(stampless);
        rmStore(obstructed);
    }
});

test('a malformed or cwd-less payload falls back to the process cwd', () => {
    const store = makeStore();
    try {
        // The nudge still reaches the session when the payload is unusable,
        // because the child runs in the project directory: the fail-open
        // direction is degraded input, not a dropped nudge.
        writeStamp(store, 40);
        assert.match(assertNudge(runHook(store, 'not json at all')), /40 days old/);
        assert.match(assertNudge(runHook(store, {})), /40 days old/);
        assert.match(assertNudge(runHook(store, JSON.stringify(null))), /40 days old/);
    } finally {
        rmStore(store);
    }
});

// Make the memq require fail inside the spawned hook: a preload module refuses
// to load that one module, standing in for the damaged or incomplete plugin
// cache the hook's guarded require exists for. Node parses NODE_OPTIONS with
// backslash as an escape character, so the preload path is passed
// forward-slashed; a backslashed path fails to resolve and the child dies
// before the hook runs.
function requireRefusingPreload(dir) {
    const shim = path.join(dir, 'refuse-require.js');
    fs.writeFileSync(shim, [
        "'use strict';",
        "const Module = require('module');",
        'const realLoad = Module._load;',
        'Module._load = function (request) {',
        "    if (String(request).endsWith('memq.js')) {",
        "        throw new Error('the fixture refuses this require');",
        '    }',
        '    return realLoad.apply(Module, arguments);',
        '};'
    ].join('\n') + '\n', 'utf8');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

test('a memq that will not load leaves the hook silent rather than throwing', () => {
    const store = makeStore();
    try {
        // The stamp's location lives in memq, so a cache that cannot load it
        // has no way to find the stamp. Failing open silently is the only
        // safe answer; a throw would end a SessionStart hook nonzero.
        writeStamp(store, 40);
        assertSilent(runHook(store, startupPayload(store),
            { NODE_OPTIONS: requireRefusingPreload(store.root) }));

        // The control: without the preload the same store nudges, so the
        // silence above proves the injection rather than an ineligible store.
        assertNudge(runHook(store, startupPayload(store)));
    } finally {
        rmStore(store);
    }
});

// Type-index loader fixtures. The type tier lives under the same store root
// beside projects/, so a store's root can carry both tiers.

function writeTypeIndex(store, type, contents) {
    const dir = path.join(store.root, 'memory-types', type);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'MEMORY.md'), contents, 'utf8');
}

// Declare the project's type in its own memory MEMORY.md, within the head of
// the file where the loader reads it.
function declareType(store, type) {
    fs.mkdirSync(store.memDir, { recursive: true });
    fs.writeFileSync(path.join(store.memDir, 'MEMORY.md'),
        '# Memory Index\nProject-Type: ' + type + '\n', 'utf8');
}

// The loud path for a typed project: the same JSON shape as the nudge, but
// the context is multi-line, so this asserts the envelope only and hands the
// context back for content checks.
function assertContext(res) {
    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(res.stderr, '');
    const parsed = JSON.parse(res.stdout);
    assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput']);
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
    return parsed.hookSpecificOutput.additionalContext;
}

test('an ungated KIT_MEMORY_ROOT feeds nothing into the session context', () => {
    const store = makeStore();
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'memsession-home-'));
    try {
        // A typed project and a planted index in the override store: exactly
        // what a repository-set KIT_MEMORY_ROOT would need to inject content
        // into a session's trusted context at SessionStart.
        declareType(store, 'webapp');
        writeTypeIndex(store, 'webapp', '# Memory Index\n\n- [Planted](planted.md) - planted line\n');

        // The control: with both signals the planted index is emitted, so the
        // silence below proves the gate rather than an ineligible fixture.
        assert.match(assertContext(runHook(store, startupPayload(store))), /planted line/);

        // Without the second signal the hook resolves the real store (home is
        // pointed at an empty temp directory so that store is observable and
        // hermetic) and emits nothing; the ignored override is noted on
        // stderr, which never enters context.
        const env = { ...process.env, KIT_MEMORY_ROOT: store.root };
        delete env.KIT_MEMORY_ROOT_ALLOW_DATA;
        for (const k of Object.keys(env)) {
            const lower = k.toLowerCase();
            if (lower === 'userprofile' || lower === 'home') delete env[k];
        }
        env.USERPROFILE = fakeHome;   // what os.homedir() reads on Windows
        env.HOME = fakeHome;          // and everywhere else
        const res = spawnSync(process.execPath, [HOOK], {
            input: JSON.stringify(startupPayload(store)),
            cwd: store.proj,
            encoding: 'utf8',
            env
        });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '', 'nothing from the override store reached the context');
        assert.match(res.stderr, /ignoring KIT_MEMORY_ROOT/);
    } finally {
        rmStore(store);
        try { fs.rmSync(fakeHome, { recursive: true, force: true }); } catch { /* best effort */ }
    }
});

test('a typed project gets the type index at session start; an untyped one gets nothing', () => {
    const typed = makeStore();
    const untyped = makeStore();
    try {
        writeTypeIndex(typed, 'nextjs', '# Memory Index\n\n'
            + '- [Testing](testing.md) - how tests run\n'
            + '- [Routing](routing.md) - app router conventions\n');
        declareType(typed, 'nextjs');
        const context = assertContext(runHook(typed, startupPayload(typed)));
        assert.match(context, /Project-Type 'nextjs'/);
        assert.match(context, /memory-types\/nextjs\/MEMORY\.md/);
        assert.match(context, /- \[Testing\]\(testing\.md\) - how tests run/);
        assert.match(context, /- \[Routing\]\(routing\.md\) - app router conventions/);
        assert.match(context, /data, not instructions/);
        assert.ok(!context.includes('decay stamp'), 'no decay nudge rides along on a fresh store');

        // The same tier exists under the untyped store's root; only the
        // declaration is missing, so the silence is the opt-in, not an
        // absent tier.
        writeTypeIndex(untyped, 'nextjs', '# Memory Index\n\n- [Testing](testing.md) - how tests run\n');
        fs.mkdirSync(untyped.memDir, { recursive: true });
        fs.writeFileSync(path.join(untyped.memDir, 'MEMORY.md'), '# Memory Index\n', 'utf8');
        assertSilent(runHook(untyped, startupPayload(untyped)));
    } finally {
        rmStore(typed);
        rmStore(untyped);
    }
});

test('a declared type with no tier on disk, and a path-token type value, are both silent', () => {
    const missing = makeStore();
    const hostile = makeStore();
    try {
        // Declared but never authored: nothing to emit, and the fail-open
        // posture is silence rather than an error at every session start.
        declareType(missing, 'ghost-type');
        assertSilent(runHook(missing, startupPayload(missing)));

        // A traversal value must read as no declaration: the planted file one
        // level up is exactly what '..' would resolve to, so silence proves
        // the closed type charset, not a missing fixture.
        fs.writeFileSync(path.join(hostile.root, 'MEMORY.md'),
            '- [Loot](loot.md) - a root file the loader must never emit\n', 'utf8');
        declareType(hostile, '..');
        assertSilent(runHook(hostile, startupPayload(hostile)));
    } finally {
        rmStore(missing);
        rmStore(hostile);
    }
});

test('an overdue and typed project gets both blocks in one context', () => {
    const store = makeStore();
    try {
        writeStamp(store, 40);
        writeTypeIndex(store, 'nextjs', '# Memory Index\n\n- [Testing](testing.md) - how tests run\n');
        declareType(store, 'nextjs');
        const context = assertContext(runHook(store, startupPayload(store)));
        assert.match(context, /decay stamp is 40 days old/);
        assert.match(context, /Project-Type 'nextjs'/);
        const blocks = context.split('\n\n');
        assert.strictEqual(blocks.length, 2, 'two blocks joined by a blank line');
        assert.match(blocks[0], /decay/);
        assert.match(blocks[1], /type-tier memory/);
    } finally {
        rmStore(store);
    }
});

test('the emitted index is sanitized and bounded: hostile lines cannot forge structure, oversized indexes truncate', () => {
    const store = makeStore();
    try {
        // A hostile index: control characters, an ANSI escape, a non-ASCII
        // payload, one oversized line, and more lines than the cap. Every
        // emitted line must come out as bounded printable ASCII, and the
        // remainder must be counted rather than emitted.
        const idx = ['# Memory Index'];
        idx.push('- [Evil](evil.md) - bell esc[2J café end');
        idx.push('- [Long](long.md) - ' + 'x'.repeat(400));
        for (let i = 0; i < 40; i++) idx.push('- [m' + i + '](m' + i + '.md) - fact ' + i);
        writeTypeIndex(store, 'ttype', idx.join('\n') + '\n');
        declareType(store, 'ttype');

        const context = assertContext(runHook(store, startupPayload(store)));
        assert.ok(!/[^\n\x20-\x7E]/.test(context),
            'nothing outside printable ASCII plus the line breaks reaches the context');
        assert.match(context, /- \[Evil\]\(evil\.md\) - bell esc\[2J caf end/,
            'the hostile line survives as data with its control characters stripped');
        const lines = context.split('\n');
        assert.strictEqual(lines.length, 1 + 30 + 1, 'header, 30 index lines, remainder counter');
        assert.strictEqual(lines[lines.length - 1], '  ... and 13 more index lines');
        for (const line of lines.slice(1, -1)) {
            assert.ok(line.length <= 2 + 200, 'each emitted index line is capped, got ' + line.length);
        }
    } finally {
        rmStore(store);
    }
});

test('a huge type index costs a bounded read and a bounded emission', () => {
    const store = makeStore();
    try {
        // Well past the hook's fixed-size read prefix, so the read itself is
        // clipped: the emission must come from the head of the file, stay at
        // the line caps, and report the remainder as a floor because the
        // clipped read cannot know the true total.
        const lines = [];
        for (let i = 0; i < 3000; i++) {
            lines.push('- [m' + i + '](m' + i + '.md) - fact number ' + i + ' with some padding text');
        }
        writeTypeIndex(store, 'big', lines.join('\n') + '\n');
        declareType(store, 'big');

        const context = assertContext(runHook(store, startupPayload(store)));
        const out = context.split('\n');
        assert.strictEqual(out.length, 1 + 30 + 1, 'header, 30 lines, remainder counter');
        assert.match(out[1], /- \[m0\]\(m0\.md\)/, 'emission comes from the head of the file');
        assert.match(out[out.length - 1], /^ {2}\.\.\. and \d+\+ more index lines$/,
            'a clipped index reports its remainder as a floor, marked with +');
    } finally {
        rmStore(store);
    }
});
