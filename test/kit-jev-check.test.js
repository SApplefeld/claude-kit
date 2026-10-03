'use strict';

// The promises check's contract: the request built from the gathered code and
// the questions file and nothing else, the ranking on printed values, the
// three closing lines with their exit codes, the record written only after a
// checked run, the delta arithmetic against a record, the cap, the two
// screens as this tool meets them, and the usage refusals. The tool is run as
// a child process against a stand-in Jev on 127.0.0.1, with a home directory
// and a planted key of the test's own, so nothing here leaves the machine and
// the real key never reaches a child. The source files the tool gathers are
// written under a temp directory and carry no credential shape, except where
// a test plants one to reach the client's screen.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const SCRIPTS = path.join(__dirname, '..', 'plugins', 'grimoire', 'scripts');
const TOOL = path.join(SCRIPTS, 'kit-jev-check.js');
const { gatherCode } = require(path.join(SCRIPTS, 'jev-gather.js'));

// A recognizable key, planted in every child's environment so any output
// carrying it or any eight characters of it fails the sweep below.
const PLANTED_KEY = 'PLANTED-KEY-7f3a9c';

const CLOSING_SENTENCE_MARK = 'never a finding';

// ---------------------------------------------------------------- fixtures --

// A fresh directory, removed after the test. A child's home is one, so the
// client's fixed config path resolves under it. `os.homedir()` reads
// USERPROFILE on Windows and HOME elsewhere.
function tempDir(t, prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

function writeConfig(home, endpoint) {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'kit-jev.json'), JSON.stringify({ endpoint, model: 'jev-test' }));
}

// A stand-in Jev on an ephemeral port that records every request body and
// answers each asked question with the `noul` value `score(n, id)` returns
// for the n-th request (1-based), or a status from `status(n)` where that
// returns one.
function startServer(t, score, status) {
    return new Promise((resolve) => {
        const requests = [];
        const server = http.createServer((req, res) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                let body = null;
                try { body = JSON.parse(raw); } catch { body = null; }
                requests.push(body);
                const n = requests.length;
                const code = status === undefined ? undefined : status(n);
                if (code !== undefined) {
                    res.writeHead(code, { 'content-type': 'application/json' });
                    res.end('{}');
                    return;
                }
                const answers = {};
                for (const id of Object.keys((body && body.questions) || {})) {
                    answers[id] = { type: 'noul', noul: score(n, id) };
                }
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ model: 'jev-test', answers, usage: { input_tokens: 100 * n, output_tokens: 1 } }));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            t.after(() => new Promise((done) => {
                server.closeAllConnections();
                server.close(() => done());
            }));
            resolve({ url: `http://127.0.0.1:${port}`, requests });
        });
    });
}

// The tool as a child, its home and key replaced so no child reaches the
// real config or the real key. The parent's environment rides under those
// overrides on the sibling tests' shape, since Node needs the system paths.
// The spawn is asynchronous because the stand-in server runs in this process
// and a synchronous spawn would block the loop that answers it. The key sweep
// runs after the child's result is awaited, so a leaked key rejects the test
// that ran it.
async function run(args, home, key) {
    const r = await spawnTool(args, home, key);
    assertNoKey(r);
    return r;
}

function spawnTool(args, home, key) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [TOOL, ...args], {
            env: { ...process.env, USERPROFILE: home, HOME: home, TYPESAFE_API_KEY: key === undefined ? PLANTED_KEY : key }
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        const timer = setTimeout(() => { child.kill(); }, 60000);
        child.on('error', (err) => { clearTimeout(timer); reject(err); });
        child.on('close', (status) => {
            clearTimeout(timer);
            resolve({ status, stdout, stderr });
        });
    });
}

// Everything a run wrote, checked for the key or any eight consecutive
// characters of it.
function assertNoKey(r) {
    const text = r.stdout + '\n' + r.stderr;
    for (let i = 0; i + 8 <= PLANTED_KEY.length; i += 1) {
        assert.ok(!text.includes(PLANTED_KEY.slice(i, i + 8)), `output carries ${PLANTED_KEY.slice(i, i + 8)}`);
    }
}

test('the key sweep speaks: an output carrying eight characters of the planted key fails it', () => {
    assert.throws(() => assertNoKey({ stdout: '', stderr: `refused ${PLANTED_KEY.slice(4, 12)} back` }), /output carries/);
    assert.doesNotThrow(() => assertNoKey({ stdout: 'jev promises: not configured\n', stderr: '' }));
});

// A run armed against a stand-in server: a home with the config naming it.
async function armed(t, score, status) {
    const server = await startServer(t, score, status);
    const home = tempDir(t, 'kit-jev-check-');
    writeConfig(home, server.url);
    return { server, home };
}

function writeFile(dir, name, text) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, text);
    return file;
}

function writeQuestions(dir, entries, name = 'questions.json') {
    return writeFile(dir, name, JSON.stringify(entries));
}

// Two source files free of every credential shape: a script whose comment the
// gatherer strips, and a text file it sends as it stands.
function writeSources(dir) {
    return [
        writeFile(dir, 'util.js', '// a comment the gatherer strips\nfunction add(a, b) {\n    return a + b;\n}\n'),
        writeFile(dir, 'notes.txt', 'plain notes\n')
    ];
}

// A questions file of the given ids, each promise `<ID> promise`.
function promisesOf(ids) {
    return ids.map((id) => ({ id, promise: `${id.toUpperCase()} promise` }));
}

// A score function answering each `p_<id>` from a map, for every request.
function byId(values) {
    return (n, id) => values[id.slice(2)];
}

// --------------------------------------------------------- the request --

test('the request carries the gathered code as its whole state and one noul question per promise', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const dir = tempDir(t, 'kit-jev-src-');
    const sources = writeSources(dir);
    const questions = writeQuestions(dir, [{ id: 'one', promise: 'The first promise.' }, { id: 'two', promise: 'The second promise.' }], 'q-QPATHMARK.json');
    const r = await run(['promises', questions, ...sources], home);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(server.requests.length, 1);

    const body = server.requests[0];
    assert.deepEqual(Object.keys(body).sort(), ['model', 'questions', 'state']);
    assert.equal(body.model, 'jev-test');
    assert.deepEqual(body.state, { code: gatherCode(sources).code });
    assert.deepEqual(Object.keys(body.questions), ['p_one', 'p_two']);
    for (const [key, promise] of [['p_one', 'The first promise.'], ['p_two', 'The second promise.']]) {
        const q = body.questions[key];
        assert.equal(q.type, 'noul', key);
        assert.ok(q.instructions.includes(promise), `${key} asks about its own promise`);
        assert.deepEqual(Object.keys(q.criteria).sort(), ['false', 'true'], key);
    }
    assert.ok(!JSON.stringify(body).includes('QPATHMARK'), 'the questions file path rides the request');
});

// -------------------------------------------------------------- the report --

test('promises print most doubted first, ties on the printed value in file order, under the header and above the closing line', async (t) => {
    // b and c both print 0.70; c's raw value is higher, so b leads c only if
    // the ranking reads the printed value and keeps file order on the tie.
    const long = `L${'x'.repeat(99)}`;
    const entries = [
        { id: 'a', promise: 'A promise' },
        { id: 'b', promise: 'B promise' },
        { id: 'c', promise: 'C promise' },
        { id: 'd', promise: 'D promise' },
        { id: 'e', promise: long }
    ];
    const { server, home } = await armed(t, byId({ a: 0.2, b: 0.696, c: 0.704, d: 0.9, e: 0.05 }));
    const dir = tempDir(t, 'kit-jev-src-');
    const r = await run(['promises', writeQuestions(dir, entries), ...writeSources(dir)], home);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    assert.equal(server.requests.length, 1);

    assert.deepEqual(r.stdout.split(/\r?\n/).slice(0, -2), [
        'model jev-test, input tokens 100, files 2',
        'd: doubt 0.90  D promise',
        'b: doubt 0.70  B promise',
        'c: doubt 0.70  C promise',
        'a: doubt 0.20  A promise',
        `e: doubt 0.05  ${long.slice(0, 80)}`,
        'jev promises: 5 promises, most doubted d at 0.90'
    ]);
    const lines = r.stdout.split(/\r?\n/);
    assert.equal(lines[lines.length - 1], '');
    assert.ok(lines[lines.length - 2].includes(CLOSING_SENTENCE_MARK), 'the final line says doubt is never a finding');
    assert.deepEqual(lines.filter((line) => line.startsWith('jev promises:')), ['jev promises: 5 promises, most doubted d at 0.90']);
});

test('the report is all or nothing: a refused request prints only the not-checked line', async (t) => {
    const { server, home } = await armed(t, () => 0.5, () => 500);
    const dir = tempDir(t, 'kit-jev-src-');
    const r = await run(['promises', writeQuestions(dir, promisesOf(['a'])), ...writeSources(dir)], home);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev promises: not checked (refused)\n');
    assert.equal(r.stderr, '');
    assert.equal(server.requests.length, 1);
});

test('a machine with no config reads not configured, an unusable config and a missing key read not checked', async (t) => {
    const dir = tempDir(t, 'kit-jev-src-');
    const args = ['promises', writeQuestions(dir, promisesOf(['a'])), ...writeSources(dir)];

    const bare = tempDir(t, 'kit-jev-check-');
    const r = await run(args, bare);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev promises: not configured\n');
    assert.equal(r.stderr, '');

    const broken = tempDir(t, 'kit-jev-check-');
    fs.mkdirSync(path.join(broken, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(broken, '.claude', 'kit-jev.json'), 'not json');
    const unusable = await run(args, broken);
    assert.equal(unusable.status, 2);
    assert.equal(unusable.stdout, 'jev promises: not checked (config unusable)\n');
    assert.equal(unusable.stderr, '');

    const { server, home } = await armed(t, () => 0.5);
    const noKey = await run(args, home, '');
    assert.equal(noKey.status, 2);
    assert.equal(noKey.stdout, 'jev promises: not checked (no key)\n');
    assert.equal(noKey.stderr, '');
    assert.equal(server.requests.length, 0);

    // The control: the same arguments with the key set reach the server.
    const keyed = await run(args, home);
    assert.equal(keyed.status, 0, keyed.stderr);
    assert.equal(server.requests.length, 1);
});

// ------------------------------------------------------------------ the cap --

test('code past 120,000 units is not checked and nothing is sent; code at the bound is sent; no config wins over the cap', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const dir = tempDir(t, 'kit-jev-src-');
    const questions = writeQuestions(dir, promisesOf(['a']));
    const file = path.join(dir, 'big.txt');
    const header = `==== ${file}\n`;
    const atBound = 'x'.repeat(120000 - header.length - 1) + '\n';
    fs.writeFileSync(file, atBound);
    assert.equal(gatherCode([file]).code.length, 120000);

    const sent = await run(['promises', questions, file], home);
    assert.equal(sent.status, 0, sent.stderr);
    assert.equal(server.requests.length, 1);
    assert.equal(server.requests[0].state.code.length, 120000);

    fs.writeFileSync(file, 'x' + atBound);
    assert.equal(gatherCode([file]).code.length, 120001);
    const over = await run(['promises', questions, file], home);
    assert.equal(over.status, 2);
    assert.equal(over.stdout, 'jev promises: not checked (code too long)\n');
    assert.equal(server.requests.length, 1);

    const bare = await run(['promises', questions, file], tempDir(t, 'kit-jev-check-'));
    assert.equal(bare.status, 2);
    assert.equal(bare.stdout, 'jev promises: not configured\n');
});

// -------------------------------------------------------------- the screens --

test('a source path on the gather screen is not checked, names the path on stderr, prints no content and sends nothing', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const dir = tempDir(t, 'kit-jev-src-');
    const sources = writeSources(dir);
    const questions = writeQuestions(dir, promisesOf(['a']));
    const env = writeFile(dir, '.env', 'ENVCONTENT-h8\n');
    const r = await run(['promises', questions, ...sources, env], home);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev promises: not checked (screened file)\n');
    assert.ok(r.stderr.includes(env), r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes('ENVCONTENT'), 'the screened file content was printed');
    assert.equal(server.requests.length, 0);

    // The control: the same run without the screened path is sent.
    const ok = await run(['promises', questions, ...sources], home);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(server.requests.length, 1);
});

test('a source carrying a credential shape is refused by the client screen, with the key set and the server armed', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const dir = tempDir(t, 'kit-jev-src-');
    const questions = writeQuestions(dir, promisesOf(['a']));
    const file = path.join(dir, 'cfg.js');
    const planted = ['const pass', 'word = "', 'abcdefgh12', '";\n'].join('');
    fs.writeFileSync(file, `function f() {}\n${planted}`);
    const r = await run(['promises', questions, file], home);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev promises: not checked (screened)\n');
    assert.ok(!(r.stdout + r.stderr).includes('abcdefgh12'), 'the planted literal was printed');
    assert.equal(server.requests.length, 0);

    // The control: the same file without the assignment is sent.
    fs.writeFileSync(file, 'function f() {}\n');
    const ok = await run(['promises', questions, file], home);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(server.requests.length, 1);
});

// --------------------------------------------------------------- the record --

test('--record writes the record after a checked run only, creating its parent', async (t) => {
    const { server, home } = await armed(t, byId({ a: 0.346, b: 0.4 }), (n) => (n === 2 ? 500 : undefined));
    const dir = tempDir(t, 'kit-jev-src-');
    const args = ['promises', writeQuestions(dir, promisesOf(['a', 'b'])), ...writeSources(dir)];

    const record = path.join(dir, 'nested', 'deeper', 'record.json');
    const before = Date.now();
    const r = await run([...args, '--record', record], home);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    const written = JSON.parse(fs.readFileSync(record, 'utf8'));
    assert.deepEqual(Object.keys(written).sort(), ['answers', 'at', 'model']);
    assert.equal(written.model, 'jev-test');
    assert.deepEqual(written.answers, { a: 0.346, b: 0.4 });
    assert.match(written.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(Date.parse(written.at) >= before - 1000 && Date.parse(written.at) <= Date.now() + 1000, written.at);

    // A refused request writes nothing.
    const refusedRecord = path.join(dir, 'refused', 'record.json');
    const refused = await run([...args, '--record', refusedRecord], home);
    assert.equal(refused.status, 2);
    assert.equal(fs.existsSync(path.join(dir, 'refused')), false);
    assert.equal(server.requests.length, 2);

    // A machine with no config writes nothing.
    const bareRecord = path.join(dir, 'bare', 'record.json');
    const bare = await run([...args, '--record', bareRecord], tempDir(t, 'kit-jev-check-'));
    assert.equal(bare.stdout, 'jev promises: not configured\n');
    assert.equal(fs.existsSync(path.join(dir, 'bare')), false);
});

test('a record that cannot be written is one stderr line, and the run keeps its reading and exit 0', async (t) => {
    const { home } = await armed(t, () => 0.5);
    const dir = tempDir(t, 'kit-jev-src-');
    const blocker = writeFile(dir, 'a-file', 'not a directory\n');
    const r = await run(['promises', writeQuestions(dir, promisesOf(['a'])), ...writeSources(dir), '--record', path.join(blocker, 'record.json')], home);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes('jev promises: 1 promises, most doubted a at 0.50\n'), r.stdout);
    assert.equal(r.stderr.trim().split('\n').length, 1, r.stderr);
    assert.match(r.stderr, /record/);
});

// ---------------------------------------------------------------- the delta --

test('--against prints each was and delta from the printed values, new for an unrecorded id, and the largest rise in file order', async (t) => {
    // a rises from a printed 0.10 to a printed 0.35, +0.25, though the raw
    // rise is 0.242. e also rises +0.25 on raw values, so a wins the largest
    // rise only on the printed arithmetic and file order. b falls, c holds,
    // d is new, and the record's z is ignored.
    const { server, home } = await armed(t, byId({ a: 0.346, b: 0.4, c: 0.5, d: 0.6, e: 0.75 }));
    const dir = tempDir(t, 'kit-jev-src-');
    const record = writeFile(dir, 'rec-RPATHMARK.json', JSON.stringify({ model: 'jev-test', at: '2026-10-01T00:00:00.000Z', answers: { a: 0.104, b: 0.5, c: 0.5, e: 0.5, z: 0.9 } }));
    const r = await run(['promises', writeQuestions(dir, promisesOf(['a', 'b', 'c', 'd', 'e'])), ...writeSources(dir), '--against', record], home);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.split(/\r?\n/).slice(0, -2), [
        'model jev-test, input tokens 100, files 2',
        'e: doubt 0.75  E promise (was 0.50, +0.25)',
        'd: doubt 0.60  D promise (new)',
        'c: doubt 0.50  C promise (was 0.50, +0.00)',
        'b: doubt 0.40  B promise (was 0.50, -0.10)',
        'a: doubt 0.35  A promise (was 0.10, +0.25)',
        'jev promises: 5 promises, most doubted e at 0.75, largest rise a by +0.25'
    ]);
    assert.ok(!JSON.stringify(server.requests[0]).includes('RPATHMARK'), 'the record path rides the request');
    assert.ok(!JSON.stringify(server.requests[0]).includes('0.104'), 'a recorded value rides the request');
});

test('--record and --against on one path read the old record before the send and write the new one after; no rise adds no clause', async (t) => {
    const { home } = await armed(t, (n) => (n === 1 ? 0.8 : 0.3));
    const dir = tempDir(t, 'kit-jev-src-');
    const args = ['promises', writeQuestions(dir, promisesOf(['a'])), ...writeSources(dir)];
    const record = path.join(dir, 'record.json');

    const first = await run([...args, '--record', record], home);
    assert.equal(first.status, 0, first.stderr);
    const second = await run([...args, '--against', record, '--record', record], home);
    assert.equal(second.status, 0, second.stderr);
    assert.ok(second.stdout.includes('a: doubt 0.30  A promise (was 0.80, -0.50)\n'), second.stdout);
    assert.ok(second.stdout.includes('jev promises: 1 promises, most doubted a at 0.30\n'), second.stdout);
    assert.ok(!second.stdout.includes('largest rise'), second.stdout);
    assert.deepEqual(JSON.parse(fs.readFileSync(record, 'utf8')).answers, { a: 0.3 });
});

// A computed key, since a literal `__proto__:` in an object sets its prototype.
test('an id of __proto__ is read, sent, answered and printed like any other', async (t) => {
    const { server, home } = await armed(t, byId({ ['__proto__']: 0.7, b: 0.2 }));
    const dir = tempDir(t, 'kit-jev-src-');
    const r = await run(['promises', writeQuestions(dir, [{ id: '__proto__', promise: 'P promise' }, { id: 'b', promise: 'B promise' }]), ...writeSources(dir)], home);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(Object.keys(server.requests[0].questions), ['p___proto__', 'p_b']);
    assert.ok(r.stdout.includes('__proto__: doubt 0.70  P promise\n'), r.stdout);
    assert.ok(r.stdout.includes('jev promises: 2 promises, most doubted __proto__ at 0.70\n'), r.stdout);
});

// ------------------------------------------------------------- the usage --

test('every usage refusal is one stderr line naming its rule, exit 1, with nothing sent', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const dir = tempDir(t, 'kit-jev-src-');
    const sources = writeSources(dir);
    const good = writeQuestions(dir, promisesOf(['s3-b1.x_2']), 'good.json');
    const q = (name, body) => writeFile(dir, name, body);
    const rec = (name, body) => writeFile(dir, name, body);
    const missing = path.join(dir, 'absent.json');

    // Each case is the valid run below with one thing changed, and carries a
    // token of the rule that must refuse it, matched on the detail before the
    // usage text, so a case refused by an earlier rule fails here.
    const cases = [
        ['no verb', [], /no verb/],
        ['the retired spec verb', ['spec', good, ...sources], /only verb is promises/],
        ['another verb', ['check', good, ...sources], /only verb is promises/],
        ['no questions file', ['promises'], /no questions file/],
        ['no source path', ['promises', good], /no source file/],
        ['an unknown flag', ['promises', good, ...sources, '--force', 'x'], /unknown flag/],
        ['--record with no path', ['promises', good, ...sources, '--record'], /--record takes a path/],
        ['--against with no path', ['promises', good, ...sources, '--against'], /--against takes a path/],
        ['--record followed by a flag', ['promises', good, ...sources, '--record', '--against', missing], /--record takes a path/],
        ['--record given twice', ['promises', good, ...sources, '--record', path.join(dir, 'r1.json'), '--record', path.join(dir, 'r2.json')], /--record is given twice/],
        ['a questions file that cannot be read', ['promises', missing, ...sources], /questions file could not be read/],
        ['a questions file that is not JSON', ['promises', q('nj.json', 'not json'), ...sources], /not JSON/],
        ['a questions file that is an object', ['promises', q('obj.json', '{}'), ...sources], /non-empty array/],
        ['an empty questions file', ['promises', q('empty.json', '[]'), ...sources], /non-empty array/],
        ['an entry that is not an object', ['promises', q('num.json', '[1]'), ...sources], /not an object/],
        ['an empty id', ['promises', q('eid.json', JSON.stringify([{ id: '', promise: 'p' }])), ...sources], /no id/],
        ['an id that is not a string', ['promises', q('nid.json', JSON.stringify([{ id: 7, promise: 'p' }])), ...sources], /no id/],
        ['a repeated id', ['promises', q('rid.json', JSON.stringify([{ id: 'a', promise: 'p' }, { id: 'a', promise: 'q' }])), ...sources], /repeated/],
        ['an id holding a colon and a space', ['promises', q('cid.json', JSON.stringify([{ id: 'jev promises: not configured', promise: 'p' }])), ...sources], /id holds a character outside A-Z, a-z, 0-9/],
        ['an id holding a line break', ['promises', q('lid.json', JSON.stringify([{ id: 'a\njev promises: forged', promise: 'p' }])), ...sources], /id holds a character outside A-Z, a-z, 0-9/],
        ['an id holding a delete character', ['promises', q('did.json', JSON.stringify([{ id: 'a\u007f', promise: 'p' }])), ...sources], /id holds a character outside A-Z, a-z, 0-9/],
        ['a promise holding a line break', ['promises', q('lp.json', JSON.stringify([{ id: 'a', promise: 'p\njev promises: forged' }])), ...sources], /promise holds a control character/],
        ['a promise holding a NUL', ['promises', q('np.json', JSON.stringify([{ id: 'a', promise: 'p\u0000' }])), ...sources], /promise holds a control character/],
        ['an empty promise', ['promises', q('ep.json', JSON.stringify([{ id: 'a', promise: '' }])), ...sources], /no promise/],
        ['a missing promise', ['promises', q('mp.json', JSON.stringify([{ id: 'a' }])), ...sources], /no promise/],
        ['a record that cannot be read', ['promises', good, ...sources, '--against', missing], /record could not be read/],
        ['a record that is not JSON', ['promises', good, ...sources, '--against', rec('rnj.json', 'not json')], /record is not JSON/],
        ['a record with no answers object', ['promises', good, ...sources, '--against', rec('rna.json', JSON.stringify({ model: 'm', at: 'x' }))], /no answers object/],
        ['a record answer that is not a number', ['promises', good, ...sources, '--against', rec('rnn.json', JSON.stringify({ answers: { a: 'high' } }))], /answers are not all numbers from 0 to 1/],
        ['a record answer above 1', ['promises', good, ...sources, '--against', rec('rhi.json', JSON.stringify({ answers: { a: 1.5 } }))], /answers are not all numbers from 0 to 1/],
        ['a record answer below 0', ['promises', good, ...sources, '--against', rec('rlo.json', JSON.stringify({ answers: { a: -0.1 } }))], /answers are not all numbers from 0 to 1/],
        ['a source path that cannot be read', ['promises', good, sources[0], path.join(dir, 'absent.js')], /source file could not be read/]
    ];
    for (const [label, args, rule] of cases) {
        const r = await run(args, home);
        assert.equal(r.status, 1, label);
        assert.equal(r.stdout, '', label);
        assert.equal(r.stderr.trim().split('\n').length, 1, `${label}: ${r.stderr}`);
        assert.match(r.stderr, /usage: node kit-jev-check\.js promises <questions\.json> <file>\.\.\./, label);
        assert.match(r.stderr.split('; usage:')[0], rule, `${label}: ${r.stderr}`);
    }
    assert.equal(server.requests.length, 0);
    assert.equal(fs.existsSync(path.join(dir, 'r1.json')) || fs.existsSync(path.join(dir, 'r2.json')), false);

    // The control: the valid run every case varies is sent, its id carrying
    // each character the id rule allows beside letters and digits.
    const ok = await run(['promises', good, ...sources, '--against', rec('valid-rec.json', JSON.stringify({ answers: { 's3-b1.x_2': 0.5 } }))], home);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(server.requests.length, 1);
    assert.deepEqual(Object.keys(server.requests[0].questions), ['p_s3-b1.x_2']);
});
