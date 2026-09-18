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

// The spool and its lock, at the store root, and with them the name a drain
// rotates the spool to while it delivers. The sync repository's allowlist
// re-includes only paths inside the memory tiers and the machine coordinator
// directory, so none of the three can be staged: a spool holding this machine's
// undelivered stamps is per-machine state and syncing it would publish one
// machine's pending journal to every other.
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
// calls' own and the longest any single call here takes. Two procedures take
// that lock: mem.usp_UpsertRecords and mem.usp_UpsertEmbeddings.
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
// idempotent and neither is ever spooled, so what a killed batch costs is the
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
// in hooks/memory-session.js: that constant is stated in terms of this one, so
// a run still in flight is never joined by a second one.
const RUN_BUDGET_MS = 15 * 60 * 1000;

// How long a spool lock may go untouched before another publisher may break it,
// and the fewest boundary calls a drain can hold it across, which is one per
// procedure and is reached only by a spool whose lines fit one DRAIN_BATCH each.
// The floor is the lock helper's own default; above that the drain's budget
// decides, because a lock broken while its holder is still inside a spawn is a
// second publisher reading the same lines and delivering them again.
//
// A fuller spool holds the lock across one call per batch per procedure and
// nothing in these two numbers bounds that count, so they size a lower bound
// rather than the drain. What bounds a real drain is the run's deadline, which
// drainStaleMs reads, and the ceiling below, which bounds it even where no
// deadline was passed.
const DEFAULT_LOCK_STALE_MS = 60000;
const DRAIN_MIN_CALLS = 2;

// The longest a live holder can hold the spool lock, and so the ceiling on how
// long a dead one's lock is honoured.
//
// A publish starts no boundary call past its deadline and the one call that
// crosses it finishes inside the spawn floor, so RUN_BUDGET_MS plus that floor
// bounds any drain a live publisher is inside. Without the ceiling the value
// below is driven by the operator's configured timeout, which is accepted up to
// MAX_TIMEOUT_MS: at that legal maximum a drain would ask for over twenty
// minutes of staleness, past DB_SYNC_ATTEMPT_STALE_MS in
// hooks/memory-session.js, which is what holds the next publish off. A publisher
// killed mid-drain would then leave a lock no live publisher could hold, and
// every session-start publish from the re-arm until that lock aged out would
// report contention and drain nothing.
const DRAIN_LOCK_STALE_CEILING_MS = RUN_BUDGET_MS + SQLCMD_FLOOR_MS;

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

function spoolPath() {
    return path.join(memqLib().memoryRoot(), SPOOL_FILE);
}

function spoolLockPath() {
    return path.join(memqLib().memoryRoot(), SPOOL_LOCK_FILE);
}

// Whether the store this process would walk and spool into is the machine's
// own, which is the only store this client speaks for.
//
// The credential comes from the home directory while the walk's root moves with
// KIT_MEMORY_ROOT, so a redirected store presents the default store's login and
// resolves to the same sandbox on the host. Publishing from one would name the
// other's rows removed and the shared index would oscillate between two
// readings of one sandbox; spooling into one would fill a file no publish ever
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
    // The model identity is the one scalar this client writes into a batch, so
    // it is held to the batch's own screen here rather than at the call. A
    // model string the screen refuses is a config defect, and reported at the
    // call it would read as a host that did not answer, every run.
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
// envelope and so as an outage, which is the conservative answer: a spool that
// keeps its lines through a real defect costs a repeat, where a defect reported
// against a host that merely blinked costs a hunt for a bug that is not there.
// And a server message raised by something other than this batch's own contract,
// a deadlock victim or a lock request timeout, does carry the envelope and is
// read here as a refusal; its lines go back to the spool either way and the
// next drain sends them, so what it costs is a sentence naming the wrong remedy
// once.
const SERVER_MESSAGE_RE = /^Msg \d+, Level \d+, State \d+/m;
function carriesServerMessage(output) {
    return typeof output === 'string' && SERVER_MESSAGE_RE.test(output);
}

// One sqlcmd run over a batch this module wrote, as {ok, rows, detail, cause}.
//
// `cause` rides on every failure and is `refused` where the server answered the
// batch with a message of its own and `outage` everywhere else, which is what
// lets a caller tell a defect in what it sent from a host that was not there.
// The two have opposite remedies and the spool's drain reports them apart.
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
    const killMs = Number.isFinite(opts.killMs) ? opts.killMs : budgetMs + SQLCMD_FLOOR_MS;
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
        // this client acts on is the envelope rather than those words, and a
        // status of null is a kill on this process's own clock, which says
        // nothing at all about the server and is an outage whatever the output
        // it had printed by then.
        const killed = res.status === null;
        return {
            ok: false,
            cause: (!killed && carriesServerMessage(output)) ? 'refused' : 'outage',
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

// Texts in one embedding call: the local sweep's batch width, or fewer where a
// response that wide would not fit the bound its reader holds it under.
function embedCallWidth() {
    const room = endpoint.MAX_BODY_BYTES - EMBED_RESPONSE_OVERHEAD_BYTES;
    const perVector = EMBED_VECTOR_DIMENSIONS * EMBED_FLOAT_BYTES;
    return Math.max(1, Math.min(indexLib().EMBED_BATCH, Math.floor(room / perVector)));
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
//
// Nothing here repairs a torn last line, and that is deliberate rather than an
// omission the drain makes up for. Repairing one would mean reading the file's
// last byte before the write, which turns a single O_APPEND call into a read
// and a write that two appenders can interleave, and the interleaving is the
// hazard this posture exists to avoid. So what a write torn by a full disk or a
// kill costs is itself and the next line appended behind it, which runs onto its
// end and makes one unreadable line of the two. Both are counted malformed and
// reported by the drain that reads them, and neither is a stamp lost from
// usage.jsonl, which the caller has already written.
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
// mid-line. `bytes` is therefore the byte offset just past everything this
// read consumed, which is what the drain carries nothing back from.
//
// A trailing piece with no newline is a line whose write never finished, and
// this read consumes it and counts it malformed. That is what lets a spool whose
// whole content is unterminated clear: a rule that carried the piece back would
// find the same file on every future run and never drain it. `bytes` therefore
// reaches the file's length in that case, so the slice putBack reads past it
// below begins at the end of the file and carries only what an appender wrote
// after this read.
//
// What the rule costs is a line torn at the instant of a drain's read, and it
// costs it twice over. The piece this read consumed is delivered nowhere and
// reported in `malformed`. The rest of that same line, which its writer finishes
// after this read, sits past `bytes` and so goes back to the live file as though
// it were a whole line; the next drain reads that remainder, cannot parse it
// either, and counts it malformed a second time. So one torn stamp is one lost
// row on the host and two lines in two drains' malformed counts, and a reader
// diffing the count against the rows on the host is reading a number that
// double-counts by construction.
//
// Each kept line carries its own bytes, because a partial drain puts back
// exactly the lines that were not delivered.
function readSpool(file) {
    let raw = null;
    try {
        raw = fs.readFileSync(typeof file === 'string' && file !== '' ? file : spoolPath());
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
    if (at < raw.length) {
        if (raw.subarray(at).toString('utf8').trim() !== '') out.malformed += 1;
        out.bytes = raw.length;
    }
    return out;
}

// Send the spool to the host and put back exactly what it did not take.
//
// The drain rotates rather than rewrites. The file is renamed aside under the
// lock, which leaves an appender that opens the spool after the rename creating
// a fresh one, and the undelivered lines are appended back to that fresh file at
// the end. Appenders take no lock, because a stamp on the interactive path must
// never wait on a publish, and a drain that read the file and wrote it back
// whole would overwrite whatever was appended between those two calls. Nothing
// this drain writes lands in a file an appender has open.
//
// An appender whose open beat the rename is the case the rotation does not
// cover: a rename moves a file out from under an open handle rather than
// invalidating it, so that appender writes into the rotated file, past
// everything this drain read. Those bytes are read once more and carried back at
// the write-back, which is what putBack's own account below is about.
//
// The lock is the store's own exclusive-create lock, held across the rotation,
// the calls and the write-back, so two publishers cannot send the same lines
// twice. Its staleness is the run's own deadline rather than the helper's
// default, since a drain spends that deadline over as many spawns as it has
// batches and a lock judged stale mid-drain is a second publisher reading the
// same lines. It is clamped above at DRAIN_LOCK_STALE_CEILING_MS, the longest a
// live holder can be inside a drain, so a publisher killed mid-drain leaves a
// lock the next publish can break rather than one it reports contention against.
//
// The two procedures are two deliveries, each sent in batches, and what goes
// back is every line no batch delivered. Delivery is not a prefix: a refused
// batch is skipped and the batches behind it still go, so what landed is tracked
// by each line's place among its own type's lines rather than by a count of
// them. When the usage rows are taken and the outcome call then fails, the
// outcome lines alone go back: both procedures are plain inserts with no dedupe,
// so putting everything back would send every usage row a second time on the
// next drain and put a second read-stamp row on the host for a memory read once.
// A line nothing took is always put back, since a stamp delivered nowhere and
// deleted anyway is the loss this whole mechanism exists to prevent.
//
// A batch the procedure refuses is a contract defect between this client and
// that procedure rather than an operational state, so nothing here retires one.
// mem.usp_AppendUsage throws for an unmapped login, a payload that is not an
// array, and a stamp missing its timestamp or carrying a kind other than read or
// applied; a stamp naming a record the caller cannot see is counted instead, the
// case below. Every writer emits read or applied with a fresh timestamp, so a
// line the procedure will not read is a bug or a version skew. Such a batch is
// therefore put back and never deleted, the batches behind it are still sent,
// the other procedure is still sent, and the server's own words ride out to the
// publish summary with the procedure that spoke them named. The spool grows
// until the contract is repaired, and that growth is the signal.
//
// A host that went away is the opposite disposition and is told apart before
// either is reported, on the `cause` the transport answers with rather than on
// the bare false the two share. A refusal names a defect and asks for a fix; an
// outage asks for nothing but the next run, and a host that blinks once would
// otherwise open a defect that is not there and make noise of the spool growth
// that is supposed to be the signal. Where the two cannot be told apart the
// transport answers outage, because over-reporting the defect is the failure
// this split exists to prevent, and a cause missing altogether reads the same
// way here. An outage also stops the drain where it stands, both procedures
// included: every batch behind it would spend a spawn's whole clock against the
// same silent host, and the lines all go back either way.
//
// A row the procedure takes the batch for and then declines is counted rather
// than kept. mem.usp_AppendUsage answers {appended, rejected}, the rejected
// count being the stamps whose record it could not resolve, and it answers in
// counts rather than identities, so which line it declined cannot be known here.
// Those lines go with the batch, because usage.jsonl holds every one of them on
// this machine and what is lost is the host's copy. The count rides out to the
// publish summary and onto the verb's own line, which is what makes that loss
// reported rather than silent. mem.usp_AppendOutcomes answers with `appended`
// alone and declines no row, so its rejected count is always zero.
//
// A malformed line goes back nowhere and is counted in `malformed`, which the
// caller carries to its summary: a line no procedure can read is delivered by
// no future drain, and a silent drop is how a torn append disappears with
// nobody the wiser. A spool holding nothing but malformed lines is therefore a
// successful drain of zero lines that clears the file, rather than a refusal:
// a run that left it in place would find the same unreadable file on every
// future run and never publish again.
const DRAIN_ASIDE_SUFFIX = '.draining';

// Spool lines in one append call, which is larger than a record batch because
// the lines are smaller. memq caps an outcome's summary at 120 characters and
// its detail at 500 (SUMMARY_CAP and DETAIL_CAP in memq.js), so the longest
// line this file holds is under a kilobyte and a usage stamp is a fifth of that,
// where one record payload carries a whole memory body. A hundred lines at that
// worst case is about a hundred kilobytes of JSON, which one batch file and one
// OPENJSON pass take comfortably.
//
// The number is also what a refused batch costs, since a batch the procedure
// throws over goes back whole and is sent again on the next run. A smaller
// number costs a spool holding a poisonous line less and costs a healthy spool
// more spawns, and a hundred sends this store's ordinary spool of a few lines
// in the one call it always took.
const DRAIN_BATCH = 100;

// Append bytes to the spool, giving a torn last piece the newline it never got,
// which is what the drain's two writes to the live file both go through: the
// leftover fold-back and the write-back below. The repair is spelled here and
// nowhere else, so the two cannot drift apart.
//
// The repair belongs to these two writes rather than to the spool generally.
// What they carry is a slice of a file some earlier write may have torn, and
// appending it unterminated would run the next stamp onto its end and cost that
// stamp too. The interactive appendSpool takes no such repair, for the reason
// stated over it: reading the file before writing it is what its single-call
// posture exists to avoid.
//
// Never throws on an empty buffer, which it writes nothing for.
function appendRepaired(file, bytes) {
    if (bytes.length === 0) return;
    fs.appendFileSync(file, bytes[bytes.length - 1] === 0x0A ? bytes
        : Buffer.concat([bytes, Buffer.from('\n')]));
}

// Put the undelivered lines back on the live spool and take the rotated file
// away, as {ok} or {ok: false, detail}. Never throws.
//
// `delivered` names, per type, the places of that type's lines the host took,
// counted from zero in the order the file held them. It is places rather than a
// count because a refused batch is skipped while the batches behind it still go,
// so what landed is any set of them and no single number addresses it: kept is
// every line whose own place its type's set does not hold. Get that wrong and a
// line is either sent twice or deleted undelivered.
//
// The last read of the rotated file is what narrows the one window the rotation
// leaves: an appender whose open() beat the rename still holds that file, so
// anything written to it between this drain's first read and this one is carried
// back with the rest rather than unlinked with the file. The account above
// readSpool states where that slice begins.
//
// What is left of the window is the gap between this read and the unlink under
// it: a write landing in there goes away with the file and is reported nowhere.
// It cannot be closed from here, since a file is read and then unlinked in two
// calls with nothing holding an appender off between them, and the whole posture
// of the interactive path is that a stamp waits on no publish. What holds it
// small is that the two calls are adjacent, and what makes it rare is that an
// appender has to have opened the file before the rename and written after this
// read to land in it at all.
function putBack(live, aside, spool, delivered) {
    const seen = new Map();
    const kept = [];
    for (const line of spool.lines) {
        const at = seen.get(line.type) || 0;
        seen.set(line.type, at + 1);
        const took = delivered.get(line.type);
        if (took === undefined || !took.has(at)) kept.push(line.bytes);
    }
    try {
        const raw = fs.readFileSync(aside);
        const late = raw.subarray(Math.min(spool.bytes, raw.length));
        appendRepaired(live, Buffer.concat(kept.concat([late])));
        fs.unlinkSync(aside);
        return { ok: true };
    } catch (err) {
        return { ok: false, detail: errText(err) };
    }
}

// How long this drain's lock stands before another publisher may break it.
//
// A drain holds the lock across one call per batch rather than one per
// procedure, and the run's deadline is what bounds the whole of them. So a drain
// carrying a deadline holds a lock that cannot be judged stale before it, since
// a lock broken mid-drain is a second publisher reading the same lines and
// delivering them again. The ceiling bounds both branches, because past it the
// lock outlives every publisher that could be holding it and only a dead one's
// lock is left standing.
//
// The floor is the minimum call count rather than a bound on the drain: with no
// deadline nothing bounds how many batches this drain sends, and what is left is
// the lower bound of one call per procedure plus the helper's own default. The
// publish is the only production caller and it always passes a deadline, so that
// branch is what a test or a stand-alone drain takes.
function drainStaleMs(config, opts) {
    const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : config.timeoutMs;
    const calls = Math.max(DEFAULT_LOCK_STALE_MS, DRAIN_MIN_CALLS * (budgetMs + SQLCMD_FLOOR_MS));
    if (!Number.isFinite(opts.deadline)) return Math.min(DRAIN_LOCK_STALE_CEILING_MS, calls);
    const deps = opts.deps || {};
    const clock = (typeof deps.now === 'function') ? deps.now : Date.now;
    return Math.min(DRAIN_LOCK_STALE_CEILING_MS,
        Math.max(calls, (opts.deadline - clock()) + SQLCMD_FLOOR_MS));
}
function drainSpool(config, options) {
    const opts = options || {};
    const lock = memqLib().acquireLock(spoolLockPath(), { staleMs: drainStaleMs(config, opts) });
    if (!lock.ok) {
        // Contention is its own answer. Another publisher holding this lock is
        // a healthy host and a busy machine, which is nothing like a host that
        // did not answer, and a caller told the second about the first stands
        // its whole run down for a condition that resolves itself.
        const contended = typeof lock.reason === 'string' && lock.reason.startsWith('lock held');
        return {
            ok: false,
            contended,
            cause: contended ? 'contended' : 'unclearable',
            drained: 0,
            malformed: 0,
            rejected: 0,
            detail: contended ? 'another publisher holds the spool lock, so it was left for that run'
                : lock.reason
        };
    }
    // What one batch below may spend. Each takes its clock from what is left of
    // the run's deadline, which is the rule every boundary call in this module
    // follows: a call starts only while the deadline stands, and a batched drain
    // spends the run's budget over more calls rather than over longer ones. A
    // drain run outside a publish carries no deadline and spends its own budget
    // on each call.
    const deps = opts.deps || {};
    const clock = (typeof deps.now === 'function') ? deps.now : Date.now;
    const wantMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : config.timeoutMs;
    const batchBudget = () => (Number.isFinite(opts.deadline)
        ? callBudget(opts.deadline, clock(), wantMs, SQLCMD_FLOOR_MS)
        : wantMs);
    try {
        const live = spoolPath();
        const aside = live + DRAIN_ASIDE_SUFFIX;
        // A file left aside by a drain that died between the rotation and the
        // write-back holds lines nothing delivered. They go back to the live
        // file first, so this drain takes them with the rest, through the same
        // appendRepaired the write-back uses.
        //
        // A missing file is the ordinary case and says nothing; a read or an
        // append that fails stops the drain where it stands. The rotation below
        // renames the live file onto this same path and a rename replaces what
        // it lands on, so a fold-back that failed and carried on would destroy
        // every line in that file and report nothing: the read that found them
        // and the append that would have saved them both sit in front of a
        // rename that takes the file away regardless. Stopping costs this run's
        // drain and leaves both files where they are for the next one.
        let left = null;
        try {
            left = fs.readFileSync(aside);
        } catch (err) {
            if (!err || err.code !== 'ENOENT') {
                return {
                    ok: false, contended: false, cause: 'unclearable',
                    drained: 0, malformed: 0, rejected: 0,
                    detail: 'a file an earlier drain left aside could not be read, so the lines in it '
                        + 'were left there rather than renamed over: ' + errText(err)
                };
            }
        }
        if (left !== null) {
            try {
                appendRepaired(live, left);
            } catch (err) {
                return {
                    ok: false, contended: false, cause: 'unclearable',
                    drained: 0, malformed: 0, rejected: 0,
                    detail: 'a file an earlier drain left aside could not be folded back onto the spool, '
                        + 'so the lines in it were left there rather than renamed over: ' + errText(err)
                };
            }
            // The unlink is not in that guard, because by here the live file
            // holds these lines and the rotation below renames it onto this
            // very path: a file the unlink could not take away is replaced a
            // statement later by one carrying its contents. What a failure here
            // costs is nothing unless that rename fails too, which returns its
            // own reason below.
            try { fs.unlinkSync(aside); } catch { /* the rotation below takes it */ }
        }
        try {
            fs.renameSync(live, aside);
        } catch (err) {
            const code = err && err.code;
            if (code === 'ENOENT') return { ok: true, drained: 0, malformed: 0, rejected: 0 };
            return {
                ok: false, contended: false, cause: 'unclearable',
                drained: 0, malformed: 0, rejected: 0, detail: errText(err)
            };
        }

        const spool = readSpool(aside);
        if (spool.error !== undefined) {
            return {
                ok: false, contended: false, cause: 'unclearable',
                drained: 0, malformed: 0, rejected: 0, detail: spool.error
            };
        }

        // One type's lines, batch by batch. A refused batch is recorded as
        // undelivered and the loop goes on to the next one, since a batch
        // refused here is refused the same way on every future run and stopping
        // at it would leave it at the head of the queue for good. What the host
        // took is counted off its own answer: the lines of a refused batch go
        // back, and the rows a taken batch declined are delivered nowhere and
        // counted.
        //
        // A host that stopped answering ends the drain instead, both procedures
        // included, because the next batch would spend a whole spawn's clock
        // discovering the same silence. Every line then goes back untouched and
        // the next run sends them.
        //
        // A refusal is the host's own words, gathered per procedure rather than
        // one message per batch, because a spool every batch of which is refused
        // would otherwise report the same sentence a hundred times over.
        const delivered = new Map();
        const refused = new Map();
        let exhausted = null;
        let outage = null;
        let rejected = 0;
        const send = (type, procedure, parameter, rows) => {
            const took = new Set();
            delivered.set(type, took);
            for (let at = 0; at < rows.length; at += DRAIN_BATCH) {
                const budgetMs = batchBudget();
                if (budgetMs === null) {
                    // The deadline bounds the run rather than this procedure, so
                    // nothing after this may start either.
                    exhausted = 'the run budget was spent, so the rest of the spool was left for the next run';
                    return;
                }
                const batch = rows.slice(at, at + DRAIN_BATCH);
                const sent = callProcedure(config, procedure, { [parameter]: batch },
                    { ...opts, budgetMs });
                if (!sent.ok) {
                    // A cause this client did not set reads as an outage, the
                    // conservative side: a defect reported against a host that
                    // was merely away is the failure this split exists to
                    // prevent.
                    if (sent.cause !== 'refused') {
                        outage = 'the memory database stopped answering during the drain, so the spool was '
                            + 'left for the next run: ' + sent.detail;
                        return;
                    }
                    const held = refused.get(procedure)
                        || { batches: 0, lines: 0, detail: sent.detail };
                    held.batches += 1;
                    held.lines += batch.length;
                    refused.set(procedure, held);
                    continue;
                }
                rejected += Number(counted(sent.rows).rejected) || 0;
                for (let line = at; line < at + batch.length; line += 1) took.add(line);
            }
        };
        if (spool.usage.length > 0) send('usage', 'usp_AppendUsage', '@p_Usage', spool.usage);
        if (exhausted === null && outage === null && spool.outcomes.length > 0) {
            send('outcome', 'usp_AppendOutcomes', '@p_Outcomes', spool.outcomes);
        }
        let drained = 0;
        for (const took of delivered.values()) drained += took.size;
        // Everything the host did not take goes back to the live file, whether
        // that is one batch's lines or all of them, and the rotation is
        // finished either way before this reports anything.
        const back = putBack(live, aside, spool, delivered);
        // Every reason this drain fell short, in one place, because each has its
        // own remedy and a reader told only one of them fixes the wrong thing. A
        // refusal is a defect in what the client sends; an outage is a host to
        // wait for; a spool that could not be cleared is a disk. Where that last
        // one meets a drain that delivered something, it is also the one state
        // that costs the host a duplicate row, since the file aside still holds
        // lines the host took and the next drain folds it back and sends them
        // again. A duplicate stamp is a second row saying a memory was read,
        // which the decay pass reads as one more sign of life; a lost one is
        // evidence nobody can recover.
        //
        // The cause rides out beside them, one word for the whole drain, and a
        // refusal outranks an outage: a batch the server answered with a message
        // of its own is a defect somebody has to fix whatever else went wrong in
        // the same drain, while the others resolve themselves on a later run.
        const failures = [];
        for (const [procedure, held] of refused) {
            failures.push(procedure + ' refused ' + held.batches + (held.batches === 1 ? ' batch' : ' batches')
                + ' carrying ' + held.lines + ' line(s), which stay on the spool: ' + held.detail);
        }
        if (outage !== null) failures.push(outage);
        if (exhausted !== null) failures.push(exhausted);
        if (!back.ok) {
            failures.push('the spool could not be cleared, so the file this drain rotated aside still holds '
                + 'its lines' + (drained > 0 ? ', the delivered ones among them' : '') + ': ' + back.detail);
        }
        if (failures.length > 0) {
            return {
                ok: false,
                contended: false,
                cause: refused.size > 0 ? 'refused'
                    : outage !== null ? 'outage'
                        : exhausted !== null ? 'budget' : 'unclearable',
                drained,
                malformed: spool.malformed,
                rejected,
                detail: failures.join('; ')
            };
        }
        return { ok: true, drained, malformed: spool.malformed, rejected };
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
//
// A redirected store writes nothing either, for the reason isDefaultStoreRoot
// states: every publish leg refuses a non-default root, so a spool filling
// under one grows without bound and drains nowhere, which is the same shape as
// a machine with no database at all.
function deliver(entry, options) {
    const opts = options || {};
    const loaded = opts.config ? { ok: true, config: opts.config } : loadConfig(opts.configPath);
    if (!loaded.ok) return { delivered: false, spooled: false, reason: loaded.reason };
    if (!isDefaultStoreRoot()) return { delivered: false, spooled: false, reason: 'redirected' };
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
        embedded: 0, drained: 0, malformed: 0, rejected: 0, orphans: 0, failed: [], partial: false,
        outOfBudget: false
    };

    // The run's one deadline, and the two things every boundary call below asks
    // of it: whether it may start at all, and what clock it gets if it does.
    //
    // The clock is the caller's own budget or what is left of the run's,
    // whichever is smaller, so the budget bounds the chain rather than each link
    // separately. A call refused for want of budget ends the run where it stands
    // and the summary reports what the run did: the records already published
    // are published, every leg of this publish is re-derived from the files on
    // the next run, and nothing here is spooled, so stopping early costs a
    // repeat and never a row.
    const now = (typeof deps.now === 'function') ? deps.now : Date.now;
    const deadline = now() + RUN_BUDGET_MS;
    const budgetFor = (wantMs, floorMs) =>
        callBudget(deadline, now(), wantMs, floorMs === undefined ? SQLCMD_FLOOR_MS : floorMs);
    const stopped = (what) => {
        summary.outOfBudget = true;
        summary.failed.push('the run budget of ' + RUN_BUDGET_MS
            + ' ms was spent before ' + what + ', so that call and everything after it was not made');
        return { ok: true, summary };
    };

    // The reachability probe, spent before anything else so an unreachable host
    // is discovered in about the time one spawn costs rather than after a spool
    // drain and a first record batch at the full configured timeout. The hard
    // kill is the module's declared overshoot rather than the probe budget
    // itself, since a kill inside the tool's own floor would refuse every host
    // alive or dead.
    const probe = callProcedure(config, 'usp_Health', {},
        { deps, budgetMs: PROBE_TIMEOUT_MS, killMs: PROBE_TIMEOUT_MS + SQLCMD_FLOOR_MS });
    if (!probe.ok) return { ok: false, standDown: 'unreachable', detail: probe.detail };

    // The probe above takes no gate: it is the run's first act and the deadline
    // was read one statement earlier, so it starts inside the budget by
    // construction and a gate there could never answer anything but yes. The
    // gate opens here, at the first call that can be reached with the budget
    // already spent.
    const drainBudgetMs = budgetFor(config.timeoutMs);
    if (drainBudgetMs === null) return stopped('the spool drain');
    const drain = drainSpool(config, { deps, budgetMs: config.timeoutMs, deadline });
    summary.drained = drain.drained;
    summary.malformed = drain.malformed || 0;
    summary.rejected = drain.rejected || 0;
    // Whatever the drain answers is a fact about the spool and never a reason to
    // abandon the run. The probe above has already had the host's answer, so a
    // refusal here is evidence about the spool's own lines, a file that could
    // not be cleared or another publisher holding the lock, and the walk that
    // follows neither reads the spool nor writes to it. A host that has since
    // gone away is caught by the record batches below, which do stand the run
    // down.
    if (drain.detail) summary.failed.push('the spool: ' + drain.detail);

    const walk = collectRecords();
    // `partial` is the walk's own completeness and nothing else, because every
    // removal in this run is held back on it. A twinned record is reported
    // beside the rest and leaves it alone: its key is known to be backed by
    // files here, which the removal leg reads from duplicateKeys.
    summary.partial = walk.failed.length > 0 || walk.unscanned.length > 0;
    for (const entry of walk.failed) summary.failed.push(entry.reason);
    for (const entry of walk.duplicates) summary.failed.push(entry.reason);

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
        if (!sent.ok) return { ok: false, standDown: 'unreachable', detail: sent.detail };
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

    const identity = modelIdentity(config);
    const listBudgetMs = budgetFor(config.timeoutMs);
    if (listBudgetMs === null) return stopped('the inventory read');
    const listed = callProcedure(config, 'usp_ListRecords', { '@p_ModelIdentity': identity },
        { deps, budgetMs: listBudgetMs });
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
        const budgetMs = budgetFor(UPSERT_TIMEOUT_MS);
        if (budgetMs === null) return stopped('the removal marking');
        const marked = callProcedure(config, 'usp_UpsertRecords',
            { '@p_Records': [], '@p_Removed': removed }, { deps, budgetMs });
        if (!marked.ok) return { ok: false, standDown: 'unreachable', detail: marked.detail };
        summary.removed = Number(counted(marked.rows).removed) || 0;
    }

    const embedded = await embedRecords(config, toEmbed, { deps, deadline });
    summary.embedded = embedded.embedded;
    for (const reason of embedded.failed) summary.failed.push(reason);
    if (embedded.outOfBudget !== null) return stopped(embedded.outOfBudget);

    const orphans = collectOrphans();
    summary.orphans = orphans.length;
    if (orphans.length > 0) {
        const budgetMs = budgetFor(config.timeoutMs);
        if (budgetMs === null) return stopped('the index orphans');
        const sent = callProcedure(config, 'usp_UpsertIndexOrphans', { '@p_Orphans': orphans },
            { deps, budgetMs });
        if (!sent.ok) summary.failed.push('the index orphans were not recorded: ' + sent.detail);
    }

    const runBudgetMs = budgetFor(config.timeoutMs);
    if (runBudgetMs === null) return stopped('the publish run record');
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
    }, { deps, budgetMs: runBudgetMs });
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
    const out = { embedded: 0, failed: [], outOfBudget: null };

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
        out.embedded += taken.length;
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
        + (summary.rejected > 0 ? ', ' + summary.rejected
            + ' spool line(s) the host would not record' : '')
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
    return 'the memory database config at ' + result.path + ' is ' + result.standDown
        + (result.detail ? ' (' + result.detail + ')' : '');
}

module.exports = {
    CONFIG_FILE,
    SPOOL_FILE,
    SPOOL_LOCK_FILE,
    RECORD_BATCH,
    DRAIN_BATCH,
    CHUNK_TARGET_CHARS,
    CHUNK_MIN_CHARS,
    CHUNK_MAX_CHARS,
    PROBE_TIMEOUT_MS,
    LOCK_WAIT_MS,
    UPSERT_TIMEOUT_MS,
    RUN_BUDGET_MS,
    DRAIN_LOCK_STALE_CEILING_MS,
    configPath,
    spoolPath,
    spoolLockPath,
    isDefaultStoreRoot,
    loadConfig,
    modelIdentity,
    sqlcmdPath,
    childEnvironment,
    clockSeconds,
    callBudget,
    embedCallWidth,
    payloadLiteral,
    carriesServerMessage,
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
