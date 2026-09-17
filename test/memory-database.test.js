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
        if (host.fail.has(call.procedure)) return { ok: false, detail: 'the host refused ' + call.procedure };

        if (call.procedure === 'usp_AppendUsage') {
            for (const row of call.parameters['@p_Usage']) host.usage.push(row);
            return { ok: true, rows: [{ appended: call.parameters['@p_Usage'].length, rejected: 0 }] };
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
                } else if (held.fileModified !== undefined && record.fileModified < held.fileModified) {
                    // The real procedure's `older` disposition: the host keeps
                    // its newer body and stamps the row's last-published time.
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
    const store = makeStore();
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
        rmStore(store);
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
    const store = makeStore();
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
        rmStore(store);
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

        // The usage call is the first one out, so a host refusing it delivers
        // nothing and the file must stand exactly as it was.
        const refusing = fakeHost({ fail: ['usp_AppendUsage'] });
        const failed = db.drainSpool(config(), { deps: { runBatch: refusing.runBatch } });
        assert.strictEqual(failed.ok, false, JSON.stringify(failed));
        assert.strictEqual(failed.drained, 0);
        assert.deepStrictEqual(fs.readFileSync(spoolFile), before,
            'a stamp delivered nowhere and deleted anyway is the loss this mechanism exists to prevent');

        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(drained, { ok: true, drained: 2, malformed: 0 });
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
        assert.deepStrictEqual(rest, { ok: true, drained: 1, malformed: 0 });
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
        assert.deepStrictEqual(drained, { ok: true, drained: 2, malformed: 1 },
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
        const realWrite = fs.writeFileSync;
        const realUnlink = fs.unlinkSync;
        const spoolFile = db.spoolPath();
        const refuse = (target) => {
            if (typeof target === 'string' && path.resolve(target) === path.resolve(spoolFile)) {
                const err = new Error('EPERM: operation not permitted');
                err.code = 'EPERM';
                throw err;
            }
            return false;
        };
        fs.writeFileSync = function (target, ...rest) { refuse(target); return realWrite.call(this, target, ...rest); };
        fs.unlinkSync = function (target, ...rest) { refuse(target); return realUnlink.call(this, target, ...rest); };
        let result = null;
        try {
            const host = fakeHost();
            result = await publishWith(store, host);
        } finally {
            fs.writeFileSync = realWrite;
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

test('a stamp appended while the drain is in flight survives it', () => {
    const store = makeStore();
    const spoolFile = path.join(store.root, 'kit-memory-db-spool.jsonl');
    try {
        db.appendSpool([db.usageEntry('project', store.segment, 'one', 'one.md', 'read')]);
        const host = fakeHost({
            onCall: () => {
                // The interactive path never waits on the drain's lock, so this
                // is the ordinary case rather than a contrived one: a stamp can
                // land between the read and the rewrite.
                db.appendSpool([db.usageEntry('project', store.segment, 'two', 'two.md', 'applied')]);
            }
        });
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(drained, { ok: true, drained: 1, malformed: 0 });
        const left = db.readSpool();
        assert.strictEqual(left.usage.length, 1, 'the late stamp is still in the file: ' + fs.readFileSync(spoolFile, 'utf8'));
        assert.strictEqual(left.usage[0].fileKey, 'two.md');
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
        writeRecord(store.memDir, 'twinned', '# twinned\n\nthe live body\n');
        writeRecord(path.join(store.memDir, 'archive'), 'twinned', '# twinned\n\nthe archived body\n');

        const host = fakeHost();
        const result = await publishWith(store, host);
        assert.strictEqual(result.ok, true, JSON.stringify(result));
        const sent = host.calls.filter((c) => c.procedure === 'usp_UpsertRecords')
            .flatMap((c) => c.parameters['@p_Records'] || []).map((r) => r.fileKey).sort();
        assert.deepStrictEqual(sent, ['kept.md'],
            'neither copy of the twinned record is sent: ' + JSON.stringify(sent));
        assert.ok(result.summary.failed.some((f) => /live and archived/.test(f)),
            'and the pair is named to a reader: ' + JSON.stringify(result.summary.failed));
        assert.ok(!host.records.has('project\u0000' + store.segment + '\u0000twinned.md'),
            'the host holds no row built from one arbitrary half of the pair');

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

// A record the host holds a newer copy of is answered `older`: the host keeps
// its own body and this machine's text is not what that row says. The reader
// still reports the row unembedded, so embedding it here would store vectors
// made from this machine's older text against the host's newer record, which
// then reads as embedded forever with text no file holds.
test('a record the host skipped as older is not embedded with this machine\'s copy', async () => {
    const store = makeStore();
    try {
        writeRecord(store.memDir, 'shared-note', '# shared\n\nthe newer body\n');
        const host = fakeHost();
        await publishWith(store, host);
        assert.strictEqual(host.records.size, 1);

        // The host's row now carries a newer modification time than the file
        // below will, which is the shape the git sync leaves between one
        // machine's write and another's, and its embeddings are dropped as a
        // re-embed pass would leave them.
        const row = [...host.records.values()][0];
        row.fileModified = '2099-01-01T00:00:00.000Z';
        row.embedded = false;
        row.bodyHash = 'the-hosts-own-hash';

        const texts = [];
        host.embedCalls.length = 0;
        const again = await publishWith(store, host, { texts });
        assert.strictEqual(again.summary.skippedOlder, 1, JSON.stringify(again.summary));
        assert.strictEqual(again.summary.embedded, 0,
            'nothing this machine holds is embedded against a record the host did not take it for');
        assert.deepStrictEqual(texts, [], 'and the embedding server is not called at all');
        assert.strictEqual(host.embedCalls.length, 0);

        // The control: with the host's row back in step, the same unembedded
        // record does embed, so the zero above is the older disposition and
        // not a publish that stopped embedding.
        row.fileModified = '2000-01-01T00:00:00.000Z';
        const control = await publishWith(store, host);
        assert.strictEqual(control.summary.embedded, 1, JSON.stringify(control.summary));
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
test('an unreachable host is discovered at the judged probe budget, before the drain or the walk', async () => {
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
        assert.strictEqual(seen[0].opts.budgetMs, memq.JUDGED_PROBE_TIMEOUT_MS,
            'the probe is spent at the judged channel\'s own budget');
        assert.ok(seen[0].opts.killMs <= memq.JUDGED_PROBE_TIMEOUT_MS + 2000,
            'and its hard kill is the declared overshoot: ' + seen[0].opts.killMs);
        assert.strictEqual(fs.readFileSync(db.spoolPath(), 'utf8').trim().split('\n').length, 1,
            'the spool is untouched by a run that stood down');
    } finally {
        rmStore(store);
    }
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
        assert.ok(typeof env.PATH === 'string' || typeof env.Path === 'string',
            'the child still gets what a process needs to run: ' + JSON.stringify(Object.keys(env)));

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
    } finally {
        for (const [name, value] of [['SQLCMDINI', before.ini], ['SQLCMDSERVER', before.server],
            ['KIT_STEERING_VALUE', before.steer]]) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    }
});

// The client tools are resolved at two fixed absolute paths or not at all.
// Resolving by bare name searches PATH, which is the list the pin exists to
// avoid: it hands the login's password to whatever sqlcmd sits earliest in it,
// and a user-writable directory ahead of the real one is the ordinary way that
// becomes someone else's process.
test('an absent client tool is a named stand-down, never a PATH search', () => {
    const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
    assert.ok(!/'sqlcmd\.exe'|'sqlcmd'/.test(source),
        'no bare tool name appears in the client at all');

    const before = process.env.ProgramFiles;
    try {
        // A ProgramFiles that holds no client tools, and a literal C:\Program
        // Files that may. Where neither has them the answer is null; where the
        // machine really has them the literal path is what answers, which is
        // the same assertion from the other side: the environment's value is
        // never what a resolution rests on alone.
        process.env.ProgramFiles = path.join(os.tmpdir(), 'kitdb-no-such-program-files');
        const resolved = db.sqlcmdPath();
        assert.ok(resolved === null || path.isAbsolute(resolved),
            'a resolved tool is an absolute path: ' + resolved);

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

// A batch file carries whole record bodies through a directory every account
// on the machine can read. The live one is unlinked in a finally, so what this
// covers is the one a kill between the spawn and the unlink leaves behind.
test('a batch file left behind by an earlier run is swept, and a live one is not', () => {
    const old = path.join(os.tmpdir(), 'kit-memory-db-99999-' + Date.now() + '-stale.sql');
    const fresh = path.join(os.tmpdir(), 'kit-memory-db-99999-' + Date.now() + '-fresh.sql');
    const other = path.join(os.tmpdir(), 'not-a-kit-batch-' + Date.now() + '.sql');
    try {
        for (const file of [old, fresh, other]) fs.writeFileSync(file, ';SELECT 1\n', 'utf8');
        const past = new Date(Date.now() - 24 * 3600 * 1000);
        fs.utimesSync(old, past, past);
        fs.utimesSync(other, past, past);

        db.sweepStaleBatches();
        assert.ok(!fs.existsSync(old), 'a batch older than any call this client can make is swept');
        assert.ok(fs.existsSync(fresh), 'a batch a live call could own is left alone');
        assert.ok(fs.existsSync(other), 'and nothing outside this module\'s own name shape is touched');

        // The wiring, which is what makes the sweep happen at all: every call
        // through the transport runs it before it writes its own batch.
        const source = fs.readFileSync(CLIENT_SOURCE, 'utf8');
        const opens = source.indexOf('\nfunction runBatch(');
        const body = source.slice(opens + 1, source.indexOf('\nfunction ', opens + 1));
        assert.ok(/\n\s*sweepStaleBatches\(\);/.test(body),
            'the transport sweeps before it spawns');
    } finally {
        for (const file of [old, fresh, other]) {
            try { fs.rmSync(file, { force: true }); } catch { /* best effort */ }
        }
    }
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

test('with the host unreachable, memq touch still stamps the sidecar and leaves one spool line', () => {
    const store = makeStore();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-home-live-'));
    try {
        writeRecord(store.memDir, 'a-record', '# a record\n\na body\n');
        // A config naming an address nothing listens on, under Windows
        // authentication so no password is written anywhere. The client's own
        // hard clock bounds the attempt at the probe timeout, whether the tool
        // is installed on this machine or not.
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', 'kit-memory-db.json'), JSON.stringify({
            server: '127.0.0.1,1', database: 'KitMemoryUnreachable', windowsAuth: true,
            embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
        }, null, 2) + '\n', 'utf8');

        const res = runMemq(store, ['touch', 'a-record', '--applied'], home);
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
        // reaches the procedure and the file goes away.
        const host = fakeHost();
        const drained = db.drainSpool(config(), { deps: { runBatch: host.runBatch } });
        assert.deepStrictEqual(drained, { ok: true, drained: 1, malformed: 0 });
        assert.strictEqual(host.usage.length, 1);
        assert.strictEqual(host.usage[0].fileKey, 'a-record.md');
    } finally {
        rmStore(store);
        try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ }
    }
});

test('memq log writes the journal line and spools the outcome the host did not take', () => {
    const store = makeStore();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kitdb-home-log-'));
    try {
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', 'kit-memory-db.json'), JSON.stringify({
            server: '127.0.0.1,1', database: 'KitMemoryUnreachable', windowsAuth: true,
            embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
        }) + '\n', 'utf8');

        const res = runMemq(store, ['log', 'an-action', 'pass', 'it worked'], home);
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
        rmStore(store);
        try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ }
    }
});
