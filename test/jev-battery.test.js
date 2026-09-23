// Tests for sidecar/batteries/jev-recognition-v1/run.js, the harness that
// measures Jev as a judge over the fleet memory store's search shortlist.
//
// Node's built-in test runner, no framework (Node v24).
//
// NO CASE HERE REACHES THE NETWORK, THE MEMORY DATABASE OR THE OPERATOR'S
// STORE. Every run of the harness is a child process started by one launcher,
// which gives it a fixture HOME and USERPROFILE, a temp working directory, and
// an environment with the Jev variables removed, so a child never reads the
// operator's ~/.claude, never writes into this repository's .kit/, and never
// sees a key the operator has set. The cases that pin an absence of network
// and database calls run the child under a preload that records and exits on
// any socket connect or child-process start, and one case proves that preload
// catches a real fetch and a real spawn before the silence it reports is
// trusted.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');

const RUN = path.join(__dirname, '..', 'sidecar', 'batteries', 'jev-recognition-v1', 'run.js');
const CASES = path.join(__dirname, '..', 'sidecar', 'batteries', 'jev-recognition-v1', 'situations.json');
const harness = require(RUN);

// The exit code the guard preload leaves when it catches a call.
const GUARD_EXIT = 97;

function tempDir(t, label) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `jev-battery-${label}-`));
    t.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });
    return dir;
}

// The child's environment: this process's own, so PATH survives, minus every
// variable the harness reads, plus a fixture home and whatever the case adds.
function childEnv(home, extra) {
    const env = { ...process.env };
    for (const name of ['TYPESAFE_API_KEY', 'TYPESAFE_API_URL', 'MOCK', 'NODE_OPTIONS']) delete env[name];
    return { ...env, HOME: home, USERPROFILE: home, ...(extra || {}) };
}

// A preload that records and ends the process at the first socket connect or
// child-process start. It patches the Socket prototype, which every TCP and
// TLS connection passes through, fetch's included, and the child_process
// functions before any module captures them. The path is forward-slashed
// because Node parses NODE_OPTIONS with backslash as an escape character.
function guard(dir) {
    const log = path.join(dir, 'guard.log');
    const shim = path.join(dir, 'guard.js');
    fs.writeFileSync(shim, [
        "'use strict';",
        "const fs = require('fs');",
        "const net = require('net');",
        "const cp = require('child_process');",
        'function caught(kind) {',
        '    fs.appendFileSync(' + JSON.stringify(log) + ", kind + '\\n');",
        '    process.exit(' + GUARD_EXIT + ');',
        '}',
        "net.Socket.prototype.connect = function () { caught('connect'); };",
        "for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {",
        '    cp[name] = function () { caught(name); };',
        '}'
    ].join('\n') + '\n', 'utf8');
    return {
        env: { NODE_OPTIONS: '--require "' + shim.replace(/\\/g, '/') + '"' },
        caught() {
            try {
                return fs.readFileSync(log, 'utf8').split('\n').filter((l) => l);
            } catch {
                return [];
            }
        }
    };
}

function runHarness(t, extraEnv, args, dirs) {
    const home = dirs && dirs.home ? dirs.home : tempDir(t, 'home');
    const cwd = dirs && dirs.cwd ? dirs.cwd : tempDir(t, 'cwd');
    const res = spawnSync(process.execPath, [RUN, ...(args || [])], {
        cwd,
        env: childEnv(home, extraEnv),
        encoding: 'utf8',
        timeout: 60000
    });
    return { status: res.status, stdout: res.stdout, stderr: res.stderr, cwd };
}

// Every file under a directory, as paths.
function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
}

// The files under a directory whose text holds the needle.
function filesHolding(dir, needle) {
    return walk(dir).filter((file) => fs.readFileSync(file, 'utf8').includes(needle));
}

function writeCases(dir, rows) {
    const file = path.join(dir, 'cases.json');
    fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
    return file;
}

function shippedCases() {
    return JSON.parse(fs.readFileSync(CASES, 'utf8'));
}

test('the guard preload catches a real fetch to a listening server and a real spawn', async (t) => {
    const dir = tempDir(t, 'control');
    const server = http.createServer((req, res) => { res.end('{}'); });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    t.after(() => { server.close(); });
    const port = server.address().port;

    // The harness never calls net.connect by name; its live path reaches a
    // socket through fetch, so the control drives fetch.
    const fetchGuard = guard(fs.mkdtempSync(path.join(dir, 'f-')));
    const code = await new Promise((resolve) => {
        const child = spawn(process.execPath, ['-e', `fetch('http://127.0.0.1:${port}/').then(() => process.exit(0), () => process.exit(3));`], {
            env: childEnv(dir, fetchGuard.env),
            stdio: 'ignore'
        });
        child.on('exit', (c) => { resolve(c); });
    });
    assert.equal(code, GUARD_EXIT, 'a fetch under the guard ends the process at connect');
    assert.deepEqual(fetchGuard.caught(), ['connect']);

    const spawnGuard = guard(fs.mkdtempSync(path.join(dir, 's-')));
    const res = spawnSync(process.execPath, ['-e', "require('child_process').spawnSync(process.execPath, ['-v']); process.exit(0);"], {
        env: childEnv(dir, spawnGuard.env),
        encoding: 'utf8'
    });
    assert.equal(res.status, GUARD_EXIT, 'a spawn under the guard ends the process');
    assert.deepEqual(spawnGuard.caught(), ['spawnSync']);
});

test('a MOCK=1 run exits 0 with no socket opened and no child process started', (t) => {
    const g = guard(tempDir(t, 'guard'));
    const run = runHarness(t, { MOCK: '1', ...g.env });
    assert.deepEqual(g.caught(), [], 'the MOCK path made no network or database call');
    assert.equal(run.status, 0, run.stderr);
    const composed = run.stdout.indexOf('shape composed');
    const prose = run.stdout.indexOf('shape situation');
    assert.ok(composed >= 0 && prose > composed, 'both shapes are reported, composed first');
    const cases = shippedCases();
    const negatives = cases.filter((c) => c.gold.length === 0).length;
    const firstPositive = cases.find((c) => c.gold.length > 0).n;
    assert.match(run.stdout, new RegExp(`at 0\\.3: recall \\d+/${cases.length - negatives}, clean negatives \\d+/${negatives}`));
    assert.match(run.stdout, new RegExp(`stage-1 misses: ${firstPositive}\\n`), 'the MOCK stage 1 withholds one gold, so the miss branch runs');
    const written = walk(path.join(run.cwd, '.kit', 'jev-battery'));
    assert.equal(written.length, 1);
    assert.equal(path.basename(written[0]), 'results.json');
});

test('a live run with no key exits 2 naming TYPESAFE_API_KEY, before any socket or database call', (t) => {
    for (const key of [undefined, '   ']) {
        const g = guard(tempDir(t, 'guard'));
        const extra = key === undefined ? { ...g.env } : { TYPESAFE_API_KEY: key, ...g.env };
        const run = runHarness(t, extra);
        assert.equal(run.status, 2, `key ${JSON.stringify(key)}: ${run.stderr}`);
        assert.match(run.stderr, /TYPESAFE_API_KEY/);
        assert.deepEqual(g.caught(), []);
        assert.equal(fs.existsSync(path.join(run.cwd, '.kit')), false, 'a refused run writes nothing');
    }
});

test('with a key set, the same live run passes the key check and reaches stage 1', (t) => {
    // The fixture home holds no memory database config, so stage 1 stands down
    // without a spawn or a socket, and the run is a cannot-measure rather than
    // a refusal: the key check is what refused the case above.
    const g = guard(tempDir(t, 'guard'));
    const run = runHarness(t, { TYPESAFE_API_KEY: 'test-key-not-real', ...g.env });
    assert.deepEqual(g.caught(), []);
    assert.equal(run.status, 1, run.stderr);
    assert.doesNotMatch(run.stderr, /TYPESAFE_API_KEY is not set/);
    assert.match(run.stdout, /unmeasured: the memory database stood down/);
});

test('a case file with nine true negatives is refused with exit 2, and one with ten is scored', (t) => {
    const dir = tempDir(t, 'cases');
    const rows = shippedCases();
    const positives = rows.filter((r) => r.gold.length > 0);
    const negatives = rows.filter((r) => r.gold.length === 0);
    assert.ok(negatives.length >= 10, 'the shipped file carries enough negatives to build both sides');

    const nine = runHarness(t, { MOCK: '1' }, ['--cases', writeCases(fs.mkdtempSync(path.join(dir, 'a-')), positives.concat(negatives.slice(0, 9)))]);
    assert.equal(nine.status, 2, nine.stderr);
    // The refusal names the count it found and the floor it needs; the tokens
    // pin the rule, and the sentence around them is free to change.
    assert.match(nine.stderr, /\b9\b/);
    assert.match(nine.stderr, /\b10\b/);
    assert.equal(nine.stdout, '', 'a refused case file is scored not at all');

    const ten = runHarness(t, { MOCK: '1' }, ['--cases', writeCases(fs.mkdtempSync(path.join(dir, 'b-')), positives.concat(negatives.slice(0, 10)))]);
    assert.equal(ten.status, 0, ten.stderr);
    assert.match(ten.stdout, /clean negatives \d+\/10/);
});

test('a planted key rides in the request header and appears in no output and no written file', (t) => {
    const planted = 'PLANTED-KEY-7c1e0d9a-do-not-print';
    // The MOCK endpoint answers 401 to any request whose Authorization header
    // is not `Bearer <key>`, and a 401 leaves its situation unmeasured, so
    // exit 0 is the evidence that the planted key was the one sent.
    const run = runHarness(t, { MOCK: '1', TYPESAFE_API_KEY: planted });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.includes(planted), false);
    assert.equal(run.stderr.includes(planted), false);

    // The scan speaks: it finds a string the results file is known to hold,
    // and it finds the planted key in a file planted beside the run's output.
    assert.ok(filesHolding(run.cwd, 'mock-filler-').length > 0, 'the scan reads the files the run wrote');
    const canary = tempDir(t, 'canary');
    fs.writeFileSync(path.join(canary, 'leak.txt'), `authorization: Bearer ${planted}\n`, 'utf8');
    assert.equal(filesHolding(canary, planted).length, 1, 'the scan catches the key where it is');

    assert.deepEqual(filesHolding(run.cwd, planted), []);
});

test('a cleartext endpoint off loopback is refused with exit 2, and a loopback one is accepted', (t) => {
    for (const url of ['http://203.0.113.5:9999', 'http://192.168.1.10', 'ftp://example.com']) {
        const run = runHarness(t, { MOCK: '1', TYPESAFE_API_URL: url });
        assert.equal(run.status, 2, `${url}: ${run.stderr}`);
        assert.match(run.stderr, /https/);
        assert.match(run.stderr, /loopback/);
        assert.equal(run.stderr.includes(url), false, 'the refusal does not print the address');
    }
    for (const url of ['http://127.0.0.1:8080', 'http://localhost:8080', 'https://jev.example.com']) {
        const run = runHarness(t, { MOCK: '1', TYPESAFE_API_URL: url });
        assert.equal(run.status, 0, `${url}: ${run.stderr}`);
    }
});

test('the shipped situation file loads, with at least twenty situations and ten true negatives', () => {
    const loaded = harness.loadCases(CASES);
    assert.equal(loaded.ok, true, loaded.detail);
    assert.ok(loaded.cases.length >= 20, `${loaded.cases.length} situations`);
    const negatives = loaded.cases.filter((c) => c.gold.length === 0).length;
    assert.ok(negatives >= harness.MIN_NEGATIVES, `${negatives} negatives`);
});

test('an endpoint carrying a path or query is refused with exit 2 by the host-only rule', (t) => {
    for (const url of ['https://jev.example.com/v1', 'https://jev.example.com?x=1']) {
        const run = runHarness(t, { MOCK: '1', TYPESAFE_API_URL: url });
        assert.equal(run.status, 2, `${url}: ${run.stderr}`);
        assert.match(run.stderr, /path/);
        assert.doesNotMatch(run.stderr, /loopback/, 'the host-only rule refused it, not the scheme rule');
    }
});

test('--cases with no file after it is refused with exit 2', (t) => {
    const run = runHarness(t, { MOCK: '1' }, ['--cases']);
    assert.equal(run.status, 2, run.stderr);
    assert.match(run.stderr, /--cases/);
    assert.equal(run.stdout, '');
});

test('a situation whose shortlist comes back empty is reported unmeasured, and the run exits 1', (t) => {
    const dir = tempDir(t, 'empty');
    const rows = shippedCases();
    const n = Math.max(...rows.map((r) => r.n)) + 1;
    rows.push({ n, situation: 'mock-empty-shortlist: nothing in the store is near this', composed: 'seg mock-empty-shortlist', gold: [] });
    const run = runHarness(t, { MOCK: '1' }, ['--cases', writeCases(dir, rows)]);
    assert.equal(run.status, 1, run.stderr);
    assert.match(run.stdout, new RegExp(`${n}\\s+unmeasured: stage 1 returned no candidates`));
    assert.match(run.stdout, new RegExp(`unmeasured: ${n}\\n`));
});

test('a gold tied with a ghost ranks behind it, and golds tied with each other share rank 1', () => {
    const { scoreOne } = harness;
    const candidates = [{ name: 'gold-a' }, { name: 'ghost' }, { name: 'gold-b' }];
    const tiedWithGhost = scoreOne({ n: 1, gold: ['gold-a'] }, candidates, { c1: 0.8, c2: 0.8, c3: 0.1 });
    assert.equal(tiedWithGhost.golds[0].judgeRank, 2);
    const goldsTied = scoreOne({ n: 2, gold: ['gold-a', 'gold-b'] }, candidates, { c1: 0.9, c2: 0.2, c3: 0.9 });
    assert.deepEqual(goldsTied.golds.map((g) => g.judgeRank), [1, 1]);
});

test('an endpoint with a bare query or fragment mark, or with credentials, is refused with exit 2', (t) => {
    for (const url of ['https://jev.example.com?', 'https://jev.example.com#', 'https://u:p@jev.example.com']) {
        const run = runHarness(t, { MOCK: '1', TYPESAFE_API_URL: url });
        assert.equal(run.status, 2, `${url}: ${run.stderr}`);
        assert.equal(run.stderr.includes('u:p'), false, 'the refusal does not print the credentials');
    }
});
