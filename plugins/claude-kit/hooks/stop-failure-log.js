#!/usr/bin/env node
// StopFailure hook: record an API-error turn death, decide nothing.
//
// A turn that ends because the API refused it (a session limit above all)
// routes to StopFailure, not Stop, so the goal leash on Stop never sees it and
// an unattended run simply stops. This hook is the durable record of that
// moment: it appends the failure payload to .kit/stop-failure-events.jsonl and
// atomically replaces .kit/stop-failure-latest.json with the same record. The
// watcher (plugins/claude-kit/scripts/stop-failure-watcher.ps1), running
// outside any session, reads the marker and owns every decision: whether the
// failure is retryable, when to resume, and whether this run is even in scope.
//
// The split is deliberate. The payload's shape past the common hook fields is
// undocumented and can change upstream without notice, and a hook that
// classified would have to be re-shipped whenever it did. So this file is
// shape-agnostic: it does not validate the payload against any field set, does
// not branch on the error value, does not read the goal state, and does not
// act. Whatever the payload carries is what the record carries.
//
// Fail-open on every path, which is the whole contract. StopFailure cannot
// block anything (exit code 2 is ignored on this event), so the only harm this
// hook could do is noise or a crash report, and every escape therefore degrades
// to "do nothing, exit 0". The two writes are independent: one failing is not a
// reason to skip the other, so a full disk on the events log still leaves the
// watcher a current marker, and an unwritable marker still leaves the history.
//
// Nothing is ever written to stdout or stderr. The payload is untrusted data
// (its strings come from an API error message), a hook's stderr can land in a
// model's context, and this hook has nothing to say that a human needs, so the
// sibling convention of sanitizing repo data before output is met here by
// emitting none at all.

'use strict';

const fs = require('fs');
const path = require('path');

// The byte ceiling on the events log. Past it the append is skipped and only
// the latest-marker is written.
//
// A record runs a few hundred bytes to a few kilobytes: the common hook fields
// are short, and the two free-form strings the payload can carry (the raw API
// error and the user-facing error text) are unbounded in principle. At that
// size 4 MB holds thousands of failures, far more history than any real
// incident produces, while a pathological loop (a session that fails, resumes,
// and fails again on every turn) stops growing the file at 4 MB instead of
// filling the disk. The cap costs history only, never the live signal: the
// marker is what the watcher reads and it is written on every event regardless.
const EVENTS_LOG_MAX_BYTES = 4 * 1024 * 1024;

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// The record written to both files: the PARSED payload re-serialized, never
// raw stdin echoed, plus the time it was recorded. recordedAt is applied last
// so a payload carrying a field of that name cannot displace the real
// timestamp. Input that is not a JSON object (unparseable, or a JSON scalar or
// array) is recorded as a note naming only its length in bytes: the content is
// untrusted and, being unparseable, cannot be re-serialized into a safe shape,
// so none of it is kept.
function buildRecord(raw) {
    let payload = null;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    const recordedAt = new Date().toISOString();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { unparsed: true, bytes: Buffer.byteLength(raw, 'utf8'), recordedAt };
    }
    return { ...payload, recordedAt };
}

// Append one JSON line to the events log, unless the log has reached the byte
// ceiling. A log whose size cannot be read is treated as empty, so an
// unreadable stat costs a skipped cap check rather than a skipped record.
function appendEvent(dir, line) {
    try {
        const events = path.join(dir, 'stop-failure-events.jsonl');
        fs.mkdirSync(dir, { recursive: true });
        let size = 0;
        try { size = fs.statSync(events).size; } catch { size = 0; }
        if (size >= EVENTS_LOG_MAX_BYTES) return;
        fs.appendFileSync(events, line + '\n', 'utf8');
    } catch { /* the record is best-effort; the marker write is independent */ }
}

// Replace the latest-marker atomically (tmp file plus rename), so a reader that
// catches the write mid-flight sees the previous complete marker rather than a
// half-written one. The tmp name carries this process's pid so two writers
// never collide on the same tmp path, and a failed rename unlinks its tmp so
// orphans do not accumulate in .kit/. Mirrors writeCheckpoint in
// kit-compact-lib.js, which the compaction checkpoint relies on for the same
// reason.
function writeLatest(dir, line) {
    try {
        const latest = path.join(dir, 'stop-failure-latest.json');
        fs.mkdirSync(dir, { recursive: true });
        const tmp = latest + '.tmp.' + process.pid;
        // lstatSync, not statSync: the tmp name is predictable, and a symlink
        // or junction planted at it must not pass as a regular file. statSync
        // follows the link, so the write would land in whatever it points at,
        // which turns a predictable name into a write-anywhere primitive. An
        // absent tmp is the ordinary case, the write creates it; anything
        // present that is not a plain file ends the marker write, leaving the
        // previous marker and the independent events append untouched.
        let st = null;
        try { st = fs.lstatSync(tmp); } catch { /* no tmp yet: the write creates it */ }
        if (st && !st.isFile()) return;
        try {
            fs.writeFileSync(tmp, line + '\n', 'utf8');
            fs.renameSync(tmp, latest);
        } catch (err) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
            throw err;
        }
    } catch { /* the marker is best-effort; the events append is independent */ }
}

function main() {
    const raw = readStdin();
    const record = buildRecord(raw);
    // The project directory comes from the payload when it carries one, the
    // process's own working directory otherwise (which is where a malformed
    // payload lands, having no cwd to name). This is the sibling hooks'
    // convention; both resolve to the project the session is running in.
    const cwd = (typeof record.cwd === 'string' && record.cwd !== '') ? record.cwd : process.cwd();
    const dir = path.join(cwd, '.kit');
    let line;
    try {
        line = JSON.stringify(record);
    } catch {
        return;
    }
    appendEvent(dir, line);
    writeLatest(dir, line);
}

// Run as the hook only when invoked directly, so a require() of this file can
// never write a record as a side effect. Any escape at all exits 0: this hook
// observes, and a failure to observe must never surface as a hook error.
if (require.main === module) {
    try { main(); } catch { /* fail-open: the record is best-effort */ }
    process.exitCode = 0;
}
