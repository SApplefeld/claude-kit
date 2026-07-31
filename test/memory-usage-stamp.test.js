// Tests for plugins/claude-kit/hooks/memory-usage-stamp.js (the memory usage stamp).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a PostToolUse payload on stdin, and asserted on by
// what it left in usage.jsonl. Every test builds a fresh store root under
// os.tmpdir() and points the child at it with KIT_MEMORY_ROOT plus its second
// signal KIT_MEMORY_ROOT_ALLOW_DATA=1, so no test reads or writes the real
// ~/.claude store.
//
// Both directions of the path predicate are pinned on every leg: a read that
// must stamp and a read that must not, since a hook that stamps everything is
// as wrong as one that stamps nothing. The fail-open cases assert exit 0 with
// empty stdout and stderr, because a PostToolUse exit of 2 carries meaning to
// the harness and this hook must never produce one.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'memory-usage-stamp.js');

// A fresh store root with both tiers laid out the way memq resolves them: a
// project memory dir under projects/<sanitized-cwd>/memory and a type dir
// under memory-types/<type>.
function makeStore() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-root-'));
    const projDir = path.join(root, 'projects', 'D--repo-some-project', 'memory');
    const typeDir = path.join(root, 'memory-types', 'nextjs');
    fs.mkdirSync(projDir, { recursive: true });
    fs.mkdirSync(typeDir, { recursive: true });
    return { root, projDir, typeDir };
}

function rmStore(store) {
    try {
        fs.rmSync(store.root, { recursive: true, force: true });
    } catch {
        // Best-effort cleanup; a leftover temp dir never fails the test.
    }
}

// Run the hook as a child. process.env is spread rather than rebuilt so the
// child keeps its real PATH (a rebuilt env object loses the Windows `Path`
// key), and extra is where a case adds NODE_OPTIONS.
function runHook(store, payload, extra) {
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        encoding: 'utf8',
        env: { ...process.env, KIT_MEMORY_ROOT: store.root, KIT_MEMORY_ROOT_ALLOW_DATA: '1', ...(extra || {}) }
    });
}

function readPayload(filePath, key) {
    const p = { tool_name: 'Read', tool_input: {} };
    p.tool_input[key || 'file_path'] = filePath;
    return p;
}

function usagePath(dir) {
    return path.join(dir, 'usage.jsonl');
}

function readStamps(dir) {
    return fs.readFileSync(usagePath(dir), 'utf8')
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => JSON.parse(l));
}

function writeMemory(dir, name) {
    fs.writeFileSync(path.join(dir, name), '# ' + name + '\n\nbody\n', 'utf8');
    return path.join(dir, name);
}

// A hook run that must leave no trace at all: nothing said, nothing written,
// and an exit the harness reads as "carry on".
function assertSilentNoStamp(res, dirs) {
    assert.strictEqual(res.status, 0, 'the hook always exits 0, got: ' + res.stderr);
    assert.strictEqual(res.stdout, '', 'the hook never writes stdout');
    assert.strictEqual(res.stderr, '', 'the hook never writes stderr');
    for (const dir of dirs) {
        assert.ok(!fs.existsSync(usagePath(dir)), 'no sidecar was created in ' + dir);
    }
}

test('a Read of a project-tier memory file stamps that project\'s usage.jsonl', () => {
    const store = makeStore();
    try {
        const file = writeMemory(store.projDir, 'a-memory.md');
        const res = runHook(store, readPayload(file));
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '', 'the hook never writes stdout');
        assert.strictEqual(res.stderr, '');

        const stamps = readStamps(store.projDir);
        assert.strictEqual(stamps.length, 1);
        assert.deepStrictEqual(Object.keys(stamps[0]), ['ts', 'file', 'kind']);
        assert.strictEqual(stamps[0].file, 'a-memory.md');
        assert.strictEqual(stamps[0].kind, 'read');
        assert.ok(!Number.isNaN(Date.parse(stamps[0].ts)), 'ts is a valid ISO timestamp');
        assert.ok(!fs.existsSync(usagePath(store.typeDir)), 'the other tier is untouched');
    } finally {
        rmStore(store);
    }
});

test('a Read of a type-tier memory file stamps that type\'s usage.jsonl', () => {
    const store = makeStore();
    try {
        const file = writeMemory(store.typeDir, 'how-tests-run.md');
        const res = runHook(store, readPayload(file));
        assert.strictEqual(res.status, 0, res.stderr);

        const stamps = readStamps(store.typeDir);
        assert.strictEqual(stamps.length, 1);
        assert.strictEqual(stamps[0].file, 'how-tests-run.md');
        assert.strictEqual(stamps[0].kind, 'read');
        assert.ok(!fs.existsSync(usagePath(store.projDir)), 'the project tier is untouched');
    } finally {
        rmStore(store);
    }
});

test('a Read of a file outside the store stamps nothing', () => {
    const store = makeStore();
    try {
        const outside = path.join(store.root, 'not-memory.md');
        fs.writeFileSync(outside, '# elsewhere\n', 'utf8');
        assertSilentNoStamp(runHook(store, readPayload(outside)), [store.projDir, store.typeDir]);
        assertSilentNoStamp(runHook(store, readPayload('D:\\repo\\src\\README.md')),
            [store.projDir, store.typeDir]);
    } finally {
        rmStore(store);
    }
});

test('a .md file elsewhere under the store, and one nested below a tier dir, stamp nothing', () => {
    const store = makeStore();
    try {
        // Inside the project's state directory but not its memory dir.
        const sibling = path.join(store.root, 'projects', 'D--repo-some-project', 'notes.md');
        fs.writeFileSync(sibling, '# not a memory\n', 'utf8');
        assertSilentNoStamp(runHook(store, readPayload(sibling)), [store.projDir, store.typeDir]);

        // Below the memory dir: an archived memory is retired, and a stamp
        // beside it would land in a sidecar no reader of the tier ever opens.
        const archiveDir = path.join(store.projDir, 'archive');
        fs.mkdirSync(archiveDir, { recursive: true });
        const archived = writeMemory(archiveDir, 'old-memory.md');
        assertSilentNoStamp(runHook(store, readPayload(archived)),
            [store.projDir, store.typeDir, archiveDir]);
    } finally {
        rmStore(store);
    }
});

test('MEMORY.md and the .jsonl sidecars are never stamped', () => {
    const store = makeStore();
    try {
        // The index is read at every session start, so stamping it would swamp
        // the per-memory signal the sidecar carries.
        const index = writeMemory(store.projDir, 'MEMORY.md');
        assertSilentNoStamp(runHook(store, readPayload(index)), [store.projDir, store.typeDir]);
        assertSilentNoStamp(runHook(store, readPayload(writeMemory(store.typeDir, 'MEMORY.md'))),
            [store.projDir, store.typeDir]);

        // Reading the sidecars themselves must not feed them.
        const journal = path.join(store.projDir, 'outcomes.jsonl');
        fs.writeFileSync(journal, '', 'utf8');
        assertSilentNoStamp(runHook(store, readPayload(journal)), [store.projDir, store.typeDir]);

        const usage = usagePath(store.typeDir);
        fs.writeFileSync(usage, '', 'utf8');
        const res = runHook(store, readPayload(usage));
        assert.strictEqual(res.status, 0);
        assert.strictEqual(fs.readFileSync(usage, 'utf8'), '', 'reading the sidecar does not stamp it');
    } finally {
        rmStore(store);
    }
});

test('the filePath payload spelling is tolerated, and repeated reads append', () => {
    const store = makeStore();
    try {
        const file = writeMemory(store.projDir, 'a-memory.md');
        assert.strictEqual(runHook(store, readPayload(file, 'filePath')).status, 0);
        assert.strictEqual(runHook(store, readPayload(file)).status, 0);
        assert.strictEqual(runHook(store, readPayload(writeMemory(store.projDir, 'b-memory.md'))).status, 0);

        const stamps = readStamps(store.projDir);
        assert.strictEqual(stamps.length, 3, 'every read appends its own line');
        assert.deepStrictEqual(stamps.map((s) => s.file), ['a-memory.md', 'a-memory.md', 'b-memory.md']);
    } finally {
        rmStore(store);
    }
});

test('an existing sidecar is appended to, damaged lines included, never rewritten', () => {
    const store = makeStore();
    try {
        const existing = '{ this is not json\n{"ts":"2026-07-01T00:00:00.000Z","file":"x.md","kind":"applied"}\n';
        fs.writeFileSync(usagePath(store.projDir), existing, 'utf8');
        const file = writeMemory(store.projDir, 'a-memory.md');

        const res = runHook(store, readPayload(file));
        assert.strictEqual(res.status, 0, 'a damaged sidecar is never read, so it cannot break the write');
        const raw = fs.readFileSync(usagePath(store.projDir), 'utf8');
        assert.ok(raw.startsWith(existing), 'the prior content survives byte for byte');
        const added = raw.slice(existing.length).trim();
        assert.strictEqual(JSON.parse(added).file, 'a-memory.md');
    } finally {
        rmStore(store);
    }
});

test('a payload the hook cannot use fails open: exit 0, silent, no stamp', () => {
    const store = makeStore();
    try {
        writeMemory(store.projDir, 'a-memory.md');
        const cases = [
            'not json at all',
            '',
            JSON.stringify(null),
            JSON.stringify('a bare string'),
            JSON.stringify({ tool_name: 'Read' }),
            JSON.stringify({ tool_name: 'Read', tool_input: {} }),
            JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '' } }),
            JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 42 } }),
            JSON.stringify({ tool_name: 'Read', tool_input: 'a string' })
        ];
        for (const payload of cases) {
            assertSilentNoStamp(runHook(store, payload), [store.projDir, store.typeDir]);
        }
    } finally {
        rmStore(store);
    }
});

test('a Read of a path that does not exist stamps nothing', () => {
    const store = makeStore();
    try {
        // PostToolUse fires after a failed Read too, so a stamp without this
        // guard would record a memory that never existed and would create a
        // sidecar in a tier that has none.
        const ghost = path.join(store.projDir, 'never-written.md');
        assertSilentNoStamp(runHook(store, readPayload(ghost)), [store.projDir, store.typeDir]);

        // A directory named like a memory is not a memory file either.
        const dir = path.join(store.projDir, 'a-directory.md');
        fs.mkdirSync(dir, { recursive: true });
        assertSilentNoStamp(runHook(store, readPayload(dir)), [store.projDir, store.typeDir]);
    } finally {
        rmStore(store);
    }
});

test('a name the store refuses is dropped, so no unbounded or unsafe value reaches the sidecar', () => {
    const store = makeStore();
    try {
        // The stamped name is later joined onto a path by the decay pass, so a
        // separator, or a name long enough to unbound the line, is dropped
        // rather than recorded. Dropping is the fail-open direction.
        const stamped = writeMemory(store.projDir, 'a-memory.md');
        const refused = [
            path.join(store.projDir, 'x'.repeat(200) + '.md'),
            path.join(store.projDir, 'has space.md'),
            path.join(store.projDir, 'trailing;semi.md')
        ];
        for (const file of refused) {
            try {
                fs.writeFileSync(file, '# refused\n', 'utf8');
            } catch {
                // A name the filesystem itself refuses is refused here too;
                // the hook still has to answer for the payload.
            }
            assertSilentNoStamp(runHook(store, readPayload(file)), [store.projDir, store.typeDir]);
        }

        // The control: an admissible name in the same directory does stamp, so
        // the silences above are the predicate and not a broken fixture.
        assert.strictEqual(runHook(store, readPayload(stamped)).status, 0);
        assert.strictEqual(readStamps(store.projDir).length, 1);
    } finally {
        rmStore(store);
    }
});

test('a payload naming a tool other than Read is not stamped', () => {
    const store = makeStore();
    try {
        // The stamp's kind is a claim about which tool fired, so a widened
        // matcher must not silently start recording edits as reads.
        const file = writeMemory(store.projDir, 'a-memory.md');
        const payload = readPayload(file);
        payload.tool_name = 'Edit';
        assertSilentNoStamp(runHook(store, payload), [store.projDir, store.typeDir]);

        // An absent tool name is the fail-open direction: still stamped.
        const anonymous = readPayload(file);
        delete anonymous.tool_name;
        assert.strictEqual(runHook(store, anonymous).status, 0);
        assert.strictEqual(readStamps(store.projDir).length, 1);
    } finally {
        rmStore(store);
    }
});

test('a sidecar path obstructed by a directory fails open: exit 0, silent', () => {
    const store = makeStore();
    try {
        // A directory where the sidecar belongs makes the append fail with
        // something other than absence, standing in for a path the OS refuses.
        fs.mkdirSync(usagePath(store.projDir), { recursive: true });
        const file = writeMemory(store.projDir, 'a-memory.md');

        const res = runHook(store, readPayload(file));
        assert.strictEqual(res.status, 0, 'a failed write never blocks the session');
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.stderr, '');
        assert.ok(fs.statSync(usagePath(store.projDir)).isDirectory(), 'the obstruction is left as it was');
    } finally {
        rmStore(store);
    }
});

// Make the sidecar append fail inside the spawned hook: a preload module
// patches fs.appendFileSync to refuse that one file, standing in for a write
// the OS declines (a permission or a lock), which no portable fixture can
// stage here. Node parses NODE_OPTIONS with backslash as an escape character,
// so the preload path is passed forward-slashed; a backslashed path fails to
// resolve and the child dies before the hook runs.
function appendRefusingPreload(dir) {
    const shim = path.join(dir, 'refuse-append.js');
    fs.writeFileSync(shim, [
        "'use strict';",
        "const fs = require('fs');",
        'const realAppendFileSync = fs.appendFileSync;',
        'fs.appendFileSync = function (target) {',
        "    if (String(target).endsWith('usage.jsonl')) {",
        "        const err = new Error('EACCES: the fixture refuses this write');",
        "        err.code = 'EACCES';",
        '        throw err;',
        '    }',
        '    return realAppendFileSync.apply(fs, arguments);',
        '};'
    ].join('\n') + '\n', 'utf8');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

test('an append the filesystem refuses fails open: exit 0, silent, no sidecar', () => {
    const store = makeStore();
    try {
        const file = writeMemory(store.projDir, 'a-memory.md');
        const res = runHook(store, readPayload(file),
            { NODE_OPTIONS: appendRefusingPreload(store.root) });
        // A nonzero exit here would mean the preload itself failed to load,
        // not that the hook reported the refused write.
        assertSilentNoStamp(res, [store.projDir, store.typeDir]);

        // The same run without the preload stamps, so the case above proves
        // the injection worked rather than that the payload was never eligible.
        assert.strictEqual(runHook(store, readPayload(file)).status, 0);
        assert.strictEqual(readStamps(store.projDir).length, 1);
    } finally {
        rmStore(store);
    }
});

// Make the memq require fail inside the spawned hook: a preload module refuses
// to load that one module, standing in for the damaged or incomplete plugin
// cache the hook's guarded require exists for. Same forward-slashed NODE_OPTIONS
// shape as appendRefusingPreload, for the same reason.
function requireRefusingPreload(dir) {
    const shim = path.join(dir, 'refuse-require.js');
    fs.writeFileSync(shim, [
        "'use strict';",
        "const Module = require('module');",
        'const realLoad = Module._load;',
        'Module._load = function (request) {',
        "    if (String(request).endsWith('memq.js')) {",
        "        throw new Error('the fixture refuses this require');",
        '    }',
        '    return realLoad.apply(Module, arguments);',
        '};'
    ].join('\n') + '\n', 'utf8');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

test('a memq that will not load leaves the hook inert rather than throwing', () => {
    const store = makeStore();
    try {
        // The store's rules live in memq, so a cache that cannot load it has
        // no way to decide what a memory is. Failing open is the only safe
        // answer; a throw would end the process nonzero, which for a
        // PostToolUse hook is a signal to the harness.
        const file = writeMemory(store.projDir, 'a-memory.md');
        const res = runHook(store, readPayload(file),
            { NODE_OPTIONS: requireRefusingPreload(store.root) });
        assertSilentNoStamp(res, [store.projDir, store.typeDir]);

        // The control: without the preload the same payload stamps.
        assert.strictEqual(runHook(store, readPayload(file)).status, 0);
        assert.strictEqual(readStamps(store.projDir).length, 1);
    } finally {
        rmStore(store);
    }
});

test('filename and path segments compare the way the filesystem does', { skip: process.platform !== 'win32' ? 'case-insensitive paths are a Windows behavior' : false }, () => {
    const store = makeStore();
    try {
        // A payload is an arbitrary string, not a directory entry, so a
        // spelling the filesystem treats as the same file must not defeat the
        // index exclusion or split one memory across two sidecar keys.
        writeMemory(store.projDir, 'Memory.md');
        assertSilentNoStamp(runHook(store, readPayload(path.join(store.projDir, 'Memory.md'))),
            [store.projDir, store.typeDir]);

        writeMemory(store.projDir, 'b-note.MD');
        assert.strictEqual(runHook(store, readPayload(path.join(store.projDir, 'b-note.MD'))).status, 0);
        assert.deepStrictEqual(readStamps(store.projDir).map((s) => s.file), ['b-note.md'],
            'the recorded key is normalized, so one file cannot become two');

        // A tier path spelled in another case still resolves to the tier.
        const shouty = path.join(store.root, 'Projects', 'D--repo-some-project', 'Memory', 'b-note.MD');
        assert.strictEqual(runHook(store, readPayload(shouty)).status, 0);
        assert.strictEqual(readStamps(store.projDir).length, 2, 'the stamp landed in the one real sidecar');
    } finally {
        rmStore(store);
    }
});
