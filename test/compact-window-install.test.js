// Tests for plugins/claude-kit/doctor/install-compact-window.ps1, the
// doctor's autoCompactWindow writer for user settings.json.
//
// Node's built-in test runner, no framework (Node v24). Every case builds its
// own sandbox settings.json under a temp directory and passes its path
// explicitly, so nothing here reads or writes the real ~/.claude/settings.json,
// which carries the permissions block, an env block, and possibly
// apiKeyHelper. The cases spawn Windows PowerShell 5.1 (powershell.exe), the
// interpreter doctor.cmd actually launches and the one whose ANSI-decoding
// Get-Content behavior the installer exists to avoid, and are skipped off
// Windows, where the doctor itself does not run. Fixture content and result
// files are written and compared in Node, never inside a PowerShell literal,
// because a non-ASCII character in a .ps1-sourced string would itself be
// subject to the interpreter's encoding rules the suite is testing around.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const INSTALLER = path.join(REPO, 'plugins', 'claude-kit', 'doctor', 'install-compact-window.ps1');
const isWin = process.platform === 'win32';

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function pwsh(script) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', env: { ...process.env } });
}

function makeDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'compact-window-'));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// Run Set-AutoCompactWindow against a settings path; returns { ok, reason }.
// prelude, when given, is injected between the dot-source and the call (the
// concurrent-writer case shadows a command there).
function setWindow(settingsPath, value, prelude) {
    const script = '. ' + q(INSTALLER) + '; '
        + (prelude ? prelude + '; ' : '')
        + '$r = Set-AutoCompactWindow -Path ' + q(settingsPath) + ' -Value ' + value + '; '
        + '@{ ok = $r.ok; reason = "" + $r.reason } | ConvertTo-Json -Compress | Write-Output';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    return JSON.parse(res.stdout);
}

// The residue the installer must never leave beside the settings file: the
// pid-named rewrite temp always, and the fixed-name backup after a success.
function residue(dir) {
    return fs.readdirSync(dir).filter((n) => n.includes('.tmp-precompact-') || n.endsWith('.bak-precompact'));
}

// A realistic settings shape: the sensitive blocks the rewrite must not
// damage, with non-ASCII in a value and inside permissions, because the
// encoding failure this installer guards against mangles exactly those while
// leaving pure-ASCII content untouched.
const FIXTURE = {
    model: 'opus',
    env: { KIT_USER_DIR: 'C:\\Users\\café', PLAIN: 'ascii' },
    permissions: { allow: ['Bash(café:*)', 'Read(**)'], deny: [] },
    apiKeyHelper: 'helper.ps1'
};

test('adds the window and preserves every other setting, non-ASCII intact', { skip: !isWin }, () => {
    const dir = makeDir();
    try {
        const settings = path.join(dir, 'settings.json');
        fs.writeFileSync(settings, JSON.stringify(FIXTURE, null, 2) + '\n', 'utf8');
        const r = setWindow(settings, 135000);
        assert.strictEqual(r.ok, true, 'write succeeds: ' + r.reason);
        const after = JSON.parse(fs.readFileSync(settings, 'utf8'));
        assert.strictEqual(after.autoCompactWindow, 135000);
        // Exact string equality is the codepoint check: the PS5.1 ANSI decode
        // turns café into cafÃ© (bytes 195,169 for the é), which fails here.
        assert.strictEqual(after.env.KIT_USER_DIR, 'C:\\Users\\café');
        assert.deepStrictEqual(after.permissions, FIXTURE.permissions);
        assert.strictEqual(after.model, FIXTURE.model);
        assert.strictEqual(after.apiKeyHelper, FIXTURE.apiKeyHelper);
        assert.deepStrictEqual(residue(dir), [], 'no temp or backup left after a verified swap');
    } finally {
        rmDir(dir);
    }
});

test('updates an existing autoCompactWindow in place', { skip: !isWin }, () => {
    const dir = makeDir();
    try {
        const settings = path.join(dir, 'settings.json');
        fs.writeFileSync(settings, JSON.stringify({ ...FIXTURE, autoCompactWindow: 500000 }, null, 2) + '\n', 'utf8');
        const r = setWindow(settings, 135000);
        assert.strictEqual(r.ok, true, 'write succeeds: ' + r.reason);
        const after = JSON.parse(fs.readFileSync(settings, 'utf8'));
        assert.strictEqual(after.autoCompactWindow, 135000);
        assert.deepStrictEqual(after.permissions, FIXTURE.permissions);
        assert.deepStrictEqual(residue(dir), []);
    } finally {
        rmDir(dir);
    }
});

test('a settings file with a UTF-8 BOM round-trips', { skip: !isWin }, () => {
    const dir = makeDir();
    try {
        const settings = path.join(dir, 'settings.json');
        fs.writeFileSync(settings, '\uFEFF' + JSON.stringify(FIXTURE, null, 2) + '\n', 'utf8');
        const r = setWindow(settings, 135000);
        assert.strictEqual(r.ok, true, 'write succeeds: ' + r.reason);
        const after = JSON.parse(fs.readFileSync(settings, 'utf8').replace(/^\uFEFF/, ''));
        assert.strictEqual(after.autoCompactWindow, 135000);
        assert.strictEqual(after.env.KIT_USER_DIR, 'C:\\Users\\café');
    } finally {
        rmDir(dir);
    }
});

test('an unparseable settings file refuses and changes nothing', { skip: !isWin }, () => {
    const dir = makeDir();
    try {
        const settings = path.join(dir, 'settings.json');
        fs.writeFileSync(settings, 'not json at all {', 'utf8');
        const before = fs.readFileSync(settings);
        const r = setWindow(settings, 135000);
        assert.strictEqual(r.ok, false, 'refuses an unparseable file');
        assert.ok(r.reason.length > 0, 'refusal carries a reason');
        assert.ok(before.equals(fs.readFileSync(settings)), 'file bytes unchanged');
        assert.deepStrictEqual(residue(dir), [], 'no temp orphan, and no backup taken before the parse');
    } finally {
        rmDir(dir);
    }
});

test('a missing settings file refuses', { skip: !isWin }, () => {
    const dir = makeDir();
    try {
        const r = setWindow(path.join(dir, 'settings.json'), 135000);
        assert.strictEqual(r.ok, false);
        assert.ok(r.reason.length > 0);
        assert.deepStrictEqual(fs.readdirSync(dir), [], 'nothing created');
    } finally {
        rmDir(dir);
    }
});

test('a concurrent write between read and swap aborts, and the concurrent write survives', { skip: !isWin }, () => {
    const dir = makeDir();
    try {
        const settings = path.join(dir, 'settings.json');
        fs.writeFileSync(settings, JSON.stringify(FIXTURE, null, 2) + '\n', 'utf8');
        // Shadow Copy-Item in the session: perform the real backup copy, then
        // append a byte to the source. The append lands after the installer's
        // byte snapshot and before its pre-swap re-read, which is exactly the
        // window a live session's own settings write (a permission grant)
        // occupies, so the pre-swap comparison must abort the swap.
        const prelude = 'function Copy-Item { '
            + 'param([string]$LiteralPath, [string]$Destination, [switch]$Force) '
            + 'Microsoft.PowerShell.Management\\Copy-Item -LiteralPath $LiteralPath -Destination $Destination -Force; '
            + '[System.IO.File]::AppendAllText($LiteralPath, " ") }';
        const r = setWindow(settings, 135000, prelude);
        assert.strictEqual(r.ok, false, 'the swap aborts');
        assert.ok(/changed on disk/.test(r.reason), 'the reason names the concurrent change: ' + r.reason);
        const after = fs.readFileSync(settings, 'utf8');
        assert.strictEqual(after, JSON.stringify(FIXTURE, null, 2) + '\n ', 'the concurrent write is preserved, not clobbered');
        // The abort is a failure path, so the backup stays (that is its job);
        // only the rewrite temp must be gone.
        const leftovers = fs.readdirSync(dir);
        assert.ok(!leftovers.some((n) => n.includes('.tmp-precompact-')), 'no temp orphan: ' + leftovers.join(','));
        assert.ok(leftovers.includes('settings.json.bak-precompact'), 'the backup remains on a failure');
    } finally {
        rmDir(dir);
    }
});
