// Tests for the goal family's worktree resolution: goalPath in
// plugins/claude-kit/hooks/kit-goal-lib.js resolves a linked git worktree's
// .kit/goal-state.json to the main checkout the worktree hangs off, so a
// session working in a worktree shares the main checkout's leash instead of
// minting a second one. The checkpoint CLI and the PreCompact gate inherit
// the resolution through the lib, and the resolver is pinned against memq.js's
// worktreeMainRoot over shared fixtures, because the two are deliberately
// separate spellings of one handshake (the hooks must not load the CLI's
// module) and a shared test is what keeps them from drifting apart.
//
// Node's built-in test runner, no framework (Node v24). Worktree fixtures are
// synthesized (a .git pointer file plus the administrative pair git maintains)
// so a test can bend one joint at a time, mirroring the memq suite's builder;
// the acceptance case that runs `git worktree add` for real is skipped where
// no git binary is on PATH, and everything it proves structurally is also
// pinned by the synthesized cases. Every assertion about a resolution stderr
// note is made on a child process, because the once-per-process note flags
// live at the lib's module scope and an in-process resolution would both
// spend them and write into the runner's own stderr. No two fixture names
// differ only by case: NTFS collapses those into one file.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LIB = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal-lib.js');
const GOAL_CLI = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal.js');
const CHECKPOINT_CLI = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-compact-checkpoint.js');
const GATE = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-compact-gate.js');
const STOP_HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal-stop.js');

const {
    goalPath, readGoal, armGoal, bindSession, clearGoal, planDisplayRoot, recordExecutionTree
} = require('../plugins/claude-kit/hooks/kit-goal-lib.js');
const {
    checkpointPath, writeCheckpoint, recordEpisodeNudge
} = require('../plugins/claude-kit/hooks/kit-compact-lib.js');
const memq = require('../plugins/claude-kit/scripts/memq.js');

// The session id fixtures bind the goal to; gate payloads default to it so the
// leash-holder path is the baseline, matching the gate suite's own fixtures.
const SESSION = 'ses-11112222-aaaa-bbbb-cccc-333344445555';

// The two deny notes, duplicated from the gate as pins: which note fires is
// what tells a boundary deny (the leash holder's own gate) from an interactive
// one (a session no goal covers), and the guard cases below turn on exactly
// that difference.
const DENY_NOTE = 'kit-compact-gate: auto-compaction deferred to the next chapter close or interim board entry';
const INTERACTIVE_NOTE = 'kit-compact-gate: auto-compaction deferred to the context safety ceiling';

// Worktree fixtures are built under the canonical spelling of the temp root
// rather than under os.tmpdir() directly. This machine's TEMP is an 8.3 short
// path, and an accepted main root is folded to the volume's own spelling on
// win32, so fixtures built from the short form would resolve to a path no
// assertion here could write down twice.
const WORKTREE_TMP = process.platform === 'win32'
    ? fs.realpathSync.native(os.tmpdir())
    : os.tmpdir();

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeFile(full, contents) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, 'utf8');
}

// A main checkout plus a worktree wired to it, mirroring the memq suite's
// builder because the two resolvers read the same on-disk shape. Options bend
// one joint each: `name` is the worktrees/<name> segment, `kind` the directory
// under `.git` (`modules` is the submodule shape), `pointer` the path written
// into the worktree's `.git` file with `relative` writing that same target as
// a forward-slash relative path instead, `backPointer` the content of the
// back-pointer file with null leaving that file absent, and `commondir: null`
// leaving out the file git keeps beside every worktree's administrative
// directory.
function makeWorktree(options) {
    const opts = options || {};
    const main = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-main-'));
    const tree = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-tree-'));
    const gitdir = path.join(main, '.git', opts.kind || 'worktrees', opts.name || 'wt');
    fs.mkdirSync(gitdir, { recursive: true });
    if (opts.commondir !== null) {
        fs.writeFileSync(path.join(gitdir, 'commondir'), '../..\n', 'utf8');
    }
    if (opts.backPointer !== null) {
        const back = opts.backPointer === undefined ? path.join(tree, '.git') : opts.backPointer;
        fs.writeFileSync(path.join(gitdir, 'gitdir'), back + '\n', 'utf8');
    }
    const pointer = opts.relative
        ? path.relative(tree, gitdir).split(path.sep).join('/')
        : (opts.pointer === undefined ? gitdir : opts.pointer);
    fs.writeFileSync(path.join(tree, '.git'), 'gitdir: ' + pointer + '\n', 'utf8');
    return { main, tree, gitdir, pointer };
}

function rmWorktree(w) {
    rmDir(w.main);
    rmDir(w.tree);
}

// A bare repository's worktree: the gitdir names <bare>/repo.git/worktrees/wt,
// so the segment above `worktrees` is not a `.git` directory and the shape
// check refuses it. There is no main checkout to resolve to, which is exactly
// what the refusal says.
function makeBareWorktree() {
    const bare = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-bare-'));
    const tree = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-baretree-'));
    const gitdir = path.join(bare, 'repo.git', 'worktrees', 'wt');
    fs.mkdirSync(gitdir, { recursive: true });
    fs.writeFileSync(path.join(gitdir, 'commondir'), '../..\n', 'utf8');
    fs.writeFileSync(path.join(gitdir, 'gitdir'), path.join(tree, '.git') + '\n', 'utf8');
    fs.writeFileSync(path.join(tree, '.git'), 'gitdir: ' + gitdir + '\n', 'utf8');
    return { bare, tree, gitdir };
}

// The root the goal family resolved for a working directory, read back out of
// goalPath's answer rather than through a dedicated export: <root>/.kit/
// goal-state.json is the whole contract, so the path is the observable.
function goalRootOf(cwd) {
    return path.dirname(path.dirname(goalPath(cwd)));
}

// Drop the external-engine and caller-session variables from a child's
// environment, for the gate suite's reasons: this suite runs inside fleet
// workers and live sessions, where both are ambient and would flip verdicts.
function childEnv(extra) {
    const env = { ...process.env, ...(extra || {}) };
    for (const k of Object.keys(env)) {
        if (/^KIT_EXTERNAL_ENGINE$/i.test(k) || /^CLAUDE_CODE_SESSION_ID$/i.test(k)) delete env[k];
    }
    return env;
}

// Two module-level resolutions in one child, so a once-per-process note can be
// counted and the second answer compared against the first.
const TWICE_PROBE = 'const lib = require(process.argv[1]);'
    + 'console.log("A " + lib.goalPath(process.cwd()));'
    + 'console.log("B " + lib.goalPath(process.cwd()));';

function probeTwice(cwd) {
    return spawnSync(process.execPath, ['-e', TWICE_PROBE, LIB], {
        cwd, encoding: 'utf8', env: childEnv()
    });
}

function probeLines(probe) {
    return probe.stdout.split('\n').filter((l) => l !== '');
}

function ownGoalPath(cwd) {
    return path.join(cwd, '.kit', 'goal-state.json');
}

function runGoalCli(args, cwd) {
    return spawnSync(process.execPath, [GOAL_CLI, ...args], { cwd, encoding: 'utf8', env: childEnv() });
}

function runCheckpointCli(args, cwd) {
    return spawnSync(process.execPath, [CHECKPOINT_CLI, ...args], { cwd, encoding: 'utf8', env: childEnv() });
}

function runGate(payload) {
    return spawnSync(process.execPath, [GATE], {
        input: JSON.stringify(payload), encoding: 'utf8', env: childEnv()
    });
}

// A PreCompact payload in the live shape, defaulting to the leash holder's own
// below-ceiling state against the given fixtures.
function gatePayload(cwd, transcript) {
    return {
        session_id: SESSION,
        transcript_path: transcript,
        cwd,
        prompt_id: 'prompt-1',
        hook_event_name: 'PreCompact',
        trigger: 'auto',
        custom_instructions: null
    };
}

// A JSONL transcript whose newest main-thread assistant row sums to a
// below-ceiling token count, the gate suite's own fixture shape.
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
        JSON.stringify({ type: 'system', subtype: 'turn-metadata' })
    ];
    writeFile(full, lines.join('\n') + '\n');
}

const PLAN_REL = 'docs/plans/example.md';

function writePlanDoc(root) {
    writeFile(path.join(root, PLAN_REL), 'Status: In Progress\n\nbody\n');
}

// A Stop-hook transcript: the arming user line (the plan path inside a
// <command-args> span, which is what claims an unbound goal for the stopping
// session) followed by the given assistant turns, matching the stop suite's
// own fixture shape.
function writeStopTranscript(full, planRel, assistantTexts) {
    const lines = [JSON.stringify({
        type: 'user',
        message: {
            role: 'user',
            content: '<command-name>/kit-goal</command-name>\n'
                + '<command-message>kit-goal</command-message>\n'
                + '<command-args>' + planRel + '</command-args>'
        }
    })];
    for (const t of assistantTexts) {
        lines.push(JSON.stringify({
            type: 'assistant',
            message: { role: 'assistant', content: [{ type: 'text', text: t }] }
        }));
    }
    writeFile(full, lines.join('\n') + '\n');
}

// Run the goal-leash Stop hook against a cwd as the bound session, with
// clause-(b) retries off and the goal-event sink pinned inside the caller's
// temp root so no release a case fires appends to the real
// ~/.claude/kit-events.jsonl. The fixtures bind the goal to SESSION at arm
// time, because a queue that advances needs the binding to outlive the first
// plan: the transcript's arming claim names only the plan it armed.
function runStopHook(cwd, transcript, eventsRoot) {
    return spawnSync(process.execPath, [STOP_HOOK], {
        input: JSON.stringify({ cwd, transcript_path: transcript, session_id: SESSION }),
        encoding: 'utf8',
        env: childEnv({
            KIT_GOAL_STOP_RETRY_MS: '0',
            KIT_EVENTS_PATH: path.join(eventsRoot, 'events.jsonl'),
            KIT_EVENTS_PATH_ALLOW: '1'
        })
    });
}

function readStopEvents(eventsRoot) {
    const sink = path.join(eventsRoot, 'events.jsonl');
    if (!fs.existsSync(sink)) return [];
    return fs.readFileSync(sink, 'utf8').split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line));
}

// ---------------------------------------------------------------------------
// Resolution: reads and writes from a worktree land on the main checkout.
// ---------------------------------------------------------------------------

test('a worktree whose back-pointer handshake holds reads the main checkout\'s goal state', () => {
    const w = makeWorktree();
    try {
        assert.strictEqual(goalPath(w.tree), ownGoalPath(w.main),
            'goal state resolves to the main checkout\'s .kit');
        writePlanDoc(w.main);
        const armed = armGoal(w.main, PLAN_REL);
        assert.strictEqual(armed.ok, true, 'setup: goal should arm in the main checkout');
        const seen = readGoal(w.tree);
        assert.ok(seen && seen.plan === PLAN_REL,
            'the worktree reads the goal armed in the main checkout');
    } finally {
        rmWorktree(w);
    }
});

test('goal-state writes from a worktree land in the main checkout\'s .kit, and a clear releases there', () => {
    const w = makeWorktree();
    try {
        // The plan doc lives on the execution tree's branch, so validation
        // reads it under the worktree; only the state file moves.
        writePlanDoc(w.tree);
        const armed = armGoal(w.tree, PLAN_REL);
        assert.strictEqual(armed.ok, true, 'arming from the worktree succeeds: ' + JSON.stringify(armed));
        assert.ok(fs.existsSync(ownGoalPath(w.main)),
            'the state file lands in the main checkout\'s .kit');
        assert.ok(!fs.existsSync(ownGoalPath(w.tree)),
            'no second .kit/goal-state.json is minted under the worktree');
        const bound = bindSession(w.tree, SESSION);
        assert.strictEqual(bound.ok, true, 'binding from the worktree succeeds');
        const seen = readGoal(w.main);
        assert.ok(seen && seen.boundSession === SESSION,
            'the main checkout reads the binding the worktree wrote');
        const cleared = clearGoal(w.tree);
        assert.deepStrictEqual({ ok: cleared.ok, cleared: cleared.cleared }, { ok: true, cleared: true });
        assert.ok(!fs.existsSync(ownGoalPath(w.main)), 'the clear released the main checkout\'s file');
    } finally {
        rmWorktree(w);
    }
});

test('a relative gitdir: pointer resolves against the worktree directory', () => {
    // The pointer is written relative and with forward slashes, the way git
    // spells its own paths on Windows too.
    const w = makeWorktree({ relative: true });
    try {
        assert.ok(!path.isAbsolute(w.pointer), 'the fixture must exercise the relative form: ' + w.pointer);
        assert.strictEqual(goalPath(w.tree), ownGoalPath(w.main));
    } finally {
        rmWorktree(w);
    }
});

test('the resolver holds one answer per working directory for the life of the process', () => {
    const w = makeWorktree();
    try {
        const first = goalPath(w.tree);
        assert.strictEqual(first, ownGoalPath(w.main));
        // Memoized because every goal read and write resolves the root: one
        // stat-and-read per working directory, not one per call.
        fs.rmSync(path.join(w.gitdir, 'gitdir'));
        assert.strictEqual(goalPath(w.tree), first);
        assert.strictEqual(goalPath(w.tree), first);
    } finally {
        rmWorktree(w);
    }
});

// ---------------------------------------------------------------------------
// Fallback: every failed or foreign shape keeps the working directory, and
// only a worktree-shaped pointer whose handshake does not close says so.
// ---------------------------------------------------------------------------

test('a worktree pointer with no back-pointer file falls back to the cwd, noting it once', () => {
    const w = makeWorktree({ backPointer: null });
    try {
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.tree), 'B ' + ownGoalPath(w.tree)],
            'both resolutions land on the working directory\'s own .kit');
        assert.match(probe.stderr, /back-pointer/);
        assert.match(probe.stderr, /git worktree repair/);
        assert.strictEqual(probe.stderr.split('kit-goal: ').length - 1, 1,
            'the note is written once per process, not once per call: ' + probe.stderr);
    } finally {
        rmWorktree(w);
    }
});

test('a back-pointer naming a different worktree falls back to the cwd derivation', () => {
    const other = makeWorktree({ name: 'other' });
    const w = makeWorktree({ backPointer: path.join(other.tree, '.git') });
    try {
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.tree), 'B ' + ownGoalPath(w.tree)]);
        assert.match(probe.stderr, /back-pointer/);
    } finally {
        rmWorktree(w);
        rmWorktree(other);
    }
});

test('a worktree administrative directory without commondir fails the handshake', () => {
    const w = makeWorktree({ commondir: null });
    try {
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.tree), 'B ' + ownGoalPath(w.tree)]);
        assert.match(probe.stderr, /back-pointer/);
    } finally {
        rmWorktree(w);
    }
});

test('an ordinary checkout, .git a directory, keeps the cwd derivation in silence', () => {
    const main = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-plain-'));
    try {
        // A main checkout that HAS worktrees carries .git/worktrees/<name>
        // itself; it must resolve as itself, not as anyone's worktree.
        fs.mkdirSync(path.join(main, '.git', 'worktrees', 'wt'), { recursive: true });
        const probe = probeTwice(main);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.strictEqual(probe.stderr, '');
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(main), 'B ' + ownGoalPath(main)]);
    } finally {
        rmDir(main);
    }
});

test('a submodule-shaped gitdir keeps the cwd derivation with nothing on stderr', () => {
    const w = makeWorktree({ kind: 'modules', name: 'sub' });
    try {
        // A submodule is an ordinary checkout as far as goal state is
        // concerned, so the fallback is its expected state and a note would be
        // noise on every submodule session.
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.strictEqual(probe.stderr, '');
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.tree), 'B ' + ownGoalPath(w.tree)]);
    } finally {
        rmWorktree(w);
    }
});

test('a .git file that is not a pointer at all keeps the cwd derivation in silence', () => {
    const w = makeWorktree();
    try {
        // A gitdir: line anywhere but the start of the file is that file's
        // content, not a pointer, and an ordinary file where .git happens to
        // sit is a shape nobody needs to hear about.
        fs.writeFileSync(path.join(w.tree, '.git'),
            'notes to self\ngitdir: ' + w.gitdir + '\n', 'utf8');
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.strictEqual(probe.stderr, '');
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.tree), 'B ' + ownGoalPath(w.tree)]);
    } finally {
        rmWorktree(w);
    }
});

test('a .git file far larger than the read cap is read as its first bytes only', () => {
    const w = makeWorktree();
    try {
        // Leading blanks are the one padding the pointer grammar tolerates, so
        // this file is a pointer in every respect except that its gitdir word
        // begins past the read cap: capped, the read never reaches the word.
        fs.writeFileSync(path.join(w.tree, '.git'),
            ' '.repeat(65536) + 'gitdir: ' + w.gitdir + '\n', 'utf8');
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.strictEqual(probe.stderr, '');
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.tree), 'B ' + ownGoalPath(w.tree)]);
    } finally {
        rmWorktree(w);
    }
});

test('a UNC-shaped pointer is refused with no note, keeping the cwd derivation', {
    skip: process.platform === 'win32' ? false : 'UNC paths are a win32 shape'
}, () => {
    const w = makeWorktree({ pointer: '//evil.invalid/share/.git/worktrees/w' });
    try {
        // Opening anything under \\host\share is an outbound SMB connect that
        // authenticates as the logged-in account, so the resolver refuses the
        // shape on the path text alone. This case pins the observable result
        // and its silence; it cannot pin WHERE the refusal happens, because a
        // host that does not resolve answers the same null from the
        // filesystem, so the positional case below is the regression pin on
        // the screen itself.
        assert.strictEqual(goalPath(w.tree), ownGoalPath(w.tree));
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.strictEqual(probe.stderr, '');
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.tree), 'B ' + ownGoalPath(w.tree)]);
    } finally {
        rmWorktree(w);
    }
});

test('the network-shape screen runs before the first filesystem touch at the pointer target', {
    skip: process.platform === 'win32' ? false : 'UNC and device paths are a win32 shape'
}, () => {
    // The discriminating fixture: the far half genuinely exists under an
    // ordinary local path and its handshake would close, but the pointer
    // spells it through the \\?\ device namespace, whose root starts with two
    // separators exactly as a UNC path's does, so it takes the same screen. A
    // resolver that judges the shape before touching the filesystem refuses
    // it; one that touched the target first would find a real, closing
    // handshake and resolve to the main checkout. So this test fails exactly
    // when the screen stops running ahead of the first filesystem call at the
    // target, which is the property the UNC refusal exists for: for a real
    // \\host\share pointer, the touch is itself the credential-leaking harm.
    const w = makeWorktree({ name: 'dev' });
    try {
        const devGitdir = '\\\\?\\' + w.gitdir;
        assert.ok(fs.statSync(devGitdir).isDirectory(),
            'fixture: the far half is reachable through the exact device spelling the pointer uses');
        fs.writeFileSync(path.join(w.tree, '.git'), 'gitdir: ' + devGitdir + '\n', 'utf8');
        assert.strictEqual(goalPath(w.tree), ownGoalPath(w.tree),
            'the device spelling is refused before the reachable target is ever touched');
    } finally {
        rmWorktree(w);
    }
});

test('a goal-state file left under the worktree itself earns one note when resolution holds', () => {
    const w = makeWorktree();
    try {
        // A leash armed from this worktree before the resolution existed is no
        // longer read, and a file that quietly stops being consulted is the
        // kind of loss noticed months later; the note is what makes it loud.
        writeFile(ownGoalPath(w.tree), '{}\n');
        const probe = probeTwice(w.tree);
        assert.strictEqual(probe.status, 0, probe.stderr);
        assert.deepStrictEqual(probeLines(probe),
            ['A ' + ownGoalPath(w.main), 'B ' + ownGoalPath(w.main)],
            'resolution itself is unmoved by the orphan');
        assert.match(probe.stderr, /no longer read/);
        assert.strictEqual(probe.stderr.split('kit-goal: ').length - 1, 1,
            'the note is written once per process: ' + probe.stderr);
    } finally {
        rmWorktree(w);
    }
});

// ---------------------------------------------------------------------------
// The cross-implementation pin: this resolver and memq's worktreeMainRoot are
// two spellings of one handshake, coupled here over shared fixtures because a
// shared import is the wrong coupling (the hooks must not load the CLI's
// module). A change that moves one and not the other fails this test.
// ---------------------------------------------------------------------------

test('the goal family and memq resolve one root over shared fixtures (the drift pin)', () => {
    const plain = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-pin-plain-'));
    fs.mkdirSync(path.join(plain, '.git'), { recursive: true });
    const held = makeWorktree({ name: 'pin' });
    const bare = makeBareWorktree();
    const sub = makeWorktree({ kind: 'modules', name: 'pinsub' });
    // The refused shapes are pinned beside the benign ones, because the guards
    // are where the two spellings can drift while every ordinary fixture stays
    // green: a start-anchored pointer grammar, the pointer read cap, the
    // pointer path cap, and (on win32) the network-shape screen each exist in
    // both implementations, and a change that moves one of them in one file
    // and not the other must fail here.
    const notPointer = makeWorktree({ name: 'pinnp' });
    fs.writeFileSync(path.join(notPointer.tree, '.git'),
        'notes to self\ngitdir: ' + notPointer.gitdir + '\n', 'utf8');
    const overReadCap = makeWorktree({ name: 'pinrc' });
    fs.writeFileSync(path.join(overReadCap.tree, '.git'),
        ' '.repeat(65536) + 'gitdir: ' + overReadCap.gitdir + '\n', 'utf8');
    const overPathCap = makeWorktree({
        name: 'pinpc',
        pointer: path.join(WORKTREE_TMP, 'p'.repeat(2100), '.git', 'worktrees', 'wt')
    });
    const unc = process.platform === 'win32'
        ? makeWorktree({ pointer: '//evil.invalid/share/.git/worktrees/w' })
        : null;
    try {
        // The worktree case pins the resolved value itself, not only the
        // agreement: two resolvers broken the same silent way would still
        // agree with each other.
        assert.strictEqual(memq.worktreeMainRoot(held.tree), held.main);
        const rows = [
            ['ordinary checkout', plain],
            ['worktree whose handshake holds', held.tree],
            ['bare-repo worktree', bare.tree],
            ['submodule', sub.tree],
            ['non-pointer .git file', notPointer.tree],
            ['pointer past the read cap', overReadCap.tree],
            ['pointer past the path cap', overPathCap.tree]
        ];
        if (unc) rows.push(['UNC-spelled pointer', unc.tree]);
        for (const [label, cwd] of rows) {
            const memqMain = memq.worktreeMainRoot(cwd);
            const expected = memqMain === null ? cwd : memqMain;
            assert.strictEqual(goalRootOf(cwd), expected,
                'the two implementations disagree over the ' + label + ' fixture');
        }
        // The refusals are pinned affirmatively too: agreement alone would
        // also pass if both implementations resolved a refused shape.
        for (const [label, cwd] of rows.slice(2)) {
            assert.strictEqual(memq.worktreeMainRoot(cwd), null,
                'the ' + label + ' fixture must resolve to no main checkout');
        }
    } finally {
        rmDir(plain);
        rmWorktree(held);
        rmDir(bare.bare);
        rmDir(bare.tree);
        rmWorktree(sub);
        rmWorktree(notPointer);
        rmWorktree(overReadCap);
        rmWorktree(overPathCap);
        if (unc) rmWorktree(unc);
    }
});

// ---------------------------------------------------------------------------
// The consumers: the checkpoint CLI and the gate inherit the resolution, and
// the gate's matching semantics do not widen with it.
// ---------------------------------------------------------------------------

// Whether a real git binary is on PATH. The acceptance case runs `git worktree
// add` for real so the fixture is git's own wiring rather than this suite's
// reading of it; on a machine with no git the synthesized cases still pin the
// shape, and the skip is visible in the runner's output rather than silent.
const GIT_ON_PATH = (() => {
    try { return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0; } catch { return false; }
})();

function git(args, cwd) {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

test('acceptance: a real `git worktree add` worktree shares the main checkout\'s leash', {
    skip: GIT_ON_PATH ? false : 'git is not on PATH'
}, () => {
    const main = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-real-main-'));
    const treeParent = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-real-tree-'));
    const tree = path.join(treeParent, 'wt');
    try {
        assert.strictEqual(git(['init', '-q'], main).status, 0, 'setup: git init');
        writePlanDoc(main);
        assert.strictEqual(git(['add', '.'], main).status, 0, 'setup: git add');
        const committed = git(['-c', 'user.email=kit@test.invalid', '-c', 'user.name=kit',
            'commit', '-q', '-m', 'plan'], main);
        assert.strictEqual(committed.status, 0, 'setup: git commit: ' + committed.stderr);
        const added = git(['worktree', 'add', '--detach', '-q', tree], main);
        assert.strictEqual(added.status, 0, 'setup: git worktree add: ' + added.stderr);

        const armed = armGoal(main, PLAN_REL);
        assert.strictEqual(armed.ok, true, 'setup: goal should arm in the main checkout');

        // Acceptance 1: checkpoint open succeeds from inside the worktree.
        const opened = runCheckpointCli(['open'], tree);
        assert.strictEqual(opened.status, 0, 'open succeeds from the worktree; stderr: ' + opened.stderr);
        assert.ok(opened.stdout.includes(PLAN_REL), 'output names the plan: ' + opened.stdout);
        const cp = JSON.parse(fs.readFileSync(checkpointPath(tree), 'utf8'));
        assert.strictEqual(cp.plan, PLAN_REL, 'the checkpoint records the armed plan');

        // Acceptance 2: status reports the same armed goal from both trees.
        for (const cwd of [main, tree]) {
            const res = runGoalCli(['status'], cwd);
            assert.strictEqual(res.status, 0, 'status succeeds in ' + cwd + '; stderr: ' + res.stderr);
            assert.ok(res.stdout.includes('kit goal armed for ' + PLAN_REL),
                'status reports the armed goal from ' + cwd + ': ' + res.stdout);
        }

        // Acceptance 3: state writes from the worktree land in the main
        // checkout's .kit, not a new one under the worktree.
        const bound = bindSession(tree, SESSION);
        assert.strictEqual(bound.ok, true, 'binding from the worktree succeeds');
        const seen = readGoal(main);
        assert.ok(seen && seen.boundSession === SESSION,
            'the main checkout reads the binding the worktree wrote');
        assert.ok(!fs.existsSync(ownGoalPath(tree)),
            'no goal-state file is minted under the worktree');
    } finally {
        rmDir(main);
        rmDir(treeParent);
    }
});

test('a bare-repo worktree still refuses checkpoint open with the self-explaining lines', () => {
    const b = makeBareWorktree();
    try {
        const res = runCheckpointCli(['open'], b.tree);
        assert.strictEqual(res.status, 1, 'open refuses; stdout: ' + res.stdout);
        assert.ok(res.stderr.includes('no kit goal is armed'), 'refusal states the reason: ' + res.stderr);
        assert.ok(res.stderr.includes('another checkout'), 'the hint names the other-checkout case: ' + res.stderr);
        assert.ok(res.stderr.includes('arm where you run'), 'and says what to do about it: ' + res.stderr);
        assert.ok(!fs.existsSync(checkpointPath(b.tree)), 'nothing written');
    } finally {
        rmDir(b.bare);
        rmDir(b.tree);
    }
});

test('gate: the leash reaches a worktree session, and matching semantics do not widen with it', () => {
    const w = makeWorktree();
    try {
        writePlanDoc(w.main);
        writePlanDoc(w.tree);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(bindSession(w.main, SESSION).ok, true, 'setup: bind the leash holder');
        const transcript = path.join(w.tree, 'transcript.jsonl');
        writeUsageTranscript(transcript, 50000);

        // The leash holder compacting in the worktree with no checkpoint takes
        // the boundary deny, not the interactive one: the gate found the main
        // checkout's armed goal from the worktree cwd.
        const noCp = runGate(gatePayload(w.tree, transcript));
        assert.strictEqual(noCp.status, 2, 'deny with no checkpoint; stderr: ' + noCp.stderr);
        assert.ok(noCp.stderr.includes(DENY_NOTE), 'the boundary note fires: ' + noCp.stderr);
        assert.ok(!noCp.stderr.includes(INTERACTIVE_NOTE), 'not the interactive one: ' + noCp.stderr);

        // A matching checkpoint in the worktree's own .kit releases it: this
        // is the control that proves the two deny cases below fail on the
        // mismatch and not on state the gate never found.
        assert.strictEqual(writeCheckpoint(w.tree, PLAN_REL, SESSION).ok, true, 'setup: checkpoint');
        const matched = runGate(gatePayload(w.tree, transcript));
        assert.strictEqual(matched.status, 0, 'matching checkpoint allows; stderr: ' + matched.stderr);
        assert.ok(!fs.existsSync(checkpointPath(w.tree)), 'the allow consumed the checkpoint');

        // Guard direction: where state is found changed; what matches did not.
        assert.strictEqual(writeCheckpoint(w.tree, 'docs/plans/some-prior-run.md', SESSION).ok, true);
        const wrongPlan = runGate(gatePayload(w.tree, transcript));
        assert.strictEqual(wrongPlan.status, 2, 'a checkpoint for another plan still denies');
        assert.ok(wrongPlan.stderr.includes(DENY_NOTE), 'as a boundary deny: ' + wrongPlan.stderr);
        assert.ok(fs.existsSync(checkpointPath(w.tree)), 'and is not consumed');
        fs.rmSync(checkpointPath(w.tree));

        assert.strictEqual(writeCheckpoint(w.tree, PLAN_REL, 'ses-99998888-aaaa-bbbb-cccc-000011112222').ok, true);
        const wrongSession = runGate(gatePayload(w.tree, transcript));
        assert.strictEqual(wrongSession.status, 2, 'a checkpoint for another session still denies');
        assert.ok(wrongSession.stderr.includes(DENY_NOTE), 'as a boundary deny: ' + wrongSession.stderr);
        assert.ok(fs.existsSync(checkpointPath(w.tree)), 'and is not consumed');
    } finally {
        rmWorktree(w);
    }
});

test('gate: a worktree with no local .kit still gets its decision record and its nudge stamp', () => {
    // The deferral record and the nudge interval live in the session's own
    // tree, and a fresh `git worktree add` tree has no .kit/ (goal state lives
    // in the main checkout). The armed goal resolving for this directory is
    // what licenses the gate to create .kit itself; without that, the run this
    // record exists for would take every deny unrecorded and the nudge that
    // prompts the checkpoint open could never stamp its interval, so it would
    // never speak.
    const w = makeWorktree();
    try {
        writePlanDoc(w.main);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(bindSession(w.main, SESSION).ok, true, 'setup: bind the leash holder');
        const transcript = path.join(w.tree, 'transcript.jsonl');
        writeUsageTranscript(transcript, 50000);
        assert.ok(!fs.existsSync(path.join(w.tree, '.kit')),
            'fixture: the worktree starts with no .kit of its own');

        const denied = runGate(gatePayload(w.tree, transcript));
        assert.strictEqual(denied.status, 2, 'boundary deny; stderr: ' + denied.stderr);
        assert.ok(denied.stderr.includes(DENY_NOTE), 'the boundary note fires: ' + denied.stderr);

        const statePath = path.join(w.tree, '.kit', 'compact-gate.json');
        assert.ok(fs.existsSync(statePath),
            'the deny left its decision record in the worktree\'s own .kit');
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        assert.strictEqual(state.lastDecision && state.lastDecision.verdict, 'deny-boundary',
            'the recorded decision is the boundary deny: ' + JSON.stringify(state.lastDecision));

        const stamped = recordEpisodeNudge(w.tree, SESSION, Date.now(), 'Bash');
        assert.strictEqual(stamped, true,
            'the nudge stamps its interval on the episode the deny opened');
    } finally {
        rmWorktree(w);
    }
});

// ---------------------------------------------------------------------------
// The Stop hook: a 'gone' plan path read from a worktree answers for this
// tree's branch only, so the leash releases or advances on it only when the
// main checkout holding the goal state agrees the plan is gone.
// ---------------------------------------------------------------------------

test('stop: a plan absent only in the worktree holds the stop instead of releasing the leash', () => {
    const w = makeWorktree();
    const eventsRoot = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-stopev-'));
    try {
        // The plan doc exists in the main checkout and was never on this
        // worktree's branch: absent here is unmerged or unfetched, not
        // archived, and treating it as archived would burn the leash down
        // against a plan that is alive in the other tree.
        writePlanDoc(w.main);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(bindSession(w.main, SESSION).ok, true, 'setup: bind the leash holder');
        const transcript = path.join(w.tree, 'transcript.jsonl');
        writeStopTranscript(transcript, PLAN_REL, ['Working on it.']);

        const res = runStopHook(w.tree, transcript, eventsRoot);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.notStrictEqual(res.stdout, '', 'the stop is held, not allowed in silence');
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'the stop is held');
        assert.ok(out.reason.includes('absent in this working directory'),
            'the reason names the local absence: ' + out.reason);
        assert.ok(out.reason.includes('main checkout'),
            'and the checkout that still holds the plan: ' + out.reason);

        const after = readGoal(w.main);
        assert.ok(after && after.plan === PLAN_REL, 'the leash was neither cleared nor advanced');
        assert.deepStrictEqual(readStopEvents(eventsRoot), [],
            'no release or archive event is emitted for a plan alive in the main checkout');
    } finally {
        rmWorktree(w);
        rmDir(eventsRoot);
    }
});

test('stop: a plan gone from both trees still advances mid-queue and releases on the last plan', () => {
    const w = makeWorktree();
    const eventsRoot = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-stopev-'));
    const PLAN2_REL = 'docs/plans/second.md';
    try {
        // Both plan docs live on the worktree's branch and the main checkout
        // never carried either, so deleting one under the worktree makes it
        // gone from both trees: the ordinary archive shape, which must keep
        // advancing and releasing exactly as it does in a plain checkout.
        writePlanDoc(w.tree);
        writeFile(path.join(w.tree, PLAN2_REL), 'Status: In Progress\n\nbody\n');
        assert.strictEqual(armGoal(w.tree, [PLAN_REL, PLAN2_REL]).ok, true,
            'setup: arm the two-plan queue from the worktree');
        assert.strictEqual(bindSession(w.tree, SESSION).ok, true, 'setup: bind the leash holder');
        const transcript = path.join(w.tree, 'transcript.jsonl');
        writeStopTranscript(transcript, PLAN_REL, ['Working on it.']);

        fs.rmSync(path.join(w.tree, PLAN_REL));
        const advanced = runStopHook(w.tree, transcript, eventsRoot);
        assert.strictEqual(advanced.status, 0, advanced.stderr);
        const held = JSON.parse(advanced.stdout);
        assert.strictEqual(held.decision, 'block', 'the mid-queue advance holds the stop');
        assert.ok(held.reason.includes(PLAN2_REL), 'the reason names the next plan: ' + held.reason);
        const mid = readGoal(w.tree);
        assert.ok(mid && mid.plan === PLAN2_REL, 'the leash advanced to the second plan');
        assert.strictEqual(mid.history[0] && mid.history[0].outcome, 'archived');

        fs.rmSync(path.join(w.tree, PLAN2_REL));
        const releasedRun = runStopHook(w.tree, transcript, eventsRoot);
        assert.strictEqual(releasedRun.status, 0, releasedRun.stderr);
        assert.strictEqual(releasedRun.stdout, '', 'the last plan releases the stop');
        assert.ok(!fs.existsSync(ownGoalPath(w.main)), 'the release cleared the main checkout\'s state');
        const events = readStopEvents(eventsRoot);
        assert.strictEqual(events.length, 2, 'one event per finished plan: ' + JSON.stringify(events));
        assert.ok(events.every((e) => e.detail === 'plan-archived'),
            'both are archive releases: ' + JSON.stringify(events));
    } finally {
        rmWorktree(w);
        rmDir(eventsRoot);
    }
});

test('stop: a blocked declaration attributes to the plan the position walk puts current, '
    + 'not the lagging stored pointer', () => {
    const w = makeWorktree();
    const eventsRoot = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-stopev-'));
    const PLAN2_REL = 'docs/plans/second.md';
    try {
        // Both plans present and In Progress, armed as a two-plan queue with the
        // stored pointer at the first, and the leash bound to the stopping
        // session. That is the state the archival below moves off.
        writePlanDoc(w.tree);
        writeFile(path.join(w.tree, PLAN2_REL), 'Status: In Progress\n\nbody\n');
        assert.strictEqual(armGoal(w.tree, [PLAN_REL, PLAN2_REL]).ok, true,
            'setup: arm the two-plan queue');
        assert.strictEqual(bindSession(w.tree, SESSION).ok, true, 'setup: bind the leash holder');

        // The worktree's own branch archives the first plan: its doc is removed
        // from docs/plans/ here and its archived copy reads Complete. The main
        // checkout this goal state lives in still carries the first plan's doc
        // present, also flipped to Complete, but not yet moved to the archive
        // there. A same-named plan doc absent from one tree and present in the
        // other is unmerged or unfetched, not archived (Section 6's own
        // subject), so the Stop hook's 'gone' read never trusts this alone and
        // falls through instead of auto-advancing, while the position walk,
        // which asks both trees and only requires that they agree the plan
        // reads finished, agrees on this one (each tree's own copy reads
        // Complete). The second plan is untouched and reads In Progress in both
        // trees, so the walk settles there while the stored pointer still names
        // the first.
        fs.rmSync(path.join(w.tree, PLAN_REL));
        writeFile(path.join(w.tree, 'docs/archive/example.md'), 'Status: Complete\n\nbody\n');
        writeFile(path.join(w.main, PLAN_REL), 'Status: Complete\n\nbody\n');
        writeFile(path.join(w.main, PLAN2_REL), 'Status: In Progress\n\nbody\n');
        const transcript = path.join(w.tree, 'transcript.jsonl');
        const blocker = 'BLOCKED: need your call on the rollout order.';
        writeStopTranscript(transcript, PLAN_REL, [blocker]);

        const res = runStopHook(w.tree, transcript, eventsRoot);
        assert.strictEqual(res.status, 0, res.stderr);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'the blocker holds the stop');

        const events = readStopEvents(eventsRoot);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event, 'goal-blocked');
        assert.strictEqual(events[0].plan, PLAN2_REL,
            'the event names the plan the position walk puts current, not the stored pointer '
            + 'still naming the plan already finished and archived: ' + JSON.stringify(events[0]));

        // The leash's own position is the stored pointer's: it advances exactly
        // one plan from where it stood, whatever the walk found. The history
        // record is attribution rather than position, so it files the outcome
        // under the plan the event names and the two cannot disagree about one
        // incident.
        const state = readGoal(w.tree);
        assert.strictEqual(state.plan, PLAN2_REL, 'the leash advanced exactly one plan');
        assert.strictEqual(state.queueIndex, 1, 'from the stored index, by one');
        assert.strictEqual(state.history[0].outcome, 'blocked');
        assert.strictEqual(state.history[0].plan, PLAN2_REL,
            'the persisted history record files the outcome under the same plan the event names: '
            + JSON.stringify(state.history[0]));

        // The hold reason is the leash's own, composed from the stored pointer
        // rather than from the walk: it tells the session which plan the leash
        // has moved off and which it has moved to, and those two are never one
        // string. A reason naming one plan as both finished and current would go
        // on to tell an unattended run that a blocker recorded against that plan
        // does not carry over to it, which is the leash walking a real blocker.
        assert.ok(out.reason.includes(PLAN_REL + ' finished (blocked)'),
            'the reason names the plan the leash moved off: ' + out.reason);
        assert.ok(out.reason.includes('the current plan is now ' + PLAN2_REL),
            'and names the plan it moved to: ' + out.reason);
        assert.ok(!out.reason.includes(PLAN2_REL + ' finished ('),
            'never the plan it moved to as the plan that finished: ' + out.reason);
        assert.ok(out.reason.includes('a blocker specific to ' + PLAN_REL + ' does not carry over'),
            'the carry-over test names the finished plan, so it is a test and not a waiver: '
            + out.reason);
    } finally {
        rmWorktree(w);
        rmDir(eventsRoot);
    }
});

test('stop: a blocked declaration with the pointer and the walk agreeing attributes to that plan '
    + 'and advances off it', () => {
    const w = makeWorktree();
    const eventsRoot = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-stopev-'));
    const PLAN2_REL = 'docs/plans/second.md';
    try {
        // The control for the case above: nothing is archived anywhere, both
        // plans read In Progress in both trees, so the position walk settles on
        // the same first plan the stored pointer names. Attribution and
        // enforcement then have one plan between them, and the healthy case is
        // pinned unchanged.
        writePlanDoc(w.tree);
        writeFile(path.join(w.tree, PLAN2_REL), 'Status: In Progress\n\nbody\n');
        writeFile(path.join(w.main, PLAN_REL), 'Status: In Progress\n\nbody\n');
        writeFile(path.join(w.main, PLAN2_REL), 'Status: In Progress\n\nbody\n');
        assert.strictEqual(armGoal(w.tree, [PLAN_REL, PLAN2_REL]).ok, true,
            'setup: arm the two-plan queue');
        assert.strictEqual(bindSession(w.tree, SESSION).ok, true, 'setup: bind the leash holder');

        const transcript = path.join(w.tree, 'transcript.jsonl');
        writeStopTranscript(transcript, PLAN_REL, ['BLOCKED: need your call on the rollout order.']);

        const res = runStopHook(w.tree, transcript, eventsRoot);
        assert.strictEqual(res.status, 0, res.stderr);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'the blocker holds the stop');

        const events = readStopEvents(eventsRoot);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event, 'goal-blocked');
        assert.strictEqual(events[0].plan, PLAN_REL,
            'the event names the plan both readings agree on: ' + JSON.stringify(events[0]));

        const state = readGoal(w.tree);
        assert.strictEqual(state.plan, PLAN2_REL, 'the leash advanced exactly one plan');
        assert.strictEqual(state.history[0].outcome, 'blocked');
        assert.strictEqual(state.history[0].plan, PLAN_REL,
            'and the history record files the outcome under that same plan');
        assert.ok(out.reason.includes(PLAN_REL + ' finished (blocked)'),
            'the reason names the plan the leash moved off: ' + out.reason);
        assert.ok(out.reason.includes('the current plan is now ' + PLAN2_REL),
            'and names the plan it moved to: ' + out.reason);
    } finally {
        rmWorktree(w);
        rmDir(eventsRoot);
    }
});

// ---------------------------------------------------------------------------
// The plan doc's live copy: a chapter boundary opened from a worktree records
// the execution tree in the goal state (the checkpoint CLI is the field's one
// writer), and the statusline's Sections segment prefers that tree's copy of
// the plan doc, since the live copy sits on the executing branch while the
// checkout holding the state may carry a stale one. The field is display
// trust only, and the guard case pins that nothing leash-deciding reads it.
// ---------------------------------------------------------------------------

const widget = require('../plugins/claude-kit/scripts/kit-goal-statusline.js');
const WIDGET_SCRIPT = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts', 'kit-goal-statusline.js');

// Run the statusline widget as its own process against a cwd, the way the
// harness runs it at every refresh. The display-note cases below need a child
// because the resolution notes are once-per-process and write to stderr, so an
// in-process render would both spend the flags and write into the runner.
function runWidget(cwd) {
    return spawnSync(process.execPath, [WIDGET_SCRIPT], {
        input: JSON.stringify({ cwd }), encoding: 'utf8', env: childEnv()
    });
}

// A plan doc with three sections and the given Chapters tail: the Sections
// count is what tells two copies of one doc apart.
function writeSectionedPlan(root, chapters) {
    writeFile(path.join(root, PLAN_REL), [
        '# Example',
        'Status: In Progress',
        '',
        '## Sections of Work',
        '',
        '### 1. First',
        '',
        '### 2. Second',
        '',
        '### 3. Third',
        '',
        '## Chapters',
        ''
    ].concat(chapters).join('\n') + '\n');
}

const ONE_DONE = ['### Chapter 1', 'Completed: 1. First', 'Next: 2. Second'];
const TWO_DONE = ONE_DONE.concat(['### Chapter 2', 'Completed: 2. Second', 'Next: 3. Third']);
const STALE_LINE = '\u{1F3AF} example · Sections: 1/3 (Next §2)';
const LIVE_LINE = '\u{1F3AF} example · Sections: 2/3 (Next §3)';

// Plant an execution tree by hand in a checkout's state file. The field's
// threat model is a hand edit, so these fixtures write it the same way.
function injectTree(root, value) {
    const gp = ownGoalPath(root);
    const raw = JSON.parse(fs.readFileSync(gp, 'utf8'));
    raw.executionTree = value;
    fs.writeFileSync(gp, JSON.stringify(raw), 'utf8');
}

test('a boundary opened from a worktree records the execution tree, and the statusline counts that tree\'s copy', () => {
    const w = makeWorktree();
    try {
        // The captured shape: the main checkout carries a stale copy of the
        // plan doc while the executing branch, checked out in the worktree, is
        // a chapter further along.
        writeSectionedPlan(w.main, ONE_DONE);
        writeSectionedPlan(w.tree, TWO_DONE);
        // Distinct modification times, so the cache-key assertion below can
        // tell whose copy produced the number.
        const older = new Date(Date.now() - 60000);
        fs.utimesSync(path.join(w.main, PLAN_REL), older, older);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');

        const opened = runCheckpointCli(['open'], w.tree);
        assert.strictEqual(opened.status, 0, 'open succeeds from the worktree; stderr: ' + opened.stderr);
        const state = readGoal(w.main);
        assert.strictEqual(state.executionTree, w.tree,
            'the boundary recorded the worktree as the execution tree');

        // Rendered from the main checkout, which is where the observed defect
        // lay: that renderer's goal state is right while its checkout's doc
        // copy is behind.
        assert.strictEqual(widget.render(w.main), LIVE_LINE,
            'the Sections count comes from the execution tree\'s copy');

        // The cache key moves with the same copy the text was read from: keyed
        // on the stale copy, a cached line would stand for as long as that copy
        // stands still, which for a doc living on the executing branch is
        // indefinitely.
        assert.strictEqual(widget.planKeyMtime(w.main, PLAN_REL),
            fs.statSync(path.join(w.tree, PLAN_REL)).mtimeMs,
            'the render-cache key is the execution tree copy\'s mtime');
    } finally {
        rmWorktree(w);
    }
});

test('a recorded tree that no longer holds the plan doc falls back to the checkout\'s copy', () => {
    const w = makeWorktree();
    try {
        writeSectionedPlan(w.main, ONE_DONE);
        writeSectionedPlan(w.tree, TWO_DONE);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(runCheckpointCli(['open'], w.tree).status, 0, 'setup: record the tree');
        fs.rmSync(path.join(w.tree, PLAN_REL));

        assert.strictEqual(widget.render(w.main), STALE_LINE,
            'the checkout\'s own copy is what renders');
        assert.strictEqual(typeof readGoal(w.main).executionTree, 'string',
            'the fallback is the reader\'s judgment, not a drop: the record stands');
    } finally {
        rmWorktree(w);
    }
});

test('a tree copy past the widget\'s read cap falls back to the checkout\'s copy instead of dropping the segment', () => {
    const w = makeWorktree();
    try {
        // The read cap rides into the root election itself: a tree copy the
        // widget could never read whole is a tree that cannot be trusted, so
        // the checkout's readable copy renders. Elected instead, the text read
        // would refuse the oversized copy and the line would drop its Sections
        // segment entirely, with a readable copy sitting right there.
        writeSectionedPlan(w.main, ONE_DONE);
        writeSectionedPlan(w.tree, TWO_DONE);
        const older = new Date(Date.now() - 60000);
        fs.utimesSync(path.join(w.main, PLAN_REL), older, older);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(runCheckpointCli(['open'], w.tree).status, 0, 'setup: record the tree');
        fs.appendFileSync(path.join(w.tree, PLAN_REL), 'x'.repeat(widget.PLAN_MAX_BYTES));

        assert.strictEqual(widget.render(w.main), STALE_LINE,
            'the checkout\'s copy renders, Sections segment intact');
        // The cache key follows the same election, so the line above and the
        // key it is stored under describe one copy.
        assert.strictEqual(widget.planKeyMtime(w.main, PLAN_REL),
            fs.statSync(path.join(w.main, PLAN_REL)).mtimeMs,
            'the render-cache key is the checkout copy\'s mtime');
    } finally {
        rmWorktree(w);
    }
});

test('the display probe resolves the recorded tree in silence: no repair note, no orphan note', () => {
    // The resolution notes speak about where goal state is read, which a
    // display probe over a recorded execution tree never decides, and the
    // widget is a fresh process at every status-line refresh, so a note fired
    // from this path would repaint on every refresh. Both notes are pinned
    // silent here: the handshake note over the post-prune shape (the tree and
    // its .git pointer survive while the main checkout's administrative
    // directory is gone), and the orphan note over a held handshake whose tree
    // carries a leftover goal-state file of its own.
    const pruned = makeWorktree({ name: 'sil' });
    const orphaned = makeWorktree({ name: 'silorph' });
    try {
        writeSectionedPlan(pruned.main, ONE_DONE);
        writeSectionedPlan(pruned.tree, TWO_DONE);
        assert.strictEqual(armGoal(pruned.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(runCheckpointCli(['open'], pruned.tree).status, 0, 'setup: record the tree');
        rmDir(pruned.gitdir);
        const broken = runWidget(pruned.main);
        assert.strictEqual(broken.status, 0, broken.stderr);
        assert.strictEqual(broken.stdout, STALE_LINE, 'the broken handshake falls back to the checkout\'s copy');
        assert.strictEqual(broken.stderr, '',
            'no worktree-repair note fires from the display fallback');

        writeSectionedPlan(orphaned.main, ONE_DONE);
        writeSectionedPlan(orphaned.tree, TWO_DONE);
        assert.strictEqual(armGoal(orphaned.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(runCheckpointCli(['open'], orphaned.tree).status, 0, 'setup: record the tree');
        writeFile(ownGoalPath(orphaned.tree), '{}\n');
        const held = runWidget(orphaned.main);
        assert.strictEqual(held.status, 0, held.stderr);
        assert.strictEqual(held.stdout, LIVE_LINE, 'the held handshake still elects the tree\'s copy');
        assert.strictEqual(held.stderr, '',
            'no orphan note fires from the display probe');
    } finally {
        rmWorktree(pruned);
        rmWorktree(orphaned);
    }
});

test('a main checkout reached through a junction spelling still elects the recorded tree\'s copy', {
    skip: process.platform === 'win32' ? false : 'junctions are a win32 shape'
}, () => {
    // The accepted main arrives folded to the volume's own spelling, while
    // goalRoot answers an ordinary checkout with the caller's literal cwd, so
    // the election folds the cwd side the same way before comparing the two.
    // Unfolded, a cwd spelled through an 8.3 segment, a junction, or a subst
    // drive would miss the compare and silently keep the stale copy, which is
    // the display defect the election exists to fix. The junction is the one
    // of those spellings this suite can mint without privilege.
    const w = makeWorktree({ name: 'fold' });
    const linkParent = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-fold-'));
    const link = path.join(linkParent, 'via');
    try {
        fs.symlinkSync(w.main, link, 'junction');
        writeSectionedPlan(w.main, ONE_DONE);
        writeSectionedPlan(w.tree, TWO_DONE);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(runCheckpointCli(['open'], w.tree).status, 0, 'setup: record the tree');
        assert.strictEqual(widget.render(link), LIVE_LINE,
            'the junction spelling of the checkout still elects the tree\'s copy');
    } finally {
        rmDir(linkParent);
        rmWorktree(w);
    }
});

test('the execution-tree screen runs before the first filesystem touch at the recorded value', {
    skip: process.platform === 'win32' ? false : 'UNC and device paths are a win32 shape'
}, () => {
    // The discriminating fixture, the pointer-screen positional case retold
    // for the display field: the recorded value spells a genuinely resolvable
    // worktree through the \\?\ device namespace, whose root starts with two
    // separators exactly as a UNC path's does, so it takes the same screen.
    // The administrative back-pointer is rewired so the handshake closes
    // THROUGH that spelling, and the tree holds the plan doc, so a resolver
    // that touched the target before screening it would find everything in
    // order and elect the tree. The state is written with no plan at all,
    // because that is the shape readGoal's normalize returns unscreened (its
    // early return keeps every field as the file spelled it), and the
    // launcher's stateless probe hands planDisplayRoot exactly such a state:
    // the re-screen inside planDisplayRoot is the one screen the value meets
    // on that path.
    // The spy on the fs entry points is what makes the pin positional rather
    // than observational: a screen merely relocated below the first touch
    // would still answer cwd, but the touch it allowed is recorded and fails
    // the second assertion.
    const w = makeWorktree({ name: 'screen' });
    try {
        const devTree = '\\\\?\\' + w.tree;
        fs.writeFileSync(path.join(w.gitdir, 'gitdir'), path.join(devTree, '.git') + '\n', 'utf8');
        writeSectionedPlan(w.tree, TWO_DONE);
        assert.ok(fs.statSync(path.join(devTree, PLAN_REL)).isFile(),
            'fixture: the plan doc is reachable through the exact device spelling the field uses');
        writeFile(ownGoalPath(w.main), JSON.stringify({ executionTree: devTree }));

        const touched = [];
        const spied = ['statSync', 'lstatSync', 'openSync'];
        const real = {};
        for (const name of spied) real[name] = fs[name];
        try {
            for (const name of spied) {
                fs[name] = function (...args) {
                    if (typeof args[0] === 'string' && args[0].startsWith('\\\\?\\')) {
                        touched.push(name + ' ' + args[0]);
                    }
                    return real[name].apply(fs, args);
                };
            }
            assert.strictEqual(planDisplayRoot(w.main, PLAN_REL), w.main,
                'the screened value is refused and the display falls back to the cwd');
        } finally {
            for (const name of spied) fs[name] = real[name];
        }
        assert.deepStrictEqual(touched, [],
            'no filesystem call reached the device-spelled value: the screen ran before the first touch');
    } finally {
        rmWorktree(w);
    }
});

test('a recorded tree that is gone entirely falls back to the checkout\'s copy', () => {
    const main = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-extree-'));
    try {
        writeSectionedPlan(main, ONE_DONE);
        assert.strictEqual(armGoal(main, PLAN_REL).ok, true, 'setup: arm');
        injectTree(main, path.join(WORKTREE_TMP, 'kit-goal-vanished-' + process.pid));
        assert.strictEqual(widget.render(main), STALE_LINE);
    } finally {
        rmDir(main);
    }
});

test('a directory that is not a worktree of this repository cannot claim to be the execution tree', () => {
    const main = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-exmain-'));
    const foreignDir = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-exforeign-'));
    const otherRepo = makeWorktree({ name: 'exother' });
    try {
        // The value is an absolute path out of a hand-editable file, so it is
        // held to what it claims to be before anything under it is opened: a
        // linked worktree of THIS repository, proven by the same two-way
        // handshake goal-state resolution trusts. A plain directory holding a
        // further-along copy fails it, and so does a genuine worktree of some
        // other repository, whose handshake closes but lands on the wrong
        // root.
        writeSectionedPlan(main, ONE_DONE);
        writeSectionedPlan(foreignDir, TWO_DONE);
        writeSectionedPlan(otherRepo.tree, TWO_DONE);
        assert.strictEqual(armGoal(main, PLAN_REL).ok, true, 'setup: arm');

        injectTree(main, foreignDir);
        assert.strictEqual(widget.render(main), STALE_LINE,
            'a plain directory is refused however plausible its copy');

        injectTree(main, otherRepo.tree);
        assert.strictEqual(widget.render(main), STALE_LINE,
            'a worktree of another repository is refused on the root it resolves to');
    } finally {
        rmDir(main);
        rmDir(foreignDir);
        rmWorktree(otherRepo);
    }
});

test('recordExecutionTree refuses when the goal advances between its decision read and its write base', () => {
    // The compare-and-swap advanceGoal and appendGoal take over the same
    // window: a checkpoint open racing a Stop-hook advance must not re-attach
    // the finished plan's tree to the advanced state, which would undo the
    // delete advanceGoal performs so that a stale tree path cannot outlive
    // the plan it described. The race is driven at the one seam both reads
    // share: the second read of the state file is intercepted and the file
    // swapped for the advanced shape first, which is exactly what a Stop-hook
    // advance landing in the window does.
    const NEXT_REL = 'docs/plans/next.md';
    const w = makeWorktree({ name: 'cas' });
    try {
        writePlanDoc(w.main);
        writeFile(path.join(w.main, NEXT_REL), 'Status: In Progress\n\nbody\n');
        assert.strictEqual(armGoal(w.main, [PLAN_REL, NEXT_REL]).ok, true, 'setup: arm a two-plan queue');
        const gp = goalPath(w.tree);
        assert.strictEqual(gp, ownGoalPath(w.main), 'setup: the worktree resolves the main checkout\'s state');

        const realRead = fs.readFileSync;
        const advance = () => {
            const raw = JSON.parse(realRead(gp, 'utf8'));
            raw.queueIndex = 1;
            raw.plan = raw.queue[1];
            fs.writeFileSync(gp, JSON.stringify(raw), 'utf8');
        };
        let reads = 0;
        let result;
        try {
            fs.readFileSync = function (...args) {
                if (typeof args[0] === 'string' && args[0] === gp) {
                    reads += 1;
                    if (reads === 2) advance();
                }
                return realRead.apply(fs, args);
            };
            result = recordExecutionTree(w.tree);
        } finally {
            fs.readFileSync = realRead;
        }
        assert.strictEqual(reads, 2, 'fixture: the record took its decision read and its write-base read');
        assert.strictEqual(result.ok, false, 'the record refuses rather than writing over the advance');
        assert.match(result.reason, /goal state changed/, result.reason);
        const after = JSON.parse(fs.readFileSync(gp, 'utf8'));
        assert.strictEqual(after.plan, NEXT_REL, 'the advance stands');
        assert.ok(!('executionTree' in after),
            'the finished plan\'s tree was not re-attached to the state that replaced it');
    } finally {
        rmWorktree(w);
    }
});

test('a boundary opened from the resolved checkout itself drops the recorded tree', () => {
    const w = makeWorktree();
    try {
        writePlanDoc(w.main);
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(runCheckpointCli(['open'], w.tree).status, 0,
            'setup: a worktree boundary records the tree');
        assert.strictEqual(typeof readGoal(w.main).executionTree, 'string', 'setup: the record stands');

        assert.strictEqual(runCheckpointCli(['open'], w.main).status, 0, 'a main-checkout boundary succeeds');
        assert.ok(!('executionTree' in readGoal(w.main)),
            'the field holds the latest boundary\'s observation, and that observation is the checkout itself');
    } finally {
        rmWorktree(w);
    }
});

test('the leash decides nothing from the execution tree: a Complete copy there neither advances nor releases', () => {
    const w = makeWorktree();
    const eventsRoot = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-goal-exev-'));
    try {
        // The field's one consumer is display. If anything leash-deciding ever
        // resolved the plan doc through it, this fixture is the burn: the
        // recorded tree's copy reads Complete while the checkout's own reads
        // In Progress, so a redirected planHead would release or advance a
        // leash whose plan is still open.
        writePlanDoc(w.main);
        writeFile(path.join(w.tree, PLAN_REL), 'Status: Complete\n\nbody\n');
        assert.strictEqual(armGoal(w.main, PLAN_REL).ok, true, 'setup: arm in the main checkout');
        assert.strictEqual(bindSession(w.main, SESSION).ok, true, 'setup: bind the leash holder');
        assert.strictEqual(runCheckpointCli(['open'], w.tree).status, 0, 'setup: record the tree');
        assert.strictEqual(typeof readGoal(w.main).executionTree, 'string', 'setup: the record stands');

        const transcript = path.join(w.main, 'transcript.jsonl');
        writeStopTranscript(transcript, PLAN_REL, ['Working on it.']);
        const res = runStopHook(w.main, transcript, eventsRoot);
        assert.strictEqual(res.status, 0, res.stderr);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block',
            'the stop is held on the checkout copy\'s In Progress, the field unread');
        const after = readGoal(w.main);
        assert.ok(after && after.plan === PLAN_REL, 'the leash was neither cleared nor advanced');
        assert.deepStrictEqual(readStopEvents(eventsRoot), [], 'no release or archive event');

        // The compaction gate is equally deaf to it: a below-ceiling offer
        // from the leash holder still takes the boundary deny with the field
        // present.
        const usage = path.join(w.main, 'usage.jsonl');
        writeUsageTranscript(usage, 50000);
        const gate = runGate(gatePayload(w.main, usage));
        assert.strictEqual(gate.status, 2, 'boundary deny; stderr: ' + gate.stderr);
        assert.ok(gate.stderr.includes(DENY_NOTE), 'the boundary note fires: ' + gate.stderr);
    } finally {
        rmWorktree(w);
        rmDir(eventsRoot);
    }
});

// ---------------------------------------------------------------------------
// Queue position over two trees. Goal state resolves worktree-to-main while
// plan docs resolve against the caller's own cwd, so the two trees can
// genuinely disagree about whether a queued plan is finished: a plan closed out
// on a branch is archived in the worktree and still live on main until the
// merge lands.
// ---------------------------------------------------------------------------

const QUEUE_A = 'docs/plans/qa.md';
const QUEUE_B = 'docs/plans/qb.md';

function writeQueuePlans(root) {
    writeFile(path.join(root, QUEUE_A), '# A\n\nStatus: In Progress\n\n## Sections of Work\n');
    writeFile(path.join(root, QUEUE_B), '# B\n\nStatus: In Progress\n\n## Sections of Work\n');
}

// The move a close-out makes in one tree: the doc's Status row is flipped to
// Complete and the doc is filed under that tree's docs/archive/. Both halves
// matter, because the archive leg reads the filed copy's own header rather than
// treating its presence as evidence.
function archiveIn(root, rel) {
    writeFile(path.join(root, rel), '# A\n\nStatus: Complete\n\n## Chapters\n');
    fs.mkdirSync(path.join(root, 'docs', 'archive'), { recursive: true });
    fs.renameSync(path.join(root, rel), path.join(root, 'docs', 'archive', path.basename(rel)));
}

test('a queue entry finished in one tree only holds the reported position; agreement moves it', () => {
    const w = makeWorktree();
    try {
        writeQueuePlans(w.main);
        writeQueuePlans(w.tree);
        assert.strictEqual(armGoal(w.main, [QUEUE_A, QUEUE_B]).ok, true,
            'setup: the queue arms in the main checkout');

        // The branch closed the first plan out and filed it; main has not seen
        // the merge, so its copy is still live. The disagreement reports the
        // entry unfinished, because a wrongly-finished one moves the reported
        // position past work that is still live in the other tree, silently,
        // where a wrongly-unfinished one only under-reports progress.
        archiveIn(w.tree, QUEUE_A);
        let res = runGoalCli(['status'], w.tree);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /queue: plan 1 of 2/,
            'archived here and live there is not a finished plan: ' + res.stdout);
        assert.doesNotMatch(res.stdout, /queue: plan 2 of 2/);

        // The other direction of the same disagreement: filed on main while
        // the branch still holds a live copy.
        writeFile(path.join(w.tree, QUEUE_A), '# A\n\nStatus: In Progress\n\n## Sections of Work\n');
        archiveIn(w.main, QUEUE_A);
        res = runGoalCli(['status'], w.tree);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /queue: plan 1 of 2/,
            'live here and archived there is not a finished plan either: ' + res.stdout);

        // The control that keeps the two assertions above from passing for the
        // wrong reason: with the merge landed, both trees read the entry the
        // same way and the reported position moves.
        fs.rmSync(path.join(w.tree, QUEUE_A));
        res = runGoalCli(['status'], w.tree);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /queue: plan 2 of 2/,
            'agreement in both trees moves the position: ' + res.stdout);
        assert.match(res.stdout, /the stored position still says plan 1/);
    } finally {
        rmWorktree(w);
    }
});
