// Tests for plugins/claude-kit/hooks/kit-registry-stamp.js: the seat's own
// `Status-updated:` stamp and the audit that reads the coordinator directory's
// time fields against the machine-written comparators beside them.
//
// Every case runs against a fixture coordinator directory under a temp tree,
// either by pointing the audit at it with --dir or by moving os.homedir()
// through USERPROFILE and HOME for the stamp, so the real store at ~/.claude is
// never read or written. The hostname is read at runtime rather than written
// into a fixture, so no machine name ships in this suite.
//
// The planted fixtures are matched on shape rather than on any string the
// predicates were handed: no value written here appears in the module's source,
// and every control's stamps are produced by a clock read at the moment the
// fixture is written rather than by a literal, so a control that stays silent
// says something about the predicate's reach and not only that it runs.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-registry-stamp.js');
const {
    roundSecondStamps, stampsLeadingHeartbeat, futureStamps, futureStampsInProse,
    HEARTBEAT_LEAD_MS, FUTURE_SKEW_MS
} = require(CLI);

const SESSION = 'ses-77778888-dddd-eeee-ffff-999900001111';
const MINUTE = 60 * 1000;

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

// A moment read from the clock, which is what an instrument produces: it
// carries milliseconds. A real read lands on a whole second about once in a
// thousand, which is the harmless direction for the product and the fatal one
// for a control here, since a control's whole job is to be silent. The value
// stays clock-derived and is nudged by one millisecond in exactly that case, an
// amount below the resolution of every reading in this file.
function measured(offsetMs) {
    const at = Date.now() + (offsetMs || 0);
    return new Date(at % 1000 === 0 ? at + 1 : at).toISOString();
}

// A moment composed rather than measured, in the shape a hand types: whole
// seconds, no fractional part. Built from the clock so no literal moment ships
// in this suite, and truncated so the fixture is round by construction.
function composed(offsetMs) {
    const at = new Date(Math.floor((Date.now() + (offsetMs || 0)) / 1000) * 1000);
    return at.toISOString().replace('.000Z', 'Z');
}

// A registry entry in the shape the role skill's directory contract states.
function entryText(o) {
    const lines = [
        'Name: KIT: Worker',
        'Role: Worker',
        'Repo: claude-kit',
        'Workdir: claude-kit',
        'Session: ' + (o.session || SESSION),
        'Started: ' + (o.started === undefined ? measured(-3 * 60 * MINUTE) : o.started),
        'Status-updated: ' + (o.statusUpdated === undefined ? measured(-MINUTE) : o.statusUpdated),
        'Remaining: none'
    ];
    if (o.heartbeat !== null) {
        lines.push('Heartbeat: ' + (o.heartbeat === undefined ? measured(-2 * MINUTE) : o.heartbeat));
    }
    lines.push('Banked: none', '', 'Status: working the section', '');
    return lines.join('\n');
}

// A fixture coordinator directory: a home whose store holds one machine's
// directory, plus the paths inside it the audit reads.
function fixture() {
    const home = makeDir('registry-stamp-home-');
    const dir = path.join(home, '.claude', 'coordinator', os.hostname());
    return { home, dir, registryDir: path.join(dir, 'registry') };
}

function runCli(args, extraEnv) {
    return spawnSync(process.execPath, [CLI].concat(args), {
        env: { ...process.env, ...(extraEnv || {}) },
        encoding: 'utf8'
    });
}

// An audit run over a fixture. The home moves with it because the audit
// contains its scope under the store's own coordinator directory, so a scope
// under a fixture home is only in scope while that home is the one it reads.
function runAudit(f, args) {
    return runCli(['audit'].concat(args), { USERPROFILE: f.home, HOME: f.home });
}

function fieldOf(full, name) {
    const m = new RegExp('^' + name + ': *(.*)$', 'm').exec(fs.readFileSync(full, 'utf8'));
    return m === null ? null : m[1].trim();
}

// --- The stamp -------------------------------------------------------------

test('registry stamp: push writes Status-updated from a clock read and touches nothing else', () => {
    const f = fixture();
    try {
        const full = path.join(f.registryDir, SESSION + '.md');
        const before = entryText({ statusUpdated: composed(-40 * MINUTE) });
        writeFile(full, before);

        const res = runCli(['push'], { USERPROFILE: f.home, HOME: f.home, CLAUDE_CODE_SESSION_ID: SESSION });
        assert.strictEqual(res.status, 0, 'the stamp succeeds; stderr: ' + res.stderr);

        const stamp = fieldOf(full, 'Status-updated');
        assert.ok(Math.abs(Date.now() - Date.parse(stamp)) < MINUTE, 'stamped at about now: ' + stamp);
        assert.ok(/\.\d{3}Z$/.test(stamp),
            'and with the millisecond precision only an instrument produces: ' + stamp);

        const after = fs.readFileSync(full, 'utf8');
        assert.strictEqual(after.replace(/^Status-updated:.*$/m, ''), before.replace(/^Status-updated:.*$/m, ''),
            'every other line of the entry is byte-identical');
    } finally {
        rmDir(f.home);
    }
});

test('registry stamp: push refuses an entry that names another session', () => {
    const f = fixture();
    try {
        // The path is this caller's own; the entry sitting at it is not. The
        // refusing rule is the Session-line corroboration alone, since the file
        // is present, readable, and carries the line the stamp rewrites.
        const full = path.join(f.registryDir, SESSION + '.md');
        const before = entryText({ session: 'ses-00001111-2222-3333-4444-555566667777' });
        writeFile(full, before);

        const res = runCli(['push'], { USERPROFILE: f.home, HOME: f.home, CLAUDE_CODE_SESSION_ID: SESSION });
        assert.strictEqual(res.status, 1, 'the stamp refuses');
        assert.strictEqual(fs.readFileSync(full, 'utf8'), before, 'and leaves a peer\'s entry byte-identical');
    } finally {
        rmDir(f.home);
    }
});

test('registry stamp: push leaves an entry carrying no Status-updated line unrestructured', () => {
    const f = fixture();
    try {
        const full = path.join(f.registryDir, SESSION + '.md');
        const before = entryText({}).replace(/^Status-updated:.*\n/m, '');
        writeFile(full, before);

        const res = runCli(['push'], { USERPROFILE: f.home, HOME: f.home, CLAUDE_CODE_SESSION_ID: SESSION });
        assert.strictEqual(res.status, 1, 'the stamp refuses rather than adding a line');
        assert.strictEqual(fs.readFileSync(full, 'utf8'), before, 'and the entry is byte-identical');
    } finally {
        rmDir(f.home);
    }
});

test('registry stamp: push with no usable session id writes nothing', () => {
    const f = fixture();
    try {
        const full = path.join(f.registryDir, SESSION + '.md');
        const before = entryText({});
        writeFile(full, before);

        const env = { USERPROFILE: f.home, HOME: f.home, CLAUDE_CODE_SESSION_ID: '' };
        const res = runCli(['push'], env);
        assert.strictEqual(res.status, 1, 'an unscoped stamp is refused');
        assert.strictEqual(fs.readFileSync(full, 'utf8'), before, 'and nothing is written');
    } finally {
        rmDir(f.home);
    }
});

test('registry stamp: a session id that is not id-shaped never composes a path', () => {
    const f = fixture();
    try {
        // A real entry sits at the traversal's own destination, so a stamp that
        // composed the path and merely failed to find a file would still find
        // one here. Silence therefore means the value never became a path.
        const escape = '../../planted';
        const planted = path.join(f.registryDir, escape + '.md');
        const before = entryText({});
        writeFile(planted, before);

        const res = runCli(['push'], { USERPROFILE: f.home, HOME: f.home, CLAUDE_CODE_SESSION_ID: escape });
        assert.strictEqual(res.status, 1, 'the id shape refuses before any path is joined');
        assert.strictEqual(fs.readFileSync(planted, 'utf8'), before, 'and the planted entry is untouched');
    } finally {
        rmDir(f.home);
    }
});

// --- Instrument 1: the round-second scan ------------------------------------

test('registry audit: a whole-second session stamp is reported, and a measured one is not', () => {
    const planted = entryText({ statusUpdated: composed(-40 * MINUTE) });
    const found = roundSecondStamps(planted);
    assert.strictEqual(found.length, 1, 'the composed stamp is the one finding');
    assert.strictEqual(found[0].field, 'Status-updated', 'and it is named by its field');
    assert.strictEqual(found[0].kind, 'round-second');

    // The control is withheld from the predicate: its stamps are clock reads
    // taken at this moment, matched on the same shape rule rather than on any
    // literal, so its silence is a statement about the predicate's reach.
    const control = entryText({});
    assert.deepStrictEqual(roundSecondStamps(control), [],
        'measured stamps carry milliseconds and are silent');
});

test('registry audit: the round-second scan reads Started as well as Status-updated', () => {
    const planted = entryText({ started: composed(-3 * 60 * MINUTE) });
    const fields = roundSecondStamps(planted).map((f) => f.field);
    assert.deepStrictEqual(fields, ['Started'],
        'both session-written time fields are in scope, not the pushed one alone');

    // The machine-stamped lines are the comparators rather than the subjects: a
    // whole-second heartbeat is the hook's own business and is not a finding.
    const machineRound = entryText({ heartbeat: composed(-2 * MINUTE) });
    assert.deepStrictEqual(roundSecondStamps(machineRound), [],
        'the hook-stamped line is not a session-written field');
});

// --- Instrument 2: the heartbeat comparison ---------------------------------

test('registry audit: a session stamp ahead of the hook-stamped heartbeat is reported', () => {
    // The fabricated-forward shape: a stamp naming a moment that had not
    // arrived when the machine wrote the heartbeat under it. The round-second
    // scan cannot see this one, so the fixture's stamp carries milliseconds.
    const planted = entryText({
        heartbeat: measured(-20 * MINUTE),
        statusUpdated: measured(-MINUTE)
    });
    const found = stampsLeadingHeartbeat(planted, HEARTBEAT_LEAD_MS);
    assert.strictEqual(found.length, 1, 'the stamp leading the heartbeat is the one finding');
    assert.strictEqual(found[0].field, 'Status-updated');
    assert.strictEqual(found[0].kind, 'ahead-of-heartbeat');
    assert.deepStrictEqual(roundSecondStamps(planted), [],
        'and the round-second scan is silent on it, which is why this instrument exists');
});

test('registry audit: a push inside the heartbeat throttle window is not a finding', () => {
    // The control is the honest case the window prices in: the hook declines to
    // restamp while the heartbeat is fresher than its throttle, so a push a few
    // minutes after the last stamp legitimately leads it.
    const control = entryText({
        heartbeat: measured(-(HEARTBEAT_LEAD_MS / 2)),
        statusUpdated: measured(-MINUTE)
    });
    assert.deepStrictEqual(stampsLeadingHeartbeat(control, HEARTBEAT_LEAD_MS), [],
        'a lead inside the throttle window says nothing');

    // And an entry whose heartbeat has never been stamped is unreadable by this
    // instrument rather than a finding: `none` is the shape the takeover writes.
    const unstamped = entryText({ heartbeat: 'none' });
    assert.deepStrictEqual(stampsLeadingHeartbeat(unstamped, HEARTBEAT_LEAD_MS), [],
        'no comparator, no comparison');
});

// --- The read-protocol self-check -------------------------------------------

test('registry audit: a stamp sitting ahead of the clock is named', () => {
    const planted = entryText({ statusUpdated: measured(60 * MINUTE) });
    const found = futureStamps(planted, Date.now());
    assert.strictEqual(found.length, 1, 'the future stamp is the one finding');
    assert.strictEqual(found[0].kind, 'future');
    assert.strictEqual(found[0].field, 'Status-updated');

    const control = entryText({});
    assert.deepStrictEqual(futureStamps(control, Date.now()), [],
        'stamps at or behind the clock are silent');
});

// --- The CLI over a whole coordinator directory -----------------------------

test('registry audit: the CLI speaks over a planted directory and is silent over a clean one', () => {
    const f = fixture();
    try {
        writeFile(path.join(f.registryDir, SESSION + '.md'),
            entryText({ statusUpdated: composed(-40 * MINUTE) }));

        const dirty = runAudit(f, ['--dir', f.dir]);
        assert.strictEqual(dirty.status, 1, 'findings are read from the exit code; stderr: ' + dirty.stderr);
        assert.ok(dirty.stdout.includes('registry/' + SESSION + '.md'), 'the entry is named: ' + dirty.stdout);

        // The control is the same directory with the same file written by a
        // clock read at the write, so what changes between the runs is the
        // provenance of the value and nothing else.
        writeFile(path.join(f.registryDir, SESSION + '.md'), entryText({}));
        const clean = runAudit(f, ['--dir', f.dir]);
        assert.strictEqual(clean.status, 0, 'a measured directory reads clean; stdout: ' + clean.stdout);
        assert.ok(clean.stdout.includes('no stamp findings'), 'and says so: ' + clean.stdout);
    } finally {
        rmDir(f.home);
    }
});

// The audit's stdout is a channel a model reads, and every value it
// interpolates comes out of a file any local session on the machine can write,
// so both interpolation sites render through the shared output guard: a field's
// own text at 40 characters, the composed sentence at 300. That guard MARKS
// what it discarded, and the mark is what keeps a value shown in part from
// reading as the whole one, so this pins the mark reaching this stdout.
test('registry audit: a field longer than the report shows is printed with the cut mark', () => {
    const f = fixture();
    try {
        // A moment in the legacy spelling Date.parse also accepts: a whole
        // second, which is the finding this raises, written long enough to pass
        // the cap a field is shown within. Built from the clock like every other
        // fixture moment in this file, so no literal moment ships here either.
        const legacy = new Date(Math.floor((Date.now() - 40 * MINUTE) / 1000) * 1000).toString();
        assert.ok(legacy.length > 40,
            'test setup: the stamp must be longer than the cap or the case pins nothing: ' + legacy);
        writeFile(path.join(f.registryDir, SESSION + '.md'), entryText({ statusUpdated: legacy }));

        const res = runAudit(f, ['--dir', f.dir]);
        assert.strictEqual(res.status, 1,
            'a whole-second stamp is a finding, so the line under test is printed; stderr: ' + res.stderr);
        assert.ok(res.stdout.includes(legacy.slice(0, 40) + ' [cut to fit]'),
            'the field is shown as far as the cap reaches and marked as cut: ' + res.stdout);
        assert.ok(!res.stdout.includes(legacy),
            'and the whole field does not reach the line, which is what the cap is for: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: an empty coordinator directory is an ordinary state, not a finding', () => {
    const f = fixture();
    try {
        fs.mkdirSync(f.dir, { recursive: true });
        const res = runAudit(f, ['--dir', f.dir]);
        assert.strictEqual(res.status, 0, 'no registry and no board is silence; stderr: ' + res.stderr);
        assert.ok(/scanned 0 registry entries/.test(res.stdout),
            'and the run says what it covered rather than leaving coverage to be inferred: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

// --- Scanning nothing is not finding nothing --------------------------------

test('registry audit: a scope that is not there is refused rather than read as clean', () => {
    const f = fixture();
    try {
        // A machine directory, one component below the coordinator root, that is
        // simply not there: the shape a mistyped machine name produces, so
        // nothing but the missing scope distinguishes this run from the clean
        // one above.
        const root = path.join(f.home, '.claude', 'coordinator');
        const res = runAudit(f, ['--dir', path.join(root, 'no-such-machine')]);
        assert.strictEqual(res.status, 1, 'an unscanned run never exits clean; stdout: ' + res.stdout);
        assert.ok(/names no directory/.test(res.stderr),
            'and absence answers in its own words rather than as a scope refusal: ' + res.stderr);
        assert.ok(!/no stamp findings/.test(res.stdout), 'the clean line is not printed: ' + res.stdout);

        // The neighbouring mis-scope, one component deeper, is the other answer
        // and must not borrow this one: a path below a machine directory is out
        // of scope whether or not anything sits at it, so a caller is never sent
        // hunting an absent directory that was never in range to begin with.
        const deeper = runAudit(f, ['--dir', path.join(f.dir, 'registry')]);
        assert.strictEqual(deeper.status, 1, 'the deeper scope is refused too; stdout: ' + deeper.stdout);
        assert.ok(/the only scope this scans/.test(deeper.stderr),
            'and it is the scope rule that names it: ' + deeper.stderr);
        assert.ok(!/names no directory/.test(deeper.stderr),
            'absence never answers for a path outside the scope: ' + deeper.stderr);
    } finally {
        rmDir(f.home);
    }
});

// The invocation the role skill's self-check actually runs passes no `--dir` at
// all, and it is the one branch of the scope logic every other case here routes
// around: a null scope resolves to the machine's own directory without reaching
// the containment screen. Both directions are pinned, because an exit code whose
// promise is that it carries the reading has to carry both of them.
test('registry audit: the default scope is the machine directory, and it reads both ways', () => {
    const f = fixture();
    try {
        writeFile(path.join(f.registryDir, SESSION + '.md'), entryText({}));
        const clean = runAudit(f, []);
        assert.strictEqual(clean.status, 0,
            'a measured machine directory reads clean with no flag; stderr: ' + clean.stderr);
        assert.ok(clean.stdout.includes('no stamp findings'), 'and says so: ' + clean.stdout);

        // The control that clean exit needs: the same flagless run over a planted
        // value has to speak, or the silence above is evidence of nothing but a
        // default scope that reached no file.
        writeFile(path.join(f.registryDir, SESSION + '.md'),
            entryText({ statusUpdated: composed(-40 * MINUTE) }));
        const planted = runAudit(f, []);
        assert.strictEqual(planted.status, 1,
            'and a planted stamp is found through that same default scope; stdout: ' + planted.stdout);
        assert.ok(planted.stdout.includes('registry/' + SESSION + '.md'),
            'the entry is named: ' + planted.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: an empty --dir is refused rather than resolved against the shell', () => {
    const f = fixture();
    try {
        fs.mkdirSync(f.dir, { recursive: true });
        const res = runAudit(f, ['--dir', '']);
        assert.strictEqual(res.status, 1, 'the empty value is refused; stdout: ' + res.stdout);
        assert.ok(/nothing scanned/.test(res.stderr), 'and nothing was scanned: ' + res.stderr);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: a scope that is not a directory is refused', () => {
    const f = fixture();
    try {
        const notDir = path.join(f.dir, 'not-a-directory.md');
        writeFile(notDir, entryText({}));
        const res = runAudit(f, ['--dir', notDir]);
        assert.strictEqual(res.status, 1, 'a file is not a coordinator directory; stdout: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: a registry directory it cannot list is a finding, not silence', () => {
    const f = fixture();
    try {
        // A file where the registry directory belongs: present, and unlistable.
        // The distinction under test is present-and-unreadable against absent,
        // which the case above covers from the other side.
        writeFile(path.join(f.dir, 'registry'), 'not a directory\n');
        const res = runAudit(f, ['--dir', f.dir]);
        assert.strictEqual(res.status, 1, 'an unreadable scope is reported; stdout: ' + res.stdout);
        assert.ok(/registry/.test(res.stdout), 'and named: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

// --- What the audit will not reach for --------------------------------------

test('registry audit: a network-shaped --dir is refused without a connection attempt', () => {
    const f = fixture();
    try {
        // A UNC path to a host that does not resolve. That nothing was touched
        // is read structurally rather than off the wall clock: the guard runs
        // twice, once on the value as given and once on the resolved path, and
        // only the first of those precedes every filesystem call, so the refusal
        // naming the as-given form is what places it ahead of any touch. A
        // duration bound was the earlier instrument and is not one on a shared
        // box, where a node spawn alone scatters past any threshold tight enough
        // to mean something.
        const res = runAudit(f, ['--dir', '\\\\kit-no-such-host-42\\coordinator']);
        assert.strictEqual(res.status, 1, 'the share is refused; stdout: ' + res.stdout);
        assert.ok(/--dir names a network share/.test(res.stderr),
            'at the as-given screen, which sits ahead of every touch: ' + res.stderr);
        assert.ok(!/resolves to a network share/.test(res.stderr),
            'and not at the post-resolution one, which would place the refusal later: ' + res.stderr);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: a --dir outside the coordinator directory is refused', () => {
    const f = fixture();
    try {
        // A real directory holding a real entry, one level above the scope this
        // reads: the refusal is containment and not the absence of anything.
        writeFile(path.join(f.home, 'registry', SESSION + '.md'),
            entryText({ statusUpdated: composed(-40 * MINUTE) }));
        const res = runAudit(f, ['--dir', f.home]);
        assert.strictEqual(res.status, 1, 'the escape is refused; stdout: ' + res.stdout);
        // Matched on the phrase naming the scope rule rather than on a word any
        // refusal here could carry, so a green says the containment screen
        // refused it and not merely that something did.
        assert.ok(/the only scope this scans/.test(res.stderr),
            'and the scope rule is the one that named it: ' + res.stderr);
        assert.ok(!/stamp findings:/.test(res.stdout), 'nothing outside the scope was read: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

// --- The takeover stamp ------------------------------------------------------

test('registry stamp: a takeover stamps Started from a clock read, and a push does not', () => {
    const f = fixture();
    try {
        const full = path.join(f.registryDir, SESSION + '.md');
        const env = { USERPROFILE: f.home, HOME: f.home, CLAUDE_CODE_SESSION_ID: SESSION };

        writeFile(full, entryText({ started: composed(-3 * 60 * MINUTE) }));
        const taken = runCli(['push', '--takeover'], env);
        assert.strictEqual(taken.status, 0, 'the takeover stamp succeeds; stderr: ' + taken.stderr);
        const started = fieldOf(full, 'Started');
        assert.ok(/\.\d{3}Z$/.test(started), 'Started carries an instrument\'s precision: ' + started);
        assert.deepStrictEqual(roundSecondStamps(fs.readFileSync(full, 'utf8')), [],
            'and the scan that reported the composed fixture is silent on the stamped entry');

        // The later pushes leave it alone: Started names the takeover, and a
        // push that rewrote it would name the push instead.
        const held = runCli(['push'], env);
        assert.strictEqual(held.status, 0, 'the plain push succeeds; stderr: ' + held.stderr);
        assert.strictEqual(fieldOf(full, 'Started'), started, 'Started is the takeover\'s still');
    } finally {
        rmDir(f.home);
    }
});

// --- The clock read for a line no field grammar covers -----------------------

test('registry stamp: now prints one moment read from the clock', () => {
    const res = runCli(['now']);
    assert.strictEqual(res.status, 0, 'it answers; stderr: ' + res.stderr);
    const printed = res.stdout.trim();
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(printed),
        'in the shape a stamp takes, milliseconds and all: ' + printed);
    assert.ok(Math.abs(Date.now() - Date.parse(printed)) < MINUTE, 'at about now: ' + printed);
});

// --- The board's stamps, against the clock alone -----------------------------

// A board in the shape the coordinator writes: times inside sentences, at
// whatever precision the writer had, with no field grammar to read them out of.
function boardText(stamps) {
    return ['# Board', '']
        .concat(stamps.map((s) => '- A seat reported at ' + s + ' and the work stands.'))
        .concat(['']).join('\n');
}

test('registry audit: a board stamp ahead of the clock is named', () => {
    const planted = boardText([measured(-90 * MINUTE), measured(90 * MINUTE)]);
    const found = futureStampsInProse(planted, Date.now());
    assert.strictEqual(found.length, 1, 'the stamp ahead of the clock is the one finding');
    assert.strictEqual(found[0].kind, 'future');
    assert.ok(found[0].what.includes(found[0].value), 'and the report carries the value a reader searches for');
});

test('registry audit: an honest board is silent, minute precision and all', () => {
    // The control is what the coordinator actually writes: moments behind the
    // clock, some to the minute, matched on shape rather than on any literal
    // the predicate was handed. A whole-second reading over the board would
    // report every one of these, which is why the board takes this leg alone.
    const control = boardText([
        measured(-90 * MINUTE),
        composed(-4 * 60 * MINUTE),
        new Date(Date.now() - 26 * 60 * MINUTE).toISOString().slice(0, 16) + 'Z'
    ]);
    assert.deepStrictEqual(futureStampsInProse(control, Date.now()), [],
        'a board behind the clock says nothing at any precision');
});

test('registry audit: the CLI reads the board and reports its scope', () => {
    const f = fixture();
    try {
        writeFile(path.join(f.dir, 'board.md'), boardText([measured(120 * MINUTE)]));
        const res = runAudit(f, ['--dir', f.dir]);
        assert.strictEqual(res.status, 1, 'the board finding reaches the exit code; stdout: ' + res.stdout);
        assert.ok(/board\.md/.test(res.stdout), 'and the board is named: ' + res.stdout);
        assert.ok(/the board with 1 stamp read/.test(res.stdout),
            'the run states the count it recognized, not that the file opened: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

// --- The skew the future reading allows --------------------------------------

test('registry audit: a stamp inside the future skew is not a finding', () => {
    // Two machines' clocks disagree by seconds and a peer can push while a scan
    // runs, so a zero allowance would report a healthy directory. The bound is
    // the compaction checkpoint's own, and the control sits inside it.
    const inside = entryText({ statusUpdated: measured(FUTURE_SKEW_MS / 2) });
    assert.deepStrictEqual(futureStamps(inside, Date.now()), [],
        'a stamp inside the allowance is ordinary clock disagreement');

    const outside = entryText({ statusUpdated: measured(2 * FUTURE_SKEW_MS) });
    assert.strictEqual(futureStamps(outside, Date.now()).length, 1, 'and one past it is reported');
});

test('registry audit: a machine-stamped heartbeat ahead of the clock is reported too', () => {
    // The heartbeat is the comparator for the lead reading and a subject for
    // this one: a machine's clock is as capable of being wrong as a hand is.
    const planted = entryText({ heartbeat: measured(90 * MINUTE) });
    const found = futureStamps(planted, Date.now());
    assert.strictEqual(found.length, 1, 'the future heartbeat is the one finding');
    assert.strictEqual(found[0].field, 'Heartbeat');
});

// --- Where the board is: the operator-tier location record ------------------

// A fixture whose memory store sits under the fixture home, pointed at by
// KIT_MEMORY_ROOT with the second signal memq honors it under, so the operator
// tier the audit reads is this one and never the real store.
function storeFixture() {
    const f = fixture();
    f.store = path.join(f.home, 'store');
    f.operatorDir = path.join(f.store, 'memory-operator');
    fs.mkdirSync(path.join(f.registryDir), { recursive: true });
    fs.mkdirSync(f.operatorDir, { recursive: true });
    return f;
}

function runAuditWithStore(f, args) {
    return runCli(['audit'].concat(args || []), {
        USERPROFILE: f.home, HOME: f.home,
        KIT_MEMORY_ROOT: f.store, KIT_MEMORY_ROOT_ALLOW_DATA: '1'
    });
}

// An operator-tier record in the shape memq add-operator writes, the
// frontmatter lines given and the body carrying whatever prose the case needs.
function operatorRecord(f, name, frontLines, body) {
    const lines = frontLines.length > 0 ? ['---'].concat(frontLines, ['---']) : [];
    writeFile(path.join(f.operatorDir, name + '.md'),
        lines.concat(['# ' + name, '', body || 'where this machine keeps its coordinator board', ''])
            .join('\n'));
}

test('registry audit: a board at a relocated path named by the record\'s board: key is scanned', () => {
    const f = storeFixture();
    try {
        // Nothing at the contract path, so the only board there is to find is
        // the one the record names; the machine is spelled in another case,
        // which the match ignores.
        const relocated = path.join(f.home, 'boards', 'this-machine', 'board.md');
        writeFile(relocated, boardText([measured(120 * MINUTE)]));
        operatorRecord(f, 'coordinator-board-location-here',
            ['machine: ' + os.hostname().toLowerCase(), 'board: ' + relocated]);
        const res = runAuditWithStore(f, []);
        assert.strictEqual(res.status, 1, 'the relocated board\'s finding reaches the exit code; stdout: '
            + res.stdout + ' stderr: ' + res.stderr);
        assert.ok(/the board with 1 stamp read/.test(res.stdout),
            'the relocated board is read and counted: ' + res.stdout);
        assert.ok(res.stdout.includes('coordinator-board-location-here'),
            'and the run names the record it took the location from: ' + res.stdout);
        assert.ok(!/board leg not run/.test(res.stdout), 'the leg ran: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: a record naming the board only in its prose leaves the leg unscanned and names the record', () => {
    const f = storeFixture();
    try {
        const relocated = path.join(f.home, 'boards', 'this-machine', 'board.md');
        writeFile(relocated, boardText([measured(120 * MINUTE)]));
        operatorRecord(f, 'coordinator-board-location-prose',
            ['machine: ' + os.hostname()], 'The board for this machine lives at ' + relocated + '.');
        const res = runAuditWithStore(f, []);
        assert.ok(/no board at [^\n]*board\.md, board leg not run/.test(res.stdout),
            'the unscanned wording: ' + res.stdout);
        assert.ok(/coordinator-board-location-prose[^\n]*no board: key/.test(res.stdout),
            'the record is named beside it, with what it lacks: ' + res.stdout);
        assert.ok(!/stamp read/.test(res.stdout),
            'the path in the prose is never read, so no board was counted: ' + res.stdout);
        assert.ok(!/absent/.test(res.stdout), 'and the leg is never called absent: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: a missing board is reported as a leg not run, never as absent', () => {
    const f = storeFixture();
    try {
        writeFile(path.join(f.registryDir, SESSION + '.md'), entryText({}));
        const res = runAuditWithStore(f, []);
        assert.ok(/no board at [^\n]*board\.md, board leg not run/.test(res.stdout),
            'the unscanned wording names the contract path: ' + res.stdout);
        assert.ok(!/absent/.test(res.stdout), 'the word absent is not used for the leg: ' + res.stdout);
        assert.ok(!/stamp read/.test(res.stdout), 'no board reads as counted: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: with no record for this machine the contract path is still read', () => {
    const f = storeFixture();
    try {
        writeFile(path.join(f.dir, 'board.md'), boardText([measured(120 * MINUTE)]));
        // A record for another box names a board that holds nothing ahead of
        // the clock: were it taken, the run would read clean, so a finding
        // here is the contract board being the one read.
        const elsewhere = path.join(f.home, 'boards', 'other', 'board.md');
        writeFile(elsewhere, boardText([measured(-MINUTE)]));
        operatorRecord(f, 'coordinator-board-location-other',
            ['machine: not-this-' + os.hostname(), 'board: ' + elsewhere]);
        const res = runAuditWithStore(f, []);
        assert.strictEqual(res.status, 1, 'the contract board\'s finding reaches the exit code; stdout: '
            + res.stdout);
        assert.ok(/the board with 1 stamp read/.test(res.stdout), 'the contract board is read: ' + res.stdout);
        assert.ok(!res.stdout.includes('coordinator-board-location-other'),
            'and another machine\'s record is not this one\'s location: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: two records naming a board for this machine are ambiguous, and neither is read', () => {
    const f = storeFixture();
    try {
        const first = path.join(f.home, 'boards', 'a', 'board.md');
        const second = path.join(f.home, 'boards', 'b', 'board.md');
        writeFile(first, boardText([measured(120 * MINUTE)]));
        writeFile(second, boardText([measured(120 * MINUTE)]));
        operatorRecord(f, 'coordinator-board-location-a', ['machine: ' + os.hostname(), 'board: ' + first]);
        operatorRecord(f, 'coordinator-board-location-b', ['machine: ' + os.hostname(), 'board: ' + second]);
        const res = runAuditWithStore(f, []);
        assert.strictEqual(res.status, 1, 'an ambiguous location is not a clean run; stdout: ' + res.stdout);
        assert.ok(/ambiguous/.test(res.stdout), 'it is called ambiguous: ' + res.stdout);
        assert.ok(res.stdout.includes('coordinator-board-location-a')
            && res.stdout.includes('coordinator-board-location-b'), 'each record is named: ' + res.stdout);
        assert.ok(/board leg not run/.test(res.stdout), 'and the leg is unscanned: ' + res.stdout);
        assert.ok(!/stamp read/.test(res.stdout), 'neither board is read: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});

test('registry audit: a board: value the path screen refuses is named and never opened', () => {
    const f = storeFixture();
    try {
        writeFile(path.join(f.dir, 'board.md'), boardText([measured(-MINUTE)]));
        operatorRecord(f, 'coordinator-board-location-share',
            ['machine: ' + os.hostname(), 'board: \\\\10.255.255.1\\share\\board.md']);
        const res = runAuditWithStore(f, []);
        assert.strictEqual(res.status, 1, 'a refused location is a finding; stdout: ' + res.stdout);
        assert.ok(/coordinator-board-location-share[^\n]*network share/.test(res.stdout),
            'the record and the rule that refused it are named: ' + res.stdout);
        assert.ok(/the board with 1 stamp read/.test(res.stdout),
            'and the contract path is read in its place: ' + res.stdout);
    } finally {
        rmDir(f.home);
    }
});
