// Tests for the parked-handoff inventory in
// plugins/claude-kit/hooks/session-start.js.
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout: a .kit/parked/ holding one or more handoff files emits the
// parked-handoff block inside {"hookSpecificOutput":{additionalContext}}; no
// handoff at all emits nothing. Each case builds a fresh temp dir. Like the
// backlog block, no kit-repo marker is required: the block fires in any
// project, since an ad-hoc session can park anywhere.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');

function makeProject() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'parked-handoff-test-'));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// The hook runs against the fixture and nothing else on this machine. See the
// sibling backlog and kaizen suites for why each of these is pointed at the
// fixture: the home pair (what os.homedir() reads), the plugin root and the
// external-engine marker in every casing Windows carries them in, and every
// GIT_* variable. process.env is spread rather than rebuilt so the child keeps
// its real PATH, which a rebuilt object loses on Windows.
function runHook(cwd) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^(USERPROFILE|HOME|KIT_EXTERNAL_ENGINE|CLAUDE_PLUGIN_ROOT)$/i.test(k)) delete env[k];
        if (/^GIT_/i.test(k)) delete env[k];
    }
    const home = path.join(cwd, 'fixture-home');
    fs.mkdirSync(home, { recursive: true });
    env.USERPROFILE = home;
    env.HOME = home;
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd }),
        encoding: 'utf8',
        env
    });
}

test('a parked handoff shows its path, a written-when phrase, and the read-first instruction', () => {
    // The positive case, and the control every silent case below leans on: it
    // proves the scan speaks when the thing it is meant to find is really
    // there, before any silence is trusted as meaning the same directory holds
    // none.
    const dir = makeProject();
    try {
        fs.mkdirSync(path.join(dir, '.kit', 'parked'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, '.kit', 'parked', 'sess-abc123.md'),
            '# Resume handoff\n\nGoal: some in-flight work.\n'
        );
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
        assert.match(ctx, /\.kit[\\/]parked[\\/]sess-abc123\.md \(written [^)]*ago\)/);
        assert.match(ctx, /resume handoff/);
        assert.match(ctx, /Read it before doing anything else\./);
    } finally { rmDir(dir); }
});

test('an empty .kit/parked/ stays silent (control: the positive case above proves the scan fires when a handoff exists)', () => {
    const dir = makeProject();
    try {
        fs.mkdirSync(path.join(dir, '.kit', 'parked'), { recursive: true });
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});

test('no .kit/ directory at all stays silent (control: the positive case above proves the scan fires when a handoff exists)', () => {
    const dir = makeProject();
    try {
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});

test('a non-.md stray file in .kit/parked/ is left out, beside a real handoff that is not (withheld control: the stray name is shape-excluded by extension, never a literal the code was handed)', () => {
    const dir = makeProject();
    try {
        fs.mkdirSync(path.join(dir, '.kit', 'parked'), { recursive: true });
        // The stray name resembles a real handoff closely enough that only its
        // extension distinguishes it, so the filter this proves is the
        // '.md'-shaped one the hook applies, not a name it happened to be
        // written against.
        fs.writeFileSync(path.join(dir, '.kit', 'parked', 'sess-strayxyz.log'), 'not a handoff\n');
        fs.writeFileSync(
            path.join(dir, '.kit', 'parked', 'sess-realone.md'),
            '# Resume handoff\n\nGoal: some in-flight work.\n'
        );
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
        assert.match(ctx, /sess-realone\.md/);
        assert.doesNotMatch(ctx, /sess-strayxyz/);
    } finally { rmDir(dir); }
});
