// Tests for the pending-kaizen counter in plugins/claude-kit/hooks/session-start.js.
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout: a pending inbox emits the kaizen block inside
// {"hookSpecificOutput":{additionalContext}}; an empty inbox emits nothing.
// Each case builds a fresh temp dir carrying the kit-repo marker
// (plugins/claude-kit/.claude-plugin/plugin.json) plus a kaizen/ inbox.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');

function makeKitRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-count-test-'));
    fs.mkdirSync(path.join(dir, 'plugins', 'claude-kit', '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugins', 'claude-kit', '.claude-plugin', 'plugin.json'), '{}');
    fs.mkdirSync(path.join(dir, 'kaizen', 'briefs'), { recursive: true });
    return dir;
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// The hook runs against the fixture and nothing else on this machine. The kit's
// other session-start blocks read the operator's home directory, the plugin root
// this suite is itself running under, and the project's git repository, and a
// fixture carrying the kit-repo marker reaches all three, so each is pointed
// somewhere the case owns: the home pair (what os.homedir() reads) at a
// directory inside the fixture, the plugin root and the external-engine marker
// dropped in every casing Windows carries them in, and every GIT_* variable
// dropped so no repository this suite was started from can answer for the
// fixture. process.env is spread rather than rebuilt so the child keeps its real
// PATH, which a rebuilt object loses on Windows.
function runHook(cwd) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^(USERPROFILE|HOME|KIT_EXTERNAL_ENGINE|CLAUDE_PLUGIN_ROOT)$/i.test(k)) delete env[k];
        if (/^GIT_/i.test(k)) delete env[k];
    }
    const home = path.join(cwd, 'fixture-home');
    fs.mkdirSync(home, { recursive: true });
    env.USERPROFILE = home;
    env.HOME = home;
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd }),
        encoding: 'utf8',
        env
    });
}

test('a header-only notes file and a briefs .gitkeep count as an empty inbox', () => {
    const dir = makeKitRepo();
    try {
        fs.writeFileSync(path.join(dir, 'kaizen', 'notes-MACHINE.md'), '# Kaizen inbox: MACHINE\n');
        fs.writeFileSync(path.join(dir, 'kaizen', 'briefs', '.gitkeep'), '');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});

test('a real note line under the header is counted', () => {
    const dir = makeKitRepo();
    try {
        fs.writeFileSync(
            path.join(dir, 'kaizen', 'notes-MACHINE.md'),
            '# Kaizen inbox: MACHINE\n- 2026-07-27 MACHINE some-repo: a rule was ambiguous\n'
        );
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 1 pending item/);
    } finally { rmDir(dir); }
});

test('a note file opening with a byte order mark counts its header as structure', () => {
    const dir = makeKitRepo();
    try {
        // PowerShell's Set-Content writes a BOM, so a note file in this
        // repository can carry one, and it sits ahead of the '#' that marks the
        // header as structure rather than a pending item. The pin is the count:
        // one note line, with the header excluded as it is in every other file.
        fs.writeFileSync(
            path.join(dir, 'kaizen', 'notes-MACHINE.md'),
            '﻿# Kaizen inbox: MACHINE\n- 2026-07-27 MACHINE some-repo: a rule was ambiguous\n'
        );
        assert.strictEqual(fs.readFileSync(path.join(dir, 'kaizen', 'notes-MACHINE.md'))[0], 0xEF,
            'the fixture must carry a real BOM');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 1 pending item\(s\)/);
    } finally { rmDir(dir); }
});

test('a note file resolving out of the checkout leaves the count bounded rather than short', (t) => {
    const dir = makeKitRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-outside-test-'));
    try {
        // The inbox is repository data, and the reader follows a link by
        // design, so containment is this caller's judgment: a note file reached
        // through a link out of the checkout is not counted, and the notice says
        // its count is of less than the whole inbox rather than reporting a
        // silent zero. A directory junction is the link kind this box creates
        // without privilege.
        fs.writeFileSync(path.join(outside, 'notes-FOREIGN.md'),
            '# Kaizen inbox: FOREIGN\n- 2026-07-27 FOREIGN repo: friction\n');
        fs.rmSync(path.join(dir, 'kaizen'), { recursive: true, force: true });
        try {
            fs.symlinkSync(outside, path.join(dir, 'kaizen'), 'junction');
        } catch (err) {
            return t.skip('this box refuses a junction: ' + err.code);
        }
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 0 pending item\(s\) \(a bounded count/);
    } finally { rmDir(dir); rmDir(outside); }
});

test('note lines across machines and a brief file are summed', () => {
    const dir = makeKitRepo();
    try {
        fs.writeFileSync(
            path.join(dir, 'kaizen', 'notes-A.md'),
            '# Kaizen inbox: A\n- 2026-07-26 A repo-x: friction one\n- 2026-07-27 A repo-y: friction two\n'
        );
        fs.writeFileSync(path.join(dir, 'kaizen', 'notes-B.md'), '# Kaizen inbox: B\n');
        fs.writeFileSync(path.join(dir, 'kaizen', 'briefs', 'some-brief.md'), '# Kaizen brief: t\n');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 3 pending item\(s\)/);
    } finally { rmDir(dir); }
});

// The reader's per-file ceiling and the walk's aggregate budget, which the
// cases below build fixtures around. Stated here rather than imported because
// the assertions are about what a session is told, and a constant read out of
// the hook would move with it.
const CEILING = 1024 * 1024;
const BUDGET = 4 * 1024 * 1024;

// A note file of exactly `bytes` bytes, returning how many countable note lines
// it holds. The remainder that no whole note line covers rides on a comment
// line, which the counter excludes, so the byte size and the line count are
// both exact.
function writeSizedNote(dir, name, bytes) {
    const header = '# Kaizen inbox: PAD\n';
    const line = '- 2026-07-27 PAD repo: filler\n';
    const lines = Math.floor((bytes - header.length) / line.length);
    let text = header + line.repeat(lines);
    const short = bytes - text.length;
    if (short === 1) text += '\n';
    else if (short > 1) text += '#' + 'x'.repeat(short - 2) + '\n';
    fs.writeFileSync(path.join(dir, 'kaizen', name), text);
    assert.strictEqual(fs.statSync(path.join(dir, 'kaizen', name)).size, bytes);
    return lines;
}

test('a note file of any size inside the read ceiling has every real line counted', () => {
    const dir = makeKitRepo();
    try {
        // The real note lines sit about 90 KB into the file and well inside the
        // read ceiling, so the count is right only where the reader takes the
        // file up to that ceiling rather than a head of it.
        const padding = '# padding line\n'.repeat(6000); // ~90 KB, all excluded
        fs.writeFileSync(
            path.join(dir, 'kaizen', 'notes-MACHINE.md'),
            `# Kaizen inbox: MACHINE\n${padding}`
            + '- 2026-07-25 MACHINE repo-a: friction one\n'
            + '- 2026-07-26 MACHINE repo-b: friction two\n'
            + '- 2026-07-27 MACHINE repo-c: friction three\n'
        );
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 3 pending item\(s\)/);
        // Inside every bound the walk carries, the count is a total and the
        // notice says nothing about being bounded.
        assert.doesNotMatch(r.stdout, /a bounded count/);
    } finally { rmDir(dir); }
});

test('a note file past the read ceiling reports a bounded count and counts no severed line', () => {
    const dir = makeKitRepo();
    try {
        // One whole note line ahead of the ceiling, padding, then a note line
        // the ceiling cuts through. The severed head is still a non-empty line
        // that does not open with '#', so a reader that kept the fragment would
        // count it as a second pending item.
        const header = '# Kaizen inbox: MACHINE\n';
        const first = '- 2026-07-27 MACHINE repo-a: ahead of the ceiling\n';
        const second = '- 2026-07-27 MACHINE repo-b: past the ceiling\n';
        const severed = 20;
        const pad = '# padding line\n';
        // One pad line short of the boundary, so the remainder below is always
        // long enough to spell as a comment line.
        const whole = pad.repeat(Math.floor((CEILING - severed - header.length - first.length) / pad.length) - 1);
        const short = CEILING - severed - header.length - first.length - whole.length;
        const filler = '#' + 'x'.repeat(short - 2) + '\n';
        fs.writeFileSync(path.join(dir, 'kaizen', 'notes-MACHINE.md'),
            header + first + whole + filler + second);
        assert.strictEqual(
            fs.statSync(path.join(dir, 'kaizen', 'notes-MACHINE.md')).size,
            CEILING - severed + second.length,
            'the fixture must place the ceiling inside the second note line'
        );
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 1 pending item\(s\) \(a bounded count: part of the inbox went unread\)/);
    } finally { rmDir(dir); }
});

test('a note walk that spends its byte budget reports a bounded count', () => {
    const dir = makeKitRepo();
    try {
        // Five note files at the per-file ceiling: the budget covers four of
        // them exactly, so whichever four the directory hands over first, the
        // fifth is never opened and the count is of four files. Without a
        // budget spanning the walk, the same inbox is 5 MB of synchronous
        // reading at every session start and the count reads as a total.
        let lines = 0;
        for (let i = 0; i < 5; i++) {
            lines = writeSizedNote(dir, `notes-M${i}.md`, CEILING);
        }
        assert.strictEqual(BUDGET / CEILING, 4, 'the budget must cover four files exactly');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, new RegExp(
            `kaizen inbox has ${lines * 4} pending item\\(s\\) \\(a bounded count: part of the inbox went unread\\)`
        ));
    } finally { rmDir(dir); }
});

test('a note file that cannot be read leaves the count bounded rather than short', () => {
    const dir = makeKitRepo();
    try {
        // A directory standing where a note file's name says a file is: it
        // contributes no lines, and a count that swallowed it would report the
        // one line it did read as the whole inbox.
        fs.writeFileSync(
            path.join(dir, 'kaizen', 'notes-REAL.md'),
            '# Kaizen inbox: REAL\n- 2026-07-27 REAL repo: friction\n'
        );
        fs.mkdirSync(path.join(dir, 'kaizen', 'notes-BROKEN.md'));
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 1 pending item\(s\) \(a bounded count: part of the inbox went unread\)/);
    } finally { rmDir(dir); }
});

test('an inbox listing that fails is reported as bounded even at a count of zero', () => {
    const dir = makeKitRepo();
    try {
        // A file standing where the briefs directory belongs: the listing fails
        // for a reason that is not absence, so nothing is known about what the
        // directory holds. Silence here would tell the session the inbox is
        // empty, which is the one reading the filesystem does not support.
        fs.rmSync(path.join(dir, 'kaizen', 'briefs'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'kaizen', 'briefs'), 'not a directory\n');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 0 pending item\(s\) \(a bounded count: part of the inbox went unread\)/);
    } finally { rmDir(dir); }
});

test('a kit repo with no inbox at all stays silent', () => {
    const dir = makeKitRepo();
    try {
        // An absent directory is an empty inbox and not an unknown one: nothing
        // there is nothing to miss, so the walk reports neither a count nor a
        // bound.
        fs.rmSync(path.join(dir, 'kaizen'), { recursive: true });
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});

test('a note-file count past the walk file cap states that it is bounded', () => {
    const dir = makeKitRepo();
    try {
        // One real line per file, one file past the cap. The count is the cap
        // rather than the file total, so the notice says the count is bounded.
        for (let i = 0; i < 51; i++) {
            fs.writeFileSync(
                path.join(dir, 'kaizen', `notes-M${String(i).padStart(3, '0')}.md`),
                `# Kaizen inbox: M${i}\n- 2026-07-27 M${i} repo: friction\n`
            );
        }
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 50 pending item\(s\) \(a bounded count: part of the inbox went unread\)/);
    } finally { rmDir(dir); }
});

test('a brief count past the walk brief cap states that it is bounded', () => {
    const dir = makeKitRepo();
    try {
        // One brief past the cap. The count is the cap rather than the
        // directory total, so the notice says the count is bounded.
        for (let i = 0; i < 501; i++) {
            fs.writeFileSync(path.join(dir, 'kaizen', 'briefs', `b${String(i).padStart(4, '0')}.md`), '');
        }
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.match(r.stdout, /kaizen inbox has 500 pending item\(s\) \(a bounded count: part of the inbox went unread\)/);
    } finally { rmDir(dir); }
});

test('outside the kit repo the inbox never nudges', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-count-test-'));
    try {
        fs.mkdirSync(path.join(dir, 'kaizen'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'kaizen', 'notes-MACHINE.md'), '- a note line\n');
        const r = runHook(dir);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { rmDir(dir); }
});
