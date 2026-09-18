// The memory database client: the publish sequence, the spool, the chunker and
// the transport's own encoding.
//
// Two levels run here. Most cases drive scripts/memory-database.js in process
// with the two boundary calls replaced: `deps.runBatch` stands in for the
// sqlcmd spawn and `deps.embedBatch` for the embedding server. The fake server
// below is a real little server rather than a stub returning constants, because
// every count this section reports is the database's answer and a stub would be
// this file asserting its own arithmetic.
//
// The rest run the CLI as a child against a store fixture, which is the only
// way to prove the property the spool exists for: the local write happens and
// the stamp is still not lost when the host does not answer.
//
// No case here reaches a network, a real SQL Server or a real embedding server.
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

const SCRIPTS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts');
const MEMQ = path.join(SCRIPTS, 'memq.js');
const CLIENT_SOURCE = path.join(SCRIPTS, 'memory-database.js');
const db = require(CLIENT_SOURCE);
// The local semantic index, which owns the two values a publish must agree
// with it about: the embedder's batch width and the body hash.
const mi = require(path.join(SCRIPTS, 'memory-index.js'));

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
// that spools in process has to take.
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
                const at = row.recordId + ' ' + row.chunkIndex + ' ' + row.model;
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

test('with no client config the publish stands down: nothing is spawned, nothing is embedded, nothing is spooled', async () => {
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
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-spool.jsonl')), 'and writes no spool line');
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

test('a stamp stands down the same way: no config means no spawn and no spool line', () => {
    const store = makeDefaultStore();
    try {
        let spawned = 0;
        const answered = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            {
                configPath: path.join(store.root, 'no-such-config.json'),
                deps: { runBatch: () => { spawned += 1; return { ok: true, rows: [] }; } }
            });
        assert.deepStrictEqual(answered, { delivered: false, spooled: false, reason: 'absent' });
        assert.strictEqual(spawned, 0);
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-spool.jsonl')),
            'a spool that filled on a machine with no database would drain nowhere');

        // The control: with a config, the same stamp is written.
        const spooled = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            { config: config(), deps: { runBatch: () => ({ ok: false, detail: 'refused' }) } });
        assert.deepStrictEqual(spooled, { delivered: false, spooled: true, reason: 'spooled' });
        assert.strictEqual(fs.readFileSync(path.join(store.root, 'kit-memory-db-spool.jsonl'), 'utf8').trim().split('\n').length, 1);
    } finally {
        rmDefaultStore(store);
    }
});

// A redirected store is a store no publish will ever drain: every publish leg
// refuses a non-default root, because the credential comes from the home
// directory whatever store the walk read. A stamp writer that spooled there
// anyway would grow a file without bound on every worker session, and report
// each line as spooled while it did it.
test('a stamp under a redirected store is refused rather than spooled', () => {
    const store = makeStore();
    try {
        const answered = db.deliver(
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            { config: config() });
        assert.deepStrictEqual(answered, { delivered: false, spooled: false, reason: 'redirected' });
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-spool.jsonl')),
            'nothing is written under a root nothing drains');
    } finally {
        rmStore(store);
    }

    // The control, withheld from the assertion above: the same call under this
    // machine's own store does spool, so the refusal is the redirection rather
    // than a writer that writes nothing.
    const own = makeDefaultStore();
    try {
        const spooled = db.deliver(
            db.usageEntry('project', own.segment, 'a-record', 'a-record.md', 'read'),
            { config: config() });
        assert.deepStrictEqual(spooled, { delivered: false, spooled: true, reason: 'spooled' });
        assert.ok(fs.existsSync(path.join(own.root, 'kit-memory-db-spool.jsonl')));
    } finally {
        rmDefaultStore(own);
    }
});

// The interactive path's whole shape, and the reason it is worth a case of its
// own: a stamp is offered a few hundred milliseconds, which does not fund a
// cold client-tool start plus a TLS negotiation plus a login, so an attempt
// made under that clock is killed on a healthy host as reliably as on a dead
// one and costs the session the wait either way. Worse, a kill landing after
// the server committed the row and before its answer was read spools a row the
// host already holds, and both append procedures are plain inserts with no
// dedupe. So the stamp is spooled and the publish delivers it.
test('an interactive stamp reaches the spool without a database call of any kind', () => {
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
        assert.deepStrictEqual(answered, { delivered: false, spooled: true, reason: 'spooled' });
        assert.deepStrictEqual(seen, [],
            'the interactive path spawns nothing: a host that would have answered is not asked');

        const spool = db.readSpool();
        assert.strictEqual(spool.usage.length, 1);
        assert.strictEqual(spool.outcomes.length, 0);
        assert.strictEqual(spool.malformed, 0);
        assert.deepStrictEqual(
            {
                tier: spool.usage[0].tier, segment: spool.usage[0].segment,
                name: spool.usage[0].name, fileKey: spool.usage[0].fileKey, kind: spool.usage[0].kind
            },
            { tier: 'type', segment: 'sometype', name: 'a-record', fileKey: 'a-record.md', kind: 'applied' },
            'the spool line is the row usp_AppendUsage reads');
        assert.strictEqual(typeof spool.usage[0].at, 'string', 'and it carries the time the stamp was taken');

        // The control, withheld from the assertion above: the same fake does
        // record a call when the publish makes one, so the empty list is the
        // stamp path making none rather than a fake that never fills.
        const host = fakeHost();
        db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.ok(host.calls.length > 0, 'the control must reach the transport');
    } finally {
        rmDefaultStore(store);
    }
});

// ------------------------------------------------------------------ the spool --

// The spool file as bytes, for the cases whose whole assertion is that the
// drain did not touch it.
function spoolBytes() {
    const file = db.spoolPath();
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

test('a drain whose sends all succeed clears the spool and reports the count', () => {
    const store = makeStore();
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const spoolFile = db.spoolPath();

        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.deepStrictEqual(drained, { ok: true, drained: 2, remaining: 0, malformed: 0, rejected: 0 });
        assert.strictEqual(fs.statSync(spoolFile).size, 0,
            'a fully delivered spool is emptied rather than left holding lines the host has: '
            + fs.readFileSync(spoolFile, 'utf8'));
        assert.strictEqual(host.usage.length, 1);
        assert.strictEqual(host.outcomes.length, 1);
        assert.strictEqual(host.outcomes[0].actionKey, 'an-action');

        // The file is emptied rather than unlinked, so an appender holding it
        // open keeps writing to the file this path names.
        assert.ok(fs.existsSync(spoolFile), 'the spool file is still there for the next appender');
    } finally {
        rmStore(store);
    }
});

// The idempotence the whole redesign rests on. The client no longer tracks
// which of its lines the host took, so every line it sends carries an id the
// server dedupes on: mem.Usage and mem.Outcome each hold a unique index over
// that column and each append procedure inserts only the ids its table does not
// already hold. Without the id on the wire the server has nothing to dedupe by
// and a drain that left the file whole would double every row on the next run.
test('every spool line carries a stamp id, and a line sent twice inserts once', () => {
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
        assert.notStrictEqual(usage.stampId, outcome.stampId, 'two lines never share an id');
        assert.notStrictEqual(db.usageEntry('project', store.segment, 'one', 'one.md', 'read').stampId,
            usage.stampId, 'and two stamps of the same record never do either');

        // The id reaches the server on the wire, read back out of the batch text
        // the client wrote rather than from the object it was handed.
        db.appendSpool([usage, outcome]);
        const host = fakeHost();
        assert.strictEqual(db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION }).ok, true);
        assert.strictEqual(host.usage[0].stampId, usage.stampId,
            'the stamp id survived the JSON payload and the escaping: ' + JSON.stringify(host.usage[0]));
        assert.strictEqual(host.outcomes[0].stampId, outcome.stampId);

        // The same two lines spooled again and drained against the same host,
        // which is what a drain that left the file whole makes happen on the
        // next run. The host holds one row of each, because its unique index
        // refuses the second.
        db.appendSpool([usage, outcome]);
        assert.strictEqual(db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION }).ok, true);
        assert.strictEqual(host.usage.length, 1, 'a resent stamp inserts once: ' + JSON.stringify(host.usage));
        assert.strictEqual(host.outcomes.length, 1, 'and so does a resent outcome');

        // The control, withheld from the assertions above: a line carrying a
        // different id is a different line and does insert, so the one row above
        // is the index and not a host that stopped accepting rows.
        db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
        assert.strictEqual(db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION }).ok, true);
        assert.strictEqual(host.usage.length, 2, JSON.stringify(host.usage));
    } finally {
        rmStore(store);
    }
});

// A batch the procedure refuses is a contract defect between this client and
// that procedure rather than an operational state. The file is left exactly as
// it was found, the server's own words go out on a surface a person reads, and
// the spool grows until somebody repairs the contract; that growth is the
// signal. Destroying the lines instead is the loss this whole mechanism exists
// to prevent.
test('a drain the server refuses leaves the file byte-identical and reports the server\'s own text', () => {
    const store = makeStore();
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const before = spoolBytes();

        const refusing = fakeHost({ fail: ['usp_AppendUsage'] });
        const failed = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.strictEqual(failed.ok, false, JSON.stringify(failed));
        assert.strictEqual(failed.cause, 'refused', JSON.stringify(failed));
        assert.strictEqual(failed.drained, 0, 'nothing came off the file, so nothing is reported drained');
        assert.deepStrictEqual(spoolBytes(), before,
            'the file is left whole: a stamp delivered nowhere and deleted anyway is the loss this '
            + 'mechanism exists to prevent');
        assert.ok(/usp_AppendUsage/.test(failed.detail), 'the refusal names the procedure: ' + failed.detail);
        assert.ok(/the host refused usp_AppendUsage/.test(failed.detail),
            'and carries the server\'s own words rather than a bare errno: ' + failed.detail);
        assert.ok(/left whole/.test(failed.detail),
            'and says what happened to the spool: ' + failed.detail);
        assert.strictEqual(refusing.outcomes.length, 1,
            'a refusal is a fact about one procedure\'s lines and stands the other one down');

        // The control, withheld from the assertions above: the same file against
        // a host that refuses nothing drains and empties, so the bytes above
        // stayed for the refusal rather than for something about the file.
        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.deepStrictEqual(drained, { ok: true, drained: 2, remaining: 0, malformed: 0, rejected: 0 });
        assert.strictEqual(fs.statSync(db.spoolPath()).size, 0);
    } finally {
        rmStore(store);
    }
});

// The other disposition, told apart before either is reported. A refusal names a
// defect and asks for a fix; an outage asks for nothing but the next run, and a
// host that blinks once would otherwise open a defect that is not there and make
// noise of the spool growth that is supposed to be the signal.
test('a drain whose transport fails leaves the file byte-identical and reports the transport\'s own text', () => {
    const store = makeStore();
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const before = spoolBytes();

        const attempted = [];
        const gone = (cfg, text, callOptions) => {
            attempted.push(parseCall(text).procedure);
            return {
                ok: false,
                cause: 'outage',
                detail: 'sqlcmd exited 1: TCP Provider: No connection could be made'
            };
        };
        const out = db.drainSpool(config(), { deps: { runBatch: gone }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'outage',
            'the drain carries the cause out rather than one false for both: ' + JSON.stringify(out));
        assert.strictEqual(out.drained, 0);
        assert.deepStrictEqual(spoolBytes(), before, 'and the file is whole');
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
        const no = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.strictEqual(no.cause, 'refused', JSON.stringify(no));
        assert.deepStrictEqual(refusing.calls.map((c) => c.procedure),
            ['usp_AppendUsage', 'usp_AppendOutcomes'], 'both procedures were attempted');
    } finally {
        rmStore(store);
    }
});

// The whole reason the drain empties an unchanged file rather than rewriting
// one. An appender takes no lock, because a stamp on the interactive path must
// never wait on a publish, so a line can land at any instant of a drain. A read
// followed by a write-back has a window between the two calls that no lock on
// this side closes, and a line landing in it is overwritten and reported
// nowhere. There is no write-back to land in: a drain that raced an append
// leaves the file whole, and the lines it delivered go again on the next run,
// where the stamp id makes the server insert each once.
test('a stamp appended during a drain survives it, and the drain rewrites the file nowhere', () => {
    const store = makeStore();
    try {
        const spoolFile = db.spoolPath();
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        let appended = 0;
        const host = fakeHost({
            onCall: () => {
                if (appended > 0) return;
                appended += 1;
                db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
            }
        });

        // The predicate the loss window is proved gone by: a call of
        // fs.writeFileSync against the spool path whose flag is not an appending
        // one, watched over the whole drain. The flag is what tells the two
        // apart, since node's own appendFileSync reaches this same function with
        // flag 'a' and an append is the one write that cannot lose a line. The
        // lost line is what a rewrite costs, so the case fails on the rewrite
        // itself rather than on a race it would have to win to observe.
        const realWrite = fs.writeFileSync;
        const isSpool = (target) => typeof target === 'string'
            && path.resolve(target) === path.resolve(spoolFile);
        const appending = (options) => typeof options === 'object' && options !== null
            && typeof options.flag === 'string' && options.flag.startsWith('a');
        const writes = [];
        const controlWrites = [];
        let phase = 'drain';
        let drained = null;
        try {
            fs.writeFileSync = function (target, data, options) {
                if (isSpool(target) && !appending(options)) {
                    (phase === 'drain' ? writes : controlWrites).push(target);
                }
                return realWrite.call(this, target, data, options);
            };
            drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
            // The control on the instrument, withheld from the drain's own
            // reading: a write this case makes itself is seen, so the empty
            // list above is the drain and not a watch that never fires.
            phase = 'control';
            fs.writeFileSync(spoolFile, fs.readFileSync(spoolFile));
        } finally {
            fs.writeFileSync = realWrite;
        }
        assert.strictEqual(appended, 1, 'the case must actually write inside the drain');
        assert.deepStrictEqual(writes, [],
            'the drain rewrote the spool, which is the window a late append is lost in: '
            + JSON.stringify(writes));
        assert.strictEqual(controlWrites.length, 1,
            'the watch must see a write this case makes, or its silence proves nothing');

        // Nothing came off the file, so nothing is reported drained. The count a
        // person reads is what the spool still holds: a drain that reported one
        // line drained while the file still held it would print the same
        // success on every later run and the spool would never be seen to stop
        // emptying. The race itself is an ordinary event that the next drain
        // clears, so it is named rather than failed.
        assert.strictEqual(drained.ok, true, JSON.stringify(drained));
        assert.strictEqual(drained.cause, 'raced', JSON.stringify(drained));
        assert.strictEqual(drained.drained, 0,
            'the clear was declined, so no line left the file: ' + JSON.stringify(drained));
        assert.ok(drained.remaining > 0,
            'and what is still on the spool is counted: ' + JSON.stringify(drained));
        assert.ok(/append/.test(drained.detail) && /left whole/.test(drained.detail),
            'the reason the file was left whole reaches a reader: ' + drained.detail);
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['one.md'],
            'the line this drain read is the only one it sent');

        const left = db.readSpool();
        assert.deepStrictEqual(left.usage.map((u) => u.fileKey), ['one.md', 'two.md'],
            'the raced drain leaves the file whole: the late stamp is there and so is the line the '
            + 'host already took: ' + fs.readFileSync(spoolFile, 'utf8'));

        // The next drain races nothing, so it sends both lines and empties the
        // file: the delivered line is resent rather than lost, the host's index
        // keeps it one row, and the spool converges rather than growing.
        const again = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.deepStrictEqual(again, { ok: true, drained: 2, remaining: 0, malformed: 0, rejected: 0 });
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['one.md', 'two.md'],
            'the resend inserted once and the late stamp landed beside it: ' + JSON.stringify(host.usage));
        assert.strictEqual(fs.statSync(spoolFile).size, 0,
            'and a drain that races no append clears the file outright: '
            + fs.readFileSync(spoolFile, 'utf8'));
    } finally {
        rmStore(store);
    }
});

// The residual window the clear cannot close, held as narrow as one process can
// hold it. An appender takes no lock, so a line landing between the measurement
// and the emptying is destroyed and reported nowhere; what bounds that window is
// that the two calls are adjacent syscalls on one open descriptor, with no path
// lookup between them for a rename or a swap to land in.
test('the clear measures and empties the spool through one descriptor, never a path lookup between the two', () => {
    const store = makeStore();
    try {
        const spoolFile = db.spoolPath();
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const isSpool = (target) => typeof target === 'string'
            && path.resolve(target) === path.resolve(spoolFile);

        const realStat = fs.statSync;
        const realTruncate = fs.truncateSync;
        const realOpen = fs.openSync;
        const realFtruncate = fs.ftruncateSync;
        const byPath = [];
        const controlByPath = [];
        let opened = 0;
        let emptied = 0;
        let phase = 'drain';
        let drained = null;
        try {
            fs.statSync = function (target, ...rest) {
                if (isSpool(target)) (phase === 'drain' ? byPath : controlByPath).push('statSync');
                return realStat.call(this, target, ...rest);
            };
            fs.truncateSync = function (target, ...rest) {
                if (isSpool(target)) (phase === 'drain' ? byPath : controlByPath).push('truncateSync');
                return realTruncate.call(this, target, ...rest);
            };
            // The read of the file opens it too, so what is counted here is the
            // writable open the clear makes and not that one.
            fs.openSync = function (target, flags, ...rest) {
                if (isSpool(target) && phase === 'drain' && flags === 'r+') opened += 1;
                return realOpen.call(this, target, flags, ...rest);
            };
            fs.ftruncateSync = function (fd, ...rest) {
                if (phase === 'drain') emptied += 1;
                return realFtruncate.call(this, fd, ...rest);
            };
            drained = db.drainSpool(config(), {
                deps: { runBatch: fakeHost().runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION
            });
            // The control, withheld from the drain's own reading: the by-path
            // pair this case runs itself is the shape the watch exists to catch,
            // a size measured through the name and the file emptied through the
            // name again, and it is seen. So the empty list above is the clear
            // and not a watch that never fires.
            phase = 'control';
            if (fs.statSync(spoolFile).size === 0) fs.truncateSync(spoolFile, 0);
        } finally {
            fs.statSync = realStat;
            fs.truncateSync = realTruncate;
            fs.openSync = realOpen;
            fs.ftruncateSync = realFtruncate;
        }

        assert.deepStrictEqual(drained, { ok: true, drained: 1, remaining: 0, malformed: 0, rejected: 0 },
            JSON.stringify(drained));
        assert.deepStrictEqual(byPath, [],
            'the clear named the file again between measuring it and emptying it: ' + byPath.join(', '));
        assert.deepStrictEqual(controlByPath, ['statSync', 'truncateSync'],
            'the watch must see the by-path pair this case makes, or its silence proves nothing');
        assert.strictEqual(opened, 1, 'the clear opened the spool once');
        assert.strictEqual(emptied, 1, 'and emptied it on that descriptor');
        assert.strictEqual(fs.statSync(spoolFile).size, 0, 'the file really is empty');
    } finally {
        rmStore(store);
    }
});

// The drain's whole safety rests on the host holding the stamp id indexes and
// the procedures that skip on them. Against an older host, OPENJSON ... WITH
// ignores the stampId key it does not name, so every resend after a refusal, an
// outage or a raced clear writes a second row: the duplicate this redesign
// exists to end. The version is therefore read before anything is sent.
test('a host below the schema version this client requires is refused, and not one line is sent', () => {
    const store = makeStore();
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const before = spoolBytes();
        const behind = db.REQUIRED_SCHEMA_VERSION - 1;

        const old = fakeHost({ schemaVersion: behind });
        const out = db.drainSpool(config(), { deps: { runBatch: old.runBatch }, schemaVersion: behind });
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'schema',
            'an answering host is never reported as one to wait for, since waiting never resolves '
            + 'this: ' + JSON.stringify(out));
        assert.deepStrictEqual(old.calls, [], 'no line reached a procedure that would ignore its id');
        assert.deepStrictEqual(spoolBytes(), before, 'and the file is whole');
        assert.ok(new RegExp('\\b' + behind + '\\b').test(out.detail)
            && new RegExp('\\b' + db.REQUIRED_SCHEMA_VERSION + '\\b').test(out.detail),
            'the refusal names the version it found and the version it needs: ' + out.detail);
        assert.ok(/Install-MemoryDatabase/.test(out.detail),
            'and the remedy, which is the installer rather than the next run: ' + out.detail);

        // A host answering no version at all is the same refusal: a health
        // report with no version in it is not evidence of a host that has one.
        const silent = db.drainSpool(config(), { deps: { runBatch: old.runBatch } });
        assert.strictEqual(silent.cause, 'schema', JSON.stringify(silent));
        assert.deepStrictEqual(old.calls, []);

        // The control, withheld from the assertions above: the same file at the
        // required version drains and empties, so the refusal is the version
        // and not something about this spool.
        const current = fakeHost();
        assert.deepStrictEqual(
            db.drainSpool(config(), { deps: { runBatch: current.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION }),
            { ok: true, drained: 2, remaining: 0, malformed: 0, rejected: 0 });
        assert.strictEqual(fs.statSync(db.spoolPath()).size, 0);
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
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);

        const host = fakeHost({ schemaVersion: db.REQUIRED_SCHEMA_VERSION - 1 });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0, JSON.stringify(result.summary));
        assert.deepStrictEqual(host.usage, [], 'no spool line reached the host');
        assert.ok(result.summary.failed.some((f) => f.startsWith('the spool (schema): ')),
            'the cause rides out in front of the words, since the remedy is the installer: '
            + JSON.stringify(result.summary.failed));
        assert.strictEqual(db.readSpool().usage.length, 1, 'and the line is still on the file');
        assert.ok(result.summary.added > 0,
            'the run itself carries on, since the walk neither reads the spool nor writes to it: '
            + JSON.stringify(result.summary));

        // The control: the same publish against a host at the required version
        // drains the same line, so the refusal above is the version alone.
        const current = fakeHost();
        const ran = await publishWith(store, current);
        assert.strictEqual(ran.summary.drained, 1, JSON.stringify(ran.summary));
        assert.deepStrictEqual(current.usage.map((u) => u.fileKey), ['one.md']);
    } finally {
        rmStore(store);
    }
});

// One call carrying the whole spool grows with the spool, and a clock that grew
// with it would put one call past the timeout the operator configured: a
// detached session-start publish would then hold one sqlcmd process and the
// spool lock for as long as the module's own ceiling allows. The configured
// timeout is the bound, whatever the payload, and a payload that clock cannot
// fund is reported rather than funded.
test('a drain call\'s clock never passes the timeout its caller configured, whatever the payload', () => {
    const store = makeStore();
    try {
        const drainOf = (count) => {
            fs.rmSync(db.spoolPath(), { force: true });
            const entries = [];
            for (let at = 0; at < count; at += 1) {
                entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
            }
            db.appendSpool(entries);
            const host = fakeHost();
            const out = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
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
        fs.rmSync(db.spoolPath(), { force: true });
        const entries = [];
        for (let at = 0; at < 100; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'd' + at, 'd' + at + '.md', 'read'));
        }
        db.appendSpool(entries);
        const bounded = fakeHost();
        db.drainSpool(config(), {
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
// lift one call's clock past the configured timeout and will not batch the spool
// into smaller calls, so what it owes is a legible report.
test('an oversized spool payload is named on the publish summary with its size and its clock', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const entries = [];
        for (let at = 0; at < 3000; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        db.appendSpool(entries);

        const host = fakeHost();
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        const chars = JSON.stringify(host.calls.find((c) => c.procedure === 'usp_AppendUsage')
            .parameters['@p_Usage']).length;
        assert.ok(chars > db.PAYLOAD_FUNDED_CHARS, 'this case needs an oversized payload: ' + chars);
        // A run that emptied the spool and is warning about the next one, which
        // is a note: the lines it carried are on the host and no person is owed
        // anything by this run.
        const said = result.summary.notes.find((f) => f.startsWith('the spool (oversized): '));
        assert.ok(said, 'the cause rides in front of the words: ' + JSON.stringify(result.summary.notes));
        assert.ok(said.includes(String(chars)) && said.includes(String(config().timeoutMs)),
            'and the sentence names the payload and the clock: ' + said);
        assert.ok(!result.summary.failed.some((f) => /oversized/.test(f)),
            'and it is on no failure list: ' + JSON.stringify(result.summary.failed));
        assert.strictEqual(db.publishFailed(result.summary), false,
            'so the verb exits zero on a run that drained every line it read');

        // The control, withheld from the assertions above: one line through the
        // same publish carries no such sentence, so the report is the size.
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const clean = await publishWith(store, fakeHost());
        assert.ok(!clean.summary.notes.some((f) => /oversized/.test(f)),
            JSON.stringify(clean.summary.notes));
    } finally {
        rmStore(store);
    }
});

// A line no procedure can read is delivered by no future drain, and a silent
// drop is how a torn append disappears with nobody the wiser. So it is counted,
// reported, and left where it lies: a spool holding one holds all of it, because
// the file is emptied whole or not at all. What that costs is the readable lines
// beside it going again on every run, which the stamp id makes free, and a
// malformed count on every run until somebody looks at it; what it buys is that
// the bytes are still there to look at.
test('a malformed line is counted, reported and still on the file afterwards', () => {
    const store = makeStore();
    try {
        const spoolFile = db.spoolPath();
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        // A torn line: raw bytes no decoder can read, between two good ones.
        fs.appendFileSync(spoolFile, Buffer.from([0xFF, 0xFE, 0xFF, 0x0A]));
        db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
        const whole = fs.readFileSync(spoolFile);
        const torn = whole.subarray(whole.indexOf(0xFF), whole.indexOf(0xFF) + 4);

        const read = db.readSpool();
        assert.strictEqual(read.malformed, 1, 'the unreadable line is counted rather than passed over');
        assert.strictEqual(read.usage.length, 2);
        assert.strictEqual(read.bytes, fs.statSync(spoolFile).size,
            'the cut is a byte offset into the file, not a length of decoded text');

        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        // Nothing in this system ever removes those bytes, so the file never
        // empties again on its own: this reads as a state needing attention
        // rather than as the success a drained count would report.
        assert.deepStrictEqual(drained, {
            ok: false, contended: false, cause: 'malformed', drained: 0, remaining: 3,
            malformed: 1, rejected: 0, detail: drained.detail
        }, 'the kept bytes are a state to look at: ' + JSON.stringify(drained));
        assert.ok(/unreadable/.test(drained.detail) && /left whole/.test(drained.detail),
            'and the detail says what is on the file and why: ' + drained.detail);
        assert.strictEqual(host.usage.length, 2, 'the readable lines around it still went');
        assert.deepStrictEqual(fs.readFileSync(spoolFile), whole,
            'the file is left byte for byte as it was found, unreadable piece and all: '
            + fs.readFileSync(spoolFile).toString('hex'));
        assert.ok(fs.readFileSync(spoolFile).includes(torn), 'the unreadable bytes are still there');

        // The next drain finds it again and says so again, which is the state a
        // person is meant to notice: the file does not empty while it sits
        // there. The readable lines go again with it, and the host's index is
        // what keeps each of them one row.
        const twice = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.strictEqual(twice.ok, false, JSON.stringify(twice));
        assert.strictEqual(twice.cause, 'malformed', JSON.stringify(twice));
        assert.strictEqual(twice.drained, 0, JSON.stringify(twice));
        assert.strictEqual(twice.remaining, 3, JSON.stringify(twice));
        assert.deepStrictEqual(fs.readFileSync(spoolFile), whole);
        assert.strictEqual(host.usage.length, 2,
            'the resent lines inserted no second row: ' + JSON.stringify(host.usage));

        // The control, withheld from the assertions above: the same two readable
        // lines with the unreadable bytes gone drain and empty the file, so the
        // attention-needed state above is the kept bytes rather than something
        // about these lines.
        fs.rmSync(spoolFile, { force: true });
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')
        ]);
        assert.deepStrictEqual(
            db.drainSpool(config(), { deps: { runBatch: fakeHost().runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION }),
            { ok: true, drained: 2, remaining: 0, malformed: 0, rejected: 0 });
        assert.strictEqual(fs.statSync(spoolFile).size, 0);
    } finally {
        rmStore(store);
    }
});

// A line that parses is not a line the host will take. Both append procedures
// throw on the whole batch when one row is missing the fields they require, so a
// single such line sent with the rest turns every drain from then on into a
// refusal and the spool stops emptying. The read screens those fields instead
// and counts such a line unreadable, which leaves the file whole and the bytes
// there for a person: nothing here repairs, rewrites or puts back a line.
test('a spool line the append procedures would refuse is unreadable here, and stays on the file', () => {
    const store = makeStore();
    try {
        const spoolFile = db.spoolPath();
        // One good stamp, then the four shapes each procedure throws on.
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const good = db.usageEntry('project', store.segment, 'two', 'two.md', 'applied');
        const goodOutcome = db.outcomeEntry(store.segment,
            { key: 'a-key', outcome: 'worked', summary: 'a summary', ts: new Date().toISOString() });
        const bad = [
            { ...good, kind: null },
            { ...good, kind: 'noticed' },
            { ...good, at: null },
            { ...goodOutcome, segment: null },
            { ...goodOutcome, actionKey: '  ' },
            { ...goodOutcome, at: null }
        ];
        for (const line of bad) fs.appendFileSync(spoolFile, JSON.stringify(line) + '\n', 'utf8');
        const whole = fs.readFileSync(spoolFile);

        const read = db.readSpool();
        assert.strictEqual(read.malformed, bad.length,
            'each line the host would throw on is counted unreadable: ' + JSON.stringify(read));
        assert.strictEqual(read.usage.length, 1, JSON.stringify(read.usage));
        assert.strictEqual(read.outcomes.length, 0, JSON.stringify(read.outcomes));

        const host = fakeHost();
        const drained = db.drainSpool(config(), {
            deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION
        });
        assert.strictEqual(drained.cause, 'malformed', JSON.stringify(drained));
        assert.strictEqual(drained.malformed, bad.length, JSON.stringify(drained));
        assert.strictEqual(host.usage.length, 1, 'the one sendable line still went');
        assert.deepStrictEqual(fs.readFileSync(spoolFile), whole,
            'and the file is left byte for byte as it was found');

        // The control, withheld from the screen above: the same two entries with
        // every required field present drain and empty the file, so the count is
        // the missing fields rather than anything else about these lines.
        fs.rmSync(spoolFile, { force: true });
        db.appendSpool([good, goodOutcome]);
        const clean = db.readSpool();
        assert.strictEqual(clean.malformed, 0, JSON.stringify(clean));
        assert.deepStrictEqual(
            db.drainSpool(config(), {
                deps: { runBatch: fakeHost().runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION
            }),
            { ok: true, drained: 2, remaining: 0, malformed: 0, rejected: 0 });
        assert.strictEqual(fs.statSync(spoolFile).size, 0);
    } finally {
        rmStore(store);
    }
});

// The two declined clears split on the publish summary, because their prospects
// are opposite. A raced append is gone by the next drain, so a run that failed
// on one would fail whenever a stamp landed during a publish and teach its
// reader to ignore the very list the kept-bytes state has to be found on.
test('a raced clear rides as a note and a kept spool rides on the failure list', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        // The append lands while the drain's own call is in flight, which is the
        // window the clear declines on.
        let appended = 0;
        const racing = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage' || appended > 0) return;
                appended += 1;
                db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
            }
        });
        const raced = await publishWith(store, racing);
        assert.strictEqual(appended, 1, 'this case must actually write inside the drain');
        assert.strictEqual(raced.ok, true, JSON.stringify(raced));
        assert.ok(!raced.summary.failed.some((f) => /^the spool \(/.test(f)),
            'a race is no run failure: ' + JSON.stringify(raced.summary.failed));
        assert.ok(raced.summary.notes.some((n) => n.startsWith('the spool (raced): ')),
            'and it is still named, as a note: ' + JSON.stringify(raced.summary.notes));
        assert.strictEqual(raced.summary.drained, 0, JSON.stringify(raced.summary));
        assert.ok(/1 spool line\(s\) still on the spool/.test(db.summaryLine(raced.summary)),
            'the one line a person reads carries the count: ' + db.summaryLine(raced.summary));
        assert.ok(/an append landed during the drain/.test(db.summaryLine(raced.summary)),
            'and says what left it there: ' + db.summaryLine(raced.summary));
        // The publish run's own error column, which is written from the failure
        // list: an event that clears itself on the next run is no run error.
        assert.strictEqual(racing.runs[0].error, null,
            'a raced drain writes nothing into the run record\'s error: '
            + JSON.stringify(racing.runs[0]));

        // The other half of the split, on the same surfaces: unreadable bytes
        // nothing removes are on the failure list and in the error column.
        fs.rmSync(db.spoolPath(), { force: true });
        db.appendSpool([db.usageEntry('project', store.segment, 'three', 'three.md', 'read')]);
        fs.appendFileSync(db.spoolPath(), Buffer.from([0xFF, 0xFE, 0xFF, 0x0A]));
        const kept = fakeHost();
        const keptRun = await publishWith(store, kept);
        assert.ok(keptRun.summary.failed.some((f) => f.startsWith('the spool (malformed): ')),
            'the kept bytes are on the failure list: ' + JSON.stringify(keptRun.summary.failed));
        assert.ok(!keptRun.summary.notes.some((n) => /^the spool \(/.test(n)),
            'and not on the note list beside it: ' + JSON.stringify(keptRun.summary.notes));
        assert.ok(/the spool \(malformed\)/.test(String(kept.runs[0].error)),
            'and the run record carries it as an error: ' + JSON.stringify(kept.runs[0]));
    } finally {
        rmStore(store);
    }
});

// What the failure list is for. It moves the verb's exit code and it fills the
// publish run's error column, so only a state that needs a person belongs on it.
// A state the next ordinary run clears by itself, and a run that finished its
// work and is warning about the next one, are notes. A surface reporting failure
// on an ordinary busy publish teaches its reader to ignore it, which costs the
// one signal that matters.
test('every drain cause is classified by name, and a cause this client does not know is a failure', () => {
    for (const cause of ['raced', 'contended', 'oversized']) {
        assert.strictEqual(db.classifyDrainCause(cause), 'note',
            cause + ' clears itself, so it is a note');
    }
    for (const cause of ['schema', 'refused', 'outage', 'malformed', 'unclearable', 'budget']) {
        assert.strictEqual(db.classifyDrainCause(cause), 'failure',
            cause + ' needs a person, so it is a failure');
    }
    // The membership is enumerated rather than defaulted, so a cause added
    // later is classified deliberately: until somebody classifies it, it reads
    // as a failure, which is the side that costs a false alarm rather than a
    // missed one.
    assert.strictEqual(db.classifyDrainCause('a-cause-nobody-has-written-yet'), 'failure');
    assert.strictEqual(db.classifyDrainCause(null), 'failure');

    // The family, over the client's own source rather than over this list: a
    // cause the drain can answer and neither set names would be classified by
    // the default above with nobody having decided it. Comment lines are
    // dropped first, since the prose names these words too.
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8').split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.includes('drain.cause'));
    const answered = new Set();
    for (const line of source) {
        if (!/\bcause\b/.test(line)) continue;
        for (const found of line.match(/'[a-z]+'/g) || []) answered.add(found.slice(1, -1));
    }
    assert.ok(answered.size >= 6, 'the scan must actually find causes: ' + [...answered].join(', '));
    const classified = new Set([...db.DRAIN_NOTE_CAUSES, ...db.DRAIN_FAILURE_CAUSES]);
    for (const cause of answered) {
        assert.ok(classified.has(cause),
            'the drain can answer ' + cause + ' and neither set names it, so the publish would '
            + 'classify it by default rather than by a decision');
    }
    assert.strictEqual(
        [...db.DRAIN_NOTE_CAUSES].filter((c) => db.DRAIN_FAILURE_CAUSES.has(c)).length, 0,
        'no cause is on both lists');

    // The control, withheld from the list above: a cause the source does not
    // answer is not in the scan's reading, so the sweep is reading the source
    // rather than passing on anything it is handed.
    assert.ok(!answered.has('a-cause-nobody-has-written-yet'));
});

// A depth nobody measured is not a depth of zero. Three drain answers come back
// before or without a usable read of the file: the version gate refuses ahead of
// it, another publisher's lock holds it off, and an unreadable file stops it.
// Those are exactly the states where the spool is not emptying, so a zero on the
// count would tell a reader, and any later step that scrapes the field, that a
// full spool is empty.
test('a drain that never read the spool reports its depth as unknown rather than as zero', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);

        // The version gate, which answers before the lock and the read.
        const behind = db.REQUIRED_SCHEMA_VERSION - 1;
        const gated = db.drainSpool(config(), {
            deps: { runBatch: fakeHost({ schemaVersion: behind }).runBatch }, schemaVersion: behind
        });
        assert.strictEqual(gated.remaining, null, JSON.stringify(gated));

        // The lock another publisher holds.
        const memq = require(MEMQ);
        const held = memq.acquireLock(db.spoolLockPath());
        assert.strictEqual(held.ok, true, 'this case needs the lock in hand');
        let contended = null;
        try {
            contended = db.drainSpool(config(), {
                deps: { runBatch: fakeHost().runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION
            });
        } finally {
            held.release();
        }
        assert.strictEqual(contended.cause, 'contended', JSON.stringify(contended));
        assert.strictEqual(contended.remaining, null, JSON.stringify(contended));

        // And the file that could not be read at all.
        const realRead = fs.readFileSync;
        let unread = null;
        try {
            fs.readFileSync = function (target, ...rest) {
                if (typeof target === 'string' && path.resolve(target) === path.resolve(db.spoolPath())) {
                    const err = new Error('EACCES: permission denied');
                    err.code = 'EACCES';
                    throw err;
                }
                return realRead.call(this, target, ...rest);
            };
            unread = db.drainSpool(config(), {
                deps: { runBatch: fakeHost().runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION
            });
        } finally {
            fs.readFileSync = realRead;
        }
        assert.strictEqual(unread.remaining, null, JSON.stringify(unread));

        // On the publish surface: the count is carried as unknown and the clause
        // that would state it is omitted, while the cause's own sentence is what
        // tells the reader the file was left whole.
        const gatedRun = await db.publish({
            config: config(),
            deps: { runBatch: fakeHost({ schemaVersion: behind }).runBatch, embedBatch: fakeEmbedder() }
        });
        assert.strictEqual(gatedRun.summary.spoolRemaining, null, JSON.stringify(gatedRun.summary));
        const line = db.summaryLine(gatedRun.summary);
        assert.ok(!/still on the spool/.test(line),
            'no count is printed for a depth nobody read: ' + line);
        assert.ok(gatedRun.summary.failed.some((f) => f.startsWith('the spool (schema): ')), line);
        assert.strictEqual(db.readSpool().usage.length, 1, 'and the line really is still on the file');

        // The control, withheld from the assertions above: a drain that did read
        // the file and left lines on it does print the count, so the silence
        // above is the unread file rather than a clause that never prints.
        fs.appendFileSync(db.spoolPath(), Buffer.from([0xFF, 0xFE, 0xFF, 0x0A]));
        const keptRun = await publishWith(store, fakeHost());
        assert.strictEqual(keptRun.summary.spoolRemaining, 2, JSON.stringify(keptRun.summary));
        assert.ok(/2 spool line\(s\) still on the spool/.test(db.summaryLine(keptRun.summary)),
            db.summaryLine(keptRun.summary));
    } finally {
        rmStore(store);
    }
});

// The same state on the surface a person actually reads. A publish that printed
// "2 spool line(s) drained" over a file still holding all of them would say the
// same thing on every later run, and the spool would grow with nobody the wiser.
test('a spool kept for its unreadable bytes reads as attention needed on the publish summary', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const spoolFile = db.spoolPath();
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        fs.appendFileSync(spoolFile, Buffer.from([0xFF, 0xFE, 0xFF, 0x0A]));
        const whole = fs.readFileSync(spoolFile);

        const host = fakeHost();
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0,
            'no line left the file, so none is reported drained: ' + JSON.stringify(result.summary));
        assert.strictEqual(result.summary.spoolRemaining, 2,
            'and what the file still holds is counted: ' + JSON.stringify(result.summary));
        assert.ok(result.summary.failed.some((f) => f.startsWith('the spool (malformed): ')),
            'the cause rides in front of the words, since nothing here ever removes those bytes: '
            + JSON.stringify(result.summary.failed));
        const line = db.summaryLine(result.summary);
        assert.ok(/0 spool line\(s\) drained/.test(line), line);
        assert.ok(/2 spool line\(s\) still on the spool/.test(line),
            'the one line a person reads carries the count that is still there: ' + line);
        assert.ok(/1 unreadable spool line\(s\) kept/.test(line), line);
        assert.deepStrictEqual(fs.readFileSync(spoolFile), whole, 'and no byte was destroyed');

        // The control, withheld from the assertions above: the same publish over
        // a spool of readable lines reports them drained and nothing left, so the
        // counts above are the kept bytes rather than a line printed always.
        fs.rmSync(spoolFile, { force: true });
        db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
        const clean = await publishWith(store, fakeHost());
        assert.strictEqual(clean.summary.drained, 1, JSON.stringify(clean.summary));
        assert.strictEqual(clean.summary.spoolRemaining, 0, JSON.stringify(clean.summary));
        assert.ok(!/still on the spool/.test(db.summaryLine(clean.summary)),
            db.summaryLine(clean.summary));
    } finally {
        rmStore(store);
    }
});

// The whole of a wholly unterminated spool is one malformed piece, which is the
// shape a disk-full or a killed writer leaves. It is kept like any other, so the
// bytes survive, and the readable lines appended behind it still drain.
test('a torn trailing piece is kept, and the lines written after it still drain', () => {
    const store = makeStore();
    try {
        const spoolFile = db.spoolPath();
        fs.mkdirSync(path.dirname(spoolFile), { recursive: true });
        fs.writeFileSync(spoolFile, '{"type":"usage","tier":"proj', 'utf8');
        const host = fakeHost();
        const first = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.deepStrictEqual(first, {
            ok: false, contended: false, cause: 'malformed', drained: 0, remaining: 1,
            malformed: 1, rejected: 0, detail: first.detail
        }, JSON.stringify(first));
        assert.strictEqual(fs.readFileSync(spoolFile, 'utf8'), '{"type":"usage","tier":"proj',
            'the torn piece is still there, unterminated, exactly as it was');

        // A stamp written behind it runs onto its end and makes one unreadable
        // line of the two, which the drain counts and keeps; nothing here can
        // recover the stamp, and usage.jsonl on this machine still holds it.
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
        const second = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.strictEqual(second.ok, false, JSON.stringify(second));
        assert.strictEqual(second.cause, 'malformed', JSON.stringify(second));
        assert.strictEqual(second.malformed, 1, JSON.stringify(second));
        assert.strictEqual(second.drained, 0,
            'the file keeps the unreadable piece, so no line came off it: ' + JSON.stringify(second));
        assert.strictEqual(second.remaining, 2,
            'the whole line behind the run-on one and the run-on one itself are still there: '
            + JSON.stringify(second));
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['two.md'],
            'and the whole line behind the run-on one went to the host');
    } finally {
        rmStore(store);
    }
});

// One call per procedure over everything the read found, whatever the count.
// Batching is what the drain used to do and what its faults lived in, and
// nothing about a spool of this store's sizes needs it: the longest line memq
// writes is under a kilobyte, so a spool of a thousand lines is a payload one
// batch file and one OPENJSON pass take comfortably.
test('one send per procedure carries every line the read found', () => {
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
        db.appendSpool(entries);

        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        assert.deepStrictEqual(drained, { ok: true, drained: 253, remaining: 0, malformed: 0, rejected: 0 });
        assert.deepStrictEqual(host.calls.map((c) => c.procedure),
            ['usp_AppendUsage', 'usp_AppendOutcomes'],
            'two calls for the whole spool: ' + host.calls.map((c) => c.procedure).join(', '));
        assert.strictEqual(host.calls[0].parameters['@p_Usage'].length, 250,
            'the one usage call carries every usage line');
        assert.strictEqual(host.calls[1].parameters['@p_Outcomes'].length, 3);
        assert.strictEqual(host.usage.length, 250);
        assert.strictEqual(fs.statSync(db.spoolPath()).size, 0);
    } finally {
        rmStore(store);
    }
});

// A publisher already holding the spool lock is a healthy host and a busy
// machine. Reported as "the memory database did not answer" it would stand a
// whole publish down for a condition that clears itself in seconds.
test('a spool lock another publisher holds is contention, and the publish runs on past it', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const memq = require(MEMQ);
        const held = memq.acquireLock(db.spoolLockPath());
        assert.strictEqual(held.ok, true, 'this case needs the lock in hand');
        try {
            const host = fakeHost();
            const result = await publishWith(store, host);
            assert.strictEqual(result.ok, true, JSON.stringify(result));
            assert.strictEqual(result.summary.drained, 0);
            assert.strictEqual(result.summary.added, 1, 'the walk and the publish still ran');
            assert.ok(result.summary.notes.some((f) => /holds the spool lock/.test(f)),
                'contention has its own word: ' + JSON.stringify(result.summary.notes));
            assert.ok(!result.summary.failed.some((f) => /did not answer/.test(f)),
                'and it is never reported as a host that did not answer');
            // The other publisher's run drains this spool, so nobody is owed
            // anything by this one: a busy machine is a note and exits zero.
            assert.ok(!result.summary.failed.some((f) => /^the spool \(/.test(f)),
                'and it is on no failure list: ' + JSON.stringify(result.summary.failed));
            assert.strictEqual(db.publishFailed(result.summary), false,
                'so the verb exits zero while another publisher holds the lock');
            assert.strictEqual(host.runs[0].error, null,
                'and the run record carries no error: ' + JSON.stringify(host.runs[0]));
        } finally {
            held.release();
        }

        // The control: with the lock released the same spool drains, so the
        // zero above is the contention rather than an empty spool.
        const host = fakeHost();
        const after = await publishWith(store, host);
        assert.strictEqual(after.summary.drained, 1, JSON.stringify(after.summary));
    } finally {
        rmStore(store);
    }
});

// The lock takes one fixed staleness rather than one derived per drain from the
// configured timeout, which is the operator's and is accepted up to ten minutes.
// Short of the longest a live holder can be inside a drain, a second publisher
// breaks the lock while the first is still inside a spawn and both then write
// the file from their own reads. Past the interval that holds the next publish
// off, a publisher killed mid-drain leaves a lock no live one could hold and
// every session-start publish until it ages out reports contention and drains
// nothing.
test('the drain takes the spool lock at one fixed staleness, whatever the configured timeout', () => {
    const store = makeStore();
    try {
        const memq = require(MEMQ);
        const realAcquire = memq.acquireLock;
        const seen = [];
        const watch = function (target, options) {
            seen.push({ target, options });
            return realAcquire.call(this, target, options);
        };
        const lockOf = () => seen.find((s) => String(s.target).endsWith('kit-memory-db-spool.lock'));
        const taken = (extra, options) => {
            seen.length = 0;
            try {
                memq.acquireLock = watch;
                db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
                db.drainSpool(config(extra), {
                    deps: { runBatch: fakeHost().runBatch, now: () => 1000 },
                    schemaVersion: db.REQUIRED_SCHEMA_VERSION,
                    ...(options || {})
                });
            } finally {
                memq.acquireLock = realAcquire;
            }
            const found = lockOf();
            assert.ok(found && found.options, 'the drain takes the spool lock with a staleness: '
                + JSON.stringify(seen.map((s) => s.target)));
            return found.options.staleMs;
        };
        // The two ends of the configured timeout's legal range and the two ends
        // of the deadline's, all four answering the same number: nothing about
        // the drain's own budget moves it.
        assert.strictEqual(taken({ timeoutMs: 600000 }), db.DRAIN_LOCK_STALE_CEILING_MS);
        assert.strictEqual(taken({ timeoutMs: 1000 }), db.DRAIN_LOCK_STALE_CEILING_MS);
        assert.strictEqual(taken({}, { deadline: 1000 + 60 * 60 * 1000 }), db.DRAIN_LOCK_STALE_CEILING_MS);
        assert.strictEqual(taken({}, { deadline: 1000 + 5000 }), db.DRAIN_LOCK_STALE_CEILING_MS);

        // The value itself, read from the two numbers it is stated in terms of
        // rather than written out: the run's whole budget plus the life of a
        // spawn started on the last millisecond of it.
        const lastSpawn = db.spawnKillMs(db.callBudget(1000000, 999999, 10000, db.SQLCMD_FLOOR_MS));
        assert.strictEqual(db.SPAWN_MAX_OVERSHOOT_MS, lastSpawn,
            'the overshoot this module states is the life of that spawn: ' + db.SPAWN_MAX_OVERSHOOT_MS);
        assert.strictEqual(db.DRAIN_LOCK_STALE_CEILING_MS, db.RUN_BUDGET_MS + lastSpawn,
            'and the staleness is the run budget plus it: ' + db.DRAIN_LOCK_STALE_CEILING_MS);
        assert.ok(db.DRAIN_LOCK_STALE_CEILING_MS >= db.RUN_BUDGET_MS + 2 * db.SQLCMD_FLOOR_MS,
            'which is two spawn floors past the budget rather than one, since the budget of a call '
            + 'starting on the last millisecond is itself lifted to the floor before its kill adds '
            + 'another: ' + db.DRAIN_LOCK_STALE_CEILING_MS);

        // The control on the kill itself, read off the source because the spawn
        // it bounds is a real process this file never starts.
        const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
        assert.ok(/killMs = Number\.isFinite\(opts\.killMs\) \? opts\.killMs : spawnKillMs\(budgetMs\)/
            .test(source), 'the spawn takes its default kill from spawnKillMs');
        assert.ok(/SPAWN_MAX_OVERSHOOT_MS = spawnKillMs\(SQLCMD_FLOOR_MS\)/.test(source),
            'and the overshoot is that same function at the floor');
    } finally {
        rmStore(store);
    }
});

// A drain that delivered and could not clear the file is the one state that
// costs the host a duplicate row. The unique index absorbs that resend, so what
// is really at stake is a disk that would not take the write, and a reader has
// to hear about it either way.
test('a drain that delivered and could not clear the spool says so on the publish summary', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const spoolFile = db.spoolPath();
        const realTruncate = fs.truncateSync;
        const realFtruncate = fs.ftruncateSync;
        const realWrite = fs.writeFileSync;
        const epermError = () => {
            const err = new Error('EPERM: operation not permitted');
            err.code = 'EPERM';
            return err;
        };
        const refuse = (target) => {
            if (typeof target === 'string' && path.resolve(target) === path.resolve(spoolFile)) {
                throw epermError();
            }
        };
        let result = null;
        try {
            // The emptying itself goes through the open descriptor, so that is
            // what this refuses. The two by-path writes are refused beside it,
            // so a path that emptied the file by name rather than by descriptor
            // would meet the same disk.
            fs.ftruncateSync = function () { throw epermError(); };
            fs.truncateSync = function (target, ...rest) { refuse(target); return realTruncate.call(this, target, ...rest); };
            fs.writeFileSync = function (target, ...rest) { refuse(target); return realWrite.call(this, target, ...rest); };
            const host = fakeHost();
            result = await publishWith(store, host);
        } finally {
            fs.truncateSync = realTruncate;
            fs.ftruncateSync = realFtruncate;
            fs.writeFileSync = realWrite;
        }
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0,
            'nothing came off the file, so nothing is reported drained: ' + JSON.stringify(result.summary));
        assert.ok(result.summary.failed.some((f) => /could not be cleared/.test(f)),
            'the drain detail must reach a reader: ' + JSON.stringify(result.summary.failed));
        // The drain's cause rides out with its words, because the states it
        // reaches have different remedies and the sentence behind it is the
        // host's or the disk's.
        assert.ok(result.summary.failed.some((f) => f.startsWith('the spool (unclearable): ')),
            'and the word the drain reached rides in front of them: '
            + JSON.stringify(result.summary.failed));
        assert.strictEqual(db.readSpool().usage.length, 1, 'and the line is still on the file');
    } finally {
        rmStore(store);
    }
});

// A spool the drain cannot read at all is neither a refusal nor an outage: the
// host was never asked. Reported as either, a permissions problem on this
// machine sends somebody to look at the server.
test('a spool that could not be read is reported as such, and nothing is sent', () => {
    const store = makeStore();
    try {
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const spoolFile = db.spoolPath();
        const realRead = fs.readFileSync;
        let out = null;
        const host = fakeHost();
        try {
            fs.readFileSync = function (target, ...rest) {
                if (typeof target === 'string' && path.resolve(target) === path.resolve(spoolFile)) {
                    const err = new Error('EACCES: permission denied');
                    err.code = 'EACCES';
                    throw err;
                }
                return realRead.call(this, target, ...rest);
            };
            out = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        } finally {
            fs.readFileSync = realRead;
        }
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'unclearable', JSON.stringify(out));
        assert.ok(/could not be read/.test(out.detail) && /EACCES/.test(out.detail), out.detail);
        assert.deepStrictEqual(host.calls, [], 'the host is never asked about a file nobody could read');
        assert.strictEqual(db.readSpool().usage.length, 1, 'and the line is still there');
    } finally {
        rmStore(store);
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
        db.appendSpool([
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            db.usageEntry('project', store.segment, 'two', 'two.md', 'read'),
            db.usageEntry('project', store.segment, 'three', 'three.md', 'applied')
        ]);
        const host = fakeHost({ resolvesStamps: true });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 3, 'every line left the spool: ' + JSON.stringify(result.summary));
        assert.strictEqual(result.summary.rejected, 2,
            'and the two the host would not record are counted: ' + JSON.stringify(result.summary));
        assert.strictEqual(host.usage.length, 1, 'the host holds only the row it appended');
        assert.ok(db.summaryLine(result.summary).includes(
            '2 spool line(s) the host would not record, off the spool with no row on the host'),
        'the count and what became of those lines are both on the line a person reads: '
            + db.summaryLine(result.summary));
        assert.ok(result.summary.failed.some((f) => f.startsWith('the spool (rejected): ')),
            'and a loss the next run cannot repair is on the failure list: '
            + JSON.stringify(result.summary.failed));

        // The control, withheld from the assertions above: a stamp for a record
        // the host does hold carries no clause at all, so the sentence above is
        // the rejection rather than a line printed always.
        db.appendSpool([
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

// A spool the host refuses is a fact about the spool, not about the host. The
// reachability probe has already had an answer by then, so a run that stood down
// here would report an unreachable host on a line the procedure will refuse the
// same way forever, and no record would ever be published again.
test('a drain refusal leaves the publish running, and the stand-down that remains is the probe\'s', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const host = fakeHost({ fail: ['usp_AppendUsage'] });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 0);
        assert.ok(result.summary.failed.some((f) => /usp_AppendUsage/.test(f)),
            'the refusal is on the summary: ' + JSON.stringify(result.summary.failed));
        assert.ok(host.calls.map((c) => c.procedure).includes('usp_UpsertRecords'),
            'the calls after the drain were made: ' + host.calls.map((c) => c.procedure).join(', '));
        assert.strictEqual(result.summary.added, 1, JSON.stringify(result.summary));
        assert.strictEqual(db.readSpool().usage.length, 1,
            'and the line nothing took is still on the spool for the next run');

        // The control, withheld from the assertion above: a host that will not
        // answer the probe stands the run down under the same word the drain no
        // longer uses, so the stand-down that remains is the one that should.
        const dead = fakeHost({ fail: ['usp_Health'] });
        const stood = await publishWith(store, dead);
        assert.strictEqual(stood.ok, false, JSON.stringify(stood));
        assert.strictEqual(stood.standDown, 'unreachable');
    } finally {
        rmStore(store);
    }
});

// What the three shapes of this class actually print, recorded from ODBC 170
// SQLCMD.EXE version 15.0.1300.359 on win32 against a real SQL Server. They are
// output of that tool at that version rather than a proposal about it, and the
// discriminator below is held to them.
//
// One shape of the class is not among them: a connection the client refuses on
// the certificate. It was not captured, so nothing here states what it prints,
// and it is the one member of this class these fixtures do not cover. What the
// discriminator does with it is the conservative answer either way, since a
// refusal on the certificate never opens a session and so cannot carry a server
// envelope.
const SQLCMD_SERVER_THROW = 'Msg 50000, Level 16, State 1, Server SCOTT-CLAUDE, Line 1\n'
    + 'kit probe: a batch the server refused\n';
const SQLCMD_CLOSED_PORT = 'Sqlcmd: Error: Microsoft ODBC Driver 17 for SQL Server : TCP Provider: '
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
    assert.strictEqual(db.carriesServerMessage(SQLCMD_CLOSED_PORT), false,
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
    assert.strictEqual(byWords(SQLCMD_CLOSED_PORT), true);
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
    assert.strictEqual(db.failureCause(1, SQLCMD_CLOSED_PORT), 'outage');
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
        fs.rmSync(db.spoolPath(), { force: true });
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

// The probe the spec asks for. With an empty spool the first contact would
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
        db.appendSpool([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);
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
        assert.strictEqual(fs.readFileSync(db.spoolPath(), 'utf8').trim().split('\n').length, 1,
            'the spool is untouched by a run that stood down');
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
        assert.ok(locking.length > 0,
            'and this run calls at least one of them: ' + [...takesLock].join(', ') + ' against '
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
        // record batch spend the whole of it and the spool drain after them is
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
            line.includes('the run budget') && line.includes('the spool drain')),
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
// stops a call rather than queuing it, so a busy run would never reach the
// drain at all.
test('the publish drains the spool behind the record upsert and ahead of the embedding, and reports the count', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([
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
            'and the spool goes before the embedding leg, which is the long one a spent deadline '
            + 'stops: ' + order.join(', '));
        assert.strictEqual(fs.statSync(path.join(store.root, 'kit-memory-db-spool.jsonl')).size, 0);
        assert.ok(db.summaryLine(result.summary).includes('2 spool line(s) drained'), db.summaryLine(result.summary));
        assert.strictEqual(result.summary.rejected, 0,
            'and nothing was rejected, since the record existed by the time its stamps went: '
            + JSON.stringify(result.summary));
    } finally {
        rmStore(store);
    }
});

// The loss the order above exists to prevent, driven end to end. This is the
// first publish from a machine that has never published: the host holds no
// record at all, and every stamp on the spool names one of them.
test('a stamp for a record the host does not yet hold is written rather than rejected', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'fresh-record', '# a fresh record\n\na body\n');
        db.appendSpool([
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
        db.appendSpool([
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

test('a host that refuses the record upsert stands the run down and spools nothing', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const host = fakeHost({ fail: ['usp_UpsertRecords'] });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, false, JSON.stringify(result));
        assert.strictEqual(result.standDown, 'unreachable');
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-spool.jsonl')),
            'a failed record upsert is never spooled: the next walk re-derives it from the file');
        assert.ok(db.standDownText(result).includes('usp_UpsertRecords'), db.standDownText(result));
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
        'server, database, login, password, timeoutMs, windowsAuth,',
        'if (!config.windowsAuth) env.SQLCMDPASSWORD = config.password;'
    ], 'the password is read, checked for presence, carried on the config and handed to the child\'s '
        + 'environment; anything else here is a new path for it to leak by: ' + JSON.stringify(uses));
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
        ['./kit-endpoint-lib.js', './memory-index.js', './memq.js'],
        'and the siblings it loads are these three: ' + JSON.stringify(loads));
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
// verb's own result. A run that left a refused drain or a spool of unreadable
// bytes has to be tellable from a clean one.
test('memq db-sync exits non-zero on a run that left a failure, and zero on a note alone', async () => {
    // The two summaries come from real publishes rather than being written out
    // here, so the shape the verb reads is the shape the client produces.
    const store = makeStore();
    let keptSummary = null;
    let racedSummary = null;
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);
        fs.appendFileSync(db.spoolPath(), Buffer.from([0xFF, 0xFE, 0xFF, 0x0A]));
        keptSummary = (await publishWith(store, fakeHost())).summary;
        assert.ok(keptSummary.failed.some((f) => f.startsWith('the spool (malformed): ')),
            JSON.stringify(keptSummary.failed));

        fs.rmSync(db.spoolPath(), { force: true });
        db.appendSpool([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'applied')]);
        let appended = 0;
        const racing = fakeHost({
            onCall: (call) => {
                if (call.procedure !== 'usp_AppendUsage' || appended > 0) return;
                appended += 1;
                db.appendSpool([db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read')]);
            }
        });
        racedSummary = (await publishWith(store, racing)).summary;
        assert.strictEqual(appended, 1, 'this case needs the race to happen');
        assert.deepStrictEqual(racedSummary.failed, [], JSON.stringify(racedSummary.failed));
        assert.ok(racedSummary.notes.some((n) => n.startsWith('the spool (raced): ')),
            JSON.stringify(racedSummary.notes));
    } finally {
        rmStore(store);
    }

    // The predicate the verb asks, in both directions and at its edges.
    assert.strictEqual(db.publishFailed(keptSummary), true);
    assert.strictEqual(db.publishFailed(racedSummary), false,
        'a note is not a failure, or every busy publish fails');
    assert.strictEqual(db.publishFailed({ failed: [], notes: ['a note'] }), false);
    assert.strictEqual(db.publishFailed({ failed: ['a reason'] }), true);
    assert.strictEqual(db.publishFailed(undefined), false);

    // And the verb itself, run as a child with those same summaries in place of
    // a host: the publish is replaced at the module the CLI loads, so everything
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

        const kept = runWith(keptSummary);
        assert.strictEqual(kept.status, 1, kept.stdout + kept.stderr);
        assert.ok(/db-sync: /.test(kept.stdout), 'the summary still prints: ' + kept.stdout);
        assert.ok(/the spool \(malformed\)/.test(kept.stderr), kept.stderr);

        const raced = runWith(racedSummary);
        assert.strictEqual(raced.status, 0,
            'an append landing during a publish is no reason to fail the run: '
            + raced.stdout + raced.stderr);
        assert.ok(/db-sync: /.test(raced.stdout), raced.stdout);
        assert.ok(/still on the spool/.test(raced.stdout),
            'and the count is still on the line a person reads: ' + raced.stdout);
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
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-spool.jsonl')));
    } finally {
        rmHomeStore(store);
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
// stamp is spooled under: the spool is drained by a publish that presents this
// machine's credential, so a redirected store would grow one nothing drains.
test('with the host unreachable, memq touch still stamps the sidecar and leaves one spool line', () => {
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

        const spool = fs.readFileSync(path.join(store.root, 'kit-memory-db-spool.jsonl'), 'utf8').trim().split('\n');
        assert.strictEqual(spool.length, 1, 'and the stamp the host did not take is spooled');
        const line = JSON.parse(spool[0]);
        assert.strictEqual(line.type, 'usage');
        assert.strictEqual(line.kind, 'applied');
        assert.strictEqual(line.fileKey, 'a-record.md');
        assert.strictEqual(line.tier, 'project');
        assert.strictEqual(line.segment, store.segment);

        // Then the drain, in process against a host that answers: the line
        // reaches the procedure and the file goes away. The store root moves
        // to the child's for the length of the drain, since that is where the
        // spool it wrote sits.
        const host = fakeHost();
        const before = { root: process.env.KIT_MEMORY_ROOT, allow: process.env.KIT_MEMORY_ROOT_ALLOW_DATA };
        process.env.KIT_MEMORY_ROOT = store.root;
        process.env.KIT_MEMORY_ROOT_ALLOW_DATA = '1';
        let drained = null;
        try {
            drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch }, schemaVersion: db.REQUIRED_SCHEMA_VERSION });
        } finally {
            if (before.root === undefined) delete process.env.KIT_MEMORY_ROOT;
            else process.env.KIT_MEMORY_ROOT = before.root;
            if (before.allow === undefined) delete process.env.KIT_MEMORY_ROOT_ALLOW_DATA;
            else process.env.KIT_MEMORY_ROOT_ALLOW_DATA = before.allow;
        }
        assert.deepStrictEqual(drained, { ok: true, drained: 1, remaining: 0, malformed: 0, rejected: 0 });
        assert.strictEqual(host.usage.length, 1);
        assert.strictEqual(host.usage[0].fileKey, 'a-record.md');
    } finally {
        rmHomeStore(store);
    }
});

test('memq log writes the journal line and spools the outcome the host did not take', () => {
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
        const spool = fs.readFileSync(path.join(store.root, 'kit-memory-db-spool.jsonl'), 'utf8').trim().split('\n');
        assert.strictEqual(spool.length, 1);
        const line = JSON.parse(spool[0]);
        assert.strictEqual(line.type, 'outcome');
        assert.strictEqual(line.actionKey, 'an-action');
        assert.strictEqual(line.result, 'pass');
        assert.strictEqual(line.summary, 'it worked');
        assert.strictEqual(line.segment, store.segment);
    } finally {
        rmHomeStore(store);
    }
});
