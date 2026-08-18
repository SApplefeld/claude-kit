// session-start.js on the compact source: the re-load block.
//
// A compaction drops what tool calls loaded into context (skill bodies, deferred
// tool schemas) while the doctrine and this hook's output are re-injected, so
// the hook is the surface that can tell a compacted session to re-load before
// it runs a half-present procedure. These tests pin that the block fires on
// the compact source alone, whether or not a plan is in progress, that it
// leads the output when a plan is, and that no other source carries it.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');
const RELOAD_MARK = 'Context was just compacted. Anything a tool call loaded into context before it is gone';

function makeRepo() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-compact-test-'));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writePlan(dir) {
    const plans = path.join(dir, 'docs', 'plans');
    fs.mkdirSync(plans, { recursive: true });
    fs.writeFileSync(
        path.join(plans, 'demo_spec_v1.md'),
        '# Demo\n\nStatus: In Progress\nCommit Model: Commit-and-Push\n',
        'utf8'
    );
}

function runHook(cwd, source) {
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd, session_id: 'sess-1', source }),
        encoding: 'utf8'
    });
}

function context(res) {
    if (!res.stdout) return null;
    return JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
}

test('the compact source emits the re-load block even with nothing else to say', () => {
    const dir = makeRepo();
    try {
        const res = runHook(dir, 'compact');
        assert.strictEqual(res.status, 0);
        const ctx = context(res);
        assert.ok(ctx, 'expected additional context on the compact source');
        assert.ok(ctx.startsWith(RELOAD_MARK), 'the re-load block should be the whole output');
        assert.match(ctx, /re-invoke the skill governing the work in hand/);
        assert.match(ctx, /re-load any deferred tool/);
    } finally {
        rmDir(dir);
    }
});

test('with a plan in progress the re-load block leads and the plan recovery follows', () => {
    const dir = makeRepo();
    try {
        writePlan(dir);
        const ctx = context(runHook(dir, 'compact'));
        assert.ok(ctx, 'expected additional context');
        assert.ok(ctx.startsWith(RELOAD_MARK), 're-load block should come first');
        assert.ok(ctx.indexOf(RELOAD_MARK) < ctx.indexOf('docs/plans/demo_spec_v1.md'), 'plan block should follow the re-load block');
        // The lead-in is said once, by the re-load block; the plan block names
        // what the re-read is of instead of repeating it.
        assert.strictEqual(ctx.split('Context was just compacted.').length, 2, 'the compaction lead-in appears exactly once');
        assert.match(ctx, /The plan-doc re-read that recovery calls for is of these\. This project has in-progress plan doc/);
        assert.match(ctx, /\(executing-work on a plan run\)/);
    } finally {
        rmDir(dir);
    }
});

test('under the external engine marker the re-load block names no skill of its own', () => {
    const dir = makeRepo();
    try {
        writePlan(dir);
        const res = spawnSync(process.execPath, [HOOK], {
            input: JSON.stringify({ cwd: dir, session_id: 'sess-1', source: 'compact' }),
            encoding: 'utf8',
            env: { ...process.env, KIT_EXTERNAL_ENGINE: '1' }
        });
        const ctx = context(res);
        assert.ok(ctx && ctx.startsWith(RELOAD_MARK), 'the re-load block still leads under the engine');
        assert.match(ctx, /\(the skill the engine's directive names\)/);
        assert.ok(!ctx.includes('(executing-work on a plan run)'), 'the engine worker is not handed executing-work by name');
    } finally {
        rmDir(dir);
    }
});

test('startup and resume sources carry no re-load block', () => {
    const dir = makeRepo();
    const empty = makeRepo();
    try {
        writePlan(dir);
        for (const source of ['startup', 'resume']) {
            const ctx = context(runHook(dir, source));
            assert.ok(ctx, `expected plan recovery on ${source}`);
            assert.ok(!ctx.includes(RELOAD_MARK), `${source} should not carry the re-load block`);
        }
        const res = runHook(empty, 'startup');
        assert.strictEqual(res.stdout, '', 'an empty repo on startup stays silent');
    } finally {
        rmDir(dir);
        rmDir(empty);
    }
});
