// memory-database: the kit memory store's client for the shared SQL Server
// index on the host, and the local spool that stands in for it when the host
// is not there.
//
// Five properties shape everything here.
//
// The host is optional and its absence is ordinary. A machine with no client
// config runs exactly as the kit ran before this file existed: nothing is
// spawned, no socket is opened, and no spool line is written. Every entry
// point answers absence with a typed result naming the reason, and nothing
// here throws that condition at a caller.
//
// The markdown store stays the record. This module publishes a derived copy
// and never reads one back into a file: the tiers, the usage sidecars and the
// outcome journal are written exactly as they were, whether the database call
// succeeded or failed. A stamp's database write is additive, so a lost one
// costs a row on the host and never a line in usage.jsonl.
//
// The transport is sqlcmd over a batch file, not a driver. The kit core ships
// no dependencies, the client tools are on every sandbox, and the calls are
// few and batched. The password reaches the child through SQLCMDPASSWORD and
// never through an argument, because a command line is readable from the
// process list; the payload reaches it through a file, because a JSON document
// carrying record bodies has no business in a shell word.
//
// The connection principal is execute-only. Every call is a procedure call,
// every procedure resolves the caller's sandbox from its own login, and this
// client never states a sandbox, a visibility or a tenancy rule of its own.
//
// Node core modules only, CommonJS, zero dependencies, UTF-8 throughout.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const endpoint = require('./kit-endpoint-lib.js');

// memq and memory-index are resolved at the first call rather than at load,
// because memq loads this module and both of them load memq. A require taken
// while memq is still evaluating answers with the half-built exports object
// memq has filled so far, which is empty: memq assigns module.exports as its
// last statement. Binding that object would leave every call below reading
// undefined. Nothing here runs before the process's first memq call returns, by
// which point memq's exports are whole, so the accessors always answer the
// finished module. kit-endpoint-lib above loads node built-ins and nothing
// else, so it takes no part in the cycle and is bound outright.
let memqModule = null;
let indexModule = null;

function memqLib() {
    if (memqModule === null) memqModule = require('./memq.js');
    return memqModule;
}

function indexLib() {
    if (indexModule === null) indexModule = require('./memory-index.js');
    return indexModule;
}

// The client config, hand-authored per machine beside kit-endpoint.json. It
// carries a password, so it is read from the home directory rather than from
// the store root override: a store redirected for data must not move which
// credentials a publish presents.
const CONFIG_FILE = 'kit-memory-db.json';

// The spool and its lock, at the store root. The sync repository's allowlist
// re-includes only paths inside the memory tiers and the machine coordinator
// directory, so a root-level file cannot be staged: a spool holding this
// machine's undelivered stamps is per-machine state and syncing it would
// publish one machine's pending journal to every other.
const SPOOL_FILE = 'kit-memory-db-spool.jsonl';
const SPOOL_LOCK_FILE = 'kit-memory-db-spool.lock';

// Where the fleet installs the SQL client tools, tried ahead of PATH for the
// reason the host probe states: resolving by name alone hands the login's
// password to whatever sqlcmd sits earliest in the list, and a user-writable
// directory ahead of the real one is the ordinary way that becomes someone
// else's process.
const PINNED_SQLCMD = path.join('Microsoft SQL Server', 'Client SDK', 'ODBC', '170', 'Tools', 'Binn', 'SQLCMD.EXE');

// The budget one boundary call may spend, and the range a configured
// timeoutMs is accepted in. Outside that range the configured value is ignored
// and the default stands, the host probe's rule: a typo in one optional key is
// no reason to stand a working host down.
const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 600000;

// The least a boundary call can cost, the host probe's two constants. sqlcmd
// keeps a login clock and a query clock one after the other and neither goes
// below a whole second, so a spawn's floor is two seconds; one HTTP call's is
// one. They bound how far a call started on the last of a budget overshoots
// it, and they are never a bar on starting one.
const SQLCMD_FLOOR_MS = 2000;
const EMBEDDING_FLOOR_MS = 1000;

// A database name this client hands to sqlcmd's -d argument, the probe's own
// pattern. The value is the operator's and it names a database on a command
// line, so it is a plain identifier or the run stands down. Nothing else in
// this module crosses into T-SQL text: every parameter is a declared variable
// filled from an escaped literal.
const DATABASE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

// Records in one usp_UpsertRecords call. A record payload carries a whole
// memory body, where an embedding payload carries a vector, so this is its own
// number rather than the embedder's batch: fifty bodies at this store's sizes
// is a payload of a few hundred kilobytes, which one batch file and one
// OPENJSON pass take comfortably.
const RECORD_BATCH = 50;

// Characters of body per chunk, and the ceiling no chunk may exceed.
//
// The spec states the chunk target in tokens and the kit ships no tokenizer.
// The ratio comes from this exact model's own refusal, which counted a
// 16132-character input as 3926 tokens: 4.11 characters per token. At four
// characters per token the 512 to 1024 token target is 2048 to 4096
// characters, and the refusal ceiling below sits at about 1500 tokens, well
// short of the embedding server's 2048-token batch width. A chunk that cannot
// be split under the ceiling is refused here rather than sent, because the
// server's refusal of an oversized input is what the chunker's contract rests
// on and a client that leaned on it would be reporting the server's error as
// its own answer.
const CHUNK_TARGET_CHARS = 4096;
const CHUNK_MIN_CHARS = 2048;
const CHUNK_MAX_CHARS = 6144;

// --------------------------------------------------------------- the config --

function configPath() {
    return path.join(os.homedir(), '.claude', CONFIG_FILE);
}

function spoolPath() {
    return path.join(memqLib().memoryRoot(), SPOOL_FILE);
}

function spoolLockPath() {
    return path.join(memqLib().memoryRoot(), SPOOL_LOCK_FILE);
}

function errText(err) {
    const code = err && typeof err.code === 'string' ? err.code : '';
    if (code !== '') return code;
    return memqLib().sanitize(err && err.message ? String(err.message) : String(err), 200);
}

// The client config, or a described refusal. The refusal reasons are
// kit-endpoint-lib's, because a caller stands down on all of them alike and
// the two config files are read for the same kind of thing:
//
//   absent      no file at that path: no database on this machine
//   unreadable  the file is there and could not be read
//   malformed   not JSON, or JSON that is not an object
//   invalid     an object missing or mis-typing a key a caller needs
//
// PASSWORDS NEVER LEAVE THIS OBJECT. No refusal detail, no log line and no
// error text below quotes the password field, and the only place its value is
// spelled is the child environment of a sqlcmd spawn.
//
// `windowsAuth` and `trustServerCertificate` are optional and both default to
// false. The first is what lets a machine's own local instance answer, since
// every sandbox's local SQL Server runs Windows-only authentication, and it is
// the one shape where login and password are not required. The second is the
// installer's own flag, needed for an instance whose certificate this machine
// does not trust; it is absent from a fleet config, whose whole point is that
// the host's certificate validates.
function loadConfig(file) {
    const target = (typeof file === 'string' && file !== '') ? file : configPath();
    let raw = '';
    try {
        raw = fs.readFileSync(target, 'utf8');
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        if (code === 'ENOENT') return { ok: false, reason: 'absent', path: target };
        return { ok: false, reason: 'unreadable', path: target, detail: code || 'read failed' };
    }

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, reason: 'malformed', path: target, detail: 'not JSON' };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, reason: 'malformed', path: target, detail: 'not a JSON object' };
    }

    const text = (v) => (typeof v === 'string' ? v.trim() : '');
    const windowsAuth = parsed.windowsAuth === true;
    const server = text(parsed.server);
    const database = text(parsed.database);
    const login = text(parsed.login);
    const password = typeof parsed.password === 'string' ? parsed.password : '';
    const embedding = (parsed.embedding !== null && typeof parsed.embedding === 'object')
        ? parsed.embedding : {};
    const url = text(embedding.url).replace(/\/+$/, '');
    const model = text(embedding.model);

    const missing = [];
    if (server === '') missing.push('server');
    if (database === '') missing.push('database');
    if (!windowsAuth && login === '') missing.push('login');
    if (!windowsAuth && password === '') missing.push('password');
    if (url === '') missing.push('embedding.url');
    if (model === '') missing.push('embedding.model');
    if (missing.length > 0) {
        return { ok: false, reason: 'invalid', path: target, detail: missing.join(', ') + ' missing or empty' };
    }
    if (!/^https?:\/\/[^\s/]+/.test(url)) {
        return { ok: false, reason: 'invalid', path: target, detail: 'embedding.url must be an http or https address' };
    }
    if (!DATABASE_NAME_RE.test(database)) {
        return {
            ok: false,
            reason: 'invalid',
            path: target,
            detail: 'database is not a plain identifier, so ' + memqLib().sanitize(database, 64)
                + ' is never handed to the client tool'
        };
    }

    let timeoutMs = DEFAULT_TIMEOUT_MS;
    const configured = Number(parsed.timeoutMs);
    if (parsed.timeoutMs !== undefined && Number.isFinite(configured)
        && configured >= MIN_TIMEOUT_MS && configured <= MAX_TIMEOUT_MS) {
        timeoutMs = Math.floor(configured);
    }

    return {
        ok: true,
        path: target,
        config: {
            server, database, login, password, timeoutMs, windowsAuth,
            trustServerCertificate: parsed.trustServerCertificate === true,
            embedding: { url, model }
        }
    };
}

// The model identity every embedding row is written under and every unembedded
// question is asked about. One function, called by both legs of a publish, so
// the string the list was filtered by and the string the vectors are stored
// under cannot be two different strings: a mismatch there would leave every
// record reading as unembedded forever and re-embed the whole store on every
// run.
function modelIdentity(config) {
    return config.embedding.model;
}

// ------------------------------------------------------------ the transport --

// Where sqlcmd is, or null where the pinned client tools are not installed.
//
// There is no bare-name fallback. Resolving by name searches PATH, which hands
// the login's password to whatever sqlcmd sits earliest in that list, and a
// user-writable directory ahead of the real one is the ordinary way that
// becomes someone else's process. A machine without the client tools publishes
// nothing and says so, which is the same answer it gives for an absent config.
//
// Both candidates are absolute and fixed. The environment's own ProgramFiles
// is tried first because a machine may hold its program files off the C drive,
// and the literal path is tried after it so a cleared or redirected
// ProgramFiles cannot steer the resolution on an ordinary machine.
function sqlcmdPath() {
    const bases = [];
    if (typeof process.env.ProgramFiles === 'string' && process.env.ProgramFiles !== '') {
        bases.push(process.env.ProgramFiles);
    }
    if (!bases.includes('C:\\Program Files')) bases.push('C:\\Program Files');
    for (const base of bases) {
        if (!path.isAbsolute(base)) continue;
        const pinned = path.join(base, PINNED_SQLCMD);
        try {
            if (fs.statSync(pinned).isFile()) return pinned;
        } catch { /* not installed there: try the next fixed candidate */ }
    }
    return null;
}

// The child's whole environment: an allowlist, built rather than copied.
//
// sqlcmd reads its own behaviour out of a dozen SQLCMD* variables, one of them
// SQLCMDINI, which names a startup script the tool runs before the batch. A
// copy of this process's environment carries every one of them into a child
// that holds the login's password, and a repository-committed terminal
// environment is inside this project's threat model. So the child gets the
// variables a process needs to run at all plus the one secret it is being
// given, and no SQLCMD* name reaches it except SQLCMDPASSWORD.
//
// The -X flag is deliberately not passed beside this. The tool's own banner
// reads "disable commands, startup script, environment variables", and taking
// the environment variables away takes SQLCMDPASSWORD with them, which makes a
// SQL-authenticated login fail and the tool prompt for a password instead.
// This allowlist answers the same threat at its source: a variable that never
// reaches the child steers nothing. The tool's file and shell directives
// (:r, :!!) are out of reach for a different reason, which is authorship: every
// line of every batch is written by payloadLiteral or the fixed text around it,
// and no line of a payload can begin with a colon because each is prefixed with
// a SET statement.
const CHILD_ENV_ALLOWED = [
    'SystemRoot', 'windir', 'PATH', 'Path', 'PATHEXT', 'COMSPEC', 'ComSpec',
    'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
    'SystemDrive', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData',
    'APPDATA', 'LOCALAPPDATA', 'COMPUTERNAME', 'USERDOMAIN', 'USERNAME',
    'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'LANG', 'LC_ALL', 'TZ'
];
function childEnvironment(config) {
    const allowed = new Set(CHILD_ENV_ALLOWED.map((name) => name.toLowerCase()));
    const env = {};
    for (const [name, value] of Object.entries(process.env)) {
        if (allowed.has(name.toLowerCase())) env[name] = value;
    }
    // The password reaches the child here and nowhere else, so the value lives
    // in one object that goes out of scope with the call. Under Windows
    // authentication the child is given none at all: a secret it has no use
    // for is not handed to it.
    if (!config.windowsAuth) env.SQLCMDPASSWORD = config.password;
    return env;
}

// Batch files this module left behind on an earlier run. A batch carries
// private record bodies, so one orphaned by a kill between the spawn and the
// unlink is data at rest in a directory every account on the machine can read.
// Only this module's own name shape is touched, and only past an age no live
// call can reach: the longest a call may run is the largest configured timeout
// plus the spawn's declared overshoot, so a file older than that is owned by
// nobody.
const STALE_BATCH_MS = MAX_TIMEOUT_MS + SQLCMD_FLOOR_MS;
function sweepStaleBatches() {
    const dir = os.tmpdir();
    let names = [];
    try { names = fs.readdirSync(dir); } catch { return; }
    const cutoff = Date.now() - STALE_BATCH_MS;
    for (const name of names) {
        if (!/^kit-memory-db-.+\.sql$/.test(name)) continue;
        const file = path.join(dir, name);
        try {
            if (fs.statSync(file).mtimeMs > cutoff) continue;
            fs.unlinkSync(file);
        } catch { /* another process owns it or already took it */ }
    }
}

// Whole seconds for each of the two clocks a sqlcmd spawn keeps, out of one
// budget, the host probe's arithmetic. The share is divided down rather than
// rounded, since rounding to nearest hands the clocks more time than the
// budget funds, and it is lifted to the tool's own floor where dividing down
// leaves less, which is the one place a call runs past its budget.
function clockSeconds(budgetMs) {
    if (!(budgetMs > 0)) return 0;
    const floorSeconds = Math.floor(SQLCMD_FLOOR_MS / 2000);
    return Math.max(floorSeconds, Math.floor(budgetMs / 2000));
}

// A batch's payload as T-SQL that cannot be read as anything but text.
//
// Three hazards, and the encoding answers all three at once. A record body can
// carry a line that is exactly `GO`, which sqlcmd reads as a batch separator
// wherever it appears, string literal or not. It can carry a $(NAME) reference,
// which sqlcmd substitutes (the spawn passes -x, and this is the belt beside
// it). And it can carry any character at all, which makes the batch file's
// encoding a question. So the JSON is escaped to pure ASCII, its quotes are
// doubled, and it is appended in bounded pieces: an ASCII payload needs no
// encoding negotiation with the tool, a piece of two thousand characters is
// never a line reading as GO, and the server's own JSON parser turns the
// \uXXXX escapes back into the characters they name.
function payloadLiteral(variable, value) {
    const json = JSON.stringify(value).replace(/[^\x20-\x7E]/g, (ch) => {
        return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    });
    const lines = [';DECLARE ' + variable + ' NVARCHAR(MAX) = N\'\''];
    for (let at = 0; at < json.length; at += 2000) {
        lines.push(';SET ' + variable + ' = ' + variable + ' + N\''
            + json.slice(at, at + 2000).replace(/'/g, "''") + '\'');
    }
    return lines.join('\n');
}

// A scalar string parameter as a literal, or null where the value is not one
// this module will write into a batch.
//
// The escape the payload above uses is unavailable here: \uXXXX means
// something to the server's JSON parser and nothing to its string literals, so
// a scalar's own characters are what reach the batch. The screen is therefore
// the guard rather than the escaping, and it is narrow because the only scalar
// any call passes is the embedding model's identity out of the config.
function textLiteral(variable, value) {
    if (typeof value !== 'string' || value === '' || value.length > 200) return null;
    if (!/^[\x20-\x7E]+$/.test(value) || value.includes("'")) return null;
    return ';DECLARE ' + variable + ' NVARCHAR(200) = N\'' + value + '\'';
}

// The tag a result line carries. Every answer is found by its tag rather than
// by its position, the host probe's rule: the captured stream merges stdout and
// stderr, so a server notice ahead of a result set shifts every index by one.
const RESULT_TAG = 'kitdb-json=';

// One sqlcmd run over a batch this module wrote, as {ok, rows, detail}.
//
// The spawn is the host probe's, with three differences the payload forces.
// -y 0 replaces -h -1 and -W, because the tool refuses those flags beside it
// and without it a JSON answer past the default display width is cut silently,
// which is an answer that parses and is wrong. The batch file is written as
// pure ASCII, so the tool's encoding detection has nothing to get wrong. And
// the caller's own clock bounds the spawn on top of sqlcmd's two, because the
// stamp path's budget is shorter than the one second sqlcmd's flags can
// express.
//
// It never throws. Every failure is {ok: false} with a bounded detail, because
// every caller here answers a failed call by writing the file-side record it
// was going to write anyway.
function runBatch(config, batch, options) {
    const opts = options || {};
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : DEFAULT_TIMEOUT_MS;
    // The hard kill, which is the caller's own clock rather than sqlcmd's. Its
    // default is the budget plus the spawn's floor, the declared overshoot a
    // call started on the last of its budget is allowed; a caller on the
    // interactive path passes its own, shorter, because a stamp's fallback is
    // lossless and a session's wait is not.
    const killMs = Number.isFinite(opts.killMs) ? opts.killMs : budgetMs + SQLCMD_FLOOR_MS;
    const tool = sqlcmdPath();
    if (tool === null) {
        return {
            ok: false,
            detail: 'the SQL client tools are not installed at ' + PINNED_SQLCMD
                + ', and this client resolves no other path for them'
        };
    }
    const seconds = clockSeconds(budgetMs);
    if (seconds < 1) return { ok: false, detail: 'the budget was spent before this spawn, so none was made' };

    sweepStaleBatches();
    const file = path.join(os.tmpdir(), 'kit-memory-db-' + process.pid + '-' + crypto.randomUUID() + '.sql');
    const args = ['-S', config.server, '-d', config.database, '-b', '-I', '-N', '-x', '-y', '0',
        '-l', String(seconds), '-t', String(seconds), '-i', file];
    if (config.windowsAuth) args.push('-E');
    else args.push('-U', config.login);
    if (config.trustServerCertificate) args.push('-C');

    const env = childEnvironment(config);

    let res = null;
    try {
        // The batch holds whole record bodies, so it is created for this user
        // alone rather than with the temp directory's default mode.
        fs.writeFileSync(file, batch + '\n', { encoding: 'utf8', mode: 0o600 });
        res = spawnSync(tool, args, {
            encoding: 'utf8',
            env,
            timeout: killMs,
            windowsHide: true,
            maxBuffer: 64 * 1024 * 1024
        });
    } catch (err) {
        return { ok: false, detail: 'could not run sqlcmd: ' + errText(err) };
    } finally {
        try { fs.unlinkSync(file); } catch { /* a leftover batch file is inert */ }
    }

    const output = (res.stdout || '') + (res.stderr || '');
    if (res.error) return { ok: false, detail: 'could not run sqlcmd: ' + errText(res.error) };
    if (res.status !== 0) {
        // sqlcmd's own words are the one thing that tells a certificate
        // refusal from a closed port from a procedure that threw, and they
        // come off a channel this process does not author, so they are
        // bounded and stripped before they reach a line anyone reads.
        return {
            ok: false,
            detail: 'sqlcmd exited ' + (res.status === null ? 'on its caller\'s clock' : res.status)
                + ': ' + memqLib().sanitize(output.replace(/\s+/g, ' '), 300)
        };
    }
    const rows = [];
    for (const line of output.split(/\r?\n/)) {
        const text = line.trimEnd();
        if (!text.startsWith(RESULT_TAG)) continue;
        try {
            rows.push(JSON.parse(text.slice(RESULT_TAG.length)));
        } catch {
            return { ok: false, detail: 'a result line was not JSON, so the answer could not be read' };
        }
    }
    return { ok: true, rows };
}

// One procedure call whose parameters are JSON payloads, as {ok, rows, detail}.
//
// Every parameter is a payload literal, so nothing a caller passes is ever
// concatenated into the EXEC line: the argument list names variables and the
// values arrive through the declarations above it. No value from the config
// reaches the batch text at all: the database name rides sqlcmd's own -d
// argument, and it is held to a plain identifier at the config read because it
// names a database on a command line.
function callProcedure(config, procedure, parameters, options) {
    const opts = options || {};
    const deps = opts.deps || {};
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : config.timeoutMs;
    const declarations = [];
    const argumentList = [];
    let index = 0;
    for (const [name, value] of Object.entries(parameters || {})) {
        index += 1;
        const variable = '@v' + index;
        if (typeof value === 'string') {
            const literal = textLiteral(variable, value);
            if (literal === null) {
                return { ok: false, detail: name + ' is not a value this client writes into a batch' };
            }
            declarations.push(literal);
        } else {
            declarations.push(payloadLiteral(variable, value));
        }
        argumentList.push(name + ' = ' + variable);
    }
    const batch = [
        ';SET NOCOUNT ON',
        ...declarations,
        ';DECLARE @Answer TABLE ( [Json] NVARCHAR(MAX) NULL )',
        ';INSERT INTO @Answer ( [Json] ) EXEC mem.' + procedure
            + (argumentList.length > 0 ? ' ' + argumentList.join(', ') : ''),
        ";SELECT '" + RESULT_TAG + "' + COALESCE([Json], 'null') FROM @Answer"
    ].join('\n');
    const run = deps.runBatch || runBatch;
    return run(config, batch, { budgetMs, killMs: opts.killMs, procedure });
}

// ------------------------------------------------------- the embedding call --

// One batch of texts embedded on the host, as {ok, vectors, detail}.
//
// The request shape, the abort clock, the bounded body read and the failure
// classification are kit-endpoint-lib's, which is the module that owns this
// boundary: the kit speaks one OpenAI dialect to one host, and a second
// hand-rolled client would be a second set of answers to a slow socket, an
// unread body and a hostile error string.
async function embedBatch(config, texts, options) {
    const opts = options || {};
    const deps = opts.deps || {};
    const fetchImpl = (typeof deps.fetchImpl === 'function') ? deps.fetchImpl : fetch;
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); },
        endpoint.abortDelay(Math.max(budgetMs, EMBEDDING_FLOOR_MS)));
    let res = null;
    try {
        res = await fetchImpl(config.embedding.url + '/v1/embeddings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: config.embedding.model, input: texts }),
            signal: controller.signal
        });
    } catch (err) {
        clearTimeout(timer);
        return { ok: false, detail: endpoint.classifyThrow(err).detail };
    }
    try {
        if (!res || typeof res.status !== 'number') return { ok: false, detail: 'no response object' };
        if (res.status < 200 || res.status >= 300) {
            await endpoint.discardBody(res);
            return { ok: false, detail: 'HTTP ' + res.status + ' from the embedding server' };
        }
        const read = await endpoint.readBoundedBody(res);
        if (!read.ok) return { ok: false, detail: read.detail || 'the response body could not be read' };
        const body = read.body;
        const data = (body !== null && typeof body === 'object' && Array.isArray(body.data)) ? body.data : null;
        if (data === null || data.length !== texts.length) {
            return { ok: false, detail: 'the server answered ' + (data === null ? 'no data array' : data.length + ' vectors')
                + ' for ' + texts.length + ' text(s)' };
        }
        const vectors = [];
        for (const entry of data) {
            const vector = (entry !== null && typeof entry === 'object') ? entry.embedding : null;
            if (!Array.isArray(vector) || vector.length === 0 || !vector.every((n) => Number.isFinite(n))) {
                return { ok: false, detail: 'the server answered something that is not a vector' };
            }
            vectors.push(vector);
        }
        return { ok: true, vectors };
    } catch (err) {
        return { ok: false, detail: endpoint.classifyThrow(err).detail };
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------- chunking --

// A body as ordered chunks, each {text, offset, length}, or a refusal.
//
// Paragraphs are the split, because a paragraph is where a memory changes
// subject and a chunk that spans two subjects matches both weakly. Paragraphs
// accumulate until the target is reached; one paragraph longer than the
// ceiling is split at line boundaries and then, if a single line is still over,
// at the ceiling itself, since a body with no break at all is still a body
// worth finding. Every offset is into the body as it stands, so a chunk's own
// text can be located in the record a reader opens.
// Where a hard cut at `to` may actually land. Two properties, in order: the
// cut never falls between the halves of a surrogate pair, and it prefers the
// last whitespace in a short window before the target.
//
// The first is a correctness bar rather than a nicety. A JavaScript string
// index addresses UTF-16 code units, so a cut through an astral character
// (an emoji, most CJK extension characters) leaves a lone surrogate, which
// JSON.stringify writes as an unpaired \uD8xx escape and the embedding
// server's JSON parser rejects. Such a record would then fail to embed on
// every run for as long as it stood. The second keeps a cut off the middle of
// a word where a break is cheaply available. Progress is guaranteed: nothing
// here can return a position at or before `from`.
const CUT_BACKOFF_CHARS = 64;
function safeCut(text, from, to) {
    if (to >= text.length) return text.length;
    let cut = to;
    const floor = from + 1;
    for (let at = cut; at > cut - CUT_BACKOFF_CHARS && at > floor; at -= 1) {
        if (/\s/.test(text[at - 1])) { cut = at; break; }
    }
    // A high surrogate at the end of the piece means its pair opens the next
    // one, so the cut steps back off it.
    while (cut > floor) {
        const code = text.charCodeAt(cut - 1);
        if (code < 0xD800 || code > 0xDBFF) break;
        cut -= 1;
    }
    return cut;
}

function chunkBody(body) {
    const text = typeof body === 'string' ? body : '';
    if (text.trim() === '') return [];
    const chunks = [];
    let start = 0;
    let end = 0;
    const push = (from, to) => {
        const piece = text.slice(from, to);
        if (piece.trim() !== '') chunks.push({ text: piece, offset: from, length: piece.length });
    };
    // The paragraph walk: every separator stays with the paragraph it follows,
    // so the offsets partition the body with nothing dropped between chunks.
    const bounds = [];
    const re = /\n[ \t]*\n/g;
    let match = null;
    let at = 0;
    while ((match = re.exec(text)) !== null) {
        bounds.push({ from: at, to: match.index + match[0].length });
        at = match.index + match[0].length;
    }
    bounds.push({ from: at, to: text.length });

    for (const bound of bounds) {
        if (bound.to <= bound.from) continue;
        const size = bound.to - bound.from;
        if (size > CHUNK_MAX_CHARS) {
            if (end > start) { push(start, end); start = end; }
            let cut = bound.from;
            while (cut < bound.to) {
                const next = safeCut(text, cut, Math.min(cut + CHUNK_TARGET_CHARS, bound.to));
                push(cut, next);
                cut = next;
            }
            start = bound.to;
            end = bound.to;
            continue;
        }
        // Two reasons to close the chunk in hand before this paragraph joins
        // it: it has reached the target and is past the floor, or the join
        // would put it over the ceiling. The second is not the first with a
        // bigger number, and without it a short chunk meeting a long paragraph
        // produces one the embedding server would refuse.
        if (end > start && (((end - start) + size > CHUNK_TARGET_CHARS && (end - start) >= CHUNK_MIN_CHARS)
            || (end - start) + size > CHUNK_MAX_CHARS)) {
            push(start, end);
            start = end;
        }
        end = bound.to;
        if (end - start >= CHUNK_TARGET_CHARS) {
            push(start, end);
            start = end;
        }
    }
    if (end > start) push(start, end);
    return chunks;
}

// ----------------------------------------------------------------- the spool --

// One line per stamp or outcome the database could not take, in the shapes
// mem.usp_AppendUsage and mem.usp_AppendOutcomes read, with a `type` field
// saying which. Appended with one O_APPEND write, the same posture the usage
// sidecar takes: a bounded single-line append is safe for concurrent writers by
// construction and the file is never read back to be rewritten except under the
// drain's lock.
//
// It never throws and never speaks: every caller has already written the
// file-side record, so a lost spool line costs a row on the host and nothing
// else. A failed append answers false, which is what the caller reports.
function appendSpool(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return true;
    try {
        const target = spoolPath();
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
        return true;
    } catch {
        return false;
    }
}

// The spool as {bytes, usage, outcomes, malformed, lines}, or {error}.
//
// The file is read as bytes and split on the newline byte, never decoded and
// measured afterwards. A decode replaces every invalid sequence with U+FFFD,
// whose UTF-8 form is three bytes wherever the original was one or two, so a
// byte count taken from the decoded text does not address the file: a torn
// append or a disk-full leaves a prefix length that cuts the next drain
// mid-line. `bytes` is therefore the byte offset just past the last line this
// read consumed whole, which is what the drain removes.
//
// A trailing piece with no newline is a line still being written, so it is
// left where it is and counted as neither delivered nor malformed. Each kept
// line carries its own bytes, because a partial drain rewrites the file from
// exactly the lines that were not delivered.
function readSpool() {
    let raw = null;
    try {
        raw = fs.readFileSync(spoolPath());
    } catch (err) {
        const code = err && err.code;
        if (code === 'ENOENT') return { bytes: 0, usage: [], outcomes: [], malformed: 0, lines: [] };
        return { error: errText(err) };
    }
    const out = { bytes: 0, usage: [], outcomes: [], malformed: 0, lines: [] };
    let at = 0;
    for (;;) {
        const nl = raw.indexOf(0x0A, at);
        if (nl === -1) break;
        const bytes = raw.subarray(at, nl + 1);
        at = nl + 1;
        out.bytes = at;
        const line = bytes.toString('utf8');
        if (line.trim() === '') continue;
        let parsed = null;
        try { parsed = JSON.parse(line); } catch { out.malformed += 1; continue; }
        if (parsed === null || typeof parsed !== 'object') { out.malformed += 1; continue; }
        const { type, ...entry } = parsed;
        if (type === 'usage') { out.usage.push(entry); out.lines.push({ type, bytes }); }
        else if (type === 'outcome') { out.outcomes.push(entry); out.lines.push({ type, bytes }); }
        else out.malformed += 1;
    }
    return out;
}

// Send the spool to the host and remove exactly what was sent.
//
// The lock is the store's own exclusive-create lock, held across the read, the
// calls and the rewrite, so two publishers cannot send the same lines twice.
// Appenders do not take it, because a stamp on the interactive path must never
// wait on a publish, which is why the drain rewrites from a byte prefix rather
// than truncating: a line appended while the calls were in flight is still in
// the file afterwards and drains next time.
//
// The two procedures are two deliveries, and the file records which of them
// landed. When the usage rows are taken and the outcome call then fails, the
// file is rewritten with the outcome lines alone: both procedures are plain
// inserts with no dedupe, so leaving the file whole would send every usage row
// a second time on the next drain and put a second read-stamp row on the host
// for a memory read once. A line nothing took is never removed, since a stamp
// delivered nowhere and deleted anyway is the loss this whole mechanism exists
// to prevent.
//
// A malformed line is dropped on the rewrite and counted in `malformed`, which
// the caller carries to its summary: a line no procedure can read is delivered
// by no future drain, and a silent drop is how a torn append disappears with
// nobody the wiser.
function drainSpool(config, options) {
    const opts = options || {};
    const lock = memqLib().acquireLock(spoolLockPath());
    if (!lock.ok) {
        // Contention is its own answer. Another publisher holding this lock is
        // a healthy host and a busy machine, which is nothing like a host that
        // did not answer, and a caller told the second about the first stands
        // its whole run down for a condition that resolves itself.
        const contended = typeof lock.reason === 'string' && lock.reason.startsWith('lock held');
        return {
            ok: false,
            contended,
            drained: 0,
            malformed: 0,
            detail: contended ? 'another publisher holds the spool lock, so it was left for that run'
                : lock.reason
        };
    }
    try {
        const spool = readSpool();
        if (spool.error !== undefined) return { ok: false, contended: false, drained: 0, malformed: 0, detail: spool.error };
        const total = spool.usage.length + spool.outcomes.length;
        if (total === 0 && spool.malformed === 0) return { ok: true, drained: 0, malformed: 0 };

        const delivered = new Set();
        let refusal = null;
        if (spool.usage.length > 0) {
            const sent = callProcedure(config, 'usp_AppendUsage', { '@p_Usage': spool.usage }, opts);
            if (sent.ok) delivered.add('usage');
            else refusal = sent.detail;
        }
        if (refusal === null && spool.outcomes.length > 0) {
            const sent = callProcedure(config, 'usp_AppendOutcomes', { '@p_Outcomes': spool.outcomes }, opts);
            if (sent.ok) delivered.add('outcome');
            else refusal = sent.detail;
        }
        const drained = (delivered.has('usage') ? spool.usage.length : 0)
            + (delivered.has('outcome') ? spool.outcomes.length : 0);
        if (delivered.size === 0) {
            return { ok: false, contended: false, drained: 0, malformed: 0, detail: refusal };
        }

        const kept = spool.lines.filter((line) => !delivered.has(line.type)).map((line) => line.bytes);
        try {
            const raw = fs.readFileSync(spoolPath());
            const rest = raw.subarray(Math.min(spool.bytes, raw.length));
            const next = Buffer.concat(kept.concat([rest]));
            if (next.length === 0) fs.unlinkSync(spoolPath());
            else fs.writeFileSync(spoolPath(), next);
        } catch (err) {
            // The lines are on the host and the file still holds them, so the
            // next drain sends them again. A duplicate stamp is a second row
            // saying a memory was read, which the decay pass reads as one more
            // sign of life; a lost one is evidence nobody can recover.
            return {
                ok: refusal === null,
                contended: false,
                drained,
                malformed: spool.malformed,
                detail: 'the spool was delivered and could not be cleared: ' + errText(err)
            };
        }
        if (refusal !== null) {
            return { ok: false, contended: false, drained, malformed: spool.malformed, detail: refusal };
        }
        return { ok: true, drained, malformed: spool.malformed };
    } finally {
        lock.release();
    }
}

// ------------------------------------------------------- the stamp writers --

// Take one usage stamp or outcome for the shared index, which on the
// interactive path means writing it to the spool.
//
// THE FILE-SIDE WRITE IS THE CALLER'S AND HAPPENS WHATEVER THIS ANSWERS. This
// is called after usage.jsonl or outcomes.jsonl already holds the line, so the
// local record is complete on every path through here.
//
// With no config there is no host on this machine: nothing is written, since a
// spool that filled on a machine with no database would grow without bound and
// drain nowhere.
//
// NO DATABASE CALL IS MADE HERE, AND THAT IS THE POINT. A stamp is worth a few
// hundred milliseconds of a session's time and no more, and a few hundred
// milliseconds does not fund a cold sqlcmd start plus a TLS negotiation plus a
// login: on a healthy host that attempt is killed on nearly every stamp and the
// line goes to the spool regardless, having first spent the session's time.
// Worse, a kill landing after the server committed the row and before its
// answer was read spools a row the host already holds, which the next drain
// sends again, and both append procedures are plain inserts with no dedupe. So
// every interactive stamp is spooled and `memq db-sync` delivers it in one
// batched call, which is the same journey with the latency and the duplicate
// both removed. A stamp's whole worth here is that it is not lost, and the
// spool is what makes it not lost.
function deliver(entry, options) {
    const opts = options || {};
    const loaded = opts.config ? { ok: true, config: opts.config } : loadConfig(opts.configPath);
    if (!loaded.ok) return { delivered: false, spooled: false, reason: loaded.reason };
    return { delivered: false, spooled: appendSpool([entry]), reason: 'spooled' };
}

// The identity a usage stamp names its record by: the store's own tier, the
// segment that tier is keyed by, and the file key the sidecar records. It is
// the identity form mem.usp_AppendUsage accepts beside a record id, which is
// what lets a stamp reach the host before the record has ever been published,
// where it is rejected and counted rather than written.
function usageEntry(tier, segment, name, fileKey, kind) {
    return {
        type: 'usage',
        tier,
        segment: segment === undefined ? null : segment,
        name,
        fileKey,
        kind,
        at: new Date().toISOString(),
        sessionId: null
    };
}

// One journal entry as the row mem.usp_AppendOutcomes reads. The journal is
// project-tier only, so the store is named by its segment alone and no tier
// word rides along. The entry's own fields are passed through as the journal
// holds them, already bounded by memq's write-time caps, so the host's copy and
// the file's copy carry the same text.
function outcomeEntry(segment, entry) {
    return {
        type: 'outcome',
        segment,
        actionKey: entry.key,
        result: entry.outcome,
        summary: entry.summary,
        detail: entry.detail === undefined ? null : entry.detail,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        at: entry.ts
    };
}

// The tier and segment of a tier directory, or null where the path is not one
// of the store's three tiers. memq owns both answers, so a stamp writer states
// neither: tierNameFor decides the tier and the directory's own name is the
// segment the store keys that tier by.
function tierIdentity(tierDir) {
    const tier = memqLib().tierNameFor(tierDir);
    if (tier === null) return null;
    if (tier === 'operator') return { tier, segment: null };
    if (tier === 'type') return { tier, segment: path.basename(tierDir) };
    return { tier, segment: path.basename(path.dirname(tierDir)) };
}

// ---------------------------------------------------------------- the walk --

// Every record the walk found, as the rows mem.usp_UpsertRecords reads.
//
// The walk, the tier tokens and the body hash are memory-index's, the same
// three the local semantic sweep uses, so the two derived copies of this store
// are built from one reading of it. The fields beyond the body come from the
// record's own frontmatter through memq's readers, so what counts as a tag, a
// machine or a supersedes pointer is the store's answer rather than this
// file's.
// A live record and its archived namesake key alike: both carry one tier word
// once the archive token is stripped, one segment and one file key, which is
// the store row's own unique key. The store permits both files to exist, so
// the collision is reachable, and sending both would make the row's archived
// flag and its body flip on every run and drop its embeddings each time. The
// pair is therefore named on `failed` and neither half is sent, since neither
// is more the record than the other and picking one silently would hide a
// state the operator has to resolve in the store itself.
function collectRecords() {
    describedDirectories.clear();
    const walk = indexLib().walkStore();
    const failed = walk.failed.slice();
    const records = [];
    const duplicateKeys = new Set();
    for (const entry of walk.records) {
        const archived = indexLib().isArchivedTier(entry.tier);
        const tier = archived ? entry.tier.replace('-archive', '') : entry.tier;
        const segment = tier === 'operator' ? null : entry.store;
        const file = entry.file;
        let body = '';
        let mtime = null;
        try {
            mtime = fs.statSync(file).mtimeMs;
            body = fs.readFileSync(file, 'utf8');
        } catch (err) {
            failed.push({ store: entry.store, tier: entry.tier, name: entry.name, reason: errText(err) });
            continue;
        }
        const fileKey = memqLib().memoryFileKey(entry.name + '.md');
        const descriptions = describeDirectory(path.dirname(file));
        records.push({
            tier,
            segment,
            name: entry.name,
            fileKey,
            description: descriptions.get(entry.name + '.md') || '',
            body,
            bodyHash: indexLib().hashOf(body),
            fileModified: new Date(mtime).toISOString(),
            machine: memqLib().machineIdentityOrNull(memqLib().frontmatterValue(body, 'machine')),
            tags: memqLib().frontmatterTags(memqLib().frontmatterValue(body, 'tags')),
            supersedes: memqLib().supersedesName(memqLib().frontmatterValue(body, 'supersedes')),
            archived
        });
    }

    // The collision pass, run after the walk so the second file of a pair is
    // not treated as the change the first one made. A duplicated key is
    // reported once and both of its records are withheld, and the key is
    // handed back so the removal leg knows the host's row for it is still
    // backed by files on this machine.
    const byKey = new Map();
    for (const record of records) {
        const key = recordKey(record.tier, record.segment, record.fileKey);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(record);
    }
    for (const [key, group] of byKey) {
        if (group.length === 1) continue;
        duplicateKeys.add(key);
        failed.push({
            store: group[0].segment,
            tier: group[0].tier,
            name: group[0].name,
            reason: memqLib().sanitize(group[0].name, 80) + ' exists in the ' + group[0].tier
                + ' tier both live and archived, which is one record on the host, so neither copy '
                + 'was published; delete or rename one of them'
        });
    }
    const kept = records.filter((record) =>
        !duplicateKeys.has(recordKey(record.tier, record.segment, record.fileKey)));
    return { records: kept, failed, unscanned: walk.unscanned, duplicateKeys };
}

function recordKey(tier, segment, fileKey) {
    return tier + '\u0000' + (segment === null ? '' : segment) + '\u0000' + fileKey;
}

// One directory's index descriptions, read once per directory per run. A tier
// holds one index line per record, and a walk of several hundred records
// otherwise reads each tier's index once per record in it.
const describedDirectories = new Map();
function describeDirectory(dir) {
    if (!describedDirectories.has(dir)) describedDirectories.set(dir, memqLib().readIndexDescriptions(dir));
    return describedDirectories.get(dir);
}

// The live tier directories on this machine, as {tier, segment, dir}. The
// index-orphan pass reads each one's index lines, so it enumerates the tiers
// themselves rather than the records the walk found: a tier whose every record
// file is gone has index lines and no records, which is exactly the state the
// pass exists to report.
function tierDirectories() {
    const out = [{ tier: 'operator', segment: null, dir: memqLib().operatorDirPath() }];
    const segments = memqLib().projectSegments();
    if (segments !== null) {
        for (const segment of segments) {
            out.push({ tier: 'project', segment, dir: memqLib().projectMemoryDirFor(segment) });
        }
    }
    let types = [];
    try { types = fs.readdirSync(memqLib().typesRootPath()); } catch { types = []; }
    for (const type of types) {
        if (!memqLib().isTypeName(type)) continue;
        const dir = path.join(memqLib().typesRootPath(), type);
        try { if (!fs.statSync(dir).isDirectory()) continue; } catch { continue; }
        out.push({ tier: 'type', segment: type, dir });
    }
    return out;
}

// The index lines naming a file the tier does not hold, as the rows
// mem.usp_UpsertIndexOrphans reads.
function collectOrphans() {
    const orphans = [];
    for (const tier of tierDirectories()) {
        for (const [file, description] of describeDirectory(tier.dir)) {
            if (!memqLib().isMemoryFilename(file)) continue;
            try {
                if (fs.statSync(path.join(tier.dir, file)).isFile()) continue;
            } catch { /* no file behind the line: that is the orphan */ }
            orphans.push({
                tier: tier.tier,
                segment: tier.segment,
                name: file.slice(0, -3),
                description
            });
        }
    }
    return orphans;
}

// --------------------------------------------------------------- the publish --

function counted(rows) {
    const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return (first !== null && typeof first === 'object') ? first : {};
}

// The whole of `memq db-sync`: drain, publish, list, remove, embed, record.
//
// The order is what makes the run self-healing. The list in step three is a
// live reading of the host rather than a memory of what this machine published,
// so a run whose embedding leg died leaves records the next run sees as
// unembedded and finishes. There is no local copy of database state anywhere in
// this module, so there is nothing to drift.
//
// Every record the walk found is sent, whether its body changed or not. The
// server's `unchanged` disposition stamps the record's last-published time,
// which the thirty-day orphan rule reads, so a client that skipped hash-equal
// records would starve that stamp and every untouched shared record would list
// to the curator as an orphan.
//
// A walk that could not read some tier names nothing as removed. A removal is
// soft and lifts when the file is published again, but only if it is never
// emitted from a partial reading of the store: a tier that failed to enumerate
// is no evidence its records are gone, which is the judgment the local sweep
// takes about the same condition. A store the walk found no record at all in is
// held to the same bar, whatever the walk reported: an empty reading of a store
// the host holds rows for is the shape a mis-resolved root takes, and it is
// indistinguishable from a store whose last record was deleted, so the rows
// stay and the summary says how many were held back.
async function publish(options) {
    const opts = options || {};
    const loaded = opts.config ? { ok: true, config: opts.config, path: opts.configPath }
        : loadConfig(opts.configPath);
    if (!loaded.ok) return { ok: false, standDown: loaded.reason, detail: loaded.detail, path: loaded.path };
    const config = loaded.config;
    const deps = opts.deps || {};
    const started = new Date().toISOString();
    const summary = {
        added: 0, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0, heldBack: 0,
        embedded: 0, drained: 0, malformed: 0, orphans: 0, failed: [], partial: false
    };

    // The judged probe, spent before anything else so an unreachable host is
    // discovered in about the time the judged channel allows rather than after
    // a spool drain and a first record batch at the full configured timeout.
    // The hard kill is the module's declared overshoot rather than the probe
    // budget itself, since a kill inside the tool's own one-second floor would
    // refuse every host alive or dead.
    const probeMs = memqLib().JUDGED_PROBE_TIMEOUT_MS;
    const probe = callProcedure(config, 'usp_Health', {},
        { deps, budgetMs: probeMs, killMs: probeMs + SQLCMD_FLOOR_MS });
    if (!probe.ok) return { ok: false, standDown: 'unreachable', detail: probe.detail };

    const drain = drainSpool(config, { deps });
    if (!drain.ok && !drain.contended) return { ok: false, standDown: 'unreachable', detail: drain.detail };
    summary.drained = drain.drained;
    summary.malformed = drain.malformed || 0;
    // A drain that delivered and could not clear the file, or one another
    // publisher held the lock on, is a fact about this run rather than a
    // reason to abandon it: the walk that follows neither reads the spool nor
    // writes to it.
    if (drain.detail) summary.failed.push('the spool: ' + drain.detail);

    const walk = collectRecords();
    summary.partial = walk.failed.length > 0 || walk.unscanned.length > 0;
    for (const entry of walk.failed) summary.failed.push(entry.reason);

    // The keys of records this machine holds an older copy of than the host
    // does. The procedure answers with counts rather than identities, so what
    // is known is that some record in the batch was skipped as older, and
    // every record in that batch is withheld from the embedding leg below.
    // Embedding is the one leg that would write this machine's text against
    // the host's record: the host keeps its newer body, the reader still
    // reports the row unembedded, and vectors made here would be the older
    // text stored against the newer record, which then reads as embedded
    // forever with text no file holds. Withholding a batch costs at most one
    // round of embedding for the records that were not the older one, which
    // the next run takes up, and the sandbox whose copy is the newer one
    // embeds the record correctly in the meantime.
    const withheld = new Set();
    for (let at = 0; at < walk.records.length; at += RECORD_BATCH) {
        const batch = walk.records.slice(at, at + RECORD_BATCH);
        const sent = callProcedure(config, 'usp_UpsertRecords', { '@p_Records': batch }, { deps });
        if (!sent.ok) return { ok: false, standDown: 'unreachable', detail: sent.detail };
        const counts = counted(sent.rows);
        summary.added += Number(counts.added) || 0;
        summary.changed += Number(counts.changed) || 0;
        summary.unchanged += Number(counts.unchanged) || 0;
        const older = Number(counts.skippedOlder) || 0;
        summary.skippedOlder += older;
        if (older > 0) {
            for (const record of batch) {
                withheld.add(recordKey(record.tier, record.segment, record.fileKey));
            }
        }
    }

    const identity = modelIdentity(config);
    const listed = callProcedure(config, 'usp_ListRecords', { '@p_ModelIdentity': identity }, { deps });
    if (!listed.ok) return { ok: false, standDown: 'unreachable', detail: listed.detail };

    // The removed set: rows the host holds in this sandbox's own project
    // stores that the walk no longer found. A shared row is never named here,
    // and the procedure ignores one that is, so neither side alone decides it.
    const removed = [];
    const toEmbed = [];
    const byKey = new Map();
    // The stores the walk actually found records in. A listed row whose own
    // store is not among them is left alone: the walk read that store empty,
    // and an empty reading is what a mis-resolved root, a store moved on disk
    // or a permission change all look like from here.
    const storesWalked = new Set();
    for (const record of walk.records) {
        byKey.set(recordKey(record.tier, record.segment, record.fileKey), record);
        storesWalked.add(recordKey(record.tier, record.segment, ''));
    }
    for (const row of listed.rows) {
        if (row === null || typeof row !== 'object') continue;
        const segment = row.segment === undefined ? null : row.segment;
        const key = recordKey(row.tier, segment, row.fileKey);
        const walked = byKey.get(key);
        if (walked === undefined) {
            if (row.tier !== 'project') continue;
            // A key the walk found twice is backed by files on this machine,
            // whichever of them the host holds, so it is not a removal.
            if (walk.duplicateKeys.has(key)) continue;
            if (summary.partial || !storesWalked.has(recordKey(row.tier, segment, ''))) {
                summary.heldBack += 1;
                continue;
            }
            removed.push({ segment: row.segment, fileKey: row.fileKey });
            continue;
        }
        if (!row.embedded && !withheld.has(key)) toEmbed.push({ recordId: row.recordId, record: walked });
    }

    if (removed.length > 0) {
        const marked = callProcedure(config, 'usp_UpsertRecords',
            { '@p_Records': [], '@p_Removed': removed }, { deps });
        if (!marked.ok) return { ok: false, standDown: 'unreachable', detail: marked.detail };
        summary.removed = Number(counted(marked.rows).removed) || 0;
    }

    const embedded = await embedRecords(config, toEmbed, { deps });
    summary.embedded = embedded.embedded;
    for (const reason of embedded.failed) summary.failed.push(reason);

    const orphans = collectOrphans();
    summary.orphans = orphans.length;
    if (orphans.length > 0) {
        const sent = callProcedure(config, 'usp_UpsertIndexOrphans', { '@p_Orphans': orphans }, { deps });
        if (!sent.ok) summary.failed.push('the index orphans were not recorded: ' + sent.detail);
    }

    const run = callProcedure(config, 'usp_AppendPublishRun', {
        '@p_Run': {
            started,
            finished: new Date().toISOString(),
            added: summary.added,
            changed: summary.changed,
            removed: summary.removed,
            embedded: summary.embedded,
            spoolDrained: summary.drained,
            error: summary.failed.length > 0 ? summary.failed.slice(0, 5).join('; ') : null
        }
    }, { deps });
    if (!run.ok) summary.failed.push('the publish run was not recorded: ' + run.detail);

    return { ok: true, summary };
}

// Embed and store the records the host reported unembedded.
//
// A RECORD'S CHUNKS NEVER SPLIT ACROSS TWO DATABASE CALLS. The host answers
// "embedded" by the existence of a row for the record and the model, so a
// record whose chunks landed in two calls and whose second call failed would
// read as embedded forever with half its text unsearchable.
//
// That invariant forbids splitting one record and says nothing about packing
// several. So the records are gathered into packs of whole records, a pack
// holding as many as fit inside the embedder's own batch width, and a pack is
// one embedding call and one database call. Most records in this store are a
// single chunk, so a first publish over a store of several hundred goes from
// several hundred process starts with a TLS login each to a few dozen. A
// record whose own chunk count is at or past the batch width is a pack by
// itself and takes as many embedding calls as it needs, still landing in one
// database call.
//
// A pack that fails costs the whole pack this run, which is the price of the
// batching: every record in it is reported and the next run finds them
// unembedded and tries again, since the host's reader is the only thing that
// decides what is pending.
async function embedRecords(config, pending, options) {
    const opts = options || {};
    const deps = opts.deps || {};
    const embed = (typeof deps.embedBatch === 'function') ? deps.embedBatch : embedBatch;
    const identity = modelIdentity(config);
    const batchWidth = indexLib().EMBED_BATCH;
    const out = { embedded: 0, failed: [] };

    const queue = [];
    for (const item of pending) {
        const chunks = chunkBody(item.record.body);
        if (chunks.length === 0) continue;
        const oversized = chunks.find((c) => c.text.length > CHUNK_MAX_CHARS);
        if (oversized !== undefined) {
            out.failed.push(memqLib().sanitize(item.record.name, 80) + ' has a chunk past the '
                + CHUNK_MAX_CHARS + '-character ceiling, so it was not embedded');
            continue;
        }
        queue.push({ recordId: item.recordId, name: item.record.name, chunks });
    }

    // The packs: whole records accumulated while their chunks fit the batch
    // width, and any record at or past that width standing alone.
    const packs = [];
    let pack = [];
    let width = 0;
    for (const item of queue) {
        if (item.chunks.length >= batchWidth) {
            if (pack.length > 0) { packs.push(pack); pack = []; width = 0; }
            packs.push([item]);
            continue;
        }
        if (width + item.chunks.length > batchWidth) { packs.push(pack); pack = []; width = 0; }
        pack.push(item);
        width += item.chunks.length;
    }
    if (pack.length > 0) packs.push(pack);

    for (const group of packs) {
        const rows = [];
        let refusal = null;
        // The whole pack's texts in call order, so one record's chunks stay
        // contiguous and each row's vector is found at the index its text was
        // sent at. The embedded text is composed the way the corpus is
        // composed, through memory-index's own function: the record's name,
        // then the text. A second spelling of that composition is a silent
        // ranking defect.
        const flat = [];
        for (const item of group) {
            item.chunks.forEach((chunk, index) => {
                flat.push({ item, chunk, index, text: indexLib().embedText(item.name, chunk.text) });
            });
        }
        for (let at = 0; at < flat.length && refusal === null; at += batchWidth) {
            const slice = flat.slice(at, at + batchWidth);
            const answered = await embed(config, slice.map((entry) => entry.text), { deps });
            if (!answered.ok) { refusal = answered.detail; break; }
            slice.forEach((entry, position) => {
                rows.push({
                    recordId: entry.item.recordId,
                    chunkIndex: entry.index,
                    chunkOffset: entry.chunk.offset,
                    chunkLength: entry.chunk.length,
                    vector: answered.vectors[position],
                    model: identity,
                    dimensions: answered.vectors[position].length
                });
            });
        }
        if (refusal !== null) {
            for (const item of group) {
                out.failed.push(memqLib().sanitize(item.name, 80) + ' was not embedded: ' + refusal);
            }
            continue;
        }
        const sent = callProcedure(config, 'usp_UpsertEmbeddings', { '@p_Embeddings': rows }, { deps });
        if (!sent.ok) {
            for (const item of group) {
                out.failed.push(memqLib().sanitize(item.name, 80) + ' was embedded and not stored: ' + sent.detail);
            }
            continue;
        }
        out.embedded += group.length;
    }
    return out;
}

// The run's one line, in the shape the local sweep's counters take: integers
// this module counted itself, no text off the wire.
function summaryLine(summary) {
    const published = summary.added + summary.changed + summary.unchanged + summary.skippedOlder;
    return 'db-sync: ' + published + ' record(s) published (added ' + summary.added
        + ', changed ' + summary.changed + ', unchanged ' + summary.unchanged
        + ', older ' + summary.skippedOlder + '), ' + summary.embedded + ' embedded, '
        + summary.removed + ' removed, ' + summary.drained + ' spool line(s) drained, '
        + summary.orphans + ' index orphan(s)'
        + (summary.malformed > 0 ? ', ' + summary.malformed + ' unreadable spool line(s) dropped' : '')
        + (summary.heldBack > 0 ? ', ' + summary.heldBack
            + ' removal(s) held back where the store read empty' : '')
        + (summary.partial ? ', walk incomplete so nothing was marked removed' : '');
}

// Why a run stood down, in one sentence per reason. A stand-down is loud: the
// caller prints this and does nothing else.
function standDownText(result) {
    if (result.standDown === 'absent') {
        return 'no memory database is configured on this machine (' + result.path + ' does not exist)';
    }
    if (result.standDown === 'unreachable') {
        return 'the memory database did not answer: ' + result.detail;
    }
    return 'the memory database config at ' + result.path + ' is ' + result.standDown
        + (result.detail ? ' (' + result.detail + ')' : '');
}

module.exports = {
    CONFIG_FILE,
    SPOOL_FILE,
    SPOOL_LOCK_FILE,
    RECORD_BATCH,
    CHUNK_TARGET_CHARS,
    CHUNK_MIN_CHARS,
    CHUNK_MAX_CHARS,
    configPath,
    spoolPath,
    spoolLockPath,
    loadConfig,
    modelIdentity,
    sqlcmdPath,
    childEnvironment,
    sweepStaleBatches,
    clockSeconds,
    payloadLiteral,
    runBatch,
    callProcedure,
    embedBatch,
    chunkBody,
    appendSpool,
    readSpool,
    drainSpool,
    deliver,
    usageEntry,
    outcomeEntry,
    tierIdentity,
    collectRecords,
    collectOrphans,
    publish,
    summaryLine,
    standDownText
};
