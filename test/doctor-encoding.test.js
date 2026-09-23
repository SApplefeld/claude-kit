// Tests for doctor.ps1's file reads that this file's sibling suites don't
// already cover: the doctrine-import, kaizen-signpost, hooks.json, and
// auto-compaction-window reads, each round-tripping non-ASCII content. The
// hooks.json reads and the clone signpost read also carry an
// unreadable-file case, pinning the catch that reports the file as
// unreadable rather than as a wrong answer or a silent overwrite. The
// goal-state read and the plan-head read (both inside the "Kit goal state"
// section) are covered in test/doctor-goal-state.test.js instead, which
// already lifts and runs that section.
//
// Node's built-in test runner, no framework, no install (Node v24). Each case
// extracts the exact Get-Content invocation from doctor.ps1's own source text
// (never re-typed) and runs it against a fixture file under a fresh temp
// directory, so nothing here reads or writes the real ~/.claude. The cases
// spawn Windows PowerShell 5.1 (powershell.exe), the host whose default
// ANSI-codepage decoding these reads must avoid, and are skipped off
// Windows, where the doctor itself does not run.
//
// Output travels through a temp file, not stdout: Windows PowerShell 5.1's
// default console output encoding on a redirected stdout is the OEM
// codepage, not UTF-8, so a non-ASCII value correctly decoded from the
// fixture file would still arrive at Node mis-encoded on the way back out
// through a console pipe. Writing the JSON to a file with an explicit
// encoding and reading that back in Node avoids the boundary entirely.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const PLUGIN_ROOT = path.join(REPO, 'plugins', 'claude-kit');
const DOCTOR = path.join(PLUGIN_ROOT, 'doctor', 'doctor.ps1');
const isWin = process.platform === 'win32';

const DOCTOR_SRC = fs.readFileSync(DOCTOR, 'utf8');

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function pwsh(script) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8' });
}

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// Locates the Nth line (1-based) of doctor.ps1 containing marker verbatim,
// and returns its trimmed text. Real doctor.ps1 code, extracted rather than
// re-typed, so a future rewording of the call site is caught by the "not
// found" assertion instead of silently testing stale text.
function extractLine(marker, occurrence) {
    const lines = DOCTOR_SRC.split(/\r?\n/);
    let count = 0;
    for (const line of lines) {
        if (line.includes(marker)) {
            count++;
            if (count === (occurrence || 1)) return line.trim();
        }
    }
    assert.fail('occurrence ' + (occurrence || 1) + ' of "' + marker + '" not found in doctor.ps1');
}

function runSnippet(setupLines, tailLines) {
    // Output travels through a temp file, not stdout: Windows PowerShell
    // 5.1's default console output encoding on a redirected stdout is the
    // OEM codepage, not UTF-8, and setting [Console]::OutputEncoding to fix
    // that leaks past the process (it changes the console mode, which a
    // later, unrelated process on this host inherits) and can throw "The
    // handle is invalid" where no console is attached. Writing the result
    // with an explicit encoding sidesteps both; the caller's last tailLine
    // assigns the value to serialize into $__json.
    const outFile = path.join(os.tmpdir(), 'doctor-encoding-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const script = setupLines.concat(tailLines, [
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ]).join('\n');
    const res = pwsh(script);
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        return JSON.parse(fs.readFileSync(outFile, 'utf8'));
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

// --- Doctrine import: the CLAUDE.md read. Get-Content attaches
// PSPath/PSChildName/etc. note-properties to the string it returns, which
// ConvertTo-Json expands alongside the text unless the value is cast back to
// a plain [string] first, so both this capture and the gate-source one below
// carry that cast.
const READ_CLAUDE_MD = extractLine('$claudeMdRaw = Get-Content $claudeMd -Raw');

function readClaudeMd(content) {
    const dir = makeDir('doctor-enc-claudemd-');
    try {
        const claudeMd = path.join(dir, 'CLAUDE.md');
        fs.writeFileSync(claudeMd, content, 'utf8');
        const out = runSnippet(
            ['$claudeMd = ' + q(claudeMd)],
            [READ_CLAUDE_MD, '$__json = @{ raw = [string]$claudeMdRaw } | ConvertTo-Json -Compress']
        );
        return out.raw;
    } finally {
        rmDir(dir);
    }
}

test('CLAUDE.md doctrine-import read round-trips a non-ASCII character', { skip: !isWin }, () => {
    const content = '@claude-kit-doctrine.md  # café\n';
    assert.strictEqual(readClaudeMd(content), content);
});

test('CLAUDE.md doctrine-import read is unchanged on ASCII content (control)', { skip: !isWin }, () => {
    const content = '@claude-kit-doctrine.md\n';
    assert.strictEqual(readClaudeMd(content), content);
});

// --- Kaizen signpost: identical source text at both
// call sites, so extracting the first occurrence proves the fix for both.
const READ_SIGNPOST = extractLine('Get-Content $signpost -Raw', 1);

function readSignpost(content) {
    const dir = makeDir('doctor-enc-signpost-');
    try {
        const signpost = path.join(dir, 'claude-kit.local.json');
        fs.writeFileSync(signpost, content, 'utf8');
        return runSnippet(
            ['$signpost = ' + q(signpost)],
            [READ_SIGNPOST, '$signpostData = $signpostRaw | ConvertFrom-Json', '$__json = $signpostData | ConvertTo-Json -Compress']
        );
    } finally {
        rmDir(dir);
    }
}

test('kaizen signpost read round-trips a non-ASCII kitRepoPath', { skip: !isWin }, () => {
    const out = readSignpost(JSON.stringify({ kitRepoPath: 'C:\\dev\\café-clone' }));
    assert.strictEqual(out.kitRepoPath, 'C:\\dev\\café-clone');
});

test('kaizen signpost read is unchanged on an ASCII kitRepoPath (control)', { skip: !isWin }, () => {
    const out = readSignpost(JSON.stringify({ kitRepoPath: 'C:\\dev\\plain-clone' }));
    assert.strictEqual(out.kitRepoPath, 'C:\\dev\\plain-clone');
});

// --- Kit goal hook wiring: the hooks.json read.
const READ_HOOKS_JSON = extractLine('$hooksJsonRaw = Get-Content -LiteralPath $hooksJsonPath -Raw');

function readHooksJson(content) {
    const dir = makeDir('doctor-enc-hooks-');
    try {
        const hooksJsonPath = path.join(dir, 'hooks.json');
        fs.writeFileSync(hooksJsonPath, content, 'utf8');
        return runSnippet(
            ['$hooksJsonPath = ' + q(hooksJsonPath)],
            [READ_HOOKS_JSON, '$hooksJsonData = $hooksJsonRaw | ConvertFrom-Json', '$__json = $hooksJsonData | ConvertTo-Json -Compress']
        );
    } finally {
        rmDir(dir);
    }
}

test('hooks.json read (Kit goal hook wiring) round-trips a non-ASCII field', { skip: !isWin }, () => {
    const out = readHooksJson(JSON.stringify({ note: 'café', hooks: {} }));
    assert.strictEqual(out.note, 'café');
});

test('hooks.json read (Kit goal hook wiring) is unchanged on ASCII content (control)', { skip: !isWin }, () => {
    const out = readHooksJson(JSON.stringify({ note: 'plain', hooks: {} }));
    assert.strictEqual(out.note, 'plain');
});

// --- Hook canary: the second, independently-parsed hooks.json read (a
// separate variable and a separate try/catch from the Kit goal hook
// wiring read above, not a duplicate of it).
const READ_CANARY_HOOKS_JSON = extractLine('$canaryHooksJsonRaw = Get-Content -LiteralPath $canaryHooksJsonPath -Raw');

function readCanaryHooksJson(content) {
    const dir = makeDir('doctor-enc-canary-');
    try {
        const canaryHooksJsonPath = path.join(dir, 'hooks.json');
        fs.writeFileSync(canaryHooksJsonPath, content, 'utf8');
        return runSnippet(
            ['$canaryHooksJsonPath = ' + q(canaryHooksJsonPath)],
            [READ_CANARY_HOOKS_JSON, '$canaryHooksJsonData = $canaryHooksJsonRaw | ConvertFrom-Json', '$__json = $canaryHooksJsonData | ConvertTo-Json -Compress']
        );
    } finally {
        rmDir(dir);
    }
}

test('hooks.json read (Hook canary wiring) round-trips a non-ASCII field', { skip: !isWin }, () => {
    const out = readCanaryHooksJson(JSON.stringify({ note: 'café', hooks: {} }));
    assert.strictEqual(out.note, 'café');
});

test('hooks.json read (Hook canary wiring) is unchanged on ASCII content (control)', { skip: !isWin }, () => {
    const out = readCanaryHooksJson(JSON.stringify({ note: 'plain', hooks: {} }));
    assert.strictEqual(out.note, 'plain');
});

// --- Auto-compaction window: the gate source read, used to
// scrape SAFETY_CEILING_TOKENS out of kit-compact-gate.js's own text.
const READ_GATE_SOURCE = extractLine('$gateSource = Get-Content -LiteralPath (Join-Path $pluginRoot');

function readGateSource(content) {
    const dir = makeDir('doctor-enc-gate-');
    try {
        fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'hooks', 'kit-compact-gate.js'), content, 'utf8');
        const out = runSnippet(
            ['$pluginRoot = ' + q(dir)],
            [READ_GATE_SOURCE, '$__json = @{ src = [string]$gateSource } | ConvertTo-Json -Compress']
        );
        return out.src;
    } finally {
        rmDir(dir);
    }
}

test('kit-compact-gate.js source read round-trips a non-ASCII comment', { skip: !isWin }, () => {
    const content = '// café note\nconst SAFETY_CEILING_TOKENS = 12345;\n';
    assert.strictEqual(readGateSource(content), content);
});

test('kit-compact-gate.js source read is unchanged on ASCII content (control)', { skip: !isWin }, () => {
    const content = '// plain note\nconst SAFETY_CEILING_TOKENS = 12345;\n';
    assert.strictEqual(readGateSource(content), content);
});

// --- Auto-compaction window: the settings.json read, which uses the same
// Get-Content -Encoding UTF8 shape as every other read in this file.
const READ_SETTINGS = extractLine('$settingsObj = Get-Content -LiteralPath $settingsPath -Raw');

function readSettings(content) {
    const dir = makeDir('doctor-enc-settings-');
    try {
        const settingsPath = path.join(dir, 'settings.json');
        fs.writeFileSync(settingsPath, content, 'utf8');
        return runSnippet(
            ['$settingsPath = ' + q(settingsPath)],
            [READ_SETTINGS, '$__json = $settingsObj | ConvertTo-Json -Compress']
        );
    } finally {
        rmDir(dir);
    }
}

test('settings.json read (Auto-compaction window) round-trips a non-ASCII field', { skip: !isWin }, () => {
    const out = readSettings(JSON.stringify({ env: { KIT_USER_DIR: 'C:\\dev\\café' } }));
    assert.strictEqual(out.env.KIT_USER_DIR, 'C:\\dev\\café');
});

test('settings.json read (Auto-compaction window) is unchanged on ASCII content (control)', { skip: !isWin }, () => {
    const out = readSettings(JSON.stringify({ env: { KIT_USER_DIR: 'C:\\dev\\plain' } }));
    assert.strictEqual(out.env.KIT_USER_DIR, 'C:\\dev\\plain');
});

// --- Kit goal hook wiring and Hook canary: both hooks.json reads, run
// together since they share the same file. Lifted as source text between the
// section's own marker comments, with $isClone, $repoRoot, $pluginRoot,
// Report and Get-PayloadClause stubbed; real doctor code otherwise. The
// unreadable case holds hooks.json open with an exclusive FileStream
// (FileShare.None) from this same PowerShell process before the lifted
// section runs, which is what makes Get-Content's own read fail without
// touching file permissions.
//
// The lock itself must fail loudly: a FileStream that could not be opened
// (the fixture path missing, already locked by a leftover process from a
// prior run) throws with a message naming the path it tried to lock, so a
// test failure here points at the fixture setup rather than reading as a
// doctor regression.
function buildLockLines(lockPath, access, share) {
    if (!lockPath) return { lockLines: [], unlockLines: [] };
    return {
        lockLines: [
            'try {',
            '    $__lock = New-Object System.IO.FileStream(' + q(lockPath) + ', [System.IO.FileMode]::Open, [System.IO.FileAccess]::' + access + ', [System.IO.FileShare]::' + share + ')',
            '} catch {',
            '    throw ("could not lock " + ' + q(lockPath) + ' + " (" + ' + q(access + '/' + share) + ' + "): " + $_.Exception.Message)',
            '}'
        ],
        unlockLines: ['$__lock.Close()']
    };
}

function runHooksWiringSection(pluginRoot, lockPath) {
    const outFile = path.join(os.tmpdir(), 'doctor-hookswiring-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const { lockLines, unlockLines } = buildLockLines(lockPath, 'ReadWrite', 'None');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$startMarker = "# --- Kit goal continuity."',
        '$start = $src.IndexOf($startMarker)',
        'if ($start -lt 0) { throw "start marker not found in doctor.ps1" }',
        '$endMarker = "# Load-check the enforcing hook itself"',
        '$end = $src.IndexOf($endMarker, $start)',
        'if ($end -lt 0) { throw "end marker not found after Hook canary" }',
        '$section = $src.Substring($start, $end - $start)',
        '',
        '$script:Reports = @()',
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        'function Get-PayloadClause { return "" }',
        '',
        '$isClone = $true',
        '$repoRoot = ' + q(REPO),
        '$pluginRoot = ' + q(pluginRoot),
        '',
        ...lockLines,
        'try {',
        '    Invoke-Expression $section',
        '} finally {',
        ...unlockLines,
        '}',
        '',
        '$__json = @{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = pwsh(script);
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        assert.ok(Array.isArray(parsed.Reports), 'Reports must be an array: ' + res.stdout);
        return parsed.Reports;
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

function makeHooksFixture(dir) {
    const hooksDir = path.join(dir, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    const hooksJsonPath = path.join(hooksDir, 'hooks.json');
    fs.writeFileSync(hooksJsonPath, JSON.stringify({
        hooks: {
            Stop: [{ hooks: [{ command: 'node kit-goal-stop.js' }] }],
            SessionStart: [{ hooks: [{ command: 'node hook-canary.js' }] }]
        }
    }), 'utf8');
    fs.writeFileSync(path.join(hooksDir, 'kit-goal-stop.js'), '// stub\n', 'utf8');
    fs.writeFileSync(path.join(hooksDir, 'hook-canary.js'), '// stub\n', 'utf8');
    return hooksJsonPath;
}

test('a present but unreadable hooks.json reports FAIL naming it unreadable, not the wiring-check text', { skip: !isWin }, () => {
    const dir = makeDir('doctor-enc-hooks-unreadable-');
    try {
        const hooksJsonPath = makeHooksFixture(dir);
        const reports = runHooksWiringSection(dir, hooksJsonPath);
        const goalHook = reports.find((r) => r.Name === 'Kit goal hook');
        assert.ok(goalHook, 'no Kit goal hook report: ' + JSON.stringify(reports));
        assert.strictEqual(goalHook.Status, 'FAIL', JSON.stringify(goalHook));
        assert.match(goalHook.Detail, /hooks\.json unreadable:/, goalHook.Detail);
        assert.doesNotMatch(goalHook.Detail, /does not reference kit-goal-stop\.js/, goalHook.Detail);
        const canary = reports.find((r) => r.Name === 'Hook canary');
        assert.ok(canary, 'no Hook canary report: ' + JSON.stringify(reports));
        assert.strictEqual(canary.Status, 'FAIL', JSON.stringify(canary));
        assert.match(canary.Detail, /hooks\.json unreadable:/, canary.Detail);
        assert.doesNotMatch(canary.Detail, /does not reference hook-canary\.js/, canary.Detail);
    } finally {
        rmDir(dir);
    }
});

// The control proving the new unreadable branch does not swallow the
// healthy path: an ordinary, readable hooks.json still reaches the wiring
// check and reports PASS.
test('a readable hooks.json still reaches the wiring check (control)', { skip: !isWin }, () => {
    const dir = makeDir('doctor-enc-hooks-readable-');
    try {
        makeHooksFixture(dir);
        const reports = runHooksWiringSection(dir, null);
        const goalHook = reports.find((r) => r.Name === 'Kit goal hook');
        assert.ok(goalHook, 'no Kit goal hook report: ' + JSON.stringify(reports));
        assert.strictEqual(goalHook.Status, 'PASS', JSON.stringify(goalHook));
        const canary = reports.find((r) => r.Name === 'Hook canary');
        assert.ok(canary, 'no Hook canary report: ' + JSON.stringify(reports));
        assert.strictEqual(canary.Status, 'PASS', JSON.stringify(canary));
    } finally {
        rmDir(dir);
    }
});

// --- Clone signpost: the clone branch's -Fix rewrite, which merges into a
// parsed signpost to keep operator-set keys such as compactNudgeFloor rather
// than replacing the file with the plain two-key template. Lifted as source
// text between the section's own marker comments, with $claudeDir,
// $repoRoot, $Fix, $isClone, Report and Get-SanitizedLine stubbed; real
// doctor code otherwise. $repoRoot points at this repository's own worktree,
// whose core.hooksPath is already '.githooks', so the git-hooks half of the
// section reads as satisfied and never writes git config.
function runSignpostSection(claudeDir, fix, lockPath, access, share) {
    const outFile = path.join(os.tmpdir(), 'doctor-signpost-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const { lockLines, unlockLines } = buildLockLines(lockPath, access, share);
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$startMarker = "# --- Kaizen signpost + git hooks."',
        '$start = $src.IndexOf($startMarker)',
        'if ($start -lt 0) { throw "start marker not found in doctor.ps1" }',
        '$endMarker = "# --- Kit goal continuity."',
        '$end = $src.IndexOf($endMarker, $start)',
        'if ($end -lt 0) { throw "end marker not found after Kaizen signpost" }',
        '$section = $src.Substring($start, $end - $start)',
        '',
        '$script:Reports = @()',
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        '',
        '$isClone = $true',
        '$claudeDir = ' + q(claudeDir),
        '$repoRoot = ' + q(REPO),
        '$Fix = $' + (fix ? 'true' : 'false'),
        '',
        ...lockLines,
        'try {',
        '    Invoke-Expression $section',
        '} finally {',
        ...unlockLines,
        '}',
        '',
        '$__json = @{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = pwsh(script);
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        assert.ok(Array.isArray(parsed.Reports), 'Reports must be an array: ' + res.stdout);
        return parsed.Reports;
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

function makeSignpostFixture(dir, content) {
    const signpost = path.join(dir, 'claude-kit.local.json');
    fs.writeFileSync(signpost, content, 'utf8');
    return signpost;
}

test('an unreadable clone signpost is refused rather than overwritten under -Fix, and its bytes are unchanged', { skip: !isWin }, () => {
    const dir = makeDir('doctor-enc-signpost-locked-');
    try {
        const content = JSON.stringify({ kitRepoPath: 'C:\\does-not-exist-xyz', compactNudgeFloor: 7 });
        const signpost = makeSignpostFixture(dir, content);
        const before = fs.readFileSync(signpost);
        const reports = runSignpostSection(dir, true, signpost, 'Read', 'None');
        const after = fs.readFileSync(signpost);
        assert.deepStrictEqual(after, before, 'signpost bytes must be unchanged');
        const all = reports.map((r) => r.Detail).join('\n');
        assert.doesNotMatch(all, /Wrote .*claude-kit\.local\.json/, all);
        assert.match(all, /unreadable/, all);
        assert.ok(!fs.existsSync(signpost + '.tmp'), 'no leftover .tmp file');
    } finally {
        rmDir(dir);
    }
});

// Without -Fix, an unreadable signpost's advice names making the file
// readable, never "re-run with -Fix" alone: -Fix refuses that write, so the
// bare advice would send the operator round a loop. The second half is the
// control: a readable signpost with a stale kitRepoPath gets the bare -Fix
// advice, proving the pattern can match the line it is withheld from.
test('without -Fix, an unreadable clone signpost is advised to be made readable, not -Fix alone', { skip: !isWin }, () => {
    const bareFix = /^Fix: re-run doctor with -Fix\.$/;
    const dir = makeDir('doctor-enc-signpost-nofix-');
    try {
        const signpost = makeSignpostFixture(dir, JSON.stringify({ kitRepoPath: 'C:\does-not-exist-xyz' }));
        const locked = runSignpostSection(dir, false, signpost, 'Read', 'None');
        const lines = locked.flatMap((r) => r.Detail.split('\n'));
        assert.ok(lines.some((l) => /^Fix: make .*readable/.test(l)), lines.join('\n'));
        assert.ok(!lines.some((l) => bareFix.test(l)), lines.join('\n'));

        const readable = runSignpostSection(dir, false, null, null, null);
        const controlLines = readable.flatMap((r) => r.Detail.split('\n'));
        assert.ok(controlLines.some((l) => bareFix.test(l)), 'control: ' + controlLines.join('\n'));
    } finally {
        rmDir(dir);
    }
});

// The control proving the -Fix rewrite path still runs, and so that the
// byte-unchanged assertion above is evidence of the refusal rather than of a
// rewrite that happens to write identical bytes back: a readable signpost
// whose kitRepoPath no longer resolves is rewritten in place, and an
// operator-set key such as compactNudgeFloor survives the merge.
test('a readable clone signpost with an unresolvable kitRepoPath is rewritten under -Fix and keeps operator keys (control)', { skip: !isWin }, () => {
    const dir = makeDir('doctor-enc-signpost-control-');
    try {
        const content = JSON.stringify({ kitRepoPath: 'C:\\does-not-exist-xyz', compactNudgeFloor: 7 });
        const signpost = makeSignpostFixture(dir, content);
        const reports = runSignpostSection(dir, true, null, null, null);
        const after = JSON.parse(fs.readFileSync(signpost, 'utf8'));
        assert.strictEqual(after.kitRepoPath, REPO);
        assert.strictEqual(after.compactNudgeFloor, 7);
        const all = reports.map((r) => r.Detail).join('\n');
        assert.match(all, /Wrote .*claude-kit\.local\.json/, all);
    } finally {
        rmDir(dir);
    }
});

// The signpost is locked with FileShare.Read rather than None: that share
// lets Get-Content's own read through (so the run reaches the write path
// instead of the unreadable-file refusal above) while still denying the
// rename Move-Item performs to land the tmp file over it, which is what
// makes the Move-Item failure reproducible without touching permissions.
test('a failed Move-Item while writing the signpost is refused, not reported as written, and its .tmp file is cleaned up', { skip: !isWin }, () => {
    const dir = makeDir('doctor-enc-signpost-moveitem-');
    try {
        const content = JSON.stringify({ kitRepoPath: 'C:\\does-not-exist-xyz', compactNudgeFloor: 7 });
        const signpost = makeSignpostFixture(dir, content);
        const reports = runSignpostSection(dir, true, signpost, 'Read', 'Read');
        const all = reports.map((r) => r.Detail).join('\n');
        assert.doesNotMatch(all, /Wrote .*claude-kit\.local\.json/, all);
        assert.match(all, /Failed to write/, all);
        assert.ok(!fs.existsSync(signpost + '.tmp'), 'no leftover .tmp file after a failed rename');
    } finally {
        rmDir(dir);
    }
});

// The cleanup above removes only a temp file the run itself wrote. An empty
// directory already sitting at the .tmp path makes the write fail before
// anything is written, and it is not the doctor's to delete, so it survives.
test('a failed signpost write leaves a pre-existing item at the .tmp path alone', { skip: !isWin }, () => {
    const dir = makeDir('doctor-enc-signpost-foreign-tmp-');
    try {
        const content = JSON.stringify({ kitRepoPath: 'C:\\does-not-exist-xyz' });
        const signpost = makeSignpostFixture(dir, content);
        fs.mkdirSync(signpost + '.tmp');
        const reports = runSignpostSection(dir, true, null, null, null);
        const all = reports.map((r) => r.Detail).join('\n');
        assert.match(all, /Failed to write/, all);
        assert.ok(fs.statSync(signpost + '.tmp').isDirectory(), 'the pre-existing directory at the .tmp path is not deleted');
    } finally {
        rmDir(dir);
    }
});
