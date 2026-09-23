// Tests for the doctor's payload naming and its trailing reading: a derived
// FAIL or WARN names the copy of the kit its expected value was read from, in
// the banner's words, and a clone run whose machine matches the installed copy
// and not the checkout reads as trailing that checkout rather than as broken.
//
// Node's built-in test runner, no framework, no install. The cases spawn
// Windows PowerShell and are skipped off Windows, where the doctor itself does
// not run.
//
// Each area lifts its doctor.ps1 sections as source text and executes them
// (Invoke-Expression) in one PowerShell process per area, looping over its
// cases, the technique doctor-goal-state.test.js and embedder-install.test.js
// use. Report is stubbed to capture each call and Get-SanitizedLine to
// identity; everything else is real doctor code: the installed-copy lookup
// requires the checkout's own scripts\memq-shim.js under node, the memq shim
// helpers and the memory-sync installer are dot-sourced, and every store, bin
// directory and plugins root is a temp fixture. The resolver is pointed at its
// fixture by KIT_PLUGINS_ROOT with KIT_PLUGINS_ROOT_ALLOW_CODE=1, and
// USERPROFILE points at the fixture home, so nothing reads the real ~/.claude.

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
const SHIM_HELPERS = path.join(PLUGIN_ROOT, 'doctor', 'install-memq-shim.ps1');
const SYNC_INSTALLER = path.join(PLUGIN_ROOT, 'doctor', 'install-memory-sync.ps1');
const isWin = process.platform === 'win32';

const CLONE_TOKEN = 'repo clone: ' + REPO;
const INSTALLED_TOKEN = 'installed plugin: ' + PLUGIN_ROOT;
const ANY_CLAUSE = /Expected value read from /;

// A derived report ends with the clause naming its copy. The last detail line
// is pinned as the clause, and the copy is matched as the banner's token
// inside it rather than as the clause's whole sentence.
function assertEndsNaming(report, token) {
    const last = report.Detail[report.Detail.length - 1];
    assert.match(last, ANY_CLAUSE, 'the last detail line must be the clause: ' + JSON.stringify(report.Detail));
    assert.ok(last.includes(token), 'the clause must name ' + token + ': ' + last);
}

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function write(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
}

// Runs the named doctor sections once per case inside one PowerShell process.
// `sections` pairs each start marker with the marker that ends it; `setup` is
// PowerShell run before each case's sections with $case bound, and `capture`
// is a PowerShell hashtable body added to that case's result. Output travels
// through a temp file for the reason doctor-goal-state.test.js gives.
function runCases({ sections, cases, setup, capture, env, preamble }) {
    const outFile = path.join(os.tmpdir(), 'doctor-payload-' + process.pid + '-' + Date.now()
        + '-' + Math.random().toString(36).slice(2) + '.json');
    const optsFile = outFile.replace(/\.json$/, '.opts.json');
    fs.writeFileSync(optsFile, JSON.stringify({ Cases: cases }), 'utf8');
    const lift = sections.map(([start, end], i) => [
        '$__s = $src.IndexOf(' + q(start) + ')',
        'if ($__s -lt 0) { throw ' + q('start marker not found: ' + start) + ' }',
        '$__e = $src.IndexOf(' + q(end) + ', $__s)',
        'if ($__e -lt 0) { throw ' + q('end marker not found: ' + end) + ' }',
        '$__section' + i + ' = $src.Substring($__s, $__e - $__s)'
    ].join('\n'));
    const script = [
        '$opts = [System.IO.File]::ReadAllText(' + q(optsFile) + ') | ConvertFrom-Json',
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        ...lift,
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Report { param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = @($Detail) } }',
        'function Get-Consent { param($Question) return $true }',
        '$__ast = [System.Management.Automation.Language.Parser]::ParseInput($src, [ref]$null, [ref]$null)',
        'foreach ($__fn in $__ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and @("Get-PayloadCopyName", "Get-PayloadClause") -contains $n.Name }, $true)) { Invoke-Expression $__fn.Extent.Text }',
        '$repoRoot = ' + q(REPO),
        '$pluginRoot = ' + q(PLUGIN_ROOT),
        '$nodeCmd = [pscustomobject]@{ Source = ' + q(process.execPath) + ' }',
        ...(preamble || []),
        '$__results = @()',
        'foreach ($case in $opts.Cases) {',
        '    $isClone = [bool]$case.IsClone',
        '    $Fix = [bool]$case.Fix',
        '    $claudeDir = $case.ClaudeDir',
        '    if ($case.PluginsRoot) { $env:KIT_PLUGINS_ROOT = $case.PluginsRoot } else { Remove-Item Env:\\KIT_PLUGINS_ROOT -ErrorAction SilentlyContinue }',
        setup || '',
        '    $script:Reports = @()',
        ...sections.map((_, i) => '    Invoke-Expression $__section' + i),
        '    $__results += @{ Name = $case.Name; Reports = @($script:Reports); InstalledRoot = [string]$installedRoot; ' + (capture || '') + ' }',
        '}',
        '$__json = @{ Results = @($__results) } | ConvertTo-Json -Compress -Depth 8',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        // The slowest area runs in about 5 seconds; the cap only stops a hung
        // PowerShell from holding the suite.
        { encoding: 'utf8', timeout: 120000, env: { ...process.env, KIT_PLUGINS_ROOT_ALLOW_CODE: '1', ...(env || {}) } });
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        const byName = {};
        for (const r of parsed.Results) byName[r.Name] = r;
        return byName;
    } finally {
        for (const f of [outFile, optsFile]) { try { fs.unlinkSync(f); } catch { /* best effort */ } }
    }
}

function reportsNamed(result, name) {
    return result.Reports.filter((r) => r.Name === name);
}

const CHECKOUT_STATUSLINE = fs.readFileSync(path.join(PLUGIN_ROOT, 'scripts', 'kit-statusline.js'), 'utf8');
const CHECKOUT_SYNC_INSTALLER = fs.readFileSync(SYNC_INSTALLER, 'utf8');
const CHECKOUT_SHIM_HELPERS = fs.readFileSync(SHIM_HELPERS, 'utf8');

// One plugins root holding one installed kit, listed in installed_plugins.json
// the way the harness lists it, or, with `marketplace` and no manifest, found
// only by the cache scan. `statusline` is that copy's kit-statusline.js text
// (null ships none), `syncInstaller` its install-memory-sync.ps1 text and
// `shimHelpers` its install-memq-shim.ps1 text.
function makeInstalledCopy(home, { statusline, syncInstaller, shimHelpers, marketplace }) {
    const pluginsRoot = path.join(home, 'plugins');
    const root = path.join(pluginsRoot, 'cache', marketplace || 'fixture-mp', 'claude-kit', '1.0.0');
    if (!marketplace) {
        write(path.join(pluginsRoot, 'installed_plugins.json'),
            JSON.stringify({ plugins: { 'claude-kit@fixture-mp': [{ installPath: root }] } }));
    }
    // memq's own argless contract: a usage line and exit 1, which is what the
    // shim check's health run reads as a resolving payload.
    write(path.join(root, 'scripts', 'memq.js'), "process.stderr.write('usage: memq <verb>\\n'); process.exit(1);\n");
    fs.copyFileSync(path.join(PLUGIN_ROOT, 'scripts', 'memq-shim.js'), path.join(root, 'scripts', 'memq-shim.js'));
    if (statusline !== null) write(path.join(root, 'scripts', 'kit-statusline.js'), statusline);
    write(path.join(root, 'doctor', 'install-memory-sync.ps1'), syncInstaller || CHECKOUT_SYNC_INSTALLER);
    write(path.join(root, 'doctor', 'install-memq-shim.ps1'), shimHelpers || CHECKOUT_SHIM_HELPERS);
    return { pluginsRoot, root };
}

const PS1_EXIT_LINE = "'exit $LASTEXITCODE',";
// An installed copy whose PowerShell wrapper text differs from the checkout's:
// the wrapper texts live in install-memq-shim.ps1, not in the payload's scripts.
const OLDER_SHIM_HELPERS = CHECKOUT_SHIM_HELPERS.replace(PS1_EXIT_LINE, "'exit $LASTEXITCODE # the installed copy''s build',");
// An installed copy whose own helpers predate kit-statusline.js: its shim set
// is the four files without it, so a bin it installed holds no such file, and
// the checkout reads that file as missing.
const SHIM_SET_LINE = 'return @("memq-shim.js", "memq.ps1", "memq.cmd", "memq", "kit-statusline.js")';
const COPIED_SET_LINE = 'return @("memq-shim.js", "kit-statusline.js")';
const SMALLER_SET_SHIM_HELPERS = CHECKOUT_SHIM_HELPERS
    .replace(SHIM_SET_LINE, 'return @("memq-shim.js", "memq.ps1", "memq.cmd", "memq")')
    .replace(COPIED_SET_LINE, 'return @("memq-shim.js")');
const TYPE_TIER_LINE = "'# The type tier, live and archived.'";
// An installed copy one comment line away from the checkout: the rules are the
// same, so every leak probe answers the same, and only the derived text moves.
const OLDER_SYNC_INSTALLER = CHECKOUT_SYNC_INSTALLER.replace(TYPE_TIER_LINE, "'# The type tier, as the installed copy words it.'");

test('fixture control: each installed-copy variant differs from the checkout by exactly one line', () => {
    assert.strictEqual(CHECKOUT_SYNC_INSTALLER.split(TYPE_TIER_LINE).length, 2, 'the replaced line must occur once in install-memory-sync.ps1');
    assert.notStrictEqual(OLDER_SYNC_INSTALLER, CHECKOUT_SYNC_INSTALLER);
    assert.strictEqual(CHECKOUT_SHIM_HELPERS.split(PS1_EXIT_LINE).length, 2, 'the replaced line must occur once in install-memq-shim.ps1');
    for (const line of [SHIM_SET_LINE, COPIED_SET_LINE]) {
        assert.strictEqual(CHECKOUT_SHIM_HELPERS.split(line).length, 2, 'the replaced line must occur once in install-memq-shim.ps1: ' + line);
    }
});

test('a derived Doctrine import WARN ends by naming the copy in the banner\'s words, and an underived one does not', { skip: !isWin }, () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-payload-doctrine-'));
    try {
        const drifted = path.join(home, 'drifted', '.claude');
        write(path.join(drifted, 'CLAUDE.md'), '@claude-kit-doctrine.md\n');
        write(path.join(drifted, 'claude-kit-doctrine.md'), 'not the payload\'s doctrine body\n');
        const noImport = path.join(home, 'no-import', '.claude');
        fs.mkdirSync(noImport, { recursive: true });
        const results = runCases({
            sections: [['# --- Doctrine import and freshness.', '# --- Kaizen signpost + git hooks.']],
            cases: [
                { Name: 'clone', IsClone: true, ClaudeDir: drifted },
                { Name: 'installed', IsClone: false, ClaudeDir: drifted },
                { Name: 'no-import', IsClone: true, ClaudeDir: noImport }
            ],
            env: { USERPROFILE: home }
        });
        for (const [name, token] of [['clone', CLONE_TOKEN], ['installed', INSTALLED_TOKEN]]) {
            const [r] = reportsNamed(results[name], 'Doctrine import');
            assert.strictEqual(r.Status, 'WARN', JSON.stringify(r));
            assert.match(r.Detail.join('\n'), /differs from this payload's skill body/);
            assertEndsNaming(r, token);
        }
        const [missing] = reportsNamed(results['no-import'], 'Doctrine import');
        assert.strictEqual(missing.Status, 'WARN', JSON.stringify(missing));
        assert.match(missing.Detail.join('\n'), /Add this line to/);
        assert.doesNotMatch(missing.Detail.join('\n'), ANY_CLAUSE);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

// The hook-wiring checks read hooks.json and the hook files from the payload,
// so each FAIL names that copy. The payload root is an empty temp directory, so
// both checks find no hook file and no hooks.json.
test('the Kit goal hook and Hook canary FAILs end by naming the copy in the banner\'s words', { skip: !isWin }, () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-payload-hooks-'));
    try {
        const emptyPayload = path.join(home, 'payload');
        fs.mkdirSync(emptyPayload, { recursive: true });
        const results = runCases({
            sections: [['# --- Kit goal continuity.', '# Load-check the enforcing hook itself']],
            cases: [
                { Name: 'clone', IsClone: true, ClaudeDir: path.join(home, '.claude'), PayloadRoot: emptyPayload },
                { Name: 'installed', IsClone: false, ClaudeDir: path.join(home, '.claude'), PayloadRoot: emptyPayload }
            ],
            setup: '    $pluginRoot = $case.PayloadRoot',
            env: { USERPROFILE: home }
        });
        for (const [name, token] of [['clone', CLONE_TOKEN], ['installed', 'installed plugin: ' + emptyPayload]]) {
            for (const check of ['Kit goal hook', 'Hook canary']) {
                const [r] = reportsNamed(results[name], check);
                assert.strictEqual(r.Status, 'FAIL', name + ' ' + check + ': ' + JSON.stringify(r));
                assert.match(r.Detail.join('\n'), /not found at /);
                assertEndsNaming(r, token);
            }
        }
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

// The memq shim cases. Each case's bin directory is installed by the real
// Install-MemqShim from one of three roots: the checkout, the installed copy,
// or a third root matching neither. Get-Command is shadowed for the name memq
// alone, so name resolution reads the case's bin directory rather than
// whatever this machine's PATH holds. Whether -Fix installed is read from the
// bin directory itself before and after the section, its kit-statusline.js
// bytes and the name and hash of every file in it, not from the report.
test('memq shim: trailing reads INFO and installs nothing, both reads PASS, neither FAILs naming the copy and installs under -Fix', { skip: !isWin }, () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-payload-memq-'));
    try {
        const older = makeInstalledCopy(path.join(home, 'older'), {
            statusline: CHECKOUT_STATUSLINE + '\n// the installed copy\'s build\n', syncInstaller: CHECKOUT_SYNC_INSTALLER });
        const same = makeInstalledCopy(path.join(home, 'same'), {
            statusline: CHECKOUT_STATUSLINE, syncInstaller: CHECKOUT_SYNC_INSTALLER });
        const third = path.join(home, 'third');
        fs.mkdirSync(path.join(third, 'scripts'), { recursive: true });
        fs.copyFileSync(path.join(PLUGIN_ROOT, 'scripts', 'memq-shim.js'), path.join(third, 'scripts', 'memq-shim.js'));
        write(path.join(third, 'scripts', 'kit-statusline.js'), CHECKOUT_STATUSLINE + '\n// neither copy\'s build\n');
        const emptyPlugins = path.join(home, 'empty-plugins');
        fs.mkdirSync(emptyPlugins, { recursive: true });
        // Wrapper text differs: the installed copy's install-memq-shim.ps1
        // writes another memq.ps1 than the checkout's, and the bin holds it.
        const olderWrapper = makeInstalledCopy(path.join(home, 'older-wrapper'), {
            statusline: CHECKOUT_STATUSLINE, shimHelpers: OLDER_SHIM_HELPERS });
        // An installed copy that ships no kit-statusline.js at all.
        const lacking = makeInstalledCopy(path.join(home, 'lacking'), { statusline: null });
        // An installed copy whose own shim set lacks a file the checkout's
        // names, with the bin written by that copy's own installer.
        const smallerSet = makeInstalledCopy(path.join(home, 'smaller-set'), { statusline: null, shimHelpers: SMALLER_SET_SHIM_HELPERS });
        const smallerSetHelpers = path.join(smallerSet.root, 'doctor', 'install-memq-shim.ps1');
        // No manifest and two marketplaces offering one copy each, so the
        // resolver notes on stderr which one it chose.
        const tieHome = path.join(home, 'tie');
        const tieA = makeInstalledCopy(tieHome, {
            statusline: CHECKOUT_STATUSLINE + '\n// the installed copy\'s build\n', marketplace: 'mp-a' });
        const tieB = makeInstalledCopy(tieHome, {
            statusline: CHECKOUT_STATUSLINE + '\n// the installed copy\'s build\n', marketplace: 'mp-b' });

        const c = (name, fix, plugins, binSource, ps1From, installWith) => ({
            Name: name, IsClone: true, Fix: fix, PluginsRoot: plugins,
            ClaudeDir: path.join(home, name, '.claude'), BinSource: binSource, Ps1From: ps1From || '', InstallWith: installWith || ''
        });
        const results = runCases({
            sections: [['# --- Installed copy.', '# --- Memory sync. The memory store is']],
            cases: [
                c('trailing', false, older.pluginsRoot, older.root),
                c('trailing-fix', true, older.pluginsRoot, older.root),
                c('both', false, same.pluginsRoot, PLUGIN_ROOT),
                c('neither', false, older.pluginsRoot, third),
                c('neither-fix', true, older.pluginsRoot, third),
                c('no-payload', false, emptyPlugins, PLUGIN_ROOT),
                c('wrapper', false, olderWrapper.pluginsRoot, PLUGIN_ROOT, path.join(olderWrapper.root, 'doctor', 'install-memq-shim.ps1')),
                c('wrapper-fix', true, olderWrapper.pluginsRoot, PLUGIN_ROOT, path.join(olderWrapper.root, 'doctor', 'install-memq-shim.ps1')),
                c('lacking', false, lacking.pluginsRoot, third),
                c('tie', false, tieA.pluginsRoot, tieA.root),
                c('smaller-set', false, smallerSet.pluginsRoot, smallerSet.root, null, smallerSetHelpers),
                c('smaller-set-fix', true, smallerSet.pluginsRoot, smallerSet.root, null, smallerSetHelpers)
            ],
            preamble: [
                '. ' + q(SHIM_HELPERS),
                'function Get-Command { param($Name, $ErrorAction)',
                '    if ($Name -eq "memq") { return [pscustomobject]@{ Source = (Join-Path $claudeDir "bin\\memq.ps1") } }',
                '    return Microsoft.PowerShell.Core\\Get-Command $Name -ErrorAction SilentlyContinue }',
                'function Add-ToUserPath { param($Directory) throw "a test never writes the user PATH" }',
                'function Read-OrEmpty { param($File) if (Test-Path -LiteralPath $File -PathType Leaf) { return [System.IO.File]::ReadAllText($File) } return "" }',
                'function Get-BinSnapshot { param($Dir) return ((Get-ChildItem -LiteralPath $Dir -File | Sort-Object Name | ForEach-Object { $_.Name + "=" + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }) -join ";") }'
            ],
            setup: [
                '    if ($case.InstallWith) {',
                '        & (New-Module -ScriptBlock { param($p) . $p; Export-ModuleMember } -ArgumentList $case.InstallWith) { param($r, $d) Install-MemqShim -PluginRoot $r -ClaudeDir $d } $case.BinSource $claudeDir | Out-Null',
                '    }',
                '    else { Install-MemqShim -PluginRoot $case.BinSource -ClaudeDir $claudeDir | Out-Null }',
                '    $__binPs1 = Join-Path $claudeDir "bin\\memq.ps1"',
                '    if ($case.Ps1From) {',
                '        $__ps1 = & (New-Module -ScriptBlock { param($p) . $p; Export-ModuleMember } -ArgumentList $case.Ps1From) { Get-MemqPs1WrapperText }',
                '        [System.IO.File]::WriteAllText($__binPs1, $__ps1, (New-Object System.Text.UTF8Encoding($false)))',
                '    }',
                '    $__binLine = Join-Path $claudeDir "bin\\kit-statusline.js"',
                '    $__before = Read-OrEmpty $__binLine',
                '    $__ps1Before = [System.IO.File]::ReadAllText($__binPs1)',
                '    $__binBefore = Get-BinSnapshot (Join-Path $claudeDir "bin")'
            ].join('\n'),
            capture: 'Before = $__before; After = (Read-OrEmpty $__binLine); '
                + 'Ps1Before = $__ps1Before; Ps1After = [System.IO.File]::ReadAllText($__binPs1); '
                + 'BinBefore = $__binBefore; BinAfter = (Get-BinSnapshot (Join-Path $claudeDir "bin")); '
                + 'ResolverRan = [bool]$script:InstalledKitRootRead',
            env: { USERPROFILE: home }
        });

        const only = (name) => {
            const rs = reportsNamed(results[name], 'memq shim');
            assert.strictEqual(rs.length, 1, name + ': ' + JSON.stringify(results[name].Reports));
            return rs[0];
        };

        // The resolver found the fixture's installed copy, never this checkout.
        assert.strictEqual(path.resolve(results.trailing.InstalledRoot), path.resolve(older.root));
        assert.strictEqual(results['no-payload'].InstalledRoot, '');

        for (const name of ['trailing', 'trailing-fix']) {
            const r = only(name);
            assert.strictEqual(r.Status, 'INFO', name + ': ' + JSON.stringify(r));
            assert.ok(r.Detail.join('\n').includes('trails the checkout in hand: ' + older.root), JSON.stringify(r.Detail));
            assert.ok(!results[name].Reports.some((x) => x.Status === 'FAIL'), name + ' must record no FAIL: ' + JSON.stringify(results[name].Reports));
            assert.strictEqual(results[name].After, results[name].Before, name + ': the bin directory must be left as found');
        }
        // The -Fix trailing case installed nothing: the bin copy still holds the
        // installed copy's bytes, not the checkout's.
        assert.notStrictEqual(results['trailing-fix'].After.replace(/\r\n/g, '\n'), CHECKOUT_STATUSLINE.replace(/\r\n/g, '\n'));

        assert.strictEqual(only('both').Status, 'PASS', JSON.stringify(only('both')));
        // A run that finds nothing differing never looks the installed copy up.
        assert.strictEqual(results.both.ResolverRan, false, 'a healthy run must spawn no resolver');
        assert.strictEqual(results.trailing.ResolverRan, true, 'control: the flag reads true where the lookup ran');

        // A wrapper written by the installed copy's own helpers reads trailing,
        // and -Fix leaves that wrapper as found.
        for (const name of ['wrapper', 'wrapper-fix']) {
            const r = only(name);
            assert.strictEqual(r.Status, 'INFO', name + ': ' + JSON.stringify(r));
            assert.match(r.Detail.join('\n'), /memq\.ps1/, 'the differing file is the wrapper: ' + JSON.stringify(r.Detail));
            assert.ok(!results[name].Reports.some((x) => x.Status === 'FAIL'), name + ': ' + JSON.stringify(results[name].Reports));
            assert.strictEqual(results[name].Ps1After, results[name].Ps1Before, name + ': memq.ps1 must be left as found');
        }

        // An installed copy that ships no kit-statusline.js cannot vouch for
        // the bin's copy of it, so a bin copy differing from the checkout FAILs.
        const lackingReport = only('lacking');
        assert.strictEqual(lackingReport.Status, 'FAIL', JSON.stringify(lackingReport));
        assert.match(lackingReport.Detail.join('\n'), /kit-statusline\.js/);

        // An installed copy whose own shim set lacks kit-statusline.js vouches
        // for a bin holding no such file: the checkout reads it missing, the
        // installed copy's own helpers read nothing missing or differing, so
        // the step reads trailing, and -Fix leaves every bin file as found.
        for (const name of ['smaller-set', 'smaller-set-fix']) {
            const r = only(name);
            assert.strictEqual(r.Status, 'INFO', name + ': ' + JSON.stringify(results[name].Reports));
            assert.ok(r.Detail.join('\n').includes('trails the checkout in hand: ' + smallerSet.root), JSON.stringify(r.Detail));
            assert.match(r.Detail.join('\n'), /kit-statusline\.js/, 'the INFO names the file absent against the checkout: ' + JSON.stringify(r.Detail));
            assert.ok(!results[name].Reports.some((x) => x.Status === 'FAIL'), name + ' must record no FAIL: ' + JSON.stringify(results[name].Reports));
            assert.ok(!results[name].BinBefore.includes('kit-statusline.js='), name + ': control, the fixture bin holds no kit-statusline.js: ' + results[name].BinBefore);
            assert.strictEqual(results[name].BinAfter, results[name].BinBefore, name + ': the bin directory must be left as found');
        }

        // The resolver's choice among marketplaces rides the trailing INFO.
        const tie = only('tie');
        assert.strictEqual(tie.Status, 'INFO', JSON.stringify(tie));
        assert.ok([tieA.root, tieB.root].map((p) => path.resolve(p)).includes(path.resolve(results.tie.InstalledRoot)), results.tie.InstalledRoot);
        assert.match(tie.Detail.join('\n'), /2 marketplaces offer a claude-kit payload/, JSON.stringify(tie.Detail));

        const neither = only('neither');
        assert.strictEqual(neither.Status, 'FAIL', JSON.stringify(neither));
        assertEndsNaming(neither, CLONE_TOKEN);
        assert.ok(neither.Detail.some((l) => l.startsWith('Fix: ') && l.includes(CLONE_TOKEN)), 'the remedy names the copy it installs from: ' + JSON.stringify(neither.Detail));
        assert.strictEqual(results.neither.After, results.neither.Before);

        // -Fix on the neither case installs from the checkout, as it always has.
        const neitherFix = results['neither-fix'];
        assert.notStrictEqual(neitherFix.Before, neitherFix.After, 'the -Fix install must have rewritten the bin copy');
        assert.strictEqual(neitherFix.After, CHECKOUT_STATUSLINE);
        assert.strictEqual(only('neither-fix').Status, 'FIXED', JSON.stringify(only('neither-fix')));

        // The no-payload WARN compares nothing against the payload, so it takes no clause.
        const noPayload = only('no-payload');
        assert.strictEqual(noPayload.Status, 'WARN', JSON.stringify(noPayload));
        assert.match(noPayload.Detail.join('\n'), /no claude-kit plugin payload is installed/);
        assert.doesNotMatch(noPayload.Detail.join('\n'), ANY_CLAUSE);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

// The Memory sync cases. Each store is initialized by the real checkout
// installer, given a bare origin it pushes to, and then has its .gitignore
// replaced with the text one copy or another derives. Whether -Fix ran the
// installer is read from the store itself: its .gitignore bytes and its HEAD
// commit before and after the section.
test('Memory sync: trailing reads INFO and skips the installer under -Fix, both reads PASS, neither FAILs naming the copy and restores under -Fix', { skip: !isWin }, () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-payload-sync-'));
    try {
        const older = makeInstalledCopy(path.join(home, 'older'), {
            statusline: CHECKOUT_STATUSLINE, syncInstaller: OLDER_SYNC_INSTALLER });
        const same = makeInstalledCopy(path.join(home, 'same'), {
            statusline: CHECKOUT_STATUSLINE, syncInstaller: CHECKOUT_SYNC_INSTALLER });

        const c = (name, fix, installed, ignore) => {
            const store = path.join(home, name, '.claude');
            write(path.join(store, '.credentials.json'), '{"token":"secret"}\n');
            write(path.join(store, 'settings.json'), '{"model":"opus"}\n');
            write(path.join(store, 'history.jsonl'), '{"display":"a prompt"}\n');
            write(path.join(store, 'memory-types', 'tag-registry.md'), '# tags\n');
            const bare = path.join(home, name, 'origin.git');
            assert.strictEqual(spawnSync('git', ['init', '--bare', '-q', bare], { encoding: 'utf8', timeout: 60000 }).status, 0);
            return { Name: name, IsClone: true, Fix: fix, PluginsRoot: installed.pluginsRoot, ClaudeDir: store, Bare: bare, Ignore: ignore, InstalledSync: path.join(installed.root, 'doctor', 'install-memory-sync.ps1') };
        };
        const results = runCases({
            sections: [
                ['# --- Installed copy.', '# --- memq shim.'],
                ['# --- Memory sync. The memory store is', '# --- Embedder (semantic memory search).']
            ],
            cases: [
                c('trailing', false, older, 'installed'),
                c('trailing-fix', true, older, 'installed'),
                c('both', false, same, 'checkout'),
                c('neither', false, older, 'neither'),
                c('neither-fix', true, older, 'neither')
            ],
            // The checkout's allowlist text is read once, before any section runs,
            // so a section that leaked the installed copy's functions into this
            // session could not also move the text the cases are judged against.
            preamble: ['. ' + q(SYNC_INSTALLER), '$__canonical = Get-MemorySyncIgnoreText'],
            setup: [
                '    $__r = Install-MemorySyncRepo -StoreRoot $claudeDir',
                '    if (-not $__r.Ok) { throw ("fixture install failed: " + ($__r.Notes -join " ")) }',
                '    & git -C $claudeDir remote add origin $case.Bare',
                '    $__branch = (& git -C $claudeDir rev-parse --abbrev-ref HEAD)',
                '    & git -C $claudeDir push -q -u origin $__branch 2>$null',
                // A memory written after the last commit: the commit an
                // installer run would make, so HEAD shows whether it ran.
                '    [System.IO.File]::WriteAllText((Join-Path $claudeDir "memory-types\\new-note.md"), "# new`n")',
                '    $__ignorePath = Join-Path $claudeDir ".gitignore"',
                '    $__text = switch ($case.Ignore) {',
                '        "installed" { & (New-Module -ScriptBlock { param($p) . $p; Export-ModuleMember } -ArgumentList $case.InstalledSync) { Get-MemorySyncIgnoreText } }',
                '        "neither" { $__canonical.Replace("# The type tier, live and archived.", "# The type tier, edited by hand.") }',
                '        default { $__canonical }',
                '    }',
                '    [System.IO.File]::WriteAllText($__ignorePath, $__text, (New-Object System.Text.UTF8Encoding($false)))',
                '    $__ignoreBefore = [System.IO.File]::ReadAllText($__ignorePath)',
                '    $__headBefore = (& git -C $claudeDir rev-parse HEAD)'
            ].join('\n'),
            capture: 'IgnoreBefore = $__ignoreBefore; IgnoreAfter = [System.IO.File]::ReadAllText($__ignorePath); '
                + 'HeadBefore = [string]$__headBefore; HeadAfter = [string](& git -C $claudeDir rev-parse HEAD); '
                + 'Canonical = $__canonical',
            env: { USERPROFILE: home }
        });

        const only = (name) => {
            const rs = reportsNamed(results[name], 'Memory sync');
            assert.strictEqual(rs.length, 1, name + ': ' + JSON.stringify(results[name].Reports));
            return rs[0];
        };

        for (const name of ['trailing', 'trailing-fix']) {
            const r = only(name);
            assert.notStrictEqual(results[name].IgnoreBefore, results[name].Canonical, name + ': the fixture must drift from the checkout');
            assert.strictEqual(r.Status, 'INFO', name + ': ' + JSON.stringify(r));
            assert.ok(r.Detail.join('\n').includes('trails the checkout in hand: ' + older.root), JSON.stringify(r.Detail));
            assert.ok(!results[name].Reports.some((x) => x.Status === 'FAIL'), name + ' must record no FAIL: ' + JSON.stringify(results[name].Reports));
            assert.strictEqual(results[name].IgnoreAfter, results[name].IgnoreBefore, name + ': .gitignore must be left as found');
            assert.strictEqual(results[name].HeadAfter, results[name].HeadBefore, name + ': nothing may be committed');
        }
        assert.ok(only('trailing-fix').Detail.some((l) => l.includes("runs from the installed copy's doctor")), JSON.stringify(only('trailing-fix').Detail));
        assert.ok(!only('trailing').Detail.some((l) => l.includes("runs from the installed copy's doctor")), 'the skipped-install line is a -Fix line only');

        assert.strictEqual(only('both').Status, 'PASS', JSON.stringify(only('both')));

        const neither = only('neither');
        assert.strictEqual(neither.Status, 'FAIL', JSON.stringify(neither));
        assert.match(neither.Detail.join('\n'), /\.gitignore differs from the allowlist this doctor derives/);
        assertEndsNaming(neither, CLONE_TOKEN);
        assert.ok(neither.Detail.some((l) => l.startsWith('Fix: ') && l.includes(CLONE_TOKEN)), JSON.stringify(neither.Detail));

        // -Fix on the neither case runs the installer from the checkout: the
        // allowlist is restored to the checkout's text and the pending memory
        // is committed.
        const neitherFix = results['neither-fix'];
        assert.notStrictEqual(neitherFix.IgnoreBefore, neitherFix.Canonical);
        assert.strictEqual(neitherFix.IgnoreAfter.replace(/\r\n/g, '\n'), neitherFix.Canonical.replace(/\r\n/g, '\n'));
        assert.notStrictEqual(neitherFix.HeadAfter, neitherFix.HeadBefore, 'the installer must have committed the pending memory');
        assert.notStrictEqual(only('neither-fix').Status, 'INFO', JSON.stringify(only('neither-fix')));
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});
