// Tests for plugins/claude-kit/hooks/merged-pr-push-guard.js (the PreToolUse
// push guard for branches whose PR already merged).
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a PreToolUse payload on stdin, and asserted on by its
// exit code: 2 blocks the push, 0 allows it. The host CLI is faked by one of
// two PATH-prepended shims, so both paths are reachable without network or
// auth: a gh shim that always reports MERGED, for the block path, and a
// recorder shim for gh and az that logs every invocation and prints only what
// a case asks it to, so a test can assert the host CLI was never reached.
// Each case builds its own temp git repo, with a github.com or a dev.azure.com
// origin URL as the case needs, cleaned up in finally blocks.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync, execSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'merged-pr-push-guard.js');

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    // Windows keeps read-only handles on .git pack files briefly after use, so
    // retry rather than strand the temp dir.
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* best effort */ }
}

function git(cwd, args) {
    return execSync('git ' + args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// A repo on branch main with one commit and `remoteUrl` as its origin (never
// fetched; the guard only reads the URL to pick its host CLI).
function makeRepoWithOrigin(remoteUrl) {
    const dir = makeDir('push-guard-test-');
    git(dir, 'init -b main');
    git(dir, '-c user.name=t -c user.email=t@t commit --allow-empty -m init');
    git(dir, 'remote add origin ' + remoteUrl);
    return dir;
}

// The github.com case, which is most of them.
function makeRepo() {
    return makeRepoWithOrigin('https://github.com/example/repo.git');
}

// A PATH-prepended gh shim that reports every PR as MERGED, so the guard's
// block path is reachable deterministically.
function makeGhShim() {
    const dir = makeDir('gh-shim-');
    fs.writeFileSync(path.join(dir, 'gh.cmd'), '@echo MERGED\r\n');
    const sh = path.join(dir, 'gh');
    fs.writeFileSync(sh, '#!/bin/sh\necho MERGED\n');
    try { fs.chmodSync(sh, 0o755); } catch { /* Windows: the .cmd carries it */ }
    return dir;
}

function runHook(cwd, command, shimDir, toolName) {
    const env = Object.assign({}, process.env);
    if (shimDir) {
        // Prepend under the parent's real key casing: on Windows the copied key
        // is usually "Path", so assigning env.PATH creates a second variable
        // holding "<shim>;undefined" and the child loses the original PATH.
        const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
        env[pathKey] = shimDir + path.delimiter + env[pathKey];
    }
    const payload = { cwd, tool_input: { command } };
    // The guard never reads tool_name. Cases that pass one are pinning that
    // fact, so the field has to reach the payload rather than the test name.
    if (toolName) payload.tool_name = toolName;
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env,
        timeout: 20000
    });
}

test('a push to a branch with a merged PR is blocked', () => {
    const repo = makeRepo();
    const shim = makeGhShim();
    try {
        git(repo, 'branch feature-x');
        const r = runHook(repo, 'git push origin feature-x', shim);
        assert.strictEqual(r.status, 2);
        assert.match(r.stderr, /already merged/);
    } finally { rmDir(repo); rmDir(shim); }
});

test('a push to an integration branch is never guarded, and never reaches the host', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        // The recorder reports MERGED, so a host query reaching it would block.
        // Allowing is therefore only correct if the query never fires at all,
        // which is what the recorder's absence proves.
        const recFile = makeRecorder(shim, 'MERGED');
        const r = runHook(repo, 'git push origin main', shim);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stderr, '');
        assert.ok(!fs.existsSync(recFile), 'integration branch must not reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});

test('a push to the configured default branch (origin/HEAD) is never guarded', () => {
    const repo = makeRepo();
    const shim = makeGhShim();
    try {
        git(repo, 'branch trunk');
        git(repo, 'update-ref refs/remotes/origin/trunk HEAD');
        git(repo, 'symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/trunk');
        const r = runHook(repo, 'git push origin trunk', shim);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stderr, '');
    } finally { rmDir(repo); rmDir(shim); }
});

test('with origin/HEAD unset the same branch is still guarded', () => {
    const repo = makeRepo();
    const shim = makeGhShim();
    try {
        git(repo, 'branch trunk');
        const r = runHook(repo, 'git push origin trunk', shim);
        assert.strictEqual(r.status, 2);
        assert.match(r.stderr, /already merged/);
    } finally { rmDir(repo); rmDir(shim); }
});

// A PATH-prepended shim for gh and az that appends its invocation to a log file
// (so a test can tell whether the host CLI was ever reached) and prints `output`
// (empty by default) to stdout.
function makeRecorder(dir, output) {
    const recFile = path.join(dir, 'invoked.log');
    const out = output || '';
    if (process.platform === 'win32') {
        let body = '@echo off\r\n>>"' + recFile + '" echo %*\r\n';
        if (out) body += 'echo ' + out + '\r\n';
        fs.writeFileSync(path.join(dir, 'gh.cmd'), body);
        fs.writeFileSync(path.join(dir, 'az.cmd'), body);
    } else {
        let body = '#!/bin/sh\necho "$@" >> "' + recFile + '"\n';
        if (out) body += 'echo "' + out + '"\n';
        for (const name of ['gh', 'az']) {
            const f = path.join(dir, name);
            fs.writeFileSync(f, body);
            fs.chmodSync(f, 0o755);
        }
    }
    return recFile;
}

// Each command yields the named branch after the guard's own parsing; the
// allowlist must reject it before any host query fires.
const injectionCases = [
    { name: 'feat/x;calc.exe', cmd: 'git push origin feat/x;calc.exe' },
    { name: '$(whoami)', cmd: 'git push origin $(whoami)' },
    { name: '`whoami`', cmd: 'git push origin `whoami`' },
    { name: '--upload-pack=x', cmd: 'git push origin HEAD:--upload-pack=x' }
];

for (const c of injectionCases) {
    for (const tool of ['Bash', 'PowerShell']) {
        test('injection branch ' + c.name + ' exits 0 without host call [' + tool + ']', () => {
            const repo = makeRepo();
            const shim = makeDir('mpr-rec-');
            try {
                const recFile = makeRecorder(shim);
                const r = runHook(repo, c.cmd, shim, tool);
                assert.strictEqual(r.status, 0, r.stderr);
                assert.ok(!fs.existsSync(recFile), 'host CLI recorder must be untouched');
            } finally { rmDir(repo); rmDir(shim); }
        });
    }
}

test('valid branch reaches the host query', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim);
        // Empty shim output -> UNKNOWN -> allow (exit 0), but the host WAS reached.
        const r = runHook(repo, 'git push origin feature/valid-1.0', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.ok(fs.existsSync(recFile), 'valid branch should reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});

test('branch deletion exits 0 without host call', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim);
        const r = runHook(repo, 'git push --delete origin somebranch', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.ok(!fs.existsSync(recFile), 'deletion must not reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});

test('non-push command exits 0 without host call', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim);
        const r = runHook(repo, 'git status', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.ok(!fs.existsSync(recFile), 'non-push must not reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});

test('a quoted branch name reaches the host query', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim);
        const r = runHook(repo, 'git push origin "feat/x"', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.ok(fs.existsSync(recFile), 'quoted valid branch should reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});

test('force-delete refspec +:dst is treated as deletion (no host call)', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim);
        const r = runHook(repo, 'git push origin +:feat/gone', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.ok(!fs.existsSync(recFile), 'deletion must not reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});

test('completed Azure DevOps PR blocks the push', () => {
    // az emits a non-empty tsv row for a completed PR; any non-empty output qualifies.
    const repo = makeRepoWithOrigin('https://dev.azure.com/org/proj/_git/repo');
    const shim = makeDir('mpr-rec-');
    try {
        makeRecorder(shim, 'MERGED');
        const r = runHook(repo, 'git push origin feature/valid-1.0', shim);
        assert.strictEqual(r.status, 2, r.stderr);
        assert.match(r.stderr, /already merged/);
    } finally { rmDir(repo); rmDir(shim); }
});

test('a force refspec with a MERGED PR blocks', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        makeRecorder(shim, 'MERGED');
        const r = runHook(repo, 'git push origin +feat/x', shim);
        assert.strictEqual(r.status, 2, r.stderr);
        assert.match(r.stderr, /already merged/);
    } finally { rmDir(repo); rmDir(shim); }
});

test('bare git push resolves HEAD and flows through the allowlist to the host', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        git(repo, 'checkout -q -b feature/head-branch');
        const recFile = makeRecorder(shim);
        // Empty shim output -> UNKNOWN -> allow, but the resolved HEAD branch reached the host.
        const r = runHook(repo, 'git push', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.ok(fs.existsSync(recFile), 'resolved HEAD branch should reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});
