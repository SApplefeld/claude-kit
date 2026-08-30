// Tests for every remaining bare Get-Content read in doctor.ps1 that this
// file's sibling suites don't already cover: the doctrine-import, kaizen-
// signpost, hooks.json, and auto-compaction-window reads. The goal-state read
// and the plan-head read (both inside the "Kit goal state" section) are
// covered in test/doctor-goal-state.test.js instead, which already lifts and
// runs that section.
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

// Locates the parenthesized expression starting at the first occurrence of
// marker (a leading "(" and no nested parens between it and its own close),
// and returns that substring verbatim.
function extractParenExpr(marker) {
    const at = DOCTOR_SRC.indexOf(marker);
    assert.ok(at >= 0, marker + ' not found in doctor.ps1');
    const close = DOCTOR_SRC.indexOf(')', at);
    assert.ok(close >= 0, 'closing paren not found for ' + marker);
    return DOCTOR_SRC.slice(at, close + 1);
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

// --- Doctrine import: the CLAUDE.md read, an inline
// parenthesized sub-expression with no variable of its own in doctor.ps1, so
// the harness assigns it to $raw itself for inspection. Get-Content attaches
// PSPath/PSChildName/etc. note-properties to the string it returns, which
// ConvertTo-Json expands alongside the text unless the value is cast back to
// a plain [string] first, so both this capture and the gate-source one below
// carry that cast.
const READ_CLAUDE_MD = extractParenExpr('(Get-Content $claudeMd -Raw');

function readClaudeMd(content) {
    const dir = makeDir('doctor-enc-claudemd-');
    try {
        const claudeMd = path.join(dir, 'CLAUDE.md');
        fs.writeFileSync(claudeMd, content, 'utf8');
        const out = runSnippet(
            ['$claudeMd = ' + q(claudeMd)],
            ['$raw = ' + READ_CLAUDE_MD, '$__json = @{ raw = [string]$raw } | ConvertTo-Json -Compress']
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
            [READ_SIGNPOST, '$__json = $signpostData | ConvertTo-Json -Compress']
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
const READ_HOOKS_JSON = extractLine('$hooksJsonData = Get-Content -LiteralPath $hooksJsonPath -Raw');

function readHooksJson(content) {
    const dir = makeDir('doctor-enc-hooks-');
    try {
        const hooksJsonPath = path.join(dir, 'hooks.json');
        fs.writeFileSync(hooksJsonPath, content, 'utf8');
        return runSnippet(
            ['$hooksJsonPath = ' + q(hooksJsonPath)],
            [READ_HOOKS_JSON, '$__json = $hooksJsonData | ConvertTo-Json -Compress']
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
const READ_CANARY_HOOKS_JSON = extractLine('$canaryHooksJsonData = Get-Content -LiteralPath $canaryHooksJsonPath -Raw');

function readCanaryHooksJson(content) {
    const dir = makeDir('doctor-enc-canary-');
    try {
        const canaryHooksJsonPath = path.join(dir, 'hooks.json');
        fs.writeFileSync(canaryHooksJsonPath, content, 'utf8');
        return runSnippet(
            ['$canaryHooksJsonPath = ' + q(canaryHooksJsonPath)],
            [READ_CANARY_HOOKS_JSON, '$__json = $canaryHooksJsonData | ConvertTo-Json -Compress']
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
