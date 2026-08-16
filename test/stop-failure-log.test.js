// Tests for plugins/claude-kit/hooks/stop-failure-log.js (the StopFailure
// logger).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a StopFailure payload on stdin, and asserted on by
// its exit code and by what it left on disk. The exit code is pinned to exactly
// 0 on every path, including the failure paths: this hook observes and can
// never block, so a nonzero exit would be a defect rather than a verdict. Every
// case builds a fresh temp project so no case touches the real repo's .kit/.
//
// The filesystem-failure cases inject their failure through a NODE_OPTIONS
// preload that shims one fs function for one path inside the spawned child, the
// technique test/kit-goal-stop.test.js uses: on Windows no real-filesystem
// fixture can make a write fail without also breaking the setup around it. The
// preload path is passed forward-slashed, because Node reads a backslash in
// NODE_OPTIONS as an escape character and a backslashed path kills the child
// before the hook runs.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'stop-failure-log.js');

// The shipped events-log ceiling, duplicated here deliberately as a pin:
// changing the constant in the hook must fail the cap cases and force a
// double-edit, so the ceiling can never drift silently.
const EVENTS_LOG_MAX_BYTES = 4 * 1024 * 1024;

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeFile(full, contents) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, 'utf8');
}

// A StopFailure payload in the shape the harness sends: the common hook fields
// plus the event's own. Overrides replace or remove fields per case.
function failurePayload(repo, overrides) {
    return {
        session_id: 'ses-9a8b7c6d-1111-2222-3333-444455556666',
        transcript_path: path.join(repo, 'transcript.jsonl'),
        cwd: repo,
        prompt_id: 'prompt-7',
        hook_event_name: 'StopFailure',
        error: 'rate_limit',
        error_details: 'API Error: 429 rate_limit_error',
        last_assistant_message: "You've hit your session limit",
        ...(overrides || {})
    };
}

// Run the hook against a project directory. `payload` is an object, or a raw
// string for the malformed-stdin cases. The child's cwd is the project so the
// no-payload-cwd fallback resolves there too.
function runHook(payload, cwd, extraEnv) {
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        cwd,
        env: { ...process.env, ...(extraEnv || {}) },
        encoding: 'utf8'
    });
}

function eventsPath(repo) {
    return path.join(repo, '.kit', 'stop-failure-events.jsonl');
}

function latestPath(repo) {
    return path.join(repo, '.kit', 'stop-failure-latest.json');
}

function readEvents(repo) {
    let text;
    try { text = fs.readFileSync(eventsPath(repo), 'utf8'); } catch { return []; }
    return text.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
}

function readLatest(repo) {
    return JSON.parse(fs.readFileSync(latestPath(repo), 'utf8'));
}

// Every path exits 0 and says nothing on either stream: the payload is
// untrusted data and a hook's stderr can reach a model's context.
function assertSilentSuccess(res) {
    assert.strictEqual(res.status, 0, 'the hook exits 0 on every path; stderr: ' + res.stderr);
    assert.strictEqual(res.stdout, '', 'the hook writes nothing to stdout');
    assert.strictEqual(res.stderr, '', 'the hook writes nothing to stderr');
}

// The names present under the project directory, recursively, so a case can
// prove the hook created nothing outside .kit/.
function treeNames(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        out.push(entry.name);
        if (entry.isDirectory()) {
            for (const child of treeNames(path.join(dir, entry.name))) {
                out.push(entry.name + '/' + child);
            }
        }
    }
    return out.sort();
}

// Make one fs call fail inside the spawned hook, standing in for a write the OS
// declines (a full disk, a permission, a lock), which no portable fixture can
// stage here. `fn` is the fs function to shim and `needle` the path substring
// it refuses. Returns the NODE_OPTIONS value that loads the preload.
function failingFsPreload(dir, fn, needle) {
    const shim = path.join(dir, 'fail-' + fn + '.js');
    writeFile(shim, [
        "'use strict';",
        "const fs = require('fs');",
        'const real = fs.' + fn + ';',
        'fs.' + fn + ' = function (target) {',
        '    if (String(target).includes(' + JSON.stringify(needle) + ')) {',
        "        const err = new Error('EPERM: the fixture refuses this write');",
        "        err.code = 'EPERM';",
        '        throw err;',
        '    }',
        '    return real.apply(fs, arguments);',
        '};'
    ].join('\n') + '\n');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

// ---------------------------------------------------------------------------
// The happy path.
// ---------------------------------------------------------------------------

test('a well-formed payload lands in both the events log and the latest marker', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        const payload = failurePayload(repo);
        assertSilentSuccess(runHook(payload, repo));

        const events = readEvents(repo);
        assert.strictEqual(events.length, 1, 'one event line');
        const latest = readLatest(repo);

        // The record is the parsed payload re-serialized: every field survives
        // verbatim, and nothing is dropped or reshaped.
        for (const key of Object.keys(payload)) {
            assert.deepStrictEqual(events[0][key], payload[key], 'events line carries ' + key);
            assert.deepStrictEqual(latest[key], payload[key], 'marker carries ' + key);
        }
        // Both files carry the same record, so the watcher and the history can
        // never disagree about what happened.
        assert.deepStrictEqual(latest, events[0], 'the marker is the same record as the events line');
        assert.ok(Number.isFinite(Date.parse(events[0].recordedAt)),
            'the record carries a parseable ISO timestamp');
    } finally {
        rmDir(repo);
    }
});

test('the marker is a complete JSON object, and no tmp file is left behind', () => {
    // Atomicity: the marker is written to a pid-suffixed tmp and renamed, so a
    // reader never sees a partial file, and a completed write leaves no orphan.
    const repo = makeDir('stop-failure-log-repo-');
    try {
        assertSilentSuccess(runHook(failurePayload(repo), repo));
        const raw = fs.readFileSync(latestPath(repo), 'utf8');
        const parsed = JSON.parse(raw);
        assert.strictEqual(typeof parsed, 'object');
        assert.strictEqual(parsed.error, 'rate_limit');
        const leftovers = fs.readdirSync(path.join(repo, '.kit')).filter((n) => n.includes('.tmp.'));
        assert.deepStrictEqual(leftovers, [], 'no tmp file survives a successful write');
    } finally {
        rmDir(repo);
    }
});

test('a second failure appends a line and replaces the marker', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        assertSilentSuccess(runHook(failurePayload(repo, { error: 'rate_limit' }), repo));
        assertSilentSuccess(runHook(failurePayload(repo, { error: 'overloaded' }), repo));
        const events = readEvents(repo);
        assert.strictEqual(events.length, 2, 'the events log appends, it does not replace');
        assert.strictEqual(events[0].error, 'rate_limit');
        assert.strictEqual(events[1].error, 'overloaded');
        assert.strictEqual(readLatest(repo).error, 'overloaded', 'the marker holds the newest failure');
    } finally {
        rmDir(repo);
    }
});

test('an unknown field in the payload is recorded verbatim (the logger is shape-agnostic)', () => {
    // The payload shape is undocumented and can change upstream. A field this
    // hook has never seen must reach the record untouched, because the watcher,
    // not the hook, is where any reading of it lives.
    const repo = makeDir('stop-failure-log-repo-');
    try {
        const payload = failurePayload(repo, { some_future_field: { nested: [1, 2, 3] } });
        assertSilentSuccess(runHook(payload, repo));
        assert.deepStrictEqual(readLatest(repo).some_future_field, { nested: [1, 2, 3] });
    } finally {
        rmDir(repo);
    }
});

test('a payload carrying its own recordedAt does not displace the real timestamp', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        assertSilentSuccess(runHook(failurePayload(repo, { recordedAt: 'not-a-time' }), repo));
        const latest = readLatest(repo);
        assert.notStrictEqual(latest.recordedAt, 'not-a-time',
            'the hook applies its timestamp last, so payload data cannot forge it');
        assert.ok(Number.isFinite(Date.parse(latest.recordedAt)));
    } finally {
        rmDir(repo);
    }
});

test('the hook writes nothing outside .kit/', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        writeFile(path.join(repo, 'docs', 'note.md'), 'untouched\n');
        const before = treeNames(repo);
        assertSilentSuccess(runHook(failurePayload(repo), repo));
        const after = treeNames(repo);
        const added = after.filter((n) => !before.includes(n));
        assert.deepStrictEqual(added.sort(), [
            '.kit',
            '.kit/stop-failure-events.jsonl',
            '.kit/stop-failure-latest.json'
        ], 'exactly the two records under .kit/, and nothing else');
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// Malformed input: recorded as a length-only note, never echoed.
// ---------------------------------------------------------------------------

test('a non-JSON payload exits 0 and is recorded as a length-only note', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        const junk = 'this is not json at all { SECRETTOKEN9137';
        assertSilentSuccess(runHook(junk, repo));

        const events = readEvents(repo);
        assert.strictEqual(events.length, 1);
        assert.deepStrictEqual(
            { unparsed: events[0].unparsed, bytes: events[0].bytes },
            { unparsed: true, bytes: Buffer.byteLength(junk, 'utf8') },
            'the note names only the length'
        );
        assert.deepStrictEqual(readLatest(repo), events[0], 'the marker carries the same note');

        // Not one byte of the unparseable input may appear in either file.
        for (const file of [eventsPath(repo), latestPath(repo)]) {
            const text = fs.readFileSync(file, 'utf8');
            assert.ok(!text.includes('SECRETTOKEN9137'), 'raw stdin is never echoed into ' + file);
            assert.ok(!text.includes('not json'), 'raw stdin is never echoed into ' + file);
        }
    } finally {
        rmDir(repo);
    }
});

test('valid JSON that is not an object is a length-only note too', () => {
    // A JSON scalar or array parses but is not a payload. Spreading it would
    // produce a record of indexed characters or elements, which is the raw
    // content back by another route.
    const repo = makeDir('stop-failure-log-repo-');
    try {
        assertSilentSuccess(runHook('["ARRAYLEAK4471"]', repo));
        const events = readEvents(repo);
        assert.strictEqual(events[0].unparsed, true);
        assert.strictEqual(events[0].bytes, Buffer.byteLength('["ARRAYLEAK4471"]', 'utf8'));
        for (const file of [eventsPath(repo), latestPath(repo)]) {
            assert.ok(!fs.readFileSync(file, 'utf8').includes('ARRAYLEAK4471'),
                'array content never reaches ' + file);
        }
    } finally {
        rmDir(repo);
    }
});

test('empty stdin exits 0 and records a zero-length note', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        assertSilentSuccess(runHook('', repo));
        const events = readEvents(repo);
        assert.strictEqual(events.length, 1);
        assert.deepStrictEqual({ unparsed: events[0].unparsed, bytes: events[0].bytes },
            { unparsed: true, bytes: 0 });
        assert.deepStrictEqual(readLatest(repo), events[0]);
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// The events-log ceiling.
// ---------------------------------------------------------------------------

test('past the byte ceiling the append is skipped and the marker is still written', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        const events = eventsPath(repo);
        writeFile(events, 'x'.repeat(EVENTS_LOG_MAX_BYTES) + '\n');
        const sizeBefore = fs.statSync(events).size;

        assertSilentSuccess(runHook(failurePayload(repo), repo));

        assert.strictEqual(fs.statSync(events).size, sizeBefore,
            'the events log does not grow past the ceiling');
        assert.strictEqual(readLatest(repo).error, 'rate_limit',
            'the marker is written regardless: it is what the watcher reads');
    } finally {
        rmDir(repo);
    }
});

test('just under the byte ceiling the append still happens (the cap is not always-on)', () => {
    // The other direction of the cap: a log below the ceiling must keep growing,
    // or the ceiling check would be indistinguishable from a broken append.
    const repo = makeDir('stop-failure-log-repo-');
    try {
        const events = eventsPath(repo);
        writeFile(events, 'x'.repeat(EVENTS_LOG_MAX_BYTES - 1024) + '\n');
        const sizeBefore = fs.statSync(events).size;

        assertSilentSuccess(runHook(failurePayload(repo), repo));

        assert.ok(fs.statSync(events).size > sizeBefore, 'the events log grew');
        assert.strictEqual(readLatest(repo).error, 'rate_limit');
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// Write failures: fail-open, and independent of each other.
// ---------------------------------------------------------------------------

test('a failing events append exits 0 and does not prevent the marker write', () => {
    const repo = makeDir('stop-failure-log-repo-');
    const shims = makeDir('stop-failure-log-shim-');
    try {
        const res = runHook(failurePayload(repo), repo, {
            NODE_OPTIONS: failingFsPreload(shims, 'appendFileSync', 'stop-failure-events.jsonl')
        });
        assertSilentSuccess(res);
        assert.ok(!fs.existsSync(eventsPath(repo)), 'the append genuinely failed');
        assert.strictEqual(readLatest(repo).error, 'rate_limit',
            'the marker write is independent of the append');
    } finally {
        rmDir(repo);
        rmDir(shims);
    }
});

test('a failing marker write exits 0 and does not prevent the events append', () => {
    const repo = makeDir('stop-failure-log-repo-');
    const shims = makeDir('stop-failure-log-shim-');
    try {
        const res = runHook(failurePayload(repo), repo, {
            NODE_OPTIONS: failingFsPreload(shims, 'writeFileSync', 'stop-failure-latest.json.tmp.')
        });
        assertSilentSuccess(res);
        assert.ok(!fs.existsSync(latestPath(repo)), 'the marker write genuinely failed');
        assert.strictEqual(readEvents(repo).length, 1,
            'the append is independent of the marker write');
    } finally {
        rmDir(repo);
        rmDir(shims);
    }
});

test('a failing rename leaves no tmp orphan in .kit/', () => {
    // The tmp exists at this point, so this is the case the unlink-on-failed-
    // rename cleanup is for: without it a .kit/ would accumulate one orphan per
    // failure.
    const repo = makeDir('stop-failure-log-repo-');
    const shims = makeDir('stop-failure-log-shim-');
    try {
        const res = runHook(failurePayload(repo), repo, {
            NODE_OPTIONS: failingFsPreload(shims, 'renameSync', 'stop-failure-latest.json.tmp.')
        });
        assertSilentSuccess(res);
        assert.ok(!fs.existsSync(latestPath(repo)), 'the rename genuinely failed');
        const leftovers = fs.readdirSync(path.join(repo, '.kit')).filter((n) => n.includes('.tmp.'));
        assert.deepStrictEqual(leftovers, [], 'the failed rename unlinked its tmp');
        assert.strictEqual(readEvents(repo).length, 1, 'the append still happened');
    } finally {
        rmDir(repo);
        rmDir(shims);
    }
});

test('a .kit/ that cannot be created exits 0 with nothing written', () => {
    // Both writes fail together here, which is the widest failure this hook can
    // meet. It must still be a silent exit 0.
    const repo = makeDir('stop-failure-log-repo-');
    const shims = makeDir('stop-failure-log-shim-');
    try {
        const res = runHook(failurePayload(repo), repo, {
            NODE_OPTIONS: failingFsPreload(shims, 'mkdirSync', '.kit')
        });
        assertSilentSuccess(res);
        assert.ok(!fs.existsSync(path.join(repo, '.kit')), 'nothing was written');
    } finally {
        rmDir(repo);
        rmDir(shims);
    }
});

// ---------------------------------------------------------------------------
// Where the records land.
// ---------------------------------------------------------------------------

test('the payload cwd decides the project, not the process cwd', () => {
    const repo = makeDir('stop-failure-log-repo-');
    const elsewhere = makeDir('stop-failure-log-elsewhere-');
    try {
        assertSilentSuccess(runHook(failurePayload(repo), elsewhere));
        assert.strictEqual(readLatest(repo).error, 'rate_limit', 'the record landed in the payload cwd');
        assert.ok(!fs.existsSync(path.join(elsewhere, '.kit')), 'nothing landed in the process cwd');
    } finally {
        rmDir(repo);
        rmDir(elsewhere);
    }
});

test('a payload with no cwd falls back to the process cwd', () => {
    const repo = makeDir('stop-failure-log-repo-');
    try {
        const payload = failurePayload(repo);
        delete payload.cwd;
        assertSilentSuccess(runHook(payload, repo));
        assert.strictEqual(readLatest(repo).error, 'rate_limit');
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// Wiring.
// ---------------------------------------------------------------------------

test('hooks.json wires the logger on StopFailure', () => {
    // The hook is inert unwired, and StopFailure is the only event that carries
    // an API-error turn death: a rewiring that moved it would disarm the whole
    // recovery path silently.
    const wiring = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'hooks.json'), 'utf8'));
    const blocks = wiring.hooks.StopFailure;
    assert.ok(Array.isArray(blocks) && blocks.length > 0, 'a StopFailure block is present');
    const commands = blocks.flatMap((b) => b.hooks.map((h) => h.command));
    assert.ok(commands.some((c) => c === 'node "${CLAUDE_PLUGIN_ROOT}/hooks/stop-failure-log.js"'),
        'the logger is wired with the sibling blocks\' exact command shape; got: ' + commands.join(', '));
});
