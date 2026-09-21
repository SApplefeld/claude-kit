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
// The publisher itself, for the one case that drives its real transport
// against the run's database rather than against a fake.
const client = require(path.join(REPO, 'plugins', 'claude-kit', 'scripts', 'memory-database.js'));
const INSTALLER = path.join(DB_DIR, 'Install-MemoryDatabase.ps1');
// The schema version the installer carries, read off the installer itself. The
// number moves whenever a script changes a shape a client reads, and a copy of
// it spelled here would turn each of those changes into a red in a file that
// has nothing to say about them.
const CARRIED_SCHEMA_VERSION = (() => {
    const found = /\$script:SchemaVersion\s*=\s*(\d+)/.exec(fs.readFileSync(INSTALLER, 'utf8'));
    assert.ok(found !== null, 'the installer carries a schema version: ' + INSTALLER);
    return found[1];
})();
const SERVER = 'localhost';
const SCRIPT_DIRECTORIES = ['Schema', 'FullText', 'Procedures', 'Security', 'Version'];
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

// The client gates its shared search on a schema version and the installer
// carries the one it writes. Two constants, two files, and every other pin in
// this repository derives its expectation from whichever of the two it already
// holds: the client's cases compute from the client's constant and the
// installer's cases from the installer's, so each side tracks its own and a
// divergence between them moves nothing red. This is the only assertion that
// reads both and compares them to each other rather than to itself.
//
// The relation it pins is the one the gate actually implements, which is an
// ordering rather than an equality. The client admits a host at or above its own
// number, so an installer that has moved ahead of the client is a working
// search: the schema version is monotonic and a later host still carries the
// distance the client ranks on. Pinning equality here would redden on a schema
// bump made for something this client never reads, with no defect to find.
//
// What it does catch is the failure that has no symptom: a client whose floor
// sits above any version the installer writes stands the shared search down
// forever against a correctly installed host, and that reads as a search which
// has simply stopped finding things. The neighbours scan's own gate, the one a
// caller asking for retired rows takes, has the same failure and the same pin:
// set above the installer, it would stand the write-time check's shared block
// down on every host.
test('the client gates on the schema version the installer actually writes', () => {
    const carried = Number(CARRIED_SCHEMA_VERSION);
    assert.ok(Number.isFinite(carried),
        'the installer carries a readable schema version: ' + CARRIED_SCHEMA_VERSION);
    for (const [name, what] of [['SEARCH_SCHEMA_VERSION', 'the shared search'],
        ['NEAREST_ARCHIVED_SCHEMA_VERSION', 'the shared neighbours scan']]) {
        assert.strictEqual(typeof client[name], 'number',
            'the client exports the version it gates ' + what + ' on: ' + name);
        assert.ok(client[name] <= carried,
            'the client gates ' + what + ' on ' + client[name] + ' while the installer writes '
            + carried + '; a client above the installer stands ' + what + ' down forever');
    }
});

// The premise the ordering pin above rests on, which nothing checked until this
// case. That comment admits a host ahead of the client on the ground that "a
// later host still carries the distance the client ranks on", and the ordering
// assertion cannot see that ground break: a procedure that stopped projecting
// the key leaves both version numbers exactly where they are, so the gate keeps
// opening onto a host whose rows the client drops as malformed.
//
// The key is lowercase because that is the JSON name, and SQL Server takes the
// column alias verbatim for it. The bracketed uppercase [Distance] is the
// internal column and appears many times in both files, so matching that would
// pass on a procedure that computes the distance and never emits it, which is
// the exact shape of the failure.
test('both shipped procedures project the distance key the client ranks on', () => {
    for (const file of ['100-usp_Search.sql', '110-usp_Nearest.sql']) {
        const src = fs.readFileSync(
            path.join(REPO, 'plugins', 'claude-kit', 'db', 'Procedures', file), 'utf8');
        // Comments are stripped first because both files describe the key in
        // prose, and a sweep that reads its own documentation is a sweep that
        // cannot fail.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
        assert.match(code, /,\s*\[distance\]\s*=/,
            file + ' must alias the cosine distance to the lowercase JSON key the'
            + ' client reads; without it every row this procedure returns is'
            + ' dropped as malformed while the version gate still opens');
        assert.match(code, /FOR JSON PATH/,
            file + ' returns its rows as a JSON projection');
    }
});

// usp_Nearest serves retired records only to a caller that asks, and labels
// every row it serves with an archived key. memq.js reads both halves and owns
// neither. Two of the nearest scan's callers, the session-start fleet block and
// the decay scan's pairs, do not ask and run no partition, so they rely on the
// default withholding retired rows in SQL: a default that stopped withholding
// would fill their few lines with retired records. The write-time neighbours
// check does ask, and partitions on the key: a projection that dropped it would
// hand that check retired rows it lists as live, under a heading whose whole
// question is whether a live near-duplicate exists. Nothing in memq.js can
// detect either change, which is why the pin lives here. The live lane's own
// case proves the same contract on real rows; this one names the text a
// procedure revision would have to move.
//
// Comments are stripped first for the reason the case above gives: the file
// describes the parameter and the key in prose, and a sweep that reads its own
// documentation cannot fail.
test('the nearest-neighbour procedure withholds retired records unless asked, and labels every row it serves', () => {
    const src = fs.readFileSync(
        path.join(REPO, 'plugins', 'claude-kit', 'db', 'Procedures', '110-usp_Nearest.sql'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    assert.match(code, /,\s*@p_IncludeArchived\s+BIT\s*=\s*0\s/,
        'usp_Nearest must default @p_IncludeArchived to 0; the callers that do not ask'
        + ' run no archive partition and rely on the default withholding retired rows');
    assert.match(code, /\(\s*V\.\[IsArchived\]\s*=\s*@False\s+OR\s+@p_IncludeArchived\s*=\s*@True\s*\)/,
        'usp_Nearest must admit a retired record only when @p_IncludeArchived asks for it');
    assert.match(code, /,\s*\[archived\]\s*=\s*V\.\[IsArchived\]/,
        'usp_Nearest must project each row\'s archived key; the neighbours check partitions'
        + ' on it, and without it every retired row it asked for would list as live');
});

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
        assert.ok(expected.length >= 17, 'the five script directories hold fewer scripts than the section delivers: ' + expected.length);
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
        assert.ok((log.match(new RegExp('KitSchemaVersion=' + CARRIED_SCHEMA_VERSION + '(\\r?\\n)', 'g'))
            || []).length >= expected.length, log);
        // The batches the stub was handed are the scripts themselves.
        assert.ok(log.includes('CREATE SCHEMA mem'), 'Schema/010 never reached sqlcmd:\n' + log.slice(0, 2000));
        assert.ok(log.includes("PASSWORD = N'$(KitPassword_kit_review)'"),
            'the logins script must reach sqlcmd with its variable reference intact for sqlcmd to substitute:\n' + log.slice(-4000));
    } finally {
        rmDir(root);
    }
});

// The version row is what a client reads to decide the host carries this
// version's columns and procedures, and it is written last for that reason. A
// run that dies partway through with the row already written leaves a host
// answering the new version with the old procedures behind it, which take
// neither the stamp id columns nor the skip that makes a resent line insert
// once, so every resend writes duplicates.
test('stub lane: the schema version row is written after every other script, never beside the table', { skip: !havePwsh }, () => {
    const root = makeRoot();
    try {
        const stub = plantSqlcmdStub(root);
        const res = runInstaller([
            '-Server', '127.0.0.1,1', '-Database', 'KitMemoryStubTest',
            '-LoginsPath', path.join(root, 'logins.json'), '-SqlcmdPath', stub.stubPath
        ], Object.assign({ KIT_INSTALL_STUB_VERSION: '0' }, stub.env));
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const labels = appliedLabels(outputLines(res)).map((a) => a.label);
        assert.strictEqual(labels[labels.length - 1], 'Version/010-RecordSchemaVersion.sql',
            'the version row must be the last script the run applies:\n' + res.stdout);

        // On the batches themselves rather than on the order of the file names:
        // the row's write reaches sqlcmd after the table that holds it, after
        // the columns and index its version adds, after the procedures that
        // version replaces, and after the grants that let a publisher call them.
        const log = stub.readLog();
        const wrote = log.indexOf('INSERT INTO mem.SchemaVersion');
        assert.ok(wrote > 0, 'the version row never reached sqlcmd:\n' + log.slice(-4000));
        for (const earlier of [
            'CREATE TABLE mem.SchemaVersion',
            'IX_Usage_SandboxId_StampId',
            'ALTER PROCEDURE mem.usp_AppendUsage',
            "PASSWORD = N'$(KitPassword_kit_review)'"
        ]) {
            const at = log.indexOf(earlier);
            assert.ok(at >= 0, earlier + ' never reached sqlcmd, so this case proves no ordering');
            assert.ok(at < wrote, earlier + ' applied after the version row, so a run that died between '
                + 'them would leave a host answering version ' + 2 + ' without it');
        }

        // And the whole tree holds exactly one write of that row, so no other
        // script can answer the version early.
        const writers = [];
        for (const dir of SCRIPT_DIRECTORIES) {
            for (const name of fs.readdirSync(path.join(DB_DIR, dir))) {
                if (!name.toLowerCase().endsWith('.sql')) continue;
                const text = fs.readFileSync(path.join(DB_DIR, dir, name), 'utf8');
                if (/INSERT\s+INTO\s+mem\.SchemaVersion/i.test(text)) writers.push(dir + '/' + name);
            }
        }
        assert.deepStrictEqual(writers, ['Version/010-RecordSchemaVersion.sql'],
            'one script writes the version row, and it is the last one: ' + JSON.stringify(writers));
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
        assert.ok(lines.some((l) => l.startsWith('FAIL: ') && l.includes('SchemaVersion') && /\b99\b/.test(l)
                && new RegExp('\\b' + CARRIED_SCHEMA_VERSION + '\\b').test(l)),
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
            assert.ok(outputLines(okRes).includes(
                'Schema version: carried ' + CARRIED_SCHEMA_VERSION + ', installed 0'), okRes.stdout);
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

// A unit vector with a weight on each named axis, in the same JSON text. The
// weights' squares sum to one, so the cosine against an axis is that weight.
function weightedVector(weights) {
    const values = new Array(DIMENSIONS).fill(0);
    for (const [axis, weight] of Object.entries(weights)) values[Number(axis)] = weight;
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
            assert.ok(lines1.includes(
                'Schema version: carried ' + CARRIED_SCHEMA_VERSION + ', installed none'), run1.stdout);
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
            assert.ok(lines2.includes(
                'Schema version: carried ' + CARRIED_SCHEMA_VERSION + ', installed ' + CARRIED_SCHEMA_VERSION),
            run2.stdout);
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
            assert.ok(lines.some((l) => l.startsWith('FAIL: ') && l.includes('SchemaVersion') && /\b99\b/.test(l)
                && new RegExp('\\b' + CARRIED_SCHEMA_VERSION + '\\b').test(l)), refused.stdout);
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
                "WHERE M.[name] LIKE 'kit[_]%' ORDER BY M.[name], R.[name];",
                // The server-scoped permissions each kit login holds, CONNECT SQL
                // included so that the query proves it speaks.
                "SELECT 'kittest-sperm=' + SP.[name] COLLATE DATABASE_DEFAULT + ':' + P.[state] COLLATE DATABASE_DEFAULT + ':' + P.[permission_name] COLLATE DATABASE_DEFAULT",
                'FROM sys.server_permissions P INNER JOIN sys.server_principals SP ON SP.[principal_id] = P.[grantee_principal_id]',
                "WHERE SP.[name] LIKE 'kit[_]%' ORDER BY SP.[name], P.[state], P.[permission_name];"
            ].join('\n'));
            // The publisher roster as the plan amends it: the seven the
            // section first named plus usp_AppendPublishRun and
            // usp_UpsertIndexOrphans, the writers for the mem.PublishRun and
            // mem.IndexOrphan rows that section 3 publishes under this same
            // execute-only login, plus usp_ListRecords, the reader that is an
            // execute-only publisher's only route to its own record ids, to the
            // records carrying no embedding for the current model, and to the
            // file keys the database still holds that its walk no longer finds
            // (docs/plans/claude-kit_memory-database_spec_v1.md).
            const publisherProcs = ['usp_AppendOutcomes', 'usp_AppendPublishRun', 'usp_AppendUsage', 'usp_Health', 'usp_ListRecords',
                'usp_Nearest', 'usp_Search', 'usp_UpsertEmbeddings', 'usp_UpsertIndexOrphans', 'usp_UpsertRecords'];
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
            // The kit grants no server permission to any of its logins beyond
            // the CONNECT SQL every login is born with. Those five rows are the
            // control: the query reads them, so an empty remainder is a read
            // that found nothing rather than a predicate that matches nothing.
            // The host probe's connection check needs none: its proof is the driver refusing an
            // unencrypted or untrusted link under -N without -C, and the values
            // it reads back (SUSER_SNAME, CONNECTIONPROPERTY('net_transport'))
            // are a session's own. A server-scoped view permission would open
            // other sessions' batch text, which carries other sandboxes' record
            // bodies inline, so an execute-only login must never hold one.
            assert.deepStrictEqual(res.tags.sperm, [
                'kit_asr_claude:G:CONNECT SQL', 'kit_curator:G:CONNECT SQL', 'kit_neo_claude:G:CONNECT SQL',
                'kit_review:G:CONNECT SQL', 'kit_scott_claude:G:CONNECT SQL'
            ], 'no kit login holds a server permission beyond CONNECT SQL:\n' + res.stdout);
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
        // An index's key columns in key order, or '<none>' where the index is
        // not on the table at all.
        function indexKeyOf(table, index) {
            const res = sqlOk([
                "SELECT 'kittest-key=' + COALESCE(STUFF((",
                "  SELECT ',' + C.[name]",
                '  FROM sys.index_columns IC INNER JOIN sys.columns C',
                '    ON C.[object_id] = IC.[object_id] AND C.[column_id] = IC.[column_id]',
                "  WHERE IC.[object_id] = OBJECT_ID('" + table + "')",
                "    AND IC.[index_id] = (SELECT I.[index_id] FROM sys.indexes I WHERE I.[object_id] = OBJECT_ID('" + table + "') AND I.[name] = '" + index + "')",
                '    AND IC.[is_included_column] = 0',
                '  ORDER BY IC.[key_ordinal]',
                "  FOR XML PATH('')), 1, 1, ''), '<none>');"
            ].join('\n'));
            return one(res, 'key');
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

        // A shared pair near axis 7 and nothing else near it: a retired record on
        // the axis itself, the nearest of all, and a live one at cosine 0.8 from
        // it. Every other seeded record sits on an axis of its own, orthogonal to
        // this one, so the two below are the only rows a floor would admit.
        const retiredStore = 'type-nearest-' + runId;
        const nearestPair = sqlOk([
            "DECLARE @scott INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'SCOTT-CLAUDE');",
            "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (NULL, 'type', N'" + retiredStore + "');",
            'DECLARE @store INT = SCOPE_IDENTITY();',
            'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId], [IsArchived])',
            "VALUES (@store, N'nearest-retired-" + runId + "', N'nearest-retired.md', N'a retired fact', N'body', 'hr', 'shared', @scott, 1);",
            'DECLARE @retired BIGINT = SCOPE_IDENTITY();',
            'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId], [IsArchived])',
            "VALUES (@store, N'nearest-live-" + runId + "', N'nearest-live.md', N'a live fact', N'body', 'hl', 'shared', @scott, 0);",
            'DECLARE @live BIGINT = SCOPE_IDENTITY();',
            'INSERT INTO mem.Embedding ([RecordId], [ChunkIndex], [ModelIdentity], [ChunkOffset], [ChunkLength], [Vector], [Dimensions])',
            "VALUES (@retired, 0, 'test-model', 0, 4, CAST(N'" + axisVector(7) + "' AS VECTOR(" + DIMENSIONS + ")), " + DIMENSIONS + "),",
            "       (@live, 0, 'test-model', 0, 4, CAST(N'" + weightedVector({ 7: 0.8, 8: 0.6 }) + "' AS VECTOR(" + DIMENSIONS + ")), " + DIMENSIONS + ");",
            "SELECT 'kittest-retired=' + CAST(@retired AS VARCHAR(20));",
            "SELECT 'kittest-live=' + CAST(@live AS VARCHAR(20));"
        ].join('\n'));
        const pair = { retired: Number(one(nearestPair, 'retired')), live: Number(one(nearestPair, 'live')) };

        await t.test('usp_Nearest serves a retired row with its archived key only when asked', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const wide = "@p_Vector = @v, @p_ModelIdentity = 'test-model', @p_Limit = 50";
                const plain = call('usp_Nearest', wide, vectorPrelude(7));
                assert.ok(!plain.error, JSON.stringify(plain.error));
                const asked = call('usp_Nearest', wide + ', @p_IncludeArchived = 1', vectorPrelude(7));
                assert.ok(!asked.error, 'the procedure refused the archived flag: ' + JSON.stringify(asked.error));

                // Asked: the retired record is served, first by its distance of
                // zero, and labelled; the live one beside it is labelled live.
                const retiredRow = asked.value.find((r) => r.recordId === pair.retired);
                assert.ok(retiredRow, 'the retired row is missing when asked: ' + JSON.stringify(asked.value));
                assert.strictEqual(retiredRow.archived, true, JSON.stringify(retiredRow));
                // The name the author case below sweeps its output for, matched
                // here where the host is known to serve it.
                assert.ok(JSON.stringify(asked.value).includes('nearest-retired-' + runId));
                assert.strictEqual(asked.value[0].recordId, pair.retired,
                    'the retired row ranks by the same distance as a live one: ' + JSON.stringify(asked.value));
                assert.strictEqual(asked.value.find((r) => r.recordId === pair.live).archived, false);

                // Not asked: the same scan with the retired row withheld, and
                // nothing else changed. Every row carries the key, and every
                // key reads live, over an answer the asked call above proves
                // the retired row was eligible for.
                assert.ok(!idsOf(plain.value).includes(pair.retired),
                    'the default served a retired row: ' + JSON.stringify(plain.value));
                assert.ok(plain.value.every((r) => r.archived === false),
                    'every row of the default answer is labelled live: ' + JSON.stringify(plain.value));
                assert.ok(asked.value.length < 50, 'the asked answer hit the 50-row cut, so the equality below no longer compares whole answers');
                assert.deepStrictEqual(idsOf(plain.value),
                    idsOf(asked.value.filter((r) => r.archived === false)),
                    'the default answer is exactly the asked answer\'s live rows');
                assert.ok(idsOf(plain.value).includes(pair.live), JSON.stringify(plain.value));
            } finally {
                mapConnection(null);
            }
        });

        // The author's own path, as far as it runs on this machine: the
        // write-time neighbours block through the client's real probe, batch and
        // sqlcmd spawn against this run's database. Two seams are replaced, the
        // ones every other in-process case of that block replaces. The embedding
        // call is the publisher case's seam, answering with the axis the retired
        // record sits on, since no test may reach a model host. This machine's
        // own ranking is memory-index.js's query and recordPath, answering with
        // no hits, since the real ones load an embedder and sweep this machine's
        // own store. What is left is the host's answer and the printer.
        await t.test('live lane: the neighbours block counts a retired shared duplicate and never lists it', async () => {
            const memq = require(path.join(REPO, 'plugins', 'claude-kit', 'scripts', 'memq.js'));
            const mi = require(path.join(REPO, 'plugins', 'claude-kit', 'scripts', 'memory-index.js'));
            const clientConfig = {
                server: SERVER, database: dbName, login: '', password: '',
                timeoutMs: 30000, windowsAuth: true, trustServerCertificate: true,
                embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
            };
            const onAxis = JSON.parse(axisVector(7));
            const saved = {};
            for (const name of ['KIT_MEMORY_ROOT', 'KIT_MEMORY_ROOT_ALLOW_DATA', 'KIT_EMBEDDER_ROOT']) {
                saved[name] = process.env[name];
                delete process.env[name];
            }
            const realQuery = mi.query;
            const realPath = mi.recordPath;
            mi.query = async () => ({
                status: 'ok', hits: [],
                sweep: { failedRecords: 0, failedDirs: 0, carried: 0, records: 0, writeError: null }
            });
            mi.recordPath = () => null;
            const written = [];
            const realWrite = process.stderr.write;
            process.stderr.write = (chunk) => { written.push(String(chunk)); return true; };
            mapConnection('SCOTT-CLAUDE');
            const name = 'the-author-writes-' + runId;
            try {
                await memq.neighbourBlock(name, 'a fact the fleet already retired', {
                    config: clientConfig,
                    deps: { embedBatch: async (cfg, texts) => ({ ok: true, vectors: texts.map(() => onAxis) }) }
                });
            } finally {
                process.stderr.write = realWrite;
                mi.query = realQuery;
                mi.recordPath = realPath;
                for (const [key, value] of Object.entries(saved)) {
                    if (value === undefined) delete process.env[key];
                    else process.env[key] = value;
                }
                mapConnection(null);
            }
            const text = written.join('');
            const lines = text.split('\n');
            assert.ok(lines.includes('memq: nearest neighbours of ' + name + ' in the shared memory database'),
                'the shared index answered the block: ' + text);
            assert.ok(text.includes('nearest-live-' + runId),
                'the live near-duplicate is listed, the control that the block lists at all: ' + text);
            assert.ok(!text.includes('nearest-retired-' + runId),
                'the retired record is counted and never listed: ' + text);
            assert.ok(lines.includes('memq: 1 retired record(s) in the shared memory database also match'
                + ' at or above the overlap floor (' + memq.FLEET_NEIGHBOUR_FLOOR.toFixed(2)
                + ') and are not listed; `memq find` with --archived shows them'),
            'the author sees the retired duplicate as a count at the shared overlap floor: ' + text);
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

        // usp_ListRecords, the reader the publisher learns its record ids, its
        // unembedded set and its removed set from. Its result is one row per
        // record rather than one array, so it is read line by line: callAs
        // above insists on a single value, which is the right refusal for every
        // other procedure in this file and the wrong one here.
        function listRecordsAs(user, model) {
            const statement = "EXEC mem.usp_ListRecords @p_ModelIdentity = '" + model + "'";
            const res = sqlOk([
                'DECLARE @t TABLE ([Json] NVARCHAR(MAX));',
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
            const lines = res.tags.json || [];
            for (const text of lines) {
                assert.ok(text.length < 7990, 'sqlcmd cut a row at its 8000-character ceiling: ' + text.slice(0, 80));
            }
            return { lines, rows: lines.map((t2) => JSON.parse(t2)), raw: res };
        }
        const listRecords = (model) => listRecordsAs(null, model);

        await t.test('usp_ListRecords serves the caller its own private rows and every shared row, never another sandbox\'s private row', () => {
            // A private row of NEO's planted here rather than the seed's, whose
            // visibility the promotion case above moves to shared: a row this
            // case needs to be private throughout is one it owns.
            const token = 'listneo' + letters(8);
            const planted = sqlOk([
                "DECLARE @neo INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'NEO-CLAUDE');",
                "DECLARE @store INT = (SELECT [StoreId] FROM mem.Store WHERE [SandboxId] = @neo AND [Tier] = 'project' AND [Segment] = N'" + segment + "');",
                'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId])',
                "VALUES (@store, N'neo-list-" + runId + "', N'neo-list.md', N'" + token + " note', N'body " + token + "', 'hlist', 'private', @neo);",
                "SELECT 'kittest-id=' + CAST(SCOPE_IDENTITY() AS VARCHAR(20));"
            ].join('\n'));
            const neoPrivateId = Number(one(planted, 'id'));

            mapConnection('SCOTT-CLAUDE');
            const scott = listRecords('test-model');
            assert.ok(!scott.error, JSON.stringify(scott.error));
            const scottIds = scott.rows.map((r) => r.recordId);
            assert.ok(scottIds.includes(ids.neoShared), 'the shared row is missing from SCOTT\'s inventory: ' + JSON.stringify(scott.rows));
            assert.ok(scottIds.includes(ids.scottPrivate), 'SCOTT\'s own private row is missing: ' + JSON.stringify(scott.rows));
            assert.ok(!scottIds.includes(neoPrivateId), 'TENANCY LEAK: NEO\'s private row reached SCOTT: ' + JSON.stringify(scott.rows));
            assert.ok(!JSON.stringify(scott.rows).includes(token), 'TENANCY LEAK: NEO\'s private token reached SCOTT');

            // The control, withheld from the assertion above: the same
            // connection re-pointed at NEO does get that row, so its absence
            // for SCOTT is the filter rather than a row the reader never lists.
            mapConnection('NEO-CLAUDE');
            const neo = listRecordsAs(null, 'test-model');
            assert.ok(!neo.error, JSON.stringify(neo.error));
            assert.ok(neo.rows.map((r) => r.recordId).includes(neoPrivateId), 'NEO cannot see its own private row: ' + JSON.stringify(neo.rows));
            assert.ok(!neo.rows.map((r) => r.recordId).includes(ids.scottPrivate), 'TENANCY LEAK: SCOTT\'s private row reached NEO');
        });

        await t.test('usp_ListRecords leaves another sandbox\'s shared project row out of the caller\'s inventory', () => {
            // A promoted project record is shared, so the visibility function
            // hands it to every sandbox; its file key can match one this
            // sandbox holds in a segment of the same name, and the publisher
            // would then embed its own body under the other sandbox's record.
            const planted = sqlOk([
                "DECLARE @neo INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'NEO-CLAUDE');",
                "DECLARE @store INT = (SELECT [StoreId] FROM mem.Store WHERE [SandboxId] = @neo AND [Tier] = 'project' AND [Segment] = N'" + segment + "');",
                'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId])',
                "VALUES (@store, N'neo-promoted-" + runId + "', N'neo-promoted.md', N'promoted note', N'promoted body', 'hprom', 'shared', @neo);",
                "SELECT 'kittest-id=' + CAST(SCOPE_IDENTITY() AS VARCHAR(20));"
            ].join('\n'));
            const promotedId = Number(one(planted, 'id'));

            // The mapping is connection-wide state every case below reads, so
            // the reset runs whatever an assertion here does.
            try {
                mapConnection('SCOTT-CLAUDE');
                const scott = listRecords('test-model');
                assert.ok(!scott.error, JSON.stringify(scott.error));
                const scottIds = scott.rows.map((r) => r.recordId);
                assert.ok(!scottIds.includes(promotedId), 'NEO\'s shared project row reached SCOTT\'s inventory: ' + JSON.stringify(scott.rows));
                assert.ok(scottIds.includes(ids.neoShared), 'a shared row outside the project tier must stay in the inventory');

                // The control: NEO's own inventory lists the row, so its absence
                // above is the filter rather than a row the reader never returns.
                mapConnection('NEO-CLAUDE');
                const neo = listRecords('test-model');
                assert.ok(!neo.error, JSON.stringify(neo.error));
                assert.ok(neo.rows.map((r) => r.recordId).includes(promotedId), 'NEO cannot see its own promoted row: ' + JSON.stringify(neo.rows));
            } finally {
                mapConnection(null);
            }
        });

        // The write side of the case above. A promoted project record is
        // shared, so the visibility function hands it to every sandbox, and
        // usp_Search and usp_Nearest both hand its id to a publisher that never
        // owned it. Without the tier and owner predicate on the write, that
        // publisher attaches its own vectors to another sandbox's record.
        await t.test('usp_UpsertEmbeddings rejects a vector against another sandbox\'s shared project record', () => {
            const planted = sqlOk([
                "DECLARE @neo INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'NEO-CLAUDE');",
                "DECLARE @store INT = (SELECT [StoreId] FROM mem.Store WHERE [SandboxId] = @neo AND [Tier] = 'project' AND [Segment] = N'" + segment + "');",
                'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId])',
                "VALUES (@store, N'neo-embed-" + runId + "', N'neo-embed.md', N'promoted note', N'promoted body', 'hembed', 'shared', @neo);",
                "SELECT 'kittest-id=' + CAST(SCOPE_IDENTITY() AS VARCHAR(20));"
            ].join('\n'));
            const promotedId = Number(one(planted, 'id'));
            // A model identity of this case's own, so every count below is
            // answered over rows this case wrote.
            const model = 'crossmodel-' + runId;
            // The predicate each count below is read with, scoped to this run's
            // database: one record id and this case's model identity.
            const embeddingRows = (recordId) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) "
                + 'FROM mem.Embedding WHERE [RecordId] = ' + recordId + " AND [ModelIdentity] = N'" + model + "';"), 'n'));
            const chunk = (recordId, axis, chunkIndex) => ({
                recordId, chunkIndex: chunkIndex || 0, chunkOffset: (chunkIndex || 0) * 6, chunkLength: 6,
                vector: JSON.parse(axisVector(axis)), model, dimensions: DIMENSIONS
            });
            const embed = (chunks) => call('usp_UpsertEmbeddings', "@p_Embeddings = N'" + JSON.stringify(chunks) + "'");

            try {
                mapConnection('SCOTT-CLAUDE');
                const refused = embed([chunk(promotedId, 7)]);
                assert.ok(!refused.error, 'a row the caller may not embed is counted, never thrown: ' + JSON.stringify(refused.error));
                assert.deepStrictEqual(refused.value, { inserted: 0, updated: 0, rejected: 1 },
                    'NEO\'s shared project row must be rejected rather than written: ' + JSON.stringify(refused.value));
                assert.strictEqual(embeddingRows(promotedId), 0,
                    'TENANCY LEAK: SCOTT attached a vector to NEO\'s shared project record');

                // The withheld control: the same call against SCOTT's own
                // record is taken, so the rejection above is the tier and owner
                // predicate rather than a call this case could never get
                // through. It is the state the count above is proved against
                // too, since that same query answers one here.
                const own = embed([chunk(ids.scottPrivate, 8)]);
                assert.ok(!own.error, JSON.stringify(own.error));
                assert.deepStrictEqual(own.value, { inserted: 1, updated: 0, rejected: 0 }, JSON.stringify(own.value));
                assert.strictEqual(embeddingRows(ids.scottPrivate), 1, 'the control must actually hold a row');

                // One batch carrying one of each: the accepted row lands and
                // the rejected one is counted beside it, so the count answers
                // about the rows rather than refusing the batch whole.
                const mixed = embed([chunk(promotedId, 9), chunk(ids.scottPrivate, 10, 1)]);
                assert.ok(!mixed.error, JSON.stringify(mixed.error));
                assert.deepStrictEqual(mixed.value, { inserted: 1, updated: 0, rejected: 1 }, JSON.stringify(mixed.value));
                assert.strictEqual(embeddingRows(promotedId), 0, 'the mixed batch still wrote nothing for NEO\'s record');
                assert.strictEqual(embeddingRows(ids.scottPrivate), 2, 'and the accepted row beside it landed');

                // The second control, varying the owner rather than the record:
                // NEO's own publisher does embed that record, so the refusal
                // above is the owner predicate and not a record no login writes.
                mapConnection('NEO-CLAUDE');
                const owner = embed([chunk(promotedId, 11)]);
                assert.ok(!owner.error, JSON.stringify(owner.error));
                assert.deepStrictEqual(owner.value, { inserted: 1, updated: 0, rejected: 0 }, JSON.stringify(owner.value));
                assert.strictEqual(embeddingRows(promotedId), 1, 'the owning sandbox\'s own write lands');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('usp_ListRecords answers an unmapped login with no rows rather than every row', () => {
            mapConnection(null);
            const nobody = listRecords('test-model');
            assert.ok(!nobody.error, JSON.stringify(nobody.error));
            assert.deepStrictEqual(nobody.rows, [], 'an unmapped login must see nothing: ' + JSON.stringify(nobody.rows));
            // The control: the same call on the same connection, mapped, does
            // return rows, so the empty answer above is the fail-closed
            // resolution and not a reader that lists nothing for anyone.
            mapConnection('SCOTT-CLAUDE');
            assert.ok(listRecords('test-model').rows.length > 0, 'the mapped control must see rows');
            mapConnection(null);
        });

        await t.test('usp_ListRecords puts one row per record on the wire, each the eight fields the publisher reads', () => {
            mapConnection('SCOTT-CLAUDE');
            const listed = listRecords('test-model');
            assert.ok(!listed.error, JSON.stringify(listed.error));
            // The inventory's own scope: every record the caller may see, less
            // another sandbox's project rows, which are not this publisher's to
            // embed or remove. The case above proves that narrowing; the count
            // here is only what tells one row per record from one array.
            const inventory = Number(one(sqlOk("SELECT 'kittest-count=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.udf_VisibleRecords(" + ids.scott + ') V'
                + " WHERE (V.[Tier] <> 'project' OR V.[StoreSandboxId] = " + ids.scott + ');'), 'count'));
            assert.ok(inventory > 1, 'this case needs more than one record in the inventory to say anything');
            assert.strictEqual(listed.rows.length, inventory,
                'the reader must emit one row per record in the inventory, not one array: ' + JSON.stringify(listed.lines));
            for (const row of listed.rows) {
                assert.ok(row !== null && typeof row === 'object' && !Array.isArray(row),
                    'each line is one record object: ' + JSON.stringify(row));
                assert.deepStrictEqual(Object.keys(row).sort(),
                    ['archived', 'embedded', 'fileKey', 'name', 'recordId', 'segment', 'tier', 'visibility'],
                    'the row shape the publisher reads: ' + JSON.stringify(row));
            }
            mapConnection(null);
        });

        await t.test('usp_ListRecords reports embedded for the model asked about, and a body change puts it back to unembedded', () => {
            mapConnection('SCOTT-CLAUDE');
            const model = 'listmodel-' + runId;
            const segment = 'listseg-' + runId;
            const fileKey = 'list-record.md';
            const record = (body, bodyHash) => JSON.stringify([{
                tier: 'project', segment, name: 'list-record-' + runId, fileKey,
                description: 'a record this case publishes and re-publishes',
                body, bodyHash, fileModified: '2026-09-17T00:00:00Z',
                machine: null, tags: [], supersedes: null, archived: false
            }]);
            const published = call('usp_UpsertRecords', "@p_Records = N'" + record('first body', 'hash-one') + "'");
            assert.ok(!published.error, JSON.stringify(published.error));
            assert.strictEqual(published.value.added, 1, JSON.stringify(published.value));

            const mine = () => {
                const row = listRecords(model).rows.find((r) => r.fileKey === fileKey && r.segment === segment);
                assert.ok(row, 'the record this case published is missing from its own inventory');
                return row;
            };
            const fresh = mine();
            // The two flags are BIT columns, which FOR JSON writes as true and
            // false rather than 1 and 0, so that is the wire the publisher reads.
            assert.strictEqual(fresh.embedded, false, 'a record with no embedding for this model reads as unembedded');
            assert.strictEqual(fresh.tier, 'project');
            assert.strictEqual(fresh.visibility, 'private');

            const stored = call('usp_UpsertEmbeddings', "@p_Embeddings = N'" + JSON.stringify([{
                recordId: fresh.recordId, chunkIndex: 0, chunkOffset: 0, chunkLength: 10,
                vector: JSON.parse(axisVector(3)), model, dimensions: DIMENSIONS
            }]) + "'");
            assert.ok(!stored.error, JSON.stringify(stored.error));
            assert.strictEqual(mine().embedded, true, 'an embedding for this model must read as embedded');
            // The withheld control: the same record asked about under the
            // model the seed used reads as unembedded, so the flag answers per
            // model rather than per record.
            const otherModel = listRecords('test-model').rows.find((r) => r.recordId === fresh.recordId);
            assert.strictEqual(otherModel.embedded, false, 'the flag must be answered for the model asked about');

            const changed = call('usp_UpsertRecords', "@p_Records = N'" + record('second body', 'hash-two') + "'");
            assert.ok(!changed.error, JSON.stringify(changed.error));
            assert.strictEqual(changed.value.changed, 1, JSON.stringify(changed.value));
            assert.strictEqual(mine().embedded, false, 'a body-hash change drops the embeddings, so the record reads as unembedded again');
            mapConnection(null);
        });

        // A runtime error raised inside a procedure, rather than one the
        // procedure throws at its own validation. The client calls every
        // procedure through INSERT-EXEC, and a ROLLBACK inside that statement
        // raises error 3915 in place of whatever actually failed, so a CATCH
        // that unwinds a transaction the procedure did not open costs the
        // caller the server's own words. The batch below is callProcedure's
        // own shape, deliberately without the outer TRY/CATCH that callAs
        // wraps its calls in: a caller holding one of those reads error 3930
        // instead, and the client holds none, so this case reads what sqlcmd
        // prints. The shape this case refuses answers the same call with
        // "Msg 3915, Level 16, State 1, Server SCOTT-CLAUDE, Procedure
        // mem.usp_UpsertEmbeddings, Line 212 / Cannot use the ROLLBACK
        // statement within an INSERT-EXEC statement." and no word of the
        // vector. Error 42204 is the cast's own, which the caller needs.
        await t.test('a runtime error inside a procedure called through INSERT-EXEC reaches the caller as the server\'s own error, never error 3915', () => {
            try {
                mapConnection('SCOTT-CLAUDE');
                const model = 'xactmodel-' + runId;
                const xactSegment = 'xactseg-' + runId;
                const fileKey = 'xact-record.md';
                const published = call('usp_UpsertRecords', "@p_Records = N'" + JSON.stringify([{
                    tier: 'project', segment: xactSegment, name: 'xact-record-' + runId, fileKey,
                    description: 'a record this case embeds badly on purpose',
                    body: 'a body', bodyHash: 'hash-xact', fileModified: '2026-09-18T00:00:00Z',
                    machine: null, tags: [], supersedes: null, archived: false
                }]) + "'");
                assert.ok(!published.error, JSON.stringify(published.error));
                const listed = listRecords(model).rows.find((r) => r.fileKey === fileKey && r.segment === xactSegment);
                assert.ok(listed, 'the record this case published is missing from its own inventory');
                const recordId = listed.recordId;
                assert.ok(Number.isInteger(recordId), 'the record id must be a number this case reads from the server');

                // Two chunks, the second carrying three dimensions where the
                // column takes 1024. The cast fails inside the procedure's
                // transaction, which dooms it, and that is the state the CATCH
                // leaves to its caller.
                const payload = JSON.stringify([
                    { recordId, chunkIndex: 0, chunkOffset: 0, chunkLength: 6, vector: JSON.parse(axisVector(5)), model, dimensions: DIMENSIONS },
                    { recordId, chunkIndex: 1, chunkOffset: 6, chunkLength: 6, vector: [1, 2, 3], model, dimensions: DIMENSIONS }
                ]);
                const res = sql([
                    "DECLARE @v1 NVARCHAR(MAX) = N'" + payload.replace(/'/g, "''") + "';",
                    'DECLARE @Answer TABLE ( [Json] NVARCHAR(MAX) NULL );',
                    'INSERT INTO @Answer ( [Json] ) EXEC mem.usp_UpsertEmbeddings @p_Embeddings = @v1;',
                    "SELECT 'kittest-json=' + COALESCE([Json], 'null') FROM @Answer;"
                ].join('\n'));
                const output = (res.stdout || '') + (res.stderr || '');
                assert.notStrictEqual(res.status, 0, 'the failed call must exit non-zero:\n' + output);
                assert.ok(!res.tags.json, 'a failed call must answer with no result row:\n' + output);
                // The numbers rather than either message, since the server owns
                // the wording of both and the caller acts on the number.
                assert.ok(/\bMsg 42204\b/.test(output),
                    'the server\'s own error must reach the caller:\n' + output);
                // The number is what a caller acts on and the text is what a
                // person reads, so both are pinned: a number arriving under
                // some other prose describes a fault nobody can place.
                assert.ok(/vector dimensions/i.test(output),
                    'and the text beside it must describe the fault rather than only number it:\n'
                    + output);
                assert.ok(!/\bMsg 3915\b/.test(output),
                    'the INSERT-EXEC rollback error replaced the server\'s own, so the caller cannot tell what failed:\n' + output);

                // The whole batch is refused, so the well-formed chunk beside the
                // bad one is not left behind by a procedure that stopped rolling
                // its caller's transaction back.
                const rows = Number(one(sqlOk("SELECT 'kittest-count=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Embedding"
                    + ' WHERE [RecordId] = ' + recordId + " AND [ModelIdentity] = N'" + model + "';"), 'count'));
                assert.strictEqual(rows, 0, 'a batch that failed halfway left an embedding behind');

                // The control, withheld from the assertions above: the same batch
                // with both vectors well formed is taken, so the refusal above is
                // the cast and not a call this case could never get through.
                const good = call('usp_UpsertEmbeddings', "@p_Embeddings = N'" + JSON.stringify([
                    { recordId, chunkIndex: 0, chunkOffset: 0, chunkLength: 6, vector: JSON.parse(axisVector(5)), model, dimensions: DIMENSIONS },
                    { recordId, chunkIndex: 1, chunkOffset: 6, chunkLength: 6, vector: JSON.parse(axisVector(6)), model, dimensions: DIMENSIONS }
                ]) + "'");
                assert.ok(!good.error, JSON.stringify(good.error));
                assert.strictEqual(good.value.inserted, 2, JSON.stringify(good.value));
            } finally {
                mapConnection(null);
            }
        });

        // The transport itself, end to end, against this run's real database.
        // Every other publish case in the suite replaces the sqlcmd spawn, so
        // nothing else proves that the batch this client writes is one the
        // tool and the server actually accept: the ASCII escaping, the -y 0
        // display width that keeps a JSON answer whole, the kitdb-json= tag
        // parse, -x beside a body carrying $(...), a line reading GO inside a
        // record body, and -N against an instance this machine trusts. The
        // embedding server is the one seam left in place, since no test may
        // reach a model host; the vectors it returns are real 1024-wide ones
        // and they are stored through the real procedure.
        await t.test('live lane: the publisher\'s own transport against the run\'s database', async () => {
            const publishRoot = fs.mkdtempSync(path.join(root, 'publish-store-'));
            const segment = 'livepub-' + runId;
            const memDir = path.join(publishRoot, 'projects', segment, 'memory');
            fs.mkdirSync(memDir, { recursive: true });
            // Three bodies chosen for what they do to the batch rather than
            // for what they say: a sqlcmd batch separator on its own line, a
            // variable reference the tool would substitute without -x, an
            // embedded quote, characters outside ASCII, and a body long
            // enough that a listing of it would pass sqlcmd's own
            // 8000-character display ceiling.
            const bodies = {
                'go-and-vars': '# separators\n\nline one\nGO\nline two\n\n$(PATH) and $(SQLCMDSERVER) stay literal\n',
                'quotes-and-unicode': '# quoting\n\nit\'s a body with \'\' doubled quotes, naive '
                    + 'éè and 中文 in it\n',
                'a-long-one': '# long\n\n' + ('a sentence that repeats itself. '.repeat(400)) + '\n'
            };
            for (const [name, body] of Object.entries(bodies)) {
                fs.writeFileSync(path.join(memDir, name + '.md'), body, 'utf8');
                fs.appendFileSync(path.join(memDir, 'MEMORY.md'),
                    '- [' + name + '](' + name + '.md) - a record the live transport case published\n', 'utf8');
            }

            const clientConfig = {
                server: SERVER, database: dbName, login: '', password: '',
                timeoutMs: 30000, windowsAuth: true, trustServerCertificate: true,
                embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
            };
            const vectors = (texts) => ({
                ok: true,
                vectors: texts.map((text, at) => {
                    const v = new Array(DIMENSIONS).fill(0);
                    v[at % DIMENSIONS] = 1;
                    return v;
                })
            });

            mapConnection('SCOTT-CLAUDE');
            const before = {
                memoryRoot: process.env.KIT_MEMORY_ROOT,
                allow: process.env.KIT_MEMORY_ROOT_ALLOW_DATA,
                project: process.env.KIT_MEMORY_PROJECT
            };
            process.env.KIT_MEMORY_ROOT = publishRoot;
            process.env.KIT_MEMORY_ROOT_ALLOW_DATA = '1';
            delete process.env.KIT_MEMORY_PROJECT;
            let result = null;
            try {
                result = await client.publish({
                    config: clientConfig,
                    deps: { embedBatch: async (cfg, texts) => vectors(texts) }
                });
            } finally {
                for (const [name, value] of [['KIT_MEMORY_ROOT', before.memoryRoot],
                    ['KIT_MEMORY_ROOT_ALLOW_DATA', before.allow], ['KIT_MEMORY_PROJECT', before.project]]) {
                    if (value === undefined) delete process.env[name];
                    else process.env[name] = value;
                }
            }

            assert.strictEqual(result.ok, true, JSON.stringify(result));
            assert.deepStrictEqual(result.summary.failed, [], 'nothing may fail on the real transport');
            assert.strictEqual(result.summary.added, 3, JSON.stringify(result.summary));
            assert.strictEqual(result.summary.embedded, 3, JSON.stringify(result.summary));

            // The bodies on the server are the bodies on disk, byte for byte,
            // which is what the ASCII escaping and the doubled quotes exist
            // for: a batch the tool cut, substituted or re-encoded would show
            // up here and nowhere else.
            for (const [name, body] of Object.entries(bodies)) {
                const stored = sqlOk([
                    "DECLARE @b NVARCHAR(MAX) = (SELECT R.[Body] FROM mem.Record R INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]",
                    "    WHERE S.[Segment] = N'" + segment + "' AND R.[FileKey] = N'" + name + ".md');",
                    "SELECT 'kittest-len=' + CAST(LEN(@b) AS VARCHAR(20));",
                    "SELECT 'kittest-hash=' + CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @b), 2);"
                ].join('\n'));
                const digest = crypto.createHash('sha256')
                    .update(Buffer.from(body, 'utf16le')).digest('hex').toUpperCase();
                assert.strictEqual(one(stored, 'hash'), digest,
                    'the stored body of ' + name + ' is not the file\'s text');
                assert.strictEqual(Number(one(stored, 'len')), body.length, name + ' lost or gained characters');
            }

            // The embeddings landed through the real procedure at the real
            // width, one row per chunk, and the long record is the one that
            // proves several chunks ride one call.
            const counts = sqlOk([
                "SELECT 'kittest-rows=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Embedding E",
                'INNER JOIN mem.Record R ON R.[RecordId] = E.[RecordId]',
                'INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]',
                "WHERE S.[Segment] = N'" + segment + "' AND E.[ModelIdentity] = 'test-model';",
                "SELECT 'kittest-dims=' + CAST(MIN(E.[Dimensions]) AS VARCHAR(10)) + ':' + CAST(MAX(E.[Dimensions]) AS VARCHAR(10)) FROM mem.Embedding E",
                'INNER JOIN mem.Record R ON R.[RecordId] = E.[RecordId]',
                'INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]',
                "WHERE S.[Segment] = N'" + segment + "';"
            ].join('\n'));
            assert.ok(Number(one(counts, 'rows')) >= 3, 'every published record carries at least one embedding: ' + one(counts, 'rows'));
            assert.strictEqual(one(counts, 'dims'), DIMENSIONS + ':' + DIMENSIONS);

            // The second run is the reader's own answer coming back through
            // the transport: every record sent again, every one unchanged,
            // nothing re-embedded.
            process.env.KIT_MEMORY_ROOT = publishRoot;
            process.env.KIT_MEMORY_ROOT_ALLOW_DATA = '1';
            let second = null;
            try {
                second = await client.publish({
                    config: clientConfig,
                    deps: { embedBatch: async (cfg, texts) => vectors(texts) }
                });
            } finally {
                if (before.memoryRoot === undefined) delete process.env.KIT_MEMORY_ROOT;
                else process.env.KIT_MEMORY_ROOT = before.memoryRoot;
                if (before.allow === undefined) delete process.env.KIT_MEMORY_ROOT_ALLOW_DATA;
                else process.env.KIT_MEMORY_ROOT_ALLOW_DATA = before.allow;
            }
            assert.strictEqual(second.ok, true, JSON.stringify(second));
            assert.strictEqual(second.summary.unchanged, 3, JSON.stringify(second.summary));
            assert.strictEqual(second.summary.added, 0, JSON.stringify(second.summary));
            assert.strictEqual(second.summary.embedded, 0,
                'the reader reported these as embedded, which is the tag parse working: ' + JSON.stringify(second.summary));
            assert.strictEqual(second.summary.removed, 0, JSON.stringify(second.summary));

            // And one publish run row per run, written under the same
            // execute-only procedure set.
            const runs = sqlOk("SELECT 'kittest-runs=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.PublishRun WHERE [SandboxId] = " + ids.scott + ';');
            assert.ok(Number(one(runs, 'runs')) >= 2, 'each publish records its run: ' + one(runs, 'runs'));
            mapConnection(null);
        });

        // The idempotence the spool drain rests on. The drain leaves its file
        // whole on any refusal or transport failure and sends the lot again on
        // the next run, which is safe only because the server takes a stamp id
        // once. Enforced by a lookup rather than by the index, two sessions
        // would both find the id absent and both write it.
        await t.test('a stamp id mem.Usage already holds is skipped rather than written again', () => {
            mapConnection('SCOTT-CLAUDE');
            const stamp = () => crypto.randomUUID();
            const line = (id) => '{"recordId":' + ids.scottPrivate + ',"kind":"read",'
                + '"at":"2026-09-18T00:00:00Z"' + (id === null ? '' : ',"stampId":"' + id + '"') + '}';
            const append = (json) => call('usp_AppendUsage', "@p_Usage = N'" + json + "'");
            const rowsFor = (id) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) "
                + "FROM mem.Usage WHERE [StampId] = N'" + id + "';"), 'n'));

            const one1 = stamp();
            const first = append('[' + line(one1) + ']');
            assert.ok(!first.error, JSON.stringify(first.error));
            assert.deepStrictEqual(first.value, { appended: 1, rejected: 0, skipped: 0 });
            assert.strictEqual(rowsFor(one1), 1);

            const again = append('[' + line(one1) + ']');
            assert.ok(!again.error, 'a resend is skipped rather than refused: ' + JSON.stringify(again.error));
            assert.deepStrictEqual(again.value, { appended: 0, rejected: 0, skipped: 1 },
                'the server counts the skip rather than writing the row again');
            assert.strictEqual(rowsFor(one1), 1, 'and mem.Usage still holds exactly one row for that id');

            // One batch carrying the same id twice, which the index would refuse
            // mid-insert and take every unrelated stamp in the batch down with.
            const twin = stamp();
            const other = stamp();
            const doubled = append('[' + line(twin) + ',' + line(twin) + ',' + line(other) + ']');
            assert.ok(!doubled.error, 'a repeated id never fails the batch: ' + JSON.stringify(doubled.error));
            assert.deepStrictEqual(doubled.value, { appended: 2, rejected: 0, skipped: 1 });
            assert.strictEqual(rowsFor(twin), 1);
            assert.strictEqual(rowsFor(other), 1, 'and the unrelated stamp beside it still landed');

            // The control, withheld from the assertions above: a stamp carrying
            // no id at all is written every time, so the single rows above are
            // the index rather than a table that stopped accepting stamps.
            const before = Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) "
                + 'FROM mem.Usage WHERE [StampId] IS NULL;'), 'n'));
            assert.ok(!append('[' + line(null) + ']').error);
            assert.ok(!append('[' + line(null) + ']').error);
            assert.strictEqual(Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) "
                + 'FROM mem.Usage WHERE [StampId] IS NULL;'), 'n')), before + 2,
                'a stamp with no id carries no protection and is written each time');

            // The index itself, read from the catalog rather than inferred from
            // the behaviour above: unique, keyed on the sandbox and the stamp id
            // in that order, and filtered so the null rows stand.
            const index = sqlOk([
                "SELECT 'kittest-ix=' + I.[name] + ':' + CAST(I.[is_unique] AS VARCHAR(1)) + ':' + COALESCE(I.[filter_definition], '<none>')",
                'FROM sys.indexes I',
                "WHERE I.[object_id] = OBJECT_ID('mem.Usage') AND I.[name] = 'IX_Usage_SandboxId_StampId';"
            ].join('\n'));
            assert.strictEqual(one(index, 'ix'), 'IX_Usage_SandboxId_StampId:1:([StampId] IS NOT NULL)');
            assert.strictEqual(indexKeyOf('mem.Usage', 'IX_Usage_SandboxId_StampId'), 'SandboxId,StampId');
            assert.strictEqual(indexKeyOf('mem.Outcome', 'IX_Outcome_SandboxId_StampId'), 'SandboxId,StampId');
            // The fleet-wide index the per-sandbox one replaces is gone, so a
            // host that took the earlier shape cannot still be enforcing it.
            assert.strictEqual(indexKeyOf('mem.Usage', 'IX_Usage_StampId'), '<none>');
            assert.strictEqual(indexKeyOf('mem.Outcome', 'IX_Outcome_StampId'), '<none>');
        });

        // The stamp id is the writing client's own random value, so two
        // sandboxes never mean the same row by one id. Unique over the id alone,
        // one sandbox's row suppresses another's write and the skipped count
        // answers about a table rather than about the caller.
        await t.test('one sandbox\'s stamp id never suppresses another sandbox\'s row', () => {
            const id = crypto.randomUUID();
            const line = '{"recordId":' + ids.neoShared + ',"kind":"read",'
                + '"at":"2026-09-18T00:00:00Z","stampId":"' + id + '"}';
            const rowsFor = (sandbox) => Number(one(sqlOk([
                "SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10))",
                'FROM mem.Usage U INNER JOIN mem.Sandbox SB ON SB.[SandboxId] = U.[SandboxId]',
                "WHERE U.[StampId] = N'" + id + "' AND SB.[Name] = N'" + sandbox + "';"
            ].join('\n')), 'n'));

            mapConnection('SCOTT-CLAUDE');
            const first = call('usp_AppendUsage', "@p_Usage = N'[" + line + "]'");
            assert.ok(!first.error, JSON.stringify(first.error));
            assert.deepStrictEqual(first.value, { appended: 1, rejected: 0, skipped: 0 });

            mapConnection('NEO-CLAUDE');
            const second = call('usp_AppendUsage', "@p_Usage = N'[" + line + "]'");
            assert.ok(!second.error, 'the other sandbox\'s write was refused by the index: '
                + JSON.stringify(second.error));
            assert.deepStrictEqual(second.value, { appended: 1, rejected: 0, skipped: 0 },
                'the skip answers about the caller\'s own rows, not about every sandbox\'s');
            assert.strictEqual(rowsFor('SCOTT-CLAUDE'), 1);
            assert.strictEqual(rowsFor('NEO-CLAUDE'), 1, 'both sandboxes hold their own row for the id');

            // The control, withheld from the assertions above: the same id sent
            // twice by the one sandbox is still skipped, so the two rows are the
            // sandbox key and not a skip that stopped working.
            const repeat = call('usp_AppendUsage', "@p_Usage = N'[" + line + "]'");
            assert.ok(!repeat.error, JSON.stringify(repeat.error));
            assert.deepStrictEqual(repeat.value, { appended: 0, rejected: 0, skipped: 1 });
            assert.strictEqual(rowsFor('NEO-CLAUDE'), 1);
            mapConnection('SCOTT-CLAUDE');
        });

        await t.test('the same skip holds for mem.Outcome', () => {
            mapConnection('SCOTT-CLAUDE');
            const id = crypto.randomUUID();
            const json = '[{"segment":"' + segment + '","actionKey":"stamped-' + runId + '",'
                + '"result":"pass","summary":"it worked","at":"2026-09-18T00:00:00Z","stampId":"' + id + '"}]';
            const first = call('usp_AppendOutcomes', "@p_Outcomes = N'" + json + "'");
            assert.ok(!first.error, JSON.stringify(first.error));
            assert.deepStrictEqual(first.value, { appended: 1, skipped: 0 });
            const again = call('usp_AppendOutcomes', "@p_Outcomes = N'" + json + "'");
            assert.ok(!again.error, JSON.stringify(again.error));
            assert.deepStrictEqual(again.value, { appended: 0, skipped: 1 });
            assert.strictEqual(Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) "
                + "FROM mem.Outcome WHERE [StampId] = N'" + id + "';"), 'n')), 1);
        });

        // Two sessions sending the same id at once. A skip read without the
        // range lock passes on both connections and one of them then dies on the
        // index, which fails a whole batch of unrelated stamps with it; the
        // elapsed time is the pin that the second call waited rather than racing.
        await t.test('a concurrent insert of the same stamp id neither duplicates nor fails the batch', async () => {
            mapConnection('SCOTT-CLAUDE');
            const id = crypto.randomUUID();
            const payload = '[{"recordId":' + ids.scottPrivate + ',"kind":"applied",'
                + '"at":"2026-09-18T00:00:00Z","stampId":"' + id + '"}]';
            const holdMs = 5000;
            const spawnedAt = Date.now();
            const holder = sqlConcurrent([
                'BEGIN TRANSACTION;',
                "EXEC mem.usp_AppendUsage @p_Usage = N'" + payload + "';",
                "WAITFOR DELAY '00:00:05';",
                'COMMIT;'
            ].join('\n'));
            // The readiness signal is the holder's own row, read at READ
            // UNCOMMITTED because the insert this waits for sits inside the
            // transaction the holder has not committed yet: a committed read
            // would queue behind that transaction and never answer until it
            // ended. Each poll is its own sqlcmd spawn, which is the interval.
            const holderWrote = () => Number(one(sqlOk([
                'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;',
                "SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) "
                    + "FROM mem.Usage WHERE [StampId] = N'" + id + "';"
            ].join('\n')), 'n'));
            const signalBy = Date.now() + 20000;
            while (holderWrote() === 0) {
                assert.ok(Date.now() < signalBy,
                    'the holding session never wrote its row, so there was nothing for the second call '
                    + 'to queue behind');
            }
            // What is left of the hold, counted from the spawn rather than from
            // the insert, so the login and the spawn are charged to the hold and
            // the floor below is a floor rather than a guess.
            const remaining = holdMs - (Date.now() - spawnedAt);
            assert.ok(remaining > 500, 'this case needs the holder still inside its hold when the '
                + 'second call starts, and ' + remaining + ' ms were left');
            const started = Date.now();
            const second = call('usp_AppendUsage', "@p_Usage = N'" + payload + "'");
            const waited = Date.now() - started;
            const held = await holder;
            assert.strictEqual(held.status, 0, held.stdout + held.stderr);
            assert.ok(!second.error, 'the concurrent batch was refused: ' + JSON.stringify(second.error));
            assert.deepStrictEqual(second.value, { appended: 0, rejected: 0, skipped: 1 },
                'the second session skipped the id the first had written');
            assert.ok(waited >= remaining, 'the second call returned in ' + waited
                + ' ms with ' + remaining + ' ms of the first session\'s hold still to run, so it read '
                + 'the id without waiting on the range lock the first holds');
            assert.strictEqual(Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) "
                + "FROM mem.Usage WHERE [StampId] = N'" + id + "';"), 'n')), 1,
                'and one row exists for the id, never two');
        });

        // The installer never alters a column type, so the two stamp id columns
        // are added. A host that took the schema before they existed holds rows
        // in both tables, and the run that adds the column has to leave them.
        await t.test('a table already holding rows takes the stamp id column and its index', () => {
            const rowsBefore = Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage;"), 'n'));
            assert.ok(rowsBefore > 0, 'this case needs rows in the table the column is added to');
            // The pre-column shape, planted: the index and the column dropped
            // from a table the cases above filled.
            sqlOk([
                "IF EXISTS (SELECT NULL FROM sys.indexes WHERE [object_id] = OBJECT_ID('mem.Usage') AND [name] = 'IX_Usage_SandboxId_StampId')",
                '  DROP INDEX IX_Usage_SandboxId_StampId ON mem.Usage;',
                "IF EXISTS (SELECT NULL FROM sys.columns WHERE [object_id] = OBJECT_ID('mem.Usage') AND [name] = 'StampId')",
                '  ALTER TABLE mem.Usage DROP COLUMN [StampId];'
            ].join('\n'));
            const planted = sqlOk("SELECT 'kittest-has=' + CASE WHEN COL_LENGTH('mem.Usage', 'StampId') IS NULL THEN 'no' ELSE 'yes' END;");
            assert.strictEqual(one(planted, 'has'), 'no', 'the case must actually reach the pre-column shape');

            const added = runInstaller(installerArgs);
            assert.strictEqual(added.status, 0, added.stdout + added.stderr);
            const after = sqlOk([
                "SELECT 'kittest-column=' + CASE WHEN COL_LENGTH('mem.Usage', 'StampId') IS NULL THEN 'no' ELSE 'yes' END;",
                "SELECT 'kittest-nullable=' + CAST(C.[is_nullable] AS VARCHAR(1)) FROM sys.columns C WHERE C.[object_id] = OBJECT_ID('mem.Usage') AND C.[name] = 'StampId';",
                "SELECT 'kittest-index=' + COALESCE((SELECT TOP (1) I.[filter_definition] FROM sys.indexes I WHERE I.[object_id] = OBJECT_ID('mem.Usage') AND I.[name] = 'IX_Usage_SandboxId_StampId'), '<none>');",
                "SELECT 'kittest-rows=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage;"
            ].join('\n'));
            assert.strictEqual(one(after, 'column'), 'yes', 'the installer added the column');
            assert.strictEqual(one(after, 'nullable'), '1',
                'nullable, since the rows already there carry no id');
            assert.strictEqual(one(after, 'index'), '([StampId] IS NOT NULL)',
                'and the unique index is filtered to the rows that do');
            assert.strictEqual(Number(one(after, 'rows')), rowsBefore, 'every row is still there');

            // And the run after it applies no change, which is the re-runnable
            // property the whole installer is held to.
            const again = runInstaller(installerArgs);
            assert.strictEqual(again.status, 0, again.stdout + again.stderr);
            const lines = outputLines(again);
            assert.ok(appliedLabels(lines).every((a) => a.state === 'no change'),
                'a run after the column exists must change nothing:\n' + again.stdout);
        });

        // A unique index cannot be widened in place, so the installer drops the
        // fleet-wide one by name and creates the per-sandbox one beside it. A
        // host that took the earlier shape has to come out the other side
        // holding the newer index and nothing of the older.
        await t.test('a host carrying the fleet-wide stamp id index ends up with the per-sandbox one', () => {
            // The earlier shape, planted on both tables.
            sqlOk([
                "IF EXISTS (SELECT NULL FROM sys.indexes WHERE [object_id] = OBJECT_ID('mem.Usage') AND [name] = 'IX_Usage_SandboxId_StampId')",
                '  DROP INDEX IX_Usage_SandboxId_StampId ON mem.Usage;',
                "IF EXISTS (SELECT NULL FROM sys.indexes WHERE [object_id] = OBJECT_ID('mem.Outcome') AND [name] = 'IX_Outcome_SandboxId_StampId')",
                '  DROP INDEX IX_Outcome_SandboxId_StampId ON mem.Outcome;',
                'CREATE UNIQUE NONCLUSTERED INDEX IX_Usage_StampId ON mem.Usage ([StampId]) WHERE [StampId] IS NOT NULL;',
                'CREATE UNIQUE NONCLUSTERED INDEX IX_Outcome_StampId ON mem.Outcome ([StampId]) WHERE [StampId] IS NOT NULL;'
            ].join('\n'));
            assert.strictEqual(indexKeyOf('mem.Usage', 'IX_Usage_StampId'), 'StampId',
                'the case must actually reach the fleet-wide shape');

            const moved = runInstaller(installerArgs);
            assert.strictEqual(moved.status, 0, moved.stdout + moved.stderr);
            assert.strictEqual(indexKeyOf('mem.Usage', 'IX_Usage_StampId'), '<none>');
            assert.strictEqual(indexKeyOf('mem.Outcome', 'IX_Outcome_StampId'), '<none>');
            assert.strictEqual(indexKeyOf('mem.Usage', 'IX_Usage_SandboxId_StampId'), 'SandboxId,StampId');
            assert.strictEqual(indexKeyOf('mem.Outcome', 'IX_Outcome_SandboxId_StampId'), 'SandboxId,StampId');

            // And the run after it changes nothing, so the move is a step a host
            // takes once rather than on every run.
            const settled = runInstaller(installerArgs);
            assert.strictEqual(settled.status, 0, settled.stdout + settled.stderr);
            assert.ok(appliedLabels(outputLines(settled)).every((a) => a.state === 'no change'),
                'the run after the move must change nothing:\n' + settled.stdout);
        });

        await t.test('usp_ListRecords leaves exactly one mem.QueryLog row per call', () => {
            mapConnection('SCOTT-CLAUDE');
            const count = () => Number(one(sqlOk("SELECT 'kittest-count=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.QueryLog WHERE [ProcedureName] = 'usp_ListRecords';"), 'count'));
            const before = count();
            const listed = listRecords('test-model');
            assert.ok(!listed.error, JSON.stringify(listed.error));
            assert.strictEqual(count(), before + 1, 'exactly one row per call');
            const last = sqlOk("SELECT TOP (1) 'kittest-last=' + [ProcedureName] + ':' + [Login] + ':' + CAST(COALESCE([SandboxId], -1) AS VARCHAR(10)) + ':' + CAST([RowCount] AS VARCHAR(10)) + ':' + [ParametersDigest] FROM mem.QueryLog WHERE [ProcedureName] = 'usp_ListRecords' ORDER BY [QueryLogId] DESC;");
            const digest = crypto.createHash('sha256').update(Buffer.from('test-model', 'latin1')).digest('hex').toUpperCase();
            assert.strictEqual(one(last, 'last'),
                'usp_ListRecords:' + me + ':' + ids.scott + ':' + listed.rows.length + ':' + digest,
                'the log row names the caller, the resolved sandbox, the row count and the model digest');
            mapConnection(null);
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
