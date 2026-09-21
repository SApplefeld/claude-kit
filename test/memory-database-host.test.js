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

// What a probe run costs before it reaches anything: pwsh's own startup, the
// script's parse, and a config read that refuses. Measured rather than
// assumed, because the timing cases below bound the probe's HOST work and this
// is everything that is not host work, and because a fixed allowance for it
// would have to be wide enough for the slowest machine and would stop
// discriminating the bound on every other one. Paid once per process.
let overheadPromise = null;
function probeOverheadMs() {
    if (!overheadPromise) {
        overheadPromise = (async () => {
            const root = makeRoot();
            try {
                const started = Date.now();
                await runProbeAsync(['-ConfigPath', path.join(root, 'no-such-config.json')]);
                return Date.now() - started;
            } finally {
                rmDir(root);
            }
        })();
    }
    return overheadPromise;
}

// What the timing cases allow a run for work that is not waiting on a host:
// the local cmd spawns the stub answers, one per SQL check that runs and one
// for check 6's version banner, which the stub's first branch answers without
// a second call, plus process teardown. About double what those spawns cost,
// so a loaded box does not redden the lane.
//
// The floor overshoot is NOT in this allowance. It is a separate term each
// wall bound states for itself, because it differs by fixture: a call started
// just before the deadline runs on the tool's floor, two seconds where the
// crossing call can be a sqlcmd spawn and one second where it can only be an
// HTTP call.
//
// A wall clock cannot discriminate the arithmetic here, since the local spawns
// cost about as much as a rounding defect does, so it is never the only leg.
// The sharp leg is the exact-value pin on Get-ClockSeconds below, and beside it
// each fixture reads what the probe names: the clock it gave a call, or the
// check it did not attempt.
const LOCAL_WORK_ALLOWANCE_MS = 2500;

// The two floor-overshoot terms, each named where the fixture decides which one
// applies: the tool floors a call started just before the deadline is lifted
// to, two seconds across a sqlcmd spawn's two clocks and one second for a
// single HTTP call.
const SPAWN_FLOOR_OVERSHOOT_MS = 2000;
const HTTP_FLOOR_OVERSHOOT_MS = 1000;

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
        // Enough that every check in an ordinary case still has budget left
        // when it is reached, so no case starves by accident. Starvation and
        // the sub-floor lift are each a case of their own below, with a budget
        // chosen to produce them.
        timeoutMs: 4000
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
// Three modes. 'refuse' answers a batch at once with a non-zero exit;
// 'answer' returns every tagged value the three SQL checks look for, which is
// how a case reaches check 2 and check 3 with no server anywhere; 'slow' is
// 'answer' after about four seconds, standing in for a host that answers but
// takes the whole budget doing it, which is what leaves the checks behind it
// with a deadline already passed. Every mode answers a version query
// instantly, since the probe asks for one at check 6 and a stub that slept
// there would confuse the timing a case is measuring.
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
    const answer = (mode === 'answer' || mode === 'slow')
        ? [
            'echo kitprobe-connected=kit_scott_claude^|TCP',
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
//
// It also counts what it accepted, which is how a case tells a boundary call
// that waited out a clock from one the budget stopped before it was made. The
// count is all it can report: the client abandons a timed-out request without
// closing the connection, so the socket's life is no reading at all.
function blackHoleListener() {
    return new Promise((resolve, reject) => {
        const sockets = [];
        let accepted = 0;
        const server = net.createServer((socket) => {
            sockets.push(socket);
            accepted += 1;
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            resolve({
                port: server.address().port,
                accepted: () => accepted,
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

// Calls the probe's own Get-ClockSeconds with each (budget, clocks, floor)
// row and returns what it answered, one number per row.
//
// The function is lifted out of the script by the PowerShell parser and defined
// on its own, rather than run as part of the script: the probe's body reads a
// config and reaches for a host the moment it is dot-sourced, and this case is
// about arithmetic. Lifting by the parser rather than by a line range means a
// moved function is still found and a renamed one fails loudly.
function callClockSeconds(pairs) {
    const root = makeRoot();
    try {
        const driver = path.join(root, 'clock-seconds.ps1');
        fs.writeFileSync(driver, [
            'param([Parameter(Mandatory = $true)][string]$ProbePath, [Parameter(Mandatory = $true)][string]$Pairs)',
            '$tokens = $null; $errors = $null',
            '$ast = [System.Management.Automation.Language.Parser]::ParseFile($ProbePath, [ref]$tokens, [ref]$errors)',
            'if ($errors.Count -gt 0) { Write-Output "PARSE-ERRORS"; exit 2 }',
            '$fn = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and',
            '    $node.Name -eq "Get-ClockSeconds" }, $true)',
            'if ($null -eq $fn) { Write-Output "NO-SUCH-FUNCTION"; exit 3 }',
            '. ([scriptblock]::Create($fn.Extent.Text))',
            'foreach ($pair in $Pairs.Split(",")) {',
            '    $parts = $pair.Split(":")',
            '    Write-Output (Get-ClockSeconds -BudgetMs ([int]$parts[0]) -Clocks ([int]$parts[1]) -FloorMs ([int]$parts[2]))',
            '}',
            ''
        ].join('\r\n'), 'utf8');
        const res = spawnSync('pwsh',
            ['-NoProfile', '-File', driver, '-ProbePath', PROBE,
                '-Pairs', pairs.map((row) => row.join(':')).join(',')],
            { encoding: 'utf8' });
        assert.strictEqual(res.status, 0,
            'the probe\'s clock arithmetic could not be lifted out of the script:\n' + res.stdout + res.stderr);
        return res.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '').map(Number);
    } finally {
        rmDir(root);
    }
}

function checkLines(stdout) {
    return stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
}

function lineFor(lines, number) {
    return lines.find((l) => new RegExp('^\\S+  ' + number + '\\. ').test(l));
}

test('the clock a boundary call is given is divided down and floored, never rounded', { skip: !havePwsh }, () => {
    // The whole budget mechanism in one table, called directly, so each row
    // fails on its own defect rather than on a wall clock that cannot tell
    // them apart.
    //
    // Every row discriminates something. A budget of zero answers zero, which
    // is the deadline having passed and the only case where no call is made.
    // A budget of one, and one a millisecond under the floor, answer one:
    // refusing a call because the remainder is small fails a healthy host on
    // arithmetic, so the share is lifted to the floor instead. The rows at 3000
    // and 3999 over two clocks, and 1500 and 2999 over one, are where rounding
    // to nearest answers one second more than dividing down does, which is the
    // defect that let a spawn outlast the budget it was cut from.
    //
    // The floor is the third column because the function derives it rather than
    // holding a literal, and the last row of each block is the leg that proves
    // it: a floor no caller passes, which must move the answer. Without it a
    // function ignoring its floor argument entirely would still pass every row
    // above, since the real constants and a hardcoded second agree.
    const rows = [
        [0, 2, 2000], [1, 2, 2000], [1999, 2, 2000], [3000, 2, 2000], [3999, 2, 2000], [4000, 2, 2000],
        [3000, 2, 6000],
        [0, 1, 1000], [1, 1, 1000], [999, 1, 1000], [1500, 1, 1000], [2999, 1, 1000],
        [1500, 1, 4000]
    ];
    const expected = [0, 1, 1, 1, 1, 2, 3, 0, 1, 1, 1, 2, 4];
    assert.deepStrictEqual(callClockSeconds(rows), expected,
        'the clock arithmetic drifted: ' + JSON.stringify(rows.map((r, i) => r.join('/') + '=>' + expected[i])));
});

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
        // Both lines about the refused name are failures: the run was asked
        // whether that database exists and cannot find out, so the reading is
        // missing rather than absent, and the exit code has to say so.
        assert.match(res.stdout, /FAIL  0\. Client config: database is not a plain identifier/, res.stdout);
        assert.ok(checkLines(res.stdout).some((l) => /^FAIL  2\. Database: .*was not looked up/.test(l)), res.stdout);
        assert.notStrictEqual(res.status, 0,
            'a run that could not take a reading it was asked for must not exit 0:\n' + res.stdout);
        assert.match(lineFor(checkLines(res.stdout), 1) || '', /^PASS  1\. Connection: /, res.stdout);
        assert.match(lineFor(checkLines(res.stdout), 2) || '', /^PASS  2\. Server: /,
            'a name check 2 will not look up must not cost check 2 its other two readings:\n' + res.stdout);

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
    // The withheld control for the two counting-listener cases above. Same
    // listener, same predicate, an instance that does hold the thing: the
    // embedding endpoint is a config the probe accepts, so check 4 connects and
    // the counter must read non-zero. A counter read before the event loop could
    // dispatch would read zero here too, which is exactly the silent instrument
    // this catches. It varies the instrument's own axis, whether the listener
    // counts what reaches it; the connection it counts is an HTTP one, since no
    // case here can drive a socket at the SQL port without the real client
    // tools, which this file plants a stub in place of.
    const root = makeRoot();
    const embedder = await countingListener();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedder.port + '/', model: 'BAAI/bge-m3' },
            timeoutMs: 4000
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

// The parser's message is the one line of the report that reads from the
// file, and the file holds the password. On PowerShell 7 that message names
// the key path and one character at the point of failure, never the value
// itself, so what the probe withholds is a one-character disclosure per
// run and the key name. The pin is that no parser text reaches the line at
// all: the message opens "Conversion from JSON failed", and the FAIL line
// carrying that opening is the echo this case exists to keep out.
test('an unreadable config file is reported without the parser message', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const file = path.join(root, 'broken-config.json');
        fs.writeFileSync(file, '{"server":"127.0.0.1","database":"KitMemory","password":"kittest-value"bad}', 'utf8');
        const res = runProbe(['-ConfigPath', file]);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /FAIL  0\. Client config: .*is not readable JSON; the parser's own message is withheld/, res.stdout);
        const echoed = /Conversion from JSON|Path '|kittest-value/;
        assert.ok(!echoed.test(res.stdout) && !echoed.test(res.stderr),
            'the report carries the parser message or a byte of the file:\n' + res.stdout + res.stderr);
    } finally {
        rmDir(root);
    }
});

test('a boundary call against a host that never answers is bounded by the remaining budget', { skip: !havePwsh }, async () => {
    // Acceptance (c)'s bound, and the only case that reaches a socket which
    // accepts and then says nothing, which is the shape a closed port cannot
    // produce. sqlcmd fails at once here, so nearly the whole budget is still
    // on the table when check 4 opens that socket, and the socket's own life is
    // the clock that call was given.
    //
    // The bound is asserted twice over. On the clock the call was given, which
    // the probe names in its own failure line and which carries no process
    // startup: the deadline is already part spent when check 4 opens that
    // socket, so a call handed the whole timeout's worth of seconds is a share
    // rounded up rather than divided down. And on the wall clock, against the
    // measured non-host overhead, which is the coarse leg.
    const budgetMs = 3000;
    const root = makeRoot();
    const blackHole = await blackHoleListener();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + blackHole.port + '/', model: 'BAAI/bge-m3' },
            timeoutMs: budgetMs
        });
        const overhead = await probeOverheadMs();
        const started = Date.now();
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        const elapsed = Date.now() - started;
        assertStubRan(res, stub);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);

        const embedderLine = lineFor(checkLines(res.stdout), 4) || '';
        assert.match(embedderLine,
            /^FAIL  4\. Embedder: GET \/v1\/models did not answer within its \d+ second clock: /,
            'the socket was opened and never answered, so this must be a timeout:\n' + res.stdout);
        assert.ok(blackHole.accepted() >= 1,
            'no connection reached the black hole, so nothing waited on anything:\n' + res.stdout);

        // The clock that call was given, read out of the figure the probe itself
        // prints rather than out of the HTTP client's exception text, which is a
        // third-party string in the platform's own words. A run whose deadline is
        // already part spent can never hand a single call the whole timeout's
        // worth of seconds, so this is the bound rather than a restatement of the
        // configured value.
        const clock = /did not answer within its (\d+) second clock/.exec(embedderLine);
        assert.ok(clock, 'the boundary call no longer names the clock it was given:\n' + embedderLine);
        assert.ok(Number(clock[1]) >= 1, embedderLine);
        assert.ok(Number(clock[1]) * 1000 < budgetMs,
            'the call was given ' + clock[1] + ' s of clock out of a ' + budgetMs +
            ' ms budget the run had already started spending, so its share was rounded up:\n' + embedderLine);

        // The coarse leg, and what it is worth: it catches a run that waits a
        // whole extra timeout or waits with no clock at all, and it does NOT
        // catch a call given one second more than it should have been, because
        // the local spawns vary by about that much. The clock assertion above
        // is what catches that, and it is why this bound is the second leg
        // rather than the only one. The crossing call here can only be the HTTP
        // one, since the stub refuses at once, so the overshoot term is a
        // single second.
        const hostMs = elapsed - overhead;
        assert.ok(hostMs <= budgetMs + HTTP_FLOOR_OVERSHOOT_MS + LOCAL_WORK_ALLOWANCE_MS,
            'the run spent ' + hostMs + ' ms past its ' + overhead + ' ms of startup against a ' + budgetMs +
            ' ms budget and one second of floor overshoot, so it waited somewhere it should not have');
    } finally {
        await blackHole.close();
        rmDir(root);
    }
});

test('a budget under one spawn s floor still probes a healthy host', { skip: !havePwsh }, async () => {
    // The floor the two clocks cannot go below is a second each, so a budget
    // under two seconds cannot be divided into a spawn that fits inside it.
    // The call is made anyway, on the floor: the budget bounds how long this
    // run waits on a host, and a host that is up answers in milliseconds, so
    // declining the call here would fail a working server on arithmetic while
    // the overshoot it avoids is a bounded second or two.
    //
    // What a sub-floor budget promises is that the call is MADE, on the floor.
    // It does not promise the whole run finishes inside that budget, and this
    // case must not assert that it does: one local process spawn on a contended
    // box can cost more than the whole budget, after which the checks behind it
    // are stopped by a deadline that really has passed, which is the ruling
    // working rather than a defect. So the reading here is check 1 and the
    // clocks it was given, both decided before any later check can run long.
    //
    // The whole-run green under a healthy host lives in the control below, at a
    // budget with room for it, and in the live case at the end of this file.
    const budgetMs = 1900;
    const root = makeRoot();
    const embedder = await fakeEmbedder({});
    try {
        const stub = plantSqlcmdStub(root, 'answer');
        const { file } = writeConfig(root, {
            embedding: { url: embedder.url, model: 'BAAI/bge-m3' },
            timeoutMs: budgetMs
        });
        // -Quick because check 5's twenty-one calls measure latency and are
        // outside the budget entirely, so they say nothing about this bound.
        const res = await runProbeAsync(['-ConfigPath', file, '-Quick'], stub.env);
        const lines = checkLines(res.stdout);
        assertStubRan(res, stub);

        assert.match(lineFor(lines, 1) || '', /^PASS  1\. Connection: /,
            'a sub-floor budget must still reach a host that is up:\n' + res.stdout);
        for (const line of lines) {
            assert.doesNotMatch(line, /not attempted/,
                'a check was refused for want of budget rather than run on the floor:\n' + res.stdout);
        }

        // The clocks the spawn was actually given: the floor, one second each,
        // which is the lift rather than a division of the budget, since the
        // budget divided over two clocks is under a second.
        const log = stub.readLog();
        assert.match(log, /ARGV .*-l 1\b/, 'the login clock was not lifted to the tool floor:\n' + log);
        assert.match(log, /ARGV .*-t 1\b/, 'the query clock was not lifted to the tool floor:\n' + log);

        // The control beside it, and the case that carries the acceptance's
        // first clause: a budget with room for the whole run against the same
        // healthy host gives every line PASS or INFO and exits 0, and its first
        // spawn is given a divided share rather than the floor. Two regimes,
        // one host, so the case above reads the lift rather than a state the
        // probe is in at any budget.
        //
        // The budget here is far larger than the run needs, rather than merely
        // large enough. Every check costs a local process spawn, and a spawn on
        // a box under load costs seconds, so a snug budget would turn a correct
        // starvation into a red on exactly the machines this lane has to stay
        // honest on.
        const okRoot = makeRoot();
        try {
            const okStub = plantSqlcmdStub(okRoot, 'answer');
            const ok = writeConfig(okRoot, {
                embedding: { url: embedder.url, model: 'BAAI/bge-m3' },
                timeoutMs: 60000
            });
            const okRes = await runProbeAsync(['-ConfigPath', ok.file, '-Quick'], okStub.env);
            assertStubRan(okRes, okStub);
            const okLines = checkLines(okRes.stdout);
            assert.match(lineFor(okLines, 1) || '', /^PASS  1\. Connection: /, okRes.stdout);
            for (const line of okLines) {
                assert.doesNotMatch(line, /^FAIL /,
                    'every check against a healthy host with room to run must be PASS or INFO:\n' + okRes.stdout);
            }
            assert.strictEqual(okRes.status, 0, okRes.stdout + okRes.stderr);
            const okLogin = /ARGV .*-l (\d+)\b/.exec(okStub.readLog());
            assert.ok(okLogin && Number(okLogin[1]) >= 2,
                'a budget several times the floor must divide into a clock larger than the floor:\n' + okStub.readLog());
        } finally {
            rmDir(okRoot);
        }
    } finally {
        await embedder.close();
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
    // stub sleep; with a timeout per check it costs that sleep again at checks
    // 2 and 3 and the endpoint's own wait at check 4.
    //
    // The budget sits well under the stub's fixed sleep, so the deadline has
    // certainly passed by check 2 and the starvation below is by construction
    // rather than by a race the box could win on a quiet morning.
    const budgetMs = 2000;
    const stubSleepMs = 4000;
    const root = makeRoot();
    const blackHole = await blackHoleListener();
    try {
        const stub = plantSqlcmdStub(root, 'slow');
        const { file } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + blackHole.port + '/', model: 'BAAI/bge-m3' },
            timeoutMs: budgetMs
        });
        const overhead = await probeOverheadMs();
        const started = Date.now();
        const res = await runProbeAsync(['-ConfigPath', file], stub.env);
        const elapsed = Date.now() - started;
        assertStubRan(res, stub);
        assert.notStrictEqual(res.status, 0,
            'a run whose checks were stopped by the deadline must exit non-zero:\n' + res.stdout + res.stderr);
        // Check 1 answered, slowly. That is what makes the checks behind it
        // starved by the deadline rather than skipped over a failed connection,
        // which is a different line and a different rule.
        assert.match(lineFor(checkLines(res.stdout), 1) || '', /^PASS  1\. Connection: /,
            'the slow stub must still answer, or checks 2 and 3 report a failed connection instead:\n' + res.stdout);

        // The stub's own sleep is the one wait here, and it ignores the clocks
        // it is handed, so the bound is that sleep plus local work rather than
        // anything derived from the budget.
        //
        // What this ceiling catches: a check 2 or 3 that spawns again, which
        // costs the sleep a second time and lands far past it. What it does not
        // catch: a check 4 that waits on the endpoint anyway, which at this
        // budget can cost as little as a second and fit underneath. The
        // accepted-nothing assertion below is what catches that one, and it is
        // exact rather than timed.
        const hostMs = elapsed - overhead;
        assert.ok(hostMs >= 3000,
            'the run spent ' + hostMs + ' ms past its ' + overhead +
            ' ms of startup, too little to have waited on the stub at all');
        assert.ok(hostMs <= stubSleepMs + LOCAL_WORK_ALLOWANCE_MS,
            'the run spent ' + hostMs + ' ms past its ' + overhead + ' ms of startup against one ' + stubSleepMs +
            ' ms stub sleep, which is a second wait being spent after the first');
        assert.strictEqual(blackHole.accepted(), 0,
            'the embedding endpoint was reached at all, though the deadline had passed before check 4');

        // Every check the deadline stopped names the budget it was spent from,
        // and every one of them is a failure, since none of them measured
        // anything.
        const lines = checkLines(res.stdout);
        for (const n of [2, 3, 4]) {
            assert.match(lineFor(lines, n) || '',
                new RegExp('^FAIL  ' + n + '\\. \\w+: not read: the run\'s ' + budgetMs + " ms budget was spent"),
                'check ' + n + ' was stopped by the deadline and must say so as a failure:\n' + res.stdout);
        }
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

        // The same contract over the line shapes only a run that reaches a
        // healthy host produces, which the refusing stub above cannot emit: the
        // second check 2 line, a vector distance, and check 5's measured
        // medians and maxima. The doctor parses this run too, and its values
        // carry colons and parentheses the failure lines do not.
        const okRoot = makeRoot();
        const embedder = await fakeEmbedder({});
        try {
            const okStub = plantSqlcmdStub(okRoot, 'answer');
            const ok = writeConfig(okRoot, {
                embedding: { url: embedder.url, model: 'BAAI/bge-m3' },
                timeoutMs: 60000
            });
            const okRes = await runProbeAsync(['-ConfigPath', ok.file], okStub.env);
            assertStubRan(okRes, okStub);
            assert.strictEqual(okRes.status, 0, okRes.stdout + okRes.stderr);
            const okLines = checkLines(okRes.stdout);
            const okNumbers = [];
            for (const line of okLines) {
                const m = LINE.exec(line);
                assert.ok(m, 'a line the doctor cannot parse:\n' + line);
                okNumbers.push(Number(m[2]));
            }
            assert.deepStrictEqual(okNumbers, okNumbers.slice().sort((a, b) => a - b),
                'the checks must print in the spec\'s order:\n' + okRes.stdout);
            assert.ok(okLines.some((l) => /^INFO  2\. Database: /.test(l)),
                'the second check 2 line is part of the contract:\n' + okRes.stdout);
            assert.match(lineFor(okLines, 3) || '', /^PASS  3\. Vector: /, okRes.stdout);
            assert.match(lineFor(okLines, 5) || '', /^PASS  5\. Latency: /, okRes.stdout);
        } finally {
            await embedder.close();
            rmDir(okRoot);
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

        // The control: without the switch, the same config produces a check 5
        // line that is not the skip, so the case above is reading the switch and
        // not a state the probe is in anyway. The embedding endpoint here is a
        // closed port, so that line is the failure check 4's dead server caused
        // rather than a measurement; a measured check 5 line is the case below
        // it, against the fake embedder.
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
    const budgetMs = 3000;
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root, 'refuse');
        const embedderPort = await closedPort();
        const { file, config } = writeConfig(root, {
            embedding: { url: 'http://127.0.0.1:' + embedderPort + '/', model: 'BAAI/bge-m3' },
            timeoutMs: budgetMs
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
        // each is at least the tool's one-second floor, and the two together,
        // which run one after the other, are at most the configured timeout or
        // that floor where the floor is the larger: a spawn cut from a budget
        // smaller than its own floor runs on the floor, and one cut from a
        // larger budget fits inside it.
        const ceilingMs = Math.max(budgetMs, SPAWN_FLOOR_OVERSHOOT_MS);
        const login = /ARGV .*-l (\d+)\b/.exec(log);
        const query = /ARGV .*-t (\d+)\b/.exec(log);
        assert.ok(login && query, 'the configured budget must reach the spawn:\n' + log);
        assert.ok(Number(login[1]) >= 1 && Number(query[1]) >= 1, log);
        assert.ok((Number(login[1]) + Number(query[1])) * 1000 <= ceilingMs,
            'the spawn was given ' + login[1] + ' s of login clock and ' + query[1] +
            ' s of query clock, past the ' + ceilingMs + ' ms that bounds it:\n' + log);
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
