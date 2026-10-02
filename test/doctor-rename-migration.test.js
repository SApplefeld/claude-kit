// Tests for the doctor.ps1 checks that move a host off the plugin's former
// name: "Former-name migration" (the doctrine file, its stamp, the kaizen
// signpost and the CLAUDE.md import line), "Output style" (settings.json's
// outputStyle) and "Plugin install" (installed_plugins.json against
// enabledPlugins), and for the "Doctrine import" check's import predicate
// against the case table the hook shares.
//
// Node's built-in test runner, no framework, no install (Node v24). Every
// case builds its own fixture ~/.claude under a short temp directory and
// passes it explicitly, so nothing here reads or writes the real ~/.claude.
// The cases spawn Windows PowerShell and are skipped off Windows, where the
// doctor does not run.
//
// Each section is lifted as source text and executed (Invoke-Expression)
// inside a harness, the technique test/doctor-goal-state.test.js uses. The
// harness stubs Report (captures each call) and Get-SanitizedLine (identity),
// lifts the doctor's own Get-Consent and its settings.json read line, dot-
// sources install-compact-window.ps1 for the settings writer, sets $Fix, $Yes
// and $claudeDir, and stubs Invoke-KitPluginInstall, the install check's one
// spawn, recording each call. A fake claude.cmd on PATH writes a marker file
// when run, so a spawn that went around the stub is seen too.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { CASES } = require('./doctrine-import-cases.test.js');

const REPO = path.join(__dirname, '..');
const DOCTOR = path.join(REPO, 'plugins', 'grimoire', 'doctor', 'doctor.ps1');
const INSTALLER = path.join(REPO, 'plugins', 'grimoire', 'doctor', 'install-compact-window.ps1');
const isWin = process.platform === 'win32';

const MIGRATION = ['# --- Former-name migration.', '# --- Doctrine import and freshness.'];
const STYLE_AND_INSTALL = ['# --- Output style.', '# --- Summary.'];
const SETTINGS_READ = '$settingsObj = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json';

const OLD = {
    doctrine: 'claude-kit-doctrine.md',
    stamp: 'claude-kit-doctrine.stamp.json',
    signpost: 'claude-kit.local.json',
    importLine: '@claude-kit-doctrine.md'
};
const NEW = {
    doctrine: 'grimoire-doctrine.md',
    stamp: 'grimoire-doctrine.stamp.json',
    signpost: 'grimoire.local.json',
    importLine: '@grimoire-doctrine.md'
};
const INSTALL_ID = 'grimoire@applefeld';

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// A fixture root holding .claude, a bin directory with a fake claude.cmd that
// appends to a marker file when run, and an empty directory for a PATH with
// no claude on it.
function makeRoot(prefix) {
    const root = makeDir(prefix);
    const claudeDir = path.join(root, '.claude');
    const bin = path.join(root, 'bin');
    const empty = path.join(root, 'empty');
    const marker = path.join(root, 'claude-ran.txt');
    for (const d of [claudeDir, bin, empty]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(bin, 'claude.cmd'), '@echo off\r\necho %*>>"' + marker + '"\r\n', 'utf8');
    return { root, claudeDir, bin, empty, marker };
}

// Runs one lifted section with the given flags. claudeOnPath false leaves
// PATH holding only an empty directory, so Get-Command finds no claude.
// claudeFunction defines a PowerShell function named claude, which the
// install check must never take for the application.
function runSection(fx, section, { fix = false, yes = false, claudeOnPath = true, claudeFunction = false } = {}) {
    const outFile = path.join(os.tmpdir(), 'doctor-rename-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        'function Get-Lifted([string]$From, [string]$To) {',
        '    $start = $src.IndexOf($From)',
        '    if ($start -lt 0) { throw "start marker not found: $From" }',
        '    $end = $src.IndexOf($To, $start)',
        '    if ($end -lt 0) { throw "end marker not found after the start: $To" }',
        '    return $src.Substring($start, $end - $start)',
        '}',
        '$consent = Get-Lifted ' + q('function Get-Consent {') + ' ' + q('# The sanitizer every foreign string'),
        '$readAt = $src.IndexOf(' + q(SETTINGS_READ) + ')',
        'if ($readAt -lt 0) { throw "the doctor settings read line not found" }',
        '$section = Get-Lifted ' + q(section[0]) + ' ' + q(section[1]),
        '',
        '$script:Reports = @()',
        '$script:InstallCalls = @()',
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        'function Invoke-KitPluginInstall {',
        '    param([string]$ClaudeExe, [string]$InstallId)',
        '    $script:InstallCalls += @{ ClaudeExe = $ClaudeExe; InstallId = $InstallId }',
        '    return @{ code = 0; lines = @("installed (stub)") }',
        '}',
        '',
        '$Fix = $' + (fix ? 'true' : 'false'),
        '$Yes = $' + (yes ? 'true' : 'false'),
        'Invoke-Expression $consent',
        '. ' + q(INSTALLER),
        '$claudeDir = ' + q(fx.claudeDir),
        '$settingsPath = Join-Path $claudeDir "settings.json"',
        '$settingsObj = $null',
        '$settingsReadable = $false',
        'if (Test-Path -LiteralPath $settingsPath) {',
        '    try {',
        '        ' + SETTINGS_READ,
        '        $settingsReadable = ($null -ne $settingsObj)',
        '    }',
        '    catch {}',
        '}',
        '$env:Path = ' + q(claudeOnPath ? fx.bin + ';' + process.env.SystemRoot + '\\System32' : fx.empty),
        ...(claudeFunction ? ['function claude { }'] : []),
        '',
        'Invoke-Expression $section',
        '',
        '$__json = @{ Reports = @($script:Reports); InstallCalls = @($script:InstallCalls) } | ConvertTo-Json -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        // A non-terminating error (a parse failure in a lifted fragment, a
        // command not found) leaves the exit code at 0, so stderr is the signal.
        assert.strictEqual(res.stderr.trim(), '', res.stderr);
        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        assert.ok(Array.isArray(parsed.Reports), 'Reports must be an array: ' + res.stdout + res.stderr);
        assert.ok(Array.isArray(parsed.InstallCalls), 'InstallCalls must be an array: ' + res.stdout);
        return parsed;
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

const named = (out, name) => out.Reports.filter((r) => r.Name === name);

// Every entry in the fixture .claude by name, with its bytes, so a comparison
// sees a rename, a new file and a changed byte alike.
function snapshot(claudeDir) {
    const out = {};
    for (const name of fs.readdirSync(claudeDir).sort()) {
        const p = path.join(claudeDir, name);
        if (fs.statSync(p).isFile()) out[name] = fs.readFileSync(p).toString('base64');
    }
    return out;
}

// --- Former-name migration.

const SIGNPOST_BYTES = '{"kitRepoPath":"C:\\\\clone","machine":"M1"}\r\n';
const claudeMdWith = (importLine) => ['# My global notes', '', importLine, 'Keep this line.', ''].join('\r\n');

function seedOldState(claudeDir) {
    fs.writeFileSync(path.join(claudeDir, OLD.doctrine), 'Old doctrine text.\n', 'utf8');
    fs.writeFileSync(path.join(claudeDir, OLD.stamp), '{"payloadMtimeMs":1}\n', 'utf8');
    fs.writeFileSync(path.join(claudeDir, OLD.signpost), SIGNPOST_BYTES, 'utf8');
    fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), claudeMdWith(OLD.importLine), 'utf8');
}

test('a home in the former name\'s state reads FAIL naming each item and changes nothing without -Fix', { skip: !isWin }, () => {
    const fx = makeRoot('drm-mig-fail-');
    try {
        seedOldState(fx.claudeDir);
        const before = snapshot(fx.claudeDir);
        const reports = named(runSection(fx, MIGRATION), 'Former-name migration');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'FAIL', reports[0].Detail);
        for (const name of [OLD.doctrine, OLD.stamp, OLD.signpost, OLD.importLine]) {
            assert.ok(reports[0].Detail.includes(name), name + ' must be named: ' + reports[0].Detail);
        }
        assert.deepStrictEqual(snapshot(fx.claudeDir), before, 'a run without -Fix writes nothing');
    } finally {
        rmDir(fx.root);
    }
});

test('-Fix moves a home in the former name\'s state onto the current names, and the next run reads PASS', { skip: !isWin }, () => {
    const fx = makeRoot('drm-mig-fix-');
    try {
        seedOldState(fx.claudeDir);
        const before = snapshot(fx.claudeDir);
        const fixed = named(runSection(fx, MIGRATION, { fix: true }), 'Former-name migration');
        assert.strictEqual(fixed.length, 1, JSON.stringify(fixed));
        assert.strictEqual(fixed[0].Status, 'FIXED', fixed[0].Detail);

        const after = snapshot(fx.claudeDir);
        assert.deepStrictEqual(Object.keys(after).sort(), ['CLAUDE.md', NEW.doctrine, NEW.stamp, NEW.signpost].sort());
        // Each file is moved, never rewritten: its bytes are the ones it had.
        assert.strictEqual(after[NEW.doctrine], before[OLD.doctrine]);
        assert.strictEqual(after[NEW.stamp], before[OLD.stamp]);
        assert.strictEqual(after[NEW.signpost], before[OLD.signpost]);
        // Every byte but the import line's own text is kept, CRLF included.
        assert.strictEqual(fs.readFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), 'utf8'), claudeMdWith(NEW.importLine));
        // No temp file is left beside CLAUDE.md once the swap has landed.
        assert.deepStrictEqual(fs.readdirSync(fx.claudeDir).filter((n) => /tmp/.test(n)), [], 'no temp file left behind');

        const pass = named(runSection(fx, MIGRATION), 'Former-name migration');
        assert.strictEqual(pass.length, 1, JSON.stringify(pass));
        assert.strictEqual(pass[0].Status, 'PASS', pass[0].Detail);
    } finally {
        rmDir(fx.root);
    }
});

// The import check follows Claude Code's case-sensitive import grammar, so
// @Grimoire-Doctrine.md does not stop -Fix from swapping the old line, as in
// the hook.
test('a line holding the new token in another letter case does not stop the swap, as in the hook', { skip: !isWin }, () => {
    const fx = makeRoot('drm-mig-case-');
    try {
        fs.writeFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), '@Grimoire-Doctrine.md\r\n' + OLD.importLine + '\r\n', 'utf8');
        const reports = named(runSection(fx, MIGRATION, { fix: true }), 'Former-name migration');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'FIXED', reports[0].Detail);
        assert.strictEqual(fs.readFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), 'utf8'), '@Grimoire-Doctrine.md\r\n' + NEW.importLine + '\r\n');
    } finally {
        rmDir(fx.root);
    }
});

// The migration case: the swap takes no "already imported" gate, so the exact
// old line beside a live annotated import is rewritten under -Fix, as in the
// hook, leaving two import lines, which load one file.
test('an annotated new import beside the old line does not stop the swap, and -Fix reads FIXED', { skip: !isWin }, () => {
    const fx = makeRoot('drm-mig-shape-');
    try {
        const live = '  @grimoire-doctrine.md  # kit doctrine\n';
        fs.writeFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), live + OLD.importLine + '\n', 'utf8');
        const reports = named(runSection(fx, MIGRATION, { fix: true }), 'Former-name migration');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'FIXED', reports[0].Detail);
        assert.strictEqual(fs.readFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), 'utf8'), live + NEW.importLine + '\n');
    } finally {
        rmDir(fx.root);
    }
});

// --- Doctrine import check, held to the shared case table the hook's wiring
// offer is held to in test/doctrine-refresh.test.js. Each row gets its own
// fixture .claude holding the row's CLAUDE.md and a doctrine file matching a
// fixture payload's skill body, so an imported row reads PASS and a row that
// is not an import reads the WARN naming the line to add. One PowerShell
// process runs the lifted section once per row.

const IMPORT_CHECK = ['# --- Doctrine import and freshness.', '# --- Kaizen signpost + git hooks.'];

function runImportCheck(pluginRoot, claudeDirs) {
    const outFile = path.join(os.tmpdir(), 'doctor-rename-import-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$start = $src.IndexOf(' + q(IMPORT_CHECK[0]) + ')',
        'if ($start -lt 0) { throw "start marker not found" }',
        '$end = $src.IndexOf(' + q(IMPORT_CHECK[1]) + ', $start)',
        'if ($end -lt 0) { throw "end marker not found after the start" }',
        '$section = $src.Substring($start, $end - $start)',
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Get-PayloadClause { return "" }',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        '$pluginRoot = ' + q(pluginRoot),
        '$results = @()',
        'foreach ($claudeDir in @(' + claudeDirs.map(q).join(', ') + ')) {',
        '    $script:Reports = @()',
        '    Invoke-Expression $section',
        '    $results += ,@($script:Reports | Where-Object { $_.Name -eq "Doctrine import" })',
        '}',
        '$__json = ConvertTo-Json -InputObject @($results) -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.strictEqual(res.stderr.trim(), '', res.stderr);
        return JSON.parse(fs.readFileSync(outFile, 'utf8'));
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

test('the Doctrine import check reads PASS exactly on the case table\'s imported rows', { skip: !isWin }, () => {
    const fx = makeRoot('drm-import-');
    try {
        const pluginRoot = path.join(fx.root, 'plugin');
        const skill = path.join(pluginRoot, 'skills', 'operating-instructions', 'SKILL.md');
        fs.mkdirSync(path.dirname(skill), { recursive: true });
        fs.writeFileSync(skill, '---\nname: operating-instructions\n---\n\nThe doctrine.\n', 'utf8');
        const dirs = CASES.map((c, i) => {
            const dir = path.join(fx.root, 'case' + i, '.claude');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'CLAUDE.md'), c.text, 'utf8');
            fs.writeFileSync(path.join(dir, NEW.doctrine), 'The doctrine.\n', 'utf8');
            return dir;
        });
        const results = runImportCheck(pluginRoot, dirs);
        assert.strictEqual(results.length, CASES.length, JSON.stringify(results));
        const wrong = [];
        CASES.forEach((c, i) => {
            const reports = [].concat(results[i]);
            const status = reports.length === 1 ? reports[0].Status : JSON.stringify(reports);
            const added = reports.length === 1 && /Add this line/.test(reports[0].Detail);
            if (c.imported ? status !== 'PASS' : (status !== 'WARN' || !added)) wrong.push(c.name + ': ' + status);
        });
        assert.deepStrictEqual(wrong, []);
    } finally {
        rmDir(fx.root);
    }
});

// A CLAUDE.md kept in a dotfiles directory and linked into .claude, through a
// chain of two relative links. Creating a link on Windows needs the symlink
// privilege or developer mode, so the case skips where it cannot.
test('-Fix swaps a linked CLAUDE.md in its final target, and both links stay links', { skip: !isWin }, (t) => {
    const fx = makeRoot('drm-mig-link-');
    try {
        const dotfiles = path.join(fx.root, 'dotfiles');
        fs.mkdirSync(dotfiles);
        const real = path.join(dotfiles, 'real.md');
        fs.writeFileSync(real, claudeMdWith(OLD.importLine), 'utf8');
        try {
            fs.symlinkSync('real.md', path.join(dotfiles, 'middle.md'), 'file');
            fs.symlinkSync(path.join('..', 'dotfiles', 'middle.md'), path.join(fx.claudeDir, 'CLAUDE.md'), 'file');
        } catch (e) {
            t.skip('cannot create a symbolic link here (' + e.code + ')');
            return;
        }
        const reports = named(runSection(fx, MIGRATION, { fix: true }), 'Former-name migration');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'FIXED', reports[0].Detail);
        assert.ok(fs.lstatSync(path.join(fx.claudeDir, 'CLAUDE.md')).isSymbolicLink(), 'CLAUDE.md is still a link');
        assert.ok(fs.lstatSync(path.join(dotfiles, 'middle.md')).isSymbolicLink(), 'the middle link is still a link');
        assert.strictEqual(fs.readFileSync(real, 'utf8'), claudeMdWith(NEW.importLine));
        for (const dir of [dotfiles, fx.claudeDir]) {
            assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => /tmp/.test(n)), [], 'no temp file left in ' + dir);
        }
    } finally {
        rmDir(fx.root);
    }
});

// A read-only CLAUDE.md makes File.Replace refuse the swap (access denied)
// after the temp file was written, which drives the failure branch.
test('a -Fix swap that fails leaves CLAUDE.md byte-identical and no temp file', { skip: !isWin }, () => {
    const fx = makeRoot('drm-mig-fail-');
    const claudeMd = path.join(fx.claudeDir, 'CLAUDE.md');
    try {
        const text = claudeMdWith(OLD.importLine);
        fs.writeFileSync(claudeMd, text, 'utf8');
        fs.chmodSync(claudeMd, 0o444);
        const reports = named(runSection(fx, MIGRATION, { fix: true }), 'Former-name migration');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'FAIL', reports[0].Detail);
        assert.match(reports[0].Detail, /Could not rewrite the import line/);
        assert.strictEqual(fs.readFileSync(claudeMd, 'utf8'), text);
        assert.deepStrictEqual(fs.readdirSync(fx.claudeDir).filter((n) => /tmp/.test(n)), [], 'no temp file left behind');
    } finally {
        try { fs.chmodSync(claudeMd, 0o644); } catch { /* best effort */ }
        rmDir(fx.root);
    }
});

test('a doctrine file under both names reads WARN naming both, and -Fix changes neither', { skip: !isWin }, () => {
    const fx = makeRoot('drm-mig-both-');
    try {
        fs.writeFileSync(path.join(fx.claudeDir, OLD.doctrine), 'Old text.\n', 'utf8');
        fs.writeFileSync(path.join(fx.claudeDir, NEW.doctrine), 'New text.\n', 'utf8');
        fs.writeFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), NEW.importLine + '\n', 'utf8');
        const before = snapshot(fx.claudeDir);
        const reports = named(runSection(fx, MIGRATION, { fix: true }), 'Former-name migration');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN', reports[0].Detail);
        assert.ok(reports[0].Detail.includes(OLD.doctrine) && reports[0].Detail.includes(NEW.doctrine), reports[0].Detail);
        assert.deepStrictEqual(snapshot(fx.claudeDir), before, 'a pair under both names is left as it was');
    } finally {
        rmDir(fx.root);
    }
});

test('an old-token line carrying other text is not the former import, so the check reads PASS and -Fix leaves it', { skip: !isWin }, () => {
    const fx = makeRoot('drm-mig-other-');
    try {
        const text = OLD.importLine + '  # mine\n';
        fs.writeFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), text, 'utf8');
        const reports = named(runSection(fx, MIGRATION, { fix: true }), 'Former-name migration');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'PASS', reports[0].Detail);
        assert.strictEqual(fs.readFileSync(path.join(fx.claudeDir, 'CLAUDE.md'), 'utf8'), text);
    } finally {
        rmDir(fx.root);
    }
});

// --- Output style.

// A realistic settings shape: the sensitive blocks the rewrite must not
// damage, with non-ASCII in a value and inside permissions.
const SETTINGS = {
    model: 'opus',
    env: { KIT_USER_DIR: 'C:\\Users\\café', PLAIN: 'ascii' },
    permissions: { allow: ['Bash(café:*)', 'Read(**)'], deny: [] },
    apiKeyHelper: 'helper.ps1',
    autoCompactWindow: 285000,
    enabledPlugins: { [INSTALL_ID]: true }
};

function writeSettings(fx, obj) {
    fs.writeFileSync(path.join(fx.claudeDir, 'settings.json'), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
const readSettings = (fx) => JSON.parse(fs.readFileSync(path.join(fx.claudeDir, 'settings.json'), 'utf8'));

test('outputStyle under the former name reads FAIL, and -Fix rewrites that one key and keeps every other key\'s value', { skip: !isWin }, () => {
    const fx = makeRoot('drm-style-');
    try {
        writeSettings(fx, { ...SETTINGS, outputStyle: 'claude-kit:Kit' });
        const settingsFile = path.join(fx.claudeDir, 'settings.json');
        const bytes = fs.readFileSync(settingsFile);

        const fail = named(runSection(fx, STYLE_AND_INSTALL), 'Output style');
        assert.strictEqual(fail.length, 1, JSON.stringify(fail));
        assert.strictEqual(fail[0].Status, 'FAIL', fail[0].Detail);
        assert.match(fail[0].Detail, /claude-kit:Kit/);
        assert.ok(bytes.equals(fs.readFileSync(settingsFile)), 'a run without -Fix writes nothing');

        const fixed = named(runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true }), 'Output style');
        assert.strictEqual(fixed.length, 1, JSON.stringify(fixed));
        assert.strictEqual(fixed[0].Status, 'FIXED', fixed[0].Detail);
        const after = readSettings(fx);
        assert.strictEqual(after.outputStyle, 'grimoire:Kit');
        // Key by key, as the writer's own verify compares them.
        assert.deepStrictEqual(Object.keys(after).sort(), [...Object.keys(SETTINGS), 'outputStyle'].sort());
        for (const key of Object.keys(SETTINGS)) {
            assert.strictEqual(JSON.stringify(after[key]), JSON.stringify(SETTINGS[key]), key + ' must keep its value');
        }
        assert.deepStrictEqual(fs.readdirSync(fx.claudeDir).filter((n) => /precompact/.test(n)), [], 'no temp or backup left');

        const pass = named(runSection(fx, STYLE_AND_INSTALL), 'Output style');
        assert.strictEqual(pass.length, 1, JSON.stringify(pass));
        assert.strictEqual(pass[0].Status, 'PASS', pass[0].Detail);
    } finally {
        rmDir(fx.root);
    }
});

test('outputStyle reads PASS where it is unset or the current name', { skip: !isWin }, () => {
    const fx = makeRoot('drm-style-pass-');
    try {
        writeSettings(fx, SETTINGS);
        assert.strictEqual(named(runSection(fx, STYLE_AND_INSTALL), 'Output style')[0].Status, 'PASS');
        writeSettings(fx, { ...SETTINGS, outputStyle: 'grimoire:Kit' });
        assert.strictEqual(named(runSection(fx, STYLE_AND_INSTALL), 'Output style')[0].Status, 'PASS');
    } finally {
        rmDir(fx.root);
    }
});

// --- Plugin install.

function writeInstalled(fx, text) {
    fs.mkdirSync(path.join(fx.claudeDir, 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(fx.claudeDir, 'plugins', 'installed_plugins.json'), text, 'utf8');
}
const installedWith = (keys) => JSON.stringify({
    version: 2,
    plugins: Object.fromEntries(keys.map((k) => [k, [{ installPath: 'C:\\x', lastUpdated: '2026-10-01T00:00:00Z' }]]))
});

test('an enabled plugin with no install entry reads FAIL naming the command and spawns nothing without -Fix', { skip: !isWin }, () => {
    const fx = makeRoot('drm-install-fail-');
    try {
        writeSettings(fx, SETTINGS);
        writeInstalled(fx, installedWith(['other@market']));
        const out = runSection(fx, STYLE_AND_INSTALL);
        const reports = named(out, 'Plugin install');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'FAIL', reports[0].Detail);
        assert.ok(reports[0].Detail.includes('claude plugin install ' + INSTALL_ID), reports[0].Detail);
        assert.deepStrictEqual(out.InstallCalls, [], 'no install invoked without -Fix');
        assert.ok(!fs.existsSync(fx.marker), 'no claude spawned around the stub');
    } finally {
        rmDir(fx.root);
    }
});

test('under -Fix the install is invoked once, through the claude Get-Command resolved (control for the silence above)', { skip: !isWin }, () => {
    const fx = makeRoot('drm-install-fix-');
    try {
        writeSettings(fx, SETTINGS);
        writeInstalled(fx, installedWith(['other@market']));
        const out = runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true });
        assert.strictEqual(out.InstallCalls.length, 1, JSON.stringify(out.InstallCalls));
        assert.strictEqual(out.InstallCalls[0].InstallId, INSTALL_ID);
        assert.strictEqual(path.resolve(out.InstallCalls[0].ClaudeExe).toLowerCase(), path.join(fx.bin, 'claude.cmd').toLowerCase());
        const reports = named(out, 'Plugin install');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'FIXED', reports[0].Detail);
        assert.ok(!fs.existsSync(fx.marker), 'the spawn went through the stub');
    } finally {
        rmDir(fx.root);
    }
});

test('a PowerShell function named claude is not taken for the application', { skip: !isWin }, () => {
    const fx = makeRoot('drm-install-fn-');
    try {
        writeSettings(fx, SETTINGS);
        writeInstalled(fx, installedWith(['other@market']));
        const out = runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true, claudeOnPath: false, claudeFunction: true });
        const reports = named(out, 'Plugin install');
        assert.strictEqual(reports[0].Status, 'FAIL', reports[0].Detail);
        assert.match(reports[0].Detail, /not on PATH/);
        assert.deepStrictEqual(out.InstallCalls, []);
    } finally {
        rmDir(fx.root);
    }
});

test('under -Fix with no claude on PATH the check reads FAIL naming the command to run by hand', { skip: !isWin }, () => {
    const fx = makeRoot('drm-install-noclaude-');
    try {
        writeSettings(fx, SETTINGS);
        writeInstalled(fx, installedWith(['other@market']));
        const out = runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true, claudeOnPath: false });
        const reports = named(out, 'Plugin install');
        assert.strictEqual(reports[0].Status, 'FAIL', reports[0].Detail);
        assert.match(reports[0].Detail, /not on PATH/);
        assert.ok(reports[0].Detail.includes('claude plugin install ' + INSTALL_ID), reports[0].Detail);
        assert.deepStrictEqual(out.InstallCalls, []);
    } finally {
        rmDir(fx.root);
    }
});

test('an install entry present reads PASS, and -Fix invokes nothing', { skip: !isWin }, () => {
    const fx = makeRoot('drm-install-pass-');
    try {
        writeSettings(fx, SETTINGS);
        writeInstalled(fx, installedWith(['other@market', INSTALL_ID]));
        const out = runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true });
        const reports = named(out, 'Plugin install');
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'PASS', reports[0].Detail);
        assert.deepStrictEqual(out.InstallCalls, []);
    } finally {
        rmDir(fx.root);
    }
});

test('a missing or unparseable install file reads WARN with the reason, never a throw', { skip: !isWin }, () => {
    const fx = makeRoot('drm-install-warn-');
    try {
        writeSettings(fx, SETTINGS);
        const missing = named(runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true }), 'Plugin install');
        assert.strictEqual(missing[0].Status, 'WARN', missing[0].Detail);
        assert.match(missing[0].Detail, /does not exist/);

        writeInstalled(fx, '{ not json');
        const out = runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true });
        const bad = named(out, 'Plugin install');
        assert.strictEqual(bad[0].Status, 'WARN', bad[0].Detail);
        assert.match(bad[0].Detail, /could not be read or parsed/);
        assert.deepStrictEqual(out.InstallCalls, []);
    } finally {
        rmDir(fx.root);
    }
});

test('a plugin not enabled in settings has no install to check', { skip: !isWin }, () => {
    const fx = makeRoot('drm-install-off-');
    try {
        writeSettings(fx, { ...SETTINGS, enabledPlugins: { [INSTALL_ID]: false } });
        writeInstalled(fx, installedWith([]));
        const out = runSection(fx, STYLE_AND_INSTALL, { fix: true, yes: true });
        assert.strictEqual(named(out, 'Plugin install')[0].Status, 'INFO');
        assert.deepStrictEqual(out.InstallCalls, []);
    } finally {
        rmDir(fx.root);
    }
});
