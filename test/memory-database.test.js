// The memory database client: the publish sequence, the local queue, the
// chunker and the transport's own encoding.
//
// Two levels run here. Most cases drive scripts/memory-database.js in process
// with the two boundary calls replaced: `deps.runBatch` stands in for the
// sqlcmd spawn and `deps.embedBatch` for the embedding server. The fake server
// below is a real little server rather than a stub returning constants, because
// every count this section reports is the database's answer and a stub would be
// this file asserting its own arithmetic.
//
// The rest run the CLI as a child against a store fixture, which is the only
// way to prove the property the queue exists for: the local write happens and
// the stamp is still not lost when the host does not answer.
//
// No case here reaches a network, a real SQL Server or a real embedding server,
// with one exception: the scoped search case at the end of this file runs
// against the real host, and only under KIT_MEMORY_DB_LIVE=1. Presence of the
// operator's real config never enables it: the environment variable is the
// only switch.
// The one config field this file never writes is the password: every fixture
// config uses Windows authentication, and where the password's handling is the
// subject the client's own source is read instead.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
// The queue this client keeps is a SQLite file, so the cases that read one back
// open it the way the client does: through node's own built-in binding, with no
// dependency either side.
const { DatabaseSync } = require('node:sqlite');

const SCRIPTS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts');
const MEMQ = path.join(SCRIPTS, 'memq.js');
const CLIENT_SOURCE = path.join(SCRIPTS, 'memory-database.js');
const db = require(CLIENT_SOURCE);
// The local semantic index, which owns the two values a publish must agree
// with it about: the embedder's batch width and the body hash.
const mi = require(path.join(SCRIPTS, 'memory-index.js'));
// The kit's one home-directory elision, which is what the client runs a
// sentence through on its way to the host.
const { scrub, homeElisionsKnown } = require(path.join(__dirname, '..', 'plugins', 'claude-kit',
    'hooks', 'kit-compact-lib.js'));
const LIVE = process.env.KIT_MEMORY_DB_LIVE === '1';

// ------------------------------------------------------------- the fixtures --

// A store root with a project segment, plus the working directory that resolves
// to it. The layout is the store's own: <root>/projects/<segment>/memory,
// <root>/memory-types/<type> and <root>/memory-operator.
// The store root is pointed at through the environment for the store's whole
// lifetime rather than around each call, because the publish is asynchronous:
// a wrapper that restored the variable when the call returned would put the
// machine's own store back under everything the publish does after its first
// await. The second signal rides along, since memq honors the override only
// with it. Cases in one file run one at a time, so one store is in force at a
// time.
function makeStore() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-root-'));
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-proj-'));
    const segment = proj.replace(/[^A-Za-z0-9]/g, '-');
    const memDir = path.join(root, 'projects', segment, 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const before = { root: process.env.KIT_MEMORY_ROOT, allow: process.env.KIT_MEMORY_ROOT_ALLOW_DATA };
    process.env.KIT_MEMORY_ROOT = root;
    process.env.KIT_MEMORY_ROOT_ALLOW_DATA = '1';
    return { root, proj, segment, memDir, before };
}

function rmStore(store) {
    if (store.before.root === undefined) delete process.env.KIT_MEMORY_ROOT;
    else process.env.KIT_MEMORY_ROOT = store.before.root;
    if (store.before.allow === undefined) delete process.env.KIT_MEMORY_ROOT_ALLOW_DATA;
    else process.env.KIT_MEMORY_ROOT_ALLOW_DATA = store.before.allow;
    for (const dir of [store.root, store.proj]) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a temp directory left behind never fails a case */ }
    }
}

// A store that IS this process's own default store: a temp home whose .claude
// directory is the store root, with no KIT_MEMORY_ROOT set at all. os.homedir()
// reads USERPROFILE on Windows and HOME elsewhere, so pointing both at a temp
// directory moves the machine's own store for the length of a case. The stamp
// writers refuse a redirected root outright, so this is the fixture any case
// that queues a stamp in process has to take.
function makeDefaultStore() {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-default-'));
    const root = path.join(home, '.claude');
    const segment = 'kitdb-segment';
    const memDir = path.join(root, 'projects', segment, 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const before = {
        root: process.env.KIT_MEMORY_ROOT, allow: process.env.KIT_MEMORY_ROOT_ALLOW_DATA,
        home: process.env.HOME, profile: process.env.USERPROFILE
    };
    delete process.env.KIT_MEMORY_ROOT;
    delete process.env.KIT_MEMORY_ROOT_ALLOW_DATA;
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    return { home, root, segment, memDir, before };
}

function rmDefaultStore(store) {
    for (const [name, value] of [['KIT_MEMORY_ROOT', store.before.root],
        ['KIT_MEMORY_ROOT_ALLOW_DATA', store.before.allow],
        ['HOME', store.before.home], ['USERPROFILE', store.before.profile]]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
    try { fs.rmSync(store.home, { recursive: true, force: true }); } catch { /* a temp directory left behind never fails a case */ }
}

// One record file plus its index line, in whichever tier directory is named.
function writeRecord(dir, name, body, description) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.md'), body, 'utf8');
    const index = path.join(dir, 'MEMORY.md');
    const line = '- [' + name + '](' + name + '.md) - ' + (description || 'a record') + '\n';
    fs.appendFileSync(index, fs.existsSync(index) ? line : '# Memory\n' + line, 'utf8');
}

// A client config as loadConfig returns it. Windows authentication, so no case
// here writes a password into this repository, and an embedding address nothing
// listens on, since every case replaces the embedding call.
function config(extra) {
    return {
        server: 'kit-db-test',
        database: 'KitMemoryTest',
        login: '',
        password: '',
        timeoutMs: 10000,
        windowsAuth: true,
        trustServerCertificate: false,
        embedding: { url: 'http://127.0.0.1:1', model: 'test-model' },
        ...(extra || {})
    };
}

// ------------------------------------------------------------- the fake host --

// The JSON a batch carries, read back out of the batch text the client wrote.
// Read rather than intercepted before the encoding, so every case that asserts
// on a payload also asserts that the escaping round-trips: the client sends
// pure ASCII with its quotes doubled, in pieces, and this is the other end of
// that.
function payloadOf(batch, variable) {
    const prefix = ';SET ' + variable + ' = ' + variable + ' + N\'';
    let text = '';
    for (const line of batch.split('\n')) {
        if (!line.startsWith(prefix)) continue;
        text += line.slice(prefix.length, -1).replace(/''/g, '\'');
    }
    return JSON.parse(text);
}

// One call as the client wrote it: the procedure and its parameters by name.
function parseCall(batch) {
    const exec = /EXEC mem\.(\w+)(.*)$/m.exec(batch);
    assert.ok(exec, 'the batch calls a procedure: ' + batch);
    const parameters = {};
    for (const m of exec[2].matchAll(/(@p_\w+) = (@v\d+)/g)) {
        const scalar = new RegExp('^;DECLARE ' + m[2] + ' NVARCHAR\\(200\\) = N\'(.*)\'$', 'm').exec(batch);
        parameters[m[1]] = scalar ? scalar[1] : payloadOf(batch, m[2]);
    }
    return { procedure: exec[1], parameters };
}

// A memory of what the host holds, and a runBatch that answers out of it.
//
// It keeps what the real procedures keep: a record per (tier, segment, file
// key) with its body hash and its embeddings, the usage and outcome rows, the
// orphan list and the publish runs. Its dispositions are the real ones, added,
// changed and unchanged, and it drops a record's embeddings when its body hash
// moves, which is what makes the embedded flag it reports on the next run true.
// Its inventory rows carry archived and embedded as booleans, which is what the
// real reader puts on the wire: both are BIT columns and FOR JSON writes a BIT
// as true or false.
function fakeHost(options) {
    const opts = options || {};
    const host = {
        records: new Map(),
        usage: [],
        outcomes: [],
        orphans: [],
        runs: [],
        // The stamp ids the two append tables hold, which is the unique index
        // the real procedures skip against.
        stamps: new Set(),
        // The (record, chunk, model) keys the embedding table holds, which is
        // the upsert key the real procedure counts an update against.
        vectors: new Set(),
        calls: [],
        embedCalls: [],
        nextId: 100,
        fail: new Set(opts.fail || []),
        onCall: opts.onCall || null
    };
    const key = (r) => r.tier + '\u0000' + (r.segment === null || r.segment === undefined ? '' : r.segment) + '\u0000' + r.fileKey;

    host.runBatch = (cfg, batch, callOptions) => {
        const call = parseCall(batch);
        host.calls.push({ procedure: call.procedure, parameters: call.parameters, budgetMs: callOptions.budgetMs, killMs: callOptions.killMs });
        if (host.onCall) host.onCall(call);
        // A refusal, which the real transport tells from an outage by the
        // envelope the server's own message arrives in and reports as its
        // `cause`. A fake that answered the bare false would be simulating a
        // host that went away, which is the other disposition entirely.
        if (host.fail.has(call.procedure)) {
            return { ok: false, cause: 'refused', detail: 'the host refused ' + call.procedure };
        }

        if (call.procedure === 'usp_AppendUsage') {
            // The real procedure resolves each stamp against the records the
            // caller may see and drops one that resolves to none, answering with
            // the count rather than the identity. `resolvesStamps` is that
            // resolution, which the cases about when the drain runs take: with
            // it, a stamp for a record this host has never been told about is
            // rejected exactly as mem.usp_AppendUsage rejects it. Without it any
            // stamp is taken, which keeps the cases about the drain's own
            // mechanics on the drain.
            //
            // The skip is the unique index over the stamp id, which is what
            // makes delivery idempotent: a row whose id this table already holds
            // is counted and not written, exactly as the filtered unique index
            // on mem.Usage refuses it.
            const rows = call.parameters['@p_Usage'];
            let appended = 0;
            let rejected = 0;
            for (const row of rows) {
                if (opts.resolvesStamps && !host.records.has(key(row))) {
                    rejected += 1;
                    continue;
                }
                if (row.stampId !== undefined && row.stampId !== null
                    && host.stamps.has(row.stampId)) continue;
                if (row.stampId !== undefined && row.stampId !== null) host.stamps.add(row.stampId);
                host.usage.push(row);
                appended += 1;
            }
            return { ok: true, rows: [{ appended, rejected, skipped: rows.length - rejected - appended }] };
        }
        if (call.procedure === 'usp_AppendOutcomes') {
            const rows = call.parameters['@p_Outcomes'];
            let appended = 0;
            for (const row of rows) {
                if (row.stampId !== undefined && row.stampId !== null
                    && host.stamps.has(row.stampId)) continue;
                if (row.stampId !== undefined && row.stampId !== null) host.stamps.add(row.stampId);
                host.outcomes.push(row);
                appended += 1;
            }
            return { ok: true, rows: [{ appended, skipped: rows.length - appended }] };
        }
        if (call.procedure === 'usp_Health') {
            return {
                ok: true,
                rows: [{
                    schemaVersion: opts.schemaVersion === undefined
                        ? db.REQUIRED_SCHEMA_VERSION : opts.schemaVersion,
                    sharedRecords: host.records.size,
                    sandboxes: []
                }]
            };
        }
        if (call.procedure === 'usp_UpsertRecords') {
            const counts = { added: 0, changed: 0, unchanged: 0, skippedOlder: 0, removed: 0 };
            for (const record of call.parameters['@p_Records']) {
                const at = key(record);
                const held = host.records.get(at);
                if (held === undefined) {
                    host.nextId += 1;
                    host.records.set(at, {
                        recordId: host.nextId, tier: record.tier, segment: record.segment,
                        fileKey: record.fileKey, name: record.name, archived: record.archived,
                        visibility: record.tier === 'project' ? 'private' : 'shared',
                        bodyHash: record.bodyHash, fileModified: record.fileModified, embedded: false
                    });
                    counts.added += 1;
                } else if (record.tier !== 'project'
                    && held.fileModified !== undefined && record.fileModified < held.fileModified) {
                    // The real procedure's `older` disposition: the host keeps
                    // its newer body and stamps the row's last-published time.
                    // It is reached only for a row whose store carries no
                    // sandbox, which is a type or operator store, so a project
                    // row is never answered older however its times compare.
                    counts.skippedOlder += 1;
                } else if (held.bodyHash !== record.bodyHash || held.name !== record.name) {
                    held.bodyHash = record.bodyHash;
                    held.name = record.name;
                    held.archived = record.archived;
                    held.fileModified = record.fileModified;
                    held.embedded = false;
                    counts.changed += 1;
                } else {
                    held.archived = record.archived;
                    counts.unchanged += 1;
                }
            }
            for (const removal of (call.parameters['@p_Removed'] || [])) {
                const at = key({ tier: 'project', segment: removal.segment, fileKey: removal.fileKey });
                if (host.records.delete(at)) counts.removed += 1;
            }
            return { ok: true, rows: [counts] };
        }
        if (call.procedure === 'usp_ListRecords') {
            const model = call.parameters['@p_ModelIdentity'];
            assert.strictEqual(typeof model, 'string', 'the reader takes the model identity as a scalar');
            return {
                ok: true,
                rows: [...host.records.values()].map((r) => ({
                    recordId: r.recordId, tier: r.tier, segment: r.segment === undefined ? null : r.segment,
                    fileKey: r.fileKey, name: r.name, archived: Boolean(r.archived),
                    visibility: r.visibility, embedded: Boolean(r.embedded) && r.model === model
                }))
            };
        }
        if (call.procedure === 'usp_UpsertEmbeddings') {
            // One vector row per chunk, counted the way the real procedure
            // counts them: a row whose record the caller may not see is
            // rejected and counted rather than written, and a row for a
            // (record, chunk, model) key the table already holds is an update
            // rather than an insert. The counts are the only thing that comes
            // back, so the client learns how many rows landed and never which.
            const rows = call.parameters['@p_Embeddings'];
            host.embedCalls.push(rows);
            let inserted = 0;
            let updated = 0;
            let rejected = 0;
            for (const row of rows) {
                const record = [...host.records.values()].find((r) => r.recordId === row.recordId);
                if (record === undefined) { rejected += 1; continue; }
                const at = row.recordId + '\u0000' + row.chunkIndex + '\u0000' + row.model;
                if (host.vectors.has(at)) updated += 1;
                else { host.vectors.add(at); inserted += 1; }
                record.embedded = true;
                record.model = row.model;
            }
            return { ok: true, rows: [{ inserted, updated, rejected }] };
        }
        if (call.procedure === 'usp_UpsertIndexOrphans') {
            host.orphans = call.parameters['@p_Orphans'];
            return { ok: true, rows: [{ inserted: host.orphans.length, updated: 0 }] };
        }
        if (call.procedure === 'usp_AppendPublishRun') {
            host.runs.push(call.parameters['@p_Run']);
            return { ok: true, rows: [{ publishRunId: host.runs.length }] };
        }
        assert.fail('the client called a procedure this host does not serve: ' + call.procedure);
        return { ok: false, detail: 'unreachable' };
    };
    return host;
}

// One row the fake host holds, found by the fields a caller names it by rather
// than by the composite key, which carries a separator byte no source line
// should have to spell.
function rowFor(host, tier, fileKey) {
    return [...host.records.values()].find((r) => r.tier === tier && r.fileKey === fileKey);
}

// The embedding server, answering one vector per text.
function fakeEmbedder(record) {
    return async (cfg, texts) => {
        if (record) record.push(texts);
        return { ok: true, vectors: texts.map((t) => [t.length, 1]) };
    };
}

// Make one directory unreadable to the walk for the duration of fn. Windows
// leaves an ordinary directory readable whatever its permissions say, so the
// failure is injected at the filesystem call this process makes, which is the
// same call an EACCES would fail at.
async function withUnreadableDir(dir, fn) {
    const real = fs.readdirSync;
    fs.readdirSync = function (target, ...rest) {
        if (typeof target === 'string' && path.resolve(target) === path.resolve(dir)) {
            const err = new Error('EACCES: permission denied');
            err.code = 'EACCES';
            throw err;
        }
        return real.call(this, target, ...rest);
    };
    try {
        return await fn();
    } finally {
        fs.readdirSync = real;
    }
}

function publishWith(store, host, extra) {
    return db.publish({
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: fakeEmbedder(extra && extra.texts) }
    });
}

// ------------------------------------------------------------- the stand-down --

test('with no client config the publish stands down: nothing is spawned, nothing is embedded, nothing is queued', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\nsome body text\n');
        let spawned = 0;
        let embedded = 0;
        const result = await db.publish({
            configPath: path.join(store.root, 'no-such-config.json'),
            deps: {
                runBatch: () => { spawned += 1; return { ok: true, rows: [] }; },
                embedBatch: async () => { embedded += 1; return { ok: true, vectors: [] }; }
            }
        });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.standDown, 'absent');
        assert.strictEqual(spawned, 0, 'a machine with no database config spawns nothing');
        assert.strictEqual(embedded, 0, 'and embeds nothing');
        assert.ok(!fs.existsSync(db.queuePath()), 'and creates no queue at all');
        assert.ok(db.standDownText(result).includes('no-such-config.json'),
            'the stand-down names the file it looked for: ' + db.standDownText(result));

        // The control, withheld from the assertion above: the same store with a
        // config present does spawn, so the silence is the absent config and
        // not a publish that never reaches its transport.
        const host = fakeHost();
        const ran = await publishWith(store, host);
        assert.strictEqual(ran.ok, true, JSON.stringify(ran));
        assert.ok(host.calls.length > 0, 'the control must reach the transport');
    } finally {
        rmStore(store);
    }
});

test('a stamp stands down the same way: no config means no spawn and no queue row', () => {
    const store = makeDefaultStore();
    try {
        let spawned = 0;
        const answered = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            {
                configPath: path.join(store.root, 'no-such-config.json'),
                deps: { runBatch: () => { spawned += 1; return { ok: true, rows: [] }; } }
            });
        assert.deepStrictEqual(answered, { delivered: false, queued: false, reason: 'absent' });
        assert.strictEqual(spawned, 0);
        assert.ok(!fs.existsSync(db.queuePath()),
            'a queue that filled on a machine with no database would drain nowhere, so none is '
            + 'even created');

        // The control: with a config, the same stamp is written.
        const queued = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            { config: config(), deps: { runBatch: () => ({ ok: false, detail: 'refused' }) } });
        assert.deepStrictEqual(queued, { delivered: false, queued: true, reason: 'queued' });
        assert.strictEqual(queueCount(), 1);
    } finally {
        rmDefaultStore(store);
    }
});

// A redirected store is a store no publish will ever drain: every publish leg
// refuses a non-default root, because the credential comes from the home
// directory whatever store the walk read. A stamp writer that queued there
// anyway would grow a file without bound on every worker session, and report
// each row as queued while it did it.
test('a stamp under a redirected store is refused rather than queued', () => {
    const store = makeStore();
    try {
        const answered = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            { config: config() });
        assert.deepStrictEqual(answered, { delivered: false, queued: false, reason: 'redirected' });
        assert.ok(!fs.existsSync(db.queuePath()),
            'nothing is written under a root nothing drains');
    } finally {
        rmStore(store);
    }

    // The control, withheld from the assertion above: the same call under this
    // machine's own store does queue the stamp, so the refusal is the
    // redirection rather than a writer that writes nothing.
    const own = makeDefaultStore();
    try {
        const queued = db.deliver(
            db.usageEntry('project', own.segment, 'a-record', 'a-record.md', 'read'),
            { config: config() });
        assert.deepStrictEqual(queued, { delivered: false, queued: true, reason: 'queued' });
        assert.strictEqual(queueCount(), 1);
    } finally {
        rmDefaultStore(own);
    }
});

// The interactive path's whole shape, and the reason it is worth a case of its
// own: a stamp is offered a few hundred milliseconds, which does not fund a
// cold client-tool start plus a TLS negotiation plus a login, so an attempt
// made under that clock is killed on a healthy host as reliably as on a dead
// one and costs the session the wait either way. Worse, a kill landing after
// the server committed the row and before its answer was read queues a row the
// host already holds, which only the stamp id on the wire makes harmless. So the
// stamp goes on the queue and the publish delivers it.
test('an interactive stamp reaches the queue without a database call of any kind', () => {
    const store = makeDefaultStore();
    try {
        const seen = [];
        const answered = db.deliver(
            db.usageEntry('type', 'sometype', 'a-record', 'a-record.md', 'applied'),
            {
                config: config(),
                deps: {
                    runBatch: (cfg, batch, opts) => { seen.push(opts); return { ok: true, rows: [{ appended: 1 }] }; }
                }
            });
        assert.deepStrictEqual(answered, { delivered: false, queued: true, reason: 'queued' });
        assert.deepStrictEqual(seen, [],
            'the interactive path spawns nothing: a host that would have answered is not asked');

        const rows = queueEntries();
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(queueRows()[0].kind, 'usage',
            'the column says which procedure the row is bound for: '
            + JSON.stringify(queueRows()[0]));
        assert.strictEqual(rows[0].type, undefined,
            'and that is the column rather than a key the procedure does not name: '
            + JSON.stringify(rows[0]));
        assert.deepStrictEqual(
            {
                tier: rows[0].tier, segment: rows[0].segment,
                name: rows[0].name, fileKey: rows[0].fileKey, kind: rows[0].kind
            },
            { tier: 'type', segment: 'sometype', name: 'a-record', fileKey: 'a-record.md', kind: 'applied' },
            'the queue row is the row usp_AppendUsage reads');
        assert.strictEqual(typeof rows[0].at, 'string', 'and it carries the time the stamp was taken');
        assert.strictEqual(typeof queueRows()[0].created_at, 'string',
            'beside the time the queue took it, which is the queue\'s own column');

        // The control, withheld from the assertion above: the same fake does
        // record a call when the publish makes one, so the empty list is the
        // stamp path making none rather than a fake that never fills.
        const host = fakeHost();
        db.drainQueue(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.ok(host.calls.length > 0, 'the control must reach the transport');
    } finally {
        rmDefaultStore(store);
    }
});

// ------------------------------------------------------------------ the queue --

// The queue as rows, for the cases whose assertion is what the drain left on it.
// A file that is not there is an empty queue rather than an error: nothing has
// ever been written under this store.
// The file is named rather than assumed, because the CLI cases read the queue a
// child process wrote under its own home directory.
function queueRowsAt(file) {
    if (!fs.existsSync(file)) return [];
    const handle = new DatabaseSync(file);
    try {
        return handle.prepare('SELECT id, kind, payload, created_at FROM queue '
            + 'ORDER BY created_at, id').all();
    } finally {
        handle.close();
    }
}

function queueRows() {
    return queueRowsAt(db.queuePath());
}

function queueCount() {
    return queueRows().length;
}

// The rows as the entries their writers composed, which is what a case asserting
// on a stamp's own fields reads. The queue's own kind column is not folded in
// here: a usage entry carries a `kind` of its own, the read or applied the stamp
// attests, and the column beside it says which procedure the row is bound for.
// One name over the two would hide whichever was written second.
function entriesOf(rows) {
    return rows.map((row) => JSON.parse(row.payload));
}

function queueEntries() {
    return entriesOf(queueRows());
}

// The queue's write lock, taken by this case and held until it releases it.
//
// It is a real SQLite transaction on a second connection rather than anything
// this file invents, because the lock the client meets is SQLite's own: a writer
// or a drain that cannot take it waits the constructor's busy timeout out and
// then fails with the library's own busy code, which is the state these cases
// are about. The queue must already exist with its table, so a case takes this
// after it has written a row.
function holdQueueLock() {
    const handle = new DatabaseSync(db.queuePath(), { timeout: 0 });
    handle.exec('BEGIN EXCLUSIVE');
    return {
        release() {
            try { handle.exec('ROLLBACK'); } catch { /* a connection that closes rolls back anyway */ }
            handle.close();
        }
    };
}

// The drain, at the version the client requires, against a host that answers.
function drainAgainst(host, extra) {
    return db.drainQueue(config(), {
        deps: { runBatch: host.runBatch },
        schemaVersion: db.REQUIRED_SCHEMA_VERSION,
        ...(extra || {})
    });
}

// THE FILE IS A DATABASE AND NOT A LOG, AND EVERY PROPERTY BELOW RESTS ON THAT.
// The table is what the drain selects from and what a writer inserts into, the
// primary key is the stamp id the host's own unique index dedupes on, and WAL
// plus the busy timeout are what replaced every lock file this client used to
// keep. A queue opened without WAL would block a reader behind a writer, and one
// opened without the timeout would fail a stamp the moment a publish held the
// write lock rather than waiting it out.
test('the queue is a SQLite file in WAL mode, with the busy wait set and the schema the drain reads', () => {
    const store = makeStore();
    try {
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const file = db.queuePath();
        assert.ok(file.endsWith('kit-memory-db-queue.sqlite'),
            'the queue sits at the store root under its own name: ' + file);
        assert.strictEqual(path.dirname(file), path.resolve(store.root),
            'beside the client config rather than inside a tier: ' + file);

        const handle = new DatabaseSync(file);
        try {
            assert.strictEqual(handle.prepare('PRAGMA journal_mode').get().journal_mode, 'wal',
                'the file is in write-ahead logging mode, so a reader and a writer hold it at once');
            const columns = handle.prepare('PRAGMA table_info(queue)').all();
            assert.deepStrictEqual(columns.map((c) => c.name), ['id', 'kind', 'payload', 'created_at'],
                'the table is the four columns the drain reads: ' + JSON.stringify(columns));
            assert.strictEqual(columns.find((c) => c.name === 'id').pk, 1,
                'and the stamp id is its primary key, which is the identity the host dedupes on');
        } finally {
            handle.close();
        }

        // The busy wait, read off the client's own source because it is the
        // constructor's option and no call here can see it from outside. Which
        // wait each caller takes is not read here: it is behaviour, and the two
        // cases below pin it from the outside, one over a drain that waits a
        // holder out and one over a writer that does not.
        const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
        assert.ok(/new DatabaseSync\(target, \{ timeout: busyMs \}\)/.test(source),
            'every connection this client opens carries a busy timeout');
        assert.ok(db.QUEUE_BUSY_TIMEOUT_MS >= 1000,
            'which is long enough to wait out a holder doing local file work: '
            + db.QUEUE_BUSY_TIMEOUT_MS);
        assert.ok(db.QUEUE_BUSY_TIMEOUT_QUICK_MS > 0
            && db.QUEUE_BUSY_TIMEOUT_QUICK_MS < db.QUEUE_BUSY_TIMEOUT_MS,
            'and the wait a caller on a session\'s budget takes is shorter than it: '
            + db.QUEUE_BUSY_TIMEOUT_QUICK_MS);
    } finally {
        rmStore(store);
    }
});

test('a drain whose sends all succeed deletes exactly those rows and reports the count', () => {
    const store = makeStore();
    try {
        db.queueInsert([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        assert.strictEqual(queueCount(), 2, 'the two writers each left one row');
        assert.deepStrictEqual(queueRows().map((r) => r.kind).sort(), ['outcome', 'usage'],
            'each row says which procedure it is bound for');

        const host = fakeHost();
        const drained = drainAgainst(host);
        assert.deepStrictEqual(drained, { ok: true, drained: 2, remaining: 0, rejected: 0 });
        assert.strictEqual(queueCount(), 0,
            'a fully delivered queue keeps no row the host has: ' + JSON.stringify(queueRows()));
        assert.strictEqual(host.usage.length, 1);
        assert.strictEqual(host.outcomes.length, 1);
        assert.strictEqual(host.outcomes[0].actionKey, 'an-action');
        // The type field is the column now, so it never rides in the payload the
        // procedure reads.
        assert.strictEqual(host.usage[0].type, undefined,
            'the kind is a column rather than a key the procedure does not name: '
            + JSON.stringify(host.usage[0]));
    } finally {
        rmStore(store);
    }
});

// The idempotence the whole design rests on. The client does not track which of
// its rows the host took, so every row it sends carries an id the server dedupes
// on: mem.Usage and mem.Outcome each hold a unique index over that column and
// each append procedure inserts only the ids its table does not already hold.
// Without the id on the wire the server has nothing to dedupe by and a drain
// that deleted nothing would double every row on the next run.
test('every queue row carries a stamp id, and a row sent twice inserts once', () => {
    const store = makeStore();
    try {
        const usage = db.usageEntry('project', store.segment, 'one', 'one.md', 'read');
        const outcome = db.outcomeEntry(store.segment,
            { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' });
        for (const [what, entry] of [['a usage stamp', usage], ['an outcome', outcome]]) {
            assert.strictEqual(typeof entry.stampId, 'string', what + ' carries a stamp id');
            assert.ok(entry.stampId.length > 0 && entry.stampId.length <= 64,
                what + '\'s id fits the column the unique index is on: ' + entry.stampId);
        }
        assert.notStrictEqual(usage.stampId, outcome.stampId, 'two rows never share an id');
        assert.notStrictEqual(db.usageEntry('project', store.segment, 'one', 'one.md', 'read').stampId,
            usage.stampId, 'and two stamps of the same record never do either');

        // The id is the row's own primary key, so the queue and the host agree on
        // what identifies a row without either being told.
        db.queueInsert([usage, outcome]);
        assert.deepStrictEqual(queueRows().map((r) => r.id).sort(),
            [usage.stampId, outcome.stampId].sort(),
            'the queue keys a row by the same id the host dedupes on');

        // The id reaches the server on the wire, read back out of the batch text
        // the client wrote rather than from the object it was handed.
        const host = fakeHost();
        assert.strictEqual(drainAgainst(host).ok, true);
        assert.strictEqual(host.usage[0].stampId, usage.stampId,
            'the stamp id survived the JSON payload and the escaping: ' + JSON.stringify(host.usage[0]));
        assert.strictEqual(host.outcomes[0].stampId, outcome.stampId);

        // The same two rows written again and drained against the same host,
        // which is what a drain that deleted nothing makes happen on the next
        // run. The host holds one row of each, because its unique index refuses
        // the second.
        db.queueInsert([usage, outcome]);
        assert.strictEqual(drainAgainst(host).ok, true);
        assert.strictEqual(host.usage.length, 1, 'a resent stamp inserts once: ' + JSON.stringify(host.usage));
        assert.strictEqual(host.outcomes.length, 1, 'and so does a resent outcome');

        // The control, withheld from the assertions above: a row carrying a
        // different id is a different row and does insert, so the one row above
        // is the index and not a host that stopped accepting rows.
        db.queueInsert([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
        assert.strictEqual(drainAgainst(host).ok, true);
        assert.strictEqual(host.usage.length, 2, JSON.stringify(host.usage));
    } finally {
        rmStore(store);
    }
});

// A batch the procedure refuses is a contract defect between this client and
// that procedure rather than an operational state. Nothing is deleted, the
// server's own words go out on a surface a person reads, and the queue grows
// until somebody repairs the contract; that growth is the signal. Destroying the
// rows instead is the loss this whole mechanism exists to prevent.
test('a drain the server refuses deletes nothing and reports the server\'s own text', () => {
    const store = makeStore();
    try {
        db.queueInsert([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const before = queueRows();

        const refusing = fakeHost({ fail: ['usp_AppendUsage'] });
        const failed = drainAgainst(refusing);
        assert.strictEqual(failed.ok, false, JSON.stringify(failed));
        assert.strictEqual(failed.cause, 'refused', JSON.stringify(failed));
        assert.strictEqual(failed.drained, 0, 'nothing came off the queue, so nothing is reported drained');
        assert.strictEqual(failed.remaining, 2, 'and the count says what is still there');
        assert.deepStrictEqual(queueRows(), before,
            'every row is exactly as it was: a stamp delivered nowhere and deleted anyway is the '
            + 'loss this mechanism exists to prevent');
        assert.ok(/usp_AppendUsage/.test(failed.detail), 'the refusal names the procedure: ' + failed.detail);
        assert.ok(/the host refused usp_AppendUsage/.test(failed.detail),
            'and carries the server\'s own words rather than a bare errno: ' + failed.detail);
        assert.ok(/keeps every row/.test(failed.detail),
            'and says what happened to the queue: ' + failed.detail);
        assert.strictEqual(refusing.outcomes.length, 1,
            'a refusal is a fact about one procedure\'s rows and stands the other one down');

        // The control, withheld from the assertions above: the same rows against
        // a host that refuses nothing drain and empty the queue, so what stayed
        // above stayed for the refusal rather than for something about the rows.
        const host = fakeHost();
        assert.deepStrictEqual(drainAgainst(host), { ok: true, drained: 2, remaining: 0, rejected: 0 });
        assert.strictEqual(queueCount(), 0);
    } finally {
        rmStore(store);
    }
});

// The other disposition, told apart before either is reported. A refusal names a
// defect and asks for a fix; an outage asks for nothing but the next run, and a
// host that blinks once would otherwise open a defect that is not there and make
// noise of the queue growth that is supposed to be the signal.
test('a drain whose transport fails deletes nothing and reports the transport\'s own text', () => {
    const store = makeStore();
    try {
        db.queueInsert([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const before = queueRows();

        const attempted = [];
        const gone = (cfg, text) => {
            attempted.push(parseCall(text).procedure);
            return {
                ok: false,
                cause: 'outage',
                detail: 'sqlcmd exited 1: TCP Provider: No connection could be made'
            };
        };
        const out = db.drainQueue(config(), {
            deps: { runBatch: gone }, schemaVersion: db.REQUIRED_SCHEMA_VERSION
        });
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'outage',
            'the drain carries the cause out rather than one false for both: ' + JSON.stringify(out));
        assert.strictEqual(out.drained, 0);
        assert.deepStrictEqual(queueRows(), before, 'and every row is still there');
        assert.ok(/No connection could be made/.test(out.detail),
            'the transport\'s own words reach a reader: ' + out.detail);
        assert.ok(!/refused/.test(out.detail), 'and a silent host is never worded as a refusal: ' + out.detail);
        assert.deepStrictEqual(attempted, ['usp_AppendUsage'],
            'nothing after it is attempted, since the second call would spend a whole spawn\'s clock '
            + 'discovering the same silence: ' + attempted.join(', '));

        // The control, withheld from the assertion above: the same false carrying
        // a refusal instead does let the second procedure go, so the single call
        // above is the outage rather than a drain that only ever makes one.
        const refusing = fakeHost({ fail: ['usp_AppendUsage'] });
        const no = drainAgainst(refusing);
        assert.strictEqual(no.cause, 'refused', JSON.stringify(no));
        assert.deepStrictEqual(refusing.calls.map((c) => c.procedure),
            ['usp_AppendUsage', 'usp_AppendOutcomes'], 'both procedures were attempted');
    } finally {
        rmStore(store);
    }
});

// THE DELETE IS BY ID, AND THIS IS WHAT THAT BUYS. A stamp lands while the
// drain's call is in flight, so the queue holds one row the host took and one it
// has never seen. What goes is the first and only the first, because the delete
// names the ids the read returned and the new row is not among them. Nothing on
// this run is a fault to report, because every row this drain set out to deliver
// was delivered.
test('a row inserted while a drain is mid-send survives it while the rows it read come off', () => {
    const store = makeStore();
    try {
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const late = db.usageEntry('project', store.segment, 'two', 'two.md', 'applied');
        let inserted = 0;
        const host = fakeHost({
            onCall: () => {
                if (inserted > 0) return;
                inserted += 1;
                assert.deepStrictEqual(db.queueInsert([late]), { ok: true },
                    'a writer is never blocked by a drain that is mid-send');
            }
        });

        const drained = drainAgainst(host);
        assert.strictEqual(inserted, 1, 'the case must actually write inside the drain');
        assert.deepStrictEqual(drained, { ok: true, drained: 1, remaining: 1, rejected: 0 },
            'the row read is drained and the row behind it is left: ' + JSON.stringify(drained));
        assert.strictEqual(drained.cause, undefined,
            'a row written behind the read is an ordinary busy machine and names no state: '
            + JSON.stringify(drained));
        assert.strictEqual(drained.detail, undefined,
            'so it carries no sentence either: ' + JSON.stringify(drained));
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['one.md'],
            'the row this drain read is the only one it sent');

        assert.deepStrictEqual(queueRows().map((r) => r.id), [late.stampId],
            'the queue holds the late stamp and nothing else: ' + JSON.stringify(queueRows()));

        // The next drain finds the one row and empties the queue, so it converges
        // rather than carrying a delivered row forever.
        const again = drainAgainst(host);
        assert.deepStrictEqual(again, { ok: true, drained: 1, remaining: 0, rejected: 0 });
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['one.md', 'two.md'],
            'the late stamp reached the host on the run after the one that missed it: '
            + JSON.stringify(host.usage));
        assert.strictEqual(queueCount(), 0);
    } finally {
        rmStore(store);
    }
});

// The drain's whole safety rests on the host holding the stamp id indexes and
// the procedures that skip on them. Against an older host, OPENJSON ... WITH
// ignores the stampId key it does not name, so every resend after a refusal or
// an outage writes a second row: the duplicate this design exists to end. The
// version is therefore read before anything is sent.
test('a host below the schema version this client requires is refused, and not one row is sent', () => {
    const store = makeStore();
    try {
        db.queueInsert([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const before = queueRows();
        const behind = db.REQUIRED_SCHEMA_VERSION - 1;

        const old = fakeHost({ schemaVersion: behind });
        const out = db.drainQueue(config(), { deps: { runBatch: old.runBatch }, schemaVersion: behind });
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'schema',
            'an answering host is never reported as one to wait for, since waiting never resolves '
            + 'this: ' + JSON.stringify(out));
        assert.deepStrictEqual(old.calls, [], 'no row reached a procedure that would ignore its id');
        assert.deepStrictEqual(queueRows(), before, 'and the queue is whole');
        assert.ok(new RegExp('\\b' + behind + '\\b').test(out.detail)
            && new RegExp('\\b' + db.REQUIRED_SCHEMA_VERSION + '\\b').test(out.detail),
            'the refusal names the version it found and the version it needs: ' + out.detail);
        assert.ok(/Install-MemoryDatabase/.test(out.detail),
            'and the remedy, which is the installer rather than the next run: ' + out.detail);

        // A host answering no version at all is the same refusal: a health
        // report with no version in it is not evidence of a host that has one.
        const silent = db.drainQueue(config(), { deps: { runBatch: old.runBatch } });
        assert.strictEqual(silent.cause, 'schema', JSON.stringify(silent));
        assert.deepStrictEqual(old.calls, []);

        // The control, withheld from the assertions above: the same rows at the
        // required version drain and empty the queue, so the refusal is the
        // version and not something about these rows.
        assert.deepStrictEqual(drainAgainst(fakeHost()),
            { ok: true, drained: 2, remaining: 0, rejected: 0 });
        assert.strictEqual(queueCount(), 0);
    } finally {
        rmStore(store);
    }
});

// The version the gate reads is the host's own, taken from the health probe the
// run already spends rather than from a second reader or a remembered number.
test('the publish hands the drain the version its health probe read, and an old host stops the drain alone', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);

        const host = fakeHost({ schemaVersion: db.REQUIRED_SCHEMA_VERSION - 1 });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0, JSON.stringify(result.summary));
        assert.deepStrictEqual(host.usage, [], 'no queue row reached the host');
        assert.ok(result.summary.failed.some((f) => f.startsWith('the queue (schema): ')),
            'the cause rides out in front of the words, since the remedy is the installer: '
            + JSON.stringify(result.summary.failed));
        assert.strictEqual(queueCount(), 1, 'and the row is still on the queue');
        assert.ok(result.summary.added > 0,
            'the run itself carries on, since the walk neither reads the queue nor writes to it: '
            + JSON.stringify(result.summary));

        // The control: the same publish against a host at the required version
        // drains the same row, so the refusal above is the version alone.
        const current = fakeHost();
        const ran = await publishWith(store, current);
        assert.strictEqual(ran.summary.drained, 1, JSON.stringify(ran.summary));
        assert.deepStrictEqual(current.usage.map((u) => u.fileKey), ['one.md']);
    } finally {
        rmStore(store);
    }
});

// One call carrying the whole queue grows with the queue, and a clock that grew
// with it would put one call past the timeout the operator configured: a
// detached session-start publish would then hold one sqlcmd process for as long
// as the module's own ceiling allows. The configured timeout is the bound,
// whatever the payload, and a payload that clock cannot fund is reported rather
// than funded.
test('a drain call\'s clock never passes the timeout its caller configured, whatever the payload', () => {
    const store = makeStore();
    try {
        const drainOf = (count) => {
            fs.rmSync(db.queuePath(), { force: true });
            const entries = [];
            for (let at = 0; at < count; at += 1) {
                entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
            }
            db.queueInsert(entries);
            const host = fakeHost();
            const out = drainAgainst(host);
            const call = host.calls[0];
            return {
                out,
                budgetMs: call.budgetMs, killMs: call.killMs,
                chars: JSON.stringify(call.parameters['@p_Usage']).length
            };
        };

        const small = drainOf(1);
        const large = drainOf(3000);
        assert.strictEqual(small.budgetMs, config().timeoutMs,
            'an ordinary payload spends the caller\'s own budget');
        assert.strictEqual(large.budgetMs, config().timeoutMs,
            'and a payload many times larger spends exactly that same budget: ' + large.chars
            + ' characters took ' + large.budgetMs + ' ms');
        assert.strictEqual(large.budgetMs, db.payloadCallMs(config().timeoutMs),
            'the clock is the module\'s own derivation over the caller\'s want');

        // The derivation at the wants that define it: each answers its own want
        // back, and the module's own ceiling is the only thing that lowers one.
        const funded = db.PAYLOAD_FUNDED_CHARS;
        for (const want of [1000, 10000, db.MAX_TIMEOUT_MS, db.MAX_TIMEOUT_MS * 2]) {
            assert.ok(db.payloadCallMs(want) <= want,
                'a want of ' + want + ' ms is never lifted: ' + db.payloadCallMs(want));
            assert.ok(db.payloadCallMs(want) <= db.MAX_TIMEOUT_MS,
                'and nothing reaches past the module\'s own ceiling either');
        }
        assert.strictEqual(db.payloadCallMs(10000), 10000, 'a want inside the ceiling stands');
        assert.strictEqual(db.PAYLOAD_FUNDED_CHARS,
            db.PAYLOAD_PIECE_CHARS * db.PAYLOAD_PIECES_PER_BUDGET,
            'the payload one call funds is the piece size times the pieces one budget funds');

        // The spawn's hard kill follows the call's own clock, so the drain names
        // none and runBatch takes its default from the budget.
        assert.strictEqual(large.killMs, undefined,
            'the drain names no kill: ' + large.killMs);

        // A payload past what that clock funds is the operator's question, so it
        // is reported with its own size and the clock that could not fund it
        // rather than absorbed into a longer clock this client picked itself.
        assert.ok(large.chars > funded, 'this case needs a payload past the funded size');
        assert.strictEqual(large.out.cause, 'oversized', JSON.stringify(large.out.detail));
        assert.ok(String(large.out.detail).includes(String(large.chars)),
            'the report names the payload\'s own size: ' + large.out.detail);
        assert.ok(String(large.out.detail).includes(String(large.budgetMs)),
            'and the clock that could not fund it: ' + large.out.detail);

        // The control, withheld from the assertions above: the small payload
        // carries no such report, so the sentence above is the size rather than
        // one printed on every drain.
        assert.ok(small.chars < funded, 'the control payload is inside the funded size');
        assert.strictEqual(small.out.cause, undefined, JSON.stringify(small.out));
        assert.strictEqual(small.out.detail, undefined, JSON.stringify(small.out));

        // The run's deadline still outranks the call's want: a call starting
        // with less than that want left spends what is left.
        fs.rmSync(db.queuePath(), { force: true });
        const entries = [];
        for (let at = 0; at < 100; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'd' + at, 'd' + at + '.md', 'read'));
        }
        db.queueInsert(entries);
        const bounded = fakeHost();
        db.drainQueue(config(), {
            deps: { runBatch: bounded.runBatch, now: () => 1000 },
            schemaVersion: db.REQUIRED_SCHEMA_VERSION,
            deadline: 1000 + 5000
        });
        assert.ok(config().timeoutMs > 5000, 'this case needs a want past what the deadline leaves');
        assert.strictEqual(bounded.calls[0].budgetMs, 5000,
            'a run\'s deadline outranks the call\'s want: ' + bounded.calls[0].budgetMs);
    } finally {
        rmStore(store);
    }
});

// The oversized payload on the surface a person actually reads. Nothing here
// solves the condition, which is the operator's to answer: the client will not
// lift one call's clock past the configured timeout and will not batch the queue
// into smaller calls, so what it owes is a legible report.
test('an oversized queue payload is named on the publish summary with its size and its clock', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const entries = [];
        for (let at = 0; at < 3000; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        db.queueInsert(entries);

        const host = fakeHost();
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        const chars = JSON.stringify(host.calls.find((c) => c.procedure === 'usp_AppendUsage')
            .parameters['@p_Usage']).length;
        assert.ok(chars > db.PAYLOAD_FUNDED_CHARS, 'this case needs an oversized payload: ' + chars);
        // The warning that this queue has grown past what one call carries is
        // exactly the sentence a second list would swallow, so it goes on the
        // one list the verb prints.
        const said = result.summary.failed.find((f) => f.startsWith('the queue (oversized): '));
        assert.ok(said, 'the cause rides in front of the words: ' + JSON.stringify(result.summary.failed));
        assert.ok(said.includes(String(chars)) && said.includes(String(config().timeoutMs)),
            'and the sentence names the payload and the clock: ' + said);
        // The drain delivered every row and emptied the queue, so nothing this
        // run set out to do failed. The warning is about the run after this one.
        assert.strictEqual(result.summary.workFailed, false, JSON.stringify(result.summary));
        assert.strictEqual(result.summary.drained, 3000, JSON.stringify(result.summary));
        // And the host records no error for it, since the column answers the
        // same question the exit code does: a reader watching it for trouble
        // would otherwise read a failure off a run that delivered every row.
        assert.strictEqual(host.runs[0].error, null,
            'a warning is not an error on the run record: ' + JSON.stringify(host.runs[0]));

        // The control, withheld from the assertions above: one row through the
        // same publish carries no such sentence, so the report is the size.
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const clean = await publishWith(store, fakeHost());
        assert.ok(!clean.summary.failed.some((f) => /oversized/.test(f)),
            JSON.stringify(clean.summary.failed));
    } finally {
        rmStore(store);
    }
});

// The warning has to survive a busy machine. An oversized payload is noted
// before the call that carries it, and a stamp landing behind the read leaves a
// row behind it. A drain that dropped its detail whenever it left a row would
// swallow the warning in exactly the state that warning exists for: a queue
// grown past what one call carries is also the queue a stamp is most likely to
// land on mid-drain.
test('a drain that leaves a late row still reports an oversized payload, and neither is a failure', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const entries = [];
        for (let at = 0; at < 3000; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        db.queueInsert(entries);

        let inserted = 0;
        const racing = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage' || inserted > 0) return;
                inserted += 1;
                db.queueInsert([db.usageEntry('project', store.segment, 'late', 'late.md', 'applied')]);
            }
        });
        const result = await publishWith(store, racing);
        assert.strictEqual(inserted, 1, 'this case must actually write inside the drain');
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.queueRemaining, 1,
            'this case needs a drain that left the late row: ' + JSON.stringify(result.summary));
        assert.strictEqual(result.summary.drained, 3000,
            'and delivered every row it read: ' + JSON.stringify(result.summary));
        const said = result.summary.failed.find((f) => /past the \d+ characters one call funds/.test(f));
        assert.ok(said, 'the warning survives the late row: ' + JSON.stringify(result.summary.failed));
        assert.strictEqual(result.summary.workFailed, false,
            'and neither state is a failure: ' + JSON.stringify(result.summary));
        assert.ok(/1 queue row\(s\) still on the queue/.test(db.summaryLine(result.summary)),
            'the count rides on the summary line: ' + db.summaryLine(result.summary));

        // The control, withheld from the assertions above: the same late row
        // over a payload one call funds carries no such sentence, so the warning
        // above is the payload's size and not a sentence every drain prints.
        fs.rmSync(db.queuePath(), { force: true });
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        let againInserted = 0;
        const small = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage' || againInserted > 0) return;
                againInserted += 1;
                db.queueInsert([db.usageEntry('project', store.segment, 'later', 'later.md', 'applied')]);
            }
        });
        const clean = await publishWith(store, small);
        assert.strictEqual(againInserted, 1,
            'the control must write behind the read too, or it varies two things');
        assert.strictEqual(clean.summary.queueRemaining, 1, JSON.stringify(clean.summary));
        assert.deepStrictEqual(clean.summary.failed, [], JSON.stringify(clean.summary.failed));
    } finally {
        rmStore(store);
    }
});

// The publish run's error column is the exit code's question asked of the host:
// a reader over there sees a null error on a run that did every piece of work it
// set out to do, and the words of what failed on one that did not. The printed
// list answers the other question and is unchanged, so what a warning costs is a
// line on somebody's screen rather than a false failure in the fleet's record.
// The two are read in one case, because a column written from the printed list
// is wrong in both directions at once: it reports a failure that is not one, and
// a warning standing in front of a real failure pushes that failure out of the
// bounded text the column takes.
test('the publish run records what failed, and a warning beside it neither counts nor crowds it', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        writeRecord(path.join(store.root, 'memory-operator'), 'shared-fact', '# shared\n\na body\n');
        const entries = [];
        for (let at = 0; at < 3000; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        db.queueInsert(entries);

        // One warning and one failure in one run: the queue carries more than a
        // call funds and delivers every row of it, while the project tier will
        // not enumerate, which is a record this run set out to publish and did
        // not.
        const host = fakeHost();
        const result = await withUnreadableDir(store.memDir, () => publishWith(store, host));
        assert.strictEqual(result.summary.drained, 3000,
            'the drain delivered every row it read: ' + JSON.stringify(result.summary));
        assert.ok(result.summary.failed.some((f) => /past the \d+ characters one call funds/.test(f)),
            'the warning is on the printed list: ' + JSON.stringify(result.summary.failed));
        assert.strictEqual(result.summary.workFailed, true,
            'and the tier that would not read is a failure: ' + JSON.stringify(result.summary));

        const recorded = String(host.runs[0].error);
        assert.ok(/permission denied/.test(recorded),
            'the run record carries what failed: ' + recorded);
        assert.ok(!/one call funds/.test(recorded),
            'and not what merely warned, which is what would crowd a failure out of it: ' + recorded);
        // And it is a part of the one list rather than a second reporting
        // surface: every sentence the host is told about was printed here too.
        for (const sentence of recorded.split('; ')) {
            assert.ok(result.summary.failed.some((f) => scrub(f).includes(sentence)),
                'the run record says nothing the printed list does not: ' + sentence);
        }

        // The control, withheld from the assertions above: the same warning with
        // no failure beside it records no error at all, so the column above is
        // the failure rather than whatever the run last said.
        db.queueInsert(entries.map((e) => ({ ...e, stampId: db.stampId() })));
        const quiet = fakeHost();
        const clean = await publishWith(store, quiet);
        assert.ok(clean.summary.failed.some((f) => /one call funds/.test(f)),
            'the control must warn too, or it varies two things: '
            + JSON.stringify(clean.summary.failed));
        assert.strictEqual(quiet.runs[0].error, null,
            'a run that failed nothing records nothing: ' + JSON.stringify(quiet.runs[0]));
    } finally {
        rmStore(store);
    }
});

// The publish run's error column leaves this machine. The sentences it carries
// are composed around an absolute queue path and the server's own words, the
// store sits under the home directory by default, and the host this column lands
// on is read by every sandbox in the fleet. The CLI elides the home directory on
// the way to a screen; the copy bound for the host is a second channel and takes
// the same renderer before it goes.
test('the publish run record carries no home directory, whatever the sentence was composed from', async () => {
    const store = makeStore();
    try {
        assert.strictEqual(homeElisionsKnown(), true,
            'this case proves an elision, so it needs a home directory this process can name');
        const home = os.homedir();

        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        // A refusal whose text names a path under the home directory, which is
        // the shape an fs error and a server message both arrive in.
        const host = fakeHost();
        const speaking = (cfg, batch, options) => {
            const call = parseCall(batch);
            if (call.procedure === 'usp_AppendUsage') {
                return { ok: false, cause: 'refused', detail: 'Msg 50000: the file at '
                    + path.join(home, 'kit-memory-db-queue.sqlite') + ' was refused' };
            }
            return host.runBatch(cfg, batch, options);
        };
        const result = await db.publish({
            config: config(),
            deps: { runBatch: speaking, embedBatch: fakeEmbedder() }
        });

        const recorded = String(host.runs[0].error);
        assert.ok(recorded.includes('was refused'), 'this case needs the sentence recorded: ' + recorded);
        assert.ok(!recorded.includes(home),
            'no home directory reaches the host: ' + recorded);
        assert.ok(recorded.includes('~'),
            'and the operator\'s own shorthand stands where it was: ' + recorded);

        // The control, withheld from the assertion above: the sentence this
        // client holds locally does carry the path, so the column above is the
        // renderer running on the way out rather than a sentence that never had
        // a home directory in it.
        assert.ok(result.summary.failed.some((f) => f.includes(home)),
            'the client\'s own list still names the file for the person at this machine: '
            + JSON.stringify(result.summary.failed));

        // THE SPELLING A SINGLE ELISION PASS CANNOT SEE, WHICH IS WHY THIS
        // CHANNEL TAKES THE WHOLE RENDERER. A non-printable character sitting
        // inside a home spelling hides it from a textual elision, and the strip
        // that every reader of this column runs before it displays the text is
        // what completes the spelling again. So the strip happens here, with the
        // elision on both sides of it, and the cap and the barred quote with it:
        // the sentences on this column carry SQL Server's own words and an
        // operating system's, and this is the one channel whose value leaves the
        // machine.
        //
        // The character goes outside the account name rather than inside it, so
        // the name stands whole in the text and its presence in the column is
        // the leak this case is about rather than an artifact of the fixture.
        const hidden = home.slice(0, 4) + '\u0001' + home.slice(4);
        const account = path.basename(home);
        assert.ok(account.length > 2 && !path.parse(home).root.includes(account),
            'this case reads the account name out of the home path: ' + home);
        fs.rmSync(db.queuePath(), { force: true });
        db.queueInsert([db.usageEntry('project', store.segment, 'two', 'two.md', 'read')]);
        const second = fakeHost();
        const hiding = (cfg, batch, options) => {
            const call = parseCall(batch);
            if (call.procedure === 'usp_AppendUsage') {
                return { ok: false, cause: 'refused', detail: 'Msg 50000: the file at '
                    + path.join(hidden, 'kit-memory-db-queue.sqlite') + ' was refused, and the server '
                    + 'quoted it as "the queue" ' + 'x'.repeat(1400) };
            }
            return second.runBatch(cfg, batch, options);
        };
        const hid = await db.publish({
            config: config(),
            deps: { runBatch: hiding, embedBatch: fakeEmbedder() }
        });

        const carried = String(second.runs[0].error);
        assert.ok(!carried.includes(account),
            'the account name reaches the host in no spelling, hidden or plain: ' + carried);
        assert.ok(!carried.includes('"'),
            'and the character this channel bars is not on it either: ' + carried);
        assert.ok(/cut to fit/.test(carried),
            'the value is capped like the copy a person reads, and says where it was cut: '
            + carried.length + ' characters');
        assert.ok(carried.length <= db.COLUMN_TEXT_CAP + 40,
            'so one sentence cannot carry a file of text to the host: ' + carried.length);

        // The control, withheld from the three readings above: the sentence this
        // client holds locally carries the hidden spelling, the quote and the
        // whole length, so what the column shows is the renderer running on the
        // way out rather than a sentence that never held any of them.
        assert.ok(hid.summary.failed.some((f) => f.includes(hidden) && f.includes('"')
            && f.length > db.COLUMN_TEXT_CAP),
            'the client\'s own sentence is the unrendered one: '
            + JSON.stringify(hid.summary.failed.map((f) => f.length)));
    } finally {
        rmStore(store);
    }
});

// ONE RENDER FOR THE CHANNEL, NOT ONE PER CALLER. The same composed sentence
// goes to a terminal through memq and to the fleet's publish run column through
// this client, and both are the output channel's own guard rather than either
// caller's: the elision, the barred character, the strip, the second elision and
// the cap. Spelled in each module, the two are one edit away from a column that
// keeps a character the screen removes or cuts where the screen does not, and
// the two texts under one run would then differ with nothing to say which is the
// value. The byte-identity pin further down compares their output; this pins
// where the rule lives, which is what keeps that output identical by
// construction rather than by coincidence.
test('the channel render is one helper in the shared library, called by both spellings of it', () => {
    const lib = require(path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks',
        'kit-compact-lib.js'));
    assert.strictEqual(typeof lib.shownText, 'function',
        'the shared library owns the render');

    // A value carrying every pass that separates a render from a bare cap: a
    // character outside printable ASCII, the character this kit bars, and more
    // text than the column's cap takes.
    const value = 'Msg 50000: the host said "no" \u0001 ' + 'x'.repeat(1400);
    assert.strictEqual(db.columnText(value), lib.shownText(value, db.COLUMN_TEXT_CAP),
        'and the client\'s column render is that helper at the column\'s own cap');
    assert.ok(/characters removed/.test(db.columnText(value))
        && /cut to fit/.test(db.columnText(value)),
        'this case must exercise the passes it pins: ' + db.columnText(value));

    // The body itself, counted across the three files that could hold it: the
    // second elision asked with whether the strip above took anything out.
    //
    // MATCHED ON SHAPE, WITH NO NAME IN THE PATTERN. Every identifier is free,
    // the called function's included, and the backreference is what makes this
    // the renderer rather than any two-argument call: whatever name the value
    // carries, that same name stands in front of `.length` on the left of the
    // comparison. A copy spelled with other locals, or calling the elision under
    // another binding, is a second answer to what this channel emits, and a
    // pattern built on one spelling's own names would never see it.
    //
    // ITS REACH IS ONE CALL SHAPE, AND THAT LIMIT IS STATED RATHER THAN IMPLIED.
    // What it matches is the elision asked in one expression, with the compared
    // lengths inline. A copy that bound the comparison to a local first, or that
    // spread the four passes across statements, is a home this scan does not
    // count. What it is written to catch is the ordinary copy-and-rename, which
    // is the way a second home actually arrives.
    const BODY = /[A-Za-z_$][\w$]*\(\s*([A-Za-z_$][\w$]*)\s*,\s*\1\.length\s*!==\s*[A-Za-z_$][\w$]*\.length\s*\)/g;
    // Comment lines go and what is left is read as one stretch rather than line
    // by line, so a call spelled across two lines counts as the home it is.
    const homesIn = (text) => (text.split(/\r?\n/)
        .filter((line) => !/^\s*(\/\/|\*)/.test(line)).join(' ').match(BODY) || []).length;
    const homes = [];
    for (const file of [CLIENT_SOURCE, MEMQ, path.join(__dirname, '..', 'plugins', 'claude-kit',
        'hooks', 'kit-compact-lib.js')]) {
        const found = homesIn(fs.readFileSync(file, 'utf8'));
        if (found > 0) homes.push(path.basename(file) + ' x' + found);
    }
    // THREE HOMES, AND THE ZERO IS THE ONE THIS PIN PROTECTS. The render this
    // client sends to the publish run column lives in kit-compact-lib alone, so
    // memory-database.js spells the shape nowhere and memq calls the helper for
    // the db-sync sentences it shares with this client, in cmdDbSync. memq's own
    // three are a different channel and predate this client:
    // sanitize is the CLI descriptor guard, which elides only when
    // CHANNEL_IS_OURS and takes the charset rule alone when the file is loaded
    // as a module; failureText spells the four itself for the reason its own
    // comment gives, that a failure line is composed the same way whichever way
    // the file was loaded; and refusedEntryText calls it behind a `typeof` guard
    // so a plugin cache one version behind falls through to scrub rather than
    // throwing on a path where a throw is an allow. None of the three is the
    // column render, and a fourth appearing in this client is what reds here.
    assert.deepStrictEqual(homes, ['memq.js x3', 'kit-compact-lib.js x1'],
        'the column render has one home and its callers call it: ' + homes.join(', '));

    // The control, planted rather than found, and withheld from the pattern: the
    // pattern above carries no identifier at all, and these three names appear
    // in none of the three files scanned, which a `grep -c` for each of
    // brambleElide, quillText and quillPrior over those files answers zero for.
    // It is also spelled across two lines, which the reading above is what makes
    // visible. So the zero for this client is that file's silence rather than a
    // pattern that matches nothing.
    const planted = 'function elsewhere(v, cap) {\n'
        + '    return sanitizeForOutput(brambleElide(quillText,\n'
        + '        quillText.length !== quillPrior.length), cap);\n'
        + '}\n';
    assert.strictEqual(homesIn(planted), 1,
        'the reading finds a second home where one exists, under names it was never given');
});

// A row that landed behind the read is delivered work and a queue the next drain
// empties, so what it owes is the count it left behind and nothing else, which
// the summary line carries. No sentence goes in front of a person for it.
test('a late row carries its count on the summary line alone', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        let inserted = 0;
        const racing = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage' || inserted > 0) return;
                inserted += 1;
                db.queueInsert([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
            }
        });
        const raced = await publishWith(store, racing);
        assert.strictEqual(inserted, 1, 'this case must actually write inside the drain');
        assert.strictEqual(raced.ok, true, JSON.stringify(raced));
        assert.deepStrictEqual(raced.summary.failed, [],
            'a busy machine is not a failure, so the late row puts no sentence in front of a '
            + 'person: ' + JSON.stringify(raced.summary.failed));
        assert.strictEqual(raced.summary.workFailed, false,
            'and nothing this run set out to do failed: ' + JSON.stringify(raced.summary));
        assert.strictEqual(raced.summary.drained, 1,
            'the row the drain read left the queue: ' + JSON.stringify(raced.summary));
        assert.ok(/1 queue row\(s\) still on the queue/.test(db.summaryLine(raced.summary)),
            'the one line a person reads carries the count: ' + db.summaryLine(raced.summary));
        assert.strictEqual(raced.summary.notes, undefined,
            'and there is no second list anywhere on the summary: '
            + JSON.stringify(Object.keys(raced.summary)));
        // The publish run's own error column, which is written from that same
        // one list, so what a person reads on stderr and what the host records
        // cannot come apart.
        assert.strictEqual(racing.runs[0].error, null,
            'and the run record carries no error either: ' + JSON.stringify(racing.runs[0]));
    } finally {
        rmStore(store);
    }
});

// The cause word is a word inside a sentence and nothing more. Every drain state
// the client can answer reaches the publish's one failure list, so a cause added
// to the drain later needs no decision about where its sentence goes and there
// is no branch for one to fall through.
test('every drain cause the client can answer reaches the one failure list', () => {
    // The family, read off the client's own source rather than off a list here,
    // so a cause this case never heard of is still covered. Comment lines are
    // dropped first, since the prose names these words too.
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8').split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('//') && !line.includes('drain.cause'));
    const answered = new Set();
    for (const line of source) {
        if (!/\bcause\b/.test(line)) continue;
        for (const found of line.match(/'[a-z]+'/g) || []) answered.add(found.slice(1, -1));
    }
    assert.ok(answered.size >= 6, 'the scan must actually find causes: ' + [...answered].join(', '));

    // The routing, read the same way: the drain's own sentence is pushed onto
    // exactly one list in the whole client, and that list is the one the verb
    // prints and the publish run's error column is written from. A per-cause
    // assertion would prove this for the words it happened to name; this proves
    // it for the word nobody has written yet, since there is no branch to fall
    // through.
    const whole = fs.readFileSync(CLIENT_SOURCE, 'utf8');
    // The scan is matched on the SHAPE of an accumulator a sentence is pushed
    // onto, never on a name or a prefix. A list named for what it holds is one
    // spelling of the class, a bare local is another, and a predicate written
    // around `summary.` would read the first and go quiet on the second, which
    // is a second list the scan cannot see and a green that means nothing. So
    // any target of a `.push` call counts, spelled as a plain name or as any
    // depth of property, and the one shape held out is a push of an object
    // literal, which is a record the run collected rather than a sentence
    // anybody reads.
    //
    // The literal is built inside the reader rather than held beside it, so each
    // reading gets a regex of its own. A global regex carries a lastIndex, and
    // one shared across readings is a state this case would have to reason about
    // to trust its own counts.
    const routed = (text, keep) => {
        const ACCUMULATOR = /(?:^|[^\w$.])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.push\((?!\{)/g;
        const found = new Set();
        for (const line of text.split(/\r?\n/)) {
            if (line.trim().startsWith('//') || !keep(line)) continue;
            for (const site of line.matchAll(ACCUMULATOR)) found.add(site[1]);
        }
        return found;
    };
    // The drain's own sentence, wherever in the client it is routed. Two
    // accumulators take it, and they are one surface and one copy of it:
    // `summary.failed` is the list the verb prints, and `workFailures` is the
    // part of that same list the publish run's error column is written from,
    // holding no sentence of its own. The column is written from that second
    // accumulator on purpose: the publish run row carries no success flag, so a
    // column filled on every run that merely had something to say would leave a
    // host-side reader no way to find a failure. Those two are the whole class,
    // named here rather than widened to whatever appears.
    const destinations = [...routed(whole, (line) => /drain\.detail/.test(line))].sort();
    assert.deepStrictEqual(destinations, ['summary.failed', 'workFailures'],
        'the drain sentence reaches the printed list and the column\'s copy of it, and nothing '
        + 'else: ' + destinations.join(', '));

    // The same scan over the publish's own body, so a second list reached by a
    // leg that is not the drain's is in the reading too. The body is the scope
    // because the accumulators a helper builds and joins into one `detail` are
    // not surfaces: what a reader sees is what the publish composes.
    //
    // THE SCAN READS A FILE AS THE CHECKOUT HOLDS IT, WHICH IS NOT ALWAYS LF.
    // This repository sets core.autocrlf and pins no .gitattributes, so the
    // working copy of a JavaScript file carries carriage returns on the next
    // clone whatever this one holds. An end-of-function pattern anchored on the
    // line feed alone finds nothing there, and the assertion below then runs
    // against a slice of the wrong length or reds for a reason that has nothing
    // to do with what it pins. Every line-anchored reading in this file is
    // therefore written to take either ending.
    const publishBody = (text) => {
        const opens = text.indexOf('async function publish(options) {');
        assert.notStrictEqual(opens, -1, 'the scan must find the publish to read it');
        const closes = /\r?\n\}\r?\n/.exec(text.slice(opens));
        assert.notStrictEqual(closes, null, 'and the end of it');
        return text.slice(opens, opens + closes.index);
    };
    const everywhere = [...routed(publishBody(whole), () => true)].sort();
    assert.deepStrictEqual(everywhere, ['summary.failed', 'workFailures'],
        'and the whole publish composes sentences into those two and no third: '
        + everywhere.join(', '));

    // The same source as a checkout with CRLF endings hands it back, which is
    // what this repository's own git configuration produces on the next clone.
    // The reading must be the same reading, and a scan that finds no end to the
    // publish there reds on a clean clone for a reason nobody can act on.
    const asCrlf = whole.split(/\r?\n/).join('\r\n');
    assert.ok(asCrlf.includes('\r\n'), 'this case needs carriage returns to mean anything');
    const acrossEndings = [...routed(publishBody(asCrlf), () => true)].sort();
    assert.deepStrictEqual(acrossEndings, everywhere,
        'and the same file with CRLF endings reads the same: ' + acrossEndings.join(', '));

    // The control, planted with members the readings above were never handed:
    // neither accumulator here is spelled the way either real one is, and one
    // is a bare local rather than a property of anything, which is exactly the
    // member a name-prefixed predicate goes quiet on. The object-literal push
    // beside them must stay unseen, since that is the shape the scan holds out.
    const planted = 'async function publish(options) {\n'
        + '    const x = 1;\n'
        + '    if (drain.detail) asides.push(drain.detail);\n'
        + '    out.somewhereElse.push(reason);\n'
        + '    gathered.push({ recordId: 1 });\n'
        + '}\n';
    assert.deepStrictEqual([...routed(planted, (line) => /drain\.detail/.test(line))],
        ['asides'], 'the scan must see a drain sentence routed to a list of any other name');
    assert.deepStrictEqual([...routed(publishBody(planted), () => true)].sort(),
        ['asides', 'out.somewhereElse'],
        'and any other list the publish writes a sentence to, while the records it gathers are '
        + 'not one');
});

// A count nobody took is not a count of zero. Two drain answers carry no count
// at all: the version gate refuses ahead of the open, and a file no connection
// can open has nothing to count. A zero there would tell a reader, and any later
// step that scrapes the field, that a full queue is empty.
test('a drain that never read the queue reports its depth as unknown rather than as zero', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);

        // The version gate, which answers before the open and the read.
        const behind = db.REQUIRED_SCHEMA_VERSION - 1;
        const gated = db.drainQueue(config(), {
            deps: { runBatch: fakeHost({ schemaVersion: behind }).runBatch }, schemaVersion: behind
        });
        assert.strictEqual(gated.remaining, null, JSON.stringify(gated));

        // On the publish surface: the count is carried as unknown and the clause
        // that would state it is omitted, while the cause's own sentence is what
        // tells the reader nothing was sent.
        const gatedRun = await db.publish({
            config: config(),
            deps: { runBatch: fakeHost({ schemaVersion: behind }).runBatch, embedBatch: fakeEmbedder() }
        });
        assert.strictEqual(gatedRun.summary.queueRemaining, null, JSON.stringify(gatedRun.summary));
        const line = db.summaryLine(gatedRun.summary);
        assert.ok(!/still on the queue/.test(line),
            'no count is printed for a depth nobody read: ' + line);
        assert.ok(gatedRun.summary.failed.some((f) => f.startsWith('the queue (schema): ')), line);
        assert.strictEqual(queueCount(), 1, 'and the row really is still on the queue');

        // The file no connection can open, which is the other one. A queue that
        // is not a database at all is what a half-written file or a foreign
        // writer leaves.
        fs.writeFileSync(db.queuePath(), 'not a database at all', 'utf8');
        const unread = db.drainQueue(config(), {
            deps: { runBatch: fakeHost().runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION
        });
        assert.strictEqual(unread.ok, false, JSON.stringify(unread));
        assert.strictEqual(unread.cause, 'unreadable', JSON.stringify(unread));
        assert.strictEqual(unread.remaining, null, JSON.stringify(unread));
        assert.strictEqual(db.queueDepth(), null,
            'and the depth reading answers the same way rather than zero');

        // The control, withheld from the assertions above: a drain that did read
        // the queue and left a row on it does print the count, so the silence
        // above is the unread file rather than a clause that never prints.
        fs.rmSync(db.queuePath(), { force: true });
        db.queueInsert([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);
        let inserted = 0;
        const racing = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage' || inserted > 0) return;
                inserted += 1;
                db.queueInsert([db.usageEntry('project', store.segment, 'late', 'late.md', 'read')]);
            }
        });
        const keptRun = await publishWith(store, racing);
        assert.strictEqual(keptRun.summary.queueRemaining, 1, JSON.stringify(keptRun.summary));
        assert.ok(/1 queue row\(s\) still on the queue/.test(db.summaryLine(keptRun.summary)),
            db.summaryLine(keptRun.summary));
    } finally {
        rmStore(store);
    }
});

// One call per procedure over everything the read found, whatever the count.
// Batching is what the drain used to do and what its faults lived in, and
// nothing about a queue of this store's sizes needs it: the longest row memq
// writes is under a kilobyte, so a queue of a thousand rows is a payload one
// batch file and one OPENJSON pass take comfortably.
test('one send per procedure carries every row the read found', () => {
    const store = makeStore();
    try {
        const entries = [];
        for (let at = 0; at < 250; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        for (let at = 0; at < 3; at += 1) {
            entries.push(db.outcomeEntry(store.segment,
                { key: 'action-' + at, outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' }));
        }
        db.queueInsert(entries);

        const host = fakeHost();
        const drained = drainAgainst(host);
        assert.deepStrictEqual(drained, { ok: true, drained: 253, remaining: 0, rejected: 0 });
        assert.deepStrictEqual(host.calls.map((c) => c.procedure),
            ['usp_AppendUsage', 'usp_AppendOutcomes'],
            'two calls for the whole queue: ' + host.calls.map((c) => c.procedure).join(', '));
        assert.strictEqual(host.calls[0].parameters['@p_Usage'].length, 250,
            'the one usage call carries every usage row');
        assert.strictEqual(host.calls[1].parameters['@p_Outcomes'].length, 3);
        assert.strictEqual(host.usage.length, 250);
        assert.strictEqual(queueCount(), 0);
    } finally {
        rmStore(store);
    }
});

// A WRITE LOCK SOMEBODY ELSE HOLDS IS A BUSY MACHINE, NOT A DISK TO GO AND LOOK
// AT. SQLite waits the holder out for the busy timeout and then answers with its
// own busy code, which is what this reads. Reported as a host that did not answer
// it would stand a whole publish down for a condition that clears itself in
// seconds, and counted as a failure it would exit non-zero on the ordinary
// overlap of two sessions inside one drain's window.
test('a queue write lock another connection holds is contention, and the publish runs on past it', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const before = queueRows();

        const held = holdQueueLock();
        let result = null;
        let host = null;
        try {
            host = fakeHost();
            result = await publishWith(store, host);
        } finally {
            held.release();
        }
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0,
            'nothing came off the queue: ' + JSON.stringify(result.summary));
        // What the zero above is and is not. WAL lets the drain read the queue
        // while another connection holds the write lock, so the row goes to the
        // host and only the delete meets the lock. A drain that had never read
        // the queue would report the same zero, and this is what tells the two
        // apart: the host has the row, and the next run's resend is the one the
        // stamp id's unique index absorbs.
        assert.strictEqual(host.usage.length, 1,
            'the host was sent the row it holds: ' + JSON.stringify(host.usage));
        assert.strictEqual(result.summary.added, 1, 'the walk and the publish still ran');
        assert.ok(result.summary.failed.some((f) => f.startsWith('the queue (contended): ')),
            'contention has its own word: ' + JSON.stringify(result.summary.failed));
        assert.ok(!result.summary.failed.some((f) => /did not answer/.test(f)),
            'and it is never reported as a host that did not answer');
        // Nothing failed: the rows this run could not remove are rows the stamp
        // id makes the next run's resend insert once. So the sentence prints and
        // the code stays zero.
        assert.strictEqual(result.summary.workFailed, false,
            'contention is a busy machine rather than work that failed: '
            + JSON.stringify(result.summary));
        assert.strictEqual(host.runs[0].error, null,
            'and the run record carries no error, so a host-side reader watching that column '
            + 'sees nothing on an ordinary overlap: ' + JSON.stringify(host.runs[0]));
        assert.deepStrictEqual(queueRows(), before,
            'and every row is still there for the next run');

        // The control: with the lock released the same queue drains, so the zero
        // above is the contention rather than an empty queue.
        const after = await publishWith(store, fakeHost());
        assert.strictEqual(after.summary.drained, 1, JSON.stringify(after.summary));
        assert.strictEqual(queueCount(), 0);
    } finally {
        rmStore(store);
    }
});

// AN INTERACTIVE STAMP WAITS ON A SESSION'S BUDGET, NOT A PUBLISH'S. The read
// stamp hook runs on every Read a session makes and is budgeted at a few hundred
// milliseconds, and the row it writes is a derived copy of a sidecar line already
// on disk. A wedged lock holder would otherwise cost every tool call the full
// busy wait to lose nothing at all.
test('a writer meeting a held lock gives up on its own budget rather than the drain\'s', () => {
    const store = makeStore();
    try {
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const held = holdQueueLock();
        let answered = null;
        let elapsed = 0;
        try {
            const started = Date.now();
            answered = db.queueInsert([db.usageEntry('project', store.segment, 'two', 'two.md', 'read')]);
            elapsed = Date.now() - started;
        } finally {
            held.release();
        }
        assert.strictEqual(answered.ok, false,
            'the held lock is what this case needs: ' + JSON.stringify(answered));
        // Against the quick wait rather than the full one, with room for a slow
        // box. A bound of the full wait passes for anything under it, so a
        // regression setting the writer's wait to just short of the drain's
        // would read as green; the quick wait is what this case is about and is
        // what it has to discriminate against.
        assert.ok(elapsed < db.QUEUE_BUSY_TIMEOUT_QUICK_MS * 3,
            'a writer waits its own shorter budget rather than the full one: ' + elapsed
            + ' ms against a quick wait of ' + db.QUEUE_BUSY_TIMEOUT_QUICK_MS + ' ms and a full '
            + 'one of ' + db.QUEUE_BUSY_TIMEOUT_MS + ' ms');

        // The control, withheld from the assertions above: with the lock released
        // the same call writes its row, so the refusal is the lock rather than
        // the entry.
        assert.deepStrictEqual(db.queueInsert([db.usageEntry('project', store.segment, 'two', 'two.md', 'read')]),
            { ok: true });
        assert.strictEqual(queueCount(), 2);
    } finally {
        rmStore(store);
    }
});

// THE READING THAT DECIDES WHETHER A BUSY MACHINE EXITS NON-ZERO. node:sqlite
// hands back SQLite's extended result code, which carries the primary code in
// its low byte and a reason in the byte above: a lock met during recovery is 261
// and one met on a snapshot is 517, and both of them are SQLITE_BUSY. A test
// against 5 alone reads those two as faults, which sends the drain to
// 'unreadable' or 'unclearable', sets the publish's work-failed flag and exits
// `memq db-sync` non-zero on a machine that is merely busy, which is the one
// outcome telling contention from a fault exists to prevent.
test('every extended busy code is contention, whatever reason byte rides above it', () => {
    for (const code of [5, 261, 517]) {
        assert.strictEqual(db.queueBusy({ errcode: code }), true,
            'SQLite reports a lock as ' + code + ', whose primary code is the busy one');
    }
    // The withheld control: codes that are not a lock, none of them named in the
    // comparison, so a reading that answered true for everything would be caught
    // here rather than passing as a sound mask.
    for (const code of [1, 8, 10, 11, 14, 267, 778, 1034]) {
        assert.strictEqual(db.queueBusy({ errcode: code }), false,
            'and ' + code + ' is a fault to go and look at rather than a lock to wait out');
    }
    assert.strictEqual(db.queueBusy(null), false, 'no error at all is no lock');
    assert.strictEqual(db.queueBusy({}), false,
        'and an error carrying no code at all is a fault rather than a lock');
});

// A DRAIN OF AN EMPTY QUEUE TAKES NO WRITE LOCK AND SAYS NOTHING UNTRUE. There
// is nothing to remove, so a transaction opened to remove nothing would wait the
// whole busy timeout out against a held lock and then report that the rows it
// took could not be removed, of no rows at all. That sentence sends a reader to
// a queue file with nothing wrong in it, and the wait is paid on every run of
// every machine whose queue is already empty, which is the ordinary state.
test('a drain with nothing to remove is clean even while another connection holds the write lock', () => {
    const store = makeStore();
    try {
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        assert.strictEqual(drainAgainst(fakeHost()).ok, true, 'the queue starts by emptying');
        assert.strictEqual(queueCount(), 0, 'so the drain below has nothing to take off it');

        const held = holdQueueLock();
        let out = null;
        try {
            out = drainAgainst(fakeHost());
        } finally {
            held.release();
        }
        assert.deepStrictEqual(out, { ok: true, drained: 0, remaining: 0, rejected: 0 },
            'an empty queue drains clean under a held lock: ' + JSON.stringify(out));

        // The control, withheld from the assertion above: with one row on it the
        // same held lock does stop the delete, so the clean answer is the empty
        // queue rather than a lock this case failed to take.
        db.queueInsert([db.usageEntry('project', store.segment, 'two', 'two.md', 'read')]);
        const second = holdQueueLock();
        let blocked = null;
        try {
            blocked = drainAgainst(fakeHost());
        } finally {
            second.release();
        }
        assert.strictEqual(blocked.ok, false, JSON.stringify(blocked));
        assert.strictEqual(blocked.cause, 'contended', JSON.stringify(blocked));
    } finally {
        rmStore(store);
    }
});

// A drain that delivered and could not delete is the one state that costs the
// host a duplicate row. The unique index absorbs that resend, so what is really
// at stake is a queue that would not take the write, and a reader has to hear
// about it either way.
test('a drain that delivered and could not delete says so on the publish summary', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);

        // The table taken out from under the drain's own connection while its
        // send is in flight, which is a real database error rather than a lock:
        // the delete that follows has nothing to delete from.
        let dropped = 0;
        const host = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage' || dropped > 0) return;
                dropped += 1;
                const other = new DatabaseSync(db.queuePath());
                try { other.exec('DROP TABLE queue'); } finally { other.close(); }
            }
        });
        const result = await publishWith(store, host);
        assert.strictEqual(dropped, 1, 'this case needs the delete to meet a real fault');
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0,
            'nothing came off the queue, so nothing is reported drained: '
            + JSON.stringify(result.summary));
        assert.ok(result.summary.failed.some((f) => /could not be removed/.test(f)),
            'the drain detail must reach a reader: ' + JSON.stringify(result.summary.failed));
        // The drain's cause rides out with its words, because the states it
        // reaches have different remedies and the sentence behind it is the
        // host's or the disk's.
        assert.ok(result.summary.failed.some((f) => f.startsWith('the queue (unclearable): ')),
            'and the word the drain reached rides in front of them: '
            + JSON.stringify(result.summary.failed));
        assert.strictEqual(result.summary.workFailed, true,
            'a queue that could not be cleared is work this run failed: '
            + JSON.stringify(result.summary));
        assert.strictEqual(host.usage.length, 1, 'while the host did take the row');

        // The control, withheld from the assertions above: the same publish with
        // the table left alone deletes the row and reports it, so the failure is
        // the drop rather than a delete that never runs.
        fs.rmSync(db.queuePath(), { force: true });
        db.queueInsert([db.usageEntry('project', store.segment, 'two', 'two.md', 'read')]);
        const clean = await publishWith(store, fakeHost());
        assert.strictEqual(clean.summary.drained, 1, JSON.stringify(clean.summary));
        assert.strictEqual(clean.summary.workFailed, false, JSON.stringify(clean.summary));
    } finally {
        rmStore(store);
    }
});

// A queue the drain cannot open at all is neither a refusal nor an outage: the
// host was never asked. Reported as either, a broken file on this machine sends
// somebody to look at the server.
test('a queue that could not be read is reported as such, and nothing is sent', () => {
    const store = makeStore();
    try {
        // A file that is not a database, which is what a foreign writer or a
        // half-copied file leaves at this path.
        fs.mkdirSync(store.root, { recursive: true });
        fs.writeFileSync(db.queuePath(), 'not a database at all', 'utf8');
        const host = fakeHost();
        const out = drainAgainst(host);
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'unreadable', JSON.stringify(out));
        assert.ok(/could not be read/.test(out.detail), out.detail);
        assert.deepStrictEqual(host.calls, [],
            'the host is never asked about a queue nobody could read');
        assert.strictEqual(fs.readFileSync(db.queuePath(), 'utf8'), 'not a database at all',
            'and the file is left exactly as it was found');

        // The control, withheld from the assertions above: the same drain over a
        // real queue does reach the host, so the silence is the broken file.
        fs.rmSync(db.queuePath(), { force: true });
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const free = fakeHost();
        assert.strictEqual(drainAgainst(free).ok, true);
        assert.strictEqual(free.usage.length, 1);
    } finally {
        rmStore(store);
    }
});

// WHAT A CATCH IS WRAPPED AROUND IS WHAT IT MAY BE SAID OF. `unreadable` sends a
// reader to the queue file itself, and it is true of one thing only: a row whose
// payload no parse can read. A throw out of the send path is the host or the
// work around it, and reported as an unreadable row it sends that reader to a
// file with nothing wrong in it while the real fault, a transport that went
// away, goes unnamed.
test('a throw out of the send path is the outage it is, and an unreadable row is still unreadable', () => {
    const store = makeStore();
    try {
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const out = db.drainQueue(config(), {
            deps: { runBatch: () => { throw new Error('the transport went away mid-send'); } },
            schemaVersion: db.REQUIRED_SCHEMA_VERSION
        });
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'outage',
            'a send that threw is a host that was not reached: ' + JSON.stringify(out));
        assert.ok(/the transport went away mid-send/.test(out.detail),
            'and the transport\'s own words reach the reader: ' + out.detail);
        assert.strictEqual(queueCount(), 1, 'nothing was deleted: ' + JSON.stringify(queueRows()));

        // The control, withheld from the assertions above: a row this client
        // could not parse still answers `unreadable`, so moving the catch narrowed
        // nothing. The row is written straight into the file, because no writer
        // here composes a payload that will not parse.
        const handle = new DatabaseSync(db.queuePath());
        try {
            handle.prepare('INSERT INTO queue (id, kind, payload, created_at) VALUES (?, ?, ?, ?)')
                .run('a-foreign-row', 'usage', 'not json at all', '2026-09-18T00:00:00.000Z');
        } finally {
            handle.close();
        }
        const host = fakeHost();
        const torn = drainAgainst(host);
        assert.strictEqual(torn.ok, false, JSON.stringify(torn));
        assert.strictEqual(torn.cause, 'unreadable', JSON.stringify(torn));
        assert.deepStrictEqual(host.calls, [],
            'and the host is never asked about a queue holding a row nobody could read');
        assert.strictEqual(queueCount(), 2, 'with every row still on it');
    } finally {
        rmStore(store);
    }
});

// ONE UNSENDABLE ROW IS A QUEUE THAT NEVER EMPTIES. The drain sends every row of
// a kind in one call, and both append procedures throw over the whole batch on a
// row missing what they require, so nothing is deleted and every later drain
// rebuilds the same batch around the same row. The writer is the one place that
// row can still be turned away, and `deliver` and `queueInsert` are exported and
// take whatever a caller composes.
//
// The screen is the two procedures' own requirements plus this table's own key.
// mem.usp_AppendUsage refuses a batch whose stamp has no kind of read or applied
// and one whose `at` its DATETIMEOFFSET column will not take;
// mem.usp_AppendOutcomes refuses a blank segment, a blank action key and the same
// timestamp. The stamp id is this file's own requirement rather than either
// procedure's: it is the queue row's primary key, so two rows without one
// collide on the literal text of the absent value.
test('a row the host would refuse a batch over never reaches the queue, and the writer says which field', () => {
    const store = makeStore();
    try {
        const good = () => db.usageEntry('project', store.segment, 'one', 'one.md', 'read');
        const outcome = () => db.outcomeEntry(store.segment,
            { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' });
        const refusals = [
            ['a stamp whose kind is neither read nor applied', { ...good(), kind: 'peeked' }, /kind/],
            ['a stamp with no kind at all', { ...good(), kind: undefined }, /kind/],
            ['a stamp whose time the column will not take', { ...good(), at: 'yesterday' }, /at/],
            ['a stamp whose time is out of the column\'s range', { ...good(), at: '2026-02-30T00:00:00Z' }, /at/],
            ['an outcome with a blank action key', { ...outcome(), actionKey: '   ' }, /action key/],
            ['an outcome with no segment', { ...outcome(), segment: null }, /segment/],
            ['a row carrying no stamp id', { ...good(), stampId: '' }, /stamp id/]
        ];
        for (const [what, entry, names] of refusals) {
            const answered = db.queueInsert([entry]);
            assert.strictEqual(answered.ok, false, what + ' is refused: ' + JSON.stringify(answered));
            assert.strictEqual(answered.refused, true,
                what + ' is the row rather than the file: ' + JSON.stringify(answered));
            assert.ok(names.test(answered.detail),
                what + '\'s sentence names the field: ' + answered.detail);
            assert.strictEqual(queueCount(), 0, what + ' left no row: ' + JSON.stringify(queueRows()));
        }

        // The control, withheld from every literal above: the entries the writers
        // actually compose all pass, so the screen refuses the defect rather than
        // the shape.
        assert.deepStrictEqual(db.queueInsert([good(), outcome()]), { ok: true });
        assert.strictEqual(queueCount(), 2, 'both writers\' own entries land');
    } finally {
        rmStore(store);
    }
});

// The same screen at the interactive boundary, where the caller is a verb that
// must still exit zero and a hook that must still be silent. The local record is
// written before either calls this, so a refused row costs the host's copy of one
// stamp and nothing on this machine.
test('an unsendable row is refused at the writer with its own word, and the verb carries on', () => {
    const store = makeDefaultStore();
    try {
        const entry = db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read');
        const answered = db.deliver({ ...entry, kind: 'peeked' }, { config: config() });
        assert.strictEqual(answered.queued, false, JSON.stringify(answered));
        assert.strictEqual(answered.reason, 'refused',
            'the row is the defect, not the file: ' + JSON.stringify(answered));
        assert.ok(/kind/.test(answered.detail), answered.detail);
        assert.strictEqual(queueCount(), 0, 'and nothing was written');

        // The control, withheld from the assertion above: the same call with the
        // entry its writer composes does queue.
        assert.deepStrictEqual(db.deliver(entry, { config: config() }),
            { delivered: false, queued: true, reason: 'queued' });
        assert.strictEqual(queueCount(), 1);
    } finally {
        rmDefaultStore(store);
    }
});

// A writer that cannot open the queue at all answers so rather than throwing or
// pretending. The caller has already written the local record, so what is lost
// is the host's copy of one stamp and the answer is what makes that loss
// reported rather than silent.
test('a writer whose insert fails answers with the reason and never throws', () => {
    const store = makeDefaultStore();
    try {
        // A directory where the queue file goes, which no connection can open.
        // It is the failure at the real boundary rather than a replaced function.
        fs.mkdirSync(db.queuePath(), { recursive: true });
        const answered = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            { config: config() });
        assert.strictEqual(answered.delivered, false, JSON.stringify(answered));
        assert.strictEqual(answered.queued, false,
            'a row that never landed is never reported queued: ' + JSON.stringify(answered));
        assert.strictEqual(answered.reason, 'unwritable', JSON.stringify(answered));
        assert.ok(typeof answered.detail === 'string' && answered.detail.length > 0,
            'and the reason carries the library\'s own words: ' + JSON.stringify(answered));

        // The control, withheld from the assertions above: with the path free the
        // same call writes the row and says so, so the refusal is the file rather
        // than this entry.
        fs.rmSync(db.queuePath(), { recursive: true, force: true });
        const written = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            { config: config() });
        assert.deepStrictEqual(written, { delivered: false, queued: true, reason: 'queued' });
        assert.strictEqual(queueCount(), 1);
    } finally {
        rmDefaultStore(store);
    }
});

// The count the procedure answers with, which is the only thing that says a
// stamp reached no row. mem.usp_AppendUsage drops a stamp whose record it
// cannot resolve, reports how many it dropped, and takes the rest of the batch,
// so a drain reading its own success alone would report them delivered.
test('a drain reports the rows the host declined, and the summary line names them', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        // Two stamps for records no file backs, which the walk therefore never
        // publishes and the host can resolve to nothing however the legs are
        // ordered, beside one for the record that is really there.
        db.queueInsert([
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            db.usageEntry('project', store.segment, 'two', 'two.md', 'read'),
            db.usageEntry('project', store.segment, 'three', 'three.md', 'applied')
        ]);
        const host = fakeHost({ resolvesStamps: true });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 3, 'every row left the queue: ' + JSON.stringify(result.summary));
        assert.strictEqual(result.summary.rejected, 2,
            'and the two the host would not record are counted: ' + JSON.stringify(result.summary));
        assert.strictEqual(host.usage.length, 1, 'the host holds only the row it appended');
        assert.ok(db.summaryLine(result.summary).includes(
            '2 queue row(s) the host would not record, so no row on the host holds them'),
        'the count and what became of those rows are both on the line a person reads: '
            + db.summaryLine(result.summary));
        assert.ok(result.summary.failed.some((f) => f.startsWith('the queue (rejected): ')),
            'and a loss the next run cannot repair is on the failure list: '
            + JSON.stringify(result.summary.failed));

        // The control, withheld from the assertions above: a stamp for a record
        // the host does hold carries no clause at all, so the sentence above is
        // the rejection rather than a line printed always.
        db.queueInsert([
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'applied')
        ]);
        const clean = await publishWith(store, fakeHost({ resolvesStamps: true }));
        assert.strictEqual(clean.summary.rejected, 0, JSON.stringify(clean.summary));
        assert.ok(!db.summaryLine(clean.summary).includes('would not record'), db.summaryLine(clean.summary));
        assert.ok(!clean.summary.failed.some((f) => /rejected/.test(f)),
            JSON.stringify(clean.summary.failed));
    } finally {
        rmStore(store);
    }
});

// A queue the host refuses is a fact about the queue, not about the host. The
// reachability probe has already had an answer by then, so a run that stood down
// here would report an unreachable host over a row the procedure will refuse the
// same way forever, and no record would ever be published again.
test('a drain refusal leaves the publish running, and the stand-down that remains is the probe\'s', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const host = fakeHost({ fail: ['usp_AppendUsage'] });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0);
        assert.ok(result.summary.failed.some((f) => /usp_AppendUsage/.test(f)),
            'the refusal is on the summary: ' + JSON.stringify(result.summary.failed));
        assert.ok(host.calls.map((c) => c.procedure).includes('usp_UpsertRecords'),
            'the calls after the drain were made: ' + host.calls.map((c) => c.procedure).join(', '));
        assert.strictEqual(result.summary.added, 1, JSON.stringify(result.summary));
        assert.strictEqual(queueCount(), 1,
            'and the row nothing took is still on the queue for the next run');

        // The control, withheld from the assertion above: a host that will not
        // answer the probe stands the run down under the word the drain no
        // longer uses, so the stand-down that remains is the one that should.
        const dead = fakeHost({ fail: ['usp_Health'] });
        const stood = await publishWith(store, dead);
        assert.strictEqual(stood.ok, false, JSON.stringify(stood));
        assert.strictEqual(stood.standDown, 'unreachable');
    } finally {
        rmStore(store);
    }
});

// THE FILE SPOOL IS GONE, AND THIS IS WHAT SAYS SO. The queue replaced a
// JSONL file with two lock files, a read, a clear, a put-back and a malformed
// set, and every one of those is a state this design cannot reach. A constant, a
// helper or a sentence left behind from it is a second answer to where the local
// queue lives, and the next reader would find both. The scan is over the
// client, the CLI, the three hooks named below, the whole db/ tree and this
// suite's sibling test files, matched on the word itself in any case, so a
// name this case never heard of is still caught. The doctor step and the
// skill and security documents are outside it and read by hand.
// This file is left out because it holds the planted control below. The
// sidecar capture hook keeps a spool of its own, and it and the two hooks
// that describe that spool are not members.
test('no reference to the file spool survives on any memory-database surface', () => {
    const plugin = path.join(__dirname, '..', 'plugins', 'claude-kit');
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
    const files = [
        CLIENT_SOURCE,
        MEMQ,
        path.join(plugin, 'hooks', 'memory-usage-stamp.js'),
        path.join(plugin, 'hooks', 'memory-session.js'),
        path.join(plugin, 'hooks', 'memq-grant.js'),
        ...walk(path.join(plugin, 'db')),
        ...fs.readdirSync(__dirname)
            .filter((name) => /^memory-database-.*\.test\.js$/.test(name))
            .map((name) => path.join(__dirname, name))
    ];
    assert.ok(files.length > 12, 'the walk found the db tree and the sibling suites: ' + files.length);
    const SPOOL = /spool/i;
    const found = [];
    for (const file of files) {
        for (const [at, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
            if (!SPOOL.test(line)) continue;
            // The one survivor, and it is the host's name rather than this
            // client's: mem.usp_AppendPublishRun reads the drained count under
            // this key, in its own OPENJSON ... WITH list, and the column behind
            // it carries the same word. Renaming one side alone would send a key
            // the procedure does not name, which it reads as null and records as
            // zero on every run. It goes when that procedure's own name does.
            if (/spoolDrained/i.test(line)) continue;
            found.push(path.basename(file) + ':' + (at + 1) + ': ' + line.trim());
        }
    }
    assert.deepStrictEqual(found, [],
        'the file spool left something behind: ' + found.join('\n'));

    // The control, withheld from the scan above: the same predicate over a text
    // that does hold the word finds it, so the empty list is these files' own
    // silence rather than a pattern that matches nothing. The exports it names
    // are the ones this design deleted.
    const planted = 'const SPOOL_FILE = \'kit-memory-db-spool.jsonl\';\n'
        + 'function drainSpool(config) { return appendSpool([]); }\n';
    const seen = planted.split(/\r?\n/).filter((line) => SPOOL.test(line));
    assert.strictEqual(seen.length, 2,
        'the reading finds the word where it stands: ' + seen.join(' | '));

    // And the module really does not export any of them, which a scan over
    // source text cannot answer: a name reachable through the module object is a
    // name another file can still call.
    for (const gone of ['spoolPath', 'spoolLockPath', 'spoolWriteLockPath', 'appendSpool',
        'readSpool', 'drainSpool', 'SPOOL_FILE', 'SPOOL_LOCK_FILE', 'SPOOL_WRITE_LOCK_FILE',
        'SPOOL_WRITE_WAIT_MS', 'SPOOL_WRITE_STALE_MS', 'DRAIN_LOCK_STALE_CEILING_MS']) {
        assert.strictEqual(db[gone], undefined, 'the client still exports ' + gone);
    }
    // The control on that reading: the names that replaced them are exported, so
    // the undefined above is the deletion rather than a module that exports
    // nothing.
    for (const kept of ['queuePath', 'queueInsert', 'queueDepth', 'drainQueue', 'QUEUE_FILE']) {
        assert.notStrictEqual(db[kept], undefined, 'the client must export ' + kept);
    }
});

// What the three shapes of this class actually print, recorded from ODBC 170
// SQLCMD.EXE version 15.0.1300.359 on win32 against a real SQL Server. They are
// output of that tool at that version rather than a proposal about it, and the
// discriminator below is held to them.
//
// Two shapes of the class are not among them, and each is named rather than
// implied. One is a connection the client refuses on the certificate. The other
// is a port a host actively refuses, which prints its own ODBC text: the
// unreachable-host fixture below was captured against a host that never
// answered, so its bytes are a login timeout and it is named for what was
// captured rather than for a shape it does not carry. Neither was captured, so
// nothing here states what either prints. What the discriminator does with both
// is the conservative answer either way, since neither opens a session and so
// neither can carry a server envelope.
const SQLCMD_SERVER_THROW = 'Msg 50000, Level 16, State 1, Server SCOTT-CLAUDE, Line 1\n'
    + 'kit probe: a batch the server refused\n';
const SQLCMD_LOGIN_TIMEOUT = 'Sqlcmd: Error: Microsoft ODBC Driver 17 for SQL Server : TCP Provider: '
    + 'The wait operation timed out.\n.\n'
    + 'Sqlcmd: Error: Microsoft ODBC Driver 17 for SQL Server : Login timeout expired.\n'
    + 'Sqlcmd: Error: Microsoft ODBC Driver 17 for SQL Server : A network-related or instance-specific '
    + 'error has occurred while establishing a connection to SQL Server. Server is not found or not '
    + 'accessible. Check if instance name is correct and if SQL Server is configured to allow remote '
    + 'connections. For more information see SQL Server Books Online..\n';
const SQLCMD_REJECTED_LOGIN = 'Sqlcmd: Error: Microsoft ODBC Driver 17 for SQL Server : '
    + 'Login failed for user \'kit_no_such_login\'.\n';

// The discriminator itself, which cannot be a match on the message's words. A
// closed port, a login rejected and a certificate refused all exit non-zero and
// all print prose about a refusal; what tells them from a batch the server
// rejected is the envelope sqlcmd prints around a message that came back over
// the connection, and nothing client-side carries one.
test('a refusal is told from an outage by the server message envelope, never by its words', () => {
    assert.strictEqual(db.carriesServerMessage(SQLCMD_SERVER_THROW), true,
        'a message the server sent back is a refusal');
    assert.strictEqual(db.carriesServerMessage(SQLCMD_REJECTED_LOGIN), false,
        'a login the server would not take never reached a batch');
    assert.strictEqual(db.carriesServerMessage(SQLCMD_LOGIN_TIMEOUT), false,
        'and neither did a closed port');

    // The two probes below are this file's own, not observations: a client-level
    // line that says "refused" in so many words, and a server envelope that says
    // nothing about a refusal at all. Both are withheld from the pattern, which
    // reads neither's words, and they are the pair that would catch a
    // discriminator that had started reading them.
    assert.strictEqual(db.carriesServerMessage(
        'Sqlcmd: Error: the server refused usp_AppendUsage'), false);
    assert.strictEqual(db.carriesServerMessage(
        'Msg 515, Level 16, State 2, Line 1\ncannot insert the value NULL'), true);
    assert.strictEqual(db.carriesServerMessage(''), false);

    // The control on the recorded bytes themselves: a classifier that read the
    // words, which is the instrument this one is not, calls the observed closed
    // port a refusal. So the three fixtures above discriminate rather than
    // agreeing with anything asked of them.
    const byWords = (text) => /refus|fail|error/i.test(text);
    assert.strictEqual(byWords(SQLCMD_LOGIN_TIMEOUT), true);
    assert.strictEqual(byWords(SQLCMD_REJECTED_LOGIN), true);
    assert.strictEqual(byWords(SQLCMD_SERVER_THROW), true,
        'the observed bytes all speak of a failure in words, which is why the words are not the test');
});

// The classification as the transport applies it, over the two facts a finished
// spawn answers with. The drain's cases reach this through deps.runBatch and so
// never exercise the guard on a spawn killed by this process's own clock, which
// is the one thing standing between a slow host and a contract defect reported
// against it.
test('a spawn killed on the caller\'s clock is an outage whatever it had printed', () => {
    assert.strictEqual(db.failureCause(null, SQLCMD_SERVER_THROW), 'outage',
        'a status of null is a kill here rather than an answer from the server, so the envelope it had '
        + 'already printed says nothing about the batch that was still running');
    assert.strictEqual(db.failureCause(1, SQLCMD_SERVER_THROW), 'refused',
        'the same output under an exit status the tool chose is the server refusing the batch');
    assert.strictEqual(db.failureCause(1, SQLCMD_LOGIN_TIMEOUT), 'outage');
    assert.strictEqual(db.failureCause(1, SQLCMD_REJECTED_LOGIN), 'outage');

    // The control, withheld from the assertions above: an empty output under a
    // kill and under a status are both outages, so the null branch above is the
    // status rather than the absence of an envelope.
    assert.strictEqual(db.failureCause(null, ''), 'outage');
    assert.strictEqual(db.failureCause(1, ''), 'outage');
});

// ---------------------------------------------------------------- the publish --

test('every walked record is sent on every run, and the counts are the host\'s own', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'first', '# first\n\nthe first body\n', 'the first record');
        writeRecord(store.memDir, 'second', '# second\n\nthe second body\n', 'the second record');
        writeRecord(path.join(store.root, 'memory-types', 'nodejs'), 'typed', '# typed\n\na type-tier body\n');
        writeRecord(path.join(store.root, 'memory-operator'), 'operator-fact', '# operator\n\nan operator body\n');

        const host = fakeHost();
        const first = await publishWith(store, host);
        assert.strictEqual(first.ok, true, JSON.stringify(first));
        assert.strictEqual(first.summary.added, 4, JSON.stringify(first.summary));
        assert.strictEqual(first.summary.changed, 0);
        assert.strictEqual(first.summary.embedded, 4, 'a first run embeds everything it added');

        const sentFirst = host.calls.filter((c) => c.procedure === 'usp_UpsertRecords')
            .flatMap((c) => c.parameters['@p_Records']).map((r) => r.fileKey).sort();
        assert.deepStrictEqual(sentFirst, ['first.md', 'operator-fact.md', 'second.md', 'typed.md']);

        // The second run: every record is sent again, and the host says every
        // one of them is unchanged. A client that skipped hash-equal records
        // would send nothing here, and the last-published stamp the thirty-day
        // orphan rule reads would never move.
        const firstRunCalls = host.calls.length;
        const second = await publishWith(store, host);
        assert.strictEqual(second.summary.added, 0, JSON.stringify(second.summary));
        assert.strictEqual(second.summary.changed, 0);
        assert.strictEqual(second.summary.unchanged, 4, 'the unchanged count is the host\'s answer about every record sent');
        assert.strictEqual(second.summary.embedded, 0, 'nothing is re-embedded while the bodies stand');
        const sentSecond = host.calls.slice(firstRunCalls).filter((c) => c.procedure === 'usp_UpsertRecords')
            .flatMap((c) => c.parameters['@p_Records']).map((r) => r.fileKey).sort();
        assert.deepStrictEqual(sentSecond, ['first.md', 'operator-fact.md', 'second.md', 'typed.md'],
            'the second run sends the same four records rather than skipping them');

        // One edited body: one changed, one embedded, everything else unchanged.
        fs.writeFileSync(path.join(store.memDir, 'first.md'), '# first\n\nthe first body, rewritten\n', 'utf8');
        const third = await publishWith(store, host);
        assert.strictEqual(third.summary.changed, 1, JSON.stringify(third.summary));
        assert.strictEqual(third.summary.unchanged, 3);
        assert.strictEqual(third.summary.embedded, 1, 'only the record whose text moved is re-embedded');
        assert.strictEqual(third.summary.added, 0);
    } finally {
        rmStore(store);
    }
});

test('a file the walk no longer finds is marked removed, and a partial walk marks nothing', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'kept', '# kept\n\nthis one stays\n');
        writeRecord(store.memDir, 'going', '# going\n\nthis one is deleted\n');
        writeRecord(path.join(store.root, 'memory-operator'), 'shared-fact', '# shared\n\nan operator body\n');

        const host = fakeHost();
        await publishWith(store, host);
        assert.strictEqual(host.records.size, 3);

        fs.unlinkSync(path.join(store.memDir, 'going.md'));
        const removed = await publishWith(store, host);
        assert.strictEqual(removed.summary.removed, 1, JSON.stringify(removed.summary));
        assert.strictEqual(removed.summary.partial, false);
        const removals = host.calls.filter((c) => c.procedure === 'usp_UpsertRecords' && c.parameters['@p_Removed'])
            .flatMap((c) => c.parameters['@p_Removed']);
        assert.deepStrictEqual(removals, [{ segment: store.segment, fileKey: 'going.md' }],
            'only this sandbox\'s own project file key is named');

        // A tier the walk could not read names nothing removed. The project's
        // own memory directory is unreadable for this run, so the walk holds
        // none of its records while the host still holds them: the exact shape
        // that would delete a live store if a partial walk were trusted.
        const partial = await withUnreadableDir(store.memDir, () => publishWith(store, host));
        assert.strictEqual(partial.summary.partial, true, JSON.stringify(partial.summary));
        assert.strictEqual(partial.summary.removed, 0,
            'a walk that hit an error names nothing removed, since a tier it could not read is no evidence its records are gone');
        assert.ok(db.summaryLine(partial.summary).includes('walk incomplete'), db.summaryLine(partial.summary));
        assert.ok(host.records.has('project\u0000' + store.segment + '\u0000kept.md'),
            'the record whose file went away under a partial walk is still live on the host');
    } finally {
        rmStore(store);
    }
});

test('a shared row the walk does not hold is never named removed', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'mine', '# mine\n\na project body\n');
        const host = fakeHost();
        await publishWith(store, host);
        // A shared row published by another machine, which this store has no
        // file for and never will.
        host.nextId += 1;
        host.records.set('type\u0000nodejs\u0000elsewhere.md', {
            recordId: host.nextId, tier: 'type', segment: 'nodejs', fileKey: 'elsewhere.md',
            name: 'elsewhere', archived: 0, visibility: 'shared', bodyHash: 'x', embedded: true, model: 'test-model'
        });
        const again = await publishWith(store, host);
        assert.strictEqual(again.summary.removed, 0, JSON.stringify(again.summary));
        assert.ok(host.records.has('type\u0000nodejs\u0000elsewhere.md'), 'the shared row must survive this sandbox\'s publish');
    } finally {
        rmStore(store);
    }
});

// The host keys a record by (tier, segment, file key) and the archive token is
// not part of the tier there, so a live record and its archived namesake are
// one row. Sending both makes that row's body and archived flag flip on every
// run and drops its embeddings each time, and within one batch only the last
// of them would ever be stored.
test('a record that exists live and archived under one name is reported and neither copy is sent', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'kept', '# kept\n\nan ordinary record\n');
        writeRecord(store.memDir, 'also-kept', '# also kept\n\na second ordinary record\n');
        writeRecord(store.memDir, 'twinned', '# twinned\n\nthe live body\n');
        writeRecord(path.join(store.memDir, 'archive'), 'twinned', '# twinned\n\nthe archived body\n');

        const host = fakeHost();
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        const sent = host.calls.filter((c) => c.procedure === 'usp_UpsertRecords')
            .flatMap((c) => c.parameters['@p_Records'] || []).map((r) => r.fileKey).sort();
        assert.deepStrictEqual(sent, ['also-kept.md', 'kept.md'],
            'neither copy of the twinned record is sent: ' + JSON.stringify(sent));
        assert.ok(result.summary.failed.some((f) => /live and archived/.test(f)),
            'and the pair is named to a reader: ' + JSON.stringify(result.summary.failed));
        assert.ok(!host.records.has('project\u0000' + store.segment + '\u0000twinned.md'),
            'the host holds no row built from one arbitrary half of the pair');
        assert.strictEqual(result.summary.partial, false,
            'a twin is not an incomplete walk: both of its files were read');

        // The removal leg, which a twin reported as a walk failure disables
        // store-wide: one twinned name anywhere would hold back every removal
        // from this machine for as long as it stood, and say the walk was
        // incomplete for a walk that finished.
        fs.unlinkSync(path.join(store.memDir, 'kept.md'));
        const removing = await publishWith(store, host);
        assert.strictEqual(removing.summary.removed, 1, JSON.stringify(removing.summary));
        assert.strictEqual(removing.summary.heldBack, 0, JSON.stringify(removing.summary));
        assert.ok(removing.summary.failed.some((f) => /live and archived/.test(f)),
            'and the pair is still reported: ' + JSON.stringify(removing.summary.failed));
        assert.ok(!db.summaryLine(removing.summary).includes('walk incomplete'),
            db.summaryLine(removing.summary));
        writeRecord(store.memDir, 'kept', '# kept\n\nan ordinary record\n');

        // The control, withheld from the assertion above: with the archived
        // copy gone the same record publishes normally, so the silence is the
        // collision rather than a walk that never found it.
        fs.unlinkSync(path.join(store.memDir, 'archive', 'twinned.md'));
        const after = await publishWith(store, host);
        assert.ok(host.records.has('project\u0000' + store.segment + '\u0000twinned.md'),
            JSON.stringify(after.summary));
        assert.strictEqual(after.summary.failed.length, 0, JSON.stringify(after.summary.failed));
    } finally {
        rmStore(store);
    }
});

// A shared record the host holds a newer copy of is answered `older`: the host
// keeps its own body and this machine's text is not what that row says. The
// reader still reports the row unembedded, so embedding it here would store
// vectors made from this machine's older text against the host's newer record,
// which then reads as embedded forever with text no file holds.
//
// The disposition belongs to a shared row alone, and a batch is a slice of the
// walk's order, so a store of fewer than a batch's records puts both tiers in
// one call. The project record beside the withheld one must still embed: this
// sandbox is the only one that can embed it, and the shared row is answered
// older on every run for as long as another machine's copy is the newer one,
// so a batch-wide withhold would leave the private record unembedded for good.
test('a shared record the host skipped as older is withheld from embedding and the project record beside it is not', async () => {
    const store = makeStore();
    try {
        writeRecord(path.join(store.root, 'memory-types', 'nodejs'), 'shared-note', '# shared\n\nthe newer body\n');
        writeRecord(store.memDir, 'mine', '# mine\n\na private body\n');
        const host = fakeHost();
        await publishWith(store, host);
        assert.strictEqual(host.records.size, 2);
        const shared = rowFor(host, 'type', 'shared-note.md');
        const mine = rowFor(host, 'project', 'mine.md');
        assert.ok(shared && mine, [...host.records.keys()].join(' '));
        assert.strictEqual(host.calls.filter((c) => c.procedure === 'usp_UpsertRecords').length, 1,
            'both records ride one batch, which is what puts the two tiers in one call');

        // Both host rows now carry a newer modification time than their files
        // do, which is the shape the git sync leaves behind: it carries no
        // modification times, so a record another machine published reads as
        // older here from then on. Their embeddings are dropped as a re-embed
        // pass would leave them. Only the shared body differs from this
        // machine's, since a project row the fleet cannot write never does.
        for (const row of [shared, mine]) {
            row.fileModified = '2099-01-01T00:00:00.000Z';
            row.embedded = false;
        }
        shared.bodyHash = 'the-hosts-own-hash';

        const texts = [];
        host.embedCalls.length = 0;
        const again = await publishWith(store, host, { texts });
        assert.strictEqual(again.summary.skippedOlder, 1, JSON.stringify(again.summary));
        assert.strictEqual(again.summary.unchanged, 1,
            'the project row is answered unchanged rather than older, whatever its times say: '
            + JSON.stringify(again.summary));
        assert.strictEqual(again.summary.embedded, 1, JSON.stringify(again.summary));
        const sent = host.embedCalls.flat().map((row) => row.recordId);
        assert.deepStrictEqual(sent, [mine.recordId],
            'the private record embeds and the shared one the host did not take this text for does not');
        assert.ok(texts.flat().every((text) => !/the newer body/.test(text)),
            'and the older body reaches the embedding server not at all: ' + JSON.stringify(texts));

        // The control: with the host's shared row back in step, that same
        // unembedded record does embed, so its absence above is the older
        // disposition and not a publish that stopped embedding shared records.
        shared.fileModified = '2000-01-01T00:00:00.000Z';
        const control = await publishWith(store, host);
        assert.strictEqual(control.summary.embedded, 1, JSON.stringify(control.summary));
        assert.deepStrictEqual(host.embedCalls[host.embedCalls.length - 1].map((row) => row.recordId),
            [shared.recordId], 'and the record it embeds is the shared one');
    } finally {
        rmStore(store);
    }
});

// One publish, one hash. The body hash is what the host's `changed` and
// `unchanged` dispositions turn on, and the local semantic sweep decides the
// same question for the same store, so two spellings of it would be two
// derived copies of one store built from two readings of it.
test('the body hash a publish sends is memory-index\'s own, not a second spelling of it', async () => {
    const store = makeStore();
    try {
        const body = '# a record\n\na body with a naive é and a 中文 word\n';
        writeRecord(store.memDir, 'hashed', body);
        const host = fakeHost();
        await publishWith(store, host);
        const sent = host.calls.filter((c) => c.procedure === 'usp_UpsertRecords')
            .flatMap((c) => c.parameters['@p_Records'] || [])[0];
        assert.strictEqual(sent.bodyHash, mi.hashOf(body),
            'the published hash is the sweep\'s hash of the same text');
    } finally {
        rmStore(store);
    }
});

// The batching the invariant permits. A record's chunks never split across two
// database calls; several whole records in one call is another matter, and at
// one call per record a first publish over a store of several hundred is
// several hundred process starts with a TLS login each.
test('several whole records ride one embedding call and one database call', async () => {
    const store = makeStore();
    try {
        for (let i = 0; i < 6; i++) {
            writeRecord(store.memDir, 'small-' + i, '# small ' + i + '\n\na short body\n');
        }
        const texts = [];
        const host = fakeHost();
        const result = await publishWith(store, host, { texts });
        assert.strictEqual(result.summary.embedded, 6, JSON.stringify(result.summary));
        assert.strictEqual(texts.length, 1,
            'six single-chunk records fit one embedding call: ' + JSON.stringify(texts.map((t) => t.length)));
        assert.strictEqual(texts[0].length, 6);
        assert.strictEqual(host.embedCalls.length, 1,
            'and one database call carries all six: ' + host.embedCalls.length);
        const ids = new Set(host.embedCalls[0].map((r) => r.recordId));
        assert.strictEqual(ids.size, 6);
        for (const row of host.embedCalls[0]) {
            assert.strictEqual(row.chunkIndex, 0, 'each record\'s own chunk index starts at zero');
        }
    } finally {
        rmStore(store);
    }
});

// The count on the summary is the host's own. A pack goes out as one vector row
// per chunk and the host answers how many of those rows it stored, so counting
// the records handed to the call reports a store that may never have happened:
// a row whose record the host does not hold is rejected and counted there, and
// the record it belongs to stays unsearchable until a later run embeds it.
test('the embedded count is what the host stored rather than what the run sent', async () => {
    const store = makeStore();
    try {
        // One record whose body is two chunks, so the vector rows outnumber the
        // records and a count of one is told from a count of the other.
        writeRecord(store.memDir, 'a-record',
            '# a record\n\n' + 'x'.repeat(5000) + '\n\n' + 'y'.repeat(5000) + '\n');
        const host = fakeHost();
        const run = await publishWith(store, host);
        const rows = host.embedCalls.reduce((n, call) => n + call.length, 0);
        assert.strictEqual(rows, 2, 'this case needs a record of two chunks: ' + rows);
        assert.strictEqual(run.summary.embedded, 1,
            'one record is embedded, whatever number of rows carried it: '
            + JSON.stringify(run.summary));
        assert.strictEqual(run.summary.embedRejected, 0, JSON.stringify(run.summary));

        // A pack the host stores short. The record is gone from the host by the
        // time its vectors arrive, which is what a row resolving to no visible
        // record looks like from here, and the host rejects and counts the rows
        // rather than writing them.
        fs.rmSync(db.queuePath(), { force: true });
        writeRecord(store.memDir, 'b-record', '# b record\n\na body\n');
        const losing = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_UpsertEmbeddings') return;
                for (const row of call.parameters['@p_Embeddings']) {
                    for (const [at, record] of [...losing.records.entries()]) {
                        if (record.recordId === row.recordId) losing.records.delete(at);
                    }
                }
            }
        });
        const short = await publishWith(store, losing);
        assert.ok(losing.embedCalls.length > 0, 'this case needs the vectors actually sent');
        assert.strictEqual(short.summary.embedded, 0,
            'a pack the host would not store counts nothing embedded: '
            + JSON.stringify(short.summary));
        assert.ok(short.summary.embedRejected > 0,
            'and the rows it rejected are counted: ' + JSON.stringify(short.summary));
        assert.ok(short.summary.failed.some((f) => /was not stored/.test(f)),
            'the shortfall is on the failure list: ' + JSON.stringify(short.summary.failed));
        assert.ok(/vector row\(s\) the host would not store/.test(db.summaryLine(short.summary)),
            'and on the one line a person reads: ' + db.summaryLine(short.summary));
    } finally {
        rmStore(store);
    }
});

// The pack is sized by what comes back, not by what goes out. The shared
// endpoint library reads a response body under a fixed byte bound, and one
// vector of this model's width printed as JSON is about twenty kilobytes, so a
// pack of the local sweep's sixteen would be a third of a megabyte and every
// full pack would be refused at the reader on every run. Only a store whose
// records happened to pack into fewer chunks would embed at all.
test('a full embedding pack fits inside the bound its response is read under', async () => {
    const endpointLib = require(path.join(SCRIPTS, 'kit-endpoint-lib.js'));
    const width = db.embedCallWidth();
    assert.ok(width >= 1 && width <= mi.EMBED_BATCH, 'the width is at most the sweep\'s own: ' + width);

    // A vector as the server prints one: 1024 floats at full double precision,
    // which is the widest a JSON number of this kind gets.
    const vector = Array.from({ length: 1024 }, (unused, at) => (at + 1) / 3e7 - 0.5);
    const body = (count) => JSON.stringify({
        object: 'list',
        data: Array.from({ length: count }, (unused, at) => ({ object: 'embedding', index: at, embedding: vector })),
        model: 'test-model'
    });
    assert.ok(Buffer.byteLength(body(width)) < endpointLib.MAX_BODY_BYTES,
        'a call at this width answers inside the bound: ' + Buffer.byteLength(body(width))
        + ' of ' + endpointLib.MAX_BODY_BYTES);

    // The control, withheld from the assertion above: the bound really does
    // refuse a wider answer, read through the real reader rather than measured
    // here, so the fit above is the width rather than a bound that never bites.
    const read = async (count) => {
        const res = new Response(body(count), { status: 200, headers: { 'content-type': 'application/json' } });
        return db.embedBatch(config(), new Array(count).fill('a text'),
            { deps: { fetchImpl: async () => res } });
    };
    const refused = await read(mi.EMBED_BATCH);
    assert.strictEqual(refused.ok, false, 'a pack of ' + mi.EMBED_BATCH + ' is past the reader\'s bound');
    assert.ok(/past \d+ bytes/.test(refused.detail), refused.detail);
    const taken = await read(width);
    assert.strictEqual(taken.ok, true, JSON.stringify(taken.detail));
    assert.strictEqual(taken.vectors.length, width);
});

test('no embedding call is sent wider than that', async () => {
    const store = makeStore();
    try {
        for (let i = 0; i < mi.EMBED_BATCH + 4; i++) {
            writeRecord(store.memDir, 'small-' + i, '# small ' + i + '\n\na short body\n');
        }
        const texts = [];
        const host = fakeHost();
        const result = await publishWith(store, host, { texts });
        assert.strictEqual(result.summary.embedded, mi.EMBED_BATCH + 4, JSON.stringify(result.summary));
        assert.ok(texts.length > 1, 'this case needs more records than one call takes');
        for (const call of texts) {
            assert.ok(call.length <= db.embedCallWidth(),
                'a call carried ' + call.length + ' texts, past the width a response fits in');
        }
    } finally {
        rmStore(store);
    }
});

// The four-characters-per-token estimate behind the chunk ceilings is a
// property of English prose and of this model's vocabulary. A body that is
// mostly CJK or emoji spends closer to a token per character, so it can chunk
// inside the character ceiling and still be refused by the server, every run,
// for as long as it stands. Batched, that one body would cost every record
// packed beside it the same refusal.
test('a body the server refuses does not hold back the records packed with it', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'ordinary-one', '# one\n\na short body\n');
        writeRecord(store.memDir, 'refused-body', '# refused\n\n' + '中'.repeat(3000) + '\n');
        writeRecord(store.memDir, 'ordinary-two', '# two\n\nanother short body\n');

        const host = fakeHost();
        const result = await db.publish({
            config: config(),
            deps: {
                runBatch: host.runBatch,
                embedBatch: async (cfg, sent) => {
                    if (sent.some((text) => text.includes('中'))) {
                        return { ok: false, detail: 'HTTP 400 from the embedding server' };
                    }
                    return { ok: true, vectors: sent.map((t) => [t.length, 1]) };
                }
            }
        });
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.embedded, 2,
            'the two the server took are embedded: ' + JSON.stringify(result.summary));
        assert.deepStrictEqual(result.summary.failed.map((f) => f.split(' ')[0]), ['refused-body'],
            'and only the body it refused is reported: ' + JSON.stringify(result.summary.failed));
        const stored = host.embedCalls.flat().map((r) => r.recordId);
        assert.strictEqual(new Set(stored).size, 2, 'two records reached the database call');

        // The control, withheld from the assertion above: with the server
        // taking that body too, all three embed, so the two above are the
        // retry rather than a pack that was never whole.
        for (const record of host.records.values()) record.embedded = false;
        const all = await publishWith(store, host);
        assert.strictEqual(all.summary.embedded, 3, JSON.stringify(all.summary));
        assert.deepStrictEqual(all.summary.failed, []);
    } finally {
        rmStore(store);
    }
});

// An empty reading of a store the host holds rows for is what a mis-resolved
// root, a moved directory and a permission change all look like from here, and
// it is indistinguishable from a store whose last record was deleted. The walk
// reports no failure in any of them, so the partial flag does not catch it.
test('a store the walk read empty holds its rows rather than removing all of them', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'one', '# one\n\na body\n');
        writeRecord(store.memDir, 'two', '# two\n\nanother body\n');
        const host = fakeHost();
        await publishWith(store, host);
        assert.strictEqual(host.records.size, 2);

        // Every record file gone at once, which is the emptied-store reading.
        fs.rmSync(store.memDir, { recursive: true, force: true });
        fs.mkdirSync(store.memDir, { recursive: true });
        const emptied = await publishWith(store, host);
        assert.strictEqual(emptied.summary.removed, 0, JSON.stringify(emptied.summary));
        assert.strictEqual(emptied.summary.heldBack, 2, JSON.stringify(emptied.summary));
        assert.strictEqual(host.records.size, 2, 'the rows stand until a walk finds the store at all');
        assert.ok(db.summaryLine(emptied.summary).includes('held back'), db.summaryLine(emptied.summary));

        // The control, withheld from the assertion above: one record back in
        // the store makes the other a real removal, so the hold is the empty
        // reading rather than a removal leg that never fires.
        writeRecord(store.memDir, 'one', '# one\n\na body\n');
        const partial = await publishWith(store, host);
        assert.strictEqual(partial.summary.removed, 1, JSON.stringify(partial.summary));
        assert.strictEqual(partial.summary.heldBack, 0);
    } finally {
        rmStore(store);
    }
});

// The probe the spec asks for. With an empty queue the first contact would
// otherwise be the record upsert at the full configured timeout plus the
// spawn's floor, so a hand-run publish against a dead host sits for about
// twelve seconds before saying anything.
//
// Its budget is this module's own and buys two whole seconds on each of
// sqlcmd's two clocks. The judged channel's 400 ms bounds an HTTP call in an
// interactive search; spent on a spawn it buys the one-second login clock the
// control below reads, which refuses a healthy host whose handshake and login
// together take longer than that and says nothing about it from the
// session-start spawn.
test('an unreachable host is discovered at the probe budget, before the drain or the walk', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);
        const memq = require(MEMQ);
        const seen = [];
        const result = await db.publish({
            config: config(),
            deps: {
                runBatch: (cfg, batch, opts) => {
                    seen.push({ call: parseCall(batch), opts });
                    return { ok: false, detail: 'the host did not answer' };
                },
                embedBatch: async () => ({ ok: true, vectors: [] })
            }
        });
        assert.strictEqual(result.ok, false, JSON.stringify(result));
        assert.strictEqual(result.standDown, 'unreachable');
        assert.strictEqual(seen.length, 1, 'exactly one call is made against a host that will not answer: '
            + JSON.stringify(seen.map((s) => s.call.procedure)));
        assert.strictEqual(seen[0].call.procedure, 'usp_Health');
        assert.strictEqual(seen[0].opts.budgetMs, db.PROBE_TIMEOUT_MS,
            'the probe is spent at this module\'s own probe budget');
        assert.strictEqual(db.clockSeconds(seen[0].opts.budgetMs), 2,
            'which buys two whole seconds on each of sqlcmd\'s two clocks');
        assert.ok(seen[0].opts.killMs <= db.PROBE_TIMEOUT_MS + 2000,
            'and its hard kill is the declared overshoot: ' + seen[0].opts.killMs);

        // The control, withheld from the assertion above: the judged channel's
        // budget spent on this spawn buys a one-second login clock, which is
        // the value the pin discriminates against.
        assert.strictEqual(db.clockSeconds(memq.JUDGED_PROBE_TIMEOUT_MS), 1,
            'the judged channel\'s budget is not a spawn budget');
        assert.strictEqual(queueCount(), 1,
            'the queue is untouched by a run that stood down');
    } finally {
        rmStore(store);
    }
});

// Which procedures take the fleet publish lock, read from the scripts that take
// it. The set is a property of the T-SQL and of nothing else, so a list spelled
// here would be a second copy of it: a third procedure that took the lock and
// was called on the configured timeout is exactly the defect the case below
// exists to catch, and a literal pair of names would stay green through it.
//
// The predicate is structural over the SQL rather than a second list: any script
// asking sp_getapplock for the resource the publish serializes on is a member,
// and the name comes off the ALTER the deployment shape puts every procedure
// behind. An empty answer is a defect here rather than a vacuous pass, since a
// case asserting something of no procedures asserts nothing.
//
// ITS REACH IS THE LITERAL RESOURCE STRING, AND THAT LIMIT IS STATED RATHER THAN
// IMPLIED. A script that took the same lock through a variable, declaring the
// resource and passing @Resource = @SomeLocal, is a member this pattern does not
// see, and the control below withholds the procedure's name rather than the
// spelling of the resource, so it proves the name extraction is derived and
// proves nothing about variable indirection. Every script in this tree spells
// the resource where it asks for the lock; one that stopped doing so would need
// this pattern widened with it.
const PROCEDURES_DIR = path.join(__dirname, '..', 'plugins', 'claude-kit', 'db', 'Procedures');
const PUBLISH_LOCK_RE = /sp_getapplock[\s\S]{0,200}?@Resource\s*=\s*N?'mem\.Publish'/i;
const PROCEDURE_NAME_RE = /^\s*;?\s*ALTER\s+PROCEDURE\s+mem\.(\w+)/im;
function lockTakingProcedures(dir) {
    const found = new Set();
    for (const file of fs.readdirSync(dir)) {
        if (!file.toLowerCase().endsWith('.sql')) continue;
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        if (!PUBLISH_LOCK_RE.test(sql)) continue;
        const named = PROCEDURE_NAME_RE.exec(sql);
        assert.ok(named, file + ' takes the publish lock and names the procedure it alters');
        found.add(named[1]);
    }
    return found;
}

test('every lock-taking call\'s query clock outlasts the lock the server waits on', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const host = fakeHost();
        await publishWith(store, host);
        // The procedures that take the fleet publish lock, read off the SQL that
        // takes it, and every call this run made to one of them, whichever leg
        // of the run made it.
        const takesLock = lockTakingProcedures(PROCEDURES_DIR);
        assert.ok(takesLock.size > 0,
            'the SQL names procedures that take the publish lock, since a run asserted against none of '
            + 'them asserts nothing: ' + PROCEDURES_DIR);
        const locking = host.calls.filter((c) => takesLock.has(c.procedure));
        // Every one of them, not one of them. A run that called only the record
        // upsert would leave the embedding write's own clock unasserted here,
        // and the pin on it would go quiet for want of a call rather than
        // because the clock was right.
        assert.deepStrictEqual(
            [...takesLock].filter((p) => !host.calls.some((c) => c.procedure === p)).sort(), [],
            'and this run calls every one of them: ' + [...takesLock].join(', ') + ' against '
            + host.calls.map((c) => c.procedure).join(', '));

        // The derived value, not the constant. Both procedures take the fleet
        // publish lock at @LockTimeout = 30000 so two sandboxes queue rather
        // than race, and what decides whether this client can wait that long is
        // the whole-second query clock its budget buys, which is
        // floor(budget / 2000). A client whose clock expires first is killed by
        // its own tool while the server would still have let it in, and the run
        // is abandoned for a condition that was resolving itself. On the
        // embedding write that costs the vectors too: the pack is reported
        // embedded and not stored, and the next run embeds the same records
        // again into the same wall.
        for (const call of locking) {
            assert.strictEqual(call.budgetMs, db.UPSERT_TIMEOUT_MS,
                call.procedure + ' spends this call\'s own budget: ' + call.budgetMs);
            assert.ok(db.clockSeconds(call.budgetMs) > db.LOCK_WAIT_MS / 1000,
                'and its query clock (' + db.clockSeconds(call.budgetMs) + 's) outlasts the '
                    + (db.LOCK_WAIT_MS / 1000) + 's the server waits on the lock');
        }

        // The control, withheld from the assertion above: the configured
        // timeout every other call spends is the shorter clock, which is the
        // value this pin discriminates against. It rides on a call this run
        // actually made rather than on the constant alone.
        const listed = host.calls.find((c) => c.procedure === 'usp_ListRecords');
        assert.strictEqual(listed.budgetMs, config().timeoutMs,
            'the inventory read stays on the configured timeout: ' + listed.budgetMs);
        assert.ok(db.clockSeconds(listed.budgetMs) < db.LOCK_WAIT_MS / 1000,
            'whose own clock (' + db.clockSeconds(listed.budgetMs) + 's) would expire first');

        // The control on the derivation, withheld from everything above: a
        // procedure this file never names, matched on the shape a lock-taking
        // script has rather than on its name, is found; a procedure taking some
        // other application lock is not; and a directory holding neither answers
        // empty, which is the state the first assertion in this case reds on. So
        // a third procedure that starts taking the publish lock is caught here
        // by what it does rather than by anyone remembering to list it.
        const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-sql-'));
        try {
            fs.writeFileSync(path.join(probe, '900-usp_Withheld.sql'),
                ';ALTER PROCEDURE mem.usp_WithheldFromThisFile\nAS\nBEGIN\n'
                + '\t;EXEC @LockResult = sp_getapplock @Resource = \'mem.Publish\', @LockMode = '
                + '\'Exclusive\', @LockOwner = \'Transaction\', @LockTimeout = 30000\nEND\n', 'utf8');
            fs.writeFileSync(path.join(probe, '910-usp_OtherLock.sql'),
                ';ALTER PROCEDURE mem.usp_SomeOtherLock\nAS\nBEGIN\n'
                + '\t;EXEC @LockResult = sp_getapplock @Resource = \'mem.SomethingElse\', @LockMode = '
                + '\'Exclusive\', @LockOwner = \'Transaction\', @LockTimeout = 30000\nEND\n', 'utf8');
            assert.deepStrictEqual([...lockTakingProcedures(probe)], ['usp_WithheldFromThisFile'],
                'the predicate reads the lock rather than a list of names');
            const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-sql-none-'));
            try {
                assert.strictEqual(lockTakingProcedures(empty).size, 0,
                    'and answers nothing where nothing takes the lock, which is what the assertion at '
                    + 'the head of this case refuses');
            } finally {
                fs.rmSync(empty, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(probe, { recursive: true, force: true });
        }
    } finally {
        rmStore(store);
    }
});

test('a boundary call is refused once the run deadline has passed, and the run reports what it did', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        // A clock this run cannot outrun: it starts at a fixed instant and every
        // boundary call advances it by half the run budget, so the probe and the
        // record batch spend the whole of it and the queue drain after them is
        // the first leg refused. Driving the run past its deadline this way
        // asks the question the wall clock would answer in fifteen minutes.
        let clock = 1000000;
        const host = fakeHost();
        const spawn = host.runBatch;
        host.runBatch = (cfg, batch, opts) => {
            clock += Math.ceil(db.RUN_BUDGET_MS / 2);
            return spawn(cfg, batch, opts);
        };
        const result = await db.publish({
            config: config(),
            deps: { runBatch: host.runBatch, embedBatch: fakeEmbedder(), now: () => clock }
        });

        assert.strictEqual(result.ok, true, 'a spent budget is not a stand-down: ' + JSON.stringify(result));
        assert.strictEqual(result.summary.outOfBudget, true, JSON.stringify(result.summary));
        assert.deepStrictEqual(host.calls.map((c) => c.procedure),
            ['usp_Health', 'usp_UpsertRecords'],
            'the calls inside the budget were made and no call after it was: '
                + host.calls.map((c) => c.procedure).join(', '));
        assert.strictEqual(result.summary.added, 1,
            'and the run reports the work it did rather than losing it: ' + JSON.stringify(result.summary));
        assert.ok(result.summary.failed.some((line) =>
            line.includes('the run budget') && line.includes('the queue drain')),
        'with the refused leg named: ' + JSON.stringify(result.summary.failed));
        assert.ok(db.summaryLine(result.summary).includes('the run budget was spent'),
            db.summaryLine(result.summary));

        // The control, withheld from the assertion above: the same store and the
        // same host on a clock that does not advance runs every call, so the
        // silence above is the deadline rather than a fixture that stops early.
        const second = fakeHost();
        const whole = await db.publish({
            config: config(),
            deps: { runBatch: second.runBatch, embedBatch: fakeEmbedder(), now: () => clock }
        });
        assert.strictEqual(whole.summary.outOfBudget, false, JSON.stringify(whole.summary));
        assert.deepStrictEqual(second.calls.map((c) => c.procedure),
            ['usp_Health', 'usp_UpsertRecords', 'usp_ListRecords', 'usp_UpsertEmbeddings',
                'usp_AppendPublishRun'],
            second.calls.map((c) => c.procedure).join(', '));
    } finally {
        rmStore(store);
    }
});

test('a call\'s clock is what is left of the run\'s budget, and the floor is where the overshoot comes from', () => {
    // The boundary values, which are the ones a budget gets wrong. A deadline
    // further off than the caller's own budget leaves that budget alone; one
    // millisecond of budget still buys a call, at the tool's floor, which is why
    // the call that crosses the deadline finishes within the floor of it rather
    // than being refused for a millisecond; and no budget at all is no call,
    // which is the answer that ends the run.
    const deadline = 1000000;
    assert.strictEqual(db.callBudget(deadline, deadline - 60000, 10000, 2000), 10000,
        'a deadline past the caller\'s own budget leaves it untouched');
    assert.strictEqual(db.callBudget(deadline, deadline - 6000, 10000, 2000), 6000,
        'and a nearer one bounds the clock to what is left');
    assert.strictEqual(db.callBudget(deadline, deadline - 1, 10000, 2000), 2000,
        'a millisecond of budget buys a call at the floor');
    assert.strictEqual(db.callBudget(deadline, deadline, 10000, 2000), null,
        'and no budget at all buys none');
    assert.strictEqual(db.callBudget(deadline, deadline + 60000, 10000, 2000), null,
        'as does a deadline already behind');
    assert.strictEqual(db.clockSeconds(db.callBudget(deadline, deadline - 1, 10000, 2000)), 1,
        'a call at the floor still buys a whole second on each of sqlcmd\'s two clocks');
});

test('an index line with no record file is reported as an orphan, and the run is recorded', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'real', '# real\n\na body\n', 'a real record');
        fs.appendFileSync(path.join(store.memDir, 'MEMORY.md'),
            '- [ghost](ghost.md) - a line whose file is gone\n', 'utf8');
        const host = fakeHost();
        const result = await publishWith(store, host);
        assert.strictEqual(result.summary.orphans, 1, JSON.stringify(result.summary));
        assert.deepStrictEqual(host.orphans, [{
            tier: 'project', segment: store.segment, name: 'ghost', description: 'a line whose file is gone'
        }]);
        assert.strictEqual(host.runs.length, 1);
        assert.strictEqual(host.runs[0].added, 1);
        assert.strictEqual(host.runs[0].embedded, 1);
        assert.strictEqual(host.runs[0].spoolDrained, 0);
        assert.strictEqual(host.runs[0].error, null);
    } finally {
        rmStore(store);
    }
});

// Where the drain sits in the run is a contract rather than an ordering
// preference, and this is the pin that keeps a later edit from moving it. A
// stamp names a record, and the host resolves that name against the records it
// holds: ahead of the upsert every stamp for a record the host has not seen
// resolves to nothing and is dropped, and the drain clears the file it sent, so
// the stamp is gone with the summary calling it delivered. Behind the embedding
// leg is no better, since the embedding is the long leg and the run's deadline
// stops a call rather than making it wait, so a busy run would never reach the
// drain at all.
test('the publish drains the queue behind the record upsert and ahead of the embedding, and reports the count', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.queueInsert([
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'applied')
        ]);
        const host = fakeHost({ resolvesStamps: true });
        const result = await publishWith(store, host);
        assert.strictEqual(result.summary.drained, 2, JSON.stringify(result.summary));

        const order = host.calls.map((c) => c.procedure);
        const first = (name) => order.indexOf(name);
        assert.strictEqual(order[0], 'usp_Health', 'the probe goes first: ' + order.join(', '));
        assert.ok(first('usp_UpsertRecords') > 0 && first('usp_AppendUsage') > first('usp_UpsertRecords'),
            'the records are published before the stamps that name them: ' + order.join(', '));
        assert.ok(first('usp_UpsertEmbeddings') > first('usp_AppendUsage'),
            'and the queue goes before the embedding leg, which is the long one a spent deadline '
            + 'stops: ' + order.join(', '));
        assert.strictEqual(queueCount(), 0);
        assert.ok(db.summaryLine(result.summary).includes('2 queue row(s) drained'), db.summaryLine(result.summary));
        assert.strictEqual(result.summary.rejected, 0,
            'and nothing was rejected, since the record existed by the time its stamps went: '
            + JSON.stringify(result.summary));
    } finally {
        rmStore(store);
    }
});

// The loss the order above exists to prevent, driven end to end. This is the
// first publish from a machine that has never published: the host holds no
// record at all, and every stamp on the queue names one of them.
test('a stamp for a record the host does not yet hold is written rather than rejected', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'fresh-record', '# a fresh record\n\na body\n');
        db.queueInsert([
            db.usageEntry('project', store.segment, 'fresh-record', 'fresh-record.md', 'read')
        ]);
        const host = fakeHost({ resolvesStamps: true });
        assert.strictEqual(host.records.size, 0, 'this case starts from a host that holds nothing');

        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.added, 1, 'the record was published by this same run');
        assert.strictEqual(result.summary.rejected, 0,
            'and its stamp resolved: ' + JSON.stringify(result.summary));
        assert.strictEqual(result.summary.drained, 1, JSON.stringify(result.summary));
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['fresh-record.md'],
            'the host holds the stamp rather than having dropped it: ' + JSON.stringify(host.usage));
        assert.ok(!result.summary.failed.some((f) => /rejected/.test(f)),
            JSON.stringify(result.summary.failed));

        // The control, withheld from the assertions above: a stamp naming a
        // record no file backs is rejected by this same host, so the row above
        // landed because the record was published first and not because this
        // host takes whatever it is sent.
        db.queueInsert([
            db.usageEntry('project', store.segment, 'ghost-record', 'ghost-record.md', 'read')
        ]);
        const after = await publishWith(store, host);
        assert.strictEqual(after.summary.rejected, 1, JSON.stringify(after.summary));
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['fresh-record.md'],
            'and no row was written for it: ' + JSON.stringify(host.usage));
    } finally {
        rmStore(store);
    }
});

// A REFUSAL IS NOT A HOST THAT DID NOT ANSWER, AND ON THESE LEGS IT IS
// PERMANENT. The probe answered one call earlier, so a refusal on a record leg
// names a defect in what this client built out of files every later run rebuilds
// the same way. Reported as an unreachable host it would send a reader to the
// network on every run forever while the fault sat in the data, and no publish
// run row would ever be written to say otherwise. The drain already makes this
// split on the cause the transport answers with, and these legs make the same
// one in the same words.
test('a host that refuses a record leg reports the refusal rather than a host that did not answer', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');

        // Each refusal leg writes the run's own row before it stands down, with
        // the refusal on its error column, because the host that refused is up
        // and answering and that row is the only trace the fleet gets of a
        // defect every later run repeats.
        const rowCarries = (host, count, words) => {
            assert.strictEqual(host.runs.length, count,
                'the refusal leg writes the run row: ' + JSON.stringify(host.runs));
            const error = String(host.runs[count - 1].error);
            assert.ok(error.includes(words), 'with the refusal on its error column: ' + error);
        };

        // The record upsert.
        const upsertHost = fakeHost({ fail: ['usp_UpsertRecords'] });
        const upsert = await publishWith(store, upsertHost);
        assert.strictEqual(upsert.ok, false, JSON.stringify(upsert));
        assert.strictEqual(upsert.standDown, 'refused', JSON.stringify(upsert));
        rowCarries(upsertHost, 1, 'the host refused usp_UpsertRecords');
        assert.ok(!fs.existsSync(db.queuePath()),
            'a failed record upsert never reaches the queue: the next walk re-derives it from the '
            + 'file');
        const said = db.standDownText(upsert);
        assert.ok(said.includes('usp_UpsertRecords') && said.includes('the host refused'),
            'the server\'s own words ride out: ' + said);
        assert.ok(!/did not answer/.test(said),
            'and nothing sends the reader to the network: ' + said);
        assert.ok(said.includes('a defect in what this client sends rather than a host to wait for'),
            'in the drain\'s own words rather than a fourth composition: ' + said);

        // The inventory read, which is the leg that learns the record ids.
        const listHost = fakeHost({ fail: ['usp_ListRecords'] });
        const listed = await publishWith(store, listHost);
        assert.strictEqual(listed.standDown, 'refused', JSON.stringify(listed));
        assert.ok(db.standDownText(listed).includes('usp_ListRecords'), db.standDownText(listed));
        rowCarries(listHost, 1, 'the host refused usp_ListRecords');

        // The removal marking, which is the same procedure under a different
        // parameter, so this case refuses that call alone.
        const host = fakeHost();
        const first = await publishWith(store, host);
        assert.strictEqual(first.ok, true, JSON.stringify(first));
        fs.rmSync(path.join(store.memDir, 'a-record.md'));
        writeRecord(store.memDir, 'another-record', '# another\n\na body\n');
        const refusingRemoval = (cfg, batch, options) => {
            const call = parseCall(batch);
            if (call.procedure === 'usp_UpsertRecords' && call.parameters['@p_Removed'] !== undefined) {
                return { ok: false, cause: 'refused', detail: 'the host refused the removal' };
            }
            return host.runBatch(cfg, batch, options);
        };
        const removal = await db.publish({
            config: config(),
            deps: { runBatch: refusingRemoval, embedBatch: fakeEmbedder() }
        });
        assert.strictEqual(removal.standDown, 'refused', JSON.stringify(removal));
        assert.ok(db.standDownText(removal).includes('the host refused the removal'),
            db.standDownText(removal));
        // The first, healthy run wrote its own row, so the refused run's is the
        // second.
        rowCarries(host, 2, 'the host refused the removal');

        // The control, withheld from every assertion above: a host that answers
        // nothing at all on the same leg is still reported as a host that did not
        // answer, so what moved is the refusal and not the word itself.
        const away = (cfg, batch, options) => {
            const call = parseCall(batch);
            if (call.procedure === 'usp_UpsertRecords') return { ok: false, detail: 'no answer' };
            return host.runBatch(cfg, batch, options);
        };
        const gone = await db.publish({
            config: config(),
            deps: { runBatch: away, embedBatch: fakeEmbedder() }
        });
        assert.strictEqual(gone.standDown, 'unreachable', JSON.stringify(gone));
        assert.ok(/did not answer/.test(db.standDownText(gone)), db.standDownText(gone));
        assert.strictEqual(host.runs.length, 2,
            'a host that did not answer is sent no run row: ' + JSON.stringify(host.runs));
    } finally {
        rmStore(store);
    }
});

// A run that stands down on a refusal prints the refusal and nothing else, so
// its run row's error column carries exactly that sentence. A walk that found
// five records twinned live and archived has five failures gathered ahead of
// the refusal, which fill the column's five slots if they ride along: the
// sentence that says why the run stopped is then the one dropped, and the five
// that stay are sentences no reader of that run was ever shown.
test('a refusal stand-down records on its run row the one sentence it printed', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        for (const name of ['one', 'two', 'three', 'four', 'five']) {
            writeRecord(store.memDir, name, '# ' + name + '\n\nthe live body\n');
            writeRecord(path.join(store.memDir, 'archive'), name, '# ' + name + '\n\nthe archived body\n');
        }
        const host = fakeHost({ fail: ['usp_UpsertRecords'] });
        const result = await publishWith(store, host);
        assert.strictEqual(result.standDown, 'refused', JSON.stringify(result));
        assert.strictEqual(host.runs.length, 1, JSON.stringify(host.runs));
        const error = String(host.runs[0].error);
        assert.ok(error.includes('the host refused usp_UpsertRecords'),
            'the refusal is on the column: ' + error);
        assert.strictEqual(error, db.columnText(db.standDownText(result)),
            'and the column is the printed stand-down sentence, rendered the one way: ' + error);
        // The control: the five twins were gathered by this run, so their
        // absence from the column is the stand-down's choice rather than a walk
        // that found nothing to say.
        const gathered = await publishWith(store, fakeHost());
        assert.strictEqual(gathered.summary.failed.filter((f) => /live and archived/.test(f)).length, 5,
            JSON.stringify(gathered.summary.failed));
        assert.ok(!/live and archived/.test(error), 'none of them is on the column: ' + error);
    } finally {
        rmStore(store);
    }
});

// --------------------------------------------------------------- the embedding --

test('a record\'s chunks never split across two database calls', async () => {
    const store = makeStore();
    try {
        // Two paragraphs per chunk at the target, enough of them to need
        // several embedding batches for one record.
        const paragraph = 'w'.repeat(3000);
        const long = new Array(40).fill(paragraph).join('\n\n');
        writeRecord(store.memDir, 'long-record', long);
        writeRecord(store.memDir, 'short-record', '# short\n\na short body\n');

        const texts = [];
        const host = fakeHost();
        const result = await publishWith(store, host, { texts });
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.ok(texts.length > 2, 'this case needs more than one embedding batch: ' + texts.length);
        assert.ok(texts.every((batch) => batch.length <= mi.EMBED_BATCH),
            'no batch is larger than the embedder\'s own batch');

        assert.strictEqual(host.embedCalls.length, 2, 'one database call per record, whatever its chunk count');
        for (const call of host.embedCalls) {
            const ids = new Set(call.map((row) => row.recordId));
            assert.strictEqual(ids.size, 1, 'a call carries one record\'s chunks and no other\'s');
            assert.deepStrictEqual(call.map((row) => row.chunkIndex), call.map((_, i) => i),
                'the chunk indexes run from zero with no gap, so the record is stored whole');
            for (const row of call) {
                assert.strictEqual(row.model, 'test-model', 'the stored model is the one the reader was asked about');
                assert.strictEqual(row.dimensions, row.vector.length);
            }
        }
    } finally {
        rmStore(store);
    }
});

test('the chunker splits at paragraph boundaries, partitions the body and never reaches the ceiling', () => {
    const body = ['# a record', 'x'.repeat(2500), 'y'.repeat(2500), 'z'.repeat(2500)].join('\n\n');
    const chunks = db.chunkBody(body);
    assert.ok(chunks.length > 1, 'a body past the target is split: ' + chunks.length);
    let at = 0;
    for (const chunk of chunks) {
        assert.strictEqual(chunk.text, body.slice(chunk.offset, chunk.offset + chunk.length));
        assert.ok(chunk.offset >= at, 'chunks run forward through the body');
        at = chunk.offset + chunk.length;
        assert.ok(chunk.length <= db.CHUNK_MAX_CHARS, 'no chunk reaches the ceiling: ' + chunk.length);
    }
    assert.strictEqual(chunks.map((c) => c.text).join(''), body, 'the chunks partition the body with nothing dropped');

    // One paragraph longer than the ceiling is split rather than refused, and a
    // body with nothing in it is no chunks rather than one empty chunk.
    const huge = db.chunkBody('a'.repeat(db.CHUNK_MAX_CHARS * 3));
    assert.ok(huge.length >= 3, 'an unbroken body is still split: ' + huge.length);
    assert.ok(huge.every((c) => c.length <= db.CHUNK_MAX_CHARS));
    assert.deepStrictEqual(db.chunkBody('   \n\n  '), []);
    assert.deepStrictEqual(db.chunkBody(undefined), []);
});

// A string index addresses UTF-16 code units, so a hard cut can fall between
// the halves of a surrogate pair. The lone half that leaves reaches the
// embedding server as an unpaired \uD8xx escape inside JSON, which its parser
// rejects, and the record then fails to embed on every run for as long as it
// stands.
test('an oversized paragraph of astral characters is never cut through a surrogate pair', () => {
    // One paragraph, no whitespace and no line break, of a character that is
    // two code units wide, long enough to force several hard cuts. The single
    // ASCII character in front puts every pair on an odd index, so a cut taken
    // at a fixed width lands between the halves of one rather than beside it.
    const astral = '\u{1F600}';
    const body = 'x' + astral.repeat(db.CHUNK_MAX_CHARS);
    const chunks = db.chunkBody(body);
    assert.ok(chunks.length > 2, 'this case needs several hard cuts: ' + chunks.length);
    for (const chunk of chunks) {
        const first = chunk.text.charCodeAt(0);
        const last = chunk.text.charCodeAt(chunk.text.length - 1);
        assert.ok(!(last >= 0xD800 && last <= 0xDBFF),
            'a chunk never ends on a high surrogate, which is half a character');
        assert.ok(!(first >= 0xDC00 && first <= 0xDFFF),
            'and never opens on a low one');
        // The real bar behind both: what is sent is text a JSON parser reads.
        assert.strictEqual(JSON.parse(JSON.stringify(chunk.text)), chunk.text);
        assert.ok(!/[\uD800-\uDFFF]/.test(chunk.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')),
            'no unpaired surrogate survives anywhere in the chunk');
    }
    assert.strictEqual(chunks.map((c) => c.text).join(''), body,
        'and the chunks still partition the body with nothing dropped');

    // A cut that lands in a word backs off to the previous whitespace where
    // one is close enough to reach. The paragraph is past the ceiling, so it
    // is hard-cut, and its repeating unit does not divide the target width, so
    // the fixed-width position falls inside a word rather than on a space.
    const words = 'abc def ghij '.repeat(600);
    assert.ok(words.length > db.CHUNK_MAX_CHARS, 'this case needs a hard cut');
    const wordChunks = db.chunkBody(words);
    assert.ok(wordChunks.length > 1, 'and several chunks: ' + wordChunks.length);
    assert.ok(/\s$/.test(wordChunks[0].text), 'a cut prefers the last break before it: '
        + JSON.stringify(wordChunks[0].text.slice(-12)));
    assert.strictEqual(wordChunks.map((c) => c.text).join(''), words,
        'and the backed-off cuts still partition the body');
});

// --------------------------------------------------------------- the transport --

test('a body that reads as a batch separator, a variable reference or a non-ASCII character survives the encoding', () => {
    const value = [{ body: 'line one\nGO\nline two\n$(PATH) and $(NAME)\nnaive éè 中文 \u0000 end', fileKey: 'x.md' }];
    const batch = db.payloadLiteral('@v1', value);
    assert.ok(/^[\x20-\x7E\n]*$/.test(batch), 'the batch text is pure ASCII, so the tool has no encoding to get wrong');
    assert.ok(!/^GO$/m.test(batch), 'no line of the batch reads as a batch separator');
    assert.ok(!batch.includes('$('), 'no $( reaches the batch, so the encoding is a belt beside -x rather than a sentence about one');
    assert.deepStrictEqual(payloadOf(batch, '@v1'), value, 'and the server parses back exactly what was sent');
});

test('the client writes the config password into one place and nowhere else', () => {
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8').split(/\r?\n/);
    const uses = [];
    source.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/password/i.test(line)) uses.push({ line: i + 1, text: line.trim() });
    });
    assert.deepStrictEqual(uses.map((u) => u.text), [
        'const password = typeof parsed.password === \'string\' ? parsed.password : \'\';',
        'if (!windowsAuth && password === \'\') missing.push(\'password\');',
        // The curator's pair: read, checked as a pair, named in the two
        // sentences that say it is half-given or absent, and carried on the
        // config's curator key.
        'const curatorPassword = typeof parsed.curatorPassword === \'string\' ? parsed.curatorPassword : \'\';',
        'if ((curatorLogin === \'\') !== (curatorPassword === \'\')) {',
        'detail: \'curatorLogin and curatorPassword are given together or not at all, and only \'',
        '+ (curatorLogin === \'\' ? \'curatorPassword\' : \'curatorLogin\') + \' is set\'',
        'const curator = curatorLogin === \'\' ? null : { login: curatorLogin, password: curatorPassword };',
        'server, database, login, password, timeoutMs, windowsAuth,',
        'if (!config.windowsAuth) env.SQLCMDPASSWORD = config.password;',
        '+ \' (curatorLogin and curatorPassword are absent), and this verb runs under\'',
        // The curator's password moves into the one slot the spawn reads, so
        // the line above is still the only place a password reaches a child.
        'password: loaded.config.curator.password,'
    ], 'each password is read, checked for presence, carried on the config and handed to the child\'s '
        + 'environment through one line; anything else here is a new path for it to leak by: '
        + JSON.stringify(uses));
});

test('the spawn hands the password to the child environment and never to an argument', () => {
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
    assert.ok(/args\.push\('-U', config\.login\)/.test(source), 'the login rides the command line');
    assert.ok(!/'-P'/.test(source), 'the password never does: a command line is readable from the process list');
});

// The child's environment is built, not copied. sqlcmd reads a dozen SQLCMD*
// variables, SQLCMDINI among them, which names a startup script the tool runs
// before the batch; a copied environment carries every one of them into a
// child holding the login's password. What is asserted is the whole set the
// child gets, because a fix that only deleted the names someone thought of is
// the defect in a different spelling.
test('the sqlcmd child gets an allowlisted environment with no SQLCMD name but the password', () => {
    const before = {
        ini: process.env.SQLCMDINI, server: process.env.SQLCMDSERVER,
        steer: process.env.KIT_STEERING_VALUE
    };
    // A value generated here rather than written down, so this file carries no
    // password-shaped literal even as a fixture.
    const secret = require('node:crypto').randomBytes(12).toString('hex');
    process.env.SQLCMDINI = path.join(os.tmpdir(), 'a-startup-script.sql');
    process.env.SQLCMDSERVER = 'an-elsewhere-server';
    process.env.KIT_STEERING_VALUE = 'a value from this process';
    try {
        const env = db.childEnvironment(config({ windowsAuth: false, login: 'kit_test_login', password: secret }));
        const sqlcmdNames = Object.keys(env).filter((k) => /^SQLCMD/i.test(k));
        assert.deepStrictEqual(sqlcmdNames, ['SQLCMDPASSWORD'],
            'the only SQLCMD name the child gets is the secret it is being given: ' + JSON.stringify(sqlcmdNames));
        assert.strictEqual(env.SQLCMDPASSWORD, secret, 'and that one carries the config\'s value');
        assert.strictEqual(env.SQLCMDINI, undefined, 'a startup script named by this process never reaches the child');
        assert.strictEqual(env.KIT_STEERING_VALUE, undefined,
            'and neither does anything else outside the allowlist');
        assert.ok(Object.keys(env).some((k) => /^systemroot$/i.test(k)),
            'the child still gets what a process needs to run: ' + JSON.stringify(Object.keys(env)));
        // PATH is withheld, and the spawn names the tool's own directory as the
        // child's working directory, because the Windows loader searches both
        // for a dependent library it has not found: two ways a directory
        // somebody else writes gets a say inside a process holding the login's
        // password.
        assert.deepStrictEqual(Object.keys(env).filter((k) => /^path$/i.test(k)), [],
            'and no PATH: ' + JSON.stringify(Object.keys(env)));

        // The control, withheld from the assertions above: this process really
        // does hold the names that came back absent, so the absences are the
        // allowlist rather than an environment that never had them.
        assert.strictEqual(process.env.SQLCMDINI, path.join(os.tmpdir(), 'a-startup-script.sql'));
        assert.strictEqual(process.env.SQLCMDSERVER, 'an-elsewhere-server');

        // Under Windows authentication the child is given no secret at all.
        const windows = db.childEnvironment(config());
        assert.deepStrictEqual(Object.keys(windows).filter((k) => /^SQLCMD/i.test(k)), []);

        // The wiring: the spawn's environment is this object and not a copy
        // made beside it. Read from the source because the spawn is the
        // boundary itself and nothing below it is observable from here.
        const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
        assert.ok(/const env = childEnvironment\(config\);/.test(source),
            'runBatch builds the child environment through the allowlist');
        assert.ok(!/\{ \.\.\.process\.env \}/.test(source), 'and never copies this process\'s own');
        assert.ok(/cwd: path\.dirname\(tool\),/.test(source),
            'and the child is started from the tool\'s own directory');
    } finally {
        for (const [name, value] of [['SQLCMDINI', before.ini], ['SQLCMDSERVER', before.server],
            ['KIT_STEERING_VALUE', before.steer]]) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    }
});

// The model identity is the one scalar this client writes into a batch, so the
// config read holds it to the batch's own screen. Left to the call, a model
// string the screen refuses would be reported as a host that did not answer,
// every run, on a machine whose host is up and whose config has a typo in it.
test('a model identity the batch would refuse is a config defect, named at the config', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-config-'));
    const file = path.join(dir, 'kit-memory-db.json');
    const write = (model) => fs.writeFileSync(file, JSON.stringify({
        server: 'kit-db-test', database: 'KitMemoryTest', windowsAuth: true,
        embedding: { url: 'http://127.0.0.1:1', model }
    }) + '\n', 'utf8');
    try {
        write('a model with an \' in it');
        const refused = db.loadConfig(file);
        assert.strictEqual(refused.ok, false, JSON.stringify(refused));
        assert.strictEqual(refused.reason, 'invalid');
        assert.ok(/embedding\.model/.test(refused.detail), refused.detail);

        // The control, withheld from the assertion above: the same config with
        // an ordinary model loads, so the refusal is the screen rather than a
        // reader that refuses everything.
        write('BAAI/bge-m3');
        const loaded = db.loadConfig(file);
        assert.strictEqual(loaded.ok, true, JSON.stringify(loaded));
        assert.strictEqual(loaded.config.embedding.model, 'BAAI/bge-m3');
    } finally {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
});

// The client tools are resolved at one fixed absolute path or not at all.
// Resolving by bare name searches PATH, which is the list the pin exists to
// avoid: it hands the login's password to whatever sqlcmd sits earliest in it,
// and a user-writable directory ahead of the real one is the ordinary way that
// becomes someone else's process. An environment variable naming the base
// directory is that same hazard one step removed, since the value is one a
// committed terminal environment sets and the planted file under it passes
// every check an absolute path can be held to.
test('an absent client tool is a named stand-down, never a PATH search or an environment one', () => {
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
    assert.ok(!/'sqlcmd\.exe'|'sqlcmd'/.test(source),
        'no bare tool name appears in the client at all');
    assert.ok(!/process\.env\.ProgramFiles/.test(source),
        'and no environment variable chooses which binary receives the password');

    const before = process.env.ProgramFiles;
    try {
        // A ProgramFiles pointed at a directory that really does hold a file at
        // the pinned relative path, which is the planted-tool shape exactly.
        // The resolution must not find it.
        const planted = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-planted-'));
        const plantedTool = path.join(planted, 'Microsoft SQL Server', 'Client SDK',
            'ODBC', '170', 'Tools', 'Binn', 'SQLCMD.EXE');
        fs.mkdirSync(path.dirname(plantedTool), { recursive: true });
        fs.writeFileSync(plantedTool, 'not a tool\n', 'utf8');
        process.env.ProgramFiles = planted;
        try {
            const resolved = db.sqlcmdPath();
            assert.notStrictEqual(resolved, plantedTool, 'the planted tool is never what resolves');
            assert.ok(resolved === null || resolved.startsWith('C:\\Program Files\\'),
                'the one base is the literal one: ' + resolved);

            // The control, withheld from the assertion above: the planted file
            // is really there, at the name the resolution would join, so the
            // miss is the fixed base rather than a file that was not written.
            assert.ok(fs.statSync(plantedTool).isFile());
        } finally {
            try { fs.rmSync(planted, { recursive: true, force: true }); } catch { /* best effort */ }
        }

        // The stand-down itself, on a machine that does have the tools: the
        // pinned file is reported absent for the length of the call, which is
        // the one condition the branch reads.
        const realStat = fs.statSync;
        fs.statSync = (target, ...rest) => {
            if (typeof target === 'string' && /SQLCMD\.EXE$/i.test(target)) {
                const err = new Error('no such file');
                err.code = 'ENOENT';
                throw err;
            }
            return realStat(target, ...rest);
        };
        try {
            assert.strictEqual(db.sqlcmdPath(), null, 'with the pinned file absent nothing resolves');
            const answered = db.runBatch(config(), ';SELECT 1', { budgetMs: 10000 });
            assert.strictEqual(answered.ok, false);
            assert.ok(/client tools are not installed/.test(answered.detail), answered.detail);
            assert.ok(/SQLCMD\.EXE/i.test(answered.detail), 'and it names the path it looked at: ' + answered.detail);
        } finally {
            fs.statSync = realStat;
        }
    } finally {
        if (before === undefined) delete process.env.ProgramFiles;
        else process.env.ProgramFiles = before;
    }
});

// The batch carries whole private record bodies, so it never becomes a file.
// A temp file's confidentiality on Windows rests on the directory's own access
// list, since Node's mode argument there moves only the read-only attribute,
// and the directory is named by an environment variable the child allowlist
// carries. Standard input has no such question: the bytes go down a pipe
// between this process and its own child.
test('the batch goes to the tool on standard input, never through a file', () => {
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
    assert.ok(/input: batch \+ '\\n',/.test(source), 'the spawn passes the batch as its input');
    assert.ok(!/'-i'/.test(source), 'and names no input file to the tool');
    assert.ok(!/\.sql'/.test(source), 'so no batch file name is spelled here at all');
    assert.ok(!/tmpdir\(\)/.test(source), 'and the temp directory is not a place this client writes');
    // That the tool accepts a batch this way, beside the flags above, is what
    // the install suite's live transport case proves: it runs this client's
    // real runBatch against a real server, and a tool waiting on an input file
    // it was never given would hang there rather than answer.
});

// The index descriptions are read once per directory per run, which is a
// speedup within a run and a stale reading across two of them.
test('a second walk reads the index again rather than the first walk\'s copy', () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n', 'the first description');
        const first = db.collectRecords();
        assert.strictEqual(first.records.length, 1);
        assert.strictEqual(first.records[0].description, 'the first description');

        fs.writeFileSync(path.join(store.memDir, 'MEMORY.md'),
            '# Memory\n- [a-record](a-record.md) - the second description\n', 'utf8');
        const second = db.collectRecords();
        assert.strictEqual(second.records[0].description, 'the second description',
            'the second walk reads what the index says now');
    } finally {
        rmStore(store);
    }
});

// ONE FILE'S CLOCK CANNOT BE ALLOWED TO STOP EVERY PUBLISH. The record's
// modification time is read from the filesystem and sent as a DATETIMEOFFSET,
// and mem.usp_UpsertRecords throws over the whole batch when it cannot read the
// value. The walk re-derives every record from the files on every run, so a time
// outside that type's range would fail every batch on every run for as long as
// that file stood, and the publish would stand down with none of its legs
// reached. A time this runtime cannot represent at all is worse: toISOString
// throws a RangeError, which nothing below the top-level handler catches.
//
// The seam is the filesystem, because the platform's own utimes clamps a
// far-future time rather than storing it, so a case that wrote one would be
// asserting about the clamp.
test('a record whose modification time no timestamp column can hold is sent without one', () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const file = path.join(store.memDir, 'a-record.md');
        const realStat = fs.statSync;
        const withMtime = (mtimeMs, run) => {
            try {
                fs.statSync = function (target, ...rest) {
                    const out = realStat.call(this, target, ...rest);
                    if (typeof target === 'string' && path.resolve(target) === path.resolve(file)) {
                        out.mtimeMs = mtimeMs;
                    }
                    return out;
                };
                return run();
            } finally {
                fs.statSync = realStat;
            }
        };

        // A year past the four digits the type takes, which this runtime renders
        // as an expanded year.
        const yearTenThousand = Date.UTC(1970, 0, 1) + 253402300800000;
        assert.ok(/^\+/.test(new Date(yearTenThousand).toISOString()),
            'this case needs a time the column cannot hold: '
            + new Date(yearTenThousand).toISOString());
        const far = withMtime(yearTenThousand, () => db.collectRecords());
        assert.strictEqual(far.records.length, 1, JSON.stringify(far));
        assert.strictEqual(far.records[0].fileModified, null,
            'a time the column cannot hold is sent as none rather than as itself: '
            + JSON.stringify(far.records[0].fileModified));

        // And a time this runtime cannot represent at all, which renders by
        // throwing.
        const unrepresentable = withMtime(NaN, () => db.collectRecords());
        assert.strictEqual(unrepresentable.records.length, 1, JSON.stringify(unrepresentable));
        assert.strictEqual(unrepresentable.records[0].fileModified, null,
            'and one that cannot be rendered at all takes the same disposition rather than '
            + 'throwing out of the walk');
        assert.deepStrictEqual(unrepresentable.failed, [],
            'the record is published without a time rather than reported unreadable: '
            + JSON.stringify(unrepresentable.failed));

        // The control, withheld from the readings above: the same walk over the
        // same file with the filesystem's own time sends that time, so the null
        // is the screen and not a field this walk never fills.
        const ordinary = db.collectRecords();
        assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(String(ordinary.records[0].fileModified)),
            'an ordinary time rides out as the column reads it: '
            + JSON.stringify(ordinary.records[0].fileModified));
    } finally {
        rmStore(store);
    }
});

// The other half of that contract, which lives on the host: a record arriving
// with no modification time is upserted rather than refused. Each side tested
// only against its own literal is how a client sending null and a procedure
// refusing it stay invisible to both suites.
test('the record upsert takes a record with no modification time', () => {
    const sql = fs.readFileSync(path.join(PROCEDURES_DIR, '040-usp_UpsertRecords.sql'), 'utf8');
    const refusal = /IF EXISTS \(\s*SELECT\s+NULL\s+FROM\s+@Incoming I\s+WHERE([\s\S]*?)THROW/.exec(sql);
    assert.ok(refusal, 'the procedure refuses a row whose shape no store can hold');
    assert.ok(!/FileModifiedDt/.test(refusal[1]),
        'and a missing modification time is not one of those shapes: ' + refusal[1]);
    assert.ok(/\[FileModifiedDt\]\s+DATETIMEOFFSET\s+NULL/.test(sql),
        'the column it lands in takes none');
    // The one comparison that reads the value asks for it on both sides, so a
    // record with none is never skipped as the older copy.
    assert.ok(/I\.\[FileModifiedDt\] IS NOT NULL[\s\S]{0,200}?R\.\[FileModifiedDt\] IS NOT NULL/.test(sql),
        'and the older-copy comparison requires a time on both sides');

    // The control, planted rather than found: the same reading over a refusal
    // that does name the column sees it, so the silence above is this
    // procedure's and not a pattern that matches nothing.
    const planted = 'IF EXISTS (\tSELECT\tNULL\n\t\t\t\t\tFROM\t@Incoming I\n'
        + '\t\t\t\t\tWHERE\tI.[FileModifiedDt] IS NULL\t)\n\t\t\tTHROW 50000';
    const found = /IF EXISTS \(\s*SELECT\s+NULL\s+FROM\s+@Incoming I\s+WHERE([\s\S]*?)THROW/.exec(planted);
    assert.ok(found && /FileModifiedDt/.test(found[1]),
        'the reading finds the column where a refusal names it');
});

test('the client loads its siblings by fixed specifier, never one it was handed', () => {
    // The property memq's grant screen rests on, asked of the one module memq
    // binds outside hooks/. A load whose specifier is computed is the shape that
    // could carry a directory a command line named.
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8').split(/\r?\n/);
    const loads = [];
    source.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        const m = /\brequire\s*\(([^)]*)\)/.exec(line);
        if (m) loads.push(/^'[^']+'$/.test(m[1].trim()) ? m[1].trim().slice(1, -1) : null);
    });
    assert.ok(loads.length > 0, 'the client loads modules');
    assert.ok(loads.every((m) => m !== null), 'every specifier is a literal: ' + JSON.stringify(loads));
    assert.deepStrictEqual(loads.filter((m) => m.startsWith('.')).sort(),
        ['../hooks/kit-compact-lib.js', './kit-endpoint-lib.js', './memory-index.js', './memq.js'],
        'and the modules it loads are these four: ' + JSON.stringify(loads));
});

// ------------------------------------------------------------------- the CLI --

const NO_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-home-'));

function childEnv(store, home, extra) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        const lower = k.toLowerCase();
        if (lower === 'userprofile' || lower === 'home' || lower === 'kit_run_id'
            || lower === 'kit_memory_project') delete env[k];
    }
    return {
        ...env,
        HOME: home,
        USERPROFILE: home,
        KIT_MEMORY_ROOT: store.root,
        KIT_MEMORY_ROOT_ALLOW_DATA: '1',
        ...(extra || {})
    };
}

function runMemq(store, args, home, extra) {
    return spawnSync(process.execPath, [MEMQ].concat(args), {
        cwd: store.proj, encoding: 'utf8', env: childEnv(store, home || NO_HOME, extra)
    });
}

// A store that IS the default one for the child that reads it: a temp home
// whose .claude directory is the store root, with no KIT_MEMORY_ROOT set at
// all. `db-sync` publishes only against the machine's own store, so this is
// the fixture shape every db-sync case that must get past that gate takes.
function makeHomeStore() {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-homestore-'));
    const root = path.join(home, '.claude');
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-proj-'));
    const segment = proj.replace(/[^A-Za-z0-9]/g, '-');
    const memDir = path.join(root, 'projects', segment, 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    return { home, root, proj, segment, memDir };
}

function rmHomeStore(store) {
    for (const dir of [store.home, store.proj]) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a temp directory left behind never fails a case */ }
    }
}

// Runs memq with the home store as the machine's own store: no KIT_MEMORY_ROOT
// and no allow-data signal, so memq resolves <home>/.claude for itself.
function runMemqAtHome(store, args) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        const lower = k.toLowerCase();
        if (lower === 'userprofile' || lower === 'home' || lower === 'kit_run_id'
            || lower === 'kit_memory_project' || lower === 'kit_memory_root'
            || lower === 'kit_memory_root_allow_data') delete env[k];
    }
    env.HOME = store.home;
    env.USERPROFILE = store.home;
    return spawnSync(process.execPath, [MEMQ].concat(args), {
        cwd: store.proj, encoding: 'utf8', env
    });
}

// The exit code is the only thing a caller that reads no text can see, and two
// of this verb's callers read no text: the session-start spawn is detached with
// nobody on its standard error, and the doctor step reports its verdict from the
// verb's own result. So the code answers one question, whether anything this run
// set out to do failed, and the printed list answers another, what a person
// should read. They part on a busy machine: a drain that left a row written
// behind its own read delivered every row it read, and a payload past what one
// call funds is a warning about the next run. A verb that failed on either would
// report failure on an ordinary run and teach its reader to ignore the code.
test('memq db-sync prints every sentence a run left and exits non-zero only for what failed', async () => {
    // Every summary comes from a real publish rather than being written out
    // here, so the shape the verb reads is the shape the client produces.
    const store = makeStore();
    const summaries = {};
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const queued = (entries) => {
            fs.rmSync(db.queuePath(), { force: true });
            db.queueInsert(entries);
        };
        const oneRow = () => [db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')];

        queued(oneRow());
        summaries.clean = (await publishWith(store, fakeHost())).summary;

        // A stamp landing while the drain's own call is in flight, which leaves
        // one row on the queue the host has never seen.
        const racingHost = () => {
            let inserted = 0;
            return fakeHost({
                onCall: (call) => {
                    if (call.procedure !== 'usp_AppendUsage' || inserted > 0) return;
                    inserted += 1;
                    db.queueInsert([db.usageEntry('project', store.segment, 'late', 'late.md', 'applied')]);
                }
            });
        };
        queued(oneRow());
        summaries.raced = (await publishWith(store, racingHost())).summary;

        // The trap the two states set together: the warning is noted before the
        // call and the late row is behind the read, and a drain that dropped its
        // detail whenever it left a row would swallow the warning here.
        const many = [];
        for (let at = 0; at < 3000; at += 1) {
            many.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        queued(many);
        summaries.racedOversized = (await publishWith(store, racingHost())).summary;

        // The third busy-machine state: another connection holding the queue's
        // write lock, which is what an interactive stamp's own insert takes, while
        // the drain wants to delete under it. WAL lets the read through, so the
        // host takes the row and the delete is the only thing the lock stops:
        // nothing is lost and nothing failed, so it prints its sentence and exits
        // zero like the other two, and the next run's resend inserts once.
        queued(oneRow());
        const holder = holdQueueLock();
        try {
            summaries.contended = (await publishWith(store, fakeHost())).summary;
        } finally {
            holder.release();
        }

        queued(oneRow());
        summaries.refused = (await publishWith(store, fakeHost({ fail: ['usp_AppendUsage'] }))).summary;

        // A host that answered nothing at all, which the transport reports with
        // no cause of its own and the drain reads as an outage.
        queued(oneRow());
        const silent = fakeHost();
        const spoke = silent.runBatch;
        silent.runBatch = (cfg, batch, options) => (/EXEC mem\.usp_AppendUsage/.test(batch)
            ? { ok: false, detail: 'the host did not answer' }
            : spoke(cfg, batch, options));
        summaries.outage = (await publishWith(store, silent)).summary;

        // A queue no connection can open, which is what a foreign writer or a
        // half-copied file leaves at that path.
        fs.rmSync(db.queuePath(), { force: true });
        fs.writeFileSync(db.queuePath(), 'not a database at all', 'utf8');
        summaries.unreadable = (await publishWith(store, fakeHost())).summary;

        // A queue the delete cannot land on, with the table taken out from under
        // the drain's own connection while its send is in flight.
        queued(oneRow());
        summaries.unclearable = (await publishWith(store, fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage') return;
                const other = new DatabaseSync(db.queuePath());
                try { other.exec('DROP TABLE IF EXISTS queue'); } finally { other.close(); }
            }
        }))).summary;
    } finally {
        rmStore(store);
    }

    // The states the fixtures above must actually be in, asserted before any
    // exit code is read off them: a fixture that quietly reached some other
    // disposition would prove the code for a case nobody wrote.
    assert.deepStrictEqual(summaries.clean.failed, [], JSON.stringify(summaries.clean.failed));
    assert.strictEqual(summaries.clean.drained, 1, JSON.stringify(summaries.clean));
    assert.strictEqual(summaries.raced.queueRemaining, 1, JSON.stringify(summaries.raced));
    assert.deepStrictEqual(summaries.raced.failed, [], JSON.stringify(summaries.raced.failed));
    assert.strictEqual(summaries.racedOversized.queueRemaining, 1,
        JSON.stringify(summaries.racedOversized));
    assert.strictEqual(summaries.racedOversized.failed.length, 1,
        JSON.stringify(summaries.racedOversized.failed));
    assert.strictEqual(summaries.contended.drained, 0,
        'the contended drain took nothing off the queue: ' + JSON.stringify(summaries.contended));
    assert.strictEqual(summaries.contended.workFailed, false,
        'and a lock somebody else holds is not this run\'s failure: '
        + JSON.stringify(summaries.contended));
    // The number that keeps that zero-exit run honest. Nothing came off, so the
    // row is still on the queue, and a machine reading this summary can tell this
    // run from one that emptied it.
    assert.strictEqual(summaries.contended.queueRemaining, 1,
        'the contended run says what is still on the queue: '
        + JSON.stringify(summaries.contended));
    assert.ok(/1 queue row\(s\) still on the queue/.test(db.summaryLine(summaries.contended)),
        'and the summary line states it: ' + db.summaryLine(summaries.contended));
    for (const [name, mark] of [['contended', 'the queue (contended): '],
        ['refused', 'the queue (refused): '], ['outage', 'the queue (outage): '],
        ['unreadable', 'the queue (unreadable): '],
        ['unclearable', 'the queue (unclearable): ']]) {
        assert.ok(summaries[name].failed.some((f) => f.startsWith(mark)),
            name + ' must reach its own state: ' + JSON.stringify(summaries[name].failed));
    }
    assert.ok(/could not be read/.test(summaries.unreadable.failed.join(' ')),
        'the unreadable queue is the open that failed: ' + JSON.stringify(summaries.unreadable.failed));
    assert.ok(/could not be removed/.test(summaries.unclearable.failed.join(' ')),
        'and the unclearable one is the delete: ' + JSON.stringify(summaries.unclearable.failed));

    // The verb itself, run as a child with those same summaries in place of a
    // host: the publish is replaced at the module the CLI loads, so everything
    // from the summary line to the exit code is the real code path.
    const home = makeHomeStore();
    try {
        const preload = path.join(home.home, 'stub-publish.js');
        fs.writeFileSync(preload,
            'const client = require(' + JSON.stringify(CLIENT_SOURCE) + ');\n'
            + 'client.isDefaultStoreRoot = () => true;\n'
            + 'client.publish = async () => ({ ok: true, summary: JSON.parse(process.env.KITDB_SUMMARY) });\n',
            'utf8');
        const runWith = (summary) => {
            const env = { ...process.env, HOME: home.home, USERPROFILE: home.home,
                KITDB_SUMMARY: JSON.stringify(summary) };
            delete env.KIT_MEMORY_ROOT;
            delete env.KIT_MEMORY_ROOT_ALLOW_DATA;
            return spawnSync(process.execPath, ['--require', preload, MEMQ, 'db-sync'],
                { cwd: home.proj, encoding: 'utf8', env });
        };

        // The ordinary run and the two busy-machine states, which exit zero: the
        // records published, the queue's rows delivered, and one warning about a
        // queue this size on the run after this one.
        const clean = runWith(summaries.clean);
        assert.strictEqual(clean.status, 0,
            'a publish that left nobody anything exits zero: ' + clean.stdout + clean.stderr);
        assert.ok(/db-sync: /.test(clean.stdout), clean.stdout);
        assert.strictEqual(clean.stderr, '',
            'and it says nothing on standard error: ' + clean.stderr);

        const raced = runWith(summaries.raced);
        assert.strictEqual(raced.status, 0,
            'a drain that delivered every row it read is clean: ' + raced.stdout + raced.stderr);
        assert.strictEqual(raced.stderr, '',
            'and the count it left behind rides on the summary line alone: ' + raced.stderr);
        assert.ok(/1 queue row\(s\) still on the queue/.test(raced.stdout),
            'which is where a reader finds it: ' + raced.stdout);
        assert.ok(!/during the drain/.test(raced.stdout),
            'as a number and nothing more: ' + raced.stdout);

        const both = runWith(summaries.racedOversized);
        assert.strictEqual(both.status, 0,
            'a late row over an oversized payload is still no failure: ' + both.stdout + both.stderr);
        assert.ok(/past the \d+ characters one call funds/.test(both.stderr),
            'and the warning survives it: ' + both.stderr);

        const locked = runWith(summaries.contended);
        assert.strictEqual(locked.status, 0,
            'a queue somebody else is writing to is a busy machine, not a failed run: '
            + locked.stdout + locked.stderr);
        assert.ok(/the queue \(contended\)/.test(locked.stderr),
            'and the reason says which state it was, since nothing was drained: ' + locked.stderr);

        // The failures, each of which leaves work undone: rows the host refused,
        // a host that never answered, a queue this machine could not open and one
        // it could not delete from.
        for (const name of ['refused', 'outage', 'unreadable', 'unclearable']) {
            const run = runWith(summaries[name]);
            assert.strictEqual(run.status, 1,
                name + ' is a failure and exits non-zero: ' + run.stdout + run.stderr);
            assert.ok(/db-sync: /.test(run.stdout), 'the summary still prints: ' + run.stdout);
            assert.strictEqual(run.stderr.split('\n').filter((l) => l !== '').length,
                summaries[name].failed.length,
                'one line per reason, and no reason left unprinted: ' + run.stderr);
        }

        // ONE SENTENCE, TWO CHANNELS, ONE RENDERING. A reason goes to the screen
        // through the CLI's own renderer and to the host through this client's
        // column renderer, and the two are the same text under the same cap by
        // design: a column that cut somewhere else, kept a character the screen
        // strips or dropped one the screen keeps would store a sentence nobody
        // ever read under the same run. Each side tested only against its own
        // literal is how that difference stays invisible, so the pin is the two
        // renderings of one value compared byte for byte.
        //
        // The value carries every pass that separates the two renderers: a
        // character outside printable ASCII, the quote this kit bars, and more
        // text than one sentence's cap takes. It names no path under any home
        // directory, because the child's home is this fixture's and the parent's
        // is the machine's, and an elision is the one pass the two processes
        // cannot agree on from here. The case above proves that pass in process.
        const shared = 'Msg 50000: the host said "no" \u0001 and then ' + 'x'.repeat(1400);
        const rendered = runWith({ ...summaries.clean, failed: [shared] });
        assert.strictEqual(rendered.status, 0, rendered.stdout + rendered.stderr);
        assert.strictEqual(rendered.stderr.trim(), 'memq: ' + db.columnText(shared),
            'the screen and the host get one sentence rendered one way: ' + rendered.stderr);
        assert.ok(/characters removed/.test(rendered.stderr) && /cut to fit/.test(rendered.stderr),
            'and this case must exercise the passes it is pinning: ' + rendered.stderr);

        // A run carrying two reasons prints both and still exits once.
        const two = runWith({ ...summaries.refused,
            failed: ['the first reason', 'the second reason'] });
        assert.strictEqual(two.status, 1, two.stdout + two.stderr);
        assert.ok(/the first reason/.test(two.stderr) && /the second reason/.test(two.stderr),
            two.stderr);
    } finally {
        rmHomeStore(home);
    }
});

test('memq db-sync on a machine with no client config says so and writes nothing', () => {
    const store = makeHomeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const res = runMemqAtHome(store, ['db-sync']);
        assert.strictEqual(res.status, 1, res.stdout + res.stderr);
        assert.strictEqual(res.stdout, '');
        assert.ok(res.stderr.includes('no memory database is configured on this machine'), res.stderr);
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-queue.sqlite')));
    } finally {
        rmHomeStore(store);
    }
});

// THE SERVER'S OWN DIAGNOSIS IS THE PART NO READER CAN RECONSTRUCT, so it has to
// survive the trip to the screen whole. Two things could take it: a cap the
// client's own boilerplate spends before the server's words begin, and a
// renderer that takes a path apart on the way. So the words ride in front of the
// boilerplate, the cap is the one a publish failure takes, and the line goes
// through the renderer that keeps a path's separators and marks its own cut.
test('a drain refusal reaches the screen with the server\'s words and the queue path intact', async () => {
    const store = makeStore();
    let refusedSummary = null;
    let queueFile = null;
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        queueFile = db.queuePath();
        db.queueInsert([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);
        refusedSummary = (await publishWith(store, fakeHost({ fail: ['usp_AppendUsage'] }))).summary;
        assert.ok(refusedSummary.failed.some((f) => f.startsWith('the queue (refused): ')),
            JSON.stringify(refusedSummary.failed));
    } finally {
        rmStore(store);
    }

    const home = makeHomeStore();
    try {
        const preload = path.join(home.home, 'stub-publish.js');
        fs.writeFileSync(preload,
            'const client = require(' + JSON.stringify(CLIENT_SOURCE) + ');\n'
            + 'client.isDefaultStoreRoot = () => true;\n'
            + 'client.publish = async () => ({ ok: true, summary: JSON.parse(process.env.KITDB_SUMMARY) });\n',
            'utf8');
        const runWith = (summary) => {
            const env = { ...process.env, HOME: home.home, USERPROFILE: home.home,
                KITDB_SUMMARY: JSON.stringify(summary) };
            delete env.KIT_MEMORY_ROOT;
            delete env.KIT_MEMORY_ROOT_ALLOW_DATA;
            return spawnSync(process.execPath, ['--require', preload, MEMQ, 'db-sync'],
                { cwd: home.proj, encoding: 'utf8', env });
        };

        const res = runWith(refusedSummary);
        assert.strictEqual(res.status, 1, res.stdout + res.stderr);
        assert.ok(res.stderr.includes('the host refused usp_AppendUsage'),
            'the server\'s own words are on the screen: ' + res.stderr);
        // And in front of the boilerplate, which is what makes a cut land on the
        // clause a reader could have written themselves.
        assert.ok(res.stderr.indexOf('the host refused usp_AppendUsage')
            < res.stderr.indexOf('keeps every row'),
            'the server speaks before this client does: ' + res.stderr);
        assert.ok(res.stderr.includes(queueFile),
            'and the queue path is a path, separators and all: ' + res.stderr
            + ' (looking for ' + queueFile + ')');
        assert.ok(!/cut to fit/.test(res.stderr),
            'a whole sentence is not cut: ' + res.stderr);

        // The control, withheld from the assertions above: a reason past the cap
        // is cut AND says so, so a truncated line never reads as a whole one.
        const long = runWith({ ...refusedSummary, failed: ['the queue (refused): ' + 'x'.repeat(4000)] });
        assert.strictEqual(long.status, 1, long.stdout + long.stderr);
        assert.ok(/cut to fit/.test(long.stderr),
            'the cut is marked: ' + long.stderr.slice(-120));
    } finally {
        rmHomeStore(home);
    }
});

// A stand-down's one sentence is the same channel as the failure lines and gets
// the same render at the same cap. A refusal carries the server's own message,
// which is free text of any length, so printed around the renderer it would
// reach the screen uncut and with whatever characters the server put in it.
test('a stand-down sentence reaches the screen through the renderer the failure lines take', () => {
    const home = makeHomeStore();
    try {
        const preload = path.join(home.home, 'stub-standdown.js');
        fs.writeFileSync(preload,
            'const client = require(' + JSON.stringify(CLIENT_SOURCE) + ');\n'
            + 'client.isDefaultStoreRoot = () => true;\n'
            + 'client.publish = async () => ({ ok: false, standDown: \'refused\', '
            + 'detail: process.env.KITDB_DETAIL });\n',
            'utf8');
        const detail = 'Msg 50000: the host said "no" \u0001 and then ' + 'x'.repeat(1400);
        const env = { ...process.env, HOME: home.home, USERPROFILE: home.home, KITDB_DETAIL: detail };
        delete env.KIT_MEMORY_ROOT;
        delete env.KIT_MEMORY_ROOT_ALLOW_DATA;
        const res = spawnSync(process.execPath, ['--require', preload, MEMQ, 'db-sync'],
            { cwd: home.proj, encoding: 'utf8', env });
        assert.strictEqual(res.status, 1, res.stdout + res.stderr);
        assert.strictEqual(res.stderr.trim(), 'memq: ' + db.columnText(detail),
            'the stand-down is the one sentence the host\'s column would carry, rendered the one way: '
            + res.stderr);
        assert.ok(/characters removed/.test(res.stderr) && /cut to fit/.test(res.stderr),
            'and this case must exercise the passes it is pinning: ' + res.stderr);
    } finally {
        rmHomeStore(home);
    }
});

// The publish presents the default store's credential whatever store the walk
// read, and the procedures resolve one sandbox from that login. So a run under
// a redirected root would name every row the redirected walk does not hold as
// removed, and the next ordinary run would name the redirected ones removed in
// turn, leaving the shared index oscillating between two readings of one
// sandbox. The session-start hook refuses a non-default root already; this is
// the same refusal at the verb a worker, a doctor run or a hand can reach.
test('memq db-sync refuses a redirected store root before it reads a config or a record', () => {
    const store = makeStore();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-home-redirect-'));
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        // A config that exists, so the stand-down below cannot be the absent
        // one, and an address nothing listens on in case anything got past.
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', 'kit-memory-db.json'), JSON.stringify({
            server: '127.0.0.1,1', database: 'KitMemoryUnreachable', windowsAuth: true,
            embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
        }) + '\n', 'utf8');

        const res = runMemq(store, ['db-sync'], home);
        assert.strictEqual(res.status, 1, res.stdout + res.stderr);
        assert.strictEqual(res.stdout, '');
        assert.ok(/redirected to/.test(res.stderr) && /nothing was published/.test(res.stderr),
            'the refusal names the redirection: ' + res.stderr);
        assert.ok(!/did not answer/.test(res.stderr),
            'and it happens before anything is asked of the host: ' + res.stderr);

        // The control, withheld from the assertion above: the same config and
        // the same records under the machine's own store get past this gate
        // and fail at the host instead, so the refusal is the redirection
        // rather than a verb that refuses everything.
        const own = makeHomeStore();
        try {
            writeRecord(own.memDir, 'a-record', '# a record\n\na body\n');
            fs.mkdirSync(path.join(own.home, '.claude'), { recursive: true });
            fs.writeFileSync(path.join(own.home, '.claude', 'kit-memory-db.json'), JSON.stringify({
                server: '127.0.0.1,1', database: 'KitMemoryUnreachable', windowsAuth: true,
                embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
            }) + '\n', 'utf8');
            const control = runMemqAtHome(own, ['db-sync']);
            assert.strictEqual(control.status, 1, control.stdout + control.stderr);
            assert.ok(!/redirected to/.test(control.stderr), control.stderr);
            assert.ok(/did not answer/.test(control.stderr),
                'the control must reach the host and fail there: ' + control.stderr);
        } finally {
            rmHomeStore(own);
        }
    } finally {
        rmStore(store);
        try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ }
    }
});

test('memq db-sync takes no arguments', () => {
    const store = makeStore();
    try {
        const res = runMemq(store, ['db-sync', 'now']);
        assert.strictEqual(res.status, 1, res.stdout + res.stderr);
        assert.ok(res.stderr.includes('db-sync takes no arguments'), res.stderr);
    } finally {
        rmStore(store);
    }
});

test('memq db-sync is a verb the CLI dispatches and its usage names it', () => {
    const store = makeStore();
    try {
        const res = runMemq(store, []);
        assert.strictEqual(res.status, 1);
        assert.ok(res.stderr.includes('memq db-sync'), 'the usage text names the verb:\n' + res.stderr);
    } finally {
        rmStore(store);
    }
});

// The store here is the child's own default store, which is the only store a
// stamp is queued under: the queue is drained by a publish that presents this
// machine's credential, so a redirected store would grow one nothing drains.
test('with the host unreachable, memq touch still stamps the sidecar and leaves one queue row', () => {
    const store = makeHomeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        // A config naming an address nothing listens on, under Windows
        // authentication so no password is written anywhere. Its presence is
        // the whole of what this case needs from it: the stamp path makes no
        // database call at all, so the address is never dialled, and the case
        // runs the same on a machine with no SQL client tools installed.
        fs.writeFileSync(path.join(store.root, 'kit-memory-db.json'), JSON.stringify({
            server: '127.0.0.1,1', database: 'KitMemoryUnreachable', windowsAuth: true,
            embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
        }, null, 2) + '\n', 'utf8');

        const res = runMemqAtHome(store, ['touch', 'a-record', '--applied']);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.strictEqual(res.stdout, 'touched a-record applied\n');

        const sidecar = fs.readFileSync(path.join(store.memDir, 'usage.jsonl'), 'utf8').trim().split('\n');
        assert.strictEqual(sidecar.length, 1, 'the local stamp is written whatever the host did');
        assert.strictEqual(JSON.parse(sidecar[0]).kind, 'applied');

        const rows = queueRowsAt(path.join(store.root, 'kit-memory-db-queue.sqlite'));
        assert.strictEqual(rows.length, 1, 'and the stamp the host did not take is on the queue');
        const row = entriesOf(rows)[0];
        assert.strictEqual(rows[0].kind, 'usage',
            'the column says which procedure it is bound for: ' + JSON.stringify(rows[0]));
        assert.strictEqual(row.type, undefined,
            'which is that column rather than a key the procedure does not name: '
            + JSON.stringify(row));
        assert.strictEqual(rows[0].id, row.stampId,
            'the row is keyed by the stamp id the host dedupes on: ' + JSON.stringify(rows[0]));
        assert.strictEqual(row.kind, 'applied',
            'while the stamp\'s own kind is what it attests: ' + JSON.stringify(row));
        assert.strictEqual(row.fileKey, 'a-record.md');
        assert.strictEqual(row.tier, 'project');
        assert.strictEqual(row.segment, store.segment);

        // Then the drain, in process against a host that answers: the row
        // reaches the procedure and comes off the queue. The store root moves to
        // the child's for the length of the drain, since that is where the queue
        // it wrote sits.
        const host = fakeHost();
        const before = { root: process.env.KIT_MEMORY_ROOT, allow: process.env.KIT_MEMORY_ROOT_ALLOW_DATA };
        process.env.KIT_MEMORY_ROOT = store.root;
        process.env.KIT_MEMORY_ROOT_ALLOW_DATA = '1';
        let drained = null;
        try {
            drained = db.drainQueue(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        } finally {
            if (before.root === undefined) delete process.env.KIT_MEMORY_ROOT;
            else process.env.KIT_MEMORY_ROOT = before.root;
            if (before.allow === undefined) delete process.env.KIT_MEMORY_ROOT_ALLOW_DATA;
            else process.env.KIT_MEMORY_ROOT_ALLOW_DATA = before.allow;
        }
        assert.deepStrictEqual(drained, { ok: true, drained: 1, remaining: 0, rejected: 0 });
        assert.strictEqual(host.usage.length, 1);
        assert.strictEqual(host.usage[0].fileKey, 'a-record.md');
    } finally {
        rmHomeStore(store);
    }
});

test('memq log writes the journal line and queues the outcome the host did not take', () => {
    const store = makeHomeStore();
    try {
        fs.writeFileSync(path.join(store.root, 'kit-memory-db.json'), JSON.stringify({
            server: '127.0.0.1,1', database: 'KitMemoryUnreachable', windowsAuth: true,
            embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
        }) + '\n', 'utf8');

        const res = runMemqAtHome(store, ['log', 'an-action', 'pass', 'it worked']);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const journal = fs.readFileSync(path.join(store.memDir, 'outcomes.jsonl'), 'utf8').trim().split('\n');
        assert.strictEqual(journal.length, 1, 'the journal is the record and it is written first');
        const rows = queueRowsAt(path.join(store.root, 'kit-memory-db-queue.sqlite'));
        assert.strictEqual(rows.length, 1);
        const row = entriesOf(rows)[0];
        assert.strictEqual(rows[0].kind, 'outcome',
            'the column routes it to mem.usp_AppendOutcomes: ' + JSON.stringify(rows[0]));
        assert.strictEqual(row.type, undefined, JSON.stringify(row));
        assert.strictEqual(row.actionKey, 'an-action');
        assert.strictEqual(row.result, 'pass');
        assert.strictEqual(row.summary, 'it worked');
        assert.strictEqual(row.segment, store.segment);
    } finally {
        rmHomeStore(store);
    }
});

// THE RECORD ON THIS MACHINE IS THE RECORD, AND A QUEUE THAT REFUSED IS WORTH
// ONE SENTENCE AND NOT AN EXIT CODE. An interactive verb's job is the local
// write: the sidecar and the journal are what `memq find`, the decay pass and
// every reader on this machine read, and they are written before the queue is
// touched at all. So a queue that will not take the row costs the shared index
// one stamp and costs this machine nothing, and the verb that says otherwise by
// exiting non-zero would fail a session's own work over a file it does not need.
// The sentence is the other half: an answer nobody printed is a stamp lost in
// silence, which is the shape a reader only discovers as a hole in the index
// months later.
test('a queue that will not take a writer\'s row costs one sentence and no exit code', () => {
    for (const [verb, args, sidecar, says] of [
        ['touch', ['touch', 'a-record', '--applied'], 'usage.jsonl', 'the applied stamp'],
        ['log', ['log', 'an-action', 'pass', 'it worked'], 'outcomes.jsonl', 'the outcome logged as']
    ]) {
        const store = makeHomeStore();
        try {
            writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
            fs.writeFileSync(path.join(store.root, 'kit-memory-db.json'), JSON.stringify({
                server: '127.0.0.1,1', database: 'KitMemoryUnreachable', windowsAuth: true,
                embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
            }) + '\n', 'utf8');
            // A directory where the queue file goes, which no connection can
            // open. It is the failure at the real boundary rather than a
            // replaced function, and it is what an operator's own stray
            // directory or a half-restored backup leaves at that path.
            fs.mkdirSync(path.join(store.root, 'kit-memory-db-queue.sqlite'), { recursive: true });

            const res = runMemqAtHome(store, args);
            assert.strictEqual(res.status, 0,
                verb + ' is the local write, and a queue that refused never fails it: '
                + res.stdout + res.stderr);
            assert.ok(fs.readFileSync(path.join(store.memDir, sidecar), 'utf8').trim().length > 0,
                'the record on this machine is written: ' + sidecar);

            const said = res.stderr.split('\n').filter((l) => l !== '');
            assert.strictEqual(said.length, 1,
                'one sentence and no more: ' + JSON.stringify(said));
            assert.ok(said[0].startsWith('memq: '), said[0]);
            assert.ok(said[0].includes(says),
                'which names what the index will not get: ' + said[0]);
            assert.ok(said[0].includes('The record on this machine is written and unaffected'),
                'and what it did not cost: ' + said[0]);

            // The control, withheld from the assertions above: the same verb
            // with the path free says nothing at all and writes the row, so the
            // sentence is the refusal rather than one this verb always prints.
            fs.rmSync(path.join(store.root, 'kit-memory-db-queue.sqlite'), { recursive: true, force: true });
            const clean = runMemqAtHome(store, args);
            assert.strictEqual(clean.status, 0, clean.stdout + clean.stderr);
            assert.strictEqual(clean.stderr, '', 'a queue that took the row says nothing: ' + clean.stderr);
            assert.strictEqual(
                queueRowsAt(path.join(store.root, 'kit-memory-db-queue.sqlite')).length, 1,
                'and the row really is on it');
        } finally {
            rmHomeStore(store);
        }
    }
});

// ---------------------------------------------------------------- the queries --

// A host that answers the two query procedures out of a list it was handed.
//
// It parses the batch the client actually composed rather than being told what
// was asked, because the whole point of these cases is what crosses the
// boundary: which parameters the EXEC line names, what the vector declaration
// says, and that no caller's text ever reaches the batch as anything but a JSON
// payload.
function fakeQueryHost(options) {
    const opts = options || {};
    const host = { calls: [], embedCalls: [] };
    host.runBatch = (cfg, batch, callOptions) => {
        const exec = /EXEC mem\.(\w+) ?(.*)$/m.exec(batch);
        assert.ok(exec, 'the batch calls a procedure: ' + batch);
        const procedure = exec[1];
        host.calls.push({
            procedure,
            arguments: exec[2],
            batch,
            payload: batch.includes(';SET @Query = ') ? payloadOf(batch, '@Query') : null,
            budgetMs: callOptions.budgetMs
        });
        if (procedure === 'usp_Health') {
            // The version the probe reports, which the search path gates on. It
            // defaults to the version whose rows carry a distance, since that
            // is the host every query case but the gate's own is about.
            return opts.unreachable
                ? { ok: false, cause: 'outage', detail: 'the host did not answer' }
                : {
                    ok: true,
                    rows: [{
                        schemaVersion: opts.schemaVersion === undefined
                            ? db.SEARCH_SCHEMA_VERSION : opts.schemaVersion
                    }]
                };
        }
        if (opts.refuses) return { ok: false, cause: 'refused', detail: 'Msg 50000: no' };
        return { ok: true, rows: [opts.rows === undefined ? [] : opts.rows] };
    };
    host.embedBatch = async (cfg, texts) => {
        host.embedCalls.push(texts);
        if (opts.embedFails) return { ok: false, detail: 'the embedding server did not answer' };
        const width = opts.dimensions === undefined ? 1024 : opts.dimensions;
        return { ok: true, vectors: texts.map(() => new Array(width).fill(0.5)) };
    };
    return host;
}

test('a search sends the host both the query text and a vector of the host model own width', async () => {
    const host = fakeQueryHost({
        rows: [{
            name: 'shared-lesson', fileKey: 'shared-lesson.md', tier: 'operator', segment: null,
            sandbox: 'NEO-CLAUDE', visibility: 'shared', description: 'a lesson another box wrote',
            archived: false, distance: 0.2, score: 0.0333, fusedScore: 0.0313,
            appliedBoost: 0.002, descriptionRank: 1, bodyRank: 2, vectorLiveRank: 1,
            vectorArchivedRank: null
        }]
    });
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['what did the other box learn'],
        limit: 10,
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));

    const probe = host.calls.filter((c) => c.procedure === 'usp_Health');
    assert.strictEqual(probe.length, 1, 'the reachability probe is spent once');
    assert.strictEqual(probe[0].budgetMs, db.PROBE_TIMEOUT_MS,
        'at this client own probe budget and not an interactive channel one');

    const search = host.calls.filter((c) => c.procedure === 'usp_Search');
    assert.strictEqual(search.length, 1);
    // BOTH parameters. mem.usp_Search fuses four ranked lists and the two
    // lexical ones run only where a query text arrives, so a call carrying the
    // vector alone silently halves the ranking and still answers.
    assert.match(search[0].arguments, /@p_QueryText = @QueryText/);
    assert.match(search[0].arguments, /@p_QueryVector = @QueryVector/);
    assert.match(search[0].arguments, /@p_ModelIdentity = @Model/);
    assert.match(search[0].batch, /DECLARE @QueryVector VECTOR\(1024\) = CAST\(JSON_QUERY/,
        'the vector is declared at the width the database column holds');
    assert.strictEqual(search[0].payload.vector.length, 1024);
    assert.strictEqual(search[0].payload.text, 'what did the other box learn');

    assert.deepStrictEqual(host.embedCalls, [['what did the other box learn']],
        'the query text is embedded on the host, which is what makes the vector comparable');

    assert.strictEqual(answered.lists.length, 1);
    const hit = answered.lists[0][0];
    assert.strictEqual(hit.name, 'shared-lesson');
    assert.strictEqual(hit.tier, 'operator');
    assert.strictEqual(hit.sandbox, 'NEO-CLAUDE');
    assert.strictEqual(hit.archived, false);
    // The similarity, from the distance the procedure returns rather than from
    // the fused score beside it: a sum over four ranked lists is on no scale the
    // local ranker's floors are written in, and the two paths agree only on this
    // one.
    assert.strictEqual(hit.score, 0.8);
    assert.ok(!('fusedScore' in hit), 'the fused score is not carried at all: ' + JSON.stringify(hit));
});

test('mem.usp_Search carries its candidate lists\' own distance out rather than computing a second one', () => {
    // The client reads a distance off every hybrid row, so this pin is on the
    // side that has to produce one. What it refuses is the shape that would
    // answer the same JSON with a different number: a second VECTOR_DISTANCE
    // call over the winners, which would rank on one quantity and report
    // another, and which no assertion about the client's arithmetic can see.
    const sql = fs.readFileSync(path.join(PROCEDURES_DIR, '100-usp_Search.sql'), 'utf8');
    // Scoped to what runs after the winners are chosen rather than counted over
    // the whole file: the banner names the function in prose, so a count would
    // turn a note into a red, and what this pin is about is a second
    // computation over the returned rows rather than a number of sites.
    const fused = sql.indexOf('INSERT INTO #Winners');
    assert.ok(fused !== -1, 'the fusion insert is where the candidate lists end');
    assert.ok(!/VECTOR_DISTANCE\s*\(/i.test(sql.slice(fused)),
        'no distance is computed after the candidate lists, so the returned one is theirs: '
            + sql.slice(fused, fused + 300));
    // And each vector list carries its own out, which is what leaves the value
    // for the fusion to fold.
    //
    // Read off the inserts' own column lists rather than by counting assignment
    // sites. A count over `[Distance] = <alias>.[Distance]` is a mirror of the
    // SQL body: it matched a single-letter alias, so renaming a CTE alias to two
    // letters reddened it with no defect in the procedure. What is actually
    // contractual is which lists declare the column, since that is what decides
    // whether the value survives the fusion. The two vector lists declare it and
    // the two lexical ones do not, which is also what makes the column nullable
    // below.
    const inserts = sql.match(/INSERT INTO #Contributions \([^)]*\)/g) || [];
    assert.ok(inserts.length >= 2, 'the contribution inserts are found: ' + inserts.length);
    const carrying = inserts.filter((i) => i.includes('[Distance]'));
    assert.strictEqual(carrying.length, 2,
        'exactly the two vector lists declare the distance on their insert: ' + inserts.join(' | '));
    // The column exists on the working table the two lists write, which is what
    // makes the value survive the fusion, and it reaches the answer. The table's
    // own declaration is cut out first: a pattern reading to the next
    // [Distance] anywhere in the file finds the one inside a candidate list and
    // says nothing about the table at all.
    const table = /CREATE TABLE #Contributions \(([\s\S]*?)\r?\n\t\)/.exec(sql);
    assert.ok(table !== null, 'the contributions table is declared: ' + sql.slice(0, 200));
    // Nullable, because the two lexical lists vote without one. A NOT NULL
    // column here would refuse the insert a lexical-only record's list makes.
    assert.match(table[1], /\[Distance\]\s+FLOAT\s+NULL/,
        'the contributions table holds the distance its vector lists carried: ' + table[1]);
    // And the answer names it, off the fused row rather than off a fresh
    // computation. That is the whole contract: the number the client reads is
    // the one the candidate lists ranked on.
    assert.match(sql, /\[distance\]\s*=\s*LE\.\[Distance\]/,
        'the returned JSON names the distance the fused lists carried');
});

test('a hybrid row the lexical lists alone found survives with no similarity of its own', async () => {
    // The row mem.usp_Search returns for a record its full-text lists matched
    // and neither vector list ranked: every field but the distance. Dropping it
    // for want of a number is the silent defect here, since the record does
    // hold the query's words and the block would go short with nothing said.
    const host = fakeQueryHost({
        rows: [
            {
                name: 'lexical-only', fileKey: 'lexical-only.md', tier: 'operator', segment: null,
                sandbox: 'NEO-CLAUDE', visibility: 'shared', description: 'a record holding the word',
                archived: false, distance: null, score: 0.0164, fusedScore: 0.0164,
                appliedBoost: 0, descriptionRank: 1, bodyRank: null, vectorLiveRank: null,
                vectorArchivedRank: null
            },
            {
                name: 'ranked-by-both', fileKey: 'ranked-by-both.md', tier: 'operator', segment: null,
                sandbox: 'NEO-CLAUDE', visibility: 'shared', description: 'a record both lists hold',
                archived: false, distance: 0.25, score: 0.0325, fusedScore: 0.0325,
                appliedBoost: 0, descriptionRank: 2, bodyRank: 1, vectorLiveRank: 1,
                vectorArchivedRank: null
            }
        ]
    });
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['the word'],
        limit: 10,
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    assert.deepStrictEqual(answered.lists[0].map((h) => h.name),
        ['lexical-only', 'ranked-by-both'], 'both rows survive: ' + JSON.stringify(answered.lists[0]));
    assert.strictEqual(answered.lists[0][0].score, null,
        'and the one with no vector vote carries no number rather than a made-up one');
    assert.strictEqual(answered.lists[0][1].score, 0.75);
});

test('a nearest call sends the vector alone and reads its distance back as a similarity', async () => {
    const host = fakeQueryHost({
        rows: [{
            name: 'near-record', fileKey: 'near-record.md', tier: 'project', segment: 'D--proj',
            sandbox: 'SCOTT-CLAUDE', visibility: 'private', description: 'a near record',
            distance: 0.25, chunkIndex: 0
        }]
    });
    const answered = await db.queryHost({
        mode: 'nearest',
        texts: ['a record as its author has stated it'],
        limit: 3,
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    const call = host.calls.filter((c) => c.procedure === 'usp_Nearest')[0];
    assert.match(call.arguments, /@p_Vector = @QueryVector/);
    assert.ok(!/@p_QueryText/.test(call.arguments),
        'the nearest scan takes no text: ' + call.arguments);
    // The scale the caller ranks on. NEIGHBOUR_FLOOR is a cosine similarity, so
    // a distance handed on as it stands would read as its own opposite.
    assert.strictEqual(answered.lists[0][0].score, 0.75);
});

test('a host below the search schema version serves no search, and its nearest scan still answers', async () => {
    // The version is negotiated rather than inferred from the answer, and not
    // because the answer is ambiguous. It is not: a version 3 host emits an
    // explicit null distance where a version 2 host emits no key at all. What
    // inferring would cost is the order of operations, since it decides per row
    // only after the query's text has been embedded and sent. The gate decides
    // once, on the probe, ahead of that call. An older host answers this search
    // with no distance on any row, so a client reading the field would print
    // that whole ranking as the shared index's, unfloored.
    const old = fakeQueryHost({ schemaVersion: db.SEARCH_SCHEMA_VERSION - 1 });
    const refused = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        deps: { runBatch: old.runBatch, embedBatch: old.embedBatch }
    });
    assert.strictEqual(refused.ok, false);
    assert.strictEqual(refused.standDown, 'schema');
    assert.deepStrictEqual(old.calls.map((c) => c.procedure), ['usp_Health'],
        'the gate stands ahead of the embedding call, so no search reaches the host');
    assert.deepStrictEqual(old.embedCalls, [],
        'and nothing this machine holds reaches the embedding server either');
    // The sentence names the versions and the remedy, since waiting resolves
    // nothing here: the host is up and answering.
    const said = db.standDownText(refused);
    assert.match(said, new RegExp('version ' + db.SEARCH_SCHEMA_VERSION));
    assert.match(said, /Install-MemoryDatabase\.ps1/);

    // The other direction, withheld from the assertions above: the same old
    // host serves the nearest scan, which has returned its distance since the
    // first version and needs no gate at all.
    const nearest = fakeQueryHost({
        schemaVersion: db.SEARCH_SCHEMA_VERSION - 1,
        rows: [{ name: 'a-neighbour', tier: 'operator', distance: 0.25 }]
    });
    const answered = await db.queryHost({
        mode: 'nearest',
        texts: ['a record as its author has stated it'],
        limit: 3,
        config: config(),
        deps: { runBatch: nearest.runBatch, embedBatch: nearest.embedBatch }
    });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    assert.deepStrictEqual(nearest.calls.map((c) => c.procedure), ['usp_Health', 'usp_Nearest']);
    assert.strictEqual(answered.lists[0][0].score, 0.75);
});

test('a host below the scoped search version serves no scoped search, and an unscoped one still answers', async () => {
    // A version 5 host has mem.usp_Search without @p_Segment and @p_Tag. An
    // unscoped answer handed back to a caller that asked for one project's
    // records would be the whole fleet's under that caller's question, so a
    // scoped search stands down by name before anything is embedded.
    const below = db.SCOPED_SEARCH_SCHEMA_VERSION - 1;
    for (const scope of [{ segment: 'D--proj' }, { tag: 'sql' }, { segment: 'D--proj', tag: 'sql' }]) {
        const old = fakeQueryHost({ schemaVersion: below });
        const refused = await db.queryHost(Object.assign({
            mode: 'search',
            texts: ['a query'],
            limit: 10,
            config: config(),
            deps: { runBatch: old.runBatch, embedBatch: old.embedBatch }
        }, scope));
        assert.strictEqual(refused.ok, false, JSON.stringify(scope));
        assert.strictEqual(refused.standDown, 'schema', JSON.stringify(scope));
        assert.deepStrictEqual(old.calls.map((c) => c.procedure), ['usp_Health'],
            'the gate stands ahead of the embedding call: ' + JSON.stringify(scope));
        assert.deepStrictEqual(old.embedCalls, []);
        const said = db.standDownText(refused);
        assert.match(said, new RegExp('reports schema version ' + below + ' where'));
        assert.match(said, new RegExp('needs version ' + db.SCOPED_SEARCH_SCHEMA_VERSION));
        assert.match(said, /Install-MemoryDatabase\.ps1/);
    }

    // The control, withheld from the loop above: the same version 5 host
    // serves the search that asks for neither, with neither parameter named.
    const unscoped = fakeQueryHost({ schemaVersion: below, rows: [{ name: 'a-record', tier: 'operator', distance: 0.2 }] });
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        segment: '',
        tag: '',
        deps: { runBatch: unscoped.runBatch, embedBatch: unscoped.embedBatch }
    });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    const search = unscoped.calls.filter((c) => c.procedure === 'usp_Search');
    assert.strictEqual(search.length, 1);
    assert.ok(!/@p_Segment|@p_Tag/.test(search[0].arguments), search[0].arguments);

    // And a version 6 host is sent the scope it was asked for.
    const current = fakeQueryHost({ schemaVersion: db.SCOPED_SEARCH_SCHEMA_VERSION });
    const scoped = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        segment: 'D--proj',
        tag: 'sql',
        deps: { runBatch: current.runBatch, embedBatch: current.embedBatch }
    });
    assert.strictEqual(scoped.ok, true, JSON.stringify(scoped));
    const sent = current.calls.filter((c) => c.procedure === 'usp_Search')[0];
    assert.match(sent.arguments, /@p_Segment = @Segment, @p_Tag = @Tag$/);
    assert.strictEqual(sent.payload.segment, 'D--proj');
    assert.strictEqual(sent.payload.tag, 'sql');

    // The nearest scan takes no scope, so a scope handed to one neither gates
    // it nor reaches its batch.
    const nearest = fakeQueryHost({ schemaVersion: below, rows: [{ name: 'n', tier: 'operator', distance: 0.25 }] });
    const near = await db.queryHost({
        mode: 'nearest',
        texts: ['a record'],
        limit: 3,
        config: config(),
        segment: 'D--proj',
        tag: 'sql',
        deps: { runBatch: nearest.runBatch, embedBatch: nearest.embedBatch }
    });
    assert.strictEqual(near.ok, true, JSON.stringify(near));
    const nearCall = nearest.calls.filter((c) => c.procedure === 'usp_Nearest')[0];
    assert.ok(!/@p_Segment|@p_Tag/.test(nearCall.arguments), nearCall.arguments);
});

test('a segment or tag wider than the procedure declares is refused before the probe, and nothing is sent', async () => {
    // The batch declares each at the procedure's own width, so a longer value
    // would be cut there and then match a different segment or tag.
    const cases = [
        { segment: 'x'.repeat(db.SEARCH_SEGMENT_CAP + 1), cap: db.SEARCH_SEGMENT_CAP, what: 'segment' },
        { tag: 't'.repeat(db.SEARCH_TAG_CAP + 1), cap: db.SEARCH_TAG_CAP, what: 'tag' }
    ];
    for (const c of cases) {
        const host = fakeQueryHost({ schemaVersion: db.SCOPED_SEARCH_SCHEMA_VERSION });
        const refused = await db.queryHost({
            mode: 'search',
            texts: ['a query'],
            limit: 10,
            config: config(),
            segment: c.segment,
            tag: c.tag,
            deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
        });
        assert.strictEqual(refused.ok, false, c.what);
        assert.strictEqual(refused.standDown, 'refused', c.what);
        assert.deepStrictEqual(host.calls, [], 'not even the probe: ' + c.what);
        assert.deepStrictEqual(host.embedCalls, [], c.what);
        const said = db.standDownText(refused);
        assert.match(said, new RegExp('search ' + c.what + ' runs to ' + (c.cap + 1)
            + ' characters where the shared search reads at most ' + c.cap));
    }
    // The control: a value at the cap is sent.
    const host = fakeQueryHost({ schemaVersion: db.SCOPED_SEARCH_SCHEMA_VERSION });
    const atCap = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        segment: 'x'.repeat(db.SEARCH_SEGMENT_CAP),
        tag: 't'.repeat(db.SEARCH_TAG_CAP),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(atCap.ok, true, JSON.stringify(atCap));
    assert.strictEqual(host.calls.filter((c) => c.procedure === 'usp_Search')[0].payload.segment.length,
        db.SEARCH_SEGMENT_CAP);
});

test('a distance outside the interval a cosine occupies is a malformed row, not a similarity', async () => {
    // Every other field crossing this boundary is held to its type and its
    // length. A cosine distance lies in [0, 2], so a value outside it is not
    // the quantity the field names: a similarity derived from one clears every
    // floor on this path and prints as a number a reader takes for a cosine.
    for (const outside of [-0.5, 2.5]) {
        assert.strictEqual(
            db.queryHit({ name: 'x', tier: 'operator', distance: outside }, 'usp_Search'), null,
            'a distance of ' + outside + ' is not a distance');
        assert.strictEqual(
            db.queryHit({ name: 'x', tier: 'operator', distance: outside }, 'usp_Nearest'), null,
            'on either path: ' + outside);
    }
    // The controls, withheld from the loop's own literals: both ends of the
    // interval are distances and both survive, so the drops above are the range
    // rather than a guard that refuses everything.
    assert.strictEqual(db.queryHit({ name: 'x', tier: 'operator', distance: 0 }, 'usp_Search').score, 1);
    assert.strictEqual(db.queryHit({ name: 'x', tier: 'operator', distance: 2 }, 'usp_Search').score, -1);
});

test('a vector of any width but the database own is never sent', async () => {
    // The local index model is Xenova/all-MiniLM-L6-v2 at 384 dimensions and
    // the host one is BAAI/bge-m3 at 1024. A local vector on this path ranks
    // against the wrong space, so the screen is on the width and the evidence is
    // that no procedure call is made at all.
    const host = fakeQueryHost({ dimensions: 384 });
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.ok, false);
    assert.strictEqual(answered.standDown, 'refused');
    assert.match(answered.detail, /384 dimensions/);
    assert.match(answered.detail, /1024/);
    assert.deepStrictEqual(host.calls.map((c) => c.procedure), ['usp_Health'],
        'the probe and nothing else: no vector reached a procedure call');

    // The control, withheld from the screen own literals: the same fake at the
    // host model width does reach usp_Search, so the silence above is the
    // screen rather than a fake that never calls anything.
    const wide = fakeQueryHost({});
    const served = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        deps: { runBatch: wide.runBatch, embedBatch: wide.embedBatch }
    });
    assert.strictEqual(served.ok, true);
    assert.deepStrictEqual(wide.calls.map((c) => c.procedure), ['usp_Health', 'usp_Search']);
});

test('an unreachable host stands the query down before it embeds anything', async () => {
    const host = fakeQueryHost({ unreachable: true });
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.ok, false);
    assert.strictEqual(answered.standDown, 'unreachable');
    assert.deepStrictEqual(host.embedCalls, [],
        'nothing is embedded for a host that is not there');
    assert.match(db.standDownText(answered), /did not answer/);
});

test('an embedding server that will not answer stands the query down as an outage', async () => {
    const host = fakeQueryHost({ embedFails: true });
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.standDown, 'unreachable');
    assert.match(answered.detail, /the embedding server did not answer/);
    assert.deepStrictEqual(host.calls.map((c) => c.procedure), ['usp_Health']);
});

test('a query the host refuses is a refusal rather than an outage, carrying the server own words', async () => {
    const host = fakeQueryHost({ refuses: true });
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.standDown, 'refused');
    assert.match(db.standDownText(answered), /Msg 50000/);
});

test('a query whose budget is gone before a call makes none of it', async () => {
    const host = fakeQueryHost({});
    let clock = 0;
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        budgetMs: 2000,
        // The probe spends the whole budget, so the embedding call is refused
        // rather than clamped to nothing: the deadline decides whether a call
        // starts and each call own clock decides how long it runs.
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch, now: () => (clock += 3000) }
    });
    assert.strictEqual(answered.ok, false);
    assert.strictEqual(answered.standDown, 'budget');
    assert.match(answered.detail, /2000 ms/);
    assert.deepStrictEqual(host.embedCalls, []);
});

test('a query whose caller has walked away makes no boundary call after the abort', async () => {
    // The control first, withheld from the assertion below: the same query with
    // a signal nobody aborted makes every call, so the silence in the aborted
    // leg is the signal being read rather than a fake that never answers.
    const live = fakeQueryHost({});
    const running = new AbortController();
    const served = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        signal: running.signal,
        deps: { runBatch: live.runBatch, embedBatch: live.embedBatch }
    });
    assert.strictEqual(served.ok, true, JSON.stringify(served));
    assert.deepStrictEqual(live.calls.map((c) => c.procedure), ['usp_Health', 'usp_Search']);

    // The abandoned query: a caller under a clock of its own has already
    // printed its expiry line, so the spawn and the HTTP request behind this
    // answer are never made.
    const host = fakeQueryHost({});
    const gone = new AbortController();
    gone.abort();
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        signal: gone.signal,
        deps: { runBatch: host.runBatch, embedBatch: host.embedBatch }
    });
    assert.strictEqual(answered.ok, false);
    assert.strictEqual(answered.standDown, 'cancelled');
    assert.deepStrictEqual(host.calls, [], 'not even the reachability probe');
    assert.deepStrictEqual(host.embedCalls, [], 'and nothing reaches the embedding server');
    // The reason reads as work dropped rather than as a host to wait for, which
    // is what keeps a reader off a network nothing is wrong with.
    assert.match(db.standDownText(answered), /abandoned before it answered/);

    // An abort that lands after the probe still stops the calls behind it: the
    // deadline and this signal are read at the same three points.
    const midway = fakeQueryHost({});
    const during = new AbortController();
    const probing = midway.runBatch;
    midway.runBatch = (cfg, batch, callOptions) => {
        const out = probing(cfg, batch, callOptions);
        during.abort();
        return out;
    };
    const stopped = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        config: config(),
        signal: during.signal,
        deps: { runBatch: midway.runBatch, embedBatch: midway.embedBatch }
    });
    assert.strictEqual(stopped.standDown, 'cancelled');
    assert.deepStrictEqual(midway.calls.map((c) => c.procedure), ['usp_Health'],
        'the probe had already run; no procedure call follows the abort');
    assert.deepStrictEqual(midway.embedCalls, []);
});

test('no config is a stand-down with the path and no boundary call at all', async () => {
    const answered = await db.queryHost({
        mode: 'search',
        texts: ['a query'],
        limit: 10,
        configPath: path.join(os.tmpdir(), 'kitdb-no-such-config-' + process.pid + '.json')
    });
    assert.strictEqual(answered.ok, false);
    assert.strictEqual(answered.standDown, 'absent');
    assert.match(db.standDownText(answered), /no memory database is configured/);
});

test('a caller own text and limit never reach the batch as anything but a payload and a digit string', () => {
    // Three hazards in one query: a line reading GO, a sqlcmd variable
    // reference, and a quote that would close a literal.
    const hostile = 'first\nGO\n$(SQLCMDINI) it\'s — quoted "so"';
    const batch = db.queryBatch('usp_Search', [0.5, 0.25], hostile, 10, 'test-model');
    for (const line of batch.split('\n')) {
        assert.notStrictEqual(line.trim(), 'GO', 'no line of the batch is a batch separator');
    }
    assert.ok(!/[^\x00-\x7E]/.test(batch), 'the batch is pure ASCII, so the tool decodes nothing');
    // The variable reference never reaches the batch: the payload escape
    // takes the dollar sign with the non-ASCII characters, so there is no $(
    // for sqlcmd to substitute even on a spawn without -x. The spawn's own -x
    // is the second belt, read from the client's source here, so dropping
    // either one alone leaves the hazard covered by the other.
    assert.ok(!batch.includes('$('), 'no variable reference is in the batch');
    assert.match(fs.readFileSync(CLIENT_SOURCE, 'utf8'), /'-b', '-I', '-N', '-x'/,
        'and every spawn refuses to substitute a variable reference');
    const payload = payloadOf(batch, '@Query');
    assert.strictEqual(payload.text, hostile, 'and the server still receives the text as written');

    // The limit is the client own digit string, clamped to what the procedures
    // serve, so a caller number is never concatenated as it stands.
    assert.match(db.queryBatch('usp_Search', [1], 'q', 9999, 'test-model'),
        new RegExp(';DECLARE @Limit INT = ' + db.QUERY_LIMIT_MAX + '$', 'm'));
    assert.match(db.queryBatch('usp_Search', [1], 'q', -4, 'test-model'),
        /;DECLARE @Limit INT = 1$/m);
});

// The search batch as the client composed it before a search could be scoped,
// written out whole. A host at version 3, 4 or 5 has no @p_Segment or @p_Tag and
// refuses a batch naming either, so a call asking for neither must still be
// this batch byte for byte: any drift in it is a stand-down on every such host
// for a caller that never asked for a scope.
const UNSCOPED_SEARCH_BATCH = [
    ';SET NOCOUNT ON',
    ';DECLARE @Query NVARCHAR(MAX) = N\'\'',
    ';SET @Query = @Query + N\'{"vector":[0.5,0.25],"text":"what it\'\'s \\u2014 about"}\'',
    ';DECLARE @QueryVector VECTOR(1024) = CAST(JSON_QUERY(@Query, \'$.vector\') AS VECTOR(1024))',
    ';DECLARE @QueryText NVARCHAR(4000) = JSON_VALUE(@Query, \'$.text\')',
    ';DECLARE @Limit INT = 7',
    ';DECLARE @Model NVARCHAR(200) = N\'test-model\'',
    ';DECLARE @Answer TABLE ( [Json] NVARCHAR(MAX) NULL )',
    ';INSERT INTO @Answer ( [Json] ) EXEC mem.usp_Search @p_QueryText = @QueryText,'
        + ' @p_QueryVector = @QueryVector, @p_Limit = @Limit, @p_ModelIdentity = @Model',
    ';SELECT \'kitdb-json=\' + COALESCE([Json], \'null\') FROM @Answer'
].join('\n');

test('a search names @p_Segment and @p_Tag only where it asks for them, and asking for neither is today\'s batch', () => {
    const text = 'what it\'s — about';
    // Neither asked, in every spelling a caller can leave one out with: no
    // scope at all, empty strings, and values that are not strings.
    for (const scope of [undefined, {}, { segment: '', tag: '' }, { segment: null, tag: 7 }]) {
        assert.strictEqual(db.queryBatch('usp_Search', [0.5, 0.25], text, 7, 'test-model', false, scope),
            UNSCOPED_SEARCH_BATCH, 'unscoped with ' + JSON.stringify(scope));
    }

    // A segment alone: carried in the payload, declared at the procedure's own
    // width and named, and no tag anywhere. The segment holds a quote, a
    // variable reference and a non-ASCII character, the three hazards the
    // payload answers, so it reaches the server as written and the batch
    // stays pure ASCII with nothing for sqlcmd to substitute.
    const segment = 'D--proj-été-it\'s-$(HOME)';
    const segmented = db.queryBatch('usp_Search', [1], 'q', 5, 'test-model', false, { segment });
    assert.match(segmented, /EXEC mem\.usp_Search .*, @p_Segment = @Segment$/m);
    assert.match(segmented, /^;DECLARE @Segment NVARCHAR\(400\) = JSON_VALUE\(@Query, '\$\.segment'\)$/m);
    assert.ok(!/@p_Tag|@Tag\b/.test(segmented), 'a segment alone names no tag: ' + segmented);
    assert.strictEqual(payloadOf(segmented, '@Query').segment, segment);
    assert.ok(!('tag' in payloadOf(segmented, '@Query')), 'and the payload carries none');
    assert.ok(!/[^\x00-\x7E]/.test(segmented) && !segmented.includes('$('),
        'the segment reaches the batch only through the escaped payload');

    // A tag alone, the same way round.
    const tagged = db.queryBatch('usp_Search', [1], 'q', 5, 'test-model', false, { tag: 'sql' });
    assert.match(tagged, /EXEC mem\.usp_Search .*, @p_Tag = @Tag$/m);
    assert.match(tagged, /^;DECLARE @Tag NVARCHAR\(200\) = JSON_VALUE\(@Query, '\$\.tag'\)$/m);
    assert.ok(!/@p_Segment|@Segment\b/.test(tagged), 'a tag alone names no segment: ' + tagged);
    assert.strictEqual(payloadOf(tagged, '@Query').tag, 'sql');

    // Both, each named once.
    const both = db.queryBatch('usp_Search', [1], 'q', 5, 'test-model', false, { segment: 'D--proj', tag: 'sql' });
    assert.match(both, /, @p_Segment = @Segment, @p_Tag = @Tag$/m);

    // The nearest scan takes neither, whatever it is handed.
    const nearest = db.queryBatch('usp_Nearest', [1], 'q', 5, 'test-model', false, { segment: 'D--proj', tag: 'sql' });
    assert.ok(!/segment|@Tag\b|@p_Tag/i.test(nearest), 'the nearest scan names no scope: ' + nearest);
});

test('a query text past what the procedure reads is cut before it is sent', () => {
    const batch = db.queryBatch('usp_Search', [1], 'x'.repeat(db.QUERY_TEXT_CAP + 500),
        10, 'test-model');
    const payload = payloadOf(batch, '@Query');
    // JSON_VALUE hands back at most this many characters, and a longer one
    // arrives as a null query text, which disables the two lexical lists with
    // nothing on any surface to say so.
    assert.strictEqual(payload.text.length, db.QUERY_TEXT_CAP);
});

test('a query text cut inside a surrogate pair drops the half character rather than sending it', () => {
    // The emoji's two code units straddle the cap, so a plain slice ends on its
    // high surrogate, which a strict JSON or UTF-8 reader refuses.
    const text = 'x'.repeat(db.QUERY_TEXT_CAP - 1) + '\u{1F600}' + 'tail';
    const head = db.queryHead(text);
    assert.strictEqual(head, 'x'.repeat(db.QUERY_TEXT_CAP - 1));
    const batch = db.queryBatch('usp_Search', [1], text, 10, 'test-model');
    assert.strictEqual(payloadOf(batch, '@Query').text, head, 'the batch sends the same head');
    // The control: a pair that ends inside the cap is kept whole.
    const whole = 'x'.repeat(db.QUERY_TEXT_CAP - 2) + '\u{1F600}' + 'tail';
    assert.ok(db.queryHead(whole).endsWith('\u{1F600}'), 'a pair inside the cap rides whole');
});

test('a row missing what it must have is dropped rather than rendered', () => {
    assert.strictEqual(db.queryHit({ tier: 'operator', distance: 0.1 }, 'usp_Search'), null);
    assert.strictEqual(db.queryHit({ name: 'x', distance: 0.1 }, 'usp_Search'), null);
    assert.strictEqual(db.queryHit(null, 'usp_Search'), null);
    // The two readings of an absent distance, which is what tells a malformed
    // row from a whole one under the shape both procedures now answer in. The
    // nearest scan ranks on the distance alone, so a row without one is a row
    // this client cannot place. The hybrid search ranks on four lists, two of
    // which need no vector at all, so the same absence there is an answer.
    assert.strictEqual(db.queryHit({ name: 'x', tier: 'operator' }, 'usp_Nearest'), null);
    assert.strictEqual(db.queryHit({ name: 'x', tier: 'operator' }, 'usp_Search').score, null);
    // A distance that is not a number is malformed on either path: the field
    // arrived, and what arrived is not the quantity it names.
    for (const procedure of ['usp_Search', 'usp_Nearest']) {
        assert.strictEqual(
            db.queryHit({ name: 'x', tier: 'operator', distance: '0.2' }, procedure), null,
            'a distance as text is malformed under ' + procedure);
    }
    // A row that is whole survives, with the fields that may be null read as
    // the empty string rather than as the word null on a line.
    const hit = db.queryHit({
        name: 'x', tier: 'operator', segment: null, sandbox: null,
        description: null, distance: 0.9, descriptionRank: 2, bodyRank: null
    }, 'usp_Search');
    assert.strictEqual(hit.segment, '');
    assert.strictEqual(hit.sandbox, '');
    assert.strictEqual(hit.description, '');
    // The two lexical ranks ride on, because they are how a reader of this hit
    // tells a row a full-text list ranked from one only the vector lists did,
    // which is the difference a similarity floor may act on.
    assert.strictEqual(hit.descriptionRank, 2);
    assert.strictEqual(hit.bodyRank, null);
    // A rank that is not a rank reads as no vote, which is the safe direction:
    // the floor then applies to a row this side could not prove a lexical vote
    // for, rather than being waved off by a value it could not read.
    const unreadable = db.queryHit({
        name: 'x', tier: 'operator', distance: 0.9, descriptionRank: 'first', bodyRank: 0
    }, 'usp_Search');
    assert.strictEqual(unreadable.descriptionRank, null);
    assert.strictEqual(unreadable.bodyRank, null);
});

// ------------------------------------------------------------- the curator --

// The two curator verbs and the client path under them. No case here reaches
// a host: the sqlcmd spawn is replaced through deps.runBatch, and the fixture
// config carries a curator pair under a made-up login whose password slot
// holds a placeholder word, since a Windows-authenticated fixture has no
// password at all and the curator is a SQL login by construction.

function curatorFixture(extra) {
    return config({ curator: { login: 'kit_curator_test', password: 'fixture-not-a-secret' }, ...(extra || {}) });
}

// A host that answers a curator call out of a canned table, recording each
// call's procedure, parameters and the config it was made under.
function fakeCuratorHost(answers) {
    const host = { calls: [] };
    host.runBatch = (cfg, batch, callOptions) => {
        const call = parseCall(batch);
        host.calls.push({ ...call, login: cfg.login, windowsAuth: cfg.windowsAuth, budgetMs: callOptions.budgetMs });
        const answer = answers[call.procedure];
        if (answer === undefined) return { ok: false, cause: 'refused', detail: 'no such procedure in the fixture' };
        if (typeof answer === 'function') return answer(call);
        return { ok: true, rows: [answer] };
    };
    return host;
}

function capturedStreams(work) {
    const out = [];
    const err = [];
    const realOut = process.stdout.write;
    const realErr = process.stderr.write;
    const restore = () => { process.stdout.write = realOut; process.stderr.write = realErr; };
    process.stdout.write = (chunk) => { out.push(String(chunk)); return true; };
    process.stderr.write = (chunk) => { err.push(String(chunk)); return true; };
    return Promise.resolve()
        .then(work)
        .then((value) => ({ value, out: out.join(''), err: err.join('') }),
            (e) => { restore(); throw e; })
        .then((r) => { restore(); return r; });
}

// What the host answers a publisher login with: the role's DENY EXECUTE
// (010-Roles.sql) refuses the call before the procedure's own mem_curator
// check can run, so the server text names the object and never a role. The
// role word a reader needs is the client's to add.
const PROMOTE_DENIED = 'sqlcmd exited 1: Msg 229, Level 14, State 5, Server SCOTT-CLAUDE, Line 1 The EXECUTE '
    + "permission was denied on the object 'usp_PromoteRecord', database 'KitMemory', schema 'mem'.";

test('the config carries the curator pair as one field, absent as null and half-given as a defect', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-curator-cfg-'));
    try {
        const file = path.join(dir, db.CONFIG_FILE);
        const base = {
            server: 's', database: 'KitMemory', login: 'kit_box', password: 'fixture-not-a-secret',
            embedding: { url: 'http://127.0.0.1:1', model: 'm' }
        };
        fs.writeFileSync(file, JSON.stringify(base));
        assert.strictEqual(db.loadConfig(file).config.curator, null, 'no pair is no curator');

        fs.writeFileSync(file, JSON.stringify({ ...base, curatorLogin: 'kit_curator', curatorPassword: 'fixture-not-a-secret-2' }));
        const both = db.loadConfig(file);
        assert.ok(both.ok, both.detail);
        assert.deepStrictEqual(both.config.curator, { login: 'kit_curator', password: 'fixture-not-a-secret-2' });
        assert.strictEqual(both.config.login, 'kit_box', 'the publisher login is untouched by the pair');

        fs.writeFileSync(file, JSON.stringify({ ...base, curatorLogin: 'kit_curator' }));
        const half = db.loadConfig(file);
        assert.strictEqual(half.ok, false);
        assert.strictEqual(half.reason, 'invalid');
        assert.match(half.detail, /only curatorLogin is set/, half.detail);
        fs.writeFileSync(file, JSON.stringify({ ...base, curatorPassword: 'fixture-not-a-secret-2' }));
        assert.match(db.loadConfig(file).detail, /only curatorPassword is set/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('a curator verb on a config with no curator pair refuses with the two fields named, and spawns nothing', () => {
    const host = fakeCuratorHost({});
    const refused = db.promoteRecord({
        config: config(), configPath: 'C:\\fixture\\kit-memory-db.json', name: 'a-lesson',
        sandbox: 'TEST-BOX', tier: 'project', segment: 'D--repo', deps: host
    });
    assert.strictEqual(refused.ok, false);
    assert.strictEqual(refused.standDown, 'curator');
    assert.strictEqual(host.calls.length, 0, 'no spawn is made without a curator');
    const sentence = db.standDownText(refused);
    assert.ok(sentence.includes('curatorLogin and curatorPassword are absent'), sentence);
    assert.ok(sentence.includes('C:\\fixture\\kit-memory-db.json'), 'the config path is named: ' + sentence);
    const curated = db.curate({ config: config(), asked: ['orphans'], deps: host });
    assert.strictEqual(curated.standDown, 'curator');
    assert.strictEqual(host.calls.length, 0);
});

test('a promote runs under the curator login, names the record by its host identity, and hands back the row', () => {
    const host = fakeCuratorHost({
        usp_PromoteRecord: { recordId: 42, name: 'a-lesson', visibility: 'shared' }
    });
    // A fixed clock, so the budget read back is not short by the milliseconds a
    // loaded box spends between the deadline and the spawn.
    host.now = () => 1000000;
    const cfg = curatorFixture({ timeoutMs: 4000 });
    const result = db.promoteRecord({
        config: cfg, name: 'a-lesson', sandbox: 'TEST-BOX', tier: 'project', segment: 'D--repo', deps: host
    });
    assert.deepStrictEqual(result, { ok: true, record: { recordId: 42, name: 'a-lesson', visibility: 'shared' } });
    assert.strictEqual(host.calls.length, 1);
    const call = host.calls[0];
    assert.strictEqual(call.procedure, 'usp_PromoteRecord');
    assert.deepStrictEqual(call.parameters, {
        '@p_SandboxName': 'TEST-BOX', '@p_Segment': 'D--repo', '@p_Name': 'a-lesson', '@p_Tier': 'project'
    });
    assert.strictEqual(call.login, 'kit_curator_test', 'the spawn presents the curator login');
    assert.strictEqual(call.windowsAuth, false, 'the curator is a SQL login, never Windows authentication');
    // The call's clock is the client's own configured timeout, never an
    // interactive channel's, and it is what the transport is handed.
    assert.strictEqual(call.budgetMs, 4000);
});

test('the host\'s refusal reaches the caller whole with the role named, on both verbs', () => {
    const refusing = () => ({ ok: false, cause: 'refused', detail: PROMOTE_DENIED });
    const host = fakeCuratorHost({ usp_PromoteRecord: refusing, usp_CurationUnapplied: refusing });
    const promoted = db.promoteRecord({
        config: curatorFixture(), name: 'a-lesson', sandbox: 'TEST-BOX', tier: 'project', segment: 'D--repo', deps: host
    });
    assert.strictEqual(promoted.ok, false);
    assert.strictEqual(promoted.standDown, 'refused');
    assert.ok(promoted.detail.includes("denied on the object 'usp_PromoteRecord'"),
        'the server text is in the detail, unparaphrased: ' + promoted.detail);
    assert.ok(promoted.detail.includes('mem_curator role'),
        'the role the verb needs is named, since the server text names only the object: ' + promoted.detail);
    assert.strictEqual(db.standDownText(promoted), promoted.detail, 'a refusal is handed on as its whole sentence');
    const curated = db.curate({ config: curatorFixture(), asked: ['unapplied', 'orphans'], unappliedDays: 90, deps: host });
    assert.strictEqual(curated.standDown, 'refused');
    assert.ok(curated.detail.includes("denied on the object 'usp_PromoteRecord'"), curated.detail);
    assert.ok(curated.detail.includes('mem_curator role'), curated.detail);
    assert.strictEqual(host.calls.length, 2, 'the refused curation stops the run: the orphans call is never made');
    // An outage is the other word, and it is not a refusal.
    const away = fakeCuratorHost({ usp_PromoteRecord: () => ({ ok: false, cause: 'outage', detail: 'sqlcmd exited 1: Sqlcmd: Error: Login timeout expired' }) });
    const unreachable = db.promoteRecord({
        config: curatorFixture(), name: 'a-lesson', sandbox: 'TEST-BOX', tier: 'project', segment: 'D--repo', deps: away
    });
    assert.strictEqual(unreachable.standDown, 'unreachable');
    assert.match(db.standDownText(unreachable), /^the memory database did not answer: sqlcmd exited 1/);
});

test('a curation run makes one call per query asked, in order, with the window on the first', () => {
    const host = fakeCuratorHost({
        usp_CurationUnapplied: [{ recordId: 1, sandbox: 'TEST-BOX', tier: 'project', segment: 'D--repo', name: 'stale-one',
            fileKey: 'stale-one.md', visibility: 'private', lastApplied: null, lastRead: null, lastPublished: '2026-09-01T00:00:00.0000000+00:00' }],
        usp_CurationSupersededLive: [],
        usp_CurationOrphans: { indexOrphans: [], unpublishedShared: [] }
    });
    const result = db.curate({ config: curatorFixture(), asked: ['unapplied', 'superseded', 'orphans'], unappliedDays: 45, deps: host });
    assert.ok(result.ok, result.detail);
    assert.deepStrictEqual(host.calls.map((c) => c.procedure),
        ['usp_CurationUnapplied', 'usp_CurationSupersededLive', 'usp_CurationOrphans']);
    assert.deepStrictEqual(host.calls[0].parameters, { '@p_Days': 45 });
    assert.deepStrictEqual(host.calls[1].parameters, {});
    assert.strictEqual(result.answers.unapplied[0].name, 'stale-one');
    assert.deepStrictEqual(result.answers.orphans, { indexOrphans: [], unpublishedShared: [] });
    // A word the client does not know is not a query, so nothing is sent for it.
    const none = db.curate({ config: curatorFixture(), asked: ['everything'], deps: fakeCuratorHost({}) });
    assert.deepStrictEqual(none, { ok: true, answers: {} });
});

test('memq db-promote prints the flipped row, and a refusal on stderr with exit 1', async () => {
    const memq = require(MEMQ);
    const host = fakeCuratorHost({ usp_PromoteRecord: { recordId: 7, name: 'a-lesson', visibility: 'shared' } });
    const run = await capturedStreams(() => memq.cmdDbPromote(
        ['a-lesson', '--sandbox', 'TEST-BOX', '--segment', 'D--repo'], { config: curatorFixture(), deps: host }));
    // The tokens a reader acts on: the name, the new visibility, the record
    // id and the sandbox. The sentence around them is free to change.
    assert.match(run.out, /^db-promote: a-lesson .*\bshared\b.*\brecord 7\b.*\bTEST-BOX\b.*\n$/, run.out);
    assert.strictEqual(run.err, '');
    assert.deepStrictEqual(host.calls[0].parameters,
        { '@p_SandboxName': 'TEST-BOX', '@p_Segment': 'D--repo', '@p_Name': 'a-lesson', '@p_Tier': 'project' });
    process.exitCode = 0;

    const refusing = fakeCuratorHost({ usp_PromoteRecord: () => ({ ok: false, cause: 'refused', detail: PROMOTE_DENIED }) });
    const refused = await capturedStreams(() => memq.cmdDbPromote(
        ['a-lesson', '--sandbox', 'TEST-BOX', '--segment', 'D--repo'], { config: curatorFixture(), deps: refusing }));
    assert.strictEqual(refused.out, '');
    assert.ok(refused.err.startsWith('memq: this verb runs under the mem_curator role, and the memory database refused this usp_PromoteRecord call: '), refused.err);
    assert.ok(refused.err.includes("denied on the object 'usp_PromoteRecord'"), refused.err);
    assert.strictEqual(process.exitCode, 1, 'a refusal exits non-zero');
    process.exitCode = 0;

    // The tier is passed through so the procedure's own sentence about a
    // shared tier is what a caller reads, and the sandbox defaults to this
    // machine's own name.
    const tiered = fakeCuratorHost({ usp_PromoteRecord: { recordId: 8, name: 'a-lesson', visibility: 'shared' } });
    await capturedStreams(() => memq.cmdDbPromote(['a-lesson', '--tier', 'operator'], { config: curatorFixture(), deps: tiered }));
    assert.deepStrictEqual(tiered.calls[0].parameters,
        { '@p_SandboxName': os.hostname(), '@p_Segment': '', '@p_Name': 'a-lesson', '@p_Tier': 'operator' });
    process.exitCode = 0;
});

test('memq db-curate prints each list in the store\'s line shape, every value through the store\'s own caps', async () => {
    const memq = require(MEMQ);
    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 86400000).toISOString();
    const host = fakeCuratorHost({
        usp_CurationUnapplied: [
            { recordId: 1, sandbox: 'NEO-CLAUDE', tier: 'project', segment: 'D--repo', name: 'stale-one', fileKey: 'stale-one.md',
                visibility: 'private', lastApplied: null, lastRead: twoDaysAgo, lastPublished: twoDaysAgo },
            { recordId: 2, sandbox: null, tier: 'operator', segment: null, name: 'old\u001b[31m-rule', fileKey: 'old-rule.md',
                visibility: 'shared', lastApplied: twoDaysAgo, lastRead: null, lastPublished: twoDaysAgo }
        ],
        usp_CurationSupersededLive: [
            { recordId: 3, sandbox: 'TEST-BOX', tier: 'type', segment: 'webapp', name: 'older', fileKey: 'older.md',
                supersededBy: { recordId: 4, name: 'newer', fileKey: 'newer.md' } }
        ],
        usp_CurationOrphans: {
            indexOrphans: [{ storeTier: 'operator', storeSegment: null, sandbox: null, indexLineName: 'ghost',
                description: 'a line with no file\tbehind it', firstSeen: twoDaysAgo, lastSeen: twoDaysAgo, lastSeenBy: 'TEST-BOX' }],
            unpublishedShared: [{ recordId: 5, sandbox: 'TEST-BOX', tier: 'operator', segment: null, name: 'forgotten',
                fileKey: 'forgotten.md', lastPublished: twoDaysAgo, lastPublishedBy: 'TEST-BOX' }]
        }
    });
    const run = await capturedStreams(() => memq.cmdDbCurate(
        ['--unapplied', '30', '--superseded', '--orphans'], { config: curatorFixture(), deps: host }));
    assert.strictEqual(run.err, '');
    // The hit lines are hitLine's identity contract and stay exact. The
    // header sentence above each list is pinned to its count, in the order
    // the flags asked, and to nothing else in its wording.
    const lines = run.out.split('\n');
    assert.deepStrictEqual(lines.filter((line) => line.startsWith('  ')), [
        '  stale-one  (project:D--repo)  sandbox:NEO-CLAUDE  applied never, read 2d ago',
        '  old[31m-rule  (operator)  applied 2d ago, read never',
        '  older  (type:webapp)  sandbox:TEST-BOX  superseded by newer',
        '  ghost  (operator)  last seen 2d ago  a line with no filebehind it',
        '  forgotten  (operator)  sandbox:TEST-BOX  published 2d ago'
    ], run.out);
    const headers = lines.filter((line) => line !== '' && !line.startsWith('  '));
    assert.deepStrictEqual(headers.map((line) => (/(\d+ (?:record|line)\(s\))$/.exec(line) || [])[1]),
        ['2 record(s)', '1 record(s)', '1 line(s)', '1 record(s)'], run.out);
    assert.strictEqual(lines[lines.length - 1], '', 'the output ends on a newline');
    assert.deepStrictEqual(host.calls[0].parameters, { '@p_Days': 30 });
    process.exitCode = 0;
});

test('memq db-curate with no flag is the usage, and each verb refuses its own bad arguments', () => {
    const store = makeStore();
    try {
        const none = runMemq(store, ['db-curate']);
        assert.strictEqual(none.status, 1);
        assert.ok(none.stderr.includes('db-curate needs at least one of --unapplied, --superseded, --orphans'), none.stderr);
        assert.ok(none.stderr.includes('usage: memq'), 'the usage follows');
        const days = runMemq(store, ['db-curate', '--unapplied', 'soon']);
        assert.strictEqual(days.status, 1);
        assert.ok(days.stderr.includes('--unapplied needs a whole number of days'), days.stderr);
        const noName = runMemq(store, ['db-promote']);
        assert.strictEqual(noName.status, 1);
        assert.ok(noName.stderr.includes('db-promote needs a name'), noName.stderr);
        const badTier = runMemq(store, ['db-promote', 'a-lesson', '--tier', 'shared']);
        assert.strictEqual(badTier.status, 1);
        assert.ok(badTier.stderr.includes('--tier must be one of project, type, operator'), badTier.stderr);
        const badName = runMemq(store, ['db-promote', 'MEMORY']);
        assert.strictEqual(badName.status, 1);
        assert.ok(badName.stderr.includes('name must be characters from'), badName.stderr);
        // Both verbs are dispatched and the usage names them.
        const usage = runMemq(store, []);
        assert.ok(usage.stderr.includes('memq db-promote <name> [--sandbox <name>] [--tier project|type|operator]'), usage.stderr);
        assert.ok(usage.stderr.includes('memq db-curate [--unapplied <days>] [--superseded] [--orphans]'), usage.stderr);
    } finally {
        rmStore(store);
    }
});

test('memq db-promote on a machine whose config names no curator says so and exits non-zero', () => {
    const store = makeHomeStore();
    try {
        fs.writeFileSync(path.join(store.root, db.CONFIG_FILE), JSON.stringify({
            server: 'kit-db-test', database: 'KitMemoryTest', windowsAuth: true,
            embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
        }));
        const res = runMemqAtHome(store, ['db-promote', 'a-lesson', '--segment', 'D--repo']);
        assert.strictEqual(res.status, 1, res.stdout + res.stderr);
        assert.strictEqual(res.stdout, '');
        assert.ok(res.stderr.includes('curatorLogin and curatorPassword are absent'), res.stderr);
        assert.ok(res.stderr.includes('this verb runs under the curator role alone'), res.stderr);
        const absent = runMemqAtHome(store, ['db-curate', '--orphans']);
        assert.strictEqual(absent.status, 1);
        assert.ok(absent.stderr.includes('curatorLogin and curatorPassword are absent'), absent.stderr);
    } finally {
        rmHomeStore(store);
    }
});

test('the health reading counts the queue at the store root it is given and never creates one', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-health-'));
    try {
        const answer = { schemaVersion: 2, sharedRecords: 1, sharedEmbeddings: 1, sandboxes: [{ sandbox: 'TEST-BOX', records: 1, embeddings: 1, lastPublish: null, oldestUnembedded: null }] };
        const host = fakeCuratorHost({ usp_Health: answer });
        const empty = db.hostHealth({ config: config(), storeRoot: dir, deps: host });
        assert.deepStrictEqual(empty, { ok: true, health: answer, queueDepth: 0, path: undefined });
        assert.ok(!fs.existsSync(path.join(dir, db.QUEUE_FILE)), 'an absent queue is counted as empty without being created');
        assert.strictEqual(host.calls[0].login, '', 'the health call presents the publisher login, not the curator');
        assert.deepStrictEqual(host.calls[0].parameters, { '@p_ModelIdentity': 'test-model' });

        const handle = db.openQueue(path.join(dir, db.QUEUE_FILE));
        try {
            handle.prepare('INSERT INTO queue (id, kind, payload, created_at) VALUES (?, ?, ?, ?)')
                .run('stamp-1', 'usage', '{}', new Date().toISOString());
        } finally {
            handle.close();
        }
        assert.strictEqual(db.hostHealth({ config: config(), storeRoot: dir, deps: host }).queueDepth, 1);

        const away = fakeCuratorHost({ usp_Health: () => ({ ok: false, cause: 'outage', detail: 'the host did not answer' }) });
        const down = db.hostHealth({ config: config(), storeRoot: dir, deps: away });
        assert.strictEqual(down.ok, false);
        assert.strictEqual(down.standDown, 'unreachable');
        assert.strictEqual(down.queueDepth, 1, 'the queue depth rides on a failed reading too');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// The segment and tag cut on the real host, seeded through the real client.
// Two project segments named for a fresh run id publish as two segments of
// this machine's one sandbox, beside one operator-tier record that lands shared,
// all from one temp store root. The search then runs through the client's own
// transport four ways. A publish from a temp root names nothing outside it as
// removed, since a store the walk did not find is held back.
//
// The publisher never names a shared row removed, so nothing the kit runs
// retires the operator record once it lands: it is visible fleet-wide and stays
// until a curator retires it. It therefore carries one fixed name across every
// run, and each run updates that one host row in place with its own query word
// rather than adding a fleet-visible row per run. The update lands only where
// the file is newer than the host row: a machine whose clock is behind the last
// writer's gets skippedOlder for it, and the case fails on the publish count.
// The private rows are what a run leaves behind: they stay on the host under
// their run-id segments, and the case prints them so the operator can retire
// them by curation. A fresh run id and query word per run keep a leftover row
// out of every later run's assertions.
//
// The publish also writes a clean PublishRun row for this sandbox, so the
// doctor's last-clean-publish reading reads fresh for up to seven days after a
// live run, even where the machine's real store has not published in that time.
//
// The publisher sends every record's tags as a JSON array, an empty one where a
// record has none, so the untagged records here reach the host as [] rather
// than as NULL. The NULL and object forms are seeded directly in the
// installer's live lane, which is where they can be written.
test('live host: a scoped search keeps its own segment and tag and drops the rest',
    { skip: !LIVE && 'KIT_MEMORY_DB_LIVE=1 is not set, so no case reaches the real memory database' }, async (t) => {
        const loaded = db.loadConfig();
        if (!loaded.ok) {
            t.skip('no usable memory database config at ' + loaded.path + ' (' + loaded.reason + ')');
            return;
        }
        const config = loaded.config;
        const runId = require('crypto').randomBytes(4).toString('hex');
        const letters = (count) => Array.from(require('crypto').randomBytes(count),
            (b) => String.fromCharCode(97 + (b % 26))).join('');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-scope-root-' + runId + '-'));
        // Short printable ASCII by construction, inside the 200 characters the
        // client writes a text parameter into a batch as.
        const segA = 'scope-a-' + runId;
        const segB = 'scope-b-' + runId;
        const before = {
            root: process.env.KIT_MEMORY_ROOT,
            allow: process.env.KIT_MEMORY_ROOT_ALLOW_DATA,
            project: process.env.KIT_MEMORY_PROJECT
        };
        let published = false;
        const names = {
            aTagged: 'scope-a-tagged-' + runId,
            aPlain: 'scope-a-plain-' + runId,
            bTagged: 'scope-b-tagged-' + runId,
            bPlain: 'scope-b-plain-' + runId,
            shared: 'kit-live-scoped-search-fixture'
        };
        try {
            const health = db.hostHealth({ config, storeRoot: root });
            assert.ok(health.ok, 'the live host must answer its health read: ' + JSON.stringify(health));
            const version = Number(health.health.schemaVersion);
            if (!(Number.isFinite(version) && version >= db.SCOPED_SEARCH_SCHEMA_VERSION)) {
                t.skip('the memory database reports schema version ' + health.health.schemaVersion
                    + ' where this case needs version ' + db.SCOPED_SEARCH_SCHEMA_VERSION
                    + '; run Install-MemoryDatabase.ps1 against the host first');
                return;
            }

            // Every description carries one word no other record holds, so the
            // lexical list answers these five rows and nothing else anywhere.
            const word = 'scopeword' + letters(8);
            const tag = 'scopetag' + letters(8);
            const tagged = (title) => '---\ntags: ' + tag + '\n---\n# ' + title + '\n\na body\n';
            const plain = (title) => '# ' + title + '\n\na body\n';
            const memA = path.join(root, 'projects', segA, 'memory');
            const memB = path.join(root, 'projects', segB, 'memory');
            writeRecord(memA, names.aTagged, tagged('a tagged'), word + ' a tagged');
            writeRecord(memA, names.aPlain, plain('a plain'), word + ' a plain');
            writeRecord(memB, names.bTagged, tagged('b tagged'), word + ' b tagged');
            writeRecord(memB, names.bPlain, plain('b plain'), word + ' b plain');
            writeRecord(path.join(root, 'memory-operator'), names.shared, plain('shared'), word + ' shared');

            process.env.KIT_MEMORY_ROOT = root;
            process.env.KIT_MEMORY_ROOT_ALLOW_DATA = '1';
            delete process.env.KIT_MEMORY_PROJECT;
            published = true;
            const result = await db.publish({ config });
            assert.strictEqual(result.ok, true, JSON.stringify(result));
            // Four private rows are new every run; the fixed-name shared row is
            // new on the host's first run and updated in place on every later one.
            assert.ok(result.summary.added >= 4 && result.summary.added + result.summary.changed === 5,
                JSON.stringify(result.summary));

            const search = (scope) => {
                const run = db.callProcedure(config, 'usp_Search',
                    Object.assign({ '@p_QueryText': word, '@p_Limit': '50' }, scope));
                assert.ok(run.ok, 'the scoped search failed: ' + JSON.stringify(run));
                const rows = Array.isArray(run.rows[0]) ? run.rows[0] : [];
                return rows.map((r) => r.name).sort();
            };
            const expect = (...keys) => keys.map((k) => names[k]).sort();

            // The full-text index populates asynchronously, so the unscoped
            // answer is awaited until it holds all five, bounded and loud.
            const deadline = Date.now() + 120000;
            let none = [];
            for (;;) {
                none = search({});
                if (none.length >= 5) break;
                if (Date.now() > deadline) {
                    assert.fail('the full-text index did not serve the five fixture rows within 120 s: '
                        + JSON.stringify(none));
                }
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
            }

            // No segment: both stores' rows and the shared row. This answer is
            // the control for every absence below.
            assert.deepStrictEqual(none, expect('aTagged', 'aPlain', 'bTagged', 'bPlain', 'shared'),
                'the unscoped search answers both segments and the shared row');
            // The first segment: its own two rows, neither of the second's and
            // not the shared row.
            assert.deepStrictEqual(search({ '@p_Segment': segA }), expect('aTagged', 'aPlain'),
                'the first segment answers its own rows alone');
            // The first segment and the tag: its tagged row alone, the untagged
            // one dropped.
            assert.deepStrictEqual(search({ '@p_Segment': segA, '@p_Tag': tag }), expect('aTagged'),
                'the first segment with the tag answers its tagged row alone');
            // The tag alone: the tagged rows of both segments, and neither
            // untagged row nor the untagged shared one.
            assert.deepStrictEqual(search({ '@p_Tag': tag }), expect('aTagged', 'bTagged'),
                'the tag alone answers the tagged rows of both segments');
        } finally {
            for (const [name, value] of [['KIT_MEMORY_ROOT', before.root],
                ['KIT_MEMORY_ROOT_ALLOW_DATA', before.allow], ['KIT_MEMORY_PROJECT', before.project]]) {
                if (value === undefined) delete process.env[name];
                else process.env[name] = value;
            }
            if (published) {
                t.diagnostic('left on the host: private project rows under segments ' + segA + ' and ' + segB
                    + '; the shared operator record ' + names.shared + ' is one fixed-name row updated in place,'
                    + ' visible fleet-wide until a curator retires it; this run also wrote a clean publish run for'
                    + ' this sandbox, so the doctor reads a fresh last publish for up to seven days');
            }
            try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* a temp directory left behind never fails a case */ }
        }
    });
