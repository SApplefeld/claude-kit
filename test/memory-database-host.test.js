// Tests for the memory database host probe,
// plugins/claude-kit/db/Test-MemoryDatabaseHost.ps1.
//
// Node's built-in test runner, no framework, no install (Node v24). The probe
// is PowerShell 7 (its -SkipHttpErrorCheck is how it reads the embedding
// server's refusal), so every case spawns pwsh and is skipped where pwsh is
// not on this machine.
//
// NOTHING HERE REACHES THE REAL HOST unless KIT_MEMORY_DB_LIVE=1 is set. Every
// ordinary case writes its own config into a temp directory, pointing both the
// SQL server and the embedding server at loopback ports this file controls, so
// the whole-suite gate touches no network beyond 127.0.0.1. Presence of the
// operator's real config never enables the live case: the environment variable
// is the only switch.
//
// NO CASE NEEDS SQL SERVER'S CLIENT TOOLS INSTALLED. Every case that wants the
// probe to get past its sqlcmd resolution plants a stub sqlcmd on PATH and
// redirects ProgramFiles to an empty directory, so the probe's pinned-path
// lookup misses and the fallback finds the stub. That keeps the ordinary lane
// green on a machine with no ODBC tools, and it is also what lets one case
// read the argument list the probe actually spawned.
//
// No case contains a credential. The password field in every fixture config is
// a sentinel this file generates.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('node:net');
const http = require('node:http');

const REPO = path.join(__dirname, '..');
const PROBE = path.join(REPO, 'plugins', 'claude-kit', 'db', 'Test-MemoryDatabaseHost.ps1');
const LIVE = process.env.KIT_MEMORY_DB_LIVE === '1';

// The line shape the doctor's memory-database step parses: a status, two
// spaces, the check number, the check name, and the measured value. Held here
// as one regex so a case that drifts from it fails rather than silently
// matching a looser shape.
const LINE = /^(PASS|FAIL|INFO)  (\d+)\. ([^:]+): (.+)$/;

const havePwsh = (() => {
    if (process.platform !== 'win32') return false;
    const res = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0'], { encoding: 'utf8' });
    return res.status === 0;
})();

// The child's environment, with the caller's overrides genuinely replacing
// what this process holds. Spreading process.env and adding a key is not
// enough on Windows: environment names are case-insensitive to the operating
// system but not to a JavaScript object, and this process carries PROGRAMFILES
// in upper case, so adding ProgramFiles beside it leaves two entries and the
// child reads the original one.
function childEnv(overrides) {
    const env = { ...process.env };
    for (const [key, value] of Object.entries(overrides || {})) {
        for (const existing of Object.keys(env)) {
            if (existing.toLowerCase() === key.toLowerCase()) delete env[existing];
        }
        env[key] = value;
    }
    return env;
}

function runProbe(args, overrides) {
    return spawnSync('pwsh',
        ['-NoProfile', '-File', PROBE].concat(args || []),
        { encoding: 'utf8', env: childEnv(overrides) });
}

// The same run, without blocking this process while it happens. A case whose
// fixture is an HTTP server running here cannot use the synchronous form at
// all: spawnSync holds the event loop, so the server never accepts, and the
// probe times out against a fixture that was listening the whole time.
function runProbeAsync(args, overrides) {
    return new Promise((resolve) => {
        const child = spawn('pwsh',
            ['-NoProfile', '-File', PROBE].concat(args || []),
            { env: childEnv(overrides) });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('close', (status) => resolve({ status, stdout, stderr }));
    });
}

function makeRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'memdbhost-'));
}

function rmDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // Best-effort cleanup; a temp directory left behind never fails a test.
    }
}

// A config in the shape the plan fixes, with the caller's overrides applied and
// any key set to undefined removed, which is how a case builds the
// half-configured file the probe must refuse.
function writeConfig(dir, overrides) {
    const config = Object.assign({
        server: '127.0.0.1,1',
        database: 'KitMemoryProbeTest',
        login: 'kit_probe_test',
        password: 'sentinel-not-a-credential-' + Math.random().toString(36).slice(2),
        embedding: { url: 'http://127.0.0.1:1/', model: 'BAAI/bge-m3' },
        timeoutMs: 2000
    }, overrides || {});
    for (const key of Object.keys(config)) {
        if (config[key] === undefined) delete config[key];
    }
    const file = path.join(dir, 'kit-memory-db.json');
    fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
    return { file, config };
}

// A stub sqlcmd on PATH, plus the environment that makes the probe find it.
//
// Two halves. PATH gets the stub's directory first, and ProgramFiles is
// redirected to an empty directory so the probe's pinned client path does not
// resolve and its PATH fallback runs. The stub logs the argument list it was
// handed and whether SQLCMDPASSWORD was set in its environment, which is how a
// case checks where the secret travelled rather than only what got printed.
//
// Three modes. 'refuse' answers a batch at once with a non-zero exit; 'slow'
// waits about four seconds first, standing in for a host that drops packets
// rather than refusing them; 'answer' returns every tagged value the three SQL
// checks look for, which is how a case reaches check 2 and check 3 with no
// server anywhere. Every mode answers a version query instantly, since the
// probe asks for one at check 6 and a stub that slept there would confuse the
// timing a case is measuring.
function plantSqlcmdStub(root, mode) {
    const stubDir = path.join(root, 'stub-bin');
    const emptyProgramFiles = path.join(root, 'empty-program-files');
    fs.mkdirSync(stubDir, { recursive: true });
    fs.mkdirSync(emptyProgramFiles, { recursive: true });
    const logPath = path.join(root, 'sqlcmd-stub.log');
    const wait = mode === 'slow' ? 'ping -n 5 127.0.0.1 >nul\r\n' : '';
    // Every tag any of the three SQL checks reads, in one canned answer: each
    // check picks its own by prefix and ignores the rest, so one reply serves
    // all three batches.
    const answer = mode === 'answer'
        ? [
            'echo kitprobe-encrypt=TRUE',
            'echo kitprobe-version=17.0.1000.7',
            'echo kitprobe-fulltext=1',
            'echo kitprobe-database=absent',
            'echo kitprobe-distance=0',
            'exit /b 0'
        ].join('\r\n')
        : ['echo Stub sqlcmd: no connection was made.', 'exit /b 1'].join('\r\n');
    const stub = [
        '@echo off',
        'if "%1"=="-?" (echo Microsoft ^(R^) SQL Server Command Line Tool& echo Version 99.9.9.9 NT& exit /b 0)',
        'if "%1"=="--version" (echo 99.9.9.9& exit /b 0)',
        'if not "%KIT_SQLCMD_STUB_LOG%"=="" (',
        '  >>"%KIT_SQLCMD_STUB_LOG%" echo ARGV %*',
        '  if defined SQLCMDPASSWORD (>>"%KIT_SQLCMD_STUB_LOG%" echo SQLCMDPASSWORD=set) else (>>"%KIT_SQLCMD_STUB_LOG%" echo SQLCMDPASSWORD=unset)',
        '  for %%A in (%*) do if /I "%%~xA"==".sql" (>>"%KIT_SQLCMD_STUB_LOG%" echo BATCH-START& type "%%~A" >>"%KIT_SQLCMD_STUB_LOG%"& >>"%KIT_SQLCMD_STUB_LOG%" echo BATCH-END)',
        ')',
        wait + answer,
        ''
    ].join('\r\n');
    fs.writeFileSync(path.join(stubDir, 'sqlcmd.cmd'), stub, 'utf8');
    return {
        logPath,
        readLog: () => (fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''),
        env: {
            Path: stubDir + ';' + (process.env.Path || ''),
            // Both, and in this order for a reason. Where PowerShell 7 is
            // installed as a Windows app package, launching it activates that
            // package, and the activation re-establishes ProgramFiles from
            // ProgramW6432 after the parent's environment is applied. Setting
            // ProgramFiles alone is silently undone; setting ProgramW6432
            // carries both.
            ProgramW6432: emptyProgramFiles,
            ProgramFiles: emptyProgramFiles,
            KIT_SQLCMD_STUB_LOG: logPath
        }
    };
}

// A port nothing listens on: bound, read, and closed again, so a connection to
// it is refused rather than left hanging.
function closedPort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
    });
}

// A listener that counts the connections it accepts and answers nothing. It
// stands in for the two hosts the probe would reach, so a case can prove the
// probe reached neither.
function countingListener() {
    return new Promise((resolve, reject) => {
        let connections = 0;
        const server = net.createServer((socket) => {
            connections += 1;
            socket.destroy();
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            resolve({
                port: server.address().port,
                count: () => connections,
                close: () => new Promise((done) => server.close(done))
            });
        });
    });
}

// A listener that accepts a connection and then says nothing at all, ever: the
// black-holed host, which is the shape that makes per-check timeouts add up.
// A refused connection cannot exercise a timeout, so a case about budget needs
// this and not a closed port.
function blackHoleListener() {
    return new Promise((resolve, reject) => {
        const sockets = [];
        const server = net.createServer((socket) => {
            sockets.push(socket);
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            resolve({
                port: server.address().port,
                close: () => new Promise((done) => {
                    for (const socket of sockets) socket.destroy();
                    server.close(done);
                })
            });
        });
    });
}

// An embedding server in the dialect the probe speaks, whose answer to an
// oversized input the caller chooses. That answer is the whole point: check 5
// may pass only on a refusal that names a size ceiling, and every other non-2xx
// is a server that broke rather than one that said no.
function fakeEmbedder(options) {
    const opts = Object.assign({
        model: 'BAAI/bge-m3',
        dimensions: 1024,
        oversizeChars: 8000,
        oversizeStatus: 500,
        oversizeBody: JSON.stringify({
            error: {
                code: 500,
                message: 'input (3926 tokens) is too large to process. increase the physical batch size (current batch size: 2048)',
                type: 'server_error'
            }
        })
    }, options || {});
    const vector = Array.from({ length: opts.dimensions }, (_, i) => Number(((i % 97) / 1000).toFixed(6)));
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            res.setHeader('Server', 'llama.cpp');
            if (req.method === 'GET' && req.url === '/v1/models') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ data: [{ id: opts.model, object: 'model' }] }));
                return;
            }
            if (req.method === 'POST' && req.url === '/v1/embeddings') {
                let raw = '';
                req.on('data', (chunk) => { raw += chunk; });
                req.on('end', () => {
                    let input = '';
                    try { input = String(JSON.parse(raw).input || ''); } catch { input = ''; }
                    if (input.length > opts.oversizeChars) {
                        res.writeHead(opts.oversizeStatus, { 'Content-Type': 'application/json' });
                        res.end(opts.oversizeBody);
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ data: [{ embedding: vector, index: 0 }] }));
                });
                return;
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end('{"error":"not found"}');
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            resolve({
                url: 'http://127.0.0.1:' + server.address().port + '/',
                close: () => new Promise((done) => server.close(done))
            });
        });
    });
}

// The instrument, checked before any reading of it is believed: a stub case
// that silently ran a real sqlcmd would still produce plausible output, and
// every assertion built on the stub's log or timing would be about something
// this file never controlled.
function assertStubRan(res, stub) {
    const six = lineFor(checkLines(res.stdout), 6) || '';
    assert.match(six, /^PASS  6\. sqlcmd: .*stub-bin\\sqlcmd\.cmd/,
        'the run resolved a sqlcmd this case did not plant:\n' + res.stdout + res.stderr);
    assert.ok(stub.readLog().includes('ARGV '), 'the stub was never spawned:\n' + res.stdout + res.stderr);
}

function checkLines(stdout) {
    return stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
}

function lineFor(lines, number) {
    return lines.find((l) => new RegExp('^\\S+  ' + number + '\\. ').test(l));
}

test('a config missing a required field fails before any network call', { skip: !havePwsh }, async () => {
    const root = makeRoot();
    const sql = await countingListener();
    const embedder = await countingListener();
    try {
        // Both endpoints point at live listeners, so a probe that ran any check
        // at all would show up as an accepted connection. The only defect in
        // the config is the absent database name.
        const { file } = writeConfig(root, {
            server: '127.0.0.1,' + sql.port,
            database: undefined,
            embedding: { url: 'http://127.0.0.1:' + embedder.port + '/', model: 'BAAI/bge-m3' }
        });
        const res = await runProbeAsync(['-ConfigPath', file]);
        assert.notStrictEqual(res.status, 0, 'a half-configured machine must never exit 0:\n' + res.stdout + res.stderr);
        const lines = checkLines(res.stdout);
        assert.strictEqual(lines.length, 1, 'the config failure is the whole report:\n' + res.stdout);
        assert.match(lines[0], /^FAIL  0\. Client config: .*is missing database$/, lines[0]);
        assert.strictEqual(sql.count(), 0, 'the probe reached the SQL port despite an unusable config');
        assert.strictEqual(embedder.count(), 0, 'the probe reached the embedding port despite an unusable config');
    } finally {
        await sql.close();
        await embedder.close();
        rmDir(root);
    }
});

test('a config with no embedding model fails the same way, before any network call', { skip: !havePwsh }, async () => {
    const root = makeRoot();
    const embedder = await countingListener();
    try {
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedder.port + '/' }
        });
        const res = await runProbeAsync(['-ConfigPath', file]);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /FAIL  0\. Client config: .*is missing embedding\.model/, res.stdout);
        assert.strictEqual(embedder.count(), 0, 'the probe reached the embedding port despite an unusable config');
    } finally {
        await embedder.close();
        rmDir(root);
    }
});

test('a database name that is not a plain identifier never reaches the batch', { skip: !havePwsh }, async () => {
    // The name is the one value interpolated into T-SQL, so it is screened at
    // the config read. A name that fails the screen costs only the check that
    // reads it: the rest of the run goes ahead, which is why this is an INFO
    // line and not a refusal of the whole config.
    //
    // Proven on the batch itself rather than on the report: the stub writes
    // every .sql file it is handed into its log, so this reads the exact T-SQL
    // the probe composed.
    // Both halves run against the answering stub, because check 2 is where the
    // name would be interpolated and check 2 runs only after check 1 connects.
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root, 'answer');
        const { file } = writeConfig(root, {
            database: "Kit'; DROP DATABASE master; --"
        });
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        assertStubRan(res, stub);
        assert.match(res.stdout, /INFO  0\. Client config: database is not a plain identifier/, res.stdout);
        assert.match(lineFor(checkLines(res.stdout), 1) || '', /^PASS  1\. Connection: /, res.stdout);
        assert.match(lineFor(checkLines(res.stdout), 2) || '', /^PASS  2\. Server: /,
            'a name check 2 will not look up must not cost check 2 its other two readings:\n' + res.stdout);
        assert.ok(checkLines(res.stdout).some((l) => /^INFO  2\. Database: .*was not looked up/.test(l)), res.stdout);

        const log = stub.readLog();
        assert.ok(log.includes('BATCH-START'), 'the stub logged no batch, so this case reads nothing:\n' + log);
        assert.ok(!log.includes('DROP DATABASE'),
            'the refused name was interpolated into the batch after all:\n' + log);
        // The control: a name that passes the screen does reach the batch, so
        // the absence above is the screen working and not the batch dump
        // missing its content.
        const okRoot = makeRoot();
        try {
            const okStub = plantSqlcmdStub(okRoot, 'answer');
            const ok = writeConfig(okRoot, { database: 'KitMemoryProbeTest' });
            const okRes = await runProbeAsync(['-ConfigPath', ok.file], okStub.env);
            assertStubRan(okRes, okStub);
            assert.ok(okStub.readLog().includes("DB_ID(N'KitMemoryProbeTest')"),
                'a legal name must reach the batch, or the case above proves nothing:\n' + okStub.readLog());
        } finally {
            rmDir(okRoot);
        }
    } finally {
        rmDir(root);
    }
});

test('the connection counter speaks when a connection is actually made', { skip: !havePwsh }, async () => {
    // The withheld control for the three cases above. Same listener, same
    // predicate, an instance that does hold the thing: the embedding endpoint
    // is a config the probe accepts, so check 4 connects and the counter must
    // read non-zero. A counter read before the event loop could dispatch would
    // read zero here too, which is exactly the silent instrument this catches.
    const root = makeRoot();
    const embedder = await countingListener();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedder.port + '/', model: 'BAAI/bge-m3' },
            timeoutMs: 2000
        });
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        assertStubRan(res, stub);
        assert.ok(embedder.count() >= 1,
            'the probe reached a valid embedding endpoint and the counter still read zero:\n' + res.stdout);
    } finally {
        await embedder.close();
        rmDir(root);
    }
});

test('an absent config file names the path and exits non-zero', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const missing = path.join(root, 'no-such-config.json');
        const res = runProbe(['-ConfigPath', missing]);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /FAIL  0\. Client config: no file at /, res.stdout);
        assert.ok(res.stdout.includes('no-such-config.json'), 'the report names the path it looked at:\n' + res.stdout);
    } finally {
        rmDir(root);
    }
});

test('a boundary call against a host that never answers is bounded by the remaining budget', { skip: !havePwsh }, async () => {
    // Acceptance (c)'s bound, and the only case that reaches a socket which
    // accepts and then says nothing, which is the shape a closed port cannot
    // produce. sqlcmd fails at once here, so the whole budget is still on the
    // table when check 4 opens that socket: the run's length is that one
    // boundary call waiting out its share, and the ceiling below is the
    // configured timeout plus the process startup and the local check 6,
    // neither of which involves the host.
    const root = makeRoot();
    const blackHole = await blackHoleListener();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + blackHole.port + '/', model: 'BAAI/bge-m3' },
            timeoutMs: 3000
        });
        const started = Date.now();
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        const elapsed = Date.now() - started;
        assertStubRan(res, stub);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);

        assert.match(lineFor(checkLines(res.stdout), 4) || '',
            /^FAIL  4\. Embedder: GET \/v1\/models did not answer: /,
            'the socket was opened and never answered, so this must be a timeout:\n' + res.stdout);
        assert.ok(elapsed >= 2000,
            'the run took ' + elapsed + ' ms, too fast to have waited on a host that never answers');
        assert.ok(elapsed < 5500,
            'the run took ' + elapsed + ' ms against a 3000 ms budget, so the call outlasted its share');
    } finally {
        await blackHole.close();
        rmDir(root);
    }
});

test('a sqlcmd that cannot connect fails check 1 and leaves the report untruncated', { skip: !havePwsh }, async () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const embedderPort = await closedPort();
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedderPort + '/', model: 'BAAI/bge-m3' }
        });
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        assertStubRan(res, stub);
        assert.notStrictEqual(res.status, 0, 'an unreachable host must exit non-zero:\n' + res.stdout + res.stderr);

        const lines = checkLines(res.stdout);
        assert.match(lineFor(lines, 1) || '', /^FAIL  1\. Connection: sqlcmd exit 1: /, res.stdout);

        // A failure never truncates the report: the checks that cannot run say
        // so, and the local one still reports.
        assert.match(lineFor(lines, 2) || '', /^FAIL  2\. Server: not read/, res.stdout);
        assert.match(lineFor(lines, 3) || '', /^FAIL  3\. Vector: not read/, res.stdout);
        assert.match(lineFor(lines, 4) || '', /^FAIL  4\. Embedder: /, res.stdout);
        assert.match(lineFor(lines, 5) || '', /^FAIL  5\. Latency: not measured/,
            'check 5 must not spend its twenty-one calls on an endpoint check 4 already found dead:\n' + res.stdout);
        assert.match(lineFor(lines, 6) || '', /^PASS  6\. sqlcmd: /,
            'the local sqlcmd check is independent of the host and still reports:\n' + res.stdout);
    } finally {
        rmDir(root);
    }
});

test('the run is bounded by one shared budget, not one budget per check', { skip: !havePwsh }, async () => {
    // Two boundaries that both hang: a sqlcmd that never answers inside the
    // budget, and an embedding endpoint that accepts the connection and then
    // says nothing. With one deadline across the checks the run costs about one
    // timeout; with a timeout per check it costs two, which is what the upper
    // bound below catches.
    const root = makeRoot();
    const blackHole = await blackHoleListener();
    try {
        const stub = plantSqlcmdStub(root, 'slow');
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + blackHole.port + '/', model: 'BAAI/bge-m3' },
            timeoutMs: 4000
        });
        const started = Date.now();
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        const elapsed = Date.now() - started;
        assertStubRan(res, stub);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);

        // Measured on this machine: about 4.6 s with one shared budget, about
        // 8.7 s with a budget per check. The ceiling sits between them, and the
        // deterministic half of this case is the check 4 line below.
        assert.ok(elapsed >= 3000,
            'the run finished in ' + elapsed + ' ms, too fast to have waited on the 4000 ms budget at all');
        assert.ok(elapsed < 7500,
            'the run took ' + elapsed + ' ms against a 4000 ms budget, which is a second timeout being spent after the first');

        const lines = checkLines(res.stdout);
        assert.match(lineFor(lines, 4) || '', /^INFO  4\. Embedder: not read: no time left in the run's 4000 ms budget/,
            'a check reached with no budget left must say so rather than wait again, and as INFO, since it was never attempted:\n' + res.stdout);
    } finally {
        await blackHole.close();
        rmDir(root);
    }
});

test('every printed line matches the output contract the doctor parses', { skip: !havePwsh }, async () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const embedderPort = await closedPort();
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedderPort + '/', model: 'BAAI/bge-m3' }
        });
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        assertStubRan(res, stub);
        const lines = checkLines(res.stdout);
        assert.ok(lines.length >= 6, 'expected one line per check:\n' + res.stdout);
        const numbers = [];
        for (const line of lines) {
            const m = LINE.exec(line);
            assert.ok(m, 'a line the doctor cannot parse:\n' + line);
            numbers.push(Number(m[2]));
        }
        // The spec's order, which section 5 relies on being stable.
        assert.deepStrictEqual(numbers, numbers.slice().sort((a, b) => a - b),
            'the checks must print in the spec\'s order:\n' + res.stdout);
        for (const n of [1, 2, 3, 4, 5, 6]) {
            assert.ok(numbers.includes(n), 'no line for check ' + n + ':\n' + res.stdout);
        }
    } finally {
        rmDir(root);
    }
});

test('-Quick skips the latency check and nothing else', { skip: !havePwsh }, async () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const embedderPort = await closedPort();
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedderPort + '/', model: 'BAAI/bge-m3' }
        });
        const quickRes = await runProbeAsync(['-ConfigPath', file, '-Quick'], stub.env);
        assertStubRan(quickRes, stub);
        const quick = checkLines(quickRes.stdout);
        const quickLatency = lineFor(quick, 5);
        assert.ok(quickLatency, 'check 5 still reports under -Quick, as a skip:\n' + quick.join('\n'));
        assert.match(quickLatency, /^INFO  5\. Latency: skipped under -Quick$/, quickLatency);
        for (const n of [1, 2, 3, 4, 6]) {
            assert.ok(lineFor(quick, n), 'check ' + n + ' must still run under -Quick:\n' + quick.join('\n'));
        }

        // The control: without the switch, the same config produces a real
        // verdict on check 5 rather than the skip line, so the case above is
        // reading the switch and not a state the probe is in anyway.
        const full = checkLines((await runProbeAsync(['-ConfigPath', file], stub.env)).stdout);
        const fullLatency = lineFor(full, 5);
        assert.ok(fullLatency && !/skipped under -Quick/.test(fullLatency), fullLatency);
    } finally {
        rmDir(root);
    }
});

test('an unrecognised switch is a hard error, never a clean report', { skip: !havePwsh }, async () => {
    // Without [CmdletBinding()] a param block swallows an unknown switch into
    // $args and runs the whole body, so a misspelled -Quick would print a full
    // report having measured the latency it was told to skip.
    const root = makeRoot();
    try {
        const { file } = writeConfig(root, {});
        const res = runProbe(['-ConfigPath', file, '-Quik']);
        assert.notStrictEqual(res.status, 0, 'a bogus switch must fail the run:\n' + res.stdout + res.stderr);
        assert.strictEqual(checkLines(res.stdout).length, 0,
            'the body must not run at all on a binding error:\n' + res.stdout);
    } finally {
        rmDir(root);
    }
});

test('the password travels in the environment and never on the command line', { skip: !havePwsh }, async () => {
    // Observed rather than asserted: the stub records the argument list it was
    // handed and whether SQLCMDPASSWORD was set for it, so this proves both
    // halves of the claim. A probe that passed -P would look identical from the
    // outside, since sqlcmd does not echo its own command line.
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const embedderPort = await closedPort();
        const { file, config } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedderPort + '/', model: 'BAAI/bge-m3' },
            timeoutMs: 3000
        });
        // The needle is read back out of the written config rather than
        // retyped, so this checks whatever the probe actually loaded.
        const needle = JSON.parse(fs.readFileSync(file, 'utf8')).password;
        assert.ok(needle && needle === config.password);

        // The control: the same substring predicate, run against an instance
        // that does hold the needle. Both assertions below are absences, and an
        // absence proves nothing until the predicate has been seen to match.
        assert.ok(fs.readFileSync(file, 'utf8').includes(needle),
            'the sweep predicate cannot even find the needle in the file that holds it');

        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        assertStubRan(res, stub);
        const log = stub.readLog();

        assert.ok(!log.includes(needle), 'the password was passed on the command line:\n' + log);
        assert.ok(!(res.stdout + res.stderr).includes(needle),
            'the password reached the output channel:\n' + res.stdout + res.stderr);
        assert.match(log, /SQLCMDPASSWORD=set/,
            'the password must actually reach the child in its environment, or the probe could never log in:\n' + log);

        // The same argument list carries the run's budget and the flags the
        // spawn's safety rests on. The two clocks are asserted by the property
        // that matters rather than by an exact number, which is computed from
        // the budget left after startup and so moves with the machine's load:
        // each is at least the tool's one-second floor, and together they
        // cannot exceed the configured timeout.
        const login = /ARGV .*-l (\d+)\b/.exec(log);
        const query = /ARGV .*-t (\d+)\b/.exec(log);
        assert.ok(login && query, 'the configured budget must reach the spawn:\n' + log);
        assert.ok(Number(login[1]) >= 1 && Number(query[1]) >= 1, log);
        assert.ok(Number(login[1]) + Number(query[1]) <= 3,
            'one spawn must not be able to outlast the 3000 ms budget it was given:\n' + log);
        assert.match(log, /ARGV .*-x\b/, 'a $(VAR) reference in the batch must stay literal:\n' + log);
        assert.match(log, /ARGV .*-N\b/, log);
        assert.ok(!/ARGV .*\s-C(\s|$)/.test(log), 'the connection must not trust any certificate:\n' + log);
    } finally {
        rmDir(root);
    }
});

test('check 5 passes on a refusal that names the size ceiling', { skip: !havePwsh }, async () => {
    const root = makeRoot();
    const embedder = await fakeEmbedder({});
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const { file } = writeConfig(root, {
            embedding: { url: embedder.url, model: 'BAAI/bge-m3' },
            timeoutMs: 5000
        });
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        assertStubRan(res, stub);
        const lines = checkLines(res.stdout);
        assert.match(lineFor(lines, 4) || '', /^PASS  4\. Embedder: model BAAI\/bge-m3 listed, one vector of 1024 floats/, lines.join('\n'));
        assert.match(lineFor(lines, 5) || '',
            /^PASS  5\. Latency: \d+ chars: median \d+ ms, max \d+ ms; query \d+ chars: median \d+ ms, max \d+ ms; oversize \d+ chars refused with HTTP 500: input \(\d+ tokens\) is too large to process/,
            lines.join('\n'));
    } finally {
        await embedder.close();
        rmDir(root);
    }
});

test('check 5 fails on a non-2xx that is the server breaking rather than refusing', { skip: !havePwsh }, async () => {
    // The withheld control for the case above. Same shape, same status class,
    // a body that names no ceiling: a crash behind the oversized input, or a
    // proxy in front of the server, must not be read as the policy refusal the
    // publisher's chunk contract rests on.
    const root = makeRoot();
    const embedder = await fakeEmbedder({
        oversizeStatus: 502,
        oversizeBody: JSON.stringify({ error: { code: 502, message: 'bad gateway', type: 'proxy_error' } })
    });
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const { file } = writeConfig(root, {
            embedding: { url: embedder.url, model: 'BAAI/bge-m3' },
            timeoutMs: 5000
        });
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        assertStubRan(res, stub);
        const lines = checkLines(res.stdout);
        assert.match(lineFor(lines, 5) || '',
            /^FAIL  5\. Latency: .*drew HTTP 502 whose body does not name a size ceiling, so the server errored rather than refusing: bad gateway/,
            res.stdout);
        assert.notStrictEqual(res.status, 0, res.stdout);
    } finally {
        await embedder.close();
        rmDir(root);
    }
});

// The one case that leaves this machine. It runs against the operator's own
// config and the real host, and only under KIT_MEMORY_DB_LIVE=1: the presence
// of the config file is never the switch, or the whole-suite gate would reach
// the network on every machine that has one.
test('the live host passes every check', { skip: !(havePwsh && LIVE) }, () => {
    const res = runProbe([]);
    const lines = checkLines(res.stdout);
    assert.ok(lines.length >= 6, res.stdout + res.stderr);
    for (const line of lines) {
        const m = LINE.exec(line);
        assert.ok(m, 'a line the doctor cannot parse:\n' + line);
        assert.notStrictEqual(m[1], 'FAIL', 'a failing check against the live host:\n' + line);
    }
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    // The refusal check 5 depends on: the publisher's chunk contract rests on
    // the server saying no to an oversized input and saying why, so a live run
    // reporting PASS on a bare non-2xx would be the expensive false green.
    assert.match(lineFor(lines, 5) || '',
        /refused with HTTP \d{3}: input \(\d+ tokens\) is too large to process\. increase the physical batch size \(current batch size: 2048\)/,
        res.stdout);
});
