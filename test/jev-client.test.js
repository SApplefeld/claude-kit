'use strict';

// The Jev client's contract: the fixed config path and its four refusals, the
// cleartext refusal on everything but https and loopback, the key read at each
// call, the one deadline over retries, the closed set of nine reasons, the
// credential screen over every body, and the guarantee that the key reaches no
// artifact a call produces. Every call runs against a stand-in server on
// 127.0.0.1 or a recording fetch stub, so nothing here leaves the machine.
// Tests in this file run serially, since the home directory and the key are
// process environment.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const util = require('util');

const client = require('../plugins/grimoire/scripts/jev-client.js');
const { gatherCode } = require('../plugins/grimoire/scripts/jev-gather.js');
const { MAX_BODY_BYTES } = require('../plugins/grimoire/scripts/kit-endpoint-lib.js');

// A recognizable key, planted in the environment so any artifact carrying it
// or any eight characters of it fails the sweep below.
const PLANTED_KEY = 'PLANTED-KEY-7f3a9c';

// A backslash, built rather than typed, for the endpoints the URL parser reads
// differently from their text.
const BS = String.fromCharCode(92);

const REASONS = ['not configured', 'config unusable', 'no key', 'timeout',
    'unreachable', 'refused', 'busy', 'unusable answer', 'screened'];

const QUESTIONS = {
    q_a: { type: 'noul', instructions: 'Is the sky blue?', criteria: { true: 'yes', false: 'no' } },
    q_b: { type: 'noul', instructions: 'Is water dry?', criteria: { true: 'yes', false: 'no' } }
};
const STATE = { spec: 'the section text' };
const GOOD_BODY = {
    model: 'jev-1.0',
    answers: { q_a: { type: 'noul', noul: 0.25 }, q_b: { type: 'noul', noul: 0.9 } },
    usage: { input_tokens: 42, output_tokens: 3 }
};
// What the client hands back for GOOD_BODY: the validated number and nothing
// else the vendor's answer object carried.
const EXPECTED_ANSWERS = { q_a: { noul: 0.25 }, q_b: { noul: 0.9 } };

// ---------------------------------------------------------------- fixtures --

// Set or delete one environment name for the rest of a test. Each test keeps
// one record of every name it touched and the value that name held before the
// test's first set of it, flushed by a single `t.after`, so a name set twice
// goes back to its original value rather than to an intermediate one. A
// process.env value is always a string, so `undefined` in the record means the
// name was absent.
const envRecords = new WeakMap();

function setEnv(t, name, value) {
    let record = envRecords.get(t);
    if (record === undefined) {
        record = new Map();
        envRecords.set(t, record);
        t.after(() => {
            for (const [touched, original] of record) {
                if (original === undefined) delete process.env[touched];
                else process.env[touched] = original;
            }
        });
    }
    if (!record.has(name)) record.set(name, Object.hasOwn(process.env, name) ? process.env[name] : undefined);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

// A fresh home for one test, so the module's fixed config path resolves under
// it. `os.homedir()` reads USERPROFILE on Windows and HOME elsewhere.
function tempHome(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-jev-'));
    setEnv(t, 'USERPROFILE', home);
    setEnv(t, 'HOME', home);
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    return home;
}

function configFile(home) {
    return path.join(home, '.claude', 'kit-jev.json');
}

function writeConfig(home, body) {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(configFile(home), typeof body === 'string' ? body : JSON.stringify(body));
}

// A stand-in Jev on an ephemeral port that records every request and answers
// with whatever `handler(body, req)` returns: `{ status, headers, body }` for
// a JSON answer, `{ raw }` for bytes as they stand, `{ hold: true }` to never
// answer, `{ cut: true }` to send a 200 header and the opening bytes of a body
// and then destroy the socket.
function startServer(t, handler) {
    return new Promise((resolve) => {
        const requests = [];
        const server = http.createServer((req, res) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                let body = null;
                try { body = JSON.parse(raw); } catch { body = null; }
                requests.push({ method: req.method, url: req.url, headers: req.headers, body });
                const out = handler(body, req, requests.length) || {};
                if (out.hold === true) return;
                if (out.cut === true) {
                    res.writeHead(200, { 'content-type': 'application/json', 'content-length': '64' });
                    res.write('{"answers":{"q_a":', () => { res.socket.destroy(); });
                    return;
                }
                res.writeHead(out.status || 200, { 'content-type': 'application/json', ...(out.headers || {}) });
                res.end(out.raw !== undefined ? out.raw : JSON.stringify(out.body === undefined ? GOOD_BODY : out.body));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            t.after(() => new Promise((done) => {
                server.closeAllConnections();
                server.close(() => done());
            }));
            resolve({ url: `http://127.0.0.1:${port}`, port, requests });
        });
    });
}

// A stand-in `fetch` that records its calls and answers nothing, for the cases
// where the refusal must land before any socket opens. Restored after the test.
function stubFetch(t) {
    const calls = [];
    const real = globalThis.fetch;
    globalThis.fetch = (...args) => { calls.push(args); return Promise.reject(new Error('stub fetch reached')); };
    t.after(() => { globalThis.fetch = real; });
    return calls;
}

// One call, with everything it could write captured beside what it returned or
// threw. Writes are forwarded to their real destination so the test runner's
// own channel is left intact.
async function call(args) {
    const written = { 'console.log': '', 'console.error': '', 'stdout.write': '', 'stderr.write': '' };
    const saved = {
        log: console.log, error: console.error,
        out: process.stdout.write, err: process.stderr.write
    };
    console.log = (...parts) => { written['console.log'] += parts.map(String).join(' ') + '\n'; saved.log.apply(console, parts); };
    console.error = (...parts) => { written['console.error'] += parts.map(String).join(' ') + '\n'; saved.error.apply(console, parts); };
    process.stdout.write = (chunk, ...rest) => { written['stdout.write'] += String(chunk); return saved.out.call(process.stdout, chunk, ...rest); };
    process.stderr.write = (chunk, ...rest) => { written['stderr.write'] += String(chunk); return saved.err.call(process.stderr, chunk, ...rest); };
    const started = Date.now();
    let result;
    let thrown;
    try {
        result = await client.askJev(...args);
    } catch (err) {
        thrown = err;
    } finally {
        console.log = saved.log;
        console.error = saved.error;
        process.stdout.write = saved.out;
        process.stderr.write = saved.err;
    }
    return { result, thrown, written, elapsedMs: Date.now() - started };
}

// ----------------------------------------------------------------- the sweep --

// Every artifact one call produced, as text. The returned object is rendered
// twice: as JSON, and through `util.inspect`, which shows an Error's message
// and non-enumerable fields that JSON renders as `{}`.
function artifactsOf(made) {
    return {
        returned: JSON.stringify(made.result === undefined ? null : made.result),
        inspected: util.inspect(made.result, { depth: Infinity }),
        thrown: made.thrown === undefined ? '' : String(made.thrown) + '\n' + String(made.thrown && made.thrown.stack),
        ...made.written
    };
}

// The artifacts that carry the key or any eight consecutive characters of it.
// Empty is clean.
function keyTraces(key, artifacts) {
    const windows = [];
    for (let i = 0; i + 8 <= key.length; i += 1) windows.push(key.slice(i, i + 8));
    const hits = [];
    for (const [name, text] of Object.entries(artifacts)) {
        for (const w of windows) if (text.includes(w)) hits.push(`${name} carries ${w}`);
    }
    return hits;
}

function assertClean(made) {
    assert.deepEqual(keyTraces(PLANTED_KEY, artifactsOf(made)), []);
}

function assertRefusal(made, reason) {
    assert.equal(made.thrown, undefined, `no throw, got ${made.thrown}`);
    const out = made.result;
    assert.equal(out.ok, false, JSON.stringify(out));
    assert.equal(out.reason, reason, JSON.stringify(out));
    assert.ok(REASONS.includes(out.reason), 'reason is one of the nine');
    assert.ok(!('answers' in out), 'a failure never carries answers');
    if ('detail' in out) assert.equal(typeof out.detail, 'string');
    assertClean(made);
}

// A usable config on the stand-in server, with the planted key in place.
function arm(t, server, extra) {
    const home = tempHome(t);
    writeConfig(home, { endpoint: server.url, model: 'jev-test', ...(extra || {}) });
    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    return home;
}

// ---------------------------------------------------------------- the config --

test('the config is read under the home directory at each call, never once at load', (t) => {
    const home = tempHome(t);
    const absent = client.loadJevConfig();
    assert.equal(absent.ok, false);
    assert.equal(absent.reason, 'absent');
    assert.equal(absent.path, configFile(home));

    writeConfig(home, { endpoint: 'https://api.example.test/', model: ' jev-latest ' });
    const found = client.loadJevConfig();
    assert.deepEqual(found, { ok: true, path: configFile(home), endpoint: 'https://api.example.test', model: 'jev-latest' });
});

test('each way the file can be unusable has its reason', (t) => {
    const cases = [
        ['a directory in its place', null, 'unreadable'],
        ['not JSON', 'not json', 'malformed'],
        ['a JSON array', '[1]', 'malformed'],
        ['a JSON string', '"x"', 'malformed'],
        ['no fields', {}, 'invalid'],
        ['an empty endpoint', { endpoint: '', model: 'm' }, 'invalid'],
        ['a non-string endpoint', { endpoint: 7, model: 'm' }, 'invalid'],
        ['an endpoint that is not a URL', { endpoint: 'not a url', model: 'm' }, 'invalid'],
        ['an empty model', { endpoint: 'https://api.example.test', model: '' }, 'invalid'],
        ['a missing model', { endpoint: 'https://api.example.test' }, 'invalid']
    ];
    for (const [label, body, reason] of cases) {
        const home = tempHome(t);
        if (body === null) fs.mkdirSync(configFile(home), { recursive: true });
        else writeConfig(home, body);
        const out = client.loadJevConfig();
        assert.equal(out.ok, false, label);
        assert.equal(out.reason, reason, label);
        assert.equal(typeof out.detail, 'string', label);
    }
});

test('an endpoint is accepted only over https or on a loopback host, as written and as parsed', (t) => {
    const cases = [
        ['https://api.example.test', true],
        ['https://10.0.0.1', true],
        ['http://localhost:1', true],
        ['http://LOCALHOST', true],
        ['http://127.0.0.1:8080', true],
        ['http://127.255.0.9', true],
        ['http://[::1]:1', true],
        ['http://api.example.test', false],
        ['http://10.0.0.1', false],
        ['http://192.168.1.5:11434', false],
        ['http://172.16.0.1', false],
        ['http://172.31.255.1', false],
        ['http://127.01.0.1:1', false],
        ['http://0177.0.0.1:1', false],
        ['http://128.0.0.1', false],
        ['http://[::2]', false],
        ['http://[0:0:0:0:0:0:0:1]', true],
        ['http://localhost.example.test', false],
        ['ftp://127.0.0.1', false],
        ['ws://127.0.0.1', false],
        [`http://evil.example.test${BS}@localhost`, false],
        [`http://evil.example.test${BS}:80@127.0.0.1`, false],
        [`http://evil.example.test${BS}@[::1]`, false]
    ];
    for (const [endpoint, accepted] of cases) {
        const home = tempHome(t);
        writeConfig(home, { endpoint, model: 'm' });
        const out = client.loadJevConfig();
        assert.equal(out.ok, accepted, endpoint);
        if (!accepted) assert.equal(out.reason, 'invalid', endpoint);
    }
});

// ------------------------------------------------------------------ the call --

test('a missing, non-number or out-of-range time limit is the one throw, and it carries no key', (t) => {
    const server = { url: 'http://127.0.0.1:1' };
    arm(t, server);
    for (const bad of [undefined, null, '5', NaN, {}, Infinity, -1, 0, 2147483648]) {
        assert.throws(() => client.askJev(STATE, QUESTIONS, bad), TypeError);
        let thrown;
        try { client.askJev(STATE, QUESTIONS, bad); } catch (err) { thrown = err; }
        assertClean({ result: undefined, thrown, written: {} });
    }
});

test('the config is decided first and the key second, so a machine with neither reads not configured', async (t) => {
    const calls = stubFetch(t);
    const home = tempHome(t);

    setEnv(t, 'TYPESAFE_API_KEY', undefined);
    assertRefusal(await call([STATE, QUESTIONS, 1000]), 'not configured');

    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    assertRefusal(await call([STATE, QUESTIONS, 1000]), 'not configured');

    writeConfig(home, { endpoint: 'http://127.0.0.1:1', model: 'm' });
    for (const missing of [undefined, '', '   ']) {
        setEnv(t, 'TYPESAFE_API_KEY', missing);
        assertRefusal(await call([STATE, QUESTIONS, 1000]), 'no key');
    }
    assert.equal(calls.length, 0, 'no socket opens before the config and the key are both there');
});

test('the three non-absent config refusals are config unusable, before any socket opens', async (t) => {
    const calls = stubFetch(t);
    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    for (const body of [null, 'not json', { endpoint: 'http://api.example.test', model: 'm' }]) {
        const home = tempHome(t);
        if (body === null) fs.mkdirSync(configFile(home), { recursive: true });
        else writeConfig(home, body);
        assertRefusal(await call([STATE, QUESTIONS, 1000]), 'config unusable');
    }
    assert.equal(calls.length, 0);
});

test('the success path posts the documented body with the bearer key and reads the answers field by field', async (t) => {
    const server = await startServer(t, () => ({ body: GOOD_BODY }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 5000]);
    assert.equal(made.thrown, undefined);
    assert.deepEqual(made.result, { ok: true, answers: EXPECTED_ANSWERS, inputTokens: 42 });
    assertClean(made);

    assert.equal(server.requests.length, 1);
    const seen = server.requests[0];
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, '/v1/systemone');
    assert.equal(seen.headers.authorization, `Bearer ${PLANTED_KEY}`, 'the key rides only on the wire');
    assert.match(seen.headers['content-type'], /^application\/json/);
    assert.deepEqual(seen.body, { state: STATE, model: 'jev-test', questions: QUESTIONS });
});

test('the key and the config are read at each call, so a change between calls reaches the wire', async (t) => {
    const server = await startServer(t, () => ({ body: GOOD_BODY }));
    const home = arm(t, server);
    await call([STATE, QUESTIONS, 5000]);

    setEnv(t, 'TYPESAFE_API_KEY', 'SECOND-KEY-0b1c2d');
    writeConfig(home, { endpoint: server.url, model: 'jev-other' });
    const made = await call([STATE, QUESTIONS, 5000]);
    assert.equal(made.result.ok, true);
    assert.equal(server.requests[1].headers.authorization, 'Bearer SECOND-KEY-0b1c2d');
    assert.equal(server.requests[1].body.model, 'jev-other');
    assert.deepEqual(keyTraces('SECOND-KEY-0b1c2d', artifactsOf(made)), [], 'the second key reaches no artifact either');
    assertClean(made);
});

test('a body under the cap with a usage block missing reads as answers with zero input tokens', async (t) => {
    const pad = 'x'.repeat(MAX_BODY_BYTES - 200);
    const server = await startServer(t, () => ({ raw: JSON.stringify({ answers: GOOD_BODY.answers, pad }) }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 5000]);
    assert.deepEqual(made.result, { ok: true, answers: EXPECTED_ANSWERS, inputTokens: 0 });
});

test('a noul answer is returned as its validated number alone, without the rest of the vendor object', async (t) => {
    const body = {
        answers: {
            q_a: { type: 'noul', noul: 0.25, note: 'EXTRA-FIELD-9e8f', nested: { noul: 1 } },
            q_b: { type: 'noul', noul: 0.9 }
        },
        usage: { input_tokens: 42 }
    };
    const server = await startServer(t, () => ({ body }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 5000]);
    assert.deepEqual(made.result, { ok: true, answers: EXPECTED_ANSWERS, inputTokens: 42 });
    assert.ok(!JSON.stringify(made.result).includes('EXTRA-FIELD-9e8f'), 'the extra field is not carried');
});

test('usage.input_tokens is read only as a non-negative integer, and anything else reads as 0', async (t) => {
    const cases = [[-1, 0], [1.5, 0], ['7', 0], [null, 0], [NaN, 0], [0, 0], [7, 7]];
    for (const [sent, expected] of cases) {
        const server = await startServer(t, () => ({ raw: JSON.stringify({ answers: GOOD_BODY.answers, usage: { input_tokens: sent } }) }));
        arm(t, server);
        const made = await call([STATE, QUESTIONS, 5000]);
        assert.equal(made.thrown, undefined);
        assert.equal(made.result.ok, true, JSON.stringify(made.result));
        assert.equal(made.result.inputTokens, expected, `input_tokens ${String(sent)}`);
    }
});

test('a 2xx body that is not the answer asked for is unusable answer', async (t) => {
    const noul = (value) => ({ answers: { q_a: { type: 'noul', noul: value }, q_b: GOOD_BODY.answers.q_b } });
    const cases = [
        ['not JSON', { raw: 'not json' }],
        ['a JSON array', { raw: '[]' }],
        ['no answers key', { body: { usage: { input_tokens: 1 } } }],
        ['answers as an array', { body: { answers: [] } }],
        ['answers as null', { body: { answers: null } }],
        ['an asked id absent', { body: { answers: { q_a: GOOD_BODY.answers.q_a } } }],
        ['an answer that is not an object', { body: { answers: { q_a: 0.5, q_b: GOOD_BODY.answers.q_b } } }],
        ['a noul answer with no noul field', { body: { answers: { q_a: { type: 'noul' }, q_b: GOOD_BODY.answers.q_b } } }],
        ['a noul that is a string', { body: noul('0.5') }],
        ['a noul above 1', { body: noul(1.5) }],
        ['a noul below 0', { body: noul(-0.1) }],
        ['a noul that is null', { body: noul(null) }],
        ['a body past the cap', { raw: JSON.stringify({ answers: GOOD_BODY.answers, pad: 'x'.repeat(MAX_BODY_BYTES) }) }],
        ['a 204 with no body', { status: 204 }]
    ];
    for (const [label, answer] of cases) {
        const server = await startServer(t, () => answer);
        arm(t, server);
        const made = await call([STATE, QUESTIONS, 5000, [1]]);
        assertRefusal(made, 'unusable answer');
        assert.equal(server.requests.length, 1, `${label}: no retry`);
    }
});

test('every non-2xx that earns no retry is refused, 401 and 422 included, and is never retried', async (t) => {
    for (const status of [401, 422, 404, 500, 503]) {
        const server = await startServer(t, () => ({ status, body: { error: 'no' } }));
        arm(t, server);
        assertRefusal(await call([STATE, QUESTIONS, 5000, [1, 1]]), 'refused');
        assert.equal(server.requests.length, 1, `${status}: one request`);
    }
});

test('a redirect is not followed', async (t) => {
    for (const status of [301, 302, 307, 308]) {
        const server = await startServer(t, (body, req) => (req.url === '/v1/systemone'
            ? { status, headers: { location: '/moved' }, body: {} }
            : { body: GOOD_BODY }));
        arm(t, server);
        assertRefusal(await call([STATE, QUESTIONS, 5000, [1]]), 'refused');
        assert.deepEqual(server.requests.map((r) => r.url), ['/v1/systemone'], `${status}: nothing reached the location`);
    }
});

test('429 and 529 are retried only as many times as the caller asked, then busy', async (t) => {
    const cases = [
        [429, undefined, 1],
        [529, [], 1],
        [429, [1], 2],
        [529, [1, 1], 3]
    ];
    for (const [status, delays, requests] of cases) {
        const server = await startServer(t, () => ({ status, body: { error: 'later' } }));
        arm(t, server);
        assertRefusal(await call([STATE, QUESTIONS, 5000, delays]), 'busy');
        assert.equal(server.requests.length, requests, `${status} with ${JSON.stringify(delays)}`);
    }
});

test('a retry that answers 2xx is the answer, and the listed delays are slept in order', async (t) => {
    const server = await startServer(t, (body, req, count) => (count < 3 ? { status: count === 1 ? 429 : 529, body: {} } : { body: GOOD_BODY }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 5000, [20, 30, 500]]);
    assert.equal(made.thrown, undefined);
    assert.deepEqual(made.result, { ok: true, answers: EXPECTED_ANSWERS, inputTokens: 42 });
    assert.equal(server.requests.length, 3, 'two retries used, the third never needed');
    // The bound sits under the 50 ms sum, since a timer may fire a millisecond
    // early and the clock is read outside the sleeps.
    assert.ok(made.elapsedMs >= 40, `both delays were slept: ${made.elapsedMs}ms`);
    assertClean(made);
});

test('one deadline over the whole call: a retry whose delay would pass it is not started', async (t) => {
    const server = await startServer(t, () => ({ status: 429, body: {} }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 300, [1000]]);
    assertRefusal(made, 'busy');
    assert.equal(server.requests.length, 1, 'exactly one request reached the server');
    assert.ok(made.elapsedMs < 1000, `the delay was not slept: ${made.elapsedMs}ms`);
});

test('the deadline passing with a request in flight is timeout, and a timeout is not retried', async (t) => {
    const server = await startServer(t, () => ({ hold: true }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 100, [1]]);
    assertRefusal(made, 'timeout');
    assert.equal(server.requests.length, 1);
});

test('a connection that drops while the 2xx body is being read is unreachable, not unusable answer', async (t) => {
    const server = await startServer(t, () => ({ cut: true }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 5000, [1]]);
    assertRefusal(made, 'unreachable');
    assert.equal(server.requests.length, 1, 'no retry');
});

test('a connection that never carries the request is unreachable', async (t) => {
    // A port a server just released and nothing listens on.
    const gone = await new Promise((resolve) => {
        const s = http.createServer();
        s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    });
    const home = tempHome(t);
    writeConfig(home, { endpoint: `http://127.0.0.1:${gone}`, model: 'm' });
    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    assertRefusal(await call([STATE, QUESTIONS, 5000, [1]]), 'unreachable');
});

test('a malformed endpoint the URL parser accepts makes the runtime spell the request out, and none of it reaches the refusal', async (t) => {
    // Credentials in the URL pass the config read (loopback, parses) and make
    // fetch throw a TypeError whose message carries the whole URL. The refusal
    // carries neither the planted key nor the URL's own secret.
    const server = await startServer(t, () => ({ body: GOOD_BODY }));
    const home = tempHome(t);
    writeConfig(home, { endpoint: `http://user:URL-SECRET-4d2e@127.0.0.1:${server.port}`, model: 'm' });
    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    const made = await call([STATE, QUESTIONS, 5000]);
    assertRefusal(made, 'unreachable');
    assert.equal(server.requests.length, 0);
    assert.deepEqual(keyTraces('URL-SECRET-4d2e', artifactsOf(made)), []);
});

test('cleartext both ways: a public name and a private-range address open no socket, and loopback does', async (t) => {
    const calls = stubFetch(t);
    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    for (const endpoint of ['http://api.example.test', 'http://192.168.1.5:11434', 'http://10.1.2.3', 'http://172.16.0.1', 'http://127.01.0.1',
        `http://evil.example.test${BS}@localhost`, `http://evil.example.test${BS}:80@127.0.0.1`]) {
        const home = tempHome(t);
        writeConfig(home, { endpoint, model: 'm' });
        assertRefusal(await call([STATE, QUESTIONS, 1000]), 'config unusable');
    }
    assert.equal(calls.length, 0, 'no fetch call for any cleartext endpoint');

    // The stub's own control: a loopback endpoint under the same stub reaches
    // fetch, so the zero above is a count the stub could have moved.
    const home = tempHome(t);
    writeConfig(home, { endpoint: 'http://127.0.0.1:1', model: 'm' });
    assertRefusal(await call([STATE, QUESTIONS, 1000]), 'unreachable');
    assert.equal(calls.length, 1, 'the loopback endpoint reached fetch');
});

test('a loopback endpoint over http reaches the stand-in server', async (t) => {
    const server = await startServer(t, () => ({ body: GOOD_BODY }));
    arm(t, server);
    const made = await call([STATE, QUESTIONS, 5000]);
    assert.equal(made.result.ok, true, JSON.stringify(made.result));
    assert.equal(server.requests.length, 1, 'the server saw the request');
});

test('the sweep speaks: an artifact carrying the planted key, whole or in part, is named', () => {
    const made = {
        result: { ok: false, reason: 'refused', detail: `key ${PLANTED_KEY}` },
        thrown: new Error(`spelled ${PLANTED_KEY.slice(3, 11)} back`),
        written: { 'console.log': '', 'console.error': '', 'stdout.write': '', 'stderr.write': PLANTED_KEY }
    };
    const named = keyTraces(PLANTED_KEY, artifactsOf(made)).map((hit) => hit.split(' ')[0]);
    assert.deepEqual([...new Set(named)].sort(), ['inspected', 'returned', 'stderr.write', 'thrown']);

    // An Error carried inside the result renders as `{}` in JSON, so only the
    // inspected rendering can name it.
    const hidden = { result: { ok: false, reason: 'refused', detail: new Error(`url ${PLANTED_KEY}`) }, thrown: undefined, written: {} };
    const hiddenNamed = keyTraces(PLANTED_KEY, artifactsOf(hidden)).map((hit) => hit.split(' ')[0]);
    assert.deepEqual([...new Set(hiddenNamed)], ['inspected']);
});

test('a call that asked no question is unusable answer before any socket opens, never an empty success', async (t) => {
    const calls = stubFetch(t);
    const home = tempHome(t);
    writeConfig(home, { endpoint: 'http://127.0.0.1:1', model: 'm' });
    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    for (const questions of [{}, null, ['q1']]) {
        const made = await call([STATE, questions, 5000]);
        assertRefusal(made, 'unusable answer');
    }
    assert.equal(calls.length, 0, 'no fetch call for an empty, null or array question set');
});

// ---------------------------------------------------------------- the screen --

// The credential shapes the client screens a body for, one row per class:
// its name for the assertion messages, two or more instances built to the
// shape's rule, and the near-misses built just under the rule's bound. Each
// instance is at least eight characters, so a detail that quoted any part of
// it would be named by `keyTraces`. The near-misses are shaped from the rule,
// not cut from the instances: one token character short, a lower-case letter
// in the literal, a hyphen for the underscore, a seven-character literal, the
// key variable named but not assigned, and a letter or digit directly before
// `sk-`, which makes a longer word (`risk-`) and not the shape. A literal
// with an escaped pair or an apostrophe inside it is an instance, since the
// pair is one unit of the literal and the apostrophe is a character of a
// double-quoted one.
const SHAPES = [
    ['the key variable assigned', [
        'TYPESAFE_API_KEY=PLANTEDKEY0', 'export TYPESAFE_API_KEY="PLANTEDKEY1"', "TYPESAFE_API_KEY: 'PLANTEDKEY2'", '"TYPESAFE_API_KEY": "PLANTEDKEY3"'
    ], [
        'TYPESAFE_API_KEY', 'export TYPESAFE_API_KEY=1', 'TYPESAFE_API_KEY="abcdefg"', "TYPESAFE_API_KEY: 'abcdefg'",
        'Typesafe_api_key=PLANTEDKEY', 'stood down because TYPESAFE_API_KEY is not set in this process',
        'TYPESAFE_API_KEY===undefined'
    ]],
    ['a bearer token', ['Bearer ' + 'A'.repeat(16), 'Bearer zyx.9_8~7+6/5=4-3Q'], ['Bearer ' + 'A'.repeat(15)]],
    ['an sk- key', ['sk-' + 'b'.repeat(20), 'sk-' + 'Qq0-_'.repeat(4), '"sk-' + 'd'.repeat(20) + '"'],
        ['sk-' + 'b'.repeat(19), 'risk-assessment-report-2026', 'disk-encryption-enabled-flag']],
    // Each prefix with twenty or more token characters. The near-misses are
    // each prefix with nineteen, and a hyphen in place of a prefix underscore.
    ['a GitHub token', ['ghp_' + 'PLANTED0'.repeat(3), 'gho_' + 'PLANTED1'.repeat(3), 'github_pat_' + 'PLANTED2'.repeat(2) + '_' + 'PLANTED3'],
        ['ghp_' + 'P'.repeat(19), 'gho_' + 'Q'.repeat(19), 'github_pat_' + 'R'.repeat(19), 'ghp-' + 'S'.repeat(20), 'github-pat_' + 'T'.repeat(20)]],
    ['a Slack token', ['xoxb-1234-PLANTED', 'xoxp-PLANTED-5678', 'xoxa-PLANTED1', 'xoxr-PLANTED2', 'xoxs-PLANTED3'], ['xoxz-1234-PLANTED', 'xoxb_1234-PLANTED']],
    ['an AWS access key id', ['AKIAABCDEFGHIJKLMNOP', 'AKIA0123456789ABCDEF'], ['AKIAABCDEFGHIJKLMNO', 'AKIAabcdefghijklmnop']],
    ['a private key block', ['-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN OPENSSH PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----'], ['-----BEGIN CERTIFICATE-----', '-----BEGIN RSA PUBLIC KEY-----']],
    // The name in any case behind the left boundary, or capitalized directly
    // after a lower-case letter as camelCase writes it, assigned a literal in
    // double quotes, single quotes or backticks. The near-misses are a
    // seven-unit literal in each quote, an unquoted or computed right-hand
    // side, a lower-case continuation of the name (`tokens`, `passwordHash`,
    // `secret_keys`, `secretKeys`), and an upper-case continuation (`myTOKEN`),
    // which is neither form.
    ['a credential assignment', [
        'password = "hunter22!"', "passwd: 'abcdefgh'", 'SECRET="PLANTED-SECRET"', "api_key = 'PLANTEDKEY1'",
        'ApiKey: "PLANTEDKEY2"', 'token = "PLANTEDTOKEN"', 'db_password = "PLANTEDPASS"', 'db-password = "PLANTEDPASS2"',
        '"token": "PLANTEDTOKEN9"', 'password = "abc\tdefghij"', 'password = "abc\\tdefghij"', 'password = "it\'s-a-secret"',
        "clientSecret = 'PLANTED-SECRET2'", 'accessToken = "PLANTEDTOKEN4"', "dbPassword = 'PLANTEDPASS5'",
        'apiToken: "PLANTEDTOKEN3"', 'nextToken = "identifier"', 'csrfToken: "x-csrf-token"', '"accessToken": "PLANTEDTOKEN6"',
        'token = `PLANTEDTOKEN7`', 'SECRET_KEY = "PLANTED-SECRET3"', "secretKey = 'PLANTED-SECRET4'"
    ], [
        'password = "abcdefg"', 'password = abcdefghij', 'tokens = "PLANTEDTOKEN"', 'password_hash = "PLANTEDHASH"',
        'accessToken = getToken();', "clientSecret = 'short'", 'passwordHash = "PLANTEDHASH2"', 'myTOKEN = "PLANTEDTOKEN5"',
        'secret = `short`', 'secret_keys = "PLANTEDSECRET5"', "secretKeys = 'PLANTED-SECRET6'"
    ]],
    // A connection string's password field: the name `Password`, then `=`,
    // then a value of eight or more characters with no `;`, whitespace, quote
    // or backslash, in any case and behind the same left boundary. The
    // near-misses are an empty value, a
    // seven-character value, a letter directly before the name, a comparison
    // and a quoted value, and a value cut short by a space, a quote or a `)`
    // and the space after it.
    ['a connection-string password', ['Server=x;User Id=sa;Password=Hunter22222;', 'PASSWORD=abcdefghij'],
        ['Password=;', 'Password=short7;', 'dbPassword=PLANTEDPASS4;', 'if (password==null) return;', "password='ab'",
            'password=abc defghij', 'password=abc"defghij"', 'set(password=abcd) and go on']]
];

function planted(text) {
    return { spec: `the section text, then ${text}, then more text` };
}

test('every credential shape in a body is screened, with a fixed detail per class that never carries the match', async (t) => {
    const server = await startServer(t, () => ({ body: GOOD_BODY }));
    arm(t, server);
    const details = new Map();
    for (const [label, instances] of SHAPES) {
        const seen = new Set();
        for (let i = 0; i < instances.length; i += 1) {
            const made = await call([planted(instances[i]), QUESTIONS, 5000]);
            assertRefusal(made, 'screened');
            assert.equal(server.requests.length, 0, `${label} ${i}: no socket opened`);
            assert.deepEqual(keyTraces(instances[i], artifactsOf(made)), [], `${label} ${i}: no part of the match reaches an artifact`);
            assert.ok(typeof made.result.detail === 'string' && made.result.detail !== '', `${label} ${i}: the detail names a class`);
            seen.add(made.result.detail);
        }
        assert.equal(seen.size, 1, `${label}: one detail across its instances, so it is the class and not the match`);
        details.set(label, [...seen][0]);
    }
    assert.equal(new Set(details.values()).size, SHAPES.length, 'each class has its own detail');

    // The withheld controls: the same key, server and question set, with a
    // body just under each shape's bound, reach the server. The screen is what
    // refused the instances above, since nothing else differs.
    let reached = 0;
    for (const [label, , nearMisses] of SHAPES) {
        for (let i = 0; i < nearMisses.length; i += 1) {
            const made = await call([planted(nearMisses[i]), QUESTIONS, 5000]);
            assert.equal(made.result.ok, true, `${label} near-miss ${i}: ${JSON.stringify(made.result)}`);
            reached += 1;
            assert.equal(server.requests.length, reached, `${label} near-miss ${i}: reached the server`);
        }
    }
});

test('the screen runs on the whole body, before the key is read, so a screened body never reads the key', async (t) => {
    const calls = stubFetch(t);
    const home = tempHome(t);
    writeConfig(home, { endpoint: 'http://127.0.0.1:1', model: 'm' });

    // A shape inside a question is screened as one inside the state is.
    setEnv(t, 'TYPESAFE_API_KEY', PLANTED_KEY);
    const inQuestion = { q_a: { ...QUESTIONS.q_a, instructions: 'Is sk-' + 'c'.repeat(20) + ' a key?' } };
    assertRefusal(await call([STATE, inQuestion, 1000]), 'screened');

    // With no key in the environment the refusal is still the screen's, not
    // `no key`, which is the order: config, question, body, screen, key.
    setEnv(t, 'TYPESAFE_API_KEY', undefined);
    assertRefusal(await call([planted('AKIAABCDEFGHIJKLMNOP'), QUESTIONS, 1000]), 'screened');
    assertRefusal(await call([STATE, QUESTIONS, 1000]), 'no key');
    assert.equal(calls.length, 0, 'no fetch call for a screened body or a missing key');
});

// The kit's own Jev scripts name the key variable and spell the shape list
// out, so a shape that matched its own prefix or name alone would refuse the
// scripts the promises check exists to read. They are gathered as that check
// gathers them, comments stripped, and sent as its state.
test('the kit\'s own Jev scripts, gathered as the promises check sends them, reach the server unscreened', async (t) => {
    const scriptsDir = path.join(__dirname, '..', 'plugins', 'grimoire', 'scripts');
    const gathered = gatherCode(['jev-client.js', 'jev-gather.js', 'jev-judge.js'].map((name) => path.join(scriptsDir, name)));
    assert.equal(gathered.ok, true, JSON.stringify(gathered));
    assert.equal(gathered.files, 3);

    const server = await startServer(t, () => ({ body: GOOD_BODY }));
    arm(t, server);
    const made = await call([{ code: gathered.code }, QUESTIONS, 5000]);
    assert.equal(made.thrown, undefined);
    assert.equal(made.result.ok, true, JSON.stringify(made.result));
    assert.equal(server.requests.length, 1, 'the gathered scripts reached the server');
    assertClean(made);
});

test('the env fixture restores a name set twice in one test to its original value', async (t) => {
    const present = 'KIT_JEV_TEST_PRESENT';
    const absent = 'KIT_JEV_TEST_ABSENT';
    process.env[present] = 'original';
    delete process.env[absent];
    t.after(() => { delete process.env[present]; delete process.env[absent]; });
    await t.test('sets each twice', (st) => {
        setEnv(st, present, 'first');
        setEnv(st, present, 'second');
        setEnv(st, absent, 'first');
        setEnv(st, absent, 'second');
        assert.equal(process.env[present], 'second');
        assert.equal(process.env[absent], 'second');
    });
    assert.equal(process.env[present], 'original');
    assert.equal(Object.hasOwn(process.env, absent), false);
});
