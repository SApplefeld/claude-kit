#!/usr/bin/env node
// SessionStart hook: keep the Code-surface operating doctrine current, always-on.
//
// The doctrine is single-sourced as the operating-instructions skill (which rides
// plugin auto-update to every surface). On Claude Code we want it ALWAYS-ON, not
// on-demand, so this hook maintains a stable, kit-owned file that the user's
// ~/.claude/CLAUDE.md imports:
//
//   1. Read the installed skill's SKILL.md from CLAUDE_PLUGIN_ROOT, strip the YAML
//      frontmatter, and write one header line plus the body to
//      ~/.claude/claude-kit-doctrine.md whenever it differs. Reading from
//      CLAUDE_PLUGIN_ROOT each session means the current (auto-updated) plugin is
//      always the source, so the version-stamped cache path never leaks into the
//      import and the import line never goes stale. The header is an HTML comment
//      naming this hook as the writer and the skill as the source of truth, so a
//      hand edit meets its owner; it is never part of the skill body, and the
//      doctor's comparison strips it.
//      A long-lived session can still run on a superseded plugin cache, so every
//      write records claude-kit-doctrine.stamp.json beside the file: the writer's
//      payload time (the skill file's mtime, which is when that payload landed in
//      its cache) and its build hash from .claude-plugin/build-info.json ("unknown"
//      where the root carries none). A writer whose payload time is older than the
//      stamped one declines to write. At a session start (startup or resume) it
//      says so in one additionalContext line naming both hashes; at clear and
//      compact it declines silently. The order is time alone: two hashes have no
//      order, so the hash rides for the decline line only. A missing or malformed
//      stamp reads as no stamp, and the writer writes and stamps.
//   2. If ~/.claude/CLAUDE.md does not import that file yet, OFFER (never silently
//      perform) to add the one-line `@claude-kit-doctrine.md` import. The doctrine
//      file is kit-owned and safe to overwrite silently; the user's personal
//      CLAUDE.md is not, so touching it stays consent-gated at the agent layer.
//
// SAFETY: fails OPEN and silent. Missing skill, unreadable/unwritable paths, an
// up-to-date file with the import already present, or any error -> exit 0, no output.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DOCTRINE_FILE = 'claude-kit-doctrine.md';     // kit-owned, lives in ~/.claude
const IMPORT_TOKEN = '@claude-kit-doctrine.md';      // the line ~/.claude/CLAUDE.md needs
const STAMP_FILE = 'claude-kit-doctrine.stamp.json'; // the last writer's payload time and hash
const HEADER =
    '<!-- Written by the claude-kit doctrine-refresh hook from skills/operating-instructions/SKILL.md ' +
    'in the installed claude-kit plugin, which is the source of truth. An edit here is overwritten ' +
    'at the next session start; change the skill instead. -->';
const SESSION_START_SOURCES = ['startup', 'resume'];

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
// build writes into .claude-plugin/build-info.json. A source checkout carries no
// such file, and an unreadable or hashless one reads the same: "unknown".
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
            return { payloadMtimeMs: s.payloadMtimeMs, hash: typeof s.hash === 'string' && s.hash ? s.hash : 'unknown' };
        }
    } catch { /* absent or malformed */ }
    return null;
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

    // 1. Refresh the kit-owned doctrine file silently when it drifts, unless a
    //    newer payload wrote it last.
    try {
        const hash = buildHash(path.dirname(path.dirname(path.dirname(sp))));
        const stamp = readStamp(stampPath);
        if (stamp && payloadMtimeMs < stamp.payloadMtimeMs) {
            if (atSessionStart) {
                lines.push(
                    `Kit doctrine not refreshed: this session's claude-kit plugin (build ${hash}) is older than ` +
                    `the one that last wrote ~/.claude/${DOCTRINE_FILE} (build ${stamp.hash}), so the file keeps ` +
                    `the newer doctrine. This session runs on a superseded plugin; restart it to load the current one.`);
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
            if (!stamp || stamp.payloadMtimeMs !== payloadMtimeMs || stamp.hash !== hash) {
                fs.mkdirSync(claudeDir, { recursive: true });
                fs.writeFileSync(stampPath, JSON.stringify({ payloadMtimeMs, hash }) + '\n', 'utf8');
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
