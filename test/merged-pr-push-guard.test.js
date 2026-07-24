// Tests for plugins/claude-kit/hooks/merged-pr-push-guard.js (the PreToolUse
// push guard for branches whose PR already merged).
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a PreToolUse payload on stdin, and asserted on by its
// exit code: 2 blocks the push, 0 allows it. The host CLI is faked with a gh
// shim (a script that always reports MERGED) prepended to PATH, so the block
// path is reachable without network or auth. Each case builds a fresh temp
// git repo with a github.com origin URL, cleaned up in finally blocks.

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
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function git(cwd, args) {
    return execSync('git ' + args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// A repo on branch main with one commit and a github.com origin URL (never
// fetched; the guard only reads the URL to pick its host CLI).
function makeRepo() {
    const dir = makeDir('push-guard-test-');
    git(dir, 'init -b main');
    git(dir, '-c user.name=t -c user.email=t@t commit --allow-empty -m init');
    git(dir, 'remote add origin https://github.com/example/repo.git');
    return dir;
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

function runHook(cwd, command, shimDir) {
    const env = Object.assign({}, process.env);
    if (shimDir) env.PATH = shimDir + path.delimiter + env.PATH;
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd, tool_input: { command } }),
        encoding: 'utf8',
        env
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

test('a push to an integration branch is never guarded', () => {
    const repo = makeRepo();
    const shim = makeGhShim();
    try {
        const r = runHook(repo, 'git push origin main', shim);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stderr, '');
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
