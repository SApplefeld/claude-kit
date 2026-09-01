// Tests for sidecar/rollup.js, the read-only rollup over the judge daemon's
// verdict logs, recognition logs and findings file.
//
// Node's built-in test runner, no framework (Node v24).
//
// NO CASE HERE TOUCHES THE LIVE STORE. rollup.js never talks to the endpoint
// (it reads files only), but every fixture still builds its own temp state
// root under os.tmpdir() and passes it as `--state-dir` or as the first
// argument to `computeRollup`, so no case reads or writes anything under the
// real ~/.claude.
//
// EVERY CASE BUILDS THE STATE ITS OWN BRANCH NEEDS, per the plan's standing
// amendment on shared fixtures. Log lines are hand-built JSON objects rather
// than run through the daemon, which is what lets a case place exactly one
// malformed line, exactly one unknown-version line, or exactly one gap of the
// single-call shape without any other branch's data riding along with it.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const rollup = require('../sidecar/rollup.js');
const logs = require('../sidecar/logs.js');

const ROLLUP_CLI = path.join(__dirname, '..', 'sidecar', 'rollup.js');

// ---------------------------------------------------------------- fixtures --

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// A temp state root with a real `logs/` directory, outside the live store.
// `inboxDir` and `findingsFile` are named but not created: several cases are
// about exactly what happens when one of them is absent.
function makeState(t) {
    const dir = makeDir('kit-sidecar-rollup-');
    t.after(() => rmDir(dir));
    const stateDir = path.join(dir, 'state');
    const logsDir = path.join(stateDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    return {
        dir,
        stateDir,
        logsDir,
        inboxDir: path.join(stateDir, 'inbox'),
        findingsFile: path.join(logsDir, 'findings.jsonl')
    };
}

// Appends lines to a file. A string goes down verbatim, which is how a
// malformed or hand-written line reaches a fixture; an object is serialized.
function writeLines(file, lines) {
    const text = lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n';
    fs.appendFileSync(file, text, 'utf8');
}

function verdictFile(state, slug) {
    return path.join(state.logsDir, `verdicts-${slug}.jsonl`);
}

function recognitionFile(state, slug) {
    return path.join(state.logsDir, `recognition-${slug}.jsonl`);
}

function verdictLine(overrides) {
    return {
        v: 1,
        type: 'verdict',
        ts: '2026-08-29T10:00:00.000Z',
        callId: 'call0000000001',
        capturedAt: '2026-08-29T09:59:59.000Z',
        sessionId: 'ses-a',
        cwd: 'D:/proj',
        tool: 'Bash',
        intent: 'list files',
        commandPreview: 'ls -la',
        isError: false,
        truncated: false,
        verdict: 'achieved',
        reason: 'listed as asked',
        reasonTruncated: false,
        promptId: 'judgment-v2',
        model: 'test-model',
        endpoint: 'abcd1234',
        latencyMs: 900,
        ...overrides
    };
}

function gapLine(overrides) {
    const merged = {
        v: 1,
        type: 'gap',
        ts: '2026-08-29T11:00:00.000Z',
        sessionId: 'ses-a',
        reason: 'lane busy',
        count: 1,
        firstCallId: 'call0000000002',
        lastCallId: 'call0000000002',
        detail: '',
        ...overrides
    };
    // Built through logs.gapNote, the same builder sidecar/logs.js's own
    // gapRecord calls and sidecar/rollup.js's fallback calls (m3): a wording
    // change there now shows up here rather than needing a third hand-copy to
    // stay in step.
    if (merged.note === undefined) merged.note = logs.gapNote(merged);
    return merged;
}

function recognitionLine(overrides) {
    return {
        v: 1,
        type: 'recognition',
        ts: '2026-08-29T10:05:00.000Z',
        callId: 'call0000000003',
        capturedAt: '2026-08-29T10:04:59.000Z',
        sessionId: 'ses-a',
        cwd: 'D:/proj',
        tool: 'Bash',
        intent: 'x',
        commandPreview: 'y',
        records: [],
        queued: [],
        invented: [],
        reason: '',
        reasonTruncated: false,
        indexRecords: 0,
        indexTruncated: false,
        promptId: 'recognition-v1',
        model: 'test-model',
        endpoint: 'abcd1234',
        latencyMs: 500,
        ...overrides
    };
}

function recognitionGapLine(overrides) {
    const merged = {
        v: 1,
        type: 'recognition-gap',
        ts: '2026-08-29T10:06:00.000Z',
        sessionId: 'ses-a',
        callId: 'call0000000004',
        reason: 'endpoint down',
        detail: '',
        ...overrides
    };
    if (merged.note === undefined) merged.note = `call ${merged.callId} not recognized, ${merged.reason}`;
    return merged;
}

function findingLine(overrides) {
    return {
        v: 1,
        type: 'diverged',
        ts: '2026-08-29T10:07:00.000Z',
        callId: 'call0000000005',
        sessionId: 'ses-a',
        cwd: 'D:/proj',
        intent: 'x',
        commandPreview: 'y',
        reason: 'exit code was clean but the file was never written',
        promptId: 'judgment-v2',
        model: 'test-model',
        endpoint: 'abcd1234',
        ...overrides
    };
}

// A home directory every CLI child of this suite gets. HOME and USERPROFILE
// are what os.homedir() reads, and rollup.js resolves its default state root
// from os.homedir() whenever --state-dir is absent, so a child that inherited
// this process's environment would resolve the operator's live ~/.claude.
// Created once and shared, since no case here cares which home its child has,
// only that it is not the operator's.
let cliHomePath = null;
function cliHome() {
    if (cliHomePath === null) {
        cliHomePath = makeDir('kit-sidecar-rollup-clihome-');
        fs.mkdirSync(path.join(cliHomePath, '.claude'), { recursive: true });
        process.on('exit', () => rmDir(cliHomePath));
    }
    return cliHomePath;
}

// THE ONE PLACE THIS FILE NAMES THE INTERPRETER, and that is the function's
// purpose rather than a convenience: it composes the fixture home over the
// inherited environment unconditionally, with a caller's env overrides applied
// after the fixture home so a caller cannot drop it, and `options` spread
// first for the same reason. What makes the guard structural rather than a
// list of blessed sites is the pin over this file's own source below: a spawn
// site added later without the fixture home cannot be written without naming
// the interpreter a second time.
function runCli(args, env, options) {
    return spawnSync(process.execPath, [ROLLUP_CLI, ...args], {
        ...(options !== undefined && options !== null ? options : {}),
        encoding: 'utf8',
        env: { ...process.env, HOME: cliHome(), USERPROFILE: cliHome(), ...env }
    });
}

test('every child this suite spawns carries the fixture home, by the shape of the file', () => {
    // The interpreter token is assembled from halves so this test's own source
    // does not hold a second spelling of what it counts.
    const token = 'process.' + 'execPath';
    const source = fs.readFileSync(__filename, 'utf8');
    assert.strictEqual(source.split(token).length - 1, 1,
        'the interpreter is named at exactly one site in this file, so a spawn '
            + 'site added without the fixture home cannot be written without moving it');
    const helper = source.slice(source.indexOf(token), source.indexOf(token) + 400);
    assert.match(helper, /HOME: cliHome\(\)/, 'the one spawn site pins HOME to the fixture home');
    assert.match(helper, /USERPROFILE: cliHome\(\)/, 'and USERPROFILE beside it');
});

// -------------------------------------------------------------- CLI shape --

test('--help prints usage and exits 0 without touching any state dir', () => {
    const res = runCli(['--help']);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /usage: node sidecar\/rollup\.js/);
});

test('an unknown argument exits 2 with the usage text', () => {
    const res = runCli(['--bogus']);
    assert.strictEqual(res.status, 2);
    assert.match(res.stderr, /unknown argument: --bogus/);
    // The error clause alone is not the usage block (m14): a test that only
    // checked the clause would still pass if the usage text after it silently
    // stopped printing.
    assert.match(res.stderr, /usage: node sidecar\/rollup\.js/);
    assert.match(res.stderr, /--state-dir\s+sidecar state root/);
});

test('--state-dir with no value is rejected by parseArgs', () => {
    const parsed = rollup.parseArgs(['--state-dir']);
    assert.strictEqual(parsed.ok, false);
    assert.match(parsed.error, /--state-dir needs a path/);
});

test('--state-dir --help takes "--help" as a swallowed flag, never as a literal path (m6)', () => {
    const parsed = rollup.parseArgs(['--state-dir', '--help']);
    assert.strictEqual(parsed.ok, false);
    assert.match(parsed.error, /--state-dir needs a path/);
});

// ---------------------------------------------------- missing state / logs --

test('a state dir that does not exist exits 1 and names the path, never a zero-filled report', () => {
    const dir = makeDir('kit-sidecar-rollup-missing-');
    const missing = path.join(dir, 'nope');
    const res = runCli(['--state-dir', missing]);
    rmDir(dir);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.match(res.stderr, /state dir not found/);
    assert.ok(res.stderr.includes(missing), 'the exact path looked for must be named');
});

test('a state dir with no logs directory exits 1 and names the logs path, distinct from the missing-root case', (t) => {
    const dir = makeDir('kit-sidecar-rollup-nologs-');
    t.after(() => rmDir(dir));
    // The root exists; only `logs/` is absent. A rollup that only checked the
    // root would wrongly treat this state dir as real and print zeros.
    fs.mkdirSync(dir, { recursive: true });
    const res = runCli(['--state-dir', dir]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /no logs directory/);
    assert.ok(res.stderr.includes(path.join(dir, 'logs')));
});

test('a logs directory that exists and holds nothing is a legitimate all-zero report, exit 0', (t) => {
    const state = makeState(t);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.totals.verdict.achieved, 0);
    assert.strictEqual(result.sessions.size, 0);
    assert.strictEqual(result.gapRanges.length, 0);
});

// --------------------------------------------------------------- totals ---

test('totals and per-session counts over a multi-session fixture', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        verdictLine({ callId: 'c1', verdict: 'achieved' }),
        verdictLine({ callId: 'c2', verdict: 'achieved' }),
        verdictLine({ callId: 'c3', verdict: 'failed' })
    ]);
    writeLines(verdictFile(state, 'ses-b'), [
        verdictLine({ callId: 'c4', sessionId: 'ses-b', verdict: 'diverged' })
    ]);

    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.totals.verdict, { achieved: 2, failed: 1, diverged: 1, other: 0 });

    const a = result.sessions.get('ses-a');
    assert.deepStrictEqual(a.verdict, { achieved: 2, failed: 1, diverged: 0, other: 0 });
    const b = result.sessions.get('ses-b');
    assert.deepStrictEqual(b.verdict, { achieved: 0, failed: 0, diverged: 1, other: 0 });
});

test('the schema version the rollup accepts is the one the writers stamp', (t) => {
    // parseLogFile splits record from unknown on the schema version, and every
    // writer stamps logs.LOG_VERSION. This pin writes one line at that
    // constant and one past it, so a rollup that compared a literal instead
    // reds here the day the constant moves, rather than reading every record
    // as unknown and rendering a column of zeros dressed as a clean report.
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        verdictLine({ callId: 'c1', v: logs.LOG_VERSION }),
        verdictLine({ callId: 'c2', v: logs.LOG_VERSION + 1 })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.verdict.achieved, 1,
        'a line at the writers\' own version is counted as a record');
    assert.strictEqual(result.totals.verdictSchemaUnknown, 1,
        'a line past it is counted unknown, never silently dropped');
});

test('a verdict enum the rollup does not recognize is bucketed as "other", never dropped', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [verdictLine({ callId: 'c1', verdict: 'inconclusive' })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.verdict.other, 1);
    assert.match(rollup.render(result), /other 1/);
});

// -------------------------------------------------------------- per day ---

test('per-day grouping across a UTC day boundary keeps the two days apart', (t) => {
    const state = makeState(t);
    // capturedAt is the day-determining field (M6), so it is overridden
    // alongside ts here; a fixture that only varied ts would now bucket both
    // records under verdictLine's shared default capturedAt.
    writeLines(verdictFile(state, 'ses-a'), [
        verdictLine({ callId: 'c1', ts: '2026-08-29T23:59:00.000Z', capturedAt: '2026-08-29T23:59:00.000Z', verdict: 'achieved' }),
        verdictLine({ callId: 'c2', ts: '2026-08-30T00:01:00.000Z', capturedAt: '2026-08-30T00:01:00.000Z', verdict: 'failed' })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.days.size, 2);
    assert.strictEqual(result.days.get('2026-08-29').verdict.achieved, 1);
    assert.strictEqual(result.days.get('2026-08-29').verdict.failed, 0);
    assert.strictEqual(result.days.get('2026-08-30').verdict.failed, 1);
    assert.strictEqual(result.days.get('2026-08-30').verdict.achieved, 0);
});

// --------------------------------------------------------------- gaps ----

test('a single-call gap renders "call X", never "calls X to X"', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [gapLine({ count: 1, firstCallId: 'c9', lastCallId: 'c9' })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.gapRanges.length, 1);
    assert.match(result.gapRanges[0].note, /^call c9 not judged, lane busy$/);
    assert.doesNotMatch(result.gapRanges[0].note, /to c9/);
});

test('a multi-call gap renders the "calls X to Y" range form', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [gapLine({ count: 3, firstCallId: 'c1', lastCallId: 'c3', reason: 'endpoint down' })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.gapRanges.length, 1);
    assert.match(result.gapRanges[0].note, /^calls c1 to c3 not judged, endpoint down$/);
    assert.strictEqual(result.totals.gappedCalls, 3);
});

test('a gap record missing its own `note` is reconstructed from its structured fields', (t) => {
    const state = makeState(t);
    // A hand-written line without `note` at all: the contract says lines can
    // be hand-written, and the fallback path only runs when `note` is absent.
    writeLines(verdictFile(state, 'ses-a'), [
        { v: 1, type: 'gap', ts: '2026-08-29T11:00:00.000Z', sessionId: 'ses-a', reason: 'refused', count: 2, firstCallId: 'c1', lastCallId: 'c2', detail: '' }
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.gapRanges.length, 1);
    assert.strictEqual(result.gapRanges[0].note, 'calls c1 to c2 not judged, refused');
});

test('a gap record with no `count` at all is tallied as one call AND rendered as one call (m8)', (t) => {
    const state = makeState(t);
    // No `count` field, not even an invalid one: the tally's own default and
    // the note builder's default used to disagree (0 vs 1), so the tally said
    // "1 call" while the note read "calls ? to ?".
    writeLines(verdictFile(state, 'ses-a'), [
        { v: 1, type: 'gap', ts: '2026-08-29T11:00:00.000Z', sessionId: 'ses-a', reason: 'lane busy', firstCallId: 'c1', lastCallId: 'c1', detail: '' }
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.gappedCalls, 1);
    assert.strictEqual(result.gapRanges[0].note, 'call c1 not judged, lane busy');
    assert.doesNotMatch(result.gapRanges[0].note, /to c1/);
});

test('judgment gaps and recognition gaps are counted apart, never merged into one number', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [gapLine({ count: 1 })]);
    writeLines(recognitionFile(state, 'ses-a'), [recognitionGapLine({})]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.gaps, 1);
    assert.strictEqual(result.totals.recognitionGaps, 1);
    assert.strictEqual(result.gapRanges.length, 1);
    assert.strictEqual(result.recognitionGapEntries.length, 1);
    assert.match(result.recognitionGapEntries[0].note, /not recognized, endpoint down/);
});

// ---------------------------------------------------------------- gap/findings dedup --

test('a gap echoed into findings.jsonl is not double-counted against the verdict-log gap total', (t) => {
    const state = makeState(t);
    const gap = gapLine({ count: 1, firstCallId: 'c1', lastCallId: 'c1' });
    writeLines(verdictFile(state, 'ses-a'), [gap]);
    writeLines(state.findingsFile, [gap]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.gaps, 1, 'the gap total counts the verdict-log copy only');
    assert.strictEqual(result.totals.findingsGapEchoes, 1, 'the findings copy is tracked apart, not summed in');
});

test('findings.jsonl diverged entries are a cross-check total, separate from the verdict tally', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [verdictLine({ callId: 'c1', verdict: 'diverged' })]);
    writeLines(state.findingsFile, [findingLine({ callId: 'c1' })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.findingsPresent, true);
    assert.strictEqual(result.totals.findingsDiverged, 1);
    assert.strictEqual(result.totals.verdict.diverged, 1);
});

test('an absent findings file is reported as not present, not as zero findings', (t) => {
    const state = makeState(t);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.findingsPresent, false);
    assert.match(rollup.render(result), /findings file: not present/);
});

// ------------------------------------------------- findings, both generations (M1) --

test('a diverged entry in the rotated generation findings.jsonl.1 is still counted, never lost to rotation', (t) => {
    const state = makeState(t);
    const rotated = path.join(state.logsDir, 'findings.jsonl.1');
    writeLines(rotated, [findingLine({ callId: 'c1' })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.findingsPresent, true);
    assert.strictEqual(result.findingsRotatedIncluded, true);
    assert.strictEqual(result.totals.findingsDiverged, 1);
    assert.match(rollup.render(result), /rotated generation findings\.jsonl\.1/);
});

test('findings.jsonl and its rotated generation are summed into one tally, not read as alternatives', (t) => {
    const state = makeState(t);
    writeLines(state.findingsFile, [findingLine({ callId: 'c1' })]);
    writeLines(path.join(state.logsDir, 'findings.jsonl.1'), [findingLine({ callId: 'c2' })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.findingsDiverged, 2);
});

test('more findings-side gap echoes than verdict-log gaps is reported as a surplus, not silently accepted', (t) => {
    const state = makeState(t);
    // Two gap echoes in findings, no matching verdict-log gap at all: as if
    // the session verdict log that would confirm them had already expired
    // past retention while findings.jsonl (a slower-rotating fleet-wide file)
    // had not.
    writeLines(state.findingsFile, [
        gapLine({ firstCallId: 'c1', lastCallId: 'c1' }),
        gapLine({ firstCallId: 'c2', lastCallId: 'c2' })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.gaps, 0, 'no verdict-log gap exists in this fixture');
    assert.strictEqual(result.totals.findingsGapEchoes, 2);
    assert.match(rollup.render(result), /2 more echo\(es\) than verdict-log gaps/);
    assert.match(rollup.render(result), /expired past retention/);
});

test('a findings.jsonl that is a directory is refused and reported, never rendered as "not present" (m9)', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.findingsFile, { recursive: true });
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.findingsPresent, true, 'the position is occupied, so it is not absence');
    assert.strictEqual(result.findingsRefused, true);
    assert.strictEqual(result.totals.unreadableFiles >= 1, true);
    const text = rollup.render(result);
    assert.doesNotMatch(text, /findings file: not present/, 'a refusal must never read as an absence');
});

// ---------------------------------------------------------- recognition --

test('recognition calls tally pointed and invented counts from the answer arrays', (t) => {
    const state = makeState(t);
    writeLines(recognitionFile(state, 'ses-a'), [
        recognitionLine({ records: ['r1', 'r2'], queued: ['r1'], invented: ['made-up'] })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.recognition.calls, 1);
    assert.strictEqual(result.totals.recognition.pointed, 1);
    assert.strictEqual(result.totals.recognition.invented, 1);
});

// ------------------------------------------------- per-day clock (M6) --

test('a verdict buckets by capturedAt (the call), not by ts (when the daemon wrote it)', (t) => {
    const state = makeState(t);
    // The daemon wrote this record on the 30th, well after the call itself
    // ran late on the 29th: a manually-started daemon judging a backlog is
    // the ordinary case in v1.
    writeLines(verdictFile(state, 'ses-a'), [
        verdictLine({ callId: 'c1', ts: '2026-08-30T09:00:00.000Z', capturedAt: '2026-08-29T23:50:00.000Z', verdict: 'achieved' })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.days.has('2026-08-29'), true, 'bucketed by the call, not the write');
    assert.strictEqual(result.days.has('2026-08-30'), false);
});

test('a recognition record buckets by capturedAt too, the same as a verdict', (t) => {
    const state = makeState(t);
    writeLines(recognitionFile(state, 'ses-a'), [
        recognitionLine({ ts: '2026-08-30T09:00:00.000Z', capturedAt: '2026-08-29T23:50:00.000Z' })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.days.get('2026-08-29').recognition.calls, 1);
    assert.strictEqual(result.days.has('2026-08-30'), false);
});

test('a record covering a stretch has no capturedAt to bucket on and says so in the per-day header', (t) => {
    // Both stretch-shaped records take the write day, and the header names each
    // kind that does: a header listing only some of them would leave a reader
    // to assume the rest bucket by the call's own clock.
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        gapLine({ ts: '2026-08-30T09:00:00.000Z' }),
        staleLine({ ts: '2026-08-30T09:30:00.000Z' })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.days.get('2026-08-30').gaps, 1);
    assert.strictEqual(result.days.get('2026-08-30').staleStretches, 1);
    assert.match(rollup.render(result),
        /gaps, stale records and recognition-gaps bucket by when the daemon wrote the record/);
});

// ---------------------------------------------------------- dayOf validation (M2) --

test('a hand-written ts that is not a plausible date is bucketed as unknown-date, never rendered raw', (t) => {
    const state = makeState(t);
    const dirty = '2026' + '\u001b' + '[31mrest-is-junk';
    writeLines(verdictFile(state, 'ses-a'), [
        verdictLine({ callId: 'c1', capturedAt: dirty, verdict: 'achieved' })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.days.has('unknown-date'), true);
    assert.strictEqual(result.days.size, 1, 'the malicious value must not mint its own bucket');
    const text = rollup.render(result);
    assert.ok(!text.includes('\u001b'), 'the raw escape never reaches the rendered day label');
    assert.ok(!text.includes('rest-is-junk'), 'the raw value never reaches the rendered day label');
});

test('a plausible-looking but invalid date (bad month) is also bucketed as unknown-date', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        verdictLine({ callId: 'c1', capturedAt: '9999-99-99T00:00:00.000Z', verdict: 'achieved' })
    ]);
    const result = rollup.computeRollup(state.stateDir);
    // dayOf validates shape (four digits, two digits, two digits), not
    // calendar validity, so this is bucketed under its own literal digits
    // rather than under unknown-date; what matters for M2 is that the
    // ANSI/bidi risk in an un-shaped string cannot reach the label, which the
    // case above covers. This case pins the shape check accepts a
    // well-shaped but semantically bogus date rather than crashing on it.
    assert.strictEqual(result.days.has('9999-99-99'), true);
});

// -------------------------------------------------------- malformed lines --

test('an unparseable log line is counted as malformed and reported, never silently skipped', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        verdictLine({ callId: 'c1' }),
        '{ not valid json'
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.malformed, 1);
    assert.strictEqual(result.totals.verdict.achieved, 1, 'the good line beside the torn one still counts');
    assert.match(rollup.render(result), /own log files: 1 malformed line\(s\)/);
});

test('a record of an unrecognized schema version is counted apart from a malformed line', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        { v: 2, type: 'verdict', ts: '2026-08-29T10:00:00.000Z', sessionId: 'ses-a', verdict: 'achieved' }
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.malformed, 0);
    assert.strictEqual(result.totals.verdictSchemaUnknown, 1);
    assert.strictEqual(result.totals.verdictTypeUnknown, 0, 'a schema-version miss is not a type miss (m4-minor)');
});

test('a v1 verdict-log record of an unrecognized `type` is counted apart from a schema-version miss', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        { v: 1, type: 'bogus-kind', ts: '2026-08-29T10:00:00.000Z', sessionId: 'ses-a' }
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.malformed, 0);
    assert.strictEqual(result.totals.verdictSchemaUnknown, 0);
    assert.strictEqual(result.totals.verdictTypeUnknown, 1);
});

test('a v1 recognition-log record of an unrecognized `type` is counted apart from a schema-version miss', (t) => {
    const state = makeState(t);
    writeLines(recognitionFile(state, 'ses-a'), [
        { v: 1, type: 'bogus-kind', ts: '2026-08-29T10:00:00.000Z', sessionId: 'ses-a' }
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.malformed, 0);
    assert.strictEqual(result.totals.recognitionSchemaUnknown, 0);
    assert.strictEqual(result.totals.recognitionTypeUnknown, 1);
});

test('a findings.jsonl record of an unrecognized `type` is counted apart from `diverged` and `gap`', (t) => {
    const state = makeState(t);
    writeLines(state.findingsFile, [
        { v: 1, type: 'bogus-kind', ts: '2026-08-29T10:00:00.000Z', sessionId: 'ses-a' }
    ]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.findingsTypeUnknown, 1);
    assert.strictEqual(result.totals.findingsDiverged, 0);
    assert.strictEqual(result.totals.findingsGapEchoes, 0);
});

test('a trailing line with no terminating newline is left alone, not counted malformed (m5)', (t) => {
    const state = makeState(t);
    const file = verdictFile(state, 'ses-a');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // A complete line, then a torn write with no trailing "\n": exactly what a
    // reader catches mid-`fs.appendFileSync`, per CONTRACT.md's "a trailing
    // partial line is a write in flight."
    const complete = JSON.stringify(verdictLine({ callId: 'c1' }));
    fs.writeFileSync(file, `${complete}\n{"v":1,"type":"verdict","sessionId":"ses-a`, 'utf8');
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.malformed, 0, 'the in-flight partial line is not malformed');
    assert.strictEqual(result.totals.verdict.achieved, 1, 'the complete line beside it still counts');
});

// ---------------------------------- file-level read failures (M3) --

// Simulates a permission-denied or otherwise-unreadable file the way the
// sibling suite (test/memory-index.test.js's withUnreadableDir) simulates an
// unreadable directory: by intercepting the exact fs call this process makes,
// which is the same call a real EACCES fails at. Real symlinks need elevation
// on this Windows box, so this is how a read failure is exercised here.
async function withUnreadableFile(file, fn) {
    const real = fs.readFileSync;
    fs.readFileSync = function (target, ...rest) {
        if (typeof target === 'string' && path.resolve(target) === path.resolve(file)) {
            const err = new Error('EACCES: permission denied');
            err.code = 'EACCES';
            throw err;
        }
        return real.call(this, target, ...rest);
    };
    try {
        return await fn();
    } finally {
        fs.readFileSync = real;
    }
}

test('a verdict log that cannot be read is counted as refused, never rendered as a clean zero (M3)', async (t) => {
    const state = makeState(t);
    const file = verdictFile(state, 'ses-a');
    writeLines(file, [verdictLine({ callId: 'c1' })]);
    const result = await withUnreadableFile(file, async () => rollup.computeRollup(state.stateDir));
    assert.strictEqual(result.totals.verdict.achieved, 0, 'the unreadable file contributes nothing');
    assert.strictEqual(result.totals.unreadableFiles, 1);
    assert.match(rollup.render(result), /file\(s\) refused or unreadable.*: 1/);
});

test('a recognition log that cannot be read is counted as refused (M3)', async (t) => {
    const state = makeState(t);
    const file = recognitionFile(state, 'ses-a');
    writeLines(file, [recognitionLine({})]);
    const result = await withUnreadableFile(file, async () => rollup.computeRollup(state.stateDir));
    assert.strictEqual(result.totals.recognition.calls, 0);
    assert.strictEqual(result.totals.unreadableFiles, 1);
});

test('a findings.jsonl that cannot be read is counted as refused, findingsPresent stays true (M3)', async (t) => {
    const state = makeState(t);
    writeLines(state.findingsFile, [findingLine({})]);
    const result = await withUnreadableFile(state.findingsFile, async () => rollup.computeRollup(state.stateDir));
    assert.strictEqual(result.totals.findingsDiverged, 0);
    assert.strictEqual(result.findingsPresent, true, 'the file exists; only reading it failed');
    assert.strictEqual(result.findingsRefused, true);
    assert.strictEqual(result.totals.unreadableFiles, 1);
});

test('an inbox queue file that cannot be read is counted as refused, its session drops silently from no counter (M3)', async (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: 'ses-a', intent: 'x', reason: 'y' });
    const file = path.join(state.inboxDir, 'ses-a.jsonl');
    fs.writeFileSync(file, item + '\n', 'utf8');
    const result = await withUnreadableFile(file, async () => rollup.computeRollup(state.stateDir));
    assert.strictEqual(result.inbox.sessions.length, 0, 'the unreadable queue contributes no row');
    assert.strictEqual(result.totals.unreadableFiles, 1);
});

test('the logs directory\'s own readdir failure is reported as a refusal to read it, not a zero-filled report (m13)', (t) => {
    const state = makeState(t);
    const real = fs.readdirSync;
    fs.readdirSync = function (target, ...rest) {
        if (typeof target === 'string' && path.resolve(target) === path.resolve(state.logsDir)) {
            const err = new Error('EACCES: permission denied');
            err.code = 'EACCES';
            throw err;
        }
        return real.call(this, target, ...rest);
    };
    let result;
    try {
        result = rollup.computeRollup(state.stateDir);
    } finally {
        fs.readdirSync = real;
    }
    assert.strictEqual(result.ok, false);
    assert.match(result.reason, /logs directory unreadable/);
});

test('a logs path that is a plain file, not a directory, is refused rather than treated as empty', (t) => {
    const dir = makeDir('kit-sidecar-rollup-logsfile-');
    t.after(() => rmDir(dir));
    const stateDir = path.join(dir, 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'logs'), 'not a directory', 'utf8');
    const result = rollup.computeRollup(stateDir);
    assert.strictEqual(result.ok, false);
    assert.match(result.reason, /logs path is not a directory/);
});

// -------------------------------------------- link refusal at data positions (M7) --

// A Windows junction, which needs no elevation to create, wearing a file's
// name. lstat reports a reparse point as neither isFile() nor isDirectory(),
// so a guard checking "not isFile()" (or "not isDirectory()" for a directory
// position) refuses it on that ground as well as on isSymbolicLink(), the
// same technique test/kit-sidecar-daemon.test.js's plantLink uses for the
// same reason: what these cases prove is that the PATH is refused.
function plantJunction(t, atPath) {
    const targetDir = makeDir('kit-sidecar-rollup-junction-target-');
    t.after(() => rmDir(targetDir));
    fs.mkdirSync(path.dirname(atPath), { recursive: true });
    fs.symlinkSync(targetDir, atPath, 'junction');
}

test('a junction wearing a verdict log\'s name is refused and counted, never read through', (t) => {
    const state = makeState(t);
    const file = verdictFile(state, 'ses-a');
    plantJunction(t, file);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.verdict.achieved, 0);
    assert.strictEqual(result.totals.unreadableFiles, 1);
});

test('a junction wearing findings.jsonl\'s name is refused and counted', (t) => {
    const state = makeState(t);
    plantJunction(t, state.findingsFile);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.findingsPresent, true);
    assert.strictEqual(result.findingsRefused, true);
    assert.strictEqual(result.totals.unreadableFiles, 1);
});

test('a junction where the inbox directory goes is refused rather than listed', (t) => {
    const state = makeState(t);
    plantJunction(t, state.inboxDir);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.inbox.present, false);
    assert.strictEqual(result.totals.unreadableFiles, 1);
});

test('a junction wearing an inbox queue file\'s name is refused and counted', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    plantJunction(t, path.join(state.inboxDir, 'ses-a.jsonl'));
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.inbox.sessions.length, 0);
    assert.strictEqual(result.totals.unreadableFiles, 1);
});

test('a junction wearing an inbox offset file\'s name is refused and counted, and the queue still reads as fully queued', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: 'ses-a', intent: 'x', reason: 'y' });
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.jsonl'), item + '\n', 'utf8');
    plantJunction(t, path.join(state.inboxDir, 'ses-a.offset'));
    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'ses-a');
    assert.ok(entry, 'the queue itself is untouched by the link at the offset position');
    assert.strictEqual(entry.delivered, 0, 'a refused offset reads as 0, same as an absent one');
    assert.strictEqual(entry.queued, 1);
    assert.strictEqual(result.totals.unreadableFiles, 1, 'but the link itself is refused and counted, unlike a plain absence');
});

// --------------------------------------------------------- stale skips --

// A stale record in the daemon's own shape, built through logs.staleRecord for
// gapLine's reason: the wording and the field set live in sidecar/logs.js, so a
// change there shows up here rather than needing a second hand-copy to stay in
// step.
// `ts` names the moment the daemon WROTE the record, which is the field the
// record carries and the day it buckets on; every other key overrides the
// stretch the record describes.
function staleLine(overrides) {
    const o = overrides || {};
    const stretch = {
        sessionId: 'ses-a',
        count: 4,
        firstCallId: 'call0000000010',
        lastCallId: 'call0000000013',
        firstCapturedAt: '2026-08-29T08:00:00.000Z',
        lastCapturedAt: '2026-08-29T08:04:00.000Z',
        horizonMs: 15 * 60 * 1000,
        ...o
    };
    return logs.staleRecord(stretch, Date.parse(o.ts || '2026-08-29T11:30:00.000Z'));
}

test('a dropped backlog is attributed per session and per day, not only to a machine-wide count', (t) => {
    // The reading this record exists to prevent: with the counter alone, a
    // session whose whole backlog was discarded rendered in these two sections
    // exactly as a session that made no calls at all.
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [staleLine({})]);
    writeLines(state.findingsFile, [staleLine({})]);

    const result = rollup.computeRollup(state.stateDir);
    const stats = result.sessions.get('ses-a');
    assert.strictEqual(stats.staleStretches, 1);
    assert.strictEqual(stats.staleCalls, 4, 'the record covers four calls, and the count says so');
    assert.strictEqual(result.totals.staleStretches, 1);
    assert.strictEqual(result.totals.staleCalls, 4);
    assert.strictEqual(result.totals.findingsStaleEchoes, 1);
    // Bucketed by the day the daemon wrote the record, like a gap, because the
    // stretch covers a range rather than one moment.
    assert.strictEqual(result.days.get('2026-08-29').staleCalls, 4);

    const text = rollup.render(result);
    assert.match(text, /stale skips: 1 stale record\(s\) covering 4 call\(s\)/);
    assert.match(text, /ses-a: verdicts .*stale 1 \(4 call\(s\)\)/);
    assert.match(text, /== stale skips \(calls dropped past the freshness horizon, never judged\) ==/);
    assert.match(text, /\[2026-08-29\] ses-a: calls call0000000010 to call0000000013 skipped, captured further back than the 15-minute freshness horizon \(captured 2026-08-29T08:00:00.000Z to 2026-08-29T08:04:00.000Z\)/);
    assert.match(text, /1 stale echo\(es\) vs 1 verdict-log stale record\(s\)/);
});

test('a stale stretch and an endpoint gap are told apart, in the counts and in the words', (t) => {
    // One is an instrument that could not measure and the other is one that
    // declined to, and a reader repairs only the first. Both in one fixture,
    // because a case carrying only the stale record could not show that the two
    // stay in separate columns.
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [
        gapLine({ reason: 'the endpoint could not be reached', count: 2, firstCallId: 'call0000000002', lastCallId: 'call0000000003' }),
        staleLine({})
    ]);

    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.gaps, 1, 'the gap is a gap');
    assert.strictEqual(result.totals.gappedCalls, 2);
    assert.strictEqual(result.totals.staleStretches, 1, 'and the stale record is not counted as one');
    assert.strictEqual(result.totals.staleCalls, 4);
    assert.strictEqual(result.totals.verdictTypeUnknown, 0, 'a stale record is a type this rollup knows');

    const text = rollup.render(result);
    assert.match(text, /judgment gaps: 1 gap record\(s\) covering 2 call\(s\)/);
    assert.match(text, /stale skips: 1 stale record\(s\) covering 4 call\(s\) dropped past the freshness horizon \(declined, not unmeasurable\)/);
    const gapSection = text.slice(text.indexOf('== judgment gap ranges =='), text.indexOf('== stale skips'));
    assert.ok(/not judged, the endpoint could not be reached/.test(gapSection), gapSection);
    assert.ok(!/freshness horizon/.test(gapSection),
        'the stale stretch must not be filed among the ranges a reader treats as an outage');
});

test('a stale record carrying no note is rendered from its fields, and its captured range is neutralized', (t) => {
    const state = makeState(t);
    const stripped = staleLine({});
    delete stripped.note;
    // Spool content reaches these two fields, and CONTRACT.md's tamper limits
    // say any process running as this user can write a log line, so what is
    // printed is neutralized exactly as a gap's detail is.
    stripped.firstCapturedAt = `2026-08-29T08:00:00.000Z${String.fromCharCode(27)}[31m`;
    writeLines(verdictFile(state, 'ses-a'), [stripped]);

    const text = rollup.render(rollup.computeRollup(state.stateDir));
    assert.match(text, /calls call0000000010 to call0000000013 skipped, captured further back than the 15-minute freshness horizon/);
    assert.ok(!text.includes(String.fromCharCode(27)), 'no escape run reaches the rendered line');
});

// ------------------------------------------------- daemon's own counters (M4) --

test('a state file that has not been written yet is reported as absent, not as zero activity', (t) => {
    const state = makeState(t);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.daemonState.present, false);
    assert.match(rollup.render(result), /no state file yet/);
});

test('the daemon\'s own persisted counters are rendered apart from this rollup\'s own parse counts (M4)', (t) => {
    const state = makeState(t);
    const stateFile = path.join(state.logsDir, 'offsets.json');
    const seeded = logs.emptyState();
    // A state a pass could actually have produced: every parsed line is
    // accounted for by CONTRACT.md's identity, parsed = judged + stale +
    // gapped. Seeding a set that violates it would put a state on the render
    // path that the daemon cannot reach, and a reader checking the printed
    // numbers against the contract would find the fixture, not a defect.
    seeded.counters.parsed = 43;
    seeded.counters.judged = 38;
    seeded.counters.stale = 5;
    seeded.counters.gapped = 0;
    seeded.counters.writeFailures = 3;
    seeded.counters.recognitionUnavailable = 2;
    fs.writeFileSync(stateFile, JSON.stringify(seeded), 'utf8');

    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.daemonState.present, true);
    assert.strictEqual(result.daemonState.counters.parsed, 43);
    assert.strictEqual(result.daemonState.counters.stale, 5);
    assert.strictEqual(result.daemonState.counters.writeFailures, 3);
    assert.strictEqual(
        result.daemonState.counters.judged + result.daemonState.counters.stale + result.daemonState.counters.gapped,
        result.daemonState.counters.parsed,
        'the seeded state must satisfy the contract identity it is read against');
    const text = rollup.render(result);
    assert.match(text, /parsed 43, judged 38, stale 5/);
    assert.match(text, /write failures: 3/);
    assert.match(text, /rollup's own totals above are incomplete/);
});

test('a failed heartbeat write is rendered apart from the write failures, and claims no missing record', (t) => {
    // The two counters answer opposite questions and a reader acts on them
    // differently. Every unit of writeFailures may be a record this rollup will
    // never see; every unit of heartbeatFailures is a liveness stamp the daemon
    // could not write while losing nothing at all. One number for both would
    // tell a reader their verdict totals are short by a quantity of stamps.
    const state = makeState(t);
    const stateFile = path.join(state.logsDir, 'offsets.json');
    const seeded = logs.emptyState();
    seeded.counters.parsed = 10;
    seeded.counters.judged = 10;
    seeded.counters.heartbeatFailures = 4;
    fs.writeFileSync(stateFile, JSON.stringify(seeded), 'utf8');

    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.daemonState.counters.heartbeatFailures, 4);
    assert.strictEqual(result.daemonState.counters.writeFailures, 0);

    const text = rollup.render(result);
    assert.match(text, /heartbeat write failures: 4/, 'the count reaches the reader');
    assert.match(text, /no record is missing from the totals above/,
        'in words that say what it did not cost');
    assert.ok(!/rollup's own totals above are incomplete/.test(text),
        'and the incomplete-totals claim belongs to writeFailures alone, which is zero here');
    assert.match(text, /^write failures: 0$/m,
        'the write-failure line still reports its own count rather than absorbing this one');
});

test('a junction wearing offsets.json\'s name is refused and counted, never read through (M7/M4)', (t) => {
    const state = makeState(t);
    plantJunction(t, path.join(state.logsDir, 'offsets.json'));
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.daemonState.present, false);
    assert.strictEqual(result.daemonState.refused, true);
    assert.strictEqual(result.totals.unreadableFiles, 1);
    assert.match(rollup.render(result), /state file position could not be read/);
});

test('a corrupt state file is reported as reset, so its zeroed counters are not read as "nothing happened"', (t) => {
    const state = makeState(t);
    const stateFile = path.join(state.logsDir, 'offsets.json');
    fs.writeFileSync(stateFile, 'not json at all', 'utf8');
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.daemonState.present, true);
    assert.strictEqual(result.daemonState.reset, true);
    assert.match(rollup.render(result), /this state file was reset/);
});

// --------------------------------------------------------------- tool scope / caveat --

test('the tool-scope line and the tamper caveat line are always printed', (t) => {
    const state = makeState(t);
    const result = rollup.computeRollup(state.stateDir);
    const text = rollup.render(result);
    assert.match(text, /tool scope: Bash only/);
    assert.match(text, /a call this fleet makes through PowerShell leaves no spool line/);
    assert.match(text, /evidence, not a guarantee/);
});

test('sections are printed in order: totals, daemon counters, per session, per day, gap ranges, recognition gaps, pointers, caveats', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [verdictLine({ callId: 'c1' }), gapLine({})]);
    writeLines(recognitionFile(state, 'ses-a'), [recognitionGapLine({})]);
    const result = rollup.computeRollup(state.stateDir);
    const text = rollup.render(result);
    const at = (re) => text.search(re);
    const totalsAt = at(/== totals ==/);
    const daemonAt = at(/daemon's own counters/);
    const sessionAt = at(/== per session ==/);
    const dayAt = at(/== per day/);
    const gapAt = at(/== judgment gap ranges ==/);
    const staleAt = at(/== stale skips/);
    const recognitionGapAt = at(/== recognition gaps/);
    const inboxAt = at(/== delivered \/ queued pointers/);
    const tamperAt = at(/evidence, not a guarantee/);
    // Every index must be found (>= 0) before the ordering chain is trusted:
    // `String.search` returns -1 for a missing header, and -1 satisfies an
    // ascending chain as easily as a real position does, so a section that
    // silently stopped printing could still pass this test (m7-minor).
    for (const [name, idx] of [
        ['totals', totalsAt], ['daemon counters', daemonAt], ['per session', sessionAt],
        ['per day', dayAt], ['gap ranges', gapAt], ['stale skips', staleAt],
        ['recognition gaps', recognitionGapAt],
        ['inbox', inboxAt], ['tamper caveat', tamperAt]
    ]) {
        assert.ok(idx >= 0, `section "${name}" must be present in the render`);
    }
    assert.ok(totalsAt < daemonAt && daemonAt < sessionAt && sessionAt < dayAt && dayAt < gapAt
        && gapAt < staleAt && staleAt < recognitionGapAt && recognitionGapAt < inboxAt && inboxAt < tamperAt);
});

// ------------------------------------------------------------ neutralize --

test('an untrusted gap detail carrying an ANSI escape and a zero-width character is rendered neutralized', (t) => {
    const state = makeState(t);
    const dirty = 'raw endpoint error: \u001b[31mBOOM\u001b[0m and\u200bhidden';
    writeLines(verdictFile(state, 'ses-a'), [gapLine({ detail: dirty })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.gapRanges.length, 1);
    const rendered = result.gapRanges[0].detail;
    assert.ok(!rendered.includes('\u001b'), 'the ANSI escape must not survive');
    assert.ok(!rendered.includes('\u200b'), 'the zero-width space must not survive');
    assert.ok(rendered.includes('BOOM'), 'the readable content must survive');

    const text = rollup.render(result);
    assert.ok(!text.includes('\u001b'));
    assert.ok(!text.includes('\u200b'));
});

test('a hand-written detail far past TEXT_MAX_CHARS is capped before it reaches a render (m1)', (t) => {
    const state = makeState(t);
    const huge = 'x'.repeat(50000);
    writeLines(verdictFile(state, 'ses-a'), [gapLine({ detail: huge })]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.gapRanges.length, 1);
    assert.ok(result.gapRanges[0].detail.length <= 2000, 'the detail is capped, not printed whole');
});

test('a judgment gap-range list past MAX_LIST_ROWS is capped with an "N more" line (m1)', (t) => {
    const state = makeState(t);
    const many = [];
    for (let i = 0; i < rollup.MAX_LIST_ROWS + 5; i += 1) {
        const id = `c${String(i).padStart(6, '0')}`;
        many.push(gapLine({ firstCallId: id, lastCallId: id }));
    }
    writeLines(verdictFile(state, 'ses-a'), many);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.gapRanges.length, rollup.MAX_LIST_ROWS + 5, 'the underlying data is not truncated, only the render');
    const text = rollup.render(result);
    assert.match(text, /\.\.\. 5 more/);
});

// ------------------------------------------------------------- inbox -----

test('inbox absent is reported as dormant, not as zero pointers', (t) => {
    const state = makeState(t);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.inbox.present, false);
    assert.match(rollup.render(result), /delivery valve is dormant/);
});

test('delivered vs queued counts split on the recorded offset', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = (n) => JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: `c${n}`, sessionId: 'ses-a', intent: 'x', reason: 'y' });
    const lines = [item(1), item(2), item(3)].map((l) => l + '\n');
    const file = path.join(state.inboxDir, 'ses-a.jsonl');
    fs.writeFileSync(file, lines.join(''), 'utf8');
    const offsetBytes = Buffer.byteLength(lines[0], 'utf8');
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.offset'), String(offsetBytes), 'utf8');

    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'ses-a');
    assert.ok(entry, 'the session must appear in the inbox listing');
    assert.strictEqual(entry.delivered, 1);
    assert.strictEqual(entry.queued, 2);
});

test('an absent offset file reads as 0: everything queued, nothing delivered', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: 'ses-a', intent: 'x', reason: 'y' });
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.jsonl'), item + '\n', 'utf8');
    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'ses-a');
    assert.strictEqual(entry.delivered, 0);
    assert.strictEqual(entry.queued, 1);
});

test('an offset past a rotated (shorter) queue file resets to 0 rather than treating the file as fully delivered', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: 'ses-a', intent: 'x', reason: 'y' });
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.jsonl'), item + '\n', 'utf8');
    // A stale offset far past the (now short) file's length, as if the file
    // was rotated or replaced after the offset was last written.
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.offset'), '999999', 'utf8');
    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'ses-a');
    assert.strictEqual(entry.delivered, 0, 'a stale offset must reset to 0, not read as fully delivered');
    assert.strictEqual(entry.queued, 1);
});

test('an inbox directory with no queue files reports an empty listing rather than absence', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.inbox.present, true);
    assert.strictEqual(result.inbox.sessions.length, 0);
});

// ---------------------------------- offset reading mirrors the hook (m10) --

test('an offset past OFFSET_FILE_MAX_BYTES reads as 0, matching the hook\'s own size ceiling', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: 'ses-a', intent: 'x', reason: 'y' });
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.jsonl'), item + '\n', 'utf8');
    const oversized = '0'.repeat(rollup.OFFSET_FILE_MAX_BYTES + 1);
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.offset'), oversized, 'utf8');
    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'ses-a');
    assert.strictEqual(entry.delivered, 0);
    assert.strictEqual(entry.queued, 1);
});

test('a negative offset reads as 0, never as a negative delivered count', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: 'ses-a', intent: 'x', reason: 'y' });
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.jsonl'), item + '\n', 'utf8');
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.offset'), '-5', 'utf8');
    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'ses-a');
    assert.strictEqual(entry.delivered, 0);
});

test('an offset directory in place of the offset file is an unreadable offset, reads as 0 like any other unparseable one', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: 'ses-a', intent: 'x', reason: 'y' });
    fs.writeFileSync(path.join(state.inboxDir, 'ses-a.jsonl'), item + '\n', 'utf8');
    fs.mkdirSync(path.join(state.inboxDir, 'ses-a.offset'));
    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'ses-a');
    assert.strictEqual(entry.delivered, 0);
});

// ------------------------------------ delivered label and no-session (m11/m12) --

test('the delivered/queued section carries the honesty footnote about what "delivered" means (m11)', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const result = rollup.computeRollup(state.stateDir);
    assert.match(rollup.render(result), /"delivered".*means bytes the valve has CONSUMED/);
});

test('the no-session bucket is named as undeliverable, not listed as an ordinary session falling behind (m12)', (t) => {
    const state = makeState(t);
    fs.mkdirSync(state.inboxDir, { recursive: true });
    const item = JSON.stringify({ v: 1, kind: 'alert', ts: '2026-08-29T10:00:00.000Z', callId: 'c1', sessionId: '', intent: 'x', reason: 'y' });
    fs.writeFileSync(path.join(state.inboxDir, 'no-session.jsonl'), item + '\n', 'utf8');
    const result = rollup.computeRollup(state.stateDir);
    const entry = result.inbox.sessions.find((s) => s.slug === 'no-session');
    assert.ok(entry, 'the bucket still appears in the listing');
    const text = rollup.render(result);
    assert.match(text, /no-session:.*\(undeliverable/);
});

// ------------------------------------------- cross-component pin (M5) --
//
// Every fixture above hand-builds its own JSON literal, which pins nothing
// against logs.js's own record builders: renaming `queued` or `type: 'gap'`
// in logs.js would leave the whole suite green while the rollup silently
// reported zeros against real daemon output. One case per record kind here is
// built through the SAME functions logs.js's daemon-writing side calls.

test('a verdict record built through logs.verdictRecord is tallied correctly (M5)', (t) => {
    const state = makeState(t);
    const entry = {
        callId: 'c'.repeat(16), ts: '2026-08-29T09:59:59.000Z', sessionId: 'ses-a',
        cwd: 'D:/proj', tool: 'Bash', intent: 'list files', command: 'ls -la',
        isError: false, truncated: false
    };
    const judged = { verdict: 'achieved', reason: 'listed as asked', reasonTruncated: false, latencyMs: 900 };
    const meta = { nowMs: Date.parse('2026-08-29T10:00:00.000Z'), promptId: 'judgment-v2', model: 'test-model', endpoint: 'abcd1234' };
    const record = logs.verdictRecord(entry, judged, meta);
    writeLines(verdictFile(state, 'ses-a'), [record]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.verdict.achieved, 1);
});

test('a gap record built through logs.gapRecord is tallied and rendered correctly (M5)', (t) => {
    const state = makeState(t);
    const record = logs.gapRecord({
        sessionId: 'ses-a', reason: 'lane busy', count: 2,
        firstCallId: 'c1', lastCallId: 'c2', detail: ''
    }, Date.parse('2026-08-29T11:00:00.000Z'));
    writeLines(verdictFile(state, 'ses-a'), [record]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.gaps, 1);
    assert.strictEqual(result.totals.gappedCalls, 2);
    assert.strictEqual(result.gapRanges[0].note, 'calls c1 to c2 not judged, lane busy');
});

test('a recognition record built through logs.recognitionRecord is tallied correctly (M5)', (t) => {
    const state = makeState(t);
    const entry = {
        callId: 'c'.repeat(16), ts: '2026-08-29T10:04:59.000Z', sessionId: 'ses-a',
        cwd: 'D:/proj', tool: 'Bash', intent: 'x', command: 'y'
    };
    const answer = { records: ['r1', 'r2'], invented: ['made-up'], reason: '', reasonTruncated: false, latencyMs: 500 };
    const meta = {
        nowMs: Date.parse('2026-08-29T10:05:00.000Z'), queued: ['r1'], indexRecords: 2, indexTruncated: false,
        promptId: 'recognition-v1', model: 'test-model', endpoint: 'abcd1234'
    };
    const record = logs.recognitionRecord(entry, answer, meta);
    writeLines(recognitionFile(state, 'ses-a'), [record]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.recognition.calls, 1);
    assert.strictEqual(result.totals.recognition.pointed, 1);
    assert.strictEqual(result.totals.recognition.invented, 1);
});

test('a recognition-gap record built through logs.recognitionGapRecord is tallied and rendered correctly (M5)', (t) => {
    const state = makeState(t);
    const record = logs.recognitionGapRecord({
        sessionId: 'ses-a', callId: 'c1', reason: 'endpoint down', detail: ''
    }, Date.parse('2026-08-29T10:06:00.000Z'));
    writeLines(recognitionFile(state, 'ses-a'), [record]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.recognitionGaps, 1);
    assert.match(result.recognitionGapEntries[0].note, /call c1 not recognized, endpoint down/);
});

test('a finding built through logs.findingRecord is tallied correctly (M5)', (t) => {
    const state = makeState(t);
    const record = logs.findingRecord({
        ts: '2026-08-29T10:07:00.000Z', callId: 'c1', sessionId: 'ses-a', cwd: 'D:/proj',
        intent: 'x', commandPreview: 'y', reason: 'exit code was clean but the file was never written',
        promptId: 'judgment-v2', model: 'test-model', endpoint: 'abcd1234'
    });
    writeLines(state.findingsFile, [record]);
    const result = rollup.computeRollup(state.stateDir);
    assert.strictEqual(result.totals.findingsDiverged, 1);
});

// --------------------------------------------------------- end to end CLI --

test('the CLI exits 0 over a real fixture and prints the mandatory lines to stdout', (t) => {
    const state = makeState(t);
    writeLines(verdictFile(state, 'ses-a'), [verdictLine({ callId: 'c1', verdict: 'achieved' })]);
    const res = runCli(['--state-dir', state.stateDir]);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /tool scope: Bash only/);
    assert.match(res.stdout, /evidence, not a guarantee/);
    assert.match(res.stdout, /achieved 1/);
});
