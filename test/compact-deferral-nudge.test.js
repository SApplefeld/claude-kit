// Tests for plugins/claude-kit/hooks/compact-deferral-nudge.js (the
// PostToolUse deferral nudge).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a PostToolUse payload on stdin, and asserted on by
// its EXIT CODE (always 0; the hook never exits 2) and its EXACT stdout: the
// fire path must emit exactly the nested hookSpecificOutput JSON form (a
// top-level additionalContext key is inert on this harness and is pinned
// absent below), and every silent path must emit the empty string, because a
// weaker "no reminder substring" check would pass on a crashed hook.
//
// Each case builds a fresh temp repo with its own .kit/goal-state.json via
// armGoal/bindSession and its own .kit/compact-gate.json holding a staged
// deferral episode, so no case touches the real repo's live state. The baseline
// fixture is the full FIRE state, aged so that only the guard a case negates
// can decide its outcome: the episode's lastDeniedAt sits seconds ago (well
// inside the four-hour idle bound), its since sits 45 minutes ago, nudgedAt is
// absent, and no checkpoint file exists. A silent case that staged the wrong
// ages would pass on a guard other than the one it names, which is
// indistinguishable from passing for the right reason.
//
// KIT_EXTERNAL_ENGINE is scrubbed from every child environment by default (this
// suite runs inside fleet workers too, where the marker is ambient and would
// flip every fire case into a silent stand-down); the one case that exercises
// the marker opts back in explicitly. All temp state is cleaned up in finally
// blocks.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'compact-deferral-nudge.js');
const { armGoal, bindSession } = require('../plugins/claude-kit/hooks/kit-goal-lib.js');
const {
    buildReminder, NUDGE_INTERVAL_MS, namesNetworkShare
} = require('../plugins/claude-kit/hooks/compact-deferral-nudge.js');

// The session id the fixtures bind the goal to; payloads default to it so the
// full fire state is the baseline and each silent case negates exactly one
// guard.
const SESSION = 'ses-11112222-aaaa-bbbb-cccc-333344445555';
const OTHER_SESSION = 'ses-99998888-ffff-eeee-dddd-777766665555';
const PLAN_REL = 'docs/plans/x_spec_v1.md';

// The staged episode's figures, which the fire cases read back out of the
// emitted reminder.
const DENIALS = 7;
const EPISODE_MINUTES = 45;

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

function iso(msAgo) {
    return new Date(Date.now() - msAgo).toISOString();
}

// Drop the external-engine marker from a child's environment, matched
// case-insensitively (Windows environment blocks preserve arbitrary key
// casing). Without this scrub, running the suite under a fleet worker would
// turn every fire case into a stand-down silence.
function scrubEngineEnv(env) {
    for (const k of Object.keys(env)) {
        if (/^KIT_EXTERNAL_ENGINE$/i.test(k)) delete env[k];
    }
    return env;
}

// childCwd sets the spawned hook's own working directory, which matters for
// exactly one case: the hook must read the project the PAYLOAD names and never
// fall back to wherever it happens to be running.
function runHook(payload, extraEnv, childCwd) {
    const env = { ...scrubEngineEnv({ ...process.env }), ...(extraEnv || {}) };
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        env,
        cwd: childCwd || process.cwd(),
        encoding: 'utf8'
    });
}

function gateStateFile(repo) {
    return path.join(repo, '.kit', 'compact-gate.json');
}

function checkpointFile(repo) {
    return path.join(repo, '.kit', 'compact-checkpoint.json');
}

function readGateStateFile(repo) {
    return JSON.parse(fs.readFileSync(gateStateFile(repo), 'utf8'));
}

// The gate state file's bytes, or null when it is absent.
function stateBytes(repo) {
    try { return fs.readFileSync(gateStateFile(repo), 'utf8'); } catch { return null; }
}

// A silent run wrote nothing. This is a separate assertion from silence and
// neither implies the other: nudgedAt is the interval's only cross-process
// carrier, so a stamp landing on a path that then stays quiet consumes a fresh
// 30 minutes on every covered tool return and the nudge never speaks again for
// that episode, with an empty stdout at every step.
function assertNoStateWrite(repo, before, label) {
    assert.strictEqual(stateBytes(repo), before, label + ': the state file must be byte-identical');
}

function gateLogFile(repo) {
    return path.join(repo, '.kit', 'compact-gate.jsonl');
}

// Every whole line of the gate journal, parsed. Absent file reads as no lines.
function readGateLog(repo) {
    let raw;
    try { raw = fs.readFileSync(gateLogFile(repo), 'utf8'); } catch { return []; }
    return raw.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line));
}

// An open deferral episode: denied seconds ago (far inside the four-hour idle
// bound), opened 45 minutes ago, never nudged. Overrides negate one field.
function openEpisode(overrides) {
    return {
        session: SESSION,
        since: iso(EPISODE_MINUTES * 60 * 1000 + 5000),
        denials: DENIALS,
        lastDeniedAt: iso(20 * 1000),
        nudgedAt: null,
        ...overrides
    };
}

// Write the gate state file directly, which is the shape recordGateDecision
// leaves behind: a last decision, an episode, and a last allow.
function writeGateState(repo, episode) {
    writeFile(gateStateFile(repo), JSON.stringify({
        lastDecision: {
            at: iso(20 * 1000),
            verdict: 'deny-boundary',
            reason: 'no-checkpoint',
            consumed: 300000,
            checkpoint: null,
            session: SESSION
        },
        episode,
        lastAllow: null
    }, null, 2) + '\n');
}

// A fresh temp repo with the plan armed, bound to SESSION, and a deferral
// episode open: the full fire state.
function makeRepo(opts) {
    const o = opts || {};
    const repo = makeDir('compact-deferral-nudge-repo-');
    writeFile(path.join(repo, PLAN_REL), 'Status: In Progress\n\nbody\n');
    const armed = armGoal(repo, PLAN_REL);
    assert.strictEqual(armed.ok, true, 'test setup: goal should arm');
    if (!o.unbound) {
        // Guard 5 asks one question, whether this payload's session is the
        // bound one, so the binding is all the fixture stages.
        const bound = bindSession(repo, o.session || SESSION);
        assert.strictEqual(bound.ok, true, 'test setup: goal should bind');
    }
    if (!o.noEpisode) writeGateState(repo, openEpisode(o.episode));
    return repo;
}

// The baseline fire payload: a main-thread Bash result in the armed project,
// from the bound session. Each case overrides exactly what it negates.
function firePayload(repo, overrides) {
    return {
        session_id: SESSION,
        cwd: repo,
        tool_name: 'Bash',
        tool_input: { command: 'node --test test/x.test.js' },
        ...overrides
    };
}

function assertSilent(res, label) {
    assert.strictEqual(res.status, 0, label + ': exit code must be 0');
    assert.strictEqual(res.stdout, '', label + ': stdout must be empty');
    assert.strictEqual(res.stderr, '', label + ': stderr must be empty');
}

function assertFires(res, label) {
    assert.strictEqual(res.status, 0, label + ': exit code must be 0');
    assert.strictEqual(res.stderr, '', label + ': stderr must be empty');
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(res.stdout); }, label + ': stdout must be valid JSON');
    assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput'],
        label + ': the top level must carry hookSpecificOutput and nothing else');
    assert.deepStrictEqual(Object.keys(parsed.hookSpecificOutput).sort(),
        ['additionalContext', 'hookEventName'],
        label + ': hookSpecificOutput must carry exactly the event name and the context');
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'PostToolUse', label + ': the event name');
    return parsed.hookSpecificOutput.additionalContext;
}

test('fires on a covered tool return while an episode is open', () => {
    const repo = makeRepo();
    try {
        const context = assertFires(runHook(firePayload(repo)), 'open episode');
        // The phrase and the tool, not the whole reminder: the command clause
        // renders out of this checkout's own installed path, and a checkout
        // under a path outside SAFE_CLI_PATH (a hash, an ampersand, a comma,
        // any non-ASCII) legitimately drops that clause. Asserting it here
        // would red this case for a reason other than the one it names. The
        // clause is pinned both directions, against fixed paths, by the
        // grammar case below.
        assert.ok(context.includes('held 7 offers over 45 minutes'),
            'the emitted context must carry the phrase built from the staged episode:\n' + context);
        assert.ok(context.includes('kit-compact-checkpoint.js'),
            'the emitted context must name the tool that opens the boundary:\n' + context);
        assert.ok(context.startsWith('compact-deferral-nudge: the compaction gate has '),
            'the emitted context must be this hook\'s reminder:\n' + context);
    } finally {
        rmDir(repo);
    }
});

test('fires on every covered tool name', () => {
    const repo = makeRepo();
    try {
        for (const tool of ['Agent', 'TaskOutput', 'Bash', 'PowerShell']) {
            // Each fire stamps the episode, so the interval is reset between
            // tools; otherwise every tool after the first would read as silent
            // for the wrong reason.
            writeGateState(repo, openEpisode());
            assertFires(runHook(firePayload(repo, { tool_name: tool })), 'tool ' + tool);
        }
    } finally {
        rmDir(repo);
    }
});

test('the emitted context carries the two integers out of state and no other state value', () => {
    const repo = makeRepo();
    try {
        const context = assertFires(runHook(firePayload(repo)), 'two integers');
        assert.ok(context.includes('held ' + DENIALS + ' offers over ' + EPISODE_MINUTES + ' minutes'),
            'the reminder must carry the count of held offers and the episode age:\n' + context);
        assert.ok(!context.includes(SESSION), 'no session id may reach the reminder');
        assert.ok(!context.includes(repo), 'no project path may reach the reminder');
        assert.ok(!context.includes('compact-gate.json'), 'no state path may reach the reminder');
        assert.ok(!context.includes('deny-boundary'), 'no recorded verdict may reach the reminder');
    } finally {
        rmDir(repo);
    }
});

test('no top-level additionalContext key is ever present in the emitted object', () => {
    // The top-level key is inert on this harness: the harness parses the
    // payload and discards it, so its presence would read as working while
    // reaching nothing. This is the pin against a "compatibility" regression.
    const repo = makeRepo();
    try {
        const parsed = JSON.parse(runHook(firePayload(repo)).stdout);
        assert.strictEqual('additionalContext' in parsed, false,
            'a top-level additionalContext key must never be emitted');
    } finally {
        rmDir(repo);
    }
});

test('the reminder carries its pinned fragments', () => {
    // Hardcoded literals, deliberately not read from the hook, so a silent
    // reword of the reminder fails the suite and becomes a double-edit.
    const repo = makeRepo();
    try {
        const context = assertFires(runHook(firePayload(repo)), 'pinned fragments');
        assert.ok(context.startsWith('compact-deferral-nudge:'), 'the reminder must name the hook that spoke');
        assert.ok(context.includes('the compaction gate has held'), 'the reminder must state the hold');
        assert.ok(context.includes('not an error'),
            'the reminder must say the deferral is the mechanism rather than a fault');
        assert.ok(context.includes('interim board entry or the Chapter'),
            'the reminder must name both boundary shapes');
        assert.ok(context.includes('commit model'), 'the reminder must order the commit model before the open');
        // The tool, not the rendered command: the runnable clause is composed
        // from this checkout's own __dirname and is legitimately dropped when
        // that path falls outside SAFE_CLI_PATH, which would red this case for
        // a reason other than the one it names. The clause is pinned both
        // directions, against fixed paths, by the grammar case below.
        assert.ok(context.includes('kit-compact-checkpoint.js'),
            'the reminder must name the checkpoint command:\n' + context);
        assert.ok(context.includes('Never clear the goal or the checkpoint'),
            'the reminder must forbid clearing the goal or the checkpoint to get past a deferral');
        assert.ok(context.includes('executing-work'),
            'the reminder must route a session whose skill body was dropped back to executing-work');
        assert.ok(context.includes('mid-step'), 'the reminder must say what to do mid-step');
    } finally {
        rmDir(repo);
    }
});

test('silent when no deferral episode is open', () => {
    // Guard 6, staged two ways: no state file at all, and a state file whose
    // episode is null. Everything else is the fire baseline.
    const repo = makeRepo({ noEpisode: true });
    try {
        assertSilent(runHook(firePayload(repo)), 'no gate state file');
        assert.strictEqual(stateBytes(repo), null, 'a hook that says nothing creates no state file');
        writeGateState(repo, null);
        const before = stateBytes(repo);
        assertSilent(runHook(firePayload(repo)), 'state file with no episode');
        assertNoStateWrite(repo, before, 'no episode to stamp');
    } finally {
        rmDir(repo);
    }
});

test('silent when the open episode belongs to another session', () => {
    // Guard 6 asks its question for THIS binding (checkpointOwner's answer),
    // not for any open episode: a bystander session's hold must never fire this
    // run's nudge. The episode is otherwise fully open and in date.
    const repo = makeRepo({ episode: { session: OTHER_SESSION } });
    try {
        const before = stateBytes(repo);
        assertSilent(runHook(firePayload(repo)), 'episode owned elsewhere');
        assertNoStateWrite(repo, before, 'a bystander hold is not this run\'s to stamp');
    } finally {
        rmDir(repo);
    }
});

test('silent when a matching checkpoint is already open', () => {
    // Guard 7. The boundary is already declared, so the next turn lands the
    // compaction there and the directive would be false. The checkpoint is
    // written by the library's own writer, so it carries a real openedAt of
    // now and matches on the ten-minute leg with no corroboration needed; the
    // episode behind it stays fully open, so only guard 7 can decide here.
    const repo = makeRepo();
    try {
        const { writeCheckpoint } = require('../plugins/claude-kit/hooks/kit-compact-lib.js');
        const written = writeCheckpoint(repo, PLAN_REL, SESSION, false);
        assert.strictEqual(written.ok, true, 'test setup: the checkpoint should write');
        const before = stateBytes(repo);
        assertSilent(runHook(firePayload(repo)), 'matching checkpoint open');
        assertNoStateWrite(repo, before, 'a boundary already declared consumes no interval');
    } finally {
        rmDir(repo);
    }
});

test('fires when the checkpoint on disk no longer matches', () => {
    // The control for guard 7: a checkpoint file exists but is expired (30
    // minutes old, no pending-offer flag, so the ten-minute leg applies), so
    // the boundary it declared is no longer honored and the hold is real. A
    // guard that stood down on the mere presence of a file would go silent
    // here, which is the exact case the operator most needs the nudge for.
    const repo = makeRepo();
    try {
        writeFile(checkpointFile(repo), JSON.stringify({
            plan: PLAN_REL,
            boundSession: SESSION,
            openedAt: iso(30 * 60 * 1000),
            pendingOffer: false
        }, null, 2) + '\n');
        assertFires(runHook(firePayload(repo)), 'expired checkpoint');
    } finally {
        rmDir(repo);
    }
});

test('silent when the payload carries agent_id, even with the correct bound session id', () => {
    // Guard 3, on the real-world subagent shape: its payload carries the PARENT
    // session's own session_id, so guard 5 passes and only the agent keys stand
    // it down. A mismatched session id here would pass for the wrong reason and
    // leave guard 3 unproven. This hook fires on Bash, which every dispatched
    // agent runs constantly, so the guard carries far more traffic here than in
    // the chapter-boundary sibling.
    const repo = makeRepo();
    try {
        assertSilent(runHook(firePayload(repo, { agent_id: 'ae3954fd9fc0deefa' })),
            'subagent payload (agent_id, parent session id)');
    } finally {
        rmDir(repo);
    }
});

test('silent when the payload carries any agent-type spelling alone', () => {
    // The four spellings the sibling subagent detectors defend
    // (readonly-agent-guard.js, docs-write-guard.js): the repo's evidence that
    // the key name varies across harness versions, and guard 3 is the only
    // stand-down a subagent gets, so every spelling must stand it down.
    const repo = makeRepo();
    try {
        for (const key of ['agent_type', 'agentType', 'subagent_type', 'subagentType']) {
            assertSilent(runHook(firePayload(repo, { [key]: 'general-purpose' })),
                'subagent payload (' + key + ')');
        }
    } finally {
        rmDir(repo);
    }
});

test('silent when the goal is bound to another session', () => {
    // Guard 5, which reads the binding before the episode is read at all, so
    // it is what decides here under either staging. The episode is staged for
    // the session the goal is bound to (the only session that can produce a
    // boundary deny) so that guard 6 is not a second reason for the same
    // silence: with the episode staged for the payload's session instead, this
    // case would still pass with guard 5 deleted.
    const repo = makeRepo({ session: OTHER_SESSION, episode: { session: OTHER_SESSION } });
    try {
        assertSilent(runHook(firePayload(repo)), 'goal bound elsewhere');
    } finally {
        rmDir(repo);
    }
});

test('a camelCase sessionId payload is read the same as session_id', () => {
    // The gate and the goal-leash Stop hook both accept either spelling, so a
    // harness emitting camelCase would keep opening episodes this hook could
    // never speak about. Guard 5 reads both for that reason.
    const repo = makeRepo();
    try {
        const payload = firePayload(repo);
        delete payload.session_id;
        payload.sessionId = SESSION;
        assertFires(runHook(payload), 'camelCase session id');
    } finally {
        rmDir(repo);
    }
});

test('silent when the goal is unbound and when none is armed', () => {
    const unbound = makeRepo({ unbound: true });
    try {
        assertSilent(runHook(firePayload(unbound)), 'unbound goal');
    } finally {
        rmDir(unbound);
    }
    const bare = makeDir('compact-deferral-nudge-repo-');
    try {
        writeGateState(bare, openEpisode());
        assertSilent(runHook(firePayload(bare)), 'no armed goal');
    } finally {
        rmDir(bare);
    }
});

// Synthetic session ids of the harness's own shape, which is what an arming
// identity recorded in the state is held to. SESSION above is deliberately of
// another shape, so no case can claim on that route by accident.
const ARM_SESSION = '3b9c1d20-7a41-4e6d-8f25-11c0de4a7b90';
const ARM_BYSTANDER = '5d2e88a4-0c13-4f77-9ab6-62f0aa31c5de';

// A repo whose goal is unbound and records the given id as the session that
// armed it, with a deferral episode open under the given owner: the state a run
// that armed a plan for itself sits in while the gate holds its offers and no
// claim point has been reached yet.
function selfArmedRepo(armingId, episodeOwner) {
    const repo = makeDir('compact-deferral-nudge-repo-');
    writeFile(path.join(repo, PLAN_REL), 'Status: In Progress\n\nbody\n');
    const armed = armGoal(repo, PLAN_REL, { sessionId: armingId, transcriptPath: null });
    assert.strictEqual(armed.ok, true, 'test setup: goal should arm');
    assert.strictEqual(armed.boundSession, null, 'test setup: the goal should arm unbound');
    writeGateState(repo, openEpisode({ session: episodeOwner }));
    return repo;
}

test('fires for the session an unbound goal records as the one that armed it', () => {
    // A run holding a claimable leash is spoken to about the hold it is under:
    // the goal reads unbound, and the denials holding this run are recorded
    // under the session id the state records as having armed it. The fixture
    // stages that pairing directly, which the hook's own header states the two
    // routes to (a claim whose bind write failed, and a re-arm landing unbound
    // beside a standing episode).
    const repo = selfArmedRepo(ARM_SESSION, ARM_SESSION);
    try {
        const context = assertFires(runHook(firePayload(repo, { session_id: ARM_SESSION })), 'arming session');
        assert.ok(context.includes('held 7 offers over 45 minutes'),
            'the emitted context must carry the phrase built from the staged episode:\n' + context);
    } finally {
        rmDir(repo);
    }
});

test('silent when the boundary this run banked before its claim is already open', () => {
    // The directive tells a run to bank a boundary and open a checkpoint. A run
    // holding a claimable leash has one open already: it carries no owner
    // because none was held when it opened, and the claim the next offer
    // carries adopts it and lands there. Emitting the directive against that
    // state asks for work that is done.
    const repo = selfArmedRepo(ARM_SESSION, ARM_SESSION);
    try {
        const { writeCheckpoint } = require('../plugins/claude-kit/hooks/kit-compact-lib.js');
        const written = writeCheckpoint(repo, PLAN_REL, null);
        assert.strictEqual(written.ok, true, 'test setup: checkpoint should write');
        assertSilent(runHook(firePayload(repo, { session_id: ARM_SESSION })), 'boundary already banked');
    } finally {
        rmDir(repo);
    }
});

test('fires when the checkpoint banked in that window names another plan', () => {
    // The control for the case above: only this run's own boundary stands the
    // directive down, and a leftover from a prior plan is not it.
    const repo = selfArmedRepo(ARM_SESSION, ARM_SESSION);
    try {
        const { writeCheckpoint } = require('../plugins/claude-kit/hooks/kit-compact-lib.js');
        const written = writeCheckpoint(repo, 'docs/plans/some-prior-run.md', null);
        assert.strictEqual(written.ok, true, 'test setup: checkpoint should write');
        assertFires(runHook(firePayload(repo, { session_id: ARM_SESSION })), 'another plan\'s checkpoint');
    } finally {
        rmDir(repo);
    }
});

test('silent for a session that is neither bound nor the recorded arming session', () => {
    const repo = selfArmedRepo(ARM_SESSION, ARM_BYSTANDER);
    try {
        assertSilent(runHook(firePayload(repo, { session_id: ARM_BYSTANDER })), 'bystander session');
    } finally {
        rmDir(repo);
    }
});

test('silent for the arming session while the open episode belongs to another session', () => {
    // The episode question stays scoped to one id: holding a claimable leash
    // says nothing about whose offers are being held, and a hold belonging to
    // some other session is not this run's to be nudged about.
    const repo = selfArmedRepo(ARM_SESSION, ARM_BYSTANDER);
    try {
        assertSilent(runHook(firePayload(repo, { session_id: ARM_SESSION })), 'another session\'s hold');
    } finally {
        rmDir(repo);
    }
});

test('silent under KIT_EXTERNAL_ENGINE=1', () => {
    const repo = makeRepo();
    try {
        assertSilent(runHook(firePayload(repo), { KIT_EXTERNAL_ENGINE: '1' }), 'external engine marker');
    } finally {
        rmDir(repo);
    }
});

test('silent for a tool name this hook does not cover', () => {
    const repo = makeRepo();
    try {
        for (const tool of ['Read', 'Edit', 'Write', 'MultiEdit', '', undefined]) {
            assertSilent(runHook(firePayload(repo, { tool_name: tool })), 'uncovered tool ' + String(tool));
        }
    } finally {
        rmDir(repo);
    }
});

test('silent when cwd is missing or not a usable string', () => {
    // Guard 4. This hook reads only the project the payload names, because a
    // shell command's working directory is not this process's. The child is
    // spawned IN the armed repo, so a fallback to its own working directory
    // would fire: the silence has to come from the refusal rather than from
    // there being nothing to find.
    const repo = makeRepo();
    try {
        assertSilent(runHook(firePayload(repo, { cwd: undefined }), null, repo), 'missing cwd');
        assertSilent(runHook(firePayload(repo, { cwd: '' }), null, repo), 'empty cwd');
        assertSilent(runHook(firePayload(repo, { cwd: 42 }), null, repo), 'non-string cwd');
    } finally {
        rmDir(repo);
    }
});

test('the share predicate refuses both network forms and nothing else', () => {
    // The end-to-end case below can only prove the refusal where an SMB stack
    // exists: on a POSIX runner '//host/share' is an ordinary missing path and
    // the silence comes from an absent goal file instead. So the predicate the
    // guard calls is pinned directly here, on every runner, in both directions.
    assert.strictEqual(namesNetworkShare('//10.255.255.1/share'), true, 'the //server form');
    assert.strictEqual(namesNetworkShare('\\\\10.255.255.1\\share'), true, 'the UNC form');
    assert.strictEqual(namesNetworkShare('\\/host/share'), true, 'a mixed doubled separator');
    assert.strictEqual(namesNetworkShare('/home/user/repo'), false, 'a POSIX absolute path');
    assert.strictEqual(namesNetworkShare('D:/repo'), false, 'a Windows drive path');
    assert.strictEqual(namesNetworkShare('D:\\repo'), false, 'a Windows backslash path');
    assert.strictEqual(namesNetworkShare('repo/sub'), false, 'a relative path');
});

test('the share predicate fails closed on a non-string, refusing rather than answering clean', () => {
    // A non-string cwd names no path at all, so there is no text to run the
    // leading-separator check against; the predicate answers true for it
    // rather than false, because a caller that cannot walk this
    // value safely either is the one this predicate exists to protect, and
    // answering false here would tell that caller cwd was fine to open when
    // the truth is there was no cwd to judge. Line 486 above already proves
    // this end to end (a 42 payload cwd produces the hook's own silence); this
    // pins the predicate's own return value directly, for every shape a
    // caller could pass that is not a string.
    assert.strictEqual(namesNetworkShare(null), true, 'null');
    assert.strictEqual(namesNetworkShare(undefined), true, 'undefined');
    assert.strictEqual(namesNetworkShare(42), true, 'a number');
});

test('a cwd naming a network share stands down without touching it', () => {
    // An unreachable UNC share blocks a filesystem open for the SMB timeout,
    // and this hook runs after every shell command, so the goal read must never
    // reach one. On Windows the spawn timeout is the discriminator: without the
    // refusal the hook hangs on the share until killed, which fails the
    // exit-code and silence assertions. Elsewhere this case only pins the
    // outcome, and the predicate test above is the control.
    const res = spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify(firePayload('//10.255.255.1/share')),
        env: scrubEngineEnv({ ...process.env }),
        encoding: 'utf8',
        timeout: 8000
    });
    assertSilent(res, 'UNC cwd');
});

test('exit 0 and silent on a malformed payload and on empty stdin', () => {
    assertSilent(runHook('this is not json {'), 'malformed payload');
    assertSilent(runHook(''), 'empty stdin');
});

test('the fire stamps nudgedAt into the state file and preserves every other field', () => {
    const repo = makeRepo();
    try {
        const before = readGateStateFile(repo);
        assertFires(runHook(firePayload(repo)), 'stamping fire');
        const after = readGateStateFile(repo);
        const stamped = Date.parse(after.episode.nudgedAt);
        assert.ok(Number.isFinite(stamped), 'nudgedAt must be written as a parseable timestamp');
        assert.ok(Math.abs(Date.now() - stamped) < 60 * 1000, 'nudgedAt must be stamped at the fire');
        assert.strictEqual(after.episode.since, before.episode.since,
            'since is preserved: it is what the reported age is measured from');
        assert.strictEqual(after.episode.denials, before.episode.denials, 'the denial count is preserved');
        assert.strictEqual(after.episode.lastDeniedAt, before.episode.lastDeniedAt,
            'lastDeniedAt is preserved: it is what the idle bound is measured from');
        assert.strictEqual(after.episode.session, before.episode.session, 'the owning session is preserved');
        assert.deepStrictEqual(after.lastDecision, before.lastDecision, 'the last decision is preserved');
        assert.deepStrictEqual(after.lastAllow, before.lastAllow, 'the last allow is preserved');
    } finally {
        rmDir(repo);
    }
});

test('a second call inside the interval is silent, and one past it fires', () => {
    const repo = makeRepo();
    try {
        assertFires(runHook(firePayload(repo)), 'first call');
        const before = stateBytes(repo);
        assertSilent(runHook(firePayload(repo)), 'second call inside the interval');
        assertNoStateWrite(repo, before, 'a call the interval refuses re-stamps nothing');

        // Age the stamp past the interval, leaving every other field alone, so
        // only guard 8 can decide the outcome.
        const state = readGateStateFile(repo);
        state.episode.nudgedAt = iso(NUDGE_INTERVAL_MS + 60 * 1000);
        writeFile(gateStateFile(repo), JSON.stringify(state, null, 2) + '\n');
        assertFires(runHook(firePayload(repo)), 'call past the interval');
    } finally {
        rmDir(repo);
    }
});

test('an unstamped, unparseable, or future-dated nudgedAt fires', () => {
    // The illegible readings all fire, which is the fail-open direction and is
    // self-healing: the stamp this fire writes replaces the illegible value.
    for (const nudgedAt of [null, 'not a date', iso(-60 * 60 * 1000)]) {
        const repo = makeRepo({ episode: { nudgedAt } });
        try {
            assertFires(runHook(firePayload(repo)), 'nudgedAt ' + String(nudgedAt));
        } finally {
            rmDir(repo);
        }
    }
});

test('silent when the episode has gone idle past the gate bound', () => {
    // gateEpisodeOpen retires an episode whose newest denial has aged past four
    // hours, and guard 6 takes that answer rather than re-deriving openness.
    // Both timestamps age together, so the fixture is a state the gate could
    // actually have written: an episode denied before it opened would exercise
    // the same bound while staging something no writer produces.
    const repo = makeRepo({
        episode: {
            since: iso(5 * 60 * 60 * 1000 + 5 * 60 * 1000),
            lastDeniedAt: iso(5 * 60 * 60 * 1000)
        }
    });
    try {
        assertSilent(runHook(firePayload(repo)), 'idle episode');
    } finally {
        rmDir(repo);
    }
});

// Make a kit library require fail inside the spawned hook: a preload module
// refuses to load that one module, standing in for the damaged or incomplete
// plugin cache the hook's deferred requires exist for. Node parses NODE_OPTIONS
// with backslash as an escape character, so the preload path is passed
// forward-slashed; a backslashed path fails to resolve and the child dies
// before the hook runs.
function requireRefusingPreload(dir, moduleFile) {
    const shim = path.join(dir, 'refuse-require-' + moduleFile);
    fs.writeFileSync(shim, [
        "'use strict';",
        "const Module = require('module');",
        'const realLoad = Module._load;',
        'Module._load = function (request) {',
        "    if (String(request).endsWith('" + moduleFile + "')) {",
        "        throw new Error('the fixture refuses this require');",
        '    }',
        '    return realLoad.apply(Module, arguments);',
        '};'
    ].join('\n') + '\n', 'utf8');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

test('a kit library that will not load leaves the hook silent rather than throwing', () => {
    // The requires are deferred into the guard that uses them precisely so a
    // damaged installed cache degrades to the pre-hook status quo. A throw here
    // would end a hook that runs after every shell command non-zero.
    const repo = makeRepo();
    try {
        for (const lib of ['kit-compact-lib.js', 'kit-goal-lib.js']) {
            assertSilent(runHook(firePayload(repo), {
                NODE_OPTIONS: requireRefusingPreload(repo, lib)
            }), 'damaged ' + lib);
        }
    } finally {
        rmDir(repo);
    }
});

test('a require failure for kit-network-lib.js refuses the call rather than answering clean', () => {
    // Guard 4's require failure answers true (refuse), not false: false is
    // the checked-and-clean value, and a damaged cache that cannot even
    // supply this small module is not evidence the working directory is
    // safe to open. The discriminator is this repo's fixture, the full FIRE
    // state (every later guard passes on its own): the fail-open direction
    // this guards against would let guard 4 pass through and the hook would
    // FIRE here; the fail-closed fix keeps it silent, exactly like the two
    // libraries above whose own failure silences the hook for a different
    // reason (the feature cannot run at all without them).
    const repo = makeRepo();
    try {
        assertSilent(runHook(firePayload(repo), {
            NODE_OPTIONS: requireRefusingPreload(repo, 'kit-network-lib.js')
        }), 'damaged kit-network-lib.js');
    } finally {
        rmDir(repo);
    }
});

test('silent when a CORROBORATED pending checkpoint is open', () => {
    // Guard 7's fourth argument, which is the section's primary scenario rather
    // than an edge: a boundary declared while the gate was already holding
    // offers, then a long tool call. The record claims pendingOffer, the
    // episode that vouches for it predates it (since 45 minutes ago, openedAt
    // 20 minutes ago), and the corroborated long bound is what keeps it
    // matching. Drop the fourth argument from the checkpointMatches call and
    // the ten-minute leg expires this record, so the hook fires and tells the
    // model to re-declare a boundary it already declared.
    const repo = makeRepo();
    try {
        writeFile(checkpointFile(repo), JSON.stringify({
            plan: PLAN_REL,
            boundSession: SESSION,
            openedAt: iso(20 * 60 * 1000),
            pendingOffer: true
        }, null, 2) + '\n');
        assertSilent(runHook(firePayload(repo)), 'corroborated pending checkpoint');
    } finally {
        rmDir(repo);
    }
});

test('the corroboration argument is what decides that case, both directions', () => {
    // The library-level control for the case above, so it cannot pass by the
    // pendingOffer flag alone: the same 20-minute-old record matches with
    // corroboration and expires without it.
    const repo = makeRepo();
    try {
        writeFile(checkpointFile(repo), JSON.stringify({
            plan: PLAN_REL,
            boundSession: SESSION,
            openedAt: iso(20 * 60 * 1000),
            pendingOffer: true
        }, null, 2) + '\n');
        const lib = require('../plugins/claude-kit/hooks/kit-compact-lib.js');
        const { readGoal } = require('../plugins/claude-kit/hooks/kit-goal-lib.js');
        const now = Date.now();
        const cp = lib.readCheckpoint(repo);
        const goal = readGoal(repo);
        const state = lib.readGateState(repo);
        assert.strictEqual(lib.pendingOfferCorroborated(cp, state, now, SESSION), true,
            'the staged episode predates the record and vouches for it');
        assert.deepStrictEqual(lib.checkpointMatches(cp, goal, now, true), { ok: true, reason: null },
            'with corroboration the record still matches at 20 minutes');
        assert.deepStrictEqual(lib.checkpointMatches(cp, goal, now, undefined),
            { ok: false, reason: 'expired' },
            'without the fourth argument the ten-minute leg expires it, and the hook would fire');
    } finally {
        rmDir(repo);
    }
});

test('a falsy agent-identity key does not stand the hook down', () => {
    // Guard 3 reads truthiness, not key presence, matching the two sibling
    // detectors. A harness version that put a null or empty agent_id on a
    // MAIN-session payload would otherwise kill the feature outright on every
    // call, with every hand-built test payload still green.
    const repo = makeRepo();
    try {
        for (const value of [null, '', 0, false]) {
            writeGateState(repo, openEpisode());
            assertFires(runHook(firePayload(repo, { agent_id: value })),
                'falsy agent_id ' + JSON.stringify(value));
        }
    } finally {
        rmDir(repo);
    }
});

test('the payload transcript is not consulted at all', () => {
    // A payload naming a transcript other than the bound one still fires. The
    // two values come from different producers (the goal CLI composes its own
    // path; a claim-point bind stores the harness's verbatim value), so any
    // spelling difference between them would be a permanent total stand-down
    // with nothing in any status surface. Guard 3 is the subagent stand-down.
    const repo = makeRepo();
    try {
        assertFires(runHook(firePayload(repo, {
            transcript_path: 'C:/Users/x/.claude/projects/p/other.jsonl'
        })), 'a foreign transcript path is no opinion');
    } finally {
        rmDir(repo);
    }
});

test('a nudge that fires leaves exactly one record in the gate journal', () => {
    // The journal is what an operator reads to tell a nudge that never fired
    // from one that fired five times and was ignored. The record is
    // distinguishable from a decision by shape: it carries event where a
    // decision carries verdict.
    const repo = makeRepo();
    try {
        assertFires(runHook(firePayload(repo)), 'open episode');
        const lines = readGateLog(repo);
        assert.strictEqual(lines.length, 1, 'one fire, one line: ' + JSON.stringify(lines));
        assert.deepStrictEqual(Object.keys(lines[0]).sort(), ['at', 'event', 'session', 'tool'],
            'the record carries the time, the event, the session and the tool, and nothing else');
        assert.strictEqual(lines[0].event, 'nudge', 'the shape that separates it from a decision');
        assert.strictEqual(lines[0].session, SESSION, 'the session the hold belongs to');
        assert.strictEqual(lines[0].tool, 'Bash',
            'the triggering tool, which is what makes a run whose nudges are all Bash readable');
        assert.ok(Number.isFinite(Date.parse(lines[0].at)), 'the time must parse');

        assertSilent(runHook(firePayload(repo)), 'the interval engages');
        assert.strictEqual(readGateLog(repo).length, 1,
            'a nudge the interval refuses writes no line either');
    } finally {
        rmDir(repo);
    }
});

test('a nudge whose journal line cannot be written still nudges and still stamps', () => {
    // The journal line is appended after the stamp and outside the stamp's
    // preconditions, so the log's writability is not one of them. Borrowing the
    // recorder's full precondition set would turn a locked or read-only log
    // into a dead interval, and the nudge would then repeat after every covered
    // tool return for the life of the episode: a flood into a context already
    // past the compaction trigger. A directory at the log path is the staging,
    // because it fails the same regular-file leg a lock does.
    const repo = makeRepo();
    try {
        fs.mkdirSync(path.join(repo, '.kit', 'compact-gate.jsonl'));
        assertFires(runHook(firePayload(repo)), 'unwritable log');
        const after = readGateStateFile(repo);
        assert.ok(Number.isFinite(Date.parse(after.episode.nudgedAt)),
            'the stamp must still land when only the log is unusable');
        assertSilent(runHook(firePayload(repo)), 'the interval engages on the very next call');
    } finally {
        rmDir(repo);
    }
});

test('silent when the stamp cannot land', (t) => {
    // The rate limit is the emission's precondition: nudgedAt is the only
    // cross-process carrier guard 8 has, so a hook that emitted without it
    // would emit after every covered tool return with no limit at all. Silence
    // is the pre-hook status quo and is the direction to fail in.
    const repo = makeRepo();
    try {
        fs.chmodSync(gateStateFile(repo), 0o444);
        let writable = true;
        try { fs.accessSync(gateStateFile(repo), fs.constants.W_OK); } catch { writable = false; }
        if (writable) {
            // A principal that ignores the read-only bit: the case cannot be
            // staged here, and a green run would prove nothing.
            t.skip('cannot stage an unwritable state file as this user');
            return;
        }
        assertSilent(runHook(firePayload(repo)), 'unwritable state file');
        assert.strictEqual(readGateStateFile(repo).episode.nudgedAt, null,
            'nothing was written, which is why nothing was said');
    } finally {
        try { fs.chmodSync(gateStateFile(repo), 0o666); } catch { /* best effort */ }
        rmDir(repo);
    }
});

test('the runnable command clause is dropped when the installed path fails the grammar', () => {
    // The reminder lands in the model's context, and double quotes do not
    // neutralize $(...) or backticks, both legal in a POSIX directory name. The
    // repo gates a composed runnable command rather than resting on provenance
    // (the doctor's branch-rename remedy), so a path outside the grammar costs
    // the command clause and nothing else.
    const phrase = 'held 7 offers over 45 minutes';
    const safe = buildReminder(phrase, 'D:/kit/plugins/claude-kit/hooks/kit-compact-checkpoint.js');
    assert.ok(safe.includes('run node "D:/kit/plugins/claude-kit/hooks/kit-compact-checkpoint.js" open'),
        'a conventional install path still renders the runnable command');

    for (const hostile of [
        'D:/kit/$(calc)/hooks/kit-compact-checkpoint.js',
        'D:/kit/`calc`/hooks/kit-compact-checkpoint.js',
        'D:/kit/a";calc;"/hooks/kit-compact-checkpoint.js',
        'D:/kit/a\ncalc/hooks/kit-compact-checkpoint.js'
    ]) {
        const guarded = buildReminder(phrase, hostile);
        assert.ok(!guarded.includes('calc'), 'no part of a refused path may reach the context:\n' + guarded);
        assert.ok(!guarded.includes('run node "'), 'a refused path renders no runnable command');
        assert.ok(guarded.includes('kit-compact-checkpoint.js'),
            'the rest of the reminder still names the tool to run');
        assert.ok(guarded.includes('held 7 offers over 45 minutes'), 'the hold is still reported');
    }
});

// Source-inspection pin, on the pattern 'one frontmatter key regex, and every
// field call site goes through the shared reader' in test/memq.test.js
// already uses: a behavioral test only proves these callers currently agree,
// not that a later edit cannot reintroduce a second spelling. The canonical
// definition lives in hooks/kit-network-lib.js, a module of a few lines
// holding namesNetworkShare and nothing else (Standing Amendment 2, folded
// from Section 7's own review: scripts/memq.js is 11,880 lines and a hot
// hook path such as this file's guard 4 cannot afford to pay its parse cost
// just to answer this one question, measured at 8.7-11.4ms warm). memq.js
// requires that module (a named exception to its own dynamic-load surface,
// pinned separately by test/memq-grant.test.js as a fixed kit-shipped
// sibling rather than a load from a directory the command line names) and
// re-exports the predicate under its own name, so hooks/memory-session.js
// and hooks/memory-frontmatter-guard.js, which already hold memq for other
// reasons, keep calling memq.namesNetworkShare unchanged. This file and
// hooks/chapter-boundary-nudge.js, which do not otherwise need memq, require
// hooks/kit-network-lib.js directly instead; this file's own namesNetworkShare
// is a delegating wrapper, legitimate re-export rather than a second spelling
// of the rule. hooks/kit-goal-lib.js carries its own independent copy of the
// underlying leading-separator test for a different subject, a stored
// transcript path rather than a working directory, so it is a ruled
// exclusion (Section 7's spec) rather than a gap this pin should close.
test('namesNetworkShare is spelled once, in kit-network-lib.js, and every other '
    + 'Section 7 file calls it rather than re-deriving the answer', () => {
    const NETWORK_LIB = path.join(
        __dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-network-lib.js');
    const OTHER_FILES = {
        'scripts/memq.js':
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts', 'memq.js'),
        'hooks/compact-deferral-nudge.js': HOOK,
        'hooks/chapter-boundary-nudge.js':
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'chapter-boundary-nudge.js'),
        'hooks/memory-session.js':
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'memory-session.js'),
        'hooks/memory-frontmatter-guard.js':
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'memory-frontmatter-guard.js')
    };
    const sources = {
        'hooks/kit-network-lib.js': fs.readFileSync(NETWORK_LIB, 'utf8')
    };
    for (const [label, file] of Object.entries(OTHER_FILES)) {
        sources[label] = fs.readFileSync(file, 'utf8');
    }

    // The predicate's own body, spelled once, in kit-network-lib.js alone. A
    // RegExp literal rather than a string so this pin cannot be defeated by
    // rewrapping the same characters in different quotes; JS source carries
    // this exact substring wherever the leading-separator test is inlined
    // rather than delegated.
    const bodySpelling = /\[\\\\\/\]\{2\}\/\.test\(/;
    const spelledIn = Object.entries(sources).filter(([, src]) => bodySpelling.test(src)).map(([l]) => l);
    assert.deepStrictEqual(spelledIn, ['hooks/kit-network-lib.js'],
        'the leading-separator test must be spelled in exactly hooks/kit-network-lib.js among '
        + 'the files this section touches, got: ' + JSON.stringify(spelledIn));

    // memq.js requires the module at the top of the file and re-exports it
    // under its own name, never re-testing the leading separators itself.
    assert.match(sources['scripts/memq.js'],
        /const \{ namesNetworkShare \} = require\('\.\.\/hooks\/kit-network-lib\.js'\);/,
        'scripts/memq.js must require kit-network-lib.js rather than re-deriving the answer');

    // memory-session.js and memory-frontmatter-guard.js call it through the
    // memq module they already hold, never as a bare local call: a bare call
    // in either file would mean a local function of the same name shadowing
    // the shared one.
    for (const label of ['hooks/memory-session.js', 'hooks/memory-frontmatter-guard.js']) {
        assert.match(sources[label], /memq\.namesNetworkShare\(/,
            label + ' must call memq.namesNetworkShare through the memq module it already holds');
    }

    // This file and chapter-boundary-nudge.js require kit-network-lib.js
    // directly for the answer rather than answering the question themselves:
    // their own namesNetworkShare declarations (this file's a named wrapper,
    // chapter-boundary-nudge.js's a destructured local) are legitimate
    // re-export/re-binding rather than a second spelling of the rule.
    assert.match(sources['hooks/compact-deferral-nudge.js'],
        /require\('\.\/kit-network-lib\.js'\)\.namesNetworkShare\(cwd\)/,
        'compact-deferral-nudge.js must delegate to kit-network-lib.js\'s export rather than '
        + 're-deriving it');
    assert.match(sources['hooks/chapter-boundary-nudge.js'],
        /\(\{ namesNetworkShare \} = require\('\.\/kit-network-lib\.js'\)\)/,
        'chapter-boundary-nudge.js must delegate to kit-network-lib.js\'s export rather than '
        + 're-deriving it');
});
