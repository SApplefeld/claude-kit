// Tests for doctor.ps1's "Kit state directory exposure" section: whether a
// project's .kit/ scratch folder can reach git.
//
// The section is lifted as source text and executed inside a harness that
// stubs Report, the technique doctor-goal-state.test.js uses for the section
// above it. Each case builds a real git repository under the temp directory,
// so nothing here reads or writes the real repo's .kit/. Skipped off Windows,
// where the doctor itself does not run.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DOCTOR = path.join(__dirname, '..', 'plugins', 'claude-kit', 'doctor', 'doctor.ps1');
const isWin = process.platform === 'win32';

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function makeRepo(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const init = spawnSync('git', ['init', '-q', dir], { encoding: 'utf8' });
    assert.strictEqual(init.status, 0, init.stderr);
    fs.mkdirSync(path.join(dir, '.kit'));
    fs.writeFileSync(path.join(dir, '.kit', 'goal-state.json'), '{}\n', 'utf8');
    return dir;
}

function runExposureSection(repo) {
    const outFile = path.join(os.tmpdir(), 'doctor-kit-exposure-' + process.pid + '-' + Date.now() + '.json');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$start = $src.IndexOf(' + q('$kitStateDir = (Get-Location).Path') + ')',
        'if ($start -lt 0) { throw "exposure section start not found" }',
        '$end = $src.IndexOf("# --- Memory database.", $start)',
        'if ($end -lt 0) { throw "exposure section end not found" }',
        '$section = $src.Substring($start, $end - $start)',
        '$script:Reports = @()',
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        'Set-Location -LiteralPath ' + q(repo),
        'Invoke-Expression $section',
        '$__json = @{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const reports = JSON.parse(fs.readFileSync(outFile, 'utf8')).Reports;
        assert.ok(Array.isArray(reports) && reports.length === 1, JSON.stringify(reports));
        return reports[0];
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

test('a .kit/ that carries its own ignore-everything marker reads as ignored', { skip: !isWin }, () => {
    const repo = makeRepo('doctor-kit-exposure-marked-');
    try {
        fs.writeFileSync(path.join(repo, '.kit', '.gitignore'), '*\n', 'utf8');
        const report = runExposureSection(repo);
        assert.strictEqual(report.Status, 'PASS', report.Detail);
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }
});

test('a .kit/ ignored by the root .gitignore reads as ignored', { skip: !isWin }, () => {
    const repo = makeRepo('doctor-kit-exposure-root-');
    try {
        fs.writeFileSync(path.join(repo, '.gitignore'), '.kit/\n', 'utf8');
        const report = runExposureSection(repo);
        assert.strictEqual(report.Status, 'PASS', report.Detail);
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }
});

test('a .kit/ nothing ignores still warns', { skip: !isWin }, () => {
    const repo = makeRepo('doctor-kit-exposure-open-');
    try {
        const report = runExposureSection(repo);
        assert.strictEqual(report.Status, 'WARN', report.Detail);
        assert.match(report.Detail, /neither tracked nor ignored/);
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }
});
