// memory-database: the kit memory store's client for the shared SQL Server
// index on the host, and the local queue that stands in for it when the host
// is not there.
//
// Five properties shape everything here.
//
// The host is optional and its absence is ordinary. A machine with no client
// config runs exactly as the kit ran before this file existed: nothing is
// spawned, no socket is opened, and no queue row is written. Every entry
// point answers absence with a typed result naming the reason, and nothing
// here throws that condition at a caller.
//
// The markdown store stays the record. This module publishes a derived copy
// and never reads one back into a file: the tiers, the usage sidecars and the
// outcome journal are written exactly as they were, whether the database call
// succeeded or failed. A stamp's database write is additive, so a lost one
// costs a row on the host and never a line in usage.jsonl.
//
// The local queue is a SQLite file, opened through node's own built-in
// binding, and every row on it is a row a writer composed whole. There is no
// torn line to repair and no unreadable piece to keep: SQLite's own locking
// and its busy wait are the whole concurrency story, and the drain removes a
// delivered row by its id, so a row written while a send is in flight is
// untouched by construction.
//
// The transport is sqlcmd over a pipe, not a driver. The kit core ships no
// dependencies, the client tools are on every sandbox, and the calls are few
// and batched. The password reaches the child through SQLCMDPASSWORD and never
// through an argument, because a command line is readable from the process
// list; the batch reaches it on standard input, because a JSON document
// carrying whole private record bodies has no business in a shell word and no
// business at rest in a shared temp directory either.
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
// Node's own SQLite binding, which the local queue below is the only user of.
// It ships with the runtime and needs no flag on the version the kit runs, so
// the queue costs this dependency-free module no dependency.
const { DatabaseSync } = require('node:sqlite');

const endpoint = require('./kit-endpoint-lib.js');
// The output channel's own renderer, for the composed sentence this client sends
// to the host on a publish run's error column: the home elision, the barred
// character, the strip and the cap, in the order that library states. It loads
// node built-ins and two other hooks/ libraries and loads no memq at module
// load, so it takes no part in the cycle below and is bound outright.
const { shownText } = require('../hooks/kit-compact-lib.js');

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

// The local queue, a SQLite file at the store root beside the client config.
// The sync repository's allowlist re-includes only paths inside the memory
// tiers and the machine coordinator directory, so it cannot be staged: a queue
// holding this machine's undelivered stamps is per-machine state and syncing it
// would publish one machine's pending journal to every other.
//
// SQLite writes beside it, a write-ahead log and a shared-memory index, carry
// the same name with a suffix and are excluded by the same rule.
const QUEUE_FILE = 'kit-memory-db-queue.sqlite';

// How long a drain waits on a lock another connection holds before the call
// fails. It is the constructor's own busy timeout, so the wait happens inside
// SQLite rather than in any arithmetic here: a connection meeting a held lock
// waits the holder out and then commits, which is what replaces every lock
// file, stale interval and break this module used to spell for itself.
//
// The drain is the only caller on this wait. Every writer takes the shorter one
// below, so no interactive path ever blocks for two seconds.
//
// Two seconds is far past the work any holder here does. A writer's whole hold
// is one INSERT of a few hundred bytes, and no boundary call is ever inside a
// transaction. So a wait that reaches this is a wedged holder rather than a
// busy one, and the drain answers contention rather than waiting longer,
// reporting the state and leaving every row where it is.
const QUEUE_BUSY_TIMEOUT_MS = 2000;

// The wait every writer takes, and the one a depth reading takes on a path that
// has already waited the full timeout out.
//
// A writer cannot afford the wait above. An interactive stamp and the read-stamp
// hook are budgeted at a few hundred milliseconds of a session's time, and their
// row is a derived copy whose sidecar is already written, so a wedged holder
// would otherwise cost every tool call two seconds to lose nothing. A depth
// reading on a path that already waited the full timeout out has learned that
// the holder is not letting go, so waiting it out again buys a number no more
// likely to arrive and delays the report of the contention by as long again.
//
// What this wait has to clear is the drain's delete, the only hold in this
// module long enough to matter. That hold is one transaction over one DELETE
// per delivered id, so it grows with the queue's depth and with nothing else:
// about two milliseconds at a thousand rows, nine at five thousand, a tenth of
// a second at twenty thousand, and a quarter of a second at fifty thousand. So
// a writer loses its row to this only on a queue holding tens of thousands of
// undelivered stamps, which is a host that has been unreachable long enough for
// the doctor's last-successful-publish age to have been the loud signal for
// weeks. Raising the depth at which a writer starts losing rows means lowering
// the depth, not lengthening this wait, which would spend a session's budget on
// every stamp to buy one row back at a depth nothing should reach. The stamp
// itself is not lost either way: the local journal holds it whatever the queue
// answered.
const QUEUE_BUSY_TIMEOUT_QUICK_MS = 250;

// SQLite's own code for a lock it would not wait any longer for, which this
// module tells from every other database error. The two have opposite readings:
// a busy machine resolves itself on the next run, while a disk or a corrupt
// file is a thing to go and look at, and a reader sent to one over the other is
// sent after a fault that is not there.
const SQLITE_BUSY = 5;

// The low byte of a result code, which is the primary code inside it.
//
// SQLite's result codes are extended codes, the primary code in the low byte
// and a reason in the byte above. The codes a lock can carry are 5 itself, 261
// for a lock met during recovery and 517 for one met on a snapshot, all three
// of them SQLITE_BUSY. An equality test against 5 would read the upper two as
// faults, which sends the drain to 'unreadable' or
// 'unclearable', sets the publish's work-failed flag and exits the verb non-zero
// on a machine that is merely busy. Masking is what makes the reading the
// primary code's rather than one code's.
const SQLITE_CODE_MASK = 0xff;

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

// The hard kill one sqlcmd spawn runs under, which is the caller's own clock
// rather than the tool's: the budget the call was given plus the spawn floor,
// which is the overshoot a call started on the last of a budget is allowed.
// runBatch's default kill is this and nothing else, so every place that has to
// know how long a spawn may live reads it from here rather than restating the
// sum.
function spawnKillMs(budgetMs) {
    return budgetMs + SQLCMD_FLOOR_MS;
}

// The longest a spawn may live past the deadline that let it start.
//
// callBudget lifts a call starting on the last millisecond of a budget to the
// spawn floor, and that call then runs under spawnKillMs of that floor, so the
// whole of a last spawn's life past the deadline is two floors rather than one.
// Any bound on how long a live publisher can still be inside a boundary call
// after its deadline is this, and a bound of one floor is short by the other.
const SPAWN_MAX_OVERSHOOT_MS = spawnKillMs(SQLCMD_FLOOR_MS);

// The budget the reachability probe below spends, which is this verb's own and
// not the judged channel's.
//
// That channel's probe is 400 milliseconds because it sits inside an
// interactive search, and it bounds an HTTP call whose clock is expressed in
// milliseconds. A sqlcmd spawn's two clocks are whole seconds, so any budget
// under two of them buys a one-second login clock and a one-second query clock,
// and a healthy host whose TLS handshake and SQL login together run past a
// second is then refused as unreachable on every run, silently where the
// session-start spawn is the caller. Two whole seconds each is the smallest
// spawn the tool can be asked to make, so this is the cheapest boundary call
// this module has and still an order of magnitude inside the timeout a batch
// call takes.
const PROBE_TIMEOUT_MS = SQLCMD_FLOOR_MS * 2;

// The budget a call that takes the fleet publish lock spends, which is those
// calls' own and the longest any single call here takes. Which procedures take
// that lock is stated by the scripts under plugins/claude-kit/db/Procedures that
// ask sp_getapplock for the mem.Publish resource, and by nothing here: a name
// written out on this side would be a second copy of a fact the T-SQL owns, and
// one that goes stale silently the first time a procedure joins them.
//
// Each takes it through sp_getapplock at @LockTimeout = 30000, so two sandboxes
// publishing at once queue for up to thirty seconds rather than race. A spawn's
// query clock is floor(budget/2000) whole seconds, so the configured ten-second
// timeout buys a five-second query clock and the queuing publisher is killed by
// its own client six times over before the server would have let it in: the
// lock's whole purpose is lost on the client side. Doubling the sum of the
// server's wait and the spawn floor is what puts the clock past the wait, since
// floor(64000/2000) is 32 seconds, two more than the thirty the server will
// spend. The server's number is the one that moves first, so this is derived
// from it rather than written out.
//
// At the boundary, a run holding less than this on its own deadline spends what
// is left instead and a batch may then be killed mid-wait. Both writes are
// idempotent and neither is ever queued, so what a killed batch costs is the
// work behind it: a record upsert costs the call alone, since the next run
// re-derives every record from the files, while an embedding write costs the
// vectors of the pack it carried, which the next run makes again from the same
// records the inventory still reports unembedded.
const LOCK_WAIT_MS = 30000;
const UPSERT_TIMEOUT_MS = (LOCK_WAIT_MS + SQLCMD_FLOOR_MS) * 2;

// The whole run's budget, over every boundary call a publish makes.
//
// Each call carries its own clock and nothing bounded the chain of them, so a
// host degraded rather than down bought a run of arbitrary length: a walk of
// several hundred records is a few dozen spawns and as many embedding calls,
// every one of them willing to spend the configured timeout. Fifteen minutes is
// past any healthy run of this store (a first publish of several hundred
// records embeds in a few dozen calls) and far short of the interval the
// session-start spawn holds the next run off for, which is DB_SYNC_ATTEMPT_STALE_MS
// in hooks/memory-session.js. That constant is a literal chosen to exceed this
// one plus SPAWN_MAX_OVERSHOOT_MS rather than derived from either, and the
// ordering between the three is held by test/memory-session.test.js, so a
// change to any one of them reds there rather than quietly letting a second
// publish start beside a run still in flight.
const RUN_BUDGET_MS = 15 * 60 * 1000;

// The schema version the queue drain needs on the host before it sends a row.
//
// The drain deletes nothing on any failure and lets the next run send the lot
// again, which is safe only because mem.Usage and mem.Outcome hold a
// unique index over the stamp id and the two append procedures skip an id their
// table already holds. Version 2 is where those land. An older host takes the
// same call and its OPENJSON ... WITH ignores the stampId key it does not name,
// so nothing there tells a resend from a new row and every resend writes a
// second row: exactly the duplicate the index exists to prevent. The version is
// therefore a precondition of sending rather than a thing to discover
// afterwards, and Install-MemoryDatabase.ps1 carries the same number as the
// version it applies.
const REQUIRED_SCHEMA_VERSION = 2;

// A database name this client hands to sqlcmd's -d argument, the probe's own
// pattern. It is the plain-identifier shape, a subset of what SQL Server admits
// as a regular identifier, so a value outside it names no database that could
// exist and the run stands down at the config read rather than on a spawn that
// was never going to connect.
//
// The server and the login ride the same command line under -S and -U and take
// no screen of their own. Their shapes are the operator's to choose, this
// client states none, and there is no shell between this process and the tool
// for either to be read by. Nothing in this module crosses into T-SQL text:
// every parameter is a declared variable filled from an escaped literal.
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
// characters, and the ceiling below sits at about 1500 tokens, well short of
// the embedding server's 2048-token batch width. The chunker cannot produce a
// piece past that ceiling, so no chunk of English prose reaches the server's
// own limit.
//
// That ratio is a property of English prose and of this model's vocabulary,
// and it does not hold for text that is mostly CJK or emoji, where a
// multilingual vocabulary spends closer to one token per character. A body
// like that can chunk inside the character ceiling and still be refused by the
// server on its token count, which is why a refused call is retried one record
// at a time: the refusal then names the one body the server would not take
// rather than every record packed beside it.
const CHUNK_TARGET_CHARS = 4096;
const CHUNK_MIN_CHARS = 2048;
const CHUNK_MAX_CHARS = 6144;

// The most texts one embedding call may carry, which is a property of the
// answer rather than of the request: kit-endpoint-lib reads a response body
// under a fixed byte bound, and a vector of this model's width printed as JSON
// is about twenty kilobytes. Sixteen of them, the local sweep's batch width,
// is a third of a megabyte, so every full pack would be refused at the reader
// and only a store whose records pack into fewer chunks would embed at all.
//
// The width is the schema's: mem.Embedding holds VECTOR(1024) and the fleet's
// model is 1024-wide, so a model change moves this number and the column
// together. The bytes per float are generous on purpose, since a JSON float at
// full double precision plus its separator runs to about twenty characters and
// the cost of over-reserving is one more call.
const EMBED_VECTOR_DIMENSIONS = 1024;
const EMBED_FLOAT_BYTES = 24;
const EMBED_RESPONSE_OVERHEAD_BYTES = 4096;

// --------------------------------------------------------------- the config --

function configPath() {
    return path.join(os.homedir(), '.claude', CONFIG_FILE);
}

function queuePath() {
    return path.join(memqLib().memoryRoot(), QUEUE_FILE);
}

// Whether the store this process would walk and queue into is the machine's
// own, which is the only store this client speaks for.
//
// The credential comes from the home directory while the walk's root moves with
// KIT_MEMORY_ROOT, so a redirected store presents the default store's login and
// resolves to the same sandbox on the host. Publishing from one would name the
// other's rows removed and the shared index would oscillate between two
// readings of one sandbox; queuing into one would fill a file no publish ever
// drains, since every publish leg refuses the same condition. One spelling of
// the question, read by the verb, the session-start spawn and the stamp writer
// alike.
function isDefaultStoreRoot() {
    try {
        return path.resolve(memqLib().memoryRoot()).toLowerCase()
            === path.resolve(path.join(os.homedir(), '.claude')).toLowerCase();
    } catch {
        return false;
    }
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
//
// `curatorLogin` and `curatorPassword` are optional and travel as a pair. They
// are the second principal this client can present, held on the config's
// `curator` key as {login, password} where both are given and as null where
// neither is, so a caller reads one field to learn whether the machine holds a
// curator at all. One without the other is a config defect rather than an
// absent curator: a half-typed pair reported as "no curator configured" would
// send the operator to add what is already there.
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
    // The model identity is the one scalar out of the config this client
    // writes into a batch, so it is held to the batch's own screen here rather
    // than at the call. A model string the screen refuses is a config defect,
    // and reported at the call it would read as a host that did not answer,
    // every run. Emptiness was refused above with the other missing keys.
    if (textLiteral('@v1', model) === null) {
        return {
            ok: false,
            reason: 'invalid',
            path: target,
            detail: 'embedding.model is not a value this client writes into a batch, so '
                + memqLib().sanitize(model, 64) + ' is never sent'
        };
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

    const curatorLogin = text(parsed.curatorLogin);
    const curatorPassword = typeof parsed.curatorPassword === 'string' ? parsed.curatorPassword : '';
    if ((curatorLogin === '') !== (curatorPassword === '')) {
        return {
            ok: false,
            reason: 'invalid',
            path: target,
            detail: 'curatorLogin and curatorPassword are given together or not at all, and only '
                + (curatorLogin === '' ? 'curatorPassword' : 'curatorLogin') + ' is set'
        };
    }
    const curator = curatorLogin === '' ? null : { login: curatorLogin, password: curatorPassword };

    return {
        ok: true,
        path: target,
        config: {
            server, database, login, password, timeoutMs, windowsAuth,
            trustServerCertificate: parsed.trustServerCertificate === true,
            embedding: { url, model },
            curator
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
// One candidate, spelled here as a literal, and no fallback of any kind.
// Resolving by name searches PATH, which hands the login's password to whatever
// sqlcmd sits earliest in that list. Resolving through the environment's own
// ProgramFiles is the same hazard one step removed: a repository-committed
// terminal environment, which is inside this project's threat model, sets that
// variable to a directory it controls, plants this relative path under it, and
// receives the password in the child. So the only base is the one every sandbox
// installs to. A machine that holds its program files elsewhere publishes
// nothing and says so, which is the same answer it gives for an absent config.
const SQLCMD_BASE = 'C:\\Program Files';
function sqlcmdPath() {
    const pinned = path.join(SQLCMD_BASE, PINNED_SQLCMD);
    try {
        if (fs.statSync(pinned).isFile()) return pinned;
    } catch { /* not installed: this client resolves nothing else */ }
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
//
// PATH is not on the list, and the spawn names the child's working directory
// for the same reason. The Windows loader searches the working directory and
// then PATH for a dependent library it has not already found, so both are ways
// a directory somebody else writes gets a say in which code runs inside a
// process holding the login's password. The tool is launched from its own
// directory, where the client libraries it loads sit beside it.
const CHILD_ENV_ALLOWED = [
    'SystemRoot', 'windir', 'PATHEXT', 'COMSPEC', 'ComSpec',
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

// What a boundary call about to start may spend, or null where the run's
// deadline has passed and the call must not start at all.
//
// Two rules in one answer. The run's deadline governs whether a call starts,
// so a call asked for on or after it is refused rather than clamped to nothing.
// The call's own clock governs how long it runs, so what is left of the run's
// budget bounds the clock a caller asked for, and the one call that crosses
// the deadline is the only one that overshoots it.
//
// The lift to the tool's floor is where that overshoot comes from. A clock
// under the floor is one the tool cannot express, sqlcmd's two clocks being
// whole seconds each, so a call starting on the last millisecond of the budget
// gets the floor and finishes within it of the deadline rather than being
// refused for a millisecond. At the boundary values: one millisecond left is a
// call at the floor, no milliseconds left is no call, and a deadline further
// off than the caller's own budget leaves that budget untouched.
function callBudget(deadline, nowMs, wantMs, floorMs) {
    const remaining = deadline - nowMs;
    if (!(remaining > 0)) return null;
    return Math.max(floorMs, Math.min(wantMs, remaining));
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
const PAYLOAD_PIECE_CHARS = 2000;
function payloadLiteral(variable, value) {
    const json = JSON.stringify(value).replace(/[^\x20-\x7E]/g, (ch) => {
        return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    });
    const lines = [';DECLARE ' + variable + ' NVARCHAR(MAX) = N\'\''];
    for (let at = 0; at < json.length; at += PAYLOAD_PIECE_CHARS) {
        lines.push(';SET ' + variable + ' = ' + variable + ' + N\''
            + json.slice(at, at + PAYLOAD_PIECE_CHARS).replace(/'/g, "''") + '\'');
    }
    return lines.join('\n');
}

// The payload one call's own budget funds, in the pieces above. Two hundred
// thousand characters is the size this module already treats as one comfortable
// call, which is what RECORD_BATCH's fifty record bodies come to.
const PAYLOAD_PIECES_PER_BUDGET = 100;
const PAYLOAD_FUNDED_CHARS = PAYLOAD_PIECE_CHARS * PAYLOAD_PIECES_PER_BUDGET;

// What a call carrying a payload of this many characters may spend, which is the
// caller's own want and never more.
//
// THE CONFIGURED TIMEOUT IS THE CEILING ON ONE CALL, WHATEVER IT CARRIES. The
// run's remaining budget divided down across the clocks that run in sequence is
// what a call's clock is, lifted only to the tool's own floor, so a clock
// derived upward from the payload would put one sqlcmd process past the timeout
// the operator configured, on a machine budgeted at one heavy process and with
// the session-start publish running detached. The size of
// the payload is the operator's question rather than this client's licence.
//
// So the payload does not move the clock, and what the payload does instead is
// get reported. The server rebuilds the whole variable on each of the SET
// statements above, so the work behind a payload grows with the square of its
// piece count while the clock does not grow at all: past PAYLOAD_FUNDED_CHARS
// the call may be killed on that clock every time it is made, and since the
// drain deletes nothing the next run builds the identical call. The drain
// names that condition with the payload's own size and the clock beside it, so
// the state is legible where it would otherwise only show as a queue that never
// empties. Nothing here repairs it: the clock is the operator's to raise and the
// queue is theirs to look at.
//
// MAX_TIMEOUT_MS is the longest clock this module accepts anywhere, which a
// configured timeout is already held inside, and it stands here as the module's
// own ceiling over any want a caller passes.
function payloadCallMs(wantMs) {
    return Math.min(MAX_TIMEOUT_MS, wantMs);
}

// A scalar string parameter as a literal, or null where the value is not one
// this module will write into a batch.
//
// The escape the payload above uses is unavailable here: \uXXXX means
// something to the server's JSON parser and nothing to its string literals, so
// a scalar's own characters are what reach the batch. The screen is therefore
// the guard rather than the escaping, and it is narrow because the scalars any
// call passes are the embedding model's identity out of the config and the
// record identity a curator verb names, every one of them an identifier the
// store's own gates already hold to a charset inside this one. The empty
// string is a literal like any other, N'', and it is what a curator verb sends
// for a segment a tier does not have; the model identity is held non-empty at
// the config read rather than here.
function textLiteral(variable, value) {
    if (typeof value !== 'string' || value.length > 200) return null;
    if (!/^[\x20-\x7E]*$/.test(value) || value.includes("'")) return null;
    return ';DECLARE ' + variable + ' NVARCHAR(200) = N\'' + value + '\'';
}

// The tag a result line carries. Every answer is found by its tag rather than
// by its position, the host probe's rule: the captured stream merges stdout and
// stderr, so a server notice ahead of a result set shifts every index by one.
const RESULT_TAG = 'kitdb-json=';

// Whether the tool's output carries a message the server sent back, which is
// what tells a batch the server rejected from a host this client never reached.
//
// The test is structural rather than a match on what the message says. sqlcmd
// prints a message that arrived over an open connection inside the envelope the
// server addressed it with, its number, severity and state, and it prints
// everything that failed before or beneath a connection under its own `Sqlcmd:`
// prefix instead. So the envelope is evidence that a session existed, that a
// batch reached the server and that the server answered it, and no prose match
// is involved: a closed port, a rejected login and a refused certificate all
// exit non-zero and all speak of a refusal in words, and none of them can
// produce this shape.
//
// Two edges, both falling to the safe side. A server whose messages are
// localized prints another word in place of Msg, which reads here as no
// envelope and so as an outage, which is the conservative answer: a queue that
// keeps its rows through a real defect costs a repeat, where a defect reported
// against a host that merely blinked costs a hunt for a bug that is not there.
// And a server message raised by something other than this batch's own contract,
// a deadlock victim or a lock request timeout, does carry the envelope and is
// read here as a refusal; its rows stay on the queue either way and the
// next drain sends them, so what it costs is a sentence naming the wrong remedy
// once.
const SERVER_MESSAGE_RE = /^Msg \d+, Level \d+, State \d+/m;
function carriesServerMessage(output) {
    return typeof output === 'string' && SERVER_MESSAGE_RE.test(output);
}

// Which of the two a failed spawn is, over the two facts the spawn itself
// answers with: the status it exited with and everything it printed.
//
// A status of null is a kill on this process's own clock. It says nothing at
// all about the server, so it is an outage whatever the tool had printed by
// then: a batch the server was still working on when the clock ran out may
// already have printed a message envelope from some earlier statement, and
// reading that as a refusal would open a contract defect against a host that
// was merely slow. Every other non-zero status is read off the envelope, which
// is what carriesServerMessage states.
function failureCause(status, output) {
    if (status === null) return 'outage';
    return carriesServerMessage(output) ? 'refused' : 'outage';
}

// One sqlcmd run over a batch this module wrote, as {ok, rows, detail, cause}.
//
// `cause` rides on every failure and is `refused` where the server answered the
// batch with a message of its own and `outage` everywhere else, which is what
// lets a caller tell a defect in what it sent from a host that was not there.
// The two have opposite remedies and the queue's drain reports them apart.
//
// The spawn is the host probe's, with three differences the payload forces.
// -y 0 replaces -h -1 and -W, because the tool refuses those flags beside it
// and without it a JSON answer past the default display width is cut silently,
// which is an answer that parses and is wrong. The batch goes in on standard
// input rather than through -i, so a document carrying whole record bodies is
// never a file another account can read: sqlcmd reads its batch from the pipe
// when no input file is named, and -b still reports a failed batch as a
// non-zero status from that leg. The batch itself is pure ASCII, so the tool's
// encoding detection has nothing to get wrong. And the caller's own clock
// bounds the spawn on top of sqlcmd's two, because the stamp path's budget is
// shorter than the one second sqlcmd's flags can express.
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
    const killMs = Number.isFinite(opts.killMs) ? opts.killMs : spawnKillMs(budgetMs);
    const tool = sqlcmdPath();
    if (tool === null) {
        return {
            ok: false,
            cause: 'outage',
            detail: 'the SQL client tools are not installed at '
                + path.join(SQLCMD_BASE, PINNED_SQLCMD)
                + ', and this client resolves no other path for them'
        };
    }
    const seconds = clockSeconds(budgetMs);
    if (seconds < 1) {
        return { ok: false, cause: 'outage', detail: 'the budget was spent before this spawn, so none was made' };
    }

    const args = ['-S', config.server, '-d', config.database, '-b', '-I', '-N', '-x', '-y', '0',
        '-l', String(seconds), '-t', String(seconds)];
    if (config.windowsAuth) args.push('-E');
    else args.push('-U', config.login);
    if (config.trustServerCertificate) args.push('-C');

    const env = childEnvironment(config);

    let res = null;
    try {
        res = spawnSync(tool, args, {
            encoding: 'utf8',
            env,
            // The tool's own directory, so the Windows loader's working-directory
            // search for a dependent library lands where the client libraries
            // are rather than wherever this process was started.
            cwd: path.dirname(tool),
            input: batch + '\n',
            timeout: killMs,
            windowsHide: true,
            maxBuffer: 64 * 1024 * 1024
        });
    } catch (err) {
        return { ok: false, cause: 'outage', detail: 'could not run sqlcmd: ' + errText(err) };
    }

    const output = (res.stdout || '') + (res.stderr || '');
    if (res.error) return { ok: false, cause: 'outage', detail: 'could not run sqlcmd: ' + errText(res.error) };
    if (res.status !== 0) {
        // sqlcmd's own words are all a reader gets to tell a certificate
        // refusal from a closed port from a procedure that threw, and they
        // come off a channel this process does not author, so they are
        // bounded and stripped before they reach a line anyone reads. What
        // this client acts on is the envelope rather than those words, which
        // failureCause above states over the status and the output together.
        const killed = res.status === null;
        return {
            ok: false,
            cause: failureCause(res.status, output),
            detail: 'sqlcmd exited ' + (killed ? 'on its caller\'s clock' : res.status)
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
            // The batch reached the server and the server answered, so this is
            // not a host that was away: it is an answer in a shape this client
            // cannot read, which is the same version skew a refusal is and takes
            // the same loud disposition.
            return {
                ok: false,
                cause: 'refused',
                detail: 'a result line was not JSON, so the answer could not be read'
            };
        }
    }
    return { ok: true, rows };
}

// One procedure call whose parameters are JSON payloads, as {ok, rows, detail,
// cause}, with `cause` on every failure the way the transport under it answers.
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
                // A refusal rather than an outage, and no spawn is made at all:
                // the payload this client composed is one it will not write into
                // a batch, which is a defect in what it sends and has the
                // remedy a refusal has. Reported as an outage it would read as a
                // host that was away and wait for a host that is fine.
                return {
                    ok: false,
                    cause: 'refused',
                    detail: name + ' is not a value this client writes into a batch'
                };
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

// Texts in one embedding call: the local sweep's batch width, or fewer where a
// response that wide would not fit the bound its reader holds it under.
function embedCallWidth() {
    const room = endpoint.MAX_BODY_BYTES - EMBED_RESPONSE_OVERHEAD_BYTES;
    const perVector = EMBED_VECTOR_DIMENSIONS * EMBED_FLOAT_BYTES;
    return Math.max(1, Math.min(indexLib().EMBED_BATCH, Math.floor(room / perVector)));
}

// ----------------------------------------------------------------- the queries --

// How much of a caller's query text reaches the host. mem.usp_Search normalizes
// and caps its own predicate at four thousand characters, and JSON_VALUE hands
// back at most that many, so a longer text would arrive as a null query text and
// silently disable the two lexical lists. Cut here instead, where the cut is a
// fact this side knows about.
const QUERY_TEXT_CAP = 4000;

// The most rows either query procedure serves. Both clamp an oversized request
// to fifty of their own accord; asking for more is asking for a number the host
// will not answer with, which reads to a caller as a short result rather than as
// a clamp.
const QUERY_LIMIT_MAX = 50;

// The schema version the hybrid search's answer carries a distance in, and the
// floor the shared search stands down below.
//
// THE VERSION IS NEGOTIATED RATHER THAN INFERRED FROM THE ANSWER, AND NOT
// BECAUSE THE ANSWER CANNOT BE READ. It can: mem.usp_Search projects its rows
// with INCLUDE_NULL_VALUES, so a version 3 host emits an explicit null distance
// for a record only its lexical lists ranked, while a version 2 host emits no
// distance key at all. Those are different bytes and a client could tell them
// apart.
//
// The gate is here for what reading the field would cost, not for an ambiguity
// that is not there. Inferring decides per row, and it decides only once the
// query's text has already been embedded and sent to the host. Negotiating
// decides once, on the probe this path already spends, ahead of the embedding
// call, so a host that cannot answer this query is never sent its text at all.
// What the gate buys is that an old host serves nothing, rather than serving a
// whole ranking with no floor applied to any of it under a note saying the
// shared index answered, which is this channel's expensive failure.
//
// The nearest scan takes no such gate: mem.usp_Nearest has returned its distance
// since version 1, and its answer means the same thing on every host that has
// the procedure at all.
const SEARCH_SCHEMA_VERSION = 3;

// The interval a cosine distance can occupy, which is what a distance crossing
// this boundary is held to. Two vectors' cosine similarity lies in [-1, 1], so
// the distance the server computes lies in [0, 2]. A value outside it is not a
// distance, whatever the field is called, and a similarity derived from one
// clears every floor on this path and prints as a number a reader takes for a
// cosine.
const DISTANCE_MIN = 0;
const DISTANCE_MAX = 2;

// The whole of one query's clock, over the three boundary calls it makes: the
// reachability probe, the embedding call and the procedure call. Each takes its
// own clock inside this deadline, so the chain is bounded once rather than each
// link separately.
//
// THE PROBE'S BUDGET IS THIS CLIENT'S OWN AND NEVER AN INTERACTIVE CHANNEL'S.
// PROBE_TIMEOUT_MS states why: a sqlcmd spawn's two clocks are whole seconds
// each, so a shorter budget refuses a healthy host whose login takes over a
// second and reports it as an outage.
function queryBudgetMs(config) {
    return PROBE_TIMEOUT_MS + config.timeoutMs;
}

// The reachability probe, one spawn at the module's own probe budget, so an
// unreachable host is discovered in about the time one spawn costs rather than
// at the full configured timeout. The publish leg spends the same call for the
// same reason and through the same procedure.
function probeHost(config, options) {
    const opts = options || {};
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : PROBE_TIMEOUT_MS;
    return callProcedure(config, 'usp_Health', {},
        { deps: opts.deps, budgetMs, killMs: budgetMs + SQLCMD_FLOOR_MS });
}

// One query call's batch: the vector and the text as one payload, declared into
// the types the two procedures take, and the procedure invoked on variables.
//
// callProcedure is not the route here, because both procedures take typed
// scalars rather than the JSON documents every publisher procedure takes: a
// VECTOR(1024) and an NVARCHAR the caller's own words arrive in. So the payload
// carries both values and the batch casts them out of it, the cast being the one
// mem.usp_UpsertEmbeddings already writes over the same JSON array text.
//
// NOTHING A CALLER SUPPLIES IS CONCATENATED INTO THIS BATCH. The query text and
// the vector ride payloadLiteral, which escapes the JSON to pure ASCII, doubles
// its quotes and appends it in bounded pieces, so no line of it can read as a
// batch separator or a variable reference. The limit is the one value written
// out, and it is written from a digit string this function derives rather than
// from the caller's own number. The model identity takes textLiteral, the screen
// the config read already held it to.
function queryBatch(procedure, vector, text, limit, model) {
    const modelLiteral = textLiteral('@Model', model);
    if (modelLiteral === null) return null;
    const bounded = Math.max(1, Math.min(QUERY_LIMIT_MAX, Math.floor(limit)));
    const argumentList = procedure === 'usp_Nearest'
        ? '@p_Vector = @QueryVector, @p_Limit = @Limit, @p_ModelIdentity = @Model'
        : '@p_QueryText = @QueryText, @p_QueryVector = @QueryVector,'
            + ' @p_Limit = @Limit, @p_ModelIdentity = @Model';
    return [
        ';SET NOCOUNT ON',
        payloadLiteral('@Query', { vector, text: text.slice(0, QUERY_TEXT_CAP) }),
        ';DECLARE @QueryVector VECTOR(' + EMBED_VECTOR_DIMENSIONS
            + ') = CAST(JSON_QUERY(@Query, \'$.vector\') AS VECTOR('
            + EMBED_VECTOR_DIMENSIONS + '))',
        ';DECLARE @QueryText NVARCHAR(' + QUERY_TEXT_CAP + ') = JSON_VALUE(@Query, \'$.text\')',
        ';DECLARE @Limit INT = ' + String(bounded),
        modelLiteral,
        ';DECLARE @Answer TABLE ( [Json] NVARCHAR(MAX) NULL )',
        ';INSERT INTO @Answer ( [Json] ) EXEC mem.' + procedure + ' ' + argumentList,
        ';SELECT \'' + RESULT_TAG + '\' + COALESCE([Json], \'null\') FROM @Answer'
    ].join('\n');
}

// The rows of a query answer, as the array the procedure's own FOR JSON built.
//
// Each procedure composes its whole answer as one scalar subquery, so one row
// with one column comes back however many records it names; an answer of any
// other shape is a host this client cannot read rather than a host with nothing
// to say, and it reads here as no rows.
function queryRows(run) {
    const first = Array.isArray(run.rows) && run.rows.length > 0 ? run.rows[0] : null;
    return Array.isArray(first) ? first : [];
}

// One answered row as this client hands it on: the fields both procedures
// return, each held to the type it is read as, with a similarity in the place
// each procedure states its ranking in.
//
// ONE QUANTITY CARRIES THE SIMILARITY ON BOTH PATHS, AND IT IS THE DISTANCE.
// Both procedures return the cosine distance of the record's best chunk, and one
// minus it is a similarity in the same arithmetic the local ranker uses. The
// arithmetic is shared and the scale is not, so that sameness is exactly what
// makes the two easy to confuse. These rows are ranked by the host's model and
// the local ranker's rows by this machine's, and the host's unrelated band alone
// reaches above the local overlap floor. A caller must therefore know which
// index filled a row in order to pick a floor for it, which is why memq keeps
// one floor pair per population (LOCAL_FLOORS and FLEET_FLOORS) rather than a
// constant a reader picks by name. The fused score mem.usp_Search also returns is a sum
// over four ranked lists on no comparable scale at all, so it is not carried
// here and no surface prints it.
//
// A hybrid search row with no distance is a record the two lexical lists found
// and neither vector list ranked, which mem.usp_Search returns by design: the
// full-text lists match on a token the record holds, so the row is an answer and
// its similarity is simply not a number this side has. It is carried with a null
// score and the surfaces that would print one print nothing. The nearest scan is
// the other case: a distance is the whole of what it ranks on, so a row without
// one is malformed and is dropped. A distance present but not a number, or one
// outside the interval a cosine distance occupies, is malformed on either path
// and is dropped with it: every other value crossing this boundary is held to
// its type and its length, and this one is held to its range for the same
// reason. That the host is one this client's own version gate admitted is no
// warrant for the numbers inside its answer.
//
// The two lexical ranks ride along because a floor written for a similarity
// cannot speak to a row that has none, and these are how a reader of this hit
// tells the two cases apart: a row with no distance that a full-text list
// ranked is an answer on evidence of its own, where a row no list ranked at all
// is not there to begin with.
//
// A row missing a field it must have is dropped rather than repaired. Every one
// of these values crosses a machine boundary, so the shape is checked here and
// the display reductions are left to the channel that prints them.
function queryHit(row, procedure) {
    if (row === null || typeof row !== 'object') return null;
    if (typeof row.name !== 'string' || row.name === '') return null;
    if (typeof row.tier !== 'string' || row.tier === '') return null;
    const stated = row.distance !== null && row.distance !== undefined;
    if (stated && !(Number.isFinite(row.distance)
        && row.distance >= DISTANCE_MIN && row.distance <= DISTANCE_MAX)) {
        return null;
    }
    if (!stated && procedure === 'usp_Nearest') return null;
    const score = stated ? 1 - row.distance : null;
    return {
        name: row.name,
        fileKey: typeof row.fileKey === 'string' ? row.fileKey : '',
        tier: row.tier,
        segment: typeof row.segment === 'string' ? row.segment : '',
        sandbox: typeof row.sandbox === 'string' ? row.sandbox : '',
        visibility: typeof row.visibility === 'string' ? row.visibility : '',
        description: typeof row.description === 'string' ? row.description : '',
        archived: row.archived === true || row.archived === 1,
        score,
        descriptionRank: rankOf(row.descriptionRank),
        bodyRank: rankOf(row.bodyRank)
    };
}

// A candidate list's rank position as this client reads it, or null where that
// list did not vote. The procedures answer a rank as a positive integer and
// null otherwise, so anything else is a value this side cannot place and reads
// as no vote, which is the safe direction: a floor applies to a row this client
// could not prove a lexical vote for.
function rankOf(value) {
    return (Number.isFinite(value) && value > 0) ? value : null;
}

// The query side of this client, as {ok, lists} or a stand-down a caller prints
// and then serves its local answer instead.
//
// One text per list, in the order they were passed, so a caller asking about
// several records reads its answers back positionally. `mode` is which procedure
// answers: the hybrid search for a query a person typed, the nearest scan for a
// record whose own text is the query.
//
// EVERY VECTOR THAT REACHES THE HOST IS ONE THE HOST'S OWN EMBEDDER MADE. The
// local index's model is a different model at 384 dimensions, and its vectors
// compare with nothing the fleet holds, so a local vector on this path would
// either be refused by a VECTOR(1024) parameter or, worse, rank against the
// wrong space. The width screen below is that rule made mechanical: a vector of
// any other width stands the query down and nothing is sent.
//
// It never throws and it never falls back. A caller that meets a stand-down
// prints it and runs whatever it would have run without a database at all,
// which is what keeps a host condition from failing a search.
//
// `signal` is how a caller under a clock of its own stops paying for an answer
// nobody is left to read, the shape memq's local ranking takes for the same
// condition: it is read before each of the three boundary calls below, so the
// spawns and the HTTP request after an abort are never made.
async function queryHost(options) {
    const opts = options || {};
    const mode = opts.mode === 'nearest' ? 'nearest' : 'search';
    const procedure = mode === 'nearest' ? 'usp_Nearest' : 'usp_Search';
    const loaded = opts.config
        ? { ok: true, config: opts.config, path: opts.configPath }
        : loadConfig(opts.configPath);
    if (!loaded.ok) {
        return { ok: false, standDown: loaded.reason, detail: loaded.detail, path: loaded.path };
    }
    const config = loaded.config;
    const deps = opts.deps || {};
    const texts = (Array.isArray(opts.texts) ? opts.texts : [])
        .filter((t) => typeof t === 'string' && t.trim() !== '');
    if (texts.length === 0) return { ok: true, lists: [] };
    const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 10;

    // The run's one deadline and the two questions every call below asks of it,
    // publish's own shape: whether the call may start at all, and what clock it
    // gets if it does. A caller with a shorter budget of its own passes it, and
    // the session-start block is the caller that does.
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : queryBudgetMs(config);
    const deadline = now() + budgetMs;
    const budgetFor = (wantMs, floorMs) => callBudget(deadline, now(), wantMs, floorMs);
    const spent = (what) => ({
        ok: false,
        standDown: 'budget',
        detail: 'the ' + budgetMs + ' ms this query may spend was gone before ' + what
    });

    // The caller's own cancellation, read at the same three points the deadline
    // is: before the probe, before each embedding call and before each procedure
    // call. A caller whose signal is aborted has already printed whatever it
    // says instead of this answer, and the calls below are a detached spawn and
    // an HTTP request apiece, so what an abort buys is every call after the one
    // already in flight. It is a stand-down like any other, so a caller that did
    // keep the promise around reads a reason rather than a hole.
    const abandoned = () => ((opts.signal && opts.signal.aborted)
        ? {
            ok: false,
            standDown: 'cancelled',
            detail: 'this query was abandoned before it answered'
        }
        : null);

    const beforeProbe = abandoned();
    if (beforeProbe !== null) return beforeProbe;
    const probeMs = budgetFor(PROBE_TIMEOUT_MS, SQLCMD_FLOOR_MS);
    if (probeMs === null) return spent('the reachability probe');
    const probe = probeHost(config, { deps, budgetMs: probeMs });
    if (!probe.ok) return { ok: false, standDown: 'unreachable', detail: probe.detail };

    // The version gate, on the answer the probe already carries rather than on a
    // second call for a number this query holds, the publish leg's own reading
    // of the same field. It stands ahead of the embedding call, so a host that
    // cannot answer this query is not sent its text either.
    if (mode === 'search') {
        const hostSchema = Number(counted(probe.rows).schemaVersion);
        if (!(Number.isFinite(hostSchema) && hostSchema >= SEARCH_SCHEMA_VERSION)) {
            const found = Number.isFinite(hostSchema)
                ? 'schema version ' + hostSchema : 'no schema version at all';
            return {
                ok: false,
                standDown: 'schema',
                detail: 'the memory database reports ' + found + ' where the shared search needs'
                    + ' version ' + SEARCH_SCHEMA_VERSION + ', whose rows carry the distance this'
                    + ' client ranks on; re-run Install-MemoryDatabase.ps1 against the host'
            };
        }
    }

    // Every text embedded on the host, in the batches one response fits, before
    // any procedure call is made. The vectors are what the procedures rank on,
    // so a host that will not embed is a query that cannot be asked at all and
    // the sqlcmd spawns are never spent on it.
    const vectors = [];
    const width = embedCallWidth();
    for (let at = 0; at < texts.length; at += width) {
        const beforeEmbed = abandoned();
        if (beforeEmbed !== null) return beforeEmbed;
        const embedMs = budgetFor(config.timeoutMs, EMBEDDING_FLOOR_MS);
        if (embedMs === null) return spent('the embedding call');
        const answered = await (deps.embedBatch || embedBatch)(config,
            texts.slice(at, at + width), { deps, budgetMs: embedMs });
        if (!answered.ok) {
            return {
                ok: false,
                standDown: 'unreachable',
                detail: 'the embedding server did not answer: ' + answered.detail
            };
        }
        for (const vector of answered.vectors) {
            if (vector.length !== EMBED_VECTOR_DIMENSIONS) {
                return {
                    ok: false,
                    standDown: 'refused',
                    detail: 'the embedding server answered a vector of ' + vector.length
                        + ' dimensions where this database holds ' + EMBED_VECTOR_DIMENSIONS
                        + ', so no vector was sent'
                };
            }
            vectors.push(vector);
        }
    }

    const lists = [];
    for (let at = 0; at < texts.length; at++) {
        const beforeCall = abandoned();
        if (beforeCall !== null) return beforeCall;
        const callMs = budgetFor(config.timeoutMs, SQLCMD_FLOOR_MS);
        if (callMs === null) return spent('a ' + procedure + ' call');
        const batch = queryBatch(procedure, vectors[at], texts[at], limit, modelIdentity(config));
        if (batch === null) {
            return {
                ok: false,
                standDown: 'refused',
                detail: 'the embedding model identity is not a value this client writes into a batch'
            };
        }
        const run = (deps.runBatch || runBatch)(config, batch, { budgetMs: callMs, procedure });
        if (!run.ok) {
            // A refusal is handed on as a whole sentence, standDownText's
            // contract for that word: the server answered this batch and what it
            // said is the remedy, where an outage is a host to wait for.
            return run.cause === 'refused'
                ? {
                    ok: false,
                    standDown: 'refused',
                    detail: 'the memory database refused this query: ' + run.detail
                }
                : { ok: false, standDown: 'unreachable', detail: run.detail };
        }
        lists.push(queryRows(run).map((row) => queryHit(row, procedure)).filter((h) => h !== null));
    }
    return { ok: true, lists };
}

// ------------------------------------------------------------- the curator --

// The config as the curator presents it, or the one refusal a curator verb has
// of its own.
//
// The curator is a second login on the same host and database, so the
// connection it makes differs from a publisher's in the credential alone: the
// same server, the same database, the same clocks, the same child environment
// with the password in SQLCMDPASSWORD. It is never Windows authentication,
// because the curator role is a SQL login the installer creates, and a config
// under windowsAuth holds no curator at all. A machine whose config carries no
// pair is an ordinary publisher, and the refusal names the two fields so the
// remedy is the config rather than the host.
function curatorConfig(loaded) {
    if (!loaded.ok) {
        return { ok: false, standDown: loaded.reason, detail: loaded.detail, path: loaded.path };
    }
    // A config loadConfig read carries the key as null where no pair was given;
    // one a caller handed in whole may not carry it at all, and that is the
    // same absence.
    if (!loaded.config.curator) {
        return {
            ok: false,
            standDown: 'curator',
            detail: 'no curator login is configured in ' + loaded.path
                + ' (curatorLogin and curatorPassword are absent), and this verb runs under'
                + ' the curator role alone'
        };
    }
    return {
        ok: true,
        path: loaded.path,
        config: {
            ...loaded.config,
            login: loaded.config.curator.login,
            password: loaded.config.curator.password,
            windowsAuth: false
        }
    };
}

// One procedure call under the curator, as {ok, rows} or a stand-down, on the
// run's deadline and the call's own clock the query side keeps.
//
// A refusal is handed on as a whole sentence with the server's own words
// inside it, standDownText's contract for that word. Every refusal a curator
// procedure raises is a sentence the procedure composed for a person to read,
// the role check and the identity that matched no row among them, and those
// words are the whole remedy: paraphrased they would name the wrong thing.
function curatorCall(config, procedure, parameters, options) {
    const opts = options || {};
    const deps = opts.deps || {};
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const callMs = callBudget(opts.deadline, now(), config.timeoutMs, SQLCMD_FLOOR_MS);
    if (callMs === null) {
        return {
            ok: false,
            standDown: 'budget',
            detail: 'the ' + opts.budgetMs + ' ms this verb may spend was gone before a '
                + procedure + ' call'
        };
    }
    const run = callProcedure(config, procedure, parameters, { deps, budgetMs: callMs });
    if (!run.ok) {
        return run.cause === 'refused'
            ? {
                ok: false,
                standDown: 'refused',
                // The role rides on the sentence because the host's own refusal
                // names an object rather than a role: a publisher login is denied
                // EXECUTE on the procedure outright (010-Roles.sql), so it never
                // reaches the procedure's own mem_curator check and the server
                // text it gets is Msg 229 naming the object.
                detail: 'this verb runs under the mem_curator role, and the memory database refused this '
                    + procedure + ' call: ' + run.detail
            }
            : { ok: false, standDown: 'unreachable', detail: run.detail };
    }
    return { ok: true, rows: run.rows };
}

// The whole of `memq db-promote`: one private record flipped to shared through
// mem.usp_PromoteRecord, as {ok, record} or a stand-down.
//
// The record is named by its identity on the host, which is the sandbox that
// owns it, its tier and segment, and its name, exactly as the procedure takes
// them. Nothing here resolves that identity against a file: the promote is a
// fact about the host's rows, and a record this machine's store no longer
// holds is still the host's to flip.
function promoteRecord(options) {
    const opts = options || {};
    const loaded = curatorConfig(opts.config
        ? { ok: true, config: opts.config, path: opts.configPath }
        : loadConfig(opts.configPath));
    if (!loaded.ok) return loaded;
    const config = loaded.config;
    const deps = opts.deps || {};
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : config.timeoutMs;
    const deadline = now() + budgetMs;
    const call = curatorCall(config, 'usp_PromoteRecord', {
        '@p_SandboxName': String(opts.sandbox),
        '@p_Segment': String(opts.segment),
        '@p_Name': String(opts.name),
        '@p_Tier': String(opts.tier)
    }, { deps, deadline, budgetMs });
    if (!call.ok) return call;
    const record = counted(call.rows);
    return { ok: true, record: { recordId: record.recordId, name: record.name, visibility: record.visibility } };
}

// The three curation queries, by the flag that asks for each: the procedure
// and the parameters it takes.
const CURATION_QUERIES = {
    unapplied: { procedure: 'usp_CurationUnapplied', parameters: (days) => ({ '@p_Days': days }) },
    superseded: { procedure: 'usp_CurationSupersededLive', parameters: () => ({}) },
    orphans: { procedure: 'usp_CurationOrphans', parameters: () => ({}) }
};

// The whole of `memq db-curate`: each query the caller asked for, run under the
// curator, as {ok, answers} or a stand-down.
//
// `asked` names the queries in the order they run, and `unappliedDays` is the
// window the first one takes. Each answer is the procedure's own JSON value,
// an array for the first two and the two-list object for the third, and it is
// handed back unshaped: the lines a person reads are the CLI's to compose, in
// the store's own line shape, and this module states nothing about how a row
// prints.
//
// The run's deadline funds one configured timeout per query rather than one
// for the run, since the queries are independent calls and a slow first one is
// no reason to starve the third. An outage stops the run where it stands, the
// drain's rule: the next call would spend a whole spawn's clock discovering the
// same silence. A refusal is a fact about one procedure and stops the run too,
// because every one of these procedures refuses on the same ground, the
// caller's role, and a second call would draw the same sentence.
function curate(options) {
    const opts = options || {};
    const loaded = curatorConfig(opts.config
        ? { ok: true, config: opts.config, path: opts.configPath }
        : loadConfig(opts.configPath));
    if (!loaded.ok) return loaded;
    const config = loaded.config;
    const deps = opts.deps || {};
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const asked = (Array.isArray(opts.asked) ? opts.asked : []).filter((k) => k in CURATION_QUERIES);
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : config.timeoutMs * asked.length;
    const deadline = now() + budgetMs;
    const answers = {};
    for (const key of asked) {
        const query = CURATION_QUERIES[key];
        const call = curatorCall(config, query.procedure, query.parameters(opts.unappliedDays),
            { deps, deadline, budgetMs });
        if (!call.ok) return call;
        answers[key] = counted(call.rows);
    }
    return { ok: true, answers };
}

// The doctor's reading of the host: mem.usp_Health under the config's own
// publisher login, plus the local queue's depth, as one object the doctor step
// prints its verdict from.
//
// {ok: true, health, queueDepth, path} where the host answered, and a stand-down
// with the same queueDepth beside it where it did not, since a queue that is
// filling is worth reporting whatever the host is doing. queueDepth is null
// where the queue could not be counted, never zero: a zero there would report a
// full queue as an empty one. A queue file that does not exist is an empty
// queue and is not created to be counted, since the doctor reports on the
// store and writes nothing into it. The queue file is named from the store root
// the caller passes rather than resolved here, because the doctor is the caller
// and the store root is the one path it already knows.
function hostHealth(options) {
    const opts = options || {};
    const loaded = opts.config
        ? { ok: true, config: opts.config, path: opts.configPath }
        : loadConfig(opts.configPath);
    const queueFile = typeof opts.storeRoot === 'string' && opts.storeRoot !== ''
        ? path.join(opts.storeRoot, QUEUE_FILE) : queuePath();
    const queueDepthValue = fs.existsSync(queueFile) ? queueDepth(queueFile) : 0;
    if (!loaded.ok) {
        return {
            ok: false, standDown: loaded.reason, detail: loaded.detail, path: loaded.path,
            queueDepth: queueDepthValue
        };
    }
    const config = loaded.config;
    const deps = opts.deps || {};
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : queryBudgetMs(config);
    const deadline = now() + budgetMs;
    const callMs = callBudget(deadline, now(), config.timeoutMs, SQLCMD_FLOOR_MS);
    const run = callProcedure(config, 'usp_Health', { '@p_ModelIdentity': modelIdentity(config) },
        { deps, budgetMs: callMs });
    if (!run.ok) {
        return {
            ok: false,
            standDown: run.cause === 'refused' ? 'refused' : 'unreachable',
            detail: run.cause === 'refused'
                ? 'the memory database refused this usp_Health call: ' + run.detail : run.detail,
            path: loaded.path,
            queueDepth: queueDepthValue
        };
    }
    return { ok: true, health: counted(run.rows), queueDepth: queueDepthValue, path: loaded.path };
}

// ---------------------------------------------------------------- chunking --

// A body as ordered chunks, each {text, offset, length}, or a refusal.
//
// Paragraphs are the split, because a paragraph is where a memory changes
// subject and a chunk that spans two subjects matches both weakly. Paragraphs
// accumulate until the target is reached; one paragraph longer than the ceiling
// is cut at the target through safeCut, which backs a cut off a surrogate pair
// and prefers the last whitespace in a short window before it, since a body with
// no paragraph break at all is still a body worth finding. Every offset is into
// the body as it stands, so a chunk's own text can be located in the record a
// reader opens.
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

// ----------------------------------------------------------------- the queue --

// The local queue's one table, and the SQL over it.
//
// A row is one stamp or one outcome the host has not taken yet: `id` is the
// stamp id its writer generated, which is also the value the host's own unique
// index dedupes on, `kind` says which append procedure it is bound for, and
// `payload` is the JSON that procedure reads, exactly as the writer composed it.
//
// A ROW IS WELL FORMED OR IT DOES NOT EXIST, WHICH IS THE WHOLE REASON THIS IS A
// DATABASE. A writer inserts one row inside one statement, so there is no torn
// write to detect, no half-line to keep and nothing to put back: the states a
// file-backed queue spent its code on cannot arise here. What is left is the two
// states SQLite itself answers, a lock another connection holds and a file the
// disk will not take, and each has one answer below.
const QUEUE_TABLE = 'queue';
const QUEUE_SCHEMA = 'CREATE TABLE IF NOT EXISTS ' + QUEUE_TABLE + ' ('
    + 'id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)';

// The queue, opened and created if it is not there. It throws, because every
// caller below has its own answer for a queue it could not open and none of them
// is the same answer.
//
// WAL is what lets a writer and a reader hold the file at once, so an
// interactive stamp is never blocked by a publish that is reading rows, and the
// busy timeout is what a writer meeting a held write lock waits out rather than
// failing on. The two together are this module's whole concurrency story: there
// is no lock file, no staleness arithmetic and no break.
//
// NOTHING THROWS OUT OF HERE STILL HOLDING THE FILE. The connection opens before
// either statement runs, and a file that is not a database at all fails on the
// first of them rather than at the open, so an open left to the garbage collector
// would hold that file for the life of the process. On Windows that is a store
// directory nothing can remove and a path nothing can replace, which turns one
// unreadable queue into a machine that cannot be repaired without a restart.
// The busy wait is the caller's, defaulting to the full one. A caller on a
// budget passes QUEUE_BUSY_TIMEOUT_QUICK_MS instead, which is the whole of the
// difference between the two paths: the connection, the mode and the schema are
// the same on either.
function openQueue(file, options) {
    const opts = options || {};
    const target = (typeof file === 'string' && file !== '') ? file : queuePath();
    const busyMs = Number.isFinite(opts.busyTimeoutMs) ? opts.busyTimeoutMs : QUEUE_BUSY_TIMEOUT_MS;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const handle = new DatabaseSync(target, { timeout: busyMs });
    try {
        handle.exec('PRAGMA journal_mode = WAL');
        handle.exec(QUEUE_SCHEMA);
    } catch (err) {
        closeQueue(handle);
        throw err;
    }
    return handle;
}

// A handle given back, never left to the garbage collector. An open connection
// holds the file and its two sidecars on Windows, so a caller that dropped one
// would leave a store directory nothing could remove and a lock nothing could
// take.
function closeQueue(handle) {
    if (handle === null) return;
    try { handle.close(); } catch { /* a connection that will not close costs this process a handle and the caller nothing */ }
}

// Whether a database error is a lock somebody else holds rather than a fault.
//
// A BUSY MACHINE AND A BROKEN ONE SEND A READER TWO WAYS. The busy one resolves
// itself on the next run, and a reader told to go and look at the disk over one
// is sent after a fault that is not there; the broken one resolves itself never.
// SQLite's own result code is what tells them apart, read off the error object
// rather than matched in its text, since the text is the library's to reword.
//
// The code is masked to its primary byte, for the reason SQLITE_CODE_MASK
// states: every extended busy code carries SQLITE_BUSY in that byte, and the
// two this library reports for a lock met during recovery or on a snapshot
// carry nothing else that changes the answer.
function queueBusy(err) {
    return Boolean(err) && (Number(err.errcode) & SQLITE_CODE_MASK) === SQLITE_BUSY;
}

// How many rows the queue holds, or null where no count could be taken.
//
// It is the reading that says the queue is not emptying, so a file no
// connection can open carries null rather than zero: a zero there would tell a
// reader, and any later step that scrapes the number, that a full queue is
// empty.
function queueDepth(file, options) {
    let handle = null;
    try {
        handle = openQueue(file, options);
        return depthOf(handle);
    } catch {
        return null;
    } finally {
        closeQueue(handle);
    }
}

function depthOf(handle) {
    try {
        return Number(handle.prepare('SELECT COUNT(*) AS depth FROM ' + QUEUE_TABLE).get().depth);
    } catch {
        return null;
    }
}

// Whether a value is text the append procedures read as present, which is what
// their own NULLIF over a trimmed value answers: a blank string reaches them as
// a null.
function filled(value) {
    return typeof value === 'string' && value.trim() !== '';
}

// Why a row cannot be sent, or null where it can.
//
// ONE UNSENDABLE ROW ON THE QUEUE IS A QUEUE THAT NEVER EMPTIES. The drain sends
// every row of a kind in one call, and both append procedures throw over the
// whole batch on a row missing what they require: mem.usp_AppendUsage on a kind
// that is not read or applied and on an absent or unreadable timestamp,
// mem.usp_AppendOutcomes on a blank segment, a blank action key or the same
// timestamp. So the batch is refused, nothing is deleted, and every later drain
// rebuilds the same batch around the same row for as long as it stands. The
// screen is at the writer because that is the one place the row can still be
// turned away with its author present: deliver and this are exported and take
// any entry a caller composes.
//
// It names the field rather than quoting its value. A stamp's own text is the
// caller's and reaches a person's screen through the sentence the interactive
// verbs print, and what a reader has to act on is which field the row is missing.
//
// The stamp id is this file's requirement rather than a procedure's. It is the
// row's primary key here, so a row without one is a row this table cannot hold:
// two of them collide on the literal text of the absent value and the second
// insert fails the whole call.
//
// The timestamp screen is the one stamped() states, which is DATETIMEOFFSET's
// own range rather than this runtime's reading of a date.
function unsendable(entry) {
    if (entry === null || typeof entry !== 'object') {
        return 'the row is not an object, so no procedure can read it';
    }
    if (!filled(entry.stampId)) {
        return 'the row carries no stamp id, which is its own key on the queue and the identity '
            + 'the host dedupes a resend by';
    }
    if (!stamped(entry.at)) {
        return 'the row\'s `at` is not a timestamp the host\'s DATETIMEOFFSET column takes, and a '
            + 'batch carrying one is refused whole';
    }
    // The queue's own column, and the fold every writer's `type` takes on the way
    // into it: anything that is not an outcome is bound for the usage procedure.
    if (entry.type === 'outcome') {
        if (!filled(entry.segment)) return 'the outcome names no segment, which is the store it belongs to';
        if (!filled(entry.actionKey)) return 'the outcome names no action key';
        return null;
    }
    const kind = filled(entry.kind) ? entry.kind.trim().toLowerCase() : '';
    if (kind !== 'read' && kind !== 'applied') {
        return 'the stamp\'s kind is neither read nor applied';
    }
    return null;
}

// Put one stamp or outcome on the queue, as {ok} or {ok: false, detail}, with
// `refused` set where the row itself is the defect rather than the file.
//
// THE FILE-SIDE WRITE IS THE CALLER'S AND HAS ALREADY HAPPENED. usage.jsonl or
// outcomes.jsonl holds the line before this is called, so a row that never
// lands costs the host's copy of one stamp and nothing on this machine. The
// answer is handed back rather than swallowed, and the caller is what says so:
// an interactive verb prints one sentence and still exits zero, while the
// read-stamp hook, which has no standard error a person reads, says nothing.
//
// One statement per entry, with every value bound rather than spelled into the
// text. The id is the stamp id the writer generated, so a row resent after an
// ambiguous outcome carries the same identity the host's unique index refuses
// twice.
function queueInsert(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return { ok: true };
    // The screen, ahead of the open, so a refused row never reaches the file and
    // the call costs no connection at all. Nothing is written for any of them: a
    // caller writes one row at a time, and a batch carrying one bad row is a
    // caller to fix rather than a batch to sort.
    for (const entry of entries) {
        const why = unsendable(entry);
        if (why !== null) {
            return {
                ok: false,
                refused: true,
                detail: why + ', so it was not written to the queue: the memory database refuses a '
                    + 'batch carrying it and the queue would then stop emptying'
            };
        }
    }
    let handle = null;
    try {
        // The quick busy wait, for the reason QUEUE_BUSY_TIMEOUT_QUICK_MS states:
        // every caller here is an interactive stamp or the read-stamp hook, whose
        // whole budget is a fraction of the full wait and whose row is a derived
        // copy of a line already on disk.
        handle = openQueue(undefined, { busyTimeoutMs: QUEUE_BUSY_TIMEOUT_QUICK_MS });
        const statement = handle.prepare('INSERT INTO ' + QUEUE_TABLE
            + ' (id, kind, payload, created_at) VALUES (?, ?, ?, ?)');
        for (const entry of entries) {
            // `type` is how a writer says which procedure the row is bound for,
            // and the column is where that lives from here on, so it is taken
            // off the payload rather than sent to a procedure that does not
            // name it.
            const { type, ...row } = entry;
            statement.run(String(entry.stampId), type === 'outcome' ? 'outcome' : 'usage',
                JSON.stringify(row), new Date().toISOString());
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, detail: errText(err) };
    } finally {
        closeQueue(handle);
    }
}

// The timestamp shape every stamp writer here produces and DATETIMEOFFSET
// reads: an ISO 8601 date and time, with optional fractional seconds and an
// optional zone offset.
//
// Date.parse alone is not that screen. It rolls February 30th into March,
// accepts hour 24 as the next midnight and takes a zone offset of any size at
// all, every one of which DATETIMEOFFSET refuses, so the calendar day, the hour
// and the offset are checked against what the type takes rather than against
// what this runtime will make of them.
//
// The offset the type holds runs from -14:00 to +14:00. That range belongs to
// DATETIMEOFFSET itself, where it is the column type's own documented bound
// rather than anything this client decides or the shape of the text implies:
// fourteen hours either way is taken, one minute past it in either direction is
// not, and at the fourteenth hour the minutes must be zero.
const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?(?:Z|[+-](\d{2}):(\d{2}))?$/;
const OFFSET_MAX_HOURS = 14;
function stamped(value) {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    const parts = TIMESTAMP_RE.exec(text);
    if (parts === null || !Number.isFinite(Date.parse(text))) return false;
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    if (year < 1 || month < 1 || month > 12 || Number(parts[4]) > 23) return false;
    if (parts[7] !== undefined) {
        const offsetHours = Number(parts[7]);
        const offsetMinutes = Number(parts[8]);
        if (offsetHours > OFFSET_MAX_HOURS || offsetMinutes > 59) return false;
        if (offsetHours === OFFSET_MAX_HOURS && offsetMinutes !== 0) return false;
    }
    // Day zero of the following month is the last day of this one, which is what
    // makes the leap year the calendar's answer rather than this client's.
    return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// A record file's modification time as mem.usp_UpsertRecords reads it, or null
// where this machine's filesystem handed back a time that type will not take.
//
// THE SCREEN IS THE ONE ABOVE, AND WHAT IT CLOSES IS A RUN THAT NEVER PUBLISHES
// AGAIN. The procedure reads this field as a DATETIMEOFFSET and throws over the
// whole batch when it cannot, and the walk re-derives every record from the
// files on every run, so one file whose time renders outside that type's range
// would fail every record batch on every run for as long as that file stood, and
// the publish would stand down with none of its legs reached. A time this
// runtime cannot represent at all is worse still: toISOString throws a
// RangeError, which is nothing this leg catches.
//
// Null is what the column takes for a record whose time is unknown. It is
// nullable, the procedure's own refusal check does not name it, and the
// comparison that skips an older copy requires a time on both sides, so a record
// that arrives with none is upserted and never skipped as older.
function fileModifiedAt(mtimeMs) {
    let rendered = null;
    try {
        rendered = new Date(mtimeMs).toISOString();
    } catch {
        return null;
    }
    return stamped(rendered) ? rendered : null;
}

// The sentence a refusal takes, wherever in this client one is met.
//
// A REFUSAL AND AN OUTAGE SEND A READER TWO WAYS, AND ONE OF THEM IS NEVER
// RESOLVED BY WAITING. The transport tells the two apart on the envelope the
// server's own message arrives in, and every leg that meets a refusal owes the
// same three things: the server's own words, which are the part no reader can
// reconstruct, in front; that this is a defect in what the client sends rather
// than a host to come back to; and what the run left behind. Spelled once, so
// the legs cannot come to describe one state in four voices.
function refusedText(what, procedure, detail, left) {
    return 'the memory database refused ' + what + ' sent to mem.' + procedure + ' and said: '
        + detail + '. That is a defect in what this client sends rather than a host to wait for, and '
        + left;
}

// Send everything on the queue to the host, and delete exactly the rows it sent.
//
// The drain is the minimal form and nothing else. It selects the rows, sends
// every usage row in one call and every outcome row in one more, and on full
// success deletes those ids. There is no rotation, no file aside, no per-row
// put-back, no leftover pass and no batching.
//
// A ROW WRITTEN WHILE A SEND IS IN FLIGHT SURVIVES BY CONSTRUCTION. The delete
// names the ids the select returned, so a row inserted behind it is addressed by
// nothing this drain does. That is what the whole delete-by-id shape buys, and
// it is why no lock is held across a call to the host: an interactive stamp
// waits on nothing here.
//
// WHAT MAKES A RESEND SAFE IS THE SERVER, NOT THIS CODE. Every row carries the
// stamp id its writer generated, mem.Usage and mem.Outcome each hold a unique
// index over that column, and each append procedure inserts only the ids its
// table does not already hold. A row sent twice therefore inserts once. So a
// drain that cannot tell what landed does not have to: it deletes nothing and
// the next run sends the lot again.
//
// On any refusal or transport failure nothing is deleted and the server's own
// words go out on the publish summary, which is a surface a person reads. The
// queue then grows until somebody repairs the contract, and that growth is the
// signal. A refusal and an outage are told apart before either is reported, on
// the `cause` the transport answers with rather than on the bare false the two
// share: a refusal names a defect and asks for a fix, while an outage asks for
// nothing but the next run, and a host that blinks once would otherwise open a
// defect that is not there. Where the two cannot be told apart the transport
// answers outage, because over-reporting the defect is the failure this split
// exists to prevent.
//
// An outage stops the drain where it stands, the second procedure included,
// since that call would spend a whole spawn's clock discovering the same
// silence. A refusal stops nothing: it is a fact about one procedure's rows and
// the other procedure's still go, and nothing is deleted either way.
//
// A row the procedure takes the batch for and then declines is counted rather
// than kept. mem.usp_AppendUsage answers {appended, rejected, skipped}, the
// rejected count being the stamps whose record it could not resolve, and it
// answers in counts rather than identities, so which row it declined cannot be
// known here. Those rows go with the rest, because usage.jsonl holds every one
// of them on this machine and what is lost is the host's copy. The count rides
// out to the publish summary and onto the verb's own line, which is what makes
// that loss reported rather than silent. `skipped` is the index absorbing a
// resend and is the mechanism working, so nothing here reports it.
//
// WHAT IS REPORTED DRAINED IS WHAT LEFT THE QUEUE, NEVER WHAT WAS SENT. The two
// part whenever the delete is not reached, which is any refusal, any outage and
// a queue that would not take the delete: `drained` is then zero while
// `remaining` carries what the queue still holds. A drain that counted its sends
// instead would print the same success on every run of a queue that never
// empties, which is exactly the state a reader is watching that number to catch.
//
// `remaining` is null only where no count is knowable: the version gate refusing
// ahead of the read, and a queue no connection could open or count. A zero there
// would report a full queue as an empty one.
//
// Nothing is sent at all to a host below REQUIRED_SCHEMA_VERSION, whose
// procedures take the same call and ignore the stamp id in it. That is a loud
// report rather than an outage: the host is up and answering, and a reader told
// to wait would be waiting for something no amount of time resolves.
function drainQueue(config, options) {
    const opts = options || {};
    // The version gate, ahead of the open and the read, since a drain that will
    // send nothing has no reason to touch the file. The number is the caller's,
    // read from mem.usp_Health on the run's own probe, and a host answering no
    // version at all is no evidence of a host that has one.
    const hostSchema = Number(opts.schemaVersion);
    if (!(Number.isFinite(hostSchema) && hostSchema >= REQUIRED_SCHEMA_VERSION)) {
        const found = Number.isFinite(hostSchema) ? 'schema version ' + hostSchema : 'no schema version at all';
        return {
            ok: false,
            contended: false,
            cause: 'schema',
            drained: 0,
            remaining: null,
            rejected: 0,
            detail: 'the memory database reports ' + found + ' where this client requires version '
                + REQUIRED_SCHEMA_VERSION + ', whose stamp id indexes are what make a resent row '
                + 'insert once, so nothing was sent and the queue at ' + queuePath() + ' is left '
                + 'whole. Re-run plugins/claude-kit/db/Install-MemoryDatabase.ps1 against the host '
                + 'to apply the newer scripts'
        };
    }
    const live = queuePath();
    let handle = null;
    let rows = null;
    try {
        handle = openQueue(live);
        rows = handle.prepare('SELECT id, kind, payload FROM ' + QUEUE_TABLE
            + ' ORDER BY created_at, id').all();
    } catch (err) {
        // A file no connection could open or read. A lock is the busy machine
        // and everything else is the disk, and neither is a host to go and look
        // at: nothing was asked of it.
        closeQueue(handle);
        const busy = queueBusy(err);
        return {
            ok: false,
            contended: busy,
            cause: busy ? 'contended' : 'unreadable',
            drained: 0,
            // A depth taken on the quick wait, since this path has already spent
            // the full one discovering the holder will not let go. A second
            // connection on the full timeout would spend it again and answer
            // null anyway.
            remaining: busy ? queueDepth(live, { busyTimeoutMs: QUEUE_BUSY_TIMEOUT_QUICK_MS }) : null,
            rejected: 0,
            detail: busy
                ? 'the queue at ' + live + ' is locked by another writer, so nothing was sent from it '
                    + 'and every row in it is still there for the next run'
                : 'the queue at ' + live + ' could not be read, so nothing was sent from it and '
                    + 'every row in it is still there: ' + errText(err)
        };
    }
    try {
        const usage = [];
        const outcomes = [];
        const ids = [];
        // THE PARSE CARRIES ITS OWN CATCH, AND IT IS THE ONLY THING 'unreadable'
        // MAY BE SAID OF. The payload is the JSON one writer composed inside one
        // statement, so a row this throws on is a file somebody other than this
        // module has been writing, and that reading sends a reader to the queue
        // file. A catch wrapped around the send loop as well would say the same
        // thing of a transport fault or a spent budget, sending that reader to a
        // file with nothing wrong in it.
        try {
            for (const row of rows) {
                ids.push(row.id);
                (row.kind === 'outcome' ? outcomes : usage).push(JSON.parse(String(row.payload)));
            }
        } catch (err) {
            // Nothing is sent and nothing is deleted, so a person can look at the
            // file with every row still on it.
            return {
                ok: false,
                contended: false,
                cause: 'unreadable',
                drained: 0,
                remaining: depthOf(handle),
                rejected: 0,
                detail: 'the queue at ' + live + ' holds a row this client could not read, so nothing '
                    + 'was sent from it and every row in it is still there: ' + errText(err)
            };
        }

        // What one call may spend. Each takes its clock from what is left of the
        // run's deadline, which is the rule every boundary call in this module
        // follows: a call starts only while the deadline stands. A drain run
        // outside a publish carries no deadline and spends its own budget.
        const deps = opts.deps || {};
        const clock = (typeof deps.now === 'function') ? deps.now : Date.now;
        const wantMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : config.timeoutMs;
        const callClock = () => {
            // The caller's own want, which the payload never lifts: one call's
            // clock is bounded by the configured timeout whatever it carries.
            // The deadline still governs: a run's remaining budget outranks that
            // want, and a call asked for past the deadline is refused.
            const want = payloadCallMs(wantMs);
            return Number.isFinite(opts.deadline)
                ? callBudget(opts.deadline, clock(), want, SQLCMD_FLOOR_MS)
                : want;
        };

        const failures = [];
        const notes = [];
        let cause = null;
        let rejected = 0;
        const whole = 'the queue at ' + live + ' keeps every row, so the next run sends them all '
            + 'again and the stamp id on each one is what makes that insert once';

        // One procedure, one call, everything of that kind the read found.
        const send = (procedure, parameter, batch) => {
            if (batch.length === 0) return;
            const payloadChars = JSON.stringify(batch).length;
            const budgetMs = callClock();
            if (budgetMs === null) {
                cause = cause || 'budget';
                failures.push('the run budget was spent before mem.' + procedure + ' was called, so '
                    + whole);
                return;
            }
            // A payload past what one call's clock funds, named rather than
            // funded. The server rebuilds the batch's variable on every piece of
            // it, so the work grows with the square of the piece count while this
            // clock does not grow at all, and a call killed on that clock is
            // killed again on every later run, since nothing is deleted. What to
            // do about it is the operator's: raise the configured timeout, or
            // look at a queue that has grown past what one call can carry. This
            // client will not lift one call past the timeout it was configured
            // with, so what it owes is the size and the clock in one sentence.
            if (payloadChars > PAYLOAD_FUNDED_CHARS) {
                notes.push('the ' + batch.length + ' row(s) bound for mem.' + procedure + ' are '
                    + payloadChars + ' characters of payload, past the ' + PAYLOAD_FUNDED_CHARS
                    + ' characters one call funds, while the clock for that call is ' + budgetMs
                    + ' ms and is bounded by the configured timeout. A call that does not finish '
                    + 'inside it is killed on it every run, and the queue at ' + live + ' then '
                    + 'stops emptying');
            }
            const sent = callProcedure(config, procedure, { [parameter]: batch },
                { ...opts, budgetMs });
            if (sent.ok) {
                rejected += Number(counted(sent.rows).rejected) || 0;
                return;
            }
            // A cause this client did not set reads as an outage, the
            // conservative side: a defect reported against a host that was
            // merely away is the failure this split exists to prevent.
            //
            // THE SERVER'S OWN WORDS COME FIRST, AND THIS CLIENT'S BOILERPLATE
            // AFTER THEM. Every surface that prints one of these sentences caps
            // it, and a cut takes the tail, so the clause that survives a cut is
            // whichever one is in front. What the server said is the only part
            // no reader can reconstruct; what this client was left holding is
            // the same sentence on every failure and is in the drain's cause
            // word besides.
            if (sent.cause === 'refused') {
                cause = 'refused';
                failures.push(refusedText('the ' + batch.length + ' row(s)', procedure, sent.detail, whole));
                return;
            }
            cause = cause === 'refused' ? cause : 'outage';
            failures.push('the memory database did not answer mem.' + procedure
                + ' and the transport said: ' + sent.detail + '. So ' + whole);
        };

        send('usp_AppendUsage', '@p_Usage', usage);
        if (cause !== 'outage' && cause !== 'budget') {
            send('usp_AppendOutcomes', '@p_Outcomes', outcomes);
        }

        // Delete only on full success. A row the host may or may not hold stays
        // on the queue, which is the one disposition that cannot lose a stamp.
        if (failures.length > 0) {
            return {
                ok: false,
                contended: false,
                cause,
                drained: 0,
                remaining: depthOf(handle),
                rejected,
                detail: failures.concat(notes).join('; ')
            };
        }
        const removed = deleteRows(handle, ids);
        if (!removed.ok) {
            // The delete refused, which is reported for its own sake. Rows the
            // host holds and this queue still carries cost a resend the stamp id
            // absorbs; a queue that cannot be written to at all is a machine to
            // look at, and a lock another writer holds is neither.
            return {
                ok: false,
                contended: removed.contended,
                cause: removed.contended ? 'contended' : 'unclearable',
                drained: 0,
                remaining: depthOf(handle),
                rejected,
                detail: ['the memory database took every row but the ' + ids.length + ' row(s) it took '
                    + 'could not be removed from the queue at ' + live + ', so it still holds them: '
                    + removed.detail].concat(notes).join('; ')
            };
        }
        // WHAT IS REPORTED DRAINED IS WHAT LEFT THE QUEUE. The rows the read
        // found are off it now, and `remaining` is what the delete left, which is
        // whatever arrived behind the read. Those rows are ordinary and ride out
        // as that number and nothing else, since every row this drain set out to
        // deliver was delivered and the next drain takes the rest.
        const drained = { ok: true, drained: ids.length, remaining: depthOf(handle), rejected };
        if (notes.length > 0) {
            // The one condition worth a word on a run that otherwise went
            // perfectly: the payload is past what a call's clock funds, so the
            // next run of a queue this size may not get through at all.
            drained.cause = 'oversized';
            drained.detail = notes.join('; ');
        }
        return drained;
    } catch (err) {
        // The backstop over the send path, which the parse above is deliberately
        // outside of. Everything left in here is a call to the host or the work
        // around one, so what a throw here says is that the host was not reached,
        // and it takes the disposition every other unreached host takes: wait for
        // the next run. Nothing is deleted, so the rows are all still there.
        return {
            ok: false,
            contended: false,
            cause: 'outage',
            drained: 0,
            remaining: depthOf(handle),
            rejected: 0,
            detail: 'the memory database could not be sent the queue at ' + live + ' and the transport '
                + 'said: ' + errText(err) + '. So every row in it is still there for the next run'
        };
    } finally {
        closeQueue(handle);
    }
}

// Take the delivered ids off the queue, as {ok} or {ok: false, contended,
// detail}.
//
// ONE TRANSACTION, SO THE DELETE IS ALL OF THEM OR NONE. A delete cut short
// halfway would leave a queue holding some of what the host took and no record
// of which, and the next run would send the remainder again for no reason. The
// stamp id makes that resend harmless, so what the transaction buys is a count a
// reader can believe rather than a row that cannot be lost.
//
// BEGIN IMMEDIATE takes the write lock up front rather than on the first delete,
// which is what makes the busy timeout the whole of the waiting: a transaction
// that discovered the lock partway through would have to be given back and
// retried, which is the arithmetic this design exists to be rid of.
// An empty id set takes no lock at all. A drain of an empty queue has nothing to
// remove, and a transaction opened to remove nothing would wait the whole busy
// timeout out against a held write lock and then answer that the rows it took
// could not be removed, which of no rows at all is not true.
function deleteRows(handle, ids) {
    if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
    try {
        handle.exec('BEGIN IMMEDIATE');
    } catch (err) {
        return { ok: false, contended: queueBusy(err), detail: errText(err) };
    }
    try {
        const statement = handle.prepare('DELETE FROM ' + QUEUE_TABLE + ' WHERE id = ?');
        for (const id of ids) statement.run(id);
        handle.exec('COMMIT');
        return { ok: true };
    } catch (err) {
        try { handle.exec('ROLLBACK'); } catch { /* a transaction the connection closes rolls back anyway */ }
        return { ok: false, contended: queueBusy(err), detail: errText(err) };
    }
}

// ------------------------------------------------------- the stamp writers --

// Take one usage stamp or outcome for the shared index, which on the
// interactive path means writing one row to the local queue.
//
// The answer is {delivered, queued, reason}, and on a queue write that failed it
// carries `detail` besides. `reason` is the state: `queued` where the row
// landed, `refused` where the row is one the host's append procedures would
// refuse a whole batch over, `unwritable` where the file would not take it, and
// the config's own refusal word or `redirected` where nothing was attempted.
//
// THE FILE-SIDE WRITE IS THE CALLER'S AND HAPPENS WHATEVER THIS ANSWERS. This
// is called after usage.jsonl or outcomes.jsonl already holds the line, so the
// local record is complete on every path through here. What a failed queue write
// costs is the host's copy of one stamp, which is why the caller prints a
// sentence and carries on rather than failing.
//
// With no config there is no host on this machine: nothing is written, since a
// queue that filled on a machine with no database would grow without bound and
// drain nowhere.
//
// NO DATABASE CALL IS MADE HERE, AND THAT IS THE POINT. A stamp is worth a few
// hundred milliseconds of a session's time and no more, and a few hundred
// milliseconds does not fund a cold sqlcmd start plus a TLS negotiation plus a
// login: on a healthy host that attempt is killed on nearly every stamp and the
// row goes to the queue regardless, having first spent the session's time. So
// every interactive stamp is queued and `memq db-sync` delivers it in one
// batched call, which is the same journey with the latency removed. A stamp's
// whole worth here is that it is not lost, and the queue is what makes it not
// lost.
//
// A redirected store writes nothing either, for the reason isDefaultStoreRoot
// states: every publish leg refuses a non-default root, so a queue filling
// under one grows without bound and drains nowhere, which is the same shape as
// a machine with no database at all.
function deliver(entry, options) {
    const opts = options || {};
    const loaded = opts.config ? { ok: true, config: opts.config } : loadConfig(opts.configPath);
    if (!loaded.ok) return { delivered: false, queued: false, reason: loaded.reason };
    if (!isDefaultStoreRoot()) return { delivered: false, queued: false, reason: 'redirected' };
    const written = queueInsert([entry]);
    if (written.ok) return { delivered: false, queued: true, reason: 'queued' };
    // A row the append procedures would refuse is a defect in what this client
    // composed, which is the module's own `refused` rather than a file that would
    // not take a write. Both are reported the same way and neither fails the
    // verb; what parts them is where a reader goes to fix it.
    if (written.refused) return { delivered: false, queued: false, reason: 'refused', detail: written.detail };
    return { delivered: false, queued: false, reason: 'unwritable', detail: written.detail };
}

// The identity a queue row carries so the server can tell a resend from a new
// row. Every append procedure holds a unique index over this value and inserts
// only the ids its table does not already hold, which is what makes a row sent
// twice insert once and what lets a drain delete nothing rather than having to
// be right about what landed. It is generated where the row is written, so the
// same stamp resent from the same row carries the same id forever.
function stampId() {
    return crypto.randomUUID();
}

// The identity a usage stamp names its record by: the store's own tier, the
// segment that tier is keyed by, and the file key the sidecar records. It is
// the identity form mem.usp_AppendUsage accepts beside a record id, and the
// procedure resolves it against the records the caller may see, rejecting and
// counting a stamp that resolves to none rather than writing it. That is why a
// publish drains the queue behind its record upsert: by then the record this
// names has been published, and a stamp still resolving to nothing names a
// record the host does not hold at all.
function usageEntry(tier, segment, name, fileKey, kind) {
    return {
        type: 'usage',
        tier,
        segment: segment === undefined ? null : segment,
        name,
        fileKey,
        kind,
        at: new Date().toISOString(),
        sessionId: null,
        stampId: stampId()
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
        at: entry.ts,
        stampId: stampId()
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
// pair is therefore reported and neither half is sent, since neither is more
// the record than the other and picking one silently would hide a state the
// operator has to resolve in the store itself.
//
// It is reported on `duplicates` rather than on `failed`, which carries only
// what the walk could not read. A publish reads `failed` as evidence that its
// reading of the store is incomplete and holds every removal back on it, and a
// twin is the opposite of that: both of its files were read, and the key they
// share is known to be backed by files on this machine.
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
            fileModified: fileModifiedAt(mtime),
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
    const duplicates = [];
    for (const [key, group] of byKey) {
        if (group.length === 1) continue;
        duplicateKeys.add(key);
        duplicates.push({
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
    return { records: kept, failed, duplicates, unscanned: walk.unscanned, duplicateKeys };
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

// One sentence of a publish run's error column, rendered for a channel that
// leaves this machine.
//
// THIS IS THE SAME RENDER THE PRINTED COPY TAKES, AND IT IS THE CHANNEL'S OWN
// RATHER THAN THIS CLIENT'S. The sentences on that column are composed around an
// absolute queue path, SQL Server's own message and an
// operating system's error text, the store sits under the home directory by
// default, and this value lands on a host every sandbox in the fleet reads. The
// same sentence goes to the screen through memq's db-sync failure line, so the
// two are one sentence rendered twice, once to a screen and once to the host. A
// render spelled separately in each module would be one edit away from a column
// that cut at some other point or kept a character the screen removes, storing
// text under a run that nobody ever read. So both callers take the one helper in
// kit-compact-lib, which states the four passes and why they are four.
//
// The cap stays here, because it is this channel's width and it sits beside the
// other widths this module spends. It is the same number memq gives one of these
// sentences, and the pin that compares the two renderings of one value byte for
// byte is what holds the pair together.
//
// The column's type is NVARCHAR(MAX), so nothing on the host bounds this value
// and the five-sentence slice plus this cap are the whole bound.
const COLUMN_TEXT_CAP = 1200;
function columnText(value) {
    return shownText(value, COLUMN_TEXT_CAP);
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
        embedded: 0, embedRejected: 0, drained: 0, queueRemaining: 0, rejected: 0,
        orphans: 0, failed: [], workFailed: false, partial: false,
        outOfBudget: false
    };

    // The two answers a run owes, and they are not the same question. `failed`
    // is everything a person should read, warnings included, and it is the one
    // list: the verb prints all of it, and the only other place any of it goes
    // is the publish run's error column, which carries the failing part of this
    // same list and composes no sentence of its own.
    // `workFailed` is whether something this run set out to do did not happen,
    // which is what the verb's exit code is. They part on a queue that grew past
    // what one call funds and on a queue another writer holds a lock on,
    // both of which are delivered work with something to say. A code taken from
    // the list's emptiness would report failure on either, and a verb that fails
    // on an ordinary busy run teaches its reader to ignore the code.
    //
    // `workFailures` is not a second surface and holds no sentence of its own:
    // every sentence in it is on the list above, and it is the part of that list
    // the run failed at, which is what the publish run's error column carries.
    // The column answers the exit code's question rather than the list's, since
    // a host-side reader treating a null error as a clean run would otherwise
    // read a failure on every busy or oversized publish, and a warning ahead of
    // a real failure in the list's order would otherwise push that failure past
    // the five sentences the column takes. The column's own type is
    // NVARCHAR(MAX), so that slice and this client's own cap on each sentence
    // are the only bound on it.
    const workFailures = [];
    const failure = (reason) => {
        summary.workFailed = true;
        summary.failed.push(reason);
        workFailures.push(reason);
    };

    // The run's one deadline, and the two things every boundary call below asks
    // of it: whether it may start at all, and what clock it gets if it does.
    //
    // The clock is the caller's own budget or what is left of the run's,
    // whichever is smaller, so the budget bounds the chain rather than each link
    // separately. A call refused for want of budget ends the run where it stands
    // and the summary reports what the run did: the records already published
    // are published, every leg of this publish is re-derived from the files on
    // the next run, and nothing here is queued, so stopping early costs a
    // repeat and never a row.
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const deadline = now() + RUN_BUDGET_MS;
    const budgetFor = (wantMs, floorMs) =>
        callBudget(deadline, now(), wantMs, floorMs === undefined ? SQLCMD_FLOOR_MS : floorMs);
    const stopped = (what) => {
        summary.outOfBudget = true;
        failure('the run budget of ' + RUN_BUDGET_MS
            + ' ms was spent before ' + what + ', so that call and everything after it was not made');
        return { ok: true, summary };
    };

    // The run's own row on the host, written once from wherever the run ends.
    //
    // EVERY LEG THAT STANDS THE RUN DOWN ON A REFUSAL REACHES IT TOO. A refusal
    // is a permanent defect in what this client built, met on a host that
    // answered the probe one call earlier and will answer the next one, so the
    // run row is both writable and the only trace the fleet gets: a leg that
    // returned without it left the defect recorded on the host nowhere, and a
    // host-side reader watching the error column would see the run simply not
    // happen. It is the same write the ordinary end of the run makes rather than
    // a second one composed beside it, so the two rows cannot come apart.
    //
    // The column carries the part of the printed failure list this run actually
    // failed at, the first five of them in the run's own order, so a run that
    // delivered everything it read and had something to say about the next one
    // records no error and a reader watching this column for trouble is not
    // taught to ignore it.
    //
    // A run that stands down on a refusal prints one sentence, the refusal, and
    // none of the list it had gathered before it, so that sentence is the whole
    // of what its column carries. Anything more would be a sentence on the host
    // that no reader of the run ever saw, and the refusal is what the run
    // stopped on besides.
    //
    // Each sentence is rendered on its own and then joined, which is how the
    // printed copy renders them: one sentence is one value on both channels, so
    // the text under a cut is the same text in both places. columnText above
    // states what that render is and why it is four passes rather than one.
    //
    // A null answer is a run with no budget left for the write. The ordinary end
    // of the run reports that as the stop it is; a leg standing down on a
    // refusal has its own sentence to print and takes the missing row as the
    // lesser loss.
    const recordRun = (endedOn) => {
        const sentences = endedOn ? [endedOn] : workFailures;
        const budgetMs = budgetFor(config.timeoutMs);
        if (budgetMs === null) return null;
        return callProcedure(config, 'usp_AppendPublishRun', {
            '@p_Run': {
                started,
                finished: new Date().toISOString(),
                added: summary.added,
                changed: summary.changed,
                removed: summary.removed,
                embedded: summary.embedded,
                // The key mem.usp_AppendPublishRun reads this count under, in
                // its own OPENJSON ... WITH list. The host's column and this key
                // still carry the local queue's former name, and the name on the
                // wire is the procedure's to change: a client that renamed one
                // side alone would send a key the procedure does not name, which
                // it would read as null and record as zero on every run.
                spoolDrained: summary.drained,
                error: sentences.length > 0
                    ? sentences.slice(0, 5).map(columnText).join('; ') : null
            }
        }, { deps, budgetMs });
    };

    // The reachability probe, spent before anything else so an unreachable host
    // is discovered in about the time one spawn costs rather than after a first
    // record batch at the full configured timeout. The hard kill is the module's
    // declared overshoot rather than the probe budget itself, since a kill
    // inside the tool's own floor would refuse every host alive or dead.
    const probe = callProcedure(config, 'usp_Health', {},
        { deps, budgetMs: PROBE_TIMEOUT_MS, killMs: PROBE_TIMEOUT_MS + SQLCMD_FLOOR_MS });
    if (!probe.ok) return { ok: false, standDown: 'unreachable', detail: probe.detail };

    const walk = collectRecords();
    // `partial` is the walk's own completeness and nothing else, because every
    // removal in this run is held back on it. A twinned record is reported
    // beside the rest and leaves it alone: its key is known to be backed by
    // files here, which the removal leg reads from duplicateKeys.
    summary.partial = walk.failed.length > 0 || walk.unscanned.length > 0;
    // A tier that would not read and a key two files claim are both records this
    // run set out to publish and did not, so each moves the exit code as well as
    // printing.
    for (const entry of walk.failed) failure(entry.reason);
    for (const entry of walk.duplicates) failure(entry.reason);

    // The keys of shared records this machine may hold an older copy of than
    // the host does. The procedure answers with counts rather than identities,
    // so what is known is that some record in the batch was skipped as older,
    // and every shared record of that batch is withheld from the embedding leg
    // below.
    //
    // Embedding is the one leg that would write this machine's text against the
    // host's record: the host keeps its newer body, the reader still reports
    // the row unembedded, and vectors made here would be the older text stored
    // against the newer record, which then reads as embedded forever with text
    // no file holds. A withheld record is embedded by the sandbox whose copy is
    // the newer one, and it stays withheld here for as long as this machine's
    // file is behind, which the git sync does not resolve: the sync carries no
    // modification times, so a shared record another machine published reads as
    // older on every later run from this one.
    //
    // Only a shared record is withheld, because only a shared record can be the
    // older one: the procedure reaches that disposition for a row whose store
    // carries no sandbox, which is what a type or operator store is, and a
    // project store carries this sandbox. A project record therefore keeps its
    // place in the embedding leg beside a withheld shared one, and since a
    // batch is a slice of the walk's order, any store of fewer than a batch's
    // records mixes the two tiers in one call.
    const withheld = new Set();
    for (let at = 0; at < walk.records.length; at += RECORD_BATCH) {
        const batch = walk.records.slice(at, at + RECORD_BATCH);
        const budgetMs = budgetFor(UPSERT_TIMEOUT_MS);
        if (budgetMs === null) return stopped('a record batch');
        const sent = callProcedure(config, 'usp_UpsertRecords', { '@p_Records': batch }, { deps, budgetMs });
        // A REFUSAL IS NOT A HOST THAT DID NOT ANSWER, AND ON THIS LEG IT IS
        // PERMANENT. The host answered the probe one call ago, so what a refusal
        // here names is a defect in the batch this client built, which every
        // later run rebuilds from the same files. Reported as an unreachable
        // host it would send a reader to the network on every run forever while
        // the fault sat in the data, which is the same split the drain already
        // makes on the cause the transport answers with.
        if (!sent.ok) {
            if (sent.cause !== 'refused') return { ok: false, standDown: 'unreachable', detail: sent.detail };
            const refusal = refusedText('the ' + batch.length + ' record(s)', 'usp_UpsertRecords',
                sent.detail, 'the run stopped there, so nothing later in it was done and the '
                + 'next run sends every record again from the files on this machine, which '
                + 'still hold every one of them');
            // The row goes down with the run's own account of what it ended on.
            // Its answer is not read: the caller is already being told the run
            // stood down and why, and a second sentence about the bookkeeping
            // would sit in front of the one a reader has to act on.
            recordRun(refusal);
            return { ok: false, standDown: 'refused', detail: refusal };
        }
        const counts = counted(sent.rows);
        summary.added += Number(counts.added) || 0;
        summary.changed += Number(counts.changed) || 0;
        summary.unchanged += Number(counts.unchanged) || 0;
        const older = Number(counts.skippedOlder) || 0;
        summary.skippedOlder += older;
        if (older > 0) {
            for (const record of batch) {
                if (record.tier === 'project') continue;
                withheld.add(recordKey(record.tier, record.segment, record.fileKey));
            }
        }
    }

    // THE DRAIN RUNS HERE, BEHIND THE RECORDS AND AHEAD OF THE EMBEDDING, AND
    // THE POSITION IS THE CONTRACT. A usage stamp names a record, and
    // mem.usp_AppendUsage resolves that name against the records the host holds,
    // rejecting and counting a stamp that resolves to none rather than writing
    // it. A drain ahead of the upsert above therefore loses every stamp for a
    // record the host has not been told about yet, which is the ordinary case
    // twice over: a record created and stamped between two runs, and a first
    // publish from a machine that has never published, where every queued stamp
    // resolves to nothing. The drain deletes the rows it sent, so those stamps
    // are gone from the host with the summary reporting them delivered, which is
    // the silent loss between queue and database this whole mechanism exists to
    // prevent.
    //
    // It is not later than this either. The embedding leg below is the long one
    // and the run's deadline stops a call rather than queuing it, so a drain
    // behind the embedding is a drain a busy run never reaches, which trades one
    // loss for another. Between the two legs the records exist and the budget is
    // barely spent. It also sits ahead of the removal marking, so a stamp naming
    // a record this very run removes still resolves and lands.
    //
    // The probe above takes no gate: it is the run's first act and the deadline
    // was read one statement earlier, so it starts inside the budget by
    // construction and a gate there could never answer anything but yes. The
    // record batches above carry the run's first gate, and this is the second.
    const drainBudgetMs = budgetFor(config.timeoutMs);
    if (drainBudgetMs === null) return stopped('the queue drain');
    // The probe's own answer carries the host's schema version, which the drain
    // will not send without. It is read from that answer rather than asked for
    // again, because a second call to the same procedure spends a whole spawn on
    // a number this run already holds.
    const drain = drainQueue(config, {
        deps,
        budgetMs: config.timeoutMs,
        deadline,
        schemaVersion: counted(probe.rows).schemaVersion
    });
    // What left the queue and what is still on it, which part whenever the delete
    // was never reached or a row arrived behind the read. Both ride out to the
    // summary line, so a queue that keeps reporting the same rows is visible on
    // the surface a person reads rather than only in the file.
    //
    // A count the drain never took is carried as null rather than as zero. A
    // drain refused by the version gate, or stopped by a file no connection could
    // open, knows nothing about how many rows the queue holds, and printing zero
    // would tell a reader, and any later step that scrapes this field, that a
    // full queue is empty. The summary line omits the clause instead, and the
    // cause's own sentence on the failure list is what says nothing was deleted.
    summary.drained = drain.drained;
    summary.queueRemaining = Number.isFinite(drain.remaining) ? drain.remaining : null;
    summary.rejected = drain.rejected || 0;
    // A stamp the host would not record, which after this leg's position is a
    // genuine surprise rather than the ordinary first-publish case: the records
    // were upserted one call earlier, so a stamp still resolving to nothing
    // names a record the host does not hold at all. The count is the only thing
    // that says so, since the procedure answers in counts rather than
    // identities, and the row it names is off the queue once the delete runs. So
    // it goes on the failure list, where the verb prints it and the publish run
    // records it.
    if (summary.rejected > 0) {
        failure('the queue (rejected): the memory database would not record '
            + summary.rejected + ' queue row(s), each of which resolved to no record it holds, so '
            + 'no row was written for them. The local usage journal on this machine still holds '
            + 'every one');
    }
    // Whatever the drain answers is a fact about the queue and never a reason to
    // abandon the run. The probe above has already had the host's answer and the
    // records are already published, so a refusal here is evidence about the
    // queue's own rows, a file that could not be read or a lock another writer
    // holds, and the legs that follow neither read the queue nor write to it. A
    // host that has since gone away is caught by the inventory read below, which
    // does stand the run down.
    //
    // The drain's cause rides out in front of its own words, because the states
    // it reports have different remedies and the sentence that follows is the
    // host's or the disk's rather than this client's: a reader who sees
    // `refused` knows to fix what is sent, `outage` to wait for the host,
    // `contended` to expect the other writer to finish, `budget` to expect the
    // next run to take it, `schema` to re-run the installer against the host,
    // `oversized` to look at a queue grown past what one call carries,
    // `unreadable` to look at the queue file itself, and `unclearable` to look at
    // the disk. Without it the word the drain reached is known to this module and
    // to nobody the summary reaches.
    //
    // ONE LIST, AND EVERY DRAIN SENTENCE ON IT. The failure list is the publish's
    // one surface for what a run left a person to read: the verb prints it on
    // standard error beside the summary line. The cause word distinguishes the
    // states for the reader and branches nowhere, so no sentence is routed
    // anywhere a person does not read. The count of what the queue still holds
    // goes out on the summary line as well.
    //
    // The exit code is the drain's own `ok` rather than a reading of that list,
    // because a warning and a delivered-but-undeleted row both belong in front of
    // a person and neither is work this run failed to do.
    //
    // CONTENTION IS NOT A FAILURE, AND IT IS THE ORDINARY CASE. Another writer
    // holding the queue's write lock past the busy timeout is a busy machine, and
    // no row is lost in it: either nothing was sent and every row is still there,
    // or the host took the rows and the delete did not run, which the stamp id's
    // unique index turns into one insert when the next run sends them again. Two
    // sessions starting inside one drain's window and a session-start publish
    // beside a doctor run reach it, so a verb that exited non-zero there would be
    // exiting non-zero on a healthy machine. The sentence still prints, because
    // the drained count of zero on the summary line is otherwise unexplained.
    const drainFailed = !drain.ok && !drain.contended;
    if (drainFailed) summary.workFailed = true;
    if (drain.detail) summary.failed.push('the queue (' + (drain.cause || 'unclear') + '): ' + drain.detail);
    // The same sentence, taken off the list it was just put on rather than
    // composed a second time, so the host's copy and the printed one cannot
    // come apart.
    if (drainFailed && drain.detail) workFailures.push(summary.failed[summary.failed.length - 1]);

    const identity = modelIdentity(config);
    const listBudgetMs = budgetFor(config.timeoutMs);
    if (listBudgetMs === null) return stopped('the inventory read');
    const listed = callProcedure(config, 'usp_ListRecords', { '@p_ModelIdentity': identity },
        { deps, budgetMs: listBudgetMs });
    // The same split the record batches take: a refusal here is a defect in what
    // this client asks for, and every run asks for the same thing.
    if (!listed.ok) {
        if (listed.cause !== 'refused') return { ok: false, standDown: 'unreachable', detail: listed.detail };
        const refusal = refusedText('this sandbox\'s own inventory read', 'usp_ListRecords',
            listed.detail, 'the run stopped there, so nothing was marked removed and nothing '
            + 'was embedded on it; the records this run published are published');
        recordRun(refusal);
        return { ok: false, standDown: 'refused', detail: refusal };
    }

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
        const budgetMs = budgetFor(UPSERT_TIMEOUT_MS);
        if (budgetMs === null) return stopped('the removal marking');
        const marked = callProcedure(config, 'usp_UpsertRecords',
            { '@p_Records': [], '@p_Removed': removed }, { deps, budgetMs });
        if (!marked.ok) {
            if (marked.cause !== 'refused') return { ok: false, standDown: 'unreachable', detail: marked.detail };
            const refusal = refusedText('the ' + removed.length + ' file key(s) this run names as '
                + 'removed', 'usp_UpsertRecords', marked.detail, 'the run stopped there, so '
                + 'no row was marked removed and nothing was embedded on it; the next run '
                + 'names the same keys again');
            recordRun(refusal);
            return { ok: false, standDown: 'refused', detail: refusal };
        }
        summary.removed = Number(counted(marked.rows).removed) || 0;
    }

    const embedded = await embedRecords(config, toEmbed, { deps, deadline });
    summary.embedded = embedded.embedded;
    // A vector row the host would not store, which names a record it does not
    // hold or may not show this sandbox. The records those rows belong to stay
    // unsearchable until some run stores them whole, and nothing on this machine
    // notices that by itself, so the count goes where a person reads it.
    summary.embedRejected = embedded.rejected;
    for (const reason of embedded.failed) failure(reason);
    if (embedded.outOfBudget !== null) return stopped(embedded.outOfBudget);

    const orphans = collectOrphans();
    summary.orphans = orphans.length;
    if (orphans.length > 0) {
        const budgetMs = budgetFor(config.timeoutMs);
        if (budgetMs === null) return stopped('the index orphans');
        const sent = callProcedure(config, 'usp_UpsertIndexOrphans', { '@p_Orphans': orphans },
            { deps, budgetMs });
        if (!sent.ok) failure('the index orphans were not recorded: ' + sent.detail);
    }

    const run = recordRun(null);
    if (run === null) return stopped('the publish run record');
    if (!run.ok) failure('the publish run was not recorded: ' + run.detail);

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
// holding as many as fit inside one call's width, and a pack is one or more
// embedding calls and exactly one database call. Most records in this store are
// a single chunk, so a first publish over a store of several hundred goes from
// several hundred process starts with a TLS login each to a few dozen. A record
// whose own chunk count is at or past that width is a pack by itself and takes
// as many embedding calls as it needs, still landing in one database call.
//
// A pack the server refuses is sent again a record at a time, so the record the
// server would not take is the only one reported. Batching otherwise makes one
// unembeddable body cost every record packed beside it, and the bodies that
// reach that condition are the ones the four-characters-per-token estimate
// behind the chunk ceilings does not fit, which is a standing property of a
// record rather than a passing one: without the retry those packmates would be
// held back on every run for as long as that record stood.
async function embedRecords(config, pending, options) {
    const opts = options || {};
    const deps = opts.deps || {};
    const embed = (typeof deps.embedBatch === 'function') ? deps.embedBatch : embedBatch;
    const identity = modelIdentity(config);
    const callWidth = embedCallWidth();
    const out = { embedded: 0, rejected: 0, failed: [], outOfBudget: null };

    // The run's deadline, carried in from the publish so this leg's many calls
    // are bounded by the same clock as the few before them, and defaulted to a
    // whole budget of its own for a caller that embeds without one. `outOfBudget`
    // names the call that was refused rather than flagging that one was, since
    // the caller reports it and an embedding call and the write that stores its
    // vectors stop the run at different costs: what was embedded and not stored
    // is re-embedded by the next run, which reads the same records unembedded.
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const deadline = Number.isFinite(opts.deadline) ? opts.deadline : now() + RUN_BUDGET_MS;

    const queue = [];
    for (const item of pending) {
        const chunks = chunkBody(item.record.body);
        if (chunks.length === 0) continue;
        queue.push({ recordId: item.recordId, name: item.record.name, chunks });
    }

    // The packs: whole records accumulated while their chunks fit one call's
    // width, and any record at or past that width standing alone.
    const packs = [];
    let pack = [];
    let width = 0;
    for (const item of queue) {
        if (item.chunks.length >= callWidth) {
            if (pack.length > 0) { packs.push(pack); pack = []; width = 0; }
            packs.push([item]);
            continue;
        }
        if (width + item.chunks.length > callWidth) { packs.push(pack); pack = []; width = 0; }
        pack.push(item);
        width += item.chunks.length;
    }
    if (pack.length > 0) packs.push(pack);

    // One group's chunks embedded, as {ok, rows} or {ok: false, detail}. Every
    // row's vector is the one made from its own text, since the answers come
    // back in the order the texts were sent. The embedded text is composed the
    // way the corpus is composed, through memory-index's own function: the
    // record's name, then the text. A second spelling of that composition is a
    // silent ranking defect.
    const embedGroup = async (group) => {
        const flat = [];
        for (const item of group) {
            item.chunks.forEach((chunk, index) => {
                flat.push({ item, chunk, index, text: indexLib().embedText(item.name, chunk.text) });
            });
        }
        const rows = [];
        for (let at = 0; at < flat.length; at += callWidth) {
            const slice = flat.slice(at, at + callWidth);
            const budgetMs = callBudget(deadline, now(), config.timeoutMs, EMBEDDING_FLOOR_MS);
            if (budgetMs === null) return { ok: false, outOfBudget: 'an embedding call' };
            const answered = await embed(config, slice.map((entry) => entry.text), { deps, budgetMs });
            if (!answered.ok) return { ok: false, detail: answered.detail };
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
        return { ok: true, rows };
    };

    for (const group of packs) {
        let taken = group;
        let rows = [];
        const answered = await embedGroup(group);
        // A refusal for want of budget ends this leg where it stands rather
        // than falling into the one-at-a-time retry below, which would ask for
        // the same refused call once per record in the pack.
        if (answered.outOfBudget !== undefined && answered.outOfBudget !== null) {
            out.outOfBudget = answered.outOfBudget;
            return out;
        }
        if (answered.ok) {
            rows = answered.rows;
        } else if (group.length === 1) {
            out.failed.push(memqLib().sanitize(group[0].name, 80) + ' was not embedded: ' + answered.detail);
            continue;
        } else {
            taken = [];
            for (const item of group) {
                const alone = await embedGroup([item]);
                // The budget running out inside the retry stops the leg on the
                // spot. What this pack has already embedded is dropped rather
                // than stored, which costs the calls that made it and nothing
                // more: those records read unembedded to the next run's
                // inventory and are embedded there.
                if (alone.outOfBudget !== undefined && alone.outOfBudget !== null) {
                    out.outOfBudget = alone.outOfBudget;
                    return out;
                }
                if (alone.ok) { taken.push(item); rows = rows.concat(alone.rows); }
                else out.failed.push(memqLib().sanitize(item.name, 80) + ' was not embedded: ' + alone.detail);
            }
            if (taken.length === 0) continue;
        }
        // The lock budget rather than the configured timeout: this write takes
        // the same fleet publish lock the record upsert takes, at the same
        // thirty-second wait, so a client clock shorter than that wait kills a
        // queuing publisher with its own tool. Here that costs the vectors as
        // well as the call, since the pack is reported embedded and not stored
        // and the next run embeds the same records into the same wall.
        const storeBudgetMs = callBudget(deadline, now(), UPSERT_TIMEOUT_MS, SQLCMD_FLOOR_MS);
        if (storeBudgetMs === null) {
            out.outOfBudget = 'the write that stores a pack\'s vectors';
            return out;
        }
        const sent = callProcedure(config, 'usp_UpsertEmbeddings', { '@p_Embeddings': rows },
            { deps, budgetMs: storeBudgetMs });
        if (!sent.ok) {
            for (const item of taken) {
                out.failed.push(memqLib().sanitize(item.name, 80) + ' was embedded and not stored: ' + sent.detail);
            }
            continue;
        }
        // The count is the host's own. The procedure answers how many vector
        // rows it wrote and how many it rejected for naming a record the caller
        // cannot see, so a call that came back ok still says nothing about a
        // store having happened until those numbers are read. Every row of the
        // pack landing is what says every record in it is stored, since a record
        // is searchable only with all of its chunks on the host and the answer
        // carries counts rather than identities: which records lost a row is not
        // in it, so a pack stored short credits none of them and is named on the
        // failure list instead. The next run reads those records unembedded from
        // the host's own inventory and embeds them again.
        const stored = counted(sent.rows);
        const wrote = (Number(stored.inserted) || 0) + (Number(stored.updated) || 0);
        const refused = Number(stored.rejected) || 0;
        out.rejected += refused;
        if (wrote === rows.length && refused === 0) {
            out.embedded += taken.length;
            continue;
        }
        out.failed.push('a pack of ' + taken.length + ' record(s) sent ' + rows.length
            + ' vector row(s) and the memory database stored ' + wrote + ' of them'
            + (refused > 0 ? ', rejecting ' + refused + ' that named a record it does not hold' : '')
            + ', so the pack was not stored whole and no record in it is counted embedded. '
            + 'The next run reads them unembedded and embeds them again');
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
        + summary.removed + ' removed, ' + summary.drained + ' queue row(s) drained, '
        + summary.orphans + ' index orphan(s)'
        + (summary.queueRemaining > 0 ? ', ' + summary.queueRemaining
            + ' queue row(s) still on the queue' : '')
        + (summary.rejected > 0 ? ', ' + summary.rejected
            + ' queue row(s) the host would not record, so no row on the host holds them' : '')
        + (summary.embedRejected > 0 ? ', ' + summary.embedRejected
            + ' vector row(s) the host would not store, so the records they belong to are not searchable' : '')
        + (summary.heldBack > 0 ? ', ' + summary.heldBack
            + ' removal(s) held back where the store read empty' : '')
        + (summary.partial ? ', walk incomplete so nothing was marked removed' : '')
        + (summary.outOfBudget ? ', the run budget was spent so it stopped there' : '');
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
    // A refusal arrives as a whole sentence, composed by refusedText where the
    // call was made: the server's own words first, then what the run left. It is
    // handed on as it is rather than wrapped in a second clause, since a reader
    // sent to the network over a defect in the data reads the wrong half first.
    if (result.standDown === 'refused') return result.detail;
    // A caller's own clock ran out before a call could start, which is neither a
    // host that was away nor a defect in what was sent: the work is exactly as
    // available on the next run, and the sentence says so rather than sending a
    // reader after a host that is fine.
    if (result.standDown === 'budget') return result.detail;
    // A caller that walked away before the answer arrived, which is neither a
    // host condition nor a defect in what was sent: the sentence says the work
    // was dropped rather than sending a reader after a host that is fine.
    if (result.standDown === 'cancelled') return result.detail;
    // A host up and answering, at a version whose answers this client cannot
    // rank. It carries its own whole sentence, the refusal's shape and for the
    // refusal's reason: waiting resolves nothing here and the remedy is the
    // installer, so the sentence names it rather than sending a reader to the
    // network.
    if (result.standDown === 'schema') return result.detail;
    // A curator verb on a config that names no curator. The sentence names the
    // two fields, since the remedy is the config rather than the host.
    if (result.standDown === 'curator') return result.detail;
    return 'the memory database config at ' + result.path + ' is ' + result.standDown
        + (result.detail ? ' (' + result.detail + ')' : '');
}

module.exports = {
    CONFIG_FILE,
    QUEUE_FILE,
    QUEUE_BUSY_TIMEOUT_MS,
    QUEUE_BUSY_TIMEOUT_QUICK_MS,
    RECORD_BATCH,
    CHUNK_TARGET_CHARS,
    CHUNK_MIN_CHARS,
    CHUNK_MAX_CHARS,
    PROBE_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
    REQUIRED_SCHEMA_VERSION,
    SEARCH_SCHEMA_VERSION,
    PAYLOAD_PIECE_CHARS,
    PAYLOAD_PIECES_PER_BUDGET,
    PAYLOAD_FUNDED_CHARS,
    LOCK_WAIT_MS,
    UPSERT_TIMEOUT_MS,
    RUN_BUDGET_MS,
    SQLCMD_FLOOR_MS,
    SPAWN_MAX_OVERSHOOT_MS,
    COLUMN_TEXT_CAP,
    columnText,
    spawnKillMs,
    failureCause,
    configPath,
    queuePath,
    isDefaultStoreRoot,
    loadConfig,
    modelIdentity,
    sqlcmdPath,
    childEnvironment,
    clockSeconds,
    callBudget,
    embedCallWidth,
    payloadLiteral,
    payloadCallMs,
    carriesServerMessage,
    runBatch,
    callProcedure,
    embedBatch,
    QUERY_TEXT_CAP,
    QUERY_LIMIT_MAX,
    queryBudgetMs,
    probeHost,
    queryBatch,
    queryHit,
    queryHost,
    curatorConfig,
    promoteRecord,
    curate,
    hostHealth,
    chunkBody,
    openQueue,
    queueBusy,
    queueInsert,
    queueDepth,
    drainQueue,
    stampId,
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
