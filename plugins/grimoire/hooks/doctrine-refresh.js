#!/usr/bin/env node
// SessionStart hook: keep the Code-surface operating doctrine current, always-on.
//
// The doctrine is single-sourced as the operating-instructions skill (which rides
// plugin auto-update to every surface). On Claude Code we want it ALWAYS-ON, not
// on-demand, so this hook maintains a stable, kit-owned file that the user's
// ~/.claude/CLAUDE.md imports:
//
//   0. Move the files an install under the plugin's former name wrote (the
//      doctrine file, its stamp and the kaizen signpost) onto the current names,
//      never over a file already under the current name, and swap a CLAUDE.md
//      line that is exactly the former import token for the current one, saying
//      so in one additionalContext line.
//   1. Read the installed skill's SKILL.md from CLAUDE_PLUGIN_ROOT, strip the YAML
//      frontmatter, and write one header line plus the body to
//      ~/.claude/grimoire-doctrine.md whenever it differs. Reading from
//      CLAUDE_PLUGIN_ROOT each session means the current (auto-updated) plugin is
//      always the source, so the version-stamped cache path never leaks into the
//      import and the import line never goes stale. The header is an HTML comment
//      naming this hook as the writer and the skill as the source of truth, so a
//      hand edit meets its owner; it is never part of the skill body, and the
//      doctor's comparison strips it.
//      A long-lived session can still run on a superseded plugin cache, so every
//      write records grimoire-doctrine.stamp.json beside the file: the writer's
//      payload time (the skill file's mtime, which the install copies from the
//      marketplace clone, so a later version whose skill changed carries a later
//      time), its build hash from .claude-plugin/build-info.json ("unknown" where
//      the root carries none, as a marketplace install does), and its root's
//      directory name, which on a marketplace install is the commit's short hash.
//      A writer whose payload time is older than the
//      stamped one declines to write where the file exists; where it is absent
//      there is no newer text to keep, so the writer writes and stamps. At a
//      session start (startup or resume) a decline says so in one
//      additionalContext line naming both writers' root directories and hashes,
//      and the stamp whose deletion lets the next session write; at clear and
//      compact it declines silently. The order is time alone: two hashes have no
//      order, so the hash rides for the decline line only. A missing or malformed
//      stamp reads as no stamp, and the writer writes and stamps.
//   2. If ~/.claude/CLAUDE.md does not import that file yet, OFFER (never silently
//      perform) to add the one-line `@grimoire-doctrine.md` import. The doctrine
//      file is kit-owned and safe to overwrite silently; the user's personal
//      CLAUDE.md is not, so touching it stays consent-gated at the agent layer.
//
// SAFETY: fails OPEN and silent. Missing skill, unreadable/unwritable paths, an
// up-to-date file with the import already present, or any error -> exit 0, no output.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DOCTRINE_FILE = 'grimoire-doctrine.md';     // kit-owned, lives in ~/.claude
const IMPORT_TOKEN = '@grimoire-doctrine.md';      // the line ~/.claude/CLAUDE.md needs
const STAMP_FILE = 'grimoire-doctrine.stamp.json'; // the last writer's payload time, hash and root directory
const HEADER =
    '<!-- Written by the grimoire doctrine-refresh hook from skills/operating-instructions/SKILL.md; ' +
    'edit the skill, not this file. -->';
const SESSION_START_SOURCES = ['startup', 'resume'];
const SIGNPOST_FILE = 'grimoire.local.json';       // the kaizen signpost, which the doctor writes

// These spell the plugin's former name because they read the files earlier
// installs wrote, which the migration step below moves to the names above.
const OLD_DOCTRINE_FILE = 'claude-kit-doctrine.md';
const OLD_IMPORT_TOKEN = '@claude-kit-doctrine.md';
const OLD_STAMP_FILE = 'claude-kit-doctrine.stamp.json';
const OLD_SIGNPOST_FILE = 'claude-kit.local.json';

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// Locate the installed operating-instructions skill. Prefer the plugin root the
// host provides; fall back to this file's own location.
function skillPath() {
    const rel = path.join('skills', 'operating-instructions', 'SKILL.md');
    const candidates = [];
    if (process.env.CLAUDE_PLUGIN_ROOT) candidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, rel));
    candidates.push(path.join(__dirname, '..', rel));
    for (const f of candidates) {
        try { if (fs.statSync(f).isFile()) return f; } catch { /* try next */ }
    }
    return null;
}

// Drop a leading YAML frontmatter block (--- ... ---) and one blank line after it.
function stripFrontmatter(text) {
    const lines = text.split('\n');
    if ((lines[0] || '').trim() !== '---') return text;
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') { end = i; break; }
    }
    if (end === -1) return text;                      // no closing fence: leave as-is
    return lines.slice(end + 1).join('\n').replace(/^\r?\n/, '');
}

// The build hash of the plugin root the skill was found under, from the stamp the
// build writes into .claude-plugin/build-info.json. The file is gitignored, so a
// marketplace install and an unbuilt checkout carry none, and an unreadable or
// hashless one reads the same: "unknown".
function buildHash(pluginRoot) {
    try {
        // Strip a leading BOM: a UTF-8-with-BOM stamp would otherwise fail JSON.parse.
        const info = JSON.parse(fs.readFileSync(
            path.join(pluginRoot, '.claude-plugin', 'build-info.json'), 'utf8').replace(/^\uFEFF/, ''));
        if (info && typeof info.hash === 'string' && info.hash) return info.hash;
    } catch { /* absent or unreadable */ }
    return 'unknown';
}

// The stamp the last write left, or null where it is absent, unreadable,
// malformed, or carries no finite payload time: each of those reads as no stamp.
function readStamp(stampPath) {
    try {
        const s = JSON.parse(fs.readFileSync(stampPath, 'utf8').replace(/^\uFEFF/, ''));
        if (s && Number.isFinite(s.payloadMtimeMs)) {
            const named = (v) => (typeof v === 'string' && v ? v : 'unknown');
            return { payloadMtimeMs: s.payloadMtimeMs, hash: named(s.hash), root: named(s.root) };
        }
    } catch { /* absent or malformed */ }
    return null;
}

// Rename from to to inside dir where from exists and to does not, so a file
// already under the new name is never replaced. True where the rename landed.
function renameIfFree(dir, from, to) {
    try {
        if (!fs.existsSync(path.join(dir, from)) || fs.existsSync(path.join(dir, to))) return false;
        fs.renameSync(path.join(dir, from), path.join(dir, to));
        return true;
    } catch { return false; }                         // locked or unwritable: give up quietly
}

// Move a home an earlier install wrote under the plugin's former name onto the
// current names. The doctrine file moves where its new name is absent, and its
// stamp moves only in that same run, since a lone old stamp beside a current
// file describes some other write. The signpost moves on its own. In CLAUDE.md
// the first line that is exactly the old import token, terminator aside, becomes
// the new token, unless a line is already exactly the new token. The file is
// read and written as latin1 so every other byte, line endings included, is
// written back as it was read. Returns the session-start line reporting the
// import swap, or null.
function migrateFormerName(claudeDir) {
    if (renameIfFree(claudeDir, OLD_DOCTRINE_FILE, DOCTRINE_FILE)) {
        renameIfFree(claudeDir, OLD_STAMP_FILE, STAMP_FILE);
    }
    renameIfFree(claudeDir, OLD_SIGNPOST_FILE, SIGNPOST_FILE);
    try {
        const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');
        const segments = fs.readFileSync(claudeMdPath, 'latin1').split(/(?<=\n)/);
        const textOf = (seg) => seg.replace(/\r?\n$/, '');
        if (segments.some((seg) => textOf(seg) === IMPORT_TOKEN)) return null;
        const at = segments.findIndex((seg) => textOf(seg) === OLD_IMPORT_TOKEN);
        if (at < 0) return null;
        segments[at] = IMPORT_TOKEN + segments[at].slice(OLD_IMPORT_TOKEN.length);
        fs.writeFileSync(claudeMdPath, segments.join(''), 'latin1');
        return `Kit renamed: ~/.claude/CLAUDE.md imported "${OLD_IMPORT_TOKEN}", the doctrine file's former ` +
            `name, so that line now reads "${IMPORT_TOKEN}", the file's current name. No other line changed.`;
    } catch { return null; }                          // absent or unwritable: nothing to swap
}

function main() {
    let payload = {};
    try { payload = JSON.parse(readStdin() || '{}') || {}; } catch { /* malformed: defaults */ }
    const atSessionStart = SESSION_START_SOURCES.includes(payload.source || 'startup');

    const sp = skillPath();
    if (!sp) return;                                  // skill not installed: silent

    let body;
    let payloadMtimeMs;
    try {
        body = stripFrontmatter(fs.readFileSync(sp, 'utf8').replace(/^\uFEFF/, ''));
        payloadMtimeMs = fs.statSync(sp).mtimeMs;
    }
    catch { return; }
    if (!body.trim()) return;                         // empty doctrine: nothing to do

    const claudeDir = path.join(os.homedir(), '.claude');
    const doctrinePath = path.join(claudeDir, DOCTRINE_FILE);
    const stampPath = path.join(claudeDir, STAMP_FILE);
    const lines = [];

    // 0. Move a home the plugin's former name wrote onto the current names, so
    //    the refresh below finds the file and stamp it owns.
    const migrated = migrateFormerName(claudeDir);
    if (migrated) lines.push(migrated);

    // 1. Refresh the kit-owned doctrine file silently when it drifts, unless a
    //    newer payload wrote it last.
    try {
        const pluginRoot = path.dirname(path.dirname(path.dirname(sp)));
        const hash = buildHash(pluginRoot);
        const root = path.basename(pluginRoot);
        const stamp = readStamp(stampPath);
        if (stamp && payloadMtimeMs < stamp.payloadMtimeMs && fs.existsSync(doctrinePath)) {
            if (atSessionStart) {
                // Both roots' names and hashes are read from disk and enter a
                // channel a model reads, so they take that channel's renderer.
                const { sanitizeForOutput: sanitize } = require('./kit-compact-lib.js');
                lines.push(
                    `Kit doctrine not refreshed: this session's grimoire plugin (${sanitize(root)}, ` +
                    `build ${sanitize(hash)}) is older than the one that last wrote ~/.claude/${DOCTRINE_FILE} ` +
                    `(${sanitize(stamp.root)}, build ${sanitize(stamp.hash)}), so the file was left as that plugin wrote it. Deleting ` +
                    `~/.claude/${STAMP_FILE} lets the next session write it.`);
            }
        } else {
            const eol = body.includes('\r\n') ? '\r\n' : '\n';
            const content = HEADER + eol + body;
            let current = null;
            try { current = fs.readFileSync(doctrinePath, 'utf8'); } catch { /* absent */ }
            if (current !== content) {
                fs.mkdirSync(claudeDir, { recursive: true });
                fs.writeFileSync(doctrinePath, content, 'utf8');
            }
            if (!stamp || stamp.payloadMtimeMs !== payloadMtimeMs || stamp.hash !== hash || stamp.root !== root) {
                fs.mkdirSync(claudeDir, { recursive: true });
                fs.writeFileSync(stampPath, JSON.stringify({ payloadMtimeMs, hash, root }) + '\n', 'utf8');
            }
        }
    } catch { /* unwritable home: give up quietly, never block */ }

    // 2. Offer to wire the import if the user's CLAUDE.md does not have it.
    let userClaudeMd = null;
    try { userClaudeMd = fs.readFileSync(path.join(claudeDir, 'CLAUDE.md'), 'utf8'); } catch { /* absent */ }
    if (userClaudeMd === null || !userClaudeMd.includes(IMPORT_TOKEN)) {
        lines.push(
            `Kit doctrine not wired in: the operating doctrine is installed and auto-refreshed at ` +
            `~/.claude/${DOCTRINE_FILE}, but ~/.claude/CLAUDE.md does not import it, so it is not loading ` +
            `always-on here. Offer to add the single line "${IMPORT_TOKEN}" to ~/.claude/CLAUDE.md ` +
            `(creating the file if absent), and act ONLY on the user's explicit approval - it is their ` +
            `personal config. Once added, the doctrine loads always-on and stays current automatically. ` +
            `If the user declines, do not raise it again this session.`);
    }
    if (!lines.length) return;                        // current, or declined quietly, and wired: silent

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') }
    }));
}

try { main(); } catch { /* never break a session over a hook */ }
// Zero without process.exit(): the wiring offer is a single stdout write the
// session depends on, and forcing the exit can discard a write still in flight
// on a pipe. Nothing above sets a nonzero code, and main() is wrapped, so the
// process ends at 0 once stdout has drained.
process.exitCode = 0;
