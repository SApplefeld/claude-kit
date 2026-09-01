// Tests for plugins/claude-kit/hooks/chapter-boundary-nudge.js (the
// PostToolUse chapter-boundary nudge).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a PostToolUse payload on stdin, and asserted on by
// its EXIT CODE (always 0; the hook never exits 2) and its EXACT stdout: the
// fire path must emit exactly the nested hookSpecificOutput JSON form (a
// top-level additionalContext key is inert on this harness and is pinned
// absent below), and every silent path must emit the empty string, because a
// weaker "no reminder substring" check would pass on a crashed hook. Each
// case builds a fresh temp repo with its own .kit/goal-state.json via
// armGoal/bindSession, so no case touches the real repo's live goal state.
// KIT_EXTERNAL_ENGINE is scrubbed from every child environment by default
// (this suite runs inside fleet workers too, where the marker is ambient and
// would flip every fire case into a silent stand-down); the one case that
// exercises the marker opts back in explicitly. All temp state is cleaned up
// in finally blocks.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'chapter-boundary-nudge.js');
const { armGoal, bindSession } = require('../plugins/claude-kit/hooks/kit-goal-lib.js');
const { REMINDER } = require('../plugins/claude-kit/hooks/chapter-boundary-nudge.js');

// The session id the fixtures bind the goal to; payloads default to it so the
// full fire state is the baseline and each silent case negates exactly one
// guard.
const SESSION = 'ses-11112222-aaaa-bbbb-cccc-333344445555';

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
// turn every fire case into a stand-down silence.
function scrubEngineEnv(env) {
    for (const k of Object.keys(env)) {
        if (/^KIT_EXTERNAL_ENGINE$/i.test(k)) delete env[k];
    }
    return env;
}

// Run the hook with the given payload (an object, or a raw string for the
// malformed-stdin case). Returns the spawnSync result (stdout, stderr, status).
function runHook(payload, extraEnv) {
    const env = { ...scrubEngineEnv({ ...process.env }), ...(extraEnv || {}) };
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        env,
        encoding: 'utf8'
    });
}

// A fresh temp repo with docs/plans/x_spec_v1.md armed as the kit goal and,
// unless opts.unbound, bound to SESSION.
function makeRepo(opts) {
    const o = opts || {};
    const repo = makeDir('chapter-boundary-nudge-repo-');
    const planRel = 'docs/plans/x_spec_v1.md';
    writeFile(path.join(repo, planRel), 'Status: In Progress\n\nbody\n');
    const armed = armGoal(repo, planRel);
    assert.strictEqual(armed.ok, true, 'test setup: goal should arm');
    if (!o.unbound) {
        const bound = bindSession(repo, o.session || SESSION);
        assert.strictEqual(bound.ok, true, 'test setup: goal should bind');
    }
    return repo;
}

// The baseline fire payload: a main-thread Edit appending a Chapter heading
// to the armed plan doc, from the bound session. Each case overrides exactly
// what it negates.
function firePayload(repo, overrides) {
    return {
        session_id: SESSION,
        cwd: repo,
        tool_name: 'Edit',
        tool_input: {
            file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
            old_string: 'Next: 2. The chapter-boundary nudge hook',
            new_string: '### Chapter 2\nCompleted: 2. The chapter-boundary nudge hook\nNext: 3.'
        },
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
    assert.deepStrictEqual(parsed, {
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: REMINDER
        }
    }, label + ': the emitted object must be exactly the nested form carrying the reminder');
    return parsed;
}

test('fires on an Edit appending a Chapter heading when armed and bound', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo));
        assertFires(res, 'armed-and-bound Edit');
    } finally {
        rmDir(repo);
    }
});

test('the fire path emits valid JSON whose parsed shape is exactly the nested form', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo));
        const parsed = JSON.parse(res.stdout);
        assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput'],
            'the top level must carry hookSpecificOutput and nothing else');
        assert.deepStrictEqual(Object.keys(parsed.hookSpecificOutput).sort(),
            ['additionalContext', 'hookEventName'],
            'hookSpecificOutput must carry exactly the event name and the context');
        assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
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
        const res = runHook(firePayload(repo));
        const parsed = JSON.parse(res.stdout);
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
        const res = runHook(firePayload(repo));
        const context = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
        assert.ok(context.startsWith('chapter-boundary-nudge:'),
            'the reminder must name the hook that spoke');
        assert.ok(context.includes('kit-compact-checkpoint.js open'),
            'the reminder must name the checkpoint command');
        assert.ok(context.includes('run the memory sweep, then open the compaction checkpoint'),
            'the reminder must order the boundary steps');
        assert.ok(context.includes('defers auto-compaction until a matching checkpoint is open'),
            'the reminder must state why the checkpoint matters');
        assert.ok(context.includes('executing-work'),
            'the reminder must route a skill-less session to executing-work');
        // The truth pin. The gate's hold is bounded: boundaryVerdict in
        // kit-compact-gate.js allows outright once consumption reaches
        // SAFETY_CEILING_TOKENS or the transcript reading is illegible. A
        // reminder claiming the hold lasts the whole session would ship a
        // false statement into the model's context and leave a session
        // unprepared for the valve firing mid-section.
        assert.ok(context.includes('safety valve'),
            'the reminder must name the safety valve that bounds the hold');
        assert.ok(!/for the rest of the session/.test(context),
            'the reminder must not claim the hold lasts the whole session:\n' + context);
    } finally {
        rmDir(repo);
    }
});

test('silent when the payload carries agent_id, even with the correct bound session id', () => {
    // The real-world subagent shape: its payload carries the PARENT session's
    // own session_id, so the bound-session guard passes and only the agent
    // keys stand it down. A mismatched session id here would pass for the
    // wrong reason and leave guard 3 unproven.
    //
    // The agent_id here is SYNTHETIC, standing in for the real identifier a
    // harvested payload of this shape carries: the privacy gate redacts a real
    // agent id from a fixture at the freezing step, and asks for the
    // substitution to be stated in the case's own note. The sweep behind that
    // statement ran on three predicates, the literal value, the structural
    // pattern `agent_id: [0-9a-f]{16,}`, and a bare 17-hex-token shape, over
    // tracked files, with a positive control on a synthetic 17-hex value
    // withheld from the literal list and matched on shape, which spoke.
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, { agent_id: 'agent-11112222aaaabbbb' }));
        assertSilent(res, 'subagent payload (agent_id, parent session id)');
    } finally {
        rmDir(repo);
    }
});

test('silent when the payload carries any agent-type spelling alone', () => {
    // The four spellings the sibling subagent detectors defend
    // (readonly-agent-guard.js, docs-write-guard.js): the repo's evidence
    // that the key name varies across harness versions, and guard 3 is the
    // only stand-down a subagent gets, so every spelling must stand it down.
    const repo = makeRepo();
    try {
        for (const key of ['agent_type', 'agentType', 'subagent_type', 'subagentType']) {
            const res = runHook(firePayload(repo, { [key]: 'general-purpose' }));
            assertSilent(res, 'subagent payload (' + key + ')');
        }
    } finally {
        rmDir(repo);
    }
});

test('silent when the goal is unbound', () => {
    const repo = makeRepo({ unbound: true });
    try {
        const res = runHook(firePayload(repo));
        assertSilent(res, 'unbound goal');
    } finally {
        rmDir(repo);
    }
});

test('silent when the goal is bound to another session', () => {
    const repo = makeRepo({ session: 'ses-99998888-ffff-eeee-dddd-777766665555' });
    try {
        const res = runHook(firePayload(repo));
        assertSilent(res, 'goal bound elsewhere');
    } finally {
        rmDir(repo);
    }
});

// Synthetic session ids of the harness's own shape, which is what an arming
// identity recorded in the state is held to. SESSION above is deliberately of
// another shape, so no case can claim on that route by accident.
const ARM_SESSION = '3b9c1d20-7a41-4e6d-8f25-11c0de4a7b90';
const OTHER_SESSION = '5d2e88a4-0c13-4f77-9ab6-62f0aa31c5de';

// A repo whose goal is unbound and records the given id as the session that
// armed it: the state a run that armed a plan for itself lands in when the arm
// could not corroborate its own transcript.
function selfArmedRepo(armingId) {
    const repo = makeDir('chapter-boundary-nudge-repo-');
    const planRel = 'docs/plans/x_spec_v1.md';
    writeFile(path.join(repo, planRel), 'Status: In Progress\n\nbody\n');
    const armed = armGoal(repo, planRel, { sessionId: armingId, transcriptPath: null });
    assert.strictEqual(armed.ok, true, 'test setup: goal should arm');
    assert.strictEqual(armed.boundSession, null, 'test setup: the goal should arm unbound');
    return repo;
}

test('fires for the session an unbound goal records as the one that armed it', () => {
    // The leash holder is whoever the claim points would bind, and a run that
    // armed a plan for itself is that session from the arm onward, so it gets
    // the reminder in the window before its first stop or offer writes the
    // binding down.
    const repo = selfArmedRepo(ARM_SESSION);
    try {
        assertFires(runHook(firePayload(repo, { session_id: ARM_SESSION })), 'arming session');
    } finally {
        rmDir(repo);
    }
});

test('silent for a session that is neither bound nor the recorded arming session', () => {
    const repo = selfArmedRepo(ARM_SESSION);
    try {
        assertSilent(runHook(firePayload(repo, { session_id: OTHER_SESSION })), 'bystander session');
    } finally {
        rmDir(repo);
    }
});

test('silent for the arming session once the goal is bound to another session', () => {
    // A binding is the answer wherever there is one: the arming id is a route
    // to claiming an UNBOUND leash, never a standing second holder of a bound
    // one.
    const repo = selfArmedRepo(ARM_SESSION);
    try {
        const bound = bindSession(repo, OTHER_SESSION);
        assert.strictEqual(bound.ok, true, 'test setup: goal should bind');
        assertSilent(runHook(firePayload(repo, { session_id: ARM_SESSION })), 'arming session, bound elsewhere');
    } finally {
        rmDir(repo);
    }
});

test('silent when no goal is armed at all', () => {
    const repo = makeDir('chapter-boundary-nudge-repo-');
    try {
        writeFile(path.join(repo, 'docs', 'plans', 'x_spec_v1.md'), 'Status: In Progress\n\nbody\n');
        const res = runHook(firePayload(repo));
        assertSilent(res, 'no armed goal');
    } finally {
        rmDir(repo);
    }
});

test('silent on a non-plan path', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_input: {
                file_path: path.join(repo, 'docs', 'notes.md'),
                old_string: 'x',
                new_string: '### Chapter 2\nbody'
            }
        }));
        assertSilent(res, 'non-plan path');
    } finally {
        rmDir(repo);
    }
});

test('fires on a Windows backslash path whose tail names the armed plan', () => {
    // The armed-plan comparison is a suffix match on the goal's repo-relative
    // plan path, so an absolute backslash path fires when its tail is the
    // armed plan, wherever the payload says the repo sits.
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_input: {
                file_path: 'D:\\somewhere\\docs\\plans\\x_spec_v1.md',
                old_string: 'Next: 2.',
                new_string: '### Chapter 2\nCompleted: 2. thing'
            }
        }));
        assertFires(res, 'backslash path naming the armed plan');
    } finally {
        rmDir(repo);
    }
});

test('silent on a sibling plan doc while the armed plan fires', () => {
    // Two plan docs in one tree is this repository's normal state. The
    // reminder asserts a boundary on the leashed run, and a Chapter landing
    // in a plan the goal is not armed on is not one, so a sibling doc under
    // the same docs/plans/ must stand down while the armed plan still fires.
    const repo = makeRepo();
    try {
        const sibling = runHook(firePayload(repo, {
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'y_spec_v1.md'),
                old_string: 'Next: 2. thing',
                new_string: '### Chapter 2\nCompleted: 2. thing'
            }
        }));
        assertSilent(sibling, 'sibling plan doc');

        const armed = runHook(firePayload(repo));
        assertFires(armed, 'armed plan doc beside a sibling');
    } finally {
        rmDir(repo);
    }
});

test('fires on a real append whose old_string anchors on the previous Chapter', () => {
    // The shape the hook exists to detect: on any plan doc past its first
    // boundary, the append's old_string anchors on the document's tail and
    // therefore contains the previous Chapter's heading. A rule testing for
    // any heading in old_string goes silent here; the Chapter-number diff
    // (2 in new, only 1 in old) is what fires.
    const repo = makeRepo();
    try {
        const oldTail = '### Chapter 1 - 2026-08-21\nCompleted: 1. Probe\nNext: 2. The hook\n';
        const res = runHook(firePayload(repo, {
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                old_string: oldTail,
                new_string: oldTail + '\n### Chapter 2 - 2026-08-21\nCompleted: 2. The hook\nNext: 3.\n'
            }
        }));
        assertFires(res, 'append anchored on the previous Chapter');
    } finally {
        rmDir(repo);
    }
});

test('silent on an Edit whose old_string already contains the heading', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                old_string: '### Chapter 2\nCompleted: 2. thing\nNext: 3.',
                new_string: '### Chapter 2\nCompleted: 2. thing\nStamps: 1\nNext: 3.'
            }
        }));
        assertSilent(res, 'edit inside an existing Chapter');
    } finally {
        rmDir(repo);
    }
});

test('MultiEdit fires when any one edit adds the heading', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_name: 'MultiEdit',
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                edits: [
                    { old_string: 'Status: In Progress', new_string: 'Status: In Progress ' },
                    { old_string: 'body', new_string: '### Chapter 2\nCompleted: 2. thing' }
                ]
            }
        }));
        assertFires(res, 'MultiEdit adding a Chapter');
    } finally {
        rmDir(repo);
    }
});

test('MultiEdit is silent when every edit already had the heading or adds none', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_name: 'MultiEdit',
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                edits: [
                    { old_string: 'Status: In Progress', new_string: 'Status: Complete' },
                    { old_string: '### Chapter 2\nNext: 3.', new_string: '### Chapter 2\nNext: 3. thing' }
                ]
            }
        }));
        assertSilent(res, 'MultiEdit with no Chapter added');
    } finally {
        rmDir(repo);
    }
});

test('MultiEdit is silent when edits is not an array', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_name: 'MultiEdit',
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                edits: '### Chapter 2'
            }
        }));
        assertSilent(res, 'MultiEdit with non-array edits');
    } finally {
        rmDir(repo);
    }
});

test('Write fires when its content contains the heading', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_name: 'Write',
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                content: '# Plan\n\n## Chapters\n\n### Chapter 2\nCompleted: 2. thing\n'
            }
        }));
        assertFires(res, 'Write carrying a Chapter');
    } finally {
        rmDir(repo);
    }
});

test('silent when tool_name is not Edit, MultiEdit, or Write', () => {
    // Pins the silent outcome for an unmatched tool, which two layers
    // produce independently: guard 1's in-code tool check and the name
    // dispatch inside the Chapter detection, either of which stands the
    // hook down alone. The case cannot tell the two apart, so it pins the
    // behavior (a widened hooks.json matcher stays silent), not which layer
    // delivered it.
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, { tool_name: 'Read' }));
        assertSilent(res, 'unmatched tool_name');
    } finally {
        rmDir(repo);
    }
});

test('a newline between the heading tokens is not a Chapter heading', () => {
    // The heading pattern's inter-token whitespace is [ \t], not \s, so
    // prose that starts a line with '### ' and continues 'Chapter N' on the
    // next line never reads as a heading.
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo, {
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                old_string: 'body',
                new_string: '### \nChapter 2 was hard to write\n'
            }
        }));
        assertSilent(res, 'newline-split pseudo-heading');
    } finally {
        rmDir(repo);
    }
});

test('a cwd naming a network share stands down without touching it', () => {
    // An unreachable UNC share blocks a filesystem open for the SMB timeout,
    // and this hook runs after every edit, so the goal read must never reach
    // one. The spawn timeout is the discriminator: without the refusal the
    // hook hangs on the share until killed, which fails the exit-code and
    // silence assertions.
    const res = spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify(firePayload('//10.255.255.1/share')),
        env: scrubEngineEnv({ ...process.env }),
        encoding: 'utf8',
        timeout: 8000
    });
    assertSilent(res, 'UNC cwd');
});

test('silent under KIT_EXTERNAL_ENGINE=1', () => {
    const repo = makeRepo();
    try {
        const res = runHook(firePayload(repo), { KIT_EXTERNAL_ENGINE: '1' });
        assertSilent(res, 'external engine marker');
    } finally {
        rmDir(repo);
    }
});

test('exit 0 and silent on a malformed payload', () => {
    const res = runHook('this is not json {');
    assertSilent(res, 'malformed payload');
});

test('exit 0 and silent on empty stdin', () => {
    const res = runHook('');
    assertSilent(res, 'empty stdin');
});

test('silent when tool_input is missing or file_path is not a string', () => {
    const repo = makeRepo();
    try {
        assertSilent(runHook(firePayload(repo, { tool_input: undefined })), 'missing tool_input');
        assertSilent(runHook(firePayload(repo, { tool_input: { old_string: 'a', new_string: '### Chapter 2' } })), 'missing file_path');
        assertSilent(runHook(firePayload(repo, {
            tool_input: { file_path: 42, old_string: 'a', new_string: '### Chapter 2' }
        })), 'non-string file_path');
    } finally {
        rmDir(repo);
    }
});

test('cross-component pin: the heading regex accepts both curating-docs contract shapes', () => {
    // Fixture shapes from the curating-docs machine contract table: the
    // canonical '### Chapter 12' (only the word and the number are parsed)
    // and the conventional trailing-date form '### Chapter 3 - 2026-08-21'.
    // Pinning both here is what keeps this hook and the contract table from
    // drifting apart.
    const repo = makeRepo();
    try {
        const canonical = runHook(firePayload(repo, {
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                old_string: 'Next: 12. thing',
                new_string: '### Chapter 12\nCompleted: 12. thing'
            }
        }));
        assertFires(canonical, 'canonical heading shape');

        const dated = runHook(firePayload(repo, {
            tool_input: {
                file_path: path.join(repo, 'docs', 'plans', 'x_spec_v1.md'),
                old_string: 'Next: 3. thing',
                new_string: '### Chapter 3 - 2026-08-21\nCompleted: 3. thing'
            }
        }));
        assertFires(dated, 'trailing-date heading shape');
    } finally {
        rmDir(repo);
    }
});
