// Shared library for the boundary-gated compaction checkpoint.
//
// The checkpoint is a small project-scoped JSON file (.kit/compact-checkpoint.json,
// gitignored territory) recording the plan path a chapter boundary was reached
// for. It is the signal between two programs that must agree on its path and
// shape: the checkpoint CLI (kit-compact-checkpoint.js) writes it at the
// chapter-close ritual, and the PreCompact gate (kit-compact-gate.js) reads it
// to decide whether a pending auto-compaction may land, consuming (deleting) it
// on the allow so the next mid-chapter attempt is denied again. Single-sourcing
// the path and the read/write/clear operations here is what keeps the writer
// and the reader from drifting apart.
//
// Node core modules only, CommonJS, zero dependencies. Every exported function
// that touches the filesystem is wrapped so it never throws: a filesystem
// hiccup degrades to a null/refusal result instead of trapping the caller,
// matching kit-goal-lib.js.

'use strict';

const fs = require('fs');
const path = require('path');
const { normalizePlanArg } = require('./kit-goal-lib.js');

// Path to the checkpoint file for a given repo root.
function checkpointPath(cwd) {
    return path.join(cwd, '.kit', 'compact-checkpoint.json');
}

// Read and parse the checkpoint file. Returns the parsed object, or null if
// the file is absent, unreadable, or not valid JSON. The content is untrusted
// data (the file is user-writable): callers compare its plan against the armed
// goal's and must never surface its values unsanitized.
function readCheckpoint(cwd) {
    try {
        const raw = fs.readFileSync(checkpointPath(cwd), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Write the checkpoint atomically (tmp file + rename), recording the plan it
// belongs to and the session the goal is currently bound to. Returns
// { ok:true, plan } or { ok:false, reason }; never throws.
//
// The plan path is validated through kit-goal-lib's normalizePlanArg, the same
// gate every stored plan path passes: it rejects control characters and any
// path that escapes cwd, and the NORMALIZED form is what gets stored. For a
// plan armGoal wrote, normalization is idempotent, so the stored value equals
// the goal's and the gate's equality check matches; a hand-edited goal state
// carrying a value armGoal would never have written either refuses here or
// stores a normalized form the gate reads as absent, both of which degrade to
// the status quo rather than opening the gate on untrusted input.
//
// boundSession pins the checkpoint to the run that opened it: the gate treats
// a checkpoint whose recorded boundSession does not match the goal's as
// absent, so a checkpoint orphaned by a crash cannot open the gate for the
// re-bound session that resumes the plan. The value is copied from the goal
// state, so it is held to bindSession's own storage rules (a string, capped
// length, no control characters); null is stored as null (an unbound goal),
// which the gate likewise never matches.
//
// The tmp name carries this process's pid so two writers never collide on the
// same tmp path, and a failed rename unlinks its tmp so orphans do not
// accumulate in .kit/.
function writeCheckpoint(cwd, planRel, boundSession) {
    const normalized = normalizePlanArg(cwd, planRel);
    if (normalized === null) {
        return { ok: false, reason: 'plan path is invalid or outside the repo' };
    }
    let session = null;
    if (boundSession !== undefined && boundSession !== null) {
        if (typeof boundSession !== 'string' || boundSession === '' || boundSession.length > 128
            || /[\x00-\x1F]/.test(boundSession)) {
            return { ok: false, reason: 'bound session is invalid' };
        }
        session = boundSession;
    }
    const cp = checkpointPath(cwd);
    const state = { plan: normalized, boundSession: session, openedAt: new Date().toISOString() };
    try {
        fs.mkdirSync(path.dirname(cp), { recursive: true });
        const tmp = cp + '.tmp.' + process.pid;
        try {
            fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
            fs.renameSync(tmp, cp);
        } catch (err) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
            throw err;
        }
    } catch (err) {
        return { ok: false, reason: 'could not write checkpoint: ' + (err && err.message ? err.message : String(err)) };
    }
    return { ok: true, plan: normalized };
}

// Delete the checkpoint file if present. Returns { ok:true, cleared:true } when
// a file was removed, { ok:true, cleared:false } when none was open, and
// { ok:false, cleared:false, reason } when the file exists but the delete
// failed. Never throws. The gate calls this to consume a matching checkpoint;
// a failed delete there degrades to the gate standing open (compaction lands
// mid-chapter, the pre-gate status quo), never to a wedged session.
function clearCheckpoint(cwd) {
    const cp = checkpointPath(cwd);
    try {
        if (!fs.existsSync(cp)) {
            return { ok: true, cleared: false };
        }
        fs.unlinkSync(cp);
        return { ok: true, cleared: true };
    } catch (err) {
        return {
            ok: false,
            cleared: false,
            reason: 'could not clear checkpoint: ' + (err && err.message ? err.message : String(err))
        };
    }
}

module.exports = { checkpointPath, readCheckpoint, writeCheckpoint, clearCheckpoint };
