// Tests for the plugin-view staleness notice in
// plugins/claude-kit/hooks/session-start.js.
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout. The subject is the notice's three readings and the two comparisons
// over them: this session's own plugin view (the sha the running plugin root
// is named for), the version the machine has installed, and this checkout's
// HEAD. Which side of a comparison lags is a claim at a level, session-level
// for the frozen view and machine-level for the install, and the notice says
// which it is making, because a session-level fact reported as a machine-level
// one sends its reader to update a machine that is already current.
//
// Each case builds a fresh temp project carrying a copy of a real git history, a
// fresh temp home holding the install record, and a plugin root directory named
// for the sha this session is to have loaded. The home redirect
// (USERPROFILE/HOME, what os.homedir() reads) is what keeps the install reading
// off the real machine's record, and CLAUDE_PLUGIN_ROOT is what keeps the view
// reading off the plugin this suite is itself running under.

'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');

const NOTICE_LEAD = 'Kit version check.';
const SESSION_LEVEL = 'Session-level:';
const MACHINE_LEVEL = 'Machine-level:';

// Fixture commits carry their own identity and configuration so the history a
// case builds does not depend on this machine's git identity, its global config,
// or any GIT_* variable the session running the suite happens to carry. The two
// config files are named inside the fixture's own directory rather than in the
// shared temp root, which is world-writable on POSIX: a fixed name there is one
// another local user can pre-create, and every fixture command would then run
// under a config somebody else wrote.
function gitEnv(dir) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^GIT_/i.test(k)) delete env[k];
    }
    env.GIT_AUTHOR_NAME = 'kit fixture';
    env.GIT_AUTHOR_EMAIL = 'fixture@example.invalid';
    env.GIT_COMMITTER_NAME = 'kit fixture';
    env.GIT_COMMITTER_EMAIL = 'fixture@example.invalid';
    env.GIT_CONFIG_GLOBAL = path.join(dir, 'absent.gitconfig');
    env.GIT_CONFIG_SYSTEM = path.join(dir, 'absent.gitconfig');
    return env;
}

function git(dir, args) {
    const res = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: gitEnv(dir) });
    assert.strictEqual(res.status, 0, 'git ' + args.join(' ') + ': ' + (res.stderr || res.error));
    return res.stdout.trim();
}

// A project directory, a home directory beside it, and (for a kit project) the
// plugin manifest at the fixed path the hook's kit-repo marker reads.
function makeProject({ kit = true } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-plugin-view-test-'));
    fs.mkdirSync(path.join(dir, 'home', '.claude', 'plugins'), { recursive: true });
    if (kit) {
        const manifest = path.join(dir, 'plugins', 'claude-kit', '.claude-plugin');
        fs.mkdirSync(manifest, { recursive: true });
        fs.writeFileSync(path.join(manifest, 'plugin.json'), '{"name":"claude-kit"}\n', 'utf8');
    }
    return dir;
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// The ancestry cases are driven by which of two real commits the install record
// names, so the history has to be a real one: `git merge-base --is-ancestor` is
// the hook's only source of direction, and no fabricated pair of shas exercises
// it. Building one costs several git spawns and every case wants the same two
// commits, so it is built once per process and copied per case; a case that
// moves HEAD or adds a commit does so to its own copy.
let template = null;

function historyTemplate() {
    if (template === null) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-plugin-view-template-'));
        git(dir, ['init', '-q', '.']);
        fs.writeFileSync(path.join(dir, 'seed.txt'), 'first\n', 'utf8');
        git(dir, ['add', '-A']);
        git(dir, ['commit', '-q', '-m', 'first']);
        const first = git(dir, ['rev-parse', 'HEAD']);
        fs.writeFileSync(path.join(dir, 'seed.txt'), 'second\n', 'utf8');
        git(dir, ['add', '-A']);
        git(dir, ['commit', '-q', '-m', 'second']);
        const second = git(dir, ['rev-parse', 'HEAD']);
        template = { dir, first, second };
    }
    return template;
}

after(() => { if (template !== null) rmDir(template.dir); });

// The two-commit history, in this case's own project directory, with HEAD on
// the second commit.
function history(dir) {
    const t = historyTemplate();
    fs.cpSync(path.join(t.dir, '.git'), path.join(dir, '.git'), { recursive: true });
    fs.copyFileSync(path.join(t.dir, 'seed.txt'), path.join(dir, 'seed.txt'));
    return { first: t.first, second: t.second };
}

// A third commit on top of the copied history, for the case where all three
// readings differ.
function thirdCommit(dir) {
    fs.writeFileSync(path.join(dir, 'seed.txt'), 'third\n', 'utf8');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'third']);
    return git(dir, ['rev-parse', 'HEAD']);
}

// A commit with no parent, so no ancestry runs in either direction between it
// and the history above. It is made with plumbing over git's always-present
// empty tree, which leaves HEAD, the index and the working tree exactly as the
// caller had them: a branch checkout would take the kit marker this project
// carries out of the working tree, and the notice is scoped to a project that
// has one.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function unrelatedCommit(dir) {
    return git(dir, ['commit-tree', EMPTY_TREE, '-m', 'unrelated']);
}

// The machine's install record, in the shape the harness writes: one array per
// <plugin>@<marketplace> key, each entry carrying the full sha and a 12-character
// prefix of it. The marketplace half of the key varies by operator, so cases
// that vary it prove the match is on the plugin half.
function writeInstalled(dir, entries, { key = 'claude-kit@applefeld', raw = null } = {}) {
    const file = path.join(dir, 'home', '.claude', 'plugins', 'installed_plugins.json');
    if (raw !== null) {
        fs.writeFileSync(file, raw, 'utf8');
        return;
    }
    const record = { version: 2, plugins: {} };
    // A second plugin, versioned by semver rather than by commit, sits in the
    // real record beside this kit's entry and must not be read as a version of
    // it.
    record.plugins['fakechat@claude-plugins-official'] = [{
        scope: 'user', version: '0.0.1', gitCommitSha: '0'.repeat(40)
    }];
    record.plugins[key] = entries;
    fs.writeFileSync(file, JSON.stringify(record, null, 2), 'utf8');
}

// The timestamps are synthetic constants: an install record is machine data, and
// a fixture in a public repository carries none of it.
function installedEntry(sha) {
    return {
        scope: 'user',
        installPath: path.join('cache', 'applefeld', 'claude-kit', sha.slice(0, 12)),
        version: sha.slice(0, 12),
        installedAt: '2020-01-01T00:00:00.000Z',
        lastUpdated: '2020-01-02T00:00:00.000Z',
        gitCommitSha: sha
    };
}

// Spawn the hook against a fixture project with a fixture home. process.env is
// spread rather than rebuilt so the child keeps its real PATH (a rebuilt env
// object loses the Windows `Path` key, and the hook shells out to git), and
// every casing of the home, plugin-root and external-engine variables is
// dropped before the fixture values are set, since Windows carries both casings
// and the suite runs under a plugin root of its own. Every GIT_* variable goes
// too, so no repository this session was started from can reach the hook.
//
// A viewSha of null leaves CLAUDE_PLUGIN_ROOT unset, which is the real
// unreadable-view shape: the hook then falls back to its own parent directory,
// whose basename is `claude-kit` rather than a sha.
function runHook(dir, viewSha, extra) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^(USERPROFILE|HOME|KIT_EXTERNAL_ENGINE|CLAUDE_PLUGIN_ROOT)$/i.test(k)) delete env[k];
        if (/^GIT_/i.test(k)) delete env[k];
    }
    env.USERPROFILE = path.join(dir, 'home');
    env.HOME = path.join(dir, 'home');
    if (viewSha) {
        const root = path.join(dir, 'views', viewSha);
        fs.mkdirSync(root, { recursive: true });
        env.CLAUDE_PLUGIN_ROOT = root;
    }
    Object.assign(env, extra || {});
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd: dir }),
        encoding: 'utf8',
        env
    });
}

// The context block the hook injected, or '' when it stayed silent.
function context(dir, viewSha, extra) {
    const res = runHook(dir, viewSha, extra);
    assert.strictEqual(res.status, 0, res.stderr);
    if (!res.stdout) return '';
    return JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
}

// One block out of the injected context, by its lead-in. Blocks are joined with
// a blank line, so a block runs to the next one. Returns '' when the block is
// absent, which is the answer an assertion about a block that should not have
// been emitted at all is making.
function block(text, lead) {
    const start = text.indexOf(lead);
    if (start === -1) return '';
    const end = text.indexOf('\n\n', start);
    return end === -1 ? text.slice(start) : text.slice(start, end);
}

// The view is frozen at session start, so a difference between it and the
// install is normally a fact about this session rather than about the machine.
// The notice names the view as the trailing side and asks for a restart, the one
// act that moves it.
test('a session view behind the install is stated session-level, with a restart', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        writeInstalled(dir, [installedEntry(second)]);
        // HEAD is the installed commit, so the machine-level comparison has
        // nothing to say and the session-level one is alone in the notice.
        const notice = block(context(dir, first.slice(0, 12)), NOTICE_LEAD);

        assert.ok(notice.includes(SESSION_LEVEL),
            'the trailing view is stated at session level: ' + notice);
        assert.ok(notice.includes(first.slice(0, 12)), 'the notice names the view sha: ' + notice);
        assert.ok(notice.includes(second), 'the notice names the installed sha: ' + notice);
        assert.match(notice, /restart the session/);
        assert.ok(!notice.includes(MACHINE_LEVEL),
            'a current install is not reported as a machine-level lag: ' + notice);
        assert.ok(!notice.includes('claude plugin update'),
            'a session-level lag does not prescribe a machine-level remedy: ' + notice);
    } finally { rmDir(dir); }
});

// The install is an ancestor of HEAD, which is the one reading that makes the
// install the trailing side. Direction is ancestry alone: two shas are
// unordered, so inequality here would name a side without evidence.
test('an install that is an ancestor of HEAD trails the checkout, with the update command', () => {
    const dir = makeProject();
    try {
        const { first } = history(dir);
        writeInstalled(dir, [installedEntry(first)]);
        // The view is the installed commit, so the session-level comparison is
        // silent and the machine-level one is alone in the notice.
        const notice = block(context(dir, first.slice(0, 12)), NOTICE_LEAD);

        assert.ok(notice.includes(MACHINE_LEVEL),
            'the trailing install is stated at machine level: ' + notice);
        assert.match(notice, /the machine's install trails this checkout/);
        assert.match(notice, /claude plugin update/);
        assert.ok(!notice.includes(SESSION_LEVEL),
            'a view matching the install raises no session-level claim: ' + notice);
        assert.ok(!notice.includes('direction unknown'),
            'an ancestry git answered is not reported as undecided: ' + notice);
    } finally { rmDir(dir); }
});

// All three readings distinct: the session's view frozen at an older commit, the
// install advanced past it, and the checkout advanced past the install. This is
// the state that hands the reader both remedies, and they are ordered acts: a
// restart taken before the install is updated loads the same trailing kit again,
// so the update is stated first.
test('a view, an install and a HEAD that all differ carry both remedies, update before restart', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        const third = thirdCommit(dir);
        writeInstalled(dir, [installedEntry(second)]);
        const notice = block(context(dir, first.slice(0, 12)), NOTICE_LEAD);

        assert.ok(notice.includes(MACHINE_LEVEL) && notice.includes(SESSION_LEVEL),
            'both comparisons speak in one notice: ' + notice);
        assert.match(notice, /the machine's install trails this checkout/);
        assert.match(notice, /restart the session/);
        assert.ok(notice.includes(third), 'the notice names the checkout HEAD: ' + notice);
        assert.ok(notice.indexOf('claude plugin update') < notice.indexOf('restart the session'),
            'the update is offered before the restart it must precede: ' + notice);
        assert.ok(notice.indexOf(MACHINE_LEVEL) < notice.indexOf(SESSION_LEVEL),
            'the machine-level part leads: ' + notice);
    } finally { rmDir(dir); }
});

// A session an external engine spawned has no operator at its keyboard and
// cannot restart itself, so the readings reach it as information with neither
// remedy attached.
test('under the external-engine marker the readings carry no remedy', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        thirdCommit(dir);
        writeInstalled(dir, [installedEntry(second)]);
        const worker = block(context(dir, first.slice(0, 12), { KIT_EXTERNAL_ENGINE: '1' }), NOTICE_LEAD);

        assert.ok(worker.includes(MACHINE_LEVEL) && worker.includes(SESSION_LEVEL),
            'both readings are still stated: ' + worker);
        assert.ok(worker.includes(second), 'the installed sha is named: ' + worker);
        assert.ok(!worker.includes('claude plugin update'),
            'a spawned worker is not told to update the machine: ' + worker);
        assert.ok(!worker.includes('restart the session'),
            'nor to restart a session it cannot restart: ' + worker);

        // The control: the same fixture without the marker does carry both
        // remedies, so their absence above is the marker and not a notice that
        // never states one.
        const attended = block(context(dir, first.slice(0, 12)), NOTICE_LEAD);
        assert.match(attended, /claude plugin update/);
        assert.match(attended, /restart the session/);
    } finally { rmDir(dir); }
});

// The reverse ancestry. The checkout is the side that lags, and no remedy is
// prescribed: what a checkout behind the install should do is its operator's
// call, and an update or a restart would both be the wrong act.
test('a HEAD that is an ancestor of the install leaves the checkout behind, with no remedy', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        git(dir, ['checkout', '-q', first]);
        writeInstalled(dir, [installedEntry(second)]);
        const notice = block(context(dir, second.slice(0, 12)), NOTICE_LEAD);

        assert.ok(notice.includes(MACHINE_LEVEL), 'the comparison is machine level: ' + notice);
        assert.match(notice, /this checkout is behind the machine's install/);
        assert.ok(!notice.includes('claude plugin update'),
            'a checkout behind its install is not told to update the install: ' + notice);
        assert.ok(!notice.includes('restart the session'),
            'nor to restart the session: ' + notice);
        assert.ok(!notice.includes('direction unknown'),
            'the direction is the one ancestry gave: ' + notice);
    } finally { rmDir(dir); }
});

// Two commits git can compare, neither containing the other. That is the
// ordinary shape of a branch cut before the installed commit, so it is stated
// as two histories that parted rather than as a question nobody could answer.
test('two commits with no ancestry between them are stated as histories that parted', () => {
    const dir = makeProject();
    try {
        history(dir);
        const unrelated = unrelatedCommit(dir);
        writeInstalled(dir, [installedEntry(unrelated)]);
        const notice = block(context(dir, unrelated.slice(0, 12)), NOTICE_LEAD);

        assert.ok(notice.includes(MACHINE_LEVEL), 'the comparison is machine level: ' + notice);
        assert.match(notice, /neither an ancestor of the other/);
        assert.match(notice, /the two histories have parted/);
        assert.ok(!notice.includes('direction unknown'),
            'git answered both questions here, so nothing is undecided: ' + notice);
        assert.ok(!notice.includes('claude plugin update'),
            'parted histories prescribe nothing: ' + notice);
        assert.ok(!notice.includes('trails this checkout'), notice);
        assert.ok(!notice.includes('checkout is behind'), notice);
    } finally { rmDir(dir); }
});

// A sha this checkout holds no object for is what an install from a fork or an
// unfetched branch looks like from in here. git answers neither ancestry
// question, and an unanswered question is stated as unknown rather than read as
// a no in either direction.
test('an installed sha absent from the checkout is reported as differing, direction unknown', () => {
    const dir = makeProject();
    try {
        history(dir);
        const absent = 'abcdef0123456789abcdef0123456789abcdef01';
        writeInstalled(dir, [installedEntry(absent)]);
        const notice = block(context(dir, absent.slice(0, 12)), NOTICE_LEAD);

        assert.ok(notice.includes(MACHINE_LEVEL), 'the comparison is machine level: ' + notice);
        assert.match(notice, /direction unknown/);
        assert.ok(!notice.includes('the two histories have parted'),
            'an unanswerable question is not stated as an answer: ' + notice);
    } finally { rmDir(dir); }
});

// The healthy state. A 12-character cache sha and a 40-hex install sha are two
// spellings of one commit, so they are compared over the shorter length: an
// equality test would call every aligned machine stale.
test('three aligned readings raise no notice at all', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        writeInstalled(dir, [installedEntry(second)]);
        const text = context(dir, second.slice(0, 12));
        assert.strictEqual(block(text, NOTICE_LEAD), '',
            'an aligned session, install and checkout have nothing to report: ' + text);

        // The control: the same fixture with only the view moved does speak, so
        // the silence above is the comparison agreeing rather than a notice that
        // never fires.
        assert.notStrictEqual(block(context(dir, first.slice(0, 12)), NOTICE_LEAD), '',
            'the notice fires when a reading moves');
    } finally { rmDir(dir); }
});

// A plugin is installable at more than one scope, so the record's per-key value
// is an array. The entry this session is running from is the one whose
// installPath leaf names the session's own plugin view, and that is the entry
// the reading takes.
test('the install entry matching this session\'s plugin view is the one read', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        writeInstalled(dir, [installedEntry(first), installedEntry(second)]);
        // The view and HEAD are both the second commit, which the second entry
        // names: all three readings agree and the notice has nothing to say.
        const text = context(dir, second.slice(0, 12));
        assert.strictEqual(block(text, NOTICE_LEAD), '',
            'the entry naming this session\'s view is the machine\'s reading here: ' + text);

        // The control: with the matching entry gone, the remaining one is read
        // and the same session does get a notice, so the silence above is the
        // preference and not a fixture that cannot speak.
        writeInstalled(dir, [installedEntry(first)]);
        const notice = block(context(dir, second.slice(0, 12)), NOTICE_LEAD);
        assert.ok(notice.includes(SESSION_LEVEL) || notice.includes(MACHINE_LEVEL),
            'the unmatched entry is still a reading: ' + notice);
    } finally { rmDir(dir); }
});

// An unreadable surface drops its own comparison and nothing else. Each case
// below pairs the silence with a control that moves only the unreadable
// surface, so a silence can be read as the drop rather than as a notice that
// never fires.
test('a plugin root that names no sha drops the session-level comparison alone', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        writeInstalled(dir, [installedEntry(second)]);
        // HEAD is the installed commit, so the session-level comparison is the
        // only one with anything to say, and without a view reading there is no
        // notice at all.
        const text = context(dir, null);
        assert.strictEqual(block(text, NOTICE_LEAD), '',
            'a plugin root named `claude-kit` is a directory name, not a version: ' + text);

        const notice = block(context(dir, first.slice(0, 12)), NOTICE_LEAD);
        assert.ok(notice.includes(SESSION_LEVEL),
            'the same fixture with a sha-named plugin root does report the lag');
    } finally { rmDir(dir); }
});

test('an absent, malformed or unmatched install record drops both comparisons', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        const view = first.slice(0, 12);

        // Absent: the file the record lives in has never been written.
        assert.strictEqual(block(context(dir, view), NOTICE_LEAD), '',
            'no install record is no reading');

        // Malformed: a torn or hand-edited record parses to nothing.
        writeInstalled(dir, [], { raw: '{"version": 2, "plugins": {' });
        assert.strictEqual(block(context(dir, view), NOTICE_LEAD), '',
            'an unparseable install record is no reading');

        // Structurally present and empty: the key is there with no entry under
        // it. A key whose plugin half is another plugin's rides in the same
        // record, and this kit is not installed as far as either says.
        writeInstalled(dir, []);
        assert.strictEqual(block(context(dir, view), NOTICE_LEAD), '',
            'an empty entry array is no reading');
        writeInstalled(dir, [installedEntry(second)], { key: 'other-kit@applefeld' });
        assert.strictEqual(block(context(dir, view), NOTICE_LEAD), '',
            'another plugin\'s entry is not this kit\'s install');

        // Entries carrying no commit: one that is not an object, one whose only
        // version is a semver, and one whose version is a digits-only build
        // number, which any hex test reads as a sha. The reading is the 40-hex
        // gitCommitSha or nothing, so all three are nothing.
        writeInstalled(dir, [
            '5edb4483fd03',
            { scope: 'user', version: '1.2.3' },
            { scope: 'user', version: '20260828' }
        ]);
        assert.strictEqual(block(context(dir, view), NOTICE_LEAD), '',
            'an entry with no gitCommitSha is no reading, whatever its version says');

        // Past the read ceiling: the record is read up to a megabyte, and part
        // of a record answers nothing about the installed version. A version
        // this hook cannot establish is one it must not report, so a bounded
        // read is no reading rather than a partial one.
        // The record is otherwise well formed and names an entry a whole read
        // would report on, so what the silence measures is the ceiling.
        const oversized = {
            version: 2,
            plugins: { 'claude-kit@applefeld': [installedEntry(second)] },
            comment: 'x'.repeat(1024 * 1024)
        };
        writeInstalled(dir, [], { raw: JSON.stringify(oversized) });
        assert.ok(fs.statSync(path.join(dir, 'home', '.claude', 'plugins', 'installed_plugins.json')).size
            > 1024 * 1024, 'the fixture must be larger than the read ceiling');
        assert.strictEqual(block(context(dir, view), NOTICE_LEAD), '',
            'a record past the read ceiling is no reading');

        // The control for all of them: a well-formed entry under a key whose
        // marketplace half is some other operator's still matches, since the
        // plugin half is the part that identifies the kit.
        writeInstalled(dir, [installedEntry(second)], { key: 'claude-kit@someone-else' });
        const notice = block(context(dir, view), NOTICE_LEAD);
        assert.ok(notice.includes(SESSION_LEVEL),
            'a readable record under any marketplace name is a reading: ' + notice);
    } finally { rmDir(dir); }
});

test('a project that is not a checkout drops the machine-level comparison alone', () => {
    const dir = makeProject();
    try {
        // No history(): the project is a kit-shaped directory with no git
        // repository under it. The hook's git child carries no GIT_* variable at
        // all, so no ambient GIT_CEILING_DIRECTORIES can hold that true from out
        // here and the case asserts the condition rather than assuming it.
        const probe = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'],
            { encoding: 'utf8', env: gitEnv(dir) });
        assert.notStrictEqual(probe.status, 0,
            'the temp directory sits inside a git checkout, so this fixture has a HEAD to read');

        const installed = '5edb4483fd03f198f593afc2d6725aad53649571';
        writeInstalled(dir, [installedEntry(installed)]);
        assert.strictEqual(block(context(dir, installed.slice(0, 12)), NOTICE_LEAD), '',
            'with the view matching the install, an unreadable HEAD leaves nothing to say');

        // The control: the session-level comparison needs no git at all, so it
        // still speaks in the same repository-less fixture.
        const notice = block(context(dir, 'abcdef0123ab'), NOTICE_LEAD);
        assert.ok(notice.includes(SESSION_LEVEL),
            'the session-level comparison survives an unreadable checkout: ' + notice);
        assert.ok(!notice.includes(MACHINE_LEVEL),
            'and the machine-level one stays out of the notice: ' + notice);
    } finally { rmDir(dir); }
});

// The notice is about this kit's own install against this kit's own checkout,
// so it is scoped to the kit repo by the same marker the kaizen count reads. A
// project that merely holds the surfaces says nothing.
test('a project that is not the kit repo raises no notice, every surface set to trigger', () => {
    const dir = makeProject({ kit: false });
    try {
        const { first, second } = history(dir);
        writeInstalled(dir, [installedEntry(second)]);
        const text = context(dir, first.slice(0, 12));
        assert.strictEqual(block(text, NOTICE_LEAD), '',
            'the notice is kit-repo scoped: ' + text);

        // The control: the identical surfaces under a project carrying the kit
        // marker do raise it, so the silence above is the marker gate and not a
        // fixture that fails to trigger.
        const kit = makeProject();
        try {
            fs.cpSync(path.join(dir, 'home'), path.join(kit, 'home'), { recursive: true });
            const notice = block(context(kit, first.slice(0, 12)), NOTICE_LEAD);
            assert.ok(notice.includes(SESSION_LEVEL),
                'the same surfaces in a kit repo do raise the notice: ' + notice);
        } finally { rmDir(kit); }
    } finally { rmDir(dir); }
});

// The notice is one signal among the payload's several. It rides beside them
// without disturbing them, and it is enough on its own: a session whose only
// signal is a trailing plugin view still gets a payload, which is the emit
// guard counting it.
test('the notice rides beside the rest of the payload and is signal enough alone', () => {
    const dir = makeProject();
    try {
        const { first, second } = history(dir);
        writeInstalled(dir, [installedEntry(second)]);

        // Alone: nothing else in this fixture raises a block.
        const alone = context(dir, first.slice(0, 12));
        assert.ok(alone.startsWith(NOTICE_LEAD), 'the notice is the whole payload here: ' + alone);

        fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'docs', 'plans', 'running_spec_v1.md'),
            '# running\n\nStatus: In Progress\nCommit Model: Commit-and-Push\n', 'utf8');
        const text = context(dir, first.slice(0, 12));

        assert.ok(block(text, 'in-progress plan doc(s)').includes('running_spec_v1.md'),
            'the plan inventory is unchanged by the notice: ' + text);
        assert.ok(block(text, NOTICE_LEAD).includes(SESSION_LEVEL),
            'and the notice is still there beside it: ' + text);
    } finally { rmDir(dir); }
});
