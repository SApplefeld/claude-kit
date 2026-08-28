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

function markerFile(project) {
    return path.join(project, '.kit', 'compact-role-boundary.json');
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

function runHook(f, overrides) {
    const payload = {
        session_id: SESSION,
        cwd: f.project,
        hook_event_name: 'Stop',
        ...(overrides || {})
    };
    const env = { ...process.env, USERPROFILE: f.home, HOME: f.home };
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
        assert.ok(!fs.existsSync(markerFile(f.project)), 'no marker for a session the registry does not carry');
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
        assert.ok(!fs.existsSync(markerFile(f.project)), 'and no marker is opened for it');
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
        assert.ok(fs.existsSync(markerFile(repo)), 'the marker leg reads the status stamp, not the heartbeat');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});

test('seat-stop: a fresh status push over a clean tree opens the boundary marker', () => {
    const f = fixture();
    const repo = makeCleanRepo();
    try {
        writeEntry(f, { statusUpdated: iso(60 * 1000) });
        assertAllowsStop(runHook(f, { cwd: repo }));
        const marker = JSON.parse(fs.readFileSync(markerFile(repo), 'utf8'));
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
        assert.ok(!fs.existsSync(markerFile(repo)), 'no declaration this turn, so no boundary');
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
        assert.ok(!fs.existsSync(markerFile(repo)),
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
        assert.ok(!fs.existsSync(markerFile(repo)), 'work on the tree is not a banked moment');
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
        assert.ok(fs.existsSync(markerFile(f.project)), 'a non-git project directory still banks');
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
        assert.ok(fs.existsSync(markerFile(repo)), 'setup: the hook opened the marker');

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
        assert.ok(!fs.existsSync(markerFile(repo)), 'and the allow consumed it');
    } finally {
        rmDir(repo);
        cleanup(f);
    }
});
