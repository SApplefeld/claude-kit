// Tests for plugins/claude-kit/scripts/stop-failure-watcher.ps1 (the
// stop-failure resume watcher) and plugins/claude-kit/doctor/
// install-stop-failure-watcher.ps1 (its scheduled-task registrar).
//
// Node's built-in test runner, no framework (Node v24). Every case builds its
// own sandbox project directory with its own .kit/ state and a fake `claude`
// shim on PATH (a claude.ps1 ahead of the real thing) that records the argv
// and environment it was invoked with, so nothing here resumes a real session
// or reads a real project. The cases spawn Windows PowerShell 5.1
// (powershell.exe), the interpreter the scheduled task actually launches, and
// are skipped off Windows, where neither the watcher nor Task Scheduler
// exists. Timing is driven through the watcher's -NowUtc test clock rather
// than real waiting, except where the behavior under test is itself a real
// wait (the child lifetime bound, the in-flight overlap).
//
// The registrar cases register a real scheduled task under a throwaway
// per-process task name and remove it again, with a belt-and-braces
// unregister in a finally so a failed assertion cannot orphan a task.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const WATCHER = path.join(REPO, 'plugins', 'claude-kit', 'scripts', 'stop-failure-watcher.ps1');
const INSTALLER = path.join(REPO, 'plugins', 'claude-kit', 'doctor', 'install-stop-failure-watcher.ps1');
const isWin = process.platform === 'win32';

const SESSION = 'ab12cd34-90ab-4cde-8f01-234567890abc';
const PLAN = 'docs/plans/probe_spec_v1.md';
// The instants the default cases run on: the marker is half an hour old, so
// the settle delay (120s) is met and, with no incident record, nothing else
// gates timing.
const REC = '2026-08-16T10:00:00.000Z';
const NOW = '2026-08-16T10:30:00.000Z';
// The exact prompt the watcher ships. Pinned in full because the leash claims
// on the opening /kit-goal invocation and the whole point of a fixed prompt
// is that nothing else ever rides in it.
const EXPECTED_PROMPT = '/kit-goal ' + PLAN + '\n\n'
    + 'This session was resumed by the stop-failure watcher after the previous turn '
    + 'died of a retryable API failure with the goal above still armed. Re-ground '
    + 'from the plan doc and continue executing it to completion.';

// The fake claude: records argv and the one environment variable under test,
// then follows the knobs the case set (append to a count file, rewrite the
// marker, sleep, exit nonzero). It sees exactly what a real claude would see,
// because the watcher's wrapper resolves `claude` on PATH and passes each
// value as its own argument.
const SHIM = [
    '$utf8 = New-Object System.Text.UTF8Encoding($false)',
    'if ($env:KIT_TEST_SHIM_OUT) {',
    '    $rec = @{ argv = @($args | ForEach-Object { "" + $_ }); watchdog = $env:CLAUDE_CODE_RETRY_WATCHDOG }',
    '    [System.IO.File]::WriteAllText($env:KIT_TEST_SHIM_OUT, (ConvertTo-Json -InputObject $rec -Depth 5), $utf8)',
    '}',
    'if ($env:KIT_TEST_SHIM_COUNT) { [System.IO.File]::AppendAllText($env:KIT_TEST_SHIM_COUNT, "x", $utf8) }',
    'if ($env:KIT_TEST_SHIM_MARKER_PATH -and $env:KIT_TEST_SHIM_MARKER_JSON) {',
    '    [System.IO.File]::WriteAllText($env:KIT_TEST_SHIM_MARKER_PATH, $env:KIT_TEST_SHIM_MARKER_JSON, $utf8)',
    '}',
    'if ($env:KIT_TEST_SHIM_SLEEP) { Start-Sleep -Seconds ([int]$env:KIT_TEST_SHIM_SLEEP) }',
    '$code = 0',
    'if ($env:KIT_TEST_SHIM_EXIT) { $code = [int]$env:KIT_TEST_SHIM_EXIT }',
    'exit $code'
].join('\r\n');

function makeSandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stop-failure-watcher-'));
    const kit = path.join(dir, '.kit');
    const shimDir = path.join(dir, 'shim');
    fs.mkdirSync(kit);
    fs.mkdirSync(shimDir);
    fs.writeFileSync(path.join(shimDir, 'claude.ps1'), SHIM, 'utf8');
    return {
        dir,
        kit,
        shimDir,
        shimOut: path.join(dir, 'shim-out.json'),
        marker: path.join(kit, 'stop-failure-latest.json'),
        goal: path.join(kit, 'goal-state.json'),
        attempts: path.join(kit, 'stop-failure-attempts.json'),
        sentinel: path.join(kit, 'stop-failure-resumed.json'),
        events: path.join(kit, 'stop-failure-events.jsonl')
    };
}

function rmSandbox(sb) {
    try { fs.rmSync(sb.dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeMarker(sb, overrides) {
    const rec = { hook_event_name: 'StopFailure', session_id: SESSION, error: 'rate_limit', cwd: sb.dir, recordedAt: REC, ...overrides };
    fs.writeFileSync(sb.marker, JSON.stringify(rec) + '\n', 'utf8');
}

function writeGoal(sb, overrides) {
    const rec = { plan: PLAN, condition: 'work the plan', armedAt: REC, boundSession: SESSION, ...overrides };
    fs.writeFileSync(sb.goal, JSON.stringify(rec, null, 2) + '\n', 'utf8');
}

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// The environment a watcher run gets: the shim directory first on PATH, the
// retry watchdog variable deliberately absent (proving the watcher sets it
// rather than inheriting it), and the shim knobs the case asked for.
function watcherEnv(sb, shimEnv) {
    const env = { ...process.env, KIT_TEST_SHIM_OUT: sb.shimOut, ...shimEnv };
    delete env.CLAUDE_CODE_RETRY_WATCHDOG;
    const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
    env[pathKey] = sb.shimDir + path.delimiter + (env[pathKey] || '');
    return env;
}

function watcherArgs(sb, now, extraArgs) {
    return ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', WATCHER,
        '-ProjectDir', sb.dir, '-NowUtc', now || NOW, ...(extraArgs || [])];
}

function runWatcher(sb, opts) {
    const o = opts || {};
    const res = spawnSync('powershell.exe', watcherArgs(sb, o.now, o.args),
        { encoding: 'utf8', env: watcherEnv(sb, o.shimEnv) });
    assert.strictEqual(res.status, 0, 'the watcher always exits 0: ' + res.stdout + res.stderr);
    return res;
}

function assertNoLaunch(sb, label) {
    assert.strictEqual(fs.existsSync(sb.shimOut), false, label + ': the shim must not have been invoked');
    assert.strictEqual(fs.existsSync(sb.marker), true, label + ': the marker is left in place');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- The resume itself, both exit directions.

test('all guards passing: resume fires with the validated id, the fixed prompt, and the watchdog set', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        runWatcher(sb);
        assert.strictEqual(fs.existsSync(sb.shimOut), true, 'the shim ran');
        const rec = readJson(sb.shimOut);
        assert.deepStrictEqual(rec.argv, ['-p', '--resume', SESSION, EXPECTED_PROMPT]);
        assert.strictEqual(rec.watchdog, '1', 'CLAUDE_CODE_RETRY_WATCHDOG=1 reaches the child even when the watcher itself started without it');
        assert.strictEqual(fs.existsSync(sb.marker), false, 'the marker clears on a zero exit');
        assert.strictEqual(fs.existsSync(sb.attempts), false, 'the incident record clears on a zero exit');
        const sentinel = readJson(sb.sentinel);
        assert.strictEqual(sentinel.state, 'exited');
        assert.strictEqual(sentinel.exitCode, 0);
        assert.strictEqual(sentinel.oldSessionId, SESSION);
        assert.ok(Number.isInteger(sentinel.pid) && sentinel.pid > 0, 'the sentinel carries the wrapper pid');
    } finally {
        rmSandbox(sb);
    }
});

test('a nonzero child exit leaves the marker and the incident record, and the sentinel carries the code', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        runWatcher(sb, { shimEnv: { KIT_TEST_SHIM_EXIT: '5' } });
        assert.strictEqual(fs.existsSync(sb.shimOut), true, 'the shim ran');
        assert.strictEqual(fs.existsSync(sb.marker), true, 'the marker stays so the next due pass retries');
        assert.strictEqual(readJson(sb.attempts).launches, 1, 'the launch is spent');
        const sentinel = readJson(sb.sentinel);
        assert.strictEqual(sentinel.state, 'exited');
        assert.strictEqual(sentinel.exitCode, 5);
    } finally {
        rmSandbox(sb);
    }
});

// --- Each guard blocks in isolation: everything else in the sandbox is
// --- valid, so the one flipped condition is what blocked the launch.

test('no marker: no launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeGoal(sb);
        runWatcher(sb);
        assert.strictEqual(fs.existsSync(sb.shimOut), false, 'the shim must not have been invoked');
    } finally {
        rmSandbox(sb);
    }
});

test('an unparseable marker: no launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        fs.writeFileSync(sb.marker, 'not json at all {', 'utf8');
        writeGoal(sb);
        runWatcher(sb);
        assertNoLaunch(sb, 'unparseable marker');
    } finally {
        rmSandbox(sb);
    }
});

test('no armed goal: no launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        runWatcher(sb);
        assertNoLaunch(sb, 'no goal state');
    } finally {
        rmSandbox(sb);
    }
});

test('an armed goal bound to no session: no launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb, { boundSession: null });
        runWatcher(sb);
        assertNoLaunch(sb, 'unbound goal');
    } finally {
        rmSandbox(sb);
    }
});

test('a session mismatch: no launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb, { boundSession: 'ffffffff-1111-2222-3333-444444444444' });
        runWatcher(sb);
        assertNoLaunch(sb, 'session mismatch');
    } finally {
        rmSandbox(sb);
    }
});

test('session ids differing only in case still match, and the resume fires', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb, { boundSession: SESSION.toUpperCase() });
        runWatcher(sb);
        assert.strictEqual(fs.existsSync(sb.shimOut), true, 'opaque case-insensitive compare, the sameSessionId convention');
    } finally {
        rmSandbox(sb);
    }
});

test('a non-retryable error: no launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb, { error: 'billing_error' });
        writeGoal(sb);
        runWatcher(sb);
        assertNoLaunch(sb, 'non-retryable');
    } finally {
        rmSandbox(sb);
    }
});

test('an unclassifiable failure (no error field): no launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb, { error: undefined });
        writeGoal(sb);
        runWatcher(sb);
        assertNoLaunch(sb, 'unclassifiable');
    } finally {
        rmSandbox(sb);
    }
});

test('overloaded is in the default retryable set, and the resume fires', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb, { error: 'overloaded' });
        writeGoal(sb);
        runWatcher(sb);
        assert.strictEqual(fs.existsSync(sb.shimOut), true, 'overloaded resumes');
    } finally {
        rmSandbox(sb);
    }
});

test('not yet due (inside the settle delay): no launch; at the delay: launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        runWatcher(sb, { now: '2026-08-16T10:01:00.000Z' });
        assertNoLaunch(sb, 'still settling (60s of 120)');
        runWatcher(sb, { now: '2026-08-16T10:02:00.000Z' });
        assert.strictEqual(fs.existsSync(sb.shimOut), true, 'due exactly at the settle delay');
    } finally {
        rmSandbox(sb);
    }
});

test('retry spacing blocks a pass inside the window and admits one outside it', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        fs.writeFileSync(sb.attempts, JSON.stringify({ sessionId: SESSION, firstSeen: REC, launches: 1, lastLaunch: '2026-08-16T10:20:00.000Z' }), 'utf8');
        runWatcher(sb); // NOW is 600s after lastLaunch, inside the 1200s spacing.
        assertNoLaunch(sb, 'spacing');
        runWatcher(sb, { now: '2026-08-16T10:41:00.000Z' }); // 1260s after lastLaunch.
        assert.strictEqual(fs.existsSync(sb.shimOut), true, 'spaced far enough');
        assert.strictEqual(fs.existsSync(sb.attempts), false, 'zero exit clears the incident');
    } finally {
        rmSandbox(sb);
    }
});

test('the launch backstop ends the incident: no launch, one exhausted note, marker left', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        fs.writeFileSync(sb.attempts, JSON.stringify({ sessionId: SESSION, firstSeen: REC, launches: 6, lastLaunch: REC }), 'utf8');
        runWatcher(sb);
        assertNoLaunch(sb, 'backstop');
        assert.strictEqual(readJson(sb.attempts).exhausted, true, 'the incident is marked exhausted');
        const notes = fs.readFileSync(sb.events, 'utf8').split('\n').filter((l) => l.includes('incident-exhausted'));
        assert.strictEqual(notes.length, 1, 'the exhausted note lands');
        runWatcher(sb, { now: '2026-08-16T11:30:00.000Z' });
        assertNoLaunch(sb, 'exhausted incident is left alone');
        const after = fs.readFileSync(sb.events, 'utf8').split('\n').filter((l) => l.includes('incident-exhausted'));
        assert.strictEqual(after.length, 1, 'the note lands once, not on every pass');
    } finally {
        rmSandbox(sb);
    }
});

test('the wall-clock budget ends the incident even under the launch backstop', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb, { recordedAt: '2026-08-16T09:50:00.000Z' });
        writeGoal(sb);
        fs.writeFileSync(sb.attempts, JSON.stringify({ sessionId: SESSION, firstSeen: '2026-08-16T01:00:00.000Z', launches: 2, lastLaunch: '2026-08-16T09:00:00.000Z' }), 'utf8');
        runWatcher(sb); // NOW is 9.5h after firstSeen, past the 8h budget.
        assertNoLaunch(sb, 'wall-clock budget');
        assert.strictEqual(readJson(sb.attempts).exhausted, true);
    } finally {
        rmSandbox(sb);
    }
});

test('a malformed session id is refused outright, even when the goal binds it', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        // Matches the bound session exactly, so only the grammar stands
        // between this value and a command line.
        const hostile = 'ab12cd34"; Start-Process calc.exe; "';
        writeMarker(sb, { session_id: hostile });
        writeGoal(sb, { boundSession: hostile });
        runWatcher(sb);
        assertNoLaunch(sb, 'hostile session id');
        const short = 'abcd';
        writeMarker(sb, { session_id: short });
        writeGoal(sb, { boundSession: short });
        runWatcher(sb);
        assertNoLaunch(sb, 'under-length session id');
    } finally {
        rmSandbox(sb);
    }
});

test('a plan path escaping the repo is refused by the goal-state rule', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb, { plan: '..\\other-repo\\plan.md' });
        runWatcher(sb);
        assertNoLaunch(sb, 'traversing plan path');
    } finally {
        rmSandbox(sb);
    }
});

test('an unparseable incident record: no launch (fail toward not acting)', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        fs.writeFileSync(sb.attempts, 'garbage{', 'utf8');
        runWatcher(sb);
        assertNoLaunch(sb, 'bad attempts file');
    } finally {
        rmSandbox(sb);
    }
});

test('an unparseable sentinel: no launch (fail toward not acting)', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        fs.writeFileSync(sb.sentinel, 'garbage{', 'utf8');
        runWatcher(sb);
        assertNoLaunch(sb, 'bad sentinel');
    } finally {
        rmSandbox(sb);
    }
});

test('an in-flight sentinel with a live wrapper pid blocks the pass', { skip: !isWin }, () => {
    const sb = makeSandbox();
    const sleeper = spawn('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 60'], { stdio: 'ignore' });
    try {
        writeMarker(sb);
        writeGoal(sb);
        fs.writeFileSync(sb.sentinel, JSON.stringify({ launchedAt: REC, pid: sleeper.pid, oldSessionId: SESSION, state: 'in-flight' }), 'utf8');
        runWatcher(sb);
        assertNoLaunch(sb, 'live in-flight sentinel');
    } finally {
        try { sleeper.kill(); } catch { /* already gone */ }
        rmSandbox(sb);
    }
});

test('an in-flight sentinel whose pid is dead does not block: the crashed pass self-heals', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        const dead = spawnSync('cmd.exe', ['/c', 'exit 0']);
        writeMarker(sb);
        writeGoal(sb);
        fs.writeFileSync(sb.sentinel, JSON.stringify({ launchedAt: REC, pid: dead.pid, oldSessionId: SESSION, state: 'in-flight' }), 'utf8');
        runWatcher(sb);
        assert.strictEqual(fs.existsSync(sb.shimOut), true, 'a dead pid reads as no child running');
    } finally {
        rmSandbox(sb);
    }
});

// --- The three regression pins: defects this design already made once.

test('a fast-failing child that writes a fresh marker does not reset the incident, and the budget binds', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeGoal(sb);
        writeMarker(sb);
        const countFile = path.join(sb.dir, 'launch-count.txt');
        const base = Date.parse(REC);
        // Eight due passes, each 30 minutes apart (past both settle and
        // spacing). The shim dies fast (exit 1) and rewrites a fresh marker
        // with that pass's own timestamp, which is exactly what a resumed run
        // re-dying of the same limit produces: a fresh but indistinguishable
        // marker for the same session id. A per-marker counter would restart
        // at every death; the session-keyed incident must stop at 6 launches.
        for (let i = 1; i <= 8; i++) {
            const passNow = new Date(base + i * 30 * 60 * 1000).toISOString();
            const freshMarker = JSON.stringify({
                hook_event_name: 'StopFailure', session_id: SESSION, error: 'rate_limit',
                cwd: sb.dir, recordedAt: new Date(base + (i - 1) * 30 * 60 * 1000).toISOString()
            });
            runWatcher(sb, {
                now: passNow,
                shimEnv: {
                    KIT_TEST_SHIM_EXIT: '1',
                    KIT_TEST_SHIM_COUNT: countFile,
                    KIT_TEST_SHIM_MARKER_PATH: sb.marker,
                    KIT_TEST_SHIM_MARKER_JSON: freshMarker
                }
            });
        }
        const launches = fs.existsSync(countFile) ? fs.readFileSync(countFile, 'utf8').length : 0;
        assert.strictEqual(launches, 6, 'the incident stops at the launch backstop');
        const attempts = readJson(sb.attempts);
        assert.strictEqual(attempts.launches, 6);
        assert.strictEqual(attempts.exhausted, true);
        assert.strictEqual(fs.existsSync(sb.marker), true, 'the last marker is left for the operator');
    } finally {
        rmSandbox(sb);
    }
});

test('while a resumed child runs, the sentinel is in-flight with a pid and a second pass launches nothing', { skip: !isWin }, async () => {
    const sb = makeSandbox();
    let first = null;
    try {
        writeMarker(sb);
        writeGoal(sb);
        const secondOut = path.join(sb.dir, 'shim-out-2.json');
        first = spawn('powershell.exe', watcherArgs(sb, NOW),
            { stdio: 'ignore', env: watcherEnv(sb, { KIT_TEST_SHIM_SLEEP: '10' }) });
        const firstDone = new Promise((resolve) => first.on('exit', resolve));
        // Wait for the launch to be under way: the sentinel gains its pid
        // right after the wrapper starts.
        let sentinel = null;
        for (let i = 0; i < 100; i++) {
            try {
                sentinel = readJson(sb.sentinel);
                if (sentinel.state === 'in-flight' && Number.isInteger(sentinel.pid) && sentinel.pid > 0) break;
            } catch { /* not written yet, or mid-swap */ }
            sentinel = null;
            await sleep(200);
        }
        assert.ok(sentinel, 'the sentinel exists while the child runs, in-flight with a pid');
        // The second pass is past the settle delay and the retry spacing, so
        // the in-flight sentinel is the one guard standing.
        const second = spawnSync('powershell.exe', watcherArgs(sb, '2026-08-16T11:30:00.000Z'),
            { encoding: 'utf8', env: watcherEnv(sb, { KIT_TEST_SHIM_OUT: secondOut }) });
        assert.strictEqual(second.status, 0);
        assert.strictEqual(fs.existsSync(secondOut), false, 'the overlapping pass launches nothing');
        await firstDone;
        assert.strictEqual(readJson(sb.sentinel).state, 'exited', 'the sentinel carries the outcome after the child ends');
    } finally {
        if (first) { try { first.kill(); } catch { /* already gone */ } }
        rmSandbox(sb);
    }
});

test('a child that outlives the lifetime bound is killed, recorded, and counted as a launch', { skip: !isWin }, () => {
    const sb = makeSandbox();
    try {
        writeMarker(sb);
        writeGoal(sb);
        runWatcher(sb, {
            args: ['-ChildLifetimeBoundSeconds', '2'],
            shimEnv: { KIT_TEST_SHIM_SLEEP: '120' }
        });
        const sentinel = readJson(sb.sentinel);
        assert.strictEqual(sentinel.state, 'killed-timeout', 'the kill is recorded');
        assert.ok(sentinel.runtimeSeconds >= 2, 'the child ran to the bound before the kill');
        assert.strictEqual(readJson(sb.attempts).launches, 1, 'the kill counts as a launch');
        assert.strictEqual(fs.existsSync(sb.marker), true, 'no successful resume, so the marker stays');
        const killedNote = fs.readFileSync(sb.events, 'utf8').split('\n').filter((l) => l.includes('killed-timeout'));
        assert.strictEqual(killedNote.length, 1, 'the kill lands in the events log');
    } finally {
        rmSandbox(sb);
    }
});

// --- The registrar: pinned settings, read-back verification, removal.

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function pwsh(script) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', env: { ...process.env } });
}

test('the registrar reads the task interval out of the watcher script', { skip: !isWin }, () => {
    const res = pwsh('. ' + q(INSTALLER) + '; Get-StopFailureWatcherInterval -WatcherPath ' + q(WATCHER));
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.strictEqual(res.stdout.trim(), '15', 'the interval has one home, in the watcher');
});

test('register pins the settings, the read-back verifies them, and unregister removes the task', { skip: !isWin }, () => {
    const taskName = 'claude-kit-stop-failure-watcher-test-' + process.pid;
    const sb = makeSandbox();
    try {
        const script = '. ' + q(INSTALLER) + '; '
            + '$i = Install-StopFailureWatcher -WatcherPath ' + q(WATCHER) + ' -ProjectDir ' + q(sb.dir) + ' -TaskName ' + q(taskName) + '; '
            + '$s = Get-StopFailureWatcherStatus -TaskName ' + q(taskName) + '; '
            + '$u = Uninstall-StopFailureWatcher -TaskName ' + q(taskName) + '; '
            + '$a = Get-StopFailureWatcherStatus -TaskName ' + q(taskName) + '; '
            + '@{ install = $i; status = $s; uninstall = $u; after = $a } | ConvertTo-Json -Depth 5 -Compress | Write-Output';
        const res = pwsh(script);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const r = JSON.parse(res.stdout);
        assert.strictEqual(r.install.ok, true, 'registration succeeds: ' + JSON.stringify(r.install));
        assert.strictEqual(r.status.present, true);
        assert.strictEqual(r.status.multipleInstances, 'IgnoreNew', 'the overlap pin holds');
        assert.strictEqual(r.status.executionTimeLimit, 'PT8H', 'the lifetime pin holds');
        assert.strictEqual(r.status.repetitionInterval, 'PT15M', 'the interval matches the watcher constant');
        assert.ok(r.status.arguments.includes(WATCHER), 'the action runs this payload\'s watcher');
        assert.ok(r.status.arguments.includes(sb.dir), 'the action carries the project directory');
        assert.strictEqual(r.uninstall.ok, true);
        assert.strictEqual(r.uninstall.removed, true);
        assert.strictEqual(r.after.present, false, 'the task is gone after unregister');
    } finally {
        // Belt and braces: a failed assertion above must never orphan a task.
        pwsh('Unregister-ScheduledTask -TaskName ' + q(taskName) + ' -Confirm:$false -ErrorAction SilentlyContinue');
        rmSandbox(sb);
    }
});

test('the registrar refuses a missing project directory and registers nothing', { skip: !isWin }, () => {
    const taskName = 'claude-kit-stop-failure-watcher-test-refuse-' + process.pid;
    try {
        const script = '. ' + q(INSTALLER) + '; '
            + '$i = Install-StopFailureWatcher -WatcherPath ' + q(WATCHER) + ' -ProjectDir ' + q('C:\\claude-kit-no-such-dir-' + process.pid) + ' -TaskName ' + q(taskName) + '; '
            + '$s = Get-StopFailureWatcherStatus -TaskName ' + q(taskName) + '; '
            + '@{ install = $i; status = $s } | ConvertTo-Json -Depth 5 -Compress | Write-Output';
        const res = pwsh(script);
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const r = JSON.parse(res.stdout);
        assert.strictEqual(r.install.ok, false);
        assert.ok(/project directory/.test(r.install.reason), r.install.reason);
        assert.strictEqual(r.status.present, false, 'nothing was registered');
    } finally {
        pwsh('Unregister-ScheduledTask -TaskName ' + q(taskName) + ' -Confirm:$false -ErrorAction SilentlyContinue');
    }
});

test('unregistering an absent task is ok with removed=false', { skip: !isWin }, () => {
    const res = pwsh('. ' + q(INSTALLER) + '; Uninstall-StopFailureWatcher -TaskName ' + q('claude-kit-no-such-task-' + process.pid) + ' | ConvertTo-Json -Compress | Write-Output');
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    const r = JSON.parse(res.stdout);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.removed, false);
});
