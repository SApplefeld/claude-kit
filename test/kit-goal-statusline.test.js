// Unit tests for plugins/claude-kit/scripts/kit-goal-statusline.js and the
// scripts/kit-statusline.js launcher.
//
// Node's built-in test runner, no framework, no install (Node v24). Each case
// builds a fresh temp directory under os.tmpdir() as a fake repo cwd, writes
// a goal state and a plan doc there, renders against it, and cleans up in a
// finally block. The plan-doc fixtures follow the machine contract the
// curating-docs skill freezes, since that contract is what the section count
// is defined against.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPTS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts');
const WIDGET = path.join(SCRIPTS, 'kit-goal-statusline.js');
const LAUNCHER = path.join(SCRIPTS, 'kit-statusline.js');
const { cwdFromInput, sectionProgress, pointerFrom, render } = require(WIDGET);

function makeRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-'));
    fs.mkdirSync(path.join(dir, '.kit'));
    fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
    return dir;
}

function rmDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

function arm(dir, state) {
    fs.writeFileSync(path.join(dir, '.kit', 'goal-state.json'), JSON.stringify(state), 'utf8');
}

const PLAN_REL = 'docs/plans/widget_spec_v1.md';

function plan(dir, chapters) {
    const head = [
        '# Widget',
        'Status: In Progress',
        'Commit Model: Review-Only',
        '',
        '## Sections of Work',
        '',
        '### 1. First thing',
        'Model: sonnet',
        '',
        '### 2. Second thing',
        'Model: sonnet',
        '',
        '### 3. Third thing',
        'Model: sonnet',
        '',
        '## Out of Scope',
        '',
        '## Chapters',
        ''
    ];
    fs.writeFileSync(path.join(dir, PLAN_REL), head.concat(chapters).join('\n'), 'utf8');
}

test('nothing armed renders nothing', () => {
    const dir = makeRepo();
    try {
        assert.strictEqual(render(dir), '');
    } finally {
        rmDir(dir);
    }
});

test('a single armed plan with no Chapters shows the plan, 0 of N, and a pointer at section 1, and no Plans segment', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)');
    } finally {
        rmDir(dir);
    }
});

test('Completed lines register by number-dot, number-space, or exact title, never by substring', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, [
            '### Chapter 1 - 2026-08-24',
            'Completed: 1. First thing',
            'Next: 2. Second thing',
            '',
            '### Chapter 2 - 2026-08-24',
            'Completed: 2 Second thing, plus a note',
            'Next: 3. Third thing',
            '',
            '### Chapter 3 - 2026-08-24',
            'Completed: Section 3, Third thing',
            'Next: finishing-work',
            ''
        ]);
        // Chapter 3's phrasing matches none of the three forms, so section 3
        // stays open, exactly as the external engine reads it.
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 2/3 (Next finishing)');
    } finally {
        rmDir(dir);
    }
});

test('an exact-title Completed line registers, and only the first Completed line of a Chapter counts', () => {
    const progress = sectionProgress([
        '## Sections of Work',
        '### 1. First thing',
        '### 2. Second thing',
        '## Chapters',
        '### Chapter 1',
        'Completed: Second thing',
        'Completed: 1. First thing',
        'Next: Section 1'
    ].join('\n'));
    assert.deepStrictEqual(progress, { done: 1, total: 2, pointer: '§1' });
});

test('a queue of more than one plan adds the Plans segment', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 0 });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2) · Plans: 1/2');
    } finally {
        rmDir(dir);
    }
});

test('a missing plan doc drops the Sections segment and keeps the rest', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: 'docs/plans/gone_spec_v1.md', queue: ['docs/plans/gone_spec_v1.md', 'docs/plans/b.md'], queueIndex: 1 });
        assert.strictEqual(render(dir), '\u{1F3AF} gone_spec_v1 · Plans: 2/2');
    } finally {
        rmDir(dir);
    }
});

test('a foreign ## heading inside Sections of Work ends the block, as the contract says', () => {
    const progress = sectionProgress([
        '## Sections of Work',
        '### 1. First thing',
        '## Standing Brief Amendments',
        '### 2. Not a section any more',
        '## Chapters'
    ].join('\n'));
    assert.deepStrictEqual(progress, { done: 0, total: 1, pointer: '§1' });
});

test('the Next pointer reads the shapes plans actually use', () => {
    assert.strictEqual(pointerFrom('2. A checkpoint opened under a pending offer'), '§2');
    assert.strictEqual(pointerFrom('Section 4 (its redesign is in flight), then Sections 2 and 3'), '§4');
    assert.strictEqual(pointerFrom('Sections 1 and 4 are in review'), '§1');
    assert.strictEqual(pointerFrom('§3'), '§3');
    assert.strictEqual(pointerFrom('finishing-work'), 'finishing');
    assert.strictEqual(pointerFrom('the build-stamp refresh, then Section 6'), '');
});

test('the cwd comes from workspace.current_dir, then cwd, then the fallback', () => {
    assert.strictEqual(cwdFromInput('{"cwd":"C:\\\\a","workspace":{"current_dir":"C:\\\\b"}}', 'F'), 'C:\\b');
    assert.strictEqual(cwdFromInput('{"cwd":"C:\\\\a"}', 'F'), 'C:\\a');
    assert.strictEqual(cwdFromInput('', 'F'), 'F');
    assert.strictEqual(cwdFromInput('not json', 'F'), 'F');
});

test('run as a CLI, the widget reads the status-line JSON from stdin and prints the line with exit 0', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const res = spawnSync(process.execPath, [WIDGET], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)');
    } finally {
        rmDir(dir);
    }
});

test('the launcher runs the widget from the payload memq-shim resolves, passing stdin through', () => {
    // A fake plugins root with a manifest pointing at a cache entry that
    // holds both scripts, the same shape memq-shim.test.js builds.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-plugins-'));
    const dir = makeRepo();
    try {
        const entry = path.join(root, 'cache', 'applefeld', 'claude-kit', 'v1');
        fs.mkdirSync(path.join(entry, 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(entry, 'scripts', 'memq.js'), '', 'utf8');
        fs.copyFileSync(WIDGET, path.join(entry, 'scripts', 'kit-goal-statusline.js'));
        fs.writeFileSync(path.join(root, 'installed_plugins.json'), JSON.stringify({
            version: 2,
            plugins: { 'claude-kit@applefeld': [{ scope: 'user', installPath: entry, version: 'v1' }] }
        }), 'utf8');
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        // The shim honors the root override only with its second signal set;
        // see pluginsRoot in memq-shim.js.
        const env = Object.assign({}, process.env, { KIT_PLUGINS_ROOT: root, KIT_PLUGINS_ROOT_ALLOW_CODE: '1' });
        const res = spawnSync(process.execPath, [LAUNCHER], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8', env });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)');

        // A payload from before the widget existed: blank, exit 0, so the
        // status line shows nothing rather than an error.
        fs.unlinkSync(path.join(entry, 'scripts', 'kit-goal-statusline.js'));
        const older = spawnSync(process.execPath, [LAUNCHER], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8', env });
        assert.strictEqual(older.status, 0, older.stderr);
        assert.strictEqual(older.stdout, '');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});
