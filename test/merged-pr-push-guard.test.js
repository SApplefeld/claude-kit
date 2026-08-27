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
// The same file as a module. It runs the guard only under require.main, so
// requiring it here reads its rules and guards no push.
const guard = require('../plugins/claude-kit/hooks/merged-pr-push-guard.js');
const NO_DEADLINE_VAR = 'KIT_MERGED_PR_GUARD_NO_DEADLINE';
const NO_DEADLINE_SIGNAL = 'KIT_MERGED_PR_GUARD_NO_DEADLINE_ALLOW';

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

// A bound on the whole spawn, well clear of anything a healthy run takes. It is
// a flat number because the hook's queries no longer carry one to derive from:
// every case below runs them with no deadline at all.
const SPAWN_TIMEOUT_MS = 90000;

// deadlineOpts shapes the two switch variables in the child's environment:
//   undefined            the switch on, with its signal, which is what a case
//                        wants unless the variables are its subject
//   { none: true }       neither variable, the configuration a real user runs
//   { value, signal }    exactly those values, with signal: null omitting it
//
// The pair is deleted from the copied environment first, matched without regard
// to case: Windows environment lookup is case-insensitive while a plain-object
// copy is not, so an ambient `kit_merged_pr_guard_no_deadline` would survive a
// delete of the upper-case key and still reach the child. This is the rule
// scrubRunEnv follows in test/memq.test.js.
function runHook(cwd, command, shimDir, toolName, deadlineOpts) {
    const env = Object.assign({}, process.env);
    for (const k of Object.keys(env)) {
        if (k.toUpperCase() === NO_DEADLINE_VAR || k.toUpperCase() === NO_DEADLINE_SIGNAL) delete env[k];
    }
    const opts = deadlineOpts || {};
    if (!opts.none) {
        env[NO_DEADLINE_VAR] = opts.value === undefined ? '1' : opts.value;
        if (opts.signal !== null) env[NO_DEADLINE_SIGNAL] = opts.signal === undefined ? '1' : opts.signal;
    }
    // Whatever else the case wants the child to inherit, set last so a case
    // about the ambient environment can plant exactly what it is about.
    Object.assign(env, opts.extraEnv || {});
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
    const r = spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env,
        timeout: SPAWN_TIMEOUT_MS
    });
    // A spawn the harness killed or never started returns null for both status
    // and stderr, so every assertion downstream would read a hard failure as a
    // wrong exit code with nothing to say about it. Fail here instead, where
    // the cause still has a name.
    assert.strictEqual(r.error, undefined,
        'the hook must run to completion; spawn reported: ' + (r.error && r.error.message));
    return r;
}

// The same run with extra variables planted in the child's environment, for the
// cases whose subject is what the hook inherits.
function runHookWithEnv(cwd, command, shimDir, extraEnv) {
    return runHook(cwd, command, shimDir, null, { extraEnv });
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

// What an allowed push must not have said. Exact emptiness is not the pin,
// because it reds for an ambient NODE_OPTIONS warning that says nothing about
// the guard and is not this suite's to control. Two absences instead, for the
// two things this hook writes, plus a positive constraint on whatever is left:
// every remaining line must be one of the ambient shapes named here, so a new
// unexpected write on the allow path is still caught rather than tolerated for
// not matching the two patterns above.
const AMBIENT_STDERR = /^(?:\(node:\d+\)|Warning:|\s*at\s|ExperimentalWarning|debugger|Debugger)/;

function assertAllowedQuietly(r) {
    assert.doesNotMatch(r.stderr, /already merged/, 'an allowed push carries no denial text');
    assert.doesNotMatch(r.stderr, /merged-pr-push-guard:/, 'and no diagnostic of the guard\'s own');
    const unexplained = r.stderr.split('\n').map((l) => l.trim())
        .filter((l) => l && !AMBIENT_STDERR.test(l));
    assert.deepStrictEqual(unexplained, [],
        'an allowed push writes nothing of its own; unexplained stderr: ' + JSON.stringify(r.stderr));
}

// The fail-open contract, which is what the block case above is the other half
// of: the guard blocks only a positively confirmed merge, so every way a query
// can fail ends in an allowed push. A host CLI that answers nonzero drives it
// deterministically, and it drives the same branch a timeout would: sh lets
// execSync throw, and prState's single catch returns UNKNOWN for a nonzero
// exit, an ETIMEDOUT and an ENOENT alike, so no timing is needed to reach it.
test('a host query that exits nonzero fails open, with the host reached', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        // The recorder prints MERGED and then fails, so the guard holds an
        // answer it cannot trust. The recorder file is what separates this
        // from an allow decided before the host was ever asked.
        const recFile = makeRecorder(shim, 'MERGED', 3);
        const r = runHook(repo, 'git push origin feature/valid-1.0', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assertAllowedQuietly(r);
        assert.ok(fs.existsSync(recFile), 'the host CLI was reached');
    } finally { rmDir(repo); rmDir(shim); }
});

// The shipped configuration, with neither switch variable present. Every other
// spawned case turns the deadline off, so without this one the production
// budgets are never executed end to end at all. Only the allow direction is
// covered here, and deliberately: an allow is what every query failure
// produces, so contention can make this case slower and can never make it red,
// while the same case asserting a block would be a bet on the box finishing
// four queries inside 8000 ms, which is the load-sensitive shape this file
// exists to retire.
test('the shipped budgets allow an unmerged branch with no override present', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim);
        // Empty host output is UNKNOWN, which allows; the recorder proves the
        // query ran under the shipped budgets rather than being skipped.
        const r = runHook(repo, 'git push origin feature/valid-1.0', shim, null, { none: true });
        assert.strictEqual(r.status, 0, r.stderr);
        assertAllowedQuietly(r);
        assert.ok(fs.existsSync(recFile), 'the host CLI was reached');
    } finally { rmDir(repo); rmDir(shim); }
});

test('the switch without its signal is ignored, and the hook says so', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim);
        // The switch set to the value that would be honored with the signal,
        // offered without it. The note is the observable proof it was not
        // honored, and it rides an allow, which is load-independent: this
        // asserts nothing about a block. It also exercises the note's own
        // delivery, a synchronous write to fd 2 immediately before the exit.
        const r = runHook(repo, 'git push origin feature/valid-1.0', shim, null,
            { value: '1', signal: null });
        assert.strictEqual(r.status, 0, r.stderr);
        assert.match(r.stderr, /ignoring KIT_MERGED_PR_GUARD_NO_DEADLINE/);
        assert.match(r.stderr, /KIT_MERGED_PR_GUARD_NO_DEADLINE_ALLOW=1/);
        assert.ok(fs.existsSync(recFile), 'the host CLI was still reached');
    } finally { rmDir(repo); rmDir(shim); }
});

// The switch's own rules, read in-process from the hook's exported functions.
// Nothing here spawns: the decision is not a process boundary. Each case builds
// the environment it asks about, so none of them reads or mutates this
// process's own, and queryBudgetMs returns its reason rather than latching it,
// so calling it here leaves nothing behind either.
function deadlineEnv(value, allow) {
    const env = {};
    if (value !== undefined) env[NO_DEADLINE_VAR] = value;
    if (allow !== undefined) env[NO_DEADLINE_SIGNAL] = allow;
    return env;
}

test('the no-deadline switch is honored only alongside its allow signal, and only then', () => {
    // Honored: both variables at the kit's override predicate, an exact '1'.
    assert.deepStrictEqual(guard.budgetOverride(deadlineEnv('1', '1')),
        { off: true, reason: 'honored' });
    assert.deepStrictEqual(guard.queryBudgetMs(3000, deadlineEnv('1', '1')),
        { ms: 0, reason: 'honored' });
    assert.deepStrictEqual(guard.queryBudgetMs(undefined, deadlineEnv('1', '1')),
        { ms: 0, reason: 'honored' });

    // Asked for and refused, which is the state that owes a note.
    for (const allow of [undefined, '0', '', 'true', 'yes', '11']) {
        assert.deepStrictEqual(guard.budgetOverride(deadlineEnv('1', allow)),
            { off: false, reason: 'unsignalled' },
            'signal ' + JSON.stringify(allow) + ' must not honor the switch');
    }

    // Not asked for at all. A value that is not '1' is not a request, so
    // NO_DEADLINE=0 reads as nothing rather than as a refused something.
    for (const value of [undefined, '0', '', 'true', 'yes', 'nonsense', '1 ']) {
        assert.deepStrictEqual(guard.budgetOverride(deadlineEnv(value, '1')),
            { off: false, reason: 'unset' },
            'value ' + JSON.stringify(value) + ' must not be a request');
    }
    assert.deepStrictEqual(guard.budgetOverride({}), { off: false, reason: 'unset' });

    // Unhonored, whichever rule refused it, every query keeps exactly the
    // budget production gives it: the caller's own, or 8000 for the host query
    // that names none.
    for (const env of [{}, deadlineEnv('1'), deadlineEnv('0', '1'), deadlineEnv(undefined, '1')]) {
        assert.strictEqual(guard.queryBudgetMs(3000, env).ms, 3000, JSON.stringify(env));
        assert.strictEqual(guard.queryBudgetMs(undefined, env).ms, 8000, JSON.stringify(env));
    }
});

// The one line that is the whole fix is `timeout: budget.ms` at the sh call
// site, and every behavioural case in this file passes with that line reverted
// to a bare literal, because the switch only ever removes a deadline nothing in
// the suite is slow enough to hit. A source scan is what catches that class:
// it asserts the wiring exists rather than the behaviour it produces. The
// control below builds the reverted source as a string and runs the same scan
// over it, so the scan is proven able to fail without editing the shipped file.
function budgetWiring(src) {
    const sh = /function sh\([\s\S]*?\n}/.exec(src);
    return {
        found: sh !== null,
        callsQueryBudget: sh !== null && /queryBudgetMs\(timeout\)/.test(sh[0]),
        passesResult: sh !== null && /timeout:\s*budget\.ms/.test(sh[0]),
        latchesReason: sh !== null && /budget\.reason === 'unsignalled'/.test(sh[0])
    };
}

test('the query budget is wired into the execSync call, and the scan that says so can fail', () => {
    const src = fs.readFileSync(HOOK, 'utf8');
    assert.deepStrictEqual(budgetWiring(src),
        { found: true, callsQueryBudget: true, passesResult: true, latchesReason: true });

    // The same scan over a source that dropped the wiring. Both mutations are
    // shapes a careless edit produces, and neither changes any behaviour this
    // suite can observe.
    const noCall = src.replace(/timeout:\s*budget\.ms/, 'timeout: 8000');
    assert.notStrictEqual(noCall, src, 'the mutation must have applied');
    assert.strictEqual(budgetWiring(noCall).passesResult, false,
        'the scan must fail when the computed budget is not the one passed');
    // [^\n]* rather than .*, because this file is CRLF and a JS dot excludes
    // the carriage return along with the newline.
    const noLatch = src.replace(/if \(budget\.reason === 'unsignalled'\)[^\n]*\n/, '');
    assert.notStrictEqual(noLatch, src, 'the mutation must have applied');
    assert.strictEqual(budgetWiring(noLatch).latchesReason, false,
        'the scan must fail when the ignored-switch note is never owed');
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
        assertAllowedQuietly(r);
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
        assertAllowedQuietly(r);
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
// (so a test can tell whether the host CLI was ever reached), prints `output`
// (empty by default) to stdout, and exits with `exitCode` (0 by default, so a
// case can drive the guard's query-failure path with the host still reached).
function makeRecorder(dir, output, exitCode) {
    const recFile = path.join(dir, 'invoked.log');
    const out = output || '';
    const code = exitCode || 0;
    if (process.platform === 'win32') {
        let body = '@echo off\r\n>>"' + recFile + '" echo %*\r\n';
        if (out) body += 'echo ' + out + '\r\n';
        if (code) body += 'exit /b ' + code + '\r\n';
        fs.writeFileSync(path.join(dir, 'gh.cmd'), body);
        fs.writeFileSync(path.join(dir, 'az.cmd'), body);
    } else {
        let body = '#!/bin/sh\necho "$@" >> "' + recFile + '"\n';
        if (out) body += 'echo "' + out + '"\n';
        if (code) body += 'exit ' + code + '\n';
        for (const name of ['gh', 'az']) {
            const f = path.join(dir, name);
            fs.writeFileSync(f, body);
            fs.chmodSync(f, 0o755);
        }
    }
    return recFile;
}

// Each command yields the named branch after the guard's own parsing; the
// allowlist must reject it before any host query fires. Every one of these
// reaches the branch token whole, because none of the characters carrying the
// injection is a command separator.
const injectionCases = [
    { name: 'feat/x*glob', cmd: 'git push origin feat/x*glob' },
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

// The command shapes a push can arrive in. Each of these puts `git push` at a
// real command position, so each must be guarded; a guard that does not see the
// push is skipped in silence, with no output to say a decision was declined.
// The first three are shapes a model writes routinely, and the multi-line one
// most of all. Asserted through the whole hook rather than at the parser, so a
// pass means the block reached the exit code.
for (const [shape, command] of [
    ['a second line', 'echo starting\ngit push origin feature-x'],
    ['a subshell', '(git push origin feature-x)'],
    ['a background separator', 'echo starting & git push origin feature-x'],
    ['an && chain', 'echo starting && git push origin feature-x'],
    ['a semicolon chain', 'echo starting; git push origin feature-x'],
    ['a pipeline tail', 'git push origin feature-x | tee out.log']
]) {
    test('a merged branch is blocked when the push arrives after ' + shape, () => {
        const repo = makeRepo();
        const shim = makeGhShim();
        try {
            git(repo, 'branch feature-x');
            const r = runHook(repo, command, shim);
            assert.strictEqual(r.status, 2,
                'this push was not guarded at all: ' + JSON.stringify(command)
                + '; stderr: ' + r.stderr);
            assert.match(r.stderr, /already merged/);
        } finally { rmDir(repo); rmDir(shim); }
    });
}

// A trailing command after a semicolon is a second command, not part of the
// branch name. Reading it as part of the branch is what the allowlist then
// rejects, and a rejected branch is UNKNOWN, which allows: the push of a merged
// branch goes through unguarded because of what someone appended after it. The
// shell runs `git push origin feature-x` here whatever follows the semicolon,
// so the guard must judge feature-x and block.
test('a command chained after the push does not smuggle the branch past the guard', () => {
    const repo = makeRepo();
    const shim = makeGhShim();
    try {
        git(repo, 'branch feature-x');
        const r = runHook(repo, 'git push origin feature-x;echo appended', shim);
        assert.strictEqual(r.status, 2,
            'the branch must be read as feature-x, not as feature-x;echo appended; stderr: '
            + r.stderr);
        assert.match(r.stderr, /already merged/);
    } finally { rmDir(repo); rmDir(shim); }
});

// The delete exemption belongs to the push, not to the rest of the line. A
// later command carrying its own -d (ls -d, rm -d, sort -d) is not a branch
// deletion, and reading it as one skips the guard on a real push.
test('a -d belonging to a later command is not read as a branch deletion', () => {
    const repo = makeRepo();
    const shim = makeGhShim();
    try {
        git(repo, 'branch feature-x');
        const r = runHook(repo, 'git push origin feature-x && ls -d .', shim);
        assert.strictEqual(r.status, 2,
            'a later -d must not exempt this push; stderr: ' + r.stderr);
        assert.match(r.stderr, /already merged/);
    } finally { rmDir(repo); rmDir(shim); }
});

// And the exemption still holds for the push's own flags, which is the
// behaviour the case above must not have traded away.
test('the push\'s own --delete still exempts it, with a later command present', () => {
    const repo = makeRepo();
    const shim = makeDir('mpr-rec-');
    try {
        const recFile = makeRecorder(shim, 'MERGED');
        const r = runHook(repo, 'git push --delete origin feature-x && echo done', shim);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.ok(!fs.existsSync(recFile), 'a deletion must not reach the host CLI');
    } finally { rmDir(repo); rmDir(shim); }
});

// Every fact this guard decides on comes from a git read, so a GIT_* variable
// in the ambient environment must not reach those reads. GIT_DIR is the
// sharpest of them: pointed at another repository it answers with that
// repository's origin URL and HEAD, so a branch with a merged PR would be
// judged against a repo that knows nothing about it. Here the decoy repo has no
// origin at all, which would make the origin read fail and the guard allow;
// stripping GIT_DIR is what keeps the block.
test('an ambient GIT_DIR cannot redirect the queries the decision rests on', () => {
    const repo = makeRepo();
    const decoy = makeDir('mpr-decoy-');
    const shim = makeGhShim();
    try {
        git(decoy, 'init -b main');
        git(decoy, '-c user.name=t -c user.email=t@t commit --allow-empty -m init');
        git(repo, 'branch feature-x');
        const r = runHookWithEnv(repo, 'git push origin feature-x', shim,
            { GIT_DIR: path.join(decoy, '.git') });
        assert.strictEqual(r.status, 2,
            'an ambient GIT_DIR redirected the guard\'s git reads; stderr: ' + r.stderr);
        assert.match(r.stderr, /already merged/);
    } finally { rmDir(repo); rmDir(decoy); rmDir(shim); }
});
