// Tests for the memory store's sync repo: plugins/claude-kit/doctor/
// install-memory-sync.ps1 and the "Memory sync" section of doctor.ps1.
//
// Node's built-in test runner, no framework, no install (Node v24). Every
// case builds its own fake store root under a short temp directory and passes
// it explicitly, so nothing here reads or writes the real ~/.claude, which
// holds .credentials.json, settings.json, history.jsonl, and every session
// transcript. process.env is spread, never rebuilt, so children keep the
// Windows `Path` key. The cases spawn Windows PowerShell and are skipped
// off Windows, where the doctor itself does not run.
//
// The allowlist is the only barrier between syncing memories and publishing
// credentials, so the suite locks both of its directions. Negative space:
// each sensitive root file and a sampled session transcript proven ignored by
// check-ignore, nothing outside the memory tiers reachable by an add, no
// non-memory path tracked (a tracked file bypasses gitignore entirely, so a
// forced add would be invisible to the other two probes), and no non-memory
// path in committed history (a blob stays reachable after its path is
// untracked, so the first three probes can all read clean over a committed
// credential). Positive space: the planted memory files of every tier, live
// and archived, across two project stores, proven to be exactly what the repo
// tracks and what a fresh add stages, because an over-excluding allowlist
// stages nothing and would read as a clean pass against the negative probes
// alone.
//
// Nothing here runs the real doctor with -Fix: its execution-policy and user
// PATH repairs reach user-scope machine state that a USERPROFILE redirect does
// not cover. The doctor is exercised in check mode, which writes nothing, and
// the repair itself is exercised through Install-MemorySyncRepo against a
// sandbox store root.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const PLUGIN_ROOT = path.join(REPO, 'plugins', 'claude-kit');
const INSTALLER = path.join(PLUGIN_ROOT, 'doctor', 'install-memory-sync.ps1');
const DOCTOR = path.join(PLUGIN_ROOT, 'doctor', 'doctor.ps1');
const isWin = process.platform === 'win32';

const PROJECT_A = 'D--fake-project-alpha';
const PROJECT_B = 'D--fake-project-beta';

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function pwsh(script, extraEnv) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', env: { ...process.env, ...(extraEnv || {}) } });
}

function write(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
}

// A fake ~/.claude: the sensitive root files and a session transcript that
// must never sync, a non-memory sibling inside a project directory (the only
// thing that exercises the projects/<store>/* exclusion), and memory files in
// every tier the allowlist admits. memory-operator/ is absent by default,
// which is the real state of a store before that tier exists.
function makeStore(options) {
    const opts = options || {};
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'memsync-'));
    const store = path.join(home, '.claude');
    write(path.join(store, '.credentials.json'), '{"token":"secret"}\n');
    write(path.join(store, 'settings.json'), '{"model":"opus"}\n');
    write(path.join(store, 'history.jsonl'), '{"display":"a prompt"}\n');
    write(path.join(store, 'projects', PROJECT_A, 'a1b2c3d4-session.jsonl'), '{"type":"user"}\n');
    write(path.join(store, 'projects', PROJECT_A, 'todos', 'todo.json'), '[]\n');
    write(path.join(store, 'shell-snapshots', 'snapshot.sh'), 'export SECRET=1\n');

    // Every form memq writes into a tier: memory bodies and both indexes as
    // .md, the journals as .jsonl, and the decay pass's extension-less
    // completion stamp. The run-scoped pending tier sits under the project
    // memory directory and rides the same re-include.
    const allowed = [
        '.gitattributes',
        '.gitignore',
        'memory-types/archive/retired-type.md',
        'memory-types/tag-registry.md',
        'projects/' + PROJECT_A + '/memory/MEMORY.md',
        'projects/' + PROJECT_A + '/memory/outcomes.jsonl',
        'projects/' + PROJECT_A + '/memory/usage.jsonl',
        'projects/' + PROJECT_A + '/memory/decay-stamp',
        'projects/' + PROJECT_A + '/memory/archive/old-fact.md',
        'projects/' + PROJECT_A + '/memory/pending/run-fact.md',
        'projects/' + PROJECT_A + '/memory/a-fact.md',
        'projects/' + PROJECT_B + '/memory/MEMORY.md'
    ];
    // Distinct bodies throughout: git stores content once and names an object
    // by a single path, so two byte-identical files would leave the second
    // path out of the object walk the history probe reads.
    write(path.join(store, 'memory-types', 'tag-registry.md'), '# tags\n');
    write(path.join(store, 'memory-types', 'archive', 'retired-type.md'), '# retired\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'MEMORY.md'), '# Memory Index\n\n- alpha\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'a-fact.md'), '# a fact\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'outcomes.jsonl'), '{"key":"k"}\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'usage.jsonl'), '{"name":"a-fact"}\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'decay-stamp'), '');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'archive', 'old-fact.md'), '# old\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'pending', 'run-fact.md'), '# run\n');
    write(path.join(store, 'projects', PROJECT_B, 'memory', 'MEMORY.md'), '# Memory Index\n\n- beta\n');

    // Transient per-machine state inside allowed directories: locks, the
    // rename a stale-lock break leaves behind, the single-generation backup,
    // and a rewrite temporary. The last two names are the ones an exclusion
    // pattern list misses, which is why the re-include is by file form.
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'decay.lock'), '1234\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'decay.lock.stale.1234'), '1234\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'a-fact.md.bak'), '# a fact\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'a-fact.md.tmp.4242'), '# a fact\n');
    write(path.join(store, 'projects', PROJECT_A, 'memory', 'scratch.json'), '{}\n');
    write(path.join(store, 'memory-types', 'store.lock'), '1234\n');
    write(path.join(store, 'memory-types', 'notes.txt'), 'notes\n');

    if (opts.operatorTier) {
        write(path.join(store, 'memory-operator', 'MEMORY.md'), '# Memory Index\n\n- operator\n');
        write(path.join(store, 'memory-operator', 'operator-fact.md'), '# operator\n');
        write(path.join(store, 'memory-operator', 'archive', 'retired-operator.md'), '# retired operator fact\n');
        write(path.join(store, 'memory-operator', 'usage.jsonl'), '{"name":"operator-fact"}\n');
        write(path.join(store, 'memory-operator', 'store.lock'), '1234\n');
        write(path.join(store, 'memory-operator', 'store.lock.stale.99'), '1234\n');
        allowed.push('memory-operator/MEMORY.md',
            'memory-operator/archive/retired-operator.md',
            'memory-operator/usage.jsonl',
            'memory-operator/operator-fact.md');
    }
    return { home, store, allowed: allowed.sort() };
}

function rmDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // Best-effort cleanup; leaving a temp dir behind never fails the test.
    }
}

// Get-MemorySyncStatus's answer as JSON. Arrays are re-wrapped because a
// one-element PowerShell array converts to a scalar otherwise.
function statusOf(store) {
    const script = '. ' + q(INSTALLER) + '; '
        + '$s = Get-MemorySyncStatus -StoreRoot ' + q(store) + '; '
        + 'foreach ($k in @("Probed","NotIgnored","Unexpected","Tracked","HistoryPaths","Notes")) { $s[$k] = @($s[$k]) }; '
        + '$s | ConvertTo-Json -Compress -Depth 4 | Write-Output';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    return JSON.parse(res.stdout);
}

function installRepo(store) {
    const script = '. ' + q(INSTALLER) + '; '
        + '$r = Install-MemorySyncRepo -StoreRoot ' + q(store) + '; '
        + '$r.Notes | Write-Output; if (-not $r.Ok) { exit 1 }';
    return pwsh(script);
}

function git(store, args) {
    return spawnSync('git', ['-C', store].concat(args), { encoding: 'utf8', env: { ...process.env } });
}

// core.quotePath=false so a path holding non-ASCII bytes reads as itself
// rather than octal-escaped inside double quotes, matching what the index
// probe asks git for.
function trackedPaths(store) {
    const res = git(store, ['-c', 'core.quotePath=false', 'ls-files']);
    assert.strictEqual(res.status, 0, res.stderr);
    return res.stdout.split(/\r?\n/).filter((l) => l.trim() !== '').sort();
}

// What `git add -A` would stage right now, as repo-relative paths.
function dryRunPaths(store) {
    const res = git(store, ['add', '-A', '--dry-run']);
    assert.strictEqual(res.status, 0, res.stderr);
    return res.stdout.split(/\r?\n/)
        .map((l) => (l.match(/^\s*\w+\s+'(.+)'\s*$/) || [])[1])
        .filter(Boolean)
        .sort();
}

// 0 ignored, 1 not ignored, anything else git failing to answer.
function isIgnored(store, rel) {
    const res = git(store, ['check-ignore', '-q', '--no-index', '--', rel]);
    assert.ok(res.status === 0 || res.status === 1, 'check-ignore errored: ' + res.stderr);
    return res.status === 0;
}

// Every blob path reachable from any ref, which is the surface no amount of
// untracking clears. The blob filter drops the tree entry rev-list otherwise
// emits for each directory.
function historyPaths(store) {
    const res = git(store, ['rev-list', '--objects', '--all', '--filter=object:type=blob']);
    assert.strictEqual(res.status, 0, res.stderr);
    return [...new Set(res.stdout.split(/\r?\n/)
        .map((l) => l.trimEnd())
        .map((l) => (l.indexOf(' ') < 0 ? '' : l.slice(l.indexOf(' ') + 1).trim()))
        .filter(Boolean))].sort();
}

// The merge driver git resolves for a path, from `check-attr merge -- <path>`.
function mergeAttr(store, rel) {
    const res = git(store, ['check-attr', 'merge', '--', rel]);
    assert.strictEqual(res.status, 0, res.stderr);
    return (res.stdout.trim().match(/:\s*merge:\s*(\S+)$/) || [])[1];
}

// The doctor's own -Fix gate, evaluated against a given status. The two
// assignments are lifted out of doctor.ps1 by the PowerShell parser and run as
// written, because reaching them through the script itself would mean invoking
// a real `doctor.ps1 -Fix`, whose execution-policy and user-PATH repairs touch
// user-scope machine state no USERPROFILE redirect covers.
function doctorFixGate(statusFields) {
    const fields = Object.entries(statusFields)
        .map(([k, v]) => k + ' = ' + (typeof v === 'boolean' ? (v ? '$true' : '$false') : q(v)))
        .join('; ');
    const script = '$errs = $null; $tokens = $null; '
        + '$ast = [System.Management.Automation.Language.Parser]::ParseFile(' + q(DOCTOR)
        + ', [ref]$tokens, [ref]$errs); '
        + '$stmts = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] '
        + "-and ($n.Left.Extent.Text -eq '$syncAdoptable' -or $n.Left.Extent.Text -eq '$syncNeedsWork') }, $true)); "
        + 'if ($stmts.Count -ne 2) { Write-Output ("expected 2 gate assignments, found " + $stmts.Count); exit 1 }; '
        + '$syncStatus = @{ ' + fields + ' }; $syncForeign = @(); '
        + 'foreach ($s in $stmts) { Invoke-Expression $s.Extent.Text }; '
        + '@{ Adoptable = [bool]$syncAdoptable; NeedsWork = [bool]$syncNeedsWork } | ConvertTo-Json -Compress';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    return JSON.parse(res.stdout);
}

function ownMarker(store) {
    const res = git(store, ['config', '--local', '--get', 'claudekit.memorysync']);
    return res.status === 0 ? res.stdout.trim() : null;
}

test('before -Fix the store is reported as not a repo, with no probe read as a pass', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        const status = statusOf(fake.store);
        assert.strictEqual(status.IsRepo, false);
        assert.strictEqual(status.IgnoreState, 'Missing');
        assert.strictEqual(status.AttrState, 'Missing');
        // The probes need a repo to run in, so the pre-fix state must report
        // them as not run rather than as an empty, clean answer.
        assert.strictEqual(status.ProbesRan, false);
        assert.deepStrictEqual(status.NotIgnored, []);
        assert.deepStrictEqual(status.Unexpected, []);
        assert.deepStrictEqual(status.Tracked, []);
        assert.deepStrictEqual(status.HistoryPaths, []);
    } finally {
        rmDir(fake.home);
    }
});

test('-Fix initializes the repo and tracks exactly the memory tiers, operator tier absent', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        const res = installRepo(fake.store);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        // Positive space: every planted memory file, in both project stores,
        // live and archived, plus the type tier. An over-excluding allowlist
        // would track fewer and still pass every negative probe below.
        assert.deepStrictEqual(trackedPaths(fake.store), fake.allowed);
        // The absent operator tier is an empty tier, not a failure.
        assert.ok(!fs.existsSync(path.join(fake.store, 'memory-operator')));
        const status = statusOf(fake.store);
        assert.strictEqual(status.IsRepo, true);
        assert.strictEqual(status.IgnoreState, 'Canonical');
        assert.strictEqual(status.AttrState, 'Canonical');
        assert.strictEqual(status.ProbesRan, true);
        assert.deepStrictEqual(status.NotIgnored, []);
        assert.deepStrictEqual(status.Unexpected, []);
        assert.deepStrictEqual(status.Tracked, []);
        // A clean repository's history probe is empty, and it read something:
        // the commit just made holds exactly the allowlisted paths.
        assert.deepStrictEqual(status.HistoryPaths, []);
        assert.deepStrictEqual(historyPaths(fake.store), fake.allowed);
        assert.deepStrictEqual(status.Notes, []);
        // The repository carries the ownership marker, which is what keeps it
        // repairable independently of any file in the worktree.
        assert.strictEqual(ownMarker(fake.store), 'true');
        // Four sensitive paths probed: the three root files and a sampled
        // session transcript from a real project directory.
        assert.strictEqual(status.Probed.length, 4);
        assert.ok(status.Probed.some((p) => p.startsWith('projects/' + PROJECT_A + '/')), status.Probed.join(','));
    } finally {
        rmDir(fake.home);
    }
});

test('the operator tier syncs when it exists', { skip: !isWin }, () => {
    const fake = makeStore({ operatorTier: true });
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        assert.deepStrictEqual(trackedPaths(fake.store), fake.allowed);
        assert.ok(isIgnored(fake.store, 'memory-operator/store.lock'));
    } finally {
        rmDir(fake.home);
    }
});

test('the sensitive root files and a session transcript are ignored, and an add reaches nothing outside the tiers', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        for (const rel of ['.credentials.json', 'settings.json', 'history.jsonl',
            'projects/' + PROJECT_A + '/a1b2c3d4-session.jsonl',
            'projects/' + PROJECT_A + '/todos/todo.json',
            'shell-snapshots/snapshot.sh']) {
            assert.ok(isIgnored(fake.store, rel), rel + ' must be ignored');
        }
        // Both directions of the dry run at once: newly planted memory files
        // in every tier are staged, and newly planted sensitive files are not.
        write(path.join(fake.store, '.credentials.json.new'), 'secret\n');
        write(path.join(fake.store, 'projects', PROJECT_A, 'another-session.jsonl'), '{}\n');
        write(path.join(fake.store, 'projects', PROJECT_A, 'memory', 'fresh.md'), '# fresh\n');
        write(path.join(fake.store, 'memory-types', 'fresh-type.md'), '# fresh\n');
        write(path.join(fake.store, 'memory-operator', 'fresh-operator.md'), '# fresh\n');
        assert.deepStrictEqual(dryRunPaths(fake.store), [
            'memory-operator/fresh-operator.md',
            'memory-types/fresh-type.md',
            'projects/' + PROJECT_A + '/memory/fresh.md'
        ]);
    } finally {
        rmDir(fake.home);
    }
});

test('inside an allowed directory only the memory file forms sync, everything else stays out', { skip: !isWin }, () => {
    const fake = makeStore({ operatorTier: true });
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // The re-include is positive (.md, .jsonl, decay-stamp), so a name no
        // exclusion pattern describes is still out. decay.lock.stale.<pid> is
        // the one a stale-lock break leaves behind, and it matches none of
        // *.lock, *.bak, or *.tmp.*.
        for (const rel of ['projects/' + PROJECT_A + '/memory/decay.lock',
            'projects/' + PROJECT_A + '/memory/decay.lock.stale.1234',
            'projects/' + PROJECT_A + '/memory/a-fact.md.bak',
            'projects/' + PROJECT_A + '/memory/a-fact.md.tmp.4242',
            'projects/' + PROJECT_A + '/memory/scratch.json',
            'memory-types/store.lock',
            'memory-types/notes.txt',
            'memory-operator/store.lock.stale.99']) {
            assert.ok(isIgnored(fake.store, rel), rel + ' must be ignored');
        }
        // And the forms memq does write are in, including the extension-less
        // decay stamp, whose exclusion would fail a clean machine's tracked
        // probe with no remedy but untracking a file the store needs.
        const tracked = trackedPaths(fake.store);
        assert.deepStrictEqual(tracked, fake.allowed);
        assert.ok(tracked.includes('projects/' + PROJECT_A + '/memory/decay-stamp'), tracked.join(','));
        assert.ok(!isIgnored(fake.store, 'projects/' + PROJECT_A + '/memory/decay-stamp'));
    } finally {
        rmDir(fake.home);
    }
});

test('the ignore file and the path predicate answer alike on transient-shaped names', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // foo.tmp.md carries an allowed extension and a transient shape. Git
        // resolves it by last match, so it is excluded; a predicate that
        // stopped at the allowed form would call it admitted and never flag it
        // once force-added. The directory cases are the same rule one level
        // up: the trailing patterns match any path component, and git cannot
        // re-include anything beneath a directory it has excluded, so a
        // predicate reading the leaf alone is more permissive than git and the
        // probes built on it would miss a real staged path.
        const cases = [
            ['projects/' + PROJECT_A + '/memory/foo.tmp.md', false],
            ['projects/' + PROJECT_A + '/memory/notes.bak', false],
            ['memory-types/foo.tmp.jsonl', false],
            ['memory-operator/foo.lock', false],
            ['projects/' + PROJECT_A + '/memory/notes.bak/inner.md', false],
            ['projects/' + PROJECT_A + '/memory/x.tmp.d/inner.md', false],
            ['projects/' + PROJECT_A + '/memory/held.lock/inner.jsonl', false],
            ['memory-types/archive.bak/retired.md', false],
            ['memory-operator/scratch.tmp.1/fact.md', false],
            ['projects/' + PROJECT_A + '/memory/a-fact.md', true],
            ['projects/' + PROJECT_A + '/memory/archive/old-fact.md', true],
            ['projects/' + PROJECT_A + '/memory/outcomes.jsonl', true],
            ['projects/' + PROJECT_A + '/memory/decay-stamp', true]
        ];
        const script = '. ' + q(INSTALLER) + '; '
            + '@(' + cases.map(([rel]) => '(Test-MemorySyncPathAllowed -RelativePath ' + q(rel) + ')').join(', ')
            + ') | ConvertTo-Json -Compress';
        const res = pwsh(script);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.deepStrictEqual(JSON.parse(res.stdout), cases.map(([, allowed]) => allowed));
        // And git, asked the same question, agrees on every one of them.
        for (const [rel, allowed] of cases) {
            assert.strictEqual(isIgnored(fake.store, rel), !allowed, rel + ' must agree with the predicate');
        }
    } finally {
        rmDir(fake.home);
    }
});

test('a memory file whose name carries an accent is an ordinary tracked file, not a leak', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        // git prints such a path octal-escaped inside double quotes unless
        // told otherwise, and that rendering matches no allowlist rule. Read
        // naively it turns an ordinary memory file into a permanent FAIL whose
        // printed remedy names a literal that does not exist.
        write(path.join(fake.store, 'memory-types', 'café-notes.md'), '# cafe\n');
        assert.strictEqual(installRepo(fake.store).status, 0);
        const raw = git(fake.store, ['ls-files']);
        assert.match(raw.stdout, /"memory-types\/caf\\303\\251-notes\.md"/,
            'if git no longer quotes this path, the case proves nothing:\n' + raw.stdout);

        const status = statusOf(fake.store);
        assert.strictEqual(status.ProbesRan, true, status.Notes.join('\n'));
        assert.deepStrictEqual(status.Tracked, []);
        assert.deepStrictEqual(status.HistoryPaths, []);
        assert.deepStrictEqual(status.Unexpected, []);
        assert.ok(trackedPaths(fake.store).includes('memory-types/café-notes.md'));

        // And a second -Fix still commits, rather than refusing forever on a
        // path the index gate cannot read.
        write(path.join(fake.store, 'memory-types', 'another.md'), '# another\n');
        const again = installRepo(fake.store);
        assert.strictEqual(again.status, 0, again.stdout + again.stderr);
        assert.match(again.stdout, /Committed the memory tiers/);
    } finally {
        rmDir(fake.home);
    }
});

test('a probe that could not answer is named in the FAIL report, never read as a clean index', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // A drifted allowlist plus a repository git cannot fully read. The
        // FAIL is about the drift, and an empty leak list beneath it would
        // otherwise say "nothing is tracked" when nothing was read.
        const ignorePath = path.join(fake.store, '.gitignore');
        fs.writeFileSync(ignorePath, fs.readFileSync(ignorePath, 'utf8').replace('\n/*\n', '\n'), 'utf8');
        // A ref pointing at an object that is not there. rev-list --all
        // refuses to walk it, so the history probe alone cannot answer while
        // the other three still do.
        write(path.join(fake.store, '.git', 'refs', 'heads', 'bogus'),
            '0000000000000000000000000000000000000000\n');

        const status = statusOf(fake.store);
        assert.strictEqual(status.ProbesRan, false, JSON.stringify(status));
        assert.ok(status.Notes.length > 0);
        // Three of the four probes answered; the history probe is the one the
        // bad ref stops. A bare "unproven" would not say how much was checked.
        assert.strictEqual(status.ProbesAttempted, 4);
        assert.strictEqual(status.ProbesAnswered, 3);

        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /differs from the allowlist/, line.detail);
        assert.match(line.detail, /Only 3 of 4 direct probes could answer/, line.detail);
        assert.match(line.detail, /negative is unproven/, line.detail);
    } finally {
        rmDir(fake.home);
    }
});

test('an unanswerable probe over a canonical allowlist is a failure, not a warning', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // Everything on disk reads right and the repository is the doctor's
        // own; only the probes cannot answer. A warning here exits 0 under a
        // "Healthy with N warning(s)" summary, which is the wrong thing to
        // tell an operator deciding whether the store is safe to push.
        write(path.join(fake.store, '.git', 'refs', 'heads', 'bogus'),
            '0000000000000000000000000000000000000000\n');
        const status = statusOf(fake.store);
        assert.strictEqual(status.IgnoreState, 'Canonical');
        assert.strictEqual(status.AttrState, 'Canonical');
        assert.strictEqual(status.ProbesRan, false);
        assert.deepStrictEqual(status.Tracked, []);

        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /Only 3 of 4 direct probes could answer/, line.detail);
        assert.ok(!/every probe that ran came back clean/.test(line.detail), line.detail);
    } finally {
        rmDir(fake.home);
    }
});

test('the journals merge as line unions in every tier, live and archived', { skip: !isWin }, () => {
    const fake = makeStore({ operatorTier: true });
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // Two machines that both appended since the last sync hold no
        // conflicting edit, only two sets of new lines, so the attribute is
        // what keeps a routine append from becoming a merge conflict.
        for (const rel of ['projects/' + PROJECT_A + '/memory/outcomes.jsonl',
            'projects/' + PROJECT_A + '/memory/usage.jsonl',
            'projects/' + PROJECT_A + '/memory/archive/old-outcomes.jsonl',
            'memory-types/outcomes.jsonl',
            'memory-types/archive/old-outcomes.jsonl',
            'memory-operator/usage.jsonl',
            'memory-operator/archive/old-usage.jsonl']) {
            assert.strictEqual(mergeAttr(fake.store, rel), 'union', rel + ' must merge as a union');
        }
        // A memory body is prose, where a union merge would interleave two
        // rewrites into nonsense, so it takes git's default.
        assert.notStrictEqual(mergeAttr(fake.store, 'projects/' + PROJECT_A + '/memory/a-fact.md'), 'union');
    } finally {
        rmDir(fake.home);
    }
});

test('a tampered allowlist line is drift in either direction, and -Fix restores it', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        const ignorePath = path.join(fake.store, '.gitignore');
        const canonical = fs.readFileSync(ignorePath, 'utf8');

        // Weakened: the root exclusion dropped, which puts .credentials.json
        // back in reach of an add. The status must call it drift whether or
        // not the probes still happen to pass.
        fs.writeFileSync(ignorePath, canonical.replace('\n/*\n', '\n'), 'utf8');
        const weakened = statusOf(fake.store);
        assert.strictEqual(weakened.IgnoreState, 'Drift');
        assert.ok(isIgnored(fake.store, '.credentials.json') === false,
            'the weakened allowlist is expected to expose the credential file; if not, this case proves nothing');

        // Tightened past usefulness: the project tier re-include dropped, so
        // the repo would silently stop syncing project memories.
        fs.writeFileSync(ignorePath, canonical.replace('!/projects/*/memory/**/*.md\n', ''), 'utf8');
        assert.strictEqual(statusOf(fake.store).IgnoreState, 'Drift');

        // The same for the attributes file, whose union merge is what keeps a
        // two-machine append from becoming a conflict.
        const attrPath = path.join(fake.store, '.gitattributes');
        const attrCanonical = fs.readFileSync(attrPath, 'utf8');
        fs.writeFileSync(attrPath, attrCanonical.replace('merge=union', 'merge=ours'), 'utf8');
        assert.strictEqual(statusOf(fake.store).AttrState, 'Drift');

        // Nothing was staged while the allowlist was weakened: the drifted
        // state is reported, never committed under.
        assert.deepStrictEqual(trackedPaths(fake.store), fake.allowed);
        assert.deepStrictEqual(historyPaths(fake.store), fake.allowed);

        // A check that says "re-run with -Fix" has to be reachable by -Fix.
        assert.strictEqual(installRepo(fake.store).status, 0);
        const repaired = statusOf(fake.store);
        assert.strictEqual(repaired.IgnoreState, 'Canonical');
        assert.strictEqual(repaired.AttrState, 'Canonical');
        assert.strictEqual(fs.readFileSync(ignorePath, 'utf8'), canonical);
        assert.strictEqual(fs.readFileSync(attrPath, 'utf8'), attrCanonical);
        // The repair staged and committed the memory tiers and nothing else,
        // which is the assertion a weakened allowlist would have broken.
        assert.deepStrictEqual(trackedPaths(fake.store), fake.allowed);
        assert.deepStrictEqual(historyPaths(fake.store), fake.allowed);
        assert.deepStrictEqual(repaired.Tracked, []);
        assert.deepStrictEqual(repaired.HistoryPaths, []);
    } finally {
        rmDir(fake.home);
    }
});

test('a foreign gitignore on a store root that is not yet a repo blocks the whole initialization', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        // The dangerous shape: no .git, so the repository is created, and a
        // .gitignore the doctor may not rewrite, so the rules governing an add
        // would be somebody else's. Under those rules `git add -A` reaches the
        // credentials, the settings, the prompt history, and every session
        // transcript.
        const ignorePath = path.join(fake.store, '.gitignore');
        const foreign = '# my own rules\n*.log\n';
        fs.writeFileSync(ignorePath, foreign, 'utf8');
        assert.strictEqual(statusOf(fake.store).IgnoreState, 'Foreign');

        const res = installRepo(fake.store);
        assert.notStrictEqual(res.status, 0, 'the repair must refuse:\n' + res.stdout + res.stderr);
        assert.match(res.stdout, /was not written by the doctor/);
        assert.match(res.stdout, /does not hold the canonical allowlist/);
        assert.match(res.stdout, /Nothing was staged or committed/);

        assert.strictEqual(fs.readFileSync(ignorePath, 'utf8'), foreign,
            'a file the doctor did not author is never rewritten');
        assert.strictEqual(statusOf(fake.store).IgnoreState, 'Foreign');
        // Nothing reached the index and nothing reached a commit. The refusal
        // is additive-only, so the .git the run created is left in place.
        assert.deepStrictEqual(trackedPaths(fake.store), []);
        assert.notStrictEqual(git(fake.store, ['rev-parse', 'HEAD']).status, 0);
        assert.deepStrictEqual(historyPaths(fake.store), []);

        // And the doctor offers no repair for this state, because the repair
        // it would describe is one the installer refuses to perform.
        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /the doctor did not write/);
        assert.ok(!/-Fix/.test(line.detail), 'no repair may be promised that -Fix will not perform');
    } finally {
        rmDir(fake.home);
    }
});

test('a foreign gitignore in the doctor own repo still blocks the commit, and the report keeps naming the leaks', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // The allowlist replaced wholesale after the fact, with a credential
        // forced into the index under the new rules. Every leak probe has
        // something to say here, and this is the state in which they matter.
        fs.writeFileSync(path.join(fake.store, '.gitignore'), '# my own rules\n*.log\n', 'utf8');
        assert.strictEqual(git(fake.store, ['add', '-f', '.credentials.json']).status, 0);

        const res = installRepo(fake.store);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /does not hold the canonical allowlist/);
        assert.strictEqual(git(fake.store, ['rev-list', '--count', 'HEAD']).stdout.trim(), '1',
            'the refusal makes no commit');

        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /the doctor did not write/);
        // The foreign-file report is the state where the allowlist is least
        // trustworthy, so suppressing the probes there is what turns a staged
        // secret into a silent one.
        assert.match(line.detail, /Already tracked: \.credentials\.json/, line.detail);
        assert.match(line.detail, /An add would stage: /, line.detail);
        assert.match(line.detail, /git rm --cached/, line.detail);
    } finally {
        rmDir(fake.home);
    }
});

test('a credential that reached a commit is caught by the history probe after it is untracked', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        assert.strictEqual(git(fake.store, ['add', '-f', '.credentials.json']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'forced']).status, 0);
        // The printed remediation for a tracked leak, followed exactly. It
        // clears the index and the worktree probes, and leaves the blob in
        // history where a push would still publish it.
        assert.strictEqual(git(fake.store, ['rm', '--cached', '--quiet', '.credentials.json']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'untracked']).status, 0);

        const status = statusOf(fake.store);
        assert.strictEqual(status.ProbesRan, true, status.Notes.join('\n'));
        assert.deepStrictEqual(status.NotIgnored, []);
        assert.deepStrictEqual(status.Unexpected, []);
        assert.deepStrictEqual(status.Tracked, []);
        assert.deepStrictEqual(status.HistoryPaths, ['.credentials.json']);

        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /In committed history: \.credentials\.json/, line.detail);
        // Untracking is not the remedy here, and saying so is the difference
        // between a leak closed and a leak believed closed.
        assert.match(line.detail, /rewrite the history/, line.detail);
        assert.match(line.detail, /rotate every credential/, line.detail);
    } finally {
        rmDir(fake.home);
    }
});

test('a credential introduced only in a merge resolution is caught by the history probe', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        const run = (args) => assert.strictEqual(git(fake.store, args).status, 0, args.join(' '));
        run(['checkout', '--quiet', '-b', 'side']);
        write(path.join(fake.store, 'memory-types', 'side.md'), '# side\n');
        run(['add', '-A']);
        run(['commit', '--quiet', '-m', 'side']);
        run(['checkout', '--quiet', '-']);
        write(path.join(fake.store, 'memory-types', 'main.md'), '# main\n');
        run(['add', '-A']);
        run(['commit', '--quiet', '-m', 'main']);
        // An evil merge: the blob enters during the resolution, so it belongs
        // to no parent's tree and is named by no per-commit diff. git log
        // lists no file names for a merge commit at all under its default
        // --diff-merges=off, which is why the probe walks objects instead.
        git(fake.store, ['merge', '--no-commit', '--no-ff', 'side']);
        write(path.join(fake.store, 'evil-credential.json'), '{"token":"secret"}\n');
        run(['add', '-f', 'evil-credential.json']);
        run(['commit', '--quiet', '-m', 'merge']);
        // The control: the surface the weaker probe reads does not hold it.
        const viaLog = git(fake.store, ['log', '--all', '--name-only', '--pretty=format:']);
        assert.strictEqual(viaLog.status, 0, viaLog.stderr);
        assert.ok(!/evil-credential\.json/.test(viaLog.stdout),
            'if the log surface does list it, this case proves nothing');
        assert.ok(historyPaths(fake.store).includes('evil-credential.json'));

        const status = statusOf(fake.store);
        assert.strictEqual(status.ProbesRan, true, status.Notes.join('\n'));
        assert.deepStrictEqual(status.HistoryPaths, ['evil-credential.json']);
        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /In committed history: evil-credential\.json/, line.detail);
    } finally {
        rmDir(fake.home);
    }
});

test('a disallowed path already in the index blocks the next repair commit', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // Tracked and unmodified, so it appears in ls-files and in no staged
        // diff. A commit would carry it forward untouched.
        assert.strictEqual(git(fake.store, ['add', '-f', '.credentials.json']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'forced']).status, 0);
        const head = git(fake.store, ['rev-parse', 'HEAD']).stdout.trim();
        // A real change alongside it, so the repair has something it would
        // otherwise commit and the refusal is the reason nothing lands.
        write(path.join(fake.store, 'memory-types', 'new-type.md'), '# new\n');

        const res = installRepo(fake.store);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /the allowlist does not admit/);
        assert.match(res.stdout, /\.credentials\.json/);
        assert.strictEqual(git(fake.store, ['rev-list', '--count', head + '..HEAD']).stdout.trim(), '0',
            'no commit is made over a disallowed index');
        // The refusal removes nothing: untracking somebody's file is the
        // operator's call, not the doctor's.
        assert.ok(trackedPaths(fake.store).includes('.credentials.json'));
    } finally {
        rmDir(fake.home);
    }
});

test('a nested gitignore that re-includes a transcript is caught by the dry-run probe', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // git reads a .gitignore in every directory it traverses, and rules
        // there are applied after the root's, so a file placed inside a
        // traversed project directory can re-include what the root excluded.
        // The root allowlist is therefore not by itself a structural bar; the
        // probes are what close it, and they answer on the positive rule
        // rather than on the ignore rules, so the re-included path is flagged
        // and the index gate refuses to commit it.
        write(path.join(fake.store, 'projects', PROJECT_A, '.gitignore'), '!*.jsonl\n');
        const reIncluded = 'projects/' + PROJECT_A + '/a1b2c3d4-session.jsonl';
        assert.ok(dryRunPaths(fake.store).includes(reIncluded),
            'if git no longer honors the nested file, this case proves nothing');

        const status = statusOf(fake.store);
        assert.ok(status.Unexpected.includes(reIncluded), JSON.stringify(status.Unexpected));
        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /An add would stage: projects/, line.detail);

        // And a repair refuses rather than committing the transcript.
        const res = installRepo(fake.store);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /the allowlist does not admit/);
        assert.ok(!trackedPaths(fake.store).includes(reIncluded));
    } finally {
        rmDir(fake.home);
    }
});

test('a post-add refusal leaves the index exactly as the add found it', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        const before = trackedPaths(fake.store);
        // A path only an add would pull in: allowed by the nested rules git
        // reads, refused by the positive predicate the gate applies. The gate
        // catches it after the add, which is the path that would otherwise
        // leave a transcript staged in a repository about to gain a remote.
        write(path.join(fake.store, 'projects', PROJECT_A, '.gitignore'), '!*.jsonl\n');
        const res = installRepo(fake.store);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /the allowlist does not admit/);
        assert.match(res.stdout, /returned to what it held before/);
        assert.deepStrictEqual(trackedPaths(fake.store), before,
            'the refusal must not leave the add staged');
        // Additive: the restore touches the index alone, never the worktree.
        assert.ok(fs.existsSync(path.join(fake.store, 'projects', PROJECT_A, 'a1b2c3d4-session.jsonl')));
        assert.ok(fs.existsSync(path.join(fake.store, 'projects', PROJECT_A, '.gitignore')));
    } finally {
        rmDir(fake.home);
    }
});

test('a fresh init that refuses after the add leaves no path staged', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        // No prior index at all, so the pre-add tree is the empty tree. The
        // unborn case must restore to nothing rather than fail into a note.
        write(path.join(fake.store, 'projects', PROJECT_A, '.gitignore'), '!*.jsonl\n');
        const res = installRepo(fake.store);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /the allowlist does not admit/);
        assert.match(res.stdout, /returned to what it held before/);
        assert.deepStrictEqual(trackedPaths(fake.store), []);
        assert.notStrictEqual(git(fake.store, ['rev-parse', 'HEAD']).status, 0);
        assert.ok(fs.existsSync(path.join(fake.store, '.credentials.json')));
    } finally {
        rmDir(fake.home);
    }
});

test('the ownership marker survives the deletion of the allowlist file', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // A repository recognized only by its .gitignore becomes a stranger
        // the moment that file is deleted, with no repair reachable for the
        // one state that most needs one.
        fs.rmSync(path.join(fake.store, '.gitignore'));
        const status = statusOf(fake.store);
        assert.strictEqual(status.IsRepo, true);
        assert.strictEqual(status.IgnoreState, 'Missing');
        assert.strictEqual(status.IsOwnRepo, true);

        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /\.gitignore is missing/);
        assert.match(line.detail, /-Fix/);
        // With no allowlist on disk at all, an add reaches the credentials,
        // the settings, the prompt history, and every transcript. Naming the
        // gap without naming what it exposes is the report a reader trusts.
        assert.match(line.detail, /An add would stage: /, line.detail);

        // The promise the FAIL text makes has to be one -Fix keeps, so the
        // doctor's own gate is evaluated for this exact state rather than
        // inferred from the repair succeeding when called directly.
        // Every repairable state of both managed files, because the promise
        // the class makes is that a FAIL naming -Fix is a state -Fix acts on.
        for (const fields of [
            { IsRepo: true, IsOwnRepo: true, IgnoreState: 'Missing', AttrState: 'Canonical' },
            { IsRepo: true, IsOwnRepo: true, IgnoreState: 'Drift', AttrState: 'Canonical' },
            { IsRepo: true, IsOwnRepo: true, IgnoreState: 'Canonical', AttrState: 'Missing' },
            { IsRepo: true, IsOwnRepo: true, IgnoreState: 'Canonical', AttrState: 'Drift' },
            { IsRepo: false, IsOwnRepo: false, IgnoreState: 'Missing', AttrState: 'Missing' }
        ]) {
            const gate = doctorFixGate(fields);
            assert.strictEqual(gate.Adoptable, true, JSON.stringify(fields));
            assert.strictEqual(gate.NeedsWork, true,
                'a -Fix run must prompt for this state, not skip it: ' + JSON.stringify(fields));
        }
        // And the settled state asks for nothing, so a -Fix on a healthy store
        // does not prompt to repair what is already right.
        const settled = doctorFixGate({
            IsRepo: true, IsOwnRepo: true, IgnoreState: 'Canonical', AttrState: 'Canonical'
        });
        assert.strictEqual(settled.NeedsWork, false);

        assert.strictEqual(installRepo(fake.store).status, 0);
        assert.strictEqual(statusOf(fake.store).IgnoreState, 'Canonical');
    } finally {
        rmDir(fake.home);
    }
});

test('a repository the doctor did not create is left alone entirely', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        // An operator versioning their dotfiles at the store root, with work
        // already staged. Writing an allowlist and committing here would put
        // their staged file, and the memory tiers, in a commit they never
        // asked for and possibly push it to their own remote.
        assert.strictEqual(git(fake.store, ['init', '--quiet']).status, 0);
        assert.strictEqual(git(fake.store, ['remote', 'add', 'origin', 'https://example.invalid/dotfiles.git']).status, 0);
        assert.strictEqual(git(fake.store, ['add', 'settings.json']).status, 0);

        const status = statusOf(fake.store);
        assert.strictEqual(status.IsRepo, true);
        assert.strictEqual(status.IsOwnRepo, false);

        const res = installRepo(fake.store);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /did not create/);
        assert.match(res.stdout, /Nothing was written, staged, or committed/);
        assert.ok(!fs.existsSync(path.join(fake.store, '.gitignore')));
        assert.ok(!fs.existsSync(path.join(fake.store, '.gitattributes')));
        // No commit was made at all, so there is still no HEAD.
        assert.notStrictEqual(git(fake.store, ['rev-parse', 'HEAD']).status, 0);
        assert.deepStrictEqual(trackedPaths(fake.store), ['settings.json']);

        const line = doctorSyncLine(fake.home);
        assert.strictEqual(line.status, 'FAIL', line.detail);
        assert.match(line.detail, /did not create/);
        assert.ok(!/-Fix/.test(line.detail), 'no repair may be promised that -Fix will not perform');
    } finally {
        rmDir(fake.home);
    }
});

test('a CRLF checkout of the managed files is canonical, not drift', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // What a clone with core.autocrlf=true has on disk. A machine in that
        // configuration must not read as drift on every doctor run, and -Fix
        // must not fight its checkout.
        for (const name of ['.gitignore', '.gitattributes']) {
            const file = path.join(fake.store, name);
            fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'), 'utf8');
        }
        const status = statusOf(fake.store);
        assert.strictEqual(status.IgnoreState, 'Canonical');
        assert.strictEqual(status.AttrState, 'Canonical');
        assert.strictEqual(status.IsOwnRepo, true);
    } finally {
        rmDir(fake.home);
    }
});

test('a force-added credential file is caught by the tracked-path probe', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        // gitignore does not apply to a tracked file, so this escapes both
        // check-ignore and the dry-run add. Only the index answers it.
        assert.strictEqual(git(fake.store, ['add', '-f', '.credentials.json']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'forced']).status, 0);
        assert.ok(isIgnored(fake.store, '.credentials.json'), 'the ignore rule is untouched, which is the point');
        assert.deepStrictEqual(dryRunPaths(fake.store), []);
        const status = statusOf(fake.store);
        assert.deepStrictEqual(status.Tracked, ['.credentials.json']);
    } finally {
        rmDir(fake.home);
    }
});

test('a second -Fix is a no-op that neither re-commits nor changes what is tracked', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        const before = trackedPaths(fake.store);
        const head = git(fake.store, ['rev-parse', 'HEAD']).stdout.trim();
        const again = installRepo(fake.store);
        assert.strictEqual(again.status, 0, again.stdout + again.stderr);
        assert.match(again.stdout, /Nothing to commit/);
        assert.deepStrictEqual(trackedPaths(fake.store), before);
        assert.strictEqual(git(fake.store, ['rev-parse', 'HEAD']).stdout.trim(), head);
    } finally {
        rmDir(fake.home);
    }
});

test('the store root is mandatory: no call can default to the real home directory', { skip: !isWin }, () => {
    // A missing -StoreRoot is a parameter error under a non-interactive host,
    // never a silent fall back to ~/.claude, which is what keeps a forgotten
    // redirect from running git init over the operator's credentials.
    for (const fn of ['Get-MemorySyncStatus', 'Install-MemorySyncRepo']) {
        const res = spawnSync('powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
                '. ' + q(INSTALLER) + '; ' + fn],
            { encoding: 'utf8', env: { ...process.env } });
        assert.notStrictEqual(res.status, 0, fn + ' must not run without -StoreRoot');
    }
    // And no default is written anywhere in the file's code, comments aside.
    const code = fs.readFileSync(INSTALLER, 'utf8').split(/\r?\n/)
        .filter((l) => !/^\s*#/.test(l)).join('\n');
    assert.ok(!/USERPROFILE|\$HOME|HomeDirectory|\$env:HOME/.test(code),
        'the installer must resolve no path of its own');
});

// The doctor itself, against a redirected home directory. Check mode writes
// nothing (every write in doctor.ps1 sits under -Fix), and the run is
// asserted on its own section's line rather than on the exit code, because
// other sections legitimately fail against a fake home.
function doctorSyncLine(home) {
    const res = pwsh('& ' + q(DOCTOR), { USERPROFILE: home });
    const lines = res.stdout.split(/\r?\n/);
    const header = /^\[\w+\s*\] .+$/;
    const at = lines.findIndex((l) => /^\[\w+\s*\] Memory sync$/.test(l.trim()));
    assert.notStrictEqual(at, -1, 'no Memory sync section in the doctor output:\n' + res.stdout + res.stderr);
    // The slice ends at the next section header. Running to the end of the
    // output would fold the following sections' detail lines into this one's,
    // and a negative assertion would then range over text that varies with
    // machine state and that this section never printed.
    const rest = lines.slice(at + 1);
    const until = rest.findIndex((l) => header.test(l.trim()));
    return {
        status: lines[at].trim().match(/^\[(\w+)/)[1],
        detail: (until < 0 ? rest : rest.slice(0, until)).filter((l) => l.startsWith('        ')).join('\n')
    };
}

test('the doctor reports the sync section in both states against a redirected store root', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        const absent = doctorSyncLine(fake.home);
        assert.strictEqual(absent.status, 'WARN', absent.detail);
        assert.match(absent.detail, /not a git repository/);
        assert.match(absent.detail, /-Fix/);

        assert.strictEqual(installRepo(fake.store).status, 0);
        const present = doctorSyncLine(fake.home);
        assert.strictEqual(present.status, 'PASS', present.detail);
        assert.match(present.detail, /4 sensitive path\(s\) proven ignored/);
        assert.match(present.detail, /No origin remote yet/);

        // Drift is a failure, never a warning: a mangled ignore file is how
        // sync becomes credential exfiltration.
        const ignorePath = path.join(fake.store, '.gitignore');
        fs.writeFileSync(ignorePath,
            fs.readFileSync(ignorePath, 'utf8').replace('\n/*\n', '\n'), 'utf8');
        const drifted = doctorSyncLine(fake.home);
        assert.strictEqual(drifted.status, 'FAIL', drifted.detail);
        assert.match(drifted.detail, /differs from the allowlist/);
    } finally {
        rmDir(fake.home);
    }
});

test('the store is initialized only behind a consent gate that declines on a redirected stdin', { skip: !isWin }, () => {
    // The doctor itself is never run with -Fix here: its execution-policy and
    // user-PATH repairs are gated on -Fix alone and reach user-scope machine
    // state a USERPROFILE redirect does not cover. The gate is exercised
    // instead by parsing Get-Consent out of doctor.ps1 and calling it, and the
    // wiring by proving the sync install has no other way in.
    const script = '$errs = $null; $tokens = $null; '
        + '$ast = [System.Management.Automation.Language.Parser]::ParseFile(' + q(DOCTOR)
        + ', [ref]$tokens, [ref]$errs); '
        + '$fn = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq "Get-Consent" }, $true); '
        + 'if ($null -eq $fn) { Write-Output "no Get-Consent in doctor.ps1"; exit 1 }; '
        + '$Fix = $true; $Yes = $false; '
        + 'Invoke-Expression $fn.Extent.Text; '
        + 'if (Get-Consent "Initialize the store?") { Write-Output "consented"; exit 1 }; '
        + 'Write-Output "declined"';
    const res = spawnSync('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', input: '', env: { ...process.env } });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /declined/);

    const doctorSrc = fs.readFileSync(DOCTOR, 'utf8').split(/\r?\n/);
    const callsAt = doctorSrc.map((l, i) => (/Install-MemorySyncRepo\s+-StoreRoot/.test(l) ? i : -1)).filter((i) => i >= 0);
    assert.strictEqual(callsAt.length, 1, 'the installer has exactly one call site in the doctor');
    const gate = doctorSrc.slice(Math.max(0, callsAt[0] - 3), callsAt[0]).join('\n');
    assert.match(gate, /if \(Get-Consent /, 'the installer runs only inside a consent gate:\n' + gate);

    // The consent prompt is offered only where the repair can run. A foreign
    // managed file is refused by the installer, so a prompt in that state
    // would ask the operator to authorize a repair that cannot happen. This
    // is checked in source because the prompt itself only appears under -Fix.
    const adoptable = doctorSrc.filter((l) => /\$syncAdoptable\s*=/.test(l));
    assert.strictEqual(adoptable.length, 1, 'the doctor decides adoptability in one place');
    assert.match(adoptable[0], /\$syncForeign\.Count -eq 0/, adoptable[0]);
});

test('install-memory-sync.ps1 parses cleanly', { skip: !isWin }, () => {
    const script = '$errs = $null; $tokens = $null; '
        + '[System.Management.Automation.Language.Parser]::ParseFile(' + q(INSTALLER)
        + ', [ref]$tokens, [ref]$errs) | Out-Null; '
        + 'if ($errs.Count -gt 0) { $errs | Write-Output; exit 1 }';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
});
