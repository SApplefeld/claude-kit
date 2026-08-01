// Tests for the external-engine stand-down in plugins/claude-kit/hooks/session-start.js.
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by the
// additionalContext inside its stdout. Each case builds a fresh temp cwd
// holding docs/plans/ fixtures and cleans it up in a finally.
//
// Both directions are asserted, and both halves of each direction: under the
// marker the drive-to-completion push must be gone AND the plan inventory must
// still be there (a hook that emitted nothing would pass an absence-only
// check), and without the marker the push must still be verbatim, since a
// stand-down leaking into attended use silently removes plan recovery.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');

const IN_PROGRESS = '# Title\n\nStatus: In Progress\nCommit Model: Commit-and-Push\n';

function makeProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-engine-'));
    fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'plans', 'alpha_thing_spec_v1.md'), IN_PROGRESS, 'utf8');
    fs.writeFileSync(path.join(dir, 'docs', 'plans', 'beta_thing_spec_v1.md'), IN_PROGRESS, 'utf8');
    return dir;
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// process.env is spread rather than rebuilt so the child keeps its real PATH
// (a rebuilt env object loses the Windows `Path` key); extra is where a case
// adds the external-engine marker.
function runHook(cwd, extra) {
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd, source: 'startup' }),
        encoding: 'utf8',
        env: { ...process.env, ...(extra || {}) }
    });
}

// The context block the hook injected, or null when it stayed silent.
function context(res) {
    if (!res.stdout) return null;
    return JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
}

const DRIVE = /driving the remaining sections to completion/;

test('under KIT_EXTERNAL_ENGINE the plan inventory ships without the drive-to-completion push', () => {
    const dir = makeProject();
    try {
        const res = runHook(dir, { KIT_EXTERNAL_ENGINE: '1' });
        assert.strictEqual(res.status, 0);
        const text = context(res);
        assert.ok(text, 'the inventory is information a worker still gets');
        assert.doesNotMatch(text, DRIVE);
        assert.doesNotMatch(text, /Model tier/, 'the tier-routing instruction goes with the push');
        assert.match(text, /docs\/plans\/alpha_thing_spec_v1\.md \(Commit Model: Commit-and-Push\)/);
        assert.match(text, /docs\/plans\/beta_thing_spec_v1\.md \(Commit Model: Commit-and-Push\)/);
        assert.match(text, /in-progress plan doc\(s\)/, 'the reason line still frames the inventory');
        assert.match(text, /owns its scope and continuation/,
            'one line hands scope and continuation to the engine directive');
    } finally { rmDir(dir); }
});

test('without the marker the drive-to-completion push is unchanged', () => {
    const dir = makeProject();
    try {
        const res = runHook(dir);
        assert.strictEqual(res.status, 0);
        const text = context(res);
        assert.ok(text);
        assert.match(text, DRIVE);
        assert.match(text, /Before doing ANY work/);
        assert.match(text, /Honor each section's Model tier/);
        assert.match(text, /docs\/plans\/alpha_thing_spec_v1\.md \(Commit Model: Commit-and-Push\)/);
        assert.doesNotMatch(text, /owns its scope and continuation/);
    } finally { rmDir(dir); }
});

test('a marker value other than 1 leaves the push in place', () => {
    const dir = makeProject();
    try {
        const res = runHook(dir, { KIT_EXTERNAL_ENGINE: '0' });
        assert.strictEqual(res.status, 0);
        assert.match(context(res), DRIVE);
    } finally { rmDir(dir); }
});

test('with no in-progress plans the marker changes nothing: silence either way', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-engine-'));
    try {
        fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
        for (const extra of [undefined, { KIT_EXTERNAL_ENGINE: '1' }]) {
            const res = runHook(dir, extra);
            assert.strictEqual(res.status, 0);
            assert.strictEqual(res.stdout, '');
        }
    } finally { rmDir(dir); }
});
