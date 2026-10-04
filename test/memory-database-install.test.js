// Tests for the memory database installer,
// plugins/grimoire/db/Install-MemoryDatabase.ps1, and the schema, procedures
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
const DB_DIR = path.join(REPO, 'plugins', 'grimoire', 'db');
// The publisher itself, for the one case that drives its real transport
// against the run's database rather than against a fake.
const client = require(path.join(REPO, 'plugins', 'grimoire', 'scripts', 'memory-database.js'));
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
            path.join(REPO, 'plugins', 'grimoire', 'db', 'Procedures', file), 'utf8');
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
        path.join(REPO, 'plugins', 'grimoire', 'db', 'Procedures', '110-usp_Nearest.sql'), 'utf8');
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

// The judged pointer outcome's four fields cross three surfaces: the client
// composes them into the outcome row the queue holds, mem.usp_AppendOutcomes
// reads them out of that JSON by name, and mem.Outcome holds them. Each side
// tested against its own literal leaves a renamed key reaching the host as a
// NULL with nothing red, so the procedure's paths are read against the keys
// the client actually writes. The columns are nullable with no default, and a
// column added to a host that predates it is guarded the way StampId is, so a
// second install run changes nothing.
function sqlCode(dir, file) {
    const src = fs.readFileSync(path.join(DB_DIR, dir, file), 'utf8');
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

test('the four pointer fields the client writes are the ones usp_AppendOutcomes reads and mem.Outcome holds', () => {
    const row = client.outcomeEntry('a-segment', {
        ts: '2026-09-23T10:00:00.000Z', key: 'kit.jev.pointer', outcome: 'pass', summary: 'a-record',
        recognitionId: '00000000-0000-4000-8000-000000000000', score: 0.8, rank: 3, shown: true
    });
    const plain = client.outcomeEntry('a-segment', {
        ts: '2026-09-23T10:00:00.000Z', key: 'kit.first', outcome: 'pass', summary: 'a log row'
    });
    const pointerKeys = Object.keys(row).filter((k) => !(k in plain));
    assert.deepStrictEqual(pointerKeys.sort(), ['recognitionId', 'score', 'shown', 'vectorRank'],
        'the client adds four keys to a pointer row and none to a logged one');
    const columnOf = { recognitionId: 'RecognitionId', score: 'Score', vectorRank: 'VectorRank', shown: 'Shown' };

    const append = sqlCode('Procedures', '070-usp_AppendOutcomes.sql');
    const table = sqlCode('Schema', '090-Outcome.sql');
    for (const key of pointerKeys) {
        const column = columnOf[key];
        assert.match(append, new RegExp('\\[' + column + '\\]\\s+\\w+(\\(\\d+\\))?\\s+\'\\$\\.' + key + '\''),
            'usp_AppendOutcomes reads $.' + key + ' into [' + column + ']');
        assert.match(append, new RegExp('INSERT INTO mem\\.Outcome \\([^)]*\\[' + column + '\\]'),
            'and inserts [' + column + '] into mem.Outcome');
        const declared = new RegExp(',\\[' + column + '\\]\\s+[A-Z]+(\\(\\d+\\))?\\s+NULL\\s*\\n').exec(table);
        assert.ok(declared, 'mem.Outcome declares [' + column + '] nullable with no default');
        assert.match(table, new RegExp('C\\.\\[name\\] = \'' + column + '\'[\\s\\S]*?ALTER TABLE mem\\.Outcome ADD \\['
            + column + '\\] [A-Z]+(\\(\\d+\\))? NULL\\s'),
            'a host that predates [' + column + '] gains it under a column guard, nullable with no default');
    }
});

// mem.usp_JevCalibration reads across every sandbox, which no other publisher
// read does, on the ground that it returns per-band counts and no field of any
// record. So what it projects is pinned to those counts, the procedure is
// created shell-then-ALTER so a re-run keeps its grant, every call leaves its
// mem.QueryLog row, and the publisher role gains EXECUTE on it while its denial
// of SELECT on the schema stands.
test('usp_JevCalibration projects band counts and no record field, logs each call, and only a publisher executes it', () => {
    const file = fs.readdirSync(path.join(DB_DIR, 'Procedures')).find((n) => /usp_JevCalibration\.sql$/.test(n));
    assert.ok(file, 'the procedure ships under Procedures/');
    const code = sqlCode('Procedures', file);
    assert.match(code, /IF OBJECT_ID\('mem\.usp_JevCalibration', 'P'\) IS NULL\s+EXEC \('CREATE PROCEDURE mem\.usp_JevCalibration AS RETURN 0;'\)/,
        'a shell is created once and the definition is an ALTER, so a re-run keeps the grant');
    assert.match(code, /;ALTER PROCEDURE mem\.usp_JevCalibration/);
    const projected = [...code.matchAll(/[,\s]\[(\w+)\]\s*=\s*C\.\[/g)].map((m) => m[1]);
    assert.deepStrictEqual(projected.sort(), ['band', 'reads', 'rows'],
        'the answer is the three counts per band: ' + JSON.stringify(projected));
    assert.match(code, /FOR JSON PATH/);
    assert.doesNotMatch(code, /mem\.Record\b|\[Summary\]|\[Detail\]|\[Name\]/,
        'no record table and no text column is read');
    assert.match(code, /INSERT INTO mem\.QueryLog \(/, 'every call leaves a query log row');
    assert.match(code, /\[Login\]\s*=\s*ORIGINAL_LOGIN\(\)/, 'under the login the connection opened');

    const roles = sqlCode('Security', '010-Roles.sql');
    assert.match(roles, /;GRANT EXECUTE ON OBJECT::mem\.usp_JevCalibration\s+TO mem_publisher/);
    assert.match(roles, /;DENY SELECT ON SCHEMA::mem TO mem_publisher/,
        'the publisher still cannot read mem.Outcome directly');
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
            // (docs/plans/claude-kit_memory-database_spec_v1.md), plus
            // usp_JevCalibration, the judged fleet pointer counts per score
            // band that `memq jev-calibration` reads under this login
            // (docs/plans/claude-kit_jev-recollection-judge_spec_v1.md), plus
            // the record door, usp_PutRecord, usp_GetRecord, usp_ListIndex and
            // usp_ArchiveRecord, through which memq writes and reads a record,
            // plus usp_AdoptProjectStore, through which db-sync moves a folder's
            // records into its remote key
            // (docs/plans/claude-kit_memory-in-sql_spec_v1.md).
            const publisherProcs = ['usp_AdoptProjectStore', 'usp_AppendOutcomes', 'usp_AppendPublishRun', 'usp_AppendUsage', 'usp_ArchiveRecord',
                'usp_GetRecord', 'usp_Health', 'usp_JevCalibration', 'usp_ListIndex', 'usp_ListRecords', 'usp_Nearest',
                'usp_PutRecord', 'usp_Search', 'usp_UpsertEmbeddings', 'usp_UpsertIndexOrphans', 'usp_UpsertRecords'];
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
                "UPDATE mem.Sandbox SET [PublisherLogin] = N'kit_asr_claude' WHERE [Name] = N'ASR-CLAUDE';",
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

        await t.test('usp_Search as SCOTT serves NEO\'s older-store project row, its shared row and SCOTT\'s own', () => {
            // A project's records are the fleet's, so a private row of another
            // sandbox's older store reaches every mapped sandbox. Vector list:
            // the query vector is the shared row's own axis, and the two
            // private rows sit at equal distance from it, so every visible row
            // ranks. The connection is SCOTT's publisher by data.
            mapConnection('SCOTT-CLAUDE');
            const scott = call('usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!scott.error, JSON.stringify(scott.error));
            const scottIds = idsOf(scott.value);
            assert.ok(scottIds.includes(ids.neoShared), 'the shared row is missing from SCOTT\'s result: ' + JSON.stringify(scott.value));
            assert.ok(scottIds.includes(ids.scottPrivate), 'SCOTT\'s own private row is missing: ' + JSON.stringify(scott.value));
            assert.ok(scottIds.includes(ids.neoPrivate), 'NEO\'s project row must reach SCOTT: ' + JSON.stringify(scott.value));
            assert.ok(JSON.stringify(scott.value).includes(tokens.neoPrivate), 'NEO\'s project row\'s description must reach SCOTT');
            assert.strictEqual(scott.value.find((r) => r.recordId === ids.neoShared).sandbox, 'NEO-CLAUDE');
            assert.strictEqual(scott.value.find((r) => r.recordId === ids.neoShared).vectorLiveRank, 1);
            assert.strictEqual(scott.value.find((r) => r.recordId === ids.neoShared).visibility, 'shared');

            // The other direction: NEO is served SCOTT's project row the same way.
            mapConnection('NEO-CLAUDE');
            const neo = call('usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!neo.error, JSON.stringify(neo.error));
            assert.ok(idsOf(neo.value).includes(ids.neoPrivate), 'NEO cannot see its own private row: ' + JSON.stringify(neo.value));
            assert.ok(idsOf(neo.value).includes(ids.scottPrivate), 'SCOTT\'s project row must reach NEO: ' + JSON.stringify(neo.value));
            assert.ok(JSON.stringify(neo.value).includes(tokens.scottPrivate), 'SCOTT\'s project row\'s description must reach NEO');
        });

        await t.test('impersonating a mapped sandbox\'s user does not map an unmapped connection', () => {
            // The guard ORIGINAL_LOGIN() exists for: with the connection mapped
            // to no sandbox, a call that runs as NEO's database user still
            // reads as the unmapped connection and is served nothing, and the
            // log row pairs the two logins. Mapped, the same call is served.
            mapConnection(null);
            const asNeo = callAs('kit_neo_claude', 'usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!asNeo.error, JSON.stringify(asNeo.error));
            assert.deepStrictEqual(asNeo.value, [], 'TENANCY MOVED: impersonating NEO\'s user served an unmapped connection: ' + JSON.stringify(asNeo.value));
            const logged = sqlOk("SELECT TOP (1) 'kittest-log=' + [Login] + '|' + [SessionLogin] + '|' + CAST(COALESCE([SandboxId], -1) AS VARCHAR(10)) FROM mem.QueryLog ORDER BY [QueryLogId] DESC;");
            assert.strictEqual(one(logged, 'log'), me + '|kit_neo_claude|-1', 'the log must name the resolved login and the impersonated context');

            // The control, withheld from the assertion above: the same call on
            // the connection mapped to SCOTT is served, and logs SCOTT.
            mapConnection('SCOTT-CLAUDE');
            const mapped = callAs('kit_neo_claude', 'usp_Search', searchParams, vectorPrelude(0));
            assert.ok(!mapped.error, JSON.stringify(mapped.error));
            assert.ok(idsOf(mapped.value).includes(ids.scottPrivate), 'the connection\'s own sandbox must be served: ' + JSON.stringify(mapped.value));
            const loggedMapped = sqlOk("SELECT TOP (1) 'kittest-log=' + [Login] + '|' + [SessionLogin] + '|' + CAST(COALESCE([SandboxId], -1) AS VARCHAR(10)) FROM mem.QueryLog ORDER BY [QueryLogId] DESC;");
            assert.strictEqual(one(loggedMapped, 'log'), me + '|kit_neo_claude|' + ids.scott, 'the log must name the connection\'s sandbox, not the impersonated user\'s');
        });

        await t.test('usp_Search over the full-text lists holds the same line', () => {
            // Population is asynchronous under CHANGE_TRACKING AUTO, so the
            // lexical query is retried until the mapped sandbox gets the
            // three seeded rows it may see, with a bound that fails loudly.
            const lexical = "@p_QueryText = N'" + common + "', @p_Limit = 10";
            const deadline = Date.now() + 90000;
            function lexicalAs(sandbox) {
                mapConnection(sandbox);
                for (;;) {
                    const res = call('usp_Search', lexical);
                    assert.ok(!res.error, JSON.stringify(res.error));
                    if (res.value.length >= 3) return res.value;
                    if (Date.now() > deadline) {
                        const state = sqlOk("SELECT 'kittest-ft=' + CAST(FULLTEXTCATALOGPROPERTY('KitMemoryCatalog', 'PopulateStatus') AS VARCHAR(10)) + ':' + CAST(OBJECTPROPERTYEX(OBJECT_ID('mem.Record'), 'TableFullTextPendingChanges') AS VARCHAR(10));");
                        assert.fail('the full-text index did not serve the seeded rows to ' + sandbox + ' within 90 s (PopulateStatus:PendingChanges = ' + one(state, 'ft') + '): ' + JSON.stringify(res.value));
                    }
                    sleep(1000);
                }
            }
            const seeded = [ids.neoPrivate, ids.neoShared, ids.scottPrivate].sort();
            const neo = lexicalAs('NEO-CLAUDE');
            assert.deepStrictEqual(idsOf(neo).sort(), seeded,
                'a row is missing or extra on NEO\'s lexical path: ' + JSON.stringify(neo));
            assert.ok(neo.every((r) => r.descriptionRank !== null), 'the description list must have voted: ' + JSON.stringify(neo));
            assert.ok(JSON.stringify(neo).includes(tokens.scottPrivate), 'SCOTT\'s project row\'s description must reach NEO');
            const scott = lexicalAs('SCOTT-CLAUDE');
            assert.deepStrictEqual(idsOf(scott).sort(), seeded,
                'a row is missing or extra on SCOTT\'s lexical path: ' + JSON.stringify(scott));
            assert.ok(JSON.stringify(scott).includes(tokens.neoPrivate), 'NEO\'s project row\'s description must reach SCOTT');

            // Token hygiene: a query of ASCII punctuation alone has nothing
            // to search and returns no rows and no error, while punctuation
            // around a real word is stripped from the predicate's reach.
            const noise = call('usp_Search', "@p_QueryText = N'!!! ,,, ... ---'");
            assert.ok(!noise.error, JSON.stringify(noise.error));
            assert.deepStrictEqual(noise.value, []);
            const wrapped = call('usp_Search', "@p_QueryText = N'--- " + common + " ***'");
            assert.ok(!wrapped.error, JSON.stringify(wrapped.error));
            assert.deepStrictEqual(idsOf(wrapped.value).sort(), seeded, JSON.stringify(wrapped.value));

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
            assert.deepStrictEqual(idsOf(quoted.value).sort(), seeded, JSON.stringify(quoted.value));
        });

        await t.test('usp_Nearest serves every project\'s rows in both directions', () => {
            mapConnection('SCOTT-CLAUDE');
            const scott = call('usp_Nearest', nearestParams, vectorPrelude(2));
            assert.ok(!scott.error, JSON.stringify(scott.error));
            const scottIds = idsOf(scott.value);
            assert.strictEqual(scott.value[0].recordId, ids.neoPrivate, 'NEO\'s project row is the nearest of all and must reach SCOTT first: ' + JSON.stringify(scott.value));
            assert.ok(scottIds.includes(ids.neoShared) && scottIds.includes(ids.scottPrivate), JSON.stringify(scott.value));
            mapConnection('NEO-CLAUDE');
            const neo = call('usp_Nearest', nearestParams, vectorPrelude(2));
            assert.ok(!neo.error, JSON.stringify(neo.error));
            assert.strictEqual(neo.value[0].recordId, ids.neoPrivate, 'NEO\'s own private row is the nearest and must come first: ' + JSON.stringify(neo.value));
            assert.ok(Math.abs(neo.value[0].distance) < 1e-6, 'a row on the query axis must be at cosine distance zero within float32: ' + neo.value[0].distance);
            assert.ok(idsOf(neo.value).includes(ids.scottPrivate), 'SCOTT\'s project row must reach NEO');
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

        // A publish run that ended on an error published nothing it could
        // stand behind, so the health answer's lastPublish is the last run
        // carrying no error text. NEO-CLAUDE publishes in no other live case
        // here, so its runs are this case's alone: first a failed run by
        // itself, which must read null, then an earlier clean one, which must
        // be the value read over the later failure.
        await t.test('usp_Health reads the last publish run that carried no error', () => {
            mapConnection('NEO-CLAUDE');
            try {
                const append = (run) => {
                    const res = call('usp_AppendPublishRun', "@p_Run = N'" + JSON.stringify(run).replace(/'/g, "''") + "'");
                    assert.ok(!res.error, JSON.stringify(res.error));
                };
                const neoLastPublish = () => {
                    const health = call('usp_Health', "@p_ModelIdentity = 'test-model'");
                    assert.ok(!health.error, JSON.stringify(health.error));
                    const neo = health.value.sandboxes.find((s) => s.sandbox === 'NEO-CLAUDE');
                    assert.ok(neo, 'the health answer names no NEO-CLAUDE entry: ' + JSON.stringify(health.value));
                    return neo.lastPublish;
                };
                const failedAt = '2026-09-20T10:00:00+00:00';
                const cleanAt = '2026-09-19T10:00:00+00:00';
                append({ started: failedAt, finished: failedAt, error: 'usp_UpsertRecords refused the batch' });
                assert.strictEqual(neoLastPublish(), null, 'a sandbox whose only run failed has no clean publish');
                append({ started: cleanAt, finished: cleanAt, added: 1 });
                const read = neoLastPublish();
                assert.ok(read !== null, 'the clean run was not read');
                assert.strictEqual(new Date(read).getTime(), new Date(cleanAt).getTime(),
                    'lastPublish is the clean run, not the later failed one: ' + read);
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
            const memq = require(path.join(REPO, 'plugins', 'grimoire', 'scripts', 'memq.js'));
            const mi = require(path.join(REPO, 'plugins', 'grimoire', 'scripts', 'memory-index.js'));
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
            assert.deepStrictEqual(idsOf(lexicalAsPublisher.value).sort(), [ids.neoPrivate, ids.neoShared, ids.scottPrivate].sort(),
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
            assert.deepStrictEqual(dup.value, { added: 1, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0, held: 0, twins: [] });
            const dupRow = sqlOk("SELECT 'kittest-dup=' + [Description] + ':' + [BodyHash] FROM mem.Record WHERE [Name] = N'dup-" + runId + "';");
            assert.strictEqual(one(dupRow, 'dup'), 'last:h6', 'the last entry for a key must win');

            const record = {
                tier: 'project', segment: 'seg-up-' + runId, name: 'up-' + runId, fileKey: 'up.md',
                description: 'published through the procedure ' + runId, body: 'body', bodyHash: 'h4',
                fileModified: '2026-09-17T12:00:00Z', machine: 'TEST', tags: ['t'], supersedes: null, archived: false
            };
            const upsert = callAs('kit_scott_claude', 'usp_UpsertRecords', "@p_Records = N'" + JSON.stringify([record]) + "'");
            assert.ok(!upsert.error, JSON.stringify(upsert.error));
            assert.deepStrictEqual(upsert.value, { added: 1, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0, held: 0, twins: [] });
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
            assert.deepStrictEqual(published.value, { added: 1, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0, held: 0, twins: [] });
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
            // The predicate the refused calls are read with: the source row's
            // visibility and archived flag, and the operator store's rows of
            // that name, which the curator call below proves it can fill.
            const promotedState = () => sqlOk([
                "SELECT 'kittest-vis=' + [Visibility] + ':' + CAST([IsArchived] AS VARCHAR(1)) FROM mem.Record WHERE [RecordId] = " + ids.neoPrivate + ';',
                "SELECT 'kittest-copies=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record R INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]",
                "WHERE S.[Tier] = 'operator' AND R.[Name] = N'neo-private-" + runId + "';"
            ].join('\n'));
            const still = promotedState();
            assert.strictEqual(one(still, 'vis'), 'private:0', 'a refused promotion must leave the project row live');
            assert.strictEqual(one(still, 'copies'), '0', 'a refused promotion must write no operator row');

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

            // The version 6 shape, by sandbox and segment, moves the row: the
            // operator store takes a copy with its vector, and the project
            // row is archived rather than deleted.
            const curator = callAs('kit_curator', 'usp_PromoteRecord', promote);
            assert.ok(!curator.error, JSON.stringify(curator.error));
            const moved = curator.value;
            assert.deepStrictEqual({ name: moved.name, tier: moved.tier, visibility: moved.visibility, archivedRecordId: moved.archivedRecordId },
                { name: 'neo-private-' + runId, tier: 'operator', visibility: 'shared', archivedRecordId: ids.neoPrivate });
            assert.notStrictEqual(moved.recordId, ids.neoPrivate, 'the operator row is a new row, not the project row flipped');
            const after = promotedState();
            assert.strictEqual(one(after, 'vis'), 'private:1', 'the project row is archived and keeps its visibility');
            assert.strictEqual(one(after, 'copies'), '1', 'the operator store holds the one copy');
            const copied = sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Embedding WHERE [RecordId] = " + moved.recordId + ';');
            assert.strictEqual(one(copied, 'n'), '1', 'the operator row carries the project row\'s vector');
            // The operator row now ranks first on the live list, and the
            // project row only on the archived one.
            mapConnection('SCOTT-CLAUDE');
            const scott = call('usp_Search', searchParams, vectorPrelude(2));
            assert.ok(!scott.error, JSON.stringify(scott.error));
            const liveFirst = scott.value.find((r) => r.vectorLiveRank === 1);
            assert.ok(liveFirst && liveFirst.recordId === moved.recordId && liveFirst.tier === 'operator',
                'the promoted row must reach SCOTT from the operator store: ' + JSON.stringify(scott.value));
            assert.strictEqual(scott.value.find((r) => r.recordId === ids.neoPrivate).archived, true, JSON.stringify(scott.value));
            // A second promotion of the name finds no live project row and is refused.
            const again = callAs('kit_curator', 'usp_PromoteRecord', promote);
            assert.ok(again.error && again.error.number === 50000 && again.error.message.includes('no live project record'),
                'a second promotion must be refused by the live-row rule: ' + JSON.stringify(again));
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

            // The segment joins the digest's input after the text with no
            // separator, so the same call scoped logs apart from the call
            // above, whose digest is the text's alone.
            const scopedSegment = 'seg-digest-' + runId;
            const scoped = call('usp_Search', "@p_QueryText = N'" + queryText + "', @p_Limit = 5, @p_Segment = N'"
                + scopedSegment.replace(/'/g, "''") + "'");
            assert.ok(!scoped.error, JSON.stringify(scoped.error));
            const scopedDigest = one(readLog(), 'last').split(':').pop();
            assert.notStrictEqual(scopedDigest, digest, 'a scoped search must log a digest apart from the same search unscoped');
            assert.strictEqual(scopedDigest,
                crypto.createHash('sha256').update(Buffer.from(queryText + scopedSegment, 'utf16le')).digest('hex').toUpperCase(),
                'the scoped digest is the text followed by the segment, bare');

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

        // The segment and tag cut. SCOTT holds two project segments, A and B.
        // Around A sit the rows the cut must drop however close their name:
        // NEO's private row in a store of NEO's own named A, and a shared type
        // store also named A, so the tier half of the predicate has a row to
        // refuse. In A itself, beside a tagged row, sit a row whose Tags is
        // NULL, one whose Tags is the empty array the publisher sends for an
        // untagged record, one whose Tags is a JSON object holding the tag as a
        // value rather than an array holding it, and a promoted row, shared but
        // still in A. In B, a tagged record is superseded by an untagged one in
        // the same store, so a tag that drops the superseder must not lift the
        // demotion. A Tags value that is not JSON cannot be seeded:
        // CK_Record_Tags refuses it.
        // Every fixture row sits on one vector axis no other seeded record
        // uses, so a search along it ranks every fixture row the caller may see
        // at distance zero, and a row can be missing from a scoped answer only
        // by the cut. The drop side is asserted as whole-answer equality: a
        // scoped answer holding any row beyond the ones named fails, whatever
        // that row is.
        await t.test('usp_Search narrows to a segment and a tag inside the visible set and never widens it', () => {
            const segA = 'scope-a-' + runId;
            const segB = 'scope-b-' + runId;
            const tag = 'scopetag' + letters(8);
            const scopeWord = 'scopeword' + letters(8);
            const scopeAxis = 500;
            const text = (value) => "N'" + value.replace(/'/g, "''") + "'";
            const rows = [
                ['aTagged', '@storeA', 'private', '@scott', JSON.stringify(['other', tag])],
                ['aNullTags', '@storeA', 'private', '@scott', null],
                ['aEmptyTags', '@storeA', 'private', '@scott', '[]'],
                ['aObjectTags', '@storeA', 'private', '@scott', JSON.stringify({ k: tag })],
                ['aPromoted', '@storeA', 'shared', '@scott', JSON.stringify([tag])],
                ['bTagged', '@storeB', 'private', '@scott', JSON.stringify([tag])],
                ['bNullTags', '@storeB', 'private', '@scott', null],
                ['bSuperseded', '@storeB', 'private', '@scott', JSON.stringify([tag])],
                ['bSupersedes', '@storeB', 'private', '@scott', null, 'bSuperseded'],
                ['typeNamedA', '@typeA', 'shared', '@scott', JSON.stringify([tag])],
                ['neoNamedA', '@neoA', 'private', '@neo', JSON.stringify([tag])]
            ];
            const seeded = sqlOk([
                "DECLARE @neo INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'NEO-CLAUDE');",
                "DECLARE @scott INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'SCOTT-CLAUDE');",
                "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (@scott, 'project', " + text(segA) + ');',
                'DECLARE @storeA INT = SCOPE_IDENTITY();',
                "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (@scott, 'project', " + text(segB) + ');',
                'DECLARE @storeB INT = SCOPE_IDENTITY();',
                "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (@neo, 'project', " + text(segA) + ');',
                'DECLARE @neoA INT = SCOPE_IDENTITY();',
                "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (NULL, 'type', " + text(segA) + ');',
                'DECLARE @typeA INT = SCOPE_IDENTITY();',
                'DECLARE @id BIGINT;',
                ...rows.flatMap(([key, store, visibility, publisher, tags, supersedes]) => [
                    'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId], [Tags], [SupersedesName])',
                    'VALUES (' + store + ', ' + text('scope-' + key + '-' + runId) + ', ' + text('scope-' + key + '.md') + ', '
                        + text(scopeWord + ' ' + key) + ", N'body', 'hs', '" + visibility + "', " + publisher + ', '
                        + (tags === null ? 'NULL' : text(tags)) + ', '
                        + (supersedes === undefined ? 'NULL' : text('scope-' + supersedes + '-' + runId)) + ');',
                    'SET @id = SCOPE_IDENTITY();',
                    'INSERT INTO mem.Embedding ([RecordId], [ChunkIndex], [ModelIdentity], [ChunkOffset], [ChunkLength], [Vector], [Dimensions])',
                    "VALUES (@id, 0, 'test-model', 0, 4, CAST(N'" + axisVector(scopeAxis) + "' AS VECTOR(" + DIMENSIONS + ')), ' + DIMENSIONS + ');',
                    "SELECT 'kittest-" + key + "=' + CAST(@id AS VARCHAR(20));"
                ])
            ].join('\n'));
            const fx = {};
            for (const [key] of rows) fx[key] = Number(one(seeded, key));
            const fixtureIds = Object.values(fx);
            const named = (...keys) => keys.map((k) => fx[k]).sort((a, b) => a - b);
            const sorted = (list) => list.slice().sort((a, b) => a - b);

            const scopedParams = (segment, tagValue) => "@p_QueryVector = @v, @p_ModelIdentity = 'test-model', @p_Limit = 50"
                + (segment === null ? '' : ', @p_Segment = ' + text(segment))
                + (tagValue === null ? '' : ', @p_Tag = ' + text(tagValue));
            const searchAs = (segment, tagValue) => {
                const res = call('usp_Search', scopedParams(segment, tagValue), vectorPrelude(scopeAxis));
                assert.ok(!res.error, 'a scoped search raised: ' + JSON.stringify(res.error));
                return res.value;
            };

            try {
                mapConnection('SCOTT-CLAUDE');

                // No parameter: every fixture row, both segments, the promoted
                // and the type rows, the NULL and empty Tags rows, and NEO's
                // older-store row, since every project row reaches every
                // mapped sandbox. This answer is the control for every
                // absence below: each row a scoped call drops is one this
                // call proves reachable.
                const none = searchAs(null, null);
                assert.deepStrictEqual(sorted(idsOf(none).filter((id) => fixtureIds.includes(id))),
                    named('aTagged', 'aNullTags', 'aEmptyTags', 'aObjectTags', 'aPromoted', 'bTagged', 'bNullTags',
                        'bSuperseded', 'bSupersedes', 'typeNamedA', 'neoNamedA'),
                    'the unscoped search serves every fixture row: ' + JSON.stringify(none));
                assert.ok(idsOf(none).includes(fx.neoNamedA), 'NEO\'s project row must reach SCOTT unscoped');

                // Segment A, the version 6 scope: the rows of SCOTT's own store
                // named A and the shared row in it, and nothing else. B's rows,
                // the type store named A and NEO's private store named A are
                // all dropped, which is the answer version 6 gave this call.
                const segmentA = searchAs(segA, null);
                assert.deepStrictEqual(sorted(idsOf(segmentA)), named('aTagged', 'aNullTags', 'aEmptyTags', 'aObjectTags', 'aPromoted'),
                    'segment A must answer A\'s rows alone: ' + JSON.stringify(segmentA));
                assert.ok(segmentA.every((r) => r.tier === 'project' && r.segment === segA), JSON.stringify(segmentA));

                // Segment A and the tag: A's two tagged rows. The NULL Tags row
                // and the empty Tags row are dropped, and so is the object Tags
                // row, which the untagged call above returned.
                const segmentATagged = searchAs(segA, tag);
                assert.deepStrictEqual(sorted(idsOf(segmentATagged)), named('aTagged', 'aPromoted'),
                    'segment A with the tag must answer A\'s tagged rows alone: ' + JSON.stringify(segmentATagged));
                assert.ok(idsOf(segmentA).includes(fx.aObjectTags) && !idsOf(segmentATagged).includes(fx.aObjectTags),
                    'a Tags object holding the tag as a value is served untagged and dropped by the tag');

                // The tag alone: tagged rows from both segments, the tagged
                // shared type row and NEO's tagged row, never the NULL or
                // empty Tags rows.
                const tagOnly = searchAs(null, tag);
                assert.deepStrictEqual(sorted(idsOf(tagOnly)), named('aTagged', 'aPromoted', 'bTagged', 'bSuperseded', 'typeNamedA', 'neoNamedA'),
                    'the tag alone must answer the tagged rows SCOTT may see: ' + JSON.stringify(tagOnly));

                // Supersession is read over the whole visible set, so the tag that
                // drops the untagged superseder leaves the superseded record
                // demoted. No boost applies, so a row's score over its fused score
                // is its multiplier; the unscoped answer is the control that the
                // demotion exists at all.
                const multiplierOf = (answer) => {
                    const row = answer.find((r) => r.recordId === fx.bSuperseded);
                    assert.ok(row, 'the superseded record is missing: ' + JSON.stringify(answer));
                    return row.score / row.fusedScore;
                };
                assert.ok(Math.abs(multiplierOf(none) - 0.5) < 1e-9, 'the unscoped answer demotes the superseded record: ' + multiplierOf(none));
                assert.ok(Math.abs(multiplierOf(tagOnly) - 0.5) < 1e-9,
                    'a tag that drops the superseder must not lift the demotion: multiplier ' + multiplierOf(tagOnly));

                // The withheld control for NEO's row: re-pointed at NEO, segment
                // A answers NEO's own row, beside SCOTT's promoted row, which is
                // shared and still in a store named A, and none of SCOTT's
                // private rows.
                mapConnection('NEO-CLAUDE');
                const neoA = searchAs(segA, null);
                assert.deepStrictEqual(sorted(idsOf(neoA)), named('neoNamedA', 'aPromoted'),
                    'segment A as NEO must answer NEO\'s own row and the promoted row alone: ' + JSON.stringify(neoA));

                // An unmapped login gets nothing for a scoped call either.
                mapConnection(null);
                assert.deepStrictEqual(searchAs(segA, null), [], 'a scoped search served rows to an unmapped login');
                assert.deepStrictEqual(searchAs(null, tag), [], 'a tagged search served rows to an unmapped login');

                // The same cut through the client's own transport, the route a
                // host case takes: the two parameters travel as the text
                // literals callProcedure writes, over a lexical query. The
                // full-text index populates asynchronously, so the unscoped
                // lexical answer is awaited first, bounded and loud.
                mapConnection('SCOTT-CLAUDE');
                const deadline = Date.now() + 90000;
                for (;;) {
                    const res = call('usp_Search', '@p_QueryText = ' + text(scopeWord) + ', @p_Limit = 50');
                    assert.ok(!res.error, JSON.stringify(res.error));
                    if (res.value.length >= 10) break;
                    if (Date.now() > deadline) assert.fail('the full-text index did not serve the scope fixture within 90 s: ' + JSON.stringify(res.value));
                    sleep(1000);
                }
                const clientConfig = {
                    server: SERVER, database: dbName, login: '', password: '',
                    timeoutMs: 30000, windowsAuth: true, trustServerCertificate: true,
                    embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
                };
                const viaClient = client.callProcedure(clientConfig, 'usp_Search',
                    { '@p_QueryText': scopeWord, '@p_Segment': segA, '@p_Tag': tag, '@p_Limit': '50' });
                assert.ok(viaClient.ok, JSON.stringify(viaClient));
                const clientRows = Array.isArray(viaClient.rows[0]) ? viaClient.rows[0] : [];
                assert.deepStrictEqual(sorted(idsOf(clientRows)), named('aTagged', 'aPromoted'),
                    'the client transport carries the segment and the tag: ' + JSON.stringify(clientRows));
            } finally {
                mapConnection(null);
            }
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
            // One type-tier record, which the publish's own inventory read
            // lists and its embedding leg therefore embeds, long enough to
            // take several chunks: the record the embedding assertions read.
            const typeName = 'livetype-' + runId;
            const typeDir = path.join(publishRoot, 'memory-types', typeName);
            const typeBody = '# typed\n\n' + ('a typed sentence that repeats itself. '.repeat(400)) + '\n';
            const typeChunks = client.chunkBody(typeBody).length;
            assert.ok(typeChunks > 1, 'the typed record takes several chunks: ' + typeChunks);
            fs.mkdirSync(typeDir, { recursive: true });
            fs.writeFileSync(path.join(typeDir, 'typed-long.md'), typeBody, 'utf8');
            fs.writeFileSync(path.join(typeDir, 'MEMORY.md'),
                '# Memory\n- [typed-long](typed-long.md) - the type record the live transport case embeds\n', 'utf8');

            const clientConfig = {
                server: SERVER, database: dbName, login: '', password: '',
                timeoutMs: 30000, windowsAuth: true, trustServerCertificate: true,
                embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
            };
            // Every embedding call's texts, so the case can read how many
            // chunks rode one call.
            const embedCalls = [];
            const vectors = (texts) => {
                embedCalls.push(texts.length);
                return {
                    ok: true,
                    vectors: texts.map((text, at) => {
                        const v = new Array(DIMENSIONS).fill(0);
                        v[at % DIMENSIONS] = 1;
                        return v;
                    })
                };
            };

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
            assert.strictEqual(result.summary.added, 4, JSON.stringify(result.summary));
            // The project records land in the folder key's fleet store, which
            // the publish's own inventory read, held to the sandbox's own rows,
            // does not list, so its embedding leg embeds the type record alone.
            assert.strictEqual(result.summary.embedded, 1, JSON.stringify(result.summary));

            // The bodies on the server are the bodies on disk, byte for byte,
            // which is what the ASCII escaping and the doubled quotes exist
            // for: a batch the tool cut, substituted or re-encoded would show
            // up here and nowhere else.
            for (const [name, body] of Object.entries(bodies)) {
                const stored = sqlOk([
                    "DECLARE @b NVARCHAR(MAX) = (SELECT R.[Body] FROM mem.Record R INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]",
                    "    WHERE S.[ProjectKey] = N'path:" + segment + "' AND R.[FileKey] = N'" + name + ".md');",
                    "SELECT 'kittest-len=' + CAST(LEN(@b) AS VARCHAR(20));",
                    "SELECT 'kittest-hash=' + CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @b), 2);"
                ].join('\n'));
                const digest = crypto.createHash('sha256')
                    .update(Buffer.from(body, 'utf16le')).digest('hex').toUpperCase();
                assert.strictEqual(one(stored, 'hash'), digest,
                    'the stored body of ' + name + ' is not the file\'s text');
                assert.strictEqual(Number(one(stored, 'len')), body.length, name + ' lost or gained characters');
            }

            // The three rows are the folder key's, in a fleet store, as file rows.
            const landed = sqlOk("SELECT 'kittest-landed=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record R INNER JOIN mem.Store S"
                + " ON S.[StoreId] = R.[StoreId] WHERE S.[ProjectKey] = N'path:" + segment + "' AND S.[SandboxId] IS NULL"
                + " AND R.[Origin] = 'file' AND R.[DeletedDt] IS NULL;");
            assert.strictEqual(one(landed, 'landed'), '3');

            // The type record's embeddings landed through the real procedure at
            // the real width, one row per chunk, its several chunks riding one
            // embedding call.
            const counts = sqlOk([
                "SELECT 'kittest-rows=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Embedding E",
                'INNER JOIN mem.Record R ON R.[RecordId] = E.[RecordId]',
                'INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]',
                "WHERE S.[Tier] = 'type' AND S.[Segment] = N'" + typeName + "' AND E.[ModelIdentity] = 'test-model';",
                "SELECT 'kittest-dims=' + CAST(MIN(E.[Dimensions]) AS VARCHAR(10)) + ':' + CAST(MAX(E.[Dimensions]) AS VARCHAR(10)) FROM mem.Embedding E",
                'INNER JOIN mem.Record R ON R.[RecordId] = E.[RecordId]',
                'INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]',
                "WHERE S.[Tier] = 'type' AND S.[Segment] = N'" + typeName + "';"
            ].join('\n'));
            assert.strictEqual(Number(one(counts, 'rows')), typeChunks, 'one embedding row per chunk: ' + one(counts, 'rows'));
            assert.strictEqual(one(counts, 'dims'), DIMENSIONS + ':' + DIMENSIONS);
            assert.ok(embedCalls.some((n) => n >= typeChunks), 'the record\'s chunks rode one call: ' + JSON.stringify(embedCalls));

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
            assert.strictEqual(second.summary.unchanged, 4, JSON.stringify(second.summary));
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

        // The idempotence the queue drain rests on. The drain leaves its rows
        // in place on any refusal or transport failure and sends the lot again
        // on the next run, which is safe only because the server takes a stamp
        // id once. Enforced by a lookup rather than by the index, two sessions
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

        await t.test('usp_JevCalibration counts shown pointer rows by band across sandboxes, logs the call, and the publisher still cannot read mem.Outcome', () => {
            // Pointer rows from two sandboxes, through the append procedure the
            // client drains to, so the four columns are filled the way a real
            // row fills them. Band 7 holds three shown rows, two of them read
            // and one from each sandbox besides; an unshown row and a row of
            // another key are not counted; an old row counts only with no window.
            const now = new Date().toISOString();
            const pointer = (result, score, shown, at) => '{"segment":"' + segment + '","actionKey":"kit.jev.pointer",'
                + '"result":"' + result + '","summary":"a-record","at":"' + at + '","stampId":"' + crypto.randomUUID()
                + '","recognitionId":"' + crypto.randomUUID() + '","score":' + score + ',"vectorRank":3,"shown":' + shown + '}';
            mapConnection('SCOTT-CLAUDE');
            const scott = call('usp_AppendOutcomes', "@p_Outcomes = N'[" + [pointer('pass', 0.72, true, now),
                pointer('fail', 0.75, true, now), pointer('pass', 0.31, false, now),
                pointer('pass', 0.95, true, '2020-01-01T00:00:00Z')].join(',') + "]'");
            assert.ok(!scott.error, JSON.stringify(scott.error));
            mapConnection('NEO-CLAUDE');
            const neo = call('usp_AppendOutcomes', "@p_Outcomes = N'[" + pointer('pass', 0.7, true, now) + "]'");
            assert.ok(!neo.error, JSON.stringify(neo.error));
            const stored = sqlOk("SELECT 'kittest-cols=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Outcome"
                + " WHERE [ActionKey] = N'kit.jev.pointer' AND [RecognitionId] IS NOT NULL AND [VectorRank] = 3;");
            assert.strictEqual(one(stored, 'cols'), '5', 'the append procedure fills the pointer columns');

            mapConnection('SCOTT-CLAUDE');
            const logCount = () => Number(one(sqlOk("SELECT 'kittest-count=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.QueryLog WHERE [ProcedureName] = 'usp_JevCalibration';"), 'count'));
            const before = logCount();
            const all = callAs('kit_scott_claude', 'usp_JevCalibration', '');
            assert.ok(!all.error, 'a publisher executes the procedure: ' + JSON.stringify(all.error));
            assert.strictEqual(all.value.length, 10, 'every band is answered: ' + JSON.stringify(all.value));
            for (const band of all.value) {
                assert.deepStrictEqual(Object.keys(band).sort(), ['band', 'reads', 'rows'], 'counts and no record field');
            }
            const byBand = new Map(all.value.map((b) => [b.band, b]));
            assert.deepStrictEqual(byBand.get(7), { band: 7, rows: 3, reads: 2 }, 'both sandboxes\' rows count');
            assert.deepStrictEqual(byBand.get(9), { band: 9, rows: 1, reads: 1 });
            assert.deepStrictEqual(byBand.get(3), { band: 3, rows: 0, reads: 0 }, 'an unshown row is not counted');
            assert.strictEqual(logCount(), before + 1, 'exactly one query log row per call');
            const last = sqlOk("SELECT TOP (1) 'kittest-last=' + [Login] + ':' + CAST(COALESCE([SandboxId], -1) AS VARCHAR(10)) + ':' + CAST([RowCount] AS VARCHAR(10)) FROM mem.QueryLog WHERE [ProcedureName] = 'usp_JevCalibration' ORDER BY [QueryLogId] DESC;");
            assert.strictEqual(one(last, 'last'), me + ':' + ids.scott + ':10', 'the resolved login and sandbox and the band count');

            const windowed = callAs('kit_scott_claude', 'usp_JevCalibration', '@p_SinceDays = 30');
            assert.ok(!windowed.error, JSON.stringify(windowed.error));
            assert.deepStrictEqual(windowed.value.find((b) => b.band === 9), { band: 9, rows: 0, reads: 0 },
                'a row older than the window is not counted');

            const denied = sqlOk([
                "EXECUTE AS USER = N'kit_scott_claude';",
                'BEGIN TRY',
                "  EXEC sp_executesql N'SELECT TOP (1) [OutcomeId] FROM mem.Outcome';",
                "  SELECT 'kittest-select=allowed';",
                'END TRY',
                'BEGIN CATCH',
                "  SELECT 'kittest-errnum=' + CAST(ERROR_NUMBER() AS VARCHAR(10));",
                'END CATCH;',
                'REVERT;'
            ].join('\n'));
            assert.ok(!denied.tags.select, 'the publisher read mem.Outcome directly:\n' + denied.stdout);
            assert.strictEqual(one(denied, 'errnum'), '229', denied.stdout);
            mapConnection(null);
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

        // The record door: usp_PutRecord, usp_GetRecord, usp_ListIndex and
        // usp_ArchiveRecord, and the fleet-wide project store they key on.
        // Every project key below is this run's own, so each answer is read
        // over rows these cases wrote.
        const keyOne = 'remote:example.test/one-' + runId;
        const keyTwo = 'remote:example.test/two-' + runId;
        // A parameter value as the literal a call names it by: a number as
        // itself, NULL for null, and text as an N'' literal.
        const lit = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : "N'" + String(v).replace(/'/g, "''") + "'");
        const paramsOf = (fields) => Object.entries(fields).map(([k, v]) => '@p_' + k + ' = ' + lit(v)).join(', ');
        const put = (fields) => call('usp_PutRecord', paramsOf(fields));
        // A procedure answering zero or more rows of one [Json] column, read
        // line by line, or the error that refused it.
        function rowsAs(user, procedure, parameters) {
            const statement = 'EXEC mem.' + procedure + ' ' + parameters;
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
            for (const text of lines) assert.ok(text.length < 7990, 'sqlcmd cut a row at its 8000-character ceiling');
            return { rows: lines.map((text) => JSON.parse(text)), raw: res };
        }
        // One record's stored state, every column a write can move.
        const recordState = (recordId) => json(sqlOk([
            "SELECT 'kittest-row=' + (SELECT R.[Name], R.[Description], R.[Body], R.[BodyHash], R.[Tags], R.[Triggers], R.[Anchors],",
            '  R.[Space], R.[IsPinned], R.[SupersedesName], R.[Author], R.[Origin], R.[Visibility], R.[WrittenBySandboxId],',
            '  R.[IsArchived], R.[DeletedDt], R.[UpdatedDt], [StoreTier] = S.[Tier], [StoreSandboxId] = S.[SandboxId], [StoreSegment] = S.[Segment], S.[ProjectKey]',
            '  FROM mem.Record R INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId] WHERE R.[RecordId] = ' + Number(recordId),
            '  FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES);'
        ].join('\n')), 'row');
        const embeddingsOf = (recordId) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Embedding WHERE [RecordId] = "
            + Number(recordId) + ';'), 'n'));
        const embedOnAxis = (recordId, axis) => sqlOk('INSERT INTO mem.Embedding ([RecordId], [ChunkIndex], [ModelIdentity], [ChunkOffset], [ChunkLength], [Vector], [Dimensions])'
            + ' VALUES (' + Number(recordId) + ", 0, 'test-model', 0, 4, CAST(N'" + axisVector(axis) + "' AS VECTOR(" + DIMENSIONS + ')), ' + DIMENSIONS + ');');
        const putName = 'put-' + runId;
        const putIds = {};

        await t.test('usp_PutRecord inserts, refuses an existing name unless told to replace, and keeps a field sent as NULL', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const base = { Tier: 'project', ProjectKey: keyOne, Name: putName };
                const first = put({ ...base, Description: 'first description', Body: 'first body', Tags: '["t1"]',
                    Triggers: '["trigger one"]', Anchors: '["a.js"]', Space: 'space-one', IsPinned: 0, Author: 'author-one' });
                assert.ok(!first.error, JSON.stringify(first.error));
                assert.strictEqual(first.value.status, 'stored', JSON.stringify(first.value));
                putIds.main = first.value.recordId;
                const inserted = recordState(putIds.main);
                assert.deepStrictEqual({ origin: inserted.Origin, visibility: inserted.Visibility, writtenBy: inserted.WrittenBySandboxId,
                    tier: inserted.StoreTier, storeSandbox: inserted.StoreSandboxId, segment: inserted.StoreSegment, key: inserted.ProjectKey },
                { origin: 'memq', visibility: 'shared', writtenBy: ids.scott, tier: 'project', storeSandbox: null, segment: null, key: keyOne },
                'an inserted record is a memq row in the project key\'s fleet store: ' + JSON.stringify(inserted));
                assert.strictEqual(inserted.Body, 'first body');
                assert.strictEqual(inserted.Anchors, '["a.js"]');

                // Present, no replace: refused with the existing description,
                // and the row is exactly as it was, its update time included.
                const refused = put({ ...base, Description: 'second description', Body: 'second body' });
                assert.ok(!refused.error, 'a refusal is an answer, never an error: ' + JSON.stringify(refused.error));
                assert.deepStrictEqual(refused.value, { status: 'refused', recordId: putIds.main, name: putName, description: 'first description' });
                assert.deepStrictEqual(recordState(putIds.main), inserted, 'a refused write must change nothing');
                const named = Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record WHERE [Name] = N'" + putName + "';"), 'n'));
                assert.strictEqual(named, 1, 'a refused write adds no second row of the name');

                // Present, replace, anchors alone: the anchors change, every
                // other field keeps its column, and the vectors stay. The same
                // call shape as the refusal with the flag set is what writes,
                // so the refusal above is the name-present rule.
                embedOnAxis(putIds.main, 600);
                const anchorsOnly = put({ ...base, Anchors: '["b.js"]', Replace: 1 });
                assert.ok(!anchorsOnly.error, JSON.stringify(anchorsOnly.error));
                assert.strictEqual(anchorsOnly.value.status, 'stored', JSON.stringify(anchorsOnly.value));
                const anchored = recordState(putIds.main);
                assert.strictEqual(anchored.Anchors, '["b.js"]', 'the anchors are the new value');
                for (const field of ['Name', 'Description', 'Body', 'BodyHash', 'Tags', 'Triggers', 'Space', 'IsPinned', 'SupersedesName', 'Author', 'IsArchived']) {
                    assert.deepStrictEqual(anchored[field], inserted[field], field + ' must keep its column when sent as NULL');
                }
                assert.strictEqual(embeddingsOf(putIds.main), 1, 'a write with no body keeps the record\'s vectors');

                // Present, replace, every field: each column takes its new
                // value, an empty array clearing a list, and a new body drops
                // the vectors.
                const full = put({ ...base, Description: 'third description', Body: 'third body', Tags: '[]', Triggers: '[]',
                    Anchors: '[]', Space: 'space-two', IsPinned: 1, Supersedes: 'older-' + runId, Author: 'author-two', Replace: 1 });
                assert.ok(!full.error, JSON.stringify(full.error));
                assert.strictEqual(full.value.status, 'stored', JSON.stringify(full.value));
                const replaced = recordState(putIds.main);
                assert.deepStrictEqual({ d: replaced.Description, b: replaced.Body, tags: replaced.Tags, triggers: replaced.Triggers,
                    anchors: replaced.Anchors, space: replaced.Space, pinned: replaced.IsPinned, supersedes: replaced.SupersedesName, author: replaced.Author },
                { d: 'third description', b: 'third body', tags: '[]', triggers: '[]', anchors: '[]', space: 'space-two', pinned: true,
                    supersedes: 'older-' + runId, author: 'author-two' }, JSON.stringify(replaced));
                assert.notStrictEqual(replaced.BodyHash, inserted.BodyHash, 'a new body takes a new hash');
                assert.strictEqual(embeddingsOf(putIds.main), 0, 'a new body leaves no vector made from the old one');

                // A list that is not a JSON array is refused by name.
                const malformed = put({ ...base, Tags: '{"a":1}', Replace: 1 });
                assert.ok(malformed.error && malformed.error.number === 50000 && malformed.error.message.includes('JSON array'), JSON.stringify(malformed));
            } finally {
                mapConnection(null);
            }
        });

        await t.test('usp_PutRecord answers a stamp its sandbox already wrote as stored and writes nothing, whatever the other arguments', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const stamp = crypto.randomUUID();
                const stampName = 'stamped-' + runId;
                const otherName = 'stamp-other-' + runId;
                const first = put({ Tier: 'project', ProjectKey: keyOne, Name: stampName, Description: 'stamped', Body: 'stamped body', StampId: stamp });
                assert.ok(!first.error, JSON.stringify(first.error));
                assert.strictEqual(first.value.status, 'stored');
                putIds.stamped = first.value.recordId;
                const before = recordState(putIds.stamped);
                const rowsNamed = (name) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record WHERE [Name] = N'" + name + "';"), 'n'));
                const storesFor = (key) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Store WHERE [ProjectKey] = N'" + key + "';"), 'n'));
                assert.strictEqual(storesFor(keyTwo), 0, 'this case needs the second key\'s store unwritten');

                // The same stamp with every other argument changed: another
                // key, another name, the replace flag. Stored, nothing written.
                const replay = put({ Tier: 'project', ProjectKey: keyTwo, Name: otherName, Description: 'other', Body: 'other body', Replace: 1, StampId: stamp });
                assert.ok(!replay.error, JSON.stringify(replay.error));
                assert.deepStrictEqual({ status: replay.value.status, recordId: replay.value.recordId }, { status: 'stored', recordId: putIds.stamped });
                assert.strictEqual(rowsNamed(otherName), 0, 'a replayed stamp inserts no row');
                assert.strictEqual(storesFor(keyTwo), 0, 'a replayed stamp creates no store');
                assert.deepStrictEqual(recordState(putIds.stamped), before, 'a replayed stamp leaves the stamped row as it was');

                // The stamp wins over the refusal the same name would draw.
                const overRefusal = put({ Tier: 'project', ProjectKey: keyOne, Name: stampName, Description: 'again', StampId: stamp });
                assert.ok(!overRefusal.error, JSON.stringify(overRefusal.error));
                assert.strictEqual(overRefusal.value.status, 'stored', 'a replay is never refused: ' + JSON.stringify(overRefusal.value));
                assert.deepStrictEqual(recordState(putIds.stamped), before);

                // The control, withheld from the assertions above: the replay
                // call with a fresh stamp does write, so the silence above is
                // the stamp and not a call that could never land.
                const fresh = put({ Tier: 'project', ProjectKey: keyTwo, Name: otherName, Description: 'other', Body: 'other body', Replace: 1, StampId: crypto.randomUUID() });
                assert.ok(!fresh.error, JSON.stringify(fresh.error));
                assert.strictEqual(fresh.value.status, 'stored');
                assert.strictEqual(rowsNamed(otherName), 1, 'the fresh stamp inserts the row');
                assert.strictEqual(storesFor(keyTwo), 1, 'and creates the second key\'s store');
                putIds.other = fresh.value.recordId;

                // A stamp is one sandbox's: NEO sending SCOTT's stamp writes.
                mapConnection('NEO-CLAUDE');
                const neoName = 'stamp-neo-' + runId;
                const neo = put({ Tier: 'project', ProjectKey: keyOne, Name: neoName, Description: 'neo wrote this', Body: 'neo body', StampId: stamp });
                assert.ok(!neo.error, JSON.stringify(neo.error));
                assert.strictEqual(neo.value.status, 'stored');
                assert.notStrictEqual(neo.value.recordId, putIds.stamped, 'another sandbox\'s stamp never suppresses this sandbox\'s write');
                assert.strictEqual(recordState(neo.value.recordId).WrittenBySandboxId, ids.neo);
                putIds.neo = neo.value.recordId;

                // An unmapped login writes nothing, refused by the caller rule.
                mapConnection(null);
                const unmapped = put({ Tier: 'project', ProjectKey: keyOne, Name: 'unmapped-' + runId, Body: 'b' });
                assert.ok(unmapped.error && unmapped.error.message.includes('maps to no sandbox'), JSON.stringify(unmapped));
                assert.strictEqual(rowsNamed('unmapped-' + runId), 0);

                // The index the skip reads, from the catalog: the stamp ledger's,
                // unique over the sandbox and the stamp, and none left on the
                // record row.
                const index = sqlOk("SELECT 'kittest-ix=' + CAST(I.[is_unique] AS VARCHAR(1)) + ':' + COALESCE(I.[filter_definition], '<none>') FROM sys.indexes I"
                    + " WHERE I.[object_id] = OBJECT_ID('mem.RecordStamp') AND I.[name] = 'IX_RecordStamp_WrittenBySandboxId_StampId';");
                assert.strictEqual(one(index, 'ix'), '1:<none>');
                assert.strictEqual(indexKeyOf('mem.RecordStamp', 'IX_RecordStamp_WrittenBySandboxId_StampId'), 'WrittenBySandboxId,StampId');
                const column = sqlOk("SELECT 'kittest-col=' + CASE WHEN COL_LENGTH('mem.Record', 'StampId') IS NULL THEN 'absent' ELSE 'present' END;");
                assert.strictEqual(one(column, 'col'), 'absent', 'the stamp lives in the ledger alone');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('usp_GetRecord answers one name under one key with its body and every field, and no row under another key', () => {
            const getParams = (key) => paramsOf({ Tier: 'project', ProjectKey: key, Name: putName });
            try {
                mapConnection('NEO-CLAUDE');
                const got = rowsAs(null, 'usp_GetRecord', getParams(keyOne));
                assert.ok(!got.error, JSON.stringify(got.error));
                assert.strictEqual(got.rows.length, 1, 'one row for the name under its key: ' + JSON.stringify(got.rows));
                const row = got.rows[0];
                assert.deepStrictEqual(Object.keys(row).sort(), ['anchors', 'archived', 'author', 'body', 'created', 'description', 'name',
                    'origin', 'pinned', 'projectKey', 'recordId', 'space', 'supersedes', 'tags', 'tier', 'triggers', 'typeName', 'updated',
                    'visibility', 'writtenBy'], JSON.stringify(row));
                assert.deepStrictEqual({ recordId: row.recordId, body: row.body, description: row.description, projectKey: row.projectKey,
                    tags: row.tags, anchors: row.anchors, pinned: row.pinned, space: row.space, origin: row.origin, writtenBy: row.writtenBy },
                { recordId: putIds.main, body: 'third body', description: 'third description', projectKey: keyOne, tags: [], anchors: [],
                    pinned: true, space: 'space-two', origin: 'memq', writtenBy: 'SCOTT-CLAUDE' },
                'another sandbox reads the record SCOTT wrote, whole: ' + JSON.stringify(row));
                assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(row.created), 'created is the date the record was written: ' + row.created);

                // The same name under the other key: no row. The call above,
                // on the same connection, is the control that the name is
                // there to be read.
                const otherKey = rowsAs(null, 'usp_GetRecord', getParams(keyTwo));
                assert.ok(!otherKey.error, JSON.stringify(otherKey.error));
                assert.deepStrictEqual(otherKey.rows, [], 'no row for the name under another project key');

                mapConnection(null);
                const unmapped = rowsAs(null, 'usp_GetRecord', getParams(keyOne));
                assert.ok(!unmapped.error, JSON.stringify(unmapped.error));
                assert.deepStrictEqual(unmapped.rows, [], 'an unmapped login reads no row');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('usp_ListIndex lists one project\'s rows and the shared tiers\' rows with their usage aggregates, and no other project\'s', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const typeName = 'ltype-' + runId;
                const typed = put({ Tier: 'type', TypeName: typeName, Name: 'listed-type-' + runId, Description: 'a type record', Body: 'b' });
                assert.ok(!typed.error && typed.value.status === 'stored', JSON.stringify(typed));
                const operator = put({ Tier: 'operator', Name: 'listed-operator-' + runId, Description: 'an operator record', Body: 'b' });
                assert.ok(!operator.error && operator.value.status === 'stored', JSON.stringify(operator));

                // Usage on the main record: reads on two days, applied stamps
                // on two distinct days, two of them on the first.
                const stamps = [['read', '2026-09-01T00:00:00Z'], ['read', '2026-09-03T00:00:00Z'], ['applied', '2026-09-02T10:00:00Z'],
                    ['applied', '2026-09-02T20:00:00Z'], ['applied', '2026-09-04T00:00:00Z']]
                    .map(([kind, at]) => ({ recordId: putIds.main, kind, at, stampId: crypto.randomUUID() }));
                const usage = call('usp_AppendUsage', "@p_Usage = N'" + JSON.stringify(stamps) + "'");
                assert.ok(!usage.error, JSON.stringify(usage.error));
                assert.strictEqual(usage.value.appended, 5, JSON.stringify(usage.value));

                const list = (key) => {
                    const res = rowsAs(null, 'usp_ListIndex', paramsOf({ ProjectKey: key }));
                    assert.ok(!res.error, JSON.stringify(res.error));
                    return res.rows;
                };
                const one1 = list(keyOne);
                const byName = new Map(one1.map((r) => [r.name, r]));
                assert.ok(byName.has(putName) && byName.has('stamped-' + runId) && byName.has('stamp-neo-' + runId),
                    'the project\'s rows, each sandbox\'s writes included: ' + JSON.stringify(one1.map((r) => r.name)));
                assert.ok(byName.has('listed-type-' + runId) && byName.has('listed-operator-' + runId), 'the shared tiers\' rows');
                assert.strictEqual(byName.get('listed-type-' + runId).typeName, typeName);
                assert.ok(!byName.has('stamp-other-' + runId), 'TENANCY: the other project\'s row reached this project\'s index');
                assert.ok(one1.every((r) => r.tier !== 'project' || r.projectKey === keyOne),
                    'every project row is the asked key\'s: ' + JSON.stringify(one1.filter((r) => r.tier === 'project')));
                assert.ok(one1.every((r) => r.tier === 'project' || r.tier === 'type' || r.tier === 'operator'));
                const main = byName.get(putName);
                assert.deepStrictEqual(Object.keys(main).sort(), ['anchors', 'appliedDays', 'created', 'description', 'lastApplied', 'lastRead',
                    'name', 'origin', 'pinned', 'projectKey', 'recordId', 'space', 'supersedes', 'tags', 'tier', 'triggers', 'typeName'], JSON.stringify(main));
                assert.strictEqual(new Date(main.lastRead).getTime(), new Date('2026-09-03T00:00:00Z').getTime(), JSON.stringify(main));
                assert.strictEqual(new Date(main.lastApplied).getTime(), new Date('2026-09-04T00:00:00Z').getTime(), JSON.stringify(main));
                assert.strictEqual(main.appliedDays, 2, 'distinct applied days, not applied stamps: ' + JSON.stringify(main));
                const unstamped = byName.get('stamped-' + runId);
                assert.deepStrictEqual([unstamped.lastRead, unstamped.lastApplied, unstamped.appliedDays], [null, null, 0]);

                // The control for the absence above: the other key's index
                // lists that row, and not this key's.
                const two = list(keyTwo);
                assert.ok(two.some((r) => r.name === 'stamp-other-' + runId), JSON.stringify(two.map((r) => r.name)));
                assert.ok(!two.some((r) => r.name === putName), 'this project\'s row reached the other project\'s index');

                mapConnection(null);
                assert.deepStrictEqual(list(keyOne), [], 'an unmapped login lists nothing');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('usp_ArchiveRecord archives by tier, key and name, deletes on asking, and never removes the row', () => {
            const archiveParams = (extra) => paramsOf({ Tier: 'project', ProjectKey: keyOne, Name: 'stamped-' + runId, ...extra });
            const getStamped = () => rowsAs(null, 'usp_GetRecord', paramsOf({ Tier: 'project', ProjectKey: keyOne, Name: 'stamped-' + runId })).rows;
            const indexed = () => rowsAs(null, 'usp_ListIndex', paramsOf({ ProjectKey: keyOne })).rows.some((r) => r.name === 'stamped-' + runId);
            mapConnection(null);
            const unmapped = call('usp_ArchiveRecord', archiveParams({}));
            assert.ok(unmapped.error && unmapped.error.message.includes('maps to no sandbox'), JSON.stringify(unmapped));
            assert.strictEqual(recordState(putIds.stamped).IsArchived, false, 'a refused archive changes nothing');
            mapConnection('NEO-CLAUDE');
            try {
                assert.ok(indexed(), 'the record is in the index before it is archived');
                const archived = call('usp_ArchiveRecord', archiveParams({}));
                assert.ok(!archived.error, JSON.stringify(archived.error));
                assert.deepStrictEqual(archived.value, { status: 'archived', recordId: putIds.stamped });
                const state = recordState(putIds.stamped);
                assert.deepStrictEqual([state.IsArchived, state.DeletedDt], [true, null]);
                assert.ok(!indexed(), 'an archived record leaves the index');
                assert.strictEqual(getStamped()[0].archived, true, 'and is still read by name, marked archived');

                const deleted = call('usp_ArchiveRecord', archiveParams({ Delete: 1 }));
                assert.ok(!deleted.error, JSON.stringify(deleted.error));
                assert.deepStrictEqual(deleted.value, { status: 'deleted', recordId: putIds.stamped });
                assert.ok(recordState(putIds.stamped).DeletedDt !== null, 'the deleted mark is set on the row, which stays');
                assert.deepStrictEqual(getStamped(), [], 'a deleted record is read by no one');

                const again = call('usp_ArchiveRecord', archiveParams({ Delete: 1 }));
                assert.ok(!again.error, 'a resent retirement is not a failure: ' + JSON.stringify(again.error));
                assert.deepStrictEqual(again.value, { status: 'absent', recordId: null });
                assert.strictEqual(Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record WHERE [RecordId] = " + putIds.stamped + ';'), 'n')), 1,
                    'no row is ever removed');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('udf_VisibleRecords serves another sandbox\'s older-store project row to a mapped sandbox and nothing to a NULL one', () => {
            const planted = sqlOk([
                "DECLARE @neo INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'NEO-CLAUDE');",
                "DECLARE @store INT = (SELECT [StoreId] FROM mem.Store WHERE [SandboxId] = @neo AND [Tier] = 'project' AND [Segment] = N'" + segment + "');",
                'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId])',
                "VALUES (@store, N'neo-visible-" + runId + "', N'neo-visible.md', N'v', N'v', 'hv', 'private', @neo);",
                "SELECT 'kittest-id=' + CAST(SCOPE_IDENTITY() AS VARCHAR(20));"
            ].join('\n'));
            const plantedId = Number(one(planted, 'id'));
            const seen = (sandbox) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.udf_VisibleRecords(" + sandbox + ') V WHERE V.[RecordId] = ' + plantedId + ';'), 'n'));
            assert.strictEqual(seen(ids.scott), 1, 'NEO\'s older-store private row reaches SCOTT');
            assert.strictEqual(seen(ids.neo), 1, 'and NEO');
            assert.strictEqual(seen('NULL'), 0, 'and nothing reaches a NULL sandbox');
            const total = Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.udf_VisibleRecords(NULL);"), 'n'));
            assert.strictEqual(total, 0, 'a NULL sandbox is served no row at all');
        });

        await t.test('usp_Search with @p_ProjectKey ranks only that project\'s rows and the shared tiers\', and the version 6 segment call still answers', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const axis = 700;
                const seeded = {};
                for (const [key, fields] of [['one', { Tier: 'project', ProjectKey: keyOne, Name: 'search-one-' + runId }],
                    ['two', { Tier: 'project', ProjectKey: keyTwo, Name: 'search-two-' + runId }],
                    ['type', { Tier: 'type', TypeName: 'stype-' + runId, Name: 'search-type-' + runId }]]) {
                    const res = put({ ...fields, Description: 'a search fixture', Body: 'b' });
                    assert.ok(!res.error && res.value.status === 'stored', JSON.stringify(res));
                    seeded[key] = res.value.recordId;
                    embedOnAxis(seeded[key], axis);
                }
                // Each fixture row sits at distance zero on an axis of its own,
                // so the three rank first and a ten-row answer holds them all.
                const fixture = Object.values(seeded);
                const searchWith = (scope) => {
                    const res = call('usp_Search', "@p_QueryVector = @v, @p_ModelIdentity = 'test-model', @p_Limit = 10" + scope, vectorPrelude(axis));
                    assert.ok(!res.error, JSON.stringify(res.error));
                    return idsOf(res.value).filter((id) => fixture.includes(id)).sort((a, b) => a - b);
                };
                const sorted = (...list) => list.sort((a, b) => a - b);
                // Unscoped, the control: all three fixture rows rank.
                assert.deepStrictEqual(searchWith(''), sorted(seeded.one, seeded.two, seeded.type));
                assert.deepStrictEqual(searchWith(', @p_ProjectKey = ' + lit(keyOne)), sorted(seeded.one, seeded.type),
                    'the first project\'s scope ranks its row and the shared row, never the second project\'s');
                assert.deepStrictEqual(searchWith(', @p_ProjectKey = ' + lit(keyTwo)), sorted(seeded.two, seeded.type),
                    'the second project\'s scope, the mirror');

                // Both scopes named at once answer through both predicates:
                // a segment keeps only older-store project rows and a project
                // key only fleet-store and shared-tier rows, so no fixture row,
                // and no row at all, is kept by both.
                const both = call('usp_Search', "@p_QueryVector = @v, @p_ModelIdentity = 'test-model', @p_Limit = 10, @p_Segment = "
                    + lit(segment) + ', @p_ProjectKey = ' + lit(keyOne), vectorPrelude(axis));
                assert.ok(!both.error, 'a call naming both scopes is answered, never refused: ' + JSON.stringify(both.error));
                assert.deepStrictEqual(both.value, [], 'no row sits in both kinds of store: ' + JSON.stringify(both.value));

                // The version 6 shape: @p_Segment names an older store and
                // answers its rows as version 6 did, the caller's own and the
                // shared, and not another sandbox's private row in a store of
                // the same segment.
                const v6 = call('usp_Search', "@p_QueryVector = @v, @p_ModelIdentity = 'test-model', @p_Limit = 10, @p_Segment = " + lit(segment), vectorPrelude(1));
                assert.ok(!v6.error, 'the version 6 call shape must still answer: ' + JSON.stringify(v6.error));
                assert.ok(idsOf(v6.value).includes(ids.scottPrivate), JSON.stringify(v6.value));
                assert.ok(v6.value.every((r) => r.tier === 'project' && r.segment === segment), JSON.stringify(v6.value));
                assert.ok(!idsOf(v6.value).some((id) => fixture.includes(id)), 'a segment scope never reaches a fleet store');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('usp_PromoteRecord moves a fleet project row named by its key into the operator store, and refuses a publisher', () => {
            const name = 'promote-key-' + runId;
            mapConnection('SCOTT-CLAUDE');
            const written = put({ Tier: 'project', ProjectKey: keyOne, Name: name, Description: 'to promote', Body: 'promote body', Anchors: '["p.js"]' });
            mapConnection(null);
            assert.ok(!written.error && written.value.status === 'stored', JSON.stringify(written));
            const promote = paramsOf({ ProjectKey: keyOne, Name: name });
            const publisher = callAs('kit_scott_claude', 'usp_PromoteRecord', promote);
            assert.ok(publisher.error && publisher.error.number === 229, 'a publisher promoted a record: ' + JSON.stringify(publisher));
            assert.strictEqual(recordState(written.value.recordId).IsArchived, false, 'a refused promotion leaves the row live');

            const curator = callAs('kit_curator', 'usp_PromoteRecord', promote);
            assert.ok(!curator.error, JSON.stringify(curator.error));
            assert.strictEqual(curator.value.archivedRecordId, written.value.recordId);
            const copy = recordState(curator.value.recordId);
            assert.deepStrictEqual({ tier: copy.StoreTier, key: copy.ProjectKey, body: copy.Body, anchors: copy.Anchors, archived: copy.IsArchived },
                { tier: 'operator', key: null, body: 'promote body', anchors: '["p.js"]', archived: false }, JSON.stringify(copy));
            const source = recordState(written.value.recordId);
            assert.deepStrictEqual([source.IsArchived, source.DeletedDt], [true, null], 'the project row is archived, not deleted');
        });

        await t.test('a replayed stamp writes nothing after later writes to its record, stamped or not', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const base = (name) => ({ Tier: 'project', ProjectKey: keyOne, Name: name });
                const ledgerRows = (stamp) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.RecordStamp WHERE [StampId] = N'"
                    + stamp + "';"), 'n'));
                const stored = (res) => {
                    assert.ok(!res.error, JSON.stringify(res.error));
                    assert.strictEqual(res.value.status, 'stored', JSON.stringify(res.value));
                    return res.value.recordId;
                };

                // X: written with S1, replaced with S2, then S1 replayed with
                // other arguments. X keeps S2's body.
                const nameX = 'ledger-x-' + runId;
                const s1 = crypto.randomUUID();
                const s2 = crypto.randomUUID();
                const x = stored(put({ ...base(nameX), Description: 'x one', Body: 'x body one', StampId: s1 }));
                assert.strictEqual(stored(put({ ...base(nameX), Description: 'x two', Body: 'x body two', Replace: 1, StampId: s2 })), x);
                const afterS2 = recordState(x);
                assert.strictEqual(afterS2.Body, 'x body two');
                const replayS1 = put({ ...base(nameX), Description: 'x replayed', Body: 'x body replayed', Anchors: '["r.js"]', Replace: 1, StampId: s1 });
                assert.strictEqual(stored(replayS1), x, 'the replay answers with the record its stamp landed on');
                assert.deepStrictEqual(recordState(x), afterS2, 'a replay of S1 after S2 writes nothing, and X keeps S2\'s body');

                // Y: written with S3, replaced with no stamp, then S3 replayed.
                const nameY = 'ledger-y-' + runId;
                const s3 = crypto.randomUUID();
                const y = stored(put({ ...base(nameY), Description: 'y one', Body: 'y body one', StampId: s3 }));
                assert.strictEqual(stored(put({ ...base(nameY), Body: 'y body two', Replace: 1 })), y);
                const afterUnstamped = recordState(y);
                assert.strictEqual(afterUnstamped.Body, 'y body two');
                const replayS3 = put({ ...base(nameY), Body: 'y body replayed', Replace: 1, StampId: s3 });
                assert.strictEqual(stored(replayS3), y);
                assert.deepStrictEqual(recordState(y), afterUnstamped, 'a replay of S3 after an unstamped write writes nothing');

                // The ledger holds one row per stamp a stored write carried,
                // the replays adding none.
                assert.deepStrictEqual([ledgerRows(s1), ledgerRows(s2), ledgerRows(s3)], [1, 1, 1]);
                // The control, withheld from the replays above: the same replace
                // with a fresh stamp does write, so the silence is the ledger.
                const fresh = put({ ...base(nameX), Body: 'x body three', Replace: 1, StampId: crypto.randomUUID() });
                assert.strictEqual(stored(fresh), x);
                assert.strictEqual(recordState(x).Body, 'x body three', 'a fresh stamp writes');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('an archived record counts as present, and a replace takes it back into the index', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const name = 'archived-replace-' + runId;
                const base = { Tier: 'project', ProjectKey: keyOne, Name: name };
                const listed = () => rowsAs(null, 'usp_ListIndex', paramsOf({ ProjectKey: keyOne })).rows.some((r) => r.name === name);
                const written = put({ ...base, Description: 'to archive', Body: 'archived body' });
                assert.ok(!written.error && written.value.status === 'stored', JSON.stringify(written));
                assert.ok(listed(), 'the record lists before it is archived, the control for the absence below');
                const archived = call('usp_ArchiveRecord', paramsOf(base));
                assert.ok(!archived.error && archived.value.status === 'archived', JSON.stringify(archived));
                assert.ok(!listed(), 'an archived record does not list');

                // A replace of one field, the shape `memq anchor` sends, changes
                // that field and leaves the record archived.
                const anchored = put({ ...base, Anchors: '["kept-archived.js"]', Replace: 1 });
                assert.ok(!anchored.error && anchored.value.status === 'stored', JSON.stringify(anchored));
                const anchoredState = recordState(written.value.recordId);
                assert.deepStrictEqual([anchoredState.Anchors, anchoredState.IsArchived, anchoredState.Body], ['["kept-archived.js"]', true, 'archived body'],
                    'an anchors-only replace changes the anchors alone and leaves the record archived');
                assert.ok(!listed(), 'and the record still does not list');

                const refused = put({ ...base, Description: 'no flag', Body: 'refused body' });
                assert.ok(!refused.error, JSON.stringify(refused.error));
                assert.deepStrictEqual({ status: refused.value.status, description: refused.value.description },
                    { status: 'refused', description: 'to archive' }, 'an archived name is present, so a write without the flag is refused');
                assert.strictEqual(recordState(written.value.recordId).Body, 'archived body');

                const replaced = put({ ...base, Body: 'replaced body', Replace: 1 });
                assert.ok(!replaced.error, JSON.stringify(replaced.error));
                assert.deepStrictEqual({ status: replaced.value.status, recordId: replaced.value.recordId }, { status: 'stored', recordId: written.value.recordId });
                const state = recordState(written.value.recordId);
                assert.deepStrictEqual([state.IsArchived, state.Body], [false, 'replaced body']);
                assert.ok(listed(), 'a replaced record lists again');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('a write with no body on an absent name writes nothing and is refused, and usp_Health keeps fleet rows out of its shared counts', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const keyThree = 'remote:example.test/three-' + runId;
                const storesFor = (key) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Store WHERE [ProjectKey] = N'" + key + "';"), 'n'));
                const rowsNamed = (name) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record WHERE [Name] = N'" + name + "';"), 'n'));
                const ledgerRows = (stamp) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.RecordStamp WHERE [StampId] = N'" + stamp + "';"), 'n'));
                const refusedNull = (res, what) => {
                    assert.ok(!res.error, JSON.stringify(res.error));
                    assert.deepStrictEqual({ status: res.value.status, recordId: res.value.recordId, description: res.value.description },
                        { status: 'refused', recordId: null, description: null }, what + ': ' + JSON.stringify(res.value));
                };

                // (a) An absent name, a key whose store does not exist yet: an
                // anchors-only replace, and a no-body write with no flag, each
                // refused, with no row, no store and no stamp written.
                const absent = 'absent-' + runId;
                const stampA = crypto.randomUUID();
                refusedNull(put({ Tier: 'project', ProjectKey: keyThree, Name: absent, Anchors: '["a.js"]', Replace: 1, StampId: stampA }), 'an anchors-only replace on an absent name');
                refusedNull(put({ Tier: 'project', ProjectKey: keyThree, Name: absent, Description: 'no body', Replace: 0 }), 'a no-body write with no flag');
                assert.deepStrictEqual([rowsNamed(absent), storesFor(keyThree), ledgerRows(stampA)], [0, 0, 0], 'nothing is written');

                // The control, withheld from the refusals above: an empty-string
                // body on the same absent name is a body, and inserts.
                const empty = put({ Tier: 'project', ProjectKey: keyThree, Name: absent, Body: '' });
                assert.ok(!empty.error && empty.value.status === 'stored', 'an empty body inserts: ' + JSON.stringify(empty));
                assert.deepStrictEqual([rowsNamed(absent), storesFor(keyThree)], [1, 1]);

                // (b) A deleted row holding the file key is left as it stands.
                const gone = 'gone-' + runId;
                const written = put({ Tier: 'project', ProjectKey: keyOne, Name: gone, Description: 'deleted row', Body: 'deleted body', Anchors: '["old.js"]' });
                assert.ok(!written.error && written.value.status === 'stored', JSON.stringify(written));
                const deleted = call('usp_ArchiveRecord', paramsOf({ Tier: 'project', ProjectKey: keyOne, Name: gone, Delete: 1 }));
                assert.deepStrictEqual(deleted.value, { status: 'deleted', recordId: written.value.recordId }, JSON.stringify(deleted));
                const deletedState = recordState(written.value.recordId);
                const stampB = crypto.randomUUID();
                refusedNull(put({ Tier: 'project', ProjectKey: keyOne, Name: gone, Anchors: '["new.js"]', Replace: 1, StampId: stampB }), 'an anchors-only replace over a deleted row');
                assert.deepStrictEqual(recordState(written.value.recordId), deletedState, 'the deleted row\'s body and fields are unchanged');
                assert.strictEqual(ledgerRows(stampB), 0, 'and no stamp is recorded');

                // usp_Health: a fleet project record and its embedding move the
                // fleet counts and not the shared ones.
                const health = () => {
                    const res = call('usp_Health', "@p_ModelIdentity = 'test-model'");
                    assert.ok(!res.error, JSON.stringify(res.error));
                    const h = res.value;
                    return { sharedRecords: h.sharedRecords, sharedEmbeddings: h.sharedEmbeddings, fleetRecords: h.fleetRecords, fleetEmbeddings: h.fleetEmbeddings };
                };
                const before = health();
                const counted = put({ Tier: 'project', ProjectKey: keyOne, Name: 'health-' + runId, Description: 'a fleet row to count', Body: 'b' });
                assert.ok(!counted.error && counted.value.status === 'stored', JSON.stringify(counted));
                const vector = call('usp_UpsertEmbeddings', "@p_Embeddings = N'" + JSON.stringify([{ recordId: counted.value.recordId, chunkIndex: 0, chunkOffset: 0,
                    chunkLength: 1, vector: JSON.parse(axisVector(900)), model: 'test-model', dimensions: DIMENSIONS }]) + "'");
                assert.deepStrictEqual(vector.value, { inserted: 1, updated: 0, rejected: 0 }, JSON.stringify(vector));
                assert.deepStrictEqual(health(), { ...before, fleetRecords: before.fleetRecords + 1, fleetEmbeddings: before.fleetEmbeddings + 1 },
                    'a fleet record moves fleetRecords and fleetEmbeddings and not the shared counts');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('every procedure that resolves a name addresses the newest undeleted row of it, and a repeated archive changes nothing', () => {
            const name = 'one-name-' + runId;
            mapConnection('SCOTT-CLAUDE');
            try {
                const first = put({ Tier: 'project', ProjectKey: keyOne, Name: name, Description: 'older row', Body: 'older body' });
                assert.ok(!first.error && first.value.status === 'stored', JSON.stringify(first));
                const older = first.value.recordId;
                // A second undeleted row of the name in the same store, newer,
                // under its own file key since the file key is unique in a store.
                const seeded = sqlOk([
                    'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [Origin])',
                    "SELECT R.[StoreId], R.[Name], N'one-name-copy.md', N'newer row', N'newer body', 'hn', 'shared', 'memq' FROM mem.Record R WHERE R.[RecordId] = " + older + ';',
                    "SELECT 'kittest-id=' + CAST(SCOPE_IDENTITY() AS VARCHAR(20));"
                ].join('\n'));
                const newer = Number(one(seeded, 'id'));
                assert.ok(newer > older);
                const olderBefore = recordState(older);
                const named = paramsOf({ Tier: 'project', ProjectKey: keyOne, Name: name });
                const get = () => rowsAs(null, 'usp_GetRecord', named).rows;

                assert.deepStrictEqual(get().map((r) => r.recordId), [newer], 'get answers the newest row');
                const replaced = put({ Tier: 'project', ProjectKey: keyOne, Name: name, Body: 'replaced body', Replace: 1 });
                assert.strictEqual(replaced.value.recordId, newer, 'put --replace writes the newest row: ' + JSON.stringify(replaced));
                const anchored = put({ Tier: 'project', ProjectKey: keyOne, Name: name, Anchors: '["one.js"]', Replace: 1 });
                assert.strictEqual(anchored.value.recordId, newer, 'an anchors-only replace writes the newest row');
                assert.deepStrictEqual([recordState(newer).Body, recordState(newer).Anchors], ['replaced body', '["one.js"]']);
                assert.deepStrictEqual(get()[0].body, 'replaced body', 'and get shows what the writes wrote');

                const usageOf = (id) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage WHERE [RecordId] = " + id + ';'), 'n'));
                const stamp = call('usp_AppendUsage', "@p_Usage = N'" + JSON.stringify([{ tier: 'project', projectKey: keyOne, name,
                    kind: 'applied', at: '2026-10-02T00:00:00Z', stampId: crypto.randomUUID() }]) + "'");
                assert.deepStrictEqual(stamp.value, { appended: 1, rejected: 0, skipped: 0 }, JSON.stringify(stamp));
                assert.deepStrictEqual([usageOf(newer), usageOf(older)], [1, 0], 'a usage stamp lands on the newest row');

                const archived = call('usp_ArchiveRecord', named);
                assert.deepStrictEqual(archived.value, { status: 'archived', recordId: newer }, JSON.stringify(archived));
                const newerArchived = recordState(newer);
                assert.strictEqual(newerArchived.IsArchived, true);
                assert.deepStrictEqual(get().map((r) => [r.recordId, r.archived]), [[newer, true]], 'get answers the newest row, marked archived');
                const again = call('usp_ArchiveRecord', named);
                assert.deepStrictEqual(again.value, { status: 'archived', recordId: newer }, 'a resent archive answers archived: ' + JSON.stringify(again));
                assert.deepStrictEqual(recordState(newer), newerArchived, 'and changes nothing on the newest row');
                assert.deepStrictEqual(recordState(older), olderBefore, 'and never reaches the older row');

                const promoted = callAs('kit_curator', 'usp_PromoteRecord', named);
                assert.ok(promoted.error && promoted.error.message.includes('no live project record'),
                    'promote resolves the same row and finds it archived: ' + JSON.stringify(promoted));
                assert.deepStrictEqual(recordState(older), olderBefore, 'the older row is untouched throughout');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('a fleet project row is listed on asking, embedded, stamped by its project key, and labelled by its writer', () => {
            const name = 'fleet-sibling-' + runId;
            const axis = 800;
            mapConnection('SCOTT-CLAUDE');
            const written = put({ Tier: 'project', ProjectKey: keyOne, Name: name, Description: 'a fleet row', Body: 'fleet body' });
            assert.ok(!written.error && written.value.status === 'stored', JSON.stringify(written));
            const id = written.value.recordId;
            mapConnection('NEO-CLAUDE');
            try {
                // usp_ListRecords: absent by default, so the publish's own diff
                // is unchanged, and present when the caller asks for the fleet.
                const inventory = (includeFleet) => {
                    const res = rowsAs(null, 'usp_ListRecords', "@p_ModelIdentity = 'test-model'" + (includeFleet ? ', @p_IncludeFleet = 1' : ''));
                    assert.ok(!res.error, JSON.stringify(res.error));
                    return res.rows;
                };
                assert.ok(!inventory(false).some((r) => r.recordId === id), 'the default inventory leaves the fleet row out');
                const fleetRow = inventory(true).find((r) => r.recordId === id);
                assert.ok(fleetRow, 'the inventory asked for the fleet lists the fleet row');
                assert.deepStrictEqual({ tier: fleetRow.tier, segment: fleetRow.segment, embedded: fleetRow.embedded }, { tier: 'project', segment: null, embedded: false });

                // usp_UpsertEmbeddings: NEO, which did not write the row, stores
                // its vector through the procedure.
                const embedded = call('usp_UpsertEmbeddings', "@p_Embeddings = N'" + JSON.stringify([{ recordId: id, chunkIndex: 0, chunkOffset: 0,
                    chunkLength: 10, vector: JSON.parse(axisVector(axis)), model: 'test-model', dimensions: DIMENSIONS }]) + "'");
                assert.ok(!embedded.error, JSON.stringify(embedded.error));
                assert.deepStrictEqual(embedded.value, { inserted: 1, updated: 0, rejected: 0 }, 'a fleet row takes any mapped sandbox\'s vector');
                assert.strictEqual(embeddingsOf(id), 1);
                assert.strictEqual(inventory(true).find((r) => r.recordId === id).embedded, true);

                // usp_AppendUsage: a project stamp names the fleet row by its
                // project key and name. The same element with no key, which
                // falls to the segment locator, finds no row and is rejected.
                const usageRows = () => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage WHERE [RecordId] = " + id + ';'), 'n'));
                const stamp = (extra) => call('usp_AppendUsage', "@p_Usage = N'" + JSON.stringify([{ tier: 'project', name, kind: 'read',
                    at: '2026-10-01T00:00:00Z', stampId: crypto.randomUUID(), ...extra }]) + "'");
                const byKey = stamp({ projectKey: keyOne });
                assert.ok(!byKey.error, JSON.stringify(byKey.error));
                assert.deepStrictEqual(byKey.value, { appended: 1, rejected: 0, skipped: 0 }, 'the project key locates the fleet row');
                assert.strictEqual(usageRows(), 1);
                const bySegment = stamp({});
                assert.ok(!bySegment.error, JSON.stringify(bySegment.error));
                assert.deepStrictEqual(bySegment.value, { appended: 0, rejected: 1, skipped: 0 }, 'with no key the fleet row is not located');
                assert.strictEqual(usageRows(), 1);
                const otherKey = stamp({ projectKey: keyTwo });
                assert.deepStrictEqual(otherKey.value, { appended: 0, rejected: 1, skipped: 0 }, 'another project\'s key does not locate it');

                // A projectKey on an operator stamp is ignored: the stamp
                // resolves by tier and name as it did before keys existed.
                const operatorName = 'usage-operator-' + runId;
                const operatorWritten = put({ Tier: 'operator', Name: operatorName, Description: 'an operator row for a stamp', Body: 'b' });
                assert.ok(!operatorWritten.error && operatorWritten.value.status === 'stored', JSON.stringify(operatorWritten));
                const operatorStamp = call('usp_AppendUsage', "@p_Usage = N'" + JSON.stringify([{ tier: 'operator', name: operatorName, projectKey: keyOne,
                    kind: 'read', at: '2026-10-01T00:00:00Z', stampId: crypto.randomUUID() }]) + "'");
                assert.ok(!operatorStamp.error, JSON.stringify(operatorStamp.error));
                assert.deepStrictEqual(operatorStamp.value, { appended: 1, rejected: 0, skipped: 0 }, 'an operator stamp carrying a project key still appends');

                // A project stamp carrying a key whose record is only in the
                // caller's older store, as a stamp queued before the migration
                // moves its record is, falls back to the segment and lands there.
                mapConnection('SCOTT-CLAUDE');
                const olderRows = () => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage WHERE [RecordId] = " + ids.scottPrivate + ';'), 'n'));
                const olderBefore = olderRows();
                const fallback = call('usp_AppendUsage', "@p_Usage = N'" + JSON.stringify([{ tier: 'project', segment, name: 'scott-private-' + runId,
                    projectKey: keyOne, kind: 'read', at: '2026-10-01T00:00:00Z', stampId: crypto.randomUUID() }]) + "'");
                assert.ok(!fallback.error, JSON.stringify(fallback.error));
                assert.deepStrictEqual(fallback.value, { appended: 1, rejected: 0, skipped: 0 }, 'the segment locator takes a keyed stamp no fleet row matches');
                assert.strictEqual(olderRows(), olderBefore + 1, 'and the row lands on the older-store record');

                // The same stamp once a fleet row of that name exists under the
                // key: both locators match, and the fleet row takes the stamp.
                const fleetTwin = put({ Tier: 'project', ProjectKey: keyOne, Name: 'scott-private-' + runId, Description: 'the fleet copy', Body: 'b' });
                assert.ok(!fleetTwin.error && fleetTwin.value.status === 'stored', JSON.stringify(fleetTwin));
                const twinRows = () => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage WHERE [RecordId] = " + fleetTwin.value.recordId + ';'), 'n'));
                const both = call('usp_AppendUsage', "@p_Usage = N'" + JSON.stringify([{ tier: 'project', segment, name: 'scott-private-' + runId,
                    projectKey: keyOne, kind: 'read', at: '2026-10-02T00:00:00Z', stampId: crypto.randomUUID() }]) + "'");
                assert.ok(!both.error, JSON.stringify(both.error));
                assert.deepStrictEqual(both.value, { appended: 1, rejected: 0, skipped: 0 });
                assert.deepStrictEqual([twinRows(), olderRows()], [1, olderBefore + 1], 'the key match outranks the segment match');
                mapConnection('NEO-CLAUDE');

                // usp_Health counts the fleet store's rows, which no sandbox's
                // line carries.
                const health = call('usp_Health', "@p_ModelIdentity = 'test-model'");
                assert.ok(!health.error, JSON.stringify(health.error));
                assert.ok(health.value.fleetRecords >= 1 && health.value.fleetEmbeddings >= 1,
                    'the fleet row and its vector are counted: ' + JSON.stringify(health.value));

                // usp_Nearest and usp_Search label the row by the sandbox that
                // wrote it, read here by NEO.
                const nearest = call('usp_Nearest', nearestParams, vectorPrelude(axis));
                assert.ok(!nearest.error, JSON.stringify(nearest.error));
                const near = nearest.value.find((r) => r.recordId === id);
                const searched = call('usp_Search', searchParams, vectorPrelude(axis));
                assert.ok(!searched.error, JSON.stringify(searched.error));
                const found = searched.value.find((r) => r.recordId === id);
                assert.ok(near && found, JSON.stringify({ nearest: nearest.value, search: searched.value }));
                assert.deepStrictEqual([near.sandbox, found.sandbox], ['SCOTT-CLAUDE', 'SCOTT-CLAUDE'], 'both procedures name the writer');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('the version 6 publish shape still lands in the sandbox\'s own older store as a file row', () => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const record = { tier: 'project', segment: 'seg-v6shape-' + runId, name: 'v6shape-' + runId, fileKey: 'v6shape.md',
                    description: 'a version 6 publish', body: 'b', bodyHash: 'hv6', fileModified: '2026-09-17T12:00:00Z', archived: false };
                const upsert = call('usp_UpsertRecords', "@p_Records = N'" + JSON.stringify([record]) + "'");
                assert.ok(!upsert.error, JSON.stringify(upsert.error));
                assert.deepStrictEqual(upsert.value, { added: 1, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0, held: 0, twins: [] });
                const id = Number(one(sqlOk("SELECT 'kittest-id=' + CAST([RecordId] AS VARCHAR(20)) FROM mem.Record WHERE [Name] = N'" + record.name + "';"), 'id'));
                const state = recordState(id);
                assert.deepStrictEqual({ origin: state.Origin, visibility: state.Visibility, storeSandbox: state.StoreSandboxId, segment: state.StoreSegment, key: state.ProjectKey, pinned: state.IsPinned },
                    { origin: 'file', visibility: 'private', storeSandbox: ids.scott, segment: record.segment, key: null, pinned: false }, JSON.stringify(state));
            } finally {
                mapConnection(null);
            }
        });

        await t.test('a version 6 republish keeps the archive usp_PromoteRecord set on an older-store row', () => {
            const record = { tier: 'project', segment: 'seg-v6promote-' + runId, name: 'v6promote-' + runId, fileKey: 'v6promote-' + runId + '.md',
                description: 'a version 6 publish', body: 'b1', bodyHash: 'hp1', fileModified: '2026-09-17T12:00:00Z', archived: false };
            mapConnection('SCOTT-CLAUDE');
            try {
                const first = call('usp_UpsertRecords', '@p_Records = ' + lit(JSON.stringify([record])));
                assert.ok(!first.error && first.value.added === 1, JSON.stringify(first));
            } finally {
                mapConnection(null);
            }
            const promoted = callAs('kit_curator', 'usp_PromoteRecord',
                paramsOf({ SandboxName: 'SCOTT-CLAUDE', Segment: record.segment, Name: record.name }));
            assert.ok(!promoted.error, JSON.stringify(promoted.error));
            const id = promoted.value.archivedRecordId;
            assert.strictEqual(recordState(id).IsArchived, true, 'the promotion archived the older-store row');
            mapConnection('SCOTT-CLAUDE');
            try {
                const again = call('usp_UpsertRecords', '@p_Records = ' + lit(JSON.stringify([{ ...record, body: 'b2', bodyHash: 'hp2',
                    fileModified: '2026-09-18T12:00:00Z' }])));
                assert.ok(!again.error, JSON.stringify(again.error));
                assert.strictEqual(again.value.changed, 1, 'the republish wrote the row: ' + JSON.stringify(again.value));
            } finally {
                mapConnection(null);
            }
            const after = recordState(id);
            assert.deepStrictEqual([after.Body, after.IsArchived], ['b2', true], 'the new body landed and the archive stood');
        });

        // The migration by republish: a version 7 upsert carries each project
        // record's key and lands it in that key's fleet store, moving the
        // caller's older row. Every name and key below is this run's own.
        const upsertAs = (sandbox, records) => {
            mapConnection(sandbox);
            try {
                return call('usp_UpsertRecords', '@p_Records = ' + lit(JSON.stringify(records)));
            } finally {
                mapConnection(null);
            }
        };
        const fileRow = (fields) => ({ tier: 'project', description: 'd', archived: false, ...fields,
            fileKey: fields.fileKey || fields.name + '.md', bodyHash: fields.bodyHash || 'h-' + fields.body });
        // Every row of the named names, with the store each sits in, read back
        // in one statement so two readings compare as wholes.
        const rowsNamed = (names) => {
            const res = sqlOk([
                "SELECT 'kittest-row=' + (SELECT R.[RecordId], R.[Name], R.[Body], R.[IsArchived], R.[DeletedDt], R.[UpdatedDt], R.[Origin],",
                '  S.[ProjectKey], S.[SandboxId], S.[Segment] FROM mem.Record R INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]',
                '  WHERE R.[RecordId] = X.[RecordId] FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)',
                'FROM mem.Record X WHERE X.[Name] IN (' + names.map(lit).join(', ') + ') ORDER BY X.[RecordId];'
            ].join('\n'));
            return (res.tags.row || []).map((text) => JSON.parse(text));
        };

        await t.test('a version 7 upsert from two sandboxes merges each twin both ways, a case-differing pair as one, and a second upsert changes nothing', () => {
            const segment = 'seg-twin-' + runId;
            const key = 'path:' + segment;
            const names = { neoWins: 'twin-a-' + runId, scottWins: 'twin-b-' + runId,
                caseScott: 'Twin-Case-' + runId, caseNeo: 'twin-case-' + runId };
            const at = (day) => '2026-09-0' + day + 'T00:00:00Z';
            // Each sandbox's own files, the same three names, with the times that
            // decide each twin: NEO newer on the first and on the case pair,
            // SCOTT newer on the second.
            const scott = [fileRow({ segment, name: names.neoWins, body: 'scott a', fileModified: at(1) }),
                fileRow({ segment, name: names.scottWins, body: 'scott b', fileModified: at(3) }),
                fileRow({ segment, name: names.caseScott, body: 'scott case', fileModified: at(1) })];
            const neo = [fileRow({ segment, name: names.neoWins, body: 'neo a', fileModified: at(2) }),
                fileRow({ segment, name: names.scottWins, body: 'neo b', fileModified: at(2) }),
                fileRow({ segment, name: names.caseNeo, body: 'neo case', fileModified: at(2) })];
            // The older stores the version 6 publishes left.
            for (const [sandbox, rows] of [['SCOTT-CLAUDE', scott], ['NEO-CLAUDE', neo]]) {
                const v6 = upsertAs(sandbox, rows);
                assert.ok(!v6.error && v6.value.added === 3, JSON.stringify(v6));
            }
            const v7 = (rows) => rows.map((r) => ({ ...r, projectKey: key }));
            const all = Object.values(names);

            const fromScott = upsertAs('SCOTT-CLAUDE', v7(scott));
            assert.ok(!fromScott.error, JSON.stringify(fromScott.error));
            assert.deepStrictEqual({ changed: fromScott.value.changed, twins: fromScott.value.twins }, { changed: 3, twins: [] },
                'the first sandbox moves its three older rows in and meets no twin: ' + JSON.stringify(fromScott.value));
            const fromNeo = upsertAs('NEO-CLAUDE', v7(neo));
            assert.ok(!fromNeo.error, JSON.stringify(fromNeo.error));
            assert.deepStrictEqual(fromNeo.value.twins, [
                { name: names.neoWins, winner: 'NEO-CLAUDE', loser: 'SCOTT-CLAUDE' },
                { name: names.scottWins, winner: 'SCOTT-CLAUDE', loser: 'NEO-CLAUDE' },
                { name: names.caseNeo, winner: 'NEO-CLAUDE', loser: 'SCOTT-CLAUDE' }
            ], 'every twin is named with the sandbox whose copy won and the one whose copy lost: ' + JSON.stringify(fromNeo.value));
            assert.strictEqual(fromNeo.value.skippedOlder, 1, 'a losing copy counts as older');

            const rows = rowsNamed(all);
            const live = rows.filter((r) => r.DeletedDt === null);
            const deleted = rows.filter((r) => r.DeletedDt !== null);
            // One live row per record, in the fleet store, with the newer body;
            // the case-differing pair is one record.
            assert.deepStrictEqual(live.map((r) => [r.Name, r.Body, r.ProjectKey, r.SandboxId]).sort(), [
                [names.neoWins, 'neo a', key, null], [names.scottWins, 'scott b', key, null], [names.caseNeo, 'neo case', key, null]
            ].sort(), JSON.stringify(rows));
            // One deleted row per twin, holding the losing body, in an older store.
            assert.deepStrictEqual(deleted.map((r) => [r.Name, r.Body, r.ProjectKey === null]).sort(), [
                [names.neoWins, 'scott a', true], [names.scottWins, 'neo b', true], [names.caseScott, 'scott case', true]
            ].sort(), JSON.stringify(rows));

            // The publish run row names each twin and the losing sandbox.
            mapConnection('NEO-CLAUDE');
            try {
                const run = call('usp_AppendPublishRun', '@p_Run = ' + lit(JSON.stringify({ started: '2026-10-03T00:00:00Z',
                    twins: fromNeo.value.twins })));
                assert.ok(!run.error, JSON.stringify(run.error));
                const stored = JSON.parse(one(sqlOk("SELECT 'kittest-twins=' + [TwinMerges] FROM mem.PublishRun WHERE [PublishRunId] = "
                    + Number(run.value.publishRunId) + ';'), 'twins'));
                assert.deepStrictEqual(stored.find((tw) => tw.name === names.scottWins).loser, 'NEO-CLAUDE', JSON.stringify(stored));
                // A twins value that is not an array, a scalar or an object, is refused.
                for (const twins of ['not a list', { name: 'x' }]) {
                    const refused = call('usp_AppendPublishRun', '@p_Run = ' + lit(JSON.stringify({ started: '2026-10-03T00:00:00Z', twins })));
                    assert.ok(refused.error && /twins must be a JSON array/.test(refused.error.message), JSON.stringify(refused));
                }
            } finally {
                mapConnection(null);
            }

            // A second upsert from either sandbox changes no row.
            for (const [sandbox, rowsOf] of [['SCOTT-CLAUDE', scott], ['NEO-CLAUDE', neo]]) {
                const again = upsertAs(sandbox, v7(rowsOf));
                assert.ok(!again.error, JSON.stringify(again.error));
                assert.strictEqual(again.value.changed + again.value.added, 0, sandbox + ': ' + JSON.stringify(again.value));
                assert.deepStrictEqual(again.value.twins, [], sandbox + '\'s second upsert resolves no twin, so it names none');
                assert.deepStrictEqual(rowsNamed(all), rows, sandbox + '\'s second upsert must change nothing');
            }
        });

        await t.test('a republish never writes a memq row, and never clears an archive, a delete or a promotion made through the database', () => {
            const segment = 'seg-guard-' + runId;
            const key = 'path:' + segment;
            const names = { memq: 'guard-memq-' + runId, archived: 'guard-arch-' + runId, deleted: 'guard-del-' + runId,
                promoted: 'guard-promo-' + runId, operator: 'guard-op-' + runId };
            const v7 = (name, body, extra) => fileRow({ segment, projectKey: key, name, body, fileModified: '2026-09-01T00:00:00Z', ...extra });

            // A record a session corrected in the database: a memq row.
            mapConnection('SCOTT-CLAUDE');
            const corrected = put({ Tier: 'project', ProjectKey: key, Name: names.memq, Description: 'corrected', Body: 'the correction' });
            mapConnection(null);
            assert.ok(!corrected.error && corrected.value.status === 'stored', JSON.stringify(corrected));
            const memqBefore = recordState(corrected.value.recordId);

            // Three file rows, then a verb's archive, a verb's delete, and a promotion.
            const first = upsertAs('SCOTT-CLAUDE', [v7(names.archived, 'a1'), v7(names.deleted, 'd1'), v7(names.promoted, 'p1')]);
            assert.ok(!first.error && first.value.added === 3, JSON.stringify(first));
            const operatorFirst = upsertAs('SCOTT-CLAUDE', [{ tier: 'operator', name: names.operator, fileKey: names.operator + '.md',
                description: 'd', body: 'o1', bodyHash: 'h-o1', fileModified: '2026-09-01T00:00:00Z', archived: false }]);
            assert.ok(!operatorFirst.error && operatorFirst.value.added === 1, JSON.stringify(operatorFirst));
            mapConnection('NEO-CLAUDE');
            try {
                for (const [name, extra] of [[names.archived, {}], [names.deleted, { Delete: 1 }]]) {
                    const retired = call('usp_ArchiveRecord', paramsOf({ Tier: 'project', ProjectKey: key, Name: name, ...extra }));
                    assert.ok(!retired.error, JSON.stringify(retired.error));
                }
                const op = call('usp_ArchiveRecord', paramsOf({ Tier: 'operator', Name: names.operator }));
                assert.ok(!op.error && op.value.status === 'archived', JSON.stringify(op));
            } finally {
                mapConnection(null);
            }
            const promoted = callAs('kit_curator', 'usp_PromoteRecord', paramsOf({ ProjectKey: key, Name: names.promoted }));
            assert.ok(!promoted.error, JSON.stringify(promoted.error));
            const deletedBefore = rowsNamed([names.deleted]);

            // The republish: every file now newer, live and with a changed body.
            const again = upsertAs('SCOTT-CLAUDE', [v7(names.memq, 'a stale file body', { fileModified: '2026-09-09T00:00:00Z' }),
                v7(names.archived, 'a2', { fileModified: '2026-09-09T00:00:00Z' }), v7(names.deleted, 'd2', { fileModified: '2026-09-09T00:00:00Z' }),
                v7(names.promoted, 'p2', { fileModified: '2026-09-09T00:00:00Z' })]);
            assert.ok(!again.error, JSON.stringify(again.error));
            assert.strictEqual(again.value.held, 2, 'the memq row and the deleted row are held: ' + JSON.stringify(again.value));
            const operatorAgain = upsertAs('SCOTT-CLAUDE', [{ tier: 'operator', name: names.operator, fileKey: names.operator + '.md',
                description: 'd', body: 'o2', bodyHash: 'h-o2', fileModified: '2026-09-09T00:00:00Z', archived: false }]);
            assert.ok(!operatorAgain.error, JSON.stringify(operatorAgain.error));
            const after = rowsNamed(Object.values(names));
            // The project row of a name, or the operator row for the operator name.
            const liveRow = (name) => after.find((r) => r.Name === name && r.DeletedDt === null
                && (name === names.operator ? r.ProjectKey === null : r.ProjectKey === key));

            const memqAfter = recordState(corrected.value.recordId);
            assert.deepStrictEqual({ body: memqAfter.Body, updated: memqAfter.UpdatedDt, origin: memqAfter.Origin },
                { body: memqBefore.Body, updated: memqBefore.UpdatedDt, origin: 'memq' }, 'a memq row is never written by a publish');
            assert.deepStrictEqual(rowsNamed([names.deleted]), deletedBefore, 'a verb\'s delete stands, body and all');
            assert.ok(deletedBefore.length === 1 && deletedBefore[0].DeletedDt !== null, JSON.stringify(deletedBefore));
            for (const name of [names.archived, names.promoted, names.operator]) {
                const row = liveRow(name);
                assert.ok(row && row.IsArchived === true, name + ' keeps the archive a verb set: ' + JSON.stringify(after));
            }
            assert.ok(after.some((r) => r.Name === names.archived && r.Body === 'a2'),
                'the control: the republish did write the archived row\'s new body, so the flag above held by the rule');
        });

        await t.test('usp_AdoptProjectStore moves a folder store into a remote store with each row\'s embeddings and usage, merges by the target-wins rule, and refuses any other pair of keys', () => {
            const from = 'path:seg-adopt-' + runId;
            const to = 'remote:example.test/adopt-' + runId;
            const n = (s) => 'adopt-' + s + '-' + runId;
            const names = { move: n('move'), memq: n('memq'), arch: n('arch'), del: n('del'), older: n('older'), newer: n('newer'),
                clashSource: n('clash-src'), clashTarget: n('clash-tgt') };
            const src = (name, extra) => fileRow({ segment: 'seg-adopt-' + runId, projectKey: from, name, body: 'source ' + name,
                fileModified: '2026-09-05T00:00:00Z', ...extra });
            const tgt = (name, extra) => fileRow({ segment: 'seg-adopt-target-' + runId, projectKey: to, name, body: 'target ' + name,
                fileModified: '2026-09-05T00:00:00Z', ...extra });

            // The target store: a memq row, an archived row, a deleted row, a
            // live file row older than its source, one newer, and one holding the
            // clash's file key under another name.
            const targets = upsertAs('NEO-CLAUDE', [tgt(names.arch), tgt(names.del), tgt(names.older, { fileModified: '2026-09-01T00:00:00Z' }),
                tgt(names.newer, { fileModified: '2026-09-09T00:00:00Z' }), tgt(names.clashTarget, { fileKey: 'clash-' + runId + '.md' })]);
            assert.ok(!targets.error && targets.value.added === 5, JSON.stringify(targets));
            mapConnection('NEO-CLAUDE');
            try {
                const memqRow = put({ Tier: 'project', ProjectKey: to, Name: names.memq, Description: 'corrected', Body: 'target memq' });
                assert.ok(!memqRow.error && memqRow.value.status === 'stored', JSON.stringify(memqRow));
                assert.ok(!call('usp_ArchiveRecord', paramsOf({ Tier: 'project', ProjectKey: to, Name: names.arch })).error);
                assert.ok(!call('usp_ArchiveRecord', paramsOf({ Tier: 'project', ProjectKey: to, Name: names.del, Delete: 1 })).error);
            } finally {
                mapConnection(null);
            }
            const sources = upsertAs('SCOTT-CLAUDE', [src(names.move), src(names.memq), src(names.arch), src(names.del), src(names.older),
                src(names.newer), src(names.clashSource, { fileKey: 'clash-' + runId + '.md' })]);
            assert.ok(!sources.error && sources.value.added === 7, JSON.stringify(sources));
            const all = Object.values(names);
            const before = rowsNamed(all);
            const sourceRow = (rows, name) => rows.find((r) => r.Name === name && r.Body === 'source ' + name);
            const targetRow = (rows, name) => rows.find((r) => r.Name === name && r.Body !== 'source ' + name);
            const moving = sourceRow(before, names.move).RecordId;
            embedOnAxis(moving, 710);
            sqlOk("INSERT INTO mem.Usage ([RecordId], [Kind], [StampedDt], [SandboxId], [StampId]) VALUES (" + moving
                + ", 'read', SYSDATETIMEOFFSET(), " + ids.scott + ", N'adopt-stamp-" + runId + "');");
            const usageOf = (recordId) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage WHERE [RecordId] = "
                + Number(recordId) + ';'), 'n'));

            // Keys that are not a folder key into a remote key are refused, and
            // nothing is written; so is an unmapped login.
            mapConnection('SCOTT-CLAUDE');
            try {
                for (const [a, b] of [[to, to], [from, 'path:elsewhere-' + runId], [to, from], ['', to]]) {
                    const refused = call('usp_AdoptProjectStore', paramsOf({ FromKey: a, ToKey: b }));
                    assert.ok(refused.error && refused.error.number === 50000 && /path:.*remote:/.test(refused.error.message),
                        a + ' into ' + b + ': ' + JSON.stringify(refused));
                }
                // A key longer than a store holds is refused, never cut to 400
                // characters and read as some other key.
                for (const [a, b] of [[from + 'x'.repeat(401), to], [from, to + 'x'.repeat(401)]]) {
                    const refused = call('usp_AdoptProjectStore', paramsOf({ FromKey: a, ToKey: b }));
                    assert.ok(refused.error && refused.error.number === 50000 && /400/.test(refused.error.message),
                        'an over-length key: ' + JSON.stringify(refused.error || refused.value));
                }
            } finally {
                mapConnection(null);
            }
            const unmapped = call('usp_AdoptProjectStore', paramsOf({ FromKey: from, ToKey: to }));
            assert.ok(unmapped.error && /maps to no sandbox/.test(unmapped.error.message), JSON.stringify(unmapped));
            assert.deepStrictEqual(rowsNamed(all), before, 'a refused adoption writes nothing');

            mapConnection('SCOTT-CLAUDE');
            let adopted;
            let second;
            let afterFirst;
            try {
                adopted = call('usp_AdoptProjectStore', paramsOf({ FromKey: from, ToKey: to }));
                assert.ok(!adopted.error, JSON.stringify(adopted.error));
                afterFirst = rowsNamed(all);
                second = call('usp_AdoptProjectStore', paramsOf({ FromKey: from, ToKey: to }));
                assert.ok(!second.error, JSON.stringify(second.error));
            } finally {
                mapConnection(null);
            }
            assert.deepStrictEqual({ moved: adopted.value.moved, merged: adopted.value.merged, skipped: adopted.value.skipped,
                skippedNames: adopted.value.skippedNames, mergedNames: [...adopted.value.mergedNames].sort() },
            { moved: 1, merged: 5, skipped: 1, skippedNames: [names.clashSource],
                mergedNames: [names.memq, names.arch, names.del, names.older, names.newer].sort() }, JSON.stringify(adopted.value));

            const after = afterFirst;
            // The moved row is in the target store, its vectors and usage with it.
            const moved = sourceRow(after, names.move);
            assert.deepStrictEqual([moved.RecordId, moved.ProjectKey, moved.DeletedDt], [moving, to, null], JSON.stringify(moved));
            assert.strictEqual(embeddingsOf(moving), 1, 'the embedding travels with the row');
            assert.strictEqual(usageOf(moving), 1, 'and so does its usage');
            // A memq, an archived and a deleted target row stand unchanged, and
            // each source row moves, deleted, into the caller's older store for
            // the folder's segment.
            const inCallersOlderStore = (row) => row.ProjectKey === null && row.SandboxId === ids.scott
                && row.Segment === from.slice('path:'.length) && row.DeletedDt !== null;
            for (const name of [names.memq, names.arch, names.del, names.newer]) {
                assert.deepStrictEqual(targetRow(after, name), targetRow(before, name), name + ': the target row is unchanged');
                const source = sourceRow(after, name);
                assert.ok(inCallersOlderStore(source), name + ': ' + JSON.stringify(source));
            }
            // A live, older file row is the one the source replaces, and it moves
            // into the caller's older store with the deleted mark.
            const won = sourceRow(after, names.older);
            const lost = targetRow(after, names.older);
            assert.deepStrictEqual([won.ProjectKey, won.DeletedDt], [to, null], JSON.stringify(won));
            assert.ok(inCallersOlderStore(lost), JSON.stringify(lost));
            // The clash stays in place, live.
            const clash = sourceRow(after, names.clashSource);
            assert.deepStrictEqual([clash.ProjectKey, clash.DeletedDt], [from, null], JSON.stringify(clash));

            // A second call changes nothing.
            assert.deepStrictEqual({ moved: second.value.moved, merged: second.value.merged, skipped: second.value.skipped },
                { moved: 0, merged: 0, skipped: 1 }, JSON.stringify(second.value));
            assert.deepStrictEqual(rowsNamed(all), afterFirst, 'the second adoption changes no row');
        });

        // One adoption over a fresh pair of stores: the remote store holds one
        // target row, set up by `target`, and the folder store one source row,
        // written by `source`; answers the adoption and both rows after it.
        const adoptOne = (label, target, source) => {
            const from = 'path:seg-' + label + '-' + runId;
            const to = 'remote:example.test/' + label + '-' + runId;
            const name = label + '-' + runId;
            target({ to, name });
            const sourceId = source({ from, name });
            mapConnection('SCOTT-CLAUDE');
            let adopted;
            try {
                adopted = call('usp_AdoptProjectStore', paramsOf({ FromKey: from, ToKey: to }));
            } finally {
                mapConnection(null);
            }
            assert.ok(!adopted.error, JSON.stringify(adopted.error));
            const rows = rowsNamed([name, name.toUpperCase()]);
            return { from, to, name, adopted: adopted.value, rows, source: rows.find((r) => r.RecordId === sourceId) };
        };
        const fileTarget = (extra, retire) => ({ to, name }) => {
            const landed = upsertAs('NEO-CLAUDE', [fileRow({ segment: 'seg-target-' + name, projectKey: to, name: (extra && extra.name) || name,
                fileKey: name + '.md', body: 'target', fileModified: '2026-09-09T00:00:00Z' })]);
            assert.ok(!landed.error && landed.value.added === 1, JSON.stringify(landed));
            if (retire) {
                mapConnection('NEO-CLAUDE');
                try {
                    assert.ok(!call('usp_ArchiveRecord', paramsOf({ Tier: 'project', ProjectKey: to, Name: (extra && extra.name) || name, ...retire })).error);
                } finally {
                    mapConnection(null);
                }
            }
        };
        const memqSource = ({ from, name }) => {
            mapConnection('SCOTT-CLAUDE');
            try {
                const written = put({ Tier: 'project', ProjectKey: from, Name: name, Description: 'corrected', Body: 'memq body' });
                assert.ok(!written.error && written.value.status === 'stored', JSON.stringify(written));
                return written.value.recordId;
            } finally {
                mapConnection(null);
            }
        };

        await t.test('usp_AdoptProjectStore moves a memq source row over a live, newer file target and retires the file row', () => {
            const r = adoptOne('adopt-mq-wins', fileTarget(), memqSource);
            assert.deepStrictEqual(r.adopted.mergedNames, [r.name], JSON.stringify(r.adopted));
            assert.deepStrictEqual([r.source.ProjectKey, r.source.DeletedDt, r.source.Origin], [r.to, null, 'memq'], JSON.stringify(r.rows));
            const file = r.rows.find((row) => row.Origin === 'file');
            assert.deepStrictEqual([file.ProjectKey, file.SandboxId, file.Segment, file.DeletedDt !== null], [null, ids.scott, r.from.slice(5), true],
                'the file row is retired into the caller\'s older store: ' + JSON.stringify(file));
        });

        await t.test('usp_AdoptProjectStore leaves a memq source row live in place over an archived file target, named skipped', () => {
            const r = adoptOne('adopt-mq-held', fileTarget(null, {}), memqSource);
            assert.deepStrictEqual(r.adopted.skippedNames, [r.name], JSON.stringify(r.adopted));
            assert.deepStrictEqual([r.source.ProjectKey, r.source.DeletedDt], [r.from, null], JSON.stringify(r.rows));
        });

        await t.test('usp_AdoptProjectStore leaves a source row in place over a deleted target of another name sharing its file key, named skipped', () => {
            const r = adoptOne('adopt-case', fileTarget({ name: ('adopt-case-' + runId).toUpperCase() }, { Delete: 1 }), ({ from, name }) => {
                const landed = upsertAs('SCOTT-CLAUDE', [fileRow({ segment: 'seg-source-' + name, projectKey: from, name,
                    fileKey: name + '.md', body: 'source', fileModified: '2026-09-10T00:00:00Z' })]);
                assert.ok(!landed.error && landed.value.added === 1, JSON.stringify(landed));
                return rowsNamed([name]).find((row) => row.ProjectKey === from).RecordId;
            });
            assert.deepStrictEqual({ merged: r.adopted.mergedNames, skipped: r.adopted.skippedNames }, { merged: [], skipped: [r.name] },
                JSON.stringify(r.adopted));
            assert.deepStrictEqual([r.source.ProjectKey, r.source.DeletedDt], [r.from, null], JSON.stringify(r.rows));
        });

        // The invariant every retiring path keeps: a fleet store holds a
        // deleted row only where a database verb deleted it, and each loser a
        // publish or an adoption retires sits deleted in a sandbox's older
        // store. The predicate counts deleted rows in the named fleet stores.
        const fleetDeletedIn = (keys) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record R"
            + ' INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId] WHERE S.[ProjectKey] IN (' + keys.map(lit).join(', ') + ')'
            + ' AND R.[DeletedDt] IS NOT NULL;'), 'n'));
        const sandboxIdOf = (name) => Number(one(sqlOk("SELECT 'kittest-n=' + CAST([SandboxId] AS VARCHAR(10)) FROM mem.Sandbox WHERE [Name] = "
            + lit(name) + ';'), 'n'));
        const adoptAs = (sandbox, from, to) => {
            mapConnection(sandbox);
            try {
                return call('usp_AdoptProjectStore', paramsOf({ FromKey: from, ToKey: to }));
            } finally {
                mapConnection(null);
            }
        };
        // Three sandboxes on one folder key. The remote store first holds
        // SCOTT's adopted copy, or a memq row; NEO then publishes a newer copy
        // and adopts, which retires one loser; ASR publishes its copy from
        // `thirdDay` and adopts last.
        const thirdAfterAdoption = (label, thirdDay, memqTarget) => {
            const segment = 'seg-' + label + '-' + runId;
            const from = 'path:' + segment;
            const to = 'remote:example.test/' + label + '-' + runId;
            const name = label + '-' + runId;
            const copy = (sandbox, day) => fileRow({ segment, projectKey: from, name, body: sandbox + ' body',
                fileModified: '2026-09-0' + day + 'T00:00:00Z' });
            let memqId = null;
            if (memqTarget) {
                mapConnection('SCOTT-CLAUDE');
                try {
                    const written = put({ Tier: 'project', ProjectKey: to, Name: name, Description: 'corrected', Body: 'memq body' });
                    assert.ok(!written.error && written.value.status === 'stored', JSON.stringify(written));
                    memqId = written.value.recordId;
                } finally {
                    mapConnection(null);
                }
            } else {
                const scott = upsertAs('SCOTT-CLAUDE', [copy('SCOTT-CLAUDE', 2)]);
                assert.ok(!scott.error && scott.value.added === 1, JSON.stringify(scott));
                const first = adoptAs('SCOTT-CLAUDE', from, to);
                assert.ok(!first.error && first.value.moved === 1, JSON.stringify(first));
            }
            const memqBefore = memqId === null ? null : recordState(memqId);
            const neo = upsertAs('NEO-CLAUDE', [copy('NEO-CLAUDE', 3)]);
            assert.ok(!neo.error && neo.value.added === 1, JSON.stringify(neo));
            const neoAdopt = adoptAs('NEO-CLAUDE', from, to);
            assert.ok(!neoAdopt.error && neoAdopt.value.merged === 1, JSON.stringify(neoAdopt));
            const third = upsertAs('ASR-CLAUDE', [copy('ASR-CLAUDE', thirdDay)]);
            assert.ok(!third.error, JSON.stringify(third.error));
            const thirdAdopt = adoptAs('ASR-CLAUDE', from, to);
            assert.ok(!thirdAdopt.error, JSON.stringify(thirdAdopt.error));
            const rows = rowsNamed([name]);
            return { segment, from, to, name, memqId, memqBefore, third: third.value, thirdAdopt: thirdAdopt.value, rows,
                live: rows.filter((r) => r.DeletedDt === null), deletedIn: (sandbox) => rows.filter((r) => r.DeletedDt !== null
                    && r.ProjectKey === null && r.SandboxId === sandboxIdOf(sandbox) && r.Segment === segment) };
        };

        await t.test('a third sandbox publishing its newest copy after another\'s adoption lands it and wins, and no fleet store keeps a deleted row', () => {
            const r = thirdAfterAdoption('third-new', 4, false);
            assert.deepStrictEqual({ added: r.third.added, held: r.third.held }, { added: 1, held: 0 }, 'the copy lands: ' + JSON.stringify(r.third));
            assert.deepStrictEqual(r.thirdAdopt.mergedNames, [r.name], JSON.stringify(r.thirdAdopt));
            assert.deepStrictEqual(r.live.map((row) => [row.Body, row.ProjectKey]), [['ASR-CLAUDE body', r.to]], JSON.stringify(r.rows));
            assert.deepStrictEqual(r.deletedIn('ASR-CLAUDE').map((row) => row.Body), ['NEO-CLAUDE body'], 'the beaten copy sits in the caller\'s older store');
            assert.deepStrictEqual(r.deletedIn('NEO-CLAUDE').map((row) => row.Body), ['SCOTT-CLAUDE body'], JSON.stringify(r.rows));
            assert.strictEqual(fleetDeletedIn([r.from, r.to]), 0, 'no fleet store holds a deleted row: ' + JSON.stringify(r.rows));
        });

        await t.test('a third sandbox publishing its oldest copy after another\'s adoption keeps it deleted in its own older store, named', () => {
            const r = thirdAfterAdoption('third-old', 1, false);
            assert.deepStrictEqual({ added: r.third.added, held: r.third.held }, { added: 1, held: 0 }, JSON.stringify(r.third));
            assert.deepStrictEqual(r.thirdAdopt.mergedNames, [r.name], 'the losing copy is named: ' + JSON.stringify(r.thirdAdopt));
            assert.deepStrictEqual(r.live.map((row) => [row.Body, row.ProjectKey]), [['NEO-CLAUDE body', r.to]], JSON.stringify(r.rows));
            assert.deepStrictEqual(r.deletedIn('ASR-CLAUDE').map((row) => row.Body), ['ASR-CLAUDE body'], JSON.stringify(r.rows));
            assert.strictEqual(fleetDeletedIn([r.from, r.to]), 0, JSON.stringify(r.rows));
        });

        await t.test('a third sandbox publishing after an adoption onto a memq row leaves the memq row untouched and its own copy deleted in its older store', () => {
            const r = thirdAfterAdoption('third-memq', 4, true);
            assert.deepStrictEqual({ added: r.third.added, held: r.third.held }, { added: 1, held: 0 }, JSON.stringify(r.third));
            const memqAfter = recordState(r.memqId);
            assert.deepStrictEqual({ body: memqAfter.Body, updated: memqAfter.UpdatedDt, deleted: memqAfter.DeletedDt, key: memqAfter.ProjectKey },
                { body: r.memqBefore.Body, updated: r.memqBefore.UpdatedDt, deleted: null, key: r.to }, 'the memq row is untouched');
            assert.deepStrictEqual(r.live.map((row) => row.Origin), ['memq'], JSON.stringify(r.rows));
            assert.deepStrictEqual(r.deletedIn('ASR-CLAUDE').map((row) => row.Body), ['ASR-CLAUDE body'], JSON.stringify(r.rows));
            assert.deepStrictEqual(r.deletedIn('NEO-CLAUDE').map((row) => row.Body), ['NEO-CLAUDE body'], JSON.stringify(r.rows));
            assert.strictEqual(fleetDeletedIn([r.from, r.to]), 0, JSON.stringify(r.rows));
            // The control: a verb's delete is a deleted fleet row the predicate counts.
            mapConnection('NEO-CLAUDE');
            try {
                const retired = call('usp_ArchiveRecord', paramsOf({ Tier: 'project', ProjectKey: r.to, Name: r.name, Delete: 1 }));
                assert.ok(!retired.error, JSON.stringify(retired.error));
            } finally {
                mapConnection(null);
            }
            assert.strictEqual(fleetDeletedIn([r.from, r.to]), 1, 'the predicate speaks for a deleted fleet row');
        });

        await t.test('an adoption loser over a deleted row of its file key in the caller\'s older store rewrites that row in place and removes the moved row', () => {
            let standingId = null;
            let embeddedUsage = null;
            const r = adoptOne('adopt-standing', fileTarget(), ({ from, name }) => {
                const segment = from.slice(5);
                const v6 = upsertAs('SCOTT-CLAUDE', [fileRow({ segment, name, fileKey: name + '.md', body: 'old', fileModified: '2026-09-01T00:00:00Z' })]);
                assert.ok(!v6.error && v6.value.added === 1, JSON.stringify(v6));
                mapConnection('SCOTT-CLAUDE');
                try {
                    const removed = call('usp_UpsertRecords', '@p_Records = N\'[]\', @p_Removed = ' + lit(JSON.stringify([{ segment, fileKey: name + '.md' }])));
                    assert.ok(!removed.error && removed.value.removed === 1, JSON.stringify(removed));
                } finally {
                    mapConnection(null);
                }
                const standing = rowsNamed([name]).find((row) => row.SandboxId === ids.scott);
                assert.ok(standing && standing.DeletedDt !== null, 'the older row is deleted: ' + JSON.stringify(rowsNamed([name])));
                standingId = standing.RecordId;
                // A publish under the folder key with no fleet row inserts a new
                // row and leaves the deleted older row where it is.
                const v7 = upsertAs('SCOTT-CLAUDE', [fileRow({ segment, projectKey: from, name, fileKey: name + '.md', body: 'source',
                    fileModified: '2026-09-05T00:00:00Z' })]);
                assert.ok(!v7.error && v7.value.added === 1, 'a new fleet row, never the deleted older one: ' + JSON.stringify(v7));
                const afterPublish = rowsNamed([name]);
                assert.deepStrictEqual(afterPublish.find((row) => row.RecordId === standingId),
                    { ...standing }, 'the deleted older row stands as it was');
                const sourceId = afterPublish.find((row) => row.ProjectKey === from).RecordId;
                embedOnAxis(sourceId, 711);
                sqlOk("INSERT INTO mem.Usage ([RecordId], [Kind], [StampedDt], [SandboxId], [StampId]) VALUES (" + sourceId
                    + ", 'read', SYSDATETIMEOFFSET(), " + ids.scott + ", N'standing-stamp-" + runId + "');");
                embeddedUsage = sourceId;
                return sourceId;
            });
            assert.deepStrictEqual(r.adopted.mergedNames, [r.name], JSON.stringify(r.adopted));
            assert.strictEqual(r.source, undefined, 'the moved row is gone: ' + JSON.stringify(r.rows));
            const standing = r.rows.find((row) => row.RecordId === standingId);
            assert.ok(standing && standing.Body === 'source' && standing.DeletedDt !== null && standing.ProjectKey === null,
                'the standing row holds the loser\'s fields and keeps its deleted mark: ' + JSON.stringify(r.rows));
            const counts = one(sqlOk("SELECT 'kittest-n=' + CAST((SELECT COUNT(*) FROM mem.Embedding WHERE [RecordId] = " + embeddedUsage
                + ") + (SELECT COUNT(*) FROM mem.Usage WHERE [RecordId] = " + embeddedUsage + ") AS VARCHAR(10));"), 'n');
            assert.strictEqual(Number(counts), 0, 'the moved row\'s embeddings and usage are not kept');
            assert.strictEqual(fleetDeletedIn([r.from, r.to]), 0, JSON.stringify(r.rows));
        });

        await t.test('an adoption loser over a live row of its file key in the caller\'s older store leaves both rows and names it skipped', () => {
            const r = adoptOne('adopt-live-older', fileTarget(), ({ from, name }) => {
                const segment = from.slice(5);
                const v6 = upsertAs('SCOTT-CLAUDE', [fileRow({ segment, name, fileKey: name + '.md', body: 'scott older', fileModified: '2026-09-01T00:00:00Z' })]);
                assert.ok(!v6.error && v6.value.added === 1, JSON.stringify(v6));
                const neo = upsertAs('NEO-CLAUDE', [fileRow({ segment, projectKey: from, name, fileKey: name + '.md', body: 'source',
                    fileModified: '2026-09-05T00:00:00Z' })]);
                assert.ok(!neo.error && neo.value.added === 1, JSON.stringify(neo));
                return rowsNamed([name]).find((row) => row.ProjectKey === from).RecordId;
            });
            assert.deepStrictEqual({ merged: r.adopted.mergedNames, skipped: r.adopted.skippedNames }, { merged: [], skipped: [r.name] },
                JSON.stringify(r.adopted));
            assert.deepStrictEqual([r.source.ProjectKey, r.source.DeletedDt], [r.from, null], 'the source row stays live: ' + JSON.stringify(r.rows));
            const older = r.rows.find((row) => row.SandboxId === ids.scott);
            assert.deepStrictEqual([older.Body, older.DeletedDt], ['scott older', null], 'the caller\'s live older row is untouched');
            const again = adoptAs('SCOTT-CLAUDE', r.from, r.to);
            assert.ok(!again.error && again.value.skipped === 1 && again.value.merged === 0, JSON.stringify(again));
            assert.deepStrictEqual(rowsNamed([r.name]), r.rows, 'a second call changes nothing');
        });

        await t.test('a losing twin from a sandbox with no older store is named once and kept deleted in a newly created older store', () => {
            const segment = 'seg-twin-noold-' + runId;
            const key = 'path:' + segment;
            const name = 'twin-noold-' + runId;
            const copy = (body, day) => fileRow({ segment, projectKey: key, name, body, fileModified: '2026-09-0' + day + 'T00:00:00Z' });
            const scott = upsertAs('SCOTT-CLAUDE', [copy('scott wins', 5)]);
            assert.ok(!scott.error && scott.value.added === 1, JSON.stringify(scott));
            const asrStores = () => Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Store WHERE [SandboxId] = "
                + sandboxIdOf('ASR-CLAUDE') + ' AND [Segment] = ' + lit(segment) + ';'), 'n'));
            assert.strictEqual(asrStores(), 0, 'ASR has no older store for the segment');

            const lost = upsertAs('ASR-CLAUDE', [copy('asr loses', 1)]);
            assert.ok(!lost.error, JSON.stringify(lost.error));
            assert.deepStrictEqual({ twins: lost.value.twins, skippedOlder: lost.value.skippedOlder },
                { twins: [{ name, winner: 'SCOTT-CLAUDE', loser: 'ASR-CLAUDE' }], skippedOlder: 1 }, JSON.stringify(lost.value));
            assert.strictEqual(asrStores(), 1, 'the older store is created');
            const rows = rowsNamed([name]);
            const kept = rows.filter((r) => r.SandboxId === sandboxIdOf('ASR-CLAUDE'));
            assert.ok(kept.length === 1 && kept[0].Body === 'asr loses' && kept[0].DeletedDt !== null, JSON.stringify(rows));
            assert.strictEqual(fleetDeletedIn([key]), 0, JSON.stringify(rows));

            // A second publish of the same losing copy writes nothing and names nothing.
            const again = upsertAs('ASR-CLAUDE', [copy('asr loses', 1)]);
            assert.ok(!again.error, JSON.stringify(again.error));
            assert.deepStrictEqual(again.value.twins, [], JSON.stringify(again.value));
            assert.deepStrictEqual(rowsNamed([name]), rows, 'the second publish changes no row');

            // A losing copy whose body changed rewrites that row, keeping its deleted mark, and is named again.
            const changed = upsertAs('ASR-CLAUDE', [copy('asr loses again', 2)]);
            assert.ok(!changed.error, JSON.stringify(changed.error));
            assert.deepStrictEqual(changed.value.twins, [{ name, winner: 'SCOTT-CLAUDE', loser: 'ASR-CLAUDE' }], JSON.stringify(changed.value));
            const rewritten = rowsNamed([name]).find((r) => r.RecordId === kept[0].RecordId);
            assert.deepStrictEqual([rewritten.Body, rewritten.DeletedDt], ['asr loses again', kept[0].DeletedDt], JSON.stringify(rewritten));
        });

        await t.test('usp_AdoptProjectStore refuses a key whose prefix differs in case alone, writing nothing', () => {
            const from = 'path:seg-adopt-case-key-' + runId;
            const to = 'remote:example.test/adopt-case-key-' + runId;
            mapConnection('SCOTT-CLAUDE');
            try {
                const written = put({ Tier: 'project', ProjectKey: from, Name: 'adopt-case-key-' + runId, Body: 'b' });
                assert.ok(!written.error, JSON.stringify(written.error));
                for (const [a, b] of [['PATH:' + from.slice(5), to], [from, 'REMOTE:' + to.slice(7)]]) {
                    const refused = call('usp_AdoptProjectStore', paramsOf({ FromKey: a, ToKey: b }));
                    assert.ok(refused.error && refused.error.number === 50000 && /path:.*remote:/.test(refused.error.message),
                        a + ' into ' + b + ': ' + JSON.stringify(refused.error || refused.value));
                }
                assert.deepStrictEqual(rowsNamed(['adopt-case-key-' + runId]).map((r) => r.ProjectKey), [from], 'nothing moved');
            } finally {
                mapConnection(null);
            }
        });

        await t.test('usp_UpsertRecords refuses a projectKey that opens neither path: nor remote:', () => {
            for (const projectKey of ['foo', 'PATH:seg', 'Remote:example.test/x', 'path:', 'remote:']) {
                const refused = upsertAs('SCOTT-CLAUDE', [fileRow({ segment: 'seg-badkey-' + runId, projectKey, name: 'badkey-' + runId,
                    body: 'b', fileModified: '2026-09-01T00:00:00Z' })]);
                assert.ok(refused.error && refused.error.number === 50000 && /path:.*remote:/.test(refused.error.message),
                    projectKey + ': ' + JSON.stringify(refused.error || refused.value));
            }
            const named = Number(one(sqlOk("SELECT 'kittest-n=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record WHERE [Name] = N'badkey-" + runId + "';"), 'n'));
            assert.strictEqual(named, 0, 'a refused batch writes nothing');
        });

        // Two sandboxes holding the same body under different frontmatter:
        // the fleet row keeps the newer copy's fields, whichever arrives last.
        const fleetFields = (name) => json(sqlOk([
            "SELECT 'kittest-row=' + (SELECT R.[Description], R.[FileModifiedDt], R.[LastPublishedDt], [Publisher] = P.[Name]",
            '  FROM mem.Record R INNER JOIN mem.Store S ON S.[StoreId] = R.[StoreId]',
            '  LEFT JOIN mem.Sandbox P ON P.[SandboxId] = R.[LastPublishedBySandboxId]',
            '  WHERE R.[Name] = ' + lit(name) + ' AND S.[ProjectKey] IS NOT NULL AND R.[DeletedDt] IS NULL',
            '  FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES);'
        ].join('\n')), 'row');
        const sameBody = (tag, first, second) => {
            const segment = 'seg-same-' + tag + '-' + runId;
            const name = 'same-' + tag + '-' + runId;
            const row = (description, day) => fileRow({ segment, projectKey: 'path:' + segment, name, body: 'one prose',
                description, fileModified: '2026-09-0' + day + 'T00:00:00Z' });
            const a = upsertAs('SCOTT-CLAUDE', [row(first.description, first.day)]);
            assert.ok(!a.error && a.value.added === 1, JSON.stringify(a));
            const before = fleetFields(name);
            const b = upsertAs('NEO-CLAUDE', [row(second.description, second.day)]);
            assert.ok(!b.error, JSON.stringify(b.error));
            return { before, b: b.value, after: fleetFields(name) };
        };

        await t.test('an older copy of the same body from another sandbox writes nothing to the fleet row, not even a stamp', () => {
            const { before, b, after } = sameBody('older', { description: 'D2', day: 5 }, { description: 'D1', day: 1 });
            assert.deepStrictEqual({ added: b.added, changed: b.changed, unchanged: b.unchanged, skippedOlder: b.skippedOlder, twins: b.twins },
                { added: 0, changed: 0, unchanged: 1, skippedOlder: 0, twins: [] }, JSON.stringify(b));
            assert.deepStrictEqual([after.Description, new Date(after.FileModifiedDt).toISOString(), after.Publisher],
                ['D2', '2026-09-05T00:00:00.000Z', 'SCOTT-CLAUDE'], 'the fleet row keeps the newer copy: ' + JSON.stringify(after));
            assert.deepStrictEqual(after, before, 'the older copy leaves the fleet row as it stood');
        });

        await t.test('a newer copy of the same body from another sandbox lands its fields on the fleet row', () => {
            const { b, after } = sameBody('newer', { description: 'D1', day: 1 }, { description: 'D2', day: 5 });
            assert.strictEqual(b.changed, 1, JSON.stringify(b));
            assert.deepStrictEqual([after.Description, new Date(after.FileModifiedDt).toISOString(), after.Publisher],
                ['D2', '2026-09-05T00:00:00.000Z', 'NEO-CLAUDE'], JSON.stringify(after));
        });

        // The upgrade the fleet host takes: a version 6 database built by the
        // installer as it stood at e4712827, read out of git into this run's
        // temp directory, holding records, embeddings and usage, then
        // upgraded in place by this tree's installer. The counts and a digest
        // of every record row are read before and after.
        const v6Database = dbName + '_v6';
        const v6Commit = 'e4712827';
        const haveV6 = spawnSync('git', ['-C', REPO, 'cat-file', '-e', v6Commit + '^{commit}'], { encoding: 'utf8' }).status === 0;
        await t.test('a version 6 database upgrades in place to the carried version, keeping every row, and a second run changes nothing',
            { skip: !haveV6 && 'commit ' + v6Commit + ' is not in this clone, so the version 6 installer cannot be read' }, () => {
                const v6Root = path.join(root, 'v6');
                // The version 6 tree as one archive, unpacked from standard input
                // into the temp root, so no path rides a tar argument.
                fs.mkdirSync(v6Root, { recursive: true });
                const archive = spawnSync('git', ['-C', REPO, 'archive', '--format=tar', v6Commit, 'plugins/grimoire/db'], { maxBuffer: 64 * 1024 * 1024 });
                assert.strictEqual(archive.status, 0, String(archive.stderr));
                const unpacked = spawnSync('tar', ['-x', '-f', '-'], { cwd: v6Root, input: archive.stdout, encoding: 'utf8' });
                assert.strictEqual(unpacked.status, 0, unpacked.stderr);
                const scripts = fs.readdirSync(path.join(v6Root, 'plugins', 'grimoire', 'db', 'Procedures')).filter((f) => f.endsWith('.sql'));
                assert.ok(scripts.length > 10, 'the version 6 tree holds its scripts: ' + scripts.length);
                const v6Installer = path.join(v6Root, 'plugins', 'grimoire', 'db', 'Install-MemoryDatabase.ps1');
                const v6Args = ['-Server', SERVER, '-Database', v6Database, '-LoginsPath', loginsPath, '-TrustServerCertificate'];
                const built = spawnSync('pwsh', ['-NoProfile', '-File', v6Installer].concat(v6Args), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
                assert.strictEqual(built.status, 0, built.stdout + built.stderr);
                assert.ok(outputLines(built).includes('Schema version: carried 6, installed none'), built.stdout);

                sqlOk([
                    "DECLARE @neo INT = (SELECT [SandboxId] FROM mem.Sandbox WHERE [Name] = N'NEO-CLAUDE');",
                    "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (@neo, 'project', N'seg-up');",
                    'DECLARE @project INT = SCOPE_IDENTITY();',
                    "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (NULL, 'type', N'type-up');",
                    'DECLARE @type INT = SCOPE_IDENTITY();',
                    "INSERT INTO mem.Store ([SandboxId], [Tier], [Segment]) VALUES (NULL, 'operator', NULL);",
                    'DECLARE @operator INT = SCOPE_IDENTITY();',
                    'INSERT INTO mem.Record ([StoreId], [Name], [FileKey], [Description], [Body], [BodyHash], [Visibility], [LastPublishedBySandboxId], [Tags])',
                    "VALUES (@project, N'up-project', N'up-project.md', N'd1', N'---\nname: up-project\n---\nbody one', 'h1', 'private', @neo, N'[\"t\"]'),",
                    "       (@type, N'up-type', N'up-type.md', N'd2', N'body two', 'h2', 'shared', @neo, NULL),",
                    "       (@operator, N'up-operator', N'up-operator.md', N'd3', N'body three', 'h3', 'shared', @neo, N'[]');",
                    'INSERT INTO mem.Embedding ([RecordId], [ChunkIndex], [ModelIdentity], [ChunkOffset], [ChunkLength], [Vector], [Dimensions])',
                    "SELECT R.[RecordId], 0, 'test-model', 0, 4, CAST(N'" + axisVector(3) + "' AS VECTOR(" + DIMENSIONS + ')), ' + DIMENSIONS + " FROM mem.Record R WHERE R.[Name] IN (N'up-project', N'up-type');",
                    "INSERT INTO mem.Usage ([RecordId], [Kind], [StampedDt], [SandboxId], [StampId]) SELECT R.[RecordId], 'read', SYSDATETIMEOFFSET(), @neo, N'up-stamp' FROM mem.Record R WHERE R.[Name] = N'up-project';"
                ].join('\n'), v6Database);
                const census = () => sqlOk([
                    "SELECT 'kittest-records=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record;",
                    "SELECT 'kittest-embeddings=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Embedding;",
                    "SELECT 'kittest-usage=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Usage;",
                    "SELECT 'kittest-stores=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Store;",
                    "SELECT 'kittest-digest=' + CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', (SELECT STRING_AGG(CAST(CONCAT(R.[RecordId], ':', R.[StoreId], ':', R.[Name], ':', R.[FileKey], ':',",
                    "  R.[Description], ':', R.[Body], ':', R.[BodyHash], ':', R.[Tags], ':', R.[Visibility], ':', R.[IsArchived], ':', R.[DeletedDt]) AS NVARCHAR(MAX)), '|')",
                    '  WITHIN GROUP ( ORDER BY R.[RecordId] ) FROM mem.Record R)), 2);',
                    "SELECT 'kittest-version=' + CAST(MAX([Version]) AS VARCHAR(10)) FROM mem.SchemaVersion;"
                ].join('\n'), v6Database).tags;
                const before = census();
                assert.deepStrictEqual([before.records[0], before.embeddings[0], before.usage[0], before.version[0]], ['3', '2', '1', '6'],
                    'the version 6 database holds the seeded rows: ' + JSON.stringify(before));

                const upgraded = runInstaller(v6Args);
                assert.strictEqual(upgraded.status, 0, upgraded.stdout + upgraded.stderr);
                assert.ok(outputLines(upgraded).includes('Schema version: carried ' + CARRIED_SCHEMA_VERSION + ', installed 6'), upgraded.stdout);
                const after = census();
                assert.deepStrictEqual(after, { ...before, version: [CARRIED_SCHEMA_VERSION] },
                    'every row is kept, unchanged, and the version moves: ' + JSON.stringify({ before, after }));
                const defaults = sqlOk("SELECT 'kittest-defaults=' + CAST(COUNT(*) AS VARCHAR(10)) FROM mem.Record WHERE [Origin] = 'file' AND [IsPinned] = 0"
                    + ' AND [Space] IS NULL AND [WrittenBySandboxId] IS NULL;', v6Database);
                assert.strictEqual(one(defaults, 'defaults'), '3', 'every kept row takes the new columns\' defaults');

                const settled = runInstaller(v6Args);
                assert.strictEqual(settled.status, 0, settled.stdout + settled.stderr);
                assert.deepStrictEqual(summaryOf(outputLines(settled)), { applied: expectedScriptLabels().length, changed: 0 }, settled.stdout);
                assert.deepStrictEqual(census(), after, 'the second run changes no row');
                // The counts, for the section's record.
                t.diagnostic('upgrade census before ' + JSON.stringify(before) + ' after ' + JSON.stringify(after));
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
        const dropV6 = sql([
            "IF DB_ID(N'" + dbName + "_v6') IS NOT NULL",
            'BEGIN',
            '  ALTER DATABASE [' + dbName + '_v6] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;',
            '  DROP DATABASE [' + dbName + '_v6];',
            'END',
            "SELECT 'kittest-dropped=' + CASE WHEN DB_ID(N'" + dbName + "_v6') IS NULL THEN 'yes' ELSE 'no' END;"
        ].join('\n'), 'master');
        if (dropV6.status !== 0 || !(dropV6.tags.dropped || []).includes('yes')) problems.push('database ' + dbName + '_v6 was not dropped: ' + dropV6.stdout + dropV6.stderr);
        const createdLogins = preExisting === null ? [] : serverLogins().filter((l) => !preExisting.includes(l));
        for (const login of createdLogins) {
            const res = sql("IF EXISTS (SELECT NULL FROM sys.server_principals WHERE [name] = N'" + login + "') DROP LOGIN [" + login + '];', 'master');
            if (res.status !== 0) problems.push('login ' + login + ' was not dropped: ' + res.stdout + res.stderr);
        }
        rmDir(root);
        assert.deepStrictEqual(problems, [], 'teardown left state on ' + SERVER);
    }
});
