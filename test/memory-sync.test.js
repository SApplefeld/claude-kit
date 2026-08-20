// Tests for the memory store's sync repo: plugins/claude-kit/doctor/
// install-memory-sync.ps1, the "Memory sync" section of doctor.ps1, and the
// silent sync runner plugins/claude-kit/doctor/sync-store.ps1 (its cases sit
// at the end of this file).
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
    // The embedder install and its derived search index: root-level, like the
    // other sensitive paths above, and excluded by the same `/*` rule rather
    // than by any rule naming them specifically. Planted several levels deep
    // (kit-embedder/node_modules/@huggingface/transformers/...), which is
    // where git's directory-exclusion semantics are actually exercised, not
    // just the top-level name. Neither path is added to `allowed` below, so
    // every existing positive-space assertion in this file (trackedPaths and
    // historyPaths compared against `allowed`) already proves both stay out,
    // with no new assertion required beyond this fixture existing.
    write(path.join(store, 'kit-embedder', 'node_modules', '@huggingface', 'transformers', 'package.json'),
        '{"name":"@huggingface/transformers","version":"9.9.9"}\n');
    write(path.join(store, 'kit-embedder', 'node_modules', '@huggingface', 'transformers',
        '.cache', 'Xenova', 'all-MiniLM-L6-v2', 'onnx', 'model_quantized.onnx'), 'not a real model\n');
    write(path.join(store, 'memory-index.jsonl'), '{"store":"a","tier":"type","name":"b"}\n');

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
    const res = git(store, ['rev-list', '--objects', '--branches', '--tags', '--filter=object:type=blob']);
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

// Lifts $syncAdoptable, $syncNeedsWork, and $syncQuestion (the consent
// prompt's own text) as AST nodes and runs all three against a stubbed
// $syncStatus, the same technique doctorFixGate uses for the first two. This
// is what proves the prompt matches the state without ever running a real
// -Fix: real doctor.ps1 code, not a paraphrase of its three-way branch, so a
// rewrite that adds a fourth state or reorders the branches is caught here.
function doctorFixQuestion(statusFields) {
    const fields = Object.entries(statusFields)
        .map(([k, v]) => k + ' = ' + (typeof v === 'boolean' ? (v ? '$true' : '$false') : q(v)))
        .join('; ');
    const script = '$errs = $null; $tokens = $null; '
        + '$ast = [System.Management.Automation.Language.Parser]::ParseFile(' + q(DOCTOR)
        + ', [ref]$tokens, [ref]$errs); '
        + '$stmts = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] '
        + "-and ($n.Left.Extent.Text -eq '$syncAdoptable' -or $n.Left.Extent.Text -eq '$syncNeedsWork' -or $n.Left.Extent.Text -eq '$syncQuestion') }, $true)); "
        + 'if ($stmts.Count -ne 3) { Write-Output ("expected 3 gate/question assignments, found " + $stmts.Count); exit 1 }; '
        + '$claudeDir = "C:\\stub-claude-dir-for-test"; '
        + '$syncStatus = @{ ' + fields + ' }; $syncForeign = @(); '
        + 'foreach ($s in $stmts) { Invoke-Expression $s.Extent.Text }; '
        + '@{ Adoptable = [bool]$syncAdoptable; NeedsWork = [bool]$syncNeedsWork; Question = [string]$syncQuestion } | ConvertTo-Json -Compress';
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
            'shell-snapshots/snapshot.sh',
            'memory-index.jsonl',
            'kit-embedder/node_modules/@huggingface/transformers/package.json',
            'kit-embedder/node_modules/@huggingface/transformers/.cache/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx']) {
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
        assert.match(again.stdout, /Committed 1 pending change\(s\) admitted by the allowlist/);
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
        // A clean canonical repo reads as not dirty, which is what keeps
        // -Fix's new pending-change clause from prompting on a healthy store
        // that has nothing to commit.
        const cleanStatus = statusOf(fake.store);
        assert.strictEqual(cleanStatus.Dirty, false, JSON.stringify(cleanStatus));
        assert.strictEqual(cleanStatus.DirtyCount, 0, JSON.stringify(cleanStatus));
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

// The steady-state hole was in doctor.ps1's own decision of when to call
// Install-MemorySyncRepo at all (locked separately below, by lifting
// $syncNeedsWork itself): a repository already canonical on both managed
// files never used to reach it, so -Fix committed nothing beyond the heal
// that made it canonical, and every memory a session wrote afterward stayed
// local. This case locks the other half, Get-MemorySyncStatus's new Dirty
// field and Install-MemorySyncRepo's commit path itself: once reached, the
// commit runs through the same gates a drift repair takes (the pre-add and
// post-add index checks against the allowlist), and the status the caller
// would gate on reads correctly.
test('a canonical repo with a pending memory-tier change reads as dirty, and -Fix commits it through the same gates', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        const head = git(fake.store, ['rev-parse', 'HEAD']).stdout.trim();
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');

        const status = statusOf(fake.store);
        assert.strictEqual(status.IgnoreState, 'Canonical');
        assert.strictEqual(status.AttrState, 'Canonical');
        assert.strictEqual(status.Dirty, true, JSON.stringify(status));
        assert.strictEqual(status.DirtyCount, 1, JSON.stringify(status));

        const res = installRepo(fake.store);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /Committed 1 pending change\(s\) admitted by the allowlist/);
        assert.ok(!/Wrote \.git|Restored the canonical/.test(res.stdout),
            'no managed file was rewritten; only a pending memory was committed:\n' + res.stdout);

        assert.notStrictEqual(git(fake.store, ['rev-parse', 'HEAD']).stdout.trim(), head, 'a new commit was made');
        const tracked = trackedPaths(fake.store);
        assert.ok(tracked.includes('memory-types/pending-fact.md'), tracked.join(','));
        assert.deepStrictEqual(historyPaths(fake.store), fake.allowed.concat(['memory-types/pending-fact.md']).sort(),
            'the new commit went through the same history probe every other commit here does');
    } finally {
        rmDir(fake.home);
    }
});

// A disallowed path blocks a pending-change commit exactly as it blocks a
// drift-repair commit: the same pre-add and post-add gates run regardless of
// why Install-MemorySyncRepo was reached, so a leak already in the index is
// caught here too, and nothing is committed over it.
test('a disallowed tracked path still blocks a pending-change-only commit', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        assert.strictEqual(git(fake.store, ['add', '-f', '.credentials.json']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'forced']).status, 0);
        const head = git(fake.store, ['rev-parse', 'HEAD']).stdout.trim();
        // A real change alongside the leak, so the commit has something it
        // would otherwise take.
        write(path.join(fake.store, 'memory-types', 'new-type.md'), '# new\n');

        const res = installRepo(fake.store);
        assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /the allowlist does not admit/);
        assert.strictEqual(git(fake.store, ['rev-parse', 'HEAD']).stdout.trim(), head,
            'no commit is made over a disallowed index, whether reached by drift or by a pending change');
    } finally {
        rmDir(fake.home);
    }
});

// The neighbouring state the fix must not touch: drift repair and a pending
// memory-tier commit compose in one -Fix run rather than the dirty path
// silently taking over. Both facts ride in the same notes list.
test('a drifted repo still repairs the allowlist and commits both the repair and any pending change', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        const ignorePath = path.join(fake.store, '.gitignore');
        const canonical = fs.readFileSync(ignorePath, 'utf8');
        fs.writeFileSync(ignorePath, canonical.replace('\n/*\n', '\n'), 'utf8');
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');

        assert.strictEqual(statusOf(fake.store).IgnoreState, 'Drift');

        const res = installRepo(fake.store);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /Restored the canonical \.gitignore/);
        assert.match(res.stdout, /Committed 1 pending change\(s\) admitted by the allowlist/);

        const repaired = statusOf(fake.store);
        assert.strictEqual(repaired.IgnoreState, 'Canonical');
        assert.ok(trackedPaths(fake.store).includes('memory-types/pending-fact.md'));
    } finally {
        rmDir(fake.home);
    }
});

// The other neighbouring state: a foreign repository (one the doctor did not
// create) is still refused outright even when it holds uncommitted changes,
// because Dirty can only ever be true and $syncAdoptable simultaneously false
// there is exactly the state $syncAdoptable's own foreign-file check exists
// to catch; the fix's new clause never overrides it.
test('a foreign repository with uncommitted changes is still refused, never committed into', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(git(fake.store, ['init', '--quiet']).status, 0);
        fs.writeFileSync(path.join(fake.store, '.gitignore'), '# my own rules\n*.log\n', 'utf8');
        assert.strictEqual(git(fake.store, ['add', 'settings.json']).status, 0);

        const status = statusOf(fake.store);
        assert.strictEqual(status.IsRepo, true);
        assert.strictEqual(status.IsOwnRepo, false);

        const res = installRepo(fake.store);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /did not create/);
        assert.match(res.stdout, /Nothing was written, staged, or committed/);
        assert.notStrictEqual(git(fake.store, ['rev-parse', 'HEAD']).status, 0, 'no commit was ever made');
    } finally {
        rmDir(fake.home);
    }
});

// The consent prompt itself, real doctor.ps1 code lifted and run against a
// stubbed status for every combination: it must never describe a repair that
// is not happening (Section 1's original finding, mirrored onto the new
// branch), and it must offer nothing at all when there is genuinely nothing
// to do.
test('the consent prompt names exactly the action -Fix is about to take, for every combination', { skip: !isWin }, () => {
    // Not a repo at all: init plus one commit.
    let g = doctorFixQuestion({ IsRepo: false, IsOwnRepo: false, IgnoreState: 'Missing', AttrState: 'Missing', Dirty: false, DirtyCount: 0 });
    assert.strictEqual(g.NeedsWork, true);
    assert.match(g.Question, /Initialize .* as the memory-sync git repository/);

    // A repo whose allowlist drifted: restore plus commit, regardless of Dirty.
    for (const dirty of [false, true]) {
        g = doctorFixQuestion({ IsRepo: true, IsOwnRepo: true, IgnoreState: 'Drift', AttrState: 'Canonical', Dirty: dirty, DirtyCount: dirty ? 2 : 0 });
        assert.strictEqual(g.NeedsWork, true);
        assert.match(g.Question, /Restore the canonical memory-sync allowlist/, JSON.stringify({ dirty, g }));
        assert.ok(!/pending memory-tier change/.test(g.Question), 'a drift repair must not be described as a plain commit');
    }

    // A canonical repo, clean: nothing to do, and the prompt is never reached
    // in practice since NeedsWork is false (doctor.ps1 never calls Get-Consent
    // in that state), but the gate itself is the property this line checks.
    g = doctorFixQuestion({ IsRepo: true, IsOwnRepo: true, IgnoreState: 'Canonical', AttrState: 'Canonical', Dirty: false, DirtyCount: 0 });
    assert.strictEqual(g.NeedsWork, false);

    // A canonical repo, dirty: the new case. The prompt must name a commit of
    // pending changes, never a repair, and it must carry the real count.
    g = doctorFixQuestion({ IsRepo: true, IsOwnRepo: true, IgnoreState: 'Canonical', AttrState: 'Canonical', Dirty: true, DirtyCount: 3 });
    assert.strictEqual(g.NeedsWork, true);
    assert.match(g.Question, /Commit 3 pending memory-tier change\(s\)/);
    assert.ok(!/Restore the canonical|Initialize/.test(g.Question),
        'a pending-change commit must not be described as a repair or a fresh init:\n' + g.Question);

    // A foreign file: never adoptable, so NeedsWork is false regardless of
    // Dirty, and no prompt question is ever built for this state in practice.
    g = doctorFixGate({ IsRepo: true, IsOwnRepo: false, IgnoreState: 'Foreign', AttrState: 'Canonical' });
    assert.strictEqual(g.Adoptable, false);
    assert.strictEqual(g.NeedsWork, false);
});

// Check mode (no -Fix) against a redirected store root: the report names
// uncommitted memory-tier changes when they exist, and says nothing extra
// when the repo is clean, so an operator can tell whether their memories are
// actually committed without running -Fix first. A freshly installed store has
// no remote yet, so the section reads WARN here on that count alone; what this
// case pins is the uncommitted-changes detail, which rides either status.
test('check mode names uncommitted changes in the report, and says nothing extra when clean', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);

        const clean = doctorSyncLine(fake.home);
        assert.strictEqual(clean.status, 'WARN', clean.detail);
        assert.ok(!/uncommitted change/.test(clean.detail), 'a clean repo must not claim uncommitted work:\n' + clean.detail);

        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');
        const dirty = doctorSyncLine(fake.home);
        assert.strictEqual(dirty.status, 'WARN', dirty.detail);
        assert.match(dirty.detail, /1 uncommitted change\(s\) under the allowlist, not yet committed/);
        assert.match(dirty.detail, /re-run doctor with -Fix/);

        // And check mode changed nothing: the new file is still untracked,
        // and HEAD has not moved.
        assert.ok(!trackedPaths(fake.store).includes('memory-types/pending-fact.md'));
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
        // A canonical allowlist with no remote is not a pass: every leak probe
        // reads clean on a store that replicates nowhere, which is the one
        // state where a green section is actively misleading.
        const present = doctorSyncLine(fake.home);
        assert.strictEqual(present.status, 'WARN', present.detail);
        assert.match(present.detail, /4 sensitive path\(s\) proven ignored/);
        assert.match(present.detail, /replicates nowhere/);
        assert.match(present.detail, /remote add origin/);

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

// Give an installed store an origin it can actually push to. A bare repo on
// disk is a real remote for every read this check makes (they are all local
// refs), so the case needs no network and no credentials. It lives under the
// fake home so the existing cleanup reaps it.
function attachRemote(fake) {
    const bare = path.join(fake.home, 'origin.git');
    assert.strictEqual(spawnSync('git', ['init', '--bare', '-q', bare],
        { encoding: 'utf8', env: { ...process.env } }).status, 0);
    assert.strictEqual(git(fake.store, ['remote', 'add', 'origin', bare]).status, 0);
    const head = git(fake.store, ['rev-parse', '--abbrev-ref', 'HEAD']);
    assert.strictEqual(head.status, 0, head.stderr);
    return { bare, branch: head.stdout.trim() };
}

// The destination half of the section. The allowlist proves what the store may
// publish; these cases prove there is somewhere for it to go. Every one of them
// sits on a canonical allowlist with all four leak probes clean, which is the
// point: before this check, each of these states reported PASS.
test('a store that syncs nowhere is reported, however clean its allowlist', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(installRepo(fake.store).status, 0);
        const { bare, branch } = attachRemote(fake);

        // A remote with no upstream on the branch: push and pull in the
        // close-out have nothing to resolve, so this one blocks.
        const noUpstream = doctorSyncLine(fake.home);
        assert.strictEqual(noUpstream.status, 'FAIL', noUpstream.detail);
        assert.match(noUpstream.detail, /tracks no upstream/);
        assert.match(noUpstream.detail, new RegExp('Branch ' + branch));

        // Wired up properly: one branch on origin, tracked by this machine.
        assert.strictEqual(git(fake.store, ['push', '-q', '-u', 'origin', branch]).status, 0);
        const healthy = doctorSyncLine(fake.home);
        assert.strictEqual(healthy.status, 'PASS', healthy.detail);
        assert.match(healthy.detail, /Destination: /);
        assert.match(healthy.detail, new RegExp(branch + ' tracks origin/' + branch));
        assert.match(healthy.detail, /the only branch on origin/);

        // Another machine pushes its store under a different branch name. Both
        // machines' pushes and pulls keep succeeding and neither ever sees the
        // other, which is the silent failure this check exists for.
        assert.strictEqual(git(fake.store, ['push', '-q', 'origin', branch + ':other-machine']).status, 0);
        assert.strictEqual(git(fake.store, ['fetch', '-q', 'origin']).status, 0);
        const divergent = doctorSyncLine(fake.home);
        assert.strictEqual(divergent.status, 'WARN', divergent.detail);
        assert.match(divergent.detail, /origin also carries origin\/other-machine/);
        assert.match(divergent.detail, /never reaches this store/);
        // refs/remotes/origin/HEAD shortens to the bare remote name, which is
        // not a branch: counting it would report a divergence on every store
        // that has one.
        assert.ok(!/carries origin,|carries origin$/m.test(divergent.detail),
            'the remote-HEAD ref must not be counted as a branch:\n' + divergent.detail);

        // Upstream resolution reads the remote-tracking ref, so losing that ref
        // (a pruned or never-fetched origin) drops the branch back to tracking
        // nothing rather than to a store that merely cannot see the other side.
        // That ordering is why the report can only reach its sole-branch claim
        // with at least one branch actually observed.
        assert.strictEqual(git(fake.store, ['update-ref', '-d', 'refs/remotes/origin/other-machine']).status, 0);
        assert.strictEqual(git(fake.store, ['update-ref', '-d', 'refs/remotes/origin/' + branch]).status, 0);
        const pruned = doctorSyncLine(fake.home);
        assert.strictEqual(pruned.status, 'FAIL', pruned.detail);
        assert.match(pruned.detail, /tracks no upstream/);
        assert.ok(!/only branch on origin/.test(pruned.detail),
            'a sole-branch claim must never be made from zero observations:\n' + pruned.detail);

        // A detached HEAD commits to no branch at all.
        assert.strictEqual(git(fake.store, ['fetch', '-q', 'origin']).status, 0);
        assert.strictEqual(git(fake.store, ['checkout', '-q', '--detach', 'HEAD']).status, 0);
        const detached = doctorSyncLine(fake.home);
        assert.strictEqual(detached.status, 'FAIL', detached.detail);
        assert.match(detached.detail, /HEAD is detached/);

        assert.ok(fs.existsSync(bare));
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

// The silent sync runner, doctor/sync-store.ps1. The SessionStart hook spawns
// it detached whenever the store is pending; these cases run it directly, in
// the foreground, against sandbox store roots. Its whole contract is: exit 0
// always, print nothing ever, mutate nothing unless the doctor's full safety
// bar holds (re-derived per run through Get-MemorySyncStatus), commit through
// Install-MemorySyncRepo's own gated path, pull --rebase then push only where
// an upstream is configured, and record every outcome to
// <store>/kit-sync-state.json as fixed enum codes.

const SYNC = path.join(PLUGIN_ROOT, 'doctor', 'sync-store.ps1');

function runSync(store) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SYNC, '-StoreRoot', store],
        { encoding: 'utf8', env: { ...process.env } });
}

// Exit 0 with both streams empty: the runner is spawned detached with its
// streams ignored, so anything it printed would reach nobody, and the state
// file is its whole report.
function assertSilentSync(res) {
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.strictEqual(res.stdout, '', 'the sync runner never writes stdout');
    assert.strictEqual(res.stderr, '', 'the sync runner never writes stderr');
}

function statePath(store) {
    return path.join(store, 'kit-sync-state.json');
}

function readState(store) {
    return JSON.parse(fs.readFileSync(statePath(store), 'utf8'));
}

function headOf(store) {
    const res = git(store, ['rev-parse', 'HEAD']);
    assert.strictEqual(res.status, 0, res.stderr);
    return res.stdout.trim();
}

// A fake store initialized as the doctor's own canonical sync repo, with a
// local commit identity so no case leans on the machine's global git config.
// The ownership key is set before Install-MemorySyncRepo runs so the repo
// takes the recognized-own path rather than the fresh-init one, which is the
// only way to get the identity config in before the first commit.
function makeOwnStore() {
    const fake = makeStore();
    assert.strictEqual(git(fake.store, ['init', '--quiet', '-b', 'main']).status, 0);
    assert.strictEqual(git(fake.store, ['config', '--local', 'user.email', 'sync-test@example.com']).status, 0);
    assert.strictEqual(git(fake.store, ['config', '--local', 'user.name', 'sync-test']).status, 0);
    assert.strictEqual(git(fake.store, ['config', '--local', 'claudekit.memorysync', 'true']).status, 0);
    const res = installRepo(fake.store);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    return fake;
}

// A bare repo under the fake home as origin, with the store's main pushed and
// tracking it: a real remote for every git operation here, no network needed.
// The bare side's HEAD is set to main at init, so a clone of it checks out
// the pushed branch rather than an unborn machine-default one.
function attachBareOrigin(fake) {
    const bare = path.join(fake.home, 'origin.git');
    assert.strictEqual(spawnSync('git', ['init', '--bare', '--quiet', '-b', 'main', bare],
        { encoding: 'utf8', env: { ...process.env } }).status, 0);
    assert.strictEqual(git(fake.store, ['remote', 'add', 'origin', bare]).status, 0);
    assert.strictEqual(git(fake.store, ['push', '--quiet', '-u', 'origin', 'main']).status, 0);
    return bare;
}

// A working clone of the bare origin, standing in for another machine's
// store, with its own local commit identity.
function cloneOf(fake, bare) {
    const clone = path.join(fake.home, 'other-machine');
    assert.strictEqual(spawnSync('git', ['clone', '--quiet', bare, clone],
        { encoding: 'utf8', env: { ...process.env } }).status, 0);
    assert.strictEqual(git(clone, ['config', '--local', 'user.email', 'other@example.com']).status, 0);
    assert.strictEqual(git(clone, ['config', '--local', 'user.name', 'other']).status, 0);
    return clone;
}

test('sync-store: a dirty canonical store with no remote commits locally, prints nothing, and records ok', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const head = headOf(fake.store);
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');

        assertSilentSync(runSync(fake.store));

        assert.notStrictEqual(headOf(fake.store), head, 'the pending change was committed');
        assert.ok(trackedPaths(fake.store).includes('memory-types/pending-fact.md'));
        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'ok');
        assert.strictEqual(state.reason, '');
        assert.notStrictEqual(state.lastOk, '', 'success stamps lastOk');
        assert.strictEqual(state.firstFailSince, '', 'success clears the failure streak');
        assert.ok(!fs.existsSync(path.join(fake.store, 'kit-sync.lock')), 'the lock is removed on exit');
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: an ahead store pushes to its configured upstream, verified on the bare side', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        write(path.join(fake.store, 'memory-types', 'local-fact.md'), '# local\n');
        assert.strictEqual(git(fake.store, ['add', 'memory-types/local-fact.md']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'local work']).status, 0);
        const head = headOf(fake.store);

        assertSilentSync(runSync(fake.store));

        const bareHead = spawnSync('git', ['-C', bare, 'rev-parse', 'main'],
            { encoding: 'utf8', env: { ...process.env } });
        assert.strictEqual(bareHead.status, 0, bareHead.stderr);
        assert.strictEqual(bareHead.stdout.trim(), head, 'the push landed on the bare origin');
        assert.strictEqual(readState(fake.store).lastResult, 'ok');
    } finally {
        rmDir(fake.home);
    }
});

// The pull-unreachability pin: nothing else in the system ever fetches, so
// the runner's own fetch is what discovers a remote that moved on. The
// fixture deliberately leaves the tracking ref stale (no manual fetch): a
// runner that reads behind from the stale ref sees zero, merges nothing, and
// its push is rejected non-fast-forward forever, which is the live-store
// failure this case reproduces.
test('sync-store: a behind store discovers the remote advance with its own fetch and converges', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        const clone = cloneOf(fake, bare);
        write(path.join(clone, 'memory-types', 'from-other-machine.md'), '# other\n');
        assert.strictEqual(git(clone, ['add', 'memory-types/from-other-machine.md']).status, 0);
        assert.strictEqual(git(clone, ['commit', '--quiet', '-m', 'other machine work']).status, 0);
        assert.strictEqual(git(clone, ['push', '--quiet', 'origin', 'main']).status, 0);
        const bareHead = spawnSync('git', ['-C', bare, 'rev-parse', 'main'],
            { encoding: 'utf8', env: { ...process.env } });
        assert.strictEqual(bareHead.status, 0, bareHead.stderr);
        const advanced = bareHead.stdout.trim();
        const staleRef = git(fake.store, ['rev-parse', 'refs/remotes/origin/main']);
        assert.strictEqual(staleRef.status, 0, staleRef.stderr);
        assert.notStrictEqual(staleRef.stdout.trim(), advanced,
            'the tracking ref is stale before the run; a converging runner proves it fetched');

        assertSilentSync(runSync(fake.store));

        assert.strictEqual(headOf(fake.store), advanced, 'both sides converge');
        assert.ok(fs.existsSync(path.join(fake.store, 'memory-types', 'from-other-machine.md')),
            'the other machine\'s memory landed in the worktree');
        assert.strictEqual(readState(fake.store).lastResult, 'ok');
    } finally {
        rmDir(fake.home);
    }
});

// The inbound half of the allowlist. The store root is ~/.claude, where
// settings.json, CLAUDE.md, and the kit's own hooks live gitignored, so a
// fetched commit naming one of those paths would clobber live configuration
// the moment a merge checks it out. Incoming content must pass the same
// positive path rule outbound content does, before the working tree is
// touched.
test('sync-store: an incoming disallowed path gates as inbound-leak, with no merge and no push', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        const clone = cloneOf(fake, bare);
        write(path.join(clone, 'settings.json'), '{"model":"attacker"}\n');
        assert.strictEqual(git(clone, ['add', '-f', 'settings.json']).status, 0);
        assert.strictEqual(git(clone, ['commit', '--quiet', '-m', 'planted config']).status, 0);
        assert.strictEqual(git(clone, ['push', '--quiet', 'origin', 'main']).status, 0);
        const head = headOf(fake.store);

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'gate');
        assert.strictEqual(state.reason, 'inbound-leak');
        assert.strictEqual(headOf(fake.store), head, 'nothing was merged');
        assert.strictEqual(fs.readFileSync(path.join(fake.store, 'settings.json'), 'utf8'),
            '{"model":"opus"}\n', 'the live settings file is untouched');
        assert.ok(!fs.existsSync(path.join(fake.store, '.git', 'rebase-merge')));
        assert.ok(!fs.existsSync(path.join(fake.store, '.git', 'rebase-apply')));
        const porcelain = git(fake.store, ['status', '--porcelain']);
        assert.strictEqual(porcelain.stdout.trim(), '', 'the working tree is untouched');
        // The fetched tracking ref is left in place on a refusal: deleting it
        // would make the store read converged and silently stop syncing while
        // the recorded gate line vanished. It stays so the gate is visible and
        // the next run re-screens the same disallowed tip.
        assert.strictEqual(git(fake.store, ['rev-parse', '--verify', 'refs/remotes/origin/main']).status, 0,
            'the fetched tracking ref is left in place so the gate stays visible');
    } finally {
        rmDir(fake.home);
    }
});

// The rename/duplicate-blob bypass a blob-OBJECT screen misses: an incoming
// commit that places a blob HEAD already has at a disallowed path introduces
// no new blob object, so `rev-list --objects --filter=object:type=blob` emits
// nothing for it and an object screen waves it through; the path screen
// (ls-tree over the incoming tree) names the destination and refuses it. The
// exploit this pins: `git mv` an allowlisted memory file onto settings.json on
// another machine, whose next sync would otherwise rebase attacker content
// over the live, hook-defining settings.json in the store root.
test('sync-store: an incoming rename onto a disallowed path gates as inbound-leak, though it introduces no new blob', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        // Seed an allowlisted file, committed and pushed, so its blob exists in
        // HEAD and on the origin: the rename below then carries a blob already
        // known here, which is exactly what an object screen cannot see.
        write(path.join(fake.store, 'memory-types', 'seed.md'), '# a known blob\n');
        assert.strictEqual(git(fake.store, ['add', 'memory-types/seed.md']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'seed a known blob']).status, 0);
        assert.strictEqual(git(fake.store, ['push', '--quiet', 'origin', 'main']).status, 0);
        const head = headOf(fake.store);

        // Another machine renames that same blob onto settings.json: a new path
        // for a known blob, no new blob object introduced.
        const clone = cloneOf(fake, bare);
        assert.strictEqual(git(clone, ['mv', 'memory-types/seed.md', 'settings.json']).status, 0);
        assert.strictEqual(git(clone, ['commit', '--quiet', '-m', 'rename a known blob onto config']).status, 0);
        assert.strictEqual(git(clone, ['push', '--quiet', 'origin', 'main']).status, 0);

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'gate');
        assert.strictEqual(state.reason, 'inbound-leak',
            'the path screen caught a disallowed destination an object screen would have missed');
        assert.strictEqual(headOf(fake.store), head, 'nothing was merged');
        assert.strictEqual(fs.readFileSync(path.join(fake.store, 'settings.json'), 'utf8'),
            '{"model":"opus"}\n', 'the live, gitignored settings file was never clobbered');
        assert.ok(!fs.existsSync(path.join(fake.store, '.git', 'rebase-merge')));
        assert.ok(!fs.existsSync(path.join(fake.store, '.git', 'rebase-apply')));
        assert.strictEqual(git(fake.store, ['status', '--porcelain']).stdout.trim(), '',
            'the working tree is untouched');
    } finally {
        rmDir(fake.home);
    }
});

// A tree entry has two security-relevant axes, mode and path, and the screen
// must check both: a symlink (mode 120000) at an allowlisted memory PATH would
// be materialized by the rebase, and a later kit read through it would emit a
// credential file's contents into the session's trusted context. The entry is
// planted via plumbing (update-index --cacheinfo) so the test needs no OS
// symlink support: the blob's content is the link target.
test('sync-store: an incoming symlink at an allowed path gates as inbound-leak', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        const head = headOf(fake.store);
        const clone = cloneOf(fake, bare);
        const target = '../../../../.credentials.json';
        const hashed = spawnSync('git', ['-C', clone, 'hash-object', '-w', '--stdin'],
            { input: target, encoding: 'utf8', env: { ...process.env } });
        assert.strictEqual(hashed.status, 0, hashed.stderr);
        const sha = hashed.stdout.trim();
        assert.strictEqual(git(clone, ['update-index', '--add', '--cacheinfo',
            '120000,' + sha + ',memory-types/link.md']).status, 0);
        assert.strictEqual(git(clone, ['commit', '--quiet', '-m', 'plant a symlink at an allowed path']).status, 0);
        assert.strictEqual(git(clone, ['push', '--quiet', 'origin', 'main']).status, 0);

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'gate');
        assert.strictEqual(state.reason, 'inbound-leak', 'a symlink at an allowed path is a leak, not admitted');
        assert.strictEqual(headOf(fake.store), head, 'nothing was merged');
        assert.ok(!fs.existsSync(path.join(fake.store, '.git', 'rebase-merge')));
        assert.strictEqual(git(fake.store, ['rev-parse', '--verify', 'refs/remotes/origin/main']).status, 0,
            'the fetched tracking ref is left in place so the recorded gate stays visible');
    } finally {
        rmDir(fake.home);
    }
});

// A path with fringe whitespace trims to an allowed path but git materializes
// the untrimmed one, so a screen that trimmed its input would validate a
// different string than lands on disk. Planted via plumbing (cacheinfo admits
// arbitrary path bytes) with a leading space; the screen must refuse it.
test('sync-store: an incoming path with fringe whitespace gates as inbound-leak', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        const head = headOf(fake.store);
        const clone = cloneOf(fake, bare);
        const hashed = spawnSync('git', ['-C', clone, 'hash-object', '-w', '--stdin'],
            { input: 'a fact\n', encoding: 'utf8', env: { ...process.env } });
        assert.strictEqual(hashed.status, 0, hashed.stderr);
        const sha = hashed.stdout.trim();
        assert.strictEqual(git(clone, ['update-index', '--add', '--cacheinfo',
            '100644,' + sha + ', memory-types/leading-space.md']).status, 0);
        assert.strictEqual(git(clone, ['commit', '--quiet', '-m', 'plant a fringe-whitespace path']).status, 0);
        assert.strictEqual(git(clone, ['push', '--quiet', 'origin', 'main']).status, 0);

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'gate');
        assert.strictEqual(state.reason, 'inbound-leak',
            'a fringe-whitespace path is refused, not trimmed and admitted');
        assert.strictEqual(headOf(fake.store), head, 'nothing was merged');
    } finally {
        rmDir(fake.home);
    }
});

// A paused merge (or cherry-pick/revert) leaves HEAD attached but conflict
// markers in the worktree; the detached gate does not catch it. Committing
// here would `git add -A` the markers and conclude the merge, baking
// `<<<<<<<` into a memory file and pushing it fleet-wide. The run must defer.
test('sync-store: a paused merge conflict in the store defers rather than committing its markers', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        write(path.join(fake.store, 'memory-types', 'x.md'), '# base\n');
        assert.strictEqual(git(fake.store, ['add', 'memory-types/x.md']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'base']).status, 0);
        assert.strictEqual(git(fake.store, ['checkout', '--quiet', '-b', 'other']).status, 0);
        write(path.join(fake.store, 'memory-types', 'x.md'), '# other machine\n');
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-am', 'other']).status, 0);
        assert.strictEqual(git(fake.store, ['checkout', '--quiet', 'main']).status, 0);
        write(path.join(fake.store, 'memory-types', 'x.md'), '# this machine\n');
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-am', 'mine']).status, 0);
        const head = headOf(fake.store);
        const merge = git(fake.store, ['merge', '--no-edit', 'other']);
        assert.notStrictEqual(merge.status, 0, 'the merge really did conflict');
        assert.ok(fs.existsSync(path.join(fake.store, '.git', 'MERGE_HEAD')), 'a merge is paused');

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'transient');
        assert.strictEqual(state.reason, 'unproven');
        assert.strictEqual(headOf(fake.store), head, 'the conflicted merge was not concluded into a commit');
        assert.ok(fs.existsSync(path.join(fake.store, '.git', 'MERGE_HEAD')),
            'the paused merge is left exactly as found for the operator');
        assert.ok(fs.readFileSync(path.join(fake.store, 'memory-types', 'x.md'), 'utf8').includes('<<<<<<<'),
            'the conflict markers were never committed away');
    } finally {
        rmDir(fake.home);
    }
});

// A paused rebase detaches HEAD, so without the in-progress deferral it would
// take the loud 'detached' gate; the deferral (which runs before the gate)
// records the quiet transient instead and leaves the rebase for the operator.
test('sync-store: a paused rebase in the store defers as transient, not the detached gate', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        write(path.join(fake.store, 'memory-types', 'x.md'), '# base\n');
        assert.strictEqual(git(fake.store, ['add', 'memory-types/x.md']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'base']).status, 0);
        assert.strictEqual(git(fake.store, ['checkout', '--quiet', '-b', 'other']).status, 0);
        write(path.join(fake.store, 'memory-types', 'x.md'), '# other machine\n');
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-am', 'other']).status, 0);
        assert.strictEqual(git(fake.store, ['checkout', '--quiet', 'main']).status, 0);
        write(path.join(fake.store, 'memory-types', 'x.md'), '# this machine\n');
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-am', 'mine']).status, 0);
        const rebase = git(fake.store, ['rebase', 'other']);
        assert.notStrictEqual(rebase.status, 0, 'the rebase really did conflict and pause');
        const paused = fs.existsSync(path.join(fake.store, '.git', 'rebase-merge')) ||
            fs.existsSync(path.join(fake.store, '.git', 'rebase-apply'));
        assert.ok(paused, 'a rebase is paused');

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'transient');
        assert.strictEqual(state.reason, 'unproven', 'the in-progress deferral pre-empts the detached gate');
        const stillPaused = fs.existsSync(path.join(fake.store, '.git', 'rebase-merge')) ||
            fs.existsSync(path.join(fake.store, '.git', 'rebase-apply'));
        assert.ok(stillPaused, 'the paused rebase is left exactly as found for the operator');
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: a tracked disallowed path gates as leaks, with no commit, no push, and the index untouched', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        const head = headOf(fake.store);
        assert.strictEqual(git(fake.store, ['add', '-f', '.credentials.json']).status, 0);
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'gate');
        assert.strictEqual(state.reason, 'leaks');
        assert.strictEqual(headOf(fake.store), head, 'a gate mutates nothing: no commit');
        assert.ok(trackedPaths(fake.store).includes('.credentials.json'),
            'the index is exactly as found; unstaging is the operator\'s call');
        assert.ok(!trackedPaths(fake.store).includes('memory-types/pending-fact.md'),
            'nothing new reached the index either');
        const bareHead = spawnSync('git', ['-C', bare, 'rev-parse', 'main'],
            { encoding: 'utf8', env: { ...process.env } });
        assert.strictEqual(bareHead.stdout.trim(), head, 'no push over a gate');
    } finally {
        rmDir(fake.home);
    }
});

// A foreign repository gets no state file at all, not a gate record: a
// non-owned repo at the store root (an operator's dotfiles repo) has no
// allowlist ignoring kit-sync-state.json, so writing one would dirty their
// worktree forever, keep the hook pending forever, and make the loud line
// permanent with a doctor -Fix that cannot clear it.
test('sync-store: a repository without the ownership key gates as foreign, with nothing written at all', { skip: !isWin }, () => {
    const fake = makeStore();
    try {
        assert.strictEqual(git(fake.store, ['init', '--quiet', '-b', 'main']).status, 0);

        assertSilentSync(runSync(fake.store));

        assert.ok(!fs.existsSync(statePath(fake.store)),
            'a foreign gate writes no state file into somebody else\'s worktree');
        assert.ok(!fs.existsSync(path.join(fake.store, 'kit-sync.lock')), 'and leaves no lock');
        assert.ok(!fs.existsSync(path.join(fake.store, '.gitignore')), 'no managed file was written');
        assert.ok(!fs.existsSync(path.join(fake.store, '.gitattributes')));
        assert.deepStrictEqual(trackedPaths(fake.store), [], 'nothing reached the index');
        assert.notStrictEqual(git(fake.store, ['rev-parse', 'HEAD']).status, 0, 'no commit was ever made');
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: a detached HEAD gates as detached and commits nothing', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        assert.strictEqual(git(fake.store, ['checkout', '--quiet', '--detach', 'HEAD']).status, 0);
        const head = headOf(fake.store);
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'gate');
        assert.strictEqual(state.reason, 'detached');
        assert.strictEqual(headOf(fake.store), head, 'no commit onto a detached HEAD');
        assert.ok(!trackedPaths(fake.store).includes('memory-types/pending-fact.md'));
    } finally {
        rmDir(fake.home);
    }
});

// The fail-closed side of the same gate: a HEAD the status read could not
// resolve at all (here, a symbolic ref to a branch that does not exist) must
// gate rather than pass as not-detached, because a commit against it would
// land on whatever that ref turns out to be.
test('sync-store: an unreadable HEAD fails closed as detached, and commits nothing', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const mainSha = git(fake.store, ['rev-parse', 'refs/heads/main']).stdout.trim();
        assert.strictEqual(git(fake.store, ['symbolic-ref', 'HEAD', 'refs/heads/nowhere']).status, 0);
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'gate');
        assert.strictEqual(state.reason, 'detached');
        assert.strictEqual(git(fake.store, ['rev-parse', 'refs/heads/main']).stdout.trim(), mainSha,
            'the real branch did not move');
        assert.notStrictEqual(git(fake.store, ['rev-parse', 'refs/heads/nowhere']).status, 0,
            'no commit materialized the dangling branch');
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: a genuinely conflicting divergence aborts the rebase, records pull-conflict, and pushes nothing', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const bare = attachBareOrigin(fake);
        const clone = cloneOf(fake, bare);
        // Both machines rewrite the same line of the same memory body (.md
        // takes git's default merge, unlike the union-merged journals), so
        // the rebase must conflict rather than auto-resolve.
        const rel = path.join('projects', PROJECT_A, 'memory', 'a-fact.md');
        write(path.join(clone, rel), '# the other machine\'s rewrite\n');
        assert.strictEqual(git(clone, ['add', '-A']).status, 0);
        assert.strictEqual(git(clone, ['commit', '--quiet', '-m', 'other rewrite']).status, 0);
        assert.strictEqual(git(clone, ['push', '--quiet', 'origin', 'main']).status, 0);
        write(path.join(fake.store, rel), '# this machine\'s rewrite\n');
        assert.strictEqual(git(fake.store, ['add', '-A']).status, 0);
        assert.strictEqual(git(fake.store, ['commit', '--quiet', '-m', 'local rewrite']).status, 0);
        // No manual fetch: the runner's own fetch is what discovers the
        // divergence this case conflicts on.
        const localHead = headOf(fake.store);
        const bareHeadBefore = spawnSync('git', ['-C', bare, 'rev-parse', 'main'],
            { encoding: 'utf8', env: { ...process.env } }).stdout.trim();

        assertSilentSync(runSync(fake.store));

        const state = readState(fake.store);
        assert.strictEqual(state.lastResult, 'transient');
        assert.strictEqual(state.reason, 'pull-conflict');
        assert.notStrictEqual(state.firstFailSince, '', 'the failure streak starts here');
        assert.ok(!fs.existsSync(path.join(fake.store, '.git', 'rebase-merge')),
            'the rebase was aborted, not left in progress');
        assert.ok(!fs.existsSync(path.join(fake.store, '.git', 'rebase-apply')));
        assert.strictEqual(headOf(fake.store), localHead, 'the abort restored the local tip');
        const porcelain = git(fake.store, ['status', '--porcelain']);
        assert.strictEqual(porcelain.stdout.trim(), '', 'the worktree is clean after the abort');
        const bareHeadAfter = spawnSync('git', ['-C', bare, 'rev-parse', 'main'],
            { encoding: 'utf8', env: { ...process.env } }).stdout.trim();
        assert.strictEqual(bareHeadAfter, bareHeadBefore, 'nothing was pushed over a conflict');

        // A second failing run preserves the streak's start rather than
        // resetting it, which is what the hook's seven-day nudge counts from.
        assertSilentSync(runSync(fake.store));
        assert.strictEqual(readState(fake.store).firstFailSince, state.firstFailSince,
            'firstFailSince marks the streak\'s start, not the latest attempt');
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: a fresh lock exits fast with git untouched, the lock kept, and no state written', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const head = headOf(fake.store);
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');
        const lock = path.join(fake.store, 'kit-sync.lock');
        fs.writeFileSync(lock, '', 'utf8');

        assertSilentSync(runSync(fake.store));

        assert.ok(fs.existsSync(lock), 'a fresh lock belongs to the run that made it, never deleted here');
        assert.ok(!fs.existsSync(statePath(fake.store)),
            'a concurrent run in progress is not a failure, so no state is recorded');
        assert.strictEqual(headOf(fake.store), head, 'no commit was made');
        assert.ok(!trackedPaths(fake.store).includes('memory-types/pending-fact.md'));
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: a lock older than fifteen minutes is stale and replaced, and the sync proceeds', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');
        const lock = path.join(fake.store, 'kit-sync.lock');
        fs.writeFileSync(lock, '', 'utf8');
        const past = new Date(Date.now() - 20 * 60 * 1000);
        fs.utimesSync(lock, past, past);

        assertSilentSync(runSync(fake.store));

        assert.strictEqual(readState(fake.store).lastResult, 'ok');
        assert.ok(trackedPaths(fake.store).includes('memory-types/pending-fact.md'),
            'the crashed run\'s leavings did not block the sync');
        assert.ok(!fs.existsSync(lock), 'the replacing run removed its own lock on exit');
        assert.deepStrictEqual(fs.readdirSync(fake.store).filter((n) => n.startsWith('kit-sync.lock.stale')),
            [], 'the takeover rename leaves no remnant behind');
    } finally {
        rmDir(fake.home);
    }
});

// The lock names its owner (pid, then an ISO start time), so staleness is a
// fact about the owning process rather than only about file age: a dead
// owner's lock is taken over at once, a live owner's fresh lock is respected.
test('sync-store: a lock naming a dead process is taken over at once', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');
        // A process that has provably exited: spawnSync waits for it, so its
        // pid names nothing by the time the runner checks.
        const dead = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8', env: { ...process.env } });
        assert.strictEqual(dead.status, 0);
        fs.writeFileSync(path.join(fake.store, 'kit-sync.lock'),
            dead.pid + '\n' + new Date().toISOString() + '\n', 'utf8');

        assertSilentSync(runSync(fake.store));

        assert.strictEqual(readState(fake.store).lastResult, 'ok');
        assert.ok(trackedPaths(fake.store).includes('memory-types/pending-fact.md'),
            'the dead owner\'s fresh lock did not block the sync');
        assert.ok(!fs.existsSync(path.join(fake.store, 'kit-sync.lock')));
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: a fresh lock naming a live process is respected', { skip: !isWin }, () => {
    const fake = makeOwnStore();
    try {
        const head = headOf(fake.store);
        write(path.join(fake.store, 'memory-types', 'pending-fact.md'), '# pending\n');
        // This test process is the live owner.
        const lock = path.join(fake.store, 'kit-sync.lock');
        fs.writeFileSync(lock, process.pid + '\n' + new Date().toISOString() + '\n', 'utf8');

        assertSilentSync(runSync(fake.store));

        assert.ok(fs.existsSync(lock), 'the live owner\'s lock is never deleted by a rival');
        assert.strictEqual(fs.readFileSync(lock, 'utf8').split('\n')[0], String(process.pid),
            'and never rewritten either');
        assert.ok(!fs.existsSync(statePath(fake.store)), 'a run in progress is not a failure: no state');
        assert.strictEqual(headOf(fake.store), head, 'no commit was made');
    } finally {
        rmDir(fake.home);
    }
});

test('sync-store: the store root is mandatory, and the script parses cleanly', { skip: !isWin }, () => {
    // The same no-default rule the installer's own test pins: a forgotten
    // argument is a loud parameter error, never a silent run against the
    // operator's real ~/.claude.
    const res = spawnSync('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SYNC],
        { encoding: 'utf8', env: { ...process.env } });
    assert.notStrictEqual(res.status, 0, 'sync-store.ps1 must not run without -StoreRoot');
    const code = fs.readFileSync(SYNC, 'utf8').split(/\r?\n/)
        .filter((l) => !/^\s*#/.test(l)).join('\n');
    assert.ok(!/USERPROFILE|\$HOME|HomeDirectory|\$env:HOME/.test(code),
        'the sync runner must resolve no store path of its own');

    const script = '$errs = $null; $tokens = $null; '
        + '[System.Management.Automation.Language.Parser]::ParseFile(' + q(SYNC)
        + ', [ref]$tokens, [ref]$errs) | Out-Null; '
        + 'if ($errs.Count -gt 0) { $errs | Write-Output; exit 1 }';
    const parsed = pwsh(script);
    assert.strictEqual(parsed.status, 0, parsed.stdout + parsed.stderr);
});
