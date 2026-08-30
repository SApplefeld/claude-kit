// Reading the capture spool: day files, byte offsets, line parsing, retention.
//
// The writer is plugins/claude-kit/hooks/kit-sidecar-capture.js and the two
// never import each other. sidecar/CONTRACT.md is the whole of what they share,
// and every rule this file implements is stated there:
//
//   - Day files are `<YYYY-MM-DD>.jsonl` under the spool root, one per UTC day,
//     and filename order is chronological order.
//   - The persisted offset is a MAP of filename to byte offset, never a single
//     number, because the spool is a set of files rather than one growing file.
//   - An offset advances only past a COMPLETE line. A trailing partial line is
//     a write in flight, so the offset stays before it and the next pass reads
//     it whole.
//   - A file shorter than its recorded offset was rotated or truncated by
//     something outside this daemon: reset that entry to 0 and count it, rather
//     than trusting a stale number and reading from the middle of a line.
//   - Entries for files that no longer exist are dropped, so retention deletes
//     do not grow the map without bound.
//   - Malformed lines are SKIPPED AND COUNTED. Several sessions append to one
//     day file with no cross-process atomic-append guarantee, so a torn line is
//     an expected event rather than a defect. What is a defect is a consumer
//     that stops reading, and what is a lie is one that skips silently: a
//     rising skip count is the only signal that the small-write mitigation has
//     stopped working.
//
// Offsets are BYTES and every slice here is taken on a Buffer for that reason.
// A character offset would drift from the file position on the first non-ASCII
// line and every later read would start mid-character. Splitting on 0x0A is
// safe on raw bytes because no continuation byte of a UTF-8 sequence can be
// 0x0A.
//
// Retention is the daemon's duty and it is a DELETE of whole day files, never a
// rewrite of a file another process is appending to. Deleting is the one
// destructive act in this daemon, so it is guarded on every axis: the window
// must be a sane positive integer, the clock must be a finite number, the name
// must match the day-file pattern exactly and round-trip through a real date,
// the day must be strictly older than the cutoff, the day must not be today's,
// and the entry must be a regular file rather than a link or a directory. A
// cutoff that cannot be computed deletes NOTHING, which is the only safe answer
// when the question is which files are expendable.

'use strict';

const fs = require('fs');
const path = require('path');

const { neutralize } = require('./text.js');

// The line schema version this daemon understands. A line carrying anything
// else is skipped and counted separately from a malformed one: an unrecognized
// version is a newer or older writer, not a torn write, and the two counts
// answer different questions.
const SCHEMA_VERSION = 1;

// Day file names, and nothing else in the spool root, are read. Retention will
// not delete a name that fails this test, so a note or a backup a person left
// there survives.
const DAY_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})\.jsonl$/;

// The most bytes read from one file in one pass. A backlog larger than this is
// consumed across several passes, which bounds what the daemon holds in memory
// however far behind it has fallen.
const MAX_READ_BYTES = 4 * 1024 * 1024;

// The defensive cap on a text field taken off a parsed line. The hook caps at
// 2000 characters, so no honest line is touched by this; it bounds a line
// written by hand or by something other than the hook before its content
// becomes a prompt.
const ENTRY_FIELD_CAP = 4000;

// How much of an unrecognized version value a skip diagnostic may echo. A
// version field is a small number in every honest line, and this is the only
// spool-derived text the daemon prints, so it is kept to a length a reader can
// take in and a log cannot drown in.
const VERSION_DETAIL_CAP = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The retention window in days, from the contract. Files older than this are
// deleted on daemon startup.
const RETENTION_DAYS = 14;

// The spool's day files in chronological order, and whether the listing can be
// trusted as the whole truth.
//
// Anything that is not a day file by name, and anything that is not a regular
// file, is left alone: a symlink or a junction planted in the spool root is
// refused rather than read through, following the same rule the capture hook
// applies on the writing side.
//
// `complete` is the part a caller acts destructively on. A directory that could
// not be read at all, or one entry whose lstat failed for any reason other than
// the entry being gone, means this list is a subset of what is really there and
// not a census of it. One transient EPERM from a virus scanner holding a file
// open is enough, and a caller that reads the resulting short list as "those
// files are gone" throws away offsets the daemon still needs.
function scanDayFiles(spoolDir) {
    let names = [];
    try {
        names = fs.readdirSync(spoolDir);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'readdir failed';
        return { names: [], complete: false, detail: code };
    }
    const kept = [];
    let complete = true;
    let detail = '';
    for (const name of names) {
        if (!DAY_FILE_RE.test(name)) continue;
        let st = null;
        try {
            st = fs.lstatSync(path.join(spoolDir, name));
        } catch (err) {
            const code = (err && typeof err.code === 'string') ? err.code : 'lstat failed';
            if (code !== 'ENOENT') {
                complete = false;
                if (detail === '') detail = `${name}: ${code}`;
            }
            continue;
        }
        if (!st.isFile() || st.isSymbolicLink()) continue;
        kept.push(name);
    }
    kept.sort();
    return { names: kept, complete, detail };
}

// The day file names alone, for a caller that only reads them.
function listDayFiles(spoolDir) {
    return scanDayFiles(spoolDir).names;
}

// The complete lines in one file from a byte offset, and the offset to persist
// after them. Never throws.
//
// The returned `nextOffset` is the position after the last complete line, so a
// partial trailing line is read again next pass. `reset` says the recorded
// offset was past the end of the file and the read started at 0 instead.
// `oversized` says the read window filled with no newline in it while more
// bytes remained, which the contract says cannot have come from the hook: the
// offset steps past that window rather than stalling on it forever.
//
// `lineEnds[i]` is the file position just past line `i`'s newline, measured on
// the Buffer. It is returned because the caller commits an offset per line and
// there is no way back from a decoded string to a byte position: the spool is
// several sessions appending to one file with no atomic-append guarantee, so a
// torn write splits at an arbitrary byte and a line holding half a multi-byte
// character is an expected event. Decoding replaces each of those bytes with
// U+FFFD, which re-encodes to three bytes, so a caller re-measuring the decoded
// line would commit an offset past the newline, resume mid-line, and eventually
// run past the end of the file and re-read the whole day.
function readFrom(file, offset, maxBytes) {
    const limit = (Number.isInteger(maxBytes) && maxBytes > 0) ? maxBytes : MAX_READ_BYTES;
    let st = null;
    try {
        st = fs.lstatSync(file);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        return { status: code === 'ENOENT' ? 'missing' : 'unreadable', lines: [], lineEnds: [], startOffset: 0, nextOffset: 0, reset: false, oversized: false };
    }
    if (!st.isFile() || st.isSymbolicLink()) {
        return { status: 'notfile', lines: [], lineEnds: [], startOffset: 0, nextOffset: 0, reset: false, oversized: false };
    }

    let start = (Number.isInteger(offset) && offset >= 0) ? offset : 0;
    let reset = false;
    if (st.size < start) {
        start = 0;
        reset = true;
    }
    if (st.size === start) {
        return { status: 'ok', lines: [], lineEnds: [], startOffset: start, nextOffset: start, reset, oversized: false };
    }

    const want = Math.min(limit, st.size - start);
    const buf = Buffer.allocUnsafe(want);
    let fd = null;
    let got = 0;
    try {
        fd = fs.openSync(file, 'r');
        got = fs.readSync(fd, buf, 0, want, start);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        return { status: 'unreadable', lines: [], lineEnds: [], startOffset: start, nextOffset: start, reset, oversized: false, detail: code };
    } finally {
        if (fd !== null) { try { fs.closeSync(fd); } catch { /* the read is what mattered */ } }
    }

    const chunk = buf.subarray(0, got);
    const lastNewline = chunk.lastIndexOf(0x0a);
    if (lastNewline === -1) {
        // No complete line here. Either a write is in flight, in which case the
        // offset stays put, or one "line" is longer than the whole read window
        // and no amount of waiting will terminate it.
        const moreBeyond = start + got < st.size;
        if (moreBeyond && got >= limit) {
            return { status: 'ok', lines: [], lineEnds: [], startOffset: start, nextOffset: start + got, reset, oversized: true };
        }
        return { status: 'ok', lines: [], lineEnds: [], startOffset: start, nextOffset: start, reset, oversized: false };
    }

    // Split on the Buffer, decoding each line separately, and record where each
    // one ended in the file. The positions come from the byte search, never from
    // the decoded text.
    const lines = [];
    const lineEnds = [];
    let from = 0;
    while (from <= lastNewline) {
        const nl = chunk.indexOf(0x0a, from);
        lines.push(chunk.toString('utf8', from, nl));
        lineEnds.push(start + nl + 1);
        from = nl + 1;
    }
    return { status: 'ok', lines, lineEnds, startOffset: start, nextOffset: start + lastNewline + 1, reset, oversized: false };
}

function textOf(value) {
    if (typeof value !== 'string') return '';
    return value.slice(0, ENTRY_FIELD_CAP);
}

// One spool line as an entry to judge, or a described skip. Skip reasons:
//
//   blank      an empty line, which costs nothing and says nothing
//   version    a `v` this daemon does not recognize, counted apart from the
//              torn-write count because it means a different writer
//   malformed  not JSON, not an object, or missing a field the judgment needs
//
// The version test is a strict comparison against the number 1, so a line
// carrying the STRING "1" is unrecognized rather than quietly accepted. A
// writer that changed the type of the version field changed the schema, which
// is the one thing the version field exists to signal.
function parseLine(raw) {
    // trim() carries the byte-order mark too (U+FEFF is whitespace to it), so a
    // day file some editor rewrote with a BOM parses rather than counting its
    // first line as torn.
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (text === '') return { ok: false, why: 'blank' };

    let obj = null;
    try {
        obj = JSON.parse(text);
    } catch {
        return { ok: false, why: 'malformed', detail: 'not JSON' };
    }
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return { ok: false, why: 'malformed', detail: 'not a JSON object' };
    }
    if (obj.v !== SCHEMA_VERSION) {
        // The version value is spool content, so it is bounded and neutralized
        // before it can become a diagnostic. A line that carried a megabyte of
        // terminal escapes as its `v` would otherwise print all of it.
        return { ok: false, why: 'version', detail: `v=${neutralize(JSON.stringify(obj.v)).slice(0, VERSION_DETAIL_CAP)}` };
    }
    if (typeof obj.callId !== 'string' || !/^[0-9a-f]{16}$/.test(obj.callId)) {
        return { ok: false, why: 'malformed', detail: 'callId is not 16 hex characters' };
    }
    if (typeof obj.command !== 'string' || obj.command === '') {
        return { ok: false, why: 'malformed', detail: 'no command to judge' };
    }

    return {
        ok: true,
        entry: {
            callId: obj.callId,
            ts: textOf(obj.ts),
            sessionId: textOf(obj.sessionId),
            cwd: textOf(obj.cwd),
            tool: textOf(obj.tool),
            intent: textOf(obj.intent),
            command: textOf(obj.command),
            result: textOf(obj.result),
            truncated: obj.truncated === true,
            isError: obj.isError === true
        }
    };
}

// The UTC day a moment belongs to, as the day files are named.
function utcDay(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

// The oldest day a file may name and be kept, or null when the inputs cannot
// produce one. Null means retention does nothing at all: an uncomputable cutoff
// is not a licence to delete, and every guard in this function exists so a
// wrong or empty window cannot reach the unlink below.
function retentionCutoffDay(nowMs, retentionDays) {
    if (!Number.isFinite(nowMs) || nowMs <= 0) return null;
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) return null;
    const midnight = Date.parse(`${utcDay(nowMs)}T00:00:00.000Z`);
    if (!Number.isFinite(midnight)) return null;
    return utcDay(midnight - (retentionDays * MS_PER_DAY));
}

// Whether a day-file name is a real calendar day. `2026-02-31.jsonl` matches the
// pattern and names no day, so it round-trips to something else and is left
// alone rather than compared as if it sorted correctly.
function dayOfName(name) {
    const m = DAY_FILE_RE.exec(name);
    if (m === null) return null;
    const day = `${m[1]}-${m[2]}-${m[3]}`;
    const ms = Date.parse(`${day}T00:00:00.000Z`);
    if (!Number.isFinite(ms)) return null;
    if (utcDay(ms) !== day) return null;
    return day;
}

// Delete spool day files older than the window and drop their offset entries.
// Runs on daemon startup, per the contract, and mutates the offsets map it is
// given. Returns what it did, including what it refused to do and why, because
// a retention pass that silently deleted nothing and one that silently deleted
// everything look identical from outside.
function runRetention(spoolDir, offsets, options) {
    const opts = options || {};
    // An omitted clock means "use the machine's". A clock that was PASSED and
    // is not a usable timestamp is not silently replaced with the machine's:
    // the caller meant to name a moment and named something else, and deleting
    // by a clock nobody asked for is the failure mode this whole function is
    // guarded against.
    const nowMs = opts.nowMs === undefined ? Date.now() : opts.nowMs;
    const days = opts.retentionDays === undefined ? RETENTION_DAYS : opts.retentionDays;
    const report = { deleted: [], failed: [], droppedOffsets: [], cutoffDay: null, skipped: null };

    const cutoff = retentionCutoffDay(nowMs, days);
    if (cutoff === null) {
        report.skipped = 'no usable retention window, so nothing was deleted';
        return report;
    }
    report.cutoffDay = cutoff;
    const today = utcDay(nowMs);

    let names = [];
    try {
        names = fs.readdirSync(spoolDir);
    } catch {
        report.skipped = 'spool root unreadable, so nothing was deleted';
        return report;
    }

    for (const name of names) {
        const day = dayOfName(name);
        if (day === null) continue;
        if (day >= cutoff) continue;
        // Belt and braces beside the cutoff test above: today's file is the one
        // being appended to right now, and no arithmetic fault may reach it.
        if (day >= today) continue;

        const file = path.join(spoolDir, name);
        let st = null;
        try { st = fs.lstatSync(file); } catch { continue; }
        if (!st.isFile() || st.isSymbolicLink()) continue;

        try {
            fs.unlinkSync(file);
            report.deleted.push(name);
        } catch (err) {
            report.failed.push({ name, detail: (err && err.code) ? err.code : 'unlink failed' });
            continue;
        }
        if (offsets !== null && typeof offsets === 'object' && Object.prototype.hasOwnProperty.call(offsets, name)) {
            delete offsets[name];
            report.droppedOffsets.push(name);
        }
    }
    return report;
}

// Drop offset entries for files that are no longer in the spool. Returns the
// names dropped. Without this the map grows by one entry per day forever, since
// retention deletes the file and a map entry outlives what it described.
//
// Dropping an offset is destructive: the file it named is re-read from zero and
// every call in it judged again, up to fourteen days of spool. So a name missing
// from the listing is a question rather than an answer. Given `spoolDir` the
// absence is confirmed by lstatting the path and dropping only on ENOENT, which
// is the one code that means the file is actually gone; anything else, a file
// held open by a scanner, a permission error, an entry the listing skipped for a
// reason of its own, keeps the offset. Without a `spoolDir` the listing is taken
// at its word, which is the right behavior for a caller that built the list
// itself and the wrong one for a caller that read it off a disk.
function dropVanishedOffsets(offsets, presentNames, options) {
    if (offsets === null || typeof offsets !== 'object') return [];
    const spoolDir = (options && typeof options.spoolDir === 'string' && options.spoolDir !== '')
        ? options.spoolDir : '';
    const present = new Set(presentNames);
    const dropped = [];
    for (const name of Object.keys(offsets)) {
        if (present.has(name)) continue;
        if (spoolDir !== '') {
            let gone = false;
            try {
                fs.lstatSync(path.join(spoolDir, name));
            } catch (err) {
                gone = (err && err.code === 'ENOENT');
            }
            if (!gone) continue;
        }
        delete offsets[name];
        dropped.push(name);
    }
    return dropped;
}

module.exports = {
    SCHEMA_VERSION,
    DAY_FILE_RE,
    MAX_READ_BYTES,
    ENTRY_FIELD_CAP,
    VERSION_DETAIL_CAP,
    RETENTION_DAYS,
    scanDayFiles,
    listDayFiles,
    readFrom,
    parseLine,
    utcDay,
    dayOfName,
    retentionCutoffDay,
    runRetention,
    dropVanishedOffsets
};
