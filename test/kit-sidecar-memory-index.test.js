// Tests for sidecar/memory-index.js's resolution contract at its own boundary.
//
// Node's built-in test runner, no framework (Node v24). The module's header
// states that nothing in it throws at its caller: every unresolvable input is
// a described status the daemon counts, because the cwd it resolves arrives
// off a spool line any local process on the machine can write, and the
// daemon's only handler above loadIndex is a top-level catch that exits. So
// the contract under test here is fault containment, not resolution: a value
// the store's own sanitizer refuses (a relative cwd is the live case, since
// the spool validates cwd only as a capped string) must come back as a
// status, never as a throw. The wider daemon behavior lives in the sidecar
// suites; this file pins the one boundary those fixtures reach only through
// the daemon.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const memoryIndex = require('../sidecar/memory-index.js');

function makeRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'sidx-'));
}

function rmRoot(root) {
    try {
        fs.rmSync(root, { recursive: true, force: true });
    } catch {
        // Best-effort cleanup; a leftover temp dir never fails a test.
    }
}

test('loadIndex answers a status, never a throw, for a cwd the store refuses to name', () => {
    const root = makeRoot();
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'sidx-proj-'));
    try {
        // The control first, matched on shape: an absolute cwd with a planted
        // index resolves ok through this same call, so the statuses below are
        // the refusals reading as statuses rather than a loader that answers
        // noproject to everything.
        const segment = project.replace(/[^A-Za-z0-9]/g, '-');
        const memDir = path.join(root, 'projects', segment, 'memory');
        fs.mkdirSync(memDir, { recursive: true });
        fs.writeFileSync(path.join(memDir, 'MEMORY.md'),
            '# Memory Index\n\n- [A record](a-record.md) - a planted line\n', 'utf8');
        const ok = memoryIndex.loadIndex(project, { memoryRoot: root });
        assert.strictEqual(ok.status, 'ok', JSON.stringify(ok));

        // The refused shapes. memq's sanitizer throws on a relative or empty
        // value, and the spool guarantees only a capped string, so each of
        // these can arrive on a spool line; the module's own contract turns
        // the refusal into the noproject status its header enumerates.
        for (const bad of ['relative-dir', '..', '.', 'a/b', '', '   ']) {
            let result;
            assert.doesNotThrow(() => {
                result = memoryIndex.loadIndex(bad, { memoryRoot: root });
            }, 'loadIndex must not throw for ' + JSON.stringify(bad));
            assert.strictEqual(result.status, 'noproject',
                JSON.stringify(bad) + ' resolves no project: ' + JSON.stringify(result));
        }
    } finally {
        rmRoot(root);
        rmRoot(project);
    }
});
