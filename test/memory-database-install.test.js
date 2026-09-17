// Tests for the memory database installer,
// plugins/claude-kit/db/Install-MemoryDatabase.ps1, and the schema, procedures
// and role model it applies.
//
// Node's built-in test runner, no framework, no install (Node v24). The
// installer is PowerShell, so every case spawns pwsh and is skipped where pwsh
// is not on this machine.
//
// Two lanes. The stub lane runs the installer against a stub sqlcmd planted in
// a temp directory, needs no SQL Server anywhere, and proves the installer's
// own control flow: the order it applies scripts in, the version refusal, the
// exclusive logins file, and that no password ever reaches a command line or
// the output. The live lane runs the real installer against the LOCAL default
// instance under Windows authentication, in a database named for this run and
// dropped at the end, and proves the tenancy filter, the role gates and the
// query log against real rows. It runs only where sqlcmd, a reachable local
// instance and sysadmin on it are all present, and skips with the reason
// otherwise. Nothing here reaches any host but localhost.
//
// The tenancy filter resolves the login that opened the connection
// (ORIGINAL_LOGIN()), which impersonation cannot move, so the live lane proves
// it on the connection it actually holds: mem.Sandbox maps a login to a
// sandbox as data, and the lane points its own Windows login at one sandbox
// row, reads, points it at the other, reads again, and finally at none. The
// role gates are a different property, the permission set of a database
// user, and those run under EXECUTE AS USER, which is exactly the token the
// permission engine evaluates; the sandbox such a call resolves is still the
// connection's, which one case pins as the guard it is.
//
// The live lane creates the kit's five fixed server logins where they are
// absent and drops exactly the ones it created; a login already on the
// instance is never touched. Those five names are server-scoped and fixed,
// so two live lanes running at once on one instance collide on them: this
// file belongs to the contention lane and is not run beside itself. The
// logins file lands under the run's temp directory and goes with it.
//
// No case contains a credential. The passwords the installer generates are
// read back out of the logins file it wrote and swept for, never retyped.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
const DB_DIR = path.join(REPO, 'plugins', 'claude-kit', 'db');
const INSTALLER = path.join(DB_DIR, 'Install-MemoryDatabase.ps1');
const SERVER = 'localhost';
const SCRIPT_DIRECTORIES = ['Schema', 'FullText', 'Procedures', 'Security'];
const KIT_LOGINS = ['kit_scott_claude', 'kit_neo_claude', 'kit_asr_claude', 'kit_curator', 'kit_review'];
const DIMENSIONS = 1024;

const havePwsh = (() => {
    if (process.platform !== 'win32') return false;
    const res = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0'], { encoding: 'utf8' });
    return res.status === 0;
})();

// The child's environment with the caller's overrides genuinely replacing
// what this process holds: environment names are case-insensitive to Windows
// but not to a JavaScript object. A value of undefined removes the name.
function childEnv(overrides) {
    const env = { ...process.env };
    for (const [key, value] of Object.entries(overrides || {})) {
        for (const existing of Object.keys(env)) {
            if (existing.toLowerCase() === key.toLowerCase()) delete env[existing];
        }
        if (value !== undefined) env[key] = value;
    }
    return env;
}

function runInstaller(args, overrides) {
    return spawnSync('pwsh',
        ['-NoProfile', '-File', INSTALLER].concat(args || []),
        { encoding: 'utf8', env: childEnv(overrides), maxBuffer: 64 * 1024 * 1024 });
}

function makeRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'memdbinstall-'));
}

function rmDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // Best-effort cleanup; a temp directory left behind never fails a test.
    }
}

function outputLines(res) {
    return (res.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
}

// The scripts on disk in the order the installer must apply them: directory
// order fixed, file order ordinal. This is what the Applied lines are pinned
// against, so a new script is counted the moment it lands.
function expectedScriptLabels() {
    const labels = [];
    for (const dir of SCRIPT_DIRECTORIES) {
        const names = fs.readdirSync(path.join(DB_DIR, dir)).filter((n) => n.toLowerCase().endsWith('.sql'));
        names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        for (const name of names) labels.push(dir + '/' + name);
    }
    return labels;
}

function appliedLabels(lines) {
    return lines
        .map((l) => /^Applied ([^:]+): (changed|no change)$/.exec(l))
        .filter(Boolean)
        .map((m) => ({ label: m[1], state: m[2] }));
}

function summaryOf(lines) {
    const m = lines.map((l) => /^Summary: (\d+) script\(s\) applied, (\d+) changed$/.exec(l)).find(Boolean);
    return m ? { applied: Number(m[1]), changed: Number(m[2]) } : null;
}

// A stub sqlcmd for the stub lane. It logs the argument list it was handed,
// whether the two secret-carrying environment variables were set for it, the
// schema version variable, and the text of every batch file it was given, so
// a case reads what the installer actually did rather than what it printed.
// It answers every tag the installer asks for in one canned reply. The login
// presence question is answered "none" the first time it is asked and "all
// five" afterwards, which is the shape of a first install: the installer sees
// five absent logins, generates passwords, and then verifies them present.
// KIT_INSTALL_STUB_VERSION, when set, is what the stub reports as the
// installed schema version. KIT_INSTALL_STUB_FAIL_ON, when set, makes the
// stub exit 1 on the first batch whose text contains it, after logging it,
// which is how a case plants a failure at one named script.
function plantSqlcmdStub(root) {
    const stubPath = path.join(root, 'sqlcmd-stub.cmd');
    const logPath = path.join(root, 'sqlcmd-stub.log');
    const lines = [
        '@echo off',
        'set "LOGF=%KIT_INSTALL_STUB_LOG%"',
        '>>"%LOGF%" echo ARGV %*',
        'if defined SQLCMDPASSWORD (>>"%LOGF%" echo SQLCMDPASSWORD=set) else (>>"%LOGF%" echo SQLCMDPASSWORD=unset)',
        'if defined KitPassword_kit_review (>>"%LOGF%" echo KitPassword_kit_review=set) else (>>"%LOGF%" echo KitPassword_kit_review=unset)',
        'if defined KitSchemaVersion (>>"%LOGF%" echo KitSchemaVersion=%KitSchemaVersion%) else (>>"%LOGF%" echo KitSchemaVersion=unset)',
        'set "BATCH="',
        ':args',
        'if "%~1"=="" goto done',
        'if /I "%~1"=="-i" set "BATCH=%~2"',
        'shift',
        'goto args',
        ':done',
        'if defined BATCH (',
        '  >>"%LOGF%" echo BATCH-START',
        '  type "%BATCH%" >>"%LOGF%"',
        '  >>"%LOGF%" echo.',
        '  >>"%LOGF%" echo BATCH-END',
        // The planted failure leaves the block by goto: cmd cannot nest a
        // conditional block behind && inside another block.
        '  if defined KIT_INSTALL_STUB_FAIL_ON findstr /C:"%KIT_INSTALL_STUB_FAIL_ON%" "%BATCH%" >nul',
        '  if defined KIT_INSTALL_STUB_FAIL_ON if not errorlevel 1 goto planted',
        '  findstr /C:"kitmem-login=" "%BATCH%" >nul && (',
        '    if exist "%LOGF%.logins" (',
        ...KIT_LOGINS.map((l) => '      echo kitmem-login=' + l),
        '    ) else (',
        '      echo stub>"%LOGF%.logins"',
        '    )',
        '  )',
        ')',
        'echo kitmem-fulltext=1',
        'echo kitmem-major=17',
        'echo kitmem-database=absent',
        'if defined KIT_INSTALL_STUB_VERSION (echo kitmem-schemaversion=%KIT_INSTALL_STUB_VERSION%) else (echo kitmem-schemaversion=none)',
        'echo kitmem-digest=0000000000000000000000000000000000000000000000000000000000000000',
        'exit /b 0',
        ':planted',
        'echo Msg 50000, Level 16, State 1: planted failure',
        'exit /b 1',
        ''
    ];
    fs.writeFileSync(stubPath, lines.join('\r\n'), 'utf8');
    return {
        stubPath,
        logPath,
        readLog: () => (fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''),
        env: { KIT_INSTALL_STUB_LOG: logPath }
    };
}

function readLoginsFile(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// The sweep every password takes: the needle must be absent from the text,
// and the same predicate must have matched it somewhere it is known to be,
// or the absence proves nothing.
function assertNeedleAbsent(needle, haystack, holder, what) {
    assert.ok(holder.includes(needle), 'the sweep predicate cannot find the needle where it is known to be');
    assert.ok(!haystack.includes(needle), 'a password reached ' + what);
}

test('stub lane: a first install applies every script in order and keeps every password off the command line and the output', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const loginsPath = path.join(root, 'logins.json');
        // The installing password reaches the installer the one way it
        // accepts: the environment, never an argument.
        const installerPassword = 'sentinel-not-a-credential-' + crypto.randomBytes(8).toString('hex');
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-Login', 'kit_install_stub',
            '-LoginsPath', loginsPath, '-TrustServerCertificate', '-SqlcmdPath', stub.stubPath
        ], Object.assign({ SQLCMDPASSWORD: installerPassword }, stub.env));
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const lines = outputLines(res);
        const log = stub.readLog();
        assert.ok(log.includes('ARGV '), 'the stub was never spawned:\n' + res.stdout + res.stderr);

        // Every script on disk, in the fixed order, and nothing else.
        const expected = expectedScriptLabels();
        assert.ok(expected.length >= 17, 'the four script directories hold fewer scripts than the section delivers: ' + expected.length);
        assert.deepStrictEqual(appliedLabels(lines).map((a) => a.label), expected,
            'the Applied lines must name every script in directory order then ordinal order:\n' + res.stdout);
        assert.deepStrictEqual(summaryOf(lines), { applied: expected.length, changed: 0 }, res.stdout);
        // The logins file is written immediately before the logins script
        // and after every script that precedes it, so a failure earlier in
        // the run leaves no file of passwords that reached no server.
        const writtenAt = lines.indexOf('Logins file: written ' + loginsPath + ' (5 login(s))');
        assert.ok(writtenAt >= 0, res.stdout);
        assert.strictEqual(lines[writtenAt + 1], 'Applied Security/020-Logins.sql: no change', 'the file must be written just before the logins script:\n' + res.stdout);
        assert.ok(lines.slice(0, writtenAt).some((l) => l.startsWith('Applied Procedures/')), 'every procedure script must apply before the file is written:\n' + res.stdout);
        for (const login of KIT_LOGINS) {
            assert.ok(lines.includes('Login ' + login + ': created'), 'no created line for ' + login + ':\n' + res.stdout);
        }

        // The logins file: one entry per login, a 32-character password with
        // every class the policy needs, and no quote or dollar that could
        // break the T-SQL it is substituted into.
        const written = readLoginsFile(loginsPath);
        assert.deepStrictEqual(written.logins.map((e) => e.login), KIT_LOGINS);
        assert.strictEqual(written.database, 'KitMemoryStubTest');
        for (const entry of written.logins) {
            assert.strictEqual(typeof entry.password, 'string');
            assert.strictEqual(entry.password.length, 32, entry.login);
            assert.match(entry.password, /[A-Z]/); assert.match(entry.password, /[a-z]/); assert.match(entry.password, /[0-9]/);
            assert.match(entry.password, /[!#%+\-.:=?@^_~]/);
            assert.doesNotMatch(entry.password, /['"$() `]/);
        }
        assert.strictEqual(written.logins.find((e) => e.login === 'kit_scott_claude').sandbox, 'SCOTT-CLAUDE');
        assert.strictEqual(written.logins.find((e) => e.login === 'kit_curator').role, 'mem_curator');

        // The secrets. The installer's own password and every generated one
        // must be absent from the argument lists, the batch texts and the
        // output, and present in their environment slot.
        const fileText = fs.readFileSync(loginsPath, 'utf8');
        const outputText = res.stdout + res.stderr;
        assertNeedleAbsent(installerPassword, log, installerPassword, 'the sqlcmd command line or a batch');
        assertNeedleAbsent(installerPassword, outputText, installerPassword, 'the output');
        for (const entry of written.logins) {
            assertNeedleAbsent(entry.password, log, fileText, 'the sqlcmd command line or a batch (' + entry.login + ')');
            assertNeedleAbsent(entry.password, outputText, fileText, 'the output (' + entry.login + ')');
        }
        const spawns = log.split(/\r?\n/).filter((l) => l.startsWith('ARGV '));
        assert.ok(spawns.length >= expected.length + 4, 'too few spawns for the scripts plus the reads:\n' + log);
        for (const spawn of spawns) {
            assert.match(spawn, /(^|\s)-U kit_install_stub(\s|$)/, spawn);
            assert.match(spawn, /(^|\s)-N(\s|$)/, spawn);
            assert.match(spawn, /(^|\s)-C(\s|$)/, 'the trust switch must reach every spawn:\n' + spawn);
            assert.match(spawn, /(^|\s)-b(\s|$)/, spawn);
            assert.doesNotMatch(spawn, /(^|\s)-P(\s|$)/, 'a password switch on the command line:\n' + spawn);
            assert.doesNotMatch(spawn, /(^|\s)-E(\s|$)/, spawn);
            assert.doesNotMatch(spawn, /(^|\s)-x(\s|$)/, 'the scripts carry $(Name) references, so -x must be absent:\n' + spawn);
            assert.doesNotMatch(spawn, /(^|\s)-v(\s|$)/, 'a scripting variable on the command line:\n' + spawn);
        }
        assert.strictEqual((log.match(/SQLCMDPASSWORD=set/g) || []).length, spawns.length,
            'the installing password must reach every spawn through its environment:\n' + log);
        assert.strictEqual((log.match(/SQLCMDPASSWORD=unset/g) || []).length, 0, log);
        // The script spawns carry the login passwords and the version; the
        // reads before them do not need to, and the stub records each.
        assert.ok((log.match(/KitPassword_kit_review=set/g) || []).length >= expected.length, log);
        assert.ok((log.match(/KitSchemaVersion=1(\r?\n)/g) || []).length >= expected.length, log);
        // The batches the stub was handed are the scripts themselves.
        assert.ok(log.includes('CREATE SCHEMA mem'), 'Schema/010 never reached sqlcmd:\n' + log.slice(0, 2000));
        assert.ok(log.includes("PASSWORD = N'$(KitPassword_kit_review)'"),
            'the logins script must reach sqlcmd with its variable reference intact for sqlcmd to substitute:\n' + log.slice(-4000));
    } finally {
        rmDir(root);
    }
});

test('stub lane: Windows authentication passes -E, encrypts, trusts no certificate unless asked, and scrubs an ambient SQLCMDPASSWORD', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const loginsPath = path.join(root, 'logins.json');
        // The variable is present in the parent on purpose: the child not
        // seeing it is then the installer's doing and not this case's.
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-LoginsPath', loginsPath, '-SqlcmdPath', stub.stubPath
        ], Object.assign({ SQLCMDPASSWORD: 'ambient-sentinel-not-a-credential' }, stub.env));
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.ok(outputLines(res).includes('Server: 127.0.0.1,1 (Windows authentication)'), res.stdout);
        const spawns = stub.readLog().split(/\r?\n/).filter((l) => l.startsWith('ARGV '));
        assert.ok(spawns.length > 0, 'the stub was never spawned');
        for (const spawn of spawns) {
            assert.match(spawn, /(^|\s)-E(\s|$)/, spawn);
            assert.doesNotMatch(spawn, /(^|\s)-U(\s|$)/, spawn);
            assert.match(spawn, /(^|\s)-N(\s|$)/, 'every connection must ask for encryption, or the CREATE LOGIN batches cross the wire in the clear:\n' + spawn);
            assert.doesNotMatch(spawn, /(^|\s)-C(\s|$)/, 'the connection must not trust any certificate unless asked:\n' + spawn);
        }
        assert.strictEqual((stub.readLog().match(/SQLCMDPASSWORD=unset/g) || []).length, spawns.length,
            'an ambient SQLCMDPASSWORD must be scrubbed from every spawn under Windows authentication:\n' + stub.readLog());
        assert.strictEqual((stub.readLog().match(/SQLCMDPASSWORD=set/g) || []).length, 0, stub.readLog());
    } finally {
        rmDir(root);
    }
});

test('stub lane: SQL authentication with no SQLCMDPASSWORD is refused before any spawn', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-Login', 'kit_install_stub',
            '-LoginsPath', path.join(root, 'logins.json'), '-SqlcmdPath', stub.stubPath
        ], Object.assign({ SQLCMDPASSWORD: undefined }, stub.env));
        assert.notStrictEqual(res.status, 0, 'sqlcmd would prompt on stdin and hang; the installer must refuse instead:\n' + res.stdout + res.stderr);
        assert.ok(outputLines(res).some((l) => l.startsWith('FAIL: ') && l.includes('SQLCMDPASSWORD') && l.includes('kit_install_stub')),
            'the refusal must name the variable and the login:\n' + res.stdout);
        assert.ok(!stub.readLog().includes('ARGV '), 'sqlcmd was spawned with no password source');
    } finally {
        rmDir(root);
    }
});

test('stub lane: a failure before the logins script leaves no logins file behind', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const loginsPath = path.join(root, 'logins.json');
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-LoginsPath', loginsPath, '-SqlcmdPath', stub.stubPath
        ], Object.assign({ KIT_INSTALL_STUB_FAIL_ON: 'CREATE SCHEMA mem' }, stub.env));
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        const lines = outputLines(res);
        assert.ok(lines.some((l) => l.startsWith('FAIL: ') && l.includes('Schema/010-Schema.sql')), 'the refusal must name the failing script:\n' + res.stdout);
        assert.ok(!fs.existsSync(loginsPath), 'a logins file was written for a run that created no login');
        assert.ok(!lines.some((l) => l.startsWith('Logins file: ')), res.stdout);
        // The control is the first stub case, where the same stub without a
        // planted failure writes the file with five entries.
    } finally {
        rmDir(root);
    }
});

test('stub lane: a host holding a newer schema version is refused before any script runs', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const loginsPath = path.join(root, 'logins.json');
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-LoginsPath', loginsPath, '-SqlcmdPath', stub.stubPath
        ], Object.assign({ KIT_INSTALL_STUB_VERSION: '99' }, stub.env));
        assert.notStrictEqual(res.status, 0, 'a newer schema on the host must fail the run:\n' + res.stdout + res.stderr);
        const lines = outputLines(res);
        assert.ok(lines.some((l) => l.startsWith('FAIL: ') && l.includes('SchemaVersion') && /\b99\b/.test(l) && /\b1\b/.test(l)),
            'the refusal must name both versions:\n' + res.stdout);
        assert.strictEqual(appliedLabels(lines).length, 0, 'no script may apply after the refusal:\n' + res.stdout);
        assert.ok(!stub.readLog().includes('CREATE SCHEMA mem'), 'Schema/010 reached sqlcmd despite the refusal');
        assert.ok(!fs.existsSync(loginsPath), 'the logins file was written despite the refusal');

        // The control: the same stub reporting an older version applies the
        // scripts, so the absence above is the gate and not a stub that
        // never hands batches through.
        const okRoot = makeRoot();
        try {
            const okStub = plantSqlcmdStub(okRoot);
            const okRes = runInstaller([
                '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-LoginsPath', path.join(okRoot, 'logins.json'), '-SqlcmdPath', okStub.stubPath
            ], Object.assign({ KIT_INSTALL_STUB_VERSION: '0' }, okStub.env));
            assert.strictEqual(okRes.status, 0, okRes.stdout + okRes.stderr);
            assert.ok(outputLines(okRes).includes('Schema version: carried 1, installed 0'), okRes.stdout);
            assert.ok(okStub.readLog().includes('CREATE SCHEMA mem'), 'an older version must let the scripts through');
        } finally {
            rmDir(okRoot);
        }
    } finally {
        rmDir(root);
    }
});

test('stub lane: an existing logins file is never overwritten, and a run that needs one stops before the server', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const loginsPath = path.join(root, 'logins.json');
        const original = '{"note":"an operator file the installer must not touch"}\n';
        fs.writeFileSync(loginsPath, original, 'utf8');
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-LoginsPath', loginsPath, '-SqlcmdPath', stub.stubPath
        ], stub.env);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        const lines = outputLines(res);
        assert.ok(lines.some((l) => l.startsWith('FAIL: ') && l.includes(loginsPath) && l.includes('kit_review')),
            'the refusal must name the file and the absent logins:\n' + res.stdout);
        assert.strictEqual(fs.readFileSync(loginsPath, 'utf8'), original, 'the file was changed');
        assert.strictEqual(appliedLabels(lines).length, 0, res.stdout);
        assert.ok(!stub.readLog().includes('CREATE SCHEMA mem'), 'a script reached sqlcmd after the refusal');
    } finally {
        rmDir(root);
    }
});

test('stub lane: a database name that is not a plain identifier is refused before any spawn', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', "Kit]; DROP DATABASE master; --", '-LoginsPath', path.join(root, 'logins.json'), '-SqlcmdPath', stub.stubPath
        ], stub.env);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.ok(outputLines(res).some((l) => l.startsWith('FAIL: ') && l.includes('Kit]; DROP DATABASE master; --')), 'the refusal must quote the name it refused:\n' + res.stdout);
        assert.ok(!stub.readLog().includes('ARGV '), 'sqlcmd was spawned with an unscreened database name');
    } finally {
        rmDir(root);
    }
});

test('an unrecognised switch is a hard error, never a run', { skip: !havePwsh }, () => {
    const res = runInstaller(['-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest', '-Bogus']);
    assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
    assert.strictEqual(outputLines(res).length, 0, 'the body must not run on a binding error:\n' + res.stdout);
});

// The live lane's preconditions, each read once per process. The skip reason
// names the first one that fails so a skipped lane says why.
const live = (() => {
    if (!havePwsh) return { skip: 'pwsh is not on this machine' };
    const pinned = path.join(process.env.ProgramFiles || 'C:\\Program Files',
        'Microsoft SQL Server', 'Client SDK', 'ODBC', '170', 'Tools', 'Binn', 'SQLCMD.EXE');
    let sqlcmd = null;
    if (fs.existsSync(pinned)) sqlcmd = pinned;
    else if (spawnSync('sqlcmd', ['-?'], { encoding: 'utf8' }).status === 0) sqlcmd = 'sqlcmd';
    if (!sqlcmd) return { skip: 'sqlcmd is not on this machine' };
    const probe = spawnSync(sqlcmd, ['-S', SERVER, '-E', '-b', '-l', '5', '-h', '-1', '-W',
        '-Q', "SET NOCOUNT ON; SELECT 'kittest-sysadmin=' + CAST(COALESCE(IS_SRVROLEMEMBER('sysadmin'), 0) AS VARCHAR(1))"],
        { encoding: 'utf8' });
    if (probe.status !== 0) return { skip: 'no SQL Server instance answers at ' + SERVER + ' under Windows authentication' };
    if (!/kittest-sysadmin=1/.test(probe.stdout)) return { skip: 'the Windows account is not sysadmin on ' + SERVER + ', so it cannot create logins or impersonate users' };
    return { skip: false, sqlcmd };
})();

// A unit vector along one axis, as the JSON text VECTOR(1024) casts from.
function axisVector(axis) {
    const values = new Array(DIMENSIONS).fill(0);
    values[axis] = 1;
    return '[' + values.join(',') + ']';
}

test('live lane: the installer against the local instance', { skip: live.skip }, async (t) => {
    const root = makeRoot();
    const runId = crypto.randomBytes(4).toString('hex');
    const dbName = 'KitMemoryTest_' + runId;
    const loginsPath = path.join(root, 'logins.json');
    let batchNumber = 0;
    // The logins on the instance before this run touched it. Teardown drops
    // every kit login present afterwards that is not in this list, read from
    // the server rather than from the installer's output, so a run that
    // failed between creating a login and reporting it still cleans up.
    let preExisting = null;

    // A synchronous pause without spawning anything.
    function sleep(ms) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    }

    // A word of random letters only, so the full-text word breaker keeps it
    // whole and no digit boundary splits it into tokens a query never sent.
    function letters(count) {
        const bytes = crypto.randomBytes(count);
        let word = '';
        for (const b of bytes) word += String.fromCharCode(97 + (b % 26));
        return word;
    }

    // One batch as the Windows account. -x keeps any $(...) literal, NOCOUNT
    // keeps the row-count chatter out, and -y 0 keeps a long value on one
    // line up to sqlcmd's own 8000-character ceiling, which json() below
    // refuses to read past. sqlcmd rejects -h and -W beside -y, so header
    // lines are ignored by the tag parser and trailing spaces trimmed here.
    function sql(text, database) {
        batchNumber += 1;
        const file = path.join(root, 'batch-' + batchNumber + '.sql');
        fs.writeFileSync(file, 'SET NOCOUNT ON;\n' + text + '\n', 'utf8');
        const res = spawnSync(live.sqlcmd, ['-S', SERVER, '-E', '-d', database || dbName, '-b', '-I', '-x',
            '-y', '0', '-l', '10', '-i', file],
            { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        const tags = {};
        for (const line of (res.stdout || '').split(/\r?\n/)) {
            const m = /^kittest-([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
            if (m) (tags[m[1]] = tags[m[1]] || []).push(m[2]);
        }
        return { status: res.status, stdout: res.stdout, stderr: res.stderr, tags };
    }
    function sqlOk(text, database) {
        const res = sql(text, database);
        assert.strictEqual(res.status, 0, 'batch failed:\n' + text + '\n' + res.stdout + res.stderr);
        return res;
    }
    // The same batch on a second connection that runs beside the caller's
    // own, for the one case that needs two sessions at once. Resolves with
    // the exit code and the output once sqlcmd exits.
    function sqlConcurrent(text) {
        batchNumber += 1;
        const file = path.join(root, 'batch-' + batchNumber + '.sql');
        fs.writeFileSync(file, 'SET NOCOUNT ON;\n' + text + '\n', 'utf8');
        return new Promise((resolve) => {
            const child = spawn(live.sqlcmd, ['-S', SERVER, '-E', '-d', dbName, '-b', '-I', '-x', '-y', '0', '-l', '10', '-i', file]);
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => { stdout += chunk; });
            child.stderr.on('data', (chunk) => { stderr += chunk; });
            child.on('close', (status) => resolve({ status, stdout, stderr }));
        });
    }
    function one(res, tag) {
        const values = res.tags[tag] || [];
        assert.strictEqual(values.length, 1, 'expected one ' + tag + ' line:\n' + res.stdout + res.stderr);
        return values[0];
    }
    function json(res, tag) {
        const text = one(res, tag);
        assert.ok(text.length < 7990, 'sqlcmd cut a ' + tag + ' value at its 8000-character ceiling, so nothing below can read it');
        return JSON.parse(text);
    }

    // A procedure call, its one-column JSON result captured, or the error
    // that refused it. With a user named, the call runs under EXECUTE AS USER
    // so the permission engine evaluates that user's token; with none, it
    // runs as the connection itself. Either way it goes through sp_executesql
    // so a permission refusal raised at execution is caught by the outer TRY
    // rather than aborting the batch. An EXEC argument must be a constant or
    // a variable, so a parameter that needs an expression (a vector cast from
    // its JSON text) is declared in the prelude the caller passes and named
    // by variable in the argument list.
    function callAs(user, procedure, parameters, prelude) {
        const statement = (prelude || '') + 'EXEC mem.' + procedure + ' ' + parameters;
        const res = sqlOk([
            "DECLARE @t TABLE ([Json] NVARCHAR(MAX));",
            user ? "EXECUTE AS USER = N'" + user + "';" : '',
            'BEGIN TRY',
            "  INSERT INTO @t EXEC sp_executesql N'" + statement.replace(/'/g, "''") + "';",
            "  SELECT 'kittest-json=' + COALESCE([Json], 'null') FROM @t;",
            'END TRY',
            'BEGIN CATCH',
            "  SELECT 'kittest-errnum=' + CAST(ERROR_NUMBER() AS VARCHAR(10));",
            "  SELECT 'kittest-errmsg=' + ERROR_MESSAGE();",
            'END CATCH;',
            user ? 'REVERT;' : ''
        ].join('\n'));
        if (res.tags.errnum) {
            return { error: { number: Number(one(res, 'errnum')), message: one(res, 'errmsg') }, raw: res };
        }
        return { value: json(res, 'json'), raw: res };
    }
    const call = (procedure, parameters, prelude) => callAs(null, procedure, parameters, prelude);

    const serverLogins = () => sqlOk("SELECT 'kittest-login=' + [name] FROM sys.server_principals WHERE [name] IN ("
        + KIT_LOGINS.map((l) => "N'" + l + "'").join(', ') + ");", 'master').tags.login || [];

    try {
        preExisting = serverLogins();
        const installerArgs = ['-Server', SERVER, '-Database', dbName, '-LoginsPath', loginsPath, '-TrustServerCertificate'];

        // Run 1: a fresh database.
        const run1 = runInstaller(installerArgs);
        const lines1 = outputLines(run1);
        assert.strictEqual(run1.status, 0, run1.stdout + run1.stderr);

        await t.test('two consecutive runs both exit 0 and the second applies no change', () => {
            const expected = expectedScriptLabels();
            assert.ok(lines1.includes('Database ' + dbName + ': created'), run1.stdout);
            assert.ok(lines1.includes('Schema version: carried 1, installed none'), run1.stdout);
            const applied1 = appliedLabels(lines1);
            assert.deepStrictEqual(applied1.map((a) => a.label), expected, run1.stdout);
            const summary1 = summaryOf(lines1);
            assert.strictEqual(summary1.applied, expected.length, run1.stdout);
            // The control for the second run's zero: the first run's digest
            // moved on the schema script, so the reading is live.
            assert.ok(summary1.changed > 0, 'a fresh install must read as changed:\n' + run1.stdout);
            assert.strictEqual(applied1[0].state, 'changed', run1.stdout);
            for (const login of KIT_LOGINS) {
                const state = preExisting.includes(login) ? 'present' : 'created';
                assert.ok(lines1.includes('Login ' + login + ': ' + state), 'expected ' + login + ' ' + state + ':\n' + run1.stdout);
            }
            const missingBefore = KIT_LOGINS.filter((l) => !preExisting.includes(l));
            if (missingBefore.length > 0) {
                assert.ok(lines1.includes('Logins file: written ' + loginsPath + ' (' + missingBefore.length + ' login(s))'), run1.stdout);
                assert.deepStrictEqual(readLoginsFile(loginsPath).logins.map((e) => e.login), missingBefore);
            } else {
                assert.ok(lines1.includes('Logins file: not written (every login present)'), run1.stdout);
            }

            const run2 = runInstaller(installerArgs);
            assert.strictEqual(run2.status, 0, run2.stdout + run2.stderr);
            const lines2 = outputLines(run2);
            assert.ok(lines2.includes('Database ' + dbName + ': present'), run2.stdout);
            assert.ok(lines2.includes('Schema version: carried 1, installed 1'), run2.stdout);
            assert.ok(lines2.includes('Logins file: not written (every login present)'), run2.stdout);
            const applied2 = appliedLabels(lines2);
            assert.deepStrictEqual(applied2.map((a) => a.label), expected, run2.stdout);
            assert.ok(applied2.every((a) => a.state === 'no change'), 'a second run must change nothing:\n' + run2.stdout);
            assert.deepStrictEqual(summaryOf(lines2), { applied: expected.length, changed: 0 }, run2.stdout);
            for (const login of KIT_LOGINS) assert.ok(lines2.includes('Login ' + login + ': present'), run2.stdout);

            // The passwords the run wrote reach neither run's output.
            if (fs.existsSync(loginsPath)) {
                const fileText = fs.readFileSync(loginsPath, 'utf8');
                for (const entry of readLoginsFile(loginsPath).logins) {
                    assert.strictEqual(entry.password.length, 32);
                    assertNeedleAbsent(entry.password, run1.stdout + run1.stderr + run2.stdout + run2.stderr, fileText, 'the installer output');
                }
            }
        });

        await t.test('a newer schema version on the host refuses the run and leaves the schema alone', () => {
            sqlOk("INSERT INTO mem.SchemaVersion ([Version], [Notes]) VALUES (99, N'planted by the test');");
            const refused = runInstaller(installerArgs);
            assert.notStrictEqual(refused.status, 0, refused.stdout + refused.stderr);
            const lines = outputLines(refused);
            assert.ok(lines.some((l) => l.startsWith('FAIL: ') && l.includes('SchemaVersion') && /\b99\b/.test(l) && /\b1\b/.test(l)), refused.stdout);
            assert.strictEqual(appliedLabels(lines).length, 0, refused.stdout);
            sqlOk('DELETE FROM mem.SchemaVersion WHERE [Version] = 99;');
            // The control: with the planted row gone the same run passes and
            // still changes nothing.
            const again = runInstaller(installerArgs);
            assert.strictEqual(again.status, 0, again.stdout + again.stderr);
            assert.deepStrictEqual(summaryOf(outputLines(again)), { applied: expectedScriptLabels().length, changed: 0 }, again.stdout);
        });

        await t.test('the role roster is exactly the spec\'s', () => {
            const res = sqlOk([
                // The permission columns carry the catalog collation, which
                // differs from the database's, so every piece is coerced.
                "SELECT 'kittest-exec=' + PR.[name] COLLATE DATABASE_DEFAULT + ':' + OBJECT_NAME(P.[major_id]) COLLATE DATABASE_DEFAULT",
                'FROM sys.database_permissions P INNER JOIN sys.database_principals PR ON PR.[principal_id] = P.[grantee_principal_id]',
                "WHERE P.[class] = 1 AND P.[permission_name] = 'EXECUTE' AND P.[state] = 'G' AND PR.[name] LIKE 'mem[_]%'",
                'ORDER BY PR.[name], OBJECT_NAME(P.[major_id]);',
                "SELECT 'kittest-schema=' + PR.[name] COLLATE DATABASE_DEFAULT + ':' + P.[state] COLLATE DATABASE_DEFAULT + ':' + P.[permission_name] COLLATE DATABASE_DEFAULT",
                'FROM sys.database_permissions P INNER JOIN sys.database_principals PR ON PR.[principal_id] = P.[grantee_principal_id]',
                "WHERE P.[class] = 3 AND SCHEMA_NAME(P.[major_id]) = 'mem' AND PR.[name] LIKE 'mem[_]%'",
                'ORDER BY PR.[name], P.[state], P.[permission_name];',
                "SELECT 'kittest-member=' + R.[name] COLLATE DATABASE_DEFAULT + '>' + M.[name] COLLATE DATABASE_DEFAULT",
                'FROM sys.database_role_members RM INNER JOIN sys.database_principals R ON R.[principal_id] = RM.[role_principal_id]',
                'INNER JOIN sys.database_principals M ON M.[principal_id] = RM.[member_principal_id]',
                "WHERE M.[name] LIKE 'kit[_]%' ORDER BY M.[name], R.[name];"
            ].join('\n'));
            // The publisher roster as the plan amends it: the seven the
            // section first named plus usp_AppendPublishRun and
            // usp_UpsertIndexOrphans, the writers for the mem.PublishRun and
            // mem.IndexOrphan rows that section 3 publishes under this same
            // execute-only login (docs/plans/claude-kit_memory-database_spec_v1.md).
            const publisherProcs = ['usp_AppendOutcomes', 'usp_AppendPublishRun', 'usp_AppendUsage', 'usp_Health', 'usp_Nearest',
                'usp_Search', 'usp_UpsertEmbeddings', 'usp_UpsertIndexOrphans', 'usp_UpsertRecords'];
            const curatorProcs = ['usp_CurationOrphans', 'usp_CurationSupersededLive', 'usp_CurationUnapplied', 'usp_Health', 'usp_PromoteRecord'];
            assert.deepStrictEqual(res.tags.exec,
                curatorProcs.map((p) => 'mem_curator:' + p).concat(publisherProcs.map((p) => 'mem_publisher:' + p)),
                'the EXECUTE grants drifted from the spec roster:\n' + res.stdout);
            assert.deepStrictEqual(res.tags.schema, [
                'mem_curator:D:DELETE', 'mem_curator:D:INSERT', 'mem_curator:D:SELECT', 'mem_curator:D:UPDATE',
                'mem_publisher:D:DELETE', 'mem_publisher:D:INSERT', 'mem_publisher:D:SELECT', 'mem_publisher:D:UPDATE',
                'mem_review:D:DELETE', 'mem_review:D:EXECUTE', 'mem_review:D:INSERT', 'mem_review:D:UPDATE', 'mem_review:G:SELECT'
            ], res.stdout);
            assert.deepStrictEqual(res.tags.member, [
                'mem_publisher>kit_asr_claude', 'mem_curator>kit_curator', 'mem_publisher>kit_neo_claude',
                'mem_review>kit_review', 'mem_publisher>kit_scott_claude'
            ], 'each kit login sits in exactly one role:\n' + res.stdout);
        });

        // The seed: three records in three stores, each with one embedding
        // along its own axis and a description holding a common word plus a
        // private token this file never hands to any query.
        const common = 'kitword' + letters(8);
        const tokens = { neoPrivate: 'neoprivate' + letters(8), neoShared: 'neoshared' + letters(8), scottPrivate: 'scottprivate' + letters(8) };
        const segment = 'seg-' + runId;
        const seed = sqlOk([
            "DECLARE @neo INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'NEO-CLAUDE');",
            "DECLARE @scott INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'SCOTT-CLAUDE');",
            "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (@neo, 'project', N'" + segment + "');",
            'DECLARE @neoStore INT = SCOPE_IDENTITY();',
            "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (@scott, 'project', N'" + segment + "');",
            'DECLARE @scottStore INT = SCOPE_IDENTITY();',
            "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (NULL, 'type', N'type-" + runId + "');",
            'DECLARE @typeStore INT = SCOPE_IDENTITY();',
            'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId])',
            "VALUES (@neoStore, N'neo-private-" + runId + "', N'neo-private.md', N'" + common + " " + tokens.neoPrivate + " note', N'body " + tokens.neoPrivate + "', 'h1', 'private', @neo);",
            'DECLARE @neoPrivate BIGINT = SCOPE_IDENTITY();',
            'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId])',
            "VALUES (@typeStore, N'neo-shared-" + runId + "', N'neo-shared.md', N'" + common + " " + tokens.neoShared + " note', N'body " + tokens.neoShared + "', 'h2', 'shared', @neo);",
            'DECLARE @neoShared BIGINT = SCOPE_IDENTITY();',
            'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId])',
            "VALUES (@scottStore, N'scott-private-" + runId + "', N'scott-private.md', N'" + common + " " + tokens.scottPrivate + " note', N'body " + tokens.scottPrivate + "', 'h3', 'private', @scott);",
            'DECLARE @scottPrivate BIGINT = SCOPE_IDENTITY();',
            'INSERT INTO mem.Embedding ([RecordId], [ChunkIndex], [ModelIdentity], [ChunkOffset], [ChunkLength], [Vector], [Dimensions])',
            "VALUES (@neoShared, 0, 'test-model', 0, 4, CAST(N'" + axisVector(0) + "' AS VECTOR(" + DIMENSIONS + ")), " + DIMENSIONS + "),",
            "       (@scottPrivate, 0, 'test-model', 0, 4, CAST(N'" + axisVector(1) + "' AS VECTOR(" + DIMENSIONS + ")), " + DIMENSIONS + "),",
            "       (@neoPrivate, 0, 'test-model', 0, 4, CAST(N'" + axisVector(2) + "' AS VECTOR(" + DIMENSIONS + ")), " + DIMENSIONS + ");",
            "SELECT 'kittest-neo=' + CAST(@neo AS VARCHAR(10));",
            "SELECT 'kittest-scott=' + CAST(@scott AS VARCHAR(10));",
            "SELECT 'kittest-neoPrivate=' + CAST(@neoPrivate AS VARCHAR(20));",
            "SELECT 'kittest-neoShared=' + CAST(@neoShared AS VARCHAR(20));",
            "SELECT 'kittest-scottPrivate=' + CAST(@scottPrivate AS VARCHAR(20));",
            "SELECT 'kittest-me=' + ORIGINAL_LOGIN();"
        ].join('\n'));
        const ids = {
            neo: Number(one(seed, 'neo')), scott: Number(one(seed, 'scott')),
            neoPrivate: Number(one(seed, 'neoPrivate')), neoShared: Number(one(seed, 'neoShared')), scottPrivate: Number(one(seed, 'scottPrivate'))
        };
        // The login this lane's connections open as, read from the server.
        const me = one(seed, 'me');
        const idsOf = (rows) => rows.map((r) => r.recordId);

        // Points the connection's own login at one sandbox row, or at none,
        // and reads back which row now names it. The publisher rows are
        // reset to their kit logins first, since [PublisherLogin] is unique.
        function mapConnection(sandbox) {
            const res = sqlOk([
                "UPDATE mem.Sandbox SET [PublisherLogin] = N'kit_scott_claude' WHERE [Name] = N'SCOTT-CLAUDE';",
                "UPDATE mem.Sandbox SET [PublisherLogin] = N'kit_neo_claude' WHERE [Name] = N'NEO-CLAUDE';",
                sandbox ? "UPDATE mem.Sandbox SET [PublisherLogin] = N'" + me.replace(/'/g, "''") + "' WHERE [Name] = N'" + sandbox + "';" : '',
                "SELECT 'kittest-mapped=' + COALESCE((SELECT [Name] FROM mem.Sandbox WHERE [PublisherLogin] = ORIGINAL_LOGIN() COLLATE DATABASE_DEFAULT), 'none');"
            ].join('\n'));
            assert.strictEqual(one(res, 'mapped'), sandbox || 'none', 'the connection login must map where the case put it');
        }
        // The prelude declaring @v as the unit vector along one axis.
        const vectorPrelude = (axis) => 'DECLARE @v VECTOR(' + DIMENSIONS + ") = CAST(N'" + axisVector(axis) + "' AS VECTOR(" + DIMENSIONS + ')); ';
        const searchParams = "@p_QueryVector = @v, @p_ModelIdentity = 'test-model', @p_Limit = 10";
        const nearestParams = "@p_Vector = @v, @p_ModelIdentity = 'test-model', @p_Limit = 10";

        await t.test('usp_Search as SCOTT never returns NEO\'s private row and always returns its shared row', () => {
            // Vector list: the query vector is the shared row's own axis, and
            // the two private rows sit at equal distance from it, so every
            // visible row ranks and the withheld one can only be absent by
            // the tenancy filter. The connection is SCOTT's publisher by data.
            mapConnection('SCOTT-CLAUDE');
            const scott = call('usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!scott.error, JSON.stringify(scott.error));
            const scottIds = idsOf(scott.value);
            assert.ok(scottIds.includes(ids.neoShared), 'the shared row is missing from SCOTT\'s result: ' + JSON.stringify(scott.value));
            assert.ok(scottIds.includes(ids.scottPrivate), 'SCOTT\'s own private row is missing: ' + JSON.stringify(scott.value));
            assert.ok(!scottIds.includes(ids.neoPrivate), 'TENANCY LEAK: NEO\'s private row reached SCOTT: ' + JSON.stringify(scott.value));
            assert.ok(!JSON.stringify(scott.value).includes(tokens.neoPrivate), 'TENANCY LEAK: NEO\'s private token reached SCOTT');
            assert.strictEqual(scott.value.find((r) => r.recordId === ids.neoShared).sandbox, 'NEO-CLAUDE');
            assert.strictEqual(scott.value.find((r) => r.recordId === ids.neoShared).vectorLiveRank, 1);
            assert.strictEqual(scott.value.find((r) => r.recordId === ids.neoShared).visibility, 'shared');

            // The control, withheld from the predicate above: the same
            // connection re-pointed at NEO does get that row, so its absence
            // for SCOTT is the filter and not a row no query can reach.
            mapConnection('NEO-CLAUDE');
            const neo = call('usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!neo.error, JSON.stringify(neo.error));
            assert.ok(idsOf(neo.value).includes(ids.neoPrivate), 'NEO cannot see its own private row: ' + JSON.stringify(neo.value));
            assert.ok(!idsOf(neo.value).includes(ids.scottPrivate), 'TENANCY LEAK: SCOTT\'s private row reached NEO');
            assert.ok(!JSON.stringify(neo.value).includes(tokens.scottPrivate), 'TENANCY LEAK: SCOTT\'s private token reached NEO');
        });

        await t.test('impersonating another sandbox\'s user does not move tenancy', () => {
            // The guard ORIGINAL_LOGIN() exists for: with the connection
            // mapped to SCOTT, a call that runs as NEO's database user still
            // reads as SCOTT. NEO's private row stays absent and SCOTT's own
            // private row is served, and the log row pairs the two logins.
            mapConnection('SCOTT-CLAUDE');
            const asNeo = callAs('kit_neo_claude', 'usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!asNeo.error, JSON.stringify(asNeo.error));
            assert.ok(!idsOf(asNeo.value).includes(ids.neoPrivate), 'TENANCY MOVED: impersonating NEO\'s user served NEO\'s private row: ' + JSON.stringify(asNeo.value));
            assert.ok(idsOf(asNeo.value).includes(ids.scottPrivate), 'the connection\'s own sandbox must still be served: ' + JSON.stringify(asNeo.value));
            const logged = sqlOk("SELECT TOP (1) 'kittest-log=' + [Login] + '|' + [SessionLogin] + '|' + CAST(COALESCE([SandboxId], -1) AS VARCHAR(10)) FROM mem.QueryLog ORDER BY [QueryLogId] DESC;");
            assert.strictEqual(one(logged, 'log'), me + '|kit_neo_claude|' + ids.scott, 'the log must name the resolved login and the impersonated context');
        });

        await t.test('usp_Search over the full-text lists holds the same line', () => {
            // Population is asynchronous under CHANGE_TRACKING AUTO, so the
            // lexical query is retried until the mapped sandbox gets at
            // least the two rows it may see, with a bound that fails loudly.
            // A leak (a third row) also ends the wait and fails the exact
            // sets below.
            const lexical = "@p_QueryText = N'" + common + "', @p_Limit = 10";
            const deadline = Date.now() + 90000;
            function lexicalAs(sandbox) {
                mapConnection(sandbox);
                for (;;) {
                    const res = call('usp_Search', lexical);
                    assert.ok(!res.error, JSON.stringify(res.error));
                    if (res.value.length >= 2) return res.value;
                    if (Date.now() > deadline) {
                        const state = sqlOk("SELECT 'kittest-ft=' + CAST(FULLTEXTCATALOGPROPERTY('KitMemoryCatalog', 'PopulateStatus') AS VARCHAR(10)) + ':' + CAST(OBJECTPROPERTYEX(OBJECT_ID('mem.Record'), 'TableFullTextPendingChanges') AS VARCHAR(10));");
                        assert.fail('the full-text index did not serve the seeded rows to ' + sandbox + ' within 90 s (PopulateStatus:PendingChanges = ' + one(state, 'ft') + '): ' + JSON.stringify(res.value));
                    }
                    sleep(1000);
                }
            }
            const neo = lexicalAs('NEO-CLAUDE');
            assert.deepStrictEqual(idsOf(neo).sort(), [ids.neoPrivate, ids.neoShared].sort(),
                'TENANCY LEAK or missing row on NEO\'s lexical path: ' + JSON.stringify(neo));
            assert.ok(neo.every((r) => r.descriptionRank !== null), 'the description list must have voted: ' + JSON.stringify(neo));
            assert.ok(!JSON.stringify(neo).includes(tokens.scottPrivate), 'TENANCY LEAK: SCOTT\'s private token reached NEO');
            const scott = lexicalAs('SCOTT-CLAUDE');
            assert.deepStrictEqual(idsOf(scott).sort(), [ids.neoShared, ids.scottPrivate].sort(),
                'TENANCY LEAK or missing row on SCOTT\'s lexical path: ' + JSON.stringify(scott));
            assert.ok(!JSON.stringify(scott).includes(tokens.neoPrivate), 'TENANCY LEAK: NEO\'s private token reached SCOTT');

            // Token hygiene: a query of ASCII punctuation alone has nothing
            // to search and returns no rows and no error, while punctuation
            // around a real word is stripped from the predicate's reach.
            const noise = call('usp_Search', "@p_QueryText = N'!!! ,,, ... ---'");
            assert.ok(!noise.error, JSON.stringify(noise.error));
            assert.deepStrictEqual(noise.value, []);
            const wrapped = call('usp_Search', "@p_QueryText = N'--- " + common + " ***'");
            assert.ok(!wrapped.error, JSON.stringify(wrapped.error));
            assert.deepStrictEqual(idsOf(wrapped.value).sort(), [ids.neoShared, ids.scottPrivate].sort(), JSON.stringify(wrapped.value));

            // A query of stopwords alone reaches the engine as a predicate,
            // which answers with an empty set and a severity-10 informational
            // ("contained noise word(s)") that sqlcmd -b does not read as an
            // error, so the call succeeds with no rows.
            const stopwords = call('usp_Search', "@p_QueryText = N'the a of'");
            assert.ok(!stopwords.error, 'a stopword-only query raised: ' + JSON.stringify(stopwords.error));
            assert.deepStrictEqual(stopwords.value, []);

            // A token carrying a double quote is doubled inside its phrase,
            // which the engine accepts as an escape rather than raising 7630,
            // and the real word beside it still matches.
            const quoted = call('usp_Search', "@p_QueryText = N'kit\"word " + common + "'");
            assert.ok(!quoted.error, 'a token carrying a double quote raised: ' + JSON.stringify(quoted.error));
            assert.deepStrictEqual(idsOf(quoted.value).sort(), [ids.neoShared, ids.scottPrivate].sort(), JSON.stringify(quoted.value));
        });

        await t.test('usp_Nearest filters both directions', () => {
            mapConnection('SCOTT-CLAUDE');
            const scott = call('usp_Nearest', nearestParams, vectorPrelude(2));
            assert.ok(!scott.error, JSON.stringify(scott.error));
            const scottIds = idsOf(scott.value);
            assert.ok(!scottIds.includes(ids.neoPrivate), 'TENANCY LEAK: NEO\'s private row reached SCOTT on the nearest path, though it is the nearest of all: ' + JSON.stringify(scott.value));
            assert.ok(scottIds.includes(ids.neoShared) && scottIds.includes(ids.scottPrivate), JSON.stringify(scott.value));
            mapConnection('NEO-CLAUDE');
            const neo = call('usp_Nearest', nearestParams, vectorPrelude(2));
            assert.ok(!neo.error, JSON.stringify(neo.error));
            assert.strictEqual(neo.value[0].recordId, ids.neoPrivate, 'NEO\'s own private row is the nearest and must come first: ' + JSON.stringify(neo.value));
            assert.ok(Math.abs(neo.value[0].distance) < 1e-6, 'a row on the query axis must be at cosine distance zero within float32: ' + neo.value[0].distance);
            assert.ok(!idsOf(neo.value).includes(ids.scottPrivate), 'TENANCY LEAK: SCOTT\'s private row reached NEO');
        });

        await t.test('a login mapped to no sandbox gets no rows, never every row', () => {
            // The connection's login names no sandbox row, which is the
            // natural state of a sysadmin connection and the shape of a
            // misconfigured or hostile caller; it can execute anything.
            mapConnection(null);
            const rows = sqlOk("SELECT 'kittest-rows=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Sandbox WHERE [PublisherLogin] = ORIGINAL_LOGIN() COLLATE DATABASE_DEFAULT;");
            assert.strictEqual(one(rows, 'rows'), '0', 'the predicate must match no sandbox row for this login');
            for (const [procedure, parameters, prelude] of [['usp_Search', searchParams, vectorPrelude(0)],
                ['usp_Search', "@p_QueryText = N'" + common + "'", ''], ['usp_Nearest', '@p_Vector = @v', vectorPrelude(0)]]) {
                const res = call(procedure, parameters, prelude);
                assert.ok(!res.error, procedure + ': ' + JSON.stringify(res.error));
                assert.deepStrictEqual(res.value, [], procedure + ' served rows to an unmapped login: ' + JSON.stringify(res.value));
            }
            const direct = sqlOk("SELECT 'kittest-visible=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.udf_VisibleRecords(NULL);");
            assert.strictEqual(one(direct, 'visible'), '0', 'the shared predicate must fail closed on a null sandbox');
            // The control: the same predicate for a real sandbox returns rows.
            const control = sqlOk("SELECT 'kittest-visible=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.udf_VisibleRecords(" + ids.scott + ");");
            assert.ok(Number(one(control, 'visible')) >= 2, control.stdout);
        });

        await t.test('a publisher can execute usp_UpsertRecords and cannot SELECT from mem.Record', () => {
            // The gates here are permissions, evaluated on the impersonated
            // user's token; the sandbox every write lands in is still the
            // connection's, mapped to SCOTT.
            mapConnection('SCOTT-CLAUDE');
            const denied = sqlOk([
                "EXECUTE AS USER = N'kit_scott_claude';",
                'BEGIN TRY',
                "  EXEC sp_executesql N'SELECT TOP (1) [RecordId] FROM mem.Record';",
                "  SELECT 'kittest-select=allowed';",
                'END TRY',
                'BEGIN CATCH',
                "  SELECT 'kittest-errnum=' + CAST(ERROR_NUMBER() AS VARCHAR(10));",
                "  SELECT 'kittest-errmsg=' + ERROR_MESSAGE();",
                'END CATCH;',
                'REVERT;'
            ].join('\n'));
            assert.ok(!denied.tags.select, 'the publisher read mem.Record directly:\n' + denied.stdout);
            assert.strictEqual(one(denied, 'errnum'), '229', denied.stdout);
            assert.ok(one(denied, 'errmsg').includes('Record'), 'the refusal must name the object:\n' + denied.stdout);

            // The control for the refusal: the review login, granted SELECT
            // on the schema, reads the same table through the same path.
            const allowed = sqlOk([
                "EXECUTE AS USER = N'kit_review';",
                "EXEC sp_executesql N'SELECT ''kittest-count='' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record';",
                'REVERT;'
            ].join('\n'));
            assert.ok(Number(one(allowed, 'count')) >= 3, allowed.stdout);

            // The lexical path under a publisher token. This settles whether
            // the publisher's schema-level DENY SELECT reaches the
            // CONTAINSTABLE inside usp_Search: it does not. CONTAINSTABLE
            // resolves on the ownership chain like a table reference (the
            // procedure and mem.Record are both dbo-owned, no module carries
            // EXECUTE AS), so the call returns rows under the publisher's
            // token rather than the 229 the same token gets on a direct
            // SELECT above. A direct-connection case cannot show this, since
            // the connection is sysadmin. The rows are the seeded ones the
            // lexical case above already waited for.
            const lexicalAsPublisher = callAs('kit_scott_claude', 'usp_Search', "@p_QueryText = N'" + common + "', @p_Limit = 10");
            assert.ok(!lexicalAsPublisher.error, 'the full-text list refused a publisher token, so the DENY reaches CONTAINSTABLE: ' + JSON.stringify(lexicalAsPublisher.error));
            assert.deepStrictEqual(idsOf(lexicalAsPublisher.value).sort(), [ids.neoShared, ids.scottPrivate].sort(),
                'the lexical result under a publisher token must match the connection\'s own: ' + JSON.stringify(lexicalAsPublisher.value));
            assert.ok(lexicalAsPublisher.value.every((r) => r.descriptionRank !== null), JSON.stringify(lexicalAsPublisher.value));

            // A batch naming one file key twice keeps its last entry: one
            // row added, carrying the later description.
            const twice = [
                { tier: 'project', segment: 'seg-dup-' + runId, name: 'dup-' + runId, fileKey: 'dup.md', description: 'first', body: 'b', bodyHash: 'h5', archived: false },
                { tier: 'project', segment: 'seg-dup-' + runId, name: 'dup-' + runId, fileKey: 'dup.md', description: 'last', body: 'b', bodyHash: 'h6', archived: false }
            ];
            const dup = callAs('kit_scott_claude', 'usp_UpsertRecords', "@p_Records = N'" + JSON.stringify(twice) + "'");
            assert.ok(!dup.error, 'a batch naming one key twice must not throw: ' + JSON.stringify(dup.error));
            assert.deepStrictEqual(dup.value, { added: 1, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0 });
            const dupRow = sqlOk("SELECT 'kittest-dup=' + [Description] + ':' + [BodyHash] FROM mem.Record WHERE [Name] = N'dup-" + runId + "';");
            assert.strictEqual(one(dupRow, 'dup'), 'last:h6', 'the last entry for a key must win');

            const record = {
                tier: 'project', segment: 'seg-up-' + runId, name: 'up-' + runId, fileKey: 'up.md',
                description: 'published through the procedure ' + runId, body: 'body', bodyHash: 'h4',
                fileModified: '2026-09-17T12:00:00Z', machine: 'TEST', tags: ['t'], supersedes: null, archived: false
            };
            const upsert = callAs('kit_scott_claude', 'usp_UpsertRecords', "@p_Records = N'" + JSON.stringify([record]) + "'");
            assert.ok(!upsert.error, JSON.stringify(upsert.error));
            assert.deepStrictEqual(upsert.value, { added: 1, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0 });
            const row = sqlOk([
                "SELECT 'kittest-row=' + CAST(R.[RecordId] AS VARCHAR(20)) + ':' + R.[Visibility] + ':' + COALESCE(R.[Author], '<null>') + ':' + CAST(S.[SandboxId] AS VARCHAR(10))",
                "FROM mem.Record R INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId] WHERE R.[Name] = N'" + record.name + "';"
            ].join('\n'));
            const parts = one(row, 'row').split(':');
            assert.strictEqual(parts[1], 'private', 'a project record publishes private');
            assert.strictEqual(parts[2], '<null>', 'Author stays null');
            assert.strictEqual(Number(parts[3]), ids.scott, 'the record lands in the caller\'s own store');
            const upId = Number(parts[0]);

            const embed = callAs('kit_scott_claude', 'usp_UpsertEmbeddings', "@p_Embeddings = N'" + JSON.stringify([
                { recordId: upId, chunkIndex: 0, chunkOffset: 0, chunkLength: 4, vector: JSON.parse(axisVector(3)), model: 'test-model', dimensions: DIMENSIONS }
            ]) + "'");
            assert.ok(!embed.error, JSON.stringify(embed.error));
            assert.deepStrictEqual(embed.value, { inserted: 1, updated: 0, rejected: 0 });
            const before = call('usp_Nearest', "@p_Vector = @v, @p_ModelIdentity = 'test-model'", vectorPrelude(3));
            assert.ok(!before.error && before.value[0] && before.value[0].recordId === upId, 'the published row must be readable before removal: ' + JSON.stringify(before));

            // Removal is a soft mark, and the marked row is served by no read.
            const removed = callAs('kit_scott_claude', 'usp_UpsertRecords', "@p_Records = N'[]', @p_Removed = N'" + JSON.stringify([{ segment: record.segment, fileKey: record.fileKey }]) + "'");
            assert.ok(!removed.error, JSON.stringify(removed.error));
            assert.strictEqual(removed.value.removed, 1, JSON.stringify(removed.value));
            const marked = sqlOk("SELECT 'kittest-deleted=' + CASE WHEN [DeletedDt] IS NULL THEN 'null' ELSE 'set' END FROM mem.Record WHERE [RecordId] = " + upId + ';');
            assert.strictEqual(one(marked, 'deleted'), 'set', 'the row must still exist, marked deleted');
            const after = call('usp_Nearest', "@p_Vector = @v, @p_ModelIdentity = 'test-model'", vectorPrelude(3));
            assert.ok(!after.error, JSON.stringify(after.error));
            assert.ok(!idsOf(after.value).includes(upId), 'a deleted-marked row was served: ' + JSON.stringify(after.value));
            const visible = sqlOk("SELECT 'kittest-visible=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.udf_VisibleRecords(" + ids.scott + ") V WHERE V.[RecordId] = " + upId + ';');
            assert.strictEqual(one(visible, 'visible'), '0', 'the shared predicate still serves a deleted-marked row');
        });

        await t.test('publishes serialize on the fleet publish lock', async () => {
            // The holder is a second session that takes the application lock
            // both upsert procedures take, mem.Publish, inside its own
            // transaction, holds it for five seconds and touches no row. A
            // publish started while it is held has nothing to wait on but
            // that lock, so its elapsed time is the pin: a procedure that
            // took no lock returns at once against a holder that wrote
            // nothing, and one that takes it waits until the holder commits.
            mapConnection('SCOTT-CLAUDE');
            const holder = sqlConcurrent([
                'BEGIN TRANSACTION;',
                "DECLARE @r INT; EXEC @r = sp_getapplock @Resource = 'mem.Publish', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;",
                "SELECT 'kittest-held=' + CAST(@r AS VARCHAR(10));",
                "WAITFOR DELAY '00:00:05';",
                'COMMIT;'
            ].join('\n'));
            sleep(2000);
            const started = Date.now();
            const record = { tier: 'project', segment: 'seg-lock-' + runId, name: 'lock-' + runId, fileKey: 'lock.md', description: 'held', body: 'b', bodyHash: 'h7', archived: false };
            const published = callAs('kit_scott_claude', 'usp_UpsertRecords', "@p_Records = N'" + JSON.stringify([record]) + "'");
            const waited = Date.now() - started;
            const held = await holder;
            assert.strictEqual(held.status, 0, held.stdout + held.stderr);
            assert.ok(/kittest-held=[01](\r?\n|$)/.test(held.stdout), 'the holder never took the lock: ' + held.stdout + held.stderr);
            assert.ok(!published.error, JSON.stringify(published.error));
            assert.deepStrictEqual(published.value, { added: 1, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0 });
            assert.ok(waited >= 2000, 'the publish returned in ' + waited + ' ms while the publish lock was held, so it took no lock');
        });

        await t.test('usp_PromoteRecord fails for a publisher and succeeds for the curator', () => {
            const promote = "@p_SandboxName = N'NEO-CLAUDE', @p_Segment = N'" + segment + "', @p_Name = N'neo-private-" + runId + "'";
            const publisher = callAs('kit_scott_claude', 'usp_PromoteRecord', promote);
            assert.ok(publisher.error, 'a publisher promoted a record: ' + JSON.stringify(publisher.value));
            assert.strictEqual(publisher.error.number, 229, publisher.error.message);
            assert.ok(publisher.error.message.includes('usp_PromoteRecord'), publisher.error.message);

            // The inner gate, reached by a user who holds EXECUTE on the
            // procedure and no curator membership: a grant to the wrong role
            // in a later script still refuses.
            sqlOk("CREATE USER [kit_test_inner_gate] WITHOUT LOGIN; GRANT EXECUTE ON OBJECT::mem.usp_PromoteRecord TO [kit_test_inner_gate]; GRANT EXECUTE ON OBJECT::mem.usp_Search TO [kit_test_inner_gate];");
            const inner = callAs('kit_test_inner_gate', 'usp_PromoteRecord', promote);
            assert.ok(inner.error, 'the inner gate let a non-curator through: ' + JSON.stringify(inner.value));
            assert.strictEqual(inner.error.number, 50000, inner.error.message);
            assert.ok(inner.error.message.includes('mem_curator'), inner.error.message);
            const still = sqlOk("SELECT 'kittest-vis=' + [Visibility] FROM mem.Record WHERE [RecordId] = " + ids.neoPrivate + ';');
            assert.strictEqual(one(still, 'vis'), 'private', 'a refused promotion must change nothing');

            // A user without a login is a context SUSER_SNAME() names by SID
            // text rather than by login (S-1-9-3-...), and the query log must
            // take its row whatever that function yields: the search must
            // succeed, the row must name the connection login as its login,
            // and its session column must be filled and differ from it.
            const loginless = callAs('kit_test_inner_gate', 'usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!loginless.error, 'a search under a user without login failed: ' + JSON.stringify(loginless.error));
            const loginlessRow = sqlOk("SELECT TOP (1) 'kittest-session=' + [SessionLogin] + '|' + [Login] FROM mem.QueryLog ORDER BY [QueryLogId] DESC;");
            const [session, login] = one(loginlessRow, 'session').split('|');
            assert.strictEqual(login, me, 'the log row must carry the connection login');
            assert.ok(session.length > 0 && session !== me, 'the session column must name the impersonated context, not the connection: ' + session);

            // The review login: SELECT everywhere, EXECUTE nowhere.
            const review = callAs('kit_review', 'usp_Search', searchParams, vectorPrelude(0));
            assert.ok(review.error && review.error.number === 229, 'the review login executed a read procedure: ' + JSON.stringify(review));

            // A shared tier holds no private row, so the tier is refused by
            // name rather than searched and reported as no match.
            const sharedTier = callAs('kit_curator', 'usp_PromoteRecord', promote + ", @p_Tier = 'type'");
            assert.ok(sharedTier.error && sharedTier.error.number === 50000 && sharedTier.error.message.includes('project'),
                'a non-project tier must be refused by name: ' + JSON.stringify(sharedTier));

            const curator = callAs('kit_curator', 'usp_PromoteRecord', promote);
            assert.ok(!curator.error, JSON.stringify(curator.error));
            assert.deepStrictEqual(curator.value, { recordId: ids.neoPrivate, name: 'neo-private-' + runId, visibility: 'shared' });
            // A promoted row is now a shared row, and SCOTT sees it.
            mapConnection('SCOTT-CLAUDE');
            const scott = call('usp_Search', searchParams, vectorPrelude(2));
            assert.ok(!scott.error, JSON.stringify(scott.error));
            assert.ok(idsOf(scott.value).includes(ids.neoPrivate), 'the promoted row must reach SCOTT: ' + JSON.stringify(scott.value));
            // And the curator cannot publish.
            const curatorWrite = callAs('kit_curator', 'usp_UpsertRecords', "@p_Records = N'[]'");
            assert.ok(curatorWrite.error && curatorWrite.error.number === 229, 'the curator executed a publish procedure: ' + JSON.stringify(curatorWrite));
        });

        await t.test('a usp_Search call leaves one mem.QueryLog row, read back under the review login', () => {
            const readLog = () => sqlOk([
                "EXECUTE AS USER = N'kit_review';",
                "EXEC sp_executesql N'SELECT ''kittest-count='' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.QueryLog';",
                "EXEC sp_executesql N'SELECT TOP (1) ''kittest-last='' + [ProcedureName] + '':'' + [Login] + '':'' + [SessionLogin] + '':'' + CAST(COALESCE([SandboxId], -1) AS VARCHAR(10)) + '':'' + CAST([RowCount] AS VARCHAR(10)) + '':'' + [ParametersDigest] FROM mem.QueryLog ORDER BY [QueryLogId] DESC';",
                'REVERT;'
            ].join('\n'));
            mapConnection('SCOTT-CLAUDE');
            const before = Number(one(readLog(), 'count'));
            const queryText = 'query ' + runId;
            const search = call('usp_Search', "@p_QueryText = N'" + queryText + "', @p_Limit = 5");
            assert.ok(!search.error, JSON.stringify(search.error));
            const afterRes = readLog();
            assert.strictEqual(Number(one(afterRes, 'count')), before + 1, 'exactly one row per call');
            const digest = crypto.createHash('sha256').update(Buffer.from(queryText, 'utf16le')).digest('hex').toUpperCase();
            // A direct call logs the same login twice: resolved and session.
            assert.strictEqual(one(afterRes, 'last'), 'usp_Search:' + me + ':' + me + ':' + ids.scott + ':' + search.value.length + ':' + digest);

            // A vector-only search digests the vector's text, so two such
            // searches with different vectors leave different digests and
            // neither is the digest of the empty string.
            const emptyDigest = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex').toUpperCase();
            const digestOf = (axis) => {
                const res = call('usp_Search', searchParams, vectorPrelude(axis));
                assert.ok(!res.error, JSON.stringify(res.error));
                return one(readLog(), 'last').split(':').pop();
            };
            const d0 = digestOf(0);
            const d1 = digestOf(1);
            assert.notStrictEqual(d0, emptyDigest, 'a vector-only search must not log the empty digest');
            assert.notStrictEqual(d0, d1, 'two vector-only searches with different vectors must log different digests');
            mapConnection(null);
        });

        await t.test('the logins file is exclusive on the live path too', { skip: preExisting.includes('kit_review') && 'kit_review existed before this run, so it is not this run\'s to drop' }, () => {
            sqlOk('DROP USER [kit_review];');
            sqlOk('DROP LOGIN [kit_review];', 'master');

            // The logins script alone, handed the placeholder the installer
            // passes for a login it read as present, with kit_review absent:
            // the state a login dropped between the installer's presence
            // read and this script leaves. The script must refuse rather
            // than create the login with the placeholder. The placeholder is
            // read from the installer's own source, so the two sides cannot
            // drift apart unseen.
            const placeholderMatch = /\$variables\['KitPassword_' \+ \$entry\.Login\] = '([^']+)'/.exec(fs.readFileSync(INSTALLER, 'utf8'));
            assert.ok(placeholderMatch, 'the installer no longer assigns a placeholder where this case expects one');
            const guardEnv = {};
            for (const login of KIT_LOGINS) guardEnv['KitPassword_' + login] = placeholderMatch[1];
            const guarded = spawnSync(live.sqlcmd, ['-S', SERVER, '-E', '-d', dbName, '-b', '-I', '-l', '10', '-i', path.join(DB_DIR, 'Security', '020-Logins.sql')],
                { encoding: 'utf8', env: childEnv(guardEnv) });
            assert.notStrictEqual(guarded.status, 0, 'the logins script created a login with the placeholder as its password:\n' + guarded.stdout + guarded.stderr);
            assert.ok((guarded.stdout + guarded.stderr).includes('kit_review'), 'the refusal must name the login:\n' + guarded.stdout + guarded.stderr);
            assert.ok(!serverLogins().includes('kit_review'), 'the guarded script created kit_review');
            // The control is the installer run below, which hands the same
            // script a generated value and gets the login created.

            const refused = runInstaller(installerArgs);
            assert.notStrictEqual(refused.status, 0, refused.stdout + refused.stderr);
            // The refusal names the absent login, the file, and what the
            // file's passwords are worth: the file from run 1 names all five
            // logins, of which four are still on the server.
            assert.ok(outputLines(refused).some((l) => l.startsWith('FAIL: ') && l.includes('kit_review') && l.includes(loginsPath) && l.includes('kit_scott_claude')),
                'the refusal must name the absent login, the file and the logins the file lists:\n' + refused.stdout);
            assert.ok(!serverLogins().includes('kit_review'), 'the refused run touched the server');
            fs.renameSync(loginsPath, loginsPath + '.moved');
            const again = runInstaller(installerArgs);
            assert.strictEqual(again.status, 0, again.stdout + again.stderr);
            const lines = outputLines(again);
            assert.ok(lines.includes('Logins file: written ' + loginsPath + ' (1 login(s))'), again.stdout);
            assert.ok(lines.includes('Login kit_review: created'), again.stdout);
            assert.deepStrictEqual(readLoginsFile(loginsPath).logins.map((e) => e.login), ['kit_review']);
            assert.ok(serverLogins().includes('kit_review'));
            // The user was dropped above, so the script created it again and
            // the review login reads the log as before.
            const review = sqlOk("EXECUTE AS USER = N'kit_review'; EXEC sp_executesql N'SELECT ''kittest-count='' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.QueryLog'; REVERT;");
            assert.ok(Number(one(review, 'count')) >= 1, review.stdout);
        });
    } finally {
        // Teardown: the run's database, then exactly the logins this run
        // created, then the temp directory. A failure here is loud, since it
        // leaves state on the instance.
        const problems = [];
        const drop = sql([
            "IF DB_ID(N'" + dbName + "') IS NOT NULL",
            'BEGIN',
            '  ALTER DATABASE [' + dbName + '] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;',
            '  DROP DATABASE [' + dbName + '];',
            'END',
            "SELECT 'kittest-dropped=' + CASE WHEN DB_ID(N'" + dbName + "') IS NULL THEN 'yes' ELSE 'no' END;"
        ].join('\n'), 'master');
        if (drop.status !== 0 || !(drop.tags.dropped || []).includes('yes')) problems.push('database ' + dbName + ' was not dropped: ' + drop.stdout + drop.stderr);
        const createdLogins = preExisting === null ? [] : serverLogins().filter((l) => !preExisting.includes(l));
        for (const login of createdLogins) {
            const res = sql("IF EXISTS (SELECT NULL FROM sys.server_principals WHERE [name] = N'" + login + "') DROP LOGIN [" + login + '];', 'master');
            if (res.status !== 0) problems.push('login ' + login + ' was not dropped: ' + res.stdout + res.stderr);
        }
        rmDir(root);
        assert.deepStrictEqual(problems, [], 'teardown left state on ' + SERVER);
    }
});
