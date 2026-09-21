// Tests for doctor.ps1's "Memory database" section: the report an operator
// reads for the shared SQL Server index on the host, the local queue and the
// age of the last publish.
//
// Node's built-in test runner, no framework, no install (Node v24). Every
// case plants its own store root under a short temp directory and passes it
// as $claudeDir, so nothing here reads the real ~\.claude, its client config
// or its queue. The cases spawn Windows PowerShell and are skipped off
// Windows, where the doctor itself does not run.
//
// The section is lifted as source text between its own marker comment and
// the auto-compaction window's, and executed (Invoke-Expression) inside a
// harness that stubs Report (captures each call instead of printing), sets
// $claudeDir, $pluginRoot, $nodeCmd and $Fix, and dot-sources the real
// Get-SanitizedLine, the technique doctor-goal-state.test.js and
// embedder-install.test.js established for their sibling sections.
//
// The two children the step spawns are stubbed on PATH. A pwsh.cmd prints
// whatever probe lines a case planted and exits with the code it planted, so
// no case reaches a host. A node.cmd runs a small real node script that
// requires the real client and calls its real hostHealth against a planted
// config, a real queue file and a canned sqlcmd answer, so what is stubbed is
// the one boundary the client itself seams (deps.runBatch) and everything
// between the doctor and that seam runs for real. One case runs the real node
// against a port nothing listens on, so the doctor's own health script text is
// exercised end to end on the FAIL path.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const PLUGIN_ROOT = path.join(REPO, 'plugins', 'claude-kit');
const DOCTOR = path.join(PLUGIN_ROOT, 'doctor', 'doctor.ps1');
const SANITIZER = path.join(PLUGIN_ROOT, 'doctor', 'sanitize-line.ps1');
const CLIENT = path.join(PLUGIN_ROOT, 'scripts', 'memory-database.js');
const db = require(CLIENT);
const isWin = process.platform === 'win32';
// The FAIL-by-unreachable-host case spawns the real sqlcmd at the client's
// pinned path against a closed port; where the client tools are not installed
// the client itself stands down with a different sentence, so the case skips.
const haveSqlcmd = isWin && db.sqlcmdPath() !== null;

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function pwsh(script, extraEnv) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', env: { ...process.env, ...(extraEnv || {}) } });
}

function write(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
}

function makeRoot(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmRoot(root) {
    fs.rmSync(root, { recursive: true, force: true });
}

// A client config at the store root, Windows authentication so no case
// writes a password, and a server nothing here ever reaches unless a case
// points it at a closed port on purpose.
function writeConfig(claudeDir, extra) {
    write(path.join(claudeDir, db.CONFIG_FILE), JSON.stringify({
        server: 'kit-db-test',
        database: 'KitMemoryTest',
        windowsAuth: true,
        embedding: { url: 'http://127.0.0.1:1', model: 'test-model' },
        ...(extra || {})
    }));
}

// One row on the queue at the store root, written through the client's own
// schema so the count the doctor reads is the count the drain would.
function writeQueueRow(claudeDir) {
    const handle = db.openQueue(path.join(claudeDir, db.QUEUE_FILE));
    try {
        handle.prepare('INSERT INTO queue (id, kind, payload, created_at) VALUES (?, ?, ?, ?)')
            .run('stamp-1', 'usage', '{}', new Date().toISOString());
    } finally {
        handle.close();
    }
}

const PROBE_PASS_LINES = [
    'PASS  1. Connection: encrypted and certificate-validated by the client (-N, no -C), as kit_scott_claude over TCP',
    'PASS  2. Server: ProductVersion 17.0.1000.7, IsFullTextInstalled 1',
    'INFO  2. Database: KitMemoryTest is present on the server',
    'PASS  3. Vector: VECTOR_DISTANCE cosine on identical VECTOR(1024) vectors = 0',
    'PASS  4. Embedder: model test-model listed, one vector of 1024 floats, Server header llama.cpp',
    'INFO  5. Latency: skipped under -Quick',
    'PASS  6. sqlcmd: C:\\Program Files\\sqlcmd.exe, version 15.0'
];

// The stub directory the step's two children resolve from. pwsh.cmd prints
// the planted probe lines and exits with the planted code. node.cmd hands
// every argument to stub-node.js under the real node, which answers the
// doctor's health reading through the real client with a canned sqlcmd answer
// and answers a db-sync with planted output and a planted exit code.
function writeStubs(stubDir, plant) {
    const p = plant || {};
    write(path.join(stubDir, 'probe.txt'), (p.probeLines || PROBE_PASS_LINES).join('\r\n') + '\r\n');
    write(path.join(stubDir, 'pwsh.cmd'), [
        '@echo off',
        'type "%~dp0probe.txt"',
        'exit /b ' + (p.probeExit === undefined ? 0 : p.probeExit),
        ''
    ].join('\r\n'));
    if (p.withNode !== false) {
        write(path.join(stubDir, 'health.json'), JSON.stringify(p.health || {
            ok: true,
            rows: [{
                schemaVersion: 2, sharedRecords: 3, sharedEmbeddings: 3,
                sandboxes: [{
                    sandbox: 'TEST-BOX', records: 5, embeddings: 5,
                    lastPublish: p.lastPublish === undefined ? new Date().toISOString() : p.lastPublish,
                    oldestUnembedded: null
                }]
            }]
        }));
        write(path.join(stubDir, 'sync.txt'), (p.syncLines || ['db-sync: 5 record(s) published']).join('\r\n') + '\r\n');
        write(path.join(stubDir, 'node.cmd'), [
            '@echo off',
            '"' + process.execPath + '" "%~dp0stub-node.js" %*',
            ''
        ].join('\r\n'));
        write(path.join(stubDir, 'stub-node.js'), [
            "'use strict';",
            "const fs = require('fs');",
            "const path = require('path');",
            'const argv = process.argv.slice(2);',
            "if (argv[0] === '-e') {",
            '    const client = require(argv[2]);',
            "    const answer = JSON.parse(fs.readFileSync(path.join(__dirname, 'health.json'), 'utf8'));",
            '    const result = client.hostHealth({ configPath: argv[3], storeRoot: argv[4], deps: { runBatch: () => answer } });',
            '    process.stdout.write(JSON.stringify(result));',
            "} else if (argv[1] === 'db-sync') {",
            "    process.stdout.write(fs.readFileSync(path.join(__dirname, 'sync.txt'), 'utf8'));",
            '    process.exitCode = ' + (p.syncExit === undefined ? 0 : p.syncExit) + ';',
            '} else {',
            "    process.stderr.write('stub node: unexpected invocation ' + JSON.stringify(argv) + '\\n');",
            '    process.exitCode = 2;',
            '}',
            ''
        ].join('\n'));
    }
}

// Lifts the doctor's "Memory database" section between its own marker and
// the auto-compaction window's, and runs it with the planted store root as
// $claudeDir. The stub directory goes first on the child's PATH, which is
// where the section resolves pwsh and where the harness resolves node into
// $nodeCmd, the same way the doctor itself does.
function runSection(claudeDir, options) {
    const opts = options || {};
    const outFile = path.join(os.tmpdir(), 'doctor-memory-db-' + process.pid + '-' + Date.now() + '-'
        + Math.random().toString(36).slice(2) + '.json');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$startMarker = "# --- Memory database."',
        '$start = $src.IndexOf($startMarker)',
        'if ($start -lt 0) { throw "Memory database marker not found in doctor.ps1" }',
        '$endMarker = "# --- Auto-compaction window."',
        '$end = $src.IndexOf($endMarker, $start)',
        'if ($end -lt 0) { throw "end marker not found after the Memory database block" }',
        '$section = $src.Substring($start, $end - $start)',
        '',
        '. ' + q(SANITIZER),
        '$script:Reports = @()',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        '',
        '$Fix = ' + (opts.fix ? '$true' : '$false'),
        '$claudeDir = ' + q(claudeDir),
        '$pluginRoot = ' + q(PLUGIN_ROOT),
        '$nodeCmd = Get-Command node -ErrorAction SilentlyContinue',
        '',
        'Invoke-Expression $section',
        '',
        '$__json = @{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const env = {};
    if (opts.path !== undefined) env.PATH = opts.path;
    const res = pwsh(script, env);
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        assert.ok(Array.isArray(parsed.Reports), 'Reports must be an array: ' + res.stdout);
        return parsed.Reports;
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

// A PATH holding the stub directory ahead of the real one, so pwsh and node
// resolve to the stubs; and one holding the stubs plus the system directory
// alone, for the case that must find no pwsh at all.
function stubbedPath(stubDir) {
    return stubDir + path.delimiter + process.env.PATH;
}

function oneReport(reports) {
    assert.strictEqual(reports.length, 1, 'the section reports exactly once: ' + JSON.stringify(reports));
    assert.strictEqual(reports[0].Name, 'Memory database');
    return reports[0];
}

test('with no client config the step reports INFO and spawns nothing', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-info-');
    try {
        const claudeDir = path.join(root, 'claude');
        fs.mkdirSync(claudeDir);
        const report = oneReport(runSection(claudeDir));
        assert.strictEqual(report.Status, 'INFO');
        assert.match(report.Detail, /No client config at /);
        assert.ok(!fs.existsSync(path.join(claudeDir, db.QUEUE_FILE)), 'the doctor creates no queue file');
    } finally {
        rmRoot(root);
    }
});

test('a healthy host, a fresh publish and an empty queue is PASS, with every probe line under it', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-pass-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        writeStubs(stubDir);
        const report = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(report.Status, 'PASS', report.Detail);
        for (const line of PROBE_PASS_LINES) {
            assert.ok(report.Detail.includes('Probe: ' + line), 'the probe line is printed under the step: ' + line + '\n' + report.Detail);
        }
        assert.match(report.Detail, /Host: schema version 2, 3 shared record\(s\), 3 shared embedding\(s\)\./);
        assert.match(report.Detail, /Sandbox TEST-BOX: 5 record\(s\), 5 embedding\(s\), last publish 0 day\(s\) ago\./);
        assert.match(report.Detail, /Queue: empty\./);
        assert.ok(!fs.existsSync(path.join(claudeDir, db.QUEUE_FILE)), 'counting an absent queue creates no queue file');
    } finally {
        rmRoot(root);
    }
});

test('one row on the local queue is WARN, naming the count and the verb that drains it', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-warn-queue-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        writeQueueRow(claudeDir);
        writeStubs(stubDir);
        const report = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(report.Status, 'WARN', report.Detail);
        assert.match(report.Detail, /Queue: 1 row\(s\) wait in the local queue and publish on the next memq db-sync\./);
        assert.match(report.Detail, /Fix: run memq db-sync/);
    } finally {
        rmRoot(root);
    }
});

test('a last publish older than seven days is WARN, and one inside the week is not', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-warn-stale-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
        writeStubs(stubDir, { lastPublish: tenDaysAgo });
        const stale = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(stale.Status, 'WARN', stale.Detail);
        assert.match(stale.Detail, /last publish 10 day\(s\) ago\./);
        assert.match(stale.Detail, /older than 7 days/);

        const sixDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString();
        writeStubs(stubDir, { lastPublish: sixDaysAgo });
        const fresh = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(fresh.Status, 'PASS', fresh.Detail);
        assert.match(fresh.Detail, /last publish 6 day\(s\) ago\./);

        // A sandbox that has never published reads as never, which is stale.
        writeStubs(stubDir, { lastPublish: null });
        const never = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(never.Status, 'WARN', never.Detail);
        assert.match(never.Detail, /last publish never\./);
    } finally {
        rmRoot(root);
    }
});

test('a FAIL line from the probe is FAIL, whatever the health call said', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-fail-probe-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        writeStubs(stubDir, {
            probeLines: [
                'FAIL  1. Connection: sqlcmd exit 1: Sqlcmd: Error: Login timeout expired',
                'FAIL  2. Server: not read: the connection in check 1 did not succeed'
            ],
            probeExit: 1
        });
        const report = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(report.Status, 'FAIL', report.Detail);
        assert.match(report.Detail, /Probe: FAIL  1\. Connection: sqlcmd exit 1/);
        assert.match(report.Detail, /Host: schema version 2/, 'the health lines still print beside a failed probe');
        assert.match(report.Detail, /Fix: bring the host up or repair the config/);
    } finally {
        rmRoot(root);
    }
});

test('a health call the host refused is FAIL with the server\'s own words', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-fail-health-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        writeStubs(stubDir, {
            health: { ok: false, cause: 'refused', detail: 'sqlcmd exited 1: Msg 229, Level 14, State 5, The EXECUTE permission was denied on the object usp_Health' }
        });
        const report = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(report.Status, 'FAIL', report.Detail);
        assert.match(report.Detail, /Health: mem\.usp_Health did not answer under the publisher login: the memory database refused this usp_Health call: sqlcmd exited 1: Msg 229/);
        assert.match(report.Detail, /Queue: empty\./, 'the queue depth still prints beside a refused health call');
    } finally {
        rmRoot(root);
    }
});

test('a config the client stands down on is FAIL naming the file, never a call that was not made', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-fail-config-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        // Half a curator pair is the one invalid shape a config reaches by
        // editing rather than by truncation.
        writeConfig(claudeDir, { curatorLogin: 'kit_curator' });
        writeStubs(stubDir, {});
        const report = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(report.Status, 'FAIL', report.Detail);
        assert.match(report.Detail, /Health: not asked, the client stood down on the config at .*kit-memory-db\.json \(invalid\): /);
        assert.doesNotMatch(report.Detail, /did not answer/, 'no call was made, so no line says the host did not answer');
    } finally {
        rmRoot(root);
    }
});

test('the doctor\'s own health script reaches the real client, and a host that is not there is FAIL', { skip: !haveSqlcmd }, () => {
    // The real node and the doctor's real -e text, against a config naming a
    // port nothing listens on, with the shortest clock the client accepts. The
    // probe is still the stub, since this case is about the health leg.
    const root = makeRoot('doctor-db-fail-unreachable-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir, { server: '127.0.0.1,1', timeoutMs: 1000 });
        writeStubs(stubDir, { withNode: false });
        const report = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.strictEqual(report.Status, 'FAIL', report.Detail);
        assert.match(report.Detail, /Health: mem\.usp_Health did not answer under the publisher login: sqlcmd exited/);
        assert.match(report.Detail, /Queue: empty\./);
    } finally {
        rmRoot(root);
    }
});

test('under -Fix a WARN state runs memq db-sync and reports FIXED on a clean publish, else the failure', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-fixed-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        writeQueueRow(claudeDir);
        writeStubs(stubDir, { syncLines: ['db-sync: 5 record(s) published, 1 queue row(s) drained'] });
        const fixed = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir), fix: true }));
        assert.strictEqual(fixed.Status, 'FIXED', fixed.Detail);
        assert.match(fixed.Detail, /Ran memq db-sync:\n  db-sync: 5 record\(s\) published, 1 queue row\(s\) drained/);

        writeStubs(stubDir, { syncLines: ['memq: the memory database did not answer: sqlcmd exited 1'], syncExit: 1 });
        const failed = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir), fix: true }));
        assert.strictEqual(failed.Status, 'FAIL', failed.Detail);
        assert.match(failed.Detail, /memq db-sync exited 1:\n  memq: the memory database did not answer/);

        // Without -Fix the same state is the WARN that names the verb.
        const warned = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir), fix: false }));
        assert.strictEqual(warned.Status, 'WARN', warned.Detail);
    } finally {
        rmRoot(root);
    }
});

test('with no pwsh on PATH the step is INFO naming the requirement, never the requirement\'s own error', { skip: !isWin }, () => {
    const root = makeRoot('doctor-db-nopwsh-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        // The stub node alone, plus the system directory the shell needs, and
        // no directory holding a pwsh.
        writeStubs(stubDir);
        fs.unlinkSync(path.join(stubDir, 'pwsh.cmd'));
        const systemDir = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
        const shellDir = path.join(systemDir, 'WindowsPowerShell', 'v1.0');
        const report = oneReport(runSection(claudeDir, { path: [stubDir, systemDir, shellDir].join(path.delimiter) }));
        assert.strictEqual(report.Status, 'INFO', report.Detail);
        assert.match(report.Detail, /pwsh \(PowerShell 7\) is not on PATH and the host probe requires it/);
    } finally {
        rmRoot(root);
    }
});

test('every foreign line the step prints passes through the shared sanitizer at the doctor\'s cap', { skip: !isWin }, () => {
    // A probe line carrying an escape sequence and running past the cap arrives
    // stripped and cut with the visible marker, which is the sanitizer's own
    // contract and the proof it stands between the child and this channel.
    const root = makeRoot('doctor-db-sanitized-');
    try {
        const claudeDir = path.join(root, 'claude');
        const stubDir = path.join(root, 'stubs');
        writeConfig(claudeDir);
        const long = 'PASS  1. Connection: \u001b[31m' + 'x'.repeat(200);
        writeStubs(stubDir, { probeLines: [long].concat(PROBE_PASS_LINES.slice(1)) });
        const report = oneReport(runSection(claudeDir, { path: stubbedPath(stubDir) }));
        assert.ok(!report.Detail.includes('\u001b'), 'the escape byte is stripped: ' + JSON.stringify(report.Detail));
        assert.match(report.Detail, /Probe: PASS  1\. Connection: \[31mx+\.\.\. \[\+\d+ more chars\]/);
    } finally {
        rmRoot(root);
    }
});

test('the shared sanitizer is one file both the doctor and the probe dot-source, with no inline copy left', () => {
    const doctor = fs.readFileSync(DOCTOR, 'utf8');
    const probe = fs.readFileSync(path.join(PLUGIN_ROOT, 'db', 'Test-MemoryDatabaseHost.ps1'), 'utf8');
    const helper = fs.readFileSync(SANITIZER, 'utf8');
    assert.match(helper, /^function Get-SanitizedLine \{/m, 'the helper defines the function');
    assert.match(helper, /\[Parameter\(Mandatory = \$true\)\]\[int\]\$MaxLength/, 'the cap is the caller\'s to state');
    assert.doesNotMatch(doctor, /^function Get-SanitizedLine/m, 'the doctor keeps no inline copy');
    assert.doesNotMatch(probe, /^function Get-SanitizedLine/m, 'the probe keeps no inline copy');
    assert.ok(doctor.includes('. (Join-Path $PSScriptRoot "sanitize-line.ps1")'), 'the doctor dot-sources the helper beside it');
    assert.ok(probe.includes('. (Join-Path $PSScriptRoot "..\\doctor\\sanitize-line.ps1")'), 'the probe dot-sources the same helper');
    // Every call in either file states its cap, since the helper has no
    // default: a call whose one argument is followed by a closing paren or
    // brace, or by the end of the line, would bind nothing to $MaxLength and
    // prompt for it at run time. The argument shapes are the two the files
    // use, a variable or a parenthesized expression.
    const capless = /Get-SanitizedLine (?:\$[\w.:]+|\([^()]*(?:\([^()]*\)[^()]*)*\))\s*(?:[)}]|$)/m;
    for (const [name, src] of [['doctor.ps1', doctor], ['Test-MemoryDatabaseHost.ps1', probe]]) {
        const hit = capless.exec(src);
        assert.strictEqual(hit, null, name + ' has a call that states no cap: ' + (hit && hit[0]));
    }
    // The pattern's own control: a planted capless call in each shape is caught.
    for (const planted of ['(Get-SanitizedLine $value)', '{ Get-SanitizedLine $_ }', 'Get-SanitizedLine ($a -join ", ")\n']) {
        assert.notStrictEqual(capless.exec(planted), null, 'the pattern catches: ' + planted);
    }
});
