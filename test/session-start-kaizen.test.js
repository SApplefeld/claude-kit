// Tests for the pending-kaizen counter in plugins/claude-kit/hooks/session-start.js.
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout: a pending inbox emits the kaizen block inside
// {"hookSpecificOutput":{additionalContext}}; an empty inbox emits nothing.
// Each case builds a fresh temp dir carrying the kit-repo marker
// (plugins/claude-kit/.claude-plugin/plugin.json) plus a kaizen/ inbox.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');

function makeKitRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-count-test-'));
    fs.mkdirSync(path.join(dir, 'plugins', 'claude-kit', '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugins', 'claude-kit', '.claude-plugin', 'plugin.json'), '{}');
    fs.mkdirSync(path.join(dir, 'kaizen', 'briefs'), { recursive: true });
    return dir;
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// The hook runs against the fixture and nothing else on this machine. The kit's
// other session-start blocks read the operator's home directory, the plugin root
// this suite is itself running under, and the project's git repository, and a
// fixture carrying the kit-repo marker reaches all three, so each is pointed
// somewhere the case owns: the home pair (what os.homedir() reads) at a
// directory inside the fixture, the plugin root and the external-engine marker
// dropped in every casing Windows carries them in, and every GIT_* variable
// dropped so no repository this suite was started from can answer for the
// fixture. process.env is spread rather than rebuilt so the child keeps its real
// PATH, which a rebuilt object loses on Windows.
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

test('a header-only notes file and a briefs .gitkeep count as an empty inbox', () => {
    const dir = makeKitRepo();
    try {
        fs.writeFileSync(path.join(dir, 'kaizen', 'notes-MACHINE.md'), '# Kaizen inbox: MACHINE\n');
        fs.writeFileSync(path.join(dir, 'kaizen', 'briefs', '.gitkeep'), '');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});

test('a real note line under the header is counted', () => {
    const dir = makeKitRepo();
    try {
        fs.writeFileSync(
            path.join(dir, 'kaizen', 'notes-MACHINE.md'),
            '# Kaizen inbox: MACHINE\n- 2026-07-27 MACHINE some-repo: a rule was ambiguous\n'
        );
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 1 pending item/);
    } finally { rmDir(dir); }
});

test('note lines across machines and a brief file are summed', () => {
    const dir = makeKitRepo();
    try {
        fs.writeFileSync(
            path.join(dir, 'kaizen', 'notes-A.md'),
            '# Kaizen inbox: A\n- 2026-07-26 A repo-x: friction one\n- 2026-07-27 A repo-y: friction two\n'
        );
        fs.writeFileSync(path.join(dir, 'kaizen', 'notes-B.md'), '# Kaizen inbox: B\n');
        fs.writeFileSync(path.join(dir, 'kaizen', 'briefs', 'some-brief.md'), '# Kaizen brief: t\n');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 3 pending item\(s\)/);
    } finally { rmDir(dir); }
});

test('outside the kit repo the inbox never nudges', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-count-test-'));
    try {
        fs.mkdirSync(path.join(dir, 'kaizen'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'kaizen', 'notes-MACHINE.md'), '- a note line\n');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});
