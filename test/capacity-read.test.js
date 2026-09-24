// Tests for plugins/claude-kit/hooks/capacity-read.js, the pre-dispatch
// capacity reading over claude-swap's cache.
//
// Node's built-in test runner, no framework. Every case plants a cache under a
// fresh fixture home in the OS temp dir and runs the reader as a child whose
// HOME and USERPROFILE both name that fixture, which is what os.homedir()
// answers from on each platform. Before each reader run a probe child with the
// same environment must report the fixture as its home directory, so a
// redirection that failed stops the case before the reader could reach the
// real cache.
//
// Every run also checks the two properties the reader holds in every verdict
// shape: nothing under the fixture's .claude-swap-backup is written (the
// recursive entry list and every file's mtime and size are equal before and
// after), and no planted private value (an email, an organization identifier,
// a claim identifier, a credential token, the fixture's own path) reaches
// stdout or stderr. Each of those two checks has a control below that shows it
// can fail.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const READER = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'capacity-read.js');

const PLANTED_EMAIL = 'zq-planted-mailbox@capacity-fixture.example';
const PLANTED_ORG = 'd7c0ffee-5eed-4bad-9a11-0rgplanted00';
const PLANTED_CLAIM = 'claim-zq-planted-7731';
const PLANTED_TOKEN = 'sk-ant-oat01-zq-planted-credential';

const MB = 1024 * 1024;

function makeHome() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'capacity-read-test-'));
}

function rmHome(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function cacheRoot(home) {
    return path.join(home, '.claude-swap-backup');
}

// An ISO timestamp in the second-resolution form claude-swap writes.
function iso(ms) {
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function nowS() {
    return Date.now() / 1000;
}

// One account record in usage.json's shape, carrying the planted private
// values beside the fields the reader takes.
function account(overrides) {
    return {
        email: PLANTED_EMAIL,
        organizationUuid: PLANTED_ORG,
        claimId: PLANTED_CLAIM,
        claimUntil: null,
        fetchedAt: nowS() - 30,
        nextPollAt: nowS() + 270,
        pollIntervalS: 300,
        last429At: null,
        backoffUntil: null,
        lastError: null,
        consecutiveFailures: 0,
        lastGood: {
            five_hour: { pct: 20, resets_at: '2026-09-24T05:00:00Z' },
            seven_day: { pct: 40, resets_at: '2026-09-28T00:00:00Z' },
            scoped: [{ name: 'Fable', pct: 30, resets_at: '2026-09-28T00:00:00Z', countdown: '3d', clock: 'Mon' }]
        },
        ...overrides
    };
}

// A whole planted cache: account 2 active, account 1 beside it at the floor so
// a reader that picked the wrong account would downgrade. `opts.sequence` and
// `opts.active` override sequence.json's fields and account 2's; `opts.usage`
// replaces usage.json's whole document.
function plant(home, opts) {
    const o = opts || {};
    const root = cacheRoot(home);
    fs.mkdirSync(path.join(root, 'cache'), { recursive: true });
    fs.mkdirSync(path.join(root, 'credentials'), { recursive: true });
    fs.writeFileSync(path.join(root, 'credentials', '.claude-credentials-2.json'),
        JSON.stringify({ accessToken: PLANTED_TOKEN }));
    fs.writeFileSync(path.join(root, 'autoswitch_state.json'), JSON.stringify({ lastSwitchAt: nowS() - 60 }));
    const sequence = {
        activeAccountNumber: 2,
        lastUpdated: iso(Date.now() - 60 * 1000),
        sequence: [1, 2],
        ...(o.sequence || {})
    };
    fs.writeFileSync(path.join(root, 'sequence.json'), JSON.stringify(sequence, null, 2));
    const usage = o.usage || {
        schemaVersion: 2,
        accounts: {
            1: account({ lastGood: { five_hour: { pct: 100 }, seven_day: { pct: 100 }, scoped: [{ name: 'Fable', pct: 100 }] } }),
            2: account(o.active)
        }
    };
    fs.writeFileSync(path.join(root, 'cache', 'usage.json'), JSON.stringify(usage, null, 2));
}

// Everything under the cache root that a write could change: every entry by
// relative path and kind, recursively, and every file's size and mtime.
function snapshot(home) {
    const root = cacheRoot(home);
    if (!fs.existsSync(root)) return 'absent';
    const out = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const rel = path.relative(root, full);
            if (entry.isDirectory()) {
                out.push(rel + ' dir');
                walk(full);
            } else {
                const st = fs.statSync(full);
                out.push(rel + ' file ' + st.size + ' ' + st.mtimeMs);
            }
        }
    };
    walk(root);
    return out.sort();
}

function childEnv(home) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^(HOME|USERPROFILE|HOMEDRIVE|HOMEPATH)$/i.test(k)) delete env[k];
    }
    env.HOME = home;
    env.USERPROFILE = home;
    return env;
}

// The privacy pin's assertion: none of the planted private values, and not
// the fixture's own path, in the text a run printed.
function assertNoPlanted(text, home) {
    for (const planted of [PLANTED_EMAIL, PLANTED_ORG, PLANTED_CLAIM, PLANTED_TOKEN, home, cacheRoot(home)]) {
        assert.ok(!text.includes(planted), 'the output carries a planted private value: ' + planted);
    }
    assert.ok(!/@|claude-swap-backup|[\\/]/.test(text), 'the output carries an email or path shape: ' + text);
}

// Run the reader against `home` and return its one line, asserting what every
// run holds: the redirection took, exit 0, exactly one line on stdout, nothing
// on stderr, no planted value in either stream, nothing under the cache written.
function run(home) {
    const env = childEnv(home);
    const probe = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("os").homedir())'],
        { env, encoding: 'utf8' });
    assert.strictEqual(probe.stdout, home, 'test setup: the child must resolve the fixture as its home directory');
    const before = snapshot(home);
    const res = spawnSync(process.execPath, [READER], { env, encoding: 'utf8' });
    const after = snapshot(home);
    assert.deepStrictEqual(after, before, 'the reader wrote under the fixture cache');
    assert.strictEqual(res.status, 0, 'exit code: ' + res.stderr);
    assert.strictEqual(res.stderr, '', 'nothing on stderr');
    assertNoPlanted(res.stdout, home);
    assertNoPlanted(res.stderr, home);
    assert.match(res.stdout, /^[^\n]*\n$/, 'exactly one line on stdout: ' + JSON.stringify(res.stdout));
    return res.stdout.trimEnd();
}

function noReading(reason) {
    return 'fable capacity: no reading (' + reason + ') -> ladder governs';
}

// The line's reading, the account and the age, with the verdict and any
// context suffix after it.
const READING = /^fable capacity: scoped (\d+)%, 7d (\d+)%, 5h (\d+)% \(account (\d+), fetched (\d+)s ago\)(.*) -> (dispatch|downgrade)$/;

function parseLine(line) {
    const m = READING.exec(line);
    assert.ok(m, 'the line has the reading shape: ' + line);
    return {
        scoped: Number(m[1]), sevenDay: Number(m[2]), fiveHour: Number(m[3]),
        account: Number(m[4]), ageS: Number(m[5]), context: m[6], verdict: m[7]
    };
}

function withHome(fn) {
    const home = makeHome();
    try {
        fn(home);
    } finally {
        rmHome(home);
    }
}

// --- The three verdict shapes ------------------------------------------------

test('dispatch: the active account below the floor on all three windows', () => withHome((home) => {
    plant(home);
    const r = parseLine(run(home));
    assert.deepStrictEqual(
        { scoped: r.scoped, sevenDay: r.sevenDay, fiveHour: r.fiveHour, account: r.account, context: r.context, verdict: r.verdict },
        { scoped: 30, sevenDay: 40, fiveHour: 20, account: 2, context: '', verdict: 'dispatch' },
        'the active account is read, not account 1 at the floor beside it');
    assert.ok(r.ageS >= 29 && r.ageS <= 90, 'the age is seconds since fetchedAt: ' + r.ageS);
}));

test('downgrade: the scoped Fable window at the floor', () => withHome((home) => {
    plant(home, { active: { lastGood: { five_hour: { pct: 20 }, seven_day: { pct: 40 }, scoped: [{ name: 'Fable', pct: 100 }] } } });
    const r = parseLine(run(home));
    assert.strictEqual(r.verdict, 'downgrade');
    assert.strictEqual(r.scoped, 100);
}));

test('no reading: no .claude-swap-backup directory at all', () => withHome((home) => {
    assert.strictEqual(run(home), noReading('absent file'));
}));

// --- The worst of the three windows --------------------------------------------

test('the worst of the three windows decides: each window alone at the floor downgrades', () => {
    const windows = {
        'seven-day': { five_hour: { pct: 5 }, seven_day: { pct: 100 }, scoped: [{ name: 'Fable', pct: 10 }] },
        'five-hour': { five_hour: { pct: 100 }, seven_day: { pct: 5 }, scoped: [{ name: 'Fable', pct: 10 }] },
        'over the floor': { five_hour: { pct: 5 }, seven_day: { pct: 100.4 }, scoped: [{ name: 'Fable', pct: 10 }] }
    };
    for (const [label, lastGood] of Object.entries(windows)) {
        withHome((home) => {
            plant(home, { active: { lastGood } });
            assert.strictEqual(parseLine(run(home)).verdict, 'downgrade', label + ' at the floor downgrades');
        });
    }
});

test('just under the floor on every window dispatches, and the percentages floor rather than round', () => withHome((home) => {
    plant(home, { active: { lastGood: { five_hour: { pct: 99.9 }, seven_day: { pct: 99.9 }, scoped: [{ name: 'Fable', pct: 99.9 }] } } });
    const r = parseLine(run(home));
    assert.strictEqual(r.verdict, 'dispatch');
    assert.deepStrictEqual([r.scoped, r.sevenDay, r.fiveHour], [99, 99, 99],
        'a line never shows 100% beside -> dispatch');
}));

// --- The demoted signals -------------------------------------------------------

test('a recent 429 or a future backoff below the floor stays dispatch with the context appended', () => {
    const cases = [
        { label: 'recent 429', active: { last429At: nowS() - 600 }, context: '; recent 429' },
        { label: 'in backoff', active: { backoffUntil: nowS() + 600 }, context: '; in backoff' },
        { label: 'both', active: { last429At: nowS() - 600, backoffUntil: nowS() + 600 }, context: '; recent 429; in backoff' },
        { label: 'a 429 over an hour ago and a backoff already past', active: { last429At: nowS() - 7200, backoffUntil: nowS() - 60 }, context: '' }
    ];
    for (const c of cases) {
        withHome((home) => {
            plant(home, { active: c.active });
            const r = parseLine(run(home));
            assert.strictEqual(r.verdict, 'dispatch', c.label);
            assert.strictEqual(r.context, c.context, c.label);
        });
    }
});

test('at the floor with a recent 429 and a backoff, the downgrade names the window and not the 429', () => withHome((home) => {
    plant(home, {
        active: {
            last429At: nowS() - 600,
            backoffUntil: nowS() + 600,
            lastGood: { five_hour: { pct: 20 }, seven_day: { pct: 100 }, scoped: [{ name: 'Fable', pct: 30 }] }
        }
    });
    const line = run(home);
    const r = parseLine(line);
    assert.strictEqual(r.verdict, 'downgrade');
    assert.strictEqual(r.sevenDay, 100, 'the window at the floor is on the line');
    assert.strictEqual(r.context, '', 'no context suffix on a downgrade');
    assert.doesNotMatch(line, /429|backoff/);
}));

// --- Staleness -------------------------------------------------------------------

test('stale: fetchedAt against three poll intervals, both directions', () => {
    for (const [fetchedAgo, expected] of [[1000, 'stale'], [800, 'dispatch']]) {
        withHome((home) => {
            plant(home, { active: { pollIntervalS: 300, fetchedAt: nowS() - fetchedAgo } });
            const line = run(home);
            if (expected === 'stale') assert.strictEqual(line, noReading('stale'), 'fetched ' + fetchedAgo + 's ago');
            else assert.strictEqual(parseLine(line).verdict, 'dispatch', 'fetched ' + fetchedAgo + 's ago');
        });
    }
});

test('stale: with no pollIntervalS the bound is 30 minutes, both directions', () => {
    for (const [minutesAgo, expected] of [[31, 'stale'], [29, 'dispatch']]) {
        withHome((home) => {
            plant(home, { active: { pollIntervalS: undefined, fetchedAt: nowS() - minutesAgo * 60 } });
            const line = run(home);
            if (expected === 'stale') assert.strictEqual(line, noReading('stale'), minutesAgo + ' minutes');
            else assert.strictEqual(parseLine(line).verdict, 'dispatch', minutesAgo + ' minutes');
        });
    }
});

test('stale: sequence.json lastUpdated older than 30 minutes, both directions', () => {
    for (const [minutesAgo, expected] of [[31, 'stale'], [29, 'dispatch']]) {
        withHome((home) => {
            plant(home, { sequence: { lastUpdated: iso(Date.now() - minutesAgo * 60 * 1000) } });
            const line = run(home);
            if (expected === 'stale') assert.strictEqual(line, noReading('stale'), minutesAgo + ' minutes');
            else assert.strictEqual(parseLine(line).verdict, 'dispatch', minutesAgo + ' minutes');
        });
    }
});

test('stale: a timestamp that does not read as one leaves the age unknown', () => {
    const cases = {
        'lastUpdated not a date': { sequence: { lastUpdated: 'not a date' } },
        'lastUpdated absent': { sequence: { lastUpdated: undefined } },
        'fetchedAt absent': { active: { fetchedAt: undefined } },
        'fetchedAt as text': { active: { fetchedAt: String(nowS()) } }
    };
    for (const [label, opts] of Object.entries(cases)) {
        withHome((home) => {
            plant(home, opts);
            assert.strictEqual(run(home), noReading('stale'), label);
        });
    }
});

// --- Each no-reading reason ---------------------------------------------------------

test('absent file: either file missing, or a directory where a file should be', () => {
    const cases = {
        'sequence.json missing': (home) => fs.rmSync(path.join(cacheRoot(home), 'sequence.json')),
        'usage.json missing': (home) => fs.rmSync(path.join(cacheRoot(home), 'cache', 'usage.json')),
        'cache directory missing': (home) => fs.rmSync(path.join(cacheRoot(home), 'cache'), { recursive: true }),
        'sequence.json a directory': (home) => {
            fs.rmSync(path.join(cacheRoot(home), 'sequence.json'));
            fs.mkdirSync(path.join(cacheRoot(home), 'sequence.json'));
        }
    };
    for (const [label, mutate] of Object.entries(cases)) {
        withHome((home) => {
            plant(home);
            mutate(home);
            assert.strictEqual(run(home), noReading('absent file'), label);
        });
    }
});

test('over cap: either file past 1 MB, decided before any parse', () => {
    // Each oversized file is valid JSON, padded with whitespace, so a reader
    // that parsed it whole would get a reading rather than refuse it.
    for (const which of ['sequence.json', path.join('cache', 'usage.json')]) {
        withHome((home) => {
            plant(home);
            const file = path.join(cacheRoot(home), which);
            const text = fs.readFileSync(file, 'utf8');
            fs.writeFileSync(file, text + ' '.repeat(MB + 1 - Buffer.byteLength(text)));
            assert.ok(fs.statSync(file).size > MB, 'test setup: the file is past the cap');
            JSON.parse(fs.readFileSync(file, 'utf8'));
            assert.strictEqual(run(home), noReading('over cap'), which);
        });
    }
});

test('unparseable: either file not JSON, or not a JSON object', () => {
    const cases = {
        'sequence.json not JSON': ['sequence.json', '{"activeAccountNumber": 2,'],
        'usage.json not JSON': [path.join('cache', 'usage.json'), 'not json ' + PLANTED_EMAIL],
        'sequence.json an array': ['sequence.json', '[2]'],
        'usage.json a number': [path.join('cache', 'usage.json'), '42']
    };
    for (const [label, [which, content]] of Object.entries(cases)) {
        withHome((home) => {
            plant(home);
            fs.writeFileSync(path.join(cacheRoot(home), which), content);
            assert.strictEqual(run(home), noReading('unparseable'), label);
        });
    }
});

test('unknown account: the active number resolves to no account record', () => {
    const cases = {
        'no such account': { sequence: { activeAccountNumber: 7 } },
        'active number null': { sequence: { activeAccountNumber: null } },
        'active number as text': { sequence: { activeAccountNumber: '2' } },
        'no accounts object': { usage: { schemaVersion: 2 } },
        'account record not an object': { usage: { schemaVersion: 2, accounts: { 2: PLANTED_EMAIL } } }
    };
    for (const [label, opts] of Object.entries(cases)) {
        withHome((home) => {
            plant(home, opts);
            assert.strictEqual(run(home), noReading('unknown account'), label);
        });
    }
});

test('missing window: each of the three windows missing in turn, and a pct that is not a number', () => {
    const cases = {
        'five_hour missing': { seven_day: { pct: 40 }, scoped: [{ name: 'Fable', pct: 30 }] },
        'seven_day missing': { five_hour: { pct: 20 }, scoped: [{ name: 'Fable', pct: 30 }] },
        'Fable scoped missing': { five_hour: { pct: 20 }, seven_day: { pct: 40 }, scoped: [{ name: 'Opus', pct: 30 }] },
        'scoped missing': { five_hour: { pct: 20 }, seven_day: { pct: 40 } },
        'pct as text': { five_hour: { pct: '20' }, seven_day: { pct: 40 }, scoped: [{ name: 'Fable', pct: 30 }] },
        'pct null': { five_hour: { pct: 20 }, seven_day: { pct: null }, scoped: [{ name: 'Fable', pct: 30 }] }
    };
    for (const [label, lastGood] of Object.entries(cases)) {
        withHome((home) => {
            plant(home, { active: { lastGood } });
            assert.strictEqual(run(home), noReading('missing window'), label);
        });
    }
    withHome((home) => {
        plant(home, { active: { lastGood: undefined } });
        assert.strictEqual(run(home), noReading('missing window'), 'no lastGood at all');
    });
});

test('the Fable scoped window is matched case-insensitively', () => withHome((home) => {
    plant(home, { active: { lastGood: { five_hour: { pct: 20 }, seven_day: { pct: 40 }, scoped: [{ name: 'Opus', pct: 100 }, { name: 'FABLE', pct: 55 }] } } });
    const r = parseLine(run(home));
    assert.strictEqual(r.verdict, 'dispatch');
    assert.strictEqual(r.scoped, 55);
}));

// --- The privacy pin and its control -------------------------------------------------

test('privacy pin: the assertion reddens on a formatter with its redaction bypassed, and holds on the shipped one', () => withHome((home) => {
    const { formatVerdict } = require(READER);
    // Verdicts whose every printed slot carries a planted private value, in
    // each of the three shapes.
    const verdicts = [
        { kind: 'dispatch', scoped: PLANTED_EMAIL, sevenDay: PLANTED_ORG, fiveHour: PLANTED_CLAIM, account: PLANTED_TOKEN, ageS: home, context: [PLANTED_EMAIL] },
        { kind: 'downgrade', scoped: PLANTED_ORG, sevenDay: 100, fiveHour: 1, account: PLANTED_EMAIL, ageS: cacheRoot(home) },
        { kind: 'no reading', reason: PLANTED_EMAIL + ' ' + PLANTED_ORG }
    ];
    const bypass = (value) => String(value);
    for (const v of verdicts) {
        assert.throws(() => assertNoPlanted(formatVerdict(v, bypass), home), /planted private value/,
            'control: with the redaction bypassed, the pin speaks on the ' + v.kind + ' shape');
        assertNoPlanted(formatVerdict(v), home);
    }
}));

// --- The no-write check's control ------------------------------------------------------

test('no-write control: the snapshot sees an in-place rewrite and a write into a subdirectory', () => withHome((home) => {
    plant(home);
    const base = snapshot(home);
    const usage = path.join(cacheRoot(home), 'cache', 'usage.json');
    const content = fs.readFileSync(usage);
    const later = new Date(Date.now() + 5000);
    fs.writeFileSync(usage, content);
    fs.utimesSync(usage, later, later);
    assert.notDeepStrictEqual(snapshot(home), base, 'a same-size rewrite of usage.json moves the snapshot');

    const rewritten = snapshot(home);
    fs.writeFileSync(path.join(cacheRoot(home), 'credentials', 'new.json'), '{}');
    assert.notDeepStrictEqual(snapshot(home), rewritten, 'a new file in a subdirectory moves the snapshot');
}));
