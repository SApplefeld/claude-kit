// Unit tests for plugins/claude-kit/hooks/kit-goal-lib.js.
//
// Node's built-in test runner, no framework, no install (Node v24). Each test
// builds a fresh temp directory under os.tmpdir() as a fake repo cwd, writes
// whatever plan fixture it needs, runs the lib against it, and cleans up in a
// finally block regardless of pass/fail. The event-stream cases additionally
// point KIT_EVENTS_PATH inside that temp dir, alongside KIT_EVENTS_PATH_ALLOW=1
// (the override is honored only with that signal set), and restore both
// variables afterward, so no in-process case falls back to and appends at the
// real ~/.claude/kit-events.jsonl. The gate and the ungated-fallback direction
// are pinned in spawned children instead (see gateSpawnEnv below), because the
// once-per-process stderr-note flag lives at module scope and a second
// in-process case would see it already tripped.

'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    goalPath,
    readGoal,
    armGoal,
    advanceGoal,
    bindSession,
    clearGoal,
    composeCondition,
    planHead,
    emitGoalEvent
} = require('../plugins/claude-kit/hooks/kit-goal-lib.js');

const CLI = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal.js');

// Scrub the run-scoped variables for the file's whole run. This suite runs
// inside fleet workers too, where the engine sets KIT_RUN_ID, and an inherited
// value would attach a `run` field to every event the in-process schema tests
// below emit, breaking their exact Object.keys assertions. Restored once at
// the end so a later test file in the same process (there is none today, but
// node's runner can share a process across files) sees the ambient value it
// started with.
const priorRunEnv = {
    KIT_RUN_ID: process.env.KIT_RUN_ID,
    KIT_SPAWN_VECTOR: process.env.KIT_SPAWN_VECTOR,
    KIT_RUN_SECTION: process.env.KIT_RUN_SECTION
};
delete process.env.KIT_RUN_ID;
delete process.env.KIT_SPAWN_VECTOR;
delete process.env.KIT_RUN_SECTION;
after(() => {
    for (const key of Object.keys(priorRunEnv)) {
        if (priorRunEnv[key] === undefined) delete process.env[key];
        else process.env[key] = priorRunEnv[key];
    }
});

// Fresh temp dir per test, acting as a fake repo root.
function makeRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-goal-test-'));
    return dir;
}

function rmRepo(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // Best-effort cleanup; leaving a temp dir behind never fails the test.
    }
}

function writePlan(repo, relPath, contents) {
    const full = path.join(repo, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, 'utf8');
}

test('armGoal success writes goal-state.json with the exact schema', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n\nsome content\n');
        const result = armGoal(repo, 'docs/plans/foo.md');
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.plan, 'docs/plans/foo.md');

        const state = readGoal(repo);
        assert.ok(state, 'goal state should be readable after arming');
        assert.deepStrictEqual(Object.keys(state).sort(),
            ['armedAt', 'boundSession', 'boundTranscript', 'condition', 'history', 'plan', 'queue', 'queueIndex']);
        assert.strictEqual(state.plan, 'docs/plans/foo.md');
        assert.strictEqual(state.boundSession, null, 'a freshly armed goal is unbound');
        assert.strictEqual(state.boundTranscript, null, 'the transcript is recorded at claim time, not at arm');
        assert.deepStrictEqual(state.queue, ['docs/plans/foo.md'], 'one plan is a queue of one');
        assert.strictEqual(state.queueIndex, 0);
        assert.deepStrictEqual(state.history, []);
        assert.ok(!state.plan.includes('\\'), 'plan path must be forward-slash');
        // The stored condition is whatever composeCondition produces, so the
        // clause text is pinned in one place (its own test) rather than twice.
        assert.strictEqual(state.condition, composeCondition('docs/plans/foo.md'));
        assert.ok(!Number.isNaN(Date.parse(state.armedAt)), 'armedAt should be a valid ISO timestamp');
    } finally {
        rmRepo(repo);
    }
});

test('armGoal writes atomically: no leftover .tmp.<pid> file after success', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        const result = armGoal(repo, 'docs/plans/foo.md');
        assert.strictEqual(result.ok, true);
        assert.ok(fs.existsSync(goalPath(repo)));
        // armGoal runs in this same process, so its tmp name is deterministic here.
        assert.ok(!fs.existsSync(goalPath(repo) + '.tmp.' + process.pid));
    } finally {
        rmRepo(repo);
    }
});

test('armGoal rejects a missing plan file', () => {
    const repo = makeRepo();
    try {
        const result = armGoal(repo, 'docs/plans/does-not-exist.md');
        assert.strictEqual(result.ok, false);
        assert.match(result.reason, /not found/i);
        assert.ok(!fs.existsSync(goalPath(repo)), 'no state file should be written on rejection');
    } finally {
        rmRepo(repo);
    }
});

test('armGoal rejects a plan whose header is Status: Complete', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/done.md', 'Status: Complete\n\nfinished\n');
        const result = armGoal(repo, 'docs/plans/done.md');
        assert.strictEqual(result.ok, false);
        assert.match(result.reason, /Complete/);
        assert.ok(!fs.existsSync(goalPath(repo)), 'no state file should be written on rejection');
    } finally {
        rmRepo(repo);
    }
});

test('armGoal accepts a plan whose header is Status: In Progress', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/wip.md', 'Status: In Progress\n\nworking\n');
        const result = armGoal(repo, 'docs/plans/wip.md');
        assert.strictEqual(result.ok, true);
        assert.ok(fs.existsSync(goalPath(repo)));
    } finally {
        rmRepo(repo);
    }
});

test('armGoal rejects a relative path that escapes the repo', () => {
    const repo = makeRepo();
    try {
        const result = armGoal(repo, '../outside.md');
        assert.strictEqual(result.ok, false);
        assert.match(result.reason, /outside the repo/i);
        assert.ok(!fs.existsSync(goalPath(repo)));
    } finally {
        rmRepo(repo);
    }
});

test('armGoal rejects an absolute path outside the repo', () => {
    const repo = makeRepo();
    const other = makeRepo();
    try {
        writePlan(other, 'plan.md', 'Status: In Progress\n');
        const result = armGoal(repo, path.join(other, 'plan.md'));
        assert.strictEqual(result.ok, false);
        assert.match(result.reason, /outside the repo/i);
        assert.ok(!fs.existsSync(goalPath(repo)));
    } finally {
        rmRepo(repo);
        rmRepo(other);
    }
});

test('armGoal accepts an absolute path under cwd and re-relativizes it', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/abs.md', 'Status: In Progress\n');
        const absPath = path.join(repo, 'docs', 'plans', 'abs.md');
        const result = armGoal(repo, absPath);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.plan, 'docs/plans/abs.md');
        const state = readGoal(repo);
        assert.strictEqual(state.plan, 'docs/plans/abs.md');
    } finally {
        rmRepo(repo);
    }
});

test('readGoal returns null when absent, the object when present, null on corrupt JSON', () => {
    const repo = makeRepo();
    try {
        assert.strictEqual(readGoal(repo), null);

        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        armGoal(repo, 'docs/plans/foo.md');
        const state = readGoal(repo);
        assert.ok(state);
        assert.strictEqual(state.plan, 'docs/plans/foo.md');

        fs.writeFileSync(goalPath(repo), '{ not valid json', 'utf8');
        assert.strictEqual(readGoal(repo), null);
    } finally {
        rmRepo(repo);
    }
});

test('clearGoal removes the file and is a no-op when absent', () => {
    const repo = makeRepo();
    try {
        assert.deepStrictEqual(clearGoal(repo), { ok: true, cleared: false });

        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        armGoal(repo, 'docs/plans/foo.md');
        assert.ok(fs.existsSync(goalPath(repo)));

        assert.deepStrictEqual(clearGoal(repo), { ok: true, cleared: true });
        assert.ok(!fs.existsSync(goalPath(repo)));

        assert.deepStrictEqual(clearGoal(repo), { ok: true, cleared: false });
    } finally {
        rmRepo(repo);
    }
});

test('clearGoal reports a failed delete as ok:false, never as "nothing was armed"', () => {
    // A directory occupying the goal-state path makes unlinkSync fail, standing
    // in for any delete failure (e.g. permissions). The caller must be able to
    // distinguish "still armed and enforcing" from "nothing to clear".
    const repo = makeRepo();
    try {
        fs.mkdirSync(goalPath(repo), { recursive: true });
        const result = clearGoal(repo);
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.cleared, false);
        assert.ok(result.reason && result.reason.includes('could not clear'));
    } finally {
        rmRepo(repo);
    }
});

test('planHead classifies complete, in progress, unknown, and missing', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'complete.md', 'Status: Complete\n');
        assert.deepStrictEqual(planHead(repo, 'complete.md'), { exists: true, status: 'complete' });

        writePlan(repo, 'in-progress.md', 'Status: In Progress\n');
        assert.deepStrictEqual(planHead(repo, 'in-progress.md'), { exists: true, status: 'in progress' });

        writePlan(repo, 'unknown.md', 'Status: Approved\n');
        assert.deepStrictEqual(planHead(repo, 'unknown.md'), { exists: true, status: 'unknown' });

        const missing = planHead(repo, 'no-such-file.md');
        assert.strictEqual(missing.exists, false);
    } finally {
        rmRepo(repo);
    }
});

test('planHead does not classify a "Status:" header whose value sits on the next line', () => {
    const repo = makeRepo();
    try {
        // The value must sit on the header's own line: horizontal-whitespace-only
        // separation never crosses a newline. A bare "Status:" line above a line
        // beginning "complete" is 'unknown', not 'complete'; misclassifying it as
        // complete would auto-clear and silently kill an armed leash.
        writePlan(repo, 'docs/plans/split.md', '# Plan\nStatus:\ncomplete the migration next.\n');
        assert.deepStrictEqual(planHead(repo, 'docs/plans/split.md'), { exists: true, status: 'unknown' });
    } finally {
        rmRepo(repo);
    }
});

test('planHead classifies a header behind a UTF-8 BOM (PowerShell Set-Content writes one)', () => {
    const repo = makeRepo();
    try {
        // A leading BOM would push the ^ anchor off the header; it is stripped so
        // the classification still sees "Status: In Progress".
        const bom = String.fromCharCode(0xFEFF);
        writePlan(repo, 'docs/plans/bom.md', bom + 'Status: In Progress\n\nbody\n');
        assert.deepStrictEqual(planHead(repo, 'docs/plans/bom.md'), { exists: true, status: 'in progress' });
    } finally {
        rmRepo(repo);
    }
});

// Pins the canonical condition text exactly. composeCondition is the single
// source of that text and nothing parses it, so the only thing keeping it
// honest is this literal: a clause the Stop hook does not actually enforce
// would otherwise reach goal-state.json, and a human reading it would be
// promised a release that never comes. An exact compare is free here because
// the function is pure and deterministic, and it catches a reworded or
// re-added clause that an absence check on '(c)' would sail past.
test('composeCondition embeds the plan path, the parallelization request, and exactly clauses (a) and (b) plus the waiting pause', () => {
    assert.strictEqual(
        composeCondition('docs/plans/example.md'),
        'Work docs/plans/example.md to completion using executing-work. Arming is '
        + "Scott's request for this run: reduce wall-clock time by parallelizing "
        + 'work that can run simultaneously, via subagent dispatch and via '
        + 'Workflows. Met when (a) every section is complete and closed out, or '
        + '(b) you are BLOCKED on a decision only Scott can make and have said so. '
        + 'Capacity is never a blocker: auto-compaction rides through with the '
        + 'leash intact. Waiting on dispatched background work is a pause, not a '
        + "stop: lead with 'WAITING:' and what you await; the leash stays armed "
        + 'and the completion notification resumes the run.'
    );
});

test('armGoal re-arms idempotently over an existing goal state', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/first.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/second.md', 'Status: In Progress\n');

        assert.strictEqual(armGoal(repo, 'docs/plans/first.md').ok, true);
        assert.strictEqual(readGoal(repo).plan, 'docs/plans/first.md');

        // Re-arming replaces the prior state in place (rename over an existing
        // destination), leaving no stale .tmp and the newest plan recorded.
        assert.strictEqual(armGoal(repo, 'docs/plans/second.md').ok, true);
        assert.strictEqual(readGoal(repo).plan, 'docs/plans/second.md');
        assert.ok(!fs.existsSync(goalPath(repo) + '.tmp'));
    } finally {
        rmRepo(repo);
    }
});

test('planHead anchors Status: body prose that mentions in progress does not misclassify a Complete plan', () => {
    const repo = makeRepo();
    try {
        // A Complete plan whose Chapter body contains the phrase "in progress".
        // Anchored matching keeps this classified complete (and thus refused for
        // arming); an unanchored substring scan would misread it as in progress.
        writePlan(repo, 'docs/plans/tricky.md',
            'Status: Complete\n\n## Chapters\nSection 3 was in progress before it finished.\n');
        assert.deepStrictEqual(planHead(repo, 'docs/plans/tricky.md'), { exists: true, status: 'complete' });

        const result = armGoal(repo, 'docs/plans/tricky.md');
        assert.strictEqual(result.ok, false);
        assert.match(result.reason, /Complete/);
        assert.ok(!fs.existsSync(goalPath(repo)));
    } finally {
        rmRepo(repo);
    }
});

test('bindSession binds an armed goal, and re-arming resets the binding to null', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        assert.strictEqual(armGoal(repo, 'docs/plans/foo.md').ok, true);
        assert.strictEqual(readGoal(repo).boundSession, null, 'a freshly armed goal is unbound');

        assert.strictEqual(bindSession(repo, 'sess-1').ok, true);
        assert.strictEqual(readGoal(repo).boundSession, 'sess-1');
        // bindSession runs in this same process, so its tmp name is deterministic here.
        assert.ok(!fs.existsSync(goalPath(repo) + '.tmp.' + process.pid), 'no leftover tmp after an atomic bind');

        // Re-arming (the crash-recovery rebind opportunity) resets the binding so
        // the successor session can claim it fresh.
        assert.strictEqual(armGoal(repo, 'docs/plans/foo.md').ok, true);
        assert.strictEqual(readGoal(repo).boundSession, null, 're-arm resets the binding');
    } finally {
        rmRepo(repo);
    }
});

test('bindSession returns ok:false without writing when no goal is armed', () => {
    const repo = makeRepo();
    try {
        const result = bindSession(repo, 'sess-1');
        assert.strictEqual(result.ok, false);
        assert.ok(!fs.existsSync(goalPath(repo)), 'no state file is created by a bind on an unarmed repo');
    } finally {
        rmRepo(repo);
    }
});

test('bindSession rejects an unusable session id and never throws', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        armGoal(repo, 'docs/plans/foo.md');
        // A newline in a session id would smuggle text into goal-state.json, which
        // the hooks surface into context; reject it, staying unbound.
        assert.strictEqual(bindSession(repo, 'sess\n1').ok, false);
        assert.strictEqual(bindSession(repo, '').ok, false);
        assert.strictEqual(readGoal(repo).boundSession, null);
    } finally {
        rmRepo(repo);
    }
});

test('bindSession reports a failed write as ok:false and leaves the prior binding intact', () => {
    // A directory occupying the exact tmp path (this call runs in-process, so
    // its pid-suffixed name is deterministic here) makes the atomic write fail,
    // standing in for any filesystem failure. The caller (the hook) still
    // enforces the stop; the binding just does not persist until a later stop.
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        armGoal(repo, 'docs/plans/foo.md');
        fs.mkdirSync(goalPath(repo) + '.tmp.' + process.pid, { recursive: true });
        const result = bindSession(repo, 'sess-1');
        assert.strictEqual(result.ok, false);
        assert.ok(result.reason && result.reason.includes('could not write'));
        assert.strictEqual(readGoal(repo).boundSession, null, 'the prior binding is unchanged by a failed write');
    } finally {
        rmRepo(repo);
    }
});

test('bindSession rejects an oversized session id and never throws', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        armGoal(repo, 'docs/plans/foo.md');
        // A session id padded to kilobytes (whatever produced it) must be
        // refused outright rather than written into the state file, which would
        // deaden the leash until re-arm.
        const result = bindSession(repo, 'x'.repeat(129));
        assert.strictEqual(result.ok, false);
        assert.strictEqual(bindSession(repo, 'x'.repeat(128)).ok, true, 'exactly the cap is still accepted');
        assert.strictEqual(readGoal(repo).boundSession, 'x'.repeat(128));
    } finally {
        rmRepo(repo);
    }
});

test('CLI status reports the binding: unbound after arm, bound after bindSession', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        armGoal(repo, 'docs/plans/foo.md');

        let res = spawnSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(res.status, 0);
        assert.match(res.stdout, /armed for docs\/plans\/foo\.md/);
        assert.match(res.stdout, /unbound/);

        bindSession(repo, 'sess-42');
        res = spawnSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(res.status, 0);
        assert.match(res.stdout, /bound to session sess-42/);
    } finally {
        rmRepo(repo);
    }
});

// A goal-state file in the pre-queue shape: plan, condition, armedAt, and
// boundSession only. Every reader goes through readGoal's normalizer, so this
// fixture is how the suite proves a state file written before the queue
// existed still reads and advances correctly.
function writeLegacyState(repo, planRel, boundSession) {
    fs.mkdirSync(path.dirname(goalPath(repo)), { recursive: true });
    fs.writeFileSync(goalPath(repo), JSON.stringify({
        plan: planRel,
        condition: composeCondition(planRel),
        armedAt: new Date().toISOString(),
        boundSession: boundSession === undefined ? null : boundSession
    }, null, 2) + '\n', 'utf8');
}

test('armGoal arms an ordered queue from several plans, with the first as the current plan', () => {
    const repo = makeRepo();
    try {
        for (const name of ['a', 'b', 'c']) {
            writePlan(repo, 'docs/plans/' + name + '.md', 'Status: In Progress\n');
        }
        const result = armGoal(repo, ['docs/plans/a.md', 'docs/plans/b.md', 'docs/plans/c.md']);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.plan, 'docs/plans/a.md', 'the first plan is the current one');
        assert.deepStrictEqual(result.queue, ['docs/plans/a.md', 'docs/plans/b.md', 'docs/plans/c.md']);

        const state = readGoal(repo);
        // plan and boundSession keep their pre-queue meanings (current plan,
        // leash holder): the compaction gate and the stop-failure watcher read
        // exactly that pair and must keep working against a queued state.
        assert.strictEqual(state.plan, 'docs/plans/a.md');
        assert.strictEqual(state.boundSession, null);
        assert.deepStrictEqual(state.queue, ['docs/plans/a.md', 'docs/plans/b.md', 'docs/plans/c.md']);
        assert.strictEqual(state.queueIndex, 0);
        assert.deepStrictEqual(state.history, []);
        assert.strictEqual(state.condition, composeCondition('docs/plans/a.md', state.queue, 0));
        assert.match(state.condition, /docs\/plans\/b\.md, docs\/plans\/c\.md/, 'the condition names what is still to come');
    } finally {
        rmRepo(repo);
    }
});

test('a one-plan arm and a legacy state read back identically through the normalizer', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/solo.md', 'Status: In Progress\n');
        assert.strictEqual(armGoal(repo, 'docs/plans/solo.md').ok, true);
        const armed = readGoal(repo);

        // The pre-queue shape carries none of the new fields; the normalizer
        // supplies them, so a legacy file is a queue of one and every reader
        // downstream sees the same object an arm would have produced.
        writeLegacyState(repo, 'docs/plans/solo.md');
        const legacy = readGoal(repo);
        for (const key of ['plan', 'boundSession', 'boundTranscript', 'queue', 'queueIndex', 'history', 'condition']) {
            assert.deepStrictEqual(legacy[key], armed[key], key + ' reads identically');
        }
    } finally {
        rmRepo(repo);
    }
});

test('readGoal normalizes a queue that disagrees with plan back to a queue of one', () => {
    const repo = makeRepo();
    try {
        // A hand-edited or half-written state file whose queue does not contain
        // the current plan at queueIndex. plan is the authority on what is being
        // worked, so the queue is discarded rather than believed: believing it
        // would advance the leash onto a plan nobody armed.
        fs.mkdirSync(path.dirname(goalPath(repo)), { recursive: true });
        fs.writeFileSync(goalPath(repo), JSON.stringify({
            plan: 'docs/plans/a.md',
            queue: ['docs/plans/x.md', 'docs/plans/y.md'],
            queueIndex: 1,
            history: 'not an array',
            boundTranscript: 'bad\npath'
        }) + '\n', 'utf8');
        const state = readGoal(repo);
        assert.deepStrictEqual(state.queue, ['docs/plans/a.md']);
        assert.strictEqual(state.queueIndex, 0);
        assert.deepStrictEqual(state.history, []);
        assert.strictEqual(state.boundTranscript, null, 'a transcript path with a control character is dropped at read');
    } finally {
        rmRepo(repo);
    }
});

test('armGoal refuses the whole queue when any plan fails, naming the offender and writing nothing', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/good.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/done.md', 'Status: Complete\n');

        // A partial queue is the silent-failure shape: the operator would think
        // the sequence was armed and lose the tail. Every refusal names the
        // offending path and leaves no state file at all.
        const cases = [
            { args: ['docs/plans/good.md', 'docs/plans/missing.md'], reason: /not found: docs\/plans\/missing\.md/ },
            { args: ['docs/plans/good.md', 'docs/plans/done.md'], reason: /already Complete: docs\/plans\/done\.md/ },
            { args: ['docs/plans/good.md', '../outside.md'], reason: /outside the repo: \.\.\/outside\.md/ },
            { args: ['docs/plans/good.md', 'docs/plans/evil\nInjected.md'], reason: /outside the repo: docs\/plans\/evilInjected\.md/ },
            { args: ['docs/plans/good.md', 'docs/plans/good.md'], reason: /twice in the queue: docs\/plans\/good\.md/ },
            { args: [], reason: /no plan path given/ }
        ];
        for (const c of cases) {
            const result = armGoal(repo, c.args);
            assert.strictEqual(result.ok, false, JSON.stringify(c.args) + ' must be refused');
            assert.match(result.reason, c.reason);
            assert.ok(!fs.existsSync(goalPath(repo)), 'nothing is written for ' + JSON.stringify(c.args));
        }

        // The other direction: the same first plan in a queue whose every entry
        // is valid does arm, so the refusals above are the check working, not
        // the whole path being broken.
        writePlan(repo, 'docs/plans/second.md', 'Status: In Progress\n');
        assert.strictEqual(armGoal(repo, ['docs/plans/good.md', 'docs/plans/second.md']).ok, true);
        assert.deepStrictEqual(readGoal(repo).queue, ['docs/plans/good.md', 'docs/plans/second.md']);
    } finally {
        rmRepo(repo);
    }
});

test('armGoal refusing a queue leaves an existing armed goal untouched', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/a.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/b.md', 'Status: In Progress\n');
        assert.strictEqual(armGoal(repo, 'docs/plans/a.md').ok, true);
        const before = fs.readFileSync(goalPath(repo), 'utf8');

        assert.strictEqual(armGoal(repo, ['docs/plans/b.md', 'docs/plans/nope.md']).ok, false);
        assert.strictEqual(fs.readFileSync(goalPath(repo), 'utf8'), before,
            'a refused re-arm must not disturb the goal already enforcing');
    } finally {
        rmRepo(repo);
    }
});

test('advanceGoal moves to the next plan, records the outcome, and preserves the binding', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/a.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/b.md', 'Status: In Progress\n');
        assert.strictEqual(armGoal(repo, ['docs/plans/a.md', 'docs/plans/b.md']).ok, true);
        assert.strictEqual(bindSession(repo, 'sess-1', '/tmp/transcript.jsonl').ok, true);
        const armedAt = readGoal(repo).armedAt;

        const result = advanceGoal(repo, { outcome: 'complete' });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.advanced, true);
        assert.strictEqual(result.finished, 'docs/plans/a.md');
        assert.strictEqual(result.plan, 'docs/plans/b.md');

        const state = readGoal(repo);
        assert.strictEqual(state.plan, 'docs/plans/b.md', 'plan is the new current plan');
        assert.strictEqual(state.queueIndex, 1);
        assert.deepStrictEqual(state.queue, ['docs/plans/a.md', 'docs/plans/b.md']);
        assert.strictEqual(state.condition, composeCondition('docs/plans/b.md', state.queue, 1),
            'the condition is recomposed for the new current plan');
        // One binding rides the whole queue: the session that claimed the arming
        // stays leashed across every plan without re-arming.
        assert.strictEqual(state.boundSession, 'sess-1');
        assert.strictEqual(state.boundTranscript, '/tmp/transcript.jsonl');
        assert.strictEqual(state.armedAt, armedAt, 'the arming time is the queue\'s, not the plan\'s');
        assert.strictEqual(state.history.length, 1);
        assert.strictEqual(state.history[0].plan, 'docs/plans/a.md');
        assert.strictEqual(state.history[0].outcome, 'complete');
        assert.ok(!Number.isNaN(Date.parse(state.history[0].at)));
        assert.ok(!('note' in state.history[0]), 'no note is recorded when none was given');
        assert.ok(!fs.existsSync(goalPath(repo) + '.tmp.' + process.pid), 'the advance is one atomic rewrite');
    } finally {
        rmRepo(repo);
    }
});

test('advanceGoal records a blocked outcome with its sanitized note', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/a.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/b.md', 'Status: In Progress\n');
        armGoal(repo, ['docs/plans/a.md', 'docs/plans/b.md']);
        // The note originates in transcript text, so it is normalized to short
        // printable ASCII before it reaches a file the hooks surface into the
        // model's context.
        const result = advanceGoal(repo, { outcome: 'blocked', note: 'need a decision\n' + 'x'.repeat(200) });
        assert.strictEqual(result.advanced, true);
        const entry = readGoal(repo).history[0];
        assert.strictEqual(entry.outcome, 'blocked');
        assert.strictEqual(entry.note, 'need a decision' + 'x'.repeat(105));
        assert.strictEqual(entry.note.length, 120);
    } finally {
        rmRepo(repo);
    }
});

test('advanceGoal on the last plan reports no advance and writes nothing', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/a.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/b.md', 'Status: In Progress\n');
        armGoal(repo, ['docs/plans/a.md', 'docs/plans/b.md']);
        advanceGoal(repo, { outcome: 'complete' });
        const before = fs.readFileSync(goalPath(repo), 'utf8');

        const result = advanceGoal(repo, { outcome: 'complete' });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.advanced, false, 'the last plan has nowhere to advance to');
        assert.strictEqual(result.finished, 'docs/plans/b.md');
        assert.strictEqual(fs.readFileSync(goalPath(repo), 'utf8'), before,
            'the caller releases the goal; the advance leaves the state as it was');
    } finally {
        rmRepo(repo);
    }
});

test('advanceGoal on a legacy single-plan state reports no advance without touching the file', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/solo.md', 'Status: In Progress\n');
        writeLegacyState(repo, 'docs/plans/solo.md', 'sess-1');
        const before = fs.readFileSync(goalPath(repo), 'utf8');

        const result = advanceGoal(repo, { outcome: 'complete' });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.advanced, false, 'a pre-queue state is a queue of one and releases as it always did');
        assert.strictEqual(result.finished, 'docs/plans/solo.md');
        assert.strictEqual(fs.readFileSync(goalPath(repo), 'utf8'), before);
    } finally {
        rmRepo(repo);
    }
});

test('advanceGoal refuses an unusable outcome, an unarmed repo, and a failed write', () => {
    const repo = makeRepo();
    try {
        assert.strictEqual(advanceGoal(repo, { outcome: 'complete' }).ok, false, 'nothing is armed');
        assert.ok(!fs.existsSync(goalPath(repo)));

        writePlan(repo, 'docs/plans/a.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/b.md', 'Status: In Progress\n');
        armGoal(repo, ['docs/plans/a.md', 'docs/plans/b.md']);
        assert.strictEqual(advanceGoal(repo, { outcome: 'finished' }).ok, false, 'an unknown outcome is refused');
        assert.strictEqual(advanceGoal(repo).ok, false, 'a missing outcome is refused');
        assert.strictEqual(readGoal(repo).plan, 'docs/plans/a.md', 'a refused advance leaves the leash where it was');

        // A directory occupying the deterministic in-process tmp path makes the
        // atomic write fail. The hook re-runs the same terminal clause at its
        // next stop, so a failed advance must report failure rather than pass
        // for a release.
        fs.mkdirSync(goalPath(repo) + '.tmp.' + process.pid, { recursive: true });
        const result = advanceGoal(repo, { outcome: 'complete' });
        assert.strictEqual(result.ok, false);
        assert.ok(result.reason.includes('could not write'));
        assert.strictEqual(readGoal(repo).plan, 'docs/plans/a.md', 'the leash stays on the finished plan for the retry');
    } finally {
        rmRepo(repo);
    }
});

test('bindSession records a usable transcript path and drops an unusable one without failing the bind', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/foo.md', 'Status: In Progress\n');
        armGoal(repo, 'docs/plans/foo.md');

        assert.strictEqual(bindSession(repo, 'sess-1', '/home/u/.claude/projects/p/t.jsonl').ok, true);
        assert.strictEqual(readGoal(repo).boundTranscript, '/home/u/.claude/projects/p/t.jsonl');

        // Binding the session is the load-bearing half: an absent, oversized, or
        // control-character-carrying transcript path never costs the leash. The
        // path travels with the binding, so it is cleared rather than left
        // pointing at the previous holder's transcript.
        for (const bad of [undefined, '', 'x'.repeat(513), '/tmp/a\nInjected.jsonl', 42]) {
            assert.strictEqual(bindSession(repo, 'sess-2', bad).ok, true, JSON.stringify(bad) + ' must not fail the bind');
            const state = readGoal(repo);
            assert.strictEqual(state.boundSession, 'sess-2');
            assert.strictEqual(state.boundTranscript, null);
        }
        assert.strictEqual(bindSession(repo, 'sess-3', 'x'.repeat(512)).ok, true, 'exactly the cap is accepted');
        assert.strictEqual(readGoal(repo).boundTranscript, 'x'.repeat(512));
    } finally {
        rmRepo(repo);
    }
});

test('composeCondition adds the queue context only while plans remain', () => {
    const queue = ['docs/plans/a.md', 'docs/plans/b.md', 'docs/plans/c.md'];
    const first = composeCondition('docs/plans/a.md', queue, 0);
    assert.ok(first.startsWith(composeCondition('docs/plans/a.md')), 'the solo text is the stem');
    assert.strictEqual(
        first.slice(composeCondition('docs/plans/a.md').length),
        ' This plan is 1 of 3 in an armed queue; still to come after it: '
        + 'docs/plans/b.md, docs/plans/c.md. Each plan runs to Complete or a recorded '
        + "'BLOCKED:' before the next begins, and the leash advances to the next "
        + 'plan on its own: no re-arming, and the run continues in this session.'
    );
    assert.match(composeCondition('docs/plans/b.md', queue, 1), /2 of 3.*docs\/plans\/c\.md/);
    // The last plan of a queue has nothing after it, so its condition is exactly
    // a solo arming's: what it promises is what the hook then does (release).
    assert.strictEqual(composeCondition('docs/plans/c.md', queue, 2), composeCondition('docs/plans/c.md'));
});

test('CLI arm accepts several plan paths and names the queue', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/a.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/b.md', 'Status: In Progress\n');

        const res = spawnSync(process.execPath, [CLI, 'arm', 'docs/plans/a.md', 'docs/plans/b.md'],
            { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /armed for docs\/plans\/a\.md \(1 of 2; then docs\/plans\/b\.md\)/);
        assert.deepStrictEqual(readGoal(repo).queue, ['docs/plans/a.md', 'docs/plans/b.md']);

        // One bad path refuses the whole arm at the CLI too, naming the offender
        // on stderr with a non-zero exit.
        const bad = spawnSync(process.execPath, [CLI, 'arm', 'docs/plans/a.md', 'docs/plans/gone.md'],
            { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(bad.status, 1);
        assert.match(bad.stderr, /not found: docs\/plans\/gone\.md/);

        const none = spawnSync(process.execPath, [CLI, 'arm'], { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(none.status, 1);
        assert.match(none.stderr, /usage: kit-goal\.js arm <planPath>\.\.\./);
    } finally {
        rmRepo(repo);
    }
});

test('CLI status renders the queue, the per-plan heads, the history, and the liveness hint', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/a.md', 'Status: In Progress\n');
        writePlan(repo, 'docs/plans/b.md', 'Status: Approved\n');
        armGoal(repo, ['docs/plans/a.md', 'docs/plans/b.md']);

        // Unbound, nothing finished yet: the current plan is marked and both
        // plans carry their own Status head.
        let res = spawnSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /armed for docs\/plans\/a\.md/);
        assert.match(res.stdout, /unbound/);
        assert.match(res.stdout, /queue: plan 1 of 2/);
        assert.match(res.stdout, /> docs\/plans\/a\.md \[in progress\]/);
        assert.match(res.stdout, /docs\/plans\/b\.md \[unknown\]/);
        assert.doesNotMatch(res.stdout, /finished:/, 'nothing has finished yet');

        // Bound, one plan finished: the binding names the session, the liveness
        // hint comes from the bound transcript's mtime, and the recorded outcome
        // is reported.
        const transcript = path.join(repo, 'transcript.jsonl');
        fs.writeFileSync(transcript, '{}\n', 'utf8');
        bindSession(repo, 'sess-42', transcript);
        advanceGoal(repo, { outcome: 'complete' });
        res = spawnSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /bound to session sess-42, last active under a minute ago/);
        assert.match(res.stdout, /queue: plan 2 of 2/);
        assert.match(res.stdout, /> docs\/plans\/b\.md \[unknown\]/);
        assert.match(res.stdout, /finished:\n {2}docs\/plans\/a\.md complete at /);

        // An unreadable transcript path costs the hint, not the report.
        fs.rmSync(transcript);
        res = spawnSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /bound to session sess-42\)/);
        assert.doesNotMatch(res.stdout, /last active/);
    } finally {
        rmRepo(repo);
    }
});

test('CLI status renders a legacy single-plan state as a queue of one', () => {
    const repo = makeRepo();
    try {
        writePlan(repo, 'docs/plans/solo.md', 'Status: In Progress\n');
        writeLegacyState(repo, 'docs/plans/solo.md', 'sess-9');
        const res = spawnSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /armed for docs\/plans\/solo\.md/);
        assert.match(res.stdout, /bound to session sess-9/);
        assert.match(res.stdout, /queue: plan 1 of 1/);
        assert.doesNotMatch(res.stdout, /last active/, 'a legacy state records no transcript, so there is no hint');
    } finally {
        rmRepo(repo);
    }
});

// Run a case with the event sink redirected into its own temp dir, restoring
// KIT_EVENTS_PATH and KIT_EVENTS_PATH_ALLOW (including their absence)
// afterward so one case cannot leak the redirect into the next, and cleaning
// the dir regardless of pass/fail. The allow signal rides alongside the path:
// without it the override is inert and every case below would fall back to
// (and append at) the real ~/.claude/kit-events.jsonl.
function withEventSink(fn) {
    const dir = makeRepo();
    const priorPath = process.env.KIT_EVENTS_PATH;
    const priorAllow = process.env.KIT_EVENTS_PATH_ALLOW;
    process.env.KIT_EVENTS_PATH = path.join(dir, 'kit-events.jsonl');
    process.env.KIT_EVENTS_PATH_ALLOW = '1';
    try {
        fn(process.env.KIT_EVENTS_PATH);
    } finally {
        if (priorPath === undefined) delete process.env.KIT_EVENTS_PATH;
        else process.env.KIT_EVENTS_PATH = priorPath;
        if (priorAllow === undefined) delete process.env.KIT_EVENTS_PATH_ALLOW;
        else process.env.KIT_EVENTS_PATH_ALLOW = priorAllow;
        rmRepo(dir);
    }
}

function readEventLines(sink) {
    return fs.readFileSync(sink, 'utf8').split('\n').filter((line) => line.trim() !== '');
}

test('emitGoalEvent appends one line per call carrying the documented schema', () => {
    withEventSink((sink) => {
        emitGoalEvent({
            event: 'goal-complete', project: 'D:/repo', plan: 'docs/plans/foo.md',
            session: 'sess-1', detail: 'plan-complete'
        });
        let lines = readEventLines(sink);
        assert.strictEqual(lines.length, 1, 'one call appends exactly one line');
        const complete = JSON.parse(lines[0]);
        assert.deepStrictEqual(Object.keys(complete), ['ts', 'event', 'project', 'plan', 'session', 'detail']);
        assert.strictEqual(complete.event, 'goal-complete');
        assert.strictEqual(complete.project, 'D:/repo');
        assert.strictEqual(complete.plan, 'docs/plans/foo.md');
        assert.strictEqual(complete.session, 'sess-1');
        assert.strictEqual(complete.detail, 'plan-complete');
        assert.match(complete.ts, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/, 'ts is an ISO 8601 instant');
        assert.ok(!Number.isNaN(Date.parse(complete.ts)));

        // No detail on a blocked event, and a caller with no session id records
        // null rather than dropping the key: the consumer reads a stable shape.
        emitGoalEvent({ event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' });
        lines = readEventLines(sink);
        assert.strictEqual(lines.length, 2, 'the second call appends rather than replacing');
        const blocked = JSON.parse(lines[1]);
        assert.deepStrictEqual(Object.keys(blocked), ['ts', 'event', 'project', 'plan', 'session']);
        assert.strictEqual(blocked.event, 'goal-blocked');
        assert.strictEqual(blocked.session, null);
    });
});

test('emitGoalEvent rotates only past 1 MB, and a rotation replaces the prior .old', () => {
    withEventSink((sink) => {
        const MB = 1024 * 1024;
        // Exactly 1 MB is not "exceeds 1 MB": the append lands in place, keeping
        // the boundary off the rotation side.
        const filler = 'a'.repeat(MB - 1) + '\n';
        fs.writeFileSync(sink, filler, 'utf8');
        assert.strictEqual(fs.statSync(sink).size, MB, 'setup: the sink sits exactly on the threshold');
        emitGoalEvent({ event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' });
        assert.ok(!fs.existsSync(sink + '.old'), 'a sink of exactly 1 MB is not rotated');
        const grown = fs.readFileSync(sink, 'utf8');
        assert.ok(grown.startsWith(filler), 'the existing content is kept');
        const appended = readEventLines(sink);
        assert.strictEqual(appended.length, 2, 'the event is appended below the existing content');
        assert.strictEqual(JSON.parse(appended[1]).event, 'goal-blocked');

        // The sink now exceeds 1 MB, so the next emit rotates it away and starts
        // fresh: the stream stays bounded instead of growing without limit.
        emitGoalEvent({ event: 'goal-complete', project: 'D:/repo', plan: 'docs/plans/foo.md', detail: 'plan-complete' });
        assert.ok(fs.existsSync(sink + '.old'), 'a sink past 1 MB is rotated');
        assert.strictEqual(fs.readFileSync(sink + '.old', 'utf8'), grown, 'the rotated file holds the prior stream');
        const fresh = readEventLines(sink);
        assert.strictEqual(fresh.length, 1, 'the fresh sink holds only the newest event');
        assert.strictEqual(JSON.parse(fresh[0]).detail, 'plan-complete');

        // A second rotation overwrites the previous .old rather than failing on
        // an occupied destination and losing the append.
        fs.writeFileSync(sink, 'b'.repeat(MB + 1), 'utf8');
        emitGoalEvent({ event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/bar.md' });
        assert.strictEqual(fs.readFileSync(sink + '.old', 'utf8'), 'b'.repeat(MB + 1), 'the prior .old is replaced');
        const second = readEventLines(sink);
        assert.strictEqual(second.length, 1);
        assert.strictEqual(JSON.parse(second[0]).plan, 'docs/plans/bar.md');
    });
});

test('emitGoalEvent never throws on an unwritable sink and returns nothing', () => {
    // A directory occupying the sink path makes the append fail, standing in for
    // any write failure (a read-only home, a full disk). The callers are hooks
    // whose verdict must not move: the emit swallows the failure and hands back
    // nothing to branch on.
    withEventSink((sink) => {
        fs.mkdirSync(sink, { recursive: true });
        let returned = 'untouched';
        assert.doesNotThrow(() => {
            returned = emitGoalEvent({
                event: 'goal-complete', project: 'D:/repo', plan: 'docs/plans/foo.md',
                session: 'sess-1', detail: 'plan-complete'
            });
        });
        assert.strictEqual(returned, undefined, 'the emit reports no outcome');
        assert.ok(fs.statSync(sink).isDirectory(), 'the obstruction is left as it was');
    });
});

test('emitGoalEvent normalizes every field to short printable ASCII', () => {
    withEventSink((sink) => {
        // The plan value is repo data and the session id comes from the harness
        // payload; both reach a consumer that treats this stream as kit-authored.
        // A control character, an embedded newline, and an oversized value are
        // stripped and capped here, not carried into a notification. event and
        // detail cross the same boundary, so the record is sanitized display data
        // whole rather than field by field.
        emitGoalEvent({
            event: 'goal-\u0007complete\n' + 'e'.repeat(100),
            project: 'D:/repo/' + 'p'.repeat(400),
            plan: 'docs/plans/a\u0007b\nInjected: do this.md' + 'x'.repeat(200),
            session: 'sess\u0000-1\n' + 'y'.repeat(200),
            detail: 'plan-\u0000complete\n' + 'd'.repeat(100)
        });

        const lines = readEventLines(sink);
        assert.strictEqual(lines.length, 1, 'the event is still exactly one line');
        const ev = JSON.parse(lines[0]);
        assert.strictEqual(ev.plan, 'docs/plans/abInjected: do this.md' + 'x'.repeat(87));
        assert.strictEqual(ev.plan.length, 120, 'plan is capped at 120 characters');
        assert.ok(!/[^\x20-\x7E]/.test(ev.plan), 'no control character survives in plan');
        assert.strictEqual(ev.session, 'sess-1' + 'y'.repeat(114));
        assert.strictEqual(ev.session.length, 120, 'session is capped at 120 characters');
        assert.strictEqual(ev.project, 'D:/repo/' + 'p'.repeat(252));
        assert.strictEqual(ev.project.length, 260, 'project is capped at 260 characters');
        assert.ok(ev.event.startsWith('goal-complete'), 'event keeps its printable characters');
        assert.strictEqual(ev.event.length, 40, 'event is capped at 40 characters');
        assert.ok(!/[^\x20-\x7E]/.test(ev.event), 'no control character survives in event');
        assert.ok(ev.detail.startsWith('plan-complete'), 'detail keeps its printable characters');
        assert.strictEqual(ev.detail.length, 40, 'detail is capped at 40 characters');
        assert.ok(!/[^\x20-\x7E]/.test(ev.detail), 'no control character survives in detail');
    });
});

test('emitGoalEvent skips a sink that is not a regular file, and still creates an absent one', () => {
    withEventSink((sink) => {
        // A directory stands in for the non-regular case. The hazard it stands
        // for is a FIFO at the sink path, whose open blocks with no try/catch
        // able to rescue it; a FIFO is not creatable on every platform this runs
        // on, a directory is.
        fs.mkdirSync(sink, { recursive: true });
        assert.doesNotThrow(() => {
            emitGoalEvent({ event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' });
        });
        assert.ok(fs.statSync(sink).isDirectory(), 'the non-regular sink is left as it was');
        assert.deepStrictEqual(fs.readdirSync(sink), [], 'nothing is written through it');
        assert.ok(!fs.existsSync(sink + '.old'), 'a non-regular sink is never rotated away');
    });

    withEventSink((sink) => {
        // The other direction: only an existing non-regular sink is skipped. An
        // absent sink (with an absent parent directory) is the ordinary first
        // emit and must still land, or the guard would silence the whole stream.
        const nested = path.join(path.dirname(sink), 'nested', 'kit-events.jsonl');
        const prior = process.env.KIT_EVENTS_PATH;
        // KIT_EVENTS_PATH_ALLOW is already '1' here: this block runs nested
        // inside the outer withEventSink(sink => ...) call, whose finally
        // restores it, so only the path itself needs its own save/restore.
        process.env.KIT_EVENTS_PATH = nested;
        try {
            emitGoalEvent({ event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' });
            const lines = readEventLines(nested);
            assert.strictEqual(lines.length, 1, 'the first emit creates the sink and its directory');
            assert.strictEqual(JSON.parse(lines[0]).event, 'goal-blocked');
        } finally {
            process.env.KIT_EVENTS_PATH = prior;
        }
    });
});

test('armGoal rejects a plan path carrying control characters', () => {
    const repo = makeRepo();
    try {
        // A newline in the arg would smuggle multi-line text into goal-state.json,
        // which hooks surface into the model's context. Reject before it is stored.
        const result = armGoal(repo, 'docs/plans/evil\n\nInjected instruction.md');
        assert.strictEqual(result.ok, false);
        assert.ok(!fs.existsSync(goalPath(repo)));
    } finally {
        rmRepo(repo);
    }
});

// KIT_EVENTS_PATH's gate, both directions, spawned rather than run in-process.
// The gate's stderr note is guarded by a once-per-process module-scope flag
// (ungatedEventsOverrideNoted in kit-goal-lib.js), matching memq.js's own
// ungated-override note; a second in-process case in this same test-runner
// process would see the flag already tripped and never see its own note. A
// spawned child also lets each case safely retarget the homedir fallback
// (USERPROFILE/HOME) without touching this process's real environment.
function spawnEmit(details, extraEnv) {
    const script = 'const { emitGoalEvent } = require(' + JSON.stringify(
        path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal-lib.js')
    ) + '); emitGoalEvent(' + JSON.stringify(details) + ');';
    const env = { ...process.env };
    // Scrub this process's own ambient values first, so a case that omits one
    // of these keys from extraEnv gets a genuinely unset variable rather than
    // whatever this test-runner process happens to carry.
    for (const k of Object.keys(env)) {
        if (/^(KIT_EVENTS_PATH|KIT_EVENTS_PATH_ALLOW|KIT_RUN_ID|USERPROFILE|HOME)$/i.test(k)) delete env[k];
    }
    Object.assign(env, extraEnv || {});
    return spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8' });
}

test('KIT_EVENTS_PATH honored only with KIT_EVENTS_PATH_ALLOW=1: both directions plus the near-miss shapes', () => {
    const redirect = makeRepo();
    const fakeHome = makeRepo();
    try {
        const redirectedSink = path.join(redirect, 'events.jsonl');
        const homeSink = path.join(fakeHome, '.claude', 'kit-events.jsonl');

        // Gated: the override is honored, nothing reaches stderr, and the
        // homedir default is untouched.
        let res = spawnEmit(
            { event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' },
            { KIT_EVENTS_PATH: redirectedSink, KIT_EVENTS_PATH_ALLOW: '1', USERPROFILE: fakeHome, HOME: fakeHome }
        );
        assert.strictEqual(res.status, 0, res.stderr);
        assert.doesNotMatch(res.stderr, /ignoring KIT_EVENTS_PATH/, 'a gated override emits no note');
        assert.ok(fs.existsSync(redirectedSink), 'the gated override is honored');
        assert.ok(!fs.existsSync(homeSink), 'the homedir default is untouched when the override is honored');

        // Ungated: the override is ignored loudly, and the event still lands at
        // the homedir default rather than silently vanishing or leaking through
        // to the requested path.
        fs.rmSync(redirect, { recursive: true, force: true });
        fs.mkdirSync(redirect, { recursive: true });
        res = spawnEmit(
            { event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' },
            { KIT_EVENTS_PATH: redirectedSink, USERPROFILE: fakeHome, HOME: fakeHome }
        );
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stderr, /ignoring KIT_EVENTS_PATH/, 'an ungated override notes it on stderr');
        assert.ok(!fs.existsSync(redirectedSink), 'an ungated override must not be honored');
        assert.ok(fs.existsSync(homeSink), 'the event still lands at the homedir default');
        fs.rmSync(homeSink);

        // The allow signal set to anything other than the literal '1' is the
        // same as unset, matching how the other kit gates treat their signal.
        res = spawnEmit(
            { event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' },
            { KIT_EVENTS_PATH: redirectedSink, KIT_EVENTS_PATH_ALLOW: 'true', USERPROFILE: fakeHome, HOME: fakeHome }
        );
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stderr, /ignoring KIT_EVENTS_PATH/);
        assert.ok(!fs.existsSync(redirectedSink), 'a non-"1" allow value must not honor the override');
        assert.ok(fs.existsSync(homeSink));
        fs.rmSync(homeSink);

        // The allow signal set with no path at all: nothing to honor, so no
        // note and no change from today's unset-override behavior.
        res = spawnEmit(
            { event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' },
            { KIT_EVENTS_PATH_ALLOW: '1', USERPROFILE: fakeHome, HOME: fakeHome }
        );
        assert.strictEqual(res.status, 0, res.stderr);
        assert.doesNotMatch(res.stderr, /ignoring KIT_EVENTS_PATH/, 'an allow signal with no path is inert, not a note');
        assert.ok(fs.existsSync(homeSink), 'the event lands at the homedir default as if nothing were set');
    } finally {
        rmRepo(redirect);
        rmRepo(fakeHome);
    }
});

test('emitGoalEvent adds a run field only for a KIT_RUN_ID that memq\'s isRunId itself would accept', () => {
    // run is gated on memq's own isRunId rather than on raw truthiness, so the
    // two producers that answer to a run id (this event stream, and memq's
    // pending-tier routing) cannot disagree about what one looks like. Every
    // case memq would refuse is pinned here as a refusal too: a value that is
    // truthy but carries no charset-legal id (Unicode, a control character), a
    // well-formed-looking value isRunId still refuses by name (a dots-only
    // name), and a value over memq's own 40-character cap.
    withEventSink((sink) => {
        const prior = process.env.KIT_RUN_ID;
        const setAndEmit = (value, detail) => {
            if (value === undefined) delete process.env.KIT_RUN_ID;
            else process.env.KIT_RUN_ID = value;
            emitGoalEvent(Object.assign({ event: 'goal-blocked', project: 'D:/repo', plan: 'docs/plans/foo.md' },
                detail ? { detail } : {}));
            const lines = readEventLines(sink);
            return JSON.parse(lines[lines.length - 1]);
        };
        const assertNoRun = (value, why) => {
            const ev = setAndEmit(value);
            assert.strictEqual(Object.keys(ev).includes('run'), false, why);
        };
        try {
            assertNoRun(undefined, 'no run key at all when KIT_RUN_ID is unset');
            // An empty string reads as unset, matching memq's isRunId (an
            // interpolation that resolved to nothing is not a run).
            assertNoRun('', 'an empty KIT_RUN_ID is treated as unset');
            // Truthy but no charset-legal run id survives: isRunId's grammar is
            // ASCII word characters, dot, and hyphen only, so this refuses
            // before eventField ever gets a chance to normalize it away and
            // ship run:"". This is the adversarial reviewer's own probe.
            assertNoRun('\u65e5\u672c', 'a value with no charset-legal id (here, non-ASCII) must not ship run:""');
            // A control character alone is the blind reviewer's version of the
            // same defect.
            assertNoRun('\u0007', 'a value that normalizes to nothing must not ship run:""');
            // Dots-only names are a path token or a name Win32 collapses, never
            // a run: isRunId refuses them by name even though '.' is inside
            // its own charset, so this is the "well-formed-looking" refusal.
            assertNoRun('..', 'a dots-only id looks well-formed but must still be refused, matching memq');
            // Over memq's RUN_ID_CAP: two distinct over-long ids must not alias
            // onto one run value in the stream, so this is refused outright
            // rather than truncated.
            assertNoRun('x'.repeat(41), 'an id past memq\'s 40-character cap must be refused, not truncated');

            const withRun = setAndEmit('r1', 'plan-complete');
            assert.deepStrictEqual(Object.keys(withRun), ['ts', 'event', 'project', 'plan', 'session', 'detail', 'run'],
                'run rides after detail, present exactly when KIT_RUN_ID names a well-formed id');
            assert.strictEqual(withRun.run, 'r1');

            // Exactly at memq's cap is still accepted (the cap is inclusive).
            const atCap = setAndEmit('x'.repeat(40));
            assert.strictEqual(atCap.run, 'x'.repeat(40), 'an id at exactly the 40-character cap is accepted');
        } finally {
            if (prior === undefined) delete process.env.KIT_RUN_ID;
            else process.env.KIT_RUN_ID = prior;
        }
    });
});
