// Tests for plugins/claude-kit/hooks/branch-reaper-nudge.js (the SessionStart
// branch-hygiene trigger).
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout: a nudge emits {"hookSpecificOutput":{additionalContext}}; silence
// emits nothing. Each case builds a fresh temp git repo with hand-made
// remote-tracking refs (no network; FETCH_HEAD is touched so the hook skips
// its fetch), all cleaned up in finally blocks.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync, execSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'branch-reaper-nudge.js');

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function git(cwd, args) {
    return execSync('git ' + args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// A repo on branch main with one commit, origin/main as the integration ref,
// and a fresh FETCH_HEAD so the hook's fetch is skipped.
function makeRepo() {
    const dir = makeDir('reaper-test-');
    git(dir, 'init -b main');
    git(dir, '-c user.name=t -c user.email=t@t commit --allow-empty -m init');
    git(dir, 'update-ref refs/remotes/origin/main HEAD');
    fs.writeFileSync(path.join(dir, '.git', 'FETCH_HEAD'), '');
    return dir;
}

// process.env is spread rather than rebuilt so the child keeps its real PATH
// (a rebuilt env object loses the Windows `Path` key); extra is where a case
// adds the external-engine marker.
function runHook(cwd, extra) {
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd }),
        encoding: 'utf8',
        env: { ...process.env, ...(extra || {}) }
    });
}

test('a merged local branch is surfaced as reapable', () => {
    const dir = makeRepo();
    try {
        git(dir, 'branch feature-x');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /1 local branch\(es\) merged into origin\/main are reapable/);
    } finally { rmDir(dir); }
});

test('the configured default branch (origin/HEAD) is protected, not reapable', () => {
    const dir = makeRepo();
    try {
        git(dir, 'branch trunk');
        git(dir, 'update-ref refs/remotes/origin/trunk HEAD');
        git(dir, 'symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/trunk');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});

test('with origin/HEAD unset the same branch is still reapable', () => {
    const dir = makeRepo();
    try {
        git(dir, 'branch trunk');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /reapable/);
    } finally { rmDir(dir); }
});

test('a repo with no extra branches stays silent', () => {
    const dir = makeRepo();
    try {
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});

// Both directions of the external-engine marker. The same fixture that nudges
// an attended session must stay silent under the marker, and the attended
// direction is the expensive one to get wrong: a stand-down that leaks into
// normal use removes the hygiene trigger with no signal.
test('under KIT_EXTERNAL_ENGINE a reapable branch draws no nudge', () => {
    const dir = makeRepo();
    try {
        git(dir, 'branch feature-x');
        const r = runHook(dir, { KIT_EXTERNAL_ENGINE: '1' });
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '', 'a fleet worker cannot run the branch-hygiene skill');
    } finally { rmDir(dir); }
});

test('a marker value other than 1 leaves the nudge live', () => {
    const dir = makeRepo();
    try {
        git(dir, 'branch feature-x');
        const r = runHook(dir, { KIT_EXTERNAL_ENGINE: '0' });
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /reapable/);
    } finally { rmDir(dir); }
});
