// Tests for where doctor.ps1 prints the line its consent helper, Get-Consent,
// writes when a -Fix prompt goes unanswered.
//
// Node's built-in test runner, no framework, no install (Node v24). The
// declined line is produced inside Get-Consent itself and placed by the order
// in which the whole script prints, so no stubbed-consent harness reaches it:
// this suite runs the whole doctor.ps1 -Fix with an empty standard input, the
// shape a tool shell gives it. The cases spawn Windows PowerShell and are
// skipped off Windows, where the doctor itself does not run.
//
// A real -Fix run reaches state outside the home directory, so the run is
// fenced three ways rather than trusted to the fixture:
//   - The doctor runs from a copy of the payload's doctor directory and
//     plugin.json under a temp directory whose layout is not a clone's, so
//     the clone-only repairs (the kaizen signpost and the repository's
//     core.hooksPath) are never reached.
//   - That copy carries no scripts\ directory, so the memq shim install
//     reports an incomplete payload and the user-PATH registry write that
//     follows a healthy install is never reached.
//   - Set-ExecutionPolicy is shadowed by a function in the calling scope, so
//     on a machine whose effective policy is Restricted or AllSigned the
//     CurrentUser-scope write -Fix would make throws instead.
// Two more prompts stay unreached, which is what keeps the Memory sync
// heading the only holder of a declined line: the embedder prompt needs a
// scripts\memory-index.js the copy lacks, and the auto-compaction prompt
// needs a settings.json the temp home lacks.
// USERPROFILE, HOME and XDG_CONFIG_HOME point at the temp home, so every
// ~\.claude path the doctor derives, and git's global config, resolve there.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const PLUGIN_ROOT = path.join(REPO, 'plugins', 'claude-kit');
const isWin = process.platform === 'win32';
// The drifted store is a git repository, and the doctor itself reports WARN
// and never prompts where git is absent, so this case skips there too.
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function write(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// The temp root holds a home and a payload copy. The payload's leaf is not
// "claude-kit" and its parent is not "plugins", which is what the doctor's
// clone test reads.
function makeSandbox() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-consent-'));
    const home = path.join(root, 'home');
    const payload = path.join(root, 'payload');
    fs.cpSync(path.join(PLUGIN_ROOT, 'doctor'), path.join(payload, 'doctor'), { recursive: true });
    fs.cpSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), path.join(payload, '.claude-plugin', 'plugin.json'));
    write(path.join(home, '.gitconfig'), '[user]\n\tname = doctor-consent-test\n\temail = doctor-consent@example.invalid\n');
    fs.mkdirSync(path.join(home, 'xdg'), { recursive: true });
    return {
        root, home, payload,
        store: path.join(home, '.claude'),
        env: { ...process.env, USERPROFILE: home, HOME: home, XDG_CONFIG_HOME: path.join(home, 'xdg') }
    };
}

function pwsh(script, env) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', input: '', env });
}

// A memory store whose sync allowlist the doctor wrote and that has since
// drifted: the root exclusion is gone from .gitignore. -Fix offers to restore
// it behind a consent prompt, and the check reports FAIL when that prompt is
// declined, which is the state the declined line was reported misplaced in.
function makeDriftedStore(sb) {
    write(path.join(sb.store, 'projects', 'D--fake-project', 'memory', 'MEMORY.md'), '# Memory Index\n');
    const installer = path.join(sb.payload, 'doctor', 'install-memory-sync.ps1');
    const res = pwsh('. ' + q(installer) + '; $r = Install-MemorySyncRepo -StoreRoot ' + q(sb.store)
        + '; $r.Notes | Write-Output; if (-not $r.Ok) { exit 1 }', sb.env);
    assert.strictEqual(res.status, 0, 'the fixture store must install cleanly:\n' + res.stdout + res.stderr);
    const ignorePath = path.join(sb.store, '.gitignore');
    const canonical = fs.readFileSync(ignorePath, 'utf8');
    const drifted = canonical.replace('\n/*\n', '\n');
    assert.notStrictEqual(drifted, canonical, 'the fixture must actually drift the allowlist');
    fs.writeFileSync(ignorePath, drifted, 'utf8');
}

// The whole doctor, -Fix, empty standard input. The output is split into
// sections at each report heading, so an assertion about one check's detail
// ranges over that check alone. The heading is matched anywhere on its line,
// since Read-Host leaves its prompt unterminated on a redirected stdin and
// the next heading can land on the same line.
function runDoctorFix(sb) {
    assert.ok(!fs.existsSync(path.join(sb.payload, 'scripts')),
        'the payload copy must carry no scripts directory, or the memq shim repair could reach the user PATH');
    const doctor = path.join(sb.payload, 'doctor', 'doctor.ps1');
    const script = 'function Set-ExecutionPolicy { throw "withheld by the test harness" }; '
        + '& ' + q(doctor) + ' -Fix; exit $LASTEXITCODE';
    const res = pwsh(script, sb.env);
    const heading = /\[(PASS|WARN|FAIL|INFO|FIXED)\s*\] (.+)$/;
    const sections = [];
    for (const line of res.stdout.split(/\r?\n/)) {
        const m = heading.exec(line);
        if (m) sections.push({ status: m[1], name: m[2].trim(), detail: [] });
        else if (sections.length > 0) sections[sections.length - 1].detail.push(line.trim());
    }
    return { res, sections };
}

test('a declined -Fix prompt is printed under the check that asked, and that check says a prompt was declined', { skip: !isWin || !hasGit }, () => {
    const sb = makeSandbox();
    try {
        makeDriftedStore(sb);
        const { res, sections } = runDoctorFix(sb);
        const all = res.stdout + res.stderr;
        assert.ok(res.status === 0 || res.status === 1, 'the doctor must finish with its own verdict, not a host error:\n' + all);

        const sync = sections.filter((s) => s.name === 'Memory sync');
        assert.strictEqual(sync.length, 1, 'exactly one Memory sync report:\n' + all);
        assert.strictEqual(sync[0].status, 'FAIL', all);

        // Placement, matched on the line's own opening, which every host's
        // wording of the cause shares and which names neither the check nor
        // the heading it lands under.
        const declined = /declined the -Fix prompt for this check/i;
        const holders = sections.filter((s) => s.detail.some((l) => declined.test(l))).map((s) => s.name);
        assert.deepStrictEqual(holders, ['Memory sync'],
            'the declined line must ride under the Memory sync heading and no other:\n' + all);

        // And the FAIL itself says a prompt was declined, rather than reading
        // as the check-mode FAIL with its "re-run with -Fix" remedy alone.
        assert.ok(sync[0].detail.some((l) => /declined the -Fix prompt/i.test(l)),
            'the Memory sync FAIL must say its -Fix prompt was declined:\n' + sync[0].detail.join('\n'));
    } finally {
        rmDir(sb.root);
    }
});
