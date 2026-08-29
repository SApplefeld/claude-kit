// Tests for the plan-recovery inventory in plugins/claude-kit/hooks/session-start.js.
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout. The subject here is which plans the inventory lists and under which
// block: an In Progress plan is listed with the resume directive that drives it
// to completion, and a Ready plan is listed as authored and parked with no such
// directive, because a parked plan is one nobody has started on purpose.
//
// Each case builds a fresh temp project and a fresh temp home directory, and
// the home redirect (USERPROFILE/HOME, what os.homedir() reads) is what keeps
// the sibling-session check off the real transcript store.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');
const { armGoal } = require(path.join(
    __dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal-lib.js'));

function makeProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-plans-test-'));
    fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'home'), { recursive: true });
    return dir;
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writePlan(dir, name, status) {
    fs.writeFileSync(path.join(dir, 'docs', 'plans', name),
        `# ${name}\n\nStatus: ${status}\nCommit Model: Commit-and-Push\n\n## Sections of Work\n`, 'utf8');
}

// Spawn the hook against a fixture project with a fixture home. process.env is
// spread rather than rebuilt so the child keeps its real PATH (a rebuilt env
// object loses the Windows `Path` key), and every casing of the home variables
// is dropped before the fixture pair is set, since Windows carries both.
function runHook(dir) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^(USERPROFILE|HOME|KIT_EXTERNAL_ENGINE)$/i.test(k)) delete env[k];
    }
    env.USERPROFILE = path.join(dir, 'home');
    env.HOME = path.join(dir, 'home');
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd: dir }),
        encoding: 'utf8',
        env
    });
}

// The context block the hook injected, or '' when it stayed silent.
function context(dir) {
    const res = runHook(dir);
    assert.strictEqual(res.status, 0, res.stderr);
    if (!res.stdout) return '';
    return JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
}

// One block out of the injected context, by its lead-in. Blocks are joined with
// a blank line, so a block runs to the next one. Returns '' when the block is
// absent, which is the answer an assertion about a block that should not have
// been emitted at all is making.
function block(text, lead) {
    const start = text.indexOf(lead);
    if (start === -1) return '';
    const end = text.indexOf('\n\n', start);
    return end === -1 ? text.slice(start) : text.slice(start, end);
}

const IN_PROGRESS_LEAD = 'in-progress plan doc(s)';
const READY_LEAD = 'Status: Ready';

test('an in-progress plan is listed with the resume directive', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'running_spec_v1.md', 'In Progress');
        const active = block(context(dir), IN_PROGRESS_LEAD);
        // The control for the absence assertions below: the same extraction,
        // over a fixture that does hold the plan, speaks. Without it, a block
        // helper that silently returned '' would pass every absence check here
        // for the wrong reason.
        assert.ok(active.includes('docs/plans/running_spec_v1.md'),
            'the in-progress block names an In Progress plan: ' + active);
        assert.match(active, /driving the remaining sections to completion/,
            'the in-progress block is the one carrying the resume directive');
    } finally { rmDir(dir); }
});

test('a Ready plan is listed as authored and parked, in its own block, with no resume directive', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'parked_spec_v1.md', 'Ready');
        const text = context(dir);
        const ready = block(text, READY_LEAD);
        assert.ok(ready.includes('docs/plans/parked_spec_v1.md'),
            'a Ready plan is visible to session start rather than invisible: ' + text);
        assert.match(ready, /authored and parked/);
        assert.match(ready, /Commit Model: Commit-and-Push/,
            'the parked line carries the same whitelisted commit model the active lines do');
        assert.doesNotMatch(ready, /driving the remaining sections to completion/,
            'a parked plan is not handed the resume directive');
        assert.doesNotMatch(ready, /Before doing ANY work/);

        // No conflation in either direction: the in-progress block is not
        // emitted at all for a Ready-only project, so the parked plan cannot
        // be counted as recoverable work.
        assert.strictEqual(block(text, IN_PROGRESS_LEAD), '',
            'a Ready plan does not raise the in-progress recovery block: ' + text);
    } finally { rmDir(dir); }
});

test('a Ready plan and an in-progress plan are listed under their own blocks only', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'parked_spec_v1.md', 'Ready');
        writePlan(dir, 'running_spec_v1.md', 'In Progress');
        const text = context(dir);
        const active = block(text, IN_PROGRESS_LEAD);
        const ready = block(text, READY_LEAD);

        assert.ok(active.includes('docs/plans/running_spec_v1.md'));
        assert.ok(!active.includes('docs/plans/parked_spec_v1.md'),
            'the parked plan does not ride in the block carrying the resume directive: ' + active);
        assert.ok(ready.includes('docs/plans/parked_spec_v1.md'));
        assert.ok(!ready.includes('docs/plans/running_spec_v1.md'),
            'the parked block names only parked plans: ' + ready);
    } finally { rmDir(dir); }
});

// The block asserts of every plan it lists that the plan is written and not
// started, so what may reach it is Ready as the whole value, with a
// parenthetical the only trailing text allowed. An English continuation like
// "Ready for review" names work somebody already did, and listing it as parked
// would be that assertion made falsely, in every session's context.
test('a parenthetical after Ready reads as parked and a continuation does not', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'parked_spec_v1.md', 'Ready (parked pending the design round)');
        const ready = block(context(dir), READY_LEAD);
        assert.ok(ready.includes('parked_spec_v1.md'),
            'a parenthetical does not change what the value names: ' + ready);
    } finally { rmDir(dir); }

    const other = makeProject();
    try {
        writePlan(other, 'reviewing_spec_v1.md', 'Ready for review');
        const text = context(other);
        assert.strictEqual(block(text, READY_LEAD), '',
            'a plan awaiting review is not a plan nobody has started: ' + text);
        assert.strictEqual(block(text, IN_PROGRESS_LEAD), '',
            'nor is it listed for resume: ' + text);
    } finally { rmDir(other); }
});

// Pin, not a red: the unarchived-Complete nag counts only plans reading
// complete, so a Ready plan never raises it. A parked plan sitting in
// docs/plans/ is where it belongs rather than a missed close-out.
test('the unarchived-Complete nag ignores a Ready plan', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'parked_spec_v1.md', 'Ready');
        const text = context(dir);
        assert.ok(!text.includes('unarchived'),
            'a Ready plan is not a Complete plan awaiting the archive: ' + text);

        // The control: the same phrase does appear for a plan that is complete
        // and still sitting in docs/plans/, so the absence above is a reading
        // of Ready rather than a nag that never fires.
        writePlan(dir, 'finished_spec_v1.md', 'Complete');
        assert.ok(context(dir).includes('unarchived'),
            'the nag fires on a Complete plan left in docs/plans/');
    } finally { rmDir(dir); }
});

// The armed-goal notice and the parked block ride in one payload, so a plan
// named by both carries two readings of its own state in a single context
// injection: the notice describes a plan held under the leash through the
// armed queue, and the parked block closes by telling the session that a
// parked plan starts when its operator says so. The queue is the authority on
// its own entries, so the parked block lists only plans the armed queue does
// not hold. An absent or unreadable goal state excludes nothing, which is the
// shape every case above runs under.
const ARMED_LEAD = 'A kit goal is armed for';

function arm(dir, names) {
    const rels = names.map((n) => 'docs/plans/' + n);
    assert.strictEqual(armGoal(dir, rels).ok, true, 'the fixture queue arms');
}

test('a Ready plan held in the armed queue is named by the armed-goal notice alone', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'running_spec_v1.md', 'In Progress');
        writePlan(dir, 'parked_spec_v1.md', 'Ready');
        arm(dir, ['running_spec_v1.md', 'parked_spec_v1.md']);
        const text = context(dir);

        // The control for the absence below: the notice is emitted and does
        // name the queued plan, so the missing parked block is the exclusion
        // speaking rather than a payload that came back empty.
        const armed = block(text, ARMED_LEAD);
        assert.ok(armed.includes('parked_spec_v1.md'),
            'the armed-goal notice names the queued plan: ' + text);
        assert.strictEqual(block(text, READY_LEAD), '',
            'a queued plan is not also listed under the parked block: ' + text);
    } finally { rmDir(dir); }
});

test('a Ready plan outside the armed queue is still listed as parked', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'running_spec_v1.md', 'In Progress');
        writePlan(dir, 'parked_spec_v1.md', 'Ready');
        arm(dir, ['running_spec_v1.md']);
        const text = context(dir);

        assert.notStrictEqual(block(text, ARMED_LEAD), '',
            'the armed-goal notice is emitted: ' + text);
        const ready = block(text, READY_LEAD);
        assert.ok(ready.includes('parked_spec_v1.md'),
            'a plan no queue holds keeps its parked line: ' + text);
    } finally { rmDir(dir); }
});

test('the parked block lists the unqueued Ready plan and not the queued one', () => {
    const dir = makeProject();
    try {
        writePlan(dir, 'running_spec_v1.md', 'In Progress');
        writePlan(dir, 'queued_spec_v1.md', 'Ready');
        writePlan(dir, 'loose_spec_v1.md', 'Ready');
        arm(dir, ['running_spec_v1.md', 'queued_spec_v1.md']);
        const ready = block(context(dir), READY_LEAD);

        assert.ok(ready.includes('loose_spec_v1.md'),
            'the unqueued parked plan is listed: ' + ready);
        assert.ok(!ready.includes('queued_spec_v1.md'),
            'the queued parked plan is not: ' + ready);
    } finally { rmDir(dir); }
});
