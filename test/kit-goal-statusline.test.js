// Unit tests for plugins/claude-kit/scripts/kit-goal-statusline.js and the
// scripts/kit-statusline.js launcher.
//
// Node's built-in test runner, no framework, no install (Node v24). Each case
// builds a fresh temp directory under os.tmpdir() as a fake repo cwd, writes
// a goal state and a plan doc there, renders against it, and cleans up in a
// finally block. The plan-doc fixtures follow the machine contract the
// curating-docs skill freezes, since that contract is what the section count
// is defined against.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPTS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts');
const WIDGET = path.join(SCRIPTS, 'kit-goal-statusline.js');
const LAUNCHER = path.join(SCRIPTS, 'kit-statusline.js');
const HOOKS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks');
const GOAL_LIB = path.join(HOOKS, 'kit-goal-lib.js');
const SESSION_START_HOOK = path.join(HOOKS, 'session-start.js');
const GOAL_CLI = path.join(HOOKS, 'kit-goal.js');
const { cwdFromInput, sectionProgress, pointerFrom, render, PLAN_MAX_BYTES } = require(WIDGET);

function makeRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-'));
    fs.mkdirSync(path.join(dir, '.kit'));
    fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
    return dir;
}

function rmDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

function arm(dir, state) {
    fs.writeFileSync(path.join(dir, '.kit', 'goal-state.json'), JSON.stringify(state), 'utf8');
}

const PLAN_REL = 'docs/plans/widget_spec_v1.md';

function plan(dir, chapters) {
    const head = [
        '# Widget',
        'Status: In Progress',
        'Commit Model: Review-Only',
        '',
        '## Sections of Work',
        '',
        '### 1. First thing',
        'Model: sonnet',
        '',
        '### 2. Second thing',
        'Model: sonnet',
        '',
        '### 3. Third thing',
        'Model: sonnet',
        '',
        '## Out of Scope',
        '',
        '## Chapters',
        ''
    ];
    fs.writeFileSync(path.join(dir, PLAN_REL), head.concat(chapters).join('\n'), 'utf8');
}

test('nothing armed renders the affirmative unarmed line', () => {
    const dir = makeRepo();
    try {
        // A project with no goal state gets a line saying so, not a blank. The
        // blank is reserved for the widget having no reading at all, so an
        // operator can tell a healthy unarmed project from a payload that
        // predates the widget and from a fault.
        assert.strictEqual(render(dir), '\u{1F3AF} unarmed');
    } finally {
        rmDir(dir);
    }
});

test('a goal state that is there and unreadable renders blank rather than claiming nothing is armed', () => {
    const dir = makeRepo();
    try {
        // The control for the case above: something is at the goal-state path
        // and no reader can make a goal of it, so the widget has no reading of
        // whether a goal is armed and says nothing. Affirming an unarmed
        // project here would be a guess.
        fs.writeFileSync(path.join(dir, '.kit', 'goal-state.json'), '{not json at all', 'utf8');
        assert.strictEqual(render(dir), '');
    } finally {
        rmDir(dir);
    }
});

test('a single armed plan with no Chapters shows the plan, 0 of N, and a pointer at section 1, and no Plans segment', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)');
    } finally {
        rmDir(dir);
    }
});

test('a plan doc behind a UTF-8 BOM still finds its Sections block', () => {
    const dir = makeRepo();
    try {
        // PowerShell Set-Content writes a BOM, so a plan doc edited from a
        // PowerShell session carries one in front of its first line. The block
        // scan matches a heading at the start of a line, so a BOM joined to the
        // first heading hides the Sections block and the segment disappears
        // rather than erroring. The fixture leads with that heading, which is
        // the only line a BOM can reach.
        arm(dir, { plan: PLAN_REL });
        fs.writeFileSync(path.join(dir, PLAN_REL), '\uFEFF' + [
            '## Sections of Work',
            '',
            '### 1. First thing',
            '',
            '### 2. Second thing',
            '',
            '## Chapters',
            ''
        ].join('\n'), 'utf8');
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 0/2 (Next §1)');
    } finally {
        rmDir(dir);
    }
});

test('Completed lines register by number-dot, number-space, or exact title, never by substring', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, [
            '### Chapter 1 - 2026-08-24',
            'Completed: 1. First thing',
            'Next: 2. Second thing',
            '',
            '### Chapter 2 - 2026-08-24',
            'Completed: 2 Second thing, plus a note',
            'Next: 3. Third thing',
            '',
            '### Chapter 3 - 2026-08-24',
            'Completed: Section 3, Third thing',
            'Next: finishing-work',
            ''
        ]);
        // Chapter 3's phrasing matches none of the three forms, so section 3
        // stays open, exactly as the external engine reads it.
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 2/3 (Next finishing)');
    } finally {
        rmDir(dir);
    }
});

test('an exact-title Completed line registers, and only the first Completed line of a Chapter counts', () => {
    const progress = sectionProgress([
        '## Sections of Work',
        '### 1. First thing',
        '### 2. Second thing',
        '## Chapters',
        '### Chapter 1',
        'Completed: Second thing',
        'Completed: 1. First thing',
        'Next: Section 1'
    ].join('\n'));
    assert.deepStrictEqual(progress, { done: 1, total: 2, pointer: '§1' });
});

test('a queue of more than one plan adds the Plans segment', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 0 });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2) · Plans: 1/2');
    } finally {
        rmDir(dir);
    }
});

test('a missing plan doc drops the Sections segment and keeps the rest', () => {
    const dir = makeRepo();
    try {
        // The fixture is self-consistent (queue[queueIndex] is the current
        // plan), which is what the CLI writes and what the shared reader
        // requires: a state whose index disagrees with its plan is normalized
        // to a queue of one, and the Plans segment then has nothing to report.
        // Neither the doc at 'docs/plans/b.md' nor a same-named archived copy
        // exists here, so the entry the reported position names is itself one
        // no tree can resolve, and the Plans segment says so rather than
        // printing a bare "2/2" the plan docs give no evidence for.
        arm(dir, { plan: 'docs/plans/b.md', queue: ['docs/plans/gone_spec_v1.md', 'docs/plans/b.md'], queueIndex: 1 });
        assert.strictEqual(render(dir), '\u{1F3AF} b · Plans: 2/2 (unresolvable: neither)');
    } finally {
        rmDir(dir);
    }
});

// A plan doc at an arbitrary relative path, with a Status header this
// module's own machine contract reads. Used for the Plans-segment fixtures
// below, which need more than one plan path and so cannot reuse PLAN_REL.
function planAt(dir, rel, statusValue, chapters) {
    const head = [
        '# ' + path.basename(rel, '.md'),
        'Status: ' + statusValue,
        'Commit Model: Review-Only',
        '',
        '## Sections of Work',
        '',
        '### 1. First thing',
        'Model: sonnet',
        '',
        '## Chapters',
        ''
    ];
    fs.writeFileSync(path.join(dir, rel), head.concat(chapters || []).join('\n'), 'utf8');
}

// A same-named copy filed under docs/archive/, the shape queueEntryState
// reads when nothing stands at the plans path any more. rel is the entry's
// plans-path spelling; the archived copy's name is its tail, matching
// archivePathFor's own derivation.
function archiveAt(dir, rel, statusValue) {
    const tail = rel.slice('docs/plans/'.length);
    const full = path.join(dir, 'docs', 'archive', tail);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const head = [
        '# ' + path.basename(rel, '.md'),
        'Status: ' + statusValue,
        '',
        '## Sections of Work',
        '',
        '### 1. First thing',
        '',
        '## Chapters',
        ''
    ];
    fs.writeFileSync(full, head.join('\n'), 'utf8');
}

test('a queue whose first entry is finished and archived reports the plan docs\' position, not the stale stored one', () => {
    const dir = makeRepo();
    try {
        // The live defect state this section exists to fix: the stored index
        // still names the first queued plan, which is Complete and filed under
        // docs/archive/, while the second one is the plan actually being
        // worked. Today's code prints the stored index alone ("Plans: 1/2");
        // the derived position agrees with the SessionStart advisory and
        // `kit-goal.js status`, both of which read "plan 2 of 2" here, and
        // names the stored index alongside it so the gap is visible rather
        // than papered over. The marker above still names the STORED plan
        // (a_spec_v1), so the plan actually at the derived position
        // (b_spec_v1) is named beside its own number too: left unnamed,
        // "Plans: 2/2" would read as a claim about a_spec_v1, which is false
        // of it.
        archiveAt(dir, 'docs/plans/a_spec_v1.md', 'Complete');
        planAt(dir, 'docs/plans/b_spec_v1.md', 'In Progress');
        arm(dir, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0
        });
        assert.strictEqual(render(dir), '\u{1F3AF} a_spec_v1 · Plans: 2/2 b_spec_v1 (stored 1)');
    } finally {
        rmDir(dir);
    }
});

test('a healthy queue renders the Plans segment byte-identically to before this section', () => {
    const dir = makeRepo();
    try {
        // Guard direction: the stored index and the derived position agree on
        // a healthy queue (the first entry is unfinished), so this line must
        // stay exactly what it always was.
        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 0 });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2) · Plans: 1/2');
    } finally {
        rmDir(dir);
    }
});

test('an entry the plan docs cannot resolve at all renders its cause rather than a bare number', () => {
    const dir = makeRepo();
    try {
        // Neither queue[0]'s doc nor a same-named archived copy exists in any
        // tree, so the reported position keeps that entry rather than
        // skipping past it (skipping would renumber the queue around a plan
        // whose absence is exactly what an operator needs told).
        arm(dir, {
            plan: 'docs/plans/missing_spec_v1.md',
            queue: ['docs/plans/missing_spec_v1.md', 'docs/plans/other_spec_v1.md'],
            queueIndex: 0
        });
        assert.strictEqual(render(dir), '\u{1F3AF} missing_spec_v1 · Plans: 1/2 (unresolvable: neither)');
    } finally {
        rmDir(dir);
    }
});

test('a queue of one plan prints no Plans segment, even when its own doc reads finished', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0 });
        plan(dir, []);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)',
            'a queue of one is never positional, however queuePosition would answer');
    } finally {
        rmDir(dir);
    }

    // A corrected single-plan queue is unreachable by construction (there is
    // nothing past the one entry for the walk to move to), so the
    // discriminating case for a queue of one is a finished one instead:
    // positional stays false even where the entry AT the stored index itself
    // reads Complete and archived, and no queue-of-one render ever renders a
    // Plans segment.
    const finishedDir = makeRepo();
    try {
        archiveAt(finishedDir, 'docs/plans/a_spec_v1.md', 'Complete');
        arm(finishedDir, { plan: 'docs/plans/a_spec_v1.md', queue: ['docs/plans/a_spec_v1.md'], queueIndex: 0 });
        assert.strictEqual(render(finishedDir), '\u{1F3AF} a_spec_v1',
            'a queue of one stays non-positional even when its only entry is finished');
    } finally {
        rmDir(finishedDir);
    }
});

test('the whole queue finished adds a clause, whether the stored index already agrees or needed correcting', () => {
    // Direction one: the stored index already sits on the last entry, and it
    // reads finished. healed is 0 (index === stored), so no plan name and no
    // "stored" clause ride along, only the finished clause.
    const agreeing = makeRepo();
    try {
        archiveAt(agreeing, 'docs/plans/a_spec_v1.md', 'Complete');
        archiveAt(agreeing, 'docs/plans/b_spec_v1.md', 'Complete');
        arm(agreeing, {
            plan: 'docs/plans/b_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 1
        });
        assert.strictEqual(render(agreeing), '\u{1F3AF} b_spec_v1 · Plans: 2/2 (all complete)');
    } finally {
        rmDir(agreeing);
    }

    // Direction two: the stored index still names the first entry, which is
    // finished and archived, so the walk moves to the second and finds it
    // finished too. The corrected plan name and the "stored" clause both ride
    // along beside "all complete".
    const corrected = makeRepo();
    try {
        archiveAt(corrected, 'docs/plans/a_spec_v1.md', 'Complete');
        archiveAt(corrected, 'docs/plans/b_spec_v1.md', 'Complete');
        arm(corrected, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0
        });
        assert.strictEqual(render(corrected), '\u{1F3AF} a_spec_v1 · Plans: 2/2 b_spec_v1 (stored 1, all complete)');
    } finally {
        rmDir(corrected);
    }
});

test('a missed advance onto an entry no tree can resolve combines both clauses, in that order', () => {
    // The header enumerates three forms of the segment, plus the corrected
    // name and the finished clause this fix round adds; this is the fourth
    // and fifth combined form the code actually emits, reachable when the
    // walk moves past a finished first entry onto one neither tree can
    // resolve at all.
    const dir = makeRepo();
    try {
        archiveAt(dir, 'docs/plans/a_spec_v1.md', 'Complete');
        arm(dir, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/gone_spec_v1.md'],
            queueIndex: 0
        });
        assert.strictEqual(render(dir),
            '\u{1F3AF} a_spec_v1 · Plans: 2/2 gone_spec_v1 (stored 1, unresolvable: neither)');
    } finally {
        rmDir(dir);
    }
});

test('renderState\'s plan and planMtimeMs are unchanged by the corrected Plans segment, and it reports itself uncacheable', () => {
    const dir = makeRepo();
    try {
        // The launcher keys its render cache on plan and planMtimeMs, so the
        // corrected Plans text must not move either of them: renderState
        // still names the STORED plan and its own modification time, exactly
        // as it did before this section, even where the segment beside it now
        // reports a different position. cacheable is the launcher's separate
        // signal that this line must not be stored under that key at all: the
        // Plans segment named a doc (b_spec_v1.md) neither of the two files
        // the key covers, so a later change to it could never be detected.
        const { renderState } = require(WIDGET);
        archiveAt(dir, 'docs/plans/a_spec_v1.md', 'Complete');
        planAt(dir, 'docs/plans/b_spec_v1.md', 'In Progress');
        arm(dir, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0
        });
        const result = renderState(dir);
        assert.strictEqual(result.plan, 'docs/plans/a_spec_v1.md');
        assert.strictEqual(result.planMtimeMs, null,
            'a_spec_v1.md does not stand at the plans path, so its key mtime stays null');
        assert.strictEqual(result.line, '\u{1F3AF} a_spec_v1 · Plans: 2/2 b_spec_v1 (stored 1)');
        assert.strictEqual(result.cacheable, false,
            'a corrected position must never be cached under a key that cannot detect it going stale');
    } finally {
        rmDir(dir);
    }
});

test('a healthy render reports itself cacheable', () => {
    const dir = makeRepo();
    try {
        const { renderState } = require(WIDGET);
        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 0 });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        const result = renderState(dir);
        // The common case the cacheability rule must never cost: one tree, the
        // armed plan live at its own plans path, so the position walk opens
        // that one keyed file and stops. The line is asserted alongside the
        // flag because a render that dropped the Plans segment altogether
        // would also be cacheable, and would pass a bare flag assertion while
        // proving nothing about a walk that ran.
        assert.strictEqual(result.line,
            '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2) · Plans: 1/2');
        assert.strictEqual(result.cacheable, true);
    } finally {
        rmDir(dir);
    }
});

test('a finished position read out of the archive is uncacheable, though nothing was healed', () => {
    const dir = makeRepo();
    try {
        const { renderState } = require(WIDGET);
        // The stored index already names the last entry, so the walk corrects
        // nothing (healed is 0) and the old symptom list would have called
        // this line cacheable. It is not: the entry was settled from
        // a_spec_v1.md's ARCHIVED copy, a file the launcher's key never stats,
        // and the key's own plan doc is not even there to produce a time. A
        // later edit to that archived copy, or its removal, would leave both
        // stats unchanged and the "(all complete)" line on screen forever.
        planAt(dir, 'docs/plans/x_spec_v1.md', 'In Progress');
        archiveAt(dir, 'docs/plans/a_spec_v1.md', 'Complete');
        arm(dir, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/x_spec_v1.md', 'docs/plans/a_spec_v1.md'],
            queueIndex: 1
        });
        const result = renderState(dir);
        assert.strictEqual(result.line, '\u{1F3AF} a_spec_v1 · Plans: 2/2 (all complete)');
        assert.strictEqual(result.planMtimeMs, null,
            'setup: the armed plan does not stand at its plans path, so there is no key time');
        assert.strictEqual(result.cacheable, false,
            'a position settled from an archived copy may not be cached under a key that cannot see it');
    } finally {
        rmDir(dir);
    }
});

// A main checkout plus a worktree wired to it, mirroring makeWorktree in
// kit-goal-worktree.test.js: the same on-disk shape the goal family's resolver
// reads, built here because this file's cases need a worktree render and that
// builder is local to its own suite. The fixtures sit under the canonical
// spelling of the temp root for that builder's reason: this machine's TEMP can
// be an 8.3 short path, and an accepted main root is folded to the volume's own
// spelling on win32.
const WORKTREE_TMP = process.platform === 'win32' ? fs.realpathSync.native(os.tmpdir()) : os.tmpdir();

function makeWorktree() {
    const main = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-statusline-main-'));
    const tree = fs.mkdtempSync(path.join(WORKTREE_TMP, 'kit-statusline-tree-'));
    for (const root of [main, tree]) {
        fs.mkdirSync(path.join(root, '.kit'), { recursive: true });
        fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    }
    const gitdir = path.join(main, '.git', 'worktrees', 'wt');
    fs.mkdirSync(gitdir, { recursive: true });
    fs.writeFileSync(path.join(gitdir, 'commondir'), '../..\n', 'utf8');
    fs.writeFileSync(path.join(gitdir, 'gitdir'), path.join(tree, '.git') + '\n', 'utf8');
    fs.writeFileSync(path.join(tree, '.git'), 'gitdir: ' + gitdir + '\n', 'utf8');
    return { main, tree };
}

test('a worktree render is uncacheable even with a healthy, uncorrected position', () => {
    const { main, tree } = makeWorktree();
    try {
        const { renderState } = require(WIDGET);
        // The defect this rule closes, in its own target state. The position
        // walk asks BOTH trees about the current entry (queueEntryState's
        // agreement rule), and only this tree's copy is in the launcher's key.
        // Nothing is corrected here, so a rule reading the correction symptoms
        // alone calls this cacheable: the widget then serves "Plans: 1/2" from
        // the cache while a merge flipping the MAIN checkout's copy to Complete
        // moves the position to 2/2 everywhere else, which is exactly the
        // three-surfaces-disagree state the derived position exists to prevent.
        planAt(tree, 'docs/plans/a_spec_v1.md', 'In Progress');
        planAt(main, 'docs/plans/a_spec_v1.md', 'In Progress');
        planAt(tree, 'docs/plans/b_spec_v1.md', 'In Progress');
        planAt(main, 'docs/plans/b_spec_v1.md', 'In Progress');
        // The goal state lives in the main checkout, which is what makes this
        // a worktree session rather than two unrelated repositories.
        arm(main, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0
        });
        const result = renderState(tree);
        assert.match(result.line, /Plans: 1\/2$/,
            'setup: the walk ran and reported the uncorrected position: ' + result.line);
        assert.strictEqual(result.cacheable, false,
            'a position that consulted the main checkout may not be cached on this tree\'s copy alone');
    } finally {
        rmDir(main);
        rmDir(tree);
    }
});

test('an unresolvable position reports itself uncacheable', () => {
    const dir = makeRepo();
    try {
        const { renderState } = require(WIDGET);
        arm(dir, {
            plan: 'docs/plans/missing_spec_v1.md',
            queue: ['docs/plans/missing_spec_v1.md', 'docs/plans/other_spec_v1.md'],
            queueIndex: 0
        });
        const result = renderState(dir);
        assert.strictEqual(result.line, '\u{1F3AF} missing_spec_v1 · Plans: 1/2 (unresolvable: neither)');
        assert.strictEqual(result.cacheable, false,
            'an entry no tree can resolve may appear later, and no key here would notice');
    } finally {
        rmDir(dir);
    }
});

test('a payload whose library does not export queuePosition renders the stored index unchanged', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-noqp-'));
    const dir = makeRepo();
    try {
        const entry = path.join(root, 'scripts');
        const hooksDir = path.join(root, 'hooks');
        fs.mkdirSync(entry, { recursive: true });
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.copyFileSync(WIDGET, path.join(entry, 'kit-goal-statusline.js'));
        // A copy of the real library with queuePosition dropped from its own
        // export list, which drives the "library does not export it" branch
        // without deleting the file the widget's lazy require reaches for.
        const libSrc = fs.readFileSync(GOAL_LIB, 'utf8');
        const stripped = libSrc.replace(/,\s*queuePosition\s*,/, ',');
        assert.notStrictEqual(stripped, libSrc, 'setup: the export list still named queuePosition to strip');
        fs.writeFileSync(path.join(hooksDir, 'kit-goal-lib.js'), stripped, 'utf8');

        // The archived-first-entry fixture, not a healthy queue: on a healthy
        // queue the derived path and the fallback path render the same
        // "Plans: 1/2", so an assertion there would pass whether or not the
        // export strip took effect. Here the two paths disagree (the derived
        // path corrects to "2/2 b_spec_v1 (stored 1)", the fallback stays on
        // the stored "1/2"), so the assertion below can only pass if the
        // fallback branch actually ran.
        archiveAt(dir, 'docs/plans/a_spec_v1.md', 'Complete');
        planAt(dir, 'docs/plans/b_spec_v1.md', 'In Progress');
        arm(dir, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0
        });
        const res = spawnSync(process.execPath, [path.join(entry, 'kit-goal-statusline.js')],
            { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} a_spec_v1 · Plans: 1/2');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

// A hooks directory whose kit-goal-lib.js re-exports the real library
// (everything readGoalState, planDocRoot, planText and planKeyMtime need to
// answer normally) with queuePosition alone replaced by a stub answering a
// fixed, possibly malformed, shape. Real GOAL_LIB is required by absolute
// path from the stub, so only queuePosition itself is under test.
function stubQueuePosition(hooksDir, posLiteral) {
    fs.writeFileSync(path.join(hooksDir, 'kit-goal-lib.js'), [
        "'use strict';",
        'const real = require(' + JSON.stringify(GOAL_LIB) + ');',
        'module.exports = Object.assign({}, real, {',
        '    queuePosition() { return ' + posLiteral + '; }',
        '});'
    ].join('\n') + '\n', 'utf8');
}

test('a queuePosition answer missing positional falls back to the stored index rather than dropping the segment', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-badpos-'));
    const dir = makeRepo();
    try {
        const entry = path.join(root, 'scripts');
        const hooksDir = path.join(root, 'hooks');
        fs.mkdirSync(entry, { recursive: true });
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.copyFileSync(WIDGET, path.join(entry, 'kit-goal-statusline.js'));
        // A shape carrying valid integers but no positional flag at all.
        // Taken at face value (the `else if` fallback only runs when
        // queuePositionFor answers null), pos.positional reads as undefined,
        // which is falsy, and the Plans segment is dropped in silence on a
        // queue this reader would otherwise call positional. The validation
        // must reject the shape and let the stored-index fallback answer
        // instead.
        stubQueuePosition(hooksDir,
            '{ index: 0, stored: 0, healed: 0, unresolvable: false, cause: null, finished: false }');

        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 0 });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        const res = spawnSync(process.execPath, [path.join(entry, 'kit-goal-statusline.js')],
            { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2) · Plans: 1/2',
            'the malformed answer is rejected and the stored index is shown, not dropped');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a queuePosition answer with a non-integer index falls back to the stored index rather than printing NaN', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-badpos2-'));
    const dir = makeRepo();
    try {
        const entry = path.join(root, 'scripts');
        const hooksDir = path.join(root, 'hooks');
        fs.mkdirSync(entry, { recursive: true });
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.copyFileSync(WIDGET, path.join(entry, 'kit-goal-statusline.js'));
        stubQueuePosition(hooksDir,
            '{ index: NaN, stored: 0, healed: 0, positional: true, unresolvable: false, cause: null, finished: false }');

        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 0 });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        const res = spawnSync(process.execPath, [path.join(entry, 'kit-goal-statusline.js')],
            { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2) · Plans: 1/2',
            'the malformed answer is rejected rather than printing "Plans: NaN/2"');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a queuePosition answer naming an entry past the end of the queue falls back to the stored index', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-badpos3-'));
    const dir = makeRepo();
    try {
        const entry = path.join(root, 'scripts');
        const hooksDir = path.join(root, 'hooks');
        fs.mkdirSync(entry, { recursive: true });
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.copyFileSync(WIDGET, path.join(entry, 'kit-goal-statusline.js'));
        // An integer index is not enough: the segment INDEXES the queue at it,
        // and a position past the end hands an undefined path to
        // path.basename, which throws and takes the whole line with it. So the
        // widget renders nothing at all, on a queue it has every input needed
        // to describe. The library clamps both positions into the queue by its
        // own contract; this reader validates the answer because that contract
        // is one it cannot verify from here.
        stubQueuePosition(hooksDir,
            '{ index: 5, stored: 0, healed: 5, positional: true, unresolvable: false, cause: null,'
            + ' finished: false, consulted: [] }');

        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 0 });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: 2. Second thing']);
        const res = spawnSync(process.execPath, [path.join(entry, 'kit-goal-statusline.js')],
            { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} widget_spec_v1 · Sections: 1/3 (Next §2) · Plans: 1/2',
            'an out-of-range position is rejected and the stored index answers, with the line intact');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('a foreign ## heading inside Sections of Work ends the block, as the contract says', () => {
    const progress = sectionProgress([
        '## Sections of Work',
        '### 1. First thing',
        '## Standing Brief Amendments',
        '### 2. Not a section any more',
        '## Chapters'
    ].join('\n'));
    assert.deepStrictEqual(progress, { done: 0, total: 1, pointer: '§1' });
});

test('the Next pointer reads the shapes plans actually use', () => {
    assert.strictEqual(pointerFrom('2. A checkpoint opened under a pending offer'), '§2');
    assert.strictEqual(pointerFrom('Section 4 (its redesign is in flight), then Sections 2 and 3'), '§4');
    assert.strictEqual(pointerFrom('Sections 1 and 4 are in review'), '§1');
    assert.strictEqual(pointerFrom('§3'), '§3');
    assert.strictEqual(pointerFrom('finishing-work'), 'finishing');
    assert.strictEqual(pointerFrom('the build-stamp refresh, then Section 6'), '');
});

test('the cwd comes from workspace.current_dir, then cwd, then the fallback', () => {
    assert.strictEqual(cwdFromInput('{"cwd":"C:\\\\a","workspace":{"current_dir":"C:\\\\b"}}', 'F'), 'C:\\b');
    assert.strictEqual(cwdFromInput('{"cwd":"C:\\\\a"}', 'F'), 'C:\\a');
    assert.strictEqual(cwdFromInput('', 'F'), 'F');
    assert.strictEqual(cwdFromInput('not json', 'F'), 'F');
});

test('run as a CLI, the widget reads the status-line JSON from stdin and prints the line with exit 0', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const res = spawnSync(process.execPath, [WIDGET], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)');
    } finally {
        rmDir(dir);
    }
});

// Count the reads fs.readFileSync takes for the duration of fn, which is what
// tells a path refused before the open from one whose open merely failed. The
// hazard these cases exist for is a read that never returns, so the property
// under test is that no open is attempted, not that the render came back empty.
function countingReads(fn) {
    // The widget requires the hooks library lazily, and Node's CommonJS loader
    // reads a module's source through this very function, so a cold cache would
    // charge one read to the require and every count below would be one high.
    // Warming the cache here is what makes each case independent of whatever ran
    // before it: run any one of them alone and the counts are the same.
    require(GOAL_LIB);
    const realReadFileSync = fs.readFileSync;
    let reads = 0;
    fs.readFileSync = function (...args) {
        reads += 1;
        return realReadFileSync.apply(fs, args);
    };
    try {
        return fn(() => reads);
    } finally {
        fs.readFileSync = realReadFileSync;
    }
}

test('a plan path that escapes the repo renders nothing rather than being read', () => {
    // The repo sits inside a directory this case owns, so the traversal target
    // is a path no other run shares and the cleanup removes only what was made
    // here. A fixed name under the system temp directory would be neither.
    const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-outer-'));
    const dir = fs.mkdtempSync(path.join(outer, 'repo-'));
    fs.mkdirSync(path.join(dir, '.kit'));
    fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
    try {
        // The traversal resolves to a real file one directory above the repo,
        // so a reader that joined the stored value onto cwd would open it. The
        // shared reader re-validates the path instead, and a state whose plan
        // fails that check is malformed: no armed goal, nothing rendered.
        fs.writeFileSync(path.join(outer, 'outside.md'), '## Sections of Work\n\n### 1. A\n', 'utf8');
        arm(dir, { plan: '../outside.md' });
        countingReads((reads) => {
            assert.strictEqual(render(dir), '', 'an escaping plan path arms nothing');
            assert.strictEqual(reads(), 1, 'only the goal-state file itself is read');
        });
    } finally {
        rmDir(outer);
    }
});

test('a non-regular goal-state path renders nothing without being opened', () => {
    const dir = makeRepo();
    try {
        // A directory is the kind this box can stage. A FIFO, the kind that
        // would block the widget process the harness respawns at every status
        // line refresh, cannot be created from Node on any platform, and both
        // fail the same isFile() branch.
        fs.rmSync(path.join(dir, '.kit', 'goal-state.json'), { force: true });
        fs.mkdirSync(path.join(dir, '.kit', 'goal-state.json'), { recursive: true });
        countingReads((reads) => {
            assert.strictEqual(render(dir), '');
            assert.strictEqual(reads(), 0, 'the goal-state path is refused before any open');
        });
    } finally {
        rmDir(dir);
    }
});

test('a non-regular or oversized plan doc drops the Sections segment without being read whole', () => {
    const dir = makeRepo();
    try {
        arm(dir, { plan: PLAN_REL });
        fs.mkdirSync(path.join(dir, PLAN_REL), { recursive: true });
        countingReads((reads) => {
            assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1', 'the Sections segment is dropped');
            assert.strictEqual(reads(), 1, 'only the goal-state file is read; the plan path is refused');
        });
        fs.rmSync(path.join(dir, PLAN_REL), { recursive: true, force: true });

        // Past the widget's own cap: valid plan text, so only the cap can
        // refuse it.
        const body = '## Sections of Work\n\n### 1. First thing\n\n';
        fs.writeFileSync(path.join(dir, PLAN_REL), body + 'x'.repeat(1024 * 1024), 'utf8');
        assert.ok(fs.statSync(path.join(dir, PLAN_REL)).size > 1024 * 1024, 'setup: the doc is past the cap');
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1', 'an oversized plan doc drops the segment too');
    } finally {
        rmDir(dir);
    }
});

test('a plan value carrying terminal-hostile characters is printed sanitized', () => {
    const dir = makeRepo();
    try {
        // U+202E (right-to-left override) and U+007F (delete) are not control
        // characters by the stored-path rule, so they reach a renderer intact;
        // the first reorders everything after it in a terminal. The line is
        // printed to the operator's prompt, so what a terminal acts on is
        // removed: escape introducers, bidi controls and the common
        // zero-widths. That is a narrower class than the printable-ASCII rule
        // the reason strings and the event stream hold to, and deliberately so:
        // the case below this one is a plan name in another script rendering as
        // itself.
        const hostile = 'docs/plans/we\u202Elrp\u007F_spec_v1.md';
        arm(dir, { plan: hostile });
        const line = render(dir);
        assert.strictEqual(line, '\u{1F3AF} welrp_spec_v1');
        assert.ok(!/[^\x20-\x7E]/.test(line.slice(2)),
            'nothing outside printable ASCII reaches the terminal: ' + JSON.stringify(line));
    } finally {
        rmDir(dir);
    }
});

test('a plan doc cannot set the length of the status line through its Next pointer', () => {
    const dir = makeRepo();
    try {
        // The pointer is a capture from the plan doc's own Next line, and plan
        // docs are committed content, so a clone carries whatever this says. An
        // unbounded capture writes it verbatim to a terminal the launcher
        // spawns with inherited stdio, with nothing in between to truncate it.
        // A run past the bound yields no pointer at all: truncating it to four
        // digits would name a section nobody wrote, which reads as fact.
        arm(dir, { plan: PLAN_REL });
        plan(dir, ['### Chapter 1', 'Completed: 1. First thing', 'Next: ' + '9'.repeat(200000)]);
        const line = render(dir);
        assert.ok(line.length < 200, 'the line stays a status line: ' + line.length + ' characters');
        assert.strictEqual(line, '\u{1F3AF} widget_spec_v1 · Sections: 1/3');
    } finally {
        rmDir(dir);
    }
});

test('a plan value that sanitizes away renders a placeholder, and an ordinary non-ASCII name survives', () => {
    const dir = makeRepo();
    try {
        // The sanitizer removes what a terminal acts on, not everything a name
        // may hold: a plan named in any script must still read as itself, and a
        // name made only of removed characters must still leave a segment, or
        // the line renders a bare marker with a doubled separator behind it.
        arm(dir, { plan: 'docs/plans/plån_日本.md', queue: ['docs/plans/a.md', 'docs/plans/b.md'], queueIndex: 0 });
        assert.strictEqual(render(dir), '\u{1F3AF} plån_日本',
            'an ordinary non-ASCII plan name renders as itself');

        arm(dir, { plan: 'docs/plans/\u202E\u200B.md' });
        assert.strictEqual(render(dir), '\u{1F3AF} (unprintable)',
            'a name that is nothing but removed characters still leaves a segment');
    } finally {
        rmDir(dir);
    }
});

test('a state whose queueIndex disagrees with its plan reads as the queue of one it normalizes to', () => {
    const dir = makeRepo();
    try {
        // The widget's header states this consequence, and the shared reader is
        // what produces it: a queue that does not carry the current plan at its
        // index is replaced by [plan], so the Plans segment has nothing to
        // report. Pinned here because it is operator-visible and no other case
        // stages a disagreeing state.
        arm(dir, { plan: PLAN_REL, queue: [PLAN_REL, 'docs/plans/other_spec_v1.md'], queueIndex: 1 });
        plan(dir, []);
        assert.strictEqual(render(dir), '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)',
            'no Plans segment: the disagreeing queue normalized to one entry');
    } finally {
        rmDir(dir);
    }
});

// The wall-clock bound every performance case below is held to. Each of the
// three staged shapes runs in tens of milliseconds as the code stands (26 to 30
// ms, and about 1 ms for the whitespace heading) and in seconds without its fix:
// 4.6 s for the smallest of them, and 15 s for the whitespace heading at this
// fixture's size. The bound sits a hundred times above the fixed measurements,
// because this repository budgets for a box under contention and a margin of a
// few tens flakes there and reads as a regression, and still under the smallest
// unfixed measurement, which is what keeps the case able to fail.
const PARSE_BUDGET_MS = 3000;

// Time sectionProgress over one document, returning [progress, elapsedMs].
function timeProgress(text) {
    const started = Date.now();
    const progress = sectionProgress(text);
    return [progress, Date.now() - started];
}

test('the section count stays linear when every section title is distinct', () => {
    // completes() was asked once per (chapter, section) pair, so a doc just
    // under the read cap drove hundreds of millions of iterations and seconds of
    // CPU per refresh. The index makes each Completed line two lookups.
    // Pair-by-pair, this document takes about 4.6 s here; indexed it is about
    // 30 ms.
    const count = 20000;
    const sections = [];
    const chapters = ['## Chapters'];
    for (let i = 1; i <= count; i += 1) {
        sections.push('### ' + i + '. Section ' + i);
        chapters.push('### Chapter ' + i, 'Completed: ' + i + '. Section ' + i, 'Next: ' + (i + 1) + '. Section');
    }
    const [progress, elapsed] = timeProgress(['## Sections of Work'].concat(sections, chapters).join('\n'));
    assert.strictEqual(progress.done, count, 'the count is unchanged by the indexing');
    assert.strictEqual(progress.total, count);
    assert.ok(elapsed < PARSE_BUDGET_MS, count + ' distinct titles took ' + elapsed + ' ms');
});

test('the section count stays linear when every section shares one title', () => {
    // The shape the index alone does not close: one title mapping to N numbers,
    // walked again for every Completed line naming it, which is the same product
    // by another route. A document of 45,000 identically titled sections and
    // 11,000 chapters sits at about 1.02 MB, inside the 1 MB-plus-a-little the
    // reader will hand over, and takes seconds that way; with the numbers
    // consumed on first use it is about 26 ms. The fixture is the attack rather
    // than the average: distinct titles never reach this path at all.
    const sections = [];
    const chapters = ['## Chapters'];
    for (let i = 1; i <= 45000; i += 1) sections.push('### ' + i + '. T');
    for (let i = 1; i <= 11000; i += 1) chapters.push('### Chapter ' + i, 'Completed: T', 'Next: 1. T');
    const text = ['## Sections of Work'].concat(sections, chapters).join('\n');
    // Against the reader's own constant, not a multiple of it: a fixture between
    // the two numbers passes a loose guard while planText refuses the document
    // outright, and the case would then time a doc the widget never parses.
    assert.ok(Buffer.byteLength(text) < PLAN_MAX_BYTES,
        'setup: the doc is the size of one the reader hands over: ' + Buffer.byteLength(text));
    const [progress, elapsed] = timeProgress(text);
    assert.strictEqual(progress.done, 45000, 'every section with that title registers, exactly once');
    assert.strictEqual(progress.total, 45000);
    assert.ok(elapsed < PARSE_BUDGET_MS, '45000 sections sharing one title took ' + elapsed + ' ms');
});

test('a section heading of runaway whitespace does not make the parse superlinear', () => {
    // A lazy title capture with a trailing whitespace class re-scans the rest of
    // the line at every expansion, so a heading shaped '### 1. x<run>y' is
    // quadratic in its own length: about 15 s at 200 KB, and minutes at the 1 MB
    // cap, which is one line of one committed file. Captured greedily and
    // trimmed in JS it is about 1 ms.
    const run = ' '.repeat(200 * 1024);
    const text = [
        '## Sections of Work',
        '### 1. x' + run + 'y',
        '## Chapters',
        '### Chapter 1',
        'Completed: 1. z',
        'Next: 2. y'
    ].join('\n');
    const [progress, elapsed] = timeProgress(text);
    assert.strictEqual(progress.total, 1, 'the heading still parses as one section');
    assert.strictEqual(progress.done, 1, 'and its Completed line still registers it');
    assert.ok(elapsed < PARSE_BUDGET_MS, 'a 200 KB whitespace heading took ' + elapsed + ' ms');
});

test('a section heading whose title is only whitespace is not a section', () => {
    // Greedy-plus-trim can produce an empty title where the lazy capture simply
    // failed to match, so the emptiness is refused explicitly rather than
    // indexed as a section with no name.
    const progress = sectionProgress([
        '## Sections of Work',
        '### 1.    ',
        '### 2. Real one',
        '## Chapters'
    ].join('\n'));
    assert.deepStrictEqual(progress, { done: 0, total: 1, pointer: '§2' },
        'only the titled heading counts, and the pointer names it');
});

test('a status-line host that closed the pipe gets silence, not an EPIPE stack trace', () => {
    const dir = makeRepo();
    try {
        // The other way out of this process. render can be perfectly successful
        // and the write still throw: a host that has closed the pipe makes
        // process.stdout.write raise EPIPE, and an escaping EPIPE is a stack
        // trace on the operator's prompt and a nonzero exit, which is exactly
        // what the guard around render exists to prevent. A preload stages the
        // throw, since a genuinely closed pipe cannot be staged from here
        // without racing the child's own startup.
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-epipe-'));
        const shim = path.join(shimDir, 'closed-pipe.js');
        fs.writeFileSync(shim, [
            "'use strict';",
            'process.stdout.write = function () {',
            "    const err = new Error('EPIPE: broken pipe, write');",
            "    err.code = 'EPIPE';",
            '    throw err;',
            '};'
        ].join('\n') + '\n', 'utf8');
        try {
            const res = spawnSync(process.execPath, [WIDGET], {
                input: JSON.stringify({ cwd: dir }),
                encoding: 'utf8',
                env: { ...process.env, NODE_OPTIONS: '--require "' + shim.replace(/\\/g, '/') + '"' }
            });
            assert.strictEqual(res.status, 0, 'exit 0 even when the write throws');
            assert.strictEqual(res.stderr, '', 'and no stack trace on stderr: ' + res.stderr);
        } finally {
            rmDir(shimDir);
        }
    } finally {
        rmDir(dir);
    }
});

test('a throw inside render leaves the status line blank rather than printing a stack trace', () => {
    const dir = makeRepo();
    try {
        // The launcher inherits this process's stdio and propagates its exit
        // code, so anything escaping render reaches the operator's prompt. A
        // goal-state file whose plan is a string but whose queue is a getter
        // that throws is not reachable from disk; the CLI stands in for any
        // future throw by making the module itself unloadable, which render
        // reaches through its lazy require.
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-broken-'));
        fs.mkdirSync(path.join(broken, 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(broken, 'hooks'), { recursive: true });
        fs.copyFileSync(WIDGET, path.join(broken, 'scripts', 'kit-goal-statusline.js'));
        fs.writeFileSync(path.join(broken, 'hooks', 'kit-goal-lib.js'),
            'module.exports = { get readGoal() { throw new Error("boom"); } };\n', 'utf8');
        try {
            const res = spawnSync(process.execPath, [path.join(broken, 'scripts', 'kit-goal-statusline.js')],
                { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
            assert.strictEqual(res.status, 0, 'exit 0 even when the read throws');
            assert.strictEqual(res.stdout, '', 'nothing on stdout');
            assert.strictEqual(res.stderr, '', 'and no stack trace on stderr: ' + res.stderr);
        } finally {
            rmDir(broken);
        }
    } finally {
        rmDir(dir);
    }
});

test('a payload without the hooks library renders nothing rather than crashing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-plugins-'));
    const dir = makeRepo();
    try {
        // The widget reads the goal state through the hooks library. A payload
        // that carries the scripts without the hooks directory is a broken
        // install, and the status line goes blank instead of writing a stack
        // trace into the operator's prompt.
        const entry = path.join(root, 'scripts');
        fs.mkdirSync(entry, { recursive: true });
        fs.copyFileSync(WIDGET, path.join(entry, 'kit-goal-statusline.js'));
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        const res = spawnSync(process.execPath, [path.join(entry, 'kit-goal-statusline.js')],
            { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '', 'no library, no line, no crash');
        assert.strictEqual(res.stderr, '', 'and nothing on stderr either: ' + res.stderr);
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

test('the launcher runs the widget from the payload memq-shim resolves, passing stdin through', () => {
    // A fake plugins root with a manifest pointing at a cache entry that
    // holds both scripts, the same shape memq-shim.test.js builds.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-statusline-plugins-'));
    const dir = makeRepo();
    try {
        const entry = path.join(root, 'cache', 'applefeld', 'claude-kit', 'v1');
        fs.mkdirSync(path.join(entry, 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(entry, 'hooks'), { recursive: true });
        fs.writeFileSync(path.join(entry, 'scripts', 'memq.js'), '', 'utf8');
        fs.copyFileSync(WIDGET, path.join(entry, 'scripts', 'kit-goal-statusline.js'));
        // The payload carries the hooks library beside the scripts, which is
        // where the widget reads the goal state from; a payload without it is
        // the degraded case 'a payload without the hooks library' covers.
        fs.copyFileSync(GOAL_LIB, path.join(entry, 'hooks', 'kit-goal-lib.js'));
        fs.writeFileSync(path.join(root, 'installed_plugins.json'), JSON.stringify({
            version: 2,
            plugins: { 'claude-kit@applefeld': [{ scope: 'user', installPath: entry, version: 'v1' }] }
        }), 'utf8');
        arm(dir, { plan: PLAN_REL });
        plan(dir, []);
        // The shim honors the root override only with its second signal set;
        // see pluginsRoot in memq-shim.js.
        const env = Object.assign({}, process.env, { KIT_PLUGINS_ROOT: root, KIT_PLUGINS_ROOT_ALLOW_CODE: '1' });
        const res = spawnSync(process.execPath, [LAUNCHER], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8', env });
        assert.strictEqual(res.status, 0, res.stderr);
        assert.strictEqual(res.stdout, '\u{1F3AF} widget_spec_v1 · Sections: 0/3 (Next §1)');

        // A payload from before the widget existed: blank, exit 0, so the
        // status line shows nothing rather than an error.
        fs.unlinkSync(path.join(entry, 'scripts', 'kit-goal-statusline.js'));
        const older = spawnSync(process.execPath, [LAUNCHER], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8', env });
        assert.strictEqual(older.status, 0, older.stderr);
        assert.strictEqual(older.stdout, '');
    } finally {
        rmDir(dir);
        rmDir(root);
    }
});

// The section's own acceptance criterion, over one fixture: this status-line
// widget, the SessionStart advisory (session-start.js) and `kit-goal.js
// status` must report the SAME position, in the defect state and in the
// healthy control. Each surface is asserted against its own literal
// elsewhere in this file and in session-start-goal.test.js and
// kit-goal-worktree.test.js; none of those pins the three against EACH
// OTHER, which is exactly the shape a mismatch between them could hide
// behind. This extracts the position each surface reports and compares them,
// reusing the two hook surfaces' own drivers (runHook from
// session-start-goal.test.js, runGoalCli from kit-goal-worktree.test.js)
// rather than inventing a third way to spawn either.
function runSessionStartHook(cwd) {
    return spawnSync(process.execPath, [SESSION_START_HOOK], {
        input: JSON.stringify({ cwd, session_id: 'ses-cross-surface-pin' }),
        encoding: 'utf8'
    });
}

function runGoalStatus(cwd) {
    return spawnSync(process.execPath, [GOAL_CLI, 'status'], { cwd, encoding: 'utf8' });
}

// The position "Plans: <i>/<n>" the widget's own line reports, or null when
// the line carries no Plans segment (a queue of one, where the acceptance
// criterion has nothing positional to compare).
function widgetPosition(line) {
    const m = /Plans: (\d+)\/(\d+)/.exec(line);
    return m ? { index: Number(m[1]), total: Number(m[2]) } : null;
}

// The position the SessionStart advisory's armed-goal notice reports. Both
// queueClause's branches (the plain sentence and the correction) share the
// substring "plan N of M in the armed queue", so one pattern reads either.
function advisoryPosition(stdout) {
    const context = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    const m = /plan (\d+) of (\d+) in the armed queue/.exec(context);
    return m ? { index: Number(m[1]), total: Number(m[2]) } : null;
}

// The position `kit-goal.js status`'s queue line reports: "queue: plan N of
// M, <plan>".
function statusPosition(stdout) {
    const m = /queue: plan (\d+) of (\d+),/.exec(stdout);
    return m ? { index: Number(m[1]), total: Number(m[2]) } : null;
}

// The same disagreement one screen down: `kit-goal.js status` prints its
// per-entry tokens from THIS working directory alone while the position line
// above them requires every tree to agree, so a worktree missing a plan the
// main checkout still holds prints [missing] under a position that counts the
// plan pending. The case lives beside the cross-surface pin above because it
// is the same subject, two readings of one queue that a reader has no way to
// part, and this file already drives `kit-goal.js status` for it.
function worktreeState() {
    return {
        plan: 'docs/plans/a_spec_v1.md',
        condition: 'wrong-tree token fixture',
        armedAt: '2026-08-16T00:00:00.000Z',
        boundSession: null,
        boundTranscript: null,
        queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
        queueIndex: 0,
        history: []
    };
}

test('`kit-goal.js status` ties a [missing] token to the position that still counts the plan pending', () => {
    const { main, tree } = makeWorktree();
    try {
        // Present on main, unmerged here: the entry is absent in this working
        // directory and live in the checkout the goal state lives in, so the
        // agreement rule reports it pending while this tree's own token reads
        // missing. Unlabelled, the two lines read as a contradiction.
        planAt(main, 'docs/plans/a_spec_v1.md', 'In Progress');
        planAt(main, 'docs/plans/b_spec_v1.md', 'In Progress');
        planAt(tree, 'docs/plans/b_spec_v1.md', 'In Progress');
        arm(main, worktreeState());

        const res = runGoalStatus(tree);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /queue: plan 1 of 2, docs\/plans\/a_spec_v1\.md/,
            'setup: the position still counts the plan pending: ' + res.stdout);
        assert.match(res.stdout, /> docs\/plans\/a_spec_v1\.md \[missing\]/,
            'setup: this tree reads the entry as missing: ' + res.stdout);
        assert.match(res.stdout, /still present in the main checkout this goal state lives in/,
            'the two readings on one screen are tied together');
        // The mirror direction's note names an archived copy filed in this
        // tree, which is not this fixture's shape (nothing here is archived),
        // so it must not appear beside this one.
        assert.doesNotMatch(res.stdout, /holds no readable copy at either path/,
            'this tree has archived nothing, so the mirror direction\'s note must not print');
    } finally {
        rmDir(main);
        rmDir(tree);
    }
});

test('a plan archived-terminal in this worktree alone ties its [missing] token to the pending position', () => {
    const { main, tree } = makeWorktree();
    try {
        // The mirror of the case above: this working directory's own
        // docs/archive/ copy reads terminal, while the main checkout the goal
        // state lives in holds no readable copy at either path (never armed
        // there, never archived there). The position walk still requires
        // every tree to agree, so it reports the entry pending rather than
        // complete. The token above it reads [missing] because
        // planPathState(cwd, plan) finds docs/plans/ gone here too; that
        // token never opens docs/archive/ at all, so it cannot be read as the
        // note's cause, only as one half of the on-screen pairing the note
        // explains. The leash is not held pending by any of this: it reads a
        // plan gone in both trees as archived on its own, at the bound
        // session's next clean stop, independent of this report.
        archiveAt(tree, 'docs/plans/a_spec_v1.md', 'Complete');
        planAt(main, 'docs/plans/b_spec_v1.md', 'In Progress');
        planAt(tree, 'docs/plans/b_spec_v1.md', 'In Progress');
        arm(main, worktreeState());

        const res = runGoalStatus(tree);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /queue: plan 1 of 2, docs\/plans\/a_spec_v1\.md/,
            'setup: the position still counts the plan pending: ' + res.stdout);
        assert.match(res.stdout, /> docs\/plans\/a_spec_v1\.md \[missing\]/,
            'setup: this tree reads the entry as missing: ' + res.stdout);
        assert.match(res.stdout, /holds no readable copy at either path/,
            'the archived-here-only shape and the way forward are both named');
        // The two directions must not satisfy each other's fixture: this one
        // has nothing present in main, so the present-in-main wording must
        // not appear.
        assert.doesNotMatch(res.stdout, /still present in the main checkout this goal state lives in/,
            'nothing is present in the main checkout, so the other direction\'s note must not print');
    } finally {
        rmDir(main);
        rmDir(tree);
    }
});

test('a single checkout prints neither tree-split note, though the plans-path token still reads missing', () => {
    const dir = makeRepo();
    try {
        // No worktree at all, so goalRoot(cwd) === cwd and neither note's
        // root !== cwd gate ever opens: this pins that on-screen silence, not
        // an unopened archive, since the position walk reads this tree's own
        // docs/archive/ regardless of that gate (treeEntryState has no
        // worktree condition of its own). The archived copy here is left
        // unfinished (not terminal) on purpose: a terminal one is
        // unconstructible at the current entry in a single tree, because a
        // lone 'complete' vote either advances the walk past this entry (the
        // window then starts elsewhere) or reports the whole queue finished,
        // and neither shape is "pending at the current entry" for either
        // note's guard to reach.
        archiveAt(dir, 'docs/plans/a_spec_v1.md', 'In Progress');
        planAt(dir, 'docs/plans/b_spec_v1.md', 'In Progress');
        arm(dir, {
            plan: 'docs/plans/a_spec_v1.md',
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0
        });

        const res = runGoalStatus(dir);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /queue: plan 1 of 2, docs\/plans\/a_spec_v1\.md/,
            'setup: the position stays on this entry: ' + res.stdout);
        assert.match(res.stdout, /> docs\/plans\/a_spec_v1\.md \[missing\]/,
            'setup: the plans-path token reads missing: ' + res.stdout);
        assert.doesNotMatch(res.stdout, /still present in the main checkout this goal state lives in/);
        assert.doesNotMatch(res.stdout, /holds no readable copy at either path/);
    } finally {
        rmDir(dir);
    }
});

test('a queue entry missing from both trees keeps the plain unresolvable wording', () => {
    const { main, tree } = makeWorktree();
    try {
        // The control that keeps the note from being unconditional: with the
        // doc absent in BOTH trees there is no second reading to explain, the
        // entry is unresolvable rather than pending, and the existing
        // unresolvable clause is the whole story.
        planAt(main, 'docs/plans/b_spec_v1.md', 'In Progress');
        planAt(tree, 'docs/plans/b_spec_v1.md', 'In Progress');
        arm(main, worktreeState());

        const res = runGoalStatus(tree);
        assert.strictEqual(res.status, 0, res.stderr);
        assert.match(res.stdout, /unresolvable: the doc for this plan is in neither/);
        assert.doesNotMatch(res.stdout, /still present in the main checkout this goal state lives in/,
            'nothing is present in the main checkout, so nothing claims it is');
    } finally {
        rmDir(main);
        rmDir(tree);
    }
});

test('the widget, the SessionStart advisory and `kit-goal.js status` agree on the queue position, defect and healthy alike', () => {
    // The defect state: queueIndex frozen on a_spec_v1, which is Complete and
    // archived, while b_spec_v1 is the plan actually being worked. Every
    // surface here reads the plan docs and must correct to "plan 2 of 2".
    const defect = makeRepo();
    try {
        archiveAt(defect, 'docs/plans/a_spec_v1.md', 'Complete');
        planAt(defect, 'docs/plans/b_spec_v1.md', 'In Progress');
        const state = {
            plan: 'docs/plans/a_spec_v1.md',
            condition: 'cross-surface pin fixture',
            armedAt: '2026-08-16T00:00:00.000Z',
            boundSession: null,
            boundTranscript: null,
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0,
            history: []
        };
        arm(defect, state);

        const widgetLine = render(defect);
        const advisory = runSessionStartHook(defect);
        const status = runGoalStatus(defect);
        assert.strictEqual(advisory.status, 0, advisory.stderr);
        assert.strictEqual(status.status, 0, status.stderr);

        const wp = widgetPosition(widgetLine);
        const ap = advisoryPosition(advisory.stdout);
        const sp = statusPosition(status.stdout);
        assert.notStrictEqual(wp, null, 'setup: the widget line carries a Plans segment: ' + widgetLine);
        assert.notStrictEqual(ap, null, 'setup: the advisory names a queue position: ' + advisory.stdout);
        assert.notStrictEqual(sp, null, 'setup: the status report names a queue position: ' + status.stdout);
        assert.deepStrictEqual(wp, { index: 2, total: 2 }, 'the widget corrects to plan 2 of 2: ' + widgetLine);
        assert.deepStrictEqual(ap, wp, 'the advisory must report the position the widget reports');
        assert.deepStrictEqual(sp, wp, '`kit-goal.js status` must report the position the widget reports');
    } finally {
        rmDir(defect);
    }

    // The healthy control: the stored index and the derived position already
    // agree, so every surface reports "plan 1 of 2" without correcting
    // anything.
    const healthy = makeRepo();
    try {
        planAt(healthy, 'docs/plans/a_spec_v1.md', 'In Progress');
        planAt(healthy, 'docs/plans/b_spec_v1.md', 'In Progress');
        const state = {
            plan: 'docs/plans/a_spec_v1.md',
            condition: 'cross-surface pin fixture',
            armedAt: '2026-08-16T00:00:00.000Z',
            boundSession: null,
            boundTranscript: null,
            queue: ['docs/plans/a_spec_v1.md', 'docs/plans/b_spec_v1.md'],
            queueIndex: 0,
            history: []
        };
        arm(healthy, state);

        const widgetLine = render(healthy);
        const advisory = runSessionStartHook(healthy);
        const status = runGoalStatus(healthy);
        assert.strictEqual(advisory.status, 0, advisory.stderr);
        assert.strictEqual(status.status, 0, status.stderr);

        const wp = widgetPosition(widgetLine);
        const ap = advisoryPosition(advisory.stdout);
        const sp = statusPosition(status.stdout);
        assert.notStrictEqual(wp, null, 'setup: the widget line carries a Plans segment: ' + widgetLine);
        assert.notStrictEqual(ap, null, 'setup: the advisory names a queue position: ' + advisory.stdout);
        assert.notStrictEqual(sp, null, 'setup: the status report names a queue position: ' + status.stdout);
        assert.deepStrictEqual(wp, { index: 1, total: 2 }, 'the healthy queue needs no correction: ' + widgetLine);
        assert.deepStrictEqual(ap, wp, 'the advisory must report the position the widget reports');
        assert.deepStrictEqual(sp, wp, '`kit-goal.js status` must report the position the widget reports');
    } finally {
        rmDir(healthy);
    }
});
