// Tests for plugins/claude-kit/hooks/kit-version-nudge.js (the SessionStart
// build-drift warning).
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout: drift emits {"hookSpecificOutput":{additionalContext}}; every other
// path emits nothing. Each case owns a throwaway plugin root carrying a build
// stamp plus a throwaway temp dir for the per-session marker the hook pins
// (os.tmpdir() in the child reads TMPDIR, TEMP, and TMP), so the machine's real
// markers are never read or written.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-version-nudge.js');

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function stamp(root, hash) {
    fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude-plugin', 'build-info.json'),
        JSON.stringify({ name: 'claude-kit', hash, dirty: false }), 'utf8');
}

// process.env is spread rather than rebuilt so the child keeps its real PATH
// (a rebuilt env object loses the Windows `Path` key); extra is where a case
// adds the external-engine marker.
function runHook(root, temp, extra) {
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ session_id: 'version-nudge-test' }),
        encoding: 'utf8',
        env: {
            ...process.env,
            CLAUDE_PLUGIN_ROOT: root,
            TMPDIR: temp,
            TEMP: temp,
            TMP: temp,
            ...(extra || {})
        }
    });
}

// A session that pins one build and then meets another: the drift case, which
// is the only path that speaks.
function driftRun(extra) {
    const root = makeDir('version-nudge-root-');
    const temp = makeDir('version-nudge-temp-');
    try {
        stamp(root, 'aaaaaaa');
        const first = runHook(root, temp, extra);
        stamp(root, 'bbbbbbb');
        const second = runHook(root, temp, extra);
        return { first, second, markers: fs.readdirSync(temp) };
    } finally {
        rmDir(root);
        rmDir(temp);
    }
}

test('a session that meets a newer installed build is nudged to restart', () => {
    const { first, second } = driftRun();
    assert.strictEqual(first.status, 0);
    assert.strictEqual(first.stdout, '', 'the first sighting pins the build and stays silent');
    assert.strictEqual(second.status, 0);
    assert.match(second.stdout, /claude-kit version drift/);
    assert.match(second.stdout, /aaaaaaa/);
    assert.match(second.stdout, /bbbbbbb/);
});

test('a session still on the installed build stays silent', () => {
    const root = makeDir('version-nudge-root-');
    const temp = makeDir('version-nudge-temp-');
    try {
        stamp(root, 'aaaaaaa');
        runHook(root, temp);
        const again = runHook(root, temp);
        assert.strictEqual(again.status, 0);
        assert.strictEqual(again.stdout, '');
    } finally {
        rmDir(root);
        rmDir(temp);
    }
});

// Both directions of the external-engine marker. The attended direction is the
// case above; here the same drift must produce nothing, and no marker is pinned
// at all, since the hook stands down before it touches the temp dir.
test('under KIT_EXTERNAL_ENGINE build drift draws no nudge', () => {
    const { first, second, markers } = driftRun({ KIT_EXTERNAL_ENGINE: '1' });
    assert.strictEqual(first.status, 0);
    assert.strictEqual(first.stdout, '');
    assert.strictEqual(second.status, 0);
    assert.strictEqual(second.stdout, '', 'a headless worker cannot restart itself');
    assert.deepStrictEqual(markers, [], 'the stand-down pins no session marker');
});

test('a marker value other than 1 leaves the drift warning live', () => {
    const { second } = driftRun({ KIT_EXTERNAL_ENGINE: '0' });
    assert.strictEqual(second.status, 0);
    assert.match(second.stdout, /claude-kit version drift/);
});
