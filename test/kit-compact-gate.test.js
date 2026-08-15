// Tests for plugins/claude-kit/hooks/kit-compact-gate.js (the PreCompact
// boundary gate) and kit-compact-checkpoint.js (the checkpoint CLI).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a PreCompact payload on stdin, and asserted on by
// its EXIT CODE: 2 is a deny, 0 is an allow, and every assertion pins the
// exact expected value rather than "not 2", because a probe that maps "not
// exit 2" to "allowed" would report a crashed hook as an allow. The allow path
// must also emit nothing on stdout. Each case builds a fresh temp repo (its
// own .kit/goal-state.json, checkpoint, and fake JSONL transcript) so no case
// ever touches the real repo's live goal state or writes a real checkpoint.
// KIT_EXTERNAL_ENGINE is scrubbed from every child environment by default
// (this suite runs inside fleet workers too, where the marker is ambient and
// would flip every deny case into a stand-down allow); the one case that
// exercises the marker opts back in explicitly. All temp state is cleaned up
// in finally blocks.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-compact-gate.js');
const CLI = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-compact-checkpoint.js');
const { armGoal, bindSession } = require('../plugins/claude-kit/hooks/kit-goal-lib.js');
const { checkpointPath, writeCheckpoint } = require('../plugins/claude-kit/hooks/kit-compact-lib.js');

// The session id the fixtures bind the goal to; payloads default to it so the
// full deny state is the baseline and each case negates exactly one condition.
const SESSION = 'ses-11112222-aaaa-bbbb-cccc-333344445555';

// The shipped valve ceiling, duplicated here deliberately as a pin: changing
// the constant in the hook must fail these boundary cases and force a
// double-edit, so the ceiling can never drift silently.
const CEILING = 140000;

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

// Drop the external-engine marker from a child's environment, matched
// case-insensitively (Windows environment blocks preserve arbitrary key
// casing). Without this scrub, running the suite under a fleet worker would
// turn every deny case into a stand-down allow.
function scrubEngineEnv(env) {
    for (const k of Object.keys(env)) {
        if (/^KIT_EXTERNAL_ENGINE$/i.test(k)) delete env[k];
    }
    return env;
}

// Run the gate with the given payload (an object, or a raw string for the
// malformed-stdin case). Returns the spawnSync result (stdout, stderr, status).
function runGate(payload, extraEnv) {
    const env = { ...scrubEngineEnv({ ...process.env }), ...(extraEnv || {}) };
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        env,
        encoding: 'utf8'
    });
}

// Run the checkpoint CLI in the given repo (the CLI reads process.cwd()).
function runCli(args, cwd) {
    return spawnSync(process.execPath, [CLI, ...args], {
        cwd,
        env: scrubEngineEnv({ ...process.env }),
        encoding: 'utf8'
    });
}

// Build a JSONL transcript whose newest main-thread assistant row carries a
// usage object summing to `consumed`, followed by a couple of non-assistant
// records (mirroring the live shape, where the newest usage row sits a few
// lines from the end). Splitting the total across the three fields exercises
// the real sum, not just input_tokens.
function writeUsageTranscript(full, consumed) {
    const lines = [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'keep going' } }),
        JSON.stringify({
            type: 'assistant',
            message: {
                role: 'assistant',
                content: [{ type: 'text', text: 'Working.' }],
                usage: {
                    input_tokens: consumed - 1000,
                    cache_creation_input_tokens: 600,
                    cache_read_input_tokens: 400
                }
            }
        }),
        JSON.stringify({ type: 'system', subtype: 'turn-metadata' }),
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'tool result echo' } })
    ];
    writeFile(full, lines.join('\n') + '\n');
}

// Arm a goal in a fresh temp repo against an In-Progress plan, bind it to
// SESSION (unless opts.unbound), and lay down a usage transcript (consumed
// defaults to a mid-run figure well below the ceiling). Returns
// { repo, planRel, transcript }.
function armedRepo(opts) {
    const o = opts || {};
    const repo = makeDir('kit-compact-gate-repo-');
    const planRel = 'docs/plans/example.md';
    writeFile(path.join(repo, planRel), 'Status: In Progress\n\nbody\n');
    const armed = armGoal(repo, planRel);
    assert.strictEqual(armed.ok, true, 'test setup: goal should arm');
    if (!o.unbound) {
        const bound = bindSession(repo, SESSION);
        assert.strictEqual(bound.ok, true, 'test setup: goal should bind');
    }
    const transcript = path.join(repo, 'transcript.jsonl');
    writeUsageTranscript(transcript, o.consumed === undefined ? 50000 : o.consumed);
    return { repo, planRel, transcript };
}

// A PreCompact payload in the exact live shape, defaulting to the full deny
// state against the given fixtures; overrides negate one condition at a time.
function gatePayload(repo, transcript, overrides) {
    return {
        session_id: SESSION,
        transcript_path: transcript,
        cwd: repo,
        prompt_id: 'prompt-1',
        hook_event_name: 'PreCompact',
        trigger: 'auto',
        custom_instructions: null,
        ...(overrides || {})
    };
}

// A deny is exit 2, nothing on stdout, and exactly the fixed deferral note on
// stderr: the note is part of the deny contract (it is what a transcript
// reader sees instead of a failure), and pinning it here means a regression
// that drops it, or leaks payload or repo data into stderr, cannot pass green.
const DENY_NOTE = 'kit-compact-gate: auto-compaction deferred to the next chapter boundary';

function assertDeny(res) {
    assert.strictEqual(res.status, 2, 'expected deny (exit 2); stderr: ' + res.stderr);
    assert.strictEqual(res.stdout, '', 'deny emits nothing on stdout');
    assert.ok(res.stderr.includes(DENY_NOTE), 'deny carries the fixed deferral note; stderr: ' + res.stderr);
}

function assertAllow(res) {
    assert.strictEqual(res.status, 0, 'expected allow (exit 0); stderr: ' + res.stderr);
    assert.strictEqual(res.stdout, '', 'allow emits nothing on stdout');
}

// ---------------------------------------------------------------------------
// The one deny state, and each single-condition negation isolated from it.
// ---------------------------------------------------------------------------

test('gate: armed, bound, no checkpoint, below ceiling: deny (exit 2)', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        const res = runGate(gatePayload(repo, transcript));
        assertDeny(res);
        // The stderr note is a fixed string: no value derived from the
        // payload, the goal state, or the repo may ride in it.
        for (const leak of [planRel, SESSION, repo, transcript]) {
            assert.ok(!res.stderr.includes(leak), 'stderr must not carry input-derived data: ' + leak);
        }
    } finally {
        rmDir(repo);
    }
});

test('gate: manual trigger is never gated, even in the full deny state', () => {
    const { repo, transcript } = armedRepo();
    try {
        assertAllow(runGate(gatePayload(repo, transcript, { trigger: 'manual' })));
    } finally {
        rmDir(repo);
    }
});

test('gate: missing trigger field: allow (the in-code auto check holds without the matcher)', () => {
    const { repo, transcript } = armedRepo();
    try {
        const payload = gatePayload(repo, transcript);
        delete payload.trigger;
        assertAllow(runGate(payload));
    } finally {
        rmDir(repo);
    }
});

test('gate: no goal armed: allow', () => {
    const repo = makeDir('kit-compact-gate-repo-');
    try {
        const transcript = path.join(repo, 'transcript.jsonl');
        writeUsageTranscript(transcript, 50000);
        assertAllow(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});

test('gate: unparseable goal state: allow', () => {
    const { repo, transcript } = armedRepo();
    try {
        writeFile(path.join(repo, '.kit', 'goal-state.json'), 'not json at all {');
        assertAllow(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});

test('gate: goal armed but unbound (boundSession null): allow', () => {
    const { repo, transcript } = armedRepo({ unbound: true });
    try {
        assertAllow(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});

test('gate: bystander session (session_id differs from boundSession): allow', () => {
    const { repo, transcript } = armedRepo();
    try {
        assertAllow(runGate(gatePayload(repo, transcript, { session_id: 'ses-other-99998888' })));
    } finally {
        rmDir(repo);
    }
});

test('gate: KIT_EXTERNAL_ENGINE=1 stands down: allow in the full deny state', () => {
    const { repo, transcript } = armedRepo();
    try {
        assertAllow(runGate(gatePayload(repo, transcript), { KIT_EXTERNAL_ENGINE: '1' }));
    } finally {
        rmDir(repo);
    }
});

test('gate: unparseable payload on stdin: allow', () => {
    // No fixtures at all: the payload never parses, so nothing else is read.
    const res = runGate('this is not json');
    assertAllow(res);
});

test('gate: absent transcript: allow (valve reading cannot be obtained)', () => {
    const { repo } = armedRepo();
    try {
        const missing = path.join(repo, 'no-such-transcript.jsonl');
        assertAllow(runGate(gatePayload(repo, missing)));
    } finally {
        rmDir(repo);
    }
});

test('gate: transcript_path missing from the payload: allow', () => {
    const { repo, transcript } = armedRepo();
    try {
        const payload = gatePayload(repo, transcript);
        delete payload.transcript_path;
        assertAllow(runGate(payload));
    } finally {
        rmDir(repo);
    }
});

test('gate: transcript is a directory (non-regular file): allow', () => {
    const { repo } = armedRepo();
    try {
        const dir = path.join(repo, 'transcript-dir');
        fs.mkdirSync(dir);
        assertAllow(runGate(gatePayload(repo, dir)));
    } finally {
        rmDir(repo);
    }
});

test('gate: transcript with no usage row: allow', () => {
    const { repo } = armedRepo();
    try {
        const bare = path.join(repo, 'bare.jsonl');
        writeFile(bare, JSON.stringify({
            type: 'assistant',
            message: { role: 'assistant', content: [{ type: 'text', text: 'No usage here.' }] }
        }) + '\n');
        assertAllow(runGate(gatePayload(repo, bare)));
    } finally {
        rmDir(repo);
    }
});

test('gate: newest usage row is illegible (non-numeric field): allow, no fallback to older rows', () => {
    const { repo } = armedRepo();
    try {
        // An older legible row below the ceiling sits beneath a newer illegible
        // one. Falling back to the older row would deny; the hook must allow.
        const t = path.join(repo, 'illegible.jsonl');
        const lines = [
            JSON.stringify({
                type: 'assistant',
                message: { role: 'assistant', content: [], usage: { input_tokens: 40000 } }
            }),
            JSON.stringify({
                type: 'assistant',
                message: { role: 'assistant', content: [], usage: { input_tokens: 'lots' } }
            })
        ];
        writeFile(t, lines.join('\n') + '\n');
        assertAllow(runGate(gatePayload(repo, t)));
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// The safety valve boundary, both directions.
// ---------------------------------------------------------------------------

test('gate: consumed just below the ceiling: deny (strictly-below is the deny side)', () => {
    const { repo, transcript } = armedRepo({ consumed: CEILING - 1 });
    try {
        assertDeny(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});

test('gate: consumed exactly at the ceiling: allow (valve trips at the boundary)', () => {
    const { repo, transcript } = armedRepo({ consumed: CEILING });
    try {
        assertAllow(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});

test('gate: consumed above the ceiling: allow', () => {
    const { repo, transcript } = armedRepo({ consumed: CEILING + 15000 });
    try {
        assertAllow(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});

test('gate: a newer sidechain usage row is skipped; the main-thread row decides', () => {
    const { repo } = armedRepo();
    try {
        // Main-thread row above the ceiling, then a newer sidechain row far
        // below it. Reading the sidechain row would deny; the valve must trip
        // on the main-thread reading and allow.
        const t = path.join(repo, 'sidechain.jsonl');
        const lines = [
            JSON.stringify({
                type: 'assistant',
                message: { role: 'assistant', content: [], usage: { input_tokens: CEILING + 5000 } }
            }),
            JSON.stringify({
                type: 'assistant',
                isSidechain: true,
                message: { role: 'assistant', content: [], usage: { input_tokens: 1000 } }
            })
        ];
        writeFile(t, lines.join('\n') + '\n');
        assertAllow(runGate(gatePayload(repo, t)));
    } finally {
        rmDir(repo);
    }
});

// Build a transcript larger than the tail-read cap (1MB), with the usage row
// at the end behind more than 1MB of filler lines. This forces the capped
// tail-read branch, the one that actually runs in production: a multi-day
// run's transcript is far past 1MB by the time the gate matters, while every
// small fixture above takes the whole-file read instead.
function writeHugeUsageTranscript(full, consumed) {
    const filler = JSON.stringify({ type: 'user', message: { role: 'user', content: 'x'.repeat(2048) } });
    const lines = [];
    let bytes = 0;
    while (bytes < 1200 * 1024) {
        lines.push(filler);
        bytes += filler.length + 1;
    }
    lines.push(JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [], usage: { input_tokens: consumed } }
    }));
    lines.push(JSON.stringify({ type: 'system', subtype: 'turn-metadata' }));
    writeFile(full, lines.join('\n') + '\n');
}

test('gate: >1MB transcript, below ceiling: deny (the capped tail read yields a legible reading)', () => {
    // The deny is the discriminating direction: a broken tail read would
    // return no reading and allow, so only a deny proves the capped branch
    // actually surfaced the usage row.
    const { repo } = armedRepo();
    try {
        const t = path.join(repo, 'huge.jsonl');
        writeHugeUsageTranscript(t, 50000);
        assert.ok(fs.statSync(t).size > 1024 * 1024, 'fixture exceeds the tail cap');
        assertDeny(runGate(gatePayload(repo, t)));
    } finally {
        rmDir(repo);
    }
});

test('gate: >1MB transcript, above ceiling: allow (valve trips off the capped tail read)', () => {
    const { repo } = armedRepo();
    try {
        const t = path.join(repo, 'huge.jsonl');
        writeHugeUsageTranscript(t, CEILING + 5000);
        assertAllow(runGate(gatePayload(repo, t)));
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// Checkpoint semantics: open, consume, single-shot, stale, non-consumption.
// ---------------------------------------------------------------------------

test('gate: matching checkpoint open: allow AND consume; the next attempt is denied again', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        const wrote = writeCheckpoint(repo, planRel, SESSION);
        assert.strictEqual(wrote.ok, true, 'test setup: checkpoint should write');
        const cpFile = checkpointPath(repo);
        assert.ok(fs.existsSync(cpFile), 'setup: checkpoint on disk');

        assertAllow(runGate(gatePayload(repo, transcript)));
        assert.ok(!fs.existsSync(cpFile), 'checkpoint consumed by the allow');

        // Single-shot: the same state without the checkpoint is the deny state.
        assertDeny(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint naming a different plan reads as absent: deny, stale file left in place', () => {
    const { repo, transcript } = armedRepo();
    try {
        const wrote = writeCheckpoint(repo, 'docs/plans/some-prior-run.md', SESSION);
        assert.strictEqual(wrote.ok, true, 'test setup: stale checkpoint should write');
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'stale checkpoint is not consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint bound to a different session reads as absent: deny, orphan left in place', () => {
    // The crash-orphan case: a checkpoint written just before a crash names
    // the SAME plan, but the resumed run re-binds the goal to a new session
    // id, so the orphan must not open the gate for that run's first
    // mid-chapter compaction.
    const { repo, planRel, transcript } = armedRepo();
    try {
        const wrote = writeCheckpoint(repo, planRel, 'ses-crashed-previous-run');
        assert.strictEqual(wrote.ok, true, 'test setup: orphan checkpoint should write');
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'orphan checkpoint is not consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint with no boundSession field (older format) reads as absent: deny', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        // Hand-write the old shape directly: plan only, no boundSession key.
        writeFile(checkpointPath(repo), JSON.stringify({
            plan: planRel, openedAt: new Date().toISOString()
        }) + '\n');
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'unmatched checkpoint is not consumed');
    } finally {
        rmDir(repo);
    }
});

// The shipped checkpoint age bound, duplicated as a pin like CEILING above:
// changing the constant in the hook must fail the boundary cases here and
// force a visible double-edit.
const MAX_AGE_MS = 15 * 60 * 1000;

// Hand-write a plan-and-session-matching checkpoint with an arbitrary
// openedAt value (or none), isolating the freshness leg of the match.
function writeCheckpointAt(repo, planRel, openedAt) {
    const record = { plan: planRel, boundSession: SESSION };
    if (openedAt !== undefined) record.openedAt = openedAt;
    writeFile(checkpointPath(repo), JSON.stringify(record) + '\n');
}

test('gate: checkpoint just inside the age bound: allow AND consume (freshness both directions)', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        // One minute of margin inside the bound, so a slow test run cannot
        // drift the fixture across the boundary.
        writeCheckpointAt(repo, planRel, new Date(Date.now() - (MAX_AGE_MS - 60 * 1000)).toISOString());
        assertAllow(runGate(gatePayload(repo, transcript)));
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'fresh checkpoint consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint older than the age bound reads as absent: deny, file left in place', () => {
    // The ordinary same-run leftover: a boundary reached below the trigger
    // opens a checkpoint no offer ever catches. Honoring it when the NEXT
    // chapter crosses the trigger would land the compaction mid-chapter on
    // every cycle, making the whole gate inert after the first chapter.
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpointAt(repo, planRel, new Date(Date.now() - (MAX_AGE_MS + 60 * 1000)).toISOString());
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'expired checkpoint is not consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint with no openedAt reads as absent: deny', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpointAt(repo, planRel, undefined);
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'unmatched checkpoint is not consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint with an unparseable openedAt reads as absent: deny', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpointAt(repo, planRel, 'not a timestamp');
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'unmatched checkpoint is not consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint with a far-future openedAt reads as absent: deny (no immortal checkpoint)', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpointAt(repo, planRel, new Date(Date.now() + 60 * 60 * 1000).toISOString());
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'unmatched checkpoint is not consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: checkpoint a few seconds in the future (clock skew) still matches: allow AND consume', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpointAt(repo, planRel, new Date(Date.now() + 30 * 1000).toISOString());
        assertAllow(runGate(gatePayload(repo, transcript)));
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'within-skew checkpoint consumed');
    } finally {
        rmDir(repo);
    }
});

test('gate: bystander allow does NOT consume a matching checkpoint', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpoint(repo, planRel, SESSION);
        assertAllow(runGate(gatePayload(repo, transcript, { session_id: 'ses-someone-else' })));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'the bound run still needs its checkpoint');
    } finally {
        rmDir(repo);
    }
});

test('gate: external-engine stand-down does NOT consume a matching checkpoint', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpoint(repo, planRel, SESSION);
        assertAllow(runGate(gatePayload(repo, transcript), { KIT_EXTERNAL_ENGINE: '1' }));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'stand-down precedes the checkpoint clause');
    } finally {
        rmDir(repo);
    }
});

test('gate: manual-trigger allow does NOT consume a matching checkpoint', () => {
    const { repo, planRel, transcript } = armedRepo();
    try {
        writeCheckpoint(repo, planRel, SESSION);
        assertAllow(runGate(gatePayload(repo, transcript, { trigger: 'manual' })));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'manual compaction never touches the checkpoint');
    } finally {
        rmDir(repo);
    }
});

test('gate: valve allow (over ceiling, no matching checkpoint) does NOT consume a stale checkpoint', () => {
    const { repo, transcript } = armedRepo({ consumed: CEILING + 20000 });
    try {
        writeCheckpoint(repo, 'docs/plans/some-prior-run.md', SESSION);
        assertAllow(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'a stale checkpoint is never the gate\'s to delete');
    } finally {
        rmDir(repo);
    }
});

test('gate: matching checkpoint open AND over the ceiling: allow is checkpoint-driven and consumes', () => {
    // The checkpoint clause runs before the valve read: a reached boundary
    // retires its checkpoint whatever the token count says, so the boundary
    // does not leak an extra mid-chapter allow after the compaction lands.
    const { repo, planRel, transcript } = armedRepo({ consumed: CEILING + 20000 });
    try {
        writeCheckpoint(repo, planRel, SESSION);
        assertAllow(runGate(gatePayload(repo, transcript)));
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'checkpoint consumed even with the valve tripped');
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// The checkpoint CLI.
// ---------------------------------------------------------------------------

test('cli: open with an armed goal writes the checkpoint atomically for that plan', () => {
    const { repo, planRel } = armedRepo();
    try {
        const res = runCli(['open'], repo);
        assert.strictEqual(res.status, 0, 'open succeeds; stderr: ' + res.stderr);
        assert.ok(res.stdout.includes(planRel), 'output names the plan');
        const cp = JSON.parse(fs.readFileSync(checkpointPath(repo), 'utf8'));
        assert.strictEqual(cp.plan, planRel, 'checkpoint records the armed plan');
        assert.strictEqual(cp.boundSession, SESSION, 'checkpoint records the goal\'s bound session');
        assert.ok(typeof cp.openedAt === 'string' && cp.openedAt.length > 0, 'checkpoint records when it opened');
        // Atomic write discipline: the tmp file must not survive the rename.
        const leftovers = fs.readdirSync(path.join(repo, '.kit'))
            .filter((n) => n.includes('compact-checkpoint.json.tmp.'));
        assert.deepStrictEqual(leftovers, [], 'no tmp files left behind');
    } finally {
        rmDir(repo);
    }
});

test('cli: open with no goal armed refuses and writes nothing', () => {
    const repo = makeDir('kit-compact-gate-repo-');
    try {
        const res = runCli(['open'], repo);
        assert.strictEqual(res.status, 1, 'open refuses');
        assert.ok(res.stderr.includes('no kit goal is armed'), 'refusal states the reason');
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'nothing written');
    } finally {
        rmDir(repo);
    }
});

test('cli: open with an unparseable goal state refuses', () => {
    const { repo } = armedRepo();
    try {
        writeFile(path.join(repo, '.kit', 'goal-state.json'), '{{{');
        const res = runCli(['open'], repo);
        assert.strictEqual(res.status, 1, 'open refuses');
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'nothing written');
    } finally {
        rmDir(repo);
    }
});

test('cli: status reports an open checkpoint, a mismatched one, and none', () => {
    const { repo, planRel } = armedRepo();
    try {
        let res = runCli(['status'], repo);
        assert.strictEqual(res.status, 0);
        assert.ok(res.stdout.includes('no compact checkpoint'), 'none open yet');

        writeCheckpoint(repo, planRel, SESSION);
        res = runCli(['status'], repo);
        assert.strictEqual(res.status, 0);
        assert.ok(res.stdout.includes(planRel), 'status names the plan');
        assert.ok(!res.stdout.includes('treats it as absent'), 'a matching checkpoint carries no mismatch note');

        writeCheckpoint(repo, 'docs/plans/some-prior-run.md', SESSION);
        res = runCli(['status'], repo);
        assert.strictEqual(res.status, 0);
        assert.ok(res.stdout.includes('treats it as absent'), 'mismatch is flagged');
    } finally {
        rmDir(repo);
    }
});

test('cli: status names each state the gate ignores, and the gate agrees on the same fixture', () => {
    // Status answers from the same checkpointMatches rule the gate decides
    // by, so every stage asserts both surfaces against one fixture: the
    // reason line on status, and the deny (file left in place) on the gate.
    const { repo, planRel, transcript } = armedRepo();
    const payload = () => gatePayload(repo, transcript);
    const statusLine = () => {
        const res = runCli(['status'], repo);
        assert.strictEqual(res.status, 0, 'status runs; stderr: ' + res.stderr);
        return res.stdout;
    };
    try {
        // Wrong session (the crash orphan).
        writeCheckpoint(repo, planRel, 'ses-crashed-previous-run');
        let out = statusLine();
        assert.ok(out.includes('bound to a different session'), 'names the session mismatch: ' + out);
        assert.ok(out.includes('treats it as absent'), out);
        assertDeny(runGate(payload()));

        // Expired.
        writeCheckpointAt(repo, planRel, new Date(Date.now() - (MAX_AGE_MS + 60 * 1000)).toISOString());
        out = statusLine();
        assert.ok(out.includes('expired'), 'names the expiry: ' + out);
        assert.ok(out.includes('treats it as absent'), out);
        assertDeny(runGate(payload()));

        // Missing openedAt (older format). The missing value is stated as
        // missing, never stringified into a literal "undefined".
        writeCheckpointAt(repo, planRel, undefined);
        out = statusLine();
        assert.ok(out.includes('missing or unreadable'), 'names the missing timestamp: ' + out);
        assert.ok(out.includes('no opened timestamp recorded'), out);
        assert.ok(!out.includes('undefined'), 'no stringified undefined: ' + out);
        assertDeny(runGate(payload()));

        // Unparseable openedAt.
        writeCheckpointAt(repo, planRel, 'not a timestamp');
        out = statusLine();
        assert.ok(out.includes('missing or unreadable'), 'names the unreadable timestamp: ' + out);
        assertDeny(runGate(payload()));

        // Far-future openedAt.
        writeCheckpointAt(repo, planRel, new Date(Date.now() + 60 * 60 * 1000).toISOString());
        out = statusLine();
        assert.ok(out.includes('in the future'), 'names the future timestamp: ' + out);
        assertDeny(runGate(payload()));

        // A live checkpoint carries no absent note, and the gate consumes it.
        const opened = runCli(['open'], repo);
        assert.strictEqual(opened.status, 0, 'open succeeds; stderr: ' + opened.stderr);
        out = statusLine();
        assert.ok(out.includes(planRel), out);
        assert.ok(!out.includes('treats it as absent'), 'a live checkpoint carries no absent note: ' + out);
        assertAllow(runGate(payload()));
        out = statusLine();
        assert.ok(out.includes('no compact checkpoint'), 'consumed: ' + out);
    } finally {
        rmDir(repo);
    }
});

test('cli: status reports an illegible checkpoint file instead of claiming absence', () => {
    const { repo, transcript } = armedRepo();
    try {
        writeFile(checkpointPath(repo), 'garbage, not json {');
        const res = runCli(['status'], repo);
        assert.strictEqual(res.status, 0);
        assert.ok(res.stdout.includes('illegible checkpoint file'), 'names the garbage file: ' + res.stdout);
        assert.ok(res.stdout.includes('treats it as absent'), res.stdout);
        // The gate agrees (treat as absent means deny), and does not consume
        // a file it cannot read.
        assertDeny(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'illegible file left in place');
        // clear is the remedy status points at.
        const cleared = runCli(['clear'], repo);
        assert.strictEqual(cleared.status, 0);
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'clear removes it');
        // And with the file truly gone, status reports plain absence again.
        const after = runCli(['status'], repo);
        assert.ok(after.stdout.includes('no compact checkpoint is open'), after.stdout);
    } finally {
        rmDir(repo);
    }
});

test('cli: status on a checkpoint whose goal is gone says so, and the gate leaves it alone', () => {
    const { repo, transcript } = armedRepo();
    try {
        const opened = runCli(['open'], repo);
        assert.strictEqual(opened.status, 0, 'open succeeds; stderr: ' + opened.stderr);
        // The goal is cleared out from under the checkpoint (a temp fixture
        // repo, never the real one).
        fs.rmSync(path.join(repo, '.kit', 'goal-state.json'));
        const res = runCli(['status'], repo);
        assert.strictEqual(res.status, 0);
        assert.ok(res.stdout.includes('no kit goal is armed'), 'names the missing goal: ' + res.stdout);
        assert.ok(res.stdout.includes('treats it as absent'), res.stdout);
        // The gate allows on the no-goal clause, long before the checkpoint,
        // so the file is not consumed.
        assertAllow(runGate(gatePayload(repo, transcript)));
        assert.ok(fs.existsSync(checkpointPath(repo)), 'not consumed on a no-goal allow');
    } finally {
        rmDir(repo);
    }
});

test('cli: clear removes an open checkpoint and is a no-op when none is open', () => {
    const { repo, planRel } = armedRepo();
    try {
        writeCheckpoint(repo, planRel, SESSION);
        let res = runCli(['clear'], repo);
        assert.strictEqual(res.status, 0);
        assert.ok(res.stdout.includes('cleared'));
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'checkpoint removed');

        res = runCli(['clear'], repo);
        assert.strictEqual(res.status, 0);
        assert.ok(res.stdout.includes('no compact checkpoint'));
    } finally {
        rmDir(repo);
    }
});

test('cli: unknown or missing subcommand prints usage and exits 1', () => {
    const repo = makeDir('kit-compact-gate-repo-');
    try {
        let res = runCli(['bogus'], repo);
        assert.strictEqual(res.status, 1);
        assert.ok(res.stderr.includes('usage:'));
        res = runCli([], repo);
        assert.strictEqual(res.status, 1);
    } finally {
        rmDir(repo);
    }
});

// ---------------------------------------------------------------------------
// Round-trip: the CLI-written checkpoint is the one the gate consumes.
// ---------------------------------------------------------------------------

test('round-trip: CLI open lets exactly one auto-compaction through the gate', () => {
    const { repo, transcript } = armedRepo();
    try {
        // Mid-chapter: denied.
        assertDeny(runGate(gatePayload(repo, transcript)));

        // Chapter boundary: the ritual opens the checkpoint via the CLI.
        const opened = runCli(['open'], repo);
        assert.strictEqual(opened.status, 0, 'open succeeds; stderr: ' + opened.stderr);

        // The next attempt lands, consuming the checkpoint.
        assertAllow(runGate(gatePayload(repo, transcript)));
        assert.ok(!fs.existsSync(checkpointPath(repo)), 'checkpoint consumed');

        // And the one after that is mid-chapter again: denied.
        assertDeny(runGate(gatePayload(repo, transcript)));
    } finally {
        rmDir(repo);
    }
});
