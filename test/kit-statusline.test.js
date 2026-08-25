// Unit tests for the plugins/claude-kit/scripts/kit-statusline.js launcher:
// the in-process render path, the file-backed render cache under the project's
// .kit/, and the stale-but-drawn fallback. The launcher's payload resolution
// and its blank answer to a payload from before the widget existed are covered
// beside the widget's own cases in kit-goal-statusline.test.js.
//
// Node's built-in test runner, no framework, no install (Node v24). Each case
// builds a fake plugins root holding one payload and a fresh temp directory as
// a project cwd, runs the launcher as the status-line tool runs it (the
// status-line JSON on stdin), and cleans up in a finally block.

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

const PLAN_REL = 'docs/plans/widget_spec_v1.md';
const CACHE_REL = path.join('.kit', 'statusline-cache.json');
const FIRST_LINE = '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)';

function rmDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

// A project cwd with the .kit directory the goal state and the render cache
// both live in.
function makeRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-launcher-'));
    fs.mkdirSync(path.join(dir, '.kit'));
    fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
    return dir;
}

// A plugins root whose manifest points at one payload carrying both scripts and
// the hooks library, the same shape memq-shim.test.js builds.
function makePayload() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-launcher-plugins-'));
    const entry = path.join(root, 'cache', 'applefeld', 'claude-kit', 'v1');
    fs.mkdirSync(path.join(entry, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(entry, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(entry, 'scripts', 'memq.js'), '', 'utf8');
    fs.copyFileSync(WIDGET, path.join(entry, 'scripts', 'kit-goal-statusline.js'));
    fs.copyFileSync(GOAL_LIB, path.join(entry, 'hooks', 'kit-goal-lib.js'));
    fs.writeFileSync(path.join(root, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: { 'claude-kit@applefeld': [{ scope: 'user', installPath: entry, version: 'v1' }] }
    }), 'utf8');
    return { root, entry };
}

// The shim honors the root override only with its second signal set; see
// pluginsRoot in memq-shim.js.
function runLauncher(root, dir, extraEnv, spawnCwd) {
    const env = Object.assign({}, process.env,
        { KIT_PLUGINS_ROOT: root, KIT_PLUGINS_ROOT_ALLOW_CODE: '1' }, extraEnv || {});
    const opts = { input: JSON.stringify({ cwd: dir }), encoding: 'utf8', env };
    if (spawnCwd) opts.cwd = spawnCwd;
    return spawnSync(process.execPath, [LAUNCHER], opts);
}

function arm(dir, state) {
    fs.writeFileSync(path.join(dir, '.kit', 'goal-state.json'), JSON.stringify(state), 'utf8');
}

function plan(dir, rel, chapters) {
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
        '## Chapters',
        ''
    ];
    fs.writeFileSync(path.join(dir, rel), head.concat(chapters).join('\n'), 'utf8');
}

// Move a file's modification time forward by a fixed step. The cache keys on
// mtimes, and two writes inside one test can land close enough together that a
// case meant to stage a changed file stages an unchanged key instead; stepping
// the time explicitly is what makes the change the case is about certain.
function ageForward(target, seconds) {
    const st = fs.statSync(target);
    const when = new Date(st.mtimeMs + seconds * 1000);
    fs.utimesSync(target, when, when);
}

function readCache(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, CACHE_REL), 'utf8'));
}

function writeCache(dir, entry) {
    fs.writeFileSync(path.join(dir, CACHE_REL), JSON.stringify(entry), 'utf8');
}

// A preload directory holding one module, for a case that has to reach inside
// the launcher's own process. Returns the NODE_OPTIONS value that loads it.
function makeShim(body) {
    const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-launcher-shim-'));
    const shim = path.join(shimDir, 'shim.js');
    fs.writeFileSync(shim, body.join('\n') + '\n', 'utf8');
    return { shimDir, nodeOptions: '--require "' + shim.replace(/\\/g, '/') + '"' };
}

test('the launcher renders the widget in-process, spawning no second node', () => {
    const { root } = makePayload();
    const dir = makeRepo();
    // The measured cost this launcher was changed to drop is a second node
    // process per status-line refresh. A preload makes every child_process
    // entry point throw, so a launcher that still spawns cannot produce the
    // line at all, while one that loads the widget in-process is untouched.
    const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-launcher-nospawn-'));
    const shim = path.join(shimDir, 'no-spawn.js');
    fs.writeFileSync(shim, [
        "'use strict';",
        "const cp = require('child_process');",
        "for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {",
        '    cp[name] = function () {',
        "        throw new Error('kit-statusline spawned a child process: ' + name);",
        '    };',
        '}'
    ].join('\n') + '\n', 'utf8');
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        const res = runLauncher(root, dir, { NODE_OPTIONS: '--require "' + shim.replace(/\\/g, '/') + '"' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, FIRST_LINE);
        assert.strictEqual(res.stderr, '', 'no child process was attempted: ' + res.stderr);
    } finally {
        rmDir(shimDir);
        rmDir(dir);
        rmDir(root);
    }
});

test('an unchanged goal state and plan doc reprint the cached line, and a changed plan doc does not', () => {
    const { root } = makePayload();
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE, 'the first refresh renders fresh');

        const cached = readCache(dir);
        assert.strictEqual(cached.line, FIRST_LINE, 'the render cache holds the line it printed');
        assert.strictEqual(cached.plan, PLAN_REL, 'and the plan doc it was rendered from');

        // A sentinel no render can produce: printing it proves the refresh took
        // the cached line rather than re-rendering, which is what buys the
        // saturated case one stat and one small read.
        fs.writeFileSync(path.join(dir, CACHE_REL),
            JSON.stringify(Object.assign({}, cached, { line: 'CACHED' })), 'utf8');
        assert.strictEqual(runLauncher(root, dir).stdout, 'CACHED',
            'an unchanged goal state and plan doc reprint the cached line');

        // A Chapter landing in the plan doc changes the count the segment
        // exists to show, and the goal state is untouched by it, so the plan
        // doc's own modification time is part of the key.
        plan(dir, PLAN_REL, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        ageForward(path.join(dir, PLAN_REL), 2);
        assert.strictEqual(runLauncher(root, dir).stdout,
            '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2)',
            'a changed plan doc re-renders rather than reprinting a stale count');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a widget that throws draws the cached line rather than a blank segment', () => {
    const { root, entry } = makePayload();
    const dir = makeRepo();
    try {
        // Direction one: the healthy path renders fresh and fills the cache.
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE, 'the healthy path renders fresh');

        // Direction two: the widget throws on every entry point the launcher
        // calls, which is the internal failure a saturated box produces and the
        // blank segment the operator reported. The goal state moves at the same
        // time, so the cached line is reached through the failure rather than
        // through the unchanged-mtime fast path.
        fs.writeFileSync(path.join(entry, 'hooks', 'kit-goal-lib.js'), [
            "'use strict';",
            'module.exports = {',
            "    get goalPath() { throw new Error('boom'); },",
            "    get readGoal() { throw new Error('boom'); },",
            "    get planFileSize() { throw new Error('boom'); }",
            '};'
        ].join('\n') + '\n', 'utf8');
        const other = 'docs/plans/other_spec_v1.md';
        plan(dir, other, []);
        arm(dir, { plan: other });
        ageForward(path.join(dir, '.kit', 'goal-state.json'), 2);

        const res = runLauncher(root, dir);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.notStrictEqual(res.stdout, '', 'a blank segment is the failure being fixed');
        assert.strictEqual(res.stdout, FIRST_LINE, 'the last line drawn is what a failed refresh draws');
        assert.strictEqual(res.stderr, '', 'and no stack trace on the operator prompt: ' + res.stderr);
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a failing widget with no cached line still renders nothing, without a stack trace', () => {
    const { root, entry } = makePayload();
    const dir = makeRepo();
    try {
        // The other half of the fallback: with nothing cached there is nothing
        // to draw, and the status line's one failure mode is to say nothing.
        fs.writeFileSync(path.join(entry, 'hooks', 'kit-goal-lib.js'),
            "'use strict';\nmodule.exports = { get readGoal() { throw new Error('boom'); } };\n", 'utf8');
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        const res = runLauncher(root, dir);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.stderr, '', 'nothing on stderr either: ' + res.stderr);
        assert.ok(!fs.existsSync(path.join(dir, CACHE_REL)), 'and no cache is written from a failed render');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a cached line reaches the terminal sanitized, at both print sites', () => {
    const { root, entry } = makePayload();
    const dir = makeRepo();
    // The cache file sits inside a repository, so a clone or a hand can put
    // anything in the line it stores: the bytes that open an escape sequence
    // (ESC, and a raw 0x9B, which is CSI on its own), the separators that
    // would turn one status line into several, the zero-widths, and a length no
    // status line has room for. Both places this launcher prints a stored line
    // are covered, since one sanitized site and one raw site is the same
    // exposure.
    const planted = '\u001B[31mRED\u0007\nsecond line\u009B2J\u200B' + 'x'.repeat(500);
    const expected = ('[31mREDsecond line2J' + 'x'.repeat(500)).slice(0, 400);
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE, 'the first refresh renders fresh');

        // Site one: the unchanged-key path, which prints the stored line as its
        // whole purpose.
        writeCache(dir, Object.assign({}, readCache(dir), { line: planted }));
        const hit = runLauncher(root, dir).stdout;
        assert.strictEqual(hit, expected, 'the cache-hit path sanitizes and caps');
        assert.ok(!/[\u0000-\u001F\u007F-\u009F]/.test(hit),
            'no control byte reaches the terminal: ' + JSON.stringify(hit));

        // Site two: the stale-but-drawn fallback, reached by breaking the
        // library the widget reads through.
        fs.writeFileSync(path.join(entry, 'hooks', 'kit-goal-lib.js'),
            "'use strict';\nmodule.exports = { get goalPath() { throw new Error('boom'); } };\n", 'utf8');
        assert.strictEqual(runLauncher(root, dir).stdout, expected, 'the fallback path sanitizes and caps');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('the cache write refuses a .kit that is a link, and writes into a real one atomically', () => {
    const { root } = makePayload();
    const dir = makeRepo();
    // A link at .kit is the shape that matters: a write through one lands in
    // whatever the link points at, outside the project the status line is
    // showing, on every refresh. The kind check is an lstat, so the link is
    // judged as a link rather than as the directory behind it. A junction is the
    // form Windows creates without elevation, and the type argument is ignored
    // where it is not Windows.
    const decoy = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-launcher-decoy-'));
    try {
        fs.rmdirSync(path.join(dir, '.kit'));
        fs.symlinkSync(decoy, path.join(dir, '.kit'), 'junction');
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        const linked = runLauncher(root, dir);
        assert.strictEqual(linked.status, 0, linked.stderr);
        assert.strictEqual(linked.stdout, FIRST_LINE, 'the line still renders with nowhere to cache it');
        assert.deepStrictEqual(fs.readdirSync(decoy), ['goal-state.json'],
            'and nothing is written through the link');
    } finally {
        rmDir(decoy);
        rmDir(dir);
        rmDir(root);
    }
});

test('the cache write refuses a path that is not a regular file, and leaves no temp file behind', () => {
    const { root } = makePayload();
    const dir = makeRepo();
    try {
        // A directory at the cache path stands in for the rest of the class the
        // kind check refuses (a FIFO, whose write would block this process
        // forever, is the other member and cannot be planted portably here).
        fs.mkdirSync(path.join(dir, CACHE_REL));
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        const res = runLauncher(root, dir);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, FIRST_LINE, 'the line still renders with nowhere to cache it');
        assert.strictEqual(res.stderr, '', 'and the refusal is silent: ' + res.stderr);
        assert.ok(fs.statSync(path.join(dir, CACHE_REL)).isDirectory(), 'what was there is untouched');

        // With the path free again the write lands, through a temp file and a
        // rename, and cleans up after itself.
        fs.rmdirSync(path.join(dir, CACHE_REL));
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE);
        assert.strictEqual(readCache(dir).line, FIRST_LINE, 'the entry is on disk');
        const leftovers = fs.readdirSync(path.join(dir, '.kit')).filter((name) => name.includes('.tmp.'));
        assert.deepStrictEqual(leftovers, [], 'and no temp file survives the write');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('clearing the goal drops the cache, so a later failure draws no retired plan', () => {
    const { root, entry } = makePayload();
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE);
        assert.ok(fs.existsSync(path.join(dir, CACHE_REL)), 'the armed refresh cached its line');

        // What /kit-goal clear leaves behind: no state file, so the render is
        // blank and there is no key to store it under.
        fs.unlinkSync(path.join(dir, '.kit', 'goal-state.json'));
        const cleared = runLauncher(root, dir);
        assert.strictEqual(cleared.stdout, '', 'a cleared goal draws nothing');
        assert.ok(!fs.existsSync(path.join(dir, CACHE_REL)), 'and the retired line is dropped');

        // Why it must be dropped: a failure after the clear would otherwise draw
        // the retired plan as though it were still armed.
        fs.writeFileSync(path.join(entry, 'hooks', 'kit-goal-lib.js'),
            "'use strict';\nmodule.exports = { get goalPath() { throw new Error('boom'); } };\n", 'utf8');
        const res = runLauncher(root, dir);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '', 'nothing armed stays nothing drawn');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a refresh that is already slow draws the cached line instead of starting a render', () => {
    const { root } = makePayload();
    const dir = makeRepo();
    // The saturated box is the case this launcher exists for, and a status-line
    // host kills a command that takes too long, drawing whatever arrived before
    // the kill. The shim spends the budget inside the stdin read, which is this
    // launcher's first act, so what follows it is a refresh whose remaining work
    // (the plan doc's read and its parse) would land after that point.
    const { shimDir, nodeOptions } = makeShim([
        "'use strict';",
        "const fs = require('fs');",
        'const real = fs.readFileSync;',
        'const ms = Number(process.env.KIT_TEST_STALL_MS || 0);',
        'fs.readFileSync = function (target, ...rest) {',
        '    if (target === 0 && ms > 0) {',
        '        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);',
        '    }',
        '    return real.call(fs, target, ...rest);',
        '};'
    ]);
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE, 'the first refresh renders fresh');

        // The plan doc moves, so a render and the cache now disagree and the
        // printed line says which one ran.
        plan(dir, PLAN_REL, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        ageForward(path.join(dir, PLAN_REL), 2);
        const fresh = '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2)';

        // Direction one: inside the budget, the render runs.
        const quick = runLauncher(root, dir, { NODE_OPTIONS: nodeOptions, KIT_TEST_STALL_MS: '50' });
        assert.strictEqual(quick.stdout, fresh, 'a healthy refresh renders rather than reprinting');

        // Direction two: past it, the cached line is drawn and the render is
        // skipped, so the segment is stale rather than absent. The doc moves
        // once more first, since the refresh above left the cache holding what a
        // render now produces and the two have to differ to tell them apart.
        plan(dir, PLAN_REL, [
            '### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing',
            '### Chapter 2', 'Completed: 2. Second thing', 'Next: 3. Third thing'
        ]);
        ageForward(path.join(dir, PLAN_REL), 4);
        const slow = runLauncher(root, dir, { NODE_OPTIONS: nodeOptions, KIT_TEST_STALL_MS: '1200' });
        assert.strictEqual(slow.status, 0, slow.stderr);
        assert.strictEqual(slow.stdout, fresh, 'a spent budget draws the cached line');
    } finally {
        rmDir(shimDir);
        rmDir(dir);
        rmDir(root);
    }
});

test('a plan-doc write during the render costs one re-render, never a permanently stale line', () => {
    const { root } = makePayload();
    const dir = makeRepo();
    // A Chapter landing while the widget is reading the doc is the exact event
    // the Sections count exists to show. The shim writes the doc immediately
    // after the render's read of it and hands the render the text the doc had
    // before, which is that race: the modification time stored beside the line
    // has to be the one from before the read, or the key matches a line the doc
    // no longer says and the count never moves again.
    const planAbs = path.join(dir, PLAN_REL);
    const { shimDir, nodeOptions } = makeShim([
        "'use strict';",
        "const fs = require('fs');",
        'const target = process.env.KIT_TEST_PLAN;',
        'const real = fs.readFileSync;',
        'let done = false;',
        'fs.readFileSync = function (p, ...rest) {',
        '    const text = real.call(fs, p, ...rest);',
        "    if (!done && typeof p === 'string' && p === target) {",
        '        done = true;',
        "        fs.writeFileSync(target, process.env.KIT_TEST_PLAN_NEXT, 'utf8');",
        '        const st = fs.statSync(target);',
        '        const when = new Date(st.mtimeMs + 2000);',
        '        fs.utimesSync(target, when, when);',
        '    }',
        '    return text;',
        '};'
    ]);
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        const after = fs.readFileSync(planAbs, 'utf8')
            + ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing'].join('\n');
        const first = runLauncher(root, dir,
            { NODE_OPTIONS: nodeOptions, KIT_TEST_PLAN: planAbs, KIT_TEST_PLAN_NEXT: after });
        assert.strictEqual(first.stdout, FIRST_LINE, 'the render draws the text it read');

        // The next refresh, with nothing patched: the doc on disk now says one
        // section is done, and the stored key has to miss for that to show.
        assert.strictEqual(runLauncher(root, dir).stdout,
            '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2)',
            'the write that landed during the render is picked up at the next refresh');
    } finally {
        rmDir(shimDir);
        rmDir(dir);
        rmDir(root);
    }
});

test('arming a second plan re-renders, with the first plan doc untouched', () => {
    const { root } = makePayload();
    const dir = makeRepo();
    const second = 'docs/plans/second_spec_v1.md';
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE, 'the first refresh renders fresh');

        // The goal state is the only file that moves here: the first plan doc is
        // left exactly as it was, so that state's own modification time is the
        // only leg of the key able to notice the new arming. Without it the
        // status line names a retired plan while the widget is perfectly healthy.
        plan(dir, second, []);
        arm(dir, { plan: second });
        ageForward(path.join(dir, '.kit', 'goal-state.json'), 2);
        assert.strictEqual(runLauncher(root, dir).stdout,
            '\u{1F3AF} second_spec_v1 · Sections: 0/3 (Next §1)',
            'the newly armed plan is what the status line names');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test("a cached plan path that leaves the project is not stat'ed, and misses", () => {
    const { root } = makePayload();
    const dir = makeRepo();
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-launcher-outside-'));
    const outside = path.join(outsideDir, 'escape.md');
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE, 'the first refresh renders fresh');

        // A hand-edited or repo-carried cache can name any path it likes. The
        // key is only ever taken from a path inside the project, so this entry
        // cannot produce one and the refresh re-renders rather than printing
        // what the entry says.
        fs.writeFileSync(outside, '# not a plan\n', 'utf8');
        const relOut = path.relative(dir, outside).split(path.sep).join('/');
        writeCache(dir, Object.assign({}, readCache(dir), {
            line: 'CACHED',
            plan: relOut,
            planMtimeMs: fs.statSync(outside).mtimeMs
        }));
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE,
            'a plan path outside the project misses the cache');
    } finally {
        rmDir(outsideDir);
        rmDir(dir);
        rmDir(root);
    }
});

test('the project on screen is the one the status-line JSON names, widget or no widget', () => {
    const { root, entry } = makePayload();
    const dir = makeRepo();
    const elsewhere = makeRepo();
    try {
        // A payload whose widget cannot answer where the status line is pointed.
        // The JSON is in hand on exactly that path, so this launcher reads the
        // same two fields itself: falling back to its own working directory
        // would put every path it touches under whatever project the status-line
        // tool happens to run in.
        fs.copyFileSync(WIDGET, path.join(entry, 'scripts', 'real-widget.js'));
        fs.writeFileSync(path.join(entry, 'scripts', 'kit-goal-statusline.js'), [
            "'use strict';",
            "const w = require('./real-widget.js');",
            'module.exports = {',
            '    goalStatePath: w.goalStatePath,',
            '    planKeyMtime: w.planKeyMtime,',
            '    safeLine: w.safeLine,',
            '    renderState: w.renderState',
            '};'
        ].join('\n') + '\n', 'utf8');

        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        const res = runLauncher(root, dir, null, elsewhere);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, FIRST_LINE, 'the named project is what the line describes');
        assert.ok(fs.existsSync(path.join(dir, CACHE_REL)), 'and its cache is the one written');
        assert.ok(!fs.existsSync(path.join(elsewhere, CACHE_REL)),
            'nothing is written under the directory this process happens to run in');
    } finally {
        rmDir(elsewhere);
        rmDir(dir);
        rmDir(root);
    }
});

test('a throw after the line is drawn does not add a second line to the same refresh', () => {
    const { root, entry } = makePayload();
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        assert.strictEqual(runLauncher(root, dir).stdout, FIRST_LINE, 'the first refresh renders fresh');

        // A sentinel in the cache, and a key that misses, so anything reaching
        // the stale-but-drawn fallback prints something a render cannot produce.
        writeCache(dir, Object.assign({}, readCache(dir), { line: 'CACHED' }));
        ageForward(path.join(dir, PLAN_REL), 2);

        // A payload whose render answers with a line and then throws when the
        // launcher reads the rest of that answer. One status-line refresh is one
        // line, so the fallback must not fire behind a line already drawn.
        fs.copyFileSync(WIDGET, path.join(entry, 'scripts', 'real-widget.js'));
        fs.writeFileSync(path.join(entry, 'scripts', 'kit-goal-statusline.js'), [
            "'use strict';",
            "const w = require('./real-widget.js');",
            'module.exports = {',
            '    cwdFromInput: w.cwdFromInput,',
            '    goalStatePath: w.goalStatePath,',
            '    planKeyMtime: w.planKeyMtime,',
            '    safeLine: w.safeLine,',
            '    renderState(cwd) {',
            '        const state = w.renderState(cwd);',
            '        return {',
            '            line: state.line,',
            '            plan: state.plan,',
            "            get planMtimeMs() { throw new Error('boom'); }",
            '        };',
            '    }',
            '};'
        ].join('\n') + '\n', 'utf8');

        const res = runLauncher(root, dir);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, FIRST_LINE, 'the drawn line is the whole output');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a payload whose render reports no plan doc prints, and caches nothing', () => {
    const { root, entry } = makePayload();
    const dir = makeRepo();
    try {
        // The compatibility path: this launcher reaches a machine through the
        // doctor and the payload through a plugin update, so a payload can carry
        // the older render entry, which answers with a line and no plan doc. A
        // line stored under that answer would key on the goal state alone, which
        // no Chapter moves, so nothing is stored.
        fs.copyFileSync(WIDGET, path.join(entry, 'scripts', 'real-widget.js'));
        fs.writeFileSync(path.join(entry, 'scripts', 'kit-goal-statusline.js'), [
            "'use strict';",
            "const w = require('./real-widget.js');",
            'module.exports = {',
            '    cwdFromInput: w.cwdFromInput,',
            '    goalStatePath: w.goalStatePath,',
            '    planKeyMtime: w.planKeyMtime,',
            '    safeLine: w.safeLine,',
            '    render: w.render',
            '};'
        ].join('\n') + '\n', 'utf8');
        arm(dir, { plan: PLAN_REL });
        plan(dir, PLAN_REL, []);
        const res = runLauncher(root, dir);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, FIRST_LINE, 'the older render entry still draws the segment');
        assert.ok(!fs.existsSync(path.join(dir, CACHE_REL)),
            'and nothing is cached under a key that cannot detect a change');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});
