// Tests for plugins/claude-kit/hooks/doctrine-refresh.js, the SessionStart
// hook that writes the operating-instructions skill body to
// ~/.claude/claude-kit-doctrine.md, and for the doctor's comparison of that
// written file against the skill body.
//
// Node's built-in test runner, no framework, no install (Node v24). Every
// case builds a fixture plugin root (the skill file and its
// .claude-plugin/build-info.json) and a fixture home under a fresh temp
// directory, and runs the real hook as a child process with HOME and
// USERPROFILE pointed at that home, so nothing here reads or writes the real
// ~/.claude. A payload's write time is the skill file's mtime, set with
// fs.utimesSync, so no case sleeps.
//
// The doctor cases lift the "Doctrine import" section of doctor.ps1 as source
// text and run it inside a harness that stubs Report, the technique
// test/doctor-goal-state.test.js uses for its own section. They spawn Windows
// PowerShell and are skipped off Windows, where the doctor does not run.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const HOOK = path.join(REPO, 'plugins', 'claude-kit', 'hooks', 'doctrine-refresh.js');
const DOCTOR = path.join(REPO, 'plugins', 'claude-kit', 'doctor', 'doctor.ps1');
const isWin = process.platform === 'win32';

const HEADER_OPEN = '<!-- Written by the claude-kit doctrine-refresh hook';
const T1 = new Date('2026-09-01T10:00:00Z');
const T2 = new Date('2026-09-01T10:02:00Z');

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// A fixture home whose CLAUDE.md already imports the doctrine, so the hook's
// wiring offer stays silent and stdout carries only what a case is about.
function makeHome(root) {
    const home = path.join(root, 'home');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '@claude-kit-doctrine.md\n', 'utf8');
    return home;
}

// A fixture plugin root carrying the skill with the given body, its mtime set
// to when, and a build-info.json with the given hash (none where hash is null).
function makePlugin(root, name, body, when, hash) {
    const plugin = path.join(root, name);
    const skill = path.join(plugin, 'skills', 'operating-instructions', 'SKILL.md');
    fs.mkdirSync(path.dirname(skill), { recursive: true });
    fs.writeFileSync(skill, '---\nname: operating-instructions\n---\n\n' + body, 'utf8');
    fs.utimesSync(skill, when, when);
    if (hash !== null) {
        fs.mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true });
        fs.writeFileSync(path.join(plugin, '.claude-plugin', 'build-info.json'),
            JSON.stringify({ hash, dirty: false }), 'utf8');
    }
    return plugin;
}

function runHook(home, plugin, source) {
    const res = spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ hook_event_name: 'SessionStart', source }),
        encoding: 'utf8',
        env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PLUGIN_ROOT: plugin }
    });
    assert.strictEqual(res.status, 0, res.stderr);
    return res.stdout;
}

const doctrinePath = (home) => path.join(home, '.claude', 'claude-kit-doctrine.md');
const stampPath = (home) => path.join(home, '.claude', 'claude-kit-doctrine.stamp.json');
const readDoctrine = (home) => fs.readFileSync(doctrinePath(home), 'utf8');
const readStamp = (home) => JSON.parse(fs.readFileSync(stampPath(home), 'utf8'));

// The written file with its header line removed, which is what the doctor
// compares against the skill body.
function bodyOf(written) {
    const nl = written.indexOf('\n');
    assert.ok(written.startsWith(HEADER_OPEN) && nl >= 0, 'no header line: ' + written.slice(0, 120));
    return written.slice(nl + 1);
}

test('a newer writer overwrites the file and restamps it with its own time and hash', () => {
    const root = makeDir('doctrine-refresh-newer-');
    try {
        const home = makeHome(root);
        const older = makePlugin(root, 'older', 'Old doctrine.\n', T1, 'aaa1111');
        const newer = makePlugin(root, 'newer', 'New doctrine.\n', T2, 'bbb2222');
        runHook(home, older, 'startup');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'Old doctrine.\n');
        assert.strictEqual(runHook(home, newer, 'startup'), '');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'New doctrine.\n');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'bbb2222');
        assert.strictEqual(stamp.payloadMtimeMs, T2.getTime());
    } finally {
        rmDir(root);
    }
});

test('an older writer declines at session start and names both hashes in additionalContext', () => {
    const root = makeDir('doctrine-refresh-older-');
    try {
        const home = makeHome(root);
        const newer = makePlugin(root, 'cache-v2', 'New doctrine.\n', T2, 'bbb2222');
        const older = makePlugin(root, 'cache-v1', 'Old doctrine.\n', T1, 'aaa1111');
        runHook(home, newer, 'startup');
        const before = readDoctrine(home);

        const out = runHook(home, older, 'startup');
        assert.strictEqual(readDoctrine(home), before, 'the older writer must not overwrite the newer text');
        assert.strictEqual(readStamp(home).hash, 'bbb2222', 'the stamp keeps the newer writer');
        const parsed = JSON.parse(out);
        assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
        const ctx = parsed.hookSpecificOutput.additionalContext;
        assert.match(ctx, /aaa1111/);
        assert.match(ctx, /bbb2222/);
        assert.match(ctx, /claude-kit-doctrine\.md/);
        // The line names this session's plugin root by its directory name and
        // gives the recovery that works: a restart reaches the same older root.
        assert.match(ctx, /cache-v1/);
        assert.match(ctx, /claude-kit-doctrine\.stamp\.json/);
        assert.doesNotMatch(ctx, /restart/i);
        assert.ok(!ctx.includes('\n'), 'the decline is one line: ' + ctx);
    } finally {
        rmDir(root);
    }
});

test('an older writer writes and restamps where the doctrine file is absent', () => {
    const root = makeDir('doctrine-refresh-older-absent-');
    try {
        const home = makeHome(root);
        const newer = makePlugin(root, 'newer', 'New doctrine.\n', T2, 'bbb2222');
        const older = makePlugin(root, 'older', 'Old doctrine.\n', T1, 'aaa1111');
        runHook(home, newer, 'startup');
        fs.unlinkSync(doctrinePath(home));

        assert.strictEqual(runHook(home, older, 'startup'), '', 'nothing to protect, so nothing to decline');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'Old doctrine.\n');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'aaa1111');
        assert.strictEqual(stamp.payloadMtimeMs, T1.getTime());
    } finally {
        rmDir(root);
    }
});

test('the writer that stamped the file restores it after a hand edit (equal times overwrite)', () => {
    const root = makeDir('doctrine-refresh-equal-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        const written = readDoctrine(home);
        fs.writeFileSync(doctrinePath(home), written.split('\n')[0] + '\nA hand edit.\n', 'utf8');

        assert.strictEqual(runHook(home, plugin, 'startup'), '', 'an equal-time writer must not decline');
        assert.strictEqual(readDoctrine(home), written);
        assert.strictEqual(bodyOf(readDoctrine(home)), 'The doctrine.\n');
    } finally {
        rmDir(root);
    }
});

test('an older writer declines silently at compact and clear', () => {
    const root = makeDir('doctrine-refresh-older-quiet-');
    try {
        const home = makeHome(root);
        const newer = makePlugin(root, 'newer', 'New doctrine.\n', T2, 'bbb2222');
        const older = makePlugin(root, 'older', 'Old doctrine.\n', T1, 'aaa1111');
        runHook(home, newer, 'startup');
        const before = readDoctrine(home);
        for (const source of ['compact', 'clear']) {
            assert.strictEqual(runHook(home, older, source), '', source + ' must print nothing');
            assert.strictEqual(readDoctrine(home), before, source + ' must not overwrite');
        }
    } finally {
        rmDir(root);
    }
});

test('the header line opens the written file, names the skill as the source, and survives a refresh', () => {
    const root = makeDir('doctrine-refresh-header-');
    try {
        const home = makeHome(root);
        const first = makePlugin(root, 'first', 'First doctrine.\n', T1, 'aaa1111');
        const second = makePlugin(root, 'second', 'Second doctrine.\n', T2, 'bbb2222');
        runHook(home, first, 'startup');
        const firstLine = readDoctrine(home).split('\n')[0];
        assert.ok(firstLine.startsWith(HEADER_OPEN), firstLine);
        assert.match(firstLine, /skills\/operating-instructions\/SKILL\.md/);
        assert.match(firstLine, /-->\s*$/);

        runHook(home, second, 'startup');
        const written = readDoctrine(home);
        assert.strictEqual(written.split('\n')[0], firstLine);
        assert.strictEqual(bodyOf(written), 'Second doctrine.\n');
    } finally {
        rmDir(root);
    }
});

test('a hand-edited file with no stamp is overwritten once and stamped', () => {
    const root = makeDir('doctrine-refresh-hand-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(doctrinePath(home), 'A hand edit.\n', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        assert.strictEqual(runHook(home, plugin, 'startup'), '');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'The doctrine.\n');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'aaa1111');
        assert.strictEqual(stamp.payloadMtimeMs, T1.getTime());
    } finally {
        rmDir(root);
    }
});

test('a malformed stamp is read as no stamp: the writer overwrites and restamps', () => {
    const root = makeDir('doctrine-refresh-malformed-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(doctrinePath(home), 'Some other text.\n', 'utf8');
        fs.writeFileSync(stampPath(home), '{ not json', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        assert.strictEqual(runHook(home, plugin, 'startup'), '');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'The doctrine.\n');
        assert.strictEqual(readStamp(home).hash, 'aaa1111');
    } finally {
        rmDir(root);
    }
});

test('a payload with no build-info.json records its hash as unknown', () => {
    const root = makeDir('doctrine-refresh-nohash-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, null);
        runHook(home, plugin, 'startup');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'unknown');
        assert.strictEqual(stamp.payloadMtimeMs, T1.getTime());
    } finally {
        rmDir(root);
    }
});

// --- The doctor's comparison. Lifts the section from Get-DoctrineBody to the
// kaizen signpost section that follows it, and runs it against a fixture
// ~/.claude and a fixture plugin root.

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function runDoctrineSection(claudeDir, pluginRoot) {
    const outFile = path.join(os.tmpdir(), 'doctrine-refresh-doctor-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$start = $src.IndexOf("function Get-DoctrineBody")',
        'if ($start -lt 0) { throw "Get-DoctrineBody not found in doctor.ps1" }',
        '$end = $src.IndexOf("# --- Kaizen signpost", $start)',
        'if ($end -lt 0) { throw "kaizen signpost section not found after the doctrine section" }',
        '$section = $src.Substring($start, $end - $start)',
        '$script:Reports = @()',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        '$claudeDir = ' + q(claudeDir),
        '$pluginRoot = ' + q(pluginRoot),
        'Invoke-Expression $section',
        '$__json = @{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        assert.ok(Array.isArray(parsed.Reports), 'Reports must be an array: ' + res.stdout);
        return parsed.Reports.filter((r) => r.Name === 'Doctrine import');
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

test('the doctor reads PASS on a file the hook wrote, header included', { skip: !isWin }, () => {
    const root = makeDir('doctrine-refresh-doctor-pass-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'Line one.\n\nLine two.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        assert.ok(readDoctrine(home).startsWith(HEADER_OPEN));
        const reports = runDoctrineSection(path.join(home, '.claude'), plugin);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'PASS', reports[0].Detail);
    } finally {
        rmDir(root);
    }
});

test('the doctor still WARNs where the body under the header differs (control)', { skip: !isWin }, () => {
    const root = makeDir('doctrine-refresh-doctor-warn-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'Line one.\n\nLine two.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        const header = readDoctrine(home).split('\n')[0];
        fs.writeFileSync(doctrinePath(home), header + '\nA different body.\n', 'utf8');
        const reports = runDoctrineSection(path.join(home, '.claude'), plugin);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN', reports[0].Detail);
        // The remedy names the decline and the stamp that clears it, since a
        // session on an older plugin than the last writer does not refresh.
        assert.match(reports[0].Detail, /claude-kit-doctrine\.stamp\.json/);
        assert.match(reports[0].Detail, /declin/i);
    } finally {
        rmDir(root);
    }
});
