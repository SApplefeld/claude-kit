// Tests for the kaizen signpost write in the two installers that own
// ~/.claude/claude-kit.local.json: setup.sh (POSIX) and doctor.ps1 -Fix
// (Windows). Both writers merge into the existing object rather than
// replacing it wholesale, so an operator-set compactNudgeFloor (or any other
// key neither writer owns) survives a re-run. Both write to a sibling temp
// file and rename it into place, so a link of any kind standing at the
// signpost path has its directory entry replaced rather than being written
// through; and both report a link they find there rather than silently
// replacing an arrangement the operator made on purpose.
//
// Every case here builds its own fake HOME / claudeDir / repoRoot under a
// short-lived temp directory and passes it explicitly, so nothing touches the
// real ~/.claude/claude-kit.local.json.
//
// The doctor half lifts the "Kaizen signpost + git hooks" section of
// doctor.ps1 as source text and runs it (Invoke-Expression) inside a harness
// that stubs Report, the technique doctor-goal-state.test.js and
// embedder-install.test.js established. The red-first cases run the harness
// against a saved pre-fix copy of doctor.ps1 (checked out from HEAD before
// this round's edit landed) as well as the shipped file, mirroring that
// suite's DOCTOR_PREFIX pattern.
//
// The setup.sh half spawns the real script under `sh` with HOME redirected
// to a temp directory and a fake repo root that carries the one file
// setup.sh checks for (plugins/claude-kit/.claude-plugin/plugin.json) and is
// git-initialized, so the later git-hooks step (which runs under `set -e`)
// does not abort the run. Its red-first cases spawn a saved pre-fix copy of
// setup.sh the same way.
//
// The link cases come in two kinds, because the two link types cost different
// privileges on Windows. A file symbolic link needs elevation or Developer
// Mode, so those cases skip on a machine that has neither, announcing the skip
// with its reason. A hard link and a directory junction need neither, so the
// write-through case and the refusal case both run everywhere.

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
const SETUP_SH = path.join(REPO, 'setup.sh');
// Pre-fix copies, saved to gitignored scratch from HEAD before this section's
// edit landed, so the red cases can prove themselves against the exact code
// they are meant to catch. They are absent on any checkout that did not run
// that fix round, and a red half whose subject is absent proves nothing while
// reading as a pass, so every case carrying one announces the gap through
// t.diagnostic() rather than passing in silence.
const DOCTOR_PREFIX = path.join(REPO, '.kit', 'scratch', 'doctor-prefix-s5.ps1');
const SETUP_PREFIX = path.join(REPO, '.kit', 'scratch', 'setup-prefix-s5.sh');
const isWin = process.platform === 'win32';
const hasDoctorPrefix = isWin && fs.existsSync(DOCTOR_PREFIX);

function findSh() {
    const gitBashSh = 'C:\\Program Files\\Git\\usr\\bin\\sh.exe';
    if (isWin && fs.existsSync(gitBashSh)) return gitBashSh;
    const probe = spawnSync(isWin ? 'where' : 'which', ['sh'], { encoding: 'utf8' });
    if (probe.status === 0) return 'sh';
    return null;
}
const SH_BIN = findSh();
const hasSetupPrefix = !!SH_BIN && fs.existsSync(SETUP_PREFIX);

// Announces a red half that did not run, so the case cannot report green under
// a title claiming it proved a direction it never exercised.
function noteMissingRed(t, present, copy) {
    if (present) return;
    t.diagnostic('red-first control skipped: ' + copy + ' is absent, so this run proves the fixed behaviour only, not that the pre-fix writer failed it.');
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function pwsh(script) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', env: process.env });
}

function write(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
}

function makeTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmTempDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

// A directory junction is a reparse point, which is what both writers' link
// checks read, and unlike a file symbolic link it needs no elevation. That is
// what lets the refusal path itself run on an ordinary Windows box. Returns
// false when the platform or the shell cannot make one, so the caller skips
// rather than failing.
function makeJunction(linkPath, targetDir) {
    if (!isWin) return false;
    const res = spawnSync('cmd', ['/c', 'mklink', '/J', linkPath, targetDir], { encoding: 'utf8' });
    return res.status === 0;
}

// PATH with every entry that carries a node executable removed, so a spawned
// script sees a machine without node while keeping git, hostname and the rest
// of the shell's own tools.
function pathWithoutNode() {
    const sep = isWin ? ';' : ':';
    const exe = isWin ? 'node.exe' : 'node';
    return (process.env.PATH || '')
        .split(sep)
        .filter((entry) => {
            if (!entry) return false;
            try { return !fs.existsSync(path.join(entry, exe)); } catch { return true; }
        })
        .join(sep);
}

// --- Doctor half. -----------------------------------------------------

// Lifts the "Kaizen signpost + git hooks" section of doctor.ps1 (the same
// $isClone block the code anchors in the brief describe) as source text and
// runs it against a real claudeDir/repoRoot on disk. doctorPath defaults to
// the shipped doctor.ps1; passing DOCTOR_PREFIX runs the same harness against
// the pre-fix copy, which is how the red cases below prove their direction.
function runSignpostSection(claudeDir, repoRoot, doctorPath) {
    const outFile = path.join(os.tmpdir(), 'kaizen-signpost-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(doctorPath || DOCTOR) + ')',
        '$startMarker = "# --- Kaizen signpost + git hooks."',
        '$start = $src.IndexOf($startMarker)',
        'if ($start -lt 0) { throw "start marker not found in doctor.ps1" }',
        '$endMarker = "# --- Kit goal continuity."',
        '$end = $src.IndexOf($endMarker, $start)',
        'if ($end -lt 0) { throw "end marker not found after the signpost block" }',
        '$section = $src.Substring($start, $end - $start)',
        '',
        '$script:Reports = @()',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        '',
        '$Fix = $true',
        '$isClone = $true',
        '$claudeDir = ' + q(claudeDir),
        '$repoRoot = ' + q(repoRoot),
        '',
        'Invoke-Expression $section',
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

function readSignpost(claudeDir) {
    return JSON.parse(fs.readFileSync(path.join(claudeDir, 'claude-kit.local.json'), 'utf8'));
}

test('doctor -Fix: a floor beside the owned keys survives a rewrite reached via the kitRepoPath-no-longer-resolves branch (red against the pre-fix writer)', { skip: !isWin }, (t) => {
    noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
    const claudeDir = makeTempDir('doctor-signpost-floor-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    try {
        const staleRepoPath = path.join(os.tmpdir(), 'kit-repo-that-does-not-exist-' + Math.random().toString(36).slice(2));
        write(path.join(claudeDir, 'claude-kit.local.json'), JSON.stringify({ kitRepoPath: staleRepoPath, machine: 'old-machine', compactNudgeFloor: 42000 }));

        if (hasDoctorPrefix) {
            const claudeDirRed = makeTempDir('doctor-signpost-floor-red-');
            try {
                write(path.join(claudeDirRed, 'claude-kit.local.json'), JSON.stringify({ kitRepoPath: staleRepoPath, machine: 'old-machine', compactNudgeFloor: 42000 }));
                runSignpostSection(claudeDirRed, repoRoot, DOCTOR_PREFIX);
                const redResult = readSignpost(claudeDirRed);
                assert.strictEqual(redResult.compactNudgeFloor, undefined, 'pre-fix doctor.ps1 must drop compactNudgeFloor on the wholesale rewrite: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(claudeDirRed);
            }
        }

        runSignpostSection(claudeDir, repoRoot, DOCTOR);
        const result = readSignpost(claudeDir);
        assert.strictEqual(result.compactNudgeFloor, 42000, 'the operator-set floor must survive the merge: ' + JSON.stringify(result));
        assert.strictEqual(result.kitRepoPath, repoRoot);
        assert.strictEqual(result.machine, process.env.COMPUTERNAME);
        assert.deepStrictEqual(fs.readdirSync(claudeDir), ['claude-kit.local.json'], 'the temp file the write renames from must not survive the run');
    } finally {
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
    }
});

// Every value in the cases above is a flat scalar, which is exactly what a
// depth-limited serializer renders correctly. A nested operator value is what
// tells a real merge from one that keeps the key and replaces the value with a
// PowerShell ToString() of the object.
test('doctor -Fix: a nested operator value survives the merge intact, not as a stringified object (red against the pre-fix writer)', { skip: !isWin }, (t) => {
    noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
    const claudeDir = makeTempDir('doctor-signpost-nested-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    try {
        const staleRepoPath = path.join(os.tmpdir(), 'kit-repo-that-does-not-exist-' + Math.random().toString(36).slice(2));
        const nested = { kitRepoPath: staleRepoPath, machine: 'old-machine', operatorNested: { a: { b: { c: 'deep value' } } } };
        write(path.join(claudeDir, 'claude-kit.local.json'), JSON.stringify(nested));

        if (hasDoctorPrefix) {
            const claudeDirRed = makeTempDir('doctor-signpost-nested-red-');
            try {
                write(path.join(claudeDirRed, 'claude-kit.local.json'), JSON.stringify(nested));
                runSignpostSection(claudeDirRed, repoRoot, DOCTOR_PREFIX);
                const redResult = readSignpost(claudeDirRed);
                assert.strictEqual(redResult.operatorNested, undefined, 'pre-fix doctor.ps1 must drop the nested key on the wholesale rewrite: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(claudeDirRed);
            }
        }

        runSignpostSection(claudeDir, repoRoot, DOCTOR);
        const result = readSignpost(claudeDir);
        assert.deepStrictEqual(result.operatorNested, { a: { b: { c: 'deep value' } } }, 'the nested operator value must round-trip unchanged: ' + JSON.stringify(result));
        assert.strictEqual(result.kitRepoPath, repoRoot);
    } finally {
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
    }
});

test('doctor -Fix: an absent signpost is still created with just the two owned keys (control)', { skip: !isWin }, (t) => {
    noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
    const claudeDir = makeTempDir('doctor-signpost-absent-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    try {
        runSignpostSection(claudeDir, repoRoot, DOCTOR);
        const result = readSignpost(claudeDir);
        assert.deepStrictEqual(Object.keys(result).sort(), ['kitRepoPath', 'machine']);
        assert.strictEqual(result.kitRepoPath, repoRoot);
        assert.strictEqual(result.machine, process.env.COMPUTERNAME);

        if (hasDoctorPrefix) {
            const claudeDirRed = makeTempDir('doctor-signpost-absent-red-');
            try {
                runSignpostSection(claudeDirRed, repoRoot, DOCTOR_PREFIX);
                const redResult = readSignpost(claudeDirRed);
                assert.deepStrictEqual(Object.keys(redResult).sort(), ['kitRepoPath', 'machine'], 'unchanged behaviour on the pre-fix writer too: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(claudeDirRed);
            }
        }
    } finally {
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
    }
});

test('doctor -Fix: a signpost whose JSON does not parse is still replaced wholesale (control)', { skip: !isWin }, (t) => {
    noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
    const claudeDir = makeTempDir('doctor-signpost-unparseable-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    try {
        write(path.join(claudeDir, 'claude-kit.local.json'), '{ not json');
        runSignpostSection(claudeDir, repoRoot, DOCTOR);
        const result = readSignpost(claudeDir);
        assert.deepStrictEqual(Object.keys(result).sort(), ['kitRepoPath', 'machine']);
        assert.strictEqual(result.kitRepoPath, repoRoot);

        if (hasDoctorPrefix) {
            const claudeDirRed = makeTempDir('doctor-signpost-unparseable-red-');
            try {
                write(path.join(claudeDirRed, 'claude-kit.local.json'), '{ not json');
                runSignpostSection(claudeDirRed, repoRoot, DOCTOR_PREFIX);
                const redResult = readSignpost(claudeDirRed);
                assert.deepStrictEqual(Object.keys(redResult).sort(), ['kitRepoPath', 'machine'], 'unchanged behaviour on the pre-fix writer too: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(claudeDirRed);
            }
        }
    } finally {
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
    }
});

// JSON that parses to an array or a scalar is not an object to merge into.
// Feeding one to the property loop would copy .NET's adapter members (Count,
// Length, SyncRoot and the rest) into the operator's config as keys, and it is
// reachable because an array carries no kitRepoPath and so reads as invalid.
// The "does not parse" case above cannot catch it: that content throws, and a
// throw takes the null path rather than this one.
test('doctor -Fix: a signpost whose JSON parses to an array takes the two-key template, not the adapter members (control)', { skip: !isWin }, (t) => {
    noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
    const claudeDir = makeTempDir('doctor-signpost-array-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    try {
        write(path.join(claudeDir, 'claude-kit.local.json'), '[1,2,3]');
        runSignpostSection(claudeDir, repoRoot, DOCTOR);
        const result = readSignpost(claudeDir);
        assert.deepStrictEqual(Object.keys(result).sort(), ['kitRepoPath', 'machine'], 'an array signpost must not contribute keys: ' + JSON.stringify(result));
        assert.strictEqual(result.kitRepoPath, repoRoot);

        if (hasDoctorPrefix) {
            const claudeDirRed = makeTempDir('doctor-signpost-array-red-');
            try {
                write(path.join(claudeDirRed, 'claude-kit.local.json'), '[1,2,3]');
                runSignpostSection(claudeDirRed, repoRoot, DOCTOR_PREFIX);
                const redResult = readSignpost(claudeDirRed);
                assert.deepStrictEqual(Object.keys(redResult).sort(), ['kitRepoPath', 'machine'], 'unchanged behaviour on the pre-fix writer too: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(claudeDirRed);
            }
        }
    } finally {
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
    }
});

// The write-through case that costs no privilege. A hard link is a second
// directory entry for one inode, so an in-place write at the signpost path
// truncates and rewrites whatever else that inode is named by; only replacing
// the directory entry leaves the other name alone.
test('doctor -Fix: a hard link at the signpost path is replaced, not written through, and the file sharing its inode is left byte-identical (red against the pre-fix writer)', { skip: !isWin }, (t) => {
    noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
    const claudeDir = makeTempDir('doctor-signpost-hardlink-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    const decoyDir = makeTempDir('doctor-signpost-decoy-');
    try {
        const decoyContent = '{"secret":"do-not-touch","compactNudgeFloor":9999}';

        if (hasDoctorPrefix) {
            const claudeDirRed = makeTempDir('doctor-signpost-hardlink-red-');
            const decoyRed = path.join(decoyDir, 'decoy-red.json');
            try {
                write(decoyRed, decoyContent);
                fs.linkSync(decoyRed, path.join(claudeDirRed, 'claude-kit.local.json'));
                runSignpostSection(claudeDirRed, repoRoot, DOCTOR_PREFIX);
                const afterRed = fs.readFileSync(decoyRed, 'utf8');
                assert.notStrictEqual(afterRed, decoyContent, 'pre-fix doctor.ps1 must write through the hard link and overwrite the shared inode: ' + afterRed);
            } finally {
                rmTempDir(claudeDirRed);
            }
        }

        const decoyTarget = path.join(decoyDir, 'decoy.json');
        write(decoyTarget, decoyContent);
        const signpostPath = path.join(claudeDir, 'claude-kit.local.json');
        fs.linkSync(decoyTarget, signpostPath);
        const linkedBefore = fs.statSync(signpostPath).nlink;

        runSignpostSection(claudeDir, repoRoot, DOCTOR);
        assert.strictEqual(fs.readFileSync(decoyTarget, 'utf8'), decoyContent, 'the file sharing the inode must be left byte-identical');
        const result = readSignpost(claudeDir);
        assert.strictEqual(result.kitRepoPath, repoRoot);
        assert.strictEqual(result.compactNudgeFloor, 9999, 'the merge still reads what stood at the signpost path: ' + JSON.stringify(result));
        if (linkedBefore === 2) {
            assert.strictEqual(fs.statSync(signpostPath).nlink, 1, 'the signpost must be a fresh directory entry rather than the shared inode');
        }
        assert.deepStrictEqual(fs.readdirSync(claudeDir), ['claude-kit.local.json'], 'the temp file the write renames from must not survive the run');
    } finally {
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
        rmTempDir(decoyDir);
    }
});

// The refusal path itself, executed. A directory junction is a reparse point,
// which is what the writer's link check reads, and it needs no elevation, so
// this runs where the file-symlink case below can only skip.
test('doctor -Fix: a reparse point at the signpost path is refused, and the refusal is a WARN rather than a FIXED note', { skip: !isWin }, (t) => {
    const claudeDir = makeTempDir('doctor-signpost-junction-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    const decoyDir = makeTempDir('doctor-signpost-jtarget-');
    try {
        const signpostPath = path.join(claudeDir, 'claude-kit.local.json');
        if (!makeJunction(signpostPath, decoyDir)) {
            t.skip('mklink /J failed on this machine; the refusal path is unverified here.');
            return;
        }

        if (hasDoctorPrefix) {
            const claudeDirRed = makeTempDir('doctor-signpost-junction-red-');
            const decoyRed = makeTempDir('doctor-signpost-jtarget-red-');
            try {
                if (makeJunction(path.join(claudeDirRed, 'claude-kit.local.json'), decoyRed)) {
                    let redReports = null;
                    // The pre-fix writer has no link check at all: it either
                    // reports no refusal or fails outright on the reparse
                    // point. Both are the red direction; neither is a refusal.
                    try { redReports = runSignpostSection(claudeDirRed, repoRoot, DOCTOR_PREFIX); } catch { redReports = null; }
                    const redRefused = (redReports || []).some((r) => /is a link/i.test(r.Detail));
                    assert.ok(!redRefused, 'pre-fix doctor.ps1 must carry no link refusal: ' + JSON.stringify(redReports));
                }
            } finally {
                rmTempDir(claudeDirRed);
                rmTempDir(decoyRed);
            }
        } else {
            noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
        }

        const reports = runSignpostSection(claudeDir, repoRoot, DOCTOR);
        const refusals = reports.filter((r) => /is a link/i.test(r.Detail));
        assert.strictEqual(refusals.length, 1, 'the refusal must be reported exactly once: ' + JSON.stringify(reports));
        assert.strictEqual(refusals[0].Status, 'WARN', 'a refused write must not report as a repair: ' + JSON.stringify(refusals[0]));
        const fixed = reports.filter((r) => r.Status === 'FIXED');
        for (const report of fixed) {
            assert.doesNotMatch(report.Detail, /is a link/i, 'the refusal must not ride the FIXED note list: ' + JSON.stringify(report));
        }
        assert.deepStrictEqual(fs.readdirSync(decoyDir), [], 'nothing may be written through the reparse point');
    } finally {
        // The junction must go before the directory holding it, or the
        // recursive remove walks through it into the target.
        try { fs.rmdirSync(path.join(claudeDir, 'claude-kit.local.json')); } catch { /* absent when mklink failed */ }
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
        rmTempDir(decoyDir);
    }
});

test('doctor -Fix: a symbolic link at the signpost path is refused, and the file it points at is left byte-identical (red against the pre-fix writer)', { skip: !isWin }, (t) => {
    noteMissingRed(t, hasDoctorPrefix, DOCTOR_PREFIX);
    const claudeDir = makeTempDir('doctor-signpost-symlink-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    const decoyDir = makeTempDir('doctor-signpost-decoy-');
    try {
        const decoyTarget = path.join(decoyDir, 'decoy.json');
        const decoyContent = '{"secret":"do-not-touch","compactNudgeFloor":9999}';
        write(decoyTarget, decoyContent);
        const signpostPath = path.join(claudeDir, 'claude-kit.local.json');
        try {
            fs.symlinkSync(decoyTarget, signpostPath, 'file');
        } catch (err) {
            if (err.code === 'EPERM') {
                t.skip('fs.symlinkSync raised EPERM on this machine (needs elevation or Developer Mode); the file-symlink case is unverified here, though the junction case above exercises the same refusal.');
                return;
            }
            throw err;
        }

        if (hasDoctorPrefix) {
            runSignpostSection(claudeDir, repoRoot, DOCTOR_PREFIX);
            const afterRed = fs.readFileSync(decoyTarget, 'utf8');
            assert.notStrictEqual(afterRed, decoyContent, 'pre-fix doctor.ps1 must follow the symlink and overwrite the decoy target: ' + afterRed);
            // Restore the decoy for the green run below.
            write(decoyTarget, decoyContent);
        }

        const reports = runSignpostSection(claudeDir, repoRoot, DOCTOR);
        const afterGreen = fs.readFileSync(decoyTarget, 'utf8');
        assert.strictEqual(afterGreen, decoyContent, 'the decoy target must be left byte-identical: ' + afterGreen);
        const refusals = reports.filter((r) => /is a link/i.test(r.Detail));
        assert.strictEqual(refusals.length, 1, 'the refusal must be reported: ' + JSON.stringify(reports));
        assert.strictEqual(refusals[0].Status, 'WARN', 'a refused write must not report as a repair: ' + JSON.stringify(refusals[0]));
    } finally {
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
        rmTempDir(decoyDir);
    }
});

// The plain (no -Fix) branch, whose advice has to name the link. Nothing was
// written, so the gap persists at every run, and "re-run with -Fix" alone is
// advice the refusal guarantees will not work.
test('doctor without -Fix: a reparse point at the signpost path is named as the blocker in the WARN', { skip: !isWin }, (t) => {
    const claudeDir = makeTempDir('doctor-signpost-junction-warn-');
    const repoRoot = makeTempDir('doctor-signpost-repo-');
    const decoyDir = makeTempDir('doctor-signpost-jtarget-warn-');
    try {
        const signpostPath = path.join(claudeDir, 'claude-kit.local.json');
        if (!makeJunction(signpostPath, decoyDir)) {
            t.skip('mklink /J failed on this machine; the non-fix advice path is unverified here.');
            return;
        }
        const outFile = path.join(os.tmpdir(), 'kaizen-signpost-warn-' + process.pid + '-' + Date.now() + '.json');
        const script = [
            '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
            '$start = $src.IndexOf("# --- Kaizen signpost + git hooks.")',
            '$end = $src.IndexOf("# --- Kit goal continuity.", $start)',
            '$section = $src.Substring($start, $end - $start)',
            '$script:Reports = @()',
            'function Report {',
            '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
            '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
            '}',
            '$Fix = $false',
            '$isClone = $true',
            '$claudeDir = ' + q(claudeDir),
            '$repoRoot = ' + q(repoRoot),
            'Invoke-Expression $section',
            '$__json = @{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6',
            '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
        ].join('\n');
        const res = pwsh(script);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const reports = JSON.parse(fs.readFileSync(outFile, 'utf8')).Reports;
        fs.unlinkSync(outFile);
        const warn = reports.find((r) => r.Status === 'WARN');
        assert.ok(warn, 'the gap must be reported: ' + JSON.stringify(reports));
        assert.match(warn.Detail, /is a link/i, 'the link must be named as the blocker: ' + warn.Detail);
        assert.match(warn.Detail, /remove the link/i, 'the advice must be one that can actually clear the gap: ' + warn.Detail);
    } finally {
        try { fs.rmdirSync(path.join(claudeDir, 'claude-kit.local.json')); } catch { /* absent when mklink failed */ }
        rmTempDir(claudeDir);
        rmTempDir(repoRoot);
        rmTempDir(decoyDir);
    }
});

// --- setup.sh half. -----------------------------------------------------

// Spawns setup.sh (or a pre-fix copy) with HOME redirected to a temp
// directory and cwd set to a fake repo root carrying the one file setup.sh
// validates for (plugins/claude-kit/.claude-plugin/plugin.json), git-
// initialized so the later `git config core.hooksPath` step (which runs
// under `set -e`) does not abort the script. extraEnv overrides the child's
// environment, which is how the no-node cases hand it a PATH without one.
function runSetupSh(fakeRoot, home, scriptPath, extraEnv) {
    write(path.join(fakeRoot, 'plugins', 'claude-kit', '.claude-plugin', 'plugin.json'), '{}');
    const scriptText = fs.readFileSync(scriptPath || SETUP_SH, 'utf8');
    const scriptDest = path.join(fakeRoot, 'setup.sh');
    write(scriptDest, scriptText);
    spawnSync('git', ['init', '-q', fakeRoot], { encoding: 'utf8' });
    const res = spawnSync(SH_BIN, ['setup.sh'], {
        cwd: fakeRoot,
        encoding: 'utf8',
        env: { ...process.env, HOME: home, ...(extraEnv || {}) }
    });
    return res;
}

function readSetupSignpost(home) {
    return JSON.parse(fs.readFileSync(path.join(home, '.claude', 'claude-kit.local.json'), 'utf8'));
}

// setup.sh resolves its own SCRIPT_DIR via `cd ... && pwd` under Git Bash,
// which prints POSIX-style forward-slash paths, while fakeRoot here is a
// Windows-style path from Node's os.tmpdir(). Both name the same directory;
// this normalizes separators and case (Windows paths are case-insensitive)
// so the comparison is about identity, not spelling.
function samePath(a, b) {
    const norm = (p) => p.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
    return norm(a) === norm(b);
}

test('setup.sh: a floor beside the owned keys survives a re-run (red against the pre-fix script)', { skip: !SH_BIN }, (t) => {
    noteMissingRed(t, hasSetupPrefix, SETUP_PREFIX);
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-');
    try {
        write(path.join(home, '.claude', 'claude-kit.local.json'), JSON.stringify({ kitRepoPath: '/somewhere/else', machine: 'old-machine', compactNudgeFloor: 42000 }));

        if (hasSetupPrefix) {
            const homeRed = makeTempDir('setup-signpost-home-red-');
            try {
                write(path.join(homeRed, '.claude', 'claude-kit.local.json'), JSON.stringify({ kitRepoPath: '/somewhere/else', machine: 'old-machine', compactNudgeFloor: 42000 }));
                const resRed = runSetupSh(fakeRoot, homeRed, SETUP_PREFIX);
                assert.strictEqual(resRed.status, 0, resRed.stdout + resRed.stderr);
                const redResult = readSetupSignpost(homeRed);
                assert.strictEqual(redResult.compactNudgeFloor, undefined, 'pre-fix setup.sh must drop compactNudgeFloor on the wholesale rewrite: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(homeRed);
            }
        }

        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const result = readSetupSignpost(home);
        assert.strictEqual(result.compactNudgeFloor, 42000, 'the operator-set floor must survive the merge: ' + JSON.stringify(result));
        assert.ok(samePath(result.kitRepoPath, fakeRoot), 'kitRepoPath (' + result.kitRepoPath + ') must resolve to the fake repo root (' + fakeRoot + ')');
        assert.deepStrictEqual(fs.readdirSync(path.join(home, '.claude')), ['claude-kit.local.json'], 'the temp file the write renames from must not survive the run');
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
    }
});

test('setup.sh: a nested operator value survives the merge intact (red against the pre-fix script)', { skip: !SH_BIN }, (t) => {
    noteMissingRed(t, hasSetupPrefix, SETUP_PREFIX);
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-nested-');
    try {
        const nested = { kitRepoPath: '/somewhere/else', machine: 'old-machine', operatorNested: { a: { b: { c: 'deep value' } } } };
        write(path.join(home, '.claude', 'claude-kit.local.json'), JSON.stringify(nested));

        if (hasSetupPrefix) {
            const homeRed = makeTempDir('setup-signpost-home-nested-red-');
            try {
                write(path.join(homeRed, '.claude', 'claude-kit.local.json'), JSON.stringify(nested));
                const resRed = runSetupSh(fakeRoot, homeRed, SETUP_PREFIX);
                assert.strictEqual(resRed.status, 0, resRed.stdout + resRed.stderr);
                assert.strictEqual(readSetupSignpost(homeRed).operatorNested, undefined, 'pre-fix setup.sh must drop the nested key on the wholesale rewrite');
            } finally {
                rmTempDir(homeRed);
            }
        }

        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.deepStrictEqual(readSetupSignpost(home).operatorNested, { a: { b: { c: 'deep value' } } }, 'the nested operator value must round-trip unchanged');
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
    }
});

test('setup.sh: an absent signpost is still created with just the two owned keys (control)', { skip: !SH_BIN }, (t) => {
    noteMissingRed(t, hasSetupPrefix, SETUP_PREFIX);
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-absent-');
    try {
        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const result = readSetupSignpost(home);
        assert.deepStrictEqual(Object.keys(result).sort(), ['kitRepoPath', 'machine']);
        assert.ok(samePath(result.kitRepoPath, fakeRoot), 'kitRepoPath (' + result.kitRepoPath + ') must resolve to the fake repo root (' + fakeRoot + ')');

        if (hasSetupPrefix) {
            const homeRed = makeTempDir('setup-signpost-home-absent-red-');
            try {
                const resRed = runSetupSh(fakeRoot, homeRed, SETUP_PREFIX);
                assert.strictEqual(resRed.status, 0, resRed.stdout + resRed.stderr);
                const redResult = readSetupSignpost(homeRed);
                assert.deepStrictEqual(Object.keys(redResult).sort(), ['kitRepoPath', 'machine'], 'unchanged behaviour on the pre-fix script too: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(homeRed);
            }
        }
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
    }
});

test('setup.sh: a signpost whose JSON does not parse is still replaced wholesale (control)', { skip: !SH_BIN }, (t) => {
    noteMissingRed(t, hasSetupPrefix, SETUP_PREFIX);
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-unparseable-');
    try {
        write(path.join(home, '.claude', 'claude-kit.local.json'), '{ not json');
        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const result = readSetupSignpost(home);
        assert.deepStrictEqual(Object.keys(result).sort(), ['kitRepoPath', 'machine']);

        if (hasSetupPrefix) {
            const homeRed = makeTempDir('setup-signpost-home-unparseable-red-');
            try {
                write(path.join(homeRed, '.claude', 'claude-kit.local.json'), '{ not json');
                const resRed = runSetupSh(fakeRoot, homeRed, SETUP_PREFIX);
                assert.strictEqual(resRed.status, 0, resRed.stdout + resRed.stderr);
                const redResult = readSetupSignpost(homeRed);
                assert.deepStrictEqual(Object.keys(redResult).sort(), ['kitRepoPath', 'machine'], 'unchanged behaviour on the pre-fix script too: ' + JSON.stringify(redResult));
            } finally {
                rmTempDir(homeRed);
            }
        }
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
    }
});

test('setup.sh: a signpost whose JSON parses to an array takes the two-key template (control)', { skip: !SH_BIN }, () => {
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-array-');
    try {
        write(path.join(home, '.claude', 'claude-kit.local.json'), '[1,2,3]');
        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const result = readSetupSignpost(home);
        assert.deepStrictEqual(Object.keys(result).sort(), ['kitRepoPath', 'machine'], 'an array signpost must not contribute keys: ' + JSON.stringify(result));
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
    }
});

test('setup.sh: a hard link at the signpost path is replaced, not written through, and the file sharing its inode is left byte-identical (red against the pre-fix script)', { skip: !SH_BIN }, (t) => {
    noteMissingRed(t, hasSetupPrefix, SETUP_PREFIX);
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-hardlink-');
    const decoyDir = makeTempDir('setup-signpost-decoy-');
    try {
        const decoyContent = '{"secret":"do-not-touch","compactNudgeFloor":9999}';

        if (hasSetupPrefix) {
            const homeRed = makeTempDir('setup-signpost-home-hardlink-red-');
            const decoyRed = path.join(decoyDir, 'decoy-red.json');
            try {
                write(decoyRed, decoyContent);
                fs.mkdirSync(path.join(homeRed, '.claude'), { recursive: true });
                fs.linkSync(decoyRed, path.join(homeRed, '.claude', 'claude-kit.local.json'));
                runSetupSh(fakeRoot, homeRed, SETUP_PREFIX);
                assert.notStrictEqual(fs.readFileSync(decoyRed, 'utf8'), decoyContent, 'pre-fix setup.sh must write through the hard link and overwrite the shared inode');
            } finally {
                rmTempDir(homeRed);
            }
        }

        const decoyTarget = path.join(decoyDir, 'decoy.json');
        write(decoyTarget, decoyContent);
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        const signpostPath = path.join(home, '.claude', 'claude-kit.local.json');
        fs.linkSync(decoyTarget, signpostPath);
        const linkedBefore = fs.statSync(signpostPath).nlink;

        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.strictEqual(fs.readFileSync(decoyTarget, 'utf8'), decoyContent, 'the file sharing the inode must be left byte-identical');
        const result = readSetupSignpost(home);
        assert.strictEqual(result.compactNudgeFloor, 9999, 'the merge still reads what stood at the signpost path: ' + JSON.stringify(result));
        assert.ok(samePath(result.kitRepoPath, fakeRoot), 'kitRepoPath (' + result.kitRepoPath + ') must resolve to the fake repo root (' + fakeRoot + ')');
        if (linkedBefore === 2) {
            assert.strictEqual(fs.statSync(signpostPath).nlink, 1, 'the signpost must be a fresh directory entry rather than the shared inode');
        }
        assert.deepStrictEqual(fs.readdirSync(path.join(home, '.claude')), ['claude-kit.local.json'], 'the temp file the write renames from must not survive the run');
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
        rmTempDir(decoyDir);
    }
});

test('setup.sh: a reparse point at the signpost path is refused and the run exits non-zero', { skip: !SH_BIN || !isWin }, (t) => {
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-junction-');
    const decoyDir = makeTempDir('setup-signpost-jtarget-');
    try {
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        const signpostPath = path.join(home, '.claude', 'claude-kit.local.json');
        if (!makeJunction(signpostPath, decoyDir)) {
            t.skip('mklink /J failed on this machine; the refusal path is unverified here.');
            return;
        }

        if (hasSetupPrefix) {
            const homeRed = makeTempDir('setup-signpost-home-junction-red-');
            const decoyRed = makeTempDir('setup-signpost-jtarget-red-');
            try {
                fs.mkdirSync(path.join(homeRed, '.claude'), { recursive: true });
                if (makeJunction(path.join(homeRed, '.claude', 'claude-kit.local.json'), decoyRed)) {
                    const resRed = runSetupSh(fakeRoot, homeRed, SETUP_PREFIX);
                    assert.doesNotMatch(resRed.stderr, /is a link/i, 'pre-fix setup.sh must carry no link refusal: ' + resRed.stderr);
                }
            } finally {
                try { fs.rmdirSync(path.join(homeRed, '.claude', 'claude-kit.local.json')); } catch { /* absent when mklink failed */ }
                rmTempDir(homeRed);
                rmTempDir(decoyRed);
            }
        } else {
            noteMissingRed(t, hasSetupPrefix, SETUP_PREFIX);
        }

        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.notStrictEqual(res.status, 0, 'a refused signpost write must not report a successful run: ' + res.stdout + res.stderr);
        assert.match(res.stderr, /is a link/i, 'the refusal must be reported: ' + res.stderr);
        assert.match(res.stdout, /core\.hooksPath/, 'the rest of setup must still run: ' + res.stdout);
        assert.deepStrictEqual(fs.readdirSync(decoyDir), [], 'nothing may be written through the reparse point');
    } finally {
        try { fs.rmdirSync(path.join(home, '.claude', 'claude-kit.local.json')); } catch { /* absent when mklink failed */ }
        rmTempDir(fakeRoot);
        rmTempDir(home);
        rmTempDir(decoyDir);
    }
});

test('setup.sh: a symbolic link at the signpost path is refused, and the file it points at is left byte-identical (red against the pre-fix script)', { skip: !SH_BIN }, (t) => {
    noteMissingRed(t, hasSetupPrefix, SETUP_PREFIX);
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-symlink-');
    const decoyDir = makeTempDir('setup-signpost-decoy-');
    try {
        const decoyTarget = path.join(decoyDir, 'decoy.json');
        const decoyContent = '{"secret":"do-not-touch","compactNudgeFloor":9999}';
        write(decoyTarget, decoyContent);
        fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
        const signpostPath = path.join(home, '.claude', 'claude-kit.local.json');
        try {
            fs.symlinkSync(decoyTarget, signpostPath, 'file');
        } catch (err) {
            if (err.code === 'EPERM') {
                t.skip('fs.symlinkSync raised EPERM on this machine (needs elevation or Developer Mode); the file-symlink case is unverified here, though the junction case above exercises the same refusal.');
                return;
            }
            throw err;
        }

        if (hasSetupPrefix) {
            const resRed = runSetupSh(fakeRoot, home, SETUP_PREFIX);
            assert.strictEqual(resRed.status, 0, resRed.stdout + resRed.stderr);
            const afterRed = fs.readFileSync(decoyTarget, 'utf8');
            assert.notStrictEqual(afterRed, decoyContent, 'pre-fix setup.sh must follow the symlink and overwrite the decoy target: ' + afterRed);
            write(decoyTarget, decoyContent);
        }

        const res = runSetupSh(fakeRoot, home, SETUP_SH);
        assert.notStrictEqual(res.status, 0, 'a refused signpost write must not report a successful run: ' + res.stdout + res.stderr);
        const afterGreen = fs.readFileSync(decoyTarget, 'utf8');
        assert.strictEqual(afterGreen, decoyContent, 'the decoy target must be left byte-identical: ' + afterGreen);
        assert.match(res.stderr, /is a link/i, 'the refusal must be reported: ' + res.stderr);
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
        rmTempDir(decoyDir);
    }
});

// setup.sh runs on a fresh clone, before the plugin (and so before node) is
// necessarily installed, so a missing node must not abort it under `set -e`.
// An absent signpost still gets the two-key template it always got; an
// existing one is left alone, because the wholesale write that would replace
// it is exactly the data loss the merge exists to remove.
test('setup.sh without node: an absent signpost still gets the two-key template and the run completes', { skip: !SH_BIN }, () => {
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-nonode-absent-');
    try {
        const res = runSetupSh(fakeRoot, home, SETUP_SH, { PATH: pathWithoutNode() });
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const result = readSetupSignpost(home);
        assert.deepStrictEqual(Object.keys(result).sort(), ['kitRepoPath', 'machine']);
        // The template writes the shell's own spelling of SCRIPT_DIR, which
        // under Git Bash is a POSIX path (/tmp/...) where the node merge gets
        // the Windows one, MSYS rewriting path-shaped variables on the way
        // into a native binary. Both name this directory; the assertion is
        // about which directory, so it pins the leaf rather than the spelling.
        assert.ok(result.kitRepoPath.endsWith(path.basename(fakeRoot)), 'kitRepoPath (' + result.kitRepoPath + ') must name the fake repo root (' + fakeRoot + ')');
        assert.match(res.stdout, /core\.hooksPath/, 'the run must continue to the git-hooks wiring: ' + res.stdout);
        assert.match(res.stdout, /Next:/, 'the run must reach its closing hints: ' + res.stdout);
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
    }
});

test('setup.sh without node: an existing signpost is left untouched rather than flattened, and the run completes', { skip: !SH_BIN }, () => {
    const fakeRoot = makeTempDir('setup-signpost-repo-');
    const home = makeTempDir('setup-signpost-home-nonode-existing-');
    try {
        const existing = JSON.stringify({ kitRepoPath: '/somewhere/else', machine: 'old-machine', compactNudgeFloor: 42000 });
        write(path.join(home, '.claude', 'claude-kit.local.json'), existing);
        const res = runSetupSh(fakeRoot, home, SETUP_SH, { PATH: pathWithoutNode() });
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.strictEqual(fs.readFileSync(path.join(home, '.claude', 'claude-kit.local.json'), 'utf8'), existing, 'the existing signpost must be byte-identical');
        assert.match(res.stderr, /node not found/i, 'the skipped write must be reported: ' + res.stderr);
        assert.match(res.stdout, /core\.hooksPath/, 'the run must continue to the git-hooks wiring: ' + res.stdout);
    } finally {
        rmTempDir(fakeRoot);
        rmTempDir(home);
    }
});
