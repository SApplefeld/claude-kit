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
const GOAL_LIB = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal-lib.js');
const { cwdFromInput, sectionProgress, pointerFrom, render, PLAN_MAX_BYTES } = require(WIDGET);

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

test('a plan doc behind a UTF-8 BOM still finds its Sections block', () => {
    const dir = makeRepo();
    try {
        // PowerShell Set-Content writes a BOM, so a plan doc edited from a
        // PowerShell session carries one in front of its first line. The block
        // scan matches a heading at the start of a line, so a BOM joined to the
        // first heading hides the Sections block and the segment disappears
        // rather than erroring. The fixture leads with that heading, which is
        // the only line a BOM can reach.
        arm(dir, { plan: PLAN_REL });
        fs.writeFileSync(path.join(dir, PLAN_REL), '\uFEFF' + [
            '## Sections of Work',
            '',
            '### 1. First thing',
            '',
            '### 2. Second thing',
            '',
            '## Chapters',
            ''
        ].join('\n'), 'utf8');
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 0/2 (Next §1)');
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
        // The fixture is self-consistent (queue[queueIndex] is the current
        // plan), which is what the CLI writes and what the shared reader
        // requires: a state whose index disagrees with its plan is normalized
        // to a queue of one, and the Plans segment then has nothing to report.
        arm(dir, { plan: 'docs/plans/b.md', queue: ['docs/plans/gone_spec_v1.md', 'docs/plans/b.md'], queueIndex: 1 });
        assert.strictEqual(render(dir), '\u{1F3AF} b · Plans: 2/2');
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

// Count the reads fs.readFileSync takes for the duration of fn, which is what
// tells a path refused before the open from one whose open merely failed. The
// hazard these cases exist for is a read that never returns, so the property
// under test is that no open is attempted, not that the render came back empty.
function countingReads(fn) {
    // The widget requires the hooks library lazily, and Node's CommonJS loader
    // reads a module's source through this very function, so a cold cache would
    // charge one read to the require and every count below would be one high.
    // Warming the cache here is what makes each case independent of whatever ran
    // before it: run any one of them alone and the counts are the same.
    require(GOAL_LIB);
    const realReadFileSync = fs.readFileSync;
    let reads = 0;
    fs.readFileSync = function (...args) {
        reads += 1;
        return realReadFileSync.apply(fs, args);
    };
    try {
        return fn(() => reads);
    } finally {
        fs.readFileSync = realReadFileSync;
    }
}

test('a plan path that escapes the repo renders nothing rather than being read', () => {
    // The repo sits inside a directory this case owns, so the traversal target
    // is a path no other run shares and the cleanup removes only what was made
    // here. A fixed name under the system temp directory would be neither.
    const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-outer-'));
    const dir = fs.mkdtempSync(path.join(outer, 'repo-'));
    fs.mkdirSync(path.join(dir, '.kit'));
    fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
    try {
        // The traversal resolves to a real file one directory above the repo,
        // so a reader that joined the stored value onto cwd would open it. The
        // shared reader re-validates the path instead, and a state whose plan
        // fails that check is malformed: no armed goal, nothing rendered.
        fs.writeFileSync(path.join(outer, 'outside.md'), '## Sections of Work\n\n### 1. A\n', 'utf8');
        arm(dir, { plan: '../outside.md' });
        countingReads((reads) => {
            assert.strictEqual(render(dir), '', 'an escaping plan path arms nothing');
            assert.strictEqual(reads(), 1, 'only the goal-state file itself is read');
        });
    } finally {
        rmDir(outer);
    }
});

test('a non-regular goal-state path renders nothing without being opened', () => {
    const dir = makeRepo();
    try {
        // A directory is the kind this box can stage. A FIFO, the kind that
        // would block the widget process the harness respawns at every status
        // line refresh, cannot be created from Node on any platform, and both
        // fail the same isFile() branch.
        fs.rmSync(path.join(dir, '.kit', 'goal-state.json'), { force: true });
        fs.mkdirSync(path.join(dir, '.kit', 'goal-state.json'), { recursive: true });
        countingReads((reads) => {
            assert.strictEqual(render(dir), '');
            assert.strictEqual(reads(), 0, 'the goal-state path is refused before any open');
        });
    } finally {
        rmDir(dir);
    }
});

test('a non-regular or oversized plan doc drops the Sections segment without being read whole', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        fs.mkdirSync(path.join(dir, PLAN_REL), { recursive: true });
        countingReads((reads) => {
            assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1', 'the Sections segment is dropped');
            assert.strictEqual(reads(), 1, 'only the goal-state file is read; the plan path is refused');
        });
        fs.rmSync(path.join(dir, PLAN_REL), { recursive: true, force: true });

        // Past the widget's own cap: valid plan text, so only the cap can
        // refuse it.
        const body = '## Sections of Work\n\n### 1. First thing\n\n';
        fs.writeFileSync(path.join(dir, PLAN_REL), body + 'x'.repeat(1024 * 1024), 'utf8');
        assert.ok(fs.statSync(path.join(dir, PLAN_REL)).size > 1024 * 1024, 'setup: the doc is past the cap');
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1', 'an oversized plan doc drops the segment too');
    } finally {
        rmDir(dir);
    }
});

test('a plan value carrying terminal-hostile characters is printed sanitized', () => {
    const dir = makeRepo();
    try {
        // U+202E (right-to-left override) and U+007F (delete) are not control
        // characters by the stored-path rule, so they reach a renderer intact;
        // the first reorders everything after it in a terminal. The line is
        // printed to the operator's prompt, so what a terminal acts on is
        // removed: escape introducers, bidi controls and the common
        // zero-widths. That is a narrower class than the printable-ASCII rule
        // the reason strings and the event stream hold to, and deliberately so:
        // the case below this one is a plan name in another script rendering as
        // itself.
        const hostile = 'docs/plans/we\u202Elrp\u007F_spec_v1.md';
        arm(dir, { plan: hostile });
        const line = render(dir);
        assert.strictEqual(line, '\u{1F3AF} welrp_spec_v1');
        assert.ok(!/[^\x20-\x7E]/.test(line.slice(2)),
            'nothing outside printable ASCII reaches the terminal: ' + JSON.stringify(line));
    } finally {
        rmDir(dir);
    }
});

test('a plan doc cannot set the length of the status line through its Next pointer', () => {
    const dir = makeRepo();
    try {
        // The pointer is a capture from the plan doc's own Next line, and plan
        // docs are committed content, so a clone carries whatever this says. An
        // unbounded capture writes it verbatim to a terminal the launcher
        // spawns with inherited stdio, with nothing in between to truncate it.
        // A run past the bound yields no pointer at all: truncating it to four
        // digits would name a section nobody wrote, which reads as fact.
        arm(dir, { plan: PLAN_REL });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: ' + '9'.repeat(200000)]);
        const line = render(dir);
        assert.ok(line.length < 200, 'the line stays a status line: ' + line.length + ' characters');
        assert.strictEqual(line, '\u{1F3AF} widget_spec_v1 · Sections: 1/3');
    } finally {
        rmDir(dir);
    }
});

test('a plan value that sanitizes away renders a placeholder, and an ordinary non-ASCII name survives', () => {
    const dir = makeRepo();
    try {
        // The sanitizer removes what a terminal acts on, not everything a name
        // may hold: a plan named in any script must still read as itself, and a
        // name made only of removed characters must still leave a segment, or
        // the line renders a bare marker with a doubled separator behind it.
        arm(dir, { plan: 'docs/plans/plån_日本.md', queue: ['docs/plans/a.md', 'docs/plans/b.md'], queueIndex: 0 });
        assert.strictEqual(render(dir), '\u{1F3AF} plån_日本',
            'an ordinary non-ASCII plan name renders as itself');

        arm(dir, { plan: 'docs/plans/\u202E\u200B.md' });
        assert.strictEqual(render(dir), '\u{1F3AF} (unprintable)',
            'a name that is nothing but removed characters still leaves a segment');
    } finally {
        rmDir(dir);
    }
});

test('a state whose queueIndex disagrees with its plan reads as the queue of one it normalizes to', () => {
    const dir = makeRepo();
    try {
        // The widget's header states this consequence, and the shared reader is
        // what produces it: a queue that does not carry the current plan at its
        // index is replaced by [plan], so the Plans segment has nothing to
        // report. Pinned here because it is operator-visible and no other case
        // stages a disagreeing state.
        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 1 });
        plan(dir, []);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)',
            'no Plans segment: the disagreeing queue normalized to one entry');
    } finally {
        rmDir(dir);
    }
});

// The wall-clock bound every performance case below is held to. Each of the
// three staged shapes runs in tens of milliseconds as the code stands (26 to 30
// ms, and about 1 ms for the whitespace heading) and in seconds without its fix:
// 4.6 s for the smallest of them, and 15 s for the whitespace heading at this
// fixture's size. The bound sits a hundred times above the fixed measurements,
// because this repository budgets for a box under contention and a margin of a
// few tens flakes there and reads as a regression, and still under the smallest
// unfixed measurement, which is what keeps the case able to fail.
const PARSE_BUDGET_MS = 3000;

// Time sectionProgress over one document, returning [progress, elapsedMs].
function timeProgress(text) {
    const started = Date.now();
    const progress = sectionProgress(text);
    return [progress, Date.now() - started];
}

test('the section count stays linear when every section title is distinct', () => {
    // completes() was asked once per (chapter, section) pair, so a doc just
    // under the read cap drove hundreds of millions of iterations and seconds of
    // CPU per refresh. The index makes each Completed line two lookups.
    // Pair-by-pair, this document takes about 4.6 s here; indexed it is about
    // 30 ms.
    const count = 20000;
    const sections = [];
    const chapters = ['## Chapters'];
    for (let i = 1; i <= count; i += 1) {
        sections.push('### ' + i + '. Section ' + i);
        chapters.push('### Chapter ' + i, 'Completed: ' + i + '. Section ' + i, 'Next: ' + (i + 1) + '. Section');
    }
    const [progress, elapsed] = timeProgress(['## Sections of Work'].concat(sections, chapters).join('\n'));
    assert.strictEqual(progress.done, count, 'the count is unchanged by the indexing');
    assert.strictEqual(progress.total, count);
    assert.ok(elapsed < PARSE_BUDGET_MS, count + ' distinct titles took ' + elapsed + ' ms');
});

test('the section count stays linear when every section shares one title', () => {
    // The shape the index alone does not close: one title mapping to N numbers,
    // walked again for every Completed line naming it, which is the same product
    // by another route. A document of 45,000 identically titled sections and
    // 11,000 chapters sits at about 1.02 MB, inside the 1 MB-plus-a-little the
    // reader will hand over, and takes seconds that way; with the numbers
    // consumed on first use it is about 26 ms. The fixture is the attack rather
    // than the average: distinct titles never reach this path at all.
    const sections = [];
    const chapters = ['## Chapters'];
    for (let i = 1; i <= 45000; i += 1) sections.push('### ' + i + '. T');
    for (let i = 1; i <= 11000; i += 1) chapters.push('### Chapter ' + i, 'Completed: T', 'Next: 1. T');
    const text = ['## Sections of Work'].concat(sections, chapters).join('\n');
    // Against the reader's own constant, not a multiple of it: a fixture between
    // the two numbers passes a loose guard while planText refuses the document
    // outright, and the case would then time a doc the widget never parses.
    assert.ok(Buffer.byteLength(text) < PLAN_MAX_BYTES,
        'setup: the doc is the size of one the reader hands over: ' + Buffer.byteLength(text));
    const [progress, elapsed] = timeProgress(text);
    assert.strictEqual(progress.done, 45000, 'every section with that title registers, exactly once');
    assert.strictEqual(progress.total, 45000);
    assert.ok(elapsed < PARSE_BUDGET_MS, '45000 sections sharing one title took ' + elapsed + ' ms');
});

test('a section heading of runaway whitespace does not make the parse superlinear', () => {
    // A lazy title capture with a trailing whitespace class re-scans the rest of
    // the line at every expansion, so a heading shaped '### 1. x<run>y' is
    // quadratic in its own length: about 15 s at 200 KB, and minutes at the 1 MB
    // cap, which is one line of one committed file. Captured greedily and
    // trimmed in JS it is about 1 ms.
    const run = ' '.repeat(200 * 1024);
    const text = [
        '## Sections of Work',
        '### 1. x' + run + 'y',
        '## Chapters',
        '### Chapter 1',
        'Completed: 1. z',
        'Next: 2. y'
    ].join('\n');
    const [progress, elapsed] = timeProgress(text);
    assert.strictEqual(progress.total, 1, 'the heading still parses as one section');
    assert.strictEqual(progress.done, 1, 'and its Completed line still registers it');
    assert.ok(elapsed < PARSE_BUDGET_MS, 'a 200 KB whitespace heading took ' + elapsed + ' ms');
});

test('a section heading whose title is only whitespace is not a section', () => {
    // Greedy-plus-trim can produce an empty title where the lazy capture simply
    // failed to match, so the emptiness is refused explicitly rather than
    // indexed as a section with no name.
    const progress = sectionProgress([
        '## Sections of Work',
        '### 1.    ',
        '### 2. Real one',
        '## Chapters'
    ].join('\n'));
    assert.deepStrictEqual(progress, { done: 0, total: 1, pointer: '§2' },
        'only the titled heading counts, and the pointer names it');
});

test('a status-line host that closed the pipe gets silence, not an EPIPE stack trace', () => {
    const dir = makeRepo();
    try {
        // The other way out of this process. render can be perfectly successful
        // and the write still throw: a host that has closed the pipe makes
        // process.stdout.write raise EPIPE, and an escaping EPIPE is a stack
        // trace on the operator's prompt and a nonzero exit, which is exactly
        // what the guard around render exists to prevent. A preload stages the
        // throw, since a genuinely closed pipe cannot be staged from here
        // without racing the child's own startup.
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-epipe-'));
        const shim = path.join(shimDir, 'closed-pipe.js');
        fs.writeFileSync(shim, [
            "'use strict';",
            'process.stdout.write = function () {',
            "    const err = new Error('EPIPE: broken pipe, write');",
            "    err.code = 'EPIPE';",
            '    throw err;',
            '};'
        ].join('\n') + '\n', 'utf8');
        try {
            const res = spawnSync(process.execPath, [WIDGET], {
                input: JSON.stringify({ cwd: dir }),
                encoding: 'utf8',
                env: { ...process.env, NODE_OPTIONS: '--require "' + shim.replace(/\\/g, '/') + '"' }
            });
            assert.strictEqual(res.status, 0, 'exit 0 even when the write throws');
            assert.strictEqual(res.stderr, '', 'and no stack trace on stderr: ' + res.stderr);
        } finally {
            rmDir(shimDir);
        }
    } finally {
        rmDir(dir);
    }
});

test('a throw inside render leaves the status line blank rather than printing a stack trace', () => {
    const dir = makeRepo();
    try {
        // The launcher inherits this process's stdio and propagates its exit
        // code, so anything escaping render reaches the operator's prompt. A
        // goal-state file whose plan is a string but whose queue is a getter
        // that throws is not reachable from disk; the CLI stands in for any
        // future throw by making the module itself unloadable, which render
        // reaches through its lazy require.
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-broken-'));
        fs.mkdirSync(path.join(broken, 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(broken, 'hooks'), { recursive: true });
        fs.copyFileSync(WIDGET, path.join(broken, 'scripts', 'kit-goal-statusline.js'));
        fs.writeFileSync(path.join(broken, 'hooks', 'kit-goal-lib.js'),
            'module.exports = { get readGoal() { throw new Error("boom"); } };\n', 'utf8');
        try {
            const res = spawnSync(process.execPath, [path.join(broken, 'scripts', 'kit-goal-statusline.js')],
                { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
            assert.strictEqual(res.status, 0, 'exit 0 even when the read throws');
            assert.strictEqual(res.stdout, '', 'nothing on stdout');
            assert.strictEqual(res.stderr, '', 'and no stack trace on stderr: ' + res.stderr);
        } finally {
            rmDir(broken);
        }
    } finally {
        rmDir(dir);
    }
});

test('a payload without the hooks library renders nothing rather than crashing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-plugins-'));
    const dir = makeRepo();
    try {
        // The widget reads the goal state through the hooks library. A payload
        // that carries the scripts without the hooks directory is a broken
        // install, and the status line goes blank instead of writing a stack
        // trace into the operator's prompt.
        const entry = path.join(root, 'scripts');
        fs.mkdirSync(entry, { recursive: true });
        fs.copyFileSync(WIDGET, path.join(entry, 'kit-goal-statusline.js'));
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const res = spawnSync(process.execPath, [path.join(entry, 'kit-goal-statusline.js')],
            { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '', 'no library, no line, no crash');
        assert.strictEqual(res.stderr, '', 'and nothing on stderr either: ' + res.stderr);
    } finally {
        rmDir(dir);
        rmDir(root);
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
        fs.mkdirSync(path.join(entry, 'hooks'), { recursive: true });
        fs.writeFileSync(path.join(entry, 'scripts', 'memq.js'), '', 'utf8');
        fs.copyFileSync(WIDGET, path.join(entry, 'scripts', 'kit-goal-statusline.js'));
        // The payload carries the hooks library beside the scripts, which is
        // where the widget reads the goal state from; a payload without it is
        // the degraded case 'a payload without the hooks library' covers.
        fs.copyFileSync(GOAL_LIB, path.join(entry, 'hooks', 'kit-goal-lib.js'));
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
