// Tests for plugins/claude-kit/hooks/hook-canary.js (the session-start hook canary).
//
// Node's built-in test runner, no framework (Node v24). The canary is spawned as
// a real child process with CLAUDE_PLUGIN_ROOT pointed at a plugin cache, and is
// asserted on by its stdout: a healthy cache says nothing at all, a broken one
// emits a SessionStart context block naming each failed probe. Every damaged-cache
// case runs against a throwaway copy of the real hooks under the OS temp dir, so
// the repo's own hooks are never modified, and each case asserts both directions:
// the broken hook is named AND the healthy ones are not, since a canary that
// flags everything is as useless as one that flags nothing.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CANARY = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'hook-canary.js');
const REAL_ROOT = path.join(__dirname, '..', 'plugins', 'claude-kit');
const REAL_HOOKS = path.join(REAL_ROOT, 'hooks');

// A throwaway plugin cache: the whole hooks directory, copied. The copy is
// recursive and complete (not just the files hooks.json wires) because
// kit-goal-stop.js requires kit-goal-lib.js, which no command string names.
function makeCache() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-canary-cache-'));
    fs.cpSync(REAL_HOOKS, path.join(dir, 'hooks'), { recursive: true });
    return dir;
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function hookFile(cache, name) {
    return path.join(cache, 'hooks', name);
}

function runCanary(root) {
    return spawnSync(process.execPath, [CANARY], {
        input: '',
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: root }
    });
}

// The warning text the canary injected, or null when it stayed silent.
function warning(res) {
    if (!res.stdout) return null;
    return JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
}

// The per-probe failure lines inside a warning.
function failureLines(text) {
    return text.split('\n').filter((l) => l.startsWith('  - '));
}

// Assert the warning names exactly the expected failures and nothing else: the
// listed hooks appear, every other wired hook does not.
function assertOnlyFlagged(text, flagged) {
    const lines = failureLines(text);
    assert.strictEqual(lines.length, flagged.length,
        'expected exactly ' + flagged.length + ' failure line(s), got:\n' + lines.join('\n'));
    for (const f of flagged) {
        assert.ok(lines.some((l) => l.includes(f.hook) && l.includes(f.probe)),
            'expected a line naming ' + f.hook + ' / ' + f.probe + ', got:\n' + lines.join('\n'));
    }
    const others = ['docs-write-guard.js', 'readonly-agent-guard.js', 'kit-goal-stop.js',
        'merged-pr-push-guard.js', 'pr-docs-guard.js', 'session-start.js', 'doctrine-refresh.js']
        .filter((h) => !flagged.some((f) => f.hook === h));
    for (const h of others) {
        assert.ok(!text.includes(h), 'a healthy hook must not be named: ' + h);
    }
}

test('the real installed hooks are healthy: exit 0, no output', () => {
    const res = runCanary(REAL_ROOT);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stdout, '', 'a healthy cache is silent');
    assert.strictEqual(res.stderr, '');
});

test('an untouched copy of the cache is healthy too (the fixture harness itself is sound)', () => {
    const cache = makeCache();
    try {
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        assert.strictEqual(res.stdout, '', 'a faithful copy must be as silent as the original');
    } finally {
        rmDir(cache);
    }
});

test('a guard stubbed to allow everything fails its deny probe, and only that probe', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(hookFile(cache, 'docs-write-guard.js'),
            "'use strict';\nprocess.exit(0);\n", 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0, 'the canary always exits 0');
        const text = warning(res);
        assert.ok(text, 'an inert guard must not be silent');
        assertOnlyFlagged(text, [{ hook: 'docs-write-guard.js', probe: 'deny probe' }]);
        assert.match(text, /expected exit 2, got exit 0/);
    } finally {
        rmDir(cache);
    }
});

test('a guard stubbed to deny everything fails its allow probe (the other direction)', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(hookFile(cache, 'readonly-agent-guard.js'),
            "'use strict';\nprocess.exit(2);\n", 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'a guard that blocks reads must not be silent');
        assertOnlyFlagged(text, [{ hook: 'readonly-agent-guard.js', probe: 'allow probe' }]);
        assert.match(text, /expected exit 0, got exit 2/);
    } finally {
        rmDir(cache);
    }
});

test('a PR guard stubbed to deny a benign command fails its plumbing probe', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(hookFile(cache, 'merged-pr-push-guard.js'),
            "'use strict';\nprocess.exit(2);\n", 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'a guard denying benign commands must not be silent');
        assertOnlyFlagged(text, [{ hook: 'merged-pr-push-guard.js', probe: 'plumbing probe' }]);
    } finally {
        rmDir(cache);
    }
});

test('the goal leash stubbed to never block fails the leash probe', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(hookFile(cache, 'kit-goal-stop.js'),
            "'use strict';\nprocess.exit(0);\n", 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'a dead leash must not be silent');
        assertOnlyFlagged(text, [{ hook: 'kit-goal-stop.js', probe: 'leash probe' }]);
    } finally {
        rmDir(cache);
    }
});

test('the goal leash stubbed to always block fails the release probe (the other direction)', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(hookFile(cache, 'kit-goal-stop.js'),
            "'use strict';\nprocess.stdout.write(JSON.stringify({ decision: 'block', reason: 'x' }));\n",
            'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'a leash that blocks with no goal armed must not be silent');
        assertOnlyFlagged(text, [{ hook: 'kit-goal-stop.js', probe: 'release probe' }]);
    } finally {
        rmDir(cache);
    }
});

test('a hook module its require() depends on, deleted, fails both goal probes (a load check cannot see this)', () => {
    // kit-goal-lib.js is not wired in hooks.json, so no load check covers it and
    // `node --check` on kit-goal-stop.js still passes: only running the hook
    // catches the broken module graph.
    const cache = makeCache();
    try {
        fs.rmSync(hookFile(cache, 'kit-goal-lib.js'));
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'a hook whose dependency is gone must not be silent');
        assertOnlyFlagged(text, [
            { hook: 'kit-goal-stop.js', probe: 'leash probe' },
            { hook: 'kit-goal-stop.js', probe: 'release probe' }
        ]);
    } finally {
        rmDir(cache);
    }
});

test('a syntax-broken hook file fails its load check, and is not behavior-probed on top', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(hookFile(cache, 'docs-write-guard.js'),
            "'use strict';\nfunction broken( {\n", 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'an unparseable hook must not be silent');
        assertOnlyFlagged(text, [{ hook: 'docs-write-guard.js', probe: 'load check' }]);
        assert.match(text, /node --check accepts the file/);
    } finally {
        rmDir(cache);
    }
});

test('a deleted hook file is reported as missing from the cache', () => {
    const cache = makeCache();
    try {
        fs.rmSync(hookFile(cache, 'readonly-agent-guard.js'));
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'a missing hook file must not be silent');
        assertOnlyFlagged(text, [{ hook: 'readonly-agent-guard.js', probe: 'load check' }]);
        assert.match(text, /the wired hook file present in the cache/);
    } finally {
        rmDir(cache);
    }
});

test('a plugin root that does not exist warns and still exits 0', () => {
    const res = runCanary(path.join(os.tmpdir(), 'hook-canary-no-such-cache'));
    assert.strictEqual(res.status, 0);
    const text = warning(res);
    assert.ok(text, 'a cache the canary cannot find is a broken install, not an internal error');
    assert.match(text, /hooks\.json/);
    assert.match(text, /missing or unparseable/);
});

test('an unparseable hooks.json is itself a canary failure', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(path.join(cache, 'hooks', 'hooks.json'), '{ not json', 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'unreadable wiring means no kit hooks at all');
        assertOnlyFlagged(text, [{ hook: 'hooks.json', probe: 'hook wiring' }]);
    } finally {
        rmDir(cache);
    }
});

test('a hooks.json that parses but wires nothing is a canary failure', () => {
    const cache = makeCache();
    try {
        fs.writeFileSync(path.join(cache, 'hooks', 'hooks.json'), '{ "hooks": {} }', 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'wiring no hooks is as broken as wiring none readably');
        assertOnlyFlagged(text, [{ hook: 'hooks.json', probe: 'hook wiring' }]);
        assert.match(text, /no hook commands wired/);
    } finally {
        rmDir(cache);
    }
});

test('a hooks.json that parses but holds the wrong shape is a canary failure, not silence', () => {
    // Valid JSON in a shape the walk cannot traverse wires no kit hooks either,
    // so it belongs on the loud side of the boundary with an unparseable file.
    const shapes = [
        '{ "hooks": { "SessionStart": {} } }',
        '{ "hooks": { "PreToolUse": [ { "hooks": 7 } ] } }'
    ];
    for (const shape of shapes) {
        const cache = makeCache();
        try {
            fs.writeFileSync(path.join(cache, 'hooks', 'hooks.json'), shape, 'utf8');
            const res = runCanary(cache);
            assert.strictEqual(res.status, 0, 'the canary always exits 0');
            const text = warning(res);
            assert.ok(text, 'a cache whose wiring holds no hooks must not be silent: ' + shape);
            assertOnlyFlagged(text, [{ hook: 'hooks.json', probe: 'hook wiring' }]);
            assert.match(text, /missing or unparseable/);
        } finally {
            rmDir(cache);
        }
    }
});

test('a hooks.json that no longer wires a probed guard names that guard', () => {
    // Wiring that drops a guard is a session running without it, which must not
    // read as health just because the canary then has nothing to probe.
    const cache = makeCache();
    try {
        const wiringPath = path.join(cache, 'hooks', 'hooks.json');
        const wiring = JSON.parse(fs.readFileSync(wiringPath, 'utf8'));
        wiring.hooks.PreToolUse = wiring.hooks.PreToolUse.filter((entry) =>
            !entry.hooks.some((h) => h.command.includes('docs-write-guard.js')));
        fs.writeFileSync(wiringPath, JSON.stringify(wiring, null, 2), 'utf8');
        const res = runCanary(cache);
        assert.strictEqual(res.status, 0);
        const text = warning(res);
        assert.ok(text, 'a guard the wiring dropped must not be silent');
        assertOnlyFlagged(text, [{ hook: 'docs-write-guard.js', probe: 'hook wiring' }]);
        assert.match(text, /expected wired in hooks\.json/);
    } finally {
        rmDir(cache);
    }
});

test('the canary probes the cache it is pointed at, leaving no fixture behind', () => {
    // The kit-goal-stop probe builds a goal fixture under the OS temp dir; it
    // must clean up after itself rather than accumulating one per session start.
    // The child's temp dir is one this test owns (os.tmpdir() reads TMPDIR, TEMP,
    // and TMP), so the fixture lands there and a canary running concurrently
    // elsewhere on this machine cannot be mistaken for a leak.
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-canary-temp-'));
    try {
        const res = spawnSync(process.execPath, [CANARY], {
            input: '',
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_PLUGIN_ROOT: REAL_ROOT, TMPDIR: temp, TEMP: temp, TMP: temp }
        });
        assert.strictEqual(res.status, 0);
        assert.strictEqual(res.stdout, '', 'the real cache is healthy, so the goal probe ran and passed');
        assert.deepStrictEqual(fs.readdirSync(temp), [],
            'the goal-probe fixture is removed after the probe');
    } finally {
        rmDir(temp);
    }
});
