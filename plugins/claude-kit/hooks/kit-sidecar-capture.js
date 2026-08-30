#!/usr/bin/env node
// PostToolUse hook (Bash matcher): the judgment sidecar's capture duty.
//
// One JSON line per completed tool call, appended to a machine-local spool that
// a separate daemon consumes. The daemon asks a local model whether each call
// did what its stated intent required, which is the defect class the fleet can
// otherwise only assert about itself: an exit code belonging to the wrong
// command in a pipeline, a search whose silence proves nothing about its
// pattern, a staged list holding more than the intent named. None of that
// judgment happens here. This file's whole job is to get the INTENT, ACTION and
// RESULT triple onto disk and get out of the way.
//
// The spool contract, which the daemon reads and this hook writes, is
// sidecar/CONTRACT.md in the kit repo. The schema, mirrored here so a reader of
// this file needs nothing else to know what a line holds:
//
//   v          integer, schema version, always 1
//   callId     16 lowercase hex chars, the stable identity later stages dedup on
//   ts         ISO 8601 UTC, the moment of capture
//   sessionId  the observed session's id ('' when the payload carried none)
//   cwd        the observed session's working directory
//   tool       the tool name
//   intent     the call's declared intent (the Bash tool's description), '' when absent
//   command    the command text
//   result     the response's text channels joined, stdout then stderr then
//              error text then content blocks
//   truncated  true when any text field was cut by either cap
//   isError    the harness error flag, normalized across response shapes
//
// Dormant by default. The hook stats the spool root and exits having written
// nothing when it is absent, and it never creates the root: creating it is the
// DAEMON's activation act. That is what lets this ship to every machine inert.
// Installing the kit turns nothing on; running the daemon once turns capture on
// for every session on that machine from its next tool call, and deleting the
// root turns it off again with no restart and no setting.
//
// The capture duty emits NOTHING. The empty string on stdout is the contract on
// every path, success and failure alike; the delivery valve that will read this
// session's inbox and speak to the model is a later section and a second duty,
// not a widening of this one. Both channels are silenced at entry so a required
// module cannot put a byte on either.
//
// Two caps, both about the interleave. Several sessions on one machine append
// to the same day file and Node offers no cross-process atomic-append guarantee,
// so every line is written with ONE appendFileSync of a small buffer: 2000
// characters per text field (cwd, tool and sessionId included, so an oversized
// one shortens rather than dropping a record CUT_ORDER cannot reach), 8192
// bytes per whole line, cutting result first, then command, then intent. A
// record that still will not fit is dropped rather than written long. Small writes are the whole mitigation, and no lock is taken
// or ever should be: a lock puts the observed session on a critical path, which
// is the one thing this hook may not do. The consumer's half of that bargain is
// in the contract document: skip and COUNT malformed lines, never abort.
//
// The spool holds the text of every shell command and its output, so it is a
// sensitive artifact by construction. Day files are created 0600, which POSIX
// honors and Windows does not (Node maps mode to the read-only attribute alone
// there, and 0600 carries write permission, so the file inherits the ACL of the
// user profile directory it sits under). Nothing here redacts: a consumer must
// treat spool content as untrusted for quoting. The spool is written to disk
// unencrypted and the daemon sends its content off this machine to the endpoint
// it is configured for; sidecar/CONTRACT.md states that posture in full.
//
// Both paths this process opens are screened with lstat, never stat. A symlink
// or a directory junction planted at the spool root would pass an isDirectory()
// test taken through stat, and capture would then write every command and its
// output straight through the link into whatever it points at: a synced folder,
// a repo working tree, a share. A junction needs no elevation on Windows. The
// root must be a real directory and the day file a real file or absent, or this
// hook stays dormant.
//
// No payload-derived path is ever opened. The only paths this process touches
// are under its own home directory, which is why there is no network-share
// guard of the kind the sibling nudges carry: a shell command's working
// directory is read into the line as data and never stat'ed.
//
// Growth is bounded on both axes. A day file past DAY_FILE_MAX_BYTES stops
// taking appends, because a stopped, crashed or never-installed daemon is
// indistinguishable from a running one from in here and the hook would
// otherwise append to an unread file forever. Retention across days is the
// daemon's, per the contract.
//
// Fail-open everywhere and by design. A malformed payload, an unreadable stdin,
// a permission error, a full disk, a torn spool, or any internal throw all reach
// the same place: exit 0, nothing captured, the observed session undisturbed.
// There is no deny path in this file and no non-zero exit. A missed line is an
// acceptable cost and degrades to the pre-hook status quo; a hook that crashed a
// session in order to record a tool call would have inverted its own purpose.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// The harness error flag's normalization, the one this hook records in every
// line. Its canonical definition is a small shared library rather than the
// recognition nudge that also uses it: requiring that 1,600-line sibling for
// one predicate would pay its whole load on every captured call, and any
// failure inside it would silently disable capture fleet-wide.
//
// Required at module scope rather than lazily inside buildRecord. The library
// is small enough that deferring it buys nothing, and hoisting it puts the one
// state where capture cannot run in one place at the top of the file instead of
// inside a helper that would answer "nothing to capture" for it. A load failure
// leaves this null and every call stands down silently, which is the same
// fail-open posture as every other failure here: the load is guarded because an
// unguarded throw at module scope escapes the entry point's catch below and
// would end the hook non-zero with a stack trace on stderr, which is precisely
// the disturbance to the observed session this file may never cause.
let payloadLib = null;
try {
    payloadLib = require('./kit-tool-payload-lib.js');
} catch { /* a damaged install: capture stands down, the session is undisturbed */ }

// The line schema's version. A consumer that does not recognize it skips the
// line, so this changes only when a field's meaning changes under a reader
// that cannot tell.
const SCHEMA_VERSION = 1;

// Per-field character cap. Two thousand characters is far past any real
// description and holds enough of a command's output for a verdict; the judge
// reads a triple, not a transcript.
const FIELD_CAP = 2000;

// Whole-line byte cap, newline included. See the header: this is the interleave
// mitigation, and the contract lets a consumer rely on it.
const LINE_CAP_BYTES = 8192;

// The order fields are cut in when a line is over the byte cap. Result first
// because it is the least dense (a verdict needs the tail of an output far less
// than it needs the command that produced it), intent last because a stated
// intent is short by nature and losing it costs the judgment its premise.
const CUT_ORDER = ['result', 'command', 'intent'];

// Owner-only on the day file. appendFileSync applies the mode at creation only,
// so the first writer of the day sets it and the rest inherit whatever is there.
const FILE_MODE = 0o600;

// Bytes past which a day file stops taking appends. Nothing in here can tell a
// running daemon from a stopped, crashed or never-installed one: the spool root
// outlives the process that made it, so a machine whose daemon died in March
// would otherwise append to an unread file for as long as the root exists.
//
// Sized against the volume the spec states, a few thousand calls a day. At the
// 8192-byte line cap, five thousand calls is 41 MB of worst-case day file, and
// real lines run far under the cap, so 64 MiB clears an honest heavy day with
// room to spare while still bounding what an unconsumed spool can take from the
// disk. Reaching it means the consumer is gone, not that the day was busy.
const DAY_FILE_MAX_BYTES = 64 * 1024 * 1024;

// The response keys carrying output text, in the order they are joined. Stdout
// first because it is what the session read; a bare-string response and an
// array of content blocks are handled separately in resultText.
const OUTPUT_KEYS = ['stdout', 'stderr'];

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// Nothing else may write to either channel. The capture duty's contract is an
// empty stdout on every path, and a single stray byte from a required module
// would be read by the harness as this hook's answer.
function silenceOthers() {
    process.stdout.write = () => true;
    process.stderr.write = () => true;
}

// The spool root. Absent means dormant; this hook never creates it.
function spoolDir() {
    return path.join(os.homedir(), '.claude', 'kit-sidecar', 'spool');
}

// Whether the spool root is a directory this hook will write into. Anything
// else at that path is not a root the daemon made, and capture stays dormant
// rather than guessing at it.
//
// lstatSync, never statSync: stat follows links, so a symlink or a Windows
// directory junction planted at the spool root answers isDirectory() with the
// TARGET's type and every command and its output would be written through the
// link into whatever it points at. A junction needs no elevation to create.
// lstat reports a link as a link on both platforms, so isDirectory() is already
// false for one; the isSymbolicLink() test is written out beside it because the
// refusal is the point of this function and a reader should not have to know
// that to see it.
function spoolActive(dir) {
    try {
        const st = fs.lstatSync(dir);
        return st.isDirectory() && !st.isSymbolicLink();
    } catch {
        return false;
    }
}

// The day file for a moment, named by UTC date. A file per day bounds growth
// and makes retention a delete rather than a rewrite of a file being appended
// to; the daemon's offset is a map keyed on this name, per the contract.
function dayFile(dir, nowMs) {
    return path.join(dir, new Date(nowMs).toISOString().slice(0, 10) + '.jsonl');
}

// The stable identity of one captured call. Random rather than derived from the
// payload: two identical commands in one session are two calls, and later
// sections dedup delivery on this value, so a collision between them would
// silence the second one's finding.
function callId() {
    return crypto.randomBytes(8).toString('hex');
}

// A string with a trailing unpaired high surrogate removed. Every cut in this
// file slices at a character index, and a character index can fall between the
// halves of a surrogate pair; the orphan left behind is not a character. Left
// in place it costs twice: JSON.stringify emits it as a six-byte \udXXX escape
// where the whole pair was four UTF-8 bytes, so a cut can make a line LONGER,
// and a consumer decoding the line gets a replacement character at the end of
// the field. Only the tail can be orphaned here, since every slice keeps a
// prefix.
function trimLoneSurrogate(text) {
    if (text === '') return text;
    const last = text.charCodeAt(text.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) return text.slice(0, text.length - 1);
    return text;
}

// A payload value as the string the line carries, capped. Anything that is not
// a string reads as absent rather than as its own JSON rendering: a field whose
// type the harness changed is better empty than misreported.
function textField(value) {
    if (typeof value !== 'string' || value === '') return '';
    return trimLoneSurrogate(value.slice(0, FIELD_CAP));
}

// The call's output as one string, across the three response shapes the harness
// produces: an object with named channels, a bare string, and an array of
// content blocks. Unlike the sibling nudge's failureOutput, this is NOT gated on
// the call having failed: the judge needs what a successful call printed just as
// much, since the defect class it exists for exits 0.
//
// Every part is bounded BEFORE it is collected. The caller cuts the joined
// result to the field cap, so nothing here changes what is kept; what it
// changes is the peak. A multi-megabyte stdout would otherwise be held whole,
// joined into a second copy, and then thrown away to keep two thousand
// characters, all of it allocated on the observed session's turn. Bounded this
// way, the intermediate is a small multiple of the cap however large the
// response was.
//
// The bound is one character PAST the cap, deliberately. Truncation is decided
// in exactly one place, the caller's own cut, by comparing what it kept against
// what it was given; a part cut to the cap exactly would arrive looking
// uncut and a call that lost megabytes would spool with truncated false.
const PART_CAP = FIELD_CAP + 1;

function resultText(payload) {
    const response = payload.tool_response;
    if (typeof response === 'string') return response.slice(0, PART_CAP);
    const parts = [];
    const push = (text) => { parts.push(text.slice(0, PART_CAP)); };
    const pushBlocks = (blocks) => {
        for (const block of blocks) {
            if (typeof block === 'string') push(block);
            else if (block !== null && typeof block === 'object' && typeof block.text === 'string') {
                push(block.text);
            }
        }
    };
    if (Array.isArray(response)) {
        pushBlocks(response);
    } else if (response !== null && typeof response === 'object') {
        for (const key of OUTPUT_KEYS) {
            if (typeof response[key] === 'string') push(response[key]);
        }
        if (typeof response.error === 'string') push(response.error);
        else if (response.error !== null && typeof response.error === 'object'
            && typeof response.error.message === 'string') push(response.error.message);
        if (Array.isArray(response.content)) pushBlocks(response.content);
    }
    return parts.filter((part) => part !== '').join('\n');
}

// The record for a payload, or null when the payload carries no call this hook
// can describe. The requirement is a command string rather than a tool-name
// allowlist: the judgment triple needs an ACTION, and a payload without one has
// nothing to judge whatever the matcher let through.
//
// isError comes from kit-tool-payload-lib.js's callFailed, which normalizes the
// error indicator across every response shape the harness has been seen to
// produce and answers the recognition nudge's own question too. A library that
// did not load leaves payloadLib null and returns null here rather than falling
// back to a narrower reading: a second normalization is exactly the drift the
// shared function exists to prevent, and a line whose isError is wrong is worse
// than a line that was never written.
//
// cwd and tool go through the same cap as the text fields. CUT_ORDER cannot
// reach either of them, so an oversized one (a Windows long path reaches this)
// would make serialize drop the whole record with no signal anywhere.
function buildRecord(payload, nowMs) {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const input = payload.tool_input;
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
    if (typeof input.command !== 'string' || input.command === '') return null;
    if (typeof payload.tool_name !== 'string' || payload.tool_name === '') return null;
    if (payloadLib === null || typeof payloadLib.callFailed !== 'function') return null;

    const raw = {
        intent: typeof input.description === 'string' ? input.description : '',
        command: input.command,
        result: resultText(payload),
        sessionId: typeof payload.session_id === 'string' ? payload.session_id
            : (typeof payload.sessionId === 'string' ? payload.sessionId : ''),
        cwd: typeof payload.cwd === 'string' ? payload.cwd : '',
        tool: payload.tool_name
    };
    const intent = textField(raw.intent);
    const command = textField(raw.command);
    const result = textField(raw.result);
    const sessionId = textField(raw.sessionId);
    const cwd = textField(raw.cwd);
    const tool = textField(raw.tool);
    const truncated = intent.length < raw.intent.length
        || command.length < raw.command.length
        || result.length < raw.result.length
        || sessionId.length < raw.sessionId.length
        || cwd.length < raw.cwd.length
        || tool.length < raw.tool.length;

    return {
        v: SCHEMA_VERSION,
        callId: callId(),
        ts: new Date(nowMs).toISOString(),
        sessionId,
        cwd,
        tool,
        intent,
        command,
        result,
        truncated,
        isError: payloadLib.callFailed(payload) === true
    };
}

// The bytes a line occupies in the spool, its terminating newline included.
function lineBytes(line) {
    return Buffer.byteLength(line, 'utf8') + 1;
}

// The record serialized under the byte cap, or null when it cannot fit. Fields
// are cut in CUT_ORDER, each one down to empty before the next is touched, and
// any cut sets truncated.
//
// The deficit is in BYTES and a slice takes CHARACTERS, so the cut is scaled by
// what this field's own characters actually cost in the serialized line. One
// character can serialize to six bytes (an escape) or to four (a pair), and
// treating the byte deficit as a character count empties a field of control
// characters whole where cutting a sixth of it would have done. The ratio is
// measured on the field as it stands, so it re-reads on every pass as the
// expensive characters leave.
//
// The loop terminates on the length guard, not on any per-character byte
// accounting: at least one character goes on every pass and length is strictly
// decreasing, so the worst case is an empty field and the next one in
// CUT_ORDER. It cannot terminate on bytes, because removing a character can ADD
// bytes: cutting one half off a surrogate pair leaves an orphan JSON.stringify
// emits as a six-byte \udXXX escape in place of the pair's four UTF-8 bytes.
// Every slice is trimmed of that orphan, which is also what keeps that case
// from repeating.
//
// Null is a dropped record, which now needs a serialized skeleton (identity,
// timestamp, and the capped cwd, tool and session id together) past 8192 bytes
// to reach. Dropping is deliberate: the cap is a promise the contract makes to
// the consumer about the interleave, and a line written long would break it for
// every reader at once.
function serialize(record) {
    const out = { ...record };
    let line = JSON.stringify(out);
    if (lineBytes(line) <= LINE_CAP_BYTES) return line;
    for (const field of CUT_ORDER) {
        while (out[field].length > 0 && lineBytes(line) > LINE_CAP_BYTES) {
            const over = lineBytes(line) - LINE_CAP_BYTES;
            const bytesPerChar = Buffer.byteLength(JSON.stringify(out[field]), 'utf8') / out[field].length;
            const wanted = Math.ceil(over / Math.max(1, bytesPerChar));
            const cut = Math.min(out[field].length, Math.max(1, wanted));
            out[field] = trimLoneSurrogate(out[field].slice(0, out[field].length - cut));
            out.truncated = true;
            line = JSON.stringify(out);
        }
        if (lineBytes(line) <= LINE_CAP_BYTES) return line;
    }
    return null;
}

// Whether the day file will take an append: absent, or a real file still under
// the size bound. lstat rather than stat for the reason spoolActive gives, and
// applied to this path too because a link planted inside a legitimate spool root
// reaches the same place as one planted at the root. Anything that is not a
// regular file is refused rather than written through, and a file past the size
// bound is left alone: the daemon that should have consumed it is gone.
function dayFileWritable(file) {
    let st = null;
    try { st = fs.lstatSync(file); } catch { return true; }
    if (!st.isFile() || st.isSymbolicLink()) return false;
    return st.size <= DAY_FILE_MAX_BYTES;
}

// Capture one call. Returns true when a line landed, false on every other path,
// including dormancy, an undescribable payload, a day file this hook will not
// append to, and a failed write. Never throws on its own account; the entry
// point turns any escape into a silent exit 0 regardless.
function main(payload, nowMs) {
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    const dir = spoolDir();
    if (!spoolActive(dir)) return false;

    const record = buildRecord(payload, now);
    if (record === null) return false;
    const line = serialize(record);
    if (line === null) return false;

    const file = dayFile(dir, now);
    if (!dayFileWritable(file)) return false;
    try {
        fs.appendFileSync(file, line + '\n', { encoding: 'utf8', mode: FILE_MODE });
    } catch {
        return false;
    }
    return true;
}

// Run as the hook only when invoked directly, so a require() of this file (the
// suite reads its pure functions through it) can never append a spool line as a
// side effect. Every path exits 0 and writes nothing to stdout.
if (require.main === module) {
    silenceOthers();
    try {
        let payload = null;
        try { payload = JSON.parse(readStdin() || '{}'); } catch { payload = null; }
        main(payload);
    } catch { /* capture is best-effort; the session is never disturbed */ }
    process.exitCode = 0;
}

module.exports = {
    main,
    buildRecord,
    serialize,
    resultText,
    spoolDir,
    spoolActive,
    dayFile,
    dayFileWritable,
    callId,
    textField,
    trimLoneSurrogate,
    SCHEMA_VERSION,
    FIELD_CAP,
    LINE_CAP_BYTES,
    DAY_FILE_MAX_BYTES,
    CUT_ORDER
};
