// Tests for plugins/grimoire/hooks/doctrine-refresh.js, the SessionStart
// hook that writes the operating-instructions skill body to
// ~/.claude/grimoire-doctrine.md, and for the doctor's comparison of that
// written file against the skill body.
//
// Node's built-in test runner, no framework, no install (Node v24). Every
// case builds a fixture plugin root (the skill file and its
// .claude-plugin/build-info.json) and a fixture home under a fresh temp
// directory, and runs the real hook as a child process with HOME and
// USERPROFILE pointed at that home, so nothing here reads or writes the real
// ~/.claude. A payload's write time is the skill file's mtime, set with
// fs.utimesSync, so no case sleeps.
//
// The doctor cases lift the "Doctrine import" section of doctor.ps1 as source
// text and run it inside a harness that stubs Report, the technique
// test/doctor-goal-state.test.js uses for its own section. They spawn Windows
// PowerShell and are skipped off Windows, where the doctor does not run. The
// failed-swap case skips off Windows too, since it drives the failure with a
// read-only CLAUDE.md, which only Windows refuses to rename over.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const HOOK = path.join(REPO, 'plugins', 'grimoire', 'hooks', 'doctrine-refresh.js');
const DOCTOR = path.join(REPO, 'plugins', 'grimoire', 'doctor', 'doctor.ps1');
const isWin = process.platform === 'win32';

const HEADER_OPEN = '<!-- Written by the grimoire doctrine-refresh hook';
const T1 = new Date('2026-09-01T10:00:00Z');
const T2 = new Date('2026-09-01T10:02:00Z');

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// A fixture home whose CLAUDE.md already imports the doctrine, so the hook's
// wiring offer stays silent and stdout carries only what a case is about.
function makeHome(root) {
    const home = path.join(root, 'home');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '@grimoire-doctrine.md\n', 'utf8');
    return home;
}

// A fixture plugin root carrying the skill with the given body, its mtime set
// to when, and a build-info.json with the given hash (none where hash is null).
function makePlugin(root, name, body, when, hash) {
    const plugin = path.join(root, name);
    const skill = path.join(plugin, 'skills', 'operating-instructions', 'SKILL.md');
    fs.mkdirSync(path.dirname(skill), { recursive: true });
    fs.writeFileSync(skill, '---\nname: operating-instructions\n---\n\n' + body, 'utf8');
    fs.utimesSync(skill, when, when);
    if (hash !== null) {
        fs.mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true });
        fs.writeFileSync(path.join(plugin, '.claude-plugin', 'build-info.json'),
            JSON.stringify({ hash, dirty: false }), 'utf8');
    }
    return plugin;
}

function runHook(home, plugin, source) {
    const res = spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ hook_event_name: 'SessionStart', source }),
        encoding: 'utf8',
        env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PLUGIN_ROOT: plugin }
    });
    assert.strictEqual(res.status, 0, res.stderr);
    return res.stdout;
}

const doctrinePath = (home) => path.join(home, '.claude', 'grimoire-doctrine.md');
const stampPath = (home) => path.join(home, '.claude', 'grimoire-doctrine.stamp.json');
const readDoctrine = (home) => fs.readFileSync(doctrinePath(home), 'utf8');
const readStamp = (home) => JSON.parse(fs.readFileSync(stampPath(home), 'utf8'));

// The written file with its header line removed, which is what the doctor
// compares against the skill body.
function bodyOf(written) {
    const nl = written.indexOf('\n');
    assert.ok(written.startsWith(HEADER_OPEN) && nl >= 0, 'no header line: ' + written.slice(0, 120));
    return written.slice(nl + 1);
}

test('a newer writer overwrites the file and restamps it with its own time and hash', () => {
    const root = makeDir('doctrine-refresh-newer-');
    try {
        const home = makeHome(root);
        const older = makePlugin(root, 'older', 'Old doctrine.\n', T1, 'aaa1111');
        const newer = makePlugin(root, 'newer', 'New doctrine.\n', T2, 'bbb2222');
        runHook(home, older, 'startup');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'Old doctrine.\n');
        assert.strictEqual(runHook(home, newer, 'startup'), '');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'New doctrine.\n');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'bbb2222');
        assert.strictEqual(stamp.payloadMtimeMs, T2.getTime());
    } finally {
        rmDir(root);
    }
});

for (const source of ['startup', 'resume']) test(`an older writer declines at ${source} and names both hashes in additionalContext`, () => {
    const root = makeDir('doctrine-refresh-older-');
    try {
        const home = makeHome(root);
        const newer = makePlugin(root, 'cache-v2', 'New doctrine.\n', T2, 'bbb2222');
        const older = makePlugin(root, 'cache-v1', 'Old doctrine.\n', T1, 'aaa1111');
        runHook(home, newer, 'startup');
        const before = readDoctrine(home);

        const out = runHook(home, older, source);
        assert.strictEqual(readDoctrine(home), before, 'the older writer must not overwrite the newer text');
        assert.strictEqual(readStamp(home).hash, 'bbb2222', 'the stamp keeps the newer writer');
        const parsed = JSON.parse(out);
        assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
        const ctx = parsed.hookSpecificOutput.additionalContext;
        assert.match(ctx, /aaa1111/);
        assert.match(ctx, /bbb2222/);
        assert.match(ctx, /grimoire-doctrine\.md/);
        // The line names this session's plugin root by its directory name and
        // gives the recovery that works: a restart reaches the same older root.
        assert.match(ctx, /cache-v1/);
        assert.match(ctx, /grimoire-doctrine\.stamp\.json/);
        assert.doesNotMatch(ctx, /restart/i);
        assert.ok(!ctx.includes('\n'), 'the decline is one line: ' + ctx);
    } finally {
        rmDir(root);
    }
});

// A marketplace install carries no build-info.json, since the file is gitignored
// and the install copies from the git clone, so the decline line names both
// writers by their root directory, which there is the commit's short hash.
test('without build-info on either side, the decline names both writers by their root directory', () => {
    const root = makeDir('doctrine-refresh-nohash-');
    try {
        const home = makeHome(root);
        const newer = makePlugin(root, '4bc56a79ba09', 'New doctrine.\n', T2, null);
        const older = makePlugin(root, '045f67b6cb9e', 'Old doctrine.\n', T1, null);
        runHook(home, newer, 'startup');
        assert.strictEqual(readStamp(home).root, '4bc56a79ba09');

        const ctx = JSON.parse(runHook(home, older, 'startup')).hookSpecificOutput.additionalContext;
        assert.match(ctx, /045f67b6cb9e/);
        assert.match(ctx, /4bc56a79ba09/);
    } finally {
        rmDir(root);
    }
});

test('an older writer writes and restamps where the doctrine file is absent', () => {
    const root = makeDir('doctrine-refresh-older-absent-');
    try {
        const home = makeHome(root);
        const newer = makePlugin(root, 'newer', 'New doctrine.\n', T2, 'bbb2222');
        const older = makePlugin(root, 'older', 'Old doctrine.\n', T1, 'aaa1111');
        runHook(home, newer, 'startup');
        fs.unlinkSync(doctrinePath(home));

        assert.strictEqual(runHook(home, older, 'startup'), '', 'nothing to protect, so nothing to decline');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'Old doctrine.\n');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'aaa1111');
        assert.strictEqual(stamp.payloadMtimeMs, T1.getTime());
    } finally {
        rmDir(root);
    }
});

test('the writer that stamped the file restores it after a hand edit (equal times overwrite)', () => {
    const root = makeDir('doctrine-refresh-equal-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        const written = readDoctrine(home);
        fs.writeFileSync(doctrinePath(home), written.split('\n')[0] + '\nA hand edit.\n', 'utf8');

        assert.strictEqual(runHook(home, plugin, 'startup'), '', 'an equal-time writer must not decline');
        assert.strictEqual(readDoctrine(home), written);
        assert.strictEqual(bodyOf(readDoctrine(home)), 'The doctrine.\n');
    } finally {
        rmDir(root);
    }
});

test('an older writer declines silently at compact and clear', () => {
    const root = makeDir('doctrine-refresh-older-quiet-');
    try {
        const home = makeHome(root);
        const newer = makePlugin(root, 'newer', 'New doctrine.\n', T2, 'bbb2222');
        const older = makePlugin(root, 'older', 'Old doctrine.\n', T1, 'aaa1111');
        runHook(home, newer, 'startup');
        const before = readDoctrine(home);
        for (const source of ['compact', 'clear']) {
            assert.strictEqual(runHook(home, older, source), '', source + ' must print nothing');
            assert.strictEqual(readDoctrine(home), before, source + ' must not overwrite');
        }
    } finally {
        rmDir(root);
    }
});

test('the header line opens the written file, names the skill as the source, and survives a refresh', () => {
    const root = makeDir('doctrine-refresh-header-');
    try {
        const home = makeHome(root);
        const first = makePlugin(root, 'first', 'First doctrine.\n', T1, 'aaa1111');
        const second = makePlugin(root, 'second', 'Second doctrine.\n', T2, 'bbb2222');
        runHook(home, first, 'startup');
        const firstLine = readDoctrine(home).split('\n')[0];
        assert.ok(firstLine.startsWith(HEADER_OPEN), firstLine);
        assert.match(firstLine, /skills\/operating-instructions\/SKILL\.md/);
        assert.match(firstLine, /-->\s*$/);

        runHook(home, second, 'startup');
        const written = readDoctrine(home);
        assert.strictEqual(written.split('\n')[0], firstLine);
        assert.strictEqual(bodyOf(written), 'Second doctrine.\n');
    } finally {
        rmDir(root);
    }
});

test('a hand-edited file with no stamp is overwritten once and stamped', () => {
    const root = makeDir('doctrine-refresh-hand-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(doctrinePath(home), 'A hand edit.\n', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        assert.strictEqual(runHook(home, plugin, 'startup'), '');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'The doctrine.\n');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'aaa1111');
        assert.strictEqual(stamp.payloadMtimeMs, T1.getTime());
    } finally {
        rmDir(root);
    }
});

test('a malformed stamp is read as no stamp: the writer overwrites and restamps', () => {
    const root = makeDir('doctrine-refresh-malformed-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(doctrinePath(home), 'Some other text.\n', 'utf8');
        fs.writeFileSync(stampPath(home), '{ not json', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        assert.strictEqual(runHook(home, plugin, 'startup'), '');
        assert.strictEqual(bodyOf(readDoctrine(home)), 'The doctrine.\n');
        assert.strictEqual(readStamp(home).hash, 'aaa1111');
    } finally {
        rmDir(root);
    }
});

test('a payload with no build-info.json records its hash as unknown', () => {
    const root = makeDir('doctrine-refresh-nohash-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, null);
        runHook(home, plugin, 'startup');
        const stamp = readStamp(home);
        assert.strictEqual(stamp.hash, 'unknown');
        assert.strictEqual(stamp.payloadMtimeMs, T1.getTime());
    } finally {
        rmDir(root);
    }
});

// --- The rename migration. A home an earlier install wrote carries the
// doctrine file, its stamp and the signpost under the plugin's former name,
// and a CLAUDE.md importing the former doctrine file. The hook renames each
// file only where its new name is absent, so a newer write is never replaced,
// and swaps the import only on a line that is exactly the former token.

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
const SIGNPOST_BYTES = '{"kitRepoPath":"C:\\\\clone","machine":"M1"}\r\n';

// A fixture home in the state an earlier install left: the three files under
// their former names and a CLAUDE.md whose import line is exactly the former
// token, with every line ending eol. The old stamp carries T1, the time the
// fixture plugin is written at, so the refresh after the migration writes.
function makeOldHome(root, eol) {
    const home = path.join(root, 'home');
    const dir = path.join(home, '.claude');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, OLD.doctrine), 'Old doctrine text.\n', 'utf8');
    fs.writeFileSync(path.join(dir, OLD.stamp),
        JSON.stringify({ payloadMtimeMs: T1.getTime(), hash: 'old1111', root: 'old' }) + '\n', 'utf8');
    fs.writeFileSync(path.join(dir, OLD.signpost), SIGNPOST_BYTES, 'utf8');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), claudeMdWith(OLD.importLine, eol), 'utf8');
    return home;
}

function claudeMdWith(importLine, eol) {
    return ['# My global notes', '', importLine, 'Keep this line, café.', ''].join(eol);
}

// Every entry in ~/.claude by name, with its bytes, so a comparison sees a
// rename, a new file and a changed byte alike.
function snapshot(home) {
    const dir = path.join(home, '.claude');
    const out = {};
    for (const name of fs.readdirSync(dir).sort()) out[name] = fs.readFileSync(path.join(dir, name)).toString('base64');
    return out;
}

const claudePath = (home, name) => path.join(home, '.claude', name);

for (const [label, eol] of [['CRLF', '\r\n'], ['LF', '\n']]) test(`a home in the former name's state ends with the three new files and the new import line, ${label} kept`, () => {
    const root = makeDir('doctrine-refresh-migrate-');
    try {
        const home = makeOldHome(root, eol);
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const out = runHook(home, plugin, 'startup');

        for (const name of [OLD.doctrine, OLD.stamp, OLD.signpost]) {
            assert.ok(!fs.existsSync(claudePath(home, name)), name + ' must be gone');
        }
        assert.strictEqual(bodyOf(readDoctrine(home)), 'The doctrine.\n');
        assert.strictEqual(readStamp(home).hash, 'aaa1111');
        // The signpost is moved, never rewritten: its bytes are the ones the
        // earlier install wrote.
        assert.strictEqual(fs.readFileSync(claudePath(home, NEW.signpost), 'utf8'), SIGNPOST_BYTES);
        // Every byte but the import line's own text is kept, line endings included.
        assert.strictEqual(fs.readFileSync(claudePath(home, 'CLAUDE.md'), 'utf8'), claudeMdWith(NEW.importLine, eol));
        // No temp file is left beside CLAUDE.md once the swap has landed.
        assert.deepStrictEqual(fs.readdirSync(path.join(home, '.claude')).filter((n) => /tmp/.test(n)), [], 'no temp file left behind');

        const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
        assert.ok(ctx.includes(NEW.importLine) && ctx.includes(OLD.importLine), 'the rewrite is reported: ' + ctx);
        assert.ok(!ctx.includes('\n'), 'the report is one line: ' + ctx);
        assert.doesNotMatch(ctx, /not wired in/, 'the swapped import needs no offer');
    } finally {
        rmDir(root);
    }
});

test('a home holding only new files is untouched, and the snapshot sees a migration (control)', () => {
    const root = makeDir('doctrine-refresh-migrate-new-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(claudePath(home, NEW.signpost), SIGNPOST_BYTES, 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        const before = snapshot(home);
        assert.strictEqual(runHook(home, plugin, 'startup'), '');
        assert.deepStrictEqual(snapshot(home), before);

        // Control: the same snapshot, taken across a run on a home in the
        // former name's state, reports the change, so its silence above is
        // the migration declining rather than a comparison that cannot see one.
        const oldRoot = path.join(root, 'old');
        fs.mkdirSync(oldRoot);
        const oldHome = makeOldHome(oldRoot, '\n');
        const oldBefore = snapshot(oldHome);
        runHook(oldHome, plugin, 'startup');
        assert.notDeepStrictEqual(snapshot(oldHome), oldBefore);
    } finally {
        rmDir(root);
    }
});

test('a home holding both names of each file leaves every pair as it was', () => {
    const root = makeDir('doctrine-refresh-migrate-both-');
    try {
        const home = makeOldHome(root, '\n');
        fs.writeFileSync(claudePath(home, NEW.doctrine), 'Newer text.\n', 'utf8');
        fs.writeFileSync(claudePath(home, NEW.stamp),
            JSON.stringify({ payloadMtimeMs: T1.getTime(), hash: 'new2222', root: 'new' }) + '\n', 'utf8');
        fs.writeFileSync(claudePath(home, NEW.signpost), '{"kitRepoPath":"C:\\\\newer"}\n', 'utf8');
        const oldBytes = {};
        for (const name of [OLD.doctrine, OLD.stamp, OLD.signpost]) oldBytes[name] = fs.readFileSync(claudePath(home, name), 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');

        for (const name of [OLD.doctrine, OLD.stamp, OLD.signpost]) {
            assert.strictEqual(fs.readFileSync(claudePath(home, name), 'utf8'), oldBytes[name], name + ' must stay as it was');
        }
        assert.ok(fs.existsSync(claudePath(home, NEW.doctrine)));
        assert.ok(fs.existsSync(claudePath(home, NEW.stamp)));
        assert.strictEqual(fs.readFileSync(claudePath(home, NEW.signpost), 'utf8'), '{"kitRepoPath":"C:\\\\newer"}\n');
    } finally {
        rmDir(root);
    }
});

test('a lone old stamp beside a new doctrine file stays put', () => {
    const root = makeDir('doctrine-refresh-migrate-stamp-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(claudePath(home, NEW.doctrine), 'Some text.\n', 'utf8');
        fs.writeFileSync(claudePath(home, OLD.stamp), '{"payloadMtimeMs":1}\n', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        assert.strictEqual(fs.readFileSync(claudePath(home, OLD.stamp), 'utf8'), '{"payloadMtimeMs":1}\n');
        assert.strictEqual(readStamp(home).hash, 'aaa1111', 'the new stamp is the refresh\'s own');
    } finally {
        rmDir(root);
    }
});

// The swap takes no "already imported" gate, so a line holding the new token
// in another letter case leaves the old line swapped, and the swapped line
// holds the exact token, so no offer is made.
test('a line holding the new token in another letter case does not stop the swap', () => {
    const root = makeDir('doctrine-refresh-migrate-case-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(claudePath(home, 'CLAUDE.md'), '@Grimoire-Doctrine.md\n' + OLD.importLine + '\n', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const out = runHook(home, plugin, 'startup');
        assert.strictEqual(fs.readFileSync(claudePath(home, 'CLAUDE.md'), 'utf8'), '@Grimoire-Doctrine.md\n' + NEW.importLine + '\n');
        assert.doesNotMatch(out, /not wired in/, 'the swapped line is the import: ' + out);
    } finally {
        rmDir(root);
    }
});

// A line holding the import token with indentation and a trailing note
// contains the token, so it is not offered twice.
test('an import line with indentation or a trailing note draws no wiring offer', () => {
    const root = makeDir('doctrine-refresh-wired-shape-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(claudePath(home, 'CLAUDE.md'), '# Global\n  @grimoire-doctrine.md  # kit doctrine\n', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const out = runHook(home, plugin, 'startup');
        assert.doesNotMatch(out, /not wired in/, 'the import is present: ' + out);
    } finally {
        rmDir(root);
    }
});

// The swap takes no "already imported" gate: once the doctrine file is
// renamed, the exact old line is dead whatever else the file holds, so an
// annotated import beside it leaves two import lines, which load one file.
test('an annotated new import beside the old line does not stop the swap', () => {
    const root = makeDir('doctrine-refresh-migrate-shape-');
    try {
        const home = makeHome(root);
        const live = '  @grimoire-doctrine.md  # kit doctrine\n';
        fs.writeFileSync(claudePath(home, 'CLAUDE.md'), live + OLD.importLine + '\n', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const out = runHook(home, plugin, 'startup');
        assert.strictEqual(fs.readFileSync(claudePath(home, 'CLAUDE.md'), 'utf8'), live + NEW.importLine + '\n');
        assert.doesNotMatch(out, /not wired in/, 'the import is present: ' + out);
    } finally {
        rmDir(root);
    }
});

// A CLAUDE.md kept in a dotfiles directory and linked into ~/.claude, through
// a chain of two relative links. Creating a link on Windows needs the
// symlink privilege or developer mode, so the case skips where it cannot.
test('a linked CLAUDE.md is swapped in its final target, and both links stay links', (t) => {
    const root = makeDir('doctrine-refresh-migrate-link-');
    try {
        const home = makeHome(root);
        const dotfiles = path.join(root, 'dotfiles');
        fs.mkdirSync(dotfiles);
        const real = path.join(dotfiles, 'real.md');
        fs.writeFileSync(real, claudeMdWith(OLD.importLine, '\r\n'), 'utf8');
        fs.unlinkSync(claudePath(home, 'CLAUDE.md'));
        try {
            fs.symlinkSync('real.md', path.join(dotfiles, 'middle.md'), 'file');
            fs.symlinkSync(path.join('..', '..', 'dotfiles', 'middle.md'), claudePath(home, 'CLAUDE.md'), 'file');
        } catch (e) {
            t.skip('cannot create a symbolic link here (' + e.code + ')');
            return;
        }
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        assert.ok(fs.lstatSync(claudePath(home, 'CLAUDE.md')).isSymbolicLink(), 'CLAUDE.md is still a link');
        assert.ok(fs.lstatSync(path.join(dotfiles, 'middle.md')).isSymbolicLink(), 'the middle link is still a link');
        assert.strictEqual(fs.readFileSync(real, 'utf8'), claudeMdWith(NEW.importLine, '\r\n'));
        for (const dir of [dotfiles, path.join(home, '.claude')]) {
            assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => /tmp/.test(n)), [], 'no temp file left in ' + dir);
        }
    } finally {
        rmDir(root);
    }
});

// A read-only CLAUDE.md makes the rename over it fail on Windows (EPERM),
// which drives the failure branch after the temp file was written. POSIX
// rename(2) replaces a read-only file, so the case skips off Windows.
test('a swap that fails leaves CLAUDE.md byte-identical and no temp file', { skip: !isWin }, () => {
    const root = makeDir('doctrine-refresh-migrate-fail-');
    const home = makeHome(root);
    const claudeMd = claudePath(home, 'CLAUDE.md');
    try {
        const text = claudeMdWith(OLD.importLine, '\r\n');
        fs.writeFileSync(claudeMd, text, 'utf8');
        fs.chmodSync(claudeMd, 0o444);
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        assert.strictEqual(fs.readFileSync(claudeMd, 'utf8'), text);
        assert.deepStrictEqual(fs.readdirSync(path.join(home, '.claude')).filter((n) => /tmp/.test(n)), [], 'no temp file left behind');
    } finally {
        try { fs.chmodSync(claudeMd, 0o644); } catch { /* best effort */ }
        rmDir(root);
    }
});

// The migration case: the exact old line beside a live new import is
// rewritten, and the file draws no wiring offer.
test('a CLAUDE.md holding the exact new line has its exact old line rewritten too, with no wiring offer', () => {
    const root = makeDir('doctrine-refresh-migrate-dup-');
    try {
        const home = makeHome(root);
        fs.writeFileSync(claudePath(home, 'CLAUDE.md'), OLD.importLine + '\r\n' + NEW.importLine + '\r\n', 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const ctx = JSON.parse(runHook(home, plugin, 'startup')).hookSpecificOutput.additionalContext;
        assert.strictEqual(fs.readFileSync(claudePath(home, 'CLAUDE.md'), 'utf8'), NEW.importLine + '\r\n' + NEW.importLine + '\r\n');
        assert.ok(ctx.includes(OLD.importLine), 'the swap is reported: ' + ctx);
        assert.doesNotMatch(ctx, /not wired in/);
    } finally {
        rmDir(root);
    }
});

// A write that fails partway after CLAUDE.md is gone. A preload makes the
// hook's write into the temp file put half the bytes there, remove the
// target, and throw, which no real disk does on demand.
test('a partial temp write with CLAUDE.md gone is named as partial, and no wiring offer is made', () => {
    const root = makeDir('doctrine-refresh-migrate-partial-');
    try {
        const home = makeHome(root);
        const claudeMd = claudePath(home, 'CLAUDE.md');
        fs.writeFileSync(claudeMd, claudeMdWith(OLD.importLine, '\n'), 'utf8');
        const preload = path.join(root, 'partial-write.js');
        fs.writeFileSync(preload, [
            "const fs = require('fs');",
            'const real = fs.writeFileSync;',
            'fs.writeFileSync = function (file, data, ...rest) {',
            "    if (typeof file !== 'number') return real.call(fs, file, data, ...rest);",
            '    fs.writeSync(file, data, 0, Math.floor(data.length / 2));',
            '    fs.unlinkSync(process.env.PARTIAL_TARGET);',
            "    throw new Error('disk full');",
            '};',
            ''
        ].join('\n'), 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const res = spawnSync(process.execPath, ['--require', preload, HOOK], {
            input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }),
            encoding: 'utf8',
            env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PLUGIN_ROOT: plugin, PARTIAL_TARGET: claudeMd }
        });
        assert.strictEqual(res.status, 0, res.stderr);
        const temps = fs.readdirSync(path.join(home, '.claude')).filter((n) => /tmp-migrate/.test(n));
        assert.strictEqual(temps.length, 1, 'the partial temp is kept: ' + temps);
        const ctx = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
        assert.ok(ctx.includes(temps[0]), 'the partial temp is named: ' + ctx);
        assert.match(ctx, /did not complete/);
        assert.match(ctx, /not a whole copy/);
        assert.doesNotMatch(ctx, /not wired in/, 'no offer to create a file whose temp is named: ' + ctx);
    } finally {
        rmDir(root);
    }
});

test('an old-token line carrying other text is kept, and the wiring offer names the new token', () => {
    const root = makeDir('doctrine-refresh-migrate-other-');
    try {
        const home = makeHome(root);
        const text = '# notes\n' + OLD.importLine + '  # my comment\n';
        fs.writeFileSync(claudePath(home, 'CLAUDE.md'), text, 'utf8');
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const ctx = JSON.parse(runHook(home, plugin, 'startup')).hookSpecificOutput.additionalContext;
        assert.strictEqual(fs.readFileSync(claudePath(home, 'CLAUDE.md'), 'utf8'), text);
        assert.match(ctx, /not wired in/);
        assert.ok(ctx.includes('"' + NEW.importLine + '"'), ctx);
    } finally {
        rmDir(root);
    }
});

// A UTF-8 file can open with a byte order mark, which sits ahead of line 1's
// text. The exact old line after it is swapped, and the mark is kept.
test('an exact old line on line 1 after a UTF-8 BOM is swapped, and the BOM and every other byte stay', () => {
    const root = makeDir('doctrine-refresh-migrate-bom-');
    try {
        const home = makeHome(root);
        const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
        const rest = '\r\nKeep this line, café.\r\n';
        fs.writeFileSync(claudePath(home, 'CLAUDE.md'), Buffer.concat([bom, Buffer.from(OLD.importLine + rest, 'utf8')]));
        const plugin = makePlugin(root, 'plugin', 'The doctrine.\n', T1, 'aaa1111');
        const out = runHook(home, plugin, 'startup');
        const want = Buffer.concat([bom, Buffer.from(NEW.importLine + rest, 'utf8')]);
        assert.ok(fs.readFileSync(claudePath(home, 'CLAUDE.md')).equals(want),
            'CLAUDE.md: ' + JSON.stringify(fs.readFileSync(claudePath(home, 'CLAUDE.md'), 'latin1')));
        assert.doesNotMatch(out, /not wired in/, 'the swapped line is the import: ' + out);
    } finally {
        rmDir(root);
    }
});

// --- The doctor's comparison. Lifts the section from Get-DoctrineBody to the
// kaizen signpost section that follows it, and runs it against a fixture
// ~/.claude and a fixture plugin root, with Report and Get-PayloadClause stubbed.

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function runDoctrineSection(claudeDir, pluginRoot) {
    const outFile = path.join(os.tmpdir(), 'doctrine-refresh-doctor-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(DOCTOR) + ')',
        '$start = $src.IndexOf("function Get-DoctrineBody")',
        'if ($start -lt 0) { throw "Get-DoctrineBody not found in doctor.ps1" }',
        '$end = $src.IndexOf("# --- Kaizen signpost", $start)',
        'if ($end -lt 0) { throw "kaizen signpost section not found after the doctrine section" }',
        '$section = $src.Substring($start, $end - $start)',
        '$script:Reports = @()',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        'function Get-PayloadClause { return "" }',
        '$claudeDir = ' + q(claudeDir),
        '$pluginRoot = ' + q(pluginRoot),
        'Invoke-Expression $section',
        '$__json = @{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6',
        '[System.IO.File]::WriteAllText(' + q(outFile) + ', $__json, (New-Object System.Text.UTF8Encoding($false)))'
    ].join('\n');
    const res = spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
    try {
        assert.strictEqual(res.status, 0, res.stdout + res.stderr);
        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        assert.ok(Array.isArray(parsed.Reports), 'Reports must be an array: ' + res.stdout);
        return parsed.Reports.filter((r) => r.Name === 'Doctrine import');
    } finally {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
    }
}

test('the doctor reads PASS on a file the hook wrote, header included', { skip: !isWin }, () => {
    const root = makeDir('doctrine-refresh-doctor-pass-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'Line one.\n\nLine two.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        assert.ok(readDoctrine(home).startsWith(HEADER_OPEN));
        const reports = runDoctrineSection(path.join(home, '.claude'), plugin);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'PASS', reports[0].Detail);
    } finally {
        rmDir(root);
    }
});

test('the doctor still WARNs where the body under the header differs (control)', { skip: !isWin }, () => {
    const root = makeDir('doctrine-refresh-doctor-warn-');
    try {
        const home = makeHome(root);
        const plugin = makePlugin(root, 'plugin', 'Line one.\n\nLine two.\n', T1, 'aaa1111');
        runHook(home, plugin, 'startup');
        const header = readDoctrine(home).split('\n')[0];
        fs.writeFileSync(doctrinePath(home), header + '\nA different body.\n', 'utf8');
        const reports = runDoctrineSection(path.join(home, '.claude'), plugin);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN', reports[0].Detail);
        // The remedy names the decline and the stamp that clears it, since a
        // session on an older plugin than the last writer does not refresh.
        assert.match(reports[0].Detail, /grimoire-doctrine\.stamp\.json/);
        assert.match(reports[0].Detail, /declin/i);
    } finally {
        rmDir(root);
    }
});
