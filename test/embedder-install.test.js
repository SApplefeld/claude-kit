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
// (no -Fix; see this file's header for why). Asserted on the section's own
// line rather than the exit code, because the memory-sync section legitimately
// FAILs against a fresh fake home with no bearing on this section.
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

test('the probe reports absent, unusable, and ready as three distinct states', { skip: !isWin }, () => {
    const root = makeRoot('embins-');
    try {
        const absentRoot = path.join(root, 'absent');
        plantEmbedder(absentRoot, 'absent');
        const absent = probeOf(absentRoot);
        assert.strictEqual(absent.status, 'absent');
        assert.strictEqual(absent.available, false);
        assert.match(absent.remedy, /kit doctor -Fix/);

        const unusableRoot = path.join(root, 'unusable');
        plantEmbedder(unusableRoot, 'unusable');
        const unusable = probeOf(unusableRoot);
        assert.strictEqual(unusable.status, 'unusable');
        assert.strictEqual(unusable.available, false);
        assert.match(unusable.detail, /model files are missing/);
        assert.match(unusable.remedy, /kit doctor -Fix/);

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
        assert.match(absentLine.detail, /kit doctor -Fix \(installs the local embedding stack\)/);
        assert.ok(!fs.existsSync(path.join(home, '.claude', 'kit-embedder')),
            'check mode must never create the embedder directory');

        const unusableHome = path.join(root, 'unusable-home');
        plantEmbedder(path.join(unusableHome, '.claude', 'kit-embedder'), 'unusable');
        const unusableLine = doctorEmbedderLine(unusableHome);
        assert.strictEqual(unusableLine.status, 'WARN', unusableLine.detail);
        assert.match(unusableLine.detail, /Installed but not usable/);
        assert.match(unusableLine.detail, /repair, not a fresh install/);
        assert.match(unusableLine.detail, /kit doctor -Fix/);

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
// npm resolves, and Get-EmbedderProbe answers the section's first call with
// beforeProbe and every later call (the re-probe after an install attempt)
// with afterProbe. This is real doctor.ps1 code, run rather than
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
        'function Get-EmbedderProbe {',
        '    param($MemoryIndexPath, $EmbedderRoot, $NodeExe)',
        '    $script:ProbeCallCount++',
        '    if ($script:ProbeCallCount -eq 1) { return $opts.BeforeProbe }',
        '    return $opts.AfterProbe',
        '}',
        'function Install-Embedder {',
        '    param($PluginRoot, $EmbedderRoot, $NodeExe)',
        '    $script:InstallCalls++',
        '    return @{ Ok = [bool]$opts.InstallOk; Notes = @($opts.InstallNotes) }',
        '}',
        'function Get-EmbedderIndexHealth { param($MemoryIndexPath, $EmbedderRoot, $StoreRoot, $NodeExe) return @{ status = "absent"; detail = $null; count = 0; models = @() } }',
        'function Get-EmbedderIndexHealthLines { param($IndexHealth, $Probe) return @("STUB-INDEX-HEALTH-LINE") }',
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
        '$claudeDir = "C:\\fake-claude-dir-for-test"',
        // Real, so $embedderScript = Join-Path $pluginRoot "scripts\memory-
        // index.js" resolves to an actual file: the section's own Test-Path
        // gate on that file runs for real here, unstubbed, and a fake path
        // would trip it before this harness's stubs are ever reached.
        '$pluginRoot = ' + q(PLUGIN_ROOT),
        '$nodeCmd = [pscustomobject]@{ Source = "node" }',
        '',
        'Invoke-Expression $section',
        '',
        '[pscustomobject]@{',
        '    ConsentCalls = @($script:ConsentCalls)',
        '    InstallCalls = $script:InstallCalls',
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
        remedy: status === 'ready' ? null : 'kit doctor -Fix (installs the local embedding stack)',
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

test('install-embedder.ps1 parses cleanly', { skip: !isWin }, () => {
    const script = '$errs = $null; $tokens = $null; '
        + '[System.Management.Automation.Language.Parser]::ParseFile(' + q(INSTALLER)
        + ', [ref]$tokens, [ref]$errs) | Out-Null; '
        + 'if ($errs.Count -gt 0) { $errs | Write-Output; exit 1 }';
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
});
