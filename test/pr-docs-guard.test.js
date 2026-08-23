// Tests for plugins/claude-kit/hooks/pr-docs-guard.js (the PreToolUse guard
// that blocks creating a PR while docs/ still has uncommitted changes).
//
// Node's built-in test runner, no framework. The guard is spawned as a real
// child process, fed a PreToolUse payload on stdin, and asserted on by its
// exit code: 2 blocks the PR create, 0 allows it, with stderr carrying
// "Blocked:" on a deny. Each case builds a throwaway git repo (and, for the
// multi-checkout cases, a linked worktree) under os.tmpdir(), cleaned up in a
// finally block, so the guard's real git plumbing runs against disposable
// state rather than this repo's own.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync, execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GUARD = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'pr-docs-guard.js');

// Spawn the guard with `payload` (JSON-encoded) on stdin. Returns
// { code, stdout, stderr }.
function runGuard(payload, opts) {
    const options = opts || {};
    const res = spawnSync(process.execPath, [GUARD], {
        input: JSON.stringify(payload),
        cwd: options.cwd,
        env: options.env || process.env,
        encoding: 'utf8',
        timeout: 20000
    });
    return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function mkTmp(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmrf(dir) {
    // Windows keeps read-only handles on .git pack files briefly after use, so
    // retry rather than strand the temp dir.
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* best effort */ }
}

// Initialize a real (throwaway) git repo with one commit and an optional origin.
function initGitRepo(dir, remoteUrl) {
    const opts = { cwd: dir, stdio: 'ignore' };
    execSync('git init -q', opts);
    execSync('git config user.email t@example.com', opts);
    execSync('git config user.name tester', opts);
    execSync('git config commit.gpgsign false', opts);
    fs.writeFileSync(path.join(dir, 'README.md'), 'seed\n');
    execSync('git add README.md', opts);
    execSync('git commit -qm init', opts);
    if (remoteUrl) execSync('git remote add origin ' + remoteUrl, opts);
}

// Main tree with dirty docs/ plus a clean linked worktree on `feature`.
// Returns { main, wt, wtParent }; caller cleans up both temp roots.
function makeWorktreeFixture() {
    const main = mkTmp('prd-wt-main-');
    const wtParent = mkTmp('prd-wt-dir-');
    const wt = path.join(wtParent, 'wt');
    initGitRepo(main, 'https://github.com/example/repo.git');
    fs.mkdirSync(path.join(main, 'docs'));
    fs.writeFileSync(path.join(main, 'docs', 'plan.md'), 'uncommitted\n');
    execSync('git worktree add -q -b feature "' + wt + '"', { cwd: main, stdio: 'ignore' });
    return { main, wt, wtParent };
}

test('pr-docs-guard: dirty docs/ + gh pr create -> deny', () => {
    const repo = mkTmp('prd-dirty-');
    try {
        initGitRepo(repo, 'https://github.com/example/repo.git');
        fs.mkdirSync(path.join(repo, 'docs'));
        fs.writeFileSync(path.join(repo, 'docs', 'plan.md'), 'uncommitted\n');
        const r = runGuard({
            tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' }, cwd: repo
        }, { cwd: repo });
        assert.strictEqual(r.code, 2, r.stderr);
        assert.match(r.stderr, /Blocked:/);
    } finally {
        rmrf(repo);
    }
});

test('pr-docs-guard: clean docs/ + gh pr create -> allow', () => {
    const repo = mkTmp('prd-clean-');
    try {
        initGitRepo(repo, 'https://github.com/example/repo.git');
        const r = runGuard({
            tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' }, cwd: repo
        }, { cwd: repo });
        assert.strictEqual(r.code, 0, r.stderr);
    } finally {
        rmrf(repo);
    }
});

test('pr-docs-guard: cd into clean worktree ahead of pr create -> allow despite dirty main tree', () => {
    const { main, wt, wtParent } = makeWorktreeFixture();
    try {
        for (const command of [
            'cd "' + wt + '" && gh pr create --fill',
            "Set-Location '" + wt + "'; gh pr create --fill"
        ]) {
            const r = runGuard({
                tool_name: 'Bash', tool_input: { command }, cwd: main
            }, { cwd: main });
            assert.strictEqual(r.code, 0, command + '\n' + r.stderr);
        }
    } finally {
        rmrf(main);
        rmrf(wtParent);
    }
});

test('pr-docs-guard: cd still checks the target: dirty worktree docs -> deny', () => {
    const { main, wt, wtParent } = makeWorktreeFixture();
    try {
        fs.mkdirSync(path.join(wt, 'docs'));
        fs.writeFileSync(path.join(wt, 'docs', 'plan.md'), 'uncommitted\n');
        const r = runGuard({
            tool_name: 'Bash', tool_input: { command: 'cd "' + wt + '" && gh pr create --fill' }, cwd: main
        }, { cwd: main });
        assert.strictEqual(r.code, 2, r.stderr);
    } finally {
        rmrf(main);
        rmrf(wtParent);
    }
});

test('pr-docs-guard: cd to an unresolvable target -> allow (effective directory unknowable)', () => {
    const repo = mkTmp('prd-cd-bad-');
    try {
        initGitRepo(repo, 'https://github.com/example/repo.git');
        fs.mkdirSync(path.join(repo, 'docs'));
        fs.writeFileSync(path.join(repo, 'docs', 'plan.md'), 'uncommitted\n');
        for (const command of [
            'cd "$WORKTREE" && gh pr create --fill',
            'cd ' + path.join(repo, 'no-such-dir') + ' && gh pr create --fill'
        ]) {
            const r = runGuard({
                tool_name: 'Bash', tool_input: { command }, cwd: repo
            }, { cwd: repo });
            assert.strictEqual(r.code, 0, command + '\n' + r.stderr);
        }
    } finally {
        rmrf(repo);
    }
});

test('pr-docs-guard: dirty docs/ parked on the default branch -> allow; on a feature branch -> deny', () => {
    const repo = mkTmp('prd-default-');
    try {
        initGitRepo(repo, 'https://github.com/example/repo.git');
        const opts = { cwd: repo, stdio: 'ignore' };
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        execSync('git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/' + branch, opts);
        fs.mkdirSync(path.join(repo, 'docs'));
        fs.writeFileSync(path.join(repo, 'docs', 'plan.md'), 'uncommitted\n');

        const payload = { tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' }, cwd: repo };
        const onDefault = runGuard(payload, { cwd: repo });
        assert.strictEqual(onDefault.code, 0, onDefault.stderr);

        execSync('git checkout -q -b feature', opts);
        const onFeature = runGuard(payload, { cwd: repo });
        assert.strictEqual(onFeature.code, 2, onFeature.stderr);
    } finally {
        rmrf(repo);
    }
});
