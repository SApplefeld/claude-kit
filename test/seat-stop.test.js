// Tests for plugins/claude-kit/hooks/seat-stop.js (the seat's Stop hook).
//
// The hook makes a goalless seat's compaction boundary structural: at a turn
// end it stamps the session's registry heartbeat and, where that session has
// just pushed status and its tree is clean, opens the role-boundary marker the
// PreCompact gate honors. Every case here runs against a fixture home, so the
// real store at ~/.claude is never read or written: the hook resolves the
// registry under os.homedir(), which follows USERPROFILE and HOME.
//
// The hostname is read at runtime rather than written into a fixture, so no
// machine name ships in this suite.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'seat-stop.js');
const GATE = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-compact-gate.js');

const SESSION = 'ses-11112222-aaaa-bbbb-cccc-333344445555';
const TEN_MINUTES = 10 * 60 * 1000;

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeFile(full, contents) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, 'utf8');
}

function iso(agoMs) {
    return new Date(Date.now() - agoMs).toISOString();
}

// A fixture home plus a project directory outside it. The two are separate
// temp trees so the project's own .kit/ is where the marker is expected, which
// is the ordinary (non-store) branch of the scratch resolution.
function fixture() {
    const home = makeDir('seat-stop-home-');
    const project = makeDir('seat-stop-project-');
    const registryDir = path.join(home, '.claude', 'coordinator', os.hostname(), 'registry');
    return { home, project, registryDir };
}

function cleanup(f) {
    rmDir(f.home);
    rmDir(f.project);
}

function registryFile(f, sessionId) {
    return path.join(f.registryDir, (sessionId || SESSION) + '.md');
}

// The marker the hook opens for one session: one file per session, its id a
// component of the name, so two seats stopping in the same project directory
// open two files rather than renaming over each other.
function markerFile(project, session) {
    return path.join(project, '.kit', 'compact-role-boundary.' + session + '.json');
}

// Every marker file in a project, for a case whose claim is that none was
// written at all rather than that one session's was not.
function markerFiles(project) {
    try {
        return fs.readdirSync(path.join(project, '.kit'))
            .filter((name) => name.startsWith('compact-role-boundary.'));
    } catch {
        return [];
    }
}

// A registry entry in the shape the role skill's directory contract states.
// Every field is present so a case that negates one negates exactly one.
function writeEntry(f, overrides) {
    const o = overrides || {};
    const lines = [
        'Name: KIT: Worker',
        'Role: Worker',
        'Repo: claude-kit',
        'Workdir: claude-kit',
        'Session: ' + (o.session || SESSION),
        'Started: ' + iso(3 * 60 * 60 * 1000),
        'Status-updated: ' + (o.statusUpdated === undefined ? iso(60 * 1000) : o.statusUpdated),
        'Remaining: none'
    ];
    if (o.heartbeat !== null) {
        lines.push('Heartbeat: ' + (o.heartbeat === undefined ? 'none' : o.heartbeat));
    }
    lines.push('', 'Status: working the section', '');
    const full = registryFile(f, o.session);
    writeFile(full, lines.join('\n'));
    return full;
}

// Make the hook see a non-regular file at a path without staging one: a
// preload patches fs.lstatSync to report an EXISTING path as a symlink. A file
// symlink cannot be created on this platform without a privilege the suite must
// not require, and a directory in its place is not a control for it (every read
// fails on one whether or not the guard exists). This shim discriminates: the
// path is an ordinary readable file, so only the guard can refuse it. Same
// shape as the compaction suite's, which screens the marker files this way.
function symlinkReportingPreload(dir, basename) {
    const shim = path.join(dir, 'report-symlink.js');
    writeFile(shim, [
        "'use strict';",
        "const fs = require('fs');",
        'const realLstatSync = fs.lstatSync;',
        'fs.lstatSync = function (target) {',
        '    const st = realLstatSync.apply(fs, arguments);',
        '    if (String(target).endsWith(' + JSON.stringify(basename) + ')) {',
        '        return {',
        '            size: st.size,',
        '            isFile: () => false,',
        '            isDirectory: () => false,',
        '            isSymbolicLink: () => true',
        '        };',
        '    }',
        '    return st;',
        '};'
    ].join('\n') + '\n');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

// One spawn site, and the fixture home is pinned inside it rather than at the
// call sites. extraEnv rides on top for the preload cases; it cannot reach HOME
// or USERPROFILE, which are applied after it.
function runHook(f, overrides, extraEnv) {
    const payload = {
        session_id: SESSION,
        cwd: f.project,
        hook_event_name: 'Stop',
        ...(overrides || {})
    };
    const env = { ...process.env, ...(extraEnv || {}), USERPROFILE: f.home, HOME: f.home };
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        env,
        encoding: 'utf8'
    });
}

// The hook is a backstop, never a hold: every case asserts it allows the stop.
function assertAllowsStop(res) {
    assert.strictEqual(res.status, 0, 'exit 0; stderr: ' + res.stderr);
    assert.strictEqual(res.stdout, '', 'nothing on stdout, so the harness reads no decision');
}

function fieldOf(full, field) {
    const m = new RegExp('^' + field + ': *(.*)$', 'm').exec(fs.readFileSync(full, 'utf8'));
    return m === null ? null : m[1].trim();
}

function git(args, cwd) {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

// A git repository with nothing in it, so `git status --porcelain` is empty.
function makeCleanRepo() {
    const repo = makeDir('seat-stop-repo-');
    const init = git(['init', '-q'], repo);
    assert.strictEqual(init.status, 0, 'test setup: git init should succeed');
    const status = git(['status', '--porcelain'], repo);
    assert.strictEqual(status.stdout, '', 'test setup: a fresh repo reads clean');
    return repo;
}

test('seat-stop: an unregistered session is silent, and the silence is the registry-file leg', () => {
    const f = fixture();
    try {
        // No entry is written at all, so the only rule that can refuse here is
        // the registry-file stat: every later leg reads that file's contents.
        fs.mkdirSync(f.registryDir, { recursive: true });
        assertAllowsStop(runHook(f));
        assert.ok(!fs.existsSync(markerFile(f.project, SESSION)), 'no marker for a session the registry does not carry');
        assert.deepStrictEqual(fs.readdirSync(f.registryDir), [], 'and nothing is created under registry/');
    } finally {
        cleanup(f);
    }
});

test('seat-stop: a session id that is not id-shaped is silent before any path is joined', () => {
    const f = fixture();
    try {
        // The refusing rule is the id shape check, and this case is built so
        // that it is the only one that can refuse: a real entry is planted at
        // the traversal's own destination, so a hook that composed the path
        // and then merely failed to find a file would still find one here and
        // act on it. Silence therefore means the value never became a path.
        const escape = '../../planted';
        const planted = path.join(f.registryDir, escape + '.md');
        writeFile(planted, [
            'Name: KIT: Worker',
            'Session: ' + SESSION,
            'Status-updated: ' + iso(60 * 1000),
            'Heartbeat: none',
            '',
            'Status: planted',
            ''
        ].join('\n'));
        assertAllowsStop(runHook(f, { session_id: escape }));
        assert.strictEqual(fieldOf(planted, 'Heartbeat'), 'none', 'the planted entry is not stamped');
        assert.deepStrictEqual(markerFiles(f.project), [],
            'and no marker is opened for it, under any name: the claim is that the id never '
            + 'became a path, not that one session\'s file is absent');
    } finally {
        cleanup(f);
    }
});

test('seat-stop: a registered session gets its heartbeat stamped', () => {
    const f = fixture();
    try {
        const entry = writeEntry(f, { heartbeat: 'none' });
        assertAllowsStop(runHook(f));
        const stamp = fieldOf(entry, 'Heartbeat');
        assert.notStrictEqual(stamp, 'none', 'the takeover placeholder is replaced');
        assert.ok(Math.abs(Date.now() - Date.parse(stamp)) < 60 * 1000, 'stamped at about now: ' + stamp);
        // The stamp is the only line the hook rewrites.
        assert.strictEqual(fieldOf(entry, 'Name'), 'KIT: Worker');
        assert.strictEqual(fieldOf(entry, 'Status-updated') === null, false);
        assert.ok(fs.readFileSync(entry, 'utf8').includes('Status: working the section'),
            'the session\'s own Status block survives');
    } finally {
        cleanup(f);
    }
});

test('seat-stop: the stamp reaches the heartbeat and no declaration field', () => {
    const f = fixture();
    try {
        // `Status-updated:` is the seat's own declaration and the marker leg
        // below reads it as one, so a hook that stamped it would be reading its
        // own writing and every turn end would bank a boundary nobody declared.
        // The heartbeat assertion is the control: the hook did run and did
        // write, so the untouched declaration is a bound rather than a no-op.
        const declared = iso(30 * 60 * 1000);
        const entry = writeEntry(f, { heartbeat: 'none', statusUpdated: declared });
        const started = fieldOf(entry, 'Started');
        assertAllowsStop(runHook(f));
        assert.notStrictEqual(fieldOf(entry, 'Heartbeat'), 'none', 'the hook wrote the entry');
        assert.strictEqual(fieldOf(entry, 'Status-updated'), declared,
            'and left the declaration exactly as the seat wrote it');
        assert.strictEqual(fieldOf(entry, 'Started'), started,
            'and the takeover stamp with it');
    } finally {
        cleanup(f);
    }
});

test('seat-stop: a heartbeat fresher than the throttle window is left alone', () => {
    const f = fixture();
    try {
        const fresh = iso(TEN_MINUTES - 60 * 1000);
        const entry = writeEntry(f, { heartbeat: fresh });
        assertAllowsStop(runHook(f));
        assert.strictEqual(fieldOf(entry, 'Heartbeat'), fresh, 'the throttle refused the write');
    } finally {
        cleanup(f);
    }
});

test('seat-stop: a heartbeat past the throttle window is restamped', () => {
    const f = fixture();
    try {
        const stale = iso(TEN_MINUTES + 60 * 1000);
        const entry = writeEntry(f, { heartbeat: stale });
        assertAllowsStop(runHook(f));
        assert.notStrictEqual(fieldOf(entry, 'Heartbeat'), stale, 'past the window the stamp is taken');
    } finally {
        cleanup(f);
    }
});

test('seat-stop: an entry carrying no Heartbeat line is not restructured, and the marker leg still runs', () => {
    const f = fixture();
    const repo = makeCleanRepo();
    try {
        const entry = writeEntry(f, { heartbeat: null });
        const before = fs.readFileSync(entry, 'utf8');
        assertAllowsStop(runHook(f, { cwd: repo }));
        assert.strictEqual(fs.readFileSync(entry, 'utf8'), before,
            'the hook stamps a line the contract puts there and adds none');
        assert.ok(fs.existsSync(markerFile(repo, SESSION)), 'the marker leg reads the status stamp, not the heartbeat');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});

test('seat-stop: an entry path reported as a link is refused rather than followed', () => {
    // The hook renames over the path it read, so it judges that path with
    // lstat: a link there is a link rather than whatever it points at. This is
    // the same screen the boundary verb's `Banked:` stamp takes, and it is the
    // same code, both stamps reading and writing the entry through one shared
    // channel in kit-compact-lib.js rather than through two copies of it.
    //
    // The refusal is total by design: an entry the screen refuses tells the
    // hook nothing about the seat's status push either, so neither leg runs.
    const f = fixture();
    const repo = makeCleanRepo();
    const shimDir = makeDir('seat-stop-shim-');
    try {
        const entry = writeEntry(f, { heartbeat: iso(30 * 60 * 1000) });
        const before = fs.readFileSync(entry, 'utf8');
        assert.ok(/^Heartbeat:/m.test(before), 'setup: a stale heartbeat the hook would restamp');

        assertAllowsStop(runHook(f, { cwd: repo },
            { NODE_OPTIONS: symlinkReportingPreload(shimDir, SESSION + '.md') }));

        assert.strictEqual(fs.readFileSync(entry, 'utf8'), before,
            'nothing is written through the refused path');
        assert.ok(!fs.existsSync(markerFile(repo, SESSION)),
            'and the marker leg, which rests on that same unread entry, opens nothing');
    } finally {
        rmDir(shimDir);
        rmDir(repo);
        cleanup(f);
    }
});

test('seat-stop: the heartbeat stamp has no atomic write of its own', () => {
    // The lstat case above pins the read screen behaviourally. The write's own
    // three defences (an unguessable temporary, an exclusive create, a cleanup
    // that removes only what this writer made) cannot be staged from outside
    // the process, so what is pinned instead is that there is nothing here to
    // stage: this hook owns no write of its own and goes out through the shared
    // channel, where those defences live once. A re-inlined write is how the
    // defect this replaced got in, one copy drifting from its sibling, so the
    // pin is over the absence of a second copy rather than over its contents.
    const source = fs.readFileSync(HOOK, 'utf8');
    assert.ok(/writeRegistryEntryAtomic\(/.test(source),
        'the hook no longer writes the entry through the shared atomic write');

    // The patterns are over the CLASS of writes rather than over the three
    // calls the drifted copy happened to use: a re-inlined plain
    // fs.writeFileSync onto the entry path is worse than what was removed, and
    // a pattern naming a rename and a temporary suffix reads it as clean. Every
    // way this module could put bytes on disk is what is forbidden, and the
    // hook's own reads (fs.readFileSync of stdin) are untouched by it.
    const WRITE_FORMS = [
        [/fs\.write\w*\(/, 'a write of its own'],
        [/fs\.rename\w*\(/, 'a rename of its own'],
        [/fs\.copyFile\w*\(/, 'a copy of its own'],
        [/fs\.unlink\w*\(/, 'a cleanup unlink of its own'],
        [/\.tmp\./, 'a temporary path of its own']
    ];
    for (const [pattern, what] of WRITE_FORMS) {
        assert.ok(!pattern.test(source),
            'the hook has grown ' + what + ', which is a second implementation of '
            + 'the shared registry-entry write and the shape that drifted before');
    }

    // The control is the defect a narrower pin would have missed: a plain
    // rewrite of the entry in place, naming no temporary and no rename, which
    // the three literals this pin used to carry do not reach. It is matched on
    // the shape of an fs write rather than on any literal handed to the test,
    // and it is composed rather than written out, so it is not itself a hit in
    // the source read above.
    const inlined = source + '\nfs.write' + 'FileSync(full, stamped, \'utf8\');\n';
    assert.ok(WRITE_FORMS.some(([pattern]) => pattern.test(inlined)),
        'the patterns speak for a plain in-place rewrite, the form the old literals missed');
    assert.ok(!/renameSync|\.tmp\./.test(inlined),
        'and that form carries neither of the marks the old pin looked for');
});

test('seat-stop: a fresh status push over a clean tree opens the boundary marker', () => {
    const f = fixture();
    const repo = makeCleanRepo();
    try {
        writeEntry(f, { statusUpdated: iso(60 * 1000) });
        assertAllowsStop(runHook(f, { cwd: repo }));
        const marker = JSON.parse(fs.readFileSync(markerFile(repo, SESSION), 'utf8'));
        assert.strictEqual(marker.session, SESSION, 'the marker is scoped to the stopping session');
        assert.strictEqual(marker.consumed, false, 'and is written live');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});

test('seat-stop: a stale status push opens no marker, and the heartbeat is still stamped', () => {
    const f = fixture();
    const repo = makeCleanRepo();
    try {
        // The refusing rule is the status-freshness leg alone: the tree is
        // clean and the entry is present, so nothing else here can refuse.
        const entry = writeEntry(f, { statusUpdated: iso(TEN_MINUTES + 60 * 1000) });
        assertAllowsStop(runHook(f, { cwd: repo }));
        assert.ok(!fs.existsSync(markerFile(repo, SESSION)), 'no declaration this turn, so no boundary');
        assert.notStrictEqual(fieldOf(entry, 'Heartbeat'), 'none', 'the heartbeat leg is independent');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});

test('seat-stop: a status stamp in the future opens no marker', () => {
    const f = fixture();
    const repo = makeCleanRepo();
    try {
        // The refusing rule is the freshness check's own lower bound: a stamp
        // ahead of now is not fresh, because reading one as fresh would open a
        // window that closes only when the clock catches up to it, and a stamp
        // an hour ahead would then bank a boundary at every turn end for an
        // hour. The case above, a stale stamp, is the same leg's other side,
        // and the fresh-push case is the control that proves this tree and this
        // entry would otherwise bank.
        const entry = writeEntry(f, { statusUpdated: iso(-60 * 60 * 1000) });
        assertAllowsStop(runHook(f, { cwd: repo }));
        assert.ok(!fs.existsSync(markerFile(repo, SESSION)),
            'a declaration timestamped in the future declares nothing');
        assert.notStrictEqual(fieldOf(entry, 'Heartbeat'), 'none',
            'and the heartbeat leg is independent of it');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});

test('seat-stop: a dirty tree opens no marker even on a fresh status push', () => {
    const f = fixture();
    const repo = makeCleanRepo();
    try {
        // The refusing rule is the tree-state leg alone: the status stamp is
        // fresh, so the case above is its control.
        writeFile(path.join(repo, 'work-in-progress.txt'), 'half done\n');
        assert.notStrictEqual(git(['status', '--porcelain'], repo).stdout, '', 'test setup: the tree reads dirty');
        writeEntry(f, { statusUpdated: iso(60 * 1000) });
        assertAllowsStop(runHook(f, { cwd: repo }));
        assert.ok(!fs.existsSync(markerFile(repo, SESSION)), 'work on the tree is not a banked moment');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});

test('seat-stop: a project directory that is not a git checkout reads as clean and gets its marker', () => {
    const f = fixture();
    try {
        // Fail-open, deliberately: the marker's worst case is a compaction at
        // a boundary the session declared, and a seat whose project directory
        // is not a repository has no tree to be mid-work on.
        assert.notStrictEqual(git(['rev-parse', '--show-toplevel'], f.project).status, 0,
            'test setup: the project directory is not inside a git repository');
        writeEntry(f, { statusUpdated: iso(60 * 1000) });
        assertAllowsStop(runHook(f));
        assert.ok(fs.existsSync(markerFile(f.project, SESSION)), 'a non-git project directory still banks');
    } finally {
        cleanup(f);
    }
});

test('seat-stop: the marker it opens is the one the compaction gate honors, journaled as role-boundary', () => {
    // The full path Fork 2 called non-negotiable: the hook writes the marker
    // at a turn end and the gate then allows a deferred auto-compaction for
    // that session with reason role-boundary. Nothing hand-writes the marker.
    const f = fixture();
    const repo = makeCleanRepo();
    try {
        writeEntry(f, { statusUpdated: iso(60 * 1000) });
        assertAllowsStop(runHook(f, { cwd: repo }));
        assert.ok(fs.existsSync(markerFile(repo, SESSION)), 'setup: the hook opened the marker');

        const transcript = path.join(repo, 'transcript.jsonl');
        writeFile(transcript, [
            JSON.stringify({ type: 'user', message: { role: 'user', content: 'talking it through' } }),
            JSON.stringify({
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: [{ type: 'text', text: 'Thinking.' }],
                    usage: { input_tokens: 49000, cache_creation_input_tokens: 600, cache_read_input_tokens: 400 }
                }
            })
        ].join('\n') + '\n');

        const env = { ...process.env, USERPROFILE: f.home, HOME: f.home };
        for (const key of Object.keys(env)) {
            if (/^KIT_EXTERNAL_ENGINE$/i.test(key)) delete env[key];
        }
        const gate = spawnSync(process.execPath, [GATE], {
            input: JSON.stringify({
                session_id: SESSION,
                transcript_path: transcript,
                cwd: repo,
                hook_event_name: 'PreCompact',
                trigger: 'auto'
            }),
            env,
            encoding: 'utf8'
        });
        assert.strictEqual(gate.status, 0, 'the gate allows; stderr: ' + gate.stderr);

        const state = JSON.parse(fs.readFileSync(path.join(repo, '.kit', 'compact-gate.json'), 'utf8'));
        assert.strictEqual(state.lastDecision.verdict, 'allow');
        assert.strictEqual(state.lastDecision.reason, 'role-boundary',
            'the release the hook earned is the one journaled');
        assert.ok(!fs.existsSync(markerFile(repo, SESSION)), 'and the allow consumed it');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});
