// Tests for the doctor's embedder section: plugins/claude-kit/doctor/
// install-embedder.ps1 and the "Embedder (semantic search)" section of
// doctor.ps1.
//
// Node's built-in test runner, no framework, no install (Node v24). Every
// case that exercises install-embedder.ps1's functions or the doctor points
// at a fresh temp directory and passes it explicitly, so nothing here reads
// or writes the real ~\.claude or ~\.claude\kit-embedder. process.env is
// spread, never rebuilt, so children keep the Windows `Path` key. The cases
// spawn Windows PowerShell and are skipped off Windows, where the doctor
// itself does not run.
//
// The real embedding package is never installed by these cases: probeEmbedder
// answers from four filesystem checks (a package.json's version field, and
// the existence of the four model files), so every state (absent, unusable,
// ready) is producible with a handful of empty fixture files, no download and
// no npm run required. That is what lets this suite run on every machine,
// with or without the real stack installed, the same way memory-index.test.js
// separates its stub-embedder cases from its real-model ones.
//
// Nothing here runs doctor.ps1 -Fix. Its execution-policy and user-PATH
// repairs reach user-scope machine state that a USERPROFILE redirect does not
// cover, the same reason memory-sync.test.js gives for avoiding it. The
// doctor is exercised in check mode only (which every case here proves writes
// nothing), and the consent-gated install path is proven wired rather than
// run, by extracting Get-Consent and the npm-absence branch from doctor.ps1's
// own source, the pattern memory-sync.test.js established for this exact
// problem.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const PLUGIN_ROOT = path.join(REPO, 'plugins', 'claude-kit');
const INSTALLER = path.join(PLUGIN_ROOT, 'doctor', 'install-embedder.ps1');
const DOCTOR = path.join(PLUGIN_ROOT, 'doctor', 'doctor.ps1');
const MEMORY_INDEX_JS = path.join(PLUGIN_ROOT, 'scripts', 'memory-index.js');
const isWin = process.platform === 'win32';

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

function makeRoot(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // Best-effort cleanup; leaving a temp dir behind never fails the test.
    }
}

// A fake embedder install, at whichever fixture state the case asks for.
// 'ready': package.json plus every model file. 'unusable': package.json with
// no model cache at all (the plainest way a real install can be incomplete).
// 'absent': the root itself does not exist.
function plantEmbedder(root, state) {
    if (state === 'absent') return;
    const pkgDir = path.join(root, 'node_modules', '@huggingface', 'transformers');
    write(path.join(pkgDir, 'package.json'), JSON.stringify({ name: '@huggingface/transformers', version: '9.9.9' }));
    if (state === 'unusable') return;
    const modelDir = path.join(pkgDir, '.cache', 'Xenova', 'all-MiniLM-L6-v2');
    write(path.join(modelDir, 'config.json'), '{}');
    write(path.join(modelDir, 'tokenizer.json'), '{}');
    write(path.join(modelDir, 'tokenizer_config.json'), '{}');
    write(path.join(modelDir, 'onnx', 'model_quantized.onnx'), 'not a real model');
}

function probeOf(root) {
    const script = '. ' + q(INSTALLER) + '; '
        + 'Get-EmbedderProbe -MemoryIndexPath ' + q(MEMORY_INDEX_JS) + ' -EmbedderRoot ' + q(root)
        + ' | ConvertTo-Json -Compress -Depth 4 | Write-Output';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    return JSON.parse(res.stdout);
}

function indexHealthOf(embedderRoot, storeRoot) {
    const script = '. ' + q(INSTALLER) + '; '
        + '$h = Get-EmbedderIndexHealth -MemoryIndexPath ' + q(MEMORY_INDEX_JS)
        + ' -EmbedderRoot ' + q(embedderRoot) + ' -StoreRoot ' + q(storeRoot) + '; '
        + '$h.models = @($h.models); '
        + '$h | ConvertTo-Json -Compress -Depth 4 | Write-Output';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    return JSON.parse(res.stdout);
}

function indexHealthLinesOf(embedderRoot, storeRoot) {
    const script = '. ' + q(INSTALLER) + '; '
        + '$h = Get-EmbedderIndexHealth -MemoryIndexPath ' + q(MEMORY_INDEX_JS)
        + ' -EmbedderRoot ' + q(embedderRoot) + ' -StoreRoot ' + q(storeRoot) + '; '
        + '$p = Get-EmbedderProbe -MemoryIndexPath ' + q(MEMORY_INDEX_JS) + ' -EmbedderRoot ' + q(embedderRoot) + '; '
        + '@(Get-EmbedderIndexHealthLines -IndexHealth $h -Probe $p) | ConvertTo-Json -Compress | Write-Output';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    const parsed = JSON.parse(res.stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
}

// The doctor itself, against a redirected home directory, check mode only
// (no -Fix; see this file's header for why). Asserted on the Embedder
// section's own line rather than the exit code, because the memory-sync
// section legitimately FAILs against a fresh fake home with no bearing on
// the embedder.
function doctorEmbedderLine(home) {
    const res = pwsh('& ' + q(DOCTOR), { USERPROFILE: home });
    const lines = res.stdout.split(/\r?\n/);
    const header = /^\[\w+\s*\] .+$/;
    const at = lines.findIndex((l) => /^\[\w+\s*\] Embedder \(semantic search\)$/.test(l.trim()));
    assert.notStrictEqual(at, -1, 'no Embedder section in the doctor output:\n' + res.stdout + res.stderr);
    const rest = lines.slice(at + 1);
    const until = rest.findIndex((l) => header.test(l.trim()));
    return {
        status: lines[at].trim().match(/^\[(\w+)/)[1],
        detail: (until < 0 ? rest : rest.slice(0, until)).filter((l) => l.startsWith('        ')).join('\n')
    };
}

// The absent and unusable readings are judged against this payload's
// memory-index.js, so their report ends with the clause naming the copy in the
// banner's words. This suite runs the doctor from the checkout, so the copy is
// the repo clone. The pin is the banner's copy token on the last detail line,
// which is what a reader acts on, not the sentence around it.
function assertEndsNamingClone(detail) {
    const last = detail.split('\n').pop().trim();
    assert.ok(last.includes('repo clone: ' + REPO), 'the last detail line must name the copy:\n' + detail);
    assert.ok(!last.startsWith('Fix: '), 'the last detail line must be the copy clause, not a remedy:\n' + detail);
    assert.ok(!last.includes('-Fix'), 'the last detail line must be the copy clause, not the -Fix remedy:\n' + detail);
}

test('the probe reports absent, unusable, and ready as three distinct states', { skip: !isWin }, () => {
    const root = makeRoot('embins-');
    try {
        const absentRoot = path.join(root, 'absent');
        plantEmbedder(absentRoot, 'absent');
        const absent = probeOf(absentRoot);
        assert.strictEqual(absent.status, 'absent');
        assert.strictEqual(absent.available, false);
        assert.match(absent.remedy, /run the kit-doctor skill's -Fix/);

        const unusableRoot = path.join(root, 'unusable');
        plantEmbedder(unusableRoot, 'unusable');
        const unusable = probeOf(unusableRoot);
        assert.strictEqual(unusable.status, 'unusable');
        assert.strictEqual(unusable.available, false);
        assert.match(unusable.detail, /model files are missing/);
        assert.match(unusable.remedy, /run the kit-doctor skill's -Fix/);

        const readyRoot = path.join(root, 'ready');
        plantEmbedder(readyRoot, 'ready');
        const ready = probeOf(readyRoot);
        assert.strictEqual(ready.status, 'ready');
        assert.strictEqual(ready.available, true);
        assert.strictEqual(ready.packageVersion, '9.9.9');
        assert.strictEqual(ready.remedy, null);
    } finally {
        rmDir(root);
    }
});

test('the doctor reports all three probe states with the right remedy direction, and check mode writes nothing', { skip: !isWin }, () => {
    const root = makeRoot('embdoc-');
    try {
        const home = path.join(root, 'absent-home');
        fs.mkdirSync(home, { recursive: true });
        const absentLine = doctorEmbedderLine(home);
        assert.strictEqual(absentLine.status, 'WARN', absentLine.detail);
        assert.match(absentLine.detail, /Not installed/);
        assert.match(absentLine.detail, /run the kit-doctor skill's -Fix \(installs the local embedding stack\)/);
        assertEndsNamingClone(absentLine.detail);
        assert.ok(!fs.existsSync(path.join(home, '.claude', 'kit-embedder')),
            'check mode must never create the embedder directory');

        const unusableHome = path.join(root, 'unusable-home');
        plantEmbedder(path.join(unusableHome, '.claude', 'kit-embedder'), 'unusable');
        const unusableLine = doctorEmbedderLine(unusableHome);
        assert.strictEqual(unusableLine.status, 'WARN', unusableLine.detail);
        assert.match(unusableLine.detail, /Installed but not usable/);
        assert.match(unusableLine.detail, /repair, not a fresh install/);
        assert.match(unusableLine.detail, /run the kit-doctor skill's -Fix/);
        assertEndsNamingClone(unusableLine.detail);

        const readyHome = path.join(root, 'ready-home');
        const embedderDir = path.join(readyHome, '.claude', 'kit-embedder');
        plantEmbedder(embedderDir, 'ready');
        const indexFile = path.join(readyHome, '.claude', 'memory-index.jsonl');
        write(indexFile, '');
        const beforeStat = fs.statSync(indexFile);
        const beforeTree = fs.readdirSync(path.join(embedderDir, 'node_modules', '@huggingface', 'transformers', '.cache', 'Xenova', 'all-MiniLM-L6-v2', 'onnx')).sort();
        const beforeMtime = fs.statSync(path.join(embedderDir, 'node_modules', '@huggingface', 'transformers', 'package.json')).mtimeMs;

        const readyLine = doctorEmbedderLine(readyHome);
        assert.strictEqual(readyLine.status, 'PASS', readyLine.detail);
        assert.match(readyLine.detail, /Installed: @huggingface\/transformers@9\.9\.9/);
        assert.match(readyLine.detail, /Semantic channel active/);
        // The planted sidecar is an empty file (present, zero records), which
        // is a distinct state from no sidecar at all; either way the check
        // below is what actually matters here: nothing about it changed.
        assert.match(readyLine.detail, /Index: 0 record\(s\)/);

        // Check mode writes nothing: neither the index sidecar nor the
        // embedder install tree changed as a result of reporting on them.
        const afterStat = fs.statSync(indexFile);
        assert.strictEqual(afterStat.mtimeMs, beforeStat.mtimeMs, 'the index sidecar must be untouched by check mode');
        assert.strictEqual(afterStat.size, beforeStat.size);
        const afterTree = fs.readdirSync(path.join(embedderDir, 'node_modules', '@huggingface', 'transformers', '.cache', 'Xenova', 'all-MiniLM-L6-v2', 'onnx')).sort();
        assert.deepStrictEqual(afterTree, beforeTree, 'check mode must not add or remove files under the embedder install');
        const afterMtime = fs.statSync(path.join(embedderDir, 'node_modules', '@huggingface', 'transformers', 'package.json')).mtimeMs;
        assert.strictEqual(afterMtime, beforeMtime, 'check mode must not rewrite the installed package.json');
    } finally {
        rmDir(root);
    }
});

test('index health reports correctly for a present, absent, and corrupt index, without touching it', { skip: !isWin }, () => {
    const root = makeRoot('embidx-');
    try {
        const embedderRoot = path.join(root, 'embedder');
        plantEmbedder(embedderRoot, 'ready');
        const storeRoot = path.join(root, 'store');
        fs.mkdirSync(storeRoot, { recursive: true });

        const absentHealth = indexHealthOf(embedderRoot, storeRoot);
        assert.strictEqual(absentHealth.status, 'absent');
        assert.strictEqual(absentHealth.count, 0);
        const absentLines = indexHealthLinesOf(embedderRoot, storeRoot);
        assert.match(absentLines.join('\n'), /none yet; built lazily/);

        // A well-formed record in the type tier, the shape memory-index.js
        // itself writes: store, tier, name, mtime, hash, model, vector.
        const indexFile = path.join(storeRoot, 'memory-index.jsonl');
        write(indexFile, JSON.stringify({
            store: 'a-type', tier: 'type', name: 'a-fact', mtime: 1, hash: 'deadbeef',
            model: '@huggingface/transformers@9.9.9/Xenova/all-MiniLM-L6-v2/q8', vector: [0.1, 0.2, 0.3]
        }) + '\n');
        const beforeStat = fs.statSync(indexFile);

        const okHealth = indexHealthOf(embedderRoot, storeRoot);
        assert.strictEqual(okHealth.status, 'ok');
        assert.strictEqual(okHealth.count, 1);
        assert.deepStrictEqual(okHealth.models, ['@huggingface/transformers@9.9.9/Xenova/all-MiniLM-L6-v2/q8']);
        const okLines = indexHealthLinesOf(embedderRoot, storeRoot);
        assert.match(okLines.join('\n'), /1 record\(s\), model @huggingface\/transformers@9\.9\.9/);
        // This record's model matches the installed one exactly, so no
        // mismatch line rides beside it.
        assert.ok(!okLines.some((l) => /different model identity/.test(l)), okLines.join('\n'));

        // Reading it twice must not have changed it: this is derived data the
        // doctor only ever reads to report on.
        const afterStat = fs.statSync(indexFile);
        assert.strictEqual(afterStat.mtimeMs, beforeStat.mtimeMs);
        assert.strictEqual(afterStat.size, beforeStat.size);

        write(indexFile, 'this is not json');
        const corruptHealth = indexHealthOf(embedderRoot, storeRoot);
        assert.strictEqual(corruptHealth.status, 'corrupt');
        const corruptLines = indexHealthLinesOf(embedderRoot, storeRoot);
        assert.match(corruptLines.join('\n'), /unreadable/);
        assert.match(corruptLines.join('\n'), /rebuilt automatically at the next query/);
        assert.ok(!corruptLines.some((l) => /delete/i.test(l)), 'a corrupt index is never told to be deleted by hand');
    } finally {
        rmDir(root);
    }
});

test('an index built by a different model identity than the one installed is named, not hidden', { skip: !isWin }, () => {
    const root = makeRoot('embmix-');
    try {
        const embedderRoot = path.join(root, 'embedder');
        plantEmbedder(embedderRoot, 'ready');
        const storeRoot = path.join(root, 'store');
        write(path.join(storeRoot, 'memory-index.jsonl'), JSON.stringify({
            store: 'a-type', tier: 'type', name: 'a-fact', mtime: 1, hash: 'deadbeef',
            model: '@huggingface/transformers@0.0.1/Xenova/all-MiniLM-L6-v2/q8', vector: [0.1, 0.2, 0.3]
        }) + '\n');
        const lines = indexHealthLinesOf(embedderRoot, storeRoot);
        assert.match(lines.join('\n'), /different model identity than the one installed now/);
    } finally {
        rmDir(root);
    }
});

// Run against the real npm on this machine, not a stub: the property under
// test is that Install-Embedder recovers from a package npm itself put there,
// which a stubbed npm cannot exercise. Real network and disk cost, bounded to
// exactly one extra install:
// the case plants a package.json valid enough to read 'unusable' (a version
// string, no model cache) but with no loadable package behind it (no dist, no
// entry point), the "npm install failed partway through" shape the spec
// names. The first warm-up attempt (npm skipped, since the probe said
// 'unusable') discovers the package cannot even require(), triggers the
// bounded one-time npm install, and the retried warm-up succeeds.
test('an unusable install whose package cannot load falls back to one npm install and repairs itself', { skip: !isWin }, () => {
    const root = makeRoot('embfallback-');
    try {
        const embedderRoot = path.join(root, 'embedder');
        const pkgDir = path.join(embedderRoot, 'node_modules', '@huggingface', 'transformers');
        write(path.join(pkgDir, 'package.json'), JSON.stringify({ name: '@huggingface/transformers', version: '0.0.0' }));
        const before = probeOf(embedderRoot);
        assert.strictEqual(before.status, 'unusable', 'the fixture must read as unusable, not absent, for this case to test the fallback path');

        const script = '. ' + q(INSTALLER) + '; '
            + '$r = Install-Embedder -PluginRoot ' + q(PLUGIN_ROOT) + ' -EmbedderRoot ' + q(embedderRoot) + ' -NodeExe "node"; '
            + '$r.Notes | Write-Output; if (-not $r.Ok) { exit 1 }';
        const res = pwsh(script);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        assert.match(res.stdout, /could not be loaded, not just a missing model/,
            'the fallback must name why it is running npm a second time');
        assert.match(res.stdout, /running npm install once to repair it/);
        // Exactly one npm install ran beyond the (skipped) first attempt: one
        // "Ran npm install" note, not two, which is what "bounded" means here.
        const ranCount = (res.stdout.match(/Ran npm install/g) || []).length;
        assert.strictEqual(ranCount, 1, 'the fallback must run npm exactly once, never loop:\n' + res.stdout);

        const after = probeOf(embedderRoot);
        assert.strictEqual(after.status, 'ready', 'the fallback must leave a genuinely working install');
    } finally {
        rmDir(root);
    }
});

test('the store is installed only behind a consent gate that declines on a redirected stdin', { skip: !isWin }, () => {
    // Mirrors memory-sync.test.js's equivalent case: doctor.ps1 -Fix is never
    // run for real here (its execution-policy and PATH repairs reach
    // user-scope state a USERPROFILE redirect does not cover), so the gate is
    // exercised by parsing Get-Consent out of doctor.ps1 and calling it, and
    // the wiring is proven by showing Install-Embedder has no other way in.
    const script = '$errs = $null; $tokens = $null; '
        + '$ast = [System.Management.Automation.Language.Parser]::ParseFile(' + q(DOCTOR)
        + ', [ref]$tokens, [ref]$errs); '
        + '$fn = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq "Get-Consent" }, $true); '
        + 'if ($null -eq $fn) { Write-Output "no Get-Consent in doctor.ps1"; exit 1 }; '
        + '$Fix = $true; $Yes = $false; '
        + 'Invoke-Expression $fn.Extent.Text; '
        + 'if (Get-Consent "Install the embedding stack?") { Write-Output "consented"; exit 1 }; '
        + 'Write-Output "declined"';
    const res = spawnSync('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', input: '', env: { ...process.env } });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /declined/);

    const doctorSrc = fs.readFileSync(DOCTOR, 'utf8').split(/\r?\n/);
    const callsAt = doctorSrc.map((l, i) => (/Install-Embedder\s+-PluginRoot/.test(l) ? i : -1)).filter((i) => i >= 0);
    assert.strictEqual(callsAt.length, 1, 'Install-Embedder has exactly one call site in the doctor');
    const gate = doctorSrc.slice(Math.max(0, callsAt[0] - 5), callsAt[0]).join('\n');
    assert.match(gate, /if \(Get-Consent /, 'the installer runs only inside a consent gate:\n' + gate);
});

// Lifts the doctor's whole "Embedder (semantic search)" section as source
// text and executes it (Invoke-Expression) inside a harness that stubs every
// function it calls: Report captures each call instead of printing, Get-Consent
// and Install-Embedder record whether and how they were invoked instead of
// prompting or spawning node/npm, Get-Command is shadowed to control whether
// npm resolves, and Get-EmbedderProbe answers the section's first call on the
// checkout's memory-index.js with beforeProbe, every later one (the re-probe
// after an install attempt) with afterProbe, and a call on the installed
// copy's memory-index.js with installedProbe. Get-InstalledKitRoot answers
// installedRoot on a clone and null otherwise, as the real one does without
// spawning its resolver, and Install-Embedder writes a marker file into the
// embedder root, so a case can read whether an install ran from that root
// rather than from the report. This is real doctor.ps1 code, run rather than
// re-implemented, so the wiring this test proves (whether Get-Consent and
// Install-Embedder are reached, in what order, and what the final Report
// calls say) tracks the actual section rather than a paraphrase of it: a
// restructure that reorders these calls fails this test, where a check
// reading only string positions would not. Mirrors the AST-lift technique
// memory-sync.test.js's doctorFixGate uses for the sync section's gate
// assignments.
function runEmbedderSection(opts) {
    const script = [
        '$opts = $env:TEST_OPTS | ConvertFrom-Json',
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$startMarker = "# --- Embedder (semantic memory search)."',
        '$endMarker = "`nif (`$isClone) {"',
        '$start = $src.IndexOf($startMarker)',
        'if ($start -lt 0) { throw "start marker not found in doctor.ps1" }',
        '$end = $src.IndexOf($endMarker, $start)',
        'if ($end -lt 0) { throw "end marker not found in doctor.ps1" }',
        '$section = $src.Substring($start, $end - $start)',
        '',
        '$script:ConsentCalls = @()',
        '$script:InstallCalls = 0',
        '$script:ProbeCallCount = 0',
        '$script:Reports = @()',
        '',
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        'function Get-Consent {',
        '    param([string]$Question)',
        '    $script:ConsentCalls += $Question',
        '    return [bool]$opts.ConsentAnswer',
        '}',
        '$script:ProbePaths = @()',
        'function Get-EmbedderProbe {',
        '    param($MemoryIndexPath, $EmbedderRoot, $NodeExe)',
        '    $script:ProbePaths += $MemoryIndexPath',
        '    if ($opts.InstalledRoot -and $MemoryIndexPath -eq (Join-Path $opts.InstalledRoot "scripts\\memory-index.js")) { return $opts.InstalledProbe }',
        '    $script:ProbeCallCount++',
        '    if ($script:ProbeCallCount -eq 1) { return $opts.BeforeProbe }',
        '    return $opts.AfterProbe',
        '}',
        '$script:InstalledKitResolverNotes = @()',
        'function Get-InstalledKitRoot {',
        '    if (-not $isClone -or -not $opts.InstalledRoot) { return $null }',
        '    $script:InstalledKitResolverNotes = @($opts.ResolverNotes | Where-Object { $_ })',
        '    return $opts.InstalledRoot',
        '}',
        'function Install-Embedder {',
        '    param($PluginRoot, $EmbedderRoot, $NodeExe)',
        '    $script:InstallCalls++',
        '    New-Item -ItemType Directory -Force -Path $EmbedderRoot | Out-Null',
        '    [System.IO.File]::WriteAllText((Join-Path $EmbedderRoot "installed-by-stub.txt"), "x")',
        '    return @{ Ok = [bool]$opts.InstallOk; Notes = @($opts.InstallNotes) }',
        '}',
        '$script:IndexHealthPaths = @()',
        'function Get-EmbedderIndexHealth {',
        '    param($MemoryIndexPath, $EmbedderRoot, $StoreRoot, $NodeExe)',
        '    $script:IndexHealthPaths += $MemoryIndexPath',
        '    if ($opts.IndexHealth) { return @{ status = $opts.IndexHealth.status; detail = $null; count = $opts.IndexHealth.count; models = @($opts.IndexHealth.models); mtimeIso = $null } }',
        '    return @{ status = "absent"; detail = $null; count = 0; models = @() }',
        '}',
        // RealIndexLines runs install-embedder.ps1's own line builder, lifted
        // alone so its sibling functions never replace this harness's stubs.
        'if ($opts.RealIndexLines) {',
        '    $__instAst = [System.Management.Automation.Language.Parser]::ParseInput([System.IO.File]::ReadAllText(' + q(INSTALLER) + '), [ref]$null, [ref]$null)',
        '    Invoke-Expression ($__instAst.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq "Get-EmbedderIndexHealthLines" }, $true)).Extent.Text',
        '}',
        'else { function Get-EmbedderIndexHealthLines { param($IndexHealth, $Probe) return @("STUB-INDEX-HEALTH-LINE") } }',
        '# Shadows the cmdlet itself, the exact predicate doctor.ps1 calls, rather',
        '# than an indirection layer the real code does not have.',
        'function Get-Command {',
        '    param($Name, $ErrorAction)',
        '    if ($Name -eq "npm") { if ($opts.NpmPresent) { return [pscustomobject]@{ Name = "npm" } } else { return $null } }',
        '    return $null',
        '}',
        '',
        '$Fix = $true',
        '$script:EmbedderConsentSizeMB = 398',
        '$claudeDir = if ($opts.ClaudeDir) { $opts.ClaudeDir } else { "C:\\fake-claude-dir-for-test" }',
        // Real, so $embedderScript = Join-Path $pluginRoot "scripts\memory-
        // index.js" resolves to an actual file: the section's own Test-Path
        // gate on that file runs for real here, unstubbed, and a fake path
        // would trip it before this harness's stubs are ever reached.
        '$pluginRoot = ' + q(PLUGIN_ROOT),
        '$nodeCmd = [pscustomobject]@{ Source = "node" }',
        // The copy-naming helpers the section's derived reports call, lifted
        // from doctor.ps1 itself and reading $isClone the way the banner does.
        '$isClone = [bool]$opts.IsClone',
        '$repoRoot = ' + q(REPO),
        '$installedRoot = $null',
        '$__ast = [System.Management.Automation.Language.Parser]::ParseInput($src, [ref]$null, [ref]$null)',
        'foreach ($__fn in $__ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and @("Get-PayloadCopyName", "Get-PayloadClause") -contains $n.Name }, $true)) { Invoke-Expression $__fn.Extent.Text }',
        '',
        'Invoke-Expression $section',
        '',
        '[pscustomobject]@{',
        '    ConsentCalls = @($script:ConsentCalls)',
        '    InstallCalls = $script:InstallCalls',
        '    ProbePaths = @($script:ProbePaths)',
        '    IndexHealthPaths = @($script:IndexHealthPaths)',
        '    Reports = @($script:Reports)',
        '} | ConvertTo-Json -Compress -Depth 6'
    ].join('\n');
    const res = pwsh(script, { TEST_OPTS: JSON.stringify(opts) });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    return JSON.parse(res.stdout);
}

// A minimal but faithful embedProbe shape: every field the section's switch
// and question text read, so a section rewrite that reads a new field fails
// loudly (a missing property) rather than silently reading $null.
function fakeProbe(status, extra) {
    return Object.assign({
        status, available: status === 'ready',
        packageName: '@huggingface/transformers', packageVersion: '9.9.9',
        model: 'Xenova/all-MiniLM-L6-v2', dtype: 'q8', packageDir: 'C:\\fake\\packageDir',
        identity: status === 'ready' ? 'fake-identity' : null,
        remedy: status === 'ready' ? null : "run the kit-doctor skill's -Fix (installs the local embedding stack)",
        detail: status === 'ready' ? null : 'fake detail for ' + status
    }, extra || {});
}

test('npm absent: no consent prompt is offered, and the ordinary absent report still carries index health', { skip: !isWin }, () => {
    const result = runEmbedderSection({ NpmPresent: false, BeforeProbe: fakeProbe('absent') });
    assert.deepStrictEqual(result.ConsentCalls, [], 'no prompt when npm cannot install anything');
    assert.strictEqual(result.InstallCalls, 0);
    assert.strictEqual(result.Reports.length, 1, JSON.stringify(result.Reports));
    assert.strictEqual(result.Reports[0].Status, 'WARN');
    assert.match(result.Reports[0].Detail, /npm is not on PATH/);
    assert.match(result.Reports[0].Detail, /Not installed/);
    assert.match(result.Reports[0].Detail, /STUB-INDEX-HEALTH-LINE/,
        'the npm-absent note must ride beside the ordinary report, not replace it: index health still prints');
});

test('probe-failed never reaches a consent prompt, and takes its own FAIL branch', { skip: !isWin }, () => {
    const result = runEmbedderSection({ NpmPresent: true, BeforeProbe: fakeProbe('probe-failed', { detail: 'boom' }) });
    assert.deepStrictEqual(result.ConsentCalls, [], 'probe-failed is a payload problem, never an install offer');
    assert.strictEqual(result.InstallCalls, 0);
    assert.strictEqual(result.Reports.length, 1);
    assert.strictEqual(result.Reports[0].Status, 'FAIL');
    assert.match(result.Reports[0].Detail, /Could not probe the embedder install: boom/);
});

test('consent declined: Install-Embedder is never called, and the ordinary absent report still prints', { skip: !isWin }, () => {
    const result = runEmbedderSection({ NpmPresent: true, ConsentAnswer: false, BeforeProbe: fakeProbe('absent') });
    assert.strictEqual(result.ConsentCalls.length, 1);
    assert.strictEqual(result.InstallCalls, 0);
    assert.strictEqual(result.Reports.length, 1);
    assert.strictEqual(result.Reports[0].Status, 'WARN');
    assert.match(result.Reports[0].Detail, /Not installed/);
});

test('consent accepted, install succeeds: Install-Embedder runs once and the re-probed ready state reports FIXED', { skip: !isWin }, () => {
    const result = runEmbedderSection({
        NpmPresent: true, ConsentAnswer: true, InstallOk: true, InstallNotes: ['fake install note'],
        BeforeProbe: fakeProbe('absent'), AfterProbe: fakeProbe('ready')
    });
    assert.strictEqual(result.ConsentCalls.length, 1);
    assert.match(result.ConsentCalls[0], /Install the local embedding stack/);
    assert.strictEqual(result.InstallCalls, 1);
    assert.strictEqual(result.Reports.length, 1);
    assert.strictEqual(result.Reports[0].Status, 'FIXED');
    assert.match(result.Reports[0].Detail, /fake install note/);
    assert.match(result.Reports[0].Detail, /Semantic channel active/);
});

test('consent accepted, install fails: the FAIL report carries the failure and never claims the channel active', { skip: !isWin }, () => {
    // Executes the section for real, rather than asserting on source shape:
    // Install-Embedder is proven called (its InstallCalls counter is the only
    // thing that could report a deletion here, and the stub performs none),
    // and every Report call this run produced is scanned for "Semantic
    // channel active" and "PASS"/"FIXED", which a claim of readiness would
    // have to use.
    const result = runEmbedderSection({
        NpmPresent: true, ConsentAnswer: true, InstallOk: false,
        InstallNotes: ['npm install failed (exit 1); the directory is left in place for diagnosis:', 'fake npm error tail'],
        BeforeProbe: fakeProbe('absent'), AfterProbe: fakeProbe('absent', { detail: 'still absent after the failed attempt' })
    });
    assert.strictEqual(result.InstallCalls, 1, 'the install was actually attempted');
    assert.strictEqual(result.Reports.length, 1);
    assert.strictEqual(result.Reports[0].Status, 'FAIL');
    assert.match(result.Reports[0].Detail, /npm install failed/);
    assert.match(result.Reports[0].Detail, /left in place for diagnosis/);
    assert.match(result.Reports[0].Detail, /Semantic channel inactive/);
    const wholeRun = JSON.stringify(result.Reports);
    assert.ok(!/Semantic channel active/.test(wholeRun), 'a failed install must never claim the channel is active:\n' + wholeRun);
    assert.ok(!/"Status":"(PASS|FIXED)"/.test(wholeRun), 'a failed install must report FAIL, never PASS or FIXED:\n' + wholeRun);
});

// Every file under a directory with its size, or null where it does not exist.
function treeOf(dir) {
    if (!fs.existsSync(dir)) return null;
    return fs.readdirSync(dir, { recursive: true }).map(String).sort()
        .map((rel) => rel + '=' + fs.statSync(path.join(dir, rel)).size).join(';');
}

// The trailing reading: on a clone whose checkout's memory-index.js reads the
// embedder absent or unusable, the installed copy's memory-index.js is probed
// against the same embedder root. Every case runs under -Fix with npm present
// and consent answered yes, so an install that the section reached would run
// and leave its marker in the embedder root. Whether it ran is read from that
// root before and after, not from the report.
test('embedder: a clone reading ready against the installed copy trails the checkout, and -Fix offers and installs nothing', { skip: !isWin }, () => {
    const root = makeRoot('embtrail-');
    try {
        const installedRoot = path.join(root, 'installed-copy');
        write(path.join(installedRoot, 'scripts', 'memory-index.js'), '// the installed copy\'s module\n');
        const bareInstalledRoot = path.join(root, 'installed-without-module');
        fs.mkdirSync(bareInstalledRoot, { recursive: true });
        const run = (name, extra) => {
            const claudeDir = path.join(root, name, '.claude');
            const embedderRoot = path.join(claudeDir, 'kit-embedder');
            write(path.join(embedderRoot, 'node_modules', '@huggingface', 'transformers', 'package.json'), '{"version":"9.9.9"}');
            const before = treeOf(embedderRoot);
            const result = runEmbedderSection(Object.assign({
                IsClone: true, ClaudeDir: claudeDir, NpmPresent: true, ConsentAnswer: true, InstallOk: true,
                InstallNotes: ['fake install note'], BeforeProbe: fakeProbe('absent'), AfterProbe: fakeProbe('ready'),
                InstalledRoot: installedRoot, InstalledProbe: fakeProbe('ready', { packageVersion: '8.8.8' })
            }, extra));
            return { result, before, after: treeOf(embedderRoot) };
        };

        // The index records one model identity: the installed copy's, never the
        // checkout's. The trailing legs run install-embedder.ps1's real line
        // builder, so a reading judged against the checkout's identity would
        // print its model-identity mismatch line.
        const identities = {
            BeforeProbe: null, RealIndexLines: true,
            IndexHealth: { status: 'ok', count: 3, models: ['installed-identity'] },
            InstalledProbe: fakeProbe('ready', { packageVersion: '8.8.8', identity: 'installed-identity' })
        };
        const installedIndexJs = path.join(installedRoot, 'scripts', 'memory-index.js');
        for (const [name, checkout, against] of [['absent', 'absent', /reads not installed/], ['unusable', 'unusable', /reads installed but not usable \(fake detail for unusable\)/]]) {
            const { result, before, after } = run('trailing-' + name, Object.assign({}, identities, {
                BeforeProbe: fakeProbe(checkout, { identity: 'checkout-identity' }), ResolverNotes: ['kit: 2 marketplaces offer a claude-kit payload; using fixture-mp']
            }));
            assert.strictEqual(result.Reports.length, 1, JSON.stringify(result.Reports));
            const r = result.Reports[0];
            assert.strictEqual(r.Status, 'INFO', name + ': ' + JSON.stringify(r));
            assert.ok(r.Detail.includes('trails the checkout in hand: ' + installedRoot), r.Detail);
            assert.match(r.Detail, against);
            assert.match(r.Detail, /Installed: @huggingface\/transformers@8\.8\.8/, 'the installed copy\'s reading is the one reported: ' + r.Detail);
            assert.match(r.Detail, /2 marketplaces offer a claude-kit payload/, 'the resolver notes ride the INFO: ' + r.Detail);
            assert.match(r.Detail, /Index: 3 record\(s\), model installed-identity/, 'the real index lines ran: ' + r.Detail);
            assert.doesNotMatch(r.Detail, /different model identity/, name + ': the index is judged against the installed copy\'s identity: ' + r.Detail);
            assert.deepStrictEqual(result.IndexHealthPaths, [installedIndexJs], name + ': the index is read through the installed copy\'s memory-index.js');
            assert.deepStrictEqual(result.ConsentCalls, [], name + ': a trailing machine never reaches the consent prompt');
            assert.strictEqual(result.InstallCalls, 0);
            assert.strictEqual(after, before, name + ': the embedder root must be left as found');
        }

        // Not trailing: the installed copy reads absent too, so the step WARNs
        // naming the checkout and -Fix offers its install. Declined, the root
        // is left as found; accepted, the install runs, which is the control
        // that the root comparison above can see an install.
        // Its index is read through the checkout's memory-index.js and judged
        // against the checkout's identity, which is also the control that the
        // real line builder prints the mismatch line the trailing legs lack.
        const declined = run('neither-declined', Object.assign({}, identities, {
            ConsentAnswer: false, BeforeProbe: fakeProbe('absent', { identity: 'checkout-identity' }), InstalledProbe: fakeProbe('absent')
        }));
        assert.strictEqual(declined.result.Reports[0].Status, 'WARN', JSON.stringify(declined.result.Reports));
        assert.match(declined.result.Reports[0].Detail, /Not installed/);
        assert.match(declined.result.Reports[0].Detail, /different model identity/, 'control: the real line builder speaks on a mismatch');
        assert.deepStrictEqual(declined.result.IndexHealthPaths, [MEMORY_INDEX_JS]);
        assertEndsNamingClone(declined.result.Reports[0].Detail);
        assert.strictEqual(declined.result.ConsentCalls.length, 1, 'the not-trailing machine is still offered -Fix');
        assert.strictEqual(declined.after, declined.before);
        // An installed copy reading unusable vouches for nothing either: the
        // step WARNs naming the checkout and -Fix offers its install. Accepted,
        // the install runs and changes the embedder root.
        const installedUnusable = run('installed-unusable', { InstalledProbe: fakeProbe('unusable') });
        assert.ok(installedUnusable.result.ProbePaths.includes(installedIndexJs), 'control: the installed copy was probed: ' + JSON.stringify(installedUnusable.result.ProbePaths));
        assert.strictEqual(installedUnusable.result.ConsentCalls.length, 1, 'the installed copy reading unusable is not trailing');
        assert.strictEqual(installedUnusable.result.InstallCalls, 1);
        assert.notStrictEqual(installedUnusable.after, installedUnusable.before);
        const installedUnusableDeclined = run('installed-unusable-declined', { ConsentAnswer: false, InstalledProbe: fakeProbe('unusable') });
        assert.strictEqual(installedUnusableDeclined.result.Reports[0].Status, 'WARN', JSON.stringify(installedUnusableDeclined.result.Reports));
        assert.match(installedUnusableDeclined.result.Reports[0].Detail, /Not installed/);
        assertEndsNamingClone(installedUnusableDeclined.result.Reports[0].Detail);
        assert.strictEqual(installedUnusableDeclined.result.ConsentCalls.length, 1);
        assert.strictEqual(installedUnusableDeclined.after, installedUnusableDeclined.before);
        const accepted = run('neither-accepted', { InstalledProbe: fakeProbe('absent') });
        assert.strictEqual(accepted.result.InstallCalls, 1);
        assert.strictEqual(accepted.result.Reports[0].Status, 'FIXED', JSON.stringify(accepted.result.Reports));
        assert.notStrictEqual(accepted.after, accepted.before, 'control: an install that ran changes the embedder root');

        // An installed copy with no memory-index.js cannot vouch for the
        // install, so the step reads as it does without one.
        const noModule = run('no-module', { ConsentAnswer: false, InstalledRoot: bareInstalledRoot });
        assert.strictEqual(noModule.result.Reports[0].Status, 'WARN', JSON.stringify(noModule.result.Reports));
        assert.strictEqual(noModule.result.ConsentCalls.length, 1);

        // probe-failed against the checkout never looks at the installed copy.
        const failed = run('probe-failed', { BeforeProbe: fakeProbe('probe-failed', { detail: 'boom' }) });
        assert.strictEqual(failed.result.Reports[0].Status, 'FAIL', JSON.stringify(failed.result.Reports));
        assert.strictEqual(failed.result.ProbePaths.length, 1, 'only the checkout was probed: ' + JSON.stringify(failed.result.ProbePaths));
        assert.deepStrictEqual(failed.result.ConsentCalls, []);
        assert.strictEqual(failed.after, failed.before);
    } finally {
        rmDir(root);
    }
});

test('a failed install never deletes the embedder directory it is diagnosing', { skip: !isWin }, () => {
    // install-embedder.ps1's own source, not the doctor's wiring: every
    // Remove-Item in the file is inspected, which the earlier, string-only
    // version of this test did not do (it matched only the literal
    // "Remove-Item.*EmbedderRoot" and would miss a delete reached through an
    // intermediate variable, a path built from EmbedderRoot and assigned
    // before the call). Every Remove-Item here targets the Env:\ provider (the
    // KIT_EMBEDDER_ROOT/KIT_MEMORY_ROOT save-and-restore in Invoke-EmbedderNode),
    // never the filesystem, so the real property this test checks is that no
    // Remove-Item call targets anything else.
    const src = fs.readFileSync(INSTALLER, 'utf8');
    const calls = src.split(/\r?\n/).filter((l) => /Remove-Item/.test(l));
    assert.ok(calls.length > 0, 'expected at least the env-variable cleanup calls; none found at all');
    for (const line of calls) {
        assert.match(line, /Remove-Item\s+["']?Env:/, 'a Remove-Item outside Env:\\ would delete something on disk:\n' + line);
    }
});

test('Invoke-EmbedderNode saves and restores every environment variable it touches', { skip: !isWin }, () => {
    // Get-EmbedderProbe passes no -StoreRoot, so Invoke-EmbedderNode's else
    // branch removes KIT_MEMORY_ROOT and its gate mid-call; this proves they
    // come back exactly as found, not merely absent, which a leaked removal
    // would also produce.
    const script = '. ' + q(INSTALLER) + '; '
        + '$env:KIT_EMBEDDER_ROOT = "sentinel-embedder-root"; '
        + '$env:KIT_EMBEDDER_ROOT_ALLOW_CODE = "sentinel-code-gate"; '
        + '$env:KIT_MEMORY_ROOT = "sentinel-memory-root"; '
        + '$env:KIT_MEMORY_ROOT_ALLOW_DATA = "sentinel-data-gate"; '
        + 'Get-EmbedderProbe -MemoryIndexPath ' + q(MEMORY_INDEX_JS) + ' -EmbedderRoot ' + q(path.join(os.tmpdir(), 'nonexistent-embedder-root')) + ' | Out-Null; '
        + '[pscustomobject]@{ '
        + 'EmbedderRoot = $env:KIT_EMBEDDER_ROOT; CodeGate = $env:KIT_EMBEDDER_ROOT_ALLOW_CODE; '
        + 'MemoryRoot = $env:KIT_MEMORY_ROOT; DataGate = $env:KIT_MEMORY_ROOT_ALLOW_DATA '
        + '} | ConvertTo-Json -Compress';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    const after = JSON.parse(res.stdout);
    assert.strictEqual(after.EmbedderRoot, 'sentinel-embedder-root');
    assert.strictEqual(after.CodeGate, 'sentinel-code-gate');
    assert.strictEqual(after.MemoryRoot, 'sentinel-memory-root');
    assert.strictEqual(after.DataGate, 'sentinel-data-gate');
});
