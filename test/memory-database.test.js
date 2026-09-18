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
            // The real procedure drops a stamp whose record it cannot resolve
            // and answers with the count rather than the identity, so `rejected`
            // here takes that many rows off the front of each call and keeps the
            // rest. mem.usp_AppendOutcomes has no such disposition and answers
            // with `appended` alone, which is why only this one carries it.
            const rows = call.parameters['@p_Usage'];
            const rejected = Math.min(opts.rejected || 0, rows.length);
            for (const row of rows.slice(rejected)) host.usage.push(row);
            return { ok: true, rows: [{ appended: rows.length - rejected, rejected }] };
        }
        if (call.procedure === 'usp_AppendOutcomes') {
            for (const row of call.parameters['@p_Outcomes']) host.outcomes.push(row);
            return { ok: true, rows: [{ appended: call.parameters['@p_Outcomes'].length }] };
        }
        if (call.procedure === 'usp_Health') {
            return { ok: true, rows: [{ schemaVersion: 1, sharedRecords: host.records.size, sandboxes: [] }] };
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
            const rows = call.parameters['@p_Embeddings'];
            host.embedCalls.push(rows);
            for (const row of rows) {
                for (const record of host.records.values()) {
                    if (record.recordId === row.recordId) {
                        record.embedded = true;
                        record.model = row.model;
                    }
                }
            }
            return { ok: true, rows: [{ inserted: rows.length, updated: 0 }] };
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
        db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.ok(host.calls.length > 0, 'the control must reach the transport');
    } finally {
        rmDefaultStore(store);
    }
});

// ------------------------------------------------------------------ the spool --

test('the drain removes what it delivered and nothing else: a call nothing landed from leaves the file byte-identical', () => {
    const store = makeStore();
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
        const before = fs.readFileSync(spoolFile);

        // Both procedures refused, since each is attempted whatever the other
        // answered: a drain nothing landed from must leave the file exactly as
        // it was.
        const refusing = fakeHost({ fail: ['usp_AppendUsage', 'usp_AppendOutcomes'] });
        const failed = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch } });
        assert.strictEqual(failed.ok, false, JSON.stringify(failed));
        assert.strictEqual(failed.drained, 0);
        assert.deepStrictEqual(fs.readFileSync(spoolFile), before,
            'a stamp delivered nowhere and deleted anyway is the loss this mechanism exists to prevent');

        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(drained, { ok: true, drained: 2, malformed: 0, rejected: 0 });
        assert.ok(!fs.existsSync(spoolFile), 'a fully delivered spool is removed');
        assert.strictEqual(host.usage.length, 1);
        assert.strictEqual(host.outcomes.length, 1);
        assert.strictEqual(host.outcomes[0].actionKey, 'an-action');
    } finally {
        rmStore(store);
    }
});

// The half-delivered drain. The spool is two deliveries, one procedure each,
// and a file left whole after the first landed sends those rows again on the
// next drain. Both append procedures are plain inserts with no dedupe, so the
// host would then hold two rows for one memory read, which every applied
// tally and decay reading is computed from.
test('a drain that delivered one procedure and lost the other keeps only the undelivered lines', () => {
    const store = makeStore();
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.usageEntry('project', store.segment, 'two', 'two.md', 'applied'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');

        const refusing = fakeHost({ fail: ['usp_AppendOutcomes'] });
        const partial = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch } });
        assert.strictEqual(partial.ok, false, JSON.stringify(partial));
        assert.strictEqual(partial.drained, 2, 'the usage rows landed and are counted');
        assert.strictEqual(refusing.usage.length, 2);

        const left = db.readSpool();
        assert.strictEqual(left.usage.length, 0, 'the delivered usage lines are gone: '
            + fs.readFileSync(spoolFile, 'utf8'));
        assert.strictEqual(left.outcomes.length, 1, 'and the line nothing took is still there');
        assert.strictEqual(left.outcomes[0].actionKey, 'an-action');

        // The next drain against a host that answers sends the outcome and
        // nothing else, which is the property this case exists for: no usage
        // row reaches the host twice.
        const host = fakeHost();
        const rest = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(rest, { ok: true, drained: 1, malformed: 0, rejected: 0 });
        assert.strictEqual(host.usage.length, 0, 'a usage row already on the host is never sent again');
        assert.strictEqual(host.outcomes.length, 1);
        assert.ok(!fs.existsSync(spoolFile));
    } finally {
        rmStore(store);
    }
});

// The spool's byte prefix, read from the file's bytes rather than from a
// decoded string. A torn append leaves bytes that are not valid UTF-8, every
// one of which decodes to U+FFFD at three bytes where the original was one or
// two, so a length taken from the decoded text addresses a position the file
// does not have and the cut lands mid-line.
test('a spool line with invalid UTF-8 in it is counted, dropped, and does not move the cut', () => {
    const store = makeStore();
    try {
        const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        // A torn line: raw bytes no decoder can read, between two good lines.
        fs.appendFileSync(spoolFile, Buffer.from([0xFF, 0xFE, 0xFF, 0x0A]));
        db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);

        const read = db.readSpool();
        assert.strictEqual(read.malformed, 1, 'the unreadable line is counted rather than passed over');
        assert.strictEqual(read.usage.length, 2);
        assert.strictEqual(read.bytes, fs.statSync(spoolFile).size,
            'the prefix is a byte offset into the file, not a length of decoded text');

        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(drained, { ok: true, drained: 2, malformed: 1, rejected: 0 },
            'the malformed count reaches the caller rather than vanishing');
        assert.strictEqual(host.usage.length, 2);
        assert.ok(!fs.existsSync(spoolFile), 'a drain that consumed the whole file removes it');
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
            assert.ok(result.summary.failed.some((f) => /holds the spool lock/.test(f)),
                'contention has its own word: ' + JSON.stringify(result.summary.failed));
            assert.ok(!result.summary.failed.some((f) => /did not answer/.test(f)),
                'and it is never reported as a host that did not answer');
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

// A drain that delivered and could not clear the file is the one state that
// costs the host a duplicate row, so a reader has to hear about it.
test('a drain that delivered and could not clear the spool says so on the publish summary', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const realAppend = fs.appendFileSync;
        const realUnlink = fs.unlinkSync;
        const spoolFile = db.spoolPath();
        // The spool and the file the drain rotates it to, both refused: what
        // the drain does with the delivered lines is take that file away, and
        // a file it could not take away is one the next drain folds back and
        // sends again.
        const refuse = (target) => {
            if (typeof target === 'string' && path.resolve(target).startsWith(path.resolve(spoolFile))) {
                const err = new Error('EPERM: operation not permitted');
                err.code = 'EPERM';
                throw err;
            }
            return false;
        };
        fs.appendFileSync = function (target, ...rest) { refuse(target); return realAppend.call(this, target, ...rest); };
        fs.unlinkSync = function (target, ...rest) { refuse(target); return realUnlink.call(this, target, ...rest); };
        let result = null;
        try {
            const host = fakeHost();
            result = await publishWith(store, host);
        } finally {
            fs.appendFileSync = realAppend;
            fs.unlinkSync = realUnlink;
        }
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 1);
        assert.ok(result.summary.failed.some((f) => /could not be cleared/.test(f)),
            'the drain detail must reach a reader: ' + JSON.stringify(result.summary.failed));
    } finally {
        rmStore(store);
    }
});

// A spool the drain can read nothing deliverable out of. One torn line from a
// disk-full write is enough to reach it, and a drain that answered a refusal
// there would leave the file exactly as it found it: every future publish would
// then stand the whole run down on the same unreadable file, for good, until
// somebody deleted it by hand.
test('a spool holding nothing but malformed lines is cleared rather than left to wedge every run', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
        fs.writeFileSync(spoolFile, 'not json at all\n{"type":"neither"}\n', 'utf8');

        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(drained, { ok: true, drained: 0, malformed: 2, rejected: 0 },
            'the unreadable lines are counted and the drain is a success of zero lines');
        assert.deepStrictEqual(host.calls, [], 'nothing is sent, since there is nothing a procedure could read');
        assert.ok(!fs.existsSync(spoolFile), 'and the file is gone, so the next run starts clean');

        // The publish leg, which is where the wedge was: a run standing down on
        // this condition reports the host as unreachable and publishes nothing.
        fs.writeFileSync(spoolFile, 'torn\n', 'utf8');
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.malformed, 1, JSON.stringify(result.summary));
        assert.strictEqual(result.summary.added, 1, 'the run goes on to publish: ' + JSON.stringify(result.summary));
        assert.ok(db.summaryLine(result.summary).includes('unreadable spool line'), db.summaryLine(result.summary));
    } finally {
        rmStore(store);
    }
});

// The lock's staleness sits between two defects. Below the calls the drain holds
// it across, a second publisher finds the lock stale, breaks it, reads the same
// lines and delivers them again, and both then write the file from their own
// reads; that is why it is the run's own budget rather than the helper's default.
// Above the longest a live holder can hold it, a publisher killed mid-drain
// leaves a lock no live publisher could be holding, and every session-start
// publish from the re-arm until that lock ages out reports contention and drains
// nothing. The ceiling is what the configured timeout is clamped to, since that
// value is the operator's and is accepted up to ten minutes.
test('the spool lock outlives the calls the drain holds it across and never outlives its holder', () => {
    const store = makeStore();
    try {
        const seen = [];
        const memq = require(MEMQ);
        const realAcquire = memq.acquireLock;
        memq.acquireLock = function (target, options) {
            seen.push({ target, options });
            return realAcquire.call(this, target, options);
        };
        try {
            db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
            const host = fakeHost();
            db.drainSpool(config({ timeoutMs: 600000 }), { deps: { runBatch: host.runBatch } });
        } finally {
            memq.acquireLock = realAcquire;
        }
        const taken = seen.find((s) => String(s.target).endsWith('kit-memory-db-spool.lock'));
        assert.ok(taken, 'the drain takes the spool lock: ' + JSON.stringify(seen.map((s) => s.target)));
        assert.ok(taken.options, 'the drain asks for a staleness: ' + JSON.stringify(taken));
        assert.strictEqual(taken.options.staleMs, db.DRAIN_LOCK_STALE_CEILING_MS,
            'a timeout that would fund two spawns past the ceiling is clamped to it: '
            + JSON.stringify(taken.options));
        assert.ok(db.DRAIN_LOCK_STALE_CEILING_MS < 2 * (600000 + 2000),
            'and this case only says something while that timeout is the larger of the two: '
            + db.DRAIN_LOCK_STALE_CEILING_MS);

        // The floor, withheld from the assertion above: a short timeout does
        // not shorten the staleness below the helper's own default, since a
        // lock broken early is the defect this number exists to prevent.
        seen.length = 0;
        memq.acquireLock = function (target, options) {
            seen.push({ target, options });
            return realAcquire.call(this, target, options);
        };
        try {
            db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'read')]);
            const host = fakeHost();
            db.drainSpool(config({ timeoutMs: 1000 }), { deps: { runBatch: host.runBatch } });
        } finally {
            memq.acquireLock = realAcquire;
        }
        const short = seen.find((s) => String(s.target).endsWith('kit-memory-db-spool.lock'));
        assert.strictEqual(short.options.staleMs, 60000, JSON.stringify(short.options));
    } finally {
        rmStore(store);
    }
});

test('a stamp appended while the drain is in flight survives it', () => {
    const store = makeStore();
    const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
    try {
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        let sawDuringCall = null;
        const host = fakeHost({
            onCall: () => {
                // The interactive path never waits on the drain's lock, so this
                // is the ordinary case rather than a contrived one: a stamp can
                // land at any moment of a drain.
                sawDuringCall = fs.existsSync(spoolFile) ? fs.readFileSync(spoolFile, 'utf8') : '';
                db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
            }
        });
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(drained, { ok: true, drained: 1, malformed: 0, rejected: 0 });
        assert.strictEqual(sawDuringCall, '',
            'the lines under delivery are rotated aside, so an appender writes a fresh file rather than '
            + 'one this drain is about to write back: ' + JSON.stringify(sawDuringCall));
        const left = db.readSpool();
        assert.strictEqual(left.usage.length, 1, 'the late stamp is still in the file: ' + fs.readFileSync(spoolFile, 'utf8'));
        assert.strictEqual(left.usage[0].fileKey, 'two.md');
    } finally {
        rmStore(store);
    }
});

// The window the rotation closes, entered on purpose. A drain that read the
// spool and wrote it back whole would lose anything appended between those two
// calls, and no arrangement of the case above can land inside that window: it
// appends during the call, which is before the read. So this one appends at the
// drain's own last write to the file, which is the last instant of the window.
test('a stamp appended at the drain\'s own write-back is not overwritten by it', () => {
    const store = makeStore();
    const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        // The outcome call fails, so the drain has an undelivered line to put
        // back and really does write the live file on its way out.
        const host = fakeHost({ fail: ['usp_AppendOutcomes'] });
        const realAppend = fs.appendFileSync;
        const realWrite = fs.writeFileSync;
        let injected = 0;
        const inject = (target) => {
            if (injected > 0) return;
            if (typeof target !== 'string' || path.resolve(target) !== path.resolve(spoolFile)) return;
            injected += 1;
            realAppend.call(fs, spoolFile,
                JSON.stringify(db.usageEntry('project', store.segment, 'late', 'late.md', 'applied')) + '\n', 'utf8');
        };
        fs.appendFileSync = function (target, ...rest) { inject(target); return realAppend.call(this, target, ...rest); };
        fs.writeFileSync = function (target, ...rest) { inject(target); return realWrite.call(this, target, ...rest); };
        let drained = null;
        try {
            drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        } finally {
            fs.appendFileSync = realAppend;
            fs.writeFileSync = realWrite;
        }
        assert.strictEqual(injected, 1, 'the case must actually reach the drain\'s write-back');
        assert.strictEqual(drained.drained, 1, JSON.stringify(drained));

        const left = db.readSpool();
        const keys = left.usage.map((u) => u.fileKey).sort();
        assert.deepStrictEqual(keys, ['late.md'], 'the stamp written inside the window is still there: '
            + fs.readFileSync(spoolFile, 'utf8'));
        assert.strictEqual(left.outcomes.length, 1, 'and the undelivered outcome went back beside it');
    } finally {
        rmStore(store);
    }
});

// The window the rotation really leaves, which is not the one the case above
// enters. An appender that opened the spool before the rename holds that file
// through it and writes into the file the drain has already read, past
// everything that read consumed. Those bytes are unlinked with the rotated file
// unless the write-back reads it again on its way out, and a stamp deleted from
// a machine where nothing delivered it is the loss the spool exists to prevent.
test('a line written through a pre-rename handle after the drain\'s read comes back on the live spool', () => {
    const store = makeStore();
    const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
    try {
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        // The appender's own handle, opened before the drain runs and never
        // reopened. A rename moves the file out from under a handle rather than
        // invalidating it, so every write through this one lands in the rotated
        // file however the live path is spelled afterwards.
        const fd = fs.openSync(spoolFile, 'a');
        let wrote = false;
        let drained = null;
        try {
            const host = fakeHost({
                onCall: () => {
                    // The rotation and the read are both behind the drain by the
                    // time it reaches a procedure call, so this is the window
                    // itself: the bytes land past the read's own cut.
                    if (wrote) return;
                    wrote = true;
                    fs.writeSync(fd, JSON.stringify(
                        db.usageEntry('project', store.segment, 'late', 'late.md', 'applied')) + '\n');
                }
            });
            drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        } finally {
            fs.closeSync(fd);
        }
        assert.strictEqual(wrote, true, 'the case must write inside the window it is about');
        assert.deepStrictEqual(drained, { ok: true, drained: 1, malformed: 0, rejected: 0 },
            'the line the drain read is delivered: ' + JSON.stringify(drained));

        const left = db.readSpool();
        assert.deepStrictEqual(left.usage.map((u) => u.fileKey), ['late.md'],
            'the stamp written through the pre-rename handle is on the live spool, so the next drain '
            + 'delivers it: ' + (fs.existsSync(spoolFile) ? fs.readFileSync(spoolFile, 'utf8') : '<no spool file>'));
    } finally {
        rmStore(store);
    }
});

// The count the procedure answers with, which is the only thing that says a
// stamp reached no row. mem.usp_AppendUsage drops a stamp whose record it
// cannot resolve, reports how many it dropped, and takes the rest of the batch,
// so a drain reading its own success alone would delete those lines and report
// them delivered.
test('a drain reports the rows the host declined, and the summary line names them', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.usageEntry('project', store.segment, 'two', 'two.md', 'read'),
            db.usageEntry('project', store.segment, 'three', 'three.md', 'applied')
        ]);
        const host = fakeHost({ rejected: 2 });
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        assert.strictEqual(result.summary.drained, 3, 'every line left the spool: ' + JSON.stringify(result.summary));
        assert.strictEqual(result.summary.rejected, 2,
            'and the two the host would not record are counted: ' + JSON.stringify(result.summary));
        assert.strictEqual(host.usage.length, 1, 'the host holds only the row it appended');
        assert.ok(db.summaryLine(result.summary).includes('2 spool line(s) the host would not record'),
            db.summaryLine(result.summary));

        // The control, withheld from the assertions above: the same three lines
        // against a host that declines nothing carry no clause at all, so the
        // sentence above is the rejection rather than a line printed always.
        db.appendSpool([
            db.usageEntry('project', store.segment, 'four', 'four.md', 'read')
        ]);
        const clean = await publishWith(store, fakeHost());
        assert.strictEqual(clean.summary.rejected, 0, JSON.stringify(clean.summary));
        assert.ok(!db.summaryLine(clean.summary).includes('would not record'), db.summaryLine(clean.summary));
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

// The spool grows without a ceiling while a host is away, and one call for the
// whole of it is a call that gets longer every run until it cannot finish inside
// any timeout. Batched, what a refusal costs is the batch it refused and nothing
// else: every other batch of that procedure still goes, the other procedure
// still goes, and the refused batch alone is what the file holds afterwards.
test('the drain sends each procedure in batches, and a refused batch costs that batch alone', () => {
    const store = makeStore();
    try {
        const batch = db.DRAIN_BATCH;
        const entries = [];
        for (let at = 0; at < batch + 3; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        entries.push(db.outcomeEntry(store.segment,
            { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' }));
        db.appendSpool(entries);

        const host = fakeHost();
        const served = host.runBatch;
        let usageCalls = 0;
        host.runBatch = (cfg, text, callOptions) => {
            if (parseCall(text).procedure === 'usp_AppendUsage') {
                usageCalls += 1;
                if (usageCalls === 2) {
                    return { ok: false, cause: 'refused', detail: 'the host refused the second batch' };
                }
            }
            return served(cfg, text, callOptions);
        };
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.strictEqual(drained.ok, false, JSON.stringify(drained));
        assert.strictEqual(usageCalls, 2, 'the spool went in batches rather than in one call');
        assert.strictEqual(drained.drained, batch + 1,
            'the first batch and the outcome landed and are counted: ' + JSON.stringify(drained));
        assert.strictEqual(host.usage.length, batch);
        for (const call of host.calls.filter((c) => c.procedure === 'usp_AppendUsage')) {
            assert.ok(call.parameters['@p_Usage'].length <= batch,
                'no call carries more than one batch: ' + call.parameters['@p_Usage'].length);
        }
        assert.strictEqual(host.outcomes.length, 1,
            'and a usage refusal never stands the outcome call down, since the refusal is a fact '
            + 'about those lines and not about the host');

        const left = db.readSpool();
        assert.deepStrictEqual(left.usage.map((u) => u.fileKey),
            ['r' + batch + '.md', 'r' + (batch + 1) + '.md', 'r' + (batch + 2) + '.md'],
            'the refused batch went back, and the delivered ones did not');
        assert.strictEqual(left.outcomes.length, 0, 'the outcome the host took is gone');

        // The next drain against a host that answers takes what is left and
        // nothing else: no line the host already holds is sent twice.
        const second = fakeHost();
        const rest = db.drainSpool(config(), { deps: { runBatch: second.runBatch } });
        assert.deepStrictEqual(rest, { ok: true, drained: 3, malformed: 0, rejected: 0 });
        assert.strictEqual(second.usage.length, 3);
        assert.strictEqual(second.outcomes.length, 0);
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-spool.jsonl')));
    } finally {
        rmStore(store);
    }
});

// The poisonous batch, which is the state the put-back rule exists for. A batch
// mem.usp_AppendUsage throws over is a contract defect between this client and
// that procedure: every writer emits read or applied with a fresh timestamp, so
// a line the procedure will not read is a bug or a version skew rather than an
// operational state, and it is refused the same way on every future run. Left in
// front of the queue it would be batch one for good and nothing would ever drain
// again. So the batches behind it still go, the other procedure still goes, and
// what stays on the file is that batch alone.
test('a refused batch is put back alone while the batches behind it drain, and the other procedure still goes', () => {
    const store = makeStore();
    try {
        const batch = db.DRAIN_BATCH;
        const entries = [];
        for (let at = 0; at < batch + 2; at += 1) {
            entries.push(db.usageEntry('project', store.segment, 'r' + at, 'r' + at + '.md', 'read'));
        }
        entries.push(db.outcomeEntry(store.segment,
            { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' }));
        db.appendSpool(entries);
        const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');

        // The first usage batch alone is refused, which puts the poison at the
        // head of the queue where a prefix rule cannot express the truth.
        const host = fakeHost();
        const served = host.runBatch;
        let usageCalls = 0;
        host.runBatch = (cfg, text, callOptions) => {
            if (parseCall(text).procedure === 'usp_AppendUsage') {
                usageCalls += 1;
                if (usageCalls === 1) {
                    return { ok: false, cause: 'refused', detail: 'kind was neither read nor applied' };
                }
            }
            return served(cfg, text, callOptions);
        };
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.strictEqual(drained.ok, false, JSON.stringify(drained));
        assert.strictEqual(drained.drained, 3,
            'the healthy batch and the outcome landed: ' + JSON.stringify(drained));
        assert.deepStrictEqual(host.usage.map((u) => u.fileKey), ['r' + batch + '.md', 'r' + (batch + 1) + '.md'],
            'the batch behind the refused one went, and only it');
        assert.strictEqual(host.outcomes.length, 1, 'and the other procedure was attempted rather than skipped');
        assert.ok(/usp_AppendUsage/.test(drained.detail),
            'the refusal names the procedure: ' + drained.detail);
        assert.ok(/kind was neither read nor applied/.test(drained.detail),
            'and carries the host\'s own words: ' + drained.detail);

        const left = db.readSpool();
        assert.strictEqual(left.outcomes.length, 0, 'the delivered outcome is gone');
        assert.deepStrictEqual(left.usage.map((u) => u.fileKey),
            entries.slice(0, batch).map((e) => e.fileKey),
            'the refused batch is back whole and in order, and nothing else is');

        // The no-duplicate pin, which is what the non-prefix put-back is for: a
        // second drain against a host that answers sends exactly the lines the
        // first one did not deliver. A count-based put-back would send the two
        // rows already on the host a second time, and both append procedures are
        // plain inserts with no dedupe.
        const second = fakeHost();
        const rest = db.drainSpool(config(), { deps: { runBatch: second.runBatch } });
        assert.deepStrictEqual(rest, { ok: true, drained: batch, malformed: 0, rejected: 0 });
        assert.deepStrictEqual(second.usage.map((u) => u.fileKey),
            entries.slice(0, batch).map((e) => e.fileKey),
            'exactly the refused batch, never a line the host already holds');
        assert.strictEqual(second.outcomes.length, 0, 'and no outcome, since the first drain delivered it');
        assert.ok(!fs.existsSync(spoolFile));
    } finally {
        rmStore(store);
    }
});

// A drain that delivered nothing still consumed the lines no procedure can read,
// since putBack keeps only the readable undelivered ones. Reported as zero, a
// torn line would be destroyed and counted nowhere, which is the silent loss the
// malformed count exists to prevent.
test('a drain that delivered nothing reports the unreadable lines it dropped rather than zero', () => {
    const store = makeStore();
    try {
        const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
        fs.writeFileSync(spoolFile, 'not json at all\n', 'utf8');
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);

        const refusing = fakeHost({ fail: ['usp_AppendUsage'] });
        const drained = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch } });
        assert.strictEqual(drained.ok, false, JSON.stringify(drained));
        assert.strictEqual(drained.drained, 0);
        assert.strictEqual(drained.malformed, 1,
            'the line the drain destroyed is counted: ' + JSON.stringify(drained));
        assert.ok(/usp_AppendUsage/.test(drained.detail), drained.detail);
        assert.strictEqual(db.readSpool().usage.length, 1, 'and the refused line is back');
    } finally {
        rmStore(store);
    }
});

// Two failures at once, each with its own remedy: a host that would not take the
// lines, and a disk that would not take them back. Reported as the refusal alone,
// a spool that could not be restored reads as a contract defect and the lines
// that vanished with the rotated file are accounted for nowhere.
test('a refusal and a spool that could not be restored are both carried out', () => {
    const store = makeStore();
    try {
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const realAppend = fs.appendFileSync;
        const realUnlink = fs.unlinkSync;
        const spoolFile = db.spoolPath();
        const refuse = (target) => {
            if (typeof target === 'string' && path.resolve(target).startsWith(path.resolve(spoolFile))) {
                const err = new Error('EPERM: operation not permitted');
                err.code = 'EPERM';
                throw err;
            }
            return false;
        };
        let drained = null;
        try {
            fs.appendFileSync = function (target, ...rest) { refuse(target); return realAppend.call(this, target, ...rest); };
            fs.unlinkSync = function (target, ...rest) { refuse(target); return realUnlink.call(this, target, ...rest); };
            const refusing = fakeHost({ fail: ['usp_AppendUsage'] });
            drained = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch } });
        } finally {
            fs.appendFileSync = realAppend;
            fs.unlinkSync = realUnlink;
        }
        assert.strictEqual(drained.ok, false, JSON.stringify(drained));
        assert.ok(/usp_AppendUsage/.test(drained.detail), 'the host\'s refusal is there: ' + drained.detail);
        assert.ok(/could not be cleared/.test(drained.detail),
            'and the disk failure beside it, since a reader told only one of them fixes the wrong thing: '
            + drained.detail);
    } finally {
        rmStore(store);
    }
});

// The file a drain that died mid-flight left aside holds lines nothing
// delivered, and the fold-back at the head of the next drain is the only thing
// that ever gives them back. A fold-back that failed quietly would leave them
// there and let the rotation behind it rename the live spool over that file,
// and a rename replaces an existing destination: those lines would be destroyed
// and counted nowhere, which is the silent loss the whole spool exists to
// prevent.
test('a leftover the drain could not fold back stops it before the rotation, with the lines still there', () => {
    const store = makeStore();
    try {
        const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
        const asideFile = spoolFile + '.draining';
        db.appendSpool([db.usageEntry('project', store.segment, 'live', 'live.md', 'read')]);
        const leftover = JSON.stringify(
            db.usageEntry('project', store.segment, 'left', 'left.md', 'applied')) + '\n';
        fs.writeFileSync(asideFile, leftover, 'utf8');

        const realAppend = fs.appendFileSync;
        let drained = null;
        const host = fakeHost();
        try {
            // The live file refuses the write, which is where the fold-back puts
            // the leftover lines. The rotated file is left writable, so nothing
            // about this case depends on which of the two the drain touches
            // second.
            fs.appendFileSync = function (target, ...rest) {
                if (typeof target === 'string' && path.resolve(target) === path.resolve(spoolFile)) {
                    const err = new Error('ENOSPC: no space left on device');
                    err.code = 'ENOSPC';
                    throw err;
                }
                return realAppend.call(this, target, ...rest);
            };
            drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        } finally {
            fs.appendFileSync = realAppend;
        }
        assert.strictEqual(drained.ok, false, JSON.stringify(drained));
        assert.ok(/fold/.test(drained.detail),
            'the drain reports what it could not fold back: ' + drained.detail);
        assert.deepStrictEqual(host.calls, [],
            'and sends nothing, since a drain that stops here never rotates: '
            + host.calls.map((c) => c.procedure).join(', '));
        assert.strictEqual(fs.readFileSync(asideFile, 'utf8'), leftover,
            'the lines nothing delivered are still in the file aside');
        assert.deepStrictEqual(db.readSpool().usage.map((u) => u.fileKey), ['live.md'],
            'and the live spool is whole beside it: '
            + (fs.existsSync(spoolFile) ? fs.readFileSync(spoolFile, 'utf8') : '<no spool file>'));

        // The control, withheld from the assertions above: the same two files
        // with the append allowed fold back and drain together, so the failure
        // above is the append rather than a fixture that never reached the
        // fold-back at all.
        const second = fakeHost();
        const ok = db.drainSpool(config(), { deps: { runBatch: second.runBatch } });
        assert.deepStrictEqual(ok, { ok: true, drained: 2, malformed: 0, rejected: 0 });
        assert.deepStrictEqual(second.usage.map((u) => u.fileKey).sort(), ['left.md', 'live.md']);
        assert.ok(!fs.existsSync(asideFile), 'the folded-back file is taken away');
        assert.ok(!fs.existsSync(spoolFile), 'and the drained spool with it');
    } finally {
        rmStore(store);
    }
});

// A host that went away and a procedure that refuses a batch answer the send
// loop with the same false, and their dispositions are opposites: a refusal is
// a contract defect whose remedy is a fix to what this client sends, with the
// spool's growth as the signal, while an outage is a host to wait out and the
// same spool growth is expected. Reported alike, a blinking host opens defects
// that are not real.
test('a host that stops answering mid-drain is an outage, and a batch the procedure refuses is a refusal', () => {
    const store = makeStore();
    try {
        db.appendSpool([
            db.usageEntry('project', store.segment, 'one', 'one.md', 'read'),
            db.outcomeEntry(store.segment, { key: 'an-action', outcome: 'pass', summary: 'it worked', ts: '2026-09-17T00:00:00.000Z' })
        ]);
        const gone = fakeHost();
        const served = gone.runBatch;
        const attempted = [];
        gone.runBatch = (cfg, text, callOptions) => {
            const call = parseCall(text);
            attempted.push(call.procedure);
            if (call.procedure === 'usp_AppendUsage') {
                return {
                    ok: false,
                    cause: 'outage',
                    detail: 'sqlcmd exited 1: TCP Provider: No connection could be made'
                };
            }
            return served(cfg, text, callOptions);
        };
        const out = db.drainSpool(config(), { deps: { runBatch: gone.runBatch } });
        assert.strictEqual(out.ok, false, JSON.stringify(out));
        assert.strictEqual(out.cause, 'outage',
            'the drain carries the cause out rather than one false for both: ' + JSON.stringify(out));
        assert.ok(!/refused/.test(out.detail),
            'and never words a silent host as a refusal: ' + out.detail);
        assert.deepStrictEqual(attempted, ['usp_AppendUsage'],
            'nothing after it is attempted, since a host that has gone refuses every batch behind it '
            + 'at a spawn apiece: ' + attempted.join(', '));
        assert.strictEqual(out.drained, 0);
        const left = db.readSpool();
        assert.deepStrictEqual(left.usage.map((u) => u.fileKey), ['one.md']);
        assert.strictEqual(left.outcomes.length, 1, 'and every line is back for the next run');

        // The control, withheld from the assertions above: the same procedure
        // answering the same false, refused rather than unreachable, is reported
        // as the defect it is and leaves the other procedure running.
        const refusing = fakeHost({ fail: ['usp_AppendUsage'] });
        const no = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch } });
        assert.strictEqual(no.ok, false, JSON.stringify(no));
        assert.strictEqual(no.cause, 'refused', JSON.stringify(no));
        assert.ok(/usp_AppendUsage refused/.test(no.detail), no.detail);
        assert.strictEqual(refusing.outcomes.length, 1,
            'a refusal is a fact about those lines and stands nothing else down');
    } finally {
        rmStore(store);
    }
});

// The discriminator itself, which cannot be a match on the message's words. A
// closed port, a login rejected and a certificate refused all exit non-zero and
// all print prose about a refusal; what tells them from a batch the server
// rejected is the envelope sqlcmd prints around a message that came back over
// the connection, and nothing client-side carries one.
test('a refusal is told from an outage by the server message envelope, never by its words', () => {
    assert.strictEqual(db.carriesServerMessage(
        'Msg 50000, Level 16, State 1, Server KITHOST, Procedure usp_AppendUsage, Line 42\r\n'
        + 'a stamp carried a kind that is neither read nor applied\r\n'), true,
    'a message the server sent back is a refusal');
    assert.strictEqual(db.carriesServerMessage(
        'Sqlcmd: Error: Microsoft ODBC Driver 17 for SQL Server : Login failed for user \'kit_publisher\'.'),
    false, 'a login the server would not take never reached a batch');
    assert.strictEqual(db.carriesServerMessage(
        'Sqlcmd: Error: Microsoft ODBC Driver 17 for SQL Server : TCP Provider: No connection could be '
        + 'made because the target machine actively refused it.'), false,
    'and neither did a closed port');
    // The words are withheld from the pattern: a client-level line naming a
    // procedure and a refusal in so many words is still an outage, and a server
    // message saying nothing about either is still a refusal.
    assert.strictEqual(db.carriesServerMessage(
        'Sqlcmd: Error: the server refused usp_AppendUsage'), false);
    assert.strictEqual(db.carriesServerMessage(
        'Msg 515, Level 16, State 2, Line 1\ncannot insert the value NULL'), true);
    assert.strictEqual(db.carriesServerMessage(''), false);
});

// The clamp on the branch every production drain takes. The publish is the only
// caller and it always carries a deadline, so this is the branch that decides
// how long a dead publisher's lock is honoured: unclamped, a drain that started
// with most of a fifteen-minute run left would ask for a staleness past the
// interval that holds the next publish off, and every session-start publish
// until the lock aged out would report contention and drain nothing.
test('a drain carrying a deadline holds the spool lock no longer than a live holder could', () => {
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
        const far = 60 * 60 * 1000;
        try {
            memq.acquireLock = watch;
            db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
            db.drainSpool(config(), {
                deps: { runBatch: fakeHost().runBatch, now: () => 1000 },
                deadline: 1000 + far
            });
        } finally {
            memq.acquireLock = realAcquire;
        }
        const taken = lockOf();
        assert.ok(taken && taken.options, 'the drain takes the spool lock with a staleness: '
            + JSON.stringify(seen.map((s) => s.target)));
        assert.strictEqual(taken.options.staleMs, db.DRAIN_LOCK_STALE_CEILING_MS,
            'a deadline further off than the ceiling is clamped to it: ' + JSON.stringify(taken.options));
        assert.ok(far + 2000 > db.DRAIN_LOCK_STALE_CEILING_MS,
            'and this case only says something while that deadline asks for more than the ceiling: '
            + db.DRAIN_LOCK_STALE_CEILING_MS);

        // The other side of the same branch, withheld from the assertion above:
        // a deadline inside the ceiling is not clamped, so the value above is
        // the clamp rather than a constant this branch always answers.
        seen.length = 0;
        try {
            memq.acquireLock = watch;
            db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'read')]);
            db.drainSpool(config(), {
                deps: { runBatch: fakeHost().runBatch, now: () => 1000 },
                deadline: 1000 + 5000
            });
        } finally {
            memq.acquireLock = realAcquire;
        }
        const near = lockOf();
        assert.ok(near.options.staleMs < db.DRAIN_LOCK_STALE_CEILING_MS,
            'a near deadline asks for less than the ceiling: ' + JSON.stringify(near.options));
        assert.strictEqual(near.options.staleMs, 60000,
            'and never less than the lock helper\'s own default, since a lock broken early is a second '
            + 'publisher reading the same lines: ' + JSON.stringify(near.options));
    } finally {
        rmStore(store);
    }
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

test('every lock-taking call\'s query clock outlasts the lock the server waits on', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        const host = fakeHost();
        await publishWith(store, host);
        // Both procedures that take the fleet publish lock, whichever leg of the
        // run makes the call: the record upsert and the write that stores a
        // pack's vectors.
        const locking = host.calls.filter((c) =>
            c.procedure === 'usp_UpsertRecords' || c.procedure === 'usp_UpsertEmbeddings');
        for (const procedure of ['usp_UpsertRecords', 'usp_UpsertEmbeddings']) {
            assert.ok(locking.some((c) => c.procedure === procedure),
                'the run calls ' + procedure + ': ' + host.calls.map((c) => c.procedure).join(', '));
        }

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
        // record batch spend the whole of it and the inventory read after them
        // is the first call refused. Driving the run past its deadline this way
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
            line.includes('the run budget') && line.includes('the inventory read')),
        'with the refused call named: ' + JSON.stringify(result.summary.failed));
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

test('the publish drains the spool before it walks, and reports the count', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        db.appendSpool([
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'read'),
            db.usageEntry('project', store.segment, 'a-record', 'a-record.md', 'applied')
        ]);
        const host = fakeHost();
        const result = await publishWith(store, host);
        assert.strictEqual(result.summary.drained, 2, JSON.stringify(result.summary));
        assert.deepStrictEqual(host.calls.slice(0, 2).map((c) => c.procedure),
            ['usp_Health', 'usp_AppendUsage'],
            'the probe goes first and the drain second: ' + host.calls.map((c) => c.procedure).join(', '));
        assert.ok(!fs.existsSync(path.join(store.root, 'kit-memory-db-spool.jsonl')));
        assert.ok(db.summaryLine(result.summary).includes('2 spool line(s) drained'), db.summaryLine(result.summary));
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
            drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        } finally {
            if (before.root === undefined) delete process.env.KIT_MEMORY_ROOT;
            else process.env.KIT_MEMORY_ROOT = before.root;
            if (before.allow === undefined) delete process.env.KIT_MEMORY_ROOT_ALLOW_DATA;
            else process.env.KIT_MEMORY_ROOT_ALLOW_DATA = before.allow;
        }
        assert.deepStrictEqual(drained, { ok: true, drained: 1, malformed: 0, rejected: 0 });
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
