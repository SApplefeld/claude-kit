#!/usr/bin/env node
// Stop hook: the registered seat's heartbeat stamp and compaction boundary.
//
// A leashed worker's compaction boundary is structural already: the chapter
// checkpoint the executing-work ritual opens is what the PreCompact gate reads.
// A goalless seat's boundary was prose, and prose that a seat has to remember
// at the end of every pass. This hook makes it structural on the same terms:
// the seat pushes status to its own registry entry at its banked moments, which
// is a declaration it already owes the coordinator, and this hook turns that
// declaration into the marker the gate honors.
//
// Two independent legs, both keyed on the calling session's registry entry at
// ~/.claude/coordinator/<hostname>/registry/<session-id>.md:
//
//   1. The heartbeat. The entry's `Heartbeat:` line is stamped with now,
//      throttled to one write per HEARTBEAT_THROTTLE_MS. It is how a session
//      the roster cannot show (an elevated one) proves it is alive, and it is
//      the reading the coordinator's prune of a dead entry is gated on.
//   2. The boundary. Where the entry's `Status-updated:` stamp is within
//      STATUS_FRESH_MS of now and the project directory's tree is clean, the
//      role-boundary marker is opened for this session. The status push is the
//      seat's own banked declaration; this hook only makes it reach the gate.
//      The freshness test is on the wall clock and not on the turn, so every
//      turn ending inside that window opens the marker, and a Stop inside the
//      window after the gate has consumed one opens it again. What that buys
//      is a marker for a moment the seat declared minutes earlier rather than
//      at this exact turn end, which is the cost the marker design already
//      prices: a compaction landing anywhere inside the window costs a re-read
//      and never state, the invariant the declaration carries.
//
// The whole cost for a session the registry does not carry is one stat, which
// is what makes it affordable on every Stop of every session on the machine.
//
// One residual is left standing and is named so it is not rediscovered as a
// bug: the marker file is per project directory, so two registered seats
// working the same project directory flap the one file, each Stop overwriting
// the other's session id. The gate releases a compaction only for the session
// a live marker names, so the flap costs the seat that stopped first its
// release, degrading it to the pre-marker behaviour where its compaction rides
// to the safety ceiling, and never produces a release for a session that
// declared nothing.
//
// It never blocks: nothing is written to stdout on any path, so the stop is
// always allowed and no stop_hook_active guard is needed. Any failure exits 0,
// so a hook bug can never trap a session.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { gitOutput } = require('./kit-git-lib.js');
const { writeRoleBoundary, usableSessionId } = require('./kit-compact-lib.js');

// How often the heartbeat is rewritten. The stamp's only reader asks whether
// the session was alive recently, so a stamp per turn would buy nothing and
// cost a write on every stop of every registered session on the machine.
const HEARTBEAT_THROTTLE_MS = 10 * 60 * 1000;

// How recently the session must have pushed status for a turn end to rest the
// marker on that push. The two windows are the same figure and are deliberately
// separate constants: this one bounds how stale a declaration may be before the
// marker stops resting on it, a question about the declaration's age, while the
// one above bounds a write rate.
const STATUS_FRESH_MS = 10 * 60 * 1000;

// A registry entry is a handful of short lines. Anything past this is not one,
// and is left untouched rather than parsed.
const ENTRY_MAX_BYTES = 64 * 1024;

// How long the tree read may take before the turn end stops waiting on it.
const GIT_TIMEOUT_MS = 5000;

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// The registry entry for a session, or null. The id is held to the shared
// marker-scope rule before it is joined to anything, so a value carrying a
// separator or a parent segment never composes a path here at all.
function entryPath(sessionId) {
    if (usableSessionId(sessionId) === null) return null;
    return path.join(os.homedir(), '.claude', 'coordinator', os.hostname(),
        'registry', sessionId + '.md');
}

// The entry's text, or null where there is no entry to act on: an absent path,
// something that is not a regular file, or a file too large to be one of ours.
// This is the leg that makes an unregistered session cost one stat.
function readEntry(full) {
    try {
        const st = fs.statSync(full);
        if (!st.isFile() || st.size > ENTRY_MAX_BYTES) return null;
        return fs.readFileSync(full, 'utf8');
    } catch {
        return null;
    }
}

// The value of a `<Field>: <value>` line, or null where the entry carries no
// such line. The entry's shape is the role skill's directory contract.
function field(text, name) {
    const match = new RegExp('^' + name + ':[^\\S\\r\\n]*(.*)$', 'm').exec(text);
    return match === null ? null : match[1].trim();
}

// Whether a recorded ISO stamp is within maxAgeMs of now. An absent,
// unparseable, or future stamp is not fresh: a future one would otherwise open
// a window that never closes, which is the reading the registry's own
// heartbeat rule takes for the same reason.
function stampIsFresh(value, maxAgeMs) {
    if (typeof value !== 'string' || value === '') return false;
    const at = Date.parse(value);
    if (!Number.isFinite(at)) return false;
    const age = Date.now() - at;
    return age >= 0 && age <= maxAgeMs;
}

// Rewrite the entry's existing `Heartbeat:` line in place, atomically. The
// session that registered is the entry's only writer bar this line, so nothing
// else in the file is touched and a missing line is left missing rather than
// added: an entry without one is not the shape the contract defines, and
// restructuring a peer's single-writer artifact is not this hook's to do.
// The temporary takes a transient name the store's sync allowlist refuses, so
// a crash between the write and the rename leaves nothing that replicates.
//
// The read behind `text` and this rewrite are not locked against each other, a
// second residual named here rather than left for a reader to find: an entry
// rewritten between that read and the rename below is replaced wholesale by
// the pre-read text carrying this stamp. The window is the two syscalls
// between them, and the entry's only other writer is its own session at its
// own push moments, so the worst loss is one status push, visible to that
// session and repaired by its next one.
function stampHeartbeat(full, text) {
    if (!/^Heartbeat:/m.test(text)) return;
    const stamped = text.replace(/^Heartbeat:.*$/m, 'Heartbeat: ' + new Date().toISOString());
    const tmp = full + '.tmp.' + process.pid;
    try {
        fs.writeFileSync(tmp, stamped, 'utf8');
        fs.renameSync(tmp, full);
    } catch {
        try { fs.unlinkSync(tmp); } catch { /* nothing left to clean up */ }
    }
}

// Whether the project directory holds no uncommitted work. A non-git directory
// and a git that fails or times out both read as clean, deliberately: the
// marker's worst case is a compaction landing at a boundary the session itself
// declared, so the conservative direction here is the permissive one, and a
// seat whose project directory is not a checkout has no tree to be mid-work on.
function treeIsClean(cwd) {
    const out = gitOutput(cwd, ['status', '--porcelain'], { timeoutMs: GIT_TIMEOUT_MS });
    if (out === null) return true;
    return out.trim() === '';
}

function main() {
    let payload = {};
    try { payload = JSON.parse(readStdin() || '{}'); } catch { /* defaults */ }

    const sessionId = payload.session_id || payload.sessionId;
    const full = entryPath(sessionId);
    if (full === null) return;
    const text = readEntry(full);
    if (text === null) return;

    if (!stampIsFresh(field(text, 'Heartbeat'), HEARTBEAT_THROTTLE_MS)) {
        stampHeartbeat(full, text);
    }

    const cwd = payload.cwd || process.cwd();
    if (stampIsFresh(field(text, 'Status-updated'), STATUS_FRESH_MS) && treeIsClean(cwd)) {
        writeRoleBoundary(cwd, sessionId);
    }
}

// Run as the Stop hook only when invoked directly. A require() of this file
// (the kit-doctor load check) then verifies it parses and its
// kit-compact-lib.js dependency resolves, without executing the hook.
if (require.main === module) {
    try { main(); } catch { /* never trap the session */ }
    process.exitCode = 0;
}
